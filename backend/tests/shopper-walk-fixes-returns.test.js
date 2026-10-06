'use strict';

/**
 * shopper-walk-fixes — the shopper's Return (01-spec.md W14; founder, 4 Oct 2026: "build return
 * option for shopper as well").
 *
 *   · only after delivery, and only inside INFLX's return window (counted from the delivery);
 *   · a deal's items go back together;
 *   · INFLX's admin approves or rejects, then marks it refunded when the item is back;
 *   · while a return is open the sale's three shares wait; refunded → the item is undone like a
 *     cancel (commission out of her pending earnings, nothing to the brand, stock back) and an online
 *     payment is sent back; cash on delivery is paid back by INFLX by hand;
 *   · rejected → nothing changes and the shares are added when the window closes.
 * Real API, real database, real orders placed through a live shoppable post.
 */

const W = require('./helpers/item17');
const W14 = require('./helpers/item14');
const w12 = require('./helpers/item12');
const settlementJob = require('../src/jobs/commerce-settlement.job');
const commissionConfirm = require('../src/jobs/commission-confirm.job');
const paymentConfig = require('../src/services/paymentConfig.service');

const { api, query } = W;
const num = (v) => Math.round(Number(v) * 100) / 100;
const err = (r) => (r.body && r.body.error) || {};
let admin;
const runJobs = async () => { await settlementJob.run(); await commissionConfirm.run(); };
const line = async (o, i = 0) => (await api.get(`/follower/orders/lines/${o.lines[i].id}`, o.sh.token)).body.data;
const ask = (o, body, i = 0) => api.post(`/follower/orders/lines/${o.lines[i].id}/return`, o.sh.token, body);
const returnsOf = async (o) => (await query(`SELECT * FROM follower_returns WHERE order_id = $1 ORDER BY created_at, id`, [o.parcel.id])).rows;
const stockOf = async (id) => (await query(`SELECT stock FROM brand_products WHERE id = $1`, [id])).rows[0].stock;

