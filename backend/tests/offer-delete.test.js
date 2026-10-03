'use strict';

/**
 * offer-delete — Delete on a Draft (erased) and on an Ended offer (hidden from the brand only).
 * Contract: features/offer-delete · checks 2–9 and 12 of 03-expected-outputs.md · rules v1.17 §1.9.
 * Real API, real database. The "after hiding" check runs on a real signed Pay for Sale
 * collaboration with an approved post and a real order through it (helpers/item17).
 *
 * The last part of the file ("the data-safety audit, ported") holds the money and history probes of
 * the final audit (3 Oct 2026): a gift order and a bundle order cancelled after their offer was
 * deleted, the daily ended-offer sweep on an offer deleted before it ran, the India-day boundary,
 * the old builder's offers, and deletes sent at the same moment. Each makes its own brand and data.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('./helpers/db');
const W = require('./helpers/item17');
const H = require('./helpers/offersV2');
const w10 = require('./helpers/item10');
const offerPool = require('../src/services/offerPool.service');
const life = require('../src/services/offerLife.service');
const endedSweep = require('../src/jobs/posts-offer-ended.job');
const { istDayOf, todayInIndia } = require('../src/utils/indiaDay');

const { api, query, day, T } = H;
const RUNNING = 'This offer is still running. End it first, then you can delete it.';
const LIST = '/brands/me/offers?engine=2';
const NO_ID = '00000000-0000-4000-8000-000000000000';

let admin, B, other, t;
beforeAll(async () => {
  admin = await W.fresh();          // a clean database, the shared category tree, an INFLX admin
  B = await H.brand();
  other = await H.brand();
  t = await H.tree();
});

const del = (b, id) => api.del(`/brands/me/offers/${id}`, b.token);
const listOf = async (b, q = '') => (await api.get(`${LIST}${q}`, b.token)).body.data;
const row = async (id) => (await query(`SELECT id, status, deleted_at, ended_at FROM brand_offers WHERE id = $1`, [id])).rows[0];

/** A published offer whose dates have run out: status still 'published', end date passed. */
async function endedByDate(b, name, productId, from = -10, to = -2) {
  const id = await H.ready(b.token, { name, ids: [productId], from: day(300), to: day(310) });
  await query(`UPDATE brand_offers SET starts_on = $2, ends_on = $3 WHERE id = $1`, [id, day(from), day(to)]);
  await query(`UPDATE offer_pool_items SET lock_days = daterange($2::date, $3::date, '[)') WHERE offer_id = $1`, [id, day(from), day(to + 1)]);
  return id;
}

async function endedEarly(b, name, productId) {
  const id = await H.ready(b.token, { name, ids: [productId], from: day(-3), to: day(20) });
  const r = await api.post(`/brands/me/offers/${id}/end`, b.token);
  if (r.status !== 200) throw new Error(`end: ${JSON.stringify(r.body)}`);
  return id;
}

async function campaignSet(b) {
  const c = await api.post('/campaigns', b.token, { name: 'Diwali Denim' });
  const s = await api.post(`/campaigns/${c.body.data.campaign.id}/sets`, b.token,
    { name: 'Set A', goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(10) });
  if (s.status !== 201) throw new Error(JSON.stringify(s.body));
  return { url: `/campaigns/${c.body.data.campaign.id}/sets/${s.body.data.set.id}` };
}

/** Wait until some session of this database is waiting on a row lock (the delete, queued). */
async function untilSomeoneWaits() {
  for (let i = 0; i < 100; i += 1) {
    const { rows: [r] } = await query(
      `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`);
    if (r.n > 0) return;
    await new Promise((res) => setTimeout(res, 50)); // eslint-disable-line no-await-in-loop
  }
  throw new Error('the delete never queued behind the row lock');
}

/* ───────────────────────────────────────────────────────────── check 2 */

describe('a draft is erased (check 2)', () => {
  test('Delete erases it and its pool lines; the list and the Draft count drop by one; it is not found after', async () => {
    const p = await H.prod(B.brandId, t.shirts, 'Draft shirt', 999);
    const d = await H.draft(B.token, { offer_type: 'discount', sub_type: 'percentage', product_ids: [p] });
    expect((await query(`SELECT count(*)::int AS n FROM offer_pool_sources WHERE offer_id = $1`, [d.id])).rows[0].n).toBe(1);
    const before = await listOf(B);
    expect(before.offers.find((o) => o.id === d.id).display_status).toBe('draft');

    const r = await del(B, d.id);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ deleted: true, mode: 'erased' });

    expect(await row(d.id)).toBeUndefined();
    expect((await query(`SELECT count(*)::int AS n FROM offer_pool_sources WHERE offer_id = $1`, [d.id])).rows[0].n).toBe(0);
    const after = await listOf(B);
    expect(after.offers.map((o) => o.id)).not.toContain(d.id);
    expect(after.counts).toEqual({ ...before.counts, all: before.counts.all - 1, draft: before.counts.draft - 1 });
    expect((await api.get(`/brands/me/offers/${d.id}`, B.token)).status).toBe(404);
  });

  test('a publish at the same moment wins: the delete waits for it, then refuses — it never answers "deleted"', async () => {
    const d = await H.draft(B.token, { offer_type: 'bogo' });
    await H.patch(B.token, d.id, { name: 'Racing draft', starts_on: day(50), ends_on: day(60) });
    const c = await pool.connect();
    let r;
    try {
      await c.query('BEGIN');
      await c.query(`SELECT id FROM brand_offers WHERE id = $1 FOR UPDATE`, [d.id]);      // a publish holds the row
      const pending = del(B, d.id).then((x) => x);
      await untilSomeoneWaits();
      await c.query(`UPDATE brand_offers SET status = 'published', published_at = now() WHERE id = $1`, [d.id]);
      await c.query('COMMIT');
      r = await pending;
    } finally {
      c.release();
    }
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'OFFER_LOCKED', message: RUNNING });
    expect((await row(d.id)).status).toBe('published');
  });
});

/* ───────────────────────────────────────────────────────────── checks 3, 4 */

