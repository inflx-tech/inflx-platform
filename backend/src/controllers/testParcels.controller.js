'use strict';

/**
 * testParcels.controller.js — Admin → Test parcels (mockup R18).
 * Contract: features/item11-remote §6.4 · F19 · checks 35, 36
 *
 * Until the Shiprocket account is live, this page IS the courier. It lists every simulated
 * parcel and, for each, the events it could plausibly send next — and every press goes
 * through `webhook.handle`, the same function a real provider's delivery will reach. So the
 * notifications, the Needs You moves, the wallet rows and the Delayed flag are all exercised
 * by a human pressing a button here, months before a parcel exists.
 *
 * Admin only, behind the `shipping` capability. **Every press is logged with who and when** —
 * in production_event_log where the shoot can see it, and in the event's own raw payload.
 */

const db = require('../config/db');
const env = require('../config/env');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { EVENTS } = require('../services/shipping/contract');
const { injectSimulated } = require('./shippingWebhook.controller');

/**
 * What this parcel could believably do next. Not a hard state machine — a real courier can
 * send anything in any order, and item 11 must survive that (check 17) — but the page should
 * not offer "delivered" on a parcel that is already back at the store.
 */
function nextEvents(s) {
  const out = [];
  if (s.cancelled_at) return out;
  if (s.returned_to_store_at) return [EVENTS.WEIGHT_CHARGE];
  if (!s.collected_at) out.push(EVENTS.COLLECTED, EVENTS.CANCELLED);
  else if (!s.delivered_at) {
    out.push(EVENTS.OUT_FOR_DELIVERY, EVENTS.ATTEMPT_FAILED, EVENTS.DELIVERED, EVENTS.RETURNED_TO_STORE);
  }
  out.push(EVENTS.WEIGHT_CHARGE);
  // Every event stays POSSIBLE — the page just marks which are the expected next ones. A late
  // or out-of-order update is exactly what check 17 needs to be able to produce.
  return [...new Set(out)];
}

/* GET /v1/admin/test-parcels */
const list = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*,
            b.business_name AS brand_name,
            COALESCE(i.full_name, u.name) AS creator_name,
            cs.name AS set_name, c.name AS campaign_name,
            (SELECT count(*)::int FROM shipment_events e WHERE e.shipment_id = s.id) AS event_count,
            (SELECT max(e.occurred_at) FROM shipment_events e WHERE e.shipment_id = s.id) AS last_event_at
       FROM shipments s
       LEFT JOIN production_events pe ON pe.id = s.production_event_id
       LEFT JOIN contracts con ON con.id = pe.contract_id
       LEFT JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       LEFT JOIN campaign_sets cs ON cs.id = ci.set_id
       LEFT JOIN campaigns c ON c.id = cs.campaign_id
       LEFT JOIN brands b ON b.id = c.brand_id
       LEFT JOIN influencers i ON i.id = ci.influencer_id
       LEFT JOIN users u ON u.id = i.user_id
      WHERE s.provider = 'simulator'
      ORDER BY s.created_at DESC
      LIMIT 100`
  );

  const parcels = rows.map((s) => ({
    id: s.id,
    direction: s.direction,
    provider: s.provider,
    brandName: s.brand_name, creatorName: s.creator_name,
    campaignName: s.campaign_name, setName: s.set_name,
    courierName: s.courier_name, trackingNumber: s.tracking_number,
    weightKg: s.weight_kg == null ? null : Number(s.weight_kg),
    chargedAmount: s.charged_amount == null ? null : Number(s.charged_amount),
    returnHoldAmount: s.return_hold_amount == null ? null : Number(s.return_hold_amount),
    bookedAt: s.booked_at, collectedAt: s.collected_at, outForDeliveryAt: s.out_for_delivery_at,
    deliveredAt: s.delivered_at, returnedToStoreAt: s.returned_to_store_at,
    cancelledAt: s.cancelled_at, attemptFailedCount: s.attempt_failed_count,
    eventCount: s.event_count, lastEventAt: s.last_event_at,
    next: nextEvents(s),
  }));

  return success(res, {
    provider: env.SHIPPING_PROVIDER,
    live: env.SHIPPING_PROVIDER !== 'simulator',
    testPincodes: [
      { pincode: 'ending 999', means: 'no courier delivers — she cannot send that address' },
      { pincode: 'ending 998', means: 'delivers, but no return pickup — she posts Return items back herself' },
      { pincode: 'anything else', means: 'delivers and collects returns' },
    ],
    parcels,
  });
});

/* GET /v1/admin/test-parcels/:id/events */
const events = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, event, occurred_at, applied, amount, reason, payload, created_at
       FROM shipment_events WHERE shipment_id = $1 ORDER BY occurred_at, created_at`,
    [req.params.id]
  );
  return success(res, { events: rows });
});

/* POST /v1/admin/test-parcels/:id/events   { event, reason?, amount?, occurredAt? } */
const inject = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM shipments WHERE id = $1`, [req.params.id]);
  const s = rows[0];
  if (!s) throw new AppError('NOT_FOUND', 'No such parcel.', 404);
  if (s.provider !== 'simulator') {
    throw new AppError('TEST_PARCEL_REAL_PROVIDER', 'Test parcels only work with the simulator.', 422, 'provider');
  }

  const out = await injectSimulated({
    shipmentId: s.id,
    event: String(req.body?.event || ''),
    occurredAt: req.body?.occurredAt || new Date(),
    amount: req.body?.amount,
    reason: req.body?.reason,
    actorUserId: req.user.sub,
  });

  // Check 35 — every press, with who and when, where the shoot's own history can see it.
  if (s.production_event_id) {
    const productionService = require('../services/production.service');
    await productionService.logAction(
      null, s.production_event_id, req.user.sub, 'admin', `test_parcel.${req.body?.event}`,
      `Admin injected a simulated "${req.body?.event}" on the ${s.direction} parcel`
        + (out.duplicate ? ' (duplicate — nothing changed)' : out.applied ? '' : ' (out of order — nothing changed)'),
      { shipment_id: s.id, event: req.body?.event, amount: req.body?.amount ?? null, reason: req.body?.reason || null, applied: !!out.applied, duplicate: !!out.duplicate }
    ).catch(() => null);
  }

  return success(res, {
    duplicate: !!out.duplicate,
    applied: !!out.applied,
    parcel: out.shipment || null,
  });
});

module.exports = { list, events, inject, nextEvents };
