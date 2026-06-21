'use strict';

/**
 * Offer Engine D2 — store-direct offer applied at the FOOD cart checkout.
 * Contract: features/food-store-offer-checkout.
 *
 * A restaurant publishes a BOGO store offer; a follower placing an ORGANIC food
 * cart (no influencer) with that brand_offer_id gets the discount, and the
 * order persists brand_offer_id + offer_source='store'. Regression: an organic
 * order with no offer still gets zero discount; an unpublished offer is rejected.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');

beforeEach(async () => { await truncateAll(); });

async function restaurant() {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token, { business_name: 'Biryani House', category: 'restaurant' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return brand;
}
async function addProduct(brandId, name, price) {
  const { rows } = await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store)
     VALUES ($1,$2,$3,true,true) RETURNING id`, [brandId, name, price]);
  return rows[0].id;
}
async function makeFollower() {
  const { token } = await createFollowerUser();
  const res = await request(app).post('/v1/followers/register')
    .set('Authorization', `Bearer ${token}`).send({ name: 'F', city: 'Vijayawada', state: 'AP' });
  return { token, follower: res.body.data.follower };
}
async function address(followerId) {
  const { rows } = await query(
    `INSERT INTO follower_addresses (follower_id, label, line1, city, pincode, is_default)
     VALUES ($1,'Home','10 MG Rd','Vijayawada','520001',true) RETURNING id`, [followerId]);
  return rows[0].id;
}
async function bogoOffer(brandId, buyId, getId, { published = true, status = 'active' } = {}) {
  const { rows } = await query(
    `INSERT INTO brand_offers (brand_id, name, offer_type, offer_config_json, status, published_to_store)
     VALUES ($1,'BOGO Biryani','bogo',$2,$3,$4) RETURNING id`,
    [brandId, JSON.stringify({ buy_product: { id: buyId }, get_product: { id: getId } }), status, published]);
  return rows[0].id;
}

async function placeAndVerify(token, body) {
  const place = await request(app).post('/v1/follower/orders').set('Authorization', `Bearer ${token}`).send(body);
  if (place.status !== 201) return { place };
  const verify = await request(app).post('/v1/follower/orders/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ razorpay_order_id: place.body.data.razorpay_order_id, razorpay_payment_id: 'pay_test' });
  return { place, verify };
}

describe('Store offer at food checkout', () => {
  it('BOGO store offer applied to an organic cart; order persists brand_offer_id + offer_source=store', async () => {
    const brand = await restaurant();
    const buy = await addProduct(brand.id, 'Chicken Biryani', 200);
    const get = await addProduct(brand.id, 'Veg Biryani', 180);
    const offerId = await bogoOffer(brand.id, buy, get);
    const { token, follower } = await makeFollower();
    const addressId = await address(follower.id);

    const { place, verify } = await placeAndVerify(token, {
      brand_id: brand.id, brand_offer_id: offerId, address_id: addressId,
      items: [{ product_id: buy, quantity: 1 }, { product_id: get, quantity: 1 }],
    });
    expect(place.status).toBe(201);
    expect(place.body.data.breakdown.discount_amount).toBe(180);   // the GET item is free
    expect(verify.status).toBe(200);

    const { rows } = await query(
      `SELECT brand_offer_id, offer_source, discount_amount FROM follower_transactions WHERE brand_id=$1`, [brand.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].brand_offer_id).toBe(offerId);
    expect(rows[0].offer_source).toBe('store');
    expect(Number(rows[0].discount_amount)).toBe(180);
  });

  it('organic order with NO offer still gets zero discount (regression)', async () => {
    const brand = await restaurant();
    const p = await addProduct(brand.id, 'Chicken Biryani', 200);
    const { token, follower } = await makeFollower();
    const addressId = await address(follower.id);
    const { place } = await placeAndVerify(token, {
      brand_id: brand.id, address_id: addressId, items: [{ product_id: p, quantity: 1 }],
    });
    expect(place.status).toBe(201);
    expect(place.body.data.breakdown.discount_amount).toBe(0);
  });

  it('an unpublished store offer is rejected (409)', async () => {
    const brand = await restaurant();
    const buy = await addProduct(brand.id, 'Chicken Biryani', 200);
    const get = await addProduct(brand.id, 'Veg Biryani', 180);
    const offerId = await bogoOffer(brand.id, buy, get, { published: false });
    const { token, follower } = await makeFollower();
    const addressId = await address(follower.id);
    const place = await request(app).post('/v1/follower/orders').set('Authorization', `Bearer ${token}`).send({
      brand_id: brand.id, brand_offer_id: offerId, address_id: addressId,
      items: [{ product_id: buy, quantity: 1 }, { product_id: get, quantity: 1 }],
    });
    expect(place.status).toBe(409);
  });
});
