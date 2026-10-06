'use strict';

/**
 * shopper-deal-orders, part B — one item of a delivered deal is replaced, or its share refunded
 * (01-spec.md B1–B8 · the founder's rules D2, D3, D5 · my notes E2–E12 · migration 204).
 *
 *   the size doesn't fit       → another size of the same product that is in stock; the deal stays, no money moves
 *   damaged · not as shown     → the same item again when the store has one; otherwise ONLY that
 *                                item's share is refunded and she keeps the rest (never for a pair)
 *   INFLX decides; the brand sends, then marks it delivered; the window runs again from that delivery
 *
 * Real orders through a live "any 3 for ₹2,999" post whose products have colours and sizes with stock.
 */

const D = require('./helpers/dealWorld');
const settlementJob = require('../src/jobs/commerce-settlement.job');
const commissionConfirm = require('../src/jobs/commission-confirm.job');
const paymentConfig = require('../src/services/paymentConfig.service');
const returns = require('../src/services/shopperReturns.service');
const settlement = require('../src/services/settlement.service');
const fs = require('fs');
const path = require('path');

const { api, query, line } = D;
const SIZED = () => ({ colors: [
  { color: 'Indigo', images: [], sizes: [{ size: '30', stock: 5 }, { size: '32', stock: 50 }, { size: '34', stock: 5 }, { size: '36', stock: 0 }] },
  { color: 'Black', images: [], sizes: [{ size: '32', stock: 5 }] },
] });
const NOTE = 'The stitching at the left pocket has come apart.';
let admin; let W; let PAIR;

const sizeStock = async (productId, colour, size) => {
  const { rows: [p] } = await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [productId]);
  return p.variants_json.colors.find((c) => c.color === colour).sizes.find((s) => s.size === size).stock;
};
async function setStock(productId, colour, size, n) {
  const { rows: [p] } = await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [productId]);
  p.variants_json.colors.find((c) => c.color === colour).sizes.find((s) => s.size === size).stock = n;
  await query(`UPDATE brand_products SET variants_json = $2::jsonb WHERE id = $1`, [productId, JSON.stringify(p.variants_json)]);
}
const i32 = (w, i, extra = {}) => line(w, i, { colour: 'Indigo', size: '32', ...extra });
/** A shopper with the bundle of three (Indigo · 32 each), paid online and delivered. Returns { sh, o, jeans, shirt, polo } (the order's lines). */
async function deliveredBundle(w = W, { method = 'online', lines = null } = {}) {
  const sh = await D.shopper();
  const o = await D.order(sh, lines || [i32(w, 0), i32(w, 1), i32(w, 2)], { method });
  await D.move(w, o.parcels[0].id, 'delivered');
  const by = (i) => o.lines.find((l) => l.product_id === w.ids[i]);
  return { sh, o, polo: by(0), shirt: by(1), jeans: by(2), tx: o.lines[0].transaction_id, parcel: o.parcels[0] };
}
const preview = (sh, lineId) => api.get(`/follower/orders/lines/${lineId}/replace`, sh.token);
const ask = (sh, lineId, body) => api.post(`/follower/orders/lines/${lineId}/replace`, sh.token, body);
const page = async (sh, lineId) => (await api.get(`/follower/orders/lines/${lineId}`, sh.token)).body.data;
const requestsOf = async (lineIds) => (await query(`SELECT * FROM follower_returns WHERE order_line_id = ANY($1::uuid[]) ORDER BY created_at, id`, [[].concat(lineIds)])).rows;
const approve = (id) => api.post(`/admin/returns/${id}/approve`, admin.token, {});
const reject = (id, note) => api.post(`/admin/returns/${id}/reject`, admin.token, { admin_notes: note });
const refunded = (id) => api.post(`/admin/returns/${id}/mark-refunded`, admin.token, {});
const sendIt = (w, id, status) => api.patch(`/brands/me/replacements/${id}/status`, w.b.token, { status });
const txOf = async (id) => (await query(`SELECT * FROM follower_transactions WHERE id = $1`, [id])).rows[0];
const lineOf = async (id) => (await query(`SELECT * FROM order_lines WHERE id = $1`, [id])).rows[0];
const runJobs = async () => { await settlementJob.run(); await commissionConfirm.run(); };
/** The sale was made `days` ago: its own stamp (made + the window in force then) moves with it, keeping its length. */
const aged = (txId, days) => query(
  `UPDATE follower_transactions SET created_at = created_at - ($2 || ' days')::interval, return_window_ends_at = return_window_ends_at - ($2 || ' days')::interval WHERE id = $1`, [txId, String(days)]);
/** A replacement of `it` with another size, taken all the way to delivered. Returns the request row. */
async function replaced(w, sh, it, size = '34') {
  const r = await ask(sh, it.id, { reason: 'wrong_size', colour: 'Indigo', size, expect: 'replace' });
  if (r.status !== 200) throw new Error(`ask: ${JSON.stringify(r.body)}`);
  const [row] = await requestsOf(it.id);
  for (const step of [() => approve(row.id), () => sendIt(w, row.id, 'sent'), () => sendIt(w, row.id, 'delivered')]) {
    const x = await step(); // eslint-disable-line no-await-in-loop
    if (x.status !== 200) throw new Error(`step: ${JSON.stringify(x.body)}`);
  }
  return (await requestsOf(it.id))[0];
}

