'use strict';

/**
 * remoteJobs.service.js — J1, and item 11's half of the two lanes item 10 already owns.
 * Contract: features/item11-remote · §10 of the gap report · checks 27, 30, 31, 32, 50, 59
 *
 * Three lanes touch a Remote shoot:
 *   :05  collab-delayed        — item 10's, extended with the five Remote stages
 *   :15  remote-return-autoconfirm  — J1, item 11's own
 *   :55  shoot-reminders       — item 10's, extended with the six Remote moves and the
 *                                overdue return
 *
 * Each runs on a free minute so no two touch a shoot at once, each is idempotent by a
 * compare-and-swap, and each sends its notifications AFTER the transaction commits.
 */

const db = require('../config/db');
const shootGate = require('./shootGate.service');
const shipping = require('./shipping');
const shoot = require('./remoteShoot.service');
const { NOTIFY11 } = require('./productionCopy');
const { longDate } = require('./campaignCopy');
const { logAction } = require('./production.service');
const { todayInIndia, calendarDay, istDayOf, daysBetween } = require('../utils/indiaDay');

/* ───────────────────────────────────────────── J1 — the return confirms itself */

async function autoConfirmReturns({ now = new Date() } = {}) {
  const out = { checked: 0, confirmed: 0, skippedReported: 0, skippedGate: 0, failed: 0 };

  const { rows } = await db.query(
    `SELECT s.id, s.production_event_id, pe.contract_id,
            pe.return_reported_at,
            (SELECT count(*)::int FROM production_event_items i
              WHERE i.production_event_id = pe.id AND i.reported_at IS NOT NULL) AS reported_lines
       FROM shipments s
       JOIN production_events pe ON pe.id = s.production_event_id
      WHERE s.direction = 'return'
        AND s.autoconfirm_due_at IS NOT NULL AND s.autoconfirm_due_at <= $1
        AND s.autoconfirmed_at IS NULL AND s.confirmed_at IS NULL
        AND s.cancelled_at IS NULL`, [now]);

  const told = [];
  for (const row of rows) {
    out.checked += 1;
    // §11.2 — "unless the Brand has reported an item missing or damaged".
    if (row.return_reported_at || Number(row.reported_lines) > 0) { out.skippedReported += 1; continue; }
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.withTransaction(async (tx) => {
        const { rows: locked } = await tx.query(
          `SELECT id FROM shipments
            WHERE id = $1 AND autoconfirmed_at IS NULL AND confirmed_at IS NULL
            FOR UPDATE SKIP LOCKED`, [row.id]);
        if (!locked[0]) return;

        const gate = await shootGate.assertShootOpen(row.contract_id, tx).catch(() => null);
        if (!gate) { out.skippedGate += 1; return; }

        const { rowCount } = await tx.query(
          `UPDATE shipments SET autoconfirmed_at = $2, updated_at = now()
            WHERE id = $1 AND autoconfirmed_at IS NULL AND confirmed_at IS NULL`, [row.id, now]);
        if (rowCount === 0) return;

        // The lines say honestly that nobody looked at them.
        await tx.query(
          `UPDATE production_event_items
              SET return_auto_confirmed_at = $2, updated_at = now()
            WHERE production_event_id = $1 AND returned_on_shipment_id = $3 AND return_status IS NULL`,
          [row.production_event_id, now, row.id]);

        await logAction(tx, row.production_event_id, null, 'system', 'return_auto_confirmed',
          'The brand did not confirm in time; the return confirmed itself', { shipment_id: row.id });
        out.confirmed += 1;
        told.push(gate.ciId);
      });
    } catch (e) {
      out.failed += 1;
      console.error('[remote-return-autoconfirm] failed for', row.id, e.message);
    }
  }

  // After commit: both sides, once each.
  for (const ciId of told) {
    // eslint-disable-next-line no-await-in-loop
    const r = await shoot.loadAny(ciId);
    if (!r) continue;
    // eslint-disable-next-line no-await-in-loop
    await shoot.notifyBrand(r, NOTIFY11.RETURN_CONFIRMED,
      `You didn't confirm ${shoot.first(r.creator_name)}'s return by the date, so it was marked confirmed.`);
    // eslint-disable-next-line no-await-in-loop
    await shoot.notifyCreator(r, NOTIFY11.RETURN_CONFIRMED,
      `${r.brand_name} didn't confirm by the date, so the return was confirmed automatically. That's everything.`);
  }
  return out;
}

/* ───────────────────────────────────────────── J2a — Delayed, the Remote half */

/**
 * The day after the posting date, a Remote collaboration whose shoot is not done is flagged
 * Delayed with the stage it stopped at (§11.2). **NOTHING ELSE MOVES.**
 *
 * THE RETURN LANE NEVER DELAYS ANYTHING (§11.2, D8). A return outstanding past the posting
 * date is OVERDUE — a different word, on a different card, with a different remedy.
 */
