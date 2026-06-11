'use strict';
// Read-only walkthrough diagnostic for one campaign (founder report W5).
//   ENV_FILE=.env.prod-backup node scripts/wt-campaign-check.js <campaign_id>
const { Client } = require('pg');
const path = require('path');
const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

(async () => {
  const cid = process.argv[2];
  if (!cid) { console.error('campaign id required'); process.exit(1); }
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const camp = await c.query(`SELECT id, name, status, total_budget, created_at FROM campaigns WHERE id=$1`, [cid]);
  const sets = await c.query(`SELECT id, name, goal, influencer_mode, set_budget FROM campaign_sets WHERE campaign_id=$1`, [cid]);
  const cis = await c.query(
    `SELECT ci.id, ci.status, ci.agreed_fee, ci.commission_pct, ci.brand_offer_id, ci.offer_type,
            i.instagram_handle, cs.name AS set_name
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN influencers i ON i.id = ci.influencer_id
     WHERE cs.campaign_id=$1`, [cid]);
  const dels = await c.query(
    `SELECT d.id, d.type, d.status, d.submitted_url, d.live_url, d.revision_count,
            d.submitted_at, d.live_confirmed_at, i.instagram_handle
     FROM deliverables d
     JOIN campaign_influencers ci ON ci.id = d.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN influencers i ON i.id = ci.influencer_id
     WHERE cs.campaign_id=$1 ORDER BY d.submitted_at NULLS LAST`, [cid]);
  // products attached to this campaign via CI offer configs + brand_offers
  const offerProducts = await c.query(
    `SELECT ci.id AS ci_id, ci.offer_config_json
     FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id=ci.set_id
     WHERE cs.campaign_id=$1`, [cid]);
  // brand product count for the campaign's brand
  const brandProducts = await c.query(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE is_active)::int AS live
     FROM brand_products WHERE brand_id = (SELECT brand_id FROM campaigns WHERE id=$1)`, [cid]);
  // deliverable metric columns present?
  const metricCols = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='deliverables' AND column_name IN ('likes','comments','views','reach','saves','er','metrics_json','metrics_updated_at','scraped_at')`);

  console.log(JSON.stringify({
    campaign: camp.rows[0] || null,
    sets: sets.rows,
    campaign_influencers: cis.rows,
    deliverables: dels.rows,
    ci_offer_products: offerProducts.rows.map(r => ({ ci: r.ci_id, products: (r.offer_config_json && (r.offer_config_json.products || r.offer_config_json.product_ids)) || null })),
    brand_products: brandProducts.rows[0],
    deliverable_metric_columns: metricCols.rows.map(r => r.column_name),
  }, null, 2));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
