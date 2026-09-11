'use strict';

/**
 * collabState.js — one place that says which of the seven state families a collaboration
 * is in, and how "signed" and "completed" are counted.
 * Contract: features/item3-discovery-profiles-groups (P1, P2) · rules v1.11 §27
 *
 * Item 1 owns the lifecycle. Until its follow-up lands, item 3 needs two things from it:
 *   familyOf(status)  — the chip family for a campaign_influencers.status (12 values)
 *   the P1 count      — "{N} collaborations SIGNED on INFLX" (founder Q5: not "completed"
 *                       yet, because completion is only written for money collaborations)
 *
 * When the completion rule is built, switch P1_COUNT_MODE to 'completed' — the screens
 * read P1_COUNT_LABEL, so that is the one-line change the founder asked for.
 */

const FAMILY = Object.freeze({
  YOUR_MOVE: 'yourMove', WAITING: 'waiting', ACTIVE: 'active', COMPLETED: 'completed',
  DECLINED: 'declined', DISPUTED: 'disputed', ENDED: 'ended',
});

/** campaign_influencers.status → family. Unknown statuses read as waiting, never crash a screen. */
function familyOf(status) {
  switch (String(status || '').toLowerCase()) {
    case 'invited':
    case 'applied':            return FAMILY.YOUR_MOVE;   // somebody must answer
    case 'negotiating':
    case 'deferred':
    case 'accepted':           return FAMILY.WAITING;     // agreed in principle, not yet signed
    case 'contracted':
    case 'active':             return FAMILY.ACTIVE;
    case 'completed':          return FAMILY.COMPLETED;
    case 'declined':
    case 'rejected_by_brand':
    case 'slots_filled':       return FAMILY.DECLINED;
    case 'expired':            return FAMILY.ENDED;
    default:                   return FAMILY.WAITING;
  }
}

/** Screen label per family (chip text). */
const FAMILY_LABEL = Object.freeze({
  yourMove: 'Your move', waiting: 'Waiting', active: 'Active', completed: 'Completed',
  declined: 'Declined', disputed: 'Disputed', ended: 'Ended',
});

/** 'signed' today; 'completed' once item 1's completion rule exists. */
const P1_COUNT_MODE = 'signed';
const P1_COUNT_LABEL = P1_COUNT_MODE === 'signed'
  ? (n) => `${n} ${n === 1 ? 'collaboration' : 'collaborations'} signed on INFLX`
  : (n) => `${n} ${n === 1 ? 'collaboration' : 'collaborations'} completed on INFLX`;

/**
 * SQL fragment: a collaboration counts as SIGNED when its contract carries both signatures.
 * Handshake agreements (collab_agreements) never count — agreed is not signed.
 */
const SIGNED_CONTRACT_SQL = `con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL`;

module.exports = { FAMILY, FAMILY_LABEL, familyOf, P1_COUNT_MODE, P1_COUNT_LABEL, SIGNED_CONTRACT_SQL };
