/**
 * storeAddress — what a STORE's street address has to be for a courier to collect from it.
 * Contract: features/courier-ready-addresses
 *
 * The server decides (backend/src/services/brandBranches.service.js — `streetProblem`); this is
 * its mirror for the website, the same as Packages/Mobile/src/utils/storeAddress.js for the
 * phones. Keep the three in step: 10 to 140 characters, with a shop, door, plot or road number.
 * A six-digit run is a pincode and does not count as one.
 */

export const STREET_MAX = 140;
export const STREET_MIN = 10;

export const STORE_COPY = {
  streetHint: 'Shop or door number, building, street and area. A courier has to find it.',
  streetPlaceholder: 'Shop 12, Sri Sai Complex, Road No 3',
  city: 'City',
  cityHint: 'Not on the list? Pick the nearest city.',
  cityPick: 'Select your city',
  cityRequired: 'Pick your city',
};

/** The message for a street address a courier could not find, or '' when it could. */
export function streetError(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return 'Enter the street address.';
  if (t.length > STREET_MAX) return 'Keep the address under 140 characters.';
  if (t.length < STREET_MIN) return 'Add the shop or door number, building and street. A courier has to find it.';
  if (!/\d/.test(t.replace(/(^|\D)\d{6}(?!\d)/g, '$1 '))) return 'Add the shop or door number. Couriers need it to find the store.';
  return '';
}
