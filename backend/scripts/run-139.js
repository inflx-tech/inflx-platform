'use strict';

/** Apply migration 139 (concept engine — Post/Concept P1) to PRODUCTION.
 * Loads ../.env.prod-backup. New tables only (concept_templates, concepts,
 * collections) + seeds; idempotent (IF NOT EXISTS + ON CONFLICT DO NOTHING).
 * Contract: features/concept-p1-engine/. */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) { console.error('ABORT: not prod (.env.prod-backup).'); process.exit(1); }
  console.log(`Target: ${cs.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '139_concept_engine.sql'), 'utf8'));
  const { rows } = await c.query(`
    SELECT (SELECT count(*)::int FROM concept_templates) AS templates,
           (SELECT count(*)::int FROM concept_templates WHERE kind='category') AS category_kind,
           (SELECT count(*)::int FROM concept_templates WHERE kind='price') AS price_kind,
           (SELECT count(*)::int FROM concept_templates WHERE kind='offer') AS offer_kind,
           (SELECT count(*)::int FROM collections) AS collections,
           (SELECT count(*)::int FROM concepts) AS concepts`);
  console.log('OK —', rows[0], '(expected 47 templates = 27/9/11, 14 collections, 0 concepts)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
