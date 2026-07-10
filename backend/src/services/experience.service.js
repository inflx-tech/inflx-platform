'use strict';

/**
 * experience.service.js — Creator Experiences (Creator Experience Engine Phase 6a,
 * migration 135). Creator CRUD + publish-validation, and resolveForTemplate()
 * which FILLS the P5 'experience_template' rule: published experiences → render
 * specs (reusing the pure renderSpec.service from 4a). v1 featured_image_url;
 * Asset Pack = Phase 7.
 */

const db = require('../config/db');
const rs = require('./renderSpec.service');
const imagery = require('./creatorImagery.service');

const EXP_COLS = `id, influencer_id, world_key, template_key, theme_key, brand_id, featured_image_url, status, created_at, updated_at`;

const bad = (msg, field) => { const e = new Error(msg); e.field = field; throw e; };

// Resolve a preset's token values (palette/typography/background/radius/shadow).
async function resolveTokens(presetKey) {
  const base = { palette: {}, typography: {}, background: {}, radius: 12, shadow: 'soft' };
  if (!presetKey) return base;
  const preset = (await db.query(`SELECT tokens_json FROM design_presets WHERE key=$1 LIMIT 1`, [presetKey])).rows[0];
  const tk = (preset && preset.tokens_json) || {};
  const { rows } = await db.query(
    `SELECT kind, config_json FROM design_tokens
      WHERE (kind='palette' AND key=$1) OR (kind='typography' AND key=$2)
         OR (kind='background' AND key=$3) OR (kind='radius' AND key=$4)`,
    [tk.palette || '', tk.typography || '', tk.background || '', tk.radius || '']);
  const byKind = {};
  for (const r of rows) byKind[r.kind] = r.config_json;
  return {
    palette: byKind.palette || {}, typography: byKind.typography || {}, background: byKind.background || {},
    radius: (byKind.radius && byKind.radius.px) || 12, shadow: tk.shadow || 'soft',
  };
}

// Templates a creator can use in a world (published + placed).
async function listAvailableTemplates(worldKey) {
  const { rows } = await db.query(
    `SELECT t.id, t.key, t.name, t.theme_key, t.design_layout_key, t.section_style,
            th.default_title, th.default_subtitle, th.default_cta,
            th.min_products, th.max_products, th.media_rules_json
       FROM experience_templates t
       LEFT JOIN experience_themes th ON th.world_key=t.world_key AND th.key=t.theme_key
      WHERE t.world_key=$1 AND t.status='placed'
      ORDER BY t.updated_at DESC`, [String(worldKey || '').toLowerCase()]);
  return rows.map((r) => ({
    id: r.id, key: r.key, name: r.name, theme_key: r.theme_key,
    design_layout_key: r.design_layout_key, section_style: r.section_style,
    theme: { title: r.default_title, subtitle: r.default_subtitle, cta: r.default_cta,
      min_products: r.min_products, max_products: r.max_products, media_rules: r.media_rules_json },
  }));
}

// Products a creator may add: from brands they are contracted with.
async function listStockable(influencerId, worldKey) {
  const { rows } = await db.query(
    `SELECT DISTINCT bp.id, bp.name, bp.price, bp.image_url, bp.brand_id
       FROM brand_products bp
      WHERE bp.brand_id IN (
        SELECT DISTINCT cs.brand_id
          FROM campaign_influencers ci
          JOIN campaign_sets cset ON cset.id = ci.set_id
          JOIN campaigns cs ON cs.id = cset.campaign_id
         WHERE ci.influencer_id = $1 AND ci.status IN ('contracted','active','completed'))
      ORDER BY bp.created_at DESC NULLS LAST
      LIMIT 60`, [influencerId]);
  return rows;
}

async function getExperience(id) {
  const { rows } = await db.query(`SELECT ${EXP_COLS} FROM creator_experiences WHERE id=$1`, [id]);
  return rows[0] || null;
}

async function listMyExperiences(influencerId) {
  const { rows } = await db.query(
    `SELECT e.${''}${EXP_COLS.split(', ').map((c) => 'e.' + c).join(', ')},
            (SELECT count(*)::int FROM experience_products ep WHERE ep.experience_id=e.id) AS product_count
       FROM creator_experiences e WHERE e.influencer_id=$1 ORDER BY e.updated_at DESC`, [influencerId]);
  return rows;
}

async function createExperience(influencerId, body = {}) {
  const t = (await db.query(`SELECT world_key, key, theme_key FROM experience_templates WHERE id=$1`, [body.template_id])).rows[0];
  if (!t) bad('unknown template', 'template_id');
  const productIds = Array.isArray(body.product_ids) ? body.product_ids.filter(Boolean) : [];

  // primary brand = first valid product's brand
  let brandId = null;
  if (productIds.length) {
    const b = (await db.query(`SELECT brand_id FROM brand_products WHERE id=$1`, [productIds[0]])).rows[0];
    brandId = b ? b.brand_id : null;
  }

  const exp = (await db.query(
    `INSERT INTO creator_experiences (influencer_id, world_key, template_key, theme_key, brand_id, featured_image_url, status)
     VALUES ($1,$2,$3,$4,$5,$6,'draft') RETURNING ${EXP_COLS}`,
    [influencerId, t.world_key, t.key, t.theme_key, brandId, body.featured_image_url || null])).rows[0];

  for (let i = 0; i < productIds.length; i++) {
    await db.query(
      `INSERT INTO experience_products (experience_id, product_id, display_order) VALUES ($1,$2,$3)`,
      [exp.id, productIds[i], i]);
  }
  exp.product_count = productIds.length;
  return exp;
}

