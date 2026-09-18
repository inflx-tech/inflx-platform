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
  // Mode
  WRONG_MODE: (name) => `This is a Remote collaboration. Products are shipped to ${name}.`,
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
};

module.exports = { MSG, STAGE_LABEL, DELAYED_STAGE_LABEL };
