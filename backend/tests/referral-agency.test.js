'use strict';

/**
 * QA — referral-agency-role (Contract 3a). Asserts the expected outputs in
 * features/referral-agency-role/03-expected-outputs.md against a real DB:
 * agency onboarding + approval, code redeem + guards, settlement (agency wallet
 * credited inline + ledger paid), and withdrawal with TDS 194H @ 5%.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  loginUser,
  createAdminUser,
  createBrandUser,
  registerBrand,
  createInfluencerUser,
  registerInfluencer,
} = require('./helpers/factories');
const referralService = require('../src/services/referral.service');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;
// Valid 10-digit Indian mobile in a distinct range from the shared factories
// (which use the 98… range): +91 97XXXXXXXX.
function agencyPhone() { seq += 1; return `+9197${String(seq).padStart(8, '0')}`; }

async function makeAgency({ register = true } = {}) {
  const { token, user } = await loginUser(agencyPhone(), 'agency', 'Test Agency');
  let agency = null;
  if (register) {
    const res = await request(app).post('/v1/agencies/register').set(auth(token))
      .send({ agency_name: 'Vizag Media Partners', contact_person: 'Ravi', city: 'Visakhapatnam', state: 'Andhra Pradesh' });
    if (res.status !== 201) throw new Error(`agency register failed: ${JSON.stringify(res.body)}`);
    agency = res.body.data.agency;
  }
  return { token, user, agency };
}

async function approveAgency(agencyId) {
  const { token } = await createAdminUser('superadmin');
  const res = await request(app).patch(`/v1/admin/agencies/${agencyId}/status`).set(auth(token)).send({ status: 'approved' });
  if (res.status !== 200) throw new Error(`approve failed: ${JSON.stringify(res.body)}`);
}

beforeEach(async () => {
  await truncateAll();
});

// ── A. Onboarding ───────────────────────────────────────────────────────────

describe('Agency onboarding', () => {
  test('A1/A2: verify-otp role=agency → pending user; register creates wallet-0 agency', async () => {
    const { token, user } = await loginUser(agencyPhone(), 'agency', 'Test Agency');
    expect(user.role).toBe('agency');
    expect(user.status).toBe('pending');
    const res = await request(app).post('/v1/agencies/register').set(auth(token))
      .send({ agency_name: 'Vizag Media Partners', city: 'Visakhapatnam' });
    expect(res.status).toBe(201);
    expect(res.body.data.agency.wallet_balance).toBe(0);
    const { rows } = await query(`SELECT user_id FROM agencies WHERE id=$1`, [res.body.data.agency.id]);
    expect(rows[0].user_id).toBe(user.id);
  });

  test('A3: GET /agencies/me returns a stable referral code', async () => {
    const { token } = await makeAgency();
    const r1 = await request(app).get('/v1/agencies/me').set(auth(token));
    expect(r1.status).toBe(200);
    expect(r1.body.data.agency.referral_code).toBeTruthy();
    const r2 = await request(app).get('/v1/agencies/me').set(auth(token));
    expect(r2.body.data.agency.referral_code).toBe(r1.body.data.agency.referral_code);
  });

  test('A4: admin approves a pending agency', async () => {
    const { token, agency } = await makeAgency();
    await approveAgency(agency.id);
    const me = await request(app).get('/v1/agencies/me').set(auth(token));
    expect(me.body.data.agency.user_status).toBe('approved');
  });
});

// ── B. Code redeem ──────────────────────────────────────────────────────────

describe('Code redeem', () => {
  async function agencyWithCode() {
    const { token, agency } = await makeAgency();
    const me = await request(app).get('/v1/agencies/me').set(auth(token));
    return { agency, code: me.body.data.agency.referral_code };
  }
  async function makeBrand() {
    const { token, user } = await createBrandUser();
    await registerBrand(token);
    await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
    const { rows } = await query(`SELECT id FROM brands WHERE user_id=$1`, [user.id]);
    return { token, brandId: rows[0].id };
  }

  test('B5: brand redeems agency code → active signup edge at default pct', async () => {
    const { agency, code } = await agencyWithCode();
    const { token, brandId } = await makeBrand();
    const res = await request(app).post('/v1/referrals/redeem').set(auth(token)).send({ code });
    expect(res.status).toBe(201);
    expect(res.body.data.pct).toBe(25);
    const { rows } = await query(
      `SELECT * FROM referral_edges WHERE referred_type='brand' AND referred_id=$1 AND status='active'`, [brandId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].referrer_type).toBe('agency');
    expect(rows[0].referrer_id).toBe(agency.id);
    expect(rows[0].source).toBe('signup');
  });

  test('B6: redeeming when already referred → 409', async () => {
    const { code } = await agencyWithCode();
    const { token } = await makeBrand();
    await request(app).post('/v1/referrals/redeem').set(auth(token)).send({ code });
    const dup = await request(app).post('/v1/referrals/redeem').set(auth(token)).send({ code });
    expect(dup.status).toBe(409);
  });

  test('B7: unknown code → 404', async () => {
    const { token } = await makeBrand();
    const res = await request(app).post('/v1/referrals/redeem').set(auth(token)).send({ code: 'INFLX-NOPE99' });
    expect(res.status).toBe(404);
  });
});

// ── C. Settlement ───────────────────────────────────────────────────────────

describe('Agency settlement (engine credits the agency wallet inline)', () => {
  test('C8: agency-referred confirmed revenue credits agency wallet + marks ledger paid', async () => {
    const { agency } = await makeAgency();
    const { token: bt, user: bu } = await createBrandUser();
    await registerBrand(bt);
    await query(`UPDATE users SET status='approved' WHERE id=$1`, [bu.id]);
    const { rows: br } = await query(`SELECT id FROM brands WHERE user_id=$1`, [bu.id]);
    const brandId = br[0].id;

    await referralService.createEdge({
      referrerType: 'agency', referrerId: agency.id,
      referredType: 'brand', referredId: brandId, pct: 25, source: 'admin',
    });
    await referralService.accrue({
      source: 'subscription', sourceRefId: '00000000-0000-0000-0000-0000000000a9',
      referredType: 'brand', referredId: brandId, baseAmount: 10000,
    });

    const { rows: ag } = await query(
      `SELECT wallet_balance, referral_earned_total FROM agencies WHERE id=$1`, [agency.id]
    );
    expect(parseFloat(ag[0].wallet_balance)).toBe(2500);          // 10000 × 25%
    expect(parseFloat(ag[0].referral_earned_total)).toBe(2500);
    const { rows: led } = await query(
      `SELECT payout_status, amount FROM referral_ledger WHERE referrer_type='agency' AND referrer_id=$1`, [agency.id]
    );
    expect(led).toHaveLength(1);
    expect(led[0].payout_status).toBe('paid');
    expect(parseFloat(led[0].amount)).toBe(2500);
  });

  test('C9: influencer-referred accrual still credits the influencer (no cross-talk)', async () => {
    const { token, user } = await createInfluencerUser();
    const refInf = await registerInfluencer(token, { instagram_handle: `agtest_${Date.now()}` });
    await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
    const { token: t2, user: u2 } = await createInfluencerUser();
    const referredInf = await registerInfluencer(t2, { instagram_handle: `agtest2_${Date.now()}` });
    await query(`UPDATE users SET status='approved' WHERE id=$1`, [u2.id]);

    await referralService.createEdge({
      referrerType: 'influencer', referrerId: refInf.id,
      referredType: 'influencer', referredId: referredInf.id, pct: 25, source: 'admin',
    });
    await referralService.accrue({
      source: 'commission', sourceRefId: '00000000-0000-0000-0000-0000000000c9',
      referredType: 'influencer', referredId: referredInf.id, baseAmount: 400,
    });
    const { rows } = await query(`SELECT wallet_balance, referral_earned_total FROM influencers WHERE id=$1`, [refInf.id]);
    expect(parseFloat(rows[0].wallet_balance)).toBe(100);
    expect(parseFloat(rows[0].referral_earned_total)).toBe(100);
  });
});

// ── D. Withdrawal (TDS 194H @ 5%) ───────────────────────────────────────────

describe('Agency withdrawal', () => {
  test('D10/D11: approved agency withdraws → TDS 5%, net 95%, wallet debited, history row', async () => {
    const { token, agency } = await makeAgency();
    await approveAgency(agency.id);
    await query(`UPDATE agencies SET wallet_balance = 2000 WHERE id=$1`, [agency.id]);
    await request(app).patch('/v1/agencies/me').set(auth(token)).send({ upi_id: 'agency@upi' });

    const res = await request(app).post('/v1/agencies/me/withdraw').set(auth(token)).send({ amount_requested: 1000, method: 'upi' });
    expect(res.status).toBe(201);
    expect(res.body.data.tds_deducted).toBe(50);    // 1000 × 5% (194H)
    expect(res.body.data.net_paid).toBe(950);

    const { rows: ag } = await query(`SELECT wallet_balance FROM agencies WHERE id=$1`, [agency.id]);
    expect(parseFloat(ag[0].wallet_balance)).toBe(1000);

    const list = await request(app).get('/v1/agencies/me/withdrawals').set(auth(token));
    expect(list.body.data.withdrawals).toHaveLength(1);
  });

  test('D12: over-balance → 422; not-approved → 403', async () => {
    // over-balance (approved)
    const a1 = await makeAgency();
    await approveAgency(a1.agency.id);
    await query(`UPDATE agencies SET wallet_balance = 100 WHERE id=$1`, [a1.agency.id]);
    await request(app).patch('/v1/agencies/me').set(auth(a1.token)).send({ upi_id: 'a1@upi' });
    const over = await request(app).post('/v1/agencies/me/withdraw').set(auth(a1.token)).send({ amount_requested: 1000, method: 'upi' });
    expect(over.status).toBe(422);

    // not approved (pending)
    const a2 = await makeAgency();
    await query(`UPDATE agencies SET wallet_balance = 2000 WHERE id=$1`, [a2.agency.id]);
    await request(app).patch('/v1/agencies/me').set(auth(a2.token)).send({ upi_id: 'a2@upi' });
    const blocked = await request(app).post('/v1/agencies/me/withdraw').set(auth(a2.token)).send({ amount_requested: 500, method: 'upi' });
    expect(blocked.status).toBe(403);
  });
});