describe('an ended offer is hidden from the brand (checks 3, 4)', () => {
  test('ended early: hidden, never erased, status unchanged; gone from the list and the Ended count; every brand route answers not found', async () => {
    const p = await H.prod(B.brandId, t.trousers, 'Early trouser', 1500);
    const id = await endedEarly(B, 'Ended early, then deleted', p);
    const before = await listOf(B);
    expect(before.offers.find((o) => o.id === id)).toMatchObject({ status: 'ended', display_status: 'ended' });

    const r = await del(B, id);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ deleted: true, mode: 'hidden' });

    const kept = await row(id);
    expect(kept).toMatchObject({ id, status: 'ended' });
    expect(kept.deleted_at).toBeTruthy();
    expect(kept.ended_at).toBeTruthy();

    const after = await listOf(B);
    expect(after.offers.map((o) => o.id)).not.toContain(id);
    expect(after.counts).toEqual({ ...before.counts, all: before.counts.all - 1, ended: before.counts.ended - 1 });
    expect((await listOf(B, '&status=ended')).offers.map((o) => o.id)).not.toContain(id);

    const calls = [
      api.get(`/brands/me/offers/${id}`, B.token),
      api.patch(`/brands/me/offers/${id}`, B.token, { name: 'x' }),
      api.post(`/brands/me/offers/${id}/sources`, B.token, { pool: 'buy', method: 'search', product_ids: [p] }),
      api.get(`/brands/me/offers/${id}/candidates?q=Early`, B.token),
      api.post(`/brands/me/offers/${id}/publish`, B.token),
      api.post(`/brands/me/offers/${id}/end`, B.token),
      api.get(`/brands/me/offers/${id}/remove-preview?product_ids=${p}`, B.token),
      api.post(`/brands/me/offers/${id}/remove-products`, B.token, { product_ids: [p] }),
      api.post(`/brands/me/offers/${id}/add-products`, B.token, { product_ids: [p] }),
      api.get(`/brands/me/offers/${id}/attachments`, B.token),   // the old builder's door too
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  test('ended by its date (status still published, end date passed): hidden the same way, status untouched', async () => {
    const id = await endedByDate(B, 'Ran out, then deleted', await H.prod(B.brandId, t.trousers, 'Dated trouser', 1500));
    const before = await listOf(B);
    expect(before.offers.find((o) => o.id === id)).toMatchObject({ status: 'published', display_status: 'ended' });

    const r = await del(B, id);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ deleted: true, mode: 'hidden' });
    const kept = await row(id);
    expect(kept.status).toBe('published');
    expect(kept.deleted_at).toBeTruthy();

    const after = await listOf(B);
    expect(after.offers.map((o) => o.id)).not.toContain(id);
    expect(after.counts).toEqual({ ...before.counts, all: before.counts.all - 1, ended: before.counts.ended - 1 });
    expect((await api.get(`/brands/me/offers/${id}`, B.token)).status).toBe(404);
  });
});

/* ───────────────────────────────────────────────────────────── check 5 */

describe('a running offer is refused (check 5)', () => {
  test('Scheduled and Live: 409 with the sentence; nothing changes', async () => {
    const sched = await H.ready(B.token, { name: 'Still scheduled', ids: [await H.prod(B.brandId, t.jackets, 'Sched jacket', 3000)], from: day(30), to: day(40) });
    const live = await H.ready(B.token, { name: 'Still live', ids: [await H.prod(B.brandId, t.jackets, 'Live jacket', 3100)], from: day(-1), to: day(9) });
    for (const [id, ds] of [[sched, 'scheduled'], [live, 'live']]) {
      const r = await del(B, id);
      expect(r.status).toBe(409);
      expect(r.body.error).toMatchObject({ code: 'OFFER_LOCKED', message: RUNNING });
      expect(await row(id)).toMatchObject({ status: 'published', deleted_at: null });
      expect((await H.read(B.token, id)).offer.display_status).toBe(ds);
      expect((await listOf(B)).offers.map((o) => o.id)).toContain(id);
    }
    // Its products are still held: nothing was freed.
    const held = (await query(`SELECT bool_and(NOT isempty(lock_days)) AS held FROM offer_pool_items WHERE offer_id = ANY($1::uuid[])`, [[sched, live]])).rows[0];
    expect(held.held).toBe(true);
  });
});

/* ───────────────────────────────────────────────────────────── check 6 */

describe('not found (check 6)', () => {
  test('a second delete, another brand\'s offer, an unknown or malformed id', async () => {
    const id = await endedEarly(B, 'Deleted twice', await H.prod(B.brandId, t.shirts, 'Twice shirt', 1100));
    expect((await del(B, id)).status).toBe(200);
    const again = await del(B, id);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('NOT_FOUND');

    const d = await H.draft(B.token, { offer_type: 'bogo' });
    expect((await del(B, d.id)).status).toBe(200);
    expect((await del(B, d.id)).status).toBe(404);

    const theirs = await endedEarly(other, 'Not yours', await H.prod(other.brandId, t.shirts, 'Their shirt', 1200));
    const foreign = await del(B, theirs);
    expect(foreign.status).toBe(404);
    expect((await row(theirs)).deleted_at).toBeNull();
    expect((await listOf(other)).offers.map((o) => o.id)).toContain(theirs);

    expect((await del(B, NO_ID)).status).toBe(404);
    expect((await del(B, 'not-an-id')).status).toBe(404);
  });
});

/* ───────────────────────────────────────────────────────────── check 7 */

describe('after hiding, everyone else still has it (check 7)', () => {
  let w, o, name;
  beforeAll(async () => {
    w = await W.saleWorld();            // signed Pay for Sale on a 20% discount, one approved live post
    o = await W.order(w, [0]);          // a real order through her post
    name = (await query(`SELECT name FROM brand_offers WHERE id = $1`, [w.deal])).rows[0].name;
    const end = await api.post(`/brands/me/offers/${w.deal}/end`, w.b.token);
    expect(end.status).toBe(200);
    const r = await del(w.b, w.deal);
    expect(r.body.data).toEqual({ deleted: true, mode: 'hidden' });
  });

  test('the brand: gone from its list; its page is not found', async () => {
    expect((await listOf(w.b)).offers.map((x) => x.id)).not.toContain(w.deal);
    expect((await api.get(`/brands/me/offers/${w.deal}`, w.b.token)).status).toBe(404);
  });

  test('the creator who signed for it: in her terms (what you can sell, the one-offer screen) as Ended, with every product', async () => {
    const sell = await api.get(`/influencers/me/invitations/${w.ciId}/sell`, w.cr.token);
    expect(sell.status).toBe(200);
    expect(sell.body.data.offers.find((x) => x.id === w.deal)).toMatchObject({ name, display_status: 'ended' });
    const one = await api.get(`/influencers/me/invitations/${w.ciId}/offers/${w.deal}`, w.cr.token);
    expect(one.status).toBe(200);
    expect(one.body.data.offer).toMatchObject({ id: w.deal, name, display_status: 'ended' });
    expect(one.body.data.offer.products.map((p) => p.id).sort()).toEqual([...w.ids].sort());
    expect((await query(`SELECT dropped_at FROM collab_offers WHERE campaign_influencer_id = $1 AND offer_id = $2`, [w.ciId, w.deal])).rows)
      .toEqual([{ dropped_at: null }]);
  });

  test('her post still names it (removed because the offer ended)', async () => {
    const r = await api.get(`/influencers/me/shoppable-posts/${w.post}`, w.cr.token);
    expect(r.status).toBe(200);
    const post = r.body.data.post;
    expect(post).toMatchObject({ state: 'removed', offer_id: w.deal });
    expect(post.offer.name).toBe(name);
    expect(post.removed.reason).toBe('offer_ended');
  });

  test('the order line, the sale record and both wallets still name it', async () => {
    const ln = o.lines[0];
    expect((await query(`SELECT offer_id FROM order_lines WHERE id = $1`, [ln.id])).rows[0].offer_id).toBe(w.deal);
    expect((await query(`SELECT brand_offer_id FROM follower_transactions WHERE id = $1`, [o.tx.id])).rows[0].brand_offer_id).toBe(w.deal);
    const line = await api.get(`/follower/orders/lines/${ln.id}`, o.sh.token);
    expect(line.status).toBe(200);
    const brandSales = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data.sales;
    expect(brandSales.find((s) => s.id === ln.id).offerName).toBe(name);
    const hers = (await api.get('/influencers/me/wallet/commission', w.cr.token)).body.data.sales;
    expect(hers.find((s) => s.id === ln.id).offerName).toBe(name);
  });

  test('INFLX admin: the post still names it; the order is still listed', async () => {
    const posts = await api.get('/admin/posts?status=removed', admin.token);
    expect(posts.status).toBe(200);
    expect(posts.body.data.posts.find((p) => p.id === w.post).v2.offer.name).toBe(name);
    const orders = await api.get('/admin/orders', admin.token);
    expect(orders.status).toBe(200);
    expect(orders.body.data.orders.map((x) => x.id)).toContain(o.parcel.id);
  });
});

