'use strict';

/**
 * withdrawalRequest.service.js — the only way money leaves INFLX (item 17).
 * Contract: features/item17-wallet · master rules v1.31 §17A · boards BW7–BW9, CW5–CW6, AM2–AM4
 *
 * ONE model for a Brand and a Creator:
 *
 *   request            the amount moves OUT of wallet_balance (Available) INTO withdrawal_hold.
 *                      From that moment it cannot be spent on an agreement or requested again —
 *                      every spend path reads wallet_balance, so none of them needs to know.
 *   processed          INFLX paid it from its own bank and recorded the reference: the hold is
 *                      taken. This is the moment the money has left INFLX.
 *   could not process  the hold goes back to Available, with the reason the person reads.
 *
 * No approval step, no automatic payout (RazorpayX is retired from this path), no deduction —
 * TDS is paused (W6): the full amount requested is paid and nothing here mentions tax.
 * One open request at a time; the minimum is payment_config.min_withdrawal_inr.
 *
 * Every state change is one transaction with the owner row FOR UPDATE and a compare-and-swap on
 * the request's status, so two taps, two devices or two admins give one outcome.
 */

const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { decrypt } = require('../utils/encrypt');
const paymentConfigSvc = require('./paymentConfig.service');
const platformSettings = require('./platformSettings.service');
const notificationService = require('./notification.service');
const ledgerService = require('./ledger.service');

const refuse = (code, message, status = 422, field = null) => { throw new AppError(code, message, status, field); };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const safeDecrypt = (v) => { if (!v) return null; try { return decrypt(v); } catch (_) { return null; } };
const tail = (s, n = 4) => String(s || '').slice(-n);

const MSG = {
  NO_BANK: 'Add your bank account first.',
  NO_UPI: 'Add your UPI ID first.',
  NO_DETAILS: 'Add where to send your money first.',
  ONE_AT_A_TIME: (amt) => `You have a withdrawal of ${inr(amt)} waiting. You can request another once it is processed.`,
  TOO_SMALL: (min, have) => `The minimum is ${inr(min)}.${have != null && have < min ? ` You have ${inr(have)} available.` : ''}`,
  TOO_MUCH: (have) => `That's more than your ${inr(have)} available.`,
  AMOUNT: 'Enter an amount.',
  NOT_WAITING: 'This request is no longer waiting.',
  REFERENCE: 'Enter the bank reference.',
  REASON: 'Say why it could not be processed.',
};

/** The owner's table, column names and how to load her — the one place the two kinds differ. */
const KIND = {
  brand: {
    table: 'brands', idCol: 'brand_id',
    load: (conn, userId, lock) => conn.query(
      `SELECT b.id, b.user_id, b.business_name AS name, b.wallet_balance, b.withdrawal_hold, b.bank_account_no, b.bank_ifsc, NULL::text AS upi_id
         FROM brands b WHERE b.user_id = $1${lock ? ' FOR UPDATE' : ''}`, [userId]),
  },
  creator: {
    table: 'influencers', idCol: 'influencer_id',
    load: (conn, userId, lock) => conn.query(
      `SELECT i.id, i.user_id, COALESCE(i.full_name, u.name) AS name, i.wallet_balance, i.withdrawal_hold, i.bank_account_no, i.bank_ifsc, i.upi_id
         FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.user_id = $1${lock ? ' FOR UPDATE OF i' : ''}`, [userId]),
  },
};

/** What she may send money to, masked for the screen (BW7, CW5). */
function payOptions(o) {
  const out = [];
  const upi = safeDecrypt(o.upi_id);
  if (upi) out.push({ method: 'upi', label: `UPI · ${upi}`, masked: upi });
  const acct = safeDecrypt(o.bank_account_no);
  if (acct && o.bank_ifsc) out.push({ method: 'bank', label: `Bank ··${tail(acct)}`, masked: `··${tail(acct)} · ${o.bank_ifsc}` });
  return out;
}

async function minimum() {
  const cfg = await paymentConfigSvc.getConfig();
  return r2(cfg.minWithdrawalInr);
}

const shape = (w) => (w ? {
  id: w.id, amount: r2(w.amount), method: w.method, sendTo: w.payee_masked, status: w.status,
  requestedAt: w.requested_at, processHours: w.process_hours,
  processedAt: w.processed_at, paidOn: w.paid_on, reference: w.status === 'processed' ? w.bank_reference : null,
  reason: w.status === 'could_not_process' ? w.reason : null,
} : null);

