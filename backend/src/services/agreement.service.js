'use strict';

/**
 * Item 7 — the agreement, and the two signatures.
 * Rules v1.20 §9 (with §3, §10, §21, §25, §28). Mockups P1–P16.
 * Contract: features/item7-agreement
 *
 * ONE SERVICE BEHIND EVERY DOOR, as items 5 and 6 established. Preview, send,
 * both signatures, withdraw, decline and expire all live here; the endpoints
 * are thin wrappers. brand-web's legacy countersign shares the money path
 * through contractSign.service, so the two doors can never disagree about what
 * a deal costs.
 *
 * Four things this service refuses to do, on purpose:
 *   · it never reads the invitation once an agreement has been sent — the
 *     snapshot in `terms_json` is the agreement, and nothing else;
 *   · it never lets the brand sign before the creator;
 *   · it never lets either side sign after the set's cutoff;
 *   · it never deletes a contract row. Every ending is recorded (approval Q8).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const notificationService = require('./notification.service');
const events = require('./collabEvents.service');
const campaignState = require('./campaignState.service');
const agreementTerms = require('./agreementTerms.service');
const contractSign = require('./contractSign.service');
const standardTerms = require('./standardTerms.service');
const agreementDocument = require('./agreementDocument.service');
const contractService = require('./contract.service');
const { calendarDay, todayInIndia, isBefore, daysBetween } = require('../utils/indiaDay');
const { MSG, DECLINE_REASONS, DECLINE_LABEL, ENDING, CREATOR, BRAND, NOTIFY, shortDate, longDate } = require('./agreementCopy');

const jsonObj = (v) => (v && typeof v === 'object' ? v : (() => { try { return JSON.parse(v); } catch { return null; } })());
const fmt = contractSign.fmtRupees;

// Statuses an agreement can be in while it is still out and unfinished.
const OPEN_STATUSES = ['draft', 'pending_influencer', 'pending_brand'];

// ─── guards ──────────────────────────────────────────────────────────────────

/**
 * Neither side may sign after the set's invitation cutoff (rules §9, §25).
 * The cutoff never reached the contract endpoints before item 7 — an
 * agreement could be signed weeks after its set had closed.
 */
function assertBeforeCutoff(ctx, today = null) {
  if (!ctx.go_live_date) return;
  const cutoff = campaignState.cutoffFor(calendarDay(ctx.go_live_date));
  const t = today || todayInIndia();
  if (cutoff && isBefore(cutoff, t)) {
    throw new AppError('INVITE_CLOSED', MSG.CLOSED(longDate(cutoff)), 422, 'status');
  }
}

function creatorName(ctx) { return ctx.creator_name || ctx.creator_user_name || 'The creator'; }

/** A typed name plus two ticks is a signature (rules §9). */
function assertSignature({ typedName, ticks }) {
  const name = String(typedName || '').trim();
  if (!name) throw new AppError('VALIDATION_ERROR', MSG.NAME_EMPTY, 422, 'typedName');
  if (name.length > 100) throw new AppError('VALIDATION_ERROR', 'Keep the name under 100 characters.', 422, 'typedName');
  const t = Array.isArray(ticks) ? ticks : [];
  if (t.length < 2 || !t.every(Boolean)) throw new AppError('VALIDATION_ERROR', MSG.TICKS, 422, 'ticks');
  return name;
}

/** How the signature was made, for the document's signature block. */
function signatureMeta(req) {
  const ua = String((req && req.headers && req.headers['user-agent']) || '');
  let device = 'Web';
  if (/android/i.test(ua)) device = 'Android';
  else if (/iphone|ipad|ios/i.test(ua)) device = 'iOS';
  return { ip: (req && req.ip) || null, device };
}

// ─── read ────────────────────────────────────────────────────────────────────

/** The two signature blocks, as both sides see them (P7, P12, P13). */
function signaturesOf(ctx) {
  return {
    creator: ctx.influencer_signed_at ? {
      name: ctx.influencer_signed_name, at: ctx.influencer_signed_at,
      device: ctx.influencer_signed_device || null, ip: ctx.influencer_signed_ip || null,
    } : null,
    brand: ctx.brand_signed_at ? {
      name: ctx.brand_signed_name || ctx.brand_name, forBrand: ctx.brand_name, at: ctx.brand_signed_at,
      device: ctx.brand_signed_device || null, ip: ctx.brand_signed_ip || null,
    } : null,
  };
}

