'use strict';

/**
 * Which Aims must name their content — deliverables.model.
 * Contract: features/hybrid-signature-and-the-silent-refusal
 *
 * Rules v1.21 §7, what each side may counter:
 *   Pay for Content → fee, DELIVERABLES (content types and counts), usage rights
 *   Hybrid          → fixed fee and commission percentage. No deliverables.
 *   Pay for Sale    → commission percentage.
 *
 * Hybrid was counted as content-buying, so a Hybrid set with no formats could not be
 * countersigned at all — the brand tapped Sign and the server refused, every time. Found in
 * production 2026-09-17 on INFLX-2026-00003 (hybrid, ₹4,000, formats []).
 */
const { plannedDeliverables, requiresContent } = require('../src/services/deliverables.model');

describe('which Aims must name their content', () => {
  test('Pay for Content must, and says so in the brand own words', () => {
    const r = plannedDeliverables('engagement', []);
    expect(r.formats).toEqual([]);
    expect(r.error).toMatch(/has to say what content/i);
    expect(requiresContent('engagement')).toBe(true);
  });

  test('⚠️ Hybrid must NOT — fixed money plus shoppable posts is a whole collaboration', () => {
    const r = plannedDeliverables('hybrid', []);
    expect(r.error).toBeNull();
    expect(r.formats).toEqual([]);
    expect(requiresContent('hybrid')).toBe(false);
  });

  test('a Hybrid set that DOES name content still gets those deliverables', () => {
    const r = plannedDeliverables('hybrid', [{ type: 'reel', count: 2 }]);
    expect(r.error).toBeNull();
    expect(r.formats).toEqual([{ type: 'reel', count: 2 }]);
  });

  test('Pay for Sale must not, and never did', () => {
    const r = plannedDeliverables('conversion', []);
    expect(r.error).toBeNull();
    expect(r.formats).toEqual([]);
  });
});
