'use strict';

/**
 * Item 19 — Home and Needs You (rules v1.32 §24; board item19-home-v3, BH1–BH6 / CH1–CH5).
 *
 * Home is four sections, in one order: Needs you · Waiting on others · Money · Campaigns (brand) or
 * Running now (creator). This file works out the first two and gathers the other two from the
 * services that already own them. It writes nothing.
 *
 * ONE RULE, TWO PLACES. The set screen and her Collabs card decide a row's one button on the phone
 * (setRowStep / cardStep in Packages/Mobile/src/components/invitations/steps5.js) from the fields
 * invitationRows sends. Home has to ORDER and COUNT on the server, so `brandStep` and `creatorStep`
 * below make the same decision from the same fields. They are held together by a test: the rows this
 * file is tested on are written out with its verdict, and a phone test puts each through
 * setRowStep / cardStep and requires the same verdict (tests/item19-home.test.js →
 * Packages/Mobile/src/screens/__tests__/fixtures/home19-rows.json).
 *
 * WHAT HOME ADDS that the row rule cannot see, each from stored state: Delayed; the cutoff on
 * Sign / Send agreement; brand — book again, a parcel difference, confirm the return;
 * creator — mark the visit done, correct the address, send the products back.
 *
 * QUERIES. A fixed number per read whatever the number of collaborations: the row query runs once
 * over every live row, the Remote extras once, and the rest are counts.
 * Contract: features/item19-home
 */

const db = require('../config/db');
const rows5 = require('./invitationRows.service');
const campaignState = require('./campaignState.service');
const walletRead = require('./walletRead.service');
const shoppablePosts = require('./shoppablePosts.service');
const socialAccounts = require('./socialAccounts.service');
const elig = require('./collabEligibility.service');
const { OPEN_PITCH_STATUSES } = require('./negotiation.service');
const { resolveAvatars } = require('../utils/avatarResolver');
const { calendarDay, todayInIndia, daysBetween, isBefore, istDayOf } = require('../utils/indiaDay');
const COPY = require('./homeCopy');

/** How many rows a Home section shows (H2). */
const HOME_ROWS = 3;
/** A date this near, or a Delayed collaboration, comes first (H8). */
const SOON_DAYS = 3;
/** The most a full list returns; the count is always the real one. */
const LIST_MAX = 200;

/** Collaborations that can still owe or be owed a step. Ended ones are never read. */
const LIVE = ['invited', 'applied', 'negotiating', 'accepted', 'contracted', 'active'];
const DEAD = ['declined', 'expired', 'rejected_by_brand', 'slots_filled', 'withdrawn', 'removed'];

/** Columns Home needs beside the row: Delayed, and two stamps of the content step. */
const CONTENT_AT = `(SELECT cc.updated_at FROM collab_content cc WHERE cc.campaign_influencer_id = ci.id) AS home_content_at,
         (SELECT cc.final_due_at FROM collab_content cc WHERE cc.campaign_influencer_id = ci.id) AS home_final_due_at,`;
const BRAND_EXTRA = `ci.set_id AS home_set_id, ci.delayed_at AS home_delayed_at,
         ${CONTENT_AT}
         `;
const CREATOR_EXTRA = `ci.delayed_at AS home_delayed_at,
         ${CONTENT_AT}
         `;

const HER_CONTENT = ['send_content', 'make_changes', 'post_and_link'];
const HER_SALE = ['make_posts', 'send_social', 'make_changes', 'post_and_link'];

const need = (kind, open, o = {}) => ({ side: 'needs', kind, open, blocks: true, ...o });
const wait = (kind, open, tag, o = {}) => ({ side: 'waiting', kind, open, tag, tone: 'waiting', ...o });

/* ══════════════════════════════════════════════════════════ ordering */

/**
 * H8 — the order of Needs you:
 *   1. a date in the next SOON_DAYS days (or already past), or a Delayed collaboration — nearest first
 *   2. what holds up the other side's payment or next step (`blocks`)
 *   3. the rest
 * and the oldest first inside a tier.
 */
function tierOf(it, today) {
  if (it.delayed) return 1;
  if (it.date && daysBetween(today, it.date) <= SOON_DAYS) return 1;
  return it.blocks ? 2 : 3;
}
const time = (v) => (v ? new Date(v).getTime() : Number.MAX_SAFE_INTEGER);
function sortNeeds(items, today) {
  for (const it of items) it.tier = tierOf(it, today);
  return items.sort((a, b) =>
    a.tier - b.tier
    || (a.tier === 1 ? String(a.date || '0').localeCompare(String(b.date || '0')) : 0)
    || time(a.since) - time(b.since)
    || String(a.id).localeCompare(String(b.id)));
}
/** Waiting on others: the nearest date first, then the oldest. */
function sortWaiting(items) {
  return items.sort((a, b) =>
    String(a.date || '9999').localeCompare(String(b.date || '9999'))
    || time(a.since) - time(b.since)
    || String(a.id).localeCompare(String(b.id)));
}

/* ══════════════════════════════════════════════════════════ the brand */

/** The brand's step on one row — the server's twin of setRowStep (see the header). */
function brandStep(r, row, x) {
  const B = COPY.BRAND;
  const act = row.actions || {};
  const preSign = { date: x.cutoff, why: COPY.daysLeftWords(x.daysToCutoff) };
  switch (row.group) {
    case 'yourMove': {
      // Before both signatures, nothing can be done once the cutoff has passed (rules §7A, §9).
      if (x.cutoffPassed) return null;
      if (act.signAgreement) return need('sign', 'agreement', { ...preSign, line: B.sign(x.cutoff), since: r.creator_signed_at });
      if (act.sendAgreement) return need('send_agreement', 'agreementPreview', { ...preSign, line: B.send_agreement(), since: r.answered_at });
      const counter = row.negotiation && row.negotiation.open && row.negotiation.whoseMove === 'brand';
      return need(counter ? 'reply' : 'reply_move', 'thread', { ...preSign, line: counter ? B.reply() : B.reply_move(), since: counter ? r.neg_last_at : r.move_requested_at });
    }
    case 'negotiating':
      if (x.cutoffPassed) return null;
      return wait('her_counter', 'thread', B.tags.waiting, { line: B.w_her_counter(), date: x.cutoff, since: r.neg_last_at });
    case 'waiting': {
      if (x.cutoffPassed || r.status === 'applied') return null;
      const out = !!(act.withdrawAgreement || (row.agreement && row.agreement.status === 'pending_influencer'));
      if (out) return wait('to_sign', 'agreement', B.tags.to_sign, { line: B.w_to_sign(), why: B.closes(x.cutoff), date: x.cutoff, since: r.agreement_sent_at });
      return wait('not_answered', 'set', B.tags.not_answered, { line: B.w_not_answered(row.sentAt), why: B.closes(x.cutoff), date: x.cutoff, since: row.sentAt });
    }
    case 'signed':
      return brandSigned(r, row, x);
    default:
      return null;   // accepted with nothing owed, moved to the pool, ended
  }
}

