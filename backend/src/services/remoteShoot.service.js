'use strict';

/**
 * remoteShoot.service.js — the Remote shoot plan (item 11).
 * Contract: features/item11-remote · rules v1.27 §11.2 (with §9, §10, §13, §20, §24, §25, §28, §32)
 *
 * She sends her delivery address; the brand picks products from her selling scope, marks each
 * Return or Gift, and books ONE parcel through INFLX; the parcel is tracked to her door; she
 * checks each item and marks the shoot done; the Return items come back from her door at the
 * brand's cost.
 *
 * THE SHAPE IS ITEM 10'S, DELIBERATELY. Same table (`production_events`), same gate
 * (`shootGate`), same derivation of the stage FROM TIMESTAMPS rather than a second status
 * vocabulary, same load-scoped-to-the-caller-or-404, same compare-and-swap on every write.
 * A reader who knows shootPlan.service knows this one.
 *
 * WHAT IS DIFFERENT, AND WHY
 *   · SHE moves first. Until her address arrives the brand has nothing to do (§11.2).
 *   · There is no negotiation. An address is sent once and locks (§28); one correction, only
 *     after the courier brings the parcel back.
 *   · MONEY MOVES — the first time in a shoot. All of it the brand's, none of it ever from
 *     contracts.locked_amount or from her. Every rupee goes through remoteMoney.service.
 *   · The RETURN IS ITS OWN LANE. It never holds up the content step or any payment, and it
 *     never makes a collaboration Delayed.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const shootGate = require('./shootGate.service');
const platformSettings = require('./platformSettings.service');
const notificationService = require('./notification.service');
const shipping = require('./shipping');
const shippingWebhook = require('./shipping/webhook');
const money = require('./remoteMoney.service');
const { MSG, NOTIFY11, REMOTE_STAGE_LABEL, RETURN_STAGE_LABEL, shortDay } = require('./productionCopy');
const { longDate } = require('./campaignCopy');
const { calendarDay, todayInIndia, istDayOf, addDays, daysBetween } = require('../utils/indiaDay');
const { logAction } = require('./production.service');

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'the creator';
const MAX_LINES = 20;
const MAX_PER_VARIANT = 5;

/* ───────────────────────────────────────────────────────────── loading */

const SELECT = `
  SELECT ci.id AS ci_id, ci.influencer_id, ci.delayed_at, ci.delayed_stage,
         ci.alloc_scope, ci.alloc_category_node_id, ci.alloc_category, ci.alloc_product_ids,
         ci.sell_v2,
         cs.id AS set_id, cs.name AS set_name, cs.goal, cs.shoot_mode AS set_mode,
         cs.go_live_date, cs.branch_id AS set_branch_id,
         c.id AS campaign_id, c.name AS campaign_name, c.brand_id,
         b.business_name AS brand_name, bu.id AS brand_user_id, bu.phone AS brand_phone,
         COALESCE(i.full_name, u.name) AS creator_name, u.id AS creator_user_id, u.phone AS creator_phone,
         i.city_id AS creator_city_id, i.state_id AS creator_state_id,
         con.id AS contract_id, con.brand_signed_at, con.influencer_signed_at,
         con.locked_amount, con.released_amount, con.terms_json,
         pe.*
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = c.brand_id JOIN users bu ON bu.id = b.user_id
    JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
    LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
    LEFT JOIN production_events pe ON pe.contract_id = con.id`;

/**
 * The collaboration as the Remote shoot sees it, SCOPED TO THE CALLER. A brand asking through
 * a set it does not own, or a creator asking about someone else's collaboration, gets null →
 * 404 — never 403, which would confirm the row exists (item 10's rule, check 37).
 */
async function load(ciId, { side, userId, campaignId = null, setId = null }, conn = db) {
  const scope = side === 'brand' ? 'bu.id = $2' : 'u.id = $2';
  const { rows } = await conn.query(`${SELECT} WHERE ci.id = $1 AND ${scope}`, [ciId, userId]);
  const r = rows[0];
  if (!r) return null;
  if (side === 'brand' && ((campaignId && r.campaign_id !== campaignId) || (setId && r.set_id !== setId))) return null;
  return r;
}

async function loadOrThrow(ciId, scope, conn = db) {
  const r = await load(ciId, scope, conn);
  if (!r) throw new AppError('NOT_FOUND', 'Not found', 404);
  return r;
}

