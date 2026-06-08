'use strict';

/**
 * geocoding.controller.js — POST /v1/internal/geocode-maps-url
 *
 * Thin wrapper over geocoding.service.resolveMapsUrl (the shared resolver). The
 * restaurant listing wizard's `google_maps_link` field posts a Google Maps share
 * URL → { verified, lat, lng, locality, formatted_address, place_id, city }.
 * Short links are followed; place URLs / names fall back to a forward geocode.
 * Failures return { verified:false, reason } (never 500) so the wizard can show a
 * friendly retry / manual-entry banner. Mock via GEOCODING_MOCK=true.
 */

const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const AppError    = require('../utils/AppError');
const geocoding   = require('../services/geocoding.service');

const geocodeMapsUrl = asyncHandler(async (req, res) => {
  const { google_maps_url, name, city } = req.body || {};
  if (!google_maps_url || typeof google_maps_url !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'google_maps_url is required', 422, 'google_maps_url');
  }
  const result = await geocoding.resolveMapsUrl(google_maps_url, { name, city });
  return success(res, result);
});

module.exports = { geocodeMapsUrl };
