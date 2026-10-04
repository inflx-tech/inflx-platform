'use strict';

/**
 * shopper-walk-fixes — the return window (01-spec.md W11, W13; founder, 4 Oct 2026):
 *
 *   "this return window is fixed by our platform INFLX… same for all… not decided by individual
 *    business or brand… as an admin we can set any number of days even 24hrs or any hours to days…
 *    after delivery sale commission to creator, platform sale percentage, and money return to brand
 *    all should follow the time set in admin for return window."
 *
 * Real API, real database, real orders placed through a live shoppable post (item 17's fixtures).
 */

const W = require('./helpers/item17');
const W14 = require('./helpers/item14');
const w12 = require('./helpers/item12');
const settlementJob = require('../src/jobs/commerce-settlement.job');
const commissionConfirm = require('../src/jobs/commission-confirm.job');
const settlement = require('../src/services/settlement.service');
const returnWindow = require('../src/services/returnWindow.service');
const paymentConfig = require('../src/services/paymentConfig.service');

const { api, query } = W;
const num = (v) => Math.round(Number(v) * 100) / 100;
const HOUR = 3600000;
let admin;

/** Admin sets the window (the Money › Settings page's own call). */
async function setWindow(body) {
  const r = await api.patch('/admin/config/payments', admin.token, body);
  return r;
}
const runJobs = async () => { await settlementJob.run(); await commissionConfirm.run(); };
const stampedHours = async (txId) => {
  const { rows: [t] } = await query(`SELECT created_at, return_window_ends_at FROM follower_transactions WHERE id = $1`, [txId]);
  return Math.round((new Date(t.return_window_ends_at) - new Date(t.created_at)) / HOUR);
};
/** The parcel is delivered `hoursAgo` hours ago (Shipped → Delivered through the brand's own route). */
async function deliveredAgo(w, orderId, hoursAgo) {
  const r = await api.patch(`/brands/me/orders/${orderId}/status`, w.b.token, { status: 'delivered' });
  if (r.status !== 200) throw new Error(`delivered: ${JSON.stringify(r.body)}`);
  await query(`UPDATE follower_orders SET delivered_at = now() - ($2 || ' hours')::interval WHERE id = $1`, [orderId, String(hoursAgo)]);
}
const saleOf = async (w) => (await api.get('/brands/me/wallet/sales', w.b.token)).body.data.sales[0];

