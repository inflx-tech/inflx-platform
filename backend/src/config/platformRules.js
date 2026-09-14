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

/**
 * Item 6: the admin setting behind the constant (platform_settings.min_shoppable_posts, N22).
 * Read at SEND and stamped onto the invitation; the constant is the fallback before migration
 * 182 or if the read fails. A later change never moves a live invitation (rules §7B).
 */
async function minShoppablePosts() {
  try { return Number(await require('../services/platformSettings.service').get('min_shoppable_posts')) || MIN_SHOPPABLE_POSTS; } catch (_) { return MIN_SHOPPABLE_POSTS; }
}

module.exports = { MIN_SHOPPABLE_POSTS, minShoppablePosts };
