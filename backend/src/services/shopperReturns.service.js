'use strict';

/**
 * shopperReturns.service.js — a shopper returns something she ordered through a creator's post.
 * Contract: features/shopper-walk-fixes · 01-spec.md W11, W13, W14 (founder, 4 Oct 2026:
 * "build return option for shopper as well").
 *
 * The rules, all of them already INFLX's (nothing new is invented here):
 *   · WHEN — only after delivery, and only inside INFLX's return window: delivered_at + the length
 *     stamped on the sale (returnWindow.service). One window for every brand and product.
 *   · WHAT — an item. A deal's items go back together and a gift follows what earned it: the same
 *     set a cancel takes (shopperOrders.cancelSet).
 *   · WHO DECIDES — INFLX's admin (the Returns page that has existed since migration 048): approve
 *     or reject; then "refunded" once the item is back. The brand sees it, and is told.
 *   · MONEY — while a return is open the sale's three shares wait (the money jobs already skip a sale
 *     with an open return). When it is refunded the item is undone exactly as a cancel undoes one:
 *     the creator's commission leaves her pending earnings, INFLX's share is not taken, the brand is
 *     not paid for it, the stock goes back; an online payment is refunded to where it came from.
 *     A cash-on-delivery order has no payment to send back: INFLX pays it by hand ('manual').
 *   · A rejected return changes nothing: the window carries on, and the shares are added when it closes.
 */

const crypto = require('crypto');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const pricing = require('./orderPricing.service');
const stock = require('./stock.service');
const rules = require('./offerRules');
const txService = require('./transaction.service');
const notificationService = require('./notification.service');
const returnWindow = require('./returnWindow.service');
const { appendInfluencerLedger } = require('./ledger.service');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const P = pricing.P;
const R = pricing.R;
const inr = rules.inr;
const notFound = () => new AppError('NOT_FOUND', 'Not found', 404);

// The reasons of migration 048, in the shopper's words.
const REASONS = [
  { key: 'wrong_size', label: "The size doesn't fit" },
  { key: 'damaged', label: 'It arrived damaged' },
  { key: 'not_as_described', label: "It isn't as shown" },
  { key: 'changed_mind', label: 'I changed my mind' },
  { key: 'other', label: 'Other' },
];
const REASON_LABEL = Object.fromEntries(REASONS.map((r) => [r.key, r.label]));
const OPEN = ['requested', 'approved', 'received'];
const STATE_WORD = { requested: 'Return requested', approved: 'Return approved', received: 'Return received', rejected: 'Return not accepted', refunded: 'Returned' };

const LINE_SQL = `
  SELECT l.*, o.order_status, o.payment_method, o.delivered_at,
         ft.created_at AS tx_created_at, ft.return_window_ends_at, ft.brand_settlement_status, ft.commission_confirmed_at
    FROM order_lines l
    JOIN follower_orders o ON o.id = l.order_id
    JOIN follower_transactions ft ON ft.id = l.transaction_id`;

/** When this item's return window closes: its delivery + the length stamped on its sale. */
function untilOf(r) {
  if (r.order_status !== 'delivered' || !r.delivered_at) return null;
  return returnWindow.closesAt({ created_at: r.tx_created_at, return_window_ends_at: r.return_window_ends_at }, r.delivered_at);
}
const windowWords = (r) => returnWindow.words(Math.max(1, Math.round(returnWindow.stampedMs({ created_at: r.tx_created_at, return_window_ends_at: r.return_window_ends_at }) / returnWindow.HOUR_MS)));

/** The latest return of each of these items: Map<lineId, row>. */
async function latestFor(lineIds, conn = db) {
  const out = new Map();
  if (!lineIds.length) return out;
  const { rows } = await conn.query(
    `SELECT DISTINCT ON (order_line_id) * FROM follower_returns
      WHERE order_line_id = ANY($1::uuid[]) ORDER BY order_line_id, created_at DESC, id`, [lineIds]);
  for (const r of rows) out.set(r.order_line_id, r);
  return out;
}

/** May she ask to return this item now? { can, until, why } — `why` only when it is worth saying. */
function eligibility(r, last, now = new Date()) {
  const until = untilOf(r);
  if (r.status !== 'active') return { can: false, until: null, why: null };
  if (r.role === 'gift') return { can: false, until, why: null };                        // a gift follows what earned it
  if (last && OPEN.includes(last.return_status)) return { can: false, until, why: null };
  if (!until) return { can: false, until: null, why: null };                             // not delivered yet
  if (now.getTime() > until.getTime()) return { can: false, until, why: `The return window (${windowWords(r)} from delivery) has closed.` };
  if (last && last.return_status === 'rejected') return { can: false, until, why: null };   // one answer per item
  return { can: true, until, why: null };
}

