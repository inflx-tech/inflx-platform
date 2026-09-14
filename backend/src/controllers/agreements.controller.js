'use strict';

/**
 * Item 7 — the agreement endpoints, C1–C12.
 * Every rule lives in services/agreement.service; these are thin wrappers.
 * Contract: features/item7-agreement
 *
 * Access: brand endpoints for the owning brand, creator endpoints for that
 * creator, everything else 404 — never 403, which would confirm the row exists.
 */

const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../config/db');
const agreement = require('../services/agreement.service');
const agreementDocument = require('../services/agreementDocument.service');
const standardTerms = require('../services/standardTerms.service');
const storageService = require('../services/storage.service');
const { MSG } = require('../services/agreementCopy');

// ─── brand ───────────────────────────────────────────────────────────────────

// C1 — GET the preview, generated from the invitation (P2)
const preview = asyncHandler(async (req, res) =>
  success(res, { agreement: await agreement.preview(req.params.ciId, req.user.sub) }));

// C2 — POST send it (P3)
const send = asyncHandler(async (req, res) =>
  success(res, { agreement: await agreement.send(req.params.ciId, req.user.sub, req) }, 201));

// C3 — GET the agreement as the brand reads it (P1, P9, P12)
const brandRead = asyncHandler(async (req, res) =>
  success(res, { agreement: await agreement.read(req.params.ciId, { side: 'brand', userId: req.user.sub }) }));

// C4 — GET what signing will cost (P9, P10)
const cost = asyncHandler(async (req, res) =>
  success(res, { cost: await agreement.cost(req.params.ciId, req.user.sub) }));

// C5 — POST the brand's signature; locks the funds and releases the first payment (P11, P12)
const brandSign = asyncHandler(async (req, res) =>
  success(res, { agreement: await agreement.brandSign(req.params.ciId, req.user.sub, req.body, req) }));

// C6 — POST withdraw, only while she has not signed (P14)
const withdraw = asyncHandler(async (req, res) =>
  success(res, { agreement: await agreement.withdraw(req.params.ciId, req.user.sub) }));

// ─── creator ─────────────────────────────────────────────────────────────────

// C7 — GET the agreement as she reads it (P4, P5, P7)
const creatorRead = asyncHandler(async (req, res) =>
  success(res, { agreement: await agreement.read(req.params.ciId, { side: 'creator', userId: req.user.sub }) }));

// C8 — POST her signature (P6, P7)
const creatorSign = asyncHandler(async (req, res) =>
  success(res, { agreement: await agreement.creatorSign(req.params.ciId, req.user.sub, req.body, req) }));

// C9 — POST her decline, with one of the six reasons (P8)
const creatorDecline = asyncHandler(async (req, res) =>
  success(res, { agreement: await agreement.decline(req.params.ciId, req.user.sub, req.body) }));

// ─── shared ──────────────────────────────────────────────────────────────────

// C10 — the standard terms, current or by version
const getStandardTerms = asyncHandler(async (req, res) => {
  const t = req.params.version ? await standardTerms.byVersion(req.params.version) : await standardTerms.current();
  return success(res, { terms: t });
});

/**
 * C11 — the document, for either party, once both have signed.
 *
 * The link is presigned for FIVE MINUTES, not the hour the old contract
 * endpoint used, and every issue is logged (approval Q7). A presigned URL is
 * credential-free once minted, so its life is the whole of its security.
 */
const DOWNLOAD_TTL_SECONDS = 300;

const document = asyncHandler(async (req, res) => {
  const view = await agreement.read(req.params.ciId, {
    side: req.user.role === 'brand' ? 'brand' : 'creator', userId: req.user.sub,
  });
  if (!view.signatures.creator || !view.signatures.brand) {
    throw new AppError('VALIDATION_ERROR', MSG.NOT_COMPLETE, 422, 'status');
  }

  const { rows } = await db.query(
    `SELECT id, pdf_url, pdf_sha256 FROM contracts WHERE campaign_influencer_id = $1`, [req.params.ciId]
  );
  let key = rows[0] && rows[0].pdf_url;
  if (!key) {
    const made = await agreementDocument.produce(rows[0].id);
    key = made.key;
  }

  const url = await storageService.getPdfDownloadUrl(key, { expiresIn: DOWNLOAD_TTL_SECONDS }).catch(() => null);
  console.log(`[AGREEMENT] document link issued · contract ${rows[0].id} · user ${req.user.sub} · ${DOWNLOAD_TTL_SECONDS}s`);
  return success(res, {
    document: {
      url, expiresIn: DOWNLOAD_TTL_SECONDS,
      reference: view.reference, sha256: rows[0].pdf_sha256 || null,
    },
  });
});

module.exports = {
  preview, send, brandRead, cost, brandSign, withdraw,
  creatorRead, creatorSign, creatorDecline,
  getStandardTerms, document,
};
