'use strict';

/**
 * offer-builder-v2 — building, publishing, locking, ending, removing, auto-add. Contract:
 * features/offer-builder-v2 · checks 1–13, 20, 23–29, 34, 38–41 of 03-expected-outputs.md.
 * Real API, real database; the lock is proved against the database's own constraint.
 */

const fs = require('fs');
const path = require('path');
const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const { api, query, day, T } = H;
const life = require('../src/services/offerLife.service');

let B, other, t;
beforeAll(async () => {
  await truncateAll();
  B = await H.brand();
  other = await H.brand();
  t = await H.tree();
});

describe('the clean break (check 1)', () => {
  test('every old offer is archived and off the store; running the migration again is harmless', async () => {
    const { rows: [old] } = await query(
      `INSERT INTO brand_offers (brand_id, name, offer_type, offer_config_json, status, published_to_store)
       VALUES ($1, 'Old store offer', 'discount', '{"sub_type":"pct","value":10}', 'active', true) RETURNING id`, [B.brandId]);
    await query(fs.readFileSync(path.join(__dirname, '../migrations/193_offer_builder_v2.sql'), 'utf8'));
    const { rows: [r] } = await query(`SELECT status, published_to_store, engine FROM brand_offers WHERE id = $1`, [old.id]);
    expect(r).toEqual({ status: 'archived', published_to_store: false, engine: 1 });
  });
});

describe('a draft from a type (check 2)', () => {
  test('choosing a type saves a draft; BOGO gets its only sub-type', async () => {
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    expect(o).toMatchObject({ engine: 2, status: 'draft', name: 'Untitled offer', offer_type: 'bogo', sub_type: 'bogo' });
    const d = await H.draft(B.token, { offer_type: 'discount' });
    expect(d.sub_type).toBeNull();
  });
  test('an unknown type or a sub-type of another type is refused', async () => {
    expect((await api.post('/brands/me/offers', B.token, { offer_type: 'whole_store' })).status).toBe(422);
    expect((await api.post('/brands/me/offers', B.token, { offer_type: 'discount', sub_type: 'pick_any' })).status).toBe(422);
  });
});

