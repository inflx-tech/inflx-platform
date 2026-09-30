'use strict';

/**
 * remoteMoney.service.js — every rupee item 11 moves, in one file.
 * Contract: features/item11-remote · gap report §7 · rules v1.27 §11.2 · approval Q4, §2.2, §2.3
 *
 * THE RULE THIS SERVICE EXISTS TO KEEP
 * **Shipping is the brand's cost alone, in both directions. Nothing is ever taken from the
 * collaboration's locked funds or charged to the Creator.** (§11.2.) Every function here moves
 * money in exactly one direction — out of, or back into, `brands.wallet_balance` — and not one
 * of them can reach `contracts.locked_amount`, `escrow_entries` or an influencer balance. That
 * is provable by reading this file, and it is proved by a test that snapshots all four before
 * and after a whole shoot with a return (check 29).
 *
 * HOW A LOCK WORKS HERE
 * Item 9 "locks" by DEBITING brands.wallet_balance and writing an escrow_lock audit row; the
 * Reserved figure on the wallet screen is derived by summing escrow_lock − escrow_release
 * (wallet.controller.js:66-78). A courier hold must NOT join that sum — Reserved means money
 * committed to CREATORS, and an escrow_release would also be written by the tranche machinery.
 * So item 11 has four values of its own:
 *
 *   courier_charge        a debit the brand will never see again (shipping, return-to-store,
 *                         weight, the settled return)
 *   courier_lock          the return price, held at booking so the return can always be paid for
 *   courier_lock_release  that hold coming back, in whole or in part
 *   courier_refund        a cancelled booking's outbound price coming back
 *
 * OWED (approval Q4, v1.27 §11.2)
 * A courier charge that arrives when the wallet is short is never refused and never chased: it
 * becomes a `brand_dues` row. It **blocks nothing, including a new booking**, and is taken
 * oldest-first from ANY money that next reaches the wallet — not only top-ups.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { MSG } = require('./productionCopy');

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/* ───────────────────────────────────────────────────── reading the balance */

/** The brand's AVAILABLE balance — what it can spend today. Locked inside a transaction. */
async function lockWallet(brandId, conn) {
  const { rows } = await conn.query(`SELECT wallet_balance FROM brands WHERE id = $1 FOR UPDATE`, [brandId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  return money(rows[0].wallet_balance);
}

const available = async (brandId, conn = db) =>
  money(((await conn.query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brandId])).rows[0] || {}).wallet_balance);

/** What this brand owes, oldest first. Shown on the wallet; never a blocker. */
async function openDues(brandId, conn = db) {
  const { rows } = await conn.query(
    `SELECT id, amount, reason, note, source_id, source_kind, created_at FROM brand_dues
      WHERE brand_id = $1 AND settled_at IS NULL ORDER BY created_at, id`, [brandId]);
  return rows.map((r) => ({ ...r, amount: money(r.amount) }));
}

const duesTotal = async (brandId, conn = db) =>
  money((await openDues(brandId, conn)).reduce((s, d) => s + d.amount, 0));

/* ───────────────────────────────────────────────────── the primitives */

/**
 * One debit + one audit row. The ONLY place `wallet_balance` goes down in item 11.
 * Refuses rather than going negative — every caller decides whether that is an error or a due.
 */
async function debit(conn, { brandId, amount, type, note, campaignId = null }) {
  const amt = money(amount);
  if (!(amt > 0)) return null;
  const balance = await lockWallet(brandId, conn);
  if (balance < amt) return { insufficient: true, available: balance, shortfall: money(amt - balance) };

  const after = money(balance - amt);
  await conn.query(`UPDATE brands SET wallet_balance = $2 WHERE id = $1`, [brandId, after]);
  const { rows } = await conn.query(
    `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, campaign_id, notes)
     VALUES ($1, $2, $3, 'debit', $4, $5, $6) RETURNING id`,
    [brandId, type, amt, after, campaignId, note]);
  return { ok: true, txId: rows[0].id, balanceAfter: after };
}

/** One credit + one audit row. Settles dues afterwards — see `credit`'s callers. */
async function creditRaw(conn, { brandId, amount, type, note, campaignId = null }) {
  const amt = money(amount);
  if (!(amt > 0)) return null;
  const balance = await lockWallet(brandId, conn);
  const after = money(balance + amt);
  await conn.query(`UPDATE brands SET wallet_balance = $2 WHERE id = $1`, [brandId, after]);
  const { rows } = await conn.query(
    `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, campaign_id, notes)
     VALUES ($1, $2, $3, 'credit', $4, $5, $6) RETURNING id`,
    [brandId, type, amt, after, campaignId, note]);
  return { ok: true, txId: rows[0].id, balanceAfter: after };
}

