'use strict';
// Read-only: any deliverables awaiting brand review, platform-wide.
//   ENV_FILE=.env.prod-backup node scripts/wt-submitted-check.js
const { Client } = require('pg');
const path = require('path');
const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const byStatus = await c.query(
    `SELECT d.status, count(*)::int n FROM deliverables d GROUP BY d.status ORDER BY n DESC`);
  const pending = await c.query(
    `SELECT cmp.name AS campaign, i.instagram_handle, d.type, d.status, d.submitted_at, d.submitted_url
     FROM deliverables d
     JOIN campaign_influencers ci ON ci.id = d.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns cmp ON cmp.id = cs.campaign_id
     JOIN influencers i ON i.id = ci.influencer_id
     WHERE d.status IN ('submitted', 'under_review')
     ORDER BY d.submitted_at DESC NULLS LAST LIMIT 10`);
  console.log(JSON.stringify({ by_status: byStatus.rows, awaiting_review: pending.rows }, null, 2));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