/* ───────────────────────────────────────────────────────────── check 8 */

describe('the brand\'s other offer hints leave it out (check 8)', () => {
  test('creator terms: a deleted offer is in neither the offers nor the "not shown, ended" note', async () => {
    const X = await H.brand();
    const w = await campaignSet(X);     // posting day(10)
    const early = await endedEarly(X, 'Hint ended early', await H.prod(X.brandId, t.jeans, 'HJ1', 1500));
    const byDate = await endedByDate(X, 'Hint ended by date', await H.prod(X.brandId, t.jeans, 'HJ2', 1600));
    const running = await H.ready(X.token, { name: 'Hint still running', ids: [await H.prod(X.brandId, t.jeans, 'HJ3', 1700)], from: day(1), to: day(30) });

    const before = (await api.get(`${w.url}/offer-choices`, X.token)).body.data;
    expect(Object.fromEntries(before.hidden.map((h) => [h.name, h.why]))).toMatchObject({ 'Hint ended early': 'ended', 'Hint ended by date': 'ended' });
    expect(before.offers.map((x) => x.id)).toEqual([running]);

    for (const id of [early, byDate]) expect((await del(X, id)).body.data).toEqual({ deleted: true, mode: 'hidden' });
    const after = (await api.get(`${w.url}/offer-choices`, X.token)).body.data;
    const named = [...after.hidden.map((h) => h.name), ...after.offers.map((x) => x.name)];
    expect(named).not.toContain('Hint ended early');
    expect(named).not.toContain('Hint ended by date');
    expect(after.offers.map((x) => x.id)).toEqual([running]);
  });

  test('Products without offers: "last in offer …" never names a deleted offer; it falls back to the one before', async () => {
    const X = await H.brand();
    const p = await H.prod(X.brandId, t.shirts, 'Last-offer shirt', 1299);
    const older = await endedByDate(X, 'Older offer', p, -20, -15);
    const newer = await endedEarly(X, 'Newer offer', p);
    const pwo = async () => (await api.get('/brands/me/offers/products-without-offers', X.token)).body.data.products.find((x) => x.id === p);
    expect((await pwo()).last_offer).toEqual({ name: 'Newer offer', until: T() });
    expect((await del(X, newer)).status).toBe(200);
    expect((await pwo()).last_offer).toEqual({ name: 'Older offer', until: day(-15) });
    expect((await del(X, older)).status).toBe(200);
    expect((await pwo()).last_offer).toBeNull();
  });
});

/* ───────────────────────────────────────────────────────────── check 9 */

describe('the days it held are freed (check 9)', () => {
  /** A new offer whose line was added while its dates were ahead, then back-dated over `days`. */
  async function backDated(b, productId, from, to) {
    const n = await H.draft(b.token, { offer_type: 'bogo' });
    await H.patch(b.token, n.id, { name: `Back-dated ${n.id.slice(0, 4)}`, starts_on: day(500), ends_on: day(510) });
    const l = await H.line(b.token, n.id, { pool: 'buy', method: 'search', query: 'x', product_ids: [productId] });
    expect(l.status).toBe(201);
    await H.patch(b.token, n.id, { starts_on: day(from), ends_on: day(to) });
    return n.id;
  }

  test.each([
    ['ended early', (b, name, p) => endedEarly(b, name, p), -2],
    ['ended by its date', (b, name, p) => endedByDate(b, name, p, -10, -2), -6],
  ])('%s: refused naming it before; after deleting, its holds are empty and a back-dated offer on the same product publishes', async (kind, make, from) => {
    const p = await H.prod(B.brandId, t.trousers, `Freed trouser (${kind})`, 1500);
    const oldName = `Held the past days (${kind})`;
    const old = await make(B, oldName, p);
    const n = await backDated(B, p, from, 5);

    const refused = await H.publish(B.token, n);
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe('PUBLISH_BLOCKED');
    expect(refused.body.error.message).toContain(`is in "${oldName}" until`);

    expect((await del(B, old)).body.data).toEqual({ deleted: true, mode: 'hidden' });
    expect((await query(`SELECT bool_and(isempty(lock_days)) AS free FROM offer_pool_items WHERE offer_id = $1`, [old])).rows[0].free).toBe(true);

    const ok = await H.publish(B.token, n);
    expect(ok.status).toBe(200);
    const { rows: [mine] } = await query(`SELECT lower(lock_days)::text AS from_day FROM offer_pool_items WHERE offer_id = $1 AND product_id = $2`, [n, p]);
    expect(mine.from_day).toBe(day(from));
    // What a creator reads of the deleted offer does not use those days: its pool is all there.
    expect((await offerPool.frozenPool(old)).buy.map((x) => x.id)).toEqual([p]);
  });
});

/* ───────────────────────────────────────────────────────────── check 12 */