const loadAny = async (ciId, conn = db) =>
  (await conn.query(`${SELECT} WHERE ci.id = $1`, [ciId])).rows[0] || null;

/**
 * Signed, funded where the aim carries money — and a REMOTE collaboration.
 * The mirror of item 10's assertOpenVisit, and the mode refusal is §7's sentence, verbatim.
 */
async function assertOpenRemote(r, conn = db) {
  const gate = await shootGate.shootGate(r.ci_id, conn);
  if (!gate) throw new AppError('NOT_FOUND', 'Not found', 404);
  if (!gate.signed.at) throw new AppError('NOT_SIGNED', MSG.NOT_SIGNED, 422, 'status');
  if (!gate.open) throw new AppError('NOT_FUNDED', MSG.NOT_FUNDED, 422, 'status');
  const mode = r.mode || r.set_mode;
  if (String(mode || '').toLowerCase() === 'visit') {
    throw new AppError('WRONG_MODE_VISIT', MSG.WRONG_MODE_VISIT(r.brand_name), 422, 'mode');
  }
  if (!r.id) throw new AppError('NOT_FOUND', 'No shoot plan for this collaboration', 404);
  return gate;
}

/* ───────────────────────────────────────────────────────── the stage */

/**
 * not_sent · sent · booked · in_transit · delivered · checked · shot
 * From the timestamps, nowhere else — item 10's rule, so the stage can never disagree with
 * the row it is derived from.
 */
function stageOf(pe, parcel, lines) {
  if (!pe || !pe.id) return 'not_sent';
  if (pe.influencer_completed_at) return 'shot';
  const answered = (lines || []).length > 0 && lines.every((l) => l.receipt_status);
  if (answered) return 'checked';
  if (parcel && parcel.delivered_at) return 'delivered';
  if (parcel && (parcel.collected_at || parcel.out_for_delivery_at)) return 'in_transit';
  if (parcel && parcel.booked_at && !parcel.cancelled_at) return 'booked';
  if (pe.address_sent_at) return 'sent';
  return 'not_sent';
}

/** Where a collaboration stopped, for the Delayed flag (D8). The RETURN never delays anything. */
function delayedStageOf(pe, parcel, lines) {
  switch (stageOf(pe, parcel, lines)) {
    case 'not_sent':   return 'address_not_sent';
    case 'sent':       return 'not_booked';
    case 'booked':     return 'in_transit';
    case 'in_transit': return 'in_transit';
    case 'delivered':  return 'not_checked';
    case 'checked':    return 'shoot_not_marked';
    default:           return null;           // shot — nothing to flag
  }
}

/**
 * The return's own stage, and its due date.
 *
 * DUE = the stamped Remote return window (contracts.terms_json.returnTerms.days, written at
 * the agreement by item 7) counted from the LATER of the posting date and shoot done, judged
 * in India time (§11.2, §25). Stamped, never the live setting — changing the admin number
 * moves no date already promised.
 *
 * OVERDUE IS DERIVED, never stored: past the due with no pickup booked and nothing sent.
 */
function returnStateOf(r, ret, lines, today = todayInIndia()) {
  const returnLines = (lines || []).filter((l) => l.disposition === 'return');
  // §11.2: "A Return item she marked missing is not expected back from her."
  const expected = returnLines.filter((l) => l.receipt_status === 'received');
  if (!returnLines.length) return { stage: 'none', lines: [], expected: [], dueDate: null, overdue: false };

  const days = Number(((r.terms_json || {}).returnTerms || {}).days) || 7;
  const shotDay = r.influencer_completed_at ? istDayOf(r.influencer_completed_at) : null;
  const postingDay = r.go_live_date ? calendarDay(r.go_live_date) : null;
  const from = (shotDay && postingDay)
    ? (daysBetween(postingDay, shotDay) > 0 ? shotDay : postingDay)   // the LATER of the two
    : (shotDay || postingDay);
  const dueDate = from ? addDays(from, days) : null;

  let stage = 'due';
  if (ret) {
    if (ret.confirmed_at || ret.autoconfirmed_at) stage = 'confirmed';
    else if (ret.delivered_at || ret.self_sent_at) stage = 'delivered';
    else if (ret.collected_at) stage = 'in_transit';
    else if (ret.booked_at) stage = 'booked';
  }
  const overdue = stage === 'due' && !!dueDate && !!shotDay && daysBetween(dueDate, today) > 0;
  return {
    stage: overdue ? 'overdue' : stage,
    settledStage: stage,
    lines: returnLines, expected,
    dueDate, overdue, windowDays: days,
  };
}

