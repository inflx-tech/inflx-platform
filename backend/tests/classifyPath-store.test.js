'use strict';

/**
 * QA — classifyPath store-context branch (contract: influencer-store-foundation,
 * attribution slice). Proves the decision order store > live-link > window > direct
 * and that store-context is hijack-proof (only wins when genuinely stocked).
 *
 * Pure unit test with a stubbed pg client (no DB). The store check runs through
 * influencerStore.resolveStoreContext, which is stubbed via the shared client mock.
 */

const pricing = require('../src/services/pricing.service');

// A mock pg client whose .query inspects the SQL text and returns canned rows.
function mockClient(opts = {}) {
  const {
    stocked = false,        // influencer_store_inventory has the product (active)
    contracted = true,      // influencer still contracted with the brand
    ciInfluencerId = 'ci-inf',   // campaign_influencers.influencer_id (live link)
    windowInfluencerId = null,   // attribution_clicks most-recent influencer
  } = opts;
  return {
    async query(sql) {
      const s = String(sql);
      if (s.includes('influencer_store_inventory')) {
        return { rows: stocked ? [{ '?column?': 1 }] : [] };
      }
      if (s.includes('campaign_influencers') && s.includes('c.brand_id')) {
        // isContractedWithBrand
        return { rows: contracted ? [{ '?column?': 1 }] : [] };
      }
      if (s.includes('FROM campaign_influencers WHERE id')) {
        return { rows: [{ influencer_id: ciInfluencerId }] };
      }
      if (s.includes('attribution_clicks')) {
        return { rows: windowInfluencerId ? [{ influencer_id: windowInfluencerId }] : [] };
      }
      return { rows: [] };
    },
  };
}

describe('classifyPath — decision order with store-context', () => {
  const base = { followerId: 'f1', brandId: 'b1' };

  test('STORE beats LIVE-LINK: stocked store wins even when a campaign_influencer_id is present', async () => {
    const c = mockClient({ stocked: true, contracted: true });
    const r = await pricing.classifyPath(c, {
      ...base, campaignInfluencerId: 'ci-1', storeInfluencerId: 'store-inf', productId: 'p1',
    });
    expect(r.path).toBe('influencer_direct');
    expect(r.influencer_id).toBe('store-inf');   // store influencer, not the CI influencer
    expect(r.store_context).toBe(true);
  });

  test('HIJACK-PROOF: store-context ignored when product is NOT actually stocked → falls to live-link', async () => {
    const c = mockClient({ stocked: false, ciInfluencerId: 'ci-inf' });
    const r = await pricing.classifyPath(c, {
      ...base, campaignInfluencerId: 'ci-1', storeInfluencerId: 'store-inf', productId: 'p1',
    });
    expect(r.path).toBe('influencer_direct');
    expect(r.influencer_id).toBe('ci-inf');       // fell through to the live link
    expect(r.store_context).toBeUndefined();
  });

  test('HIJACK-PROOF: stocked but NOT contracted → store-context rejected', async () => {
    const c = mockClient({ stocked: true, contracted: false, windowInfluencerId: null });
    const r = await pricing.classifyPath(c, {
      ...base, storeInfluencerId: 'store-inf', productId: 'p1',
    });
    expect(r.path).toBe('direct');                // no store, no link, no window
    expect(r.influencer_id).toBeNull();
  });

  test('LIVE-LINK when no store-context passed', async () => {
    const c = mockClient({ ciInfluencerId: 'ci-inf' });
    const r = await pricing.classifyPath(c, { ...base, campaignInfluencerId: 'ci-1' });
    expect(r.path).toBe('influencer_direct');
    expect(r.influencer_id).toBe('ci-inf');
  });

  test('WINDOW (attributed) when no store + no live link but an open window', async () => {
    const c = mockClient({ windowInfluencerId: 'win-inf' });
    const r = await pricing.classifyPath(c, { ...base });
    expect(r.path).toBe('influencer_attributed');
    expect(r.influencer_id).toBe('win-inf');
  });

  test('DIRECT when nothing qualifies', async () => {
    const c = mockClient({});
    const r = await pricing.classifyPath(c, { ...base });
    expect(r.path).toBe('direct');
    expect(r.influencer_id).toBeNull();
  });
});
