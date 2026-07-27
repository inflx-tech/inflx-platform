import { deriveCampaignStage, stageTrack, CAMPAIGN_STAGES } from '../campaignStages';

describe('deriveCampaignStage — brand campaign next action', () => {
  it('draft / pending_wallet → Fund & Publish (the mobile gap this closes)', () => {
    expect(deriveCampaignStage('draft')).toEqual({ stageKey: 'fund', prime: { label: 'Fund wallet & publish', kind: 'publish' } });
    expect(deriveCampaignStage('pending_wallet').prime.kind).toBe('publish');
  });

  it('applications waiting → roster stage', () => {
    const r = deriveCampaignStage('published', { applicationsCount: 3 });
    expect(r.stageKey).toBe('roster');
    expect(r.prime).toEqual({ label: 'Review 3 applications', kind: 'applications' });
  });

  it('singular vs plural labels', () => {
    expect(deriveCampaignStage('published', { applicationsCount: 1 }).prime.label).toBe('Review 1 application');
    expect(deriveCampaignStage('active', { reviewsCount: 1 }).prime.label).toBe('Review 1 deliverable');
    expect(deriveCampaignStage('active', { liveConfirmCount: 1 }).prime.label).toBe('Confirm 1 live URL');
  });

  it('negotiations → contracts stage', () => {
    const r = deriveCampaignStage('active', { negotiatingCount: 2 });
    expect(r.stageKey).toBe('contracts');
    expect(r.prime.kind).toBe('negotiations');
  });

  it('live-confirm outranks pending reviews (money moves first)', () => {
    const r = deriveCampaignStage('live', { reviewsCount: 5, liveConfirmCount: 1 });
    expect(r.prime.kind).toBe('live');
  });

  it('completed → payout', () => {
    expect(deriveCampaignStage('completed')).toEqual({ stageKey: 'payout', prime: { label: 'View payouts', kind: 'payout' } });
  });

  it('cancelled → no action', () => {
    expect(deriveCampaignStage('cancelled').prime.kind).toBe('none');
  });

  it('nothing pending → all caught up, stage from status', () => {
    expect(deriveCampaignStage('published').stageKey).toBe('roster');
    expect(deriveCampaignStage('live').stageKey).toBe('review');
    expect(deriveCampaignStage('active').stageKey).toBe('production');
    expect(deriveCampaignStage('active').prime.kind).toBe('none');
  });
});

describe('stageTrack', () => {
  it('marks done / current / todo around the stage', () => {
    const t = stageTrack('contracts');
    expect(t.find(s => s.key === 'fund').state).toBe('done');
    expect(t.find(s => s.key === 'roster').state).toBe('done');
    expect(t.find(s => s.key === 'contracts').state).toBe('current');
    expect(t.find(s => s.key === 'review').state).toBe('todo');
  });
  it('covers every stage', () => {
    expect(stageTrack('fund')).toHaveLength(CAMPAIGN_STAGES.length);
  });
});
