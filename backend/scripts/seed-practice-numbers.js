#!/usr/bin/env node
/**
 * Give the practice cast the numbers a measured creator has.
 * Usage: node scripts/seed-practice-numbers.js --dry | --apply   [--env=.env]
 *        node scripts/seed-practice-numbers.js --blank=+917900000126   (un-measure one, on purpose)
 * Contract: features/practice-creator-numbers
 *
 * WHY THIS EXISTS
 * The 22 practice creators have Instagram handles that do not exist on Instagram, so the real
 * Apify run came back `not_found` for every one of them: no snapshot, no metrics, and no YouTube
 * account at all. Every screen that shows a number shows a dash, every brand filter that reads a
 * number cannot judge them, and whole steps of the walk cannot be tested. One real account
 * (Akshaya Reddy) is genuinely measured, and this makes the practice cast look exactly like her.
 *
 * WHAT IT WRITES — the same four places a real Apify run writes, and nothing else:
 *   1. creator_social_accounts          the Instagram row flips not_found → ok; a YouTube row is added
 *   2. creator_social_profile_snapshots followers / following / posts / verified · subs / videos / views
 *   3. creator_social_metrics           the current window: avg likes, comments, reel views, engagement
 *   4. influencers                      the five mirrored columns item 3b keeps in step, plus the
 *                                       profile facts being spread for testing (city, niche,
 *                                       languages, tier, gender)
 *
 * It does NOT invent a scrape run: `run_id` stays NULL, because no run happened. The rows say
 * "measured", they do not claim to have been measured BY something.
 *
 * SAFETY
 *  - Only rows whose phone is in the practice range +91790000011x / 12x / 13x are touched. The
 *    real measured account is matched by nothing here and cannot be reached.
 *  - Idempotent: run it twice and the second run changes nothing. Every write is an upsert.
 *  - --dry prints every change it would make and writes nothing.
 */
