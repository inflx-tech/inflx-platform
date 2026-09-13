'use strict';

/**
 * Platform-level numbers that the rules doc names and no Admin screen sets yet. Each one is a
 * stand-in for a setting the admin-parameters item will own; that item replaces the constant
 * here in a single edit and every reader picks it up.
 *
 * Contract: features/item5-invitations · rules v1.16 §7A · APPROVAL.md Q4
 */

/**
 * The minimum number of shoppable posts a Pay for Sale or Hybrid creator makes. Shown to the
 * brand read-only as "1 post · set by INFLX" and to the creator as "At least 1". Not a term, not
 * editable, not negotiable (§8).
 */
const MIN_SHOPPABLE_POSTS = 1;

module.exports = { MIN_SHOPPABLE_POSTS };
