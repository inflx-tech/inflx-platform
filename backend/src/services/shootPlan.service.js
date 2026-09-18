'use strict';

/**
 * shootPlan.service.js — the Store Visit shoot plan (item 10).
 * Contract: features/item10-store-visit · rules v1.24 §11.1 (with §10, §24, §25, §28)
 *
 * The brand plans a visit — a time, a person to ask for, and the street address the creator
 * has never seen. She accepts it or asks for another time (item 6's engine, third anchor). She
 * marks that she attended; the brand confirms, or it confirms itself. Past the posting date the
 * collaboration is flagged Delayed and nothing else moves.
 *
 * NOTHING HERE LOCKS, RELEASES OR REFUNDS MONEY. That sentence is what makes the auto-confirm
 * safe, and it is tested by snapshotting every balance and ledger before and after a whole shoot.
 *
 * The stage is DERIVED from the timestamps (like item 4's set states), never stored twice:
 *   not_sent → sent → agreed → attended → complete, with Delayed as a flag on top.
 * `production_events.status` is still written ('proposed' / 'confirmed' / 'completed') for the
 * readers that predate this item.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const shootGate = require('./shootGate.service');
const negotiation = require('./negotiation.service');
const platformSettings = require('./platformSettings.service');
const notificationService = require('./notification.service');
const { MSG, NOTIFY, STAGE_LABEL, DELAYED_STAGE_LABEL, whenLine, shortDay } = require('./productionCopy');
const { longDate } = require('./campaignCopy');
const { calendarDay, todayInIndia, istDayOf, daysBetween, startOfIndiaDay, endOfIndiaDay } = require('../utils/indiaDay');
const { logAction } = require('./production.service');

/* ───────────────────────────────────────────────────────────── loading */

const SELECT = `
  SELECT ci.id AS ci_id, ci.influencer_id, ci.status AS ci_status, ci.delayed_at, ci.delayed_stage,
         cs.id AS set_id, cs.name AS set_name, cs.goal, cs.shoot_mode AS set_mode, cs.go_live_date, cs.branch_id AS set_branch_id,
         c.id AS campaign_id, c.name AS campaign_name, c.brand_id,
         b.business_name AS brand_name, bu.id AS brand_user_id, bu.phone AS brand_phone,
         COALESCE(i.full_name, u.name) AS creator_name, u.id AS creator_user_id,
         con.id AS contract_id, con.brand_signed_at, con.influencer_signed_at, con.locked_amount, con.released_amount,
         pe.*,
         bb.name AS branch_name_now, bb.formatted_address AS branch_address_now, bb.lat AS branch_lat_now, bb.lng AS branch_lng_now,
         bb.pincode AS branch_pincode_now, rc.name AS branch_city_now, rs.name AS branch_state_now,
         n.id AS neg_id, n.current_turn AS neg_turn, n.outcome AS neg_outcome, n.turn_changed_at AS neg_turn_changed_at,
         n.reminder_48h_sent_at AS neg_reminded_at
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = c.brand_id JOIN users bu ON bu.id = b.user_id
    JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
    LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
    LEFT JOIN production_events pe ON pe.contract_id = con.id
    LEFT JOIN brand_branches bb ON bb.id = COALESCE(pe.branch_id, cs.branch_id)
    LEFT JOIN ref_cities rc ON rc.id = bb.city_id
    LEFT JOIN ref_states rs ON rs.id = bb.state_id
    LEFT JOIN negotiations n ON n.production_event_id = pe.id`;

/**
 * The collaboration as the shoot sees it, scoped to the caller. `side` is 'brand' | 'creator'.
 * A brand asking through a set it does not own, or a creator asking about someone else's
 * collaboration, gets null → 404 — never 403, which would confirm the row exists.
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

/** Everything the shoot needs is signed and funded, and it is a store visit. */
async function assertOpenVisit(r, conn = db) {
  const gate = await shootGate.shootGate(r.ci_id, conn);
  if (!gate) throw new AppError('NOT_FOUND', 'Not found', 404);
  if (!gate.signed.at) throw new AppError('NOT_SIGNED', MSG.NOT_SIGNED, 422, 'status');
  if (!gate.open) throw new AppError('NOT_FUNDED', MSG.NOT_FUNDED, 422, 'status');
  if (r.mode && r.mode !== 'visit') throw new AppError('WRONG_MODE', MSG.WRONG_MODE(first(r.creator_name)), 422, 'mode');
  if (!r.id) throw new AppError('NOT_FOUND', 'No shoot plan for this collaboration', 404);
  return gate;
}

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'the creator';