/* ───────────────────────────────────────────────────── owed (Q4) */

/**
 * Record what the brand could not pay. Never refused, never chased, never a blocker.
 */
async function recordDue(conn, { brandId, amount, reason, sourceId, note }) {
  const amt = money(amount);
  if (!(amt > 0)) return null;
  const { rows } = await conn.query(
    `INSERT INTO brand_dues (brand_id, amount, reason, source_kind, source_id, note)
     VALUES ($1, $2, $3, 'shipment', $4, $5) RETURNING *`,
    [brandId, amt, reason, sourceId || null, note || null]);
  return rows[0];
}

/**
 * ⭐ THE CREDIT HOOK (approval Q4).
 *
 * "Next money in" means EVERY credit to brands.wallet_balance, not only a top-up. Called from
 * each of them, inside the SAME transaction as the credit, so a settled due and the money that
 * settled it can never come apart.
 *
 * Oldest first, and only as far as the credit reaches: a ₹500 top-up against ₹180 + ₹400 owed
 * settles the ₹180 whole and leaves the ₹400 standing. Dues are never part-paid — splitting one
 * would turn a single courier charge into two rows that nothing can reconcile against the
 * aggregator's statement (approval Q8).
 *
 * @returns {{settled: Array, total: number}}
 */
async function settleDuesFromCredit(conn, brandId, creditAmount) {
  const dues = await openDues(brandId, conn);
  if (!dues.length) return { settled: [], total: 0 };

  let room = money(creditAmount);
  const settled = [];
  for (const d of dues) {
    // Cash-on-delivery dues (source_kind 'order', shopper-ordering) are taken from sales payouts,
    // never from the wallet.
    if (d.source_kind && d.source_kind !== 'shipment') continue;
    if (d.amount > room) continue;              // not enough left for THIS one; try the next
    const out = await debit(conn, {
      brandId, amount: d.amount, type: 'courier_charge',
      note: `Owed from a parcel — ${d.note || d.reason}`,
    });
    if (!out || out.insufficient) break;        // cannot happen after a credit, but never guess
    await conn.query(`UPDATE brand_dues SET settled_at = now(), settled_tx_id = $2 WHERE id = $1`, [d.id, out.txId]);
    settled.push({ id: d.id, amount: d.amount });
    room = money(room - d.amount);
  }
  return { settled, total: money(settled.reduce((s, x) => s + x.amount, 0)) };
}

/**
 * A credit, with the dues hook already applied. Every item 11 credit path uses this.
 * The top-up, sales-settlement and escrow-refund paths call `settleDuesFromCredit` directly
 * after their own credit, because they write their wallet rows in their own vocabulary.
 */
async function credit(conn, args) {
  const out = await creditRaw(conn, args);
  if (!out) return out;
  const dues = await settleDuesFromCredit(conn, args.brandId, args.amount);
  return { ...out, duesSettled: dues };
}

/* ───────────────────────────────────────────────────── D5, movement by movement */

/**
 * BOOKING (R6). The outbound price out, and the return price held — in ONE transaction, so the
 * brand is never left having paid for a parcel whose return could not be locked.
 *
 * Refused if short, with ONE TOTAL (§11.2: "the shortfall is shown as an amount"), never two
 * separate refusals the brand has to add up.
 */
async function bookingCharge(conn, { brandId, campaignId, outbound, returnHold, creatorName, shipmentId }) {
  const out = money(outbound);
  const hold = money(returnHold);
  const total = money(out + hold);

  const balance = await lockWallet(brandId, conn);
  if (balance < total) {
    const err = new AppError('WALLET_INSUFFICIENT', MSG.SHORT_BALANCE(fmt(money(total - balance))), 422, 'amount');
    err.details = { required: total, available: balance, shortfall: money(total - balance) };
    throw err;
  }

  const charged = await debit(conn, {
    brandId, campaignId, amount: out, type: 'courier_charge',
    note: `Shipping to ${creatorName}`,
  });
  let held = null;
  if (hold > 0) {
    held = await debit(conn, {
      brandId, campaignId, amount: hold, type: 'courier_lock',
      note: `Return pickup locked for ${creatorName}`,
    });
  }
  return { charged, held, total, outbound: out, returnHold: hold };
}

