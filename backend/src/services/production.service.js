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
const PRE_VISIT_BUFFER_DAYS_AGAINST_POSTING = 2;   // visit must end ≥ 2 days before posting_date
const PRE_VISIT_BUFFER_DAYS_AGAINST_WINDOW  = 3;   // …or ≥ 3 days before content_end_date / campaign.end_date

// Resolve the [earliest, latest] window the visit must fall inside for the
// given contract. Used by both brand setVisitDetails and influencer
// proposeSlot so they agree on the constraint. Returns ISO strings.
async function getVisitDateRange(contractId) {
  const { rows } = await db.query(
    `SELECT con.posting_date,
            cs.content_end_date,
            c.end_date AS campaign_end_date
       FROM contracts con
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       JOIN campaign_sets cs        ON cs.id = ci.set_id
       JOIN campaigns c             ON c.id  = cs.campaign_id
      WHERE con.id = $1`,
    [contractId]
  );
  const r = rows[0];
  if (!r) throw new Error('Contract not found for visit date range');

  // Minimum: tomorrow (gives the receiving side a day to prep / commute).
  const earliest = new Date();
  earliest.setUTCDate(earliest.getUTCDate() + 1);
  earliest.setUTCHours(0, 0, 0, 0);

  // Latest: posting_date − 2d if set, else content_end_date − 3d, else
  // campaign.end_date − 3d. Visit has to leave enough room for the
  // influencer to shoot + edit + post.
  let latest;
  if (r.posting_date) {
    latest = new Date(r.posting_date);
    latest.setUTCDate(latest.getUTCDate() - PRE_VISIT_BUFFER_DAYS_AGAINST_POSTING);
  } else if (r.content_end_date) {
    latest = new Date(r.content_end_date);
    latest.setUTCDate(latest.getUTCDate() - PRE_VISIT_BUFFER_DAYS_AGAINST_WINDOW);
  } else if (r.campaign_end_date) {
    latest = new Date(r.campaign_end_date);
    latest.setUTCDate(latest.getUTCDate() - PRE_VISIT_BUFFER_DAYS_AGAINST_WINDOW);
  } else {
    // Should never happen — campaign always has an end_date — but be safe.
    latest = new Date();
    latest.setUTCFullYear(latest.getUTCFullYear() + 1);
  }
  latest.setUTCHours(23, 59, 59, 999);

  return { earliest: earliest.toISOString(), latest: latest.toISOString() };
}

function isWithinRange(iso, range) {
  if (!iso) return true;
  const d = new Date(iso).getTime();
  return d >= new Date(range.earliest).getTime() && d <= new Date(range.latest).getTime();
}

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

// Brand fills in visit details. Location-only (address + contact + window) is
// supported now — date/time are optional. If brand provides visit_scheduled_at,
// it counts as a brand-proposed slot (slot_proposed_by='brand'); if they
// don't, the influencer fills the slot in the next step via proposeSlot().
//
// Date validation enforces "visit must finish before posting_date − 2d" (or
// content_end_date − 3d fallback) so the influencer has shoot/edit/post
// runway. See getVisitDateRange() for the exact window.
async function setVisitDetails(eventId, fields, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.mode !== 'visit') throw new Error('WRONG_MODE');
  if (!['proposed', 'confirmed'].includes(event.status)) {
    throw new Error(`Cannot edit visit details in status "${event.status}"`);
  }

  // Validate date range if brand actually proposed one. Skip when omitted.
  if (fields.visit_scheduled_at) {
    const range = await getVisitDateRange(event.contract_id);
    if (!isWithinRange(fields.visit_scheduled_at, range)) {
      const err = new Error('VISIT_DATE_OUT_OF_RANGE');
      err.range = range;
      throw err;
    }
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

  // Record who proposed the slot when brand sets one. If brand only updates
  // location fields (no scheduled_at), leave slot_proposed_by untouched.
  if (fields.visit_scheduled_at) {
    setClauses.push(`slot_proposed_by = 'brand'`);
  }

  // Brand changing details on a confirmed event = reschedule by brand.
  let action = 'visit_details_set';
  if (event.status === 'confirmed') {
    if (event.reschedule_count_brand >= RESCHEDULE_LIMIT_PER_SIDE) {
      throw new Error('RESCHEDULE_LIMIT_REACHED');
    }
    setClauses.push(`reschedule_count_brand = reschedule_count_brand + 1`);
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

// Influencer picks an availability slot for a visit. First proposal from the
// influencer's side after brand has set the location. Does NOT count as a
// reschedule — it's the first slot, not a counter. Subsequent influencer
// changes go through counterPropose.
async function proposeSlot(eventId, fields, actor, notes) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.mode !== 'visit') throw new Error('WRONG_MODE');
  if (actor.role !== 'influencer') throw new Error('Only influencer can propose a slot');
  if (event.status !== 'proposed') {
    throw new Error(`Cannot propose slot in status "${event.status}"`);
  }
  if (!fields.visit_scheduled_at) throw new Error('visit_scheduled_at is required');

  const range = await getVisitDateRange(event.contract_id);
  if (!isWithinRange(fields.visit_scheduled_at, range)) {
    const err = new Error('VISIT_DATE_OUT_OF_RANGE');
    err.range = range;
    throw err;
  }

  // If influencer is proposing AGAIN (slot already set by them previously),
  // count as a reschedule.
  const isReschedule = event.slot_proposed_by === 'influencer' && event.visit_scheduled_at;
  if (isReschedule && event.reschedule_count_influencer >= RESCHEDULE_LIMIT_PER_SIDE) {
    throw new Error('RESCHEDULE_LIMIT_REACHED');
  }

  const setClauses = [
    `visit_scheduled_at = $1`,
    `visit_window_minutes = COALESCE($2, visit_window_minutes)`,
    `slot_proposed_by = 'influencer'`,
    `status = 'proposed'`,
    `updated_at = NOW()`,
  ];
  if (isReschedule) setClauses.push(`reschedule_count_influencer = reschedule_count_influencer + 1`);

  const { rows } = await db.query(
    `UPDATE production_events SET ${setClauses.join(', ')}
     WHERE id = $3
     RETURNING *`,
    [fields.visit_scheduled_at, fields.visit_window_minutes || null, eventId]
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'slot_proposed', notes || null, fields);
  return rows[0];
}

