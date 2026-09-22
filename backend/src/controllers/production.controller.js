'use strict';

/**
 * production.controller.js — Phase P (Production Coordination)
 *
 * HTTP layer over production.service. Handles auth (brand vs influencer
 * vs admin), notification dispatch, and shape conversion. State transitions
 * live in production.service.
 */

const db = require('../config/db');
const productionService = require('../services/production.service');
// stage-4 — what is in the box, and who may say the shoot is done.
const parcel = require('../services/parcel.service');
// Item 10 — the §10 gate: signed by both, and funded where the aim carries fixed money.
const shootGate = require('../services/shootGate.service');
const { MSG: MSG10 } = require('../services/productionCopy');

/**
 * Item 10, Phase 2d — RETIRED DOORS (approval Q12: "server-side, not by hiding the buttons").
 *
 * The store visit's time is agreed through the shoot plan (item10.routes) on item 6's engine,
 * and the mode of work comes from the set and never changes inside the shoot (rules §11). So the
 * Stage-P slot dance for a visit — visit-details, propose-slot, accept, counter-propose — the
 * brand's mode picker on /initialise, and flip-to-remote are switched off HERE with a sentence,
 * whatever any client still shows. The shipment half of accept / counter-propose is item 11's
 * and is left as it was.
 *
 * ── Item 11, Phase 2a — THE SHIPMENT HALF GOES TOO (approval §3.3) ──────────────────────────
 *
 * The 2024 flow was: the brand types a courier name and an AWB into a box on the website and
 * presses "Mark as dispatched"; she presses "confirm received". Item 11 books a real parcel
 * through INFLX's shipping layer, tracks it by webhook, and takes her answer item by item. The
 * old doors are switched off here, in the same way and for the same reason as item 10's.
 *
 *   dispatch                → F8 book the parcel
 *   confirm-received        → F12 her check
 *   complete (Remote only)  → F14 shoot done. NOT retired for a visit — §2.9 of the approval
 *                             asked for the caller audit first, and it found one: the brand
 *                             website's "Mark visit done" button
 *                             (Packages/brand-web/.../influencers/page.js:525 → :287) sits
 *                             inside the visit branch and is live. So only the shipment /
 *                             remote branch is retired, and the visit branch is untouched.
 *   items/:itemId/drop      → nothing. Item 11 records what she reports and lets the brand
 *                             report a difference to INFLX; it never edits her answer away.
 *   accept / counter-propose (shipment half) → nothing. There is no slot to agree on a Remote
 *                             shoot. Their visit half was already retired by item 10, and the
 *                             two website callers (acceptSlot :232, sendCounter :239) are both
 *                             on that already-dead visit path — so no live caller is touched.
 *
 * Every one leaves its data and its columns alone.
 */
