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

  /* ── Item 11 · the Remote shoot (rules v1.27 §11.2) ────────────────────────
   * Every sentence below is the gap-check prompt's §7, verbatim. The server and the app say
   * the SAME words — the app imports its copy from a mirror of this file — so a refusal never
   * arrives in two voices. Nothing here may be paraphrased at a call site.
   */
  // Her address (R3, R4a, R4b)
  NAME_REQUIRED: 'Enter your name.',
  PHONE_REQUIRED: 'Enter a 10-digit mobile number.',
  STREET_REQUIRED: 'Enter your street and house.',
  PINCODE_REQUIRED: 'Enter a 6-digit pincode.',
  STATE_REQUIRED: 'Choose your state.',
  CITY_REQUIRED: 'Choose your nearest major city.',
  NOTE_LONG: 'Keep it under 200 characters.',
  SIZES_LONG: 'Keep it under 100 characters.',
  NOT_DELIVERABLE: (pin) => `Couriers don't deliver to ${pin} yet. Try an address at a pincode nearby, such as where you work or a friend's.`,
  ADDRESS_ALREADY_SENT: (brand) => `Your address is already with ${brand}.`,
  ADDRESS_LOCKED: 'Your address is locked for this shoot.',
  CORRECTION_NOT_ALLOWED: 'You can correct your address only if the courier brings the parcel back.',
  CORRECTION_USED: "You've already corrected your address once.",

  // The products (R5)
  ADDRESS_NOT_SENT: (name) => `${name} hasn't sent her address yet.`,
  // v1.27 §11.2 / approval Q3: a sale collaboration with no scope receives NOTHING. The whole
  // catalogue is never used in its place, because that would widen what she may sell.
  SCOPE_NOT_SET: (name) => `${name}'s selling scope hasn't been set, so there's nothing you can send her yet.`,
  OUT_OF_SCOPE: (name) => `${name} can't sell this product under your agreement.`,
  UNAVAILABLE: 'This product isn’t available right now.',
  NO_LINES: 'Add at least one product.',
  TOO_MANY_LINES: 'A parcel can hold up to 20 products.',
  TOO_MANY_OF_VARIANT: 'At most 5 of one size.',
  VARIANT_REQUIRED: 'Choose a size for this product.',
  // Approval Q1 — a WARNING on the screen, never a block, and the return is settled between them.
  RETURN_NO_PICKUP: (pin, name) => `Couriers can't collect returns from ${pin}. If you mark this Return, ${name} sends it back herself and you cover the cost directly.`,

  // Booking (R6, R6b, R7)
  BOX_REQUIRED: 'Choose a box size.',
  WEIGHT_REQUIRED: 'Enter the packed weight.',
  SHORT_BALANCE: (n) => `Add ${n} to book this parcel.`,
  ALREADY_BOOKED: 'This parcel is already booked.',
  LIST_LOCKED: 'The products are locked once the parcel is booked.',
  ALREADY_COLLECTED: 'The courier has already collected this parcel.',
  NOT_BOOKED: 'This parcel isn’t booked yet.',
  REBOOK_NOT_ALLOWED: 'You can book again only if the courier brings the parcel back.',
  REBOOK_USED: 'This parcel has already been booked again once.',

  // Checking and shoot done (R9, R11)
  NOT_DELIVERED: 'The parcel hasn’t been delivered yet.',
  ALREADY_CHECKED: 'This is already checked.',
  CHECK_NOTE_LONG: 'Keep it under 300 characters.',
  CHECK_FIRST: 'Check what arrived first.',
  DONE_ALREADY: 'This is already marked.',

  // The return (R12, R13, R15a, R15b)
  SHOOT_NOT_DONE: 'Mark the shoot done first.',
  NOTHING_TO_RETURN: 'Nothing to send back — everything is a gift.',
  PICKUP_DAY_PAST: 'Choose a pickup day from tomorrow.',
  RETURN_ALREADY_BOOKED: 'The return pickup is already booked.',
  GIFT_TO_RETURN: "A gift can't be turned back into a return.",
  RETURN_NOT_DELIVERED: 'The return hasn’t reached you yet.',
  ALREADY_CONFIRMED: 'This is already confirmed.',
  ALREADY_REPORTED: "You've already reported this.",
  OVERDUE_NOT_YET: 'The return isn’t overdue yet.',
  // Q1 — the no-courier return
  SELF_SEND_NOT_ALLOWED: 'The courier is collecting this return, so there is nothing for you to send yourself.',
  SELF_SEND_NOTE_LONG: 'Keep it under 200 characters.',

  // Admin
  TEST_PARCEL_REAL_PROVIDER: 'Test parcels only work with the simulator.',
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

