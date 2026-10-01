'use strict';

/**
 * settlement-retry.job — retired.
 *
 * ASSERTION DRIFT — item 17 (features/item17-wallet; master rules v1.31 §17A, decisions W2–W3),
 * 1 Oct 2026. This job re-fired a Razorpay Route transfer for a sale settled before the brand had
 * a linked account. Sales money is now added to the brand's WALLET in one transaction at
 * settlement, so there is no transfer to retry: the job stays scheduled as a no-op and moves
 * nothing. Each test asserts that for the same situation; none was skipped or removed.
 */

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');
const settlementService = require('../src/services/settlement.service');
const { settlementRetryJob } = require('../src/jobs');

async function seedSettledTxn(brandId, { brandNet = 1000, fee = 200 } = {}) {
  const { user } = await createFollowerUser();
  let { rows: fr } = await query(`SELECT id FROM followers WHERE user_id = $1`, [user.id]);
  if (!fr[0]) fr = (await query(`INSERT INTO followers (user_id) VALUES ($1) RETURNING id`, [user.id])).rows;
  // Item 17 (pre-deploy review): only a sale that came through the shopper checkout becomes wallet
  // money, so the seeded sale carries a checkout, as every real one does.
  const { rows: [co] } = await query(
    `INSERT INTO checkouts (follower_id, status, payment_method, address_snapshot, items_normal, total, priced)
     VALUES ($1, 'placed', 'online', '{}'::jsonb, $2, $2, '{}'::jsonb) RETURNING id`, [fr[0].id, brandNet]);
  const { rows: [t] } = await query(
    `INSERT INTO follower_transactions
       (follower_id, brand_id, transaction_type, gross_amount, net_amount,
        influencer_commission, marketplace_fee_amount, brand_net, status, razorpay_payment_id, checkout_id)
     VALUES ($1,$2,'online_order',$3,$3,$4,$5,$6,'completed','pay_retry_1',$7)
     RETURNING id`,
    [fr[0].id, brandId, brandNet, fee, fee, brandNet, co.id]
  );
  // Settled while the brand has NO linked account → the share is already in its wallet.
  await settlementService.settleCommerceTransaction({ query }, t.id);
  return t.id;
}
const walletOf = async (brandId) => parseFloat((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brandId])).rows[0].wallet_balance);

beforeEach(async () => { await truncateAll(); });

describe('settlement-retry.job (retired by item 17)', () => {
  test('brand onboards a payout account AFTER the sale → nothing is transferred; its share was already in the wallet', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const before = await walletOf(brand.id);
    const txnId = await seedSettledTxn(brand.id);

    let { rows: [r0] } = await query(`SELECT razorpay_transfer_id, tcs_amount FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(r0.razorpay_transfer_id).toBeNull();
    expect(r0.tcs_amount).not.toBeNull();
    expect(await walletOf(brand.id)).toBe(before + 1000);

    await query(`UPDATE brands SET razorpay_linked_account_id = 'acc_mock_retry', linked_account_status = 'activated' WHERE id = $1`, [brand.id]);
    const res = await settlementRetryJob.run();
    expect(res.retired).toBe(true);

    const { rows: [r1] } = await query(`SELECT razorpay_transfer_id FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(r1.razorpay_transfer_id).toBeNull();
    expect(await walletOf(brand.id)).toBe(before + 1000);       // not paid twice
  });

  test('no linked account → nothing to do', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    await seedSettledTxn(brand.id);

    const res = await settlementRetryJob.run();
    expect(res.retired).toBe(true);
    expect(res.retried || 0).toBe(0);
  });

  test('running it again and again never moves money', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    await seedSettledTxn(brand.id);
    await query(`UPDATE brands SET razorpay_linked_account_id = 'acc_mock_retry', linked_account_status = 'activated' WHERE id = $1`, [brand.id]);
    const after = await walletOf(brand.id);

    await settlementRetryJob.run();
    const res = await settlementRetryJob.run();
    expect(res.retried || 0).toBe(0);
    expect(await walletOf(brand.id)).toBe(after);
    expect(await settlementService.retryTransfer()).toEqual({ skipped: 'retired' });
  });
});
