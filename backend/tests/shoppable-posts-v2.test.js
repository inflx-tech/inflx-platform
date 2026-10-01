'use strict';

/**
 * shoppable-posts-v2 — a creator makes a shoppable post for one collaboration (Level 3).
 * Contract: features/shoppable-posts-v2 · Docs/OFFER_TERMS_POSTS_RULES.md §4 · checks in 03-expected-outputs.md.
 * Real API, real database, real signed uploads (the mock stands in for R2 exactly).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const w10 = require('./helpers/item10');
const { createAdminUser, createFollowerUser } = require('./helpers/factories');
const posts = require('../src/services/shoppablePosts.service');
const { MSG } = require('../src/services/postsCopy');
const { api, query, day } = H;

let t, admin;
beforeAll(async () => {
  await truncateAll();
  t = await H.tree();
  admin = await createAdminUser();
});

/**
 * A brand with jeans in a pick-any bundle, a discounted shirt, a fixed bundle, and two products
 * without offers; a Pay for Sale set posting in 12 days; a creator given the offers and the two
 * products, signed by both, with the shoot done (unless `shootDone: false`).
 */
async function world({ shootDone = true, goal = 'conversion', min = null } = {}) {
  const b = await H.brand();
  const jeans = [
    await H.prod(b.brandId, t.jeans, "Levi's 511 Slim", 2299),
    await H.prod(b.brandId, t.jeans, 'Wrangler Regular', 1999),
    await H.prod(b.brandId, t.jeans, "Levi's 512 Taper", 2499),
    await H.prod(b.brandId, t.jeans, 'Pepe Straight', 1799),
  ];
  const shirt = await H.prod(b.brandId, t.shirts, 'Oxford shirt', 1100);
  const belt = await H.prod(b.brandId, t.jackets, 'Leather belt', 900);
  const chino = await H.prod(b.brandId, t.trousers, 'Chino trouser', 1400);
  const free = [await H.prod(b.brandId, t.shirts, 'Linen shirt · Sage', 849), await H.prod(b.brandId, t.shirts, 'Crew tee · Black', 699)];
  const bundle = await H.ready(b.token, { type: 'bundle', sub: 'pick_any', name: 'Any 2 Jeans for ₹2,999', cfg: { pick: 2, price: 2999 }, ids: jeans, from: day(1), to: day(40) });
  const discount = await H.ready(b.token, { type: 'discount', sub: 'percentage', name: '20% off shirts', cfg: { pct: 20 }, ids: [shirt], from: day(1), to: day(40) });
  const fixed = await H.ready(b.token, { type: 'bundle', sub: 'fixed', name: 'Belt + Chino ₹1,999', cfg: { price: 1999, quantities: { [belt]: 1, [chino]: 1 } }, ids: [belt, chino], from: day(1), to: day(40) });
  const c = await w10.campaign(b);
  const s = await w10.set(b, c.id, { goal, shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: 'Priya Rao' });
  const terms = goal === 'engagement'
    ? { fee: 9000, deliverables: [{ type: 'reel', count: 1 }] }
    : { commissionPct: 10, offers: [bundle, discount, fixed], productsWithoutOffers: { mode: 'chosen', productIds: free } };
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  await query(`UPDATE brands SET wallet_balance = 500000 WHERE id = $1`, [b.brandId]);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, jeans, shirt, belt, chino, free, bundle, discount, fixed };
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    const r = await step(w);
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  if (min != null) await query(`UPDATE campaign_influencers SET min_shoppable_posts = $2 WHERE id = $1`, [ciId, min]);
  if (shootDone) await finishShoot(ciId);
  return w;
}

async function finishShoot(ciId) {
  const { rows: [con] } = await query(`SELECT id FROM contracts WHERE campaign_influencer_id = $1`, [ciId]);
  await query(
    `INSERT INTO production_events (contract_id, mode, status, influencer_completed_at) VALUES ($1, 'shipment', 'completed', now())
     ON CONFLICT (contract_id) DO UPDATE SET status = 'completed', influencer_completed_at = now()`, [con.id]);
}

