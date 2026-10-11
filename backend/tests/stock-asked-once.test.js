'use strict';

/**
 * stock-asked-once — a product with sizes has ONE stock, its sizes (features/stock-asked-once).
 *
 * Raised from two screenshots on 11 Oct 2026: the Listings page said "20 in stock", the shopper app
 * said "Out of stock", for the same sunglasses. The product's own number and its one size
 * ("Free Size") had been typed separately and nothing made them agree.
 *
 *   A   the server keeps the own number equal to the total of the sizes, on every way a product is
 *       saved — and never takes it from what was sent
 *   B   what the shopper is sent agrees with it: the tile, the deal data, `one_size`
 *   C   orders still move both numbers together, also when the own number was empty
 *   D   the Excel sheet asks once, and a sheet from the old template is refused
 * Real API, real database, a live shoppable post.
 */

const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../src/app');
const W = require('./helpers/item17');
const W14 = require('./helpers/item14');
const w12 = require('./helpers/item12');
const paymentConfig = require('../src/services/paymentConfig.service');
const stock = require('../src/services/stock.service');
const bulk = require('../src/services/listingBulk.service');

const { api, query } = W;
const rnd = () => Math.random().toString(36).slice(2, 8);
const ADDRESS = { receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B, Lotus Residency', area: 'Road No. 3, Banjara Hills',
  landmark: 'Near the park', pincode: '500034', city: 'Hyderabad', state: 'Telangana', label: 'Home' };

/** A category of our own with the two choices every fashion product has: colour and size. */
async function leaves() {
  const v = `stock_${rnd()}`;
  const node = async (name, parent, depth, leaf, sizeSystem = null) => (await query(
    `INSERT INTO category_nodes (vertical, parent_id, segment, category, name, depth, is_leaf, size_system)
     VALUES ($1,$2,'Unisex',$3,$4,$5,$6,$7) RETURNING id`, [v, parent, depth > 1 ? 'Accessories' : null, name, depth, leaf, sizeSystem])).rows[0].id;
  const top = await node('Unisex', null, 0, false);
  const cat = await node('Accessories', top, 1, false);
  const facet = (key, label, required) => query(
    `INSERT INTO facet_definitions (vertical, scope, facet_key, label, facet_role, input_type, required, allowed_values, sort_order)
     VALUES ($1,'ALL',$2,$3,'variant','multi_select',$4,'[]'::jsonb,$5)`, [v, key, label, required, key === 'size' ? 2 : 1]);
  await facet('color_tone', 'Color / Tone', 'required');
  await facet('size', 'Size', 'conditional');
  return {
    vertical: v,
    sunglasses: await node('Sunglasses', cat, 2, true, 'free_size'),      // one size
    tshirt: await node('T-Shirt', cat, 2, true, 'alpha'),                 // real sizes
  };
}

const FREE = (n) => [{ size: 'Free Size', stock: n }];
const row = async (id) => (await query(`SELECT stock, variants_json, facets FROM brand_products WHERE id = $1`, [id])).rows[0];
const sizesOf = (r) => Object.fromEntries((r.variants_json.colors || []).map((c) => [c.color, Object.fromEntries(c.sizes.map((s) => [s.size, s.stock]))]));

