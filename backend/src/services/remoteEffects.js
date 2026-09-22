'use strict';

/**
 * remoteEffects.js — what a courier update MEANS to a collaboration.
 * Contract: features/item11-remote §6.3 · rules v1.27 §11.2 · checks 16, 18, 19, 44, 46
 *
 * WHY THIS IS REGISTERED AND NOT IMPORTED
 * `services/shipping/` must never learn what a collaboration is — that is the whole reason item
 * 16 can book a customer's order through it (gap report §12), and a test greps every file in
 * that folder to keep it true. So the layer offers `onApplied(fn)` and ITEM 11 registers what
 * should happen. The dependency points one way: item 11 → shipping, never back.
 *
 * WHAT RUNS INSIDE THE TRANSACTION, AND WHAT RUNS AFTER
 *   inside  — money and state. A wallet row and the event that caused it commit together or
 *             not at all.
 *   after   — notifications. Item 10's rule: nobody is told about something that then rolls
 *             back. They are collected here and flushed by the caller.
 */

const db = require('../config/db');
const shipping = require('./shipping');
const webhook = require('./shipping/webhook');
const money = require('./remoteMoney.service');
const shoot = require('./remoteShoot.service');
const platformSettings = require('./platformSettings.service');
const { NOTIFY11 } = require('./productionCopy');
const { longDate } = require('./campaignCopy');
const { logAction } = require('./production.service');
const { istDayOf } = require('../utils/indiaDay');
const { EVENTS } = require('./shipping/contract');

/** Notifications queued during a transaction, flushed once it commits. */
const pending = [];
const queue = (fn) => pending.push(fn);

async function flush() {
  const jobs = pending.splice(0, pending.length);
  for (const fn of jobs) {
    // eslint-disable-next-line no-await-in-loop
    await fn().catch((e) => console.error('[remote-effects] notify failed:', e.message));
  }
}

/**
 * The collaboration behind a shipment — or null when there is none, which is exactly the case
 * item 16 will be: a customer's order, booked through the same layer, with no shoot at all.
 */
async function collabFor(shipment, tx) {
  if (!shipment.production_event_id) return null;
  const { rows } = await tx.query(
    `${shoot.SELECT} WHERE pe.id = $1`, [shipment.production_event_id]);
  return rows[0] || null;
}

/* ───────────────────────────────────────────── the handler */

async function onApplied({ event, shipment, applied, amount, reason, occurredAt }, tx) {
  // An event that changed nothing changed nothing. A late "out for delivery" must not send a
  // second notification or move a second rupee (check 17).
  if (!applied) return;

  const r = await collabFor(shipment, tx);
  if (!r) return;                       // not a collaboration's parcel — item 16's, one day

  const who = shoot.first(r.creator_name);
  const isReturn = shipment.direction === 'return';

  switch (event) {
    case EVENTS.COLLECTED:
      if (isReturn) {
        // §11.2: "the actual price is taken from the amount locked at booking and anything left
        // goes back to the Brand" — settled when the courier HAS it, not when she booked it.
        await settleReturnMoney(r, shipment, tx);
        queue(() => shoot.notifyBrand(r, NOTIFY11.RETURN_COLLECTED,
          `The courier collected your return from ${who}. It's on the way to ${shipment.to_name || 'the branch'}.`));
        queue(() => shoot.notifyCreator(r, NOTIFY11.RETURN_COLLECTED,
          `The courier has collected the items. Nothing more to do — ${r.brand_name} confirm them when they arrive.`));
      } else {
        queue(() => shoot.notifyCreator(r, NOTIFY11.COLLECTED,
          `${r.brand_name}'s parcel is with the courier. ${shipment.courier_name || 'The courier'} is carrying it.`));
        queue(() => shoot.notifyBrand(r, NOTIFY11.COLLECTED,
          `The courier collected the parcel for ${who}.`));
      }
      break;

    case EVENTS.OUT_FOR_DELIVERY:
      if (!isReturn) {
        queue(() => shoot.notifyCreator(r, NOTIFY11.OUT_FOR_DELIVERY,
          `Your parcel from ${r.brand_name} is out for delivery today.`));
      }
      break;

    case EVENTS.ATTEMPT_FAILED: {
      const why = reason ? ` — ${reason}` : '';
      if (isReturn) {
        queue(() => shoot.notifyCreator(r, NOTIFY11.ATTEMPT_FAILED,
          `The courier couldn't collect the return today${why}. They'll try again.`));
        queue(() => shoot.notifyBrand(r, NOTIFY11.ATTEMPT_FAILED,
          `The return pickup from ${who} didn't happen today${why}.`));
      } else {
        // §11.2: "the Creator is asked to be available for the next attempt".
        queue(() => shoot.notifyCreator(r, NOTIFY11.ATTEMPT_FAILED,
          `The courier couldn't deliver your parcel today${why}. Please be available for the next attempt.`));
        queue(() => shoot.notifyBrand(r, NOTIFY11.ATTEMPT_FAILED,
          `The courier couldn't deliver to ${who} today${why}. They'll try again.`));
      }
      break;
    }

    case EVENTS.DELIVERED:
      if (isReturn) await onReturnDelivered(r, shipment, tx);
      else {
        queue(() => shoot.notifyCreator(r, NOTIFY11.DELIVERED,
          `Your parcel from ${r.brand_name} has arrived. Check what's inside, then shoot — anything missing won't stop you.`));
        queue(() => shoot.notifyBrand(r, NOTIFY11.DELIVERED,
          `The parcel reached ${who}. She checks it item by item next.`));
      }
      break;

    case EVENTS.RETURNED_TO_STORE:
      await onBackToStore(r, shipment, amount, reason, tx);
      break;

    case EVENTS.WEIGHT_CHARGE:
      await onWeightCharge(r, shipment, amount, reason, tx);
      break;

    default:
      break;
  }
}

