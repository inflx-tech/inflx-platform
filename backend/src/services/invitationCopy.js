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

module.exports = { MSG, DECLINE_REASONS, declineLabel, DELIVERABLE_TYPES, USAGE_PLACES, USAGE_DURATIONS, deliverablesInWords, usageInWords, NOTIFY, first };