beforeAll(async () => {
  admin = await W.fresh();
  W14.resetTree();
  await query(`INSERT INTO payment_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  paymentConfig._resetCache();
  const r = await api.patch('/admin/config/payments', admin.token, { return_window_hours: 168 });   // 7 days
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  await w12.startServer();
});
afterAll(() => w12.stopServer());

describe('when she may return', () => {
  it('not before it is delivered', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    expect(await line(o)).toMatchObject({ can_return: false, return_until: null, return: null });
    const r = await ask(o, { reason: 'changed_mind' });
    expect(r.status).toBe(409);
    expect(err(r).message).toBe('You can return it once it is delivered.');
    await W.ship(w, o.parcel.id);
    expect((await ask(o, { reason: 'changed_mind' })).status).toBe(409);
  });

  it('inside the window after delivery: she is shown until when, what goes back and what she gets', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    await W.deliver(w, o.parcel.id);
    const d = await line(o);
    expect(d.can_return).toBe(true);
    const until = new Date(d.return_until).getTime();
    expect(Math.round((until - Date.now()) / 3600000)).toBe(168);                        // 7 days from the delivery
    const p = await api.get(`/follower/orders/lines/${o.lines[0].id}/return`, o.sh.token);
    expect(p.status).toBe(200);
    expect(p.body.data).toMatchObject({ window: '7 days', warning: null, refund: { amount: num(o.lines[0].paid_total) } });
    expect(p.body.data.lines.map((l) => l.id)).toEqual([o.lines[0].id]);
    expect(p.body.data.reasons.map((x) => x.key)).toEqual(['wrong_size', 'damaged', 'not_as_described', 'changed_mind', 'other']);
    expect(p.body.data.refund.text).toMatch(/original payment method/);
  });

  it('not after the window has closed — and the sentence says the window', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    await query(`UPDATE follower_transactions SET created_at = created_at - interval '20 days', return_window_ends_at = return_window_ends_at - interval '20 days' WHERE id = $1`, [o.tx.id]);
    await W.deliver(w, o.parcel.id);
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '169 hours' WHERE id = $1`, [o.parcel.id]);
    const d = await line(o);
    expect(d.can_return).toBe(false);
    expect(d.return_closed).toBe('The return window (7 days from delivery) has closed.');
    const r = await ask(o, { reason: 'changed_mind' });
    expect(r.status).toBe(409);
    expect(err(r).message).toBe('The return window (7 days from delivery) has closed.');
  });

  it('the window is the one stamped on HER sale: a later change of the admin number does not move it', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);                                                     // stamped 7 days
    await api.patch('/admin/config/payments', admin.token, { return_window_hours: 24 });
    await W.deliver(w, o.parcel.id);
    await query(`UPDATE follower_transactions SET created_at = created_at - interval '5 days', return_window_ends_at = return_window_ends_at - interval '5 days' WHERE id = $1`, [o.tx.id]);
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '48 hours' WHERE id = $1`, [o.parcel.id]);
    expect((await line(o)).can_return).toBe(true);                                       // 2 days in, of her 7
    await api.patch('/admin/config/payments', admin.token, { return_window_hours: 168 });
  });

  it('a reason is needed, "Other" needs a note, and nobody else can ask', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    await W.deliver(w, o.parcel.id);
    expect((await ask(o, {})).status).toBe(400);
    expect((await ask(o, { reason: 'because' })).status).toBe(400);
    expect((await ask(o, { reason: 'other' })).status).toBe(400);
    const other = await W.shopper();
    expect((await api.post(`/follower/orders/lines/${o.lines[0].id}/return`, other.token, { reason: 'changed_mind' })).status).toBe(404);
    expect((await api.get(`/follower/orders/lines/${o.lines[0].id}/return`, other.token)).status).toBe(404);
    expect((await api.post(`/follower/orders/lines/${o.lines[0].id}/return`, w.b.token, { reason: 'changed_mind' })).status).toBe(403);
    expect(await returnsOf(o)).toHaveLength(0);
  });
});

describe('asking, and what waits meanwhile', () => {
  it('one request; the item says "Return requested"; all three shares wait though the window has closed', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    const ln = o.lines[0];
    await query(`UPDATE follower_transactions SET created_at = created_at - interval '20 days', return_window_ends_at = return_window_ends_at - interval '20 days' WHERE id = $1`, [o.tx.id]);
    await W.deliver(w, o.parcel.id);
    const m0 = await W.money(w);
    const r = await ask(o, { reason: 'wrong_size', note: 'Too tight at the waist' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'requested', word: 'Return requested', lines: [ln.id] });
    expect((await ask(o, { reason: 'wrong_size' })).status).toBe(409);                   // once
    const d = await line(o);
    expect(d).toMatchObject({ can_return: false, status: 'delivered' });
    expect(d.return).toMatchObject({ status: 'requested', word: 'Return requested', reason: "The size doesn't fit", note: 'Too tight at the waist' });
    // the window closes while INFLX is still looking: nothing is added
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '200 hours' WHERE id = $1`, [o.parcel.id]);
    await runJobs();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    // the brand sees it on its parcel, and cannot decide it
    const parcel = (await api.get('/brands/me/parcels', w.b.token)).body.data.parcels.find((p) => p.id === o.parcel.id);
    // shopper-deal-orders (part B, 5 Oct 2026): the brand's parcel also says the KIND of request — this one is a return,
    // as every request was. (Was: { status, word }.)
    expect(parcel.items[0].return).toEqual({ status: 'requested', kind: 'return', word: 'Return requested' });
    const [row] = await returnsOf(o);
    expect((await api.post(`/admin/returns/${row.id}/approve`, w.b.token, {})).status).toBe(403);
  });
});

