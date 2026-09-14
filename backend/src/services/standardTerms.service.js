'use strict';

/**
 * Item 7 — INFLX's own terms, versioned.
 * Rules v1.20 §9: "INFLX's standard terms form part of every Agreement. Their
 * version is stamped on the Agreement, so updating the standard terms never
 * changes an Agreement already signed."
 * Contract: features/item7-agreement · gap report §9
 *
 * One row per version, exactly one current (enforced by a partial unique
 * index). An agreement stores the version string; this service serves that
 * exact body forever. Cached for 60 seconds like the platform settings.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000;

/** The version every new agreement is stamped with. */
async function current({ fresh = false } = {}) {
  if (!fresh && _cache && Date.now() - _cacheTime < CACHE_TTL_MS) return _cache;
  const { rows } = await db.query(
    `SELECT version, body_md, effective_at FROM standard_terms WHERE is_current LIMIT 1`
  );
  if (!rows[0]) {
    // The migration seeds 1.0, so this only happens on a database that has not
    // been migrated. Fail loudly rather than stamping an agreement with nothing.
    throw new AppError('INTERNAL_ERROR', 'No current standard terms are published.', 500);
  }
  _cache = { version: rows[0].version, body: rows[0].body_md, effectiveAt: rows[0].effective_at };
  _cacheTime = Date.now();
  return _cache;
}

/** A specific version, for an agreement signed under an older one. */
async function byVersion(version) {
  const { rows } = await db.query(
    `SELECT version, body_md, effective_at, is_current FROM standard_terms WHERE version = $1`,
    [String(version || '')]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Those terms were not found.', 404, 'version');
  return { version: rows[0].version, body: rows[0].body_md, effectiveAt: rows[0].effective_at, isCurrent: rows[0].is_current };
}

/** Every version, newest first — the admin page's history. */
async function list() {
  const { rows } = await db.query(
    `SELECT s.version, s.effective_at, s.is_current, s.created_at, u.name AS created_by_name,
            length(s.body_md) AS body_length
       FROM standard_terms s LEFT JOIN users u ON u.id = s.created_by
      ORDER BY s.effective_at DESC, s.created_at DESC`
  );
  return rows.map(r => ({
    version: r.version, effectiveAt: r.effective_at, isCurrent: r.is_current,
    createdAt: r.created_at, createdBy: r.created_by_name || null, bodyLength: Number(r.body_length),
  }));
}

/**
 * Publish a new version. The old one is never edited and never deleted — an
 * agreement signed under it must still be servable years later.
 */
async function publish({ version, body }, adminUserId) {
  const v = String(version || '').trim();
  const b = String(body || '').trim();
  if (!v) throw new AppError('VALIDATION_ERROR', 'Give the new version a number.', 422, 'version');
  if (v.length > 20) throw new AppError('VALIDATION_ERROR', 'Keep the version under 20 characters.', 422, 'version');
  if (!b) throw new AppError('VALIDATION_ERROR', 'The terms cannot be empty.', 422, 'body');

  const existing = await db.query(`SELECT 1 FROM standard_terms WHERE version = $1`, [v]);
  if (existing.rows[0]) {
    throw new AppError('VALIDATION_ERROR', `Version ${v} already exists. Give this one a new number.`, 422, 'version');
  }

  const out = await db.withTransaction(async (tx) => {
    await tx.query(`UPDATE standard_terms SET is_current = false WHERE is_current`);
    const { rows } = await tx.query(
      `INSERT INTO standard_terms (version, body_md, is_current, created_by)
       VALUES ($1, $2, true, $3) RETURNING version, effective_at`,
      [v, b, adminUserId || null]
    );
    return rows[0];
  });
  _cache = null;
  return { version: out.version, effectiveAt: out.effective_at };
}

/** Tests only. */
function _resetCache() { _cache = null; _cacheTime = 0; }

module.exports = { current, byVersion, list, publish, _resetCache };
