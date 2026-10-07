'use strict';

/**
 * The Shiprocket connector, against the shapes Shiprocket's published reference documents.
 * Contract: features/shiprocket-connector-repair · checks 1–24, 27
 *
 * NO CALL LEAVES THIS MACHINE. Shiprocket is replaced at the connector's own transport
 * (`shiprocket._http`) by a stand-in that answers the way the reference says the real one does.
 * What is proved is therefore what INFLX SENDS and how it READS the reply — which is exactly
 * what the first version of this connector got wrong. What it cannot prove is that Shiprocket
 * behaves as its reference says; that is what the first real parcel is for.
 *
 * The second half drives item 11 through its real HTTP routes with the platform switched to
 * the real courier, so the booking, the tracking updates, the return and the two refusals are
 * proved through the same code a brand's and a creator's phone reach.
 */

const { query, api } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const env = require('../src/config/env');
const { todayInIndia, addDays } = require('../src/utils/indiaDay');
const shiprocket = require('../src/services/shipping/shiprocket');
const { EVENTS } = require('../src/services/shipping/contract');
const weightJob = require('../src/jobs/shipping-weight-sync.job');

/* ─────────────────────────────────────────────────────── the stand-in */

// A tracking number is unique in the real world, and the webhook finds a parcel by it — so each
// stand-in hands out its own pair. (The suite shares one database across its tests.)
let seq = 0;

const COURIERS = [
  { courier_company_id: 10, courier_name: 'Delhivery Surface', rate: 82.6, blocked: 0 },
  { courier_company_id: 142, courier_name: 'Amazon Surface', rate: 71.2, blocked: 0 },
  { courier_company_id: 7, courier_name: 'Cheap But Blocked', rate: 40, blocked: 1 },
];

/** A refusal shaped like the transport's own: an error carrying the HTTP status and body. */
const httpError = (status, body = {}) =>
  Object.assign(new Error(`Shiprocket → ${status}: ${JSON.stringify(body)}`), { status, body, code: 'SHIPROCKET_ERROR' });

/** Every reply below is the reference's documented success shape for that operation. */
const DOCUMENTED = {
  'POST /auth/login': () => ({ token: 'tok-1' }),
  'GET /courier/serviceability/': () => ({ data: { available_courier_companies: COURIERS } }),
  'POST /settings/company/addpickup': ({ body }) => ({
    success: true, pickup_id: 1856901,
    address: { id: 1856901, pickup_code: body.pickup_location, phone_verified: 1, status: 1 },
  }),
  'GET /settings/company/pickup': () => ({ data: { shipping_address: [] } }),
  'POST /orders/create/adhoc': () => ({
    order_id: 16161616, shipment_id: 15151515, status: 'NEW', status_code: 1,
    awb_code: null, courier_company_id: null, courier_name: null,
  }),
  'POST /orders/create/return': () => ({
    order_id: 170872392, shipment_id: 170411259, status: 'RETURN PENDING', status_code: 21,
  }),
  'POST /courier/assign/awb': ({ body }) => ({
    awb_assign_status: 1,
    response: { data: {
      courier_company_id: body.courier_id || 142, courier_name: 'Amazon Surface',
      awb_code: body.is_return ? live.RET : live.OUT, shipment_id: body.shipment_id,
    } },
  }),
  'POST /courier/generate/pickup': () => ({ pickup_status: 1, response: { pickup_scheduled_date: '2026-10-07 14:00:00' } }),
  'POST /courier/generate/label': () => ({ label_created: 1, label_url: 'https://files.example/label.pdf' }),
  'POST /orders/cancel': () => ({ status_code: 200, message: 'Order cancelled successfully.' }),
  'POST /orders/cancel/shipment/awbs': () => ({ message: 'Bulk Shipment cancellation is in progress. Please wait for some time.' }),
  'GET /billing/discrepancy': () => ({ status: 200, data: [] }),
};

let live = null;

/** Replace Shiprocket. `on(key, fn)` rescripts one operation; `of(key)` lists the calls to it. */
function fakeShiprocket(script = {}) {
  const calls = [];
  const handlers = { ...DOCUMENTED, ...script };
  const real = { http: shiprocket._http, download: shiprocket._download };
  shiprocket._resetToken();
  shiprocket._http = async (method, path, opts = {}) => {
    const [route, qs] = path.split('?');
    const key = `${method} ${route.replace('/v1/external', '')}`;
    const call = { key, method, path, body: (opts && opts.body) || null, token: (opts && opts.token) || null, query: new URLSearchParams(qs || '') };
    calls.push(call);
    const h = handlers[key];
    if (!h) throw new Error(`unscripted Shiprocket call: ${key}`);
    return h(call, calls);
  };
  shiprocket._download = async () => Buffer.from('%PDF-1.4 stand-in label');
  seq += 1;
  const stamp = `${String(Date.now()).slice(-6)}${String(seq).padStart(3, '0')}`;
  live = {
    OUT: `321${stamp}`,
    RET: `788${stamp}`,
    calls,
    on: (key, fn) => { handlers[key] = fn; },
    of: (key) => calls.filter((c) => c.key === key),
    restore: () => { shiprocket._http = real.http; shiprocket._download = real.download; shiprocket._resetToken(); },
  };
  return live;
}

/** The response, or an error that says what the server actually answered. */
const must = (r, status) => {
  if (r.status !== status) throw new Error(`expected ${status}, got ${r.status}: ${JSON.stringify(r.body)}`);
  return r;
};

const WAS = {
  provider: env.SHIPPING_PROVIDER, enabled: env.SHIPROCKET_ENABLED,
  secret: env.SHIPROCKET_WEBHOOK_SECRET, gst: env.SHIPROCKET_RATES_EXCLUDE_GST,
};
afterEach(() => {
  if (live) { live.restore(); live = null; }
  env.SHIPPING_PROVIDER = WAS.provider;
  env.SHIPROCKET_ENABLED = WAS.enabled;
  env.SHIPROCKET_WEBHOOK_SECRET = WAS.secret;
  env.SHIPROCKET_RATES_EXCLUDE_GST = WAS.gst;
});

/* ─────────────────────────────────────────────────────── a parcel, as item 11 hands it over */

const PARCEL = {
  id: '0b1c2d3e-4f50-4a61-8b72-9c8d0e1f2a3b',
  from_name: 'Kanchi Silks', from_phone: '+919876500000',
  from_street: 'Road No. 12, Banjara Hills', from_pincode: '500034',
  from_city_name: 'Hyderabad', from_state_name: 'Telangana',
  to_name: 'Tanvi Suresh', to_phone: '+91 98765 11111',
  to_street: '11 Gandhi Road, Brodipet', to_pincode: '522002',
  to_city_name: 'Guntur', to_state_name: 'Andhra Pradesh',
  box_l_cm: 35, box_w_cm: 25, box_h_cm: 10, weight_kg: 1.2, declared_value: 4800,
};
// The same saree in two sizes: one product, one code, two lines.
const LINES = [
  { name_at_dispatch: 'Indigo Chanderi Saree', sku_at_dispatch: 'SKU-A1', quantity: 1, price_at_dispatch: 2400 },
  { name_at_dispatch: 'Indigo Chanderi Saree', sku_at_dispatch: 'SKU-A1', quantity: 1, price_at_dispatch: 2400 },
];

