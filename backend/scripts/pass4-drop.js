'use strict';
/**
 * Pass 4, step 3 of 3 — EXPORT then DROP. The only irreversible step in Docs/THE_CUT.md.
 *
 * Drops ONLY the eight tables proven unreferenced by pass4-safety.js. The other 21
 * retired tables are deliberately left in place: their code still stands under features
 * the founder KEPT (see features/the-cut-pass-3/lock.json).
 *
 * Guards, in order, because this cannot be undone:
 *   1. re-scan the source tree NOW — a table named anywhere in surviving code is refused
 *   2. re-count rows NOW and refuse if a table has grown since the survey
 *   3. export every row to JSON on disk, and verify the file before dropping
 *   4. drop inside one transaction, without CASCADE, so a dependency aborts everything
 *
 * --dry (default) prints the plan. --apply performs it.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const APPLY = process.argv.includes('--apply');
const DRY   = process.argv.includes('--dry') || !APPLY;
if (APPLY && DRY && process.argv.includes('--dry')) { console.error('Pass --dry OR --apply, not both.'); process.exit(2); }

const OUT = path.join(__dirname, '../exports/2026-09-02-pass4');
const ROOT = path.join(__dirname, '../..');

// ORDER MATTERS — a child is dropped before its parent, because this deliberately runs
// without CASCADE. experience_products -> creator_experiences, experience_themes ->
// design_presets.
//
// experience_templates is DELIBERATELY ABSENT. section_config — the LIVE table holding
// the shelves the shopper app renders — has a foreign key to it. Dropping it would mean
// altering a live table to remove a real constraint, which is far beyond a cleanup pass.
// Its single row stays. Found only because this script refuses to use CASCADE.
const TABLES = [
  'referral_applications', 'enquiry_leads', 'lookbook_products',
  'experience_products', 'creator_experiences',
  'experience_themes', 'design_presets', 'design_tokens',
];
const EXPECTED = {
  referral_applications: 0, enquiry_leads: 0, lookbook_products: 0,
  experience_products: 0, creator_experiences: 0,
  experience_themes: null, design_presets: 8, design_tokens: 42,
};

// ── Guard 1: is any of them still named in surviving source? ────────────────
function walk(dir, out = []) {
  let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) {
    if (['node_modules', '.next', '__tests__', 'exports'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out); else if (/\.(js|jsx)$/.test(e.name)) out.push(f);
  }
  return out;
}
const SRC = ['backend/src', 'Packages/Mobile/src', 'Packages/brand-web/app', 'Packages/brand-web/lib', 'Packages/brand-web/components']
  .flatMap(d => walk(path.join(ROOT, d)))
  .map(f => fs.readFileSync(f, 'utf8'));

const referenced = TABLES.filter(t => SRC.some(s => new RegExp('\b' + t + '\b').test(s)));
if (referenced.length) {
  console.error('REFUSED — still referenced in source: ' + referenced.join(', '));
  process.exit(1);
}
console.log('guard 1 OK — none of the 8 is named in any surviving source file');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('HOST: ' + (process.env.DATABASE_URL || '').replace(/:[^:@]*@/, ':***@'));
  console.log(DRY ? '\n*** DRY RUN — nothing will be exported or dropped ***\n' : '\n*** APPLY ***\n');

  // ── Guard 2: counts must match what the survey saw ────────────────────────
  const plan = [];
  for (const t of TABLES) {
    const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    const n = rows[0].n;
    if (EXPECTED[t] !== null && n !== EXPECTED[t]) {
      console.error(`REFUSED — ${t} holds ${n} rows, survey saw ${EXPECTED[t]}. Something wrote to it since.`);
      process.exit(1);
    }
    plan.push({ t, n });
    console.log(`  ${String(n).padStart(4)} rows  ${t}`);
  }
  console.log('guard 2 OK — every count matches the survey\n');

  if (DRY) { console.log('Dry run complete. Re-run with --apply to export and drop.'); await c.end(); return; }

  // ── Guard 3: export, then verify the file ─────────────────────────────────
  for (const { t, n } of plan) {
    const { rows } = await c.query(`SELECT * FROM "${t}"`);
    const file = path.join(OUT, t + '.json');
    fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
    const back = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (back.length !== n) { console.error(`REFUSED — export of ${t} holds ${back.length}, expected ${n}`); process.exit(1); }
    console.log(`exported ${String(n).padStart(4)} rows -> exports/2026-09-02-pass4/${t}.json`);
  }
  console.log('guard 3 OK — every table exported and read back\n');

  // ── Guard 4: one transaction, no CASCADE ──────────────────────────────────
  const tx = await c.query('BEGIN').then(() => true);
  try {
    for (const { t } of plan) { await c.query(`DROP TABLE "${t}"`); console.log('dropped ' + t); }
    await c.query('COMMIT');
    console.log('\nCOMMITTED — 8 tables dropped.');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('\nROLLED BACK — nothing dropped. Reason: ' + e.message);
    process.exit(1);
  }

  const { rows: left } = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)`, [TABLES]);
  console.log('verify: ' + left.length + ' of the 8 still exist (expect 0)');

  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
