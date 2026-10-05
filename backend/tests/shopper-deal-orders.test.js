'use strict';

/**
 * shopper-deal-orders, part C — one item of an offer can be bought alone (03-expected-outputs.md CS1–CS12).
 *
 *   Alone is always the normal price; the offer's price applies only once the offer is completed.
 *   Never for buy one get one. A set only when its brand switched "pieces can also be bought alone" on.
 * The engine alone first (no database), then the real API on a live post of each kind.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const w10 = require('./helpers/item10');
const { createAdminUser, createFollowerUser } = require('./helpers/factories');
const settings = require('../src/services/platformSettings.service');
const engine = require('../src/services/orderPricing.service');
const rules = require('../src/services/offerRules');
const { api, query, day } = H;

/* ═══════════════════════════════════════════ 1 · the rules and the engine alone */

describe('which offers let one product be bought alone (CS1, CS2)', () => {
  const offer = (sub, cfg = {}) => ({ sub_type: sub, offer_config_json: cfg });

  test('CS1 a set keeps `pieces_alone` only when it is exactly true; missing is off', () => {
    expect(rules.normaliseConfig('fixed', { price: 5000 }).pieces_alone).toBe(false);
    expect(rules.normaliseConfig('fixed', { price: 5000, pieces_alone: 'yes' }).pieces_alone).toBe(false);
    expect(rules.normaliseConfig('fixed', { price: 5000, pieces_alone: 1 }).pieces_alone).toBe(false);
    expect(rules.normaliseConfig('fixed', { price: 5000, pieces_alone: true }).pieces_alone).toBe(true);
    // no other kind of offer grows the field
    expect(rules.normaliseConfig('pick_any', { pick: 3, price: 2999, pieces_alone: true })).toEqual({ pick: 3, price: 2999 });
  });

  test('CS2 bundle, buy more and gift offers: yes · buy one get one: no · a set: only with the switch', () => {
    for (const sub of ['pick_any', 'mix_match', 'quantity', 'value', 'spend', 'buy_x', 'percentage', 'flat']) expect(rules.aloneAllowed(offer(sub))).toBe(true);
    expect(rules.aloneAllowed(offer('bogo'))).toBe(false);
    expect(rules.aloneAllowed(offer('fixed', { price: 5000 }))).toBe(false);
    expect(rules.aloneAllowed(offer('fixed', { price: 5000, pieces_alone: true }))).toBe(true);
  });

  test('CS12 the shopper is told a piece can also be bought alone — only when it can', () => {
    expect(rules.shopperSays(offer('fixed', { price: 5000 }), { buy: [] })).toBe('Buy the whole set for ₹5,000. You only choose size and colour.');
    expect(rules.shopperSays(offer('fixed', { price: 5000, pieces_alone: true }), { buy: [] }))
      .toBe('Buy the whole set for ₹5,000. You only choose size and colour. A piece can also be bought alone, at its normal price.');
  });
});

