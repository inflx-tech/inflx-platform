'use strict';

/**
 * A creator's own delivery address, kept in her profile. Mounted at '/'.
 * Contract: features/creator-address-bank-save · 03-expected-outputs.md (A1–A9)
 *
 * Her profile, so — like the rest of her profile — none of these asks for an approved account.
 * There is no route that reads another creator's address, for a brand, an admin or anyone: the
 * only address that ever leaves her is the one she sends for a collaboration (item 11).
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const address = require('../services/creatorAddress.service');

const router = Router();
const creator = [authenticate, requireRole('influencer')];
const h = (fn) => asyncHandler(async (req, res) => success(res, await fn(req)));

router.get   ('/influencers/me/delivery-address', ...creator, h((req) => address.read(req.user.sub)));
router.put   ('/influencers/me/delivery-address', ...creator, h((req) => address.save(req.user.sub, req.body || {})));
router.delete('/influencers/me/delivery-address', ...creator, h((req) => address.remove(req.user.sub)));

module.exports = router;
