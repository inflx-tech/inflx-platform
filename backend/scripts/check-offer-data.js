'use strict';

/**
 * READ-ONLY prod-state probe for the offer-source work (D0 Workstream B / OR).
 * Answers the two questions the OR flag-flip depends on:
 *   1. Are offer-engine migrations 084-086 applied to prod (does brand_offers exist
 *      + the CI attach columns)?
 *   2. Is there real offer data, and via which channels will it surface?
 *
 * No writes. Run against prod:
 *   ENV_FILE=.env.prod-backup node scripts/check-offer-data.js
 */
const { Client } = require('pg');
const path = require('path');

const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[check-offer-data] connected via ${envFile} → ${(await c.query('SELECT current_database() d')).rows[0].d}\n`);

  const q = async (label, sql) => {
    try { const { rows } = await c.query(sql); console.log(`== ${label} ==`); console.dir(rows, { depth: null }); }
    catch (e) { console.log(`== ${label} == ERR: ${e.message}`); }
    console.log('');
  };

  await q('offer-engine migrations present (084-086)',
    `SELECT
       to_regclass('public.brand_offers') IS NOT NULL                                   AS has_brand_offers,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='campaign_influencers' AND column_name='brand_offer_id')          AS has_conversion_col,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='campaign_influencers' AND column_name='promoted_brand_offer_ids') AS has_engagement_col`);

  await q('brand_offers by status / store-publish (the STORE channel)',
    `SELECT status, published_to_store, count(*)::int AS n FROM brand_offers GROUP BY 1,2 ORDER BY 1,2`);

  await q('CI attach columns populated (CONVERSION + ENGAGEMENT channels)',
    `SELECT
       count(*) FILTER (WHERE brand_offer_id IS NOT NULL)                                          AS conversion_attached,
       count(*) FILTER (WHERE promoted_brand_offer_ids IS NOT NULL
                          AND array_length(promoted_brand_offer_ids,1) > 0)                        AS engagement_attached,
       count(*)::int AS total_campaign_influencers
     FROM campaign_influencers`);

  await q('legacy campaign_offers (today’s only shelf source)',
    `SELECT count(*)::int AS n FROM campaign_offers`);

  console.log('READ: if has_brand_offers=false → migrations 084-086 are NOT on prod (apply first).');
  console.log('READ: store n>0 surfaces via STORE channel; conversion/engagement need the CI columns populated.');
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