/** Which of P15's four endings this agreement reached, if any. */
function endingOf(ctx) {
  const cutoff = ctx.go_live_date ? campaignState.cutoffFor(calendarDay(ctx.go_live_date)) : null;
  if (ctx.declined_at) {
    return { outcome: 'declined', at: ctx.declined_at,
      text: ENDING.declined(creatorName(ctx), ctx.declined_at, DECLINE_LABEL[ctx.decline_reason] || 'other'),
      reason: ctx.decline_reason || null, reasonLabel: DECLINE_LABEL[ctx.decline_reason] || null, note: ctx.decline_note || null };
  }
  if (ctx.withdrawn_at) {
    return { outcome: 'withdrawn', at: ctx.withdrawn_at, text: ENDING.withdrawn(creatorName(ctx), ctx.withdrawn_at) };
  }
  if (ctx.expired_at) {
    return ctx.influencer_signed_at
      ? { outcome: 'expired_half_signed', at: ctx.expired_at, text: ENDING.halfSigned(creatorName(ctx), ctx.influencer_signed_at, cutoff) }
      : { outcome: 'expired', at: ctx.expired_at, text: ENDING.expired(cutoff) };
  }
  if (ctx.influencer_signed_at && ctx.brand_signed_at) {
    return { outcome: 'agreed', at: ctx.brand_signed_at, text: ENDING.agreed(ctx.brand_signed_at) };
  }
  return null;
}

/** What each side may do next. */
function canOf(ctx, side, today = null) {
  const t = today || todayInIndia();
  const cutoff = ctx.go_live_date ? campaignState.cutoffFor(calendarDay(ctx.go_live_date)) : null;
  const past = cutoff ? isBefore(cutoff, t) : false;
  const open = OPEN_STATUSES.includes(ctx.contract_status);
  const live = open && !past && !ctx.withdrawn_at && !ctx.declined_at && !ctx.expired_at;
  if (side === 'brand') {
    return {
      send: live && ctx.contract_status === 'draft' && ['accepted', 'applied'].includes(ctx.status),
      sign: live && ctx.contract_status === 'pending_brand',
      withdraw: live && ctx.contract_status === 'pending_influencer' && !ctx.influencer_signed_at,
      download: Boolean(ctx.influencer_signed_at && ctx.brand_signed_at),
    };
  }
  return {
    sign: live && ctx.contract_status === 'pending_influencer',
    decline: live && ctx.contract_status === 'pending_influencer',
    download: Boolean(ctx.influencer_signed_at && ctx.brand_signed_at),
  };
}

/**
 * The agreement, as either side reads it.
 *
 * Once sent, EVERY term comes from the snapshot. `preview` is the only shape
 * that reads the invitation, because before sending there is nothing else to
 * read.
 */
async function read(ciId, { side, userId, preview = false } = {}) {
  const ctx = await agreementTerms.loadContext(ciId);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertParty(ctx, side, userId);

  const sent = Boolean(ctx.sent_at && ctx.terms_json);
  const snapshot = sent ? jsonObj(ctx.terms_json) : await agreementTerms.buildSnapshot(ctx);
  if (!sent && !preview && !ctx.contract_id) throw new AppError('NOT_FOUND', MSG.NO_AGREEMENT, 404);

  const cutoff = ctx.go_live_date ? campaignState.cutoffFor(calendarDay(ctx.go_live_date)) : null;
  const today = todayInIndia();
  const terms = await standardTerms.byVersion(snapshot.termsVersion).catch(() => null);

  return {
    invitationId: ctx.id,
    contractId: ctx.contract_id || null,
    reference: ctx.reference_no || null,
    status: ctx.contract_status || 'draft',
    sentAt: ctx.sent_at || null,
    cutoff,
    daysLeft: cutoff ? Math.max(0, daysBetween(today, cutoff)) : null,
    cutoffPassed: cutoff ? isBefore(cutoff, today) : false,
    terms: snapshot,
    standardTerms: terms ? { version: terms.version, effectiveAt: terms.effectiveAt } : { version: snapshot.termsVersion },
    signatures: signaturesOf(ctx),
    ending: endingOf(ctx),
    money: moneySummary(ctx, snapshot),
    can: canOf(ctx, side, today),
    document: (ctx.influencer_signed_at && ctx.brand_signed_at && ctx.pdf_url)
      ? { available: true, generatedAt: ctx.pdf_generated_at || null } : { available: false, generatedAt: null },
  };
}

