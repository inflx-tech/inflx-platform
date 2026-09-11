'use strict';

/**
 * Admin creator review — the five facts a creator supplies at signup must survive all the
 * way to the three admin screens, and a figure nobody measured must never read as zero.
 * Contract: features/admin-creator-review-completeness
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  createAdminUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

/**
 * A creator who filled in everything the signup screen asks for, left pending so she
 * shows up in the approvals queue.
 */
async function pendingCreator(overrides = {}) {
  const user = await createInfluencerUser();
  const inf = await registerInfluencer(user.token, {
    name: 'Anusha Somepalli',
    city: 'Hyderabad',
    instagram_handle: `anusha_${Date.now()}`,
    youtube_handle: 'anushasomepalli',
    ...overrides,
  });
  await query(`UPDATE users SET status = 'pending' WHERE id = $1`, [user.user.id]);
  return { inf, user };
}

describe('registration stores what she typed on the influencer row', () => {
  // The whole defect in one assertion: city used to live only on users, so
  // influencers.city was NULL and every admin read of i.city returned nothing.
  test('city and full_name land on influencers, not only on users', async () => {
    const { inf } = await pendingCreator();

    const { rows } = await query(
      `SELECT i.city, i.full_name, i.youtube_handle, u.city AS user_city, u.name AS user_name
         FROM influencers i JOIN users u ON u.id = i.user_id
        WHERE i.id = $1`,
      [inf.id]
    );

    expect(rows[0].city).toBe('Hyderabad');
    expect(rows[0].full_name).toBe('Anusha Somepalli');
    expect(rows[0].youtube_handle).toBe('anushasomepalli');
    // The users copy is still written — nothing that reads users.city regressed.
    expect(rows[0].user_city).toBe('Hyderabad');
    expect(rows[0].user_name).toBe('Anusha Somepalli');
  });

  test('an empty city stores NULL rather than an empty string', async () => {
    const { inf } = await pendingCreator({ city: '' });
    const { rows } = await query(`SELECT city FROM influencers WHERE id = $1`, [inf.id]);
    expect(rows[0].city).toBeNull();
  });
});

describe('GET /v1/admin/queue/influencers', () => {
  test('carries every fact the creator supplied', async () => {
    const { inf } = await pendingCreator();
    const admin = await createAdminUser('superadmin');

    const res = await request(app)
      .get('/v1/admin/queue/influencers')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const row = res.body.data.influencers.find(r => r.id === inf.id);
    expect(row).toBeDefined();
    expect(row.full_name).toBe('Anusha Somepalli');
    expect(row.phone).toBeTruthy();
    expect(row.city).toBe('Hyderabad');
    expect(row.instagram_handle).toBeTruthy();
    expect(row.youtube_handle).toBe('anushasomepalli');
    // Present so the row can tell "never measured" from "measured zero".
    expect(row).toHaveProperty('scrape_last_run');
    expect(row).toHaveProperty('youtube_scrape_last_run');
    expect(row).toHaveProperty('youtube_subscribers');
  });

  test('reads city off the users row for a creator who predates the source fix', async () => {
    const { inf } = await pendingCreator();
    // Recreate the old shape exactly: the value only ever reached the users row.
    await query(`UPDATE influencers SET city = NULL, full_name = NULL WHERE id = $1`, [inf.id]);

    const admin = await createAdminUser('superadmin');
    const res = await request(app)
      .get('/v1/admin/queue/influencers')
      .set('Authorization', `Bearer ${admin.token}`);

    const row = res.body.data.influencers.find(r => r.id === inf.id);
    expect(row.city).toBe('Hyderabad');
    expect(row.full_name).toBe('Anusha Somepalli');
  });
});

