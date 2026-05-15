'use strict';

/**
 * lookbooks.controller.js — Fashion-2 creator-curated outfit collections.
 *
 * A lookbook = one creator's curated grid of products from one or more
 * brands they're affiliated with. "Aman's summer essentials" might pull a
 * top from Brand A, jeans from Brand B, shoes from Brand C, accessories
 * from Brand D. Followers tap → see the full look → tap any product →
 * buy with attribution credited to Aman.
 *
 * Endpoints (Fashion-2 V1):
 *   Public (no auth — same pattern as /store/:handle):
 *     GET /store/:influencer_handle/lookbooks            — list active lookbooks
 *     GET /store/:influencer_handle/lookbooks/:id        — single lookbook + products
 *
 *   Creator (influencer auth required):
 *     POST   /influencer/lookbooks                       — create
 *     GET    /influencer/lookbooks                       — list mine
 *     PATCH  /influencer/lookbooks/:id                   — update title/desc/cover/visibility
 *     DELETE /influencer/lookbooks/:id                   — soft-delete
 *     POST   /influencer/lookbooks/:id/products          — bulk replace products
 *     DELETE /influencer/lookbooks/:id/products/:pid     — remove one
 *
 * Fashion-2 ships the data model + public viewing. Creator-side authoring
 * uses these endpoints; UI for it (creator mobile app or admin-web on
 * behalf of creators) is the next phase. Lookbooks can be seeded via API
 * directly for test cohort purposes.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ── Public side ──────────────────────────────────────────────────────────────

/**
 * GET /store/:influencer_handle/lookbooks
 * Lists public lookbooks owned by the influencer. Returns the lookbook
 * meta + first 4 product thumbnails for the card preview (the "outfit
 * card" collage).
 */
const listPublic = asyncHandler(async (req, res) => {
  const handle = req.params.influencer_handle;

  // Resolve influencer
  const { rows: inf } = await db.query(
    `SELECT i.id FROM influencers i WHERE i.instagram_handle = $1`,
    [handle]
  );
  if (!inf[0]) throw new AppError('NOT_FOUND', 'Creator not found', 404);

  const { rows: lookbooks } = await db.query(
    `SELECT id, title, description, cover_image_url, product_count, created_at
       FROM creator_lookbooks
      WHERE influencer_id = $1
        AND is_active = true
        AND visibility = 'public'
      ORDER BY created_at DESC`,
    [inf[0].id]
  );

  if (lookbooks.length === 0) return success(res, { lookbooks: [] });

  // Preview thumbnails — first 4 product images per lookbook
  const ids = lookbooks.map(l => l.id);
  const { rows: previews } = await db.query(
    `SELECT lp.lookbook_id, lp.display_order, bp.image_url, bp.name
       FROM lookbook_products lp
       JOIN brand_products bp ON bp.id = lp.product_id
      WHERE lp.lookbook_id = ANY($1::uuid[])
      ORDER BY lp.lookbook_id, lp.display_order, lp.created_at`,
    [ids]
  );
  const previewsByLookbook = {};
  for (const p of previews) {
    if (!previewsByLookbook[p.lookbook_id]) previewsByLookbook[p.lookbook_id] = [];
    if (previewsByLookbook[p.lookbook_id].length < 4) {
      previewsByLookbook[p.lookbook_id].push({ image_url: p.image_url, name: p.name });
    }
  }

  const out = lookbooks.map(l => ({
    ...l,
    preview_products: previewsByLookbook[l.id] || [],
  }));
  return success(res, { lookbooks: out });
});

/**
 * GET /store/:influencer_handle/lookbooks/:id
 * Full lookbook detail: meta + ordered products + variant info + brand.
 */
const getPublic = asyncHandler(async (req, res) => {
  const { influencer_handle, id } = req.params;

  // Verify ownership-by-handle
  const { rows: header } = await db.query(
    `SELECT cl.*, i.instagram_handle, i.id AS influencer_id, u.name AS creator_name,
            i.profile_image_url AS creator_profile_pic
       FROM creator_lookbooks cl
       JOIN influencers i ON i.id = cl.influencer_id
       JOIN users u ON u.id = i.user_id
      WHERE cl.id = $1 AND cl.is_active = true AND i.instagram_handle = $2
        AND cl.visibility IN ('public', 'unlisted')`,
    [id, influencer_handle]
  );
  if (!header[0]) throw new AppError('NOT_FOUND', 'Lookbook not found', 404);

  // Products with variant info + brand context
  const { rows: products } = await db.query(
    `SELECT lp.id AS lookbook_product_id, lp.display_order, lp.creator_note,
            lp.variant_id, pv.size AS variant_size, pv.color AS variant_color,
            pv.price_override,
            bp.id AS product_id, bp.name AS product_name, bp.price AS product_price,
            bp.image_url AS product_image_url, bp.description AS product_description,
            bp.section AS product_section,
            b.id AS brand_id, b.business_name, b.category AS brand_category, u.city AS brand_city
       FROM lookbook_products lp
       JOIN brand_products bp ON bp.id = lp.product_id
       JOIN brands b ON b.id = bp.brand_id
       JOIN users u ON u.id = b.user_id
       LEFT JOIN product_variants pv ON pv.id = lp.variant_id
      WHERE lp.lookbook_id = $1
      ORDER BY lp.display_order, lp.created_at`,
    [id]
  );

  return success(res, {
    lookbook: header[0],
    products,
  });
});

