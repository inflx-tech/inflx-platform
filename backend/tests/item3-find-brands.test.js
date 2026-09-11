'use strict';

/**
 * Item 3 — Find brands (F2/F3): approved brands only, the live status per brand from the
 * same rules as pitching, "Brands I can pitch" on by default, category / city / aims /
 * modes filters, the three sorts, search. Contract: features/item3-discovery-profiles-groups
 */

const { truncateAll } = require('./helpers/db');
const { query, ref, resetReference, brand, creator, setBrandPitch, setCreatorInvite, block, collab, product, api } = require('./helpers/item3');

beforeEach(async () => { await truncateAll(); await resetReference(); });

const find = (c, q = {}) => api.get(`/influencers/me/find-brands?${new URLSearchParams(q).toString()}`, c.token);
const ids = (r) => r.body.data.rows.map(x => x.id);
const days = (n) => new Date(Date.now() - n * 86400000);

describe('F2 — who appears and with which status', () => {
  it('approved brands only; a pending brand never appears', async () => {
    const c = await creator();
    const ok = await brand();
    await brand({ status: 'pending' });
    const r = await find(c, { canPitchOnly: '0' });
    expect(r.status).toBe(200);
    expect(ids(r)).toEqual([ok.brandId]);
  });

  it('status: OK · NOT_ACCEPTING (paused, or the brand blocked her) · NOT_MATCHING (her numbers miss the brand\'s minimums)', async () => {
    const c = await creator({ ig: 8000 });
    const open = await brand({ business_name: 'Open Brand' });
    const paused = await brand({ business_name: 'Paused Brand' });
    const blocker = await brand({ business_name: 'Wall Brand' });
    const picky = await brand({ business_name: 'Picky Brand' });
    await setBrandPitch(paused.brandId, { accepting: false });
    await block('brand', blocker.brandId, 'creator', c.influencerId);
    await setBrandPitch(picky.brandId, { minIg: 100000 });
    const r = await find(c, { canPitchOnly: '0' });
    const by = Object.fromEntries(r.body.data.rows.map(x => [x.id, x.status]));
    expect(by[open.brandId]).toBe('OK');
    expect(by[paused.brandId]).toBe('NOT_ACCEPTING');
    expect(by[blocker.brandId]).toBe('NOT_ACCEPTING');
    expect(by[picky.brandId]).toBe('NOT_MATCHING');
    expect(JSON.stringify(r.body)).not.toMatch(/min_followers|minFollowers|block/i);
  });

  it('"Brands I can pitch" is on by default; the past-creator override applies (founder Q3 / item 2 rule 3)', async () => {
    const c = await creator({ ig: 1000 });
    const open = await brand();
    const picky = await brand();
    const pickyButPast = await brand();
    await setBrandPitch(picky.brandId, { minIg: 100000 });
    await setBrandPitch(pickyButPast.brandId, { minIg: 100000, allowPast: true });
    await collab(pickyButPast.brandId, c.influencerId);
    expect(ids(await find(c)).sort()).toEqual([open.brandId, pickyButPast.brandId].sort());
    expect(ids(await find(c, { canPitchOnly: '0' }))).toHaveLength(3);
  });

  it('a row carries the F2 card fields: sub-categories, main city, product count, aims, modes', async () => {
    const c = await creator();
    const b = await brand({ sub_categories: ['WOMEN', 'KIDS'], city: 'Hyderabad', state: 'Telangana' });
    await product(b.brandId); await product(b.brandId); await product(b.brandId, { pushed_to_store: false });
    await setBrandPitch(b.brandId, { aims: ['conversion'], modes: ['visit'] });
    const row = (await find(c)).body.data.rows[0];
    expect(row).toMatchObject({ id: b.brandId, subCategories: ['WOMEN', 'KIDS'], mainCity: 'Hyderabad', productCount: 2, acceptedAims: ['conversion'], acceptedModes: ['visit'], status: 'OK' });
    expect(JSON.stringify(row)).not.toMatch(/address|phone|gstin|email/i);
  });
});

describe('F3 — filters, sorts, search', () => {
  it('category (any of), city through brand_branches, aims and modes (at least one)', async () => {
    const c = await creator();
    const women = await brand({ sub_categories: ['WOMEN'], city: 'Hyderabad', state: 'Telangana' });
    const kids = await brand({ sub_categories: ['KIDS'], city: 'Chennai', state: 'Tamil Nadu' });
    await setBrandPitch(women.brandId, { aims: ['conversion'], modes: ['visit'] });
    await setBrandPitch(kids.brandId, { aims: ['engagement'], modes: ['shipment'] });
    expect(ids(await find(c, { categoryCodes: 'KIDS' }))).toEqual([kids.brandId]);
    expect(ids(await find(c, { categoryCodes: 'KIDS,WOMEN' })).sort()).toEqual([women.brandId, kids.brandId].sort());
    expect(ids(await find(c, { cityIds: String(await ref.cityIdForName('Chennai')) }))).toEqual([kids.brandId]);
    expect(ids(await find(c, { aims: 'conversion' }))).toEqual([women.brandId]);
    expect(ids(await find(c, { modes: 'shipment' }))).toEqual([kids.brandId]);
  });

  it('sorts: newest (approved_at, else created_at) · A–Z · most products; search by name', async () => {
    const c = await creator();
    const zed = await brand({ business_name: 'Zed Wear', approvedAt: days(1) });
    const alpha = await brand({ business_name: 'Alpha Threads', approvedAt: days(9) });
    const mid = await brand({ business_name: 'Mid Fashion' });
    await query(`UPDATE users SET created_at = now() - interval '30 days' WHERE id = $1`, [mid.userId]);
    await product(alpha.brandId); await product(alpha.brandId); await product(zed.brandId);
    expect(ids(await find(c, { sort: 'newest' }))).toEqual([zed.brandId, alpha.brandId, mid.brandId]);
    expect(ids(await find(c, { sort: 'az' }))).toEqual([alpha.brandId, mid.brandId, zed.brandId]);
    expect(ids(await find(c, { sort: 'products' }))).toEqual([alpha.brandId, zed.brandId, mid.brandId]);
    expect(ids(await find(c, { search: 'alpha' }))).toEqual([alpha.brandId]);
    const cnt = await find(c, { countOnly: '1' });
    expect(cnt.body.data.total).toBe(3);
  });

  it('a brand cannot call it; a creator with no invitation row still gets an answer', async () => {
    const b = await brand();
    expect((await api.get('/influencers/me/find-brands', b.token)).status).toBe(403);
    const c = await creator();
    await query(`DELETE FROM creator_invitation_settings WHERE influencer_id = $1`, [c.influencerId]);
    expect((await find(c)).status).toBe(200);
  });
});
