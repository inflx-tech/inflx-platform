'use strict';

/**
 * Item 3b — spread the first full measurement of every approved creator over N days.
 * Contract: features/item3b-social-numbers · prompt §3.8 · founder Q5 (N = 3, env SOCIAL_BACKFILL_DAYS)
 *
 * Sets profile_due_at / posts_due_at on every current, confirmed, unmeasured account of an
 * approved creator, in approval order, evenly across N days from now. The hourly job
 * (social-measure) then picks them up under the budget guard. Nothing is measured here.
 *
 *   node scripts/run-social-backfill.js --dry [--env=.env]   show the plan
 *   node scripts/run-social-backfill.js --apply [--env=.env] write the due dates
 */

const { Client } = require('pg');
const path = require('path');

const DRY   = process.argv.includes('--dry');
const APPLY = process.argv.includes('--apply');
if (DRY === APPLY) { console.error('Pass exactly one of --dry or --apply.'); process.exit(2); }
const envFile = (process.argv.find(a => a.startsWith('--env=')) || '--env=.env.prod-backup').slice(6);
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const url = process.env.DATABASE_URL || '';
const HOST = (url.match(/@([^:/?]+)/) || [])[1] || '(unknown)';
const DAYS = parseInt(process.env.SOCIAL_BACKFILL_DAYS || '3', 10);

(async () => {
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(HOST) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(
    `SELECT a.id, a.platform, a.handle_norm, COALESCE(i.approved_at, i.created_at) AS approved_at
       FROM creator_social_accounts a JOIN influencers i ON i.id = a.influencer_id JOIN users u ON u.id = i.user_id
      WHERE a.replaced_at IS NULL AND a.ownership = 'confirmed' AND u.status = 'approved'
        AND a.state = 'measuring' AND a.last_profile_at IS NULL
      ORDER BY approved_at ASC, a.platform`);
  console.log(`${DRY ? 'DRY' : 'APPLY'} against ${HOST}: ${rows.length} account(s) to spread over ${DAYS} day(s)`);
  const stepMs = rows.length ? Math.floor((DAYS * 86400000) / rows.length) : 0;
  const plan = rows.map((r, i) => ({ ...r, due: new Date(Date.now() + i * stepMs) }));
  for (const p of plan) console.log(`  ${p.due.toISOString()}  ${p.platform.padEnd(9)} ${p.handle_norm}`);
  if (APPLY) {
    for (const p of plan) await c.query(`UPDATE creator_social_accounts SET profile_due_at = $2, posts_due_at = $2, retry_at = NULL, updated_at = now() WHERE id = $1`, [p.id, p.due]);
    console.log('WRITTEN.');
  } else console.log('Nothing written.');
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
