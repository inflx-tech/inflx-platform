'use strict';

/**
 * offer-builder-v2 — the Listings side. Contract: features/offer-builder-v2
 * Checks 30–33, 35–37 of 03-expected-outputs.md: products without offers (O8), the Offer column
 * and panel (O9), gift items (O13), the price-change warning and notice (O12), the offer list (O1).
 */

const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const { api, query, day, T } = H;

let B, t;
beforeAll(async () => {
  await truncateAll();
  B = await H.brand();
  t = await H.tree();
});

describe('products without offers (check 30)', () => {
  let inOct, joinsLater, free, hidden;
  beforeAll(async () => {
    inOct = await H.prod(B.brandId, t.jeans, 'PWO in offer', 1500);
    joinsLater = await H.prod(B.brandId, t.shirts, 'PWO joins later', 849);
    free = await H.prod(B.brandId, t.shirts, 'PWO free', 1299);
    hidden = await H.prod(B.brandId, t.shirts, 'PWO hidden', 999, null, { is_active: false });
    await H.ready(B.token, { name: 'Summer Denim', ids: [inOct], from: day(10), to: day(20) });
    await H.ready(B.token, { name: 'Linen Week', ids: [joinsLater], from: day(30), to: day(40) });
  });
  const on = async (d) => (await api.get(`/brands/me/offers/products-without-offers?date=${d}`, B.token)).body.data.products;

  test('a product held on that day is not listed; the day after its offer ends it is, with the offer it was in', async () => {
    expect((await on(day(15))).map((p) => p.id)).not.toContain(inOct);
    const after = (await on(day(25))).find((p) => p.id === inOct);
    expect(after.last_offer).toEqual({ name: 'Summer Denim', until: day(20) });
  });
  test('a product booked for a later offer shows its next offer; hidden products never show', async () => {
    const list = await on(day(15));
    expect(list.find((p) => p.id === joinsLater).next_offer).toEqual({ name: 'Linen Week', from: day(30) });
    expect(list.find((p) => p.id === free)).toMatchObject({ next_offer: null, last_offer: null, category_path: 'Topwear › Shirts' });
    expect(list.map((p) => p.id)).not.toContain(hidden);
  });
  test('the default day is today; search and price filters narrow it', async () => {
    const r = await api.get('/brands/me/offers/products-without-offers?q=free&price_max=1300', B.token);
    expect(r.body.data.date).toBe(T());
    expect(r.body.data.products.map((p) => p.id)).toEqual([free]);
  });
  test('"Put in offer" starts a draft with the ticked products as one line', async () => {
    const o = await H.draft(B.token, { offer_type: 'discount', sub_type: 'percentage', product_ids: [free] });
    await H.patch(B.token, o.id, { starts_on: day(50), ends_on: day(60) });
    const v = await H.read(B.token, o.id);
    expect(v.pool.buy.map((p) => p.id)).toEqual([free]);
    expect(v.pool.sources[0].label).toBe('Picked from Products without offers');
  });
});

describe('gift items stay gift-only (checks 31, 33)', () => {
  test('create with 4 fields, validation, restock; never in products without offers', async () => {
    const bad = await api.post('/brands/me/gift-items', B.token, { name: '', value: 0, stock: -1 });
    expect(bad.status).toBe(422);
    expect((await api.post('/brands/me/gift-items', B.token, { name: 'Bottle', value: 0, stock: 5 })).body.error.message).toBe('The value must be more than ₹0.');
    expect((await api.post('/brands/me/gift-items', B.token, { name: 'Bottle', value: 349, stock: 1.5 })).body.error.message).toBe('Stock must be a whole number, 0 or more.');
    const r = await api.post('/brands/me/gift-items', B.token, { name: 'Steel water bottle', value: 349, stock: 120, photo_url: 'https://cdn.example.com/b.jpg' });
    expect(r.status).toBe(201);
    const g = r.body.data.gift_item;
    expect(g).toMatchObject({ name: 'Steel water bottle', value: 349, stock: 120, used_in: null });
    const re = await api.patch(`/brands/me/gift-items/${g.id}`, B.token, { stock: 200 });
    expect(re.body.data.gift_item.stock).toBe(200);
    const list = (await api.get('/brands/me/gift-items', B.token)).body.data.gift_items;
    expect(list.find((x) => x.id === g.id).stock).toBe(200);
    const pwo = (await api.get('/brands/me/offers/products-without-offers', B.token)).body.data.products;
    expect(pwo.map((p) => p.id)).not.toContain(g.id);
    const other = await H.brand();
    expect((await api.patch(`/brands/me/gift-items/${g.id}`, other.token, { stock: 1 })).status).toBe(404);
  });
  test('a gift item used in a gift pool shows the offer it is in', async () => {
    const coin = (await api.post('/brands/me/gift-items', B.token, { name: 'Silver coin', value: 650, stock: 50 })).body.data.gift_item;
    const buy = await H.prod(B.brandId, t.jackets, 'Gift jacket', 3500);
    const o = await H.draft(B.token, { offer_type: 'free_gift', sub_type: 'spend' });
    await H.patch(B.token, o.id, { name: 'Pattu Saree Gift', starts_on: day(-1), ends_on: day(30), offer_config_json: { min_spend: 3000, gift_count: 1 } });
    await H.line(B.token, o.id, { pool: 'buy', method: 'search', product_ids: [buy] });
    await H.line(B.token, o.id, { pool: 'gift', method: 'gift_items', gift_item_ids: [coin.id] });
    expect((await H.publish(B.token, o.id)).status).toBe(200);
    const row = (await api.get('/brands/me/gift-items', B.token)).body.data.gift_items.find((x) => x.id === coin.id);
    expect(row.used_in).toMatchObject({ name: 'Pattu Saree Gift', until: day(30), now: true });
    // Gift items are never a buy-pool candidate.
    const cand = (await api.get(`/brands/me/offers/${o.id}/candidates?q=coin`, B.token)).body.data.products;
    expect(cand.map((p) => p.id)).not.toContain(coin.id);
  });
});