describe('the price engine, items outside a completed deal (CS3–CS9)', () => {
  const prod = (id, price) => [id, { id, name: id, price, on_sale: true, variants_json: null, stock: null }];
  const ctx = (sub, cfg, prods, pool) => ({ post_id: 'p', brand_id: 'b', live: true,
    offer: { id: 'o', offer_type: 'x', sub_type: sub, offer_config_json: cfg }, offer_live: true, buyPool: new Set(pool), gifts: new Map(),
    products: new Map(prods), commission_pct: 10, fee_pct: 5 });
  const BUNDLE = () => ctx('pick_any', { pick: 3, price: 2999 }, [prod('polo', 1299), prod('shirt', 1499), prod('jeans', 1999), prod('coat', 2499)], ['polo', 'shirt', 'jeans', 'coat']);
  const SET = (alone) => ctx('fixed', { price: 5000, pieces_alone: alone }, [prod('red', 500), prod('blazer', 4298), prod('chino', 2500)], ['red', 'blazer', 'chino']);
  const by = (g, id) => g.lines.filter((l) => l.product_id === id);

  test('CS3 one item of "Any 3 for ₹2,999" pays its normal price, can be bought, and is nudged to complete the offer', () => {
    const g = engine.priceGroup(BUNDLE(), [{ product_id: 'jeans' }]);
    expect(g.paid_total).toBe(1999);
    expect(g.savings).toBe(0);
    expect(g.buyable).toBe(true);
    expect(g.problems).toEqual([]);
    expect(g.lines[0].deal_key).toBeNull();
    expect(g.offer.alone).toBe(true);
    expect(g.alone_nudge).toBe('Add 2 more from this post and get all 3 for ₹2,999');
    // two items: still each at its normal price, one more to go
    const two = engine.priceGroup(BUNDLE(), [{ product_id: 'jeans' }, { product_id: 'polo' }]);
    expect(two.paid_total).toBe(3298);
    expect(two.alone_nudge).toBe('Add 1 more from this post and get all 3 for ₹2,999');
  });

  test('CS4 the three complete the offer by themselves: ₹2,999 shared by normal price, nothing left to nudge', () => {
    const g = engine.priceGroup(BUNDLE(), [{ product_id: 'polo' }, { product_id: 'shirt' }, { product_id: 'jeans' }]);
    expect(g.normal_total).toBe(4797);
    expect(g.paid_total).toBe(2999);
    expect(g.savings).toBe(1798);
    expect(g.lines.every((l) => l.deal_key === 'set-1')).toBe(true);
    expect([by(g, 'polo')[0].paid_total, by(g, 'shirt')[0].paid_total, by(g, 'jeans')[0].paid_total]).toEqual([812, 937, 1250]);
    expect(g.alone_nudge).toBeNull();
    expect(g.buyable).toBe(true);
  });

  test('CS5 four items: the three costliest are the set, the fourth pays its normal price outside it', () => {
    const g = engine.priceGroup(BUNDLE(), [{ product_id: 'polo' }, { product_id: 'shirt' }, { product_id: 'jeans' }, { product_id: 'coat' }]);
    expect(by(g, 'polo')[0].deal_key).toBeNull();
    expect(by(g, 'polo')[0].paid_total).toBe(1299);
    for (const id of ['shirt', 'jeans', 'coat']) expect(by(g, id)[0].deal_key).toBe('set-1');
    expect(g.paid_total).toBe(2999 + 1299);
    expect(g.alone_nudge).toBe('Add 2 more to complete another set of 3 for ₹2,999');
    expect(g.buyable).toBe(true);
  });

  test('CS5 two of the cheapest where only one fits the set: that line splits, one unit in the set and one outside', () => {
    const g = engine.priceGroup(BUNDLE(), [{ ref: 'a', product_id: 'polo', qty: 2 }, { ref: 'b', product_id: 'jeans' }, { ref: 'c', product_id: 'coat' }]);
    const polo = g.lines.filter((l) => l.ref === 'a');
    expect(polo.map((l) => [l.qty, l.deal_key])).toEqual(expect.arrayContaining([[1, null], [1, 'set-1']]));
    expect(polo).toHaveLength(2);
    expect(polo.find((l) => l.deal_key === null).paid_total).toBe(1299);      // outside the set: its normal price
    expect(g.lines.find((l) => l.ref === 'c').deal_key).toBe('set-1');        // the costliest fill the set first
    expect(g.alone_nudge).toBe('Add 2 more to complete another set of 3 for ₹2,999');
  });

  test('CS6 a set the brand has NOT opened: one piece cannot be bought ("Sold only as the whole set"), as before', () => {
    const g = engine.priceGroup(SET(false), [{ product_id: 'red' }]);
    expect(g.problems.map((p) => p.code)).toEqual(['incomplete_set']);
    expect(g.buyable).toBe(false);
    expect(g.offer.alone).toBe(false);
    expect(g.alone_nudge).toBeNull();
    // and with the field missing altogether (every set offer that exists today)
    const old = engine.priceGroup(ctx('fixed', { price: 5000 }, [prod('red', 500), prod('blazer', 4298)], ['red', 'blazer']), [{ product_id: 'red' }]);
    expect(old.buyable).toBe(false);
    expect(old.offer.alone).toBe(false);
  });

  test('CS7 a set the brand opened: one piece pays its normal price and can be bought', () => {
    const g = engine.priceGroup(SET(true), [{ product_id: 'red' }]);
    expect(g.problems).toEqual([]);
    expect(g.buyable).toBe(true);
    expect(g.paid_total).toBe(500);
    expect(g.lines[0].deal_key).toBeNull();
    expect(g.offer.alone).toBe(true);
    expect(g.alone_nudge).toBe('Take the whole set of 3 and pay ₹5,000');
  });

  test('CS8 an opened set: the whole set costs the set price; one more piece on top pays its normal price', () => {
    const whole = engine.priceGroup(SET(true), [{ product_id: 'red' }, { product_id: 'blazer' }, { product_id: 'chino' }]);
    expect(whole.paid_total).toBe(5000);
    expect(whole.normal_total).toBe(7298);
    expect(whole.lines.every((l) => l.deal_key === 'set-1')).toBe(true);
    expect(whole.alone_nudge).toBeNull();
    const plus = engine.priceGroup(SET(true), [{ product_id: 'red', qty: 2 }, { product_id: 'blazer' }, { product_id: 'chino' }]);
    expect(plus.paid_total).toBe(5000 + 500);
    expect(plus.buyable).toBe(true);
    expect(plus.lines.filter((l) => l.product_id === 'red').map((l) => l.deal_key).sort()).toEqual([null, 'set-1'].sort());
    // the same picks on an unopened set are refused, as before
    expect(engine.priceGroup(SET(false), [{ product_id: 'red', qty: 2 }, { product_id: 'blazer' }, { product_id: 'chino' }]).buyable).toBe(false);
  });

  test('CS9 buy one get one is untouched: no "alone", no nudge of this kind', () => {
    const g = engine.priceGroup(ctx('bogo', { max_free: 2 }, [prod('tee', 599)], ['tee']), [{ product_id: 'tee', role: 'buy' }, { product_id: 'tee', role: 'free' }]);
    expect(g.paid_total).toBe(599);
    expect(g.offer.alone).toBe(false);
    expect(g.alone_nudge).toBeNull();
  });

  test('buy more save more and a plain discount say `alone` and need no nudge of this kind (their own progress is the nudge)', () => {
    const v = engine.priceGroup(ctx('quantity', { reward: 'pct', tiers: [{ at: 2, value: 20 }] }, [prod('a', 1000), prod('b', 1000)], ['a', 'b']), [{ product_id: 'a' }]);
    expect(v.offer.alone).toBe(true);
    expect(v.alone_nudge).toBeNull();
    expect(v.progress.next).toBe('1 more → 20% off');
    expect(v.paid_total).toBe(1000);
  });
});

