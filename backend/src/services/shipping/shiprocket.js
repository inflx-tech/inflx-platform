'use strict';

/**
 * shipping/shiprocket.js — the real aggregator. SWITCHED OFF until the founder turns it on.
 * Contract: features/item11-remote §6.5 · approval §3.7
 *           features/shiprocket-connector-repair (6 Oct 2026)
 *
 * ── SWITCHED OFF TWICE, ON PURPOSE ─────────────────────────────────────────
 *   1. `index.provider()` will not hand this adapter out unless
 *      env.SHIPPING_PROVIDER === 'shiprocket';
 *   2. every function here goes through `_http()`, which throws SHIPROCKET_DISABLED unless
 *      env.SHIPROCKET_ENABLED === 'true'.
 * `shipping-layer.test.js` asserts that with the switches off no HTTP call leaves the server
 * (check 34) — by replacing the module's own transport and proving it is never passed.
 * EVERY PUBLIC FUNCTION THEREFORE REACHES THE TRANSPORT BEFORE IT VALIDATES ANYTHING.
 *
 * ── WRITTEN AGAINST THE PUBLISHED REFERENCE ────────────────────────────────
 * The first version (22 Sep 2026) was written from memory of the documentation. This one was
 * rewritten against Shiprocket's developer portal, release 2026-10, operation by operation:
 *   POST /auth/login                    a token good for 10 days
 *   GET  /courier/serviceability/       couriers and prices, either direction
 *   POST /settings/company/addpickup    a store address, under a code unique on the account
 *   GET  /settings/company/pickup       the store addresses already held
 *   POST /orders/create/adhoc           the outbound order
 *   POST /orders/create/return          the return order
 *   POST /courier/assign/awb            the tracking number (`is_return` says which kind)
 *   POST /courier/generate/pickup       ask the courier to come, optionally on a day
 *   POST /courier/generate/label        the label PDF
 *   POST /orders/cancel                 cancel, by SHIPROCKET's order id
 *   GET  /billing/discrepancy           weight differences — never pushed, so they are fetched
 *   the tracking webhook                `x-api-key` is a shared secret, not a signature
 *
 * ── WHAT THE REFERENCE SETTLED (the seven unknowns of 22 Sep) ──────────────
 *   1. One account may hold a pickup location per store; they are added through the API.
 *   2. The webhook carries a shared secret in `x-api-key`. No signature.
 *   4. A RETURN can be priced at outbound booking time (`is_return=1`).
 *   6. A weight difference is NOT a webhook. `weightCharges()` reads the list.
 *   7. A pickup can be asked for on a chosen day, up to a week ahead (`pickup_date`).
 *
 * ── WHAT ONLY A LIVE PARCEL CAN STILL ANSWER ───────────────────────────────
 *   a. Whether a store whose phone is unverified (`phone_verified: 0`) can ship.
 *   b. Return-pickup coverage in Guntur and Vijayawada (unknown 3).
 *   c. Whether `rate` contains GST. Assumed YES; if the first real parcel shows otherwise, set
 *      SHIPROCKET_RATES_EXCLUDE_GST=true and `priceOf` grosses it up — here and NOWHERE else.
 *   d. The exact status words on a return parcel. The reference shows `RETURN PENDING`; the
 *      parser therefore reads a return's words with or without the `RETURN ` prefix.
 *   e. Whether the label URL is durable (unknown 5). Item 11 caches the PDF in R2 either way.
 */

const crypto = require('crypto');
const env = require('../../config/env');
const { EVENTS, ShippingError, boxOf } = require('./contract');

const name = 'shiprocket';
const API = '/v1/external';

/* ───────────────────────────────────────────────────────── the transport */

let _token = null;
let _tokenAt = 0;
const TOKEN_TTL_MS = 9 * 24 * 3600 * 1000;   // the doc says 10 days; refresh at 9

