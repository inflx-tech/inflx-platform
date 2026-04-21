'use strict';

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Helper
async function getFollowerId(userId) {
  const { rows } = await db.query(`SELECT id FROM followers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);
  return rows[0].id;
}

// POST /follower/saved — save/bookmark an offer
const saveOffer = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);
  const { offer_id, influencer_id } = req.body;

  if (!offer_id) throw new AppError('VALIDATION_ERROR', 'offer_id is required', 422);

  await db.query(
    `INSERT INTO follower_saved_offers (follower_id, offer_id, influencer_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (follower_id, offer_id) DO NOTHING`,
    [followerId, offer_id, influencer_id || null]
  );

  return success(res, { saved: true }, 201);
});

// DELETE /follower/saved/:offer_id — unsave an offer
const unsaveOffer = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);

  await db.query(
    `DELETE FROM follower_saved_offers WHERE follower_id = $1 AND offer_id = $2`,
    [followerId, req.params.offer_id]
  );

  return success(res, { saved: false });
});

// GET /follower/saved — list saved offers with full details
const listSaved = asyncHandler(async (req, res) => {
  const followerId = await getFollowerId(req.user.sub);

  const { rows } = await db.query(
    `SELECT
       fso.offer_id,
       fso.influencer_id,
       fso.saved_at,
       co.offer_type,
       co.discount_value,
       co.availing_modes,
       co.prebook_advance,
       c.id AS campaign_id,
       c.name AS campaign_name,
       c.start_date,
       c.end_date,
       c.brand_id,
       b.business_name AS brand_name,
       b.category AS brand_category,
       u_b.city AS brand_city,
       cs.id AS set_id,
       ci.id AS campaign_influencer_id,
       ci.coupon_code,
       i.instagram_handle,
       u_i.name AS influencer_name,
       i.followers_count
     FROM follower_saved_offers fso
     JOIN campaign_offers co ON co.id = fso.offer_id
     JOIN campaigns c ON c.id = co.campaign_id
     JOIN brands b ON b.id = c.brand_id
     JOIN users u_b ON u_b.id = b.user_id
     JOIN campaign_sets cs ON cs.id = co.set_id
     LEFT JOIN campaign_influencers ci ON ci.set_id = cs.id AND ci.influencer_id = fso.influencer_id
       AND ci.status IN ('contracted','active','completed')
     LEFT JOIN influencers i ON i.id = fso.influencer_id
     LEFT JOIN users u_i ON u_i.id = i.user_id
     WHERE fso.follower_id = $1
       AND co.is_active = true
       AND c.status IN ('published','active','live')
       AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
     ORDER BY fso.saved_at DESC`,
    [followerId]
  );

  // Fetch products for each offer's brand
  const offers = [];
  for (const r of rows) {
    // Get first product for display
    const { rows: products } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag
       FROM brand_products WHERE brand_id = $1 AND is_active = true
       ORDER BY section, name LIMIT 3`,
      [r.brand_id]
    );

    // Get influencer note if available
    let note_text = null;
    if (r.influencer_id && r.campaign_id) {
      const { rows: notes } = await db.query(
        `SELECT note_text FROM influencer_product_notes
         WHERE influencer_id = $1 AND campaign_id = $2 LIMIT 1`,
        [r.influencer_id, r.campaign_id]
      );
      note_text = notes[0]?.note_text || null;
    }

    offers.push({
      offer_id: r.offer_id,
      offer_type: r.offer_type,
      discount_value: r.discount_value,
      availing_modes: r.availing_modes,
      prebook_advance: r.prebook_advance,
      saved_at: r.saved_at,
      brand: {
        id: r.brand_id,
        name: r.brand_name,
        category: r.brand_category,
        city: r.brand_city,
      },
      influencer: r.influencer_id ? {
        id: r.influencer_id,
        name: r.influencer_name,
        handle: r.instagram_handle,
        followers_count: r.followers_count,
        note_text,
      } : null,
      tracking: {
        campaign_id: r.campaign_id,
        set_id: r.set_id,
        offer_id: r.offer_id,
        campaign_influencer_id: r.campaign_influencer_id,
      },
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price || 0),
        image_url: p.image_url,
      })),
    });
  }

  return success(res, { saved: offers });
});

module.exports = { saveOffer, unsaveOffer, listSaved };
