'use strict';

/**
 * adminMoney.service.js — Admin's Money section, all in one place (item 17).
 * Contract: features/item17-wallet · master rules v1.31 §17A · board AM1–AM12
 *
 *   overview        what INFLX is holding and for whom; INFLX's own earnings; what needs doing
 *   balances        what INFLX owes each brand and creator, in their wallet's own figures
 *   person          one brand's or creator's whole money picture
 *   sales           every item sold and its three shares
 *   collaborations  locked money per collaboration, and what falls due
 *   added           every add-money order, and the credit-once repair of one the wallet missed
 *   movements       every rupee that moved, for anyone, in plain words
 *   corrections     the three by-hand tools — release a locked payment, return locked money,
 *                   correct a balance — each with a written reason, each recorded, and none of
 *                   them ever sending money to a bank: the wallet's owner still withdraws by request.
 *
 * Withdrawals (AM2–AM4) are withdrawalRequest.service. Taxes and invoices are a later round.
 */

const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const walletRead = require('./walletRead.service');
const withdrawals = require('./withdrawalRequest.service');
const ledgerService = require('./ledger.service');

const refuse = (code, message, status = 422, field = null) => { throw new AppError(code, message, status, field); };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasonOf = (raw) => {
  const why = String(raw == null ? '' : raw).trim();
  if (why.length < 5 || why.length > 500) refuse('VALIDATION_ERROR', 'Give a reason of at least 5 characters.', 422, 'reason');
  return why;
};
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const { IST_DAY_START: DAY0, IST_MONTH_START: MONTH0, COLLECTED } = walletRead;   // India's today / this month
// An add-money attempt that was started and never finished. Most are simply abandoned; one a brand
// really paid for can be checked and credited from Money added. Old ones drop out of the count.
const UNFINISHED = `status = 'created' AND created_at < now() - interval '15 minutes' AND created_at > now() - interval '7 days'`;
const offsetOf = (v) => { const o = Number(v); return Number.isFinite(o) ? Math.min(1000000, Math.max(0, Math.floor(o))) : 0; };
const tell = (userId, type, title, body) => require('./notification.service')
  .send({ userId, type, title, body, sendSms: false, data: { screen: 'wallet' } })
  .catch((e) => console.error('[NOTIFICATION] money correction failed:', e.message));

/* ───────────────────────────────────────────── AM1 — overview */