describe('INFLX decides', () => {
  it('rejected: a note is needed, she is told why, and the sale stands — its shares are added', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    const ln = o.lines[0];
    await query(`UPDATE follower_transactions SET created_at = created_at - interval '20 days', return_window_ends_at = return_window_ends_at - interval '20 days' WHERE id = $1`, [o.tx.id]);
    await W.deliver(w, o.parcel.id);
    const m0 = await W.money(w);
    await ask(o, { reason: 'changed_mind' });
    const [row] = await returnsOf(o);
    expect((await api.post(`/admin/returns/${row.id}/reject`, admin.token, {})).status).toBe(422);
    const rej = await api.post(`/admin/returns/${row.id}/reject`, admin.token, { admin_notes: 'Worn and washed' });
    expect(rej.status).toBe(200);
    expect(rej.body.data.return_status).toBe('rejected');
    const d = await line(o);
    expect(d.return).toMatchObject({ status: 'rejected', word: 'Return not accepted', inflx_note: 'Worn and washed' });
    expect(d.can_return).toBe(false);                                                    // one answer per item
    expect(d.status).toBe('delivered');
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '200 hours' WHERE id = $1`, [o.parcel.id]);
    await runJobs();
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(num(ln.brand_net));
    expect(num(m1.her - m0.her)).toBe(num(ln.commission));
  });

  it('approved, then refunded: the item is undone like a cancel and the online payment is sent back', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0, 1]);                                                  // two items; she returns one
    const [gone, kept] = o.lines;
    await query(`UPDATE follower_transactions SET created_at = created_at - interval '20 days', return_window_ends_at = return_window_ends_at - interval '20 days' WHERE id = $1`, [o.tx.id]);
    await W.deliver(w, o.parcel.id);
    await query(`UPDATE brand_products SET stock = 4 WHERE id = $1`, [gone.product_id]);
    const m0 = await W.money(w);
    await ask(o, { reason: 'damaged' });
    const [row] = await returnsOf(o);
    expect(row).toMatchObject({ order_line_id: gone.id, return_status: 'requested' });
    // refunded cannot be marked before it is approved
    expect((await api.post(`/admin/returns/${row.id}/mark-refunded`, admin.token, {})).status).toBe(404);
    const ap = await api.post(`/admin/returns/${row.id}/approve`, admin.token, { refund_amount: 1 });
    expect(ap.status).toBe(200);
    expect(ap.body.data).toMatchObject({ return_status: 'approved', items: 1, refund_amount: num(gone.paid_total) });   // what was paid, not the typed 1
    expect((await line(o)).return).toMatchObject({ status: 'approved', word: 'Return approved' });
    const done = await api.post(`/admin/returns/${row.id}/mark-refunded`, admin.token, {});
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ return_status: 'refunded', refund: { amount: num(gone.paid_total), status: 'issued' } });
    expect((await api.post(`/admin/returns/${row.id}/mark-refunded`, admin.token, {})).status).toBe(404);   // once

    const d = await line(o);
    expect(d).toMatchObject({ status: 'returned', status_word: 'Returned', can_return: false, can_cancel: false });
    expect(d.return).toMatchObject({ status: 'refunded', word: 'Returned', refund: { status: 'issued', amount: num(gone.paid_total) } });
    expect(d.timeline[d.timeline.length - 1]).toMatchObject({ status: 'returned', word: 'Returned' });
    // My orders: it is under "Returned", not under "Cancelled"
    const listed = async (status) => (await api.get(`/follower/orders?status=${status}`, o.sh.token)).body.data.items.map((x) => x.id);
    expect(await listed('returned')).toEqual([gone.id]);
    expect(await listed('cancelled')).toEqual([]);
    expect(await listed('delivered')).toEqual([kept.id]);
    expect(await stockOf(gone.product_id)).toBe(5);                                      // back on the shelf
    const { rows: [l] } = await query(`SELECT status, cancelled_by, cancel_reason, refund_status FROM order_lines WHERE id = $1`, [gone.id]);
    expect(l).toEqual({ status: 'cancelled', cancelled_by: 'return', cancel_reason: 'It arrived damaged', refund_status: 'issued' });
    const { rows: [tx] } = await query(`SELECT status, commission_reversed::float AS c, brand_net_reversed::float AS b, platform_fee_reversed::float AS f FROM follower_transactions WHERE id = $1`, [o.tx.id]);
    expect(tx).toEqual({ status: 'completed', c: num(gone.commission), b: num(gone.brand_net), f: num(gone.platform_fee) });
    const m1 = await W.money(w);
    expect(num(m0.her_pending - m1.her_pending)).toBe(num(gone.commission));             // out of what was still pending
    expect(m1).toMatchObject({ brand: m0.brand, her: m0.her });                          // nothing reached a wallet
    // the kept item settles alone when the window closes
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '200 hours' WHERE id = $1`, [o.parcel.id]);
    await runJobs();
    const m2 = await W.money(w);
    expect(num(m2.brand - m0.brand)).toBe(num(kept.brand_net));
    expect(num(m2.her - m0.her)).toBe(num(kept.commission));
    // the brand's wallet says "returned", with nothing for it
    const sale = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data.sales.find((s) => s.id === gone.id);
    expect(sale).toMatchObject({ state: 'returned', brandShare: 0, creatorShare: 0, inflxShare: 0 });
    const item = (await api.get('/brands/me/parcels', w.b.token)).body.data.parcels.find((p) => p.id === o.parcel.id).items.find((i) => i.id === gone.id);
    expect(item).toMatchObject({ status: 'cancelled', cancelled_by: 'return', return: { status: 'refunded', word: 'Returned' } });
  });

  it('cash on delivery: there is no payment to send back, so INFLX pays it by hand', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0], { method: 'cod' });
    await W.deliver(w, o.parcel.id);
    expect((await api.get(`/follower/orders/lines/${o.lines[0].id}/return`, o.sh.token)).body.data.refund.text).toMatch(/You paid cash, so INFLX sends it to you directly/);
    await ask(o, { reason: 'not_as_described' });
    const [row] = await returnsOf(o);
    await api.post(`/admin/returns/${row.id}/approve`, admin.token, {});
    const done = await api.post(`/admin/returns/${row.id}/mark-refunded`, admin.token, {});
    expect(done.body.data.refund).toEqual({ amount: num(o.lines[0].paid_total), status: 'manual' });
    expect((await line(o)).return.refund).toEqual({ status: 'manual', amount: num(o.lines[0].paid_total) });
    // the whole sale is gone
    const { rows: [tx] } = await query(`SELECT status, brand_settlement_status FROM follower_transactions WHERE id = $1`, [o.tx.id]);
    expect(tx).toEqual({ status: 'refunded', brand_settlement_status: 'reversed' });
  });

  it('the admin list shows the item, what was paid for it, and how it was paid', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    await W.deliver(w, o.parcel.id);
    await ask(o, { reason: 'changed_mind' });
    const list = await api.get('/admin/returns?status=requested', admin.token);
    expect(list.status).toBe(200);
    const row = list.body.data.returns.find((r) => r.order_line_id === o.lines[0].id);
    expect(row).toMatchObject({ product_name: o.lines[0].name, transaction_amount: String(o.lines[0].paid_total), payment_method: 'prepaid', request_items: 1 });
  });
});

