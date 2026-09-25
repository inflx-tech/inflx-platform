'use strict';

/**
 * contentStorage.service.js — where a creator's content lives, and the only way in or out.
 * Contract: features/item12-content · gap report §6 · approval §3.8, §2.6 · checks 25, 45, 46
 *
 * Creator media is the most private thing INFLX has held: photos and videos (up to 200 MB) that
 * belong to ONE collaboration — the owning brand, that creator, and Admin only once reported.
 * So nothing here goes through the paths the rest of the app uses for public images:
 *
 *   · never `putBuffer` (it marks objects Cache-Control: public);
 *   · never `brand_media_assets` (served with no login at /v1/media/assets/:id);
 *   · never the mock `/uploads` folder (served statically with no login);
 *   · never through the API server's body — a 200 MB video goes STRAIGHT to storage.
 *
 * The upload is a presigned PUT that SIGNS Content-Length and Content-Type, so storage itself
 * refuses a body of any other size or type than the one the server approved. The confirm step
 * then asks storage what actually landed (`head`) and deletes it on any mismatch. Reads are
 * presigned GETs of 300 seconds (item 7's precedent), minted per request after the access check.
 *
 * Mock mode (tests, local dev) keeps the SAME shape: an HMAC-signed, expiring PUT/GET URL to a
 * mock route that streams to a PRIVATE folder outside `/uploads`, enforces the signed length
 * and type exactly as R2 would, and records the type beside the file. The phone's upload code is
 * therefore identical in both modes.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const env = require('../config/env');

const PREFIX = 'collab-content';
const UPLOAD_EXPIRES_S = 30 * 60;   // long enough for 200 MB on a slow connection
const VIEW_EXPIRES_S = 300;         // approval §3.8

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4' };

/** The key of one file: collab-content/<ciId>/<fileId>.<ext>. Server-generated, never the client's. */
function keyFor(ciId, fileId, mime) {
  return `${PREFIX}/${ciId}/${fileId}.${EXT[mime] || 'bin'}`;
}
/** A key is ours to touch only if it sits under this collaboration's prefix. */
const keyBelongsTo = (key, ciId) => typeof key === 'string' && key.startsWith(`${PREFIX}/${ciId}/`) && !key.includes('..');

/* ───────────────────────────────────────────────────────────── real R2 */

let _client = null;
function r2() {
  if (_client) return _client;
  const { S3Client } = require('@aws-sdk/client-s3');
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  return _client;
}

/* ───────────────────────────────────────────────────────────── mock */

