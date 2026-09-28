'use strict';

/**
 * remoteParcel.service.js — F5–F11: the products, the price, the parcel.
 * Contract: features/item11-remote · rules v1.27 §11.2 (with §7A, §9, §13, §20, §28, §32)
 * Mockups R5, R6, R6b, R7, R15b
 *
 * THE MONEY RULE, restated where the money moves:
 * **Shipping is the brand's cost alone, in both directions.** Nothing here can reach
 * contracts.locked_amount, escrow_entries or an influencer balance — every rupee goes through
 * remoteMoney.service, which has no path to any of them.
 *
 * THE LIST LOCKS AT BOOKING (§28) and opens again only on a cancel before collection. A rebook
 * after the courier brought the parcel back sends the SAME lines — there is no changing
 * products on a rebook (approval §2.4).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const shipping = require('./shipping');
const money = require('./remoteMoney.service');
const shoot = require('./remoteShoot.service');
const address = require('./remoteAddress.service');
const storage = require('./storage.service');
const { MSG, NOTIFY11 } = require('./productionCopy');
const { logAction } = require('./production.service');
const { BOX_PRESETS, boxOf } = require('./shipping/contract');

const SALE_AIMS = ['conversion', 'hybrid'];

/* ───────────────────────────────────────────── F5 — what she may be sent */

/**
 * Her selling scope resolved to REAL, AVAILABLE products (§7A, §13, §20).
 *
 *   Pay for Sale / Hybrid → only what she may sell. A collaboration whose scope was never set
 *                           receives NOTHING — SCOPE_NOT_SET, never the catalogue, because the
 *                           catalogue would widen what she may sell (v1.27, approval Q3).
 *   Pay for Content       → the whole PUBLISHED catalogue. It has no selling scope.
 *
 * Available means `is_active AND pushed_to_store` — the same test the storefront uses
 * (follower.service.js:333), so a product hidden from shoppers is hidden here too.
 * NOTHING HERE MOVES STOCK. These are the brand's own products, lent or given for a shoot.
 */
async function products(ciId, scope, { q = null, limit = 60, cursor = null } = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (!r.address_sent_at) {
    throw new AppError('ADDRESS_NOT_SENT', MSG.ADDRESS_NOT_SENT(shoot.first(r.creator_name)), 422, 'status');
  }

  const selling = SALE_AIMS.includes(r.goal);
  if (selling && !r.alloc_scope && !r.sell_v2) {
    throw new AppError('SCOPE_NOT_SET', MSG.SCOPE_NOT_SET(shoot.first(r.creator_name)), 422, 'scope');
  }

  const ids = selling ? await allowedProductIds(r, conn) : null;   // null = the whole catalogue
  if (selling && ids.length === 0) {
    return { scope: scopeLabel(r, 0), products: [], nextCursor: null };
  }

  const params = [r.brand_id];
  let sql = `SELECT p.id, p.name, p.image_url, p.price, p.sku
               FROM brand_products p
              WHERE p.brand_id = $1 AND p.is_active = true AND p.pushed_to_store = true`;
  if (ids) { params.push(ids); sql += ` AND p.id = ANY($${params.length}::uuid[])`; }
  if (q) { params.push(`%${String(q).trim()}%`); sql += ` AND p.name ILIKE $${params.length}`; }
  if (cursor) { params.push(cursor); sql += ` AND p.name > $${params.length}`; }
  params.push(Math.min(100, Math.max(1, Number(limit) || 60)));
  sql += ` ORDER BY p.name ASC LIMIT $${params.length}`;

  const { rows } = await conn.query(sql, params);

  // Variants, where a product has them. v1.27 / Q2: a product WITH active variants must be
  // sent in a chosen one; a product without is sent as itself. Production has no variants yet,
  // so the second case is the one that runs today — and it has to work.
  const variants = rows.length ? (await conn.query(
    `SELECT id, product_id, size, color, sku, stock, is_active
       FROM product_variants WHERE product_id = ANY($1::uuid[]) AND is_active = true
      ORDER BY size, color`, [rows.map((p) => p.id)])).rows : [];
  const byProduct = new Map();
  for (const v of variants) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id).push({
      id: v.id,
      label: [v.size, v.color].filter(Boolean).join(' · ') || v.sku || 'One size',
      stock: v.stock == null ? null : Number(v.stock),
    });
  }

  return {
    scope: scopeLabel(r, ids ? ids.length : null),
    products: rows.map((p) => ({
      id: p.id, name: p.name, image: p.image_url || null,
      price: p.price == null ? null : Number(p.price),
      variants: byProduct.get(p.id) || [],
    })),
    nextCursor: rows.length ? rows[rows.length - 1].name : null,
  };
}

