'use strict';

/**
 * Referral Admin controller — admin-facing API for the referral system.
 * Mounted at /admin/referrals/* by routes/index.js.
 * Contract: features/referral-admin-controls (Contract 2 of 4).
 *
 * Reads (settings GET, edges/ledger/summary lists) → any admin role.
 * Writes (settings PATCH, edge create/edit/end)    → superadmin only.
 *
 * This controller is config + read + manual-edge authoring only. It NEVER
 * writes referral_ledger and NEVER moves money — the engine (Contract 1) is the
 * sole ledger/accrual writer. Edge creation routes through referral.service so
 * the self/circular/dedup guards are reused.
 */

const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const referralService = require('../services/referral.service');

const WINDOW_MONTHS = referralService.REFERRAL_WINDOW_MONTHS;

function parsePaging(q) {
  let page = parseInt(q.page, 10);
  let limit = parseInt(q.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  return { page, limit, offset: (page - 1) * limit };
}

// Fallback display label when a name can't be resolved (e.g. agency — its
// table arrives in Contract 3 — or a deleted entity).
function labelFor(type, id, resolvedName) {
  if (resolvedName) return resolvedName;
  const short = id ? String(id).slice(0, 8) : '?';
  if (type === 'agency') return `Agency ${short}`;
  if (type === 'influencer') return `Influencer ${short}`;
  if (type === 'brand') return `Brand ${short}`;
  return short;
}

// ── Settings ────────────────────────────────────────────────────────────────

const getSettings = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT default_pct, updated_by_admin_id, updated_at
       FROM referral_settings WHERE id = 1`
  );
  const row = rows[0] || { default_pct: 25.00, updated_by_admin_id: null, updated_at: null };
  return success(res, {
    default_pct: parseFloat(row.default_pct),
    window_months: WINDOW_MONTHS,
    updated_by_admin_id: row.updated_by_admin_id,
    updated_at: row.updated_at,
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const pct = parseFloat(req.body?.default_pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new AppError('VALIDATION_ERROR', 'default_pct must be a number between 0 and 100', 422, 'default_pct');
  }
  const rounded = parseFloat(pct.toFixed(2));
  const { rows } = await db.query(
    `INSERT INTO referral_settings (id, default_pct, updated_by_admin_id, updated_at)
     VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE
       SET default_pct = EXCLUDED.default_pct,
           updated_by_admin_id = EXCLUDED.updated_by_admin_id,
           updated_at = now()
     RETURNING default_pct, updated_by_admin_id, updated_at`,
    [rounded, req.user?.sub || null]
  );
  return success(res, {
    default_pct: parseFloat(rows[0].default_pct),
    window_months: WINDOW_MONTHS,
    updated_by_admin_id: rows[0].updated_by_admin_id,
    updated_at: rows[0].updated_at,
  });
});

// ── Edges (relationships) ─────────────────────────────────────────────────

const EDGE_NAME_SELECT = `
  e.*,
  CASE WHEN e.referrer_type = 'influencer' THEN ri.instagram_handle END AS referrer_name,
  CASE WHEN e.referred_type = 'influencer' THEN di.instagram_handle
       WHEN e.referred_type = 'brand'      THEN db.business_name END AS referred_name
  FROM referral_edges e
  LEFT JOIN influencers ri ON e.referrer_type = 'influencer' AND ri.id = e.referrer_id
  LEFT JOIN influencers di ON e.referred_type = 'influencer' AND di.id = e.referred_id
  LEFT JOIN brands      db ON e.referred_type = 'brand'      AND db.id = e.referred_id
`;

function shapeEdge(r) {
  return {
    id: r.id,
    referrer_type: r.referrer_type,
    referrer_id: r.referrer_id,
    referrer_name: labelFor(r.referrer_type, r.referrer_id, r.referrer_name),
    referred_type: r.referred_type,
    referred_id: r.referred_id,
    referred_name: labelFor(r.referred_type, r.referred_id, r.referred_name),
    pct: parseFloat(r.pct),
    kind: r.kind,
    status: r.status,
    source: r.source,
    started_at: r.started_at,
    expires_at: r.expires_at,
    ended_at: r.ended_at,
    created_at: r.created_at,
  };
}

const listEdges = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePaging(req.query);
  const where = [];
  const params = [];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('$$', `$${params.length}`)); };

  if (req.query.status)        add('e.status = $$', req.query.status);
  if (req.query.referrer_type) add('e.referrer_type = $$', req.query.referrer_type);
  if (req.query.referred_type) add('e.referred_type = $$', req.query.referred_type);
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    const p = `$${params.length}`;
    where.push(`(ri.instagram_handle ILIKE ${p} OR di.instagram_handle ILIKE ${p} OR db.business_name ILIKE ${p})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM referral_edges e
       LEFT JOIN influencers ri ON e.referrer_type='influencer' AND ri.id=e.referrer_id
       LEFT JOIN influencers di ON e.referred_type='influencer' AND di.id=e.referred_id
       LEFT JOIN brands db ON e.referred_type='brand' AND db.id=e.referred_id
     ${whereSql}`,
    params
  );
  const total = countRows[0].total;

  const { rows } = await db.query(
    `SELECT ${EDGE_NAME_SELECT} ${whereSql}
     ORDER BY e.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  return success(res, rows.map(shapeEdge), 200, { page, limit, total });
});