/* ───────────────────────────────────────────────────────────── the stage */

/** not_sent · sent · agreed · attended · complete — from the timestamps, nowhere else. */
function stageOf(pe) {
  if (!pe || !pe.id) return 'not_sent';
  if (pe.status === 'completed' || pe.brand_completed_at || pe.auto_confirmed_at) return 'complete';
  if (pe.influencer_completed_at) return 'attended';
  if (pe.time_agreed_at) return 'agreed';
  if (pe.plan_sent_at) return 'sent';
  return 'not_sent';
}

/** The agreed time came and went with nothing marked (§11.1). Derived — no job notices it. */
function passedOf(pe, now = new Date()) {
  return stageOf(pe) === 'agreed' && !!pe.visit_scheduled_at && new Date(pe.visit_scheduled_at).getTime() < now.getTime();
}

/** Where a collaboration stopped, for the Delayed flag. */
function delayedStageOf(pe) {
  switch (stageOf(pe)) {
    case 'not_sent': return 'plan_not_sent';
    case 'sent':     return 'time_not_agreed';
    case 'agreed':   return 'not_attended';
    case 'attended': return 'not_confirmed';
    default:         return null;
  }
}

/* ───────────────────────────────────────────────────────────── validation */

const INDIAN_MOBILE = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
function normalisePhone(v) {
  const s = String(v || '').replace(/[\s-]/g, '');
  if (!INDIAN_MOBILE.test(String(v || '').trim())) return null;
  return s.startsWith('+91') ? s : `+91${s}`;
}

/** The time rule, shared with the engine: a real instant, in the future, on or before the posting day in India. */
function validateVisitAt(raw, goLiveDate) {
  const t = raw ? new Date(raw) : null;
  if (!t || Number.isNaN(t.getTime())) throw new AppError('VALIDATION_ERROR', MSG.TIME_REQUIRED, 422, 'visitAt');
  if (!goLiveDate) throw new AppError('NO_POSTING_DATE', MSG.NO_POSTING_DATE, 422, 'visitAt');
  if (t.getTime() <= Date.now()) throw new AppError('TIME_IN_PAST', MSG.TIME_IN_PAST, 422, 'visitAt');
  const day = calendarDay(goLiveDate);
  if (t.getTime() > endOfIndiaDay(day).getTime()) throw new AppError('TIME_AFTER_POSTING', MSG.TIME_AFTER_POSTING(day), 422, 'visitAt');
  return t;
}

/* ───────────────────────────────────────────────────────────── F1 — read */

