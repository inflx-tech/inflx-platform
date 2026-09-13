'use strict';

/**
 * collabStep.service.js — one step number, one needs-you count, for both apps.
 * Contract: features/collab-phase0-foundations  (Phase 0)
 *
 * WHY THIS EXISTS
 * A collaboration runs through six steps:
 *   1 agree · 2 sign · 3 shoot · 4 shop posts · 5 go live · 6 complete
 *
 * Both apps show that number, and the brand's screen and the creator's screen must
 * never disagree about the same collaboration — a brand ringing a creator to say
 * "we're stuck on step 3" has to be talking about the same step 3. So the number is
 * calculated here, once, and read by both. Nothing derives it client-side.
 *
 * The same argument applies to "how much needs you". A badge computed twice is a
 * badge that eventually disagrees with itself, and a badge that doesn't reconcile is
 * one people stop trusting.
 *
 * THIS MODULE IS PURE. It takes plain objects and returns plain objects — no database
 * access — so it can be exercised directly on constructed inputs. The callers that
 * fetch rows live in the controllers.
 */

const STEP = {
  AGREE: 1, SIGN: 2, SHOOT: 3, SHOP_POSTS: 4, GO_LIVE: 5, COMPLETE: 6,
};

const STEP_LABEL = {
  1: 'Agree terms',
  2: 'Sign',
  3: 'The shoot',
  4: 'Shop posts',
  5: 'Go live',
  6: 'Complete',
};

// Whose move it is. 'nobody' is a real answer — an expired request is nobody's turn.
const TURN = { YOU_BRAND: 'brand', YOU_CREATOR: 'creator', NOBODY: 'nobody' };

const DEAD_REQUEST = ['declined', 'withdrawn', 'expired', 'rejected'];

/**
 * Step 1, brand → creator. Reads a brand_collab_requests row.
 */
function stepForRequest(r) {
  if (!r) return null;
  const s = String(r.status || '').toLowerCase();

  if (DEAD_REQUEST.includes(s)) {
    return { step: STEP.AGREE, turn: TURN.NOBODY, state: s, closed: true };
  }
  if (s === 'agreed') {
    // Terms settled. The ball is with the brand to brief it into a campaign.
    return { step: STEP.AGREE, turn: TURN.YOU_BRAND, state: 'agreed', closed: false };
  }
  if (s === 'countered') {
    // Whoever did NOT counter owes the answer.
    return {
      step: STEP.AGREE,
      turn: r.counter_by === 'creator' ? TURN.YOU_BRAND : TURN.YOU_CREATOR,
      state: 'countered',
      closed: false,
    };
  }
  // sent | viewed — the brand asked, she owes an answer.
  return { step: STEP.AGREE, turn: TURN.YOU_CREATOR, state: s || 'sent', closed: false };
}

/**
 * Step 1, creator → brand. Reads an influencer_proposals row.
 *
 * Deliberately separate from stepForRequest rather than merged behind a flag: the two
 * records have different status vocabularies, and one function pretending otherwise is
 * how the directions drift.
 */
function stepForProposal(p) {
  if (!p) return null;
  const s = String(p.status || '').toLowerCase();

  if (DEAD_REQUEST.includes(s)) {
    return { step: STEP.AGREE, turn: TURN.NOBODY, state: s, closed: true };
  }
  if (s === 'accepted') {
    return { step: STEP.AGREE, turn: TURN.YOU_BRAND, state: 'agreed', closed: false };
  }
  if (s === 'countered') {
    return {
      step: STEP.AGREE,
      turn: p.counter_by === 'creator' ? TURN.YOU_BRAND : TURN.YOU_CREATOR,
      state: 'countered',
      closed: false,
    };
  }
  // sent | viewed — she pitched, the brand owes an answer.
  return { step: STEP.AGREE, turn: TURN.YOU_BRAND, state: s || 'sent', closed: false };
}

/**
 * Steps 2–6, once a campaign assignment exists.
 *
 * @param {object} ci                       campaign_influencers row
 * @param {object} [x]                      what the caller already knows; all optional
 * @param {string} [x.track]                'sales' | 'content' | 'both' — from the set's aim
 * @param {boolean}[x.contractSignedByBoth]
 * @param {boolean}[x.shootDone]
 * @param {number} [x.shopPostsLive]
 * @param {number} [x.shopPostsNeedingFix]
 * @param {number} [x.shopPostsInReview]
 * @param {string} [x.socialState]          'none'|'submitted'|'changes_asked'|'approved'|'posted'|'confirmed'
 * @param {boolean}[x.complete]
 */
