'use strict';

/**
 * follower-app-v2 — the shopper app's server: the feed (Stage A on, Stage B off), circles, posts with
 * the offer applied, search and codes, stores and offers, collections, likes / comments / reports,
 * saves that remember their post, guests and sign-in, Welcome and Profile, and what the app records.
 * Contract: features/follower-app-v2 · Docs/OFFER_TERMS_POSTS_RULES.md v1.7 §4.7, §4.15, §5 · checks in 03-expected-outputs.md
 * Real API, real database; posts made through the Level 3 flow and approved by INFLX (Level 4 codes).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const w10 = require('./helpers/item10');
const { createAdminUser, createFollowerUser } = require('./helpers/factories');
const settings = require('../src/services/platformSettings.service');
const feedSvc = require('../src/services/shopperFeed.service');
const { api, query, day } = H;

let t, admin;
async function fresh() {
  await truncateAll();
  settings._resetCache();
  t = await H.tree();
  await query(`UPDATE category_nodes SET segment = 'Men' WHERE id = ANY($1::uuid[])`, [[t.men, t.bottom, t.top, t.jeans, t.trousers, t.shirts, t.jackets]]);
  admin = await createAdminUser();
}

let seq = 0;
/**
 * A signed Pay for Sale collaboration with its shoot done. `offer`: 'bundle' (Any 2 for ₹2,999) or
 * 'discount' (20% off). `city`: the creator's city (for "near").
 */
async function world({ name = 'Priya Rao', offer = 'bundle', city = null, brandName = null } = {}) {
  seq += 1;
  const b = await H.brand();
  if (brandName) await query(`UPDATE brands SET business_name = $2 WHERE id = $1`, [b.brandId, brandName]);
  const jeans = [await H.prod(b.brandId, t.jeans, `Levi's 511 Slim ${seq}`, 2299), await H.prod(b.brandId, t.jeans, `Wrangler Regular ${seq}`, 1999), await H.prod(b.brandId, t.jeans, `Pepe Straight ${seq}`, 1800)];
  const free = [await H.prod(b.brandId, t.shirts, `Linen shirt ${seq}`, 849)];
  const deal = offer === 'discount'
    ? await H.ready(b.token, { type: 'discount', sub: 'percentage', name: `20% off jeans ${seq}`, cfg: { pct: 20 }, ids: jeans, from: day(-5), to: day(40) })
    : await H.ready(b.token, { type: 'bundle', sub: 'pick_any', name: `Any 2 Jeans ${seq}`, cfg: { pick: 2, price: 2999 }, ids: jeans, from: day(-5), to: day(40) });
  const c = await w10.campaign(b, { name: 'Diwali Denim' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name, cityName: city || undefined });
  const handle = `${name.split(' ')[0].toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`;
  await query(`UPDATE influencers SET instagram_handle = $2, full_name = $3 WHERE id = $1`, [cr.influencerId, handle, name]);
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token,
    { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [deal], productsWithoutOffers: { mode: 'chosen', productIds: free } } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, jeans, free, deal, handle, name };
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
/** An offer post, sent and approved. `tag`: a theme tag name. */
async function post(w, { caption = 'Festive denim', tag = 'Festive', products = null } = {}) {
  const { body } = await api.post(P, w.cr.token, { campaign_influencer_id: w.ciId });
  const id = body.data.post.id;
  const [tg] = (await query(`SELECT id FROM theme_tags WHERE name = $1`, [tag])).rows;
  await patch(w, id, { post_kind: 'offer' });
  await patch(w, id, { offer_id: w.deal });
  await patch(w, id, { product_ids: products || w.jeans.slice(0, 2), theme_tag_ids: [tg.id], media_kind: 'image', media_layout: 'single' });
  await patch(w, id, { media: [await upload(w, id)], caption });
  const s = await api.post(`${P}/${id}/submit`, w.cr.token);
  if (s.status !== 200) throw new Error(`submit: ${JSON.stringify(s.body)}`);
  const a = await api.post(`/admin/posts/${id}/approve`, admin.token);
  if (a.status !== 200) throw new Error(`approve: ${JSON.stringify(a.body)}`);
  return id;
}
/** Moves the set's posting date into the past, so its approved posts are live. */
const goLive = (w, daysAgo = 1) => query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [w.s.id, day(-daysAgo)]);
/** Fixture: makes a post look approved at a given moment (its "newest" order), in hours ago. */
const approvedHoursAgo = (id, h) => query(`UPDATE creator_posts SET approved_at = now() - ($2::int * interval '1 hour') WHERE id = $1`, [id, h]);
const DEV = 'device-test-1';
const feed = (body = {}, { token = null, device = DEV } = {}) => {
  const r = request(app).post('/v1/follower/feed').set('x-device-id', device);
  if (token) r.set('Authorization', `Bearer ${token}`);
  return r.send(body);
};
const get = (path, { token = null, device = DEV } = {}) => {
  const r = request(app).get(`/v1${path}`).set('x-device-id', device);
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};
const ids = (res) => res.body.data.posts.map((p) => p.id);
const seen = (postId, device = DEV, followerId = null, minutesAgo = 5) => query(
  `INSERT INTO post_events (post_id, follower_id, device_id, event_type, surface, created_at) VALUES ($1, $2, $3, 'impression', 'home', now() - ($4::int * interval '1 minute'))`,
  [postId, followerId, device, minutesAgo]);