// "Required fields", copied from the reference's two operation pages.
const OUTBOUND_REQUIRED = ['order_id', 'order_date', 'payment_method', 'sub_total', 'shipping_is_billing',
  'billing_customer_name', 'billing_last_name', 'billing_address', 'billing_state', 'billing_country',
  'billing_pincode', 'billing_phone', 'order_items', 'pickup_location', 'billing_city', 'billing_email',
  'length', 'breadth', 'height', 'weight'];
const RETURN_REQUIRED = ['order_id', 'order_date', 'pickup_customer_name', 'pickup_address', 'pickup_city',
  'pickup_state', 'pickup_country', 'pickup_pincode', 'pickup_phone', 'shipping_customer_name',
  'shipping_address', 'shipping_city', 'shipping_country', 'shipping_pincode', 'shipping_state',
  'shipping_phone', 'order_items', 'payment_method', 'sub_total', 'length', 'breadth', 'height', 'weight',
  'pickup_email'];

/* ═════════════════════════════════════════ coverage and price (checks 1–4) */

describe('coverage and price', () => {
  it('1 · "delivers" is asked store → her; "can collect a return" is asked her → store, AS A RETURN', async () => {
    const f = fakeShiprocket();
    const out = await shiprocket.checkCoverage({ pickupPincode: '500034', deliveryPincode: '522002' });
    expect(out).toMatchObject({ delivers: true, returnPickup: true });

    const [fwd, back] = f.of('GET /courier/serviceability/');
    expect(fwd.query.get('pickup_postcode')).toBe('500034');
    expect(fwd.query.get('delivery_postcode')).toBe('522002');
    expect(fwd.query.get('is_return')).toBeNull();
    expect(back.query.get('pickup_postcode')).toBe('522002');     // from HER door
    expect(back.query.get('delivery_postcode')).toBe('500034');
    expect(back.query.get('is_return')).toBe('1');
  });

  it('1 · couriers that deliver but will not collect is a "no" to the return only', async () => {
    fakeShiprocket({
      'GET /courier/serviceability/': (c) => ({ data: { available_courier_companies: c.query.get('is_return') ? [] : COURIERS } }),
    });
    expect(await shiprocket.checkCoverage({ pickupPincode: '500034', deliveryPincode: '522002' }))
      .toMatchObject({ delivers: true, returnPickup: false });
  });

  it('2 · a pincode no courier serves is "no" — whether Shiprocket says so with an empty list or a 404', async () => {
    fakeShiprocket({ 'GET /courier/serviceability/': () => ({ data: { available_courier_companies: [] } }) });
    expect(await shiprocket.checkCoverage({ pickupPincode: '500034', deliveryPincode: '799999' }))
      .toMatchObject({ delivers: false, returnPickup: false });

    live.restore();
    fakeShiprocket({ 'GET /courier/serviceability/': () => { throw httpError(404, { message: 'Delivery postcode not serviceable' }); } });
    expect(await shiprocket.checkCoverage({ pickupPincode: '500034', deliveryPincode: '799999' }))
      .toMatchObject({ delivers: false, returnPickup: false });
    expect(await shiprocket.quote({ pickupPincode: '500034', deliveryPincode: '799999', weightKg: 1 })).toBeNull();
  });

  it('2 · any OTHER refusal is still an error — a broken connection is not "not deliverable"', async () => {
    fakeShiprocket({ 'GET /courier/serviceability/': () => { throw httpError(500, { message: 'Plan ID not found' }); } });
    await expect(shiprocket.checkCoverage({ pickupPincode: '500034', deliveryPincode: '522002' })).rejects.toThrow(/500/);
  });

  it('3 · a price check sends the weight, the box and the value — and never picks a blocked courier', async () => {
    const f = fakeShiprocket();
    const q = await shiprocket.quote({
      pickupPincode: '500034', deliveryPincode: '522002', weightKg: 1.2,
      box: { preset: 'medium' }, declaredValue: 4800,
    });
    const [c] = f.of('GET /courier/serviceability/');
    expect(c.query.get('weight')).toBe('1.2');
    expect(c.query.get('cod')).toBe('0');
    expect(c.query.get('declared_value')).toBe('4800');
    expect([c.query.get('length'), c.query.get('breadth'), c.query.get('height')]).toEqual(['35', '25', '10']);
    // ₹40 was the lowest price on the list — and it is blocked.
    expect(q.courierHint).toBe('Amazon Surface');
    expect(q.courierId).toBe(142);
  });

  it('4 · the price is the cheapest, rounded UP to a rupee, with the GST shown inside it', async () => {
    fakeShiprocket();
    const q = await shiprocket.quote({ pickupPincode: '500034', deliveryPincode: '522002', weightKg: 1 });
    expect(q).toMatchObject({ amount: 72, gstIncluded: true, currency: 'INR' });      // 71.20 → 72
    expect(q.gstAmount).toBe(10.98);                                                   // 72 × 18 / 118
  });

  it('4 · with SHIPROCKET_RATES_EXCLUDE_GST on, 18% is added before the brand sees a price', async () => {
    fakeShiprocket();
    env.SHIPROCKET_RATES_EXCLUDE_GST = true;
    const q = await shiprocket.quote({ pickupPincode: '500034', deliveryPincode: '522002', weightKg: 1 });
    expect(q.amount).toBe(85);                                                         // 71.20 × 1.18 = 84.016 → 85
  });

  it('3 · a return is priced as a return', async () => {
    const f = fakeShiprocket();
    await shiprocket.quote({ pickupPincode: '522002', deliveryPincode: '500034', weightKg: 1.2, direction: 'return' });
    expect(f.of('GET /courier/serviceability/')[0].query.get('is_return')).toBe('1');
  });
});

/* ═════════════════════════════════════════ the store (checks 5, 6) */