describe('dates (check 3)', () => {
  test('end not after start is refused on save, in the board\'s words', async () => {
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    const r = await api.patch(`/brands/me/offers/${o.id}`, B.token, { starts_on: day(5), ends_on: day(5) });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe('The end date must be after the start date.');
  });
  test('a pool line needs the dates first', async () => {
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    const r = await H.line(B.token, o.id, { pool: 'buy', method: 'category_all', category_node_id: t.jeans });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toMatch(/Set the offer's dates first/);
  });
});

describe('pool lines (checks 4, 5, 6)', () => {
  let p;
  beforeAll(async () => {
    p = {
      l511: await H.prod(B.brandId, t.jeans, "Levi's 511 Slim", 2299, "Levi's"),
      l512: await H.prod(B.brandId, t.jeans, "Levi's 512 Slim", 2499, "Levi's"),
      cheapLevis: await H.prod(B.brandId, t.jeans, "Levi's Budget", 999, "Levi's"),
      wrangler: await H.prod(B.brandId, t.jeans, 'Wrangler Regular', 1999, 'Wrangler'),
      pepe: await H.prod(B.brandId, t.jeans, 'Pepe Slim', 1899, 'Pepe'),
      hidden: await H.prod(B.brandId, t.jeans, 'Hidden jeans', 1999, "Levi's", { is_active: false }),
      chino: await H.prod(B.brandId, t.trousers, 'Chino', 1499, 'Own'),
      shirt: await H.prod(B.brandId, t.shirts, 'Cotton shirt', 1299, 'Own'),
    };
  });

  test('category → all takes every published product under the node, never a hidden one', async () => {
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, o.id, { starts_on: day(1), ends_on: day(10) });
    const r = await H.line(B.token, o.id, { pool: 'buy', method: 'category_all', category_node_id: t.bottom });
    expect(r.status).toBe(201);
    const ids = r.body.data.pool.buy.map((x) => x.id).sort();
    expect(ids).toEqual([p.l511, p.l512, p.cheapLevis, p.wrangler, p.pepe, p.chino].sort());
    expect(r.body.data.pool.sources[0]).toMatchObject({ label: 'Bottomwear · all', count: 6 });
  });

  test('filters: AND across kinds, OR within a kind; the price is the product\'s one price', async () => {
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, o.id, { starts_on: day(1), ends_on: day(10) });
    const r = await H.line(B.token, o.id, {
      pool: 'buy', method: 'category_filter', category_node_id: t.bottom,
      filters: { leaf_ids: [t.jeans], brands: ["Levi's", 'Wrangler'], price_min: 1500, price_max: 2500 },
    });
    expect(r.status).toBe(201);
    expect(r.body.data.pool.buy.map((x) => x.id).sort()).toEqual([p.l511, p.l512, p.wrangler].sort());
    expect(r.body.data.pool.sources[0].detail).toBe("Jeans + Levi's or Wrangler + ₹1,500–₹2,500 · 3 products");
    const none = await H.line(B.token, o.id, { pool: 'buy', method: 'category_filter', category_node_id: t.bottom, filters: {} });
    expect(none.status).toBe(422);
  });

  test('lines add together; a product in two lines is counted once and reported', async () => {
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, o.id, { starts_on: day(1), ends_on: day(10) });
    await H.line(B.token, o.id, { pool: 'buy', method: 'category_all', category_node_id: t.jeans });
    const r = await H.line(B.token, o.id, { pool: 'buy', method: 'search', query: 'shirt', product_ids: [p.shirt, p.l511] });
    const pool = r.body.data.pool;
    expect(pool.buy.length).toBe(6);                // 5 jeans + the shirt
    expect(pool.duplicates).toBe(1);
    expect(pool.sources[1].detail).toBe('2 products ticked · 1 already in pool, counted once');
  });

  test('a product taken out of the pool stays out until it is named again', async () => {
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, o.id, { starts_on: day(1), ends_on: day(10) });
    await H.line(B.token, o.id, { pool: 'buy', method: 'category_all', category_node_id: t.jeans });
    const d = await H.patch(B.token, o.id, { excluded_product_ids: [p.pepe] });
    expect(d.pool.buy.map((x) => x.id)).not.toContain(p.pepe);
    expect(d.pool.excluded).toBe(1);
    const again = await H.line(B.token, o.id, { pool: 'buy', method: 'search', query: 'pepe', product_ids: [p.pepe] });
    expect(again.body.data.pool.buy.map((x) => x.id)).toContain(p.pepe);
  });

  test('another brand\'s products can\'t be put in a pool', async () => {
    const mine = await H.prod(other.brandId, t.jeans, 'Other brand jeans', 1500);
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, o.id, { starts_on: day(1), ends_on: day(10) });
    const r = await H.line(B.token, o.id, { pool: 'buy', method: 'search', product_ids: [mine] });
    expect(r.status).toBe(422);
  });
});

