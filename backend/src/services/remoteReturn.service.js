'use strict';

/**
 * remoteReturn.service.js — F12–F17 and the return's own lane.
 * Contract: features/item11-remote · rules v1.27 §11.2 (with §25, §26) · mockups R9–R16
 *
 * FOUR RULES THAT SHAPE EVERY FUNCTION HERE
 *
 * 1. **A difference never stops her** (§26). She records what arrived, the brand is told, Admin
 *    can see it — and her shoot carries on. Nothing here can block, delay or un-mark her work.
 * 2. **She marks the shoot done. The brand does not confirm it** (§25). It opens the content
 *    step and moves no money.
 * 3. **The return is its own lane.** It never holds up the content step or any payment, and it
 *    never makes a collaboration Delayed. Overdue is a label, not a state change.
 * 4. **Nothing in the return is ever charged to the creator** — including the case where
 *    couriers will not collect from her pincode and she posts the items back herself, which the
 *    brand settles with her outside INFLX (v1.27, approval Q1).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const shipping = require('./shipping');
const money = require('./remoteMoney.service');
const shoot = require('./remoteShoot.service');
const address = require('./remoteAddress.service');
const platformSettings = require('./platformSettings.service');
const { MSG, NOTIFY11, nextStepWords } = require('./productionCopy');
const { longDate } = require('./campaignCopy');
const { logAction } = require('./production.service');
const { todayInIndia, calendarDay, addDays, daysBetween, istDayOf } = require('../utils/indiaDay');

const VERDICTS = ['received', 'missing', 'damaged'];
const REPORT_KINDS = ['difference', 'return', 'overdue'];

/* ───────────────────────────────────────────── F12 — her check, item by item */

/**
 * Received / missing / damaged, with an optional note of at most 300 characters (§11.2).
 * There is NO DEADLINE for checking — it stays in her Needs You with reminders (§25).
 */
