'use strict';

/**
 * post-links-codes — post codes, post / store / collection links, visits, stats, the brand's list (Level 4).
 * Contract: features/post-links-codes · Docs/OFFER_TERMS_POSTS_RULES.md §4.14 · checks in 03-expected-outputs.md.
 * Real API, real database; posts made through the Level 3 flow with real signed uploads.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const w10 = require('./helpers/item10');
const { createAdminUser, createFollowerUser } = require('./helpers/factories');
const links = require('../src/services/postLinks.service');
const { api, query, day } = H;

let t, admin;
beforeAll(async () => {
  await truncateAll();
  t = await H.tree();
  admin = await createAdminUser();
});

/** A signed Pay for Sale collaboration with its shoot done: a pick-any bundle and two products without offers. */
async function world({ handle } = {}) {
  const b = await H.brand();
  const jeans = [await H.prod(b.brandId, t.jeans, "Levi's 511 Slim", 2299), await H.prod(b.brandId, t.jeans, 'Wrangler Regular', 1999), await H.prod(b.brandId, t.jeans, 'Pepe Straight', 1799)];
  const free = [await H.prod(b.brandId, t.shirts, 'Linen shirt · Sage', 849)];
  const bundle = await H.ready(b.token, { type: 'bundle', sub: 'pick_any', name: 'Any 2 Jeans for ₹2,999', cfg: { pick: 2, price: 2999 }, ids: jeans, from: day(1), to: day(40) });
  const c = await w10.campaign(b, { name: 'Diwali Denim' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: 'Priya Rao' });
  const h = handle || `priya_${Math.random().toString(36).slice(2, 8)}`;
  await query(`UPDATE influencers SET instagram_handle = $2 WHERE id = $1`, [cr.influencerId, h]);
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token,
    { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [bundle], productsWithoutOffers: { mode: 'chosen', productIds: free } } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, jeans, free, bundle, handle: h };
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
async function sentPost(w, caption = 'Festive Sarees') {
  const { body } = await api.post(P, w.cr.token, { campaign_influencer_id: w.ciId });
  const id = body.data.post.id;
  const [tag] = (await query(`SELECT id FROM theme_tags WHERE name = 'Festive'`)).rows;
  await patch(w, id, { post_kind: 'offer' });
  await patch(w, id, { offer_id: w.bundle });
  await patch(w, id, { product_ids: w.jeans.slice(0, 2), theme_tag_ids: [tag.id], media_kind: 'image', media_layout: 'single' });
  await patch(w, id, { media: [await upload(w, id)], caption });
  const s = await api.post(`${P}/${id}/submit`, w.cr.token);
  if (s.status !== 200) throw new Error(`submit: ${JSON.stringify(s.body)}`);
  return id;
}
const approve = (id) => api.post(`/admin/posts/${id}/approve`, admin.token);
const livePosting = (w) => query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [w.s.id, day(-1)]);
const codeOf = async (id) => (await query(`SELECT post_code FROM creator_posts WHERE id = $1`, [id])).rows[0].post_code;
const tap = (path, headers = {}) => request(app).get(`/v1/links${path}`).set(headers);
const visits = async (postId) => (await query(`SELECT channel, real_source FROM link_visits WHERE post_id = $1 ORDER BY id`, [postId])).rows;

/* ═══════════════════════════════════════════ codes (checks 1–4) */

