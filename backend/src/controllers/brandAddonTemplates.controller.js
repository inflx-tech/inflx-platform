'use strict';

/**
 * brandAddonTemplates.controller.js — reusable customisation templates
 * (migration 117). A brand-scoped library of saved add-on / variation groups
 * the owner re-applies to dishes (copy-on-apply; the Customise modal seeds a
 * fresh product group from the template's definition).
 *
 * Routes under /brands/me, requireRole('brand'):
 *   GET    /addon-templates
 *   POST   /addon-templates      (upsert by name)
 *   DELETE /addon-templates/:id
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getBrandIdByUserId(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

const listTemplates = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const { rows } = await db.query(
    `SELECT id, name, is_variation, definition
       FROM brand_addon_templates WHERE brand_id = $1
      ORDER BY is_variation DESC, name`,
    [brandId]
  );
  return success(res, { templates: rows });
});

// POST /brands/me/addon-templates — save (or update by name) a reusable group.
// Body: { name, is_variation, definition: { selection_type, is_required,
//         min_select, max_select, items:[{name, price, is_default}] } }
const createTemplate = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  const def = b.definition;
  if (!def || typeof def !== 'object') throw new AppError('VALIDATION_ERROR', 'definition is required', 422, 'definition');
  const items = Array.isArray(def.items) ? def.items.filter(it => it && String(it.name || '').trim()) : [];
  if (!items.length) throw new AppError('VALIDATION_ERROR', 'definition needs at least one option', 422, 'items');

  // Normalise the stored definition (don't trust extra client keys).
  const definition = {
    selection_type: b.is_variation ? 'single' : (def.selection_type === 'single' ? 'single' : 'multi'),
    is_required: b.is_variation ? true : def.is_required === true,
    min_select: b.is_variation ? 1 : (Number(def.min_select) || 0),
    max_select: b.is_variation ? 1 : (def.max_select != null && def.max_select !== '' ? Number(def.max_select) : null),
    items: items.map((it, i) => ({
      name: String(it.name).trim(),
      price: it.price === '' || it.price == null ? 0 : Number(it.price),
      is_default: it.is_default === true,
      sort_order: i,
    })),
  };

  const { rows } = await db.query(
    `INSERT INTO brand_addon_templates (brand_id, name, is_variation, definition)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (brand_id, lower(name))
       DO UPDATE SET is_variation = EXCLUDED.is_variation,
                     definition   = EXCLUDED.definition,
                     updated_at   = now()
     RETURNING id, name, is_variation, definition`,
    [brandId, name, b.is_variation === true, JSON.stringify(definition)]
  );
  return success(res, { template: rows[0] }, 201);
});

const deleteTemplate = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const { rows } = await db.query(
    `DELETE FROM brand_addon_templates WHERE id = $1 AND brand_id = $2 RETURNING id`,
    [req.params.id, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Template not found', 404);
  return success(res, { ok: true });
});

module.exports = { listTemplates, createTemplate, deleteTemplate };