async function shopper() {
  const f = await createFollowerUser({ name: 'Anusha K' });
  const { rows } = await query(`SELECT id FROM followers WHERE user_id = $1`, [f.user.id]);
  return { token: f.token, userId: f.user.id, followerId: rows[0].id };
}

/* ═══════════════════════════════════════════ 1 · what can appear (checks 1–3) */

describe('what can appear in the feed (checks 1–3)', () => {
  beforeAll(fresh);

  test('only live posts: not before the posting date, not taken down, not after the offer ends, not sold out', async () => {
    const w = await world();
    const a = await post(w, { caption: 'Live one' });
    expect(ids(await feed())).not.toContain(a);                         // approved, posting date ahead
    expect((await get(`/follower/posts/${a}`)).status).toBe(404);
    await goLive(w);
    expect(ids(await feed())).toContain(a);
    const b = await post(w, { caption: 'Sold out one', products: [w.jeans[1], w.jeans[2]] });
    await query(`UPDATE brand_products SET stock = 0 WHERE id = ANY($1::uuid[])`, [[w.jeans[1], w.jeans[2]]]);
    expect(ids(await feed())).not.toContain(b);
    expect(ids(await feed())).toContain(a);                            // one of a's products is still in stock
    await api.post(`${P}/${a}/take-down`, w.cr.token);
    expect(ids(await feed())).not.toContain(a);
    const w2 = await world({ name: 'Sneha Iyer' });
    const c = await post(w2); await goLive(w2);
    expect(ids(await feed())).toContain(c);
    await query(`UPDATE brand_offers SET ends_on = $2 WHERE id = $1`, [w2.deal, day(-1)]);
    expect(ids(await feed())).not.toContain(c);
  });

  test('her Women / Men / Kids choice filters the feed (Unisex always passes); Play is videos only', async () => {
    const w = await world({ name: 'Divya M' });
    const a = await post(w); await goLive(w);
    expect(ids(await feed({ shop_for: ['men'] }))).toContain(a);
    expect(ids(await feed({ shop_for: ['women'] }))).not.toContain(a);
    await query(`UPDATE category_nodes SET segment = 'Unisex' WHERE id = $1`, [t.jeans]);
    expect(ids(await feed({ shop_for: ['women'] }))).toContain(a);
    await query(`UPDATE category_nodes SET segment = 'Men' WHERE id = $1`, [t.jeans]);
    expect(ids(await feed({ mode: 'play' }))).not.toContain(a);
    await query(`UPDATE creator_posts SET media_kind = 'video' WHERE id = $1`, [a]);   // fixture: a video post
    expect(ids(await feed({ mode: 'play' }))).toContain(a);
  });

  test('the old follower feed and the old stores are gone', async () => {
    // Unknown /follower paths ask a guest to sign in first (the checkout routes share /follower), so ask as a shopper.
    const s = await shopper();
    for (const path of ['/follower/home', '/follower/posts', '/follower/wallet', '/follower/discover', '/follower/deals', '/follower/section/offers'])
      expect((await get(path, { token: s.token })).status).toBe(404);
    for (const path of ['/store/priya', '/business/x', '/category/fashion'])
      expect((await get(path)).status).toBe(404);
    for (const path of ['/admin/sections/home', '/admin/concept-templates', '/admin/discover-layout', '/admin/section-library'])
      expect((await get(path, { token: admin.token })).status).toBe(404);
  });
});

/* ═══════════════════════════════════════════ 2 · Stage A order (checks 4–8) */

describe('Stage A: the rules feed (checks 4–8)', () => {
  let A, B, C, a1, a2, b1, c1;
  beforeAll(async () => {
    await fresh();
    A = await world({ name: 'Priya Rao', city: 'Vijayawada' });
    B = await world({ name: 'Sneha Iyer', city: 'Hyderabad' });
    C = await world({ name: 'Meera Das', city: 'Visakhapatnam' });
    a1 = await post(A, { caption: 'A one' }); a2 = await post(A, { caption: 'A two' });
    b1 = await post(B, { caption: 'B one', tag: 'Casual' });
    c1 = await post(C, { caption: 'C one' });
    for (const w of [A, B, C]) await goLive(w, 3);
    // Fixture: these brands have no store branch, so "near" is the creator's city alone.
    await query(`DELETE FROM brand_branches WHERE brand_id = ANY($1::uuid[])`, [[A.brandId, B.brandId, C.brandId]]);
    // newest first: c1 (1h) · a2 (2h) · b1 (3h) · a1 (100h) — all older than "new" (48h) except c1, a2, b1
    await approvedHoursAgo(c1, 60); await approvedHoursAgo(a2, 70); await approvedHoursAgo(b1, 80); await approvedHoursAgo(a1, 100);
  });

  test('everything else: newest first, and never the same creator twice in a row', async () => {
    const r = await feed();
    expect(r.status).toBe(200);
    expect(r.body.data.stage).toBe('A');
    expect(ids(r)).toEqual([c1, a2, b1, a1]);
  });

  test('creators she follows come first (a guest sends her follows from the phone)', async () => {
    const r = await feed({ follows: [B.cr.influencerId] });
    expect(ids(r)[0]).toBe(b1);
  });

  test('then near her: the phone location is used and never stored; the city is the fallback', async () => {
    const s = await shopper();
    // Near Vijayawada (A's city): A's posts come right after follows.
    const r = await feed({ lat: 16.5062, lng: 80.648 }, { token: s.token });
    // Priya (Vijayawada) is near, so her posts lead; "never the same creator twice in a row" puts the
    // newest of the rest (Meera, 303 km) between them; Sneha (250 km, older) comes last.
    expect(r.body.data.posts.map((p) => [p.creator.name, p.near_km])).toEqual([['Priya Rao', 0], ['Meera Das', 303], ['Priya Rao', 0], ['Sneha Iyer', 250]]);
    expect(ids(r)[0]).toBe(a2);
    const { rows: [f] } = await query(`SELECT last_lat, last_lng, area_name FROM followers WHERE id = $1`, [s.followerId]);
    expect(f).toEqual({ last_lat: null, last_lng: null, area_name: null });
    // Location off: her saved city (Hyderabad) puts B first.
    const [hyd] = (await query(`SELECT id FROM ref_cities WHERE name = 'Hyderabad' AND is_offered`)).rows;
    await api.patch('/follower/me/preferences', s.token, { city_id: hyd.id });
    expect(ids(await feed({}, { token: s.token }))[0]).toBe(b1);
  });

  test('the styles she picked move matching posts up a little (one day)', async () => {
    const [casual] = (await query(`SELECT id FROM theme_tags WHERE name = 'Casual'`)).rows;
    const r = await feed({ styles: [casual.id] });
    // b1 (Casual, 80h) lifts past a2 (70h) but not past c1 (60h): 80h − 24h = 56h newer-equivalent.
    expect(ids(r).slice(0, 2)).toEqual([b1, c1]);
  });

  test('what the phone has already shown is not shown again this session; a tapped post can go first', async () => {
    const r = await feed({ served: [c1, a2] });
    expect(ids(r)).toEqual([b1, a1]);
    const s = await feed({ start: a1 });
    expect(ids(s)[0]).toBe(a1);
  });
});

