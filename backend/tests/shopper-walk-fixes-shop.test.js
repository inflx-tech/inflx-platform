'use strict';

/**
 * shopper-walk-fixes — what the shopper's screens are sent (01-spec.md O1, O3, O5, W5, W6, W11, W15):
 *   · whether a post opens a deal page is decided by the server (a discount post never does);
 *   · the deal's sentence speaks to the shopper, for every kind of offer;
 *   · a product carries what the brand entered when listing it, in one fixed order;
 *   · the returns line is INFLX's one window;
 *   · a video carries a picture taken from it — on a post, on Going live, and on a file she shares.
 * Real API, real database.
 */

const request = require('supertest');
const app = require('../src/app');
const H = require('./helpers/offersV2');
const W = require('./helpers/item17');
const W14 = require('./helpers/item14');
const w10 = require('./helpers/item10');
const w12 = require('./helpers/item12');
const rules = require('../src/services/offerRules');
const productDetails = require('../src/services/productDetails.service');
const paymentConfig = require('../src/services/paymentConfig.service');

const { api, query, day } = H;
let admin; let tree;
const PP = '/influencers/me/shoppable-posts';
const patchPost = (w, id, body) => request(app).patch(`/v1${PP}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);

beforeAll(async () => {
  admin = await W.fresh();
  W14.resetTree();
  tree = await H.tree();
  await query(`INSERT INTO payment_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  paymentConfig._resetCache();
  productDetails._resetCache();
  await w12.startServer();
});
afterAll(() => w12.stopServer());

/** Upload `n` bytes of `type` for this post through the signed route; returns its key. */
async function putFor(w, postId, type, n) {
  const up = await api.post(`${PP}/${postId}/upload-url`, w.cr.token, { content_type: type, size_bytes: n });
  if (up.status !== 200) throw new Error(`upload-url: ${JSON.stringify(up.body)}`);
  const st = await w12.put(up.body.data.url, n, type);
  if (st !== 200) throw new Error(`put: ${st}`);
  return up.body.data.key;
}

/** A signed Pay for Sale collaboration on an offer of `kind`, with one approved, live post (photo or video). */
async function world({ type = 'discount', sub = 'percentage', cfg = { pct: 20 }, video = false, cover = true } = {}) {
  const b = await H.brand();
  const ids = [];
  for (const [name, price] of [['Premium Polo T-Shirt', 899], ['Blue polo', 899], ['Classic tee', 599]]) ids.push(await H.prod(b.brandId, tree.jeans, name, price)); // eslint-disable-line no-await-in-loop
  const deal = await H.ready(b.token, { type, sub, name: `${sub} deal`, cfg, ids, from: day(-5), to: day(40) });
  const c = await w10.campaign(b, { name: 'Festive' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: 'Akshaya Reddy' });
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [deal] } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, ids, deal };
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    const r = await step(w); // eslint-disable-line no-await-in-loop
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  const { rows: [con] } = await query(`SELECT id FROM contracts WHERE campaign_influencer_id = $1`, [ciId]);
  await query(`INSERT INTO production_events (contract_id, mode, status) VALUES ($1, 'shipment', 'completed') ON CONFLICT (contract_id) DO UPDATE SET status = 'completed'`, [con.id]);
  const postId = (await api.post(PP, cr.token, { campaign_influencer_id: ciId })).body.data.post.id;
  const [tg] = (await query(`SELECT id FROM theme_tags WHERE name = 'Festive'`)).rows;
  await patchPost(w, postId, { post_kind: 'offer' });
  await patchPost(w, postId, { offer_id: deal });
  await patchPost(w, postId, { product_ids: ids, theme_tag_ids: [tg.id], media_kind: video ? 'video' : 'image', media_layout: 'single' });
  let media;
  if (video) {
    const key = await putFor(w, postId, 'video/mp4', 4096);
    w.coverKey = cover ? await putFor(w, postId, 'image/jpeg', 900) : null;
    media = [{ r2_key: key, mime: 'video/mp4', duration_s: 14, ...(cover ? { cover_r2_key: w.coverKey } : {}) }];
  } else {
    media = [{ r2_key: await putFor(w, postId, 'image/jpeg', 1024), mime: 'image/jpeg' }];
  }
  const saved = await patchPost(w, postId, { media, caption: 'This is for BOGI' });
  if (saved.status !== 200) throw new Error(`media: ${JSON.stringify(saved.body)}`);
  const sub2 = await api.post(`${PP}/${postId}/submit`, cr.token);
  if (sub2.status !== 200) throw new Error(`submit: ${JSON.stringify(sub2.body)}`);
  const ap = await api.post(`/admin/posts/${postId}/approve`, admin.token);
  if (ap.status !== 200) throw new Error(`approve: ${JSON.stringify(ap.body)}`);
  w.post = postId;
  return w;
}
const cardOf = async (w) => (await api.get(`/follower/posts/${w.post}`)).body.data;
const dealOf = async (w) => (await api.get(`/follower/posts/${w.post}/deal`)).body.data;

