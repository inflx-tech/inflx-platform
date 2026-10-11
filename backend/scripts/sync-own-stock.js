#!/usr/bin/env node
/**
 * Stock asked once — bring the products already on live into line with the rule the server now
 * holds: a product with sizes has ONE stock, its sizes; its own number (`brand_products.stock`,
 * what the Listings page shows) is their total when every size is counted, and empty when any
 * size is not counted.
 * Usage: node scripts/sync-own-stock.js --dry | --apply   [--env=.env]
 * Contract: features/stock-asked-once · 05-impact.md
 *
 * What it writes: ONLY `brand_products.stock`, and only for a product that has sizes and whose own
 * number is not already what the rule says. No size's stock is touched, so nothing a shopper can or
 * cannot buy changes: the shopper app has always gone by the sizes. A product with no sizes is not
 * read at all. Idempotent — a second --apply finds nothing.
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

const num = (v) => (v == null ? null : Number(v));
const show = (v) => (v == null ? '—' : String(v));
/** What the rule says a product's own number must be; `undefined` = the product has no sizes (not ours). */
function target(row) {
  const es = stock.sizeEntries(row.variants_json);
  if (!es.length) return undefined;
  return stock.sizesTotal(row.variants_json);            // null when any size is not counted
}
const sizesText = (row) => {
  const vj = row.variants_json || {};
  const colors = Array.isArray(vj.colors) ? vj.colors.filter((c) => Array.isArray(c && c.sizes) && c.sizes.length) : [];
  const one = (s) => (s && typeof s === 'object' ? `${s.size}:${s.stock == null || s.stock === '' ? 'empty' : s.stock}` : `${s}:empty`);
  if (colors.length) return colors.map((c) => `${c.color || c.name || '?'} [${c.sizes.map(one).join(' ')}]`).join(' ');
  return (Array.isArray(vj.sizes) ? vj.sizes : []).map(one).join(' ');
};
function pick(rows) {
  const out = [];
  for (const r of rows) {
    const t = target(r);
    if (t === undefined) continue;
    if (num(r.stock) === t) continue;
    out.push({ row: r, to: t });
  }
  return out;
}

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  // What must not move: every size's stock, every name, price and state; every order line.
  const fixed = async () => ({
    products:     (await one(`SELECT count(*)::int n FROM brand_products`)).n,
    sizes_print:  (await one(`SELECT md5(string_agg(id::text || '|' || COALESCE(variants_json::text,''), ',' ORDER BY id)) t FROM brand_products`)).t,
    rows_print:   (await one(`SELECT md5(string_agg(id::text || '|' || name || '|' || price::text || '|' || is_active::text || '|' || COALESCE(pushed_to_store::text,''), ',' ORDER BY id)) t FROM brand_products`)).t,
    order_lines:  (await one(`SELECT count(*)::int n FROM order_lines`)).n,
  });
  const untouched = async (ids) => (await one(
    `SELECT COALESCE(md5(string_agg(id::text || '|' || COALESCE(stock::text,''), ',' ORDER BY id)), '-') t FROM brand_products WHERE NOT (id = ANY($1::uuid[]))`, [ids])).t;

  try {
    await c.query('BEGIN');
    const { rows } = await c.query(
      `SELECT bp.id, bp.name, bp.sku, bp.stock, bp.variants_json, bp.is_active, bp.pushed_to_store, b.business_name
         FROM brand_products bp JOIN brands b ON b.id = bp.brand_id ORDER BY b.business_name, bp.sku FOR UPDATE OF bp`);
    const todo = pick(rows);
    // Can a shopper buy it? That is decided by the sizes and must read the same before and after.
    const buyable = new Map(rows.map((r) => [r.id, stock.available(r)]));
    // The shop feed asks the product's OWN number whether a post still has something to sell.
    const feedSays = (own) => own == null || own > 0;
    console.log(`\n${rows.length} products · ${rows.filter((r) => target(r) !== undefined).length} with sizes · ${todo.length} whose own number is not the total of its sizes:\n`);
    let flips = 0;
    for (const t of todo) {
      const flip = feedSays(num(t.row.stock)) !== feedSays(t.to);
      if (flip) flips += 1;
      console.log(`  ${String(t.row.sku || '').padEnd(10)} ${String(t.row.name).slice(0, 34).padEnd(34)} ${String(t.row.business_name).slice(0, 26).padEnd(26)} own ${show(num(t.row.stock)).padStart(3)} → ${show(t.to).padStart(3)}   ${sizesText(t.row)}${flip ? '   ← THE FEED WOULD CHANGE ITS ANSWER' : ''}`);
    }
    if (flips) console.log(`\n${flips} product(s) where the shop feed's "has something to sell" answer changes — each is one whose every size is 0 while its own number says otherwise.`);
    if (!todo.length) { console.log('Nothing to bring into line.'); await c.query('ROLLBACK'); await c.end(); return; }
    if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.query('ROLLBACK'); await c.end(); return; }

    const ids = todo.map((t) => t.row.id);
    const before = await fixed();
    const restBefore = await untouched(ids);
    for (const t of todo) await c.query(`UPDATE brand_products SET stock = $2 WHERE id = $1`, [t.row.id, t.to]);

    let bad = 0;
    const ok = (label, good) => { if (!good) bad += 1; console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${label}`); };
    console.log('');
    const { rows: back } = await c.query(`SELECT id, stock, variants_json FROM brand_products`);
    ok('every product with sizes: its own number is the total of its sizes (empty when a size is not counted)', pick(back).length === 0);
    ok('whether a shopper can buy each product reads the same as before', back.every((r) => stock.available(r) === buyable.get(r.id)));
    ok('no size\'s stock, no name, price or state changed, and no order line', JSON.stringify(await fixed()) === JSON.stringify(before));
    ok('no other product\'s own number was written', (await untouched(ids)) === restBefore);
    if (bad) { console.error('\nA check failed — rolled back. Nothing written.'); await c.query('ROLLBACK'); await c.end(); process.exit(1); }
    await c.query('COMMIT');
    console.log(`\nAPPLIED — ${todo.length} product(s) brought into line.`);
    await c.end();
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    await c.end().catch(() => {});
    throw e;
  }
})().catch((e) => { console.error(e); process.exit(1); });