async function flagDelayedRemote({ today = null } = {}) {
  const t = today || todayInIndia();
  const out = { checked: 0, flagged: 0, skippedGate: 0, failed: 0 };

  const { rows } = await db.query(
    `SELECT ci.id AS ci_id, con.id AS contract_id, pe.id AS pe_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
       LEFT JOIN production_events pe ON pe.contract_id = con.id
      WHERE ci.delayed_at IS NULL AND cs.go_live_date IS NOT NULL AND cs.go_live_date < $1::date
        AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL
        AND (pe.id IS NULL OR pe.influencer_completed_at IS NULL)
        -- item 10 flags 'visit'; this lane flags everything else, which is Remote.
        AND COALESCE(pe.mode, cs.shoot_mode, 'remote') <> 'visit'`, [t]);

  const told = [];
  for (const row of rows) {
    out.checked += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.withTransaction(async (tx) => {
        const { rows: locked } = await tx.query(
          `SELECT id FROM campaign_influencers WHERE id = $1 AND delayed_at IS NULL FOR UPDATE SKIP LOCKED`, [row.ci_id]);
        if (!locked[0]) return;
        const gate = await shootGate.shootGate(row.ci_id, tx);
        if (!gate || !gate.open) { out.skippedGate += 1; return; }

        const { rows: [pe] } = await tx.query(`SELECT * FROM production_events WHERE contract_id = $1`, [row.contract_id]);
        const parcel = pe ? await shipping.lastOutbound(pe.id, tx) : null;
        const lines = pe ? await shoot.linesOf(pe.id, tx) : [];
        const stage = shoot.delayedStageOf(pe, parcel, lines) || 'address_not_sent';

        const { rowCount } = await tx.query(
          `UPDATE campaign_influencers SET delayed_at = now(), delayed_stage = $2 WHERE id = $1 AND delayed_at IS NULL`,
          [row.ci_id, stage]);
        if (rowCount === 0) return;
        if (pe) {
          await logAction(tx, pe.id, null, 'system', 'delayed',
            `Posting date passed; flagged Delayed at: ${stage}`, { stage });
        }
        out.flagged += 1;
        told.push({ ciId: row.ci_id, stage });
      });
    } catch (e) {
      out.failed += 1;
      console.error('[collab-delayed:remote] failed for', row.ci_id, e.message);
    }
  }

  for (const { ciId } of told) {
    // eslint-disable-next-line no-await-in-loop
    const r = await shoot.loadAny(ciId);
    if (!r) continue;
    const day = longDate(calendarDay(r.go_live_date));
    // §11.2, as R15b/R16 say it: nothing moved, and nobody is blamed.
    // eslint-disable-next-line no-await-in-loop
    await shoot.notifyBrand(r, NOTIFY11.DELAYED,
      `The ${day} posting date passed before ${shoot.first(r.creator_name)}'s shoot finished. This is now a delayed collaboration — nothing has changed about the money, and everything still works.`);
    // eslint-disable-next-line no-await-in-loop
    await shoot.notifyCreator(r, NOTIFY11.DELAYED,
      `The ${day} posting date passed before the shoot finished. Nothing has changed — what you were paid at signing stays yours, and you can carry on.`);
  }
  return out;
}

/* ───────────────────────────────────────────── J2b — the 48-hour lane */

/**
 * Six moves, one rule (D7). ONE open move at a time, because the Remote flow is strictly
 * sequential — which is what makes a single `remote_reminder_sent_at` column honest
 * (approval §2.6).
 *
 * "48 hours since the LATER of the anchor and the last reminder." When the open move changes,
 * the ANCHOR changes, so the next reminder waits 48 hours from the new anchor rather than from
 * the old reminder (check 59).
 *
 * Nothing after the posting date — the Delayed flag takes over — WITH ONE EXEMPTION: an
 * OVERDUE RETURN keeps reminding her past it, because §11.2 says so in as many words
 * ("the Creator is reminded") and the return's clock is not the posting date's.
 */
