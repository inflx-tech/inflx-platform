'use strict';

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createFollowerUser, registerBrand } = require('./helpers/factories');
const settlementService = require('../src/services/settlement.service');
const { settlementRetryJob } = require('../src/jobs');

async function seedSettledTxn(brandId, { brandNet = 1000, fee = 200 } = {}) {
  const { user } = await createFollowerUser();
  let { rows: fr } = await query(`SELECT id FROM followers WHERE user_id = $1`, [user.id]);
  if (!fr[0]) fr = (await query(`INSERT INTO followers (user_id) VALUES ($1) RETURNING id`, [user.id])).rows;
  const { rows: [t] } = await query(
    `INSERT INTO follower_transactions
       (follower_id, brand_id, transaction_type, gross_amount, net_amount,
        influencer_commission, marketplace_fee_amount, brand_net, status, razorpay_payment_id)
     VALUES ($1,$2,'pay_at_store',$3,$3,$4,$5,$6,'completed','pay_retry_1')
     RETURNING id`,
    [fr[0].id, brandId, brandNet, fee, fee, brandNet]
  );
  // Settle while the brand has NO linked account → tcs recorded, transfer null.
  await settlementService.settleCommerceTransaction({ query }, t.id);
  return t.id;
}

beforeEach(async () => { await truncateAll(); });

describe('settlement-retry.job (RAZORPAY_MOCK)', () => {
  test('brand onboards AFTER the sale → retry completes the transfer', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const txnId = await seedSettledTxn(brand.id);

    // transfer is null (no linked account at settle time)
    let { rows: [r0] } = await query(`SELECT razorpay_transfer_id, tcs_amount FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(r0.razorpay_transfer_id).toBeNull();
    expect(r0.tcs_amount).not.toBeNull();

    // Brand onboards a payout account, then the cron runs.
    await query(`UPDATE brands SET razorpay_linked_account_id = 'acc_mock_retry', linked_account_status = 'activated' WHERE id = $1`, [brand.id]);
    const res = await settlementRetryJob.run();
    expect(res.retried).toBe(1);
    expect(res.succeeded).toBe(1);

    const { rows: [r1] } = await query(`SELECT razorpay_transfer_id FROM follower_transactions WHERE id = $1`, [txnId]);
    expect(r1.razorpay_transfer_id).toMatch(/^trf_mock_/);
  });

  test('no linked account → not eligible, transfer stays null', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    await seedSettledTxn(brand.id);

    const res = await settlementRetryJob.run();
    expect(res.retried).toBe(0);
  });

  test('already-transferred txn is not retried again', async () => {
    const { token } = await createBrandUser();
    const brand = await registerBrand(token);
    const txnId = await seedSettledTxn(brand.id);
    await query(`UPDATE brands SET razorpay_linked_account_id = 'acc_mock_retry', linked_account_status = 'activated' WHERE id = $1`, [brand.id]);

    await settlementRetryJob.run();        // first run transfers
    const res = await settlementRetryJob.run(); // second run: nothing eligible
    expect(res.retried).toBe(0);
  });
});