/** "Her selling scope · Whole store / N categories / N products", or "Your catalogue" (R5). */
function scopeLabel(r, n) {
  if (!SALE_AIMS.includes(r.goal)) return { kind: 'catalogue', label: 'Your catalogue' };
  // creator-terms-v2: her offers + products without offers (rules §2).
  if (r.sell_v2) return { kind: 'offers', label: n === 1 ? '1 product she can sell' : `${n} products she can sell` };
  if (r.alloc_scope === 'store') return { kind: 'store', label: 'Whole store' };
  if (r.alloc_scope === 'category') return { kind: 'category', label: r.alloc_category || 'One category' };
  return { kind: 'products', label: n === 1 ? '1 product' : `${n} products` };
}

/**
 * The scope → product ids, resolved LIVE.
 *
 * Deliberately the same three shapes item 5 stores and the storefront resolves
 * (follower.service.resolveAllocatedProductIds): a whole store, a category SUBTREE, or a fixed
 * list. Resolved live rather than snapshotted, so unpublishing a product removes it from what
 * she may be sent, exactly as it removes it from what she may sell.
 */
async function allowedProductIds(r, conn = db) {
  // creator-terms-v2: what she can sell = her offers' live pools + her normal-price list, live.
  if (r.sell_v2) return require('./creatorTerms.service').sellableProductIds(r.ci_id, conn);
  const base = `SELECT id FROM brand_products
                 WHERE brand_id = $1 AND is_active = true AND pushed_to_store = true`;
  if (r.alloc_scope === 'store') {
    return (await conn.query(base, [r.brand_id])).rows.map((x) => x.id);
  }
  if (r.alloc_scope === 'category') {
    if (r.alloc_category_node_id) {
      const { rows } = await conn.query(
        `${base} AND category_node_id IN (
           WITH RECURSIVE sub AS (
             SELECT id FROM category_nodes WHERE id = $2
             UNION ALL SELECT cn.id FROM category_nodes cn JOIN sub ON cn.parent_id = sub.id
           ) SELECT id FROM sub)`, [r.brand_id, r.alloc_category_node_id]);
      return rows.map((x) => x.id);
    }
    const { rows } = await conn.query(`${base} AND section = $2`, [r.brand_id, r.alloc_category]);
    return rows.map((x) => x.id);
  }
  if (r.alloc_scope === 'products') {
    const fixed = Array.isArray(r.alloc_product_ids) ? r.alloc_product_ids : [];
    if (!fixed.length) return [];
    const { rows } = await conn.query(`${base} AND id = ANY($2::uuid[])`, [r.brand_id, fixed]);
    return rows.map((x) => x.id);
  }
  return [];
}

/* ───────────────────────────────────────────── F6 — the lines */

/**
 * Save the whole list at once. Kept separate from F8 (approval §9) so R5 can save as the brand
 * works, and F8 stays a single money call with nothing else in it.
 *
 * Rules, all server-side (§7):
 *   ≥ 1 line · ≤ 20 lines · ≤ 5 per (product, variant) · in scope · available ·
 *   a product with active variants needs one chosen.
 */