describe('O1 · the server says whether a post opens a deal page', () => {
  it('a plain discount post never does; its card says so before any deal data is fetched', async () => {
    const w = await world();
    const c = await cardOf(w);
    expect(c.deal_page).toBe(false);
    expect(c.offer).toMatchObject({ kind: 'discount', type: 'Discount', sub_type: 'percentage', badge: '20% OFF' });
    expect((await dealOf(w)).deal_page).toBe(false);
  });

  it('a buy-one-get-one post does', async () => {
    const w = await world({ type: 'bogo', sub: 'bogo', cfg: { max_free: 2 } });
    const c = await cardOf(w);
    expect(c.deal_page).toBe(true);
    expect(c.offer.kind).toBe('bogo');
    expect((await dealOf(w)).deal_page).toBe(true);
  });
});

describe('O5 · the deal is said to the shopper', () => {
  const says = (sub_type, cfg, pool) => rules.shopperSays({ sub_type, offer_config_json: cfg }, pool);
  const buy = (n) => ({ buy: Array.from({ length: n }, (_, i) => ({ id: i })) });

  it('ten sentences, none of them written for the creator', () => {
    const all = [
      says('percentage', { pct: 20, max_off: 400 }, buy(3)),
      says('flat', { amount: 200 }, buy(3)),
      says('bogo', {}, buy(2)),
      says('quantity', { reward: 'pct', tiers: [{ at: 1, value: 10 }, { at: 2, value: 20 }, { at: 3, value: 30 }] }, buy(4)),
      says('value', { reward: 'pct', tiers: [{ at: 2000, value: 10 }] }, buy(4)),
      says('pick_any', { pick: 2, price: 2999 }, buy(15)),
      says('mix_match', { pick: 3, price: 3499 }, buy(9)),
      says('fixed', { price: 5000 }, buy(3)),
      says('spend', { min_spend: 3000, gift_count: 1 }, { ...buy(20), gift: Array.from({ length: 10 }, () => ({})) }),
      says('buy_x', { buy_qty: 2, gift_count: 1 }, { ...buy(5), gift: [{}] }),
    ];
    expect(all).toEqual([
      'Every product in this post is 20% off (at most ₹400 off an item).',
      'Every product in this post is ₹200 off.',
      'Buy any product in this post and get the same one free, in any size or colour.',
      'The more you buy from this post, the more you save: buy 1 → 10% off, buy 2 → 20% off, buy 3 → 30% off. Only the highest one applies.',
      "The more you spend on this post's products, the more you save: spend ₹2,000 → 10% off. Only the highest one applies.",
      'Pick any 2 of these 15 products and pay ₹2,999 for them together.',
      'Pick any 3 of these 9 products and pay ₹3,499 for them together.',
      'Buy the whole set for ₹5,000. You only choose size and colour.',
      'Spend ₹3,000 on these products and choose 1 free gift from 10.',
      'Buy 2 of these products and get the gift free.',
    ]);
    for (const s of all) expect(s).not.toMatch(/\bthey\b|your post/i);
  });

  it('the card and the deal page carry the shopper\'s sentence; the creator\'s own terms keep hers', async () => {
    const w = await world({ type: 'bogo', sub: 'bogo', cfg: { max_free: 2 } });
    const shopper = 'Buy any product in this post and get the same one free, in any size or colour.';
    expect((await cardOf(w)).offer.how).toBe(shopper);
    expect((await dealOf(w)).offer.how).toBe(shopper);
    expect(rules.shopperHow({ sub_type: 'bogo', offer_config_json: {} }, {})).toMatch(/^They buy a product from your post/);
  });
});

