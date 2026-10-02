'use strict';

/**
 * Item 5 — every message the invitation rules produce, word for word (prompt §7), plus the
 * labels both apps print. The phone mirrors this in
 * Packages/Mobile/src/components/invitations/copy5.js.
 * Contract: features/item5-invitations · rules v1.16 §7A
 */
const { longDate } = require('./campaignCopy');

const first = (name) => String(name || 'She').trim().split(/\s+/)[0] || 'She';

const MSG = {
  COMMISSION_REQUIRED: 'Enter a commission percentage.',
  COMMISSION_RANGE: 'Commission must be between 0 and 100.',
  FEE_REQUIRED: 'Enter a fee.',
  HYBRID_FEE: "A Hybrid set needs a fixed fee. It can't be ₹0.",
  DELIVERABLES_EMPTY: 'Add at least one thing she delivers.',
  DELIVERABLE_COUNT: 'Choose between 1 and 20.',
  DELIVERABLE_DUP: "You've already added that. Change the count instead.",
  SCOPE_CATEGORIES: 'Pick at least one category.',
  SCOPE_PRODUCTS: 'Pick at least one product.',
  USAGE_PLACE: 'Choose where the brand can use the content.',
  NOTE_LONG: 'Keep it under 300 characters.',
  OFFER_AMOUNT: 'Enter the discount.',
  OFFER_SCOPE: 'Pick what this offer applies to.',
  OFFER_DATES: 'The end date must be after the start date.',
  BELOW_MIN: (name, value) => `Below ${first(name)}'s minimum of ${value}. You can still invite her, and she can counter.`,
  NOBODY_PICKED: 'Pick at least one creator.',
  INVITE_CLOSED: (cutoffDay) => `Invitations for this set closed on ${longDate(cutoffDay)}.`,
  SET_EXPIRED: 'This set has expired. Create a new set with a new posting date.',
  DATE_PASSED: 'Pick a new posting date before you invite anyone.',
  NO_DATE: 'Choose a posting date before you invite anyone.',
  INELIGIBLE: (name) => `${name} can no longer be invited to this set.`,
  DUPLICATE: (name) => `${name} is already in this set.`,
  SENT_LOCKED: "Terms can't be changed once the invitation is sent. Withdraw it and invite again.",
  // Item 8, Phase 2a — the brief path is closed. A creator who agreed terms
  // through a pitch now waits in the brand's pool and is invited from there.
  BRIEF_CLOSED: 'Agreements are no longer briefed straight into a set. A creator who agreed terms waits in your pool — build a set for her from there.',
  WITHDRAW_ANSWERED: (name) => `${name} has already answered, so this can't be withdrawn.`,
  REMOVE_SIGNED: (name) => `${name} has signed, so she can't be removed here.`,
  ANSWER_CLOSED: (cutoffDay) => `This invitation closed on ${longDate(cutoffDay)}.`,
  ANSWERED_TWICE: "You've already answered this invitation.",
  DECLINE_REASON: 'Choose a reason.',
  DECLINE_NOTE_LONG: 'Keep it under 200 characters.',
};

/**
 * ui-walk-fixes, founder decision D2 (2 Oct 2026) — WHY a creator can't be invited, in the
 * brand's words: a short line for her row and a full sentence for when the brand taps her
 * (board B, frames B1, B2 and the table B10).
 *
 * `detail` is which rule of collabEligibility.decideInvite failed FIRST; only that one is ever
 * worded. 'not_accepting' covers a creator who paused AND a creator who blocked this brand, so
 * the two read byte for byte the same. Anything without a detail (the brand's own facts
 * missing, a creator nobody can find) keeps the old "Not open to this set".
 *
 * The Aim and the mode are named as the apps name them; the city is the city of THIS SET's
 * branch, and when it is not known the sentence says "your branch" instead.
 */
const AIM_NAME = { conversion: 'Pay for Sale', engagement: 'Pay for Content', hybrid: 'Hybrid' };
const MODE_NAME = { visit: 'Store Visit', shipment: 'Remote', remote: 'Remote' };
const CANT_INVITE = {
  aim: { label: (w) => `Not taking ${w.aim}`, message: (w) => `${w.who} isn't taking ${w.aim} collaborations.` },
  mode: { label: (w) => `Not taking ${w.mode}`, message: (w) => `${w.who} isn't taking ${w.mode} collaborations.` },
  category: { label: () => 'Not taking your category', message: (w) => `${w.who} isn't taking invitations from brands in your category.` },
  visit_city: {
    label: (w) => (w.city ? `No store visits in ${w.city}` : 'Not taking store visits at your branch'),
    message: (w) => (w.city ? `${w.who} doesn't do store visits in ${w.city}.` : `${w.who} doesn't do store visits at your branch's city.`),
  },
  not_accepting: { label: () => 'Not taking invitations', message: (w) => `${w.who} isn't taking invitations right now.` },
  other: { label: () => 'Not open to this set', message: (w) => `${w.who} isn't open to this set.` },
};
const CANT_INVITE_DETAILS = ['not_accepting', 'aim', 'mode', 'category', 'visit_city'];