function brandSigned(r, row, x) {
  const B = COPY.BRAND;
  const at = { date: x.posting, delayed: x.delayed };
  const her = (kind, open, line) => wait(kind, open, B.tags.her_move, { ...at, line, since: x.contentAt || r.signed_at });
  const inflx = (open) => wait('reported', open, B.tags.inflx, { ...at, group: 'inflx', line: B.w_reported(), since: x.contentAt });
  const auto = (open) => wait('final_payment', open, B.tags.automatic, { group: 'inflx', tone: 'ended', line: B.w_final_payment(x.finalDue), date: x.finalDue ? calendarDay(istDayOf(x.finalDue)) : null, since: x.contentAt });

  const c = row.content;
  if (c && c.line) {
    if (c.yourMove) {
      return c.move === 'confirm_live'
        ? need('confirm_live', 'content', { ...at, line: B.confirm_live(), why: B.whyPayment, since: x.contentAt })
        : need('review', 'content', { ...at, line: B.review_content(), since: x.contentAt });
    }
    if (c.move === 'send_content') return her('her_content', 'content', B.w_send_content(x.posting));
    if (c.move === 'make_changes') return her('her_changes', 'content', B.w_make_changes());
    if (c.move === 'post_and_link') return her('her_posting', 'content', B.w_post_and_link());
    if (c.move === 'reported') return inflx('content');
    if (c.move === 'live' && r.status !== 'completed') return auto('content');
    return null;
  }
  const g = row.goingLive;
  if (g && g.line) {
    if (g.yourMove) {
      return g.move === 'confirm_live'
        ? need('confirm_live', 'goingLive', { ...at, line: B.confirm_live(), why: x.hasMoney ? B.whyPayment : null, since: x.contentAt })
        : need('review', 'goingLive', { ...at, line: B.review_social(), since: x.contentAt });
    }
    if (g.completed) return null;
    if (g.move === 'make_posts') return her('her_posts', 'goingLive', B.w_make_posts());
    if (g.move === 'send_social') return her('her_social', 'goingLive', B.w_send_social());
    if (g.move === 'make_changes') return her('her_changes', 'goingLive', B.w_make_changes());
    if (g.move === 'post_and_link') return her('her_posting', 'goingLive', B.w_post_and_link());
    if (g.move === 'waiting_posts') return her('her_posts', 'goingLive', B.w_waiting_posts());
    if (g.move === 'reported') return inflx('goingLive');
    if (g.move === 'final_payment') return auto('goingLive');
    return null;
  }
  const sh = row.shoot;
  if (sh && sh.line) {
    const passed = sh.stage === 'agreed' && !!sh.visitAt && new Date(sh.visitAt).getTime() < x.now;
    if (sh.stage === 'not_sent') return need('plan_visit', 'shoot', { ...at, line: B.plan_visit(), since: r.signed_at });
    if (passed) return need('plan_visit', 'shoot', { ...at, line: B.visit_passed(sh.visitAt), since: sh.visitAt });
    if (sh.stage === 'attended') return need('confirm_shoot', 'shoot', { ...at, line: B.confirm_shoot(), why: B.whyNextStep, since: r.influencer_completed_at });
    if (sh.stage === 'sent') {
      // 'sent' is both "the plan is with her" and "she asked for another time": only the visit's
      // own conversation knows which, so the turn is the row's `yourMove`, never guessed.
      if (sh.yourMove === true) return need('reply_time', 'shoot', { ...at, line: B.reply_time(), since: r.plan_sent_at });
      if (sh.yourMove === false) return her('her_time', 'shoot', B.w_her_time());
    }
    return null;   // a time is agreed and still to come, or the visit is done: nobody owes anything
  }
  const rm = row.remote;
  if (rm && rm.line) {
    if (x.extra && x.extra.rebook) return need('rebook', 'remote', { ...at, line: B.rebook(), since: x.extra.ob_returned_at });
    switch (rm.stage) {
      case 'sent': return need('book_parcel', 'remote', { ...at, line: B.book_parcel(), since: r.address_sent_at });
      case 'not_sent': return her('her_address', 'remote', B.w_her_address());
      case 'in_transit': return wait('in_transit', 'remote', B.tags.in_transit, { ...at, line: B.w_in_transit(), since: r.parcel_booked_at });
      case 'delivered': return her('her_check', 'remote', B.w_her_check());
      case 'checked': return her('her_shoot', 'remote', B.w_her_shoot());
      default: return null;
    }
  }
  return null;
}

/**
 * Remote moves the row rule cannot see, for every Remote shoot of this brand that has one open —
 * a finished collaboration included, because a return can come back after the last payment.
 */
const REMOTE_LATERALS = `
    LEFT JOIN LATERAL (SELECT s.* FROM shipments s WHERE s.production_event_id = pe.id AND s.direction = 'outbound'
                        ORDER BY s.created_at DESC LIMIT 1) ob ON true
    LEFT JOIN LATERAL (SELECT s.* FROM shipments s WHERE s.production_event_id = pe.id AND s.direction = 'return' AND s.cancelled_at IS NULL
                        ORDER BY s.created_at DESC LIMIT 1) rt ON true
    LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE i.receipt_status IS NOT NULL AND i.receipt_status <> 'received')::int AS differences,
                              count(*) FILTER (WHERE i.disposition = 'return' AND i.receipt_status = 'received')::int AS expected_back
                         FROM production_event_items i WHERE i.production_event_id = pe.id) li ON true`;

