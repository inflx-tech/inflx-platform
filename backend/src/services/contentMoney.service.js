'use strict';

/**
 * contentMoney.service.js — the second 25% and the final 50%, and nothing else.
 * Contract: features/item12-content · gap report §3.4 · approval §3.2, Q4, Q5, Q10 · checks 14, 18–21, 30–33
 *
 * The ONLY place outside the brand's signature that releases a fixed-fee tranche. Item 9's
 * `processTrancheRelease` is called unchanged — it locks the row, is idempotent in itself, credits
 * her wallet with `net_to_influencer` (= the tranche, nothing deducted), writes her ledger and the
 * brand's audit pair. Items 14 and 15 will call this same service for Hybrid.
 *
 * What this file adds around it:
 *   · releaseSecond — at the brand's confirmation: the escrow rows taken FOR UPDATE, tranche 2
 *     released, tranche 3 queued with its due date STAMPED on the row (finding 2: the wait was
 *     read live on every job run, so a change to the number moved a date already promised).
 *   · releaseFinal  — the job's step for one due row: released, and the collaboration completed
 *     in the SAME transaction, so a notification that fails afterwards can never lose completion.
 *   · dueAtFor      — the IST calendar day of the confirmation + N days, at the configured
 *     release time (03:00 IST by default). C12's "arrives on 30 Oct" is then exact (Q5).
 *
 * The campaign fee is not touched here and is never part of her split (§3, v1.29).
 */

const escrowService = require('./escrow.service');
const platformSettings = require('./platformSettings.service');
const taxService = require('./tax.service');
const { istDayOf, addDays } = require('../utils/indiaDay');

/** The stamped release moment: the IST day of `at` + `days`, at `timeIst` ('HH:MM[:SS]'). */
function dueAtFor(at, days, timeIst = '03:00:00') {
  const day = addDays(istDayOf(at), Number(days));
  const t = /^\d{2}:\d{2}(:\d{2})?$/.test(String(timeIst)) ? String(timeIst) : '03:00:00';
  return new Date(`${day}T${t.length === 5 ? `${t}:00` : t}+05:30`);
}

/** The three escrow rows of a collaboration, locked for the caller's transaction. */
async function lockEscrow(client, ciId) {
  const { rows } = await client.query(
    `SELECT * FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number FOR UPDATE`, [ciId]);
  const by = {};
  for (const r of rows) by[r.tranche_number] = r;
  return by;
}

/**
 * At the brand's confirmation (G10), inside its transaction. Returns what moved and when the
 * rest follows. Throws if the rows are not in the one state this may run from.
 * @param {object} client
 * @param {{ ciId, influencerId, brandId, campaignId, at: Date }} c
 */
async function releaseSecond(client, { ciId, influencerId, brandId, campaignId, at = new Date() }) {
  const t = await lockEscrow(client, ciId);
  if (!t[1] || !t[2] || !t[3]) throw new Error(`contentMoney: ${ciId} has no escrow set`);
  if (t[1].status !== 'released') throw new Error(`contentMoney: ${ciId} tranche 1 is ${t[1].status}`);
  if (t[2].status !== 'locked' || t[3].status !== 'locked') {
    throw new Error(`contentMoney: ${ciId} tranches are ${t[2].status}/${t[3].status}, not locked/locked`);
  }

  const second = await escrowService.processTrancheRelease(client, t[2].id, influencerId, brandId, campaignId);
  if (second.alreadyReleased) throw new Error(`contentMoney: ${ciId} tranche 2 was already released`);

  const waitDays = await platformSettings.get('final_payment_wait_days');
  const releaseTime = await taxService.getTrancheReleaseTimeIst();
  const dueAt = dueAtFor(at, waitDays, releaseTime);
  const { rowCount } = await client.query(
    `UPDATE escrow_entries SET status = 'queued', triggered_at = $2, release_due_at = $3
      WHERE id = $1 AND status = 'locked'`, [t[3].id, at, dueAt]);
  if (rowCount !== 1) throw new Error(`contentMoney: ${ciId} tranche 3 could not be queued`);

  return {
    secondAmount: Number(t[2].amount), finalAmount: Number(t[3].amount),
    waitDays, dueAt, releasedAt: at, t2EscrowId: t[2].id, t3EscrowId: t[3].id,
  };
}

/**
 * One due tranche 3, for the job, inside its transaction. The row is taken FOR UPDATE SKIP LOCKED
 * so two runners never wait on each other; a row another runner holds is simply not ours.
 * Returns null when there is nothing (any more) to do — already released, taken, not due, or held
 * by a brand's report (approval Q10 — defensive: today's flow cannot produce a queued tranche
 * under a brand report, and this proves it would still not pay).
 */