describe('the offer per product (check 32)', () => {
  test('now (until when), next (from when), or none; the panel adds creators and posts', async () => {
    const now = await H.prod(B.brandId, t.trousers, 'Now trouser', 1500);
    const next = await H.prod(B.brandId, t.trousers, 'Next trouser', 1500);
    const none = await H.prod(B.brandId, t.trousers, 'No offer trouser', 1500);
    const nowId = await H.ready(B.token, { name: 'Running now', ids: [now], from: day(-5), to: day(5) });
    await H.ready(B.token, { name: 'Coming up', ids: [next, now], from: day(10), to: day(12) });
    const r = await api.get(`/brands/me/offers/product-offers?product_ids=${now},${next},${none}`, B.token);
    const m = r.body.data.products;
    expect(m[now].now).toMatchObject({ offer_id: nowId, name: 'Running now', until: day(5) });
    expect(m[now].next).toMatchObject({ name: 'Coming up', from: day(10) });
    expect(m[next]).toEqual({ now: null, next: expect.objectContaining({ name: 'Coming up', from: day(10), until: day(12) }) });
    expect(m[none]).toBeUndefined();
    const C = await H.creator();
    const ci = (await H.collab(B.brandId, C.influencerId)).campaignInfluencerId;
    await H.link(ci, nowId);
    const panel = (await api.get(`/brands/me/offers/product-offers/${now}`, B.token)).body.data;
    expect(panel.now).toMatchObject({ name: 'Running now', creators: 1, posts: 0 });
  });
});

