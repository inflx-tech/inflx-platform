'use strict';

/**
 * shopper-app-fixes — the server side of the fifteen faults and eight small ones (01-spec.md).
 *
 *   F1   the bag is emptied only when the order is really placed; a cancelled payment releases
 *        what was held at once; a payment that lands after the items have gone is refunded
 *   F6   a product sold out in every size is out of stock, and its own stock number follows its sizes
 *   F10  a size that has its own price says what she pays for that size
 *   F4   a shopper who has never given her name is known as such; her comment reads "INFLX shopper"
 *   F13  Profile: "2 on the way" is everything not yet delivered; then "3 orders"; "1 creator"
 *   F14  a signed-in shopper's hearts show in a collection
 *   F15  an order notification says which order to open
 *   N7   a post with no caption is titled by its products, never by an internal name
 * Real API, real database, real orders placed through a live shoppable post.
 */

const request = require('supertest');
const app = require('../src/app');
const W = require('./helpers/item17');
const W14 = require('./helpers/item14');
const w12 = require('./helpers/item12');
const { latestOtp } = require('./helpers/factories');
const paymentConfig = require('../src/services/paymentConfig.service');

const { api, query } = W;
const ADDRESS = { receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B, Lotus Residency', area: 'Road No. 3, Banjara Hills',
  landmark: 'Near the park', pincode: '500034', city: 'Hyderabad', state: 'Telangana', label: 'Home' };
let seq = 0;

/** A product gets colours and sizes the way the listing form stores them. */
const sized = (id, sizes, stock = null) => query(
  `UPDATE brand_products SET variants_json = $2::jsonb, stock = $3 WHERE id = $1`,
  [id, JSON.stringify({ colors: [{ color: 'Blue', sizes, images: [] }] }), stock]);
const productRow = async (id) => (await query(`SELECT stock, variants_json FROM brand_products WHERE id = $1`, [id])).rows[0];
const sizeStock = async (id, size) => (await productRow(id)).variants_json.colors[0].sizes.find((s) => s.size === size).stock;
const bagOf = async (sh) => (await api.get('/follower/bag', sh.token)).body.data.lines;
const cardOf = async (w, token) => (await api.get(`/follower/posts/${w.post}`, token)).body.data;
const dealOf = async (w) => (await api.get(`/follower/posts/${w.post}/deal`)).body.data;
const feedIds = async () => (await api.post('/follower/feed', undefined, {})).body.data.posts.map((p) => p.id);

/** She puts lines in her bag and goes as far as Place order. Returns the place answer and her address. */
async function toPlace(w, lines, { method = 'online', sh = null } = {}) {
  const who = sh || await W.shopper();
  const a = await api.post('/follower/addresses', who.token, ADDRESS);
  const addr = a.body.data.address.id;
  await api.put('/follower/bag', who.token, { lines });
  const rv = await api.post('/follower/checkout/review', who.token, { address_id: addr, lines, payment_method: method });
  if (rv.status !== 200) throw new Error(`review: ${JSON.stringify(rv.body)}`);
  const p = await api.post('/follower/checkout/place', who.token, { address_id: addr, lines, payment_method: method, expected_total: rv.body.data.total });
  return { sh: who, place: p, addr };
}
const pay = (sh, placed) => { seq += 1; return api.post('/follower/checkout/verify', sh.token, { razorpay_order_id: placed.body.data.razorpay.order_id, razorpay_payment_id: `payfix_${seq}`, razorpay_signature: 'x' }); };