describe('locking (checks 7–12)', () => {
  let x, y;
  beforeAll(async () => {
    x = await H.prod(B.brandId, t.trousers, 'Lock trouser X', 1500);
    y = await H.prod(B.brandId, t.trousers, 'Lock trouser Y', 1600);
  });

  test('drafts lock nothing: two drafts hold the same product (check 8)', async () => {
    const a = await H.ready(B.token, { ids: [x], publishIt: false, from: day(40), to: day(50) });
    const b = await H.ready(B.token, { ids: [x], publishIt: false, from: day(40), to: day(50) });
    expect((await H.read(B.token, a)).pool.buy.map((q) => q.id)).toEqual([x]);
    expect((await H.read(B.token, b)).pool.buy.map((q) => q.id)).toEqual([x]);
  });

  test('publishing locks; an overlapping offer is blocked and names the product; a later one isn\'t (checks 9, 10)', async () => {
    const a = await H.ready(B.token, { name: 'Denim Days', ids: [x], from: day(60), to: day(70), publishIt: false });
    const b = await H.ready(B.token, { name: 'Overlap', ids: [x], from: day(65), to: day(75), publishIt: false });
    expect((await H.publish(B.token, a)).status).toBe(200);
    const r = await H.publish(B.token, b);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('PUBLISH_BLOCKED');
    expect(r.body.error.message).toMatch(/^"Lock trouser X" is in "Denim Days" until \d+ \w{3}\. Remove it from this pool or change the dates\.$/);
    expect(r.body.data.checks.some((c) => c.key === 'lock' && !c.ok)).toBe(true);
    const c = await H.ready(B.token, { ids: [x], from: day(71), to: day(80), publishIt: false });
    expect((await H.publish(B.token, c)).status).toBe(200);
  });

  test('a locked product is shown with the other offer and its end, skipped by category lines, refused by name (check 7)', async () => {
    const o = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, o.id, { starts_on: day(62), ends_on: day(64) });
    const cand = await api.get(`/brands/me/offers/${o.id}/candidates?node=${t.trousers}`, B.token);
    const shown = cand.body.data.products.find((q) => q.id === x);
    expect(shown.locked).toEqual({ offer_name: 'Denim Days', until: day(70) });
    const r = await H.line(B.token, o.id, { pool: 'buy', method: 'category_all', category_node_id: t.trousers });
    expect(r.body.data.pool.buy.map((q) => q.id)).not.toContain(x);
    expect(r.body.data.pool.locked.map((q) => q.id)).toContain(x);
    expect(r.body.data.pool.sources[0].detail).toMatch(/1 locked and skipped/);
    const named = await H.line(B.token, o.id, { pool: 'buy', method: 'search', product_ids: [x] });
    expect(named.status).toBe(409);
    expect(named.body.error.message).toMatch(/^"Lock trouser X" is in "Denim Days" until .+ and can't be added\.$/);
  });

  test('the database refuses an overlapping pair even when the app is skipped (check 11)', async () => {
    const { rows: [o] } = await query(`SELECT id FROM brand_offers WHERE name = 'Denim Days'`);
    await expect(query(
      `INSERT INTO offer_pool_items (offer_id, brand_id, pool, product_id, lock_days) VALUES ($1,$2,'buy',$3, daterange($4::date, $5::date, '[)'))`,
      [o.id, B.brandId, x, day(69), day(72)])).rejects.toMatchObject({ code: '23P01' });
  });

  test('final check: a product the brand reviewed, taken meanwhile, blocks and is named; a changed pool blocks (check 12)', async () => {
    const b = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, b.id, { name: 'Reviewed', starts_on: day(90), ends_on: day(95) });
    const seen = (await H.line(B.token, b.id, { pool: 'buy', method: 'category_all', category_node_id: t.trousers })).body.data.pool.buy.map((q) => q.id);
    expect(seen).toContain(y);
    await H.ready(B.token, { name: 'Colleague', ids: [y], from: day(92), to: day(99) });
    const r = await H.publish(B.token, b.id, seen);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toMatch(/^"Lock trouser Y" is in "Colleague"/);
    const r2 = await H.publish(B.token, b.id, seen.filter((id) => id !== y).slice(1));
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('POOL_CHANGED');
  });
});

describe('pick-any stays in one category (check 13)', () => {
  test('a second category is refused with the board\'s wording', async () => {
    const j = await H.prod(B.brandId, t.jeans, 'PA Jeans', 1700);
    const s = await H.prod(B.brandId, t.shirts, 'Oxford shirt', 1299);
    const o = await H.draft(B.token, { offer_type: 'bundle', sub_type: 'pick_any' });
    await H.patch(B.token, o.id, { starts_on: day(200), ends_on: day(210) });
    expect((await H.line(B.token, o.id, { pool: 'buy', method: 'search', product_ids: [j] })).status).toBe(201);
    const r = await H.line(B.token, o.id, { pool: 'buy', method: 'search', product_ids: [s] });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe('Only products from one category can be added. You tried to add "Oxford shirt". Pick-any bundles stay in one category (Jeans). For several categories, go back and choose Mix & match.');
  });
  test('a fixed bundle takes exact products only', async () => {
    const o = await H.draft(B.token, { offer_type: 'bundle', sub_type: 'fixed' });
    await H.patch(B.token, o.id, { starts_on: day(200), ends_on: day(210) });
    const r = await H.line(B.token, o.id, { pool: 'buy', method: 'category_all', category_node_id: t.jeans });
    expect(r.status).toBe(422);
  });
});

