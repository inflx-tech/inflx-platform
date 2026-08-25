import { heroFor, sectionsFor } from '../collabDetailModel';

describe('heroFor — one correct action per stage', () => {
  it('invite → accept/negotiate/pass', () => {
    const h = heroFor({ stage: 'invites', status: 'invited', turn: 'you' });
    expect(h.actions).toEqual(['accept', 'negotiate', 'pass']);
    expect(h.tone).toBe('you');
  });
  it('applied → no action (waiting on brand)', () => {
    expect(heroFor({ stage: 'applied', status: 'applied' }).actions).toEqual([]);
  });
  it('negotiating your-turn vs waiting', () => {
    expect(heroFor({ stage: 'negotiating', status: 'negotiating', turn: 'you' }).tone).toBe('nego');
    expect(heroFor({ stage: 'negotiating', status: 'negotiating', turn: 'brand' }).tone).toBe('brand');
  });
  it('to_sign: your turn to sign vs waiting for brand countersign', () => {
    expect(heroFor({ stage: 'to_sign', status: 'accepted' }).actions).toEqual(['sign']);
    expect(heroFor({ stage: 'to_sign', status: 'pending_influencer' }).actions).toEqual(['sign']);
    expect(heroFor({ stage: 'to_sign', status: 'pending_brand' }).actions).toEqual([]);
    expect(heroFor({ stage: 'to_sign', status: 'contracted' }).actions).toEqual([]);
  });
  it('active: deliver vs awaiting review', () => {
    expect(heroFor({ stage: 'active', status: 'active', pendingDeliverable: true }).actions).toEqual(['deliverables']);
    expect(heroFor({ stage: 'active', status: 'active', pendingDeliverable: true }).tone).toBe('you');
    expect(heroFor({ stage: 'active', status: 'active', pendingDeliverable: false }).tone).toBe('brand');
  });
  it('tracking / completed / archive', () => {
    expect(heroFor({ stage: 'tracking', status: 'active' }).actions).toEqual(['tracking']);
    expect(heroFor({ stage: 'completed', status: 'completed' }).actions).toEqual(['earnings']);
    const a = heroFor({ stage: 'archive', status: 'expired' });
    expect(a.actions).toEqual([]);
    expect(a.label).toBe('Expired');
  });
});

describe('sectionsFor — stage gating', () => {
  it('invite shows only terms', () => {
    expect(sectionsFor({ stage: 'invites' }).map(s => s.key)).toEqual(['terms']);
  });
  it('to_sign adds contract', () => {
    expect(sectionsFor({ stage: 'to_sign' }).map(s => s.key)).toEqual(['terms', 'contract']);
  });
  it('active shows the full post-sign set (incl. performance)', () => {
    const keys = sectionsFor({ stage: 'active', physical_delivery: true, products_total: 4 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'logistics', 'deliverables', 'tracking', 'earnings', 'products']);
  });
  it('logistics only when physical_delivery; products only when >0', () => {
    const keys = sectionsFor({ stage: 'active', physical_delivery: false, products_total: 0 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'deliverables', 'tracking', 'earnings']);
  });
  it('completed keeps contract + deliverables + performance + earnings', () => {
    const keys = sectionsFor({ stage: 'completed', products_total: 0 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'deliverables', 'tracking', 'earnings']);
  });
});

describe('spineFor is GONE, and must stay gone', () => {
  // Stage 3 deleted it. These three tests used to pass while the thing they tested was
  // BROKEN IN THE APP: spineFor matched on stage names Stage 1 renamed, so the screen fed
  // it 'shoot' / 'content' / 'invitations' and got -1 back — every node 'todo', nothing
  // highlighted. The tests passed because they passed it the OLD names.
  //
  // That is the strongest argument in this repo for testing what the screen actually does
  // rather than what a helper can do when fed ideal input.
  it('the second step model is no longer exported', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../collabDetailModel');
    expect(mod.spineFor).toBeUndefined();
    expect(mod.SPINE).toBeUndefined();
  });

  it('the six steps now come from the server, via creatorSteps', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { stepFor } = require('../creatorSteps');
    const data = { collaborations: [{ campaign_influencer_id: 'ci-1', step: 3, turn: 'nobody' }] };
    expect(stepFor(data, 'ci-1')).toEqual({ step: 3, turn: 'nobody', state: null });
  });

  it('an unknown collaboration returns null, never a default of step 1', () => {
    // A screen that renders step 1 when it does not know is lying to her about where the
    // work is. Null is what lets it say "we can't say" instead.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { stepFor } = require('../creatorSteps');
    expect(stepFor({ collaborations: [] }, 'ci-1')).toBeNull();
    expect(stepFor(null, 'ci-1')).toBeNull();
    expect(stepFor({ collaborations: [{ campaign_influencer_id: 'ci-1' }] }, 'ci-1')).toBeNull();
  });
});
