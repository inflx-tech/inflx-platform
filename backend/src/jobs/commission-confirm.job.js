'use strict';

const db = require('../config/db');
const notificationService = require('../services/notification.service');
// Contract: features/referral-engine — accrue referral commission to the
// referred influencer's active referrer on confirmed (return-window-closed)
// follower commission.
const referralService = require('../services/referral.service');
const ledgerService = require('../services/ledger.service');

async function run() {
  console.log('[CRON commission-confirm] Running...');

  const { rows: ready } = await db.query(
    `SELECT ft.*, ci.influencer_id, i.user_id AS influencer_user_id, u.fcm_token, u.phone
     FROM follower_transactions ft
     JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE ft.return_window_ends_at <= NOW()
       AND ft.commission_confirmed_at IS NULL
       AND ft.status = 'completed'
       -- Do NOT release commission for a cancelled order or a STILL-OPEN return
       -- (founder rule: wallet isn't confirmed until the window closes, and a
       -- return within the window cancels the pending commission). A later-REJECTED
       -- return clears the guard so the next run confirms normally.
       AND NOT EXISTS (
         SELECT 1 FROM follower_orders fo
          WHERE fo.transaction_id = ft.id AND fo.order_status = 'cancelled')
       -- Item 17 (W4): a cash-on-delivery sale counts once it is DELIVERED; its return window then
       -- runs from the delivery, the same length as an online sale's. Online sales are unchanged.
       AND NOT EXISTS (
         SELECT 1 FROM follower_orders fo2
          WHERE fo2.id = ft.order_id AND fo2.payment_method = 'cod'
            AND NOT (fo2.order_status = 'delivered' AND fo2.delivered_at IS NOT NULL
                     AND fo2.delivered_at + (ft.return_window_ends_at - ft.created_at) <= NOW()))
       -- Item 17 (review): a shopper-checkout parcel still Confirmed/Packed can be cancelled and
       -- refunded in full; its commission stays pending (where a cancel takes it back) until it ships.
       AND NOT EXISTS (
         SELECT 1 FROM follower_orders fo3
          WHERE fo3.id = ft.order_id AND fo3.checkout_id IS NOT NULL
            AND fo3.order_status IN ('confirmed', 'packed'))
       -- Money G-3: only an OPEN return blocks confirmation. A REFUNDED return has
       -- ALREADY clawed its pro-rata share into commission_reversed, so the order
       -- can still confirm the KEPT remainder (influencer_commission −
       -- commission_reversed). This fixes the live bug where one partial return
       -- froze the WHOLE order's commission forever.
       AND NOT EXISTS (
         SELECT 1 FROM follower_returns fr
          WHERE fr.transaction_id = ft.id
            AND fr.return_status IN ('requested', 'approved', 'received'))`
  );

  if (ready.length === 0) {
    console.log('[CRON commission-confirm] No commissions to confirm.');
    return { confirmed: 0, total_amount: 0 };
  }

  let totalAmount = 0;

  let confirmedCount = 0;
  for (const tx of ready) {
    // Item 17 (review): CLAIM, THEN CREDIT, IN ONE TRANSACTION — the same shape as the brand's
    // share (settlement.service). The claim is a compare-and-swap on commission_confirmed_at, and
    // the amounts are read back from the claimed row, so two runs (or a run and a cancel) can never
    // credit twice, and a crash can never mark a sale confirmed without the money.
    let commission = 0; let reversed = 0; let claimed = false;
    await db.withTransaction(async (client) => {
      const { rows: got } = await client.query(
        `UPDATE follower_transactions SET commission_confirmed_at = NOW()
          WHERE id = $1 AND commission_confirmed_at IS NULL AND status = 'completed'
          RETURNING influencer_commission, commission_reversed`,
        [tx.id]
      );
      if (got.length !== 1) return;                 // another run confirmed it, or it was refunded meanwhile
      claimed = true;
      // Money G-3: confirm the NET (kept) commission — gross minus any pro-rated
      // return claw-backs already deducted from pending_balance at refund time.
      const gross = parseFloat(got[0].influencer_commission) || 0;
      reversed = parseFloat(got[0].commission_reversed) || 0;
      commission = parseFloat(Math.max(0, gross - reversed).toFixed(2));

      // Move pending_balance → wallet_balance for the kept amount (do NOT touch
      // total_earned — added at transaction time; claw-back already reduced it).
      if (commission > 0) {
        const { rows: balRows } = await client.query(
          `UPDATE influencers
           SET wallet_balance  = wallet_balance  + $1,
               pending_balance = GREATEST(0, pending_balance - $1)
           WHERE id = $2
           RETURNING wallet_balance`,
          [commission, tx.influencer_id]
        );
        // Ledger: pending → wallet confirm. Record the wallet credit (G-5).
        await ledgerService.appendInfluencerLedger({
          client,
          influencerId: tx.influencer_id,
          type: 'commission_confirm',
          amount: commission,
          direction: 'credit',
          balanceField: 'wallet_balance',
          balanceAfter: balRows[0] ? parseFloat(balRows[0].wallet_balance) : null,
          source: 'follower_txn',
          sourceRefId: tx.id,
          note: reversed > 0 ? `Confirmed net of ₹${reversed.toFixed(2)} returned` : null,
        });
      }
    });
    if (!claimed) continue;
    confirmedCount += 1;
    totalAmount += commission;

    // 2b. Referral accrual (contract: features/referral-engine). The platform's
    // commission slice on this confirmed txn is marketplace_fee_amount (was
    // platform_fee pre-M059). If the referred INFLUENCER has an active in-window
    // referrer, accrue their %. Best-effort own-transaction + idempotent on
    // (source, source_ref_id) so a cron re-run never double-pays; the
    // influencer's own commission credit above is untouched.
    await referralService.accrue({
      source:       'commission',
      sourceRefId:  tx.id,
      referredType: 'influencer',
      referredId:   tx.influencer_id,
      baseAmount:   parseFloat(tx.marketplace_fee_amount) || 0,
    });

    // 3. Notify influencer
    await notificationService.send({
      userId: tx.influencer_user_id,
      type: 'commission.confirmed',
      title: 'Commission Confirmed',
      body: `\u20B9${commission.toFixed(2)} commission confirmed \u2014 available to withdraw`,
      data: { screen: 'earnings' },
      fcmToken: tx.fcm_token,
      sendSms: false,
      phone: tx.phone,
    });
  }

  console.log(`[CRON commission-confirm] Confirmed ${confirmedCount} commissions totalling \u20B9${totalAmount.toFixed(2)}`);
  return { confirmed: confirmedCount, total_amount: totalAmount };
}

module.exports = { run };