// Mutual remote flip — either party requests, the other party confirms. On
// confirm: production_mode on contract → 'remote', event auto-completes.
async function requestRemoteFlip(eventId, actor, notes) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.mode === 'remote') throw new Error('ALREADY_REMOTE');
  if (event.status === 'completed') throw new Error('Already completed');

  if (event.remote_flip_requested_by && event.remote_flip_requested_by !== actor.role) {
    // The OTHER side already requested — this call is the confirmation.
    return confirmRemoteFlip(eventId, actor, notes);
  }
  if (event.remote_flip_requested_by === actor.role) {
    return event; // idempotent — already requested by this side
  }
  const { rows } = await db.query(
    `UPDATE production_events
        SET remote_flip_requested_by = $1,
            remote_flip_requested_at = NOW(),
            updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
    [actor.role, eventId]
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'remote_flip_requested', notes || null, null);
  return rows[0];
}

async function confirmRemoteFlip(eventId, actor, notes) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (!event.remote_flip_requested_by) throw new Error('No pending remote flip request');
  if (event.remote_flip_requested_by === actor.role) throw new Error('Cannot confirm your own request');

  // Two-step: flip the contract's production_mode to 'remote' AND auto-complete
  // the event. Both inside one transaction.
  const client = await require('../config/db').pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE contracts SET production_mode = 'remote' WHERE id = $1`,
      [event.contract_id]
    );
    const { rows } = await client.query(
      `UPDATE production_events
          SET mode = 'remote',
              status = 'completed',
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [eventId]
    );
    await client.query('COMMIT');
    await logAction(null, eventId, actor.user_id, actor.role, 'remote_flip_confirmed', notes || null, null);
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Accept the OTHER side's slot proposal (visit) or address (shipment).
// Either side may call; the rule is: you can't accept your own proposal.
// For shipment: only influencer accepts (it's their delivery address).
async function accept(eventId, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (event.status !== 'proposed') {
    throw new Error(`Cannot accept event in status "${event.status}"`);
  }

  if (event.mode === 'shipment') {
    if (actor.role !== 'influencer') throw new Error('Only influencer confirms shipment address');
  } else if (event.mode === 'visit') {
    if (!event.slot_proposed_by) {
      throw new Error('No slot has been proposed yet — fill the slot first');
    }
    if (event.slot_proposed_by === actor.role) {
      throw new Error("You can't accept your own proposal — wait for the other side.");
    }
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

// Counter-propose a different slot (visit) or address (shipment). Either
// party may counter. Increments that side's reschedule counter; capped at 2.
async function counterPropose(eventId, fields, actor, notes) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (!['proposed', 'confirmed'].includes(event.status)) {
    throw new Error(`Cannot counter-propose on status "${event.status}"`);
  }
  // Shipment counter is influencer-only (address belongs to them).
  if (event.mode === 'shipment' && actor.role !== 'influencer') {
    throw new Error('Only influencer can counter shipment address');
  }
  // Visit counter requires there to be a slot to counter against.
  if (event.mode === 'visit' && !event.slot_proposed_by) {
    throw new Error('Nothing to counter — pick a slot first');
  }
  // Can't counter your own proposal — counter only makes sense against the other side.
  if (event.mode === 'visit' && event.slot_proposed_by === actor.role) {
    throw new Error("You can't counter your own proposal — let the other side respond.");
  }

  const countCol = actor.role === 'brand' ? 'reschedule_count_brand' : 'reschedule_count_influencer';
  if (event[countCol] >= RESCHEDULE_LIMIT_PER_SIDE) {
    throw new Error('RESCHEDULE_LIMIT_REACHED');
  }

  // Date validation when countering a visit time.
  if (event.mode === 'visit' && fields.visit_scheduled_at) {
    const range = await getVisitDateRange(event.contract_id);
    if (!isWithinRange(fields.visit_scheduled_at, range)) {
      const err = new Error('VISIT_DATE_OUT_OF_RANGE');
      err.range = range;
      throw err;
    }
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
  setClauses.push(`${countCol} = ${countCol} + 1`);
  if (event.mode === 'visit') setClauses.push(`slot_proposed_by = '${actor.role}'`);
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
  getVisitDateRange,
  setVisitDetails,
  proposeSlot,
  accept,
  counterPropose,
  dispatchShipment,
  confirmReceived,
  completeVisit,
  cancel,
  requestRemoteFlip,
  confirmRemoteFlip,
};
