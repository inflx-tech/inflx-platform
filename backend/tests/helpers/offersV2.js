'use strict';

/**
 * offer-builder-v2 — shared fixtures. Contract: features/offer-builder-v2
 * Real API and plain SQL against the test database; nothing mocked.
 */

const { api, query, brand, creator, collab, product, rnd } = require('./item3');
const { todayInIndia, addDays } = require('../../src/utils/indiaDay');

const T = () => todayInIndia();
const day = (n) => addDays(todayInIndia(), n);

/** A small category tree of our own: Men › Bottomwear › (Jeans, Trousers), Men › Topwear › Shirts. */
async function tree() {
  const v = `t_${rnd()}`;
  const ins = async (name, parent, depth, leaf) => (await query(
    `INSERT INTO category_nodes (vertical, parent_id, name, depth, is_leaf) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [v, parent, name, depth, leaf])).rows[0].id;
  const men = await ins('Men', null, 0, false);
  const bottom = await ins('Bottomwear', men, 1, false);
  const top = await ins('Topwear', men, 1, false);
  const jeans = await ins('Jeans', bottom, 2, true);
  const trousers = await ins('Trousers', bottom, 2, true);
  const shirts = await ins('Shirts', top, 2, true);
  const jackets = await ins('Jackets', top, 2, true);
  return { men, bottom, top, jeans, trousers, shirts, jackets };
}

/** A published product under a leaf, with an optional brand label. */
async function prod(brandId, leaf, name, price, label = null, over = {}) {
  const id = await product(brandId, { name, price, ...over });
  await query(`UPDATE brand_products SET category_node_id = $2, facets = $3::jsonb WHERE id = $1`,
    [id, leaf, JSON.stringify(label ? { brand: label } : {})]);
  return id;
}

async function draft(token, body) {
  const r = await api.post('/brands/me/offers', token, body);
  if (r.status !== 201) throw new Error(`draft: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data.offer;
}

async function patch(token, id, body) {
  const r = await api.patch(`/brands/me/offers/${id}`, token, body);
  if (r.status !== 200) throw new Error(`patch: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data;
}

const line = (token, id, body) => api.post(`/brands/me/offers/${id}/sources`, token, body);
const read = async (token, id) => (await api.get(`/brands/me/offers/${id}`, token)).body.data;
const publish = (token, id, seen) => api.post(`/brands/me/offers/${id}/publish`, token, seen ? { seen_product_ids: seen } : {});

/**
 * A ready offer: type/sub-type, a name, dates, the numbers, products by search. Returns the id.
 * `publishIt: false` leaves it a draft.
 */
async function ready(token, { type = 'bogo', sub, name = `Offer ${rnd()}`, from = day(1), to = day(20), cfg = {}, ids = [], publishIt = true } = {}) {
  const o = await draft(token, { offer_type: type, sub_type: sub });
  await patch(token, o.id, { name, starts_on: from, ends_on: to, offer_config_json: cfg, ...(sub && type !== 'bogo' ? { sub_type: sub } : {}) });
  if (ids.length) {
    const r = await line(token, o.id, { pool: 'buy', method: 'search', query: 'x', product_ids: ids });
    if (r.status !== 201) throw new Error(`line: ${r.status} ${JSON.stringify(r.body)}`);
  }
  if (publishIt) {
    const r = await publish(token, o.id);
    if (r.status !== 200) throw new Error(`publish: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return o.id;
}

/** Link an offer to a collaboration the way Level 2 will (collab_offers). */
async function link(ciId, offerId) {
  await query(`INSERT INTO collab_offers (campaign_influencer_id, offer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [ciId, offerId]);
}

async function notices(userId, type) {
  const { rows } = await query(`SELECT type, title, body, data_json FROM notifications WHERE user_id = $1 AND ($2::text IS NULL OR type = $2) ORDER BY created_at`, [userId, type || null]);
  return rows;
}

module.exports = { api, query, brand, creator, collab, product, rnd, T, day, tree, prod, draft, patch, line, read, publish, ready, link, notices };