/**
 * The ONLY place this adapter can reach Shiprocket's API — and it refuses to, while off.
 *
 * It is a named export so a test can replace it and prove it was never passed. Everything
 * below calls `module.exports._http`, never `_http` directly, so the replacement is honoured.
 *
 * A refusal carries `status` and `body`, because two callers need to tell a 401 (sign in again)
 * and a 404 (no courier serves that pincode) from everything else.
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
    const e = new ShippingError('SHIPROCKET_ERROR',
      `Shiprocket ${method} ${path} → ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
    e.status = res.status;
    e.body = res.data;
    throw e;
  }
  return res.data;
}

/** The label PDF lives on Shiprocket's file host, not its API. Replaceable in tests. */
async function _download(url) {
  const axios = require('axios');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  return Buffer.from(res.data);
}

async function auth() {
  if (_token && Date.now() - _tokenAt < TOKEN_TTL_MS) return _token;
  const d = await module.exports._http('POST', `${API}/auth/login`, {
    body: { email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD },
  });
  _token = d && d.token;
  _tokenAt = Date.now();
  if (!_token) throw new ShippingError('SHIPROCKET_AUTH', 'Shiprocket did not return a token.');
  return _token;
}

/**
 * One authenticated call. A 401 means the token died early (a password change, a logout from
 * the panel): sign in again ONCE and repeat. A second 401 is a real failure and is thrown.
 */
async function call(method, path, body = null) {
  const token = await auth();
  try {
    return await module.exports._http(method, path, { body, token });
  } catch (e) {
    if (!e || e.status !== 401) throw e;
    _token = null; _tokenAt = 0;
    const fresh = await auth();
    return module.exports._http(method, path, { body, token: fresh });
  }
}

/* ───────────────────────────────────────────────────────── small things */

const num = (x, fallback = 0) => (Number.isFinite(Number(x)) ? Number(x) : fallback);
const round2 = (x) => Math.round(num(x) * 100) / 100;
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
/** Shiprocket wants "exactly 10 digits". INFLX stores +91XXXXXXXXXX. */
const phone10 = (p) => String(p == null ? '' : p).replace(/\D/g, '').slice(-10);
const pin6 = (p) => String(p == null ? '' : p).trim();
const isPin = (p) => /^\d{6}$/.test(pin6(p));
const idOf = (x) => (Number.isFinite(Number(x)) && String(x).trim() !== '' ? Number(x) : x);
/** Today's date in India, which is the day Shiprocket means by `order_date`. */
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * `shipments.provider_ref` holds BOTH of Shiprocket's ids as `shipment:order`, because they are
 * used by different calls: the label and the pickup want the shipment id, the cancel wants the
 * order id. A reference written before 6 Oct 2026 is a bare shipment id and reads as one.
 */
const makeRef = (shipmentId, orderId) => `${shipmentId == null ? '' : shipmentId}:${orderId == null ? '' : orderId}`;
function readRef(ref) {
  const [s, o] = String(ref == null ? '' : ref).split(':');
  return { shipmentId: s || null, orderId: o || null };
}

const lineTotal = (items) => round2((items || []).reduce(
  (s, i) => s + num(i.price_at_dispatch) * Math.max(1, num(i.quantity, 1)), 0));

/**
 * The items on an order. Shiprocket refuses an order whose item codes repeat ("SKU cannot be
 * repeated"), and one product in two sizes shares a code — so a repeat is numbered.
 */
function orderItems(items, shipment, value) {
  const seen = new Map();
  const out = (items || []).map((i) => {
    let sku = clip(i.sku_at_dispatch || i.product_id || i.id || 'ITEM', 50) || 'ITEM';
    const n = (seen.get(sku) || 0) + 1;
    seen.set(sku, n);
    if (n > 1) sku = `${sku.slice(0, 46)}-${n}`;
    return {
      name: clip(i.name_at_dispatch, 255) || 'Item',
      sku,
      units: Math.max(1, Math.round(num(i.quantity, 1))),
      selling_price: round2(i.price_at_dispatch),
    };
  });
  if (out.length) return out;
  // An order must carry at least one item. A caller that has none gets one honest line.
  return [{ name: 'Products', sku: `P-${String(shipment.id).slice(0, 8)}`, units: 1, selling_price: value }];
}

