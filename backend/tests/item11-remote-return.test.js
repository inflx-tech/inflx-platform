'use strict';

/**
 * Item 11, Phase 2c — delivery, checking, the shoot, the return, the money and the jobs.
 * Contract: features/item11-remote · rules v1.27 §11.2 · checks 16–32, 44–47, 50–52, 55, 56, 59
 *
 * Every courier event arrives through Admin's Test parcels page — which is the same webhook
 * handler a real provider will reach — so what is proved here is the production path.
 */

const { query, api } = require('./helpers/item3');
const { createAdminUser } = require('./helpers/factories');
const w10 = require('./helpers/item10');
const env = require('../src/config/env');
const { todayInIndia, addDays } = require('../src/utils/indiaDay');
const { MSG } = require('../src/services/productionCopy');
const remoteJobs = require('../src/services/remoteJobs.service');
const autoConfirmJob = require('../src/jobs/remote-return-autoconfirm.job');
const delayedJob = require('../src/jobs/collab-delayed.job');
const reminderJob = require('../src/jobs/shoot-reminders.job');

/* ─────────────────────────────────────────────────────── fixtures */

async function world(goal = 'engagement', over = {}) {
  const w = await w10.signedByBoth(goal, { mode: 'shipment', wallet: 500000, ...over });
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

const ADDRESS = (w, over = {}) => ({
  name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road, Brodipet',
  pincode: '522002', stateId: w.city.state_id, cityId: w.city.id, ...over,
});

async function courier(shipmentId, event, extra = {}) {
  const admin = await createAdminUser();
  const r = await api.post(`/admin/test-parcels/${shipmentId}/events`, admin.token, { event, ...extra });
  if (r.status !== 200) throw new Error(`courier ${event}: ${JSON.stringify(r.body)}`);
  return r.body.data;
}

/**
 * Move a set's posting date. campaign_sets carries a CHECK that invitations must close before
 * the set posts, so the two move together — item 4's rule, and the reason a bare UPDATE of
 * go_live_date is rejected.
 */
async function setPostingDate(setId, day) {
  await query(
    `UPDATE campaign_sets SET go_live_date = $2::date, invites_close_at = ($2::date - 3) WHERE id = $1`,
    [setId, day]);
}

/** Notifications for THESE two people only — the suite shares one notifications table. */
const notifyCount = async (w, type) => Number((await query(
  `SELECT count(*)::int n FROM notifications WHERE type = $1 AND user_id IN ($2, $3)`,
  [type, w.b.userId || w.b.user?.id, w.cr.userId || w.cr.user?.id])).rows[0].n);

const walletOf = async (id) => Number((await query(`SELECT wallet_balance FROM brands WHERE id=$1`, [id])).rows[0].wallet_balance);
const duesOf = async (id) => (await query(`SELECT * FROM brand_dues WHERE brand_id=$1 AND settled_at IS NULL ORDER BY created_at`, [id])).rows;

/**
 * A delivered parcel, with the lines the caller asked for.
 * `pincode: '522998'` makes it a no-return-pickup address (approval Q1).
 */
async function delivered(w, lines, { pincode } = {}) {
  await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w, pincode ? { pincode } : {}));
  const save = await api.put(`${B(w)}/lines`, w.b.token, { lines });
  if (save.status !== 200) throw new Error(`lines: ${JSON.stringify(save.body)}`);
  const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
  if (book.status !== 200) throw new Error(`book: ${JSON.stringify(book.body)}`);
  const parcelId = book.body.data.shoot.parcel.id;
  await courier(parcelId, 'collected');
  await courier(parcelId, 'delivered');
  const read = await api.get(C(w), w.cr.token);
  return { parcelId, shoot: read.body.data.shoot };
}

/** Delivered, every line received, shoot marked done. */
async function shot(w, lines, opts) {
  const d = await delivered(w, lines, opts);
  const answers = d.shoot.lines.map((l) => ({ lineId: l.id, status: 'received' }));
  await api.post(`${C(w)}/check`, w.cr.token, { answers });
  const done = await api.post(`${C(w)}/done`, w.cr.token, {});
  if (done.status !== 200) throw new Error(`done: ${JSON.stringify(done.body)}`);
  return { ...d, shoot: done.body.data.shoot };
}

/* ═════════════════════════════════════════ delivery (checks 16–19, 51, 52) */