async function saveLines(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (!r.address_sent_at) {
    throw new AppError('ADDRESS_NOT_SENT', MSG.ADDRESS_NOT_SENT(shoot.first(r.creator_name)), 422, 'status');
  }
  await assertListOpen(r, conn);

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) throw new AppError('NO_LINES', MSG.NO_LINES, 422, 'lines');
  if (lines.length > shoot.MAX_LINES) throw new AppError('TOO_MANY_LINES', MSG.TOO_MANY_LINES, 422, 'lines');

  const selling = SALE_AIMS.includes(r.goal);
  if (selling && !r.alloc_scope && !r.sell_v2) {
    throw new AppError('SCOPE_NOT_SET', MSG.SCOPE_NOT_SET(shoot.first(r.creator_name)), 422, 'scope');
  }
  const allowed = selling ? new Set(await allowedProductIds(r, conn)) : null;

  const productIds = [...new Set(lines.map((l) => String(l.productId || '')))].filter(Boolean);
  const { rows: prods } = await conn.query(
    `SELECT id, name, price, sku, is_active, pushed_to_store FROM brand_products
      WHERE brand_id = $1 AND id = ANY($2::uuid[])`, [r.brand_id, productIds]);
  const byId = new Map(prods.map((p) => [String(p.id), p]));

  const { rows: vars } = await conn.query(
    `SELECT id, product_id, size, color, sku, is_active FROM product_variants
      WHERE product_id = ANY($1::uuid[])`, [productIds]);
  const varsByProduct = new Map();
  for (const v of vars) {
    if (!varsByProduct.has(String(v.product_id))) varsByProduct.set(String(v.product_id), []);
    varsByProduct.get(String(v.product_id)).push(v);
  }

  const seen = new Map();          // (product|variant) → quantity, for the "5 of one size" rule
  const prepared = [];
  for (const l of lines) {
    const pid = String(l.productId || '');
    const p = byId.get(pid);
    if (!p) throw new AppError('OUT_OF_SCOPE', MSG.OUT_OF_SCOPE(shoot.first(r.creator_name)), 422, 'productId');
    if (!p.is_active || !p.pushed_to_store) throw new AppError('UNAVAILABLE', MSG.UNAVAILABLE, 422, 'productId');
    if (allowed && !allowed.has(pid)) {
      throw new AppError('OUT_OF_SCOPE', MSG.OUT_OF_SCOPE(shoot.first(r.creator_name)), 422, 'productId');
    }

    const active = (varsByProduct.get(pid) || []).filter((v) => v.is_active);
    let variantId = l.variantId ? String(l.variantId) : null;
    let variantLabel = null;
    if (active.length) {
      // Q2: a product WITH active variants must be sent in a chosen one.
      const v = active.find((x) => String(x.id) === variantId);
      if (!v) throw new AppError('VARIANT_REQUIRED', MSG.VARIANT_REQUIRED, 422, 'variantId');
      variantLabel = [v.size, v.color].filter(Boolean).join(' · ') || v.sku || null;
    } else {
      variantId = null;            // …and one without is sent as itself.
    }

    const qty = Number(l.quantity || 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > shoot.MAX_PER_VARIANT) {
      throw new AppError('TOO_MANY_OF_VARIANT', MSG.TOO_MANY_OF_VARIANT, 422, 'quantity');
    }
    const key = `${pid}|${variantId || '-'}`;
    const total = (seen.get(key) || 0) + qty;
    if (total > shoot.MAX_PER_VARIANT) {
      throw new AppError('TOO_MANY_OF_VARIANT', MSG.TOO_MANY_OF_VARIANT, 422, 'quantity');
    }
    seen.set(key, total);

    const disposition = l.disposition === 'return' ? 'return' : 'gift';
    prepared.push({ p, variantId, variantLabel, qty, disposition });
  }

  // Replace the whole list. It is the brand's working set until the parcel is booked, and
  // §11.2 says it may change freely until then — a diff would only add ways to be wrong.
  await db.withTransaction(async (tx) => {
    await tx.query(`DELETE FROM production_event_items WHERE production_event_id = $1`, [r.id]);
    for (const x of prepared) {
      // eslint-disable-next-line no-await-in-loop
      await tx.query(
        `INSERT INTO production_event_items
           (production_event_id, product_id, variant_id, name_at_dispatch, variant_label_at_dispatch,
            price_at_dispatch, sku_at_dispatch, quantity, parcel_no, disposition, disposition_changed_at, disposition_changed_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,now(),$10)`,
        [r.id, x.p.id, x.variantId, x.p.name, x.variantLabel, x.p.price, x.p.sku || null, x.qty, x.disposition, scope.userId]);
    }
  });

  await logAction(conn, r.id, scope.userId, 'brand', 'lines_saved',
    `${prepared.length} product${prepared.length === 1 ? '' : 's'} picked`,
    { count: prepared.length, returns: prepared.filter((x) => x.disposition === 'return').length });

  return shoot.read(ciId, scope, conn);
}

