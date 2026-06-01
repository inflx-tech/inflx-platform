'use strict';

/**
 * QA — referral-influencer-refer-earn (Contract 4). Asserts
 * GET /influencers/me/referral (code + earned_total + ledger + referred_count,
 * RBAC, empty) per features/referral-influencer-refer-earn/03-expected-outputs.md.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createInfluencerUser, registerInfluencer, createBrandUser, registerBrand } = require('./helpers/factories');
const referralService = require('../src/services/referral.service');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

let h = 0;
async function seedInfluencer() {
  h += 1;
  const { token, user } = await createInfluencerUser();
  const inf = await registerInfluencer(token, { instagram_handle: `re_${h}_${Date.now()}` });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return { token, user, inf };
}

beforeEach(async () => { await truncateAll(); });

describe('GET /influencers/me/referral', () => {
  test('EP1: fresh influencer → stable code, zeroed totals, empty ledger', async () => {
    const { token } = await seedInfluencer();
    const r1 = await request(app).get('/v1/influencers/me/referral').set(auth(token));
    expect(r1.status).toBe(200);
    expect(r1.body.data.code).toMatch(/^INFLX-/);
    expect(r1.body.data.earned_total).toBe(0);
    expect(r1.body.data.window_months).toBe(12);
    expect(r1.body.data.referred_count).toBe(0);
    expect(r1.body.data.ledger).toEqual([]);
    // code stable on second call
    const r2 = await request(app).get('/v1/influencers/me/referral').set(auth(token));
    expect(r2.body.data.code).toBe(r1.body.data.code);
  });

  test('EP2: after an influencer-referrer accrual, totals + ledger reflect it', async () => {
    const { token, inf } = await seedInfluencer();        // the referrer
    const { inf: referred } = await seedInfluencer();      // the referred influencer

    await referralService.createEdge({
      referrerType: 'influencer', referrerId: inf.id,
      referredType: 'influencer', referredId: referred.id, pct: 25, source: 'admin',
    });
    await referralService.accrue({
      source: 'commission', sourceRefId: '00000000-0000-0000-0000-0000000004e2',
      referredType: 'influencer', referredId: referred.id, baseAmount: 4480,
    });

    const res = await request(app).get('/v1/influencers/me/referral').set(auth(token));
    expect(res.body.data.earned_total).toBe(1120);        // 4480 × 25%
    expect(res.body.data.referred_count).toBe(1);
    expect(res.body.data.ledger).toHaveLength(1);
    const row = res.body.data.ledger[0];
    expect(row.source).toBe('commission');
    expect(row.amount).toBe(1120);
    expect(row.payout_status).toBe('paid');
    expect(row.referred_name).toBe(referred.instagram_handle);
  });

  test('EP3: RBAC — non-influencer (brand) → 403; isolation between influencers', async () => {
    const { token: brandTok } = await createBrandUser();
    await registerBrand(brandTok);
    const forbidden = await request(app).get('/v1/influencers/me/referral').set(auth(brandTok));
    expect(forbidden.status).toBe(403);

    // influencer A has an accrual; influencer B sees an empty ledger (isolation)
    const a = await seedInfluencer();
    const { inf: referred } = await seedInfluencer();
    await referralService.createEdge({
      referrerType: 'influencer', referrerId: a.inf.id,
      referredType: 'influencer', referredId: referred.id, pct: 25, source: 'admin',
    });
    await referralService.accrue({
      source: 'commission', sourceRefId: '00000000-0000-0000-0000-0000000004e3',
      referredType: 'influencer', referredId: referred.id, baseAmount: 400,
    });
    const b = await seedInfluencer();
    const res = await request(app).get('/v1/influencers/me/referral').set(auth(b.token));
    expect(res.body.data.earned_total).toBe(0);
    expect(res.body.data.ledger).toEqual([]);
  });
});
