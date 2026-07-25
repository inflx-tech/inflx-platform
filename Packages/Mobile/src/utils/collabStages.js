/* ════════════════════════════════════════════════════════════════════════
   Collabs stage model — contract features/collabs-list.

   Pure, frontend-only derivation over the EXISTING influencer payloads:
   - influencerApi.getOffers()      → rows are `campaign_influencers.*`
                                       (so `offer.id` === campaign_influencer id,
                                        `offer.status` === ci.status)
   - influencerApi.getMyCampaigns() → rows expose `campaign_influencer_id`
                                       + `influencer_status` (= ci.status)

   Because the two sources OVERLAP in the accepted/contracted/active window,
   the merged Collabs list MUST dedupe by campaign_influencer_id so one signed
   deal shows once. No backend/DB change; no writes.
   ════════════════════════════════════════════════════════════════════════ */

// Canonical UI stages, in display order. 'all' is a pseudo-filter (everything).
export const COLLAB_STAGES = [
  'invites', 'applied', 'negotiating', 'to_sign', 'active', 'tracking', 'completed', 'archive',
];

export const STAGE_META = {
  all:         { key: 'all',         label: 'All' },
  invites:     { key: 'invites',     label: 'Invites' },
  applied:     { key: 'applied',     label: 'Applied' },
  negotiating: { key: 'negotiating', label: 'Negotiating' },
  to_sign:     { key: 'to_sign',     label: 'To sign' },
  active:      { key: 'active',      label: 'Active' },
  tracking:    { key: 'tracking',    label: 'Tracking' },
  completed:   { key: 'completed',   label: 'Completed' },
  archive:     { key: 'archive',     label: 'Archive' },
};

const TERMINAL = new Set([
  'declined', 'expired', 'rejected_by_brand', 'slots_filled', 'cancelled', 'walked_away', 'closed',
]);

/**
 * Map one engagement → its single UI stage.
 * `record` is a normalized collab (see normalizeOffer/normalizeCampaign).
 * Tracking is derived from deliverable progress: an active engagement whose
 * deliverables are all approved/live but the campaign isn't completed yet.
 */
export function deriveStage(record) {
  const s = String(record?.status || '').toLowerCase();
  if (TERMINAL.has(s)) return 'archive';

  switch (s) {
    case 'invited':
      return 'invites';
    case 'applied':
      return 'applied';
    case 'negotiating':
    case 'awaiting_brand':
    case 'awaiting_influencer':
      return 'negotiating';
    case 'accepted':
    case 'pending_influencer':
    case 'pending_brand':
      return 'to_sign';
    case 'completed':
      return 'completed';
    case 'contracted':
    case 'active': {
      const total = Number(record?.deliverable_count || 0);
      const done  = Number(record?.approved_count || 0);
      if (total > 0 && done >= total) return 'tracking';
      return 'active';
    }
    default:
      // Unknown / future status: keep it visible in the active bucket rather
      // than hiding it. Still appears under 'all'.
      return 'active';
  }
}

/**
 * Whose turn is it? Best-effort at the LIST level (deliverable/negotiation
 * turn detail is refined in the CollabDetail contract).
 *   'you'   → actionable, yellow
 *   'brand' → waiting, blue
 *   'none'  → terminal / auto
 */
export function whoseTurn(record) {
  const s = String(record?.status || '').toLowerCase();
  if (TERMINAL.has(s) || s === 'completed') return 'none';
  switch (s) {
    case 'invited':
    case 'accepted':
    case 'pending_influencer':
    case 'negotiating':
    case 'awaiting_influencer':
      return 'you';
    case 'applied':
    case 'pending_brand':
    case 'awaiting_brand':
      return 'brand';
    case 'contracted':
    case 'active': {
      // All deliverables done → waiting on brand/results, else your turn.
      const total = Number(record?.deliverable_count || 0);
      const done  = Number(record?.approved_count || 0);
      if (total > 0 && done >= total) return 'none';
      return 'you';
    }
    default:
      return 'you';
  }
}

/** Normalize an offer row (campaign_influencers.*) to the common collab shape. */
export function normalizeOffer(o) {
  return {
    ciId:            o.id,
    brand_name:      o.brand_name || o.business_name || 'Brand',
    campaign_name:   o.campaign_name || '',
    status:          o.status,
    fee:             o.agreed_fee || o.influencer_budget || o.per_influencer_budget || o.set_budget || 0,
    deliverable_type: o.deliverable_type || null,
    offer_expires_at: o.offer_expires_at || null,
    declined_reason:  o.declined_reason || null,
    deliverable_count: 0,
    approved_count:    0,
    start_date:      o.start_date || null,
    end_date:        o.end_date || null,
    goal:            o.goal || null,
    source:          'offer',
    raw:             o,
  };
}

/** Normalize a campaign row to the common collab shape. */
export function normalizeCampaign(c) {
  return {
    ciId:            c.campaign_influencer_id,
    brand_name:      c.brand_name || 'Brand',
    campaign_name:   c.campaign_name || '',
    status:          c.influencer_status,
    fee:             c.agreed_fee || 0,
    deliverable_type: null,
    offer_expires_at: null,
    declined_reason:  null,
    deliverable_count: Number(c.deliverable_count || 0),
    approved_count:    Number(c.approved_count || 0),
    start_date:      c.start_date || null,
    end_date:        c.end_date || null,
    goal:            c.goal || null,
    source:          'campaign',
    raw:             c,
  };
}

/**
 * Merge offers + campaigns into ONE deduped list keyed by campaign_influencer id.
 * When a record exists in both sources (overlap window), the campaign record wins
 * (it carries deliverable progress); offer-only fields are backfilled.
 * Returns an array of normalized collabs, each with a derived `stage`.
 */
export function mergeCollabs(offers = [], campaigns = []) {
  const map = new Map();

  for (const o of (offers || [])) {
    if (o == null || o.id == null) continue;
    const n = normalizeOffer(o);
    map.set(String(n.ciId), n);
  }

  for (const c of (campaigns || [])) {
    if (c == null || c.campaign_influencer_id == null) continue;
    const n = normalizeCampaign(c);
    const key = String(n.ciId);
    const existing = map.get(key);
    if (existing) {
      // Campaign wins; keep offer-only fields (expiry, deliverable_type) that the
      // campaign payload lacks.
      map.set(key, {
        ...existing,
        ...n,
        offer_expires_at: n.offer_expires_at || existing.offer_expires_at,
        deliverable_type: existing.deliverable_type || n.deliverable_type,
      });
    } else {
      map.set(key, n);
    }
  }

  return Array.from(map.values()).map(r => ({
    ...r,
    stage: deriveStage(r),
    turn:  whoseTurn(r),
  }));
}

/** Filter a merged list by stage key ('all' returns everything). */
export function filterByStage(collabs = [], stageKey = 'all') {
  if (!stageKey || stageKey === 'all') return collabs;
  return collabs.filter(c => c.stage === stageKey);
}

/** Per-stage counts over a merged list (plus `all`). */
export function stageCounts(collabs = []) {
  const counts = { all: collabs.length };
  for (const s of COLLAB_STAGES) counts[s] = 0;
  for (const c of collabs) {
    if (counts[c.stage] != null) counts[c.stage] += 1;
  }
  return counts;
}

/**
 * Is this a pre-sign engagement (routes to OfferDetail) or post-sign
 * (routes to CampaignDetail)? Transitional routing until CollabDetail lands.
 */
export function isPreSign(record) {
  const stage = record.stage || deriveStage(record);
  return stage === 'invites' || stage === 'applied' || stage === 'negotiating' || stage === 'to_sign';
}