/** The value an order declares. Never zero — a courier will not carry a parcel worth nothing. */
const orderValue = (shipment, items) => {
  const v = round2(num(shipment.declared_value) || lineTotal(items));
  return v > 0 ? v : 1;
};

const dimsOf = (shipment) => ({
  length: num(shipment.box_l_cm), breadth: num(shipment.box_w_cm),
  height: num(shipment.box_h_cm), weight: num(shipment.weight_kg),
});

/* ───────────────────────────────────────────────────────── couriers and prices */

/**
 * The couriers that will carry this parcel, with their prices. One function for both
 * directions and for both questions ("can anyone?" and "for how much?"), so the courier the
 * brand was quoted is found the same way when the parcel is booked.
 *
 * "No courier serves it" is an ANSWER here, never an error — whether Shiprocket says so with
 * an empty list or with a 404.
 */
async function couriers({ pickupPincode, deliveryPincode, weightKg, box, declaredValue, isReturn = false }) {
  const q = new URLSearchParams();
  q.set('pickup_postcode', pin6(pickupPincode));
  q.set('delivery_postcode', pin6(deliveryPincode));
  q.set('weight', String(num(weightKg) > 0 ? num(weightKg) : 0.5));
  q.set('cod', '0');
  if (isReturn) q.set('is_return', '1');
  // The reference asks for the parcel's value on an outbound check, and not on a return.
  else q.set('declared_value', String(Math.max(0, round2(declaredValue))));
  const b = boxOf(box);
  if (b) { q.set('length', String(b.l)); q.set('breadth', String(b.w)); q.set('height', String(b.h)); }

  let d;
  try {
    d = await call('GET', `${API}/courier/serviceability/?${q.toString()}`);
  } catch (e) {
    if (e && e.status === 404) return [];
    throw e;
  }
  if (d && Number(d.status) === 404) return [];
  const list = d && d.data && Array.isArray(d.data.available_courier_companies)
    ? d.data.available_courier_companies : [];
  return list.filter((c) => c && !Number(c.blocked) && Number.isFinite(Number(c.rate)) && Number(c.rate) > 0);
}

const cheapest = (list) => list.reduce((a, b) => (Number(b.rate) < Number(a.rate) ? b : a));

/**
 * What the brand is shown. A whole rupee, rounded UP so INFLX never recovers less than it pays,
 * with GST inside it (approval Q7). `SHIPROCKET_RATES_EXCLUDE_GST` is the one place the "does
 * `rate` contain GST" answer lives once a real parcel has given it.
 */
function priceOf(c) {
  const raw = Number(c.rate);
  const gross = env.SHIPROCKET_RATES_EXCLUDE_GST ? raw * 1.18 : raw;
  const amount = Math.ceil(round2(gross));
  return {
    amount,
    gstAmount: round2((amount * 18) / 118),
    gstIncluded: true,
    currency: 'INR',
    courierHint: c.courier_name || null,
    courierId: c.courier_company_id == null ? null : c.courier_company_id,
  };
}

async function checkCoverage({ pickupPincode, deliveryPincode }) {
  // A store with no pincode yet cannot be asked about. Her own pincode stands in for it: what
  // decides both answers is whether couriers reach HER, and the brand's address is re-checked
  // at the quote and again at booking (remoteParcel).
  const origin = isPin(pickupPincode) ? pickupPincode : deliveryPincode;

  const out = await couriers({ pickupPincode: origin, deliveryPincode, weightKg: 0.5 });
  const delivers = out.length > 0;
  let returnPickup = false;
  if (delivers) {
    // Asked AS A RETURN, from her door. The outbound answer says nothing about whether a
    // courier will come to her to collect.
    const back = await couriers({ pickupPincode: deliveryPincode, deliveryPincode: origin, weightKg: 0.5, isReturn: true });
    returnPickup = back.length > 0;
  }
  return { delivers, returnPickup, checkedAt: new Date().toISOString() };
}

