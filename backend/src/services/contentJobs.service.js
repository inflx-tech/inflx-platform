'use strict';

/**
 * contentJobs.service.js — the content step's arms on items 10 and 11's two lanes (J2).
 * Contract: features/item12-content · approval §3.4, §3.6, Q6, Q9 · checks 22, 24, 41, 43, 44
 *
 *   J2a (collab-delayed, :05)  flagDelayedContent — past the posting date and not live → Delayed,
 *                              with one of the five content stages, both told ONCE.
 *                              refreshDelayedStages — Q9: the recorded stage FOLLOWS the
 *                              collaboration as it moves, across phases (a row flagged
 *                              `address_not_sent` during the shoot reads `content_in_review` once
 *                              that is where it stands). Silent: nobody is told again.
 *   J2b (shoot-reminders, :55) remindContent — the five content moves, reminded at 48 hours from
 *                              ONE rule (contentFlow.openMove, which Needs You reads too).
 *                              And the upload sweep (approval §2.1).
 *
 * The same shape as items 10 and 11: select → lock (SKIP LOCKED) → gate → compare-and-swap →
 * tell after commit.
 */

const db = require('../config/db');
const shootGate = require('./shootGate.service');
const content = require('./content.service');
const flow = require('./contentFlow.service');
const contentGate = require('./contentGate.service');
const notificationService = require('./notification.service');
const shootPlan = require('./shootPlan.service');
const remoteShoot = require('./remoteShoot.service');
const shipping = require('./shipping');
const { NOTIFY12 } = require('./contentCopy');
const { DELAYED_STAGE_LABEL } = require('./productionCopy');
const { longDate } = require('./campaignCopy');
const { todayInIndia, calendarDay } = require('../utils/indiaDay');

const HOURS_48 = 48 * 60 * 60 * 1000;
const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'She';

/** The content-step stage of one collaboration, read inside `conn`. */
async function contentStageOf(ciId, conn = db) {
  const cc = await content.contentRow(ciId, conn);
  const rounds = cc ? await content.roundsOf(cc.id, conn) : [];
  return { cc, rounds, stage: content.stageOf(cc, rounds) };
}

function tell(r, side, key, body) {
  const creator = side === 'creator';
  return notificationService.send({
    userId: creator ? r.creator_user_id : r.brand_user_id, type: key.type, title: key.title, body, sendSms: false,
    data: creator ? { screen: 'my_content', campaign_influencer_id: r.ci_id }
      : { screen: 'brand_content', campaign_influencer_id: r.ci_id, campaign_id: r.campaign_id, set_id: r.set_id },
  }).catch((e) => console.error(`[NOTIFICATION] ${key.type} failed:`, e.message));
}

/* ───────────────────────────────────────────── J2a — Delayed */

/**
 * The day after the posting date, a Pay for Content collaboration whose shoot is done and whose
 * content is not live is flagged Delayed with its content stage. Both sides told once.
 * NOTHING ELSE MOVES — the flag is a label (§25).
 */
async function flagDelayedContent({ today = null } = {}) {
  const t = today || todayInIndia();
  const out = { checked: 0, flagged: 0, skippedGate: 0, failed: 0 };
  const { rows } = await db.query(
    `SELECT ci.id AS ci_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
       JOIN production_events pe ON pe.contract_id = con.id
       LEFT JOIN collab_content cc ON cc.campaign_influencer_id = ci.id
      WHERE ci.delayed_at IS NULL AND cs.goal = 'engagement'
        AND cs.go_live_date IS NOT NULL AND cs.go_live_date < $1::date
        AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL
        AND pe.status = 'completed'
        AND (cc.id IS NULL OR cc.live_confirmed_at IS NULL)`, [t]);
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
        const { stage } = await contentStageOf(row.ci_id, tx);
        const delayed = flow.delayedStageFor(stage);
        if (!delayed) return;
        const { rowCount } = await tx.query(
          `UPDATE campaign_influencers SET delayed_at = now(), delayed_stage = $2 WHERE id = $1 AND delayed_at IS NULL`,
          [row.ci_id, delayed]);
        if (rowCount === 1) { out.flagged += 1; told.push({ ciId: row.ci_id, delayed }); }
      });
    } catch (e) {
      out.failed += 1;
      console.error('[collab-delayed:content] failed for', row.ci_id, e.message);
    }
  }
  for (const { ciId, delayed } of told) {
    // eslint-disable-next-line no-await-in-loop
    const r = await contentGate.load(ciId, { side: 'admin' });
    if (!r) continue;
    const day = longDate(calendarDay(r.go_live_date));
    // C15 and C16, as the screens say it: nothing moved, nobody is blamed, everything still works.
    // eslint-disable-next-line no-await-in-loop
    await tell(r, 'brand', NOTIFY12.DELAYED,
      `The ${day} posting date passed before the content went live. Where it stopped: ${(DELAYED_STAGE_LABEL[delayed] || '').toLowerCase()}. Nothing has changed about the money, and everything still works.`);
    // eslint-disable-next-line no-await-in-loop
    await tell(r, 'creator', NOTIFY12.DELAYED,
      `The ${day} posting date passed before your content went live. Nothing changes: carry on from wherever you are, and the money is untouched.`);
  }
  return out;
}

/**
 * Q9 — every Delayed collaboration's recorded stage is brought up to where it actually stands,
 * across phases. Silent: the first flag told both sides; this tells nobody. Once the content is
 * live the last stage is kept (nothing is "stopped" any more; the flag stays a label).
 */
