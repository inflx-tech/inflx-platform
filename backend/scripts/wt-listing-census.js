'use strict';
// Read-only prod census for the follower-app listing analysis (walkthrough W6).
//   ENV_FILE=.env.prod-backup node scripts/wt-listing-census.js
const { Client } = require('pg');
const path = require('path');
const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const out = {};
  // businesses per category (approved vs total) + product counts
  out.brands_by_category = (await c.query(
    `SELECT b.category, count(*)::int AS total,
            count(*) FILTER (WHERE u.status='approved')::int AS approved,
            COALESCE(SUM((SELECT count(*) FROM brand_products bp WHERE bp.brand_id=b.id AND bp.is_active)),0)::int AS products
     FROM brands b JOIN users u ON u.id=b.user_id
     GROUP BY b.category ORDER BY total DESC`)).rows;
  // taxonomy trees per vertical
  out.taxonomy_verticals = (await c.query(
    `SELECT vertical, count(*)::int AS nodes,
            count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM category_nodes ch WHERE ch.parent_id=category_nodes.id))::int AS leaves
     FROM category_nodes GROUP BY vertical ORDER BY nodes DESC`)).rows.length
    ? (await c.query(
      `SELECT vertical, count(*)::int AS nodes FROM category_nodes GROUP BY vertical ORDER BY nodes DESC`)).rows
    : [];
  // master dish dictionary
  try {
    out.master_dishes = (await c.query(`SELECT count(*)::int AS n FROM master_dishes`)).rows[0];
  } catch (e) { out.master_dishes = { error: e.message }; }
  // products linked to taxonomy nodes vs free-form
  out.products_taxonomy_link = (await c.query(
    `SELECT count(*)::int AS total,
            count(category_node_id)::int AS with_node,
            count(*) FILTER (WHERE category_node_id IS NULL)::int AS without_node
     FROM brand_products WHERE is_active`)).rows[0];
  // brand_offers availing modes usage
  out.offers_by_availing = (await c.query(
    `SELECT unnest(availing_modes) AS mode, count(*)::int FROM brand_offers GROUP BY 1 ORDER BY 2 DESC`)).rows;
  await c.end();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error(e.message); process.exit(1); });