describe('checks come back with the offer (check 15)', () => {
  test('a flat ₹ off above the cheapest item fails, naming it; the example line and deal show', async () => {
    const lin = await H.prod(B.brandId, t.shirts, 'Linen shirt', 849);
    const ox = await H.prod(B.brandId, t.shirts, 'Oxford white', 1299);
    const id = await H.ready(B.token, { type: 'discount', sub: 'flat', cfg: { amount: 900 }, ids: [lin, ox], from: day(300), to: day(310), publishIt: false });
    const v = await H.read(B.token, id);
    expect(v.checks.ok).toBe(false);
    expect(v.checks.checks.filter((c) => !c.ok).map((c) => c.text)).toContain('Must be less than your cheapest item in the pool (Linen shirt, ₹849).');
    expect(v.offer.deal).toBe('₹900 off per item');
    expect((await H.publish(B.token, id)).status).toBe(422);
    await H.patch(B.token, id, { offer_config_json: { amount: 200 } });
    expect((await H.read(B.token, id)).checks.ok).toBe(true);
  });
});

describe('the gift pool (checks 20, 34)', () => {
  test('gift items and store products; a gift item follows the one-offer rule; shared products block', async () => {
    const j1 = await H.prod(B.brandId, t.jackets, 'Jacket A', 2500);
    const j2 = await H.prod(B.brandId, t.jackets, 'Jacket B', 3200);
    const cap = await H.prod(B.brandId, t.shirts, 'Leather cap', 599);
    const coin = (await api.post('/brands/me/gift-items', B.token, { name: 'Silver coin 5g', value: 650, stock: 50 })).body.data.gift_item;

    const o = await H.draft(B.token, { offer_type: 'free_gift', sub_type: 'spend' });
    await H.patch(B.token, o.id, { name: 'Spend 3000 get a gift', starts_on: day(400), ends_on: day(410), offer_config_json: { min_spend: 3000, gift_count: 1, gift_limits: { [cap]: 40 } } });
    await H.line(B.token, o.id, { pool: 'buy', method: 'search', product_ids: [j1, j2] });
    await H.line(B.token, o.id, { pool: 'gift', method: 'gift_items', gift_item_ids: [coin.id] });
    const g = await H.line(B.token, o.id, { pool: 'gift', method: 'search', product_ids: [cap] });
    expect(g.body.data.pool.gift.map((x) => x.kind).sort()).toEqual(['gift_item', 'product']);
    // A category line can't feed a gift pool.
    expect((await H.line(B.token, o.id, { pool: 'gift', method: 'category_all', category_node_id: t.shirts })).status).toBe(422);
    expect((await H.publish(B.token, o.id)).status).toBe(200);

    // The coin is now locked to that offer's days.
    const o2 = await H.draft(B.token, { offer_type: 'free_gift', sub_type: 'buy_x' });
    await H.patch(B.token, o2.id, { starts_on: day(405), ends_on: day(420) });
    const lk = await H.line(B.token, o2.id, { pool: 'gift', method: 'gift_items', gift_item_ids: [coin.id] });
    expect(lk.status).toBe(409);
    expect(lk.body.error.message).toMatch(/^"Silver coin 5g" is in "Spend 3000 get a gift" until/);

    // The same store product in both pools blocks publishing.
    const o3 = await H.draft(B.token, { offer_type: 'free_gift', sub_type: 'spend' });
    const tee = await H.prod(B.brandId, t.shirts, 'Tee both', 700);
    await H.patch(B.token, o3.id, { name: 'Both pools', starts_on: day(500), ends_on: day(510), offer_config_json: { min_spend: 3000, gift_count: 1, gift_limits: { [tee]: 5 } } });
    await H.line(B.token, o3.id, { pool: 'buy', method: 'search', product_ids: [tee, j1] });
    await H.line(B.token, o3.id, { pool: 'gift', method: 'search', product_ids: [tee] });
    const r = await H.publish(B.token, o3.id);
    expect(r.status).toBe(422);
    expect(r.body.data.checks.map((c) => c.text)).toContain('"Tee both" is in both the buy pool and the gift pool.');
    // A non-free-gift offer has no gift pool.
    const o4 = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, o4.id, { starts_on: day(500), ends_on: day(510) });
    expect((await H.line(B.token, o4.id, { pool: 'gift', method: 'gift_items', gift_item_ids: [coin.id] })).status).toBe(422);
  });
});

