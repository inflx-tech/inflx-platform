'use strict';

/**
 * Item 3 — branches (A4/A5): the first branch is main, the main branch can't be removed, and
 * /brands/me reports the main city. Contract: features/item3-discovery-profiles-groups
 * registration-and-profile (18 Sep 2026): Google place resolution retired; every address is the
 * four parts, and the second branch must say which is main.
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, api } = require('./helpers/item3');

beforeEach(async () => { await truncateAll(); await resetReference(); });
afterEach(() => jest.restoreAllMocks());

describe('A4 · A5 — branches', () => {
  it('registration seeds a Main Branch from the typed city; /brands/me reports mainCity and needsMainCity=false', async () => {
    const b = await brand({ city: 'Hyderabad', state: 'Telangana' });
    const me = await api.get('/brands/me', b.token);
    expect(me.status).toBe(200);
    expect(me.body.data.branches).toHaveLength(1);
    expect(me.body.data.branches[0].isMain).toBe(true);
    expect(me.body.data.mainCity.name).toBe('Hyderabad');
    expect(me.body.data.needsMainCity).toBe(false);
  });

  it('a brand whose only branch has no city gets needsMainCity=true (the A1 orange reminder)', async () => {
    const b = await brand();
    await query(`UPDATE brand_branches SET city_id = NULL WHERE brand_id = $1`, [b.brandId]);
    const me = await api.get('/brands/me', b.token);
    expect(me.body.data.mainCity).toBeNull();
    expect(me.body.data.needsMainCity).toBe(true);
  });

  // registration-and-profile §1.1, §4, §9: every address is four parts — street, pincode, state,
  // city — and the Google place search is gone. The second branch must say which is main.
  const four = async (over = {}) => {
    const { rows: [c] } = await query(`SELECT c.id AS city_id, c.state_id FROM ref_cities c JOIN ref_states s ON s.id = c.state_id WHERE s.name = $1 AND c.name = $2`,
      [over.state || 'Telangana', over.city || 'Hyderabad']);
    return { name: over.name || 'Two', address_text: over.address_text || 'Plot 8, Road No. 36', pincode: over.pincode || '500033', state_id: c.state_id, city_id: c.city_id, ...(over.is_main === undefined ? {} : { is_main: over.is_main }) };
  };

  it('create requires a name, a street, a 6-digit pincode and a picked city with the exact messages', async () => {
    const b = await brand();
    let r = await api.post('/brands/me/branches', b.token, { address_text: 'x' });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('name');
    expect(r.body.error.message).toBe('Enter a branch name.');
    r = await api.post('/brands/me/branches', b.token, { name: 'Second store' });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('address_text');
    expect(r.body.error.message).toBe('Enter the street address.');
    r = await api.post('/brands/me/branches', b.token, { name: 'Second store', place_id: 'hyd' });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('address_text');
    r = await api.post('/brands/me/branches', b.token, { name: 'Second store', address_text: 'Plot 8, Road No. 36' });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('pincode');
    expect(r.body.error.message).toBe('Enter a 6-digit PIN code.');
    r = await api.post('/brands/me/branches', b.token, { name: 'Second store', address_text: 'Plot 8, Road No. 36', pincode: '500033' });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('city_id');
    // features/courier-ready-addresses (founder, 7 Oct 2026): the field is simply "City".
    expect(r.body.error.message).toBe('Pick the state, then the city.');
  });

  it('create stores the four parts, adds no city and no coordinates; a city outside its state is refused (check 8)', async () => {
    const b = await brand();
    const before = (await query(`SELECT count(*)::int AS n FROM ref_cities`)).rows[0].n;
    let r = await api.post('/brands/me/branches', b.token, await four({ name: 'Banjara Hills', is_main: false }));
    expect(r.status).toBe(201);
    expect(r.body.data.cityAdded).toBe(false);
    expect(r.body.data.branch).toMatchObject({ name: 'Banjara Hills', cityName: 'Hyderabad', stateName: 'Telangana', pincode: '500033', formattedAddress: 'Plot 8, Road No. 36', isMain: false, googlePlaceId: null, lat: null, lng: null });
    expect((await query(`SELECT count(*)::int AS n FROM ref_cities`)).rows[0].n).toBe(before);
    const wrong = await four({ state: 'Kerala', city: 'Kochi' });
    const { rows: [tg] } = await query(`SELECT id FROM ref_states WHERE name = 'Telangana'`);
    r = await api.post('/brands/me/branches', b.token, { ...wrong, state_id: tg.id });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('city_id');
    expect((await query(`SELECT count(*)::int AS n FROM ref_states`)).rows[0].n).toBe(36);
  });

  it('the second branch must say which one is main — never assumed (spec §4)', async () => {
    const b = await brand();
    let r = await api.post('/brands/me/branches', b.token, await four());
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('is_main');
    expect(r.body.error.message).toBe('Which one is your main branch?');
    expect((await api.get('/brands/me/branches', b.token)).body.data.branches).toHaveLength(1);
    r = await api.post('/brands/me/branches', b.token, await four({ is_main: true }));
    expect(r.status).toBe(201);
    expect(r.body.data.branch.isMain).toBe(true);
    const list = (await api.get('/brands/me/branches', b.token)).body.data.branches;
    expect(list.filter(x => x.isMain).map(x => x.name)).toEqual(['Two']);
    // the third needs no answer and is not main
    r = await api.post('/brands/me/branches', b.token, await four({ name: 'Three', state: 'Kerala', city: 'Kochi', pincode: '682001' }));
    expect(r.status).toBe(201);
    expect(r.body.data.branch.isMain).toBe(false);
  });

  it('POST /places/resolve is gone', async () => {
    const b = await brand();
    expect((await api.post('/places/resolve', b.token, { place_id: 'hyd' })).status).toBe(404);
  });

  it('make-main moves the flag; exactly one main; users.city follows the main branch', async () => {
    const b = await brand({ city: 'Hyderabad', state: 'Telangana' });
    const r = await api.post('/brands/me/branches', b.token, await four({ name: 'Kochi store', state: 'Kerala', city: 'Kochi', pincode: '682001', is_main: false }));
    const id = r.body.data.branch.id;
    const m = await api.post(`/brands/me/branches/${id}/make-main`, b.token);
    expect(m.status).toBe(200);
    const { rows } = await query(`SELECT name, is_main FROM brand_branches WHERE brand_id = $1 ORDER BY is_main DESC`, [b.brandId]);
    expect(rows.filter(x => x.is_main)).toHaveLength(1);
    expect(rows[0].name).toBe('Kochi store');
    const u = await query(`SELECT city, state FROM users WHERE id = $1`, [b.userId]);
    expect(u.rows[0]).toEqual({ city: 'Kochi', state: 'Kerala' });
    const me = await api.get('/brands/me', b.token);
    expect(me.body.data.mainCity.name).toBe('Kochi');
  });

  it('the main branch cannot be removed (exact message); another branch can; another brand cannot touch it', async () => {
    const b = await brand();
    const other = await brand();
    const main = (await api.get('/brands/me/branches', b.token)).body.data.branches.find(x => x.isMain);
    let r = await api.del(`/brands/me/branches/${main.id}`, b.token);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe("The main branch can't be removed. Make another branch the main one first.");
    const second = (await api.post('/brands/me/branches', b.token, await four({ is_main: false }))).body.data.branch;
    r = await api.del(`/brands/me/branches/${second.id}`, other.token);
    expect(r.status).toBe(404);
    r = await api.del(`/brands/me/branches/${second.id}`, b.token);
    expect(r.status).toBe(200);
    expect((await api.get('/brands/me/branches', b.token)).body.data.branches).toHaveLength(1);
  });

  it('update renames, re-addresses part by part and can promote to main in one call', async () => {
    const b = await brand();
    const second = (await api.post('/brands/me/branches', b.token, await four({ is_main: false }))).body.data.branch;
    let r = await api.put(`/brands/me/branches/${second.id}`, b.token, { name: '' });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe('Enter a branch name.');
    r = await api.put(`/brands/me/branches/${second.id}`, b.token, { pincode: '12' });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('pincode');
    const kochi = await four({ state: 'Kerala', city: 'Kochi' });
    r = await api.put(`/brands/me/branches/${second.id}`, b.token, { name: 'Kochi store', address_text: '12 MG Road, Ernakulam', pincode: '682001', state_id: kochi.state_id, city_id: kochi.city_id, is_main: true });
    expect(r.status).toBe(200);
    expect(r.body.data.branch).toMatchObject({ name: 'Kochi store', formattedAddress: '12 MG Road, Ernakulam', pincode: '682001', cityName: 'Kochi', stateName: 'Kerala', isMain: true });
    expect((await query(`SELECT count(*)::int AS n FROM brand_branches WHERE brand_id=$1 AND is_main`, [b.brandId])).rows[0].n).toBe(1);
    // the street alone keeps the pincode; the city alone keeps the street
    r = await api.put(`/brands/me/branches/${second.id}`, b.token, { address_text: '3 Marine Drive, Kochi' });
    expect(r.body.data.branch).toMatchObject({ formattedAddress: '3 Marine Drive, Kochi', pincode: '682001', cityName: 'Kochi' });
  });

  it('a creator cannot read or write branches', async () => {
    const { creator } = require('./helpers/item3');
    const c = await creator();
    expect((await api.get('/brands/me/branches', c.token)).status).toBe(403);
    expect((await api.post('/brands/me/branches', c.token, { name: 'x', address_text: 'y' })).status).toBe(403);
  });
});
