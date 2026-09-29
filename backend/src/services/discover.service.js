'use strict';

/**
 * discover.service — the ONE Discover layout (Stage B2).
 * Contract: features/concept-stageb-discover/ · board b1-discover.html.
 *
 * The layout stores INTENT (ordered rows); this resolver turns it into a
 * render-ready payload against LIVE data at read time:
 * - section rows → banners, each ONE concept/collection with its live
 *   visible-post count (same counting as the Inspector); empty banners drop,
 *   empty sections drop ("if exists show, if not hide").
 * - creator rows → influencers ranked by the row's rule
 *   (area → city match · following → this follower's follows · popularity →
 *   visible posts + followers), always falling back to popularity when the
 *   context can't satisfy the rule (no city / not logged in).
 * - business rows → brands ranked the same way via their single-brand posts.
 *
 * Row shapes (rows_json):
 *   { type:'section',      title, chips:[{label, banners:[{concept_id?|collection_id?, image_url?}]}] }
 *   { type:'creator_row',  title, rule:'area'|'following'|'popularity', limit? }
 *   { type:'business_row', title, rule:'area'|'popularity', limit? }
 * A section MAY have a single implicit chip (chips:[{label:null, banners}]).
 */

const db = require('../config/db');

// shoppable-posts-v2: new (v2) posts reach shoppers with the shopper app, not through these old readers.
const VISIBLE = `cp.status = 'approved' AND NOT cp.v2
  AND (cp.eligible_product_count IS NULL OR cp.eligible_product_count > 0)`;

// ── layout store ─────────────────────────────────────────────────────────────

async function getLayout(scope, creatorId = null) {
  const { rows } = creatorId
    ? await db.query(`SELECT * FROM discover_layouts WHERE scope = 'creator' AND creator_id = $1`, [creatorId])
    : await db.query(`SELECT * FROM discover_layouts WHERE scope = $1 AND creator_id IS NULL`, [scope]);
  return rows[0] || { scope, creator_id: creatorId, rows_json: [] };
}

async function putLayout(scope, rowsJson, creatorId = null) {
  if (!Array.isArray(rowsJson)) throw new Error('rows_json must be an array');
  const { rows } = creatorId
    ? await db.query(
        `INSERT INTO discover_layouts (scope, creator_id, rows_json)
         VALUES ('creator', $1, $2)
         ON CONFLICT (creator_id) WHERE creator_id IS NOT NULL
         DO UPDATE SET rows_json = EXCLUDED.rows_json, updated_at = now()
         RETURNING *`,
        [creatorId, JSON.stringify(rowsJson)])
    : await db.query(
        `INSERT INTO discover_layouts (scope, rows_json)
         VALUES ($1, $2)
         ON CONFLICT (scope) WHERE creator_id IS NULL
         DO UPDATE SET rows_json = EXCLUDED.rows_json, updated_at = now()
         RETURNING *`,
        [scope, JSON.stringify(rowsJson)]);
  return rows[0];
}

// ── banner resolution (live names + counts, one query per id set) ────────────

