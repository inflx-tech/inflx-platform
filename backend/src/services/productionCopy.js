'use strict';

/**
 * productionCopy.js — every sentence the shoot plan says, in one place.
 * Contract: features/item10-store-visit · gap-check prompt §7 (server and app, identical text)
 *
 * Same shape as agreementCopy / negotiationCopy / pitchCopy: MSG for refusals, NOTIFY for the
 * keys and titles, and sentence builders that take a name or a date rather than a row.
 */

const { longDate } = require('./campaignCopy');

const MSG = {
  // The gate (§10) — the two sentences from the prompt, verbatim.
  NOT_SIGNED: "This collaboration isn't signed by both of you yet.",
  NOT_FUNDED: "The money for this collaboration isn't locked yet.",
  // Mode — the two refusals are MIRRORS. Item 10's endpoints answer the first when a Remote
  // collaboration reaches them; item 11's answer the second when a Store Visit one does
  // (rules v1.27 §11.2: "A Remote collaboration cannot use any Store Visit action, and a Store
  // Visit collaboration cannot use any Remote one"). Both sentences are the gap-check prompt's,
  // verbatim; neither may be paraphrased at a call site.
  WRONG_MODE: (name) => `This is a Remote collaboration. Products are shipped to ${name}.`,
  WRONG_MODE_VISIT: (brand) => `This is a Store Visit collaboration. ${brand} send a time and the store address.`,
  // The plan
  CONTACT_NAME: 'Enter who she should ask for.',
  CONTACT_PHONE: 'Enter a contact number.',
  TIME_REQUIRED: 'Choose a date and time.',
  TIME_AFTER_POSTING: (day) => `The visit has to be before ${longDate(day)}, the day she posts.`,
  TIME_IN_PAST: 'Choose a time in the future.',
  NOTES_LONG: 'Keep it under 500 characters.',
  PLAN_ALREADY_SENT: (name) => `A plan is already with ${name}.`,
  PLAN_LOCKED: 'Send a new time instead of changing this one.',
  BRANCH_NO_ADDRESS: (branch) => `Add the street address to ${branch} first. You can do that under Branches and come straight back.`,
  NO_POSTING_DATE: "This is an older collaboration with no posting date. It can't take a shoot plan.",
  // The time
  TIME_ALREADY_AGREED: 'The time is already agreed. Ask to move it instead.',
  NO_ROUNDS_LEFT: 'There are no counters left. You can accept this time or ask to move it.',
  NO_DECLINE: "There is no declining a time. If it can't work, suggest a different one.",
  // Marking it done
  TIME_NOT_AGREED: "The time hasn't been agreed yet.",
  TOO_EARLY: (day) => `You can mark this from ${longDate(day)}, the day of the visit.`,
  ALREADY_MARKED: 'This is already marked.',
  NOT_MARKED_YET: (name) => `${name} hasn't said she visited yet.`,
  SHOOT_COMPLETE: 'This visit is already confirmed.',
  // Retired doors (Phase 2d)
  RETIRED_MODE_CHOICE: 'The mode of work comes from the set and cannot be chosen or changed inside the shoot plan.',
  RETIRED_SLOT_DANCE: 'Visit times are agreed through the shoot plan now.',
  // Item 11 (approval §3.3) — the hand-typed courier flow, retired server-side, not by hiding
  // buttons. One sentence per door, each naming where the thing happens now.
  RETIRED_DISPATCH: 'Parcels are booked through INFLX now. Pick the products and book the parcel in the app — INFLX arranges the courier and gives you the label.',
  RETIRED_CONFIRM_RECEIVED: 'She checks the parcel item by item in the app now.',
  RETIRED_COMPLETE_REMOTE: 'She marks a Remote shoot done in the app, once she has checked what arrived.',
  RETIRED_DROP: "Dropping an item is not part of a Remote shoot. What she reports is recorded as it stands, and you can report a difference to INFLX.",
  RETIRED_SHIPMENT_SLOT: 'There is nothing to agree on a Remote shoot. She sends her address, and you pick the products and book the parcel.',
};

