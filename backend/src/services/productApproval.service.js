'use strict';

/**
 * productApproval.service.js — the admin switch over a brand's published products.
 * Contract: features/product-approval-switch (spec §3–5, decisions D1–D10).
 *
 * `pushed_to_store` stays the ONE live flag that every shopper, creator, offer and discovery
 * reader already tests. This service only decides WHEN it may become true:
 *
 *   switch OFF  → a publish sets pushed_to_store = true at once (today's behaviour)
 *   switch ON   → a publish of a product never approved leaves pushed_to_store = false and marks
 *                 it `pending`; an admin's approve flips it; send back marks it `rejected` with
 *                 a note; the brand hiding a waiting product marks it `withdrawn`
 *
 * Invariant: pushed_to_store = true only while approval_status = 'approved'.
 * A product approved once stays approved (D4). Turning the switch off releases every waiting
 * product (D7).
 */

const db = require('../config/db');
const settings = require('./platformSettings.service');
const notificationService = require('./notification.service');

const KEY = 'product_approval_required';
const RELEASED_NOTE = 'released: approval switched off';

/** Is the switch on? A failed read answers NO: a settings outage must never block a publish. */
async function required() {
  try { return Number(await settings.get(KEY)) === 1; } catch { return false; }
}

/** What the brand's screens are told about a row. */
function approvalOf(p) {
  if (!p) return null;
  return {
    status: p.approval_status || 'approved',
    waiting: p.approval_status === 'pending',
    note: p.approval_status === 'rejected' ? (p.approval_note || null) : null,
    requested_at: p.approval_requested_at || null,
  };
}

/**
 * The three columns a CREATE writes. `wantPushed` is what the brand asked for (undefined = yes).
 * A product created hidden while the switch is on is `withdrawn`, never `approved`, so showing it
 * later goes through the queue like any other (spec §4).
 */
async function onCreate(wantPushed) {
  const pushed = wantPushed !== false;
  if (!(await required())) return { pushed_to_store: pushed, approval_status: 'approved', approval_requested_at: null };
  if (!pushed) return { pushed_to_store: false, approval_status: 'withdrawn', approval_requested_at: null };
  return { pushed_to_store: false, approval_status: 'pending', approval_requested_at: new Date() };
}

/**
 * The brand's Show / Hide on an existing row (`existing` carries approval_status). Returns the
 * column updates to merge into the save, and the approval the response should carry.
 */
async function onShowHide(existing, wantPushed) {
  const status = (existing && existing.approval_status) || 'approved';
  if (!wantPushed) {
    const updates = { pushed_to_store: false };
    if (status === 'pending') updates.approval_status = 'withdrawn';
    return { updates, approval: approvalOf({ ...existing, ...updates }) };
  }
  if (status === 'approved' || !(await required())) {
    // Approved once, or no permission needed: live at once. A product left pending / rejected /
    // withdrawn from when the switch was on is approved by this Show, because nothing requires
    // permission now.
    const updates = { pushed_to_store: true, approval_status: 'approved', approval_note: null };
    return { updates, approval: approvalOf({ ...existing, ...updates }) };
  }
  const updates = { pushed_to_store: false, approval_status: 'pending', approval_requested_at: new Date(), approval_note: null };
  return { updates, approval: approvalOf({ ...existing, ...updates }) };
}

const QUEUE_SELECT = `
  SELECT bp.id, bp.name, bp.price, bp.sku, bp.stock, bp.is_active, bp.pushed_to_store, bp.description,
         bp.image_url, bp.variants_json, bp.facets, bp.section, bp.category_key,
         bp.approval_status, bp.approval_requested_at, bp.approval_decided_at, bp.approval_note, bp.created_at,
         b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category, b.user_id AS brand_user_id,
         cn.name AS leaf_name, cn.segment AS leaf_segment, cn.category AS leaf_category,
         ad.name AS decided_by_name
    FROM brand_products bp
    JOIN brands b ON b.id = bp.brand_id
    LEFT JOIN category_nodes cn ON cn.id = bp.category_node_id
    LEFT JOIN users ad ON ad.id = bp.approval_decided_by`;

function mapRow(r) {
  const { resolveProductImage } = require('../utils/productImage');
  let image = r.image_url;
  try { image = resolveProductImage(r) || r.image_url || null; } catch { /* keep the raw cover */ }
  return {
    id: r.id, name: r.name, price: r.price == null ? null : Number(r.price), sku: r.sku,
    stock: r.stock == null ? null : Number(r.stock), is_active: r.is_active, pushed_to_store: r.pushed_to_store,
    description: r.description, image_url: image, section: r.section,
    category: [r.leaf_segment, r.leaf_category, r.leaf_name].filter(Boolean).join(' › ') || r.section || r.category_key || null,
    approval_status: r.approval_status, approval_requested_at: r.approval_requested_at,
    approval_decided_at: r.approval_decided_at, approval_note: r.approval_note, decided_by: r.decided_by_name || null,
    created_at: r.created_at,
    brand: { id: r.brand_id, name: r.brand_name, category: r.brand_category },
  };
}

