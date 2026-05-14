'use strict';

/**
 * Avatar URL resolver.
 *
 * Rows fetched from creator_profiles / brand_profiles / v_searchable_creators
 * carry two avatar fields:
 *   - profile_pic_url    — original Instagram CDN URL (decays in 1-2 weeks)
 *   - profile_pic_r2_key — our R2 object key when imageProxy has cached it
 *
 * API consumers expect a single working URL. This helper rewrites
 * `profile_pic_url` (in-place) to the presigned R2 URL whenever a key is
 * present, falling back to the IG URL otherwise.
 *
 * Usage:
 *   const rows = await db.query(...);
 *   await resolveAvatars(rows.rows);
 *   return success(res, { items: rows.rows });
 *
 * Runs all rows in parallel via Promise.all — presigning is a few-ms
 * cryptographic op so 20-100 rows is fine. Cap upstream if rows can blow up.
 */

const storageService = require('../services/storage.service');

async function resolveAvatars(rows, opts = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const urlField = opts.urlField || 'profile_pic_url';
  const keyField = opts.keyField || 'profile_pic_r2_key';

  await Promise.all(rows.map(async (r) => {
    if (!r || !r[keyField]) return;
    const url = await storageService.getAvatarUrl(r[keyField]);
    if (url) r[urlField] = url;
  }));
  return rows;
}

module.exports = { resolveAvatars };