async function brandRemoteExtras(brandId) {
  const { rows } = await db.query(
    `SELECT ci.id AS ci_id, ci.set_id, cs.name AS set_name, cs.go_live_date, c.id AS campaign_id, c.name AS campaign_name, ci.delayed_at,
            COALESCE(i.full_name, u.name) AS name, i.profile_image_r2_key,
            (ob.returned_to_store_at IS NOT NULL AND ob.rebooked_from_id IS NULL) AS rebook, ob.returned_to_store_at AS ob_returned_at,
            (li.differences > 0 AND pe.difference_acknowledged_at IS NULL) AS difference, ob.delivered_at AS ob_delivered_at,
            ((rt.delivered_at IS NOT NULL OR rt.self_sent_at IS NOT NULL) AND rt.confirmed_at IS NULL AND rt.autoconfirmed_at IS NULL) AS confirm_return,
            rt.delivered_at AS rt_delivered_at, rt.self_sent_at AS rt_self_sent_at
       FROM campaigns c
       JOIN campaign_sets cs ON cs.campaign_id = c.id
       JOIN campaign_influencers ci ON ci.set_id = cs.id
       JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
       JOIN production_events pe ON pe.contract_id = con.id AND COALESCE(pe.mode::text, '') <> 'visit'
       ${REMOTE_LATERALS}
      WHERE c.brand_id = $1 AND ci.status::text <> ALL($2::text[])
        AND (   (ob.returned_to_store_at IS NOT NULL AND ob.rebooked_from_id IS NULL)
             OR (li.differences > 0 AND pe.difference_acknowledged_at IS NULL)
             OR ((rt.delivered_at IS NOT NULL OR rt.self_sent_at IS NOT NULL) AND rt.confirmed_at IS NULL AND rt.autoconfirmed_at IS NULL))`,
    [brandId, DEAD]);
  return new Map(rows.map((r) => [r.ci_id, r]));
}

/** Every row of the brand's two lists, unsorted. */
async function brandItems(brandId, today, now) {
  const B = COPY.BRAND;
  const { rows: sets } = await db.query(
    `SELECT cs.id, cs.name, cs.goal, cs.go_live_date, cs.expired_at, c.id AS campaign_id, c.name AS campaign_name
       FROM campaign_sets cs JOIN campaigns c ON c.id = cs.campaign_id WHERE c.brand_id = $1`, [brandId]);
  const setOf = new Map(sets.map((s) => [s.id, s]));
  const [{ rows }, extras] = await Promise.all([
    sets.length
      ? db.query(`${rows5.rowSelect(BRAND_EXTRA)} WHERE ci.set_id = ANY($1::uuid[]) AND ci.status::text = ANY($2::text[]) ORDER BY ci.created_at DESC`, [sets.map((s) => s.id), LIVE])
      : Promise.resolve({ rows: [] }),
    brandRemoteExtras(brandId),
  ]);

  const items = [];
  const seen = new Set();
  const push = (it, base) => { if (it) items.push({ ...base, ...it, id: `${base.ciId}:${it.kind}` }); };
  for (const r of rows) {
    const set = setOf.get(r.home_set_id);
    if (!set) continue;
    seen.add(r.id);
    const posting = set.go_live_date ? calendarDay(set.go_live_date) : null;
    const cutoff = campaignState.cutoffFor(posting);
    const cutoffPassed = !!(set.expired_at || (cutoff && isBefore(cutoff, today)));
    const x = {
      now, posting, cutoff, cutoffPassed,
      daysToCutoff: cutoff && !cutoffPassed ? daysBetween(today, cutoff) : null,
      delayed: !!r.home_delayed_at, hasMoney: set.goal === 'engagement' || set.goal === 'hybrid',
      contentAt: r.home_content_at || null, finalDue: r.home_final_due_at || null,
      extra: extras.get(r.id) || null,
    };
    const row = rows5.brandRow(r, set.goal);
    const base = {
      ciId: r.id, campaignId: set.campaign_id, setId: set.id,
      who: { type: 'creator', name: r.name, avatarUrl: null, avatarKey: r.profile_image_r2_key || null },
      context: `${set.campaign_name} · ${set.name}`,
      row,
    };
    push(brandStep(r, row, x), base);
  }
  // The Remote moves, one row each. `difference` is a look, not a blocker (§11.2: it never stops her).
  for (const e of extras.values()) {
    const base = {
      ciId: e.ci_id, campaignId: e.campaign_id, setId: e.set_id,
      who: { type: 'creator', name: e.name, avatarUrl: null, avatarKey: e.profile_image_r2_key || null },
      context: `${e.campaign_name} · ${e.set_name}`,
    };
    const at = { date: e.go_live_date ? calendarDay(e.go_live_date) : null, delayed: !!e.delayed_at };
    if (e.rebook && !seen.has(e.ci_id)) push(need('rebook', 'remote', { ...at, line: B.rebook(), since: e.ob_returned_at }), base);
    if (e.difference) push(need('difference', 'remote', { line: B.difference(), blocks: false, since: e.ob_delivered_at }), base);
    if (e.confirm_return) push(need('confirm_return', 'remote', { line: B.confirm_return(!e.rt_delivered_at && !!e.rt_self_sent_at), since: e.rt_delivered_at || e.rt_self_sent_at }), base);
  }
  return items;
}