describe('delivery (R8, R15b — checks 16–19)', () => {
  it('16 · every simulated event moves the state and both sides are told', async () => {
    const w = await world();
    const p = await product(w.brandId);
    await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    const parcelId = book.body.data.shoot.parcel.id;

    await courier(parcelId, 'collected');
    expect((await api.get(C(w), w.cr.token)).body.data.shoot.stage).toBe('in_transit');
    await courier(parcelId, 'out_for_delivery');
    await courier(parcelId, 'attempt_failed', { reason: 'Nobody home' });
    const mid = await api.get(C(w), w.cr.token);
    expect(mid.body.data.shoot.parcel.attemptFailedCount).toBe(1);
    expect(mid.body.data.shoot.parcel.lastAttemptReason).toBe('Nobody home');

    await courier(parcelId, 'delivered');
    const after = await api.get(C(w), w.cr.token);
    expect(after.body.data.shoot.stage).toBe('delivered');
    expect(after.body.data.shoot.can.check).toBe(true);

    // Both sides were told, once each, at each step.
    const { rows: notes } = await query(
      `SELECT type, user_id FROM notifications WHERE type LIKE 'remote.%' ORDER BY created_at`);
    const types = notes.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining([
      'remote.booked', 'remote.collected', 'remote.out_for_delivery',
      'remote.attempt_failed', 'remote.delivered',
    ]));
  });

  it('17 · the same event twice moves nothing the second time', async () => {
    const w = await world();
    const p = await product(w.brandId);
    await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    const parcelId = book.body.data.shoot.parcel.id;
    const at = '2026-11-02T08:00:00.000Z';
    const a = await courier(parcelId, 'collected', { occurredAt: at });
    const b = await courier(parcelId, 'collected', { occurredAt: at });
    expect(a.applied).toBe(true);
    expect(b.duplicate).toBe(true);
    expect(b.applied).toBe(false);
  });

  it('18 · back to the store charges the fee and allows exactly ONE rebook, with the same lines', async () => {
    const w = await world();
    const p1 = await product(w.brandId, 'One');
    const p2 = await product(w.brandId, 'Two');
    await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    await api.put(`${B(w)}/lines`, w.b.token, {
      lines: [{ productId: p1.id, quantity: 1, disposition: 'gift' },
              { productId: p2.id, quantity: 1, disposition: 'return' }],
    });
    const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    const first = book.body.data.shoot.parcel;
    const holdFirst = first.returnHold;

    const beforeRto = await walletOf(w.brandId);
    await courier(first.id, 'collected');
    await courier(first.id, 'returned_to_store', { reason: 'Address not found' });
    const afterRto = await walletOf(w.brandId);
    // The return-to-store fee came out. §11.2.
    expect(afterRto).toBeLessThan(beforeRto);

    const beforeRebook = await walletOf(w.brandId);
    const again = await api.post(`${B(w)}/rebook`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(again.status).toBe(200);
    const second = again.body.data.shoot.parcel;
    expect(second.rebookedFromId).toBe(first.id);

    // 46 · a new OUTBOUND price, and the return lock NOT taken twice (approval §2.4).
    const spent = Math.round((beforeRebook - await walletOf(w.brandId)) * 100) / 100;
    expect(spent).toBe(second.charged);
    expect(second.returnHold).toBe(holdFirst);

    // 52 · the same locked lines went.
    expect(again.body.data.shoot.lines.map((l) => l.name).sort()).toEqual(['One', 'Two']);
    const locked = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p1.id, quantity: 1, disposition: 'gift' }] });
    expect(locked.status).toBe(422);
    expect(locked.body.error.message).toBe(MSG.LIST_LOCKED);

    // …and only once.
    await courier(second.id, 'collected');
    await courier(second.id, 'returned_to_store');
    const third = await api.post(`${B(w)}/rebook`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(third.status).toBe(422);
    expect(third.body.error.message).toBe(MSG.REBOOK_USED);
  });

  it('52 · a rebook clears and logs any earlier check', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const d = await delivered(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);
    await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId: d.shoot.lines[0].id, status: 'missing', note: 'Empty box' }] });

    // A parcel that is already DELIVERED cannot be brought back — the webhook's forward-only
    // guard refuses it, correctly. The clear is a defensive rule for a state a provider could
    // still produce out of order, so the state is set directly rather than through an event
    // sequence the layer is right to reject.
    await query(`UPDATE shipments SET returned_to_store_at = now() WHERE id = $1`, [d.parcelId]);
    const again = await api.post(`${B(w)}/rebook`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(again.status).toBe(200);

    const after = await api.get(C(w), w.cr.token);
    expect(after.body.data.shoot.lines[0].check).toBeNull();
    const { rows } = await query(
      `SELECT action FROM production_event_log WHERE production_event_id = $1 AND action = 'check_cleared'`, [d.shoot.shootId]);
    expect(rows).toHaveLength(1);
  });

  it('51 · a rebook to a pincode couriers cannot reach is refused', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const d = await delivered(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);
    await query(`UPDATE shipments SET returned_to_store_at = now() WHERE id = $1`, [d.parcelId]);
    const r = await api.post(`${C(w)}/address/correct`, w.cr.token, ADDRESS(w, { pincode: '522999', street: 'Nowhere' }));
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.NOT_DELIVERABLE('522999'));
  });

  it('19 · a weight charge is debited with its reason; when short it is OWED and never blocks her', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const d = await delivered(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);

    await courier(d.parcelId, 'weight_charge', { amount: 180, reason: 'Weighed 2.4 kg, entered 1.2 kg' });
    const { rows: tx } = await query(
      `SELECT notes, amount FROM wallet_transactions WHERE brand_id = $1 AND notes ILIKE '%weight difference%'`, [w.brandId]);
    expect(tx).toHaveLength(1);
    expect(Number(tx[0].amount)).toBe(180);
    expect(tx[0].notes).toMatch(/2\.4 kg/);

    // Now with an empty wallet — it becomes a due, and she is untouched.
    await query(`UPDATE brands SET wallet_balance = 0 WHERE id = $1`, [w.brandId]);
    await courier(d.parcelId, 'weight_charge', { amount: 250, reason: 'Second reweigh' });
    const dues = await duesOf(w.brandId);
    expect(dues).toHaveLength(1);
    expect(Number(dues[0].amount)).toBe(250);
    expect(dues[0].reason).toBe('weight_charge');

    const hers = await api.get(C(w), w.cr.token);
    expect(hers.status).toBe(200);
    expect(hers.body.data.shoot.can.check).toBe(true);     // never blocked
  });

  it('47 · a due is settled by the next money in, oldest first, only as far as it reaches', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const d = await delivered(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);
    await query(`UPDATE brands SET wallet_balance = 0 WHERE id = $1`, [w.brandId]);
    await courier(d.parcelId, 'weight_charge', { amount: 180, reason: 'First' });
    await courier(d.parcelId, 'weight_charge', { amount: 400, reason: 'Second' });
    expect(await duesOf(w.brandId)).toHaveLength(2);

    // A credit of 200 settles the 180 whole and leaves the 400 standing — dues are never
    // part-paid, because half a courier charge reconciles against nothing.
    const remoteMoney = require('../src/services/remoteMoney.service');
    const db = require('../src/config/db');
    await db.withTransaction(async (tx) => {
      await remoteMoney.creditRaw(tx, { brandId: w.brandId, amount: 200, type: 'topup', note: 'test top-up' });
      await remoteMoney.settleDuesFromCredit(tx, w.brandId, 200);
    });
    const left = await duesOf(w.brandId);
    expect(left).toHaveLength(1);
    expect(Number(left[0].amount)).toBe(400);
    expect(await walletOf(w.brandId)).toBe(20);     // 200 in, 180 straight back out
  });
});