async function check(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);

  const parcel = await shipping.lastOutbound(r.id, conn);
  if (!parcel || !parcel.delivered_at) throw new AppError('NOT_DELIVERED', MSG.NOT_DELIVERED, 422, 'status');

  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (!answers.length) throw new AppError('VALIDATION_ERROR', 'Say what arrived.', 422, 'answers');
  for (const a of answers) {
    if (!VERDICTS.includes(a.status)) {
      throw new AppError('VALIDATION_ERROR', `"${a.status}" is not something an item can be. Use received, missing or damaged.`, 422, 'answers');
    }
    if (a.note && String(a.note).length > 300) {
      throw new AppError('VALIDATION_ERROR', MSG.CHECK_NOTE_LONG, 422, 'note');
    }
  }

  const before = await shoot.linesOf(r.id, conn);
  const byId = new Map(before.map((l) => [String(l.id), l]));
  for (const a of answers) {
    const l = byId.get(String(a.lineId));
    if (!l) throw new AppError('NOT_FOUND', 'That item is not in this parcel.', 404, 'lineId');
    // Each line takes ONE check. A second answer on the same line is refused rather than
    // silently rewriting what she first said.
    if (l.receipt_status) throw new AppError('ALREADY_CHECKED', MSG.ALREADY_CHECKED, 422, 'lineId');
  }

  await db.withTransaction(async (tx) => {
    for (const a of answers) {
      // eslint-disable-next-line no-await-in-loop
      await tx.query(
        `UPDATE production_event_items
            SET receipt_status = $3, receipt_note = $4, answered_at = now(), updated_at = now()
          WHERE id = $1 AND production_event_id = $2 AND receipt_status IS NULL`,
        [a.lineId, r.id, a.status, a.note || null]);
    }
  });

  const after = await shoot.linesOf(r.id, conn);
  const short = after.filter((l) => l.receipt_status && l.receipt_status !== 'received');

  await logAction(conn, r.id, scope.userId, 'influencer', 'parcel_checked',
    short.length
      ? `She flagged ${short.map((l) => l.name_at_dispatch).join(', ')}`
      : 'Everything arrived',
    { answered: after.filter((l) => l.receipt_status).length, total: after.length, short: short.length });

  if (short.length) {
    // §26 — the brand is told immediately, with the item NAMED. Never "there was a problem
    // with your shipment", which would make her explain a courier's mistake.
    const names = short.map((l) => l.name_at_dispatch).filter(Boolean);
    const listed = names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} more`;
    await shoot.notifyBrand(r, NOTIFY11.DIFFERENCE,
      `${shoot.first(r.creator_name)} received the parcel but flagged ${listed}. Her shoot carries on — you can report it to INFLX if you want it looked at.`);
  }

  return shoot.read(ciId, scope, conn);
}

/* ───────────────────────────────────────────── F13 — report to INFLX (three kinds) */

/**
 * Approval §2.7 — THREE kinds, not two:
 *   difference  the items she flagged (R10)
 *   return      something missing or damaged when the return arrived (R13)
 *   overdue     the return has not been sent (R15b)
 *
 * Each is recorded ONCE per kind, and `overdue` is refused before the due date passes.
 * ITEM 11 RECORDS THE REPORT AND NOTHING ELSE. Dispute handling is item 18's.
 */
async function report(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);

  const kind = String(body.kind || '');
  if (!REPORT_KINDS.includes(kind)) {
    throw new AppError('VALIDATION_ERROR', 'Say what you are reporting.', 422, 'kind');
  }
  const column = { difference: 'difference_reported_at', return: 'return_reported_at', overdue: 'overdue_reported_at' }[kind];

  if (kind === 'overdue') {
    const lines = await shoot.linesOf(r.id, conn);
    const ret = await shipping.liveReturn(r.id, conn);
    const state = shoot.returnStateOf(r, ret, lines);
    if (!state.overdue) throw new AppError('OVERDUE_NOT_YET', MSG.OVERDUE_NOT_YET, 422, 'status');
  }

  const { rowCount } = await conn.query(
    `UPDATE production_events SET ${column} = now(), difference_reported_by = COALESCE(difference_reported_by, $2), updated_at = now()
      WHERE id = $1 AND ${column} IS NULL`, [r.id, scope.userId]);
  if (rowCount === 0) throw new AppError('ALREADY_REPORTED', MSG.ALREADY_REPORTED, 422, 'status');

  await logAction(conn, r.id, scope.userId, 'brand', `reported_${kind}`,
    `The brand reported a ${kind} to INFLX`, { kind, note: body.note || null });

  return shoot.read(ciId, scope, conn);
}

/**
 * R10's quiet button — "It's fine, carry on" (approval §2.8). It dismisses the difference box
 * for the brand, across devices. It changes nothing else, and it is NOT a report.
 */
async function acknowledgeDifference(ciId, scope, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  await conn.query(
    `UPDATE production_events SET difference_acknowledged_at = COALESCE(difference_acknowledged_at, now()), updated_at = now()
      WHERE id = $1`, [r.id]);
  return shoot.read(ciId, scope, conn);
}

/* ───────────────────────────────────────────── F14 — she marks the shoot done */

/**
 * Hers alone (§25). It opens the content step and MOVES NO MONEY — which is exactly why it is
 * safe to let her give it alone, and why nothing in this function touches a wallet.
 *
 * `status = 'completed'` and `influencer_completed_at` are what item 12 will read, and what
 * item 10's own completion already writes — one vocabulary for both modes.
 */
async function markDone(ciId, scope, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (r.influencer_completed_at) throw new AppError('DONE_ALREADY', MSG.DONE_ALREADY, 422, 'status');

  // §11.2: "The Creator marks the shoot done ONCE SHE HAS CHECKED what arrived."
  const lines = await shoot.linesOf(r.id, conn);
  if (!lines.length || lines.some((l) => !l.receipt_status)) {
    throw new AppError('CHECK_FIRST', MSG.CHECK_FIRST, 422, 'status');
  }

  const { rowCount } = await conn.query(
    `UPDATE production_events
        SET influencer_completed_at = now(), status = 'completed', updated_at = now()
      WHERE id = $1 AND influencer_completed_at IS NULL`, [r.id]);
  if (rowCount === 0) throw new AppError('DONE_ALREADY', MSG.DONE_ALREADY, 422, 'status');

  await logAction(conn, r.id, scope.userId, 'influencer', 'shoot_done',
    'She marked the shoot done. The content step is open; no money moved.', null);

  const state = shoot.returnStateOf({ ...r, influencer_completed_at: new Date() }, null, lines);
  await shoot.notifyBrand(r, NOTIFY11.SHOOT_DONE,
    `${shoot.first(r.creator_name)} has finished the shoot. ${nextStepWords(r.goal, 'her')}`
    + (state.expected.length
      ? ` ${state.expected.length} item${state.expected.length === 1 ? '' : 's'} come back by ${longDate(state.dueDate)}.`
      : ''));

  return shoot.read(ciId, scope, conn);
}

/* ───────────────────────────────────────────── F15 — Return → Gift */

/**
 * The brand may turn a Return into a Gift UNTIL the return pickup is booked; it may never turn
 * a Gift into a Return once the parcel is booked (§11.2, §28). Only ever in her favour.
 *
 * When no Return item remains, the locked return amount goes back to the brand — immediately,
 * because there is nothing left for it to pay for.
 */
async function returnToGift(ciId, scope, lineId, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);

  const ret = await shipping.liveReturn(r.id, conn);
  if (ret && (ret.booked_at || ret.self_sent_at)) {
    throw new AppError('RETURN_ALREADY_BOOKED', MSG.RETURN_ALREADY_BOOKED, 422, 'status');
  }

  const { rows } = await conn.query(
    `UPDATE production_event_items
        SET disposition = 'gift', disposition_changed_at = now(), disposition_changed_by = $3, updated_at = now()
      WHERE id = $1 AND production_event_id = $2 AND disposition = 'return'
      RETURNING *`, [lineId, r.id, scope.userId]);
  if (!rows[0]) {
    // Either it is already a gift, or it is not on this parcel. A gift can never go back.
    const { rows: found } = await conn.query(
      `SELECT disposition FROM production_event_items WHERE id = $1 AND production_event_id = $2`, [lineId, r.id]);
    if (found[0] && found[0].disposition === 'gift') {
      throw new AppError('GIFT_TO_RETURN', MSG.GIFT_TO_RETURN, 422, 'lineId');
    }
    throw new AppError('NOT_FOUND', 'That item is not in this parcel.', 404, 'lineId');
  }
  const line = rows[0];

  await logAction(conn, r.id, scope.userId, 'brand', 'return_to_gift',
    `${line.name_at_dispatch || 'An item'} is hers to keep`, { line_id: line.id });

  await shoot.notifyCreator(r, NOTIFY11.RETURN_TO_GIFT,
    `${r.brand_name} says you can keep the ${line.name_at_dispatch || 'item'}. It doesn't need to go back.`);

  await releaseHoldIfNothingLeft(r, conn);
  return shoot.read(ciId, scope, conn);
}