/** What a return says about itself on the shopper's order screen. */
function returnOut(last, line) {
  if (!last) return null;
  return {
    status: last.return_status, word: STATE_WORD[last.return_status] || last.return_status,
    reason: REASON_LABEL[last.reason] || last.reason, note: last.reason_text || null,
    inflx_note: last.return_status === 'rejected' ? last.admin_notes || null : null,
    requested_at: last.created_at, decided_at: last.reviewed_at || null, refunded_at: last.refunded_at || null,
    refund: last.return_status === 'refunded' && line ? { status: line.refund_status, amount: line.refund_amount == null ? null : Number(line.refund_amount) } : null,
  };
}

/** For the order screens: what to add to each item about returning. `rows` are LINE-shaped rows. */
async function decorate(rows) {
  const last = await latestFor(rows.map((r) => r.id));
  const out = new Map();
  for (const r of rows) {
    const mine = last.get(r.id) || null;
    const e = eligibility(r, mine);
    out.set(r.id, { can_return: e.can, return_until: e.until ? e.until.toISOString() : null, return_closed: e.why, return: returnOut(mine, r) });
  }
  return out;
}

async function ownLine(followerId, lineId, conn = db, { lock = false } = {}) {
  if (!UUID.test(String(lineId || ''))) throw notFound();
  const { rows } = await conn.query(`${LINE_SQL} WHERE l.id = $1${lock ? ' FOR UPDATE OF l' : ''}`, [lineId]);
  const line = rows[0];
  if (!line || line.follower_id !== followerId) throw notFound();
  return line;
}

function refuseUnless(line, last) {
  const e = eligibility(line, last);
  if (e.can) return e;
  if (line.status !== 'active') throw new AppError('CONFLICT', 'This item was cancelled.', 409, 'status');
  if (last && OPEN.includes(last.return_status)) throw new AppError('CONFLICT', 'You have already asked to return this.', 409, 'status');
  if (last && last.return_status === 'rejected') throw new AppError('CONFLICT', 'INFLX has already answered a return for this item.', 409, 'status');
  if (line.role === 'gift') throw new AppError('CONFLICT', 'A free gift goes back with the item it came with.', 409, 'status');
  if (!e.until) throw new AppError('CONFLICT', 'You can return it once it is delivered.', 409, 'status');
  throw new AppError('CONFLICT', e.why || 'The return window has closed.', 409, 'status');
}

/** What a return would take, and what comes back, before she confirms. */
async function preview(followerId, lineId) {
  const line = await ownLine(followerId, lineId);
  const last = (await latestFor([line.id])).get(line.id) || null;
  const e = refuseUnless(line, last);
  const set = await require('./shopperOrders.service').cancelSet(db, line, { lock: false });
  const paid = set.reduce((s, l) => s + P(l.paid_total), 0);
  const head = await require('./shopperOrders.service').dealHead(line);      // shopper-deal-orders (A): the deal's words, who it is from
  return {
    lines: set.map((l) => ({ id: l.id, name: l.name, size: l.size, colour: l.colour, qty: l.qty, image_url: l.image_url, role: l.role })),
    deal: head ? { line: head.line, creator: head.creator, brand: head.brand } : null,
    warning: set.length > 1 ? `This is part of a deal. Returning it returns ${set.length} items together.` : null,
    until: e.until.toISOString(), window: windowWords(line),
    refund: line.payment_method === 'cod'
      ? { amount: R(paid), text: `Refund of ${inr(R(paid))}. You paid cash, so INFLX sends it to you directly once the item is back.` }
      : { amount: R(paid), text: `Refund of ${inr(R(paid))} to your original payment method once the item is back.` },
    how: 'INFLX looks at every return. Once it is approved, the store collects the item; your refund follows when it is back.',
    reasons: REASONS,
  };
}

