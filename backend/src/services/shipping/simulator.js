'use strict';

/**
 * shipping/simulator.js — the courier that stands in until Shiprocket is live.
 * Contract: features/item11-remote §6.4 · approval §3.6 · mockups R18
 *
 * IT IS NOT A STUB. It implements the same interface as the Shiprocket adapter, it produces a
 * real (if obviously fake) label, and — the part that matters — **its events arrive through the
 * same webhook handler as a real provider's**. So notifications, Needs You, the wallet, the
 * Delayed flag and the return clock all run against real events long before an account exists.
 * When Shiprocket is switched on, nothing above this folder changes.
 *
 * THE TEST PINCODES (rules v1.27 §11.2 · mockups R4b, R18)
 *   ending 999 → no delivery at all. She cannot send that address.
 *   ending 998 → delivers, but no return pickup. She can send it; the brand is warned before
 *                marking any line Return, and if it keeps them she posts them back herself.
 *   anything else → both.
 *
 * A simulated shipment can never reach a real courier: `index.provider()` reads the provider
 * off the shipment row and refuses to hand out a different one.
 */

const crypto = require('crypto');
const db = require('../../config/db');
const env = require('../../config/env');
const { boxOf, volumetricKg, ShippingError } = require('./contract');

const name = 'simulator';

/* ───────────────────────────────────────────────────────── coverage */

const last3 = (pin) => String(pin || '').trim().slice(-3);

async function checkCoverage({ pickupPincode, deliveryPincode }) {
  const d = last3(deliveryPincode);
  const p = last3(pickupPincode);
  // A pickup pincode couriers cannot reach is a pickup that cannot happen either.
  const delivers = d !== '999' && p !== '999';
  return {
    delivers,
    returnPickup: delivers && d !== '998' && d !== '999',
    checkedAt: new Date().toISOString(),
  };
}

/* ───────────────────────────────────────────────────────── the price */

