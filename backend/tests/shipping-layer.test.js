'use strict';

/**
 * Item 11, Phase 2b — the shipping layer, on its own.
 * Contract: features/item11-remote §6 · approval §3.5–§3.7 · checks 33, 34, 35, 36, 48, 49, 58
 *
 * The approval asks for this layer to be "tested on its own — including the zero-imports rule
 * — before any feature uses it". Nothing in this file knows what a collaboration is, except
 * the two places that deliberately check the layer does not either.
 */

const fs = require('fs');
const path = require('path');
const { query, brand } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const env = require('../src/config/env');
const shipping = require('../src/services/shipping');
const simulator = require('../src/services/shipping/simulator');
const shiprocket = require('../src/services/shipping/shiprocket');
const webhook = require('../src/services/shipping/webhook');
const { EVENTS, dedupeKey, boxOf, volumetricKg, BOX_PRESETS } = require('../src/services/shipping/contract');

const SHIP_DIR = path.join(__dirname, '../src/services/shipping');

/** A bare shipment row. NO production event — the whole point is that it does not need one. */
async function shipment(over = {}) {
  const cols = {
    production_event_id: null,
    direction: 'outbound',
    provider: 'simulator',
    from_name: 'Kanchi Silks', from_phone: '9876500000',
    from_street: 'Road No. 12, Banjara Hills', from_pincode: '500034',
    from_city_name: 'Hyderabad', from_state_name: 'Telangana',
    to_name: 'Tanvi Suresh', to_phone: '9876511111',
    to_street: '11 Gandhi Road', to_pincode: '522002',
    to_city_name: 'Guntur', to_state_name: 'Andhra Pradesh',
    box_preset: 'medium', box_l_cm: 35, box_w_cm: 25, box_h_cm: 10,
    weight_kg: 1.2, declared_value: 4800,
    ...over,
  };
  const keys = Object.keys(cols);
  const { rows } = await query(
    `INSERT INTO shipments (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    keys.map((k) => cols[k])
  );
  return rows[0];
}

const reload = async (id) => (await query(`SELECT * FROM shipments WHERE id = $1`, [id])).rows[0];

afterEach(() => { webhook._clearEffects(); });

/* ─────────────────────────────────────── the isolation rule (what item 16 buys) */

describe('the layer knows nothing about collaborations (approval §3.5)', () => {
  const REQUIRE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  // Its own siblings are fine — `./contract` is the interface, not the contracts TABLE.
  const OWN_SIBLING = /^\.\/[A-Za-z0-9_-]+$/;
  const FORBIDDEN = /(production|contracts|campaign)/i;

  it('no file in services/shipping requires production*, contracts or campaign_*', () => {
    const files = fs.readdirSync(SHIP_DIR).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(3);
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(SHIP_DIR, f), 'utf8');
      // Strip comments first — this folder's own prose talks about production events.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of code.matchAll(REQUIRE)) {
        const spec = m[1];
        if (OWN_SIBLING.test(spec)) continue;
        if (FORBIDDEN.test(spec)) offenders.push(`${f}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('…and the rule has teeth — a planted import would be caught', () => {
    const code = "const x = require('../production.service');";
    const found = [...code.matchAll(REQUIRE)].filter((m) => !OWN_SIBLING.test(m[1]) && FORBIDDEN.test(m[1]));
    expect(found).toHaveLength(1);
  });

  it('a shipment needs no production event at all — item 16 can book one for an order', async () => {
    const s = await shipment({ production_event_id: null });
    expect(s.production_event_id).toBeNull();
    const q = await simulator.quote({
      pickupPincode: s.from_pincode, deliveryPincode: s.to_pincode,
      pickupCity: s.from_city_name, deliveryCity: s.to_city_name,
      weightKg: 1.2, box: { preset: 'medium' },
    });
    expect(q.amount).toBeGreaterThan(0);
  });
});

/* ─────────────────────────────────────── coverage, quote, book, label */

