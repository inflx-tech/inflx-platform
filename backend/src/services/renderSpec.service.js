'use strict';

/**
 * renderSpec.service.js — Adaptive Renderer core logic (Creator Experience
 * Engine Phase 4a, features/adaptive-renderer/).
 *
 * PURE, dependency-free render-decision logic — no db, no env — so it is
 * unit-testable without a backend or emulator. Given a Layout Contract + an
 * Asset Pack (+ resolved tokens/copy), it decides which slots render and which
 * featured image fits the layout aspect. The mobile AdaptiveRenderer (Phase 4b)
 * and the preview endpoint both consume this.
 */

// Which image aspect a layout wants for its featured slot.
const IMAGE_ASPECT_FOR = {
  '16:9': 'landscape',
  '9:16': 'portrait',
  '4:5': 'portrait',
  '3:4': 'portrait',
  '1:1': 'square',
  '2x1:1': 'square',
};

function desiredAspect(aspectHint) {
  return IMAGE_ASPECT_FOR[aspectHint] || 'landscape';
}

// Best featured image for a layout: exact aspect match, else the first (crop).
function pickFeatured(aspectHint, images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const want = desiredAspect(aspectHint);
  return images.find((i) => i && i.aspect === want) || images[0];
}

// Does the pack/tokens/copy carry data for this slot?
function hasSlotData(slot, ctx) {
  const { pack = {}, tokens = {}, copy = {} } = ctx || {};
  switch (slot) {
    case 'background': return !!(tokens.background && Object.keys(tokens.background).length);
    case 'featured_image': return Array.isArray(pack.featured_images) && pack.featured_images.length > 0;
    case 'title': return !!copy.title;
    case 'subtitle': return !!copy.subtitle;
    case 'cta': return !!copy.cta;
    case 'avatar': return !!pack.avatar_url;
    case 'creator_name': return !!pack.creator_name;
    case 'offer_badge': return !!pack.offer_badge;
    case 'products': return Array.isArray(pack.products) && pack.products.length > 0;
    case 'price': return Array.isArray(pack.products) && pack.products.length > 0;
    default: return false;
  }
}

/**
 * resolveSlots(contract, ctx) → { visible_slots, blocked, missing }
 * - required slots are always visible (renderer shows a placeholder if data is
 *   missing) — but a missing required slot sets blocked=true (+ missing list).
 * - optional slots are visible only when the pack carries their data (the
 *   renderer trims further by on-screen room in Phase 4b).
 * - hidden slots are never visible.
 */
function resolveSlots(contract, ctx) {
  const required = Array.isArray(contract && contract.required) ? contract.required : [];
  const optional = Array.isArray(contract && contract.optional) ? contract.optional : [];
  const hidden = new Set(Array.isArray(contract && contract.hidden) ? contract.hidden : []);

  const missing = required.filter((s) => !hasSlotData(s, ctx));
  const visible = [];
  for (const s of required) if (!hidden.has(s) && !visible.includes(s)) visible.push(s);
  for (const s of optional) if (!hidden.has(s) && hasSlotData(s, ctx) && !visible.includes(s)) visible.push(s);

  return { visible_slots: visible, blocked: missing.length > 0, missing };
}

// A placeholder Asset Pack — real creator packs arrive in Phase 7. Kept here so
// the preview endpoint and unit tests share one sample.
const SAMPLE_ASSET_BASE = '/media/sample/street';
const SAMPLE_PACK = {
  creator_name: 'Rahul',
  avatar_url: `${SAMPLE_ASSET_BASE}/avatar.png`,
  featured_images: [
    { url: `${SAMPLE_ASSET_BASE}/landscape.jpg`, aspect: 'landscape' },
    { url: `${SAMPLE_ASSET_BASE}/portrait.jpg`, aspect: 'portrait' },
    { url: `${SAMPLE_ASSET_BASE}/square.jpg`, aspect: 'square' },
  ],
  offer_badge: '20% OFF',
  products: [
    { name: 'Oversized Tee', price: 1299 },
    { name: 'Sneakers', price: 2499 },
  ],
};

module.exports = { desiredAspect, pickFeatured, hasSlotData, resolveSlots, SAMPLE_PACK };