/** The list locks at booking (§28). It opens again only on a cancel before collection. */
async function assertListOpen(r, conn = db) {
  const parcel = await shipping.liveOutbound(r.id, conn);
  if (parcel && parcel.booked_at) throw new AppError('LIST_LOCKED', MSG.LIST_LOCKED, 422, 'status');
}

/* ───────────────────────────────────────────── F7 — the quote */

/**
 * What booking will cost, and whether the brand can afford it (R6, R6b).
 *
 * THE RETURN LOCK. When any line is Return, the provider's quoted RETURN price is held at the
 * same moment, so the return can always be paid for (§11.2). When the provider gives no return
 * quote, the lock is the OUTBOUND price for the same box and weight (v1.27, approval §2.3) —
 * and when couriers will not collect from her pincode at all, NOTHING is locked, because INFLX
 * books no return there (approval Q1).
 */
async function quote(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (!r.address_sent_at) {
    throw new AppError('ADDRESS_NOT_SENT', MSG.ADDRESS_NOT_SENT(shoot.first(r.creator_name)), 422, 'status');
  }

  const { branch, box, weightKg } = await validateBooking(r, body, conn);
  const lines = await shoot.linesOf(r.id, conn);
  if (!lines.length) throw new AppError('NO_LINES', MSG.NO_LINES, 422, 'lines');

  const api = shipping.newProvider().api;
  const common = {
    pickupPincode: branch.pincode, deliveryPincode: r.ship_to_pincode,
    pickupCity: branch.city_name, deliveryCity: r.ship_to_city_name,
    weightKg, box,
  };
  const out = await api.quote({ ...common, direction: 'outbound' });
  if (!out) throw new AppError('NOT_DELIVERABLE', MSG.NOT_DELIVERABLE(r.ship_to_pincode), 422, 'pincode');

  const hasReturn = lines.some((l) => l.disposition === 'return');
  const canPickup = r.coverage_return_pickup !== false;
  let returnHold = 0;
  let holdBasis = null;
  if (hasReturn && canPickup) {
    const back = await api.quote({
      ...common,
      pickupPincode: r.ship_to_pincode, deliveryPincode: branch.pincode,
      pickupCity: r.ship_to_city_name, deliveryCity: branch.city_name,
      direction: 'return',
    });
    returnHold = back ? back.amount : out.amount;
    holdBasis = back ? 'quoted' : 'outbound_fallback';
  }

  const total = money.money(out.amount + returnHold);
  const availableNow = await money.available(r.brand_id, conn);
  const shortfall = availableNow >= total ? 0 : money.money(total - availableNow);

  return {
    outbound: out.amount, gst: out.gstAmount, gstIncluded: true,
    returnHold, holdBasis,
    returnCount: lines.filter((l) => l.disposition === 'return').reduce((s, l) => s + Number(l.quantity || 1), 0),
    canPickup,
    total,
    available: availableNow, shortfall, enough: shortfall === 0,
    // §11.2 / R6: said here so the brand cannot think its creator fee is paying for a courier.
    lockedFee: Number(r.locked_amount || 0),
    line: shortfall === 0
      ? `GST included. Courier chosen by INFLX. Anything the return doesn't use comes back to you.`
      : MSG.SHORT_BALANCE(money.fmt(shortfall)),
  };
}

