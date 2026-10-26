'use strict';

/**
 * post-engagement-stats — what shoppers do with a post inside INFLX, shown to the creator and the
 * brand; her reply and hide; the brand's read. Real API, real database; every number comes from
 * activity written through the shopper app's own endpoints, never from inserted counts.
 * Contract: features/post-engagement-stats · rules §4.15 · E1–E17 of 03-expected-outputs.md
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const w10 = require('./helpers/item10');
const { createAdminUser, createFollowerUser } = require('./helpers/factories');
const { api, query, day } = H;

let t, admin;
beforeAll(async () => {
  await truncateAll();
  t = await H.tree();
  admin = await createAdminUser();
});

/* ───────────────────────────────────────────── the world (as post-links-codes builds it) */

async function world() {
  const b = await H.brand();
  const jeans = [await H.prod(b.brandId, t.jeans, "Levi's 511 Slim", 2299), await H.prod(b.brandId, t.jeans, 'Wrangler Regular', 1999), await H.prod(b.brandId, t.jeans, 'Pepe Straight', 1799)];
  const free = [await H.prod(b.brandId, t.shirts, 'Linen shirt · Sage', 849)];
  const bundle = await H.ready(b.token, { type: 'bundle', sub: 'pick_any', name: 'Any 2 Jeans for ₹2,999', cfg: { pick: 2, price: 2999 }, ids: jeans, from: day(1), to: day(40) });
  const c = await w10.campaign(b, { name: 'Diwali Denim' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: 'Priya Rao' });
  await query(`UPDATE influencers SET instagram_handle = $2 WHERE id = $1`, [cr.influencerId, `priya_${Math.random().toString(36).slice(2, 8)}`]);
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token,
    { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [bundle], productsWithoutOffers: { mode: 'chosen', productIds: free } } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, jeans, free, bundle };
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    const r = await step(w);
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  const { rows: [con] } = await query(`SELECT id FROM contracts WHERE campaign_influencer_id = $1`, [ciId]);
  await query(`INSERT INTO production_events (contract_id, mode, status) VALUES ($1, 'shipment', 'completed')
               ON CONFLICT (contract_id) DO UPDATE SET status = 'completed'`, [con.id]);
  return w;
}