async function read(ciId, { side, userId, campaignId = null, setId = null }) {
  const r = await loadOrThrow(ciId, { side, userId, campaignId, setId });
  const gate = await shootGate.shootGate(r.ci_id);
  const mode = r.mode || r.set_mode || null;
  const stage = stageOf(r);
  const sent = !!r.plan_sent_at;
  const now = new Date();
  const today = todayInIndia();
  const postingDay = r.go_live_date ? calendarDay(r.go_live_date) : null;
  const passed = passedOf(r, now);
  const visitDay = r.visit_scheduled_at ? istDayOf(r.visit_scheduled_at) : null;

  // The street address and the contact number reach the creator ONLY once the plan is sent.
  const revealed = side === 'brand' || sent;
  const plan = !r.id ? null : {
    branch: {
      name: r.visit_branch_name || r.branch_name_now || null,
      city: r.visit_city || r.branch_city_now || null,
      address: revealed ? (r.visit_address || null) : null,
      state: revealed ? (r.visit_state || null) : null,
      pincode: revealed ? (r.visit_pincode || null) : null,
      lat: revealed && r.visit_lat != null ? Number(r.visit_lat) : null,
      lng: revealed && r.visit_lng != null ? Number(r.visit_lng) : null,
      mapsUrl: revealed && r.visit_lat != null ? `https://www.google.com/maps/search/?api=1&query=${Number(r.visit_lat)},${Number(r.visit_lng)}` : null,
    },
    contact: revealed && (r.visit_contact_name || r.visit_contact_phone) ? { name: r.visit_contact_name || null, phone: r.visit_contact_phone || null } : null,
    visitAt: r.visit_scheduled_at ? new Date(r.visit_scheduled_at).toISOString() : null,
    visitWhen: r.visit_scheduled_at ? whenLine(r.visit_scheduled_at) : null,
    visitDay,
    isToday: visitDay === today,
    durationText: r.visit_duration_text || null,
    notes: revealed ? (r.visit_notes || null) : null,
    sentAt: r.plan_sent_at || null,
    agreedAt: r.time_agreed_at || null,
    attendedAt: r.influencer_completed_at || null,
    confirmedAt: r.brand_completed_at || null,
    autoConfirmedAt: r.auto_confirmed_at || null,
    autoConfirmDueAt: r.auto_confirm_due_at || null,
    autoConfirmDays: r.auto_confirm_days || null,
  };

  // The thread, through the engine, when there is one.
  let thread = null;
  if (r.id && sent) {
    const ctx = await negotiation.loadShootContext(r.id, side === 'brand' ? { brandId: r.brand_id } : { influencerId: r.influencer_id });
    if (ctx) thread = await negotiation.thread(ctx, side === 'brand' ? 'brand' : 'influencer');
  }
  const threadOpen = !!(thread && thread.negotiation && thread.negotiation.open);
  const myTurn = threadOpen && thread.negotiation.whoseMove === (side === 'brand' ? 'brand' : 'influencer');

  const can = {
    plan: side === 'brand' && gate.open && mode === 'visit' && !!r.id && !sent && !!r.go_live_date,
    send: side === 'brand' && gate.open && mode === 'visit' && !!r.id && !sent && !!r.go_live_date,
    accept: side === 'creator' && gate.open && stage === 'sent' && (!thread || !thread.negotiation.id || myTurn),
    counter: gate.open && stage === 'sent' && !!thread && !!thread.can && thread.can.counter,
    move: gate.open && !!thread && !!thread.can && thread.can.move,
    markAttended: side === 'creator' && gate.open && stage === 'agreed' && !!visitDay && daysBetween(visitDay, today) >= 0,
    confirm: side === 'brand' && gate.open && stage === 'attended',
  };

  const steps = [
    { key: 'signed',  label: 'Agreement signed', state: 'done', detail: r.brand_signed_at ? shortDay(r.brand_signed_at) : null },
    { key: 'shoot',   label: 'Shoot plan', state: stage === 'complete' ? 'done' : 'now',
      detail: stage === 'complete' ? `Visited ${shortDay(r.visit_scheduled_at || r.influencer_completed_at)}`
            : stage === 'attended' ? 'Waiting for your confirmation'
            : stage === 'agreed' ? (passed ? 'Time passed — send a new time' : `Visit ${shortDay(r.visit_scheduled_at)}`)
            : stage === 'sent' ? 'Time not agreed yet' : 'Send her a time' },
    { key: 'content', label: 'Content', state: stage === 'complete' ? 'now' : 'later', detail: stage === 'complete' ? (side === 'brand' ? `With ${first(r.creator_name)}` : 'Once they confirm') : 'After the shoot' },
    { key: 'live',    label: 'Live and paid', state: 'later', detail: postingDay ? `Posts ${shortDay(startOfIndiaDay(postingDay))}` : null },
  ];

  return {
    invitationId: r.ci_id, shootId: r.id || null, contractId: r.contract_id || null,
    gate: { open: gate.open, reason: gate.reason, signed: gate.signed, money: gate.money },
    aim: r.goal, mode, isVisit: mode === 'visit',
    campaignName: r.campaign_name, setName: r.set_name,
    brand: { name: r.brand_name }, creator: { name: r.creator_name },
    postingDate: postingDay, daysToPosting: postingDay ? daysBetween(today, postingDay) : null,
    stage, stageLabel: STAGE_LABEL[stage], passed,
    plan, thread,
    delayed: r.delayed_at ? { at: r.delayed_at, stage: r.delayed_stage, stageLabel: DELAYED_STAGE_LABEL[r.delayed_stage] || null } : null,
    can, steps,
    // The brand's own login number, prefilled into "their number" (Q11). Never sent to her.
    contactPrefill: side === 'brand' ? { name: null, phone: r.brand_phone || null } : undefined,
    branchNow: side === 'brand' ? { name: r.branch_name_now, address: r.branch_address_now, city: r.branch_city_now } : undefined,
    legacyNoPostingDate: !r.go_live_date,
  };
}

/* ───────────────────────────────────────────────────────────── F2+F3 — send */

/**
 * One call: validates the gate, the mode, the branch address, the time; snapshots the address;
 * stamps plan_sent_at; tells her. No server draft (Q5) — V2 lives in the phone until Send.
 */
