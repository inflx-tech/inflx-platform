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
// collab-part2 — lapse unanswered handshake requests + unbriefed agreements.
const handshakeExpiryJob   = require('./handshake-expiry.job');
const apifyEngagementJob   = require('./apify-engagement.job');
const campaignStatusJob    = require('./campaign-status.job');
const bookingReminderJob   = require('./booking-reminder.job');
const lowWalletJob         = require('./low-wallet-alert.job');
// Item 6 — the 48-hour negotiation-expiry job is retired (rules v1.18 §7B: no automatic decline;
// the set's cutoff is the only deadline). Its hourly replacement expires pool entries and sends
// the two silence reminders. Contract: features/item6-negotiation
const negotiationHousekeepingJob = require('./negotiation-housekeeping.job');
const productionReminderJob = require('./production-shipment-reminder.job');
const subscriptionRenewalJob = require('./subscription-renewal.job');
const settlementRetryJob     = require('./settlement-retry.job');
const commerceSettlementJob  = require('./commerce-settlement.job');
// follower-app-v2 — each post's results across shoppers, for the learning feed (off by default).
const postPerformanceJob     = require('./post-performance.job');
const postsOfferEndedJob     = require('./posts-offer-ended.job');
const checkoutExpiryJob      = require('./checkout-expiry.job');
// Item 3b — creator social numbers (Instagram/YouTube through Apify). Contract: features/item3b-social-numbers
const socialMeasureJob       = require('./social-measure.job');
// Item 4 — a set whose cutoff passed with nobody signed expires. Contract: features/item4-campaigns-sets
const setExpiryJob           = require('./set-expiry.job');
// Item 8 — the pitch lane: the two reminders, the unanswered close, and the early
// close when her date nears. Contract: features/item8-pitch
const pitchHousekeepingJob   = require('./pitch-housekeeping.job');
// Item 10 — the store visit's two lanes: Delayed and reminders. The auto-confirm lane was
// retired on 1 Oct 2026 (founder): only the brand confirms a store visit.
// Contract: features/item10-store-visit
const collabDelayedJob      = require('./collab-delayed.job');
const shootRemindersJob      = require('./shoot-reminders.job');
// Item 11 — the Remote return confirms itself at the stamped due.
// Contract: features/item11-remote
const remoteReturnAutoConfirmJob = require('./remote-return-autoconfirm.job');

// Wrap offer-expiry to expose run() interface (it exports runOfferExpiryJob)
const offerExpiryRun       = () => offerExpiryJob.runOfferExpiryJob();