async function quote({ pickupPincode, deliveryPincode, weightKg, box, declaredValue, direction = 'outbound' }) {
  const list = await couriers({
    pickupPincode, deliveryPincode, weightKg, box, declaredValue, isReturn: direction === 'return',
  });
  if (!list.length) return null;                       // §2.3 — the caller falls back
  return priceOf(cheapest(list));
}

/* ───────────────────────────────────────────────────────── the store's pickup address */

/**
 * The code a store address is registered under — `pickup_location` on every order from it.
 *
 * Shiprocket requires it unique on the account, at most 36 characters, and refuses a code that
 * was ever used — including one on an address since deactivated. So it cannot be the store's
 * name (two brands both have a "Main Branch") and it cannot stay the same when the store moves.
 * It is the start of the name, for the person reading Shiprocket's panel, and a fingerprint of
 * the whole address, for uniqueness: the same address always gives the same code.
 */
function pickupCode({ name: n, phone, street, pincode, cityName, stateName }) {
  const slug = String(n || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || 'Store';
  const print = crypto.createHash('sha256')
    .update([n, phone, street, pincode, cityName, stateName].map((x) => String(x || '')).join('|'))
    .digest('hex').slice(0, 22);
  return `${slug}${print}`;
}

async function findPickup(code) {
  const d = await call('GET', `${API}/settings/company/pickup`);
  const list = (d && d.data && Array.isArray(d.data.shipping_address)) ? d.data.shipping_address : [];
  return list.find((p) => p && String(p.pickup_location) === code) || null;
}

/**
 * Returns the CODE as `providerPickupId`, because the code is what a booking needs — Shiprocket's
 * numeric id for the address is asked for by no call this adapter makes.
 */
async function registerPickup(address) {
  const code = pickupCode(address);
  // "At least 3 characters, and it must contain at least one letter."
  const cleaned = clip(String(address.name || '').replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' '), 60);
  const contact = cleaned.length >= 3 && /[A-Za-z]/.test(cleaned) ? cleaned : `Store ${cleaned}`.trim();

  try {
    const d = await call('POST', `${API}/settings/company/addpickup`, {
      pickup_location: code,
      name: contact,
      email: 'ops@inflx.in',
      phone: phone10(address.phone),
      // 10 to 190 characters, and it must contain a house, flat or road number.
      address: clip(address.street, 190),
      city: clip(address.cityName, 50),
      state: clip(address.stateName, 50),
      country: 'India',
      pin_code: pin6(address.pincode),
    });
    const saved = (d && d.address) || {};
    if (saved.phone_verified === 0) {
      // Live question (a): nobody yet knows whether this blocks a pickup. Said where it is read.
      console.warn(`[shiprocket] pickup ${code} was added with an UNVERIFIED phone — Shiprocket may ask the store to verify it.`);
    }
  } catch (e) {
    // The same address registered before (a lost row, a second server): Shiprocket refuses the
    // code as already used. If it holds it, that is the registration we wanted.
    if (!e || (e.status !== 400 && e.status !== 422)) throw e;
    const held = await findPickup(code);
    if (!held) throw e;
  }
  return { providerPickupId: code };
}

/* ───────────────────────────────────────────────────────── booking */

/**
 * Ask for the tracking number. THE ONE REPLY THAT LIES: Shiprocket answers HTTP 200 for an
 * empty wallet and for a courier that refuses, with `awb_assign_status: 0` inside. Reading the
 * status code alone books a parcel that does not exist.
 */