describe('registering a store', () => {
  const STORE = { name: 'Main Branch', phone: '+919876500000', street: 'Road No. 12, Banjara Hills', pincode: '500034', cityName: 'Hyderabad', stateName: 'Telangana' };

  it('5 · the code is short, plain, the same for the same address and different for any other', () => {
    const a = shiprocket.pickupCode(STORE);
    expect(a).toMatch(/^[A-Za-z0-9]{1,36}$/);
    expect(shiprocket.pickupCode({ ...STORE })).toBe(a);
    // Another brand's "Main Branch", in another street.
    expect(shiprocket.pickupCode({ ...STORE, street: '4 MG Road', pincode: '520010' })).not.toBe(a);
    // The same store, moved.
    expect(shiprocket.pickupCode({ ...STORE, street: 'Road No. 14, Banjara Hills' })).not.toBe(a);
    // A name far past the limit still gives a legal code.
    expect(shiprocket.pickupCode({ ...STORE, name: 'Sri Venkateswara Handloom Silks & Sarees Emporium (Flagship)' }))
      .toMatch(/^[A-Za-z0-9]{1,36}$/);
  });

  it('6 · registering sends that code, a 10-digit phone and an address within the limit', async () => {
    const f = fakeShiprocket();
    const long = `Shop 14, ${'Very Long Lane Name '.repeat(20)}`;
    const out = await shiprocket.registerPickup({ ...STORE, street: long });
    const [c] = f.of('POST /settings/company/addpickup');
    expect(out.providerPickupId).toBe(c.body.pickup_location);
    expect(c.body.pickup_location).toBe(shiprocket.pickupCode({ ...STORE, street: long }));
    expect(c.body.phone).toBe('9876500000');
    expect(c.body.address.length).toBeLessThanOrEqual(190);
    expect(c.body).toMatchObject({ city: 'Hyderabad', state: 'Telangana', country: 'India', pin_code: '500034' });
    expect(c.body.name.length).toBeGreaterThanOrEqual(3);
    expect(c.body.email).toMatch(/@/);
  });

  it('6 · a code Shiprocket already holds is reused, not a failure', async () => {
    const code = shiprocket.pickupCode(STORE);
    fakeShiprocket({
      'POST /settings/company/addpickup': () => { throw httpError(422, { message: 'Address nick name already in use' }); },
      'GET /settings/company/pickup': () => ({ data: { shipping_address: [{ id: 9, pickup_location: code, phone_verified: 1 }] } }),
    });
    expect((await shiprocket.registerPickup(STORE)).providerPickupId).toBe(code);
  });

  it('6 · …but a refusal for any other reason is not swallowed', async () => {
    fakeShiprocket({
      'POST /settings/company/addpickup': () => { throw httpError(422, { message: 'Not a valid mobile number' }); },
    });
    await expect(shiprocket.registerPickup(STORE)).rejects.toThrow(/valid mobile/);
  });
});

/* ═════════════════════════════════════════ booking (checks 7–10) */