/* ───────────────────────────────────────────────────────── the lines */

const LINES_SQL = `
  SELECT i.*, p.name AS product_name, p.image_url, p.price AS product_price
    FROM production_event_items i
    LEFT JOIN brand_products p ON p.id = i.product_id
   WHERE i.production_event_id = $1
   ORDER BY i.created_at, i.id`;

const linesOf = async (eventId, conn = db) => (await conn.query(LINES_SQL, [eventId])).rows;

const lineView = (l) => ({
  id: l.id,
  productId: l.product_id,
  variantId: l.variant_id || null,
  name: l.name_at_dispatch || l.product_name,
  variantLabel: l.variant_label_at_dispatch || null,
  image: l.image_url || null,
  price: l.price_at_dispatch == null ? null : Number(l.price_at_dispatch),
  quantity: Number(l.quantity || 1),
  disposition: l.disposition || 'gift',
  check: l.receipt_status || null,
  checkNote: l.receipt_note || null,
  checkedAt: l.answered_at || null,
  returnStatus: l.return_status || null,
  returnCheckedAt: l.return_checked_at || null,
  returnAutoConfirmedAt: l.return_auto_confirmed_at || null,
  reportedAt: l.reported_at || null,
});

/* ───────────────────────────────────────────────────────── notifications */

function notifyCreator(r, key, body, extra = {}) {
  return notificationService.send({
    userId: r.creator_user_id, type: key.type, title: key.title, body, sendSms: false,
    data: { screen: 'my_remote', campaign_influencer_id: r.ci_id, production_event_id: r.id, ...extra },
  }).catch((e) => console.error(`[NOTIFICATION] ${key.type} failed:`, e.message));
}
function notifyBrand(r, key, body, extra = {}) {
  return notificationService.send({
    userId: r.brand_user_id, type: key.type, title: key.title, body, sendSms: false,
    data: { screen: 'brand_remote', campaign_influencer_id: r.ci_id, production_event_id: r.id,
      campaign_id: r.campaign_id, set_id: r.set_id, ...extra },
  }).catch((e) => console.error(`[NOTIFICATION] ${key.type} failed:`, e.message));
}

/* ───────────────────────────────────────────────────── F1 — the state, both sides */

/**
 * Everything either side needs, and NOTHING the other side owns.
 *
 * THE PRIVACY RULE LIVES HERE (§11.2, checks 7, 42):
 *   · the brand receives ship_to_* ONLY after address_sent_at;
 *   · the creator NEVER receives the branch's street address or pincode — the return label
 *     carries it, and she continues to see only the city.
 * Both are decided in this one function, so no screen can widen either by accident.
 */