/** The brand's rows that are not about one creator: pitches, the pool, orders, setup. */
async function brandCountRows(brandId, today) {
  const B = COPY.BRAND;
  const [{ rows: [p] }, { rows: [pool] }, { rows: [ord] }, { rows: [b] }, { rows: [w] }] = await Promise.all([
    db.query(
      `SELECT count(*) FILTER (WHERE n.id IS NULL OR n.outcome IS NOT NULL)::int AS fresh,
              count(*) FILTER (WHERE n.id IS NOT NULL AND n.outcome IS NULL AND n.current_turn = 'brand')::int AS yours,
              min(p.response_due_at) FILTER (WHERE n.id IS NULL OR n.outcome IS NOT NULL) AS due,
              min(p.created_at) AS oldest
         FROM influencer_proposals p LEFT JOIN negotiations n ON n.pitch_id = p.id
        WHERE p.brand_id = $1 AND p.status::text = ANY($2::text[])`, [brandId, OPEN_PITCH_STATUSES]),
    db.query(`SELECT count(*)::int AS n, min(expires_at) AS soonest, min(agreed_at) AS oldest FROM brand_creator_pool WHERE brand_id = $1 AND state = 'waiting'`, [brandId]),
    db.query(`SELECT count(*)::int AS n, min(created_at) AS oldest FROM follower_orders WHERE brand_id = $1 AND checkout_id IS NOT NULL AND order_status = 'confirmed'`, [brandId]),
    // "Add your bank account" is for a brand with SALES money to take out. A brand that has only
    // loaded its wallet to fund collaborations is not asked for a bank account it does not need.
    db.query(
      `SELECT (b.bank_account_no IS NOT NULL AND b.bank_ifsc IS NOT NULL) AS has_bank,
              EXISTS (SELECT 1 FROM order_lines ol WHERE ol.brand_id = b.id AND ol.status::text <> 'cancelled') AS has_sales
         FROM brands b WHERE b.id = $1`, [brandId]),
    db.query(`SELECT status FROM withdrawal_requests WHERE owner_kind = 'brand' AND brand_id = $1 ORDER BY requested_at DESC LIMIT 1`, [brandId]),
  ]);
  const out = [];
  const icon = (name, icon) => ({ type: 'icon', name, icon });
  const pitches = Number(p.fresh) + Number(p.yours);
  if (pitches > 0) {
    out.push(need('pitches', 'pitches', { id: 'pitches', blocks: false, who: icon(B.pitchesName(pitches, Number(p.yours) > 0), 'pitch'), line: B.pitches(Number(p.yours) > 0),
      context: 'Creators · Pitches', date: p.due ? calendarDay(istDayOf(p.due)) : null, since: p.oldest, count: pitches }));
  }
  if (Number(pool.n) > 0) {
    const day = pool.soonest ? calendarDay(istDayOf(pool.soonest)) : null;
    out.push(need('pool', 'pool', { id: 'pool', blocks: false, who: icon(B.poolName(Number(pool.n)), 'pool'), line: B.pool(Number(pool.n)),
      context: day ? B.poolCloses(Math.max(0, daysBetween(today, day))) : '', date: day, since: pool.oldest, count: Number(pool.n) }));
  }
  if (Number(ord.n) > 0) {
    out.push(need('orders', 'ordersWeb', { id: 'orders', who: icon(B.ordersName(Number(ord.n)), 'orders'), line: B.orders(), context: B.ordersCtx, since: ord.oldest, count: Number(ord.n) }));
  }
  // Setup (H7). A withdrawal that failed blocks money, so it rises with the rows that hold someone up.
  if (w && w.status === 'could_not_process') {
    out.push(need('withdrawal_failed', 'withdrawals', { id: 'withdrawal_failed', who: icon(B.withdrawalFailedName, 'wallet'), line: B.withdrawalFailed(), context: 'Wallet' }));
  }
  if (b && !b.has_bank && b.has_sales) {
    out.push(need('add_bank', 'walletDetails', { id: 'add_bank', blocks: false, who: icon(B.addBankName, 'wallet'), line: B.addBank(), context: 'Wallet · Bank and business details' }));
  }
  return out;
}

async function brandLists(brandId, today = todayInIndia(), now = Date.now()) {
  const [items, counts] = await Promise.all([brandItems(brandId, today, now), brandCountRows(brandId, today)]);
  const needs = sortNeeds([...items.filter((i) => i.side === 'needs'), ...counts], today);
  const waiting = sortWaiting(items.filter((i) => i.side === 'waiting').map((i) => ({ ...i, group: i.group || 'creators' })));
  return { needs, waiting, groups: ['creators', 'inflx'] };
}

/* ══════════════════════════════════════════════════════════ the creator */

/** A brand-new invitation that is hers to answer — the phone's hersToAnswer. */
const hersToAnswer = (card) => card.group === 'invited' && card.canAnswer === true && !(card.moveRequest && !card.moveRequest.answer);

/** Her step on one card — the server's twin of cardStep, plus what the card cannot say. */
function creatorStep(r, card, x) {
  const C = COPY.CREATOR;
  const brand = card.brand.name;
  const pre = { date: card.cutoff };
  switch (card.group) {
    case 'invited':
      if (hersToAnswer(card)) {
        return need('answer', 'invitation', { ...pre, why: card.cutoff ? C.replyBy(card.cutoff) : null, since: card.sentAt,
          line: C.answer(card.goal, card.shootMode, COPY.earnWords(card.goal, card.fee, card.commissionPct, { long: true })) });
      }
      if (card.moveRequest && !card.moveRequest.answer) return wait('date_request', 'thread', C.tags.waiting, { ...pre, line: C.w_date_request(), since: card.moveRequest.requestedAt });
      if (r.status === 'applied') return wait('applied', 'invitation', C.tags.waiting, { ...pre, line: C.w_applied(), since: card.sentAt });
      return null;
    case 'toSign':
      return need('sign', 'agreement', { ...pre, line: C.sign(card.cutoff), why: COPY.daysLeftWords(card.daysLeft), since: card.agreement && card.agreement.sentAt });
    case 'yourMove':
      return need('reply', 'thread', { ...pre, line: C.reply(), why: COPY.daysLeftWords(card.daysLeft), since: r.neg_last_at });
    case 'negotiating':
      return wait('counter_with_brand', 'thread', C.tags.waiting, { ...pre, line: C.w_counter_with_brand(), since: r.neg_last_at });
    case 'signedWaiting':
      return wait('brand_to_sign', 'agreement', C.tags.to_sign, { ...pre, line: C.w_brand_to_sign(brand), since: r.creator_signed_at });
    case 'accepted':
      return wait('agreement_coming', 'invitation', C.tags.waiting, { ...pre, line: C.w_agreement_coming(), since: card.answeredAt });
    case 'pooled':
      return wait('pooled', 'invitation', C.tags.waiting, { line: C.w_pooled(), date: card.pool && card.pool.expiresAt ? calendarDay(istDayOf(card.pool.expiresAt)) : null, since: r.deferred_at });
    case 'signed':
      return card.status === 'completed' ? null : creatorSigned(r, card, x);
    default:
      return null;
  }
}