async function send(ciId, { userId, campaignId = null, setId = null }, body = {}) {
  const r = await loadOrThrow(ciId, { side: 'brand', userId, campaignId, setId });
  const gate = await assertOpenVisit(r);
  if (r.plan_sent_at) throw new AppError('PLAN_ALREADY_SENT', MSG.PLAN_ALREADY_SENT(first(r.creator_name)), 422, 'status');
  if (!r.go_live_date) throw new AppError('NO_POSTING_DATE', MSG.NO_POSTING_DATE, 422, 'status');

  const contactName = String(body.contactName || '').trim();
  if (!contactName || contactName.length > 60) throw new AppError('VALIDATION_ERROR', MSG.CONTACT_NAME, 422, 'contactName');
  const contactPhone = normalisePhone(body.contactPhone);
  if (!contactPhone) throw new AppError('VALIDATION_ERROR', MSG.CONTACT_PHONE, 422, 'contactPhone');
  const visitAt = validateVisitAt(body.visitAt, r.go_live_date);
  const durationText = body.durationText == null ? null : String(body.durationText).trim().slice(0, 60) || null;
  const notes = body.notes == null ? null : String(body.notes).trim() || null;
  if (notes && notes.length > 500) throw new AppError('VALIDATION_ERROR', MSG.NOTES_LONG, 422, 'notes');

  // The branch — the set's, and it must be one she can be sent to (Q6, the safety net).
  const branchId = r.branch_id || r.set_branch_id;
  const { rows: [bb] } = await db.query(
    `SELECT bb.id, bb.name, bb.formatted_address, bb.pincode, bb.lat, bb.lng, rc.name AS city, rs.name AS state
       FROM brand_branches bb LEFT JOIN ref_cities rc ON rc.id = bb.city_id LEFT JOIN ref_states rs ON rs.id = bb.state_id
      WHERE bb.id = $1 AND bb.brand_id = $2`, [branchId, r.brand_id]);
  if (!bb) throw new AppError('BRANCH_NO_ADDRESS', MSG.BRANCH_NO_ADDRESS(r.branch_name_now || 'the branch'), 422, 'branch');
  if (!String(bb.formatted_address || '').trim()) throw new AppError('BRANCH_NO_ADDRESS', MSG.BRANCH_NO_ADDRESS(bb.name), 422, 'branch');

  // Sent exactly once: the WHERE makes a second send a no-op that we report as already sent.
  const { rowCount } = await db.query(
    `UPDATE production_events
        SET plan_sent_at = now(), plan_sent_by = $2,
            branch_id = $3, visit_branch_name = $4, visit_address = $5, visit_city = $6, visit_state = $7, visit_pincode = $8,
            visit_lat = $9, visit_lng = $10,
            visit_contact_name = $11, visit_contact_phone = $12, visit_scheduled_at = $13,
            visit_duration_text = $14, visit_notes = $15, status = 'proposed', updated_at = now()
      WHERE id = $1 AND plan_sent_at IS NULL`,
    [r.id, userId, bb.id, bb.name, bb.formatted_address, bb.city, bb.state, bb.pincode, bb.lat, bb.lng,
     contactName, contactPhone, visitAt.toISOString(), durationText, notes]);
  if (rowCount === 0) throw new AppError('PLAN_ALREADY_SENT', MSG.PLAN_ALREADY_SENT(first(r.creator_name)), 422, 'status');

  await logAction(db, r.id, userId, 'brand', 'plan_sent', `Plan sent for ${whenLine(visitAt)}`, { visitAt: visitAt.toISOString(), branchId: bb.id });
  await notifyCreator(r, NOTIFY.PLAN_SENT, `${r.brand_name} planned your store visit for ${whenLine(visitAt)} at ${bb.name}. Accept the time or ask for another.`);
  return read(ciId, { side: 'brand', userId, campaignId, setId });
}

/* ───────────────────────────────────────────────────────────── F4 — she accepts */

async function acceptTime(ciId, { userId }) {
  const r = await loadOrThrow(ciId, { side: 'creator', userId });
  await assertOpenVisit(r);
  if (!r.plan_sent_at) throw new AppError('VALIDATION_ERROR', 'No plan has been sent yet.', 422, 'status');
  if (stageOf(r) !== 'sent') throw new AppError('TIME_ALREADY_AGREED', MSG.TIME_ALREADY_AGREED, 422, 'status');
  const ctx = await negotiation.loadShootContext(r.id, { influencerId: r.influencer_id });
  if (ctx && ctx.neg_id && !ctx.outcome) {
    // A thread is open: accepting is the engine's, so the accept turn is recorded.
    await negotiation.accept({ ctx, by: 'influencer', actorUserId: userId });
  } else {
    const { rowCount } = await db.query(
      `UPDATE production_events SET time_agreed_at = now(), status = 'confirmed', updated_at = now()
        WHERE id = $1 AND time_agreed_at IS NULL AND plan_sent_at IS NOT NULL`, [r.id]);
    if (rowCount === 0) throw new AppError('TIME_ALREADY_AGREED', MSG.TIME_ALREADY_AGREED, 422, 'status');
    await notifyBrand(r, NOTIFY.TIME_AGREED, `${first(r.creator_name)} agreed ${whenLine(r.visit_scheduled_at)} for the store visit.`);
  }
  await logAction(db, r.id, userId, 'influencer', 'time_agreed', `Time agreed: ${whenLine(r.visit_scheduled_at)}`, null);
  return read(ciId, { side: 'creator', userId });
}

