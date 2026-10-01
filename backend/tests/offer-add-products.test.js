'use strict';

/**
 * offer-add-products — a published offer's products can be added to or taken out only while no
 * creator has the offer. Contract: features/offer-add-products · checks 1–12 of
 * 03-expected-outputs.md. Rules: Docs/OFFER_TERMS_POSTS_RULES.md §1.10 (v1.14).
 * Real API, real database.
 */

const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const { api, query, day, T } = H;

const GIVEN = (n) => `This offer has been given to ${n} creator${n === 1 ? '' : 's'}, so its products can't be changed. To change the deal, end it and build a new one.`;
const add = (token, id, ids) => api.post(`/brands/me/offers/${id}/add-products`, token, { product_ids: ids });
const poolIds = async (token, id) => (await H.read(token, id)).pool.buy.map((p) => p.id).sort();

let B, other, t;
beforeAll(async () => {
  await truncateAll();
  B = await H.brand();
  other = await H.brand();
  t = await H.tree();
});

describe('adding while no creator has the offer (checks 1, 2, 3)', () => {
  test('a scheduled offer takes the products from its start date and locks them for its dates', async () => {
    const a = await H.prod(B.brandId, t.shirts, 'Sched A', 900);
    const b = await H.prod(B.brandId, t.shirts, 'Sched B', 950);
    const c = await H.prod(B.brandId, t.shirts, 'Sched C', 990);
    const id = await H.ready(B.token, { ids: [a], from: day(5), to: day(15) });
    expect((await H.read(B.token, id)).pool_open).toBe(true);

    const r = await add(B.token, id, [b, c]);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ added: 2, products: 3, locked_until: day(15) });
    expect(await poolIds(B.token, id)).toEqual([a, b, c].sort());
    const { rows } = await query(
      `SELECT lower(i.lock_days)::text AS from_day, (upper(i.lock_days) - 1)::text AS until, i.added_by, s.method
         FROM offer_pool_items i JOIN offer_pool_sources s ON s.id = i.source_id
        WHERE i.offer_id = $1 AND i.product_id = $2`, [id, b]);
    expect(rows[0]).toEqual({ from_day: day(5), until: day(15), added_by: 'publish', method: 'picked' });

    // Locked now: another offer on overlapping dates can't take one of them.
    const rival = await H.ready(B.token, { name: 'Rival', from: day(10), to: day(20), publishIt: false });
    const clash = await H.line(B.token, rival, { pool: 'buy', method: 'search', query: 'sched', product_ids: [b] });
    expect(clash.status).toBe(409);
    expect(clash.body.error.message).toMatch(/^"Sched B" is in ".+" until .+ and can't be added\.$/);
  });

  test('a live offer takes them from today', async () => {
    const a = await H.prod(B.brandId, t.shirts, 'Live A', 900);
    const b = await H.prod(B.brandId, t.shirts, 'Live B', 950);
    const id = await H.ready(B.token, { ids: [a], from: day(-3), to: day(9) });
    expect((await add(B.token, id, [b])).status).toBe(200);
    const { rows: [item] } = await query(`SELECT lower(lock_days)::text AS from_day FROM offer_pool_items WHERE offer_id = $1 AND product_id = $2`, [id, b]);
    expect(item.from_day).toBe(T());
    const row = (await H.read(B.token, id)).pool.buy.find((p) => p.id === b);
    expect(row.from_day).toBe(T());
  });

  test('a product another offer held earlier in these dates is free from today, in the list and on adding', async () => {
    const x = await H.prod(B.brandId, t.trousers, 'Freed trouser', 1500);
    const seed = await H.prod(B.brandId, t.trousers, 'Seed trouser', 1400);
    const old = await H.ready(B.token, { ids: [x], from: day(-3), to: day(5) });
    expect((await api.post(`/brands/me/offers/${old}/end`, B.token)).status).toBe(200);
    const id = await H.ready(B.token, { ids: [seed], from: day(-2), to: day(10) });
    const list = await api.get(`/brands/me/offers/${id}/candidates?q=Freed`, B.token);
    expect(list.body.data.products.find((p) => p.id === x)).toMatchObject({ locked: null, in_pool: null });
    expect((await add(B.token, id, [x])).status).toBe(200);
  });
});