function creatorSigned(r, card, x) {
  const C = COPY.CREATOR;
  const at = { date: card.postingDate, delayed: x.delayed };
  const mine = (kind, open, line, o = {}) => need(kind, open, { ...at, line, since: x.contentAt || r.brand_signed_at, ...o });
  const theirs = (kind, open, tag, line, o = {}) => wait(kind, open, tag, { ...at, line, since: x.contentAt || r.brand_signed_at, ...o });
  const inflx = (kind, open, line) => theirs(kind, open, C.tags.inflx, line, { group: 'inflx' });
  const auto = (open) => wait('final_payment', open, C.tags.automatic, { group: 'inflx', tone: 'ended', line: C.w_final_payment(x.finalDue), date: x.finalDue ? calendarDay(istDayOf(x.finalDue)) : null, since: x.contentAt });

  const c = card.content;
  if (c && c.line) {
    if (c.move === 'send_content') return mine('send_content', 'content', C.send_content());
    if (c.move === 'make_changes') return mine('make_changes', 'content', C.make_changes_content());
    if (c.move === 'post_and_link') return mine('post_and_link', 'content', C.post_and_link());
    if (c.move === 'review_content') return theirs('review_content', 'content', C.tags.in_review, C.w_review_content());
    if (c.move === 'confirm_live') return theirs('confirm_live', 'content', C.tags.waiting, C.w_confirm_live());
    if (c.move === 'reported') return inflx('reported', 'content', C.w_reported());
    if (c.move === 'live') return auto('content');
    return null;
  }
  const g = card.goingLive;
  if (g && g.line) {
    // "Make your shoppable posts": while she is short of her minimum before the posting date, the
    // "Shoppable post needed" row says it with the count; this row would only repeat it.
    if (g.move === 'make_posts') return x.postOwed ? null : mine('make_posts', 'goingLive', C.make_posts());
    if (g.move === 'send_social') return mine('send_social', 'goingLive', C.send_social());
    if (g.move === 'make_changes') return mine('make_changes', 'goingLive', C.make_changes_social());
    if (g.move === 'post_and_link') return mine('post_and_link', 'goingLive', C.post_and_link());
    if (g.move === 'review_social') return theirs('review_social', 'goingLive', C.tags.in_review, C.w_review_social());
    if (g.move === 'confirm_live') return theirs('confirm_live', 'goingLive', C.tags.waiting, C.w_confirm_live());
    if (g.move === 'waiting_posts') return x.postOwed ? null : inflx('waiting_posts', 'goingLive', C.w_waiting_posts());
    if (g.move === 'final_payment') return auto('goingLive');
    if (g.move === 'reported') return inflx('reported', 'goingLive', C.w_reported());
    return null;
  }
  const sh = card.shoot;   // on her card only once a plan has been sent
  if (sh && sh.line) {
    if (sh.stage === 'sent') {
      if (sh.yourMove === true) {
        return r.shoot_turn === 'influencer'
          ? mine('reply_time', 'shootThread', C.reply_time(), { since: r.plan_sent_at })
          : mine('answer_plan', 'shoot', C.answer_plan(), { since: r.plan_sent_at });
      }
      if (sh.yourMove === false) return theirs('brand_time', 'shoot', C.tags.waiting, C.w_brand_time());
      return null;
    }
    // She may mark the visit from the moment the time is agreed; it is listed from the day of the
    // visit, because before that there is nothing for her to do.
    if (sh.stage === 'agreed') {
      const day = sh.visitAt ? calendarDay(istDayOf(sh.visitAt)) : null;
      return day && !isBefore(x.today, day) ? mine('mark_visit', 'shoot', C.mark_visit(), { since: sh.visitAt }) : null;
    }
    if (sh.stage === 'attended') return theirs('brand_confirm_visit', 'shoot', C.tags.waiting, C.w_brand_confirm_visit(), { since: r.influencer_completed_at });
    return null;
  }
  const rm = card.remote;
  if (rm && rm.line) {
    if (x.extra && x.extra.correct_address) return mine('correct_address', 'remoteAddressCorrect', C.correct_address(), { since: x.extra.ob_returned_at });
    switch (rm.stage) {
      case 'not_sent': return mine('send_address', 'remoteAddress', C.send_address());
      case 'delivered': return mine('check_parcel', 'remote', C.check_parcel(), { since: r.parcel_delivered_at });
      case 'checked': return mine('mark_shoot', 'remote', C.mark_shoot());
      case 'sent': return theirs('brand_ship', 'remote', C.tags.waiting, C.w_brand_ship(), { since: r.address_sent_at });
      case 'in_transit': return theirs('courier', 'remote', C.tags.in_transit, C.w_courier(), { since: r.parcel_booked_at });
      default: return null;
    }
  }
  // Signed, a Store Visit, and no plan sent yet: the plan is the brand's to send.
  if (r.shoot_id && r.pe_shoot_mode === 'visit' && !r.plan_sent_at) return theirs('brand_plan', 'shoot', C.tags.waiting, C.w_brand_plan());
  return null;
}