const P = '/influencers/me/shoppable-posts';
/** The posting date has passed (the invite deadline moves with it, as the set's own rule requires). */
const pastPosting = (w) => query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [w.s.id, day(-1)]);
const draft = async (w) => {
  const r = await api.post(P, w.cr.token, { campaign_influencer_id: w.ciId });
  if (r.status !== 200) throw new Error(`draft: ${JSON.stringify(r.body)}`);
  return r.body.data.post;
};
const patch = (w, id, body) => request(app).patch(`/v1${P}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);
const opts = async (w, id) => (await api.get(`${P}/${id}/options`, w.cr.token)).body.data;
const tagIds = async (names) => (await query(`SELECT id, name FROM theme_tags WHERE name = ANY($1::text[])`, [names])).rows
  .sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name)).map((r) => r.id);

/** Upload a real file through the signed URL, the way the phone does. */
async function upload(w, postId, { mime = 'image/jpeg', bytes = 2048 } = {}) {
  const r = await api.post(`${P}/${postId}/upload-url`, w.cr.token, { content_type: mime, size_bytes: bytes });
  if (r.status !== 200) throw new Error(`upload-url: ${JSON.stringify(r.body)}`);
  const u = new URL(r.body.data.url);
  const put = await request(app).put(`${u.pathname}${u.search}`).set('Content-Type', r.body.data.headers['Content-Type']).send(Buffer.alloc(bytes, 7));
  if (put.status !== 200) throw new Error(`put: ${put.status} ${put.text}`);
  return { r2_key: r.body.data.key, mime };
}

/** A complete offer post (bundle), ready to send. */
async function readyBundlePost(w, { products = w.jeans.slice(0, 3) } = {}) {
  const p = await draft(w);
  await patch(w, p.id, { post_kind: 'offer', draft_step: 4 });
  await patch(w, p.id, { offer_id: w.bundle, draft_step: 5 });
  await patch(w, p.id, { product_ids: products, draft_step: 6 });
  await patch(w, p.id, { theme_tag_ids: await tagIds(['Winter', 'Office', 'Classic']), draft_step: 7 });
  const m1 = await upload(w, p.id); const m2 = await upload(w, p.id);
  await patch(w, p.id, { media_kind: 'image', media_layout: 'carousel', media: [m1, m2], draft_step: 8 });
  await patch(w, p.id, { caption: 'Office-ready denim that works past 6 pm. Pick any 2 for ₹2,999' });
  return p;
}
const send = (w, id) => api.post(`${P}/${id}/submit`, w.cr.token);
const approve = (id) => api.post(`/admin/posts/${id}/approve`, admin.token);
const sendBack = (id, reason) => api.post(`/admin/posts/${id}/reject`, admin.token, { reason });
const read = async (w, id) => (await api.get(`${P}/${id}`, w.cr.token)).body.data.post;

/* ═══════════════════════════════════════════ who can post (P2, P3; checks 1–3) */

describe('who can post, and for what (P2, P3; checks 1–3)', () => {
  test('before the shoot is done the brand shows "Opens after your shoot plan" and no draft can be made', async () => {
    const w = await world({ shootDone: false });
    const b = await api.get(`${P}/brands`, w.cr.token);
    expect(b.body.data.brands).toEqual([expect.objectContaining({ id: w.brandId, open: false, line: 'Opens after your shoot plan' })]);
    const r = await api.post(P, w.cr.token, { campaign_influencer_id: w.ciId });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.NOT_POSTABLE);
  });

  test('after both signatures and the shoot: the brand opens; the collaboration says what she can sell, its date and posts done', async () => {
    const w = await world();
    const b = await api.get(`${P}/brands`, w.cr.token);
    expect(b.body.data.brands[0]).toMatchObject({ open: true, line: '1 collaboration' });
    const c = await api.get(`${P}/collaborations?brand_id=${w.brandId}`, w.cr.token);
    expect(c.body.data.collaborations[0]).toMatchObject({
      id: w.ciId, sell_words: '3 offers + 2 products', posting_date: day(12), posts_done: 0, posts_min: 1, earning: 'earning 10%', open: true,
    });
  });

  test('a Pay for Content collaboration is not one she makes shoppable posts for', async () => {
    const w = await world({ goal: 'engagement' });
    expect((await api.get(`${P}/brands`, w.cr.token)).body.data.brands).toEqual([]);
    expect((await api.post(P, w.cr.token, { campaign_influencer_id: w.ciId })).status).toBe(404);
  });

  test("another creator's collaboration answers 404", async () => {
    const w = await world();
    const other = await H.creator({ name: 'Asha M.' });
    expect((await api.post(P, other.token, { campaign_influencer_id: w.ciId })).status).toBe(404);
  });
});

/* ═══════════════════════════════════════════ the choices (P4, P5, P7, P8; checks 4–7) */

describe('the choices for each step (P4–P9; checks 4–7)', () => {
  test('post type: offer post (3 offers) and price post (2 products); offer types with counts, empty types named as hidden', async () => {
    const w = await world();
    const p = await draft(w);
    expect(p).toMatchObject({ state: 'draft', draft_step: 3, kind: null });
    const o = await opts(w, p.id);
    expect(o.kinds.offer).toMatchObject({ available: true, count: 3 });
    expect(o.kinds.price).toMatchObject({ available: true, count: 2 });
    expect(o.offer_types).toEqual([{ key: 'discount', label: 'Discount', count: 1 }, { key: 'bundle', label: 'Bundle', count: 2 }]);
    expect(o.offer_types_hidden).toBe("BOGO, Volume and Free gift aren't shown because this collaboration has none.");
    expect(o.theme_tags.map((g) => [g.group, g.tags.length])).toEqual([['season', 4], ['occasion', 9], ['style', 9], ['use', 5]]);
    expect(o.price_bands.map((b) => b.label)).toEqual(['Under ₹499', 'Under ₹999', 'Under ₹1,999', 'Under ₹2,999', '₹3,000+']);
  });

  test('an offer ending within 7 days of posting carries the warning the brand saw', async () => {
    const w = await world();
    await query(`UPDATE brand_offers SET ends_on = $2 WHERE id = $1`, [w.fixed, day(16)]);
    const p = await draft(w);
    const o = await opts(w, p.id);
    const fixed = o.offers.find((x) => x.id === w.fixed);
    expect(fixed.ends_soon).toMatch(/ends .*, 4 days after posting\. The post leaves the shop when it ends\.$/);
    expect(o.offers.find((x) => x.id === w.bundle).ends_soon).toBeNull();
  });

  test('pick-any: the pool with prices and "pick at least 2"; discount: prices as shoppers pay them', async () => {
    const w = await world();
    const p = await draft(w);
    await patch(w, p.id, { post_kind: 'offer' });
    await patch(w, p.id, { offer_id: w.bundle });
    let o = await opts(w, p.id);
    expect(o.pool).toMatchObject({ offer_id: w.bundle, count: 4, rule: { min: 2, auto: false } });
    await patch(w, p.id, { offer_id: w.discount });
    o = await opts(w, p.id);
    expect(o.pool.products).toEqual([expect.objectContaining({ id: w.shirt, price: 1100, shopper_price: 880 })]);
  });

  test('fixed bundle: every product is added for her', async () => {
    const w = await world();
    const p = await draft(w);
    await patch(w, p.id, { post_kind: 'offer' });
    const r = await patch(w, p.id, { offer_id: w.fixed });
    expect(r.body.data.post.products.map((x) => x.id).sort()).toEqual([w.belt, w.chino].sort());
    expect((await opts(w, p.id)).pool.rule).toMatchObject({ auto: true, min: 2 });
  });

  test('price post: only her products without offers, with their category path', async () => {
    const w = await world();
    const p = await draft(w);
    const o = await opts(w, p.id);
    expect(o.price_products.map((x) => x.name)).toEqual(['Crew tee · Black', 'Linen shirt · Sage']);
    expect(o.price_products[0].path.map((n) => n.name)).toEqual(['Men', 'Topwear', 'Shirts']);
  });
});

/* ═══════════════════════════════════════════ saving the steps (checks 8–12) */

describe('saving each step (checks 8–12)', () => {
  test('products must come from the chosen offer, or from her products without offers', async () => {
    const w = await world();
    const p = await draft(w);
    await patch(w, p.id, { post_kind: 'offer' });
    await patch(w, p.id, { offer_id: w.bundle });
    let r = await patch(w, p.id, { product_ids: [w.jeans[0], w.shirt] });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.PRODUCT_NOT_IN_OFFER);
    await patch(w, p.id, { post_kind: 'price' });
    r = await patch(w, p.id, { product_ids: [w.jeans[0]] });
    expect(r.body.error.message).toBe(MSG.PRODUCT_NOT_YOURS);
    r = await patch(w, p.id, { product_ids: [w.free[0]] });
    expect(r.status).toBe(200);
    expect(r.body.data.post.products.map((x) => x.id)).toEqual([w.free[0]]);
  });

  test('an offer not in her collaboration is refused', async () => {
    const w = await world();
    const stranger = await H.ready(w.b.token, { type: 'bogo', name: 'Not hers', ids: [await H.prod(w.brandId, t.jeans, 'Other', 1500)], from: day(1), to: day(40) });
    const p = await draft(w);
    await patch(w, p.id, { post_kind: 'offer' });
    const r = await patch(w, p.id, { offer_id: stranger });
    expect(r.body.error.message).toBe(MSG.OFFER_NOT_YOURS);
  });

  test('theme tags: at most 1 per group; an unknown tag is refused', async () => {
    const w = await world();
    const p = await draft(w);
    let r = await patch(w, p.id, { theme_tag_ids: await tagIds(['Winter', 'Summer']) });
    expect(r.body.error.message).toBe(MSG.TAGS_ONE_PER_GROUP);
    r = await patch(w, p.id, { theme_tag_ids: ['00000000-0000-4000-8000-000000000000'] });
    expect(r.body.error.message).toBe(MSG.TAG_UNKNOWN);
    r = await patch(w, p.id, { theme_tag_ids: await tagIds(['Winter', 'Office', 'Classic', 'Workwear']) });
    expect(r.body.data.post.theme_tags.map((x) => x.name)).toEqual(['Winter', 'Office', 'Classic', 'Workwear']);
  });

  test('media: her own uploads, landed, one kind, single means one, carousel up to 10, video up to 90 s', async () => {
    const w = await world();
    const p = await draft(w);
    const m = await upload(w, p.id);
    let r = await patch(w, p.id, { media_kind: 'image', media_layout: 'single', media: [m, await upload(w, p.id)] });
    expect(r.body.error.message).toBe(MSG.MEDIA_SINGLE);
    r = await patch(w, p.id, { media_kind: 'image', media_layout: 'carousel', media: [{ ...m, r2_key: `posts/x/${p.id}/a.jpg` }] });
    expect(r.body.error.message).toBe(MSG.MEDIA_NOT_YOURS);
    r = await patch(w, p.id, { media_layout: 'carousel', media: [{ r2_key: m.r2_key.replace(/[^/]+$/, 'never-uploaded.jpg'), mime: 'image/jpeg' }] });
    expect(r.body.error.message).toBe(MSG.MEDIA_NOT_UPLOADED);
    const v = await upload(w, p.id, { mime: 'video/mp4', bytes: 4096 });
    r = await patch(w, p.id, { media_kind: 'image', media_layout: 'carousel', media: [m, v] });
    expect(r.body.error.message).toBe(MSG.MEDIA_KIND_MIX);
    r = await patch(w, p.id, { media_kind: 'video', media_layout: 'single', media: [{ ...v, duration_s: 91 }] });
    expect(r.body.error.message).toBe(MSG.VIDEO_TOO_LONG);
    r = await patch(w, p.id, { media_kind: 'video', media_layout: 'single', media: [{ ...v, duration_s: 45 }] });
    expect(r.status).toBe(200);
    expect(r.body.data.post.media).toEqual([expect.objectContaining({ mime: 'video/mp4', duration_s: 45, size_bytes: 4096 })]);
    const big = await api.post(`${P}/${p.id}/upload-url`, w.cr.token, { content_type: 'video/mp4', size_bytes: 201 * 1024 * 1024 });
    expect(big.body.error.message).toBe(MSG.FILE_TOO_BIG(200));
    const gif = await api.post(`${P}/${p.id}/upload-url`, w.cr.token, { content_type: 'image/gif', size_bytes: 10 });
    expect(gif.body.error.message).toBe(MSG.FILE_TYPE);
  });

  test('product tags on photos are optional; a pin must be a product in the post on a photo slide', async () => {
    const w = await world();
    const p = await readyBundlePost(w);
    let r = await patch(w, p.id, { pins: [{ product_id: w.jeans[0], media_index: 0, x_pct: 40, y_pct: 55 }, { product_id: w.jeans[1], media_index: 1, x_pct: 60, y_pct: 30 }] });
    expect(r.status).toBe(200);
    const byId = Object.fromEntries(r.body.data.post.products.map((x) => [x.id, x.pin]));
    expect(byId[w.jeans[0]]).toEqual({ media_index: 0, x_pct: 40, y_pct: 55 });
    expect(byId[w.jeans[2]]).toBeNull();
    r = await patch(w, p.id, { pins: [{ product_id: w.shirt, media_index: 0, x_pct: 1, y_pct: 1 }] });
    expect(r.body.error.message).toBe(MSG.PIN_BAD);
    r = await patch(w, p.id, { pins: [{ product_id: w.jeans[0], media_index: 5, x_pct: 1, y_pct: 1 }] });
    expect(r.body.error.message).toBe(MSG.PIN_BAD);
  });
});

/* ═══════════════════════════════════════════ review and sending (P11, P12; checks 13–16) */

describe('review and sending (P11, P12; checks 13–16)', () => {
  test('the facets: category from the products, the offer, the band of the costliest item, her theme', async () => {
    const w = await world();
    const p = await readyBundlePost(w);
    const post = await read(w, p.id);
    expect(post.facets).toMatchObject({
      category: ['Men › Bottomwear › Jeans'], offer: 'Bundle · Any 2 for ₹2,999',
      price_band: 'Under ₹2,999', top_price: 2499, theme: 'Winter · Office · Classic',
    });
  });

  test('a discount post is banded by the price shoppers pay; other offers and price posts by the normal price', async () => {
    const w = await world();
    const p = await draft(w);
    await patch(w, p.id, { post_kind: 'offer' });
    await patch(w, p.id, { offer_id: w.discount });
    let r = await patch(w, p.id, { product_ids: [w.shirt] });
    expect(r.body.data.post.facets).toMatchObject({ top_price: 880, price_band: 'Under ₹999' });
    await patch(w, p.id, { offer_id: w.fixed });
    r = await read(w, p.id);
    expect(r.facets).toMatchObject({ top_price: 1400, price_band: 'Under ₹1,999', category: expect.arrayContaining(['Men › Topwear › Jackets', 'Men › Bottomwear › Trousers']) });
  });

  test('nothing is sent incomplete: pick count, tags, media, caption', async () => {
    const w = await world();
    const p = await draft(w);
    await patch(w, p.id, { post_kind: 'offer' });
    await patch(w, p.id, { offer_id: w.bundle });
    await patch(w, p.id, { product_ids: [w.jeans[0]] });
    expect((await send(w, p.id)).body.error.message).toBe(MSG.PICK_AT_LEAST(2));
    await patch(w, p.id, { product_ids: w.jeans.slice(0, 2) });
    expect((await send(w, p.id)).body.error.message).toBe(MSG.TAGS_MIN);
    await patch(w, p.id, { theme_tag_ids: await tagIds(['Casual']) });
    expect((await send(w, p.id)).body.error.message).toBe(MSG.MEDIA_MIN);
    await patch(w, p.id, { media_kind: 'image', media_layout: 'single', media: [await upload(w, p.id)] });
    expect((await send(w, p.id)).body.error.message).toBe(MSG.CAPTION_NEEDED);
    await patch(w, p.id, { caption: 'Denim days' });
    const ok = await send(w, p.id);
    expect(ok.status).toBe(200);
    expect(ok.body.data.post).toMatchObject({ state: 'in_review', can: { edit: false, send: false } });
  });

  test('once sent, nothing can change; it is in the INFLX queue with its collaboration, offer and facets', async () => {
    const w = await world();
    const p = await readyBundlePost(w);
    await send(w, p.id);
    const r = await patch(w, p.id, { caption: 'Changed' });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toBe(MSG.SENT);
    const q = await api.get('/admin/posts?status=submitted', admin.token);
    const mine = q.body.data.posts.find((x) => x.id === p.id);
    expect(mine.v2).toMatchObject({ kind: 'offer', collaboration: { brand_name: expect.any(String), set_name: 'Set A' }, facets: { price_band: 'Under ₹2,999' } });
  });
});

/* ═══════════════════════════════════════════ INFLX decides (P12, P13; checks 17–21) */

describe('INFLX approves or sends back (P12, P13; checks 17–21)', () => {
  test('sent back: she sees why, may change media, caption, products and tags — not the offer — and sends again', async () => {
    const w = await world();
    const p = await readyBundlePost(w);
    await send(w, p.id);
    await sendBack(p.id, 'The video on slide 2 has copyrighted music.');
    let post = await read(w, p.id);
    expect(post).toMatchObject({ state: 'sent_back', sent_back: { reason: 'The video on slide 2 has copyrighted music.', count: 1 }, can: { fix: true, delete: true } });
    const n = await H.notices(w.cr.userId, 'post.rejected');
    expect(n[0].title).toBe(`"${posts.titleOf({ caption: 'Office-ready denim that works past 6 pm. Pick any 2 for ₹2,999' })}" was sent back`);
    expect(n[0].body).toBe('What INFLX said: "The video on slide 2 has copyrighted music."');
    let r = await patch(w, p.id, { offer_id: w.discount });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toBe(MSG.SENT_BACK_ONLY);
    r = await patch(w, p.id, { caption: 'Fixed: original audio', product_ids: w.jeans.slice(0, 2), media: [await upload(w, p.id)], media_layout: 'single' });
    expect(r.status).toBe(200);
    expect((await send(w, p.id)).body.data.post.state).toBe('in_review');
  });

  test('approved before the posting date: "approved", goes live on the date; it counts toward her minimum; she can take it down', async () => {
    const w = await world({ min: 1 });
    let home = (await api.get('/influencers/me/create', w.cr.token)).body.data;
    expect(home.needs).toEqual([expect.objectContaining({ campaign_influencer_id: w.ciId, done: 0, min: 1 })]);
    const p = await readyBundlePost(w);
    await send(w, p.id);
    const a = await approve(p.id);
    expect(a.status).toBe(200);
    let post = await read(w, p.id);
    expect(post).toMatchObject({ state: 'approved', can: { take_down: true, edit: false } });
    expect((await H.notices(w.cr.userId, 'post.approved'))[0].body).toMatch(/^It goes live on \d+ \w{3}, your posting date\.$/);
    home = (await api.get('/influencers/me/create', w.cr.token)).body.data;
    expect(home.needs).toEqual([]);
    expect((await patch(w, p.id, { caption: 'x' })).body.error.message).toBe(MSG.APPROVED_LOCKED);
    const d = await api.post(`${P}/${p.id}/take-down`, w.cr.token);
    expect(d.body.data.post).toMatchObject({ state: 'removed', removed: { reason: 'taken_down', why: 'You took this post down.' } });
  });

  test('after the posting date an approved post is live', async () => {
    const w = await world();
    const p = await readyBundlePost(w);
    await send(w, p.id); await approve(p.id);
    await pastPosting(w);
    expect((await read(w, p.id)).state).toBe('live');
  });

  test('approval re-checks the post: an offer that ended after sending cannot be approved', async () => {
    const w = await world();
    const p = await readyBundlePost(w);
    await send(w, p.id);
    await query(`UPDATE brand_offers SET status = 'ended', ended_at = now() WHERE id = $1`, [w.bundle]);
    const a = await approve(p.id);
    expect(a.status).toBe(422);
    expect(a.body.error.message).toBe(MSG.STALE(MSG.OFFER_ENDED));
  });

  test('drafts and sent-back posts can be deleted; nothing else', async () => {
    const w = await world();
    const d = await draft(w);
    expect((await api.del(`${P}/${d.id}`, w.cr.token)).status).toBe(200);
    const p = await readyBundlePost(w);
    await send(w, p.id);
    const r = await api.del(`${P}/${p.id}`, w.cr.token);
    expect(r.status).toBe(409);
    expect(r.body.error.message).toBe(MSG.CANT_DELETE);
  });
});

/* ═══════════════════════════════════════════ a post's life (P14, P15; checks 22–27) */

describe("a post's life after it is approved (4.9; checks 22–27)", () => {
  async function approvedBundle(w, products) {
    const p = await readyBundlePost(w, products ? { products } : undefined);
    await send(w, p.id); await approve(p.id);
    return p;
  }

  test('the brand ends the offer: the post leaves the shop, she is told why, and the offer page counted it first', async () => {
    const w = await world();
    const p = await approvedBundle(w);
    await pastPosting(w);
    const view = (await api.get(`/brands/me/offers/${w.bundle}`, w.b.token)).body.data;
    expect(view.posts.live).toBe(1);
    expect(view.creators[0].posts).toBe(1);
    const end = await api.post(`/brands/me/offers/${w.bundle}/end`, w.b.token);
    expect(end.body.data.posts_removed).toBe(1);
    const post = await read(w, p.id);
    expect(post.state).toBe('removed');
    expect(post.removed.why).toBe(`The offer "Any 2 Jeans for ₹2,999" ended. Your post promised it, so it can't stay up at full price.`);
    const n = await H.notices(w.cr.userId, 'post.removed');
    expect(n[0].data_json).toMatchObject({ screen: 'post', post_id: p.id });
  });

  // offer-add-products (rules v1.14 §1.10, founder 1 Oct 2026): this used to remove products from
  // an offer a creator has and expect them to leave her posts. That removal is now refused, so her
  // posts keep every product. The engine underneath is still proved directly, as the backstop.
  test('an offer a creator has can\'t lose products: her posts stay whole', async () => {
    const w = await world();
    const keep = await approvedBundle(w, w.jeans.slice(0, 3));
    const other = await approvedBundle(w, w.jeans.slice(2, 4));
    const prev = await api.get(`/brands/me/offers/${w.bundle}/remove-preview?product_ids=${w.jeans[2]},${w.jeans[3]}`, w.b.token);
    expect(prev.status).toBe(409);
    expect(prev.body.error.code).toBe('OFFER_GIVEN');
    const r = await api.post(`/brands/me/offers/${w.bundle}/remove-products`, w.b.token, { product_ids: [w.jeans[2], w.jeans[3]] });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toBe("This offer has been given to 1 creator, so its products can't be changed. To change the deal, end it and build a new one.");
    expect((await read(w, keep.id)).products.map((x) => x.id).sort()).toEqual(w.jeans.slice(0, 3).sort());
    expect((await read(w, other.id)).removed).toBeFalsy();
  });

  test('products that leave an offer leave its posts; a post left empty is removed (the engine)', async () => {
    const w = await world();
    const keep = await approvedBundle(w, w.jeans.slice(0, 3));
    const empty = await approvedBundle(w, w.jeans.slice(2, 4));
    const gone = [w.jeans[2], w.jeans[3]];
    await query(`UPDATE offer_pool_items SET removed_at = now() WHERE offer_id = $1 AND product_id = ANY($2::uuid[])`, [w.bundle, gone]);
    expect(await posts.afterProductsLeftOffer(w.bundle, gone)).toBe(1);
    expect((await read(w, keep.id)).products.map((x) => x.id).sort()).toEqual(w.jeans.slice(0, 2).sort());
    expect((await read(w, empty.id)).removed).toMatchObject({ reason: 'products_removed' });
  });

  test('a product taken off sale leaves her price post; the empty post is removed as unavailable', async () => {
    const w = await world();
    const p = await draft(w);
    await patch(w, p.id, { post_kind: 'price' });
    await patch(w, p.id, { product_ids: [w.free[0]], theme_tag_ids: await tagIds(['Summer']), media_kind: 'image', media_layout: 'single' });
    await patch(w, p.id, { media: [await upload(w, p.id)], caption: 'Linen for the heat' });
    await send(w, p.id); await approve(p.id);
    const r = await api.patch(`/brands/me/products/${w.free[0]}`, w.b.token, { is_active: false });
    expect(r.status).toBeLessThan(300);
    expect((await read(w, p.id)).removed).toMatchObject({ reason: 'unavailable' });
  });

  test('a deleted product leaves her posts too; the empty post is removed and she is told', async () => {
    const w = await world();
    const p = await draft(w);
    await patch(w, p.id, { post_kind: 'price' });
    await patch(w, p.id, { product_ids: [w.free[1]], theme_tag_ids: await tagIds(['Summer']), media_kind: 'image', media_layout: 'single' });
    await patch(w, p.id, { media: [await upload(w, p.id)], caption: 'Tees for days' });
    await send(w, p.id); await approve(p.id);
    const r = await api.del(`/brands/me/products/${w.free[1]}`, w.b.token);
    expect(r.status).toBe(200);
    expect((await read(w, p.id)).removed).toMatchObject({ reason: 'unavailable' });
    expect((await H.notices(w.cr.userId, 'post.removed')).length).toBe(1);
  });

  test('every product sold out removes the post; a new price moves its band', async () => {
    const w = await world();
    const p = await approvedBundle(w, w.jeans.slice(0, 2));
    let r = await api.patch(`/brands/me/products/${w.jeans[0]}`, w.b.token, { price: 3100 });
    expect(r.status).toBeLessThan(300);
    expect((await read(w, p.id)).facets).toMatchObject({ top_price: 3100, price_band: '₹3,000+' });
    await api.patch(`/brands/me/products/${w.jeans[0]}`, w.b.token, { stock: 0 });
    expect((await read(w, p.id)).state).toBe('approved');
    await api.patch(`/brands/me/products/${w.jeans[1]}`, w.b.token, { stock: 0 });
    expect((await read(w, p.id)).removed).toMatchObject({ reason: 'sold_out' });
  });

  test('an offer past its end date: reads show the post removed at once, and the daily sweep makes it final and tells her', async () => {
    const w = await world();
    const p = await approvedBundle(w);
    await query(`UPDATE brand_offers SET starts_on = $2, ends_on = $3 WHERE id = $1`, [w.bundle, day(-10), day(-1)]);
    expect((await read(w, p.id)).state).toBe('removed');
    const job = require('../src/jobs/posts-offer-ended.job');
    const r = await job.run();
    expect(r.posts).toBeGreaterThanOrEqual(1);
    const { rows: [row] } = await query(`SELECT status, removed_reason FROM creator_posts WHERE id = $1`, [p.id]);
    expect(row).toEqual({ status: 'removed', removed_reason: 'offer_ended' });
    expect(await job.run()).toMatchObject({ posts: 0 });
  });

  test('her posts by state, with counts (P14)', async () => {
    const w = await world();
    await draft(w);
    const p = await readyBundlePost(w);
    await send(w, p.id);
    const r = (await api.get(P, w.cr.token)).body.data;
    expect(r.counts).toMatchObject({ draft: 1, in_review: 1, live: 0, removed: 0 });
    expect(r.posts.find((x) => x.id === p.id)).toMatchObject({ title: posts.titleOf({ caption: 'Office-ready denim that works past 6 pm. Pick any 2 for ₹2,999' }), sales_words: 'No sales yet' });
  });
});

