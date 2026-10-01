'use strict';

/**
 * Influencer withdrawal.
 *
 * ASSERTION DRIFT — item 17 (features/item17-wallet; master rules v1.31 §17A, decisions W5 + W6),
 * 1 Oct 2026. This suite described the automatic payout: 10% TDS was deducted at withdrawal, the
 * net was sent through RazorpayX at once, and a failed payout could be retried. The rule changed,
 * so each test below asserts the NEW rule for the same situation (none was skipped or removed):
 *
 *   tax       paused until the tax round — the FULL amount requested is paid; no TDS is deducted
 *             or shown, and no row is written to influencer_withdrawals
 *   request   the amount goes ON HOLD and waits for INFLX ("requested"), not "completed"
 *   paid      INFLX pays from its bank and marks it processed with the bank reference
 *   retry     gone (410) — a request that could not be processed is simply requested again
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createInfluencerUser, createBrandUser, createFollowerUser, createAdminUser, registerInfluencer, registerBrand } = require('./helpers/factories');
const { encrypt } = require('../src/utils/encrypt');
const { run: runCommissionConfirm } = require('../src/jobs/commission-confirm.job');

// STALE FIXTURE (fixed with item 17): a finance admin reaches Money through the 'payouts' capability
// (migration 109). The factory creates the role without capabilities, so the old approve tests here
// had been answering 403 since then. The admin these tests need is one who HOLDS that capability.
async function financeAdmin() {
  const a = await createAdminUser('finance');
  await query(`UPDATE admin_profiles SET capabilities = ARRAY['payouts'] WHERE user_id = $1`, [a.user.id]);
  return a;
}

beforeEach(async () => {
  await truncateAll();
});

describe('Influencer Withdrawal', () => {
  async function setupInfluencer(handle = 'priya_sharma') {
    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: handle });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);
    return { infToken, infUser, inf };
  }
  const money = async (id) => {
    const { rows: [i] } = await query(`SELECT wallet_balance::float AS available, withdrawal_hold::float AS hold FROM influencers WHERE id = $1`, [id]);
    return i;
  };

  test('successful withdrawal request: the full amount is held, no TDS', async () => {
    const { infToken, inf } = await setupInfluencer();

    // Set wallet balance and UPI
    await query(
      `UPDATE influencers SET wallet_balance = 2084000, upi_id = $1 WHERE id = $2`,
      [encrypt('priya@upi'), inf.id]
    );

    const res = await request(app)
      .post('/v1/influencers/me/withdraw')
      .set('Authorization', `Bearer ${infToken}`)
      .send({ amount_requested: 2084000, method: 'upi' });

    expect(res.status).toBe(201);
    expect(res.body.data.amount_requested).toBe(2084000);
    expect(res.body.data.status).toBe('requested');
    expect(res.body.data.withdrawal.sendTo).toBe('priya@upi');
    // Tax is paused: nothing is deducted and nothing about it is in the answer.
    expect(res.body.data).not.toHaveProperty('tds_deducted');
    expect(res.body.data).not.toHaveProperty('net_paid');
    expect(res.body.data).not.toHaveProperty('razorpay_payout_id');
    expect(JSON.stringify(res.body)).not.toMatch(/tds/i);

    // The whole amount left Available and is on hold.
    expect(await money(inf.id)).toEqual({ available: 0, hold: 2084000 });
    expect((await query(`SELECT count(*)::int AS n FROM influencer_withdrawals WHERE influencer_id = $1`, [inf.id])).rows[0].n).toBe(0);
  });

  test('returns WITHDRAWAL_TOO_SMALL for amount below the ₹100 minimum', async () => {
    const { infToken, inf } = await setupInfluencer('priya_sharma2');
    await query(
      `UPDATE influencers SET wallet_balance = 2084000, upi_id = $1 WHERE id = $2`,
      [encrypt('priya@upi'), inf.id]
    );

    const res = await request(app)
      .post('/v1/influencers/me/withdraw')
      .set('Authorization', `Bearer ${infToken}`)
      .send({ amount_requested: 50, method: 'upi' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WITHDRAWAL_TOO_SMALL');
  });

  test('returns INSUFFICIENT_BALANCE when amount > wallet', async () => {
    const { infToken, inf } = await setupInfluencer('priya_sharma3');
    await query(
      `UPDATE influencers SET wallet_balance = 100000, upi_id = $1 WHERE id = $2`,
      [encrypt('priya@upi'), inf.id]
    );

    const res = await request(app)
      .post('/v1/influencers/me/withdraw')
      .set('Authorization', `Bearer ${infToken}`)
      .send({ amount_requested: 9999999, method: 'upi' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  test('returns PAYMENT_METHOD_MISSING when no UPI or bank on file', async () => {
    const { infToken, inf } = await setupInfluencer('priya_sharma4');
    await query(
      `UPDATE influencers SET wallet_balance = 2084000, upi_id = NULL, bank_account_no = NULL WHERE id = $1`,
      [inf.id]
    );

    const res = await request(app)
      .post('/v1/influencers/me/withdraw')
      .set('Authorization', `Bearer ${infToken}`)
      .send({ amount_requested: 100000, method: 'upi' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_METHOD_MISSING');
  });

  test('GET /influencers/me/withdrawals returns withdrawal history', async () => {
    const { infToken, inf } = await setupInfluencer('priya_sharma5');
    await query(
      `UPDATE influencers SET wallet_balance = 2084000, upi_id = $1 WHERE id = $2`,
      [encrypt('priya@upi'), inf.id]
    );

    // Create a withdrawal
    await request(app)
      .post('/v1/influencers/me/withdraw')
      .set('Authorization', `Bearer ${infToken}`)
      .send({ amount_requested: 100000, method: 'upi' });

    const res = await request(app)
      .get('/v1/influencers/me/withdrawals')
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.withdrawals).toBeInstanceOf(Array);
    expect(res.body.data.withdrawals.length).toBe(1);
    expect(res.body.data.withdrawals[0].status).toBe('requested');
    expect(res.body.data.withdrawals[0].amount).toBe(100000);
  });

  test('the automatic retry is retired; a request that could not be processed is requested again', async () => {
    const { infToken, inf } = await setupInfluencer('priya_sharma6');
    const { token: adminToken } = await financeAdmin();
    await query(
      `UPDATE influencers SET wallet_balance = 2084000, upi_id = $1 WHERE id = $2`,
      [encrypt('priya@upi'), inf.id]
    );

    // An old failed payout row can no longer be retried into RazorpayX.
    const { rows: [w] } = await query(
      `INSERT INTO influencer_withdrawals
         (influencer_id, amount_requested, tds_deducted, net_paid, method, status)
       VALUES ($1, 100000, 10000, 90000, 'upi', 'failed') RETURNING *`,
      [inf.id]
    );
    const res = await request(app)
      .post(`/v1/influencers/me/withdrawals/${w.id}/retry`)
      .set('Authorization', `Bearer ${infToken}`);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('RETIRED_17_RETRY');
    expect(await money(inf.id)).toEqual({ available: 2084000, hold: 0 });

    // The new way: INFLX could not pay it → the hold comes back → she asks again.
    const first = await request(app).post('/v1/influencers/me/withdraw').set('Authorization', `Bearer ${infToken}`).send({ amount_requested: 100000, method: 'upi' });
    const back = await request(app)
      .post(`/v1/admin/money/withdrawals/${first.body.data.withdrawal_id}/could-not-process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'The UPI ID was not found.' });
    expect(back.status).toBe(200);
    expect(await money(inf.id)).toEqual({ available: 2084000, hold: 0 });
    const again = await request(app).post('/v1/influencers/me/withdraw').set('Authorization', `Bearer ${infToken}`).send({ amount_requested: 100000, method: 'upi' });
    expect(again.status).toBe(201);
    expect(again.body.data.status).toBe('requested');
  });

  test('full E2E: commission confirm → withdraw → paid in full, no TDS on earnings', async () => {
    const { infToken, inf } = await setupInfluencer('priya_sharma7');
    const { token: adminToken } = await financeAdmin();

    // Set up pending commission
    await query(
      `UPDATE influencers SET wallet_balance = 0, pending_balance = 50000, total_earned = 50000, upi_id = $1 WHERE id = $2`,
      [encrypt('priya@upi'), inf.id]
    );

    // Create supporting records for follower_transaction
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    const { token: followerToken } = await createFollowerUser();
    const followerRes = await request(app)
      .get('/v1/followers/me').set('Authorization', `Bearer ${followerToken}`);
    const followerId = followerRes.body.data.follower.id;

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'E2E Campaign', 'live', 100000) RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 10000) RETURNING *`,
      [cs.id, inf.id]
    );
    await query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, marketplace_fee_amount, brand_net,
          status, return_window_ends_at)
       VALUES ($1, $2, $3, $4, $5, 'pay_at_store', 500000, 0, 500000, 50000, 4000, 496000,
               'completed', NOW() - INTERVAL '31 days')`,
      [followerId, brand.id, campaign.id, cs.id, ci.id]
    );

    // Step 1: Run commission confirm
    await runCommissionConfirm();

    // Step 2: Check wallet (commission moved from pending to wallet)
    const { rows: [updatedInf] } = await query(
      `SELECT wallet_balance, pending_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    expect(parseFloat(updatedInf.wallet_balance)).toBe(50000);
    expect(parseFloat(updatedInf.pending_balance)).toBe(0);

    // Step 3: Withdraw all ₹50,000 — held in full, nothing deducted
    const withdrawRes = await request(app)
      .post('/v1/influencers/me/withdraw')
      .set('Authorization', `Bearer ${infToken}`)
      .send({ amount_requested: 50000, method: 'upi' });

    expect(withdrawRes.status).toBe(201);
    expect(withdrawRes.body.data.amount_requested).toBe(50000);
    expect(withdrawRes.body.data.status).toBe('requested');
    expect(withdrawRes.body.data).not.toHaveProperty('tds_deducted');
    expect(await money(inf.id)).toEqual({ available: 0, hold: 50000 });

    // Step 4: INFLX pays it and records the reference — the whole ₹50,000 has left
    const paid = await request(app)
      .post(`/v1/admin/money/withdrawals/${withdrawRes.body.data.withdrawal_id}/processed`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reference: 'UPI/627400112233' });
    expect(paid.status).toBe(200);
    expect(paid.body.data.amount).toBe(50000);
    expect(await money(inf.id)).toEqual({ available: 0, hold: 0 });

    // Step 5: the earnings endpoint shows no TDS and nothing left to withdraw
    const earningsRes = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    expect(earningsRes.status).toBe(200);
    expect(parseFloat(earningsRes.body.data.tds_this_financial_year)).toBe(0);
    expect(parseFloat(earningsRes.body.data.available_to_withdraw)).toBe(0);
  });
});