async function openOf(conn, kind, ownerId) {
  const { rows } = await conn.query(
    `SELECT * FROM withdrawal_requests WHERE ${KIND[kind].idCol} = $1 AND status = 'requested'`, [ownerId]);
  return rows[0] || null;
}

/** What the Withdraw screen needs before she types anything (BW7, BW9, CW5). */
async function options(kind, userId) {
  const { rows: [o] } = await KIND[kind].load(db, userId, false);
  if (!o) refuse('NOT_FOUND', 'Not found', 404);
  const min = await minimum();
  const open = await openOf(db, kind, o.id);
  const sendTo = payOptions(o);
  const available = r2(o.wallet_balance);
  return {
    available, onHold: r2(o.withdrawal_hold), minimum: min, sendTo,
    processHours: Number(await platformSettings.get('withdrawal_process_hours')),
    open: shape(open),
    blocked: open ? { code: 'ONE_AT_A_TIME', message: MSG.ONE_AT_A_TIME(open.amount) }
      : !sendTo.length ? { code: 'NO_DETAILS', message: kind === 'brand' ? MSG.NO_BANK : MSG.NO_DETAILS }
        : available < min ? { code: 'TOO_SMALL', message: MSG.TOO_SMALL(min, available) } : null,
  };
}

/**
 * She asks to withdraw. The amount goes on hold at once (W5).
 * body: { amount, method?: 'bank' | 'upi' } — the destination is read from HER saved details on
 * the server; a client can never name an account.
 */