async function overview() {
  const w = await one(
    `SELECT (SELECT COALESCE(sum(wallet_balance), 0) FROM brands)::float      AS brand_available,
            (SELECT COALESCE(sum(withdrawal_hold), 0) FROM brands)::float     AS brand_hold,
            (SELECT COALESCE(sum(wallet_balance), 0) FROM influencers)::float AS creator_available,
            (SELECT COALESCE(sum(withdrawal_hold), 0) FROM influencers)::float AS creator_hold,
            (SELECT COALESCE(sum(amount), 0) FROM escrow_entries WHERE status IN ('locked', 'queued', 'processing'))::float AS locked,
            (SELECT COALESCE(sum(amount), 0) FROM escrow_entries WHERE status = 'queued' AND release_due_at <= now() + interval '7 days')::float AS due_7d,
            (SELECT count(*) FROM escrow_entries WHERE status = 'queued' AND release_due_at <= now() + interval '7 days')::int AS due_7d_n`);
  const s = await one(
    // Only money INFLX has COLLECTED is held: a cash order not yet delivered is in no figure here.
    `SELECT COALESCE(sum(ol.brand_net)    FILTER (WHERE ol.status = 'active' AND ft.brand_settlement_status = 'pending' AND ${walletRead.COLLECTED}), 0)::float AS brand_coming,
            COALESCE(sum(ol.commission)   FILTER (WHERE ol.status = 'active' AND ft.commission_confirmed_at IS NULL AND ${walletRead.COLLECTED}), 0)::float     AS creator_coming,
            COALESCE(sum(ol.platform_fee) FILTER (WHERE ol.status = 'active' AND ft.brand_settlement_status = 'pending' AND ${walletRead.COLLECTED}), 0)::float AS fee_in_window,
            COALESCE(sum(ol.platform_fee) FILTER (WHERE ol.status = 'active' AND ft.brand_settlement_status = 'settled'
                                                    AND ft.brand_settled_at >= ${MONTH0}), 0)::float               AS fee_earned_month
       FROM order_lines ol JOIN follower_transactions ft ON ft.id = ol.transaction_id
       JOIN follower_orders fo ON fo.id = ol.order_id WHERE ol.role = 'buy'`);
  const fees = await one(
    `SELECT COALESCE(sum(amount) FILTER (WHERE created_at >= ${MONTH0}), 0)::float AS campaign_fee_month
       FROM wallet_transactions WHERE type = 'platform_fee' AND direction = 'debit'`);
  const added = await one(
    `SELECT COALESCE(sum(amount) FILTER (WHERE created_at >= ${DAY0}), 0)::float AS today,
            count(*) FILTER (WHERE created_at >= ${DAY0})::int AS today_n,
            COALESCE(sum(amount) FILTER (WHERE created_at >= ${MONTH0}), 0)::float AS month
       FROM wallet_transactions WHERE type = 'topup' AND direction = 'credit'`);
  const wait = await one(
    `SELECT count(*)::int AS n, COALESCE(sum(amount), 0)::float AS amount, min(requested_at) AS oldest
       FROM withdrawal_requests WHERE status = 'requested'`);
  const notCredited = await one(
    `SELECT count(*)::int AS n FROM wallet_topup_orders WHERE ${UNFINISHED}`);

  const onHold = r2(w.brand_hold + w.creator_hold);
  const salesInWindow = r2(s.brand_coming + s.creator_coming);
  const parts = {
    brandAvailable: r2(w.brand_available), creatorAvailable: r2(w.creator_available),
    lockedInCollaborations: r2(w.locked), salesInReturnWindow: salesInWindow, onHoldForWithdrawals: onHold,
  };
  return {
    // What INFLX holds FOR OTHERS — its own share of sales is its earnings, shown apart.
    holding: r2(Object.values(parts).reduce((a, b) => a + b, 0)),
    parts,
    owedToBrands: r2(w.brand_available + w.brand_hold + s.brand_coming),
    owedToCreators: r2(w.creator_available + w.creator_hold + w.locked + s.creator_coming),
    earnings: {
      campaignFeesThisMonth: r2(fees.campaign_fee_month), salesFeesThisMonth: r2(s.fee_earned_month),
      thisMonth: r2(fees.campaign_fee_month + s.fee_earned_month), inReturnWindow: r2(s.fee_in_window),
    },
    withdrawalsWaiting: { count: wait.n, amount: r2(wait.amount), oldestAt: wait.oldest,
      oldestHours: wait.oldest ? Math.floor((Date.now() - new Date(wait.oldest).getTime()) / 3600000) : null },
    paymentsDue7Days: { amount: r2(w.due_7d), count: w.due_7d_n },
    moneyAdded: { today: r2(added.today), todayCount: added.today_n, thisMonth: r2(added.month), notCredited: notCredited.n },
    attention: [
      ...(wait.n ? [`${wait.n} withdrawal${wait.n > 1 ? 's are' : ' is'} waiting`] : []),
      ...(notCredited.n ? [`${notCredited.n} add-money payment${notCredited.n > 1 ? 's were' : ' was'} started and not finished`] : []),
    ],
    testMode: withdrawals.testMode(),
  };
}

/* ───────────────────────────────────────────── AM5, AM6 — balances */

async function balances({ kind = 'brands', q = '' } = {}) {
  const like = `%${String(q || '').trim().toLowerCase()}%`;
  if (kind === 'creators') {
    const { rows } = await db.query(
      `SELECT i.id, COALESCE(i.full_name, u.name) AS name, i.wallet_balance::float AS available, i.withdrawal_hold::float AS on_hold,
              COALESCE((SELECT sum(ee.amount) FROM escrow_entries ee JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
                         WHERE ci.influencer_id = i.id AND ee.status IN ('locked', 'queued', 'processing')), 0)::float AS payments,
              COALESCE((SELECT sum(ol.commission) FROM order_lines ol JOIN follower_transactions ft ON ft.id = ol.transaction_id
                         JOIN follower_orders fo ON fo.id = ol.order_id
                         WHERE ol.influencer_id = i.id AND ol.role = 'buy' AND ol.status = 'active' AND ft.commission_confirmed_at IS NULL AND ${walletRead.COLLECTED}), 0)::float AS commission
         FROM influencers i JOIN users u ON u.id = i.user_id
        WHERE lower(COALESCE(i.full_name, u.name, '')) LIKE $1
        ORDER BY (i.wallet_balance + i.withdrawal_hold) DESC, name LIMIT 300`, [like]);
    const list = rows.map((x) => ({ id: x.id, name: x.name, available: r2(x.available), onHold: r2(x.on_hold), payments: r2(x.payments),
      commission: r2(x.commission), total: r2(x.available + x.on_hold + x.payments + x.commission) })).filter((x) => x.total > 0 || q);
    return { kind: 'creators', rows: list };
  }
  const { rows } = await db.query(
    `SELECT b.id, b.business_name AS name, b.wallet_balance::float AS available, b.withdrawal_hold::float AS on_hold,
            COALESCE((SELECT sum(ee.amount) FROM escrow_entries ee JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
                        JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id
                       WHERE c.brand_id = b.id AND ee.status IN ('locked', 'queued', 'processing')), 0)::float AS locked,
            COALESCE((SELECT sum(ol.brand_net) FROM order_lines ol JOIN follower_transactions ft ON ft.id = ol.transaction_id
                       JOIN follower_orders fo ON fo.id = ol.order_id
                       WHERE ol.brand_id = b.id AND ol.role = 'buy' AND ol.status = 'active' AND ft.brand_settlement_status = 'pending' AND ${walletRead.COLLECTED}), 0)::float AS sales
       FROM brands b
      WHERE lower(COALESCE(b.business_name, '')) LIKE $1
      ORDER BY (b.wallet_balance + b.withdrawal_hold) DESC, name LIMIT 300`, [like]);
  const list = rows.map((x) => ({ id: x.id, name: x.name, available: r2(x.available), onHold: r2(x.on_hold), locked: r2(x.locked),
    salesComing: r2(x.sales), total: r2(x.available + x.on_hold + x.locked + x.sales) })).filter((x) => x.total > 0 || q);
  return { kind: 'brands', rows: list };
}

