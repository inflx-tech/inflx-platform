'use strict';

/**
 * meals.service.js — INFLX Meals business logic (P1 thin vertical slice).
 *
 * The planned-meal marketplace: a customer states an intent, the
 * DETERMINISTIC engine composes offers from the restaurant's own active
 * offer-rules (AI suggests/ranks in a later phase — P1 is deterministic
 * only), the customer locks + pays before the slot cutoff, and the
 * restaurant self-delivers. Money is RUPEES throughout (migration 021).
 *
 * P1 scope: ONE restaurant, end-to-end — config + slot + offer-rule
 * setup, intent → compute offers → lock+pay (mock Razorpay) → mark
 * delivered. No AI, no 5km routing, no discount-clock decay yet (those
 * are P3). Contract: features/meals-p1-vertical-slice/.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const engine = require('./mealsEngine.service');
const ai = require('./ai');
const learning = require('./mealsLearning.service');

// pg returns `date` columns as JS Date objects (local midnight). Normalise
// to a 'YYYY-MM-DD' string before composing serve/cutoff timestamps.
function toDateStr(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Identity resolvers ───────────────────────────────────────────────────────

async function brandIdForUser(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0].id;
}

/**
 * Resolve (or lazily create) the followers row for a user. A follower
 * row is just (user_id, default_address_id); creating it on first Meals
 * action keeps the slice self-contained without forcing a separate
 * registration step.
 */
async function followerIdForUser(userId) {
  const { rows } = await db.query(
    `INSERT INTO followers (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING id`,
    [userId]
  );
  return rows[0].id;
}

// ── Restaurant setup (minimal — full setup UI is P2) ─────────────────────────

async function upsertConfig(brandId, body = {}) {
  const {
    enabled = true,
    delivery_radius_km = 5,
    max_discount_pct = 25,
    never_below_cost = true,
    auto_offer = false,
    discount_clock = [],
  } = body;
  const { rows } = await db.query(
    `INSERT INTO restaurant_meal_config
       (brand_id, enabled, delivery_radius_km, max_discount_pct, never_below_cost, auto_offer, discount_clock)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (brand_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       delivery_radius_km = EXCLUDED.delivery_radius_km,
       max_discount_pct = EXCLUDED.max_discount_pct,
       never_below_cost = EXCLUDED.never_below_cost,
       auto_offer = EXCLUDED.auto_offer,
       discount_clock = EXCLUDED.discount_clock
     RETURNING *`,
    [brandId, enabled, delivery_radius_km, max_discount_pct, never_below_cost, auto_offer,
     JSON.stringify(discount_clock)]
  );
  return rows[0];
}

async function createSlot(brandId, body = {}) {
  const { label, serve_time, cutoff_minutes_before = 120, capacity = 40, days_active } = body;
  if (!label || !serve_time) {
    throw new AppError('VALIDATION_ERROR', 'label and serve_time are required', 422);
  }
  const { rows } = await db.query(
    `INSERT INTO meal_slots (brand_id, label, serve_time, cutoff_minutes_before, capacity, days_active)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb))
     RETURNING *`,
    [brandId, label, serve_time, cutoff_minutes_before, capacity,
     days_active ? JSON.stringify(days_active) : null]
  );
  return rows[0];
}

async function createOfferRule(brandId, body = {}) {
  const {
    name, party_size, offer_kind, items_json = [], base_price,
    discount_type = null, discount_value = null, freebies_json = [],
    photo_url = null, slot_id = null, custom_description = null,
    trigger_json = {}, source = 'template', status = 'active',
  } = body;
  if (!name || !party_size || !offer_kind) {
    throw new AppError('VALIDATION_ERROR', 'name, party_size and offer_kind are required', 422);
  }
  const { rows } = await db.query(
    `INSERT INTO meal_offer_rules
       (brand_id, name, party_size, offer_kind, items_json, base_price,
        discount_type, discount_value, freebies_json, photo_url, slot_id,
        custom_description, trigger_json, source, status,
        accepted_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10,$11,$12,$13::jsonb,$14,$15::meal_offer_status,
        CASE WHEN $15::text IN ('accepted','active') THEN now() ELSE NULL END)
     RETURNING *`,
    [brandId, name, party_size, offer_kind, JSON.stringify(items_json), base_price,
     discount_type, discount_value, JSON.stringify(freebies_json), photo_url, slot_id,
     custom_description, JSON.stringify(trigger_json), source, status]
  );
  return rows[0];
}

// ── Deterministic price compute (P1 v0) ──────────────────────────────────────
// Every rupee is computed here, never by AI. base_price is the owner's
// price; discount is applied per discount_type. Rounded to whole rupees.
function computePrice(rule) {
  const items = Array.isArray(rule.items_json) ? rule.items_json : [];
  const itemsSum = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  const base = rule.base_price != null ? Number(rule.base_price) : itemsSum;
  let price = base;
  if (rule.discount_type === 'flat' && rule.discount_value != null) {
    price = base - Number(rule.discount_value);
  } else if (rule.discount_type === 'percentage' && rule.discount_value != null) {
    price = base * (1 - Number(rule.discount_value) / 100);
  }
  price = Math.max(0, Math.round(price));
  return { price, original_price: Math.round(base) };
}

// ── Customer flow ────────────────────────────────────────────────────────────