async function assign(shipmentId, { isReturn = false, courierId = null } = {}) {
  const body = { shipment_id: idOf(shipmentId), is_return: isReturn ? 1 : 0 };
  if (courierId != null) body.courier_id = courierId;

  const d = await call('POST', `${API}/courier/assign/awb`, body);
  const data = (d && d.response && d.response.data) || {};
  if (Number(d && d.awb_assign_status) === 1 && data.awb_code) return data;

  const why = String((d && d.message) || data.awb_assign_error
    || (d && d.response && d.response.action_required) || 'no reason given').slice(0, 240);
  const wallet = Number(d && d.status_code) === 350 || /recharge|wallet/i.test(why);
  throw new ShippingError(
    wallet ? 'SHIPROCKET_WALLET' : 'SHIPROCKET_AWB',
    wallet ? `The INFLX Shiprocket wallet needs a recharge — ${why}`
      : `Shiprocket could not assign a courier — ${why}`);
}

/**
 * The cheapest courier first — the one whose price the brand was shown. If THAT courier refuses
 * for its own reasons, Shiprocket's own choice is tried once rather than failing a booking a
 * second courier would have taken. An empty wallet is not retried: no courier fixes that.
 */
async function assignCheapest(shipmentId, route, { isReturn = false } = {}) {
  let pick = null;
  try {
    const list = await couriers({ ...route, isReturn });
    pick = list.length ? cheapest(list) : null;
  } catch (e) {
    console.error('[shiprocket] courier lookup failed before assignment:', e.message);
  }
  const chosen = pick && pick.courier_company_id != null ? pick.courier_company_id : null;
  try {
    return await assign(shipmentId, { isReturn, courierId: chosen });
  } catch (e) {
    if (chosen == null || !e || e.code !== 'SHIPROCKET_AWB') throw e;
    return assign(shipmentId, { isReturn });
  }
}

/** Take back an order Shiprocket created for a booking that then failed. Never throws. */
async function abandon(orderId) {
  if (orderId == null) return;
  try { await call('POST', `${API}/orders/cancel`, { ids: [idOf(orderId)] }); }
  catch (e) { console.error('[shiprocket] could not cancel the half-made order', orderId, e.message); }
}

/**
 * Ask the courier to come. Not fatal: a pickup that cannot be generated yet is not a failed
 * booking — the tracking number exists and the request can be repeated from Shiprocket's panel.
 */
async function requestPickup(shipmentId, day = null) {
  const body = { shipment_id: [idOf(shipmentId)] };
  if (day) body.pickup_date = [String(day).slice(0, 10)];
  try { return await call('POST', `${API}/courier/generate/pickup`, body); }
  catch (e) {
    console.error('[shiprocket] pickup request failed for shipment', shipmentId, e.message);
    return null;
  }
}

const channel = () => (env.SHIPROCKET_CHANNEL_ID ? { channel_id: idOf(env.SHIPROCKET_CHANNEL_ID) } : {});