// ── Creator side ─────────────────────────────────────────────────────────────

async function getInfluencerId(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

async function assertLookbookOwnership(lookbookId, influencerId) {
  const { rows } = await db.query(
    `SELECT id FROM creator_lookbooks WHERE id = $1 AND influencer_id = $2`,
    [lookbookId, influencerId]
  );
  if (!rows[0]) throw new AppError('FORBIDDEN', 'Not your lookbook', 403);
}

/**
 * POST /influencer/lookbooks
 * Body: { title, description?, cover_image_url?, visibility? }
 */
const createLookbook = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { title, description, cover_image_url, visibility } = req.body;
  if (!title || !title.trim()) {
    throw new AppError('VALIDATION_ERROR', 'title is required', 422);
  }

  const { rows } = await db.query(
    `INSERT INTO creator_lookbooks (influencer_id, title, description, cover_image_url, visibility)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [influencerId, title.trim(), description || null, cover_image_url || null, visibility || 'public']
  );
  return success(res, { lookbook: rows[0] }, 201);
});

/**
 * GET /influencer/lookbooks
 */
const listMine = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const { rows } = await db.query(
    `SELECT * FROM creator_lookbooks
      WHERE influencer_id = $1 AND is_active = true
      ORDER BY updated_at DESC, created_at DESC`,
    [influencerId]
  );
  return success(res, { lookbooks: rows });
});

/**
 * PATCH /influencer/lookbooks/:id
 */
const updateLookbook = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  await assertLookbookOwnership(req.params.id, influencerId);

  const allowed = ['title', 'description', 'cover_image_url', 'visibility'];
  const fields = [];
  const vals = [];
  for (const k of allowed) {
    if (req.body?.[k] !== undefined) {
      fields.push(`${k} = $${fields.length + 1}`);
      vals.push(req.body[k]);
    }
  }
  if (fields.length === 0) throw new AppError('VALIDATION_ERROR', 'No updatable fields', 422);
  fields.push(`updated_at = NOW()`);
  vals.push(req.params.id);

  const { rows } = await db.query(
    `UPDATE creator_lookbooks SET ${fields.join(', ')} WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  return success(res, { lookbook: rows[0] });
});

/**
 * DELETE /influencer/lookbooks/:id  — soft delete
 */
const deleteLookbook = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  await assertLookbookOwnership(req.params.id, influencerId);

  await db.query(
    `UPDATE creator_lookbooks SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  return success(res, { ok: true });
});

/**
 * POST /influencer/lookbooks/:id/products
 * Body: { products: [{ product_id, variant_id?, creator_note? }, ...] }
 * Bulk-replace semantics (same pattern as product variants).
 */
const replaceLookbookProducts = asyncHandler(async (req, res) => {
  const influencerId = await getInfluencerId(req.user.sub);
  if (!influencerId) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  await assertLookbookOwnership(req.params.id, influencerId);

  const products = Array.isArray(req.body?.products) ? req.body.products : [];
  for (const p of products) {
    if (!p.product_id) throw new AppError('VALIDATION_ERROR', 'product_id required for each entry', 422);
  }

  await db.withTransaction(async (client) => {
    await client.query(`DELETE FROM lookbook_products WHERE lookbook_id = $1`, [req.params.id]);
    let order = 0;
    for (const p of products) {
      await client.query(
        `INSERT INTO lookbook_products (lookbook_id, product_id, variant_id, display_order, creator_note)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, p.product_id, p.variant_id || null, order++, p.creator_note || null]
      );
    }
    await client.query(
      `UPDATE creator_lookbooks SET product_count = $1, updated_at = NOW() WHERE id = $2`,
      [products.length, req.params.id]
    );
  });

  return success(res, { product_count: products.length });
});

module.exports = {
  listPublic,
  getPublic,
  createLookbook,
  listMine,
  updateLookbook,
  deleteLookbook,
  replaceLookbookProducts,
};
