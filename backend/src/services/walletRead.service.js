'use strict';

/**
 * walletRead.service.js — what each Wallet screen shows (item 17).
 * Contract: features/item17-wallet · master rules v1.31 §17A · boards BW1–BW10, CW1–CW7, AM5–AM8
 *
 * READ ONLY. Every figure comes from its own source, never from a subtraction that could drift:
 *
 *   Brand    Available              brands.wallet_balance
 *            On hold                brands.withdrawal_hold           (a withdrawal waiting)
 *            Locked in collabs      escrow_entries not yet released  (per collaboration)
 *            Sales money coming     sales not yet settled            (her share, net of reversals)
 *   Creator  Available              influencers.wallet_balance
 *            On hold                influencers.withdrawal_hold
 *            Still to come          her escrow rows not yet released + commission not yet confirmed
 *
 * The Brand sees each sale's three shares; the Creator sees her commission alone and never who
 * bought (§17A). History is every movement in the person's own words — a ledger type never
 * reaches a screen.
 */

const db = require('../config/db');
const { istDayOf } = require('../utils/indiaDay');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'the creator';
const AIM = { engagement: 'Pay for Content', hybrid: 'Hybrid', conversion: 'Pay for Sale' };
// A page of a list. Anything that is not a sane number becomes the default — never a database error.
const page = (limit, offset) => {
  const o = Number(offset);
  return { limit: Math.min(100, Math.max(1, Math.floor(Number(limit)) || 30)), offset: Number.isFinite(o) ? Math.min(1000000, Math.max(0, Math.floor(o))) : 0 };
};
// "Today" and "this month" are India's, whatever clock the server keeps.
const IST_DAY_START = `(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
const IST_MONTH_START = `(date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;

/* ───────────────────────────────────────────── collaboration money (both sides, and Admin) */

const ESCROW_SQL = `
  SELECT ci.id AS ci_id, cs.id AS set_id, cs.name AS set_name, cs.goal, c.id AS campaign_id, c.name AS campaign_name,
         c.brand_id, b.business_name AS brand_name, ci.influencer_id, COALESCE(i.full_name, u.name) AS creator_name,
         con.campaign_fee_amount,
         json_agg(json_build_object('n', ee.tranche_number, 'amount', ee.amount, 'status', ee.status,
                                    'released_at', ee.released_at, 'due_at', ee.release_due_at) ORDER BY ee.tranche_number) AS tranches
    FROM escrow_entries ee
    JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = c.brand_id
    JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
    LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id`;
const ESCROW_GROUP = ` GROUP BY ci.id, cs.id, c.id, b.business_name, i.full_name, u.name, con.campaign_fee_amount`;

const TRANCHE_LABEL = { 1: 'At signing · 25%', 2: 'When confirmed live · 25%', 3: 'Final 50%' };

/** One collaboration's fixed money: the three payments, what is paid, what is still locked, what is next. */
function collabMoney(row) {
  const tr = (row.tranches || []).map((t) => ({
    n: t.n, label: TRANCHE_LABEL[t.n] || `Payment ${t.n}`, amount: r2(t.amount),
    status: t.status, paid: t.status === 'released', paidAt: t.status === 'released' ? t.released_at : null, dueAt: t.due_at || null,
  }));
  const open = tr.filter((t) => ['locked', 'queued', 'processing'].includes(t.status));
  const nxt = open[0] || null;
  let next = null;
  if (nxt) {
    next = { n: nxt.n, amount: nxt.amount, dueAt: nxt.dueAt,
      kind: nxt.dueAt ? 'date' : nxt.n === 2 ? 'confirm_live' : nxt.n === 3 ? 'after_live' : 'signing' };
  }
  return {
    ciId: row.ci_id, setId: row.set_id, setName: row.set_name, campaignId: row.campaign_id, campaignName: row.campaign_name,
    aim: row.goal, aimLabel: AIM[row.goal] || row.goal,
    brandId: row.brand_id, brandName: row.brand_name, influencerId: row.influencer_id, creatorName: row.creator_name,
    amount: r2(tr.reduce((s, t) => s + t.amount, 0)),
    paid: r2(tr.filter((t) => t.paid).reduce((s, t) => s + t.amount, 0)),
    locked: r2(open.reduce((s, t) => s + t.amount, 0)),
    refunded: r2(tr.filter((t) => t.status === 'refunded').reduce((s, t) => s + t.amount, 0)),
    campaignFee: r2(row.campaign_fee_amount),
    payments: tr, next,
  };
}

async function collabMoneyFor(where, params, conn = db) {
  const { rows } = await conn.query(`${ESCROW_SQL} WHERE ${where}${ESCROW_GROUP} ORDER BY max(con.brand_signed_at) DESC NULLS LAST, ci.id`, params);
  return rows.map(collabMoney);
}

/* ───────────────────────────────────────────── sales (per item sold) */

const SALE_SQL = `
  SELECT ol.id, ol.name, ol.image_url, ol.colour, ol.size, ol.qty, ol.role, ol.paid_total, ol.commission, ol.commission_pct,
         ol.platform_fee, ol.fee_pct, ol.brand_net, ol.status AS line_status, ol.created_at, ol.cancelled_at, ol.cancelled_by,
         ol.brand_id, ol.influencer_id, ol.campaign_influencer_id, ol.post_id,
         b.business_name AS brand_name, COALESCE(i.full_name, u.name) AS creator_name,
         cp.post_code, cp.caption, bo.name AS offer_name,
         fo.payment_method, fo.order_status, fo.delivered_at,
         ft.return_window_ends_at, ft.created_at AS tx_created_at, ft.brand_settlement_status, ft.brand_settled_at,
         ft.commission_confirmed_at, ft.status AS tx_status,
         c.name AS campaign_name, cs.name AS set_name
    FROM order_lines ol
    JOIN follower_transactions ft ON ft.id = ol.transaction_id
    JOIN follower_orders fo ON fo.id = ol.order_id
    JOIN brands b ON b.id = ol.brand_id
    JOIN influencers i ON i.id = ol.influencer_id JOIN users u ON u.id = i.user_id
    JOIN creator_posts cp ON cp.id = ol.post_id
    JOIN campaign_influencers ci ON ci.id = ol.campaign_influencer_id
    JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id
    LEFT JOIN brand_offers bo ON bo.id = ol.offer_id`;

/**
 * Where one sold item's money stands:
 *   cancelled · cod_waiting (cash, not delivered) · not_shipped · waiting_delivery · window · added.
 *
 * shopper-walk-fixes (W13, founder 4 Oct 2026): the return window runs FROM THE DELIVERY for every
 * order, paid online or in cash, with the length stamped on the sale. So until it is delivered there
 * is no date to show: it is waiting to be shipped, or waiting to be delivered.
 */
function saleState(s) {
  // shopper-walk-fixes (W14): an item the shopper returned is a cancelled line whose cancelled_by is 'return'.
  if (s.line_status === 'cancelled') return { state: s.cancelled_by === 'return' ? 'returned' : 'cancelled', until: null, at: s.cancelled_at };
  const cod = s.payment_method === 'cod';
  const delivered = s.order_status === 'delivered' && !!s.delivered_at;
  if (!delivered) {
    if (cod) return { state: 'cod_waiting', until: null, at: null };
    if (['confirmed', 'packed'].includes(s.order_status)) return { state: 'not_shipped', until: null, at: null };
    return { state: 'waiting_delivery', until: null, at: null };
  }
  const stamp = s.return_window_ends_at ? new Date(s.return_window_ends_at) : null;
  const until = stamp ? new Date(new Date(s.delivered_at).getTime() + Math.max(0, stamp.getTime() - new Date(s.tx_created_at).getTime())) : null;
  return { state: 'window', until, at: null };
}

function saleOut(s, side) {
  const base = saleState(s);
  const brandAdded = s.brand_settlement_status === 'settled';
  const creatorAdded = !!s.commission_confirmed_at;
  const added = side === 'creator' ? creatorAdded : brandAdded;
  const st = base.state === 'cancelled' || base.state === 'returned' ? base
    : added ? { state: 'added', until: null, at: side === 'creator' ? s.commission_confirmed_at : s.brand_settled_at } : base;
  const title = String(s.caption || '').split('\n').map((x) => x.trim()).find(Boolean) || s.offer_name || 'Post';
  const out = {
    id: s.id, item: s.name, qty: s.qty, colour: s.colour, size: s.size, gift: s.role !== 'buy' && r2(s.paid_total) === 0,
    soldAt: s.created_at, post: { id: s.post_id, code: s.post_code, title: title.length > 40 ? `${title.slice(0, 39)}…` : title },
    campaignName: s.campaign_name, setName: s.set_name, offerName: s.offer_name || null,
    cashOnDelivery: s.payment_method === 'cod', orderStatus: s.order_status, deliveredAt: s.delivered_at,
    state: st.state, windowUntil: st.until ? istDayOf(st.until) : null, at: st.at,
  };
  const cancelled = st.state === 'cancelled' || st.state === 'returned';
  if (side === 'creator') {
    // Her commission alone; never the buyer, never the other shares (§17A).
    return { ...out, brandName: s.brand_name, commissionPct: r2(s.commission_pct), commission: cancelled ? 0 : r2(s.commission) };
  }
  return {
    ...out, creatorName: s.creator_name, creatorFirst: first(s.creator_name), brandName: s.brand_name,
    paid: r2(s.paid_total), commissionPct: r2(s.commission_pct), feePct: r2(s.fee_pct),
    creatorShare: cancelled ? 0 : r2(s.commission), inflxShare: cancelled ? 0 : r2(s.platform_fee), brandShare: cancelled ? 0 : r2(s.brand_net),
  };
}

// Money INFLX actually holds for a sale: an online payment, or cash once the order is DELIVERED
// (W4). A cash order still on its way is listed, but it is not "coming" yet — nothing has been
// collected for it, so it is in no total and in nobody's "INFLX is holding".
const COLLECTED = `(fo.payment_method IS DISTINCT FROM 'cod' OR fo.order_status = 'delivered')`;
const SALE_FILTER = {
  coming: `ol.status = 'active' AND {ADDED} IS NOT TRUE AND ${COLLECTED}`,
  added: `ol.status = 'active' AND {ADDED}`,
  cancelled: `ol.status = 'cancelled'`,
  cod: `fo.payment_method = 'cod'`,
};
const addedSql = (side) => (side === 'creator' ? `(ft.commission_confirmed_at IS NOT NULL)` : `(ft.brand_settlement_status = 'settled')`);

async function salesList(side, where, params, { filter = 'all', limit, offset } = {}) {
  const p = page(limit, offset);
  const tpl = Object.prototype.hasOwnProperty.call(SALE_FILTER, filter) ? SALE_FILTER[filter] : null;   // an unknown word = all
  const f = tpl ? ` AND ${tpl.replace('{ADDED}', addedSql(side))}` : '';
  const { rows } = await db.query(
    `${SALE_SQL} WHERE ${where} AND ol.role = 'buy'${f} ORDER BY ol.created_at DESC, ol.id LIMIT ${p.limit} OFFSET ${p.offset}`, params);
  return rows.map((s) => saleOut(s, side));
}

/** Totals for one side's sales: still coming, added this month, how many. */
async function salesTotals(side, where, params) {
  const share = side === 'creator' ? 'ol.commission' : 'ol.brand_net';
  const added = addedSql(side);
  const at = side === 'creator' ? 'ft.commission_confirmed_at' : 'ft.brand_settled_at';
  const { rows: [t] } = await db.query(
    `SELECT COALESCE(sum(${share}) FILTER (WHERE ol.status = 'active' AND ${added} IS NOT TRUE AND ${COLLECTED}), 0)::float AS coming,
            count(*) FILTER (WHERE ol.status = 'active' AND ${added} IS NOT TRUE AND ${COLLECTED})::int AS coming_n,
            COALESCE(sum(${share}) FILTER (WHERE ol.status = 'active' AND ${added}), 0)::float AS added,
            COALESCE(sum(${share}) FILTER (WHERE ol.status = 'active' AND ${added} AND ${at} >= ${IST_MONTH_START}), 0)::float AS added_month,
            count(*) FILTER (WHERE ol.status = 'active')::int AS sales
       FROM order_lines ol JOIN follower_transactions ft ON ft.id = ol.transaction_id
       JOIN follower_orders fo ON fo.id = ol.order_id
      WHERE ${where} AND ol.role = 'buy'`, params);
  return { coming: r2(t.coming), comingCount: t.coming_n, added: r2(t.added), addedThisMonth: r2(t.added_month), sales: t.sales };
}

/* ───────────────────────────────────────────── Brand */

async function brandOf(userId) {
  const { rows: [b] } = await db.query(
    `SELECT id, business_name, wallet_balance, withdrawal_hold, (bank_account_no IS NOT NULL AND bank_ifsc IS NOT NULL) AS has_bank,
            bank_account_no, bank_ifsc, gstin FROM brands WHERE user_id = $1`, [userId]);
  return b || null;
}

/** BW1/BW2 — the four figures, each from its own source. */
async function brandSummary(brandId) {
  const { rows: [b] } = await db.query(`SELECT wallet_balance, withdrawal_hold FROM brands WHERE id = $1`, [brandId]);
  const locked = await collabMoneyFor(`c.brand_id = $1`, [brandId]);
  const sales = await salesTotals('brand', `ol.brand_id = $1`, [brandId]);
  const open = locked.filter((x) => x.locked > 0);
  return {
    available: r2(b.wallet_balance),
    onHold: r2(b.withdrawal_hold),
    locked: r2(open.reduce((s, x) => s + x.locked, 0)), lockedCount: open.length,
    salesComing: sales.coming, salesComingCount: sales.comingCount,
  };
}

/** BW3/BW4 — locked money, collaboration by collaboration. */
async function brandLocked(brandId) {
  const all = await collabMoneyFor(`c.brand_id = $1`, [brandId]);
  return {
    stillLocked: r2(all.reduce((s, x) => s + x.locked, 0)),
    paidSoFar: r2(all.reduce((s, x) => s + x.paid, 0)),
    collaborations: all.filter((x) => x.locked > 0),
    paidInFull: all.filter((x) => x.locked === 0 && x.paid > 0),
  };
}

/** BW5/BW6 — every sale and its three shares. */
async function brandSales(brandId, opts = {}) {
  return { totals: await salesTotals('brand', `ol.brand_id = $1`, [brandId]), sales: await salesList('brand', `ol.brand_id = $1`, [brandId], opts) };
}
async function brandSale(brandId, lineId) {
  const { rows } = await db.query(`${SALE_SQL} WHERE ol.id = $1 AND ol.brand_id = $2`, [lineId, brandId]);
  return rows[0] ? saleOut(rows[0], 'brand') : null;
}

/* history — a ledger type never reaches a screen, and neither does a ledger NOTE: the notes on
   older rows were written for engineers ("Tranche 1 released — payout tranche_1_…"). The line under
   each label is built here from what the row IS; only notes this item writes in plain words
   (a withdrawal's destination and reference, INFLX's reason for a correction) are shown. */
const PAYMENT_WORD = { 1: 'First 25% · at signing', 2: 'Second 25% · confirmed live', 3: 'Final 50%' };
const paymentOf = (note) => { const m = /tranche[ _]?(\d)/i.exec(String(note || '')); return m ? PAYMENT_WORD[m[1]] || null : null; };
// "Withdrawal processed · to ··4821 · ref X" → "To ··4821 · ref X"; "… · back in Available · why" → "why"
const afterHead = (note, head) => {
  const s = String(note || '');
  if (!s.startsWith(head)) return null;
  const rest = s.slice(head.length).replace(/^\s*·\s*/, '').trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
};
const WITHDRAWAL_SUB = {
  withdrawal_hold: (n) => afterHead(n, 'Withdrawal requested · on hold'),
  withdrawal_paid: (n) => afterHead(n, 'Withdrawal processed'),
  withdrawal_release: (n) => afterHead(n, 'Withdrawal not processed · back in Available'),
};
/** The line under a history label, in the reader's words. */
function subOf(type, note, campaignName = null) {
  if (WITHDRAWAL_SUB[type]) return WITHDRAWAL_SUB[type](note);
  if (type === 'adjustment') return note || null;
  if (type === 'payout' || type === 'tranche_release') return [paymentOf(note), campaignName].filter(Boolean).join(' · ') || null;
  if (type === 'refund' && String(note || '').startsWith('Locked money returned by INFLX')) return note;
  if (type === 'cancel_clawback') return /^Cancelled by /.test(String(note || '')) ? note : null;
  return campaignName || null;
}
// Who a brand's row is about, when the row says: signing writes "Locked for <name> (<campaign>)"
// and "INFLX campaign fee (8%) for <name>"; a payment names its escrow row (source_ref_id).
const lockedFor = (note) => { const m = /^Locked for (.+?)(?: \(.*\))?$/.exec(String(note || '')); return m ? m[1].trim() : null; };
const feeFor = (note) => { const m = /^INFLX campaign fee .*? for (.+)$/.exec(String(note || '')); return m ? m[1].trim() : null; };
const UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;                                   // an id where a name should be is not a name
const named = (n) => (n && !UUIDISH.test(n) ? n : null);
function brandWords(t) {
  const m = BRAND_ROW[t.type];
  if (t.type === 'escrow_lock') { const who = named(lockedFor(t.notes)); return { label: who ? `Locked for ${who}` : m.label, sub: t.campaign_name || null }; }
  if (t.type === 'platform_fee') { const who = named(feeFor(t.notes)); return { label: m.label, sub: [t.campaign_name, who].filter(Boolean).join(' · ') || null }; }
  if (t.type === 'payout') {
    const who = named(t.paid_to);
    // A payment INFLX released by hand says so — it was not "confirmed live" by the brand.
    const which = t.by_inflx && PAY_SHORT[t.paid_n] ? `${PAY_SHORT[t.paid_n]} · released by INFLX` : (PAYMENT_WORD[t.paid_n] || paymentOf(t.notes));
    return { label: who ? `Paid to ${who}` : m.label, sub: [which, t.campaign_name].filter(Boolean).join(' · ') || null };
  }
  return { label: m.label, sub: subOf(t.type, t.notes, t.campaign_name) };
}
const PAY_SHORT = { 1: 'First 25%', 2: 'Second 25%', 3: 'Final 50%' };
const PAY_WHY = { 1: 'at signing', 2: "they confirmed it's live", 3: 'the final payment' };
function creatorWords(t) {
  const m = CREATOR_ROW[t.type];
  if (t.type === 'tranche_release') {
    const n = t.paid_n || (/tranche[ _]?(\d)/i.exec(String(t.note || '')) || [])[1];
    if (n && t.brand_name) return { label: `${PAY_SHORT[n]} · ${t.brand_name}`, sub: [t.campaign_name, t.by_inflx ? 'released by INFLX' : PAY_WHY[n]].filter(Boolean).join(' · ') };
    return { label: m.label, sub: subOf(t.type, t.note) };
  }
  if (t.type === 'commission_confirm') return { label: m.label, sub: t.sale_brand || null };
  if (t.type === 'cancel_clawback') return { label: m.label, sub: [t.item_name, 'cancelled'].filter(Boolean).join(' · ') };
  return { label: m.label, sub: subOf(t.type, t.note) };
}

const BRAND_ROW = {
  topup:               { label: 'You added money', group: 'added', sign: '+' },
  escrow_lock:         { label: 'Locked for a collaboration', group: 'collaborations', sign: '−' },
  platform_fee:        { label: 'INFLX campaign fee', group: 'collaborations', sign: '−' },
  payout:              { label: 'Paid to the creator', group: 'collaborations', sign: '' },
  refund:              { label: 'Money returned to you', group: 'collaborations', sign: '+' },
  sale_settlement:     { label: 'Sales money added', group: 'sales', sign: '+' },
  withdrawal_hold:     { label: 'Withdrawal requested · on hold', group: 'withdrawals', sign: '−' },
  withdrawal_paid:     { label: 'Withdrawal processed', group: 'withdrawals', sign: '' },
  withdrawal_release:  { label: 'Withdrawal not processed · back in Available', group: 'withdrawals', sign: '+' },
  withdrawal:          { label: 'Withdrawal', group: 'withdrawals', sign: null },
  courier_charge:      { label: 'Courier charge', group: 'courier', sign: '−' },
  courier_lock:        { label: 'Held for the return shipping', group: 'courier', sign: '−' },
  courier_lock_release:{ label: 'Return shipping hold released', group: 'courier', sign: '+' },
  courier_refund:      { label: 'Courier refund', group: 'courier', sign: '+' },
  adjustment:          { label: 'Correction by INFLX', group: 'corrections', sign: null },
};
// 'escrow_release' is the bookkeeping half of a payout pair (the brand's balance does not move);
// the screen shows the payout once, as "Paid to the creator".
const BRAND_HIDDEN = ['escrow_release'];

async function brandHistory(brandId, { filter = 'all', limit, offset } = {}) {
  const p = page(limit, offset);
  const types = Object.keys(BRAND_ROW).filter((t) => filter === 'all' || filter == null || BRAND_ROW[t].group === filter);
  const { rows } = await db.query(
    `SELECT wt.id, wt.type::text AS type, wt.amount, wt.direction::text AS direction, wt.balance_after, wt.notes, wt.created_at,
            c.name AS campaign_name, ee.tranche_number AS paid_n, COALESCE(i.full_name, u.name) AS paid_to,
            EXISTS (SELECT 1 FROM escrow_manual_releases emr WHERE emr.escrow_entry_id = ee.id) AS by_inflx
       FROM wallet_transactions wt LEFT JOIN campaigns c ON c.id = wt.campaign_id
       LEFT JOIN escrow_entries ee ON wt.type::text = 'payout' AND ee.id = wt.source_ref_id
       LEFT JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
       LEFT JOIN influencers i ON i.id = ci.influencer_id LEFT JOIN users u ON u.id = i.user_id
      WHERE wt.brand_id = $1 AND wt.type::text = ANY($2::text[]) AND wt.type::text <> ALL($3::text[])
      ORDER BY wt.created_at DESC, wt.id LIMIT ${p.limit} OFFSET ${p.offset}`, [brandId, types, BRAND_HIDDEN]);
  return rows.map((t) => {
    const m = BRAND_ROW[t.type];
    const sign = m.sign == null ? (t.direction === 'credit' ? '+' : '−') : m.sign;
    const words = brandWords(t);
    return { id: t.id, at: t.created_at, group: m.group, label: words.label, sub: words.sub,
      amount: r2(t.amount), sign, moneyIn: sign === '+', availableAfter: t.balance_after == null ? null : r2(t.balance_after) };
  });
}

/* ───────────────────────────────────────────── Creator */

async function creatorOf(userId) {
  const { rows: [i] } = await db.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS name, i.wallet_balance, i.withdrawal_hold, i.pending_balance, i.total_earned,
            (i.upi_id IS NOT NULL) AS has_upi, (i.bank_account_no IS NOT NULL AND i.bank_ifsc IS NOT NULL) AS has_bank
       FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.user_id = $1`, [userId]);
  return i || null;
}

/** CW1/CW2 — Available, On hold, Still to come (its two kinds). */
async function creatorSummary(influencerId) {
  const { rows: [i] } = await db.query(`SELECT wallet_balance, withdrawal_hold FROM influencers WHERE id = $1`, [influencerId]);
  const pays = await collabMoneyFor(`ci.influencer_id = $1`, [influencerId]);
  const comm = await salesTotals('creator', `ol.influencer_id = $1`, [influencerId]);
  const open = pays.filter((x) => x.locked > 0);
  const payments = r2(open.reduce((s, x) => s + x.locked, 0));
  const dated = open.map((x) => x.next && x.next.dueAt).filter(Boolean).sort();
  return {
    available: r2(i.wallet_balance), onHold: r2(i.withdrawal_hold),
    stillToCome: r2(payments + comm.coming),
    payments, paymentsCount: open.length, nextPaymentAt: dated[0] || null,
    commission: comm.coming, commissionCount: comm.comingCount,
  };
}

/** CW3 — her collaboration payments, with their dates. */
async function creatorPayments(influencerId) {
  const all = await collabMoneyFor(`ci.influencer_id = $1`, [influencerId]);
  return {
    stillToCome: r2(all.reduce((s, x) => s + x.locked, 0)),
    received: r2(all.reduce((s, x) => s + x.paid, 0)),
    // The campaign fee is the brand's alone and never reaches her screen (§3).
    collaborations: all.filter((x) => x.locked > 0 || x.paid > 0).map(({ campaignFee, ...x }) => x),
  };
}

/** CW4 — commission per collaboration and per sale. */
async function creatorCommission(influencerId, opts = {}) {
  const totals = await salesTotals('creator', `ol.influencer_id = $1`, [influencerId]);
  return { totals: { inWindow: totals.coming, added: totals.added, sales: totals.sales }, sales: await salesList('creator', `ol.influencer_id = $1`, [influencerId], opts) };
}

const CREATOR_ROW = {
  tranche_release:        { label: 'Collaboration payment', group: 'collaborations', sign: '+' },
  commission_confirm:     { label: 'Commission added', group: 'commission', sign: '+' },
  referral_accrual:       { label: 'Referral earning', group: 'commission', sign: '+' },
  cancel_clawback:        { label: 'Commission taken back', group: 'commission', sign: '−' },
  order_cancelled:        { label: 'Commission taken back', group: 'commission', sign: '−' },
  brand_order_cancelled:  { label: 'Commission taken back', group: 'commission', sign: '−' },
  return_clawback:        { label: 'Commission taken back', group: 'commission', sign: '−' },
  withdrawal_hold:        { label: 'Withdrawal requested · on hold', group: 'withdrawals', sign: '−' },
  withdrawal_paid:        { label: 'Withdrawal processed', group: 'withdrawals', sign: '' },
  withdrawal_release:     { label: 'Withdrawal not processed · back in Available', group: 'withdrawals', sign: '+' },
  withdrawal:             { label: 'Withdrawal', group: 'withdrawals', sign: '−' },
  withdrawal_reversal:    { label: 'Withdrawal returned', group: 'withdrawals', sign: '+' },
  adjustment:             { label: 'Correction by INFLX', group: 'corrections', sign: null },
};

async function creatorHistory(influencerId, { filter = 'all', limit, offset } = {}) {
  const p = page(limit, offset);
  const types = Object.keys(CREATOR_ROW).filter((t) => filter === 'all' || filter == null || CREATOR_ROW[t].group === filter);
  // The wallet's own movements. A commission still in its window is not money in her wallet yet,
  // so its pending credit is not a history row — it is on the Commission screen.
  const { rows } = await db.query(
    `SELECT il.id, il.type, il.amount, il.direction, il.balance_field, il.balance_after, il.note, il.created_at,
            ee.tranche_number AS paid_n, c.name AS campaign_name, b.business_name AS brand_name,
            ol.name AS item_name, sb.business_name AS sale_brand,
            EXISTS (SELECT 1 FROM escrow_manual_releases emr WHERE emr.escrow_entry_id = ee.id) AS by_inflx
       FROM influencer_ledger il
       LEFT JOIN escrow_entries ee ON il.type = 'tranche_release' AND ee.id = il.source_ref_id
       LEFT JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
       LEFT JOIN campaign_sets cs ON cs.id = ci.set_id LEFT JOIN campaigns c ON c.id = cs.campaign_id
       LEFT JOIN brands b ON b.id = c.brand_id
       LEFT JOIN order_lines ol ON il.type = 'cancel_clawback' AND ol.id = il.source_ref_id
       LEFT JOIN follower_transactions ft ON il.type = 'commission_confirm' AND ft.id = il.source_ref_id
       LEFT JOIN brands sb ON sb.id = ft.brand_id
      WHERE il.influencer_id = $1 AND il.type = ANY($2::text[])
        -- History is the WALLET's movements. A commission taken back while it was still pending
        -- never was in her wallet (its pending credit is not shown either); it is on the Commission
        -- screen, where the sale reads "cancelled".
        AND il.balance_field = 'wallet_balance'
      ORDER BY il.created_at DESC, il.id LIMIT ${p.limit} OFFSET ${p.offset}`, [influencerId, types]);
  return rows.map((t) => {
    const m = CREATOR_ROW[t.type];
    const sign = m.sign == null ? (t.direction === 'credit' ? '+' : '−') : m.sign;
    const words = creatorWords(t);
    return { id: t.id, at: t.created_at, group: m.group, label: words.label, sub: words.sub,
      amount: r2(t.amount), sign, moneyIn: sign === '+', availableAfter: t.balance_field === 'wallet_balance' && t.balance_after != null ? r2(t.balance_after) : null };
  });
}

module.exports = {
  brandOf, brandSummary, brandLocked, brandSales, brandSale, brandHistory,
  creatorOf, creatorSummary, creatorPayments, creatorCommission, creatorHistory,
  collabMoneyFor, collabMoney, salesList, salesTotals, saleOut, SALE_SQL, ESCROW_SQL, ESCROW_GROUP, AIM,
  BRAND_ROW, CREATOR_ROW, subOf, COLLECTED, brandWords, creatorWords, IST_DAY_START, IST_MONTH_START,
};