/** What locked, what was released, what remains (P12). */
function moneySummary(ctx, snapshot) {
  const m = (snapshot && snapshot.money) || {};
  const locked = ctx.locked_amount == null ? null : Number(ctx.locked_amount);
  // Everything released so far, counted from the escrow rows — NOT from
  // contracts.released_amount, which only ever holds the first payment. Before
  // this, "still locked" froze at its day-one value and stayed there for the
  // life of the collaboration (item 9 gap report §4.5).
  const released = ctx.released_so_far == null
    ? (ctx.released_amount == null ? null : Number(ctx.released_amount))
    : Number(ctx.released_so_far);
  return {
    fee: m.fee == null ? null : Number(m.fee),
    campaignFeePct: m.campaignFeePct == null ? null : Number(m.campaignFeePct),
    campaignFee: m.campaignFee == null ? null : Number(m.campaignFee),
    totalToLock: m.totalToLock == null ? null : Number(m.totalToLock),
    split: m.split || null,
    splitPct: m.splitPct || null,
    locked, released,
    stillLocked: locked != null && released != null ? Math.round((locked - released) * 100) / 100 : null,
    at: ctx.money_at || null,
  };
}

/** Another brand's or another creator's agreement is a 404, never a 403. */
function assertParty(ctx, side, userId) {
  if (side === 'brand' && ctx.brand_user_id !== userId) throw new AppError('NOT_FOUND', 'Not found', 404);
  if (side === 'creator' && ctx.creator_user_id !== userId) throw new AppError('NOT_FOUND', 'Not found', 404);
}

/** C4 — what signing will cost, and the shortfall when there is one (P9, P10). */
async function cost(ciId, userId) {
  const ctx = await agreementTerms.loadContext(ciId);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertParty(ctx, 'brand', userId);
  const snapshot = ctx.terms_json ? jsonObj(ctx.terms_json) : await agreementTerms.buildSnapshot(ctx);
  const m = snapshot.money || {};
  const { rows } = await db.query(`SELECT wallet_balance FROM brands WHERE id = $1`, [ctx.brand_id]);
  const available = parseFloat(rows[0] ? rows[0].wallet_balance : 0);
  const needed = Number(m.totalToLock || 0);
  const shortfall = needed > available ? Math.round((needed - available) * 100) / 100 : 0;
  return {
    gate: needed > 0,
    fee: Number(m.fee || 0),
    campaignFeePct: Number(m.campaignFeePct || 0),
    campaignFee: Number(m.campaignFee || 0),
    totalToLock: needed,
    payouts: m.split || null,
    payoutPct: m.splitPct || null,
    availableBalance: available,
    shortfall,
    enough: shortfall === 0,
    line: shortfall === 0 ? BRAND.enough(fmt(available)) : BRAND.short(fmt(available), fmt(needed)),
  };
}

// ─── C1 · preview ────────────────────────────────────────────────────────────

async function preview(ciId, userId) {
  const ctx = await agreementTerms.loadContext(ciId);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertParty(ctx, 'brand', userId);
  if (!['accepted', 'applied'].includes(ctx.status)) {
    throw new AppError('VALIDATION_ERROR', MSG.NOT_ACCEPTED(creatorName(ctx)), 422, 'status');
  }
  const snapshot = await agreementTerms.buildSnapshot(ctx);
  const cutoff = ctx.go_live_date ? campaignState.cutoffFor(calendarDay(ctx.go_live_date)) : null;
  return {
    invitationId: ctx.id,
    reference: ctx.reference_no || null,   // null until sent — the screen shows DRAFT
    draft: !ctx.sent_at,
    cutoff,
    terms: snapshot,
    standardTerms: { version: snapshot.termsVersion },
  };
}

// ─── C2 · send ───────────────────────────────────────────────────────────────

/**
 * Send it. This is the moment the snapshot is taken and the reference is
 * stamped, and it can happen exactly once: `WHERE sent_at IS NULL`.
 */
