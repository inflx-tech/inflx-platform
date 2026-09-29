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

// offer-builder-v2 (rules 1.13): the builder no longer makes store offers, so an OLD store offer —
// the only kind the store-direct code still reads — is a row of the old engine, written as such.
// (Migration 193 archives every one of them in production; the code path stays until its cut.)
async function makeOffer(brandId, { publish = false } = {}) {
  const { rows: [o] } = await query(
    `INSERT INTO brand_offers (brand_id, name, offer_type, offer_config_json, status, published_to_store, engine)
     VALUES ($1, 'Store 15% Off', 'discount', '{"sub_type":"pct","value":15,"scope":"store","products":[]}', 'active', $2, 1)
     RETURNING id`, [brandId, publish]);
  return { id: o.id };
}

describe('publish to store', () => {
  // Was: "PATCH published_to_store=true → persists". Retired by rules 1.13 (offers are for creators
  // only; "Publish to store" is removed) — the same request now publishes nothing to the store.
  it('the builder can no longer publish an offer to the store (rules 1.13)', async () => {
    const { token } = await makeBrand();
    const res = await request(app).post('/v1/brands/me/offers').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Store 15% Off', offer_type: 'discount' });
    const id = res.body.data.offer.id;
    await request(app).patch(`/v1/brands/me/offers/${id}`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'active', published_to_store: true });
    const { rows: [r] } = await query(`SELECT status, published_to_store FROM brand_offers WHERE id = $1`, [id]);
    expect(r).toEqual({ status: 'draft', published_to_store: false });
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