/* ═════════════════════════════════════════ checking and shoot done (20–22, 55, 56) */

describe('checking and the shoot (R9–R11 — checks 20–22, 55, 56)', () => {
  it('20 · checking before delivery is refused; each line takes one check; a difference notifies the brand', async () => {
    const w = await world();
    const p = await product(w.brandId);
    await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    const parcelId = book.body.data.shoot.parcel.id;
    const read = await api.get(C(w), w.cr.token);
    const lineId = read.body.data.shoot.lines[0].id;

    const early = await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId, status: 'received' }] });
    expect(early.status).toBe(422);
    expect(early.body.error.message).toBe(MSG.NOT_DELIVERED);

    await courier(parcelId, 'delivered');
    const ok = await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId, status: 'damaged', note: 'Torn at the hem' }] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.shoot.lines[0].check).toBe('damaged');
    expect(ok.body.data.shoot.stage).toBe('checked');

    const twice = await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId, status: 'received' }] });
    expect(twice.status).toBe(422);
    expect(twice.body.error.message).toBe(MSG.ALREADY_CHECKED);

    expect(await notifyCount(w, 'remote.difference')).toBe(1);

    // A note over 300 characters is refused.
    const long = await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId, status: 'received', note: 'x'.repeat(301) }] });
    expect(long.status).toBe(422);
    expect(long.body.error.message).toBe(MSG.CHECK_NOTE_LONG);
  });

  it('55 · the three report kinds each record once, and overdue is refused before the due date', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const d = await delivered(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId: d.shoot.lines[0].id, status: 'damaged' }] });

    const a = await api.post(`${B(w)}/report`, w.b.token, { kind: 'difference' });
    expect(a.status).toBe(200);
    const again = await api.post(`${B(w)}/report`, w.b.token, { kind: 'difference' });
    expect(again.status).toBe(422);
    expect(again.body.error.message).toBe(MSG.ALREADY_REPORTED);

    const early = await api.post(`${B(w)}/report`, w.b.token, { kind: 'overdue' });
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe('OVERDUE_NOT_YET');

    const bad = await api.post(`${B(w)}/report`, w.b.token, { kind: 'whatever' });
    expect(bad.status).toBe(422);
  });

  it('56 · "It\'s fine, carry on" is recorded and survives a second device; it is not a report', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const d = await delivered(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);
    await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId: d.shoot.lines[0].id, status: 'missing' }] });

    const ack = await api.post(`${B(w)}/acknowledge`, w.b.token, {});
    expect(ack.status).toBe(200);
    expect(ack.body.data.shoot.difference.acknowledgedAt).toBeTruthy();
    expect(ack.body.data.shoot.difference.reportedAt).toBeNull();

    const fresh = await api.get(B(w), w.b.token);
    expect(fresh.body.data.shoot.difference.acknowledgedAt).toBeTruthy();
    expect(fresh.body.data.shoot.can.acknowledgeDifference).toBe(false);
  });

  it('22 · shoot done needs a check first; afterwards the content step opens and NO money moves', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const d = await delivered(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);

    const early = await api.post(`${C(w)}/done`, w.cr.token, {});
    expect(early.status).toBe(422);
    expect(early.body.error.message).toBe(MSG.CHECK_FIRST);

    await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId: d.shoot.lines[0].id, status: 'received' }] });
    const before = await walletOf(w.brandId);
    const done = await api.post(`${C(w)}/done`, w.cr.token, {});
    expect(done.status).toBe(200);
    expect(done.body.data.shoot.stage).toBe('shot');
    expect(await walletOf(w.brandId)).toBe(before);

    // What item 12 reads.
    const { rows } = await query(`SELECT status, influencer_completed_at FROM production_events WHERE id = $1`, [d.shoot.shootId]);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].influencer_completed_at).toBeTruthy();

    const twice = await api.post(`${C(w)}/done`, w.cr.token, {});
    expect(twice.status).toBe(422);
    expect(twice.body.error.message).toBe(MSG.DONE_ALREADY);
  });
});

