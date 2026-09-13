'use strict';

/**
 * Item 4 — the state of a campaign and its sets, the counts on the cards, the invitation
 * cutoff, the locks, and the two delete rules. Written once here so the summary endpoints,
 * the legacy CRUD, the invite path and the expiry job cannot disagree.
 *
 * Contract: features/item4-campaigns-sets · rules v1.14 §5, §5B, §25, §28 · APPROVAL.md
 *
 *   Draft      no invitation has ever been sent for the set
 *   Live       at least one has, and the set is neither expired nor completed
 *   Expired    expired_at is set (the hourly job did it: cutoff passed, nobody signed)
 *   Completed  see completedRule() — a stand-in until the §19 completion rule exists
 *
 *   A campaign follows its sets: draft while every set is draft, live if any is live,
 *   completed when all are, expired when all have expired. Mixed completed+expired counts
 *   as completed. A campaign with no sets is a draft.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { todayInIndia, calendarDay, addDays, isBefore } = require('../utils/indiaDay');
const setShape = require('./setShape.model');
const { DEAD_STATUSES } = require('./collabOwedItems.service');
const { SIGNED_CONTRACT_SQL } = require('./collabState');
const { MSG } = require('./campaignCopy');

/* ────────────────────────────────────────────────────────────── dates */

/** Invitations close this many calendar days before the posting date (§5, §25). */
const INVITE_CUTOFF_DAYS = 3;

/** 'YYYY-MM-DD' of the cutoff for a posting day, or null. Always calculated (founder Q3). */
const cutoffFor = (goLiveDay) => (goLiveDay ? addDays(calendarDay(goLiveDay), -INVITE_CUTOFF_DAYS) : null);

/** What the app needs so it never guesses a date (A12). */
function dateRules(today = null) {
  const t = today || todayInIndia();
  return {
    today: t,
    earliestPostingDate: setShape.earliestGoLiveDay(t),
    minDaysAhead: setShape.MIN_DAYS_TO_GO_LIVE,
    cutoffDaysBefore: INVITE_CUTOFF_DAYS,
  };
}

/* ───────────────────────────────────────────────────────────── statuses */

/**
 * Waiting to answer, or answered but not yet signed by both sides. Item 5 (founder Q5): a
 * creator who asked for another date has ANSWERED — 'deferred' is no longer waiting, is never
 * closed by the set expiring, and sits under its own heading on the set.
 */
const WAITING_STATUSES = ['invited', 'applied', 'accepted', 'negotiating'];
/** "Asked for another date" — item 4's moved-out pool, shown in its own group (I9). */
const DEFERRED_STATUSES = ['deferred'];
/** Shown as "declined" on the cards: she said no, or never answered (APPROVAL.md Q9). */
const DECLINED_STATUSES = ['declined', 'expired'];
/** A row that is out of the running for good (DEAD includes item 5's withdrawn and removed). */
const TERMINAL_STATUSES = ['completed', ...DEAD_STATUSES];
/**
 * Rows that must NOT block a second invitation of the same creator elsewhere in the campaign
 * (APPROVAL.md Q6): the dead ones (item 5: withdrawn and removed included), plus 'deferred' —
 * migration 167 exists precisely so a creator who asked for a different day can be put in
 * another set.
 */
const NON_BLOCKING_STATUSES = [...DEAD_STATUSES, 'deferred'];

/** The statuses the expiry job closes when a set expires — never 'deferred' (item 5, Q5). */
const OPEN_STATUSES = WAITING_STATUSES;

const isTerminal = (status) => TERMINAL_STATUSES.includes(String(status || ''));

/* ────────────────────────────────────────────────────────────── counts */

const EMPTY_COUNTS = Object.freeze({ invited: 0, signed: 0, waiting: 0, declined: 0, terminal: 0, finished: 0 });

/**
 * One grouped query for many sets, never per row (D3). Invited counts everyone ever sent an
 * invitation, including those who declined or expired, so the bar can show honestly that
 * some people said no.
 */
