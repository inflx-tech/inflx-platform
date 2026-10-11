'use strict';

/**
 * A photo save must never put sold stock back
 * (features/backend-defect-cover-photo-stock-overwrite).
 *
 * The photo tray after an Excel import saves a product's cover photos. It used to read the whole
 * "colours and sizes" record with no hold on the row, add the photos, and write the WHOLE record
 * back — sizes and their stock included. An order landing between that read and that write had
 * its size put back (M 3 → 2 → 3 again), while the product's own number kept the sale: the two
 * numbers disagreed, which features/stock-asked-once had removed.
 *
 * How the moment is made here: the stock movement of a real order (stock.service.moveProducts, the
 * function every order, cancel and return calls) is run on its own connection and left open. The
 * save under test is sent and is seen waiting for the row. Then the order commits. With the old
 * code the save had already read "M 3" and wrote it back; now it reads after the order.
 *
 * Real API, real database.
 */

const W = require('./helpers/item17');
const H = require('./helpers/offersV2');
const { pool } = require('./helpers/db');
const stock = require('../src/services/stock.service');

const { api, query } = W;
const rnd = () => Math.random().toString(36).slice(2, 8);
const PHOTO = (n) => `https://cdn.inflx.test/photo-${n}.jpg`;

/** A category of our own with the two choices every fashion product has: colour and size. */
async function tshirtLeaf() {
  const v = `photo_${rnd()}`;
  const node = async (name, parent, depth, leaf, sizeSystem = null) => (await query(
    `INSERT INTO category_nodes (vertical, parent_id, segment, category, name, depth, is_leaf, size_system)
     VALUES ($1,$2,'Men',$3,$4,$5,$6,$7) RETURNING id`, [v, parent, depth > 1 ? 'Topwear' : null, name, depth, leaf, sizeSystem])).rows[0].id;
  const top = await node('Men', null, 0, false);
  const cat = await node('Topwear', top, 1, false);
  const facet = (key, label, required) => query(
    `INSERT INTO facet_definitions (vertical, scope, facet_key, label, facet_role, input_type, required, allowed_values, sort_order)
     VALUES ($1,'ALL',$2,$3,'variant','multi_select',$4,'[]'::jsonb,$5)`, [v, key, label, required, key === 'size' ? 2 : 1]);
  await facet('color_tone', 'Color / Tone', 'required');
  await facet('size', 'Size', 'conditional');
  return node('T-Shirt', cat, 2, true, 'alpha');
}

const row = async (id) => (await query(`SELECT stock, image_url, variants_json FROM brand_products WHERE id = $1`, [id])).rows[0];
const sizesOf = (r) => Object.fromEntries(r.variants_json.colors[0].sizes.map((s) => [s.size, s.stock]));
const agree = (r) => expect(r.stock).toBe(stock.sizesTotal(r.variants_json));       // the rule of stock-asked-once