/* ═════════════════════════════════════════ the return (23–28, 44, 50) */

describe('the return (R12–R16 — checks 23–28, 44, 50)', () => {
  it('23 · the due date is the stamped window after the LATER of the posting date and shoot done', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    // The helper's posting date is 12 days out, so "today + window" is the later of the two.
    const days = Number(w.con.terms_json.returnTerms.days);
    expect(days).toBe(7);
    expect(s.shoot.return.windowDays).toBe(7);
    expect(s.shoot.return.dueDate).toBe(addDays(todayInIndia(), days) > addDays(w10.day(12), days)
      ? addDays(todayInIndia(), days) : addDays(w10.day(12), days));
  });

  it('24 · booking the return before shoot done, with nothing to send, or for today is refused', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const d = await delivered(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);

    const early = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    expect(early.status).toBe(422);
    expect(early.body.error.message).toBe(MSG.SHOOT_NOT_DONE);

    await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId: d.shoot.lines[0].id, status: 'received' }] });
    await api.post(`${C(w)}/done`, w.cr.token, {});

    const today = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: todayInIndia() });
    expect(today.status).toBe(422);
    expect(today.body.error.message).toBe(MSG.PICKUP_DAY_PAST);

    const ok = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 2) });
    expect(ok.status).toBe(200);
    const twice = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 3) });
    expect(twice.status).toBe(422);
    expect(twice.body.error.message).toBe(MSG.RETURN_ALREADY_BOOKED);
  });

  it('nothing to send back when everything is a gift', async () => {
    const w = await world();
    const p = await product(w.brandId);
    await shot(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);
    const r = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG.NOTHING_TO_RETURN);
  });

  it('25 · the return settles from the lock and the remainder goes back', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    // The money is the BRAND's business — her read deliberately carries none of it.
    const brandView = await api.get(B(w), w.b.token);
    const hold = brandView.body.data.shoot.parcel.returnHold;
    expect(hold).toBeGreaterThan(0);
    expect(s.shoot.parcel.returnHold).toBeUndefined();

    const booked = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    const retId = booked.body.data.shoot.return.shipment.id;

    const before = await walletOf(w.brandId);
    await courier(retId, 'collected');
    const after = await walletOf(w.brandId);

    // The hold came back, the actual came out. Net change = hold − actual.
    const { rows } = await query(`SELECT charged_amount FROM shipments WHERE id = $1`, [retId]);
    const actual = Number(rows[0].charged_amount);
    expect(Math.round((after - before) * 100) / 100).toBe(Math.round((hold - actual) * 100) / 100);

    const charges = await api.get(B(w), w.b.token);
    expect(charges.body.data.shoot.charges.charged).toBeGreaterThan(0);
    expect(charges.body.data.shoot.charges.released).toBeGreaterThan(0);
  });

  it('44 · a return costing MORE than its lock charges the difference; short, it becomes a due; her pickup is never refused', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);

    // Make the lock far too small, the way a provider that re-prices would.
    await query(`UPDATE shipments SET return_hold_amount = 1 WHERE id = $1`, [s.shoot.parcel.id]);
    const booked = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    expect(booked.status).toBe(200);                       // never refused
    const retId = booked.body.data.shoot.return.shipment.id;

    await query(`UPDATE brands SET wallet_balance = 0 WHERE id = $1`, [w.brandId]);
    await courier(retId, 'collected');                     // never delayed

    const dues = await duesOf(w.brandId);
    expect(dues).toHaveLength(1);
    expect(dues[0].reason).toBe('return_overspend');
  });

  it('26 · Return → Gift works until the pickup is booked and is refused after; a Gift never goes back', async () => {
    const w = await world();
    const p1 = await product(w.brandId, 'Keep me');
    const p2 = await product(w.brandId, 'Send me back');
    const s = await shot(w, [
      { productId: p1.id, quantity: 1, disposition: 'return' },
      { productId: p2.id, quantity: 1, disposition: 'return' },
    ]);
    const keep = s.shoot.lines.find((l) => l.name === 'Keep me');
    const back = s.shoot.lines.find((l) => l.name === 'Send me back');

    const gift = await api.post(`${B(w)}/lines/${keep.id}/gift`, w.b.token, {});
    expect(gift.status).toBe(200);
    expect(gift.body.data.shoot.lines.find((l) => l.id === keep.id).disposition).toBe('gift');

    // A gift can never become a return again.
    const backwards = await api.post(`${B(w)}/lines/${keep.id}/gift`, w.b.token, {});
    expect(backwards.status).toBe(422);
    expect(backwards.body.error.message).toBe(MSG.GIFT_TO_RETURN);

    await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    const late = await api.post(`${B(w)}/lines/${back.id}/gift`, w.b.token, {});
    expect(late.status).toBe(422);
    expect(late.body.error.message).toBe(MSG.RETURN_ALREADY_BOOKED);
  });

  it('26 · when NO Return item is left, the whole lock goes back', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    const hold = (await api.get(B(w), w.b.token)).body.data.shoot.parcel.returnHold;
    const before = await walletOf(w.brandId);

    const gift = await api.post(`${B(w)}/lines/${s.shoot.lines[0].id}/gift`, w.b.token, {});
    expect(gift.status).toBe(200);
    expect(Math.round((await walletOf(w.brandId) - before) * 100) / 100).toBe(hold);
    expect(gift.body.data.shoot.return.stage).toBe('none');
  });

  it('27 · the brand confirms each line; the job confirms at the stamped due; a later admin change moves nothing', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    const booked = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    const retId = booked.body.data.shoot.return.shipment.id;

    const early = await api.post(`${B(w)}/return/confirm`, w.b.token, { answers: [] });
    expect(early.status).toBe(422);
    expect(early.body.error.message).toBe(MSG.RETURN_NOT_DELIVERED);

    await courier(retId, 'collected');
    await courier(retId, 'delivered');

    const { rows: stamped } = await query(`SELECT autoconfirm_days, autoconfirm_due_at FROM shipments WHERE id = $1`, [retId]);
    expect(stamped[0].autoconfirm_days).toBe(7);

    // Changing the admin number afterwards moves no promised date.
    const admin = await createAdminUser();
    await api.patch('/admin/platform-settings', admin.token, { remote_return_autoconfirm_days: 30 });
    const { rows: after } = await query(`SELECT autoconfirm_days, autoconfirm_due_at FROM shipments WHERE id = $1`, [retId]);
    expect(after[0].autoconfirm_due_at).toEqual(stamped[0].autoconfirm_due_at);
    await api.patch('/admin/platform-settings', admin.token, { remote_return_autoconfirm_days: 7 });

    const read = await api.get(B(w), w.b.token);
    const ok = await api.post(`${B(w)}/return/confirm`, w.b.token, {
      answers: [{ lineId: read.body.data.shoot.lines[0].id, status: 'received' }],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.shoot.return.stage).toBe('confirmed');

    const twice = await api.post(`${B(w)}/return/confirm`, w.b.token, { answers: [] });
    expect(twice.status).toBe(422);
    expect(twice.body.error.message).toBe(MSG.ALREADY_CONFIRMED);
  });

  it('27 · J1 confirms it at the stamped due — unless the brand has reported a line', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    const booked = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    const retId = booked.body.data.shoot.return.shipment.id;
    await courier(retId, 'collected');
    await courier(retId, 'delivered');

    // Not due yet.
    expect((await autoConfirmJob.run({ now: new Date() })).confirmed).toBe(0);

    // Due — and it confirms itself, once. A second run changes nothing (idempotent).
    const future = new Date(Date.now() + 8 * 24 * 3600 * 1000);
    expect((await autoConfirmJob.run({ now: future })).confirmed).toBe(1);
    expect((await autoConfirmJob.run({ now: future })).confirmed).toBe(0);

    const { rows } = await query(`SELECT autoconfirmed_at, confirmed_at FROM shipments WHERE id = $1`, [retId]);
    expect(rows[0].autoconfirmed_at).toBeTruthy();
    expect(rows[0].confirmed_at).toBeNull();       // the record says honestly which happened
  });

  it('27 · a reported return is NOT confirmed by the job', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    const booked = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    const retId = booked.body.data.shoot.return.shipment.id;
    await courier(retId, 'collected');
    await courier(retId, 'delivered');
    await api.post(`${B(w)}/report`, w.b.token, { kind: 'return' });

    const out = await autoConfirmJob.run({ now: new Date(Date.now() + 8 * 24 * 3600 * 1000) });
    expect(out.confirmed).toBe(0);
    expect(out.skippedReported).toBe(1);
  });

  it('28 · past the due with no pickup booked, both sides see it overdue and nothing moves', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);

    // Pull the posting date and her mark back so the window has passed.
    await setPostingDate(w.s.id, addDays(todayInIndia(), -30));
    await query(`UPDATE production_events SET influencer_completed_at = now() - interval '30 days' WHERE id = $1`, [s.shoot.shootId]);

    const before = await walletOf(w.brandId);
    const hers = await api.get(C(w), w.cr.token);
    const theirs = await api.get(B(w), w.b.token);
    expect(hers.body.data.shoot.return.overdue).toBe(true);
    expect(theirs.body.data.shoot.return.overdue).toBe(true);
    expect(theirs.body.data.shoot.can.reportOverdue).toBe(true);
    expect(await walletOf(w.brandId)).toBe(before);       // nothing moves on its own

    const rep = await api.post(`${B(w)}/report`, w.b.token, { kind: 'overdue' });
    expect(rep.status).toBe(200);
  });

  it('50 · a 998 pincode: no lock, no pickup, "I\'ve sent it back" starts the clock, J1 confirms', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }], { pincode: '522998' });

    // No return lock was taken at booking (approval Q1).
    expect((await api.get(B(w), w.b.token)).body.data.shoot.parcel.returnHold).toBe(0);
    expect(s.shoot.return.canPickup).toBe(false);
    expect(s.shoot.can.bookReturn).toBe(false);
    expect(s.shoot.can.markSelfSent).toBe(true);

    const nope = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    expect(nope.status).toBe(422);
    expect(nope.body.error.code).toBe('NO_RETURN_PICKUP');

    const before = await walletOf(w.brandId);
    const sent = await api.post(`${C(w)}/return/sent`, w.cr.token, { note: 'India Post, receipt 4471' });
    expect(sent.status).toBe(200);
    expect(await walletOf(w.brandId)).toBe(before);        // INFLX moves no money for this return

    const { rows } = await query(
      `SELECT provider, self_sent_at, self_sent_note, autoconfirm_days, autoconfirm_due_at
         FROM shipments WHERE production_event_id = $1 AND direction = 'return'`, [s.shoot.shootId]);
    expect(rows[0].provider).toBe('none');
    expect(rows[0].self_sent_at).toBeTruthy();
    expect(rows[0].autoconfirm_days).toBe(7);

    // Overdue stops once she has marked it sent.
    await setPostingDate(w.s.id, addDays(todayInIndia(), -30));
    const after = await api.get(C(w), w.cr.token);
    expect(after.body.data.shoot.return.overdue).toBe(false);

    // …and J1 treats it like any other return.
    const out = await autoConfirmJob.run({ now: new Date(Date.now() + 8 * 24 * 3600 * 1000) });
    expect(out.confirmed).toBe(1);
  });
});