describe('a deal goes back together', () => {
  it('returning one item of a buy-more-save-more deal returns the deal\'s items together, as a cancel would', async () => {
    const w = await W.saleWorld();
    // The same post, its offer turned into "Buy 2 → 20% off": both items bought are then one deal.
    await query(
      `UPDATE brand_offers SET offer_type = 'volume', sub_type = 'quantity', offer_config_json = $2::jsonb WHERE id = $1`,
      [w.deal, JSON.stringify({ reward: 'pct', tiers: [{ at: 2, value: 20 }] })]);
    const o = await W.order(w, [0, 1]);
    expect(o.lines.map((l) => l.deal_key)).toEqual(['volume', 'volume']);
    await W.deliver(w, o.parcel.id);
    const p = (await api.get(`/follower/orders/lines/${o.lines[0].id}/return`, o.sh.token)).body.data;
    expect(p.lines.map((l) => l.id).sort()).toEqual(o.lines.map((l) => l.id).sort());
    expect(p.warning).toBe('This is part of a deal. Returning it returns 2 items together.');
    expect(p.refund.amount).toBe(num(Number(o.lines[0].paid_total) + Number(o.lines[1].paid_total)));
    const r = await ask(o, { reason: 'changed_mind' });
    expect(r.status).toBe(200);
    expect(r.body.data.lines.sort()).toEqual(o.lines.map((l) => l.id).sort());
    const rows = await returnsOf(o);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((x) => x.request_id)).size).toBe(1);                         // one request
    expect((await line(o, 1)).return).toMatchObject({ status: 'requested' });            // the other item says so too
    expect((await ask(o, { reason: 'changed_mind' }, 1)).status).toBe(409);              // and cannot be asked again
    // INFLX approves one row: both are approved; refunded: both are undone, one refund for the two
    const ap = await api.post(`/admin/returns/${rows[1].id}/approve`, admin.token, {});
    expect(ap.body.data).toMatchObject({ return_status: 'approved', items: 2 });
    const done = await api.post(`/admin/returns/${rows[0].id}/mark-refunded`, admin.token, {});
    expect(done.status).toBe(200);
    expect(done.body.data.refund).toMatchObject({ status: 'issued', amount: p.refund.amount });
    expect((await line(o, 0)).status).toBe('returned');
    expect((await line(o, 1)).status).toBe('returned');
    const { rows: [tx] } = await query(`SELECT status, brand_settlement_status FROM follower_transactions WHERE id = $1`, [o.tx.id]);
    expect(tx).toEqual({ status: 'refunded', brand_settlement_status: 'reversed' });
  });
});
