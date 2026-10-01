'use strict';

/**
 * settlement.service — a sale's brand share when its return window has closed.
 *
 * ASSERTION DRIFT — item 17 (features/item17-wallet; master rules v1.31 §17A, decisions W2–W4),
 * 1 Oct 2026. The second test described a Razorpay Route transfer to the brand's linked account.
 * The rule changed: the brand's share is ADDED TO ITS WALLET (the brand withdraws by request);
 * nothing is transferred to a bank from here, linked account or not. Each test asserts the new
 * rule for the same situation; none was skipped or removed.
 */

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');
const settlementService = require('../src/services/settlement.service');

const runner = { query };

async function seedTxn(brandId, { brandNet = 1000, fee = 200, paymentId = 'pay_test_1', checkout = true } = {}) {
  const { user } = await createFollowerUser();
  // Follower login auto-creates a followers row (UNIQUE on user_id) — reuse it.
  let { rows: fr } = await query(`SELECT id FROM followers WHERE user_id = $1`, [user.id]);
  if (!fr[0]) fr = (await query(`INSERT INTO followers (user_id) VALUES ($1) RETURNING id`, [user.id])).rows;
  const followerId = fr[0].id;
  // Item 17 (pre-deploy review): only a sale that came through the shopper checkout becomes wallet
  // money, so the seeded sale carries a checkout, as every real one does. `checkout: false` seeds
  // the older kind (pay-at-store), which is never credited.
  let checkoutId = null;
  if (checkout) {
    ({ rows: [{ id: checkoutId }] } = await query(
      `INSERT INTO checkouts (follower_id, status, payment_method, address_snapshot, items_normal, total, priced)
       VALUES ($1, 'placed', 'online', '{}'::jsonb, $2, $2, '{}'::jsonb) RETURNING id`, [followerId, brandNet]));
  }
  const { rows: [t] } = await query(
    `INSERT INTO follower_transactions
       (follower_id, brand_id, transaction_type, gross_amount, net_amount,
        influencer_commission, marketplace_fee_amount, brand_net, status, razorpay_payment_id, checkout_id)
     VALUES ($1,$2,$8,$3,$3,$4,$5,$6,'completed',$7,$9)
     RETURNING id`,
    [followerId, brandId, brandNet, fee, fee, brandNet, paymentId, checkout ? 'online_order' : 'pay_at_store', checkoutId]
  );
  return t.id;
}
const walletOf = async (brandId) => parseFloat((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brandId])).rows[0].wallet_balance);

beforeEach(async () => { await truncateAll(); });

describe('settlement.service.settleCommerceTransaction', () => {
  test('tcs_applicable=false → tcs 0, commission GST recorded, the share is added to the wallet, no transfer', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const before = await walletOf(brand.id);
    const txnId = await seedTxn(brand.id, { brandNet: 1000, fee: 200 });

    const r = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(r.tcs).toBe(0);
    expect(r.commission_gst).toBeCloseTo(36, 2); // 200 * 18%
    expect(r.transfer_id).toBeNull();
    expect(r.credited).toBe(1000);
    expect(await walletOf(brand.id)).toBe(before + 1000);

    const { rows: [row] } = await query(
      `SELECT tcs_amount, commission_gst_amount, razorpay_transfer_id, brand_settlement_status FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(parseFloat(row.tcs_amount)).toBe(0);
    expect(parseFloat(row.commission_gst_amount)).toBeCloseTo(36, 2);
    expect(row.razorpay_transfer_id).toBeNull();
    expect(row.brand_settlement_status).toBe('settled');
  });

  test('with a linked account → still no Route transfer: the full brand_net goes to the wallet, with its ledger row', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    await query(`UPDATE brands SET razorpay_linked_account_id = 'acc_mock_x', linked_account_status = 'activated' WHERE id = $1`, [brand.id]);
    const before = await walletOf(brand.id);
    const txnId = await seedTxn(brand.id, { brandNet: 1000, fee: 200 });

    const r = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(r.transfer_id).toBeNull();
    expect(r).not.toHaveProperty('transfer_amount');
    expect(r.credited).toBe(1000); // brand_net − 0 TCS
    expect(r.balance_after).toBe(before + 1000);

    const { rows: [row] } = await query(`SELECT razorpay_transfer_id FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(row.razorpay_transfer_id).toBeNull();
    const { rows: led } = await query(
      `SELECT type::text AS type, amount::float AS amount, direction::text AS direction, balance_after::float AS balance_after, source_ref_id
         FROM wallet_transactions WHERE brand_id = $1 AND type = 'sale_settlement'`, [brand.id]);
    expect(led).toEqual([{ type: 'sale_settlement', amount: 1000, direction: 'credit', balance_after: before + 1000, source_ref_id: txnId }]);
  });

  test('tcs_applicable=true but global tcs_active off → still 0 (both gates required)', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    await query(`UPDATE brands SET tcs_applicable = true WHERE id = $1`, [brand.id]);
    const txnId = await seedTxn(brand.id, { brandNet: 1000, fee: 200 });

    const r = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(r.tcs).toBe(0); // tax.service.tcsOn returns 0 unless payment_config.tcs_active
  });

  test('idempotent — second settle is skipped and adds nothing', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const txnId = await seedTxn(brand.id);

    await settlementService.settleCommerceTransaction(runner, txnId);
    const after = await walletOf(brand.id);
    const second = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(second.skipped).toBe(true);
    expect(await walletOf(brand.id)).toBe(after);
  });

  test('an older pay-at-store sale (no checkout) is never wallet money: refused, left pending, nothing credited', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const before = await walletOf(brand.id);
    const txnId = await seedTxn(brand.id, { brandNet: 450000, fee: 25000, checkout: false });

    const r = await settlementService.settleCommerceTransaction(runner, txnId);
    expect(r).toEqual({ skipped: 'not_a_checkout_sale' });
    expect(await walletOf(brand.id)).toBe(before);
    const { rows: [row] } = await query(`SELECT brand_settlement_status, tcs_amount FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(row).toEqual({ brand_settlement_status: 'pending', tcs_amount: null });
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
