'use strict';

/**
 * QA — offer-engine Sub-contract A. Asserts features/offer-engine/02-workflow.md
 * and 03-expected-outputs.md against a real Postgres DB.
 *
 * Coverage (workflow step → test):
 *   1   create discount → 201, draft, brand-scoped
 *   2   create volume/bogo/bundle/free_gift → 201, config round-trips
 *   3   list → only this brand's offers + status counts
 *   4   patch status → active
 *   5   delete → soft-archive (row remains, status='archived')
 *   6   get another brand's offer id → 404
 *   7   invalid offer_type → 422 field=offer_type, no row
 *   8   product not owned by brand → 422 field=offer_config_json.products
 *   +   auth gates: no token → 401; non-brand token → 403
 *   +   schema: campaign_influencers gained brand_offer_id + allocation (nullable)
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function seedBrand() {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token);
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [user.id]);
  return { token, brandId: brand.id };
}

async function seedProduct(brandId, name = 'Air Runner X', price = 2499) {
  const { rows } = await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active)
     VALUES ($1, $2, $3, true) RETURNING id`,
    [brandId, name, price]
  );
  return rows[0].id;
}

const discountBody = (over = {}) => ({
  name: 'Monsoon 20% Off — Footwear',
  offer_type: 'discount',
  offer_config_json: { sub_type: 'pct', value: 20, scope: 'category', category: 'Footwear', products: [] },
  ...over,
});

// ── 1. create — offer-builder-v2 ─────────────────────────────────────────────
// The old builder's create contract (whole-store scopes, fixed-id shapes, availing modes, store
// publishing) was retired by Docs/OFFER_TERMS_POSTS_RULES.md §1.13 (28 Sep 2026). The tests below
// keep the same endpoint and the same numbering, and assert the rule that replaced each one.
// The full new builder is proved in offers-v2-rules / offers-v2-flow / offers-v2-listings.
describe('create', () => {
  test('1: create starts a new-builder draft → 201, draft, brand-scoped, nothing on the store', async () => {
    const { token, brandId } = await seedBrand();
    const res = await request(app).post('/v1/brands/me/offers').set(auth(token)).send(discountBody());
    expect(res.status).toBe(201);
    expect(res.body.data.offer.status).toBe('draft');
    expect(res.body.data.offer.engine).toBe(2);
    expect(res.body.data.offer.brand_id).toBe(brandId);
    const { rows } = await query(
      `SELECT count(*)::int n, bool_or(published_to_store) AS store, max(array_length(availing_modes, 1)) AS modes
         FROM brand_offers WHERE brand_id = $1`, [brandId]);
    expect(rows[0]).toEqual({ n: 1, store: false, modes: null });   // "Pay at store / Online / Pre-book" retired
  });

  test('2: all five types start a draft; the old shapes are not stored (clean break)', async () => {
    const { token, brandId } = await seedBrand();
    const p1 = await seedProduct(brandId, 'Sneaker', 2499);
    const p2 = await seedProduct(brandId, 'Socks', 199);
    const bodies = [
      discountBody(),
      { name: 'Volume', offer_type: 'volume', offer_config_json: { tiers: [{ min_spend: 2000, pct_off: 5 }], scope: 'store', products: [] } },
      { name: 'BOGO', offer_type: 'bogo', offer_config_json: { buy_product: { id: p1 }, get_product: { id: p2 } } },
      { name: 'Bundle', offer_type: 'bundle', offer_config_json: { products: [{ id: p1 }, { id: p2 }], bundle_price: 1499 } },
      { name: 'Gift', offer_type: 'free_gift', offer_config_json: { offers: [{ main: { id: p1 }, gift: { id: p2 } }] } },
    ];
    for (const b of bodies) {
      const res = await request(app).post('/v1/brands/me/offers').set(auth(token)).send(b);
      expect(res.status).toBe(201);
      expect(res.body.data.offer.offer_type).toBe(b.offer_type);
      expect(res.body.data.offer.offer_config_json).toEqual({});
      expect(res.body.data.offer.sub_type).toBe(b.offer_type === 'bogo' ? 'bogo' : null);
    }
  });

  test('7: invalid offer_type → 422 field=offer_type, no row', async () => {
    const { token, brandId } = await seedBrand();
    const res = await request(app).post('/v1/brands/me/offers').set(auth(token))
      .send(discountBody({ offer_type: 'nonsense' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('offer_type');
    const { rows } = await query(`SELECT count(*)::int n FROM brand_offers WHERE brand_id = $1`, [brandId]);
    expect(rows[0].n).toBe(0);
  });

  test("8: a product not owned by the brand can't enter a pool → 422 field=product_ids", async () => {
    const { token } = await seedBrand();
    const other = await seedBrand();
    const foreignProduct = await seedProduct(other.brandId, 'Foreign', 999);
    const d = await request(app).post('/v1/brands/me/offers').set(auth(token)).send({ offer_type: 'discount', sub_type: 'flat' });
    const id = d.body.data.offer.id;
    await request(app).patch(`/v1/brands/me/offers/${id}`).set(auth(token)).send({ starts_on: '2099-01-01', ends_on: '2099-01-31' });
    const res = await request(app).post(`/v1/brands/me/offers/${id}/sources`).set(auth(token))
      .send({ pool: 'buy', method: 'search', product_ids: [foreignProduct] });
    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('product_ids');
  });

  test("malformed bundle (no price) can't be published → 422, the check names it", async () => {
    const { token, brandId } = await seedBrand();
    const p1 = await seedProduct(brandId, 'A'); const p2 = await seedProduct(brandId, 'B');
    const d = await request(app).post('/v1/brands/me/offers').set(auth(token)).send({ offer_type: 'bundle', sub_type: 'mix_match' });
    const id = d.body.data.offer.id;
    await request(app).patch(`/v1/brands/me/offers/${id}`).set(auth(token))
      .send({ name: 'Bundle', starts_on: '2099-01-01', ends_on: '2099-01-31', offer_config_json: { pick: 2 } });
    const line = await request(app).post(`/v1/brands/me/offers/${id}/sources`).set(auth(token))
      .send({ pool: 'buy', method: 'search', product_ids: [p1, p2] });
    expect(line.status).toBe(201);
    const res = await request(app).post(`/v1/brands/me/offers/${id}/publish`).set(auth(token)).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Enter the bundle price.');
  });
});

// ── 3/4/5. list, update, delete ───────────────────────────────────────────────
describe('list / update / archive', () => {
  const oldOffer = (brandId, name) => query(
    `INSERT INTO brand_offers (brand_id, name, offer_type, offer_config_json, status, engine)
     VALUES ($1, $2, 'discount', '{}', 'draft', 1)`, [brandId, name]);

  test('3: list returns only this brand, with status counts (old list: old offers; engine=2: new)', async () => {
    const a = await seedBrand();
    const b = await seedBrand();
    await oldOffer(a.brandId, 'A1'); await oldOffer(a.brandId, 'A2'); await oldOffer(b.brandId, 'B1');
    await request(app).post('/v1/brands/me/offers').set(auth(a.token)).send(discountBody({ name: 'A-new' }));
    const res = await request(app).get('/v1/brands/me/offers').set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body.data.offers).toHaveLength(2);
    expect(res.body.data.offers.every(o => o.name.startsWith('A'))).toBe(true);
    expect(res.body.data.counts.all).toBe(2);
    expect(res.body.data.counts.draft).toBe(2);
    const v2 = await request(app).get('/v1/brands/me/offers?engine=2').set(auth(a.token));
    expect(v2.body.data.offers).toHaveLength(1);
    expect(v2.body.data.counts.draft).toBe(1);
  });

  test("4: status can't be set by hand; 5: a draft is deleted outright (a published one is only ended)", async () => {
    const { token } = await seedBrand();
    const created = await request(app).post('/v1/brands/me/offers').set(auth(token)).send(discountBody());
    const id = created.body.data.offer.id;
    const patched = await request(app).patch(`/v1/brands/me/offers/${id}`).set(auth(token)).send({ status: 'active' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.offer.status).toBe('draft');   // Draft → Scheduled/Live only by publishing
    const del = await request(app).delete(`/v1/brands/me/offers/${id}`).set(auth(token));
    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(true);
    const { rows } = await query(`SELECT count(*)::int n FROM brand_offers WHERE id = $1`, [id]);
    expect(rows[0].n).toBe(0);
  });

  test('6: fetching another brand offer id → 404', async () => {
    const a = await seedBrand();
    const b = await seedBrand();
    const bOffer = await request(app).post('/v1/brands/me/offers').set(auth(b.token)).send(discountBody());
    const res = await request(app).get(`/v1/brands/me/offers/${bOffer.body.data.offer.id}`).set(auth(a.token));
    expect(res.status).toBe(404);
  });
});

// ── auth gates ────────────────────────────────────────────────────────────────
describe('auth', () => {
  test('no token → 401', async () => {
    const res = await request(app).get('/v1/brands/me/offers');
    expect(res.status).toBe(401);
  });

  test('non-brand (influencer) token → 403', async () => {
    const { token } = await createInfluencerUser();
    await registerInfluencer(token);
    const res = await request(app).get('/v1/brands/me/offers').set(auth(token));
    expect(res.status).toBe(403);
  });
});

// ── schema: dormant additive columns landed ───────────────────────────────────
describe('schema', () => {
  test('campaign_influencers gained brand_offer_id + allocation (nullable)', async () => {
    const { rows } = await query(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='campaign_influencers'
          AND column_name IN ('brand_offer_id','allocation')
        ORDER BY column_name`
    );
    expect(rows.map(r => r.column_name)).toEqual(['allocation', 'brand_offer_id']);
    expect(rows.every(r => r.is_nullable === 'YES')).toBe(true);
  });
});