describe('O3 · a product carries what the brand entered when listing it', () => {
  it('the details in one fixed order, with the listing form\'s own names; empty ones left out', async () => {
    const w = await world();
    await query(
      `UPDATE brand_products SET description = $2, facets = $3::jsonb, return_policy_days = 0 WHERE id = $1`,
      [w.ids[0], 'Smart cotton-blend polo designed for casual business and weekend wear.',
        JSON.stringify({ care: 'Machine wash', unisex: 'Yes', sleeve: 'Half', brand: 'ExecutiveWear', neck: 'Polo', fit: 'Slim',
          size: ['M', 'L'], color_tone: ['Navy', 'Black'], _images: ['https://x/y.jpg'], occasion: ['Casual', 'Office'], pattern_print: '', closure: null })]);
    await query(
      `INSERT INTO facet_definitions (vertical, scope, facet_key, label, facet_role, input_type, sort_order)
       VALUES ('fashion','Men','fit','Fit','descriptive','single_select',64), ('fashion','Men','neck','Neck','descriptive','single_select',47),
              ('fashion','Men','sleeve','Sleeve','descriptive','single_select',45), ('fashion','Men','care','Care','descriptive','single_select',9),
              ('fashion','Men','occasion','Occasion','descriptive','multi_select',6), ('fashion','Men','unisex','Unisex','descriptive','boolean',5)
       ON CONFLICT DO NOTHING`).catch(() => {});
    productDetails._resetCache();
    const d = await dealOf(w);
    const p = d.products.find((x) => x.id === w.ids[0]);
    expect(p.brand_label).toBe('ExecutiveWear');
    expect(p.details).toBe('Smart cotton-blend polo designed for casual business and weekend wear.');
    expect(p.specs.map((x) => x.key)).toEqual(['fit', 'neck', 'sleeve', 'occasion', 'care', 'unisex']);   // W6's order, then the form's
    expect(p.specs.find((x) => x.key === 'occasion')).toEqual({ key: 'occasion', label: 'Occasion', value: 'Casual, Office' });
    expect(p.specs.map((x) => x.key)).not.toEqual(expect.arrayContaining(['size', 'color_tone', 'brand', '_images', 'pattern_print', 'closure']));
    expect(typeof p.category_path === 'string' || p.category_path === null).toBe(true);
    // a product listed with nothing extra simply has no rows
    const bare = d.products.find((x) => x.id === w.ids[2]);
    expect(bare.specs).toEqual([]);
    expect(bare.brand_label).toBeNull();
    // nothing invented (W5)
    for (const k of ['rating', 'reviews', 'tax_line', 'mrp']) expect(p).not.toHaveProperty(k);
  });

  it('the returns line is INFLX\'s one window, whatever the product\'s own number says', async () => {
    const w = await world();
    await query(`UPDATE brand_products SET return_policy_days = 15 WHERE brand_id = $1`, [w.brandId]);
    await api.patch('/admin/config/payments', admin.token, { return_window_hours: 168 });
    expect((await dealOf(w)).returns).toEqual({ hours: 168, words: '7 days', line: 'Within 7 days of delivery' });
    await api.patch('/admin/config/payments', admin.token, { return_window_hours: 24 });
    expect((await dealOf(w)).returns).toEqual({ hours: 24, words: '24 hours', line: 'Within 24 hours of delivery' });
    await api.patch('/admin/config/payments', admin.token, { return_window_hours: 168 });
  });
});

