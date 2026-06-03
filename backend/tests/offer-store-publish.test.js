'use strict';

/**
 * QA — offer-engine-store-publish (Sub-contract D, Phase 1: publish + surfacing).
 * Asserts: brand can publish an offer to its store; resolveBusinessStore surfaces
 * published+active store offers in a distinct store_offers array; unpublished
 * offers are excluded; migration 085 provenance columns exist.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');

beforeEach(async () => { await truncateAll(); });

async function approve(userId) { await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]); }

async function makeBrand() {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token);
  await approve(user.id);
  return { token, brandId: brand.id };
}

async function makeOffer(token, { publish = false } = {}) {
  const res = await request(app).post('/v1/brands/me/offers').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Store 15% Off', offer_type: 'discount', offer_config_json: { sub_type: 'pct', value: 15, scope: 'store', products: [] } });
  const id = res.body.data.offer.id;
  const patch = { status: 'active' };
  if (publish) patch.published_to_store = true;
  const up = await request(app).patch(`/v1/brands/me/offers/${id}`).set('Authorization', `Bearer ${token}`).send(patch);
  return { id, offer: up.body.data.offer };
}

describe('publish to store', () => {
  it('PATCH published_to_store=true → persists', async () => {
    const { token } = await makeBrand();
    const { offer } = await makeOffer(token, { publish: true });
    expect(offer.published_to_store).toBe(true);
    expect(offer.status).toBe('active');
  });
});

describe('store surfacing (resolveBusinessStore)', () => {
  it('published+active offer appears in store_offers (brand-direct, no influencer)', async () => {
    const { token, brandId } = await makeBrand();
    const { id } = await makeOffer(token, { publish: true });

    const res = await request(app).get(`/v1/business/${brandId}/store`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.store_offers)).toBe(true);
    expect(res.body.data.store_offers).toHaveLength(1);
    expect(res.body.data.store_offers[0].brand_offer_id).toBe(id);
    expect(res.body.data.store_offers[0].offer_source).toBe('store');
    expect(res.body.data.store_offers[0].offer_type).toBe('discount');
  });

  it('unpublished offer is NOT surfaced', async () => {
    const { token, brandId } = await makeBrand();
    await makeOffer(token, { publish: false });   // active but not published
    const res = await request(app).get(`/v1/business/${brandId}/store`);
    expect(res.status).toBe(200);
    expect(res.body.data.store_offers).toHaveLength(0);
  });
});

describe('migration 085 provenance columns', () => {
  it('follower_transactions has brand_offer_id + offer_source', async () => {
    const { rows } = await query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'follower_transactions'
          AND column_name IN ('brand_offer_id','offer_source')
        ORDER BY column_name`
    );
    expect(rows.map(r => r.column_name)).toEqual(['brand_offer_id', 'offer_source']);
  });
});
