'use strict';

/**
 * jobs/subscription-renewal.job.js — Phase A6 cron.
 *
 * Daily: find active brand_subscriptions whose next_charge_at is today or
 * earlier; charge them (or mock-charge); write subscription_invoices;
 * advance next_charge_at by 30 days.
 *
 * RAZORPAY_MOCK=true (dev/test): synthetic invoice marked 'paid'.
 * RAZORPAY_MOCK=false (prod): TODO — real Razorpay charge call.
 *
 * Free-tier rows (monthly_price_inr=0) skip the charge but still bump the
 * cycle so usage windows (e.g. inviteInfluencer per-cycle quota) advance.
 *
 * Scheduled in jobs/index.js — 02:00 IST daily.
 */

const db = require('../config/db');
const env = require('../config/env');

const GST_PCT = 18.00;

async function run() {
  console.log('[CRON subscription-renewal] Running...');

  const { rows: due } = await db.query(
    `SELECT bs.id, bs.brand_id, bs.tier_id,
            t.tier_key, t.monthly_price_inr, t.is_enterprise
       FROM brand_subscriptions bs
       JOIN subscription_tiers t ON t.id = bs.tier_id
      WHERE bs.status         = 'active'
        AND bs.next_charge_at <= current_date`
  );

  if (due.length === 0) {
    console.log('[CRON subscription-renewal] No renewals due.');
    return { renewed: 0, failed: 0 };
  }

  const isMock = String(env.RAZORPAY_MOCK).toLowerCase() === 'true';
  let renewed = 0, failed = 0;

  for (const sub of due) {
    const amount = parseFloat(sub.monthly_price_inr);
    const gst    = parseFloat((amount * GST_PCT / 100).toFixed(2));

    try {
      await db.withTransaction(async (client) => {
        // Insert invoice (paid in mock; pending in live until webhook confirms)
        await client.query(
          `INSERT INTO subscription_invoices
             (brand_subscription_id, brand_id, tier_key, amount_inr, gst_amount_inr,
              period_start, period_end, status, paid_at, razorpay_payment_id)
           VALUES ($1, $2, $3, $4, $5, current_date, current_date + 30,
                   $6, $7, $8)`,
          [
            sub.id, sub.brand_id, sub.tier_key, amount, gst,
            isMock ? 'paid' : 'pending',
            isMock ? new Date() : null,
            isMock ? `pay_mock_renewal_${Date.now()}` : null,
          ]
        );

        // Advance the cycle anchor.
        await client.query(
          `UPDATE brand_subscriptions
              SET current_cycle_start = current_date,
                  current_cycle_end   = current_date + 30,
                  next_charge_at      = current_date + 30,
                  last_charged_at     = $2
            WHERE id = $1`,
          [sub.id, isMock ? new Date() : null]
        );
      });
      renewed += 1;
    } catch (err) {
      console.error(`[CRON subscription-renewal] FAILED for sub ${sub.id} (brand ${sub.brand_id}):`, err.message);
      // Mark sub past_due so brand UI surfaces it; admin can retry.
      try {
        await db.query(
          `UPDATE brand_subscriptions SET status = 'past_due' WHERE id = $1`,
          [sub.id]
        );
      } catch (_) { /* loud already on first throw */ }
      failed += 1;
    }
  }

  console.log(`[CRON subscription-renewal] Done — ${renewed} renewed, ${failed} failed.`);
  return { renewed, failed };
}

module.exports = { run };