/* ───────────────────────────────────────────── the three that move money */

/**
 * BACK TO THE STORE (R15b, check 18).
 * §11.2: "both sides are told, the courier's return-to-store charge is taken from the Brand's
 * wallet, and the Brand may book the parcel once more".
 *
 * THE AMOUNT. A provider that reports one is believed. When it does not, the outbound price
 * for the same parcel is charged — which is how Indian aggregators price an RTO, and is the
 * only figure we can defend. **This is Shiprocket unknown 6's neighbour and is listed for the
 * founder**: if the live account reports RTO separately, that number wins.
 */
async function onBackToStore(r, shipment, amount, reason, tx) {
  if (shipment.direction === 'return') return;     // a return that bounced is not a back-to-store
  const fee = money.money(amount != null ? amount : Number(shipment.charged_amount || 0));
  const who = shoot.first(r.creator_name);

  const out = await money.courierCharge(tx, {
    brandId: r.brand_id, campaignId: r.campaign_id, amount: fee,
    reason: 'return_to_store', shipmentId: shipment.id,
    note: `Courier returned the parcel for ${who} to the store${reason ? ` — ${reason}` : ''}`,
  });

  await logAction(tx, r.id, null, 'system', 'back_to_store',
    `The courier brought the parcel back${reason ? ` — ${reason}` : ''}. `
    + (out.due ? `${money.fmt(fee)} owed (the wallet was short).` : `${money.fmt(fee)} charged.`),
    { shipment_id: shipment.id, amount: fee, owed: !!out.due });

  queue(() => shoot.notifyBrand(r, NOTIFY11.BACK_TO_STORE,
    `The courier brought ${who}'s parcel back to the store${reason ? ` — ${reason}` : ''}. `
    + `${out.due ? `${money.fmt(fee)} is owed from your next money in` : `${money.fmt(fee)} was taken from your wallet`}. You can book it once more.`));
  queue(() => shoot.notifyCreator(r, NOTIFY11.BACK_TO_STORE,
    `Your parcel went back to ${r.brand_name}${reason ? ` — ${reason}` : ''}. `
    + `They'll send it again. If the address was the problem, you can correct it once.`));
}

/**
 * A WEIGHT DIFFERENCE (R15b, check 19).
 * §11.2: "taken from the Brand's wallet and shown with the courier's reason. If the balance is
 * short it is recorded as owed and taken from the Brand's next money in. **It never blocks the
 * Creator.**" Nothing in this function touches her side of anything.
 */
async function onWeightCharge(r, shipment, amount, reason, tx) {
  const fee = money.money(amount || 0);
  if (!(fee > 0)) return;
  const who = shoot.first(r.creator_name);

  const out = await money.courierCharge(tx, {
    brandId: r.brand_id, campaignId: r.campaign_id, amount: fee,
    reason: 'weight_charge', shipmentId: shipment.id,
    note: `${shipment.courier_name || 'The courier'} charged a weight difference on ${who}'s parcel${reason ? ` — ${reason}` : ''}`,
  });

  await logAction(tx, r.id, null, 'system', 'weight_charge',
    `${money.fmt(fee)} weight difference${reason ? ` — ${reason}` : ''}. `
    + (out.due ? 'The wallet was short, so it is owed.' : 'Taken from the wallet.'),
    { shipment_id: shipment.id, amount: fee, owed: !!out.due, reason: reason || null });

  queue(() => shoot.notifyBrand(r, NOTIFY11.WEIGHT_CHARGE,
    `${shipment.courier_name || 'The courier'} charged ${money.fmt(fee)} more on ${who}'s parcel${reason ? `: ${reason}` : ''}. `
    + (out.due ? "Your wallet was short, so it's owed from your next money in." : 'Taken from your wallet.')));
}

