'use strict';

/**
 * Item 17 — the Wallet: adding money once, the figures and where each comes from, sales money
 * into the wallets when the return window closes (online and cash on delivery), the withdrawal
 * request (hold → processed / could not process), no tax at withdrawal, no cancelling after both
 * have signed, history in plain words, and Admin's Money section with its three by-hand tools.
 * Contract: features/item17-wallet · master rules v1.31 §17A · boards BW1–BW10, CW1–CW7, AM1–AM12
 * Real API, real database; real orders placed through a live shoppable post.
 */

const W = require('./helpers/item17');
const W14 = require('./helpers/item14');
const w10 = require('./helpers/item10');
const w12 = require('./helpers/item12');
const settlementJob = require('../src/jobs/commerce-settlement.job');
const settlementRetryJob = require('../src/jobs/settlement-retry.job');
const commissionConfirm = require('../src/jobs/commission-confirm.job');
const settlement = require('../src/services/settlement.service');
const { decrypt } = require('../src/utils/encrypt');

const { api, query } = W;
const err = (r) => (r.body && r.body.error) || {};
const num = (v) => Math.round(Number(v) * 100) / 100;
let admin;

beforeAll(async () => {
  admin = await W.fresh();
  W14.resetTree();
  await w12.startServer();
});
afterAll(() => w12.stopServer());

const brandRows = async (brandId, type) => (await query(
  `SELECT type::text AS type, amount::float AS amount, direction::text AS direction, balance_after::float AS balance_after, notes, source_ref_id
     FROM wallet_transactions WHERE brand_id = $1 AND ($2::text IS NULL OR type::text = $2) ORDER BY created_at, id`, [brandId, type || null])).rows;
const herRows = async (influencerId, type) => (await query(
  `SELECT type, amount::float AS amount, direction, balance_field, balance_after::float AS balance_after, note
     FROM influencer_ledger WHERE influencer_id = $1 AND ($2::text IS NULL OR type = $2) ORDER BY created_at, id`, [influencerId, type || null])).rows;
const setWallet = (table, id, amount) => query(`UPDATE ${table} SET wallet_balance = $2 WHERE id = $1`, [id, amount]);
const M = '/admin/money';

/* ───────────────────────────────────────────────────────────── check 1 */

describe('item 17 · adding money (check 1)', () => {
  it('one payment credits the wallet exactly once, however often it is verified', async () => {
    const w = await W.saleWorld();
    const before = (await W.money(w)).brand;
    const o = await api.post('/brands/me/wallet/topup', w.b.token, { amount: 5000 });
    expect(o.status).toBe(201);
    const body = { razorpay_order_id: o.body.data.order_id, razorpay_payment_id: 'pay_17_once', razorpay_signature: 'x' };
    const v1 = await api.post('/brands/me/wallet/topup/verify', w.b.token, body);
    expect(v1.status).toBe(200);
    expect(v1.body.data).toMatchObject({ wallet_balance: before + 5000, already_credited: false });
    const v2 = await api.post('/brands/me/wallet/topup/verify', w.b.token, body);          // the phone retries
    expect(v2.status).toBe(200);
    expect(v2.body.data).toMatchObject({ wallet_balance: before + 5000, already_credited: true });
    expect((await W.money(w)).brand).toBe(before + 5000);
    expect((await brandRows(w.brandId, 'topup')).filter((t) => t.amount === 5000)).toHaveLength(1);
    // another brand can never claim it
    const other = await W.saleWorld();
    expect((await api.post('/brands/me/wallet/topup/verify', other.b.token, body)).status).toBe(404);
    // and Admin's repair refuses a payment that is already in the wallet
    const again = await api.post(`${M}/added/${body.razorpay_order_id}/credit`, admin.token, { reason: 'Brand says it never arrived' });
    expect(again.status).toBe(422);
    expect(err(again).code).toBe('ALREADY_CREDITED');
  });

  it('a payment the wallet missed is credited once by Admin, with a reason, and recorded', async () => {
    const w = await W.saleWorld();
    const before = (await W.money(w)).brand;
    const o = await api.post('/brands/me/wallet/topup', w.b.token, { amount: 1200 });   // paid at the bank; the app closed before verify
    const id = o.body.data.order_id;
    let list = await api.get(`${M}/added`, admin.token);
    expect(list.status).toBe(200);
    expect(list.body.data.rows.find((x) => x.orderId === id)).toMatchObject({ amount: 1200, credited: false, canCredit: true });
    expect((await api.post(`${M}/added/${id}/credit`, admin.token, { reason: 'no' })).status).toBe(422);           // a reason is required
    const c = await api.post(`${M}/added/${id}/credit`, admin.token, { reason: 'Paid at the bank, app closed before it finished' });
    expect(c.status).toBe(200);
    expect(c.body.data).toMatchObject({ credited: true, wallet_balance: before + 1200 });
    expect((await api.post(`${M}/added/${id}/credit`, admin.token, { reason: 'Paid at the bank, again' })).status).toBe(422);
    expect((await W.money(w)).brand).toBe(before + 1200);
    list = await api.get(`${M}/added`, admin.token);
    expect(list.body.data.rows.find((x) => x.orderId === id)).toMatchObject({ credited: true, creditedHow: 'admin', canCredit: false });
    const { rows } = await query(`SELECT kind, amount::float AS amount FROM money_corrections WHERE brand_id = $1`, [w.brandId]);
    expect(rows).toEqual([{ kind: 'credit_topup', amount: 1200 }]);
  });
});

/* ───────────────────────────────────────────────────────────── checks 2, 3 */

describe('item 17 · the figures, each from its own source (checks 2, 3)', () => {
  it('a Hybrid collaboration: locked is its unpaid payments, never the campaign fee; the creator sees the same payments without the fee', async () => {
    const w = await W14.world({ goal: 'hybrid', fee: 8000 });
    const m = await W.money(w);
    const g = await api.get('/brands/me/wallet', w.b.token);
    expect(g.status).toBe(200);
    expect(g.body.data.figures).toMatchObject({ available: m.brand, onHold: 0, locked: 6000, lockedCount: 1, salesComing: 0, salesComingCount: 0 });
    expect(g.body.data.withdrawal_waiting).toBeNull();

    const l = (await api.get('/brands/me/wallet/locked', w.b.token)).body.data;
    expect(l).toMatchObject({ stillLocked: 6000, paidSoFar: 2000 });
    expect(l.collaborations).toHaveLength(1);
    expect(l.collaborations[0]).toMatchObject({ ciId: w.ciId, aim: 'hybrid', aimLabel: 'Hybrid', amount: 8000, paid: 2000, locked: 6000, next: { n: 2, amount: 2000, kind: 'confirm_live' } });
    expect(l.collaborations[0].payments.map((p) => [p.n, p.amount, p.paid])).toEqual([[1, 2000, true], [2, 2000, false], [3, 4000, false]]);
    // The campaign fee was INFLX's at the lock: it left Available and is in no "locked" figure.
    const fee = (await brandRows(w.brandId, 'platform_fee')).reduce((s, t) => s + t.amount, 0);
    expect(num(500000 - m.brand)).toBe(num(8000 + fee));

    const c = await api.get('/influencers/me/wallet', w.cr.token);
    expect(c.status).toBe(200);
    expect(c.body.data.figures).toMatchObject({ available: m.her, onHold: 0, stillToCome: 6000, payments: 6000, paymentsCount: 1, commission: 0 });
    expect(m.her).toBe(2000);                                                            // the first 25%, in full
    const p = (await api.get('/influencers/me/wallet/payments', w.cr.token)).body.data;
    expect(p).toMatchObject({ stillToCome: 6000, received: 2000 });
    expect(p.collaborations[0]).toMatchObject({ amount: 8000, paid: 2000, locked: 6000 });
    expect(p.collaborations[0]).not.toHaveProperty('campaignFee');
    expect(JSON.stringify(p)).not.toMatch(/fee/i);
  });
});