/** The website's Add a product: one item under a leaf. Returns the new product's id. */
async function add(b, leafId, item) {
  const r = await api.post('/brands/me/products/batch', b.token, { category_node_id: leafId, items: [{ price: 1499, ...item }] });
  if (r.status !== 201) throw new Error(`add: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data.products[0].id;
}
/** The website's Edit product. */
const edit = (b, id, item) => api.patch(`/brands/me/listing-products/${id}`, b.token, item);

const cardOf = async (w) => (await api.get(`/follower/posts/${w.post}`)).body.data;
const dealOf = async (w) => (await api.get(`/follower/posts/${w.post}/deal`)).body.data;
const tile = async (w, id) => (await cardOf(w)).products.find((p) => p.id === id);
const inDeal = async (w, id) => (await dealOf(w)).products.find((p) => p.id === id);
/** Straight into the row, the way a product was left by an older save. */
const leave = (id, colors, own) => query(`UPDATE brand_products SET variants_json = $2::jsonb, stock = $3 WHERE id = $1`, [id, JSON.stringify({ colors }), own]);

async function placeCod(w, lines) {
  const sh = await W.shopper();
  const addr = (await api.post('/follower/addresses', sh.token, ADDRESS)).body.data.address.id;
  await api.put('/follower/bag', sh.token, { lines });
  const rv = await api.post('/follower/checkout/review', sh.token, { address_id: addr, lines, payment_method: 'cod' });
  if (rv.status !== 200) throw new Error(`review: ${JSON.stringify(rv.body)}`);
  const place = await api.post('/follower/checkout/place', sh.token, { address_id: addr, lines, payment_method: 'cod', expected_total: rv.body.data.total });
  return { sh, place };
}

let L;
beforeAll(async () => {
  await W.fresh();
  W14.resetTree();
  await query(`INSERT INTO payment_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  paymentConfig._resetCache();
  await w12.startServer();
  L = await leaves();
});
afterAll(() => w12.stopServer());

