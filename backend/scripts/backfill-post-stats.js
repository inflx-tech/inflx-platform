#!/usr/bin/env node
/**
 * post-performance-v2 — Q14: the links already in production when this shipped are read once.
 * Usage: node scripts/backfill-post-stats.js --dry | --apply   [--env=.env.prod-backup]
 * Contract: features/post-performance-v2 · lock.json decisions Q14 (founder, 25 Oct 2026)
 *
 * --dry   lists every posted collaboration's Instagram/YouTube links that have no proof_stats row
 *         (what would be tracked), reads nothing from Apify, writes nothing.
 * --apply tracks them (proof_stats rows, tracked_from = posted_at, seeded from Level 1 where it
 *         matches) and reads them ONCE through the real Apify runner (trigger 'backfill', behind the
 *         budget guard, one run per platform, ≤ 50 links each; ≈ US$0.0027 / US$0.004 per link).
 *         Needs APIFY_MOCK=false and APIFY_TOKEN in the env file. Idempotent: a link already tracked
 *         is left alone; a second --apply reads only what is due.
 */
const path = require('path');
const envArg = process.argv.find((a) => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
process.env.ENABLE_CRONS = 'false';
// A real read, always: the env file may carry APIFY_MOCK=true (it did on 25 Oct 2026, and the first
// --apply read fixture answers into production until repaired). --mock says so on purpose.
if (!process.argv.includes('--mock')) process.env.APIFY_MOCK = 'false';

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }
if (apply && process.env.APIFY_MOCK !== 'false') { console.error('Refusing --apply with APIFY_MOCK on: it would write fixture answers into production.'); process.exit(2); }
if (apply && !process.env.APIFY_TOKEN) { console.error('No APIFY_TOKEN in the env — nothing can be read.'); process.exit(2); }

(async () => {
  const db = require('../src/config/db');
  const env = require('../src/config/env');
  const postStats = require('../src/services/postStats.service');
  const contentGate = require('../src/services/contentGate.service');
  console.log('Target:', process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':***@'), '· APIFY_MOCK =', env.APIFY_MOCK);

  const { rows: contents } = await db.query(
    `SELECT cc.id, cc.campaign_influencer_id AS ci_id, cc.posted_at,
            (SELECT count(*)::int FROM content_proofs cp WHERE cp.content_id = cc.id AND cp.url IS NOT NULL) AS links,
            (SELECT count(*)::int FROM proof_stats ps WHERE ps.content_id = cc.id) AS tracked
       FROM collab_content cc WHERE cc.posted_at IS NOT NULL ORDER BY cc.posted_at`);
  console.log(`Posted collaborations: ${contents.length}; links: ${contents.reduce((n, c) => n + c.links, 0)}; already tracked rows: ${contents.reduce((n, c) => n + c.tracked, 0)}`);

  let tracked = 0;
  for (const c of contents) {
    // eslint-disable-next-line no-await-in-loop
    const g = await contentGate.assertContentOpen(c.ci_id, { side: 'admin' }, db, { allowShootNotDone: true, allowOldTerms: true, allowLocked: true }).catch((e) => ({ error: e.message }));
    if (g.error || !g.rows) { console.log(`  skip ${c.ci_id}: ${g.error || 'no rows'}`); continue; }
    const rows = g.rows.filter((r) => !r.isStory && ['instagram', 'youtube'].includes(r.platform));
    // eslint-disable-next-line no-await-in-loop
    const { rows: links } = await db.query(
      `SELECT cp.row_key, cp.slot, cp.url FROM content_proofs cp WHERE cp.content_id = $1 AND cp.url IS NOT NULL AND cp.row_key = ANY($2::text[])
          AND NOT EXISTS (SELECT 1 FROM proof_stats ps WHERE ps.content_id = cp.content_id AND ps.row_key = cp.row_key AND ps.slot = cp.slot AND ps.stopped_at IS NULL)`,
      [c.id, rows.map((r) => r.key)]);
    for (const l of links) console.log(`  ${dry ? 'would track' : 'tracking'} ${c.ci_id} ${l.row_key}#${l.slot} ${l.url} (posted ${new Date(c.posted_at).toISOString().slice(0, 10)})`);
    if (!dry && links.length) {
      // eslint-disable-next-line no-await-in-loop
      const out = await db.withTransaction((tx) => postStats.trackRows(tx, c.id, rows, { trackedFrom: c.posted_at }));
      tracked += out.length;
    }
  }
  if (dry) { console.log('Dry run: nothing written, nothing read.'); await db.pool.end?.(); process.exit(0); }

  console.log(`Tracked ${tracked} link(s). Reading once (trigger backfill)…`);
  const out = await postStats.runDue({ trigger: 'backfill' });
  console.log(JSON.stringify({ skipped: out.skipped || null, due: out.due, ran: out.ran, read: out.read, stopped: out.stopped, spend: out.spend,
    runs: (out.runs || []).map((r) => ({ platform: r.platform, result: r.result, usd: r.usd, read: r.read, apifyRunId: r.apifyRunId, error: r.error })) }, null, 2));
  const { rows: [sum] } = await db.query(`SELECT count(*)::int AS links, count(numbers_at)::int AS with_numbers, count(stopped_at)::int AS stopped FROM proof_stats`);
  console.log('proof_stats now:', sum);
  await (db.pool && db.pool.end ? db.pool.end() : Promise.resolve());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
