const {
  getSetDraft, setSetDraft, setCreatorTerms, setCreatorOffer, hasFormats, invitePayload,
  seedFromDeferred,
} = require('../campaignDraft');

/**
 * stage-a — her terms (SB-30): channels_json / formats_json moved down from the set to the
 * creator, per creator, with no set-level default standing in for one nobody has asked yet.
 * Contract: features/stage-a-the-set
 *
 * campaignDraft.js has no React Native imports, so unlike the screens it can be required and
 * actually RUN under plain jest — these are real runtime assertions, not source-shape checks.
 */

const SELLING_SET = { id: 's1', goal: 'conversion' };
const CONTENT_SET = { id: 's1', goal: 'engagement' };

// Seeds the shared draft store through the same setSetDraft the wizard itself uses, with
// the real shape a picked creator arrives in (agreement_id + name), not a shortcut.
function seedTwoCreators(campaignId, setId) {
  setSetDraft(campaignId, setId, {
    creators: [
      { agreement_id: 'a1', influencer_id: 'i1', name: 'Asha M.', alloc: { alloc_scope: 'store' } },
      { agreement_id: 'a2', influencer_id: 'i2', name: 'Divya T.', alloc: { alloc_scope: 'store' } },
    ],
  });
}

describe('setCreatorTerms — writes onto that creator and nobody else', () => {
  it('channels_json lands on the picked creator only', () => {
    const cid = 'camp-1';
    seedTwoCreators(cid, 's1');
    setCreatorTerms(cid, 's1', 'a1', { channels_json: { allowed: ['instagram'] } });

    const sd = getSetDraft(cid, 's1');
    const asha = sd.creators.find((c) => c.agreement_id === 'a1');
    const divya = sd.creators.find((c) => c.agreement_id === 'a2');
    expect(asha.channels_json).toEqual({ allowed: ['instagram'] });
    // The whole reason this is a per-creator field, not a set default: the other creator
    // must be completely untouched by it.
    expect(divya.channels_json).toBeUndefined();
  });

  it('formats_json lands on the picked creator only, independently of channels_json', () => {
    const cid = 'camp-2';
    seedTwoCreators(cid, 's1');
    setCreatorTerms(cid, 's1', 'a2', { formats_json: [{ type: 'reel', count: 1 }] });

    const sd = getSetDraft(cid, 's1');
    const asha = sd.creators.find((c) => c.agreement_id === 'a1');
    const divya = sd.creators.find((c) => c.agreement_id === 'a2');
    expect(divya.formats_json).toEqual([{ type: 'reel', count: 1 }]);
    expect(asha.formats_json).toBeUndefined();
    // Setting formats must not have touched channels on the SAME creator either — two
    // independent fields, one call each.
    expect(divya.channels_json).toBeUndefined();
  });

  it('omitting a key leaves whatever that creator already had alone', () => {
    const cid = 'camp-3';
    seedTwoCreators(cid, 's1');
    setCreatorTerms(cid, 's1', 'a1', { channels_json: { allowed: ['youtube'] } });
    // Second call sets only formats — channels must survive it.
    setCreatorTerms(cid, 's1', 'a1', { formats_json: [{ type: 'post', count: 2 }] });

    const asha = getSetDraft(cid, 's1').creators.find((c) => c.agreement_id === 'a1');
    expect(asha.channels_json).toEqual({ allowed: ['youtube'] });
    expect(asha.formats_json).toEqual([{ type: 'post', count: 2 }]);
  });
});

describe('hasFormats — the content-set signing gate', () => {
  it('is false with no formats_json at all', () => {
    expect(hasFormats({})).toBe(false);
  });

  it('is false when every count is zero — a zero-count row is the same as none', () => {
    expect(hasFormats({ formats_json: [{ type: 'reel', count: 0 }, { type: 'post', count: 0 }] })).toBe(false);
  });

  it('is true with at least one positive count', () => {
    expect(hasFormats({ formats_json: [{ type: 'reel', count: 0 }, { type: 'post', count: 1 }] })).toBe(true);
  });
});

describe('invitePayload — her channels/formats reach the invite, her offer still wins', () => {
  const money = { time: { post_by: '2026-09-30' } };

  it('sends channels_json only when she has one, on a selling set', () => {
    const withChannels = { agreement_id: 'a1', influencer_id: 'i1', terms: money, alloc: { alloc_scope: 'store' }, channels_json: { allowed: ['instagram'] } };
    const withoutChannels = { agreement_id: 'a1', influencer_id: 'i1', terms: money, alloc: { alloc_scope: 'store' } };
    expect(invitePayload(withChannels, SELLING_SET, null).channels_json).toEqual({ allowed: ['instagram'] });
    expect(invitePayload(withoutChannels, SELLING_SET, null).channels_json).toBeUndefined();
  });

  it('sends formats_json only when at least one format has a positive count', () => {
    const withFormats = { agreement_id: 'a1', influencer_id: 'i1', terms: money, formats_json: [{ type: 'reel', count: 1 }] };
    const zeroFormats = { agreement_id: 'a1', influencer_id: 'i1', terms: money, formats_json: [] };
    expect(invitePayload(withFormats, CONTENT_SET, null).formats_json).toEqual([{ type: 'reel', count: 1 }]);
    expect(invitePayload(zeroFormats, CONTENT_SET, null).formats_json).toBeUndefined();
  });
});