/* ───────────────────────────────────────────────────────────── F5 — the thread */

async function shootCtx(ciId, { side, userId, campaignId = null, setId = null }) {
  const r = await loadOrThrow(ciId, { side, userId, campaignId, setId });
  await assertOpenVisit(r);
  if (!r.plan_sent_at) throw new AppError('VALIDATION_ERROR', 'No plan has been sent yet.', 422, 'status');
  const ctx = await negotiation.loadShootContext(r.id, side === 'brand' ? { brandId: r.brand_id } : { influencerId: r.influencer_id });
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  return { r, ctx };
}

async function counterTime(ciId, scope, body = {}) {
  const { r, ctx } = await shootCtx(ciId, scope);
  const by = scope.side === 'brand' ? 'brand' : 'influencer';
  await negotiation.counter({ ctx, by, terms: { visitAt: body.visitAt }, note: body.note, actorUserId: scope.userId });
  await logAction(db, r.id, scope.userId, by, 'time_countered', `Asked for ${whenLine(body.visitAt)}`, { visitAt: body.visitAt });
  return read(ciId, scope);
}

async function acceptCounter(ciId, scope) {
  const { r, ctx } = await shootCtx(ciId, scope);
  const by = scope.side === 'brand' ? 'brand' : 'influencer';
  const out = await negotiation.accept({ ctx, by, actorUserId: scope.userId });
  await logAction(db, r.id, scope.userId, by, 'time_agreed', `Time agreed: ${whenLine(out.agreedTerms && out.agreedTerms.visitAt)}`, null);
  return read(ciId, scope);
}

/* ───────────────────────────────────────────────────────────── F6 — move */

/**
 * Either side moves an agreed time. The same thread reopens (engine, `reopen: true`). After she
 * has marked attended only the brand may move it, and doing so CLEARS her mark and the
 * auto-confirm clock (Q3) — logged as attended_cleared with the old values, so the sequence is
 * reconstructible. Refused once the shoot is complete.
 */
async function move(ciId, scope, body = {}) {
  const { r, ctx } = await shootCtx(ciId, scope);
  const by = scope.side === 'brand' ? 'brand' : 'influencer';
  if (stageOf(r) === 'complete') throw new AppError('SHOOT_COMPLETE', MSG.SHOOT_COMPLETE, 422, 'status');
  // Q3: after she has marked attended only the brand may move it (she said she went; the brand
  // says otherwise by sending a new time). Her own move is refused as already marked.
  if (stageOf(r) === 'attended' && by !== 'brand') throw new AppError('ALREADY_MARKED', MSG.ALREADY_MARKED, 422, 'status');
  if (stageOf(r) === 'sent') {
    // Nothing agreed yet — a "move" is a plain counter on the open plan.
    return counterTime(ciId, scope, body);
  }

  if (r.influencer_completed_at) {
    const { rowCount } = await db.query(
      `UPDATE production_events SET influencer_completed_at = NULL, auto_confirm_due_at = NULL, auto_confirm_days = NULL, updated_at = now()
        WHERE id = $1 AND influencer_completed_at IS NOT NULL AND brand_completed_at IS NULL AND auto_confirmed_at IS NULL`, [r.id]);
    if (rowCount === 0) throw new AppError('SHOOT_COMPLETE', MSG.SHOOT_COMPLETE, 422, 'status');
    await logAction(db, r.id, scope.userId, by, 'attended_cleared', 'The brand moved the visit after she marked it; her mark and the auto-confirm clock were cleared.',
      { influencer_completed_at: r.influencer_completed_at, auto_confirm_due_at: r.auto_confirm_due_at, auto_confirm_days: r.auto_confirm_days });
  }
  await negotiation.counter({ ctx, by, terms: { visitAt: body.visitAt }, note: body.note, actorUserId: scope.userId, reopen: true });
  await logAction(db, r.id, scope.userId, by, 'time_moved', `Asked to move the visit to ${whenLine(body.visitAt)}`, { visitAt: body.visitAt, from: r.visit_scheduled_at });
  return read(ciId, scope);
}