describe('once a creator has the offer its products are frozen (checks 4, 5, 6)', () => {
  let C;
  beforeAll(async () => { C = await H.creator(); });

  test.each([['signed', 'active'], ['an unsigned invitation', 'invited']])('%s: add and remove are both refused, nothing changes', async (_w, status) => {
    const a = await H.prod(B.brandId, t.jeans, `Given A ${status}`, 1800);
    const b = await H.prod(B.brandId, t.jeans, `Given B ${status}`, 1900);
    const extra = await H.prod(B.brandId, t.jeans, `Given extra ${status}`, 2000);
    const id = await H.ready(B.token, { ids: [a, b], from: day(-1), to: day(12) });
    const ci = (await H.collab(B.brandId, C.influencerId, { status, signed: status === 'invited' ? 'none' : 'both' })).campaignInfluencerId;
    await H.link(ci, id);

    const view = await H.read(B.token, id);
    expect(view.pool_open).toBe(false);
    expect(view.creators.length).toBe(1);

    const ad = await add(B.token, id, [extra]);
    expect(ad.status).toBe(409);
    expect(ad.body.error).toMatchObject({ code: 'OFFER_GIVEN', message: GIVEN(1) });
    const pv = await api.get(`/brands/me/offers/${id}/remove-preview?product_ids=${a}`, B.token);
    expect(pv.status).toBe(409);
    expect(pv.body.error.code).toBe('OFFER_GIVEN');
    const rm = await api.post(`/brands/me/offers/${id}/remove-products`, B.token, { product_ids: [a] });
    expect(rm.status).toBe(409);
    expect(rm.body.error.message).toBe(GIVEN(1));

    expect(await poolIds(B.token, id)).toEqual([a, b].sort());
    expect((await H.notices(C.userId, 'offer_products_removed')).length).toBe(0);
    // Ending it is still allowed.
    expect((await api.post(`/brands/me/offers/${id}/end`, B.token)).status).toBe(200);
  });

  test('a declined invitation, or an offer dropped from the invitation, leaves the products open', async () => {
    const a = await H.prod(B.brandId, t.jackets, 'Open A', 3000);
    const b = await H.prod(B.brandId, t.jackets, 'Open B', 3100);
    const c = await H.prod(B.brandId, t.jackets, 'Open C', 3200);
    const id = await H.ready(B.token, { ids: [a], from: day(2), to: day(12) });
    const declined = (await H.collab(B.brandId, C.influencerId, { status: 'declined', signed: 'none' })).campaignInfluencerId;
    await H.link(declined, id);
    expect((await H.read(B.token, id)).pool_open).toBe(true);
    expect((await add(B.token, id, [b])).status).toBe(200);

    const invited = (await H.collab(B.brandId, C.influencerId, { status: 'invited', signed: 'none' })).campaignInfluencerId;
    await H.link(invited, id);
    expect((await add(B.token, id, [c])).status).toBe(409);
    await query(`UPDATE collab_offers SET dropped_at = now() WHERE campaign_influencer_id = $1 AND offer_id = $2`, [invited, id]);
    expect((await add(B.token, id, [c])).status).toBe(200);
    expect((await api.post(`/brands/me/offers/${id}/remove-products`, B.token, { product_ids: [c] })).status).toBe(200);
  });
});

