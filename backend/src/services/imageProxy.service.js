'use strict';

/**
 * Image Proxy Service
 *
 * Caches third-party images (today: Instagram CDN profile pictures) to our
 * own R2 bucket so we can serve stable URLs that don't expire.
 *
 * Why this exists:
 *   Instagram CDN URLs like `scontent-iad3-1.cdninstagram.com/?oe=<ts>` are
 *   time-signed and 403 silently within 1-2 weeks of the scrape. Rendering
 *   them in <img> tags works for a window, then breaks invisibly. Storing
 *   the URL in our DB doesn't help — the URL itself decays.
 *
 *   So when INGEST receives a profile_pic_url from n8n, we download the
 *   bytes (with the right referrer header to satisfy IG's check), upload
 *   them to R2 at a stable key, and store the key alongside the original
 *   URL. The API layer later resolves the key to a working URL.
 *
 * Best-effort: every entry point returns null on failure, never throws.
 * The caller's main flow (INGEST upsert) must succeed even if image
 * caching is unavailable (R2 down, IG refusing, network failure).
 */

const db = require('../config/db');
const env = require('../config/env');
const path = require('path');
const fs = require('fs');
const os = require('os');

const FETCH_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;            // 5 MB cap
const USER_AGENT = 'Mozilla/5.0 (compatible; InflxBot/1.0; +https://inflx.in)';
const IG_REFERER = 'https://www.instagram.com/';

// Mirrors storage.service.UPLOAD_DIR. We write under it so express.static
// at app.js:49 serves the files we put here without extra config.
const LOCAL_UPLOAD_ROOT = path.join(os.tmpdir(), 'inflx-uploads');

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache an Instagram profile picture to R2 and persist the resulting object
 * key on the creator_profiles or brand_profiles row. Idempotent — re-running
 * for the same handle overwrites the same R2 key, which is what we want when
 * the underlying IG avatar changes.
 *
 * @param {object} opts
 * @param {'creator'|'brand'} opts.targetType
 * @param {string} opts.handle  — IG handle, already normalised. Used as the
 *                                R2 key name (creator-avatars/<handle>.jpg).
 * @param {string} opts.igUrl   — Instagram-signed URL from the latest scrape.
 *
 * @returns {Promise<{ok:boolean, key?:string, error?:string, skipped?:boolean}>}
 */
async function cacheProfilePic({ targetType, handle, igUrl }) {
  if (!handle || !igUrl) {
    return { ok: false, skipped: true, error: 'missing_handle_or_url' };
  }
  if (!/^https?:\/\//i.test(igUrl)) {
    return { ok: false, skipped: true, error: 'not_http_url' };
  }

  let buf;
  try {
    buf = await _downloadImage(igUrl);
  } catch (e) {
    console.error(`[imageProxy] download failed for @${handle}:`, e.message);
    return { ok: false, error: `download:${e.message}` };
  }

  const key = `creator-avatars/${handle}.jpg`;
  try {
    await _writeToStore(key, buf);
  } catch (e) {
    console.error(`[imageProxy] R2 upload failed for @${handle}:`, e.message);
    return { ok: false, error: `upload:${e.message}` };
  }

  try {
    const table = targetType === 'brand' ? 'brand_profiles' : 'creator_profiles';
    const handleCol = targetType === 'brand' ? 'instagram_handle' : 'ig_handle';
    await db.query(
      `UPDATE ${table}
          SET profile_pic_r2_key    = $1,
              profile_pic_cached_at = NOW()
        WHERE ${handleCol} = $2`,
      [key, handle]
    );
  } catch (e) {
    console.error(`[imageProxy] DB update failed for @${handle}:`, e.message);
    return { ok: false, error: `db:${e.message}` };
  }

  return { ok: true, key };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

async function _downloadImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: IG_REFERER,
        Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error(`too large: ${contentLength}B`);
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`too large: ${ab.byteLength}B`);
    }
    return Buffer.from(ab);
  } finally {
    clearTimeout(timer);
  }
}

async function _writeToStore(key, buf) {
  if (env.R2_MOCK) {
    return _writeLocally(key, buf);
  }
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const { S3Client } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  await client.send(new PutObjectCommand({
    Bucket:       env.R2_BUCKET,
    Key:          key,
    Body:         buf,
    ContentType:  'image/jpeg',
    CacheControl: 'public, max-age=86400',
  }));
}

async function _writeLocally(key, buf) {
  const filePath = path.join(LOCAL_UPLOAD_ROOT, key);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, buf);
  console.log(`[R2 MOCK] avatar saved: ${filePath} (${buf.length}B)`);
}

module.exports = { cacheProfilePic };
