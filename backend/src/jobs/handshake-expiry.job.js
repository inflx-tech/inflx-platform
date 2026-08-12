'use strict';

/**
 * handshake-expiry.job.js — lapse unanswered requests and unbriefed agreements.
 * Contract: features/collab-part2-precampaign-handshake
 *
 * Two clocks, both admin-configurable via handshake_settings:
 *
 *   · a request nobody answered expires after request_ttl_days (default 7), so it stops
 *     occupying an active slot on either side's cap
 *   · an agreement never briefed into a campaign expires after agreement_expiry_days
 *     (default 90 — founder: "if not make detailed campaign then after three months it
 *     go expired")
 *
 * The expiry TIMESTAMPS are stamped on each row at creation; this job only flips
 * status where expires_at has passed. So a settings change affects new records, not
 * ones already sent — nobody's live negotiation shortens retroactively.
 */

const handshake = require('../services/handshake.service');

async function run() {
  console.log('[CRON handshake-expiry] Running...');
  const requests = await handshake.expireStaleRequests();
  const agreements = await handshake.expireStaleAgreements();
  console.log(`[CRON handshake-expiry] expired ${requests} request(s), ${agreements} agreement(s)`);
  return { requests, agreements };
}

module.exports = { run };
