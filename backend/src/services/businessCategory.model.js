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
 * Item 9 — the two lists must agree, and nothing used to make them.
 *
 * A business INFLX accepts must also be a business INFLX can CHARGE. The rate
 * a store pays on a sale is looked up by its registered business type, and when
 * that lookup misses, the code quietly falls back to 8% — no error, nobody told,
 * and the brand is charged the wrong rate for as long as it trades.
 *
 * Re-opening a vertical is a one-line edit to ACCEPTED_CATEGORIES above. It
 * would have been very easy to add "furniture" and not notice that nobody had
 * given furniture a rate. This is the check that notices.
 *
 * Returns the accepted categories that have NO active rate — empty is healthy.
 * `categoryKeys` is the set of live rate keys, passed in so this file stays free
 * of the database and can be called from a test, a boot check or a script.
 */
function acceptedWithoutARate(categoryKeys) {
  const live = new Set([...(categoryKeys || [])].map(k => String(k).trim().toLowerCase()));
  return ACCEPTED_CATEGORIES.filter(c => !live.has(c));
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

module.exports = { ACCEPTED_CATEGORIES, isAcceptedCategory, rejectionMessage, acceptedWithoutARate };