const retiredModeChoice = () => { throw new AppError('RETIRED_MODE_CHOICE', MSG10.RETIRED_MODE_CHOICE, 422, 'mode'); };
const retiredSlotDanceForVisit = (event) => { if (event && event.mode === 'visit') throw new AppError('RETIRED_SLOT_DANCE', MSG10.RETIRED_SLOT_DANCE, 422, 'status'); };
/** Item 11: a door the Remote flow replaces. Refuses whatever the mode, unless `remoteOnly`. */
const retired11 = (code, message) => { throw new AppError(code, message, 422, 'status'); };
/** Item 11: a door retired for Remote but still live for a Store Visit (see `complete`). */
const retired11ForRemote = (event, code, message) => {
  if (!event || event.mode !== 'visit') retired11(code, message);
};
const notificationService = require('../services/notification.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─── Helpers ────────────────────────────────────────────────────────────────

// Look up the contract + the parties; we need both user_ids to authorise
// + later to push notifications to the OTHER party.
async function getContractParties(contractId) {
  // campaign_influencers has set_id, not campaign_id — go through
  // campaign_sets to reach the campaign. The old JOIN `ci.campaign_id`
  // didn't exist as a column and silently 500'd every production endpoint
  // call. (Phase P shipped with this SQL; it never got exercised end-to-end
  // until the user hit it in the new flow.)
  const { rows } = await db.query(
    `SELECT c.id, c.production_mode, c.campaign_influencer_id,
            inf_u.id  AS influencer_user_id, inf_u.fcm_token AS influencer_fcm,
            inf_u.phone AS influencer_phone,
            b_u.id    AS brand_user_id, b_u.fcm_token AS brand_fcm,
            b_u.phone AS brand_phone,
            camp.name AS campaign_name,
            inf_u.name AS influencer_name,
            -- Item 11, finding 1. THE BRAND'S OWN ID. This row joins brands to reach the
            -- business name and has never projected b.id, so addParcelItems passed
            -- brandId: undefined into a "WHERE brand_id = $1" and matched nothing — every
            -- add-products call answered "Some of those products are not in your catalogue."
            -- Latent because no parcel has ever been packed and, until item 10 fixed the mode
            -- resolver on 18 Sep, no set-first collaboration was a shipment at all.
            b.id AS brand_id,
            b.business_name AS brand_name
     FROM contracts c
     JOIN campaign_influencers ci ON ci.id = c.campaign_influencer_id
     JOIN campaign_sets    cs   ON cs.id  = ci.set_id
     JOIN campaigns        camp ON camp.id = cs.campaign_id
     JOIN brands           b   ON b.id   = camp.brand_id
     JOIN users            b_u ON b_u.id = b.user_id
     JOIN influencers      inf ON inf.id = ci.influencer_id
     JOIN users            inf_u ON inf_u.id = inf.user_id
     WHERE c.id = $1`,
    [contractId]
  );
  return rows[0] || null;
}

async function ensureParty(contract, req, expected) {
  if (!contract) throw new AppError('NOT_FOUND', 'Contract not found', 404);
  if (expected === 'brand' && req.user.sub !== contract.brand_user_id) {
    throw new AppError('FORBIDDEN', 'Only the brand on this contract can perform this action', 403);
  }
  if (expected === 'influencer' && req.user.sub !== contract.influencer_user_id) {
    throw new AppError('FORBIDDEN', 'Only the influencer on this contract can perform this action', 403);
  }
  if (expected === 'either' &&
      req.user.sub !== contract.brand_user_id &&
      req.user.sub !== contract.influencer_user_id) {
    throw new AppError('FORBIDDEN', 'You are not a party to this contract', 403);
  }
}

/**
 * Item 7 (approval 4.1) put BOTH SIGNATURES on the two doors that create the row. Item 10
 * (rules §10, §11.1) puts the WHOLE gate on EVERY door: signed by both, and for Pay for Content
 * and Hybrid funded, locked and the first 25% released. One definition, in
 * shootGate.service — the signature test is item 7's two timestamps, never contracts.status,
 * because four seeded rows are 'active' with no signatures at all.
 *
 * Every handler below asks it: the contract-scoped reads, the visit details, the date range,
 * and — through getEventOrThrow — every event-scoped transition and parcel route.
 */
const assertShootOpen = (contractId) => shootGate.assertShootOpen(contractId);

function actorFromReq(req) {
  return { user_id: req.user.sub, role: req.user.role };
}

async function getEventOrThrow(eventId) {
  const event = await productionService.getById(eventId);
  if (!event) throw new AppError('NOT_FOUND', 'Production event not found', 404);
  // Item 10: a row exists only because the gate was open when it was born — but the gate is
  // asked again here, so a future door that creates rows differently cannot open these.
  await shootGate.assertShootOpen(event.contract_id);
  return event;
}

async function getContractByEvent(event) {
  return getContractParties(event.contract_id);
}

/* ─── Item 11, finding 2: the shoot row is projected, never spread ───────────
 *
 * These two doors used to hand back the WHOLE production_events row — `success(res, {
 * production_event: event })` and `{ ...r }` on the roster. That was survivable only because
 * the row held nothing private: a branch address the brand already owns, and four hand-typed
 * courier fields.
 *
 * Item 11 puts a creator's NAME, PHONE, STREET, PINCODE, DELIVERY NOTE and SIZES on that row.
 * A spread would post all of it to whoever asked, from the moment she saved it, with no test
 * failing. So the whitelist lands FIRST — before the columns exist — and the rule is that
 * nothing reaches a client except through one of these two functions.
 *
 * The three privacy rules, in one place (§11.2, approval §3.2):
 *   · the BRAND sees ship_to_* only after address_sent_at;
 *   · the CREATOR never sees a branch street address or pincode — she sees the city, and the
 *     visit_* address only once item 10's plan_sent_at has passed (that is item 10's rule,
 *     honoured here so this projection can serve both modes);
 *   · nobody else sees anything — the callers already ensureParty / scope by brand.
 */

/** Fields that are nobody's secret: what the shoot is, and where it has got to. */
const PE_PUBLIC = [
  'id', 'contract_id', 'mode', 'status',
  'visit_scheduled_at', 'visit_window_minutes', 'visit_duration_text',
  'visit_branch_name', 'visit_city', 'visit_state',
  'branch_id', 'plan_sent_at', 'time_agreed_at',
  'brand_completed_at', 'influencer_completed_at', 'visit_completed_at',
  'auto_confirm_days', 'auto_confirm_due_at', 'auto_confirmed_at',
  'reschedule_count_brand', 'reschedule_count_influencer',
  'slot_proposed_by', 'created_at', 'updated_at',
];

/** The branch's street address and the person to ask for. Item 10 reveals these at plan_sent_at. */
const PE_VISIT_PRIVATE = [
  'visit_address', 'visit_pincode', 'visit_maps_url', 'visit_lat', 'visit_lng',
  'visit_contact_name', 'visit_contact_phone', 'visit_notes',
];

/** HER address, as item 11 will write it. The brand sees these only after address_sent_at. */
const PE_SHIP_TO_PRIVATE = [
  'address_sent_at', 'address_corrected_at',
  'ship_to_name', 'ship_to_phone', 'ship_to_street', 'ship_to_pincode',
  'ship_to_state_id', 'ship_to_city_id', 'ship_to_state_name', 'ship_to_city_name',
  'ship_to_note', 'ship_to_sizes',
  'coverage_delivers', 'coverage_return_pickup', 'coverage_checked_at',
];

const pick = (row, keys) => {
  const out = {};
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
  return out;
};

/**
 * One production_events row, as `side` is allowed to see it.
 * @param {object} row  the raw row
 * @param {'brand'|'influencer'} side
 */
function projectEvent(row, side) {
  if (!row) return null;
  const out = pick(row, PE_PUBLIC);

  // The branch's street address: the brand's own, so always; hers only once the plan is sent.
  if (side === 'brand' || row.plan_sent_at) Object.assign(out, pick(row, PE_VISIT_PRIVATE));

  // Her address: the brand's to see once she has sent it, and hers always.
  if (side === 'influencer' || row.address_sent_at) Object.assign(out, pick(row, PE_SHIP_TO_PRIVATE));
  else out.address_sent_at = null;

  // The eleven legacy shipment_* columns (migration 024) are DELIBERATELY absent. They were
  // hand-typed, item 11 retires the doors that wrote them, and shipment_to_address_line is a
  // creator address by another name. The data stays in the table; it leaves through nothing.
  return out;
}

// Best-effort push to a specific user — never block the response.
function notify(targetUser, fcmToken, phone, type, title, body, data) {
  notificationService.send({
    userId:   targetUser,
    type, title, body, data, fcmToken,
    sendSms:  false,
    phone,
  }).catch(err => console.error('[PRODUCTION] notify failed:', err.message));
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

// POST /v1/contracts/:id/production/initialise  (brand only)
// Manual escape hatch when the production_event row is missing — usually
// because the contract was signed before Phase P shipped, or the brand
// picked production_mode after activation. Forces:
//   1. contracts.production_mode = body.mode (one of visit / shipment / remote)
//   2. production_event auto-created via autoCreateForContract
// Idempotent — re-calling with the same mode is a no-op past initial create.
const initialiseProduction = asyncHandler(async (req, res) => {
  const contract = await getContractParties(req.params.id);
  await ensureParty(contract, req, 'brand');
  await assertShootOpen(contract.id);
  // Item 10 (Phase 2d): the mode comes from the set. Nobody picks it here any more. The row is
  // created at the brand's signature (contractSign → autoCreateForContract), and the read door
  // heals a legacy contract without asking anyone to choose.
  return retiredModeChoice();
});

// GET /v1/contracts/:id/production
//
// Auto-heals legacy contracts: if the contract is active with a non-remote
// production_mode but the production_event row is missing (pre-Phase-P
// brand-sign), create it on read. Brand-sign normally handles this via
// autoCreateForContract, but old contracts signed before that code shipped
// never got an event. Without this heal, those contracts show "Remote
// production" misleadingly even when the contract row says visit/shipment.
const getProduction = asyncHandler(async (req, res) => {
  const contract = await getContractParties(req.params.id);
  await ensureParty(contract, req, 'either');
  await assertShootOpen(contract.id);
  let event = await productionService.getByContractId(contract.id);

  // The `!== 'remote'` that used to be here skipped the heal for remote contracts, because a
  // remote event was auto-completed and therefore pointless. It is not auto-completed any
  // more — she has to mark it done — so a remote contract needs its event like any other.
  // Contract: features/shoot-starts-where-the-agreement-left-it
  if (!event) {
    // Fetch the full contract row (production.service.autoCreateForContract
    // reads formats from it). getContractParties only returns a thin slice.
    const { rows: full } = await db.query(`SELECT * FROM contracts WHERE id = $1`, [contract.id]);
    if (full[0]) {
      try {
        event = await productionService.autoCreateForContract(db, full[0]);
      } catch (e) {
        console.error('[production] auto-heal failed for contract', contract.id, e.message);
      }
    }
  }

  if (!event) {
    return success(res, {
      production_event: null,
      production_mode:  contract.production_mode,
      log: [],
    });
  }
  const log = await productionService.getLog(event.id);
  // Item 11, finding 2: PROJECTED, never spread. `side` comes from who is asking, not from the
  // JWT role alone — a user may hold both roles on one number (project_environment_reality).
  const side = req.user.sub === contract.influencer_user_id ? 'influencer' : 'brand';
  return success(res, {
    production_event: projectEvent(event, side),
    production_mode:  contract.production_mode,
    log,
  });
});

// POST /v1/contracts/:id/production/visit-details
// Brand sets / updates the visit address + scheduled time + contact.
// Brand can also use this to reschedule a confirmed event (counts toward
// brand reschedule limit).
const setVisitDetails = asyncHandler(async (req, res) => {
  const contract = await getContractParties(req.params.id);
  await ensureParty(contract, req, 'brand');
  await assertShootOpen(contract.id);
  const event = await productionService.getByContractId(contract.id);
  if (!event) throw new AppError('NOT_FOUND', 'No production event for this contract', 404);
  if (event.mode !== 'visit') {
    throw new AppError('VALIDATION_ERROR', 'visit-details only applies to visit-mode events', 422);
  }
  retiredSlotDanceForVisit(event);   // Item 10 (Phase 2d): the plan is sent through the shoot plan

  let updated;
  try {
    updated = await productionService.setVisitDetails(event.id, req.body || {}, actorFromReq(req));
  } catch (err) {
    if (err.message === 'RESCHEDULE_LIMIT_REACHED') {
      throw new AppError('VALIDATION_ERROR',
        `Reschedule limit (${productionService.RESCHEDULE_LIMIT_PER_SIDE}) reached for the brand side. Contact admin to reset.`,
        409);
    }
    if (err.message === 'VISIT_DATE_OUT_OF_RANGE') {
      throw new AppError('VALIDATION_ERROR',
        `Visit date must fall between ${new Date(err.range.earliest).toDateString()} and ${new Date(err.range.latest).toDateString()}.`,
        422, 'visit_scheduled_at');
    }
    throw err;
  }

  const body = req.body?.visit_scheduled_at
    ? `${contract.brand_name} proposed a visit slot for "${contract.campaign_name}". Review and confirm.`
    : `${contract.brand_name} set the visit location for "${contract.campaign_name}". Pick your available slot.`;
  notify(
    contract.influencer_user_id, contract.influencer_fcm, contract.influencer_phone,
    'production.visit_proposed',
    'Visit details updated',
    body,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id }
  );

  return success(res, { production_event: updated });
});

// GET /v1/contracts/:id/production/date-range
// Returns the [earliest, latest] window the visit can be scheduled within.
// Used by both brand and influencer UIs to show valid date hints.
const getDateRange = asyncHandler(async (req, res) => {
  const contract = await getContractParties(req.params.id);
  await ensureParty(contract, req, 'either');
  await assertShootOpen(contract.id);
  const range = await productionService.getVisitDateRange(contract.id);
  return success(res, { range });
});

// POST /v1/production-events/:id/propose-slot  (influencer)
// Body: { visit_scheduled_at, visit_window_minutes?, notes? }
const proposeSlot = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'influencer');
  if (event.mode !== 'visit') {
    throw new AppError('VALIDATION_ERROR', 'propose-slot only applies to visit-mode events', 422);
  }
  retiredSlotDanceForVisit(event);   // Item 10 (Phase 2d): she counters the time on the shoot plan's thread

  let updated;
  try {
    const { notes, ...fields } = req.body || {};
    updated = await productionService.proposeSlot(event.id, fields, actorFromReq(req), notes);
  } catch (err) {
    if (err.message === 'VISIT_DATE_OUT_OF_RANGE') {
      throw new AppError('VALIDATION_ERROR',
        `Visit must be between ${new Date(err.range.earliest).toDateString()} and ${new Date(err.range.latest).toDateString()}.`,
        422, 'visit_scheduled_at');
    }
    if (err.message === 'RESCHEDULE_LIMIT_REACHED') {
      throw new AppError('VALIDATION_ERROR',
        `Reschedule limit (${productionService.RESCHEDULE_LIMIT_PER_SIDE}) reached for the influencer side.`,
        409);
    }
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  notify(
    contract.brand_user_id, contract.brand_fcm, contract.brand_phone,
    'production.slot_proposed',
    'Influencer picked a visit slot',
    `${contract.influencer_name} proposed a visit slot for "${contract.campaign_name}". Accept or counter.`,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id }
  );

  return success(res, { production_event: updated });
});

