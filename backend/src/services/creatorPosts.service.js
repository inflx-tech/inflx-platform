'use strict';

/**
 * creatorPosts.service.js — Creator posts (Post/Concept P2, mig 140).
 * Contract: features/concept-p2-posts/ · Architecture: POST_CONCEPT_MODEL.md §5-§7.
 *
 * The composer's four steps, server-side:
 *   scope   → the creator's active collaborations define the brand set
 *   concept → (template × leaf?) OR a collection; the PICKER runs the concept
 *             rule through the SAME library_products evaluator, intersected
 *             with the creator's live allocation from the scoped brands only —
 *             so "attached products satisfy the concept" holds BY CONSTRUCTION
 *             (create re-runs the picker server-side and rejects outsiders).
 *   media   → 1-10 image slides, keys under posts/<influencer_id>/ (presigned
 *             upload; served back via public /v1/media/post/:id redirects)
 *   tags    → (media_index, product_id, x%, y%) — coordinates only.
 *
 * Moderation: submitted → approved | rejected (admin only — founder lock;
 * brand is NOT in this path). "Dark" is never stored — P4 computes it live.
 */

const db = require('../config/db');
const concepts = require('./concepts.service');
const sectionLibrary = require('./sectionLibrary.service');
const { runRule } = require('./sectionRules.service');
const storage = require('./storage.service');
const notificationService = require('./notification.service');

const MAX_SLIDES = 10;
const MAX_PRODUCTS = 30;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const PICKER_LIMIT = 200;

// ── step 1: scope ────────────────────────────────────────────────────────────

/** Brands this creator may build posts from (contract-gated, same statuses as
 * the allocation query). */
async function collaborationBrands(influencerId) {
  const { rows } = await db.query(
    `SELECT DISTINCT b.id, b.business_name AS name, b.category, b.logo_url
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
       JOIN brands b         ON b.id  = c.brand_id
      WHERE ci.influencer_id = $1
        AND ci.status IN ('contracted','active','completed')
        AND c.status  IN ('published','active','live')
        AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      ORDER BY name`,
    [influencerId]);
  return rows;
}

/** Resolve + validate the effective brand set for a scope choice. */
async function resolveScopeBrands(influencerId, scope, brandIds) {
  const collabs = await collaborationBrands(influencerId);
  const collabIds = new Set(collabs.map(b => b.id));
  if (scope === 'all') return [...collabIds];
  const ids = Array.isArray(brandIds) ? brandIds.filter(id => collabIds.has(id)) : [];
  if (scope === 'single') {
    if (ids.length !== 1) throw new Error('single scope needs exactly one collaborated brand');
  } else if (scope === 'multi') {
    if (ids.length < 2) throw new Error('multi scope needs at least two collaborated brands');
  } else {
    throw new Error("scope must be 'single', 'multi' or 'all'");
  }
  return ids;
}

// ── step 2: the picker ───────────────────────────────────────────────────────

/** The product universe for (scope × concept-or-collection), RIGHT NOW.
 * Concept → concept rule ∩ scoped allocation. Collection → scoped allocation
 * only (no rule — family 6). Same evaluator as follower shelves. */
async function pickerProducts({ influencerId, scope, brandIds, templateId, categoryNodeId, collectionId }) {
  const scopedBrandIds = await resolveScopeBrands(influencerId, scope, brandIds);
  if (!scopedBrandIds.length) return { scoped_brand_ids: [], products: [] };

  let ruleDef = {};
  if (collectionId) {
    const cols = await concepts.listCollections({ includeHidden: false });
    if (!cols.some(c => c.id === collectionId)) throw new Error('collection not found or hidden');
    ruleDef = sectionLibrary.validateRule({});          // allocation only
  } else if (templateId) {
    const template = await concepts.getTemplate(templateId);
    if (!template || template.status !== 'active') throw new Error('template not found or hidden');
    if (template.kind === 'category' && !categoryNodeId) {
      throw new Error('category templates need a category node');
    }
    ruleDef = concepts.ruleJsonFor(template, categoryNodeId || null);
  } else {
    throw new Error('pick a concept template or a collection');
  }

  const products = await runRule('library_products', {
    ruleDef,
    influencer: { id: influencerId },
    allocBrandIds: scopedBrandIds,
    limit: PICKER_LIMIT,
  });
  return { scoped_brand_ids: scopedBrandIds, products };
}