/* ═══════════════════════════════════════════ 2 · the real API on live posts */

let t, admin, seq = 0;

/** A published offer of `kind` over `ids`. */
function offerOf(b, kind, ids) {
  const n = `${kind} ${seq}`;
  const base = { name: n, ids, from: day(-5), to: day(40) };
  switch (kind) {
    case 'discount': return H.ready(b.token, { ...base, type: 'discount', sub: 'percentage', cfg: { pct: 20 } });
    case 'pick3': return H.ready(b.token, { ...base, type: 'bundle', sub: 'pick_any', cfg: { pick: 3, price: 2999 } });
    case 'quantity': return H.ready(b.token, { ...base, type: 'volume', sub: 'quantity', cfg: { reward: 'pct', tiers: [{ at: 2, value: 20 }] } });
    case 'bogo': return H.ready(b.token, { ...base, type: 'bogo', sub: 'bogo', cfg: { max_free: 2 } });
    case 'set': return H.ready(b.token, { ...base, type: 'bundle', sub: 'fixed', cfg: { price: 3500 } });
    case 'set_open': return H.ready(b.token, { ...base, type: 'bundle', sub: 'fixed', cfg: { price: 3500, pieces_alone: true } });
    default: throw new Error(kind);
  }
}

const PP = '/influencers/me/shoppable-posts';
const patchPost = (w, id, body) => request(app).patch(`/v1${PP}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);
async function makePost(w) {
  const { body } = await api.post(PP, w.cr.token, { campaign_influencer_id: w.ciId });
  const id = body.data.post.id;
  const [tg] = (await query(`SELECT id FROM theme_tags WHERE name = 'Festive'`)).rows;
  await patchPost(w, id, { post_kind: 'offer' });
  await patchPost(w, id, { offer_id: w.deal });
  await patchPost(w, id, { product_ids: w.ids, theme_tag_ids: [tg.id], media_kind: 'image', media_layout: 'single' });
  const up = await api.post(`${PP}/${id}/upload-url`, w.cr.token, { content_type: 'image/jpeg', size_bytes: 1024 });
  const u = new URL(up.body.data.url);
  await request(app).put(`${u.pathname}${u.search}`).set('Content-Type', 'image/jpeg').send(Buffer.alloc(1024, 7));
  await patchPost(w, id, { media: [{ r2_key: up.body.data.key, mime: 'image/jpeg' }], caption: 'Festive denim' });
  const s = await api.post(`${PP}/${id}/submit`, w.cr.token);
  if (s.status !== 200) throw new Error(`submit: ${JSON.stringify(s.body)}`);
  const a = await api.post(`/admin/posts/${id}/approve`, admin.token);
  if (a.status !== 200) throw new Error(`approve: ${JSON.stringify(a.body)}`);
  return id;
}

/** A signed collaboration (10% commission) on an offer of `kind`, with one approved live post. */
// A pick-any bundle publishes only when its costliest item is at most 1.5 × its cheapest, so these
// are not the board's example prices (₹1,299 would be too far from ₹1,999).
async function world(kind, prices = [1399, 1499, 1999]) {
  seq += 1;
  const b = await H.brand();
  const ids = [];
  for (let i = 0; i < prices.length; i++) ids.push(await H.prod(b.brandId, t.jeans, `Piece ${seq}-${i}`, prices[i]));
  const deal = await offerOf(b, kind, ids);
  const c = await w10.campaign(b, { name: 'Diwali Denim' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: 'Akshaya Reddy' });
  await query(`UPDATE influencers SET instagram_handle = $2, full_name = 'Akshaya Reddy' WHERE id = $1`, [cr.influencerId, `akshaya_${seq}`]);
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token,
    { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [deal] } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, ids, deal };
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    const r = await step(w);
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  const { rows: [con] } = await query(`SELECT id FROM contracts WHERE campaign_influencer_id = $1`, [ciId]);
  await query(`INSERT INTO production_events (contract_id, mode, status) VALUES ($1, 'shipment', 'completed')
               ON CONFLICT (contract_id) DO UPDATE SET status = 'completed'`, [con.id]);
  w.post = await makePost(w);
  await query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [w.s.id, day(-1)]);
  return w;
}

async function shopper() {
  const f = await createFollowerUser({ name: 'Anusha K' });
  const { rows } = await query(`SELECT id FROM followers WHERE user_id = $1`, [f.user.id]);
  return { token: f.token, userId: f.user.id, followerId: rows[0].id };
}
const ADDRESS = { receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B, Lotus Residency', area: 'Road No. 3, Banjara Hills',
  landmark: 'Near the park', pincode: '500034', city: 'Hyderabad', state: 'Telangana', label: 'Home' };
const line = (w, i, extra = {}) => ({ post_id: w.post, product_id: w.ids[i], qty: 1, ...extra });
const dealOf = async (w) => (await api.get(`/follower/posts/${w.post}/deal`)).body.data;
const cardOf = async (w) => (await api.get(`/follower/posts/${w.post}`)).body.data;
const bagPrice = async (lines) => (await api.post('/follower/bag/price', undefined, { lines })).body.data;

describe('on live posts (CS10–CS12)', () => {
  const W = {};
  beforeAll(async () => {
    await truncateAll();
    settings._resetCache();
    t = await H.tree();
    admin = await createAdminUser();
    for (const kind of ['pick3', 'quantity', 'bogo', 'set', 'set_open', 'discount']) W[kind] = await world(kind);
  });

  test('CS10 the deal data and the post card say whether one product can be bought alone', async () => {
    const want = { pick3: true, quantity: true, set_open: true, bogo: false, set: false };
    for (const [kind, alone] of Object.entries(want)) {
      const d = await dealOf(W[kind]);
      expect([kind, d.deal_page, d.buy_alone]).toEqual([kind, true, alone]);
      const card = await cardOf(W[kind]);
      expect([kind, (card.post || card).deal_page, (card.post || card).buy_alone]).toEqual([kind, true, alone]);
    }
    // a plain discount has no deal page, so nothing to buy "alone" from: each item already is
    const d = await dealOf(W.discount);
    expect([d.deal_page, d.buy_alone]).toEqual([false, false]);
    const card = await cardOf(W.discount);
    expect((card.post || card).buy_alone).toBe(false);
  });

  test('CS3/CS4 her bag, priced by the server: one item at its normal price with the nudge; three become the deal', async () => {
    const w = W.pick3;
    const one = await bagPrice([line(w, 2, { ref: 'a' })]);
    expect(one.items_total).toBe(1999);
    expect(one.buyable).toBe(true);
    expect(one.groups[0].offer.alone).toBe(true);
    expect(one.groups[0].alone_nudge).toBe('Add 2 more from this post and get all 3 for ₹2,999');
    const three = await bagPrice([line(w, 2, { ref: 'a' }), line(w, 0, { ref: 'b' }), line(w, 1, { ref: 'c' })]);
    expect(three.items_normal).toBe(4897);
    expect(three.items_total).toBe(2999);
    expect(three.groups[0].lines.every((l) => l.deal_key === 'set-1')).toBe(true);
    expect(three.groups[0].alone_nudge).toBeNull();
  });

  test('CS6/CS7 one piece of a set: refused unless the brand opened the set', async () => {
    const shut = await bagPrice([line(W.set, 0)]);
    expect(shut.buyable).toBe(false);
    expect(shut.groups[0].problems.map((p) => p.text)).toEqual(['Sold only as the whole set']);
    const open = await bagPrice([line(W.set_open, 0)]);
    expect(open.buyable).toBe(true);
    expect(open.items_total).toBe(1399);
    expect(open.groups[0].alone_nudge).toBe('Take the whole set of 3 and pay ₹3,500');
    // the whole opened set still costs the set's price
    const whole = await bagPrice([line(W.set_open, 0), line(W.set_open, 1), line(W.set_open, 2)]);
    expect(whole.items_total).toBe(3500);
  });

  test('CS11 one item of a bundle post is ordered at its normal price; it is its own order line and the creator earns her % of it', async () => {
    const w = W.pick3;
    const sh = await shopper();
    const addr = (await api.post('/follower/addresses', sh.token, ADDRESS)).body.data.address.id;
    const lines = [line(w, 2)];
    const rv = await api.post('/follower/checkout/review', sh.token, { address_id: addr, lines, payment_method: 'cod' });
    expect(rv.status).toBe(200);
    expect(rv.body.data.parcels[0].items_total).toBe(1999);
    expect(rv.body.data.items_normal).toBe(1999);
    expect(rv.body.data.savings).toBe(0);
    const placed = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines, payment_method: 'cod', expected_total: rv.body.data.total });
    expect(placed.status).toBe(200);
    const { rows } = await query(`SELECT deal_key, paid_total, normal_total, commission, offer_id FROM order_lines WHERE follower_id = $1`, [sh.followerId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].deal_key).toBeNull();
    expect(Number(rows[0].paid_total)).toBe(1999);
    expect(Number(rows[0].normal_total)).toBe(1999);
    expect(Number(rows[0].commission)).toBeCloseTo(199.9, 2);
    // an unopened set's piece cannot be ordered
    const no = await api.post('/follower/checkout/review', sh.token, { address_id: addr, lines: [line(W.set, 0)], payment_method: 'cod' });
    expect(no.status === 200 ? no.body.data.buyable : false).toBe(false);
  });

  test('CS12 the brand\'s switch is saved with a draft set, kept at publish, and frozen with the other numbers', async () => {
    const w = W.set_open;
    const { rows: [o] } = await query(`SELECT status, offer_config_json FROM brand_offers WHERE id = $1`, [w.deal]);
    expect(o.status).toBe('published');
    expect(o.offer_config_json.pieces_alone).toBe(true);
    expect((await query(`SELECT offer_config_json FROM brand_offers WHERE id = $1`, [W.set.deal])).rows[0].offer_config_json.pieces_alone).toBe(false);
    // what the shopper is told on the deal page of the opened set
    expect((await dealOf(w)).offer.how).toMatch(/A piece can also be bought alone, at its normal price\.$/);
    expect((await dealOf(W.set)).offer.how).not.toMatch(/alone/);
    // a published offer's numbers cannot change — the switch is one of them
    const r = await api.patch(`/brands/me/offers/${W.set.deal}`, W.set.b.token, { offer_config_json: { price: 3500, pieces_alone: true } });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await query(`SELECT offer_config_json FROM brand_offers WHERE id = $1`, [W.set.deal])).rows[0].offer_config_json.pieces_alone).toBe(false);
  });
});
