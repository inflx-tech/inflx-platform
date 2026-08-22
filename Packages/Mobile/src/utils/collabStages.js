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

/* ── Stage 1 — six stages, not eight ──────────────────────────────────────────
   Contract: features/stage-1-find-each-other-and-agree, drawn from the agreed
   spine board.

   The old list was Invites · Applied · Negotiating · To sign · Active · Tracking ·
   Completed · Archive. Three of those were derived states a creator never sees, and
   'applied' could never be non-empty at all — nothing in the backend ever writes it.

   The six below are the lifecycle itself, and a collaboration sits at exactly ONE of
   them: the stage you find it under and the step you are on are the same fact shown
   twice. Invitations and Pitches stay separate for her deliberately — direction is
   what she is choosing between, which is not true for the brand.

   Shoot, Content and Done are Stages 4 and 5. They are listed here from the start so
   the rail never changes shape as work arrives — and so she can see the whole road.  */
export const COLLAB_STAGES = [
  'invitations', 'pitches', 'to_sign', 'shoot', 'content', 'done',
];

export const STAGE_META = {
  all:         { key: 'all',         label: 'All' },
  invitations: { key: 'invitations', label: 'Invitations' },
  pitches:     { key: 'pitches',     label: 'Pitches' },
  to_sign:     { key: 'to_sign',     label: 'To sign' },
  shoot:       { key: 'shoot',       label: 'Shoot' },
  content:     { key: 'content',     label: 'Content' },
  done:        { key: 'done',        label: 'Done' },
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

  // A conversation carries its own direction, and that decides its stage outright:
  // a brand asking her is an Invitation whatever state it is in, and her pitch is a
  // Pitch. Both leave for 'To sign' only when a campaign invite actually exists.
  if (record?.source === 'request')  return 'invitations';
  if (record?.source === 'proposal') return 'pitches';

  // Closed engagements are 'done' rather than a separate archive: she asked for six
  // stages, and a declined conversation is finished, not a category of its own.
  if (TERMINAL.has(s)) return 'done';

  switch (s) {
    // An invite that arrived without a prior handshake still reads as an invitation
    // — it IS a brand asking her, and it belongs beside the others.
    case 'invited':
      return 'invitations';
    case 'applied':
      return 'pitches';
    case 'negotiating':
    case 'awaiting_brand':
    case 'awaiting_influencer':
      return 'invitations';
    case 'accepted':
    case 'pending_influencer':
    case 'pending_brand':
      return 'to_sign';
    case 'completed':
      return 'done';
    case 'contracted':
    case 'active': {
      // Shoot and Content are Stages 4 and 5. Until the shoot has its own screen,
      // signed work sits in Shoot until there is deliverable progress, then Content.
      // Deliberately NOT invented: nothing here claims a shoot is finished when the
      // system has no way to know it.
      const total = Number(record?.deliverable_count || 0);
      const done  = Number(record?.approved_count || 0);
      if (total > 0 && done >= total) return 'done';
      if (total > 0) return 'content';
      return 'shoot';
    }
    default:
      // Unknown or future status: keep it visible rather than hiding it.
      return 'shoot';
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

  // Stage 1 — a conversation's turn is decided by who moved LAST, not by its status.
  // 'countered' alone cannot answer it: the same word describes her waiting for them
  // and them waiting for her. counter_by is what separates the two.
  if (record?.source === 'request') {
    if (s === 'sent' || s === 'viewed') return 'you';
    if (s === 'countered') return record.counter_by === 'brand' ? 'you' : 'brand';
    return 'none';                                   // agreed, declined, withdrawn, expired
  }
  if (record?.source === 'proposal') {
    if (s === 'countered') return record.counter_by === 'brand' ? 'you' : 'brand';
    if (s === 'sent' || s === 'viewed') return 'brand';
    return 'none';
  }

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

/* ── Stage 1 — the two record types that have never reached this list ──────────
   A brand's request and her own pitch are conversations about terms. Until now they
   lived under Profile → Brand Proposals, which is why a real request sat unseen for a
   week. They normalise into the same shape as everything else so one row is one
   conversation, whatever is behind it.                                              */

/** Money and time, phrased the way a row says it. */
function termsLine(t) {
  if (!t) return '';
  const bits = [];
  const pct = t.money?.commission_pct;
  const fee = t.money?.fee;
  if (fee != null)  bits.push(`₹${Number(fee).toLocaleString('en-IN')}`);
  if (pct != null)  bits.push(`${pct}%`);
  const by = t.time?.post_by;
  if (by) bits.push(`post by ${String(by).slice(0, 10)}`);
  return bits.join(' · ');
}

/** Normalize a brand → creator request (brand_collab_requests.*). */
export function normalizeRequest(r) {
  const settled = r.counter_terms_json || r.terms_json || null;
  return {
    ciId:            `request:${r.id}`,       // namespaced — never collides with a ci id
    recordId:        r.id,
    brand_name:      r.business_name || r.brand_name || 'Brand',
    campaign_name:   '',
    status:          r.status,
    terms_line:      termsLine(settled),
    fee:             settled?.money?.fee || 0,
    expires_at:      r.expires_at || null,
    counter_by:      r.counter_by || null,
    deliverable_count: 0,
    approved_count:    0,
    source:          'request',
    raw:             r,
  };
}

/** Normalize her pitch to a brand (influencer_proposals.*). */
export function normalizeProposal(p) {
  return {
    ciId:            `proposal:${p.id}`,
    recordId:        p.id,
    brand_name:      p.business_name || p.brand_name || 'Brand',
    campaign_name:   p.pitch_title || '',
    status:          p.status,
    terms_line:      termsLine(p.counter_terms) || termsLine({
      money: { fee: p.proposed_fee, commission_pct: p.proposed_commission_pct },
    }),
    fee:             p.proposed_fee || 0,
    expires_at:      p.expires_at || null,
    counter_by:      p.counter_by || null,
    viewed_at:       p.viewed_at || null,
    deliverable_count: 0,
    approved_count:    0,
    source:          'proposal',
    raw:             p,
  };
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
export function mergeCollabs(offers = [], campaigns = [], requests = [], proposals = []) {
  const map = new Map();

  // Stage 1 — conversations first. They are keyed on their own record id, namespaced,
  // so they can never be deduped against a campaign assignment by accident.
  for (const r of (requests || [])) {
    if (r == null || r.id == null) continue;
    const n = normalizeRequest(r);
    map.set(String(n.ciId), n);
  }
  for (const p of (proposals || [])) {
    if (p == null || p.id == null) continue;
    const n = normalizeProposal(p);
    map.set(String(n.ciId), n);
  }

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
  // Stage 1 — the six-stage names. Everything up to and including To sign is still a
  // conversation about terms; Shoot onward is work under a signed contract.
  return stage === 'invitations' || stage === 'pitches' || stage === 'to_sign';
}
