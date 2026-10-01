'use strict';

/**
 * shopper-ordering — the price engine, the three-way money split, the bag, addresses, checkout
 * (cash on delivery and online), stock, cancelling with refunds and claw-backs, the brand's parcels,
 * and the money jobs on the new rows.
 * Contract: features/shopper-ordering · Docs/OFFER_TERMS_POSTS_RULES.md v1.13 §6 · checks C1–C36
 * Real API, real database; posts made through the Level 3 flow and approved by INFLX.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const w10 = require('./helpers/item10');
const { createAdminUser, createFollowerUser } = require('./helpers/factories');
const settings = require('../src/services/platformSettings.service');
const engine = require('../src/services/orderPricing.service');
const checkoutSvc = require('../src/services/shopperCheckout.service');
const settlement = require('../src/services/settlement.service');
const commissionConfirm = require('../src/jobs/commission-confirm.job');
const { api, query, day } = H;

let t, admin;
async function fresh() {
  await truncateAll();
  settings._resetCache();
  t = await H.tree();
  admin = await createAdminUser();
}

/* ───────────────────────────────────────────── a world: brand, offer, creator, a live post */

let seq = 0;
const SIZES = (stock) => ({ colors: [
  { color: 'Blue', images: [], sizes: [{ size: '30', stock }, { size: '32', stock }, { size: '34', stock }] },
  { color: 'Black', images: [], sizes: [{ size: '30', stock }, { size: '32', stock }] },
] });

/** An offer of `kind` over `ids` (and gifts), published. */
async function offerOf(b, kind, ids, gifts = []) {
  const n = `${kind} ${seq}`;
  switch (kind) {
    case 'discount': return H.ready(b.token, { type: 'discount', sub: 'percentage', name: n, cfg: { pct: 20 }, ids, from: day(-5), to: day(40) });
    case 'pick_any': return H.ready(b.token, { type: 'bundle', sub: 'pick_any', name: n, cfg: { pick: 2, price: 2999 }, ids, from: day(-5), to: day(40) });
    case 'quantity': return H.ready(b.token, { type: 'volume', sub: 'quantity', name: n, cfg: { reward: 'pct', tiers: [{ at: 2, value: 20 }, { at: 3, value: 30 }] }, ids, from: day(-5), to: day(40) });
    case 'bogo': return H.ready(b.token, { type: 'bogo', sub: 'bogo', name: n, cfg: { max_free: 2 }, ids, from: day(-5), to: day(40) });
    case 'spend': {
      const o = await H.draft(b.token, { offer_type: 'free_gift', sub_type: 'spend' });
      await H.patch(b.token, o.id, { name: n, starts_on: day(-5), ends_on: day(40), offer_config_json: { min_spend: 3000, gift_count: 1 } });
      await H.line(b.token, o.id, { pool: 'buy', method: 'search', query: 'x', product_ids: ids });
      const r = await H.line(b.token, o.id, { pool: 'gift', method: 'gift_items', gift_item_ids: gifts });
      if (r.status !== 201) throw new Error(`gift line: ${JSON.stringify(r.body)}`);
      const p = await H.publish(b.token, o.id);
      if (p.status !== 200) throw new Error(`publish: ${JSON.stringify(p.body)}`);
      return o.id;
    }
    default: throw new Error(kind);
  }
}

/** A signed collaboration (10% commission) on an offer, with one approved live post. */
async function world({ kind = 'discount', prices = [2299, 1999, 1799], stock = null, giftStock = 5 } = {}) {
  seq += 1;
  const b = await H.brand();
  const ids = [];
  for (let i = 0; i < prices.length; i++) {
    ids.push(await H.prod(b.brandId, t.jeans, `Jeans ${seq}-${i}`, prices[i], null, stock == null ? {} : { variants_json: SIZES(stock) }));
  }
  let gifts = [];
  if (kind === 'spend') {
    const coin = (await api.post('/brands/me/gift-items', b.token, { name: `Silver coin ${seq}`, value: 650, stock: giftStock })).body.data.gift_item;
    gifts = [coin.id];
  }
  const deal = await offerOf(b, kind, ids, gifts);
  const c = await w10.campaign(b, { name: 'Diwali Denim' });
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
  const cr = await H.creator({ name: 'Priya Rao' });
  await query(`UPDATE influencers SET instagram_handle = $2, full_name = 'Priya Rao' WHERE id = $1`, [cr.influencerId, `priya_${seq}`]);
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token,
    { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, offers: [deal] } }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, ids, deal, gifts };
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

async function shopper() {
  const f = await createFollowerUser({ name: 'Anusha K' });
  const { rows } = await query(`SELECT id FROM followers WHERE user_id = $1`, [f.user.id]);
  return { token: f.token, userId: f.user.id, followerId: rows[0].id };
}
const ADDRESS = { receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B, Lotus Residency', area: 'Road No. 3, Banjara Hills',
  landmark: 'Near the park', pincode: '500034', city: 'Hyderabad', state: 'Telangana', label: 'Home' };
async function addressOf(sh) {
  const r = await api.post('/follower/addresses', sh.token, ADDRESS);
  if (r.status !== 201) throw new Error(`address: ${JSON.stringify(r.body)}`);
  return r.body.data.address.id;
}
const line = (w, i, extra = {}) => ({ post_id: w.post, product_id: w.ids[i], qty: 1, ...extra });
async function review(sh, addressId, lines, method = 'cod') {
  return api.post('/follower/checkout/review', sh.token, { address_id: addressId, lines, payment_method: method });
}
async function placeCod(sh, addressId, lines) {
  const rv = await review(sh, addressId, lines, 'cod');
  if (rv.status !== 200) throw new Error(`review: ${JSON.stringify(rv.body)}`);
  return api.post('/follower/checkout/place', sh.token, { address_id: addressId, lines, payment_method: 'cod', expected_total: rv.body.data.total });
}
const money = (n) => Number(n);

/* ═══════════════════════════════════════════ 1 · the engine alone (C1–C13) */