async function resolveBanners(banners, { brandId = null, creatorId = null } = {}) {
  const conceptIds = banners.map(b => b.concept_id).filter(Boolean);
  const collectionIds = banners.map(b => b.collection_id).filter(Boolean);

  // Optional scoping: business pages count only that brand's posts; creator
  // pages only that creator's. Global counts everything visible.
  const scopeCond = brandId ? `AND $2 = ANY(cp.scoped_brand_ids)` : creatorId ? `AND cp.influencer_id = $2` : '';
  const scopeArg = brandId || creatorId;

  const byConcept = new Map();
  if (conceptIds.length) {
    const params = scopeArg ? [conceptIds, scopeArg] : [conceptIds];
    const { rows } = await db.query(
      `SELECT co.id, ct.kind, ct.name_pattern, cn.name AS leaf_name,
              count(cp.id) FILTER (WHERE ${VISIBLE} ${scopeCond})::int AS visible,
              (array_agg(pm.id::text ORDER BY cp.created_at DESC)
                 FILTER (WHERE ${VISIBLE} ${scopeCond} AND pm.id IS NOT NULL))[1] AS cover_media_id
         FROM concepts co
         JOIN concept_templates ct ON ct.id = co.template_id
         LEFT JOIN category_nodes cn ON cn.id = co.category_node_id
         LEFT JOIN creator_posts cp ON cp.concept_id = co.id
         LEFT JOIN post_media pm ON pm.post_id = cp.id AND pm.slide_index = 0
        WHERE co.id = ANY($1::uuid[])
        GROUP BY co.id, ct.kind, ct.name_pattern, cn.name`,
      params);
    const { conceptName, familyOf } = require('./concepts.service');
    for (const r of rows) {
      byConcept.set(r.id, {
        name: conceptName({ kind: r.kind, name_pattern: r.name_pattern }, r.leaf_name),
        family: familyOf(r.kind, !!r.leaf_name),
        visible: r.visible,
        cover_media_id: r.cover_media_id,
      });
    }
  }

  const byCollection = new Map();
  if (collectionIds.length) {
    const params = scopeArg ? [collectionIds, scopeArg] : [collectionIds];
    const { rows } = await db.query(
      `SELECT col.id, col.name,
              count(cp.id) FILTER (WHERE ${VISIBLE} ${scopeCond})::int AS visible,
              (array_agg(pm.id::text ORDER BY cp.created_at DESC)
                 FILTER (WHERE ${VISIBLE} ${scopeCond} AND pm.id IS NOT NULL))[1] AS cover_media_id
         FROM collections col
         LEFT JOIN creator_posts cp ON cp.collection_id = col.id
         LEFT JOIN post_media pm ON pm.post_id = cp.id AND pm.slide_index = 0
        WHERE col.id = ANY($1::uuid[])
        GROUP BY col.id, col.name`,
      params);
    for (const r of rows) byCollection.set(r.id, { name: r.name, family: 6, visible: r.visible, cover_media_id: r.cover_media_id });
  }

  // B4 — a creator-picked lead post fronts its banner, but only while that
  // post is still visible (approved + eligible); otherwise the newest cover
  // silently takes over. Hidden banners (creator toggle) never render.
  const leadIds = banners.map(b => b.lead_post_id).filter(Boolean);
  const leadCover = new Map();
  if (leadIds.length) {
    const { rows } = await db.query(
      `SELECT cp.id, pm.id AS media_id
         FROM creator_posts cp
         JOIN post_media pm ON pm.post_id = cp.id AND pm.slide_index = 0
        WHERE cp.id = ANY($1::uuid[]) AND ${VISIBLE}`,
      [leadIds]);
    for (const r of rows) leadCover.set(r.id, r.media_id);
  }

  return banners
    .map(b => {
      if (b.hidden) return null;                   // creator toggled off
      let hit = b.concept_id ? byConcept.get(b.concept_id) : byCollection.get(b.collection_id);
      if (!hit || hit.visible <= 0) return null;   // auto-hide (the promise model)
      if (b.lead_post_id && leadCover.has(b.lead_post_id)) {
        hit = { ...hit, cover_media_id: leadCover.get(b.lead_post_id) };
      }
      return {
        concept_id: b.concept_id || null,
        collection_id: b.collection_id || null,
        title: b.title || hit.name,
        family: hit.family,
        post_count: hit.visible,
        image_url: b.image_url || null,   // admin banner art wins; else the app uses cover
        cta: b.cta || null,               // e.g. "Shop Now" — tap = the concept feed either way
        // The app draws the CTA as an OVERLAY chip at this spot — art made
        // outside (Canva etc.) just leaves that corner clear. Default: bottom-left.
        cta_pos: b.cta_pos || 'bottom-left',
        cover_url: hit.cover_media_id ? require('./creatorPosts.service').mediaUrl(hit.cover_media_id) : null,
      };
    })
    .filter(Boolean);
}

// ── category row (founder: the round category tiles) ────────────────────────
// Images come from the SAME source the Category Images admin page maintains
// (category_nodes.meta.image_url) — one image, every surface. Nodes without
// an image drop (auto-hide); admin's pick order is preserved.
async function resolveCategoryRow(row) {
  const ids = (row.category_ids || []).filter(Boolean);
  if (!ids.length) return [];
  const { rows } = await db.query(
    `SELECT id, name, meta->>'image_url' AS image_url
       FROM category_nodes WHERE id = ANY($1::uuid[])`, [ids]);
  const byId = new Map(rows.map(r => [r.id, r]));
  return ids.map(id => byId.get(id)).filter(c => c && c.image_url);
}

// ── rails ────────────────────────────────────────────────────────────────────

