'use strict';

/**
 * registration-and-profile — checks 1–37 of 03-expected-outputs.md.
 * Contract: features/registration-and-profile
 *
 * The lists, registration with ids, the profile fields, completeness and submission, the
 * creator gate, the four-part branch, the Other-niche queue, the agreement fields.
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, creator, api, collab, rnd } = require('./helpers/item3');
const { createBrandUser, createInfluencerUser, createAdminUser, registerBrand, registerInfluencer, completeCreatorProfile, completeBrandProfile } = require('./helpers/factories');
const ref = require('../src/services/referenceLists.service');
const storage = require('../src/services/storage.service');
const terms = require('../src/services/agreementTerms.service');
const { encrypt } = require('../src/utils/encrypt');

beforeEach(async () => { await truncateAll(); await resetReference(); });
afterEach(() => jest.restoreAllMocks());
// the Other-queue check adds a niche; reference rows survive truncateAll, so hand the next suite a clean list
afterEach(() => resetReference());

const ids = async (stateName, cityName) => {
  const { rows: [s] } = await query(`SELECT id FROM ref_states WHERE name = $1`, [stateName]);
  const { rows: [c] } = await query(`SELECT id FROM ref_cities WHERE state_id = $1 AND name = $2`, [s.id, cityName]);
  return { state_id: s.id, city_id: c.id };
};

describe('The lists (checks 1–4)', () => {
  it('offered states: six, 146 cities, none outside the six; the full list still serves everything', async () => {
    const c = await creator();
    const r = await api.get('/reference/states?offered=1', c.token);
    expect(r.status).toBe(200);
    expect(r.body.data.items.map(s => s.name)).toEqual(['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Puducherry']);
    expect(r.body.data.items.reduce((a, s) => a + s.cities.length, 0)).toBe(146);
    const tg = r.body.data.items.find(s => s.name === 'Telangana');
    expect(tg.cities).toHaveLength(33);
    expect(tg.cities[0].name).toBe('Hyderabad');
    const all = await api.get('/reference/states', c.token);
    expect(all.body.data.items.length).toBeGreaterThanOrEqual(36);
    expect(all.body.data.items.find(s => s.name === 'Maharashtra').cities.map(x => x.name)).toContain('Mumbai');
    // the renamed East Godavari headquarters appears once, under its founder-approved spelling
    const ap = r.body.data.items.find(s => s.name === 'Andhra Pradesh');
    expect(ap.cities.map(x => x.name)).toContain('Rajamahendravaram');
    expect(ap.cities.map(x => x.name)).not.toContain('Rajahmundry');
  });

  it('30 languages in the founder order, no Sanskrit; 21 niches with other last', async () => {
    const c = await creator();
    const l = await api.get('/reference/languages', c.token);
    expect(l.body.data.items).toHaveLength(30);
    expect(l.body.data.items.slice(0, 3).map(x => x.code)).toEqual(['English', 'Hindi', 'Telugu']);
    expect(l.body.data.items.map(x => x.code.toLowerCase())).not.toContain('sanskrit');
    const n = await api.get('/reference/creator-niches', c.token);
    expect(n.body.data.items).toHaveLength(21);
    expect(n.body.data.items[n.body.data.items.length - 1].code).toBe('other');
  });
});

describe('Registration (checks 5–10)', () => {
  it('brand: ids resolve to names on the users row and to ids on the main branch; nothing Google is stored (5, 7)', async () => {
    const { token, user } = await createBrandUser();
    const p = await ids('Karnataka', 'Mysuru');
    const r = await api.post('/brands/register', token, {
      name: 'Ravi Kumar', business_name: 'Label Fern', sub_categories: ['WOMEN', 'FOOTWEAR'], address_line: 'Shop 12, Road No. 4', pincode: '570001',
      ...p, latitude: 12.3, longitude: 76.6, google_maps_url: 'https://maps.app.goo.gl/x', referral_code: 'ABC', locality: 'Nope', gstin: '29X',
    });
    expect(r.status).toBe(201);
    expect(r.body.data.user_status).toBe('pending');
    expect(r.body.data.completeness).toMatchObject({ total: 10, done: 7, complete: false });
    expect(r.body.data.completeness.missing).toEqual(['logo', 'about', 'contact_person']);
    const { rows: [u] } = await query(`SELECT city, state FROM users WHERE id = $1`, [user.id]);
    expect(u).toEqual({ city: 'Mysuru', state: 'Karnataka' });
    const { rows: [b] } = await query(`SELECT lat, lng, latitude, locality, gstin FROM brands WHERE user_id = $1`, [user.id]);
    expect(b).toEqual({ lat: null, lng: null, latitude: null, locality: null, gstin: null });
    const me = await api.get('/brands/me', token);
    expect(me.body.data.branches[0]).toMatchObject({ isMain: true, cityId: p.city_id, stateId: p.state_id, cityName: 'Mysuru', formattedAddress: 'Shop 12, Road No. 4', pincode: '570001' });
    expect(me.body.data.brand.business_phone).toBeUndefined();
    expect(me.body.data.brand.login_phone).toBe(me.body.data.brand.phone);
  });

  it('brand: an unresolvable typed city, a city outside its state, a bad pincode (6, 8)', async () => {
    const { token } = await createBrandUser();
    const base = { name: 'R', business_name: 'B', sub_categories: ['WOMEN'], address_line: 'x', pincode: '500001' };
    let r = await api.post('/brands/register', token, { ...base, city: 'Atlantis', state: 'Telangana' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('city_id'); expect(r.body.error.details.fields[0].code).toBe('CITY_REQUIRED');
    const tg = await ids('Telangana', 'Warangal'); const ka = await ids('Karnataka', 'Mysuru');
    r = await api.post('/brands/register', token, { ...base, state_id: tg.state_id, city_id: ka.city_id });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('city_id');
    r = await api.post('/brands/register', token, { ...base, ...tg, pincode: '12' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('pincode');
    r = await api.post('/brands/register', token, { ...base });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('city_id');
  });

  it('creator: state and city required; ids and names written everywhere (9, 10)', async () => {
    const { token, user } = await createInfluencerUser();
    let r = await api.post('/influencers/register', token, { name: 'Priya', instagram_handle: 'priya_styles' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('city_id');
    const tg = await ids('Telangana', 'Hyderabad'); const kl = await ids('Kerala', 'Kochi');
    r = await api.post('/influencers/register', token, { name: 'Priya', instagram_handle: 'priya_styles', state_id: tg.state_id, city_id: kl.city_id });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('city_id');
    r = await api.post('/influencers/register', token, { name: 'Priya', instagram_handle: 'priya_styles', ...tg, referral_code: 'X' });
    expect(r.status).toBe(201);
    expect(r.body.data.completeness).toMatchObject({ done: 4, total: 10 });
    expect(r.body.data.completeness.missing).toEqual(['photo', 'bio', 'niche', 'language', 'age', 'gender']);
    const { rows: [i] } = await query(`SELECT city, state, city_id, state_id FROM influencers WHERE user_id = $1`, [user.id]);
    expect(i).toEqual({ city: 'Hyderabad', state: 'Telangana', city_id: tg.city_id, state_id: tg.state_id });
    const { rows: [u] } = await query(`SELECT city, state FROM users WHERE id = $1`, [user.id]);
    expect(u).toEqual({ city: 'Hyderabad', state: 'Telangana' });
  });
});

describe('Profile (checks 11–17)', () => {
  it('creator: age, gender, email, the two pickers; place_id ignored; /places/resolve gone (11, 14)', async () => {
    const c = await creator();
    const kl = await ids('Kerala', 'Kochi');
    let r = await api.patch('/influencers/me', c.token, { age: 24, gender: 'Female', email: ' Priya@Example.com ', ...kl, place_id: 'ChIJ-something' });
    expect(r.status).toBe(200);
    expect(r.body.data.influencer).toMatchObject({ age: 24, gender: 'female', email: 'priya@example.com', city_id: kl.city_id, state_id: kl.state_id, city_name: 'Kochi', state_name: 'Kerala' });
    const me = await api.get('/influencers/me', c.token);
    expect(me.body.data.influencer).toMatchObject({ city_name: 'Kochi', state_name: 'Kerala', age: 24, gender: 'female' });
    r = await api.patch('/influencers/me', c.token, { age: 7 }); expect(r.status).toBe(422); expect(r.body.error.field).toBe('age');
    r = await api.patch('/influencers/me', c.token, { gender: 'x' }); expect(r.status).toBe(422); expect(r.body.error.field).toBe('gender');
    r = await api.patch('/influencers/me', c.token, { email: 'nope' }); expect(r.status).toBe(422); expect(r.body.error.field).toBe('email');
    r = await api.patch('/influencers/me', c.token, { city: 'Typed Town' }); expect(r.status).toBe(422); expect(r.body.error.field).toBe('city_id');
    r = await api.post('/places/resolve', c.token, { place_id: 'x' }); expect(r.status).toBe(404);
  });

  it('creator: languages from the list of 30; Other needs its description and lands in the queue (12, 13)', async () => {
    const c = await creator();
    let r = await api.patch('/influencers/me', c.token, { language: ['Klingon'] });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('language');
    r = await api.patch('/influencers/me', c.token, { language: ['Telugu', 'Tulu'] });
    expect(r.status).toBe(200); expect(r.body.data.influencer.language).toEqual(['Telugu', 'Tulu']);
    r = await api.patch('/influencers/me', c.token, { niche: ['other'] });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('niche_other');
    r = await api.patch('/influencers/me', c.token, { niche: ['other'], niche_other: 'Pet & dog training' });
    expect(r.status).toBe(200); expect(r.body.data.influencer).toMatchObject({ niche: ['other'], niche_other: 'Pet & dog training' });
    expect(r.body.data.completeness.missing).not.toContain('niche');
    const admin = await createAdminUser('superadmin');
    const q = await api.get('/admin/niches/other', admin.token);
    expect(q.status).toBe(200);
    expect(q.body.data.items.map(x => x.influencer_id)).toEqual([c.influencerId]);
    expect(q.body.data.items[0]).toMatchObject({ niche_other: 'Pet & dog training', city_name: 'Hyderabad' });
    // picking a real niche later clears it
    r = await api.patch('/influencers/me', c.token, { niche: ['food'] });
    expect(r.body.data.influencer.niche_other).toBeNull();
    expect((await api.get('/admin/niches/other', admin.token)).body.data.items).toHaveLength(0);
  });

  it('brand: email, contact, about; the address rewrites the main branch; bank is one entry; Google fields ignored (15, 16, 17)', async () => {
    const b = await brand();
    let r = await api.patch('/brands/me', b.token, { email: 'Hi@Label.com', contact_person: 'Ravi', about: 'A label.' });
    expect(r.status).toBe(200);
    expect(r.body.data.brand).toMatchObject({ email: 'hi@label.com', contact_person: 'Ravi', about: 'A label.' });
    const tn = await ids('Tamil Nadu', 'Coimbatore');
    r = await api.patch('/brands/me', b.token, { address_line: 'Plot 8, Road 36', pincode: '641001', ...tn });
    expect(r.status).toBe(200);
    const me = await api.get('/brands/me', b.token);
    expect(me.body.data.mainCity).toMatchObject({ name: 'Coimbatore', stateName: 'Tamil Nadu' });
    expect(me.body.data.branches.find(x => x.isMain)).toMatchObject({ formattedAddress: 'Plot 8, Road 36', pincode: '641001', cityId: tn.city_id });
    expect(me.body.data.brand).toMatchObject({ city: 'Coimbatore', state: 'Tamil Nadu', address_line: 'Plot 8, Road 36', pincode: '641001' });
    r = await api.patch('/brands/me', b.token, { bank_account_no: '1234567890' });
    expect(r.status).toBe(422); expect(r.body.error.details.fields[0].code).toBe('BANK_PAIR');
    r = await api.patch('/brands/me', b.token, { bank_account_no: '1234 5678 90', bank_ifsc: 'hdfc0001234' });
    expect(r.status).toBe(200);
    expect(r.body.data.brand.has_bank_account).toBe(true);
    expect(r.body.data.brand.bank_ifsc).toBe('HDFC0001234');
    expect(r.body.data.brand.bank_account_no).toBeUndefined();
    const { rows: [row] } = await query(`SELECT bank_account_no FROM brands WHERE id = $1`, [b.brandId]);
    expect(row.bank_account_no).not.toBe('1234567890'); expect(row.bank_account_no).toContain(':');
    const before = (await query(`SELECT lat, lng, formatted_address FROM brands WHERE id = $1`, [b.brandId])).rows[0];
    r = await api.patch('/brands/me', b.token, { latitude: 1, longitude: 2, google_maps_url: 'https://maps.app.goo.gl/x', business_name: 'Same' });
    expect(r.status).toBe(200);
    expect((await query(`SELECT lat, lng, formatted_address FROM brands WHERE id = $1`, [b.brandId])).rows[0]).toEqual(before);
    r = await api.patch('/brands/me', b.token, { latitude: 1 });
    expect(r.status).toBe(422);
  });
});

describe('Completeness and submission (checks 18–27)', () => {
  it('creator: 6 of 10 done at registration; submit refused with the list; complete → submitted (18, 20)', async () => {
    const c = await creator({ status: 'pending' });
    await query(`UPDATE influencers SET niche = NULL, language = NULL WHERE id = $1`, [c.influencerId]);
    let me = await api.get('/influencers/me', c.token);
    expect(me.body.data.completeness).toMatchObject({ done: 4, total: 10, complete: false });
    expect(me.body.data.completeness.missing_labels).toEqual(['photo', 'bio', 'niche', 'a language', 'age', 'gender']);
    expect(me.body.data.submitted_for_review_at).toBeNull();
    let r = await api.post('/influencers/me/submit-for-review', c.token);
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('PROFILE_INCOMPLETE');
    expect(r.body.error.details.missing_labels).toEqual(['photo', 'bio', 'niche', 'a language', 'age', 'gender']);
    expect(r.body.error.message).toBe('Finish these first: photo, bio, niche, a language, age, gender.');
    await completeCreatorProfile(c.influencerId);
    me = await api.get('/influencers/me', c.token);
    expect(me.body.data.completeness.complete).toBe(true);
    r = await api.post('/influencers/me/submit-for-review', c.token);
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ user_status: 'pending', submitted: true });
    me = await api.get('/influencers/me', c.token);
    expect(me.body.data.submitted_for_review_at).toBeTruthy();
  });

  it('brand: 7 of 10; submit refused; complete → submitted; approved cannot submit (19, 21)', async () => {
    const b = await brand({ status: 'pending' });
    let me = await api.get('/brands/me', b.token);
    expect(me.body.data.completeness).toMatchObject({ done: 7, total: 10 });
    expect(me.body.data.completeness.missing_labels).toEqual(['logo', 'about', 'contact person']);
    let r = await api.post('/brands/me/submit-for-review', b.token);
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('PROFILE_INCOMPLETE');
    await completeBrandProfile(b.brandId);
    r = await api.post('/brands/me/submit-for-review', b.token);
    expect(r.status).toBe(200);
    expect((await api.get('/brands/me', b.token)).body.data.submitted_for_review_at).toBeTruthy();
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [b.userId]);
    r = await api.post('/brands/me/submit-for-review', b.token);
    expect(r.status).toBe(409);
  });

  it('rejected creator edits her form and submits again → pending, remarks cleared (22)', async () => {
    const c = await creator({ status: 'rejected' });
    await completeCreatorProfile(c.influencerId);
    await query(`UPDATE influencers SET rejection_reason = 'Handle mismatch' WHERE id = $1`, [c.influencerId]);
    let me = await api.get('/influencers/me', c.token);
    expect(me.body.data.rejection_reason).toBe('Handle mismatch');
    let r = await api.patch('/influencers/me', c.token, { full_name: 'Priya S' });
    expect(r.status).toBe(200);
    r = await api.post('/influencers/me/submit-for-review', c.token);
    expect(r.status).toBe(200);
    const { rows: [u] } = await query(`SELECT status FROM users WHERE id = $1`, [c.userId]);
    expect(u.status).toBe('pending');
    const { rows: [i] } = await query(`SELECT rejection_reason, submitted_for_review_at FROM influencers WHERE id = $1`, [c.influencerId]);
    expect(i.rejection_reason).toBeNull(); expect(i.submitted_for_review_at).toBeTruthy();
  });

  it('rejected brand: /brands/resubmit is the same door — refused when incomplete, pending when complete (23)', async () => {
    const b = await brand({ status: 'rejected' });
    let r = await api.post('/brands/resubmit', b.token, {});
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('PROFILE_INCOMPLETE');
    await completeBrandProfile(b.brandId);
    r = await api.post('/brands/resubmit', b.token, {});
    expect(r.status).toBe(200); expect(r.body.data.user_status).toBe('pending');
    expect((await query(`SELECT status FROM users WHERE id = $1`, [b.userId])).rows[0].status).toBe('pending');
  });

  it('admin approval is the team\'s manual check, never a completeness gate — the review page still names the gaps (24, 26; amended 19 Sep)', async () => {
    const b = await brand({ status: 'pending' });
    const admin = await createAdminUser('superadmin');
    const page = await api.get(`/brands/${b.brandId}`, admin.token);
    expect(page.body.data.missing_fields).toEqual(['logo', 'about', 'contact person']);
    expect(page.body.data.branches).toHaveLength(1);
    expect(page.body.data.brand.bank_account_no).toBeUndefined();
    // incomplete, on both admin paths → approved
    let r = await api.patch(`/admin/brands/${b.brandId}/status`, admin.token, { status: 'approved' });
    expect(r.status).toBe(200);
    expect((await query(`SELECT status FROM users WHERE id = $1`, [b.userId])).rows[0].status).toBe('approved');
    const b3 = await brand({ status: 'pending' });
    r = await api.patch(`/brands/${b3.brandId}/status`, admin.token, { status: 'approved' });
    expect(r.status).toBe(200);
    // the nag survives approval: the profile tab still lists what is missing
    expect((await api.get('/brands/me', b.token)).body.data.completeness.missing_labels).toEqual(['logo', 'about', 'contact person']);
    // rejection still works on an incomplete one, and reinstating a suspended brand is not gated
    const b2 = await brand({ status: 'pending' });
    r = await api.patch(`/admin/brands/${b2.brandId}/status`, admin.token, { status: 'rejected', reason: 'No shop number' });
    expect(r.status).toBe(200);
  });

  it('creator verify is the ownership check, never a completeness gate — approved and measuring while incomplete, gaps reported (25, 26; amended 19 Sep)', async () => {
    const { token, user } = await createInfluencerUser();
    const tg = await ids('Telangana', 'Hyderabad');
    const reg = await api.post('/influencers/register', token, { name: 'Priya', instagram_handle: `p_${rnd()}`, ...tg });
    const infId = reg.body.data.influencer.id;
    const admin = await createAdminUser('superadmin');
    const { rows: [cp] } = await query(`SELECT id FROM creator_profiles WHERE linked_influencer_id = $1`, [infId]);
    const page = await api.get(`/influencers/${infId}`, admin.token);
    expect(page.body.data.influencer.missing_fields).toEqual(['photo', 'bio', 'niche', 'a language', 'age', 'gender']);
    expect(page.body.data.influencer.completeness.done).toBe(4);
    expect(page.body.data.influencer.submitted_for_review_at).toBeNull();
    const r = await api.post(`/admin/creator-verifications/${cp.id}/verify`, admin.token);
    expect(r.status).toBe(200);
    expect(r.body.data.missing_fields).toEqual(['photo', 'bio', 'niche', 'a language', 'age', 'gender']);
    expect((await query(`SELECT status FROM users WHERE id = $1`, [user.id])).rows[0].status).toBe('approved');
    // the nag survives approval: her profile tab still lists what is missing
    expect((await api.get('/influencers/me', token)).body.data.completeness.missing_labels).toEqual(['photo', 'bio', 'niche', 'a language', 'age', 'gender']);
    const { rows: [acc] } = await query(`SELECT state, ownership FROM creator_social_accounts WHERE influencer_id = $1 AND platform = 'instagram'`, [infId]);
    expect(acc).toMatchObject({ state: 'measuring', ownership: 'confirmed' });
  });

  it('the pending queues say what is missing and put submitted accounts first (27)', async () => {
    const b1 = await brand({ status: 'pending' });
    const b2 = await brand({ status: 'pending' });
    await completeBrandProfile(b2.brandId);
    await api.post('/brands/me/submit-for-review', b2.token);
    const c1 = await creator({ status: 'pending' });
    const admin = await createAdminUser('superadmin');
    const bq = await api.get('/admin/queue/brands', admin.token);
    expect(bq.body.data.brands.map(x => x.id)).toEqual([b2.brandId, b1.brandId]);
    expect(bq.body.data.brands[0]).toMatchObject({ missing_count: 0, missing_fields: [] });
    expect(bq.body.data.brands[1]).toMatchObject({ missing_count: 3, submitted_for_review_at: null });
    expect(bq.body.data.brands[0].bank_account_no).toBeUndefined();
    const cq = await api.get('/admin/queue/influencers', admin.token);
    expect(cq.body.data.influencers[0]).toMatchObject({ id: c1.influencerId, missing_count: 4 });
    expect(cq.body.data.influencers[0].missing_fields).toEqual(['photo', 'bio', 'age', 'gender']);
  });
});

describe('The creator gate (checks 28, 29)', () => {
  it('a pending creator is refused on every action and allowed on her own profile and lists', async () => {
    const c = await creator({ status: 'pending' });
    const b = await brand();
    const { campaignInfluencerId: ci } = await collab(b.brandId, c.influencerId, { signed: 'none', status: 'invited' });
    const refused = [
      ['post', `/influencers/me/invitations/${ci}/accept`], ['post', `/influencers/me/invitations/${ci}/decline`],
      ['post', `/influencers/me/invitations/${ci}/counter`], ['post', `/influencers/me/invitations/${ci}/thread/accept`],
      ['post', `/influencers/me/invitations/${ci}/agreement/sign`], ['post', '/influencers/me/pitches'],
      ['post', `/influencers/me/invitations/${ci}/shoot/accept`], ['get', '/influencers/me/find-brands'],
      ['get', '/influencers/me/discover-brands'], ['post', '/influencers/me/withdraw'],
    ];
    for (const [m, p] of refused) {
      const r = await api[m](p, c.token, { amount: 100, fee: 100, note: 'x' });
      expect([p, r.status, r.body.error && r.body.error.code]).toEqual([p, 403, 'ACCOUNT_PENDING']);
      expect(r.body.error.message).toBe('Your account is under review by admin. This feature will be available once approved (usually within 24 hours).');
    }
    for (const p of ['/influencers/me', '/influencers/me/earnings', '/reference/languages', '/reference/states?offered=1', '/influencers/me/invitation-settings', '/influencers/me/social']) {
      const r = await api.get(p, c.token);
      expect([p, r.status]).toEqual([p, 200]);
    }
    expect((await api.patch('/influencers/me', c.token, { bio: 'hi' })).status).toBe(200);
    // rejected → its own words; approved → through (the item 5–10 suites cover the rest)
    await query(`UPDATE users SET status = 'rejected' WHERE id = $1`, [c.userId]);
    expect((await api.get('/influencers/me/find-brands', c.token)).body.error.code).toBe('ACCOUNT_REJECTED');
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [c.userId]);
    expect((await api.get('/influencers/me/find-brands', c.token)).status).toBe(200);
  });
});

describe('The brand gate (spec §6.5, founder decision 18)', () => {
  it('a pending brand reaches home, profile, wallet and branches — and nothing else', async () => {
    const b = await brand({ status: 'pending' });
    const c = await creator();
    const refused = [
      ['get', '/brands/me/discover-creators'], ['get', '/brands/me/worked-with'], ['get', `/influencers/${c.influencerId}`],
      ['get', '/campaigns'], ['post', '/campaigns'], ['get', '/campaigns/summary'],
      ['get', '/brands/me/influencer-groups'], ['post', '/brands/me/influencer-groups'],
      ['get', '/brands/me/pitches'], ['get', '/brands/me/pool'], ['get', '/brands/me/creator-invitations'],
      ['get', '/influencers/search'],
    ];
    for (const [m, p] of refused) {
      const r = await api[m](p, b.token, { name: 'x' });
      expect([p, r.status, r.body.error && r.body.error.code]).toEqual([p, 403, 'ACCOUNT_PENDING']);
    }
    for (const p of ['/brands/me', '/brands/me/branches', '/brands/me/wallet', '/reference/states?offered=1', '/reference/brand-categories', '/brands/me/pitch-settings']) {
      const r = await api.get(p, b.token);
      expect([p, r.status]).toEqual([p, 200]);
    }
    expect((await api.patch('/brands/me', b.token, { about: 'hi' })).status).toBe(200);
    // admin still reads a creator's page through the shared route; an approved brand too
    const admin = await createAdminUser('superadmin');
    expect((await api.get(`/influencers/${c.influencerId}`, admin.token)).status).toBe(200);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [b.userId]);
    expect((await api.get('/brands/me/discover-creators', b.token)).status).toBe(200);
    expect((await api.get(`/influencers/${c.influencerId}`, b.token)).status).toBe(200);
  });
});

describe('Branches (checks 30–32)', () => {
  it('the second branch must say which is main; the third need not; four parts required; no place id (30, 31, 32)', async () => {
    const b = await brand();
    const tg = await ids('Telangana', 'Hyderabad');
    let r = await api.post('/brands/me/branches', b.token, { name: 'Jubilee Hills', place_id: 'ChIJ' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('address_text');
    r = await api.post('/brands/me/branches', b.token, { name: 'Jubilee Hills', address_text: 'Plot 8, Road No. 36', pincode: '500033' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('city_id'); expect(r.body.error.message).toBe('Pick the state, then the nearest major city.');
    r = await api.post('/brands/me/branches', b.token, { name: 'Jubilee Hills', address_text: 'Plot 8, Road No. 36', pincode: '500033', ...tg });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('is_main'); expect(r.body.error.details.fields[0].code).toBe('MAIN_CHOICE_REQUIRED');
    expect(r.body.error.message).toBe('Which one is your main branch?');
    r = await api.post('/brands/me/branches', b.token, { name: 'Jubilee Hills', address_text: 'Plot 8, Road No. 36', pincode: '500033', ...tg, is_main: true });
    expect(r.status).toBe(201);
    expect(r.body.data.branch).toMatchObject({ isMain: true, formattedAddress: 'Plot 8, Road No. 36', pincode: '500033', googlePlaceId: null, lat: null, cityName: 'Hyderabad' });
    let list = (await api.get('/brands/me/branches', b.token)).body.data.branches;
    expect(list.filter(x => x.isMain)).toHaveLength(1); expect(list.find(x => x.isMain).name).toBe('Jubilee Hills');
    const kl = await ids('Kerala', 'Kochi');
    r = await api.post('/brands/me/branches', b.token, { name: 'Kochi', address_text: 'MG Road', pincode: '682001', ...kl });
    expect(r.status).toBe(201); expect(r.body.data.branch.isMain).toBe(false);
    r = await api.put(`/brands/me/branches/${r.body.data.branch.id}`, b.token, { pincode: '12' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('pincode');
    list = (await api.get('/brands/me/branches', b.token)).body.data.branches;
    expect(list).toHaveLength(3);
    // with is_main:false on the second branch the first stays main
    const b2 = await brand();
    r = await api.post('/brands/me/branches', b2.token, { name: 'Two', address_text: 'x', pincode: '500001', ...tg, is_main: false });
    expect(r.status).toBe(201); expect(r.body.data.branch.isMain).toBe(false);
  });
});

describe('The Other-niche queue (checks 33, 34)', () => {
  it('map to an existing niche; add a new niche and map; duplicates refused', async () => {
    const c = await creator();
    await api.patch('/influencers/me', c.token, { niche: ['other'], niche_other: 'Street food reviews' });
    const c2 = await creator();
    await api.patch('/influencers/me', c2.token, { niche: ['other'], niche_other: 'Pet & dog training' });
    const admin = await createAdminUser('superadmin');
    let r = await api.post(`/admin/niches/other/${c.influencerId}/map`, admin.token, { code: 'food' });
    expect(r.status).toBe(200); expect(r.body.data.niche).toEqual(['food']);
    expect((await query(`SELECT niche, niche_other_resolved_at FROM influencers WHERE id = $1`, [c.influencerId])).rows[0]).toMatchObject({ niche: ['food'] });
    expect((await api.get('/admin/niches/other', admin.token)).body.data.items.map(x => x.influencer_id)).toEqual([c2.influencerId]);
    r = await api.post(`/admin/niches/other/${c2.influencerId}/map`, admin.token, { code: 'other' });
    expect(r.status).toBe(422);
    r = await api.post('/admin/niches', admin.token, { label: 'Pets', influencer_id: c2.influencerId });
    expect(r.status).toBe(201); expect(r.body.data.niche).toMatchObject({ code: 'pets', label: 'Pets' });
    expect(r.body.data.mapped.niche).toEqual(['pets']);
    expect((await api.get('/reference/creator-niches', c.token)).body.data.items).toHaveLength(22);
    expect((await api.get('/admin/niches/other', admin.token)).body.data.items).toHaveLength(0);
    r = await api.post('/admin/niches', admin.token, { label: 'pets' });
    expect(r.status).toBe(409);
    // a creator can now pick it
    expect((await api.patch('/influencers/me', c.token, { niche: ['pets'] })).status).toBe(200);
    // and a non-approvals admin cannot touch the queue
    const finance = await createAdminUser('finance');
    expect((await api.get('/admin/niches/other', finance.token)).status).toBe(403);
  });
});

describe('The agreement and the payout row (checks 35, 36)', () => {
  it('snapshot carries GSTIN, PAN and both registered addresses; blank when missing', async () => {
    const b = await brand();
    const c = await creator();
    const { campaignInfluencerId } = await collab(b.brandId, c.influencerId, { signed: 'none', status: 'accepted' });
    let ctx = await terms.loadContext(campaignInfluencerId);
    let snap = await terms.buildSnapshot(ctx);
    expect(snap.parties.brand.gstin).toBe('');
    expect(snap.parties.creator.pan).toBe('');
    expect(snap.parties.brand.address).toContain('Hyderabad, Telangana');
    expect(snap.parties.creator.address).toBe('Hyderabad, Telangana');
    await api.patch('/brands/me', b.token, { gstin: '36ABCDE1234F1Z5' });
    await query(`UPDATE influencers SET pan_number = $2 WHERE id = $1`, [c.influencerId, encrypt('ABCDE1234F')]);
    ctx = await terms.loadContext(campaignInfluencerId);
    snap = await terms.buildSnapshot(ctx);
    expect(snap.parties.brand.gstin).toBe('36ABCDE1234F1Z5');
    expect(snap.parties.creator.pan).toBe('ABCDE1234F');
    // the main branch's registered street, city, state and pincode — the fixture registers at 123 MG Road
    expect(snap.parties.brand.address).toBe('123 MG Road, Hyderabad, Telangana, 500001');
  });
});