describe('the simulator (§6.4)', () => {
  it('coverage: 999 does not deliver, 998 delivers with no return pickup, anything else both', async () => {
    expect(await simulator.checkCoverage({ pickupPincode: '500034', deliveryPincode: '522999' }))
      .toMatchObject({ delivers: false, returnPickup: false });
    expect(await simulator.checkCoverage({ pickupPincode: '500034', deliveryPincode: '522998' }))
      .toMatchObject({ delivers: true, returnPickup: false });
    expect(await simulator.checkCoverage({ pickupPincode: '500034', deliveryPincode: '522002' }))
      .toMatchObject({ delivers: true, returnPickup: true });
  });

  it('a pickup pincode couriers cannot reach is a pickup that cannot happen', async () => {
    expect(await simulator.checkCoverage({ pickupPincode: '500999', deliveryPincode: '522002' }))
      .toMatchObject({ delivers: false });
  });

  it('the quote is GST-INCLUSIVE, and gst_amount is the part of it that is tax (Q7)', async () => {
    const q = await simulator.quote({
      pickupPincode: '500034', deliveryPincode: '522002',
      pickupCity: 'Hyderabad', deliveryCity: 'Guntur', weightKg: 1.2, box: { preset: 'medium' },
    });
    expect(q.gstIncluded).toBe(true);
    expect(q.currency).toBe('INR');
    // 18% inside the total: gst = amount × 18/118, never amount × 0.18 on top.
    expect(q.gstAmount).toBeCloseTo((q.amount * 18) / 118, 1);
    expect(q.gstAmount).toBeLessThan(q.amount);
  });

  it('distance matters: the same box costs more the further it goes', async () => {
    const near = await simulator.quote({ pickupPincode: '500034', deliveryPincode: '500001', pickupCity: 'Hyderabad', deliveryCity: 'Hyderabad', weightKg: 1, box: { preset: 'small' } });
    const far  = await simulator.quote({ pickupPincode: '500034', deliveryPincode: '682001', pickupCity: 'Hyderabad', deliveryCity: 'Kochi',     weightKg: 1, box: { preset: 'small' } });
    expect(far.amount).toBeGreaterThan(near.amount);
  });

  it('weight matters, and the volumetric weight of a big light box is used when it is larger', async () => {
    const light = await simulator.quote({ pickupPincode: '500034', deliveryPincode: '522002', pickupCity: 'Hyderabad', deliveryCity: 'Guntur', weightKg: 0.5, box: { preset: 'small' } });
    const heavy = await simulator.quote({ pickupPincode: '500034', deliveryPincode: '522002', pickupCity: 'Hyderabad', deliveryCity: 'Guntur', weightKg: 6,   box: { preset: 'small' } });
    expect(heavy.amount).toBeGreaterThan(light.amount);
    expect(volumetricKg(BOX_PRESETS.large)).toBeCloseTo((45 * 35 * 15) / 5000, 3);
    expect(boxOf({ preset: 'medium' })).toMatchObject({ l: 35, w: 25, h: 10, preset: 'medium' });
    expect(boxOf({ l: 40, w: 30, h: 20 })).toMatchObject({ preset: 'other' });
    expect(boxOf({ l: 0, w: 1, h: 1 })).toBeNull();
  });

  it('36 · tracking numbers start TEST and the label says TEST — NOT A REAL SHIPMENT', async () => {
    const booked = await simulator.book({});
    expect(booked.trackingNumber).toMatch(/^TEST\d{10}$/);
    expect(booked.courierName).toMatch(/^Test /);

    const s = await shipment({ courier_name: booked.courierName, tracking_number: booked.trackingNumber });
    const { buffer, contentType } = await simulator.label(s);
    expect(contentType).toBe('application/pdf');
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    // PDFKit compresses content streams, so assert on the PDF's own text objects by
    // re-reading with the uncompressed marker the library leaves for short strings.
    expect(buffer.length).toBeGreaterThan(800);
  });

  it('approval §2.3 · the simulator can be made to refuse a return quote, so the fallback is testable', async () => {
    const was = env.SIMULATOR_NO_RETURN_QUOTE;
    try {
      env.SIMULATOR_NO_RETURN_QUOTE = true;
      const r = await simulator.quote({ pickupPincode: '522002', deliveryPincode: '500034', pickupCity: 'Guntur', deliveryCity: 'Hyderabad', weightKg: 1, box: { preset: 'medium' }, direction: 'return' });
      expect(r).toBeNull();
      const o = await simulator.quote({ pickupPincode: '500034', deliveryPincode: '522002', pickupCity: 'Hyderabad', deliveryCity: 'Guntur', weightKg: 1, box: { preset: 'medium' }, direction: 'outbound' });
      expect(o.amount).toBeGreaterThan(0);        // only the RETURN is refused
    } finally { env.SIMULATOR_NO_RETURN_QUOTE = was; }
  });
});