describe('a post code (checks 1–4)', () => {
  test('none while in review; one at approval: 6 characters, no vowels, no look-alikes; it never changes', async () => {
    const w = await world();
    const id = await sentPost(w);
    expect(await codeOf(id)).toBeNull();
    const share = await api.get(`${P}/${id}/share`, w.cr.token);
    expect(share.status).toBe(409);
    expect(share.body.error.message).toBe('A post gets its code and links when INFLX approves it.');
    await approve(id);
    const code = await codeOf(id);
    expect(code).toMatch(/^[BCDFGHJKMNPQRSTVWXYZ2-9]{6}$/);
    expect((await api.get(`${P}/${id}`, w.cr.token)).body.data.post.code).toBe(code);
    await api.post(`${P}/${id}/take-down`, w.cr.token);
    expect(await codeOf(id)).toBe(code);
  });

  test('every code is unique (the database refuses a second)', async () => {
    const w = await world();
    const a = await sentPost(w, 'One'); const b = await sentPost(w, 'Two');
    await approve(a); await approve(b);
    await expect(query(`UPDATE creator_posts SET post_code = $2 WHERE id = $1`, [b, await codeOf(a)])).rejects.toThrow();
    await expect(query(`UPDATE creator_posts SET post_code = 'KAEIOU' WHERE id = $1`, [b])).rejects.toThrow();
  });

  test('share (approved, before the posting date): the code, the caption line, five links, "goes live on"', async () => {
    const w = await world();
    const id = await sentPost(w, 'Festive kurtis');
    await approve(id);
    const code = await codeOf(id);
    const s = (await api.get(`${P}/${id}/share`, w.cr.token)).body.data;
    expect(s).toMatchObject({ code, state: 'approved', goes_live_on: day(12), caption_line: `Shop this look on INFLX: search code ${code}` });
    expect(s.links.map((l) => [l.label, l.display, l.where])).toEqual([
      ['Instagram', `inflx.in/p/${code}/ig`, 'story link sticker'],
      ['YouTube', `inflx.in/p/${code}/yt`, 'description or pinned comment'],
      ['WhatsApp', `inflx.in/p/${code}/wa`, 'status, chats, groups'],
      ['Facebook', `inflx.in/p/${code}/fb`, 'post or story'],
      ['Other', `inflx.in/p/${code}/o`, 'X, LinkedIn, Telegram, SMS'],
    ]);
    expect(s.links[0].url).toBe(`https://inflx.in/p/${code}/ig`);
    expect(s.where.map((x) => x.title)).toEqual(['Reel or post caption · Instagram, Facebook', 'Story · Instagram, Facebook', 'Bio · Instagram, YouTube', 'YouTube video or Short', 'WhatsApp', 'Anywhere else']);
  });

  test("another creator can't read a post's share or stats", async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id);
    const other = await H.creator({ name: 'Asha' });
    expect((await api.get(`${P}/${id}/share`, other.token)).status).toBe(404);
    expect((await api.get(`${P}/${id}/stats`, other.token)).status).toBe(404);
  });
});

/* ═══════════════════════════════════════════ what a link opens, and visits (checks 5–10) */

describe('what a post link opens, and the visits it counts (checks 5–10)', () => {
  test('before the posting date: "goes live on", her store; the ending is the channel; a lower-case code works', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id);
    const code = await codeOf(id);
    const r = await tap(`/p/${code.toLowerCase()}?ch=ig`, { 'x-visitor-ua': 'Mozilla/5.0 (iPhone)' });
    expect(r.body.data).toMatchObject({ kind: 'post', state: 'upcoming', goes_live_on: day(12), store: { handle: w.handle, url: `https://inflx.in/s/${w.handle}` } });
    expect(await visits(id)).toEqual([{ channel: 'ig', real_source: null }]);
  });

  test('live: what the post is — products, offer, brand; never who bought', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id); await livePosting(w);
    const r = (await tap(`/p/${await codeOf(id)}?ch=wa`)).body.data;
    expect(r.state).toBe('live');
    expect(r.post).toMatchObject({ title: 'Festive Sarees', brand_name: expect.any(String), offer: 'Bundle · Any 2 for ₹2,999' });
    expect(r.post.products.map((p) => p.name).sort()).toEqual(["Levi's 511 Slim", 'Wrangler Regular']);
    expect(JSON.stringify(r)).not.toMatch(/follower|buyer|phone/i);
  });

  test('a link preview or crawler is not a visit; an unknown ending counts as Other', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id);
    const code = await codeOf(id);
    await tap(`/p/${code}?ch=wa`, { 'x-visitor-ua': 'WhatsApp/2.23.20 A' });
    await tap(`/p/${code}?ch=fb`, { 'x-visitor-ua': 'facebookexternalhit/1.1' });
    await tap(`/p/${code}?ch=tiktok`, { 'x-visitor-ua': 'Mozilla/5.0' });
    expect(await visits(id)).toEqual([{ channel: 'o', real_source: null }]);
  });

  test('admin-only real source: an Instagram link opened from somewhere else records where', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id);
    const code = await codeOf(id);
    await tap(`/p/${code}?ch=ig`, { 'x-visitor-ua': 'Mozilla/5.0', 'x-visitor-referer': 'https://l.instagram.com/?u=x' });
    await tap(`/p/${code}?ch=ig`, { 'x-visitor-ua': 'Mozilla/5.0', 'x-visitor-referer': 'https://web.whatsapp.com/' });
    expect(await visits(id)).toEqual([{ channel: 'ig', real_source: null }, { channel: 'ig', real_source: 'web.whatsapp.com' }]);
  });

  test('a removed post opens "no longer available" and her store; an unknown code says so', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id);
    const code = await codeOf(id);
    await api.post(`${P}/${id}/take-down`, w.cr.token);
    expect((await tap(`/p/${code}`)).body.data).toMatchObject({ state: 'gone', post: { code }, store: { handle: w.handle } });
    expect((await tap('/p/ZZZZZZ')).body.data).toEqual({ kind: 'post', state: 'unknown', store: null });
    expect((await tap('/p/not-a-code')).body.data.state).toBe('unknown');
  });

  test('a code typed in search is exactly that post, counted as "Post code"', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id); await livePosting(w);
    const r = (await tap(`/code/${await codeOf(id)}`, { 'x-device-id': 'dev-1' })).body.data;
    expect(r).toMatchObject({ state: 'live', post: { title: 'Festive Sarees' } });
    expect(await visits(id)).toEqual([{ channel: 'code', real_source: null }]);
  });
});

