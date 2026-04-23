'use strict';

/**
 * media.service.js
 * Helpers for the Brand Media Gallery — R2 key generation + file-type
 * validation. Thin wrapper around storage.service for the gallery flow.
 */

const crypto = require('crypto');
const storageService = require('./storage.service');

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB per file

// Whitelist of accepted MIMEs. Kept broad enough for typical brand-kit
// assets: logos, creatives, reference videos, packaged brand-kit archives.
const ALLOWED_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/zip', 'application/x-zip-compressed',
]);

const ALLOWED_TAGS = new Set(['logo', 'brand_kit', 'product_shot', 'video', 'document', 'other']);

function assertFileMeta({ file_name, file_type, file_size_bytes }) {
  if (!file_name || typeof file_name !== 'string') {
    throw new Error('file_name is required');
  }
  if (!file_type || !ALLOWED_MIMES.has(file_type)) {
    throw new Error(`Unsupported file type: ${file_type}`);
  }
  const size = Number(file_size_bytes);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('file_size_bytes must be a positive number');
  }
  if (size > MAX_BYTES) {
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
