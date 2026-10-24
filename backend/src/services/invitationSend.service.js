'use strict';

/**
 * Item 5 — ONE place that creates an invitation row, and the two brand-side exits.
 * Contract: features/item5-invitations · rules v1.16 §7A · APPROVAL.md §4.2, §4.3, §4.5
 *
 * Every door goes through prepareOne() + insertOne():
 *   · the item 5 batch send   POST /campaigns/:id/sets/:sid/invitations   (mode 'strict')
 *   · the legacy brief door   POST /campaigns/:id/sets/:sid/invite        (mode 'legacy')
 *
 * The gates, in order (the fourteen the legacy handler grew, now in one file):
 *   set-level: a posting date, not expired, date not passed, cutoff not passed (assertSetOpen)
 *   channels / formats shape · terms per Aim (§7) · eligibility (skipped for a briefed agreement,
 *   founder Q6) · the agreement itself · allocation + the selling-set gate · offer attachment and
 *   promoted offers · engagement purity · the creator exists (and, strict, is approved) · no LIVE
 *   row in this set (§7 "already in this set") · no LIVE row elsewhere in the campaign (item 4 Q6)
 *   · the engagement budget · the coupon.
 *
 * The batch is one action: every creator is prepared (read-only) before any write; the first
 * failure per creator is collected; if any creator failed, nothing is written and the brand is
 * told who and why. Then one transaction locks the set row, re-checks the set-level rules and
 * inserts every row. Notifications go after commit.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const notificationService = require('./notification.service');
const campaignRollup = require('./campaignRollup.service');
const campaignState = require('./campaignState.service');
const eligibility = require('./collabEligibility.service');
const handshakeService = require('./handshake.service');
const { SELLING_GOALS, DEAD_STATUSES } = require('./collabOwedItems.service');
const { SIGNED_CONTRACT_SQL } = require('./collabState');
const { calendarDay, startOfIndiaDay, endOfIndiaDay, todayInIndia, isBefore } = require('../utils/indiaDay');
const { validateOfferConfig } = require('./offerConfig.validator');
const inputs = require('./invitationInputs.service');
const { validateTerms, offerMessageFor } = require('./invitationTerms.service');
const { MSG, NOTIFY, first } = require('./invitationCopy');
// Item 6 — the pool hook and the stamped shoppable-post minimum. Contract: features/item6-negotiation
const poolService = require('./pool.service');
const platformRules = require('../config/platformRules');
// creator-terms-v2 — offers linked + products without offers, frozen at sending (rules §2).
const creatorTerms = require('./creatorTerms.service');
const { MSG: MSG6 } = require('./negotiationCopy');

/** A row in one of these statuses is IN the set; anything else never blocks a fresh invitation. */
const LIVE_STATUSES = ['invited', 'applied', 'accepted', 'negotiating', 'contracted', 'active', 'completed'];

/* ────────────────────────────────────────────────────────── set-level */

/**
 * The §7 set-level refusals, in the order a brand would hit them. `set` is a campaign_sets row.
 * Returns item 4's describeSet() for the caller.
 */
function assertSetOpen(set, counts = campaignState.EMPTY_COUNTS, today = null) {
  if (!set.go_live_date) throw new AppError('INVITE_CLOSED', MSG.NO_DATE, 422, 'go_live_date');
  const d = campaignState.describeSet(set, counts, today);
  if (d.state === 'expired') throw new AppError('INVITE_CLOSED', MSG.SET_EXPIRED, 422, 'go_live_date');
  if (d.datePassed) throw new AppError('INVITE_CLOSED', MSG.DATE_PASSED, 422, 'go_live_date');
  if (d.cutoffPassed) throw new AppError('INVITE_CLOSED', MSG.INVITE_CLOSED(d.cutoff), 422, 'go_live_date');
  if (d.state === 'completed') throw new AppError('INVITE_CLOSED', MSG.INVITE_CLOSED(d.cutoff), 422, 'go_live_date');
  return d;
}

/* ───────────────────────────────────────────────────────── one creator */

async function creatorFacts(influencerId, conn = db) {
  const { rows } = await conn.query(
    `SELECT i.id, u.id AS user_id, u.fcm_token, u.phone, u.status AS user_status,
            COALESCE(i.full_name, u.name) AS full_name
       FROM influencers i JOIN users u ON u.id = i.user_id
      WHERE i.id = $1`,
    [influencerId]
  );
  return rows[0] || null;
}

