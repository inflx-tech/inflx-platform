'use strict';

/**
 * Apply migration 134 (section_config.template_id — Creator Experience Engine
 * Phase 5) to PRODUCTION. Loads ../.env.prod-backup. Additive column, all
 * existing rows keep template_id=NULL (unaffected). Run AFTER run-133.js.
 * Contract: features/experience-templates/.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !connectionString.includes('supabase')) {
    console.error('ABORT: .env.prod-backup DATABASE_URL is not a supabase (prod) URL.');
    process.exit(1);
  }
  console.log(`Target: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const f = '134_section_config_template_id.sql';
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
  const { rows } = await c.query(`SELECT count(*)::int AS with_tpl FROM section_config WHERE template_id IS NOT NULL`);
  console.log(`OK — section_config rows with template_id: ${rows[0].with_tpl} (expected 0 — existing rows unaffected)`);
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
