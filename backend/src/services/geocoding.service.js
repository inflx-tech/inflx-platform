'use strict';

/**
 * geocoding.service.js — reusable Google Maps URL → coordinates + address.
 *
 * Refactored out of geocoding.controller.js (which now consumes this) so the
 * brand listing wizard, brand.controller.updateMe, the coord backfill, and the
 * follower reverse-geocode endpoint all share ONE resolver.
 *
 * resolveMapsUrl(url, {name, city}) → {
 *   verified, lat, lng, locality, formatted_address, place_id, city, state,
 *   source, low_confidence?, reason?
 * }
 * Handles 3 input shapes:
 *   1. URL/text with coords (@lat,lng · ll= · q= · !3d!4d · raw "lat,lng")  → regex
 *   2. Short link (maps.app.goo.gl / goo.gl/maps)                          → expand → regex
 *   3. Place URL / no coords (e.g. /maps/place/<name>/data=…) OR a bare name → FORWARD geocode
 *
 * Cost: device GPS + Haversine are free; this service is the ONLY Google spend
 * (Geocoding API: reverse for follower area, forward/reverse for brand coords).
 * No Distance Matrix. Mock (GEOCODING_MOCK=true) returns fixed Vijayawada coords.
 */

const GEOCODING_MOCK = String(process.env.GEOCODING_MOCK || '').toLowerCase() === 'true';
const GOOGLE_KEY     = process.env.GOOGLE_GEOCODING_API_KEY || '';

// 30-day in-process cache (Map<key, {value, at}>). Per-instance; fine at our volume.
const _cache = new Map();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return hit.value;
}
function cacheSet(key, value) { _cache.set(key, { value, at: Date.now() }); }

// ── URL coordinate parsers ────────────────────────────────────────────────────
function extractLatLngFromUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const s = url.trim();
  // raw "lat,lng"
  let m = s.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'raw' };
  // @LAT,LNG  (place page)
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'at_pin' };
  // ll=LAT,LNG
  m = s.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'll' };
  // q=LAT,LNG
  m = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'q_coords' };
  // !3dLAT!4dLNG (embedded place data)
  m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), source: 'place_data' };
  return null;
}

function isShortLink(url) {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url || '');
}

// /maps/place/<name>/… → human place name (for the forward-geocode fallback).
function extractPlaceName(url) {
  const m = String(url || '').match(/\/maps\/place\/([^/@?]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); }
  catch { return m[1].replace(/\+/g, ' ').trim(); }
}

// Follow a Google short link to its full (coord-bearing) URL — free, no API key.
async function expandShortLink(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const resp = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      return resp && resp.url ? resp.url : null;
    } finally { clearTimeout(timer); }
  } catch { return null; }
}

function addressParts(top) {
  const get = (type) => top.address_components?.find(c => c.types?.includes(type))?.long_name;
  return {
    formatted_address: top.formatted_address || null,
    place_id:          top.place_id || null,
    locality:          get('sublocality_level_1') || get('sublocality') || get('neighborhood') || get('locality') || null,
    city:              get('locality') || get('administrative_area_level_2') || null,
    state:             get('administrative_area_level_1') || null,
  };
}

// ── Google Geocoding API ──────────────────────────────────────────────────────
// Reverse: coords → address (used for follower area name + brand address parts).
async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  if (GEOCODING_MOCK) return { ...addressParts({}), locality: 'MG Road', city: 'Vijayawada', state: 'Andhra Pradesh', formatted_address: 'MG Road, Vijayawada' };
  if (!GOOGLE_KEY) return null;
  // Cache by ~100m-rounded coords so repeated home loads from one spot are free.
  const key = `rev:${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const parts = addressParts(data.results[0]);
    cacheSet(key, parts);
    return parts;
  } catch (err) { console.error('[geocoding] reverseGeocode failed:', err.message); return null; }
}

// Forward: free-text place/name → coords + address (the missing case: place URLs
// with no coords, e.g. Chaitanya's saved link, and brands with no usable URL).
async function forwardGeocode(query) {
  if (!GOOGLE_KEY || !query) return null;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const top = data.results[0];
    const loc = top.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat, lng: loc.lng, ...addressParts(top) };
  } catch (err) { console.error('[geocoding] forwardGeocode failed:', err.message); return null; }
}

function mockResponse(url) {
  return {
    verified: true, lat: 16.506174, lng: 80.648015, source: 'mock',
    locality: 'MG Road', formatted_address: 'MG Road, Vijayawada, Andhra Pradesh 520010, India',
    place_id: 'mock_place_id', city: 'Vijayawada', state: 'Andhra Pradesh', input_url: url,
  };
}

/**
 * Resolve a Google Maps URL (or a bare place name) to coords + address.
 * @param {string} url   Google Maps URL (may be a short link or a place URL).
 * @param {object} opts  { name, city } — used to forward-geocode when the URL
 *                       has no coordinates (or no URL is given).
 */
async function resolveMapsUrl(url, opts = {}) {
  if (GEOCODING_MOCK) return mockResponse(url);
  if (!url && !opts.name) return { verified: false, reason: 'no url or name provided' };

  const cacheKey = url || `name:${opts.name}|${opts.city || ''}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let result = null;

  // (1)(2) coords in the URL (after expanding a short link).
  if (url) {
    let eff = url;
    if (isShortLink(eff)) { const ex = await expandShortLink(eff); if (ex) eff = ex; }
    const coords = extractLatLngFromUrl(eff);
    if (coords) {
      const geo = await reverseGeocode(coords.lat, coords.lng);
      result = {
        verified: true, lat: coords.lat, lng: coords.lng, source: coords.source,
        locality: geo?.locality || null, formatted_address: geo?.formatted_address || null,
        place_id: geo?.place_id || null, city: geo?.city || null, state: geo?.state || null,
        input_url: url,
      };
    }
  }

  // (3) Forward-geocode the place name (from the URL) or the brand name + city.
  if (!result) {
    const query = extractPlaceName(url) || (opts.name ? `${opts.name}${opts.city ? ', ' + opts.city : ''}` : null);
    if (query) {
      const fwd = await forwardGeocode(query);
      if (fwd) result = {
        verified: true, lat: fwd.lat, lng: fwd.lng, source: 'forward_geocode',
        low_confidence: true, query,
        locality: fwd.locality, formatted_address: fwd.formatted_address,
        place_id: fwd.place_id, city: fwd.city, state: fwd.state, input_url: url,
      };
    }
  }

  if (!result) result = { verified: false, reason: 'Could not resolve coordinates from the link or name.', input_url: url };
  cacheSet(cacheKey, result);
  return result;
}

module.exports = {
  resolveMapsUrl,
  reverseGeocode,
  forwardGeocode,
  extractLatLngFromUrl,
  extractPlaceName,
  isShortLink,
  expandShortLink,
};