function stepForCollaboration(ci, x = {}) {
  if (!ci) return null;
  const s = String(ci.status || '').toLowerCase();
  const isContent = x.track === 'content';

  if (['declined', 'expired', 'cancelled', 'walked_away', 'withdrawn', 'removed'].includes(s)) {
    return { step: STEP.SIGN, turn: TURN.NOBODY, state: s, closed: true };
  }

  // 6 — done.
  if (x.complete || s === 'completed') {
    return { step: STEP.COMPLETE, turn: TURN.NOBODY, state: 'complete', closed: true };
  }

  // 2 — invited or signing.
  if (s === 'invited') {
    return { step: STEP.SIGN, turn: TURN.YOU_CREATOR, state: 'invited', closed: false };
  }
  if (!x.contractSignedByBoth && ['accepted', 'pending_brand', 'pending_influencer', 'negotiating'].includes(s)) {
    return {
      step: STEP.SIGN,
      turn: s === 'pending_brand' ? TURN.YOU_BRAND : TURN.YOU_CREATOR,
      state: s,
      closed: false,
    };
  }

  // 3 — the shoot, until it is marked done.
  if (!x.shootDone) {
    return { step: STEP.SHOOT, turn: x.shootTurn || TURN.NOBODY, state: 'shoot', closed: false };
  }

  // 5 — content track skips shop posts entirely: nothing is being sold, so the shop
  // has nothing to show. Its step 4 is deliverables with the brand, handled below.
  if (isContent) {
    return socialStep(x, /* contentTrack */ true);
  }

  // 4 — shop posts, while any need her or none is live yet.
  if (Number(x.shopPostsNeedingFix || 0) > 0) {
    return { step: STEP.SHOP_POSTS, turn: TURN.YOU_CREATOR, state: 'needs_fix', closed: false };
  }
  if (Number(x.shopPostsLive || 0) === 0) {
    const inReview = Number(x.shopPostsInReview || 0) > 0;
    return {
      step: STEP.SHOP_POSTS,
      // Waiting on the review desk is nobody's turn as far as these two are concerned.
      turn: inReview ? TURN.NOBODY : TURN.YOU_CREATOR,
      state: inReview ? 'in_review' : 'none_yet',
      closed: false,
    };
  }

  // 5 — go live. Reached once at least one shop post is live, which is also the
  // condition the publishing gate uses in Phase 7.
  return socialStep(x, false);
}

function socialStep(x, contentTrack) {
  const st = x.socialState || 'none';
  const step = contentTrack ? STEP.SHOP_POSTS : STEP.GO_LIVE;   // content's 4th step IS its deliverables
  switch (st) {
    case 'submitted':     return { step, turn: TURN.YOU_BRAND,    state: 'awaiting_brand_review', closed: false };
    case 'changes_asked': return { step, turn: TURN.YOU_CREATOR,  state: 'changes_asked',         closed: false };
    case 'approved':      return { step: contentTrack ? STEP.GO_LIVE : STEP.GO_LIVE,
                                   turn: TURN.YOU_CREATOR,        state: 'ready_to_post',         closed: false };
    case 'posted':        return { step: STEP.GO_LIVE, turn: TURN.YOU_BRAND,   state: 'awaiting_confirm', closed: false };
    case 'confirmed':     return { step: STEP.COMPLETE, turn: TURN.NOBODY,     state: 'confirmed',        closed: false };
    default:              return { step, turn: TURN.YOU_CREATOR,  state: 'not_submitted',         closed: false };
  }
}

/**
 * Roll a needs-you count up a tree.
 *
 * The rule, and the only rule: **a node's count is everything beneath it plus anything
 * owed at that node itself.** If a campaign shows 4 and its two sets show 3 and 0, the
 * missing 1 is the campaign's own and must be listed at that level, not buried. Numbers
 * that don't reconcile are how people stop believing badges.
 *
 * @param {object} node        { own?: number, children?: node[] }
 * @returns {number}
 */
function rollUp(node) {
  if (!node) return 0;
  const own = Number(node.own || 0);
  const kids = Array.isArray(node.children) ? node.children : [];
  return kids.reduce((sum, k) => sum + rollUp(k), own);
}

/**
 * Does this step owe something to the side asking?
 * Used to turn a derived step into a count of one or zero.
 */
function owes(derived, side) {
  if (!derived || derived.closed) return 0;
  return derived.turn === side ? 1 : 0;
}

module.exports = {
  STEP, STEP_LABEL, TURN,
  stepForRequest,
  stepForProposal,
  stepForCollaboration,
  rollUp,
  owes,
};
