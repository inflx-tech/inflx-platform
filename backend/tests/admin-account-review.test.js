'use strict';

/**
 * Admin account review — the fields the admin pages need, and the ones a brand must
 * never receive. Contract: features/admin-account-review
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  createAdminUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

async function scenario() {
  const brandUser = await createBrandUser();
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.user.id]);
  const brand = await registerBrand(brandUser.token, {
    business_name: 'Kanchi Silks',
    category: 'Fashion',
    address_line: 'House no. 225/7',
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    pincode: '520001',
  });

  const infUser = await createInfluencerUser();
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.user.id]);
  const inf = await registerInfluencer(infUser.token);

  const admin = await createAdminUser('superadmin');
  return { brandToken: brandUser.token, brand, inf, adminToken: admin.token };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /influencers/:id — admin sees more, a brand sees no more', () => {
  /**
   * This endpoint is requireRole('brand', 'admin'). The admin account page needs a
   * creator's phone, balances and TDS settings; a BRAND must never receive any of them.
   * That is why those fields are attached in a separate gated block rather than added to
   * the shared select — and why this test exists rather than a comment saying so.
   */
  const PRIVATE = ['phone', 'wallet_balance', 'pending_balance', 'tds_exempt', 'tds_override_pct'];

  it("does not hand a brand a creator's phone number or earnings", async () => {
    const { brandToken, inf } = await scenario();

    const res = await request(app)
      .get(`/v1/influencers/${inf.id}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);
    for (const key of PRIVATE) {
      expect(res.body.data.influencer[key]).toBeUndefined();
    }
  });

  it('gives an admin the fields the account page needs', async () => {
    const { adminToken, inf } = await scenario();

    const res = await request(app)
      .get(`/v1/influencers/${inf.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data.influencer;
    expect(body.phone).toBeDefined();
    expect(body.created_at).toBeDefined();
    expect(body).toHaveProperty('wallet_balance');
    expect(body).toHaveProperty('pending_balance');
  });

  it('sends created_at to a brand too — when she joined is not private', async () => {
    const { brandToken, inf } = await scenario();
    const res = await request(app)
      .get(`/v1/influencers/${inf.id}`)
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.body.data.influencer.created_at).toBeDefined();
  });
});

describe('GET /brands/:id — the city the admin page could never show', () => {
  /**
   * A brand's city and state live on the USER row; there is no brands.city column. The
   * admin page asked for brand.city and therefore printed a dash for every brand ever
   * reviewed.
   */
  it('carries city and state so the review page can show where they are', async () => {
    const { adminToken, brand } = await scenario();

    const res = await request(app)
      .get(`/v1/brands/${brand.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.brand.city).toBe('Vijayawada');
    expect(res.body.data.brand.state).toBe('Andhra Pradesh');
  });

  it('carries the address fields the review page needs', async () => {
    const { adminToken, brand } = await scenario();

    const res = await request(app)
      .get(`/v1/brands/${brand.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const b = res.body.data.brand;
    expect(b.business_name).toBe('Kanchi Silks');
    expect(b.address_line).toBe('House no. 225/7');
    expect(b.pincode).toBe('520001');
    // The status the page badges. It asked for `status`; the server calls it user_status.
    expect(b.user_status).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 2 — the creator list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/influencers — the list that never existed', () => {
  /**
   * Admin -> Influencers was a CSV upload box. A creator's page existed but nothing
   * linked to it, so it could only be opened by typing an internal id into the address
   * bar. Twenty-two creators were unreachable from the admin.
   */
  it('lists creators with the fields the page renders', async () => {
    const { adminToken } = await scenario();

    const res = await request(app)
      .get('/v1/admin/influencers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const list = res.body.data.influencers;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);

    const row = list[0];
    for (const key of ['id', 'instagram_handle', 'city', 'status', 'phone', 'created_at']) {
      expect(row).toHaveProperty(key);
    }
    // Counted live, never stored — the same rule as everywhere else.
    expect(typeof row.inflx_followers).toBe('number');
  });

  it('reports how many are in each state', async () => {
    const { adminToken } = await scenario();
    const res = await request(app)
      .get('/v1/admin/influencers')
      .set('Authorization', `Bearer ${adminToken}`);

    const s = res.body.data.summary;
    expect(s.total).toBeGreaterThan(0);
    expect(s).toHaveProperty('approved');
    expect(s).toHaveProperty('pending');
  });

  it('finds a creator by phone number, not just by name', async () => {
    const { adminToken, inf } = await scenario();
    const { rows } = await query(
      `SELECT u.phone FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
      [inf.id]
    );

    const res = await request(app)
      .get(`/v1/admin/influencers?search=${encodeURIComponent(rows[0].phone)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.influencers.map(x => x.id)).toContain(inf.id);
  });

  it('is closed to a brand', async () => {
    const { brandToken } = await scenario();
    const res = await request(app)
      .get('/v1/admin/influencers')
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.status).toBe(403);
  });
});
