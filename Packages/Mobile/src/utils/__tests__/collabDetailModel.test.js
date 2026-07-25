import { heroFor, sectionsFor, spineFor } from '../collabDetailModel';

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
    expect(heroFor({ stage: 'tracking', status: 'active' }).actions).toEqual(['deliverables']);
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
  it('active shows the full post-sign set', () => {
    const keys = sectionsFor({ stage: 'active', physical_delivery: true, products_total: 4 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'logistics', 'deliverables', 'earnings', 'products']);
  });
  it('logistics only when physical_delivery; products only when >0', () => {
    const keys = sectionsFor({ stage: 'active', physical_delivery: false, products_total: 0 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'deliverables', 'earnings']);
  });
  it('completed keeps contract + deliverables + earnings', () => {
    const keys = sectionsFor({ stage: 'completed', products_total: 0 }).map(s => s.key);
    expect(keys).toEqual(['terms', 'contract', 'deliverables', 'earnings']);
  });
});

describe('spineFor — progress state', () => {
  it('marks done/current/todo around the stage', () => {
    const s = spineFor('to_sign');
    expect(s.find(n => n.key === 'invite').state).toBe('done');
    expect(s.find(n => n.key === 'nego').state).toBe('done');
    expect(s.find(n => n.key === 'sign').state).toBe('current');
    expect(s.find(n => n.key === 'active').state).toBe('todo');
  });
  it('applied maps to the invite node (current)', () => {
    expect(spineFor('applied').find(n => n.key === 'invite').state).toBe('current');
  });
  it('archive → no current highlight', () => {
    expect(spineFor('archive').every(n => n.state === 'todo')).toBe(true);
  });
});
