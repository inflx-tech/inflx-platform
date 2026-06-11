'use strict';
// Read-only: master catalogue depth for the 5 phase-1 verticals (W7 analysis).
//   ENV_FILE=.env.prod-backup node scripts/wt-master-catalogue-check.js
const { Client } = require('pg');
const path = require('path');
const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const out = {};
  const safe = async (label, sql) => {
    try { out[label] = (await c.query(sql)).rows; } catch (e) { out[label] = { error: e.message.slice(0, 80) }; }
  };
  await safe('master_vehicles', `SELECT vehicle_type, count(*)::int FROM master_vehicles GROUP BY vehicle_type ORDER BY 2 DESC`);
  await safe('master_salon_services', `SELECT category, count(*)::int FROM master_salon_services GROUP BY category ORDER BY 2 DESC`);
  await safe('master_dishes_sections', `SELECT section, count(*)::int FROM master_dishes GROUP BY section ORDER BY 2 DESC LIMIT 15`);
  await safe('section_config_screens', `SELECT screen, count(*)::int AS shelves, count(*) FILTER (WHERE enabled)::int AS enabled FROM section_config GROUP BY screen`);
  await c.end();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error(e.message); process.exit(1); });
