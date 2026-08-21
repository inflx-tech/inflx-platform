'use strict';

/**
 * Stage 0, job G — a brand searches PEOPLE, not prospects.
 * Contract: features/stage-0-clear-the-decks
 *
 * Founder's decision, 2026-08-20: admin keeps feeding Instagram handles in for Apify
 * to scrape, and that list is the prospect pipeline. But it must never reach brand
 * search. Searching and starting a collaboration is the first action in the entire
 * product; a brand who picks a scraped profile opens a negotiation with somebody who
 * has never heard of INFLX, and the very first thing they do leads nowhere.
 *
 * Admin still sees both, labelled, because knowing who has joined and who has not IS
 * the value of the pipeline.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser, createInfluencerUser, createAdminUser,
  registerBrand, registerInfluencer,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

async function approvedBrand() {
  const { token, user } = await createBrandUser();
  await registerBrand(token);
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [user.id]);
  return token;
}

async function approvedCreator(handle, city, state) {
  const { token, user } = await createInfluencerUser();
  await registerInfluencer(token, { instagram_handle: handle, name: 'Real Person' });
  await query(
    `UPDATE users SET status = 'approved', city = $2, state = $3 WHERE id = $1`,
    [user.id, city, state]
  );
  return user;
}

/** A scraped prospect: an Instagram handle with no account behind it. */
async function scrapedProspect(handle, city, state) {
  await query(
    `INSERT INTO creator_profiles (ig_handle, full_name, city, state, followers_count)
     VALUES ($1, $2, $3, $4, 50000)`,
    [handle, 'Scraped Prospect', city, state]
  );
}

describe('brand search shows only real members', () => {
  test('a scraped prospect never appears to a brand', async () => {
    await approvedCreator('real_one', 'Vijayawada', 'Andhra Pradesh');
    await scrapedProspect('scraped_one', 'Vijayawada', 'Andhra Pradesh');

    const token = await approvedBrand();
    const res = await request(app)
      .get('/v1/influencers/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const handles = (res.body.data.creators || res.body.data.influencers || []).map(c => c.ig_handle);
    expect(handles).toContain('real_one');
    expect(handles).not.toContain('scraped_one');
  });

  test('searching a city holding only prospects returns nobody', async () => {
    await scrapedProspect('ghost_a', 'Guntur', 'Andhra Pradesh');
    await scrapedProspect('ghost_b', 'Guntur', 'Andhra Pradesh');

    const token = await approvedBrand();
    const res = await request(app)
      .get('/v1/influencers/search?city=Guntur')
      .set('Authorization', `Bearer ${token}`);

    const found = res.body.data.creators || res.body.data.influencers || [];
    expect(found).toHaveLength(0);
  });

  test('admin still sees prospects alongside members', async () => {
    await approvedCreator('real_two', 'Hyderabad', 'Telangana');
    await scrapedProspect('scraped_two', 'Hyderabad', 'Telangana');

    const { token } = await createAdminUser('superadmin');
    const res = await request(app)
      .get('/v1/influencers/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const rows = res.body.data.creators || res.body.data.influencers || [];
    const handles = rows.map(c => c.ig_handle);
    expect(handles).toContain('real_two');
    expect(handles).toContain('scraped_two');

    // And labelled, so admin can tell who still needs converting.
    const prospect = rows.find(c => c.ig_handle === 'scraped_two');
    expect(prospect.source).toBe('scraped');
    expect(rows.find(c => c.ig_handle === 'real_two').source).toBe('onboarded');
  });
});

describe('the place picker counts the same people', () => {
  test('a city with prospects only is not offered to a brand', async () => {
    await approvedCreator('real_three', 'Vijayawada', 'Andhra Pradesh');
    await scrapedProspect('ghost_c', 'Nellore', 'Andhra Pradesh');

    const token = await approvedBrand();
    const res = await request(app)
      .get('/v1/influencers/locations')
      .set('Authorization', `Bearer ${token}`);

    const ap = (res.body.data.states || []).find(s => /Andhra/i.test(s.state));
    expect(ap).toBeDefined();

    const cities = ap.cities.map(c => c.city);
    expect(cities).toContain('Vijayawada');
    // Nellore holds a prospect and nobody reachable — offering it is a dead tap.
    expect(cities).not.toContain('Nellore');
  });

  test('the count a brand is shown matches what the search returns', async () => {
    await approvedCreator('c_one', 'Vijayawada', 'Andhra Pradesh');
    await approvedCreator('c_two', 'Vijayawada', 'Andhra Pradesh');
    await scrapedProspect('ghost_d', 'Vijayawada', 'Andhra Pradesh');
    await scrapedProspect('ghost_e', 'Vijayawada', 'Andhra Pradesh');

    const token = await approvedBrand();

    const loc = await request(app)
      .get('/v1/influencers/locations')
      .set('Authorization', `Bearer ${token}`);
    const ap = loc.body.data.states.find(s => /Andhra/i.test(s.state));
    const promised = ap.cities.find(c => c.city === 'Vijayawada').creators;

    const search = await request(app)
      .get('/v1/influencers/search?city=Vijayawada')
      .set('Authorization', `Bearer ${token}`);
    const delivered = (search.body.data.creators || search.body.data.influencers || []).length;

    expect(promised).toBe(2);
    expect(delivered).toBe(promised);
  });
});
