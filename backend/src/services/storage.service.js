'use strict';

/**
 * storage.service.js
 * Handles file storage — Cloudflare R2 in production, local filesystem in mock mode.
 */

const fs   = require('fs');
const path = require('path');
const env  = require('../config/env');

/**
 * Upload a PDF buffer to storage.
 *
 * In mock mode (R2_MOCK=true):
 *   - Saves to PDF_STORAGE_PATH (default: ./tmp/contracts/)
 *   - Returns a local file path as the URL
 *
 * In production:
 *   - Uploads to Cloudflare R2 via @aws-sdk/client-s3
 *   - Returns the public R2 URL
 *
 * @param {Buffer} buffer    — PDF data
 * @param {string} filename  — e.g. 'contract_<uuid>.pdf'
 * @returns {Promise<string>} URL or local path
 */
async function uploadPDF(buffer, filename) {
  if (env.R2_MOCK) {
    return _saveLocally(buffer, filename);
  }
  return _uploadToR2(buffer, filename);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function _saveLocally(buffer, filename) {
  const dir = path.resolve(env.PDF_STORAGE_PATH);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`[R2 MOCK] PDF saved locally: ${filePath}`);

  return `local://${filePath}`;
}

async function _uploadToR2(buffer, filename) {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  const key = `contracts/${filename}`;

  await client.send(new PutObjectCommand({
    Bucket:      env.R2_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: 'application/pdf',
  }));

  const url = `https://${env.R2_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  console.log(`[R2] PDF uploaded: ${url}`);
  return url;
}

module.exports = { uploadPDF };
