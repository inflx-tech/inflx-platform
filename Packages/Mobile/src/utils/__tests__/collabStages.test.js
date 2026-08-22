import {
  deriveStage, whoseTurn, mergeCollabs, filterByStage, stageCounts, isPreSign,
  normalizeOffer, normalizeCampaign,
} from '../collabStages';

/* Stage 1 (features/stage-1-find-each-other-and-agree) changed the stage model with the
   founder's locked approval: eight stages became six — Invitations · Pitches · To sign ·
   Shoot · Content · Done. Three of the old ones were derived states a creator never saw,
   and 'applied' could never be non-empty because nothing in the backend writes it.

   These assertions were updated to the new behaviour rather than removed. Anything that
   still holds — dedupe, offer-field backfill, null safety — is untouched, because that is
   what proves the rework did not break what already worked. */

// Helpers to build raw payload rows shaped like the real API.
const offer = (id, status, extra = {}) => ({ id, status, brand_name: 'B', campaign_name: 'C', ...extra });
const camp  = (ciId, status, extra = {}) => ({
  campaign_influencer_id: ciId, influencer_status: status, brand_name: 'B', campaign_name: 'C', ...extra,
});

describe('deriveStage', () => {
  it('maps each status to its UI stage', () => {
    expect(deriveStage({ status: 'invited' })).toBe('invitations');
    expect(deriveStage({ status: 'applied' })).toBe('pitches');
    expect(deriveStage({ status: 'negotiating' })).toBe('invitations');
    expect(deriveStage({ status: 'accepted' })).toBe('to_sign');
    expect(deriveStage({ status: 'pending_influencer' })).toBe('to_sign');
    expect(deriveStage({ status: 'pending_brand' })).toBe('to_sign');
    expect(deriveStage({ status: 'contracted' })).toBe('shoot');
    expect(deriveStage({ status: 'active' })).toBe('shoot');
    expect(deriveStage({ status: 'completed' })).toBe('done');
  });

  it('a finished conversation reads as Done, not a category of its own', () => {
    // Archive was a ninth bucket for things that had simply ended. Six stages means a
    // declined conversation is finished — which is what Done says.
    for (const s of ['declined', 'expired', 'rejected_by_brand', 'slots_filled', 'cancelled', 'walked_away']) {
      expect(deriveStage({ status: s })).toBe('done');
    }
  });

  it('signed work moves Shoot → Content → Done as there is progress to read', () => {
    // Deliberately conservative: nothing here claims a shoot is finished, because the
    // system has no way to know that until Stage 4 gives the shoot its own screen.
    expect(deriveStage({ status: 'active', deliverable_count: 0, approved_count: 0 })).toBe('shoot');
    expect(deriveStage({ status: 'active', deliverable_count: 2, approved_count: 1 })).toBe('content');
    expect(deriveStage({ status: 'active', deliverable_count: 2, approved_count: 2 })).toBe('done');
  });

  it('keeps an unknown status visible rather than hiding it', () => {
    expect(deriveStage({ status: 'some_new_status' })).toBe('shoot');
  });

  it('A CONVERSATION IS PLACED BY ITS DIRECTION, NOT ITS STATUS', () => {
    // The heart of Stage 1. A brand asking her is an Invitation whatever state it is
    // in, and her pitch is a Pitch — because direction is what she is choosing between.
    expect(deriveStage({ source: 'request', status: 'sent' })).toBe('invitations');
    expect(deriveStage({ source: 'request', status: 'countered' })).toBe('invitations');
    expect(deriveStage({ source: 'request', status: 'agreed' })).toBe('invitations');
    expect(deriveStage({ source: 'proposal', status: 'sent' })).toBe('pitches');
    expect(deriveStage({ source: 'proposal', status: 'countered' })).toBe('pitches');
  });
});

describe('whoseTurn', () => {
  it('flags your-turn states', () => {
    for (const s of ['invited', 'accepted', 'pending_influencer', 'negotiating']) {
      expect(whoseTurn({ status: s })).toBe('you');
    }
  });
  it('flags waiting-on-brand states', () => {
    for (const s of ['applied', 'pending_brand', 'awaiting_brand']) {
      expect(whoseTurn({ status: s })).toBe('brand');
    }
  });
  it('is none for terminal + completed', () => {
    expect(whoseTurn({ status: 'completed' })).toBe('none');
    expect(whoseTurn({ status: 'expired' })).toBe('none');
  });
  it('active with all deliverables done waits (none), else your turn', () => {
    expect(whoseTurn({ status: 'active', deliverable_count: 2, approved_count: 2 })).toBe('none');
    expect(whoseTurn({ status: 'active', deliverable_count: 2, approved_count: 0 })).toBe('you');
  });
});

