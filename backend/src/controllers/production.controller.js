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

function actorFromReq(req) {
  return { user_id: req.user.sub, role: req.user.role };
}

async function getEventOrThrow(eventId) {
  const event = await productionService.getById(eventId);
  if (!event) throw new AppError('NOT_FOUND', 'Production event not found', 404);
  return event;
}

async function getContractByEvent(event) {
  return getContractParties(event.contract_id);
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

  const { mode } = req.body || {};
  if (!productionService.VALID_MODES.includes(mode)) {
    throw new AppError('VALIDATION_ERROR',
      `mode must be one of: ${productionService.VALID_MODES.join(', ')}`, 422, 'mode');
  }

  // Update production_mode on the contract row first so autoCreateForContract
  // sees the right mode when it reads the full row.
  await db.query(`UPDATE contracts SET production_mode = $1 WHERE id = $2`, [mode, contract.id]);
  const { rows: full } = await db.query(`SELECT * FROM contracts WHERE id = $1`, [contract.id]);
  let event;
  try {
    event = await productionService.autoCreateForContract(db, full[0]);
  } catch (e) {
    throw new AppError('INTERNAL_ERROR', `Could not initialise production: ${e.message}`, 500);
  }
  return success(res, { production_event: event, production_mode: mode });
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
  let event = await productionService.getByContractId(contract.id);

  if (!event && contract.production_mode && contract.production_mode !== 'remote') {
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
  return success(res, { production_event: event, production_mode: contract.production_mode, log });
});

// POST /v1/contracts/:id/production/visit-details
// Brand sets / updates the visit address + scheduled time + contact.
// Brand can also use this to reschedule a confirmed event (counts toward
// brand reschedule limit).
const setVisitDetails = asyncHandler(async (req, res) => {
  const contract = await getContractParties(req.params.id);
  await ensureParty(contract, req, 'brand');
  const event = await productionService.getByContractId(contract.id);
  if (!event) throw new AppError('NOT_FOUND', 'No production event for this contract', 404);
  if (event.mode !== 'visit') {
    throw new AppError('VALIDATION_ERROR', 'visit-details only applies to visit-mode events', 422);
  }

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
// and the event auto-completes (no shoot needed).
const flipToRemote = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'either');

  let updated;
  try {
    updated = await productionService.requestRemoteFlip(event.id, actorFromReq(req), req.body?.notes);
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  // Whether this call was the request or the confirmation is decided in the
  // service (auto-confirms if other side already requested). Notify the
  // appropriate party.
  const isConfirmed = updated.mode === 'remote' && updated.status === 'completed';
  const target = req.user.sub === contract.brand_user_id
    ? { uid: contract.influencer_user_id, fcm: contract.influencer_fcm, phone: contract.influencer_phone }
    : { uid: contract.brand_user_id, fcm: contract.brand_fcm, phone: contract.brand_phone };
  notify(
    target.uid, target.fcm, target.phone,
    isConfirmed ? 'production.remote_flip_confirmed' : 'production.remote_flip_requested',
    isConfirmed ? 'Switched to remote production' : 'Other side wants to switch to remote',
    isConfirmed
      ? `Production mode for "${contract.campaign_name}" is now remote. Create content from the brief — no shoot needed.`
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
        pe.shipment_to_address_line, pe.shipment_to_city, pe.shipment_to_pincode,
        pe.shipment_courier, pe.shipment_awb,
        pe.shipment_dispatched_at, pe.shipment_expected_at,
        pe.shipment_delivered_at, pe.shipment_received_confirmed_at
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns     c  ON c.id  = cs.campaign_id
     JOIN influencers   inf ON inf.id = ci.influencer_id
     JOIN users         u   ON u.id   = inf.user_id
     LEFT JOIN contracts        con ON con.campaign_influencer_id = ci.id
     LEFT JOIN production_events pe ON pe.contract_id = con.id
     WHERE c.id = $1
       AND c.brand_id = $2
       AND ci.status IN ('contracted', 'active', 'live', 'completed')
     ORDER BY inf.instagram_handle ASC`,
    [req.params.id, brand.id]
  );

  return success(res, { production: rows });
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

  return success(res, { shoots: rows });
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
