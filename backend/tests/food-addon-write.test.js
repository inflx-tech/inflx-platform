'use strict';

/**
 * Food World Phase 2 — owner addon/variation write API.
 * Contract: features/food-world-phase2-owner-editor/.
 *
 * Verifies: bulk-replace POST persists groups+items; GET returns the nested
 * shape; follower read parity (Phase 1); bulk-replace drops removed groups;
 * ownership guard (403); validation (422 on bad shapes, no partial write);
 * badge/is_featured/featured_sort writable via updateProduct; and snapshot
 * safety (deleting an addon never touches a prior order's items_json).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

async function approveUser(userId) {
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]);
}

async function makeFollower() {
  const { token } = await createFollowerUser();
  const res = await request(app)
    .post('/v1/followers/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Follower', city: 'Vijayawada', state: 'AP' });
  return res.body.data.follower;
}

// Register an approved restaurant brand + one dish; return token + ids.
async function seedRestaurant(name = 'Swagruha Tiffins') {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token, { business_name: name, category: 'restaurant' });
  await approveUser(user.id);
  const { rows } = await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, section, veg_flag)
     VALUES ($1,'Paneer Curry',114,true,true,'Curries','veg') RETURNING id`,
    [brand.id]
  );
  return { token, brand, productId: rows[0].id };
}

// A full customisation payload: Portion (variation) + Accompaniment (add-ons).
function fullPayload(srcId) {
  return {
    groups: [
      {
        name: 'Accompaniment', selection_type: 'multi', is_variation: false,
        is_required: false, min_select: 0, max_select: 3, sort_order: 0,
        items: [
          { name: 'Roti', price: 15, sort_order: 0, source_product_id: srcId || undefined },
          { name: 'Chapathi', price: 15, sort_order: 1 },
        ],
      },
      {
        name: 'Portion', selection_type: 'single', is_variation: true,
        is_required: true, min_select: 1, max_select: 1, sort_order: 1,
        items: [
          { name: 'Half', price: 70, is_default: false, sort_order: 0 },
          { name: 'Full', price: 114, is_default: true, sort_order: 1 },
        ],
      },
    ],
  };
}

describe('Food World P2 — addon write API', () => {
  it('POST bulk-replace persists groups+items; GET returns nested shape', async () => {
    const { token, productId } = await seedRestaurant();

    const post = await request(app)
      .post(`/v1/brands/me/products/${productId}/addon-groups`)
      .set('Authorization', `Bearer ${token}`)
      .send(fullPayload());
    expect(post.status).toBe(200);
    expect(post.body.data.groups).toHaveLength(2);

    const get = await request(app)
      .get(`/v1/brands/me/products/${productId}/addon-groups`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    const groups = get.body.data.groups;
    // Sorted by sort_order → Accompaniment (0) then Portion (1).
    expect(groups.map(g => g.name)).toEqual(['Accompaniment', 'Portion']);
    const portion = groups.find(g => g.name === 'Portion');
    expect(portion.is_variation).toBe(true);
    expect(portion.selection_type).toBe('single');
    expect(portion.items.map(i => `${i.name}:${i.price}`)).toEqual(['Half:70', 'Full:114']);
    expect(portion.items.find(i => i.name === 'Full').is_default).toBe(true);
    const accomp = groups.find(g => g.name === 'Accompaniment');
    expect(accomp.max_select).toBe(3);
    expect(accomp.items).toHaveLength(2);
  });

  it('follower read (Phase 1) returns the same addon_groups', async () => {
    const { token, productId } = await seedRestaurant();
    await request(app)
      .post(`/v1/brands/me/products/${productId}/addon-groups`)
      .set('Authorization', `Bearer ${token}`)
      .send(fullPayload());

    const pub = await request(app).get(`/v1/follower/products/${productId}`);
    expect(pub.status).toBe(200);
    const ag = pub.body.data.product.addon_groups;
    expect(ag.map(g => g.name)).toEqual(['Accompaniment', 'Portion']);
    expect(ag.find(g => g.name === 'Portion').items).toHaveLength(2);
  });

  it('bulk-replace drops removed groups', async () => {
    const { token, productId } = await seedRestaurant();
    await request(app).post(`/v1/brands/me/products/${productId}/addon-groups`)
      .set('Authorization', `Bearer ${token}`).send(fullPayload());

    // Re-post with ONLY the variation group.
    const onlyPortion = { groups: [fullPayload().groups[1]] };
    const re = await request(app).post(`/v1/brands/me/products/${productId}/addon-groups`)
      .set('Authorization', `Bearer ${token}`).send(onlyPortion);
    expect(re.status).toBe(200);
    expect(re.body.data.groups.map(g => g.name)).toEqual(['Portion']);

    const { rows } = await query(`SELECT COUNT(*)::int n FROM product_addon_groups WHERE product_id=$1`, [productId]);
    expect(rows[0].n).toBe(1);
  });

  it('ownership guard — brand B cannot write brand A product (403)', async () => {
    const { productId } = await seedRestaurant('Brand A');
    const { token: tokenB } = await seedRestaurant('Brand B');
    const res = await request(app)
      .post(`/v1/brands/me/products/${productId}/addon-groups`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send(fullPayload());
    expect(res.status).toBe(403);
    const { rows } = await query(`SELECT COUNT(*)::int n FROM product_addon_groups WHERE product_id=$1`, [productId]);
    expect(rows[0].n).toBe(0);
  });

  it('validation — variation+multi, empty items, negative price all 422 with no partial write', async () => {
    const { token, productId } = await seedRestaurant();
    const bad = [
      { groups: [{ name: 'Portion', selection_type: 'multi', is_variation: true, items: [{ name: 'Half', price: 70 }] }] },
      { groups: [{ name: 'Empty', selection_type: 'single', items: [] }] },
      { groups: [{ name: 'Neg', selection_type: 'multi', items: [{ name: 'Roti', price: -5 }] }] },
    ];
    for (const body of bad) {
      const res = await request(app).post(`/v1/brands/me/products/${productId}/addon-groups`)
        .set('Authorization', `Bearer ${token}`).send(body);
      expect(res.status).toBe(422);
    }
    const { rows } = await query(`SELECT COUNT(*)::int n FROM product_addon_groups WHERE product_id=$1`, [productId]);
    expect(rows[0].n).toBe(0);
  });

  it('badge/is_featured/featured_sort writable via updateProduct', async () => {
    const { token, productId } = await seedRestaurant();
    const res = await request(app)
      .patch(`/v1/brands/me/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ badge: 'Popular', is_featured: true, featured_sort: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.product.badge).toBe('Popular');
    expect(res.body.data.product.is_featured).toBe(true);
    expect(res.body.data.product.featured_sort).toBe(2);
  });

  it('snapshot safety — deleting an add-on leaves a prior order items_json intact', async () => {
    const { token, productId, brand } = await seedRestaurant();
    const post = await request(app).post(`/v1/brands/me/products/${productId}/addon-groups`)
      .set('Authorization', `Bearer ${token}`).send(fullPayload());
    const cokeLike = post.body.data.groups.find(g => g.name === 'Accompaniment').items[0];

    // Fabricate a completed order whose items_json snapshots that add-on.
    const snapshot = [{ product_id: productId, quantity: 1, price: 129,
      selected_addons: [{ item_id: cokeLike.id, name: cokeLike.name, price: cokeLike.price }] }];
    const follower = await makeFollower();
    const { rows: tx } = await query(
      `INSERT INTO follower_transactions (follower_id, brand_id, transaction_type, gross_amount, net_amount, status)
       VALUES ($1,$2,'online_order',129,129,'completed') RETURNING id`, [follower.id, brand.id]);
    await query(
      `INSERT INTO follower_orders (transaction_id, order_status, items_json) VALUES ($1,'confirmed',$2)`,
      [tx[0].id, JSON.stringify(snapshot)]);

    // Now wipe all customisation for the product.
    const re = await request(app).post(`/v1/brands/me/products/${productId}/addon-groups`)
      .set('Authorization', `Bearer ${token}`).send({ groups: [] });
    expect(re.status).toBe(200);

    const { rows: ord } = await query(`SELECT items_json FROM follower_orders WHERE transaction_id=$1`, [tx[0].id]);
    expect(ord[0].items_json[0].selected_addons[0].name).toBe(cokeLike.name);
    expect(ord[0].items_json[0].selected_addons[0].price).toBe(cokeLike.price);
  });
});
