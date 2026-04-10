'use strict';

/**
 * Location Service — lat/lng extraction, distance calculation, geocoding
 */

/**
 * Extract lat/lng from a Google Maps URL.
 * Handles multiple URL formats:
 *   https://maps.google.com/?q=16.5062,80.6480
 *   https://www.google.com/maps/place/.../@16.5062,80.6480,17z
 *   https://goo.gl/maps/... (short URL — can't extract, return null)
 *   https://maps.app.goo.gl/... (short URL — can't extract, return null)
 *   16.5062,80.6480 (raw coords)
 */
function extractLatLng(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Raw coordinates: "16.5062,80.6480" or "16.5062, 80.6480"
  const rawMatch = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (isValidCoord(lat, lng)) return { latitude: lat, longitude: lng };
  }

  // Google Maps URL with @lat,lng
  const atMatch = trimmed.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoord(lat, lng)) return { latitude: lat, longitude: lng };
  }

  // Google Maps URL with ?q=lat,lng or &q=lat,lng
  const qMatch = trimmed.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidCoord(lat, lng)) return { latitude: lat, longitude: lng };
  }

  // Google Maps URL with /dir/ or /place/ containing coords
  const pathMatch = trimmed.match(/\/(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (pathMatch) {
    const lat = parseFloat(pathMatch[1]);
    const lng = parseFloat(pathMatch[2]);
    if (isValidCoord(lat, lng)) return { latitude: lat, longitude: lng };
  }

  // ll= parameter
  const llMatch = trimmed.match(/ll=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (isValidCoord(lat, lng)) return { latitude: lat, longitude: lng };
  }

  return null;
}

function isValidCoord(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Haversine distance between two lat/lng points in kilometers.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }

/**
 * SQL fragment for calculating distance in km using Haversine.
 * Returns the expression as a string for embedding in queries.
 * Usage: `SELECT ${haversineSql('b.latitude', 'b.longitude', '$3', '$4')} AS distance_km`
 */
function haversineSql(latCol, lngCol, latParam, lngParam) {
  return `(
    6371 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(${latParam})) * cos(radians(${latCol})) *
        cos(radians(${lngCol}) - radians(${lngParam})) +
        sin(radians(${latParam})) * sin(radians(${latCol}))
      ))
    )
  )`;
}

/**
 * Format distance for display.
 */
function formatDistance(km) {
  if (km == null || isNaN(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  if (km < 100) return `${Math.round(km)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Known city coordinates (fallback when GPS not available)
 */
const CITY_COORDS = {
  'vijayawada': { latitude: 16.5062, longitude: 80.6480 },
  'hyderabad':  { latitude: 17.3850, longitude: 78.4867 },
  'bangalore':  { latitude: 12.9716, longitude: 77.5946 },
  'chennai':    { latitude: 13.0827, longitude: 80.2707 },
  'mumbai':     { latitude: 19.0760, longitude: 72.8777 },
  'delhi':      { latitude: 28.7041, longitude: 77.1025 },
  'pune':       { latitude: 18.5204, longitude: 73.8567 },
  'kolkata':    { latitude: 22.5726, longitude: 88.3639 },
  'guntur':     { latitude: 16.3067, longitude: 80.4365 },
  'visakhapatnam': { latitude: 17.6868, longitude: 83.2185 },
};

function getCityCoords(cityName) {
  if (!cityName) return null;
  return CITY_COORDS[cityName.toLowerCase().trim()] || null;
}

module.exports = {
  extractLatLng,
  haversineKm,
  haversineSql,
  formatDistance,
  getCityCoords,
  isValidCoord,
};