async function request(kind, userId, { amount, method } = {}) {
  const amt = r2(amount);
  if (!amt || amt <= 0) refuse('VALIDATION_ERROR', MSG.AMOUNT, 422, 'amount');
  const min = await minimum();
  const hours = Number(await platformSettings.get('withdrawal_process_hours'));
  const K = KIND[kind];

  const out = await db.withTransaction(async (client) => {
    const { rows: [o] } = await K.load(client, userId, true);
    if (!o) refuse('NOT_FOUND', 'Not found', 404);
    const open = await openOf(client, kind, o.id);
    if (open) refuse('ONE_AT_A_TIME', MSG.ONE_AT_A_TIME(open.amount), 422, 'status');
    const opts = payOptions(o);
    const want = method || (opts[0] && opts[0].method);
    const pick = opts.find((x) => x.method === want);
    if (!pick) refuse('PAYMENT_METHOD_MISSING', want === 'upi' ? MSG.NO_UPI : kind === 'brand' ? MSG.NO_BANK : MSG.NO_DETAILS, 422, 'method');
    const available = r2(o.wallet_balance);
    if (amt < min) refuse('WITHDRAWAL_TOO_SMALL', MSG.TOO_SMALL(min, available), 422, 'amount');
    if (amt > available) refuse('INSUFFICIENT_BALANCE', MSG.TOO_MUCH(available), 422, 'amount');

    const newAvailable = r2(available - amt);
    const { rowCount } = await client.query(
      `UPDATE ${K.table} SET wallet_balance = $2, withdrawal_hold = withdrawal_hold + $3 WHERE id = $1 AND wallet_balance >= $3`,
      [o.id, newAvailable, amt]);
    if (rowCount !== 1) refuse('INSUFFICIENT_BALANCE', MSG.TOO_MUCH(available), 422, 'amount');

    let w;
    try {
      ({ rows: [w] } = await client.query(
        `INSERT INTO withdrawal_requests
           (owner_kind, ${K.idCol}, amount, method, payee_name, account_enc, ifsc, upi_enc, payee_masked, requested_by, process_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [kind, o.id, amt, pick.method, o.name || 'Account holder',
          pick.method === 'bank' ? o.bank_account_no : null, pick.method === 'bank' ? o.bank_ifsc : null,
          pick.method === 'upi' ? o.upi_id : null, pick.masked, userId, hours]));
    } catch (e) {
      if (e.code === '23505') refuse('ONE_AT_A_TIME', MSG.ONE_AT_A_TIME(amt), 422, 'status');
      throw e;
    }
    await writeLedger(client, kind, o.id, 'withdrawal_hold', amt, 'debit', newAvailable, w.id, `Withdrawal requested · on hold · to ${pick.masked}`);
    return { w, userId: o.user_id };
  });
  return shape(out.w);
}

/** Her withdrawals, newest first (BW8, CW6). */
async function listMine(kind, userId) {
  const { rows: [o] } = await KIND[kind].load(db, userId, false);
  if (!o) refuse('NOT_FOUND', 'Not found', 404);
  const { rows } = await db.query(
    `SELECT * FROM withdrawal_requests WHERE ${KIND[kind].idCol} = $1 ORDER BY requested_at DESC LIMIT 100`, [o.id]);
  return rows.map(shape);
}

/** A ledger row in the owner's own ledger — brands in wallet_transactions, creators in influencer_ledger. */
async function writeLedger(client, kind, ownerId, type, amount, direction, balanceAfter, refId, note) {
  if (kind === 'brand') {
    await client.query(
      `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, notes, source_ref_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ownerId, type, amount, direction, balanceAfter, note, refId]);
    return;
  }
  await ledgerService.appendInfluencerLedger({
    client, influencerId: ownerId, type, amount, direction, balanceField: 'wallet_balance', balanceAfter,
    source: 'withdrawal', sourceRefId: refId, note,
  });
}

async function lockRequest(client, id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))) refuse('NOT_FOUND', 'Not found', 404);
  const { rows: [w] } = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE`, [id]);
  if (!w) refuse('NOT_FOUND', 'Not found', 404);
  if (w.status !== 'requested') refuse('NOT_WAITING', MSG.NOT_WAITING, 422, 'status');
  const K = KIND[w.owner_kind];
  const ownerId = w.brand_id || w.influencer_id;
  const { rows: [o] } = await client.query(
    `SELECT id, user_id, wallet_balance, withdrawal_hold FROM ${K.table} WHERE id = $1 FOR UPDATE`, [ownerId]);
  return { w, o, K, ownerId };
}

function tell(userId, kind, title, body) {
  return notificationService.send({
    userId, type: `withdrawal.${kind}`, title, body, sendSms: false, data: { screen: 'wallet' },
  }).catch((e) => console.error('[NOTIFICATION] withdrawal failed:', e.message));
}

/**
 * AM3 — INFLX paid it from its bank; now it is recorded. Only here does the money leave the
 * person's total: the hold is taken. A bank reference is required.
 */
async function markProcessed(adminUserId, id, { reference, paidOn } = {}) {
  const ref = String(reference == null ? '' : reference).trim();
  if (!ref) refuse('VALIDATION_ERROR', MSG.REFERENCE, 422, 'reference');
  if (ref.length > 80) refuse('VALIDATION_ERROR', 'Keep the reference under 80 characters.', 422, 'reference');
  let day = null;
  if (paidOn != null && paidOn !== '') {
    const s = String(paidOn);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
    if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) refuse('VALIDATION_ERROR', 'Enter a valid paid-on date.', 422, 'paidOn');
    day = s;
  }
  const out = await db.withTransaction(async (client) => {
    const { w, o, K, ownerId } = await lockRequest(client, id);
    const amt = r2(w.amount);
    const { rowCount: took } = await client.query(
      `UPDATE ${K.table} SET withdrawal_hold = withdrawal_hold - $2 WHERE id = $1 AND withdrawal_hold >= $2`, [ownerId, amt]);
    if (took !== 1) throw new Error(`withdrawal ${id}: the hold does not cover ${amt}`);
    const { rowCount } = await client.query(
      `UPDATE withdrawal_requests SET status = 'processed', bank_reference = $2, paid_on = COALESCE($3::date, CURRENT_DATE),
              processed_at = now(), processed_by = $4 WHERE id = $1 AND status = 'requested'`, [id, ref, day, adminUserId]);
    if (rowCount !== 1) refuse('NOT_WAITING', MSG.NOT_WAITING, 422, 'status');
    await writeLedger(client, w.owner_kind, ownerId, 'withdrawal_paid', amt, 'debit', r2(o.wallet_balance), w.id, `Withdrawal processed · to ${w.payee_masked} · ref ${ref}`);
    return { w, userId: o.user_id, amt };
  });
  tell(out.userId, 'processed', 'Withdrawal processed', `${inr(out.amt)} was paid to ${out.w.payee_masked}. Reference ${ref}.`);
  return adminOne(id);
}

/** AM4 — it could not be paid. The hold goes back to Available; the reason is what she reads. */
async function couldNotProcess(adminUserId, id, { reason, reasonKind } = {}) {
  const why = String(reason == null ? '' : reason).trim();
  if (!why) refuse('VALIDATION_ERROR', MSG.REASON, 422, 'reason');
  if (why.length > 500) refuse('VALIDATION_ERROR', 'Keep it under 500 characters.', 422, 'reason');
  const out = await db.withTransaction(async (client) => {
    const { w, o, K, ownerId } = await lockRequest(client, id);
    const amt = r2(w.amount);
    const newAvailable = r2(Number(o.wallet_balance) + amt);
    const { rowCount: back } = await client.query(
      `UPDATE ${K.table} SET withdrawal_hold = withdrawal_hold - $2, wallet_balance = $3 WHERE id = $1 AND withdrawal_hold >= $2`,
      [ownerId, amt, newAvailable]);
    if (back !== 1) throw new Error(`withdrawal ${id}: the hold does not cover ${amt}`);
    const { rowCount } = await client.query(
      `UPDATE withdrawal_requests SET status = 'could_not_process', reason = $2, reason_kind = $3, processed_at = now(), processed_by = $4
        WHERE id = $1 AND status = 'requested'`, [id, why, reasonKind ? String(reasonKind).slice(0, 40) : null, adminUserId]);
    if (rowCount !== 1) refuse('NOT_WAITING', MSG.NOT_WAITING, 422, 'status');
    await writeLedger(client, w.owner_kind, ownerId, 'withdrawal_release', amt, 'credit', newAvailable, w.id, `Withdrawal not processed · back in Available · ${why}`);
    return { userId: o.user_id, amt };
  });
  tell(out.userId, 'could_not_process', 'Your withdrawal could not be processed', `${why} Your ${inr(out.amt)} is back in Available.`);
  return adminOne(id);
}

/* ───────────────────────────────────────────── Admin reads (AM2, AM3) */

const ADMIN_SQL = `
  SELECT w.*, COALESCE(b.business_name, i.full_name, u.name) AS owner_name,
         COALESCE(b.withdrawal_hold, i.withdrawal_hold) AS owner_hold,
         COALESCE(b.wallet_balance, i.wallet_balance) AS owner_available
    FROM withdrawal_requests w
    LEFT JOIN brands b ON b.id = w.brand_id
    LEFT JOIN influencers i ON i.id = w.influencer_id
    LEFT JOIN users u ON u.id = i.user_id`;

/** One request as Admin reads it — with the FULL account details, to pay from (AM3). */
function adminShape(w, { full = false } = {}) {
  const base = {
    ...shape(w), reference: w.bank_reference, reason: w.reason, reasonKind: w.reason_kind,
    ownerKind: w.owner_kind, ownerId: w.brand_id || w.influencer_id, ownerName: w.owner_name,
    payeeName: w.payee_name, ifsc: w.ifsc,
    onHold: r2(w.owner_hold), holdCovers: r2(w.owner_hold) >= r2(w.amount),
    waitingMinutes: w.status === 'requested' ? Math.max(0, Math.round((Date.now() - new Date(w.requested_at).getTime()) / 60000)) : null,
    late: w.status === 'requested' && (Date.now() - new Date(w.requested_at).getTime()) > Number(w.process_hours) * 3600000,
  };
  if (full) { base.account = safeDecrypt(w.account_enc); base.upi = safeDecrypt(w.upi_enc); }
  return base;
}

async function adminList({ status = 'requested', limit = 200 } = {}) {
  const st = ['requested', 'processed', 'could_not_process'].includes(status) ? status : 'requested';
  const { rows } = await db.query(
    `${ADMIN_SQL} WHERE w.status = $1 ORDER BY ${st === 'requested' ? 'w.requested_at ASC' : 'w.processed_at DESC'} LIMIT $2`,
    [st, Math.min(500, Number(limit) || 200)]);
  const { rows: counts } = await db.query(
    `SELECT status, count(*)::int AS n, COALESCE(sum(amount), 0)::float AS amount FROM withdrawal_requests GROUP BY 1`);
  return { status: st, testMode: testMode(), rows: rows.map((w) => adminShape(w)), counts: Object.fromEntries(counts.map((c) => [c.status, { n: c.n, amount: r2(c.amount) }])) };
}

async function adminOne(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))) refuse('NOT_FOUND', 'Not found', 404);
  const { rows: [w] } = await db.query(`${ADMIN_SQL} WHERE w.id = $1`, [id]);
  if (!w) refuse('NOT_FOUND', 'Not found', 404);
  return { ...adminShape(w, { full: true }), testMode: testMode() };
}

/**
 * Payments are in TEST MODE when the payment provider is simulated: money "added" to a wallet, and
 * every shopper's "payment", was never received by INFLX. Admin is told on every withdrawal screen,
 * because paying such a request from the bank would pay out money that never came in.
 */
function testMode() { return !!env.RAZORPAY_MOCK; }

module.exports = { options, request, listMine, markProcessed, couldNotProcess, adminList, adminOne, MSG, shape, testMode };
