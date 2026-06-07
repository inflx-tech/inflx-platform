'use strict';

/**
 * geocoding.controller.js
 *
 * Endpoint used by the restaurant listing wizard's `google_maps_link` field
 * type. Brand pastes a Google Maps share URL → we extract lat/lng + reverse-
 * geocode to a clean { lat, lng, locality, formatted_address, place_id, city }.
 *
 * Dev / mock mode (GEOCODING_MOCK=true): returns fixed Vijayawada coords so
 * the wizard works end-to-end without a paid API key. Same pattern as
 * OTP_MOCK / APIFY_MOCK / RAZORPAY_MOCK per CLAUDE.md §9.
 *
 * Prod mode: extracts lat/lng from the URL via a small set of regex patterns
 * (Google Maps share-link variations cover the realistic input shapes), then
 * calls Google Geocoding API for the address parts. Cached in-process by URL
 * for 30 days so a brand re-editing the wizard doesn't re-spend API calls.
 *
 * Failures are not 500 — return { verified: false, reason } so the brand UI
 * can show a friendly retry / manual-entry banner instead of erroring out.
 */

const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const AppError    = require('../utils/AppError');

// Mock is OPT-IN (default OFF). Production must run the REAL path (short-link
// expansion → coords from the pasted link); the old opt-out default left prod
// returning a hard-coded Vijayawada for every restaurant (founder report
// 2026-06-07). Local dev/tests that want the fixed mock set GEOCODING_MOCK=true.
const GEOCODING_MOCK = String(process.env.GEOCODING_MOCK || '').toLowerCase() === 'true';
const GOOGLE_KEY     = process.env.GOOGLE_GEOCODING_API_KEY || '';

// 30-day in-process cache (Map<urlHash, response>). Survives until restart;
// good enough for our brand volume. Replace with Redis when we cluster.
const _cache = new Map();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return hit.value;
}
function cacheSet(key, value) {
  _cache.set(key, { value, at: Date.now() });
}

// ── URL parsers ───────────────────────────────────────────────────────────────
// Google share-link URL shapes seen in the wild:
//   1. https://www.google.com/maps/place/<name>/@LAT,LNG,Zz/data=...
//   2. https://maps.google.com/?q=<name>&ll=LAT,LNG
//   3. https://maps.app.goo.gl/<short>  — needs HTTP follow (deferred)
//   4. https://goo.gl/maps/<short>      — needs HTTP follow (deferred)
//   5. https://www.google.com/maps?q=LAT,LNG
//   6. https://maps.google.com/maps?ll=LAT,LNG&q=<name>
//
// Shapes 1, 2, 5, 6 expose lat/lng directly via regex — handle inline.
// Shapes 3, 4 require following the redirect; for Wave 1 we return
// { verified: false, reason: 'Short links need expansion — paste the full
//   Maps URL or open the link first.' } and let the brand override.

function extractLatLngFromUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;

  // Pattern: @LAT,LNG,Zz  (most common — place page URL)
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'at_pin' };

  // Pattern: ll=LAT,LNG  (older Maps URL)
  m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'll' };

  // Pattern: q=LAT,LNG  (direct coord query)
  m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'q_coords' };

  // Pattern: !3dLAT!4dLNG  (embedded place-id-based URL data field)
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'place_data' };

  return null;
}

function isShortLink(url) {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url || '');
}

// Follow a Google short link (maps.app.goo.gl / goo.gl/maps) to its full URL so
// the coordinate regex can read it — FREE (no Google API key). Fast-fail on
// timeout/error so the wizard never hangs; the caller degrades to the
// "paste the full URL" message. (Founder decision 2026-06-07: free path now.)
async function expandShortLink(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const resp = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      return resp && resp.url ? resp.url : null; // final URL after redirects
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

// ── Mock — fixed Vijayawada coords ────────────────────────────────────────────
function mockResponse(url) {
  return {
    verified: true,
    lat: 16.506174,
    lng: 80.648015,
    locality: 'MG Road',
    formatted_address: 'MG Road, Vijayawada, Andhra Pradesh 520010, India',
    place_id: 'mock_place_id',
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    source: 'mock',
    input_url: url,
  };
}

// ── Real geocoding (Google Geocoding API reverse lookup) ──────────────────────
async function reverseGeocode(lat, lng) {
  if (!GOOGLE_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) return null;
    const top = data.results[0];
    // Extract neighbourhood / sublocality / city / state from address_components
    const get = (type) => top.address_components?.find(c => c.types?.includes(type))?.long_name;
    return {
      formatted_address: top.formatted_address,
      place_id:          top.place_id,
      locality:          get('sublocality_level_1') || get('sublocality') || get('neighborhood') || get('locality') || null,
      city:              get('locality') || get('administrative_area_level_2') || null,
      state:             get('administrative_area_level_1') || null,
    };
  } catch (err) {
    console.error('[geocoding] reverseGeocode failed:', err.message);
    return null;
  }
}

// ── POST /v1/internal/geocode-maps-url ────────────────────────────────────────
const geocodeMapsUrl = asyncHandler(async (req, res) => {
  const { google_maps_url } = req.body || {};
  if (!google_maps_url || typeof google_maps_url !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'google_maps_url is required', 422, 'google_maps_url');
  }

  // Mock mode short-circuits everything — same Vijayawada coords regardless
  // of input URL. Lets the wizard be tested without a paid API key.
  if (GEOCODING_MOCK) {
    return success(res, mockResponse(google_maps_url));
  }

  const cached = cacheGet(google_maps_url);
  if (cached) return success(res, cached);

  // Short links (the default "Share" link from the Maps app) carry no
  // coordinates in the URL text — follow the redirect to the full URL first.
  let effectiveUrl = google_maps_url;
  if (isShortLink(effectiveUrl)) {
    const expanded = await expandShortLink(effectiveUrl);
    if (expanded) effectiveUrl = expanded;
  }

  const coords = extractLatLngFromUrl(effectiveUrl);
  if (!coords) {
    const couldNotExpand = isShortLink(google_maps_url) && effectiveUrl === google_maps_url;
    return success(res, {
      verified: false,
      reason: couldNotExpand
        ? 'Could not open that short link automatically. Open it in Google Maps and copy the full URL from the address bar.'
        : 'Could not find coordinates in this URL. Open your restaurant on Google Maps → copy the URL from the address bar.',
    });
  }

  let geocoded = null;
  if (GOOGLE_KEY) {
    geocoded = await reverseGeocode(coords.lat, coords.lng);
  }

  const result = {
    verified: true,
    lat:      coords.lat,
    lng:      coords.lng,
    source:   coords.source,
    input_url: google_maps_url,
    // Address bits — when we have an API key, populated. Otherwise the
    // brand fills locality manually in the wizard step.
    locality:          geocoded?.locality          || null,
    formatted_address: geocoded?.formatted_address || null,
    place_id:          geocoded?.place_id          || null,
    city:              geocoded?.city              || null,
    state:             geocoded?.state             || null,
  };

  cacheSet(google_maps_url, result);
  return success(res, result);
});

module.exports = {
  geocodeMapsUrl,
};
