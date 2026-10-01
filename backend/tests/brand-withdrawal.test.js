'use strict';

/**
 * Brand wallet withdrawal.
 *
 * ASSERTION DRIFT — item 17 (features/item17-wallet; master rules v1.31 §17A, decisions W5 + W9),
 * 1 Oct 2026. This suite described the Wave 2 flow: the wallet was debited at request, the bank
 * details came from listing_data.bank_details, and Admin "approved" the request, which fired a
 * RazorpayX payout. The rule changed, so every test below now asserts the NEW rule for the same
 * situation (none was skipped or removed):
 *
 *   request            the amount goes ON HOLD (Available → On hold); it is not gone yet
 *   processed          INFLX paid it from its own bank and recorded the reference; the hold is taken
 *   could not process  the hold goes back to Available, with the reason
 *   where it is paid   the brand's ONE saved bank account (brands.bank_account_no + bank_ifsc),
 *                      set on its profile — never listing_data, never a UPI ID for a brand
 *   the old approve    POST /admin/brand-withdrawals/:id/process answers 410 (retired)
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createAdminUser, registerBrand } = require('./helpers/factories');
const { decrypt } = require('../src/utils/encrypt');

const BANK = { bank_account_no: '1234567890', bank_ifsc: 'SBIN0001234' };

// STALE FIXTURE (fixed with item 17): a finance admin reaches Money through the 'payouts' capability
// (migration 109). The factory creates the role without capabilities, so the old approve tests here
// had been answering 403 since then. The admin these tests need is one who HOLDS that capability.
async function financeAdmin() {
  const a = await createAdminUser('finance');
  await query(`UPDATE admin_profiles SET capabilities = ARRAY['payouts'] WHERE user_id = $1`, [a.user.id]);
  return a;
}

beforeEach(async () => {
  await truncateAll();
});

describe('Brand Wallet Withdrawal (request → INFLX pays → processed)', () => {
  // An approved brand with a funded wallet and, unless bank is null, its bank account saved on its profile.
  async function setupBrand({ balance = 50000, bank = BANK } = {}) {
    const { token: brandToken, user } = await createBrandUser();
    const brand = await registerBrand(brandToken);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [user.id]);
    await query(`UPDATE brands SET wallet_balance = $1 WHERE id = $2`, [balance, brand.id]);
    if (bank) {
      const r = await request(app).patch('/v1/brands/me').set('Authorization', `Bearer ${brandToken}`).send(bank);
      if (r.status !== 200) throw new Error(`bank: ${JSON.stringify(r.body)}`);
    }
    return { brandToken, brand };
  }
  const withdraw = (token, amount) => request(app).post('/v1/brands/me/wallet/withdraw').set('Authorization', `Bearer ${token}`).send({ amount });
  const money = async (id) => {
    const { rows: [b] } = await query(`SELECT wallet_balance::float AS available, withdrawal_hold::float AS hold FROM brands WHERE id = $1`, [id]);
    return b;
  };

  test('withdrawal request: the amount goes on hold, with a waiting row and a ledger row', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });

    const res = await withdraw(brandToken, 20000);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('requested');
    expect(res.body.data.amount_requested).toBe(20000);
    expect(res.body.data.withdrawal.method).toBe('bank');

    // Held at once: it left Available and sits in On hold — it has not left INFLX.
    expect(await money(brand.id)).toEqual({ available: 30000, hold: 20000 });

    const { rows: [w] } = await query(`SELECT * FROM withdrawal_requests WHERE brand_id = $1`, [brand.id]);
    expect(w.status).toBe('requested');
    expect(w.owner_kind).toBe('brand');
    expect(w.upi_enc).toBeNull();
    // The retired table is no longer written.
    expect((await query(`SELECT count(*)::int AS n FROM brand_withdrawals WHERE brand_id = $1`, [brand.id])).rows[0].n).toBe(0);

    const { rows: [tx] } = await query(
      `SELECT * FROM wallet_transactions WHERE brand_id = $1 AND type = 'withdrawal_hold'`,
      [brand.id]
    );
    expect(tx.direction).toBe('debit');
    expect(parseFloat(tx.amount)).toBe(20000);
    expect(parseFloat(tx.balance_after)).toBe(30000);
  });

  test('admin marks it processed with the bank reference: the hold is taken, Available is untouched', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });
    const { token: adminToken } = await financeAdmin();

    const reqRes = await withdraw(brandToken, 20000);
    const wid = reqRes.body.data.withdrawal_id;

    // The old approve (automatic payout) is retired.
    const old = await request(app)
      .post(`/v1/admin/brand-withdrawals/${wid}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });
    expect(old.status).toBe(410);
    expect(old.body.error.code).toBe('RETIRED_17_WITHDRAWALS');

    const res = await request(app)
      .post(`/v1/admin/money/withdrawals/${wid}/processed`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reference: 'SBIN226274001234' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('processed');
    expect(res.body.data.reference).toBe('SBIN226274001234');

    // No second deduction: the money that left is exactly what was held.
    expect(await money(brand.id)).toEqual({ available: 30000, hold: 0 });
  });

  test('admin could-not-process returns the hold to Available and records the reason', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });
    const { token: adminToken } = await financeAdmin();

    const reqRes = await withdraw(brandToken, 20000);
    const wid = reqRes.body.data.withdrawal_id;

    const res = await request(app)
      .post(`/v1/admin/money/withdrawals/${wid}/could-not-process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Bank details mismatch' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('could_not_process');
    expect(res.body.data.reason).toBe('Bank details mismatch');

    expect(await money(brand.id)).toEqual({ available: 50000, hold: 0 });

    // The ledger row that puts it back.
    const { rows: credits } = await query(
      `SELECT * FROM wallet_transactions WHERE brand_id = $1 AND type = 'withdrawal_release' AND direction = 'credit'`,
      [brand.id]
    );
    expect(credits.length).toBe(1);
    expect(parseFloat(credits[0].balance_after)).toBe(50000);
  });

  test("the request snapshots the brand's saved account + IFSC (encrypted), masked for its own screen", async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });

    const res = await withdraw(brandToken, 15000);

    expect(res.status).toBe(201);
    expect(res.body.data.withdrawal.sendTo).toBe('··7890 · SBIN0001234');
    const { rows: [w] } = await query(`SELECT * FROM withdrawal_requests WHERE brand_id = $1`, [brand.id]);
    expect(w.method).toBe('bank');
    expect(w.account_enc).not.toBe('1234567890');
    expect(decrypt(w.account_enc)).toBe('1234567890');
    expect(w.ifsc).toBe('SBIN0001234');
    expect(w.upi_enc).toBeNull();
  });

  test('rejects withdrawal below the minimum', async () => {
    const { brandToken } = await setupBrand({ balance: 50000 });
    const res = await withdraw(brandToken, 50);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WITHDRAWAL_TOO_SMALL');
  });

  test('rejects withdrawal above available balance', async () => {
    const { brandToken } = await setupBrand({ balance: 50000 });
    const res = await withdraw(brandToken, 60000);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  test('rejects when no bank account is on file — bank details in listing_data are not a second store', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000, bank: null });
    await query(
      `UPDATE brands SET listing_data = jsonb_set(COALESCE(listing_data, '{}'::jsonb), '{bank_details}', $1::jsonb) WHERE id = $2`,
      [JSON.stringify({ account_number: '1234567890', ifsc_code: 'SBIN0001234', upi_id: 'aveenfood@upi' }), brand.id]
    );
    const res = await withdraw(brandToken, 20000);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_METHOD_MISSING');
  });

  test('cannot process an already-processed withdrawal', async () => {
    const { brandToken, brand } = await setupBrand({ balance: 50000 });
    const { token: adminToken } = await financeAdmin();

    const reqRes = await withdraw(brandToken, 20000);
    const wid = reqRes.body.data.withdrawal_id;
    const processed = () => request(app)
      .post(`/v1/admin/money/withdrawals/${wid}/processed`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reference: 'SBIN226274001234' });

    await processed();
    const second = await processed();

    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe('NOT_WAITING');
    expect(await money(brand.id)).toEqual({ available: 30000, hold: 0 });
  });
});