/* ═══════════════════════════════════════════ the old paths (checks 28, 29) */

describe('the old composer and the old readers (checks 28, 29)', () => {
  test('the July composer answers 410 with the reason', async () => {
    const w = await world();
    for (const [m, path] of [['get', '/influencers/me/post-scope'], ['post', '/influencers/me/posts/picker'], ['post', '/influencers/me/posts/upload-url'], ['post', '/influencers/me/posts']]) {
      const r = m === 'get' ? await api.get(path, w.cr.token) : await api.post(path, w.cr.token, {});
      expect(r.status).toBe(410);
      expect(r.body.error.message).toBe(MSG.RETIRED);
    }
  });

  // follower-app-v2 (29 Sep): the old follower feed this check guarded is gone with the old shopper
  // app. What remains true: an approved post is not in the shop before its posting date.
  test('the old follower feed is gone; an approved post before its posting date is not in the shop', async () => {
    const w = await world();
    const p = await readyBundlePost(w);
    await send(w, p.id); await approve(p.id);
    const shopper = await createFollowerUser();
    expect((await request(app).get('/v1/follower/posts').set('Authorization', `Bearer ${shopper.token}`)).status).toBe(404);
    const feed = await request(app).post('/v1/follower/feed').send({});
    expect(feed.status).toBe(200);
    expect(feed.body.data.posts.map((x) => x.id)).not.toContain(p.id);
    expect((await request(app).get(`/v1/follower/posts/${p.id}`)).status).toBe(404);
  });
});

