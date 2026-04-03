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

// ─── PDF Upload (existing) ──────────────────────────────────────────────────

async function uploadPDF(buffer, filename) {
  if (env.R2_MOCK) {
    return _saveLocally(buffer, filename);
  }
  return _uploadToR2(buffer, filename);
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
  const dir = path.resolve(env.PDF_STORAGE_PATH);
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

  const client = _getR2Client();
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

module.exports = { uploadPDF, generateUploadUrl, generateDownloadUrl, saveFile, getUploadDir };
