'use strict';

/**
 * Item 7 — the admin side of the standard terms.
 * Contract: features/item7-agreement · gap report §9
 *
 * Read on any admin role, publish on the `settings` capability — the same gate
 * the item 6 platform settings use. A version is never edited and never
 * deleted, because an agreement signed under it must still be servable years
 * later.
 */

const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const standardTerms = require('../services/standardTerms.service');

const list = asyncHandler(async (req, res) => {
  const [versions, current] = await Promise.all([standardTerms.list(), standardTerms.current()]);
  return success(res, { versions, current });
});

const get = asyncHandler(async (req, res) =>
  success(res, { terms: await standardTerms.byVersion(req.params.version) }));

const publish = asyncHandler(async (req, res) =>
  success(res, { terms: await standardTerms.publish(req.body || {}, req.user.sub) }, 201));

module.exports = { list, get, publish };
