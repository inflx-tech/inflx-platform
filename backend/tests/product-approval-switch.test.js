'use strict';

/**
 * product-approval-switch — the admin switch over a brand's published products.
 * Contract: features/product-approval-switch · 03-expected-outputs.md E1–E24.
 *
 *   OFF  a brand's published product is live at once (today)
 *   ON   it waits for INFLX; the admin approves (live) or sends it back with a reason; the brand
 *        hiding a waiting product withdraws it; Show on anything not approved sends it again;
 *        approved once stays approved; switching OFF releases every waiting product.
 *
 * pushed_to_store stays the one live flag, so the readers are proven through their own doors:
 * the public category browse and the creator's product list (brandProducts.service).
 * Real API, real database.
 */

const { truncateAll } = require('./helpers/db');
const { createAdminUser } = require('./helpers/factories');
const I3 = require('./helpers/item3');
const { tree } = require('./helpers/offersV2');
const settings = require('../src/services/platformSettings.service');
const productApproval = require('../src/services/productApproval.service');
const brandProducts = require('../src/services/brandProducts.service');
const creatorTerms = require('../src/services/creatorTerms.service');

const { api, query, rnd } = I3;

let admin; let t;

const switchTo = async (n) => {
  const r = await api.patch('/admin/platform-settings', admin.token, { product_approval_required: n });
  if (r.status !== 200) throw new Error(`switch: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data;
};
const row = async (id) => (await query(
  `SELECT name, pushed_to_store, approval_status, approval_requested_at, approval_decided_at, approval_decided_by, approval_note FROM brand_products WHERE id = $1`, [id])).rows[0];
const createOne = (b, over = {}) => api.post('/brands/me/products', b.token, { name: `Jeans ${rnd()}`, price: 1499, ...over });
const batch = (b, n = 2) => api.post('/brands/me/products/batch', b.token, {
  category_node_id: t.jeans, items: Array.from({ length: n }, (_, i) => ({ name: `Batch ${rnd()} ${i}`, price: 1299 })),
});
const show = (b, id) => api.patch(`/brands/me/products/${id}`, b.token, { pushed_to_store: true });
const hide = (b, id) => api.patch(`/brands/me/products/${id}`, b.token, { pushed_to_store: false });
const queue = (status = 'pending', who = admin) => api.get(`/admin/products?status=${status}`, who.token);
const approve = (id, who = admin) => api.post(`/admin/products/${id}/approve`, who.token);
const reject = (id, reason, who = admin) => api.post(`/admin/products/${id}/reject`, who.token, reason === undefined ? {} : { reason });
const inBrowse = async (leaf, id) => ((await api.get(`/listing/nodes/${leaf}/products`)).body.data.items || []).some((p) => p.id === id);
const inCreatorList = async (brandId, id) => (await brandProducts.list(brandId)).rows.some((p) => p.id === id);
const notices = async (userId, type) => (await query(`SELECT title, body FROM notifications WHERE user_id = $1 AND type = $2 ORDER BY created_at`, [userId, type])).rows;

beforeAll(async () => {
  await truncateAll();
  settings._resetCache();
  t = await tree();
  admin = await createAdminUser();
});

describe('the switch off — today', () => {
  it('E1 the setting is there, off, drawn as a switch', async () => {
    const r = await api.get('/admin/platform-settings', admin.token);
    const s = r.body.data.settings.find((x) => x.key === 'product_approval_required');
    expect(s).toMatchObject({ value: 0, min: 0, max: 1, kind: 'switch', label: 'Product approval' });
    expect(s.description).toMatch(/waits for INFLX/);
  });

  it('E2 a generic create is live at once and approved', async () => {
    const b = await I3.brand();
    const r = await createOne(b);
    expect(r.status).toBe(201);
    expect(r.body.data.product).toMatchObject({ pushed_to_store: true, approval_status: 'approved' });
    expect(r.body.data.approval).toEqual({ status: 'approved', waiting: false, note: null, requested_at: null });
    expect(await inCreatorList(b.brandId, r.body.data.product.id)).toBe(true);
  });

  it('E3 a batch create is live at once and approved', async () => {
    const b = await I3.brand();
    const r = await batch(b);
    expect(r.status).toBe(201);
    for (const p of r.body.data.products) {
      expect(p).toMatchObject({ pushed_to_store: true, approval_status: 'approved' });
      expect(await inBrowse(t.jeans, p.id)).toBe(true);
    }
  });
});

describe('the switch on', () => {
  let b; let one; let two;

  beforeAll(async () => {
    const d = await switchTo(1);                                                            // E4
    expect(d.changed).toEqual([{ key: 'product_approval_required', old: 0, value: 1 }]);
    expect(d.released).toBe(0);
    b = await I3.brand();
  });
  afterAll(async () => { await switchTo(0); });

  it('E5 a generic create waits: not pushed, pending, with the time it was sent', async () => {
    const r = await createOne(b);
    expect(r.status).toBe(201);
    one = r.body.data.product.id;
    expect(r.body.data.product).toMatchObject({ pushed_to_store: false, approval_status: 'pending' });
    expect(r.body.data.product.approval_requested_at).toBeTruthy();
    expect(r.body.data.approval).toMatchObject({ status: 'pending', waiting: true, note: null });
  });

  it('E6 a batch create waits, every item', async () => {
    const r = await batch(b);
    expect(r.status).toBe(201);
    expect(r.body.data.products).toHaveLength(2);
    for (const p of r.body.data.products) expect(p).toMatchObject({ pushed_to_store: false, approval_status: 'pending' });
    two = r.body.data.products[0].id;
  });

  it('E7 a waiting product is in no store, no creator list, no public browse', async () => {
    expect(await inCreatorList(b.brandId, one)).toBe(false);
    expect(await inCreatorList(b.brandId, two)).toBe(false);
    expect(await inBrowse(t.jeans, two)).toBe(false);
    // The brand's own listing browse still shows it, with why.
    const mine = await api.get(`/brands/me/listing-nodes/${t.jeans}/products`, b.token);
    const p = mine.body.data.products.find((x) => x.id === two);
    expect(p).toMatchObject({ pushed_to_store: false, approval_status: 'pending' });
  });

  it('E8 the admin queue lists the three with brand, price, category and when; the counts agree', async () => {
    const r = await queue('pending');
    expect(r.status).toBe(200);
    const ids = r.body.data.products.map((p) => p.id);
    expect(ids).toContain(one); expect(ids).toContain(two);
    expect(r.body.data.counts).toEqual({ pending: 3, approved: 0, rejected: 0 });
    const p = r.body.data.products.find((x) => x.id === two);
    expect(p.brand).toMatchObject({ id: b.brandId, name: b.name });
    expect(p.price).toBe(1299);
    expect(p.category).toMatch(/Jeans$/);
    expect(p.approval_requested_at).toBeTruthy();
    expect(ids.indexOf(one)).toBeLessThan(ids.indexOf(two));                                // oldest first
  });

  it('E9 /admin/stats counts them', async () => {
    const r = await api.get('/admin/stats', admin.token);
    expect(r.body.data.pending_products).toBe(3);
  });

  it('E10 approve: live now, decided by this admin, the brand told, in the store', async () => {
    const r = await approve(two);
    expect(r.status).toBe(200);
    expect(r.body.data.product).toMatchObject({ id: two, pushed_to_store: true, approval_status: 'approved', approval_note: null });
    const db = await row(two);
    expect(db).toMatchObject({ pushed_to_store: true, approval_status: 'approved', approval_decided_by: admin.user.id, approval_note: null });
    expect(db.approval_decided_at).toBeTruthy();
    expect(await inBrowse(t.jeans, two)).toBe(true);
    expect(await inCreatorList(b.brandId, two)).toBe(true);
    const told = await notices(b.userId, 'product.approved');
    expect(told).toHaveLength(1);
    expect(told[0].title).toBe(`${db.name} is live in your store`);
    expect((await queue('approved')).body.data.products.map((p) => p.id)).toEqual([two]);
  });

  it('E11 send back without a reason is refused', async () => {
    const r = await reject(one);
    expect(r.status).toBe(422);
    expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'reason' });
    expect((await row(one)).approval_status).toBe('pending');
  });

  it('E12 send back with a reason: rejected, the note kept, still off the store, the brand told the reason', async () => {
    const r = await reject(one, 'The photo is a stock image.');
    expect(r.status).toBe(200);
    expect(r.body.data.product).toMatchObject({ approval_status: 'rejected', pushed_to_store: false, approval_note: 'The photo is a stock image.' });
    expect(await inCreatorList(b.brandId, one)).toBe(false);
    const told = await notices(b.userId, 'product.rejected');
    expect(told).toHaveLength(1);
    expect(told[0].body).toContain('The photo is a stock image.');
    expect((await queue('rejected')).body.data.products.map((p) => p.id)).toEqual([one]);
    expect((await queue('pending')).body.data.counts).toEqual({ pending: 1, approved: 1, rejected: 1 });
  });

  it('E13 Show on the sent-back product sends it again: pending, the note cleared, still not pushed', async () => {
    const r = await show(b, one);
    expect(r.status).toBe(200);
    expect(r.body.data.approval).toMatchObject({ status: 'pending', waiting: true, note: null });
    expect(await row(one)).toMatchObject({ pushed_to_store: false, approval_status: 'pending', approval_note: null });
    expect((await queue('pending')).body.data.products.map((p) => p.id)).toContain(one);
  });

  it('E14 Hide on a waiting product withdraws it: out of the queue', async () => {
    const r = await hide(b, one);
    expect(r.status).toBe(200);
    expect(r.body.data.approval).toMatchObject({ status: 'withdrawn', waiting: false });
    expect(await row(one)).toMatchObject({ pushed_to_store: false, approval_status: 'withdrawn' });
    expect((await queue('pending')).body.data.products.map((p) => p.id)).not.toContain(one);
  });

  it('E15 Show on the withdrawn product sends it again', async () => {
    await show(b, one);
    expect((await row(one)).approval_status).toBe('pending');
    expect((await queue('pending')).body.data.products.map((p) => p.id)).toContain(one);
  });

  it('E16 an approved product hidden and shown again goes live at once and never re-enters the queue', async () => {
    expect((await hide(b, two)).status).toBe(200);
    expect(await row(two)).toMatchObject({ pushed_to_store: false, approval_status: 'approved' });
    const r = await show(b, two);
    expect(r.body.data.approval).toMatchObject({ status: 'approved', waiting: false });
    expect(await row(two)).toMatchObject({ pushed_to_store: true, approval_status: 'approved' });
    expect((await queue('pending')).body.data.products.map((p) => p.id)).not.toContain(two);
  });

  it('E17 approve on a product that is not waiting is 404', async () => {
    const r = await approve(two);
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });

  it('E18 a product listed while the switch was off is still live and approved', async () => {
    await switchTo(0);
    const b2 = await I3.brand();
    const p = (await createOne(b2)).body.data.product;
    await switchTo(1);
    expect(await row(p.id)).toMatchObject({ pushed_to_store: true, approval_status: 'approved' });
    expect(await inCreatorList(b2.brandId, p.id)).toBe(true);
    // ...and Show after a Hide needs no review either
    await hide(b2, p.id); await show(b2, p.id);
    expect(await row(p.id)).toMatchObject({ pushed_to_store: true, approval_status: 'approved' });
  });

  it('E19 approving tells the creators holding it, the way the brand\'s own Show does', async () => {
    const spy = jest.spyOn(creatorTerms, 'afterProductChange');
    const p = (await createOne(b)).body.data.product;
    await approve(p.id);
    const call = spy.mock.calls.find((c) => c[0] === p.id);
    expect(call).toBeTruthy();
    expect(call[1].pushed_to_store).toBe(false);
    expect(call[2].pushed_to_store).toBe(true);
    spy.mockRestore();
  });

  it('E22 a reviewer admin can list and decide; a finance admin cannot', async () => {
    const reviewer = await createAdminUser('reviewer');
    const finance = await createAdminUser('finance');
    // The factory writes the role only; the capabilities column is what the middleware reads.
    await query(`UPDATE admin_profiles SET capabilities = ARRAY['approvals'] WHERE user_id = $1`, [reviewer.user.id]);
    await query(`UPDATE admin_profiles SET capabilities = ARRAY['payouts'] WHERE user_id = $1`, [finance.user.id]);
    const p = (await createOne(b)).body.data.product;
    expect((await queue('pending', finance)).status).toBe(403);
    expect((await approve(p.id, finance)).status).toBe(403);
    expect((await queue('pending', reviewer)).status).toBe(200);
    expect((await approve(p.id, reviewer)).status).toBe(200);
    expect((await row(p.id)).approval_decided_by).toBe(reviewer.user.id);
  });

  it('E23 a settings read that fails never blocks a publish: the gate answers off', async () => {
    const spy = jest.spyOn(settings, 'get').mockRejectedValue(new Error('db down'));
    expect(await productApproval.required()).toBe(false);
    const r = await createOne(b);
    expect(r.status).toBe(201);
    expect(r.body.data.product).toMatchObject({ pushed_to_store: true, approval_status: 'approved' });
    spy.mockRestore();
  });

  it('E24 a second brand\'s products sit in the same queue and are decided the same way', async () => {
    const b2 = await I3.brand();
    await createOne(b);                                   // E18's switch-off released b's earlier one
    const p = (await createOne(b2)).body.data.product;
    const r = await queue('pending');
    const mine = r.body.data.products.find((x) => x.id === p.id);
    expect(mine.brand.id).toBe(b2.brandId);
    expect(new Set(r.body.data.products.map((x) => x.brand.id)).size).toBeGreaterThanOrEqual(2);
    expect((await approve(p.id)).status).toBe(200);
    expect(await inCreatorList(b2.brandId, p.id)).toBe(true);
  });
});

describe('the switch turned off with products waiting', () => {
  it('E20/E21 every waiting product goes live, the sent-back and withdrawn ones are untouched, then publishing is immediate', async () => {
    await truncateAll(); settings._resetCache();
    t = await tree(); admin = await createAdminUser();
    await switchTo(1);
    const b = await I3.brand();
    const waitA = (await createOne(b)).body.data.product.id;
    const waitB = (await createOne(b)).body.data.product.id;
    const sentBack = (await createOne(b)).body.data.product.id;
    const withdrawn = (await createOne(b)).body.data.product.id;
    await reject(sentBack, 'Wrong price.');
    await hide(b, withdrawn);
    expect((await queue('pending')).body.data.counts.pending).toBe(2);

    const d = await switchTo(0);
    expect(d.released).toBe(2);
    for (const id of [waitA, waitB]) {
      expect(await row(id)).toMatchObject({ pushed_to_store: true, approval_status: 'approved', approval_note: productApproval.RELEASED_NOTE, approval_decided_by: admin.user.id });
      expect(await inCreatorList(b.brandId, id)).toBe(true);
    }
    expect(await row(sentBack)).toMatchObject({ pushed_to_store: false, approval_status: 'rejected', approval_note: 'Wrong price.' });
    expect(await row(withdrawn)).toMatchObject({ pushed_to_store: false, approval_status: 'withdrawn' });
    expect(await notices(b.userId, 'product.approved')).toHaveLength(2);
    expect((await queue('pending')).body.data.counts).toEqual({ pending: 0, approved: 2, rejected: 1 });

    const after = (await createOne(b)).body.data.product;                                   // E21
    expect(after).toMatchObject({ pushed_to_store: true, approval_status: 'approved' });
    // Turning it off twice releases nothing more and changes nothing.
    const again = await switchTo(0);
    expect(again.changed).toEqual([]);
    expect(again.released).toBe(0);
  });
});
