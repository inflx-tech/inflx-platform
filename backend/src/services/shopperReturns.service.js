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
 *
 * shopper-deal-orders, part B (the founder's rules D2, D3, D5 of 5 Oct 2026; migration 204) — a
 * request has a KIND:
 *   return       the items go back and are refunded (everything above; a deal goes back whole)
 *   replace      ONE item of a deal is exchanged — another size, or the same item again. The deal
 *                stays and no money moves. INFLX approves (the replacement is taken from stock
 *                then); the brand brings it and collects the other (D5: at the brand's cost), marks
 *                it sent, then delivered. On delivery the item on her order becomes the new one, the
 *                request ends 'replaced', and the sale's return window runs again from that moment.
 *   refund_item  the store's fault (damaged, not as shown) and it has no more: only that item's
 *                share goes back, she keeps the rest. It is decided and completed exactly as a
 *                return of that one item.
 *   One replacement per item. A size that has no other size in stock is nobody's fault: she keeps
 *   it or returns the whole deal. A pair (buy one get one) has no one-item refund: it goes back whole.
 *   While any of the three is open the sale's shares wait — the money jobs skip a sale with an open request.
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
// What a request is called on her screens, by its kind and where it stands (board R8).
const KIND_WORD = {
  return: STATE_WORD,
  replace: { requested: 'Replacement requested', approved: 'Replacement approved', rejected: 'Replacement not accepted', replaced: 'Replaced' },
  refund_item: { requested: 'Refund requested', approved: 'Refund approved', received: 'Item received', rejected: 'Refund not accepted', refunded: 'One item refunded' },
};
const kindOf = (row) => (row && row.kind) || 'return';
const wordOf = (row) => (row.sold_out && row.return_status === 'rejected' ? 'Replacement sold out'
  : (KIND_WORD[kindOf(row)] || STATE_WORD)[row.return_status] || row.return_status);
// What can be wrong with ONE item (board R2). "I changed my mind" is not here: for that the whole deal goes back.
const ITEM_REASONS = REASONS.filter((r) => ['wrong_size', 'damaged', 'not_as_described'].includes(r.key));
const STORE_FAULT = ['damaged', 'not_as_described'];
// INFLX's one answer for an item: a one-item request it did not accept. (One that was closed because
// the replacement sold out is the stock's doing, not INFLX's answer — she may choose again.)
const isAnswer = (h) => kindOf(h) !== 'return' && h.return_status === 'rejected' && !h.sold_out;
const SOLD_OUT_NOTE = 'It sold out before it could be sent. You can choose another size, or return the whole deal.';
const IN_DEAL = /^(pair|set)-\d+$|^volume$/;        // the deals that are one (shopperOrders.TOGETHER)

const LINE_SQL = `
  SELECT l.*, o.order_status, o.payment_method, o.delivered_at,
         ft.created_at AS tx_created_at, ft.return_window_ends_at, ft.return_window_restart_at, ft.brand_settlement_status, ft.commission_confirmed_at
    FROM order_lines l
    JOIN follower_orders o ON o.id = l.order_id
    JOIN follower_transactions ft ON ft.id = l.transaction_id`;

/** When this item's return window closes: its delivery + the length stamped on its sale. */
function untilOf(r) {
  if (r.order_status !== 'delivered' || !r.delivered_at) return null;
  // E10: once a replacement has been delivered, the sale's window runs again from that delivery.
  const again = r.return_window_restart_at && new Date(r.return_window_restart_at).getTime() > new Date(r.delivered_at).getTime();
  return returnWindow.closesAt({ created_at: r.tx_created_at, return_window_ends_at: r.return_window_ends_at }, again ? r.return_window_restart_at : r.delivered_at);
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
  // One answer per item — for a return. A replacement or a one-item refund that INFLX did not
  // accept leaves the deal as delivered: she may still return the whole deal (E11).
  if (last && last.return_status === 'rejected' && kindOf(last) === 'return') return { can: false, until, why: null };
  return { can: true, until, why: null };
}

/** What a return says about itself on the shopper's order screen. */
function returnOut(last, line) {
  if (!last) return null;
  const kind = kindOf(last);
  return {
    kind,
    // A replacement: what she had, what she gets, and where it is (to_send · sent · delivered).
    replace: kind === 'replace' ? {
      name: line ? line.name : null,
      from: { colour: last.from_colour || null, size: last.from_size || null },
      to: { colour: last.to_colour || null, size: last.to_size || null },
      state: last.replacement_status || null,
      delivered_at: last.replacement_delivered_at || null,
    } : null,
    // A one-item refund: that item's share.
    amount: kind === 'refund_item' && last.refund_amount != null ? Number(last.refund_amount) : null,
    sold_out: !!last.sold_out,       // closed because the replacement sold out — she may choose again
    status: last.return_status, word: wordOf(last),
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
  if (last && last.return_status === 'rejected' && kindOf(last) === 'return') throw new AppError('CONFLICT', 'INFLX has already answered a return for this item.', 409, 'status');
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
  let soldOut = false;
  const done = await db.withTransaction(async (conn) => {
    const rows = await rowsOfRequest(conn, returnId, { lock: true });
    if (!rows.length || rows.some((r) => r.return_status !== 'requested')) throw new AppError('NOT_FOUND', 'Return not found or not in requestable state', 404);
    const sending = approve && kindOf(rows[0]) === 'replace';
    if (sending) {
      // The replacement is taken from stock NOW (not when she asked). If it sold out meanwhile there
      // is nothing to approve: the request is closed by the stock, she is told, and she may choose
      // again (it does not count as INFLX's answer for that item).
      const r0 = rows[0];
      const took = await stock.take(conn, { products: [{ product_id: r0.product_id, colour: r0.to_colour, size: r0.to_size, qty: 1 }] });
      if (!took.ok) {
        await conn.query(
          `UPDATE follower_returns SET return_status = 'rejected', sold_out = true, admin_notes = $2, reviewed_by_admin_id = $3, reviewed_at = now()
            WHERE request_id = $1 AND return_status = 'requested'`, [r0.request_id, SOLD_OUT_NOTE, adminUserId || null]);
        soldOut = true;
        return rows;
      }
    }
    await conn.query(
      `UPDATE follower_returns SET return_status = $2::return_status, admin_notes = $3, reviewed_by_admin_id = $4, reviewed_at = now(),
              replacement_status = CASE WHEN $5::boolean THEN 'to_send' ELSE replacement_status END
        WHERE request_id = $1 AND return_status = 'requested'`,
      [rows[0].request_id, approve ? 'approved' : 'rejected', text, adminUserId || null, sending]);
    return rows;
  });
  const ended = approve && !soldOut ? 'approved' : 'rejected';
  await tell(done[0].request_id, ended).catch((e) => console.error('[returns] notify', e.message));
  return { id: returnId, request_id: done[0].request_id, kind: kindOf(done[0]), return_status: ended, items: done.length,
    refund_amount: R(done.reduce((s, r) => s + P(r.refund_amount), 0)),
    ...(soldOut ? { sold_out: true, message: 'It sold out before it could be approved. The request is closed and the shopper has been told she can choose again.' } : {}) };
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
    // A replacement moves no money: there is nothing to refund. The brand marks it delivered.
    if (kindOf(rows[0]) === 'replace') throw new AppError('CONFLICT', 'A replacement has no refund. The store marks it sent, then delivered.', 409, 'kind');
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
            fr.kind, fr.from_colour, fr.from_size, fr.to_colour, fr.to_size, fr.refund_amount,
            (SELECT count(*)::int FROM follower_returns x WHERE x.request_id = fr.request_id) AS n
       FROM follower_returns fr JOIN order_lines l ON l.id = fr.order_line_id
       JOIN followers f ON f.id = l.follower_id JOIN brands b ON b.id = l.brand_id
      WHERE fr.request_id = $1 ORDER BY fr.created_at, fr.id LIMIT 1`, [requestId]);
  const r = rows[0];
  if (!r) return;
  const what2 = `${r.name}${r.n > 1 ? ` and ${r.n - 1} more` : ''}`;
  const send = (userId, type, title, body) => notificationService.send({ userId, type, title, body, sendSms: false, data: { line_id: r.line_id, screen: 'order' } });
  const admins = async (title, body) => {
    const { rows: as } = await db.query(`SELECT id FROM users WHERE role = 'admin' AND status = 'approved'`).catch(() => ({ rows: [] }));
    for (const a of as) await send(a.id, 'return.requested', title, body).catch(() => {});
  };
  if (kindOf(r) === 'replace') {
    const had = [r.from_colour, r.from_size].filter(Boolean).join(' · ');
    const gets = [r.to_colour, r.to_size].filter(Boolean).join(' · ');
    const swap = `${r.name}${gets ? ` · ${gets}` : ''}`;
    if (what === 'requested') {
      await send(r.shopper, 'replace_requested', 'Replacement requested', `INFLX is looking at your replacement of ${r.name}.`);
      await send(r.brand_user, 'brand_replace_requested', 'A shopper asked for a replacement', `${r.name}${had ? ` (${had})` : ''}. INFLX decides; you will be told if there is something to send.`);
      await admins('New replacement request', `${swap} — open Returns to decide.`);
    } else if (what === 'approved') {
      await send(r.shopper, 'replace_approved', 'Replacement approved', `The store will bring ${swap} and collect the other.`);
      await send(r.brand_user, 'brand_replace_approved', 'Replacement to send', `INFLX approved it. Send ${swap} and collect the other${had ? ` (${had})` : ''}. Open Order Fulfillment. Nothing is added to or taken from your wallet.`);
    } else if (what === 'rejected') {
      await send(r.shopper, 'replace_rejected', 'Replacement not accepted', `INFLX did not accept the replacement of ${r.name}${r.admin_notes ? `: ${r.admin_notes}` : '.'} Your order stays as it is.`);
      await send(r.brand_user, 'brand_replace_rejected', 'Replacement not accepted', `The replacement of ${r.name} was not accepted. There is nothing to send.`);
    } else if (what === 'replaced') {
      await send(r.shopper, 'replaced', 'Replaced', `${swap} is delivered. Your deal stays as it was.`);
    }
    return;
  }
  if (kindOf(r) === 'refund_item' && what !== 'refunded') {
    const amount = inr(Number(r.refund_amount) || 0);
    if (what === 'requested') {
      await send(r.shopper, 'refund_item_requested', 'Refund requested', `INFLX is looking at your refund of ${amount} for ${r.name}.`);
      await send(r.brand_user, 'brand_refund_item_requested', 'A shopper asked for a refund of one item', `${r.name}: it is not right and you have no more of it. INFLX decides; nothing is added to your wallet for the sale meanwhile.`);
      await admins('New one-item refund request', `${r.name} · ${amount} — open Returns to decide.`);
    } else if (what === 'approved') {
      await send(r.shopper, 'refund_item_approved', 'Refund approved', `The store will collect ${r.name}; your refund of ${amount} follows when it is back. You keep the rest of the deal.`);
      await send(r.brand_user, 'brand_refund_item_approved', 'Refund approved — collect the item', `INFLX approved a refund for ${r.name}. Collect it from the shopper and tell INFLX when it is back.`);
    } else if (what === 'rejected') {
      await send(r.shopper, 'refund_item_rejected', 'Refund not accepted', `INFLX did not accept the refund for ${r.name}${r.admin_notes ? `: ${r.admin_notes}` : '.'} Your order stays as it is.`);
      await send(r.brand_user, 'brand_refund_item_rejected', 'Refund not accepted', `The refund for ${r.name} was not accepted. The sale stands.`);
    }
    return;
  }
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

/* ───────────────────────────────────────────── one item of a deal is not right (part B) */

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const inStock = (v) => !!v && v.ok && (v.stock == null || Number(v.stock) >= 1);
/** One unit's share of what its item cost (an item of two carries two units). */
const unitShare = (l) => R(Math.round(P(l.paid_total) / Math.max(1, Number(l.qty) || 1)));
const isPair = (l) => /^pair-/.test(String(l.deal_key || ''));

/** Every request ever made for these items: Map<lineId, rows[]>, oldest first. */
async function historyFor(lineIds, conn = db) {
  const out = new Map(lineIds.map((id) => [id, []]));
  if (!lineIds.length) return out;
  const { rows } = await conn.query(`SELECT * FROM follower_returns WHERE order_line_id = ANY($1::uuid[]) ORDER BY created_at, id`, [lineIds]);
  for (const r of rows) if (out.has(r.order_line_id)) out.get(r.order_line_id).push(r);
  return out;
}

/** The items of this line's deal that are still on her order, oldest first. */
async function dealMates(line, conn = db, { lock = false } = {}) {
  const { rows } = await conn.query(
    `${LINE_SQL} WHERE l.transaction_id = $1 AND l.deal_key = $2 AND l.status = 'active' ORDER BY l.created_at, l.id${lock ? ' FOR UPDATE OF l' : ''}`,
    [line.transaction_id, line.deal_key]);
  return rows;
}

/** Is she inside the window for this delivered deal? Throws the sentence to show her when not. */
function insideWindow(line) {
  if (!IN_DEAL.test(String(line.deal_key || ''))) throw new AppError('CONFLICT', 'This item is not part of a deal. You can return it on its own.', 409, 'status');
  if (line.status !== 'active') throw new AppError('CONFLICT', 'This item was cancelled.', 409, 'status');
  const until = untilOf(line);
  if (!until) throw new AppError('CONFLICT', 'You can ask once it is delivered.', 409, 'status');
  if (Date.now() > until.getTime()) throw new AppError('CONFLICT', `The return window (${windowWords(line)} from delivery) has closed.`, 409, 'status');
  return until;
}

/**
 * What can be asked for ONE item (board R2–R5, R7):
 *   colours        its sizes — the one she has, and which others are in stock (E3: any size of the
 *                  same product, in the same or another colour)
 *   other_size     another size is in stock → "the size doesn't fit" can be replaced
 *   same_in_stock  the same item is in stock → a damaged one, or one not as shown, can be replaced
 *   refund         its share, when the store is at fault and has no more. Null for a pair: a pair
 *                  goes back together.
 *   replaced       it has been replaced once already (E2: one replacement per item)
 */
function itemChoices(l, product, rows, cod) {
  const replaced = rows.some((r) => kindOf(r) === 'replace' && r.return_status === 'replaced');
  const answered = rows.some(isAnswer);
  const onSale = !!product && product.is_active !== false && product.pushed_to_store !== false;
  const colours = onSale ? pricing.choicesOf(product).filter((c) => c.sizes.length).map((c) => ({
    colour: c.colour,
    sizes: c.sizes.map((s) => ({ size: s.size, current: same(c.colour, l.colour) && same(s.size, l.size), in_stock: s.stock == null || Number(s.stock) >= 1 })),
  })) : [];
  const share = unitShare(l);
  return {
    id: l.id, name: l.name, image_url: l.image_url, colour: l.colour, size: l.size, qty: l.qty, role: l.role,
    can: l.role !== 'gift' && !answered,
    why: answered ? 'INFLX has already answered a request for this item. You can still return the whole deal.' : null,
    replaced, pair: isPair(l), colours,
    other_size: !replaced && colours.some((c) => c.sizes.some((s) => !s.current && s.in_stock)),
    same_in_stock: !replaced && onSale && inStock(pricing.variantOf(product, l.colour, l.size)),
    refund: isPair(l) ? null : {
      amount: share,
      text: cod ? `Refund of ${inr(share)}. You paid cash, so INFLX sends it to you directly once the item is back.`
        : `Refund of ${inr(share)} to your original payment method once it is back.`,
    },
  };
}

/** "Return or replace" (R1): the deal, its items and what each can be asked, and the whole-deal return. */
async function replacePreview(followerId, lineId) {
  const line = await ownLine(followerId, lineId);
  const until = insideWindow(line);
  const head = await require('./shopperOrders.service').dealHead(line);
  const mates = await dealMates(line);
  const hist = await historyFor(mates.map((m) => m.id));
  if (mates.some((m) => hist.get(m.id).some((r) => OPEN.includes(r.return_status)))) {
    throw new AppError('CONFLICT', 'You have already asked about this deal. INFLX is looking at it.', 409, 'status');
  }
  const ids = [...new Set(mates.map((m) => m.product_id).filter(Boolean))];
  const { rows: prods } = ids.length ? await db.query(
    `SELECT id, name, price, variants_json, stock, is_active, pushed_to_store FROM brand_products WHERE id = ANY($1::uuid[])`, [ids]) : { rows: [] };
  const byId = new Map(prods.map((p) => [p.id, { ...p, price: Number(p.price) || 0 }]));
  const cod = line.payment_method === 'cod';
  const paid = mates.reduce((s, l) => s + P(l.paid_total), 0);
  const last = hist.get(line.id).slice(-1)[0] || null;
  return {
    deal: head ? { line: head.line, creator: head.creator, brand: head.brand } : null,
    until: until.toISOString(), window: windowWords(line),
    reasons: ITEM_REASONS,
    items: mates.filter((m) => m.role !== 'gift').map((m) => itemChoices(m, byId.get(m.product_id), hist.get(m.id), cod)),
    // "Return the whole deal" (R6) is today's return, asked on its own screen.
    whole: { can: eligibility(line, last).can, count: mates.reduce((s, l) => s + Number(l.qty), 0), amount: R(paid) },
  };
}

/**
 * An item of two (or more) of which ONE is asked about becomes its own item first. The split is
 * money-neutral — the two parts add up, to the paisa, to what the item was — and is kept even if
 * the request is then refused. Returns the item (row) the request is for.
 */
async function splitUnit(conn, lineId) {
  const { rows: [l] } = await conn.query(`SELECT * FROM order_lines WHERE id = $1 FOR UPDATE`, [lineId]);
  const q = Number(l.qty) || 1;
  if (q <= 1) return l;
  const one = {};
  for (const k of ['normal_total', 'paid_total', 'commission', 'platform_fee']) one[k] = Math.round(P(l[k]) / q);
  one.brand_net = one.paid_total - one.commission - one.platform_fee;
  const left = {};
  for (const k of ['normal_total', 'paid_total', 'commission', 'platform_fee', 'brand_net']) left[k] = P(l[k]) - one[k];
  await conn.query(
    `UPDATE order_lines SET qty = qty - 1, normal_total = $2, paid_total = $3, commission = $4, platform_fee = $5, brand_net = $6 WHERE id = $1`,
    [l.id, R(left.normal_total), R(left.paid_total), R(left.commission), R(left.platform_fee), R(left.brand_net)]);
  const unit = { ...l, qty: 1, normal_total: R(one.normal_total), paid_total: R(one.paid_total), commission: R(one.commission), platform_fee: R(one.platform_fee), brand_net: R(one.brand_net) };
  delete unit.id;
  const cols = Object.keys(unit);
  const { rows: [made] } = await conn.query(
    `INSERT INTO order_lines (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, cols.map((k) => unit[k]));
  return made;
}

/**
 * She asks about ONE item of a delivered deal. The server decides what it becomes, from the reason
 * and the stock at this moment:
 *   the size doesn't fit            → replace, with the size she chose (it must be in stock)
 *   damaged · not as shown          → replace with the same item when the store has one;
 *                                     otherwise a refund of that item's share (never for a pair)
 * `expect` is what her screen showed ('replace' | 'refund_item'): if the stock moved meanwhile and the
 * answer is now the other one, nothing is recorded and she is asked to look again.
 */
async function replaceRequest({ followerId, lineId, reason, colour = null, size = null, note = null, expect = null }) {
  const why = String(reason || '').trim();
  if (!ITEM_REASONS.some((r) => r.key === why)) throw new AppError('VALIDATION_ERROR', 'Choose what is wrong', 400, 'reason');
  const text = String(note || '').trim().slice(0, 500) || null;
  if (STORE_FAULT.includes(why) && !text) throw new AppError('VALIDATION_ERROR', 'Tell us what is wrong', 400, 'note');

  const out = await db.withTransaction(async (conn) => {
    const line = await ownLine(followerId, lineId, conn, { lock: true });
    if (line.role === 'gift') throw new AppError('CONFLICT', 'A free gift goes back with the item it came with.', 409, 'status');
    insideWindow(line);
    const mates = await dealMates(line, conn, { lock: true });
    const hist = await historyFor(mates.map((m) => m.id), conn);
    if (mates.some((m) => hist.get(m.id).some((r) => OPEN.includes(r.return_status)))) {
      throw new AppError('CONFLICT', 'You have already asked about this deal. INFLX is looking at it.', 409, 'status');
    }
    const { rows: [product] } = await conn.query(
      `SELECT id, name, price, variants_json, stock, is_active, pushed_to_store FROM brand_products WHERE id = $1`, [line.product_id]);
    const ch = itemChoices(line, product ? { ...product, price: Number(product.price) || 0 } : null, hist.get(line.id) || [], line.payment_method === 'cod');
    if (!ch.can) throw new AppError('CONFLICT', ch.why || 'This item cannot be asked about.', 409, 'status');

    let kind = null;
    let to = { colour: null, size: null };
    if (why === 'wrong_size') {
      if (ch.replaced) throw new AppError('CONFLICT', 'This item has already been replaced once. You can keep it, or return the whole deal.', 409, 'status');
      const row = ch.colours.find((c) => same(c.colour, colour)) || (ch.colours.length === 1 ? ch.colours[0] : null);
      const pick = row ? row.sizes.find((s) => same(s.size, size)) : null;
      if (!pick || pick.current) throw new AppError('VALIDATION_ERROR', 'Choose another size', 400, 'size');
      if (!pick.in_stock) throw new AppError('STOCK_UNAVAILABLE', 'That size has just sold out. Choose another.', 409, 'size');
      kind = 'replace'; to = { colour: row.colour, size: pick.size };
    } else if (ch.same_in_stock) {
      kind = 'replace'; to = { colour: line.colour, size: line.size };
    } else if (ch.refund) {
      kind = 'refund_item';
    } else {
      throw new AppError('CONFLICT', 'The store has no more of this, and a pair goes back together. You can return the whole deal.', 409, 'status');
    }
    if (expect && expect !== kind) throw new AppError('CONFLICT', 'This changed while you were choosing. Please look again.', 409, 'expect');

    const unit = await splitUnit(conn, line.id);
    const requestId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO follower_returns (transaction_id, order_id, product_id, order_line_id, request_id, reason, reason_text, refund_amount,
                                     kind, from_colour, from_size, to_colour, to_size)
       VALUES ($1, $2, $3, $4, $5, $6::return_reason, $7, $8, $9, $10, $11, $12, $13)`,
      [unit.transaction_id, unit.order_id, unit.product_id, unit.id, requestId, why, text, kind === 'refund_item' ? unit.paid_total : 0,
        kind, unit.colour, unit.size, kind === 'replace' ? to.colour : null, kind === 'replace' ? to.size : null]);
    return { requestId, kind, unitId: unit.id };
  });

  await tell(out.requestId, 'requested').catch((e) => console.error('[returns] notify', e.message));
  return { request_id: out.requestId, kind: out.kind, status: 'requested', word: KIND_WORD[out.kind].requested, line_id: out.unitId };
}

/**
 * For a deal's card and page (R8): its latest request — whichever of its items it was for — and
 * what can still be asked for the deal: return it whole, or say one item is not right.
 * `rows` are every item of the deal (LINE rows, cancelled ones too); `hist` is historyFor() of them.
 */
function dealState(rows, hist) {
  const all = rows.flatMap((r) => (hist.get(r.id) || []).map((h) => ({ h, r })));
  const latest = all.slice().sort((a, b) => new Date(b.h.created_at).getTime() - new Date(a.h.created_at).getTime())[0] || null;
  const active = rows.filter((r) => r.status === 'active');
  const first = active.find((r) => r.role !== 'gift') || null;
  const until = first ? untilOf(first) : null;
  const inside = !!until && Date.now() <= until.getTime();
  const open = all.some(({ h }) => OPEN.includes(h.return_status));
  const said = (r, test) => (hist.get(r.id) || []).some(test);
  const noReturn = first ? said(first, (h) => kindOf(h) === 'return' && h.return_status === 'rejected') : true;
  return {
    return: latest ? returnOut(latest.h, latest.r) : null,
    can_return: !!first && inside && !open && !noReturn,
    // One item can be asked about while some item has not had its one answer.
    can_replace: !!first && inside && !open && active.some((r) => r.role !== 'gift' && !said(r, isAnswer)),
    return_until: until ? until.toISOString() : null,
    return_closed: first && until && !inside ? `The return window (${windowWords(first)} from delivery) has closed.` : null,
  };
}

/* ───────────────────────────────────────────── the brand sends a replacement (R9) */

const SEND_WORD = { to_send: 'To send', sent: 'Sent', delivered: 'Delivered' };

/** The brand's replacements: what goes out, what comes back, to whom — newest first, those still to do on top. */
async function brandReplacements(brandId, { id = null } = {}) {
  const params = [brandId];
  if (id) params.push(id);
  const { rows } = await db.query(
    `SELECT fr.id, fr.replacement_status, fr.reason, fr.reason_text, fr.from_colour, fr.from_size, fr.to_colour, fr.to_size,
            fr.created_at, fr.reviewed_at, fr.replacement_sent_at, fr.replacement_delivered_at,
            l.id AS line_id, l.name, l.image_url, l.offer_id, l.deal_key,
            (SELECT COALESCE(sum(x.qty), 0)::int FROM order_lines x WHERE x.transaction_id = l.transaction_id AND x.deal_key = l.deal_key) AS deal_units,
            o.id AS order_id, o.address_snapshot, o.delivered_at,
            COALESCE(i.full_name, iu.name) AS creator_name, u.name AS shopper_name,
            bo.sub_type, bo.offer_config_json
       FROM follower_returns fr
       JOIN order_lines l ON l.id = fr.order_line_id
       JOIN follower_orders o ON o.id = l.order_id
       JOIN followers f ON f.id = l.follower_id JOIN users u ON u.id = f.user_id
       JOIN influencers i ON i.id = l.influencer_id JOIN users iu ON iu.id = i.user_id
       LEFT JOIN brand_offers bo ON bo.id = l.offer_id
      WHERE l.brand_id = $1 AND fr.kind = 'replace' AND fr.replacement_status IS NOT NULL${id ? ' AND fr.id = $2' : ''}
      ORDER BY (fr.replacement_status = 'delivered'), fr.reviewed_at DESC NULLS LAST, fr.id`, params);
  return rows.map((r) => ({
    id: r.id, line_id: r.line_id, order_id: r.order_id,
    status: r.replacement_status, status_word: SEND_WORD[r.replacement_status] || r.replacement_status,
    shopper: r.shopper_name, address: r.address_snapshot || null,
    send: { name: r.name, image_url: r.image_url, colour: r.to_colour, size: r.to_size },
    collect: { name: r.name, colour: r.from_colour, size: r.from_size },
    deal: r.sub_type ? rules.orderDealWords({ sub_type: r.sub_type, offer_config_json: r.offer_config_json }, r.deal_units) : null,
    creator: r.creator_name, order_delivered_at: r.delivered_at,
    reason: REASON_LABEL[r.reason] || r.reason, note: r.reason_text || null,
    approved_at: r.reviewed_at, sent_at: r.replacement_sent_at, delivered_at: r.replacement_delivered_at,
    // What the brand is told about money, in one sentence (D5: it brings it at its own cost).
    money: 'Nothing is added to or taken from your wallet for a replacement.',
  }));
}

/**
 * The brand marks a replacement sent, then delivered — like a parcel, forward only.
 * Delivered is the moment the exchange is real: the item on her order becomes the new one; what
 * came back returns to stock only when the reason was the size (a damaged item, or one not as shown,
 * is not put back on sale); the request ends 'replaced'; and the sale's return window runs again.
 */
async function setReplacementStatus({ brandId, returnId, status }) {
  if (!['sent', 'delivered'].includes(status)) throw new AppError('VALIDATION_ERROR', 'Mark it sent or delivered', 400, 'status');
  if (!UUID.test(String(returnId || ''))) throw notFound();
  let requestId = null;
  await db.withTransaction(async (conn) => {
    const { rows: [fr] } = await conn.query(
      `SELECT fr.* FROM follower_returns fr JOIN order_lines l ON l.id = fr.order_line_id
        WHERE fr.id = $1 AND l.brand_id = $2 AND fr.kind = 'replace' FOR UPDATE OF fr`, [returnId, brandId]);
    if (!fr) throw notFound();
    if (fr.return_status === 'replaced') throw new AppError('CONFLICT', 'This replacement is already delivered.', 409, 'status');
    if (fr.return_status !== 'approved') throw new AppError('CONFLICT', 'INFLX has not approved this replacement.', 409, 'status');
    requestId = fr.request_id;
    if (status === 'sent') {
      if (fr.replacement_status !== 'to_send') throw new AppError('CONFLICT', 'It is already marked sent.', 409, 'status');
      await conn.query(`UPDATE follower_returns SET replacement_status = 'sent', replacement_sent_at = now() WHERE id = $1`, [fr.id]);
      return;
    }
    if (fr.replacement_status !== 'sent') throw new AppError('CONFLICT', 'Mark it sent first.', 409, 'status');
    const { rows: [line] } = await conn.query(`SELECT * FROM order_lines WHERE id = $1 FOR UPDATE`, [fr.order_line_id]);
    await conn.query(`UPDATE order_lines SET colour = $2, size = $3 WHERE id = $1`, [line.id, fr.to_colour, fr.to_size]);
    if (fr.reason === 'wrong_size') {
      await stock.giveBack(conn, { products: [{ product_id: line.product_id, colour: fr.from_colour, size: fr.from_size, qty: 1 }] });
    }
    await conn.query(
      `UPDATE follower_returns SET return_status = 'replaced', replacement_status = 'delivered', replacement_delivered_at = now() WHERE id = $1`, [fr.id]);
    await conn.query(`UPDATE follower_transactions SET return_window_restart_at = now() WHERE id = $1`, [fr.transaction_id]);
  });
  if (status === 'delivered') await tell(requestId, 'replaced').catch((e) => console.error('[returns] notify', e.message));
  return (await brandReplacements(brandId, { id: returnId }))[0];
}

module.exports = {
  REASONS, REASON_LABEL, STATE_WORD, KIND_WORD, ITEM_REASONS, OPEN, eligibility, untilOf, decorate, returnOut, latestFor, historyFor, dealState,
  preview, request, isLineReturn, decide, complete,
  replacePreview, replaceRequest, splitUnit, brandReplacements, setReplacementStatus,
};