/* ═══════════════════════════════════════════ collections (P17–P20; checks 30–33) */

describe('collections (P17–P20; checks 30–33)', () => {
  const C = '/influencers/me/collections';

  test('a collection of posts takes only posts in the shop; it hides itself when none is left; deleting never touches posts', async () => {
    const w = await world();
    const inReview = await readyBundlePost(w);
    await send(w, inReview.id);
    let r = await api.post(C, w.cr.token, { name: 'Goa trip edit', kind: 'posts', items: [{ post_id: inReview.id }] });
    expect(r.body.error.message).toBe('Only your posts that are in the shop can go in a collection.');
    await approve(inReview.id);
    const opt = (await api.get(`${C}/options?kind=posts`, w.cr.token)).body.data;
    expect(opt.posts.map((x) => x.id)).toEqual([inReview.id]);
    r = await api.post(C, w.cr.token, { name: 'Goa trip edit', kind: 'posts', items: [{ post_id: inReview.id }] });
    expect(r.status).toBe(200);
    const col = r.body.data.collection;
    expect(col).toMatchObject({ name: 'Goa trip edit', kind: 'posts', count: 1, in_shop: 1, hidden: false, sales_words: 'No sales yet' });
    await api.post(`/influencers/me/shoppable-posts/${inReview.id}/take-down`, w.cr.token);
    const after = (await api.get(`${C}/${col.id}`, w.cr.token)).body.data.collection;
    expect(after).toMatchObject({ hidden: true, hidden_line: '0 of 1 posts still in the shop' });
    expect(after.items[0]).toMatchObject({ in_shop: false });
    expect((await api.del(`${C}/${col.id}`, w.cr.token)).status).toBe(200);
    expect((await query(`SELECT count(*)::int n FROM creator_posts WHERE id = $1`, [inReview.id])).rows[0].n).toBe(1);
  });

  test('a collection of products is grouped by collaboration and each product remembers it; rename, add, remove; kind stays', async () => {
    const w = await world();
    const opt = (await api.get(`${C}/options?kind=products`, w.cr.token)).body.data;
    expect(opt.groups).toHaveLength(1);
    expect(opt.groups[0]).toMatchObject({ campaign_influencer_id: w.ciId, set_name: 'Set A' });
    const shirt = opt.groups[0].products.find((x) => x.id === w.shirt);
    expect(shirt).toMatchObject({ shopper_price: 880, line: '₹880 with 20% off' });
    expect(opt.groups[0].products.find((x) => x.id === w.free[0]).line).toBe('₹849 · normal price');
    let r = await api.post(C, w.cr.token, { name: 'Under ₹1,000 office', kind: 'products', items: [{ product_id: w.free[0], campaign_influencer_id: w.ciId }] });
    const col = r.body.data.collection;
    expect(col).toMatchObject({ kind: 'products', count: 1, line: '1 product · 1 brand' });
    r = await request(app).patch(`/v1${C}/${col.id}`).set('Authorization', `Bearer ${w.cr.token}`)
      .send({ name: 'Office picks', add: [{ product_id: w.shirt, campaign_influencer_id: w.ciId }] });
    expect(r.body.data.collection).toMatchObject({ name: 'Office picks', count: 2 });
    r = await request(app).patch(`/v1${C}/${col.id}`).set('Authorization', `Bearer ${w.cr.token}`).send({ add: [{ post_id: '00000000-0000-4000-8000-000000000000' }] });
    expect(r.status).toBe(422);
    const first = (await api.get(`${C}/${col.id}`, w.cr.token)).body.data.collection.items[0];
    r = await request(app).patch(`/v1${C}/${col.id}`).set('Authorization', `Bearer ${w.cr.token}`).send({ remove: [first.id] });
    expect(r.body.data.collection.count).toBe(1);
    const other = await H.creator({ name: 'Someone else' });
    expect((await api.get(`${C}/${col.id}`, other.token)).status).toBe(404);
  });

  test('a product she cannot sell is refused', async () => {
    const w = await world();
    const stranger = await H.prod(w.brandId, t.shirts, 'Not given', 500);
    const r = await api.post(C, w.cr.token, { name: 'X', kind: 'products', items: [{ product_id: stranger, campaign_influencer_id: w.ciId }] });
    expect(r.body.error.message).toBe("A product isn't one you can sell any more.");
  });
});

/* ═══════════════════════════════════════════ pure rules (check 34) */

describe('the price band (4.4, 4.6; check 34)', () => {
  test('"under" includes the edge; above ₹2,999 is ₹3,000+', async () => {
    const bands = await posts.priceBands();
    expect(posts.bandFor(bands, 499).label).toBe('Under ₹499');
    expect(posts.bandFor(bands, 500).label).toBe('Under ₹999');
    expect(posts.bandFor(bands, 2999).label).toBe('Under ₹2,999');
    expect(posts.bandFor(bands, 3000).label).toBe('₹3,000+');
    expect(posts.bandFor(bands, null)).toBeNull();
  });
});