async function publishExperience(id, influencerId) {
  const e = await getExperience(id);
  if (!e || e.influencer_id !== influencerId) return { notFound: true };

  const theme = (await db.query(
    `SELECT min_products, max_products, media_rules_json FROM experience_themes
      WHERE world_key=$1 AND key=$2 ORDER BY is_blueprint ASC LIMIT 1`, [e.world_key, e.theme_key])).rows[0] || {};
  const count = (await db.query(`SELECT count(*)::int n FROM experience_products WHERE experience_id=$1`, [id])).rows[0].n;

  const min = theme.min_products || 1;
  if (count < min) return { error: { field: 'product_ids', message: `This theme needs at least ${min} products (you have ${count}).` } };
  const media = theme.media_rules_json || {};
  if (media.featured === 'required' && !e.featured_image_url) return { error: { field: 'featured_image_url', message: 'A featured image is required.' } };

  const { rows } = await db.query(`UPDATE creator_experiences SET status='published', updated_at=now() WHERE id=$1 RETURNING ${EXP_COLS}`, [id]);
  return { experience: rows[0] };
}

// ── FILL the P5 rule: published experiences for a template → render items ────
// Defensive: any bad experience is skipped, never throws (keeps the feed safe).
async function resolveForTemplate(templateId, limit = 12) {
  if (!templateId) return [];
  try {
    const t = (await db.query(
      `SELECT id, world_key, key, theme_key, design_layout_key FROM experience_templates WHERE id=$1`, [templateId])).rows[0];
    if (!t) return [];
    const theme = (await db.query(
      `SELECT preset_key, default_title, default_subtitle, default_cta FROM experience_themes
        WHERE world_key=$1 AND key=$2 ORDER BY is_blueprint ASC LIMIT 1`, [t.world_key, t.theme_key])).rows[0] || {};
    const layout = (await db.query(`SELECT contract_json, aspect_hint FROM design_layouts WHERE key=$1 LIMIT 1`, [t.design_layout_key])).rows[0];
    if (!layout) return [];
    const tokens = await resolveTokens(theme.preset_key);
    const copy = { title: theme.default_title, subtitle: theme.default_subtitle, cta: theme.default_cta };

    const exps = (await db.query(
      `SELECT e.id, e.featured_image_url, e.influencer_id,
              i.full_name AS creator_name, i.instagram_handle AS handle
         FROM creator_experiences e JOIN influencers i ON i.id=e.influencer_id
        WHERE e.world_key=$1 AND e.template_key=$2 AND e.status='published'
        ORDER BY e.updated_at DESC LIMIT $3`, [t.world_key, t.key, limit])).rows;

    const items = [];
    for (const e of exps) {
      try {
        const products = (await db.query(
          `SELECT bp.id, bp.name, bp.price, bp.image_url FROM experience_products ep
             JOIN brand_products bp ON bp.id=ep.product_id
            WHERE ep.experience_id=$1 ORDER BY ep.display_order LIMIT 12`, [e.id])).rows;
        const featAspect = rs.desiredAspect(layout.aspect_hint);

        // Phase 7 — when creator imagery is enabled, products wear the creator's
        // approved shots and the featured pack is their real (aspect-tagged)
        // photography. Flag OFF ⇒ isEnabled() short-circuits, no extra queries.
        let featured_images = e.featured_image_url ? [{ url: e.featured_image_url, aspect: featAspect }] : [];
        if (imagery.isEnabled()) {
          const shots = [];
          for (const p of products) {
            p.image_url = await imagery.resolveProductImage({ id: p.id, image_url: p.image_url }, { context: 'creator', influencerId: e.influencer_id });
            const shot = await imagery.approvedShot(e.influencer_id, p.id);
            if (shot) shots.push(shot);
          }
          if (shots.length) featured_images = shots;
        }

        const pack = {
          creator_name: e.creator_name || e.handle || 'Creator',
          avatar_url: null,
          featured_images,
          offer_badge: null,
          products,
        };
        const ctx = { pack, tokens, copy };
        const resolved = rs.resolveSlots(layout.contract_json, ctx);
        const featured = rs.pickFeatured(layout.aspect_hint, pack.featured_images);
        items.push({
          entity_type: 'experience', id: e.id,
          title: `${pack.creator_name}'s ${copy.title || ''}`.trim(),
          render_spec: {
            theme: { title: copy.title, subtitle: copy.subtitle, cta: copy.cta },
            design: { layout_key: t.design_layout_key, aspect_hint: layout.aspect_hint, contract: layout.contract_json },
            tokens, pack,
            resolved: { visible_slots: resolved.visible_slots, featured_pick: featured, blocked: resolved.blocked, missing: resolved.missing },
          },
          via_creator: { id: e.influencer_id, handle: e.handle, name: e.creator_name },
        });
      } catch (inner) { /* skip a bad experience — never break the feed */ }
    }
    return items;
  } catch (e) {
    console.warn('[experience] resolveForTemplate failed:', e.message);
    return [];
  }
}

module.exports = {
  listAvailableTemplates, listStockable, getExperience, listMyExperiences,
  createExperience, publishExperience, resolveForTemplate,
};
