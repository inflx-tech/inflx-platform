'use strict';

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./helpers/factories');
const { run } = require('../src/jobs/tranche-3-release.job');

beforeEach(async () => {
  await truncateAll();
});

async function setupBrandAndInfluencer() {
  const { token: brandToken, user: brandUser } = await createBrandUser();
  await registerBrand(brandToken);
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.id]);
  const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [brandUser.id]);

  const { token: infToken, user: infUser } = await createInfluencerUser();
  const inf = await registerInfluencer(infToken, { instagram_handle: 'priya_sharma' });
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [infUser.id]);

  const { rows: [campaign] } = await query(
    `INSERT INTO campaigns (brand_id, name, status, total_budget) VALUES ($1, 'T3 Test Campaign', 'live', 1000000) RETURNING *`,
    [brand.id]
  );
  const { rows: [cs] } = await query(
    `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1, 'Set 1', 'engagement', 'handpick') RETURNING *`,
    [campaign.id]
  );
  const { rows: [ci] } = await query(
    `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1, $2, 'active', 100000) RETURNING *`,
    [cs.id, inf.id]
  );

  return { brand, brandUser, inf, infUser, campaign, cs, ci };
}

describe('Cron: tranche-3-release', () => {
  test('releases T3 tranche when triggered_at is 31+ days ago', async () => {
    const { inf, ci } = await setupBrandAndInfluencer();
    await query(`UPDATE influencers SET wallet_balance = 0 WHERE id = $1`, [inf.id]);

    const { rows: [entry] } = await query(
      `INSERT INTO escrow_entries
         (campaign_influencer_id, tranche_number, amount, platform_fee_amount, net_to_influencer,
          status, trigger_event, triggered_at)
       VALUES ($1, 3, 500000, 40000, 460000, 'queued', 'day_30_post_live', NOW() - INTERVAL '31 days')
       RETURNING *`,
      [ci.id]
    );

    const result = await run();
    expect(result.released).toBe(1);

    const { rows: [updatedEntry] } = await query(
      `SELECT status FROM escrow_entries WHERE id = $1`,
      [entry.id]
    );
    expect(updatedEntry.status).toBe('released');

    const { rows: [updatedInf] } = await query(
      `SELECT wallet_balance FROM influencers WHERE id = $1`,
      [inf.id]
    );
    expect(parseFloat(updatedInf.wallet_balance)).toBe(460000);
  });

  test('does not release T3 when triggered_at is less than 30 days ago', async () => {
    const { ci } = await setupBrandAndInfluencer();

    await query(
      `INSERT INTO escrow_entries
         (campaign_influencer_id, tranche_number, amount, platform_fee_amount, net_to_influencer,
          status, trigger_event, triggered_at)
       VALUES ($1, 3, 500000, 40000, 460000, 'queued', 'day_30_post_live', NOW() - INTERVAL '20 days')`,
      [ci.id]
    );

    const result = await run();
    expect(result.released).toBe(0);
  });

  test('marks campaign_influencer and campaign as completed when all tranches released', async () => {
    const { ci, campaign } = await setupBrandAndInfluencer();

    // T1 and T2 already released
    await query(
      `INSERT INTO escrow_entries (campaign_influencer_id, tranche_number, amount, platform_fee_amount, net_to_influencer, status, trigger_event, released_at)
       VALUES ($1, 1, 250000, 20000, 230000, 'released', 'contract_signed', NOW()),
              ($1, 2, 250000, 20000, 230000, 'released', 'content_live', NOW())`,
      [ci.id]
    );
    // T3 queued
    await query(
      `INSERT INTO escrow_entries (campaign_influencer_id, tranche_number, amount, platform_fee_amount, net_to_influencer, status, trigger_event, triggered_at)
       VALUES ($1, 3, 500000, 40000, 460000, 'queued', 'day_30_post_live', NOW() - INTERVAL '31 days')`,
      [ci.id]
    );

    await run();

    const { rows: [updatedCi] } = await query(
      `SELECT status FROM campaign_influencers WHERE id = $1`,
      [ci.id]
    );
    expect(updatedCi.status).toBe('completed');

    const { rows: [updatedCampaign] } = await query(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaign.id]
    );
    expect(updatedCampaign.status).toBe('completed');
  });

  test('returns 0 when no T3 entries due', async () => {
    const result = await run();
    expect(result.released).toBe(0);
  });
});
