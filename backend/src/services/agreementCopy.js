'use strict';

/**
 * Item 7 — every sentence the agreement can say, in one place.
 * Rules v1.20 §9, mockups P1–P16, gap-check prompt §7.
 * Contract: features/item7-agreement
 *
 * The server and the app must say the SAME words, so the app imports the
 * matching strings from components/agreement/copy7.js and the two are kept
 * identical by test.
 */

const { longDate: longDay } = require('./campaignCopy');
const { istDayOf } = require('../utils/indiaDay');

/** '17 Oct 2026'. Same input tolerance as shortDate. */
const longDate = (v) => longDay(asDay(v));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * '2026-10-17' → '17 Oct'. Lists and sentences use the short form; the
 * document itself uses longDate ('17 Oct 2026'), per the mockups' §8.
 * Accepts a calendar day or an instant.
 */
/**
 * Accepts a calendar day ('2026-10-17'), an ISO instant, or a pg Date object.
 * An instant is read in India, because that is the day the two of them mean.
 */
function asDay(v) {
  if (!v) return '';
  if (v instanceof Date) return istDayOf(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return istDayOf(new Date(s));
  return s;
}

function shortDate(day) {
  const s = asDay(day);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

/** §7 — the exact refusals. */
const MSG = {
  NOT_ACCEPTED:      (name) => `${name} hasn't accepted the terms yet.`,
  ALREADY_OUT:       (name) => `An agreement is already out with ${name}.`,
  CLOSED:            (date) => `Signatures for this set closed on ${date}.`,
  CANT_EDIT:         "An agreement can't be changed once it's sent.",
  NAME_EMPTY:        'Type your full name to sign.',
  TICKS:             'Tick both boxes to sign.',
  HER_FIRST:         (name) => `${name} hasn't signed yet.`,
  ALREADY_SIGNED:    'This is already signed.',
  SHORT:             (amount) => `Add ${amount} to your wallet to sign this agreement.`,
  WITHDRAW_TOO_LATE: (name) => `${name} has already signed, so this can't be withdrawn.`,
  DECLINE_REASON:    'Choose a reason.',
  DECLINE_NOTE:      'Keep it under 200 characters.',
  NOT_COMPLETE:      "The agreement can be downloaded once you've both signed.",
  NO_AGREEMENT:      'There is no agreement here yet.',
  NOT_YOURS:         'This agreement is not yours.',
};

/** The six reasons she may give at signing — item 5's five, plus the agreement itself. */
const DECLINE_REASONS = Object.freeze([
  'agreement_terms', 'fee_too_low', 'schedule_conflict', 'too_much_work', 'not_relevant', 'other',
]);
const DECLINE_LABEL = Object.freeze({
  agreement_terms:   'The agreement terms',
  fee_too_low:       'Fee too low',
  schedule_conflict: "Dates don't suit",
  too_much_work:     'Too much work',
  not_relevant:      'Not relevant',
  other:             'Other',
});

/** P15 — the four endings, each a sentence with a date. */
const ENDING = {
  declined: (name, date, reasonLabel) =>
    `${name} declined the agreement on ${shortDate(date)}: ${String(reasonLabel || '').toLowerCase()}.`,
  withdrawn: (name, date) =>
    `You withdrew this agreement on ${shortDate(date)}. ${name} is waiting for a new one.`,
  expired: (cutoff) =>
    `Signatures for this set closed on ${shortDate(cutoff)}. The agreement expired unsigned and no money was taken.`,
  halfSigned: (name, signedAt, cutoff) =>
    `${name} signed on ${shortDate(signedAt)} but the set closed on ${shortDate(cutoff)} before you did. Nothing was locked, and she was told.`,
  agreed: (date) => `Signed by both on ${shortDate(date)}. This collaboration is live.`,
};

/** What she is told, in her own words (P7, P12, P16). */
const CREATOR = {
  waitingForBrand: (brand, cutoff) => `Signed. Waiting for ${brand} to sign by ${shortDate(cutoff)}.`,
  nothingBinding: (cutoff) =>
    `Nothing is binding until both signatures are on it. If they don't sign by ${shortDate(cutoff)}, this closes and neither of you owes anything.`,
  readyToSign: (cutoff) => `Agreement ready to sign · by ${shortDate(cutoff)}`,
  inWallet: (amount, date) => `${amount} is in your wallet. Signed ${shortDate(date)}.`,
  expiredHalfSigned: (brand, cutoff) =>
    `You signed, but ${brand} didn't before the set closed on ${shortDate(cutoff)}. Nothing was locked and nothing is owed either way.`,
  expiredUnsigned: (cutoff) =>
    `Signatures for this set closed on ${shortDate(cutoff)}. The agreement expired unsigned and no money was taken.`,
};

/** What the brand is told (P1, P9, P10, P12). */
const BRAND = {
  bothNeededBy: (date, days) => `Both signatures needed by ${shortDate(date)} · ${days} ${days === 1 ? 'day' : 'days'}`,
  sheSignedYouComplete: (name, date) => `${name} signed on ${shortDate(date)}. Your signature completes it.`,
  enough: (amount) => `Your wallet has ${amount} available. Enough.`,
  short: (available, needed) => `Your wallet has ${available} available and this needs ${needed}.`,
  addToSign: (shortfall) => `Add ${shortfall} to sign`,
  locksHint: (amount) => `Signing locks ${amount} of your balance for this collaboration. It can't be spent on anything else.`,
  signAndLock: (amount) => `Sign and lock ${amount}`,
  waitingIfNobody: (name, signedAt, cutoff) =>
    `${name} signed on ${shortDate(signedAt)} and is waiting. If nobody signs by ${shortDate(cutoff)}, this closes on its own.`,
  agreementSent: (date) => `Agreement sent ${shortDate(date)}`,
  signedByBoth: (date) => `Signed by both ${shortDate(date)}`,
  // ui-walk-fixes (board F, frame F4) — the brand's agreement once it is out and she has not
  // signed. The same two sentences are in the app's components/agreement/copy7.js (C7.brand),
  // word for word. `sentDay` and `byDay` arrive already written as days ("13 Oct").
  waitingForHer: (first, sentDay, byDay) => `Sent to ${first} on ${sentDay}. Waiting for her to sign by ${byDay}.`,
  youSignAfter: 'You sign after her. Nothing is binding until both signatures are on it.',
};

/**
 * Notification keys. There was no `agreement.*` namespace before item 7 — only
 * five `contract.*` keys, none of which covered sent, expiring or expired.
 */
const NOTIFY = {
  SENT:        { type: 'agreement.sent',        title: 'An agreement is ready to sign' },
  SIGNED:      { type: 'agreement.signed',      title: 'They signed the agreement' },
  COMPLETE:    { type: 'agreement.complete',    title: 'Signed by both' },
  WITHDRAWN:   { type: 'agreement.withdrawn',   title: 'The agreement was withdrawn' },
  DECLINED:    { type: 'agreement.declined',    title: 'The agreement was declined' },
  EXPIRING:    { type: 'agreement.expiring',    title: 'An agreement is about to close' },
  EXPIRED:     { type: 'agreement.expired',     title: 'The agreement closed unsigned' },
};

module.exports = { MSG, DECLINE_REASONS, DECLINE_LABEL, ENDING, CREATOR, BRAND, NOTIFY, shortDate, longDate };