async function releaseFinal(client, escrowId, { now = new Date() } = {}) {
  const { rows: [e] } = await client.query(
    `SELECT ee.*, ci.influencer_id, ci.id AS ci_id, cs.campaign_id, c.brand_id
       FROM escrow_entries ee
       JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
      WHERE ee.id = $1 AND ee.status = 'queued'
      FOR UPDATE OF ee SKIP LOCKED`, [escrowId]);
  if (!e) return null;
  if (e.release_due_at && new Date(e.release_due_at) > now) return null;

  const { rows: [cc] } = await client.query(
    `SELECT id, brand_reported_at FROM collab_content WHERE campaign_influencer_id = $1 FOR UPDATE`, [e.ci_id]);
  if (cc && cc.brand_reported_at) return { skipped: 'brand_report', ciId: e.ci_id };

  // Item 21 (rules v1.34 §12.2, D3): a Pay for Content final 50% is released at the LATER of its
  // date and INFLX approving the agreed number of shoppable posts. Short of them, the row waits
  // and says why; the approval that completes the number releases it (releaseHeldFinal).
  const hold = await postsHold(client, e.ci_id);
  if (hold) {
    await client.query(`UPDATE escrow_entries SET release_held_for_posts = true WHERE id = $1 AND NOT release_held_for_posts`, [e.id]);
    return { skipped: 'posts', ciId: e.ci_id, short: hold.short };
  }

  const out = await escrowService.processTrancheRelease(client, e.id, e.influencer_id, e.brand_id, e.campaign_id);
  if (out.alreadyReleased) return null;
  await client.query(`UPDATE escrow_entries SET release_held_for_posts = false WHERE id = $1 AND release_held_for_posts`, [e.id]);

  const done = await afterFinalPaid(client, { ciId: e.ci_id, campaignId: e.campaign_id }, cc || null);
  return {
    ciId: e.ci_id, amount: Number(e.net_to_influencer), completed: done.completed, completedCampaign: done.completedCampaign,
    campaignId: e.campaign_id, brandId: e.brand_id, influencerId: e.influencer_id, hasContent: !!cc,
    ...(done.hybrid ? { hybrid: true } : {}),
  };
}

/**
 * Item 21 — is this collaboration's final 50% held for its shoppable posts? { n, approved, short }
 * when it is a Pay for Content collaboration signed with posts and still short of them; null otherwise.
 */
async function postsHold(client, ciId) {
  const { rows: [x] } = await client.query(
    `SELECT ci.sell_v2, ci.shoppable_posts_n, cs.goal,
            (SELECT count(*)::int FROM creator_posts cp WHERE cp.campaign_influencer_id = ci.id AND cp.v2 AND cp.approved_at IS NOT NULL) AS approved
       FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id WHERE ci.id = $1`, [ciId]);
  if (!x || x.goal !== 'engagement' || !x.sell_v2 || x.shoppable_posts_n == null) return null;
  const n = Number(x.shoppable_posts_n);
  return x.approved >= n ? null : { n, approved: x.approved, short: n - x.approved };
}

/**
 * Item 21 — INFLX approved a post: if this collaboration's final 50% is queued, its date has passed
 * and the agreed number is now reached, release it here, in the caller's transaction. Returns what
 * releaseFinal returns, or null when there is nothing due.
 */
async function releaseHeldFinal(client, ciId, { now = new Date() } = {}) {
  const { rows: [e] } = await client.query(
    `SELECT id, release_due_at FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 3 AND status = 'queued'`, [ciId]);
  if (!e) return null;
  if (e.release_due_at && new Date(e.release_due_at) > now) return null;     // the job pays it on its date
  const out = await releaseFinal(client, e.id, { now });
  return out && !out.skipped ? out : null;
}

/**
 * What follows a final 50% being released, in the SAME transaction as the money — whoever
 * released it: the job on its date (releaseFinal, above) or INFLX settling a dispute by hand
 * (item 17, adminMoney.releasePayment). `cc` is the collaboration's content row, already locked
 * by the caller, or null when it has none.
 */
async function afterFinalPaid(client, { ciId, campaignId }, cc) {
  // Item 15 (rules v1.30, H2): Hybrid's final 50% is paid on its date whatever Path 1 shows;
  // Completed waits for the minimum of approved posts too — saleLive decides, in this transaction.
  const { rows: [gx] } = await client.query(
    `SELECT cs.goal FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id WHERE ci.id = $1`, [ciId]);
  if (gx && gx.goal === 'hybrid') {
    if (cc) await client.query(`UPDATE collab_content SET t3_released_at = now(), updated_at = now() WHERE id = $1`, [cc.id]);
    const done = await require('./saleLive.service').completeIfDue(client, ciId);
    return { completed: !!(done && done.completed), completedCampaign: !!(done && done.completedCampaign), hybrid: true };
  }

  // Completion, in the same transaction as the money (approval §3.5, check 36).
  const { rows: all } = await client.query(`SELECT status FROM escrow_entries WHERE campaign_influencer_id = $1`, [ciId]);
  const allReleased = all.length > 0 && all.every((x) => x.status === 'released');
  let completedCampaign = false;
  if (allReleased) {
    await client.query(`UPDATE campaign_influencers SET status = 'completed' WHERE id = $1 AND status <> 'completed'`, [ciId]);
    if (cc) {
      await client.query(
        `UPDATE collab_content SET t3_released_at = now(), completed_at = now(), updated_at = now()
          WHERE id = $1 AND completed_at IS NULL`, [cc.id]);
    }
    const { rows: cis } = await client.query(
      `SELECT ci.status FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id WHERE cs.campaign_id = $1`,
      [campaignId]);
    if (cis.length > 0 && cis.every((x) => x.status === 'completed')) {
      const { rowCount } = await client.query(
        `UPDATE campaigns SET status = 'completed', completed_at = now() WHERE id = $1 AND status <> 'completed'`, [campaignId]);
      completedCampaign = rowCount === 1;
    }
  }
  return { completed: allReleased, completedCampaign, hybrid: false };
}

/**
 * "Still locked" — her fee still in escrow, from the escrow rows alone (Q1, v1.29, check 31).
 * Never `locked_amount − released_amount`: locked_amount includes the campaign fee, which the brand
 * paid once at signing and which is never hers, so that sum would show the fee as locked forever.
 */
function stillLockedOf(escrowRows) {
  return Math.round((escrowRows || [])
    .filter((e) => e.status !== 'released' && e.status !== 'refunded')
    .reduce((s, e) => s + Number(e.amount || 0), 0) * 100) / 100;
}

module.exports = { dueAtFor, lockEscrow, releaseSecond, releaseFinal, stillLockedOf, afterFinalPaid, postsHold, releaseHeldFinal };