async function creatorRemoteExtras(influencerId) {
  const { rows } = await db.query(
    `SELECT ci.id AS ci_id, cs.name AS set_name, cs.go_live_date, c.name AS campaign_name, b.business_name AS brand_name, b.logo_url AS brand_logo_url,
            (pe.address_sent_at IS NOT NULL AND pe.address_corrected_at IS NULL AND ob.returned_to_store_at IS NOT NULL) AS correct_address,
            ob.returned_to_store_at AS ob_returned_at,
            (pe.influencer_completed_at IS NOT NULL AND li.expected_back > 0
              AND ((COALESCE(pe.coverage_return_pickup, true) AND rt.id IS NULL) OR (pe.coverage_return_pickup = false AND rt.self_sent_at IS NULL))) AS send_back,
            pe.influencer_completed_at
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id JOIN brands b ON b.id = c.brand_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
       JOIN production_events pe ON pe.contract_id = con.id AND COALESCE(pe.mode::text, '') <> 'visit'
       ${REMOTE_LATERALS}
      WHERE ci.influencer_id = $1 AND ci.status::text <> ALL($2::text[])
        AND (   (pe.address_sent_at IS NOT NULL AND pe.address_corrected_at IS NULL AND ob.returned_to_store_at IS NOT NULL)
             OR (pe.influencer_completed_at IS NOT NULL AND li.expected_back > 0
                 AND ((COALESCE(pe.coverage_return_pickup, true) AND rt.id IS NULL) OR (pe.coverage_return_pickup = false AND rt.self_sent_at IS NULL))))`,
    [influencerId, DEAD]);
  return new Map(rows.map((r) => [r.ci_id, r]));
}

/** Her collaborations: every row of both lists, the cards behind Running now, and whether she has any. */
async function creatorItems(influencerId, today, postOwed) {
  const C = COPY.CREATOR;
  const [{ rows }, extras] = await Promise.all([
    db.query(`${rows5.creatorSelect(CREATOR_EXTRA)} WHERE ci.influencer_id = $1 AND ci.status::text = ANY($2::text[]) ORDER BY COALESCE(ci.invited_at, ci.created_at) DESC`,
      [influencerId, [...LIVE, 'completed', 'deferred']]),
    creatorRemoteExtras(influencerId),
  ]);
  const items = [];
  const cards = [];
  for (const r of rows) {
    const card = rows5.creatorCard(r, today);
    cards.push(card);
    const x = { today, delayed: !!r.home_delayed_at, contentAt: r.home_content_at || null, finalDue: r.home_final_due_at || null, extra: extras.get(r.id) || null, postOwed: postOwed.has(r.id) };
    const it = creatorStep(r, card, x);
    if (it) {
      items.push({ ...it, id: `${r.id}:${it.kind}`, ciId: r.id, card,
        who: { type: 'brand', name: card.brand.name, logoUrl: card.brand.logoUrl }, context: `${card.campaignName} · ${card.setName}` });
    }
  }
  // "Send the products back" has no door on her Collabs card once the shoot is marked; this row is it.
  for (const e of extras.values()) {
    if (!e.send_back) continue;
    items.push({ ...need('send_back', 'remote', { line: C.send_back(), date: e.go_live_date ? calendarDay(e.go_live_date) : null, since: e.influencer_completed_at }),
      id: `${e.ci_id}:send_back`, ciId: e.ci_id,
      who: { type: 'brand', name: e.brand_name, logoUrl: e.brand_logo_url || null }, context: `${e.campaign_name} · ${e.set_name}` });
  }
  return { items, cards };
}

/** Posts she owes (the Create tab's own rule), posts sent back, posts with INFLX. */
async function creatorPostRows(influencerId, today) {
  const C = COPY.CREATOR;
  const collabs = (await shoppablePosts.myCollabs(influencerId)).filter(shoppablePosts.postable);
  const done = await shoppablePosts.doneCounts(collabs.map((c) => c.id));
  const needs = [];
  const waiting = [];
  const owed = new Set();
  for (const ci of collabs) {
    const min = ci.min_shoppable_posts == null ? 1 : Number(ci.min_shoppable_posts);
    const posting = ci.go_live_date ? calendarDay(ci.go_live_date) : null;
    const n = done.get(ci.id) || 0;
    if (n >= min || (posting && isBefore(posting, today))) continue;
    owed.add(ci.id);
    needs.push(need('post_needed', 'createPost', { id: `${ci.id}:post_needed`, ciId: ci.id, who: { type: 'icon', name: C.postNeededName, icon: 'post' },
      line: C.postNeeded(ci.brand_name, ci.campaign_name, n, min), context: C.createCtx, why: posting ? C.before(posting) : null, date: posting, blocks: false, done: n, min }));
  }
  const { rows } = await db.query(
    `SELECT cp.id, cp.status, cp.reject_reason, cp.updated_at, cp.own_brand, b.business_name AS brand_name, c.name AS campaign_name
       FROM creator_posts cp
       -- item 20: a post for his own brand has no collaboration; it is listed all the same
       LEFT JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id
       LEFT JOIN campaign_sets cs ON cs.id = ci.set_id LEFT JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = cp.brand_id
      WHERE cp.influencer_id = $1 AND cp.v2 AND cp.status IN ('rejected', 'submitted')
      ORDER BY cp.updated_at`, [influencerId]);
  for (const p of rows) {
    const context = p.own_brand ? `${p.brand_name} · your brand` : `${p.brand_name} · ${p.campaign_name}`;
    if (p.status === 'rejected') {
      needs.push(need('post_sent_back', 'postStatus', { id: `${p.id}:post_sent_back`, postId: p.id, who: { type: 'icon', name: C.postBackName, icon: 'sentBack' },
        line: C.postBack(p.reject_reason), context, since: p.updated_at, blocks: false }));
    } else {
      waiting.push(wait('post_in_review', 'postStatus', C.tags.inflx, { id: `${p.id}:post_in_review`, postId: p.id, group: 'inflx',
        who: { type: 'icon', name: C.postCheckName, icon: 'post' }, line: C.postCheck(), context, since: p.updated_at }));
    }
  }
  return { needs, waiting, owed };
}