/**
 * @param {object} p
 * @param {string|null} p.detail  one of CANT_INVITE_DETAILS, or null / anything else
 * @param {string} [p.name]       the creator's name; only her first name is printed
 * @param {string} [p.aim]        the set's Aim code
 * @param {string} [p.mode]       the set's mode code (visit | shipment | remote)
 * @param {string} [p.city]       the city of the set's branch, when known
 * @returns {{ detail: string|null, label: string, message: string }}
 */
function cantInvite({ detail, name, aim, mode, city } = {}) {
  const w = {
    who: first(name),
    aim: AIM_NAME[String(aim || '').toLowerCase()] || null,
    mode: MODE_NAME[String(mode || '').toLowerCase()] || null,
    city: city ? String(city).trim() || null : null,
  };
  const known = CANT_INVITE_DETAILS.includes(detail) ? detail : null;
  // An Aim or a mode the apps have no name for cannot be put in a sentence; say the old line.
  const worded = (known === 'aim' && !w.aim) || (known === 'mode' && !w.mode) ? 'other' : (known || 'other');
  return { detail: known, label: CANT_INVITE[worded].label(w), message: CANT_INVITE[worded].message(w) };
}

/** The five decline reasons on the mockup (I14), stored as codes; the legacy codes stay readable. */
const DECLINE_REASONS = [
  { code: 'fee_too_low', label: 'Fee too low' },
  { code: 'schedule_conflict', label: "Dates don't suit" },
  { code: 'not_relevant', label: 'Not my kind of brand' },
  { code: 'too_much_work', label: 'Too much work' },
  { code: 'other', label: 'Other' },
];
const LEGACY_DECLINE_LABELS = { already_partnered: 'Already partnered' };
const declineLabel = (code) => (DECLINE_REASONS.find(r => r.code === code) || {}).label || LEGACY_DECLINE_LABELS[code] || (code ? String(code) : null);

const DELIVERABLE_TYPES = [
  { code: 'reel', one: 'Instagram reel', many: 'Instagram reels' },
  { code: 'post', one: 'Instagram post', many: 'Instagram posts' },
  { code: 'story', one: 'Instagram story', many: 'Instagram stories' },
  { code: 'youtube_video', one: 'YouTube video', many: 'YouTube videos' },
  { code: 'youtube_short', one: 'YouTube short', many: 'YouTube shorts' },
];
const USAGE_PLACES = [
  { code: 'social', label: "Brand's social" },
  { code: 'ads', label: 'Ads' },
  { code: 'website', label: 'Website' },
];
const USAGE_DURATIONS = [30, 60, 90, null]; // null = forever

/** "1 Instagram reel, 2 Instagram stories" */
function deliverablesInWords(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.map(r => {
    const t = DELIVERABLE_TYPES.find(x => x.code === r.type);
    const n = Number(r.count) || 1;
    return `${n} ${t ? (n === 1 ? t.one : t.many) : r.type}`;
  }).join(', ');
}

/** "60 days · social and ads" / "Forever · website" */
function usageInWords(u) {
  if (!u || !u.on) return null;
  const dur = u.duration_days == null ? 'Forever' : `${u.duration_days} days`;
  const places = (u.places || []).map(p => (USAGE_PLACES.find(x => x.code === p) || {}).label || p).map(s => s.replace("Brand's social", 'social').toLowerCase());
  const list = places.length <= 1 ? places.join('') : `${places.slice(0, -1).join(', ')} and ${places[places.length - 1]}`;
  return list ? `${dur} · ${list}` : dur;
}

const NOTIFY = {
  // The key every existing reader of the bell already knows; only the wording is item 5's.
  INVITED: { type: 'offer.invited', title: 'New invitation', body: (brand, setName) => `${brand} invited you to ${setName}. Have a look and reply before the cutoff.` },
  WITHDRAWN: { type: 'invitation.withdrawn', title: 'Invitation withdrawn', body: (brand) => `${brand} withdrew this invitation.` },
  REMOVED: { type: 'invitation.removed', title: 'Collaboration closed', body: (brand) => `${brand} is no longer going ahead with this collaboration.` },
  ACCEPTED: { type: 'offer.accepted', title: 'Invitation accepted', body: (creator, setName) => `${creator} accepted your invitation to ${setName}. Send the agreement next.` },
  DECLINED: {
    type: 'offer.declined', title: 'Invitation declined',
    body: (creator, setName, reasonCode, note) => `${creator} declined your invitation to ${setName}. Reason: ${declineLabel(reasonCode) || 'not given'}.${note ? ` "${note}"` : ''}`,
  },
};

module.exports = { MSG, DECLINE_REASONS, declineLabel, DELIVERABLE_TYPES, USAGE_PLACES, USAGE_DURATIONS, deliverablesInWords, usageInWords, NOTIFY, first, cantInvite, CANT_INVITE_DETAILS, AIM_NAME, MODE_NAME };
