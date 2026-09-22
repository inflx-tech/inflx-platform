'use strict';

/**
 * production.service.js
 *
 * State transitions + audit logging for production_events. Pure DB layer —
 * controllers handle auth, request shape, and notifications. Keep transitions
 * here so the rules are in one place.
 */

const db = require('../config/db');
// stage-4 — who may say a shoot is done, and what is in a parcel. One place, so an
// endpoint and a screen cannot answer the question differently.
const parcel = require('./parcel.service');
// collab-phase0 — the shoot already recorded everything in production_event_log; it
// now MIRRORS into the shared diary so one screen can show any step's history.
// The existing log stays: it is load-bearing for the admin production queue.
const events = require('./collabEvents.service');

const VALID_MODES = ['visit', 'shipment', 'remote'];
// Which shoot, and what state it starts in — one place, so no caller invents a third answer.
// Contract: features/shoot-starts-where-the-agreement-left-it
const { resolveProductionMode, initialStatusFor } = require('./productionMode.model');
// Item 10 — may this collaboration reach the shoot at all? One definition, asked at birth.
const shootGate = require('./shootGate.service');
// Calendar days, in India, without losing one. Contract: features/dates-stop-losing-a-day
const { calendarDay, todayInIndia, addDays, daysBetween, startOfIndiaDay, endOfIndiaDay } =
  require('../utils/indiaDay');
const VALID_STATUSES = ['proposed', 'confirmed', 'in_progress', 'completed', 'cancelled'];

const RESCHEDULE_LIMIT_PER_SIDE = 2;
// Founder, 2026-08-30, approving the drop from 2 days to 1: with a 7-day minimum on a set and
// invitations closing 3 days before the post, a 2-day buffer left no day at all for the visit.
const PRE_VISIT_BUFFER_DAYS_AGAINST_POSTING = 1;   // the visit must finish a day before she posts
const PRE_VISIT_BUFFER_DAYS_AGAINST_WINDOW  = 3;   // …or ≥ 3 days before content_end_date / campaign.end_date

/**
 * The window a store visit must fall inside, as CALENDAR DAYS.
 *
 * Used by the brand's setVisitDetails and the creator's proposeSlot so the two cannot
 * disagree about what is bookable.
 *
 * ⚠️ THIS USED TO LOSE A DAY, ON EVERY CAMPAIGN.
 *
 * posting_date is a DATE column — a calendar day. The driver hands it over as a Date built at
 * local midnight, which in India is 6:30pm UTC the day before. The old code then subtracted
 * days in UTC:
 *
 *     stored 30 Aug  →  received 29 Aug 18:30Z  →  minus 2 days in UTC  →  27 Aug
 *                                                        intended:         28 Aug
 *
 * Every window in the system was a day short, silently. It is calendar arithmetic now, on
 * calendar days, through utils/indiaDay — no instants, no timezone.
 * Contract: features/dates-stop-losing-a-day
 *
 * @returns {{earliest: string, latest: string, basis: string, impossible: boolean, reason: string|null}}
 *          earliest and latest are 'YYYY-MM-DD' — the days themselves, not moments in them.
 */