beforeAll(async () => {
  admin = await W.fresh();
  // The settings row every real database has (the test database starts without one).
  await query(`INSERT INTO payment_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  paymentConfig._resetCache();
  W14.resetTree();
  await w12.startServer();
});
afterAll(() => w12.stopServer());

describe('the admin sets ONE number, in hours or days', () => {
  it('reads as a person would say it', () => {
    expect(returnWindow.words(168)).toBe('7 days');
    expect(returnWindow.words(24)).toBe('24 hours');
    expect(returnWindow.words(36)).toBe('36 hours');
    expect(returnWindow.words(48)).toBe('2 days');
    expect(returnWindow.words(1)).toBe('1 hour');
    expect(returnWindow.adjective(168)).toBe('7-day');
    expect(returnWindow.adjective(24)).toBe('24-hour');
    expect(returnWindow.adjective(720)).toBe('30-day');
  });

  it('24 hours is saved as 24 hours; the old days column is kept in step, rounded up', async () => {
    const r = await setWindow({ return_window_hours: 24 });
    expect(r.status).toBe(200);
    expect(r.body.data.config).toMatchObject({ returnWindowHours: 24, returnWindowDays: 1 });
    expect(await returnWindow.hours()).toBe(24);
    expect((await query(`SELECT return_window_hours AS h, return_window_days AS d FROM payment_config WHERE id = 1`)).rows[0]).toEqual({ h: 24, d: 1 });
    await setWindow({ return_window_hours: 36 });
    expect((await query(`SELECT return_window_hours AS h, return_window_days AS d FROM payment_config WHERE id = 1`)).rows[0]).toEqual({ h: 36, d: 2 });
    expect((await paymentConfig.getConfig()).returnWindowDays).toBe(1.5);
  });

  it('something older that still sends whole days sets the same number', async () => {
    const r = await setWindow({ return_window_days: 3 });
    expect(r.status).toBe(200);
    expect(r.body.data.config.returnWindowHours).toBe(72);
    expect(await returnWindow.forShopper()).toEqual({ hours: 72, words: '3 days', line: 'Within 3 days of delivery' });
  });

  it('refuses 0, a fraction of an hour, and more than 365 days — and leaves the number as it was', async () => {
    await setWindow({ return_window_hours: 168 });
    for (const bad of [0, -5, 1.5, 8761, 'soon']) {
      const r = await setWindow({ return_window_hours: bad });                           // eslint-disable-line no-await-in-loop
      expect(r.status).toBe(422);
      expect(r.body.error.message).toMatch(/1 hour to 365 days/);
    }
    expect(await returnWindow.hours()).toBe(168);
  });

  it('a creator, a brand or a shopper cannot set it', async () => {
    const w = await W.saleWorld();
    expect((await api.patch('/admin/config/payments', w.b.token, { return_window_hours: 1 })).status).toBe(403);
    expect((await api.patch('/admin/config/payments', w.cr.token, { return_window_hours: 1 })).status).toBe(403);
    expect(await returnWindow.hours()).toBe(168);
  });
});

describe('one number for everyone: no category, brand or product has its own', () => {
  it('a sale is stamped with the platform number, whatever its category row says', async () => {
    await setWindow({ return_window_hours: 24 });
    const w = await W.saleWorld();
    // Every category row carries some other number; none of them is read any more.
    await query(`UPDATE categories SET return_window_days = 30`);
    await query(`UPDATE brand_products SET return_policy_days = 15 WHERE brand_id = $1`, [w.brandId]);
    const o = await W.order(w, [0]);
    expect(await stampedHours(o.tx.id)).toBe(24);
    const ends = await settlement.resolveReturnWindowEndsAt(null, w.brandId);
    expect(Math.round((ends.getTime() - Date.now()) / HOUR)).toBe(24);
  });

  it('the category endpoint no longer saves a return window', async () => {
    const { rows: [c] } = await query(`SELECT category_key FROM categories ORDER BY category_key LIMIT 1`);
    if (!c) return;                                                                      // no category rows in this fixture
    await query(`UPDATE categories SET return_window_days = 30 WHERE category_key = $1`, [c.category_key]);
    const r = await api.patch(`/admin/categories/${c.category_key}`, admin.token, { return_window_days: 5, description: 'x' });
    expect([200, 404]).toContain(r.status);                                              // the route's own answer; the number must not move
    expect((await query(`SELECT return_window_days AS d FROM categories WHERE category_key = $1`, [c.category_key])).rows[0].d).toBe(30);
  });

  it('changing the number never moves a sale already made', async () => {
    await setWindow({ return_window_hours: 24 });
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    await setWindow({ return_window_hours: 240 });
    expect(await stampedHours(o.tx.id)).toBe(24);                                        // its own stamp
    const later = await W.order(w, [1]);
    expect(await stampedHours(later.tx.id)).toBe(240);
  });
});

describe('after delivery, all three shares follow the window', () => {
  it('an ONLINE order: nothing is added when it ships, nor when it is delivered; all of it when the window after delivery closes', async () => {
    await setWindow({ return_window_hours: 24 });
    const w = await W.saleWorld();
    const fee0 = (await api.get('/admin/money/overview', admin.token)).body.data.earnings;   // before the sale
    const o = await W.order(w, [0]);                                                     // paid online
    const ln = o.lines[0];
    const m0 = await W.money(w);

    // Paid, not shipped.
    expect(await saleOf(w)).toMatchObject({ state: 'not_shipped', windowUntil: null });
    // Shipped, and 30 hours have passed since she ordered: the old rule would have paid out here.
    await W.ship(w, o.parcel.id);
    await query(`UPDATE follower_transactions SET created_at = created_at - interval '30 hours', return_window_ends_at = return_window_ends_at - interval '30 hours' WHERE id = $1`, [o.tx.id]);
    await runJobs();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    expect(await settlement.settleCommerceTransaction(null, o.tx.id)).toEqual({ skipped: 'not_delivered' });
    expect(await saleOf(w)).toMatchObject({ state: 'waiting_delivery', windowUntil: null });

    // Delivered 23 hours ago: one hour of its window is left.
    await deliveredAgo(w, o.parcel.id, 23);
    await runJobs();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    expect(await settlement.settleCommerceTransaction(null, o.tx.id)).toEqual({ skipped: 'window_open' });
    const s = await saleOf(w);
    expect(s.state).toBe('window');
    expect(s.windowUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const mid = (await api.get('/admin/money/overview', admin.token)).body.data.earnings;
    expect(num(mid.inReturnWindow - fee0.inReturnWindow)).toBe(num(ln.platform_fee));    // INFLX's share is still waiting too
    expect(num(mid.salesFeesThisMonth)).toBe(num(fee0.salesFeesThisMonth));

    // Delivered 25 hours ago: the 24-hour window has closed.
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '25 hours' WHERE id = $1`, [o.parcel.id]);
    await runJobs();
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(num(ln.brand_net));                            // the brand's money
    expect(num(m1.her - m0.her)).toBe(num(ln.commission));                               // the creator's commission
    const end = (await api.get('/admin/money/overview', admin.token)).body.data.earnings;
    expect(num(end.salesFeesThisMonth - fee0.salesFeesThisMonth)).toBe(num(ln.platform_fee));   // INFLX's share is earned
    expect(num(end.inReturnWindow)).toBe(num(fee0.inReturnWindow));
    expect((await saleOf(w)).state).toBe('added');

    await runJobs();                                                                     // never twice
    expect(await W.money(w)).toMatchObject({ brand: m1.brand, her: m1.her });
  });

  it('cash on delivery follows the same clock', async () => {
    await setWindow({ return_window_hours: 48 });
    const w = await W.saleWorld();
    const o = await W.order(w, [0], { method: 'cod' });
    const ln = o.lines[0];
    const m0 = await W.money(w);
    // She ordered three days ago (a delivery is never before its order).
    await query(`UPDATE follower_transactions SET created_at = created_at - interval '72 hours', return_window_ends_at = return_window_ends_at - interval '72 hours' WHERE id = $1`, [o.tx.id]);
    await W.deliver(w, o.parcel.id);
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '47 hours' WHERE id = $1`, [o.parcel.id]);
    await runJobs();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '49 hours' WHERE id = $1`, [o.parcel.id]);
    await runJobs();
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(num(ln.brand_net));
    expect(num(m1.her - m0.her)).toBe(num(ln.commission));
  });

  it('a long window is honoured too: 7 days after delivery, not 7 days after ordering', async () => {
    await setWindow({ return_window_hours: 168 });
    const w = await W.saleWorld();
    const o = await W.order(w, [0]);
    const ln = o.lines[0];
    const m0 = await W.money(w);
    // Ordered 10 days ago, delivered 3 days ago: 7 days from ORDER have passed, 7 from DELIVERY have not.
    await query(`UPDATE follower_transactions SET created_at = created_at - interval '10 days', return_window_ends_at = return_window_ends_at - interval '10 days' WHERE id = $1`, [o.tx.id]);
    await W.ship(w, o.parcel.id);
    await deliveredAgo(w, o.parcel.id, 72);
    await runJobs();
    expect(await W.money(w)).toMatchObject({ brand: m0.brand, her: m0.her });
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '169 hours' WHERE id = $1`, [o.parcel.id]);
    await runJobs();
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(num(ln.brand_net));
    expect(num(m1.her - m0.her)).toBe(num(ln.commission));
  });
});

describe('what people are told', () => {
  it('a new agreement names the window in its own unit; a product tells the shopper', async () => {
    await setWindow({ return_window_hours: 24 });
    const w = await W.saleWorld();
    const { rows: [c] } = await query(`SELECT terms_json FROM contracts WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(c.terms_json.money).toMatchObject({ commissionAfterHours: 24, commissionAfterDays: 1, commissionPaidWords: 'After the 24-hour return window' });
    expect(await returnWindow.forShopper()).toEqual({ hours: 24, words: '24 hours', line: 'Within 24 hours of delivery' });
    await setWindow({ return_window_hours: 168 });
    const w2 = await W.saleWorld();
    const { rows: [c2] } = await query(`SELECT terms_json FROM contracts WHERE campaign_influencer_id = $1`, [w2.ciId]);
    expect(c2.terms_json.money).toMatchObject({ commissionAfterHours: 168, commissionAfterDays: 7, commissionPaidWords: 'After the 7-day return window' });
    // the agreement already sent keeps the words it was sent with
    const { rows: [again] } = await query(`SELECT terms_json FROM contracts WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(again.terms_json.money.commissionPaidWords).toBe('After the 24-hour return window');
  });
});
