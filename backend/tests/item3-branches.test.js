'use strict';

/**
 * Item 3 — branches (A4/A5) and place resolution (D3): the first branch is main, a Google
 * address resolves to a canonical state + city, a new city is added, a state alias maps,
 * an unknown state adds nothing and is logged, the main branch can't be removed, and
 * /brands/me reports the main city. Contract: features/item3-discovery-profiles-groups
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, mockPlaces, PLACE, api } = require('./helpers/item3');

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

  it('create requires a name and an address with the exact messages', async () => {
    const b = await brand();
    let r = await api.post('/brands/me/branches', b.token, { place_id: 'x' });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('name');
    expect(r.body.error.message).toBe('Enter a branch name.');
    r = await api.post('/brands/me/branches', b.token, { name: 'Second store' });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('place_id');
    expect(r.body.error.message).toBe('Search and pick your branch address.');
  });

  it('create resolves the address: known city → no new city; a new city is added once with source=google (check 8)', async () => {
    mockPlaces({ hyd: PLACE.hyd, newc: PLACE.newCity });
    const b = await brand();
    const before = (await query(`SELECT count(*)::int AS n FROM ref_cities`)).rows[0].n;
    let r = await api.post('/brands/me/branches', b.token, { name: 'Banjara Hills', place_id: 'hyd' });
    expect(r.status).toBe(201);
    expect(r.body.data.cityAdded).toBe(false);
    expect(r.body.data.branch).toMatchObject({ name: 'Banjara Hills', cityName: 'Hyderabad', stateName: 'Telangana', pincode: '500034', isMain: false });
    expect((await query(`SELECT count(*)::int AS n FROM ref_cities`)).rows[0].n).toBe(before);

    r = await api.post('/brands/me/branches', b.token, { name: 'Ongolu', place_id: 'newc' });
    expect(r.status).toBe(201);
    expect(r.body.data.cityAdded).toBe(true);
    expect(r.body.data.branch.cityName).toBe('Ongolu Town');
    const { rows } = await query(`SELECT source FROM ref_cities WHERE name = 'Ongolu Town'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('google');
    // The same address again does not add a second row.
    r = await api.post('/brands/me/branches', b.token, { name: 'Ongolu 2', place_id: 'newc' });
    expect(r.body.data.cityAdded).toBe(false);
    expect((await query(`SELECT count(*)::int AS n FROM ref_cities WHERE name = 'Ongolu Town'`)).rows[0].n).toBe(1);
  });

  it('a state alias maps ("NCT of Delhi" → Delhi) and the state count never grows (check 29)', async () => {
    mockPlaces({ d: PLACE.delhi });
    const b = await brand();
    const states = (await query(`SELECT count(*)::int AS n FROM ref_states`)).rows[0].n;
    expect(states).toBe(36);
    const r = await api.post('/brands/me/branches', b.token, { name: 'CP', place_id: 'd' });
    expect(r.status).toBe(201);
    expect(r.body.data.branch.stateName).toBe('Delhi');
    expect((await query(`SELECT count(*)::int AS n FROM ref_states`)).rows[0].n).toBe(36);
  });

  it('an unresolvable state → 422 STATE_UNKNOWN with the exact message; nothing added; raw state logged for admin (check 29)', async () => {
    mockPlaces({ sg: PLACE.unknownState });
    const b = await brand();
    const before = await query(`SELECT (SELECT count(*) FROM ref_states)::int AS s, (SELECT count(*) FROM ref_cities)::int AS c, (SELECT count(*) FROM brand_branches WHERE brand_id=$1)::int AS b`, [b.brandId]);
    const r = await api.post('/brands/me/branches', b.token, { name: 'Overseas', place_id: 'sg' });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('STATE_UNKNOWN');
    expect(r.body.error.message).toBe("We couldn't match this address to a state. Try a nearby address.");
    const after = await query(`SELECT (SELECT count(*) FROM ref_states)::int AS s, (SELECT count(*) FROM ref_cities)::int AS c, (SELECT count(*) FROM brand_branches WHERE brand_id=$1)::int AS b`, [b.brandId]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    const { rows } = await query(`SELECT raw_state, raw_city, place_id FROM ref_unknown_states`);
    expect(rows).toEqual([{ raw_state: 'Central Region', raw_city: 'Singapore', place_id: 'sg' }]);
  });

  it('POST /places/resolve answers the app directly and is rate-limited at 60 a minute per user', async () => {
    mockPlaces({ hyd: PLACE.hyd });
    const b = await brand();
    const r = await api.post('/places/resolve', b.token, { place_id: 'hyd' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ placeId: 'hyd', pincode: '500034', state: { name: 'Telangana' }, city: { name: 'Hyderabad', added: false } });
    let last;
    for (let i = 0; i < 60; i += 1) last = await api.post('/places/resolve', b.token, { place_id: 'hyd' });
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('RATE_LIMITED');
    const nf = await api.post('/places/resolve', b.token, { place_id: 'nope' });
    expect([404, 429]).toContain(nf.status);
  });

  it('make-main moves the flag; exactly one main; users.city follows the main branch', async () => {
    mockPlaces({ d: PLACE.delhi });
    const b = await brand({ city: 'Hyderabad', state: 'Telangana' });
    const r = await api.post('/brands/me/branches', b.token, { name: 'CP', place_id: 'd' });
    const id = r.body.data.branch.id;
    const m = await api.post(`/brands/me/branches/${id}/make-main`, b.token);
    expect(m.status).toBe(200);
    const { rows } = await query(`SELECT name, is_main FROM brand_branches WHERE brand_id = $1 ORDER BY is_main DESC`, [b.brandId]);
    expect(rows.filter(x => x.is_main)).toHaveLength(1);
    expect(rows[0].name).toBe('CP');
    const u = await query(`SELECT city, state FROM users WHERE id = $1`, [b.userId]);
    expect(u.rows[0]).toEqual({ city: 'New Delhi', state: 'Delhi' });
    const me = await api.get('/brands/me', b.token);
    expect(me.body.data.mainCity.name).toBe('New Delhi');
  });

  it('the main branch cannot be removed (exact message); another branch can; another brand cannot touch it', async () => {
    mockPlaces({ hyd: PLACE.hyd });
    const b = await brand();
    const other = await brand();
    const main = (await api.get('/brands/me/branches', b.token)).body.data.branches.find(x => x.isMain);
    let r = await api.del(`/brands/me/branches/${main.id}`, b.token);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe("The main branch can't be removed. Make another branch the main one first.");
    const second = (await api.post('/brands/me/branches', b.token, { name: 'Two', place_id: 'hyd' })).body.data.branch;
    r = await api.del(`/brands/me/branches/${second.id}`, other.token);
    expect(r.status).toBe(404);
    r = await api.del(`/brands/me/branches/${second.id}`, b.token);
    expect(r.status).toBe(200);
    expect((await api.get('/brands/me/branches', b.token)).body.data.branches).toHaveLength(1);
  });

  it('update renames, re-addresses and can promote to main in one call', async () => {
    mockPlaces({ hyd: PLACE.hyd, d: PLACE.delhi });
    const b = await brand();
    const second = (await api.post('/brands/me/branches', b.token, { name: 'Two', place_id: 'hyd' })).body.data.branch;
    let r = await api.put(`/brands/me/branches/${second.id}`, b.token, { name: '' });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe('Enter a branch name.');
    r = await api.put(`/brands/me/branches/${second.id}`, b.token, { name: 'Delhi store', place_id: 'd', is_main: true });
    expect(r.status).toBe(200);
    expect(r.body.data.branch).toMatchObject({ name: 'Delhi store', cityName: 'New Delhi', stateName: 'Delhi', isMain: true });
    expect((await query(`SELECT count(*)::int AS n FROM brand_branches WHERE brand_id=$1 AND is_main`, [b.brandId])).rows[0].n).toBe(1);
  });

  it('a creator cannot read or write branches', async () => {
    const { creator } = require('./helpers/item3');
    const c = await creator();
    expect((await api.get('/brands/me/branches', c.token)).status).toBe(403);
    expect((await api.post('/brands/me/branches', c.token, { name: 'x', place_id: 'y' })).status).toBe(403);
  });
});