async function createIntent(userId, body = {}) {
  const followerId = await followerIdForUser(userId);
  const {
    brand_id = null, party_size = null, veg_count = null, nonveg_count = null,
    items_json = [], spice_level = null, occasion = null, drop_location = {},
    slot_date = null, slot_label = null, budget_per_head = null,
    raw_text = null, parsed_json = {},
  } = body;
  const { rows } = await db.query(
    `INSERT INTO meal_intents
       (follower_id, brand_id, party_size, veg_count, nonveg_count, items_json,
        spice_level, occasion, drop_location, slot_date, slot_label,
        budget_per_head, raw_text, parsed_json, status)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb,'open')
     RETURNING *`,
    [followerId, brand_id, party_size, veg_count, nonveg_count, JSON.stringify(items_json),
     spice_level, occasion, JSON.stringify(drop_location), slot_date, slot_label,
     budget_per_head, raw_text, JSON.stringify(parsed_json)]
  );
  return rows[0];
}

/** Active rules for a brand + party size, with the rule's slot resolved
 *  (or the brand's first active slot as fallback). */
async function activeRulesForBrand(brandId, partySize) {
  const { rows } = await db.query(
    `SELECT r.*, s.serve_time AS slot_serve_time, s.cutoff_minutes_before AS slot_cutoff,
            s.capacity AS slot_capacity, s.id AS resolved_slot_id
       FROM meal_offer_rules r
       LEFT JOIN LATERAL (
         SELECT * FROM meal_slots
          WHERE id = r.slot_id
             OR (r.slot_id IS NULL AND meal_slots.brand_id = r.brand_id AND is_active)
          ORDER BY (id = r.slot_id) DESC, serve_time ASC
          LIMIT 1
       ) s ON true
      WHERE r.brand_id = $1 AND r.status = 'active'
        AND ($2::meal_party_size IS NULL OR r.party_size = $2)
      ORDER BY r.created_at ASC`,
    [brandId, partySize]
  );
  return rows;
}

async function customerFavourites(followerId) {
  if (!followerId) return [];
  const { rows } = await db.query(
    `SELECT favourite_brand_ids FROM meal_customer_preferences WHERE follower_id = $1`, [followerId]);
  return (rows[0] && rows[0].favourite_brand_ids) || [];
}

/** Cross-restaurant routing (E1): enabled restaurants whose fixed
 *  registration location is within the ADMIN platform radius of the
 *  customer's drop location, that have an active rule for the party
 *  size. Returns candidate {rule, brand_id, config, distance_km}. */
async function matchAcrossRestaurants(intent) {
  const drop = intent.drop_location || {};
  const settings = await getPlatformSettings();
  const radiusKm = effectiveRadiusKm(settings);

  const { rows: configs } = await db.query(
    `SELECT c.*, b.lat, b.lng
       FROM restaurant_meal_config c
       JOIN brands b ON b.id = c.brand_id
      WHERE c.enabled = true`
  );
  const out = [];
  for (const cfg of configs) {
    const within = engine.withinRadius(
      { lat: drop.lat, lng: drop.lng },
      { lat: cfg.lat, lng: cfg.lng },
      radiusKm
    );
    if (drop.lat != null && cfg.lat != null && !within.ok) continue;
    const rules = await activeRulesForBrand(cfg.brand_id, intent.party_size);
    for (const rule of rules) out.push({ rule, brand_id: cfg.brand_id, config: cfg, distance_km: within.distance_km });
  }
  return out;
}

/** Single-brand range check (in-store chat): is the chosen drop_location
 *  within the admin radius of this restaurant's fixed lat/lng? Returns
 *  { ok, distance_km } — ok=true when we can't compute (no coords). */
async function brandInRange(brandId, drop) {
  if (!drop || drop.lat == null) return { ok: true, distance_km: null };
  const { rows } = await db.query(`SELECT lat, lng FROM brands WHERE id = $1`, [brandId]);
  const b = rows[0];
  if (!b || b.lat == null) return { ok: true, distance_km: null };
  const settings = await getPlatformSettings();
  return engine.withinRadius(
    { lat: drop.lat, lng: drop.lng },
    { lat: b.lat, lng: b.lng },
    effectiveRadiusKm(settings)
  );
}

/** Best-effort lat/lng on the drop_location — we need numbers to route. */
function hasUsableDrop(drop) {
  return !!(drop && drop.lat != null && drop.lng != null);
}

/** Recent saved delivery addresses for this follower — labels + coords
 *  when available — used by the address-required chat branch. */
async function listFollowerAddresses(followerId) {
  const { rows } = await db.query(
    `SELECT id, label, line1, line2, city, pincode, lat, lng, is_default
       FROM follower_addresses
      WHERE follower_id = $1
      ORDER BY is_default DESC NULLS LAST, id DESC
      LIMIT 5`,
    [followerId]
  );
  return rows;
}

/**
 * Compute the deterministic offer shortlist for an intent (E1+E2). When
 * the intent names a brand it's that restaurant's active rules; with no
 * brand it routes across restaurants within delivery radius. Each offer
 * is priced by the engine (rule discount + early-bird clock, capped,
 * cost-floored), then ranked favourites → cheapest → nearest. Persists
 * meal_offers + flips intent status. No-match → 'no_match', empty list.
 */