describe('the price engine (C1–C13)', () => {
  const prod = (id, price) => [id, { id, name: id, price, on_sale: true, variants_json: null, stock: null }];
  const ctx = (sub, cfg, prods, pool, gifts = new Map()) => ({ post_id: 'p', brand_id: 'b', live: true,
    offer: { id: 'o', offer_type: 'x', sub_type: sub, offer_config_json: cfg }, offer_live: true, buyPool: new Set(pool), gifts,
    products: new Map(prods), commission_pct: 10, fee_pct: 5 });
  const paidOf = (g) => g.lines.map((l) => l.paid_total);

  test('C1 discount: 20% of ₹1,200 → ₹960; a cap of ₹150 → ₹1,050; % rounded to the rupee per unit', () => {
    expect(engine.priceGroup(ctx('percentage', { pct: 20 }, [prod('a', 1200)], ['a']), [{ product_id: 'a' }]).paid_total).toBe(960);
    expect(engine.priceGroup(ctx('percentage', { pct: 20, max_off: 150 }, [prod('a', 1200)], ['a']), [{ product_id: 'a' }]).paid_total).toBe(1050);
    expect(engine.priceGroup(ctx('percentage', { pct: 20 }, [prod('a', 999)], ['a']), [{ product_id: 'a' }]).paid_total).toBe(799);
  });

  test('C2 volume by quantity: ₹999 + ₹1,199 → ₹799 + ₹959, save ₹440; a third ₹1,799 → ₹1,259 at 30%', () => {
    const c = ctx('quantity', { reward: 'pct', tiers: [{ at: 2, value: 20 }, { at: 3, value: 30 }] }, [prod('k', 999), prod('b', 1199), prod('s', 1799)], ['k', 'b', 's']);
    const two = engine.priceGroup(c, [{ product_id: 'k' }, { product_id: 'b' }]);
    expect(paidOf(two)).toEqual([799, 959]);
    expect(two.savings).toBe(440);
    expect(two.progress.next).toBe('1 more → 30% off');
    const three = engine.priceGroup(c, [{ product_id: 'k' }, { product_id: 'b' }, { product_id: 's' }]);
    expect(three.lines[2].paid_total).toBe(1259);
  });

  test('C3 a single unit costs the same in the engine and on the post card', () => {
    const shp = require('../src/services/shoppablePosts.service');
    const offer = { offer_type: 'discount', sub_type: 'percentage', offer_config_json: { pct: 20 } };
    for (const price of [999, 1199, 1250, 2299]) {
      const g = engine.priceGroup(ctx('percentage', { pct: 20 }, [prod('a', price)], ['a']), [{ product_id: 'a' }]);
      expect(g.paid_total).toBe(shp.shopperPrice(offer, price));
    }
  });

  test('C4 volume ₹: ₹400 off the group once, shared by normal price, parts add up', () => {
    const g = engine.priceGroup(ctx('quantity', { reward: 'amount', tiers: [{ at: 2, value: 200 }, { at: 3, value: 400 }, { at: 4, value: 700 }] },
      [prod('crew', 699), prod('polo', 899)], ['crew', 'polo']), [{ product_id: 'crew', qty: 2 }, { product_id: 'polo' }]);
    expect(g.paid_total).toBe(1897);
    expect(g.savings).toBe(400);
    expect(g.progress.next).toBe('1 more → ₹700 off');
  });

  test('C5 volume by value: ₹2,450 → 10% → ₹2,205; "Spend ₹550 more → 20% off"', () => {
    const g = engine.priceGroup(ctx('value', { reward: 'pct', tiers: [{ at: 2000, value: 10 }, { at: 3000, value: 20 }] },
      [prod('d', 1650), prod('b', 800)], ['d', 'b']), [{ product_id: 'd' }, { product_id: 'b' }]);
    expect(g.paid_total).toBe(2205);
    expect(g.progress.next).toBe('Spend ₹550 more → 20% off');
  });

  test('C6 pick any: the costliest two make the set at ₹2,999; the third pays normal with the nudge', () => {
    const c = ctx('pick_any', { pick: 2, price: 2999 }, [prod('l', 2299), prod('w', 1999), prod('p', 1799)], ['l', 'w', 'p']);
    const g = engine.priceGroup(c, [{ product_id: 'p' }, { product_id: 'l' }, { product_id: 'w' }]);
    const byId = Object.fromEntries(g.lines.map((l) => [l.product_id, l]));
    expect(byId.p.paid_total).toBe(1799);
    expect(byId.p.deal_key).toBeNull();
    expect(byId.l.paid_total + byId.w.paid_total).toBe(2999);
    expect(g.savings).toBe(1299);
    expect(g.progress.next).toBe('Add 1 more to complete another set of 2 for ₹2,999');
  });

  test('C7 a product outside the buy pool never fills a slot', () => {
    const g = engine.priceGroup(ctx('pick_any', { pick: 2, price: 2999 }, [prod('l', 2299), prod('x', 1999)], ['l']),
      [{ product_id: 'l' }, { product_id: 'x' }]);
    expect(g.paid_total).toBe(2299 + 1999);
    expect(g.progress.text).toBe('1 of 2 picked');
  });

  test('C8 fixed: only the whole set, ₹4,999 for ₹6,297; a missing item blocks checkout', () => {
    const c = ctx('fixed', { price: 4999, quantities: {} }, [prod('sa', 3999), prod('bl', 1299), prod('po', 999)], ['sa', 'bl', 'po']);
    const whole = engine.priceGroup(c, [{ product_id: 'sa' }, { product_id: 'bl' }, { product_id: 'po' }]);
    expect(whole.paid_total).toBe(4999);
    expect(whole.buyable).toBe(true);
    const part = engine.priceGroup(c, [{ product_id: 'sa' }, { product_id: 'po' }]);
    expect(part.buyable).toBe(false);
    expect(part.problems.map((p) => p.code)).toContain('incomplete_set');
  });

  test('C9 BOGO: the free one costs ₹0; a free one without a paid one, or past the max, blocks', () => {
    const c = ctx('bogo', { max_free: 1 }, [prod('j', 2299)], ['j']);
    const pair = engine.priceGroup(c, [{ product_id: 'j', size: null }, { product_id: 'j', role: 'free', colour: 'x' }]);
    expect(pair.paid_total).toBe(2299);
    expect(pair.lines.find((l) => l.role === 'free').paid_total).toBe(0);
    expect(pair.buyable).toBe(true);
    const lonely = engine.priceGroup(c, [{ product_id: 'j', role: 'free' }]);
    expect(lonely.buyable).toBe(false);
  });

  test('C10 free gift: locked at ₹2,999, unlocked at ₹3,250; one gift is added by itself; gifts carry no money', () => {
    const gifts = new Map([['g:coin', { key: 'g:coin', pool_item_id: 'pi', kind: 'gift_item', id: 'coin', name: 'Silver coin', value: 650, left: 5 }]]);
    const c = (p3) => ctx('spend', { min_spend: 3000, gift_count: 1 }, [prod('d', 1650), prod('b', 800), prod('l', p3)], ['d', 'b', 'l'], gifts);
    const lo = engine.priceGroup(c(549), [{ product_id: 'd' }, { product_id: 'b' }, { product_id: 'l' }]);
    expect(lo.gift.state).toBe('locked');
    expect(lo.progress.text).toMatch(/spend ₹1 more to unlock your gift/);
    const ok = engine.priceGroup(c(800), [{ product_id: 'd' }, { product_id: 'b' }, { product_id: 'l' }]);
    const gift = ok.lines.find((l) => l.role === 'gift');
    expect(gift.auto).toBe(true);
    expect([gift.paid_total, gift.commission, gift.platform_fee, gift.brand_net]).toEqual([0, 0, 0, 0]);
    expect(ok.paid_total).toBe(3250);
    const two = engine.priceGroup(c(800), [{ product_id: 'd' }, { product_id: 'b' }, { product_id: 'l' }, { gift_item_id: 'coin', role: 'gift', qty: 2 }]);
    expect(two.buyable).toBe(false);
  });

  test('C11 shared prices add up exactly: "2 for ₹2,999" on ₹2,000 + ₹1,500 → ₹1,714 + ₹1,285', () => {
    const g = engine.priceGroup(ctx('pick_any', { pick: 2, price: 2999 }, [prod('x', 2000), prod('y', 1500)], ['x', 'y']), [{ product_id: 'x' }, { product_id: 'y' }]);
    expect(g.lines.map((l) => l.paid_total)).toEqual([1714, 1285]);
  });

  test('6.13 the three shares: ₹1,000 at 10% and 5% → ₹100 / ₹50 / ₹850, always adding up to the paisa', () => {
    expect(engine.splitPaid(100000, 10, 5)).toEqual({ commission: 10000, platform_fee: 5000, brand_net: 85000 });
    for (const paise of [171400, 128500, 79900, 1, 99999]) {
      const s = engine.splitPaid(paise, 12.5, 7);
      expect(s.commission + s.platform_fee + s.brand_net).toBe(paise);
    }
    const g = engine.priceGroup(ctx('pick_any', { pick: 2, price: 2999 }, [prod('x', 2000), prod('y', 1500)], ['x', 'y']), [{ product_id: 'x' }, { product_id: 'y' }]);
    for (const l of g.lines) expect(Math.round((l.commission + l.platform_fee + l.brand_net) * 100)).toBe(Math.round(l.paid_total * 100));
  });

  test('C12 a post that is not live: every line "No longer available with this offer"', () => {
    const c = { ...ctx('percentage', { pct: 20 }, [prod('a', 1200)], ['a']), live: false };
    const g = engine.priceGroup(c, [{ product_id: 'a' }]);
    expect(g.buyable).toBe(false);
    expect(g.problems[0].text).toBe('No longer available with this offer');
  });

  test('C13 a product of the post outside the deal pays its normal price', () => {
    const g = engine.priceGroup(ctx('percentage', { pct: 20 }, [prod('a', 1200), prod('z', 500)], ['a']), [{ product_id: 'z' }]);
    expect(g.paid_total).toBe(500);
  });
});

