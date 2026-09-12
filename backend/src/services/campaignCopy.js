'use strict';

/**
 * Item 4 — every message the campaign and set rules produce, word for word (prompt §7).
 * The Brand app mirrors these in Packages/Mobile/src/components/campaigns/copy4.js.
 * Contract: features/item4-campaigns-sets
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-17' → '17 Oct 2026'. Calendar days only, never an instant. */
function longDate(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day || ''));
  if (!m) return String(day || '');
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

const MSG = {
  CAMPAIGN_NAME: 'Enter a campaign name.',
  CAMPAIGN_DESC_LONG: 'Keep it under 200 characters.',
  SET_NAME: 'Enter a set name.',
  AIM: 'Pick an Aim.',
  MODE: 'Pick a mode of work.',
  BRANCH: 'Pick the branch for this Store Visit set.',
  DATE: 'Choose a posting date.',
  DATE_TOO_SOON: 'Choose a posting date at least 7 days from today.',
  LOCKED: "This can't be changed after you've sent invitations.",
  DELETE_SET: "This set has invitations, so it can't be deleted.",
  DELETE_CAMPAIGN: "This campaign has invitations, so it can't be deleted.",
  INVITE_DATE_PASSED: 'Pick a new posting date before you invite anyone.',
  INVITE_CLOSED: (cutoffDay) => `Invitations for this set closed on ${longDate(cutoffDay)}.`,
  // Readable refusals where a foreign key would otherwise surface as a database error
  // (APPROVAL.md Q8 and §3.2). Their wording is mine; the rules doc names no text for them.
  DELETE_SET_IN_USE: "This set is linked to offers or sales, so it can't be deleted.",
  DELETE_CAMPAIGN_IN_USE: "This campaign is linked to payments or sales, so it can't be deleted.",
  BRANCH_IN_USE: "A set still uses this branch, so it can't be removed.",
};

module.exports = { MSG, longDate };