async function countsForSets(setIds, client = null) {
  const conn = client || db;
  const out = new Map();
  if (!setIds || !setIds.length) return out;
  const { rows } = await conn.query(
    `SELECT ci.set_id,
            count(*)::int                                                          AS invited,
            count(*) FILTER (WHERE ${SIGNED_CONTRACT_SQL})::int                     AS signed,
            count(*) FILTER (WHERE ci.status = ANY($2::campaign_influencer_status[])
                               AND NOT (${SIGNED_CONTRACT_SQL}))::int               AS waiting,
            count(*) FILTER (WHERE ci.status = ANY($3::campaign_influencer_status[]))::int AS declined,
            count(*) FILTER (WHERE ci.status = ANY($4::campaign_influencer_status[]))::int AS terminal,
            count(*) FILTER (WHERE ci.status = 'completed')::int                            AS finished
       FROM campaign_influencers ci
       LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
      WHERE ci.set_id = ANY($1::uuid[])
      GROUP BY ci.set_id`,
    [setIds, WAITING_STATUSES, DECLINED_STATUSES, TERMINAL_STATUSES]
  );
  for (const r of rows) out.set(r.set_id, { invited: r.invited, signed: r.signed, waiting: r.waiting, declined: r.declined, terminal: r.terminal, finished: r.finished });
  return out;
}

const sumCounts = (list) => list.reduce((a, c) => ({
  invited: a.invited + c.invited, signed: a.signed + c.signed, waiting: a.waiting + c.waiting, declined: a.declined + c.declined, terminal: a.terminal + c.terminal, finished: a.finished + (c.finished || 0),
}), { ...EMPTY_COUNTS });

/* ─────────────────────────────────────────────────────────────── states */

/**
 * "Completed" — the stand-in rule (founder Q4): at least one invitation, not expired, and
 * every creator row sits in a terminal status. Honest for Pay for Content today; a Pay for
 * Sale set cannot reach it until the §19 completion rule writes 'completed' for it. Replace
 * this one function when that rule lands.
 */
function completedRule(set, counts) {
  if (set.expired_at) return false;
  if (!counts || counts.invited === 0) return false;
  // Item 5: at least one collaboration must actually have finished. Without this, a set whose
  // only invitation was withdrawn or declined read as "completed" and refused a fresh
  // invitation — the brand could never invite again after withdrawing (check 22).
  if (!(counts.finished > 0)) return false;
  return counts.terminal === counts.invited;
}

/**
 * The derived state of one set plus everything the screens need next to it.
 * @param {object} set      a campaign_sets row
 * @param {object} counts   from countsForSets (or undefined = no invitations)
 * @param {string} today    'YYYY-MM-DD' in India, injectable for tests
 */
function describeSet(set, counts = EMPTY_COUNTS, today = null) {
  const t = today || todayInIndia();
  const postingDate = set.go_live_date ? calendarDay(set.go_live_date) : null;
  const cutoff = cutoffFor(postingDate);
  const invited = counts.invited > 0;
  let state;
  if (set.expired_at) state = 'expired';
  else if (!invited) state = 'draft';
  else if (completedRule(set, counts)) state = 'completed';
  else state = 'live';

  const datePassed = !!(postingDate && isBefore(postingDate, t));
  // The cutoff passes at the END of the cutoff day (India). Inviting is allowed while
  // today <= cutoff.
  const cutoffPassed = !!(cutoff && isBefore(cutoff, t));
  const daysToCutoff = cutoff && !cutoffPassed ? Math.max(0, Math.round((Date.parse(cutoff) - Date.parse(t)) / 86400000)) : null;

  let canInvite = { ok: true, reason: null, message: null };
  if (state === 'expired') canInvite = { ok: false, reason: 'expired', message: MSG.INVITE_CLOSED(cutoff) };
  else if (state === 'completed') canInvite = { ok: false, reason: 'completed', message: MSG.INVITE_CLOSED(cutoff) };
  else if (datePassed) canInvite = { ok: false, reason: 'date_passed', message: MSG.INVITE_DATE_PASSED };
  else if (cutoffPassed) canInvite = { ok: false, reason: 'cutoff_passed', message: MSG.INVITE_CLOSED(cutoff) };

  return {
    state,
    locked: invited,
    lockedFields: invited ? [...LOCKED_FIELDS] : [],
    datePassed,
    postingDate,
    cutoff,
    cutoffPassed,
    daysToCutoff,
    canInvite,
    isPast: state === 'expired' || state === 'completed',
  };
}

