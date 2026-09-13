'use strict';

/**
 * Item 5 — the creator's two answers, shared by the new invitation endpoints and the legacy
 * /offers handlers so accept and decline behave the same whichever door is used.
 * Contract: features/item5-invitations · rules v1.16 §7A · prompt §6.11, §7
 *
 *   accept   invited → accepted (open group: applied), answered_at, the draft contract for a
 *            handpick set, the brand told
 *   decline  invited | negotiating | accepted → declined with one of the five reasons and an
 *            optional note (≤ 200), answered_at, an unsigned contract deleted, the brand told
 *            the reason AND the note (APPROVAL.md Q3)
 *
 * Both refuse after the set's cutoff ("This invitation closed on {date}.") and a second answer
 * ("You've already answered this invitation.").
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const notificationService = require('./notification.service');
const campaignState = require('./campaignState.service');
const { calendarDay, todayInIndia, isBefore } = require('../utils/indiaDay');
const { MSG, DECLINE_REASONS, NOTIFY } = require('./invitationCopy');

const REASON_CODES = DECLINE_REASONS.map(r => r.code);
/** Legacy codes stay accepted on the legacy door so an older app build is not refused. */
const LEGACY_REASON_CODES = ['already_partnered'];

/** The row with what the answers need: set, campaign, brand, creator. */
async function loadForCreator(ciId, influencerId) {
  const { rows } = await db.query(
    `SELECT ci.*, cs.campaign_id, cs.name AS set_name, cs.goal, cs.influencer_mode, cs.go_live_date, cs.expired_at,
            c.brand_id, c.name AS campaign_name, c.allow_negotiation,
            b.business_name AS brand_name, bu.id AS brand_user_id, bu.fcm_token AS brand_fcm_token,
            COALESCE(i.full_name, u.name) AS creator_name
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = c.brand_id JOIN users bu ON bu.id = b.user_id
       JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
      WHERE ci.id = $1 AND ci.influencer_id = $2`,
    [ciId, influencerId]
  );
  return rows[0] || null;
}

/** After the cutoff nothing can be answered (§7A). */
function assertNotClosed(row, today = null) {
  if (!row.go_live_date) return;
  const cutoff = campaignState.cutoffFor(calendarDay(row.go_live_date));
  const t = today || todayInIndia();
  if (row.expired_at || (cutoff && isBefore(cutoff, t))) {
    throw new AppError('INVITE_CLOSED', MSG.ANSWER_CLOSED(cutoff), 422, 'status');
  }
}

async function notifyBrand(row, { type, title, body }) {
  await notificationService.send({
    userId: row.brand_user_id, type, title, body,
    data: { screen: 'set_detail', campaign_id: row.campaign_id, set_id: row.set_id, campaign_influencer_id: row.id },
    fcmToken: row.brand_fcm_token, sendSms: false,
  }).catch(err => console.error(`[NOTIFICATION] ${type} send failed:`, err.message));
}

/**
 * @param {object} row  from loadForCreator
 * @returns {{ ci: object, contractError: string|null }}
 */
async function accept(row, { today = null } = {}) {
  if (row.status !== 'invited') {
    if (['accepted', 'applied', 'declined', 'negotiating', 'contracted', 'active', 'completed'].includes(row.status)) {
      throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');
    }
    throw new AppError('VALIDATION_ERROR', MSG.ANSWER_CLOSED(campaignState.cutoffFor(calendarDay(row.go_live_date))), 422, 'status');
  }
  assertNotClosed(row, today);
  const isOpenGroup = row.influencer_mode === 'open_group';
  const nextStatus = isOpenGroup ? 'applied' : 'accepted';
  const { rows } = await db.query(
    `UPDATE campaign_influencers
        SET status = $2, answered_at = now(), agreed_fee = COALESCE(agreed_fee, influencer_budget)
      WHERE id = $1 AND status = 'invited' RETURNING *`,
    [row.id, nextStatus]
  );
  if (!rows[0]) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');

  await notifyBrand(row, isOpenGroup
    ? { type: 'application.received', title: 'New application', body: `${row.creator_name} applied to your campaign "${row.campaign_name}"` }
    : { type: NOTIFY.ACCEPTED.type, title: NOTIFY.ACCEPTED.title, body: NOTIFY.ACCEPTED.body(row.creator_name, row.set_name) });

  // The draft contract, handpick only (item 7 reads the terms from the row).
  let contractError = null;
  if (!isOpenGroup) {
    try {
      const contractService = require('./contract.service');
      await contractService.autoCreate(row.id);
    } catch (e) {
      console.error('[CONTRACT] Auto-create failed on accept:', e.message);
      contractError = e.message;
    }
  }
  return { ci: rows[0], contractError };
}

/**
 * @param {object} row       from loadForCreator
 * @param {object} p         { reason, note, legacyCodes }
 */
async function decline(row, { reason, note, legacyCodes = false, today = null } = {}) {
  if (!reason) throw new AppError('VALIDATION_ERROR', MSG.DECLINE_REASON, 422, 'reason');
  const allowed = legacyCodes ? [...REASON_CODES, ...LEGACY_REASON_CODES] : REASON_CODES;
  if (!allowed.includes(reason)) throw new AppError('VALIDATION_ERROR', MSG.DECLINE_REASON, 422, 'reason');
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length > 200) throw new AppError('VALIDATION_ERROR', MSG.DECLINE_NOTE_LONG, 422, 'note');

  if (!['invited', 'negotiating', 'accepted'].includes(row.status)) {
    if (['declined', 'withdrawn', 'removed', 'expired'].includes(row.status)) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');
    throw new AppError('VALIDATION_ERROR', `Cannot decline offer in '${row.status}' status`, 422, 'status');
  }
  assertNotClosed(row, today);

  const ci = await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE campaign_influencers
          SET status = 'declined', declined_reason = $2, declined_note = $3, answered_at = COALESCE(answered_at, now())
        WHERE id = $1 AND status = ANY('{invited,negotiating,accepted}'::campaign_influencer_status[]) RETURNING *`,
      [row.id, reason, text || null]
    );
    if (!rows[0]) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');
    // A contract nobody has signed must not sit there as though she might still sign it.
    await tx.query(`DELETE FROM contracts WHERE campaign_influencer_id = $1 AND influencer_signed_at IS NULL AND brand_signed_at IS NULL`, [row.id]);
    return rows[0];
  });

  await notifyBrand(row, { type: NOTIFY.DECLINED.type, title: NOTIFY.DECLINED.title, body: NOTIFY.DECLINED.body(row.creator_name, row.set_name, reason, text || null) });
  return { ci };
}

module.exports = { loadForCreator, assertNotClosed, accept, decline, REASON_CODES, LEGACY_REASON_CODES };