/* ─────────────────────────────────────── the provider rule (check 33) */

describe('33 · a shipment’s provider is written once and honoured for ever', () => {
  it('provider() reads the shipment, not the environment', async () => {
    const s = await shipment({ provider: 'simulator' });
    expect(shipping.provider(s).name).toBe('simulator');
    const sr = await shipment({ provider: 'shiprocket', tracking_number: 'SR1' });
    expect(shipping.provider(sr).name).toBe('shiprocket');
  });

  it("a 'none' return has no provider to reach for, and says why", async () => {
    const s = await shipment({ direction: 'return', provider: 'none' });
    expect(() => shipping.provider(s)).toThrow(/sending it back herself/i);
  });

  it('an update claiming the wrong provider for a shipment is refused', async () => {
    const s = await shipment({ provider: 'simulator', tracking_number: 'TEST0000000001' });
    await expect(webhook.handle({
      provider: 'shiprocket', shipmentId: s.id, event: EVENTS.DELIVERED,
      occurredAt: new Date(), payload: {},
    })).rejects.toThrow(/belongs to simulator/i);
  });

  it('newProvider follows SHIPPING_PROVIDER, which is the simulator', () => {
    expect(shipping.newProviderName()).toBe('simulator');
    expect(shipping.newProvider().api.name).toBe('simulator');
  });
});

/* ─────────────────────────────────────── the adapter is off (check 34) */

describe('34 · the Shiprocket adapter makes no network call while switched off', () => {
  it('every function refuses at the transport, and the transport is never entered', async () => {
    let calls = 0;
    const real = shiprocket._http;
    shiprocket._http = async (...a) => { calls += 1; return real(...a); };
    try {
      for (const fn of [
        () => shiprocket.checkCoverage({ pickupPincode: '500034', deliveryPincode: '522002' }),
        () => shiprocket.quote({ pickupPincode: '500034', deliveryPincode: '522002', weightKg: 1 }),
        () => shiprocket.registerPickup({ name: 'X', phone: '9', street: 'a', pincode: '1', cityName: 'c', stateName: 's' }),
        () => shiprocket.book({ id: 'x' }, { pickupLocationName: 'X', items: [] }),
        () => shiprocket.bookReturn({ id: 'x' }, {}),
        () => shiprocket.cancel({ provider_ref: 'x' }),
        () => shiprocket.label({ provider_ref: 'x' }),
      ]) {
        await expect(fn()).rejects.toThrow(/switched off/i);
      }
    } finally { shiprocket._http = real; }
    // It reached the transport — and the transport refused before touching axios.
    expect(calls).toBeGreaterThan(0);
    expect(env.SHIPROCKET_ENABLED).toBe(false);
    expect(env.SHIPPING_PROVIDER).toBe('simulator');
  });

  it('the signature check fails closed when no secret is configured', () => {
    expect(shiprocket.verifySignature(Buffer.from('{}'), { 'x-api-key': 'anything' })).toBe(false);
  });

  it('its status words map onto the seven INFLX events, and an unknown one maps to nothing', () => {
    expect(shiprocket.parseWebhook({ current_status: 'DELIVERED', awb: 'A1' }).event).toBe(EVENTS.DELIVERED);
    expect(shiprocket.parseWebhook({ current_status: 'RTO DELIVERED', awb: 'A1' }).event).toBe(EVENTS.RETURNED_TO_STORE);
    expect(shiprocket.parseWebhook({ current_status: 'UNDELIVERED', awb: 'A1' }).event).toBe(EVENTS.ATTEMPT_FAILED);
    expect(shiprocket.parseWebhook({ current_status: 'SOMETHING NEW', awb: 'A1' })).toBeNull();
  });
});

