'use strict';

/**
 * creatorImagery.service.js — Per-context creator imagery (Creator Experience
 * Engine Phase 7a, migrations 136-137). Contract: features/creator-imagery/.
 *
 * The ONE place that decides which image a product shows, by context:
 *   - creator store → that creator's approved shot (else brand image)
 *   - brand store   → the brand's chosen source IF that creator is still
 *                     contracted + approved (else brand image — collab-end
 *                     auto-withdraw), decision D locked with founder
 *   - flag off      → always the brand's own image_url (today's behavior)
 *
 * FLAG-GATED: CREATOR_IMAGERY (env, default off). Off ⇒ strict pass-through, so
 * every store is byte-for-byte unchanged until a brand opts in. Never throws.
 */

const db = require('../config/db');

function isEnabled() {
  return String(process.env.CREATOR_IMAGERY || '').toLowerCase() === 'on';
}

// Stable re-sign endpoint for a creator asset (served in 7b). Relative URL the
// app resolves against the media base — mirrors /v1/media/assets/:id.
function assetUrl(assetId) {
  return `/v1/media/creator-asset/${assetId}`;
}

// The best approved shot for (creator, product), or null.
async function approvedShot(influencerId, productId) {
  const { rows } = await db.query(
    `SELECT ca.id AS asset_id, ca.aspect
       FROM creator_product_images cpi
       JOIN creator_assets ca ON ca.id = cpi.asset_id
      WHERE cpi.influencer_id = $1 AND cpi.product_id = $2
        AND cpi.status = 'approved' AND ca.status = 'approved'
      ORDER BY cpi.approved_at DESC NULLS LAST LIMIT 1`,
    [influencerId, productId]);
  return rows[0] ? { url: assetUrl(rows[0].asset_id), aspect: rows[0].aspect } : null;
}

// Is the creator still in an active collaboration with the brand? (collab-end
// → withdraw from the brand store). 'completed'/declined/expired ⇒ withdraw.
async function stillContracted(influencerId, brandId) {
  const { rows } = await db.query(
    `SELECT 1 FROM campaign_influencers ci
       JOIN campaign_sets cset ON cset.id = ci.set_id
       JOIN campaigns cs ON cs.id = cset.campaign_id
      WHERE ci.influencer_id = $1 AND cs.brand_id = $2 AND ci.status IN ('contracted','active')
      LIMIT 1`, [influencerId, brandId]);
  return rows.length > 0;
}

/**
 * resolveProductImage(product, context) → image url.
 * product: { id, image_url, brand_id, display_image_source_influencer_id }
 * context: { context: 'brand'|'creator', influencerId? }
 */
async function resolveProductImage(product, context = {}) {
  const fallback = product && product.image_url;
  try {
    if (!isEnabled() || !product) return fallback;

    if (context.context === 'creator' && context.influencerId) {
      const shot = await approvedShot(context.influencerId, product.id);
      return shot ? shot.url : fallback;
    }

    if (context.context === 'brand') {
      const src = product.display_image_source_influencer_id;
      if (!src) return fallback;
      if (!(await stillContracted(src, product.brand_id))) return fallback; // auto-withdraw
      const shot = await approvedShot(src, product.id);
      return shot ? shot.url : fallback;
    }

    return fallback;
  } catch (e) {
    return fallback; // never break a store on an imagery miss
  }
}

// ── Creator (upload / tag) ───────────────────────────────────────────────────
async function createAsset(influencerId, body = {}) {
  if (!body.r2_key) { const e = new Error('r2_key required'); e.field = 'r2_key'; throw e; }
  const aspect = ['landscape', 'portrait', 'square'].includes(body.aspect) ? body.aspect : null;
  const { rows } = await db.query(
    `INSERT INTO creator_assets (influencer_id, r2_key, media_type, aspect, status)
     VALUES ($1,$2,$3,$4,'pending') RETURNING id, aspect, status`,
    [influencerId, body.r2_key, body.media_type || null, aspect]);
  return rows[0];
}

async function tagProduct(influencerId, assetId, productId) {
  const owns = (await db.query(`SELECT 1 FROM creator_assets WHERE id=$1 AND influencer_id=$2`, [assetId, influencerId])).rows[0];
  if (!owns) { const e = new Error('asset not found'); e.field = 'asset_id'; throw e; }
  const { rows } = await db.query(
    `INSERT INTO creator_product_images (influencer_id, product_id, asset_id, status)
     VALUES ($1,$2,$3,'pending')
     ON CONFLICT (influencer_id, product_id, asset_id) DO UPDATE SET status='pending'
     RETURNING id, product_id, asset_id, status`,
    [influencerId, productId, assetId]);
  return rows[0];
}

async function listMyAssets(influencerId) {
  const { rows } = await db.query(
    `SELECT ca.id, ca.aspect, ca.status,
            (SELECT count(*)::int FROM creator_product_images cpi WHERE cpi.asset_id=ca.id) AS tagged
       FROM creator_assets ca WHERE ca.influencer_id=$1 ORDER BY ca.created_at DESC`, [influencerId]);
  return rows;
}

// ── Brand (approve / choose source) ──────────────────────────────────────────
async function approvalQueue(brandId, status = 'pending') {
  const { rows } = await db.query(
    `SELECT cpi.id, cpi.status, cpi.asset_id, ca.aspect,
            bp.id AS product_id, bp.name AS product_name,
            i.id AS influencer_id, i.instagram_handle AS handle
       FROM creator_product_images cpi
       JOIN brand_products bp ON bp.id = cpi.product_id
       JOIN creator_assets ca ON ca.id = cpi.asset_id
       JOIN influencers i ON i.id = cpi.influencer_id
      WHERE bp.brand_id = $1 AND cpi.status = $2
      ORDER BY cpi.created_at DESC`, [brandId, status]);
  return rows.map((r) => ({
    id: r.id, status: r.status, aspect: r.aspect, url: assetUrl(r.asset_id),
    product: { id: r.product_id, name: r.product_name },
    creator: { id: r.influencer_id, handle: r.handle },
  }));
}

async function reviewImage(brandId, cpiId, approve) {
  const row = (await db.query(
    `SELECT cpi.id, cpi.asset_id FROM creator_product_images cpi
       JOIN brand_products bp ON bp.id = cpi.product_id
      WHERE cpi.id=$1 AND bp.brand_id=$2`, [cpiId, brandId])).rows[0];
  if (!row) return { notFound: true };
  const status = approve ? 'approved' : 'rejected';
  await db.query(`UPDATE creator_product_images SET status=$1, approved_at=CASE WHEN $1='approved' THEN now() ELSE approved_at END WHERE id=$2`, [status, cpiId]);
  if (approve) await db.query(`UPDATE creator_assets SET status='approved', approved_by=$1, approved_at=now() WHERE id=$2`, [brandId, row.asset_id]);
  return { status };
}

async function setImageSource(brandId, productId, influencerId) {
  const owns = (await db.query(`SELECT 1 FROM brand_products WHERE id=$1 AND brand_id=$2`, [productId, brandId])).rows[0];
  if (!owns) return { notFound: true };
  await db.query(`UPDATE brand_products SET display_image_source_influencer_id=$1 WHERE id=$2`, [influencerId || null, productId]);
  return { ok: true };
}

module.exports = { isEnabled, resolveProductImage, approvedShot, createAsset, tagProduct, listMyAssets, approvalQueue, reviewImage, setImageSource };
