'use strict';

/**
 * Item 17 — shared fixtures for the Wallet suites.
 * Contract: features/item17-wallet
 *
 * A Pay for Sale collaboration with one approved, live shoppable post and a shopper who really
 * orders through it (the shopper-ordering test's own path: review → place → verify), so the sales
 * the wallet settles are real order_lines with their frozen three-way split.
 */

const request = require('supertest');
const app = require('../../src/app');
const { truncateAll } = require('./db');
const H = require('./offersV2');
const w10 = require('./item10');
const { createAdminUser, createFollowerUser } = require('./factories');
const settings = require('../../src/services/platformSettings.service');

const { api, query, day } = H;
let t = null; let admin = null; let seq = 0;

async function fresh() {
  await truncateAll();
  settings._resetCache();
  t = await H.tree();
  admin = await createAdminUser();
  return admin;
}
const adminUser = () => admin;

const PP = '/influencers/me/shoppable-posts';
const patchPost = (w, id, body) => request(app).patch(`/v1${PP}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);

/** A signed Pay for Sale collaboration (10% commission) on a 20% discount, with one approved LIVE post. */
async function saleWorld({ prices = [2000, 1500, 1000] } = {}) {
  seq += 1;
  const b = await H.brand();
  const ids = [];
  for (let i = 0; i < prices.length; i += 1) ids.push(await H.prod(b.brandId, t.jeans, `Jeans ${seq}-${i}`, prices[i])); // eslint-disable-line no-await-in-loop
  const deal = await H.ready(b.token, { type: 'discount', sub: 'percentage', name: `discount ${seq}`, cfg: { pct: 20 }, ids, from: day(-5), to: day(40) });
  const c = await w10.campaign(b, { name: 'Diwali Denim' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: 'Priya Rao' });
  await query(`UPDATE influencers SET instagram_handle = $2, full_name = 'Priya Rao' WHERE id = $1`, [cr.influencerId, `priya17_${seq}`]);
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token,
    { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [deal] } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, ids, deal };
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    const r = await step(w); // eslint-disable-line no-await-in-loop
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  const { rows: [con] } = await query(`SELECT id FROM contracts WHERE campaign_influencer_id = $1`, [ciId]);
  await query(`INSERT INTO production_events (contract_id, mode, status) VALUES ($1, 'shipment', 'completed')
               ON CONFLICT (contract_id) DO UPDATE SET status = 'completed'`, [con.id]);
  // one approved post, live (the posting date moved into the past)
  const { body } = await api.post(PP, cr.token, { campaign_influencer_id: ciId });
  const postId = body.data.post.id;
  const [tg] = (await query(`SELECT id FROM theme_tags WHERE name = 'Festive'`)).rows;
  await patchPost(w, postId, { post_kind: 'offer' });
  await patchPost(w, postId, { offer_id: deal });
  await patchPost(w, postId, { product_ids: ids, theme_tag_ids: [tg.id], media_kind: 'image', media_layout: 'single' });
  const up = await api.post(`${PP}/${postId}/upload-url`, cr.token, { content_type: 'image/jpeg', size_bytes: 1024 });
  const u = new URL(up.body.data.url);
  await request(app).put(`${u.pathname}${u.search}`).set('Content-Type', 'image/jpeg').send(Buffer.alloc(1024, 7));
  await patchPost(w, postId, { media: [{ r2_key: up.body.data.key, mime: 'image/jpeg' }], caption: 'Festive denim' });
  const sub = await api.post(`${PP}/${postId}/submit`, cr.token);
  if (sub.status !== 200) throw new Error(`submit: ${JSON.stringify(sub.body)}`);
  const ap = await api.post(`/admin/posts/${postId}/approve`, admin.token);
  if (ap.status !== 200) throw new Error(`approve: ${JSON.stringify(ap.body)}`);
  await query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [s.id, day(-1)]);
  w.post = postId;
  return w;
}

async function shopper() {
  const f = await createFollowerUser({ name: 'Anusha K' });
  const { rows } = await query(`SELECT id FROM followers WHERE user_id = $1`, [f.user.id]);
  return { token: f.token, userId: f.user.id, followerId: rows[0].id };
}
const ADDRESS = { receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B, Lotus Residency', area: 'Road No. 3, Banjara Hills',
  landmark: 'Near the park', pincode: '500034', city: 'Hyderabad', state: 'Telangana', label: 'Home' };
const line = (w, i, extra = {}) => ({ post_id: w.post, product_id: w.ids[i], qty: 1, ...extra });

/** A real order through her post. Returns its lines (dearest first), parcel and money row. */
async function order(w, items = [0], { method = 'online' } = {}) {
  seq += 1;
  const sh = await shopper();
  const a = await api.post('/follower/addresses', sh.token, ADDRESS);
  if (a.status !== 201) throw new Error(`address: ${JSON.stringify(a.body)}`);
  const addr = a.body.data.address.id;
  const lines = items.map((i) => line(w, i));
  const rv = await api.post('/follower/checkout/review', sh.token, { address_id: addr, lines, payment_method: method });
  if (rv.status !== 200) throw new Error(`review: ${JSON.stringify(rv.body)}`);
  const p = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines, payment_method: method, expected_total: rv.body.data.total });
  if (p.status !== 200) throw new Error(`place: ${JSON.stringify(p.body)}`);
  if (method === 'online') {
    const v = await api.post('/follower/checkout/verify', sh.token, { razorpay_order_id: p.body.data.razorpay.order_id, razorpay_payment_id: `pay17_${seq}`, razorpay_signature: 'x' });
    if (v.status !== 200) throw new Error(`verify: ${JSON.stringify(v.body)}`);
  }
  const checkoutId = p.body.data.checkout_id;
  const { rows: ls } = await query(`SELECT * FROM order_lines WHERE checkout_id = $1 ORDER BY paid_total DESC`, [checkoutId]);
  const { rows: [parcel] } = await query(`SELECT * FROM follower_orders WHERE checkout_id = $1`, [checkoutId]);
  const { rows: [tx] } = await query(`SELECT * FROM follower_transactions WHERE checkout_id = $1`, [checkoutId]);
  return { sh, checkoutId, lines: ls, parcel, tx };
}

/** The brand moves the parcel to Delivered (Packed → Shipped → Delivered). `daysAgo` back-dates the delivery. */
async function deliver(w, orderId, daysAgo = 0) {
  for (const body of [{ status: 'packed' }, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DL17' }, { status: 'delivered' }]) {
    const r = await api.patch(`/brands/me/orders/${orderId}/status`, w.b.token, body); // eslint-disable-line no-await-in-loop
    if (r.status !== 200) throw new Error(`${body.status}: ${JSON.stringify(r.body)}`);
  }
  if (daysAgo) await query(`UPDATE follower_orders SET delivered_at = now() - ($2 || ' days')::interval WHERE id = $1`, [orderId, String(daysAgo)]);
}

/** The brand ships the parcel (Packed → Shipped). From here it can no longer be cancelled. */
async function ship(w, orderId) {
  for (const body of [{ status: 'packed' }, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DL17' }]) {
    const r = await api.patch(`/brands/me/orders/${orderId}/status`, w.b.token, body); // eslint-disable-line no-await-in-loop
    if (r.status !== 200) throw new Error(`${body.status}: ${JSON.stringify(r.body)}`);
  }
}

/** The return window has closed for this sale. */
const closeWindow = (txId) => query(
  `UPDATE follower_transactions SET created_at = now() - interval '31 days', return_window_ends_at = now() - interval '1 minute' WHERE id = $1`, [txId]);

/** Where money is sent: the brand's bank account, the creator's UPI — through their own profile routes. */
async function brandBank(w) {
  const r = await api.patch('/brands/me', w.b.token, { bank_account_no: '50100284614821', bank_ifsc: 'HDFC0001234' });
  if (r.status !== 200) throw new Error(`bank: ${JSON.stringify(r.body)}`);
}
async function creatorUpi(w) {
  const r = await api.patch('/influencers/me', w.cr.token, { upi_id: 'priya@okhdfc' });
  if (r.status !== 200) throw new Error(`upi: ${JSON.stringify(r.body)}`);
}

const money = async (w) => (await query(
  `SELECT (SELECT wallet_balance::float FROM brands WHERE id = $1) AS brand, (SELECT withdrawal_hold::float FROM brands WHERE id = $1) AS brand_hold,
          (SELECT wallet_balance::float FROM influencers WHERE id = $2) AS her, (SELECT withdrawal_hold::float FROM influencers WHERE id = $2) AS her_hold,
          (SELECT pending_balance::float FROM influencers WHERE id = $2) AS her_pending`, [w.brandId, w.cr.influencerId])).rows[0];

module.exports = { api, query, day, fresh, adminUser, saleWorld, order, closeWindow, deliver, ship, brandBank, creatorUpi, money, shopper, line };