// POST /v1/production-events/:id/flip-to-remote  (brand OR influencer)
// Either party can request; the other confirms. On confirm, contracts.production_mode → 'remote'
// and the event moves to confirmed. It does NOT auto-complete: switching to remote settles
// WHERE she shoots, not whether she has. She marks it done when she has shot it.
const flipToRemote = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'either');
  // Item 10 (Phase 2d, rules §11): the mode of work cannot change inside the shoot plan.
  retiredModeChoice();

  let updated;
  try {
    updated = await productionService.requestRemoteFlip(event.id, actorFromReq(req), req.body?.notes);
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  // Whether this call was the request or the confirmation is decided in the
  // service (auto-confirms if other side already requested). Notify the
  // appropriate party.
  // Was this call the request or the confirmation? The flip only writes mode='remote' on
  // confirmation, so the mode alone answers it. This used to also require status='completed',
  // which stopped being true the moment a remote shoot had to be marked done by a person —
  // and would have silently sent the WRONG notification, saying someone had asked when they
  // had in fact agreed. Contract: features/shoot-starts-where-the-agreement-left-it
  const isConfirmed = updated.mode === 'remote';
  const target = req.user.sub === contract.brand_user_id
    ? { uid: contract.influencer_user_id, fcm: contract.influencer_fcm, phone: contract.influencer_phone }
    : { uid: contract.brand_user_id, fcm: contract.brand_fcm, phone: contract.brand_phone };
  notify(
    target.uid, target.fcm, target.phone,
    isConfirmed ? 'production.remote_flip_confirmed' : 'production.remote_flip_requested',
    isConfirmed ? 'Switched to remote production' : 'Other side wants to switch to remote',
    isConfirmed
      ? `Production mode for "${contract.campaign_name}" is now remote. Shoot it your own way, then mark the shoot done.`
      : `The other side asked to switch "${contract.campaign_name}" to remote (no shoot). Confirm to proceed.`,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id }
  );

  return success(res, { production_event: updated });
});

