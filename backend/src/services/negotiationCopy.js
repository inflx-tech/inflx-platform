'use strict';

/**
 * Item 6 — every message the negotiation and pool rules produce, word for word (gap prompt §7,
 * mockups N1–N22). The phone mirrors this in Packages/Mobile/src/components/negotiation/copy6.js.
 * Contract: features/item6-negotiation
 */
const { longDate } = require('./campaignCopy');

const MSG = {
  NOTHING_CHANGED: 'Change something before you send this.',
  NO_ROUNDS_LEFT: 'There are no counters left. You can accept or decline.',
  CLOSED: (cutoffDay) => `This invitation closed on ${longDate(cutoffDay)}.`,
  SWITCH_OFF: (brand) => `${brand} aren't taking counters on this campaign.`,
  NOT_YOUR_MOVE: (name) => `You've already sent your counter. ${name} has to reply first.`,
  AGREED: 'The terms are agreed. Nothing can be countered now.',
  NO_THREAD: 'There is no counter to answer yet.',
  MOVE_NOTHING: "Choose what doesn't suit.",
  MOVE_SAME_DATE: "That's the date they already asked for.",
  MOVE_TWICE: "You've already asked them to move this.",
  MOVE_NOT_PENDING: 'There is no request to answer.',
  BRAND_REASON_LONG: 'Keep it under 200 characters.',
  NOTE_LONG: 'Keep it under 300 characters.',
  ANSWERED_TWICE: "You've already answered this.",
  POOL_MIXED_AIMS: 'Pick creators who agreed the same Aim.',
  POOL_GONE: (name) => `${name} is no longer in your pool.`,
  RANGE: (min, max) => `Enter a number between ${min} and ${max}.`,
};

/** N21 — the four endings, and the fifth. */
const ENDING = {
  agreed: (line, d) => `Agreed at ${line} on ${d}. Send the agreement next.`,
  declined_by_creator: (first, d, reason, cutoff) => `${first} declined on ${d}${reason ? `: ${reason.toLowerCase()}` : ''}. You can invite her again with new terms until ${longDate(cutoff)}.`,
  declined_by_brand: (d, first, note) => `You declined on ${d}.${note ? ` ${first} was told: "${note}"` : ''}`,
  expired: (cutoff) => `Invitations for this set closed on ${longDate(cutoff)}, so this negotiation ended unfinished.`,
  moved: (first, d) => `${first} moved to your pool on ${d}.`,
};

const NOTIFY = {
  TURN: { type: 'negotiation.turn', title: 'Counter received' },
  AGREED: { type: 'negotiation.agreed', title: 'Terms agreed' },
  DECLINED: { type: 'negotiation.declined', title: 'Counter declined' },
  EXPIRED: { type: 'negotiation.expired', title: 'Negotiation ended' },
  REMINDER: { type: 'negotiation.reminder', title: 'A counter is waiting for you' },
  MOVE_REQUESTED: { type: 'move.requested', title: 'A creator asked for a different date' },
  MOVE_KEPT: { type: 'move.kept', title: 'The date is kept' },
  MOVE_DECLINED: { type: 'move.declined', title: 'The brand said no' },
  POOL_ENTERED: { type: 'pool.entered', title: 'They agreed to your date' },
  POOL_CLOSING: { type: 'pool.closing', title: 'A pool entry is closing soon' },
  POOL_CLOSED: { type: 'pool.closed', title: 'A pool entry closed' },
  POOL_REMOVED: { type: 'pool.removed', title: 'Removed from the pool' },
};

module.exports = { MSG, ENDING, NOTIFY };
