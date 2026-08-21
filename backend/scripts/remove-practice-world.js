'use strict';

/**
 * remove-practice-world.js — put it back exactly as it was.
 * Contract: features/stage-0-clear-the-decks
 *
 * Deletes precisely what the manifest lists, in dependency order, inside one
 * transaction. If any part fails, nothing is removed.
 *
 * There is a deliberate belt-and-braces here: the manifest is the record, but
 * scenery accounts also carry the reserved +9179000001xx phone prefix. Pass
 * --by-prefix to sweep those even if the manifest is lost. The two real login
 * accounts are NEVER matched by the prefix — they can only be removed via the
 * manifest, which is the safe way round.
 *
 * USAGE
 *   node scripts/remove-practice-world.js --env=test
 *   node scripts/remove-practice-world.js --env=prod
 *   node scripts/remove-practice-world.js --env=prod --by-prefix   (manifest lost)
 *   node scripts/remove-practice-world.js --env=prod --dry-run
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(__dirname, 'practice-world.manifest.json');
const SCENERY_PREFIX = '+9179000001';

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; })
);
const ENV = args.env || 'test';
const DRY = !!args['dry-run'];

require('dotenv').config({
  path: path.join(__dirname, ENV === 'prod' ? '../.env.prod-backup' : '../.env'),
});
const CONN = ENV === 'prod' ? process.env.DATABASE_URL : process.env.TEST_DATABASE_URL;
if (!CONN) { console.error(`No connection string for --env=${ENV}`); process.exit(1); }

const log = (...a) => console.log('[remove]', ...a);

async function main() {
  const c = new Client({
    connectionString: CONN,
    ...(ENV === 'prod' ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await c.connect();

  let userIds = [];
  if (args['by-prefix']) {
    const { rows } = await c.query(
      `SELECT id FROM users WHERE phone LIKE $1`, [SCENERY_PREFIX + '%']);
    userIds = rows.map(r => r.id);
    log(`prefix sweep: ${userIds.length} scenery accounts`);
    log('NOTE: the two real login accounts are not matched by prefix, by design.');
  } else {
    if (!fs.existsSync(MANIFEST)) {
      console.error('No manifest. Use --by-prefix to sweep scenery accounts.');
      await c.end(); process.exit(1);
    }
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    if (m.env !== ENV) {
      console.error(`Manifest was written for --env=${m.env}, not ${ENV}. Refusing.`);
      await c.end(); process.exit(1);
    }
    userIds = m.users || [];
    log(`manifest: ${userIds.length} accounts, written ${m.created_at}`);
  }

  if (!userIds.length) { log('nothing to remove'); await c.end(); return; }

  // Count first, so a dry run says something useful.
  const { rows: [before] } = await c.query(
    `SELECT
       (SELECT count(*)::int FROM follower_transactions t
          JOIN campaign_influencers ci ON ci.id = t.campaign_influencer_id
          JOIN influencers i ON i.id = ci.influencer_id WHERE i.user_id = ANY($1::uuid[])) tx,
       (SELECT count(*)::int FROM campaigns cm
          JOIN brands b ON b.id = cm.brand_id WHERE b.user_id = ANY($1::uuid[])) campaigns,
       (SELECT count(*)::int FROM creator_posts p
          JOIN influencers i ON i.id = p.influencer_id WHERE i.user_id = ANY($1::uuid[])) posts,
       (SELECT count(*)::int FROM users WHERE id = ANY($1::uuid[])) users`,
    [userIds]
  );
  log(`will remove — ${before.users} accounts · ${before.campaigns} campaigns · ${before.posts} posts · ${before.tx} sales`);

  if (DRY) { log('dry run: nothing removed'); await c.end(); return; }

  await c.query('BEGIN');
  try {
    // Dependency order. Transactions and posts first because they reference
    // assignments; assignments and agreements before the accounts that own them.
    await c.query(
      `DELETE FROM follower_transactions t
        USING campaign_influencers ci, influencers i
       WHERE t.campaign_influencer_id = ci.id AND ci.influencer_id = i.id
         AND i.user_id = ANY($1::uuid[])`, [userIds]);
    await c.query(
      `DELETE FROM follower_transactions t USING brands b
        WHERE t.brand_id = b.id AND b.user_id = ANY($1::uuid[])`, [userIds]);
    await c.query(
      `DELETE FROM creator_posts p USING influencers i
        WHERE p.influencer_id = i.id AND i.user_id = ANY($1::uuid[])`, [userIds]);
    await c.query(
      `DELETE FROM campaigns cm USING brands b
        WHERE cm.brand_id = b.id AND b.user_id = ANY($1::uuid[])`, [userIds]);
    await c.query(
      `DELETE FROM collab_agreements a USING brands b
        WHERE a.brand_id = b.id AND b.user_id = ANY($1::uuid[])`, [userIds]);
    await c.query(
      `DELETE FROM brand_collab_requests r USING brands b
        WHERE r.brand_id = b.id AND b.user_id = ANY($1::uuid[])`, [userIds]);
    await c.query(
      `DELETE FROM influencer_groups g USING brands b
        WHERE g.brand_id = b.id AND b.user_id = ANY($1::uuid[])`, [userIds]);
    await c.query(
      `DELETE FROM brand_products p USING brands b
        WHERE p.brand_id = b.id AND b.user_id = ANY($1::uuid[])`, [userIds]);
    // users cascades to brands and influencers.
    // Deregister the practice numbers too, or the allowlist keeps handing a fixed
    // code to numbers that no longer have an account — and grows stale forever.
    if (Array.isArray(M.test_numbers) && M.test_numbers.length) {
      const r = await c.query(
        `DELETE FROM test_phone_numbers WHERE phone = ANY($1::text[])`, [M.test_numbers]);
      log(`deregistered ${r.rowCount} practice number(s)`);
    }

    await c.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);

    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('[remove] FAILED — nothing removed, rolled back.');
    console.error(e.message);
    await c.end(); process.exit(1);
  }

  const { rows: [after] } = await c.query(
    `SELECT count(*)::int n FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
  log(`removed. ${after.n} of the listed accounts remain (expected 0).`);

  if (!args['by-prefix'] && fs.existsSync(MANIFEST)) {
    fs.renameSync(MANIFEST, MANIFEST.replace('.json', `.removed-${Date.now()}.json`));
    log('manifest archived');
  }
  await c.end();
}

main();
