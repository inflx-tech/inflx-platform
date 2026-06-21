'use strict';

/**
 * Reusable customisation templates (saved add-on / variation groups).
 * Contract: features/food-addon-templates.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');

beforeEach(async () => { await truncateAll(); });

async function restaurant() {
  const { token, user } = await createBrandUser();
  await registerBrand(token, { business_name: 'Pizza House', category: 'restaurant' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return token;
}
const crust = {
  name: 'Crust', is_variation: true,
  definition: { items: [{ name: 'Medium', price: 0, is_default: true }, { name: 'Large', price: 80 }] },
};

describe('Addon templates — save + reuse', () => {
  it('save, list, and update-by-name (upsert)', async () => {
    const token = await restaurant();
    const save = await request(app).post('/v1/brands/me/addon-templates')
      .set('Authorization', `Bearer ${token}`).send(crust);
    expect(save.status).toBe(201);
    expect(save.body.data.template.is_variation).toBe(true);
    expect(save.body.data.template.definition.items).toHaveLength(2);

    const list = await request(app).get('/v1/brands/me/addon-templates').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.templates).toHaveLength(1);

    // Re-save same name with a different option set → upsert (still 1).
    const upd = await request(app).post('/v1/brands/me/addon-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...crust, definition: { items: [{ name: 'Regular', price: 0 }] } });
    expect(upd.status).toBe(201);
    const list2 = await request(app).get('/v1/brands/me/addon-templates').set('Authorization', `Bearer ${token}`);
    expect(list2.body.data.templates).toHaveLength(1);
    expect(list2.body.data.templates[0].definition.items[0].name).toBe('Regular');
  });

  it('delete removes a template', async () => {
    const token = await restaurant();
    const save = await request(app).post('/v1/brands/me/addon-templates')
      .set('Authorization', `Bearer ${token}`).send(crust);
    const id = save.body.data.template.id;
    const del = await request(app).delete(`/v1/brands/me/addon-templates/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    const list = await request(app).get('/v1/brands/me/addon-templates').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.templates).toHaveLength(0);
  });

  it('validation: name + at least one option required', async () => {
    const token = await restaurant();
    const noName = await request(app).post('/v1/brands/me/addon-templates')
      .set('Authorization', `Bearer ${token}`).send({ name: '', definition: { items: [{ name: 'X' }] } });
    expect(noName.status).toBe(422);
    const noItems = await request(app).post('/v1/brands/me/addon-templates')
      .set('Authorization', `Bearer ${token}`).send({ name: 'Empty', definition: { items: [] } });
    expect(noItems.status).toBe(422);
  });
});
