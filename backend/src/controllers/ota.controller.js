'use strict';

/**
 * ota.controller.js
 *
 * Runs the JS-bundle OTA delivery pipeline for the installed mobile apps.
 *
 *   Publish flow (from the developer's laptop):
 *     1. `pnpm publish-ota:<flavor>` bundles the current JS with
 *        `react-native bundle`, computes a SHA-256 hash.
 *     2. POSTs bundle + metadata to /v1/ota/publish with the
 *        X-OTA-Token header.
 *     3. Backend uploads bundle to R2 under ota/<flavor>/bundle-<N>.js
 *        and overwrites the manifest at ota/<flavor>/manifest.json.
 *
 *   Consume flow (from the phone, every app launch):
 *     1. GET /v1/ota/manifest?flavor=<flavor>&runtime=<N>
 *     2. Backend returns manifest JSON with a short-lived presigned
 *        download URL for the current bundle.
 *     3. Phone downloads in the background, verifies hash, writes to
 *        cache; MainApplication.kt picks it up on next launch.
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }                                 = require('@aws-sdk/s3-request-presigner');
const crypto      = require('crypto');
const env         = require('../config/env');
const { success } = require('../utils/response');
const AppError    = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const FLAVORS = ['brand', 'influencer', 'follower', 'agency'];

let _r2Client = null;
function r2() {
  if (!_r2Client) {
    _r2Client = new S3Client({
      region:   'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _r2Client;
}

function manifestKey(flavor) { return `ota/${flavor}/manifest.json`; }
function bundleKey(flavor, version) { return `ota/${flavor}/bundle-${version}.js`; }

async function readManifestFromR2(flavor) {
  try {
    const res = await r2().send(new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key:    manifestKey(flavor),
    }));
    const text = await res.Body.transformToString();
    return JSON.parse(text);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null; // no bundle ever published for this flavor
    }
    throw err;
  }
}

async function writeManifestToR2(flavor, manifest) {
  await r2().send(new PutObjectCommand({
    Bucket:      env.R2_BUCKET,
    Key:         manifestKey(flavor),
    Body:        JSON.stringify(manifest, null, 2),
    ContentType: 'application/json',
    CacheControl: 'no-cache, must-revalidate',
  }));
}

async function signedBundleUrl(key) {
  const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
  return getSignedUrl(r2(), command, { expiresIn: 60 * 60 }); // 1 hour
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/ota/manifest?flavor=<flavor>&runtime=<N>
// Public — phones call this on every launch. Returns 200 + manifest when a
// compatible bundle exists, 204 No Content otherwise (treated as "no update").
// ─────────────────────────────────────────────────────────────────────────────
const getManifest = asyncHandler(async (req, res) => {
  const flavor  = String(req.query.flavor || '').toLowerCase();
  const runtime = String(req.query.runtime || '');

  if (!FLAVORS.includes(flavor)) {
    throw new AppError('VALIDATION_ERROR', `flavor must be one of: ${FLAVORS.join(', ')}`, 422, 'flavor');
  }
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID) {
    // R2 not configured → no OTA available. Treat as "no update".
    return res.status(204).end();
  }

  const manifest = await readManifestFromR2(flavor);
  if (!manifest) return res.status(204).end();

  // Gate on native runtime version — phones refuse to load bundles that
  // target a native runtime different from the one baked into their APK.
  if (runtime && manifest.native_runtime && String(manifest.native_runtime) !== runtime) {
    return res.status(204).end();
  }

  // Re-sign the download URL so the phone gets a fresh, short-lived link.
  const bundle_url = await signedBundleUrl(manifest.bundle_key);

  return success(res, {
    manifest: {
      flavor:          manifest.flavor,
      version:         manifest.version,
      native_runtime:  manifest.native_runtime,
      bundle_url,
      bundle_hash:     manifest.bundle_hash,
      published_at:    manifest.published_at,
      message:         manifest.message || '',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/ota/publish
// Body: { flavor, native_runtime, bundle_b64, message? }
// Header: X-OTA-Token: <OTA_PUBLISH_TOKEN>
//
// Called by the local publish-ota.js script. Uploads the supplied bundle
// to R2 under a new monotonically-increasing version number and rewrites
// the manifest.
// ─────────────────────────────────────────────────────────────────────────────
const publish = asyncHandler(async (req, res) => {
  const token = req.get('x-ota-token') || '';
  if (!env.OTA_PUBLISH_TOKEN || token !== env.OTA_PUBLISH_TOKEN) {
    throw new AppError('UNAUTHORIZED', 'Invalid or missing X-OTA-Token', 401);
  }

  const { flavor, native_runtime, bundle_b64, message } = req.body || {};
  if (!FLAVORS.includes(flavor)) {
    throw new AppError('VALIDATION_ERROR', `flavor must be one of: ${FLAVORS.join(', ')}`, 422, 'flavor');
  }
  if (!native_runtime) {
    throw new AppError('VALIDATION_ERROR', 'native_runtime is required', 422, 'native_runtime');
  }
  if (!bundle_b64 || typeof bundle_b64 !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'bundle_b64 is required (base64-encoded JS bundle)', 422, 'bundle_b64');
  }

  const buffer = Buffer.from(bundle_b64, 'base64');
  if (buffer.length < 1024) {
    throw new AppError('VALIDATION_ERROR', `Bundle suspiciously small (${buffer.length} bytes)`, 422, 'bundle_b64');
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Next version = (current manifest.version || 0) + 1
  const existing = await readManifestFromR2(flavor);
  const version  = (existing?.version || 0) + 1;

  const key = bundleKey(flavor, version);
  await r2().send(new PutObjectCommand({
    Bucket:      env.R2_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: 'application/javascript',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  const manifest = {
    flavor,
    version,
    native_runtime: String(native_runtime),
    bundle_key:     key,
    bundle_hash:    `sha256:${hash}`,
    bundle_size:    buffer.length,
    published_at:   new Date().toISOString(),
    message:        message || '',
  };
  await writeManifestToR2(flavor, manifest);

  return success(res, {
    flavor,
    version,
    bundle_key: key,
    bundle_size: buffer.length,
    bundle_hash: manifest.bundle_hash,
    message: manifest.message,
  }, 201);
});

module.exports = { getManifest, publish };
