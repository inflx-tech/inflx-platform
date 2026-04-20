'use strict';

/**
 * contract.controller.js
 * Phase 3 — Blocks A & B
 *
 * GET  /v1/contracts/:campaign_influencer_id  — fetch contract + deliverables
 * POST /v1/contracts/:id/sign                 — influencer signs (pending_influencer → pending_brand)
 * POST /v1/contracts/:id/brand-sign           — brand countersigns (pending_brand → active)
 *
 * brand-sign also:
 *   - Creates 3 escrow_entries (T1/T2/T3)
 *   - Immediately releases T1 (processTrancheRelease)
 *   - Auto-creates one reel deliverable
 *   - Generates + stores contract PDF
 */

const db                  = require('../config/db');
const { success }         = require('../utils/response');
const AppError            = require('../utils/AppError');
const asyncHandler        = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');
const pdfService          = require('../services/pdf.service');
const storageService      = require('../services/storage.service');
const escrowService       = require('../services/escrow.service');

// ─── Private helpers ──────────────────────────────────────────────────────────

async function getBrandOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT id, user_id, wallet_balance, platform_fee_pct FROM brands WHERE user_id = $1`,
    [userId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0];
}

async function getInfluencerOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT id, user_id FROM influencers WHERE user_id = $1`,
    [userId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0];
}

/**
 * Fetch a contract row by its UUID (contract.id).
 * Includes joined brand_id, influencer_id, campaign_id for auth checks.
 */