const createEdge = asyncHandler(async (req, res) => {
  const { referrer_type, referrer_id, referred_type, referred_id } = req.body || {};
  let pct = req.body?.pct;

  // Default the pct to the global setting when omitted/blank.
  if (pct === undefined || pct === null || pct === '') {
    const { rows } = await db.query(`SELECT default_pct FROM referral_settings WHERE id = 1`);
    pct = rows[0] ? parseFloat(rows[0].default_pct) : 25.00;
  }

  try {
    const edge = await referralService.createEdge({
      referrerType: referrer_type,
      referrerId: referrer_id,
      referredType: referred_type,
      referredId: referred_id,
      pct,
      source: 'admin',
      createdByAdminId: req.user?.sub || null,
    });
    return success(res, shapeEdge({ ...edge, referrer_name: null, referred_name: null }), 201);
  } catch (err) {
    // Partial unique index (uniq_referral_active_referred) / any unique clash →
    // a friendly 409 instead of a 500.
    if (err && err.code === '23505') {
      throw new AppError('VALIDATION_ERROR', 'That entity already has an active referrer (one active referrer per referred entity).', 409);
    }
    throw err; // AppError (self/circular/validation) passes through to the handler
  }
});

const updateEdge = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sets = [];
  const params = [];
  const add = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if (req.body?.pct !== undefined) {
    const pct = parseFloat(req.body.pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new AppError('VALIDATION_ERROR', 'pct must be a number between 0 and 100', 422, 'pct');
    }
    add('pct', parseFloat(pct.toFixed(2)));
  }
  if (req.body?.status !== undefined) {
    const status = req.body.status;
    if (!['active', 'ended', 'expired'].includes(status)) {
      throw new AppError('VALIDATION_ERROR', "status must be one of active|ended|expired", 422, 'status');
    }
    add('status', status);
    if (status !== 'active') add('ended_at', new Date().toISOString());
    else add('ended_at', null);
  }
  if (sets.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Nothing to update — supply pct and/or status', 422);
  }
  sets.push(`updated_at = now()`);
  params.push(id);

  const { rows } = await db.query(
    `UPDATE referral_edges SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Referral edge not found', 404);
  return success(res, shapeEdge({ ...rows[0], referrer_name: null, referred_name: null }));
});

// ── Ledger (earnings audit) ────────────────────────────────────────────────

const listLedger = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePaging(req.query);
  const where = [];
  const params = [];
  const add = (col, val) => { params.push(val); where.push(`${col} = $${params.length}`); };

  if (req.query.referrer_type) add('l.referrer_type', req.query.referrer_type);
  if (req.query.source)        add('l.source', req.query.source);
  if (req.query.payout_status) add('l.payout_status', req.query.payout_status);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM referral_ledger l ${whereSql}`, params
  );
  const total = countRows[0].total;

  const { rows } = await db.query(
    `SELECT l.*, e.referred_type, e.referred_id,
       CASE WHEN l.referrer_type = 'influencer' THEN ri.instagram_handle END AS referrer_name,
       CASE WHEN e.referred_type = 'influencer' THEN di.instagram_handle
            WHEN e.referred_type = 'brand'      THEN db.business_name END AS referred_name
       FROM referral_ledger l
       JOIN referral_edges e ON e.id = l.edge_id
       LEFT JOIN influencers ri ON l.referrer_type = 'influencer' AND ri.id = l.referrer_id
       LEFT JOIN influencers di ON e.referred_type = 'influencer' AND di.id = e.referred_id
       LEFT JOIN brands      db ON e.referred_type = 'brand'      AND db.id = e.referred_id
       ${whereSql}
     ORDER BY l.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const data = rows.map(r => ({
    id: r.id,
    created_at: r.created_at,
    referrer_type: r.referrer_type,
    referrer_id: r.referrer_id,
    referrer_name: labelFor(r.referrer_type, r.referrer_id, r.referrer_name),
    referred_type: r.referred_type,
    referred_id: r.referred_id,
    referred_name: labelFor(r.referred_type, r.referred_id, r.referred_name),
    source: r.source,
    base_amount: parseFloat(r.base_amount),
    pct: parseFloat(r.pct),
    amount: parseFloat(r.amount),
    payout_status: r.payout_status,
    paid_at: r.paid_at,
  }));
  return success(res, data, 200, { page, limit, total });
});

const getSummary = asyncHandler(async (req, res) => {
  const { rows: t } = await db.query(
    `SELECT
       COALESCE(SUM(amount), 0)                                          AS earned,
       COALESCE(SUM(amount) FILTER (WHERE payout_status = 'paid'), 0)    AS paid,
       COALESCE(SUM(amount) FILTER (WHERE payout_status = 'pending'), 0) AS pending,
       COUNT(*)::int                                                     AS rows
     FROM referral_ledger`
  );
  const { rows: byRef } = await db.query(
    `SELECT l.referrer_type, l.referrer_id,
            COUNT(*)::int AS rows,
            COALESCE(SUM(l.amount), 0) AS earned,
            COALESCE(SUM(l.amount) FILTER (WHERE l.payout_status = 'paid'), 0) AS paid,
            COALESCE(SUM(l.amount) FILTER (WHERE l.payout_status = 'pending'), 0) AS pending,
            MAX(ri.instagram_handle) AS referrer_name
       FROM referral_ledger l
       LEFT JOIN influencers ri ON l.referrer_type = 'influencer' AND ri.id = l.referrer_id
      GROUP BY l.referrer_type, l.referrer_id
      ORDER BY earned DESC
      LIMIT 100`
  );
  return success(res, {
    totals: {
      earned: parseFloat(t[0].earned),
      paid: parseFloat(t[0].paid),
      pending: parseFloat(t[0].pending),
      rows: t[0].rows,
    },
    by_referrer: byRef.map(r => ({
      referrer_type: r.referrer_type,
      referrer_id: r.referrer_id,
      referrer_name: labelFor(r.referrer_type, r.referrer_id, r.referrer_name),
      rows: r.rows,
      earned: parseFloat(r.earned),
      paid: parseFloat(r.paid),
      pending: parseFloat(r.pending),
    })),
  });
});

// ── Applications (apply-to-become-referrer intake) ──────────────────────────

// GET /admin/referrals/applications?status=&page=&limit=
// D-2 intake — list apply-to-become-referrer requests with applicant info.
const listApplications = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePaging(req.query);
  const where = [];
  const params = [];
  if (req.query.status) {
    params.push(req.query.status);
    where.push(`a.status = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM referral_applications a ${whereSql}`, params
  );
  const total = countRows[0].total;

  const { rows } = await db.query(
    `SELECT a.*,
            CASE WHEN a.applicant_type = 'influencer' THEN i.instagram_handle END AS applicant_name
       FROM referral_applications a
       LEFT JOIN influencers i ON a.applicant_type = 'influencer' AND i.id = a.applicant_id
       ${whereSql}
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const data = rows.map(r => ({
    id: r.id,
    applicant_type: r.applicant_type,
    applicant_id: r.applicant_id,
    applicant_name: labelFor(r.applicant_type, r.applicant_id, r.applicant_name),
    status: r.status,
    note: r.note,
    allocated_code: r.allocated_code,
    created_at: r.created_at,
    decided_at: r.decided_at,
    decided_by: r.decided_by,
  }));
  return success(res, data, 200, { page, limit, total });
});