describe('what can\'t be added (checks 7, 8, 9, 10)', () => {
  test('a product another offer holds on these days is refused and named', async () => {
    const held = await H.prod(B.brandId, t.shirts, 'Held shirt', 800);
    const seed = await H.prod(B.brandId, t.shirts, 'Seed shirt', 850);
    await H.ready(B.token, { name: 'Holder', ids: [held], from: day(3), to: day(8) });
    const id = await H.ready(B.token, { ids: [seed], from: day(-1), to: day(6) });
    const r = await add(B.token, id, [held]);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('PRODUCT_LOCKED');
    expect(r.body.error.message).toMatch(/^"Held shirt" is in "Holder" until /);
    expect(await poolIds(B.token, id)).toEqual([seed]);
  });

  test('already in the offer, not a published product, another brand\'s, or nothing ticked', async () => {
    const a = await H.prod(B.brandId, t.shirts, 'Dup shirt', 800);
    const hidden = await H.prod(B.brandId, t.shirts, 'Hidden shirt', 800, null, { is_active: false });
    const theirs = await H.prod(other.brandId, t.shirts, 'Their shirt', 800);
    const id = await H.ready(B.token, { ids: [a], from: day(1), to: day(6) });
    const dup = await add(B.token, id, [a]);
    expect(dup.status).toBe(422);
    expect(dup.body.error.message).toBe('"Dup shirt" is already in this offer.');
    for (const ids of [[hidden], [theirs]]) {
      const r = await add(B.token, id, ids);
      expect(r.status).toBe(422);
      expect(r.body.error.message).toBe('One or more products are not in your published listings.');
    }
    const none = await add(B.token, id, []);
    expect(none.status).toBe(422);
    expect(none.body.error.message).toBe('Tick the products to add.');
  });

  test('a draft, an ended offer and a fixed bundle take no products this way', async () => {
    const a = await H.prod(B.brandId, t.shirts, 'State shirt', 1299);
    const b = await H.prod(B.brandId, t.trousers, 'State trouser', 1499);
    const c = await H.prod(B.brandId, t.trousers, 'State extra', 1399);
    const d = await H.prod(B.brandId, t.trousers, 'State extra 2', 1399);
    const draft = await H.ready(B.token, { ids: [d], from: day(1), to: day(6), publishIt: false });
    expect((await add(B.token, draft, [c])).status).toBe(409);

    const fixed = await H.ready(B.token, { type: 'bundle', sub: 'fixed', name: 'Fixed pair', cfg: { price: 2499 }, ids: [a, b], from: day(20), to: day(30) });
    const fx = await add(B.token, fixed, [c]);
    expect(fx.status).toBe(422);
    expect(fx.body.error.message).toMatch(/^A fixed bundle is exactly these products/);

    await api.post(`/brands/me/offers/${fixed}/end`, B.token);
    const ended = await add(B.token, fixed, [c]);
    expect(ended.status).toBe(409);
    expect(ended.body.error.message).toBe('Only a scheduled or live offer can take more products.');
  });

  test('products that would break the deal are refused in plain words', async () => {
    const j1 = await H.prod(B.brandId, t.jeans, 'Band jeans 1', 1800);
    const j2 = await H.prod(B.brandId, t.jeans, 'Band jeans 2', 2000);
    const dear = await H.prod(B.brandId, t.jeans, 'Dear jeans', 3200);
    const fine = await H.prod(B.brandId, t.jeans, 'Fine jeans', 1900);
    const shirt = await H.prod(B.brandId, t.shirts, 'Stray shirt', 1900);
    const pick = await H.ready(B.token, { type: 'bundle', sub: 'pick_any', name: 'Any 2', cfg: { pick: 2, price: 3000 }, ids: [j1, j2], from: day(40), to: day(50) });
    const band = await add(B.token, pick, [dear]);
    expect(band.status).toBe(422);
    expect(band.body.error).toMatchObject({ code: 'ADD_REFUSED', message: 'In a bundle the costliest product can be at most 1.5 × the cheapest. With these it would be ₹3,200 against ₹1,800.' });
    const stray = await add(B.token, pick, [shirt]);
    expect(stray.status).toBe(422);
    expect(stray.body.error.message).toMatch(/^Pick-any bundles stay in one category/);
    expect((await add(B.token, pick, [fine])).status).toBe(200);

    const cheap = await H.prod(B.brandId, t.jackets, 'Cheap jacket', 150);
    const jacket = await H.prod(B.brandId, t.jackets, 'Flat jacket', 2500);
    const flat = await H.ready(B.token, { type: 'discount', sub: 'flat', name: '₹200 off', cfg: { amount: 200 }, ids: [jacket], from: day(40), to: day(50) });
    const low = await add(B.token, flat, [cheap]);
    expect(low.status).toBe(422);
    expect(low.body.error.message).toBe('This offer takes ₹200 off each item, so every product must cost more than that. "Cheap jacket" costs ₹150.');
  });
});

describe('removing, and another brand (checks 11, 12)', () => {
  test('with no creator, removed products are free the same day', async () => {
    const a = await H.prod(B.brandId, t.trousers, 'Rm A', 1500);
    const b = await H.prod(B.brandId, t.trousers, 'Rm B', 1600);
    const id = await H.ready(B.token, { ids: [a, b], from: day(-2), to: day(10) });
    const pv = await api.get(`/brands/me/offers/${id}/remove-preview?product_ids=${a}`, B.token);
    expect(pv.body.data).toMatchObject({ creators: [], products_left: 1 });
    const r = await api.post(`/brands/me/offers/${id}/remove-products`, B.token, { product_ids: [a] });
    expect(r.body.data).toEqual({ removed: 1, creators_told: 0, posts_removed: 0 });
    // …and it can come straight back.
    expect((await add(B.token, id, [a])).status).toBe(200);
    expect(await poolIds(B.token, id)).toEqual([a, b].sort());
  });

  test('another brand\'s offer answers 404', async () => {
    const a = await H.prod(B.brandId, t.shirts, 'Mine', 999);
    const id = await H.ready(B.token, { ids: [a], from: day(60), to: day(70) });
    const theirs = await H.prod(other.brandId, t.shirts, 'Other', 999);
    expect((await add(other.token, id, [theirs])).status).toBe(404);
  });
});