/** She asks to return an item. One request for everything that goes back with it. */
async function request({ followerId, lineId, reason, note = null }) {
  const why = String(reason || '').trim();
  if (!REASON_LABEL[why]) throw new AppError('VALIDATION_ERROR', 'Choose a reason', 400, 'reason');
  const text = String(note || '').trim().slice(0, 500) || null;
  if (why === 'other' && !text) throw new AppError('VALIDATION_ERROR', 'Write a note', 400, 'note');

  const out = await db.withTransaction(async (conn) => {
    const line = await ownLine(followerId, lineId, conn, { lock: true });
    const set = await require('./shopperOrders.service').cancelSet(conn, line);
    const last = await latestFor(set.map((l) => l.id), conn);
    refuseUnless(line, last.get(line.id) || null);
    if (set.some((l) => last.get(l.id) && OPEN.includes(last.get(l.id).return_status))) {
      throw new AppError('CONFLICT', 'You have already asked to return this.', 409, 'status');
    }
    const requestId = crypto.randomUUID();
    for (const l of set) {
      await conn.query(
        `INSERT INTO follower_returns (transaction_id, order_id, product_id, order_line_id, request_id, reason, reason_text, refund_amount)
         VALUES ($1, $2, $3, $4, $5, $6::return_reason, $7, $8)`,
        [l.transaction_id, l.order_id, l.product_id, l.id, requestId, why, text, l.paid_total]);
    }
    return { requestId, set, line };
  });

  await tell(out.requestId, 'requested').catch((e) => console.error('[returns] notify', e.message));
  return { request_id: out.requestId, status: 'requested', word: STATE_WORD.requested, lines: out.set.map((l) => l.id) };
}

/* ───────────────────────────────────────────── INFLX's admin: approve · reject · refunded */

async function rowsOfRequest(conn, returnId, { lock = false } = {}) {
  if (!UUID.test(String(returnId || ''))) return [];
  const { rows: [one] } = await conn.query(`SELECT id, request_id, order_line_id FROM follower_returns WHERE id = $1`, [returnId]);
  if (!one || !one.order_line_id) return [];
  const { rows } = await conn.query(
    `SELECT * FROM follower_returns WHERE request_id = $1 ORDER BY created_at, id${lock ? ' FOR UPDATE' : ''}`, [one.request_id]);
  return rows;
}

/** Is this return one of the new kind (an item of an order placed through a post)? */
async function isLineReturn(returnId) {
  if (!UUID.test(String(returnId || ''))) return false;
  const { rows: [r] } = await db.query(`SELECT order_line_id FROM follower_returns WHERE id = $1`, [returnId]);
  return !!(r && r.order_line_id);
}

/** Approve or reject every item of the request this return belongs to. */
async function decide(returnId, { approve, adminUserId, notes = null }) {
  const text = String(notes || '').trim().slice(0, 1000) || null;
  if (!approve && !text) throw new AppError('VALIDATION_ERROR', 'admin_notes is required when rejecting', 422, 'admin_notes');
  const done = await db.withTransaction(async (conn) => {
    const rows = await rowsOfRequest(conn, returnId, { lock: true });
    if (!rows.length || rows.some((r) => r.return_status !== 'requested')) throw new AppError('NOT_FOUND', 'Return not found or not in requestable state', 404);
    await conn.query(
      `UPDATE follower_returns SET return_status = $2::return_status, admin_notes = $3, reviewed_by_admin_id = $4, reviewed_at = now()
        WHERE request_id = $1 AND return_status = 'requested'`,
      [rows[0].request_id, approve ? 'approved' : 'rejected', text, adminUserId || null]);
    return rows;
  });
  await tell(done[0].request_id, approve ? 'approved' : 'rejected').catch((e) => console.error('[returns] notify', e.message));
  return { id: returnId, request_id: done[0].request_id, return_status: approve ? 'approved' : 'rejected', items: done.length,
    refund_amount: R(done.reduce((s, r) => s + P(r.refund_amount), 0)) };
}

/**
 * The item is back: undo it, exactly as a cancel undoes one, and send the money back.
 * @returns { id, request_id, return_status: 'refunded', refund: { amount, status } }
 */