describe('A · the own number is the total of the sizes, however the product is saved', () => {
  it('a one-size product with two colours: each colour holds its stock under the one size, and the own number is their total — not the number sent', async () => {
    const w = await W.saleWorld({ prices: [900] });
    const id = await add(w.b, L.sunglasses, {
      name: 'Computer sunglasses', stock: 99,                                    // an older page still sends one
      facets: { color_tone: ['White', 'Black'], size: ['Free Size'] },
      variants: [{ color: 'White', images: [], sizes: FREE(20) }, { color: 'Black', images: [], sizes: FREE('5') }],
    });
    const r = await row(id);
    expect(sizesOf(r)).toEqual({ White: { 'Free Size': 20 }, Black: { 'Free Size': 5 } });
    expect(r.stock).toBe(25);
  });

  it('the exact fault of 11 Oct: "Stock 20" typed for the product and 0 left on its one size — the server no longer keeps the 20', async () => {
    const w = await W.saleWorld({ prices: [900] });
    const id = await add(w.b, L.sunglasses, {
      name: 'Cool glasses', stock: 20, facets: { color_tone: ['Blue'], size: ['Free Size'] },
      variants: [{ color: 'Blue', images: [], sizes: FREE(0) }],
    });
    const r = await row(id);
    expect(r.stock).toBe(0);                                                     // the Listings page now says what the shopper app says
    expect(stock.available(r)).toBe(false);
  });

  it('a product with real sizes: M 10, L 12, XL 0 → 22', async () => {
    const w = await W.saleWorld({ prices: [900] });
    const id = await add(w.b, L.tshirt, {
      name: 'Red t-shirt', stock: 34, facets: { color_tone: ['Red'], size: ['M', 'L', 'XL'] },
      variants: [{ color: 'Red', images: [], sizes: [{ size: 'M', stock: 10 }, { size: 'L', stock: 12 }, { size: 'XL', stock: 0 }] }],
    });
    expect((await row(id)).stock).toBe(22);
  });

  it('a size left empty is not counted: the own number is empty too, and the product can always be bought', async () => {
    const w = await W.saleWorld({ prices: [900] });
    const id = await add(w.b, L.tshirt, {
      name: 'Blue t-shirt', stock: 50, facets: { color_tone: ['Blue'], size: ['M', 'L'] },
      variants: [{ color: 'Blue', images: [], sizes: [{ size: 'M', stock: 0 }, { size: 'L', stock: '' }] }],
    });
    const r = await row(id);
    expect(r.stock).toBeNull();
    expect(stock.available(r)).toBe(true);
  });

  it('a stock that is not a number is saved as empty; a negative one as 0', async () => {
    const w = await W.saleWorld({ prices: [900] });
    const id = await add(w.b, L.tshirt, {
      name: 'Odd t-shirt', facets: { color_tone: ['Grey'], size: ['M', 'L'] },
      variants: [{ color: 'Grey', images: [], sizes: [{ size: 'M', stock: -3 }, { size: 'L', stock: 'plenty' }] }],
    });
    const r = await row(id);
    expect(sizesOf(r)).toEqual({ Grey: { M: 0, L: null } });
    expect(r.stock).toBeNull();
    const whole = await add(w.b, L.sunglasses, { name: 'No number', stock: 'plenty', facets: { color_tone: ['Red'] }, variants: [{ color: 'Red', images: [], sizes: [] }] });
    expect((await row(whole)).stock).toBeNull();                                 // it used to stop the save with a database error
  });

  it('a product with no sizes keeps the number sent: its own number is the only stock it has', async () => {
    const w = await W.saleWorld({ prices: [900] });
    const bag = await add(w.b, L.sunglasses, { name: 'Red leather bag', stock: 4, facets: { color_tone: ['Red'] }, variants: [{ color: 'Red', images: [], sizes: [] }] });
    expect((await row(bag)).stock).toBe(4);
    const plain = await add(w.b, L.sunglasses, { name: 'Plain piece', stock: '7', facets: { color_tone: ['Green'] } });
    expect((await row(plain)).stock).toBe(7);
  });

  it('Edit: the colours\' stock is saved and the own number follows — 20 + 5, then Black to 0, then White emptied', async () => {
    const w = await W.saleWorld({ prices: [900] });
    const item = (white, black) => ({
      name: 'Round glasses', price: 1000, stock: 77, facets: { color_tone: ['White', 'Black'], size: ['Free Size'] },
      variants: [{ color: 'White', images: [], sizes: FREE(white) }, { color: 'Black', images: [], sizes: FREE(black) }],
    });
    const id = await add(w.b, L.sunglasses, item(20, 5));
    expect((await edit(w.b, id, item(20, 0))).status).toBe(200);
    expect((await row(id)).stock).toBe(20);
    expect((await edit(w.b, id, item(0, 0))).status).toBe(200);
    expect((await row(id)).stock).toBe(0);
    expect((await edit(w.b, id, item('', 0))).status).toBe(200);
    const r = await row(id);
    expect(r.stock).toBeNull();
    expect(sizesOf(r)).toEqual({ White: { 'Free Size': null }, Black: { 'Free Size': 0 } });
  });

  it('the older product page cannot set the own number of a product with sizes either; a product with none it still can', async () => {
    const w = await W.saleWorld({ prices: [900, 800] });
    await leave(w.ids[0], [{ color: 'Blue', sizes: [{ size: 'M', stock: 3 }, { size: 'L', stock: 4 }], images: [] }], 7);
    const r1 = await api.patch(`/brands/me/products/${w.ids[0]}`, w.b.token, { stock: 50 });
    expect(r1.status).toBe(200);
    expect((await row(w.ids[0])).stock).toBe(7);
    // …and new sizes sent through it bring their own total
    await api.patch(`/brands/me/products/${w.ids[0]}`, w.b.token, { variants_json: { colors: [{ color: 'Blue', sizes: [{ size: 'M', stock: 1 }], images: [] }] } });
    expect((await row(w.ids[0])).stock).toBe(1);
    // a switch that sends no stock leaves the number alone
    await api.patch(`/brands/me/products/${w.ids[0]}`, w.b.token, { is_active: true });
    expect((await row(w.ids[0])).stock).toBe(1);
    const r2 = await api.patch(`/brands/me/products/${w.ids[1]}`, w.b.token, { stock: 50 });
    expect(r2.status).toBe(200);
    expect((await row(w.ids[1])).stock).toBe(50);
  });
});