// The mock's private folder — deliberately NOT storage.getUploadDir(), which app.js serves at /uploads.
const MOCK_DIR = path.join(os.tmpdir(), 'inflx-content-private');
// Per-process secret: a mock URL never outlives the server that signed it.
const MOCK_SECRET = crypto.randomBytes(32);
const mockSig = (parts) => crypto.createHmac('sha256', MOCK_SECRET).update(parts.join('|')).digest('hex');
const mockPath = (key) => path.join(MOCK_DIR, ...key.split('/'));
const baseUrl = () => process.env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT}`;

function mockUrl(method, key, { exp, len = '', type = '' }) {
  const s = mockSig([method, key, exp, len, type]);
  const q = new URLSearchParams({ e: String(exp), ...(len !== '' ? { l: String(len) } : {}), ...(type ? { t: type } : {}), s });
  return `${baseUrl()}/v1/content-mock/${key.split('/').map(encodeURIComponent).join('/')}?${q}`;
}

/** Verify a mock URL the way R2 verifies a presigned one. Returns the key, or throws a status. */
function mockVerify(method, key, q) {
  const exp = Number(q.e);
  if (!key || key.includes('..') || !key.startsWith(`${PREFIX}/`)) throw Object.assign(new Error('bad key'), { status: 404 });
  const want = mockSig([method, key, q.e, q.l || '', q.t || '']);
  const got = String(q.s || '');
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    throw Object.assign(new Error('SignatureDoesNotMatch'), { status: 403 });
  }
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) throw Object.assign(new Error('Request has expired'), { status: 403 });
  return { key, len: q.l != null ? Number(q.l) : null, type: q.t || null };
}

/* ───────────────────────────────────────────────────────────── the four doors */

/**
 * A URL to PUT exactly `size` bytes of `mime` to `key`. Nothing else will be accepted there.
 * @returns {{ url, method: 'PUT', headers, expiresAt }}
 */
async function uploadUrl(key, mime, size) {
  const exp = Math.floor(Date.now() / 1000) + UPLOAD_EXPIRES_S;
  const headers = { 'Content-Type': mime };
  if (env.R2_MOCK) {
    return { url: mockUrl('PUT', key, { exp, len: size, type: mime }), method: 'PUT', headers, expiresAt: new Date(exp * 1000).toISOString() };
  }
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const cmd = new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: mime, ContentLength: size });
  // Both signed: R2 refuses a body whose length or type differs from what the server approved.
  const url = await getSignedUrl(r2(), cmd, { expiresIn: UPLOAD_EXPIRES_S, signableHeaders: new Set(['content-length', 'content-type']) });
  return { url, method: 'PUT', headers, expiresAt: new Date(exp * 1000).toISOString() };
}

/** What actually landed under `key`: { size, contentType } or null when nothing did. */
async function head(key) {
  if (env.R2_MOCK) {
    try {
      const st = fs.statSync(mockPath(key));
      const meta = JSON.parse(fs.readFileSync(`${mockPath(key)}.meta.json`, 'utf8'));
      return { size: st.size, contentType: meta.contentType || null };
    } catch { return null; }
  }
  try {
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    const out = await r2().send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    return { size: Number(out.ContentLength || 0), contentType: out.ContentType || null };
  } catch { return null; }
}

/** Delete an object. Absent is fine. */
async function remove(key) {
  if (env.R2_MOCK) {
    for (const p of [mockPath(key), `${mockPath(key)}.meta.json`]) { try { fs.unlinkSync(p); } catch { /* absent */ } }
    return;
  }
  try {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await r2().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  } catch (e) {
    console.warn('[content-storage] delete failed:', e.message);
  }
}

/** A 300-second URL to view one file. The caller has already decided this person may see it. */
async function viewUrl(key, mime) {
  const exp = Math.floor(Date.now() / 1000) + VIEW_EXPIRES_S;
  if (env.R2_MOCK) {
    return { url: mockUrl('GET', key, { exp }), expiresAt: new Date(exp * 1000).toISOString() };
  }
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const cmd = new GetObjectCommand({
    Bucket: env.R2_BUCKET, Key: key,
    ResponseContentType: mime || undefined,
    ResponseContentDisposition: 'inline',
    ResponseCacheControl: 'private, no-store',
  });
  return { url: await getSignedUrl(r2(), cmd, { expiresIn: VIEW_EXPIRES_S }), expiresAt: new Date(exp * 1000).toISOString() };
}

/* ───────────────────────────────────────────────────────────── the mock routes */

/**
 * PUT/GET /v1/content-mock/* — mounted ONLY when R2_MOCK is on. Behaves like the presigned URL
 * it stands in for: the signature, the expiry, the exact length, the exact type. The body is
 * STREAMED to disk and cut off one byte past the signed length, so it cannot grow a 200 MB+
 * buffer in the API process either.
 */
function mockRouter() {
  const { Router } = require('express');
  const router = Router();
  const keyOf = (req) => decodeURIComponent(req.params[0] || '');

  router.put('/*', (req, res) => {
    let v;
    try { v = mockVerify('PUT', keyOf(req), req.query); } catch (e) { return res.status(e.status || 403).send(e.message); }
    const declared = Number(req.headers['content-length']);
    if (!Number.isFinite(declared) || declared !== v.len) return res.status(403).send('SignatureDoesNotMatch: content-length');
    if ((req.headers['content-type'] || '') !== v.type) return res.status(403).send('SignatureDoesNotMatch: content-type');
    const file = mockPath(v.key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const out = fs.createWriteStream(file);
    let n = 0; let aborted = false;
    req.on('data', (chunk) => {
      n += chunk.length;
      if (n > v.len && !aborted) { aborted = true; req.unpipe(out); out.destroy(); try { fs.unlinkSync(file); } catch { /* */ } res.status(400).send('IncompleteBody'); }
    });
    req.pipe(out);
    out.on('finish', () => {
      if (aborted) return;
      if (n !== v.len) { try { fs.unlinkSync(file); } catch { /* */ } return res.status(400).send('IncompleteBody'); }
      fs.writeFileSync(`${file}.meta.json`, JSON.stringify({ contentType: v.type }));
      res.status(200).end();
    });
    out.on('error', () => { if (!res.headersSent) res.status(500).end(); });
  });

  router.get('/*', (req, res) => {
    let v;
    try { v = mockVerify('GET', keyOf(req), req.query); } catch (e) { return res.status(e.status || 403).send(e.message); }
    const file = mockPath(v.key);
    if (!fs.existsSync(file)) return res.status(404).end();
    let type = 'application/octet-stream';
    try { type = JSON.parse(fs.readFileSync(`${file}.meta.json`, 'utf8')).contentType || type; } catch { /* */ }
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(file).pipe(res);
  });
  return router;
}

module.exports = {
  PREFIX, UPLOAD_EXPIRES_S, VIEW_EXPIRES_S, EXT,
  keyFor, keyBelongsTo, uploadUrl, head, remove, viewUrl, mockRouter, MOCK_DIR,
};
