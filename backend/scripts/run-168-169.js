'use strict';

/**
 * Apply migrations 168 + 169 (Item 2 — pitch & invitation settings).
 * Contract: features/item2-pitch-invitation-settings
 *
 * 168: reference lists (niches, languages, 8 sub-categories, states → cities) + two
 *      nullable profile columns. Seeds only; touches no existing row.
 * 169: brand_pitch_settings, creator_invitation_settings, creator_min_commissions,
 *      collab_blocks, influencer_proposals.shoot_mode. Empty tables; missing row = defaults.
 *
 * Both files are plain BEGIN/COMMIT transactions with no enum changes, so this script
 * runs each file inside ONE outer transaction and can genuinely roll a dry run back.
 *
 *   node scripts/run-168-169.js --dry     inspect against production, roll back
 *   node scripts/run-168-169.js --apply   commit against production
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// TARGET IS EXPLICIT, NEVER IMPLIED BY --dry (same rule as run-165-166.js / run-167.js).
const DRY   = process.argv.includes('--dry');
const APPLY = process.argv.includes('--apply');
if (DRY === APPLY) {
  console.error('Pass exactly one of --dry (inspect, roll back) or --apply (commit).');
  process.exit(2);
}

require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });
const url = process.env.DATABASE_URL || '';
const HOST = (url.match(/@([^:/?]+)/) || [])[1] || '(unknown)';
if (!url) { console.error('No DATABASE_URL in backend/.env.prod-backup.'); process.exit(2); }
if (APPLY && /^(localhost|127\.0\.0\.1)$/.test(HOST)) {
  console.error(`Refusing --apply against ${HOST}. This script applies to production only.`);
  process.exit(2);
}

const FILES = ['168_item2_reference_lists.sql', '169_item2_pitch_invitation_settings.sql'];

const one = async (c, sql) => (await c.query(sql)).rows[0].n;
const stripTx = (sql) => sql.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '');

const snapshot = async (c) => ({
  brands:      await one(c, 'SELECT count(*)::int AS n FROM brands'),
  influencers: await one(c, 'SELECT count(*)::int AS n FROM influencers'),
  proposals:   await one(c, 'SELECT count(*)::int AS n FROM influencer_proposals'),
});

const row = (label, got, want) => {
  const ok = String(got) === String(want);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(40)} ${String(got).padStart(4)}   (must be ${want})`);
  return ok;
};

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(DRY ? `=== DRY RUN against ${HOST} — will be rolled back\n` : `=== APPLYING FOR REAL against ${HOST}\n`);

  const before = await snapshot(c);
  console.log('BEFORE');
  console.log(`  brands ${before.brands} · influencers ${before.influencers} · pitches ${before.proposals}\n`);

  await c.query('BEGIN');
  try {
    for (const f of FILES) {
      const sql = stripTx(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
      await c.query(sql);
      console.log(`applied  ${f}`);
    }

    const after = await snapshot(c);
    console.log('\nAFTER');
    let ok = true;
    ok &= row('brands rows unchanged',            after.brands,      before.brands);
    ok &= row('influencers rows unchanged',       after.influencers, before.influencers);
    ok &= row('pitches rows unchanged',           after.proposals,   before.proposals);
    ok &= row('ref_brand_categories rows',        await one(c, 'SELECT count(*)::int AS n FROM ref_brand_categories'), 8);
    ok &= row('ref_creator_niches rows',          await one(c, 'SELECT count(*)::int AS n FROM ref_creator_niches'), 20);
    ok &= row('ref_languages rows',               await one(c, 'SELECT count(*)::int AS n FROM ref_languages'), 10);
    ok &= row('ref_states rows',                  await one(c, 'SELECT count(*)::int AS n FROM ref_states'), 17);
    ok &= row('ref_cities rows',                  await one(c, 'SELECT count(*)::int AS n FROM ref_cities'), 63);
    ok &= row('brand_pitch_settings rows',        await one(c, 'SELECT count(*)::int AS n FROM brand_pitch_settings'), 0);
    ok &= row('creator_invitation_settings rows', await one(c, 'SELECT count(*)::int AS n FROM creator_invitation_settings'), 0);
    ok &= row('collab_blocks rows',               await one(c, 'SELECT count(*)::int AS n FROM collab_blocks'), 0);
    ok &= row('brands with sub_categories set',   await one(c, 'SELECT count(*)::int AS n FROM brands WHERE sub_categories IS NOT NULL'), 0);
    ok &= row('pitches with shoot_mode set',      await one(c, 'SELECT count(*)::int AS n FROM influencer_proposals WHERE shoot_mode IS NOT NULL'), 0);

    if (!ok) {
      await c.query('ROLLBACK');
      console.error('\nROLLED BACK — a check failed. Nothing was committed.');
      process.exit(1);
    }
    if (DRY) {
      await c.query('ROLLBACK');
      console.log('\nROLLED BACK — dry run complete, nothing was changed.');
    } else {
      await c.query('COMMIT');
      console.log('\nCOMMITTED.');
    }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('\nERROR —', e.message);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
