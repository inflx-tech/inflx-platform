'use strict';

/** Apply migration 149 (pre-campaign handshake) to PRODUCTION.
 * Loads ../.env.prod-backup. Additive DDL + a single seeded settings row;
 * idempotent. Contract: features/collab-part2-precampaign-handshake/ */

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

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '149_precampaign_handshake.sql'), 'utf8'));

  const { rows } = await c.query(`
    SELECT
      (SELECT count(*)::int FROM handshake_settings)                                        AS settings_rows,
      (SELECT creator_max_active FROM handshake_settings WHERE id = 1)                      AS creator_cap,
      (SELECT brand_max_active   FROM handshake_settings WHERE id = 1)                      AS brand_cap,
      (SELECT count(*)::int FROM brand_collab_requests)                                     AS requests,
      (SELECT count(*)::int FROM collab_agreements)                                         AS agreements,
      (SELECT count(*)::int FROM information_schema.columns
        WHERE table_name = 'influencers' AND column_name = 'accepts_brand_requests')        AS mute_col,
      (SELECT count(*)::int FROM information_schema.columns
        WHERE table_name = 'campaign_influencers' AND column_name = 'agreement_id')         AS ci_link_col`);

  console.log('OK —', rows[0]);
  console.log('(expected: settings_rows 1 · creator_cap 5 · brand_cap 12 · requests 0 · agreements 0 · mute_col 1 · ci_link_col 1)');
  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
