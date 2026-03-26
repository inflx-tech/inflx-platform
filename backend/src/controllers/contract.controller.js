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
       ci.posting_date    AS ci_posting_date,
       cs.campaign_id,
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

  const contract = await getContractByIdOrThrow(req.params.id);

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

  // Everything in one transaction for atomicity
  await db.withTransaction(async (client) => {
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

    // 3. Create 3 escrow entries
    const entries = await escrowService.createEscrowEntries(
      client,
      contract.campaign_influencer_id,
      contract.influencer_fee,
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

    // 5. Auto-create one reel deliverable
    await client.query(
      `INSERT INTO deliverables
         (campaign_influencer_id, type, status, submission_deadline, revision_limit)
       VALUES ($1, 'reel', 'pending', $2, $3)`,
      [
        contract.campaign_influencer_id,
        updatedContract.posting_date || null,
        updatedContract.revision_limit,
      ]
    );
  });

  // 6. Generate PDF (outside transaction — non-critical for DB integrity)
  let pdfUrl = null;
  try {
    // Re-fetch updated contract for PDF generation
    const { rows: freshRows } = await db.query(
      `SELECT * FROM contracts WHERE id = $1`,
      [contract.id]
    );
    const freshContract = freshRows[0];

    const pdfBuffer = await pdfService.generateContractPDF(freshContract);
    const filename  = `contract_${contract.id}.pdf`;
    pdfUrl = await storageService.uploadPDF(pdfBuffer, filename);

    // Store PDF URL on contract
    await db.query(
      `UPDATE contracts SET pdf_url = $1 WHERE id = $2`,
      [pdfUrl, contract.id]
    );
    updatedContract.pdf_url = pdfUrl;
  } catch (pdfErr) {
    console.error('[CONTRACT] PDF generation failed (non-fatal):', pdfErr.message);
    // Non-fatal: contract is active, PDF can be regenerated
  }

  // 7. Notify influencer that contract is now active + T1 released
  try {
    await notificationService.send({
      userId:   contract.influencer_user_id,
      type:     'contract.active',
      title:    'Contract Active — Payment Initiated',
      body:     `Your contract for campaign "${contract.campaign_name}" is now active. Tranche 1 payment of ₹${t1Result.netAmount.toFixed(2)} has been initiated.`,
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
    t1_released: true,
    t1_amount:   t1Result.netAmount,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { getContract, sign, brandSign };
