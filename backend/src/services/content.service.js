'use strict';

/**
 * content.service.js — the Pay for Content step (item 12).
 * Contract: features/item12-content · rules v1.29 §12.2 · gap report §8–§10 · approval §2, §3
 *
 * Every path asks `contentGate.assertContentOpen` first (ownership → gate → Aim → shoot → rows),
 * and every WRITE then asks `assertNotFrozen` — the ONE guard for a brand's report (approval
 * §2.7). The stage is derived from timestamps on `collab_content`, never stored.
 *
 * This file holds, in order:
 *   · loading and the derived state;
 *   · the files (Phase 2b): ask to upload, confirm what landed, remove, view, the sweep.
 */

const crypto = require('crypto');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const contentGate = require('./contentGate.service');
const storage = require('./contentStorage.service');
const { MSG } = require('./contentCopy');

const MB = 1024 * 1024;
const LIMITS = {
  photo: { mimes: ['image/jpeg', 'image/png'], max: 10 * MB, tooLarge: MSG.FILE_TOO_LARGE_PHOTO },
  video: { mimes: ['video/mp4'], max: 200 * MB, tooLarge: MSG.FILE_TOO_LARGE_VIDEO },
};
const MAX_FILES_PER_ROW = 10;
const SWEEP_AFTER_HOURS = 24;

const refuse = (code, message, status = 422, field = null) => { throw new AppError(code, message, status, field); };

/* ───────────────────────────────────────────────────────────── loading */

async function contentRow(ciId, conn = db, { lock = false } = {}) {
  const { rows } = await conn.query(
    `SELECT * FROM collab_content WHERE campaign_influencer_id = $1${lock ? ' FOR UPDATE' : ''}`, [ciId]);
  return rows[0] || null;
}

/**
 * The content row for a collaboration, created on the first write after the gate passed. Never
 * before (approval Q31: no backfill; "nothing is created before the shoot is done").
 * Returns the row LOCKED for the caller's transaction.
 */
async function ensureContent(client, g) {
  await client.query(
    `INSERT INTO collab_content (campaign_influencer_id, contract_id) VALUES ($1, $2)
     ON CONFLICT (campaign_influencer_id) DO NOTHING`,
    [g.r.ci_id, g.r.contract_id]);
  return contentRow(g.r.ci_id, client, { lock: true });
}

async function roundsOf(contentId, conn = db) {
  const { rows } = await conn.query(
    `SELECT * FROM content_rounds WHERE content_id = $1 ORDER BY round_no`, [contentId]);
  return rows;
}

/**
 * Where the package stands, from its timestamps and its current round:
 *   draft · in_review · changes · approved · posted · live · complete
 * `draft` covers "nothing sent yet" (round 1) and "she is making changes" (round > 1 is the
 * changes state as long as the previous verdict was 'changes' and this round is not sent).
 */
function stageOf(cc, rounds) {
  if (!cc) return 'draft';
  if (cc.completed_at) return 'complete';
  if (cc.live_confirmed_at) return 'live';
  if (cc.posted_at) return 'posted';
  if (cc.approved_at) return 'approved';
  const cur = rounds.find((x) => x.round_no === cc.current_round);
  if (cur && !cur.verdict) return 'in_review';
  if (cc.current_round > 1) return 'changes';
  return 'draft';
}

/* ───────────────────────────────────────────────────────────── the guards */

/**
 * THE freeze (approval §2.7, v1.29): a report by the brand stops every write until INFLX settles
 * it. One function, one sentence, called by every write in this service. Her `brand_silent`
 * report freezes nothing — it is not checked here.
 */
function assertNotFrozen(cc) {
  if (cc && cc.brand_reported_at) refuse('REPORTED_HOLD', MSG.REPORTED_HOLD, 422, 'status');
}

/** The package may change only while it is hers: before sending, or after a change request. */
function assertDraftOpen(cc, rounds, brandName) {
  const stage = stageOf(cc, rounds);
  if (stage === 'in_review') refuse('PACKAGE_LOCKED', MSG.PACKAGE_LOCKED(brandName), 422, 'status');
  if (!['draft', 'changes'].includes(stage)) refuse('ALREADY_APPROVED', MSG.ALREADY_APPROVED, 422, 'status');
}

