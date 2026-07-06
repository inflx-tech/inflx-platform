'use strict';

/**
 * Photos-first ordering — product shelves lead with photographed products so
 * the storefront never opens with placeholder cards (contract:
 * product-image-resolution). A photo-less product must sink below a
 * photographed one even when it is newer.
 *
 * Exercises the rule directly (runRule) — same pattern as world-rules.test's
 * curation-surface case — so the assertion isolates ORDERING and doesn't
 * depend on the endpoint's taxonomy category mapping.
 *
 * FIXTURE NOTE: direct SQL (ledgered tier-CASCADE harness defect).
 */

const { truncateAll, query } = require('./helpers/db');
const ttlCache = require('../src/utils/ttlCache');
const rules = require('../src/services/sectionRules.service');

beforeEach(async () => { await truncateAll(); ttlCache.clear(); });

async function seed() {
  const u = (await query(
    `INSERT INTO users (phone, role, name, status, city)
     VALUES ('+910000000051','brand','PhotoOrder Co','approved','Vijayawada') RETURNING id`
  )).rows[0].id;
  const b = (await query(
    `INSERT INTO brands (user_id, business_name, category) VALUES ($1,'PhotoOrder Co','fashion_walkin') RETURNING id`, [u]
  )).rows[0].id;
  // Photo-less product created LATER (newer) → would lead a newest-first shelf.
  await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, created_at)
     VALUES ($1,'No Photo Newer',500,true,true, now())`, [b]
  );
  // Photographed (image_url) product created EARLIER.
  await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, image_url, created_at)
     VALUES ($1,'Has Url Older',500,true,true,'https://cdn/x/media/assets/a', now() - interval '2 days')`, [b]
  );
  // Photographed only via a per-colour variant image (no image_url) — must also
  // count as "has a photo" (mirrors resolveProductImage), created EARLIEST.
  await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store, variants_json, created_at)
     VALUES ($1,'Has Variant Oldest',500,true,true,
             '{"colors":[{"color":"Red","images":["https://cdn/x/media/assets/v"]}]}'::jsonb,
             now() - interval '4 days')`, [b]
  );
  return b;
}

describe('Photos-first product ordering', () => {
  it('photographed products (url OR variant) lead over a newer photo-less one', async () => {
    await seed();
    const items = await rules.runRule('products_in_category', { vertical: 'fashion', city: 'Vijayawada', limit: 20, config: {} });
    const names = items.map(i => i.name);
    expect(names).toHaveLength(3);
    // both photographed products come before the photo-less one, regardless of age
    expect(names.indexOf('No Photo Newer')).toBe(2);
    expect(names.slice(0, 2).sort()).toEqual(['Has Url Older', 'Has Variant Oldest']);
    // and every leading item resolves to a real image
    expect(items[0].image_url).toBeTruthy();
    expect(items[1].image_url).toBeTruthy();
  });
});