/**
 * §11.2: "When no Return item remains, the locked return amount goes back to the Brand."
 * Two ways to get there — every Return turned Gift, or every Return item she marked MISSING
 * (§11.2: "A Return item she marked missing is not expected back from her").
 */
async function releaseHoldIfNothingLeft(r, conn = db) {
  const lines = await shoot.linesOf(r.id, conn);
  const expected = lines.filter((l) => l.disposition === 'return' && l.receipt_status === 'received');
  const stillUnchecked = lines.some((l) => l.disposition === 'return' && !l.receipt_status);
  if (expected.length > 0 || stillUnchecked) return null;

  const parcel = await shipping.lastOutbound(r.id, conn);
  const hold = Number((parcel || {}).return_hold_amount || 0);
  const released = Number((parcel || {}).return_hold_released || 0);
  if (!parcel || hold <= 0 || released > 0) return null;

  await db.withTransaction(async (tx) => {
    await money.releaseHold(tx, {
      brandId: r.brand_id, campaignId: r.campaign_id, amount: hold,
      why: `Return lock released — nothing to send back from ${shoot.first(r.creator_name)}`,
    });
    await tx.query(`UPDATE shipments SET return_hold_released = $2, updated_at = now() WHERE id = $1`, [parcel.id, hold]);
  });
  await logAction(conn, r.id, null, 'system', 'return_hold_released',
    `Nothing left to send back — ${money.fmt(hold)} back to the brand`, { amount: hold });
  return hold;
}

/* ───────────────────────────────────────────── F16 — she books the return pickup */

/**
 * From shoot done. She picks a day FROM TOMORROW; the courier comes to her door; **she pays
 * nothing and books nothing outside INFLX** (§11.2).
 *
 * The return carries every Return item she marked RECEIVED. One she marked missing is not
 * expected back from her.
 */
