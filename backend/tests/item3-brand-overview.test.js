'use strict';

/**
 * Item 3 — the brand overview a creator sees (O1–O4) and its products (O3): no address,
 * phone or GSTIN ever; published products only; out-of-stock and size rules from
 * variants_json (founder Q6, Q7); 404 for a pending brand unless it is the owner.
 * Contract: features/item3-discovery-profiles-groups
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, creator, setBrandPitch, product, mockPlaces, PLACE, api } = require('./helpers/item3');

beforeEach(async () => { await truncateAll(); await resetReference(); });
afterEach(() => jest.restoreAllMocks());

const LEAK = /address_line|formatted_address|"pincode"|gstin|"phone"|login_phone|business_phone|email|contact_person|wallet|platform_fee|storage_quota|fcm/i;

describe('O1 — /brands/:id/public', () => {
  it('returns the overview fields and nothing private (check 26)', async () => {
    mockPlaces({ hyd: PLACE.hyd });
    const b = await brand({ business_name: 'Urban Threads', sub_categories: ['WOMEN', 'KIDS'], city: 'Hyderabad', state: 'Telangana' });
    await api.patch('/brands/me', b.token, { about: 'Everyday ethnic wear.', website_url: 'https://urbanthreads.in', instagram_handle: '@urban.threads' });
    // registration-and-profile: a branch is its four parts now (the second one must say which is main)
    const { rows: [hyd] } = await query(`SELECT c.id AS city_id, c.state_id FROM ref_cities c JOIN ref_states s ON s.id = c.state_id WHERE s.name = 'Telangana' AND c.name = 'Hyderabad'`);
    const added = await api.post('/brands/me/branches', b.token, { name: 'Banjara Hills', address_text: 'Road No 12, Banjara Hills', pincode: '500034', state_id: hyd.state_id, city_id: hyd.city_id, is_main: false });
    expect(added.status).toBe(201);
    await product(b.brandId, { name: 'Kurta', price: 1299 });
    const c = await creator();
    const r = await api.get(`/brands/${b.brandId}/public`, c.token);
    expect(r.status).toBe(200);
    expect(r.body.data.brand).toMatchObject({ id: b.brandId, business_name: 'Urban Threads', category: 'fashion', subCategories: ['WOMEN', 'KIDS'], about: 'Everyday ethnic wear.', mainCity: 'Hyderabad', branchCount: 2, branchCities: ['Hyderabad'], websiteUrl: 'https://urbanthreads.in', instagramHandle: 'urban.threads', productCount: 1 });
    expect(r.body.data.products.total).toBe(1);
    expect(r.body.data.products.rows[0]).toMatchObject({ name: 'Kurta', price: 1299, outOfStock: false });
    expect(r.body.data.posts).toEqual({ total: 0, rows: [] });
    expect(r.body.data.pitchSummary.reason).toBe('OK');
    expect(r.body.data.isOwner).toBe(false);
    expect(JSON.stringify(r.body)).not.toMatch(LEAK);
  });

  it('a pending brand is 404 for a creator, 200 for the owner (isOwner) — and the owner gets no pitchSummary', async () => {
    const b = await brand({ status: 'pending' });
    const c = await creator();
    expect((await api.get(`/brands/${b.brandId}/public`, c.token)).status).toBe(404);
    const own = await api.get(`/brands/${b.brandId}/public`, b.token);
    expect(own.status).toBe(200);
    expect(own.body.data.isOwner).toBe(true);
    expect(own.body.data.pitchSummary).toBeNull();
  });

  it('the pitch summary follows the brand\'s settings: paused → NOT_ACCEPTING with the aims still listed', async () => {
    const b = await brand();
    await setBrandPitch(b.brandId, { accepting: false, aims: ['engagement'] });
    const c = await creator();
    const r = await api.get(`/brands/${b.brandId}/public`, c.token);
    expect(r.body.data.pitchSummary.reason).toBe('NOT_ACCEPTING');
  });
});

describe('O3 — products', () => {
  it('list: published only = is_active AND pushed_to_store AND the brand approved; paged', async () => {
    const b = await brand();
    const c = await creator();
    const live = await product(b.brandId, { name: 'Live' });
    await product(b.brandId, { name: 'Hidden', is_active: false });
    await product(b.brandId, { name: 'Not pushed', pushed_to_store: false });
    const r = await api.get(`/brands/${b.brandId}/products`, c.token);
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.rows.map(x => x.id)).toEqual([live]);
    await query(`UPDATE users SET status='pending' WHERE id=$1`, [b.userId]);
    expect((await api.get(`/brands/${b.brandId}/products`, b.token)).body.data.total).toBe(0);
  });

  it('out of stock: stock 0, or sizes present and all size stock 0; blank = available (founder Q6)', async () => {
    const b = await brand();
    const c = await creator();
    const blank = await product(b.brandId, { name: 'Blank' });
    const zero = await product(b.brandId, { name: 'Zero', stock: 0 });
    const positive = await product(b.brandId, { name: 'Positive', stock: 3 });
    const allSizesOut = await product(b.brandId, { name: 'Sizes out', variants_json: { colors: [{ name: 'Red', sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 0 }] }] } });
    const someSizes = await product(b.brandId, { name: 'Some sizes', variants_json: { colors: [{ name: 'Red', sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 2 }] }] } });
    const sizesBlank = await product(b.brandId, { name: 'Sizes blank', variants_json: { sizes: [{ size: 'L' }, { size: 'XL', stock: null }] } });
    const r = await api.get(`/brands/${b.brandId}/products?limit=50`, c.token);
    const by = Object.fromEntries(r.body.data.rows.map(x => [x.id, x.outOfStock]));
    expect(by[blank]).toBe(false);
    expect(by[zero]).toBe(true);
    expect(by[positive]).toBe(false);
    expect(by[allSizesOut]).toBe(true);
    expect(by[someSizes]).toBe(false);
    expect(by[sizesBlank]).toBe(false);
  });

  it('detail: images and sizes come from variants_json (founder Q7); size available when stock ≠ 0; 404 when unpublished', async () => {
    const b = await brand({ business_name: 'Urban Threads' });
    const c = await creator();
    const id = await product(b.brandId, {
      name: 'Anarkali', price: 2499, description: 'Festive wear.', image_url: 'https://img/cover.jpg',
      variants_json: { cover_images: ['https://img/cover.jpg', 'https://img/2.jpg'], colors: [{ name: 'Teal', images: ['https://img/teal.jpg'], sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 4 }, { size: 'L' }] }] },
    });
    const r = await api.get(`/brands/${b.brandId}/products/${id}`, c.token);
    expect(r.status).toBe(200);
    const p = r.body.data.product;
    expect(p).toMatchObject({ id, name: 'Anarkali', price: 2499, description: 'Festive wear.', outOfStock: false, brand: { id: b.brandId, name: 'Urban Threads' } });
    expect(p.images).toEqual(['https://img/cover.jpg', 'https://img/2.jpg', 'https://img/teal.jpg']);
    expect(p.sizes).toEqual([{ size: 'S', available: false }, { size: 'M', available: true }, { size: 'L', available: true }]);
    const hidden = await product(b.brandId, { pushed_to_store: false });
    expect((await api.get(`/brands/${b.brandId}/products/${hidden}`, c.token)).status).toBe(404);
    const other = await brand();
    expect((await api.get(`/brands/${other.brandId}/products/${id}`, c.token)).status).toBe(404);
  });
});