/** Branch, box and weight — the three things a parcel cannot be booked without (R6). */
async function validateBooking(r, body, conn) {
  const branch = await address.pickupBranch(r, body.branchId || null, conn);
  if (!branch) throw new AppError('VALIDATION_ERROR', 'Choose a branch to collect from.', 422, 'branchId');
  // Item 10's sentence, reused verbatim (approval Q9). R6 also makes such a branch
  // unselectable, so this is the backstop rather than the first the brand hears of it.
  if (!branch.formatted_address || !branch.pincode) {
    throw new AppError('BRANCH_NO_ADDRESS', MSG.BRANCH_NO_ADDRESS(branch.name), 422, 'branchId');
  }

  const box = boxOf(body.boxPreset ? { preset: body.boxPreset } : { l: body.boxL, w: body.boxW, h: body.boxH });
  if (!box) throw new AppError('VALIDATION_ERROR', MSG.BOX_REQUIRED, 422, 'box');

  const weightKg = Number(body.weightKg);
  if (!(weightKg > 0) || weightKg > 100) {
    throw new AppError('VALIDATION_ERROR', MSG.WEIGHT_REQUIRED, 422, 'weightKg');
  }
  return { branch, box, weightKg };
}

/* ───────────────────────────────────────────── F8 — book it */

/**
 * ONE transaction: validate, debit, lock, lock the list, call the provider, write the parcel.
 *
 * TWO TAPS OR TWO DEVICES PRODUCE ONE BOOKING AND ONE DEBIT (check 15). Three things make
 * that true together: the brand's wallet row is taken FOR UPDATE before anything is read, the
 * INSERT lands under a unique index that allows exactly one live outbound parcel, and the
 * whole thing is one transaction — so the loser of the race rolls back its debit too.
 *
 * THE PROVIDER IS CALLED LAST. If it fails, nothing has been charged.
 */