const fs = require('fs');
const path = require('path');
const envArg = process.argv.find(a => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const blankArg = process.argv.find(a => a.startsWith('--blank='));
const blank = blankArg ? blankArg.slice(8) : null;
const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry && !blank) { console.error('Pass --dry, --apply or --blank=<phone>.'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

const CSV = path.join(__dirname, '..', 'seeds', 'practice_creator_numbers.csv');
const PRACTICE = /^\+9179000001[123][0-9]$/;

function readCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
}

const HOURS = 3600 * 1000;
const DAYS = 24 * HOURS;

/**
 * Put ONE practice creator back to having no numbers at all.
 *
 * Measuring everybody took away the only way to see a creator who has not been measured yet —
 * and that state has its own sentence on her side of the app ("Your numbers are still being
 * measured"), which is worth being able to look at. This produces it deliberately, on one
 * creator, and the ordinary --apply puts her back.
 */
async function blankOne(phone) {
  if (!PRACTICE.test(phone)) { console.error(`REFUSING: ${phone} is not a practice number.`); process.exit(2); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS name FROM influencers i JOIN users u ON u.id = i.user_id WHERE u.phone = $1`, [phone]);
  if (!rows[0]) { console.error(`No practice creator on ${phone}.`); process.exit(2); }
  const { id, name } = rows[0];
  await c.query(`BEGIN`);
  await c.query(
    `DELETE FROM creator_social_metrics WHERE account_id IN (SELECT id FROM creator_social_accounts WHERE influencer_id = $1)`, [id]);
  await c.query(
    `DELETE FROM creator_social_profile_snapshots WHERE account_id IN (SELECT id FROM creator_social_accounts WHERE influencer_id = $1)`, [id]);
  await c.query(
    `UPDATE creator_social_accounts SET state = 'measuring', last_profile_at = NULL, last_posts_at = NULL WHERE influencer_id = $1 AND replaced_at IS NULL`, [id]);
  await c.query(
    `UPDATE influencers SET followers_count = NULL, engagement_rate = NULL, scrape_last_run = NULL,
            youtube_subscribers = NULL, youtube_views = NULL, youtube_videos = NULL, youtube_scrape_last_run = NULL,
            updated_at = now() WHERE id = $1`, [id]);
  await c.query(`COMMIT`);
  console.log(`\n${name} now has no numbers at all — she reads as still being measured.`);
  console.log(`Put her back with:  node scripts/seed-practice-numbers.js --apply\n`);
  await c.end();
  process.exit(0);
}

(async () => {
  if (blank) return blankOne(blank);
  const rows = readCsv(CSV);
  const bad = rows.filter(r => !PRACTICE.test(r.phone));
  if (bad.length) { console.error('REFUSING: the CSV names a phone outside the practice range:', bad.map(r => r.phone)); process.exit(2); }

  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const one = async (s, p) => (await q(s, p))[0];

  console.log(`\n=== practice creator numbers · ${apply ? 'APPLY' : 'DRY RUN'} · ${envFile} ===\n`);
  const before = await one(`SELECT
      (SELECT count(*)::int FROM influencers WHERE followers_count IS NOT NULL) measured_ig,
      (SELECT count(*)::int FROM influencers WHERE youtube_subscribers IS NOT NULL) measured_yt,
      (SELECT count(*)::int FROM creator_social_accounts WHERE replaced_at IS NULL) accounts,
      (SELECT count(*)::int FROM creator_social_profile_snapshots) snapshots,
      (SELECT count(*)::int FROM creator_social_metrics WHERE is_current) metrics`, []);
  console.log('before:', before);

  if (apply) await c.query('BEGIN');
  let touched = 0;
  const measuredAt = new Date(Date.now() - 6 * HOURS);

  /**
   * ⚠ PARKED, NOT DUE. This is the line that keeps the whole seed alive.
   *
   * social-measure runs every hour at :25 and picks up any account whose profile_due_at or
   * posts_due_at has passed. A practice handle does not exist on Instagram, so a re-measure
   * comes back not_found and BLANKS everything seeded here — quietly, a week later, most
   * likely in the middle of a walk.
   *
   * So these accounts are never due. Parking the date is what says "do not re-measure this",
   * and it is the honest thing to say: there is nothing real out there to measure.
   *
   * The one thing this cannot stop is a person pressing "Check again" on a practice creator.
   * That asks for a fresh measurement of a handle that does not exist, and the answer will be
   * not_found. Re-run this seed to put the numbers back.
   */
  const PARKED = new Date('2099-01-01T00:00:00Z');

  for (const r of rows) {
    const inf = await one(
      `SELECT i.id FROM influencers i JOIN users u ON u.id = i.user_id WHERE u.phone = $1`, [r.phone]);
    if (!inf) { console.log('  skip (no such practice creator):', r.phone, r.name); continue; }
    touched++;
    const line = `  ${r.name.replace(' (practice)', '').padEnd(12)} ${r.tier.padEnd(5)} ${r.city.padEnd(13)} ` +
      `IG ${String(r.ig_followers).padStart(8)} @ ${String(r.ig_engagement_pct).padStart(4)}%   YT ${String(r.yt_subscribers).padStart(7)}`;
    console.log(line);
    if (!apply) continue;

    const langs = r.languages.split('|');

    // 1. the profile facts being spread for testing, and the five mirrored numbers
    await c.query(
      `UPDATE influencers SET
         followers_count = $2, engagement_rate = $3, scrape_last_run = $4,
         youtube_handle = $5, youtube_channel_id = $6, youtube_title = $7,
         youtube_subscribers = $8, youtube_views = $9, youtube_videos = $10, youtube_scrape_last_run = $4,
         verified = $11, tier = $12, gender = $13,
         niche = ARRAY[$14]::text[], language = $15::text[],
         city = $16, city_id = $17, updated_at = now()
       WHERE id = $1`,
      [inf.id, Number(r.ig_followers), Number(r.ig_engagement_pct), measuredAt,
        r.yt_handle, 'UC' + String(r.phone).slice(-10) + 'PRACTICE', r.name.replace(' (practice)', ''),
        Number(r.yt_subscribers), Number(r.yt_channel_views), Number(r.yt_videos),
        r.ig_verified === 'true', r.tier, r.gender,
        r.niche, langs, r.city, Number(r.city_id)]);

    // 2. the two accounts — Instagram exists and is stuck on not_found; YouTube has never existed
    const igAcct = await one(
      `UPDATE creator_social_accounts
          SET state = 'ok', failure_count = 0, last_error = NULL,
              last_profile_at = $2, last_posts_at = $2,
              profile_due_at = $3, posts_due_at = $4, updated_at = now()
        WHERE influencer_id = $1 AND platform = 'instagram' AND replaced_at IS NULL
        RETURNING id`,
      [inf.id, measuredAt, PARKED, PARKED]);

    const ytAcct = await one(
      `INSERT INTO creator_social_accounts
         (influencer_id, platform, handle_raw, handle_norm, platform_account_id, channel_url,
          state, ownership, last_profile_at, last_posts_at, profile_due_at, posts_due_at, failure_count)
       VALUES ($1, 'youtube', $2, $3, $4, $5, 'ok', 'confirmed', $6, $6, $7, $8, 0)
       ON CONFLICT (influencer_id, platform) WHERE replaced_at IS NULL
       DO UPDATE SET state = 'ok', failure_count = 0, last_error = NULL,
                     last_profile_at = EXCLUDED.last_profile_at, last_posts_at = EXCLUDED.last_posts_at,
                     profile_due_at = EXCLUDED.profile_due_at, posts_due_at = EXCLUDED.posts_due_at,
                     updated_at = now()
       RETURNING id`,
      [inf.id, 'https://www.youtube.com/@' + r.yt_handle, r.yt_handle,
        'UC' + String(r.phone).slice(-10) + 'PRACTICE', 'https://www.youtube.com/@' + r.yt_handle,
        measuredAt, PARKED, PARKED]);

    // 3. one snapshot each, replacing any earlier one so re-running does not pile them up
    await c.query(`DELETE FROM creator_social_profile_snapshots WHERE account_id = ANY($1::uuid[])`, [[igAcct.id, ytAcct.id]]);
    await c.query(
      `INSERT INTO creator_social_profile_snapshots (account_id, measured_at, followers, following, total_posts, verified, account_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'creator')`,
      [igAcct.id, measuredAt, Number(r.ig_followers), Number(r.ig_following), Number(r.ig_total_posts), r.ig_verified === 'true']);
    await c.query(
      `INSERT INTO creator_social_profile_snapshots (account_id, measured_at, verified, subscribers, total_videos, total_channel_views, channel_name, channel_id)
       VALUES ($1, $2, false, $3, $4, $5, $6, $7)`,
      [ytAcct.id, measuredAt, Number(r.yt_subscribers), Number(r.yt_videos), Number(r.yt_channel_views),
        r.name.replace(' (practice)', ''), 'UC' + String(r.phone).slice(-10) + 'PRACTICE']);

    // 4. the current metrics window — 90 days back to the measurement
    const windowStart = new Date(measuredAt.getTime() - 90 * DAYS);
    const lastPost = new Date(measuredAt.getTime() - 2 * DAYS);
    await c.query(`DELETE FROM creator_social_metrics WHERE account_id = ANY($1::uuid[])`, [[igAcct.id, ytAcct.id]]);
    await c.query(
      `INSERT INTO creator_social_metrics
         (account_id, computed_at, window_start, window_end, is_current, followers_used,
          ig_posts_90d, ig_posts_per_week, ig_reels, ig_photos, ig_carousels, ig_last_post_at,
          ig_avg_likes, ig_hidden_likes_count, ig_avg_comments, ig_avg_reel_views, ig_engagement,
          ig_engagement_basis, posts_seen, counts)
       VALUES ($1, $2, $3, $2, true, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, $14, 'views', $15, $16)`,
      [igAcct.id, measuredAt, windowStart, Number(r.ig_followers),
        Number(r.ig_posts_90d), Math.round((Number(r.ig_posts_90d) / 13) * 10) / 10,
        Number(r.ig_reels), Number(r.ig_photos), Number(r.ig_carousels), lastPost,
        Number(r.ig_avg_likes), Number(r.ig_avg_comments), Number(r.ig_avg_reel_views), Number(r.ig_engagement_pct),
        Number(r.ig_total_posts),
        JSON.stringify({ likes_used: Number(r.ig_posts_90d), comments_used: Number(r.ig_posts_90d),
          reel_views_used: Number(r.ig_reels), engagement_reels_used: Number(r.ig_reels) })]);

    const longLikes = Math.round(Number(r.yt_long_avg_views) * Number(r.yt_long_engagement_pct) / 100 * 0.97);
    const longComments = Math.round(Number(r.yt_long_avg_views) * Number(r.yt_long_engagement_pct) / 100 * 0.03);
    const shortLikes = Math.round(Number(r.yt_short_avg_views) * Number(r.yt_short_engagement_pct) / 100 * 0.98);
    const shortComments = Math.round(Number(r.yt_short_avg_views) * Number(r.yt_short_engagement_pct) / 100 * 0.02);
    await c.query(
      `INSERT INTO creator_social_metrics
         (account_id, computed_at, window_start, window_end, is_current,
          yt_uploads_90d, yt_uploads_per_week, yt_last_upload_at,
          yt_long_count, yt_long_avg_views, yt_long_avg_likes, yt_long_avg_comments, yt_long_engagement,
          yt_short_count, yt_short_avg_views, yt_short_avg_likes, yt_short_avg_comments, yt_short_engagement, counts)
       VALUES ($1, $2, $3, $2, true, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [ytAcct.id, measuredAt, windowStart,
        Number(r.yt_videos), Math.round((Number(r.yt_videos) / 13) * 10) / 10, lastPost,
        Number(r.yt_long_count), Number(r.yt_long_avg_views), longLikes, longComments, Number(r.yt_long_engagement_pct),
        Number(r.yt_short_count), Number(r.yt_short_avg_views), shortLikes, shortComments, Number(r.yt_short_engagement_pct),
        JSON.stringify({ long: { views_used: Number(r.yt_long_count), likes_used: Number(r.yt_long_count) },
          short: { views_used: Number(r.yt_short_count), likes_used: Number(r.yt_short_count) } })]);
  }

  if (apply) await c.query('COMMIT');

  const after = await one(`SELECT
      (SELECT count(*)::int FROM influencers WHERE followers_count IS NOT NULL) measured_ig,
      (SELECT count(*)::int FROM influencers WHERE youtube_subscribers IS NOT NULL) measured_yt,
      (SELECT count(*)::int FROM creator_social_accounts WHERE replaced_at IS NULL) accounts,
      (SELECT count(*)::int FROM creator_social_profile_snapshots) snapshots,
      (SELECT count(*)::int FROM creator_social_metrics WHERE is_current) metrics`, []);
  console.log('\nafter:', after);
  console.log('creators in the CSV that exist:', touched, 'of', rows.length);
  console.log('their accounts are PARKED (never due), so the hourly measure job cannot blank them.');

  if (apply) {
    // The real account must be exactly as it was.
    const real = await one(
      `SELECT i.followers_count, i.engagement_rate, i.youtube_subscribers
         FROM influencers i JOIN users u ON u.id = i.user_id
        WHERE lower(COALESCE(i.full_name, u.name)) LIKE '%akshaya%'`, []);
    console.log('the real measured account, untouched:', real);
    const ok = after.measured_ig === before.measured_ig + touched
      && Number(real.followers_count) === 193221 && Number(real.engagement_rate) === 5.1;
    console.log(ok ? '\nAll checks OK.' : '\nCHECKS FAILED — inspect above.');
    await c.end();
    process.exit(ok ? 0 : 1);
  }

  console.log('\nDry run complete. Nothing was written.');
  await c.end();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
