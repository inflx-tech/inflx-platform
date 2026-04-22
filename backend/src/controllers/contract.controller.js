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
const env                 = require('../config/env');
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
       ci.commission_pct,
       ci.offer_type,
       ci.offer_config_json,
       ci.coupon_code,
       ci.posting_date    AS ci_posting_date,
       cs.campaign_id,
       cs.per_influencer_budget,
       cs.formats_json,
       cs.goal,
       cs.brief           AS set_brief,
       c.brand_id,
       c.brief            AS campaign_brief,
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

  // Look up contract by campaign_influencer_id. We also pull the set + campaign
  // brief + formats so the UI can auto-compose a structured Content
  // Requirements starter text for the brand to edit.
  const { rows } = await db.query(
    `SELECT
       con.*,
       ci.influencer_id,
       ci.coupon_code,
       ci.offer_type,
       ci.offer_config_json,
       ci.posting_date    AS ci_posting_date,
       cs.campaign_id,
       cs.goal            AS set_goal,
       cs.brief           AS set_brief,
       cs.formats_json    AS set_formats_json,
       c.brand_id,
       c.brief            AS campaign_brief,
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

  // Auto-compose the structured content-requirements starter text. If the
  // brand has already saved custom text, the client should prefer that.
  const suggested_content_requirements = _buildSuggestedContentRequirements({
    deliverables,
    formats_json:    contract.set_formats_json,
    set_brief:       contract.set_brief,
    campaign_brief:  contract.campaign_brief,
    posting_date:    contract.posting_date || contract.ci_posting_date,
    coupon_code:     contract.coupon_code,
    offer_type:      contract.offer_type,
    offer_config:    contract.offer_config_json,
  });

  // Strip internal join columns before returning
  const { influencer_user_id, brand_user_id, ...contractData } = contract;

  return success(res, { contract: contractData, deliverables, suggested_content_requirements });
});

/**
 * Compose a structured starter text for contract.content_requirements.
 * Includes deliverables list (from live rows OR formats_json fallback),
 * campaign/set brief, posting date, and coupon / offer details for
 * conversion campaigns. Brand can edit this freely before approving.
 */
function _buildSuggestedContentRequirements({ deliverables, formats_json, set_brief, campaign_brief, posting_date, coupon_code, offer_type, offer_config }) {
  const TYPE_LABELS = {
    reel: 'Instagram Reel',
    post: 'Instagram Post',
    story: 'Instagram Story',
    youtube_video: 'YouTube Video',
    youtube_short: 'YouTube Short',
  };

  // Collect deliverables. Prefer the live rows (brandSign already ran),
  // otherwise fall back to the set's formats_json which is what's promised.
  const counts = {};
  if (Array.isArray(deliverables) && deliverables.length > 0) {
    for (const d of deliverables) {
      counts[d.type] = (counts[d.type] || 0) + (parseInt(d.quantity, 10) || 1);
    }
  } else if (formats_json) {
    let parsed = formats_json;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }
    if (Array.isArray(parsed)) {
      for (const f of parsed) {
        if (!f) continue;
        if (typeof f === 'string') {
          const key = _canonicalType(f);
          counts[key] = (counts[key] || 0) + 1;
        } else {
          const rawType = f.type || f.name || f.label || 'reel';
          const key = _canonicalType(rawType);
          const c = Math.max(1, parseInt(f.count, 10) || 1);
          counts[key] = (counts[key] || 0) + c;
        }
      }
    }
  }

  const lines = [];

  const deliverableKeys = Object.keys(counts);
  if (deliverableKeys.length > 0) {
    lines.push('DELIVERABLES');
    for (const k of deliverableKeys) {
      const label = TYPE_LABELS[k] || k.replace(/_/g, ' ');
      lines.push(`- ${counts[k]} x ${label}`);
    }
    lines.push('');
  }

  const brief = (set_brief || campaign_brief || '').trim();
  if (brief) {
    lines.push('CAMPAIGN BRIEF');
    lines.push(brief);
    lines.push('');
  }

  if (posting_date) {
    const d = new Date(posting_date);
    if (!isNaN(d.getTime())) {
      lines.push('POSTING DATE');
      lines.push(`Due by ${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`);
      lines.push('');
    }
  }

  if (coupon_code) {
    lines.push('COUPON CODE');
    lines.push(`${coupon_code} \u2014 the influencer must mention this in the caption / stories so followers can claim the offer.`);
    lines.push('');
  }

  if (offer_type) {
    let offer = offer_config;
    if (typeof offer === 'string') {
      try { offer = JSON.parse(offer); } catch { offer = null; }
    }
    const valueLabel = offer && offer.value != null
      ? (offer_type === 'percentage' ? `${offer.value}%` : `Rs. ${offer.value}`)
      : null;
    lines.push('OFFER FOR FOLLOWERS');
    lines.push(valueLabel
      ? `${String(offer_type).replace(/_/g, ' ')} of ${valueLabel}.`
      : `${String(offer_type).replace(/_/g, ' ')}.`);
    lines.push('');
  }

  if (lines.length === 0) {
    return '';
  }

  lines.push('ADDITIONAL REQUIREMENTS');
  lines.push('(Brand: add specifics here — caption tags, hashtags, product placement, do\'s and don\'ts. Leave blank if none.)');

  return lines.join('\n');
}

function _canonicalType(raw) {
  const FORMAT_ALIAS = {
    'instagram reel':    'reel',
    'instagram post':    'post',
    'instagram story':   'story',
    'instagram stories': 'story',
    'youtube short':     'youtube_short',
    'youtube video':     'youtube_video',
  };
  const key = String(raw || 'reel').toLowerCase().trim();
  return FORMAT_ALIAS[key] || key.replace(/\s+/g, '_');
}

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
  // All values are RUPEES (migration 021).
  const platformFeePct  = parseFloat(contract.platform_fee_pct || 8);
  const lockAmount      = parseFloat((effectiveFee * (1 + platformFeePct / 100)).toFixed(2));
  const needsWalletLock = effectiveFee > 0;   // conversion-only contracts skip this

  if (needsWalletLock) {
    const { rows: brandWalletRows } = await db.query(
      `SELECT wallet_balance FROM brands WHERE id = $1`,
      [contract.brand_id]
    );
    const walletBalance = parseFloat(brandWalletRows[0]?.wallet_balance || 0);
    if (walletBalance < lockAmount) {
      throw new AppError(
        'WALLET_INSUFFICIENT',
        `Insufficient wallet balance to sign this contract. ` +
        `Need \u20B9${lockAmount.toFixed(2)} (\u20B9${effectiveFee.toFixed(2)} fee + ${platformFeePct}% platform fee). ` +
        `Available: \u20B9${walletBalance.toFixed(2)}. Top up your wallet first.`,
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
        const newBalance = parseFloat((currentBalance - lockAmount).toFixed(2));
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
            lockAmount,
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
    // Use the full joined row so the PDF generator has commission/offer/goal
    // data available — the raw contracts row doesn't carry those fields.
    const contract = await getContractByIdOrThrow(contractId);

    const pdfBuffer = await pdfService.generateContractPDF(contract);
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
// GET /v1/contracts/:id/pdf-url — either party.
//
// Ensures a PDF exists on R2 for this contract, then returns a short-lived
// presigned GET URL the client can fetch / render / hand to Google Docs
// Viewer without any Authorization header. Regenerates on demand if the
// stored key is stale (legacy URL format from the pre-M.1 code path).
//
// In R2_MOCK mode the signed URL isn't available — we fall back to the
// streaming /pdf route (client should pick that up from `fallback_url`).
// ─────────────────────────────────────────────────────────────────────────────
const getContractPdfUrl = asyncHandler(async (req, res) => {
  const contract = await getContractByIdOrThrow(req.params.id);
  assertPartyAccess(contract, req);

  let key = contract.pdf_url;
  // Legacy rows stored a full URL instead of a key — treat anything that
  // doesn't look like a contracts/ key as stale and regenerate.
  if (!key || !String(key).startsWith('contracts/')) {
    key = await _generateAndStorePdf(contract.id);
  }

  const signedUrl = await storageService.getPdfDownloadUrl(key, { expiresIn: 3600 });
  if (signedUrl) {
    return success(res, { url: signedUrl, expires_in: 3600, source: 'r2' });
  }

  // R2_MOCK — give the client the streaming endpoint as fallback. Auth
  // headers still needed in this mode.
  const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT}`;
  return success(res, {
    url:        `${baseUrl}/v1/contracts/${contract.id}/pdf`,
    expires_in: null,
    source:     'stream',
  });
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
  const key = await _generateAndStorePdf(contract.id);
  // Hand the caller a ready-to-open signed URL rather than the raw R2 key.
  const signedUrl = await storageService.getPdfDownloadUrl(key, { expiresIn: 3600 });
  return success(res, { pdf_key: key, url: signedUrl });
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
// clauses + bonus + content requirements, then sends it to the influencer.
//   draft                → pending_influencer  ("Approve & Send")
//   pending_influencer   → pending_influencer  ("Update & Re-send") — allowed
//                          only while the influencer has NOT yet signed.
//                          Saves the new terms, regenerates the PDF, and
//                          notifies the influencer to re-review.
//
// Body: {
//   custom_clauses?:       object,
//   bonus_amount?:         number,
//   content_requirements?: string,
// }
// ─────────────────────────────────────────────────────────────────────────────
const approveContract = asyncHandler(async (req, res) => {
  if (req.user.role !== 'brand') {
    throw new AppError('FORBIDDEN', 'Only brands can approve contracts', 403);
  }
  const contract = await getContractByIdOrThrow(req.params.id);
  if (contract.brand_user_id !== req.user.sub) {
    throw new AppError('FORBIDDEN', 'You do not own this contract', 403);
  }

  // Editable in draft (first approval) OR pending_influencer while the
  // influencer hasn't signed (brand forgot a clause / needs to add usage
  // rights). Once the influencer signs, the terms are locked.
  const isReApprove = contract.status === 'pending_influencer' && !contract.influencer_signed_at;
  const isFirstApprove = contract.status === 'draft';
  if (!isFirstApprove && !isReApprove) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Cannot edit contract in '${contract.status}' status. ` +
      (contract.influencer_signed_at
        ? 'The influencer has already signed — ask them to re-sign after you renegotiate.'
        : 'Contract must be draft or pending_influencer.'),
      422
    );
  }

  const { custom_clauses, bonus_amount, content_requirements } = req.body || {};
  const bonus = parseFloat(bonus_amount) || 0;
  if (bonus < 0) {
    throw new AppError('VALIDATION_ERROR', 'bonus_amount must be 0 or positive', 422, 'bonus_amount');
  }

  // Persist clauses + bonus + content requirements. We deliberately do NOT
  // touch influencer_fee — it must keep its original meaning of "base agreed
  // fee". The total paid to the influencer (base + bonus) is derived where
  // needed; mixing the two into one column caused a past bug.
  // content_requirements is pass-through text (the brand-web / mobile
  // composer pre-fills it with a structured "deliverables + brief + coupon"
  // block, but ultimately whatever the brand types wins).
  const normalisedRequirements = typeof content_requirements === 'string'
    ? content_requirements.trim()
    : null;

  await db.query(
    `UPDATE contracts
     SET status               = 'pending_influencer',
         custom_clauses       = $2,
         bonus_amount         = $3,
         content_requirements = COALESCE($4, content_requirements),
         approved_at          = now(),
         approved_by          = $5
     WHERE id = $1`,
    [
      contract.id,
      custom_clauses ? JSON.stringify(custom_clauses) : null,
      bonus,
      normalisedRequirements,
      req.user.sub,
    ]
  );

  // Notify the influencer. Copy differs for first approval vs re-send so
  // they know to re-review updated terms.
  try {
    await notificationService.send({
      userId:   contract.influencer_user_id,
      type:     isReApprove ? 'contract.updated' : 'contract.ready',
      title:    isReApprove ? 'Contract Updated' : 'Contract Ready to Sign',
      body:     isReApprove
        ? `The brand updated the contract for "${contract.campaign_name}". Please re-review the new terms before signing.`
        : `Your contract for "${contract.campaign_name}" is ready. Review the terms and sign to begin.`,
      data:     { screen: 'contract_detail', campaign_influencer_id: contract.campaign_influencer_id },
      fcmToken: contract.influencer_fcm_token,
      sendSms:  true,
      phone:    contract.influencer_phone,
    });
  } catch (notifErr) {
    console.error('[CONTRACT] approve notification failed:', notifErr.message);
  }

  // Regenerate PDF so both sides see the new clauses / bonus / requirements.
  _generateAndStorePdf(contract.id).catch(err =>
    console.error('[CONTRACT] PDF regen after approve failed:', err.message)
  );

  const { rows: fresh } = await db.query(`SELECT * FROM contracts WHERE id = $1`, [contract.id]);
  return success(res, { contract: fresh[0], re_approved: isReApprove });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getContract,
  sign,
  brandSign,
  getContractPdf,
  getContractPdfUrl,
  regeneratePdf,
  retryContractCreate,
  approveContract,
};