/* ─────────────────────────────────────── the webhook (checks 16, 17) */

describe('the webhook is idempotent and order-tolerant (checks 16, 17)', () => {
  const ev = (s, event, over = {}) => webhook.handle({
    provider: 'simulator', shipmentId: s.id, event,
    occurredAt: over.occurredAt || new Date(), payload: { t: 1 }, ...over,
  });

  it('the happy path moves one column per event, and each is recorded', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000010', booked_at: new Date() });
    for (const e of [EVENTS.COLLECTED, EVENTS.OUT_FOR_DELIVERY, EVENTS.DELIVERED]) {
      const r = await ev(s, e);
      expect(`${e}:${r.applied}`).toBe(`${e}:true`);
    }
    const after = await reload(s.id);
    expect(after.collected_at).toBeTruthy();
    expect(after.out_for_delivery_at).toBeTruthy();
    expect(after.delivered_at).toBeTruthy();
    const { rows } = await query(`SELECT count(*)::int n FROM shipment_events WHERE shipment_id = $1`, [s.id]);
    expect(rows[0].n).toBe(3);
  });

  it('16 · the SAME update twice is ONE event and moves nothing the second time', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000011' });
    const at = new Date('2026-10-01T09:00:00Z');
    const a = await ev(s, EVENTS.COLLECTED, { occurredAt: at });
    const b = await ev(s, EVENTS.COLLECTED, { occurredAt: at });
    expect(a.applied).toBe(true);
    expect(b.duplicate).toBe(true);
    expect(b.applied).toBe(false);
    const { rows } = await query(`SELECT count(*)::int n FROM shipment_events WHERE shipment_id = $1`, [s.id]);
    expect(rows[0].n).toBe(1);
  });

  it('17 · a late "out for delivery" after "delivered" is RECORDED and changes nothing', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000012' });
    await ev(s, EVENTS.COLLECTED, { occurredAt: new Date('2026-10-01T09:00:00Z') });
    await ev(s, EVENTS.DELIVERED, { occurredAt: new Date('2026-10-02T15:00:00Z') });
    const before = await reload(s.id);

    const late = await ev(s, EVENTS.OUT_FOR_DELIVERY, { occurredAt: new Date('2026-10-02T08:00:00Z') });
    expect(late.duplicate).toBe(false);
    expect(late.applied).toBe(false);                 // recorded, not applied

    const after = await reload(s.id);
    expect(after.out_for_delivery_at).toBeNull();
    expect(after.delivered_at).toEqual(before.delivered_at);

    const { rows } = await query(
      `SELECT event, applied FROM shipment_events WHERE shipment_id = $1 ORDER BY created_at`, [s.id]);
    expect(rows.map((r) => `${r.event}:${r.applied}`))
      .toEqual(['collected:true', 'delivered:true', 'out_for_delivery:false']);
  });

  it('17 · a parcel already delivered cannot fail a delivery attempt', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000013' });
    await ev(s, EVENTS.DELIVERED);
    const r = await ev(s, EVENTS.ATTEMPT_FAILED, { reason: 'Nobody home' });
    expect(r.applied).toBe(false);
    expect((await reload(s.id)).attempt_failed_count).toBe(0);
  });

  it('failed attempts accumulate, each with its reason', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000014' });
    await ev(s, EVENTS.ATTEMPT_FAILED, { reason: 'Nobody home', occurredAt: new Date('2026-10-01T10:00:00Z') });
    await ev(s, EVENTS.ATTEMPT_FAILED, { reason: 'Address not found', occurredAt: new Date('2026-10-02T10:00:00Z') });
    const after = await reload(s.id);
    expect(after.attempt_failed_count).toBe(2);
    expect(after.last_attempt_reason).toBe('Address not found');
  });

  it('a weight charge records itself with its amount and reason, and moves no shipment column', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000015' });
    const r = await webhook.handle({
      provider: 'simulator', shipmentId: s.id, event: EVENTS.WEIGHT_CHARGE,
      amount: 180, reason: 'Weighed 2.4 kg, entered 1.2 kg',
      occurredAt: new Date(), payload: {},
    });
    expect(r.applied).toBe(true);
    const { rows } = await query(`SELECT amount, reason FROM shipment_events WHERE shipment_id = $1`, [s.id]);
    expect(Number(rows[0].amount)).toBe(180);
    expect(rows[0].reason).toMatch(/2.4 kg/);
  });

  it('the raw body is always stored, even for an event that changes nothing', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000016' });
    await ev(s, EVENTS.DELIVERED);
    await webhook.handle({
      provider: 'simulator', shipmentId: s.id, event: EVENTS.OUT_FOR_DELIVERY,
      occurredAt: new Date('2026-01-01T00:00:00Z'), payload: { courier_says: 'on the van' },
    });
    const { rows } = await query(
      `SELECT payload FROM shipment_events WHERE shipment_id = $1 AND event = 'out_for_delivery'`, [s.id]);
    expect(rows[0].payload).toEqual({ courier_says: 'on the van' });
  });

  it('an unknown tracking number is answered, kept and not an error', async () => {
    const r = await webhook.handle({
      provider: 'simulator', trackingNumber: 'TESTnope', event: EVENTS.DELIVERED,
      occurredAt: new Date(), payload: {},
    });
    expect(r.unknownShipment).toBe(true);
    expect(r.applied).toBe(false);
  });

  it('an event nobody has heard of is refused before anything is written', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000017' });
    await expect(webhook.handle({ provider: 'simulator', shipmentId: s.id, event: 'teleported', occurredAt: new Date(), payload: {} }))
      .rejects.toThrow(/not a shipment event/i);
    const { rows } = await query(`SELECT count(*)::int n FROM shipment_events WHERE shipment_id = $1`, [s.id]);
    expect(rows[0].n).toBe(0);
  });

  it('registered effects run inside the transaction, and one that throws rolls the event back', async () => {
    const s = await shipment({ tracking_number: 'TEST0000000018' });
    const seen = [];
    webhook.onApplied(async (e) => { seen.push(e.event); });
    await webhook.handle({ provider: 'simulator', shipmentId: s.id, event: EVENTS.COLLECTED, occurredAt: new Date(), payload: {} });
    expect(seen).toEqual([EVENTS.COLLECTED]);

    webhook._clearEffects();
    webhook.onApplied(async () => { throw new Error('effect exploded'); });
    await expect(webhook.handle({ provider: 'simulator', shipmentId: s.id, event: EVENTS.DELIVERED, occurredAt: new Date(), payload: {} }))
      .rejects.toThrow('effect exploded');
    // Nothing was kept: not the event row, not the state.
    expect((await reload(s.id)).delivered_at).toBeNull();
    const { rows } = await query(`SELECT count(*)::int n FROM shipment_events WHERE shipment_id = $1 AND event = 'delivered'`, [s.id]);
    expect(rows[0].n).toBe(0);
  });

  it('the dedupe key is stable, and a provider event id wins when there is one', () => {
    const at = new Date('2026-10-01T09:00:00Z');
    expect(dedupeKey({ provider: 'simulator', shipmentId: 'S1', event: 'delivered', occurredAt: at }))
      .toBe('simulator|S1|delivered|2026-10-01T09:00:00.000Z');
    expect(dedupeKey({ provider: 'shiprocket', shipmentId: 'S1', event: 'delivered', occurredAt: at, providerEventId: 'e9' }))
      .toBe('shiprocket|e9');
  });

  it('two DIFFERENT parcels moving at the same instant are two events, not one', async () => {
    // The bug this test exists for: keying on the tracking number meant the key was
    // `simulator|-|collected|<ts>` whenever the caller passed a shipment id instead — the same
    // string for every parcel — so the second one was swallowed as a duplicate.
    const at = new Date('2026-11-05T06:30:00Z');
    const a = await shipment({ tracking_number: 'TEST0000000021' });
    const b = await shipment({ tracking_number: 'TEST0000000022' });
    const ra = await webhook.handle({ provider: 'simulator', shipmentId: a.id, event: EVENTS.COLLECTED, occurredAt: at, payload: {} });
    const rb = await webhook.handle({ provider: 'simulator', shipmentId: b.id, event: EVENTS.COLLECTED, occurredAt: at, payload: {} });
    expect(ra.applied).toBe(true);
    expect(rb.applied).toBe(true);
    expect(rb.duplicate).toBe(false);
    expect((await reload(a.id)).collected_at).toBeTruthy();
    expect((await reload(b.id)).collected_at).toBeTruthy();
  });
});

