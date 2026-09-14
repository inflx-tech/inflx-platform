'use strict';

/**
 * Item 4 — hourly: a set whose invitation cutoff has passed with no agreement signed by both
 * sides expires. Its open invitations close so the creators see them as expired. A set where
 * at least one creator has signed carries on; the offer-expiry job handles its unanswered
 * invitations on their own clock.
 *
 * Contract: features/item4-campaigns-sets · rules v1.14 §5B, §25 · APPROVAL.md §3.3
 *
 * Idempotent: the selection requires expired_at IS NULL and the update sets it, so a second
 * run picks nothing up; the invitation update is bounded by status. One transaction per set
 * with FOR UPDATE SKIP LOCKED, so two ticks racing cannot expire the same set twice.
 */
const db = require('../config/db');
const { todayInIndia } = require('../utils/indiaDay');
const { INVITE_CUTOFF_DAYS, OPEN_STATUSES, cutoffFor } = require('../services/campaignState.service');
const { SIGNED_CONTRACT_SQL } = require('../services/collabState');
const { calendarDay } = require('../utils/indiaDay');
// Item 6 — open negotiations end with the set's invitations. Contract: features/item6-negotiation
const negotiation = require('../services/negotiation.service');
const { ENDING, NOTIFY } = require('../services/negotiationCopy');
// Item 7 — an agreement still out at the cutoff expires unsigned, and both
// sides are told. Contract: features/item7-agreement
const agreement = require('../services/agreement.service');

/**
 * @param {object} opts
 * @param {string} opts.today  'YYYY-MM-DD' in India; injectable for tests
 * @returns {{ checked:number, expired:number, invitationsClosed:number, kept:number }}
 */
async function run({ today = null } = {}) {
  const t = today || todayInIndia();
  console.log(`[CRON set-expiry] Running for ${t}...`);
  const out = { checked: 0, expired: 0, invitationsClosed: 0, kept: 0, negotiationsEnded: 0, agreementsExpired: 0 };
  const endedThreads = [];
  const lapsedAgreements = [];
  try {
    // Candidates: dated, not yet expired, cutoff day already over, at least one invitation.
    const { rows: due } = await db.query(
      `SELECT s.id FROM campaign_sets s
        WHERE s.expired_at IS NULL AND s.go_live_date IS NOT NULL
          AND (s.go_live_date - ($1::int) * INTERVAL '1 day')::date < $2::date
          AND EXISTS (SELECT 1 FROM campaign_influencers ci WHERE ci.set_id = s.id)`,
      [INVITE_CUTOFF_DAYS, t]
    );
    for (const { id } of due) {
      out.checked += 1;
      await db.withTransaction(async (tx) => {
        const { rows: locked } = await tx.query(
          `SELECT id, name FROM campaign_sets WHERE id = $1 AND expired_at IS NULL FOR UPDATE SKIP LOCKED`, [id]);
        if (!locked[0]) return; // another tick has it, or it expired meanwhile
        const { rows: signed } = await tx.query(
          `SELECT 1 FROM campaign_influencers ci JOIN contracts con ON con.campaign_influencer_id = ci.id
            WHERE ci.set_id = $1 AND ${SIGNED_CONTRACT_SQL} LIMIT 1`, [id]);
        if (signed.length) { out.kept += 1; return; }
        const { rowCount } = await tx.query(
          `UPDATE campaign_influencers SET status = 'expired'
            WHERE set_id = $1 AND status = ANY($2::campaign_influencer_status[])`,
          [id, OPEN_STATUSES]
        );
        // Item 6: an open negotiation ends with its invitation, as 'expired'; the thread stays readable.
        const ended = await negotiation.endForExpiredSet(id, tx);
        // Item 7: an agreement still out at the cutoff expires unsigned. Nothing
        // was locked — the money only moves at the brand's signature, which by
        // definition never came — and both sides are told, naming the
        // half-signed case to her because she did her part (rules v1.20 §9).
        const lapsed = await agreement.expireForSet(id, tx);
        await tx.query(`UPDATE campaign_sets SET expired_at = now() WHERE id = $1`, [id]);
        out.expired += 1;
        out.invitationsClosed += rowCount;
        out.negotiationsEnded = (out.negotiationsEnded || 0) + ended.length;
        out.agreementsExpired = (out.agreementsExpired || 0) + lapsed.length;
        endedThreads.push(...ended);
        lapsedAgreements.push(...lapsed);
        console.log(`[CRON set-expiry] Set "${locked[0].name}" (${id}) expired: nobody signed by the cutoff; ${rowCount} open invitation(s) closed; ${ended.length} negotiation(s) ended.`);
      });
    }
    // After commit: both sides of every ended thread are told, once each (N21's sentence).
    for (const e of endedThreads) {
      const ctx = await negotiation.loadContextAny(e.ci_id).catch(() => null);
      if (!ctx) continue;
      const cutoff = ctx.go_live_date ? cutoffFor(calendarDay(ctx.go_live_date)) : null;
      const body = ENDING.expired(cutoff);
      await negotiation.notify(ctx, 'brand', NOTIFY.EXPIRED, body, { negotiation_id: e.id });
      await negotiation.notify(ctx, 'influencer', NOTIFY.EXPIRED, body, { negotiation_id: e.id });
    }
    // Item 7: one sentence to each side for every agreement that lapsed.
    await agreement.notifyExpired(lapsedAgreements).catch(e => console.error('[CRON set-expiry] agreement notices failed:', e.message));
    console.log(`[CRON set-expiry] Checked ${out.checked}, expired ${out.expired}, kept ${out.kept}, invitations closed ${out.invitationsClosed}, negotiations ended ${out.negotiationsEnded || 0}, agreements expired ${out.agreementsExpired || 0}.`);
    return out;
  } catch (e) {
    console.error('[CRON set-expiry] Failed:', e.message);
    return { ...out, error: e.message };
  }
}

module.exports = { run };