async function person(kind, id, { tab = 'history' } = {}) {
  if (!UUID.test(String(id || ''))) refuse('NOT_FOUND', 'Not found', 404);
  if (kind === 'brand') {
    const b = await one(`SELECT b.id, b.business_name AS name, b.bank_ifsc, (b.bank_account_no IS NOT NULL) AS has_bank, b.created_at, u.city
                           FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`, [id]);
    if (!b) refuse('NOT_FOUND', 'Not found', 404);
    const out = { kind, id, name: b.name, city: b.city || null, hasBank: b.has_bank, joinedAt: b.created_at, figures: await walletRead.brandSummary(id), tab };
    if (tab === 'collaborations') out.collaborations = (await walletRead.brandLocked(id));
    else if (tab === 'sales') out.sales = await walletRead.brandSales(id, { limit: 100 });
    else if (tab === 'withdrawals') out.withdrawals = (await db.query(`SELECT * FROM withdrawal_requests WHERE brand_id = $1 ORDER BY requested_at DESC LIMIT 100`, [id])).rows.map(withdrawals.shape);
    else out.history = await walletRead.brandHistory(id, { limit: 100 });
    return out;
  }
  if (kind === 'creator') {
    const i = await one(`SELECT i.id, COALESCE(i.full_name, u.name) AS name, u.city, i.created_at, (i.upi_id IS NOT NULL) AS has_upi, (i.bank_account_no IS NOT NULL) AS has_bank
                           FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`, [id]);
    if (!i) refuse('NOT_FOUND', 'Not found', 404);
    const out = { kind, id, name: i.name, city: i.city || null, hasUpi: i.has_upi, hasBank: i.has_bank, joinedAt: i.created_at, figures: await walletRead.creatorSummary(id), tab };
    if (tab === 'collaborations') out.collaborations = await walletRead.creatorPayments(id);
    else if (tab === 'sales') out.sales = await walletRead.creatorCommission(id, { limit: 100 });
    else if (tab === 'withdrawals') out.withdrawals = (await db.query(`SELECT * FROM withdrawal_requests WHERE influencer_id = $1 ORDER BY requested_at DESC LIMIT 100`, [id])).rows.map(withdrawals.shape);
    else out.history = await walletRead.creatorHistory(id, { limit: 100 });
    return out;
  }
  return refuse('NOT_FOUND', 'Not found', 404);
}

/* ───────────────────────────────────────────── AM7 — sales */

async function sales({ filter = 'all', limit, offset } = {}) {
  const t = await one(
    `SELECT COALESCE(sum(ol.paid_total), 0)::float AS paid, count(*)::int AS items,
            COALESCE(sum(ol.brand_net), 0)::float AS brand, COALESCE(sum(ol.commission), 0)::float AS creator, COALESCE(sum(ol.platform_fee), 0)::float AS inflx
       FROM order_lines ol JOIN follower_orders fo ON fo.id = ol.order_id
      WHERE ol.role = 'buy' AND ol.status = 'active' AND ol.created_at >= ${MONTH0} AND ${COLLECTED}`);
  return {
    month: { shoppersPaid: r2(t.paid), items: t.items, toBrands: r2(t.brand), toCreators: r2(t.creator), toInflx: r2(t.inflx) },
    sales: await walletRead.salesList('brand', 'TRUE', [], { filter, limit, offset }),
  };
}

/* ───────────────────────────────────────────── AM8 — collaboration money */