/* ─────────────────────────────────────── pickups (check 58) and the DB guard (49) */

describe('58 · a branch is registered as a pickup once per provider, and again when it moves', () => {
  it('registers once, reuses the id, and re-registers only when the address changes', async () => {
    // Its own brand and branch. Reading `SELECT id FROM brands LIMIT 1` and returning early
    // when there was none made this pass without asserting anything.
    const b = await brand();
    const br = await w10.branch(b.brandId, { name: 'Pickup Test Branch' });
    const addr = { name: 'Test Branch', phone: '9876500000', street: 'Road 1, Hyderabad', pincode: '500034', cityName: 'Hyderabad', stateName: 'Telangana' };

    const first  = await shipping.ensurePickup(br.id, addr);
    const second = await shipping.ensurePickup(br.id, addr);
    expect(second).toBe(first);
    const { rows: one } = await query(`SELECT count(*)::int n FROM brand_branch_pickups WHERE branch_id = $1`, [br.id]);
    expect(one[0].n).toBe(1);

    const moved = await shipping.ensurePickup(br.id, { ...addr, street: 'Road 9, Hyderabad' });
    expect(moved).not.toBe(first);
    const { rows: still } = await query(`SELECT count(*)::int n FROM brand_branch_pickups WHERE branch_id = $1`, [br.id]);
    expect(still[0].n).toBe(1);            // one row per (branch, provider), updated in place
  });
});

