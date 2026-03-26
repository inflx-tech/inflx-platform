'use strict';

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./helpers/factories');
const { run } = require('../src/jobs/low-wallet-alert.job');

beforeEach(async () => {
  await truncateAll();
});

describe('Cron: low-wallet-alert', () => {
  test('fires alert when brand wallet < highest upcoming tranche', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    // Set wallet very low
    await query(`UPDATE brands SET wallet_balance = 5000 WHERE id = $1`, [brand.id]);

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'low_wallet_inf' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'Active Campaign', 'active', 500000) RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 100000) RETURNING *`,
      [cs.id, inf.id]
    );

    // Queued escrow entry for 50000 — more than brand's 5000 wallet
    await query(
      `INSERT INTO escrow_entries (campaign_influencer_id, tranche_number, amount, platform_fee_amount, net_to_influencer, status, trigger_event)
       VALUES ($1, 3, 50000, 4000, 46000, 'queued', 'day_30_post_live')`,
      [ci.id]
    );

    const result = await run();
    expect(result.alerted).toBeGreaterThanOrEqual(1);

    // Check notification was created
    const { rows: notifs } = await query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'wallet.low_balance'`,
      [brandUser.id]
    );
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  test('does not alert when brand wallet > highest upcoming tranche', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    // Set wallet very high
    await query(`UPDATE brands SET wallet_balance = 9999999 WHERE id = $1`, [brand.id]);

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'rich_brand_inf' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'Rich Campaign', 'active', 500000) RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 100000) RETURNING *`,
      [cs.id, inf.id]
    );

    await query(
      `INSERT INTO escrow_entries (campaign_influencer_id, tranche_number, amount, platform_fee_amount, net_to_influencer, status, trigger_event)
       VALUES ($1, 3, 50000, 4000, 46000, 'queued', 'day_30_post_live')`,
      [ci.id]
    );

    const result = await run();

    const { rows: notifs } = await query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'wallet.low_balance'`,
      [brandUser.id]
    );
    expect(notifs.length).toBe(0);
  });

  test('returns 0 when no brands with active campaigns', async () => {
    const result = await run();
    expect(result.alerted).toBe(0);
  });
});
