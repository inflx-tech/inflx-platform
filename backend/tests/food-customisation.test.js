'use strict';

/**
 * Food World Phase 1 — dish customisation data model.
 * Contract: features/food-world-phase1-customisation/.
 *
 * Verifies: getProductDetail nested addon_groups; section payload enrichment
 * (rating/badge/has_addons); order pricing (variation SETS base + add-ons
 * STACK, server-priced); the regression guard (no customisation → base price
 * unchanged); and ownership validation (an add-on from another product → 422).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const sectionRules = require('../src/services/sectionRules.service');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

async function approveUser(userId) {
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]);
}

async function registerFollower(token) {
  const res = await request(app)
    .post('/v1/followers/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Follower', city: 'Vijayawada', state: 'AP' });
  if (res.status !== 201) throw new Error(`registerFollower failed: ${JSON.stringify(res.body)}`);
  return res.body.data.follower;
}

// Seed one restaurant + a curry dish (₹114) with a variation group
// (Half ₹70 / Full ₹114) + an add-on group (Roti +₹15 / Coke +₹40), 2 reviews
// (4,5 → avg 4.5), a follower + address. Returns the ids the tests need.
async function seedFood() {
  const { token: brandToken, user: brandUser } = await createBrandUser();
  const brand = await registerBrand(brandToken, { business_name: 'Swagruha Tiffins', category: 'restaurant' });
  await approveUser(brandUser.id);

  const { rows: pr } = await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, section, veg_flag, badge, is_featured, featured_sort)
     VALUES ($1,'Paneer Curry',114,true,true,'Curries','veg','Popular',true,1) RETURNING id`,
    [brand.id]
  );
  const productId = pr[0].id;

  // A second dish (no customisation) — used by the ownership-validation test.
  const { rows: pr2 } = await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, section, veg_flag)
     VALUES ($1,'Plain Dosa',64,true,true,'Tiffins','veg') RETURNING id`,
    [brand.id]
  );
  const product2Id = pr2[0].id;

  // Variation group (single, sets base price).
  const { rows: vg } = await query(
    `INSERT INTO product_addon_groups (product_id, name, selection_type, is_variation, is_required, min_select, max_select, sort_order)
     VALUES ($1,'Portion','single',true,true,1,1,1) RETURNING id`,
    [productId]
  );
  const portionGroup = vg[0].id;
  const { rows: full } = await query(
    `INSERT INTO product_addon_items (group_id, name, price, is_default, sort_order) VALUES ($1,'Full',114,true,0) RETURNING id`,
    [portionGroup]
  );
  const fullItem = full[0].id;
  const { rows: half } = await query(
    `INSERT INTO product_addon_items (group_id, name, price, is_default, sort_order) VALUES ($1,'Half',70,false,1) RETURNING id`,
    [portionGroup]
  );
  const halfItem = half[0].id;

  // Add-on group (multi, select up to 2, +delta each).
  const { rows: ag } = await query(
    `INSERT INTO product_addon_groups (product_id, name, selection_type, is_variation, is_required, min_select, max_select, sort_order)
     VALUES ($1,'Accompaniment','multi',false,false,0,2,0) RETURNING id`,
    [productId]
  );
  const accompGroup = ag[0].id;
  await query(`INSERT INTO product_addon_items (group_id, name, price, sort_order) VALUES ($1,'Roti',15,0)`, [accompGroup]);
  const { rows: coke } = await query(
    `INSERT INTO product_addon_items (group_id, name, price, sort_order) VALUES ($1,'Coke',40,1) RETURNING id`,
    [accompGroup]
  );
  const cokeItem = coke[0].id;

  // 2 published reviews → avg 4.5.
  await query(`INSERT INTO restaurant_reviews (brand_id, rating, status) VALUES ($1,4,'published'),($1,5,'published')`, [brand.id]);

  const { token: followerToken } = await createFollowerUser();
  const follower = await registerFollower(followerToken);
  // Seed the address directly — the /follower/addresses endpoint now geocodes
  // (fails in mock mode); address_id is nullable on orders, and this test is
  // about customisation, not address validation.
  const { rows: addr } = await query(
    `INSERT INTO follower_addresses (follower_id, label, line1, city, pincode, is_default)
     VALUES ($1,'Home','10 MG Road','Vijayawada','520001',true) RETURNING id`,
    [follower.id]
  );
  const addressId = addr[0].id;

  return { brand, productId, product2Id, portionGroup, accompGroup, fullItem, halfItem, cokeItem, followerToken, addressId };
}

describe('Food World P1 — getProductDetail addon_groups', () => {
  it('returns nested variation + add-on groups with items', async () => {
    const { productId } = await seedFood();
    const res = await request(app).get(`/v1/follower/products/${productId}`);
    expect(res.status).toBe(200);
    const p = res.body.data.product;
    expect(p.badge).toBe('Popular');
    expect(Array.isArray(p.addon_groups)).toBe(true);
    expect(p.addon_groups.length).toBe(2);

    // sort_order: Accompaniment (0) before Portion (1)
    const [accomp, portion] = p.addon_groups;
    expect(accomp.name).toBe('Accompaniment');
    expect(accomp.selection_type).toBe('multi');
    expect(accomp.is_variation).toBe(false);
    expect(accomp.max_select).toBe(2);
    expect(accomp.items.map(i => i.name).sort()).toEqual(['Coke', 'Roti']);

    expect(portion.name).toBe('Portion');
    expect(portion.selection_type).toBe('single');
    expect(portion.is_variation).toBe(true);
    expect(portion.is_required).toBe(true);
    const fullOpt = portion.items.find(i => i.name === 'Full');
    expect(fullOpt.price).toBe(114);
    expect(fullOpt.is_default).toBe(true);
  });

  it('returns empty addon_groups for an uncustomised dish', async () => {
    const { product2Id } = await seedFood();
    const res = await request(app).get(`/v1/follower/products/${product2Id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.product.addon_groups).toEqual([]);
  });
});

describe('Food World P1 — section payload enrichment', () => {
  it('carries rating, review_count, badge, has_addons', async () => {
    const { productId, product2Id } = await seedFood();
    const items = await sectionRules.runRule('products_in_category', { limit: 50 });
    const curry = items.find(i => i.id === productId);
    const dosa = items.find(i => i.id === product2Id);

    expect(curry).toBeDefined();
    expect(curry.rating).toBe(4.5);
    expect(curry.review_count).toBe(2);
    expect(curry.badge).toBe('Popular');
    expect(curry.has_addons).toBe(true);

    expect(dosa.has_addons).toBe(false);
    expect(dosa.badge).toBeNull();
  });
});

describe('Food World P1 — order carries + prices customisation', () => {
  it('variation SETS base + add-on STACKS → items_total 110; snapshot preserved', async () => {
    const { brand, productId, portionGroup, accompGroup, halfItem, cokeItem, followerToken, addressId } = await seedFood();

    const orderRes = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        brand_id: brand.id,
        items: [{
          product_id: productId, quantity: 1,
          variation: { group_id: portionGroup, item_id: halfItem },
          addons: [{ group_id: accompGroup, item_id: cokeItem }],
          note: 'extra spicy',
        }],
        address_id: addressId,
      });
    expect(orderRes.status).toBe(201);
    // Half (70) base + Coke (40) = 110 — NOT the ₹114 Full base.
    expect(orderRes.body.data.breakdown.items_total).toBe(110);

    const verifyRes = await request(app)
      .post('/v1/follower/orders/verify')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        razorpay_order_id: orderRes.body.data.razorpay_order_id,
        razorpay_payment_id: 'pay_food_001',
        razorpay_signature: 'mock_sig',
      });
    expect(verifyRes.status).toBe(200);

    const { rows } = await query(
      `SELECT items_json FROM follower_orders ORDER BY created_at DESC LIMIT 1`
    );
    const line = rows[0].items_json[0];
    expect(line.price).toBe(110);
    expect(line.variation.name).toBe('Half');
    expect(line.variation.price).toBe(70);
    expect(line.selected_addons).toHaveLength(1);
    expect(line.selected_addons[0].name).toBe('Coke');
    expect(line.note).toBe('extra spicy');
  });

  it('REGRESSION: no customisation → base price unchanged (114)', async () => {
    const { brand, productId, followerToken, addressId } = await seedFood();
    const orderRes = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({ brand_id: brand.id, items: [{ product_id: productId, quantity: 1 }], address_id: addressId });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.data.breakdown.items_total).toBe(114);
  });

  it('rejects an add-on that belongs to a different product (422)', async () => {
    const { brand, product2Id, accompGroup, cokeItem, followerToken, addressId } = await seedFood();
    // Coke belongs to the curry, not to Plain Dosa → must be rejected.
    const res = await request(app)
      .post('/v1/follower/orders')
      .set('Authorization', `Bearer ${followerToken}`)
      .send({
        brand_id: brand.id,
        items: [{ product_id: product2Id, quantity: 1, addons: [{ group_id: accompGroup, item_id: cokeItem }] }],
        address_id: addressId,
      });
    expect(res.status).toBe(422);
  });
});