/* ═══════════════════════════════════════════ 3 · fixed rules (checks 9–11) */

describe('the fixed rules (checks 9–11)', () => {
  test('never the same creator twice in a row, when another creator can go between', () => {
    const p = (id, c) => ({ id, influencer_id: c });
    expect(feedSvc.noCreatorTwice([p(1, 'a'), p(2, 'a'), p(3, 'b'), p(4, 'a')]).map((x) => x.id)).toEqual([1, 3, 2, 4]);
    expect(feedSvc.noCreatorTwice([p(1, 'a'), p(2, 'b')], 'a').map((x) => x.id)).toEqual([2, 1]);
    expect(feedSvc.noCreatorTwice([p(1, 'a'), p(2, 'a')]).map((x) => x.id)).toEqual([1, 2]);  // only one creator left
  });

  test('15% of places go to brand-new posts from creators she does not follow', () => {
    const list = Array.from({ length: 20 }, (_, i) => ({ id: i, influencer_id: `c${i}`, fresh: i >= 17 }));
    const out = feedSvc.withNewPlaces(list, (p) => p.fresh, 15, new Set());
    const at = out.map((p, i) => (p.fresh ? i + 1 : null)).filter(Boolean);
    expect(at).toEqual([4, 10, 17]);                            // 3 of 20 = 15%
    expect(feedSvc.withNewPlaces(list, (p) => p.fresh, 15, new Set(['c17', 'c18', 'c19']))).toEqual(list);
  });

  test('never repeat: a seen post waits; when all are seen: caught up, the one seen longest ago first', async () => {
    await fresh();
    const A = await world({ name: 'Priya Rao' });
    const B = await world({ name: 'Sneha Iyer' });
    const a = await post(A); const b = await post(B);
    await goLive(A, 5); await goLive(B, 5);
    await approvedHoursAgo(a, 60); await approvedHoursAgo(b, 70);
    expect(ids(await feed())).toEqual([a, b]);
    await seen(a, DEV, null, 10);
    let r = await feed();
    expect(ids(r)).toEqual([b, a]);
    expect(r.body.data.posts.map((p) => p.again)).toEqual([false, true]);
    expect(r.body.data.caught_up_line).toBe("You're all caught up");
    await seen(b, DEV, null, 2);
    r = await feed();
    expect(ids(r)).toEqual([a, b]);                              // a was seen longest ago
    expect(ids(await feed({}, { device: 'another-phone' }))).toEqual([a, b]);   // another shopper hasn't seen either
    // Past the window it counts as unseen again.
    await query(`UPDATE post_events SET created_at = now() - interval '31 days' WHERE post_id = $1`, [a]);
    expect((await feed()).body.data.posts.find((p) => p.id === a).again).toBe(false);
  });
});

/* ═══════════════════════════════════════════ 4 · a post as the shopper sees it (checks 12–14) */