/** The file ids any submitted round froze into its package. Never swept, never hard-deleted. */
function referencedFileIds(rounds) {
  const ids = new Set();
  for (const rd of rounds) {
    for (const row of ((rd.package_json && rd.package_json.rows) || [])) for (const id of (row.fileIds || [])) ids.add(id);
  }
  return ids;
}

/* ───────────────────────────────────────────────────────────── files (Phase 2b) */

/** Kind, type and size, validated against the limits of §12.2 before anything is signed. */
function validateDeclared({ kind, mime, sizeBytes }, purpose) {
  const lim = LIMITS[kind];
  if (!lim) refuse('FILE_WRONG_TYPE', MSG.FILE_WRONG_TYPE, 422, 'kind');
  if (purpose === 'story_proof' && kind !== 'photo') refuse('FILE_WRONG_TYPE', MSG.FILE_WRONG_TYPE, 422, 'kind');
  if (!lim.mimes.includes(mime)) refuse('FILE_WRONG_TYPE', MSG.FILE_WRONG_TYPE, 422, 'mime');
  const size = Number(sizeBytes);
  if (!Number.isInteger(size) || size < 1) refuse('FILE_WRONG_TYPE', MSG.FILE_WRONG_TYPE, 422, 'sizeBytes');
  if (size > lim.max) refuse(kind === 'photo' ? 'FILE_TOO_LARGE_PHOTO' : 'FILE_TOO_LARGE_VIDEO', lim.tooLarge, 422, 'sizeBytes');
  return { lim, size };
}

/** Files that currently belong to a row of the draft (not removed, not deleted). */
async function liveFilesOfRow(client, contentId, rowKey, purpose) {
  const { rows } = await client.query(
    `SELECT * FROM content_files
      WHERE content_id = $1 AND row_key = $2 AND purpose = $3
        AND deleted_at IS NULL AND removed_round IS NULL
      ORDER BY uploaded_at, id`, [contentId, rowKey, purpose]);
  return rows;
}

/**
 * G2a — ask to upload one file. The server names the key; the phone PUTs straight to storage.
 * body: { rowKey, kind: 'photo'|'video', mime, sizeBytes, durationS?, purpose?: 'content'|'story_proof' }
 */