describe('W15 · a video carries a picture taken from it', () => {
  it('a shoppable post: the picture is on the card, is served like the video, and is on Going live for both sides', async () => {
    const w = await world({ video: true });
    const c = await cardOf(w);
    expect(c.media_kind).toBe('video');
    expect(c.media[0].cover_url).toMatch(new RegExp(`/v1/media/post/${c.media[0].id}/cover$`));
    const pic = await request(app).get(`/v1/media/post/${c.media[0].id}/cover`);
    expect(pic.status).toBe(302);
    expect(pic.headers.location).toContain(encodeURIComponent(w.coverKey.split('/').pop()).replace(/%2E/g, '.'));
    expect((await request(app).get(`/v1/media/post/${c.media[0].id}`)).status).toBe(302);          // the video itself, as before
    const hers = (await api.get(`/influencers/me/invitations/${w.ciId}/content`, w.cr.token)).body.data.content.path1.posts[0];
    expect(hers.cover).toEqual({ url: c.media[0].cover_url, isVideo: true });
    const brands = (await api.get(`${w.url}/invitations/${w.ciId}/content`, w.b.token)).body.data.content.path1.posts[0];
    expect(brands.cover).toEqual({ url: c.media[0].cover_url, isVideo: true });
  });

  it('a video with no picture (an older upload) is still a post; its cover is null, never the video file', async () => {
    const w = await world({ video: true, cover: false });
    const c = await cardOf(w);
    expect(c.media[0].cover_url).toBeNull();
    expect((await request(app).get(`/v1/media/post/${c.media[0].id}/cover`)).status).toBe(404);
    const hers = (await api.get(`/influencers/me/invitations/${w.ciId}/content`, w.cr.token)).body.data.content.path1.posts[0];
    expect(hers.cover).toEqual({ url: null, isVideo: true });
  });

  it('a photo post\'s cover is the photo', async () => {
    const w = await world();
    const c = await cardOf(w);
    const hers = (await api.get(`/influencers/me/invitations/${w.ciId}/content`, w.cr.token)).body.data.content.path1.posts[0];
    expect(hers.cover).toEqual({ url: c.media[0].url, isVideo: false });
  });

  it('the picture must be her own upload for this post, a JPEG, and small', async () => {
    const w = await world({ video: true });
    const other = await world({ video: true });
    const draft = (await api.post(PP, w.cr.token, { campaign_influencer_id: w.ciId })).body.data.post.id;
    await patchPost(w, draft, { post_kind: 'offer' });
    await patchPost(w, draft, { offer_id: w.deal });
    await patchPost(w, draft, { product_ids: w.ids, media_kind: 'video', media_layout: 'single' });
    const key = await putFor(w, draft, 'video/mp4', 4096);
    const send = (cover) => patchPost(w, draft, { media: [{ r2_key: key, mime: 'video/mp4', duration_s: 10, cover_r2_key: cover }] });
    expect((await send(other.coverKey)).status).toBe(422);                               // another creator's file
    expect((await send(`posts/${w.cr.influencerId}/${draft}/never-uploaded.jpg`)).status).toBe(422);
    expect((await send(key)).status).toBe(422);                                          // the video itself is not a picture
    const png = await putFor(w, draft, 'image/png', 700);
    expect((await send(png)).status).toBe(422);
    const big = await putFor(w, draft, 'image/jpeg', 3 * 1024 * 1024);
    expect((await send(big)).status).toBe(422);
    const ok = await putFor(w, draft, 'image/jpeg', 800);
    const good = await send(ok);
    expect(good.status).toBe(200);
    expect(good.body.data.post.media[0].cover_url).toMatch(/\/cover$/);
  });

  it('a file she shares with the brand: her phone adds the picture; the brand sees it only once she has sent the file', async () => {
    const admin14 = admin;
    const w = await W14.world();
    const postId = await W14.sentPost(w);
    await W14.approvePost(admin14, postId);
    const add = await W14.addRows(w, postId, ['reel']);
    expect(add.status).toBe(200);
    const rowKey = add.body.data.content.rows.find((r) => !r.outside).key;
    const file = await w12.upload(w, rowKey, 'video');
    expect(file.hasCover).toBe(false);
    const C = `/influencers/me/invitations/${w.ciId}/content`;
    const B = `${w.url}/invitations/${w.ciId}/content`;
    // no picture yet: asking for it is a 404, the video itself is fine
    expect((await api.get(`${C}/files/${file.id}/url?cover=1`, w.cr.token)).status).toBe(404);
    expect((await api.get(`${C}/files/${file.id}/url`, w.cr.token)).status).toBe(200);
    // too large is refused before anything is signed
    expect((await api.post(`${C}/files/${file.id}/cover-url`, w.cr.token, { sizeBytes: 2 * 1024 * 1024 })).status).toBe(422);
    const up = await api.post(`${C}/files/${file.id}/cover-url`, w.cr.token, { sizeBytes: 900 });
    expect(up.status).toBe(200);
    expect(await w12.put(up.body.data.upload.url, 900, 'image/jpeg')).toBe(200);
    const done = await api.post(`${C}/files/${file.id}/cover`, w.cr.token, {});
    expect(done.status).toBe(200);
    expect(done.body.data.file).toMatchObject({ id: file.id, kind: 'video', hasCover: true });
    const view = await api.get(`${C}/files/${file.id}/url?cover=1`, w.cr.token);
    expect(view.status).toBe(200);
    expect(view.body.data.view).toMatchObject({ kind: 'photo', mime: 'image/jpeg', cover: true });
    expect((await api.get(`${C}`, w.cr.token)).body.data.content.rows.find((r) => r.key === rowKey).files[0].hasCover).toBe(true);
    // the brand: nothing of an unsent file, picture included
    expect((await api.get(`${B}/files/${file.id}/url?cover=1`, w.b.token)).status).toBe(404);
    expect((await W14.submit(w)).status).toBe(200);
    const theirs = await api.get(`${B}/files/${file.id}/url?cover=1`, w.b.token);
    expect(theirs.status).toBe(200);
    expect(theirs.body.data.view.cover).toBe(true);
    // a photo has no picture-of-itself; a stranger gets nothing
    const stranger = await W14.world({ name: 'Other One' });
    expect((await api.post(`/influencers/me/invitations/${w.ciId}/content/files/${file.id}/cover-url`, stranger.cr.token, { sizeBytes: 900 })).status).toBe(404);
    expect((await api.get(`${stranger.url}/invitations/${w.ciId}/content/files/${file.id}/url?cover=1`, stranger.b.token)).status).toBe(404);
  });
});
