'use strict';

/**
 * Item 3b — social numbers endpoints (prompt §4).
 * Contract: features/item3b-social-numbers
 *
 * Creator:  GET  /influencers/me/social                      A3 · both platforms, internal state, chip
 *           GET  /influencers/me/social/:platform            A3 detail (S2/S3 with the R4 banner)
 *           POST /influencers/me/social/:platform/check-again A4 · private/failing only, once a day
 * Brand:    GET  /influencers/:id/social/:platform           A2 · approved creators, brand state only
 * Admin:    GET  /admin/social/handle-checks                 A7 · pending ownership checks
 *           POST /admin/social/accounts/:id/confirm | reject | measure-now
 *           GET  /admin/social/flags · POST /admin/social/flags/:id/resolve
 *           GET  /admin/social/costs?month=YYYY-MM
 *           GET  /admin/influencers/:id/social               per-creator panel
 */

const db = require('../config/db');
const env = require('../config/env');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const accounts = require('../services/socialAccounts.service');
const measure = require('../services/socialMeasure.service');

const PLATFORMS = new Set(['instagram', 'youtube']);
function platformParam(req) {
  const p = String(req.params.platform || '').toLowerCase();
  if (!PLATFORMS.has(p)) throw new AppError('NOT_FOUND', 'Unknown platform', 404);
  return p;
}
function rethrow(e) {
  if (e && e.code && e.status) throw new AppError(e.code, e.message, e.status, e.field);
  throw e;
}
async function influencerIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}
/** Runs kicked from an API call start at once outside tests; tests call the job directly. */
function kickNow(accountId, runType, trigger) { if (process.env.NODE_ENV !== 'test') measure.kick(accountId, runType, trigger); }

// ── Creator ────────────────────────────────────────────────────────────────────────
const mine = asyncHandler(async (req, res) => {
  const id = await influencerIdOf(req.user.sub);
  return success(res, await accounts.mine(id));
});

const myDetail = asyncHandler(async (req, res) => {
  const id = await influencerIdOf(req.user.sub);
  const d = await accounts.detail(id, platformParam(req), { forBrand: false });
  if (!d) throw new AppError('NOT_FOUND', 'Account not added', 404);
  return success(res, { account: d });
});

const checkAgain = asyncHandler(async (req, res) => {
  const id = await influencerIdOf(req.user.sub);
  const platform = platformParam(req);
  let acc;
  try { acc = await accounts.checkAgain(id, platform); } catch (e) { rethrow(e); }
  kickNow(acc.id, 'full', 'check_again');
  return success(res, await accounts.mine(id));
});

// ── Brand ──────────────────────────────────────────────────────────────────────────
const brandDetail = asyncHandler(async (req, res) => {
  const platform = platformParam(req);
  const { rows } = await db.query(`SELECT i.id FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1 AND u.status = 'approved'`, [req.params.id]);
  if (!rows[0] && req.user.role !== 'admin') throw new AppError('NOT_FOUND', 'Creator not found', 404);
  const d = await accounts.detail(req.params.id, platform, { forBrand: req.user.role !== 'admin' });
  if (!d) throw new AppError('NOT_FOUND', 'Account not added', 404);
  return success(res, { account: d });
});