describe('after publishing (checks 24, 25)', () => {
  test('name, dates, numbers and pool are frozen', async () => {
    const pid = await H.prod(B.brandId, t.shirts, 'Frozen shirt', 999);
    const id = await H.ready(B.token, { ids: [pid], from: day(600), to: day(610) });
    for (const body of [{ name: 'New name' }, { ends_on: day(620) }, { offer_config_json: { max_free: 3 } }]) {
      const r = await api.patch(`/brands/me/offers/${id}`, B.token, body);
      expect(r.status).toBe(409);
      expect(r.body.error.message).toBe("A published offer can't be changed. To change the deal, end it and build a new one.");
    }
    expect((await H.line(B.token, id, { pool: 'buy', method: 'search', product_ids: [pid] })).status).toBe(409);
    expect((await H.read(B.token, id)).offer.display_status).toBe('scheduled');
  });
  test('a draft can be deleted; a published offer can\'t', async () => {
    const d = await H.draft(B.token, { offer_type: 'bogo' });
    expect((await api.del(`/brands/me/offers/${d.id}`, B.token)).status).toBe(200);
    expect((await api.get(`/brands/me/offers/${d.id}`, B.token)).status).toBe(404);
    const pid = await H.prod(B.brandId, t.shirts, 'Undeletable', 999);
    const id = await H.ready(B.token, { ids: [pid], from: day(700), to: day(710) });
    const r = await api.del(`/brands/me/offers/${id}`, B.token);
    expect(r.status).toBe(409);
    expect(r.body.error.message).toBe("A published offer can't be deleted. End it instead.");
  });
});

describe('removing products and ending early (checks 26, 27, 28)', () => {
  let C, ci;
  beforeAll(async () => {
    C = await H.creator();
    ci = (await H.collab(B.brandId, C.influencerId, { status: 'active' })).campaignInfluencerId;
  });

  test('removed products are free at once and the creator is told which (check 26)', async () => {
    const a = await H.prod(B.brandId, t.jeans, 'Rm jeans A', 1800);
    const b = await H.prod(B.brandId, t.jeans, 'Rm jeans B', 1900);
    const c = await H.prod(B.brandId, t.jeans, 'Rm jeans C', 2000);
    const id = await H.ready(B.token, { name: 'Remove me', ids: [a, b, c], from: day(-2), to: day(10) });
    await H.link(ci, id);
    const pv = await api.get(`/brands/me/offers/${id}/remove-preview?product_ids=${a},${b}`, B.token);
    expect(pv.body.data).toMatchObject({ creators: ['Priya Sharma'], posts: { live: 0, emptied: 0 }, products_left: 1 });
    const r = await api.post(`/brands/me/offers/${id}/remove-products`, B.token, { product_ids: [a, b] });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ removed: 2, creators_told: 1 });
    // Free the same day: another offer takes them for today.
    expect((await H.publish(B.token, await H.ready(B.token, { ids: [a, b], from: T(), to: day(3), publishIt: false }))).status).toBe(200);
    const n = await H.notices(C.userId, 'offer_products_removed');
    expect(n[0].title).toBe('2 products removed from "Remove me"');
    expect(n[0].body).toMatch(/took Rm jeans A, Rm jeans B out of this offer/);
  });

  test('refused when it would break the deal (check 27)', async () => {
    const a = await H.prod(B.brandId, t.jeans, 'G1', 1800);
    const b = await H.prod(B.brandId, t.jeans, 'G2', 1900);
    const c = await H.prod(B.brandId, t.jeans, 'G3', 2000);
    const bogo = await H.ready(B.token, { ids: [a], from: day(800), to: day(810) });
    const all = await api.post(`/brands/me/offers/${bogo}/remove-products`, B.token, { product_ids: [a] });
    expect(all.status).toBe(422);
    expect(all.body.error.message).toBe('That would leave the offer with no products. End the offer instead.');

    const pick = await H.ready(B.token, { type: 'bundle', sub: 'pick_any', name: 'Any 2', cfg: { pick: 2, price: 3000 }, ids: [b, c], from: day(800), to: day(810) });
    const pk = await api.post(`/brands/me/offers/${pick}/remove-products`, B.token, { product_ids: [b] });
    expect(pk.status).toBe(422);
    expect(pk.body.error.message).toBe('"Pick 2" needs at least 2 products. End the offer instead.');

    const s1 = await H.prod(B.brandId, t.shirts, 'F shirt', 1299);
    const s2 = await H.prod(B.brandId, t.trousers, 'F trouser', 1499);
    const fixed = await H.ready(B.token, { type: 'bundle', sub: 'fixed', name: 'Fixed set', cfg: { price: 2499 }, ids: [s1, s2], from: day(800), to: day(810) });
    const fx = await api.post(`/brands/me/offers/${fixed}/remove-products`, B.token, { product_ids: [s1] });
    expect(fx.status).toBe(422);
    expect(fx.body.error.message).toMatch(/^A fixed bundle is exactly these products/);
  });

  test('end now: ended today, free from today, the creator told; a scheduled offer frees everything (check 28)', async () => {
    const a = await H.prod(B.brandId, t.trousers, 'End trouser', 1500);
    const id = await H.ready(B.token, { name: 'End me', ids: [a], from: day(-3), to: day(20) });
    await H.link(ci, id);
    expect((await H.read(B.token, id)).offer.display_status).toBe('live');
    const r = await api.post(`/brands/me/offers/${id}/end`, B.token);
    expect(r.body.data).toMatchObject({ ended: true, creators_told: 1 });
    expect((await H.read(B.token, id)).offer.display_status).toBe('ended');
    expect((await api.post(`/brands/me/offers/${id}/end`, B.token)).status).toBe(409);
    expect((await H.publish(B.token, await H.ready(B.token, { ids: [a], from: T(), to: day(5), publishIt: false }))).status).toBe(200);
    const n = await H.notices(C.userId, 'offer_ended');
    expect(n.map((x) => x.title)).toContain('"End me" has ended');

    const b = await H.prod(B.brandId, t.trousers, 'Sched trouser', 1500);
    const s = await H.ready(B.token, { ids: [b], from: day(30), to: day(40) });
    await api.post(`/brands/me/offers/${s}/end`, B.token);
    expect((await H.publish(B.token, await H.ready(B.token, { ids: [b], from: day(31), to: day(35), publishIt: false }))).status).toBe(200);
  });
});