/** A campaign follows its sets (§5B). */
function campaignStateFrom(setStates) {
  if (!setStates.length) return 'draft';
  const s = setStates.map(x => x.state);
  if (s.some(x => x === 'live')) return 'live';
  if (s.every(x => x === 'draft')) return 'draft';
  if (s.every(x => x === 'expired')) return 'expired';
  if (s.every(x => x === 'completed' || x === 'expired')) return 'completed';
  // some drafts alongside finished sets: nothing is live, nothing is being built for real
  return s.some(x => x === 'completed') ? 'completed' : (s.some(x => x === 'expired') ? 'expired' : 'draft');
}

/* ─────────────────────────────────────────────────────────────── locks */

/** Fields that never change once the first invitation has gone out (§28, §5B). */
const LOCKED_FIELDS = ['goal', 'go_live_date', 'shoot_mode', 'branch_id', 'invites_close_at'];

async function hasAnyInvitation(setId, client = null) {
  const conn = client || db;
  const { rows } = await conn.query(`SELECT 1 FROM campaign_influencers WHERE set_id = $1 LIMIT 1`, [setId]);
  return rows.length > 0;
}

async function campaignHasAnyInvitation(campaignId, client = null) {
  const conn = client || db;
  const { rows } = await conn.query(
    `SELECT 1 FROM campaign_influencers ci JOIN campaign_sets s ON s.id = ci.set_id WHERE s.campaign_id = $1 LIMIT 1`,
    [campaignId]
  );
  return rows.length > 0;
}

const sameDay = (a, b) => (a ? calendarDay(a) : null) === (b ? calendarDay(b) : null);
const sameVal = (a, b) => (a == null ? null : String(a)) === (b == null ? null : String(b));

/**
 * The one place the lock is enforced (APPROVAL.md §3.9). `changes` is the body of an update;
 * a locked field that is present AND different is refused with the exact message. A locked
 * field sent back unchanged is ignored, so a screen can PATCH the whole form.
 * @returns the set of field names that may still be written
 */
async function assertSetEditable(set, changes, client = null) {
  const locked = await hasAnyInvitation(set.id, client);
  if (!locked) return { locked: false };
  for (const f of LOCKED_FIELDS) {
    if (changes[f] === undefined) continue;
    const same = (f === 'go_live_date' || f === 'invites_close_at') ? sameDay(changes[f], set[f]) : sameVal(changes[f], set[f]);
    if (!same) throw new AppError('LOCKED', MSG.LOCKED, 422, f);
  }
  return { locked: true };
}

async function assertSetDeletable(set, client = null) {
  if (await hasAnyInvitation(set.id, client)) throw new AppError('HAS_INVITATIONS', MSG.DELETE_SET, 422);
}

async function assertCampaignDeletable(campaignId, client = null) {
  if (await campaignHasAnyInvitation(campaignId, client)) throw new AppError('HAS_INVITATIONS', MSG.DELETE_CAMPAIGN, 422);
}

/** Refuses an invite into a set whose date passed or whose cutoff is gone (D9, §7). */
function assertCanInvite(set, counts, today = null) {
  const d = describeSet(set, counts, today);
  if (!d.canInvite.ok) throw new AppError('INVITE_CLOSED', d.canInvite.message, 422, 'go_live_date');
  return d;
}

/* ────────────────────────────────────────────────────────── validation */

const AIMS = ['conversion', 'engagement', 'hybrid'];

/**
 * The item 4 shape of a set being created or edited: name, Aim, mode, branch, posting date.
 * Returns { ok, field, message } and never throws; the controller turns it into a 422.
 * `existing` is the stored row on update (so untouched fields are checked as they stand).
 */