describe('B · what the shopper is sent agrees with the Listings page', () => {
  const item = (white, black, over = {}) => ({
    name: 'Jeans in a post', price: 2000, facets: { color_tone: ['White', 'Black'], size: ['Free Size'] },
    variants: [{ color: 'White', images: [], sizes: FREE(white) }, { color: 'Black', images: [], sizes: FREE(black) }], ...over,
  });

  it('one colour at 0: that colour is sold out, the product is not; every colour at 0: "Out of stock" on both sides', async () => {
    const w = await W.saleWorld();
    expect((await edit(w.b, w.ids[0], item(20, 0))).status).toBe(200);
    expect((await row(w.ids[0])).stock).toBe(20);
    expect((await tile(w, w.ids[0])).in_stock).toBe(true);
    let d = await inDeal(w, w.ids[0]);
    expect(d.sold_out).toBe(false);
    expect(Object.fromEntries(d.colours.map((c) => [c.colour, c.sizes[0].sold_out]))).toEqual({ White: false, Black: true });

    expect((await edit(w.b, w.ids[0], item(0, 0, { stock: 20 }))).status).toBe(200);   // "20" sent for the product changes nothing
    expect((await row(w.ids[0])).stock).toBe(0);
    expect((await tile(w, w.ids[0])).in_stock).toBe(false);
    d = await inDeal(w, w.ids[0]);
    expect(d.sold_out).toBe(true);
  });

  it('`one_size`: true for a product whose colours each hold one stand-in size; false for real sizes, and for a shirt listed in M only', async () => {
    const w = await W.saleWorld();
    await leave(w.ids[0], [{ color: 'White', sizes: FREE(20), images: [] }, { color: 'Black', sizes: [{ size: 'free size', stock: 2 }], images: [] }], 22);
    await leave(w.ids[1], [{ color: 'Red', sizes: [{ size: 'M', stock: 3 }, { size: 'L', stock: 4 }], images: [] }], 7);
    await leave(w.ids[2], [{ color: 'Blue', sizes: [{ size: 'M', stock: 3 }], images: [] }], 3);
    const d = await dealOf(w);
    const flag = (id) => d.products.find((p) => p.id === id).one_size;
    expect(flag(w.ids[0])).toBe(true);
    expect(flag(w.ids[1])).toBe(false);
    expect(flag(w.ids[2])).toBe(false);
    // "One Size" and "Unstitched" are the other two stand-ins; a product with no sizes at all has nothing to pick
    await leave(w.ids[1], [{ color: 'Red', sizes: [{ size: 'One Size', stock: 3 }], images: [] }], 3);
    await leave(w.ids[2], [{ color: 'Blue', sizes: [], images: [] }], 3);
    const d2 = await dealOf(w);
    expect(d2.products.find((p) => p.id === w.ids[1]).one_size).toBe(true);
    expect(d2.products.find((p) => p.id === w.ids[2]).one_size).toBe(false);
  });

  it('a product with colours and no sizes answers from its own number (it could never say sold out)', async () => {
    const w = await W.saleWorld();
    await leave(w.ids[0], [{ color: 'Red', sizes: [], images: [] }], 0);
    expect((await inDeal(w, w.ids[0])).sold_out).toBe(true);
    expect((await tile(w, w.ids[0])).in_stock).toBe(false);
    await leave(w.ids[0], [{ color: 'Red', sizes: [], images: [] }], 4);
    expect((await inDeal(w, w.ids[0])).sold_out).toBe(false);
  });
});

