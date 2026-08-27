/**
 * campaignDraft.js — what the wizard is holding that the server has not been told yet.
 * Contract: features/stage-2-build-a-campaign-from-the-phone (§5.1) · action ledger #77
 *
 * THE RULE THIS EXISTS TO KEEP
 * The board (#77) says an agreement is CONSUMED ON PUBLISH, not when it is ticked:
 * "abandoning the wizard must not burn the agreement."
 *
 * The server consumes an agreement inside `invite`, in a guarded transaction that cannot
 * double-brief. That transaction works and is not worth reopening. So the phone honours
 * the board a different way: it does not invite until publish. Ticking a creator, setting
 * what she may sell and choosing an offer all happen HERE, in memory, and are posted as
 * invite payloads in one pass at the end.
 *
 * DELIBERATELY NOT PERSISTED
 * No AsyncStorage, no server draft rows for the picks. Kill the app mid-wizard and the
 * picks are gone — which is exactly right, because the alternative is a half-built
 * campaign quietly holding three agreements hostage that the brand cannot see or release.
 * The campaign and its sets DO persist, because they are real drafts a brand can come back
 * to and they hold nobody's agreement.
 *
 * THE RISK THIS CREATES, AND WHERE IT IS ANSWERED
 * An agreement can lapse between being ticked and being published. That is why "a chosen
 * agreement is no longer live" is one of the five publish blockers, and why the Review
 * screen re-reads the ready-to-brief list before it offers a Publish button.
 */

const drafts = new Map();          // campaignId -> { sets: Map(setId -> setDraft) }
const listeners = new Map();       // campaignId -> Set<fn>

function draftFor(campaignId) {
  if (!drafts.has(campaignId)) drafts.set(campaignId, { sets: new Map() });
  return drafts.get(campaignId);
}

function emit(campaignId) {
  const subs = listeners.get(campaignId);
  if (subs) subs.forEach((fn) => { try { fn(); } catch { /* a bad listener must not stop the rest */ } });
}

/** Subscribe to changes for one campaign. Returns the unsubscribe function. */
export function subscribe(campaignId, fn) {
  if (!listeners.has(campaignId)) listeners.set(campaignId, new Set());
  listeners.get(campaignId).add(fn);
  return () => { const s = listeners.get(campaignId); if (s) s.delete(fn); };
}

/**
 * The creators pencilled into one set, and the offer chosen for it.
 * Shape: { creators: [{ agreement_id, influencer_id, name, handle, avatar,
 *                       terms, alloc, expires_at }],
 *          offer: { brand_offer_id, name, offer_type } | null }
 */
export function getSetDraft(campaignId, setId) {
  const d = draftFor(campaignId);
  if (!d.sets.has(setId)) d.sets.set(setId, { creators: [], offer: null });
  return d.sets.get(setId);
}

export function setSetDraft(campaignId, setId, next) {
  const d = draftFor(campaignId);
  d.sets.set(setId, { ...getSetDraft(campaignId, setId), ...next });
  emit(campaignId);
}

/** Every set's draft, for the Review screen. */
export function getCampaignDraft(campaignId) {
  const d = draftFor(campaignId);
  const out = {};
  d.sets.forEach((v, k) => { out[k] = v; });
  return out;
}

/**
 * Which agreements are already pencilled in ANYWHERE in this campaign.
 * Ledger #73 — one agreement, one set. Without this the same creator could be ticked
 * into two sets of the same campaign and the second invite would fail at publish, after
 * the first had already been written.
 */
export function agreementIdsInUse(campaignId, exceptSetId = null) {
  const d = draftFor(campaignId);
  const ids = new Set();
  d.sets.forEach((v, setId) => {
    if (setId === exceptSetId) return;
    (v.creators || []).forEach((c) => c.agreement_id && ids.add(c.agreement_id));
  });
  return ids;
}