function startAllJobs() {
  if (!env.ENABLE_CRONS) {
    console.log('[JOBS] ENABLE_CRONS=false — cron schedules not registered (test mode)');
    return;
  }

  const tz = env.CRON_TIMEZONE || 'Asia/Kolkata';
  console.log(`[JOBS] Starting all cron jobs (timezone: ${tz})`);

  // commission-confirm — 00:01 IST daily
  cron.schedule('1 0 * * *', commissionConfirmJob.run, { timezone: tz });

  // tranche-3-release — hourly (Wave 1 of Tax/Settlement Roadmap).
  // The exact release time-of-day is honored via the SQL predicate in
  // the job (reads payment_config.tranche_3_release_time_ist). Cron
  // fires hourly; eligible rows release at the first hourly tick at or
  // after the configured IST time on the day-N boundary.
  cron.schedule('0 * * * *', tranche3Job.run, { timezone: tz });

  // offer-expiry — every 15 minutes
  cron.schedule('0,15,30,45 * * * *', offerExpiryRun, { timezone: tz });

  // handshake-expiry — hourly. Requests lapse on request_ttl_days, agreements on
  // agreement_expiry_days (founder: three months unbriefed). Hourly is plenty —
  // the shortest clock is measured in days.
  cron.schedule('20 * * * *', handshakeExpiryJob.run, { timezone: tz });

  // negotiation-housekeeping — hourly: pool expiry + closing notices, silence reminders (item 6)
  cron.schedule('50 * * * *', () => negotiationHousekeepingJob.run(), { timezone: tz });

  // apify-engagement — 06:00 UTC daily
  cron.schedule('0 6 * * *', apifyEngagementJob.run);

  // campaign-status — 00:05 UTC daily
  cron.schedule('5 0 * * *', campaignStatusJob.run);

  // booking-reminder — 01:00 UTC daily
  cron.schedule('0 1 * * *', bookingReminderJob.run, { timezone: 'UTC' });

  // low-wallet-alert — 09:00 UTC daily
  cron.schedule('0 9 * * *', lowWalletJob.run);

  // production-shipment-reminder — RETIRED by item 11 (approval §3.3). NOT SCHEDULED.
  //
  // It nudged on `mode='shipment' AND status='in_progress' AND shipment_dispatched_at` — the
  // hand-typed dispatch item 11 retires, so it can never match again. It also asked NO GATE
  // (it would have nudged an unsigned collaboration) and sent an SMS at 14 days, which is the
  // only SMS anywhere in the shoot. Item 11's `:55` lane covers every Remote move at 48 hours,
  // behind the gate, push and in-app only.
  //
  // The file stays for the moment so its behaviour is readable beside the replacement; nothing
  // calls `.run()` but the tests. Contract: features/item11-remote

  // subscription-renewal — 02:00 IST daily; charges due brand_subscriptions
  // (mock-mode synthetic invoice; live-mode TODO Razorpay subscription charge).
  cron.schedule('0 2 * * *', subscriptionRenewalJob.run, { timezone: tz });

  // settlement-retry — hourly at :20; retries commerce Route transfers left
  // null (brand onboarded a payout account after the sale, or a transient Route
  // failure). Dormant in practice until brands onboard + Route is enabled.
  cron.schedule('20 * * * *', settlementRetryJob.run, { timezone: tz });

  // commerce-settlement (Money G-3) — 00:05 IST daily; pays brands their NET
  // commerce share only AFTER the order return window has closed (deferred from
  // sale time). Runs just after commission-confirm (00:01) so both honour the
  // same window boundary on the same tick.
  cron.schedule('5 0 * * *', commerceSettlementJob.run, { timezone: tz });

  // post-performance (follower-app-v2) — hourly at :17; the learning feed's "how it performs" dial.
  cron.schedule('17 * * * *', () => postPerformanceJob.run(), { timezone: tz });
  // shoppable-posts-v2 — an offer past its end date takes its posts out of the shop (4.9).
  cron.schedule('10 0 * * *', () => postsOfferEndedJob.run(), { timezone: tz });
  // checkout-expiry (shopper-ordering) — every 5 minutes; an online payment's 15-minute hold ends (6.8).
  cron.schedule('*/5 * * * *', () => checkoutExpiryJob.run(), { timezone: tz });

  // social-measure (item 3b) — hourly at :25; picks due accounts with row locking, honours
  // the monthly Apify budget, retries failures the next day.
  cron.schedule('25 * * * *', socialMeasureJob.run, { timezone: tz });

  // set-expiry (item 4) — hourly at :40, India time. One transaction per set, row-locked;
  // expired_at is the guard that makes a second run a no-op.
  cron.schedule('40 * * * *', () => setExpiryJob.run(), { timezone: tz });

  // pitch-housekeeping (item 8) — hourly at :35, India time. Reminders at 7 and 21 days
  // while the brand still owes the first answer, then the two closes. Every write is
  // guarded, so a second run in the same hour changes nothing.
  cron.schedule('35 * * * *', () => pitchHousekeepingJob.run(), { timezone: tz });

  // Item 10 — two lanes on the free minutes, so no two touch a shoot at once:
  //   :05 Delayed flag (before set-expiry at :40 has run for the hour — independent anyway),
  //   :55 reminders. Every write is guarded; a second run in the same hour changes nothing.
  //   (:45 was the store visit's auto-confirm, retired 1 Oct 2026.)
  cron.schedule('5 * * * *',  () => collabDelayedJob.run(), { timezone: tz });
  cron.schedule('55 * * * *', () => shootRemindersJob.run(), { timezone: tz });

  // Item 11 — :15, the only free minute left, so no two lanes touch a shoot at once. The
  // Delayed lane at :05 and the reminder lane at :55 are item 10's and now carry BOTH modes;
  // this one is item 11's own: a Remote return the brand has not confirmed by its STAMPED due
  // confirms itself. Contract: features/item11-remote
  cron.schedule('15 * * * *', () => remoteReturnAutoConfirmJob.run(), { timezone: tz });

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
  negotiationHousekeepingJob,
  productionReminderJob,
  subscriptionRenewalJob,
  settlementRetryJob,
  commerceSettlementJob,
  postPerformanceJob,
  postsOfferEndedJob,
  checkoutExpiryJob,
  socialMeasureJob,
  setExpiryJob,
  pitchHousekeepingJob,
  collabDelayedJob,
  shootRemindersJob,
  remoteReturnAutoConfirmJob,
};