async function collaborations({ tab = 'locked' } = {}) {
  const all = await walletRead.collabMoneyFor('TRUE', []);
  const posted = new Map((await db.query(
    `SELECT campaign_influencer_id AS ci_id, posted_at, brand_reported_at FROM collab_content WHERE posted_at IS NOT NULL AND live_confirmed_at IS NULL`)).rows.map((x) => [x.ci_id, x]));
  const reported = new Set((await db.query(
    `SELECT campaign_influencer_id AS ci_id FROM collab_content WHERE brand_reported_at IS NOT NULL`)).rows.map((x) => x.ci_id));
  const rows = all.map((x) => ({ ...x, postedAt: (posted.get(x.ciId) || {}).posted_at || null, reported: reported.has(x.ciId) }));
  const week = Date.now() + 7 * 86400000;
  const pick = {
    locked: (x) => x.locked > 0,
    due: (x) => x.next && x.next.dueAt && new Date(x.next.dueAt).getTime() <= week,
    waiting: (x) => x.locked > 0 && x.next && x.next.kind === 'confirm_live',
    paid: (x) => x.locked === 0 && x.paid > 0,
  }[tab] || ((x) => x.locked > 0);
  const fees = await one(`SELECT COALESCE(sum(amount), 0)::float AS f FROM wallet_transactions WHERE type = 'platform_fee' AND direction = 'debit' AND created_at >= ${MONTH0}`);
  const due = rows.filter((x) => x.next && x.next.dueAt && new Date(x.next.dueAt).getTime() <= week);
  return {
    totals: {
      lockedNow: r2(rows.reduce((s, x) => s + x.locked, 0)), lockedCount: rows.filter((x) => x.locked > 0).length,
      paidToCreators: r2(rows.reduce((s, x) => s + x.paid, 0)),
      due7Days: r2(due.reduce((s, x) => s + x.next.amount, 0)), due7DaysCount: due.length,
      campaignFeesThisMonth: r2(fees.f),
    },
    tab, rows: rows.filter(pick),
  };
}

/* ───────────────────────────────────────────── AM9 — money added, and the repair */

async function added({ limit, offset } = {}) {
  const lim = Math.min(200, Math.max(1, Math.floor(Number(limit)) || 50)); const off = offsetOf(offset);
  const { rows } = await db.query(
    `SELECT o.order_id, o.brand_id, b.business_name AS brand_name, o.amount::float AS amount, o.status, o.payment_id, o.created_at, o.credited_at, o.credited_how
       FROM wallet_topup_orders o JOIN brands b ON b.id = o.brand_id ORDER BY o.created_at DESC LIMIT ${lim} OFFSET ${off}`);
  const t = await one(
    `SELECT COALESCE(sum(amount) FILTER (WHERE status = 'credited' AND credited_at >= ${DAY0}), 0)::float AS today,
            count(*) FILTER (WHERE status = 'credited' AND credited_at >= ${DAY0})::int AS today_n,
            COALESCE(sum(amount) FILTER (WHERE status = 'credited' AND credited_at >= ${MONTH0}), 0)::float AS month,
            count(*) FILTER (WHERE status = 'credited' AND credited_at >= ${MONTH0})::int AS month_n,
            count(*) FILTER (WHERE ${UNFINISHED})::int AS not_credited
       FROM wallet_topup_orders`);
  return {
    // checksPayment: in live mode the credit asks Razorpay that the order is PAID; in test mode nothing can be checked.
    checksPayment: !env.RAZORPAY_MOCK, testMode: withdrawals.testMode(),
    totals: { today: r2(t.today), todayCount: t.today_n, thisMonth: r2(t.month), thisMonthCount: t.month_n, notCredited: t.not_credited },
    rows: rows.map((o) => ({ orderId: o.order_id, brandId: o.brand_id, brandName: o.brand_name, amount: r2(o.amount), paymentId: o.payment_id,
      at: o.created_at, creditedAt: o.credited_at, creditedHow: o.credited_how, credited: o.status === 'credited', canCredit: o.status === 'created' })),
  };
}

/**
 * AM9 — a payment the bank received and the wallet did not get. Credited ONCE: the same
 * idempotent function the phone's verify uses, so a payment already credited moves nothing.
 * Live mode asks Razorpay that the order is PAID and takes its payment id from there.
 */
async function creditTopup(adminUserId, orderId, { reason, paymentId } = {}) {
  const why = reasonOf(reason);
  const ord = await one(`SELECT * FROM wallet_topup_orders WHERE order_id = $1`, [orderId]);
  if (!ord) refuse('NOT_FOUND', 'Not found', 404);
  if (ord.status === 'credited') refuse('ALREADY_CREDITED', 'This payment is already in the wallet.', 422, 'status');
  let payId = String(paymentId || '').trim() || null;
  let amount = r2(ord.amount);
  if (!env.RAZORPAY_MOCK) {
    const Razorpay = require('razorpay');
    const rzp = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
    const order = await rzp.orders.fetch(orderId).catch(() => null);
    if (!order || order.status !== 'paid') refuse('NOT_PAID', 'Razorpay does not show this order as paid.', 422, 'status');
    const notes = order.notes || {};
    if (notes.type !== 'wallet_topup' || notes.brand_id !== ord.brand_id) refuse('NOT_PAID', 'Razorpay does not show this as an add-money payment of this brand.', 422, 'status');
    const pays = await rzp.orders.fetchPayments(orderId).catch(() => ({ items: [] }));
    const captured = (pays.items || []).find((p) => p.status === 'captured');
    if (!captured) refuse('NOT_PAID', 'Razorpay shows no captured payment for this order.', 422, 'status');
    payId = captured.id;
    amount = r2(order.amount / 100);
  } else if (!payId) {
    payId = `pay_admin_${orderId}`;
  }
  const walletCtrl = require('../controllers/wallet.controller');
  const out = await walletCtrl.creditTopup({ brandId: ord.brand_id, orderId, paymentId: payId, amountRupees: amount, how: 'admin', adminUserId });
  if (!out.already_credited) {
    await db.query(
      `INSERT INTO money_corrections (kind, brand_id, amount, direction, reason, admin_user_id) VALUES ('credit_topup', $1, $2, 'credit', $3, $4)`,
      [ord.brand_id, amount, why, adminUserId]);
  }
  return { credited: !out.already_credited, wallet_balance: out.wallet_balance };
}

