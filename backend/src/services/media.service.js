'use strict';

/**
 * media.service.js
 * Helpers for the Brand Media Gallery — R2 key generation + file-type
 * validation. Thin wrapper around storage.service for the gallery flow.
 */

const crypto = require('crypto');
const storageService = require('./storage.service');

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file

// Whitelist of accepted MIMEs. Images + documents only — videos are
// intentionally blocked because R2 storage cost scales with MB and brands
// usually have video assets already hosted on YouTube/Drive. Use a
// Reference Link (URL, zero storage cost) for video references instead.
const ALLOWED_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  'image/svg+xml', 'image/heic', 'image/heif',
  'application/pdf',
  'application/zip', 'application/x-zip-compressed',
  'application/octet-stream',
]);

const ALLOWED_TAGS = new Set(['logo', 'brand_kit', 'product_shot', 'video', 'document', 'other']);

function assertFileMeta({ file_name, file_type, file_size_bytes }) {
  if (!file_name || typeof file_name !== 'string') {
    throw new Error('file_name is required');
  }
  if (!file_type || !ALLOWED_MIMES.has(file_type)) {
    if ((file_type || '').startsWith('video/')) {
      throw new Error('Videos are not accepted. Add a Reference Link to your YouTube / Drive URL instead.');
    }
    throw new Error(`Unsupported file type: ${file_type}`);
  }
  // Size may be 0 or missing on mobile (image picker omits it for some
  // assets) — only reject negative values or ones over the cap.
  const size = Number(file_size_bytes);
  if (Number.isFinite(size) && size > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
  }
}

function sanitizeTags(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    if (ALLOWED_TAGS.has(tag)) out.push(tag);
  }
  return Array.from(new Set(out));
}

function buildAssetKey(brandId, originalFilename) {
  const safe = String(originalFilename || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  const uid = crypto.randomBytes(8).toString('hex');
  return `brands/${brandId}/assets/${Date.now()}_${uid}_${safe}`;
}

async function generateAssetUploadUrl(brandId, { file_name, file_type, file_size_bytes }) {
  assertFileMeta({ file_name, file_type, file_size_bytes });
  const key = buildAssetKey(brandId, file_name);
  const { url, method } = await storageService.generateUploadUrl(key, file_type);
  return { url, method, key };
}

async function generateAssetDownloadUrl(key) {
  return storageService.generateDownloadUrl(key);
}

module.exports = {
  MAX_BYTES,
  ALLOWED_MIMES,
  ALLOWED_TAGS,
  assertFileMeta,
  sanitizeTags,
  buildAssetKey,
  generateAssetUploadUrl,
  generateAssetDownloadUrl,
};
