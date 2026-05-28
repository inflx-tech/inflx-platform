'use strict';

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createAdminUser, registerBrand } = require('./helpers/factories');

const BANK_DETAILS = {
  account_holder_name: 'Aveen Food Paradise',
  bank_name: 'State Bank of India',
  account_number: '1234567890',
  ifsc_code: 'SBIN0001234',
  upi_id: 'aveenfood@upi',
};

beforeEach(async () => {
  await truncateAll();
});

describe('Brand Wallet Withdrawal (admin-gated)', () => {
  // Returns { brandToken, brand } with an approved brand user that has a
  // funded wallet + bank details on file in listing_data.
  async function setupBrand({ balance = 50000, bank = BANK_DETAILS } = {}) {
    const { token: brandToken, user } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [user.id]);
    await query(
      `UPDATE brands
          SET wallet_balance = $1,
              listing_data = jsonb_set(COALESCE(listing_data, '{}'::jsonb), '{bank_details}', $2::jsonb)
        WHERE id = $3`,
      [balance, JSON.stringify(bank), brand.id]
    );
    return { brandToken, brand };
  }

  test('UPI withdrawal request: deducts wallet, writes a pending row + ledger debit', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });

    const res = await request(app)
      .post('/v1/brands/me/wallet/withdraw')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 20000, method: 'upi' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.amount_requested).toBe(20000);
    expect(res.body.data.method).toBe('upi');

    // Wallet debited immediately (funds reserved).
    const { rows: [b] } = await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brand.id]);
    expect(parseFloat(b.wallet_balance)).toBe(30000);

    // brand_withdrawals row snapshot from listing_data.
    const { rows: [w] } = await query(`SELECT * FROM brand_withdrawals WHERE brand_id = $1`, [brand.id]);
    expect(w.status).toBe('pending');
    expect(w.upi_id).toBe('aveenfood@upi');
    expect(w.bank_account_no).toBeNull();

    // Audit ledger: type='withdrawal' direction='debit' (NOT 'payout').
    const { rows: [tx] } = await query(
      `SELECT * FROM wallet_transactions WHERE brand_id = $1 AND type = 'withdrawal'`,
      [brand.id]
    );
    expect(tx.direction).toBe('debit');
    expect(parseFloat(tx.amount)).toBe(20000);
    expect(parseFloat(tx.balance_after)).toBe(30000);
  });

  test('admin approve (mock) marks completed and leaves wallet debited', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });
    const { token: adminToken } = await createAdminUser('finance');

    const reqRes = await request(app)
      .post('/v1/brands/me/wallet/withdraw')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 20000, method: 'upi' });
    const wid = reqRes.body.data.withdrawal_id;

    const res = await request(app)
      .post(`/v1/admin/brand-withdrawals/${wid}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('approved');
    expect(res.body.data.withdrawal.status).toBe('completed');
    expect(res.body.data.withdrawal.razorpay_payout_id).toMatch(/^mock_payout_/);

    // No double deduction on approve.
    const { rows: [b] } = await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brand.id]);
    expect(parseFloat(b.wallet_balance)).toBe(30000);
  });

  test('admin reject refunds the wallet and cancels the withdrawal', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });
    const { token: adminToken } = await createAdminUser('finance');

    const reqRes = await request(app)
      .post('/v1/brands/me/wallet/withdraw')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 20000, method: 'upi' });
    const wid = reqRes.body.data.withdrawal_id;

    const res = await request(app)
      .post(`/v1/admin/brand-withdrawals/${wid}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'reject', reason: 'Bank details mismatch' });

    expect(res.status).toBe(200);
    expect(res.body.data.withdrawal.status).toBe('cancelled');
    expect(res.body.data.withdrawal.failure_reason).toBe('Bank details mismatch');

    // Wallet refunded to the original balance.
    const { rows: [b] } = await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brand.id]);
    expect(parseFloat(b.wallet_balance)).toBe(50000);

    // Reversing ledger credit present.
    const { rows: credits } = await query(
      `SELECT * FROM wallet_transactions WHERE brand_id = $1 AND type = 'withdrawal' AND direction = 'credit'`,
      [brand.id]
    );
    expect(credits.length).toBe(1);
  });

  test('bank_transfer withdrawal snapshots account + IFSC', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });

    const res = await request(app)
      .post('/v1/brands/me/wallet/withdraw')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 15000, method: 'bank_transfer' });

    expect(res.status).toBe(201);
    const { rows: [w] } = await query(`SELECT * FROM brand_withdrawals WHERE brand_id = $1`, [brand.id]);
    expect(w.method).toBe('bank_transfer');
    expect(w.bank_account_no).toBe('1234567890');
    expect(w.bank_ifsc).toBe('SBIN0001234');
    expect(w.upi_id).toBeNull();
  });

  test('rejects withdrawal below the minimum', async () => {
    const { brandToken } = await setupBrand({ balance: 50000 });
    const res = await request(app)
      .post('/v1/brands/me/wallet/withdraw')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 50, method: 'upi' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WITHDRAWAL_TOO_SMALL');
  });

  test('rejects withdrawal above available balance', async () => {
    const { brandToken } = await setupBrand({ balance: 50000 });
    const res = await request(app)
      .post('/v1/brands/me/wallet/withdraw')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 60000, method: 'upi' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  test('rejects when no payment method is on file', async () => {
    const { brandToken } = await setupBrand({ balance: 50000, bank: {} });
    const res = await request(app)
      .post('/v1/brands/me/wallet/withdraw')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 20000, method: 'upi' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_METHOD_MISSING');
  });

  test('cannot process an already-processed withdrawal', async () => {
    const { brandToken } = await setupBrand({ balance: 50000 });
    const { token: adminToken } = await createAdminUser('finance');

    const reqRes = await request(app)
      .post('/v1/brands/me/wallet/withdraw')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 20000, method: 'upi' });
    const wid = reqRes.body.data.withdrawal_id;

    await request(app)
      .post(`/v1/admin/brand-withdrawals/${wid}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });

    const second = await request(app)
      .post(`/v1/admin/brand-withdrawals/${wid}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });

    expect(second.status).toBe(409);
  });
});
