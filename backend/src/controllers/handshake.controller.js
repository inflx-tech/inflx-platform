'use strict';

/**
 * handshake.controller.js — brand → creator collaboration requests, the creator's inbox,
 * and the admin limits.
 * Contract: features/collab-part2-precampaign-handshake
 *
 * Brand:
 *   POST   /v1/brands/me/collab-requests                    — send (direct | group | broadcast)
 *   POST   /v1/brands/me/collab-requests/broadcast-preview   — who would be reached
 *   GET    /v1/brands/me/collab-requests                     — sent, with status
 *   POST   /v1/brands/me/collab-requests/:id/accept          — accept the creator's counter
 *   POST   /v1/brands/me/collab-requests/:id/counter         — counter back
 *   POST   /v1/brands/me/collab-requests/:id/decline
 *   POST   /v1/brands/me/collab-requests/:id/withdraw
 *   GET    /v1/brands/me/agreements                          — ready to brief
 *
 * Creator:
 *   GET    /v1/influencers/me/collab-requests                — inbox
 *   POST   /v1/influencers/me/collab-requests/:id/accept
 *   POST   /v1/influencers/me/collab-requests/:id/counter
 *   POST   /v1/influencers/me/collab-requests/:id/decline
 *   GET    /v1/influencers/me/collab-preferences
 *   PATCH  /v1/influencers/me/collab-preferences
 *
 * Admin:
 *   GET    /v1/admin/handshake-settings
 *   PATCH  /v1/admin/handshake-settings
 *
 * The creator pitch in the other direction stays in proposal.controller — separate
 * records, deliberately. Both go through the same terms model and both produce the same
 * agreement.
 */

const db = require('../config/db');
const handshake = require('../services/handshake.service');
const settings = require('../services/handshakeSettings.service');
const terms = require('../services/collabTerms.model');
const notificationService = require('../services/notification.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getBrandOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT b.*, u.name AS user_name FROM brands b JOIN users u ON u.id = b.user_id WHERE u.id = $1`,
    [userId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0];
}