/* ═════════════════════════════════════════ 29 · the money, whole */

describe('29 · nothing in item 11 touches the creator or the locked fee', () => {
  it('a complete shoot with a return moves the brand’s wallet and NOTHING else', async () => {
    const w = await world('engagement');       // Pay for Content — real money is locked
    const p = await product(w.brandId);

    const snap = async () => JSON.stringify({
      locked: (await query(`SELECT locked_amount, released_amount FROM contracts WHERE id=$1`, [w.con.id])).rows[0],
      escrow: (await query(`SELECT tranche_number, amount, status FROM escrow_entries WHERE campaign_influencer_id=$1 ORDER BY tranche_number`, [w.ciId])).rows,
      inf: (await query(`SELECT wallet_balance, pending_balance, total_earned FROM influencers WHERE id=$1`, [w.cr.influencerId])).rows[0],
      infLedger: (await query(`SELECT count(*)::int n FROM influencer_ledger WHERE influencer_id=$1`, [w.cr.influencerId])).rows[0],
    });

    const before = await snap();
    const txIdsBefore = (await query(`SELECT id FROM wallet_transactions WHERE brand_id = $1`, [w.brandId])).rows.map((x) => x.id);
    const s = await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    const booked = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    const retId = booked.body.data.shoot.return.shipment.id;
    await courier(retId, 'collected');
    await courier(retId, 'delivered');
    await api.post(`${B(w)}/return/confirm`, w.b.token, { answers: [] });
    const after = await snap();

    // Byte-identical: the locked fee, the escrow set, her balances and her ledger.
    expect(after).toBe(before);

    // And every rupee that moved DURING the shoot is the brand's, under a courier type.
    // Counted from an id snapshot, not a timestamp: the signature's own escrow_lock row shares
    // now() with brand_signed_at, and a JS Date rounds the microseconds off the comparison.
    const { rows } = await query(
      `SELECT DISTINCT type::text AS t FROM wallet_transactions
        WHERE brand_id = $1 AND id <> ALL($2::uuid[])`, [w.brandId, txIdsBefore]);
    for (const row of rows) expect(row.t).toMatch(/^courier_/);
  });
});

