'use strict';

/**
 * Apply migrations 175–178 (Item 3b — social numbers).
 * Contract: features/item3b-social-numbers
 *
 * 175 instagram_handle nullable (+ at-least-one-handle checks, validated in the same run)
 * 176 creator_social_accounts + backfill from today's handles + NULL the five legacy columns (founder Q4)
 * 177 runs (with Apify cost), profile snapshots, posts
 * 178 metrics (history + current) and admin flags
 *
 * One outer transaction; a dry run genuinely rolls back.
 *   node scripts/run-175-178.js --dry
 *   node scripts/run-175-178.js --apply
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DRY   = process.argv.includes('--dry');
const APPLY = process.argv.includes('--apply');
if (DRY === APPLY) { console.error('Pass exactly one of --dry or --apply.'); process.exit(2); }

const envFile = process.argv.find(a => a.startsWith('--env=')) ? process.argv.find(a => a.startsWith('--env=')).slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const url = process.env.DATABASE_URL || '';
const HOST = (url.match(/@([^:/?]+)/) || [])[1] || '(unknown)';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

const FILES = ['175_item3b_handles_nullable.sql', '176_item3b_social_accounts.sql', '177_item3b_social_runs_snapshots_posts.sql', '178_item3b_social_metrics_flags.sql'];
const stripTx = (sql) => sql.replace(/^\s*BEGIN;\s*$/mg, '').replace(/^\s*COMMIT;\s*$/mg, '');
const one = async (c, sql, params) => (await c.query(sql, params)).rows[0].n;
const row = (label, got, want) => { const ok = String(got) === String(want); console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(50)} ${String(got).padStart(5)}   (must be ${want})`); return ok; };

(async () => {
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(HOST) ? false : { rejectUnauthorized: false } });
  await c.connect();
  console.log(DRY ? `=== DRY RUN against ${HOST} — will be rolled back\n` : `=== APPLYING FOR REAL against ${HOST}\n`);
  const before = {
    influencers: await one(c, 'SELECT count(*)::int AS n FROM influencers'),
    withIg: await one(c, `SELECT count(*)::int AS n FROM influencers WHERE instagram_handle IS NOT NULL AND trim(instagram_handle) <> ''`),
    withYt: await one(c, `SELECT count(*)::int AS n FROM influencers WHERE youtube_handle IS NOT NULL AND trim(youtube_handle) <> ''`),
    rejected: await one(c, `SELECT count(*)::int AS n FROM influencers i JOIN users u ON u.id = i.user_id WHERE u.status = 'rejected'`),
    approvedIg: await one(c, `SELECT count(*)::int AS n FROM influencers i JOIN users u ON u.id = i.user_id WHERE u.status IN ('approved','suspended') AND i.instagram_handle IS NOT NULL AND trim(i.instagram_handle) <> ''`),
    approvedYt: await one(c, `SELECT count(*)::int AS n FROM influencers i JOIN users u ON u.id = i.user_id WHERE u.status IN ('approved','suspended') AND i.youtube_handle IS NOT NULL AND trim(i.youtube_handle) <> ''`),
    pendingHandles: await one(c, `SELECT count(*)::int AS n FROM influencers i JOIN users u ON u.id = i.user_id WHERE u.status = 'pending' AND ((i.instagram_handle IS NOT NULL AND trim(i.instagram_handle) <> '') OR (i.youtube_handle IS NOT NULL AND trim(i.youtube_handle) <> ''))`),
    followersSet: await one(c, 'SELECT count(*)::int AS n FROM influencers WHERE followers_count IS NOT NULL'),
    noHandle: await one(c, `SELECT count(*)::int AS n FROM influencers WHERE (instagram_handle IS NULL OR trim(instagram_handle) = '') AND (youtube_handle IS NULL OR trim(youtube_handle) = '')`),
  };
  console.log('BEFORE'); console.log(`  creators ${before.influencers} · with Instagram ${before.withIg} · with YouTube ${before.withYt} · rejected ${before.rejected} · followers set ${before.followersSet} · with NO handle ${before.noHandle}`);
  if (before.noHandle > 0) { console.error('  A creator with no handle at all would violate the new check. Stop.'); process.exit(1); }

  await c.query('BEGIN');
  let ok = true;
  try {
    for (const f of FILES) { await c.query(stripTx(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'))); console.log(`applied  ${f}`); }
    const expectedAccounts = (before.withIg + before.withYt) - 0; // rejected creators excluded below
    const rejectedHandles = await one(c, `SELECT count(*)::int AS n FROM influencers i JOIN users u ON u.id = i.user_id WHERE u.status = 'rejected' AND ((i.instagram_handle IS NOT NULL AND trim(i.instagram_handle) <> '') OR (i.youtube_handle IS NOT NULL AND trim(i.youtube_handle) <> ''))`);
    console.log('\nAFTER');
    ok = row('creators unchanged', await one(c, 'SELECT count(*)::int AS n FROM influencers'), before.influencers) && ok;
    ok = row('social account rows', await one(c, 'SELECT count(*)::int AS n FROM creator_social_accounts'), expectedAccounts - rejectedHandles) && ok;
    ok = row('accounts measuring (approved/suspended creators)', await one(c, `SELECT count(*)::int AS n FROM creator_social_accounts WHERE state = 'measuring'`), before.approvedIg + before.approvedYt) && ok;
    ok = row('accounts waiting_approval (pending creators)', await one(c, `SELECT count(*)::int AS n FROM creator_social_accounts WHERE state = 'waiting_approval'`), await one(c, `SELECT count(*)::int AS n FROM influencers i JOIN users u ON u.id = i.user_id, LATERAL (SELECT 1 WHERE i.instagram_handle IS NOT NULL AND trim(i.instagram_handle) <> '' UNION ALL SELECT 1 WHERE i.youtube_handle IS NOT NULL AND trim(i.youtube_handle) <> '') h WHERE u.status = 'pending'`)) && ok;
    ok = row('one current row per creator per platform', await one(c, `SELECT count(*)::int AS n FROM (SELECT influencer_id, platform FROM creator_social_accounts WHERE replaced_at IS NULL GROUP BY 1,2 HAVING count(*) > 1) d`), 0) && ok;
    ok = row('followers_count NULL everywhere (Q4)', await one(c, 'SELECT count(*)::int AS n FROM influencers WHERE followers_count IS NOT NULL OR engagement_rate IS NOT NULL OR youtube_subscribers IS NOT NULL'), 0) && ok;
    ok = row('at-least-one-handle check valid', await one(c, `SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'influencers_at_least_one_handle' AND convalidated`), 1) && ok;
    ok = row('runs / snapshots / posts / metrics / flags empty', await one(c, `SELECT (SELECT count(*) FROM creator_social_runs) + (SELECT count(*) FROM creator_social_profile_snapshots) + (SELECT count(*) FROM creator_social_posts) + (SELECT count(*) FROM creator_social_metrics) + (SELECT count(*) FROM social_admin_flags) AS n`), 0) && ok;
    const { rows: sample } = await c.query(`SELECT platform, state, count(*)::int n FROM creator_social_accounts GROUP BY 1,2 ORDER BY 1,2`);
    console.log('\n  accounts by platform/state:', JSON.stringify(sample));
    if (!ok) { console.error('\nA check failed — rolling back.'); await c.query('ROLLBACK'); process.exit(1); }
    if (DRY) { await c.query('ROLLBACK'); console.log('\nROLLED BACK — dry run complete, nothing was changed.'); }
    else { await c.query('COMMIT'); console.log('\nCOMMITTED. Next: node scripts/run-social-backfill.js --dry|--apply (spreads the first runs over N days).'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — rolled back:', e.message);
    process.exit(1);
  } finally { await c.end(); }
})();
