'use strict';
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencers'
    ORDER BY ordinal_position
  `);
  console.log('influencers columns:');
  for (const r of rows) {
    console.log(`  ${r.column_name.padEnd(30)} ${r.data_type.padEnd(30)} nullable=${r.is_nullable}`);
  }
  await c.end();
})();
