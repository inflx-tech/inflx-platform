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

async function uploadPDF(buffer, filename) {
  if (env.R2_MOCK) {
    return _saveLocally(buffer, filename);
  }
  return _uploadToR2(buffer, filename);
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

// ─── Private helpers ────────────────────────────────────────────────────────

async function _saveLocally(buffer, filename) {
  const dir = path.resolve(env.PDF_STORAGE_PATH || UPLOAD_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`[R2 MOCK] PDF saved locally: ${filePath}`);
  // Return the same key shape as prod so downstream code doesn't have to branch.
  return `contracts/${filename}`;
}

async function _uploadToR2(buffer, filename) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');

  const client = _getR2Client();
  const key = `contracts/${filename}`;

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

module.exports = { uploadPDF, getPdfDownloadUrl, generateUploadUrl, generateDownloadUrl, saveFile, getUploadDir };