/**
 * THE RETURN, SETTLED (R14, checks 25, 44, 45).
 * The hold comes back, the actual price comes out, and the remainder is the brand's. When the
 * actual costs MORE than was held, the difference is charged or owed (v1.27 §11.2, §2.2) —
 * and **her pickup is never refused or delayed because of it**: by the time this runs the
 * courier already has the parcel.
 */
async function settleReturnMoney(r, ret, tx) {
  if (ret.provider === 'none') return;        // she posted it herself; INFLX moves nothing (Q1)
  const parcel = await shipping.lastOutbound(r.id, tx);
  const hold = Number((parcel || {}).return_hold_amount || 0);
  const alreadyReleased = Number((parcel || {}).return_hold_released || 0);
  if (alreadyReleased > 0) return;

  const api = shipping.provider(ret);
  let actual = Number(ret.charged_amount || 0);
  if (!actual) {
    const q = await api.quote({
      pickupPincode: ret.from_pincode, deliveryPincode: ret.to_pincode,
      pickupCity: ret.from_city_name, deliveryCity: ret.to_city_name,
      weightKg: Number(ret.weight_kg || 0.5), box: { preset: ret.box_preset || 'medium' },
      direction: 'return',
    }).catch(() => null);
    // §2.3's fallback again: no return quote → the outbound price for the same parcel.
    actual = q ? q.amount : (hold || Number((parcel || {}).charged_amount || 0));
  }

  const settled = await money.settleReturn(tx, {
    brandId: r.brand_id, campaignId: r.campaign_id,
    hold, actual, creatorName: shoot.first(r.creator_name), shipmentId: ret.id,
  });

  await tx.query(`UPDATE shipments SET charged_amount = $2, updated_at = now() WHERE id = $1`, [ret.id, actual]);
  if (parcel) {
    await tx.query(`UPDATE shipments SET return_hold_released = $2, updated_at = now() WHERE id = $1`, [parcel.id, hold]);
  }

  await logAction(tx, r.id, null, 'system', 'return_settled',
    `Return collected. ${money.fmt(hold)} released, ${money.fmt(actual)} charged`
    + (settled.due ? ` — ${money.fmt(actual)} owed, the wallet was short` : '')
    + (settled.unusedBack > 0 ? `, ${money.fmt(settled.unusedBack)} back to the brand` : ''),
    { hold, actual, owed: !!settled.due });
}

/**
 * THE RETURN REACHED THE BRANCH (R13).
 * The auto-confirm clock is STAMPED HERE, from the admin number as it stands now — never
 * re-read afterwards, so changing the number moves no date already promised (check 27).
 */
async function onReturnDelivered(r, ret, tx) {
  const days = await platformSettings.get('remote_return_autoconfirm_days');
  const { rows } = await tx.query(
    `UPDATE shipments
        SET autoconfirm_days = $2::int,
            autoconfirm_due_at = COALESCE(autoconfirm_due_at, now() + make_interval(days => $2::int)),
            updated_at = now()
      WHERE id = $1 AND autoconfirm_due_at IS NULL
      RETURNING autoconfirm_due_at`, [ret.id, days]);
  const due = rows[0] ? rows[0].autoconfirm_due_at : ret.autoconfirm_due_at;

  await logAction(tx, r.id, null, 'system', 'return_delivered',
    `The return reached the branch. It confirms itself on ${longDate(istDayOf(due))} if the brand does nothing.`,
    { shipment_id: ret.id, autoconfirm_days: days });

  queue(() => shoot.notifyBrand(r, NOTIFY11.RETURN_DELIVERED,
    `The return from ${shoot.first(r.creator_name)} reached ${ret.to_name || 'your branch'}. Confirm each item — if you do nothing it confirms itself on ${longDate(istDayOf(due))}.`));
  queue(() => shoot.notifyCreator(r, NOTIFY11.RETURN_DELIVERED,
    `The items you sent back reached ${r.brand_name}. Nothing more for you to do.`));
}

/* ───────────────────────────────────────────── registration */

let registered = false;

/** Called once at startup (app.js) and by tests that need the effects live. */
function register() {
  if (registered) return;
  webhook.onApplied(onApplied);
  registered = true;
}
function _reset() { registered = false; pending.length = 0; }

module.exports = { register, onApplied, flush, _reset, settleReturnMoney, onBackToStore, onWeightCharge };