describe('C · an order still moves both numbers together', () => {
  it('one White of a one-size product: 20 → 19 and 25 → 24; the cancel gives it back', async () => {
    const w = await W.saleWorld();
    await leave(w.ids[0], [{ color: 'White', sizes: FREE(20), images: [] }, { color: 'Black', sizes: FREE(5), images: [] }], 25);
    const { sh, place } = await placeCod(w, [{ post_id: w.post, product_id: w.ids[0], colour: 'White', size: 'Free Size', qty: 1 }]);
    expect(place.body.data.status).toBe('placed');
    let r = await row(w.ids[0]);
    expect(sizesOf(r).White['Free Size']).toBe(19);
    expect(r.stock).toBe(24);
    const { rows: [ln] } = await query(`SELECT id FROM order_lines WHERE checkout_id = $1`, [place.body.data.checkout_id]);
    expect((await api.post(`/follower/orders/lines/${ln.id}/cancel`, sh.token, { reason: 'Not needed any more' })).status).toBe(200);
    r = await row(w.ids[0]);
    expect(sizesOf(r).White['Free Size']).toBe(20);
    expect(r.stock).toBe(25);
  });

  it('the last unit of a product whose own number was empty: the own number becomes 0, not empty (it used to stay empty and the post stayed in the shop)', async () => {
    const w = await W.saleWorld({ prices: [900] });
    await leave(w.ids[0], [{ color: 'Blue', sizes: [{ size: 'M', stock: 1 }], images: [] }], null);
    const { place } = await placeCod(w, [{ post_id: w.post, product_id: w.ids[0], colour: 'Blue', size: 'M', qty: 1 }]);
    expect(place.body.data.status).toBe('placed');
    expect((await row(w.ids[0])).stock).toBe(0);
    const feed = (await api.post('/follower/feed', undefined, {})).body.data.posts.map((p) => p.id);
    expect(feed).not.toContain(w.post);
  });
});

