/**
 * storeAddress — what a STORE's address has to be for a courier to collect from it.
 * Contract: features/courier-ready-addresses
 *
 * The server decides (backend/src/services/brandBranches.service.js — `streetProblem`); this is
 * its mirror, so the red line appears as the brand types rather than after a round trip. Keep
 * the two in step: 10 to 140 characters, with a shop, door, plot or road number. A six-digit run
 * is a pincode and does not count as one.
 *
 * Why: Shiprocket refuses a pickup address under 10 characters or with no number in it, and on
 * 6 Oct 2026 that was ten of the fourteen store branches on the platform.
 */

export const STREET_MIN = 10;
export const STREET_MAX = 140;
export const LANDMARK_MAX = 45;
/** A creator's delivery street: all a courier keeps of an address. */
export const DELIVERY_STREET_MAX = 190;

export const MSG_STORE = {
  REQUIRED: 'Enter the street address.',
  SHORT: 'Add the shop or door number, building and street. A courier has to find it.',
  NUMBER: 'Add the shop or door number. Couriers need it to find the store.',
  LONG: 'Keep the address under 140 characters.',
  LANDMARK_LONG: 'Keep the landmark under 45 characters.',
  PHONE: 'Enter a 10-digit mobile number.',
  CITY: 'Pick your city.',
};

export const STORE_COPY = {
  streetHint: 'Shop or door number, building, street and area. A courier has to find it.',
  streetPlaceholder: 'Shop 12, Sri Sai Complex, Road No 3',
  landmark: 'Landmark',
  landmarkPlaceholder: 'Opposite JNTU metro station',
  landmarkHint: 'Optional.',
  city: 'City',
  cityHint: 'Not on the list? Pick the nearest city.',
  phone: 'Store phone',
  phoneHint: 'The courier calls this number at pickup. Starts as your login number.',
  deliveryStreetHint: 'House or flat number, building, street and area.',
};

const squash = (text) => String(text == null ? '' : text).replace(/\s+/g, ' ').trim();

/** The red line under a store's street address, or '' when a courier could find it. */
export function streetError(text) {
  const t = squash(text);
  if (!t) return MSG_STORE.REQUIRED;
  if (t.length > STREET_MAX) return MSG_STORE.LONG;
  if (t.length < STREET_MIN) return MSG_STORE.SHORT;
  if (!/\d/.test(t.replace(/(^|\D)\d{6}(?!\d)/g, '$1 '))) return MSG_STORE.NUMBER;
  return '';
}

export function landmarkError(text) {
  return squash(text).length > LANDMARK_MAX ? MSG_STORE.LANDMARK_LONG : '';
}

/** The last ten digits of whatever was typed or stored ("+91 98765 43210" → "9876543210"). */
export function tenDigits(phone) {
  const d = String(phone == null ? '' : phone).replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

/** The red line under the store phone. The screen requires one; it starts as the login number. */
export function storePhoneError(phone) {
  return /^[6-9]\d{9}$/.test(tenDigits(phone)) ? '' : MSG_STORE.PHONE;
}