/* ───────────────────────────────────────────── AM10 — all movements */

const MOVE_GROUPS = ['added', 'collaborations', 'sales', 'withdrawals', 'courier', 'commission', 'corrections'];

async function movements({ q = '', group = 'all', limit, offset } = {}) {
  const lim = Math.min(200, Math.max(1, Math.floor(Number(limit)) || 50)); const off = offsetOf(offset);
  const like = `%${String(q || '').trim().toLowerCase()}%`;
  // The kind is filtered IN the query, before the page is cut — filtering the page afterwards
  // silently dropped older rows of the chosen kind.
  const g = MOVE_GROUPS.includes(group) ? group : 'all';
  const typesOf = (map) => Object.keys(map).filter((t) => g === 'all' || map[t].group === g);
  const brandTypes = typesOf(walletRead.BRAND_ROW);
  const creatorTypes = typesOf(walletRead.CREATOR_ROW);
  const { rows } = await db.query(
    `SELECT * FROM (
        -- The same joins the wallets' own History uses, so a row reads the same here as it does to its owner.
        SELECT wt.id, wt.created_at, 'brand' AS owner_kind, b.id AS owner_id, b.business_name AS owner_name,
               wt.type::text AS type, wt.amount::float AS amount, wt.direction::text AS direction, wt.notes AS note,
               c.name AS campaign_name, ee.tranche_number AS paid_n, COALESCE(pi.full_name, pu.name) AS paid_to,
               NULL::text AS brand_name, NULL::text AS item_name, NULL::text AS sale_brand,
               EXISTS (SELECT 1 FROM escrow_manual_releases emr WHERE emr.escrow_entry_id = ee.id) AS by_inflx
          FROM wallet_transactions wt JOIN brands b ON b.id = wt.brand_id
          LEFT JOIN campaigns c ON c.id = wt.campaign_id
          LEFT JOIN escrow_entries ee ON wt.type::text = 'payout' AND ee.id = wt.source_ref_id
          LEFT JOIN campaign_influencers pci ON pci.id = ee.campaign_influencer_id
          LEFT JOIN influencers pi ON pi.id = pci.influencer_id LEFT JOIN users pu ON pu.id = pi.user_id
         WHERE wt.type::text <> 'escrow_release' AND wt.type::text = ANY($2::text[])
        UNION ALL
        SELECT il.id, il.created_at, 'creator', i.id, COALESCE(i.full_name, u.name), il.type, il.amount::float, il.direction, il.note,
               c.name, ee.tranche_number, NULL::text, cb.business_name, ol.name, sb.business_name,
               EXISTS (SELECT 1 FROM escrow_manual_releases emr WHERE emr.escrow_entry_id = ee.id)
          FROM influencer_ledger il JOIN influencers i ON i.id = il.influencer_id JOIN users u ON u.id = i.user_id
          LEFT JOIN escrow_entries ee ON il.type = 'tranche_release' AND ee.id = il.source_ref_id
          LEFT JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
          LEFT JOIN campaign_sets cs ON cs.id = ci.set_id LEFT JOIN campaigns c ON c.id = cs.campaign_id
          LEFT JOIN brands cb ON cb.id = c.brand_id
          LEFT JOIN order_lines ol ON il.type = 'cancel_clawback' AND ol.id = il.source_ref_id
          LEFT JOIN follower_transactions ft ON il.type = 'commission_confirm' AND ft.id = il.source_ref_id
          LEFT JOIN brands sb ON sb.id = ft.brand_id
         WHERE il.type = ANY($3::text[]) AND il.balance_field = 'wallet_balance'
      ) m
      WHERE (lower(COALESCE(m.owner_name, '')) LIKE $1 OR lower(COALESCE(m.note, '')) LIKE $1
             OR lower(COALESCE(m.paid_to, '')) LIKE $1 OR lower(COALESCE(m.brand_name, '')) LIKE $1 OR lower(COALESCE(m.campaign_name, '')) LIKE $1)
      ORDER BY m.created_at DESC, m.id LIMIT ${lim} OFFSET ${off}`, [like, brandTypes, creatorTypes]);
  const brandMap = walletReadMaps().brand; const creatorMap = walletReadMaps().creator;
  const out = [];
  for (const m of rows) {
    const meta = (m.owner_kind === 'brand' ? brandMap : creatorMap)[m.type];
    if (!meta) continue;
    const sign = meta.sign == null ? (m.direction === 'credit' ? '+' : '−') : meta.sign;
    const words = m.owner_kind === 'brand' ? walletRead.brandWords({ ...m, notes: m.note }) : walletRead.creatorWords(m);
    out.push({ id: m.id, at: m.created_at, ownerKind: m.owner_kind, ownerId: m.owner_id, ownerName: m.owner_name,
      group: meta.group, label: words.label, note: words.sub, amount: r2(m.amount), sign });
  }
  return { rows: out, more: rows.length === lim };
}
// The label maps live with the wallet reads, so a person's history and Admin's list never differ.
function walletReadMaps() { return { brand: walletRead.BRAND_ROW, creator: walletRead.CREATOR_ROW }; }