async function book(shipment, { pickupLocationName, items = [] } = {}) {
  const value = orderValue(shipment, items);
  const order = await call('POST', `${API}/orders/create/adhoc`, {
    order_id: String(shipment.id),
    order_date: todayIST(),
    pickup_location: pickupLocationName,
    ...channel(),
    billing_customer_name: clip(shipment.to_name, 60) || 'Customer',
    billing_last_name: '',                    // a required KEY; the value may be empty
    billing_address: clip(shipment.to_street, 190),
    billing_city: clip(shipment.to_city_name, 50),
    billing_pincode: pin6(shipment.to_pincode),
    billing_state: clip(shipment.to_state_name, 50),
    billing_country: 'India',
    billing_email: 'creators@inflx.in',
    billing_phone: phone10(shipment.to_phone),
    shipping_is_billing: true,
    order_items: orderItems(items, shipment, value),
    payment_method: 'Prepaid',
    sub_total: value,
    ...dimsOf(shipment),
  });

  const shipmentId = order && order.shipment_id;
  const orderId = order && order.order_id;
  if (!shipmentId) {
    throw new ShippingError('SHIPROCKET_ORDER',
      `Shiprocket did not create the order — ${JSON.stringify(order || {}).slice(0, 240)}`);
  }

  let awb;
  if (order.awb_code) {
    // The account auto-assigns on creation. Asking again is refused as "Awb already assigned".
    awb = { awb_code: order.awb_code, courier_name: order.courier_name };
  } else {
    try {
      awb = await assignCheapest(shipmentId, {
        pickupPincode: shipment.from_pincode, deliveryPincode: shipment.to_pincode,
        weightKg: shipment.weight_kg, declaredValue: value,
        box: { l: shipment.box_l_cm, w: shipment.box_w_cm, h: shipment.box_h_cm },
      });
    } catch (e) {
      await abandon(orderId);
      throw e;
    }
  }

  await requestPickup(shipmentId);
  return {
    courierName: awb.courier_name || null,
    trackingNumber: String(awb.awb_code),
    providerRef: makeRef(shipmentId, orderId),
  };
}

/**
 * FROM her door TO the store. The store's address is written on the order — a return needs no
 * registered pickup location. `items` are the lines going back; without them Shiprocket refuses
 * the order.
 */
async function bookReturn(shipment, { pickupDay = null, items = [] } = {}) {
  const value = orderValue(shipment, items);
  const order = await call('POST', `${API}/orders/create/return`, {
    order_id: `${shipment.id}-R`,
    order_date: todayIST(),                   // when the ORDER was made; the pickup day goes below
    ...channel(),
    pickup_customer_name: clip(shipment.from_name, 60) || 'Customer',
    pickup_last_name: '',
    pickup_address: clip(shipment.from_street, 190),
    pickup_city: clip(shipment.from_city_name, 30),
    pickup_state: clip(shipment.from_state_name, 50),
    pickup_country: 'India',
    pickup_pincode: pin6(shipment.from_pincode),
    pickup_email: 'creators@inflx.in',
    pickup_phone: phone10(shipment.from_phone),
    shipping_customer_name: clip(shipment.to_name, 60) || 'Store',
    shipping_last_name: '',
    shipping_address: clip(shipment.to_street, 190),
    shipping_city: clip(shipment.to_city_name, 30),
    shipping_state: clip(shipment.to_state_name, 50),
    shipping_country: 'India',
    shipping_pincode: pin6(shipment.to_pincode),
    shipping_email: 'ops@inflx.in',
    shipping_phone: phone10(shipment.to_phone),
    order_items: orderItems(items, shipment, value),
    payment_method: 'Prepaid',
    sub_total: value,
    ...dimsOf(shipment),
  });

  const shipmentId = order && order.shipment_id;
  const orderId = order && order.order_id;
  if (!shipmentId) {
    throw new ShippingError('SHIPROCKET_ORDER',
      `Shiprocket did not create the return — ${JSON.stringify(order || {}).slice(0, 240)}`);
  }

  let awb;
  try {
    awb = await assignCheapest(shipmentId, {
      pickupPincode: shipment.from_pincode, deliveryPincode: shipment.to_pincode,
      weightKg: shipment.weight_kg,
      box: { l: shipment.box_l_cm, w: shipment.box_w_cm, h: shipment.box_h_cm },
    }, { isReturn: true });
  } catch (e) {
    await abandon(orderId);
    throw e;
  }

  await requestPickup(shipmentId, pickupDay);
  return {
    courierName: awb.courier_name || null,
    trackingNumber: String(awb.awb_code),
    providerRef: makeRef(shipmentId, orderId),
  };
}

/**
 * Cancel by SHIPROCKET's order id, which sweeps the courier's side too. A parcel booked before
 * the order id was kept cancels by its tracking number instead.
 *
 * THIS THROWS WHEN SHIPROCKET REFUSES. The caller must not refund a courier that is still
 * coming.
 */