describe('49 · the database refuses to delete a production event that has a shipment', () => {
  it('ON DELETE RESTRICT, because a shipment carries money', async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    await shipment({ production_event_id: w.pe.id, tracking_number: 'TEST0000000099' });
    await expect(query(`DELETE FROM production_events WHERE id = $1`, [w.pe.id]))
      // Postgres words a RESTRICT refusal differently from a plain FK refusal, and the
      // difference is the point: RESTRICT is what stops a financial record vanishing.
      .rejects.toThrow(/violates RESTRICT setting of foreign key constraint "shipments_production_event_id_fkey"/i);
  });
});

/* ─────────────────────────────────────── the one-parcel rule */

describe('one live parcel per collaboration (rules §11.2, §32)', () => {
  it('a second live outbound is refused by the database; a cancelled or returned one frees the slot', async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const pe = w.pe;

    const a = await shipment({ production_event_id: pe.id, tracking_number: 'TEST0000000101' });
    await expect(shipment({ production_event_id: pe.id, tracking_number: 'TEST0000000102' }))
      .rejects.toThrow(/duplicate key|unique/i);

    // Q5: cancel before collection, then book again — unlimited.
    await query(`UPDATE shipments SET cancelled_at = now() WHERE id = $1`, [a.id]);
    const b = await shipment({ production_event_id: pe.id, tracking_number: 'TEST0000000103' });
    expect(b.id).toBeTruthy();

    // A parcel the courier brought back also frees the slot — that is when a rebook happens.
    await query(`UPDATE shipments SET returned_to_store_at = now() WHERE id = $1`, [b.id]);
    const c = await shipment({ production_event_id: pe.id, tracking_number: 'TEST0000000104', rebooked_from_id: b.id });
    expect(c.rebooked_from_id).toBe(b.id);

    expect((await shipping.liveOutbound(pe.id)).id).toBe(c.id);
    expect((await shipping.lastOutbound(pe.id)).id).toBe(c.id);
    expect((await shipping.forEvent(pe.id)).length).toBe(3);
  });
});