describe('a post as the shopper sees it (checks 12–14)', () => {
  let W, D, bp, dp;
  beforeAll(async () => {
    await fresh();
    W = await world({ name: 'Sneha Iyer', brandName: 'Urban Threads' });
    D = await world({ name: 'Priya Rao', offer: 'discount', brandName: 'Sri Lakshmi Silks' });
    bp = await post(W, { caption: 'Office-ready denim. Pick any 2' });
    dp = await post(D, { caption: 'Festive sarees in cotton' });
    await goLive(W); await goLive(D);
  });

  test('the offer badge, the applied line, prices after the offer; creator, brand, code and link; never who bought', async () => {
    const d = (await get(`/follower/posts/${dp}`)).body.data;
    expect(d.offer).toMatchObject({ badge: '20% OFF', line: '20% off applied' });
    // Rules v1.12 (6.4): a % comes off each unit, rounded to the rupee: 20% off ₹2,299 → ₹1,839.
    expect(d.products[0]).toMatchObject({ price: 2299, shopper_price: 1839, struck: true, in_stock: true });
    expect(d.creator).toMatchObject({ name: 'Priya Rao' });
    expect(d.brand).toMatchObject({ name: 'Sri Lakshmi Silks' });
    expect(d.code).toMatch(/^[BCDFGHJKMNPQRSTVWXYZ2-9]{6}$/);
    expect(d.share_url).toBe(`https://inflx.in/p/${d.code}`);
    expect(d.counts).toEqual({ likes: 0, comments: 0, shares: 0, saves: 0 });
    expect(JSON.stringify(d)).not.toMatch(/"sales"|commission|buyer/);
    const b = (await get(`/follower/posts/${bp}`)).body.data;
    expect(b.offer).toMatchObject({ badge: 'ANY 2 FOR ₹2,999', line: 'Any 2 for ₹2,999' });
    expect(b.products.every((p) => p.shopper_price === p.price && !p.struck)).toBe(true);
    expect(b.offer.how).toMatch(/pick any 2/);
  });

  test('an approved post\'s media link is the same every time and cacheable; a draft\'s stays private (4.7)', async () => {
    const d = (await get(`/follower/posts/${dp}`)).body.data;
    const path = d.media[0].url.replace(/^https?:\/\/[^/]+/, '');   // the host is empty in tests
    const a = await request(app).get(path);
    const b = await request(app).get(path);
    expect(a.status).toBe(302);
    expect(a.headers.location).toBe(b.headers.location);
    expect(a.headers['cache-control']).toBe('public, max-age=10800');
    const { body } = await api.post(P, D.cr.token, { campaign_influencer_id: D.ciId });
    const draft = body.data.post.id;
    await patch(D, draft, { post_kind: 'offer' });
    await patch(D, draft, { offer_id: D.deal });
    await patch(D, draft, { product_ids: D.jeans.slice(0, 1), media_kind: 'image', media_layout: 'single' });
    await patch(D, draft, { media: [await upload(D, draft)] });
    const { rows: [m] } = await query(`SELECT id FROM post_media WHERE post_id = $1`, [draft]);
    const c = await request(app).get(`/v1/media/post/${m.id}`);
    expect(c.status).toBe(302);
    expect(c.headers['cache-control']).toBe('private, no-store');
  });

  test('a photo opened: that creator first, then similar posts, then the rest — it never dead-ends', async () => {
    const x = await post(W, { caption: 'Second from Sneha' });
    const m = (await get(`/follower/posts/${bp}/more`)).body.data;
    expect(m.posts[0]).toMatchObject({ id: x, from: 'creator' });
    expect(m.posts.map((p) => p.from)).toContain('similar');     // same category (Jeans)
    expect(m.posts.map((p) => p.id)).not.toContain(bp);
  });

  test('a code: exactly that post, any case, counted as a "Post code" visit; unknown and upcoming say so', async () => {
    const { rows: [c] } = await query(`SELECT post_code FROM creator_posts WHERE id = $1`, [dp]);
    const r = (await get(`/follower/code/${c.post_code.toLowerCase()}`)).body.data;
    expect(r).toMatchObject({ state: 'live', post: { id: dp } });
    const { rows: v } = await query(`SELECT channel, device_id FROM link_visits WHERE post_id = $1`, [dp]);
    expect(v).toEqual([{ channel: 'code', device_id: DEV }]);
    // A post link opened inside the app (inflx.in/p/<code>/wa) counts under its channel, not as a typed code.
    expect((await get(`/follower/code/${c.post_code}?ch=wa`)).body.data.post.id).toBe(dp);
    expect((await get(`/follower/code/${c.post_code}?ch=tiktok`)).body.data.state).toBe('live');
    const { rows: v2 } = await query(`SELECT channel FROM link_visits WHERE post_id = $1 ORDER BY id`, [dp]);
    expect(v2.map((x) => x.channel)).toEqual(['code', 'wa', 'o']);
    expect((await get('/follower/code/ZZZZZZ')).body.data).toMatchObject({ state: 'unknown', message: 'No post has this code. Check the letters and numbers.' });
    const W2 = await world({ name: 'Rama K' });
    const up = await post(W2);
    const { rows: [u] } = await query(`SELECT post_code FROM creator_posts WHERE id = $1`, [up]);
    expect((await get(`/follower/code/${u.post_code}`)).body.data).toMatchObject({ state: 'upcoming' });
    expect((await get(`/follower/code/${u.post_code}`)).body.data.message).toMatch(/^This post goes live on \d+ [A-Z][a-z]{2}$/);
  });

  test('search: a code opens that post; names find creators, brands and posts that are live', async () => {
    const { rows: [c] } = await query(`SELECT post_code FROM creator_posts WHERE id = $1`, [bp]);
    expect((await get(`/follower/search?q=${c.post_code}`)).body.data.code_match).toMatchObject({ state: 'live', post: { id: bp } });
    const s = (await get('/follower/search?q=sneha')).body.data;
    expect(s.creators.map((x) => x.name)).toEqual(['Sneha Iyer']);
    expect((await get('/follower/search?q=urban')).body.data.brands.map((x) => x.name)).toEqual(['Urban Threads']);
    expect((await get('/follower/search?q=festive%20sarees')).body.data.posts.map((x) => x.id)).toEqual([dp]);
    expect((await get('/follower/search?q=Rama')).body.data.creators).toEqual([]);   // no live post yet
  });
});