describe('booking the outbound parcel', () => {
  it('7 · the order carries every field the reference marks required', async () => {
    const f = fakeShiprocket();
    await shiprocket.book(PARCEL, { pickupLocationName: 'KanchiSilk0123456789abcdef', items: LINES });
    const [{ body }] = f.of('POST /orders/create/adhoc');

    for (const k of OUTBOUND_REQUIRED) expect(body).toHaveProperty(k);
    for (const k of OUTBOUND_REQUIRED.filter((x) => x !== 'billing_last_name')) {
      expect(body[k] === '' || body[k] == null).toBe(false);
    }
    expect(body.billing_last_name).toBe('');                 // a required KEY; the value may be empty
    expect(body.billing_phone).toBe('9876511111');           // "+91 98765 11111" → exactly ten digits
    expect(body.billing_phone).toMatch(/^\d{10}$/);
    expect(body.pickup_location).toBe('KanchiSilk0123456789abcdef');
    expect(body.payment_method).toBe('Prepaid');
    expect(body.sub_total).toBe(4800);
    expect(body).toMatchObject({ length: 35, breadth: 25, height: 10, weight: 1.2 });
    expect(body.order_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('7 · an item code is never repeated — one product in two sizes is two lines, two codes', async () => {
    const f = fakeShiprocket();
    await shiprocket.book(PARCEL, { pickupLocationName: 'X', items: LINES });
    const skus = f.of('POST /orders/create/adhoc')[0].body.order_items.map((i) => i.sku);
    expect(skus).toEqual(['SKU-A1', 'SKU-A1-2']);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it('8 · the cheapest courier is the one asked, and both of Shiprocket’s ids come back', async () => {
    const f = fakeShiprocket();
    const out = await shiprocket.book(PARCEL, { pickupLocationName: 'X', items: LINES });
    const [a] = f.of('POST /courier/assign/awb');
    expect(a.body).toEqual({ shipment_id: 15151515, is_return: 0, courier_id: 142 });
    expect(out).toEqual({ courierName: 'Amazon Surface', trackingNumber: f.OUT, providerRef: '15151515:16161616' });
    expect(f.of('POST /courier/generate/pickup')[0].body).toEqual({ shipment_id: [15151515] });
  });

  it('9 · "OK" with no tracking number — an empty wallet — is a FAILURE, and the order is taken back', async () => {
    const f = fakeShiprocket({
      // HTTP 200, exactly as the reference documents it.
      'POST /courier/assign/awb': () => ({
        awb_assign_status: 0, status_code: 350,
        message: 'Please recharge your ShipRocket wallet. The minimum required balance is Rs 100',
      }),
    });
    await expect(shiprocket.book(PARCEL, { pickupLocationName: 'X', items: LINES }))
      .rejects.toMatchObject({ code: 'SHIPROCKET_WALLET' });
    expect(f.of('POST /orders/cancel')[0].body).toEqual({ ids: [16161616] });
    expect(f.of('POST /courier/assign/awb')).toHaveLength(1);       // no courier fixes an empty wallet
    expect(f.of('POST /courier/generate/pickup')).toHaveLength(0);
  });

  it('10 · the chosen courier refusing is retried once with Shiprocket’s own choice', async () => {
    let n = 0;
    const f = fakeShiprocket({
      'POST /courier/assign/awb': (c) => {
        n += 1;
        if (n === 1) return { awb_assign_status: 0, response: { data: { courier_id: 142, awb_assign_error: 'Pincode not serviceable by this courier' } } };
        return DOCUMENTED['POST /courier/assign/awb'](c);
      },
    });
    const out = await shiprocket.book(PARCEL, { pickupLocationName: 'X', items: LINES });
    const [first, second] = f.of('POST /courier/assign/awb');
    expect(first.body.courier_id).toBe(142);
    expect(second.body).toEqual({ shipment_id: 15151515, is_return: 0 });
    expect(out.trackingNumber).toBe(f.OUT);
    expect(f.of('POST /orders/cancel')).toHaveLength(0);
  });

  it('an order Shiprocket did not create is an error, not a booking', async () => {
    fakeShiprocket({ 'POST /orders/create/adhoc': () => ({ message: 'Wrong Pickup location entered', data: [] }) });
    await expect(shiprocket.book(PARCEL, { pickupLocationName: 'X', items: LINES }))
      .rejects.toMatchObject({ code: 'SHIPROCKET_ORDER' });
  });

  it('the label is asked for by Shiprocket’s shipment id', async () => {
    const f = fakeShiprocket();
    const pdf = await shiprocket.label({ provider_ref: '15151515:16161616' });
    expect(f.of('POST /courier/generate/label')[0].body).toEqual({ shipment_id: [15151515] });
    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.buffer.toString()).toMatch(/^%PDF/);
  });
});

/* ═════════════════════════════════════════ cancel (check 11) */

describe('cancelling', () => {
  it('11 · cancel sends Shiprocket’s ORDER number', async () => {
    const f = fakeShiprocket();
    await shiprocket.cancel({ provider_ref: '15151515:16161616', tracking_number: f.OUT });
    expect(f.of('POST /orders/cancel')[0].body).toEqual({ ids: [16161616] });
    expect(f.of('POST /orders/cancel/shipment/awbs')).toHaveLength(0);
  });

  it('11 · a parcel booked before the order number was kept cancels by its tracking number', async () => {
    const f = fakeShiprocket();
    await shiprocket.cancel({ provider_ref: '15151515', tracking_number: f.OUT });
    expect(f.of('POST /orders/cancel/shipment/awbs')[0].body).toEqual({ awbs: [f.OUT] });
  });

  it('11 · a refusal is thrown, so the caller cannot refund a courier that is still coming', async () => {
    fakeShiprocket({ 'POST /orders/cancel': () => { throw httpError(400, { message: 'Cannot cancel uc order.' }); } });
    await expect(shiprocket.cancel({ provider_ref: '15151515:16161616' })).rejects.toThrow(/Cannot cancel/);
  });
});

/* ═════════════════════════════════════════ the return (checks 13, 14) */

describe('booking the return', () => {
  const RETURN = {
    ...PARCEL, id: '7a6b5c4d-3e2f-4a1b-9c0d-8e7f6a5b4c3d', declared_value: null,
    // FROM her door TO the store — the mirror of the outbound parcel.
    from_name: PARCEL.to_name, from_phone: PARCEL.to_phone, from_street: PARCEL.to_street,
    from_pincode: PARCEL.to_pincode, from_city_name: PARCEL.to_city_name, from_state_name: PARCEL.to_state_name,
    to_name: PARCEL.from_name, to_phone: PARCEL.from_phone, to_street: PARCEL.from_street,
    to_pincode: PARCEL.from_pincode, to_city_name: PARCEL.from_city_name, to_state_name: PARCEL.from_state_name,
  };

  it('13 · the return order carries every field the reference marks required', async () => {
    const f = fakeShiprocket();
    await shiprocket.bookReturn(RETURN, { pickupDay: '2026-10-09', items: LINES });
    const [{ body }] = f.of('POST /orders/create/return');

    for (const k of RETURN_REQUIRED) {
      expect(body).toHaveProperty(k);
      expect(body[k] === '' || body[k] == null).toBe(false);
    }
    expect(body.order_id).toBe(`${RETURN.id}-R`);
    expect(body.pickup_phone).toBe('9876511111');
    expect(body.shipping_phone).toBe('9876500000');
    expect(body.pickup_pincode).toBe('522002');              // collected from HER
    expect(body.shipping_pincode).toBe('500034');            // delivered to the STORE
    expect(body.order_items).toHaveLength(2);
    expect(body.order_items[0]).toMatchObject({ name: 'Indigo Chanderi Saree', units: 1, selling_price: 2400 });
    expect(body.sub_total).toBe(4800);                       // no declared value on a return row — the lines' own
    // The day she chose is the PICKUP's, not the order's.
    expect(body.order_date).not.toBe('2026-10-09');
  });

  it('14 · the tracking number is assigned AS A RETURN and the pickup is asked for on her day', async () => {
    const f = fakeShiprocket();
    const out = await shiprocket.bookReturn(RETURN, { pickupDay: '2026-10-09', items: LINES });
    expect(f.of('GET /courier/serviceability/')[0].query.get('is_return')).toBe('1');
    expect(f.of('POST /courier/assign/awb')[0].body).toEqual({ shipment_id: 170411259, is_return: 1, courier_id: 142 });
    expect(f.of('POST /courier/generate/pickup')[0].body).toEqual({ shipment_id: [170411259], pickup_date: ['2026-10-09'] });
    expect(out).toEqual({ courierName: 'Amazon Surface', trackingNumber: f.RET, providerRef: '170411259:170872392' });
  });

  it('14 · a return the courier will not take is thrown, and its order taken back', async () => {
    const f = fakeShiprocket({
      'POST /courier/assign/awb': () => ({ awb_assign_status: 0, response: { data: { awb_assign_error: 'Reverse pickup not available' } } }),
    });
    await expect(shiprocket.bookReturn(RETURN, { pickupDay: '2026-10-09', items: LINES }))
      .rejects.toMatchObject({ code: 'SHIPROCKET_AWB' });
    expect(f.of('POST /orders/cancel')[0].body).toEqual({ ids: [170872392] });
  });
});

/* ═════════════════════════════════════════ reading an update (checks 16–19, 21) */

describe('reading Shiprocket’s tracking update', () => {
  // The reference's own sample body, shortened only in its list of scans.
  const SAMPLE = {
    awb: '19041424751540', courier_name: 'Delhivery Surface',
    current_status: 'IN TRANSIT', current_status_id: 20,
    shipment_status: 'IN TRANSIT', shipment_status_id: 18,
    current_timestamp: '23 05 2023 11:43:52',
    order_id: '1373900_150876814', sr_order_id: 348456385,
    awb_assigned_date: '2023-05-19 11:59:16', pickup_scheduled_date: '2023-05-19 11:59:17',
    etd: '2023-05-23 15:40:19',
    scans: [
      { date: '2023-05-19 15:32:17', status: 'X-PPOM', activity: 'In Transit - Shipment picked up', location: 'Chomu_SamodRd_D (Rajasthan)', 'sr-status': '42', 'sr-status-label': 'PICKED UP' },
      { date: '2023-05-23 11:43:46', status: 'X-IBD3F', activity: 'In Transit - Shipment Received at Facility', location: 'Mumbai_MiraRdIndEstate_I (Maharashtra)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
    ],
    is_return: 0, channel_id: 3422553, pod_status: 'OTP Based Delivery', pod: 'Not Available',
  };

  it('16 · the sample is read: its tracking number, its status, and its clock as India time', () => {
    const u = shiprocket.parseWebhook(SAMPLE);
    expect(u.trackingNumber).toBe('19041424751540');
    expect(u.event).toBe(EVENTS.COLLECTED);
    // "23 05 2023 11:43:52" is day-month-year, India time → 06:13:52 UTC.
    expect(u.occurredAt).toBe('2023-05-23T06:13:52.000Z');
    expect(Number.isNaN(new Date(u.occurredAt).getTime())).toBe(false);
    expect(u.isReturn).toBe(false);
  });

  it('16 · the same update read twice gives the same moment — which is what makes it one event', () => {
    expect(shiprocket.parseWebhook(SAMPLE).occurredAt).toBe(shiprocket.parseWebhook({ ...SAMPLE }).occurredAt);
  });

  it('16 · every clock Shiprocket writes is understood; nonsense is not a time', () => {
    expect(shiprocket.parseTime('2023-05-19 11:59:16')).toBe('2023-05-19T06:29:16.000Z');
    expect(shiprocket.parseTime({ date: '2022-11-25 11:17:52.878599', timezone: 'Asia/Kolkata' })).toBe('2022-11-25T05:47:52.000Z');
    expect(shiprocket.parseTime('2026-10-06T10:00:00.000Z')).toBe('2026-10-06T10:00:00.000Z');
    expect(shiprocket.parseTime('soon')).toBeNull();
    expect(shiprocket.parseTime('')).toBeNull();
  });

  it('17 · the words of a parcel going out', () => {
    const ev = (s) => { const u = shiprocket.parseWebhook({ awb: 'A1', current_status: s }); return u && u.event; };
    expect(ev('PICKED UP')).toBe(EVENTS.COLLECTED);
    expect(ev('Shipped')).toBe(EVENTS.COLLECTED);
    expect(ev('IN TRANSIT')).toBe(EVENTS.COLLECTED);
    expect(ev('Out For Delivery')).toBe(EVENTS.OUT_FOR_DELIVERY);
    expect(ev('UNDELIVERED')).toBe(EVENTS.ATTEMPT_FAILED);
    expect(ev('Delivered')).toBe(EVENTS.DELIVERED);
    expect(ev('RTO DELIVERED')).toBe(EVENTS.RETURNED_TO_STORE);
    expect(ev('CANCELED')).toBe(EVENTS.CANCELLED);
    expect(ev('Cancelled')).toBe(EVENTS.CANCELLED);
  });

  it('18 · a return’s words are read with or without the RETURN prefix', () => {
    const ev = (p) => { const u = shiprocket.parseWebhook({ awb: 'R1', ...p }); return u && u.event; };
    expect(ev({ current_status: 'RETURN PICKED UP' })).toBe(EVENTS.COLLECTED);
    expect(ev({ current_status: 'PICKED UP', is_return: 1 })).toBe(EVENTS.COLLECTED);
    expect(ev({ current_status: 'RETURN DELIVERED' })).toBe(EVENTS.DELIVERED);
    expect(ev({ current_status: 'DELIVERED', is_return: 1 })).toBe(EVENTS.DELIVERED);
    expect(ev({ current_status: 'RETURN CANCELLED' })).toBe(EVENTS.CANCELLED);
    expect(shiprocket.parseWebhook({ awb: 'R1', current_status: 'RETURN PICKED UP' }).isReturn).toBe(true);
    // Created, not moving yet — nothing for INFLX to do.
    expect(ev({ current_status: 'RETURN PENDING' })).toBeNull();
  });

  it('18 · a failed PICKUP is a failed attempt on a return — and nothing at all on the way out', () => {
    const ev = (p) => { const u = shiprocket.parseWebhook({ awb: 'A1', ...p }); return u && u.event; };
    expect(ev({ current_status: 'RETURN PICKUP EXCEPTION' })).toBe(EVENTS.ATTEMPT_FAILED);
    expect(ev({ current_status: 'PICKUP ERROR', is_return: 1 })).toBe(EVENTS.ATTEMPT_FAILED);
    // On the way out it means the STORE's courier did not turn up. The creator must not be
    // told her delivery failed.
    expect(ev({ current_status: 'PICKUP EXCEPTION', is_return: 0 })).toBeNull();
    expect(ev({ current_status: 'PICKUP ERROR' })).toBeNull();
  });

  it('18 · a failed attempt carries the courier’s own last words as its reason', () => {
    const u = shiprocket.parseWebhook({
      awb: 'A1', current_status: 'UNDELIVERED', current_timestamp: '06 10 2026 17:05:00',
      scans: [{ date: '2026-10-06 17:04:10', activity: 'Consignee not available' }],
    });
    expect(u.reason).toBe('Consignee not available');
  });

  it('19 · a status INFLX does not act on maps to nothing', () => {
    for (const s of ['LOST', 'DAMAGED', 'REACHED AT DESTINATION HUB', 'AWB Assigned', 'Pickup Generated', 'OUT FOR PICKUP', 'RTO IN TRANSIT', '']) {
      expect(shiprocket.parseWebhook({ awb: 'A1', current_status: s })).toBeNull();
    }
  });

  it('21 · the address Shiprocket is given contains none of the words it forbids', () => {
    const url = 'https://inflx-platform.onrender.com/v1/webhooks/shipping/courier';
    for (const word of ['shiprocket', 'kartrocket', 'sr', 'kr']) {
      expect(url.toLowerCase().includes(word)).toBe(false);
    }
  });
});

/* ═════════════════════════════════════════ the sign-in (check 24) */

describe('an expired sign-in', () => {
  it('24 · a 401 signs in again once and repeats the call', async () => {
    let n = 0;
    const f = fakeShiprocket({
      'POST /orders/cancel': () => { n += 1; if (n === 1) throw httpError(401, { message: 'Token has expired' }); return { status_code: 200 }; },
    });
    await shiprocket.cancel({ provider_ref: '1:2' });
    expect(f.of('POST /auth/login')).toHaveLength(2);
    expect(f.of('POST /orders/cancel')).toHaveLength(2);
  });

  it('24 · a second 401 is an error, not a loop', async () => {
    const f = fakeShiprocket({ 'POST /orders/cancel': () => { throw httpError(401, { message: 'Token has expired' }); } });
    await expect(shiprocket.cancel({ provider_ref: '1:2' })).rejects.toMatchObject({ status: 401 });
    expect(f.of('POST /orders/cancel')).toHaveLength(2);
  });

  it('one sign-in serves many calls', async () => {
    const f = fakeShiprocket();
    await shiprocket.quote({ pickupPincode: '500034', deliveryPincode: '522002', weightKg: 1 });
    await shiprocket.quote({ pickupPincode: '500034', deliveryPincode: '522002', weightKg: 1 });
    expect(f.of('POST /auth/login')).toHaveLength(1);
    expect(f.of('GET /courier/serviceability/').every((c) => c.token === 'tok-1')).toBe(true);
  });
});

/* ═════════════════════════════════════════ weight differences (checks 22, 23) */

describe('the daily read of weight differences', () => {
  async function shiprocketParcel(tracking) {
    const { rows } = await query(
      `INSERT INTO shipments (production_event_id, direction, provider, tracking_number, to_name, to_pincode, from_name, from_pincode, weight_kg, booked_at)
       VALUES (NULL, 'outbound', 'shiprocket', $1, 'Tanvi Suresh', '522002', 'Kanchi Silks', '500034', 0.5, now()) RETURNING *`, [tracking]);
    return rows[0];
  }
  const chargesOn = async (id) => (await query(
    `SELECT * FROM shipment_events WHERE shipment_id = $1 AND event = 'weight_charge' ORDER BY created_at`, [id])).rows;

  it('23 · it does nothing while the switches are off', async () => {
    const f = fakeShiprocket();
    expect(await weightJob.run()).toEqual({ skipped: true });
    env.SHIPPING_PROVIDER = 'shiprocket';                        // one switch is not two
    expect(await weightJob.run()).toEqual({ skipped: true });
    expect(f.calls).toHaveLength(0);
  });

  it('22 · each difference is ONE weight charge on its parcel, however often the list is read', async () => {
    const tracking = `WD${Date.now()}`;
    const s = await shiprocketParcel(tracking);
    fakeShiprocket({
      'GET /billing/discrepancy': () => ({ status: 200, data: [
        { id: 901, awb_code: tracking, applied_weight: 0.5, charged_weight: 1.4, total_applied_amount: 82.6, total_charged_amount: 142.5 },
        { id: 902, awb_code: 'SOMEBODY-ELSES', applied_weight: 1, charged_weight: 2, total_applied_amount: 20, total_charged_amount: 50 },
        { id: 903, awb_code: tracking, applied_weight: 0.5, charged_weight: 0.5, total_applied_amount: 80, total_charged_amount: 80 },
      ] }),
    });
    env.SHIPPING_PROVIDER = 'shiprocket';
    env.SHIPROCKET_ENABLED = true;

    const first = await weightJob.run();
    expect(first).toMatchObject({ read: 2, charged: 1, notOurs: 1, alreadyCharged: 0, failed: 0 });   // 903 is no difference at all
    const rows = await chargesOn(s.id);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(59.9);                   // 142.50 − 82.60
    expect(rows[0].reason).toMatch(/1\.4 kg.*0\.5 kg/);
    expect(rows[0].applied).toBe(true);

    const second = await weightJob.run();
    expect(second).toMatchObject({ charged: 0, alreadyCharged: 1 });
    expect(await chargesOn(s.id)).toHaveLength(1);
  });
});

/* ═════════════════════════════════════════ item 11, on the real courier, through its own routes */

describe('item 11 through its own routes, with the platform on the real courier', () => {
  const SECRET = 'a-shared-secret-word';

  async function world() {
    const w = await w10.signedByBoth('engagement', { mode: 'shipment', wallet: 500000 });
    const { rows: [city] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = 'Guntur' LIMIT 1`);
    await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`, [w.cr.influencerId, city.id, city.state_id]);
    w.city = city;
    return w;
  }
  async function product(brandId, name = 'Indigo Chanderi Saree', price = 2400) {
    const { rows: [p] } = await query(
      `INSERT INTO brand_products (brand_id, name, price, sku, is_active, pushed_to_store)
       VALUES ($1,$2,$3,$4,true,true) RETURNING *`,
      [brandId, name, price, `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`]);
    return p;
  }
  const B = (w) => `${w.url}/invitations/${w.ciId}/remote`;
  const C = (w) => `/influencers/me/invitations/${w.ciId}/remote`;
  const ADDRESS = (w) => ({
    name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road, Brodipet',
    pincode: '522002', stateId: w.city.state_id, cityId: w.city.id,
  });
  const walletOf = async (id) => Number((await query(`SELECT wallet_balance FROM brands WHERE id=$1`, [id])).rows[0].wallet_balance);
  const parcelsOf = async (w) => (await query(
    `SELECT s.* FROM shipments s JOIN production_events pe ON pe.id = s.production_event_id
      WHERE pe.contract_id = $1 ORDER BY s.created_at`, [w.con.id])).rows;
  const row = async (id) => (await query(`SELECT * FROM shipments WHERE id = $1`, [id])).rows[0];

  /** Shiprocket knocking on the door it is given, with the secret it was given. */
  const update = (body, secret = SECRET, door = 'courier') =>
    api.post(`/webhooks/shipping/${door}`, null, { current_timestamp: '06 10 2026 11:43:52', scans: [], ...body })
      .set('x-api-key', secret);

  function switchOn(script) {
    const f = fakeShiprocket(script);
    env.SHIPPING_PROVIDER = 'shiprocket';
    env.SHIPROCKET_WEBHOOK_SECRET = SECRET;
    return f;
  }

  /** Address sent, one Return line saved, parcel booked. */
  async function booked(w, f) {
    const p = await product(w.brandId);
    const a = await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    if (a.status !== 200) throw new Error(`address: ${JSON.stringify(a.body)}`);
    const l = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'return' }] });
    if (l.status !== 200) throw new Error(`lines: ${JSON.stringify(l.body)}`);
    const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    return { book, product: p, parcel: (await parcelsOf(w)).filter((s) => s.direction === 'outbound').pop(), f };
  }

  it('27 · a brand books: the store is registered under its code, and the booking quotes that code back', async () => {
    const f = switchOn();
    const w = await world();
    const before = await walletOf(w.brandId);
    const { book, parcel } = await booked(w, f);
    expect(book.status).toBe(200);

    // Her address step asked both questions.
    expect(f.of('GET /courier/serviceability/').some((c) => c.query.get('is_return') === '1')).toBe(true);

    const [reg] = f.of('POST /settings/company/addpickup');
    const [order] = f.of('POST /orders/create/adhoc');
    expect(reg.body.pickup_location).toMatch(/^[A-Za-z0-9]{1,36}$/);
    expect(order.body.pickup_location).toBe(reg.body.pickup_location);
    expect(order.body.pickup_location).not.toBe(w.br.name);
    // features/courier-ready-addresses: the courier is told WHOSE store it is, and the label's
    // sender is the brand.
    expect(reg.body.name).toContain(w.br.name);
    expect(reg.body.name).toContain(w.b.name.split(' ')[0]);
    expect(order.body.reseller_name).toBe(w.b.name);
    for (const k of OUTBOUND_REQUIRED) expect(order.body).toHaveProperty(k);
    expect(order.body.order_id).toBe(parcel.id);
    expect(order.body.billing_phone).toMatch(/^\d{10}$/);
    expect(reg.body.phone).toMatch(/^\d{10}$/);

    const { rows: [pick] } = await query(
      `SELECT * FROM brand_branch_pickups WHERE branch_id = $1 AND provider = 'shiprocket'`, [w.br.id]);
    expect(pick.provider_pickup_id).toBe(reg.body.pickup_location);

    expect(parcel).toMatchObject({ provider: 'shiprocket', tracking_number: f.OUT, courier_name: 'Amazon Surface', provider_ref: '15151515:16161616' });
    expect(parcel.label_key).toBeTruthy();
    // ₹72 out and ₹72 held for the way back — the cheapest courier's price, rounded up.
    expect(Number(parcel.charged_amount)).toBe(72);
    expect(Number(parcel.return_hold_amount)).toBe(72);
    expect(await walletOf(w.brandId)).toBe(before - 144);
  });

  it('20 · Shiprocket’s updates, posted to the address it is given, move the parcel', async () => {
    const f = switchOn();
    const w = await world();
    const { parcel } = await booked(w, f);

    // A wrong secret, and no secret, are refused and move nothing.
    expect((await update({ awb: f.OUT, current_status: 'PICKED UP' }, 'not-the-secret')).status).toBe(401);
    expect((await api.post('/webhooks/shipping/courier', null, { awb: f.OUT, current_status: 'PICKED UP' })).status).toBe(401);
    expect((await row(parcel.id)).collected_at).toBeNull();

    const picked = await update({ awb: f.OUT, current_status: 'PICKED UP', is_return: 0 });
    expect(picked.status).toBe(200);
    expect(picked.body.data).toMatchObject({ received: true, applied: true });
    const afterPick = await row(parcel.id);
    expect(new Date(afterPick.collected_at).toISOString()).toBe('2026-10-06T06:13:52.000Z');   // THEIR clock, read as India time

    // The same update again is one event.
    const again = await update({ awb: f.OUT, current_status: 'PICKED UP', is_return: 0 });
    expect(again.body.data).toMatchObject({ duplicate: true, applied: false });

    // A status INFLX does not act on is kept and answered 200.
    const hub = await update({ awb: f.OUT, current_status: 'REACHED AT DESTINATION HUB', current_timestamp: '06 10 2026 15:00:00' });
    expect(hub.status).toBe(200);
    expect(hub.body.data).toMatchObject({ received: true, applied: false });

    await update({ awb: f.OUT, current_status: 'OUT FOR DELIVERY', current_timestamp: '07 10 2026 09:10:00' });
    // The old address still answers — nothing that already points at it breaks.
    const done = await update({ awb: f.OUT, current_status: 'Delivered', current_timestamp: '07 10 2026 13:30:00' }, SECRET, 'shiprocket');
    expect(done.status).toBe(200);
    expect((await row(parcel.id)).delivered_at).toBeTruthy();
    expect((await api.get(C(w), w.cr.token)).body.data.shoot.stage).toBe('delivered');

    // An update for a parcel that is not ours is 200 and nothing — Shiprocket must not retry for ever.
    const stranger = await update({ awb: 'NOT-OURS-1', current_status: 'DELIVERED' });
    expect(stranger.status).toBe(200);
  });

  it('13, 14 · she books the return: its items travel with it, on the day she chose, and its updates move it', async () => {
    const f = switchOn();
    const w = await world();
    const { parcel, product: p } = await booked(w, f);
    await update({ awb: f.OUT, current_status: 'PICKED UP' });
    await update({ awb: f.OUT, current_status: 'DELIVERED', current_timestamp: '07 10 2026 13:30:00' });
    const read = await api.get(C(w), w.cr.token);
    await api.post(`${C(w)}/check`, w.cr.token, { answers: read.body.data.shoot.lines.map((l) => ({ lineId: l.id, status: 'received' })) });
    must(await api.post(`${C(w)}/done`, w.cr.token, {}), 200);

    const day = addDays(todayInIndia(), 2);
    must(await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: day }), 200);

    const [order] = f.of('POST /orders/create/return');
    for (const k of RETURN_REQUIRED) expect(order.body).toHaveProperty(k);
    expect(order.body.order_items).toHaveLength(1);
    expect(order.body.order_items[0]).toMatchObject({ name: p.name, units: 1, selling_price: 2400 });
    expect(order.body.sub_total).toBe(2400);
    expect(order.body.pickup_pincode).toBe('522002');
    expect(order.body.pickup_phone).toMatch(/^\d{10}$/);
    expect(order.body.shipping_phone).toMatch(/^\d{10}$/);
    expect(f.of('POST /courier/assign/awb').pop().body).toMatchObject({ shipment_id: 170411259, is_return: 1 });
    expect(f.of('POST /courier/generate/pickup').pop().body).toEqual({ shipment_id: [170411259], pickup_date: [day] });

    const ret = (await parcelsOf(w)).find((s) => s.direction === 'return');
    expect(ret).toMatchObject({ provider: 'shiprocket', tracking_number: f.RET, provider_ref: '170411259:170872392' });
    expect(ret.id).not.toBe(parcel.id);

    // The return's own updates, in the words a return uses.
    const up = await update({ awb: f.RET, current_status: 'RETURN PICKED UP', is_return: 1, current_timestamp: '09 10 2026 12:00:00' });
    expect(up.body.data.applied).toBe(true);
    expect((await row(ret.id)).collected_at).toBeTruthy();
    const back = await update({ awb: f.RET, current_status: 'RETURN DELIVERED', is_return: 1, current_timestamp: '11 10 2026 16:00:00' });
    expect(back.body.data.applied).toBe(true);
    expect((await row(ret.id)).delivered_at).toBeTruthy();
    // …and they moved the RETURN, not the parcel that went out.
    expect(new Date((await row(parcel.id)).delivered_at).toISOString()).toBe('2026-10-07T08:00:00.000Z');
  });

  it('9 · an empty Shiprocket wallet: the brand is charged nothing and no parcel is left booked', async () => {
    const f = switchOn({
      'POST /courier/assign/awb': () => ({
        awb_assign_status: 0, status_code: 350,
        message: 'Please recharge your ShipRocket wallet. The minimum required balance is Rs 100',
      }),
    });
    const w = await world();
    const before = await walletOf(w.brandId);
    const { book } = await booked(w, f);

    expect(book.status).toBe(502);
    expect(book.body.error.code).toBe('PROVIDER_FAILED');
    expect(book.body.error.message).toMatch(/nothing has been charged/i);
    expect(await walletOf(w.brandId)).toBe(before);
    expect(f.of('POST /orders/cancel')).toHaveLength(1);                 // Shiprocket's half-made order, taken back
    const live2 = (await parcelsOf(w)).filter((s) => s.direction === 'outbound' && !s.cancelled_at);
    expect(live2).toHaveLength(0);
    expect((await parcelsOf(w)).some((s) => s.tracking_number)).toBe(false);

    // The wallet is recharged; the same button works.
    f.on('POST /courier/assign/awb', DOCUMENTED['POST /courier/assign/awb']);
    const retry = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    must(retry, 200);
    expect(await walletOf(w.brandId)).toBe(before - 144);
  });

  it('12 · a real courier that will not cancel: the brand is NOT refunded and the parcel stays booked', async () => {
    const f = switchOn();
    const w = await world();
    const before = await walletOf(w.brandId);
    const { parcel } = await booked(w, f);
    expect(await walletOf(w.brandId)).toBe(before - 144);

    f.on('POST /orders/cancel', () => { throw httpError(400, { message: 'Cannot cancel uc order.' }); });
    const refused = await api.post(`${B(w)}/cancel`, w.b.token, {});
    expect(refused.status).toBe(502);
    expect(refused.body.error.code).toBe('PROVIDER_FAILED');
    expect(refused.body.error.message).toMatch(/could not be cancelled/i);
    expect((await row(parcel.id)).cancelled_at).toBeNull();
    expect(await walletOf(w.brandId)).toBe(before - 144);                // nothing came back

    // Shiprocket cancels: now, and only now, the money returns.
    f.on('POST /orders/cancel', DOCUMENTED['POST /orders/cancel']);
    const ok = must(await api.post(`${B(w)}/cancel`, w.b.token, {}), 200);
    expect(ok.status).toBe(200);
    expect(f.of('POST /orders/cancel').pop().body).toEqual({ ids: [16161616] });
    expect((await row(parcel.id)).cancelled_at).toBeTruthy();
    expect(await walletOf(w.brandId)).toBe(before);
  });

  it('15 · a return the courier could not book is withdrawn — she can book again', async () => {
    const f = switchOn();
    const w = await world();
    await booked(w, f);
    await update({ awb: f.OUT, current_status: 'PICKED UP' });
    await update({ awb: f.OUT, current_status: 'DELIVERED', current_timestamp: '07 10 2026 13:30:00' });
    const read = await api.get(C(w), w.cr.token);
    await api.post(`${C(w)}/check`, w.cr.token, { answers: read.body.data.shoot.lines.map((l) => ({ lineId: l.id, status: 'received' })) });
    await api.post(`${C(w)}/done`, w.cr.token, {});
    const day = addDays(todayInIndia(), 2);

    f.on('POST /orders/create/return', () => { throw httpError(422, { message: 'Oops! Invalid Data.' }); });
    const refused = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: day });
    expect(refused.status).toBe(502);
    expect(refused.body.error.code).toBe('PROVIDER_FAILED');
    expect((await parcelsOf(w)).filter((s) => s.direction === 'return' && !s.cancelled_at)).toHaveLength(0);

    f.on('POST /orders/create/return', DOCUMENTED['POST /orders/create/return']);
    const ok = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: day });
    expect(ok.status).toBe(200);
    const returns = (await parcelsOf(w)).filter((s) => s.direction === 'return');
    expect(returns).toHaveLength(2);
    expect(returns.filter((s) => !s.cancelled_at)).toHaveLength(1);
    expect(returns.find((s) => !s.cancelled_at).tracking_number).toBe(f.RET);
  });
});