describe('setCreatorOffer — writes onto that creator and nobody else', () => {
  // SUPERSEDED the wizard's old local-state-only write, 2026-09-01: CreatorTermsScreen
  // (SB-30) is a separate route that reads and writes the same shared draft, so an offer
  // chosen in the wizard has to be persisted immediately, not held only in `picked` until
  // "Save this set" — otherwise opening SB-30 right after would resync `picked` from the
  // store and silently drop the offer nobody had saved yet.
  it('one creator gets the offer, the other is untouched', () => {
    const cid = 'camp-4';
    seedTwoCreators(cid, 's1');
    setCreatorOffer(cid, 's1', 'a1', { brand_offer_id: 'o9' });

    const sd = getSetDraft(cid, 's1');
    expect(sd.creators.find((c) => c.agreement_id === 'a1').offer).toEqual({ brand_offer_id: 'o9' });
    expect(sd.creators.find((c) => c.agreement_id === 'a2').offer).toBeUndefined();
  });
});

/**
 * seedFromDeferred — SB-24's "Build a set from these". Founder, 2026-09-02: she picks
 * what she'd prefer, it reaches the brand, the brand builds a new set from everyone who
 * said so — carrying over what was already settled, not re-asking for it.
 */
describe('seedFromDeferred — carries settled terms across, keys them uniquely', () => {
  const DEFERRED_ROWS = [
    {
      id: 'ci-old-1', influencer_id: 'i1', influencer_name: 'Asha M.', instagram_handle: 'asha.m',
      commission_pct: '14.00', agreed_fee: null,
      alloc_scope: 'store', alloc_category: null, alloc_category_node_id: null, alloc_product_ids: null,
      brand_offer_id: 'o9', offer_type: null, offer_config_json: null, offer_valid_from: null, offer_valid_until: null,
      channels_json: { allowed: ['instagram'] }, formats_json: null,
      deferred_note: 'Only weekends work', deferred_go_live_date: '2026-09-20', deferred_shoot_mode: 'visit',
      original_set_name: 'Set 1',
    },
    {
      id: 'ci-old-2', influencer_id: 'i2', influencer_name: 'Divya T.', instagram_handle: 'divya.t',
      commission_pct: '18.00', agreed_fee: null,
      alloc_scope: 'store', alloc_category: null, alloc_category_node_id: null, alloc_product_ids: null,
      brand_offer_id: null, offer_type: null, offer_config_json: null, offer_valid_from: null, offer_valid_until: null,
      channels_json: null, formats_json: null,
      deferred_note: null, deferred_go_live_date: '2026-09-20', deferred_shoot_mode: null,
      original_set_name: 'Set 1',
    },
  ];

  it('both creators land in the new set with distinct keys and their real commission', () => {
    const cid = 'camp-5';
    seedFromDeferred(cid, 'new-set-1', DEFERRED_ROWS);
    const sd = getSetDraft(cid, 'new-set-1');
    expect(sd.creators).toHaveLength(2);
    expect(sd.creators.map((c) => c.agreement_id)).toEqual(['deferred:ci-old-1', 'deferred:ci-old-2']);
    expect(sd.creators[0].terms.money.commission_pct).toBe(14);
    expect(sd.creators[1].terms.money.commission_pct).toBe(18);
    expect(sd.creators[0].alloc).toEqual({ alloc_scope: 'store', alloc_category: null, alloc_category_node_id: null, alloc_product_ids: null });
  });

  it('running it twice does not duplicate anyone already seeded', () => {
    const cid = 'camp-6';
    seedFromDeferred(cid, 'new-set-1', DEFERRED_ROWS);
    seedFromDeferred(cid, 'new-set-1', DEFERRED_ROWS);
    expect(getSetDraft(cid, 'new-set-1').creators).toHaveLength(2);
  });

  it('a deferred key never reaches the server as agreement_id — the id is not a real agreement', () => {
    const cid = 'camp-7';
    seedFromDeferred(cid, 'new-set-1', DEFERRED_ROWS);
    const creator = getSetDraft(cid, 'new-set-1').creators[0];
    const body = invitePayload(creator, SELLING_SET, null);
    expect(body.agreement_id).toBeUndefined();
    expect(body.influencer_id).toBe('i1');
  });

  it('a real agreement_id still reaches the server unchanged', () => {
    const real = { agreement_id: 'a1', influencer_id: 'i1', terms: {} };
    expect(invitePayload(real, SELLING_SET, null).agreement_id).toBe('a1');
  });
});
