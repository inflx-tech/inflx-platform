'use strict';

/**
 * Item 6 — the brand's pool: creators who agreed terms with the brand but not the shape of the
 * set they were invited to. Brand-level, its own table, a note only (never blocks anything).
 * Contract: features/item6-negotiation · rules v1.18 §7B · gap report §8 · APPROVAL §3.2, §3.3, Q7, Q8
 *
 *   waiting → used (the moment she is invited from it; stays used whatever she answers)
 *           → removed_by_brand · removed_by_creator (either side, any time)
 *           → expired (the lifetime stamped on the entry ran out; the creator is told)
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const notificationService = require('./notification.service');
const settings = require('./platformSettings.service');
const setShape = require('./setShape.model');
const { resolveAvatars } = require('../utils/avatarResolver');
const { calendarDay, todayInIndia, daysBetween, isBefore } = require('../utils/indiaDay');
const { deliverablesInWords } = require('./invitationCopy');
const { MSG, NOTIFY } = require('./negotiationCopy');
const { longDate } = require('./campaignCopy');

const CLOSING_SOON_DAYS = 7;
const inr = (n) => (n == null ? null : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }));
const pct = (p) => (p == null ? null : `${Number(p) % 1 === 0 ? Number(p) : Number(p).toFixed(1)}%`);
const jsonObj = (v) => (v && typeof v === 'object' ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch (_) { return {}; } })() : {}));

/** "12%" · "₹9,000 · 1 reel" · "₹5,000 + 10%" */
function termsLine(goal, s) {
  if (!s) return null;
  if (goal === 'engagement') return [s.fee != null ? `₹${inr(s.fee)}` : null, deliverablesInWords(s.deliverables)].filter(Boolean).join(' · ');
  if (goal === 'hybrid') return [s.fee != null ? `₹${inr(s.fee)}` : null, pct(s.commissionPct)].filter(Boolean).join(' + ');
  return pct(s.commissionPct);
}

/** Runs on the caller's transaction. */
async function create({ brandId, influencerId, goal, agreedTerms, wantsGoLiveDate, wantsShootMode, note, fromCampaignId, fromSetId, fromCiId }, tx = db) {
  const lifetime = Number(await settings.get('pool_lifetime_days'));
  const { rows } = await tx.query(
    `INSERT INTO brand_creator_pool
       (brand_id, influencer_id, goal, agreed_terms_json, wants_go_live_date, wants_shoot_mode, note, from_campaign_id, from_set_id, from_ci_id, lifetime_days, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, now() + make_interval(days => $12::int))
     RETURNING *`,
    [brandId, influencerId, goal, JSON.stringify(agreedTerms || {}), wantsGoLiveDate || null, wantsShootMode || null, note || null, fromCampaignId || null, fromSetId || null, fromCiId || null, lifetime, lifetime]
  );
  return rows[0];
}

const SELECT = `
  SELECT p.*, COALESCE(i.full_name, u.name) AS creator_name, i.profile_image_r2_key, u.id AS creator_user_id, u.fcm_token AS creator_fcm,
         c.name AS from_campaign_name, s.name AS from_set_name, b.business_name AS brand_name, bu.id AS brand_user_id, bu.fcm_token AS brand_fcm
    FROM brand_creator_pool p
    JOIN influencers i ON i.id = p.influencer_id JOIN users u ON u.id = i.user_id
    JOIN brands b ON b.id = p.brand_id JOIN users bu ON bu.id = b.user_id
    LEFT JOIN campaigns c ON c.id = p.from_campaign_id
    LEFT JOIN campaign_sets s ON s.id = p.from_set_id`;

function shape(r, today) {
  const wantsDay = r.wants_go_live_date ? calendarDay(r.wants_go_live_date) : null;
  const earliest = setShape.earliestGoLiveDay(today);
  const daysLeft = Math.max(0, daysBetween(today, calendarDay(r.expires_at)));
  return {
    entryId: r.id, state: r.state,
    creator: { id: r.influencer_id, name: r.creator_name, avatarUrl: r.avatar_url || null },
    goal: r.goal, terms: jsonObj(r.agreed_terms_json), termsLine: termsLine(r.goal, jsonObj(r.agreed_terms_json)),
    wantsGoLiveDate: wantsDay, wantsShootMode: r.wants_shoot_mode || null, note: r.note || null,
    // APPROVAL Q7: a wanted date now inside item 4's seven-day floor cannot be built any more.
    noLongerPossible: !!(wantsDay && isBefore(wantsDay, earliest)),
    agreedAt: r.agreed_at, expiresAt: r.expires_at, daysLeft, closingSoon: r.state === 'waiting' && daysLeft < CLOSING_SOON_DAYS,
    from: { campaignId: r.from_campaign_id, campaignName: r.from_campaign_name || null, setId: r.from_set_id, setName: r.from_set_name || null, invitationId: r.from_ci_id },
    usedInvitationId: r.used_ci_id || null,
  };
}