/**
 * Admin list. `status`: pending (waiting, oldest first) · approved (decided by an admin, newest
 * decision first — NOT every approved product on the platform) · rejected.
 */
async function listQueue({ status = 'pending', limit = 50, offset = 0 } = {}) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  let where; let order;
  switch (status) {
    case 'pending': where = `bp.approval_status = 'pending'`; order = `bp.approval_requested_at ASC NULLS LAST, bp.created_at ASC`; break;
    case 'approved': where = `bp.approval_status = 'approved' AND bp.approval_decided_at IS NOT NULL`; order = `bp.approval_decided_at DESC`; break;
    case 'rejected': where = `bp.approval_status = 'rejected'`; order = `bp.approval_decided_at DESC NULLS LAST`; break;
    default: throw new Error(`unknown status: ${status}`);
  }
  const [{ rows }, { rows: [c] }] = await Promise.all([
    db.query(`${QUEUE_SELECT} WHERE ${where} ORDER BY ${order} LIMIT $1 OFFSET $2`, [lim, off]),
    db.query(`SELECT
        COUNT(*) FILTER (WHERE approval_status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE approval_status = 'approved' AND approval_decided_at IS NOT NULL)::int AS approved,
        COUNT(*) FILTER (WHERE approval_status = 'rejected')::int AS rejected
      FROM brand_products`),
  ]);
  return { status, products: rows.map(mapRow), counts: c, limit: lim, offset: off };
}

/** How many are waiting — for /admin/stats and the sidebar badge. */
async function pendingCount() {
  const { rows: [r] } = await db.query(`SELECT COUNT(*)::int AS n FROM brand_products WHERE approval_status = 'pending'`);
  return r.n;
}

async function notifyBrand(userId, approve, name, reason) {
  if (!userId) return;
  try {
    await notificationService.send({
      userId,
      type: approve ? 'product.approved' : 'product.rejected',
      title: approve ? `${name} is live in your store` : `${name} was not approved`,
      body: approve
        ? 'INFLX approved it. Shoppers and your creators can see it now.'
        : `INFLX sent it back: ${String(reason || '').trim()}. Fix it, then switch In store on to send it again.`,
      data: { screen: 'brand_products' },
    });
  } catch (e) { console.warn('[productApproval] notify (non-fatal):', e.message); }
}

/** After a product goes live, the creators holding it are told, the way the brand's own Show tells them. */
async function tellCreators(productId, before, after) {
  try { await require('./creatorTerms.service').afterProductChange(productId, before, after); }
  catch (e) { console.warn('[productApproval] creator notice (non-fatal):', e.message); }
}

/**
 * The admin's decision on a WAITING product. Null when it is not pending (404 upstream).
 * approve → live now; reject → stays off the store with the note.
 */
async function decide(productId, adminUserId, approve, reason) {
  const { rows: [before] } = await db.query(`${QUEUE_SELECT} WHERE bp.id = $1 AND bp.approval_status = 'pending'`, [productId]);
  if (!before) return null;
  const { rows: [row] } = approve
    ? await db.query(
      `UPDATE brand_products
          SET pushed_to_store = true, approval_status = 'approved', approval_note = NULL,
              approval_decided_at = now(), approval_decided_by = $2, updated_at = now()
        WHERE id = $1 AND approval_status = 'pending' RETURNING *`, [productId, adminUserId || null])
    : await db.query(
      `UPDATE brand_products
          SET approval_status = 'rejected', approval_note = $3,
              approval_decided_at = now(), approval_decided_by = $2, updated_at = now()
        WHERE id = $1 AND approval_status = 'pending' RETURNING *`, [productId, adminUserId || null, String(reason).trim()]);
  if (!row) return null;
  if (approve) await tellCreators(productId, { ...before, pushed_to_store: false }, row);
  await notifyBrand(before.brand_user_id, approve, before.name, reason);
  const { rows: [after] } = await db.query(`${QUEUE_SELECT} WHERE bp.id = $1`, [productId]);
  return mapRow(after);
}

/** Switch turned OFF: every waiting product goes live (D7). Returns how many. */
async function releaseAll(adminUserId) {
  const { rows: waiting } = await db.query(`${QUEUE_SELECT} WHERE bp.approval_status = 'pending'`);
  if (!waiting.length) return 0;
  const { rows } = await db.query(
    `UPDATE brand_products
        SET pushed_to_store = true, approval_status = 'approved', approval_note = $2,
            approval_decided_at = now(), approval_decided_by = $1, updated_at = now()
      WHERE approval_status = 'pending' RETURNING *`, [adminUserId || null, RELEASED_NOTE]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const w of waiting) {
    const after = byId.get(w.id);
    if (!after) continue;
    await tellCreators(w.id, { ...w, pushed_to_store: false }, after);
    await notifyBrand(w.brand_user_id, true, w.name, null);
  }
  return rows.length;
}

module.exports = { KEY, RELEASED_NOTE, required, approvalOf, onCreate, onShowHide, listQueue, pendingCount, decide, releaseAll };