async function send(ciId, userId, req) {
  const ctx = await agreementTerms.loadContext(ciId);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertParty(ctx, 'brand', userId);

  if (!['accepted', 'applied'].includes(ctx.status)) {
    throw new AppError('VALIDATION_ERROR', MSG.NOT_ACCEPTED(creatorName(ctx)), 422, 'status');
  }
  if (ctx.sent_at && OPEN_STATUSES.includes(ctx.contract_status)) {
    throw new AppError('VALIDATION_ERROR', MSG.ALREADY_OUT(creatorName(ctx)), 422, 'status');
  }
  assertBeforeCutoff(ctx);

  // Item 6 leaves a draft on accept and item 7 fills it in (approval 4.5).
  // If it is missing — an old row, or a failed auto-create — make one now.
  if (!ctx.contract_id) {
    await contractService.autoCreate(ciId);
  }

  const snapshot = await agreementTerms.buildSnapshot(ctx);

  const out = await db.withTransaction(async (tx) => {
    const reference = await agreementTerms.nextReference(tx);
    const { rows } = await tx.query(
      `UPDATE contracts
          SET reference_no = COALESCE(reference_no, $2),
              terms_json = $3::jsonb,
              terms_version = $4,
              sent_at = now(),
              sent_by = $5,
              status = 'pending_influencer',
              withdrawn_at = NULL, withdrawn_by = NULL
        WHERE campaign_influencer_id = $1
          AND sent_at IS NULL
          AND status IN ('draft', 'withdrawn')
        RETURNING *`,
      [ciId, reference, JSON.stringify(snapshot), snapshot.termsVersion, userId]
    );
    if (rows.length === 0) {
      // Either it went out a moment ago on another device, or somebody has
      // already signed it. Either way it is out, and it is not sent twice.
      throw new AppError('VALIDATION_ERROR', MSG.ALREADY_OUT(creatorName(ctx)), 422, 'status');
    }
    return rows[0];
  });

  await events.record({
    campaignInfluencerId: ciId, step: events.STEP.SIGN, actorRole: 'brand',
    actorUserId: userId, action: 'agreement_sent',
  }).catch(() => {});

  const cutoff = ctx.go_live_date ? campaignState.cutoffFor(calendarDay(ctx.go_live_date)) : null;
  await notify(ctx, 'creator', NOTIFY.SENT,
    `${ctx.brand_name} sent your agreement. Sign it by ${shortDate(cutoff)}.`);

  return read(ciId, { side: 'brand', userId });
}

// ─── C8 · the creator signs ──────────────────────────────────────────────────