/* ═══════════════════════════════════════════ store and collection links (checks 11–14) */

describe('store and collection links (checks 11–14)', () => {
  test('her store link opens her live posts; visits by channel this month (L5)', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id); await livePosting(w);
    const r = (await tap(`/s/${w.handle}?ch=ig`)).body.data;
    expect(r).toMatchObject({ kind: 'store', state: 'live', renamed: false, store: { handle: w.handle, name: 'Priya Rao' } });
    expect(r.posts.map((p) => p.title)).toEqual(['Festive Sarees']);
    await tap(`/s/${w.handle.toUpperCase()}/?ch=ig`);
    await tap(`/s/@${w.handle}?ch=yt`);
    const l = (await api.get('/influencers/me/links', w.cr.token)).body.data;
    expect(l.store.display).toBe(`inflx.in/s/${w.handle}`);
    expect(l.store.links.map((x) => [x.label, x.display, x.visits])).toEqual([
      ['Instagram bio', `inflx.in/s/${w.handle}/ig`, 2], ['YouTube', `inflx.in/s/${w.handle}/yt`, 1],
      ['WhatsApp', `inflx.in/s/${w.handle}/wa`, 0], ['Facebook', `inflx.in/s/${w.handle}/fb`, 0], ['Other', `inflx.in/s/${w.handle}/o`, 0],
    ]);
  });

  test('she changes her handle: the old store link still opens her store, under the new handle', async () => {
    const w = await world();
    const old = w.handle;
    await query(`UPDATE influencers SET instagram_handle = $2 WHERE id = $1`, [w.cr.influencerId, `${old}_new`]);
    const r = (await tap(`/s/${old}?ch=ig`)).body.data;
    expect(r).toMatchObject({ state: 'live', renamed: true, store: { handle: `${old}_new` } });
    expect((await query(`SELECT handle_used FROM link_visits WHERE influencer_id = $1`, [w.cr.influencerId])).rows).toEqual([{ handle_used: old }]);
    expect((await tap('/s/nobody_has_this_handle')).body.data).toEqual({ kind: 'store', state: 'unknown' });
  });

  test('a collection has one link from the moment it is made; it opens the items; hidden says so with her store', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id); await livePosting(w);
    const c = (await api.post('/influencers/me/collections', w.cr.token, { name: 'My Dasara picks', kind: 'posts', items: [{ post_id: id }] })).body.data.collection;
    expect(c.link.display).toMatch(/^inflx\.in\/c\/[BCDFGHJKMNPQRSTVWXYZ2-9]{6}$/);
    const open = (await tap(`/c/${c.link.code}`)).body.data;
    expect(open).toMatchObject({ kind: 'collection', state: 'live', name: 'My Dasara picks', items: [{ kind: 'post', title: 'Festive Sarees' }] });
    await api.post(`${P}/${id}/take-down`, w.cr.token);
    expect((await tap(`/c/${c.link.code}`)).body.data).toMatchObject({ state: 'hidden', name: 'My Dasara picks', store: { handle: w.handle } });
    const l = (await api.get('/influencers/me/links', w.cr.token)).body.data;
    expect(l.collections).toEqual([expect.objectContaining({ name: 'My Dasara picks', items: 1, visits: 2, display: c.link.display })]);
    expect((await tap('/c/BBBBBB')).body.data).toEqual({ kind: 'collection', state: 'unknown' });
  });
});

/* ═══════════════════════════════════════════ stats and the order channel (checks 15–17) */