/** Great-circle kilometres between two of §2C's city centres. */
function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, rad = (x) => (Number(x) * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** The seeded coordinate for a city name (migration 190). Unknown city → null, not an error. */
async function cityPoint(cityName) {
  if (!cityName) return null;
  const { rows } = await db.query(
    `SELECT lat, lng FROM ref_cities WHERE lower(name) = lower($1) AND lat IS NOT NULL LIMIT 1`,
    [String(cityName).trim()]
  );
  return rows[0] ? { lat: Number(rows[0].lat), lng: Number(rows[0].lng) } : null;
}

const BASE = 60;          // the aggregator's floor, roughly
const PER_KG = 28;        // per chargeable kg after the first
const PER_100KM = 14;     // distance, per 100 km
const GST_PCT = 18;       // approval Q7 — INSIDE the total, never on top

/**
 * A believable price. GST is INCLUDED in `amount`; `gstAmount` says how much of it is tax, so
 * the brand's wallet history can be honest without ever adding anything on top.
 *
 * Returns null for a return when SIMULATOR_NO_RETURN_QUOTE is on — the switch approval §2.3
 * asked for, so the "lock falls back to the outbound price" path is exercised rather than
 * merely written.
 */
async function quote({ pickupPincode, deliveryPincode, pickupCity, deliveryCity, weightKg, box, direction = 'outbound' }) {
  if (direction === 'return' && env.SIMULATOR_NO_RETURN_QUOTE) return null;

  const dims = boxOf(box);
  const actual = Number(weightKg) || 0;
  const chargeable = Math.max(actual, dims ? volumetricKg(dims) : 0, 0.5);

  const [a, b] = await Promise.all([cityPoint(pickupCity), cityPoint(deliveryCity)]);
  // No coordinate for one of them (a city off the offered list) — assume a middling 350 km
  // rather than pricing it as if the two were in the same street.
  const km = haversineKm(a, b) ?? 350;

  const raw = BASE
    + Math.max(0, Math.ceil(chargeable - 1)) * PER_KG
    + (km / 100) * PER_100KM
    + (direction === 'return' ? 15 : 0);     // reverse pickup costs a little more

  const amount = Math.round(raw);
  const gstAmount = Math.round((amount * GST_PCT) / (100 + GST_PCT) * 100) / 100;
  return { amount, gstAmount, gstIncluded: true, currency: 'INR' };
}

/* ───────────────────────────────────────────────────────── pickup, booking */

async function registerPickup({ name: n, phone, street, pincode, cityName, stateName }) {
  const h = crypto.createHash('sha256')
    .update([n, phone, street, pincode, cityName, stateName].map((x) => String(x || '')).join('|'))
    .digest('hex').slice(0, 10);
  return { providerPickupId: `TESTPICK-${h.toUpperCase()}` };
}

/** A tracking number that could never be mistaken for a real one (check 36). */
const trackingNumber = () =>
  `TEST${String(crypto.randomInt(0, 1e10)).padStart(10, '0')}`;

const COURIERS = ['Test Express', 'Test Logistics', 'Test Cargo'];
const courierFor = (tn) => COURIERS[Number(String(tn).slice(-1)) % COURIERS.length];

async function book(shipment) {
  const tn = trackingNumber();
  return { courierName: courierFor(tn), trackingNumber: tn, providerRef: `SIMREF-${tn}` };
}

async function bookReturn(shipment, { pickupDay } = {}) {
  const tn = trackingNumber();
  return { courierName: courierFor(tn), trackingNumber: tn, providerRef: `SIMRET-${tn}`, pickupDay: pickupDay || null };
}

async function cancel(shipment) {
  if (!shipment || !shipment.tracking_number) {
    throw new ShippingError('NOT_BOOKED', 'There is nothing booked to cancel.');
  }
  return { cancelled: true };
}

/* ───────────────────────────────────────────────────────── the label */

/**
 * A one-page PDF that says what it is in the largest type on the page. Built with the same
 * PDFKit the agreement uses, so it opens in the phone's viewer through the same
 * Linking.openURL path (gap report §11.4) and needs no native module.
 */
async function label(shipment) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A5', margin: 28 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', resolve));

  doc.rect(14, 14, doc.page.width - 28, 44).fill('#FFC700');
  doc.fillColor('#1A1A17').fontSize(15).font('Helvetica-Bold')
     .text('TEST — NOT A REAL SHIPMENT', 14, 30, { width: doc.page.width - 28, align: 'center' });

  doc.moveDown(2.2).fillColor('#1A1A17').font('Helvetica-Bold').fontSize(11)
     .text(`${shipment.courier_name || 'Test Express'}`);
  doc.font('Courier-Bold').fontSize(18).text(String(shipment.tracking_number || '—'));

  const block = (title, lines) => {
    doc.moveDown(0.7).font('Helvetica-Bold').fontSize(8).fillColor('#77766E').text(title.toUpperCase());
    doc.font('Helvetica').fontSize(10).fillColor('#1A1A17');
    for (const l of lines.filter(Boolean)) doc.text(l);
  };

  block('From', [shipment.from_name, shipment.from_street,
    [shipment.from_city_name, shipment.from_state_name, shipment.from_pincode].filter(Boolean).join(', '),
    shipment.from_phone]);
  block('To', [shipment.to_name, shipment.to_street,
    [shipment.to_city_name, shipment.to_state_name, shipment.to_pincode].filter(Boolean).join(', '),
    shipment.to_phone]);
  block('Parcel', [
    shipment.weight_kg ? `${Number(shipment.weight_kg)} kg` : null,
    shipment.box_l_cm ? `${Number(shipment.box_l_cm)} × ${Number(shipment.box_w_cm)} × ${Number(shipment.box_h_cm)} cm` : null,
    // Approval Q6 — the declared value the courier asks for. No invoice travels with it.
    shipment.declared_value != null ? `Declared value ₹${Number(shipment.declared_value).toLocaleString('en-IN')}` : null,
    shipment.direction === 'return' ? 'RETURN TO SENDER' : null,
  ]);

  doc.moveDown(1).font('Helvetica').fontSize(7.5).fillColor('#77766E')
     .text('Produced by the INFLX shipping simulator. No courier has been booked and no goods will move.',
       { width: doc.page.width - 56 });

  doc.end();
  await done;
  return { buffer: Buffer.concat(chunks), contentType: 'application/pdf' };
}

module.exports = {
  name, checkCoverage, quote, registerPickup, book, bookReturn, cancel, label,
  // exported for the tests, not for callers
  _internals: { haversineKm, cityPoint, trackingNumber },
};