/* ───────────────────────────────────────────────────────────── F7 — she marks attended */

async function attended(ciId, { userId }) {
  const r = await loadOrThrow(ciId, { side: 'creator', userId });
  await assertOpenVisit(r);
  const stage = stageOf(r);
  if (stage === 'attended' || stage === 'complete') throw new AppError('ALREADY_MARKED', MSG.ALREADY_MARKED, 422, 'status');
  if (stage !== 'agreed') throw new AppError('TIME_NOT_AGREED', MSG.TIME_NOT_AGREED, 422, 'status');
  const visitDay = istDayOf(r.visit_scheduled_at);
  const today = todayInIndia();
  if (daysBetween(visitDay, today) < 0) throw new AppError('TOO_EARLY', MSG.TOO_EARLY(visitDay), 422, 'status');

  // The admin number, copied onto the row NOW and never re-read (rules §7B last paragraph).
  const days = Number(await platformSettings.get('shoot_auto_confirm_days'));
  const { rows } = await db.query(
    `UPDATE production_events
        SET influencer_completed_at = now(), auto_confirm_days = $2::int,
            auto_confirm_due_at = now() + make_interval(days => $2::int), updated_at = now()
      WHERE id = $1 AND influencer_completed_at IS NULL AND status <> 'completed'
      RETURNING auto_confirm_due_at`, [r.id, days]);
  if (!rows[0]) throw new AppError('ALREADY_MARKED', MSG.ALREADY_MARKED, 422, 'status');
  await logAction(db, r.id, userId, 'influencer', 'attended', `She marked the visit done; confirms itself on ${longDate(istDayOf(rows[0].auto_confirm_due_at))}`, { autoConfirmDays: days });
  await notifyBrand(r, NOTIFY.ATTENDED, `${first(r.creator_name)} says she visited on ${shortDay(new Date())}. Confirm the shoot is done — if you do nothing it confirms itself on ${longDate(istDayOf(rows[0].auto_confirm_due_at))}.`);
  return read(ciId, { side: 'creator', userId });
}

/* ───────────────────────────────────────────────────────────── F8 — the brand confirms */

async function confirm(ciId, { userId, campaignId = null, setId = null }) {
  const r = await loadOrThrow(ciId, { side: 'brand', userId, campaignId, setId });
  await assertOpenVisit(r);
  const stage = stageOf(r);
  if (stage === 'complete') throw new AppError('ALREADY_MARKED', MSG.ALREADY_MARKED, 422, 'status');
  if (stage !== 'attended') throw new AppError('NOT_MARKED_YET', MSG.NOT_MARKED_YET(first(r.creator_name)), 422, 'status');
  const { rowCount } = await db.query(
    `UPDATE production_events
        SET brand_completed_at = now(), brand_completed_by = $2, visit_completed_at = COALESCE(visit_completed_at, now()),
            status = 'completed', updated_at = now()
      WHERE id = $1 AND influencer_completed_at IS NOT NULL AND brand_completed_at IS NULL AND auto_confirmed_at IS NULL`, [r.id, userId]);
  if (rowCount === 0) throw new AppError('ALREADY_MARKED', MSG.ALREADY_MARKED, 422, 'status');
  await logAction(db, r.id, userId, 'brand', 'confirmed', 'The brand confirmed the shoot is done', null);
  await notifyCreator(r, NOTIFY.CONFIRMED, `${r.brand_name} confirmed the shoot is done. Your content step is open.`);
  return read(ciId, { side: 'brand', userId, campaignId, setId });
}

/* ───────────────────────────────────────────────────────────── the jobs */

/**
 * The brand did nothing for the stamped number of days: the visit confirms itself. Reads ONLY
 * auto_confirm_due_at (stamped at F7) — never the live setting. Idempotent: the selection needs
 * auto_confirmed_at IS NULL and brand_completed_at IS NULL; the update is a compare-and-swap.
 */
