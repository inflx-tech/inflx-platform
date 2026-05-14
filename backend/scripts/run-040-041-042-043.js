'use strict';

/**
 * Apply migrations 040–043 (Marketing Engine — unification into Inflx
 * Platform) to the target database. Idempotent — safe to re-run.
 *
 *   040 — brand_profiles                  (new table)
 *   041 — marketing_supporting_tables     (caption_insights, collab_map,
 *                                          insights, system_settings)
 *   042 — outreach_activity               (new table)
 *   043 — marketing_columns_extra         (additive cols on creator_profiles)
 *
 * Usage:
 *   node scripts/run-040-041-042-043.js          → DATABASE_URL (prod / dev)
 *   node scripts/run-040-041-042-043.js --test   → TEST_DATABASE_URL
 *
 * Per the run-029-030-031.js precedent. Additive only — no existing table
 * is modified destructively. Every ALTER uses IF NOT EXISTS, every CREATE
 * uses IF NOT EXISTS. Defaults on new columns are NULL or safe values so
 * existing read paths continue to work.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const useTestDb = process.argv.includes('--test');
  const connectionString = useTestDb
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

  if (!connectionString) {
    console.error(`✗ ${useTestDb ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} is not set in .env`);
    process.exit(1);
  }

  console.log(`\nTarget: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  const requireSSL = connectionString.includes('supabase.com');
  const c = new Client({
    connectionString,
    ...(requireSSL && { ssl: { rejectUnauthorized: false } }),
  });
  await c.connect();

  const files = [
    '040_brand_profiles.sql',
    '041_marketing_supporting_tables.sql',
    '042_outreach_activity.sql',
    '043_marketing_columns_extra.sql',
  ];

  for (const f of files) {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
    process.stdout.write(`Running ${f} ... `);
    await c.query(sql);
    console.log('OK');
  }

  // ── Sanity checks ──────────────────────────────────────────────────────────

  console.log('\n── Sanity checks ──');

  const tables = ['brand_profiles', 'caption_insights', 'collab_map',
                  'insights', 'system_settings', 'outreach_activity'];
  for (const t of tables) {
    const { rows } = await c.query(`SELECT to_regclass($1) AS reg`, [`public.${t}`]);
    console.log(`  ${t.padEnd(28)} ${rows[0].reg ? '✓' : '✗ MISSING'}`);
  }

  // creator_profiles new columns
  console.log('\ncreator_profiles new columns:');
  const newCols = [
    'outreach_status', 'priority_score', 'scoring_summary',
    'inferred_city', 'inferred_niche', 'inferred_sub_niche',
    'bio_whatsapp', 'manual_phone', 'manual_email', 'manual_whatsapp',
    'primary_offering', 'tone', 'bio_business_type',
    'reachability_score', 'contact_intel_extracted_at',
    'is_paused', 'paused_at', 'reengagement_date',
    'source', 'notes',
  ];
  const { rows: cpCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='creator_profiles'
      AND column_name = ANY($1)
  `, [newCols]);
  const found = new Set(cpCols.map(r => r.column_name));
  for (const col of newCols) {
    console.log(`  ${col.padEnd(28)} ${found.has(col) ? '✓' : '✗ MISSING'}`);
  }

  // system_settings seeded
  const { rows: settings } = await c.query(`
    SELECT high_tier_threshold, low_tier_threshold,
           high_refresh_days, mid_refresh_days, low_refresh_days, brand_refresh_days,
           skip_recent_scrape_hours, posts_retention_days, discovery_enabled
    FROM system_settings WHERE id = 1
  `);
  console.log('\nsystem_settings seed row:');
  console.table(settings);

  // Row counts (should all be 0 except system_settings = 1)
  console.log('\nRow counts (new tables, fresh state):');
  for (const t of tables) {
    const { rows } = await c.query(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`  ${t.padEnd(28)} ${rows[0].n}`);
  }

  // Defense-in-depth: confirm nothing was dropped from existing tables.
  const { rows: cpCount } = await c.query(`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='creator_profiles'
  `);
  console.log(`\ncreator_profiles total column count: ${cpCount[0].n}`);

  await c.end();
  console.log('\n✓ Done\n');
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
