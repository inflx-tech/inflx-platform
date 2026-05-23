'use strict';

const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  createFollowerUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');
const { run } = require('../src/jobs/commission-confirm.job');

beforeEach(async () => {
  await truncateAll();
});

// Helper: create a follower_transaction row with correct schema
async function insertFollowerTransaction({ campaignId, setId, ciId, brandId, followerId, influencerCommission, returnWindowOffset }) {
  await query(
    `INSERT INTO follower_transactions
       (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id,
        transaction_type, gross_amount, discount_amount, net_amount,
        influencer_commission, marketplace_fee_amount, brand_net,
        status, return_window_ends_at)
     VALUES ($1, $2, $3, $4, $5, 'pay_at_store', 56000, 0, 56000, $6, 448, 55552,
             'completed', NOW() + $7::interval)`,
    [followerId, brandId, campaignId, setId, ciId, influencerCommission, returnWindowOffset]
  );
}

describe('Cron: commission-confirm', () => {
  test('moves commission from pending to wallet when return window expired', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'priya_sharma' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);
    await query(
      `UPDATE influencers SET wallet_balance = 0, pending_balance = 5600, total_earned = 5600 WHERE id = $1`,
      [inf.id]
    );

    const { token: followerToken } = await createFollowerUser();
    const followerRes = await require('supertest')(require('../src/app'))
      .get('/v1/followers/me').set('Authorization', `Bearer ${followerToken}`);
    const followerId = followerRes.body.data.follower.id;

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'Test Campaign', 'live', 100000) RETURNING *`,
      [brand.id]
    );
    const { rows: [campaignSet] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set 1', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 10000) RETURNING *`,
      [campaignSet.id, inf.id]
    );

    await insertFollowerTransaction({
      campaignId: campaign.id,
      setId: campaignSet.id,
      ciId: ci.id,
      brandId: brand.id,
      followerId,
      influencerCommission: 5600,
      returnWindowOffset: '-31 days',
    });

    const result = await run();

    expect(result.confirmed).toBe(1);
    expect(result.total_amount).toBe(5600);

    const { rows: [updatedInf] } = await query(
      `SELECT wallet_balance, pending_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    expect(parseFloat(updatedInf.wallet_balance)).toBe(5600);
    expect(parseFloat(updatedInf.pending_balance)).toBe(0);

    const { rows: [tx] } = await query(
      `SELECT commission_confirmed_at FROM follower_transactions WHERE campaign_influencer_id = $1`,
      [ci.id]
    );
    expect(tx.commission_confirmed_at).not.toBeNull();
  });

  test('does not process transactions with return window still open', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'priya_sharma' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);
    await query(
      `UPDATE influencers SET wallet_balance = 0, pending_balance = 5600, total_earned = 5600 WHERE id = $1`,
      [inf.id]
    );

    const { token: followerToken } = await createFollowerUser();
    const followerRes = await require('supertest')(require('../src/app'))
      .get('/v1/followers/me').set('Authorization', `Bearer ${followerToken}`);
    const followerId = followerRes.body.data.follower.id;

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'Active Campaign', 'live', 100000) RETURNING *`,
      [brand.id]
    );
    const { rows: [campaignSet] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set 1', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 10000) RETURNING *`,
      [campaignSet.id, inf.id]
    );

    await insertFollowerTransaction({
      campaignId: campaign.id,
      setId: campaignSet.id,
      ciId: ci.id,
      brandId: brand.id,
      followerId,
      influencerCommission: 5600,
      returnWindowOffset: '+5 days',
    });

    const result = await run();
    expect(result.confirmed).toBe(0);

    const { rows: [updatedInf] } = await query(
      `SELECT wallet_balance, pending_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    expect(parseFloat(updatedInf.wallet_balance)).toBe(0);
    expect(parseFloat(updatedInf.pending_balance)).toBe(5600);
  });

  test('returns 0 when no commissions to confirm', async () => {
    const result = await run();
    expect(result.confirmed).toBe(0);
    expect(result.total_amount).toBe(0);
  });
});
