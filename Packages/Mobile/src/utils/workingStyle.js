/**
 * workingStyle.js — the ONE place that knows a working style is two questions.
 * Contract: features/collab-working-style-two-questions
 *
 * The founder, 2026-08-22: "actually it is two one is store visit and remote...remote
 * selected then ask for product shipping involved."
 *
 * Two of the old three chips answered WHERE she works; the third answered WHETHER a box
 * moves. Offering them as one choice made a brand that ships product AND wants a store
 * visit pick one and lose the other, and never asked the shipping question of a remote
 * collaboration — the only case where it matters.
 *
 * WHAT IS STORED DOES NOT CHANGE. The screen asks two questions; the record keeps the
 * same three words it always has:
 *
 *     Store visit                -> 'visit'
 *     Remote, nothing shipped    -> 'remote'
 *     Remote, products shipped   -> 'shipment'
 *
 * That is deliberate. 'shipment' is the word the production machinery already keys off:
 * address confirmation, courier and AWB, delivery confirmation, the daily nudge for an
 * unconfirmed parcel, the fourteen-day stall alert to admin, and the contract PDF.
 * Renaming it would mean touching all of that, plus a migration, to gain nothing.
 *
 * Two screens ask this question — the collaboration request and the contract. They must
 * ask it in the same words, so both read them from here. A second copy of this mapping
 * is the exact fault this programme has already had to clean up twice.
 */

/** Question one. Never includes shipping — shipping is not a place. */
const PLACES = [
  { v: 'visit', label: 'Store visit' },
  { v: 'remote', label: 'Remote' },
];

/** Question two, asked only when the answer to question one is 'remote'. */
const SHIPPING = [
  { v: 'yes', label: "Yes, we'll ship" },
  { v: 'no', label: 'No' },
];

/**
 * Two answers in, one stored value out.
 * Returns '' for "not stated", which the terms model treats as the term being absent.
 */
function toMode(place, shipping) {
  if (place === 'visit') return 'visit';
  if (place === 'remote') return shipping === 'yes' ? 'shipment' : 'remote';
  return '';
}

/**
 * One stored value in, two answers out — for reading an existing request back, including
 * one created before this change.
 */
function fromMode(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'visit') return { place: 'visit', shipping: null };
  if (m === 'shipment') return { place: 'remote', shipping: 'yes' };
  if (m === 'remote') return { place: 'remote', shipping: 'no' };
  return { place: '', shipping: null };
}

/**
 * How a stored value reads on screen — as TWO lines, because it answers two questions.
 * `you` picks the voice: the brand is told what it asked for, the creator what she is
 * being asked. Returns null for a term that was never stated.
 */
function describeMode(mode, voice = 'creator') {
  const { place, shipping } = fromMode(mode);
  if (!place) return null;
  if (place === 'visit') {
    return {
      place: 'Store visit',
      shipping: null,
      hint: voice === 'creator'
        ? 'You shoot at their store.'
        : 'They come to your store and shoot there.',
    };
  }
  return {
    place: 'Remote',
    shipping: shipping === 'yes'
      ? (voice === 'creator' ? "They'll ship to you" : "You'll ship to them")
      : 'Nothing shipped',
    hint: shipping === 'yes'
      ? (voice === 'creator'
        ? 'Your delivery address is taken from your profile once you both agree.'
        : "You'll add the courier and tracking number after you dispatch.")
      : (voice === 'creator'
        ? 'You shoot wherever you are, with what you already have.'
        : 'They shoot wherever they are, from your brief.'),
  };
}

module.exports = { PLACES, SHIPPING, toMode, fromMode, describeMode };
