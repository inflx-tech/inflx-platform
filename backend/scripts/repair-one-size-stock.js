#!/usr/bin/env node
/**
 * Repair — a one-size product whose stock was typed in the product's own box and never reached its
 * one size ("Free Size"). The shopper app obeys the size, so it said "Out of stock" while the
 * Listings page showed the product's own number.
 * Usage: node scripts/repair-one-size-stock.js --dry | --apply   [--env=.env]
 *
 * What it touches: ONLY products that have exactly one size in all (one colour, one size), whose
 * size says 0 while the product's own number is above 0. It copies the product's own number into
 * that one size. Nothing else on the row is written — not the price, not the own number, not a photo.
 *
 * Why this is safe to tell apart from a real sell-out: when an order takes stock, stock.service
 * resets the product's own number to the total of its sizes — so "size 0, own number above 0" can
 * only come from how the product was listed. The script still refuses any product an order has
 * touched. Idempotent: a second --apply finds nothing.
 */
const path = require('path');
const envArg = process.argv.find((a) => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');
const stock = require('../src/services/stock.service');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

const asObj = (v) => { if (!v) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return null; } };

/** The products to repair, each with the one size entry to write. */
function pick(rows) {
  const out = [];
  for (const r of rows) {
    const vj = asObj(r.variants_json);
    const es = stock.sizeEntries(vj);
    if (es.length !== 1) continue;                                   // exactly one size in all
    const s = es[0];
    if (!s || typeof s !== 'object') continue;
    if (s.stock == null || s.stock === '' || !Number.isFinite(Number(s.stock))) continue;   // blank = not counted: already sells
    if (Number(s.stock) > 0) continue;
    const own = r.stock == null ? null : Number(r.stock);
    if (!(own > 0)) continue;
    out.push({ row: r, vj, entry: s, own });
  }
  return out;
}

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  // What must not move: every product's name, price, own number and state; every order line.
  const fixed = async () => ({
    products:     (await one(`SELECT count(*)::int n FROM brand_products`)).n,
    products_print: (await one(`SELECT md5(string_agg(id::text || '|' || name || '|' || price::text || '|' || COALESCE(stock::text,'') || '|' || is_active::text || '|' || COALESCE(pushed_to_store::text,''), ',' ORDER BY id)) t FROM brand_products`)).t,
    order_lines:  (await one(`SELECT count(*)::int n FROM order_lines`)).n,
  });
  const others = async (ids) => (await one(
    `SELECT COALESCE(md5(string_agg(id::text || '|' || COALESCE(variants_json::text,''), ',' ORDER BY id)), '-') t FROM brand_products WHERE NOT (id = ANY($1::uuid[]))`, [ids])).t;

  try {
    await c.query('BEGIN');
    const { rows } = await c.query(
      `SELECT bp.id, bp.name, bp.sku, bp.stock, bp.variants_json, b.business_name,
              (SELECT count(*)::int FROM order_lines ol WHERE ol.product_id = bp.id) AS ordered
         FROM brand_products bp JOIN brands b ON b.id = bp.brand_id ORDER BY bp.sku FOR UPDATE OF bp`);
    const todo = pick(rows);
    console.log(`\n${todo.length} product(s) to repair:`);
    for (const t of todo) {
      console.log(`  ${t.row.sku.padEnd(10)} ${String(t.row.name).padEnd(22)} ${t.row.business_name} — ${t.entry.size}: ${t.entry.stock} → ${t.own}${t.row.ordered ? `   ← ${t.row.ordered} order line(s): REFUSED` : ''}`);
    }
    if (todo.some((t) => t.row.ordered)) { console.error('\nSTOP — an order has touched one of these. Nothing written.'); await c.query('ROLLBACK'); await c.end(); process.exit(1); }
    if (!todo.length) { console.log('\nNothing to repair.'); await c.query('ROLLBACK'); await c.end(); return; }
    if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.query('ROLLBACK'); await c.end(); return; }

    const ids = todo.map((t) => t.row.id);
    const before = await fixed();
    const othersBefore = await others(ids);
    for (const t of todo) {
      t.entry.stock = t.own;                                          // the one size now holds the product's own number
      await c.query(`UPDATE brand_products SET variants_json = $2::jsonb WHERE id = $1`, [t.row.id, JSON.stringify(t.vj)]);
    }
    // Read back and check before anything is kept.
    let bad = 0;
    const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
    console.log('');
    const { rows: back } = await c.query(`SELECT id, sku, stock, variants_json FROM brand_products WHERE id = ANY($1::uuid[]) ORDER BY sku`, [ids]);
    for (const r of back) {
      ok(`${r.sku}: its size holds ${r.stock}, the sizes add up to its own number, and it can be bought`,
        stock.sizesTotal(r.variants_json) === Number(r.stock) && stock.available(r) === true);
    }
    const after = await fixed();
    ok('no product name, price, own stock number or state changed, and no order line', JSON.stringify(after) === JSON.stringify(before));
    ok('no other product was written', (await others(ids)) === othersBefore);
    ok('nothing is left to repair', pick((await c.query(`SELECT id, stock, variants_json FROM brand_products`)).rows).length === 0);
    if (bad) { console.error('\nA check failed — rolled back. Nothing written.'); await c.query('ROLLBACK'); await c.end(); process.exit(1); }
    await c.query('COMMIT');
    console.log(`\nAPPLIED — ${todo.length} product(s) repaired.`);
    await c.end();
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    await c.end().catch(() => {});
    throw e;
  }
})().catch((e) => { console.error(e); process.exit(1); });