async function bookReturn(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (!r.influencer_completed_at) throw new AppError('SHOOT_NOT_DONE', MSG.SHOOT_NOT_DONE, 422, 'status');

  const existing = await shipping.liveReturn(r.id, conn);
  if (existing) throw new AppError('RETURN_ALREADY_BOOKED', MSG.RETURN_ALREADY_BOOKED, 422, 'status');

  const lines = await shoot.linesOf(r.id, conn);
  const expected = lines.filter((l) => l.disposition === 'return' && l.receipt_status === 'received');
  if (!expected.length) throw new AppError('NOTHING_TO_RETURN', MSG.NOTHING_TO_RETURN, 422, 'status');

  // Approval Q1 — where couriers will not collect, there is no pickup to book. She sends it
  // back herself and marks it (`markSelfSent` below).
  if (r.coverage_return_pickup === false) {
    throw new AppError('NO_RETURN_PICKUP',
      `Couriers can't collect from ${r.ship_to_pincode}. Send it back to ${r.brand_name} yourself — they cover the cost — then tap I've sent it back.`,
      422, 'status');
  }

  const day = String(body.pickupDay || '').slice(0, 10);
  const today = todayInIndia();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || daysBetween(today, day) < 1) {
    throw new AppError('PICKUP_DAY_PAST', MSG.PICKUP_DAY_PAST, 422, 'pickupDay');
  }

  const parcel = await shipping.lastOutbound(r.id, conn);
  const branch = await address.pickupBranch(r, parcel ? parcel.branch_id : null, conn);
  const provider = shipping.newProvider();

  const created = await conn.query(
    `INSERT INTO shipments
       (production_event_id, direction, provider, branch_id,
        from_name, from_phone, from_street, from_pincode, from_city_name, from_state_name,
        to_name, to_phone, to_street, to_pincode, to_city_name, to_state_name,
        box_preset, box_l_cm, box_w_cm, box_h_cm, weight_kg, pickup_day, booked_at)
     VALUES ($1,'return',$2,$3,
             $4,$5,$6,$7,$8,$9,
             $10,$11,$12,$13,$14,$15,
             $16,$17,$18,$19,$20,$21,now())
     RETURNING *`,
    [r.id, provider.name, branch ? branch.id : null,
     // FROM her door, TO the branch — the mirror of the outbound parcel.
     r.ship_to_name, r.ship_to_phone, r.ship_to_street, r.ship_to_pincode, r.ship_to_city_name, r.ship_to_state_name,
     branch ? branch.name : null, r.brand_phone, branch ? branch.formatted_address : null,
     branch ? branch.pincode : null, branch ? branch.city_name : null, branch ? branch.state_name : null,
     parcel ? parcel.box_preset : null, parcel ? parcel.box_l_cm : null, parcel ? parcel.box_w_cm : null,
     parcel ? parcel.box_h_cm : null, parcel ? parcel.weight_kg : null, day]);
  const ret = created.rows[0];

  const booked = await provider.api.bookReturn(ret, { pickupDay: day });
  await conn.query(
    `UPDATE shipments SET courier_name = $2, tracking_number = $3, provider_ref = $4, updated_at = now() WHERE id = $1`,
    [ret.id, booked.courierName, booked.trackingNumber, booked.providerRef || null]);

  await conn.query(
    `UPDATE production_event_items SET returned_on_shipment_id = $2, updated_at = now()
      WHERE production_event_id = $1 AND disposition = 'return' AND receipt_status = 'received'`,
    [r.id, ret.id]);

  await logAction(conn, r.id, scope.userId, 'influencer', 'return_booked',
    `She booked the return pickup for ${longDate(day)} — ${expected.length} item${expected.length === 1 ? '' : 's'}`,
    { shipment_id: ret.id, pickup_day: day, count: expected.length });

  await shoot.notifyBrand(r, NOTIFY11.RETURN_BOOKED,
    `${shoot.first(r.creator_name)} booked the return pickup for ${longDate(day)}. ${expected.length} item${expected.length === 1 ? '' : 's'} coming back.`);

  return shoot.read(ciId, scope, conn);
}

/* ───────────────────────────────────────────── Q1 — "I've sent it back" */

/**
 * Approval Q1, the no-courier return.
 *
 * Where couriers will not collect from her pincode, INFLX books nothing and moves no money:
 * she posts the Return items back herself and the brand covers the cost between them. Her mark
 * is what starts the brand's confirmation clock — deliberately NOT the brand opening a screen,
 * because a brand that never looks would leave her overdue for ever.
 */