/* ───────────────────────────────────────────── AM11 — disputes and corrections */

async function corrections() {
  const { rows } = await db.query(
    `SELECT mc.id, mc.kind, mc.amount::float AS amount, mc.direction, mc.reason, mc.created_at,
            b.business_name AS brand_name, COALESCE(i.full_name, iu.name) AS creator_name, au.name AS admin_name
       FROM money_corrections mc
       LEFT JOIN brands b ON b.id = mc.brand_id
       LEFT JOIN influencers i ON i.id = mc.influencer_id LEFT JOIN users iu ON iu.id = i.user_id
       LEFT JOIN users au ON au.id = mc.admin_user_id
      ORDER BY mc.created_at DESC LIMIT 200`);
  return { rows: rows.map((x) => ({ id: x.id, kind: x.kind, amount: r2(x.amount), direction: x.direction, reason: x.reason, at: x.created_at,
    brandName: x.brand_name, creatorName: x.creator_name, by: x.admin_name || 'Admin' })) };
}

async function ciContext(client, ciId) {
  if (!UUID.test(String(ciId || ''))) refuse('NOT_FOUND', 'Collaboration not found', 404);
  const { rows: [x] } = await client.query(
    `SELECT ci.id, ci.influencer_id, cs.campaign_id, c.brand_id, c.name AS campaign_name, COALESCE(i.full_name, u.name) AS creator_name,
            i.user_id AS creator_user_id, b.user_id AS brand_user_id, b.business_name AS brand_name
       FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = c.brand_id
       JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id WHERE ci.id = $1`, [ciId]);
  if (!x) refuse('NOT_FOUND', 'Collaboration not found', 404);
  return x;
}

/**
 * Release the NEXT locked payment of one collaboration into the Creator's wallet — INFLX settling
 * a dispute (she posted, the Brand never confirmed). Recorded twice: escrow_manual_releases
 * (item 12) and money_corrections (this section's list).
 *
 * `tranche` is the payment the admin was SHOWN. If that is no longer the next one — a second
 * click, a retry after a lost answer, another admin, or the Brand confirming meanwhile — nothing
 * is released: without it, the second request would quietly release the final 50% as well.
 *
 * The collaboration is kept in step with the money, through item 12's own functions:
 *   · the second 25%, WHEN SHE HAS POSTED and the Brand has neither confirmed nor reported — the
 *     case this tool exists for — is INFLX standing in for the Brand's confirmation
 *     (contentMoney.releaseSecond): paid, the content step marked live (confirmed by INFLX — the
 *     confirmer is left empty), and the final 50% queued with its stamped date, so the nightly job
 *     pays it and the collaboration completes the normal way.
 *   · the second 25% in ANY OTHER state (she has not posted; the Brand reported it; no content
 *     step) is money only: that payment is released and nothing is promised about the final 50%,
 *     which stays locked until INFLX releases or returns it here. (A queued final payment under a
 *     Brand's report would never be paid by the job, so none is queued.)
 *   · the final 50% → paid, and the collaboration completed (contentMoney.afterFinalPaid).
 */
