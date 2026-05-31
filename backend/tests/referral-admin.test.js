'use strict';

/**
 * QA — referral-admin-controls (Contract 2). Asserts the expected outputs in
 * features/referral-admin-controls/03-expected-outputs.md against a real DB.
 * Covers settings round-trip + RBAC, edge create/edit/end + guards, and the
 * ledger/summary read views (seeded via the Contract-1 engine).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createAdminUser,
  createInfluencerUser,
  registerInfluencer,
  createBrandUser,
  registerBrand,
} = require('./helpers/factories');
const referralService = require('../src/services/referral.service');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

let h = 0;
async function seedInfluencer() {
  h += 1;
  const { token, user } = await createInfluencerUser();
  const inf = await registerInfluencer(token, { instagram_handle: `radm_${h}_${Date.now()}` });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return inf; // { id, instagram_handle, ... }
}
async function seedBrand() {
  const { token, user } = await createBrandUser();
  await registerBrand(token);
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  const { rows } = await query(`SELECT id, business_name FROM brands WHERE user_id=$1`, [user.id]);
  return rows[0];
}

beforeEach(async () => {
  await truncateAll();
  // referral_settings is the seeded singleton (NOT in truncateAll) — reset it.
  await query(
    `INSERT INTO referral_settings (id, default_pct) VALUES (1, 25.00)
     ON CONFLICT (id) DO UPDATE SET default_pct = 25.00, updated_by_admin_id = NULL, updated_at = now()`
  );
});

// ── Settings ────────────────────────────────────────────────────────────────

describe('Referral admin — settings', () => {
  test('A1: GET /settings returns default_pct 25 + 12-month window (any admin)', async () => {
    const { token } = await createAdminUser('reviewer');
    const res = await request(app).get('/v1/admin/referrals/settings').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.default_pct).toBe(25);
    expect(res.body.data.window_months).toBe(12);
  });

  test('A2: superadmin PATCH default_pct=30 persists', async () => {
    const { token, user } = await createAdminUser('superadmin');
    const res = await request(app).patch('/v1/admin/referrals/settings').set(auth(token)).send({ default_pct: 30 });
    expect(res.status).toBe(200);
    expect(res.body.data.default_pct).toBe(30);
    const { rows } = await query(`SELECT default_pct, updated_by_admin_id FROM referral_settings WHERE id=1`);
    expect(parseFloat(rows[0].default_pct)).toBe(30);
    expect(rows[0].updated_by_admin_id).toBe(user.id);
  });

  test('A3: non-superadmin PATCH → 403, value unchanged', async () => {
    const { token } = await createAdminUser('reviewer');
    const res = await request(app).patch('/v1/admin/referrals/settings').set(auth(token)).send({ default_pct: 99 });
    expect(res.status).toBe(403);
    const { rows } = await query(`SELECT default_pct FROM referral_settings WHERE id=1`);
    expect(parseFloat(rows[0].default_pct)).toBe(25);
  });

  test('D12: PATCH out-of-range → 422', async () => {
    const { token } = await createAdminUser('superadmin');
    const res = await request(app).patch('/v1/admin/referrals/settings').set(auth(token)).send({ default_pct: 150 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── Edges ─────────────────────────────────────────────────────────────────

describe('Referral admin — edges', () => {
  test('B5: superadmin POST (pct omitted) → 201, pct=default, source=admin, active', async () => {
    const { token } = await createAdminUser('superadmin');
    const inf = await seedInfluencer();
    const brand = await seedBrand();
    const res = await request(app).post('/v1/admin/referrals/edges').set(auth(token)).send({
      referrer_type: 'influencer', referrer_id: inf.id,
      referred_type: 'brand', referred_id: brand.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.pct).toBe(25);
    expect(res.body.data.source).toBe('admin');
    expect(res.body.data.status).toBe('active');
    const { rows } = await query(`SELECT created_by_admin_id, expires_at, started_at FROM referral_edges WHERE id=$1`, [res.body.data.id]);
    expect(rows[0].created_by_admin_id).not.toBeNull();
    // ~12 months window
    const months = (new Date(rows[0].expires_at) - new Date(rows[0].started_at)) / (1000 * 60 * 60 * 24);
    expect(months).toBeGreaterThan(330);
  });

  test('B4: GET /edges resolves referrer/referred names', async () => {
    const { token } = await createAdminUser('finance');
    const sup = await createAdminUser('superadmin');
    const inf = await seedInfluencer();
    const brand = await seedBrand();
    await request(app).post('/v1/admin/referrals/edges').set(auth(sup.token)).send({
      referrer_type: 'influencer', referrer_id: inf.id, referred_type: 'brand', referred_id: brand.id, pct: 25,
    });
    const res = await request(app).get('/v1/admin/referrals/edges').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].referrer_name).toBe(inf.instagram_handle);
    expect(res.body.data[0].referred_name).toBe(brand.business_name);
  });

  test('B6: PATCH pct updates the edge', async () => {
    const sup = await createAdminUser('superadmin');
    const inf = await seedInfluencer();
    const brand = await seedBrand();
    const c = await request(app).post('/v1/admin/referrals/edges').set(auth(sup.token)).send({
      referrer_type: 'influencer', referrer_id: inf.id, referred_type: 'brand', referred_id: brand.id,
    });
    const res = await request(app).patch(`/v1/admin/referrals/edges/${c.body.data.id}`).set(auth(sup.token)).send({ pct: 40 });
    expect(res.status).toBe(200);
    expect(res.body.data.pct).toBe(40);
  });

  test('B7: PATCH status=ended frees the referred entity for a new active edge', async () => {
    const sup = await createAdminUser('superadmin');
    const inf1 = await seedInfluencer();
    const inf2 = await seedInfluencer();
    const brand = await seedBrand();
    const c = await request(app).post('/v1/admin/referrals/edges').set(auth(sup.token)).send({
      referrer_type: 'influencer', referrer_id: inf1.id, referred_type: 'brand', referred_id: brand.id,
    });
    const end = await request(app).patch(`/v1/admin/referrals/edges/${c.body.data.id}`).set(auth(sup.token)).send({ status: 'ended' });
    expect(end.status).toBe(200);
    expect(end.body.data.status).toBe('ended');
    expect(end.body.data.ended_at).not.toBeNull();
    // now a NEW active edge for the same brand is allowed
    const c2 = await request(app).post('/v1/admin/referrals/edges').set(auth(sup.token)).send({
      referrer_type: 'influencer', referrer_id: inf2.id, referred_type: 'brand', referred_id: brand.id,
    });
    expect(c2.status).toBe(201);
  });

  test('D10: POST duplicating an active referred entity → 409', async () => {
    const sup = await createAdminUser('superadmin');
    const inf1 = await seedInfluencer();
    const inf2 = await seedInfluencer();
    const brand = await seedBrand();
    await request(app).post('/v1/admin/referrals/edges').set(auth(sup.token)).send({
      referrer_type: 'influencer', referrer_id: inf1.id, referred_type: 'brand', referred_id: brand.id,
    });
    const dup = await request(app).post('/v1/admin/referrals/edges').set(auth(sup.token)).send({
      referrer_type: 'influencer', referrer_id: inf2.id, referred_type: 'brand', referred_id: brand.id,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('D11: POST self-referral → 422', async () => {
    const sup = await createAdminUser('superadmin');
    const inf = await seedInfluencer();
    const res = await request(app).post('/v1/admin/referrals/edges').set(auth(sup.token)).send({
      referrer_type: 'influencer', referrer_id: inf.id, referred_type: 'influencer', referred_id: inf.id,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('D13: non-superadmin POST → 403', async () => {
    const { token } = await createAdminUser('reviewer');
    const inf = await seedInfluencer();
    const brand = await seedBrand();
    const res = await request(app).post('/v1/admin/referrals/edges').set(auth(token)).send({
      referrer_type: 'influencer', referrer_id: inf.id, referred_type: 'brand', referred_id: brand.id,
    });
    expect(res.status).toBe(403);
  });
});

// ── Ledger + summary ────────────────────────────────────────────────────────

describe('Referral admin — ledger + summary', () => {
  test('C8: ledger + summary reflect engine-written rows with names + amounts', async () => {
    const { token } = await createAdminUser('finance');
    const referrer = await seedInfluencer();
    const referred = await seedInfluencer();
    await referralService.createEdge({
      referrerType: 'influencer', referrerId: referrer.id,
      referredType: 'influencer', referredId: referred.id, pct: 25, source: 'admin',
    });
    // engine writes a commission ledger row (base 448 → amount 112, auto-paid)
    await referralService.accrue({
      source: 'commission', sourceRefId: '00000000-0000-0000-0000-0000000000c8',
      referredType: 'influencer', referredId: referred.id, baseAmount: 448,
    });

    const ledger = await request(app).get('/v1/admin/referrals/ledger').set(auth(token));
    expect(ledger.status).toBe(200);
    expect(ledger.body.meta.total).toBe(1);
    expect(ledger.body.data[0].amount).toBe(112);
    expect(ledger.body.data[0].source).toBe('commission');
    expect(ledger.body.data[0].payout_status).toBe('paid');
    expect(ledger.body.data[0].referrer_name).toBe(referrer.instagram_handle);
    expect(ledger.body.data[0].referred_name).toBe(referred.instagram_handle);

    const summary = await request(app).get('/v1/admin/referrals/summary').set(auth(token));
    expect(summary.status).toBe(200);
    expect(summary.body.data.totals.earned).toBe(112);
    expect(summary.body.data.totals.paid).toBe(112);
    expect(summary.body.data.totals.pending).toBe(0);
    expect(summary.body.data.by_referrer.length).toBe(1);
  });

  test('C9: empty DB → ledger [] + zeroed summary, no crash', async () => {
    const { token } = await createAdminUser('reviewer');
    const ledger = await request(app).get('/v1/admin/referrals/ledger').set(auth(token));
    expect(ledger.status).toBe(200);
    expect(ledger.body.data).toEqual([]);
    expect(ledger.body.meta.total).toBe(0);
    const summary = await request(app).get('/v1/admin/referrals/summary').set(auth(token));
    expect(summary.status).toBe(200);
    expect(summary.body.data.totals.earned).toBe(0);
    expect(summary.body.data.totals.pending).toBe(0);
    expect(summary.body.data.by_referrer).toEqual([]);
  });
});