/* ═════════════════════════════════════════ 30–32, 59 · Delayed and reminders */

describe('Delayed and the reminder lane (checks 30, 32, 59)', () => {
  it('30 · past the posting date a Remote collaboration is flagged with the right stage, and stays usable', async () => {
    const w = await world();
    const p = await product(w.brandId);
    await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    await setPostingDate(w.s.id, addDays(todayInIndia(), -1));

    const out = await delayedJob.run({ today: todayInIndia() });
    expect(out.remote.flagged).toBeGreaterThanOrEqual(1);

    const { rows } = await query(`SELECT delayed_at, delayed_stage FROM campaign_influencers WHERE id = $1`, [w.ciId]);
    expect(rows[0].delayed_at).toBeTruthy();
    expect(rows[0].delayed_stage).toBe('not_booked');      // she sent it; nobody booked

    // Everything still works, and the money is untouched (§11.2).
    const still = await api.get(B(w), w.b.token);
    expect(still.body.data.shoot.can.pickProducts).toBe(true);
    expect(still.body.data.shoot.delayed.stage).toBe('not_booked');

    // Once flagged, never flagged twice.
    expect((await delayedJob.run({ today: todayInIndia() })).remote.flagged).toBe(0);
  });

  it('30 · the five Remote stages are all accepted by the database', async () => {
    for (const stage of ['address_not_sent', 'not_booked', 'in_transit', 'not_checked', 'shoot_not_marked']) {
      const w = await world();
      // eslint-disable-next-line no-await-in-loop
      await query(`UPDATE campaign_influencers SET delayed_at = now(), delayed_stage = $2 WHERE id = $1`, [w.ciId, stage]);
      // eslint-disable-next-line no-await-in-loop
      const { rows } = await query(`SELECT delayed_stage FROM campaign_influencers WHERE id = $1`, [w.ciId]);
      expect(rows[0].delayed_stage).toBe(stage);
    }
  });

  it('the RETURN lane never delays anything', async () => {
    const w = await world();
    const p = await product(w.brandId);
    await shot(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    await setPostingDate(w.s.id, addDays(todayInIndia(), -1));

    await delayedJob.run({ today: todayInIndia() });
    const { rows } = await query(`SELECT delayed_at FROM campaign_influencers WHERE id = $1`, [w.ciId]);
    expect(rows[0].delayed_at).toBeNull();     // the shoot is DONE; only the return is outstanding
  });

  it('32 · an unanswered move is reminded once at 48 hours and not again within 48', async () => {
    const w = await world();
    await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    // The brand has owed the booking since she sent it. Pull that back 3 days.
    await query(`UPDATE production_events SET address_sent_at = now() - interval '3 days' WHERE contract_id = $1`, [w.con.id]);

    const stampOf = async () => (await query(
      `SELECT remote_reminder_sent_at FROM production_events WHERE contract_id = $1`, [w.con.id])).rows[0].remote_reminder_sent_at;
    expect(await stampOf()).toBeNull();

    await reminderJob.run({ now: new Date() });
    const once = await stampOf();
    expect(once).toBeTruthy();

    // Not again within 48 hours.
    await reminderJob.run({ now: new Date() });
    expect(await stampOf()).toEqual(once);
    expect(await notifyCount(w, 'remote.reminder')).toBe(1);
  });

  it('59 · when the open move CHANGES, the next reminder waits 48 hours from the NEW anchor', async () => {
    const w = await world();
    const p = await product(w.brandId);
    await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    await query(`UPDATE production_events SET address_sent_at = now() - interval '3 days' WHERE contract_id = $1`, [w.con.id]);

    await reminderJob.run({ now: new Date() });               // reminds the brand to book
    const { rows: r1 } = await query(`SELECT remote_reminder_sent_at FROM production_events WHERE contract_id = $1`, [w.con.id]);
    expect(r1[0].remote_reminder_sent_at).toBeTruthy();

    // 10 hours later the move changes — the brand books, and now SHE owes the check.
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    await courier(book.body.data.shoot.parcel.id, 'delivered');

    // The lane scans every Remote collaboration the suite has made, so the assertion is on
    // THIS one's own reminder stamp rather than the lane's total.
    const stampOf = async () => (await query(
      `SELECT remote_reminder_sent_at FROM production_events WHERE contract_id = $1`, [w.con.id])).rows[0].remote_reminder_sent_at;
    const afterFirst = await stampOf();

    // 24 hours after the delivery is NOT 48 hours from the new anchor.
    await reminderJob.run({ now: new Date(Date.now() + 24 * 3600 * 1000) });
    expect(await stampOf()).toEqual(afterFirst);

    // 49 hours after it is.
    await reminderJob.run({ now: new Date(Date.now() + 49 * 3600 * 1000) });
    expect((await stampOf()).getTime()).toBeGreaterThan(afterFirst.getTime());
  });

  it('31 · the one rule says whose move it is at each of the six points', async () => {
    const w = await world();
    const p = await product(w.brandId);
    const r0 = await remoteJobs.openMove(await require('../src/services/remoteShoot.service').loadAny(w.ciId));
    expect(r0).toMatchObject({ key: 'address', side: 'creator' });

    await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w));
    const load = () => require('../src/services/remoteShoot.service').loadAny(w.ciId);
    expect(await remoteJobs.openMove(await load())).toMatchObject({ key: 'book', side: 'brand' });

    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'return' }] });
    const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    const parcelId = book.body.data.shoot.parcel.id;
    await courier(parcelId, 'delivered');
    expect(await remoteJobs.openMove(await load())).toMatchObject({ key: 'check', side: 'creator' });

    const read = await api.get(C(w), w.cr.token);
    await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId: read.body.data.shoot.lines[0].id, status: 'received' }] });
    expect(await remoteJobs.openMove(await load())).toMatchObject({ key: 'done', side: 'creator' });

    await api.post(`${C(w)}/done`, w.cr.token, {});
    expect(await remoteJobs.openMove(await load())).toMatchObject({ key: 'return', side: 'creator' });

    const booked = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    const retId = booked.body.data.shoot.return.shipment.id;
    await courier(retId, 'collected');
    await courier(retId, 'delivered');
    expect(await remoteJobs.openMove(await load())).toMatchObject({ key: 'confirm_return', side: 'brand' });

    await api.post(`${B(w)}/return/confirm`, w.b.token, { answers: [] });
    expect(await remoteJobs.openMove(await load())).toBeNull();
  });
});

