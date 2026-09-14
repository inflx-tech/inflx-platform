'use strict';

/**
 * Item 6 — ONE service for counter, accept, decline, the move request and the brand's answer.
 * The new endpoints and the legacy routes (/offers/:id/negotiate, /negotiations/:id/respond,
 * /offers/:id/defer) are thin wrappers over it (APPROVAL §3.1).
 * Contract: features/item6-negotiation · rules v1.18 §7B, §25 · gap report §7, §9
 *
 *   A turn carries the WHOLE negotiable set for the Aim (terms_json, item 5's normalised shape);
 *   the invitation is turn zero; changes are derived on read.
 *   round_limit is stamped from the admin setting when the thread starts; countersUsed is derived.
 *   Whose move is stored (current_turn) and guarded with WRONG_TURN.
 *   No clock: the set's cutoff is the only deadline (set-expiry closes open threads as 'expired').
 *   Accepting rewrites the invitation's four term columns, sets answered_at, closes the thread
 *   'agreed', drafts the contract the same way item 5's accept does, and tells the other side.
 *   The move request never touches the status; only the brand's "agreed" moves her (deferred + pool).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const notificationService = require('./notification.service');
const eligibility = require('./collabEligibility.service');
const settings = require('./platformSettings.service');
const pool = require('./pool.service');
const campaignState = require('./campaignState.service');
const invitationAnswer = require('./invitationAnswer.service');
const { validateTerms } = require('./invitationTerms.service');
const { MSG: MSG5, DECLINE_REASONS, declineLabel, deliverablesInWords, usageInWords, first } = require('./invitationCopy');
const { MSG: MSG4 } = require('./campaignCopy');
const { MSG, ENDING, NOTIFY } = require('./negotiationCopy');
const { SIGNED_CONTRACT_SQL } = require('./collabState');
const { calendarDay, todayInIndia, addDays, isBefore } = require('../utils/indiaDay');
const setShape = require('./setShape.model');

const OPEN_STATUSES = ['invited', 'negotiating'];
const REASON_CODES = DECLINE_REASONS.map(r => r.code);
const other = (side) => (side === 'brand' ? 'influencer' : 'brand');
const inr = (n) => (n == null ? null : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }));
const pct = (p) => (p == null ? null : `${Number(p) % 1 === 0 ? Number(p) : Number(p).toFixed(1)}%`);
const jsonArr = (v) => (Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch (_) { return []; } })() : []));
const jsonObj = (v) => (v && typeof v === 'object' ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch (_) { return null; } })() : null));

/* ───────────────────────────────────────────────────────────── context */

/**
 * Everything the rules need about one invitation, its set, campaign, brand, creator and thread.
 * Scoped to the caller: a creator sees only her row, a brand only its campaigns → null = 404.
 */
async function loadContext(ciId, { influencerId = null, brandId = null } = {}, conn = db) {
  const scope = influencerId ? 'ci.influencer_id = $2' : 'c.brand_id = $2';
  const { rows } = await conn.query(
    `SELECT ci.*,
            cs.goal, cs.go_live_date, cs.expired_at, cs.name AS set_name, cs.influencer_mode, cs.shoot_mode, cs.branch_id,
            c.id AS campaign_id, c.name AS campaign_name, c.allow_negotiation, c.brand_id,
            b.business_name AS brand_name, bu.id AS brand_user_id, bu.fcm_token AS brand_fcm,
            COALESCE(i.full_name, u.name) AS creator_name, u.id AS creator_user_id, u.fcm_token AS creator_fcm,
            n.id AS neg_id, n.status AS neg_status, n.current_turn, n.round_limit, n.outcome, n.ended_at, n.ended_by, n.initiated_by, n.created_at AS neg_started_at,
            (SELECT count(*)::int FROM negotiation_turns t WHERE t.negotiation_id = n.id AND t.kind = 'counter') AS counters_used,
            EXISTS (SELECT 1 FROM contracts con WHERE con.campaign_influencer_id = ci.id AND ${SIGNED_CONTRACT_SQL}) AS signed_both,
            p.id AS pool_id, p.state AS pool_state, p.expires_at AS pool_expires_at
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = c.brand_id JOIN users bu ON bu.id = b.user_id
       JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
       LEFT JOIN negotiations n ON n.campaign_influencer_id = ci.id
       LEFT JOIN brand_creator_pool p ON p.from_ci_id = ci.id
      WHERE ci.id = $1 AND ${scope}`,
    [ciId, influencerId || brandId]
  );
  return rows[0] || null;
}

/* ───────────────────────────────────────────────────────────── snapshots */