describe("a post's stats and the channel an order counts under (checks 15–17)", () => {
  test('visits and orders by channel, sales and her commission; an order with no tap is "In INFLX"', async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id); await livePosting(w);
    const code = await codeOf(id);
    for (const ch of ['ig', 'ig', 'ig', 'wa']) await tap(`/p/${code}?ch=${ch}`);
    await tap(`/code/${code}`);
    const f = await createFollowerUser();
    const reg = await request(app).post('/v1/followers/register').set('Authorization', `Bearer ${f.token}`).send({ name: 'Test Follower', city: 'Vijayawada', state: 'AP' });
    const followerId = reg.body.data.follower.id;
    for (const [ch, amt] of [['ig', 2999], ['ig', 2999], [null, 2000]]) {
      await query(`INSERT INTO follower_transactions (follower_id, brand_id, transaction_type, gross_amount, net_amount, influencer_commission, marketplace_fee_amount, status, via_post_id, link_channel)
                   VALUES ($1, $2, 'online_order', $3, $3, $4, $5, 'completed', $6, $7)`, [followerId, w.brandId, amt, amt * 0.1, amt * 0.08, id, ch]);
    }
    const s = (await api.get(`${P}/${id}/stats`, w.cr.token)).body.data;
    expect(s.totals).toEqual({ visits: 5, orders: 3, sales: 7998, commission: 799.8 });
    expect(s.visits.map((v) => [v.label, v.visits])).toEqual([['Instagram', 3], ['WhatsApp', 1], ['Post code', 1]]);
    expect(s.orders.map((o) => [o.label, o.orders, o.sales])).toEqual([['Instagram', 2, 5998], ['In INFLX', 1, 2000]]);
  });

  test("the order channel: that creator's latest tap by this device within the window; else none", async () => {
    const w = await world();
    const id = await sentPost(w); await approve(id); await livePosting(w);
    const code = await codeOf(id);
    await tap(`/s/${w.handle}?ch=yt`, { 'x-device-id': 'dev-9' });
    await tap(`/p/${code}?ch=wa`, { 'x-device-id': 'dev-9' });
    expect(await links.channelForOrder({ deviceId: 'dev-9', influencerId: w.cr.influencerId, postId: id })).toBe('wa');
    expect(await links.channelForOrder({ deviceId: 'dev-other', influencerId: w.cr.influencerId, postId: id })).toBeNull();
    await query(`UPDATE link_visits SET counts_until = now() - interval '1 minute' WHERE device_id = 'dev-9'`);
    expect(await links.channelForOrder({ deviceId: 'dev-9', influencerId: w.cr.influencerId, postId: id })).toBeNull();
  });

  test('the window is an INFLX setting (30 days, 1–90) stamped on each tap', async () => {
    const r = await api.get('/admin/platform-settings', admin.token);
    const list = Array.isArray(r.body.data) ? r.body.data : Array.isArray(r.body.data.settings) ? r.body.data.settings : Object.values(r.body.data.settings || r.body.data);
    const row = list.find((x) => x.key === 'link_channel_window_days');
    expect(row).toMatchObject({ value: 30, min: 1, max: 90 });
    const w = await world();
    await tap(`/s/${w.handle}?ch=ig`);
    const { rows: [v] } = await query(`SELECT extract(day FROM counts_until - visited_at)::int AS d FROM link_visits WHERE influencer_id = $1`, [w.cr.influencerId]);
    expect(v.d).toBe(30);
  });
});

/* ═══════════════════════════════════════════ the brand (L7, L8; checks 18–20) */

describe("the brand's posts and codes (L7, L8; checks 18–20)", () => {
  test('the set lists its approved and live posts with code, creator and numbers; Copy all codes = live posts only', async () => {
    const w = await world();
    const a = await sentPost(w, 'Festive Sarees'); await approve(a);
    const b = await sentPost(w, 'Festive kurtis'); await approve(b);
    const inReview = await sentPost(w, 'Silk dupattas');
    let r = (await api.get(`${w.url}/posts`, w.b.token)).body.data;
    expect(r.posts.map((p) => [p.title, p.state, p.creator_name])).toEqual([['Festive Sarees', 'approved', 'Priya Rao'], ['Festive kurtis', 'approved', 'Priya Rao']]);
    expect(r.posts.map((p) => p.id)).not.toContain(inReview);
    expect(r.copy_text).toBeNull();
    await livePosting(w);
    r = (await api.get(`${w.url}/posts`, w.b.token)).body.data;
    expect(r).toMatchObject({ campaign_name: 'Diwali Denim', set_name: 'Set A', creators: 1, live: 2 });
    expect(r.copy_text).toBe([`Shop our Diwali Denim looks on INFLX. Search a code:`,
      `${await codeOf(a)} · Festive Sarees by Priya`, `${await codeOf(b)} · Festive kurtis by Priya`].join('\n'));
    expect(r.totals).toEqual({ orders: 0, sales: 0, commission: 0, inflx_fee: 0, you_receive: 0 });
  });

  test('a post\'s channel breakdown for the brand; another brand, or a post of another set, answers 404', async () => {
    const w = await world();
    const a = await sentPost(w); await approve(a);
    await tap(`/p/${await codeOf(a)}?ch=ig`);
    const s = await api.get(`${w.url}/posts/${a}/stats`, w.b.token);
    expect(s.body.data.totals.visits).toBe(1);
    const x = await world();
    expect((await api.get(`${w.url}/posts`, x.b.token)).status).toBe(404);
    expect((await api.get(`${x.url}/posts/${a}/stats`, x.b.token)).status).toBe(404);
  });
});