/**
 * Item 11 — the seventeen keys of D13. `sendSms: false` on every one of them: the only SMS in
 * the shoot was the retired shipment-reminder job's, and none of these is worth a text message.
 * Push and the in-app bell, as items 5–10 do it.
 */
const NOTIFY11 = {
  ADDRESS_SENT:      { type: 'remote.address_sent',      title: 'Her delivery address is here' },
  BOOKED:            { type: 'remote.booked',            title: 'Your products are on the way' },
  COLLECTED:         { type: 'remote.collected',         title: 'The courier has the parcel' },
  OUT_FOR_DELIVERY:  { type: 'remote.out_for_delivery',  title: 'Out for delivery today' },
  ATTEMPT_FAILED:    { type: 'remote.attempt_failed',    title: 'The courier couldn’t deliver' },
  DELIVERED:         { type: 'remote.delivered',         title: 'The parcel has arrived' },
  BACK_TO_STORE:     { type: 'remote.back_to_store',     title: 'The parcel came back' },
  WEIGHT_CHARGE:     { type: 'remote.weight_charge',     title: 'A courier weight charge' },
  DIFFERENCE:        { type: 'remote.difference',        title: 'She reported a difference' },
  SHOOT_DONE:        { type: 'remote.shoot_done',        title: 'She has finished the shoot' },
  RETURN_TO_GIFT:    { type: 'remote.return_to_gift',    title: 'You can keep it' },
  RETURN_BOOKED:     { type: 'remote.return_booked',     title: 'The return pickup is booked' },
  RETURN_COLLECTED:  { type: 'remote.return_collected',  title: 'The return is on its way' },
  RETURN_DELIVERED:  { type: 'remote.return_delivered',  title: 'The return reached the branch' },
  RETURN_CONFIRMED:  { type: 'remote.return_confirmed',  title: 'The return is confirmed' },
  RETURN_OVERDUE:    { type: 'remote.return_overdue',    title: 'The return is overdue' },
  DELAYED:           { type: 'collab.delayed',           title: 'This collaboration is delayed' },
  REMINDER:          { type: 'remote.reminder',          title: 'A Remote shoot is waiting on you' },
};

/**
 * The Remote stage, in the words the screens use. Derived from timestamps exactly as item 10
 * derives the visit's — never stored twice.
 *
 *   not_sent → sent → booked → in_transit → delivered → checked → shot
 *   …then the return lane, which is SEPARATE and never blocks anything (§11.2).
 */
const REMOTE_STAGE_LABEL = {
  not_sent:   'Waiting for her address',
  sent:       'Address sent, not booked',
  booked:     'Booked, not collected',
  in_transit: 'On the way',
  delivered:  'Delivered, not checked',
  checked:    'Checked, shoot not marked',
  shot:       'Shoot done',
};

/** The return's own stage. Its own lane, on purpose. */
const RETURN_STAGE_LABEL = {
  none:       'Nothing to send back',
  due:        'To send back',
  booked:     'Pickup booked',
  in_transit: 'On its way back',
  delivered:  'At the branch, not confirmed',
  confirmed:  'Confirmed',
  overdue:    'Overdue',
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
  // Item 12 (rules v1.29 §12.2) — the five content stages, widened into the CHECK by migration
  // 192. The words live in contentCopy; they are repeated into this map so every reader of a
  // delayed stage — shoot screens, content screens, lists — resolves any stage from one place.
  ...require('./contentCopy').DELAYED_STAGE_LABEL,
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

/**
 * Item 14 — what opens after the shoot, in the words of the collaboration's Aim. Pay for Content
 * keeps item 12's line; Pay for Sale and Hybrid go live (rules v1.30 §12.1): Path 1, her
 * shoppable posts, then Path 2, the social media post. Before item 14 every Aim was told
 * "Your content step is open", which does not exist on Pay for Sale.
 */
function nextStepWords(goal, who = 'her') {
  const selling = goal === 'conversion' || goal === 'hybrid';
  if (who === 'you') return selling ? 'Time to go live: create your shoppable posts.' : 'Your content step is open.';
  return selling ? 'Next she creates her shoppable posts and goes live.' : 'Her content step is open.';
}

module.exports = {
  nextStepWords,
  MSG, NOTIFY, NOTIFY11, STAGE_LABEL, DELAYED_STAGE_LABEL, REMOTE_STAGE_LABEL, RETURN_STAGE_LABEL,
  whenLine, shortDay, assertRemoteMode,
};
