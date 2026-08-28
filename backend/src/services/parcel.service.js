'use strict';

/**
 * parcel.service.js — what is in the box, who said what about it, and what happens next.
 * Contract: features/stage-4-the-shoot (slices 1 and 2)
 * Board: 04-preview/mockups/stage4-screens.html panels ④ ⑤ ⑥ · ledger #115–#118
 *
 * THE RULE THIS SERVICE EXISTS TO KEEP
 * **A shortfall is the brand's problem, not hers.** She flags what did not arrive, the brand
 * is told immediately with the item named, and her shoot goes ahead regardless. Nothing here
 * may block her, ask her to chase anything, or make her explain a courier's mistake.
 *
 * AND THE ONE THE FOUNDER ADDED, 2026-08-27
 * **Receiving is not shooting.** Confirming a parcel arrived moves the shoot to `in_progress`.
 * It finishes when someone says the shooting is done — and WHO may say that depends on the
 * mode: either party on a store visit, because the brand was there; **the creator alone on a
 * remote shoot, because the brand cannot see whether she has shot anything.** Letting them
 * close it would be letting them assert something they cannot know.
 *
 * The real proof is Stage 5's content submission. This confirmation is a marker, not evidence,
 * which is exactly why it is safe to let her give it alone.
 *
 * Read-write. Takes its connection so the rules can be executed in a test without a database.
 */

const VERDICTS = ['received', 'missing', 'damaged'];

/** Verdicts that mean the brand has something to answer for. */
const SHORTFALL = ['missing', 'damaged'];

/**
 * Who may say "the shooting is done", by mode. The founder's ruling, written down once so
 * the endpoint and any screen read the same rule.
 */
const MAY_COMPLETE = {
  visit:    ['brand', 'influencer'],
  shipment: ['influencer'],
  remote:   ['influencer'],
};

const canComplete = (mode, role) => (MAY_COMPLETE[mode] || ['influencer']).includes(role);

/**
 * Modes where the shoot is not finished until BOTH sides have said so.
 *
 * Founder, 2026-08-28: "if it is store visit then both will mark it as done...if it is remote
 * then creator mark it as done".
 *
 * ⚠️ MAY_COMPLETE above answers a DIFFERENT question — who is allowed to mark it. Stage 4 read
 * `visit: ['brand','influencer']` as "either one closes it", so one side could close a visit
 * the other says never happened. Allowed-to-mark and enough-to-close are not the same thing,
 * and keeping them as two named constants is the only way they stay distinguishable.
 *
 * Remote and shipment stay one-sided on purpose: the brand cannot see whether she has shot
 * anything, so they are not permitted to assert it at all.
 * Contract: features/shoot-starts-where-the-agreement-left-it
 */
const REQUIRES_BOTH = ['visit'];

const needsBothToComplete = (mode) => REQUIRES_BOTH.includes(String(mode || '').toLowerCase());

/**
 * Given who has marked it so far, is the shoot finished?
 * @param {string} mode
 * @param {{brand_completed_at?:*, influencer_completed_at?:*}} marks
 */
const isShootComplete = (mode, marks = {}) => {
  const byInfluencer = !!marks.influencer_completed_at;
  const byBrand      = !!marks.brand_completed_at;
  // The creator's word is required in every mode. She is the one who does the shooting; a
  // visit closed on the brand's mark alone would be the brand reporting her work for her.
  return needsBothToComplete(mode) ? (byInfluencer && byBrand) : byInfluencer;
};

/** Everything in a parcel, newest parcel last, in the order the brand packed it. */
async function listItems(eventId, conn) {
  const { rows } = await conn.query(
    `SELECT i.*, p.image_url
       FROM production_event_items i
       LEFT JOIN brand_products p ON p.id = i.product_id
      WHERE i.production_event_id = $1
      ORDER BY i.parcel_no, i.created_at`,
    [eventId]
  );
  return rows;
}

/**
 * Put products in the box. Called before dispatch, and again for a resend.
 *
 * The name, price and SKU are copied AS SENT. A product renamed or repriced next month must
 * not rewrite what was in a box in August — the same reasoning the handshake uses for terms.
 */
async function addItems(eventId, { brandId, items, parcelNo = 1 }, conn) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, field: 'items', message: 'Pick at least one product to send.' };
  }
  if (items.length > 50) {
    return { ok: false, field: 'items', message: 'A parcel is capped at 50 different products.' };
  }

  const ids = [...new Set(items.map(i => String(i.product_id || '')).filter(Boolean))];
  if (ids.length !== items.length) {
    return { ok: false, field: 'items', message: 'The same product is listed twice. Set a quantity instead.' };
  }

  // Only this brand's own live products. Sending something you do not list is the parcel
  // version of the offer-on-an-unlisted-product blocker Stage 2 added.
  const { rows: owned } = await conn.query(
    `SELECT id, name, price, sku, is_active FROM brand_products
      WHERE brand_id = $1 AND id = ANY($2::uuid[])`,
    [brandId, ids]
  );
  const byId = new Map(owned.map(r => [String(r.id), r]));
  const missing = ids.filter(id => !byId.has(id));
  if (missing.length) {
    return { ok: false, field: 'items', message: 'Some of those products are not in your catalogue.' };
  }

  const written = [];
  for (const it of items) {
    const p = byId.get(String(it.product_id));
    const qty = Math.max(1, Number(it.quantity || 1));
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await conn.query(
      `INSERT INTO production_event_items
         (production_event_id, product_id, name_at_dispatch, price_at_dispatch,
          sku_at_dispatch, quantity, parcel_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (production_event_id, parcel_no, product_id)
         DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()
       RETURNING *`,
      [eventId, p.id, p.name, p.price, p.sku || null, qty, parcelNo]
    );
    written.push(rows[0]);
  }
  return { ok: true, items: written };
}

