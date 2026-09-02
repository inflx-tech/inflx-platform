'use strict';

/**
 * businessCategory.model.js — which businesses INFLX accepts.
 *
 * Contract: Docs/THE_CUT.md (founder decision, 2026-09-02) — "INFLX is a fashion
 * platform." Pass 0 of the cleaning plan: close the front door so no new wrong data
 * can enter while the rest is removed.
 *
 * WHY THIS FILE EXISTS AT ALL
 * The category list was written out three times — once in the brand website's signup
 * form, once in the brand app's signup screen, and nowhere on the server, which
 * accepted any non-empty string. So the two forms were a suggestion, not a gate: a
 * direct request could register a pest-control business, and a registered brand could
 * change its own category to anything afterwards through the profile edit. One list,
 * on the server, enforced on every path that writes the field.
 *
 * WHAT THIS DOES NOT DO
 * It does not touch brands that already exist. Nine are registered, one of them a
 * restaurant. They keep their category, keep resolving their own product schema, and
 * are unaffected — this gate is only crossed when the field is WRITTEN. Deleting the
 * businesses INFLX no longer serves is a later pass; shutting the door is this one.
 */

/**
 * The only category a new business may register under, or change to.
 * An array, not a bare string, so re-opening a vertical is a one-line edit here
 * rather than a hunt through three files.
 */
const ACCEPTED_CATEGORIES = ['fashion'];

/** True when `value` is a category INFLX currently accepts. */
function isAcceptedCategory(value) {
  return ACCEPTED_CATEGORIES.includes(String(value || '').trim().toLowerCase());
}

/**
 * The message a rejected category gets. Written for a business owner reading it on a
 * signup form, not for a developer reading a log: it says what we do take, rather than
 * only what we refused.
 */
function rejectionMessage() {
  return 'INFLX is currently a fashion platform. Clothing, footwear, jewellery and '
       + 'accessories are supported today.';
}

module.exports = { ACCEPTED_CATEGORIES, isAcceptedCategory, rejectionMessage };