describe('mergeCollabs — dedupe (the core correctness requirement)', () => {
  it('a record present in BOTH sources yields exactly one row', () => {
    const offers    = [offer('ci-1', 'active')];
    const campaigns = [camp('ci-1', 'active', { deliverable_count: 2, approved_count: 1 })];
    const merged = mergeCollabs(offers, campaigns);
    expect(merged).toHaveLength(1);
    expect(merged[0].ciId).toBe('ci-1');
  });

  it('campaign wins on overlap (keeps deliverable progress)', () => {
    const merged = mergeCollabs(
      [offer('ci-1', 'active')],
      [camp('ci-1', 'active', { deliverable_count: 3, approved_count: 3 })],
    );
    expect(merged[0].deliverable_count).toBe(3);
    expect(merged[0].stage).toBe('done'); // every deliverable approved
    expect(merged[0].source).toBe('campaign');
  });

  it('keeps offer-only fields (expiry) when campaign lacks them', () => {
    const merged = mergeCollabs(
      [offer('ci-1', 'accepted', { offer_expires_at: '2026-08-01T00:00:00Z' })],
      [camp('ci-1', 'accepted')],
    );
    expect(merged[0].offer_expires_at).toBe('2026-08-01T00:00:00Z');
  });

  it('unions non-overlapping records from both sources', () => {
    const merged = mergeCollabs(
      [offer('ci-1', 'invited'), offer('ci-2', 'negotiating')],
      [camp('ci-3', 'active'), camp('ci-4', 'completed')],
    );
    expect(merged).toHaveLength(4);
    expect(new Set(merged.map(m => m.ciId))).toEqual(new Set(['ci-1', 'ci-2', 'ci-3', 'ci-4']));
  });

  it('ignores null/idless rows without crashing', () => {
    const merged = mergeCollabs([null, { status: 'invited' }], [null, { influencer_status: 'active' }]);
    expect(merged).toHaveLength(0);
  });

  it('attaches derived stage + turn to every row', () => {
    const merged = mergeCollabs([offer('ci-1', 'invited')], []);
    expect(merged[0].stage).toBe('invitations');
    expect(merged[0].turn).toBe('you');
  });
});

describe('filterByStage + stageCounts', () => {
  const merged = mergeCollabs(
    [offer('ci-1', 'invited'), offer('ci-2', 'negotiating')],
    [camp('ci-3', 'active', { deliverable_count: 1, approved_count: 0 }),
     camp('ci-4', 'completed'),
     camp('ci-5', 'expired')],
  );

  it('all returns everything', () => {
    expect(filterByStage(merged, 'all')).toHaveLength(5);
  });
  it('filters to a single stage', () => {
    expect(filterByStage(merged, 'invitations').map(c => c.ciId)).toEqual(['ci-1', 'ci-2']);
    expect(filterByStage(merged, 'content').map(c => c.ciId)).toEqual(['ci-3']);
    expect(filterByStage(merged, 'done').map(c => c.ciId)).toEqual(['ci-4', 'ci-5']);
  });
  it('counts match the deduped set', () => {
    const counts = stageCounts(merged);
    expect(counts.all).toBe(5);
    expect(counts.invitations).toBe(2);   // invited + negotiating both read as invitations
    expect(counts.content).toBe(1);
    expect(counts.done).toBe(2);          // completed + expired
    expect(counts.pitches).toBe(0);       // present and zero, never absent
    expect(counts.shoot).toBe(0);
  });
});

describe('isPreSign routing', () => {
  it('pre-sign stages route to OfferDetail', () => {
    expect(isPreSign({ stage: 'invitations' })).toBe(true);
    expect(isPreSign({ stage: 'pitches' })).toBe(true);
    expect(isPreSign({ stage: 'to_sign' })).toBe(true);
  });
  it('post-sign stages route to CampaignDetail', () => {
    expect(isPreSign({ stage: 'shoot' })).toBe(false);
    expect(isPreSign({ stage: 'content' })).toBe(false);
    expect(isPreSign({ stage: 'done' })).toBe(false);
  });
});

describe('normalizers', () => {
  it('normalizeOffer keys on offer.id and reads fee fallbacks', () => {
    const n = normalizeOffer({ id: 'x', status: 'invited', influencer_budget: 5000, business_name: 'Acme' });
    expect(n.ciId).toBe('x');
    expect(n.fee).toBe(5000);
    expect(n.brand_name).toBe('Acme');
    expect(n.source).toBe('offer');
  });
  it('normalizeCampaign keys on campaign_influencer_id', () => {
    const n = normalizeCampaign({ campaign_influencer_id: 'y', influencer_status: 'active', agreed_fee: 8000 });
    expect(n.ciId).toBe('y');
    expect(n.fee).toBe(8000);
    expect(n.source).toBe('campaign');
  });
});