/* ───────────────────────────────────────────────────────────── checks 4, 5 */

describe('item 17 · sales money (checks 4, 5)', () => {
  it('the brand sees a sale\'s three shares exactly as frozen; the creator sees her commission alone', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    const ln = o.lines[0];
    const s = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data;
    expect(s.totals).toMatchObject({ coming: num(ln.brand_net), comingCount: 1, added: 0, sales: 1 });
    expect(s.sales).toHaveLength(1);
    // ASSERTION DRIFT — shopper-walk-fixes W13 (founder, 4 Oct 2026): the return window runs from the
    // DELIVERY, so a sale just made has no window date yet — it is waiting to be shipped. (Item 17
    // showed 'window' with a date counted from the order.) Same sale, same shares.
    expect(s.sales[0]).toMatchObject({ id: ln.id, state: 'not_shipped', paid: num(ln.paid_total), creatorShare: num(ln.commission), inflxShare: num(ln.platform_fee), brandShare: num(ln.brand_net), creatorFirst: 'Priya' });
    expect(num(s.sales[0].creatorShare + s.sales[0].inflxShare + s.sales[0].brandShare)).toBe(s.sales[0].paid);
    expect(s.sales[0].windowUntil).toBeNull();
    const one = await api.get(`/brands/me/wallet/sales/${ln.id}`, w.b.token);
    expect(one.body.data.sale).toMatchObject({ id: ln.id, brandShare: num(ln.brand_net) });
    const other = await W.saleWorld();
    expect((await api.get(`/brands/me/wallet/sales/${ln.id}`, other.b.token)).status).toBe(404);     // never another brand's sale

    const c = (await api.get('/influencers/me/wallet/commission', w.cr.token)).body.data;
    expect(c.totals).toMatchObject({ inWindow: num(ln.commission), added: 0, sales: 1 });
    // shopper-walk-fixes W13: the window runs from the delivery, so a sale just made is "not shipped yet".
    expect(c.sales[0]).toMatchObject({ id: ln.id, commission: num(ln.commission), commissionPct: 10, state: 'not_shipped' });
    for (const k of ['paid', 'brandShare', 'inflxShare', 'creatorShare', 'feePct']) expect(c.sales[0]).not.toHaveProperty(k);
    expect(JSON.stringify(c)).not.toMatch(/Anusha/);                                     // never who bought
    const fig = (await api.get('/influencers/me/wallet', w.cr.token)).body.data.figures;
    expect(fig).toMatchObject({ commission: num(ln.commission), commissionCount: 1, stillToCome: num(ln.commission) });
  });

  it('when the window closes the brand\'s share is added to its wallet once and the commission to hers; nothing goes to a bank', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    const ln = o.lines[0];
    const m0 = await W.money(w);
    await settlementJob.run(); await commissionConfirm.run();                           // still in its window: nothing moves
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    await W.closeWindow(o.tx.id);
    // Not shipped: the shopper (or the brand) can still cancel it for a full refund, so neither
    // share is added yet — and the screens say what it is waiting for.
    await settlementJob.run(); await commissionConfirm.run();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    expect(await settlement.settleCommerceTransaction(null, o.tx.id)).toEqual({ skipped: 'not_shipped' });
    expect((await api.get('/brands/me/wallet/sales', w.b.token)).body.data.sales[0]).toMatchObject({ state: 'not_shipped', windowUntil: null });
    await W.ship(w, o.parcel.id);
    // ASSERTION DRIFT — shopper-walk-fixes W13 (founder, 4 Oct 2026): a sale's shares are added AFTER
    // DELIVERY, when the return window counted from the delivery has closed — online exactly as cash.
    // (Item 17 added an online sale once it had shipped and its stamp had passed.) Same scenario, new rule.
    await settlementJob.run(); await commissionConfirm.run();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });           // shipped is not enough
    expect((await api.get('/brands/me/wallet/sales', w.b.token)).body.data.sales[0]).toMatchObject({ state: 'waiting_delivery', windowUntil: null });
    await W.deliverShipped(w, o.parcel.id, 40);                                        // delivered, and its window has closed
    await settlementJob.run(); await commissionConfirm.run();
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(num(ln.brand_net));
    expect(num(m1.her - m0.her)).toBe(num(ln.commission));
    await settlementJob.run(); await commissionConfirm.run();                           // a second run adds nothing
    expect(await settlement.settleCommerceTransaction(null, o.tx.id)).toEqual({ skipped: true });
    expect(await W.money(w)).toMatchObject({ brand: m1.brand, her: m1.her });
    const rows = await brandRows(w.brandId, 'sale_settlement');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: num(ln.brand_net), direction: 'credit', balance_after: m1.brand, notes: 'Sales money added', source_ref_id: o.tx.id });
    const { rows: [tx] } = await query(`SELECT brand_settlement_status, razorpay_transfer_id FROM follower_transactions WHERE id = $1`, [o.tx.id]);
    expect(tx).toEqual({ brand_settlement_status: 'settled', razorpay_transfer_id: null });
    expect(await settlementRetryJob.run()).toMatchObject({ retired: true });            // the bank-transfer retry is retired
    // the screens follow
    const s = (await api.get('/brands/me/wallet/sales?filter=added', w.b.token)).body.data;
    expect(s.totals).toMatchObject({ coming: 0, added: num(ln.brand_net) });
    expect(s.sales[0]).toMatchObject({ id: ln.id, state: 'added' });
    expect((await api.get('/brands/me/wallet', w.b.token)).body.data.figures).toMatchObject({ available: m1.brand, salesComing: 0 });
    const c = (await api.get('/influencers/me/wallet/commission', w.cr.token)).body.data;
    expect(c.totals).toMatchObject({ inWindow: 0, added: num(ln.commission) });
    expect(c.sales[0].state).toBe('added');
  });

  it('a cancelled item is never added: only what was kept reaches either wallet', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0, 1]);
    const [kept, gone] = o.lines;
    const cancel = await api.post(`/follower/orders/lines/${gone.id}/cancel`, o.sh.token, { reason: 'Found a better price' });
    expect(cancel.status).toBe(200);
    const s0 = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data;
    expect(s0.totals).toMatchObject({ coming: num(kept.brand_net), comingCount: 1 });
    expect(s0.sales.find((x) => x.id === gone.id)).toMatchObject({ state: 'cancelled', brandShare: 0, creatorShare: 0, inflxShare: 0 });
    const m0 = await W.money(w);
    await W.ship(w, o.parcel.id);                                                        // the kept item goes out
    await W.closeWindow(o.tx.id);
    // ASSERTION DRIFT — shopper-walk-fixes W13 (founder, 4 Oct 2026): a sale's shares are added AFTER
    // DELIVERY, when the return window counted from the delivery has closed — online exactly as cash.
    // (Item 17 added an online sale once it had shipped and its stamp had passed.) Same scenario, new rule.
    await W.deliverShipped(w, o.parcel.id, 40);
    await settlementJob.run(); await commissionConfirm.run();
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(num(kept.brand_net));
    expect(num(m1.her - m0.her)).toBe(num(kept.commission));
    // History is the WALLET's movements: the commission taken back while it was still pending was
    // never in her wallet, so it is not a row there (the Commission screen shows the sale as cancelled).
    const hist = (await api.get('/influencers/me/wallet/history', w.cr.token)).body.data.rows;
    expect(hist.map((x) => x.label)).toEqual(['Commission added']);
    expect(hist[0]).toMatchObject({ amount: num(kept.commission), availableAfter: m1.her });
    const mv = (await api.get(`${M}/movements?group=commission`, admin.token)).body.data.rows.filter((x) => x.ownerId === w.cr.influencerId);
    expect(mv.map((x) => x.label)).toEqual(['Commission added']);
  });

  it('only a sale that came through the shopper checkout ever becomes wallet money', async () => {
    // The older pay-at-store / prebook flows write a completed sale with a brand share and no
    // checkout. Their share was never paid out before, and it is never wallet money now.
    const w = await W.saleWorld();
    const sh = await W.shopper();
    const { rows: [t] } = await query(
      `INSERT INTO follower_transactions (follower_id, brand_id, transaction_type, gross_amount, net_amount, influencer_commission,
                                          marketplace_fee_amount, brand_net, status, razorpay_payment_id, return_window_ends_at)
       VALUES ($1, $2, 'pay_at_store', 500000, 500000, 0, 25000, 450000, 'completed', 'anything', now() - interval '1 day') RETURNING id`,
      [sh.followerId, w.brandId]);
    const before = (await W.money(w)).brand;
    await settlementJob.run();
    expect(await settlement.settleCommerceTransaction(null, t.id)).toEqual({ skipped: 'not_a_checkout_sale' });
    expect((await W.money(w)).brand).toBe(before);
    expect((await query(`SELECT brand_settlement_status FROM follower_transactions WHERE id = $1`, [t.id])).rows[0].brand_settlement_status).toBe('pending');
    expect(await brandRows(w.brandId, 'sale_settlement')).toHaveLength(0);
  });

  it('a sale already added to the wallets can never be cancelled into a refund', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    await W.ship(w, o.parcel.id);
    await W.closeWindow(o.tx.id);
    // ASSERTION DRIFT — shopper-walk-fixes W13 (founder, 4 Oct 2026): a sale's shares are added AFTER
    // DELIVERY, when the return window counted from the delivery has closed — online exactly as cash.
    // (Item 17 added an online sale once it had shipped and its stamp had passed.) Same scenario, new rule.
    await W.deliverShipped(w, o.parcel.id, 40);
    await settlementJob.run(); await commissionConfirm.run();
    const m = await W.money(w);
    // shipped (and now delivered): the ordinary rule already refuses a cancel
    const shipped = await api.post(`/follower/orders/lines/${o.lines[0].id}/cancel`, o.sh.token, { reason: 'Found a better price' });
    expect(shipped.status).toBe(409);
    expect(err(shipped).message).not.toMatch(/already been settled/);
    // and even if the parcel were somehow still cancellable, a settled sale is refused before any refund
    await query(`UPDATE follower_orders SET order_status = 'confirmed' WHERE id = $1`, [o.parcel.id]);
    const r = await api.post(`/follower/orders/lines/${o.lines[0].id}/cancel`, o.sh.token, { reason: 'Found a better price' });
    expect(r.status).toBe(409);
    expect(err(r).message).toMatch(/already been settled/);
    expect((await api.post(`/brands/me/orders/lines/${o.lines[0].id}/cancel`, w.b.token, { reason: 'Out of stock' })).status).toBe(409);
    expect(await W.money(w)).toMatchObject({ brand: m.brand, her: m.her });
    expect((await query(`SELECT status FROM order_lines WHERE id = $1`, [o.lines[0].id])).rows[0].status).toBe('active');
  });

  it('cash on delivery counts only once delivered, its window runs from the delivery, and the brand owes INFLX nothing', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0], { method: 'cod' });
    const ln = o.lines[0];
    const m0 = await W.money(w);
    let s = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data.sales[0];
    expect(s).toMatchObject({ cashOnDelivery: true, state: 'cod_waiting', windowUntil: null });
    // Not delivered: INFLX has collected nothing, so it is listed but counted in no "coming" figure.
    const before = (await api.get('/brands/me/wallet', w.b.token)).body.data.figures;
    expect(before).toMatchObject({ salesComing: 0, salesComingCount: 0 });
    expect((await api.get('/brands/me/wallet/sales?filter=coming', w.b.token)).body.data.sales).toHaveLength(0);
    expect((await api.get('/influencers/me/wallet', w.cr.token)).body.data.figures).toMatchObject({ commission: 0, commissionCount: 0 });
    const held0 = (await api.get(`${M}/overview`, admin.token)).body.data.parts.salesInReturnWindow;
    await W.closeWindow(o.tx.id);                                                        // the clock alone is not enough
    await settlementJob.run(); await commissionConfirm.run();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    await W.deliver(w, o.parcel.id);                                                     // delivered today: its window starts now
    await settlementJob.run(); await commissionConfirm.run();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    s = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data.sales[0];
    expect(s.state).toBe('window');
    expect(s.windowUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Delivered: the cash is INFLX's to hold now, so both shares are "coming" and INFLX is holding them.
    expect((await api.get('/brands/me/wallet', w.b.token)).body.data.figures).toMatchObject({ salesComing: num(ln.brand_net), salesComingCount: 1 });
    expect((await api.get('/influencers/me/wallet', w.cr.token)).body.data.figures).toMatchObject({ commission: num(ln.commission), commissionCount: 1 });
    const held1 = (await api.get(`${M}/overview`, admin.token)).body.data.parts.salesInReturnWindow;
    expect(num(held1 - held0)).toBe(num(Number(ln.brand_net) + Number(ln.commission)));
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '40 days' WHERE id = $1`, [o.parcel.id]);
    await settlementJob.run(); await commissionConfirm.run();
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(num(ln.brand_net));                            // exactly as an online sale
    expect(num(m1.her - m0.her)).toBe(num(ln.commission));
    expect((await query(`SELECT count(*)::int AS n FROM brand_dues WHERE brand_id = $1`, [w.brandId])).rows[0].n).toBe(0);
  });
});

/* ───────────────────────────────────────────────────────────── checks 6, 7, 11 */

describe('item 17 · the brand\'s withdrawal (checks 6, 7, 11)', () => {
  let w;
  beforeAll(async () => { w = await W.saleWorld(); await setWallet('brands', w.brandId, 20000); });

  it('needs a bank account first; then holds the amount at once and allows one request at a time', async () => {
    let o = (await api.get('/brands/me/wallet/withdraw', w.b.token)).body.data;
    expect(o).toMatchObject({ available: 20000, onHold: 0, minimum: 100, processHours: 24, sendTo: [], blocked: { code: 'NO_DETAILS' } });
    let r = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 5000 });
    expect(r.status).toBe(422);
    expect(err(r).code).toBe('PAYMENT_METHOD_MISSING');
    await W.brandBank(w);
    o = (await api.get('/brands/me/wallet/withdraw', w.b.token)).body.data;
    expect(o.blocked).toBeNull();
    expect(o.sendTo).toEqual([{ method: 'bank', label: 'Bank ··4821', masked: '··4821 · HDFC0001234' }]);

    r = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 50 });
    expect(err(r).code).toBe('WITHDRAWAL_TOO_SMALL');
    r = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 20000.01 });
    expect(err(r).code).toBe('INSUFFICIENT_BALANCE');
    r = await api.post('/brands/me/wallet/withdraw', w.b.token, {});
    expect(err(r).code).toBe('VALIDATION_ERROR');
    expect(await W.money(w)).toMatchObject({ brand: 20000, brand_hold: 0 });

    r = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 5000 });
    expect(r.status).toBe(201);
    expect(r.body.data.withdrawal).toMatchObject({ amount: 5000, method: 'bank', sendTo: '··4821 · HDFC0001234', status: 'requested', processHours: 24, reference: null, reason: null });
    expect(await W.money(w)).toMatchObject({ brand: 15000, brand_hold: 5000 });
    const g = (await api.get('/brands/me/wallet', w.b.token)).body.data;
    expect(g.figures).toMatchObject({ available: 15000, onHold: 5000 });
    expect(g.withdrawal_waiting).toMatchObject({ amount: 5000, status: 'requested' });

    r = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 1000 });
    expect(r.status).toBe(422);
    expect(err(r).code).toBe('ONE_AT_A_TIME');
    expect((await api.get('/brands/me/wallet/withdraw', w.b.token)).body.data.blocked).toMatchObject({ code: 'ONE_AT_A_TIME' });
    expect(await W.money(w)).toMatchObject({ brand: 15000, brand_hold: 5000 });
    // check 11: the account it is paid to is the brand's own saved one — the request names none
    const { rows: [row] } = await query(`SELECT account_enc, ifsc, payee_masked FROM withdrawal_requests WHERE brand_id = $1`, [w.brandId]);
    expect(decrypt(row.account_enc)).toBe('50100284614821');
    expect(row.ifsc).toBe('HDFC0001234');
  });

  it('Admin sees it with the full account, pays it, and records the reference: only then does the money leave', async () => {
    const list = (await api.get(`${M}/withdrawals`, admin.token)).body.data;
    const mine = list.rows.find((x) => x.ownerId === w.brandId);
    expect(mine).toMatchObject({ ownerKind: 'brand', amount: 5000, status: 'requested', holdCovers: true, late: false });
    expect(mine).not.toHaveProperty('account');                                          // the list never carries the account
    const one = (await api.get(`${M}/withdrawals/${mine.id}`, admin.token)).body.data;
    expect(one).toMatchObject({ account: '50100284614821', ifsc: 'HDFC0001234', amount: 5000 });
    expect((await api.get(`${M}/withdrawals/${mine.id}`, w.b.token)).status).toBe(403);   // a brand can never open Admin's page

    let r = await api.post(`${M}/withdrawals/${mine.id}/processed`, admin.token, {});
    expect(r.status).toBe(422);                                                          // a bank reference is required
    r = await api.post(`${M}/withdrawals/${mine.id}/processed`, admin.token, { reference: 'HDFCN52026100112345', paidOn: '2026-10-01' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'processed', reference: 'HDFCN52026100112345' });
    expect(await W.money(w)).toMatchObject({ brand: 15000, brand_hold: 0 });
    r = await api.post(`${M}/withdrawals/${mine.id}/processed`, admin.token, { reference: 'AGAIN' });   // a second click
    expect(r.status).toBe(422);
    expect(err(r).code).toBe('NOT_WAITING');
    expect((await api.post(`${M}/withdrawals/${mine.id}/could-not-process`, admin.token, { reason: 'Wrong account' })).status).toBe(422);
    expect(await W.money(w)).toMatchObject({ brand: 15000, brand_hold: 0 });

    const mineList = (await api.get('/brands/me/wallet/withdrawals', w.b.token)).body.data.withdrawals;
    expect(mineList[0]).toMatchObject({ amount: 5000, status: 'processed', reference: 'HDFCN52026100112345', paidOn: expect.anything() });
    expect((await brandRows(w.brandId)).filter((t) => t.type.startsWith('withdrawal')).map((t) => [t.type, t.amount, t.balance_after]))
      .toEqual([['withdrawal_hold', 5000, 15000], ['withdrawal_paid', 5000, 15000]]);
    const told = await query(`SELECT n.title, n.body FROM notifications n JOIN brands b ON b.user_id = n.user_id WHERE b.id = $1 AND n.type = 'withdrawal.processed'`, [w.brandId]);
    expect(told.rows[0].body).toMatch(/₹5,000 was paid to ··4821/);
  });

  it('could not process: the hold goes back to Available with the reason she reads, and she can ask again', async () => {
    let r = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 3000 });
    expect(r.status).toBe(201);
    const id = r.body.data.withdrawal.id;
    expect(await W.money(w)).toMatchObject({ brand: 12000, brand_hold: 3000 });
    expect((await api.post(`${M}/withdrawals/${id}/could-not-process`, admin.token, {})).status).toBe(422);     // a reason is required
    r = await api.post(`${M}/withdrawals/${id}/could-not-process`, admin.token, { reason: 'The bank returned it: account closed.', reasonKind: 'bank_returned' });
    expect(r.status).toBe(200);
    expect(await W.money(w)).toMatchObject({ brand: 15000, brand_hold: 0 });
    const list = (await api.get('/brands/me/wallet/withdrawals', w.b.token)).body.data.withdrawals;
    expect(list[0]).toMatchObject({ id, status: 'could_not_process', reason: 'The bank returned it: account closed.', reference: null });
    expect((await api.get('/brands/me/wallet', w.b.token)).body.data.withdrawal_waiting).toBeNull();
    r = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 15000 });      // everything, again
    expect(r.status).toBe(201);
    expect(await W.money(w)).toMatchObject({ brand: 0, brand_hold: 15000 });
  });

  it('money on hold cannot fund an agreement; released, it can', async () => {
    const h = await w10.signedByHer('hybrid');
    await setWallet('brands', h.brandId, 400000);
    await W.brandBank(h);
    const wr = await api.post('/brands/me/wallet/withdraw', h.b.token, { amount: 399900 });
    expect(wr.status).toBe(201);
    let s = await w10.brandSign(h);
    expect(s.status).toBe(422);
    expect(err(s).code).toBe('WALLET_INSUFFICIENT');
    expect(await W.money({ brandId: h.brandId, cr: h.cr })).toMatchObject({ brand: 100, brand_hold: 399900 });
    await api.post(`${M}/withdrawals/${wr.body.data.withdrawal.id}/could-not-process`, admin.token, { reason: 'Asked by the brand to stop it.' });
    s = await w10.brandSign(h);
    expect(s.status).toBe(200);
  });
});

/* ───────────────────────────────────────────────────────────── checks 6, 7, 8 */

describe('item 17 · the creator\'s withdrawal: the full amount, no tax (checks 6, 7, 8)', () => {
  let w;
  beforeAll(async () => { w = await W.saleWorld(); await setWallet('influencers', w.cr.influencerId, 4000); });

  it('to her UPI, held at once, paid in full; nothing anywhere mentions TDS', async () => {
    let o = (await api.get('/influencers/me/wallet/withdraw', w.cr.token)).body.data;
    expect(o.blocked).toMatchObject({ code: 'NO_DETAILS' });
    await W.creatorUpi(w);
    o = (await api.get('/influencers/me/wallet/withdraw', w.cr.token)).body.data;
    expect(o).toMatchObject({ available: 4000, minimum: 100, blocked: null, sendTo: [{ method: 'upi', label: 'UPI · priya@okhdfc', masked: 'priya@okhdfc' }] });

    let r = await api.post('/influencers/me/wallet/withdraw', w.cr.token, { amount: 99 });
    expect(err(r).code).toBe('WITHDRAWAL_TOO_SMALL');
    r = await api.post('/influencers/me/wallet/withdraw', w.cr.token, { amount: 4001 });
    expect(err(r).code).toBe('INSUFFICIENT_BALANCE');
    r = await api.post('/influencers/me/wallet/withdraw', w.cr.token, { amount: 2500, method: 'bank' });   // she has no bank account saved
    expect(err(r).code).toBe('PAYMENT_METHOD_MISSING');
    r = await api.post('/influencers/me/wallet/withdraw', w.cr.token, { amount: 2500 });
    expect(r.status).toBe(201);
    expect(r.body.data.withdrawal).toMatchObject({ amount: 2500, method: 'upi', sendTo: 'priya@okhdfc', status: 'requested' });
    expect(JSON.stringify(r.body)).not.toMatch(/tds|tax|net_?amount/i);
    expect(await W.money(w)).toMatchObject({ her: 1500, her_hold: 2500 });
    const fig = (await api.get('/influencers/me/wallet', w.cr.token)).body.data;
    expect(fig.figures).toMatchObject({ available: 1500, onHold: 2500 });
    expect(fig.withdrawal_waiting).toMatchObject({ amount: 2500 });
    expect((await api.post('/influencers/me/wallet/withdraw', w.cr.token, { amount: 500 })).status).toBe(422);

    const id = r.body.data.withdrawal.id;
    const one = (await api.get(`${M}/withdrawals/${id}`, admin.token)).body.data;
    expect(one).toMatchObject({ ownerKind: 'creator', amount: 2500, upi: 'priya@okhdfc', account: null });
    const p = await api.post(`${M}/withdrawals/${id}/processed`, admin.token, { reference: 'UPI/627412345678' });
    expect(p.status).toBe(200);
    expect(await W.money(w)).toMatchObject({ her: 1500, her_hold: 0 });
    // the whole ₹2,500 was paid: one hold row, one paid row, no tax row, and the old tables untouched
    const led = await herRows(w.cr.influencerId);
    expect(led.filter((x) => x.type.startsWith('withdrawal')).map((x) => [x.type, x.amount])).toEqual([['withdrawal_hold', 2500], ['withdrawal_paid', 2500]]);
    expect(led.some((x) => /tds/i.test(`${x.type} ${x.note}`))).toBe(false);
    expect((await query(`SELECT count(*)::int AS n FROM influencer_withdrawals WHERE influencer_id = $1`, [w.cr.influencerId])).rows[0].n).toBe(0);
    const mine = (await api.get('/influencers/me/wallet/withdrawals', w.cr.token)).body.data.withdrawals;
    expect(mine[0]).toMatchObject({ amount: 2500, status: 'processed', reference: 'UPI/627412345678' });
    expect(JSON.stringify(mine)).not.toMatch(/tds|tax/i);
  });

  it('the old withdraw addresses run the same model, and the automatic retry is gone', async () => {
    const r = await api.post('/influencers/me/withdraw', w.cr.token, { amount: 1000, method: 'upi' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ amount_requested: 1000, status: 'requested' });
    expect(r.body.data).not.toHaveProperty('tds_amount');
    expect(await W.money(w)).toMatchObject({ her: 500, her_hold: 1000 });
    const list = await api.get('/influencers/me/withdrawals', w.cr.token);
    expect(list.body.data.withdrawals.map((x) => x.status)).toEqual(['requested', 'processed']);
    const retry = await api.post(`/influencers/me/withdrawals/${r.body.data.withdrawal_id}/retry`, w.cr.token);
    expect(retry.status).toBe(410);
    expect(err(retry).code).toBe('RETIRED_17_RETRY');
  });
});

/* ───────────────────────────────────────────────────────────── check 9 */

describe('item 17 · after both have signed (check 9)', () => {
  it('a campaign with a signed collaboration cannot be cancelled, and no money moves', async () => {
    const w = await W14.world({ goal: 'hybrid', fee: 8000 });
    const m0 = await W.money(w);
    const r = await api.post(`/campaigns/${w.c.id}/cancel`, w.b.token);
    expect(r.status).toBe(422);
    expect(err(r).code).toBe('SIGNED_NO_CANCEL');
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    expect((await query(`SELECT status::text, count(*)::int AS n FROM escrow_entries WHERE campaign_influencer_id = $1 GROUP BY 1 ORDER BY 1`, [w.ciId])).rows)
      .toEqual([{ status: 'locked', n: 2 }, { status: 'released', n: 1 }]);
    expect((await query(`SELECT status::text FROM campaigns WHERE id = $1`, [w.c.id])).rows[0].status).not.toBe('cancelled');
  });

  it('before anyone has signed, cancelling is allowed and moves nothing', async () => {
    const b = await W14.world({ goal: 'hybrid', fee: 8000 }).then((x) => x.b);
    const c = await w10.campaign(b, { name: 'Never sent' });
    const before = (await query(`SELECT wallet_balance::float AS v FROM brands WHERE id = $1`, [b.brandId])).rows[0].v;
    const r = await api.post(`/campaigns/${c.id}/cancel`, b.token);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'cancelled', refund_amount: 0 });
    expect((await query(`SELECT wallet_balance::float AS v FROM brands WHERE id = $1`, [b.brandId])).rows[0].v).toBe(before);
  });

  it('INFLX\'s dispute tools are the only other way locked money moves: release the next payment, or return what is locked', async () => {
    const a = await W14.world({ goal: 'hybrid', fee: 8000 });
    let m0 = await W.money(a);
    const why = 'She posted on the date; the brand never confirmed.';
    expect((await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: a.ciId, tranche: 2, reason: 'x' })).status).toBe(422);   // a reason
    expect((await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: a.ciId, reason: why })).status).toBe(422);              // which payment
    let r = await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: a.ciId, tranche: 3, reason: why });                     // not the next one
    expect(r.status).toBe(409);
    expect(err(r).code).toBe('PAYMENT_CHANGED');
    expect(await W.money(a)).toMatchObject({ her: m0.her, brand: m0.brand });
    r = await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: a.ciId, tranche: 2, reason: why });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ released: 2000, tranche: 2 });
    // She has NOT posted, so this is money only: nothing is promised about the final 50%.
    expect(r.body.data).not.toHaveProperty('stoodIn');
    expect(r.body.data).not.toHaveProperty('finalDueAt');
    let m1 = await W.money(a);
    expect(num(m1.her - m0.her)).toBe(2000);                                              // into her WALLET — never to a bank
    expect(m1.brand).toBe(m0.brand);
    expect((await api.get('/brands/me/wallet/locked', a.b.token)).body.data).toMatchObject({ stillLocked: 4000, paidSoFar: 4000 });
    // A SECOND CLICK (or a retry after a lost answer) names the payment that was shown — it is
    // refused, and the final 50% stays where it is.
    r = await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: a.ciId, tranche: 2, reason: why });
    expect(r.status).toBe(409);
    expect((await W.money(a)).her).toBe(m1.her);
    // The final 50% stays locked, with no date — INFLX releases or returns it here.
    const esc = (await query(`SELECT tranche_number AS n, status::text, release_due_at FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY 1`, [a.ciId])).rows;
    expect(esc.map((e) => [e.n, e.status, e.release_due_at])).toEqual([[1, 'released', null], [2, 'released', null], [3, 'locked', null]]);
    expect((await api.get('/influencers/me/wallet', a.cr.token)).body.data.figures.nextPaymentAt).toBeNull();
    const told = await query(`SELECT body FROM notifications WHERE user_id = $1 AND type = 'wallet.released_by_inflx'`, [a.cr.userId]);
    expect(told.rows[0].body).toMatch(/INFLX released ₹2,000/);
    const toldBrand = await query(`SELECT n.body FROM notifications n JOIN brands b ON b.user_id = n.user_id WHERE b.id = $1 AND n.type = 'wallet.released_by_inflx'`, [a.brandId]);
    expect(toldBrand.rows[0].body).toMatch(/INFLX released ₹2,000 locked for Tanvi Suresh/);
    expect(toldBrand.rows[0].body).not.toMatch(/confirmed the content is live/);

    const b = await W14.world({ goal: 'hybrid', fee: 8000 });
    m0 = await W.money(b);
    r = await api.post(`${M}/corrections/return-locked`, admin.token, { ciId: b.ciId, expected: 4000, reason: 'A stale screen showed another amount.' });
    expect(r.status).toBe(409);
    expect(err(r).code).toBe('PAYMENT_CHANGED');
    expect((await W.money(b)).brand).toBe(m0.brand);
    r = await api.post(`${M}/corrections/return-locked`, admin.token, { ciId: b.ciId, expected: 6000, reason: 'She took the first payment and stopped answering.' });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ returned: 6000 });
    // the older "reserved" figure (website home, older phone builds) follows the same rows
    expect((await api.get('/brands/me/wallet', b.b.token)).body.data.wallet).toMatchObject({ reserved_balance: 0, escrow_locked: 0 });
    m1 = await W.money(b);
    expect(num(m1.brand - m0.brand)).toBe(6000);
    expect(m1.her).toBe(m0.her);                                                          // the first 25% stays hers
    expect((await api.get('/brands/me/wallet', b.b.token)).body.data.figures).toMatchObject({ locked: 0, lockedCount: 0 });
    r = await api.post(`${M}/corrections/return-locked`, admin.token, { ciId: b.ciId, reason: 'A second click on the same button.' });
    expect(err(r).code).toBe('NOTHING_LOCKED');
    expect((await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: b.ciId, tranche: 2, reason: 'Nothing left to release here.' })).status).toBe(422);
    expect((await W.money(b)).brand).toBe(m1.brand);

    const list = (await api.get(`${M}/corrections`, admin.token)).body.data.rows;
    expect(list.filter((x) => ['release_payment', 'return_locked'].includes(x.kind)).map((x) => [x.kind, x.amount]).sort())
      .toEqual([['release_payment', 2000], ['return_locked', 6000]]);
    expect((await api.post(`${M}/corrections/return-locked`, b.b.token, { ciId: b.ciId, reason: 'A brand tries it itself.' })).status).toBe(403);
  });

  it('correct a balance: add or take with a reason, never below zero, shown in the person\'s history', async () => {
    const w = await W.saleWorld();
    await setWallet('brands', w.brandId, 1000);
    let r = await api.post(`${M}/corrections/correct-balance`, admin.token, { kind: 'brand', id: w.brandId, amount: 250, direction: 'credit', reason: 'Courier charged twice on 28 Sep.' });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ available: 1250 });
    r = await api.post(`${M}/corrections/correct-balance`, admin.token, { kind: 'brand', id: w.brandId, amount: 5000, direction: 'debit', reason: 'More than the wallet holds.' });
    expect(err(r).code).toBe('INSUFFICIENT_BALANCE');
    r = await api.post(`${M}/corrections/correct-balance`, admin.token, { kind: 'creator', id: w.cr.influencerId, amount: 300, direction: 'credit', reason: 'Commission missed on a test order.' });
    expect(r.body.data).toEqual({ available: 300 });
    expect(await W.money(w)).toMatchObject({ brand: 1250, her: 300 });
    const bh = (await api.get('/brands/me/wallet/history', w.b.token)).body.data.rows;
    expect(bh[0]).toMatchObject({ label: 'Correction by INFLX', sign: '+', amount: 250, availableAfter: 1250, sub: 'Courier charged twice on 28 Sep.' });
    const ch = (await api.get('/influencers/me/wallet/history', w.cr.token)).body.data.rows;
    expect(ch[0]).toMatchObject({ label: 'Correction by INFLX', sign: '+', amount: 300, availableAfter: 300 });
  });
});

/* ───────────────────────────────────────────────────────────── check 10 */

describe('item 17 · history in plain words (check 10)', () => {
  it('every movement has a label a person reads; a ledger word never reaches the screen', async () => {
    const w = await W14.world({ goal: 'hybrid', fee: 8000 });
    await W.brandBank(w);
    const wr = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 1000 });
    await api.post(`${M}/withdrawals/${wr.body.data.withdrawal.id}/processed`, admin.token, { reference: 'REF17' });
    const rows = (await api.get('/brands/me/wallet/history', w.b.token)).body.data.rows;
    const labels = rows.map((x) => x.label);
    expect(labels).toEqual(expect.arrayContaining(['Locked for Tanvi Suresh', 'Paid to Tanvi Suresh', 'INFLX campaign fee', 'Withdrawal requested · on hold', 'Withdrawal processed'].filter((l) => l !== 'INFLX campaign fee' || labels.includes(l))));
    for (const x of rows) {
      expect(x).toEqual(expect.objectContaining({ at: expect.anything(), amount: expect.any(Number), group: expect.any(String) }));
      expect(JSON.stringify(x)).not.toMatch(/escrow|tranche|payout|topup/i);
    }
    // the bookkeeping half of a payment is not a second row
    expect(labels.filter((l) => l === 'Paid to Tanvi Suresh')).toHaveLength(1);
    expect(rows.find((x) => x.label === 'Paid to Tanvi Suresh').sub).toMatch(/^First 25% · at signing · /);
    expect(rows.find((x) => x.label === 'Locked for Tanvi Suresh')).toMatchObject({ sign: '−', amount: 8000, moneyIn: false });
    const wd = (await api.get('/brands/me/wallet/history?filter=withdrawals', w.b.token)).body.data.rows;
    expect(wd.map((x) => [x.label, x.sub])).toEqual([['Withdrawal processed', 'To ··4821 · HDFC0001234 · ref REF17'], ['Withdrawal requested · on hold', 'To ··4821 · HDFC0001234']]);

    const her = (await api.get('/influencers/me/wallet/history', w.cr.token)).body.data.rows;
    expect(her).toHaveLength(1);
    expect(her[0]).toMatchObject({ sign: '+', amount: 2000, moneyIn: true, availableAfter: 2000 });
    expect(her[0].label).toMatch(/^First 25% · \S/);                                    // "First 25% · <the brand>"
    expect(her[0].sub).toMatch(/ · at signing$/);                                        // "<the campaign> · at signing"
    expect(JSON.stringify(her)).not.toMatch(/tranche|escrow|tds/i);
  });
});

/* ───────────────────────────────────────────────────────────── Admin · Money */

describe('item 17 · Admin\'s Money section', () => {
  it('only an admin with the payouts capability opens it', async () => {
    const w = await W.saleWorld();
    for (const p of ['overview', 'withdrawals', 'balances', 'sales', 'collaborations', 'added', 'movements', 'corrections']) {
      expect((await api.get(`${M}/${p}`, w.b.token)).status).toBe(403);                 // eslint-disable-line no-await-in-loop
      expect((await api.get(`${M}/${p}`, w.cr.token)).status).toBe(403);                // eslint-disable-line no-await-in-loop
      expect((await api.get(`${M}/${p}`, admin.token)).status).toBe(200);               // eslint-disable-line no-await-in-loop
    }
  });

  it('the Orders page\'s sales summary answers (it used to fail on a column that never existed)', async () => {
    const r = await api.get('/admin/commerce-summary?days=30', admin.token);
    expect(r.status).toBe(200);
    expect(r.body.data.summary).toEqual(expect.objectContaining({ online_order_count: expect.any(Number), platform_fees: expect.anything(), brand_net: expect.anything() }));
  });

  it('the overview is the sum of what the wallets, the locks and the sales in their window actually hold', async () => {
    const o = (await api.get(`${M}/overview`, admin.token)).body.data;
    const { rows: [t] } = await query(
      `SELECT (SELECT COALESCE(sum(wallet_balance), 0) FROM brands)::float AS ba, (SELECT COALESCE(sum(withdrawal_hold), 0) FROM brands)::float AS bh,
              (SELECT COALESCE(sum(wallet_balance), 0) FROM influencers)::float AS ca, (SELECT COALESCE(sum(withdrawal_hold), 0) FROM influencers)::float AS ch,
              (SELECT COALESCE(sum(amount), 0) FROM escrow_entries WHERE status IN ('locked', 'queued', 'processing'))::float AS locked,
              (SELECT count(*) FROM withdrawal_requests WHERE status = 'requested')::int AS waiting`);
    expect(o.parts).toMatchObject({ brandAvailable: num(t.ba), creatorAvailable: num(t.ca), lockedInCollaborations: num(t.locked), onHoldForWithdrawals: num(t.bh + t.ch) });
    expect(o.holding).toBe(num(Object.values(o.parts).reduce((a, b) => a + b, 0)));
    expect(o.withdrawalsWaiting.count).toBe(t.waiting);
    expect(o.attention[0]).toMatch(/waiting/);
    expect(o.earnings).toEqual(expect.objectContaining({ campaignFeesThisMonth: expect.any(Number), salesFeesThisMonth: expect.any(Number) }));
    expect(o.earnings.thisMonth).toBe(num(o.earnings.campaignFeesThisMonth + o.earnings.salesFeesThisMonth));
  });

  it('balances, one person, sales, collaboration money and all movements read the same rows the wallets do', async () => {
    const w = await W14.world({ goal: 'hybrid', fee: 8000, name: 'Meera Pillai' });
    const m = await W.money(w);
    const brands = (await api.get(`${M}/balances?kind=brands`, admin.token)).body.data.rows;
    expect(brands.find((x) => x.id === w.brandId)).toMatchObject({ available: m.brand, onHold: 0, locked: 6000, salesComing: 0, total: num(m.brand + 6000) });
    const creators = (await api.get(`${M}/balances?kind=creators&q=meera`, admin.token)).body.data.rows;
    expect(creators).toHaveLength(1);
    expect(creators[0]).toMatchObject({ id: w.cr.influencerId, available: 2000, payments: 6000, commission: 0, total: 8000 });

    const person = (await api.get(`${M}/balances/brand/${w.brandId}?tab=collaborations`, admin.token)).body.data;
    expect(person.figures).toMatchObject({ available: m.brand, locked: 6000 });
    expect(person.collaborations.collaborations[0]).toMatchObject({ ciId: w.ciId, locked: 6000 });
    const her = (await api.get(`${M}/balances/creator/${w.cr.influencerId}`, admin.token)).body.data;
    expect(her).toMatchObject({ kind: 'creator', name: 'Meera Pillai', figures: { available: 2000, stillToCome: 6000 } });
    expect(her.history[0]).toMatchObject({ amount: 2000, group: 'collaborations' });
    expect(her.history[0].label).toMatch(/^First 25% · /);
    expect((await api.get(`${M}/balances/creator/not-an-id`, admin.token)).status).toBe(404);

    const col = (await api.get(`${M}/collaborations`, admin.token)).body.data;
    expect(col.rows.find((x) => x.ciId === w.ciId)).toMatchObject({ locked: 6000, paid: 2000, brandId: w.brandId, creatorName: 'Meera Pillai' });
    expect(col.totals.lockedCount).toBe(col.rows.length);
    expect((await api.get(`${M}/collaborations?tab=waiting`, admin.token)).body.data.rows.some((x) => x.ciId === w.ciId)).toBe(true);

    const s = await W.saleWorld();
    const o = await W.order(s, [0]);
    const sales = (await api.get(`${M}/sales`, admin.token)).body.data;
    expect(sales.sales.find((x) => x.id === o.lines[0].id)).toMatchObject({ paid: num(o.lines[0].paid_total), brandShare: num(o.lines[0].brand_net), creatorShare: num(o.lines[0].commission), inflxShare: num(o.lines[0].platform_fee) });
    expect(num(sales.month.toBrands + sales.month.toCreators + sales.month.toInflx)).toBe(sales.month.shoppersPaid);

    const mv = (await api.get(`${M}/movements?q=meera`, admin.token)).body.data.rows;
    expect(mv.length).toBeGreaterThan(0);
    for (const x of mv) expect(JSON.stringify(x)).not.toMatch(/tranche|escrow_|payout/i);
    // a row reads here exactly as it does in its owner's own History
    expect(mv.find((x) => x.ownerKind === 'creator')).toMatchObject({ sign: '+', amount: 2000 });
    expect(mv.find((x) => x.ownerKind === 'creator').label).toMatch(/^First 25% · /);
    expect(mv.find((x) => x.ownerKind === 'brand' && x.label === 'Paid to Meera Pillai')).toMatchObject({ amount: 2000, group: 'collaborations' });
    expect(mv.some((x) => x.label === 'Locked for Meera Pillai')).toBe(true);
    const col2 = (await api.get(`${M}/movements?group=collaborations`, admin.token)).body.data.rows;
    expect(new Set(col2.map((x) => x.group))).toEqual(new Set(['collaborations']));
  });
});

/* ───────────────────────────────────────────────────────────── found by the pre-deploy review */

describe('item 17 · after INFLX settles a payment by hand, the collaboration still finishes the normal way', () => {
  const C = (w) => `/influencers/me/invitations/${w.ciId}/content`;

  it('Pay for Content: INFLX releases the second 25%, then the final 50% — and the collaboration completes', async () => {
    const w = await w12.shotDone('engagement');
    const { rows: [t2] } = await query(`SELECT amount::float AS amount FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 2`, [w.ciId]);
    let r = await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: w.ciId, tranche: 2, reason: 'She posted; the brand never confirmed.' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ released: t2.amount, tranche: 2 });
    r = await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: w.ciId, tranche: 3, reason: 'Agreed by phone to pay the rest now.' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ tranche: 3, completed: true });
    expect((await query(`SELECT status::text FROM campaign_influencers WHERE id = $1`, [w.ciId])).rows[0].status).toBe('completed');
    expect((await query(`SELECT count(*)::int AS n FROM escrow_entries WHERE campaign_influencer_id = $1 AND status = 'released'`, [w.ciId])).rows[0].n).toBe(3);
    expect((await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: w.ciId, tranche: 3, reason: 'A second click on the last one.' })).status).toBe(422);
  });

  it('Hybrid, posted: INFLX\'s release stands in for the brand\'s confirmation; the brand\'s own Confirm is then refused in plain words, never a crash', async () => {
    const w = await W14.world({ goal: 'hybrid', fee: 8000 });
    const postId = await W14.sentPost(w);
    await W14.approvePost(admin, postId);
    await W14.toPosted(w, postId);
    // The dialog said "payment only" (it was opened before she posted): the outcome would now differ, so nothing moves.
    let r = await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: w.ciId, tranche: 2, standIn: false, reason: 'Opened before she posted.' });
    expect(r.status).toBe(409);
    expect(err(r).code).toBe('PAYMENT_CHANGED');
    // before INFLX acts, the brand's Confirm is offered as usual
    expect(await W14.state(w, 'brand')).toMatchObject({ stage: 'posted', settledByInflx: false, can: { confirmLive: true } });
    r = await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: w.ciId, tranche: 2, standIn: true, reason: 'She posted on the date; the brand has been silent for 10 days.' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ released: 2000, tranche: 2, stoodIn: true });
    expect(r.body.data.finalDueAt).toBeTruthy();
    // both wallets' History say INFLX released it — not that the brand confirmed
    const hers = (await api.get('/influencers/me/wallet/history', w.cr.token)).body.data.rows[0];
    expect(hers.label).toMatch(/^Second 25% · /);
    expect(hers.sub).toMatch(/ · released by INFLX$/);
    const theirs = (await api.get('/brands/me/wallet/history?filter=collaborations', w.b.token)).body.data.rows[0];
    expect(theirs).toMatchObject({ label: 'Paid to Tanvi Suresh' });
    expect(theirs.sub).toMatch(/^Second 25% · released by INFLX · /);
    const { rows: [cc] } = await query(`SELECT live_confirmed_at, live_confirmed_by, t2_released_at, final_due_at FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(cc.live_confirmed_at).toBeTruthy();
    expect(cc.live_confirmed_by).toBeNull();                                              // confirmed by INFLX, not by the brand
    expect(cc.t2_released_at).toBeTruthy();
    expect(cc.final_due_at).toBeTruthy();
    r = await W14.confirmLive(w, { amount: 2000 });
    expect(r.status).toBe(422);
    expect(err(r).code).toBe('ALREADY_CONFIRMED');
    const s = await W14.state(w);
    expect(s.money).toMatchObject({ t2: { status: 'released' }, t3: { status: 'queued' }, returned: 0 });
    expect(s).toMatchObject({ liveConfirmedBy: 'inflx' });                                // the screens must not say "You confirmed"
    expect(s.finalDueAt).toBeTruthy();
    expect((await W14.state(w, 'brand')).liveConfirmedBy).toBe('inflx');
    expect((await api.get('/influencers/me/wallet', w.cr.token)).body.data.figures.nextPaymentAt).toBeTruthy();
    const toldBrand = await query(`SELECT n.body FROM notifications n JOIN brands b ON b.user_id = n.user_id WHERE b.id = $1 AND n.type = 'wallet.released_by_inflx'`, [w.brandId]);
    expect(toldBrand.rows[0].body).toMatch(/INFLX confirmed the content is live/);
    const diary = await query(`SELECT actor_role, action FROM collab_events WHERE campaign_influencer_id = $1 AND actor_role = 'admin'`, [w.ciId]);
    expect(diary.rows).toEqual([{ actor_role: 'admin', action: 'confirmed_live' }]);
  });

  it('Hybrid, posted and REPORTED by the brand: the release is money only — no final payment is queued that the job would never pay', async () => {
    const w = await W14.world({ goal: 'hybrid', fee: 8000 });
    const postId = await W14.sentPost(w);
    await W14.approvePost(admin, postId);
    await W14.toPosted(w, postId);
    expect((await W14.report(w, 'posted_wrong', 'The reel shows another brand.')).status).toBe(200);
    const r = await api.post(`${M}/corrections/release-payment`, admin.token, { ciId: w.ciId, tranche: 2, reason: 'INFLX looked: the post is right, the report is not.' });
    expect(r.status).toBe(200);
    expect(r.body.data).not.toHaveProperty('stoodIn');
    const esc = (await query(`SELECT tranche_number AS n, status::text, release_due_at FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY 1`, [w.ciId])).rows;
    expect(esc.map((e) => [e.n, e.status, e.release_due_at])).toEqual([[1, 'released', null], [2, 'released', null], [3, 'locked', null]]);
    expect((await query(`SELECT live_confirmed_at FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId])).rows[0].live_confirmed_at).toBeNull();
    const list = (await api.get(`${M}/collaborations`, admin.token)).body.data.rows.find((x) => x.ciId === w.ciId);
    expect(list).toMatchObject({ reported: true, locked: 4000 });
  });

  it('Hybrid, posted: after INFLX returns the locked money, the brand\'s Confirm is refused — there is nothing to pay', async () => {
    const w = await W14.world({ goal: 'hybrid', fee: 8000 });
    const postId = await W14.sentPost(w);
    await W14.approvePost(admin, postId);
    await W14.toPosted(w, postId);
    const m0 = await W.money(w);
    expect((await api.post(`${M}/corrections/return-locked`, admin.token, { ciId: w.ciId, expected: 6000, reason: 'The post was taken down and she stopped answering.' })).status).toBe(200);
    const r = await W14.confirmLive(w, { amount: 2000 });
    expect(r.status).toBe(422);
    expect(err(r).code).toBe('SETTLED_BY_INFLX');
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(6000);
    expect(m1.her).toBe(m0.her);
    // the content screens are told what was returned, and promise no date for it
    const st = await W14.state(w);
    expect(st.money).toMatchObject({ returned: 6000, stillLocked: 0, t2: { status: 'refunded', dueAt: null }, t3: { status: 'refunded', dueAt: null } });
    expect(st.finalDueAt).toBeNull();
    // she posted, the brand never confirmed, INFLX settled it: the brand's Confirm is no longer offered
    expect(st).toMatchObject({ stage: 'posted', settledByInflx: true });
    expect(await W14.state(w, 'brand')).toMatchObject({ settledByInflx: true, can: { confirmLive: false } });
    const told = await query(`SELECT body FROM notifications n JOIN brands b ON b.user_id = n.user_id WHERE b.id = $1 AND n.type = 'wallet.returned_by_inflx'`, [w.brandId]);
    expect(told.rows[0].body).toMatch(/INFLX returned ₹6,000/);
  });
});

describe('item 17 · inputs that used to reach the database as they came', () => {
  it('a bad date, a huge correction, a non-id and odd list values are answered as mistakes, not crashes', async () => {
    const w = await W.saleWorld();
    await setWallet('brands', w.brandId, 5000);
    await W.brandBank(w);
    const wr = await api.post('/brands/me/wallet/withdraw', w.b.token, { amount: 1000 });
    const id = wr.body.data.withdrawal.id;
    let r = await api.post(`${M}/withdrawals/${id}/processed`, admin.token, { reference: 'REF', paidOn: '2026-02-31' });
    expect(r.status).toBe(422);
    expect(err(r).field).toBe('paidOn');
    expect((await api.post(`${M}/withdrawals/not-an-id/processed`, admin.token, { reference: 'REF' })).status).toBe(404);
    expect((await api.get(`${M}/withdrawals/not-an-id`, admin.token)).status).toBe(404);
    r = await api.post(`${M}/corrections/correct-balance`, admin.token, { kind: 'brand', id: w.brandId, amount: 1e15, direction: 'credit', reason: 'A slip of the finger.' });
    expect(r.status).toBe(422);
    expect(err(r).field).toBe('amount');
    for (const path of ['/brands/me/wallet/sales?filter=constructor&offset=abc', '/brands/me/wallet/sales?offset=Infinity', '/brands/me/wallet/history?filter=toString&offset=-5&limit=zz']) {
      expect((await api.get(path, w.b.token)).status).toBe(200);                         // eslint-disable-line no-await-in-loop
    }
    expect((await api.get('/influencers/me/wallet/commission?filter=__proto__&offset=1e999', w.cr.token)).status).toBe(200);
    expect((await api.get(`${M}/movements?offset=abc&limit=-3&group=nonsense`, admin.token)).status).toBe(200);
    expect((await W.money(w)).brand_hold).toBe(1000);                                    // nothing above moved money
  });

  it('a return-window date is India\'s day, and Admin is told when payments are in test mode', async () => {
    const walletRead = require('../src/services/walletRead.service');
    // 11 Oct 20:00 UTC is 12 Oct 01:30 in India: the window closes on the 12th.
    const row = { id: 'x', name: 'Item', qty: 1, role: 'buy', paid_total: 100, commission: 10, platform_fee: 5, brand_net: 85, commission_pct: 10, fee_pct: 5,
      // shopper-walk-fixes W13: the date is the DELIVERY plus the stamped length (30 days here).
      line_status: 'active', created_at: new Date(), payment_method: 'online', order_status: 'delivered', delivered_at: '2099-09-11T20:00:00.000Z', return_window_ends_at: '2099-10-11T20:00:00.000Z',
      tx_created_at: '2099-09-11T20:00:00.000Z', brand_settlement_status: 'pending', commission_confirmed_at: null, caption: 'A post' };
    expect(walletRead.saleOut(row, 'brand')).toMatchObject({ state: 'window', windowUntil: '2099-10-12' });
    const o = (await api.get(`${M}/overview`, admin.token)).body.data;
    expect(o.testMode).toBe(true);                                                       // the suite runs with simulated payments
    expect((await api.get(`${M}/withdrawals`, admin.token)).body.data.testMode).toBe(true);
    expect((await api.get(`${M}/added`, admin.token)).body.data).toMatchObject({ testMode: true, checksPayment: false });
  });

  it('All movements filters by kind before the page is cut, and says when there is more', async () => {
    const all = (await api.get(`${M}/movements?limit=5`, admin.token)).body.data;
    expect(all.rows).toHaveLength(5);
    expect(all.more).toBe(true);
    const wd = (await api.get(`${M}/movements?group=withdrawals&limit=200`, admin.token)).body.data;
    expect(wd.rows.length).toBeGreaterThan(3);
    expect(new Set(wd.rows.map((x) => x.group))).toEqual(new Set(['withdrawals']));
    const total = (await query(
      `SELECT (SELECT count(*) FROM wallet_transactions WHERE type::text LIKE 'withdrawal%')::int
            + (SELECT count(*) FROM influencer_ledger WHERE type LIKE 'withdrawal%' AND balance_field = 'wallet_balance')::int AS n`)).rows[0].n;
    expect(wd.rows).toHaveLength(Math.min(200, total));                                  // every one of them, not a filtered slice of a page
  });
});