let admin;
beforeAll(async () => {
  admin = await W.fresh();
  W14.resetTree();
  await query(`INSERT INTO payment_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  paymentConfig._resetCache();
  await w12.startServer();
});
afterAll(() => w12.stopServer());

describe('F1 · the bag is emptied only when the order is really placed', () => {
  const L = (w) => [{ post_id: w.post, product_id: w.ids[0], colour: 'Blue', size: 'M', qty: 1 }];

  it('online: Place order holds the item but leaves her bag; cancelling the payment releases it at once; her bag is as it was', async () => {
    const w = await W.saleWorld();
    await sized(w.ids[0], [{ size: 'M', stock: 1 }, { size: 'L', stock: 4 }], 5);
    const { sh, place } = await toPlace(w, L(w));
    expect(place.status).toBe(200);
    expect(place.body.data.status).toBe('pending');
    expect((await bagOf(sh)).length).toBe(1);                                    // nothing is ordered yet
    expect(await sizeStock(w.ids[0], 'M')).toBe(0);                              // held for her payment

    const other = await W.shopper();
    expect((await api.post(`/follower/checkout/${place.body.data.checkout_id}/abandon`, other.token)).status).toBe(404);   // only her own
    const gone = await api.post(`/follower/checkout/${place.body.data.checkout_id}/abandon`, sh.token);
    expect(gone.status).toBe(200);
    expect(gone.body.data).toEqual({ checkout_id: place.body.data.checkout_id, status: 'expired' });
    expect(await sizeStock(w.ids[0], 'M')).toBe(1);                              // back on the shelf, now — not in 15 minutes
    expect((await bagOf(sh)).length).toBe(1);
    const again = await api.post(`/follower/checkout/${place.body.data.checkout_id}/abandon`, sh.token);
    expect(again.body.data.status).toBe('expired');                              // twice changes nothing
    expect(await sizeStock(w.ids[0], 'M')).toBe(1);
    // her own retry is not told "Sold out"
    const retry = await toPlace(w, L(w), { sh });
    expect(retry.place.status).toBe(200);
  });

  it('online, paid: the order is placed and only then does the item leave her bag', async () => {
    const w = await W.saleWorld();
    const lines = [{ post_id: w.post, product_id: w.ids[0], qty: 1 }, { post_id: w.post, product_id: w.ids[1], qty: 1, ticked: false }];
    const { sh, place } = await toPlace(w, [lines[0]]);
    await api.put('/follower/bag', sh.token, { lines });                          // one ticked and ordered, one left unticked
    expect((await bagOf(sh)).length).toBe(2);
    const v = await pay(sh, place);
    expect(v.body.data.status).toBe('placed');
    const left = await bagOf(sh);
    expect(left.map((l) => l.product_id)).toEqual([w.ids[1]]);                    // what she ordered left; the other stays
  });

  it('a payment that still arrives after she cancelled: the item is taken again and the order placed', async () => {
    const w = await W.saleWorld();
    await sized(w.ids[0], [{ size: 'M', stock: 1 }], 1);
    const { sh, place } = await toPlace(w, L(w));
    await api.post(`/follower/checkout/${place.body.data.checkout_id}/abandon`, sh.token);
    const v = await pay(sh, place);
    expect(v.body.data.status).toBe('placed');
    expect(await sizeStock(w.ids[0], 'M')).toBe(0);
    expect((await bagOf(sh)).length).toBe(0);
  });

  it('…and when someone else bought the last one meanwhile: nothing is ordered, she is refunded, her bag stays', async () => {
    const w = await W.saleWorld();
    await sized(w.ids[0], [{ size: 'M', stock: 1 }], 1);
    const { sh, place } = await toPlace(w, L(w));
    await api.post(`/follower/checkout/${place.body.data.checkout_id}/abandon`, sh.token);
    const rival = await toPlace(w, L(w), { method: 'cod' });
    expect(rival.place.body.data.status).toBe('placed');
    const v = await pay(sh, place);
    expect(v.status).toBe(200);
    expect(v.body.data.status).toBe('refunded');
    expect((await query(`SELECT count(*)::int AS n FROM order_lines WHERE checkout_id = $1`, [place.body.data.checkout_id])).rows[0].n).toBe(0);
    expect((await bagOf(sh)).length).toBe(1);
  });

  it('cash on delivery is an order at once: the bag is emptied at Place order, and "abandon" changes nothing', async () => {
    const w = await W.saleWorld();
    const { sh, place } = await toPlace(w, [{ post_id: w.post, product_id: w.ids[0], qty: 1 }], { method: 'cod' });
    expect(place.body.data.status).toBe('placed');
    expect((await bagOf(sh)).length).toBe(0);
    const r = await api.post(`/follower/checkout/${place.body.data.checkout_id}/abandon`, sh.token);
    expect(r.body.data.status).toBe('placed');
    expect((await query(`SELECT count(*)::int AS n FROM order_lines WHERE checkout_id = $1 AND status = 'active'`, [place.body.data.checkout_id])).rows[0].n).toBe(1);
  });
});

describe('F6 · sold out in every size is out of stock', () => {
  it('buying the last one of the last size: the tile says so, the deal page says so, and the product\'s own number follows its sizes', async () => {
    const w = await W.saleWorld();
    await sized(w.ids[0], [{ size: 'M', stock: 0 }, { size: 'L', stock: 1 }], 25);   // its own number was never kept up
    expect((await cardOf(w)).products.find((p) => p.id === w.ids[0]).in_stock).toBe(true);
    const { place } = await toPlace(w, [{ post_id: w.post, product_id: w.ids[0], colour: 'Blue', size: 'L', qty: 1 }], { method: 'cod' });
    expect(place.body.data.status).toBe('placed');
    expect((await productRow(w.ids[0])).stock).toBe(0);                           // 0 + 0, not 25
    expect((await cardOf(w)).products.find((p) => p.id === w.ids[0]).in_stock).toBe(false);
    const d = (await dealOf(w)).products.find((p) => p.id === w.ids[0]);
    expect(d.sold_out).toBe(true);
    expect(d.colours[0].sizes.every((s) => s.sold_out)).toBe(true);
  });

  it('a store that zeroes every size itself: out of stock too, whatever its own number says; a size with no count never blocks', async () => {
    const w = await W.saleWorld();
    await sized(w.ids[0], [{ size: 'M', stock: 0 }, { size: 'L', stock: 0 }], 25);
    expect((await cardOf(w)).products.find((p) => p.id === w.ids[0]).in_stock).toBe(false);
    await sized(w.ids[0], [{ size: 'M', stock: 0 }, { size: 'L', stock: null }], 0);
    expect((await cardOf(w)).products.find((p) => p.id === w.ids[0]).in_stock).toBe(true);
  });

  it('when everything in a post has sold out, the post leaves the shop; a cancel brings it back', async () => {
    const w = await W.saleWorld({ prices: [900] });
    await sized(w.ids[0], [{ size: 'M', stock: 1 }], 1);
    expect(await feedIds()).toContain(w.post);
    const { sh, place } = await toPlace(w, [{ post_id: w.post, product_id: w.ids[0], colour: 'Blue', size: 'M', qty: 1 }], { method: 'cod' });
    expect(await feedIds()).not.toContain(w.post);
    const { rows: [ln] } = await query(`SELECT id FROM order_lines WHERE checkout_id = $1`, [place.body.data.checkout_id]);
    const c = await api.post(`/follower/orders/lines/${ln.id}/cancel`, sh.token, { reason: 'Not needed any more' });
    expect(c.status).toBe(200);
    expect((await productRow(w.ids[0])).stock).toBe(1);
    expect(await feedIds()).toContain(w.post);
  });
});

describe('F10 · a size with its own price', () => {
  it('each size says its price and what she pays after the offer; choosing it raises no "Price changed"', async () => {
    const w = await W.saleWorld();                                                 // 20% off; the product's own price is 2,000
    await sized(w.ids[0], [{ size: 'M', stock: 5 }, { size: 'XL', stock: 5, price: 2400 }], 10);
    const p = (await dealOf(w)).products.find((x) => x.id === w.ids[0]);
    expect(p.colours[0].sizes).toEqual([
      { size: 'M', price: 2000, shopper_price: 1600, left: null, sold_out: false },
      { size: 'XL', price: 2400, shopper_price: 1920, left: null, sold_out: false },
    ]);
    const priced = async (seen) => (await api.post('/follower/bag/price', undefined, { lines: [{ post_id: w.post, product_id: w.ids[0], colour: 'Blue', size: 'XL', qty: 1, price_seen: seen }] })).body.data;
    const ok = await priced(2400);
    expect(ok.groups[0].lines[0]).toMatchObject({ normal_total: 2400, paid_total: 1920, notes: [] });
    const old = await priced(2000);                                                // what the phone used to send
    expect(old.groups[0].lines[0].notes.map((n) => n.code)).toEqual(['price_changed']);
  });
});

describe('F4 · a shopper who has never given her name', () => {
  const signIn = async (phone, name) => {
    await request(app).post('/v1/auth/send-otp').send({ phone });
    const otp = await latestOtp(phone);
    const r = await request(app).post('/v1/auth/verify-otp').send({ phone, otp, role: 'follower', ...(name ? { name } : {}) });
    return r.body.data.access_token;
  };

  it('signing in with no name: the account says a name is needed, her comment reads "INFLX shopper"; once given, it is hers', async () => {
    const w = await W.saleWorld();
    const token = await signIn('+919812300001');
    const me = (await api.get('/followers/me', token)).body.data;
    expect(me.name_needed).toBe(true);
    expect((await api.get('/follower/me/profile', token)).body.data.name_needed).toBe(true);
    expect((await api.post(`/follower/posts/${w.post}/comments`, token, { body: 'Lovely colour' })).status).toBeLessThan(300);
    const first = (await api.get(`/follower/posts/${w.post}/comments`, token)).body.data.comments[0];
    expect(first.author).toMatchObject({ name: 'INFLX shopper', creator: false });

    expect((await api.patch('/followers/me', token, { name: 'Anusha K' })).status).toBe(200);
    expect((await api.get('/followers/me', token)).body.data.name_needed).toBe(false);
    expect((await api.get('/follower/me/profile', token)).body.data).toMatchObject({ name: 'Anusha K', name_needed: false });
    expect((await api.get(`/follower/posts/${w.post}/comments`, token)).body.data.comments[0].author.name).toBe('Anusha K');
  });

  it('a shopper the old app named "Follower" is asked too', async () => {
    const token = await signIn('+919812300002', 'Follower');
    expect((await api.get('/followers/me', token)).body.data.name_needed).toBe(true);
  });
});

describe('F13 · Profile rows', () => {
  it('Orders: "No orders yet" → "1 on the way" while it is packed or shipped → "1 order" once delivered; Following: "1 creator"', async () => {
    const w = await W.saleWorld();
    const fresh = await W.shopper();
    const rows = async (sh) => (await api.get('/follower/me/profile', sh.token)).body.data.rows;
    expect(await rows(fresh)).toMatchObject({ orders: 'No orders yet', following: '0 creators' });

    const o = await W.order(w, [0], { method: 'cod' });
    expect((await rows(o.sh)).orders).toBe('1 on the way');
    await api.patch(`/brands/me/orders/${o.parcel.id}/status`, w.b.token, { status: 'packed' });
    expect((await rows(o.sh)).orders).toBe('1 on the way');                        // it read "No orders yet"
    await W.deliverShipped(w, (await (async () => { await api.patch(`/brands/me/orders/${o.parcel.id}/status`, w.b.token, { status: 'dispatched', courier_name: 'Delhivery', tracking_number: 'DL1' }); return o.parcel.id; })()));
    expect((await rows(o.sh)).orders).toBe('1 order');

    await api.post('/follower/follows', o.sh.token, { influencer_id: w.cr.influencerId });
    expect((await rows(o.sh)).following).toBe('1 creator');
    const list = (await api.get('/follower/following', o.sh.token)).body.data.creators;
    expect(list.map((c) => c.id)).toEqual([w.cr.influencerId]);
    expect(list[0].name).toBeTruthy();
  });
});

describe('F14 · her hearts show in a collection', () => {
  it('a signed-in shopper\'s saved product is marked; a guest\'s are kept on the phone, so none are', async () => {
    const w = await W.saleWorld();
    const c = await api.post('/influencers/me/collections', w.cr.token, { name: 'Denim picks', kind: 'products',
      items: [{ product_id: w.ids[0], campaign_influencer_id: w.ciId }, { product_id: w.ids[1], campaign_influencer_id: w.ciId }] });
    expect(c.status).toBeLessThan(300);
    const id = c.body.data.collection.id;
    const sh = await W.shopper();
    expect((await api.post('/follower/saved/products', sh.token, { product_id: w.ids[1], post_id: w.post })).status).toBeLessThan(300);
    const mine = (await api.get(`/follower/collections/${id}`, sh.token)).body.data.products;
    expect(Object.fromEntries(mine.map((p) => [p.id, p.saved]))).toEqual({ [w.ids[0]]: false, [w.ids[1]]: true });
    const guest = (await api.get(`/follower/collections/${id}`)).body.data.products;
    expect(guest.every((p) => p.saved === false)).toBe(true);
    // un-hearting is by the product alone, so it works even when its post has gone
    expect((await request(app).delete(`/v1/follower/saved/products/${w.ids[1]}`).set('Authorization', `Bearer ${sh.token}`)).status).toBeLessThan(300);
    expect((await api.get(`/follower/collections/${id}`, sh.token)).body.data.products.every((p) => p.saved === false)).toBe(true);
  });
});

describe('F15 · a notification says what to open', () => {
  it('order placed → My orders; shipped, delivered and cancelled → that order', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0, 1]);                                            // paid online
    const mine = async () => (await api.get('/notifications', o.sh.token)).body.data.notifications;
    const placed = (await mine()).find((n) => n.data_json && n.data_json.checkout_id === o.checkoutId);
    expect(placed.data_json).toMatchObject({ screen: 'orders', checkout_id: o.checkoutId });

    await W.ship(w, o.parcel.id);
    const shipped = (await mine()).find((n) => n.type === 'order_dispatched');
    expect(shipped.data_json.screen).toBe('order');
    expect(o.lines.map((l) => l.id)).toContain(shipped.data_json.line_id);

    const w2 = await W.saleWorld();
    const o2 = await W.order(w2, [0], { method: 'cod' });
    await api.post(`/follower/orders/lines/${o2.lines[0].id}/cancel`, o2.sh.token, { reason: 'Not needed any more' });
    const cancelled = (await api.get('/notifications', o2.sh.token)).body.data.notifications.find((n) => n.type === 'order_cancelled');
    expect(cancelled.data_json).toEqual({ screen: 'order', line_id: o2.lines[0].id });
  });
});

describe('N7 · a post with no caption is titled by its products', () => {
  it('the shopper reads the products; the link page does too; the creator\'s own list keeps her title', async () => {
    const w = await W.saleWorld();
    expect((await cardOf(w)).title).toBe('Festive denim');                         // a caption is the title, as before
    await query(`UPDATE creator_posts SET caption = NULL WHERE id = $1`, [w.post]);
    const c = await cardOf(w);
    const first = c.products[0].name;
    expect(c.title).toBe(`${first} and 2 more`);
    expect(c.title).not.toMatch(/Untitled post|Price post|discount \d+/);
    const link = await api.get(`/links/p/${c.code}`);
    expect(link.body.data.post.title).toBe(c.title);
    const hers = (await api.get(`/influencers/me/shoppable-posts/${w.post}`, w.cr.token)).body.data.post;
    expect(hers.title).toMatch(/^discount \d+$/);                                  // her own name for it, unchanged
    await query(`DELETE FROM post_products WHERE post_id = $1 AND product_id <> $2`, [w.post, w.ids[0]]);
    expect((await cardOf(w)).title).toBe((await cardOf(w)).products[0].name);      // one product: just its name
  });
});

// The small faults found on the way (founder, 5 Oct 2026: "fix the small issues").
describe('S3 · what the courier collects for a cash parcel is the parcel\'s amount', () => {
  const detail = async (o, i = 0) => (await api.get(`/follower/orders/lines/${o.lines[i].id}`, o.sh.token)).body.data;

  it('two items: each item\'s page says what the whole parcel collects; with a delivery and a cash fee they are named', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0, 1], { method: 'cod' });
    const sum = o.lines.reduce((s, l) => s + Number(l.paid_total), 0);
    const d = await detail(o);
    expect(d.parcel).toMatchObject({ items: 2, items_total: sum });
    expect(d.parcel.to_pay).toBe(sum + d.parcel.delivery_fee + d.parcel.cod_fee);
    expect(d.parcel.says).toMatch(/^For this parcel you pay ₹[\d,]+ on delivery: 2 items ₹[\d,]+/);

    await query(`UPDATE follower_orders SET delivery_fee = 50, cod_fee = 20 WHERE id = $1`, [o.parcel.id]);
    const f = await detail(o, 1);
    expect(f.parcel).toMatchObject({ items: 2, items_total: sum, delivery_fee: 50, cod_fee: 20, to_pay: sum + 70 });
    expect(f.parcel.says).toBe(`For this parcel you pay ₹${(sum + 70).toLocaleString('en-IN')} on delivery: 2 items ₹${sum.toLocaleString('en-IN')} + delivery ₹50 + cash on delivery fee ₹20.`);
  });

  it('an item cancelled out of the parcel is no longer collected for; once delivered nothing is owed; an online order owes nothing', async () => {
    const w = await W.saleWorld();
    const o = await W.order(w, [0, 1], { method: 'cod' });
    const [gone, kept] = o.lines;
    await api.post(`/follower/orders/lines/${gone.id}/cancel`, o.sh.token, { reason: 'Not needed any more' });
    const d = await detail(o, 1);
    expect(d.parcel).toMatchObject({ items: 1, items_total: Number(kept.paid_total), to_pay: Number(kept.paid_total) + d.parcel.delivery_fee + d.parcel.cod_fee });
    expect((await detail(o, 0)).parcel.says).toBeNull();                          // the cancelled item itself asks for nothing
    await W.deliver(w, o.parcel.id);
    expect((await detail(o, 1)).parcel.says).toBeNull();

    const paid = await W.order(w, [0]);                                            // online
    expect((await detail(paid)).parcel).toMatchObject({ to_pay: 0, says: null });
  });
});