async function markSelfSent(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (!r.influencer_completed_at) throw new AppError('SHOOT_NOT_DONE', MSG.SHOOT_NOT_DONE, 422, 'status');
  if (r.coverage_return_pickup !== false) {
    throw new AppError('SELF_SEND_NOT_ALLOWED', MSG.SELF_SEND_NOT_ALLOWED, 422, 'status');
  }
  const existing = await shipping.liveReturn(r.id, conn);
  if (existing) throw new AppError('RETURN_ALREADY_BOOKED', MSG.RETURN_ALREADY_BOOKED, 422, 'status');

  const lines = await shoot.linesOf(r.id, conn);
  const expected = lines.filter((l) => l.disposition === 'return' && l.receipt_status === 'received');
  if (!expected.length) throw new AppError('NOTHING_TO_RETURN', MSG.NOTHING_TO_RETURN, 422, 'status');

  const note = String(body.note || '').trim();
  if (note.length > 200) throw new AppError('VALIDATION_ERROR', MSG.SELF_SEND_NOTE_LONG, 422, 'note');

  const days = await platformSettings.get('remote_return_autoconfirm_days');
  const { rows } = await conn.query(
    `INSERT INTO shipments
       (production_event_id, direction, provider,
        from_name, from_pincode, from_city_name, to_name,
        self_sent_at, self_sent_note, autoconfirm_days, autoconfirm_due_at)
     VALUES ($1,'return','none',$2,$3,$4,$5,now(),$6,$7::int, now() + make_interval(days => $7::int))
     RETURNING *`,
    [r.id, r.ship_to_name, r.ship_to_pincode, r.ship_to_city_name, r.brand_name, note || null, days]);
  const ret = rows[0];

  await conn.query(
    `UPDATE production_event_items SET returned_on_shipment_id = $2, updated_at = now()
      WHERE production_event_id = $1 AND disposition = 'return' AND receipt_status = 'received'`,
    [r.id, ret.id]);

  await logAction(conn, r.id, scope.userId, 'influencer', 'return_self_sent',
    `She sent the return herself — couriers don't collect from ${r.ship_to_pincode}. Confirms itself on ${longDate(istDayOf(ret.autoconfirm_due_at))}.`,
    { shipment_id: ret.id, count: expected.length, note: note || null });

  await shoot.notifyBrand(r, NOTIFY11.RETURN_BOOKED,
    `${shoot.first(r.creator_name)} has sent your ${expected.length} item${expected.length === 1 ? '' : 's'} back herself — couriers can't collect from her pincode. Confirm them when they arrive; if you do nothing this confirms itself on ${longDate(istDayOf(ret.autoconfirm_due_at))}.`);

  return shoot.read(ciId, scope, conn);
}

/* ───────────────────────────────────────────── F17 — the brand confirms */

/**
 * Item by item, when the return reaches the branch (R13). Or the job does it at the stamped
 * due (J1), unless the brand has reported a line.
 */
async function confirmReturn(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);

  const ret = await shipping.liveReturn(r.id, conn);
  if (!ret) throw new AppError('RETURN_NOT_DELIVERED', MSG.RETURN_NOT_DELIVERED, 422, 'status');
  if (!ret.delivered_at && !ret.self_sent_at) throw new AppError('RETURN_NOT_DELIVERED', MSG.RETURN_NOT_DELIVERED, 422, 'status');
  if (ret.confirmed_at || ret.autoconfirmed_at) throw new AppError('ALREADY_CONFIRMED', MSG.ALREADY_CONFIRMED, 422, 'status');

  const answers = Array.isArray(body.answers) ? body.answers : [];
  for (const a of answers) {
    if (!VERDICTS.includes(a.status)) {
      throw new AppError('VALIDATION_ERROR', `"${a.status}" is not something an item can be.`, 422, 'answers');
    }
  }

  await db.withTransaction(async (tx) => {
    for (const a of answers) {
      // eslint-disable-next-line no-await-in-loop
      await tx.query(
        `UPDATE production_event_items
            SET return_status = $3, return_checked_at = now(), updated_at = now()
          WHERE id = $1 AND production_event_id = $2`, [a.lineId, r.id, a.status]);
    }
    const { rowCount } = await tx.query(
      `UPDATE shipments SET confirmed_at = now(), confirmed_by = $2, updated_at = now()
        WHERE id = $1 AND confirmed_at IS NULL AND autoconfirmed_at IS NULL`, [ret.id, scope.userId]);
    if (rowCount === 0) throw new AppError('ALREADY_CONFIRMED', MSG.ALREADY_CONFIRMED, 422, 'status');
  });

  await logAction(conn, r.id, scope.userId, 'brand', 'return_confirmed',
    `The brand confirmed the return${answers.length ? `, ${answers.length} item${answers.length === 1 ? '' : 's'} checked` : ''}`,
    { shipment_id: ret.id });

  await shoot.notifyCreator(r, NOTIFY11.RETURN_CONFIRMED,
    `${r.brand_name} confirmed the items you sent back. That's everything on the products side.`);

  return shoot.read(ciId, scope, conn);
}

module.exports = {
  check, report, acknowledgeDifference, markDone,
  returnToGift, releaseHoldIfNothingLeft,
  bookReturn, markSelfSent, confirmReturn,
  VERDICTS, REPORT_KINDS,
};