async function autoConfirmDue({ now = new Date() } = {}) {
  const out = { checked: 0, confirmed: 0, skippedGate: 0, failed: 0 };
  const { rows } = await db.query(
    `SELECT pe.id, pe.contract_id FROM production_events pe
      WHERE pe.mode = 'visit' AND pe.status <> 'completed'
        AND pe.influencer_completed_at IS NOT NULL AND pe.brand_completed_at IS NULL
        AND pe.auto_confirmed_at IS NULL AND pe.auto_confirm_due_at IS NOT NULL AND pe.auto_confirm_due_at <= $1`, [now]);
  const told = [];
  for (const row of rows) {
    out.checked += 1;
    try {
      await db.withTransaction(async (tx) => {
        const { rows: locked } = await tx.query(`SELECT id, contract_id FROM production_events WHERE id = $1 AND auto_confirmed_at IS NULL AND brand_completed_at IS NULL FOR UPDATE SKIP LOCKED`, [row.id]);
        if (!locked[0]) return;
        const gate = await shootGate.assertShootOpen(locked[0].contract_id, tx).catch(() => null);
        if (!gate) { out.skippedGate += 1; return; }
        const { rowCount } = await tx.query(
          `UPDATE production_events SET auto_confirmed_at = $2, visit_completed_at = COALESCE(visit_completed_at, $2), status = 'completed', updated_at = now()
            WHERE id = $1 AND auto_confirmed_at IS NULL AND brand_completed_at IS NULL`, [row.id, now]);
        if (rowCount === 0) return;
        await logAction(tx, row.id, null, 'system', 'auto_confirmed', 'The brand did not confirm in time; the shoot confirmed itself', null);
        out.confirmed += 1;
        told.push(gate.ciId);
      });
    } catch (e) { out.failed += 1; console.error('[shoot-auto-confirm] failed for', row.id, e.message); }
  }
  // After commit: both sides, once each.
  for (const ciId of told) {
    const r = await loadAny(ciId);
    if (!r) continue;
    await notifyBrand(r, NOTIFY.AUTO_CONFIRMED, `You didn't confirm ${first(r.creator_name)}'s store visit by the date, so it was marked done. Her content step is open.`);
    await notifyCreator(r, NOTIFY.AUTO_CONFIRMED, `${r.brand_name} didn't confirm by the date, so the visit was marked done and your content step is open.`);
  }
  return out;
}

/**
 * The day after the posting date, a collaboration whose shoot is not complete is flagged
 * Delayed with the stage it stopped at. Both sides told once. NOTHING ELSE MOVES.
 */
async function flagDelayed({ today = null } = {}) {
  const t = today || todayInIndia();
  const out = { checked: 0, flagged: 0, skippedGate: 0, failed: 0 };
  const { rows } = await db.query(
    `SELECT ci.id AS ci_id, con.id AS contract_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
       LEFT JOIN production_events pe ON pe.contract_id = con.id
      WHERE ci.delayed_at IS NULL AND cs.go_live_date IS NOT NULL AND cs.go_live_date < $1::date
        AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL
        AND (pe.id IS NULL OR pe.status <> 'completed')`, [t]);
  const told = [];
  for (const row of rows) {
    out.checked += 1;
    try {
      await db.withTransaction(async (tx) => {
        const { rows: locked } = await tx.query(`SELECT id FROM campaign_influencers WHERE id = $1 AND delayed_at IS NULL FOR UPDATE SKIP LOCKED`, [row.ci_id]);
        if (!locked[0]) return;
        const gate = await shootGate.shootGate(row.ci_id, tx);
        if (!gate || !gate.open) { out.skippedGate += 1; return; }
        const { rows: [pe] } = await tx.query(`SELECT * FROM production_events WHERE contract_id = $1`, [row.contract_id]);
        const stage = delayedStageOf(pe) || 'plan_not_sent';
        const { rowCount } = await tx.query(`UPDATE campaign_influencers SET delayed_at = now(), delayed_stage = $2 WHERE id = $1 AND delayed_at IS NULL`, [row.ci_id, stage]);
        if (rowCount === 0) return;
        if (pe) await logAction(tx, pe.id, null, 'system', 'delayed', `Posting date passed; flagged Delayed at: ${DELAYED_STAGE_LABEL[stage]}`, { stage });
        out.flagged += 1;
        told.push(row.ci_id);
      });
    } catch (e) { out.failed += 1; console.error('[collab-delayed] failed for', row.ci_id, e.message); }
  }
  for (const ciId of told) {
    const r = await loadAny(ciId);
    if (!r) continue;
    const day = longDate(calendarDay(r.go_live_date));
    await notifyBrand(r, NOTIFY.DELAYED, `The ${day} posting date passed before ${first(r.creator_name)}'s shoot happened. This is now a delayed collaboration. Nothing has changed about the money — you can still plan the visit and carry on.`);
    await notifyCreator(r, NOTIFY.DELAYED, `The ${day} posting date passed before the visit happened. ${r.brand_name} will send a new time. What you were paid at signing stays yours.`);
  }
  return out;
}

/**
 * Reminders (approval §2.5, rules §25): one nudge to whoever's turn it is when a sent plan or a
 * thread turn has sat 48 hours; not more than once per 48 hours; nothing after the posting date;
 * nothing whose gate is closed. Pitch threads are NOT covered here — their own piece of work.
 */