async function getContractByIdOrThrow(contractId) {
  const { rows } = await db.query(
    `SELECT
       con.*,
       ci.influencer_id,
       ci.agreed_fee,
       ci.influencer_budget,
       ci.posting_date    AS ci_posting_date,
       cs.campaign_id,
       cs.per_influencer_budget,
       cs.formats_json,
       c.brand_id,
       b.platform_fee_pct,
       b.wallet_balance   AS brand_wallet_balance,
       u_inf.id           AS influencer_user_id,
       u_inf.fcm_token    AS influencer_fcm_token,
       u_inf.phone        AS influencer_phone,
       u_br.id            AS brand_user_id,
       u_br.fcm_token     AS brand_fcm_token,
       u_br.phone         AS brand_phone
     FROM contracts con
     JOIN campaign_influencers ci ON ci.id  = con.campaign_influencer_id
     JOIN campaign_sets        cs ON cs.id  = ci.set_id
     JOIN campaigns            c  ON c.id   = cs.campaign_id
     JOIN brands               b  ON b.id   = c.brand_id
     JOIN influencers          inf ON inf.id = ci.influencer_id
     JOIN users                u_inf ON u_inf.id = inf.user_id
     JOIN users                u_br  ON u_br.id  = b.user_id
     WHERE con.id = $1`,
    [contractId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Contract not found', 404);
  return rows[0];
}

/**
 * Verify the requester is allowed to view/act on a contract.
 * Brand → must own the campaign brand
 * Influencer → must be the campaign_influencer
 */
function assertPartyAccess(contract, req) {
  const role = req.user.role;
  if (role === 'brand') {
    // brandId stored on req.user or looked up from DB — compare via brand_user_id
    if (contract.brand_user_id !== req.user.sub) {
      throw new AppError('FORBIDDEN', 'You do not own this contract', 403);
    }
  } else if (role === 'influencer') {
    if (contract.influencer_user_id !== req.user.sub) {
      throw new AppError('FORBIDDEN', 'You do not own this contract', 403);
    }
  } else {
    throw new AppError('FORBIDDEN', 'Access denied', 403);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/contracts/:campaign_influencer_id
// ─────────────────────────────────────────────────────────────────────────────

const getContract = asyncHandler(async (req, res) => {
  const ciId = req.params.campaign_influencer_id;

  // Look up contract by campaign_influencer_id
  const { rows } = await db.query(
    `SELECT
       con.*,
       ci.influencer_id,
       cs.campaign_id,
       c.brand_id,
       u_inf.id  AS influencer_user_id,
       u_br.id   AS brand_user_id
     FROM contracts con
     JOIN campaign_influencers ci ON ci.id  = con.campaign_influencer_id
     JOIN campaign_sets        cs ON cs.id  = ci.set_id
     JOIN campaigns            c  ON c.id   = cs.campaign_id
     JOIN brands               b  ON b.id   = c.brand_id
     JOIN influencers          inf ON inf.id = ci.influencer_id
     JOIN users                u_inf ON u_inf.id = inf.user_id
     JOIN users                u_br  ON u_br.id  = b.user_id
     WHERE con.campaign_influencer_id = $1`,
    [ciId]
  );

  if (!rows[0]) {
    // Check if CI itself exists — better 404 message
    const { rows: ciRows } = await db.query(
      `SELECT id FROM campaign_influencers WHERE id = $1`,
      [ciId]
    );
    if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Campaign influencer not found', 404);
    throw new AppError('NOT_FOUND', 'Contract not found for this offer', 404);
  }

  const contract = rows[0];

  // Auth check
  assertPartyAccess(contract, req);

  // Fetch deliverables
  const { rows: deliverables } = await db.query(
    `SELECT * FROM deliverables WHERE campaign_influencer_id = $1 ORDER BY id ASC`,
    [ciId]
  );

  // Strip internal join columns before returning
  const { influencer_user_id, brand_user_id, ...contractData } = contract;

  return success(res, { contract: contractData, deliverables });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/contracts/:id/sign  (influencer)
// ─────────────────────────────────────────────────────────────────────────────

const sign = asyncHandler(async (req, res) => {
  // Only influencer can call this
  if (req.user.role !== 'influencer') {
    throw new AppError('FORBIDDEN', 'Only influencers can sign this slot', 403);
  }

  const contract = await getContractByIdOrThrow(req.params.id);

  // Verify requester is the influencer on this contract
  if (contract.influencer_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this contract', 403);
  }

  // Validate state
  if (contract.status !== 'pending_influencer') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot sign contract in '${contract.status}' status. Must be pending_influencer.`,
      422
    );
  }

  // Validate typed_name
  const typed_name = (req.body.typed_name || '').trim();
  if (!typed_name) {
    throw new AppError('VALIDATION_ERROR', 'typed_name is required', 422, 'typed_name');
  }

  // Update contract
  const { rows } = await db.query(
    `UPDATE contracts
     SET status = 'pending_brand',
         influencer_signed_name = $2,
         influencer_signed_at   = now()
     WHERE id = $1
     RETURNING *`,
    [contract.id, typed_name]
  );

  // Notify brand that influencer has signed
  await notificationService.send({
    userId:   contract.brand_user_id,
    type:     'contract.influencer_signed',
    title:    'Contract Signed by Influencer',
    body:     `The influencer has signed the contract for campaign "${contract.campaign_name}". Please review and countersign.`,
    data:     { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id },
    fcmToken: contract.brand_fcm_token,
    sendSms:  false,
  });

  return success(res, { contract: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/contracts/:id/brand-sign  (brand countersigns)
// ─────────────────────────────────────────────────────────────────────────────

const brandSign = asyncHandler(async (req, res) => {
  // Only brand can call this
  if (req.user.role !== 'brand') {
    throw new AppError('FORBIDDEN', 'Only brands can countersign contracts', 403);
  }

  let contract;
  try {
    contract = await getContractByIdOrThrow(req.params.id);
  } catch (e) {
    if (e instanceof AppError) throw e;
    console.error('[brandSign] getContract failed:', e.message);
    throw new AppError('INTERNAL_ERROR', `Contract lookup failed: ${e.message}`, 500);
  }

  // Verify requester owns the brand
  if (contract.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this contract', 403);
  }

  // Validate state
  if (contract.status !== 'pending_brand') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot brand-sign contract in '${contract.status}' status. Must be pending_brand.`,
      422
    );
  }

  let updatedContract;
  let t1EntryId;
  let t1Result;

  // effectiveFee = the TOTAL the influencer is owed (base + brand bonus).
  // contracts.influencer_fee holds the BASE agreed amount only. Bonus, if
  // any, is added separately. Escrow tranches + wallet lock are computed off
  // this combined total so the influencer receives the full agreed sum.
  const baseFee     = parseFloat(contract.influencer_fee || contract.agreed_fee || contract.influencer_budget || contract.per_influencer_budget || 0);
  const bonusOnTop  = parseFloat(contract.bonus_amount || 0);
  const effectiveFee = baseFee + bonusOnTop;
  console.log('[brandSign] effectiveFee:', effectiveFee, '| base:', baseFee, '| bonus:', bonusOnTop, '| influencer_fee(base):', contract.influencer_fee);

  // ── Per-contract wallet lock ─────────────────────────────────────────────
  // Money used to be locked at campaign publish for the entire budget.
  // Now we lock only what's needed for THIS specific contract — at the
  // moment both parties have agreed on the final fee. If brand wallet
  // doesn't have enough, brand-sign is refused with WALLET_INSUFFICIENT.
  //
  // What gets locked = effectiveFee + (effectiveFee × platform_fee_pct%).
  // wallet_balance is in PAISE; effectiveFee is in RUPEES.
  const platformFeePct      = parseFloat(contract.platform_fee_pct || 8);
  const lockAmountRupees    = effectiveFee * (1 + platformFeePct / 100);
  const lockAmountPaise     = Math.round(lockAmountRupees * 100);
  const needsWalletLock     = effectiveFee > 0;   // conversion-only contracts skip this

  if (needsWalletLock) {
    const { rows: brandWalletRows } = await db.query(
      `SELECT wallet_balance FROM brands WHERE id = $1`,
      [contract.brand_id]
    );
    const walletBalancePaise = parseFloat(brandWalletRows[0]?.wallet_balance || 0);
    if (walletBalancePaise < lockAmountPaise) {
      throw new AppError(
        'WALLET_INSUFFICIENT',
        `Insufficient wallet balance to sign this contract. ` +
        `Need ₹${lockAmountRupees.toFixed(2)} (₹${effectiveFee.toFixed(2)} fee + ${platformFeePct}% platform fee). ` +
        `Available: ₹${(walletBalancePaise / 100).toFixed(2)}. Top up your wallet first.`,
        422
      );
    }
  }

  // Everything in one transaction for atomicity
  try {
    await db.withTransaction(async (client) => {
      // 0. Backfill base fee only — keep influencer_fee = base. Bonus stays
      //    in its own column. effectiveFee (base+bonus) is what's used for
      //    escrow + wallet, but we don't write the inflated number back.
      if (!contract.influencer_fee && baseFee > 0) {
        await client.query(`UPDATE contracts SET influencer_fee = $1 WHERE id = $2`, [baseFee, contract.id]);
        await client.query(`UPDATE campaign_influencers SET agreed_fee = COALESCE(agreed_fee, $1) WHERE id = $2`, [baseFee, contract.campaign_influencer_id]);
      }

      // 0.5 NEW: Lock per-contract funds in brand wallet (engagement/hybrid only)
      if (needsWalletLock) {
        const { rows: walletRows } = await client.query(
          `SELECT wallet_balance FROM brands WHERE id = $1 FOR UPDATE`,
          [contract.brand_id]
        );
        const currentBalance = parseFloat(walletRows[0].wallet_balance);
        const newBalance = currentBalance - lockAmountPaise;
        if (newBalance < 0) {
          // Race condition guard — another contract grabbed funds first
          throw new AppError('WALLET_INSUFFICIENT', 'Wallet balance changed; please retry.', 422);
        }
        await client.query(
          `UPDATE brands SET wallet_balance = $1 WHERE id = $2`,
          [newBalance, contract.brand_id]
        );
        await client.query(
          `INSERT INTO wallet_transactions
             (brand_id, type, amount, direction, balance_after, campaign_id, notes)
           VALUES ($1, 'escrow_lock', $2, 'debit', $3, $4, $5)`,
          [
            contract.brand_id,
            lockAmountPaise,
            newBalance,
            contract.campaign_id,
            `Escrow lock for contract: ${contract.influencer_name || contract.influencer_id} (${contract.campaign_name})`,
          ]
        );
      }

      // 1. Mark contract as active
      const { rows: contractRows } = await client.query(
        `UPDATE contracts
         SET status = 'active', brand_signed_at = now(), brand_signed_by = $2
         WHERE id = $1
         RETURNING *`,
        [contract.id, req.user.sub]
      );
      updatedContract = contractRows[0];

      // 2. Mark campaign_influencer as contracted
      await client.query(
        `UPDATE campaign_influencers SET status = 'contracted' WHERE id = $1`,
        [contract.campaign_influencer_id]
      );

      // 3. Create 3 escrow entries — engagement / hybrid only. Conversion-only
      //    contracts (effectiveFee == 0) get no tranches: the influencer is
      //    paid on commission via the follower-transaction pipeline instead.
      if (effectiveFee > 0) {
        const entries = await escrowService.createEscrowEntries(
          client,
          contract.campaign_influencer_id,
          effectiveFee,
          contract.platform_fee_pct
        );
        t1EntryId = entries[0].id; // T1 is first

        // 4. Release T1 immediately
        t1Result = await escrowService.processTrancheRelease(
          client,
          t1EntryId,
          contract.influencer_id,
          contract.brand_id,
          contract.campaign_id
        );
      }

      // 5. Auto-create deliverables from formats_json. Strict — if formats_json
      //    is missing/invalid we fail loudly rather than silently creating a
      //    single reel and losing the brand's other deliverables (post/story/etc).
      const raw = contract.formats_json;
      let formats;
      if (raw == null || raw === '') {
        throw new AppError(
          'VALIDATION_ERROR',
          'Cannot create contract: campaign set has no deliverable formats configured. ' +
          'Edit the set in the campaign wizard and add at least one format (reel/post/story/...).',
          422
        );
      }
      try {
        formats = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (parseErr) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Cannot create contract: campaign set's formats_json is malformed (${parseErr.message}).`,
          422
        );
      }
      if (!Array.isArray(formats) || formats.length === 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Cannot create contract: campaign set has no deliverable formats. ' +
          'Add at least one format (reel/post/story/...) before signing.',
          422
        );
      }

      // formats_json may be EITHER an array of strings ("Instagram reel", "Instagram post")
      // from the wizard, OR an array of objects [{ type, count }] from older campaigns.
      // Normalise both shapes.
      const FORMAT_ALIAS = {
        'instagram reel':   'reel',
        'instagram post':   'post',
        'instagram story':  'story',
        'instagram stories':'story',
        'youtube short':    'youtube_short',
        'youtube video':    'youtube_video',
      };
      // Helper: turn any format identifier (string or object field) into the
      // canonical short type ('reel' / 'post' / 'story' / 'youtube_short' /
      // 'youtube_video') stored in the deliverables.type column.
      const toCanonicalType = (raw) => {
        if (!raw) return 'reel';
        const key = String(raw).toLowerCase().trim();
        return FORMAT_ALIAS[key] || key.replace(/\s+/g, '_');
      };

      const normalised = formats.map(f => {
        if (typeof f === 'string') {
          // Wizard often sends just strings: ["Instagram reel", "Instagram post"]
          return { type: toCanonicalType(f), count: 1 };
        }
        // Wizard ALSO sends objects with a `name` field, NOT `type`. The old
        // code only checked `f.type`, so every format defaulted to 'reel' and
        // an influencer with reel + post + story ended up with three reels.
        // Fix: try `f.type` first (legacy), then `f.name` (current wizard
        // shape), then fall back to 'reel'.
        const rawType = f.type || f.name || f.label || 'reel';
        return {
          type:  toCanonicalType(rawType),
          count: Math.max(1, parseInt(f.count, 10) || 1),
        };
      });

      for (const fmt of normalised) {
        for (let i = 0; i < fmt.count; i++) {
          await client.query(
            `INSERT INTO deliverables
               (campaign_influencer_id, type, quantity, status, submission_deadline, revision_limit)
             VALUES ($1, $2, 1, 'pending', $3, $4)`,
            [
              contract.campaign_influencer_id,
              fmt.type,
              updatedContract.posting_date || null,
              updatedContract.revision_limit,
            ]
          );
        }
      }
    });
  } catch (txErr) {
    console.error('[brandSign] Transaction failed:', txErr.message, txErr.code || '');
    throw new AppError('INTERNAL_ERROR', `Contract signing failed: ${txErr.message}`, 500);
  }

  // 6. Generate PDF (outside transaction — non-critical for DB integrity).
  //    Failures are persisted on the contract row so the UI can show "PDF
  //    pending — regenerate" instead of a silent NULL.
  await _generateAndStorePdf(contract.id).catch(err => {
    console.error('[CONTRACT] PDF generation failed:', err.message);
  });

  // 7. Notify influencer that contract is now active. T1 payment line is only
  //    included when a tranche was actually released (effectiveFee > 0).
  try {
    const netAmt = t1Result?.netAmount || 0;
    const body = t1Result
      ? `Your contract for campaign "${contract.campaign_name}" is now active. Tranche 1 payment of ₹${netAmt.toFixed(2)} has been initiated.`
      : `Your contract for campaign "${contract.campaign_name}" is now active. Time to start creating content!`;
    await notificationService.send({
      userId:   contract.influencer_user_id,
      type:     'contract.active',
      title:    t1Result ? 'Contract Active — Payment Initiated' : 'Contract Active',
      body,
      data:     { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id },
      fcmToken: contract.influencer_fcm_token,
      sendSms:  true,
      phone:    contract.influencer_phone,
    });
  } catch (notifErr) {
    console.error('[CONTRACT] Notification failed (non-fatal):', notifErr.message);
  }

  // Return the final contract state
  const { rows: finalRows } = await db.query(
    `SELECT * FROM contracts WHERE id = $1`,
    [contract.id]
  );

  return success(res, {
    contract:    finalRows[0],
    t1_released: !!t1Result,
    t1_amount:   t1Result?.netAmount || 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal: build the PDF, upload it, persist URL or error on the contract row.
// Always updates contracts.pdf_generated_at + clears/sets pdf_generation_error.
// Called by brandSign and by the regenerate endpoint.
// ─────────────────────────────────────────────────────────────────────────────
async function _generateAndStorePdf(contractId) {
  try {
    const { rows } = await db.query(`SELECT * FROM contracts WHERE id = $1`, [contractId]);
    if (!rows[0]) throw new Error('Contract not found');

    const pdfBuffer = await pdfService.generateContractPDF(rows[0]);
    const filename  = `contract_${contractId}.pdf`;
    const pdfUrl    = await storageService.uploadPDF(pdfBuffer, filename);

    await db.query(
      `UPDATE contracts
       SET pdf_url                 = $1,
           pdf_generated_at        = now(),
           pdf_generation_error    = NULL
       WHERE id = $2`,
      [pdfUrl, contractId]
    );
    return pdfUrl;
  } catch (err) {
    await db.query(
      `UPDATE contracts
       SET pdf_generation_error = $1,
           pdf_generated_at     = now()
       WHERE id = $2`,
      [err.message, contractId]
    ).catch(() => {});
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/contracts/:id/pdf — stream the contract as a PDF.
// Auth: brand or influencer party. Always regenerates from DB (no dependence
// on R2/local storage URLs being reachable from the client).
// ─────────────────────────────────────────────────────────────────────────────
const getContractPdf = asyncHandler(async (req, res) => {
  const contract = await getContractByIdOrThrow(req.params.id);
  assertPartyAccess(contract, req);

  const buffer = await pdfService.generateContractPDF(contract);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="contract_${contract.id}.pdf"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buffer);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/contracts/:id/regenerate-pdf — brand-only.
// Forces a fresh PDFKit generation + re-upload. Useful when the original
// generation failed (pdf_generation_error is set) or after contract edits.
// ─────────────────────────────────────────────────────────────────────────────
const regeneratePdf = asyncHandler(async (req, res) => {
  if (req.user.role !== 'brand') {
    throw new AppError('FORBIDDEN', 'Only brands can regenerate contract PDFs', 403);
  }
  const contract = await getContractByIdOrThrow(req.params.id);
  if (contract.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this contract', 403);
  }
  const pdfUrl = await _generateAndStorePdf(contract.id);
  return success(res, { pdf_url: pdfUrl });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/campaign-influencers/:ciId/retry-contract
// If contract auto-create failed at offer-accept time, brand or the influencer
// can retry it. Idempotent: returns the existing contract if one already exists.
// ─────────────────────────────────────────────────────────────────────────────
const retryContractCreate = asyncHandler(async (req, res) => {
  const ciId = req.params.ciId;

  // Auth — both parties allowed
  const { rows: ciRows } = await db.query(
    `SELECT ci.id,
            ci.status,
            cs.goal,
            inf.user_id  AS influencer_user_id,
            b.user_id    AS brand_user_id
     FROM   campaign_influencers ci
     JOIN   campaign_sets cs  ON cs.id  = ci.set_id
     JOIN   campaigns     c   ON c.id   = cs.campaign_id
     JOIN   brands        b   ON b.id   = c.brand_id
     JOIN   influencers   inf ON inf.id = ci.influencer_id
     WHERE  ci.id = $1`,
    [ciId]
  );
  if (!ciRows[0]) throw new AppError('NOT_FOUND', 'Campaign influencer not found', 404);
  const ci = ciRows[0];

  if (req.user.sub !== ci.brand_user_id && req.user.sub !== ci.influencer_user_id) {
    throw new AppError('FORBIDDEN', 'You are not a party to this offer', 403);
  }
  if ((ci.goal || '').toLowerCase() === 'conversion') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Conversion-only campaigns do not use contracts. The influencer earns commission on sales instead.',
      422
    );
  }
  if (!['accepted', 'contracted', 'active'].includes(ci.status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot retry contract creation while offer is in '${ci.status}' status. Influencer must accept first.`,
      422
    );
  }

  // If a contract already exists, just return it.
  const { rows: existingRows } = await db.query(
    `SELECT * FROM contracts WHERE campaign_influencer_id = $1`,
    [ciId]
  );
  if (existingRows[0]) {
    return success(res, { contract: existingRows[0], created: false });
  }

  // Retry — bubble up errors so caller sees real reason.
  const contractService = require('../services/contract.service');
  const created = await contractService.autoCreate(ciId);
  return success(res, { contract: created, created: !!created });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/contracts/:id/approve  (brand)
//
// Brand reviews the auto-created draft contract, optionally adds custom
// clauses + bonus, then sends it to the influencer.
//   draft → pending_influencer
//
// Body: { custom_clauses?: object, bonus_amount?: number }
// ─────────────────────────────────────────────────────────────────────────────
const approveContract = asyncHandler(async (req, res) => {
  if (req.user.role !== 'brand') {
    throw new AppError('FORBIDDEN', 'Only brands can approve contracts', 403);
  }
  const contract = await getContractByIdOrThrow(req.params.id);
  if (contract.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this contract', 403);
  }
  if (contract.status !== 'draft') {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot approve contract in '${contract.status}' status. Must be 'draft'.`,
      422
    );
  }

  const { custom_clauses, bonus_amount } = req.body || {};
  const bonus = parseFloat(bonus_amount) || 0;
  if (bonus < 0) {
    throw new AppError('VALIDATION_ERROR', 'bonus_amount must be 0 or positive', 422, 'bonus_amount');
  }

  // Persist clauses + bonus only. We deliberately do NOT touch
  // influencer_fee — it must keep its original meaning of "base agreed fee".
  // The total paid to the influencer (base + bonus) is derived everywhere it's
  // needed (escrow tranche math, PDF "Total Fee" line, mobile fee-breakdown
  // display). Mixing the two into a single column caused a cascading bug
  // where the brand mobile screen showed Base=3700 (the inflated total) and
  // then added the bonus on top → 4200 instead of the correct 3700.
  await db.query(
    `UPDATE contracts
     SET status         = 'pending_influencer',
         custom_clauses = $2,
         bonus_amount   = $3,
         approved_at    = now(),
         approved_by    = $4
     WHERE id = $1`,
    [
      contract.id,
      custom_clauses ? JSON.stringify(custom_clauses) : null,
      bonus,
      req.user.sub,
    ]
  );

  // Now notify the influencer their contract is ready to sign.
  try {
    await notificationService.send({
      userId:   contract.influencer_user_id,
      type:     'contract.ready',
      title:    'Contract Ready to Sign',
      body:     `Your contract for "${contract.campaign_name}" is ready. Review the terms and sign to begin.`,
      data:     { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id },
      fcmToken: contract.influencer_fcm_token,
      sendSms:  true,
      phone:    contract.influencer_phone,
    });
  } catch (notifErr) {
    console.error('[CONTRACT] approve notification failed:', notifErr.message);
  }

  // Regenerate PDF so the brand-side preview reflects new clauses + bonus
  _generateAndStorePdf(contract.id).catch(err =>
    console.error('[CONTRACT] PDF regen after approve failed:', err.message)
  );

  const { rows: fresh } = await db.query(`SELECT * FROM contracts WHERE id = $1`, [contract.id]);
  return success(res, { contract: fresh[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getContract,
  sign,
  brandSign,
  getContractPdf,
  regeneratePdf,
  retryContractCreate,
  approveContract,
};
