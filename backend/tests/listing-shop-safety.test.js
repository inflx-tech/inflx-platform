'use strict';

/**
 * listing-shop-safety — four fixes from the audit of 11 Oct 2026 (features/listing-shop-safety).
 *
 *   A   hidden and out of stock are a PAUSE: nothing leaves a creator's post, the shop simply does
 *       not show what cannot be sold, and Show / restock brings it back. Remove is the permanent
 *       one: it works on a hidden product too, and is refused for a piece of a running set.
 *   B   saving the Edit product form keeps what sold while the form was open
 *   C   Place order makes one order per attempt, however often it is sent
 *   D   a set's post is in the shop only while every piece can be bought
 * Real API, real database, live shoppable posts.
 */

const D = require('./helpers/dealWorld');
const paymentConfig = require('../src/services/paymentConfig.service');
const { MSG } = require('../src/services/postsCopy');

const { api, query, line } = D;
const PP = '/influencers/me/shoppable-posts';

const inShop = async (w) => (await api.get(`/follower/posts/${w.post}`)).status === 200;
const cardOf = async (w) => (await api.get(`/follower/posts/${w.post}`)).body.data;
const postRow = async (w) => (await query(`SELECT status, removed_reason, top_price FROM creator_posts WHERE id = $1`, [w.post])).rows[0];
const carried = async (w) => (await query(`SELECT product_id FROM post_products WHERE post_id = $1`, [w.post])).rows.map((r) => r.product_id);
const herPost = async (w) => (await api.get(`${PP}/${w.post}`, w.cr.token)).body.data.post;
const notices = async (w) => (await query(`SELECT type, title FROM notifications WHERE user_id = $1 ORDER BY created_at, id`, [w.cr.userId])).rows;
const product = async (id) => (await query(`SELECT name, stock, is_active, variants_json FROM brand_products WHERE id = $1`, [id])).rows[0];
const hide = (w, id) => api.patch(`/brands/me/products/${id}`, w.b.token, { is_active: false });
const show = (w, id) => api.patch(`/brands/me/products/${id}`, w.b.token, { is_active: true });
const remove = (w, id) => api.del(`/brands/me/products/${id}`, w.b.token);
const panel = async (w, id) => (await api.get(`/brands/me/offers/product-offers/${id}`, w.b.token)).body.data;
const BLUE = (m, l) => ({ colors: [{ color: 'Blue', images: [], sizes: [{ size: 'M', stock: m }, { size: 'L', stock: l }] }] });
const sizes = async (id) => Object.fromEntries((await product(id)).variants_json.colors[0].sizes.map((s) => [s.size, s.stock]));
/** The website's Edit product save: every box with what it showed when the page was opened. */
const edit = (w, id, boxes, over = {}) => api.patch(`/brands/me/listing-products/${id}`, w.b.token, {
  name: 'Edited piece', price: 900, facets: {},
  variants: [{ color: 'Blue', images: [], sizes: boxes.map(([size, stock, was]) => ({ size, stock, ...(was === undefined ? {} : { stock_was: was }) })) }],
  ...over,
});