async function refreshDelayedStages() {
  const out = { checked: 0, updated: 0, failed: 0 };
  const { rows } = await db.query(
    `SELECT ci.id AS ci_id, ci.delayed_stage, cs.goal, cs.shoot_mode, con.id AS contract_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
      WHERE ci.delayed_at IS NOT NULL`);
  for (const row of rows) {
    out.checked += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      const next = await currentDelayedStage(row);
      if (!next || next === row.delayed_stage) continue;
      // eslint-disable-next-line no-await-in-loop
      const { rowCount } = await db.query(
        `UPDATE campaign_influencers SET delayed_stage = $2
          WHERE id = $1 AND delayed_at IS NOT NULL AND delayed_stage IS DISTINCT FROM $2`, [row.ci_id, next]);
      out.updated += rowCount;
    } catch (e) {
      out.failed += 1;
      console.error('[collab-delayed:refresh] failed for', row.ci_id, e.message);
    }
  }
  return out;
}

/** Where a delayed collaboration stands now, in the Delayed vocabulary — or null to leave it. */
async function currentDelayedStage(row) {
  const { rows: [pe] } = await db.query(`SELECT * FROM production_events WHERE contract_id = $1`, [row.contract_id]);
  if (pe && pe.status === 'completed') {
    // Item 14: a Pay for Sale collaboration's stage follows it through the two paths.
    if (row.goal === 'conversion' || row.goal === 'hybrid') return require('./saleLive.service').currentDelayedStageSale(row.ci_id);
    if (row.goal !== 'engagement') return null;
    const { stage } = await contentStageOf(row.ci_id);
    return flow.delayedStageFor(stage);                              // null once live: keep the last
  }
  const mode = String((pe && pe.mode) || row.shoot_mode || 'remote').toLowerCase();
  if (mode === 'visit') return shootPlan.delayedStageOf(pe) || 'plan_not_sent';
  const parcel = pe ? await shipping.lastOutbound(pe.id) : null;
  const lines = pe ? await remoteShoot.linesOf(pe.id) : [];
  return remoteShoot.delayedStageOf(pe, parcel, lines) || 'address_not_sent';
}

/* ───────────────────────────────────────────── J2b — the 48-hour lane */

const REMINDER = {
  send_content:   (r) => ({ side: 'creator', body: `Your content for ${r.brand_name} is waiting. Upload what you agreed and send it.` }),
  make_changes:   (r) => ({ side: 'creator', body: `${r.brand_name} asked for changes. Send the changes when you're ready.` }),
  review_content: (r) => ({ side: 'brand', body: `${first(r.creator_name)}'s content is waiting for your review.` }),
  post_and_link:  () => ({ side: 'creator', body: 'Your content is approved. Post it and add the links.' }),
  confirm_live:   (r) => ({ side: 'brand', body: `${first(r.creator_name)} posted everything. Open the links and confirm the content is live.` }),
};

/**
 * One nudge to whoever owes the move, once it has sat 48 hours, and not again within 48 hours.
 *
 * DECISION (approval Q6, rules v1.29 §12.2): unlike the shoot's reminders, these CONTINUE PAST THE
 * POSTING DATE. Items 10 and 11 stop there because the Delayed flag and the next step take over;
 * the content step is the last step, so nothing takes over from it. They stop only when the move
 * is made, the step is reported to INFLX, or the collaboration completes.
 */
async function remindContent({ now = new Date() } = {}) {
  const out = { checked: 0, sent: 0, failed: 0 };
  const { rows } = await db.query(
    `SELECT ci.id AS ci_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
       JOIN production_events pe ON pe.contract_id = con.id
       LEFT JOIN collab_content cc ON cc.campaign_influencer_id = ci.id
      WHERE cs.goal = 'engagement' AND pe.status = 'completed'
        AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL
        AND (cc.id IS NULL OR (cc.live_confirmed_at IS NULL AND cc.brand_reported_at IS NULL))`);
  const sends = [];
  for (const row of rows) {
    out.checked += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.withTransaction(async (tx) => {
        const gate = await shootGate.shootGate(row.ci_id, tx);
        if (!gate || !gate.open) return;
        const r = await contentGate.load(row.ci_id, { side: 'admin' }, tx);
        const g = { r };
        if (!contentGate.rowsOf(r.terms_json)) return;               // Q7: INFLX settles those, not a reminder
        const cc = await content.ensureContent(tx, g);                // the step is open; its row may be born here
        const rounds = await content.roundsOf(cc.id, tx);
        const stage = content.stageOf(cc, rounds);
        const move = flow.openMove(stage, cc, rounds, contentGate.shootDoneAt(r));
        if (!move || !move.since) return;
        const anchor = Math.max(new Date(move.since).getTime(), cc.reminder_sent_at ? new Date(cc.reminder_sent_at).getTime() : 0);
        if (now.getTime() - anchor < HOURS_48) return;
        const { rowCount } = await tx.query(
          `UPDATE collab_content SET reminder_sent_at = $2 WHERE id = $1 AND reminder_sent_at IS NOT DISTINCT FROM $3`,
          [cc.id, now, cc.reminder_sent_at]);
        if (rowCount === 1) sends.push({ r, move });
      });
    } catch (e) {
      out.failed += 1;
      console.error('[shoot-reminders:content] failed for', row.ci_id, e.message);
    }
  }
  for (const { r, move } of sends) {
    const m = REMINDER[move.key](r);
    // eslint-disable-next-line no-await-in-loop
    await tell(r, m.side, NOTIFY12.REMINDER, m.body);
    out.sent += 1;
  }
  return out;
}

module.exports = { flagDelayedContent, refreshDelayedStages, currentDelayedStage, remindContent, REMINDER, HOURS_48 };
