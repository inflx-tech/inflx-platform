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
const notificationService = require('../services/notification.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─── Helpers ────────────────────────────────────────────────────────────────

// Look up the contract + the parties; we need both user_ids to authorise
// + later to push notifications to the OTHER party.
async function getContractParties(contractId) {
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
     JOIN campaigns        camp ON camp.id = ci.campaign_id
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

  let updated;
  try {
    updated = await productionService.confirmReceived(event.id, req.body?.notes, actorFromReq(req));
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  notify(
    contract.brand_user_id, contract.brand_fcm, contract.brand_phone,
    'production.received',
    'Influencer confirmed receipt',
    `${contract.influencer_name} confirmed they received the package for "${contract.campaign_name}".`,
    { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id }
  );

  return success(res, { production_event: updated });
});

// POST /v1/production-events/:id/complete
const complete = asyncHandler(async (req, res) => {
  const event = await getEventOrThrow(req.params.id);
  const contract = await getContractByEvent(event);
  await ensureParty(contract, req, 'either');
  if (event.mode !== 'visit') {
    throw new AppError('VALIDATION_ERROR', 'complete only applies to visit-mode events', 422);
  }

  let updated;
  try {
    updated = await productionService.completeVisit(event.id, req.body?.notes, actorFromReq(req));
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
    'Visit marked complete',
    `The visit for "${contract.campaign_name}" was marked complete. Time to start the content.`,
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

module.exports = {
  getProduction,
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
};