async function cancel(shipment) {
  await auth();
  const { orderId } = readRef(shipment && shipment.provider_ref);
  const tracking = shipment && shipment.tracking_number;
  if (orderId) {
    await call('POST', `${API}/orders/cancel`, { ids: [idOf(orderId)] });
  } else if (tracking) {
    await call('POST', `${API}/orders/cancel/shipment/awbs`, { awbs: [String(tracking)] });
  } else {
    throw new ShippingError('NOT_BOOKED', 'There is nothing booked with Shiprocket to cancel.');
  }
  return { cancelled: true };
}

async function label(shipment) {
  await auth();
  const { shipmentId } = readRef(shipment && shipment.provider_ref);
  if (!shipmentId) throw new ShippingError('NO_LABEL', 'This parcel has no Shiprocket shipment to print a label for.');
  const d = await call('POST', `${API}/courier/generate/label`, { shipment_id: [idOf(shipmentId)] });
  const url = d && d.label_url;
  if (!url || Number(d.label_created) === 0) {
    throw new ShippingError('NO_LABEL', `Shiprocket returned no label — ${String((d && (d.message || d.response)) || '').slice(0, 200)}`);
  }
  return { buffer: await module.exports._download(url), contentType: 'application/pdf' };
}

/* ───────────────────────────────────────────────────────── weight differences */

/**
 * Shiprocket does not push a weight difference; it lists them (the last seven days by default).
 * Each row becomes one update the daily job hands to the SAME webhook handler everything else
 * goes through, keyed on Shiprocket's own row id so a difference read on two days is one charge.
 *
 * THE AMOUNT is what the parcel was charged on the weight the courier measured, less what it
 * was charged on the weight we declared. That reading is the reference's, not yet a real
 * case's — watch the first one.
 */
async function weightCharges() {
  const d = await call('GET', `${API}/billing/discrepancy`);
  const rows = (d && Array.isArray(d.data)) ? d.data : [];
  return rows
    .map((r) => ({
      trackingNumber: r && r.awb_code ? String(r.awb_code) : null,
      amount: round2(num(r && r.total_charged_amount) - num(r && r.total_applied_amount)),
      providerEventId: `weight:${r && (r.id != null ? r.id : r.awb_code)}`,
      occurredAt: new Date().toISOString(),
      reason: r && r.charged_weight != null && r.applied_weight != null
        ? `The courier weighed it at ${num(r.charged_weight)} kg; it was booked as ${num(r.applied_weight)} kg`
        : 'The courier measured a heavier parcel than was booked',
      payload: r,
    }))
    .filter((x) => x.trackingNumber && x.amount > 0);
}

/* ───────────────────────────────────────────────────────── the webhook side */

/**
 * Shiprocket's webhook carries the secret word typed into Settings → API → Webhooks, in the
 * `x-api-key` header — a shared secret, not a signature. Compared in constant time. An HMAC of
 * the raw body is accepted too, for the day they offer one. It fails closed: with no secret
 * configured, nothing is accepted.
 */
function verifySignature(rawBody, headers) {
  const secret = env.SHIPROCKET_WEBHOOK_SECRET;
  if (!secret) return false;
  const given = String(headers['x-api-key'] || headers['x-shiprocket-signature'] || '');
  if (!given) return false;
  const a = Buffer.from(given);
  const shared = Buffer.from(secret);
  if (a.length === shared.length && crypto.timingSafeEqual(a, shared)) return true;
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Shiprocket's clock, read as India time. Its webhook writes `23 05 2023 11:43:52` (day month
 * year), its other fields `2023-05-19 11:59:16`; neither names a zone and `new Date()` reads
 * the first as nonsense. Returns an ISO string, or null when it is not a time at all.
 */