const P = '/influencers/me/shoppable-posts';
const patch = (w, id, body) => request(app).patch(`/v1${P}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);
async function upload(w, postId) {
  const r = await api.post(`${P}/${postId}/upload-url`, w.cr.token, { content_type: 'image/jpeg', size_bytes: 1024 });
  const u = new URL(r.body.data.url);
  await request(app).put(`${u.pathname}${u.search}`).set('Content-Type', 'image/jpeg').send(Buffer.alloc(1024, 7));
  return { r2_key: r.body.data.key, mime: 'image/jpeg' };
}
async function livePost(w, caption = 'Festive Sarees') {
  const { body } = await api.post(P, w.cr.token, { campaign_influencer_id: w.ciId });
  const id = body.data.post.id;
  const [tag] = (await query(`SELECT id FROM theme_tags WHERE name = 'Festive'`)).rows;
  await patch(w, id, { post_kind: 'offer' });
  await patch(w, id, { offer_id: w.bundle });
  await patch(w, id, { product_ids: w.jeans.slice(0, 2), theme_tag_ids: [tag.id], media_kind: 'image', media_layout: 'single' });
  await patch(w, id, { media: [await upload(w, id)], caption });
  const s = await api.post(`${P}/${id}/submit`, w.cr.token);
  if (s.status !== 200) throw new Error(`submit: ${JSON.stringify(s.body)}`);
  const a = await api.post(`/admin/posts/${id}/approve`, admin.token);
  if (a.status !== 200) throw new Error(`approve: ${JSON.stringify(a.body)}`);
  await query(`UPDATE brand_offers SET starts_on = $2 WHERE id = $1`, [w.bundle, day(-1)]);
  return id;
}

/* ───────────────────────────────────────────── shoppers, as the app sends them */

async function shopper(name = 'Anusha K') {
  const f = await createFollowerUser({ name });
  const { rows } = await query(`SELECT id FROM followers WHERE user_id = $1`, [f.user.id]);
  return { token: f.token, userId: f.user.id, followerId: rows[0].id };
}
/** The app's batch: `{ device_id, events: [{ post_id, event_type, surface }] }`; a guest sends no token. */
async function events(postId, types, { device, token = null, surface = 'home' } = {}) {
  const r = request(app).post('/v1/follower/events').set('x-device-id', device);
  if (token) r.set('Authorization', `Bearer ${token}`);
  const res = await r.send({ device_id: device, events: types.map((event_type) => ({ post_id: postId, event_type, surface })) });
  if (res.status >= 300) throw new Error(`events: ${JSON.stringify(res.body)}`);
  return res.body.data;
}
const comment = (s, postId, body) => api.post(`/follower/posts/${postId}/comments`, s.token, { body });
const shopperList = async (postId) => (await request(app).get(`/v1/follower/posts/${postId}/comments`).set('x-device-id', 'reader-phone')).body.data;
const moneyShot = async () => (await query(`SELECT (SELECT count(*) FROM follower_transactions) AS ft, (SELECT count(*) FROM wallet_transactions) AS wt, (SELECT count(*) FROM escrow_entries) AS es`)).rows[0];

/* ═══════════════════════════════════════════ E1–E10 · her numbers, her comments */

describe('her post inside INFLX (E1–E10)', () => {
  let w, id, s1, s2, s3, c1, c2, c3, before;
  beforeAll(async () => {
    w = await world();
    id = await livePost(w);
    await query(`UPDATE creator_posts SET media_kind = 'video' WHERE id = $1`, [id]);   // E1 is a video; E4 checks an image
    before = await moneyShot();
    s1 = await shopper('Anusha K'); s2 = await shopper('Meghana R'); s3 = await shopper('Sruthi V');
    // guests: 3 opens, a share, two shop taps and a product tap, one add to bag, the video finished
    await events(id, ['open', 'open', 'open', 'share', 'tap_shop', 'tap_shop', 'tap_product', 'add_to_bag', 'complete'], { device: 'guest-phone-1' });
    // an account: 2 opens
    await events(id, ['open', 'open'], { device: 'anusha-phone', token: s1.token });
    // likes: two, one taken back
    expect((await api.post(`/follower/posts/${id}/like`, s1.token)).status).toBe(200);
    await api.post(`/follower/posts/${id}/like`, s2.token);
    await api.del(`/follower/posts/${id}/like`, s2.token);
    // one save
    expect((await api.post(`/follower/posts/${id}/save`, s1.token)).status).toBe(200);
    // three comments: one stays, one she will hide, one INFLX removes
    c1 = (await comment(s1, id, 'Where is this available in Vijayawada?')).body.data.id;
    c2 = (await comment(s2, id, 'dm for cheap copies')).body.data.id;
    c3 = (await comment(s3, id, 'spam spam')).body.data.id;
    await api.post(`/follower/comments/${c3}/report`, s1.token);
    expect((await api.post(`/admin/shopper/comments/${c3}/decide`, admin.token, { decision: 'removed' })).status).toBe(200);
  });

  test('E5 · her comments list: newest first, the hidden one flagged, the removed one absent, replies nested', async () => {
    const r = await api.get(`${P}/${id}/comments`, w.cr.token);
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(2);
    expect(r.body.data.comments.map((c) => c.body)).toEqual(['dm for cheap copies', 'Where is this available in Vijayawada?']);
    expect(r.body.data.comments.every((c) => c.hidden === false && Array.isArray(c.replies) && c.author && c.author.name)).toBe(true);
    expect(r.body.data.comments.find((c) => c.id === c3)).toBeUndefined();
    expect(r.body.data.read_only).toBe(false);
  });

  test('E6 · she replies: a creator row under the comment; shoppers see it with her label; the count is unchanged', async () => {
    const r = await api.post(`${P}/${id}/comments`, w.cr.token, { reply_to: c1, body: 'Sri Lakshmi Silks, Besant Road — or tap Shop on the post.' });
    expect(r.status).toBe(201);
    const { rows: [row] } = await query(`SELECT author_kind, influencer_id, reply_to, status FROM post_comments WHERE id = $1`, [r.body.data.comment.id]);
    expect(row).toEqual({ author_kind: 'creator', influencer_id: w.cr.influencerId, reply_to: c1, status: 'visible' });
    const mine = (await api.get(`${P}/${id}/comments`, w.cr.token)).body.data;
    expect(mine.total).toBe(2);
    expect(mine.comments.find((c) => c.id === c1).replies.map((x) => [x.body.slice(0, 10), x.author.creator])).toEqual([['Sri Lakshm', true]]);
    const shop = await shopperList(id);
    const reply = shop.comments.find((c) => c.reply_to === c1);
    expect(reply.author.creator).toBe(true);
    expect(shop.total).toBe(3);   // the shopper list counts her reply too, as before
  });

  test('E7 · hide: gone from the shopper list and from the count; unhide: back', async () => {
    const h = await api.post(`/influencers/me/comments/${c2}/hide`, w.cr.token);
    expect(h.status).toBe(200); expect(h.body.data).toEqual({ id: c2, hidden: true });
    expect((await query(`SELECT status, hidden_at FROM post_comments WHERE id = $1`, [c2])).rows[0]).toMatchObject({ status: 'hidden' });
    expect((await query(`SELECT hidden_at FROM post_comments WHERE id = $1`, [c2])).rows[0].hidden_at).toBeTruthy();
    expect((await shopperList(id)).comments.map((c) => c.id)).not.toContain(c2);
    const mine = (await api.get(`${P}/${id}/comments`, w.cr.token)).body.data;
    expect(mine.total).toBe(1);
    expect(mine.comments.find((c) => c.id === c2)).toMatchObject({ hidden: true });
    expect((await api.get(`${P}/${id}/stats`, w.cr.token)).body.data.inflx.comments).toBe(1);
    const u = await api.post(`/influencers/me/comments/${c2}/unhide`, w.cr.token);
    expect(u.body.data).toEqual({ id: c2, hidden: false });
    expect((await shopperList(id)).comments.map((c) => c.id)).toContain(c2);
    expect((await api.get(`${P}/${id}/stats`, w.cr.token)).body.data.inflx.comments).toBe(2);
    await api.post(`/influencers/me/comments/${c2}/hide`, w.cr.token);   // hidden again for E1
  });

  test('E1 · the block: every number from the tables, a like taken back is 0, hidden and removed not counted, guests count where they can act', async () => {
    const r = await api.get(`${P}/${id}/stats`, w.cr.token);
    expect(r.status).toBe(200);
    expect(r.body.data.inflx).toEqual({ since: expect.any(String), views: 5, likes: 1, comments: 1, shares: 1, saves: 1, shop_taps: 3, bag_adds: 1, finished: 1 });
    expect(r.body.data.inflx.since).toBe(r.body.data.live_since);
  });

  test('E2 · Post status carries the three', async () => {
    const r = await api.get(`${P}/${id}`, w.cr.token);
    expect(r.body.data.post.inflx).toEqual({ views: 5, likes: 1, comments: 1 });
  });

  test('E8 · a comment INFLX removed cannot be unhidden', async () => {
    const r = await api.post(`/influencers/me/comments/${c3}/unhide`, w.cr.token);
    expect(r.status).toBe(409);
    expect(r.body.error.message).toBe('INFLX removed this comment.');
    expect((await query(`SELECT status FROM post_comments WHERE id = $1`, [c3])).rows[0].status).toBe('removed');
  });

  test('E9 · an empty or 301-character reply is refused in the shopper app\'s words; a reply to another post\'s comment is 404', async () => {
    expect((await api.post(`${P}/${id}/comments`, w.cr.token, { reply_to: c1, body: '   ' })).body.error.message).toBe('Write something first.');
    const long = await api.post(`${P}/${id}/comments`, w.cr.token, { reply_to: c1, body: 'x'.repeat(301) });
    expect(long.status).toBe(422); expect(long.body.error.message).toBe('Keep a comment under 300 characters.');
    const other = await livePost(w, 'Office Edit');
    expect((await api.post(`${P}/${other}/comments`, w.cr.token, { reply_to: c1, body: 'hi' })).status).toBe(404);
  });

  test('E10 · another creator: 404 on all four', async () => {
    const x = await H.creator({ name: 'Someone Else' });
    expect((await api.get(`${P}/${id}/comments`, x.token)).status).toBe(404);
    expect((await api.post(`${P}/${id}/comments`, x.token, { reply_to: c1, body: 'hi' })).status).toBe(404);
    expect((await api.post(`/influencers/me/comments/${c1}/hide`, x.token)).status).toBe(404);
    expect((await api.post(`/influencers/me/comments/${c1}/unhide`, x.token)).status).toBe(404);
  });

  test('E16 · no money row was read or written by any of this', async () => {
    expect(await moneyShot()).toEqual(before);
  });
});

/* ═══════════════════════════════════════════ E3, E4 · nothing yet; image vs video */

describe('nothing yet, and image vs video (E3, E4)', () => {
  test('a live post nobody opened: zeros, finished null for an image', async () => {
    const w = await world();
    const id = await livePost(w);
    const r = await api.get(`${P}/${id}/stats`, w.cr.token);
    expect(r.body.data.inflx).toEqual({ since: expect.any(String), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, shop_taps: 0, bag_adds: 0, finished: null });
    expect((await api.get(`${P}/${id}`, w.cr.token)).body.data.post.inflx).toEqual({ views: 0, likes: 0, comments: 0 });
    await query(`UPDATE creator_posts SET media_kind = 'video' WHERE id = $1`, [id]);
    expect((await api.get(`${P}/${id}/stats`, w.cr.token)).body.data.inflx.finished).toBe(0);
  });
});

/* ═══════════════════════════════════════════ E11–E14 · the brand */

describe('the brand reads (E11–E14)', () => {
  let w, id, s;
  beforeAll(async () => {
    w = await world();
    id = await livePost(w);
    s = await shopper('Meghana R');
    await events(id, ['open', 'open', 'share'], { device: 'guest-phone-2' });
    await api.post(`/follower/posts/${id}/like`, s.token);
    const c = (await comment(s, id, 'Loved the gold border')).body.data.id;
    await api.post(`${P}/${id}/comments`, w.cr.token, { reply_to: c, body: 'Thank you!' });
    const hidden = (await comment(s, id, 'cheap copies here')).body.data.id;
    await api.post(`/influencers/me/comments/${hidden}/hide`, w.cr.token);
  });

  test('E11 · Set posts rows carry the three; E12 · the post stats carry the block', async () => {
    const list = await api.get(`${w.url}/posts`, w.b.token);
    expect(list.status).toBe(200);
    expect(list.body.data.posts.find((p) => p.id === id).inflx).toEqual({ views: 2, likes: 1, comments: 1 });
    const st = await api.get(`${w.url}/posts/${id}/stats`, w.b.token);
    expect(st.body.data.inflx).toEqual({ since: expect.any(String), views: 2, likes: 1, comments: 1, shares: 1, saves: 0, shop_taps: 0, bag_adds: 0, finished: null });
  });

  test('E13 · the brand\'s comments: visible and her replies only, read-only; E14 · another brand 404', async () => {
    const r = await api.get(`${w.url}/posts/${id}/comments`, w.b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.read_only).toBe(true);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.comments.map((c) => [c.body, c.replies.length])).toEqual([['Loved the gold border', 1]]);
    expect(r.body.data.comments[0].replies[0].author.creator).toBe(true);
    expect(JSON.stringify(r.body)).not.toMatch(/"hidden":true|can_hide|can_reply/);
    const x = await H.brand();
    expect((await api.get(`${w.url}/posts/${id}/comments`, x.token)).status).toBe(404);
    expect((await api.get(`${w.url}/posts/${id}/stats`, x.token)).status).toBe(404);
  });
});

/* ═══════════════════════════════════════════ E17 · the dead counts are gone */

describe('housekeeping (E17)', () => {
  test('creatorPosts.service no longer computes like_count / save_count that nothing read', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/services/creatorPosts.service.js'), 'utf8');
    expect(src).not.toMatch(/like_count|save_count/);
  });
});
