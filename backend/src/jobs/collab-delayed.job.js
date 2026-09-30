'use strict';

/**
 * Item 10 — hourly at :05, India time: the day after a set's posting date, every signed
 * collaboration in it whose shoot is not complete is flagged Delayed, with the stage it stopped
 * at, and both sides are told once (rules v1.24 §11.1, §25).
 *
 * NOTHING ELSE MOVES. The flag is two columns on campaign_influencers; status, set, agreement,
 * escrow and wallets are untouched, and item 4's set-expiry (which keeps any set with a signed
 * member) never sees it. Item 12 will set the same flag for content not live.
 * Idempotent: delayed_at IS NULL selects, FOR UPDATE SKIP LOCKED locks, the update sets it.
 * Contract: features/item10-store-visit
 */
const shootPlan = require('../services/shootPlan.service');
// Item 11 — the Remote half of the same lane. Two functions rather than one because the two
// modes derive their stage from entirely different timestamps, and a single query that tried
// to do both would be readable by nobody.
const remoteJobs = require('../services/remoteJobs.service');
// Item 12 — the content arm, and Q9's silent stage refresh across phases.
const contentJobs = require('../services/contentJobs.service');
// Item 14 — the Pay for Sale arm, the self-confirmation (D3) and the completion safety sweep.
// Self-confirmation rides this hourly lane because, like Delayed, it is a date passing.
const saleLive = require('../services/saleLive.service');

async function run({ today = null } = {}) {
  console.log('[CRON collab-delayed] Running...');
  try {
    const visit = await shootPlan.flagDelayed({ today });
    const remote = await remoteJobs.flagDelayedRemote({ today });
    const contentArm = await contentJobs.flagDelayedContent({ today });
    const saleArm = await saleLive.flagDelayedSale({ today });
    const refreshed = await contentJobs.refreshDelayedStages();
    const autoconfirm = await saleLive.autoConfirmDue();
    const swept = await saleLive.completeSweep();
    const out = {
      checked: visit.checked + remote.checked + contentArm.checked,
      flagged: visit.flagged + remote.flagged + contentArm.flagged + saleArm.flagged,
      skippedGate: visit.skippedGate + remote.skippedGate + contentArm.skippedGate,
      failed: visit.failed + remote.failed + contentArm.failed + refreshed.failed + saleArm.failed + autoconfirm.failed,
      visit, remote, content: contentArm, refreshed, sale: saleArm, autoconfirm, completedSweep: swept,
    };
    console.log(`[CRON collab-delayed] Checked ${out.checked}, flagged ${out.flagged} (visit ${visit.flagged}, remote ${remote.flagged}, content ${contentArm.flagged}, sale ${saleArm.flagged}), sale confirmed by itself ${autoconfirm.confirmed}, completed ${autoconfirm.completed + swept.completed}, stages refreshed ${refreshed.updated}, skipped (gate closed) ${out.skippedGate}, failed ${out.failed}.`);
    return out;
  } catch (e) {
    console.error('[CRON collab-delayed] Failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { run };