/** The invitation's terms as they stand, in the turn shape (turn zero). */
function termsOf(ctx) {
  const usage = jsonObj(ctx.usage_rights_json);
  switch (ctx.goal) {
    case 'engagement':
      // The places keep the order they were chosen in; only the no-change check sorts (canon).
      return { fee: ctx.agreed_fee != null ? Number(ctx.agreed_fee) : null, deliverables: jsonArr(ctx.formats_json).map(d => ({ type: d.type, count: Number(d.count) || 1 })), usageRights: usage && usage.on ? { on: true, durationDays: usage.duration_days == null ? null : Number(usage.duration_days), places: [...(usage.places || [])] } : null };
    case 'hybrid':
      return { fee: ctx.agreed_fee != null ? Number(ctx.agreed_fee) : null, commissionPct: ctx.commission_pct != null ? Number(ctx.commission_pct) : null };
    default:
      return { commissionPct: ctx.commission_pct != null ? Number(ctx.commission_pct) : null };
  }
}

/**
 * Item 5's validator, then the turn shape. Throws the §7 messages. The new endpoints run it
 * strict; the legacy /offers and /negotiations doors run it in item 5's 'legacy' mode (what is
 * present is held to the rules; an invitation sent before item 5 without deliverables or a
 * commission can still be countered on the number it does carry).
 */
function normalizeSnapshot(goal, terms, mode = 'strict') {
  const t = validateTerms(goal, terms || {}, { mode });
  switch (goal) {
    case 'engagement':
      return { fee: t.fee, deliverables: t.deliverables || [], usageRights: t.usageRights ? { on: true, durationDays: t.usageRights.duration_days, places: [...t.usageRights.places] } : null };
    case 'hybrid':
      return { fee: t.fee, commissionPct: t.commissionPct };
    default:
      return { commissionPct: t.commissionPct };
  }
}

/**
 * A snapshot reduced to what "changed something" means: the same numbers, the same deliverable
 * rows and the same usage places, whatever order they were typed in.
 */
function canon(s) {
  if (!s) return 'null';
  const u = s.usageRights && s.usageRights.on ? { d: s.usageRights.durationDays == null ? 'forever' : Number(s.usageRights.durationDays), p: [...(s.usageRights.places || [])].sort() } : null;
  const d = (s.deliverables || []).map(x => `${x.type}:${Number(x.count) || 1}`).sort();
  return JSON.stringify({ c: s.commissionPct == null ? null : Number(s.commissionPct), f: s.fee == null ? null : Number(s.fee), d, u });
}
const sameSnapshot = (a, b) => canon(a) === canon(b);

/** "13%" · "₹12,000 · 1 reel, 1 story" · "₹5,000 + 10%" */
function termsLine(goal, s) {
  if (!s) return null;
  if (goal === 'engagement') return [s.fee != null ? `₹${inr(s.fee)}` : null, deliverablesInWords(s.deliverables)].filter(Boolean).join(' · ');
  if (goal === 'hybrid') return [s.fee != null ? `₹${inr(s.fee)}` : null, pct(s.commissionPct)].filter(Boolean).join(' + ');
  return pct(s.commissionPct);
}

/** The old → new lines between two snapshots (N3 "They asked for 1 reel, 2 stories → 1 reel, 1 story"). */
function changesBetween(goal, prev, next) {
  const out = [];
  const push = (term, from, to) => { if (from !== to) out.push({ term, from, to }); };
  if (goal === 'engagement') {
    push('fee', prev.fee != null ? `₹${inr(prev.fee)}` : '—', next.fee != null ? `₹${inr(next.fee)}` : '—');
    push('deliverables', deliverablesInWords(prev.deliverables) || '—', deliverablesInWords(next.deliverables) || '—');
    const uw = (u) => (u && u.on ? usageInWords({ on: true, duration_days: u.durationDays, places: u.places }) : 'Off');
    push('usageRights', uw(prev.usageRights), uw(next.usageRights));
  } else {
    if (goal === 'hybrid') push('fee', prev.fee != null ? `₹${inr(prev.fee)}` : '—', next.fee != null ? `₹${inr(next.fee)}` : '—');
    push('commissionPct', pct(prev.commissionPct) || '—', pct(next.commissionPct) || '—');
  }
  return out;
}

/** The legacy body (proposed_fee / proposed_commission_pct) merged over the current terms. */
function snapshotFromLegacy(goal, current, body) {
  const s = { ...current };
  if (body.proposed_fee != null && body.proposed_fee !== '') s.fee = body.proposed_fee;
  if (body.proposed_commission_pct != null && body.proposed_commission_pct !== '') s.commissionPct = body.proposed_commission_pct;
  return s;
}

/* ───────────────────────────────────────────────────────────── helpers */

async function turnsOf(negId, conn = db) {
  if (!negId) return [];
  const { rows } = await conn.query(`SELECT * FROM negotiation_turns WHERE negotiation_id = $1 ORDER BY created_at ASC, id ASC`, [negId]);
  return rows;
}