async function creatorSign(ciId, userId, body, req) {
  const ctx = await agreementTerms.loadContext(ciId);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertParty(ctx, 'creator', userId);
  if (!ctx.contract_id || !ctx.sent_at) throw new AppError('NOT_FOUND', MSG.NO_AGREEMENT, 404);
  if (ctx.influencer_signed_at) throw new AppError('VALIDATION_ERROR', MSG.ALREADY_SIGNED, 422, 'status');
  if (ctx.contract_status !== 'pending_influencer') {
    throw new AppError('VALIDATION_ERROR', MSG.ALREADY_SIGNED, 422, 'status');
  }
  assertBeforeCutoff(ctx);

  const name = assertSignature(body || {});
  const meta = signatureMeta(req);

  await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE contracts
          SET status = 'pending_brand', influencer_signed_name = $2, influencer_signed_at = now(),
              influencer_signed_ip = $3, influencer_signed_device = $4
        WHERE id = $1 AND status = 'pending_influencer'
        RETURNING id`,
      [ctx.contract_id, name, meta.ip, meta.device]
    );
    // Signing twice, or from two devices at once, produces ONE signature.
    if (rows.length === 0) throw new AppError('VALIDATION_ERROR', MSG.ALREADY_SIGNED, 422, 'status');
    await events.record({
      campaignInfluencerId: ciId, step: events.STEP.SIGN, actorRole: 'creator',
      actorUserId: userId, action: 'signed',
    }, tx);
  });

  const cutoff = ctx.go_live_date ? campaignState.cutoffFor(calendarDay(ctx.go_live_date)) : null;
  await notify(ctx, 'brand', NOTIFY.SIGNED,
    `${creatorName(ctx)} signed. Your signature completes it — by ${shortDate(cutoff)}.`);

  return read(ciId, { side: 'creator', userId });
}

// ─── C5 · the brand signs, and the money moves ───────────────────────────────

async function brandSign(ciId, userId, body, req) {
  const ctx = await agreementTerms.loadContext(ciId);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertParty(ctx, 'brand', userId);
  if (!ctx.contract_id || !ctx.sent_at) throw new AppError('NOT_FOUND', MSG.NO_AGREEMENT, 404);

  // She signs first, always. The server refuses the brand's signature before
  // hers, so no money is ever locked against an agreement she has not accepted.
  if (!ctx.influencer_signed_at) {
    throw new AppError('VALIDATION_ERROR', MSG.HER_FIRST(creatorName(ctx)), 422, 'status');
  }
  if (ctx.brand_signed_at || ctx.contract_status === 'active') {
    throw new AppError('VALIDATION_ERROR', MSG.ALREADY_SIGNED, 422, 'status');
  }
  assertBeforeCutoff(ctx);

  const name = assertSignature(body || {});
  const meta = signatureMeta(req);

  // The joined row the shared signing service expects — the same shape
  // brand-web's door builds, so both go through identical maths.
  const contract = await contractSign.loadJoined(ctx.contract_id);

  let result;
  await db.withTransaction(async (tx) => {
    result = await contractSign.brandSignInTx(tx, contract, userId, { typedName: name, ip: meta.ip, device: meta.device });
  });

  // The document exists only once both signatures do (approval Q12).
  await agreementDocument.produce(ctx.contract_id).catch(e =>
    console.error('[AGREEMENT] document generation failed:', e.message));

  const released = result && result.t1Result ? result.t1Result.netAmount : 0;
  await notify(ctx, 'creator', NOTIFY.COMPLETE,
    released > 0
      ? `${ctx.brand_name} signed. ${fmt(released)} is in your wallet.`
      : `${ctx.brand_name} signed. This collaboration is live.`);

  return read(ciId, { side: 'brand', userId });
}

// ─── C6 · withdraw ───────────────────────────────────────────────────────────

async function withdraw(ciId, userId) {
  const ctx = await agreementTerms.loadContext(ciId);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertParty(ctx, 'brand', userId);
  if (!ctx.contract_id || !ctx.sent_at) throw new AppError('NOT_FOUND', MSG.NO_AGREEMENT, 404);
  if (ctx.influencer_signed_at) {
    throw new AppError('VALIDATION_ERROR', MSG.WITHDRAW_TOO_LATE(creatorName(ctx)), 422, 'status');
  }

  await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE contracts
          SET status = 'withdrawn', withdrawn_at = now(), withdrawn_by = $2, sent_at = NULL
        WHERE id = $1 AND status = 'pending_influencer' AND influencer_signed_at IS NULL
        RETURNING id`,
      [ctx.contract_id, userId]
    );
    if (rows.length === 0) throw new AppError('VALIDATION_ERROR', MSG.WITHDRAW_TOO_LATE(creatorName(ctx)), 422, 'status');
    // She goes back to waiting for an agreement. The TERMS are untouched —
    // they were fixed when she accepted, and different terms mean removing her
    // from the set and inviting her again (rules §9).
    await tx.query(`UPDATE campaign_influencers SET status = 'accepted' WHERE id = $1`, [ciId]);
  });

  await notify(ctx, 'creator', NOTIFY.WITHDRAWN,
    `${ctx.brand_name} withdrew the agreement. They may send a new one.`);

  return read(ciId, { side: 'brand', userId });
}

// ─── C9 · she declines ───────────────────────────────────────────────────────

