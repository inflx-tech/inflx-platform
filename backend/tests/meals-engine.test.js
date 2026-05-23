'use strict';

/**
 * meals-engine.test.js — INFLX Meals deterministic engine (P3), pure unit.
 * No DB. Contract: features/meals-engine/.
 */

const e = require('../src/services/mealsEngine.service');

describe('E1 routing — haversine + radius + ranking', () => {
  test('haversineKm: Jubilee Hills → Banjara Hills ≈ a few km', () => {
    const d = e.haversineKm({ lat: 17.4239, lng: 78.4080 }, { lat: 17.4133, lng: 78.4378 });
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(5);
  });
  test('haversineKm: missing coords → Infinity', () => {
    expect(e.haversineKm({ lat: null }, { lat: 1, lng: 1 })).toBe(Infinity);
  });
  test('withinRadius respects the limit', () => {
    const a = { lat: 17.42, lng: 78.40 };
    expect(e.withinRadius(a, { lat: 17.42, lng: 78.40 }, 5).ok).toBe(true);
    expect(e.withinRadius(a, { lat: 17.90, lng: 78.90 }, 5).ok).toBe(false);
  });
  test('rankCandidates: favourites first, then cheapest, then nearest', () => {
    const ranked = e.rankCandidates([
      { brand_id: 'a', price: 800, distance_km: 4 },
      { brand_id: 'b', price: 700, distance_km: 3 },
      { brand_id: 'fav', price: 900, distance_km: 2 },
    ], { favouriteBrandIds: ['fav'] });
    expect(ranked[0].brand_id).toBe('fav');     // favourite wins despite higher price
    expect(ranked[1].brand_id).toBe('b');       // then cheapest
    expect(ranked[2].brand_id).toBe('a');
  });
});

describe('E2 pricing — discount clock + engine offer', () => {
  const clock = [
    { unit: 'day', n: 1, pct: 20 },
    { unit: 'hour', n: 5, pct: 12 },
    { unit: 'hour', n: 2, pct: 5 },
  ];
  test('clockDiscountPct: earlier order = bigger discount', () => {
    expect(e.clockDiscountPct(clock, 30)).toBe(20);  // >24h → 1-day rung
    expect(e.clockDiscountPct(clock, 10)).toBe(12);  // ≥5h  → 5-hour rung
    expect(e.clockDiscountPct(clock, 3)).toBe(5);    // ≥2h  → 2-hour rung
    expect(e.clockDiscountPct(clock, 1)).toBe(0);    // <2h  → no rung
  });
  test('computeEngineOffer: rule discount + clock, capped at max', () => {
    const rule = { base_price: 1000, discount_type: 'flat', discount_value: 100 }; // 10%
    const out = e.computeEngineOffer(rule, { max_discount_pct: 25, discount_clock: clock }, { hoursUntilServe: 30 });
    // 10% rule + 20% clock = 30% → capped at 25% → 750
    expect(out.effective_pct).toBe(25);
    expect(out.price).toBe(750);
  });
  test('computeEngineOffer: never_below_cost floors the price', () => {
    const rule = { base_price: 1000, discount_type: 'percentage', discount_value: 50 };
    const out = e.computeEngineOffer(rule, { max_discount_pct: 80, never_below_cost: true }, { costFloor: 600 });
    expect(out.price).toBe(600);
    expect(out.floored).toBe(true);
  });
  test('computeEngineOffer: items sum when no base_price', () => {
    const rule = { items_json: [{ price: 300, qty: 2 }, { price: 220, qty: 2 }] };
    const out = e.computeEngineOffer(rule, {}, {});
    expect(out.base).toBe(1040);
    expect(out.price).toBe(1040);
  });
});

describe('E3 slot clock — cutoff + freeze + full', () => {
  const slot = { serve_time: '13:00:00', cutoff_minutes_before: 120, capacity: 40 };
  test('open well before cutoff', () => {
    const now = new Date('2026-05-24T08:00:00');
    expect(e.isSlotOpen(slot, '2026-05-24', 5, now).open).toBe(true);
  });
  test('frozen at/after cutoff (11:00 for a 13:00 serve)', () => {
    const now = new Date('2026-05-24T11:30:00');
    const r = e.isSlotOpen(slot, '2026-05-24', 5, now);
    expect(r.open).toBe(false);
    expect(r.reason).toBe('frozen');
  });
  test('full when capacity reached', () => {
    const now = new Date('2026-05-24T08:00:00');
    const r = e.isSlotOpen(slot, '2026-05-24', 40, now);
    expect(r.open).toBe(false);
    expect(r.reason).toBe('full');
  });
});

describe('E4 demand aggregation', () => {
  test('aggregates prep counts, meals, revenue, party mix', () => {
    const d = e.aggregateDemand([
      { amount: 950, party_size: 'family', items_json: [{ name: 'Chicken Biryani', qty: 2 }, { name: 'Veg Biryani', qty: 2 }] },
      { amount: 300, party_size: 'single', items_json: [{ name: 'Chicken Biryani', qty: 1 }] },
    ]);
    expect(d.revenue).toBe(1250);
    expect(d.meals).toBe(5);
    expect(d.prep_summary[0]).toEqual({ name: 'Chicken Biryani', qty: 3 });
    expect(d.party_mix).toEqual(expect.arrayContaining([
      { party_size: 'family', count: 1 }, { party_size: 'single', count: 1 },
    ]));
  });
});