async function creatorPitchRows(influencerId) {
  const C = COPY.CREATOR;
  const { rows } = await db.query(
    `SELECT p.id, p.status, p.response_due_at, p.created_at, b.business_name AS brand_name, b.logo_url AS brand_logo_url,
            n.id AS neg_id, n.outcome AS neg_outcome, n.current_turn AS neg_turn
       FROM influencer_proposals p JOIN brands b ON b.id = p.brand_id LEFT JOIN negotiations n ON n.pitch_id = p.id
      WHERE p.influencer_id = $1`, [influencerId]);
  const needs = [];
  const waiting = [];
  for (const p of rows) {
    if (!OPEN_PITCH_STATUSES.includes(p.status)) continue;
    const talking = !!p.neg_id && !p.neg_outcome;
    const base = { pitchId: p.id, who: { type: 'brand', name: p.brand_name, logoUrl: p.brand_logo_url || null }, context: 'Your pitch', since: p.created_at };
    if (talking && p.neg_turn === 'influencer') needs.push(need('pitch_reply', 'pitchThread', { ...base, id: `${p.id}:pitch_reply`, line: C.pitch_reply(), blocks: false }));
    else {
      waiting.push(wait(talking ? 'pitch_talking' : 'pitch_waiting', 'pitch', talking ? C.tags.talking : C.tags.sent, { ...base, id: `${p.id}:pitch`, group: 'pitches',
        line: talking ? C.w_pitch_talking() : C.w_pitch(p.response_due_at), date: !talking && p.response_due_at ? calendarDay(istDayOf(p.response_due_at)) : null }));
    }
  }
  return { needs, waiting, any: rows.length > 0 };
}

/** Setup rows (H7): at the bottom, unless they block money. */
async function creatorSetupRows(influencerId) {
  const C = COPY.CREATOR;
  const [social, settings, { rows: [i] }, { rows: [w] }] = await Promise.all([
    socialAccounts.mine(influencerId),
    elig.loadCreatorInvitationSettings(influencerId),
    db.query(`SELECT wallet_balance, (upi_id IS NOT NULL) AS has_upi, (bank_account_no IS NOT NULL AND bank_ifsc IS NOT NULL) AS has_bank FROM influencers WHERE id = $1`, [influencerId]),
    db.query(`SELECT status FROM withdrawal_requests WHERE owner_kind = 'creator' AND influencer_id = $1 ORDER BY requested_at DESC LIMIT 1`, [influencerId]),
  ]);
  const out = [];
  const icon = (name, icon) => ({ type: 'icon', name, icon });
  if (w && w.status === 'could_not_process') out.push(need('withdrawal_failed', 'withdrawals', { id: 'withdrawal_failed', who: icon(C.withdrawalFailedName, 'wallet'), line: C.withdrawalFailed(), context: C.walletCtx }));
  if (i && !i.has_upi && !i.has_bank && Number(i.wallet_balance) > 0) out.push(need('add_details', 'walletDetails', { id: 'add_details', who: icon(C.addDetailsName, 'wallet'), line: C.addDetails(), context: C.addDetailsCtx }));
  if (social && C.fixName[social.chip]) out.push(need('fix_social', 'yourNumbers', { id: 'fix_social', blocks: false, who: icon(C.fixName[social.chip], social.chip === 'fix_youtube' ? 'youtube' : 'instagram'), line: C.fix(social.chip), context: C.fixCtx }));
  if (settings && settings.open === false) out.push(need('paused', 'invitationSettings', { id: 'paused', blocks: false, who: icon(C.pausedName, 'paused'), line: C.paused(), context: C.pausedCtx }));
  return { rows: out, social, settings };
}

async function creatorLists(influencerId, today = todayInIndia()) {
  const posts = await creatorPostRows(influencerId, today);
  const [collab, pitches, setup] = await Promise.all([
    creatorItems(influencerId, today, posts.owed), creatorPitchRows(influencerId), creatorSetupRows(influencerId),
  ]);
  const needs = sortNeeds([...collab.items.filter((i) => i.side === 'needs'), ...posts.needs, ...pitches.needs, ...setup.rows], today);
  const waiting = sortWaiting([...collab.items.filter((i) => i.side === 'waiting').map((i) => ({ ...i, group: i.group || 'brands' })), ...posts.waiting, ...pitches.waiting]);
  return { needs, waiting, groups: ['brands', 'inflx', 'pitches'], cards: collab.cards, anyPitch: pitches.any, social: setup.social, settings: setup.settings };
}

/* ══════════════════════════════════════════════════════════ the payload */

/** What a row sends to the phone: no SQL row, no internal ordering fields. */
function publicRow(it) {
  const o = {
    id: it.id, kind: it.kind, side: it.side,
    who: it.who.type === 'creator' ? { type: 'creator', name: it.who.name, avatarUrl: it.who.avatarUrl || null }
      : it.who.type === 'brand' ? { type: 'brand', name: it.who.name, logoUrl: it.who.logoUrl || null }
        : { type: 'icon', name: it.who.name, icon: it.who.icon },
    line: it.line, context: it.context || '', why: it.why || null, delayed: !!it.delayed,
    open: { screen: it.open, campaignId: it.campaignId || null, setId: it.setId || null, ciId: it.ciId || null, pitchId: it.pitchId || null, postId: it.postId || null },
  };
  if (it.side === 'waiting') { o.tag = it.tag; o.tone = it.tone || 'waiting'; o.group = it.group; }
  if (it.count != null) o.count = it.count;
  return o;
}
async function present(items) {
  const creators = items.filter((i) => i.who.type === 'creator' && i.who.avatarKey).map((i) => i.who);
  await resolveAvatars(creators, { urlField: 'avatarUrl', keyField: 'avatarKey' });
  return items.map(publicRow);
}
const groupCounts = (waiting, keys) => keys.map((key) => ({ key, count: waiting.filter((w) => w.group === key).length }));

async function unreadCount(userId) {
  const { rows: [r] } = await db.query(
    `SELECT count(*) FILTER (WHERE NOT x.is_read)::int AS n
       FROM (SELECT is_read FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50) x`, [userId]);
  return r ? r.n : 0;
}