/* ═══════════════════════════════════════════ 5 · likes, comments, reports (checks 15–17) */

describe('likes, comments and reports (checks 15–17)', () => {
  let W, p, s;
  beforeAll(async () => {
    await fresh();
    W = await world(); p = await post(W); await goLive(W);
    s = await shopper();
  });

  test('liking needs sign-in; a like counts and shows as hers', async () => {
    expect((await request(app).post(`/v1/follower/posts/${p}/like`)).status).toBe(401);
    const r = await api.post(`/follower/posts/${p}/like`, s.token);
    expect(r.body.data).toEqual({ liked: true, likes: 1 });
    const d = (await get(`/follower/posts/${p}`, { token: s.token })).body.data;
    expect(d.mine.liked).toBe(true);
    expect(d.counts.likes).toBe(1);
    expect((await api.del(`/follower/posts/${p}/like`, s.token)).body.data).toEqual({ liked: false, likes: 0 });
  });

  test('anyone reads comments, newest first; a guest is asked to sign in; up to 300 characters', async () => {
    expect((await request(app).post(`/v1/follower/posts/${p}/comments`).send({ body: 'hi' })).status).toBe(401);
    await api.post(`/follower/posts/${p}/comments`, s.token, { body: 'Is the maroon one in cotton?' });
    await api.post(`/follower/posts/${p}/comments`, s.token, { body: 'Love this' });
    const g = (await get(`/follower/posts/${p}/comments`)).body.data;
    expect(g.comments.map((c) => c.body)).toEqual(['Love this', 'Is the maroon one in cotton?']);
    expect(g.comments[0]).toMatchObject({ author: { name: 'Anusha K', initials: 'AK', creator: false }, ago: 'now', can_report: true });
    expect(g.sign_in).toEqual({ title: 'Sign in to like and comment', body: 'Your likes and comments are public. Saving and following work without signing in.' });
    const long = await api.post(`/follower/posts/${p}/comments`, s.token, { body: 'x'.repeat(301) });
    expect(long.status).toBe(422);
    expect(long.body.error.message).toBe('Keep a comment under 300 characters.');
    expect((await api.post(`/follower/posts/${p}/comments`, s.token, { body: '   ' })).body.error.message).toBe('Write something first.');
    expect((await get(`/follower/posts/${p}`)).body.data.counts.comments).toBe(2);
  });

  test('any comment can be reported; INFLX admin removes it or keeps it', async () => {
    const other = await shopper();
    const { comments: [c] } = (await get(`/follower/posts/${p}/comments`)).body.data;
    expect((await api.post(`/follower/comments/${c.id}/report`, s.token)).status).toBe(422);        // her own
    expect((await api.post(`/follower/comments/${c.id}/report`, other.token)).body.data).toEqual({ reported: true, message: 'Thanks. INFLX will look at this comment.' });
    const q = (await api.get('/admin/shopper/comments', admin.token)).body.data.comments;
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ id: c.id, body: 'Love this', reports: 1, author: 'Anusha K' });
    await api.post(`/admin/shopper/comments/${c.id}/decide`, admin.token, { decision: 'removed' });
    expect((await get(`/follower/posts/${p}/comments`)).body.data.comments.map((x) => x.body)).toEqual(['Is the maroon one in cotton?']);
    expect((await api.get('/admin/shopper/comments', admin.token)).body.data.comments).toEqual([]);
    const { comments: [k] } = (await get(`/follower/posts/${p}/comments`)).body.data;
    await api.post(`/follower/comments/${k.id}/report`, other.token);
    await api.post(`/admin/shopper/comments/${k.id}/decide`, admin.token, { decision: 'kept' });
    expect((await get(`/follower/posts/${p}/comments`)).body.data.total).toBe(1);
    expect((await api.get('/admin/shopper/comments', admin.token)).body.data.comments).toEqual([]);
  });
});

/* ═══════════════════════════════════════════ 6 · saved (checks 18–20) */

