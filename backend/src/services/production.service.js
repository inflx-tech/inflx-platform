'use strict';

/**
 * production.service.js
 *
 * State transitions + audit logging for production_events. Pure DB layer —
 * controllers handle auth, request shape, and notifications. Keep transitions
 * here so the rules are in one place.
 */

const db = require('../config/db');

const VALID_MODES = ['visit', 'shipment', 'remote'];
const VALID_STATUSES = ['proposed', 'confirmed', 'in_progress', 'completed', 'cancelled'];

const RESCHEDULE_LIMIT_PER_SIDE = 2;

// ─── Auto-create at contract activation ─────────────────────────────────────
//
// Called from contract.controller.brandSign once the contract row goes to
// 'active'. Picks the mode from contracts.production_mode and pre-fills
// shipment address from the campaign_influencer's delivery_address (which
// the influencer set during onboarding) if available.
async function autoCreateForContract(client, contract) {
  const mode = contract.production_mode || 'remote';
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Invalid production_mode "${mode}" on contract ${contract.id}`);
  }

  // Skip duplicate creation if a row already exists (e.g. retried brand-sign).
  const existing = await client.query(
    `SELECT id FROM production_events WHERE contract_id = $1`,
    [contract.id]
  );
  if (existing.rows[0]) return existing.rows[0];

  // Remote mode shortcuts to completed — there's nothing to coordinate.
  const initialStatus = mode === 'remote' ? 'completed' : 'proposed';

  // Auto-fill shipping address from campaign_influencers.delivery_address.
  // Falls back to NULL — brand can override at the visit/shipment-details step.
  let shipFields = {};
  if (mode === 'shipment') {
    const { rows } = await client.query(
      `SELECT ci.delivery_address, u.city, u.state, u.pincode
       FROM   campaign_influencers ci
       JOIN   influencers inf ON inf.id = ci.influencer_id
       JOIN   users u ON u.id = inf.user_id
       WHERE  ci.id = $1`,
      [contract.campaign_influencer_id]
    );
    if (rows[0]) {
      shipFields = {
        shipment_to_address_line: rows[0].delivery_address || null,
        shipment_to_city:    rows[0].city || null,
        shipment_to_state:   rows[0].state || null,
        shipment_to_pincode: rows[0].pincode || null,
      };
    }
  }

  const { rows: created } = await client.query(
    `INSERT INTO production_events
       (contract_id, mode, status,
        shipment_to_address_line, shipment_to_pincode, shipment_to_city, shipment_to_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      contract.id, mode, initialStatus,
      shipFields.shipment_to_address_line || null,
      shipFields.shipment_to_pincode || null,
      shipFields.shipment_to_city || null,
      shipFields.shipment_to_state || null,
    ]
  );
  const event = created[0];

  await logAction(client, event.id, null, 'system', 'mode_set', `Mode set to ${mode}`, { mode });
  if (initialStatus === 'completed') {
    await logAction(client, event.id, null, 'system', 'completed', 'Remote mode auto-completed', null);
  } else {
    await logAction(client, event.id, null, 'system', 'proposed', 'Awaiting brand to fill in details', null);
  }

  return event;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

async function getByContractId(contractId) {
  const { rows } = await db.query(
    `SELECT * FROM production_events WHERE contract_id = $1`,
    [contractId]
  );
  return rows[0] || null;
}

