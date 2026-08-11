'use strict';

/** Apply migration 147 (canonical offer vocabulary) to PRODUCTION.
 * Loads ../.env.prod-backup. Value conversion only — no DDL, no constraint,
 * nothing dropped; idempotent. Contract: features/collab-part1-corrections/ */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const CANONICAL = ['discount', 'volume', 'bogo', 'bundle', 'free_gift'];

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs || !cs.includes('supabase')) { console.error('ABORT: not prod (.env.prod-backup).'); process.exit(1); }
  console.log(`Target: ${cs.replace(/:[^:@]+@/, ':***@')}`);
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Baseline BEFORE, so the conversion is provable rather than asserted.
  const before = await c.query(
    `SELECT offer_type, count(*)::int AS n
       FROM campaign_influencers WHERE offer_type IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC`
  );
  console.log('BEFORE:', before.rows);

  await c.query(fs.readFileSync(path.join(__dirname, '../migrations', '147_offer_type_canonical.sql'), 'utf8'));

  const after = await c.query(
    `SELECT offer_type, count(*)::int AS n
       FROM campaign_influencers WHERE offer_type IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC`
  );
  console.log('AFTER: ', after.rows);

  // Anything left outside the canonical five is a legacy spelling the map did
  // not cover. Report it loudly — the read-side normaliser still resolves it, so
  // this is a follow-up item, not a failure.
  const stragglers = after.rows.filter(r => !CANONICAL.includes(r.offer_type));
  if (stragglers.length) {
    console.warn('NOTE — non-canonical values remain (read path still normalises these):', stragglers);
  } else {
    console.log('OK — every offer_type is canonical.');
  }

  await c.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
