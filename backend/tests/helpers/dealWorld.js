'use strict';

/**
 * A live shoppable post on an offer of a chosen kind, and a shopper who orders from it — for the
 * shopper-deal-orders tests (orders by deal, replacing one item). Real API, real database: the
 * offer is built and published by the brand, the collaboration is signed, the post is approved.
 *
 *   kinds: discount (20% off) · pick3 ("any 3 for ₹2,999") · quantity (buy 2 → 20%, buy 3 → 30%) ·
 *          bogo · set (the three for ₹3,500) · set_open (the same, pieces sold alone too) ·
 *          spend (spend ₹3,000 on these, get the one gift — a silver coin — free)
 */

const request = require('supertest');
const app = require('../../src/app');
const { truncateAll } = require('./db');
const H = require('./offersV2');
const w10 = require('./item10');
const { createAdminUser, createFollowerUser } = require('./factories');
const settings = require('../../src/services/platformSettings.service');
const { api, query, day } = H;

let t = null;
let admin = null;
let seq = 0;

/** A clean database with the category tree and an INFLX admin. Call once per test file. */
async function fresh() {
  await truncateAll();
  settings._resetCache();
  t = await H.tree();
  admin = await createAdminUser();
  return admin;
}

async function offerOf(b, kind, ids) {
  const base = { name: `${kind} ${seq}`, ids, from: day(-5), to: day(40) };
  switch (kind) {
    case 'spend': {
      const coin = (await api.post('/brands/me/gift-items', b.token, { name: `Silver coin ${seq}`, value: 650, stock: 50 })).body.data.gift_item;
      const o = await H.draft(b.token, { offer_type: 'free_gift', sub_type: 'spend' });
      await H.patch(b.token, o.id, { name: base.name, starts_on: base.from, ends_on: base.to, offer_config_json: { min_spend: 3000, gift_count: 1 } });
      await H.line(b.token, o.id, { pool: 'buy', method: 'search', query: 'x', product_ids: ids });
      const g = await H.line(b.token, o.id, { pool: 'gift', method: 'gift_items', gift_item_ids: [coin.id] });
      if (g.status !== 201) throw new Error(`gift line: ${JSON.stringify(g.body)}`);
      const p = await H.publish(b.token, o.id);
      if (p.status !== 200) throw new Error(`publish: ${JSON.stringify(p.body)}`);
      return o.id;
    }
    case 'discount': return H.ready(b.token, { ...base, type: 'discount', sub: 'percentage', cfg: { pct: 20 } });
    case 'pick3': return H.ready(b.token, { ...base, type: 'bundle', sub: 'pick_any', cfg: { pick: 3, price: 2999 } });
    case 'quantity': return H.ready(b.token, { ...base, type: 'volume', sub: 'quantity', cfg: { reward: 'pct', tiers: [{ at: 2, value: 20 }, { at: 3, value: 30 }] } });
    case 'bogo': return H.ready(b.token, { ...base, type: 'bogo', sub: 'bogo', cfg: { max_free: 2 } });
    case 'set': return H.ready(b.token, { ...base, type: 'bundle', sub: 'fixed', cfg: { price: 3500 } });
    case 'set_open': return H.ready(b.token, { ...base, type: 'bundle', sub: 'fixed', cfg: { price: 3500, pieces_alone: true } });
    default: throw new Error(kind);
  }
}

