'use strict';

/**
 * storage.service.js
 * Handles file storage — Cloudflare R2 in production, local filesystem in mock mode.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const env  = require('../config/env');

const UPLOAD_DIR = path.join(os.tmpdir(), 'inflx-uploads');

// ─── PDF Upload ─────────────────────────────────────────────────────────────
// Uploads a contract PDF to R2 (prod) or local disk (mock). Returns the
// OBJECT KEY (e.g. "contracts/contract_xxxx.pdf"), NOT a URL. Callers must
// call getPdfDownloadUrl(key) when they need a client-shareable link — that
// produces a short-lived presigned GET URL, which any HTTP client (browser,
// Android download manager, Google Docs Viewer) can fetch without special
// auth headers. Presigned URLs are the fix for the "0 KB download" problem:
// Android WebView was dropping the Bearer header when forwarding the PDF to
// its native download manager, so the retry always hit 401.

async function uploadPDF(buffer, filename, { keyPrefix = 'contracts' } = {}) {
  if (env.R2_MOCK) {
    return _saveLocally(buffer, filename, keyPrefix);
  }
  return _uploadToR2(buffer, filename, keyPrefix);
}

/**
 * Generate a short-lived presigned GET URL for an uploaded PDF key.
 * Returns null in mock mode — callers should fall back to the streaming
 * /contracts/:id/pdf endpoint in that case.
 */
async function getPdfDownloadUrl(key, { expiresIn = 3600 } = {}) {
  if (env.R2_MOCK) return null;
  if (!key) return null;
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const client = _getR2Client();
  const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
  return await getSignedUrl(client, command, { expiresIn });
}

// ─── Media Upload/Download URLs ─────────────────────────────────────────────

/**
 * Generate an upload URL for the client.
 * Mock: returns our own backend mock endpoint
 * Prod: returns R2 presigned PUT URL
 */
async function generateUploadUrl(key, contentType) {
  if (env.R2_MOCK) {
    // In mock mode, client POSTs multipart to our backend
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT}`;
    return {
      url: `${baseUrl}/v1/uploads/mock`,
      key,
      method: 'POST',  // multipart POST for mock
    };
  }

  // Production: R2 presigned PUT URL
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const client = _getR2Client();
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn: 900 }); // 15 min
  return { url, key, method: 'PUT' };
}

/**
 * Generate a download URL for a stored file.
 * Mock: returns local static file URL
 * Prod: returns R2 presigned GET URL
 */
async function generateDownloadUrl(key) {
  if (env.R2_MOCK) {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT}`;
    return `${baseUrl}/uploads/${key}`;
  }

  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const client = _getR2Client();
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Save an uploaded file to local filesystem (mock mode only).
 */
async function saveFile(key, buffer, contentType) {
  const filePath = path.join(UPLOAD_DIR, key);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`[R2 MOCK] File saved: ${filePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB, ${contentType})`);
  return filePath;
}

/**
 * Get the local upload directory (for express.static serving).
 */
function getUploadDir() {
  return UPLOAD_DIR;
}

/**
 * Store a raw buffer at an explicit key (R2 in prod, local disk in mock).
 * Used by server-side image ingest (contract: listing-image-urls) so a fetched
 * URL lands in the same place a client upload would. Returns the key.
 */
async function putBuffer(key, buffer, contentType = 'application/octet-stream') {
  if (env.R2_MOCK) {
    await saveFile(key, buffer, contentType);
    return key;
  }
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = _getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET, Key: key, Body: buffer, ContentType: contentType,
    CacheControl: 'public, max-age=86400',
  }));
  return key;
}

// ─── Private helpers ────────────────────────────────────────────────────────

async function _saveLocally(buffer, filename, keyPrefix = 'contracts') {
  const dir = path.resolve(env.PDF_STORAGE_PATH || UPLOAD_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`[R2 MOCK] PDF saved locally: ${filePath}`);
  // Return the same key shape as prod so downstream code doesn't have to branch.
  return `${keyPrefix}/${filename}`;
}

async function _uploadToR2(buffer, filename, keyPrefix = 'contracts') {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');

  const client = _getR2Client();
  const key = `${keyPrefix}/${filename}`;

  await client.send(new PutObjectCommand({
    Bucket:      env.R2_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: 'application/pdf',
  }));

  console.log(`[R2] PDF uploaded: key=${key} bucket=${env.R2_BUCKET} size=${buffer.length}B`);
  return key;   // callers convert to a presigned URL via getPdfDownloadUrl(key)
}

let _r2Client = null;
function _getR2Client() {
  if (!_r2Client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    _r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _r2Client;
}

// ─── Avatar URL resolver ────────────────────────────────────────────────────
// Profile pictures cached by the imageProxy service live at R2 keys like
// `creator-avatars/<handle>.jpg`. The DB stores the key, not the URL. This
// helper turns the key into a working browser-loadable URL.
//
//   Mock mode → /uploads/avatars/<handle>.jpg (served by express.static from
//               the saveFile UPLOAD_DIR — see app.js).
//   Prod      → presigned R2 GET URL valid for 6h. Plenty for a session; the
//               next page load gets a fresh one. If R2 bucket is later
//               promoted to public-read with a custom domain, swap this for
//               a static URL builder and we never need to presign again.
async function getAvatarUrl(key, { expiresIn = 21600 } = {}) {
  if (!key) return null;
  if (env.R2_MOCK) {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT}`;
    return `${baseUrl}/uploads/${key}`;
  }
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const client = _getR2Client();
    const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
    return await getSignedUrl(client, command, { expiresIn });
  } catch (e) {
    console.error('[storage] avatar URL presign failed:', e.message);
    return null;
  }
}

/**
 * Item 3 — what was actually stored under a key: { size, contentType } or null when absent.
 * The presigned PUT cannot cap a file, so the server checks the object AFTER the upload,
 * when the key is saved (brand logo, creator photo: JPG/PNG <= 5 MB).
 */
async function headObject(key) {
  if (!key) return null;
  if (env.R2_MOCK) {
    try {
      const fs = require('fs');
      const path = require('path');
      const st = fs.statSync(path.join(getUploadDir(), key));
      const ext = String(key).split('.').pop().toLowerCase();
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return { size: st.size, contentType: type };
    } catch { return null; }
  }
  try {
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    const out = await _getR2Client().send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    return { size: Number(out.ContentLength || 0), contentType: out.ContentType || null };
  } catch (e) {
    return null;
  }
}

async function deleteObject(key) {
  if (!key) return;
  if (env.R2_MOCK) {
    try { require('fs').unlinkSync(require('path').join(getUploadDir(), key)); } catch { /* absent is fine */ }
    return;
  }
  try {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await _getR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  } catch (e) {
    console.warn('[storage] delete failed:', e.message);
  }
}

module.exports = { uploadPDF, getPdfDownloadUrl, generateUploadUrl, generateDownloadUrl, saveFile, putBuffer, getUploadDir, getAvatarUrl, headObject, deleteObject };