describe('price impact and the notice (checks 35, 36)', () => {
  let C, ci, a, b, lonely, bundleId;
  beforeAll(async () => {
    C = await H.creator({ name: 'Asha R.' });
    ci = (await H.collab(B.brandId, C.influencerId)).campaignInfluencerId;
    a = await H.prod(B.brandId, t.jeans, 'Wrangler Regular Blue', 1999);
    b = await H.prod(B.brandId, t.jeans, 'Cheap jeans', 1699);
    lonely = await H.prod(B.brandId, t.jeans, 'No offer jeans', 1999);
    bundleId = await H.ready(B.token, { type: 'bundle', sub: 'pick_any', name: 'Any 2 Jeans for ₹2,999', cfg: { pick: 2, price: 2999 }, ids: [a, b], from: day(-1), to: day(30) });
    await H.link(ci, bundleId);
  });

  test('before saving: the offer, creators, and the bundle rule the new price breaks (O12)', async () => {
    const r = await api.get(`/brands/me/offers/price-impact?product_id=${a}&price=2799`, B.token);
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.offer).toMatchObject({ id: bundleId, name: 'Any 2 Jeans for ₹2,999', display_status: 'live' });
    expect(d.creators).toBe(1);
    expect(d.lines).toContain('The bundle price stays ₹2,999 for any 2.');
    expect(d.breaks).toContain('The costliest item (₹2,799) is more than 1.5 × the cheapest (₹1,699).');
  });
  test('a product in no offer has nothing to warn about', async () => {
    const r = await api.get(`/brands/me/offers/price-impact?product_id=${lonely}&price=2500`, B.token);
    expect(r.body.data.offer).toBeNull();
  });
  test('after saving: the creator given the offer is told old → new; no offer → nobody told', async () => {
    const before = (await H.notices(C.userId, 'offer_price_changed')).length;
    expect((await api.patch(`/brands/me/products/${a}`, B.token, { price: 2799 })).status).toBe(200);
    const n = await H.notices(C.userId, 'offer_price_changed');
    expect(n.length).toBe(before + 1);
    expect(n[n.length - 1]).toMatchObject({ title: 'Price changed: Wrangler Regular Blue', body: '₹1,999 → ₹2,799 · in "Any 2 Jeans for ₹2,999".' });
    await api.patch(`/brands/me/products/${lonely}`, B.token, { price: 2500 });
    await api.patch(`/brands/me/products/${a}`, B.token, { name: 'Same price rename' });
    expect((await H.notices(C.userId, 'offer_price_changed')).length).toBe(before + 1);
  });
  test('a discount shows what the shopper will pay', async () => {
    const p = await H.prod(B.brandId, t.shirts, "Levi's shirt", 2299);
    await H.ready(B.token, { type: 'discount', sub: 'percentage', name: '20% off', cfg: { pct: 20, max_off: 400 }, ids: [p], from: day(-1), to: day(9) });
    const d = (await api.get(`/brands/me/offers/price-impact?product_id=${p}&price=1000`, B.token)).body.data;
    expect(d.lines).toContain('Shoppers will pay ₹800 with the offer.');
  });
});

describe('the brand\'s own product list (found while building: Inventory "All products")', () => {
  test('GET /brands/me/products answers the brand, not the creator-side "brand by id" route', async () => {
    const r = await api.get('/brands/me/products', B.token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.products)).toBe(true);
    const byId = await api.get(`/brands/${B.brandId}/products`, B.token);
    expect(byId.status).toBe(200);
    expect((await api.get('/brands/not-an-id/products', B.token)).status).toBe(404);
  });
});

describe('the offers list (check 37)', () => {
  test('v2 only, with counts, type, search, a valid-on date, product and creator counts', async () => {
    const X = await H.brand();
    const p1 = await H.prod(X.brandId, t.jeans, 'L1', 1000);
    const p2 = await H.prod(X.brandId, t.jeans, 'L2', 1100);
    const live = await H.ready(X.token, { name: 'Live one', ids: [p1], from: day(-1), to: day(9) });
    await H.ready(X.token, { type: 'discount', sub: 'flat', name: 'Scheduled one', cfg: { amount: 100 }, ids: [p2], from: day(20), to: day(29) });
    const d = await H.draft(X.token, { offer_type: 'bogo' });
    await H.patch(X.token, d.id, { name: 'Draft one' });
    const ended = await H.ready(X.token, { name: 'Ended one', ids: [await H.prod(X.brandId, t.jeans, 'L3', 900)], from: day(-2), to: day(9) });
    await api.post(`/brands/me/offers/${ended}/end`, X.token);
    await query(`INSERT INTO brand_offers (brand_id, name, offer_type, offer_config_json, status) VALUES ($1,'Old one','bogo','{}','archived')`, [X.brandId]);

    const all = (await api.get('/brands/me/offers?engine=2', X.token)).body.data;
    expect(all.counts).toEqual({ all: 4, live: 1, scheduled: 1, draft: 1, ended: 1 });
    expect(all.offers.map((o) => o.name)).not.toContain('Old one');
    const L = all.offers.find((o) => o.id === live);
    expect(L).toMatchObject({ type_label: 'BOGO', products: 1, creators: 0, display_status: 'live', deal: 'Buy one, get the same product free' });
    expect(all.offers.find((o) => o.name === 'Draft one').creators).toBeNull();

    const onlyLive = (await api.get('/brands/me/offers?engine=2&status=live', X.token)).body.data.offers;
    expect(onlyLive.map((o) => o.name)).toEqual(['Live one']);
    expect((await api.get('/brands/me/offers?engine=2&type=discount', X.token)).body.data.offers.map((o) => o.name)).toEqual(['Scheduled one']);
    expect((await api.get('/brands/me/offers?engine=2&q=sched', X.token)).body.data.offers.map((o) => o.name)).toEqual(['Scheduled one']);
    expect((await api.get(`/brands/me/offers?engine=2&on=${day(25)}`, X.token)).body.data.offers.map((o) => o.name)).toEqual(['Scheduled one']);
  });
});