/** Set what one pencilled creator may sell. */
export function setCreatorAllocation(campaignId, setId, agreementId, alloc) {
  const cur = getSetDraft(campaignId, setId);
  setSetDraft(campaignId, setId, {
    creators: cur.creators.map((c) => (c.agreement_id === agreementId ? { ...c, alloc } : c)),
  });
}

/** Everything pencilled in, flattened — the Review screen's raw material. */
export function summarise(campaignId, sets) {
  const d = draftFor(campaignId);
  let creators = 0;
  const missingAllocation = [];
  const setsWithoutOffer = [];
  (sets || []).forEach((set) => {
    const sd = d.sets.get(set.id) || { creators: [], offer: null };
    creators += sd.creators.length;
    const selling = set.goal === 'conversion' || set.goal === 'hybrid';
    if (selling) {
      sd.creators.forEach((c) => {
        if (!c.alloc || !c.alloc.alloc_scope) missingAllocation.push({ set, creator: c });
      });
      if (!sd.offer && sd.creators.length) setsWithoutOffer.push(set);
    }
  });
  return { creators, missingAllocation, setsWithoutOffer };
}

/** Forget a campaign's picks — after publishing, or when the brand walks away. */
export function clearDraft(campaignId) {
  drafts.delete(campaignId);
  emit(campaignId);
  listeners.delete(campaignId);
}

/**
 * The invite payload for one pencilled creator, in the shape POST
 * /campaigns/:id/sets/:sid/invite takes. Built here rather than in the Review screen so
 * that the field names live in one place — the server's contract is the thing that must
 * not be restated from memory.
 */
export function invitePayload(creator, set, offer) {
  const t = creator.terms || {};
  const alloc = creator.alloc || {};
  const isSelling = set.goal === 'conversion' || set.goal === 'hybrid';

  const body = {
    influencer_id: creator.influencer_id,
    agreement_id: creator.agreement_id,
    posting_date: t.time?.post_by || t.time?.window_end || null,
  };

  // Money follows the aim — the same rule collabTerms.model enforces server-side. Sending
  // a fee on a conversion row is what produced "FEE ₹0" on four creator screens in Stage 1.
  if (t.money?.commission_pct != null) body.commission_pct = t.money.commission_pct;
  if (t.money?.fee != null) { body.agreed_fee = t.money.fee; body.influencer_budget = t.money.fee; }

  if (isSelling) {
    if (alloc.alloc_scope) body.alloc_scope = alloc.alloc_scope;
    if (alloc.alloc_category_node_id) body.alloc_category_node_id = alloc.alloc_category_node_id;
    if (alloc.alloc_category) body.alloc_category = alloc.alloc_category;
    if (Array.isArray(alloc.alloc_product_ids) && alloc.alloc_product_ids.length) {
      body.alloc_product_ids = alloc.alloc_product_ids;
    }
    // stage-2-offers-parity — HER offer wins over the set's.
    //
    // The offer was asked once for the whole set. The database has always stored it per
    // creator (campaign_influencers.brand_offer_id / offer_type / offer_config_json), and
    // campaign_sets has no offer columns at all — so the set-level question was storing an
    // answer somewhere the schema never had a place for.
    //
    // `offer` stays as a fallback so a draft saved before this change still sends what it had.
    const own = creator.offer || null;
    const eff = own || offer || null;

    if (eff?.brand_offer_id) {
      body.brand_offer_id = eff.brand_offer_id;
    } else if (eff?.offer_type && eff?.offer_config_json) {
      // A bespoke offer, built for this creator alone. It does not join the library — it is
      // stored on her row, and the server validates it exactly as it validates a library one.
      body.offer_type = eff.offer_type;
      body.offer_config_json = eff.offer_config_json;
    }

    // Her window. Founder, 2026-08-27: "set date is for all creators... one individual creator
    // may be work from different time." A creator who starts three weeks late should not carry
    // an offer that has been discounting to nobody for three weeks.
    if (eff?.valid_from) body.offer_valid_from = eff.valid_from;
    if (eff?.valid_until) body.offer_valid_until = eff.valid_until;
  }

  return body;
}
