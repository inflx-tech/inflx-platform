'use strict';
/**
 * Apply the founder-locked CTA spec (Docs/CTA_SPEC.md, 2026-06-11) to the
 * 5 phase-1 category schemas. Contract: features/sprint2-business-page-ctas.
 * - Canonical action verb: pay_at_store (walkin_pay retired; app dispatch
 *   keeps accepting both for OTA-lag safety).
 * - Exactly one PRIMARY per schema, founder's labels + order.
 * - Contact rows preserved/normalized (call/whatsapp/directions/share).
 * Run: node scripts/apply-cta-spec.js   (idempotent; prints a diff summary)
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '../public/schemas');

const contact = (action, label, fields) => ({ kind: 'contact', action, label, source_fields: fields });
// Founder revision 2026-06-11: contacts reduced to Directions ONLY (small
// chip near the establishment card; Call/WhatsApp/Share removed).
const CONTACTS_STD = [
  contact('directions', 'Directions', ['google_maps_url', 'address_line', 'latitude']),
];

const SPEC = {
  'restaurant.json': {
    availing_modes: ['prebook', 'pay_at_store', 'online_order'],
    actions: [
      { kind: 'transactional', action: 'book_slot', label: 'Book a Table', priority: 1, primary: true,
        config: { booking_type: 'table', fields: ['booking_date', 'time_slot', 'guest_count', 'special_requests'] } },
      { kind: 'transactional', action: 'pay_at_store', label: 'Pay at Restaurant', priority: 2,
        config: { fields: ['amount'] } },
      { kind: 'transactional', action: 'online_order', label: 'Order Online', priority: 3, config: {} },
      ...CONTACTS_STD,
    ],
  },
  // REV 3 (founder, 2026-06-11): retail STORE level = Pay at Store ONLY (the
  // walk-in INFLX payment). Online ordering lives on the PRODUCT page
  // (CATEGORY_CTA_ORDER), not the business page. availing_modes keep
  // online_order -- products remain orderable online.
  'fashion.json': {
    availing_modes: ['pay_at_store', 'online_order'],
    actions: [
      { kind: 'transactional', action: 'pay_at_store', label: 'Pay at Store', priority: 1, primary: true,
        config: { fields: ['amount'] } },
      ...CONTACTS_STD,
    ],
  },
  'fashion_walkin.json': {
    availing_modes: ['pay_at_store', 'online_order'],
    actions: [
      { kind: 'transactional', action: 'pay_at_store', label: 'Pay at Store', priority: 1, primary: true,
        config: { fields: ['amount'] } },
      ...CONTACTS_STD,
    ],
  },
  'furniture.json': {
    availing_modes: ['pay_at_store', 'online_order'],
    actions: [
      { kind: 'transactional', action: 'pay_at_store', label: 'Pay at Store', priority: 1, primary: true,
        config: { fields: ['amount'] } },
      ...CONTACTS_STD,
    ],
  },
  'salon.json': {
    availing_modes: ['prebook', 'pay_at_store'],
    actions: [
      { kind: 'transactional', action: 'book_slot', label: 'Book Appointment', priority: 1, primary: true,
        config: { booking_type: 'appointment', fields: ['booking_date', 'time_slot', 'stylist_preference', 'notes'] } },
      { kind: 'transactional', action: 'pay_at_store', label: 'Pay at Salon', priority: 2,
        config: { fields: ['amount', 'tip_amount'] } },
      ...CONTACTS_STD,
    ],
  },
  'car_rental.json': {
    availing_modes: ['prebook', 'pay_at_store'],
    actions: [
      { kind: 'transactional', action: 'book_daterange', label: 'Book Your Dates', priority: 1, primary: true,
        config: { booking_type: 'date_range', fields: ['pickup_date', 'return_date', 'pickup_location'] } },
      { kind: 'transactional', action: 'pay_at_store', label: 'Pay at Garage', priority: 2,
        config: { fields: ['amount'] } },
      ...CONTACTS_STD,
    ],
  },
};

for (const [file, spec] of Object.entries(SPEC)) {
  const p = path.join(DIR, file);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  // Actions ALWAYS live at brand_config.actions  that is what
  // resolveBusinessStore  BrandStoreScreen reads. Create the block when a
  // schema (fashion_walkin) never had one; drop any stray root-level actions.
  if (!j.brand_config || typeof j.brand_config !== 'object') j.brand_config = {};
  delete j.actions;
  const target = j.brand_config;
  const beforeActions = JSON.stringify((target.actions || []).map(a => `${a.action}${a.primary ? '' : ''}`));
  target.actions = spec.actions;
  j.availing_modes = spec.availing_modes;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  const afterActions = JSON.stringify(spec.actions.filter(a => a.kind === 'transactional').map(a => `${a.action}${a.primary ? '' : ''}`));
  console.log(`[cta-spec] ${file}: ${beforeActions}  ${afterActions}; modes=${spec.availing_modes.join(',')}`);
}
console.log('[cta-spec] done.');