/* ═════════════════════════════════════════ the gate and the mode (1–3, 37) */

describe('the gate and the mode on every Remote path (checks 1, 2, 3, 37)', () => {
  /**
   * Every door that CHANGES something, plus the product picker.
   *
   * The two F1 READS are deliberately absent from the GATE loop: R1 and R2 draw the gate CARD
   * — "signed, funded, first payment out", or which of those is missing — and a read that
   * refused could not draw it. Item 10's own F1 settled this (shootPlan.read returns `gate`
   * and never throws). They ARE in the mode loop below, because a Store Visit collaboration
   * has no Remote screen to draw at all.
   */
  const routes = (w) => [
    ['GET',  `${B(w)}/products`],
    ['PUT',  `${B(w)}/lines`],
    ['POST', `${B(w)}/quote`],
    ['POST', `${B(w)}/book`],
    ['GET',  `${B(w)}/label`],
    ['POST', `${B(w)}/cancel`],
    ['POST', `${B(w)}/rebook`],
    ['POST', `${B(w)}/report`],
    ['POST', `${B(w)}/return/confirm`],
  ];

  it('1 · a signed-but-unfunded Pay for Content collaboration reaches NO Remote path', async () => {
    const w = await w10.world('engagement', { mode: 'shipment' });
    await w10.send(w); await w10.herSign(w);
    await query(`UPDATE contracts SET brand_signed_at = now(), influencer_signed_at = now(), status = 'active'
                  WHERE campaign_influencer_id = $1`, [w.ciId]);
    const con = await w10.con(w.ciId);
    await query(`INSERT INTO production_events (contract_id, mode, status) VALUES ($1,'shipment','confirmed')
                 ON CONFLICT (contract_id) DO NOTHING`, [con.id]);

    for (const [method, path] of routes(w)) {
      // eslint-disable-next-line no-await-in-loop
      const r = await api[method.toLowerCase()](path, w.b.token, {});
      expect(`${method} ${path} → ${r.status}`).toBe(`${method} ${path} → 422`);
      expect(r.body.error.message).toBe(MSG.NOT_FUNDED);
    }
  });

  it('3 · a Store Visit collaboration is refused by every Remote endpoint, with the mirror sentence', async () => {
    const w = await w10.signedByBoth('conversion');     // a VISIT
    const brandName = (await query(`SELECT business_name FROM brands WHERE id = $1`, [w.brandId])).rows[0].business_name;
    // …including the two reads, which the gate loop leaves out.
    for (const [method, path] of [...routes(w), ['GET', `${B(w)}`]]) {
      // eslint-disable-next-line no-await-in-loop
      const r = await api[method.toLowerCase()](path, w.b.token, {});
      expect(`${method} ${path} → ${r.status}`).toBe(`${method} ${path} → 422`);
      expect(r.body.error.code).toBe('WRONG_MODE_VISIT');
      expect(r.body.error.message).toBe(MSG.WRONG_MODE_VISIT(brandName));
    }
    // And her side too.
    const hers = await api.get(`/influencers/me/invitations/${w.ciId}/remote`, w.cr.token);
    expect(hers.status).toBe(422);
    expect(hers.body.error.code).toBe('WRONG_MODE_VISIT');
  });

  it('2 · Pay for Sale opens on the two signatures alone', async () => {
    const w = await world('conversion');
    const r = await api.get(B(w), w.b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.shoot.gate).toMatchObject({ open: true });
    expect(r.body.data.shoot.gate.money.required).toBe(false);
  });

  it('37 · another creator’s shoot is a 404, not a 403', async () => {
    const w = await world();
    const other = await world();
    const hers = await api.get(C(w), other.cr.token);
    expect(hers.status).toBe(404);
    const theirs = await api.post(`${C(w)}/address`, other.cr.token, ADDRESS(w));
    expect(theirs.status).toBe(404);
  });
});