async function resolveCreators(rule, { city = null, followerId = null, brandId = null, limit = 12 }) {
  // Params are appended only when their clause is present — a dangling bind
  // makes Postgres reject the whole query.
  const params = [limit];
  let where = '';
  if (rule === 'area' && city) { params.push(city); where = `AND lower(i.city) = lower($${params.length})`; }
  else if (rule === 'following' && followerId) { params.push(followerId); where = `AND EXISTS (SELECT 1 FROM follower_follows ff WHERE ff.influencer_id = i.id AND ff.follower_id = $${params.length})`; }
  let brandCond = '';
  if (brandId) { params.push(brandId); brandCond = `AND $${params.length} = ANY(cp.scoped_brand_ids)`; }

  const { rows } = await db.query(
    `SELECT i.id, i.instagram_handle AS handle, i.profile_image_url AS avatar,
            i.city, i.verified, i.followers_count,
            count(cp.id) FILTER (WHERE ${VISIBLE} ${brandCond})::int AS visible_posts
       FROM influencers i
       LEFT JOIN creator_posts cp ON cp.influencer_id = i.id
      WHERE 1=1 ${where}
      GROUP BY i.id
     HAVING count(cp.id) FILTER (WHERE ${VISIBLE} ${brandCond}) > 0
      ORDER BY visible_posts DESC, i.followers_count DESC NULLS LAST
      LIMIT $1`,
    params);
  return rows;
}

async function resolveBusinesses(rule, { city = null, limit = 12 }) {
  const params = [limit];
  let where = '';
  if (rule === 'area' && city) { params.push(city); where = `AND lower(u.city) = lower($${params.length})`; }
  const { rows } = await db.query(
    `SELECT b.id, b.business_name AS name, u.city,
            count(cp.id) FILTER (WHERE ${VISIBLE})::int AS visible_posts,
            (array_agg(pm.id::text ORDER BY cp.created_at DESC)
               FILTER (WHERE ${VISIBLE} AND pm.id IS NOT NULL))[1] AS cover_media_id
       FROM brands b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN creator_posts cp ON b.id = ANY(cp.scoped_brand_ids)
       LEFT JOIN post_media pm ON pm.post_id = cp.id AND pm.slide_index = 0
      WHERE 1=1 ${where}
      GROUP BY b.id, u.city
     HAVING count(cp.id) FILTER (WHERE ${VISIBLE}) > 0
      ORDER BY visible_posts DESC
      LIMIT $1`,
    params);
  const { mediaUrl } = require('./creatorPosts.service');
  return rows.map(({ cover_media_id, ...r }) => ({
    ...r,
    cover_url: cover_media_id ? mediaUrl(cover_media_id) : null,
  }));
}

// ── the resolver ─────────────────────────────────────────────────────────────

async function resolveDiscover({ scope = 'global', brandId = null, creatorId = null, city = null, followerId = null }) {
  const layout = await getLayout(scope === 'business' ? 'business' : scope, creatorId);
  const rows = Array.isArray(layout.rows_json) ? layout.rows_json : [];
  const out = [];

  for (const row of rows) {
    if (row.hidden) continue;
    if (row.type === 'section') {
      const chips = [];
      for (const chip of (row.chips || [])) {
        const banners = await resolveBanners(chip.banners || [], { brandId, creatorId });
        if (banners.length) chips.push({ label: chip.label || null, banners });
      }
      if (chips.length) out.push({ type: 'section', title: row.title, chips });
    } else if (row.type === 'category_row') {
      const categories = await resolveCategoryRow(row);
      if (categories.length) out.push({ type: 'category_row', title: row.title, categories });
    } else if (row.type === 'creator_row') {
      const creators = await resolveCreators(row.rule || 'popularity', { city, followerId, brandId, limit: row.limit || 12 });
      if (creators.length) out.push({ type: 'creator_row', title: row.title, rule: row.rule || 'popularity', creators });
    } else if (row.type === 'business_row') {
      const businesses = await resolveBusinesses(row.rule || 'popularity', { city, limit: row.limit || 12 });
      if (businesses.length) out.push({ type: 'business_row', title: row.title, rule: row.rule || 'popularity', businesses });
    }
  }
  return { scope, rows: out, updated_at: layout.updated_at || null };
}

module.exports = { getLayout, putLayout, resolveDiscover };