describe('migration 201 (check 12)', () => {
  test('one nullable timestamptz column, no default; running the file again changes nothing', async () => {
    const { rows: [col] } = await query(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'brand_offers' AND column_name = 'deleted_at'`);
    expect(col).toEqual({ data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null });
    const snap = async () => (await query(`SELECT id, status, deleted_at FROM brand_offers ORDER BY id`)).rows;
    const before = await snap();
    await query(fs.readFileSync(path.join(__dirname, '../migrations/201_offer_deleted_at.sql'), 'utf8'));
    expect(await snap()).toEqual(before);
  });
});

/* ───────────────────────────────────────────────────────────── the filter stays brand-side */

describe('only the brand\'s own reads skip a deleted offer (code read)', () => {
  test('deleted_at on an offer is read in offerLife, the brand\'s offer choices and the last-offer hint — nowhere else', () => {
    const dirs = ['services', 'controllers', 'jobs', 'routes'].map((d) => path.join(__dirname, '../src', d)).filter((d) => fs.existsSync(d));
    const hits = {};
    for (const dir of dirs) {
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
        const n = (fs.readFileSync(path.join(dir, f), 'utf8').match(/\b(o|bo)\.deleted_at\b/g) || []).length;
        if (n) hits[f] = n;
      }
    }
    expect(Object.keys(hits).sort()).toEqual(['creatorTerms.service.js', 'offerLife.service.js', 'offerPool.service.js']);
    expect(hits['creatorTerms.service.js']).toBe(1);   // offerChoices only — never sellFor / creatorOffer / agreementSell
    expect(hits['offerPool.service.js']).toBe(1);      // the last-offer hint only — never locksFor / frozenPool
  });
});

/* ═════════════════════════════════════════════════════════════ the data-safety audit, ported */
// The final audit (3 Oct 2026) proved what follows with probe tests kept in a scratch folder. They
// guard money and history after an offer is deleted, so they live here now. Every test builds its
// own brand, offer, creator, post and order: none reads another test's rows.

let wseq = 0;
let pays = 0;
const PP = '/influencers/me/shoppable-posts';
const patchPost = (w, id, body) => request(app).patch(`/v1${PP}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);
/** Counted stock: one colour, three sizes, `stock` of each. The orders below buy Blue · 32. */
const SIZES = (stock) => ({ colors: [
  { color: 'Blue', images: [], sizes: [{ size: '30', stock }, { size: '32', stock }, { size: '34', stock }] },
] });
const stock32 = async (productId) => (await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [productId]))
  .rows[0].variants_json.colors[0].sizes.find((s) => s.size === '32').stock;
const ADDRESS = { receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B, Lotus Residency', area: 'Road No. 3, Banjara Hills',
  landmark: 'Near the park', pincode: '500034', city: 'Hyderabad', state: 'Telangana', label: 'Home' };

/** A published offer of `kind` over `ids` (and gift items), live today. */
async function offerOf(b, kind, name, ids, gifts = []) {
  switch (kind) {
    case 'discount': return H.ready(b.token, { type: 'discount', sub: 'percentage', name, cfg: { pct: 20 }, ids, from: day(-5), to: day(40) });
    case 'pick_any': return H.ready(b.token, { type: 'bundle', sub: 'pick_any', name, cfg: { pick: 2, price: 2999 }, ids, from: day(-5), to: day(40) });
    case 'spend': {
      const o = await H.draft(b.token, { offer_type: 'free_gift', sub_type: 'spend' });
      await H.patch(b.token, o.id, { name, starts_on: day(-5), ends_on: day(40), offer_config_json: { min_spend: 3000, gift_count: 1 } });
      const buy = await H.line(b.token, o.id, { pool: 'buy', method: 'search', query: 'x', product_ids: ids });
      if (buy.status !== 201) throw new Error(`buy line: ${JSON.stringify(buy.body)}`);
      const gift = await H.line(b.token, o.id, { pool: 'gift', method: 'gift_items', gift_item_ids: gifts });
      if (gift.status !== 201) throw new Error(`gift line: ${JSON.stringify(gift.body)}`);
      const p = await H.publish(b.token, o.id);
      if (p.status !== 200) throw new Error(`publish: ${JSON.stringify(p.body)}`);
      return o.id;
    }
    default: throw new Error(kind);
  }
}

/**
 * A signed Pay for Sale collaboration (10% commission) on one live offer of `kind`, every product
 * with counted stock, and one approved, live post of hers — the shopper-ordering suite's world.
 */
async function world({ kind = 'discount', prices = [2299, 1999, 1799], stock = 5, giftStock = 5 } = {}) {
  wseq += 1;
  const b = await H.brand();
  const ids = [];
  for (let i = 0; i < prices.length; i += 1) ids.push(await H.prod(b.brandId, t.jeans, `Audit jeans ${wseq}-${i}`, prices[i], null, { variants_json: SIZES(stock) })); // eslint-disable-line no-await-in-loop
  let gifts = [];
  if (kind === 'spend') {
    const g = await api.post('/brands/me/gift-items', b.token, { name: `Silver coin ${wseq}`, value: 650, stock: giftStock });
    if (!g.body.data || !g.body.data.gift_item) throw new Error(`gift item: ${JSON.stringify(g.body)}`);
    gifts = [g.body.data.gift_item.id];
  }
  const name = `Audit ${kind} ${wseq}`;
  const deal = await offerOf(b, kind, name, ids, gifts);
  const c = await w10.campaign(b, { name: 'Diwali Denim' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: 'Priya Rao' });
  await query(`UPDATE influencers SET instagram_handle = $2, full_name = 'Priya Rao' WHERE id = $1`, [cr.influencerId, `priya_od_${wseq}`]);
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token,
    { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [deal] } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  const acc = await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  if (acc.status >= 300) throw new Error(`accept: ${JSON.stringify(acc.body)}`);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, ids, deal, gifts, name };
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    const r = await step(w); // eslint-disable-line no-await-in-loop
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  const { rows: [con] } = await query(`SELECT id FROM contracts WHERE campaign_influencer_id = $1`, [ciId]);
  await query(`INSERT INTO production_events (contract_id, mode, status) VALUES ($1, 'shipment', 'completed')
               ON CONFLICT (contract_id) DO UPDATE SET status = 'completed'`, [con.id]);
  // her post: made through the real flow, approved by INFLX, live (the posting date moved into the past)
  const made = await api.post(PP, cr.token, { campaign_influencer_id: ciId });
  if (!made.body.data || !made.body.data.post) throw new Error(`post: ${JSON.stringify(made.body)}`);
  const postId = made.body.data.post.id;
  const [tg] = (await query(`SELECT id FROM theme_tags WHERE name = 'Festive'`)).rows;
  await patchPost(w, postId, { post_kind: 'offer' });
  await patchPost(w, postId, { offer_id: deal });
  await patchPost(w, postId, { product_ids: ids, theme_tag_ids: [tg.id], media_kind: 'image', media_layout: 'single' });
  const up = await api.post(`${PP}/${postId}/upload-url`, cr.token, { content_type: 'image/jpeg', size_bytes: 1024 });
  const u = new URL(up.body.data.url);
  await request(app).put(`${u.pathname}${u.search}`).set('Content-Type', 'image/jpeg').send(Buffer.alloc(1024, 7));
  await patchPost(w, postId, { media: [{ r2_key: up.body.data.key, mime: 'image/jpeg' }], caption: 'Festive denim' });
  const sub = await api.post(`${PP}/${postId}/submit`, cr.token);
  if (sub.status !== 200) throw new Error(`submit: ${JSON.stringify(sub.body)}`);
  const ap = await api.post(`/admin/posts/${postId}/approve`, admin.token);
  if (ap.status !== 200) throw new Error(`approve: ${JSON.stringify(ap.body)}`);
  await query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [s.id, day(-1)]);
  w.post = postId;
  return w;
}

/** A real order through her post: review → place → pay (when online). Lines come back dearest first. */
async function place(w, items, method = 'cod') {
  const sh = await W.shopper();
  const a = await api.post('/follower/addresses', sh.token, ADDRESS);
  if (a.status !== 201) throw new Error(`address: ${JSON.stringify(a.body)}`);
  const addr = a.body.data.address.id;
  const lines = items.map((i) => W.line(w, i, { colour: 'Blue', size: '32' }));
  const rv = await api.post('/follower/checkout/review', sh.token, { address_id: addr, lines, payment_method: method });
  if (rv.status !== 200) throw new Error(`review: ${JSON.stringify(rv.body)}`);
  const p = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines, payment_method: method, expected_total: rv.body.data.total });
  if (p.status !== 200) throw new Error(`place: ${JSON.stringify(p.body)}`);
  if (method === 'online') {
    pays += 1;
    const v = await api.post('/follower/checkout/verify', sh.token,
      { razorpay_order_id: p.body.data.razorpay.order_id, razorpay_payment_id: `pay_od_${pays}`, razorpay_signature: 'x' });
    if (v.status !== 200) throw new Error(`verify: ${JSON.stringify(v.body)}`);
  }
  const checkoutId = p.body.data.checkout_id;
  const { rows: ls } = await query(`SELECT * FROM order_lines WHERE checkout_id = $1 ORDER BY paid_total DESC, id`, [checkoutId]);
  const { rows: [parcel] } = await query(`SELECT * FROM follower_orders WHERE checkout_id = $1`, [checkoutId]);
  const { rows: [tx] } = await query(`SELECT * FROM follower_transactions WHERE checkout_id = $1`, [checkoutId]);
  return { sh, checkoutId, lines: ls, parcel, tx };
}