function parseTime(x) {
  if (x == null || x === '') return null;
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? null : x.toISOString();
  if (typeof x === 'object' && x.date) return parseTime(x.date);
  const s = String(x).trim();
  let m = s.match(/^(\d{2})[ /-](\d{2})[ /-](\d{4})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) return ist(m[3], m[2], m[1], m[4], m[5], m[6]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (m) return ist(m[1], m[2], m[3], m[4], m[5], m[6]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function ist(y, mo, d, h, mi, se) {
  const t = new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}+05:30`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/** Shiprocket's status words → the seven INFLX events, for a parcel going OUT. */
const STATUS_MAP = Object.freeze({
  'PICKED UP': EVENTS.COLLECTED,
  'SHIPPED': EVENTS.COLLECTED,
  // A missed "picked up" must not leave a moving parcel uncollected. Forward-only state makes
  // the repeats harmless: each is recorded, only the first moves anything.
  'IN TRANSIT': EVENTS.COLLECTED,
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

/**
 * …and for a parcel coming BACK. On a return, the attempt that fails is the PICKUP at her door.
 * (On the way out a failed pickup is the store's courier not turning up — the creator must not
 * be told her delivery failed — so those words are deliberately absent from the map above.)
 */
const RETURN_STATUS_MAP = Object.freeze({
  'PICKED UP': EVENTS.COLLECTED,
  'SHIPPED': EVENTS.COLLECTED,
  'IN TRANSIT': EVENTS.COLLECTED,
  'OUT FOR DELIVERY': EVENTS.OUT_FOR_DELIVERY,
  'DELIVERED': EVENTS.DELIVERED,
  'PICKUP EXCEPTION': EVENTS.ATTEMPT_FAILED,
  'PICKUP ERROR': EVENTS.ATTEMPT_FAILED,
  'UNDELIVERED': EVENTS.ATTEMPT_FAILED,
  'CANCELED': EVENTS.CANCELLED,
  'CANCELLED': EVENTS.CANCELLED,
});

/** One provider payload → zero or one INFLX event. Pure; the handler persists. */
function parseWebhook(payload) {
  const p = payload || {};
  let status = String(p.current_status || p.shipment_status || p.status || '').trim().toUpperCase().replace(/[_\s]+/g, ' ');
  const prefixed = status.startsWith('RETURN ');
  const isReturn = prefixed || Number(p.is_return) === 1;
  if (prefixed) status = status.slice('RETURN '.length);

  const event = (isReturn ? RETURN_STATUS_MAP : STATUS_MAP)[status] || null;
  if (!event) return null;

  const scans = Array.isArray(p.scans) ? p.scans : [];
  const last = scans.length ? scans[scans.length - 1] : null;
  const reason = p.status_detail || p.remark || p.reason
    || (event === EVENTS.ATTEMPT_FAILED && last && last.activity) || null;

  return {
    event,
    trackingNumber: p.awb || p.awb_code ? String(p.awb || p.awb_code) : null,
    occurredAt: parseTime(p.current_timestamp || p.timestamp) || (last && parseTime(last.date)) || new Date().toISOString(),
    // Shiprocket sends no event id. The handler's own key — shipment, event, the moment — is
    // stable because the moment is parsed, not "now".
    providerEventId: p.id ? `${p.id}:${status}` : null,
    amount: p.charged_weight_amount != null ? Number(p.charged_weight_amount) : null,
    reason: reason ? String(reason).slice(0, 200) : null,
    isReturn,
  };
}

/** For tests: forget the cached token. */
function _resetToken() { _token = null; _tokenAt = 0; }

module.exports = {
  name, checkCoverage, quote, registerPickup, book, bookReturn, cancel, label,
  weightCharges,
  verifySignature, parseWebhook, parseTime, pickupCode, STATUS_MAP, RETURN_STATUS_MAP,
  _http,          // replaceable in tests, so "no call is made" is provable
  _download, _resetToken,
};