async function decline(ciId, userId, body) {
  const ctx = await agreementTerms.loadContext(ciId);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertParty(ctx, 'creator', userId);
  if (!ctx.contract_id || !ctx.sent_at) throw new AppError('NOT_FOUND', MSG.NO_AGREEMENT, 404);
  if (ctx.influencer_signed_at) throw new AppError('VALIDATION_ERROR', MSG.ALREADY_SIGNED, 422, 'status');

  const reason = String((body && body.reason) || '');
  if (!DECLINE_REASONS.includes(reason)) throw new AppError('VALIDATION_ERROR', MSG.DECLINE_REASON, 422, 'reason');
  const note = body && body.note != null ? String(body.note).trim() : null;
  if (note && note.length > 200) throw new AppError('VALIDATION_ERROR', MSG.DECLINE_NOTE, 422, 'note');

  await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE contracts
          SET status = 'declined', declined_at = now(), decline_reason = $2, decline_note = $3
        WHERE id = $1 AND status = 'pending_influencer' AND influencer_signed_at IS NULL
        RETURNING id`,
      [ctx.contract_id, reason, note || null]
    );
    if (rows.length === 0) throw new AppError('VALIDATION_ERROR', MSG.ALREADY_SIGNED, 422, 'status');
    await tx.query(
      `UPDATE campaign_influencers
          SET status = 'declined', answered_at = now(), declined_reason = $2, declined_note = $3
        WHERE id = $1`,
      [ciId, reason, note || null]
    );
    await events.record({
      campaignInfluencerId: ciId, step: events.STEP.SIGN, actorRole: 'creator',
      actorUserId: userId, action: 'agreement_declined',
    }, tx);
  });

  await notify(ctx, 'brand', NOTIFY.DECLINED,
    ENDING.declined(creatorName(ctx), new Date().toISOString(), DECLINE_LABEL[reason]));

  return read(ciId, { side: 'creator', userId });
}

// ─── C12 · the cutoff closes what nobody signed ──────────────────────────────

/**
 * Called by the set-expiry job. Closes every agreement still out on a set that
 * has reached its cutoff, asserts nothing is locked, and tells both sides —
 * naming the half-signed case to her, because she did her part.
 *
 * Idempotent: an agreement already ended is not touched again.
 */
async function expireForSet(setId, tx) {
  const client = tx || db;
  const { rows } = await client.query(
    `UPDATE contracts con
        SET status = 'expired', expired_at = now()
       FROM campaign_influencers ci, campaign_sets cs
      WHERE con.campaign_influencer_id = ci.id
        AND ci.set_id = cs.id
        AND cs.id = $1
        AND con.status IN ('draft', 'pending_influencer', 'pending_brand')
        AND con.brand_signed_at IS NULL
      RETURNING con.id, con.campaign_influencer_id AS ci_id,
                con.influencer_signed_at, con.locked_amount`,
    [setId]
  );
  // Nothing may be left locked by an agreement that never completed.
  const stillLocked = rows.filter(r => Number(r.locked_amount || 0) > 0);
  if (stillLocked.length) {
    console.error('[AGREEMENT] expired agreements report locked money — investigate:', stillLocked.map(r => r.id));
  }
  return rows;
}

/** After the expiry commits: one sentence to each side. */
async function notifyExpired(rows) {
  for (const r of rows) {
    const ctx = await agreementTerms.loadContext(r.ci_id).catch(() => null);
    if (!ctx) continue;
    const cutoff = ctx.go_live_date ? campaignState.cutoffFor(calendarDay(ctx.go_live_date)) : null;
    const half = Boolean(r.influencer_signed_at);
    await notify(ctx, 'creator', NOTIFY.EXPIRED,
      half ? CREATOR.expiredHalfSigned(ctx.brand_name, cutoff) : CREATOR.expiredUnsigned(cutoff));
    await notify(ctx, 'brand', NOTIFY.EXPIRED,
      half ? ENDING.halfSigned(creatorName(ctx), r.influencer_signed_at, cutoff) : ENDING.expired(cutoff));
  }
}

// ─── notifications ───────────────────────────────────────────────────────────

async function notify(ctx, to, key, body) {
  const userId = to === 'brand' ? ctx.brand_user_id : ctx.creator_user_id;
  if (!userId) return;
  await notificationService.send({
    userId, type: key.type, title: key.title, body,
    data: {
      screen: to === 'brand' ? 'set_detail' : 'invitation',
      campaign_id: ctx.campaign_id, set_id: ctx.set_id, campaign_influencer_id: ctx.id,
    },
    sendSms: false,
  }).catch(err => console.error(`[NOTIFICATION] ${key.type} failed:`, err.message));
}

module.exports = {
  read, preview, send, creatorSign, brandSign, withdraw, decline, cost,
  expireForSet, notifyExpired, assertBeforeCutoff, assertSignature, signatureMeta,
  canOf, endingOf, signaturesOf, OPEN_STATUSES,
};