/** The group key the pool is shown by: the wanted date first, else the wanted mode (N14). */
function groupKeyOf(e) {
  if (e.wantsGoLiveDate) return { key: `date:${e.wantsGoLiveDate}`, title: `Want ${longDate(e.wantsGoLiveDate).replace(/ \d{4}$/, '')}${e.noLongerPossible ? ' · no longer possible' : ''}` };
  if (e.wantsShootMode) return { key: `mode:${e.wantsShootMode}`, title: `Want ${e.wantsShootMode === 'visit' ? 'Store Visit' : 'Remote'}` };
  return { key: 'other', title: 'Want a different set' };
}

/** B10 — the brand's waiting entries, grouped. `goal` marks which rows are selectable for a set of that Aim. */
async function listForBrand(brandId, { goal = null } = {}) {
  const today = todayInIndia();
  const { rows } = await db.query(`${SELECT} WHERE p.brand_id = $1 AND p.state = 'waiting' ORDER BY p.wants_go_live_date NULLS LAST, p.expires_at`, [brandId]);
  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  const groups = new Map();
  for (const r of rows) {
    const e = shape(r, today);
    e.selectable = !goal || goal === e.goal;
    const g = groupKeyOf(e);
    if (!groups.has(g.key)) groups.set(g.key, { key: g.key, title: g.title, rows: [] });
    groups.get(g.key).rows.push(e);
  }
  return { total: rows.length, groups: [...groups.values()].map(g => ({ ...g, count: g.rows.length })) };
}

/** The creator's own waiting entries (N12 "Agreed, waiting for a set"). */
async function listForCreator(influencerId) {
  const today = todayInIndia();
  const { rows } = await db.query(`${SELECT} WHERE p.influencer_id = $1 AND p.state IN ('waiting','expired') ORDER BY p.created_at DESC`, [influencerId]);
  return rows.map(r => ({ ...shape(r, today), brand: { name: r.brand_name } }));
}

async function entryFor(entryId, { brandId = null, influencerId = null }) {
  const { rows } = await db.query(`${SELECT} WHERE p.id = $1 AND ${brandId ? 'p.brand_id = $2' : 'p.influencer_id = $2'}`, [entryId, brandId || influencerId]);
  return rows[0] || null;
}

/** B11 — either side removes an entry early. */
async function remove({ entryId, brandId = null, influencerId = null, actorUserId }) {
  const r = await entryFor(entryId, { brandId, influencerId });
  if (!r) throw new AppError('NOT_FOUND', 'Pool entry not found', 404);
  if (r.state !== 'waiting') throw new AppError('VALIDATION_ERROR', MSG.POOL_GONE(r.creator_name), 422, 'state');
  const state = brandId ? 'removed_by_brand' : 'removed_by_creator';
  await db.query(`UPDATE brand_creator_pool SET state = $2, state_changed_at = now(), state_changed_by = $3 WHERE id = $1 AND state = 'waiting'`, [entryId, state, actorUserId || null]);
  const toBrand = !brandId;
  await notificationService.send({
    userId: toBrand ? r.brand_user_id : r.creator_user_id, type: NOTIFY.POOL_REMOVED.type, title: NOTIFY.POOL_REMOVED.title,
    body: toBrand ? `${r.creator_name} left your pool.` : `${r.brand_name} removed you from their pool. Nothing else changes.`,
    fcmToken: toBrand ? r.brand_fcm : r.creator_fcm, sendSms: false, data: { screen: toBrand ? 'pool' : 'collabs', pool_entry_id: entryId },
  }).catch(err => console.error('[NOTIFICATION] pool.removed failed:', err.message));
  return { entryId, state };
}

/**
 * B12 — the defaults for item 4's new-set screen and item 5's terms screen. Every entry must be
 * this brand's, waiting, and on ONE Aim. The date is pre-filled only when all agree on one that is
 * still possible; the mode only when all agree.
 */
async function setDefaults(brandId, entryIds) {
  const ids = [...new Set((entryIds || []).filter(Boolean))];
  if (!ids.length) throw new AppError('VALIDATION_ERROR', 'Pick at least one creator.', 422, 'entryIds');
  const today = todayInIndia();
  const { rows } = await db.query(`${SELECT} WHERE p.brand_id = $1 AND p.id = ANY($2::uuid[])`, [brandId, ids]);
  const byId = new Map(rows.map(r => [r.id, r]));
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) throw new AppError('NOT_FOUND', 'Pool entry not found', 404, 'entryIds');
    if (r.state !== 'waiting') throw new AppError('VALIDATION_ERROR', MSG.POOL_GONE(r.creator_name), 422, 'entryIds');
  }
  const goals = new Set(rows.map(r => r.goal));
  if (goals.size > 1) throw new AppError('VALIDATION_ERROR', MSG.POOL_MIXED_AIMS, 422, 'entryIds');
  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  const entries = ids.map(id => shape(byId.get(id), today));
  const dates = new Set(entries.map(e => e.wantsGoLiveDate).filter(Boolean));
  const modes = new Set(entries.map(e => e.wantsShootMode).filter(Boolean));
  const oneDate = dates.size === 1 ? [...dates][0] : null;
  const goLiveDate = oneDate && !isBefore(oneDate, setShape.earliestGoLiveDay(today)) ? oneDate : null;
  return {
    goal: [...goals][0],
    shoot_mode: modes.size === 1 ? [...modes][0] : null,
    branch_id: null,
    go_live_date: goLiveDate,
    wantedDate: oneDate, dateNoLongerPossible: !!(oneDate && !goLiveDate),
    creators: entries.map(e => ({ entryId: e.entryId, influencerId: e.creator.id, name: e.creator.name, avatarUrl: e.creator.avatarUrl, terms: e.terms, termsLine: e.termsLine, agreedAt: e.agreedAt, wantsGoLiveDate: e.wantsGoLiveDate, wantsShootMode: e.wantsShootMode })),
  };
}

