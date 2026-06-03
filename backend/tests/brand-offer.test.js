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

// ── 1. create discount ────────────────────────────────────────────────────────
describe('create', () => {
  test('1: valid discount → 201, draft, brand-scoped', async () => {
    const { token, brandId } = await seedBrand();
    const res = await request(app).post('/v1/brands/me/offers').set(auth(token)).send(discountBody());
    expect(res.status).toBe(201);
    expect(res.body.data.offer.status).toBe('draft');
    expect(res.body.data.offer.brand_id).toBe(brandId);
    expect(res.body.data.offer.published_to_store).toBe(false);
    // availing_modes DB default
    expect(res.body.data.offer.availing_modes).toEqual(
      expect.arrayContaining(['pay_at_store', 'online_order'])
    );
    const { rows } = await query(`SELECT count(*)::int n FROM brand_offers WHERE brand_id = $1`, [brandId]);
    expect(rows[0].n).toBe(1);
  });

  test('2: all five types create and round-trip byte-for-byte', async () => {
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
      expect(res.body.data.offer.offer_config_json).toEqual(b.offer_config_json);
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

  test('8: referenced product not owned by brand → 422 field=offer_config_json.products', async () => {
    const { token } = await seedBrand();
    const other = await seedBrand();
    const foreignProduct = await seedProduct(other.brandId, 'Foreign', 999);
    const res = await request(app).post('/v1/brands/me/offers').set(auth(token)).send({
      name: 'Bad scope', offer_type: 'discount',
      offer_config_json: { sub_type: 'flat', value: 100, scope: 'products', products: [{ id: foreignProduct }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('offer_config_json.products');
  });

  test('malformed bundle (no price) → 422', async () => {
    const { token, brandId } = await seedBrand();
    const p1 = await seedProduct(brandId, 'A'); const p2 = await seedProduct(brandId, 'B');
    const res = await request(app).post('/v1/brands/me/offers').set(auth(token)).send({
      name: 'Bundle', offer_type: 'bundle', offer_config_json: { products: [{ id: p1 }, { id: p2 }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('offer_config_json.bundle_price');
  });
});

// ── 3/4/5. list, update, archive ──────────────────────────────────────────────
describe('list / update / archive', () => {
  test('3: list returns only this brand, with status counts', async () => {
    const a = await seedBrand();
    const b = await seedBrand();
    await request(app).post('/v1/brands/me/offers').set(auth(a.token)).send(discountBody({ name: 'A1' }));
    await request(app).post('/v1/brands/me/offers').set(auth(a.token)).send(discountBody({ name: 'A2' }));
    await request(app).post('/v1/brands/me/offers').set(auth(b.token)).send(discountBody({ name: 'B1' }));

    const res = await request(app).get('/v1/brands/me/offers').set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body.data.offers).toHaveLength(2);
    expect(res.body.data.offers.every(o => o.name.startsWith('A'))).toBe(true);
    expect(res.body.data.counts.all).toBe(2);
    expect(res.body.data.counts.draft).toBe(2);
  });

  test('4: patch status → active; 5: delete → archived (row remains)', async () => {
    const { token } = await seedBrand();
    const created = await request(app).post('/v1/brands/me/offers').set(auth(token)).send(discountBody());
    const id = created.body.data.offer.id;

    const patched = await request(app).patch(`/v1/brands/me/offers/${id}`).set(auth(token)).send({ status: 'active' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.offer.status).toBe('active');

    const del = await request(app).delete(`/v1/brands/me/offers/${id}`).set(auth(token));
    expect(del.status).toBe(200);
    expect(del.body.data.offer.status).toBe('archived');
    const { rows } = await query(`SELECT status FROM brand_offers WHERE id = $1`, [id]);
    expect(rows[0].status).toBe('archived'); // soft archive — row still present
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