async function remind({ now = new Date() } = {}) {
  const today = todayInIndia();
  const out = { checked: 0, sent: 0 };
  const { rows } = await db.query(
    `SELECT pe.id, pe.contract_id, pe.plan_sent_at, pe.time_agreed_at, pe.influencer_completed_at, pe.reminder_sent_at,
            cs.go_live_date, n.current_turn, n.outcome, n.turn_changed_at, n.reminder_48h_sent_at, n.id AS neg_id
       FROM production_events pe
       JOIN contracts con ON con.id = pe.contract_id
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       LEFT JOIN negotiations n ON n.production_event_id = pe.id
      WHERE pe.mode = 'visit' AND pe.status <> 'completed' AND pe.plan_sent_at IS NOT NULL
        AND pe.influencer_completed_at IS NULL AND pe.auto_confirmed_at IS NULL`);
  for (const row of rows) {
    out.checked += 1;
    if (row.go_live_date && calendarDay(row.go_live_date) < today) continue;             // the Delayed flag takes over
    let side = null, since = null;
    if (row.neg_id && !row.outcome && row.current_turn) { side = row.current_turn; since = row.turn_changed_at; }
    else if (!row.time_agreed_at && !row.neg_id) { side = 'influencer'; since = row.plan_sent_at; }   // she owes an answer on the plan
    if (!side || !since) continue;
    const last = row.neg_id ? row.reminder_48h_sent_at : row.reminder_sent_at;
    const anchor = last && new Date(last).getTime() > new Date(since).getTime() ? last : since;
    if (now.getTime() - new Date(anchor).getTime() < 48 * 3600000) continue;
    const gate = await shootGate.assertShootOpen(row.contract_id).catch(() => null);
    if (!gate) continue;
    const r = await loadAny(gate.ciId);
    if (!r) continue;
    const body = side === 'brand'
      ? `${first(r.creator_name)} is waiting for your answer on the store visit time. Nothing happens until you reply.`
      : `${r.brand_name} is waiting for your answer on the store visit time. Accept it or ask for another.`;
    if (side === 'brand') await notifyBrand(r, NOTIFY.REMINDER, body); else await notifyCreator(r, NOTIFY.REMINDER, body);
    if (row.neg_id) await db.query(`UPDATE negotiations SET reminder_48h_sent_at = $2 WHERE id = $1`, [row.neg_id, now]);
    else await db.query(`UPDATE production_events SET reminder_sent_at = $2 WHERE id = $1`, [row.id, now]);
    out.sent += 1;
  }
  return out;
}

/* ───────────────────────────────────────────────────────────── helpers */

async function loadAny(ciId) {
  const { rows } = await db.query(`${SELECT} WHERE ci.id = $1`, [ciId]);
  return rows[0] || null;
}

function notifyCreator(r, key, body, extra = {}) {
  return notificationService.send({ userId: r.creator_user_id, type: key.type, title: key.title, body, sendSms: false,
    data: { screen: 'my_shoot', campaign_influencer_id: r.ci_id, production_event_id: r.id, ...extra } })
    .catch(err => console.error(`[NOTIFICATION] ${key.type} failed:`, err.message));
}
function notifyBrand(r, key, body, extra = {}) {
  return notificationService.send({ userId: r.brand_user_id, type: key.type, title: key.title, body, sendSms: false,
    data: { screen: 'brand_shoot', campaign_influencer_id: r.ci_id, production_event_id: r.id, campaign_id: r.campaign_id, set_id: r.set_id, ...extra } })
    .catch(err => console.error(`[NOTIFICATION] ${key.type} failed:`, err.message));
}

/** One line for her Active card (V4) and the brand's list. */
function lineFor(pe) {
  const stage = stageOf(pe);
  if (stage === 'complete') return `Store visit done ${shortDay(pe.visit_scheduled_at || pe.brand_completed_at || pe.auto_confirmed_at)}`;
  if (stage === 'attended') return 'You marked the visit done — waiting for their confirmation';
  if (stage === 'agreed') return passedOf(pe) ? 'The visit time passed — a new time is coming' : `Store visit agreed for ${whenLine(pe.visit_scheduled_at)}`;
  if (stage === 'sent') return `Store visit planned for ${whenLine(pe.visit_scheduled_at)}`;
  return null;
}

module.exports = {
  read, send, acceptTime, counterTime, acceptCounter, move, attended, confirm,
  autoConfirmDue, flagDelayed, remind,
  stageOf, passedOf, delayedStageOf, lineFor, validateVisitAt, normalisePhone,
};
