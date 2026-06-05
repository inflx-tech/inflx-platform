'use strict';

/**
 * Pure-logic tests for the dish flywheel (no DB).
 * Contract: features/listing-restaurant-search-flywheel — Workflow C.
 */

const { normalizeName, findPromotionCandidates } = require('../src/services/dishFlywheel.service');

describe('dishFlywheel.normalizeName', () => {
  test('lowercases, trims, collapses whitespace', () => {
    expect(normalizeName('  Perugu   Vada ')).toBe('perugu vada');
  });
  test('strips diacritics so accents group together', () => {
    expect(normalizeName('Crème Brûlée')).toBe('creme brulee');
  });
  test('handles empty / null', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName('')).toBe('');
  });
});

describe('dishFlywheel.findPromotionCandidates', () => {
  function rowsForName(name, brandCount, suggested = null) {
    return Array.from({ length: brandCount }, (_, i) => ({
      norm_name: name, brand_id: `b${name}-${i}`, suggested_master_dish_id: suggested,
    }));
  }

  test('flags a name seen at >= threshold distinct restaurants with no match', () => {
    const rows = [...rowsForName('perugu vada', 5), ...rowsForName('pongal', 1)];
    expect(findPromotionCandidates(rows, 5)).toEqual([{ name: 'perugu vada', count: 5 }]);
  });

  test('excludes names below threshold', () => {
    const rows = rowsForName('perugu vada', 4);
    expect(findPromotionCandidates(rows, 5)).toEqual([]);
  });

  test('excludes names that already have a confident canonical match', () => {
    const rows = rowsForName('dahi vada', 6, 42); // suggested_master_dish_id set
    expect(findPromotionCandidates(rows, 5)).toEqual([]);
  });

  test('counts DISTINCT restaurants, not rows', () => {
    const dupBrand = Array.from({ length: 6 }, () => ({
      norm_name: 'ragi mudde', brand_id: 'same-brand', suggested_master_dish_id: null,
    }));
    expect(findPromotionCandidates(dupBrand, 5)).toEqual([]); // 6 rows, 1 brand
  });

  test('sorts multiple candidates by descending count', () => {
    const rows = [...rowsForName('a', 7), ...rowsForName('b', 5)];
    expect(findPromotionCandidates(rows, 5)).toEqual([
      { name: 'a', count: 7 }, { name: 'b', count: 5 },
    ]);
  });
});
