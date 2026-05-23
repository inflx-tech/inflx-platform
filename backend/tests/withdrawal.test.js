'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createInfluencerUser, createBrandUser, createFollowerUser, registerInfluencer, registerBrand } = require('./helpers/factories');
const { encrypt } = require('../src/utils/encrypt');
const { run: runCommissionConfirm } = require('../src/jobs/commission-confirm.job');

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

  test('successful withdrawal with TDS calculation', async () => {
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
    expect(res.body.data.tds_deducted).toBe(208400);
    expect(res.body.data.net_paid).toBe(1875600);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.razorpay_payout_id).toMatch(/^mock_payout_/);

    // Verify wallet balance deducted
    const { rows: [updatedInf] } = await query(
      `SELECT wallet_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    expect(parseFloat(updatedInf.wallet_balance)).toBe(0);
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
    expect(res.body.data.withdrawals[0].status).toBe('completed');
  });

  test('retry failed withdrawal succeeds', async () => {
    const { infToken, inf } = await setupInfluencer('priya_sharma6');
    await query(
      `UPDATE influencers SET wallet_balance = 2084000, upi_id = $1 WHERE id = $2`,
      [encrypt('priya@upi'), inf.id]
    );

    // Create a withdrawal and manually mark it as failed
    const { rows: [w] } = await query(
      `INSERT INTO influencer_withdrawals
         (influencer_id, amount_requested, tds_deducted, net_paid, method, status)
       VALUES ($1, 100000, 10000, 90000, 'upi', 'failed') RETURNING *`,
      [inf.id]
    );

    const res = await request(app)
      .post(`/v1/influencers/me/withdrawals/${w.id}/retry`)
      .set('Authorization', `Bearer ${infToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  test('full E2E: commission confirm → withdraw → verify TDS on earnings', async () => {
    const { infToken, infUser, inf } = await setupInfluencer('priya_sharma7');

    // Set up pending commission (use 50000 paise = ₹500, above the 10000 paise minimum)
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

    // Step 3: Withdraw 50000 paise (₹500): tds=5000, net=45000
    const withdrawRes = await request(app)
      .post('/v1/influencers/me/withdraw')
      .set('Authorization', `Bearer ${infToken}`)
      .send({ amount_requested: 50000, method: 'upi' });

    expect(withdrawRes.status).toBe(201);
    expect(withdrawRes.body.data.tds_deducted).toBe(5000);
    expect(withdrawRes.body.data.net_paid).toBe(45000);
    expect(withdrawRes.body.data.status).toBe('completed');

    // Step 4: Check wallet is 0
    const { rows: [inf2] } = await query(
      `SELECT wallet_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    expect(parseFloat(inf2.wallet_balance)).toBe(0);

    // Step 5: Check earnings endpoint shows tds_this_financial_year
    const earningsRes = await request(app)
      .get('/v1/influencers/me/earnings')
      .set('Authorization', `Bearer ${infToken}`);

    expect(earningsRes.status).toBe(200);
    expect(parseFloat(earningsRes.body.data.tds_this_financial_year)).toBe(5000);
    expect(parseFloat(earningsRes.body.data.available_to_withdraw)).toBe(0);
  });
});