/** End offer now, then Delete: the offer is hidden from its brand. */
async function endAndDelete(w) {
  const e = await api.post(`/brands/me/offers/${w.deal}/end`, w.b.token);
  expect(e.status).toBe(200);
  const d = await del(w.b, w.deal);
  expect(d.status).toBe(200);
  expect(d.body.data).toEqual({ deleted: true, mode: 'hidden' });
  expect((await row(w.deal)).deleted_at).toBeTruthy();
}

/** The offer's dates run out, as time passing would do: its status stays 'published'. */
async function runOut(offerId, from = -10, to = -1) {
  await query(`UPDATE brand_offers SET starts_on = $2, ends_on = $3 WHERE id = $1`, [offerId, day(from), day(to)]);
  await query(`UPDATE offer_pool_items SET lock_days = daterange($2::date, $3::date, '[)') WHERE offer_id = $1`, [offerId, day(from), day(to + 1)]);
}

/* ───────────────────────────────────────────────────────────── audit 1 · a free gift order */

describe('a free gift order outlives its deleted offer (audit 1)', () => {
  test('ordered → End offer now → Delete → she cancels one item below the spend: the gift cancels with it, its stock and its count come back, and the lines still point at the offer and its pool row', async () => {
    const w = await world({ kind: 'spend', prices: [1650, 800, 800], giftStock: 2 });
    const o = await place(w, [0, 1, 2]);                 // ₹3,250 ≥ ₹3,000 → one gift; cash on delivery
    expect(o.lines.filter((l) => l.role !== 'gift')).toHaveLength(3);
    const gift = o.lines.find((l) => l.role === 'gift');
    expect(gift).toMatchObject({ status: 'active', offer_id: w.deal, gift_item_id: w.gifts[0] });
    expect(gift.pool_item_id).toBeTruthy();

    const giftStock = async () => Number((await query(`SELECT stock FROM gift_items WHERE id = $1`, [w.gifts[0]])).rows[0].stock);
    const given = async () => Number((await query(`SELECT gifts_given FROM offer_pool_items WHERE id = $1`, [gift.pool_item_id])).rows[0].gifts_given);
    const poolRows = async () => (await query(
      `SELECT id, pool, product_id, gift_item_id, gifts_given, removed_at FROM offer_pool_items WHERE offer_id = $1 ORDER BY id`, [w.deal])).rows;
    expect(await giftStock()).toBe(1);                   // 2 in stock, 1 given with this order
    expect(await given()).toBe(1);
    const poolBefore = await poolRows();
    expect(poolBefore).toHaveLength(4);                  // 3 products to buy + the gift

    await endAndDelete(w);

    // Deleting took nothing but the days it held: every pool row is still there, the gift still counted.
    expect(await poolRows()).toEqual(poolBefore);
    expect((await query(`SELECT bool_and(isempty(lock_days)) AS free FROM offer_pool_items WHERE offer_id = $1`, [w.deal])).rows[0].free).toBe(true);
    expect(await giftStock()).toBe(1);
    expect(await given()).toBe(1);

    // She cancels one ₹800 item: ₹2,450 is left, below the ₹3,000 the gift needed.
    const buy = o.lines.find((l) => l.role !== 'gift' && Number(l.paid_total) === 800);
    const kept = o.lines.filter((l) => l.role !== 'gift' && l.id !== buy.id);
    const both = [buy.id, gift.id].sort();
    const pv = await api.get(`/follower/orders/lines/${buy.id}/cancel`, o.sh.token);
    expect(pv.status).toBe(200);
    expect(pv.body.data.lines.map((l) => l.id).sort()).toEqual(both);
    expect(pv.body.data.warning).toBe('This is part of a deal. Cancelling cancels 2 items together.');

    const r = await api.post(`/follower/orders/lines/${buy.id}/cancel`, o.sh.token, { reason: 'Other', note: 'Changed my mind' });
    expect(r.status).toBe(200);
    expect([...r.body.data.cancelled].sort()).toEqual(both);
    expect(r.body.data.parcel_cancelled).toBe(false);
    expect(r.body.data.refund).toMatchObject({ amount: 0, status: 'not_needed' });   // cash on delivery: nothing was paid

    const { rows: after } = await query(
      `SELECT l.id, l.status, l.offer_id, o.name AS offer_name, (o.deleted_at IS NOT NULL) AS offer_hidden,
              l.pool_item_id, i.offer_id AS pool_offer, i.pool AS pool_kind, i.gift_item_id AS pool_gift
         FROM order_lines l
         LEFT JOIN brand_offers o ON o.id = l.offer_id
         LEFT JOIN offer_pool_items i ON i.id = l.pool_item_id
        WHERE l.checkout_id = $1`, [o.checkoutId]);
    expect(after).toHaveLength(4);
    const by = Object.fromEntries(after.map((l) => [l.id, l]));
    expect(by[buy.id].status).toBe('cancelled');
    expect(by[gift.id].status).toBe('cancelled');
    for (const l of kept) expect(by[l.id].status).toBe('active');
    // Every line still names the offer; the offer is still there, hidden from its brand only.
    for (const l of after) expect(l).toMatchObject({ offer_id: w.deal, offer_name: w.name, offer_hidden: true });
    // The gift line's pool row still resolves: the same row, of this offer, for this gift item.
    expect(by[gift.id]).toMatchObject({ pool_item_id: gift.pool_item_id, pool_offer: w.deal, pool_kind: 'gift', pool_gift: w.gifts[0] });

    // The gift is back in stock and no longer counted as given; the cancelled item's stock is back too.
    expect(await giftStock()).toBe(2);
    expect(await given()).toBe(0);
    expect(await stock32(buy.product_id)).toBe(5);
    for (const l of kept) expect(await stock32(l.product_id)).toBe(4); // eslint-disable-line no-await-in-loop

    // The shopper and the brand still read the order.
    const detail = await api.get(`/follower/orders/lines/${gift.id}`, o.sh.token);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id: gift.id, status: 'cancelled' });
    const mine = await api.get('/follower/orders', o.sh.token);
    expect(mine.status).toBe(200);
    expect(mine.body.data.items.map((x) => x.id).sort()).toEqual(o.lines.map((l) => l.id).sort());
    const parcels = await api.get('/brands/me/parcels', w.b.token);
    expect(parcels.status).toBe(200);
    const parcel = parcels.body.data.parcels.find((p) => p.id === o.parcel.id);
    expect(parcel.items.filter((x) => x.status === 'cancelled').map((x) => x.id).sort()).toEqual(both);
  });
});