describe('GET /v1/influencers/:id', () => {
  test('gives the admin the whole record, links included', async () => {
    const { inf } = await pendingCreator();
    const admin = await createAdminUser('superadmin');

    const res = await request(app)
      .get(`/v1/influencers/${inf.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const i = res.body.data.influencer;
    expect(i.full_name).toBe('Anusha Somepalli');
    expect(i.city).toBe('Hyderabad');
    expect(i.phone).toBeTruthy();
    expect(i.youtube_handle).toBe('anushasomepalli');
    expect(i.youtube_url).toBe('https://www.youtube.com/@anushasomepalli');
    expect(i.instagram_url).toContain('instagram.com/');
    // Registration measured the channel via the mock, so both arrive together.
    expect(i.youtube_scrape_last_run).not.toBeNull();
    expect(typeof i.youtube_subscribers === 'number' || typeof i.youtube_subscribers === 'string')
      .toBe(true);
  });

  // The distinction the whole contract turns on: no channel is not an unmeasured
  // channel, and neither is a zero.
  test('a creator with no channel has null YouTube figures and no link', async () => {
    const user = await createInfluencerUser();
    const inf = await registerInfluencer(user.token, {
      name: 'Ravi Kumar',
      instagram_handle: `ravi_${Date.now()}`,
    });
    const admin = await createAdminUser('superadmin');

    const res = await request(app)
      .get(`/v1/influencers/${inf.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    const i = res.body.data.influencer;
    expect(i.youtube_handle).toBeNull();
    expect(i.youtube_url).toBeNull();
    expect(i.youtube_subscribers).toBeNull();
    expect(i.youtube_scrape_last_run).toBeNull();
  });

  test('still reads city off users when the influencer row has none', async () => {
    const { inf } = await pendingCreator();
    await query(`UPDATE influencers SET city = NULL, full_name = NULL WHERE id = $1`, [inf.id]);

    const admin = await createAdminUser('superadmin');
    const res = await request(app)
      .get(`/v1/influencers/${inf.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.body.data.influencer.city).toBe('Hyderabad');
    expect(res.body.data.influencer.full_name).toBe('Anusha Somepalli');
  });

  // The privacy line admin-account-review drew. This endpoint serves brands too, and the
  // new fields must not have widened what a brand can see.
  test('a brand gets the YouTube reach but never the phone or the balances', async () => {
    const { inf } = await pendingCreator();
    const brandUser = await createBrandUser();
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [brandUser.user.id]);
    await registerBrand(brandUser.token, { business_name: 'Kanchi Silks', category: 'Fashion' });

    // Item 3 (founder Q14): a brand cannot open a creator who is not yet approved.
    // Contract: features/item3-discovery-profiles-groups
    const pending = await request(app)
      .get(`/v1/influencers/${inf.id}`)
      .set('Authorization', `Bearer ${brandUser.token}`);
    expect(pending.status).toBe(404);
    await query(`UPDATE users SET status = 'approved' WHERE id = (SELECT user_id FROM influencers WHERE id = $1)`, [inf.id]);

    const res = await request(app)
      .get(`/v1/influencers/${inf.id}`)
      .set('Authorization', `Bearer ${brandUser.token}`);

    expect(res.status).toBe(200);
    const i = res.body.data.influencer;
    expect(i.youtube_handle).toBe('anushasomepalli');
    expect(i.youtube_url).toBeTruthy();
    expect(i.phone).toBeUndefined();
    expect(i.wallet_balance).toBeUndefined();
    expect(i.pending_balance).toBeUndefined();
  });
});

describe('GET /v1/admin/influencers (list)', () => {
  test('search matches the city on the users row and the youtube handle', async () => {
    const { inf } = await pendingCreator();
    await query(`UPDATE influencers SET city = NULL WHERE id = $1`, [inf.id]);
    const admin = await createAdminUser('superadmin');

    const byCity = await request(app)
      .get('/v1/admin/influencers?search=Hyderabad')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(byCity.status).toBe(200);
    expect(byCity.body.data.influencers.map(r => r.id)).toContain(inf.id);

    const byYouTube = await request(app)
      .get('/v1/admin/influencers?search=anushasomepalli')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(byYouTube.body.data.influencers.map(r => r.id)).toContain(inf.id);
  });
});

describe('youtube.service handle parsing', () => {
  // Creators paste all of these into one text box. Every one has to become a link that
  // opens, or the "Open on YouTube" button is worse than no button.
  const { parseChannelRef, channelUrl } = require('../src/services/youtube.service');

  test.each([
    ['MrBeast',                                        'handle', 'MrBeast'],
    ['@MrBeast',                                       'handle', 'MrBeast'],
    ['youtube.com/@MrBeast',                           'handle', 'MrBeast'],
    ['https://www.youtube.com/@MrBeast/videos',        'handle', 'MrBeast'],
    ['https://m.youtube.com/c/MrBeast',                'legacy', 'MrBeast'],
    ['youtube.com/user/nigahiga',                      'legacy', 'nigahiga'],
    ['youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',   'id',     'UCX6OQ3DkcsbYNE6H8uQQuVA'],
    ['UCX6OQ3DkcsbYNE6H8uQQuVA',                       'id',     'UCX6OQ3DkcsbYNE6H8uQQuVA'],
  ])('parses %s', (input, kind, value) => {
    expect(parseChannelRef(input)).toEqual({ kind, value });
  });

  test('empty input is null, not a broken link', () => {
    expect(parseChannelRef('')).toBeNull();
    expect(parseChannelRef(null)).toBeNull();
    expect(channelUrl(null)).toBeNull();
  });

  test('a channel id keeps the /channel/ form; everything else becomes an @ link', () => {
    expect(channelUrl('UCX6OQ3DkcsbYNE6H8uQQuVA'))
      .toBe('https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA');
    expect(channelUrl('  @MrBeast ')).toBe('https://www.youtube.com/@MrBeast');
  });
});