/* ═════════════════════════════════════════ what the courier is told about a store
   (features/courier-ready-addresses · checks 9, 10, 11) */

describe('what the courier is told about a store', () => {
  const STORE = {
    name: 'Aveen Fashion - Main Branch', phone: '9000012345',
    street: 'Shop 12, Sri Sai Complex, Road No 3, KPHB Phase 1, Kukatpally', landmark: 'Opposite JNTU metro station',
    pincode: '500072', cityName: 'Hyderabad', stateName: 'Telangana',
  };

  it('9 · the landmark goes as the second address line, with the store’s own phone and the brand’s name', async () => {
    const f = fakeShiprocket();
    await shiprocket.registerPickup(STORE);
    const [{ body }] = f.of('POST /settings/company/addpickup');
    expect(body.address).toBe('Shop 12, Sri Sai Complex, Road No 3, KPHB Phase 1, Kukatpally');
    expect(body.address_2).toBe('Opposite JNTU metro station');
    expect(body.phone).toBe('9000012345');
    expect(body.name).toBe('Aveen Fashion Main Branch');          // letters, digits and spaces — whose store it is
    expect((body.address + body.address_2).length).toBeLessThanOrEqual(190);
  });

  it('9 · no landmark, or one too short to be a line, sends no second line at all', async () => {
    const f = fakeShiprocket();
    await shiprocket.registerPickup({ ...STORE, landmark: null });
    await shiprocket.registerPickup({ ...STORE, landmark: 'A1' });
    for (const c of f.of('POST /settings/company/addpickup')) expect(c.body).not.toHaveProperty('address_2');
  });

  it('9 · an old, long address and its landmark still fit the 190 a courier keeps', async () => {
    const f = fakeShiprocket();
    await shiprocket.registerPickup({ ...STORE, street: `Shop 12, ${'A'.repeat(180)}`, landmark: 'L'.repeat(45) });
    const [{ body }] = f.of('POST /settings/company/addpickup');
    expect(body.address_2).toHaveLength(45);
    expect(body.address.length + body.address_2.length).toBeLessThanOrEqual(190);
    expect(body.address.startsWith('Shop 12, ')).toBe(true);     // the shop number is what survives
  });

  it('11 · a new landmark or a new phone is a new address to the courier — the store gets a new code', () => {
    const base = shiprocket.pickupCode(STORE);
    expect(shiprocket.pickupCode({ ...STORE })).toBe(base);
    expect(shiprocket.pickupCode({ ...STORE, landmark: 'Next to the flyover' })).not.toBe(base);
    expect(shiprocket.pickupCode({ ...STORE, landmark: null })).not.toBe(base);
    expect(shiprocket.pickupCode({ ...STORE, phone: '9000099999' })).not.toBe(base);
    expect(shiprocket.pickupCode({ ...STORE, landmark: 'Next to the flyover' })).toMatch(/^[A-Za-z0-9]{1,36}$/);
  });

  it('9 · the label’s sender is the brand — and only when a brand was named', async () => {
    const f = fakeShiprocket();
    await shiprocket.book(PARCEL, { pickupLocationName: 'X', items: LINES, senderName: 'Aveen Fashion Boutique' });
    await shiprocket.book({ ...PARCEL, id: '11111111-2222-4333-8444-555555555555' }, { pickupLocationName: 'X', items: LINES });
    const [named, bare] = f.of('POST /orders/create/adhoc');
    expect(named.body.reseller_name).toBe('Aveen Fashion Boutique');
    expect(bare.body).not.toHaveProperty('reseller_name');
  });

  it('10 · a return is delivered to the brand at that branch, not to "Main Branch"', async () => {
    const f = fakeShiprocket();
    const ret = {
      ...PARCEL, id: '7a6b5c4d-3e2f-4a1b-9c0d-8e7f6a5b4c3d', declared_value: null,
      from_name: 'Tanvi Suresh', from_phone: '9876511111', from_street: '11 Gandhi Road, Brodipet', from_pincode: '522002',
      from_city_name: 'Guntur', from_state_name: 'Andhra Pradesh',
      to_name: 'Main Branch', to_phone: '9000012345',
      to_street: 'Shop 12, Sri Sai Complex, Road No 3, KPHB Phase 1, Kukatpally, Opposite JNTU metro station',
      to_pincode: '500072', to_city_name: 'Hyderabad', to_state_name: 'Telangana',
    };
    await shiprocket.bookReturn(ret, { pickupDay: '2026-10-09', items: LINES, senderName: 'Aveen Fashion Boutique' });
    const [{ body }] = f.of('POST /orders/create/return');
    expect(body.shipping_customer_name).toBe('Aveen Fashion Boutique - Main Branch');
    expect(body.shipping_address).toBe('Shop 12, Sri Sai Complex, Road No 3, KPHB Phase 1, Kukatpally, Opposite JNTU metro station');
    expect(body.shipping_phone).toBe('9000012345');
  });
});