// POST /v1/production-events/:id/accept
// Shipment: influencer-only (confirms address). Visit: either side (whoever
// didn't propose the slot accepts it).
const acceptEvent = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, event.mode === 'shipment' ? 'influencer' : 'either');
  retiredSlotDanceForVisit(event);   // Item 10 (Phase 2d): a visit time is accepted on the shoot plan
  // Item 11 (Phase 2a): and there is nothing to accept on a Remote one. Both halves are now
  // closed, so this route answers a sentence whatever the mode.
  retired11('RETIRED_SHIPMENT_SLOT', MSG10.RETIRED_SHIPMENT_SLOT);

  let updated;
  try {
    updated = await productionService.accept(event.id, actorFromReq(req));
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  // Notify the OTHER party that the slot/address was accepted.
  const target = req.user.sub === contract.brand_user_id
    ? { uid: contract.influencer_user_id, fcm: contract.influencer_fcm, phone: contract.influencer_phone, who: contract.brand_name }
    : { uid: contract.brand_user_id, fcm: contract.brand_fcm, phone: contract.brand_phone, who: contract.influencer_name };
  const title = event.mode === 'shipment' ? 'Shipping address confirmed' : 'Visit slot confirmed';
  const body  = event.mode === 'shipment'
    ? `${target.who === contract.brand_name ? contract.influencer_name : contract.brand_name} confirmed the shipping address.`
    : `${target.who === contract.brand_name ? contract.influencer_name : contract.brand_name} accepted the visit slot for "${contract.campaign_name}".`;
  notify(target.uid, target.fcm, target.phone, 'production.confirmed', title, body,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id });

  return success(res, { production_event: updated });
});