/** Take something back out before it is dispatched. */
async function removeItem(eventId, itemId, conn) {
  const { rowCount } = await conn.query(
    `DELETE FROM production_event_items WHERE id = $1 AND production_event_id = $2`,
    [itemId, eventId]
  );
  return { ok: rowCount > 0 };
}

/**
 * Her answer, item by item.
 *
 * @param answers [{ item_id, status: received|missing|damaged, note }]
 * @returns { ok, received, shortfall:[{item_id, name, status}], allAnswered }
 */
async function recordReceipt(eventId, answers, conn) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return { ok: false, field: 'answers', message: 'Say what arrived.' };
  }
  for (const a of answers) {
    if (!VERDICTS.includes(a.status)) {
      return { ok: false, field: 'answers', message: `"${a.status}" is not something an item can be. Use received, missing or damaged.` };
    }
  }

  for (const a of answers) {
    // eslint-disable-next-line no-await-in-loop
    await conn.query(
      `UPDATE production_event_items
          SET receipt_status = $3, receipt_note = $4, answered_at = now(), updated_at = now()
        WHERE id = $1 AND production_event_id = $2`,
      [a.item_id, eventId, a.status, a.note || null]
    );
  }

  const items = await listItems(eventId, conn);
  const answered = items.filter(i => i.receipt_status);
  const shortfall = items
    .filter(i => SHORTFALL.includes(i.receipt_status) && !i.dropped_at)
    .map(i => ({ item_id: i.id, name: i.name_at_dispatch, status: i.receipt_status, sku: i.sku_at_dispatch }));

  return {
    ok: true,
    received: answered.filter(i => i.receipt_status === 'received').length,
    total: items.length,
    shortfall,
    allAnswered: answered.length === items.length,
  };
}

/**
 * The brand drops an item rather than resending it.
 *
 * Returns whether her allocation should lose the product too. **Only on a hand-picked list.**
 * Store and category scopes are resolved live (Part 4 §4.1), so carving a hole in one would
 * be inventing a rule those scopes do not have — a product still in the category is still in
 * scope, whether or not one copy went missing in a van.
 */
async function dropItem(eventId, itemId, conn) {
  const { rows } = await conn.query(
    `UPDATE production_event_items
        SET dropped_at = now(), updated_at = now()
      WHERE id = $1 AND production_event_id = $2
      RETURNING *`,
    [itemId, eventId]
  );
  const item = rows[0];
  if (!item) return { ok: false, message: 'That item is not in this parcel.' };

  const { rows: ciRows } = await conn.query(
    `SELECT ci.id, ci.alloc_scope, ci.alloc_product_ids
       FROM production_events pe
       JOIN contracts con ON con.id = pe.contract_id
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
      WHERE pe.id = $1`,
    [eventId]
  );
  const ci = ciRows[0];
  let removedFromAllocation = false;

  if (ci && ci.alloc_scope === 'products' && Array.isArray(ci.alloc_product_ids)) {
    const next = ci.alloc_product_ids.filter(id => String(id) !== String(item.product_id));
    if (next.length !== ci.alloc_product_ids.length) {
      await conn.query(
        `UPDATE campaign_influencers SET alloc_product_ids = $2::jsonb WHERE id = $1`,
        [ci.id, JSON.stringify(next)]
      );
      removedFromAllocation = true;
    }
  }

  return { ok: true, item, removedFromAllocation };
}

/** What the shoot screens show at the top of a shipment. */
async function summarise(eventId, conn) {
  const items = await listItems(eventId, conn);
  if (!items.length) return { total: 0, parcels: 0, answered: 0, shortfall: [] };
  return {
    total: items.length,
    parcels: Math.max(...items.map(i => Number(i.parcel_no || 1))),
    answered: items.filter(i => i.receipt_status).length,
    received: items.filter(i => i.receipt_status === 'received').length,
    shortfall: items
      .filter(i => SHORTFALL.includes(i.receipt_status) && !i.dropped_at)
      .map(i => ({ item_id: i.id, name: i.name_at_dispatch, status: i.receipt_status })),
  };
}

module.exports = {
  listItems,
  addItems,
  removeItem,
  recordReceipt,
  dropItem,
  summarise,
  canComplete,
  MAY_COMPLETE,
  REQUIRES_BOTH,
  needsBothToComplete,
  isShootComplete,
  MAY_COMPLETE,
  VERDICTS,
  SHORTFALL,
};
