'use strict';

/**
 * mealsEngine.service.js — INFLX Meals deterministic engine (P3).
 *
 * PURE functions only — no DB, no AI, no I/O. Every rupee and every
 * routing/timing decision is computed here so it's testable in
 * isolation and identical every run. The AI layer (X1) may pick
 * structure/ranking inputs, but prices and eligibility come from here.
 *
 *   E1 routing      — haversineKm, withinRadius, rankCandidates
 *   E2 pricing      — clockDiscountPct, computeEngineOffer (margin floor)
 *   E3 slot clock   — slotServeAt, slotCutoffAt, isSlotOpen (freeze/full)
 *   E4 aggregation  — aggregateDemand
 */

const EARTH_KM = 6371;
const UNIT_HOURS = { day: 24, hour: 1, minute: 1 / 60 };

const round = (n) => Math.round(n);
const round2 = (n) => Math.round(n * 100) / 100;

// ── E1 routing ───────────────────────────────────────────────────────────────

function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return round2(EARTH_KM * 2 * Math.asin(Math.sqrt(h)));
}

function withinRadius(from, to, radiusKm) {
  const d = haversineKm(from, to);
  return { ok: d <= (Number(radiusKm) || 0), distance_km: d === Infinity ? null : d };
}

/**
 * Deterministic ranking of candidate offers:
 *   favourites first → cheapest price → nearest distance.
 * Stable + total order so the shortlist is identical every run.
 */
function rankCandidates(candidates, { favouriteBrandIds = [] } = {}) {
  const favs = new Set(favouriteBrandIds || []);
  return [...candidates].sort((a, b) => {
    const fa = favs.has(a.brand_id) ? 0 : 1;
    const fb = favs.has(b.brand_id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    if (a.price !== b.price) return a.price - b.price;
    return (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9);
  });
}

// ── E2 pricing ─────────────────────────────────────────────────────────────-

function ruleBase(rule) {
  const items = Array.isArray(rule.items_json) ? rule.items_json : [];
  const sum = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  return rule.base_price != null ? Number(rule.base_price) : sum;
}

function ruleDiscountPct(rule) {
  const base = ruleBase(rule);
  if (!base) return 0;
  if (rule.discount_type === 'percentage' && rule.discount_value != null) return Number(rule.discount_value);
  if (rule.discount_type === 'flat' && rule.discount_value != null) return (Number(rule.discount_value) / base) * 100;
  return 0;
}

/**
 * The editable discount clock = early-bird decay. Each rung is
 * "{n} {unit}(s) before → {pct}% off". The earlier you order the
 * bigger the discount, so the applicable rung is the LARGEST lead-time
 * threshold you have still cleared. Past the smallest rung → 0%.
 */
function clockDiscountPct(discountClock, hoursUntilServe) {
  if (!Array.isArray(discountClock) || hoursUntilServe == null) return 0;
  let bestPct = 0;
  let bestThreshold = -1;
  for (const rung of discountClock) {
    const h = (Number(rung.n) || 0) * (UNIT_HOURS[rung.unit] ?? 1);
    if (h <= hoursUntilServe && h > bestThreshold) { bestThreshold = h; bestPct = Number(rung.pct) || 0; }
  }
  return bestPct;
}

/**
 * Compose the final offer price for a rule given the restaurant config
 * and timing. Combines the rule's own discount with the time-decay
 * clock, caps the total at config.max_discount_pct, and (if
 * never_below_cost + a confirmed costFloor is supplied) floors the
 * price at cost. Returns whole-rupee price + the breakdown.
 */
function computeEngineOffer(rule, config = {}, ctx = {}) {
  const base = ruleBase(rule);
  const maxPct = config.max_discount_pct != null ? Number(config.max_discount_pct) : 100;
  const rPct = ruleDiscountPct(rule);
  const cPct = clockDiscountPct(config.discount_clock, ctx.hoursUntilServe);
  let effective = Math.min(rPct + cPct, maxPct);
  let price = base * (1 - effective / 100);
  let floored = false;
  if (config.never_below_cost && ctx.costFloor != null && price < Number(ctx.costFloor)) {
    price = Number(ctx.costFloor);
    floored = true;
    effective = base ? (1 - price / base) * 100 : 0;
  }
  return {
    base: round(base),
    rule_pct: round2(rPct),
    clock_pct: round2(cPct),
    effective_pct: round2(effective),
    price: round(price),
    floored,
  };
}

// ── E3 slot clock / freeze ─────────────────────────────────────────────────-

function slotServeAt(slot, slotDate) {
  if (!slot || !slotDate || !slot.serve_time) return null;
  return new Date(`${slotDate}T${String(slot.serve_time).slice(0, 8)}`);
}

function slotCutoffAt(slot, slotDate) {
  const serve = slotServeAt(slot, slotDate);
  if (!serve) return null;
  return new Date(serve.getTime() - (Number(slot.cutoff_minutes_before) || 0) * 60000);
}

/** Is the order book open for this slot/date? Closed = frozen (past
 * cutoff) or full (capacity reached). */
function isSlotOpen(slot, slotDate, confirmedCount = 0, now = new Date()) {
  const cutoff = slotCutoffAt(slot, slotDate);
  if (cutoff && now.getTime() >= cutoff.getTime()) return { open: false, reason: 'frozen', cutoff };
  if (slot && slot.capacity != null && confirmedCount >= Number(slot.capacity)) {
    return { open: false, reason: 'full', cutoff };
  }
  return { open: true, reason: null, cutoff };
}

function hoursUntil(date, now = new Date()) {
  if (!date) return null;
  return (new Date(date).getTime() - now.getTime()) / 3600000;
}

// ── E4 demand aggregation ────────────────────────────────────────────────────

function aggregateDemand(orders = []) {
  const prep = {};
  const byParty = {};
  let meals = 0;
  let revenue = 0;
  for (const o of orders) {
    revenue += Number(o.amount || 0);
    byParty[o.party_size || 'unknown'] = (byParty[o.party_size || 'unknown'] || 0) + 1;
    for (const it of (o.items_json || [])) {
      const q = Number(it.qty) || 1;
      meals += q;
      const name = it.name || 'Item';
      prep[name] = (prep[name] || 0) + q;
    }
  }
  return {
    meals,
    revenue,
    prep_summary: Object.entries(prep).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty),
    party_mix: Object.entries(byParty).map(([party_size, count]) => ({ party_size, count })),
  };
}

module.exports = {
  haversineKm,
  withinRadius,
  rankCandidates,
  ruleBase,
  ruleDiscountPct,
  clockDiscountPct,
  computeEngineOffer,
  slotServeAt,
  slotCutoffAt,
  isSlotOpen,
  hoursUntil,
  aggregateDemand,
};