beforeAll(async () => {
  await D.fresh();
  await query(`INSERT INTO payment_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  paymentConfig._resetCache();
});

describe('A · hidden and out of stock are a pause', () => {
  it('Hide on the only product of a live post: the post waits out of the shop, still approved and still holding the product; Show brings it back', async () => {
    const w = await D.world('discount', [900]);
    expect(await inShop(w)).toBe(true);

    expect((await hide(w, w.ids[0])).status).toBe(200);
    expect(await inShop(w)).toBe(false);
    expect((await postRow(w)).status).toBe('approved');                       // it used to be 'removed', for good
    expect(await carried(w)).toEqual([w.ids[0]]);                             // …and the product deleted from it
    expect((await herPost(w)).not_in_shop).toBe(MSG.NOT_IN_SHOP_PRODUCTS);
    expect((await notices(w)).map((n) => n.type)).toContain('product_paused');
    expect((await notices(w)).map((n) => n.type)).not.toContain('post.removed');

    expect((await show(w, w.ids[0])).status).toBe(200);
    expect(await inShop(w)).toBe(true);
    expect((await cardOf(w)).products.map((p) => p.id)).toEqual([w.ids[0]]);
    expect((await herPost(w)).not_in_shop).toBeNull();
    const told = await notices(w);
    expect(told.find((n) => n.type === 'product_paused').title).toMatch(/is not on sale right now$/);
    expect(told.find((n) => n.type === 'product_back_on_sale').title).toMatch(/is back on sale$/);
  });

  it('one of three hidden: the post stays with the other two, its price band read from them; Show brings the third back', async () => {
    const w = await D.world('discount', [1399, 1499, 1999]);
    const before = Number((await postRow(w)).top_price);
    expect((await hide(w, w.ids[2])).status).toBe(200);                       // the dearest one
    expect(await inShop(w)).toBe(true);
    expect((await cardOf(w)).products.map((p) => p.id).sort()).toEqual([w.ids[0], w.ids[1]].sort());
    expect((await carried(w)).sort()).toEqual([...w.ids].sort());             // still hers, all three
    expect(Number((await postRow(w)).top_price)).toBeLessThan(before);
    expect((await herPost(w)).not_in_shop).toBeNull();                        // shoppers can see the post
    await show(w, w.ids[2]);
    expect((await cardOf(w)).products).toHaveLength(3);
    expect(Number((await postRow(w)).top_price)).toBe(before);
  });

  it('every size saved as 0: nothing is removed — the post waits, and is back when stock is saved again', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(3, 4) });
    expect((await edit(w, w.ids[0], [['M', 0], ['L', 0]])).status).toBe(200);
    expect((await product(w.ids[0])).stock).toBe(0);
    expect(await inShop(w)).toBe(false);
    expect((await postRow(w)).status).toBe('approved');                       // a zero-stock save used to remove it for good
    expect(await carried(w)).toEqual([w.ids[0]]);
    expect((await notices(w)).map((n) => n.type)).toContain('product_out_of_stock');
    expect((await edit(w, w.ids[0], [['M', 5], ['L', 0]])).status).toBe(200);
    expect(await inShop(w)).toBe(true);
  });

  it('the product panel says how many posts carry it (it always said 0)', async () => {
    const three = await D.world('discount', [1399, 1499, 1999]);
    expect(await panel(three, three.ids[0])).toMatchObject({ now: { posts: 1, creators: 1 }, posts_live: 1, posts_only_this: 0 });
    const single = await D.world('discount', [900]);
    expect(await panel(single, single.ids[0])).toMatchObject({ now: { posts: 1 }, posts_live: 1, posts_only_this: 1 });
  });

  it('Remove is the permanent one: the product leaves every post for good, a post left with nothing is removed and its creator told — also when it was hidden first', async () => {
    const w = await D.world('discount', [900]);
    expect((await hide(w, w.ids[0])).status).toBe(200);
    expect((await postRow(w)).status).toBe('approved');
    const r = await remove(w, w.ids[0]);                                      // a hidden product used to answer "already removed"
    expect(r.status).toBe(200);
    expect(await carried(w)).toEqual([]);
    expect(await postRow(w)).toMatchObject({ status: 'removed', removed_reason: 'unavailable' });
    const types = (await notices(w)).map((n) => n.type);
    expect(types).toContain('product_unavailable');
    expect(types).toContain('post.removed');
    expect((await show(w, w.ids[0])).status).toBe(200);                       // on sale again, but its posts do not come back
    expect((await postRow(w)).status).toBe('removed');

    const three = await D.world('discount', [1399, 1499, 1999]);
    expect((await remove(three, three.ids[1])).status).toBe(200);
    expect((await carried(three)).sort()).toEqual([three.ids[0], three.ids[2]].sort());
    expect((await postRow(three)).status).toBe('approved');
    expect(await inShop(three)).toBe(true);
  });

  it('Remove is refused for a piece of a running set, in words that say what to do; nothing changes', async () => {
    const w = await D.world('set');
    const name = (await product(w.ids[0])).name;
    const { rows: [o] } = await query(`SELECT name FROM brand_offers WHERE id = $1`, [w.deal]);
    const r = await remove(w, w.ids[0]);
    expect(r.status).toBe(422);
    expect(r.body.error).toMatchObject({ code: 'REMOVE_REFUSED', message: `"${name}" is part of the set "${o.name}". Hide it to pause the set, or end the offer first.` });
    expect((await product(w.ids[0])).is_active).toBe(true);
    expect((await carried(w)).sort()).toEqual([...w.ids].sort());
    expect(await inShop(w)).toBe(true);
  });
});

describe('B · saving Edit never brings back sold stock', () => {
  it('a box she did not touch keeps the live number: 3 shown, 2 sold, saved as 1 — and she is told', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(3, 4) });
    const sh = await D.shopper();
    await D.order(sh, [line(w, 0, { colour: 'Blue', size: 'M', qty: 2 })]);
    expect(await sizes(w.ids[0])).toEqual({ M: 1, L: 4 });
    const r = await edit(w, w.ids[0], [['M', 3, 3], ['L', 4, 4]]);            // the form, as it was opened
    expect(r.status).toBe(200);
    expect(await sizes(w.ids[0])).toEqual({ M: 1, L: 4 });                    // it used to go back to 3
    expect((await product(w.ids[0])).stock).toBe(5);
    expect(r.body.data.stock_notes).toEqual([{ colour: 'Blue', size: 'M', shown: 3, now: 1, saved: 1 }]);
  });

  it('a box she changed moves by what she changed: 3 shown, 10 typed, 1 live → 8', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(3, 4) });
    const sh = await D.shopper();
    await D.order(sh, [line(w, 0, { colour: 'Blue', size: 'M', qty: 2 })]);
    const r = await edit(w, w.ids[0], [['M', 10, 3], ['L', 4, 4]]);
    expect(await sizes(w.ids[0])).toEqual({ M: 8, L: 4 });
    expect(r.body.data.stock_notes).toEqual([{ colour: 'Blue', size: 'M', shown: 3, now: 1, saved: 8 }]);
    // never below nothing: on another product, 3 shown, 0 typed (she says none are left), 1 live → 0, not −2
    const w2 = await D.world('discount', [900], { variants: BLUE(3, 4) });
    await D.order(await D.shopper(), [line(w2, 0, { colour: 'Blue', size: 'M', qty: 2 })]);
    await edit(w2, w2.ids[0], [['M', 0, 3], ['L', 4, 4]]);
    expect((await sizes(w2.ids[0])).M).toBe(0);
  });

  it('emptied → not counted; a box that was not counted takes what she types; a size the product did not have is saved as typed', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(3, null) });
    const r = await edit(w, w.ids[0], [['M', '', 3], ['L', 5, null], ['XL', 7, 0]]);
    expect(r.status).toBe(200);
    const s = Object.fromEntries((await product(w.ids[0])).variants_json.colors[0].sizes.map((x) => [x.size, x.stock]));
    expect(s).toEqual({ M: null, L: 5, XL: 7 });
    expect(r.body.data.stock_notes).toEqual([]);
  });

  it('nothing moved meanwhile: saved exactly as typed, with nothing to tell', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(3, 4) });
    const r = await edit(w, w.ids[0], [['M', 6, 3], ['L', 4, 4]]);
    expect(await sizes(w.ids[0])).toEqual({ M: 6, L: 4 });
    expect(r.body.data.stock_notes).toEqual([]);
  });

  it('a page that sends no "shown" numbers is saved as sent, as before', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(3, 4) });
    const sh = await D.shopper();
    await D.order(sh, [line(w, 0, { colour: 'Blue', size: 'M', qty: 2 })]);
    const r = await edit(w, w.ids[0], [['M', 3], ['L', 4]]);
    expect(await sizes(w.ids[0])).toEqual({ M: 3, L: 4 });
    expect(r.body.data.stock_notes).toEqual([]);
  });
});

describe('C · Place order happens once', () => {
  const key = () => `test-${Math.random().toString(36).slice(2, 12)}`;
  const ready = async (w, sh, lines, method) => {
    const rv = await api.post('/follower/checkout/review', sh.token, { address_id: sh.addr, lines, payment_method: method });
    if (rv.status !== 200 || !rv.body.data.buyable) throw new Error(`review: ${JSON.stringify(rv.body).slice(0, 300)}`);
    return (place_key) => api.post('/follower/checkout/place', sh.token, { address_id: sh.addr, lines, payment_method: method, expected_total: rv.body.data.total, ...(place_key ? { place_key } : {}) });
  };
  const checkoutsOf = async (sh) => (await query(`SELECT id, status, client_key FROM checkouts WHERE follower_id = $1 ORDER BY created_at, id`, [sh.followerId])).rows;
  const linesOf = async (sh) => (await query(`SELECT count(*)::int n FROM order_lines WHERE follower_id = $1`, [sh.followerId])).rows[0].n;

  it('cash on delivery, the same attempt sent twice: one order, stock taken once, the same answer', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(3, 4) });
    const sh = await D.shopper();
    const place = await ready(w, sh, [line(w, 0, { colour: 'Blue', size: 'M', qty: 1 })], 'cod');
    const k = key();
    const first = await place(k);
    const again = await place(k);                                             // the answer was lost; she taps again
    expect(first.status).toBe(200); expect(again.status).toBe(200);
    expect(first.body.data.status).toBe('placed');
    expect(again.body.data).toMatchObject({ checkout_id: first.body.data.checkout_id, status: 'placed', repeated: true });
    expect(await checkoutsOf(sh)).toHaveLength(1);                            // there were two
    expect(await linesOf(sh)).toBe(1);
    expect((await sizes(w.ids[0])).M).toBe(2);                                // 3 − 1, not 3 − 2
  });

  it('online, the same attempt sent twice: one held order, the same payment to open', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(1, 4) });      // the last M
    const sh = await D.shopper();
    const place = await ready(w, sh, [line(w, 0, { colour: 'Blue', size: 'M', qty: 1 })], 'online');
    const k = key();
    const first = await place(k);
    const again = await place(k);                                             // without the key her own hold said "Sold out"
    expect(first.body.data.status).toBe('pending');
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ checkout_id: first.body.data.checkout_id, status: 'pending' });
    expect(again.body.data.razorpay.order_id).toBe(first.body.data.razorpay.order_id);
    expect(await checkoutsOf(sh)).toHaveLength(1);
    expect((await sizes(w.ids[0])).M).toBe(0);                                // held once
  });

  it('a new attempt (another key), or no key at all, is a new order as before', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(5, 4) });
    const sh = await D.shopper();
    const place = await ready(w, sh, [line(w, 0, { colour: 'Blue', size: 'M', qty: 1 })], 'cod');
    await place(key()); await place(key()); await place(); await place();
    expect(await checkoutsOf(sh)).toHaveLength(4);
    expect((await sizes(w.ids[0])).M).toBe(1);
    expect(((await place('short')).body.data || {}).repeated).toBeUndefined();   // a key that is not one is ignored
  });

  it('an attempt she gave up on gives its key back: placing again starts afresh, and what it held is released first', async () => {
    const w = await D.world('discount', [900], { variants: BLUE(1, 4) });
    const sh = await D.shopper();
    const online = await ready(w, sh, [line(w, 0, { colour: 'Blue', size: 'M', qty: 1 })], 'online');
    const k = key();
    const first = await online(k);
    expect((await api.post(`/follower/checkout/${first.body.data.checkout_id}/abandon`, sh.token)).status).toBe(200);
    const second = await online(k);
    expect(second.status).toBe(200);
    expect(second.body.data.checkout_id).not.toBe(first.body.data.checkout_id);
    const cs = await checkoutsOf(sh);
    expect(cs.map((c) => [c.status, c.client_key === k])).toEqual([['expired', false], ['pending', true]]);
    // she now pays cash instead, with the key still in her hand: the held one is let go, and the order is made
    const cod = await ready(w, sh, [line(w, 0, { colour: 'Blue', size: 'L', qty: 1 })], 'cod');
    const third = await cod(k);
    expect(third.body.data.status).toBe('placed');
    expect((await checkoutsOf(sh)).map((c) => c.status)).toEqual(['expired', 'expired', 'placed']);
    expect(await sizes(w.ids[0])).toEqual({ M: 1, L: 3 });                    // the M she was holding is back
  });
});

describe('D · a set is in the shop only while it can be bought', () => {
  it('a piece hidden, or out of stock: the set\'s post waits out of the shop and returns by itself; her post page says why', async () => {
    const w = await D.world('set');
    expect(await inShop(w)).toBe(true);
    await hide(w, w.ids[1]);
    expect(await inShop(w)).toBe(false);                                      // it stayed up: "SET FOR ₹3,500", unbuyable
    expect((await herPost(w)).not_in_shop).toBe(MSG.NOT_IN_SHOP_SET);
    await show(w, w.ids[1]);
    expect(await inShop(w)).toBe(true);

    await query(`UPDATE brand_products SET stock = 0 WHERE id = $1`, [w.ids[2]]);
    expect(await inShop(w)).toBe(false);
    await query(`UPDATE brand_products SET stock = 6 WHERE id = $1`, [w.ids[2]]);
    expect(await inShop(w)).toBe(true);
  });

  it('a set whose pieces may be bought alone keeps its post while any piece sells', async () => {
    const w = await D.world('set_open');
    await query(`UPDATE brand_products SET stock = 0 WHERE id = $1`, [w.ids[2]]);
    expect(await inShop(w)).toBe(true);
    expect((await cardOf(w)).products.find((p) => p.id === w.ids[2]).in_stock).toBe(false);
  });

  it('a piece the set needs twice needs stock for two', async () => {
    const w = await D.world('set');
    await query(`UPDATE brand_offers SET offer_config_json = offer_config_json || jsonb_build_object('quantities', jsonb_build_object($2::text, 2)) WHERE id = $1`, [w.deal, w.ids[0]]);
    await query(`UPDATE brand_products SET stock = 1 WHERE id = $1`, [w.ids[0]]);
    expect(await inShop(w)).toBe(false);
    await query(`UPDATE brand_products SET stock = 2 WHERE id = $1`, [w.ids[0]]);
    expect(await inShop(w)).toBe(true);
    // and the two are bought with ONE line of two, as the phone now sends it
    const sh = await D.shopper();
    const lines = [line(w, 0, { qty: 2 }), line(w, 1), line(w, 2)];
    const rv = await api.post('/follower/checkout/review', sh.token, { address_id: sh.addr, lines, payment_method: 'cod' });
    expect(rv.body.data.buyable).toBe(true);
  });
});