async function computeOffers(intentId) {
  const { rows: intents } = await db.query(`SELECT * FROM meal_intents WHERE id = $1`, [intentId]);
  const intent = intents[0];
  if (!intent) throw new AppError('NOT_FOUND', 'Intent not found', 404);

  const now = new Date();
  let candidates = [];
  if (intent.brand_id) {
    const config = await getConfig(intent.brand_id);
    const rules = await activeRulesForBrand(intent.brand_id, intent.party_size);
    candidates = rules.map((rule) => ({ rule, brand_id: intent.brand_id, config: config || {}, distance_km: null }));
  } else {
    candidates = await matchAcrossRestaurants(intent);
  }

  if (candidates.length === 0) {
    await db.query(`UPDATE meal_intents SET status = 'no_match' WHERE id = $1`, [intentId]);
    return { intent_status: 'no_match', offers: [] };
  }

  const intentDateStr = toDateStr(intent.slot_date);
  const priced = candidates.map((c) => {
    const slot = c.rule.slot_serve_time
      ? { serve_time: c.rule.slot_serve_time, cutoff_minutes_before: c.rule.slot_cutoff, capacity: c.rule.slot_capacity }
      : null;
    const serveAt = slot ? engine.slotServeAt(slot, intentDateStr) : null;
    const hoursUntilServe = serveAt ? engine.hoursUntil(serveAt, now) : null;
    const eo = engine.computeEngineOffer(c.rule, c.config || {}, { hoursUntilServe });
    return { ...c, price: eo.price, original_price: eo.base, effective_pct: eo.effective_pct };
  });

  const favs = await customerFavourites(intent.follower_id);
  const ranked = engine.rankCandidates(priced, { favouriteBrandIds: favs });

  await db.query(`DELETE FROM meal_offers WHERE intent_id = $1`, [intentId]);

  const offers = [];
  for (let i = 0; i < ranked.length; i += 1) {
    const p = ranked[i];
    const isTop = i === 0;
    const isFav = favs.includes(p.brand_id);
    const reason = isTop
      ? (isFav ? 'Your favourite, and best value for your party size.' : 'Best value for your party size (lowest price).')
      : null;
    const { rows } = await db.query(
      `INSERT INTO meal_offers
         (intent_id, brand_id, offer_rule_id, items_json, price, original_price,
          freebies_json, eta_text, rank, ai_recommended, reasoning, status)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb,$8,$9,$10,$11,'presented')
       RETURNING *`,
      [intentId, p.brand_id, p.rule.id, JSON.stringify(p.rule.items_json || []),
       p.price, p.original_price, JSON.stringify(p.rule.freebies_json || []),
       p.distance_km != null ? `~${p.distance_km} km` : null, i + 1, isTop, reason]
    );
    offers.push(rows[0]);
  }

  await db.query(`UPDATE meal_intents SET status = 'offered' WHERE id = $1`, [intentId]);
  return { intent_status: 'offered', offers };
}

/**
 * Lock + pay an offer → a confirmed meal_order. Payment is mocked
 * (RAZORPAY_MOCK) for P1. Rejected if the slot cutoff has already passed.
 */
async function lockAndPay(userId, mealOfferId) {
  const followerId = await followerIdForUser(userId);

  const { rows } = await db.query(
    `SELECT mo.*, mi.party_size, mi.drop_location, mi.slot_date AS intent_slot_date,
            r.slot_id AS rule_slot_id
       FROM meal_offers mo
       JOIN meal_intents mi ON mi.id = mo.intent_id
       LEFT JOIN meal_offer_rules r ON r.id = mo.offer_rule_id
      WHERE mo.id = $1`,
    [mealOfferId]
  );
  const offer = rows[0];
  if (!offer) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  if (offer.status !== 'presented') {
    throw new AppError('OFFER_EXPIRED', 'This offer is no longer available', 409);
  }

  // Resolve the slot + cutoff. P1: prefer the rule's slot; fall back to the
  // brand's first active slot. Cutoff = (slot_date + serve_time) − lead time.
  const slotId = offer.rule_slot_id;
  const { rows: slots } = await db.query(
    slotId
      ? `SELECT * FROM meal_slots WHERE id = $1`
      : `SELECT * FROM meal_slots WHERE brand_id = $1 AND is_active ORDER BY serve_time ASC LIMIT 1`,
    [slotId || offer.brand_id]
  );
  const slot = slots[0];
  const slotDate = toDateStr(offer.intent_slot_date) || new Date().toISOString().slice(0, 10);

  let cutoffAt = null;
  if (slot) {
    // E3: order book must be OPEN — not frozen (past cutoff) and not full
    // (capacity reached). Count the live orders already on this slot/date.
    const { rows: cc } = await db.query(
      `SELECT count(*)::int AS n FROM meal_orders
        WHERE brand_id = $1 AND slot_id = $2 AND slot_date = $3
          AND status IN ('paid','locked','frozen','preparing','out_for_delivery','delivered')`,
      [offer.brand_id, slot.id, slotDate]
    );
    const book = engine.isSlotOpen(slot, slotDate, cc[0].n, new Date());
    cutoffAt = book.cutoff;
    if (!book.open) {
      if (book.reason === 'full') throw new AppError('SLOT_FULL', 'This meal slot is fully booked', 409);
      throw new AppError('OFFER_EXPIRED', 'The order cutoff for this slot has passed', 409);
    }
  }

  return db.withTransaction(async (tx) => {
    const { rows: orderRows } = await tx.query(
      `INSERT INTO meal_orders
         (meal_offer_id, intent_id, follower_id, brand_id, slot_id, slot_date,
          party_size, items_json, amount, delivery_address, status, cutoff_at, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,'paid',$11, now())
       RETURNING *`,
      [mealOfferId, offer.intent_id, followerId, offer.brand_id, slot ? slot.id : null,
       slotDate, offer.party_size, JSON.stringify(offer.items_json || []), offer.price,
       JSON.stringify(offer.drop_location || {}), cutoffAt]
    );
    await tx.query(`UPDATE meal_offers SET status = 'selected' WHERE id = $1`, [mealOfferId]);
    await tx.query(`UPDATE meal_intents SET status = 'ordered' WHERE id = $1`, [offer.intent_id]);

    // P6 — learning loop write. Pull the intent's spice/cuisines for the
    // upsert. A failure here should NEVER fail the order: catch + log.
    try {
      const intent = (await tx.query(
        `SELECT party_size, spice_level FROM meal_intents WHERE id = $1`,
        [offer.intent_id]
      )).rows[0];
      await learning.upsertCustomerPrefsOnOrder(tx, {
        followerId,
        order: orderRows[0],
        intent,
      });
    } catch (e) {
      console.error('[meals-learning] customer prefs upsert failed (non-fatal):', e.message);
    }

    return orderRows[0];
  });
}