async function getVisitDateRange(contractId) {
  const { rows } = await db.query(
    `SELECT con.posting_date,
            cs.go_live_date,
            cs.content_end_date,
            cs.window_end,
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

  // Item 10 (rules v1.24 §11.1): TODAY in India, not tomorrow — there is no minimum notice
  // (founder Q10); only the past is refused, and that is judged on the instant, not the day.
  const earliest = todayInIndia();

  // Latest: work back from whichever deadline this collaboration actually has.
  let latest, basis;
  if (r.go_live_date) {
    // Item 10: the set's posting day itself, inclusive. "No time later than the Set's Posting
    // Date is offered" — the day she posts is the last day she can shoot, not the day before.
    basis = 'posting_date';
    latest = calendarDay(r.go_live_date);
  } else if (r.posting_date) {
    basis = 'post_by';
    latest = addDays(calendarDay(r.posting_date), -PRE_VISIT_BUFFER_DAYS_AGAINST_POSTING);
  } else if (r.window_end || r.content_end_date) {
    // window_end is what the wizard actually writes. content_end_date has never been written
    // by either app, so reading it alone made this branch dead code — the window silently fell
    // through to the campaign end or to the open-ended ceiling.
    basis = 'posting_window';
    latest = addDays(calendarDay(r.window_end || r.content_end_date), -PRE_VISIT_BUFFER_DAYS_AGAINST_WINDOW);
  } else if (r.campaign_end_date) {
    basis = 'campaign_end';
    latest = addDays(calendarDay(r.campaign_end_date), -PRE_VISIT_BUFFER_DAYS_AGAINST_WINDOW);
  } else {
    // No posting date, no window, no campaign end. Since collab-part5 that is a REAL state,
    // not a defensive branch: a sales campaign runs open-ended by design. A year out is the
    // deliberate ceiling — far enough not to obstruct, near enough to stay sane.
    basis = 'open_ended';
    latest = addDays(todayInIndia(), 365);
  }

  // ⚠️ THE WINDOW CAN BE EMPTY, AND IT IS ON REAL DATA. If the post is due in two days, a
  // visit that must finish before it has nowhere to go. Returned as an ordinary range, the
  // screens drew "pick any day between [blank] and [blank]" and nobody could book. A rule that
  // cannot be satisfied has to announce itself — the fix is a person moving the posting date.
  // Contract: features/shoot-plan-you-can-actually-see
  const impossible = daysBetween(earliest, latest) < 0;

  return {
    earliest,
    latest,
    basis,
    impossible,
    // Said in the words of the people involved, not of the rule.
    reason: impossible
      ? (basis === 'post_by'
          ? 'There is no day that works. The post is due too soon for a visit to fit before it — '
            + `a visit has to finish ${PRE_VISIT_BUFFER_DAYS_AGAINST_POSTING} day` +
            `${PRE_VISIT_BUFFER_DAYS_AGAINST_POSTING === 1 ? '' : 's'} before the posting date. ` +
            'Move the posting date back and the days will appear.'
          : 'There is no day that works. The campaign ends too soon for a visit to fit before it. '
            + 'Extend the campaign and the days will appear.')
      : null,
  };
}

/**
 * Is this proposed instant inside the window?
 *
 * The window is calendar days; a slot is an instant. So the comparison runs against the first
 * and last moments of those days IN INDIA — not UTC, or a visit booked for 9am on the last
 * allowed day would be refused for being 3:30am UTC on the day after.
 */
function isWithinRange(iso, range) {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const from = startOfIndiaDay(range.earliest);
  const to   = endOfIndiaDay(range.latest);
  if (!from || !to) return false;
  return t >= from.getTime() && t <= to.getTime();
}

/**
 * The working style the two of them settled at the handshake.
 * Returns null for a campaign built without a prior agreement, which is normal.
 * Contract: features/shoot-starts-where-the-agreement-left-it
 */
async function agreementModeFor(client, contractId) {
  const q = (client && client.query) ? client : db;
  const { rows } = await q.query(
    `SELECT ag.terms_json->>'mode' AS mode
       FROM contracts con
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       LEFT JOIN collab_agreements ag ON ag.id = ci.agreement_id
      WHERE con.id = $1`,
    [contractId]
  );
  return rows[0] ? rows[0].mode : null;
}

// ─── Auto-create at contract activation ─────────────────────────────────────
//
// Called from contract.controller.brandSign once the contract row goes to
// 'active'. Picks the mode from contracts.production_mode and pre-fills
// shipment address from the campaign_influencer's delivery_address (which
// the influencer set during onboarding) if available.
async function autoCreateForContract(client, contract, agreementMode) {
  // Skip duplicate creation if a row already exists (e.g. retried brand-sign).
  const existing = await client.query(
    `SELECT id FROM production_events WHERE contract_id = $1`,
    [contract.id]
  );
  if (existing.rows[0]) return existing.rows[0];

  // Item 10 — THE GATE, asked by the thing that creates the row, not only by the doors that
  // read it. Signed by both, and for Pay for Content and Hybrid funded with the first 25% out
  // (rules §10). Asked on the caller's connection so the countersign transaction sees its own
  // escrow rows. No future caller can create an ungated shoot through here.
  // Contract: features/item10-store-visit
  const gate = await shootGate.assertShootOpenForCollab(contract.campaign_influencer_id, client);

  // Item 10: THE SET COMES FIRST. campaign_sets.shoot_mode is the mode of work the two of them
  // agreed, locked when the first invitation went out (rules §28). The two older sources —
  // contracts.production_mode from Approve & Send, and the handshake agreement's mode — are not
  // written on the set-first path, so reading only them invented a 'remote' shoot on every
  // set-first collaboration in production, including the only Store Visit.
  // Contracts: features/item10-store-visit · features/shoot-starts-where-the-agreement-left-it
  const resolved = resolveProductionMode({
    setMode:       gate.shootMode,
    contractMode:  contract.production_mode,
    agreementMode: agreementMode !== undefined ? agreementMode : await agreementModeFor(client, contract.id),
  });
  const mode = resolved.mode;
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Invalid production_mode "${mode}" on contract ${contract.id}`);
  }

  // NOTHING starts completed. This used to read `mode === 'remote' ? 'completed' : 'proposed'`
  // on the reasoning that remote has "nothing to coordinate". There is nothing to COORDINATE —
  // no slot, no parcel. There is still a shoot to DO, and a person says when it is done: both
  // sides for a store visit, the creator for a remote shoot.
  const initialStatus = initialStatusFor(mode);

  // Item 11, finding 2 — THE PREFILL IS GONE.
  //
  // A block here used to read `campaign_influencers.delivery_address` plus `users.city/state`
  // and copy them into shipment_to_* AT THE BRAND'S SIGNATURE — that is, a creator address
  // written onto the shoot row before she had sent anything, and then handed out by
  // getProduction and listCampaignProduction, both of which returned it unfiltered.
  //
  // §11.2 is explicit about the order: "The Creator starts it. Until she does, the Brand sees
  // that it is waiting for her address and has nothing to do." The address arrives when SHE
  // sends it at the shoot plan, is checked against the courier network at that moment, and
  // locks (§28). Guessing it from a legacy free-text column inverts the whole item.
  //
  // Item 10 had already disarmed half of this (it selected `u.pincode`, which does not exist,
  // so the branch threw the moment the mode resolver started producing real shipments). The
  // other half goes now. The columns and their data stay where they are.
  const shipFields = {};

  const { rows: created } = await client.query(
    `INSERT INTO production_events
       (contract_id, mode, status,
        shipment_to_address_line, shipment_to_pincode, shipment_to_city, shipment_to_state,
        branch_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      contract.id, mode, initialStatus,
      shipFields.shipment_to_address_line || null,
      shipFields.shipment_to_pincode || null,
      shipFields.shipment_to_city || null,
      shipFields.shipment_to_state || null,
      // Item 10: the set's branch rides with the row from birth. The ADDRESS is not copied
      // here — it is snapshotted when the plan is sent, which is when she may see it.
      mode === 'visit' ? gate.branchId : null,
    ]
  );
  const event = created[0];

  await logAction(client, event.id, null, 'system', 'mode_set', `Mode set to ${mode} (from the ${resolved.source})`, { mode, source: resolved.source });
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
     -- Item 11: (created_at, seq). created_at DEFAULT now() is the TRANSACTION timestamp, so
     -- two rows written together are indistinguishable by it and the order came out at random.
     -- migration 191 adds the bigserial that settles it.
     ORDER  BY created_at ASC, seq ASC`,
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
    // Agreeing to switch to remote settles WHERE she shoots. It does not shoot it for her.
    // This wrote status='completed' too — a SECOND place asserting that remote means finished,
    // which is how one wrong idea survives being fixed in the other place.
    const { rows } = await client.query(
      `UPDATE production_events
          SET mode = 'remote',
              status = $2,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [eventId, initialStatusFor('remote')]
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

  // stage-4 — RECEIVING IS NOT SHOOTING. This used to set status='completed', so a courier
  // handing over a box finished her shoot and pushed her collaboration to step 4 before she
  // had photographed anything — on BOTH phones, agreeing on a number that was wrong.
  //
  // It now moves to in_progress. The shoot finishes when someone says the SHOOTING is done,
  // and who may say that depends on the mode — see complete() below.
  // Founder, 2026-08-27. Contract: features/stage-4-the-shoot
  const { rows } = await db.query(
    `UPDATE production_events
     SET shipment_received_confirmed_at = NOW(),
         shipment_delivered_at = COALESCE(shipment_delivered_at, NOW()),
         status = 'in_progress',
         shipment_notes = COALESCE($2, shipment_notes),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [eventId, notes || null]
  );
  await logAction(null, eventId, actor.user_id, actor.role, 'received', notes || null, null);
  return rows[0];
}