async function requestUpload(ciId, scope, body = {}) {
  const purpose = body.purpose === 'story_proof' ? 'story_proof' : 'content';
  const g = await contentGate.assertContentOpen(ciId, scope);
  if (scope.side !== 'creator') refuse('NOT_FOUND', 'Not found', 404);
  const row = g.rows.find((x) => x.key === body.rowKey);
  if (!row) refuse('UNKNOWN_ROW', MSG.UNKNOWN_ROW, 422, 'rowKey');
  const { size } = validateDeclared(body, purpose);
  const duration = body.durationS != null && Number.isFinite(Number(body.durationS)) && Number(body.durationS) >= 0
    ? Math.min(Number(body.durationS), 99999) : null;

  const out = await db.withTransaction(async (client) => {
    const cc = await ensureContent(client, g);
    assertNotFrozen(cc);
    const rounds = await roundsOf(cc.id, client);
    if (purpose === 'content') {
      assertDraftOpen(cc, rounds, g.r.brand_name);
    } else {
      // A Story screenshot is posting proof: after approval, before she says she has posted.
      if (!row.isStory) refuse('LINK_ONLY', MSG.LINK_ONLY, 422, 'rowKey');
      if (!cc.approved_at) refuse('NOT_APPROVED', MSG.NOT_APPROVED(g.r.brand_name), 422, 'status');
      if (cc.posted_at) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
    }
    const existing = await liveFilesOfRow(client, cc.id, row.key, purpose);
    const cap = purpose === 'content' ? MAX_FILES_PER_ROW : row.count;
    if (existing.length >= cap) refuse('ROW_FULL', MSG.ROW_FULL, 422, 'rowKey');

    const fileId = crypto.randomUUID();
    const key = storage.keyFor(ciId, fileId, body.mime);
    const { rows: [f] } = await client.query(
      `INSERT INTO content_files (id, content_id, row_key, purpose, kind, mime, size_bytes, duration_s,
                                  storage_key, added_round, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [fileId, cc.id, row.key, purpose, body.kind, body.mime, size, duration, key, cc.current_round, scope.userId]);
    return f;
  });

  const up = await storage.uploadUrl(out.storage_key, out.mime, Number(out.size_bytes));
  return { fileId: out.id, ...up };
}

/**
 * G2b — confirm the upload. Storage is asked what actually landed; anything that differs from
 * what was declared is deleted and refused (check 45). Only then does the file count.
 */
async function confirmUpload(ciId, scope, fileId) {
  await contentGate.assertContentOpen(ciId, scope);
  if (scope.side !== 'creator') refuse('NOT_FOUND', 'Not found', 404);
  const cc0 = await contentRow(ciId);
  if (!cc0) refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 404);
  const { rows: [f0] } = await db.query(
    `SELECT * FROM content_files WHERE id = $1 AND content_id = $2 AND deleted_at IS NULL`, [fileId, cc0.id]);
  if (!f0) refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 404);
  if (f0.verified_at) return fileOut(f0);                       // idempotent: a retry after a timeout
  if (!storage.keyBelongsTo(f0.storage_key, ciId)) refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 404);

  const landed = await storage.head(f0.storage_key);
  if (!landed) refuse('UPLOAD_MISSING', MSG.UPLOAD_MISSING, 422, 'fileId');
  const declared = Number(f0.size_bytes);
  const typeOk = String(landed.contentType || '').split(';')[0].trim().toLowerCase() === f0.mime;
  const sizeOk = landed.size === declared;
  if (!typeOk || !sizeOk) {
    await storage.remove(f0.storage_key);
    await db.query(`UPDATE content_files SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [f0.id]);
    if (!typeOk) refuse('FILE_WRONG_TYPE', MSG.FILE_WRONG_TYPE, 422, 'fileId');
    const lim = LIMITS[f0.kind];
    if (landed.size > lim.max) refuse(f0.kind === 'photo' ? 'FILE_TOO_LARGE_PHOTO' : 'FILE_TOO_LARGE_VIDEO', lim.tooLarge, 422, 'fileId');
    refuse('UPLOAD_MISSING', MSG.UPLOAD_MISSING, 422, 'fileId');
  }

  return db.withTransaction(async (client) => {
    const cc = await contentRow(ciId, client, { lock: true });
    assertNotFrozen(cc);
    const { rows: [f] } = await client.query(
      `UPDATE content_files SET verified_at = now()
        WHERE id = $1 AND verified_at IS NULL AND deleted_at IS NULL RETURNING *`, [f0.id]);
    if (f) return fileOut(f);
    const { rows: [again] } = await client.query(`SELECT * FROM content_files WHERE id = $1`, [f0.id]);
    if (again && again.verified_at && !again.deleted_at) return fileOut(again);
    return refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 404);
  });
}

/**
 * G3 — remove a file from the draft. A file never sent is gone for good (object deleted); a file
 * an earlier round sent is only taken OUT of this round — earlier rounds are never overwritten.
 */
async function removeFile(ciId, scope, fileId) {
  const g = await contentGate.assertContentOpen(ciId, scope);
  if (scope.side !== 'creator') refuse('NOT_FOUND', 'Not found', 404);
  const toDelete = await db.withTransaction(async (client) => {
    const cc = await contentRow(ciId, client, { lock: true });
    if (!cc) refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 404);
    assertNotFrozen(cc);
    const rounds = await roundsOf(cc.id, client);
    const { rows: [f] } = await client.query(
      `SELECT * FROM content_files WHERE id = $1 AND content_id = $2 AND deleted_at IS NULL AND removed_round IS NULL`,
      [fileId, cc.id]);
    if (!f) refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 404);
    if (f.purpose === 'story_proof') {
      // A screenshot is proof, changeable until she says she has posted.
      if (cc.posted_at) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
      await client.query(`DELETE FROM content_proofs WHERE content_id = $1 AND screenshot_file_id = $2`, [cc.id, f.id]);
    } else {
      assertDraftOpen(cc, rounds, g.r.brand_name);
    }
    if (referencedFileIds(rounds).has(f.id)) {
      await client.query(`UPDATE content_files SET removed_round = $2 WHERE id = $1`, [f.id, cc.current_round]);
      return null;
    }
    await client.query(`UPDATE content_files SET deleted_at = now() WHERE id = $1`, [f.id]);
    return f.storage_key;
  });
  if (toDelete) await storage.remove(toDelete);
  return { ok: true };
}