async function getOrder(userId, orderId) {
  const { rows } = await db.query(
    `SELECT mo.*, b.business_name AS brand_name
       FROM meal_orders mo
       JOIN brands b ON b.id = mo.brand_id
       LEFT JOIN followers f ON f.id = mo.follower_id
      WHERE mo.id = $1 AND (f.user_id = $2 OR b.user_id = $2)`,
    [orderId, userId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Order not found', 404);
  return rows[0];
}

/** Restaurant marks an order delivered (manual self-delivery, P1). */
async function markDelivered(userId, orderId) {
  const brandId = await brandIdForUser(userId);
  const { rows } = await db.query(
    `UPDATE meal_orders
        SET status = 'delivered'
      WHERE id = $1 AND brand_id = $2
        AND status IN ('paid','locked','frozen','preparing','out_for_delivery')
      RETURNING *`,
    [orderId, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Order not found or not in a deliverable state', 404);
  return rows[0];
}

// ── Restaurant reads + management (P2) ───────────────────────────────────────

async function getConfig(brandId) {
  const { rows } = await db.query(`SELECT * FROM restaurant_meal_config WHERE brand_id = $1`, [brandId]);
  return rows[0] || null;
}

/** Admin-set platform Meals settings (single row). Cached per-call. */
async function getPlatformSettings() {
  const { rows } = await db.query(`SELECT * FROM platform_meals_settings WHERE id = 1`);
  return rows[0] || { id: 1, radius_km: 5, radius_tolerance_m: 500, min_order_lead_minutes: 120 };
}

async function updatePlatformSettings(body = {}) {
  const cur = await getPlatformSettings();
  const next = {
    radius_km: body.radius_km != null ? Number(body.radius_km) : cur.radius_km,
    radius_tolerance_m: body.radius_tolerance_m != null ? Number(body.radius_tolerance_m) : cur.radius_tolerance_m,
    min_order_lead_minutes: body.min_order_lead_minutes != null ? Number(body.min_order_lead_minutes) : cur.min_order_lead_minutes,
  };
  const { rows } = await db.query(
    `UPDATE platform_meals_settings
        SET radius_km = $1, radius_tolerance_m = $2, min_order_lead_minutes = $3
      WHERE id = 1 RETURNING *`,
    [next.radius_km, next.radius_tolerance_m, next.min_order_lead_minutes]
  );
  return rows[0];
}

/** Effective routing radius in km: admin radius + tolerance/1000. */
function effectiveRadiusKm(settings) {
  return Number(settings.radius_km || 0) + Number(settings.radius_tolerance_m || 0) / 1000;
}

async function listSlots(brandId) {
  const { rows } = await db.query(
    `SELECT * FROM meal_slots WHERE brand_id = $1 ORDER BY serve_time ASC`, [brandId]);
  return rows;
}

async function listOfferRules(brandId, { party_size = null, status = null } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM meal_offer_rules
      WHERE brand_id = $1
        AND ($2::meal_party_size IS NULL OR party_size = $2)
        AND ($3::meal_offer_status IS NULL OR status = $3)
      ORDER BY party_size, created_at DESC`,
    [brandId, party_size, status]
  );
  return rows;
}

const UPDATABLE = ['name', 'party_size', 'offer_kind', 'items_json', 'base_price',
  'discount_type', 'discount_value', 'freebies_json', 'photo_url', 'slot_id',
  'custom_description', 'trigger_json', 'status', 'rejected_reason'];
const JSON_FIELDS = new Set(['items_json', 'freebies_json', 'trigger_json']);

async function updateOfferRule(brandId, ruleId, body = {}) {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of UPDATABLE) {
    if (body[k] === undefined) continue;
    if (JSON_FIELDS.has(k)) { sets.push(`${k} = $${i}::jsonb`); vals.push(JSON.stringify(body[k])); }
    else if (k === 'status') { sets.push(`${k} = $${i}::meal_offer_status`); vals.push(body[k]); }
    else if (k === 'party_size') { sets.push(`${k} = $${i}::meal_party_size`); vals.push(body[k]); }
    else { sets.push(`${k} = $${i}`); vals.push(body[k]); }
    i += 1;
  }
  if (sets.length === 0) throw new AppError('VALIDATION_ERROR', 'No updatable fields supplied', 422);
  if (body.status && ['accepted', 'active'].includes(body.status)) sets.push('accepted_at = now()');
  vals.push(ruleId); vals.push(brandId);

  // Transactional so the learning write composes with the UPDATE — we
  // capture the previous status FOR UPDATE to lock the row, run the
  // change, then write the matching learning row(s).
  return db.withTransaction(async (tx) => {
    const prev = (await tx.query(
      `SELECT status FROM meal_offer_rules WHERE id = $1 AND brand_id = $2 FOR UPDATE`,
      [ruleId, brandId]
    )).rows[0];
    if (!prev) throw new AppError('NOT_FOUND', 'Offer rule not found', 404);
    const { rows } = await tx.query(
      `UPDATE meal_offer_rules SET ${sets.join(', ')} WHERE id = $${i} AND brand_id = $${i + 1} RETURNING *`,
      vals
    );
    const updated = rows[0];
    if (!updated) throw new AppError('NOT_FOUND', 'Offer rule not found', 404);
    await learning.recordRuleStatusChange(tx, brandId, updated, prev.status).catch(() => {});
    return updated;
  });
}

/**
 * Public store view (C0, mockup 03): a restaurant's active Meals offers
 * for the in-store Offers tab — grouped by party size with a display
 * price (rule discount only; the time-decay clock applies at order
 * time), plus slot cutoffs + delivery radius. No auth required.
 */
async function getStore(brandId) {
  const { rows: brands } = await db.query(
    `SELECT id, business_name, locality FROM brands WHERE id = $1`, [brandId]);
  if (!brands[0]) throw new AppError('NOT_FOUND', 'Restaurant not found', 404);
  const config = await getConfig(brandId);
  const slots = await listSlots(brandId);
  const rules = await listOfferRules(brandId, { status: 'active' });

  const offers = rules.map((r) => {
    const eo = engine.computeEngineOffer(r, config || {}, {});
    return {
      id: r.id,
      name: r.name,
      party_size: r.party_size,
      offer_kind: r.offer_kind,
      items_json: r.items_json,
      freebies_json: r.freebies_json,
      photo_url: r.photo_url,
      price: eo.price,
      original_price: eo.base,
      slot_id: r.slot_id,
    };
  });

  const byParty = {};
  for (const o of offers) {
    (byParty[o.party_size] = byParty[o.party_size] || []).push(o);
  }

  return {
    brand: brands[0],
    delivery_radius_km: config ? config.delivery_radius_km : null,
    enabled: config ? config.enabled : false,
    slots: slots.map((s) => ({
      id: s.id, label: s.label, serve_time: s.serve_time,
      cutoff_minutes_before: s.cutoff_minutes_before, capacity: s.capacity,
    })),
    offers,
    offers_by_party: byParty,
  };
}

/**
 * R5 Meals dashboard data for a slot on a date: order-book fill, locked
 * revenue, kitchen prep aggregation, the incoming-orders list, and the
 * unmatched-request signals the owner can turn into offers.
 */
async function getDashboard(brandId, { slot_date = null, slot_id = null } = {}) {
  const date = slot_date || new Date().toISOString().slice(0, 10);
  const slots = await listSlots(brandId);
  const activeSlot = (slot_id ? slots.find((s) => s.id === slot_id) : slots[0]) || null;

  const { rows: orders } = await db.query(
    `SELECT mo.id, mo.status, mo.amount, mo.party_size, mo.items_json, mo.slot_id,
            mo.delivery_address, mo.distance_km, mo.created_at, u.name AS customer_name
       FROM meal_orders mo
       LEFT JOIN followers f ON f.id = mo.follower_id
       LEFT JOIN users u ON u.id = f.user_id
      WHERE mo.brand_id = $1 AND mo.slot_date = $2
        AND ($3::uuid IS NULL OR mo.slot_id = $3)
      ORDER BY mo.created_at DESC`,
    [brandId, date, activeSlot ? activeSlot.id : null]
  );

  const LIVE = ['paid', 'locked', 'frozen', 'preparing', 'out_for_delivery', 'delivered'];
  const confirmed = orders.filter((o) => LIVE.includes(o.status));
  const capacity = activeSlot ? activeSlot.capacity : null;

  // E4: deterministic demand aggregation (prep counts + revenue + party mix).
  const demand = engine.aggregateDemand(confirmed);

  // E3: live order-book status for the active slot on this date.
  const book = activeSlot
    ? engine.isSlotOpen(activeSlot, date, confirmed.length, new Date())
    : { open: true, reason: null, cutoff: null };

  const { rows: unmatched } = await db.query(
    `SELECT id, raw_text, party_size, slot_label, created_at
       FROM meal_intents
      WHERE brand_id = $1 AND status = 'no_match'
      ORDER BY created_at DESC LIMIT 10`,
    [brandId]
  );

  return {
    slot_date: date,
    slots,
    active_slot: activeSlot,
    order_book: { open: book.open, reason: book.reason, cutoff_at: book.cutoff },
    stats: {
      confirmed: confirmed.length,
      capacity,
      capacity_left: capacity != null ? Math.max(0, capacity - confirmed.length) : null,
      revenue: demand.revenue,
      meals: demand.meals,
    },
    orders,
    prep_summary: demand.prep_summary,
    party_mix: demand.party_mix,
    unmatched,
  };
}

// ── Restaurant chat for offer creation (P-RCHAT) ─────────────────────────────

/**
 * Conversational restaurant-side offer creation. The owner types a plain
 * English description; the AI returns STRUCTURE referencing the owner's
 * real menu items. The backend joins brand_products.price for base
 * calculation when the owner didn't assert a base; the owner's discount
 * + freebies are kept verbatim. On enough info → inserts as
 * meal_offer_rules status='suggested' for the same Accept/Modify/Reject
 * lifecycle as the auto-suggest feed.
 */
async function restaurantChatCreateOffer(brandId, { message, partial_offer } = {}) {
  if ((!message || !String(message).trim()) && !partial_offer) {
    throw new AppError('VALIDATION_ERROR', 'message or partial_offer is required', 422);
  }
  const { rows: menu } = await db.query(
    `SELECT id, name, price, veg_flag, section FROM brand_products
       WHERE brand_id = $1 AND is_active = true ORDER BY name`,
    [brandId]
  );
  if (menu.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Add menu items first — offer creation needs real dishes', 422);
  }

  const parsed = message
    ? await ai.extractRestaurantOffer(message, { menu })
    : partial_offer;

  if ((parsed.missing_fields || []).includes('party_size')) {
    return { stage: 'clarify', question: parsed.clarify_question, parsed };
  }
  if ((parsed.missing_fields || []).includes('items') && parsed.party_size !== 'office') {
    return { stage: 'clarify', question: parsed.clarify_question, parsed };
  }

  // Join menu prices for any item the AI referenced.
  const byId = new Map(menu.map((m) => [m.id, m]));
  const items = (parsed.items || [])
    .map((it) => {
      const p = byId.get(it.product_id);
      if (!p) return null;
      return { product_id: p.id, name: p.name, qty: Number(it.qty) || 1, price: Number(p.price) };
    })
    .filter(Boolean);

  // Base price: owner-asserted wins; else compute from items.
  const computedBase = items.reduce((s, it) => s + it.qty * it.price, 0);
  const base_price = parsed.base_price != null ? Number(parsed.base_price)
                   : (computedBase > 0 ? computedBase : null);

  const { rows } = await db.query(
    `INSERT INTO meal_offer_rules
       (brand_id, name, party_size, offer_kind, items_json, base_price,
        discount_type, discount_value, freebies_json, trigger_json,
        custom_description, source, status)
     VALUES ($1,$2,$3::meal_party_size,$4::meal_offer_kind,$5::jsonb,$6,
             $7,$8,$9::jsonb,$10::jsonb,$11,'custom','suggested')
     RETURNING *`,
    [
      brandId,
      parsed.suggested_name || 'Custom offer',
      parsed.party_size || 'family',
      parsed.offer_kind || 'mixed',
      JSON.stringify(items),
      base_price,
      parsed.discount_type || null,
      parsed.discount_value != null ? Number(parsed.discount_value) : null,
      JSON.stringify(parsed.freebies || []),
      JSON.stringify(parsed.trigger || {}),
      message || (partial_offer && partial_offer.raw_text) || null,
    ]
  );
  return { stage: 'built', parsed, offer_rule: rows[0] };
}

// ── AI auto-suggest offers (P-AI-INTEL) ─────────────────────────────────────

/**
 * Generate AI offer suggestions for a restaurant from its menu + memory.
 * AI returns STRUCTURE only — items + freebies + party_size + offer_kind +
 * suggested_name. Prices are joined HERE from brand_products.price; the AI
 * never sets a rupee. Inserted as meal_offer_rules rows with
 * status='suggested' so the owner can Accept / Modify / Reject.
 */
async function suggestOffersForBrand(brandId) {
  // Load the brand's active menu items (product catalogue).
  const { rows: menu } = await db.query(
    `SELECT id, name, price, veg_flag, section
       FROM brand_products
      WHERE brand_id = $1 AND is_active = true
      ORDER BY section, name`,
    [brandId]
  );
  if (menu.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Add menu items first — AI suggestions need real dishes', 422);
  }

  // Owner-confirmed item costs (learning_type='cost') ground the AI's
  // "low cost → high loyalty" advice in real margins. Attach to each menu
  // item so the model can keep add-ons genuinely cheap; absent cost → null.
  const { rows: costRows } = await db.query(
    `SELECT brand_product_id, value_json FROM meal_restaurant_learnings
      WHERE brand_id = $1 AND learning_type = 'cost' AND brand_product_id IS NOT NULL`,
    [brandId]
  );
  const costById = new Map(costRows.map((c) => [c.brand_product_id, Number(c.value_json && c.value_json.cost)]));
  const menuWithCost = menu.map((m) => ({ ...m, cost: costById.has(m.id) ? costById.get(m.id) : null }));

  // Optional: restaurant memory (learnings) — fed to the prompt for richer prod output.
  const { rows: learnings } = await db.query(
    `SELECT learning_type, value_json FROM meal_restaurant_learnings WHERE brand_id = $1 LIMIT 50`,
    [brandId]
  );
  const memory = {
    learnings: learnings.length ? learnings : [],
    costs_confirmed: costById.size > 0,
  };

  // AI returns structure; backend joins prices.
  const result = await ai.suggestOffers({ menu: menuWithCost, memory });
  const suggestions = (result && result.suggestions) || [];

  const productById = new Map(menu.map((m) => [m.id, m]));
  const inserted = [];
  for (const s of suggestions) {
    const itemsResolved = (s.items || [])
      .map((it) => {
        const p = productById.get(it.product_id);
        if (!p) return null;
        return { product_id: p.id, name: p.name, qty: Number(it.qty) || 1, price: Number(p.price) };
      })
      .filter(Boolean);
    if (itemsResolved.length === 0) continue; // skip AI-hallucinated rows
    const basePrice = itemsResolved.reduce((sum, it) => sum + it.qty * it.price, 0);
    const { rows } = await db.query(
      `INSERT INTO meal_offer_rules
         (brand_id, name, party_size, offer_kind, items_json, base_price,
          freebies_json, source, status, custom_description, recommended)
       VALUES ($1,$2,$3::meal_party_size,$4::meal_offer_kind,$5::jsonb,$6,
               $7::jsonb,'ai','suggested',$8,$9)
       RETURNING *`,
      [
        brandId,
        s.suggested_name || `${s.party_size} pack`,
        s.party_size,
        s.offer_kind || 'mixed',
        JSON.stringify(itemsResolved),
        basePrice,
        JSON.stringify(s.freebies || []),
        s.reasoning || null,
        s.recommended === true,
      ]
    );
    inserted.push(rows[0]);
  }
  return { ai_mode: ai.isMock() ? 'mock' : 'live', suggested: inserted };
}

/**
 * Modify an existing offer BY CHAT (preview-then-accept). Loads the offer +
 * menu, lets the AI apply the owner's plain-English change, joins menu prices,
 * and returns a PREVIEW — nothing is persisted. The brand-web "Apply" button
 * saves via the existing PATCH (updateOfferRule); the offer stays
 * status='suggested' until the owner clicks Accept. A vague instruction
 * returns stage='clarify' with a single follow-up question.
 */
async function modifyOfferByChat(brandId, ruleId, message) {
  if (!message || !String(message).trim()) {
    throw new AppError('VALIDATION_ERROR', 'message is required', 422);
  }
  const { rows: ruleRows } = await db.query(
    `SELECT * FROM meal_offer_rules WHERE id = $1 AND brand_id = $2`, [ruleId, brandId]
  );
  const rule = ruleRows[0];
  if (!rule) throw new AppError('NOT_FOUND', 'Offer rule not found', 404);

  const { rows: menu } = await db.query(
    `SELECT id, name, price, veg_flag, section FROM brand_products
       WHERE brand_id = $1 AND is_active = true ORDER BY name`, [brandId]
  );

  const current = {
    name: rule.name,
    party_size: rule.party_size,
    offer_kind: rule.offer_kind,
    items: Array.isArray(rule.items_json) ? rule.items_json : [],
    base_price: rule.base_price != null ? Number(rule.base_price) : null,
    discount_type: rule.discount_type,
    discount_value: rule.discount_value != null ? Number(rule.discount_value) : null,
    freebies: Array.isArray(rule.freebies_json) ? rule.freebies_json : [],
  };

  const parsed = await ai.modifyOffer(current, message, { menu });

  // Too vague → clarify, no preview.
  if ((parsed.missing_fields || []).length && parsed.clarify_question) {
    return { stage: 'clarify', question: parsed.clarify_question, rule_id: ruleId };
  }

  // Join menu prices for the proposed items (AI never sets a price).
  const byId = new Map(menu.map((m) => [m.id, m]));
  const items = (parsed.items || [])
    .map((it) => {
      const p = byId.get(it.product_id);
      if (!p) return null;
      return { product_id: p.id, name: p.name, qty: Number(it.qty) || 1, price: Number(p.price) };
    })
    .filter(Boolean);
  const computedBase = items.reduce((s, it) => s + it.qty * it.price, 0);
  const base_price = parsed.base_price != null ? Number(parsed.base_price)
                   : (computedBase > 0 ? computedBase : current.base_price);

  // PREVIEW ONLY — the exact field set the owner's Apply will PATCH.
  const proposed = {
    name: parsed.suggested_name || current.name,
    party_size: parsed.party_size || current.party_size,
    offer_kind: parsed.offer_kind || current.offer_kind,
    items_json: items,
    base_price,
    discount_type: parsed.discount_type || null,
    discount_value: parsed.discount_value != null ? Number(parsed.discount_value) : null,
    freebies_json: Array.isArray(parsed.freebies) ? parsed.freebies : [],
    custom_description: parsed.reasoning || rule.custom_description || null,
  };
  return {
    stage: 'preview',
    rule_id: ruleId,
    proposed,
    reasoning: parsed.reasoning || null,
    ai_mode: ai.isMock() ? 'mock' : 'live',
  };
}

/**
 * Active menu with the owner's confirmed cost per item (null when unset).
 * Powers the brand-web cost-capture editor; the same costs feed the suggest
 * prompt so "won't cost you much" advice is margin-grounded.
 */
async function getMenuWithCosts(brandId) {
  const { rows: menu } = await db.query(
    `SELECT id, name, price, section, veg_flag FROM brand_products
      WHERE brand_id = $1 AND is_active = true ORDER BY section, name`, [brandId]
  );
  const { rows: costs } = await db.query(
    `SELECT brand_product_id, value_json FROM meal_restaurant_learnings
      WHERE brand_id = $1 AND learning_type = 'cost' AND brand_product_id IS NOT NULL`, [brandId]
  );
  const costById = new Map(costs.map((c) => [c.brand_product_id, Number(c.value_json && c.value_json.cost)]));
  return menu.map((m) => ({
    id: m.id, name: m.name, price: Number(m.price), section: m.section, veg_flag: m.veg_flag,
    cost: costById.has(m.id) ? costById.get(m.id) : null,
  }));
}

/**
 * Upsert an owner-confirmed cost for one menu item (one cost per product).
 * Stored as a meal_restaurant_learnings row (learning_type='cost',
 * owner_confirmed=true) — the founder's locked rule: money facts are never
 * AI-guessed.
 */
async function upsertProductCost(brandId, { brand_product_id, cost } = {}) {
  if (!brand_product_id) throw new AppError('VALIDATION_ERROR', 'brand_product_id is required', 422);
  const costNum = Number(cost);
  if (!Number.isFinite(costNum) || costNum < 0) {
    throw new AppError('VALIDATION_ERROR', 'cost must be a non-negative number', 422);
  }
  const { rows: prod } = await db.query(
    `SELECT id, name FROM brand_products WHERE id = $1 AND brand_id = $2`, [brand_product_id, brandId]
  );
  if (!prod[0]) throw new AppError('NOT_FOUND', 'Menu item not found', 404);

  const upd = await db.query(
    `UPDATE meal_restaurant_learnings
        SET value_json = $3::jsonb, owner_confirmed = true, source = 'owner', updated_at = now()
      WHERE brand_id = $1 AND learning_type = 'cost' AND brand_product_id = $2
      RETURNING id`,
    [brandId, brand_product_id, JSON.stringify({ cost: costNum })]
  );
  if (upd.rows.length === 0) {
    await db.query(
      `INSERT INTO meal_restaurant_learnings
         (brand_id, brand_product_id, learning_type, key, value_json, confidence, owner_confirmed, source)
       VALUES ($1, $2, 'cost', $3, $4::jsonb, 1.0, true, 'owner')`,
      [brandId, brand_product_id, prod[0].name, JSON.stringify({ cost: costNum })]
    );
  }
  return { brand_product_id, cost: costNum };
}

// ── AI chat brain (X1) ───────────────────────────────────────────────────────

async function getCustomerPreferences(followerId) {
  const { rows } = await db.query(
    `SELECT * FROM meal_customer_preferences WHERE follower_id = $1`, [followerId]);
  return rows[0] || null;
}

/**
 * Customer chat → structured intent → offers (X1). The AI (mock locally)
 * extracts intent, pre-filling from the customer's remembered
 * preferences and asking ONE meaningful follow-up only for genuinely
 * missing fields. Once enough is known it persists the intent, runs the
 * deterministic engine, and the AI recommends among the priced offers.
 * AI returns STRUCTURE only — prices come from the engine.
 */
/**
 * Customer chat. Two-step UX (founder's lock):
 *
 *   1. Customer sends message → backend extracts intent. If the
 *      drop_location is missing → returns stage='address_required'
 *      with the customer's saved addresses (+ a hint to use device
 *      GPS). NO offers computed yet — we won't suggest before we
 *      know where to deliver.
 *   2. Customer picks an address → POST /meals/chat again with
 *      `drop_location: { lat, lng, label, address }` (and the
 *      previous extracted intent or a fresh message). Backend
 *      persists the intent + drop, applies the ADMIN platform
 *      radius to find in-range restaurants, and returns offers.
 *
 * In-store chat (brand_id passed) honours the same range rule:
 * a chosen drop_location outside admin radius of THIS restaurant
 * returns stage='out_of_range'.
 */
async function chat(userId, {
  message = null,
  slot_date = null,
  brand_id = null,
  drop_location = null,
  partial_intent = null,
} = {}) {
  const followerId = await followerIdForUser(userId);
  const prefs = await getCustomerPreferences(followerId);
  const memory = prefs ? {
    spice_pref: prefs.spice_pref,
    budget_per_head: prefs.budget_per_head,
    favourite_brand_ids: prefs.favourite_brand_ids,
    cuisines: prefs.cuisines,
  } : {};

  // Step 1 → extract from message (or trust caller-supplied partial_intent).
  let extracted;
  if (message && String(message).trim()) {
    extracted = await ai.extractIntent(message, { memory });
  } else if (partial_intent) {
    extracted = partial_intent;
  } else {
    throw new AppError('VALIDATION_ERROR', 'message or partial_intent is required', 422);
  }

  // One meaningful clarify for blocking missing fields BEFORE asking for an address.
  const blocking = (extracted.missing_fields || []).some((f) => f === 'party_size' || f === 'items');
  if (blocking && extracted.clarify_question) {
    return { stage: 'clarify', question: extracted.clarify_question, extracted, memory };
  }

  // Step 1.5 → address required. We will NOT compute offers without a delivery
  // location: the admin radius determines which restaurants we're allowed to
  // route to, and the delivery is part of the deal.
  if (!hasUsableDrop(drop_location)) {
    const saved = await listFollowerAddresses(followerId);
    return {
      stage: 'address_required',
      question: 'Where should we deliver this?',
      extracted,
      saved_addresses: saved,
      use_current_location: true, // mobile renders the GPS button
    };
  }

  // In-store chat: hard-fail before persisting an intent if the chosen
  // address is outside the platform radius from THIS restaurant.
  if (brand_id) {
    const range = await brandInRange(brand_id, drop_location);
    if (!range.ok) {
      return {
        stage: 'out_of_range',
        message: 'Sorry — this restaurant is outside the delivery range from your address.',
        distance_km: range.distance_km,
        extracted,
      };
    }
  }

  // Step 2 → persist the intent + drop_location, compute offers.
  const intent = await createIntent(userId, {
    brand_id,
    party_size: extracted.party_size,
    veg_count: extracted.veg_count,
    nonveg_count: extracted.nonveg_count,
    items_json: extracted.items || [],
    spice_level: extracted.spice_level,
    occasion: extracted.occasion,
    slot_label: extracted.slot_label,
    slot_date: slot_date || extracted.slot_date,
    budget_per_head: extracted.budget_per_head,
    drop_location,
    raw_text: message || (partial_intent && partial_intent.raw_text) || null,
    parsed_json: extracted,
  });

  const result = await computeOffers(intent.id);
  if (result.intent_status === 'no_match') {
    return { stage: 'no_match', intent, message: 'Sorry — no match for your request right now.' };
  }
  const recommendation = await ai.recommendOffer(result.offers, { memory });
  return { stage: 'offers', intent, offers: result.offers, recommendation };
}

module.exports = {
  brandIdForUser,
  followerIdForUser,
  getCustomerPreferences,
  chat,
  upsertConfig,
  createSlot,
  createOfferRule,
  computePrice,
  createIntent,
  computeOffers,
  lockAndPay,
  getOrder,
  markDelivered,
  getConfig,
  listSlots,
  listOfferRules,
  updateOfferRule,
  getDashboard,
  getStore,
  getPlatformSettings,
  updatePlatformSettings,
  effectiveRadiusKm,
  suggestOffersForBrand,
  restaurantChatCreateOffer,
  modifyOfferByChat,
  getMenuWithCosts,
  upsertProductCost,
};