/**
 * Mark the SHOOTING done. stage-4 — this used to be visit-only, so a remote shoot had no way
 * to be finished at all: its only completion path was confirmReceived, which conflated the
 * box arriving with the photographs being taken.
 *
 * WHO MAY CALL IT DEPENDS ON THE MODE (founder, 2026-08-27):
 *   store visit        — EITHER party. The brand was there; they know it happened.
 *   remote / shipment  — THE CREATOR ALONE. The brand cannot see whether she has shot
 *                        anything, so letting them close it would be letting them assert
 *                        something they cannot know.
 *
 * The real evidence is Stage 5's content submission. This is a marker, not proof — which is
 * exactly why it is safe for her to give it alone on a remote shoot.
 *
 * The rule lives in parcel.service.canComplete so an endpoint and a screen read one answer.
 */
async function completeShoot(eventId, notes, actor) {
  const event = await getById(eventId);
  if (!event) throw new Error('NOT_FOUND');
  if (!['confirmed', 'in_progress'].includes(event.status)) {
    throw new Error(`Cannot complete a shoot in status "${event.status}"`);
  }
  if (!parcel.canComplete(event.mode, actor.role)) {
    throw new Error(
      event.mode === 'visit'
        ? 'Only the brand or the creator can mark this visit done'
        : 'Only the creator can say the shoot is done — you cannot see whether it has happened'
    );
  }

  // Idempotent: tapping twice is not an error, it just does not un-mark anything. Checked
  // AFTER permission, so an unauthorised caller is told they may not, rather than being
  // quietly handed the row.
  const already = actor.role === 'brand' ? event.brand_completed_at : event.influencer_completed_at;
  if (already) return event;

  // Record THIS side's mark. On a store visit that is half the answer; on remote and
  // shipment the creator's mark is the whole of it.
  //
  // This used to set status='completed' unconditionally, so whoever tapped first closed the
  // shoot for both of them. Contract: features/shoot-starts-where-the-agreement-left-it
  // Two literals chosen by a ternary — never a value off the request. Interpolated because a
  // column name cannot be a bound parameter.
  const col = actor.role === 'brand' ? 'brand_completed_at' : 'influencer_completed_at';
  const { rows: marked } = await db.query(
    `UPDATE production_events
        SET ${col} = COALESCE(${col}, NOW()),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [eventId]
  );
  await logAction(null, eventId, actor.user_id, actor.role,
    parcel.isShootComplete(event.mode, marked[0]) ? 'completed' : 'complete_marked',
    notes || null, null);

  if (!parcel.isShootComplete(event.mode, marked[0])) {
    // Waiting on the other side. The caller reads who has marked off the row itself, so no
    // second flag is invented to say the same thing twice.
    return marked[0];
  }

  const { rows } = await db.query(
    `UPDATE production_events
        SET visit_completed_at = COALESCE(visit_completed_at, NOW()),
            status = 'completed',
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [eventId]
  );
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
  // Mirror into the shared diary. Resolve the collaboration this shoot belongs to;
  // if that lookup fails the shoot's own log below still happens, which is the point
  // of keeping both.
  try {
    const { rows } = await exec.query(
      `SELECT c.campaign_influencer_id
         FROM production_events pe
         JOIN contracts c ON c.id = pe.contract_id
        WHERE pe.id = $1`, [eventId]);
    if (rows[0]) {
      await events.record({
        campaignInfluencerId: rows[0].campaign_influencer_id,
        step: events.STEP.SHOOT,
        actorRole: role === 'influencer' ? 'creator' : (role || 'system'),
        actorUserId: userId || null,
        action,
        note: notes || null,
        meta: metadata || {},
      }, exec);
    }
  } catch (e) {
    console.warn('[production] diary mirror failed (non-fatal):', e.message);
  }
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
  agreementModeFor,
  getByContractId,
  getById,
  // stage-4 — the parcel endpoints write to the SAME diary. B-8: every new action is
  // recorded. A second log for the parcel would be two things doing one job, and the
  // shoot is the only step in the whole spine that has a diary worth keeping whole.
  logAction,
  getLog,
  getVisitDateRange,
  setVisitDetails,
  proposeSlot,
  accept,
  counterPropose,
  dispatchShipment,
  confirmReceived,
  completeShoot,
  // Kept pointing at the same function: brandApi and the contract screens still call it,
  // and renaming a live export to make a diff tidy is how a caller quietly breaks.
  completeVisit: completeShoot,
  cancel,
  requestRemoteFlip,
  confirmRemoteFlip,
};
