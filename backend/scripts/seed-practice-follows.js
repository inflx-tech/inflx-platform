'use strict';

/**
 * seed-practice-follows.js — give the INFLX following count something real behind it.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * The founder's instruction, 2026-08-22: "make an arrangement for this to show inflx with
 * some dummy data, tomorrow in real accounts someone followed then that particular count
 * we show them."
 *
 * So the NUMBER is not faked — it is counted live from follower_follows, exactly as it
 * will be for real people. What this script seeds is the FOLLOWS: practice follower
 * accounts that actually follow practice creators. When a real person follows someone
 * tomorrow, their follow lands in the same table and the same count picks it up, with no
 * switch to flip and nothing to remove.
 *
 * On the size of the numbers: modest, and deliberately so. Inventing "1,840 followers"
 * would need 1,840 fake accounts in the users table of a live platform, and would put a
 * figure on screen that flatters a platform which genuinely has none yet. Numbers in the
 * teens and low hundreds are what a young platform looks like, and every one is a real row.
 *
 *   node scripts/seed-practice-follows.js --env=prod
 *   node scripts/seed-practice-follows.js --env=prod --remove
 */

const { Client } = require('pg');
const path = require('path');

const args = Object.fromEntries(
  process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; })
);
const ENV = args.env || 'test';
require('dotenv').config({ path: path.join(__dirname, ENV === 'prod' ? '../.env.prod-backup' : '../.env') });
const CONN = ENV === 'prod' ? process.env.DATABASE_URL : process.env.TEST_DATABASE_URL;

// Reserved block, same shape the practice world already uses, so these are obvious as
// practice accounts and removable in one query.
const PREFIX = '+917900001';
const HOW_MANY = 90;

const log = (m) => console.log(`[follows] ${m}`);

(async () => {
  const c = new Client({
    connectionString: CONN,
    ...(ENV === 'prod' ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await c.connect();
  log(`connected — env=${ENV}`);

  if (args.remove) {
    const { rowCount } = await c.query(`DELETE FROM users WHERE phone LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM test_phone_numbers WHERE phone LIKE $1`, [`${PREFIX}%`]);
    log(`removed ${rowCount} practice follower account(s) — their follows went with them`);
    await c.end();
    return;
  }

  // The creators to be followed, most-followed first so the spread looks like a real
  // platform: a few people well ahead, a long tail behind them.
  const { rows: creators } = await c.query(
    `SELECT i.id, u.name FROM influencers i JOIN users u ON u.id = i.user_id
      WHERE u.phone LIKE '+9179000001%' ORDER BY i.followers_count DESC NULLS LAST`
  );
  if (creators.length === 0) { log('no practice creators found — nothing to do'); await c.end(); return; }

  await c.query('BEGIN');
  try {
    const followerIds = [];
    for (let i = 0; i < HOW_MANY; i++) {
      const phone = `${PREFIX}${String(i).padStart(3, '0')}`;
      const { rows: [u] } = await c.query(
        `INSERT INTO users (phone, role, name, status)
         VALUES ($1, 'follower', $2, 'approved')
         ON CONFLICT (phone, role) DO UPDATE SET status = 'approved'
         RETURNING id`,
        [phone, `Practice follower ${i + 1}`]
      );
      const { rows: [f] } = await c.query(
        `INSERT INTO followers (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id`,
        [u.id]
      );
      followerIds.push(f.id);
      await c.query(
        `INSERT INTO test_phone_numbers (phone, note) VALUES ($1, 'practice follower')
         ON CONFLICT (phone) DO NOTHING`,
        [phone]
      );
    }

    // A long tail: the first creator gets most of them, the last gets a handful.
    let made = 0;
    for (const [idx, cr] of creators.entries()) {
      const share = Math.max(3, Math.round(HOW_MANY * Math.pow(0.82, idx)));
      for (let j = 0; j < Math.min(share, followerIds.length); j++) {
        const r = await c.query(
          `INSERT INTO follower_follows (follower_id, influencer_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [followerIds[j], cr.id]
        );
        made += r.rowCount;
      }
    }
    await c.query('COMMIT');
    log(`${HOW_MANY} practice followers · ${made} follows across ${creators.length} creators`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  const { rows: top } = await c.query(
    `SELECT u.name, count(ff.*)::int AS inflx_followers
       FROM influencers i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN follower_follows ff ON ff.influencer_id = i.id
      WHERE u.phone LIKE '+9179000001%'
      GROUP BY u.name ORDER BY 2 DESC LIMIT 6`
  );
  console.table(top);
  log('remove with --remove');
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