describe('saved posts and products (checks 18–20)', () => {
  let W, W2, p, p2, s;
  beforeAll(async () => {
    await fresh();
    W = await world({ name: 'Priya Rao', offer: 'discount' });
    p = await post(W, { products: [W.jeans[0], W.jeans[1]] }); await goLive(W);
    // Another creator's post with the same product, for "live in other posts".
    W2 = await world({ name: 'Divya M' });
    s = await shopper();
  });

  test('a saved product remembers its post and that post\'s offer; it must come from a post (P1)', async () => {
    expect((await api.post('/follower/saved/products', s.token, { product_id: W.jeans[0] })).status).toBe(422);
    expect((await api.post('/follower/saved/products', s.token, { product_id: W.free[0], post_id: p })).body.error.message).toBe("That product isn't in this post.");
    await api.post('/follower/saved/products', s.token, { product_id: W.jeans[0], post_id: p });
    await api.post(`/follower/posts/${p}/save`, s.token);
    const r = (await api.get('/follower/saved', s.token)).body.data;
    expect(r.posts.map((x) => x.id)).toEqual([p]);
    expect(r.products[0]).toMatchObject({ product_id: W.jeans[0], post_id: p, available: true, shopper_price: 1839, struck: true });
    expect(r.products[0].from).toMatch(/^From Priya Rao's post · 20% off till \d+ [A-Z][a-z]{2}$/);
    expect((await get(`/follower/posts/${p}`, { token: s.token })).body.data.mine).toMatchObject({ saved: true, saved_products: [W.jeans[0]] });
  });

  test('when the post leaves the shop: "No longer available with this offer" and the other live posts with it', async () => {
    await api.post(`${P}/${p}/take-down`, W.cr.token);
    const r = (await api.get('/follower/saved', s.token)).body.data;
    expect(r.posts).toEqual([]);                                    // a saved post that left the shop isn't shown
    expect(r.products[0]).toMatchObject({ available: false, other_posts: [], other_line: null });
    expect(r.products[0].gone_line).toMatch(/^No longer available with this offer\. Priya Rao's post ended on \d+ [A-Z][a-z]{2}\.$/);
  });

  test('a guest keeps saves on the phone; the server reads them back in the same shapes', async () => {
    const W3 = await world({ name: 'Meera Das' });
    const q = await post(W3); await goLive(W3);
    const r = await request(app).post('/v1/follower/saved/resolve').set('x-device-id', 'guest-1')
      .send({ posts: [q], products: [{ product_id: W3.jeans[0], post_id: q }] });
    expect(r.body.data.posts.map((x) => x.id)).toEqual([q]);
    expect(r.body.data.products[0]).toMatchObject({ available: true, post_id: q });
    expect((await request(app).post(`/v1/follower/posts/${q}/save`)).status).toBe(401);
  });
});

/* ═══════════════════════════════════════════ 7 · guests, sign-in, follows (checks 21–22) */

describe('guests, sign-in and follows (checks 21–22)', () => {
  test('at sign-in her follows, saves and what she did as a guest move to her account', async () => {
    await fresh();
    const W = await world({ name: 'Priya Rao' });
    const p = await post(W); await goLive(W);
    await request(app).post('/v1/follower/events').set('x-device-id', 'guest-9')
      .send({ device_id: 'guest-9', events: [{ post_id: p, event_type: 'impression', surface: 'home' }, { post_id: p, event_type: 'dwell', surface: 'home', dwell_ms: 12000 }] });
    const s = await shopper();
    const r = await request(app).post('/v1/follower/me/merge').set('Authorization', `Bearer ${s.token}`).set('x-device-id', 'guest-9')
      .send({ follows: [W.cr.influencerId], saved_posts: [p], saved_products: [{ product_id: W.jeans[0], post_id: p }] });
    expect(r.body.data.moved).toEqual({ follows: 1, saved_posts: 1, saved_products: 1, events: 2 });
    expect((await api.get('/follower/following', s.token)).body.data.creators.map((c) => c.name)).toEqual(['Priya Rao']);
    const again = await request(app).post('/v1/follower/me/merge').set('Authorization', `Bearer ${s.token}`).set('x-device-id', 'guest-9')
      .send({ follows: [W.cr.influencerId], saved_posts: [p] });
    expect(again.body.data.moved).toEqual({ follows: 0, saved_posts: 0, saved_products: 0, events: 0 });
    const { rows } = await query(`SELECT count(*)::int AS n FROM post_events WHERE follower_id = $1`, [s.followerId]);
    expect(rows[0].n).toBe(2);
  });

  test('follow and unfollow; her store shows INFLX followers and whether she follows', async () => {
    const W = await world({ name: 'Sneha Iyer' });
    const p = await post(W); await goLive(W);
    const s = await shopper();
    expect((await api.post('/follower/follows', s.token, { influencer_id: W.cr.influencerId })).body.data).toEqual({ following: true, followers: 1 });
    expect((await get(`/follower/creators/${W.cr.influencerId}`, { token: s.token })).body.data).toMatchObject({ followers: 1, following: true });
    expect((await get(`/follower/creators/${W.cr.influencerId}`)).body.data.following).toBe(false);
    expect((await api.del(`/follower/follows/${W.cr.influencerId}`, s.token)).body.data).toEqual({ following: false, followers: 0 });
    expect(p).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════ 8 · stores, offers, collections (checks 23–26) */

describe('stores, offers and collections (checks 23–26)', () => {
  let A, B, a1, a2, b1;
  beforeAll(async () => {
    await fresh();
    A = await world({ name: 'Priya Rao', brandName: 'Sri Lakshmi Silks', offer: 'discount' });
    a1 = await post(A, { caption: 'Photo one' }); a2 = await post(A, { caption: 'Video one' });
    await query(`UPDATE creator_posts SET media_kind = 'video' WHERE id = $1`, [a2]);   // fixture: a video post
    await goLive(A);
    B = await world({ name: 'Sneha Iyer' });
    b1 = await post(B); await goLive(B);
  });

  test('creator store: details, brands she worked with, categories she posted in, Posts / Videos / Collections', async () => {
    const s = (await get(`/follower/creators/${A.handle}`)).body.data;
    expect(s.creator).toMatchObject({ name: 'Priya Rao', handle: A.handle });
    expect(s.brands.map((b) => b.name)).toEqual(['Sri Lakshmi Silks']);
    expect(s.categories.map((c) => c.name)).toEqual(['Jeans']);
    expect(s.tabs).toEqual({ posts: 2, videos: 1, collections: 0 });
    expect((await get(`/follower/creators/${A.cr.influencerId}/posts?tab=videos`)).body.data.posts.map((p) => p.id)).toEqual([a2]);
    expect((await get(`/follower/creators/${A.cr.influencerId}/posts?category=${t.shirts}`)).body.data.posts).toEqual([]);
  });

  test('a collection opens with its items; products sell with their own offer (M6); a hidden one is not listed', async () => {
    const c = await api.post('/influencers/me/collections', A.cr.token, { name: 'My Dasara picks', kind: 'products', items: [{ product_id: A.jeans[0], campaign_influencer_id: A.ciId }, { product_id: A.free[0], campaign_influencer_id: A.ciId }] });
    expect(c.status).toBe(200);
    const id = c.body.data.collection.id;
    const list = (await get(`/follower/creators/${A.cr.influencerId}/collections`)).body.data.collections;
    expect(list).toEqual([expect.objectContaining({ id, name: 'My Dasara picks', kind: 'products', count: 2 })]);
    const o = (await get(`/follower/collections/${id}`)).body.data;
    expect(o.products.map((p) => [p.name.replace(/ \d+$/, ''), p.shopper_price, p.struck])).toEqual([["Levi's 511 Slim", 1839, true], ['Linen shirt', 849, false]]);
    await query(`UPDATE brand_products SET is_active = false WHERE id = ANY($1::uuid[])`, [[A.jeans[0], A.free[0]]]);
    expect((await get(`/follower/creators/${A.cr.influencerId}/collections`)).body.data.collections).toEqual([]);
    await query(`UPDATE brand_products SET is_active = true WHERE id = ANY($1::uuid[])`, [[A.jeans[0], A.free[0]]]);
  });

  test('brand store: only its posts, its categories and creators; the Offers button leads to posts', async () => {
    const s = (await get(`/follower/brands/${A.brandId}`)).body.data;
    expect(s.brand.name).toBe('Sri Lakshmi Silks');
    expect(s.line).toMatch(/1 creator · 2 live posts$/);
    expect(s.creators.map((c) => c.name)).toEqual(['Priya Rao']);
    expect(s.categories.map((c) => c.name)).toEqual(['Jeans']);
    const posts = (await get(`/follower/brands/${A.brandId}/posts`)).body.data.posts.map((p) => p.id);
    expect(posts.sort()).toEqual([a1, a2].sort());
    const o = (await get(`/follower/brands/${A.brandId}/offers`)).body.data;
    expect(o.types.map((x) => x.label)).toEqual(['BOGO', 'Bundle', 'Discount', 'Buy more save more', 'Free gift']);
    expect(o.offers).toHaveLength(1);
    expect(o.offers[0]).toMatchObject({ id: A.deal, badge: '20% OFF', posts: 2, creators: 1 });
    expect(o.offers[0].line).toMatch(/^Till \d+ [A-Z][a-z]{2} · in 2 posts$/);
    expect((await get(`/follower/brands/${A.brandId}/offers?type=bogo`)).body.data.offers).toEqual([]);
    expect((await get(`/follower/brands/${A.brandId}/posts?offer=${A.deal}`)).body.data.posts).toHaveLength(2);
    // An offer with no live post isn't listed.
    await api.post(`${P}/${a1}/take-down`, A.cr.token); await api.post(`${P}/${a2}/take-down`, A.cr.token);
    expect((await get(`/follower/brands/${A.brandId}/offers`)).body.data.offers).toEqual([]);
    expect(b1).toBeTruthy();
  });

  test('Home circles: followed creators first; a ring for new posts since her last visit, ringed first', async () => {
    const r = (await get(`/follower/circles?follows=${B.cr.influencerId}`)).body.data;
    expect(r.creators.map((c) => c.name)).toEqual(['Sneha Iyer']);          // Priya's posts are all taken down
    expect(r.creators[0]).toMatchObject({ following: true, ring: false });
    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    expect((await get(`/follower/circles?since=${since}`)).body.data.creators[0].ring).toBe(true);
    expect(r.brands.map((b) => b.id)).toEqual([B.brandId]);
  });
});

/* ═══════════════════════════════════════════ 9 · Welcome and Profile (checks 27–28) */

describe('Welcome and Profile (checks 27–28)', () => {
  test('Welcome: Women / Men / Kids, the eight styles, the offered cities, the location line', async () => {
    const w = (await get('/follower/welcome')).body.data;
    expect(w.shop_for.map((x) => x.label)).toEqual(['Women', 'Men', 'Kids']);
    expect(w.styles.map((x) => x.name)).toEqual(['Festive', 'Casual', 'Korean Style', 'Office', 'Street Style', 'Elegant', 'Minimal', 'Boho']);
    const { rows: [n] } = await query(`SELECT count(*)::int AS n FROM ref_cities WHERE is_offered AND lat IS NOT NULL`);
    expect(w.cities).toHaveLength(n.n);
    expect(w.location_line).toBe("We use your phone's location to show creators and stores near you. We never store it.");
  });

  test('Profile: her choices are saved and checked; orders, following, city, what she shops for', async () => {
    const s = await shopper();
    const [vja] = (await query(`SELECT id FROM ref_cities WHERE name = 'Vijayawada' AND is_offered`)).rows;
    const tags = (await query(`SELECT id, name FROM theme_tags WHERE name IN ('Festive', 'Korean Style') ORDER BY name`)).rows;
    expect((await api.patch('/follower/me/preferences', s.token, { shop_for: ['women', 'pets'] })).body.error.message).toBe('Choose Women, Men or Kids.');
    expect((await api.patch('/follower/me/preferences', s.token, { city_id: 999999 })).body.error.message).toBe('Pick a city from the list.');
    const r = (await api.patch('/follower/me/preferences', s.token, { city_id: vja.id, shop_for: ['women'], style_tag_ids: tags.map((x) => x.id), welcomed: true })).body.data;
    expect(r).toMatchObject({ name: 'Anusha K', city: { id: vja.id, name: 'Vijayawada' }, shop_for: ['women'], welcomed: true, following: 0, orders_on_the_way: 0 });
    expect(r.rows).toEqual({ orders: 'No orders yet', following: '0 creators', city: 'Vijayawada', shop_for: 'Women · Festive, Korean Style' });
    expect(r.phone).toMatch(/^\+91 \d{3}••• ••\d{3}$/);
    expect((await api.get('/follower/me/profile', s.token)).body.data.city.name).toBe('Vijayawada');
  });
});

/* ═══════════════════════════════════════════ 10 · recording, learning feed, admin (checks 29–32) */

describe('what the app records, the learning feed and its switch (checks 29–32)', () => {
  test('the new events are accepted; an unknown one refuses the whole batch', async () => {
    await fresh();
    const W = await world(); const p = await post(W); await goLive(W);
    const ok = await request(app).post('/v1/follower/events').send({ device_id: 'd1', events: [
      { post_id: p, event_type: 'impression', surface: 'home' }, { post_id: p, event_type: 'watch', surface: 'play', dwell_ms: 8000, meta: { of_s: 30 } },
      { post_id: p, event_type: 'buffer', surface: 'play', dwell_ms: 900 }, { post_id: p, event_type: 'tap_brand', surface: 'post' },
      { post_id: p, event_type: 'save_product', surface: 'post', product_id: W.jeans[0] }] });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/v1/follower/events').send({ device_id: 'd1', events: [{ post_id: p, event_type: 'teleport', surface: 'home' }] });
    expect(bad.status).toBe(422);
    const { rows: [n] } = await query(`SELECT count(*)::int AS n FROM post_events WHERE post_id = $1`, [p]);
    expect(n.n).toBe(5);
  });

  test('the learning feed is off by default; when scored, what she does lifts that creator', async () => {
    const A = await world({ name: 'Priya Rao' }); const B = await world({ name: 'Sneha Iyer' });
    const a = await post(A); const b = await post(B);
    await goLive(A, 5); await goLive(B, 5);                          // live since 5 days; approvals below decide "newest"
    await approvedHoursAgo(a, 80); await approvedHoursAgo(b, 60);
    expect((await feed({}, { device: 'd2' })).body.data.stage).toBe('A');
    const mine = (res) => ids(res).filter((x) => x === a || x === b);
    expect(mine(await feed({}, { device: 'd2' }))).toEqual([b, a]);
    // She likes and saves Priya's posts a lot → Stage B puts Priya first.
    for (const type of ['like', 'save', 'tap_shop', 'complete']) {
      await query(`INSERT INTO post_events (post_id, device_id, event_type, surface) VALUES ($1, 'd2', $2, 'home')`, [a, type]);
    }
    await api.patch('/admin/platform-settings', admin.token, { feed_learning_on: 1 });
    settings._resetCache();
    const r = await feed({ served: [] }, { device: 'd2' });
    expect(r.body.data.stage).toBe('B');
    expect(mine(r)).toEqual([a, b]);
    expect(r.body.data.posts.find((x) => x.id === a).score.dial.does).toBe(1);
    await api.patch('/admin/platform-settings', admin.token, { feed_learning_on: 0 });
    settings._resetCache();
  });

  test('the hourly performance numbers, the readiness panel and the preview', async () => {
    const r = await feedSvc.refreshPerformance();
    expect(r.posts).toBeGreaterThan(0);
    const { rows } = await query(`SELECT seen, shop_taps, saves, likes, completes, score FROM post_performance ORDER BY score DESC LIMIT 1`);
    expect(Number(rows[0].score)).toBeGreaterThan(0);
    const ready = (await api.get('/admin/shopper/feed/readiness', admin.token)).body.data;
    expect(ready).toMatchObject({ learning_on: false });
    expect(ready.line).toMatch(/^\d+ shoppers? with 20\+ actions each · [\d,]+ actions in \d+ days?$/);
    const s = await shopper();
    const { rows: [u] } = await query(`SELECT phone FROM users WHERE id = $1`, [s.userId]);
    const pv = (await api.get(`/admin/shopper/feed/preview?phone=${encodeURIComponent(u.phone)}`, admin.token)).body.data;
    expect(pv.found).toBe(true);
    expect(pv.today.length).toBeGreaterThan(0);
    expect(pv.learning.length).toBe(pv.today.length);
    expect((await api.get('/admin/shopper/feed/preview?phone=9999999999', admin.token)).body.data).toEqual({ found: false });
  });

  test('the feed settings are on the Platform settings page with their ranges; app config still saves', async () => {
    const all = (await api.get('/admin/platform-settings', admin.token)).body.data;
    const keys = JSON.stringify(all);
    for (const k of ['feed_near_km', 'feed_new_share_pct', 'feed_new_hours', 'feed_repeat_days', 'feed_learning_on', 'feed_w_does', 'feed_w_recent', 'feed_w_near', 'feed_w_performs']) expect(keys).toContain(k);
    expect((await api.patch('/admin/platform-settings', admin.token, { feed_near_km: 1 })).status).toBe(422);
    const c = await api.patch('/admin/app-config', admin.token, { config: { video_sound_default: true } });
    expect(c.body.data.config.video_sound_default).toBe(true);
    expect((await get('/follower/app-config')).body.data.config.video_sound_default).toBe(true);
  });
});
