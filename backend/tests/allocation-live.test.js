'use strict';

/**
 * Live allocation — Phase 4b (features/phase4-live-allocation/).
 *
 * The brand's offer builder writes offer_config_json.scope ('store' |
 * 'category' | 'products'). Before 4b the allocation readers ignored scope
 * and unioned the frozen product arrays — which are EMPTY for store/category
 * scopes, so "entire store" offers allocated zero listed products. 4b makes
 * store/category scopes resolve LIVE (new products auto-flow to the creator
 * store); hand-picked lists stay frozen (legacy).
 *
 * Also regression-locks the resolve-coupon fix: that route selected
 * cs.products_json — a column that has never existed on campaign_sets — so
 * every POST /v1/follower/resolve-coupon 500'd (genuine defect, carved into
 * this contract). Now co.products_json + scope-aware live allocation.
 *
 * FIXTURE NOTE: full campaign chain via DIRECT SQL (ledgered tier-CASCADE
 * harness defect blocks the campaign-create API in tests).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createFollowerUser } = require('./helpers/factories');
const ttlCache = require('../src/utils/ttlCache');

const HANDLE = 'livealloccreator';
const CODE = 'LIVE20';

let brandId;

async function seedChain(offerConfig) {
  const brandUser = (await query(
    `INSERT INTO users (phone, role, name, status, city)
     VALUES ('+910000000041', 'brand', 'Charvitha Fashions', 'approved', 'Vijayawada') RETURNING id`
  )).rows[0].id;
  brandId = (await query(
    `INSERT INTO brands (user_id, business_name, category)
     VALUES ($1, 'Charvitha Fashions', 'fashion_walkin') RETURNING id`, [brandUser]
  )).rows[0].id;

  const infUser = (await query(
    `INSERT INTO users (phone, role, name, status, city)
     VALUES ('+910000000042', 'influencer', 'Nisha', 'approved', 'Vijayawada') RETURNING id`
  )).rows[0].id;
  const infId = (await query(
    `INSERT INTO influencers (user_id, instagram_handle, followers_count)
     VALUES ($1, $2, 9000) RETURNING id`, [infUser, HANDLE]
  )).rows[0].id;

  const campId = (await query(
    `INSERT INTO campaigns (brand_id, name, status, start_date, end_date)
     VALUES ($1, 'Live Alloc', 'active', '2026-06-01', '2026-12-31') RETURNING id`, [brandId]
  )).rows[0].id;
  const setId = (await query(
    `INSERT INTO campaign_sets (campaign_id, name, goal)
     VALUES ($1, 'Creators', 'conversion') RETURNING id`, [campId]
  )).rows[0].id;
  await query(
    `INSERT INTO campaign_influencers
       (set_id, influencer_id, status, coupon_code, offer_type, offer_config_json, created_at)
     VALUES ($1, $2, 'active', $3, 'discount', $4, now())`,
    [setId, infId, CODE, JSON.stringify(offerConfig)]
  );
  await query(
    `INSERT INTO campaign_offers (campaign_id, set_id, offer_type, discount_value, is_active, availing_modes)
     VALUES ($1, $2, 'percentage', 20, true, '{pay_at_store}')`, [campId, setId]
  );
}

async function addProduct(name, section) {
  await query(
    `INSERT INTO brand_products (brand_id, name, price, section, is_active, pushed_to_store)
     VALUES ($1, $2, 500, $3, true, true)`, [brandId, name, section]
  );
}

const storeProducts = async () => {
  const res = await request(app).get(`/v1/store/${HANDLE}`);
  expect(res.status).toBe(200);
  return (res.body.data.offers || []).flatMap(o => (o.products || []).map(p => p.name)).sort();
};

beforeEach(async () => {
  await truncateAll();
  ttlCache.clear();
});

describe('Live allocation (Phase 4b)', () => {
  it("scope 'store': the whole live catalogue — new products auto-flow", async () => {
    await seedChain({ scope: 'store', sub_type: 'pct', value: 20 });
    await addProduct('Red Kurti', 'Kurtis');
    expect(await storeProducts()).toEqual(['Red Kurti']);

    await addProduct('Blue Saree', 'Sarees');       // brand lists a NEW product later
    expect(await storeProducts()).toEqual(['Blue Saree', 'Red Kurti']); // it just appears

    await query(`UPDATE brand_products SET pushed_to_store = false WHERE name = 'Blue Saree'`);
    expect(await storeProducts()).toEqual(['Red Kurti']); // un-push pulls it (Phase 0 rule holds)
  });

  it("scope 'category': live within the section only", async () => {
    await seedChain({ scope: 'category', category: 'Kurtis', sub_type: 'pct', value: 20 });
    await addProduct('Red Kurti', 'Kurtis');
    await addProduct('Blue Saree', 'Sarees');
    expect(await storeProducts()).toEqual(['Red Kurti']);

    await addProduct('Green Kurti', 'Kurtis');      // new product IN the category
    expect(await storeProducts()).toEqual(['Green Kurti', 'Red Kurti']);
  });

  it("scope 'products': hand-picked stays FROZEN (legacy)", async () => {
    await seedChain({ scope: 'products', products: [], sub_type: 'pct', value: 20 });
    await addProduct('Red Kurti', 'Kurtis');
    const pid = (await query(`SELECT id FROM brand_products WHERE name = 'Red Kurti'`)).rows[0].id;
    await query(
      `UPDATE campaign_influencers SET offer_config_json = $1 WHERE coupon_code = $2`,
      [JSON.stringify({ scope: 'products', products: [{ id: pid }], sub_type: 'pct', value: 20 }), CODE]
    );
    expect(await storeProducts()).toEqual(['Red Kurti']);

    await addProduct('Blue Saree', 'Sarees');       // new product does NOT flow into a hand-picked list
    expect(await storeProducts()).toEqual(['Red Kurti']);
  });

  it('resolve-coupon works again (was: 500 on non-existent cs.products_json) and is live', async () => {
    await seedChain({ scope: 'store', sub_type: 'pct', value: 20 });
    await addProduct('Red Kurti', 'Kurtis');
    await addProduct('Blue Saree', 'Sarees');

    const { token } = await createFollowerUser();
    const res = await request(app).post('/v1/follower/resolve-coupon')
      .set('Authorization', `Bearer ${token}`).send({ code: CODE });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.allocated_product_ids || res.body.data.products || res.body.data).toBeDefined();
  });
});