// POST /v1/production-events/:id/counter-propose  (brand OR influencer)
// Body: { visit_scheduled_at?, visit_window_minutes?, visit_address?,
//         shipment_to_*, notes? }
const counterPropose = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'either');
  retiredSlotDanceForVisit(event);   // Item 10 (Phase 2d): a visit time is countered on the shoot plan's thread
  // Item 11 (Phase 2a): and a Remote shoot has no time and no address to counter — she sends
  // her address once and it locks (§28). Both halves closed.
  retired11('RETIRED_SHIPMENT_SLOT', MSG10.RETIRED_SHIPMENT_SLOT);

  let updated;
  try {
    const { notes, ...fields } = req.body || {};
    updated = await productionService.counterPropose(event.id, fields, actorFromReq(req), notes);
  } catch (err) {
    if (err.message === 'RESCHEDULE_LIMIT_REACHED') {
      const side = req.user.sub === contract.brand_user_id ? 'brand' : 'influencer';
      throw new AppError('VALIDATION_ERROR',
        `Reschedule limit (${productionService.RESCHEDULE_LIMIT_PER_SIDE}) reached for the ${side} side. Contact admin to reset.`,
        409);
    }
    if (err.message === 'VISIT_DATE_OUT_OF_RANGE') {
      throw new AppError('VALIDATION_ERROR',
        `Visit must be between ${new Date(err.range.earliest).toDateString()} and ${new Date(err.range.latest).toDateString()}.`,
        422, 'visit_scheduled_at');
    }
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  // Notify the OTHER party (whoever didn't make this call).
  const target = req.user.sub === contract.brand_user_id
    ? { uid: contract.influencer_user_id, fcm: contract.influencer_fcm, phone: contract.influencer_phone, who: contract.brand_name }
    : { uid: contract.brand_user_id, fcm: contract.brand_fcm, phone: contract.brand_phone, who: contract.influencer_name };
  notify(
    target.uid, target.fcm, target.phone,
    'production.counter_proposed',
    'Counter-proposal received',
    `${target.who} suggested an alternative for "${contract.campaign_name}". Review and confirm.`,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id }
  );

  return success(res, { production_event: updated });
});

// POST /v1/production-events/:id/dispatch
// Body: { courier, awb, expected_at?, notes? }
const dispatch = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'brand');
  // Item 11 (Phase 2a): a typed courier name and a typed AWB are not a shipment. F8 books one
  // through INFLX's shipping layer, debits the brand, locks the return and returns a label.
  retired11('RETIRED_DISPATCH', MSG10.RETIRED_DISPATCH);

  // stage-4 — a parcel with no contents is a note, not a shipment. Without this she gets a
  // courier number and a box, and no way to say WHICH of three sarees never turned up.
  const packed = await parcel.listItems(event.id, db);
  if (packed.length === 0) {
    throw new AppError('VALIDATION_ERROR',
      'Add what you are sending before you dispatch. She confirms the parcel item by item, so an empty box gives her nothing to confirm.',
      422, 'items');
  }

  let updated;
  try {
    updated = await productionService.dispatchShipment(event.id, req.body || {}, actorFromReq(req));
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  const courier = updated.shipment_courier ? ` via ${updated.shipment_courier}` : '';
  const awb = updated.shipment_awb ? ` (AWB ${updated.shipment_awb})` : '';
  notify(
    contract.influencer_user_id, contract.influencer_fcm, contract.influencer_phone,
    'production.dispatched',
    'Package dispatched',
    `${contract.brand_name} shipped your package${courier}${awb}. Confirm receipt once it arrives.`,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id }
  );

  return success(res, { production_event: updated });
});