async function book(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  if (!r.address_sent_at) {
    throw new AppError('ADDRESS_NOT_SENT', MSG.ADDRESS_NOT_SENT(shoot.first(r.creator_name)), 422, 'status');
  }

  const existing = await shipping.liveOutbound(r.id, conn);
  if (existing && existing.booked_at) throw new AppError('ALREADY_BOOKED', MSG.ALREADY_BOOKED, 422, 'status');

  const q = await quote(ciId, scope, body, conn);
  const { branch, box, weightKg } = await validateBooking(r, body, conn);
  const lines = await shoot.linesOf(r.id, conn);
  if (!lines.length) throw new AppError('NO_LINES', MSG.NO_LINES, 422, 'lines');

  // Approval Q6 — the declared value the courier asks for. No invoice travels with the goods;
  // `challan_key` is there for the day the founder's CA answers.
  const declaredValue = money.money(lines.reduce(
    (s, l) => s + Number(l.price_at_dispatch || 0) * Number(l.quantity || 1), 0));

  // A REBOOK KEEPS THE FIRST BOOKING'S RETURN LOCK (approval §2.4). The money for it is
  // already out of the wallet — charging the quote again would take it twice — but the new
  // parcel still has to CARRY the figure, because that is what the return settles against.
  const carriedHold = money.money(body._carriedHold || 0);
  const chargeHold = carriedHold > 0 ? 0 : q.returnHold;
  const recordHold = carriedHold > 0 ? carriedHold : q.returnHold;

  const provider = shipping.newProvider();
  const created = await db.withTransaction(async (tx) => {
    // The money first, with the wallet row locked. Refused as ONE total (§11.2).
    await money.bookingCharge(tx, {
      brandId: r.brand_id, campaignId: r.campaign_id,
      outbound: q.outbound, returnHold: chargeHold,
      creatorName: shoot.first(r.creator_name),
    });

    const { rows } = await tx.query(
      `INSERT INTO shipments
         (production_event_id, direction, provider, branch_id,
          from_name, from_phone, from_street, from_pincode, from_city_name, from_state_name,
          to_name, to_phone, to_street, to_pincode, to_city_name, to_state_name,
          box_preset, box_l_cm, box_w_cm, box_h_cm, weight_kg, declared_value,
          quoted_amount, charged_amount, gst_amount, return_hold_amount, booked_at,
          rebooked_from_id)
       VALUES ($1,'outbound',$2,$3,
               $4,$5,$6,$7,$8,$9,
               $10,$11,$12,$13,$14,$15,
               $16,$17,$18,$19,$20,$21,
               $22,$22,$23,$24,now(),$25)
       RETURNING *`,
      [r.id, provider.name, branch.id,
       branch.name, r.brand_phone, branch.formatted_address, branch.pincode, branch.city_name, branch.state_name,
       r.ship_to_name, r.ship_to_phone, r.ship_to_street, r.ship_to_pincode, r.ship_to_city_name, r.ship_to_state_name,
       box.preset, box.l, box.w, box.h, weightKg, declaredValue,
       q.outbound, q.gst, recordHold, body.rebookedFromId || null]);
    return rows[0];
  });

  // The provider, and the pickup location it needs. Outside the money transaction on purpose:
  // a courier that is slow to answer must not hold a wallet row locked.
  let booked;
  try {
    await shipping.ensurePickup(branch.id, {
      name: branch.name, phone: r.brand_phone, street: branch.formatted_address,
      pincode: branch.pincode, cityName: branch.city_name, stateName: branch.state_name,
    }, conn);
    booked = await provider.api.book(created, { pickupLocationName: branch.name, items: lines });
  } catch (e) {
    // The provider refused after the money moved. Put it all back and say so — a brand must
    // never be left having paid for a parcel that does not exist.
    await db.withTransaction(async (tx) => {
      await money.cancelRefund(tx, {
        brandId: r.brand_id, campaignId: r.campaign_id,
        outbound: q.outbound, returnHold: chargeHold, creatorName: shoot.first(r.creator_name),
      });
      await tx.query(`UPDATE shipments SET cancelled_at = now() WHERE id = $1`, [created.id]);
    });
    throw new AppError('PROVIDER_FAILED',
      'The courier could not be booked just now, and nothing has been charged. Try again in a moment.', 502);
  }

  // The label, cached in R2 so it can be handed out by a signed URL the phone opens in its
  // browser — the same path the Agreement PDF already uses (gap report §11.4).
  let labelKey = null;
  try {
    const pdf = await provider.api.label({ ...created, ...snake(booked) });
    labelKey = `shipping-labels/${created.id}.pdf`;
    await storage.putBuffer(labelKey, pdf.buffer, 'application/pdf');
  } catch (e) {
    console.error('[remote] label generation failed for', created.id, e.message);
  }

  await conn.query(
    `UPDATE shipments SET courier_name = $2, tracking_number = $3, provider_ref = $4, label_key = $5, updated_at = now()
      WHERE id = $1`,
    [created.id, booked.courierName, booked.trackingNumber, booked.providerRef || null, labelKey]);

  await logAction(conn, r.id, scope.userId, 'brand', 'parcel_booked',
    `Parcel booked — ${booked.courierName} ${booked.trackingNumber}, ${money.fmt(q.outbound)}`
    + (recordHold ? `, ${money.fmt(recordHold)} held for the return${carriedHold > 0 ? ' (carried from the first booking)' : ''}` : ''),
    { shipment_id: created.id, outbound: q.outbound, return_hold: recordHold, charged_hold: chargeHold, provider: provider.name });

  await shoot.notifyCreator(r, NOTIFY11.BOOKED,
    `${r.brand_name} has sent your products. ${booked.courierName} is carrying them — you can follow it in the app.`);

  return shoot.read(ciId, scope, conn);
}