/** CANCEL BEFORE COLLECTION (R7). Both come back, and the list reopens. */
async function cancelRefund(conn, { brandId, campaignId, outbound, returnHold, creatorName }) {
  const a = await credit(conn, {
    brandId, campaignId, amount: outbound, type: 'courier_refund',
    note: `Cancelled parcel to ${creatorName}`,
  });
  const b = money(returnHold) > 0 ? await credit(conn, {
    brandId, campaignId, amount: returnHold, type: 'courier_lock_release',
    note: `Return lock released — parcel to ${creatorName} cancelled`,
  }) : null;
  return { refunded: a, released: b };
}

/** The whole hold back, unused: every Return became a Gift, or she marked them all missing. */
async function releaseHold(conn, { brandId, campaignId, amount, why }) {
  if (!(money(amount) > 0)) return null;
  return credit(conn, {
    brandId, campaignId, amount, type: 'courier_lock_release', note: why,
  });
}

/**
 * THE RETURN, SETTLED (R14) — and the case §7 of the gap report never covered.
 *
 * Release the whole hold, then charge what the return actually cost. When the actual is MORE
 * than was held, the difference comes out of available balance, and if THAT is short it becomes
 * a due (v1.27 §11.2, approval §2.2).
 *
 * ⚠️ HER PICKUP IS NEVER REFUSED OR DELAYED BECAUSE OF THIS. The money is settled after the
 * courier has the parcel; nothing here can reach back and stop her.
 */
async function settleReturn(conn, { brandId, campaignId, hold, actual, creatorName, shipmentId }) {
  const h = money(hold);
  const a = money(actual);

  if (h > 0) {
    await credit(conn, {
      brandId, campaignId, amount: h, type: 'courier_lock_release',
      note: `Return lock released for ${creatorName}`,
    });
  }

  let due = null;
  const charged = await debit(conn, {
    brandId, campaignId, amount: a, type: 'courier_charge',
    note: `Return pickup from ${creatorName}`,
  });
  if (charged && charged.insufficient) {
    due = await recordDue(conn, {
      brandId, amount: a, reason: 'return_overspend', sourceId: shipmentId,
      note: `Return pickup from ${creatorName} cost ${fmt(a)}, more than the ${fmt(h)} held`,
    });
  }
  return { released: h, charged: charged && charged.ok ? a : 0, due, unusedBack: money(Math.max(0, h - a)) };
}

/**
 * A COURIER CHARGE AFTER THE FACT (R15b) — a weight difference, or the return-to-store fee.
 * Debited with the courier's reason; recorded as owed when the balance is short.
 * It never blocks the creator, and it never blocks a booking.
 */
async function courierCharge(conn, { brandId, campaignId, amount, reason, note, shipmentId }) {
  const amt = money(amount);
  if (!(amt > 0)) return { charged: 0, due: null };
  const out = await debit(conn, { brandId, campaignId, amount: amt, type: 'courier_charge', note });
  if (out && out.ok) return { charged: amt, due: null, txId: out.txId };
  const due = await recordDue(conn, { brandId, amount: amt, reason, sourceId: shipmentId, note });
  return { charged: 0, due };
}

/**
 * What the brand has spent on this parcel, for R14's "courier charges" card. Read from the
 * wallet's own rows, not recomputed — so the card and the wallet history cannot disagree.
 */
async function chargesFor(campaignId, brandId, conn = db) {
  const { rows } = await conn.query(
    `SELECT type, direction, amount, notes, created_at
       FROM wallet_transactions
      WHERE brand_id = $1 AND campaign_id = $2
        AND type IN ('courier_charge', 'courier_lock', 'courier_lock_release', 'courier_refund')
      ORDER BY created_at, id`, [brandId, campaignId]);
  const sum = (t, d) => money(rows.filter((r) => r.type === t && r.direction === d)
    .reduce((s, r) => s + money(r.amount), 0));
  return {
    rows: rows.map((r) => ({ type: r.type, direction: r.direction, amount: money(r.amount), note: r.notes, at: r.created_at })),
    charged: sum('courier_charge', 'debit'),
    locked: sum('courier_lock', 'debit'),
    released: money(sum('courier_lock_release', 'credit') + sum('courier_refund', 'credit')),
  };
}

module.exports = {
  available, openDues, duesTotal, recordDue, settleDuesFromCredit,
  debit, credit, creditRaw, lockWallet,
  bookingCharge, cancelRefund, releaseHold, settleReturn, courierCharge, chargesFor,
  money, fmt,
};