/* ═══════════════════════════════════════════ 2 · deal page, bag, addresses (C14–C18) */

describe('the deal page, the bag, addresses (C14–C18)', () => {
  beforeAll(fresh);

  test('C14 the deal page: every product with colours, sizes and stock; gifts with what is left; guests allowed', async () => {
    const w = await world({ kind: 'spend', prices: [1650, 800, 800], stock: 2, giftStock: 2 });
    const r = await request(app).get(`/v1/follower/posts/${w.post}/deal`).set('x-device-id', 'dev-1');
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.deal_page).toBe(true);
    expect(d.offer.sub_type).toBe('spend');
    expect(d.products).toHaveLength(3);
    expect(d.products[0].colours.map((c) => c.colour)).toEqual(['Blue', 'Black']);
    expect(d.products[0].colours[0].sizes[0]).toMatchObject({ size: '30', left: 2, sold_out: false });
    expect(d.gifts[0]).toMatchObject({ kind: 'gift_item', worth: 650, left: 2, all_given: false });
    expect(JSON.stringify(d)).not.toMatch(/follower_id|buyer/);
    // The sticky bar prices through the same engine.
    const bar = await request(app).post(`/v1/follower/posts/${w.post}/deal/price`)
      .send({ lines: [{ product_id: w.ids[0], colour: 'Blue', size: '32' }, { product_id: w.ids[1], colour: 'Blue', size: '32' }] });
    expect(bar.status).toBe(200);
    expect(bar.body.data.groups[0].progress.text).toBe('₹2,450 of ₹3,000 · spend ₹550 more to unlock your gift');
  });

  test('C15 the bag is replaced whole; same item merges; more than 5 is refused', async () => {
    const w = await world();
    const sh = await shopper();
    const put = await api.put('/follower/bag', sh.token, { lines: [line(w, 0, { qty: 2 }), line(w, 0, { qty: 2 }), line(w, 1)] });
    expect(put.status).toBe(200);
    expect(put.body.data.lines.map((l) => l.qty)).toEqual([4, 1]);
    expect(put.body.data.priced.groups[0].paid_total).toBe(4 * 1839 + 1599);        // 20% off each, to the rupee
    expect((await api.put('/follower/bag', sh.token, { lines: [line(w, 0, { qty: 6 })] })).status).toBe(400);
    const got = await api.get('/follower/bag', sh.token);
    expect(got.body.data.lines).toHaveLength(2);
  });

  test('C16 a changed price is shown with the old one; a sold-out size cannot go on', async () => {
    const w = await world({ stock: 1 });
    const r = await request(app).post('/v1/follower/bag/price').send({ lines: [
      line(w, 0, { colour: 'Blue', size: '32', price_seen: 2000 }),
      line(w, 1, { colour: 'Blue', size: '32', qty: 2 }),
    ] });
    const [a, b] = r.body.data.groups[0].lines;
    expect(a.notes[0].text).toBe('Price changed from ₹2,000');
    expect(b.problems[0].code).toBe('sold_out');
    expect(r.body.data.buyable).toBe(false);
  });

  test('C17 a guest bag joins her account at sign-in without duplicates', async () => {
    const w = await world();
    const sh = await shopper();
    await api.put('/follower/bag', sh.token, { lines: [line(w, 0)] });
    const m = await api.post('/follower/bag/merge', sh.token, { lines: [line(w, 0), line(w, 2)] });
    expect(m.body.data.lines.map((l) => [l.product_id, l.qty])).toEqual([[w.ids[0], 2], [w.ids[2], 1]]);
  });

  test('C18 addresses: by hand, validated, up to 10; editing keeps every field', async () => {
    const sh = await shopper();
    expect((await api.post('/follower/addresses', sh.token, { ...ADDRESS, receiver_phone: '12345' })).status).toBe(422);
    expect((await api.post('/follower/addresses', sh.token, { ...ADDRESS, pincode: '5000' })).status).toBe(422);
    const first = await api.post('/follower/addresses', sh.token, ADDRESS);
    expect(first.status).toBe(201);
    expect(first.body.data.address).toMatchObject({ is_default: true, house: ADDRESS.house, area: ADDRESS.area, state: 'Telangana', receiver_phone: '9876543210' });
    const ed = await api.patch(`/follower/addresses/${first.body.data.address.id}`, sh.token, { landmark: 'Opp. temple', receiver_name: 'Anu' });
    expect(ed.body.data.address).toMatchObject({ landmark: 'Opp. temple', receiver_name: 'Anu', house: ADDRESS.house });
    for (let i = 0; i < 9; i++) expect((await api.post('/follower/addresses', sh.token, ADDRESS)).status).toBe(201);
    const eleventh = await api.post('/follower/addresses', sh.token, ADDRESS);
    expect(eleventh.status).toBe(422);
    expect(eleventh.body.error.message).toMatch(/up to 10/);
  });
});

