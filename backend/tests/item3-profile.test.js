'use strict';

/**
 * Item 3 — the two profiles: brand business details (A2), links, logo checks, the login
 * phone; the creator's profile info (A8) with the Google city and the 5 MB photo check.
 * Contract: features/item3-discovery-profiles-groups · prompt §7 messages
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, creator, mockPlaces, PLACE, api } = require('./helpers/item3');
const storage = require('../src/services/storage.service');

beforeEach(async () => { await truncateAll(); await resetReference(); });
afterEach(() => jest.restoreAllMocks());

describe('A2 — brand business details', () => {
  it('validates name, contact person and about with the exact messages', async () => {
    const b = await brand();
    let r = await api.patch('/brands/me', b.token, { business_name: '  ' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('business_name'); expect(r.body.error.message).toBe('Enter your brand name.');
    r = await api.patch('/brands/me', b.token, { contact_person: '' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('contact_person'); expect(r.body.error.message).toBe('Enter a contact person.');
    r = await api.patch('/brands/me', b.token, { about: 'x'.repeat(201) });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('about'); expect(r.body.error.message).toBe('Keep it under 200 characters.');
    r = await api.patch('/brands/me', b.token, { business_name: 'Urban Threads', contact_person: 'Kiran Rao', about: 'x'.repeat(200), gstin: '36ABCDE1234F1Z5' });
    expect(r.status).toBe(200);
    const me = await api.get('/brands/me', b.token);
    expect(me.body.data.brand).toMatchObject({ business_name: 'Urban Threads', contact_person: 'Kiran Rao', gstin: '36ABCDE1234F1Z5' });
    expect(me.body.data.brand.about).toHaveLength(200);
  });

  it('/brands/me carries the login phone separately from the business phone (the shadowing fix)', async () => {
    const b = await brand();
    await query(`UPDATE brands SET phone = '+911234567890' WHERE id = $1`, [b.brandId]);
    const me = await api.get('/brands/me', b.token);
    const { rows: [u] } = await query(`SELECT phone FROM users WHERE id = $1`, [b.userId]);
    expect(me.body.data.brand.login_phone).toBe(u.phone);
    expect(me.body.data.brand.phone).toBe(u.phone);
    expect(me.body.data.brand.business_phone).toBe('+911234567890');
  });

  it('links: instagram handle is normalised from @name or a URL; website saved as typed', async () => {
    const b = await brand();
    let r = await api.patch('/brands/me', b.token, { instagram_handle: 'https://www.instagram.com/Urban.Threads/', website_url: 'https://urbanthreads.in' });
    expect(r.status).toBe(200);
    const me = await api.get('/brands/me', b.token);
    expect(me.body.data.brand.instagram_handle).toBe('urban.threads');
    expect(me.body.data.brand.website_url).toBe('https://urbanthreads.in');
    r = await api.patch('/brands/me', b.token, { instagram_handle: null, website_url: null });
    expect(r.status).toBe(200);
    expect((await api.get('/brands/me', b.token)).body.data.brand.instagram_handle).toBeNull();
  });

  it('logo: the stored object must be a JPG/PNG under 5 MB (server re-check, founder Q16); null removes it', async () => {
    const b = await brand();
    const { rows: [a] } = await query(
      `INSERT INTO brand_media_assets (brand_id, title, file_r2_key, file_name, file_type, file_size_bytes) VALUES ($1,'Brand logo',$2,'logo.png','image/png',1000) RETURNING id`,
      [b.brandId, `brands/${b.brandId}/assets/logo.png`]);
    const head = jest.spyOn(storage, 'headObject');
    head.mockResolvedValueOnce({ size: 6 * 1024 * 1024, contentType: 'image/png' });
    let r = await api.patch('/brands/me', b.token, { logo_asset_id: a.id });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe('Upload a JPG or PNG under 5 MB.');
    head.mockResolvedValueOnce({ size: 1000, contentType: 'image/gif' });
    r = await api.patch('/brands/me', b.token, { logo_asset_id: a.id });
    expect(r.status).toBe(422);
    head.mockResolvedValueOnce({ size: 1000, contentType: 'image/png' });
    r = await api.patch('/brands/me', b.token, { logo_asset_id: a.id });
    expect(r.status).toBe(200);
    expect((await api.get('/brands/me', b.token)).body.data.brand.logo_url).toBeTruthy();
    // Another brand's asset is refused.
    const other = await brand();
    head.mockResolvedValueOnce({ size: 1000, contentType: 'image/png' });
    expect((await api.patch('/brands/me', other.token, { logo_asset_id: a.id })).status).toBe(422);
    r = await api.patch('/brands/me', b.token, { logo_asset_id: null });
    expect(r.status).toBe(200);
    expect((await api.get('/brands/me', b.token)).body.data.brand.logo_url).toBeNull();
  });

  it('sub-categories: at least one; unknown codes refused', async () => {
    const b = await brand();
    expect((await api.patch('/brands/me', b.token, { sub_categories: [] })).status).toBe(422);
    expect((await api.patch('/brands/me', b.token, { sub_categories: ['SOCKS'] })).status).toBe(422);
    expect((await api.patch('/brands/me', b.token, { sub_categories: ['KIDS', 'FOOTWEAR'] })).status).toBe(200);
    const me = await api.get('/brands/me', b.token);
    expect(me.body.data.brand.sub_categories).toEqual(['KIDS', 'FOOTWEAR']);
    expect(me.body.data.needsSubCategories).toBe(false);
  });
});

describe('A8 — creator profile info', () => {
  it('validates full name and bio with the exact messages; needsNiche and city names come back on /influencers/me', async () => {
    const c = await creator({ cityName: 'Hyderabad' });
    let r = await api.patch('/influencers/me', c.token, { full_name: ' ' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('full_name'); expect(r.body.error.message).toBe('Enter your full name.');
    r = await api.patch('/influencers/me', c.token, { bio: 'x'.repeat(151) });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('bio'); expect(r.body.error.message).toBe('Keep it under 150 characters.');
    r = await api.patch('/influencers/me', c.token, { full_name: 'Priya S', bio: 'Hello', youtube_handle: 'https://youtube.com/@PriyaVlogs' });
    expect(r.status).toBe(200);
    expect(r.body.data.influencer.youtube_handle).toBe('priyavlogs');
    const me = await api.get('/influencers/me', c.token);
    expect(me.body.data.influencer).toMatchObject({ full_name: 'Priya S', bio: 'Hello', city_name: 'Hyderabad', state_name: 'Telangana', needsNiche: false });
    await query(`UPDATE influencers SET niche = '{}' WHERE id = $1`, [c.influencerId]);
    expect((await api.get('/influencers/me', c.token)).body.data.influencer.needsNiche).toBe(true);
  });

  it('city through Google: resolves to a canonical city, adds a new one, keeps the typed columns in step, STATE_UNKNOWN adds nothing', async () => {
    mockPlaces({ d: PLACE.delhi, newc: PLACE.newCity, sg: PLACE.unknownState });
    const c = await creator();
    let r = await api.patch('/influencers/me', c.token, { place_id: 'd' });
    expect(r.status).toBe(200);
    expect(r.body.data.cityAdded).toBe(false);
    let { rows: [row] } = await query(`SELECT i.city, i.state, rc.name AS city_name FROM influencers i LEFT JOIN ref_cities rc ON rc.id = i.city_id WHERE i.id = $1`, [c.influencerId]);
    expect(row).toEqual({ city: 'New Delhi', state: 'Delhi', city_name: 'New Delhi' });
    const { rows: [u] } = await query(`SELECT city, state FROM users WHERE id = $1`, [c.userId]);
    expect(u).toEqual({ city: 'New Delhi', state: 'Delhi' });

    r = await api.patch('/influencers/me', c.token, { place_id: 'newc' });
    expect(r.body.data.cityAdded).toBe(true);
    expect((await query(`SELECT source FROM ref_cities WHERE name = 'Ongolu Town'`)).rows[0].source).toBe('google');

    const states = (await query(`SELECT count(*)::int AS n FROM ref_states`)).rows[0].n;
    r = await api.patch('/influencers/me', c.token, { place_id: 'sg' });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('STATE_UNKNOWN');
    expect(r.body.error.message).toBe("We couldn't match this address to a state. Try a nearby address.");
    expect((await query(`SELECT count(*)::int AS n FROM ref_states`)).rows[0].n).toBe(states);
    ({ rows: [row] } = await query(`SELECT city FROM influencers WHERE id = $1`, [c.influencerId]));
    expect(row.city).toBe('Ongolu Town');
    r = await api.patch('/influencers/me', c.token, { place_id: '' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('Search and pick your city.');
  });

  it('photo: only a JPG/PNG under 5 MB in her own folder is accepted as the profile image key', async () => {
    const c = await creator();
    const head = jest.spyOn(storage, 'headObject');
    const key = `creator-photos/${c.influencerId}/photo.jpg`;
    head.mockResolvedValueOnce({ size: 6 * 1024 * 1024, contentType: 'image/jpeg' });
    let r = await api.patch('/influencers/me', c.token, { profile_image_key: key });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe('Upload a JPG or PNG under 5 MB.');
    head.mockResolvedValueOnce({ size: 2000, contentType: 'image/jpeg' });
    r = await api.patch('/influencers/me', c.token, { profile_image_key: 'creator-photos/someone-else/photo.jpg' });
    expect(r.status).toBe(422);
    head.mockResolvedValueOnce({ size: 2000, contentType: 'image/jpeg' });
    r = await api.patch('/influencers/me', c.token, { profile_image_key: key });
    expect(r.status).toBe(200);
    const up = await api.post('/influencers/me/profile-image/upload-url', c.token, { content_type: 'image/gif' });
    expect(up.status).toBe(422);
  });
});