/** A red T-shirt, M 3 and L 4 (own number 7), added the way the website adds it. */
async function tshirt(b, name = 'Red t-shirt') {
  const r = await api.post('/brands/me/products/batch', b.token, { category_node_id: LEAF, items: [{
    name, price: 1499, facets: { color_tone: ['Red'], size: ['M', 'L'] },
    variants: [{ color: 'Red', images: [], sizes: [{ size: 'M', stock: 3 }, { size: 'L', stock: 4 }] }],
  }] });
  if (r.status !== 201) throw new Error(`add: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data.products[0].id;
}
const savePhotos = (b, id, urls) => api.post(`/listing/products/${id}/cover-photos`, b.token, { urls });

/** Is some other connection waiting for a lock on a statement about products? */
const someoneWaits = async () => (await query(
  `SELECT count(*)::int AS n FROM pg_stat_activity
    WHERE wait_event_type = 'Lock' AND pid <> pg_backend_pid() AND query ILIKE '%brand_products%'`)).rows[0].n > 0;

/**
 * Runs `save` in the middle of a stock movement: the movement holds the product's row, `save` is
 * sent and seen waiting for it, the movement commits, `save` finishes. Returns save's answer.
 */
async function duringAStockMove(move, save) {
  const order = await pool.connect();
  let sent;
  try {
    await order.query('BEGIN');
    const moved = await move(order);
    expect(moved.ok).toBe(true);
    sent = save().then((r) => r);                                     // goes now, not awaited
    let waiting = false;
    for (let i = 0; i < 100 && !waiting; i += 1) {                    // up to 5 s
      await new Promise((r) => setTimeout(r, 50));                    // eslint-disable-line no-await-in-loop
      waiting = await someoneWaits();                                 // eslint-disable-line no-await-in-loop
    }
    expect(waiting).toBe(true);                                       // the save has reached the row
    await order.query('COMMIT');
  } catch (e) {
    await order.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    order.release();
  }
  return sent;
}

let LEAF; let b;
beforeAll(async () => {
  await W.fresh();
  LEAF = await tshirtLeaf();
  b = await H.brand();
});

describe('the photo tray\'s save (POST /listing/products/:id/cover-photos)', () => {
  it('a sale that lands while a photo is being saved stays sold: M 3 → 2, the own number agrees, and the photo is saved', async () => {
    const id = await tshirt(b);
    expect(sizesOf(await row(id))).toEqual({ M: 3, L: 4 });
    const r = await duringAStockMove(
      (order) => stock.moveProducts(order, [{ product_id: id, colour: 'Red', size: 'M', qty: 1, name: 'Red t-shirt' }], -1),
      () => savePhotos(b, id, [PHOTO(1)]));
    expect(r.status).toBe(200);
    const after = await row(id);
    expect(sizesOf(after)).toEqual({ M: 2, L: 4 });                   // it was put back to 3
    expect(after.stock).toBe(6);
    agree(after);
    expect(after.variants_json.cover_images).toEqual([PHOTO(1)]);
    expect(after.image_url).toBe(PHOTO(1));
  });

  it('a piece that comes back (a cancelled order) while a photo is being saved stays back: L 4 → 6', async () => {
    const id = await tshirt(b, 'Returned t-shirt');
    const r = await duringAStockMove(
      (order) => stock.moveProducts(order, [{ product_id: id, colour: 'Red', size: 'L', qty: 2, name: 'Returned t-shirt' }], +1),
      () => savePhotos(b, id, [PHOTO(2)]));
    expect(r.status).toBe(200);
    const after = await row(id);
    expect(sizesOf(after)).toEqual({ M: 3, L: 6 });
    agree(after);
    expect(after.variants_json.cover_images).toEqual([PHOTO(2)]);
  });

  it('what the brand sees is unchanged: photos are added after the ones there, 6 at most, the first is the cover, and nothing else in the record moves', async () => {
    const id = await tshirt(b, 'Photo t-shirt');
    const before = await row(id);
    const one = await savePhotos(b, id, [PHOTO('a'), PHOTO('b')]);
    expect(one.status).toBe(200);
    expect(one.body.data).toEqual({ id, image_url: PHOTO('a'), cover_images: [PHOTO('a'), PHOTO('b')] });
    const two = await savePhotos(b, id, [PHOTO('c'), '', PHOTO('d'), PHOTO('e'), PHOTO('f'), PHOTO('g')]);
    expect(two.body.data.cover_images).toEqual([PHOTO('a'), PHOTO('b'), PHOTO('c'), PHOTO('d'), PHOTO('e'), PHOTO('f')]);
    expect(two.body.data.image_url).toBe(PHOTO('a'));
    const after = await row(id);
    expect(after.variants_json.colors).toEqual(before.variants_json.colors);
    expect(after.stock).toBe(before.stock);
    const { cover_images: _c, ...rest } = after.variants_json;        // eslint-disable-line no-unused-vars
    const { cover_images: _b, ...restBefore } = before.variants_json; // eslint-disable-line no-unused-vars
    expect(rest).toEqual(restBefore);
  });

  it('refusals as before: another brand\'s product is not found, and a save with no photos is refused', async () => {
    const id = await tshirt(b, 'Guarded t-shirt');
    const before = await row(id);
    const other = await H.brand();
    expect((await savePhotos(other, id, [PHOTO(9)])).status).toBe(404);
    expect((await api.post(`/listing/products/${id}/cover-photos`, b.token, { urls: [] })).status).toBe(422);
    expect((await api.post(`/listing/products/${id}/cover-photos`, b.token, {})).status).toBe(422);
    expect(await row(id)).toEqual(before);                            // nothing was written
  });

  it('a record an older save stored as text still takes a photo, and its colours are still readable', async () => {
    const id = await tshirt(b, 'Old t-shirt');
    await query(`UPDATE brand_products SET variants_json = to_jsonb(variants_json::text) WHERE id = $1`, [id]);
    expect(typeof (await row(id)).variants_json).toBe('string');
    const r = await savePhotos(b, id, [PHOTO('old')]);
    expect(r.status).toBe(200);
    const after = await row(id);
    expect(after.variants_json.cover_images).toEqual([PHOTO('old')]);
    expect(sizesOf(after)).toEqual({ M: 3, L: 4 });
  });

  it('a product with no record at all takes a photo', async () => {
    const id = await tshirt(b, 'Bare t-shirt');
    await query(`UPDATE brand_products SET variants_json = NULL, stock = 5 WHERE id = $1`, [id]);
    const r = await savePhotos(b, id, [PHOTO('bare')]);
    expect(r.status).toBe(200);
    const after = await row(id);
    expect(after.variants_json).toEqual({ cover_images: [PHOTO('bare')] });
    expect(after.stock).toBe(5);
  });
});

describe('the older product save, when a stock is sent (PATCH /brands/me/products/:pid)', () => {
  it('a sale that lands while it is being saved: the own number is the total of the sizes as they are afterwards — not as they were read', async () => {
    const id = await tshirt(b, 'Patched t-shirt');
    const r = await duringAStockMove(
      (order) => stock.moveProducts(order, [{ product_id: id, colour: 'Red', size: 'M', qty: 1, name: 'Patched t-shirt' }], -1),
      () => api.patch(`/brands/me/products/${id}`, b.token, { stock: 99 }));
    expect(r.status).toBe(200);
    const after = await row(id);
    expect(sizesOf(after)).toEqual({ M: 2, L: 4 });
    expect(after.stock).toBe(6);                                      // it was written as 7
    agree(after);
    expect(r.body.data.product.stock).toBe(6);
  });

  it('with no stock sent it is as before: Hide and a new price answer, and the stock is not touched', async () => {
    const id = await tshirt(b, 'Plain t-shirt');
    const hide = await api.patch(`/brands/me/products/${id}`, b.token, { is_active: false });
    expect(hide.status).toBe(200);
    expect(hide.body.data.product.is_active).toBe(false);
    const price = await api.patch(`/brands/me/products/${id}`, b.token, { price: 1599, is_active: true });
    expect(price.status).toBe(200);
    expect(Number(price.body.data.product.price)).toBe(1599);
    const after = await row(id);
    expect(sizesOf(after)).toEqual({ M: 3, L: 4 });
    expect(after.stock).toBe(7);
  });
});
