'use strict';

/**
 * Admin Section Manager — Phase B (features/admin-section-manager/)
 *
 * GET/PUT/DELETE /v1/admin/sections — auth gate, list, upsert (toggle/count/
 * reorder/type), delete, validation. section_config is reset to a known fixture
 * each test (it survives truncateAll — no users FK — so mutations would otherwise
 * leak across tests).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createAdminUser } = require('./helpers/factories');

let adminToken;

beforeEach(async () => {
  await truncateAll();
  await query(`DELETE FROM section_config`);
  await query(
    `INSERT INTO section_config
       (screen, scope_type, shelf_key, title, shelf_type, rule, item_type, category_key, item_limit, position, enabled, config_json)
     VALUES
       ('home','global','stories','Stories','creators','stories',NULL,NULL,12,1,true,'{}'),
       ('home','global','whats_hot','What''s Hot in {city}','offers','top_by_engagement',NULL,NULL,5,2,true,'{}'),
       ('home','global','top_in','Top Eats','brands','top_by_engagement','brands','dining',8,3,true,'{}')`
  );
  ({ token: adminToken } = await createAdminUser('superadmin'));
});

const auth = (req) => req.set('Authorization', `Bearer ${adminToken}`);

describe('GET /v1/admin/sections/:screen', () => {
  it('401s without an admin token', async () => {
    const res = await request(app).get('/v1/admin/sections/home');
    expect(res.status).toBe(401);
  });

  it('lists the home shelves in position order for an admin', async () => {
    const res = await auth(request(app).get('/v1/admin/sections/home'));
    expect(res.status).toBe(200);
    const { shelves } = res.body.data;
    expect(shelves.map(s => s.shelf_key)).toEqual(['stories', 'whats_hot', 'top_in']);
    expect(shelves[0].item_limit).toBe(12);
  });

  it('404s on an unknown screen', async () => {
    const res = await auth(request(app).get('/v1/admin/sections/nope'));
    expect(res.status).toBe(404);
  });
});

describe('PUT /v1/admin/sections/:screen', () => {
  it('toggles enabled, changes count, and reorders (upsert by id)', async () => {
    const list = await auth(request(app).get('/v1/admin/sections/home'));
    const shelves = list.body.data.shelves;
    // Disable whats_hot, bump stories count to 8, move top_in to position 1.
    const edited = shelves.map(s => {
      if (s.shelf_key === 'whats_hot') return { ...s, enabled: false };
      if (s.shelf_key === 'stories') return { ...s, item_limit: 8 };
      if (s.shelf_key === 'top_in') return { ...s, position: 0 };
      return s;
    });
    const res = await auth(request(app).put('/v1/admin/sections/home')).send({ scope_type: 'global', shelves: edited });
    expect(res.status).toBe(200);
    expect(res.body.data.saved_count).toBe(3);

    const after = await auth(request(app).get('/v1/admin/sections/home'));
    const byKey = Object.fromEntries(after.body.data.shelves.map(s => [s.shelf_key, s]));
    expect(byKey.whats_hot.enabled).toBe(false);
    expect(byKey.stories.item_limit).toBe(8);
    expect(after.body.data.shelves[0].shelf_key).toBe('top_in'); // reordered first
  });

  it('changes a Top-in rail item_type + category', async () => {
    const list = await auth(request(app).get('/v1/admin/sections/home'));
    const topIn = list.body.data.shelves.find(s => s.shelf_key === 'top_in');
    const res = await auth(request(app).put('/v1/admin/sections/home'))
      .send({ scope_type: 'global', shelves: [{ ...topIn, item_type: 'offers', rule: 'top_by_conversions' }] });
    expect(res.status).toBe(200);
    const after = await auth(request(app).get('/v1/admin/sections/home'));
    const t = after.body.data.shelves.find(s => s.id === topIn.id);
    expect(t.item_type).toBe('offers');
    expect(t.rule).toBe('top_by_conversions');
  });

  it('422s on a bad item_limit', async () => {
    const list = await auth(request(app).get('/v1/admin/sections/home'));
    const s = list.body.data.shelves[0];
    const res = await auth(request(app).put('/v1/admin/sections/home'))
      .send({ scope_type: 'global', shelves: [{ ...s, item_limit: 999 }] });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /v1/admin/sections/id/:id', () => {
  it('removes a shelf', async () => {
    const list = await auth(request(app).get('/v1/admin/sections/home'));
    const target = list.body.data.shelves.find(s => s.shelf_key === 'whats_hot');
    const res = await auth(request(app).delete(`/v1/admin/sections/id/${target.id}`));
    expect(res.status).toBe(200);
    const after = await auth(request(app).get('/v1/admin/sections/home'));
    expect(after.body.data.shelves.map(s => s.shelf_key)).not.toContain('whats_hot');
  });

  it('404s on an unknown id', async () => {
    const res = await auth(request(app).delete('/v1/admin/sections/id/00000000-0000-0000-0000-000000000000'));
    expect(res.status).toBe(404);
  });
});