async function remindRemote({ now = new Date() } = {}) {
  const today = todayInIndia();
  const out = { checked: 0, sent: 0 };

  const { rows } = await db.query(
    `SELECT pe.id AS pe_id, pe.contract_id, ci.id AS ci_id, cs.go_live_date
       FROM production_events pe
       JOIN contracts con ON con.id = pe.contract_id
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
      WHERE COALESCE(pe.mode, cs.shoot_mode, 'remote') <> 'visit'
        AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL`);

  for (const row of rows) {
    out.checked += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await shoot.loadAny(row.ci_id);
      if (!r || !r.id) continue;
      // eslint-disable-next-line no-await-in-loop
      const move = await openMove(r);
      if (!move) continue;

      const pastPosting = row.go_live_date && calendarDay(row.go_live_date) < today;
      if (pastPosting && move.key !== 'return_overdue') continue;   // the one exemption

      const last = r.remote_reminder_sent_at;
      const anchor = last && new Date(last).getTime() > new Date(move.since).getTime() ? last : move.since;
      if (now.getTime() - new Date(anchor).getTime() < 48 * 3600000) continue;

      // eslint-disable-next-line no-await-in-loop
      const gate = await shootGate.assertShootOpen(row.contract_id).catch(() => null);
      if (!gate) continue;

      // eslint-disable-next-line no-await-in-loop
      if (move.side === 'brand') await shoot.notifyBrand(r, NOTIFY11.REMINDER, move.body(r));
      // eslint-disable-next-line no-await-in-loop
      else await shoot.notifyCreator(r, NOTIFY11.REMINDER, move.body(r));

      // eslint-disable-next-line no-await-in-loop
      await db.query(`UPDATE production_events SET remote_reminder_sent_at = $2 WHERE id = $1`, [row.pe_id, now]);
      out.sent += 1;
    } catch (e) {
      console.error('[shoot-reminders:remote] failed for', row.ci_id, e.message);
    }
  }
  return out;
}

/**
 * ⭐ THE ONE RULE BOTH SIDES READ (D7).
 *
 * Needs You and the reminder lane ask this same function, so a badge can never disagree with a
 * nudge, and neither can disagree with the screen. Item 10 settled that pattern; item 11 keeps
 * it. Returns null when nothing is waiting on anybody.
 */
async function openMove(r, conn = db) {
  if (!r || !r.id) return null;
  const lines = await shoot.linesOf(r.id, conn);
  const parcel = await shipping.lastOutbound(r.id, conn);
  const ret = await shipping.liveReturn(r.id, conn);
  const who = shoot.first(r.creator_name);

  // 1 — her address. Nothing else can happen until it arrives.
  if (!r.address_sent_at) {
    return { key: 'address', side: 'creator', since: r.brand_signed_at || r.created_at,
      body: (x) => `${x.brand_name} is waiting for your delivery address before they can send your products.` };
  }
  // 2 — the brand picks and books.
  const live = parcel && parcel.booked_at && !parcel.cancelled_at && !parcel.returned_to_store_at;
  if (!live) {
    // …or books again, after the courier brought it back.
    if (parcel && parcel.returned_to_store_at && !parcel.rebooked_from_id) {
      return { key: 'rebook', side: 'brand', since: parcel.returned_to_store_at,
        body: () => `${who}'s parcel came back to the store. You can book it once more.` };
    }
    return { key: 'book', side: 'brand', since: r.address_sent_at,
      body: () => `${who} sent her address. Pick the products and book the parcel — nothing happens until you do.` };
  }
  // 3 — she checks what arrived.
  if (parcel.delivered_at && lines.some((l) => !l.receipt_status)) {
    return { key: 'check', side: 'creator', since: parcel.delivered_at,
      body: (x) => `Your parcel from ${x.brand_name} arrived. Say what turned up — anything missing won't stop your shoot.` };
  }
  // 4 — she marks the shoot done.
  if (lines.length && lines.every((l) => l.receipt_status) && !r.influencer_completed_at) {
    const lastCheck = lines.map((l) => l.answered_at).filter(Boolean).sort().pop();
    return { key: 'done', side: 'creator', since: lastCheck || parcel.delivered_at,
      body: () => 'You\'ve checked what arrived. Mark the shoot done once you\'ve shot — it opens your content step.' };
  }
  // 5 — the return. Its own lane: it never blocks anything, but it is still somebody's move.
  const state = shoot.returnStateOf(r, ret, lines);
  if (r.influencer_completed_at && state.expected.length) {
    if (!ret) {
      if (state.overdue) {
        return { key: 'return_overdue', side: 'creator', since: state.dueDate,
          body: (x) => `The ${state.expected.length} item${state.expected.length === 1 ? '' : 's'} to go back to ${x.brand_name} are overdue. It costs you nothing — book the pickup when you can.` };
      }
      return { key: 'return', side: 'creator', since: r.influencer_completed_at,
        body: (x) => `${state.expected.length} item${state.expected.length === 1 ? '' : 's'} go back to ${x.brand_name} by ${longDate(state.dueDate)}. You pay nothing — they cover it.` };
    }
    if ((ret.delivered_at || ret.self_sent_at) && !ret.confirmed_at && !ret.autoconfirmed_at) {
      return { key: 'confirm_return', side: 'brand', since: ret.delivered_at || ret.self_sent_at,
        body: () => `${who}'s return is with you. Confirm each item — if you do nothing it confirms itself.` };
    }
  }
  return null;
}

module.exports = { autoConfirmReturns, flagDelayedRemote, remindRemote, openMove };
