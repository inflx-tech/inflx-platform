'use strict';

/**
 * referenceLink.controller.js — Brand Gallery "Reference Links" CRUD.
 *
 * Brands keep URLs (YouTube videos, Google Drive folders, Figma files,
 * Notion pages, etc.) alongside uploaded assets. Only the URL is stored
 * — no file, no storage cost. Typical use case: sharing reference
 * footage with influencers without uploading the actual video to R2.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function resolveBrandId(userId) {
  const { rows } = await db.query('SELECT id FROM brands WHERE user_id = $1', [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0].id;
}

function assertUrl(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    throw new AppError('VALIDATION_ERROR', 'url is required', 422, 'url');
  }
  const url = raw.trim();
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      throw new Error('bad protocol');
    }
  } catch {
    throw new AppError('VALIDATION_ERROR', 'url must be a valid http/https URL', 422, 'url');
  }
  return url;
}

// GET /v1/brands/me/reference-links
const listLinks = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const { rows } = await db.query(
    `SELECT * FROM brand_reference_links WHERE brand_id = $1 ORDER BY created_at DESC`,
    [brandId]
  );
  return success(res, { links: rows });
});

// POST /v1/brands/me/reference-links
// Body: { url, title, description? }
const createLink = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const url = assertUrl(req.body?.url);
  const title = String(req.body?.title || '').trim();
  if (!title) throw new AppError('VALIDATION_ERROR', 'title is required', 422, 'title');
  const description = req.body?.description ? String(req.body.description) : null;

  const { rows } = await db.query(
    `INSERT INTO brand_reference_links (brand_id, url, title, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [brandId, url, title, description]
  );
  return success(res, { link: rows[0] }, 201);
});

// PATCH /v1/brands/me/reference-links/:id
// Body: { url?, title?, description? }
const updateLink = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const fields = [];
  const params = [];

  if (req.body?.url !== undefined) {
    params.push(assertUrl(req.body.url));
    fields.push(`url = $${params.length}`);
  }
  if (typeof req.body?.title === 'string' && req.body.title.trim()) {
    params.push(req.body.title.trim());
    fields.push(`title = $${params.length}`);
  }
  if (req.body?.description !== undefined) {
    params.push(req.body.description || null);
    fields.push(`description = $${params.length}`);
  }
  if (!fields.length) {
    throw new AppError('VALIDATION_ERROR', 'No fields to update', 422);
  }
  params.push(req.params.id, brandId);

  const { rows } = await db.query(
    `UPDATE brand_reference_links
        SET ${fields.join(', ')}
      WHERE id = $${params.length - 1} AND brand_id = $${params.length}
      RETURNING *`,
    params
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Reference link not found', 404);
  return success(res, { link: rows[0] });
});

// DELETE /v1/brands/me/reference-links/:id
const deleteLink = asyncHandler(async (req, res) => {
  const brandId = await resolveBrandId(req.user.sub);
  const { rowCount } = await db.query(
    `DELETE FROM brand_reference_links WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brandId]
  );
  if (!rowCount) throw new AppError('NOT_FOUND', 'Reference link not found', 404);
  return res.status(204).end();
});

module.exports = { listLinks, createLink, updateLink, deleteLink };
