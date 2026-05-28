'use strict';

/**
 * taxReport.service.js — Wave 4 (compliance reporting).
 *
 * Monthly tax summary for filing returns: GST collected (subscription + commerce
 * commission + escrow Protection-Fee), TCS owed (commerce, Sec 52), and TDS
 * withheld (influencer withdrawals). Pure read-only aggregation over the already-
 * recorded tax columns.
 *
 * Date basis (documented for the CA):
 *   - subscription GST  → invoice paid_at (revenue recognised when paid)
 *   - commission GST    → follower_transactions.created_at (transaction date)
 *   - escrow-fee GST     → escrow_entries.released_at (fee realised at release)
 *   - TCS owed          → follower_transactions.created_at
 *   - TDS withheld      → influencer_withdrawals.completed_at (withheld at payout)
 *
 * Contract: features/wave4-tax-summary-report/.
 */

const db = require('../config/db');

function _n(v) { return parseFloat(v) || 0; }

/**
 * @param {string} month  'YYYY-MM'
 * @returns {Promise<object>} monthly tax summary
 */
async function monthlySummary(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) {
    const err = new Error('month must be YYYY-MM');
    err.code = 'VALIDATION_ERROR'; err.statusCode = 422;
    throw err;
  }
  const start = `${month}-01`;
  // window = [start, start + 1 month)

  const [sub, comm, escrow, tds] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(gst_amount_inr),0) AS gst,
              COALESCE(SUM(amount_inr),0)     AS base,
              COUNT(*)                        AS n
         FROM subscription_invoices
        WHERE status = 'paid'
          AND paid_at >= $1::timestamptz
          AND paid_at <  ($1::date + interval '1 month')`,
      [start]
    ),
    db.query(
      `SELECT COALESCE(SUM(commission_gst_amount),0) AS gst,
              COALESCE(SUM(tcs_amount),0)            AS tcs,
              COALESCE(SUM(marketplace_fee_amount),0) AS fee_base,
              COUNT(*)                               AS n
         FROM follower_transactions
        WHERE status = 'completed'
          AND created_at >= $1::timestamptz
          AND created_at <  ($1::date + interval '1 month')`,
      [start]
    ),
    db.query(
      `SELECT COALESCE(SUM(fee_gst_amount),0)   AS gst,
              COALESCE(SUM(escrow_fee_amount),0) AS fee_base,
              COUNT(*)                           AS n
         FROM escrow_entries
        WHERE status = 'released'
          AND released_at >= $1::timestamptz
          AND released_at <  ($1::date + interval '1 month')`,
      [start]
    ),
    db.query(
      `SELECT COALESCE(SUM(tds_deducted),0) AS tds,
              COALESCE(SUM(net_paid),0)     AS net_paid,
              COUNT(*)                      AS n
         FROM influencer_withdrawals
        WHERE status = 'completed'
          AND completed_at >= $1::timestamptz
          AND completed_at <  ($1::date + interval '1 month')`,
      [start]
    ),
  ]);

  const subscriptionGst = _n(sub.rows[0].gst);
  const commissionGst   = _n(comm.rows[0].gst);
  const escrowFeeGst     = _n(escrow.rows[0].gst);
  const totalGst        = parseFloat((subscriptionGst + commissionGst + escrowFeeGst).toFixed(2));

  return {
    month,
    gst_collected: {
      subscription: subscriptionGst,
      commission:   commissionGst,
      escrow_fee:   escrowFeeGst,
      total:        totalGst,
    },
    tcs_owed:     _n(comm.rows[0].tcs),
    tds_withheld: _n(tds.rows[0].tds),
    detail: {
      subscription_invoices_paid: parseInt(sub.rows[0].n, 10),
      commerce_transactions:      parseInt(comm.rows[0].n, 10),
      escrow_tranches_released:   parseInt(escrow.rows[0].n, 10),
      withdrawals_paid:           parseInt(tds.rows[0].n, 10),
      subscription_base:          _n(sub.rows[0].base),
      commission_fee_base:        _n(comm.rows[0].fee_base),
      escrow_fee_base:            _n(escrow.rows[0].fee_base),
      withdrawals_net_paid:       _n(tds.rows[0].net_paid),
    },
  };
}

module.exports = { monthlySummary };
