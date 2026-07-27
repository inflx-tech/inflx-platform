/* ════════════════════════════════════════════════════════════════════════
   Brand campaign stage model (features/brand-mobile-cc, A6).
   Mirrors the brand-web CommandRail stages so a campaign reads the same on
   both surfaces: Fund → Roster → Contracts → Production → Review → Payout.
   Pure + testable; the screen maps `prime.kind` to an action.
   ══════════════════════════════════════════════════════════════════════ */

export const CAMPAIGN_STAGES = [
  { key: 'fund',       label: 'Fund' },
  { key: 'roster',     label: 'Roster' },
  { key: 'contracts',  label: 'Contracts' },
  { key: 'production', label: 'Production' },
  { key: 'review',     label: 'Review' },
  { key: 'payout',     label: 'Payout' },
];

export const stageIndex = (key) => CAMPAIGN_STAGES.findIndex(s => s.key === key);

/**
 * campaign status + derived counts → { stageKey, prime: { label, kind, ... } }
 * kinds: 'publish' | 'applications' | 'reviews' | 'live' | 'negotiations' | 'payout' | 'none'
 */
export function deriveCampaignStage(status, c = {}) {
  const {
    applicationsCount = 0,
    reviewsCount = 0,
    liveConfirmCount = 0,
    negotiatingCount = 0,
  } = c;

  if (status === 'draft' || status === 'pending_wallet') {
    return { stageKey: 'fund', prime: { label: 'Fund wallet & publish', kind: 'publish' } };
  }
  if (status === 'cancelled') {
    return { stageKey: 'fund', prime: { label: 'Campaign cancelled', kind: 'none' } };
  }
  if (status === 'completed') {
    return { stageKey: 'payout', prime: { label: 'View payouts', kind: 'payout' } };
  }
  if (applicationsCount > 0) {
    return {
      stageKey: 'roster',
      prime: { label: `Review ${applicationsCount} application${applicationsCount !== 1 ? 's' : ''}`, kind: 'applications' },
    };
  }
  if (negotiatingCount > 0) {
    return {
      stageKey: 'contracts',
      prime: { label: `${negotiatingCount} negotiation${negotiatingCount !== 1 ? 's' : ''} open`, kind: 'negotiations' },
    };
  }
  if (liveConfirmCount > 0) {
    return {
      stageKey: 'review',
      prime: { label: `Confirm ${liveConfirmCount} live URL${liveConfirmCount !== 1 ? 's' : ''}`, kind: 'live' },
    };
  }
  if (reviewsCount > 0) {
    return {
      stageKey: 'review',
      prime: { label: `Review ${reviewsCount} deliverable${reviewsCount !== 1 ? 's' : ''}`, kind: 'reviews' },
    };
  }
  const base = status === 'published' ? 'roster' : status === 'live' ? 'review' : 'production';
  return { stageKey: base, prime: { label: 'All caught up', kind: 'none' } };
}

/** Stage nodes flagged done / current / todo for the rail. */
export function stageTrack(stageKey) {
  const i = stageIndex(stageKey);
  return CAMPAIGN_STAGES.map((s, idx) => ({
    ...s,
    state: i < 0 ? 'todo' : idx < i ? 'done' : idx === i ? 'current' : 'todo',
  }));
}
