'use strict';
// Read-only prod check: queued T3 entries + how many are due now.
//   ENV_FILE=.env.prod-backup node scripts/check-t3-queued.js
const { Client } = require('pg');
const path = require('path');
const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(
    `SELECT count(*)::int AS queued_total,
            count(*) FILTER (WHERE triggered_at <= now() - interval '30 days')::int AS due_now,
            COALESCE(SUM(net_to_influencer), 0) AS net_total
     FROM escrow_entries
     WHERE tranche_number = 3 AND status = 'queued'`);
  const rel = await c.query(
    `SELECT count(*)::int AS released_t3 FROM escrow_entries WHERE tranche_number = 3 AND status = 'released'`);
  console.log(JSON.stringify({ ...rows[0], ...rel.rows[0] }));
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