async function complete(returnId, { adminUserId = null } = {}) {
  let refundAmount = 0; let paymentId = null; let online = false; let lineIds = []; let orderId = null; let requestId = null;
  await db.withTransaction(async (conn) => {
    const rows = await rowsOfRequest(conn, returnId, { lock: true });
    if (!rows.length || rows.some((r) => !['approved', 'received'].includes(r.return_status))) {
      throw new AppError('NOT_FOUND', 'Return not found or not in refundable state', 404);
    }
    requestId = rows[0].request_id;
    const { rows: lines } = await conn.query(
      `SELECT l.*, o.payment_method, c.razorpay_payment_id
         FROM order_lines l JOIN follower_orders o ON o.id = l.order_id JOIN checkouts c ON c.id = l.checkout_id
        WHERE l.id = ANY($1::uuid[]) AND l.status = 'active' ORDER BY l.created_at, l.id FOR UPDATE OF l`, [rows.map((r) => r.order_line_id)]);
    if (!lines.length) throw new AppError('CONFLICT', 'These items are no longer on the order.', 409, 'status');
    lineIds = lines.map((l) => l.id);
    orderId = lines[0].order_id;
    online = lines[0].payment_method !== 'cod';
    paymentId = lines[0].razorpay_payment_id;
    const sum = (k) => lines.reduce((s, l) => s + P(l[k]), 0);
    const paid = sum('paid_total');
    const reason = REASON_LABEL[rows[0].reason] || 'Returned';

    const { rows: [tx] } = await conn.query(`SELECT * FROM follower_transactions WHERE id = $1 FOR UPDATE`, [lines[0].transaction_id]);
    // An open return holds the sale's shares, so they are not in a wallet. If they somehow are, sending
    // the payment back too would leave INFLX out of pocket: stop, and let a person sort it out.
    if (tx.brand_settlement_status === 'settled' || tx.commission_confirmed_at) {
      throw new AppError('CONFLICT', 'This sale has already been added to the wallets. Correct it from Money before refunding.', 409, 'status');
    }

    await conn.query(
      `UPDATE order_lines SET status = 'cancelled', cancel_reason = $2, cancel_note = $3, cancelled_by = 'return', cancelled_at = now(),
              refund_amount = paid_total, refund_status = $4
        WHERE id = ANY($1::uuid[])`,
      [lineIds, reason, rows[0].reason_text, paid <= 0 ? 'not_needed' : online ? 'pending' : 'manual']);

    await stock.giveBack(conn, {
      products: lines.filter((l) => l.role !== 'gift' && l.product_id).map((l) => ({ product_id: l.product_id, colour: l.colour, size: l.size, qty: l.qty })),
      gifts: lines.filter((l) => l.role === 'gift').map((l) => ({ pool_item_id: l.pool_item_id, gift_item_id: l.gift_item_id, product_id: l.product_id, colour: l.colour, size: l.size, qty: l.qty })),
    });

    const c = sum('commission'); const f = sum('platform_fee'); const b = sum('brand_net');
    await conn.query(
      `UPDATE follower_transactions SET commission_reversed = COALESCE(commission_reversed,0) + $2,
              brand_net_reversed = COALESCE(brand_net_reversed,0) + $3, platform_fee_reversed = platform_fee_reversed + $4
        WHERE id = $1`, [tx.id, R(c), R(b), R(f)]);
    if (c > 0) {
      const { rows: [inf] } = await conn.query(
        `UPDATE influencers SET pending_balance = GREATEST(0, pending_balance - $1), total_earned = GREATEST(0, total_earned - $1)
          WHERE id = $2 RETURNING pending_balance AS bal`, [R(c), lines[0].influencer_id]);
      await appendInfluencerLedger({ client: conn, influencerId: lines[0].influencer_id, type: 'return_clawback', amount: R(c),
        direction: 'debit', balanceField: 'pending_balance', balanceAfter: inf ? Number(inf.bal) : null, source: 'order_return',
        sourceRefId: lines[0].id, note: `Returned by the shopper: ${reason}` });
    }
    const { rows: [left] } = await conn.query(`SELECT count(*)::int AS n FROM order_lines WHERE transaction_id = $1 AND status = 'active'`, [tx.id]);
    if (left.n === 0) {
      await conn.query(`UPDATE follower_transactions SET status = 'refunded', brand_settlement_status = 'reversed' WHERE id = $1 AND brand_settlement_status <> 'settled'`, [tx.id]);
    }
    for (const l of lines) {
      await conn.query(
        `UPDATE follower_returns SET return_status = 'refunded', refunded_at = now(), reversed_commission = $2, reversed_at = now(),
                reviewed_by_admin_id = COALESCE(reviewed_by_admin_id, $3)
          WHERE request_id = $1 AND order_line_id = $4`, [requestId, l.commission, adminUserId, l.id]);
    }
    // An item of the request that was cancelled meanwhile is closed with the rest.
    await conn.query(`UPDATE follower_returns SET return_status = 'refunded', refunded_at = now() WHERE request_id = $1 AND return_status <> 'refunded'`, [requestId]);
    refundAmount = paid;
  });

  // The refund, after the money rows are safe — as a cancel does it.
  let refund = { amount: R(refundAmount), status: refundAmount > 0 ? (online ? 'pending' : 'manual') : 'not_needed' };
  if (online && refundAmount > 0) {
    try {
      const id = await txService.refundPayment(paymentId, R(refundAmount), { order_id: orderId, reason: 'return' });
      await db.query(`UPDATE order_lines SET refund_status = 'issued', refund_id = $2 WHERE id = ANY($1::uuid[])`, [lineIds, id]);
      await db.query(`UPDATE follower_returns SET razorpay_refund_id = $2 WHERE request_id = $1`, [requestId, id]);
      refund = { amount: R(refundAmount), status: 'issued', id };
    } catch (e) {
      console.error(`[returns] REFUND FAILED for order ${orderId}: ${e.message}`);
      await db.query(`UPDATE order_lines SET refund_status = 'failed' WHERE id = ANY($1::uuid[])`, [lineIds]);
      refund = { amount: R(refundAmount), status: 'failed' };
    }
  }
  await tell(requestId, 'refunded', refund).catch((e) => console.error('[returns] notify', e.message));
  return { id: returnId, request_id: requestId, return_status: 'refunded', refunded_at: new Date().toISOString(), refund };
}

