'use strict';

/**
 * Apply migrations 029 (verification fields) + 030 (creator_invitations)
 * + 031 (v_searchable_creators view) to production Supabase.
 *
 * All three are wrapped in BEGIN/COMMIT and idempotent.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  for (const f of ['029_creator_verification.sql', '030_creator_invitations.sql', '031_searchable_creators_view.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
    process.stdout.write(`Running ${f} ... `);
    await c.query(sql);
    console.log('OK');
  }

  // Sanity checks
  const { rows: cols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='creator_profiles'
      AND column_name IN ('verification_status','youtube_handle','claim_user_id',
                          'claim_requested_at','verified_at','verified_by','rejection_reason')
    ORDER BY column_name
  `);
  console.log('\ncreator_profiles new columns:', cols.map(r => r.column_name).join(', '));

  const { rows: tables } = await c.query(`
    SELECT to_regclass('public.creator_invitations') AS t
  `);
  console.log('creator_invitations table:', tables[0].t);

  const { rows: view } = await c.query(`SELECT to_regclass('public.v_searchable_creators') AS v`);
  console.log('v_searchable_creators view:', view[0].v);

  // Live data check
  const { rows: counts } = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM creator_profiles) AS profiles,
      (SELECT COUNT(*) FROM v_searchable_creators) AS searchable_total,
      (SELECT COUNT(*) FROM v_searchable_creators WHERE source='scraped') AS scraped,
      (SELECT COUNT(*) FROM v_searchable_creators WHERE source='onboarded') AS onboarded,
      (SELECT COUNT(*) FROM v_searchable_creators WHERE is_inflx_verified) AS verified,
      (SELECT COUNT(*) FROM creator_invitations) AS invitations
  `);
  console.log('\nLive counts:');
  console.table(counts);

  await c.end();
  console.log('\n✓ Done\n');
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
