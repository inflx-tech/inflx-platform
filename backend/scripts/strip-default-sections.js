'use strict';
/**
 * Strip all GLOBAL default section_config rows (founder 2026-06-22: "delete all
 * defaults, no fallback, keep only new"). Backs up ALL rows to _backups first,
 * then deletes scope_type='global'. Per-world (vertical) + city overrides KEPT.
 * Reversible from the backup JSON.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });
(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) { console.error('ABORT: not a supabase URL'); process.exit(1); }
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const all = await c.query('SELECT * FROM section_config ORDER BY screen, position');
  const stamp = '2026-06-22T-strip-defaults';
  const bf = path.join(__dirname, '_backups', `section_config-${stamp}.json`);
  fs.writeFileSync(bf, JSON.stringify(all.rows, null, 2));
  console.log(`backed up ${all.rows.length} rows → ${bf}`);
  const before = all.rows.length;
  const del = await c.query(`DELETE FROM section_config WHERE scope_type='global' RETURNING id`);
  console.log(`deleted ${del.rows.length} global rows`);
  const rem = await c.query(`SELECT scope_type, scope_value, screen, COUNT(*) n FROM section_config GROUP BY scope_type, scope_value, screen ORDER BY screen`);
  console.log('remaining:'); console.table(rem.rows.map(r=>({scope:r.scope_type,val:r.scope_value,screen:r.screen,n:+r.n})));
  console.log(`section_config: ${before} → ${before - del.rows.length}`);
  await c.end();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
