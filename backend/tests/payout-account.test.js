'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');

const BANK = {
  account_holder_name: 'Aveen Food Paradise',
  bank_name: 'State Bank of India',
  account_number: '1234567890',
  ifsc_code: 'SBIN0001234',
};

beforeEach(async () => { await truncateAll(); });

describe('Brand payout account (Razorpay Route, RAZORPAY_MOCK)', () => {
  async function setupBrand({ bank = BANK } = {}) {
    const { token, user } = await createBrandUser();
    const brand = await registerBrand(token);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [user.id]);
    if (Object.keys(bank).length) {
      await query(
        `UPDATE brands SET listing_data = jsonb_set(COALESCE(listing_data,'{}'::jsonb), '{bank_details}', $1::jsonb) WHERE id = $2`,
        [JSON.stringify(bank), brand.id]
      );
    }
    return { token, brand };
  }

  test('GET before connect → not_created + has_bank_details', async () => {
    const { token } = await setupBrand();
    const res = await request(app).get('/v1/brands/me/payout-account').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.linked_account_status).toBe('not_created');
    expect(res.body.data.has_bank_details).toBe(true);
    expect(res.body.data.bank_last4).toBe('7890');
  });

  test('POST connects a linked account (mock), persisted on the brand', async () => {
    const { token, brand } = await setupBrand();
    const res = await request(app).post('/v1/brands/me/payout-account').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.linked_account_id).toMatch(/^acc_mock_/);
    expect(res.body.data.linked_account_status).toBe('created');

    const { rows: [b] } = await query(`SELECT razorpay_linked_account_id, linked_account_status FROM brands WHERE id = $1`, [brand.id]);
    expect(b.razorpay_linked_account_id).toMatch(/^acc_mock_/);
  });

  test('GET after connect refreshes status to activated (mock)', async () => {
    const { token, brand } = await setupBrand();
    await request(app).post('/v1/brands/me/payout-account').set('Authorization', `Bearer ${token}`).send({});
    const res = await request(app).get('/v1/brands/me/payout-account').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.linked_account_status).toBe('activated');
    const { rows: [b] } = await query(`SELECT linked_account_status FROM brands WHERE id = $1`, [brand.id]);
    expect(b.linked_account_status).toBe('activated');
  });

  test('POST twice → 409 already connected', async () => {
    const { token } = await setupBrand();
    await request(app).post('/v1/brands/me/payout-account').set('Authorization', `Bearer ${token}`).send({});
    const res = await request(app).post('/v1/brands/me/payout-account').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(409);
  });

  test('POST without bank details → 422 PAYMENT_METHOD_MISSING', async () => {
    const { token } = await setupBrand({ bank: {} });
    const res = await request(app).post('/v1/brands/me/payout-account').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_METHOD_MISSING');
  });
});
