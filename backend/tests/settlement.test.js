'use strict';

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');
const settlementService = require('../src/services/settlement.service');

const runner = { query };

async function seedTxn(brandId, { brandNet = 1000, fee = 200, paymentId = 'pay_test_1' } = {}) {
  const { user } = await createFollowerUser();
  // Follower login auto-creates a followers row (UNIQUE on user_id) — reuse it.
  let { rows: fr } = await query(`SELECT id FROM followers WHERE user_id = $1`, [user.id]);
  if (!fr[0]) fr = (await query(`INSERT INTO followers (user_id) VALUES ($1) RETURNING id`, [user.id])).rows;
  const followerId = fr[0].id;
  const { rows: [t] } = await query(
    `INSERT INTO follower_transactions
       (follower_id, brand_id, transaction_type, gross_amount, net_amount,
        influencer_commission, marketplace_fee_amount, brand_net, status, razorpay_payment_id)
     VALUES ($1,$2,'pay_at_store',$3,$3,$4,$5,$6,'completed',$7)
     RETURNING id`,
    [followerId, brandId, brandNet, fee, fee, brandNet, paymentId]
  );
  return t.id;
}

beforeEach(async () => { await truncateAll(); });

describe('settlement.service.settleCommerceTransaction (RAZORPAY_MOCK)', () => {
  test('no linked account, tcs_applicable=false → tcs 0, commission GST recorded, no transfer', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const txnId = await seedTxn(brand.id, { brandNet: 1000, fee: 200 });

    const r = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(r.tcs).toBe(0);
    expect(r.commission_gst).toBeCloseTo(36, 2); // 200 * 18%
    expect(r.transfer_id).toBeNull();

    const { rows: [row] } = await query(
      `SELECT tcs_amount, commission_gst_amount, razorpay_transfer_id FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(parseFloat(row.tcs_amount)).toBe(0);
    expect(parseFloat(row.commission_gst_amount)).toBeCloseTo(36, 2);
    expect(row.razorpay_transfer_id).toBeNull();
  });

  test('with linked account → Route transfer fires (mock) for the full brand_net (tcs gated off)', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    await query(`UPDATE brands SET razorpay_linked_account_id = 'acc_mock_x', linked_account_status = 'activated' WHERE id = $1`, [brand.id]);
    const txnId = await seedTxn(brand.id, { brandNet: 1000, fee: 200 });

    const r = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(r.transfer_id).toMatch(/^trf_mock_/);
    expect(r.transfer_amount).toBe(1000); // brand_net − 0 TCS

    const { rows: [row] } = await query(`SELECT razorpay_transfer_id FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(row.razorpay_transfer_id).toMatch(/^trf_mock_/);
  });

  test('tcs_applicable=true but global tcs_active off → still 0 (both gates required)', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    await query(`UPDATE brands SET tcs_applicable = true WHERE id = $1`, [brand.id]);
    const txnId = await seedTxn(brand.id, { brandNet: 1000, fee: 200 });

    const r = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(r.tcs).toBe(0); // tax.service.tcsOn returns 0 unless payment_config.tcs_active
  });

  test('idempotent — second settle is skipped', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const txnId = await seedTxn(brand.id);

    await settlementService.settleCommerceTransaction(runner, txnId);
    const second = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(second.skipped).toBe(true);
  });

  test('resolveReturnWindowEndsAt uses the per-category window', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    await query(`UPDATE brands SET category = 'restaurant' WHERE id = $1`, [brand.id]);
    // categories is cleared by truncateAll's users-CASCADE (updated_by FK), so
    // seed the row with a distinctive per-category window.
    await query(
      `INSERT INTO categories (category_key, name, label, path_a_pct, path_b_pct, path_c_pct, return_window_days, sort_order)
       VALUES ('restaurant','restaurant','Restaurant',8,4,6,7,1)
       ON CONFLICT (category_key) DO UPDATE SET return_window_days = 7`
    );

    const endsAt = await settlementService.resolveReturnWindowEndsAt(runner, brand.id);
    const days = Math.round((endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(7);
  });
});