// POST /admin/referrals/applications/:id/decision  { action: approve|reject, note }
// On APPROVE — allocate the applicant's code via referralService.getOrCreateCode,
// stamp allocated_code + status. On REJECT — status rejected. superadmin only.
const decideApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const action = (req.body?.action || '').trim();
  const note = (req.body?.note || '').trim() || null;
  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('VALIDATION_ERROR', "action must be 'approve' or 'reject'", 422, 'action');
  }

  const { rows: appRows } = await db.query(
    `SELECT * FROM referral_applications WHERE id = $1`, [id]
  );
  const app = appRows[0];
  if (!app) throw new AppError('NOT_FOUND', 'Application not found', 404);
  if (app.status !== 'requested') {
    throw new AppError('VALIDATION_ERROR', `Application already ${app.status}.`, 409);
  }

  let allocatedCode = null;
  if (action === 'approve') {
    // Reuse the engine's code generator — one code per (referrer_type, referrer_id).
    const codeRow = await referralService.getOrCreateCode(app.applicant_type, app.applicant_id);
    allocatedCode = codeRow.code;
  }

  const { rows } = await db.query(
    `UPDATE referral_applications
        SET status = $1,
            allocated_code = COALESCE($2, allocated_code),
            note = COALESCE($3, note),
            decided_at = now(),
            decided_by = $4
      WHERE id = $5
      RETURNING *`,
    [action === 'approve' ? 'approved' : 'rejected', allocatedCode, note, req.user?.sub || null, id]
  );

  return success(res, {
    id: rows[0].id,
    status: rows[0].status,
    allocated_code: rows[0].allocated_code,
    decided_at: rows[0].decided_at,
    decided_by: rows[0].decided_by,
  });
});

// ── D-3 — admin generate/allocate a referral code directly ──────────────────

// POST /admin/referrals/codes  { referrer_type, referrer_id }
// Ensures/returns a code for the given influencer/agency. superadmin only.
const generateCode = asyncHandler(async (req, res) => {
  const referrerType = (req.body?.referrer_type || '').trim();
  const referrerId = (req.body?.referrer_id || '').trim();
  if (!['influencer', 'agency'].includes(referrerType)) {
    throw new AppError('VALIDATION_ERROR', "referrer_type must be 'influencer' or 'agency'", 422, 'referrer_type');
  }
  if (!referrerId) {
    throw new AppError('VALIDATION_ERROR', 'referrer_id is required', 422, 'referrer_id');
  }
  const codeRow = await referralService.getOrCreateCode(referrerType, referrerId);
  return success(res, {
    code: codeRow.code,
    referrer_type: codeRow.referrer_type,
    referrer_id: codeRow.referrer_id,
    created_at: codeRow.created_at,
  }, 201);
});

module.exports = {
  getSettings,
  updateSettings,
  listEdges,
  createEdge,
  updateEdge,
  listLedger,
  getSummary,
  listApplications,
  decideApplication,
  generateCode,
};