/** GET /brands/me/home — BH1, BH4, BH5. */
async function brandHome(brand, userId) {
  // Lazy: the campaign summaries live with the Campaigns tab's own handler.
  const { summariesForBrand, campaignBucket } = require('../controllers/campaignSets.controller');
  const today = todayInIndia();
  const [lists, figures, camps, unread] = await Promise.all([
    brandLists(brand.id, today), walletRead.brandSummary(brand.id), summariesForBrand(brand.id), unreadCount(userId),
  ]);
  const live = camps.filter((c) => campaignBucket(c.state) === 'live')
    .sort((a, b) => String(a.nextPostingDate || '9999').localeCompare(String(b.nextPostingDate || '9999')));
  return {
    me: { name: brand.business_name },
    unread,
    firstDay: camps.length === 0 && lists.needs.length === 0 && lists.waiting.length === 0,
    needs: { total: lists.needs.length, rows: await present(lists.needs.slice(0, HOME_ROWS)) },
    waiting: { total: lists.waiting.length, groups: groupCounts(lists.waiting, lists.groups), rows: await present(lists.waiting.slice(0, HOME_ROWS)) },
    money: { lines: [
      { key: 'available', amount: figures.available },
      { key: 'locked', amount: figures.locked, count: figures.lockedCount },
      { key: 'sales', amount: figures.salesComing, count: figures.salesComingCount },
    ] },
    running: {
      kind: 'campaigns', total: live.length,
      counts: { live: live.length, draft: camps.filter((c) => campaignBucket(c.state) === 'draft').length },
      rows: live.slice(0, HOME_ROWS).map((c) => ({ id: c.id, name: c.name, state: c.state, setCount: c.setCount, nextPostingDate: c.nextPostingDate, counts: c.counts })),
    },
  };
}

/** GET /influencers/me/home — CH1, CH4, CH5. */
async function creatorHome(influencer, userId) {
  const C = COPY.CREATOR;
  const today = todayInIndia();
  const [lists, figures, unread, { rows: [any] }] = await Promise.all([
    creatorLists(influencer.id, today), walletRead.creatorSummary(influencer.id), unreadCount(userId),
    db.query(`SELECT count(*)::int AS n FROM campaign_influencers WHERE influencer_id = $1`, [influencer.id]),
  ]);
  // Running now = what her Collabs › Active lists (invitationsForCreator, tab 'active').
  const active = lists.cards.filter((c) => c.group === 'signed' && (c.status !== 'completed' || (c.goingLive && c.goingLive.completed)));
  const selling = (c) => (c.status === 'completed' ? 1 : 0);
  active.sort((a, b) => selling(a) - selling(b) || String(a.postingDate || '9999').localeCompare(String(b.postingDate || '9999')));
  const handle = String(influencer.instagram_handle || '').replace(/^@/, '').toLowerCase();
  const host = (process.env.PUBLIC_LINK_HOST || 'inflx.in').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const ig = lists.social && lists.social.instagram;
  const yt = lists.social && lists.social.youtube;
  return {
    me: { name: String(influencer.name || '').trim().split(/\s+/)[0] || '' },
    unread,
    firstDay: Number(any.n) === 0 && !lists.anyPitch && lists.needs.length === 0,
    needs: { total: lists.needs.length, rows: await present(lists.needs.slice(0, HOME_ROWS)) },
    waiting: { total: lists.waiting.length, groups: groupCounts(lists.waiting, lists.groups), rows: await present(lists.waiting.slice(0, HOME_ROWS)) },
    money: { lines: [
      { key: 'available', amount: figures.available },
      { key: 'payments', amount: figures.payments, count: figures.paymentsCount, nextAt: figures.nextPaymentAt },
      { key: 'commission', amount: figures.commission, count: figures.commissionCount },
    ] },
    running: {
      kind: 'collaborations', total: active.length,
      rows: active.slice(0, HOME_ROWS).map((c) => ({
        id: c.id, brand: c.brand, campaignName: c.campaignName, setName: c.setName, goal: c.goal, aim: COPY.aimLabel(c.goal),
        postingDate: c.postingDate, earn: COPY.earnWords(c.goal, c.fee, c.commissionPct), chip: c.status === 'completed' ? C.runChip.selling : C.runChip.active,
        completed: c.status === 'completed',
        // Opens what her Collabs card for it opens (CollabsScreen's own order).
        open: { screen: c.content ? 'content' : c.goingLive ? 'goingLive' : c.shoot ? 'shoot' : c.remote ? 'remote' : 'agreement', ciId: c.id },
      })),
    },
    storeLink: handle ? `${host}/s/${handle}` : null,
    // The first-day screen's two lines (CH5): her invitation settings and her numbers, as her Profile shows them.
    setup: {
      invitations: lists.settings ? { state: lists.settings.open === false ? 'paused' : 'open', aims: lists.settings.accepted_aims || [], modes: lists.settings.accepted_modes || [] } : null,
      numbers: { instagram: ig && ig.followers != null ? Number(ig.followers) : null, youtube: yt && yt.subscribers != null ? Number(yt.subscribers) : null },
    },
  };
}

/** The full lists (BH2, BH3, CH2, CH3). `list` is 'needs' or 'waiting'. */
async function brandList(brand, list) {
  const lists = await brandLists(brand.id);
  return fullList(lists, list);
}
async function creatorList(influencer, list) {
  const lists = await creatorLists(influencer.id);
  return fullList(lists, list);
}
async function fullList(lists, list) {
  if (list === 'waiting') {
    return { list: 'waiting', total: lists.waiting.length, groups: groupCounts(lists.waiting, lists.groups), rows: await present(lists.waiting.slice(0, LIST_MAX)) };
  }
  return { list: 'needs', total: lists.needs.length, rows: await present(lists.needs.slice(0, LIST_MAX)) };
}

/** The number on the Home tab (H6), with the bell's. */
async function brandCount(brand, userId) {
  const [lists, unread] = await Promise.all([brandLists(brand.id), unreadCount(userId)]);
  return { needs: lists.needs.length, unread };
}
async function creatorCount(influencer, userId) {
  const [lists, unread] = await Promise.all([creatorLists(influencer.id), unreadCount(userId)]);
  return { needs: lists.needs.length, unread };
}

module.exports = {
  HOME_ROWS, SOON_DAYS,
  brandHome, creatorHome, brandList, creatorList, brandCount, creatorCount,
  // for the tests and the phone's parity fixture
  brandLists, creatorLists, brandStep, creatorStep, tierOf, sortNeeds, publicRow,
};