async function read(ciId, scope, conn = db) {
  const r = await loadOrThrow(ciId, scope, conn);
  const side = scope.side;

  // THE MODE IS CHECKED HERE; THE GATE IS NOT — and the difference is deliberate.
  //
  // R1 and R2 draw the gate CARD: "signed, funded, first payment out", or the sentence saying
  // which of those is missing. A read that refused when the gate was shut could not draw it,
  // and the brand would be left with an error where an explanation belongs. Item 10's own F1
  // settled this (shootPlan.read returns `gate` and never throws); every other door — every
  // one that CHANGES something — asserts through assertOpenRemote.
  //
  // The mode is different. A Store Visit collaboration has no Remote screen to draw, so it is
  // refused here as everywhere else, with §7's sentence.
  const modeNow = r.mode || r.set_mode;
  if (String(modeNow || '').toLowerCase() === 'visit') {
    throw new AppError('WRONG_MODE_VISIT', MSG.WRONG_MODE_VISIT(r.brand_name), 422, 'mode');
  }

  const gate = await shootGate.shootGate(r.ci_id, conn);
  const today = todayInIndia();
  const mode = r.mode || r.set_mode || 'shipment';

  const lines = r.id ? await linesOf(r.id, conn) : [];
  const parcel = r.id ? await shipping.lastOutbound(r.id, conn) : null;
  const ret = r.id ? await shipping.liveReturn(r.id, conn) : null;

  const stage = stageOf(r, parcel, lines);
  const sent = !!r.address_sent_at;
  const returnState = returnStateOf(r, ret, lines, today);
  const postingDay = r.go_live_date ? calendarDay(r.go_live_date) : null;

  // Her address. The brand's to see once she has sent it; hers always.
  const address = (side === 'creator' || sent) && sent ? {
    name: r.ship_to_name, phone: r.ship_to_phone, street: r.ship_to_street,
    pincode: r.ship_to_pincode, state: r.ship_to_state_name, city: r.ship_to_city_name,
    note: r.ship_to_note || null, sizes: r.ship_to_sizes || null,
    sentAt: r.address_sent_at, correctedAt: r.address_corrected_at || null,
    coverage: { delivers: r.coverage_delivers, returnPickup: r.coverage_return_pickup, checkedAt: r.coverage_checked_at },
  } : null;

  // The parcel. The creator sees the tracking and the box — never where it was collected FROM.
  const parcelView = parcel ? {
    id: parcel.id, provider: parcel.provider, direction: 'outbound',
    courier: parcel.courier_name, tracking: parcel.tracking_number,
    box: { preset: parcel.box_preset, l: num(parcel.box_l_cm), w: num(parcel.box_w_cm), h: num(parcel.box_h_cm) },
    weightKg: num(parcel.weight_kg),
    bookedAt: parcel.booked_at, cancelledAt: parcel.cancelled_at,
    collectedAt: parcel.collected_at, outForDeliveryAt: parcel.out_for_delivery_at,
    deliveredAt: parcel.delivered_at, returnedToStoreAt: parcel.returned_to_store_at,
    attemptFailedCount: Number(parcel.attempt_failed_count || 0),
    lastAttemptReason: parcel.last_attempt_reason || null,
    rebookedFromId: parcel.rebooked_from_id || null,
    ...(side === 'brand' ? {
      charged: num(parcel.charged_amount), quoted: num(parcel.quoted_amount),
      gst: num(parcel.gst_amount), returnHold: num(parcel.return_hold_amount),
      branchId: parcel.branch_id, from: parcel.from_city_name,
      declaredValue: num(parcel.declared_value),
    } : {}),
  } : null;

  const returnView = ret ? {
    id: ret.id, provider: ret.provider,
    courier: ret.courier_name, tracking: ret.tracking_number,
    pickupDay: ret.pickup_day, bookedAt: ret.booked_at,
    collectedAt: ret.collected_at, deliveredAt: ret.delivered_at,
    selfSentAt: ret.self_sent_at, selfSentNote: ret.self_sent_note,
    confirmedAt: ret.confirmed_at, autoConfirmedAt: ret.autoconfirmed_at,
    autoConfirmDueAt: ret.autoconfirm_due_at,
  } : null;

  const canPickup = r.coverage_return_pickup !== false;
  const hasUnansweredCheck = lines.length > 0 && lines.some((l) => !l.receipt_status);

  const can = {
    // Creator
    sendAddress: side === 'creator' && gate.open && !sent,
    correctAddress: side === 'creator' && gate.open && sent && !r.address_corrected_at
      && !!parcel && !!parcel.returned_to_store_at,
    check: side === 'creator' && gate.open && !!parcel && !!parcel.delivered_at && hasUnansweredCheck,
    markDone: side === 'creator' && gate.open && stage === 'checked',
    bookReturn: side === 'creator' && gate.open && stage === 'shot' && canPickup
      && returnState.expected.length > 0 && !ret,
    markSelfSent: side === 'creator' && gate.open && stage === 'shot' && !canPickup
      && returnState.expected.length > 0 && !(ret && ret.self_sent_at),
    // Brand
    pickProducts: side === 'brand' && gate.open && sent && !(parcel && parcel.booked_at && !parcel.cancelled_at),
    book: side === 'brand' && gate.open && sent && lines.length > 0
      && !(parcel && parcel.booked_at && !parcel.cancelled_at && !parcel.returned_to_store_at),
    cancel: side === 'brand' && gate.open && !!parcel && !!parcel.booked_at
      && !parcel.cancelled_at && !parcel.collected_at,
    rebook: side === 'brand' && gate.open && !!parcel && !!parcel.returned_to_store_at
      && !parcel.rebooked_from_id,
    label: side === 'brand' && !!parcel && !!parcel.booked_at && !parcel.cancelled_at,
    returnToGift: side === 'brand' && gate.open && returnState.lines.length > 0 && !(ret && ret.booked_at) && !(ret && ret.self_sent_at),
    confirmReturn: side === 'brand' && gate.open && !!ret && !!(ret.delivered_at || ret.self_sent_at)
      && !ret.confirmed_at && !ret.autoconfirmed_at,
    reportDifference: side === 'brand' && lines.some((l) => l.receipt_status && l.receipt_status !== 'received') && !r.difference_reported_at,
    acknowledgeDifference: side === 'brand' && !!lines.some((l) => l.receipt_status && l.receipt_status !== 'received') && !r.difference_acknowledged_at,
    reportReturn: side === 'brand' && !!ret && !!(ret.delivered_at || ret.self_sent_at) && !r.return_reported_at,
    reportOverdue: side === 'brand' && returnState.overdue && !r.overdue_reported_at,
  };

  const steps = [
    { key: 'signed', label: 'Agreement signed', state: 'done', detail: r.brand_signed_at ? shortDay(r.brand_signed_at) : null },
    { key: 'products', label: 'Products', state: stage === 'shot' ? 'done' : 'now',
      detail: REMOTE_STAGE_LABEL[stage] },
    { key: 'content', label: 'Content', state: stage === 'shot' ? 'now' : 'later',
      detail: stage === 'shot' ? (side === 'brand' ? `With ${first(r.creator_name)}` : 'Yours to make') : 'After the shoot' },
    { key: 'live', label: 'Live and paid', state: 'later',
      detail: postingDay ? `Posts ${shortDay(new Date(`${postingDay}T00:00:00+05:30`))}` : null },
  ];

  const out = {
    invitationId: r.ci_id, shootId: r.id || null, contractId: r.contract_id || null,
    gate: { open: gate.open, reason: gate.reason, signed: gate.signed, money: gate.money },
    aim: r.goal, mode, isRemote: true,
    campaignName: r.campaign_name, setName: r.set_name,
    brand: { name: r.brand_name }, creator: { name: r.creator_name },
    postingDate: postingDay, daysToPosting: postingDay ? daysBetween(today, postingDay) : null,
    stage, stageLabel: REMOTE_STAGE_LABEL[stage],
    address, parcel: parcelView,
    lines: lines.map(lineView), lineCount: lines.length, maxLines: MAX_LINES,
    return: {
      ...returnView ? { shipment: returnView } : { shipment: null },
      stage: returnState.stage, stageLabel: RETURN_STAGE_LABEL[returnState.stage],
      dueDate: returnState.dueDate, overdue: returnState.overdue,
      windowDays: returnState.windowDays || null,
      count: returnState.expected.length,
      canPickup,
    },
    difference: {
      reportedAt: r.difference_reported_at || null,
      acknowledgedAt: r.difference_acknowledged_at || null,
      returnReportedAt: r.return_reported_at || null,
      overdueReportedAt: r.overdue_reported_at || null,
    },
    delayed: r.delayed_at ? { at: r.delayed_at, stage: r.delayed_stage } : null,
    can, steps,
    legacyNoPostingDate: !r.go_live_date,
  };

  if (side === 'brand') {
    out.wallet = {
      available: await money.available(r.brand_id, conn),
      dues: await money.duesTotal(r.brand_id, conn),
    };
    out.charges = await money.chargesFor(r.campaign_id, r.brand_id, conn);
    // §11.2: "The ₹{fee} locked for {name}'s fee is never used for shipping." Said on R6.
    out.lockedFee = Number(r.locked_amount || 0);
  } else {
    // Her prefill for R3 — name, her login number, and her profile's state and city.
    if (!sent) {
      out.prefill = {
        name: r.creator_name || null,
        phone: r.creator_phone ? String(r.creator_phone).replace(/^\+91/, '') : null,
        stateId: r.creator_state_id || null,
        cityId: r.creator_city_id || null,
      };
    }
  }
  return out;
}

const num = (v) => (v == null ? null : Number(v));

module.exports = {
  // loading + scope
  load, loadOrThrow, loadAny, assertOpenRemote, SELECT,
  // derivation
  stageOf, delayedStageOf, returnStateOf, linesOf, lineView,
  // F1
  read,
  // notifications, for the sibling modules
  notifyBrand, notifyCreator,
  first, MAX_LINES, MAX_PER_VARIANT, num,
};
