'use strict';

/**
 * Score backfill — finds all creator_profiles with priority_score=0 (or NULL)
 * that have real follower data and aren't private accounts, and fires the
 * A5 v2 scoring webhook for each. A5 v2 reads /profile-bundle and writes
 * the score back via /creator-metrics.
 *
 * Why this is needed: rows pushed by the old v1 sync (System A → INGEST API)
 * predate the v2 scoring pipeline. Their priority_score column is still 0
 * because A5 v2 was never invoked for them.
 *
 * Apify is NOT called by this script. Only the score node runs.
 *
 * Usage:
 *   node scripts/score-backfill.js           # actually fire
 *   node scripts/score-backfill.js --dry-run # list only, don't fire
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const N8N_BASE = 'https://inflx18.app.n8n.cloud';
const A5_WEBHOOK = N8N_BASE + '/webhook/a5-scoring';

const DRY = process.argv.includes('--dry-run');
const STAGGER_MS = 1500;  // 1.5s between webhook calls — keeps Claude rate-limit happy

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs) { console.error('DATABASE_URL not set'); process.exit(1); }

  const c = new Client({ connectionString: cs, ssl: cs.includes('supabase.com') ? { rejectUnauthorized: false } : false });
  await c.connect();

  // Find unscored rows that still have enough signal to score
  const { rows } = await c.query(`
    SELECT ig_handle, followers_count, follower_tier, last_scraped_at, total_posts_90d, priority_score
      FROM creator_profiles
     WHERE COALESCE(priority_score, 0) = 0
       AND COALESCE(followers_count, 0) > 0
       AND COALESCE(is_private, false) = false
       AND COALESCE(is_paused, false) = false
       AND outreach_status NOT IN ('dead')
     ORDER BY followers_count DESC NULLS LAST
  `);

  console.log(`\nFound ${rows.length} unscored creator(s) eligible for backfill:`);
  rows.forEach(r => console.log(`  @${r.ig_handle.padEnd(30)} | followers: ${String(r.followers_count).padStart(7)} | tier: ${(r.follower_tier || '—').padEnd(10)} | posts90d: ${r.total_posts_90d || 0}`));

  if (DRY) {
    console.log('\n--dry-run set; nothing fired.\n');
    await c.end();
    return;
  }

  console.log(`\nFiring A5 v2 with ${STAGGER_MS}ms stagger…`);
  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const resp = await fetch(A5_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: r.ig_handle }),
      });
      if (resp.ok) { ok++; process.stdout.write('.'); }
      else { fail++; process.stdout.write('x'); }
    } catch (e) { fail++; process.stdout.write('x'); }
    await new Promise(res => setTimeout(res, STAGGER_MS));
  }
  console.log(`\n\nFired: ${ok} ok, ${fail} failed. Scores will populate in ~30-90 seconds per handle.\n`);
  await c.end();
})().catch(e => { console.error('\n✗', e.message); process.exit(1); });
