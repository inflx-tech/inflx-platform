'use strict';

/**
 * shipping/shiprocket.js — the real aggregator, written from the public documentation and
 * SWITCHED OFF.
 * Contract: features/item11-remote §6.5 · approval §3.7
 *
 * ── SWITCHED OFF TWICE, ON PURPOSE ─────────────────────────────────────────
 *   1. `index.provider()` will not hand this adapter out unless
 *      env.SHIPPING_PROVIDER === 'shiprocket';
 *   2. every function here goes through `http()`, which throws SHIPROCKET_DISABLED unless
 *      env.SHIPROCKET_ENABLED === 'true'.
 * Neither is set on Render. `shipping-shiprocket.test.js` asserts that with the switches off
 * no HTTP call leaves the server (check 34) — by replacing the module's own transport and
 * proving it is never reached.
 *
 * Written against Shiprocket's public API: POST /v1/external/auth/login (a 10-day token),
 * /settings/company/addpickup, /courier/serviceability, /orders/create/adhoc,
 * /courier/assign/awb, /courier/generate/pickup, /courier/generate/label, /orders/cancel,
 * /orders/create/return, and the tracking webhooks.
 *
 * ── WHAT ONLY THE LIVE ACCOUNT CAN ANSWER (for the founder) ────────────────
 *   1. Whether ONE INFLX account may hold a pickup location per brand branch, and how many
 *      the plan allows. Item 11 does not wait on it: `brand_branch_pickups` is keyed on
 *      (branch_id, provider), which is correct either way (approval §2.5).
 *   2. The webhook signature scheme — header name, algorithm, and whether it signs the raw
 *      body. `verifySignature` below is a placeholder shaped like an HMAC-SHA256 over the raw
 *      body and MUST be checked against the real thing before go-live.
 *   3. Return-pickup coverage in Guntur and Vijayawada. The rules already say same-city riders
 *      are absent there (§32); if reverse pickup is unavailable, approval Q1's "she sends it
 *      back herself" stops being an edge case and becomes the normal path in two cities.
 *   4. Whether a RETURN can be quoted at OUTBOUND booking time. The whole return-lock design
 *      assumes it can. If not, §2.3's fallback (the outbound price) is what runs — which is
 *      why the simulator has a switch to refuse a return quote.
 *   5. Whether the label URL is durable or short-lived. Either way item 11 caches the PDF in
 *      R2 and serves its own signed URL.
 *   6. How a weight-difference charge is notified — a webhook, or only a monthly statement.
 *      If the latter, the weight-charge lane becomes an admin action, not an event.
 *   7. Whether a pickup can be scheduled for a chosen DAY (the return, R12) or only "next
 *      working day".
 */

const env = require('../../config/env');
const { EVENTS, ShippingError } = require('./contract');

const name = 'shiprocket';

/* ───────────────────────────────────────────────────────── the transport */

let _token = null;
let _tokenAt = 0;
const TOKEN_TTL_MS = 9 * 24 * 3600 * 1000;   // the doc says 10 days; refresh at 9

/**
 * The ONLY place this adapter can reach the network — and it refuses to, while off.
 *
 * It is a named export so a test can replace it and prove it was never called. Everything
 * below calls `module.exports._http`, never `http` directly, so the replacement is honoured.
 */