/**
 * "Sat 18 Oct, 11:00 am" — a visit time as the screens print it (prompt §8), always in India,
 * whatever the server's clock says. Built from parts so the shape cannot drift with the ICU
 * locale data on a given machine.
 */
function whenLine(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(d).reduce((o, p) => { o[p.type] = p.value; return o; }, {});
  const ampm = String(parts.dayPeriod || '').toLowerCase().replace(/\./g, '');
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${ampm}`.trim();
}

/** "18 Oct" — the short form for lists. */
function shortDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).formatToParts(d).reduce((o, p) => { o[p.type] = p.value; return o; }, {});
  return `${parts.day} ${parts.month}`;
}

/** Notification keys — the eight the gap-check prompt names, plus the reminder (approval §2.5). */
const NOTIFY = {
  PLAN_SENT:      { type: 'shoot.plan_sent',      title: 'A store visit is planned' },
  TIME_COUNTERED: { type: 'shoot.time_countered', title: 'A different time was asked for' },
  TIME_AGREED:    { type: 'shoot.time_agreed',    title: 'Visit time agreed' },
  MOVED:          { type: 'shoot.time_moved',     title: 'The visit is being moved' },
  ATTENDED:       { type: 'shoot.attended',       title: 'She has been to the store' },
  CONFIRMED:      { type: 'shoot.confirmed',      title: 'Shoot confirmed' },
  AUTO_CONFIRMED: { type: 'shoot.auto_confirmed', title: 'Shoot confirmed itself' },
  DELAYED:        { type: 'collab.delayed',       title: 'This collaboration is delayed' },
  REMINDER:       { type: 'shoot.reminder',       title: 'A store visit is waiting on you' },
};

const STAGE_LABEL = {
  not_sent: 'Plan not sent',
  sent: 'Sent, time not agreed',
  agreed: 'Time agreed, not visited',
  attended: 'Visited, not confirmed',
  complete: 'Done',
};

const DELAYED_STAGE_LABEL = {
  plan_not_sent: 'Plan not sent',
  time_not_agreed: 'Sent, time not agreed',
  not_attended: 'Time agreed, not visited',
  not_confirmed: 'Visited, not confirmed',
  content_not_live: 'Content not live',
  // Item 11 (rules v1.27 §11.2) — the five Remote stages. The CHECK on
  // campaign_influencers.delayed_stage is widened to match in migration 191; before that it
  // listed only the five above and would have REJECTED every one of these (finding 3).
  address_not_sent: 'Address not sent',
  not_booked: 'Not booked',
  in_transit: 'On the way',
  not_checked: 'Delivered, not checked',
  shoot_not_marked: 'Checked, shoot not marked',
};

/**
 * Item 11 — a Remote path refuses a Store Visit collaboration, and says which it is.
 *
 * Kept here rather than in a service so the two directions sit beside each other and neither
 * can drift: item 10's `assertOpenVisit` throws MSG.WRONG_MODE, this throws MSG.WRONG_MODE_VISIT.
 *
 * `mode` is the shoot row's; where there is no row yet it is the set's (`campaign_sets.shoot_mode`),
 * which is the authority anyway (§11: the mode comes from the set and never changes).
 * A NULL mode is a pre-set-first collaboration and resolves to 'remote' — item 11's side — so it
 * is NOT refused here; `productionMode.resolveProductionMode` has already had its say.
 *
 * @param {string|null} mode
 * @param {string} brandName
 */
function assertRemoteMode(mode, brandName) {
  if (String(mode || '').toLowerCase() === 'visit') {
    const AppError = require('../utils/AppError');
    throw new AppError('WRONG_MODE_VISIT', MSG.WRONG_MODE_VISIT(brandName || 'They'), 422, 'mode');
  }
}

module.exports = {
  MSG, NOTIFY, STAGE_LABEL, DELAYED_STAGE_LABEL, whenLine, shortDay, assertRemoteMode,
};