async function validateSetInput(body, { brandId, existing = null, today = null, requireAll = true, client = null } = {}) {
  const conn = client || db;
  const pick = (f) => (body[f] !== undefined ? body[f] : (existing ? existing[f] : undefined));
  const name = pick('name');
  if (requireAll || body.name !== undefined) {
    if (name == null || !String(name).trim() || String(name).trim().length > 60) return { ok: false, field: 'name', message: MSG.SET_NAME };
  }
  const goal = pick('goal');
  if (requireAll || body.goal !== undefined) {
    if (!goal || !AIMS.includes(goal)) return { ok: false, field: 'goal', message: MSG.AIM };
  }
  const mode = pick('shoot_mode');
  if (requireAll || body.shoot_mode !== undefined) {
    if (!mode || !setShape.SHOOT_MODES_OFFERED.includes(mode)) return { ok: false, field: 'shoot_mode', message: MSG.MODE };
  }
  const branchId = pick('branch_id');
  if (mode === 'visit') {
    if (!branchId) return { ok: false, field: 'branch_id', message: MSG.BRANCH };
    const { rows } = await conn.query(`SELECT id, city_id FROM brand_branches WHERE id = $1 AND brand_id = $2`, [branchId, brandId]);
    if (!rows[0]) return { ok: false, field: 'branch_id', message: MSG.BRANCH };
  }
  const day = pick('go_live_date');
  if (requireAll || body.go_live_date !== undefined) {
    if (!day) return { ok: false, field: 'go_live_date', message: MSG.DATE };
    const t = today || todayInIndia();
    // Only a day being CHANGED must clear the lead time; an existing day is not re-checked.
    const changing = !existing || !sameDay(body.go_live_date, existing.go_live_date);
    if (changing && isBefore(calendarDay(day), setShape.earliestGoLiveDay(t))) return { ok: false, field: 'go_live_date', message: MSG.DATE_TOO_SOON };
  }
  return { ok: true };
}

function validateCampaignInput(body, { requireName = true } = {}) {
  if (requireName || body.name !== undefined) {
    const n = body.name == null ? '' : String(body.name).trim();
    if (!n || n.length > 60) return { ok: false, field: 'name', message: MSG.CAMPAIGN_NAME };
  }
  if (body.brief != null && String(body.brief).length > 200) return { ok: false, field: 'brief', message: MSG.CAMPAIGN_DESC_LONG };
  return { ok: true };
}

/* ───────────────────────────────────────────────────────── duplicate name */

/** "Set A", "Set B"… — the next letter after the highest one in use, not a count (Q5). */
function nextSetLetterName(existingNames) {
  let max = -1;
  for (const n of existingNames || []) {
    const m = /^Set ([A-Z])\b/.exec(String(n || '').trim());
    if (m) max = Math.max(max, m[1].charCodeAt(0) - 65);
  }
  return `Set ${String.fromCharCode(65 + max + 1)}`;
}

/** A name that is not already used in the campaign: "X (copy)", then "X (copy 2)", … */
function uniqueCopyName(base, existingNames) {
  const used = new Set((existingNames || []).map(n => String(n || '').trim().toLowerCase()));
  const root = String(base || 'Set').trim().slice(0, 53);
  let candidate = `${root} (copy)`;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${root} (copy ${i})`;
  return candidate.slice(0, 60);
}

module.exports = {
  INVITE_CUTOFF_DAYS, cutoffFor, dateRules,
  WAITING_STATUSES, DEFERRED_STATUSES, DECLINED_STATUSES, TERMINAL_STATUSES, NON_BLOCKING_STATUSES, OPEN_STATUSES, isTerminal,
  EMPTY_COUNTS, countsForSets, sumCounts,
  completedRule, describeSet, campaignStateFrom,
  LOCKED_FIELDS, hasAnyInvitation, campaignHasAnyInvitation,
  assertSetEditable, assertSetDeletable, assertCampaignDeletable, assertCanInvite,
  AIMS, validateSetInput, validateCampaignInput,
  nextSetLetterName, uniqueCopyName,
};
