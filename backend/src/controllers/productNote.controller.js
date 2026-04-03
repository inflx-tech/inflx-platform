'use strict';

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Helper
async function getInfluencerId(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

// POST /influencers/me/product-notes — add/update note on a product
const upsertNote = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  const { product_id, campaign_id, note_text } = req.body;

  if (!product_id) throw new AppError('VALIDATION_ERROR', 'product_id is required', 422);
  if (!campaign_id) throw new AppError('VALIDATION_ERROR', 'campaign_id is required', 422);
  if (!note_text || !note_text.trim()) throw new AppError('VALIDATION_ERROR', 'note_text is required', 422);

  // Verify influencer is part of this campaign
  const { rows: ciRows } = await db.query(
    `SELECT ci.id FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     WHERE cs.campaign_id = $1 AND ci.influencer_id = $2
       AND ci.status IN ('contracted','active','completed')`,
    [campaign_id, influencerId]
  );
  if (!ciRows[0]) throw new AppError('FORBIDDEN', 'You are not part of this campaign', 403);

  // Verify product belongs to the campaign's brand
  const { rows: prodRows } = await db.query(
    `SELECT bp.id FROM brand_products bp
     JOIN campaigns c ON c.brand_id = bp.brand_id
     WHERE bp.id = $1 AND c.id = $2`,
    [product_id, campaign_id]
  );
  if (!prodRows[0]) throw new AppError('NOT_FOUND', 'Product not found in this campaign\'s brand', 404);

  const { rows } = await db.query(
    `INSERT INTO influencer_product_notes (influencer_id, product_id, campaign_id, note_text)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (influencer_id, product_id, campaign_id)
     DO UPDATE SET note_text = EXCLUDED.note_text, updated_at = now()
     RETURNING *`,
    [influencerId, product_id, campaign_id, note_text.trim()]
  );

  return success(res, { note: rows[0] }, 201);
});

// GET /influencers/me/product-notes/:campaign_id — get all notes for a campaign
const getNotes = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  const { campaign_id } = req.params;

  const { rows } = await db.query(
    `SELECT ipn.*, bp.name AS product_name, bp.price, bp.image_url
     FROM influencer_product_notes ipn
     JOIN brand_products bp ON bp.id = ipn.product_id
     WHERE ipn.influencer_id = $1 AND ipn.campaign_id = $2
     ORDER BY ipn.created_at DESC`,
    [influencerId, campaign_id]
  );

  return success(res, { notes: rows });
});

// DELETE /influencers/me/product-notes/:id — remove a note
const deleteNote = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);

  await db.query(
    `DELETE FROM influencer_product_notes WHERE id = $1 AND influencer_id = $2`,
    [req.params.id, influencerId]
  );

  return success(res, { deleted: true });
});

module.exports = { upsertNote, getNotes, deleteNote };