/* ═══════════════════════════════════════════ 3 · checkout, money, stock (C19–C27) */

describe('checkout, the money split, stock (C19–C27)', () => {
  beforeAll(fresh);

  test('C19 review: parcels per brand, price details, COD allowed at ₹5,000 and refused above', async () => {
    const w = await world({ prices: [2299, 1999, 1799] });
    const sh = await shopper();
    const addr = await addressOf(sh);
    const r = await review(sh, addr, [line(w, 0), line(w, 1)], 'online');
    expect(r.status).toBe(200);
    expect(r.body.data.parcels).toHaveLength(1);
    expect(r.body.data.items_normal).toBe(4298);
    expect(r.body.data.total).toBe(1839 + 1599);
    expect(r.body.data.payment.cod.allowed).toBe(true);
    const big = await review(sh, addr, [line(w, 0, { qty: 3 }), line(w, 1)], 'online');
    expect(big.body.data.payment.cod).toMatchObject({ allowed: false, reason: 'Not available above ₹5,000' });
  });

  test('C20 a stale total: 409 with the new review, nothing taken', async () => {
    const w = await world({ stock: 3 });
    const sh = await shopper();
    const addr = await addressOf(sh);
    const r = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines: [line(w, 0, { colour: 'Blue', size: '32' })], payment_method: 'cod', expected_total: 1 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('PRICE_CHANGED');
    expect(r.body.error.details.total).toBe(1839);
    expect((await query(`SELECT count(*)::int n FROM checkouts`)).rows[0].n).toBe(0);
    const { rows: [p] } = await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [w.ids[0]]);
    expect(p.variants_json.colors[0].sizes[1].stock).toBe(3);
  });

  test('C21–C23 cash on delivery writes parcel, money row, lines; the split per item; stock goes down', async () => {
    const w = await world({ kind: 'pick_any', prices: [2000, 1500, 1900], stock: 3 });
    const sh = await shopper();
    const addr = await addressOf(sh);
    const pendingBefore = Number((await query(`SELECT pending_balance FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0].pending_balance);
    const r = await placeCod(sh, addr, [line(w, 0, { colour: 'Blue', size: '32' }), line(w, 1, { colour: 'Black', size: '30' })]);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'placed', total: 2999, payment_method: 'cod' });
    const { rows: [co] } = await query(`SELECT * FROM checkouts WHERE id = $1`, [r.body.data.checkout_id]);
    const { rows: parcels } = await query(`SELECT * FROM follower_orders WHERE checkout_id = $1`, [co.id]);
    const { rows: txs } = await query(`SELECT * FROM follower_transactions WHERE checkout_id = $1`, [co.id]);
    const { rows: lines } = await query(`SELECT * FROM order_lines WHERE checkout_id = $1 ORDER BY paid_total DESC`, [co.id]);
    expect(parcels).toHaveLength(1);
    expect(parcels[0]).toMatchObject({ payment_method: 'cod', order_status: 'confirmed', brand_id: w.brandId });
    expect(parcels[0].address_snapshot).toMatchObject({ name: 'Anusha K', pincode: '500034' });
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ campaign_influencer_id: w.ciId, via_post_id: w.post, brand_offer_id: w.deal, order_id: parcels[0].id });
    expect(lines.map((l) => money(l.paid_total))).toEqual([1714, 1285]);
    const fee = money(lines[0].fee_pct);
    for (const l of lines) {
      expect(money(l.commission_pct)).toBe(10);
      expect(money(l.commission)).toBe(Math.round(money(l.paid_total) * 10) / 100);
      expect(money(l.platform_fee)).toBe(Math.round(money(l.paid_total) * fee) / 100);
      expect(Math.round((money(l.commission) + money(l.platform_fee) + money(l.brand_net)) * 100)).toBe(Math.round(money(l.paid_total) * 100));
    }
    // One truth: lines = transaction = checkout.
    const sum = (k) => Math.round(lines.reduce((s, l) => s + money(l[k]), 0) * 100) / 100;
    expect(money(txs[0].net_amount)).toBe(2999);
    expect(money(txs[0].influencer_commission)).toBe(sum('commission'));
    expect(money(txs[0].marketplace_fee_amount)).toBe(sum('platform_fee'));
    expect(money(txs[0].brand_net)).toBe(sum('brand_net'));
    expect(money(co.total)).toBe(2999);
    // C22 the creator's pending earnings, once, with its ledger row.
    const pendingAfter = Number((await query(`SELECT pending_balance FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0].pending_balance);
    expect(Math.round((pendingAfter - pendingBefore) * 100) / 100).toBe(sum('commission'));
    expect((await query(`SELECT count(*)::int n FROM influencer_ledger WHERE source_ref_id = $1 AND type = 'sale_commission_pending'`, [txs[0].id])).rows[0].n).toBe(1);
    // C23 stock went down for that colour and size only.
    const { rows: [p0] } = await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [w.ids[0]]);
    expect(p0.variants_json.colors[0].sizes.map((s) => s.stock)).toEqual([3, 2, 3]);
    // The bag no longer holds what she ordered.
    expect((await query(`SELECT count(*)::int n FROM follower_bag_items WHERE follower_id = $1`, [sh.followerId])).rows[0].n).toBe(0);
    // Notifications: the brand and the creator (never who bought).
    const brandN = await H.notices(w.b.userId, 'brand_new_order');
    expect(brandN).toHaveLength(1);
    const { rows: [cu] } = await query(`SELECT user_id FROM influencers WHERE id = $1`, [w.cr.influencerId]);
    const cn = await H.notices(cu.user_id, 'creator_post_sale');
    expect(cn).toHaveLength(1);
    expect(JSON.stringify(cn)).not.toMatch(/Anusha/);
  });

  test('C23 two shoppers race for the last unit: one wins, the other gets sold out and nothing is written', async () => {
    const w = await world({ stock: 1 });
    const a = await shopper(); const b = await shopper();
    const aa = await addressOf(a); const ba = await addressOf(b);
    const l = [line(w, 0, { colour: 'Blue', size: '30' })];
    const [ra, rb] = await Promise.all([placeCod(a, aa, l), placeCod(b, ba, l)]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = ra.status === 409 ? ra : rb;
    expect(loser.body.error.code).toBe('STOCK_UNAVAILABLE');
    expect((await query(`SELECT count(*)::int n FROM checkouts`)).rows[0].n).toBeGreaterThanOrEqual(1);
    const { rows: [p] } = await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [w.ids[0]]);
    expect(p.variants_json.colors[0].sizes[0].stock).toBe(0);
  });

  test('C24 gifts: given counts and stock go down; the last gift takes the post out of the shop', async () => {
    const w = await world({ kind: 'spend', prices: [1650, 800, 800], giftStock: 1 });
    const sh = await shopper();
    const addr = await addressOf(sh);
    const r = await placeCod(sh, addr, [line(w, 0), line(w, 1), line(w, 2)]);
    expect(r.status).toBe(200);
    const { rows: [gl] } = await query(`SELECT * FROM order_lines WHERE checkout_id = $1 AND role = 'gift'`, [r.body.data.checkout_id]);
    expect(gl).toMatchObject({ gift_item_id: w.gifts[0], paid_total: '0.00', commission: '0.00' });
    expect((await query(`SELECT stock FROM gift_items WHERE id = $1`, [w.gifts[0]])).rows[0].stock).toBe(0);
    expect((await query(`SELECT gifts_given FROM offer_pool_items WHERE offer_id = $1 AND pool = 'gift'`, [w.deal])).rows[0].gifts_given).toBe(1);
    expect((await request(app).get(`/v1/follower/posts/${w.post}`)).status).toBe(404);
  });

  test('C25 online: pending with stock held; bad signature refused; verify writes once; the webhook writes the same once', async () => {
    const w = await world({ stock: 2 });
    const sh = await shopper();
    const addr = await addressOf(sh);
    const lines = [line(w, 0, { colour: 'Blue', size: '30' })];
    const rv = await review(sh, addr, lines, 'online');
    const p = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines, payment_method: 'online', expected_total: rv.body.data.total });
    expect(p.status).toBe(200);
    expect(p.body.data.status).toBe('pending');
    expect(p.body.data.razorpay.order_id).toMatch(/^order_mock_/);
    const { rows: [held] } = await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [w.ids[0]]);
    expect(held.variants_json.colors[0].sizes[0].stock).toBe(1);
    expect((await query(`SELECT count(*)::int n FROM follower_orders WHERE checkout_id = $1`, [p.body.data.checkout_id])).rows[0].n).toBe(0);
    const v1 = await api.post('/follower/checkout/verify', sh.token, { razorpay_order_id: p.body.data.razorpay.order_id, razorpay_payment_id: 'pay_test_1', razorpay_signature: 'x' });
    expect(v1.body.data.status).toBe('placed');
    const v2 = await api.post('/follower/checkout/verify', sh.token, { razorpay_order_id: p.body.data.razorpay.order_id, razorpay_payment_id: 'pay_test_1', razorpay_signature: 'x' });
    expect(v2.body.data).toMatchObject({ status: 'placed', already: true });
    await checkoutSvc.paymentArrived({ razorpayOrderId: p.body.data.razorpay.order_id, paymentId: 'pay_test_1' });
    expect((await query(`SELECT count(*)::int n FROM follower_orders WHERE checkout_id = $1`, [p.body.data.checkout_id])).rows[0].n).toBe(1);
    expect((await query(`SELECT razorpay_payment_id FROM follower_transactions WHERE checkout_id = $1`, [p.body.data.checkout_id])).rows[0].razorpay_payment_id).toBe('pay_test_1');
  });

  test('C26 the hold ends after 15 minutes: stock back; a late payment with stock gone is refunded', async () => {
    const w = await world({ stock: 1 });
    const sh = await shopper();
    const addr = await addressOf(sh);
    const lines = [line(w, 0, { colour: 'Blue', size: '30' })];
    const rv = await review(sh, addr, lines, 'online');
    const p = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines, payment_method: 'online', expected_total: rv.body.data.total });
    await query(`UPDATE checkouts SET expires_at = now() - interval '1 minute' WHERE id = $1`, [p.body.data.checkout_id]);
    expect((await checkoutSvc.expireHolds()).expired).toBe(1);
    expect((await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [w.ids[0]])).rows[0].variants_json.colors[0].sizes[0].stock).toBe(1);
    // Someone else buys the last one; then the first payment arrives late.
    const other = await shopper();
    expect((await placeCod(other, await addressOf(other), lines)).status).toBe(200);
    const late = await checkoutSvc.paymentArrived({ razorpayOrderId: p.body.data.razorpay.order_id, paymentId: 'pay_late' });
    expect(late.status).toBe('refunded');
    const { rows: [co] } = await query(`SELECT status, refund_id FROM checkouts WHERE id = $1`, [p.body.data.checkout_id]);
    expect(co.status).toBe('refunded');
    expect(co.refund_id).toMatch(/^rfnd_mock_/);
  });

  test('C27 the channel of her last tap on the creator\'s link is recorded per post', async () => {
    const w = await world();
    const sh = await shopper();
    const addr = await addressOf(sh);
    await query(`INSERT INTO link_visits (device_id, influencer_id, post_id, kind, channel, visited_at, counts_until)
                 VALUES ('dev-ch', $1, $2, 'post', 'instagram', now() - interval '1 hour', now() + interval '29 days')`, [w.cr.influencerId, w.post]).catch(() => null);
    const lines = [line(w, 0)];
    const rv = await review(sh, addr, lines, 'cod');
    const r = await request(app).post('/v1/follower/checkout/place').set('Authorization', `Bearer ${sh.token}`).set('x-device-id', 'dev-ch')
      .send({ address_id: addr, lines, payment_method: 'cod', expected_total: rv.body.data.total });
    expect(r.status).toBe(200);
    const { rows: [tx] } = await query(`SELECT link_channel, via_post_id FROM follower_transactions WHERE checkout_id = $1`, [r.body.data.checkout_id]);
    expect(tx.via_post_id).toBe(w.post);
    const visits = (await query(`SELECT count(*)::int n FROM link_visits WHERE device_id = 'dev-ch'`)).rows[0].n;
    if (visits) expect(tx.link_channel).toBe('instagram');
  });
});