const PP = '/influencers/me/shoppable-posts';
const patchPost = (w, id, body) => request(app).patch(`/v1${PP}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);
async function makePost(w) {
  const { body } = await api.post(PP, w.cr.token, { campaign_influencer_id: w.ciId });
  const id = body.data.post.id;
  const [tg] = (await query(`SELECT id FROM theme_tags WHERE name = 'Festive'`)).rows;
  await patchPost(w, id, { post_kind: 'offer' });
  await patchPost(w, id, { offer_id: w.deal });
  await patchPost(w, id, { product_ids: w.ids, theme_tag_ids: [tg.id], media_kind: 'image', media_layout: 'single' });
  const up = await api.post(`${PP}/${id}/upload-url`, w.cr.token, { content_type: 'image/jpeg', size_bytes: 1024 });
  const u = new URL(up.body.data.url);
  await request(app).put(`${u.pathname}${u.search}`).set('Content-Type', 'image/jpeg').send(Buffer.alloc(1024, 7));
  await patchPost(w, id, { media: [{ r2_key: up.body.data.key, mime: 'image/jpeg' }], caption: 'Festive denim' });
  const s = await api.post(`${PP}/${id}/submit`, w.cr.token);
  if (s.status !== 200) throw new Error(`submit: ${JSON.stringify(s.body)}`);
  const a = await api.post(`/admin/posts/${id}/approve`, admin.token);
  if (a.status !== 200) throw new Error(`approve: ${JSON.stringify(a.body)}`);
  return id;
}

/**
 * A signed collaboration (10% commission) on an offer of `kind`, with one approved live post.
 * A pick-any bundle publishes only when its costliest item is at most 1.5 × its cheapest, hence these prices.
 */
async function world(kind, prices = [1399, 1499, 1999], { creator = 'Akshaya Reddy', brand = null, variants = null } = {}) {
  if (!t) throw new Error('call dealWorld.fresh() first');
  seq += 1;
  const b = await H.brand();
  if (brand) await query(`UPDATE brands SET business_name = $2 WHERE id = $1`, [b.brandId, brand]);
  const ids = [];
  // `variants`: the colours and sizes (with stock) every product is listed with — { colors: [{ color, images, sizes: [{ size, stock }] }] }
  for (let i = 0; i < prices.length; i++) ids.push(await H.prod(b.brandId, t.jeans, `Piece ${seq}-${i}`, prices[i], null, variants ? { variants_json: variants } : {}));
  const deal = await offerOf(b, kind, ids);
  const c = await w10.campaign(b, { name: 'Diwali Denim' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: creator });
  await query(`UPDATE influencers SET instagram_handle = $2, full_name = $3 WHERE id = $1`, [cr.influencerId, `creator_${seq}`, creator]);
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token,
    { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [deal] } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const w = { kind, b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, ids, prices, deal };
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    const r = await step(w);
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  const { rows: [con] } = await query(`SELECT id FROM contracts WHERE campaign_influencer_id = $1`, [ciId]);
  await query(`INSERT INTO production_events (contract_id, mode, status) VALUES ($1, 'shipment', 'completed')
               ON CONFLICT (contract_id) DO UPDATE SET status = 'completed'`, [con.id]);
  w.post = await makePost(w);
  await query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [w.s.id, day(-1)]);
  return w;
}

async function shopper(name = 'Anusha K') {
  const f = await createFollowerUser({ name });
  const { rows } = await query(`SELECT id FROM followers WHERE user_id = $1`, [f.user.id]);
  const sh = { token: f.token, userId: f.user.id, followerId: rows[0].id };
  const a = await api.post('/follower/addresses', sh.token, ADDRESS);
  if (a.status !== 201) throw new Error(`address: ${JSON.stringify(a.body)}`);
  sh.addr = a.body.data.address.id;
  return sh;
}
const ADDRESS = { receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 302, Lake View Residency', area: 'Madhapur',
  landmark: 'Near the park', pincode: '500081', city: 'Hyderabad', state: 'Telangana', label: 'Home' };
const line = (w, i, extra = {}) => ({ post_id: w.post, product_id: w.ids[i], qty: 1, ...extra });

let pays = 0;
/**
 * She orders these lines (one checkout). Cash on delivery unless `method: 'online'`, which is paid.
 * Returns { checkoutId, lines (as placed, oldest first), parcels }.
 */
async function order(sh, lines, { method = 'cod' } = {}) {
  const rv = await api.post('/follower/checkout/review', sh.token, { address_id: sh.addr, lines, payment_method: method });
  if (rv.status !== 200 || !rv.body.data.buyable) throw new Error(`review: ${JSON.stringify(rv.body).slice(0, 400)}`);
  const p = await api.post('/follower/checkout/place', sh.token, { address_id: sh.addr, lines, payment_method: method, expected_total: rv.body.data.total });
  if (p.status !== 200) throw new Error(`place: ${JSON.stringify(p.body)}`);
  if (method === 'online') {
    pays += 1;
    const v = await api.post('/follower/checkout/verify', sh.token, { razorpay_order_id: p.body.data.razorpay.order_id, razorpay_payment_id: `paydeal_${pays}`, razorpay_signature: 'x' });
    if (v.status !== 200) throw new Error(`verify: ${JSON.stringify(v.body)}`);
  }
  const checkoutId = p.body.data.checkout_id;
  const { rows: ls } = await query(`SELECT * FROM order_lines WHERE checkout_id = $1 ORDER BY created_at, id`, [checkoutId]);
  const { rows: parcels } = await query(`SELECT * FROM follower_orders WHERE checkout_id = $1 ORDER BY created_at, id`, [checkoutId]);
  return { checkoutId, lines: ls, parcels, total: rv.body.data.total };
}

/** The brand moves a parcel on: 'packed' · 'shipped' · 'delivered' (each passes through the ones before it). */
async function move(w, orderId, to) {
  const steps = [{ status: 'packed' }, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DLDEAL' }, { status: 'delivered' }];
  const upTo = { packed: 1, shipped: 2, delivered: 3 }[to];
  for (const body of steps.slice(0, upTo)) {
    const r = await api.patch(`/brands/me/orders/${orderId}/status`, w.b.token, body); // eslint-disable-line no-await-in-loop
    if (r.status !== 200) throw new Error(`${body.status}: ${JSON.stringify(r.body)}`);
  }
}

module.exports = { api, query, day, fresh, world, shopper, order, move, line, ADDRESS, adminOf: () => admin };