/* ───────────────────────────────────────────── telling people */

async function tell(requestId, what, refund = null) {
  const { rows } = await db.query(
    `SELECT l.id AS line_id, l.name, f.user_id AS shopper, b.user_id AS brand_user, fr.admin_notes,
            (SELECT count(*)::int FROM follower_returns x WHERE x.request_id = fr.request_id) AS n
       FROM follower_returns fr JOIN order_lines l ON l.id = fr.order_line_id
       JOIN followers f ON f.id = l.follower_id JOIN brands b ON b.id = l.brand_id
      WHERE fr.request_id = $1 ORDER BY fr.created_at, fr.id LIMIT 1`, [requestId]);
  const r = rows[0];
  if (!r) return;
  const what2 = `${r.name}${r.n > 1 ? ` and ${r.n - 1} more` : ''}`;
  const send = (userId, type, title, body) => notificationService.send({ userId, type, title, body, sendSms: false, data: { line_id: r.line_id, screen: 'order' } });
  if (what === 'requested') {
    await send(r.shopper, 'return_requested', 'Return requested', `INFLX is looking at your return of ${what2}.`);
    await send(r.brand_user, 'brand_return_requested', 'A shopper asked to return an item', `${what2}. INFLX decides; nothing is added to your wallet for it meanwhile.`);
    const { rows: admins } = await db.query(`SELECT id FROM users WHERE role = 'admin' AND status = 'approved'`).catch(() => ({ rows: [] }));
    for (const a of admins) await send(a.id, 'return.requested', 'New return request', `${what2} — open Returns to decide.`).catch(() => {});
  } else if (what === 'approved') {
    await send(r.shopper, 'return_approved', 'Return approved', `Your return of ${what2} is approved. The store will collect it; your refund follows when it is back.`);
    await send(r.brand_user, 'brand_return_approved', 'Return approved — collect the item', `INFLX approved the return of ${what2}. Collect it from the shopper and tell INFLX when it is back.`);
  } else if (what === 'rejected') {
    await send(r.shopper, 'return_rejected', 'Return not accepted', `INFLX did not accept the return of ${what2}${r.admin_notes ? `: ${r.admin_notes}` : '.'}`);
    await send(r.brand_user, 'brand_return_rejected', 'Return not accepted', `The return of ${what2} was not accepted. The sale stands.`);
  } else if (what === 'refunded') {
    const money = refund && refund.status === 'issued' ? ` Refund of ${inr(refund.amount)} is on its way.`
      : refund && refund.status === 'manual' ? ` INFLX will send your refund of ${inr(refund.amount)}.` : '';
    await send(r.shopper, 'return_refunded', 'Returned', `${what2} is returned.${money}`);
    await send(r.brand_user, 'brand_return_refunded', 'Item returned', `${what2} was returned. Nothing is added to your wallet for it; its stock is back.`);
  }
}

module.exports = { REASONS, REASON_LABEL, STATE_WORD, OPEN, eligibility, untilOf, decorate, preview, request, isLineReturn, decide, complete };