async function releasePayment(adminUserId, { ciId, tranche, standIn: shown, reason } = {}) {
  const why = reasonOf(reason);
  const want = Number(tranche);
  if (![1, 2, 3].includes(want)) refuse('VALIDATION_ERROR', 'Choose the payment to release.', 422, 'tranche');
  const escrowService = require('./escrow.service');
  const contentMoney = require('./contentMoney.service');
  const out = await db.withTransaction(async (client) => {
    const x = await ciContext(client, ciId);
    // The same locks, in the same order, as the Brand's own confirmation: the content row, then
    // every escrow row of the collaboration.
    const { rows: [cc] } = await client.query(
      `SELECT id, posted_at, live_confirmed_at, brand_reported_at FROM collab_content WHERE campaign_influencer_id = $1 FOR UPDATE`, [ciId]);
    const t = await contentMoney.lockEscrow(client, ciId);
    const e = [1, 2, 3].map((n) => t[n]).find((r) => r && ['locked', 'queued'].includes(r.status));
    if (!e) refuse('NOTHING_LOCKED', 'Nothing is locked for this collaboration.', 422, 'ciId');
    if (Number(e.tranche_number) !== want) {
      refuse('PAYMENT_CHANGED', 'This collaboration\'s payments have changed since you opened it. Reload and check again.', 409, 'tranche');
    }
    const at = new Date();
    let extra = {};
    const standIn = e.tranche_number === 2 && e.status === 'locked' && t[1] && t[1].status === 'released' && t[3] && t[3].status === 'locked'
      && cc && cc.posted_at && !cc.live_confirmed_at && !cc.brand_reported_at;
    // The dialog told the admin whether this release also confirms her content as live (and so
    // starts the final 50%'s date). If she has posted, or the brand has reported, since the dialog
    // opened, the outcome would differ from what was read — so nothing moves.
    if (want === 2 && shown != null && Boolean(shown) !== Boolean(standIn)) {
      refuse('PAYMENT_CHANGED', 'This collaboration has changed since you opened it (she posted, or the brand reported it). Reload and check again.', 409, 'tranche');
    }
    if (standIn) {
      const m = await contentMoney.releaseSecond(client, { ciId, influencerId: x.influencer_id, brandId: x.brand_id, campaignId: x.campaign_id, at });
      const { rowCount } = await client.query(
        `UPDATE collab_content
            SET live_confirmed_at = $2, t2_released_at = $2, final_wait_days = $3, final_due_at = $4, updated_at = now()
          WHERE id = $1 AND live_confirmed_at IS NULL AND posted_at IS NOT NULL AND brand_reported_at IS NULL`, [cc.id, at, m.waitDays, m.dueAt]);
      if (rowCount !== 1) throw new Error(`adminMoney: ${ciId} content row changed under its own lock`);
      extra = { stoodIn: true, finalDueAt: m.dueAt };
    } else {
      await escrowService.processTrancheRelease(client, e.id, x.influencer_id, x.brand_id, x.campaign_id);
      if (e.tranche_number === 3) {
        const done = await contentMoney.afterFinalPaid(client, { ciId, campaignId: x.campaign_id }, cc || null);
        extra = { completed: done.completed };
      }
    }
    await client.query(
      `INSERT INTO escrow_manual_releases (escrow_entry_id, tranche_number, amount, admin_user_id, reason) VALUES ($1,$2,$3,$4,$5)`,
      [e.id, e.tranche_number, e.amount, adminUserId, why]);
    await client.query(
      `INSERT INTO money_corrections (kind, brand_id, influencer_id, campaign_influencer_id, amount, direction, reason, admin_user_id)
       VALUES ('release_payment', $1, $2, $3, $4, 'credit', $5, $6)`, [x.brand_id, x.influencer_id, ciId, e.amount, why, adminUserId]);
    return { released: r2(e.amount), tranche: e.tranche_number, to: x.creator_name, ...extra, _x: x };
  });
  const { _x: x, ...answer } = out;
  const amt = `₹${Number(answer.released).toLocaleString('en-IN')}`;
  tell(x.creator_user_id, 'wallet.released_by_inflx', 'A payment was added to your wallet',
    `INFLX released ${amt} from ${x.brand_name} (${x.campaign_name}) to your wallet.`);
  tell(x.brand_user_id, 'wallet.released_by_inflx', 'INFLX released a locked payment',
    `INFLX released ${amt} locked for ${x.creator_name} (${x.campaign_name}) to their wallet.${answer.stoodIn ? ' INFLX confirmed the content is live.' : ''}`);
  // The collaboration's own record says who did it (the same diary the Brand's confirmation writes to).
  require('./collabEvents.service').record({
    campaignInfluencerId: ciId, step: require('./collabEvents.service').STEP.GO_LIVE, actorRole: 'admin', actorUserId: adminUserId,
    action: answer.stoodIn ? 'confirmed_live' : 'payment_released', meta: { by_inflx: true, tranche: answer.tranche, amount: answer.released, reason: why },
  }).catch((e2) => console.error('[collab-events] money correction failed:', e2.message));
  return answer;
}

/**
 * Return what is still locked for one collaboration to the Brand's wallet — INFLX settling a
 * dispute (the Creator took the first payment and stopped). The rows become 'refunded' and can
 * never be released. The campaign fee was INFLX's at the lock and is not part of this.
 * `expected` is the amount the admin was shown; if what is locked has changed since, nothing moves.
 * What the collaboration itself ends as is the dispute's outcome (item 18), not decided here; the
 * Brand's "Confirm it's live" afterwards is refused in plain words (contentFlow.confirmLive).
 */
