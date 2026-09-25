'use strict';

/**
 * uploadProbe.service.js — the device proof for item 12's uploads (approval §1, Phase 2b).
 * Contract: features/item12-content · check 45
 *
 * The approval asks for a real 200 MB video from a real phone through the real storage before
 * any content screen is written. No collaboration in production has a finished shoot, so the
 * content endpoints cannot be used for that. This is a test harness in the spirit of item 11's
 * "Test parcels": the SAME signing (`contentStorage.uploadUrl`, Content-Length and Content-Type
 * signed), the SAME head check, and nothing kept — the object is deleted the moment it has been
 * measured.
 *
 * OFF unless the server's CONTENT_UPLOAD_PROBE is exactly 'on'. Off, every door answers 404 and
 * the app shows no row. Keys live under collab-content/_probe/<userId>/ — private, never public.
 */

const crypto = require('crypto');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const storage = require('./contentStorage.service');

const enabled = () => process.env.CONTENT_UPLOAD_PROBE === 'on';
const MAX = { 'video/mp4': 200 * 1024 * 1024, 'image/jpeg': 10 * 1024 * 1024, 'image/png': 10 * 1024 * 1024 };
const secret = () => env.JWT_SECRET || 'probe';

const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', secret()).update(body).digest('base64url')}`;
};
function verify(token) {
  const [body, sig] = String(token || '').split('.');
  const want = body ? crypto.createHmac('sha256', secret()).update(body).digest('base64url') : '';
  if (!sig || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}

const off = () => { throw new AppError('NOT_FOUND', 'Not found', 404); };

function status() { return { enabled: enabled() }; }

/**
 * A signed PUT for one test file. `lieAboutSize` asks for a URL signed for ONE BYTE LESS than
 * the real file — storage must then refuse the upload, which proves the size lock on R2 itself.
 */
async function url(userId, { mime, sizeBytes, lieAboutSize = false } = {}) {
  if (!enabled()) off();
  const size = Number(sizeBytes);
  if (!MAX[mime] || !Number.isInteger(size) || size < 2 || size > MAX[mime]) {
    throw new AppError('VALIDATION_ERROR', 'Send a JPG, PNG or MP4 within the limits.', 422, 'sizeBytes');
  }
  const signedSize = lieAboutSize ? size - 1 : size;
  const key = `${storage.PREFIX}/_probe/${userId}/${crypto.randomUUID()}.${storage.EXT[mime]}`;
  const upload = await storage.uploadUrl(key, mime, signedSize);
  return { probeToken: sign({ key, mime, size: signedSize, userId, exp: Date.now() + 60 * 60 * 1000 }), upload };
}

/** Measure what landed, delete it, and say whether it matches what was signed. */
async function confirm(userId, { probeToken } = {}) {
  if (!enabled()) off();
  const p = verify(probeToken);
  if (!p || p.userId !== userId || p.exp < Date.now()) off();
  const landed = await storage.head(p.key);
  await storage.remove(p.key);
  const after = await storage.head(p.key);
  return {
    declared: { size: p.size, contentType: p.mime },
    landed,
    match: !!landed && landed.size === p.size && String(landed.contentType || '').split(';')[0] === p.mime,
    deleted: after === null,
  };
}

module.exports = { enabled, status, url, confirm };
