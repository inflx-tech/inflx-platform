'use strict';

/**
 * mediaAsset.controller.js — Brand Media Gallery CRUD.
 *
 * The gallery backs two surfaces:
 *   1. Standalone gallery UI (brand mobile + brand web) — browse/manage.
 *   2. Campaign-creation upload pickers — brand picks an existing asset
 *      to attach to a campaign, or uploads a new one (which lands here
 *      first, then is referenced by the campaign).
 *
 * Contract PDFs are NOT stored as media assets. The gallery reads them
 * directly from the contracts table via listBrandContracts /
 * listInfluencerContracts below.
 */

const db = require('../config/db');
const mediaService = require('../services/media.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function resolveBrandId(userId) {
  const { rows } = await db.query('SELECT id FROM brands WHERE user_id = $1', [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0].id;
}

async function getBrandQuotaBytes(brandId) {
  const { rows } = await db.query('SELECT storage_quota_bytes FROM brands WHERE id = $1', [brandId]);
  const q = Number(rows[0]?.storage_quota_bytes);
  return Number.isFinite(q) && q > 0 ? q : 500 * 1024 * 1024;
}

async function getUsedBytes(brandId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(file_size_bytes), 0) AS used FROM brand_media_assets WHERE brand_id = $1`,
    [brandId]
  );
  return Number(rows[0]?.used || 0);
}

async function resolveInfluencerId(userId) {
  const { rows } = await db.query('SELECT id FROM influencers WHERE user_id = $1', [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

// POST /v1/brands/me/media-assets/upload-url
// Body: { file_name, file_type, file_size_bytes }
// Returns { url, method, key } — client PUTs the file directly to R2,
// then calls POST /media-assets to persist the metadata row.
//
// Enforces the brand's storage quota. Projected usage (current + this
// file) must not exceed brands.storage_quota_bytes. Returns 413 with
// QUOTA_EXCEEDED when over, so the client can prompt the brand to
// delete unused assets or ask admin for an increase.
const getUploadUrl = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const { file_name, file_type, file_size_bytes } = req.body || {};
  try {
    mediaService.assertFileMeta({ file_name, file_type, file_size_bytes });
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  const quota = await getBrandQuotaBytes(brandId);
  const used  = await getUsedBytes(brandId);
  const incoming = Math.max(0, Number(file_size_bytes) || 0);
  if (used + incoming > quota) {
    const remainingMb = Math.max(0, Math.floor((quota - used) / (1024 * 1024)));
    throw new AppError(
      'QUOTA_EXCEEDED',
      `Storage limit reached. ${remainingMb} MB free out of ${Math.floor(quota / (1024 * 1024))} MB. Delete unused assets or contact support for more space.`,
      413
    );
  }

  const result = await mediaService.generateAssetUploadUrl(brandId, {
    file_name, file_type, file_size_bytes,
  });
  return success(res, result);
});

// GET /v1/brands/me/media-assets/usage
const getUsage = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const quota = await getBrandQuotaBytes(brandId);
  const used  = await getUsedBytes(brandId);
  return success(res, {
    quota_bytes:     quota,
    used_bytes:      used,
    remaining_bytes: Math.max(0, quota - used),
    used_pct:        quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0,
  });
});

// POST /v1/brands/me/media-assets
// Body: { title, description?, file_r2_key, file_name, file_type, file_size_bytes, tags? }
const createAsset = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const {
    title, description, file_r2_key,
    file_name, file_type, file_size_bytes, tags,
  } = req.body || {};

  if (!title || !String(title).trim()) {
    throw new AppError('VALIDATION_ERROR', 'title is required', 422, 'title');
  }
  if (!file_r2_key || typeof file_r2_key !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'file_r2_key is required', 422, 'file_r2_key');
  }
  // Key must belong to this brand — prevents pointing at someone else's file.
  if (!file_r2_key.startsWith(`brands/${brandId}/assets/`)) {
    throw new AppError('VALIDATION_ERROR', 'file_r2_key must be in this brand\'s asset folder', 422, 'file_r2_key');
  }

  try {
    mediaService.assertFileMeta({ file_name, file_type, file_size_bytes });
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  const cleanTags = mediaService.sanitizeTags(tags);
  const sizeNum = Number(file_size_bytes);
  const sizeToStore = Number.isFinite(sizeNum) && sizeNum >= 0 ? sizeNum : 0;

  const { rows } = await db.query(
    `INSERT INTO brand_media_assets
       (brand_id, title, description, file_r2_key,
        file_name, file_type, file_size_bytes, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [brandId, String(title).trim(), description || null, file_r2_key,
     file_name, file_type, sizeToStore, cleanTags]
  );

  const asset = await _enrich(rows[0]);
  return success(res, { asset }, 201);
});