function cutoffOf(ctx) { return ctx.go_live_date ? campaignState.cutoffFor(calendarDay(ctx.go_live_date)) : null; }
function closedByCutoff(ctx, today = null) {
  const cutoff = cutoffOf(ctx);
  return !!(ctx.expired_at || (cutoff && isBefore(cutoff, today || todayInIndia())));
}

function assertOpenInvitation(ctx) {
  // Both signatures end everything: the terms are the agreement's now (rules §7B, §9).
  if (ctx.signed_both) throw new AppError('LOCKED', MSG.AGREED, 422, 'status');
  if (['accepted', 'contracted', 'active', 'completed'].includes(ctx.status) || ctx.outcome === 'agreed') throw new AppError('LOCKED', MSG.AGREED, 422, 'status');
  if (!OPEN_STATUSES.includes(ctx.status)) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');
  invitationAnswer.assertNotClosed(ctx);
}

async function roundLimitOf(ctx) { return ctx.round_limit != null ? Number(ctx.round_limit) : Number(await settings.get('negotiation_rounds')); }

async function notify(ctx, side, { type, title }, body, extra = {}) {
  const userId = side === 'brand' ? ctx.brand_user_id : ctx.creator_user_id;
  const fcmToken = side === 'brand' ? ctx.brand_fcm : ctx.creator_fcm;
  await notificationService.send({
    userId, type, title, body, fcmToken, sendSms: false,
    data: { screen: side === 'brand' ? 'brand_thread' : 'invitation_thread', campaign_influencer_id: ctx.id, campaign_id: ctx.campaign_id, set_id: ctx.set_id, ...extra },
  }).catch(err => console.error(`[NOTIFICATION] ${type} failed:`, err.message));
}

// Item 7 (approval Q8): NOTHING deletes a contract row. An unsigned agreement
// ended by a decline or a move is MARKED, so its ending can still be named.
const endUnsignedContract = (tx, ciId, status, actorUserId) => tx.query(
  `UPDATE contracts
      SET status = $2::contract_status,
          declined_at  = CASE WHEN $2 = 'declined'  THEN now() ELSE declined_at  END,
          withdrawn_at = CASE WHEN $2 = 'withdrawn' THEN now() ELSE withdrawn_at END,
          withdrawn_by = CASE WHEN $2 = 'withdrawn' THEN $3::uuid ELSE withdrawn_by END
    WHERE campaign_influencer_id = $1 AND influencer_signed_at IS NULL AND brand_signed_at IS NULL`,
  [ciId, status, actorUserId || null]);
const endThread = (tx, negId, outcome, actorUserId) => negId && tx.query(
  `UPDATE negotiations SET outcome = $2, status = CASE WHEN $2 = 'agreed' THEN 'agreed'::negotiation_status ELSE 'walked_away'::negotiation_status END,
          ended_at = now(), ended_by = $3, current_turn = NULL, expires_at = NULL WHERE id = $1 AND outcome IS NULL`,
  [negId, outcome, actorUserId || null]);

/* ───────────────────────────────────────────────────────────── counter */

/**
 * @param {object} ctx   from loadContext
 * @param {'influencer'|'brand'} by
 * @param {object} terms  the whole set for the Aim (camel or snake); or a legacy body via `legacy: true`
 */