/* ───────────────────────────────────────────────────────────── audit 2 · a bundle order, paid online */

describe('a bundle order outlives its deleted offer (audit 2)', () => {
  test('paid online → End offer now → Delete → the brand cancels one item: the pair cancels together, the refund is issued, her commission and the brand\'s share are reversed, and both wallets still name the offer', async () => {
    const w = await world({ kind: 'pick_any', prices: [2000, 1500, 1900] });
    const o = await place(w, [0, 1], 'online');          // any 2 for ₹2,999, paid online
    expect(o.lines).toHaveLength(2);
    expect(o.lines.reduce((s, l) => s + Number(l.paid_total), 0)).toBe(2999);
    expect(Number(o.tx.influencer_commission)).toBeGreaterThan(0);
    expect(Number(o.tx.brand_net)).toBeGreaterThan(0);
    const pendingOf = async () => Number((await query(`SELECT pending_balance FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0].pending_balance);
    const pending0 = await pendingOf();
    expect(pending0).toBe(Number(o.tx.influencer_commission));
    expect(await stock32(w.ids[0])).toBe(4);
    expect(await stock32(w.ids[1])).toBe(4);

    await endAndDelete(w);

    const ids = o.lines.map((l) => l.id).sort();
    const r = await api.post(`/brands/me/orders/lines/${o.lines[1].id}/cancel`, w.b.token, { reason: 'Out of stock' });
    expect(r.status).toBe(200);
    expect([...r.body.data.cancelled].sort()).toEqual(ids);                           // the pair, together
    expect(r.body.data).toMatchObject({ parcel_cancelled: true, refund: { amount: 2999, status: 'issued' } });
    expect(r.body.data.refund.id).toMatch(/^rfnd_mock_/);

    const { rows: after } = await query(
      `SELECT id, status, cancelled_by, refund_status, refund_id, offer_id, refund_amount, paid_total FROM order_lines WHERE checkout_id = $1`, [o.checkoutId]);
    expect(after.map((l) => l.id).sort()).toEqual(ids);
    for (const l of after) {
      expect(l).toMatchObject({ status: 'cancelled', cancelled_by: 'brand', refund_status: 'issued', refund_id: r.body.data.refund.id, offer_id: w.deal });
      expect(Number(l.refund_amount)).toBe(Number(l.paid_total));
    }
    expect((await query(`SELECT order_status FROM follower_orders WHERE id = $1`, [o.parcel.id])).rows[0].order_status).toBe('cancelled');

    // The money is undone exactly: her commission, the brand's share and INFLX's fee.
    const { rows: [tx] } = await query(`SELECT * FROM follower_transactions WHERE checkout_id = $1`, [o.checkoutId]);
    expect(Number(tx.commission_reversed)).toBe(Number(tx.influencer_commission));
    expect(Number(tx.brand_net_reversed)).toBe(Number(tx.brand_net));
    expect(Number(tx.platform_fee_reversed)).toBe(Number(tx.marketplace_fee_amount));
    expect(tx).toMatchObject({ status: 'refunded', brand_settlement_status: 'reversed', brand_offer_id: w.deal });
    expect(Math.round((pending0 - await pendingOf()) * 100) / 100).toBe(Number(tx.influencer_commission));
    expect(await pendingOf()).toBe(0);
    expect((await query(`SELECT count(*)::int AS n FROM influencer_ledger WHERE type = 'cancel_clawback' AND influencer_id = $1`, [w.cr.influencerId])).rows[0].n).toBe(1);
    expect(await stock32(w.ids[0])).toBe(5);
    expect(await stock32(w.ids[1])).toBe(5);

    // Both wallets still list the two items, cancelled, under the offer's name.
    const brandSales = await api.get('/brands/me/wallet/sales', w.b.token);
    expect(brandSales.status).toBe(200);
    const hers = await api.get('/influencers/me/wallet/commission', w.cr.token);
    expect(hers.status).toBe(200);
    for (const id of ids) {
      expect(brandSales.body.data.sales.find((s) => s.id === id)).toMatchObject({ offerName: w.name, state: 'cancelled', creatorShare: 0, brandShare: 0 });
      expect(hers.body.data.sales.find((s) => s.id === id)).toMatchObject({ offerName: w.name, state: 'cancelled', commission: 0 });
    }
    // And the brand still cannot see the offer itself.
    expect((await api.get(`/brands/me/offers/${w.deal}`, w.b.token)).status).toBe(404);
  });
});

/* ───────────────────────────────────────────────────────────── audit 3 · the daily ended-offer sweep */

describe('the daily sweep still works on an offer deleted before it ran (audit 3)', () => {
  test('ran out by its date → Delete → the sweep: her post leaves the shop and she is told, naming the offer', async () => {
    const w = await world({ kind: 'discount' });
    const shop = async () => (await request(app).get(`/v1/follower/posts/${w.post}`)).status;
    const removedNotices = () => H.notices(w.cr.userId, 'post.removed');
    await endedSweep.run();                              // nothing of an earlier day is left waiting for the sweep
    expect(await shop()).toBe(200);                      // her post is in the shop while the offer runs

    await runOut(w.deal);                                // its last day was yesterday; the sweep has not run yet
    expect(await row(w.deal)).toMatchObject({ status: 'published', deleted_at: null });
    expect((await listOf(w.b)).offers.find((x) => x.id === w.deal).display_status).toBe('ended');
    const d = await del(w.b, w.deal);
    expect(d.status).toBe(200);
    expect(d.body.data).toEqual({ deleted: true, mode: 'hidden' });

    // Deleting touches no post and tells nobody: that is the sweep's work.
    expect((await query(`SELECT status, removed_reason FROM creator_posts WHERE id = $1`, [w.post])).rows[0]).toEqual({ status: 'approved', removed_reason: null });
    expect(await removedNotices()).toHaveLength(0);
    expect(await shop()).toBe(404);                      // shoppers already cannot open a post whose offer ended

    expect(await endedSweep.run()).toEqual({ offers: 1, posts: 1 });

    expect((await query(`SELECT status, removed_reason FROM creator_posts WHERE id = $1`, [w.post])).rows[0]).toEqual({ status: 'removed', removed_reason: 'offer_ended' });
    const told = await removedNotices();
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({
      type: 'post.removed',
      title: '"Festive denim" left the shop',
      body: `The offer "${w.name}" ended. Your post promised it, so it can't stay up at full price.`,
    });
    expect(told[0].data_json).toMatchObject({ screen: 'post', post_id: w.post });
    const mine = await api.get(`${PP}/${w.post}`, w.cr.token);
    expect(mine.status).toBe(200);
    expect(mine.body.data.post).toMatchObject({ state: 'removed', offer_id: w.deal });
    expect(mine.body.data.post.offer.name).toBe(w.name);
    expect(mine.body.data.post.removed.reason).toBe('offer_ended');
    expect(await shop()).toBe(404);

    // The sweep is done with it: a second run finds nothing and tells her nothing more.
    expect(await endedSweep.run()).toEqual({ offers: 0, posts: 0 });
    expect(await removedNotices()).toHaveLength(1);
    // The offer is still hidden from its brand, its status as it was.
    const kept = await row(w.deal);
    expect(kept.status).toBe('published');
    expect(kept.deleted_at).toBeTruthy();
    expect((await listOf(w.b)).offers.map((x) => x.id)).not.toContain(w.deal);
  });
});

/* ───────────────────────────────────────────────────────────── audit 4 · the India-day boundary */

describe('"ended" is decided by the day in India (audit 4)', () => {
  // Only the clock's date is faked. Every timer stays real: the database driver needs them.
  const REAL_TIMERS = ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'queueMicrotask', 'performance', 'hrtime', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback'];
  /** Run `fn` with the process clock at `iso`; the real clock is always put back. */
  async function at(iso, fn) {
    jest.useFakeTimers({ now: Date.parse(iso), doNotFake: REAL_TIMERS });
    try { return await fn(); } finally { jest.useRealTimers(); }
  }
  afterEach(() => { jest.useRealTimers(); });

  test('an offer whose last day is today is refused, by the website\'s door and by the service; the same offer on the next India day is hidden', async () => {
    expect(istDayOf('2026-10-03T18:29:59.999Z')).toBe('2026-10-03');   // 23:59:59 in India
    expect(istDayOf('2026-10-03T18:30:00.000Z')).toBe('2026-10-04');   // midnight in India

    const X = await H.brand();
    const id = await H.ready(X.token, { name: 'Last day today', ids: [await H.prod(X.brandId, t.shirts, 'Boundary shirt', 999)], from: day(-3), to: day(0) });
    expect((await H.read(X.token, id)).offer).toMatchObject({ display_status: 'live', ends_on: day(0), days_left: 1 });

    const viaApi = await del(X, id);                     // today is really its last day
    expect(viaApi.status).toBe(409);
    expect(viaApi.body.error).toMatchObject({ code: 'OFFER_LOCKED', message: RUNNING });
    await expect(life.deleteOffer(X.brandId, id, { today: day(0) })).rejects.toMatchObject({ statusCode: 409, code: 'OFFER_LOCKED', message: RUNNING });
    await expect(life.deleteOffer(X.brandId, id, { today: day(-1) })).rejects.toMatchObject({ statusCode: 409, code: 'OFFER_LOCKED' });
    expect(await row(id)).toMatchObject({ status: 'published', deleted_at: null });
    expect((await query(`SELECT bool_and(NOT isempty(lock_days)) AS held FROM offer_pool_items WHERE offer_id = $1`, [id])).rows[0].held).toBe(true);

    expect(await life.deleteOffer(X.brandId, id, { today: day(1) })).toEqual({ deleted: true, mode: 'hidden' });   // the next India day
    const kept = await row(id);
    expect(kept.status).toBe('published');
    expect(kept.deleted_at).toBeTruthy();

    // A Scheduled offer is refused on every day before it starts, the eve included.
    const sched = await H.ready(X.token, { name: 'Starts tomorrow', ids: [await H.prod(X.brandId, t.shirts, 'Boundary shirt 2', 999)], from: day(1), to: day(5) });
    await expect(life.deleteOffer(X.brandId, sched, { today: day(0) })).rejects.toMatchObject({ statusCode: 409, code: 'OFFER_LOCKED' });
    expect(await row(sched)).toMatchObject({ status: 'published', deleted_at: null });
    expect((await H.read(X.token, sched)).offer).toMatchObject({ display_status: 'scheduled', starts_on: day(1), ends_on: day(5) });
  });

  test('the clock: at 23:59 in India on its last day it is refused; at 00:15 the next day — still the last day by the UTC date — it is hidden', async () => {
    const X = await H.brand();
    const a = await H.ready(X.token, { name: 'Last day D', ids: [await H.prod(X.brandId, t.shirts, 'Clock shirt 1', 999)], from: day(-3), to: day(9) });
    const b = await H.ready(X.token, { name: 'Last day D+1', ids: [await H.prod(X.brandId, t.shirts, 'Clock shirt 2', 999)], from: day(-3), to: day(9) });
    const D = '2030-03-10';
    const D1 = '2030-03-11';
    await query(`UPDATE brand_offers SET starts_on = '2030-03-01', ends_on = $2 WHERE id = $1`, [a, D]);
    await query(`UPDATE brand_offers SET starts_on = '2030-03-01', ends_on = $2 WHERE id = $1`, [b, D1]);
    const shown = async () => Object.fromEntries((await life.list(X.brandId)).offers.map((o) => [o.name, o.display_status]));
    const refused = (id) => expect(life.deleteOffer(X.brandId, id)).rejects.toMatchObject({ statusCode: 409, code: 'OFFER_LOCKED', message: RUNNING });

    // 18:29 UTC on D = 23:59 in India on D: both are still Live.
    await at(`${D}T18:29:00Z`, async () => {
      expect(todayInIndia()).toBe(D);
      expect(await shown()).toEqual({ 'Last day D': 'live', 'Last day D+1': 'live' });
      await refused(a);
      await refused(b);
    });
    expect(await row(a)).toMatchObject({ status: 'published', deleted_at: null });

    // 18:45 UTC on D = 00:15 in India on D+1. The UTC date is still D.
    await at(`${D}T18:45:00Z`, async () => {
      expect(new Date().toISOString().slice(0, 10)).toBe(D);
      expect(todayInIndia()).toBe(D1);
      expect(await shown()).toEqual({ 'Last day D': 'ended', 'Last day D+1': 'live' });
      await refused(b);
      expect(await life.deleteOffer(X.brandId, a)).toEqual({ deleted: true, mode: 'hidden' });
      expect(await shown()).toEqual({ 'Last day D+1': 'live' });
    });

    // Midnight UTC is no boundary: just before and just after it, it is the same day in India (D+1).
    await at(`${D}T23:59:00Z`, async () => { expect(todayInIndia()).toBe(D1); await refused(b); });
    await at(`${D1}T00:01:00Z`, async () => { expect(todayInIndia()).toBe(D1); await refused(b); });

    const hidden = (await query(`SELECT name, deleted_at IS NOT NULL AS hidden FROM brand_offers WHERE id = ANY($1::uuid[]) ORDER BY name`, [[a, b]])).rows;
    expect(hidden).toEqual([{ name: 'Last day D', hidden: true }, { name: 'Last day D+1', hidden: false }]);
    expect((await row(a)).status).toBe('published');
  });
});

/* ───────────────────────────────────────────────────────────── audit 5 · the old builder; deletes at once */

describe('the old builder\'s offers are out of reach (audit 5)', () => {
  test('an engine 1 offer — draft, active or archived — answers not found and is untouched', async () => {
    const X = await H.brand();
    for (const status of ['draft', 'active', 'archived']) {
      const { rows: [made] } = await query( // eslint-disable-line no-await-in-loop
        `INSERT INTO brand_offers (brand_id, name, offer_type, offer_config_json, status)
         VALUES ($1, $2, 'discount', '{"sub_type":"pct","value":10}'::jsonb, $3) RETURNING *`,
        [X.brandId, `Old builder ${status}`, status]);
      expect(made.engine).toBe(1);
      const r = await del(X, made.id); // eslint-disable-line no-await-in-loop
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe('NOT_FOUND');
      const { rows: [after] } = await query(`SELECT * FROM brand_offers WHERE id = $1`, [made.id]); // eslint-disable-line no-await-in-loop
      expect(after).toEqual(made);                       // still there, every column as it was
      expect(after).toMatchObject({ status, deleted_at: null });
      // The old builder's own door still opens it.
      expect((await api.get(`/brands/me/offers/${made.id}/attachments`, X.token)).status).toBe(200); // eslint-disable-line no-await-in-loop
    }
    const oldList = await api.get('/brands/me/offers', X.token);
    expect(oldList.status).toBe(200);
    expect(oldList.body.data.offers.map((o) => o.name).sort()).toEqual(['Old builder active', 'Old builder archived', 'Old builder draft']);
  });
});

describe('deletes sent at the same moment (audit 5)', () => {
  test('three deletes of one ended offer: exactly one answers deleted, the other two not found', async () => {
    const X = await H.brand();
    const id = await H.ready(X.token, { name: 'Three at once', ids: [await H.prod(X.brandId, t.shirts, 'Thrice shirt', 999)], from: day(-3), to: day(9) });
    expect((await api.post(`/brands/me/offers/${id}/end`, X.token)).status).toBe(200);
    const rs = await Promise.all([del(X, id), del(X, id), del(X, id)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 404, 404]);
    expect(rs.find((r) => r.status === 200).body.data).toEqual({ deleted: true, mode: 'hidden' });
    for (const r of rs.filter((x) => x.status === 404)) expect(r.body.error.code).toBe('NOT_FOUND');
    const kept = await row(id);
    expect(kept.status).toBe('ended');
    expect(kept.deleted_at).toBeTruthy();
    expect((await listOf(X)).offers.map((o) => o.id)).not.toContain(id);
  });

  test('two deletes of one draft: exactly one answers deleted', async () => {
    const X = await H.brand();
    const d = await H.draft(X.token, { offer_type: 'bogo' });
    const rs = await Promise.all([del(X, d.id), del(X, d.id)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 404]);
    expect(rs.find((r) => r.status === 200).body.data).toEqual({ deleted: true, mode: 'erased' });
    expect(await row(d.id)).toBeUndefined();
  });

  test('End offer now and Delete sent together on a live offer with a post: it ends, her post leaves the shop and she is told; it is never hidden while still running', async () => {
    const w = await world({ kind: 'discount' });
    const [e, d] = await Promise.all([api.post(`/brands/me/offers/${w.deal}/end`, w.b.token), del(w.b, w.deal)]);
    expect(e.status).toBe(200);
    expect([200, 409]).toContain(d.status);
    const kept = await row(w.deal);
    expect(kept.status).toBe('ended');
    if (d.status === 409) {                              // the delete came first: refused, nothing hidden
      expect(d.body.error).toMatchObject({ code: 'OFFER_LOCKED', message: RUNNING });
      expect(kept.deleted_at).toBeNull();
    } else {                                             // the end came first: then it could be deleted
      expect(d.body.data).toEqual({ deleted: true, mode: 'hidden' });
      expect(kept.deleted_at).toBeTruthy();
    }
    // Either way the end did all of its own work.
    expect((await query(`SELECT status, removed_reason FROM creator_posts WHERE id = $1`, [w.post])).rows[0]).toEqual({ status: 'removed', removed_reason: 'offer_ended' });
    const told = await H.notices(w.cr.userId, 'offer_ended');
    expect(told).toHaveLength(1);
    expect(told[0].title).toBe(`"${w.name}" has ended`);
  });
});

/* ───────────────────────────────────────────────────────────── audit · an unsigned invitation */

describe('an unsigned invitation holding an offer that ran out and was then deleted (audit)', () => {
  test('she still reads her invitation, with the offer as Ended; the brand still reads her row', async () => {
    const X = await H.brand();
    const p = await H.prod(X.brandId, t.jeans, 'Unsigned jeans', 1500);
    const id = await H.ready(X.token, { type: 'discount', sub: 'percentage', name: 'Ran out unsigned', cfg: { pct: 20 }, ids: [p], from: day(-5), to: day(40) });
    const c = await w10.campaign(X, { name: 'Unsigned camp' });
    const s = await w10.set(X, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
    const cr = await H.creator({ name: 'Unsigned Creator' });
    const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, X.token,
      { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [id] } }] });
    expect(inv.status).toBe(201);
    const ciId = inv.body.data.rows[0].id;

    await runOut(id);
    expect((await del(X, id)).body.data).toEqual({ deleted: true, mode: 'hidden' });

    const sell = await api.get(`/influencers/me/invitations/${ciId}/sell`, cr.token);
    expect(sell.status).toBe(200);
    expect(sell.body.data.offers.find((x) => x.id === id)).toMatchObject({ name: 'Ran out unsigned', display_status: 'ended' });
    const one = await api.get(`/influencers/me/invitations/${ciId}/offers/${id}`, cr.token);
    expect(one.status).toBe(200);
    expect(one.body.data.offer).toMatchObject({ id, name: 'Ran out unsigned', display_status: 'ended' });
    expect(one.body.data.offer.products.map((x) => x.id)).toEqual([p]);
    expect((await api.get(`/campaigns/${c.id}/sets/${s.id}/invitations/${ciId}`, X.token)).status).toBe(200);
    expect((await query(`SELECT count(*)::int AS n FROM collab_offers WHERE campaign_influencer_id = $1 AND offer_id = $2`, [ciId, id])).rows[0].n).toBe(1);
  });
});