const snake = (b) => ({ courier_name: b.courierName, tracking_number: b.trackingNumber, provider_ref: b.providerRef });

/* ───────────────────────────────────────────── F9 — the label */

/**
 * A short-lived signed URL. The phone opens it with Linking.openURL and the device's own PDF
 * viewer takes over — no native module, so the whole item stays OTA-safe (gap report §11.4).
 */
async function label(ciId, scope, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  const parcel = await shipping.lastOutbound(r.id, conn);
  if (!parcel || !parcel.booked_at || parcel.cancelled_at) {
    throw new AppError('NOT_BOOKED', MSG.NOT_BOOKED, 422, 'status');
  }
  if (!parcel.label_key) {
    // It failed at booking. Make it now rather than telling the brand to rebook a real parcel.
    const pdf = await shipping.provider(parcel).label(parcel);
    const key = `shipping-labels/${parcel.id}.pdf`;
    await storage.putBuffer(key, pdf.buffer, 'application/pdf');
    await conn.query(`UPDATE shipments SET label_key = $2 WHERE id = $1`, [parcel.id, key]);
    parcel.label_key = key;
  }
  const signed = await storage.getPdfDownloadUrl(parcel.label_key, { expiresIn: 3600 });
  if (signed) {
    return { url: signed, expiresIn: 3600, source: 'r2', tracking: parcel.tracking_number, courier: parcel.courier_name };
  }
  // R2_MOCK gives no signed URL. Item 7 settled what to do about that for the Agreement PDF
  // (contract.controller.js:882): hand back the STREAMING route instead, which needs the
  // caller's auth header. The phone opens whichever it is given with Linking.openURL, so the
  // two look the same from the screen's side.
  const env = require('../config/env');
  const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT}`;
  return {
    url: `${baseUrl}/v1/shipments/${parcel.id}/label.pdf`,
    expiresIn: null, source: 'stream',
    tracking: parcel.tracking_number, courier: parcel.courier_name,
  };
}

/**
 * The streaming half of F9 — the bytes themselves, for the mock path above and for any client
 * that would rather have the file than a URL. Brand only, and only its own parcel.
 */
async function labelStream(shipmentId, userId, conn = db) {
  const { rows } = await conn.query(
    `SELECT s.*, b.user_id AS brand_user_id
       FROM shipments s
       JOIN production_events pe ON pe.id = s.production_event_id
       JOIN contracts con ON con.id = pe.contract_id
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       JOIN brands b ON b.id = c.brand_id
      WHERE s.id = $1`, [shipmentId]);
  const s = rows[0];
  // Not yours resolves to nothing — 404, never 403 (check 37).
  if (!s || s.brand_user_id !== userId) throw new AppError('NOT_FOUND', 'Not found', 404);
  if (!s.booked_at || s.cancelled_at) throw new AppError('NOT_BOOKED', MSG.NOT_BOOKED, 422, 'status');
  const pdf = await shipping.provider(s).label(s);
  return pdf;
}

/* ───────────────────────────────────────────── F10 — cancel, until collected */

/**
 * Everything comes back and the list reopens (§11.2). Cancelling and booking again before
 * collection MAY BE REPEATED — the limit of one applies only after a back-to-store
 * (v1.27, approval Q5).
 */
async function cancel(ciId, scope, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  const parcel = await shipping.liveOutbound(r.id, conn);
  if (!parcel || !parcel.booked_at) throw new AppError('NOT_BOOKED', MSG.NOT_BOOKED, 422, 'status');
  if (parcel.collected_at) throw new AppError('ALREADY_COLLECTED', MSG.ALREADY_COLLECTED, 422, 'status');

  try { await shipping.provider(parcel).cancel(parcel); }
  catch (e) { console.error('[remote] provider cancel failed for', parcel.id, e.message); }

  await db.withTransaction(async (tx) => {
    const { rowCount } = await tx.query(
      `UPDATE shipments SET cancelled_at = now(), updated_at = now()
        WHERE id = $1 AND cancelled_at IS NULL AND collected_at IS NULL`, [parcel.id]);
    if (rowCount === 0) throw new AppError('ALREADY_COLLECTED', MSG.ALREADY_COLLECTED, 422, 'status');
    await money.cancelRefund(tx, {
      brandId: r.brand_id, campaignId: r.campaign_id,
      outbound: Number(parcel.charged_amount || 0),
      returnHold: Number(parcel.return_hold_amount || 0),
      creatorName: shoot.first(r.creator_name),
    });
  });

  await logAction(conn, r.id, scope.userId, 'brand', 'parcel_cancelled',
    `Booking cancelled before collection — ${money.fmt(Number(parcel.charged_amount || 0) + Number(parcel.return_hold_amount || 0))} back`,
    { shipment_id: parcel.id });

  return shoot.read(ciId, scope, conn);
}

/* ───────────────────────────────────────────── F11 — book it again, once */

/**
 * After the courier brought the parcel back (R15b). Approval §2.4, in full:
 *   · the list STAYS LOCKED and the same lines go — no changing products on a rebook;
 *   · a NEW outbound row with rebooked_from_id; a NEW outbound price is charged;
 *   · the return lock from the first booking is KEPT, not taken twice;
 *   · coverage is checked again against the address as it now stands (after her one
 *     correction, if she made one);
 *   · any earlier check state is cleared, and the clear is logged.
 */
async function rebook(ciId, scope, body = {}, conn = db) {
  const r = await shoot.loadOrThrow(ciId, scope, conn);
  await shoot.assertOpenRemote(r, conn);
  const prev = await shipping.lastOutbound(r.id, conn);
  if (!prev || !prev.returned_to_store_at) {
    throw new AppError('REBOOK_NOT_ALLOWED', MSG.REBOOK_NOT_ALLOWED, 422, 'status');
  }
  if (prev.rebooked_from_id) throw new AppError('REBOOK_USED', MSG.REBOOK_USED, 422, 'status');

  const { branch, box, weightKg } = await validateBooking(r, body, conn);
  const api = shipping.newProvider().api;
  const cov = await api.checkCoverage({ pickupPincode: branch.pincode, deliveryPincode: r.ship_to_pincode });
  if (!cov.delivers) throw new AppError('NOT_DELIVERABLE', MSG.NOT_DELIVERABLE(r.ship_to_pincode), 422, 'pincode');

  // Her earlier answers described a parcel that never reached her. Clear them, and say so.
  const cleared = await conn.query(
    `UPDATE production_event_items
        SET receipt_status = NULL, receipt_note = NULL, answered_at = NULL, updated_at = now()
      WHERE production_event_id = $1 AND receipt_status IS NOT NULL
      RETURNING id`, [r.id]);
  if (cleared.rowCount) {
    await logAction(conn, r.id, scope.userId, 'brand', 'check_cleared',
      `The parcel came back, so ${cleared.rowCount} earlier answer${cleared.rowCount === 1 ? '' : 's'} about what arrived were cleared`,
      { count: cleared.rowCount });
  }

  // The return lock rides across, so it is never taken twice (approval §2.4).
  const out = await book(ciId, scope, {
    ...body,
    rebookedFromId: prev.id,
    _carriedHold: Number(prev.return_hold_amount || 0),
  }, conn);
  return out;
}

module.exports = {
  products, allowedProductIds, scopeLabel,
  saveLines, assertListOpen,
  quote, validateBooking,
  book, label, labelStream, cancel, rebook,
  SALE_AIMS, BOX_PRESETS,
};
