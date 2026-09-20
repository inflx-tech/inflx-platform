'use strict';

/**
 * creator-distance-and-visit-preference — the coordinates, the distance order and filter, and
 * the Store Visit preference rule. Contract: features/creator-distance-and-visit-preference
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, creator, setCreatorInvite, api } = require('./helpers/item3');
const eligibility = require('../src/services/collabEligibility.service');

beforeEach(async () => { await truncateAll(); await resetReference(); });

const cityId = async (name) => (await query(`SELECT id FROM ref_cities WHERE name = $1 ORDER BY id LIMIT 1`, [name])).rows[0].id;
const placeCreator = async (c, city) => { const id = await cityId(city); await query(`UPDATE influencers SET city_id = $2, city = $3 WHERE id = $1`, [c.influencerId, id, city]); return id; };

describe('the coordinates (item 1)', () => {
  it('every offered city has a centre; nothing outside the six does; Vijayawada→Guntur is about 30 km', async () => {
    const { rows: [n] } = await query(`SELECT count(*)::int AS offered, count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL)::int AS with_coords FROM ref_cities WHERE is_offered`);
    expect(n).toEqual({ offered: 146, with_coords: 146 });
    const { rows: [o] } = await query(`SELECT count(*)::int AS n FROM ref_cities WHERE NOT is_offered AND lat IS NOT NULL`);
    expect(o.n).toBe(0);
    const { rows: [d] } = await query(`SELECT round(6371 * acos(least(1, cos(radians(a.lat))*cos(radians(b.lat))*cos(radians(b.lng)-radians(a.lng)) + sin(radians(a.lat))*sin(radians(b.lat)))))::int AS km FROM ref_cities a, ref_cities b WHERE a.name = 'Vijayawada' AND b.name = 'Guntur'`);
    expect(d.km).toBeGreaterThan(25); expect(d.km).toBeLessThan(40);
  });
});

describe('nearest first (item 2)', () => {
  it('Discover orders from the main branch city outward, shows the km, puts no-city creators last; the within filter narrows', async () => {
    const b = await brand({ city: 'Vijayawada', state: 'Andhra Pradesh' });
    const near = await creator({ name: 'Priya Vijayawada' });  await placeCreator(near, 'Vijayawada');
    const mid = await creator({ name: 'Ananya Guntur' });      await placeCreator(mid, 'Guntur');
    const far = await creator({ name: 'Nikhil Hyderabad' });   await placeCreator(far, 'Hyderabad');
    const nowhere = await creator({ name: 'Jyoti Nowhere' });  await query(`UPDATE influencers SET city_id = NULL, city = NULL WHERE id = $1`, [nowhere.influencerId]);
    let r = await api.get('/brands/me/discover-creators', b.token);
    expect(r.status).toBe(200);
    const names = r.body.data.rows.map(x => x.name);
    expect(names).toEqual(['Priya Vijayawada', 'Ananya Guntur', 'Nikhil Hyderabad', 'Jyoti Nowhere']);
    const km = Object.fromEntries(r.body.data.rows.map(x => [x.name, x.distanceKm]));
    expect(km['Priya Vijayawada']).toBe(0);
    expect(km['Ananya Guntur']).toBeGreaterThan(25); expect(km['Ananya Guntur']).toBeLessThan(40);
    expect(km['Nikhil Hyderabad']).toBeGreaterThan(240); expect(km['Nikhil Hyderabad']).toBeLessThan(300);
    expect(km['Jyoti Nowhere']).toBeNull();

    r = await api.get('/brands/me/discover-creators?within=50', b.token);
    expect(r.body.data.rows.map(x => x.name)).toEqual(['Priya Vijayawada', 'Ananya Guntur']);
    r = await api.get('/brands/me/discover-creators?within=state', b.token);
    expect(r.body.data.rows.map(x => x.name)).toEqual(['Priya Vijayawada', 'Ananya Guntur']);   // Hyderabad is Telangana
    r = await api.get('/brands/me/discover-creators?within=100', b.token);
    expect(r.body.data.total).toBe(2);
    // the other sorts still work
    r = await api.get('/brands/me/discover-creators?sort=newest', b.token);
    expect(r.status).toBe(200); expect(r.body.data.rows).toHaveLength(4);
  });

  it('a brand with no main-branch city gets the reach order and no distances', async () => {
    const b = await brand();
    await query(`UPDATE brand_branches SET city_id = NULL WHERE brand_id = $1`, [b.brandId]);
    const c = await creator(); await placeCreator(c, 'Guntur');
    const r = await api.get('/brands/me/discover-creators', b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.rows[0].distanceKm).toBeNull();
    expect((await api.get('/brands/me/discover-creators?within=50', b.token)).body.data.total).toBe(0);
  });
});

describe('Store Visit follows her preference (item 3)', () => {
  const visitSet = { goal: 'engagement', shoot_mode: 'visit' };

  it('no cities picked → anyone anywhere may pick her; picked cities → only a branch in one of them', async () => {
    const hyd = await brand({ city: 'Hyderabad', state: 'Telangana' });
    const c = await creator(); await placeCreator(c, 'Guntur');
    // never saved anything → anywhere (the old default to her own city is gone)
    let v = await eligibility.canBrandInviteCreator({ brandId: hyd.brandId, influencerId: c.influencerId, set: visitSet });
    expect(v.ok).toBe(true);
    // saved with an empty list → still anywhere
    await setCreatorInvite(c.influencerId, { visitCityIds: [] });
    v = await eligibility.canBrandInviteCreator({ brandId: hyd.brandId, influencerId: c.influencerId, set: visitSet });
    expect(v.ok).toBe(true);
    // picked Guntur only → Hyderabad branch refused, Guntur branch allowed
    await setCreatorInvite(c.influencerId, { visitCityIds: [await cityId('Guntur')] });
    v = await eligibility.canBrandInviteCreator({ brandId: hyd.brandId, influencerId: c.influencerId, set: visitSet });
    expect(v).toMatchObject({ ok: false, reason: 'NOT_MATCHING' });
    const gnt = await brand({ city: 'Guntur', state: 'Andhra Pradesh' });
    v = await eligibility.canBrandInviteCreator({ brandId: gnt.brandId, influencerId: c.influencerId, set: visitSet });
    expect(v.ok).toBe(true);
    // Remote is never city-bound
    v = await eligibility.canBrandInviteCreator({ brandId: hyd.brandId, influencerId: c.influencerId, set: { goal: 'engagement', shoot_mode: 'shipment' } });
    expect(v.ok).toBe(true);
  });

  it('the set picker\'s batch path agrees: a never-saved creator elsewhere is OK for a Store Visit; only picked cities limit (founder, 20 Sep — the batch loader had kept the old default)', async () => {
    const hyd = await brand({ city: 'Hyderabad', state: 'Telangana' });
    const a = await creator({ name: 'Never saved, Guntur' }); await placeCreator(a, 'Guntur');
    const b = await creator({ name: 'Picked Guntur only' }); await placeCreator(b, 'Guntur');
    await setCreatorInvite(b.influencerId, { visitCityIds: [await cityId('Guntur')] });
    const c = await creator({ name: 'Picked Hyderabad' }); await placeCreator(c, 'Vijayawada');
    await setCreatorInvite(c.influencerId, { visitCityIds: [await cityId('Hyderabad')] });
    const { rows: [branch] } = await query(`SELECT id FROM brand_branches WHERE brand_id = $1 AND is_main`, [hyd.brandId]);
    const set = { goal: 'engagement', shoot_mode: 'visit', branch_id: branch.id };
    const out = await eligibility.canBrandInviteMany({ brandId: hyd.brandId, set, creators: [a, b, c].map(x => ({ influencerId: x.influencerId })) });
    const byId = Object.fromEntries(out.map(o => [o.influencerId, o]));
    expect(byId[a.influencerId].ok).toBe(true);
    expect(byId[b.influencerId]).toMatchObject({ ok: false, reason: 'NOT_MATCHING' });
    expect(byId[c.influencerId].ok).toBe(true);
  });

  it('her settings read back with an empty list and no defaulted flag', async () => {
    const c = await creator();
    const r = await api.get('/influencers/me/invitation-settings', c.token);
    expect(r.status).toBe(200);
    const s = r.body.data.settings || r.body.data;
    expect(s.visitCityIds || s.visit_city_ids).toEqual([]);
  });
});
