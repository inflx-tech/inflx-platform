'use strict';

/**
 * places.service.js — Google Places Autocomplete + Details proxy (server-side so
 * the key stays secret). Powers the Swiggy-style "type an area → live suggestions
 * → pick → exact coords" flow. Uses the same GOOGLE_GEOCODING_API_KEY; that key
 * must have the **Places API** enabled (+ included in its API restrictions).
 *
 *   autocomplete(input, {sessiontoken, lat, lng}) → [{ place_id, main, secondary, description }]
 *   details(placeId, {sessiontoken})              → { lat, lng, formatted_address, name, area_name }
 *
 * Session tokens group an autocomplete-then-details pair into ONE billed session
 * (cheaper). Failures return [] / null (never throw) so the UI degrades cleanly.
 */

// Prefer a dedicated Places key (GOOGLE_PLACES_API_KEY); fall back to the geocoding
// key. Lets Places use its own key + restrictions, separate from Geocoding.
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY || '';
const GEOCODING_MOCK = String(process.env.GEOCODING_MOCK || '').toLowerCase() === 'true';

async function autocomplete(input, opts = {}) {
  if (GEOCODING_MOCK) {
    return [{ place_id: 'mock', main: input, secondary: 'Vijayawada, India', description: `${input}, Vijayawada` }];
  }
  if (!GOOGLE_KEY || !input) return [];
  const p = new URLSearchParams({ input, key: GOOGLE_KEY, components: 'country:in' });
  if (opts.sessiontoken) p.set('sessiontoken', opts.sessiontoken);
  if (Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
    p.set('location', `${opts.lat},${opts.lng}`);
    p.set('radius', '30000'); // 30km bias around the follower
  }
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${p.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[places] autocomplete status:', data.status, data.error_message || '');
      return [];
    }
    return (data.predictions || []).map(pr => ({
      place_id: pr.place_id,
      main: pr.structured_formatting?.main_text || pr.description,
      secondary: pr.structured_formatting?.secondary_text || '',
      description: pr.description,
    }));
  } catch (e) { console.error('[places] autocomplete failed:', e.message); return []; }
}

async function details(placeId, opts = {}) {
  if (GEOCODING_MOCK) {
    return { lat: 16.5062, lng: 80.648, formatted_address: 'Vijayawada, India', name: 'Mock', area_name: 'Vijayawada' };
  }
  if (!GOOGLE_KEY || !placeId) return null;
  const p = new URLSearchParams({ place_id: placeId, key: GOOGLE_KEY, fields: 'geometry,formatted_address,name,address_components' });
  if (opts.sessiontoken) p.set('sessiontoken', opts.sessiontoken);
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${p.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.result) {
      console.warn('[places] details status:', data.status, data.error_message || '');
      return null;
    }
    const r = data.result;
    const loc = r.geometry?.location;
    if (!loc) return null;
    const get = (t) => r.address_components?.find(c => c.types?.includes(t))?.long_name;
    return {
      lat: loc.lat, lng: loc.lng,
      formatted_address: r.formatted_address || null,
      name: r.name || null,
      area_name: get('sublocality_level_1') || get('sublocality') || get('locality') || r.name || null,
      city: get('locality') || null,
    };
  } catch (e) { console.error('[places] details failed:', e.message); return null; }
}

// Secret-safe diagnostic: is the Places API usable on this key?
async function placesHealth() {
  const base = { key_present: !!GOOGLE_KEY, mock: GEOCODING_MOCK };
  if (GEOCODING_MOCK) return { ...base, note: 'mock' };
  if (!GOOGLE_KEY) return { ...base, reason: 'no key' };
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=kphb&components=country:in&key=${GOOGLE_KEY}`);
    const data = await res.json().catch(() => ({}));
    return { ...base, http: res.status, places_status: data.status || null, error_message: data.error_message || null, sample: data.predictions?.[0]?.description || null };
  } catch (e) { return { ...base, fetch_error: e.message }; }
}

module.exports = { autocomplete, details, placesHealth };
