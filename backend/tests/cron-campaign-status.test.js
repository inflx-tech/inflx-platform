'use strict';

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./helpers/factories');
const { run } = require('../src/jobs/campaign-status.job');

beforeEach(async () => {
  await truncateAll();
});

describe('Cron: campaign-status', () => {
  test('marks campaign as completed when end_date passed and all influencers completed', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget, end_date)
       VALUES ($1, 'Ended Campaign', 'live', 500000, CURRENT_DATE - INTERVAL '1 day')
       RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'test_inf_status' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);

    await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'completed', 50000)`,
      [cs.id, inf.id]
    );

    const result = await run();
    expect(result.completed).toBeGreaterThanOrEqual(1);

    const { rows: [updatedCampaign] } = await query(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaign.id]
    );
    expect(updatedCampaign.status).toBe('completed');
  });

  test('does not complete campaign when influencers not yet completed', async () => {
    const { token: brandToken, user: brandUser } = await createBrandUser();
    await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
    const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget, end_date)
       VALUES ($1, 'Stale Campaign', 'live', 500000, CURRENT_DATE - INTERVAL '1 day')
       RETURNING *`,
      [brand.id]
    );
    const { rows: [cs] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );

    const { token: infToken, user: infUser } = await createInfluencerUser();
    const inf = await registerInfluencer(infToken, { instagram_handle: 'test_inf_stale' });
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);

    // Influencer still active, not completed
    await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 50000)`,
      [cs.id, inf.id]
    );

    // Add queued escrow entry
    const { rows: [ci] } = await query(
      `SELECT id FROM campaign_influencers WHERE set_id = $1`, [cs.id]
    );
    await query(
      `INSERT INTO escrow_entries (campaign_influencer_id, tranche_number, amount, platform_fee_amount, net_to_influencer, status, trigger_event)
       VALUES ($1, 3, 250000, 20000, 230000, 'queued', 'day_30_post_live')`,
      [ci.id]
    );

    await run();

    const { rows: [updatedCampaign] } = await query(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaign.id]
    );
    expect(updatedCampaign.status).toBe('live');
  });

  test('returns 0 when no campaigns to process', async () => {
    const result = await run();
    expect(result.checked).toBe(0);
    expect(result.completed).toBe(0);
  });
});