/** Item 5's send calls this inside its transaction: the entry is used the moment she is invited. */
async function markUsed({ entryId, brandId, influencerId, ciId }, tx) {
  const { rows } = await tx.query(
    `UPDATE brand_creator_pool SET state = 'used', used_ci_id = $4, state_changed_at = now()
      WHERE id = $1 AND brand_id = $2 AND influencer_id = $3 AND state = 'waiting' RETURNING id, agreed_at, wants_go_live_date, agreed_terms_json, goal`,
    [entryId, brandId, influencerId, ciId]
  );
  return rows[0] || null;
}

/** For the send's prepare step: the entry must be this brand's, waiting, and hers. */
async function waitingEntry({ entryId, brandId, influencerId }) {
  const { rows } = await db.query(`SELECT * FROM brand_creator_pool WHERE id = $1 AND brand_id = $2 AND influencer_id = $3`, [entryId, brandId, influencerId]);
  return rows[0] || null;
}

/** B16 — hourly: expire waiting entries past their lifetime; say "closing soon" once at seven days. */
async function expire({ now = new Date() } = {}) {
  const out = { expired: 0, closingNotified: 0 };
  const { rows: due } = await db.query(`${SELECT} WHERE p.state = 'waiting' AND p.expires_at <= $1`, [now]);
  for (const r of due) {
    const { rowCount } = await db.query(`UPDATE brand_creator_pool SET state = 'expired', state_changed_at = now() WHERE id = $1 AND state = 'waiting'`, [r.id]);
    if (!rowCount) continue;
    out.expired += 1;
    await notificationService.send({ userId: r.creator_user_id, type: NOTIFY.POOL_CLOSED.type, title: NOTIFY.POOL_CLOSED.title, body: `${r.lifetime_days} days passed without a new set from ${r.brand_name}, so this closed.`, fcmToken: r.creator_fcm, sendSms: false, data: { screen: 'collabs', pool_entry_id: r.id } }).catch(() => {});
    await notificationService.send({ userId: r.brand_user_id, type: NOTIFY.POOL_CLOSED.type, title: NOTIFY.POOL_CLOSED.title, body: `${r.creator_name} left your pool: ${r.lifetime_days} days passed without a set.`, fcmToken: r.brand_fcm, sendSms: false, data: { screen: 'pool', pool_entry_id: r.id } }).catch(() => {});
  }
  const soon = new Date(now.getTime() + CLOSING_SOON_DAYS * 86400000);
  const { rows: closing } = await db.query(`${SELECT} WHERE p.state = 'waiting' AND p.closing_notified_at IS NULL AND p.expires_at <= $1 AND p.expires_at > $2`, [soon, now]);
  for (const r of closing) {
    const { rowCount } = await db.query(`UPDATE brand_creator_pool SET closing_notified_at = now() WHERE id = $1 AND closing_notified_at IS NULL`, [r.id]);
    if (!rowCount) continue;
    out.closingNotified += 1;
    const days = Math.max(0, daysBetween(todayInIndia(), calendarDay(r.expires_at)));
    await notificationService.send({ userId: r.brand_user_id, type: NOTIFY.POOL_CLOSING.type, title: NOTIFY.POOL_CLOSING.title, body: `${r.creator_name} leaves your pool in ${days} days. Build a set for her before then.`, fcmToken: r.brand_fcm, sendSms: false, data: { screen: 'pool', pool_entry_id: r.id } }).catch(() => {});
    await notificationService.send({ userId: r.creator_user_id, type: NOTIFY.POOL_CLOSING.type, title: NOTIFY.POOL_CLOSING.title, body: `Your place in ${r.brand_name}'s pool closes in ${days} days unless they build a set.`, fcmToken: r.creator_fcm, sendSms: false, data: { screen: 'collabs', pool_entry_id: r.id } }).catch(() => {});
  }
  return out;
}

module.exports = { CLOSING_SOON_DAYS, termsLine, create, listForBrand, listForCreator, entryFor, remove, setDefaults, markUsed, waitingEntry, expire, shape };