async function returnLocked(adminUserId, { ciId, expected, reason } = {}) {
  const why = reasonOf(reason);
  const contentMoney = require('./contentMoney.service');
  const out = await db.withTransaction(async (client) => {
    const x = await ciContext(client, ciId);
    await client.query(`SELECT id FROM collab_content WHERE campaign_influencer_id = $1 FOR UPDATE`, [ciId]);
    const t = await contentMoney.lockEscrow(client, ciId);
    const rows = [1, 2, 3].map((n) => t[n]).filter((r) => r && ['locked', 'queued'].includes(r.status));
    const total = r2(rows.reduce((s, e) => s + Number(e.amount), 0));
    if (!rows.length || total <= 0) refuse('NOTHING_LOCKED', 'Nothing is locked for this collaboration.', 422, 'ciId');
    if (expected != null && expected !== '' && Math.round(Number(expected) * 100) !== Math.round(total * 100)) {
      refuse('PAYMENT_CHANGED', 'What is locked for this collaboration has changed since you opened it. Reload and check again.', 409, 'expected');
    }
    await client.query(`UPDATE escrow_entries SET status = 'refunded' WHERE id = ANY($1::uuid[])`, [rows.map((e) => e.id)]);
    const { rows: [b] } = await client.query(
      `UPDATE brands SET wallet_balance = wallet_balance + $2 WHERE id = $1 RETURNING wallet_balance`, [x.brand_id, total]);
    await client.query(
      `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, campaign_id, notes, source_ref_id)
       VALUES ($1, 'refund', $2, 'credit', $3, $4, $5, $6)`,
      [x.brand_id, total, b.wallet_balance, x.campaign_id, `Locked money returned by INFLX · ${x.creator_name} (${x.campaign_name})`, ciId]);
    await require('./remoteMoney.service').settleDuesFromCredit(client, x.brand_id, total);
    await client.query(
      `INSERT INTO money_corrections (kind, brand_id, influencer_id, campaign_influencer_id, amount, direction, reason, admin_user_id)
       VALUES ('return_locked', $1, $2, $3, $4, 'credit', $5, $6)`, [x.brand_id, x.influencer_id, ciId, total, why, adminUserId]);
    return { returned: total, _x: x };
  });
  tell(out._x.brand_user_id, 'wallet.returned_by_inflx', 'Locked money was returned to your wallet',
    `INFLX returned ₹${Number(out.returned).toLocaleString('en-IN')} locked for ${out._x.creator_name} (${out._x.campaign_name}) to your wallet.`);
  return { returned: out.returned };
}

/** Add to or take from one wallet, to fix a mistake. Never below zero. */
async function correctBalance(adminUserId, { kind, id, amount, direction, reason } = {}) {
  const why = reasonOf(reason);
  const amt = r2(amount);
  if (!Number.isFinite(amt) || amt <= 0) refuse('VALIDATION_ERROR', 'Enter an amount.', 422, 'amount');
  if (amt > 10000000) refuse('VALIDATION_ERROR', 'That is too large for one correction (the most is ₹1,00,00,000).', 422, 'amount');
  if (!['credit', 'debit'].includes(direction)) refuse('VALIDATION_ERROR', 'Choose add or take.', 422, 'direction');
  if (!UUID.test(String(id || '')) || !['brand', 'creator'].includes(kind)) refuse('NOT_FOUND', 'Not found', 404);
  const table = kind === 'brand' ? 'brands' : 'influencers';
  return db.withTransaction(async (client) => {
    const { rows: [o] } = await client.query(`SELECT id, wallet_balance FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
    if (!o) refuse('NOT_FOUND', 'Not found', 404);
    const next = r2(Number(o.wallet_balance) + (direction === 'credit' ? amt : -amt));
    if (next < 0) refuse('INSUFFICIENT_BALANCE', 'That would take the balance below zero.', 422, 'amount');
    await client.query(`UPDATE ${table} SET wallet_balance = $2 WHERE id = $1`, [id, next]);
    if (kind === 'brand') {
      await client.query(
        `INSERT INTO wallet_transactions (brand_id, type, amount, direction, balance_after, notes) VALUES ($1, 'adjustment', $2, $3, $4, $5)`,
        [id, amt, direction, next, why]);
    } else {
      await ledgerService.appendInfluencerLedger({ client, influencerId: id, type: 'adjustment', amount: amt, direction,
        balanceField: 'wallet_balance', balanceAfter: next, source: 'correction', note: why });
    }
    await client.query(
      `INSERT INTO money_corrections (kind, ${kind === 'brand' ? 'brand_id' : 'influencer_id'}, amount, direction, reason, admin_user_id)
       VALUES ('correct_balance', $1, $2, $3, $4, $5)`, [id, amt, direction, why, adminUserId]);
    return { available: next };
  });
}

module.exports = {
  overview, balances, person, sales, collaborations, added, creditTopup, movements, corrections,
  releasePayment, returnLocked, correctBalance,
};