async function getById(id) {
  const { rows } = await db.query(
    `SELECT * FROM production_events WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getLog(eventId) {
  const { rows } = await db.query(
    `SELECT id, actor_role, action, notes, metadata, created_at
     FROM   production_event_log
     WHERE  production_event_id = $1
     ORDER  BY created_at ASC`,
    [eventId]
  );
  return rows;
}

// ─── Updates / transitions ──────────────────────────────────────────────────

// Brand fills in visit details (address, time, contact) on a 'proposed' event.
// Status stays 'proposed' until influencer accepts.
async function setVisitDetails(eventId, fields, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.mode !== 'visit') throw new Error('WRONG_MODE');
  if (!['proposed', 'confirmed'].includes(event.status)) {
    throw new Error(`Cannot edit visit details in status "${event.status}"`);
  }

  const setClauses = [];
  const params = [];
  const FIELD_MAP = {
    visit_address:        'visit_address',
    visit_pincode:        'visit_pincode',
    visit_city:           'visit_city',
    visit_state:          'visit_state',
    visit_maps_url:       'visit_maps_url',
    visit_scheduled_at:   'visit_scheduled_at',
    visit_window_minutes: 'visit_window_minutes',
    visit_contact_name:   'visit_contact_name',
    visit_contact_phone:  'visit_contact_phone',
  };
  for (const [k, col] of Object.entries(FIELD_MAP)) {
    if (fields[k] !== undefined) {
      params.push(fields[k] || null);
      setClauses.push(`${col} = $${params.length}`);
    }
  }
  if (!setClauses.length) return event;

  // Brand changing details on a confirmed event = reschedule by brand.
  let newStatus = event.status;
  let action = 'visit_details_set';
  if (event.status === 'confirmed') {
    if (event.reschedule_count_brand >= RESCHEDULE_LIMIT_PER_SIDE) {
      throw new Error('RESCHEDULE_LIMIT_REACHED');
    }
    setClauses.push(`reschedule_count_brand = reschedule_count_brand + 1`);
    newStatus = 'proposed';   // back to influencer for re-confirm
    setClauses.push(`status = 'proposed'`);
    action = 'rescheduled_by_brand';
  }
  setClauses.push(`updated_at = NOW()`);
  params.push(eventId);

  const { rows } = await db.query(
    `UPDATE production_events SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  await logAction(null, eventId, actor.user_id, actor.role, action, null, fields);
  return rows[0];
}

// Influencer accepts the proposed details (visit) or confirms the address (shipment).
async function accept(eventId, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.status !== 'proposed') {
    throw new Error(`Cannot accept event in status "${event.status}"`);
  }
  if (actor.role !== 'influencer') {
    throw new Error('Only influencer can accept');
  }

  const { rows } = await db.query(
    `UPDATE production_events
     SET status = 'confirmed', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [eventId]
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'accepted', null, null);
  return rows[0];
}

// Influencer counter-proposes a shipment address change (or visit time alt).
async function counterPropose(eventId, fields, actor, notes) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (!['proposed', 'confirmed'].includes(event.status)) {
    throw new Error(`Cannot counter-propose on status "${event.status}"`);
  }
  if (actor.role !== 'influencer') {
    throw new Error('Only influencer can counter-propose');
  }
  if (event.reschedule_count_influencer >= RESCHEDULE_LIMIT_PER_SIDE) {
    throw new Error('RESCHEDULE_LIMIT_REACHED');
  }

  const setClauses = [];
  const params = [];
  const FIELD_MAP = event.mode === 'visit' ? {
    visit_scheduled_at:   'visit_scheduled_at',
    visit_window_minutes: 'visit_window_minutes',
    visit_address:        'visit_address',
  } : {
    shipment_to_address_line: 'shipment_to_address_line',
    shipment_to_pincode:      'shipment_to_pincode',
    shipment_to_city:         'shipment_to_city',
    shipment_to_state:        'shipment_to_state',
  };
  for (const [k, col] of Object.entries(FIELD_MAP)) {
    if (fields[k] !== undefined) {
      params.push(fields[k] || null);
      setClauses.push(`${col} = $${params.length}`);
    }
  }
  if (!setClauses.length) {
    throw new Error('No fields to counter-propose');
  }
  setClauses.push(`reschedule_count_influencer = reschedule_count_influencer + 1`);
  setClauses.push(`status = 'proposed'`);
  setClauses.push(`updated_at = NOW()`);
  params.push(eventId);

  const { rows } = await db.query(
    `UPDATE production_events SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'counter_proposed', notes || null, fields);
  return rows[0];
}

// Brand dispatches the shipment — provides courier + AWB. confirmed → in_progress.
async function dispatchShipment(eventId, { courier, awb, expected_at, notes }, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.mode !== 'shipment') throw new Error('WRONG_MODE');
  if (event.status !== 'confirmed') {
    throw new Error(`Cannot dispatch in status "${event.status}". Influencer must confirm address first.`);
  }
  if (actor.role !== 'brand') throw new Error('Only brand can mark dispatched');

  const { rows } = await db.query(
    `UPDATE production_events
     SET shipment_courier = $2,
         shipment_awb = $3,
         shipment_expected_at = $4,
         shipment_notes = COALESCE($5, shipment_notes),
         shipment_dispatched_at = NOW(),
         status = 'in_progress',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [eventId, courier || null, awb || null, expected_at || null, notes || null]
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'dispatched', notes || null, { courier, awb });
  return rows[0];
}

// Influencer confirms package received. in_progress → completed.
async function confirmReceived(eventId, notes, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.mode !== 'shipment') throw new Error('WRONG_MODE');
  if (event.status !== 'in_progress') {
    throw new Error(`Cannot confirm receipt in status "${event.status}"`);
  }
  if (actor.role !== 'influencer') throw new Error('Only influencer can confirm receipt');

  const { rows } = await db.query(
    `UPDATE production_events
     SET shipment_received_confirmed_at = NOW(),
         shipment_delivered_at = COALESCE(shipment_delivered_at, NOW()),
         status = 'completed',
         shipment_notes = COALESCE($2, shipment_notes),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [eventId, notes || null]
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'received', notes || null, null);
  return rows[0];
}

// Mark visit done. Either party may call. confirmed → completed.
async function completeVisit(eventId, notes, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.mode !== 'visit') throw new Error('WRONG_MODE');
  if (!['confirmed', 'in_progress'].includes(event.status)) {
    throw new Error(`Cannot complete visit in status "${event.status}"`);
  }

  const { rows } = await db.query(
    `UPDATE production_events
     SET visit_completed_at = NOW(),
         status = 'completed',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [eventId]
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'completed', notes || null, null);
  return rows[0];
}

// Admin cancels with a reason.
async function cancel(eventId, reason, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.status === 'completed') throw new Error('Already completed');

  const { rows } = await db.query(
    `UPDATE production_events
     SET status = 'cancelled',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [eventId]
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'cancelled', reason || null, null);
  return rows[0];
}

// ─── Internals ──────────────────────────────────────────────────────────────

async function logAction(client, eventId, userId, role, action, notes, metadata) {
  const exec = client || db;
  await exec.query(
    `INSERT INTO production_event_log
       (production_event_id, actor_user_id, actor_role, action, notes, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [eventId, userId || null, role || 'system', action, notes || null,
     metadata ? JSON.stringify(metadata) : null]
  );
}

module.exports = {
  VALID_MODES,
  VALID_STATUSES,
  RESCHEDULE_LIMIT_PER_SIDE,
  autoCreateForContract,
  getByContractId,
  getById,
  getLog,
  setVisitDetails,
  accept,
  counterPropose,
  dispatchShipment,
  confirmReceived,
  completeVisit,
  cancel,
};