async function getInfluencerOrThrow(userId) {
  const { rows } = await db.query(
    `SELECT inf.*, u.id AS user_id, u.fcm_token, u.phone
       FROM influencers inf JOIN users u ON u.id = inf.user_id WHERE u.id = $1`,
    [userId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0];
}

/** Service errors carry a kind; map them to the API's error vocabulary. */
function rethrow(err) {
  if (err instanceof AppError) throw err;
  if (err.kind === 'validation') throw new AppError('VALIDATION_ERROR', err.message, 422, err.field);
  if (err.kind === 'blocked')    throw new AppError('VALIDATION_ERROR', err.message, 422, err.field);
  if (err.kind === 'notfound')   throw new AppError('NOT_FOUND', err.message, 404);
  throw err;
}

function notify(userId, fcmToken, phone, type, title, body, data, sms = false) {
  notificationService.send({ userId, type, title, body, data, fcmToken, sendSms: sms, phone })
    .catch(e => console.error('[HANDSHAKE] notify failed:', e.message));
}

/** Load a request and prove it belongs to this brand / this creator. */
async function ownedRequest(id, { brandId, influencerId }) {
  const req = await handshake.getRequest(id);
  if (!req) throw new AppError('NOT_FOUND', 'Request not found', 404);
  if (brandId && req.brand_id !== brandId) throw new AppError('NOT_FOUND', 'Request not found', 404);
  if (influencerId && req.influencer_id !== influencerId) throw new AppError('NOT_FOUND', 'Request not found', 404);
  return req;
}

/** The terms currently on the table — the original, or the latest counter over it. */
function currentTerms(req) {
  return req.counter_terms_json ? terms.settle(req.terms_json, req.counter_terms_json) : req.terms_json;
}

// ─── Brand: sending ─────────────────────────────────────────────────────────

const createRequests = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { influencer_id, group_id, filters, terms: termsJson, message, overrides } = req.body || {};

  const shape = terms.validateTerms(termsJson);
  if (!shape.ok) throw new AppError('VALIDATION_ERROR', shape.message, 422, shape.field);

  // Resolve the recipients for whichever of the three modes was used.
  let recipients = [];
  let origin = 'direct';
  let batchId = null;

  if (influencer_id) {
    recipients = [influencer_id];
  } else if (group_id) {
    origin = 'group';
    const { rows } = await db.query(
      `SELECT m.influencer_id FROM influencer_group_members m
        JOIN influencer_groups g ON g.id = m.group_id
       WHERE m.group_id = $1 AND g.brand_id = $2`,
      [group_id, brand.id]
    );
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'That group is empty or is not yours', 404, 'group_id');
    recipients = rows.map(r => r.influencer_id);
  } else if (filters) {
    origin = 'broadcast';
    const preview = await handshake.previewBroadcast(brand.id, filters);
    recipients = preview.recipients.map(r => r.id);
    if (recipients.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'No reachable creators match those filters right now.', 422, 'filters');
    }
    const { rows } = await db.query(`SELECT gen_random_uuid() AS id`);
    batchId = rows[0].id;
  } else {
    throw new AppError('VALIDATION_ERROR', 'Send to one creator, a group, or a set of filters', 422, 'influencer_id');
  }

  // Per-creator overrides let a brand pay one member of a group differently without
  // splitting the send into separate actions.
  const overrideFor = (id) => (overrides && overrides[id]) ? terms.settle(termsJson, overrides[id]) : termsJson;

  // Partial success is the honest outcome of a bulk send: one creator being over a
  // cooldown or muted must not fail the other twenty-nine. Each is reported.
  const sent = [];
  const skipped = [];
  for (const influencerId of recipients) {
    try {
      const created = await handshake.createBrandRequest({
        brandId: brand.id,
        influencerId,
        termsJson: overrideFor(influencerId),
        message,
        origin,
        groupId: group_id || null,
        batchId,
      });
      sent.push(created);
    } catch (err) {
      if (err.kind === 'blocked' || err.kind === 'validation') {
        skipped.push({ influencer_id: influencerId, reason: err.message });
      } else {
        throw err;
      }
    }
  }

  // Notify each creator who actually received one.
  for (const r of sent) {
    const { rows } = await db.query(
      `SELECT u.id AS user_id, u.fcm_token, u.phone FROM influencers i
         JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
      [r.influencer_id]
    );
    if (rows[0]) {
      notify(rows[0].user_id, rows[0].fcm_token, rows[0].phone,
        'collab_request.received',
        'A brand wants to work with you',
        `${brand.business_name} sent you a collaboration request.`,
        { screen: 'collab_request_detail', request_id: r.id }, true);
    }
  }

  return success(res, {
    sent_count: sent.length,
    skipped_count: skipped.length,
    requests: sent,
    skipped,                 // never silently dropped
    broadcast_batch_id: batchId,
  }, 201);
});

const broadcastPreview = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const preview = await handshake.previewBroadcast(brand.id, req.body?.filters || {});
  return success(res, preview);
});

const listBrandRequests = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const { status } = req.query;
  const params = [brand.id];
  let where = 'r.brand_id = $1';
  if (status) { params.push(status); where += ` AND r.status = $${params.length}`; }

  const { rows } = await db.query(
    `SELECT r.*, i.instagram_handle, i.followers_count, i.profile_image_url, u.name AS influencer_name
       FROM brand_collab_requests r
       JOIN influencers i ON i.id = r.influencer_id
       JOIN users u       ON u.id = i.user_id
      WHERE ${where}
      ORDER BY r.created_at DESC`,
    params
  );
  const cfg = await settings.get();
  return success(res, { requests: rows, counter_rounds_per_side: cfg.counter_rounds_per_side });
});

// ─── Responding (shared by both sides) ──────────────────────────────────────

/**
 * Accept whatever is currently on the table, and produce an agreement.
 * Either side can be the accepter: the brand accepting the creator's counter, or the
 * creator accepting the brand's opening terms or counter.
 */
async function acceptRequest(reqRow, acceptedBy) {
  const settled = currentTerms(reqRow);
  return handshake.acceptIntoAgreement({
    source: 'request',
    sourceId: reqRow.id,
    brandId: reqRow.brand_id,
    influencerId: reqRow.influencer_id,
    settledTerms: settled,
  }).catch(rethrow);
}

const brandAccept = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const reqRow = await ownedRequest(req.params.id, { brandId: brand.id });
  if (!handshake.ACTIVE_REQUEST_STATUSES.includes(reqRow.status)) {
    throw new AppError('VALIDATION_ERROR', `Cannot accept a request that is ${reqRow.status}`, 422);
  }
  const agreement = await acceptRequest(reqRow, 'brand');

  const { rows } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token, u.phone FROM influencers i
       JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
    [reqRow.influencer_id]
  );
  if (rows[0]) {
    notify(rows[0].user_id, rows[0].fcm_token, rows[0].phone,
      'collab_request.agreed',
      'Terms agreed',
      `${brand.business_name} agreed to your terms. They will send you the campaign details next.`,
      { screen: 'agreement_detail', agreement_id: agreement.id }, true);
  }
  return success(res, { agreement });
});

const creatorAccept = asyncHandler(async (req, res) => {
  const inf = await getInfluencerOrThrow(req.user.sub);
  const reqRow = await ownedRequest(req.params.id, { influencerId: inf.id });
  if (!handshake.ACTIVE_REQUEST_STATUSES.includes(reqRow.status)) {
    throw new AppError('VALIDATION_ERROR', `Cannot accept a request that is ${reqRow.status}`, 422);
  }
  const agreement = await acceptRequest(reqRow, 'creator');

  const { rows } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [reqRow.brand_id]
  );
  if (rows[0]) {
    notify(rows[0].user_id, rows[0].fcm_token, null,
      'collab_request.agreed',
      'Creator agreed',
      `@${inf.instagram_handle} agreed to your terms — they are ready to brief into a campaign.`,
      { screen: 'ready_to_brief', agreement_id: agreement.id });
  }
  return success(res, { agreement });
});

function makeCounter(side) {
  return asyncHandler(async (req, res) => {
    const actor = side === 'brand' ? await getBrandOrThrow(req.user.sub) : await getInfluencerOrThrow(req.user.sub);
    const reqRow = await ownedRequest(req.params.id,
      side === 'brand' ? { brandId: actor.id } : { influencerId: actor.id });

    const updated = await handshake.counterRequest({
      requestId: reqRow.id, side, counterTerms: req.body?.terms,
    }).catch(rethrow);

    // Tell the other side, with what is left of the negotiation.
    const cfg = await settings.get();
    const target = side === 'brand'
      ? await db.query(`SELECT u.id AS user_id, u.fcm_token, u.phone FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`, [reqRow.influencer_id])
      : await db.query(`SELECT u.id AS user_id, u.fcm_token FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`, [reqRow.brand_id]);
    if (target.rows[0]) {
      notify(target.rows[0].user_id, target.rows[0].fcm_token, target.rows[0].phone || null,
        'collab_request.countered', 'Counter offer',
        side === 'brand' ? 'The brand countered your terms.' : 'The creator countered your terms.',
        { screen: side === 'brand' ? 'collab_request_detail' : 'brand_request_detail', request_id: reqRow.id });
    }

    return success(res, {
      request: updated,
      counterable_terms: terms.counterableTerms(currentTerms(reqRow)),
      rounds_left: {
        brand: cfg.counter_rounds_per_side - Number(updated.brand_rounds_used),
        creator: cfg.counter_rounds_per_side - Number(updated.creator_rounds_used),
      },
    });
  });
}

function makeDecline(side) {
  return asyncHandler(async (req, res) => {
    const actor = side === 'brand' ? await getBrandOrThrow(req.user.sub) : await getInfluencerOrThrow(req.user.sub);
    const reqRow = await ownedRequest(req.params.id,
      side === 'brand' ? { brandId: actor.id } : { influencerId: actor.id });
    const updated = await handshake.declineRequest({
      requestId: reqRow.id, side, reason: req.body?.reason,
    }).catch(rethrow);
    return success(res, { request: updated });
  });
}

const withdrawRequest = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const reqRow = await ownedRequest(req.params.id, { brandId: brand.id });
  if (!handshake.ACTIVE_REQUEST_STATUSES.includes(reqRow.status)) {
    throw new AppError('VALIDATION_ERROR', `Cannot withdraw a request that is ${reqRow.status}`, 422);
  }
  const { rows } = await db.query(
    `UPDATE brand_collab_requests SET status = 'withdrawn', updated_at = now() WHERE id = $1 RETURNING *`,
    [reqRow.id]
  );
  return success(res, { request: rows[0] });
});

// ─── Creator: inbox and preferences ─────────────────────────────────────────

const listCreatorRequests = asyncHandler(async (req, res) => {
  const inf = await getInfluencerOrThrow(req.user.sub);
  const { rows } = await db.query(
    `SELECT r.*, b.business_name, b.logo_url, b.category AS brand_category
       FROM brand_collab_requests r
       JOIN brands b ON b.id = r.brand_id
      WHERE r.influencer_id = $1 AND r.status <> 'withdrawn'
      ORDER BY r.created_at DESC`,
    [inf.id]
  );

  // Mark unseen ones as viewed, so the brand can tell "ignored" from "not yet seen".
  const unseen = rows.filter(r => r.status === 'sent').map(r => r.id);
  if (unseen.length) {
    await db.query(
      `UPDATE brand_collab_requests SET status = 'viewed', viewed_at = now(), updated_at = now()
        WHERE id = ANY($1::uuid[]) AND status = 'sent'`,
      [unseen]
    );
  }

  const cfg = await settings.get();
  return success(res, {
    requests: rows.map(r => ({
      ...r,
      // The UI must know which fields to make editable — a requirement is not
      // counterable, and offering it as editable would invite a rejected counter.
      counterable_terms: terms.counterableTerms(currentTerms(r)),
      rounds_left: cfg.counter_rounds_per_side - Number(r.creator_rounds_used),
    })),
  });
});

const getPreferences = asyncHandler(async (req, res) => {
  const inf = await getInfluencerOrThrow(req.user.sub);
  return success(res, {
    preferences: {
      accepts_brand_requests: inf.accepts_brand_requests !== false,
      include_in_broadcasts:  inf.include_in_broadcasts !== false,
      min_commission_pct:     inf.min_commission_pct,
      min_fee:                inf.min_fee,
      accepted_aims:          inf.accepted_aims || [],
    },
  });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const inf = await getInfluencerOrThrow(req.user.sub);
  const b = req.body || {};
  const sets = [];
  const params = [inf.id];

  const put = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if (typeof b.accepts_brand_requests === 'boolean') put('accepts_brand_requests', b.accepts_brand_requests);
  if (typeof b.include_in_broadcasts === 'boolean')  put('include_in_broadcasts', b.include_in_broadcasts);
  if (b.min_commission_pct !== undefined) {
    if (b.min_commission_pct !== null && !(Number(b.min_commission_pct) >= 0 && Number(b.min_commission_pct) <= 100)) {
      throw new AppError('VALIDATION_ERROR', 'min_commission_pct must be between 0 and 100', 422, 'min_commission_pct');
    }
    put('min_commission_pct', b.min_commission_pct === null ? null : Number(b.min_commission_pct));
  }
  if (b.min_fee !== undefined) {
    if (b.min_fee !== null && !(Number(b.min_fee) >= 0)) {
      throw new AppError('VALIDATION_ERROR', 'min_fee cannot be negative', 422, 'min_fee');
    }
    put('min_fee', b.min_fee === null ? null : Number(b.min_fee));
  }
  if (b.accepted_aims !== undefined) {
    const aims = Array.isArray(b.accepted_aims) ? b.accepted_aims : [];
    const bad = aims.find(a => !terms.AIMS.includes(a));
    if (bad) throw new AppError('VALIDATION_ERROR', `accepted_aims must be from: ${terms.AIMS.join(', ')}`, 422, 'accepted_aims');
    put('accepted_aims', aims.length ? aims : null);
  }

  if (sets.length === 0) throw new AppError('VALIDATION_ERROR', 'No preferences to update', 422);

  const { rows } = await db.query(
    `UPDATE influencers SET ${sets.join(', ')} WHERE id = $1
     RETURNING accepts_brand_requests, include_in_broadcasts, min_commission_pct, min_fee, accepted_aims`,
    params
  );
  return success(res, { preferences: rows[0] });
});

// ─── Agreements ─────────────────────────────────────────────────────────────

const listAgreements = asyncHandler(async (req, res) => {
  const brand = await getBrandOrThrow(req.user.sub);
  const agreements = await handshake.listReadyToBrief(brand.id);
  return success(res, { agreements });
});

const listCreatorAgreements = asyncHandler(async (req, res) => {
  const inf = await getInfluencerOrThrow(req.user.sub);
  const { rows } = await db.query(
    `SELECT a.*, b.business_name, b.logo_url
       FROM collab_agreements a JOIN brands b ON b.id = a.brand_id
      WHERE a.influencer_id = $1 AND a.status IN ('ready','consumed')
      ORDER BY a.created_at DESC`,
    [inf.id]
  );
  return success(res, { agreements: rows });
});

// ─── Admin: the limits ──────────────────────────────────────────────────────

const getSettings = asyncHandler(async (req, res) => {
  const cfg = await settings.get({ fresh: true });
  return success(res, { settings: cfg, defaults: settings.DEFAULTS });
});

const patchSettings = asyncHandler(async (req, res) => {
  try {
    const row = await settings.update(req.body || {}, req.user.sub);
    return success(res, { settings: row });
  } catch (err) {
    if (err.field) throw new AppError('VALIDATION_ERROR', err.message, 422, err.field);
    throw err;
  }
});

module.exports = {
  // brand
  createRequests,
  broadcastPreview,
  listBrandRequests,
  brandAccept,
  brandCounter: makeCounter('brand'),
  brandDecline: makeDecline('brand'),
  withdrawRequest,
  listAgreements,
  // creator
  listCreatorRequests,
  creatorAccept,
  creatorCounter: makeCounter('creator'),
  creatorDecline: makeDecline('creator'),
  getPreferences,
  updatePreferences,
  listCreatorAgreements,
  // admin
  getSettings,
  patchSettings,
};