/* ═══════════════════════════════════════════ 4 · orders, cancelling, the brand, the jobs (C28–C35) */

describe('orders, cancelling, the brand, the money jobs (C28–C35)', () => {
  beforeAll(fresh);

  async function placed(kind = 'pick_any', lines = null, { method = 'cod', prices } = {}) {
    const w = await world({ kind, prices: prices || [2000, 1500, 1900], stock: 5 });
    const sh = await shopper();
    const addr = await addressOf(sh);
    const ls = lines ? lines(w) : [line(w, 0, { colour: 'Blue', size: '32' }), line(w, 1, { colour: 'Blue', size: '32' })];
    let checkoutId;
    if (method === 'cod') {
      const r = await placeCod(sh, addr, ls);
      if (r.status !== 200) throw new Error(JSON.stringify(r.body));
      checkoutId = r.body.data.checkout_id;
    } else {
      const rv = await review(sh, addr, ls, 'online');
      const p = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines: ls, payment_method: 'online', expected_total: rv.body.data.total });
      await api.post('/follower/checkout/verify', sh.token, { razorpay_order_id: p.body.data.razorpay.order_id, razorpay_payment_id: `pay_${seq}`, razorpay_signature: 'x' });
      checkoutId = p.body.data.checkout_id;
    }
    const { rows: lines2 } = await query(`SELECT * FROM order_lines WHERE checkout_id = $1 ORDER BY paid_total DESC`, [checkoutId]);
    const { rows: [order] } = await query(`SELECT * FROM follower_orders WHERE checkout_id = $1`, [checkoutId]);
    return { w, sh, lines: lines2, order, checkoutId };
  }

  test('C35 my orders: newest first, filters, and the detail with timeline, address, post', async () => {
    const { sh, lines } = await placed();
    const list = await api.get('/follower/orders', sh.token);
    expect(list.body.data.items).toHaveLength(2);
    expect(list.body.data.items[0]).toMatchObject({ status: 'confirmed', status_word: 'Confirmed', can_cancel: true, payment_method: 'cod' });
    expect((await api.get('/follower/orders?status=delivered', sh.token)).body.data.items).toHaveLength(0);
    const d = await api.get(`/follower/orders/lines/${lines[0].id}`, sh.token);
    expect(d.body.data.address).toMatchObject({ pincode: '500034' });
    expect(d.body.data.post.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(d.body.data.deal_items).toHaveLength(1);
    expect(d.body.data.timeline[0].status).toBe('confirmed');
  });

  test('C28 cancelling needs a reason and closes once Shipped', async () => {
    const { w, sh, lines, order } = await placed();
    expect((await api.post(`/follower/orders/lines/${lines[0].id}/cancel`, sh.token, {})).status).toBe(400);
    await api.patch(`/brands/me/orders/${order.id}/status`, w.b.token, { status: 'packed' });
    await api.patch(`/brands/me/orders/${order.id}/status`, w.b.token, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DL123' });
    const r = await api.post(`/follower/orders/lines/${lines[0].id}/cancel`, sh.token, { reason: 'Not needed any more' });
    expect(r.status).toBe(409);
  });

  test('C29–C31 a bundle item cancels its set; stock back; the money undone exactly; online refunded', async () => {
    const { w, sh, lines, order, checkoutId } = await placed('pick_any', null, { method: 'online' });
    const before = Number((await query(`SELECT pending_balance FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0].pending_balance);
    const pv = await api.get(`/follower/orders/lines/${lines[1].id}/cancel`, sh.token);
    expect(pv.body.data.lines).toHaveLength(2);
    expect(pv.body.data.warning).toMatch(/Cancelling cancels 2 items together/);
    expect(pv.body.data.refund.amount).toBe(2999);
    const r = await api.post(`/follower/orders/lines/${lines[1].id}/cancel`, sh.token, { reason: 'Ordered by mistake' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ parcel_cancelled: true, refund: { amount: 2999, status: 'issued' } });
    const { rows: after } = await query(`SELECT status, refund_status, refund_id FROM order_lines WHERE checkout_id = $1`, [checkoutId]);
    expect(after.every((l) => l.status === 'cancelled' && l.refund_status === 'issued' && /^rfnd_mock_/.test(l.refund_id))).toBe(true);
    const { rows: [tx] } = await query(`SELECT * FROM follower_transactions WHERE checkout_id = $1`, [checkoutId]);
    expect(money(tx.commission_reversed)).toBe(money(tx.influencer_commission));
    expect(money(tx.brand_net_reversed)).toBe(money(tx.brand_net));
    expect(money(tx.platform_fee_reversed)).toBe(money(tx.marketplace_fee_amount));
    expect(tx).toMatchObject({ status: 'refunded', brand_settlement_status: 'reversed' });
    expect((await query(`SELECT order_status FROM follower_orders WHERE id = $1`, [order.id])).rows[0].order_status).toBe('cancelled');
    const pending = Number((await query(`SELECT pending_balance FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0].pending_balance);
    expect(Math.round((before - pending) * 100) / 100).toBe(money(tx.influencer_commission));
    expect((await query(`SELECT count(*)::int n FROM influencer_ledger WHERE type = 'cancel_clawback' AND influencer_id = $1`, [w.cr.influencerId])).rows[0].n).toBe(1);
    const { rows: [p] } = await query(`SELECT variants_json FROM brand_products WHERE id = $1`, [w.ids[0]]);
    expect(p.variants_json.colors[0].sizes[1].stock).toBe(5);
  });

  test('C29 a free gift follows: cancelling below the threshold cancels the gift; COD has nothing to refund', async () => {
    const { sh, lines } = await placed('spend', (w) => [0, 1, 2].map((i) => line(w, i, { colour: 'Blue', size: '32' })), { prices: [1650, 800, 800] });
    const buy = lines.find((l) => Number(l.paid_total) === 800);
    const r = await api.post(`/follower/orders/lines/${buy.id}/cancel`, sh.token, { reason: 'Other', note: 'Changed my mind' });
    expect(r.status).toBe(200);
    expect(r.body.data.cancelled).toHaveLength(2);                                  // the item and the gift
    expect(r.body.data.refund).toMatchObject({ amount: 0, status: 'not_needed' });
    const gift = (await query(`SELECT status FROM order_lines WHERE id = $1`, [lines.find((l) => l.role === 'gift').id])).rows[0];
    expect(gift.status).toBe('cancelled');
  });

  test('C32 the money jobs on the new rows: a partial cancel pays the creator and the brand only what was kept', async () => {
    const { w, sh, lines, checkoutId } = await placed('discount', (w) => [line(w, 0, { colour: 'Blue', size: '32' }), line(w, 1, { colour: 'Blue', size: '32' })], { method: 'online' });
    await api.post(`/follower/orders/lines/${lines[1].id}/cancel`, sh.token, { reason: 'Found a better price' });
    const { rows: [tx] } = await query(`SELECT * FROM follower_transactions WHERE checkout_id = $1`, [checkoutId]);
    const kept = lines[0];
    await query(`UPDATE follower_transactions SET return_window_ends_at = now() - interval '1 minute' WHERE id = $1`, [tx.id]);
    // Item 17 (pre-deploy review): a sale's shares are added only once its parcel has shipped — while
    // it is Confirmed/Packed it can still be cancelled and refunded in full.
    for (const body of [{ status: 'packed' }, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DL32' }]) {
      expect((await api.patch(`/brands/me/orders/${tx.order_id}/status`, w.b.token, body)).status).toBe(200);
    }
    const wallet0 = Number((await query(`SELECT wallet_balance FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0].wallet_balance);
    await commissionConfirm.run();
    const wallet1 = Number((await query(`SELECT wallet_balance FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0].wallet_balance);
    expect(Math.round((wallet1 - wallet0) * 100) / 100).toBe(money(kept.commission));
    // ASSERTION DRIFT — item 17 (rules v1.31 §17A, W2–W3; 1 Oct 2026): the brand's kept share is added
    // to its WALLET, not transferred to a bank. Same amount, same rule about what was kept.
    const brand0 = Number((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [w.brandId])).rows[0].wallet_balance);
    const s = await settlement.settleCommerceTransaction(require('../src/config/db'), tx.id);
    expect(s.credited).toBe(money(kept.brand_net) - s.tcs);
    expect(s.transfer_id).toBeNull();
    const brand1 = Number((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [w.brandId])).rows[0].wallet_balance);
    expect(Math.round((brand1 - brand0) * 100) / 100).toBe(money(kept.brand_net) - s.tcs);
  });

  // ASSERTION DRIFT — item 17 (rules v1.31 §17A, W4; founder, 1 Oct 2026). This test asserted that a
  // cash order left the brand OWING INFLX the commission and the fee (a brand_dues row taken off its
  // next online payout). The rule changed: INFLX collects the cash through the delivery partner, so a
  // DELIVERED cash order settles exactly like an online one — the brand's share is added to its
  // wallet, it owes nothing, and an undelivered cash order adds nothing. Same scenario, new rule.
  test('6.13 cash on delivery: once delivered it settles like an online order; the brand owes INFLX nothing', async () => {
    const cod = await placed('discount', (w) => [line(w, 0, { colour: 'Blue', size: '32' })]);
    const { rows: [ctx] } = await query(`SELECT * FROM follower_transactions WHERE checkout_id = $1`, [cod.checkoutId]);
    await query(`UPDATE follower_transactions SET return_window_ends_at = now() - interval '1 minute' WHERE id = $1`, [ctx.id]);
    const dbm = require('../src/config/db');
    const walletOf = async () => Number((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [cod.w.brandId])).rows[0].wallet_balance);
    const commerceSettlement = require('../src/jobs/commerce-settlement.job');
    const w0 = await walletOf();
    await commerceSettlement.run();                                                   // not delivered yet: nothing is added
    expect(await walletOf()).toBe(w0);
    const { rows: [parcel] } = await query(`SELECT id FROM follower_orders WHERE checkout_id = $1`, [cod.checkoutId]);
    for (const body of [{ status: 'packed' }, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DL613' }, { status: 'delivered' }]) {
      expect((await api.patch(`/brands/me/orders/${parcel.id}/status`, cod.w.b.token, body)).status).toBe(200);
    }
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '40 days' WHERE id = $1`, [parcel.id]);
    await query(`UPDATE follower_transactions SET created_at = now() - interval '31 days' WHERE id = $1`, [ctx.id]);
    const run = await commerceSettlement.run();
    expect(run.settled).toBe(1);
    expect(Math.round((await walletOf() - w0) * 100) / 100).toBe(money(cod.lines[0].brand_net));
    expect((await query(`SELECT count(*)::int AS n FROM brand_dues WHERE brand_id = $1`, [cod.w.brandId])).rows[0].n).toBe(0);
    const w1 = await walletOf();
    // The same brand's next online sale settles in full: nothing is taken off it.
    const sh = await shopper();
    const addr = await addressOf(sh);
    const ls = [line(cod.w, 1, { colour: 'Blue', size: '32' })];
    const rv = await review(sh, addr, ls, 'online');
    const p = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines: ls, payment_method: 'online', expected_total: rv.body.data.total });
    await api.post('/follower/checkout/verify', sh.token, { razorpay_order_id: p.body.data.razorpay.order_id, razorpay_payment_id: 'pay_after_cod', razorpay_signature: 'x' });
    const { rows: [tx2] } = await query(`SELECT * FROM follower_transactions WHERE checkout_id = $1`, [p.body.data.checkout_id]);
    expect(await settlement.settleCommerceTransaction(dbm, tx2.id)).toEqual({ skipped: 'not_shipped' });
    // Item 17 (pre-deploy review): a sale's shares are added only once its parcel has shipped — while
    // it is Confirmed/Packed it can still be cancelled and refunded in full.
    for (const body of [{ status: 'packed' }, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DL32' }]) {
      expect((await api.patch(`/brands/me/orders/${tx2.order_id}/status`, cod.w.b.token, body)).status).toBe(200);
    }
    const s2 = await settlement.settleCommerceTransaction(dbm, tx2.id);
    expect(s2.credited).toBe(Math.round((money(tx2.brand_net) - s2.tcs) * 100) / 100);
    expect(Math.round((await walletOf() - w1) * 100) / 100).toBe(s2.credited);
  });

  test('C33 the brand cancels an item with a reason; the shopper is told', async () => {
    const { w, sh, lines } = await placed('discount', (w) => [line(w, 0, { colour: 'Blue', size: '32' })]);
    const r = await api.post(`/brands/me/orders/lines/${lines[0].id}/cancel`, w.b.token, { reason: 'Out of stock' });
    expect(r.status).toBe(200);
    expect((await query(`SELECT cancelled_by FROM order_lines WHERE id = $1`, [lines[0].id])).rows[0].cancelled_by).toBe('brand');
    const n = await H.notices(sh.userId, 'order_cancelled');
    expect(n[0].body).toMatch(/cancelled by the store/);
  });

  test('C34 status moves forward only; Shipped needs courier and tracking; another brand cannot touch it', async () => {
    const { w, order } = await placed('discount', (w) => [line(w, 0, { colour: 'Blue', size: '32' })]);
    expect((await api.patch(`/brands/me/orders/${order.id}/status`, w.b.token, { status: 'delivered' })).status).toBe(409);
    expect((await api.patch(`/brands/me/orders/${order.id}/status`, w.b.token, { status: 'cancelled' })).status).toBe(400);
    const other = await H.brand();
    expect((await api.patch(`/brands/me/orders/${order.id}/status`, other.token, { status: 'packed' })).status).toBe(404);
    expect((await api.patch(`/brands/me/orders/${order.id}/status`, w.b.token, { status: 'packed' })).status).toBe(200);
    expect((await api.patch(`/brands/me/orders/${order.id}/status`, w.b.token, { status: 'dispatched' })).status).toBe(400);
    const ok = await api.patch(`/brands/me/orders/${order.id}/status`, w.b.token, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DL9' });
    expect(ok.status).toBe(200);
    const parcels = await api.get('/brands/me/parcels', w.b.token);
    const pc = parcels.body.data.parcels[0];
    expect(pc).toMatchObject({ status: 'dispatched', courier: { name: 'Delhivery', tracking: 'DL9' } });
    expect(pc.items[0].money.creator_pct).toBe(10);
    expect(pc.items[0].creator).toBe('Priya Rao');
    expect(Math.round((pc.items[0].money.creator_share + pc.items[0].money.inflx_share + pc.items[0].money.brand_share) * 100)).toBe(Math.round(pc.items[0].money.paid * 100));
  });
});

/* ═══════════════════════════════════════════ 5 · retired (C36) */

describe('the old checkout is retired (C36)', () => {
  beforeAll(fresh);
  test('old routes answer 404 or no longer exist; pay at store stays', async () => {
    const sh = await shopper();
    expect((await api.post('/follower/cart/price', sh.token, {})).status).toBe(404);
    expect((await api.post('/follower/orders/verify', sh.token, {})).status).toBe(404);
    expect((await api.post('/follower/orders', sh.token, {})).status).toBe(404);
    expect((await api.post('/follower/pay-at-store', sh.token, {})).status).not.toBe(404);
  });
});