// ── media presign + serve ────────────────────────────────────────────────────

function safeName(name) {
  return String(name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

async function buildUploadUrl(influencerId, { filename, content_type }) {
  const ct = String(content_type || '').toLowerCase();
  if (!IMAGE_MIMES.has(ct)) {
    throw new Error('Only JPEG/PNG/WebP images are accepted for posts (video arrives in a later phase).');
  }
  const key = `posts/${influencerId}/${Date.now()}_${Math.random().toString(16).slice(2, 10)}_${safeName(filename)}`;
  const upload = await storage.generateUploadUrl(key, ct);
  return { key, ...upload };
}

/** r2_key for a post_media row — public serve route resolves + redirects. */
async function mediaR2Key(mediaId) {
  const { rows } = await db.query(`SELECT r2_key FROM post_media WHERE id = $1`, [mediaId]);
  return rows[0] ? rows[0].r2_key : null;
}

function mediaUrl(mediaId) {
  const base = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_PUBLIC_URL || '';
  return `${base}/v1/media/post/${mediaId}`;
}

// ── create ───────────────────────────────────────────────────────────────────

async function createPost(influencerId, payload) {
  const p = payload && typeof payload === 'object' ? payload : {};

  // scope + universe (server-side re-run — the by-construction guarantee)
  const { scoped_brand_ids, products: allowed } = await pickerProducts({
    influencerId,
    scope: p.scope,
    brandIds: p.brand_ids,
    templateId: p.template_id || null,
    categoryNodeId: p.category_node_id || null,
    collectionId: p.collection_id || null,
  });
  const allowedIds = new Set(allowed.map(x => x.id));

  // concept XOR collection
  let conceptRow = null;
  if (p.collection_id && p.template_id) throw new Error('pick a concept OR a collection, not both');
  if (!p.collection_id) {
    conceptRow = await concepts.materializeConcept(p.template_id, p.category_node_id || null);
  }

  // media
  const media = Array.isArray(p.media) ? p.media : [];
  if (media.length < 1 || media.length > MAX_SLIDES) {
    throw new Error(`posts need 1-${MAX_SLIDES} image slides`);
  }
  const prefix = `posts/${influencerId}/`;
  for (const m of media) {
    if (!m || typeof m.r2_key !== 'string' || !m.r2_key.startsWith(prefix)) {
      throw new Error('media keys must come from your own post uploads');
    }
  }

  // attached products (the post's SHOP list — every post has one; "Shop the
  // post" renders from it) + OPTIONAL price-tag pins. A pin is an entry with
  // x/y coordinates and MUST reference a slide; a plain attachment has no
  // coordinates and no slide (media_id NULL). Founder sequence 2026-07-23:
  // select products first, pins are optional decoration over that selection.
  const tags = Array.isArray(p.products) ? p.products : [];
  if (tags.length < 1 || tags.length > MAX_PRODUCTS) {
    throw new Error(`attach 1-${MAX_PRODUCTS} products`);
  }
  for (const t of tags) {
    if (!t || !t.product_id) throw new Error('every entry needs a product_id');
    if (!allowedIds.has(t.product_id)) {
      throw new Error('a product is outside the selected concept/scope — refresh the picker');
    }
    const pinned = t.x_pct != null || t.y_pct != null;
    if (pinned) {
      if (t.x_pct == null || t.y_pct == null) throw new Error('a price tag needs both x_pct and y_pct');
      const slide = Number(t.media_index);
      if (!Number.isInteger(slide) || slide < 0 || slide >= media.length) {
        throw new Error('a price tag points at a slide that does not exist');
      }
      for (const k of ['x_pct', 'y_pct']) {
        const n = Number(t[k]);
        if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`${k} must be 0-100`);
      }
    }
  }

  const postType = ['lifestyle', 'editorial'].includes(p.post_type) ? p.post_type : 'lifestyle';
  const tagStyle = ['soft_editorial', 'minimal', 'hidden'].includes(p.tag_style) ? p.tag_style : 'soft_editorial';
  const caption = p.caption != null ? String(p.caption).slice(0, 2000) : null;

  return db.withTransaction(async (tx) => {
    const { rows: postRows } = await tx.query(
      `INSERT INTO creator_posts
         (influencer_id, scope, scoped_brand_ids, concept_id, collection_id,
          post_type, media_kind, tag_style, caption, status)
       VALUES ($1,$2,$3,$4,$5,$6,'image',$7,$8,'submitted')
       RETURNING id, status, created_at`,
      [influencerId, p.scope, scoped_brand_ids, conceptRow ? conceptRow.id : null,
       p.collection_id || null, postType, tagStyle, caption]);
    const post = postRows[0];

    const mediaIds = [];
    for (let i = 0; i < media.length; i += 1) {
      const m = media[i];
      const { rows } = await tx.query(
        `INSERT INTO post_media (post_id, slide_index, r2_key, width, height)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [post.id, i, m.r2_key, m.width || null, m.height || null]);
      mediaIds.push(rows[0].id);
    }
    for (const t of tags) {
      const pinned = t.x_pct != null && t.y_pct != null;
      await tx.query(
        `INSERT INTO post_products (post_id, media_id, product_id, x_pct, y_pct)
         VALUES ($1,$2,$3,$4,$5)`,
        [post.id, pinned ? mediaIds[Number(t.media_index)] : null, t.product_id,
         pinned ? Number(t.x_pct) : null,
         pinned ? Number(t.y_pct) : null]);
    }
    return { id: post.id, status: post.status, created_at: post.created_at,
             concept: conceptRow ? { id: conceptRow.id, name: conceptRow.name } : null };
  });
}

// ── read models ──────────────────────────────────────────────────────────────

async function hydratePosts(rows) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [{ rows: media }, { rows: prods }] = await Promise.all([
    db.query(
      `SELECT id, post_id, slide_index, r2_key, width, height
         FROM post_media WHERE post_id = ANY($1) ORDER BY post_id, slide_index`, [ids]),
    db.query(
      `SELECT pp.id, pp.post_id, pp.media_id, pp.product_id, pp.x_pct, pp.y_pct,
              bp.name, bp.price, bp.image_url, bp.is_active, bp.pushed_to_store,
              b.business_name AS brand_name
         FROM post_products pp
         JOIN brand_products bp ON bp.id = pp.product_id
         JOIN brands b ON b.id = bp.brand_id
        WHERE pp.post_id = ANY($1)`, [ids]),
  ]);
  const collections = await concepts.listCollections({ includeHidden: true });
  const colById = new Map(collections.map(c => [c.id, c]));

  const out = [];
  for (const r of rows) {
    const concept = r.concept_id ? await concepts.conceptDisplay(r.concept_id) : null;
    out.push({
      id: r.id,
      influencer: r.handle ? { id: r.influencer_id, handle: r.handle, name: r.influencer_name } : undefined,
      scope: r.scope,
      scoped_brand_ids: r.scoped_brand_ids,
      concept: concept ? { id: concept.id, name: concept.name, family: concept.family } : null,
      collection: r.collection_id
        ? { id: r.collection_id, name: (colById.get(r.collection_id) || {}).name || null } : null,
      post_type: r.post_type,
      tag_style: r.tag_style,
      caption: r.caption,
      status: r.status,
      reject_reason: r.reject_reason,
      created_at: r.created_at,
      media: media.filter(m => m.post_id === r.id).map(m => ({
        id: m.id, slide_index: m.slide_index, width: m.width, height: m.height,
        url: mediaUrl(m.id),
      })),
      products: prods.filter(t => t.post_id === r.id).map(t => ({
        id: t.id, media_id: t.media_id, product_id: t.product_id,
        x_pct: t.x_pct != null ? Number(t.x_pct) : null,
        y_pct: t.y_pct != null ? Number(t.y_pct) : null,
        name: t.name, price: t.price != null ? Number(t.price) : null,
        image_url: t.image_url, brand_name: t.brand_name,
        still_listed: t.is_active && t.pushed_to_store,
      })),
    });
  }
  return out;
}

async function listMyPosts(influencerId, { status, limit = 20, offset = 0 } = {}) {
  const params = [influencerId];
  let statusClause = '';
  if (status) { params.push(status); statusClause = ` AND status = $${params.length}`; }
  params.push(Math.min(Number(limit) || 20, 50), Math.max(Number(offset) || 0, 0));
  const { rows } = await db.query(
    `SELECT * FROM creator_posts
      WHERE influencer_id = $1${statusClause}
      ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params);
  return hydratePosts(rows);
}

// ── moderation (admin) ───────────────────────────────────────────────────────

async function listQueue({ status = 'submitted', limit = 30, offset = 0 } = {}) {
  if (!['draft', 'submitted', 'approved', 'rejected'].includes(status)) {
    throw new Error('bad status');
  }
  const { rows } = await db.query(
    `SELECT cp.*, i.instagram_handle AS handle, u.name AS influencer_name
       FROM creator_posts cp
       JOIN influencers i ON i.id = cp.influencer_id
       JOIN users u ON u.id = i.user_id
      WHERE cp.status = $1
      ORDER BY cp.created_at ASC
      LIMIT $2 OFFSET $3`,
    [status, Math.min(Number(limit) || 30, 100), Math.max(Number(offset) || 0, 0)]);
  const counts = await db.query(
    `SELECT status, count(*)::int AS n FROM creator_posts GROUP BY status`);
  return {
    posts: await hydratePosts(rows),
    counts: Object.fromEntries(counts.rows.map(r => [r.status, r.n])),
  };
}

async function decidePost(postId, adminUserId, approve, reason) {
  const { rows } = await db.query(
    `UPDATE creator_posts
        SET status = $2, reject_reason = $3, approved_by = $4,
            approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
            updated_at = now()
      WHERE id = $1 AND status = 'submitted'
      RETURNING id, influencer_id, status`,
    [postId, approve ? 'approved' : 'rejected',
     approve ? null : (String(reason || '').trim() || 'Not specified'), adminUserId]);
  const post = rows[0];
  if (!post) return null;

  // notify the creator (in-app + push; never blocks the decision)
  try {
    const { rows: u } = await db.query(
      `SELECT u.id FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
      [post.influencer_id]);
    if (u[0]) {
      await notificationService.send({
        userId: u[0].id,
        type: approve ? 'post.approved' : 'post.rejected',
        title: approve ? 'Post approved 🎉' : 'Post needs changes',
        body: approve
          ? 'Your post is approved and will appear in the follower app.'
          : `Your post was not approved: ${String(reason || '').trim() || 'see the app for details'}`,
        data: { post_id: post.id },
      });
    }
  } catch (e) { console.warn('[creatorPosts] notify (non-fatal):', e.message); }
  return post;
}

module.exports = {
  collaborationBrands,
  resolveScopeBrands,
  pickerProducts,
  buildUploadUrl,
  mediaR2Key,
  mediaUrl,
  createPost,
  listMyPosts,
  listQueue,
  decidePost,
};