// GET /v1/brands/me/media-assets?tag=logo
const listAssets = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const tag = req.query.tag ? String(req.query.tag).toLowerCase().trim() : null;

  const params = [brandId];
  let where = 'WHERE brand_id = $1';
  if (tag && mediaService.ALLOWED_TAGS.has(tag)) {
    params.push(tag);
    where += ` AND $${params.length} = ANY(tags)`;
  }

  const { rows } = await db.query(
    `SELECT * FROM brand_media_assets
      ${where}
      ORDER BY uploaded_at DESC`,
    params
  );

  const assets = await Promise.all(rows.map(_enrich));
  return success(res, { assets });
});

// GET /v1/brands/me/media-assets/:id/download-url
const getDownloadUrl = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const { rows } = await db.query(
    `SELECT * FROM brand_media_assets WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Asset not found', 404);

  const url = await mediaService.generateAssetDownloadUrl(rows[0].file_r2_key);
  return success(res, { url, expires_in: 3600 });
});

// PATCH /v1/brands/me/media-assets/:id
// Body: { title?, description?, tags? }
const updateAsset = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);

  const fields = [];
  const params = [];
  if (typeof req.body?.title === 'string' && req.body.title.trim()) {
    params.push(req.body.title.trim());
    fields.push(`title = $${params.length}`);
  }
  if (req.body?.description !== undefined) {
    params.push(req.body.description || null);
    fields.push(`description = $${params.length}`);
  }
  if (Array.isArray(req.body?.tags)) {
    params.push(mediaService.sanitizeTags(req.body.tags));
    fields.push(`tags = $${params.length}`);
  }
  if (!fields.length) {
    throw new AppError('VALIDATION_ERROR', 'No fields to update', 422);
  }
  params.push(req.params.id, brandId);

  const { rows } = await db.query(
    `UPDATE brand_media_assets
        SET ${fields.join(', ')}
      WHERE id = $${params.length - 1} AND brand_id = $${params.length}
      RETURNING *`,
    params
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Asset not found', 404);

  const asset = await _enrich(rows[0]);
  return success(res, { asset });
});

// DELETE /v1/brands/me/media-assets/:id
// Best-effort R2 delete — if storage delete fails we still return 204 so
// the row is gone; orphaned R2 objects can be garbage-collected later.
const deleteAsset = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const { rows } = await db.query(
    `DELETE FROM brand_media_assets
      WHERE id = $1 AND brand_id = $2
      RETURNING file_r2_key`,
    [req.params.id, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Asset not found', 404);
  return res.status(204).end();
});

// ─── Aggregate contract lists for the Contracts gallery tab ─────────────────

// GET /v1/brands/me/contracts
const listBrandContracts = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const { rows } = await db.query(
    `SELECT c.id,
            c.status,
            c.influencer_fee,
            c.bonus_amount,
            c.created_at,
            c.brand_signed_at,
            c.influencer_signed_at,
            c.pdf_url,
            c.pdf_generated_at,
            camp.id              AS campaign_id,
            camp.name            AS campaign_name,
            cs.goal              AS campaign_goal,
            inf.id               AS influencer_id,
            inf.instagram_handle AS influencer_handle,
            u.name               AS influencer_name
       FROM contracts c
       JOIN campaign_influencers ci ON ci.id = c.campaign_influencer_id
       JOIN campaign_sets        cs ON cs.id = ci.set_id
       JOIN campaigns          camp ON camp.id = cs.campaign_id
       JOIN influencers         inf ON inf.id = ci.influencer_id
       JOIN users                u  ON u.id  = inf.user_id
      WHERE camp.brand_id = $1
      ORDER BY c.created_at DESC`,
    [brandId]
  );
  return success(res, { contracts: rows });
});

// GET /v1/influencers/me/contracts
const listInfluencerContracts = asyncHandler(async (req, res) => {
  const influencerId = await resolveInfluencerId(req.user.sub);
  const { rows } = await db.query(
    `SELECT c.id,
            c.status,
            c.influencer_fee,
            c.bonus_amount,
            c.created_at,
            c.brand_signed_at,
            c.influencer_signed_at,
            c.pdf_url,
            c.pdf_generated_at,
            camp.id       AS campaign_id,
            camp.name     AS campaign_name,
            cs.goal       AS campaign_goal,
            b.id          AS brand_id,
            b.business_name AS brand_name
       FROM contracts c
       JOIN campaign_influencers ci ON ci.id = c.campaign_influencer_id
       JOIN campaign_sets        cs ON cs.id = ci.set_id
       JOIN campaigns          camp ON camp.id = cs.campaign_id
       JOIN brands               b  ON b.id  = camp.brand_id
      WHERE ci.influencer_id = $1
      ORDER BY c.created_at DESC`,
    [influencerId]
  );
  return success(res, { contracts: rows });
});

// GET /v1/media/assets/:id  (PUBLIC — no auth)
// Re-signs the asset's R2 key on every view and 302-redirects to it. This is
// what makes uploaded images PERMANENT: callers store the stable URL below
// (which never changes), and the real (short-lived) signed R2 URL is minted
// fresh on each request. Public so an <img> in the follower app can load it
// with no token. SAFE: only brand media assets are reachable (keyed by DB id;
// their file_r2_key is always under brands/<id>/assets/ — contracts/KYC are NOT
// media assets and have no row here, so this path can never expose them).
const serveAsset = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT file_r2_key FROM brand_media_assets WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Asset not found', 404);
  const url = await mediaService.generateAssetDownloadUrl(rows[0].file_r2_key);
  return res.redirect(302, url);
});

// GET /v1/media/stock/*  (PUBLIC — no auth)
// Re-signs an admin stock image (master-dish catalogue) and 302-redirects.
// PREFIX-GUARDED: only keys under `stock/` are reachable (no traversal), so this
// can never reach brand assets or contracts/KYC.
const serveStockImage = asyncHandler(async (req, res) => {
  const sub = req.params[0] || '';
  if (!sub || sub.includes('..')) throw new AppError('NOT_FOUND', 'Asset not found', 404);
  const url = await mediaService.generateAssetDownloadUrl(`stock/${sub}`);
  return res.redirect(302, url);
});

// ─── Internals ──────────────────────────────────────────────────────────────

// A STABLE, permanent URL for an asset — points at the public re-sign endpoint
// above. Storing THIS (instead of a 1-hour signed R2 URL) is what stops uploaded
// images (dish photos, brand covers, admin stock images) from breaking after an
// hour. Bug fix 2026-06-07: the gallery previously stored the raw signed URL.
function stableAssetUrl(id) {
  const base = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${base}/v1/media/assets/${id}`;
}

async function _enrich(row) {
  return { ...row, download_url: stableAssetUrl(row.id) };
}

module.exports = {
  getUploadUrl,
  getUsage,
  createAsset,
  listAssets,
  getDownloadUrl,
  serveAsset,
  serveStockImage,
  updateAsset,
  deleteAsset,
  listBrandContracts,
  listInfluencerContracts,
};