async function counter({ ctx, by, terms, note, actorUserId, legacy = false }) {
  assertOpenInvitation(ctx);
  const goal = ctx.goal;
  const turns = await turnsOf(ctx.neg_id);
  const lastCounter = [...turns].reverse().find(t => t.kind === 'counter');
  const current = lastCounter && lastCounter.terms_json ? jsonObj(lastCounter.terms_json) : termsOf(ctx);

  if (!ctx.neg_id) {
    if (by !== 'influencer') throw new AppError('VALIDATION_ERROR', MSG.NO_THREAD, 422, 'status');
    if (ctx.allow_negotiation === false) throw new AppError('NEGOTIATION_OFF', MSG.SWITCH_OFF(ctx.brand_name), 403, 'allow_negotiation');
    if (ctx.agreement_id) throw new AppError('FORBIDDEN', 'You already agreed these terms with the brand — accept to generate your contract, or decline.', 403);
    if (ctx.influencer_mode === 'open_group') throw new AppError('FORBIDDEN', 'Open-group applications cannot be negotiated.', 403);
  } else {
    if (ctx.current_turn !== by) throw new AppError('WRONG_TURN', MSG.NOT_YOUR_MOVE(by === 'brand' ? ctx.creator_name : ctx.brand_name), 422, 'status');
  }
  const roundLimit = await roundLimitOf(ctx);
  const used = Number(ctx.counters_used || 0);
  if (used >= roundLimit) throw new AppError('NO_ROUNDS_LEFT', MSG.NO_ROUNDS_LEFT, 422, 'status');

  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length > 300) throw new AppError('VALIDATION_ERROR', MSG.NOTE_LONG, 422, 'note');
  const snapshot = normalizeSnapshot(goal, legacy ? snapshotFromLegacy(goal, current, terms || {}) : terms, legacy ? 'legacy' : 'strict');
  if (sameSnapshot(snapshot, current)) throw new AppError('VALIDATION_ERROR', MSG.NOTHING_CHANGED, 422, 'terms');

  const next = other(by);
  let negId = ctx.neg_id;
  await db.withTransaction(async (tx) => {
    if (!negId) {
      const { rows } = await tx.query(
        `INSERT INTO negotiations (campaign_influencer_id, initiated_by, status, current_turn, round_limit, turn_changed_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
        [ctx.id, actorUserId || null, `awaiting_${next}`, next, roundLimit]
      );
      negId = rows[0].id;
    } else {
      await tx.query(
        `UPDATE negotiations SET current_turn = $2, status = $3, turn_changed_at = now(), reminder_48h_sent_at = NULL, reminder_7d_sent_at = NULL, expires_at = NULL WHERE id = $1`,
        [negId, next, `awaiting_${next}`]
      );
    }
    await tx.query(
      `INSERT INTO negotiation_turns (negotiation_id, sent_by, kind, terms_json, proposed_fee, proposed_commission_pct, note)
       VALUES ($1, $2, 'counter', $3::jsonb, $4, $5, $6)`,
      [negId, by, JSON.stringify(snapshot), snapshot.fee != null ? snapshot.fee : null, snapshot.commissionPct != null ? snapshot.commissionPct : null, text || null]
    );
    await tx.query(
      `UPDATE campaign_influencers SET status = 'negotiating', answered_at = COALESCE(answered_at, CASE WHEN $2 = 'influencer' THEN now() END) WHERE id = $1`,
      [ctx.id, by]
    );
  });

  const who = by === 'brand' ? ctx.brand_name : ctx.creator_name;
  await notify(ctx, next, NOTIFY.TURN, `${who} countered ${termsLine(goal, snapshot)}. Your move.`, { negotiation_id: negId });
  return negId;
}

/* ───────────────────────────────────────────────────────────── accept */

async function accept({ ctx, by, actorUserId }) {
  if (!ctx.neg_id) throw new AppError('VALIDATION_ERROR', MSG.NO_THREAD, 422, 'status');
  assertOpenInvitation(ctx);
  if (ctx.current_turn !== by) throw new AppError('WRONG_TURN', MSG.NOT_YOUR_MOVE(by === 'brand' ? ctx.creator_name : ctx.brand_name), 422, 'status');
  const turns = await turnsOf(ctx.neg_id);
  const lastCounter = [...turns].reverse().find(t => t.kind === 'counter');
  if (!lastCounter) throw new AppError('VALIDATION_ERROR', MSG.NO_THREAD, 422, 'status');
  const s = jsonObj(lastCounter.terms_json) || {};
  const goal = ctx.goal;

  await db.withTransaction(async (tx) => {
    await tx.query(`INSERT INTO negotiation_turns (negotiation_id, sent_by, kind, terms_json, proposed_fee, proposed_commission_pct) VALUES ($1, $2, 'accept', $3::jsonb, $4, $5)`,
      [ctx.neg_id, by, JSON.stringify(s), s.fee != null ? s.fee : null, s.commissionPct != null ? s.commissionPct : null]);
    // Accepting rewrites the invitation itself (§7B). Only the Aim's negotiable columns move.
    await tx.query(
      `UPDATE campaign_influencers
          SET status = 'accepted', answered_at = COALESCE(answered_at, now()),
              agreed_fee     = CASE WHEN $2 IN ('engagement','hybrid') THEN $3 ELSE agreed_fee END,
              commission_pct = CASE WHEN $2 IN ('conversion','hybrid') THEN $4 ELSE commission_pct END,
              formats_json   = CASE WHEN $2 = 'engagement' THEN $5::jsonb ELSE formats_json END,
              usage_rights_json = CASE WHEN $2 = 'engagement' THEN $6::jsonb ELSE usage_rights_json END
        WHERE id = $1`,
      [ctx.id, goal, s.fee != null ? s.fee : null, s.commissionPct != null ? s.commissionPct : null,
        s.deliverables ? JSON.stringify(s.deliverables) : null,
        s.usageRights && s.usageRights.on ? JSON.stringify({ on: true, duration_days: s.usageRights.durationDays, places: s.usageRights.places }) : null]
    );
    await endThread(tx, ctx.neg_id, 'agreed', actorUserId);
  });

  // The draft contract, the same call item 5's plain accept uses (APPROVAL Q11).
  let contractError = null;
  if (ctx.influencer_mode !== 'open_group') {
    try { await require('./contract.service').autoCreate(ctx.id); } catch (e) { console.error('[CONTRACT] Auto-create failed on negotiation accept:', e.message); contractError = e.message; }
  }
  const who = by === 'brand' ? ctx.brand_name : ctx.creator_name;
  await notify(ctx, other(by), NOTIFY.AGREED, `${who} accepted ${termsLine(goal, s)}. The agreement is the next step.`, { negotiation_id: ctx.neg_id });
  return { contractError };
}

/* ───────────────────────────────────────────────────────────── decline */

async function decline({ ctx, by, reason, note, actorUserId }) {
  if (!ctx.neg_id) throw new AppError('VALIDATION_ERROR', MSG.NO_THREAD, 422, 'status');
  assertOpenInvitation(ctx);
  if (ctx.current_turn !== by) throw new AppError('WRONG_TURN', MSG.NOT_YOUR_MOVE(by === 'brand' ? ctx.creator_name : ctx.brand_name), 422, 'status');
  const text = typeof note === 'string' ? note.trim() : '';
  if (by === 'influencer') {
    if (!reason || !REASON_CODES.includes(reason)) throw new AppError('VALIDATION_ERROR', MSG5.DECLINE_REASON, 422, 'reason');
    if (text.length > 200) throw new AppError('VALIDATION_ERROR', MSG5.DECLINE_NOTE_LONG, 422, 'note');
  } else if (text.length > 200) throw new AppError('VALIDATION_ERROR', MSG.BRAND_REASON_LONG, 422, 'note');

  const outcome = by === 'influencer' ? 'declined_by_creator' : 'declined_by_brand';
  await db.withTransaction(async (tx) => {
    await tx.query(`INSERT INTO negotiation_turns (negotiation_id, sent_by, kind, decline_reason, decline_note) VALUES ($1, $2, 'decline', $3, $4)`,
      [ctx.neg_id, by, by === 'influencer' ? reason : null, text || null]);
    if (by === 'influencer') {
      await tx.query(`UPDATE campaign_influencers SET status = 'declined', declined_reason = $2, declined_note = $3, answered_at = COALESCE(answered_at, now()) WHERE id = $1`, [ctx.id, reason, text || null]);
    } else {
      await tx.query(`UPDATE campaign_influencers SET status = 'rejected_by_brand', declined_note = $2 WHERE id = $1`, [ctx.id, text || null]);
    }
    await endUnsignedContract(tx, ctx.id, by === 'influencer' ? 'declined' : 'withdrawn', actorUserId);
    await endThread(tx, ctx.neg_id, outcome, actorUserId);
  });

  if (by === 'influencer') {
    await notify(ctx, 'brand', NOTIFY.DECLINED, `${ctx.creator_name} declined your counter. Reason: ${declineLabel(reason)}.${text ? ` "${text}"` : ''}`, { negotiation_id: ctx.neg_id });
  } else {
    await notify(ctx, 'influencer', NOTIFY.DECLINED, `${ctx.brand_name} declined your counter, so this invitation has ended.${text ? ` "${text}"` : ''}`, { negotiation_id: ctx.neg_id });
  }
  return { outcome };
}

/* ───────────────────────────────────────────────────── the move request */

/** Creator: a different date and/or mode. Once per invitation; no round; not governed by the switch. */
async function moveRequest({ ctx, goLiveDate, shootMode, note }) {
  assertOpenInvitation(ctx);
  if (ctx.move_requested_at) throw new AppError('CONFLICT', MSG.MOVE_TWICE, 409, 'move');
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length > 300) throw new AppError('VALIDATION_ERROR', MSG.NOTE_LONG, 422, 'note');
  const day = goLiveDate ? calendarDay(goLiveDate) : null;
  const mode = shootMode ? String(shootMode).toLowerCase() : null;
  if (mode && !setShape.SHOOT_MODES_OFFERED.includes(mode)) throw new AppError('VALIDATION_ERROR', MSG4.MODE, 422, 'shootMode');
  const setDay = ctx.go_live_date ? calendarDay(ctx.go_live_date) : null;
  const sameDay = day && setDay && day === setDay;
  const sameMode = mode && ctx.shoot_mode && mode === ctx.shoot_mode;
  if (!day && !mode) throw new AppError('VALIDATION_ERROR', MSG.MOVE_NOTHING, 422, 'move');
  if (sameDay && !mode) throw new AppError('VALIDATION_ERROR', MSG.MOVE_SAME_DATE, 422, 'goLiveDate');
  if (sameMode && !day) throw new AppError('VALIDATION_ERROR', MSG.MOVE_NOTHING, 422, 'move');
  if (day && isBefore(day, setShape.earliestGoLiveDay(todayInIndia()))) throw new AppError('VALIDATION_ERROR', MSG4.DATE_TOO_SOON, 422, 'goLiveDate');

  const { rows } = await db.query(
    `UPDATE campaign_influencers
        SET deferred_go_live_date = $2, deferred_shoot_mode = $3, deferred_note = $4, move_requested_at = now()
      WHERE id = $1 AND move_requested_at IS NULL RETURNING *`,
    [ctx.id, sameDay ? null : day, sameMode ? null : mode, text || null]
  );
  if (!rows[0]) throw new AppError('CONFLICT', MSG.MOVE_TWICE, 409, 'move');
  const what = [rows[0].deferred_go_live_date ? calendarDay(rows[0].deferred_go_live_date) : null, rows[0].deferred_shoot_mode === 'visit' ? 'a Store Visit' : rows[0].deferred_shoot_mode === 'shipment' ? 'Remote' : null].filter(Boolean).join(' and ');
  await notify(ctx, 'brand', NOTIFY.MOVE_REQUESTED, `${ctx.creator_name} asked for ${what || 'a different set'} instead. Your move.`);
  return rows[0];
}

/** Brand: agreed (→ the pool) · kept (nothing changes) · declined (→ rejected_by_brand). */
async function moveAnswer({ ctx, answer, actorUserId }) {
  if (!ctx.move_requested_at || ctx.move_answer) throw new AppError('VALIDATION_ERROR', MSG.MOVE_NOT_PENDING, 422, 'move');
  if (!['agreed', 'kept', 'declined'].includes(answer)) throw new AppError('VALIDATION_ERROR', 'answer must be agreed, kept or declined', 422, 'answer');
  assertOpenInvitation(ctx);
  const wantsDay = ctx.deferred_go_live_date ? calendarDay(ctx.deferred_go_live_date) : null;
  const cutoff = cutoffOf(ctx);
  let entry = null;

  await db.withTransaction(async (tx) => {
    if (answer === 'agreed') {
      // The pool carries the invitation's terms AS THEY STAND — never a counter the brand
      // never accepted (§7B, APPROVAL Q4).
      entry = await pool.create({
        brandId: ctx.brand_id, influencerId: ctx.influencer_id, goal: ctx.goal, agreedTerms: termsOf(ctx),
        wantsGoLiveDate: wantsDay, wantsShootMode: ctx.deferred_shoot_mode || null, note: ctx.deferred_note || null,
        fromCampaignId: ctx.campaign_id, fromSetId: ctx.set_id, fromCiId: ctx.id,
      }, tx);
      await tx.query(`UPDATE campaign_influencers SET status = 'deferred', deferred_at = now(), move_answer = 'agreed', move_answered_at = now() WHERE id = $1`, [ctx.id]);
      await endUnsignedContract(tx, ctx.id, 'withdrawn', actorUserId);
      await endThread(tx, ctx.neg_id, 'moved', actorUserId);
    } else if (answer === 'kept') {
      await tx.query(`UPDATE campaign_influencers SET move_answer = 'kept', move_answered_at = now() WHERE id = $1`, [ctx.id]);
    } else {
      await tx.query(`UPDATE campaign_influencers SET status = 'rejected_by_brand', move_answer = 'declined', move_answered_at = now() WHERE id = $1`, [ctx.id]);
      await endUnsignedContract(tx, ctx.id, 'withdrawn', actorUserId);
      await endThread(tx, ctx.neg_id, 'declined_by_brand', actorUserId);
    }
  });

  const setDay = ctx.go_live_date ? calendarDay(ctx.go_live_date) : null;
  if (answer === 'agreed') await notify(ctx, 'influencer', NOTIFY.POOL_ENTERED, `${ctx.brand_name} agreed to ${wantsDay ? longDay(wantsDay) : 'your request'}. They'll send a new invitation once the dates are set.`, { pool_entry_id: entry.id });
  else if (answer === 'kept') await notify(ctx, 'influencer', NOTIFY.MOVE_KEPT, `${ctx.brand_name} are keeping ${longDay(setDay)}. You can still accept or decline by ${longDay(cutoff)}.`);
  else await notify(ctx, 'influencer', NOTIFY.MOVE_DECLINED, `${ctx.brand_name} said no to a different ${wantsDay ? 'date' : 'mode'}, so this invitation has ended.`);
  return { answer, entry };
}

const longDay = (d) => require('./campaignCopy').longDate(d);

/* ───────────────────────────────────────────────────────────── the thread */

/**
 * B3 / B5 — newest turn first, the invitation as the last card, whose move, rounds, what the
 * caller may do now. `side` = 'influencer' | 'brand'. The brand's view adds the minimum
 * warnings; the creator's view never carries them.
 */
async function thread(ctx, side) {
  const goal = ctx.goal;
  const turns = await turnsOf(ctx.neg_id);
  const zero = termsOf(ctx);
  let prev = zero;
  const shaped = [];
  for (const t of turns) {
    const s = t.kind === 'decline' ? null : (jsonObj(t.terms_json) || prev);
    shaped.push({
      id: t.id, by: t.sent_by, mine: t.sent_by === side, at: t.created_at, kind: t.kind,
      terms: s, termsLine: s ? termsLine(goal, s) : null,
      changes: t.kind === 'counter' ? changesBetween(goal, prev, s) : [],
      note: t.note || null,
      declineReason: t.decline_reason || null, declineReasonLabel: declineLabel(t.decline_reason), declineNote: t.decline_note || null,
    });
    if (t.kind === 'counter' && s) prev = s;
  }
  const roundLimit = await roundLimitOf(ctx);
  const countersUsed = Number(ctx.counters_used || 0);
  const open = !!ctx.neg_id && !ctx.outcome;
  const closed = closedByCutoff(ctx);
  const invitationOpen = OPEN_STATUSES.includes(ctx.status) && !closed;
  const myMove = open && ctx.current_turn === side;
  const canCounterNew = !ctx.neg_id && side === 'influencer' && invitationOpen && ctx.allow_negotiation !== false && !ctx.agreement_id && ctx.influencer_mode !== 'open_group';
  const can = {
    counter: invitationOpen && (canCounterNew || (myMove && countersUsed < roundLimit)),
    accept: invitationOpen && myMove,
    decline: invitationOpen && myMove,
    moveRequest: side === 'influencer' && invitationOpen && !ctx.move_requested_at,
    moveAnswer: side === 'brand' && invitationOpen && !!ctx.move_requested_at && !ctx.move_answer,
  };
  const lastCounter = [...turns].reverse().find(t => t.kind === 'counter');
  const current = lastCounter && lastCounter.terms_json ? jsonObj(lastCounter.terms_json) : zero;
  const cutoff = cutoffOf(ctx);
  const out = {
    invitationId: ctx.id, goal, status: ctx.status,
    brand: { name: ctx.brand_name }, creator: { id: ctx.influencer_id, name: ctx.creator_name },
    campaignName: ctx.campaign_name, setName: ctx.set_name, postingDate: ctx.go_live_date ? calendarDay(ctx.go_live_date) : null, cutoff, cutoffPassed: closed,
    switchOn: ctx.allow_negotiation !== false,
    negotiation: ctx.neg_id ? {
      id: ctx.neg_id, open, whoseMove: open ? ctx.current_turn : null, roundLimit, countersUsed,
      isLastRound: countersUsed === roundLimit - 1,          // the NEXT counter is the last one
      noRoundsLeft: countersUsed >= roundLimit,              // the receiving side may only accept or decline
      outcome: ctx.outcome || null, endedAt: ctx.ended_at || null, startedAt: ctx.neg_started_at,
    } : { id: null, open: false, whoseMove: null, roundLimit, countersUsed: 0, isLastRound: roundLimit === 1, noRoundsLeft: false, outcome: null, endedAt: null, startedAt: null },
    current, currentLine: termsLine(goal, current),
    turns: shaped.reverse(),
    invitation: { terms: zero, termsLine: termsLine(goal, zero), sentAt: ctx.invited_at || ctx.created_at, scopeWords: goal !== 'engagement' ? scopeWords(ctx) : null, offerName: goal !== 'engagement' ? offerName(ctx) : null },
    moveRequest: ctx.move_requested_at ? { goLiveDate: ctx.deferred_go_live_date ? calendarDay(ctx.deferred_go_live_date) : null, shootMode: ctx.deferred_shoot_mode || null, note: ctx.deferred_note || null, requestedAt: ctx.move_requested_at, answer: ctx.move_answer || null, answeredAt: ctx.move_answered_at || null } : null,
    pool: ctx.pool_id ? { entryId: ctx.pool_id, state: ctx.pool_state, expiresAt: ctx.pool_expires_at } : null,
    can,
    ending: endingOf(ctx, goal, current, cutoff),
  };
  if (side === 'brand') {
    const gate = await eligibility.canBrandInviteCreator({ brandId: ctx.brand_id, influencerId: ctx.influencer_id, set: { goal, shoot_mode: ctx.shoot_mode, branch_id: ctx.branch_id }, proposedTerms: { fee: current.fee, commissionPct: current.commissionPct } }).catch(() => null);
    out.warnings = gate && gate.ok ? gate.warnings : [];
    out.minimums = gate && gate.ok ? gate.minimums : null;
  }
  return out;
}

function scopeWords(ctx) {
  if (ctx.alloc_scope === 'category') return ctx.alloc_category || 'a category';
  if (ctx.alloc_scope === 'products') return `${jsonArr(ctx.alloc_product_ids).length} products`;
  return 'whole store';
}
function offerName(ctx) { return ctx.brand_offer_id ? 'Saved offer' : (ctx.offer_type ? 'Special offer' : null); }

/** N21 — the ending as a sentence with a date, or null while open. */
function endingOf(ctx, goal, current, cutoff) {
  if (!ctx.outcome) return null;
  const d = ctx.ended_at ? require('./campaignCopy').longDate(new Date(ctx.ended_at).toISOString().slice(0, 10)) : '';
  const f = first(ctx.creator_name);
  switch (ctx.outcome) {
    case 'agreed': return { outcome: 'agreed', text: ENDING.agreed(termsLine(goal, current), d) };
    case 'declined_by_creator': return { outcome: 'declined_by_creator', text: ENDING.declined_by_creator(f, d, declineLabel(ctx.declined_reason), cutoff) };
    case 'declined_by_brand': return { outcome: 'declined_by_brand', text: ENDING.declined_by_brand(d, f, ctx.declined_note) };
    case 'expired': return { outcome: 'expired', text: ENDING.expired(cutoff) };
    case 'moved': return { outcome: 'moved', text: ENDING.moved(f, d) };
    default: return { outcome: ctx.outcome, text: null };
  }
}

/* ────────────────────────────────────────────────── jobs' entry points */

/** set-expiry: close the open threads of the invitations a set just expired. Returns the rows to notify. */
async function endForExpiredSet(setId, tx) {
  const { rows } = await tx.query(
    `UPDATE negotiations n SET outcome = 'expired', status = 'walked_away', ended_at = now(), current_turn = NULL, expires_at = NULL
       FROM campaign_influencers ci WHERE ci.id = n.campaign_influencer_id AND ci.set_id = $1 AND n.outcome IS NULL
     RETURNING n.id, ci.id AS ci_id`, [setId]);
  return rows;
}

/**
 * Reminders (§25, APPROVAL Q10): 48 hours and 7 days of silence, notifications only, to the side
 * whose move it is, stopped the moment the move changes hands or the invitation closes.
 */
async function sendReminders({ now = new Date() } = {}) {
  const today = todayInIndia();
  const { rows } = await db.query(
    `SELECT n.id, n.current_turn, n.turn_changed_at, n.reminder_48h_sent_at, n.reminder_7d_sent_at, n.campaign_influencer_id AS ci_id,
            cs.go_live_date, cs.expired_at
       FROM negotiations n
       JOIN campaign_influencers ci ON ci.id = n.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
      WHERE n.outcome IS NULL AND n.current_turn IS NOT NULL AND n.turn_changed_at IS NOT NULL
        AND ci.status = 'negotiating'
        AND (n.reminder_48h_sent_at IS NULL OR n.reminder_7d_sent_at IS NULL)`);
  const out = { checked: rows.length, sent48h: 0, sent7d: 0 };
  for (const r of rows) {
    if (r.expired_at || (r.go_live_date && isBefore(campaignState.cutoffFor(calendarDay(r.go_live_date)), today))) continue;
    const silentMs = now.getTime() - new Date(r.turn_changed_at).getTime();
    const which = !r.reminder_7d_sent_at && silentMs >= 7 * 86400000 ? '7d' : (!r.reminder_48h_sent_at && silentMs >= 48 * 3600000 ? '48h' : null);
    if (!which) continue;
    const ctx = await loadContextAny(r.ci_id);
    if (!ctx) continue;
    const name = r.current_turn === 'brand' ? ctx.creator_name : ctx.brand_name;
    await notify(ctx, r.current_turn, NOTIFY.REMINDER, `${name} is waiting for your reply on ${ctx.set_name}. Nothing happens until you answer.`, { negotiation_id: r.id });
    await db.query(`UPDATE negotiations SET ${which === '7d' ? 'reminder_7d_sent_at' : 'reminder_48h_sent_at'} = now() WHERE id = $1`, [r.id]);
    if (which === '7d') out.sent7d += 1; else out.sent48h += 1;
  }
  return out;
}
/** Unscoped context for jobs. */
async function loadContextAny(ciId) {
  const { rows } = await db.query(`SELECT ci.influencer_id, c.brand_id FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id WHERE ci.id = $1`, [ciId]);
  return rows[0] ? loadContext(ciId, { brandId: rows[0].brand_id }) : null;
}

module.exports = {
  OPEN_STATUSES, loadContext, loadContextAny, termsOf, normalizeSnapshot, termsLine, changesBetween,
  counter, accept, decline, moveRequest, moveAnswer, thread, endForExpiredSet, sendReminders, notify,
};