beforeAll(async () => {
  admin = await D.fresh();
  await query(`INSERT INTO payment_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  paymentConfig._resetCache();
  W = await D.world('pick3', undefined, { brand: 'Aveen fashion boutique', variants: SIZED() });
  PAIR = await D.world('bogo', undefined, { brand: 'Aveen fashion boutique', variants: SIZED() });
});

/* ═══════════════════════════════════════════ what she is offered (R1, R2, R3, R7) */

describe('Return or replace — what one item can be asked (BS1)', () => {
  test('BS1 the deal, until when, three reasons, each item with its sizes, and the whole-deal return', async () => {
    const { sh, jeans } = await deliveredBundle();
    const r = await preview(sh, jeans.id);
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.deal).toEqual({ line: 'Any 3 for ₹2,999', creator: 'Akshaya Reddy', brand: 'Aveen fashion boutique' });
    expect(new Date(d.until).getTime()).toBeGreaterThan(Date.now());
    expect(d.reasons).toEqual([{ key: 'wrong_size', label: "The size doesn't fit" }, { key: 'damaged', label: 'It arrived damaged' }, { key: 'not_as_described', label: "It isn't as shown" }]);
    expect(d.whole).toEqual({ can: true, count: 3, amount: 2999 });
    expect(d.items).toHaveLength(3);
    const it = d.items.find((x) => x.id === jeans.id);
    expect(it).toMatchObject({ colour: 'Indigo', size: '32', qty: 1, role: 'buy', can: true, why: null, replaced: false, pair: false, other_size: true, same_in_stock: true });
    // E3: any size of the same product, in the same or another colour; the one she has is marked, a sold-out one is not on offer
    expect(it.colours).toEqual([
      { colour: 'Indigo', sizes: [{ size: '30', current: false, in_stock: true }, { size: '32', current: true, in_stock: true }, { size: '34', current: false, in_stock: true }, { size: '36', current: false, in_stock: false }] },
      { colour: 'Black', sizes: [{ size: '32', current: false, in_stock: true }] },
    ]);
    // its share of the ₹2,999 (split by normal prices), should the store be at fault and have no more
    expect(it.refund.amount).toBe(Number(jeans.paid_total));
    expect(d.items.reduce((s, x) => s + x.refund.amount, 0)).toBe(2999);
    expect(it.refund.text).toBe(`Refund of ₹${Number(jeans.paid_total).toLocaleString('en-IN')} to your original payment method once it is back.`);
  });

  test('R7 no other size in stock: `other_size` is false — she keeps it or returns the whole deal', async () => {
    const w = await D.world('pick3', undefined, { brand: 'Aveen fashion boutique',
      variants: { colors: [{ color: 'Indigo', images: [], sizes: [{ size: '32', stock: 9 }, { size: '34', stock: 0 }] }] } });
    const { sh, jeans } = await deliveredBundle(w);
    const it = (await preview(sh, jeans.id)).body.data.items.find((x) => x.id === jeans.id);
    expect([it.other_size, it.same_in_stock]).toEqual([false, true]);
    const r = await ask(sh, jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' });
    expect([r.status, r.body.error.code]).toEqual([409, 'STOCK_UNAVAILABLE']);
    expect(await requestsOf(jeans.id)).toEqual([]);
    // E4: no one-item refund for a size — the whole deal can still go back
    expect((await api.post(`/follower/orders/lines/${jeans.id}/return`, sh.token, { reason: 'wrong_size' })).status).toBe(200);
  });

  test('BS12 who cannot ask: before delivery, after the window, for an item in no deal, another shopper, a second time', async () => {
    const sh = await D.shopper();
    const early = await D.order(sh, [i32(W, 0), i32(W, 1), i32(W, 2)]);
    expect((await preview(sh, early.lines[0].id)).body.error.message).toBe('You can ask once it is delivered.');
    expect((await ask(sh, early.lines[0].id, { reason: 'wrong_size', colour: 'Indigo', size: '34' })).status).toBe(409);

    const late = await deliveredBundle();
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '8 days' WHERE id = $1`, [late.parcel.id]);
    expect((await preview(late.sh, late.jeans.id)).body.error.message).toBe('The return window (7 days from delivery) has closed.');
    expect((await ask(late.sh, late.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' })).status).toBe(409);

    const alone = await deliveredBundle(W, { lines: [i32(W, 2)] });          // one item of the bundle post, bought alone: in no deal
    const one = alone.o.lines[0];
    expect((await preview(alone.sh, one.id)).body.error.message).toBe('This item is not part of a deal. You can return it on its own.');
    expect((await ask(alone.sh, one.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' })).status).toBe(409);

    const mine = await deliveredBundle();
    const other = await D.shopper('Someone Else');
    expect((await preview(other, mine.jeans.id)).status).toBe(404);
    expect((await ask(other, mine.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' })).status).toBe(404);
    expect((await ask(mine.sh, mine.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' })).status).toBe(200);
    // while one request is open nothing else can be asked for that deal — not another item, not a return
    const again = await ask(mine.sh, mine.polo.id, { reason: 'wrong_size', colour: 'Indigo', size: '30' });
    expect([again.status, again.body.error.message]).toEqual([409, 'You have already asked about this deal. INFLX is looking at it.']);
    expect((await preview(mine.sh, mine.polo.id)).status).toBe(409);
    expect((await api.post(`/follower/orders/lines/${mine.polo.id}/return`, mine.sh.token, { reason: 'changed_mind' })).status).toBe(409);
  });

  test('what she must send: a reason of the three; another size for "doesn\'t fit"; a note for damaged or not as shown', async () => {
    const { sh, jeans } = await deliveredBundle();
    expect((await ask(sh, jeans.id, { reason: 'changed_mind' })).body.error.field).toBe('reason');       // for that the whole deal goes back
    expect((await ask(sh, jeans.id, {})).body.error.field).toBe('reason');
    expect((await ask(sh, jeans.id, { reason: 'wrong_size' })).body.error.field).toBe('size');
    expect((await ask(sh, jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '32' })).body.error.field).toBe('size');   // the one she has
    expect((await ask(sh, jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '99' })).body.error.field).toBe('size');
    expect((await ask(sh, jeans.id, { reason: 'damaged' })).body.error.field).toBe('note');
    expect((await ask(sh, jeans.id, { reason: 'not_as_described', note: '   ' })).body.error.field).toBe('note');
    expect(await requestsOf(jeans.id)).toEqual([]);
  });
});

/* ═══════════════════════════════════════════ a replacement, start to finish (R3, R8, R9, R10) */

describe('the size doesn\'t fit → another size (BS2–BS5)', () => {
  let b; let row; let stock34; let stock32; let money0;

  test('BS2 she asks: a replacement is recorded, nothing is taken from stock yet, and her deal says "Replacement requested"', async () => {
    b = await deliveredBundle();
    stock34 = await sizeStock(W.ids[2], 'Indigo', '34');
    stock32 = await sizeStock(W.ids[2], 'Indigo', '32');
    money0 = { tx: await txOf(b.tx), line: await lineOf(b.jeans.id) };
    const r = await ask(b.sh, b.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '34', expect: 'replace' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ kind: 'replace', status: 'requested', word: 'Replacement requested', line_id: b.jeans.id });
    [row] = await requestsOf(b.jeans.id);
    expect(row).toMatchObject({ kind: 'replace', return_status: 'requested', reason: 'wrong_size', from_colour: 'Indigo', from_size: '32', to_colour: 'Indigo', to_size: '34',
      replacement_status: null, sold_out: false });
    expect(Number(row.refund_amount)).toBe(0);
    expect(await sizeStock(W.ids[2], 'Indigo', '34')).toBe(stock34);                     // not taken until INFLX approves
    // R8 · 1 of 3 — on the deal's page (whichever of its items is opened) and on its card
    for (const id of [b.jeans.id, b.polo.id]) {
      const d = await page(b.sh, id);
      expect(d.return).toMatchObject({ kind: 'replace', status: 'requested', word: 'Replacement requested', reason: "The size doesn't fit",
        replace: { name: b.jeans.name, from: { colour: 'Indigo', size: '32' }, to: { colour: 'Indigo', size: '34' }, state: null } });
      expect([d.can_return, d.can_replace]).toEqual([false, false]);
    }
    const [card] = (await api.get('/follower/orders?by=deal', b.sh.token)).body.data.items;
    expect(card.return.word).toBe('Replacement requested');
    // the brand's own parcel says which kind of request is open on it — a replacement, not a return
    const parcelItem = async () => (await api.get('/brands/me/parcels', W.b.token)).body.data.parcels.flatMap((p) => p.items).find((it) => it.id === b.jeans.id);
    expect((await parcelItem()).return).toEqual({ status: 'requested', kind: 'replace', word: 'Replacement requested' });
    expect((await api.get('/brands/me/parcels', W.b.token)).body.data.parcels.flatMap((p) => p.items).find((it) => it.id === b.polo.id).return).toBeFalsy();
    // the store has nothing to send until INFLX has approved it
    expect((await api.get('/brands/me/replacements', W.b.token)).body.data.replacements.map((x) => x.id)).not.toContain(row.id);
  });

  test('BS14 INFLX\'s Returns lists it as a Replace: what is swapped, the deal, and that no money moves', async () => {
    const list = (await api.get('/admin/returns?status=requested', admin.token)).body.data.returns;
    const mine = list.find((x) => x.id === row.id);
    expect(mine).toMatchObject({ kind: 'replace', reason: 'wrong_size', from_size: '32', to_size: '34', from_colour: 'Indigo', to_colour: 'Indigo',
      deal_line: 'Any 3 for ₹2,999', deal_paid: 2999, request_items: 1, product_name: b.jeans.name });
    expect(Number(mine.refund_amount)).toBe(0);
    // "Mark refunded" is not for a replacement
    const no = await refunded(row.id);
    expect(no.status).toBe(404);                                                         // not yet approved: not refundable
  });

  test('BS3 INFLX approves: the 34 is taken from stock, the brand has a replacement to send, she is told the store will bring it', async () => {
    const r = await approve(row.id);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ kind: 'replace', return_status: 'approved' });
    expect(await sizeStock(W.ids[2], 'Indigo', '34')).toBe(stock34 - 1);
    expect(await sizeStock(W.ids[2], 'Indigo', '32')).toBe(stock32);                     // the 32 is still with her
    expect((await requestsOf(b.jeans.id))[0]).toMatchObject({ return_status: 'approved', replacement_status: 'to_send' });
    expect((await page(b.sh, b.jeans.id)).return).toMatchObject({ word: 'Replacement approved', replace: { state: 'to_send', to: { size: '34' } } });
    expect((await api.get('/brands/me/parcels', W.b.token)).body.data.parcels.flatMap((p) => p.items).find((it) => it.id === b.jeans.id).return)
      .toEqual({ status: 'approved', kind: 'replace', word: 'Replacement approved — send it' });
    // R9 — the brand's Order Fulfillment
    const mine = (await api.get('/brands/me/replacements', W.b.token)).body.data.replacements.find((x) => x.id === row.id);
    expect(mine).toMatchObject({
      status: 'to_send', status_word: 'To send', shopper: 'Anusha K', deal: 'Any 3 for ₹2,999', creator: 'Akshaya Reddy', reason: "The size doesn't fit",
      send: { name: b.jeans.name, colour: 'Indigo', size: '34' }, collect: { name: b.jeans.name, colour: 'Indigo', size: '32' },
      money: 'Nothing is added to or taken from your wallet for a replacement.',
    });
    expect(mine.address).toMatchObject({ city: 'Hyderabad', pincode: '500081' });
    // still "Mark refunded" is refused: a replacement has no refund
    const no = await refunded(row.id);
    expect([no.status, no.body.error.message]).toEqual([409, 'A replacement has no refund. The store marks it sent, then delivered.']);
    // and another brand cannot see or move it
    expect((await api.get('/brands/me/replacements', PAIR.b.token)).body.data.replacements).toEqual([]);
    expect((await sendIt(PAIR, row.id, 'sent')).status).toBe(404);
  });

  test('BS4 the brand marks it sent, then delivered — in that order; her jeans are now the 34, the 32 is back in stock, no money moved', async () => {
    expect((await sendIt(W, row.id, 'delivered')).body.error.message).toBe('Mark it sent first.');
    expect((await sendIt(W, row.id, 'packed')).status).toBe(400);
    const sent = await sendIt(W, row.id, 'sent');
    expect(sent.body.data.replacement).toMatchObject({ status: 'sent', status_word: 'Sent' });
    expect((await sendIt(W, row.id, 'sent')).body.error.message).toBe('It is already marked sent.');
    expect((await page(b.sh, b.jeans.id)).return.replace.state).toBe('sent');
    expect((await txOf(b.tx)).return_window_restart_at).toBeNull();                      // not yet: only a delivery restarts the window

    const done = await sendIt(W, row.id, 'delivered');
    expect(done.status).toBe(200);
    expect(done.body.data.replacement).toMatchObject({ status: 'delivered', status_word: 'Delivered' });
    expect((await sendIt(W, row.id, 'delivered')).body.error.message).toBe('This replacement is already delivered.');

    const now = await lineOf(b.jeans.id);
    expect([now.colour, now.size, now.status]).toEqual(['Indigo', '34', 'active']);
    expect(await sizeStock(W.ids[2], 'Indigo', '32')).toBe(stock32 + 1);                 // a size that did not fit goes back on sale
    expect(await sizeStock(W.ids[2], 'Indigo', '34')).toBe(stock34 - 1);
    expect((await requestsOf(b.jeans.id))[0]).toMatchObject({ return_status: 'replaced', replacement_status: 'delivered' });
    // no money moved: the item's price and shares, and the sale's, are what they were
    for (const k of ['paid_total', 'commission', 'platform_fee', 'brand_net', 'refund_amount', 'refund_status']) expect(now[k]).toEqual(money0.line[k]);
    const tx = await txOf(b.tx);
    for (const k of ['commission_reversed', 'brand_net_reversed', 'platform_fee_reversed', 'status', 'brand_settlement_status']) expect(tx[k]).toEqual(money0.tx[k]);
    // R8 · 3 of 3
    const d = await page(b.sh, b.jeans.id);
    expect(d.return).toMatchObject({ kind: 'replace', status: 'replaced', word: 'Replaced', replace: { state: 'delivered', to: { colour: 'Indigo', size: '34' } } });
    expect(typeof d.return.replace.delivered_at).toBe('string');
    expect(d.deal.lines.find((x) => x.id === b.jeans.id)).toMatchObject({ size: '34', state: null });
    expect(d.deal.paid).toBe(2999);
    expect((await api.get('/admin/returns?status=replaced', admin.token)).body.data.returns.map((x) => x.id)).toContain(row.id);
  });

  test('BS5 the window runs again from the replacement\'s delivery: she can still return the deal, and the money waits for the new window', async () => {
    // The sale was made 20 days ago and its parcel delivered 10 days ago — its own 7-day window is long over.
    // (The sale's stamp is moved with it, keeping its length: only the replacement can be what holds the money now.)
    await aged(b.tx, 20);
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '10 days' WHERE id = $1`, [b.parcel.id]);
    const restart = new Date((await txOf(b.tx)).return_window_restart_at);
    expect(Date.now() - restart.getTime()).toBeLessThan(60000);
    const d = await page(b.sh, b.polo.id);
    expect([d.can_return, d.can_replace]).toEqual([true, true]);
    expect(Math.round((new Date(d.return_until).getTime() - restart.getTime()) / 3600000)).toBe(168);
    await runJobs();
    let tx = await txOf(b.tx);
    expect([tx.commission_confirmed_at, tx.brand_settlement_status]).toEqual([null, 'pending']);
    // the brand's wallet page says the same day
    // each guard on its own: the settlement service refuses it while the new window is open …
    expect(await settlement.settleCommerceTransaction(null, b.tx)).toEqual({ skipped: 'window_open' });
    // … and the brand's wallet page says the new day, not the one that passed three days ago
    const sale = (await api.get('/brands/me/wallet/sales', W.b.token)).body.data.sales.find((s) => s.id === b.jeans.id);
    expect(sale.state).toBe('window');
    expect(new Date(`${sale.windowUntil}T23:59:59+05:30`).getTime()).toBeGreaterThan(Date.now());
    expect(Math.round((new Date(`${sale.windowUntil}T12:00:00+05:30`).getTime() - restart.getTime()) / 86400000)).toBe(7);
    // Eight days after the replacement was delivered the new window has closed: now it is released.
    await query(`UPDATE follower_transactions SET return_window_restart_at = now() - interval '8 days' WHERE id = $1`, [b.tx]);
    expect((await page(b.sh, b.polo.id)).can_return).toBe(false);
    await runJobs();
    tx = await txOf(b.tx);
    expect(tx.commission_confirmed_at).not.toBeNull();
    expect(tx.brand_settlement_status).toBe('settled');
  });

  test('the job that adds the brand\'s share picks its sales by the same clock as the service that pays them', () => {
    // The job's own query and the service each hold a sale until the window — counted from the
    // replacement's delivery — has closed. The service is the one that pays, so a job that forgot
    // the restart would only hand it sales it then refuses; this keeps the two saying the same thing.
    const src = (f) => fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8');
    const clock = /GREATEST\((fo2?)\.delivered_at, COALESCE\(ft\.return_window_restart_at, \1\.delivered_at\)\) \+ \(ft\.return_window_ends_at - ft\.created_at\) <= NOW\(\)/i;
    expect(src('jobs/commerce-settlement.job.js')).toMatch(clock);
    expect(src('jobs/commission-confirm.job.js')).toMatch(clock);
    expect(src('services/settlement.service.js')).toMatch(clock);
    for (const f of ['jobs/commerce-settlement.job.js', 'jobs/commission-confirm.job.js', 'services/settlement.service.js']) {
      expect(src(f)).not.toMatch(/[^(,] fo2?\.delivered_at \+ \(ft\.return_window_ends_at/);      // no clock left that starts at the first delivery only
    }
  });

  test('an open replacement holds the sale\'s money even when its window has closed', async () => {
    const x = await deliveredBundle();
    await ask(x.sh, x.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '30' });
    await aged(x.tx, 20);
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '9 days' WHERE id = $1`, [x.parcel.id]);
    await runJobs();
    let tx = await txOf(x.tx);
    expect([tx.commission_confirmed_at, tx.brand_settlement_status]).toEqual([null, 'pending']);
    // and it is the open request that holds it: once INFLX says no, the same sale is released
    const [row] = await requestsOf(x.jeans.id);
    await reject(row.id, 'Not accepted.');
    await runJobs();
    tx = await txOf(x.tx);
    expect(tx.commission_confirmed_at).not.toBeNull();
    expect(tx.brand_settlement_status).toBe('settled');
  });
});

/* ═══════════════════════════════════════════ one replacement per item (E2, E10) */

describe('one replacement per item (BS6)', () => {
  test('BS6 after one replacement: no second one — a size is kept or the deal returned; a damaged replacement gets its share refunded', async () => {
    const b = await deliveredBundle();
    await replaced(W, b.sh, b.jeans);
    const it = (await preview(b.sh, b.jeans.id)).body.data.items.find((x) => x.id === b.jeans.id);
    expect(it).toMatchObject({ replaced: true, other_size: false, same_in_stock: false, size: '34', can: true });
    const size = await ask(b.sh, b.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '30' });
    expect([size.status, size.body.error.message]).toEqual([409, 'This item has already been replaced once. You can keep it, or return the whole deal.']);
    // the other two items have not been replaced: they still can be
    const other = (await preview(b.sh, b.jeans.id)).body.data.items.find((x) => x.id === b.polo.id);
    expect([other.replaced, other.other_size]).toEqual([false, true]);
    // the replacement itself arrived damaged: its share, even though the store has more of it
    const r = await ask(b.sh, b.jeans.id, { reason: 'damaged', note: NOTE, expect: 'refund_item' });
    expect(r.body.data).toMatchObject({ kind: 'refund_item', word: 'Refund requested' });
  });
});

/* ═══════════════════════════════════════════ damaged · not as shown (R4, R5) */

describe('damaged or not as shown (BS7–BS9)', () => {
  test('BS7 the store has one: the same item again — and what comes back is NOT put back on sale', async () => {
    const b = await deliveredBundle();
    const before = await sizeStock(W.ids[1], 'Indigo', '32');
    const r = await ask(b.sh, b.shirt.id, { reason: 'not_as_described', note: 'The colour is much lighter than the photo.', expect: 'replace' });
    expect(r.body.data.kind).toBe('replace');
    const [row] = await requestsOf(b.shirt.id);
    expect(row).toMatchObject({ kind: 'replace', reason: 'not_as_described', reason_text: 'The colour is much lighter than the photo.', from_size: '32', to_size: '32', to_colour: 'Indigo' });
    await approve(row.id);
    expect(await sizeStock(W.ids[1], 'Indigo', '32')).toBe(before - 1);                  // the one that goes out
    await sendIt(W, row.id, 'sent');
    await sendIt(W, row.id, 'delivered');
    expect(await sizeStock(W.ids[1], 'Indigo', '32')).toBe(before - 1);                  // the one that came back is not sellable
    expect((await lineOf(b.shirt.id)).size).toBe('32');
    expect((await page(b.sh, b.shirt.id)).return).toMatchObject({ word: 'Replaced', reason: "It isn't as shown", note: 'The colour is much lighter than the photo.' });
  });

  test('BS8 the store has no more: ONLY that item\'s share is refunded; she keeps the other two, and the money on them is untouched', async () => {
    const w = await D.world('pick3', undefined, { brand: 'Aveen fashion boutique', variants: SIZED() });
    const b = await deliveredBundle(w);
    await setStock(w.ids[2], 'Indigo', '32', 0);                                          // she has the last one
    const it = (await preview(b.sh, b.jeans.id)).body.data.items.find((x) => x.id === b.jeans.id);
    expect([it.same_in_stock, it.refund.amount]).toEqual([false, Number(b.jeans.paid_total)]);
    // her screen showed "replace" a moment ago, and the stock has moved: nothing is recorded, she looks again
    const stale = await ask(b.sh, b.jeans.id, { reason: 'damaged', note: NOTE, expect: 'replace' });
    expect([stale.status, stale.body.error.field, stale.body.error.message]).toEqual([409, 'expect', 'This changed while you were choosing. Please look again.']);
    expect(await requestsOf(b.jeans.id)).toEqual([]);

    const r = await ask(b.sh, b.jeans.id, { reason: 'damaged', note: NOTE, expect: 'refund_item' });
    expect(r.body.data).toMatchObject({ kind: 'refund_item', status: 'requested', word: 'Refund requested' });
    const [row] = await requestsOf(b.jeans.id);
    expect(row).toMatchObject({ kind: 'refund_item', reason: 'damaged', reason_text: NOTE, to_size: null, replacement_status: null });
    expect(Number(row.refund_amount)).toBe(Number(b.jeans.paid_total));
    expect((await page(b.sh, b.polo.id)).return).toMatchObject({ kind: 'refund_item', word: 'Refund requested', amount: Number(b.jeans.paid_total) });
    const listed = (await api.get('/admin/returns?status=requested', admin.token)).body.data.returns.find((x) => x.id === row.id);
    expect(listed).toMatchObject({ kind: 'refund_item', deal_line: 'Any 3 for ₹2,999', deal_paid: 2999 });
    expect(Number(listed.refund_amount)).toBe(Number(b.jeans.paid_total));

    const before = { tx: await txOf(b.tx), polo: await lineOf(b.polo.id), shirt: await lineOf(b.shirt.id) };
    expect((await approve(row.id)).body.data).toMatchObject({ kind: 'refund_item', return_status: 'approved' });
    expect((await api.get('/brands/me/replacements', w.b.token)).body.data.replacements).toEqual([]);     // nothing to send: it is collected
    const done = await refunded(row.id);
    expect(done.status).toBe(200);
    expect(done.body.data.refund).toMatchObject({ amount: Number(b.jeans.paid_total), status: 'issued' });

    const jeans = await lineOf(b.jeans.id);
    expect([jeans.status, jeans.cancelled_by, jeans.refund_status]).toEqual(['cancelled', 'return', 'issued']);
    expect(Number(jeans.refund_amount)).toBe(Number(b.jeans.paid_total));
    // the other two: still hers, to the paisa
    for (const [k, was] of [['polo', before.polo], ['shirt', before.shirt]]) {
      const now = await lineOf(b[k].id);
      for (const f of ['status', 'paid_total', 'commission', 'platform_fee', 'brand_net', 'deal_key']) expect(now[f]).toEqual(was[f]);
    }
    // the sale: exactly that item's three shares are undone
    const tx = await txOf(b.tx);
    expect(Number(tx.commission_reversed) - Number(before.tx.commission_reversed || 0)).toBeCloseTo(Number(b.jeans.commission), 2);
    expect(Number(tx.brand_net_reversed) - Number(before.tx.brand_net_reversed || 0)).toBeCloseTo(Number(b.jeans.brand_net), 2);
    expect(Number(tx.platform_fee_reversed) - Number(before.tx.platform_fee_reversed || 0)).toBeCloseTo(Number(b.jeans.platform_fee), 2);
    expect(tx.status).toBe('completed');                                                 // the sale stands: two items are still sold
    // her deal now: two items hers, one returned; the rest can still go back together
    const d = await page(b.sh, b.polo.id);
    expect(d.deal.lines.map((x) => [x.id === b.jeans.id, x.state])).toEqual(expect.arrayContaining([[true, 'returned'], [false, null]]));
    expect(d.return).toMatchObject({ kind: 'refund_item', status: 'refunded', word: 'One item refunded' });
    expect(d.can_return).toBe(true);
    const rest = (await api.get(`/follower/orders/lines/${b.polo.id}/return`, b.sh.token)).body.data;
    expect(rest.lines).toHaveLength(2);
    expect(rest.refund.amount).toBe(2999 - Number(b.jeans.paid_total));
  });

  test('E12 cash on delivery: the one-item refund is sent by INFLX by hand', async () => {
    const w = await D.world('pick3', undefined, { brand: 'Aveen fashion boutique', variants: SIZED() });
    const b = await deliveredBundle(w, { method: 'cod' });
    await setStock(w.ids[0], 'Indigo', '32', 0);
    const it = (await preview(b.sh, b.polo.id)).body.data.items.find((x) => x.id === b.polo.id);
    expect(it.refund.text).toBe(`Refund of ₹${Number(b.polo.paid_total).toLocaleString('en-IN')}. You paid cash, so INFLX sends it to you directly once the item is back.`);
    await ask(b.sh, b.polo.id, { reason: 'damaged', note: NOTE });
    const [row] = await requestsOf(b.polo.id);
    await approve(row.id);
    expect((await refunded(row.id)).body.data.refund).toMatchObject({ amount: Number(b.polo.paid_total), status: 'manual' });
    expect((await lineOf(b.polo.id)).refund_status).toBe('manual');
  });
});

/* ═══════════════════════════════════════════ INFLX says no, and stock that runs out (E11) */

describe('not accepted, and sold out before approval (BS11, BS15)', () => {
  test('BS11 a replacement INFLX does not accept: she is told why; that item has had its answer; the whole deal can still go back', async () => {
    const b = await deliveredBundle();
    await ask(b.sh, b.jeans.id, { reason: 'damaged', note: NOTE });
    const [row] = await requestsOf(b.jeans.id);
    expect((await reject(row.id, '')).status).toBe(422);                                 // a reason is required to say no
    const r = await reject(row.id, 'The photo you sent us shows wear, not damage.');
    expect(r.body.data).toMatchObject({ kind: 'replace', return_status: 'rejected' });
    const d = await page(b.sh, b.jeans.id);
    expect(d.return).toMatchObject({ kind: 'replace', status: 'rejected', word: 'Replacement not accepted', inflx_note: 'The photo you sent us shows wear, not damage.', sold_out: false });
    expect([d.can_return, d.can_replace]).toEqual([true, true]);                         // the other two items can still be asked about
    const pv = (await preview(b.sh, b.jeans.id)).body.data;
    expect(pv.items.find((x) => x.id === b.jeans.id)).toMatchObject({ can: false, why: 'INFLX has already answered a request for this item. You can still return the whole deal.' });
    expect(pv.items.find((x) => x.id === b.polo.id).can).toBe(true);
    expect((await ask(b.sh, b.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' })).status).toBe(409);
    expect(pv.whole.can).toBe(true);
    expect((await api.post(`/follower/orders/lines/${b.jeans.id}/return`, b.sh.token, { reason: 'changed_mind' })).status).toBe(200);
    // nothing was taken from stock for a request that was never approved
  });

  test('BS15 it sold out before INFLX approved: the request closes itself, she is told, and she may choose again', async () => {
    const w = await D.world('pick3', undefined, { brand: 'Aveen fashion boutique', variants: SIZED() });
    const b = await deliveredBundle(w);
    await ask(b.sh, b.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' });
    const [row] = await requestsOf(b.jeans.id);
    await setStock(w.ids[2], 'Indigo', '34', 0);                                          // someone else bought the last 34
    const r = await approve(row.id);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ return_status: 'rejected', sold_out: true });
    expect(r.body.data.message).toMatch(/sold out before it could be approved/);
    expect((await requestsOf(b.jeans.id))[0]).toMatchObject({ return_status: 'rejected', sold_out: true, replacement_status: null });
    expect(await sizeStock(w.ids[2], 'Indigo', '34')).toBe(0);
    const d = await page(b.sh, b.jeans.id);
    expect(d.return).toMatchObject({ word: 'Replacement sold out', sold_out: true, inflx_note: 'It sold out before it could be sent. You can choose another size, or return the whole deal.' });
    expect(d.can_replace).toBe(true);
    // it was the stock, not INFLX's answer: she chooses another size
    const again = await ask(b.sh, b.jeans.id, { reason: 'wrong_size', colour: 'Indigo', size: '30' });
    expect(again.status).toBe(200);
    expect(await requestsOf(b.jeans.id)).toHaveLength(2);
  });
});

/* ═══════════════════════════════════════════ a pair, and an item of two */

describe('buy one get one, and two of one item (BS10, BS13)', () => {
  test('BS10 a pair: either item can be replaced; when the store has no more there is no one-item refund — the pair goes back together', async () => {
    const sh = await D.shopper();
    const o = await D.order(sh, [i32(PAIR, 0, { role: 'buy' }), i32(PAIR, 0, { role: 'free' })], { method: 'online' });
    await D.move(PAIR, o.parcels[0].id, 'delivered');
    const free = o.lines.find((l) => l.role === 'free');
    const pv = (await preview(sh, free.id)).body.data;
    expect(pv.deal.line).toBe('Buy 1 get 1');
    expect(pv.items.map((x) => [x.role, x.pair, x.refund]).sort()).toEqual([['buy', true, null], ['free', true, null]].sort());
    await setStock(PAIR.ids[0], 'Indigo', '32', 0);
    const none = await ask(sh, free.id, { reason: 'damaged', note: NOTE });
    expect([none.status, none.body.error.message]).toEqual([409, 'The store has no more of this, and a pair goes back together. You can return the whole deal.']);
    expect(await requestsOf(free.id)).toEqual([]);
    // but the free one can be swapped for another size
    const r = await ask(sh, free.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' });
    expect(r.body.data.kind).toBe('replace');
    await setStock(PAIR.ids[0], 'Indigo', '32', 50);
  });

  test('BS13 two of one item, one is not right: it becomes its own item first, and the money on the two adds up to what it was', async () => {
    // "any 3": two jeans (one line of two) and a shirt
    const sh = await D.shopper();
    const o = await D.order(sh, [i32(W, 2, { qty: 2 }), i32(W, 1)], { method: 'online' });
    await D.move(W, o.parcels[0].id, 'delivered');
    const two = o.lines.find((l) => l.product_id === W.ids[2]);
    expect(Number(two.qty)).toBe(2);
    const sums = (rows) => ['normal_total', 'paid_total', 'commission', 'platform_fee', 'brand_net'].map((k) => Math.round(rows.reduce((s, l) => s + Number(l[k]) * 100, 0)));
    const before = sums([two]);
    const pv = (await preview(sh, two.id)).body.data;
    expect(pv.items.find((x) => x.id === two.id).refund.amount).toBe(Math.round(Number(two.paid_total) * 100 / 2) / 100);     // ONE unit's share

    const r = await ask(sh, two.id, { reason: 'wrong_size', colour: 'Indigo', size: '34' });
    expect(r.status).toBe(200);
    const { rows: parts } = await query(`SELECT * FROM order_lines WHERE transaction_id = $1 AND product_id = $2 ORDER BY (id = $3) DESC`, [two.transaction_id, W.ids[2], two.id]);
    expect(parts.map((p) => Number(p.qty))).toEqual([1, 1]);
    expect(sums(parts)).toEqual(before);                                                 // to the paisa
    for (const p of parts) expect(Math.round((Number(p.commission) + Number(p.platform_fee) + Number(p.brand_net)) * 100)).toBe(Math.round(Number(p.paid_total) * 100));
    expect(parts.every((p) => p.deal_key === two.deal_key && p.status === 'active' && p.size === '32')).toBe(true);
    // the request is for the new item of one, not for the one that stays
    const unit = parts.find((p) => p.id !== two.id);
    expect(r.body.data.line_id).toBe(unit.id);
    expect((await requestsOf([two.id, unit.id])).map((x) => x.order_line_id)).toEqual([unit.id]);
    // the deal is still one deal of three, at what it cost
    const d = await page(sh, two.id);
    expect([d.deal.count, d.deal.paid, d.deal.lines.length]).toEqual([3, 2999, 3]);
    // delivered: only that one is the 34
    const [row] = await requestsOf(unit.id);
    for (const step of [() => approve(row.id), () => sendIt(W, row.id, 'sent'), () => sendIt(W, row.id, 'delivered')]) await step(); // eslint-disable-line no-await-in-loop
    expect([(await lineOf(unit.id)).size, (await lineOf(two.id)).size]).toEqual(['34', '32']);
  });
});

/* ═══════════════════════════════════════════ the lists */

describe('the brand\'s Returns names the kind, and a whole-deal return is still a return (BS14)', () => {
  test('the brand\'s list says the kind of each request; a return of the whole deal is kind "return", as every request was', async () => {
    const b = await deliveredBundle();
    await api.post(`/follower/orders/lines/${b.jeans.id}/return`, b.sh.token, { reason: 'changed_mind' });
    const rows = await requestsOf([b.jeans.id, b.polo.id, b.shirt.id]);
    expect(rows.map((r) => r.kind)).toEqual(['return', 'return', 'return']);
    const d = await page(b.sh, b.jeans.id);
    expect(d.return).toMatchObject({ kind: 'return', word: 'Return requested', replace: null, amount: null });
    const list = (await api.get('/brands/me/returns', W.b.token)).body.data.returns;
    const kinds = new Set(list.map((x) => x.kind));
    expect(kinds.has('return')).toBe(true);
    expect(kinds.has('replace')).toBe(true);
    const closed = (await api.get('/brands/me/returns?filter=closed', W.b.token)).body.data.returns;
    expect(closed.some((x) => x.return_status === 'replaced')).toBe(true);
    // the service's own words for each kind and state
    expect(returns.KIND_WORD.replace).toEqual({ requested: 'Replacement requested', approved: 'Replacement approved', rejected: 'Replacement not accepted', replaced: 'Replaced' });
  });
});
