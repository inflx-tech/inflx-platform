'use strict';

/**
 * jobs/index.js — INFLX Cron Job Registry
 *
 * Imports and schedules all cron jobs.
 * When ENABLE_CRONS=false (test environment), jobs are loaded but NOT scheduled.
 * Tests call job.run() directly.
 */

const cron = require('node-cron');
const env = require('../config/env');

// Import all jobs
const commissionConfirmJob = require('./commission-confirm.job');
const tranche3Job          = require('./tranche-3-release.job');
const offerExpiryJob       = require('./offer-expiry.job');
const apifyEngagementJob   = require('./apify-engagement.job');
const campaignStatusJob    = require('./campaign-status.job');
const bookingReminderJob   = require('./booking-reminder.job');
const lowWalletJob         = require('./low-wallet-alert.job');
const negotiationExpiryJob = require('./negotiation-expiry.job');
const productionReminderJob = require('./production-shipment-reminder.job');
const subscriptionRenewalJob = require('./subscription-renewal.job');

// Wrap offer-expiry to expose run() interface (it exports runOfferExpiryJob)
const offerExpiryRun       = () => offerExpiryJob.runOfferExpiryJob();
const negotiationExpiryRun = () => negotiationExpiryJob.runNegotiationExpiryJob();

function startAllJobs() {
  if (!env.ENABLE_CRONS) {
    console.log('[JOBS] ENABLE_CRONS=false — cron schedules not registered (test mode)');
    return;
  }

  const tz = env.CRON_TIMEZONE || 'Asia/Kolkata';
  console.log(`[JOBS] Starting all cron jobs (timezone: ${tz})`);

  // commission-confirm — 00:01 IST daily
  cron.schedule('1 0 * * *', commissionConfirmJob.run, { timezone: tz });

  // tranche-3-release — 06:00 UTC daily
  cron.schedule('0 6 * * *', tranche3Job.run);

  // offer-expiry — every 15 minutes
  cron.schedule('0,15,30,45 * * * *', offerExpiryRun, { timezone: tz });

  // negotiation-expiry — every 30 minutes (auto-walks-away after 48h SLA)
  cron.schedule('7,37 * * * *', negotiationExpiryRun, { timezone: tz });

  // apify-engagement — 06:00 UTC daily
  cron.schedule('0 6 * * *', apifyEngagementJob.run);

  // campaign-status — 00:05 UTC daily
  cron.schedule('5 0 * * *', campaignStatusJob.run);

  // booking-reminder — 01:00 UTC daily
  cron.schedule('0 1 * * *', bookingReminderJob.run, { timezone: 'UTC' });

  // low-wallet-alert — 09:00 UTC daily
  cron.schedule('0 9 * * *', lowWalletJob.run);

  // production-shipment-reminder — 09:30 IST daily; nudges influencers with
  // unconfirmed shipments and flags 14+ day stalls for admin attention.
  cron.schedule('30 9 * * *', productionReminderJob.run, { timezone: tz });

  // subscription-renewal — 02:00 IST daily; charges due brand_subscriptions
  // (mock-mode synthetic invoice; live-mode TODO Razorpay subscription charge).
  cron.schedule('0 2 * * *', subscriptionRenewalJob.run, { timezone: tz });

  console.log('[JOBS] All cron jobs scheduled.');
}

module.exports = {
  startAllJobs,
  // Export individual jobs for direct invocation in tests
  commissionConfirmJob,
  tranche3Job,
  offerExpiryJob,
  apifyEngagementJob,
  campaignStatusJob,
  bookingReminderJob,
  lowWalletJob,
  negotiationExpiryJob,
  productionReminderJob,
  subscriptionRenewalJob,
};