async function _http(method, path, { body = null, token = null } = {}) {
  if (!env.SHIPROCKET_ENABLED) {
    throw new ShippingError('SHIPROCKET_DISABLED',
      'The Shiprocket adapter is switched off. Set SHIPROCKET_ENABLED=true and SHIPPING_PROVIDER=shiprocket to turn it on.');
  }
  const axios = require('axios');
  const res = await axios({
    method,
    url: `${env.SHIPROCKET_BASE_URL}${path}`,
    data: body || undefined,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    timeout: 20000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new ShippingError('SHIPROCKET_ERROR', `Shiprocket ${method} ${path} → ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  return res.data;
}

async function auth() {
  if (_token && Date.now() - _tokenAt < TOKEN_TTL_MS) return _token;
  const d = await module.exports._http('POST', '/v1/external/auth/login', {
    body: { email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD },
  });
  _token = d && d.token;
  _tokenAt = Date.now();
  if (!_token) throw new ShippingError('SHIPROCKET_AUTH', 'Shiprocket did not return a token.');
  return _token;
}

/* ───────────────────────────────────────────────────────── the interface */

async function checkCoverage({ pickupPincode, deliveryPincode }) {
  const t = await auth();
  const q = `?pickup_postcode=${encodeURIComponent(pickupPincode)}&delivery_postcode=${encodeURIComponent(deliveryPincode)}&cod=0&weight=0.5`;
  const fwd = await module.exports._http('GET', `/v1/external/courier/serviceability/${q}`, { token: t });
  const couriers = (fwd && fwd.data && fwd.data.available_courier_companies) || [];
  // Unknown 3: whether any of these will COLLECT a return from that pincode. The flag below is
  // the documented one; it must be verified against a live response before go-live.
  const returnPickup = couriers.some((c) => c.pickup_availability === 1 || c.is_rto_address_available);
  return { delivers: couriers.length > 0, returnPickup, checkedAt: new Date().toISOString() };
}

async function quote({ pickupPincode, deliveryPincode, weightKg, direction = 'outbound' }) {
  const t = await auth();
  const q = `?pickup_postcode=${encodeURIComponent(pickupPincode)}&delivery_postcode=${encodeURIComponent(deliveryPincode)}&cod=0&weight=${Number(weightKg) || 0.5}`
    + (direction === 'return' ? '&is_return=1' : '');
  const d = await module.exports._http('GET', `/v1/external/courier/serviceability/${q}`, { token: t });
  const list = (d && d.data && d.data.available_courier_companies) || [];
  if (!list.length) return null;                       // §2.3 — the caller falls back
  const cheapest = list.reduce((a, b) => (Number(b.rate) < Number(a.rate) ? b : a));
  const amount = Math.round(Number(cheapest.rate));
  // Unknown: whether `rate` is GST-inclusive. Assumed inclusive, as the brand-facing price must
  // be. Verify before go-live — if it is exclusive, gross it up here and NOWHERE else.
  const gstAmount = Math.round((amount * 18) / 118 * 100) / 100;
  return { amount, gstAmount, gstIncluded: true, currency: 'INR', courierHint: cheapest.courier_name };
}

async function registerPickup({ name: n, phone, street, pincode, cityName, stateName }) {
  const t = await auth();
  const d = await module.exports._http('POST', '/v1/external/settings/company/addpickup', {
    token: t,
    body: {
      pickup_location: String(n || 'Branch').slice(0, 36),
      name: n, email: 'ops@inflx.in', phone,
      address: street, city: cityName, state: stateName, country: 'India', pin_code: pincode,
    },
  });
  return { providerPickupId: String((d && d.address && d.address.id) || (d && d.pickup_id) || '') };
}

async function book(shipment, { pickupLocationName, items = [] } = {}) {
  const t = await auth();
  const order = await module.exports._http('POST', '/v1/external/orders/create/adhoc', {
    token: t,
    body: {
      order_id: shipment.id,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: pickupLocationName,
      channel_id: env.SHIPROCKET_CHANNEL_ID || undefined,
      billing_customer_name: shipment.to_name,
      billing_address: shipment.to_street,
      billing_city: shipment.to_city_name,
      billing_pincode: shipment.to_pincode,
      billing_state: shipment.to_state_name,
      billing_country: 'India',
      billing_email: 'creators@inflx.in',
      billing_phone: shipment.to_phone,
      shipping_is_billing: true,
      order_items: items.map((i) => ({
        name: i.name_at_dispatch, sku: i.sku_at_dispatch || i.product_id,
        units: i.quantity, selling_price: Number(i.price_at_dispatch || 0),
      })),
      payment_method: 'Prepaid',
      sub_total: Number(shipment.declared_value || 0),
      length: Number(shipment.box_l_cm), breadth: Number(shipment.box_w_cm),
      height: Number(shipment.box_h_cm), weight: Number(shipment.weight_kg),
    },
  });
  const shipmentId = order && order.shipment_id;
  const awb = await module.exports._http('POST', '/v1/external/courier/assign/awb', {
    token: t, body: { shipment_id: shipmentId },
  });
  const d = (awb && awb.response && awb.response.data) || {};
  await module.exports._http('POST', '/v1/external/courier/generate/pickup', {
    token: t, body: { shipment_id: [shipmentId] },
  }).catch(() => null);       // a pickup that cannot be generated yet is not a failed booking
  return { courierName: d.courier_name || null, trackingNumber: d.awb_code || null, providerRef: String(shipmentId || '') };
}

async function bookReturn(shipment, { pickupDay } = {}) {
  const t = await auth();
  const d = await module.exports._http('POST', '/v1/external/orders/create/return', {
    token: t,
    body: {
      order_id: `${shipment.id}-R`,
      order_date: (pickupDay && String(pickupDay).slice(0, 10)) || new Date().toISOString().slice(0, 10),
      pickup_customer_name: shipment.from_name,
      pickup_address: shipment.from_street,
      pickup_city: shipment.from_city_name,
      pickup_state: shipment.from_state_name,
      pickup_country: 'India',
      pickup_pincode: shipment.from_pincode,
      pickup_phone: shipment.from_phone,
      shipping_customer_name: shipment.to_name,
      shipping_address: shipment.to_street,
      shipping_city: shipment.to_city_name,
      shipping_state: shipment.to_state_name,
      shipping_country: 'India',
      shipping_pincode: shipment.to_pincode,
      shipping_phone: shipment.to_phone,
      payment_method: 'Prepaid',
      length: Number(shipment.box_l_cm), breadth: Number(shipment.box_w_cm),
      height: Number(shipment.box_h_cm), weight: Number(shipment.weight_kg),
    },
  });
  return { courierName: d.courier_name || null, trackingNumber: d.awb_code || null, providerRef: String((d && d.shipment_id) || '') };
}

async function cancel(shipment) {
  const t = await auth();
  await module.exports._http('POST', '/v1/external/orders/cancel', { token: t, body: { ids: [shipment.provider_ref] } });
  return { cancelled: true };
}

async function label(shipment) {
  const t = await auth();
  const d = await module.exports._http('POST', '/v1/external/courier/generate/label', {
    token: t, body: { shipment_id: [shipment.provider_ref] },
  });
  const url = d && d.label_url;
  if (!url) throw new ShippingError('NO_LABEL', 'Shiprocket returned no label.');
  const axios = require('axios');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  return { buffer: Buffer.from(res.data), contentType: 'application/pdf' };
}

/* ───────────────────────────────────────────────────────── the webhook side */

/**
 * UNKNOWN 2. Shiprocket's signature scheme is not in the public docs in a form worth trusting.
 * This is shaped like the common one — HMAC-SHA256 over the raw body, compared in constant
 * time — and MUST be verified against a live delivery before go-live. It fails closed: with no
 * secret configured, nothing is accepted.
 */
function verifySignature(rawBody, headers) {
  const secret = env.SHIPROCKET_WEBHOOK_SECRET;
  if (!secret) return false;
  const given = String(headers['x-api-key'] || headers['x-shiprocket-signature'] || '');
  if (!given) return false;
  const crypto = require('crypto');
  // Shiprocket's own docs describe x-api-key as a shared secret, not a signature. Accept that
  // form, and an HMAC if it turns out to be one. Both compared in constant time.
  const a = Buffer.from(given);
  const shared = Buffer.from(secret);
  if (a.length === shared.length && crypto.timingSafeEqual(a, shared)) return true;
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Shiprocket's status words → the seven INFLX events. Verify against live deliveries. */
const STATUS_MAP = Object.freeze({
  'PICKED UP': EVENTS.COLLECTED,
  'SHIPPED': EVENTS.COLLECTED,
  'OUT FOR DELIVERY': EVENTS.OUT_FOR_DELIVERY,
  'UNDELIVERED': EVENTS.ATTEMPT_FAILED,
  'DELIVERY ATTEMPTED': EVENTS.ATTEMPT_FAILED,
  'DELIVERED': EVENTS.DELIVERED,
  'RTO DELIVERED': EVENTS.RETURNED_TO_STORE,
  'RTO IN TRANSIT': null,
  'CANCELED': EVENTS.CANCELLED,
  'CANCELLED': EVENTS.CANCELLED,
  'WEIGHT DISCREPANCY': EVENTS.WEIGHT_CHARGE,
});

/** One provider payload → zero or one INFLX event. Pure; the handler persists. */
function parseWebhook(payload) {
  const status = String((payload && (payload.current_status || payload.status)) || '').toUpperCase();
  const event = STATUS_MAP[status] || null;
  if (!event) return null;
  return {
    event,
    trackingNumber: (payload && (payload.awb || payload.awb_code)) || null,
    occurredAt: (payload && (payload.current_timestamp || payload.timestamp)) || new Date().toISOString(),
    providerEventId: (payload && payload.id) ? `${payload.id}:${status}` : null,
    amount: payload && payload.charged_weight_amount != null ? Number(payload.charged_weight_amount) : null,
    reason: (payload && (payload.status_detail || payload.remark)) || null,
  };
}

module.exports = {
  name, checkCoverage, quote, registerPickup, book, bookReturn, cancel, label,
  verifySignature, parseWebhook, STATUS_MAP,
  _http,          // replaceable in tests, so "no call is made" is provable
};