// POST /v1/production-events/:id/confirm-received
const confirmReceived = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'influencer');
  // Item 11 (Phase 2a): "the box arrived" is not what §11.2 asks of her. F12 takes her answer
  // line by line — received, missing or damaged, with a note — and a difference never stops
  // her shoot. This door could record a whole parcel as fine with one press.
  retired11('RETIRED_CONFIRM_RECEIVED', MSG10.RETIRED_CONFIRM_RECEIVED);

  // stage-4 — her answers ride along, one per item. Optional: a shipment dispatched before
  // this stage has no items, and she must still be able to say the box arrived.
  let receipt = null;
  if (Array.isArray(req.body?.answers) && req.body.answers.length) {
    receipt = await parcel.recordReceipt(event.id, req.body.answers, db);
    if (!receipt.ok) throw new AppError('VALIDATION_ERROR', receipt.message, 422, receipt.field);
    await productionService.logAction(null, event.id, req.user.sub, 'influencer', 'receipt_recorded',
      receipt.shortfall.length
        ? `Flagged: ${receipt.shortfall.map(i => i.name).join(', ')}`
        : 'Everything arrived',
      { received: receipt.received, total: receipt.total, shortfall: receipt.shortfall.length });
  }

  let updated;
  try {
    updated = await productionService.confirmReceived(event.id, req.body?.notes, actorFromReq(req));
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  // A SHORTFALL IS THE BRAND'S PROBLEM, NOT HERS. So the brand is told immediately, with the
  // item NAMED — not 'there was a problem with your shipment', which makes her explain it.
  const short = receipt?.shortfall || [];
  if (short.length) {
    const names = short.map(i => i.name).filter(Boolean);
    const listed = names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} more`;
    notify(
      contract.brand_user_id, contract.brand_fcm, contract.brand_phone,
      'production.shortfall',
      'Something did not arrive',
      `${contract.influencer_name} received the parcel for "${contract.campaign_name}" but flagged ${listed}. She is shooting the rest — resend or drop it.`,
      { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id, production_event_id: event.id }
    );
  } else {
    notify(
      contract.brand_user_id, contract.brand_fcm, contract.brand_phone,
      'production.received',
      'Influencer confirmed receipt',
      `${contract.influencer_name} confirmed they received the package for "${contract.campaign_name}".`,
      { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id }
    );
  }

  return success(res, { production_event: updated, receipt });
});

// POST /v1/production-events/:id/complete
const complete = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'either');
  // Item 11 (Phase 2a), approval §2.9 — RETIRED FOR REMOTE ONLY.
  //
  // The caller audit found a live Store Visit caller: the brand website's "Mark visit done"
  // (Packages/brand-web/app/dashboard/campaigns/[id]/influencers/page.js:525 → markVisitDone
  // :287), inside the visit branch. Retiring this route outright would break item 10's own
  // path from the website, so the visit branch stays exactly as it was.
  //
  // For Remote, F14 replaces it and adds the rule this door has never had: she must have
  // checked what arrived first (§11.2, "once she has checked what arrived").
  retired11ForRemote(event, 'RETIRED_COMPLETE_REMOTE', MSG10.RETIRED_COMPLETE_REMOTE);

  // stage-4 — this used to refuse anything that was not a visit, which meant a REMOTE shoot
  // had no way of being marked done at all. Who may mark it now depends on the mode, and the
  // rule lives in parcel.service so the endpoint and the screen read one answer:
  //   store visit       — either party (the brand was there)
  //   remote / shipment — the creator alone (the brand cannot see whether she has shot)
  // Founder, 2026-08-27. Enforced inside completeShoot; checked here to answer 403 not 422.
  if (!parcel.canComplete(event.mode, req.user.role)) {
    throw new AppError('FORBIDDEN',
      'Only the creator can say the shoot is done — you cannot see whether it has happened yet. She submits the content next, and that is the proof.',
      403);
  }

  let updated;
  try {
    updated = await productionService.completeShoot(event.id, req.body?.notes, actorFromReq(req));
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  // Notify the OTHER party
  const target = req.user.sub === contract.brand_user_id
    ? { uid: contract.influencer_user_id, fcm: contract.influencer_fcm, phone: contract.influencer_phone }
    : { uid: contract.brand_user_id, fcm: contract.brand_fcm, phone: contract.brand_phone };
  notify(
    target.uid, target.fcm, target.phone,
    'production.completed',
    'Shoot marked done',
    `The shoot for "${contract.campaign_name}" was marked done. Time to start the content.`,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id }
  );

  return success(res, { production_event: updated });
});

// POST /v1/production-events/:id/cancel  (admin only)
const adminCancel = asyncHandler(async (req, res) => {
  if (!req.user.role || !req.user.role.startsWith('admin')) {
    throw new AppError('FORBIDDEN', 'Admin only', 403);
  }
  const event = await getEventOrThrow(req.params.id);

  let updated;
  try {
    updated = await productionService.cancel(event.id, req.body?.reason, actorFromReq(req));
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }
  return success(res, { production_event: updated });
});

// Local brand lookup — mirrors the same helper in campaign/contract/escrow
// controllers (existing per-controller convention in this codebase).
async function getBrandOrThrow(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0];
}

/* GET /v1/campaigns/:id/production — campaign-wide production roster (brand only).
   Backend batch item 3. Until now production state was only readable one contract at
   a time (GET /contracts/:id/production), which is why the brand Production stage
   could show a per-creator logistics *chip* but no real state or inline action.
   LEFT JOINs from campaign_influencers so creators without a contract/event yet still
   appear (as production_event: null) rather than silently vanishing. */
const listCampaignProduction = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);

  const { rows } = await db.query(
    `SELECT
        ci.id                AS campaign_influencer_id,
        ci.status            AS influencer_status,
        ci.physical_delivery,
        inf.instagram_handle,
        u.name               AS influencer_name,
        con.id               AS contract_id,
        con.production_mode,
        pe.id                AS production_event_id,
        pe.mode,
        pe.status            AS production_status,
        pe.visit_address, pe.visit_city, pe.visit_pincode,
        pe.visit_scheduled_at, pe.visit_window_minutes,
        pe.visit_contact_name, pe.visit_contact_phone, pe.visit_completed_at,
        pe.plan_sent_at
        -- (address_sent_at joins this list in 2c, once migration 191 has created it.)
        -- Item 11, finding 2: the six legacy shipment_to_* / shipment_courier / shipment_awb
        -- columns are GONE from this projection. shipment_to_address_line is a creator address
        -- by another name, and this roster emitted it with the gate as a COLUMN — every row
        -- came back whether the gate was open or not. The hand-typed courier fields go with
        -- them, because the doors that wrote them are retired below. The data stays in the
        -- table; nothing carries it to a client.
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns     c  ON c.id  = cs.campaign_id
     JOIN influencers   inf ON inf.id = ci.influencer_id
     JOIN users         u   ON u.id   = inf.user_id
     LEFT JOIN contracts        con ON con.campaign_influencer_id = ci.id
     LEFT JOIN production_events pe ON pe.contract_id = con.id
     WHERE c.id = $1
       AND c.brand_id = $2
       -- Item 10 (approval §2.3): a fourth value used to sit in this list that is not a member
       -- of campaign_influencer_status, so it silently matched nothing. A signed collaboration
       -- runs contracted → active → completed; those three are the roster.
       AND ci.status IN ('contracted', 'active', 'completed')
     ORDER BY inf.instagram_handle ASC`,
    [req.params.id, brand.id]
  );

  // Item 10: the gate as a column, so the roster says WHY a shoot is not open rather than
  // showing a row that every other door would refuse.
  const gates = await shootGate.shootGateMany(rows.map(r => r.campaign_influencer_id));
  const production = rows.map(r => {
    const g = gates.get(r.campaign_influencer_id) || null;
    return { ...r, gate: g ? { open: g.open, reason: g.reason, money: g.money } : null };
  });

  return success(res, { production });
});


// GET /v1/brands/me/shoots — every shoot this brand has, across every campaign.
//
// stage-4 · M-2 · board panel ②
//
// WHY BRAND-WIDE AND NOT PER CAMPAIGN
// listCampaignProduction already exists and is scoped to one campaign. That is the wrong shape
// for the question a brand actually asks in the morning, which is "what is waiting on me
// today" — and shoots waiting on them are spread across whatever campaigns happen to be
// running. A per-campaign list makes them visit four screens to answer one question.
//
// NEEDS-YOU FIRST, DECIDED HERE
// The ordering is computed server-side, for the same reason Stage 3's step number is: the
// creator's app renders the same shoot, and two clients working out "whose turn" separately
// is how they end up disagreeing about one fact.
const listBrandShoots = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);

  const { rows } = await db.query(
    `SELECT
        pe.id                AS production_event_id,
        pe.mode,
        pe.status            AS production_status,
        pe.slot_proposed_by,
        pe.reschedule_count_brand,
        pe.reschedule_count_influencer,
        pe.visit_scheduled_at, pe.visit_completed_at,
        pe.visit_address, pe.visit_city,
        -- Item 10: the plan's own timestamps and the Delayed flag, so the list can say the stage.
        pe.plan_sent_at, pe.time_agreed_at, pe.influencer_completed_at, pe.brand_completed_at, pe.auto_confirmed_at,
        ci.delayed_at, ci.delayed_stage, cs.go_live_date,
        pe.shipment_courier, pe.shipment_awb,
        pe.shipment_dispatched_at, pe.shipment_expected_at,
        pe.shipment_delivered_at, pe.shipment_received_confirmed_at,
        con.id               AS contract_id,
        ci.id                AS campaign_influencer_id,
        u.name               AS influencer_name,
        inf.instagram_handle,
        inf.profile_image_url,
        c.id                 AS campaign_id,
        c.name               AS campaign_name,
        -- What is in the box, counted here rather than in a second round trip per row.
        (SELECT count(*) FROM production_event_items i
          WHERE i.production_event_id = pe.id AND i.dropped_at IS NULL)          AS item_count,
        (SELECT count(*) FROM production_event_items i
          WHERE i.production_event_id = pe.id AND i.dropped_at IS NULL
            AND i.receipt_status IN ('missing', 'damaged'))                      AS shortfall_count
     FROM production_events pe
     JOIN contracts            con ON con.id = pe.contract_id
     JOIN campaign_influencers ci  ON ci.id  = con.campaign_influencer_id
     JOIN campaign_sets        cs  ON cs.id  = ci.set_id
     JOIN campaigns            c   ON c.id   = cs.campaign_id
     JOIN influencers          inf ON inf.id = ci.influencer_id
     JOIN users                u   ON u.id   = inf.user_id
     WHERE c.brand_id = $1
       AND pe.status <> 'cancelled'
     ORDER BY
       -- Needs you first. A shoot is the brand's move when they proposed nothing, when she
       -- has suggested a time they have not answered, or when a confirmed shipment has not
       -- gone out. Everything else is hers or nobody's, and sorts underneath.
       CASE
         WHEN pe.status = 'proposed'  AND pe.visit_scheduled_at IS NULL              THEN 0
         WHEN pe.status = 'proposed'  AND pe.slot_proposed_by = 'influencer'         THEN 0
         WHEN pe.status = 'confirmed' AND pe.mode = 'shipment'
              AND pe.shipment_dispatched_at IS NULL                                 THEN 0
         ELSE 1
       END,
       -- Then a shortfall they have not answered, then soonest first.
       CASE WHEN EXISTS (
         SELECT 1 FROM production_event_items i
          WHERE i.production_event_id = pe.id AND i.dropped_at IS NULL
            AND i.receipt_status IN ('missing', 'damaged')
       ) THEN 0 ELSE 1 END,
       COALESCE(pe.visit_scheduled_at, pe.shipment_expected_at, pe.created_at) ASC`,
    [brand.id]
  );

  // Item 10: the gate as a FILTER. A shoot whose collaboration is not signed and funded is not
  // a shoot the brand can act on, and every door behind this list would refuse it.
  const gates = await shootGate.shootGateMany(rows.map(r => r.campaign_influencer_id));
  const shootPlan = require('../services/shootPlan.service');
  const shoots = rows
    .filter(r => { const g = gates.get(r.campaign_influencer_id); return g && g.open; })
    .map(r => ({
      ...r,
      gate: { open: true, money: gates.get(r.campaign_influencer_id).money },
      stage: r.mode === 'visit' ? shootPlan.stageOf({ id: r.production_event_id, status: r.production_status, plan_sent_at: r.plan_sent_at, time_agreed_at: r.time_agreed_at, influencer_completed_at: r.influencer_completed_at, brand_completed_at: r.brand_completed_at, auto_confirmed_at: r.auto_confirmed_at }) : null,
      delayed: r.delayed_at ? { at: r.delayed_at, stage: r.delayed_stage } : null,
    }));

  return success(res, { shoots });
});

// ─── The parcel ─────────────────────────────────────────────────────────────
// stage-4 · features/stage-4-the-shoot · board panels ④ ⑤ ⑥
//
// Before this, a shipment knew it was sent and when it landed and had NO IDEA what was in it.
// So a brand typed "3 sarees" into a note, she confirmed a sentence, and nothing could
// reconcile the two. Items are PICKED from the catalogue so the box, her receipt and the
// products she can tag in a post are the same objects.

// GET /v1/production-events/:id/items — both parties. She needs to see it to confirm it.
const getParcel = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'either');

  const [items, summary] = await Promise.all([
    parcel.listItems(event.id, db),
    parcel.summarise(event.id, db),
  ]);
  return success(res, { items, summary });
});

// POST /v1/production-events/:id/items — brand packs the box.
// Body: { items: [{ product_id, quantity }], parcel_no? }
const addParcelItems = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'brand');

  const result = await parcel.addItems(event.id, {
    brandId:  contract.brand_id,
    items:    req.body?.items,
    parcelNo: Number(req.body?.parcel_no || 1),
  }, db);
  if (!result.ok) throw new AppError('VALIDATION_ERROR', result.message, 422, result.field);

  await productionService.logAction(null, event.id, req.user.sub, 'brand', 'parcel_packed',
    `${result.items.length} item(s) added to parcel ${req.body?.parcel_no || 1}`,
    { count: result.items.length, parcel_no: Number(req.body?.parcel_no || 1) });

  return success(res, { items: result.items, summary: await parcel.summarise(event.id, db) });
});

// DELETE /v1/production-events/:id/items/:itemId — brand takes something back out.
const removeParcelItem = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'brand');

  // Once it has gone, taking a row out would erase the record of what was sent. After
  // dispatch the honest move is to DROP it, which is a different verb with a timestamp.
  if (event.shipment_dispatched_at) {
    throw new AppError('VALIDATION_ERROR',
      'This parcel has already gone. You can drop an item she flagged, but you cannot change what was in the box.',
      422);
  }

  const result = await parcel.removeItem(event.id, req.params.itemId, db);
  if (!result.ok) throw new AppError('NOT_FOUND', 'That item is not in this parcel', 404);

  await productionService.logAction(null, event.id, req.user.sub, 'brand', 'parcel_item_removed',
    'An item was taken out before dispatch', null);
  return success(res, { summary: await parcel.summarise(event.id, db) });
});

// POST /v1/production-events/:id/items/:itemId/drop — brand answers a shortfall by dropping.
const dropParcelItem = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'brand');
  // Item 11 (Phase 2a): dropping belonged to a flow where a shortfall was answered by a resend
  // or a removal. §11.2 has neither — there is one parcel, her answer is recorded as she gave
  // it, and if the brand disagrees it reports a difference to INFLX (F13), which item 18 picks
  // up. A door that lets the brand erase a line she flagged is the opposite of that.
  //
  // It also carved products out of a hand-picked selling scope (parcel.service.dropItem
  // :209-229), which would now silently narrow what she may sell — a thing settled at signing
  // and not the shoot's to change.
  retired11('RETIRED_DROP', MSG10.RETIRED_DROP);

  const result = await parcel.dropItem(event.id, req.params.itemId, db);
  if (!result.ok) throw new AppError('NOT_FOUND', result.message, 404);

  await productionService.logAction(null, event.id, req.user.sub, 'brand', 'item_dropped',
    `${result.item.name_at_dispatch || 'An item'} was dropped rather than resent`,
    { removed_from_allocation: result.removedFromAllocation });

  // Tell her, because it changes what she is shooting — and, on a hand-picked list, what she
  // may sell. Saying nothing would leave her waiting for a replacement that is not coming.
  notify(
    contract.influencer_user_id, contract.influencer_fcm, contract.influencer_phone,
    'production.item_dropped',
    'One item is not coming',
    `${contract.brand_name} has dropped ${result.item.name_at_dispatch || 'an item'} from this shoot. Shoot the rest — nothing else changes.`,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id, production_event_id: event.id }
  );

  return success(res, {
    item: result.item,
    removed_from_allocation: result.removedFromAllocation,
    summary: await parcel.summarise(event.id, db),
  });
});

module.exports = {
  getProduction,
  listCampaignProduction,
  getDateRange,
  initialiseProduction,
  setVisitDetails,
  proposeSlot,
  acceptEvent,
  counterPropose,
  dispatch,
  confirmReceived,
  complete,
  flipToRemote,
  adminCancel,
  listBrandShoots,
  getParcel,
  addParcelItems,
  removeParcelItem,
  dropParcelItem,
};