// ── Admin ──────────────────────────────────────────────────────────────────────────
const handleChecks = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.id, a.platform, a.handle_raw, a.handle_norm, a.channel_url, a.created_at, a.influencer_id,
            COALESCE(i.full_name, u.name) AS creator_name, i.instagram_handle, i.youtube_handle,
            (SELECT p.handle_norm FROM creator_social_accounts p WHERE p.replaced_by = a.id LIMIT 1) AS old_handle,
            (SELECT p.channel_url FROM creator_social_accounts p WHERE p.replaced_by = a.id LIMIT 1) AS old_url
       FROM creator_social_accounts a
       JOIN influencers i ON i.id = a.influencer_id JOIN users u ON u.id = i.user_id
      WHERE a.replaced_at IS NULL AND a.state = 'waiting_check'
      ORDER BY a.created_at ASC`);
  return success(res, { checks: rows });
});

const confirm = asyncHandler(async (req, res) => {
  let acc;
  try { acc = await accounts.confirmOwnership(req.params.id, req.user.sub); } catch (e) { rethrow(e); }
  kickNow(acc.id, 'full', 'handle_confirm');
  return success(res, { account: acc });
});

const reject = asyncHandler(async (req, res) => {
  let acc;
  try { acc = await accounts.rejectOwnership(req.params.id, req.user.sub, req.body && req.body.reason); } catch (e) { rethrow(e); }
  return success(res, { account: acc });
});

const measureNow = asyncHandler(async (req, res) => {
  const acc = await accounts.byId(req.params.id);
  if (!acc || acc.replaced_at) throw new AppError('NOT_FOUND', 'Account not found', 404);
  if (acc.ownership !== 'confirmed') throw new AppError('CONFLICT', 'Confirm the handle first', 409);
  if (acc.user_status !== 'approved') throw new AppError('CONFLICT', 'The creator is not approved', 409);
  if (req.query.wait === '1' || (req.body && req.body.wait)) {
    const out = await measure.runAccount(acc.id, 'full', 'measure_now');
    return success(res, { started: true, ...out, account: await accounts.byId(acc.id) });
  }
  kickNow(acc.id, 'full', 'measure_now');
  return success(res, { started: true });
});

const flags = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT f.*, a.platform, a.handle_norm, a.influencer_id, COALESCE(i.full_name, u.name) AS creator_name
       FROM social_admin_flags f
       LEFT JOIN creator_social_accounts a ON a.id = f.account_id
       LEFT JOIN influencers i ON i.id = a.influencer_id LEFT JOIN users u ON u.id = i.user_id
      WHERE f.resolved_at IS NULL ORDER BY f.created_at DESC LIMIT 200`);
  return success(res, { flags: rows });
});

const resolveFlag = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`UPDATE social_admin_flags SET resolved_at = now(), resolved_by = $2 WHERE id = $1 AND resolved_at IS NULL RETURNING *`, [req.params.id, req.user.sub]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Flag not found', 404);
  return success(res, { flag: rows[0] });
});

const costs = asyncHandler(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? `${req.query.month}-01` : null;
  const { rows } = await db.query(
    `SELECT a.platform, count(*)::int AS runs, COALESCE(sum(r.usage_usd),0)::float AS usd
       FROM creator_social_runs r JOIN creator_social_accounts a ON a.id = r.account_id
      WHERE date_trunc('month', r.started_at) = date_trunc('month', COALESCE($1::date, now()))
      GROUP BY a.platform`, [month]);
  const spend = await measure.monthSpend().catch(e => ({ usd: null, error: e.message }));
  // post-performance-v2 (P4, E12): the campaign post reads, by platform, beside the creator runs.
  const postRuns = await require('../services/postStats.service').monthRuns(month);
  const socialRunsUsd = rows.reduce((a, r) => a + r.usd, 0);
  return success(res, { month: month ? month.slice(0, 7) : new Date().toISOString().slice(0, 7), byPlatform: rows, socialRunsUsd, accountMonthUsd: spend.usd, accountSource: spend.source, budgetUsd: env.APIFY_MONTHLY_BUDGET_USD,
    postRuns, socialRuns: rows.reduce((a, r) => a + r.runs, 0), totalUsd: Math.round((socialRunsUsd + postRuns.usd) * 10000) / 10000 });
});

const adminCreator = asyncHandler(async (req, res) => {
  const { rows: accs } = await db.query(`SELECT * FROM creator_social_accounts WHERE influencer_id = $1 ORDER BY platform, created_at DESC`, [req.params.id]);
  const { rows: runs } = await db.query(
    `SELECT r.* FROM creator_social_runs r JOIN creator_social_accounts a ON a.id = r.account_id WHERE a.influencer_id = $1 ORDER BY r.started_at DESC LIMIT 20`, [req.params.id]);
  return success(res, { accounts: accs, runs, mine: await accounts.mine(req.params.id) });
});

module.exports = { mine, myDetail, checkAgain, brandDetail, handleChecks, confirm, reject, measureNow, flags, resolveFlag, costs, adminCreator };