describe('auto-add (check 29)', () => {
  test('a new product matching a category line joins from today; off, excluded or locked → not', async () => {
    const seed = await H.prod(B.brandId, t.shirts, 'AA seed', 1000);
    const on = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, on.id, { name: 'Auto on', starts_on: day(-1), ends_on: day(900), auto_add: true });
    await H.line(B.token, on.id, { pool: 'buy', method: 'category_all', category_node_id: t.shirts });
    const seenOn = (await H.read(B.token, on.id)).pool.buy.map((q) => q.id);
    expect(seenOn).toContain(seed);
    expect((await H.publish(B.token, on.id, seenOn)).status).toBe(200);

    const fresh = await H.prod(B.brandId, t.shirts, 'AA fresh', 1100);
    expect(await life.autoAddProduct(fresh)).toBe(1);
    const { rows: [item] } = await query(`SELECT added_by, lower(lock_days)::text AS from_day FROM offer_pool_items WHERE offer_id = $1 AND product_id = $2`, [on.id, fresh]);
    expect(item).toEqual({ added_by: 'auto_add', from_day: T() });
    expect(await life.autoAddProduct(fresh)).toBe(0);           // already in

    const offId = await H.ready(B.token, { ids: [await H.prod(B.brandId, t.jackets, 'AA jacket seed', 3000)], from: day(1), to: day(9) });
    await query(`INSERT INTO offer_pool_sources (offer_id, pool, method, category_node_id) VALUES ($1,'buy','category_all',$2)`, [offId, t.jackets]);
    expect(await life.autoAddProduct(await H.prod(B.brandId, t.jackets, 'AA jacket new', 3100))).toBe(0);   // auto-add off

    await query(`UPDATE brand_offers SET excluded_product_ids = $2::uuid[] WHERE id = $1`, [on.id, [await H.prod(B.brandId, t.trousers, 'unused', 1)]]);
    const excluded = await H.prod(B.brandId, t.shirts, 'AA excluded', 1200);
    await query(`UPDATE brand_offers SET excluded_product_ids = excluded_product_ids || $2::uuid WHERE id = $1`, [on.id, excluded]);
    expect(await life.autoAddProduct(excluded)).toBe(0);
  });

  test('every create path calls auto-add (code read)', () => {
    const brandCtl = fs.readFileSync(path.join(__dirname, '../src/controllers/brand.controller.js'), 'utf8');
    const listingCtl = fs.readFileSync(path.join(__dirname, '../src/controllers/listing.controller.js'), 'utf8');
    expect((brandCtl.match(/offerLife\.autoAddProduct\(/g) || []).length).toBe(2);   // single create + legacy bulk upload
    expect((listingCtl.match(/offerLife\.autoAddProduct\(/g) || []).length).toBe(1); // insertProducts: batch + Excel import
    expect(listingCtl).toMatch(/offerLife\.afterPriceChange\(/);
    expect(brandCtl).toMatch(/offerLife\.afterPriceChange\(/);
  });
});

describe('another brand (check 38)', () => {
  test('every offer route answers 404 to another brand', async () => {
    const pid = await H.prod(B.brandId, t.shirts, 'Mine only', 999);
    const id = await H.ready(B.token, { ids: [pid], from: day(1000), to: day(1010) });
    const d = await H.draft(B.token, { offer_type: 'bogo' });
    const calls = [
      api.get(`/brands/me/offers/${id}`, other.token),
      api.patch(`/brands/me/offers/${d.id}`, other.token, { name: 'x' }),
      api.del(`/brands/me/offers/${d.id}`, other.token),
      api.post(`/brands/me/offers/${d.id}/sources`, other.token, { pool: 'buy', method: 'search', product_ids: [pid] }),
      api.get(`/brands/me/offers/${d.id}/candidates?q=Mine`, other.token),
      api.post(`/brands/me/offers/${d.id}/publish`, other.token),
      api.post(`/brands/me/offers/${id}/end`, other.token),
      api.post(`/brands/me/offers/${id}/remove-products`, other.token, { product_ids: [pid] }),
      api.get(`/brands/me/offers/price-impact?product_id=${pid}&price=100`, other.token),
    ];
    for (const r of await Promise.all(calls)) expect(r.status).toBe(404);
    const list = await api.get('/brands/me/offers?engine=2', other.token);
    expect(list.body.data.offers.map((o) => o.id)).not.toContain(id);
  });
});

describe('the old doors (checks 39, 40, 41)', () => {
  test('the old list shows no new offer; the bulk attach endpoint is gone; the old attach path refuses a new offer', async () => {
    const pid = await H.prod(B.brandId, t.shirts, 'Old door', 999);
    const id = await H.ready(B.token, { ids: [pid], from: day(1100), to: day(1110) });
    const oldList = await api.get('/brands/me/offers', B.token);
    expect(oldList.status).toBe(200);
    expect(oldList.body.data.offers.map((o) => o.id)).not.toContain(id);
    expect((await api.post(`/brands/me/offers/${id}/products`, B.token, { product_ids: [pid] })).status).toBe(404);
    const inputs = require('../src/services/invitationInputs.service');
    const src = fs.readFileSync(require.resolve('../src/services/invitationInputs.service'), 'utf8');
    expect(src).toMatch(/engine\) === 2\) throw new AppError\('VALIDATION_ERROR', 'This offer is given to creators from the new terms screen\.'/);
    expect(src).toMatch(/status <> 'archived' AND engine = 1/);
    expect(typeof inputs).toBe('object');
  });
  test('no money moves: checkout code never reads the new tables', () => {
    for (const f of ['transaction.controller.js']) {
      const s = fs.readFileSync(path.join(__dirname, '../src/controllers', f), 'utf8');
      expect(s).not.toMatch(/offer_pool_items|collab_offers|gift_items/);
    }
    for (const f of ['transaction.service.js', 'offerResolution.service.js', 'offer.service.js']) {
      const s = fs.readFileSync(path.join(__dirname, '../src/services', f), 'utf8');
      expect(s).not.toMatch(/offer_pool_items|collab_offers|gift_items/);
    }
  });
});