/** Save a special offer to the library first (I7 "Also save to my offers"), then attach by id. */
async function saveSpecialOfferToLibrary({ brandId, offer, creatorName, conn = db }) {
  const check = await validateOfferConfig({ offerType: offer.offerType, offerConfig: offer.offerConfigJson, brandId, db: conn });
  if (!check.ok) throw new AppError('VALIDATION_ERROR', offerMessageFor(check), 422, 'offer_config_json');
  const name = (offer.name && String(offer.name).trim()) || `Special offer for ${first(creatorName)}`;
  const { rows } = await conn.query(
    `INSERT INTO brand_offers (brand_id, name, offer_type, offer_config_json, status)
     VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
    [brandId, name.slice(0, 120), offer.offerType, JSON.stringify(offer.offerConfigJson)]
  );
  return rows[0].id;
}

/**
 * Everything but the write. Throws the FIRST problem for this creator as an AppError with the
 * exact message and field; the batch collects these per creator.
 *
 * @param {object} p
 * @param {object} p.brand       brands row (id)
 * @param {object} p.campaign    campaigns row
 * @param {object} p.set         campaign_sets row
 * @param {object} p.body        the creator's input: influencer_id / influencerId plus terms in
 *                               either spelling, and the legacy fields the brief door sends
 * @param {'strict'|'legacy'} p.mode
 * @param {string} p.source      brand_picker | group | pitch | legacy
 * @param {string} [p.sourceGroupId]
 * @param {string} [p.actorUserId]
 */
async function prepareOne({ brand, campaign, set, body, mode = 'strict', source, sourceGroupId = null, actorUserId = null }) {
  const strict = mode !== 'legacy';
  const influencer_id = body.influencer_id || body.influencerId;
  if (!influencer_id) throw new AppError('VALIDATION_ERROR', 'influencer_id is required', 422, 'influencer_id');
  const goal = set.goal;
  const {
    posting_date, promoted_brand_offer_ids, coupon_code: customCouponCode,
    physical_delivery, delivery_address, influencer_budget, agreement_id, channels_json,
  } = body;

  // ── Item 8, Phase 2a: THE BRIEF PATH IS CLOSED. ─────────────────────────
  //
  // Briefing a creator from a settled agreement skipped item 2's eligibility
  // entirely — her paused switch, her blocks, her Aims, her modes, her
  // categories and her minimums were all bypassed, so a creator who blocked
  // the brand AFTER agreeing could still be put into a set by it. It could
  // also land her on her signing queue with a contract in one call.
  //
  // Item 8 replaces it: an agreed pitch puts her in the brand's pool, and the
  // ordinary send takes her out of it with every check applied. This refusal
  // is server-side on purpose — a hidden button is not a switch-off.
  //
  // The eight invitations already created this way keep working untouched,
  // and every reader of `campaign_influencers.agreement_id` keeps reading.
  if (agreement_id) {
    throw new AppError('VALIDATION_ERROR', MSG.BRIEF_CLOSED, 422, 'agreement_id');
  }

  if (channels_json !== undefined) inputs.assertValidChannels(goal, channels_json);
  if (body.formats_json !== undefined && goal !== 'engagement') inputs.assertValidFormats(body.formats_json);

  // ── Terms per Aim (§7). The legacy door validates what is present (see invitationTerms). ──
  const terms = validateTerms(goal, body, { mode, sell: true });

  // ── The creator ─────────────────────────────────────────────────────────
  const inf = await creatorFacts(influencer_id);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer not found', 404, 'influencer_id');
  if (strict && inf.user_status !== 'approved') throw new AppError('NOT_MATCHING', MSG.INELIGIBLE(inf.full_name), 422, 'influencer_id');
  const name = inf.full_name || 'This creator';

  // ── Item 2 eligibility — skipped for a briefed agreement (settings are never retroactive). ──
  let eligibility_warnings = [];
  let minimums = null;
  if (!agreement_id) {
    const fee = terms.fee != null ? terms.fee : (body.agreed_fee != null ? body.agreed_fee : influencer_budget);
    const gate = await eligibility.canBrandInviteCreator({
      brandId: brand.id, influencerId: influencer_id, set,
      proposedTerms: { fee, commissionPct: terms.commissionPct != null ? terms.commissionPct : body.commission_pct },
      name: inf.full_name || null,
    });
    if (!gate.ok) {
      // ui-walk-fixes, founder decision D2 (2 Oct 2026): the item 5 send tells the brand WHY,
      // in the same words the picker printed on her row — the sentence as the message, the
      // short line and the rule beside it. (It used to say only "{name} can no longer be
      // invited to this set.") The legacy brief door — only the website calls it, and the
      // website is not in this change — keeps its coarse sentence and its 403.
      if (strict) throw new AppError(gate.reason, gate.message, 422, 'influencer_id', { detail: gate.detail || null, label: gate.label });
      throw new AppError(gate.reason, eligibility.MESSAGE.invite[gate.reason], 403, 'influencer_id');
    }
    eligibility_warnings = gate.warnings;
    minimums = gate.minimums || null;
  }

  // ── The agreement, before any write ─────────────────────────────────────
  let agreement = null;
  if (agreement_id) {
    const { rows: agrRows } = await db.query(`SELECT * FROM collab_agreements WHERE id = $1 AND brand_id = $2`, [agreement_id, brand.id]);
    agreement = agrRows[0];
    if (!agreement) throw new AppError('NOT_FOUND', 'Agreement not found', 404, 'agreement_id');
    if (agreement.influencer_id !== influencer_id) throw new AppError('VALIDATION_ERROR', 'That agreement is with a different creator', 422, 'agreement_id');
    if (agreement.status !== 'ready') throw new AppError('VALIDATION_ERROR', `That agreement is ${agreement.status} and cannot be briefed`, 422, 'agreement_id');
    const agreedAim = String((agreement.terms_json || {}).aim || '').toLowerCase();
    if (agreedAim && agreedAim !== goal) {
      throw new AppError('VALIDATION_ERROR', `This creator agreed ${agreedAim} terms — add them to a ${agreedAim} set, not a ${goal} one`, 422, 'agreement_id');
    }
  }

  // ── Allocation: what she may sell ───────────────────────────────────────
  const allocInput = terms.scope
    ? { alloc_scope: terms.scope, alloc_category_node_id: terms.categoryNodeId, alloc_category: terms.category, alloc_product_ids: terms.productIds }
    : { alloc_scope: body.alloc_scope, alloc_category_node_id: body.alloc_category_node_id, alloc_category: body.alloc_category, alloc_product_ids: body.alloc_product_ids };
  // creator-terms-v2: what she can sell = her offers + products without offers (rules 2.3, 2.4).
  // Validated against the set's posting date and FROZEN here; nothing of the old scope is written.
  // Item 21 (rules v1.34 §7A): a Pay for Content invitation carries what she POSTS ABOUT the same way.
  const sellPlan = terms.sell
    ? await creatorTerms.resolveSell({ brandId: brand.id, postingDate: set.go_live_date, sell: terms.sell, creatorName: name, postsAbout: goal === 'engagement' })
    : null;
  const alloc = sellPlan ? null : await inputs.resolveAllocation({ brandId: brand.id, ...allocInput });
  if (SELLING_GOALS.includes(goal) && !alloc && !sellPlan) {
    throw new AppError('VALIDATION_ERROR', strict ? MSG.SCOPE_CATEGORIES
      : 'Say what this creator may sell before adding her. On a selling set a creator with no allocation is contracted and invisible in the shopping app.', 422, 'alloc_scope');
  }

  // ── The follower offer: library snapshot or special (inline) ────────────
  let offerIn = { brand_offer_id: body.brand_offer_id, offer_type: body.offer_type, offer_config_json: body.offer_config_json };
  if (terms.offer) {
    let libraryId = terms.offer.brandOfferId;
    if (!libraryId && terms.offer.saveToLibrary) libraryId = await saveSpecialOfferToLibrary({ brandId: brand.id, offer: terms.offer, creatorName: name });
    offerIn = libraryId
      ? { brand_offer_id: libraryId, offer_type: null, offer_config_json: null }
      : { brand_offer_id: null, offer_type: terms.offer.offerType, offer_config_json: terms.offer.offerConfigJson };
  } else if (strict) {
    offerIn = { brand_offer_id: null, offer_type: null, offer_config_json: null };
  }
  let offer;
  try {
    offer = sellPlan
      ? { effType: null, effConfig: null, brandOfferId: null, allocation: 'commissioned' }
      : await inputs.resolveOfferAttachment({ brandId: brand.id, goal, ...offerIn });
  } catch (e) {
    if (strict && e instanceof AppError && e.code === 'VALIDATION_ERROR' && offerIn.offer_type) throw new AppError('VALIDATION_ERROR', offerMessageFor(e), 422, 'offer_config_json');
    throw e;
  }
  const promotedIds = await inputs.validatePromotedOffers(brand.id, promoted_brand_offer_ids);
  const finalAllocation = promotedIds ? 'promotional' : offer.allocation;

  // ── Goal-conditional legacy rules ───────────────────────────────────────
  const commission_pct = terms.commissionPct != null ? terms.commissionPct : null;
  if (goal === 'engagement') {
    if (customCouponCode) throw new AppError('VALIDATION_ERROR', 'coupon_code must not be set for engagement (promotional) offers', 422, 'coupon_code');
    if (!strict && body.commission_pct) throw new AppError('VALIDATION_ERROR', 'commission_pct must not be set for engagement (promotional) offers', 422, 'commission_pct');
  }
  if ((goal === 'conversion' || goal === 'hybrid') && !offer.effType && !alloc && !sellPlan) {
    throw new AppError('VALIDATION_ERROR', 'conversion and hybrid collaborations need either an allocation (alloc_scope) or an offer', 422, 'alloc_scope');
  }

  /**
   * ── Already LIVE in THIS set. That is the whole rule. ──────────────────────
   *
   * Rules v1.21:
   *   §148 "The same Creator may belong to multiple Sets within the same Campaign, for example
   *         for different Aims or different negotiated arrangements."
   *   §268 "A Creator who is live in this Set cannot be chosen again. A Creator whose earlier
   *         invitation ended … may be invited again, to this Set or to another Set of the same
   *         Campaign, while there is still time."
   *
   * There used to be a second check here refusing her anywhere else in the campaign — legacy,
   * predating item 4, which only narrowed it (APPROVAL Q6 excluded the dead statuses). It was
   * never in the rules and directly contradicts both lines above. Removed 2026-09-17 after the
   * founder hit it at Review and send: "Asha M. is already in another set of this campaign",
   * refusing a Pay for Sale set to a creator already on a Pay for Content one — the exact case
   * §148 names as allowed.
   *
   * One set, one live row. Across sets, nothing to say.
   */
  const { rows: sameSet } = await db.query(
    `SELECT 1 FROM campaign_influencers WHERE set_id = $1 AND influencer_id = $2 AND status = ANY($3::campaign_influencer_status[]) LIMIT 1`,
    [set.id, influencer_id, LIVE_STATUSES]
  );
  if (sameSet[0]) throw new AppError('CONFLICT', MSG.DUPLICATE(name), 409, 'influencer_id');

  // ── Engagement / hybrid budget (legacy) ─────────────────────────────────
  if ((goal === 'engagement' || goal === 'hybrid') && influencer_budget != null && set.set_budget != null) {
    const { rows: allocRows } = await db.query(`SELECT COALESCE(SUM(influencer_budget), 0) AS allocated FROM campaign_influencers WHERE set_id = $1`, [set.id]);
    const remaining = parseFloat(set.set_budget) - parseFloat(allocRows[0].allocated);
    if (parseFloat(influencer_budget) > remaining) {
      throw new AppError('VALIDATION_ERROR', `Budget exceeds remaining set budget of ₹${remaining.toFixed(2)}`, 422, 'influencer_budget');
    }
  }

  // Coupon code handling — a label a shop can read off a bill, never how a sale finds the
  // creator (features/coupon-not-mandatory). With neither a code nor a prefix it stays null.
  // creator-terms-v2 (rules 2.10): the per-creator offer code is retired — none for the new terms.
  let finalCouponCode = null;
  if ((goal === 'conversion' || goal === 'hybrid') && !sellPlan) {
    if (customCouponCode) {
      const { rows: dup } = await db.query(`SELECT 1 FROM campaign_influencers WHERE coupon_code = $1`, [customCouponCode]);
      if (dup[0]) throw new AppError('CONFLICT', `Coupon code '${customCouponCode}' is already in use`, 409, 'coupon_code');
      finalCouponCode = customCouponCode;
    } else if (set.coupon_prefix) {
      finalCouponCode = await inputs.generateUniqueCouponCode(set.coupon_prefix, inf.full_name || 'INF');
    }
  }

  // ── Dates ───────────────────────────────────────────────────────────────
  // The creator's own posting date (legacy) — item 5 posts on the set's day.
  const postingDate = posting_date || null;
  let submissionDeadline = null;
  if (postingDate) { const pd = new Date(postingDate); pd.setHours(pd.getHours() - 24); submissionDeadline = pd.toISOString(); }
  const expiresAt = postingDate ? new Date(postingDate) : null;
  // The offer runs from the set's posting date unless the brand set other dates (§7A).
  const dayOrInstant = (v, end) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return end ? endOfIndiaDay(v) : startOfIndiaDay(v);
    return v;
  };
  const offerValidFrom = terms.offer
    ? (terms.offerValidFrom ? dayOrInstant(terms.offerValidFrom, false) : startOfIndiaDay(calendarDay(set.go_live_date)))
    : (body.offer_valid_from || null);
  const offerValidUntil = terms.offer ? dayOrInstant(terms.offerValidUntil, true) : (body.offer_valid_until || null);

  // ── Legacy money passthrough on the brief door ──────────────────────────
  const agreedFee = terms.fee != null ? terms.fee : (!strict && body.agreed_fee != null ? body.agreed_fee : null);
  const formats = terms.deliverables ? terms.deliverables : (body.formats_json !== undefined ? body.formats_json : null);

  // ── W18 — an agreed term being changed is allowed but never silent ──────
  const agreement_warnings = [];
  if (agreement) {
    const t = agreement.terms_json || {};
    const agreedPct = t.money && t.money.commission_pct != null ? Number(t.money.commission_pct) : null;
    const agreedFeeA = t.money && t.money.fee != null ? Number(t.money.fee) : null;
    const agreedBy = (t.time && (t.time.post_by || t.time.window_end)) || null;
    if (agreedPct != null && commission_pct != null && Number(commission_pct) !== agreedPct) {
      agreement_warnings.push(`They agreed ${agreedPct}% commission — you are sending ${commission_pct}%. They will have to agree again.`);
    }
    if (agreedFeeA != null && agreedFee != null && Number(agreedFee) !== agreedFeeA) {
      agreement_warnings.push(`They agreed a ₹${agreedFeeA} fee — you are sending ₹${agreedFee}.`);
    }
    if (agreedBy && postingDate && String(postingDate).slice(0, 10) !== String(agreedBy).slice(0, 10)) {
      agreement_warnings.push(`They agreed to post by ${String(agreedBy).slice(0, 10)} — you are asking for ${String(postingDate).slice(0, 10)}.`);
    }
  }

  // ── Item 6: from the pool (APPROVAL §3.2, §3.3). The entry must be this brand's, hers and
  // still waiting; it is marked used at insert, whatever she then answers.
  let poolEntry = null;
  if (strict && (body.poolEntryId || body.pool_entry_id)) {
    poolEntry = await poolService.waitingEntry({ entryId: body.poolEntryId || body.pool_entry_id, brandId: brand.id, influencerId: influencer_id });
    if (!poolEntry || poolEntry.state !== 'waiting') throw new AppError('VALIDATION_ERROR', MSG6.POOL_GONE(name), 422, 'poolEntryId');
  }
  // ── Item 6: the admin minimum, stamped on the invitation at send (rules §7B) ──
  const minShoppable = SELLING_GOALS.includes(goal) ? await platformRules.minShoppablePosts() : null;

  return {
    influencer_id, inf, name, terms, agreement, agreement_warnings, eligibility_warnings, minimums,
    source: poolEntry ? 'pool' : (source || (agreement ? 'pitch' : (strict ? 'brand_picker' : 'legacy'))),
    sourceGroupId: sourceGroupId || null, actorUserId, poolEntry,
    sellPlan,
    values: {
      sell_v2: !!sellPlan, sell_mode: sellPlan ? sellPlan.mode : null, sell_product_ids: sellPlan ? sellPlan.productIds : [],
      min_shoppable_posts: minShoppable, pool_entry_id: poolEntry ? poolEntry.id : null,
      // Item 21: the number of shoppable posts the brand asked for (Pay for Content only).
      shoppable_posts_n: goal === 'engagement' && sellPlan ? terms.shoppablePostsN : null,
      agreed_fee: agreedFee, posting_date: postingDate, offer_expires_at: expiresAt,
      offer_type: offer.effType || null, offer_config_json: offer.effConfig ? JSON.stringify(offer.effConfig) : null,
      commission_pct, coupon_code: finalCouponCode,
      physical_delivery: physical_delivery || false, delivery_address: delivery_address || null,
      influencer_budget: influencer_budget || null, submission_deadline: submissionDeadline,
      brand_offer_id: offer.brandOfferId, allocation: finalAllocation, promoted_brand_offer_ids: promotedIds,
      alloc_scope: alloc ? alloc.scope : null, alloc_category_node_id: alloc ? alloc.node_id : null,
      alloc_category: alloc ? alloc.category : null, alloc_product_ids: alloc && alloc.product_ids ? JSON.stringify(alloc.product_ids) : null,
      offer_valid_until: offerValidUntil, offer_valid_from: offerValidFrom,
      channels_json: channels_json ? JSON.stringify(channels_json) : null,
      formats_json: formats ? JSON.stringify(formats) : null,
      brand_note: terms.note, usage_rights_json: terms.usageRights ? JSON.stringify(terms.usageRights) : null,
    },
  };
}

/** The write. Runs on the caller's transaction. */
async function insertOne(plan, { campaign, set, tx }) {
  const v = plan.values;
  const { rows } = await tx.query(
    `INSERT INTO campaign_influencers
       (set_id, influencer_id, status, agreed_fee, posting_date, offer_expires_at,
        offer_type, offer_config_json, commission_pct, coupon_code,
        physical_delivery, delivery_address, influencer_budget, submission_deadline,
        brand_offer_id, allocation, promoted_brand_offer_ids,
        alloc_scope, alloc_category_node_id, alloc_category, alloc_product_ids,
        offer_valid_until, offer_valid_from, agreement_id, channels_json, formats_json,
        invited_at, invited_by, source, source_group_id, brand_note, usage_rights_json,
        min_shoppable_posts, pool_entry_id, sell_v2, sell_mode, sell_product_ids, shoppable_posts_n)
     VALUES ($1, $2, 'invited', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
             $17, $18, $19, $20::jsonb, $21, $22, $23, $24::jsonb, $25::jsonb,
             now(), $26, $27, $28, $29, $30::jsonb, $31, $32, $33, $34, $35::uuid[], $36)
     RETURNING *`,
    [
      set.id, plan.influencer_id, v.agreed_fee, v.posting_date, v.offer_expires_at,
      v.offer_type, v.offer_config_json, v.commission_pct, v.coupon_code,
      v.physical_delivery, v.delivery_address, v.influencer_budget, v.submission_deadline,
      v.brand_offer_id, v.allocation, v.promoted_brand_offer_ids,
      v.alloc_scope, v.alloc_category_node_id, v.alloc_category, v.alloc_product_ids,
      v.offer_valid_until, v.offer_valid_from, plan.agreement ? plan.agreement.id : null, v.channels_json, v.formats_json,
      plan.actorUserId, plan.source, plan.sourceGroupId, v.brand_note, v.usage_rights_json,
      v.min_shoppable_posts || null, v.pool_entry_id || null,
      !!v.sell_v2, v.sell_mode || null, v.sell_product_ids || [],
      v.shoppable_posts_n || null,
    ]
  );
  const ci = rows[0];
  // creator-terms-v2: offers are LINKED, never copied (rules 2.3).
  if (plan.sellPlan) await creatorTerms.linkOffers(ci.id, plan.sellPlan.offerIds, tx);
  if (plan.agreement) {
    await handshakeService.consumeAgreement({ agreementId: plan.agreement.id, campaignId: campaign.id, ciId: ci.id, tx });
  }
  // Item 6: the pool entry is used the moment she is invited from it (rules §7B, APPROVAL §3.2).
  if (plan.poolEntry) {
    const used = await poolService.markUsed({ entryId: plan.poolEntry.id, brandId: plan.poolEntry.brand_id, influencerId: plan.influencer_id, ciId: ci.id }, tx);
    if (!used) throw new AppError('VALIDATION_ERROR', MSG6.POOL_GONE(plan.name), 422, 'poolEntryId');
  }
  return ci;
}

/**
 * Briefed on terms she already agreed → the contract is created ready to sign and she is
 * recorded as accepted (she did accept, at the handshake). Runs AFTER the insert commits.
 */
async function readyToSignIfSettled(plan, ci) {
  if (!plan.agreement || plan.agreement_warnings.length) return false;
  try {
    const contractService = require('./contract.service');
    await contractService.autoCreate(ci.id, { ready: true });
    await db.query(`UPDATE campaign_influencers SET status = 'accepted', answered_at = now() WHERE id = $1`, [ci.id]);
    ci.status = 'accepted';
    return true;
  } catch (err) {
    console.error('[BRIEF] ready-to-sign contract failed, falling back to accept-first:', err.message);
    return false;
  }
}

async function brandNameOf(brandId) {
  const { rows } = await db.query(`SELECT business_name FROM brands WHERE id = $1`, [brandId]);
  return rows[0] ? rows[0].business_name : 'The brand';
}

async function notifyInvited(plan, ci, { brandName, set, readyToSign }) {
  const legacyBrief = !!plan.agreement;
  await notificationService.send({
    userId: plan.inf.user_id,
    type: NOTIFY.INVITED.type,
    title: readyToSign ? 'Your contract is ready to sign' : legacyBrief ? 'Your agreed collaboration is ready' : NOTIFY.INVITED.title,
    body: readyToSign
      ? 'The brand has set up the campaign you agreed to. Read it through and sign.'
      : legacyBrief
        ? 'The brand has set up the campaign you agreed to, with a change to what you agreed. Have a look.'
        : NOTIFY.INVITED.body(brandName, set.name),
    data: { screen: 'invitation', campaign_influencer_id: ci.id },
    fcmToken: plan.inf.fcm_token,
    sendSms: true,
    phone: plan.inf.phone,
  }).catch(err => console.error('[NOTIFICATION] invitation send failed:', err.message));
}

/* ───────────────────────────────────────────────────────── the doors */

/**
 * The legacy brief door: one creator, the legacy body, the legacy response shape.
 * Called by campaign.controller.invite.
 */
async function sendLegacy({ brand, campaign, set, body, actorUserId }) {
  const counts = (await campaignState.countsForSets([set.id])).get(set.id) || campaignState.EMPTY_COUNTS;
  assertSetOpen(set, counts);
  const plan = await prepareOne({ brand, campaign, set, body, mode: 'legacy', actorUserId });
  const ci = await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(`SELECT id FROM campaign_sets WHERE id = $1 FOR UPDATE`, [set.id]);
    if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign set not found', 404);
    return insertOne(plan, { campaign, set, tx });
  });
  const readyToSign = await readyToSignIfSettled(plan, ci);
  await notifyInvited(plan, ci, { brandName: await brandNameOf(brand.id), set, readyToSign });
  const campaign_derived = await campaignRollup.recompute(campaign.id);
  return { campaign_influencer: ci, agreement_warnings: plan.agreement_warnings, eligibility_warnings: plan.eligibility_warnings, campaign_derived, ready_to_sign: readyToSign };
}

/**
 * The item 5 send: all or nothing (APPROVAL.md Q2).
 *
 * `sourceGroupId` here is the batch-level fallback. A creator may name her own, which wins —
 * one send can mix a group, the pool and hand-picked creators (2026-09-17), and the source is
 * recorded per row because `campaign_influencers.source_group_id` was always a per-row column.
 * The controller has already checked every id against this brand.
 *
 * @param {Array<{influencerId, terms?, note?, offer?, sourceGroupId?}>} creators
 */
async function sendBatch({ brand, campaign, set, creators, sourceGroupId = null, actorUserId }) {
  if (!Array.isArray(creators) || creators.length === 0) throw new AppError('VALIDATION_ERROR', MSG.NOBODY_PICKED, 422, 'creators');
  if (creators.length > 100) throw new AppError('VALIDATION_ERROR', 'Send at most 100 invitations at a time.', 422, 'creators');
  const counts = (await campaignState.countsForSets([set.id])).get(set.id) || campaignState.EMPTY_COUNTS;
  assertSetOpen(set, counts);

  // Every creator prepared, every problem collected, nothing written.
  const plans = [];
  const failures = [];
  const seen = new Set();
  for (const c of creators) {
    const influencerId = c.influencerId || c.influencer_id;
    const body = { influencer_id: influencerId, ...(c.terms || {}), note: c.note !== undefined ? c.note : (c.terms || {}).note, offer: c.offer !== undefined ? c.offer : (c.terms || {}).offer, poolEntryId: c.poolEntryId || c.pool_entry_id || undefined };
    try {
      if (seen.has(influencerId)) throw new AppError('CONFLICT', 'That creator is listed twice.', 409, 'influencer_id');
      seen.add(influencerId);
      const mine = c.sourceGroupId || c.source_group_id || sourceGroupId || null;
      plans.push(await prepareOne({ brand, campaign, set, body, mode: 'strict', source: mine ? 'group' : 'brand_picker', sourceGroupId: mine, actorUserId }));
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      // D2: `detail` and `label` are set only when she failed one of her own invitation rules
      // (see collabEligibility); every other refusal — a duplicate, bad terms — leaves them null.
      failures.push({
        influencerId, name: (e.details && e.details.name) || null, code: e.code, field: e.field || null, message: e.message,
        detail: (e.details && e.details.detail) || null, label: (e.details && e.details.label) || null,
      });
    }
  }
  if (failures.length) {
    const f = failures[0];
    throw new AppError('VALIDATION_ERROR', f.message, 422, f.field, { failures, sent: 0 });
  }

  // One transaction: lock the set, re-check the set-level rules, write every row.
  const rows = await db.withTransaction(async (tx) => {
    const { rows: locked } = await tx.query(`SELECT * FROM campaign_sets WHERE id = $1 FOR UPDATE`, [set.id]);
    if (!locked[0]) throw new AppError('NOT_FOUND', 'Campaign set not found', 404);
    const cnt = (await campaignState.countsForSets([set.id], tx)).get(set.id) || campaignState.EMPTY_COUNTS;
    assertSetOpen(locked[0], cnt);
    const out = [];
    for (const plan of plans) out.push(await insertOne(plan, { campaign, set: locked[0], tx }));
    return out;
  });

  // After commit: contracts for settled briefs (none on this door), notifications, the rollup once.
  const brandName = await brandNameOf(brand.id);
  for (let i = 0; i < plans.length; i += 1) await notifyInvited(plans[i], rows[i], { brandName, set, readyToSign: false });
  await campaignRollup.recompute(campaign.id);
  return {
    sent: rows.length,
    rows: rows.map((ci, i) => ({ id: ci.id, influencerId: ci.influencer_id, name: plans[i].name, status: ci.status, invitedAt: ci.invited_at, warnings: plans[i].eligibility_warnings })),
  };
}

/* ─────────────────────────────────────────────────────── the two exits */

async function rowForBrand(ciId, setId) {
  const { rows } = await db.query(
    `SELECT ci.*, COALESCE(i.full_name, u.name) AS creator_name, u.id AS creator_user_id, u.fcm_token,
            (SELECT count(*)::int FROM contracts con WHERE con.campaign_influencer_id = ci.id AND ${SIGNED_CONTRACT_SQL}) AS signed_both
       FROM campaign_influencers ci
       JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
      WHERE ci.id = $1 AND ci.set_id = $2`,
    [ciId, setId]
  );
  return rows[0] || null;
}

/** Withdraw: only while she has not answered (status invited). No reason is ever stored or sent. */
async function withdraw({ brand, campaign, set, ciId, actorUserId }) {
  const row = await rowForBrand(ciId, set.id);
  if (!row) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  if (row.status !== 'invited') throw new AppError('VALIDATION_ERROR', MSG.WITHDRAW_ANSWERED(row.creator_name), 422, 'status');
  const { rows } = await db.query(
    `UPDATE campaign_influencers SET status = 'withdrawn', withdrawn_at = now(), withdrawn_by = $2 WHERE id = $1 AND status = 'invited' RETURNING *`,
    [row.id, actorUserId || null]
  );
  if (!rows[0]) throw new AppError('VALIDATION_ERROR', MSG.WITHDRAW_ANSWERED(row.creator_name), 422, 'status');
  const brandName = await brandNameOf(brand.id);
  await notificationService.send({
    userId: row.creator_user_id, type: NOTIFY.WITHDRAWN.type, title: NOTIFY.WITHDRAWN.title, body: NOTIFY.WITHDRAWN.body(brandName),
    data: { screen: 'invitation', campaign_influencer_id: row.id }, fcmToken: row.fcm_token, sendSms: false,
  }).catch(err => console.error('[NOTIFICATION] invitation.withdrawn failed:', err.message));
  await campaignRollup.recompute(campaign.id);
  return rows[0];
}

/** Remove: any status before both signatures. Deletes an unsigned contract; never a signed one; never money. */
async function remove({ brand, campaign, set, ciId, actorUserId }) {
  const row = await rowForBrand(ciId, set.id);
  if (!row) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  if (row.signed_both > 0) throw new AppError('VALIDATION_ERROR', MSG.REMOVE_SIGNED(row.creator_name), 422, 'status');
  // Every pre-signed status may be removed, deferred and applied included (founder Q10).
  if (DEAD_STATUSES.includes(row.status)) throw new AppError('VALIDATION_ERROR', `${row.creator_name} is already out of this set.`, 422, 'status');
  const { rows: locked } = await db.query(`SELECT 1 FROM escrow_entries WHERE campaign_influencer_id = $1 AND status = 'locked' LIMIT 1`, [row.id]);
  if (locked[0]) throw new AppError('VALIDATION_ERROR', MSG.REMOVE_SIGNED(row.creator_name), 422, 'status');
  const updated = await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE campaign_influencers SET status = 'removed', removed_at = now(), removed_by = $2 WHERE id = $1 RETURNING *`,
      [row.id, actorUserId || null]
    );
    // Item 7 (approval Q8): marked, never deleted. Removing her from the set
    // withdraws an agreement she never signed; the row keeps its ending.
    await tx.query(
      `UPDATE contracts SET status = 'withdrawn', withdrawn_at = now(), withdrawn_by = $2
         WHERE campaign_influencer_id = $1 AND influencer_signed_at IS NULL AND brand_signed_at IS NULL`,
      [row.id, actorUserId || null]
    );
    return rows[0];
  });
  const brandName = await brandNameOf(brand.id);
  await notificationService.send({
    userId: row.creator_user_id, type: NOTIFY.REMOVED.type, title: NOTIFY.REMOVED.title, body: NOTIFY.REMOVED.body(brandName),
    data: { screen: 'invitation', campaign_influencer_id: row.id }, fcmToken: row.fcm_token, sendSms: false,
  }).catch(err => console.error('[NOTIFICATION] invitation.removed failed:', err.message));
  await campaignRollup.recompute(campaign.id);
  return updated;
}

module.exports = { LIVE_STATUSES, assertSetOpen, prepareOne, insertOne, sendLegacy, sendBatch, withdraw, remove };