/**
 * G12 — a 300-second URL to view one file.
 *   creator — any of her own files on this collaboration;
 *   brand   — only what she has SENT: a file frozen into a submitted round, or a Story screenshot
 *             once she has said she posted;
 *   admin   — only once either side has reported to INFLX (approval Q12).
 * Everything else is 404 (checks 25, 26).
 */
async function fileUrl(ciId, scope, fileId) {
  let cc;
  if (scope.side === 'admin') {
    const r = await contentGate.load(ciId, scope);
    if (!r) refuse('NOT_FOUND', 'Not found', 404);
    cc = await contentRow(ciId);
    if (!cc || (!cc.brand_reported_at && !cc.creator_reported_at)) refuse('NOT_FOUND', 'Not found', 404);
  } else {
    await contentGate.assertContentOpen(ciId, scope);
    cc = await contentRow(ciId);
    if (!cc) refuse('NOT_FOUND', 'Not found', 404);
  }
  const { rows: [f] } = await db.query(
    `SELECT * FROM content_files WHERE id = $1 AND content_id = $2 AND deleted_at IS NULL AND verified_at IS NOT NULL`,
    [fileId, cc.id]);
  if (!f) refuse('NOT_FOUND', 'Not found', 404);
  if (scope.side === 'brand') {
    const sent = f.purpose === 'story_proof'
      ? !!cc.posted_at
      : referencedFileIds(await roundsOf(cc.id)).has(f.id);
    if (!sent) refuse('NOT_FOUND', 'Not found', 404);
  }
  if (!storage.keyBelongsTo(f.storage_key, ciId)) refuse('NOT_FOUND', 'Not found', 404);
  const v = await storage.viewUrl(f.storage_key, f.mime);
  console.log(`[content] view url issued: file ${f.id} ci ${ciId} to ${scope.side} ${scope.userId || ''}`);
  return { fileId: f.id, kind: f.kind, mime: f.mime, ...v };
}

/**
 * The sweep (approval §2.1): an upload never confirmed within 24 hours is deleted — but NEVER a
 * file any round references, even one that somehow stayed unverified through a race. Run from
 * the :55 lane (J2b).
 */
async function sweep({ olderThanHours = SWEEP_AFTER_HOURS } = {}) {
  const { rows } = await db.query(
    `SELECT f.id, f.storage_key
       FROM content_files f
      WHERE f.verified_at IS NULL AND f.deleted_at IS NULL
        AND f.uploaded_at < now() - ($1 || ' hours')::interval
        AND NOT EXISTS (
          SELECT 1 FROM content_rounds r, jsonb_array_elements(r.package_json->'rows') row_,
                 jsonb_array_elements_text(row_->'fileIds') fid
           WHERE r.content_id = f.content_id AND fid = f.id::text)
        AND NOT EXISTS (SELECT 1 FROM content_proofs p WHERE p.screenshot_file_id = f.id)`,
    [String(olderThanHours)]);
  let deleted = 0;
  for (const f of rows) {
    const { rowCount } = await db.query(
      `UPDATE content_files SET deleted_at = now() WHERE id = $1 AND verified_at IS NULL AND deleted_at IS NULL`, [f.id]);
    if (rowCount) { await storage.remove(f.storage_key); deleted += 1; }
  }
  return { deleted };
}

const fileOut = (f) => ({
  id: f.id, rowKey: f.row_key, purpose: f.purpose, kind: f.kind, mime: f.mime,
  sizeBytes: Number(f.size_bytes), durationS: f.duration_s != null ? Number(f.duration_s) : null,
  uploadedAt: f.uploaded_at, verified: !!f.verified_at,
});

module.exports = {
  LIMITS, MAX_FILES_PER_ROW,
  contentRow, ensureContent, roundsOf, stageOf, referencedFileIds,
  assertNotFrozen, assertDraftOpen,
  requestUpload, confirmUpload, removeFile, fileUrl, sweep, fileOut,
};
