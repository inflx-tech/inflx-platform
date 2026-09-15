'use strict';

/**
 * Item 8 — every sentence a pitch can say, in one place.
 * Rules v1.21 §8, mockups T1–T14, gap-check prompt §7.
 * Contract: features/item8-pitch
 *
 * The server and the app say the SAME words; the app mirrors these in
 * Packages/Mobile/src/components/pitch/copy8.js.
 */

const { longDate, shortDate } = require('./agreementCopy');

/** §7 — the exact refusals. */
const MSG = {
  AIM_NOT_TAKEN:   (brand) => `${brand} aren't taking that kind of pitch.`,
  NOT_ACCEPTING:   (brand) => `${brand} aren't taking pitches right now.`,
  NOT_MATCHING:    (brand) => `You don't meet what ${brand} are looking for.`,
  BLOCKED:         (brand) => `You can't pitch ${brand}.`,
  IN_COOLDOWN:     (brand, date) => `You can pitch ${brand} again after ${shortDate(date)}.`,
  SAME_AIM_OPEN:   (aim, brand) => `You already have an open ${aim} pitch with ${brand}.`,
  TOO_MANY_OPEN:   (n, brand) => `You have ${n} open pitches with ${brand}, which is the most allowed.`,
  DATE_TOO_SOON:   'Choose a date at least seven days from today.',
  MESSAGE_REQUIRED: "Tell them why you'd be a good fit.",
  MESSAGE_LONG:    'Keep it under 500 characters.',
  MODE_REQUIRED:   'Choose how you would work.',
  MODE_NOT_TAKEN:  (brand) => `${brand} aren't taking that way of working.`,
  CLOSED:          (date) => `This pitch closed on ${shortDate(date)}.`,
  ANSWERED_TWICE:  "You've already answered this pitch.",
  ALREADY_SIGNED:  'This has already been signed.',
  REJECT_REASON_LONG: 'Keep it under 200 characters.',
  NOT_YOURS:       'Not found',
  NO_PITCH:        'There is no pitch here.',
};

/** The three Aims, in her words. */
const AIM_LABEL = { conversion: 'Pay for Sale', engagement: 'Pay for Content', hybrid: 'Hybrid' };
const AIMS = ['conversion', 'engagement', 'hybrid'];
const MODE_LABEL = { visit: 'Store Visit', shipment: 'Remote', remote: 'Remote' };

/** T14 — the endings, each a plain sentence that says whether she can try again. */
const ENDING = {
  noReply: (brand, date) =>
    `${brand} didn't reply by ${shortDate(date)}, so this closed. You can pitch them again whenever you like.`,
  withdrawn: (date) =>
    `You withdrew this pitch on ${shortDate(date)}. No cooldown — pitch them again when you're ready.`,
  datePassed: (wanted, closed) =>
    `You offered to post on ${shortDate(wanted)}, which is now too close for a set to be built. This pitch closed on ${shortDate(closed)}.`,
  rejected: (reason) => (reason ? `"${reason}"` : null),
  limitReached: (n, brand) =>
    `You have ${n} open pitches with ${brand}, which is the most allowed. Withdraw one, or wait for a reply.`,
};

/** What she is told (T4, T13). */
const CREATOR = {
  theyHaveDays: (brand, days) =>
    `${brand} have ${days} days to reply. If they agree, they'll invite you to a set with these terms and you'll sign an agreement then. Nothing is committed until you both sign.`,
  limitLine: (nth, max) => `Your ${ordinal(nth)} open pitch to this brand · ${max} allowed`,
  waitingUntil: (date, days) => `They have until ${shortDate(date)} · ${days} ${days === 1 ? 'day' : 'days'} left`,
  agreedBody: (date) => `They'll send an invitation when they build a set for ${shortDate(date)}.`,
  cooldownLine: (brand, date) => `You can pitch ${brand} again after ${shortDate(date)}.`,
  dateHint: "They'll build a set around this. It can move when you talk.",
  // T12 — the green line on the invitation her pitch became.
  fromPitch: (amount, agreedOn, setDate) =>
    `The ${amount} you agreed on ${shortDate(agreedOn)}, in a set for ${shortDate(setDate)}.`,
  // Item 8, approval §2.1 — her own screen only. The brand still sees the three coarse codes.
  beingMeasured: 'Your numbers are still being measured.',
};

/** What the brand is told (T5–T8, T11). */
const BRAND = {
  replyBy: (date, days) => `Reply by ${shortDate(date)} · ${days} ${days === 1 ? 'day' : 'days'} left`,
  agedDays: (n) => (n === 0 ? 'today' : n === 1 ? '1 day ago' : `${n} days ago`),
  acceptTitle: (first) => `Accept ${first}'s terms?`,
  acceptAgreed: 'Agreed',
  acceptGoesTo: (date) => `Your pool · ${shortDate(date)}`,
  acceptNotYet: 'Not yet',
  acceptBody: (date) =>
    `She'll be waiting under "Agreed, needs a set" on your Campaigns tab. Build a set for ${shortDate(date)} when you're ready and she'll get an invitation with these terms filled in. She signs the agreement then.`,
  rejectCooldown: (first, date) =>
    `${first} won't be able to pitch you again until ${shortDate(date)}. You can still invite her from Creators at any time.`,
  rejectBlockHint: "If you'd rather never hear from her, block her in Pitch settings instead.",
  // T11 — the provenance tag and its line.
  cameToYou: (first, date) => `${first} came to you on ${shortDate(date)}`,
  notAvailable: 'Not available',
};

/**
 * Notification keys. The five `proposal.*` keys are retired with item 8: all
 * four of their deep-link screens were deleted on 2 September, so every one of
 * them opened nothing (approval Q9).
 */
const NOTIFY = {
  SENT:      { type: 'pitch.sent',      title: 'A creator pitched you' },
  COUNTERED: { type: 'pitch.countered', title: 'A counter on your pitch' },
  AGREED:    { type: 'pitch.agreed',    title: 'Your pitch was accepted' },
  REJECTED:  { type: 'pitch.rejected',  title: 'Your pitch was declined' },
  WITHDRAWN: { type: 'pitch.withdrawn', title: 'A pitch was withdrawn' },
  REMINDER:  { type: 'pitch.reminder',  title: 'A pitch is waiting for your answer' },
  EXPIRED:   { type: 'pitch.expired',   title: 'A pitch closed with no reply' },
  CLOSED:    { type: 'pitch.closed',    title: 'A pitch closed' },
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

module.exports = { MSG, AIMS, AIM_LABEL, MODE_LABEL, ENDING, CREATOR, BRAND, NOTIFY, ordinal, shortDate, longDate };