describe('D · the Excel sheet asks once', () => {
  const facets = [
    { facet_key: 'color_tone', label: 'Color / Tone', facet_role: 'variant', input_type: 'multi_select', required: 'required', allowed_values: [] },
    { facet_key: 'size', label: 'Size', facet_role: 'variant', input_type: 'multi_select', required: 'conditional', allowed_values: [] },
  ];
  const headers = (node, f = facets) => bulk.columnModel(node, f).cols.map((c) => c.header);

  it('the template: one "Stock" column; no "Size" on a one-size leaf; no "Variant stock" anywhere stock is counted per row', () => {
    const sun = headers({ size_system: 'free_size' });
    expect(sun).toEqual(['Name', 'Price', 'Brand', 'Description', 'Colour', 'Stock', 'Cover image URLs', 'Colour image URLs']);
    const tee = headers({ size_system: 'alpha' });
    expect(tee).toEqual(['Name', 'Price', 'Brand', 'Description', 'Colour', 'Size', 'Stock', 'Cover image URLs', 'Colour image URLs']);
    // a leaf with nothing to count per row keeps its product-level Stock, exactly as before
    expect(headers({ size_system: null }, [facets[0]])).toEqual(['Name', 'Price', 'Brand', 'Description', 'Stock', 'Colour', 'Variant stock', 'Cover image URLs', 'Colour image URLs']);
    const wb = bulk.buildTemplateWorkbook({ id: 'x', name: 'Sunglasses', size_system: 'free_size' }, facets, new Date('2026-10-11T00:00:00Z'));
    const help = [];
    wb.getWorksheet('Instructions').eachRow((r) => help.push([r.getCell(1).text, r.getCell(3).text]));
    expect(help.find((h) => h[0] === 'Stock')[1]).toMatch(/^The stock of this row \(this colour\)\. A number\. Leave empty if you do not count stock/);
  });

  it('two rows of a one-size product: one product, two colours, each filed under the leaf\'s one size', () => {
    const rows = [
      { Name: 'Computer sunglasses', Price: '1499', Colour: 'White', Stock: '20', __row: 2 },
      { Name: 'Computer sunglasses', Price: '1499', Colour: 'Black', Stock: '', __row: 3 },
    ];
    const { items, fileErrors } = bulk.buildItems(rows, { size_system: 'free_size' }, facets);
    expect(fileErrors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].stock).toBeNull();
    expect(items[0].facets.size).toEqual(['Free Size']);
    expect(items[0].variants.map((v) => [v.color, v.sizes])).toEqual([
      ['White', [{ size: 'Free Size', stock: '20' }]], ['Black', [{ size: 'Free Size', stock: null }]]]);
  });

  it('a colour on two rows of a one-size product is refused; a sheet from the old template is refused whole', () => {
    const twice = bulk.buildItems([
      { Name: 'Hot glasses', Price: '780', Colour: 'Red', Stock: '7', __row: 2 },
      { Name: 'Hot glasses', Price: '780', Colour: 'Red', Stock: '3', __row: 3 },
    ], { size_system: 'free_size' }, facets);
    expect(twice.items).toEqual([]);
    expect(twice.fileErrors).toEqual(['"Hot glasses": the colour Red is on more than one row (row 3). This product has one row per colour.']);

    const old = [{ Name: 'Cool glasses', Price: '1599', Stock: '8', Colour: 'Blue', Size: 'Free Size', 'Variant stock': '0', __row: 2 }];
    expect(bulk.buildItems(old, { size_system: 'free_size' }, facets)).toEqual({ items: [], fileErrors: [bulk.OLD_TEMPLATE] });
    // …also when its "Variant stock" column is there but empty (only the header gives it away)
    const blank = [{ Name: 'Cool glasses', Price: '1599', Stock: '8', Colour: 'Blue', __row: 2 }];
    blank.__headers = ['Name *', 'Price *', 'Stock', 'Colour *', 'Size', 'Variant stock'];
    expect(bulk.buildItems(blank, { size_system: 'alpha' }, facets).fileErrors).toEqual([bulk.OLD_TEMPLATE]);
    expect(bulk.OLD_TEMPLATE).toBe('This sheet is from the old template, which asked for stock twice. Download the template again, paste your rows into it, and upload.');
  });

  it('through the website\'s upload: the downloaded template, filled, makes the product with its own number added up; the old sheet saves nothing', async () => {
    const w = await W.saleWorld({ prices: [900] });
    const tpl = await request(app).get(`/v1/listing/nodes/${L.sunglasses}/template.xlsx`).buffer(true).parse((res, cb) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(tpl.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tpl.body);
    const ws = wb.getWorksheet('Products');
    const hdr = ws.getRow(1).values.filter(Boolean).map(String);
    expect(hdr).toEqual(['Name *', 'Price *', 'Brand', 'Description', 'Colour *', 'Stock', 'Cover image URLs', 'Colour image URLs']);
    const fill = (o) => hdr.map((h) => o[h.replace(/ \*$/, '')] ?? '');
    const name = `Sheet sunglasses ${rnd()}`;
    ws.addRow(fill({ Name: name, Price: 1499, Colour: 'White', Stock: 20 }));
    ws.addRow(fill({ Name: name, Price: 1499, Colour: 'Black', Stock: 5 }));
    const up = await request(app).post(`/v1/listing/nodes/${L.sunglasses}/import`).set('Authorization', `Bearer ${w.b.token}`)
      .attach('file', Buffer.from(await wb.xlsx.writeBuffer()), 'sunglasses.xlsx');
    expect(up.status).toBe(201);
    expect(up.body.data.created_count).toBe(1);
    const r = await row(up.body.data.products[0].id);
    expect(sizesOf(r)).toEqual({ White: { 'Free Size': 20 }, Black: { 'Free Size': 5 } });
    expect(r.stock).toBe(25);
    expect(r.facets.size).toEqual(['Free Size']);

    const oldWb = new ExcelJS.Workbook();
    const o = oldWb.addWorksheet('Products');
    o.addRow(['Name *', 'Price *', 'Stock', 'Colour *', 'Size', 'Variant stock']);
    const oldName = `Old sheet ${rnd()}`;
    o.addRow([oldName, 1599, 8, 'Blue', 'Free Size', 0]);
    const refused = await request(app).post(`/v1/listing/nodes/${L.sunglasses}/import`).set('Authorization', `Bearer ${w.b.token}`)
      .attach('file', Buffer.from(await oldWb.xlsx.writeBuffer()), 'old.xlsx');
    expect(refused.status).toBe(422);
    expect(refused.body.error.message).toBe(bulk.OLD_TEMPLATE);
    expect((await query(`SELECT count(*)::int n FROM brand_products WHERE name = $1`, [oldName])).rows[0].n).toBe(0);
  });
});
