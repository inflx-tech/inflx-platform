'use strict';

/**
 * section-library.test.js — Phase 3a (contract: merch-engine-p3a-section-library-engine).
 *
 * Pure validation coverage for the data-driven section rule. The SQL evaluator
 * (sectionRules.library_products) is exercised end-to-end when a section is placed
 * and rendered in contract 3c; here we lock the rule-definition CONTRACT that the
 * admin rule-builder (3b) and the evaluator both depend on.
 */

const sectionLibrary = require('../src/services/sectionLibrary.service');

describe('Section Library — rule validation (Phase 3a)', () => {
  test('defaults sort to newest when absent/invalid', () => {
    expect(sectionLibrary.validateRule({}).sort).toBe('newest');
    expect(sectionLibrary.validateRule({ sort: 'bogus' }).sort).toBe('newest');
  });

  test('keeps valid sort values', () => {
    for (const s of ['newest', 'price_asc', 'price_desc']) {
      expect(sectionLibrary.validateRule({ sort: s }).sort).toBe(s);
    }
  });

  test('normalizes tags (trim, lowercase, dedupe) and drops empties', () => {
    const out = sectionLibrary.validateRule({ tags: [' Summer ', 'summer', 'CASUAL', ''] });
    expect(out.tags.sort()).toEqual(['casual', 'summer']);
  });

  test('omits tags when none valid', () => {
    expect(sectionLibrary.validateRule({ tags: ['', '  '] }).tags).toBeUndefined();
    expect(sectionLibrary.validateRule({}).tags).toBeUndefined();
  });

  test('throws on non-array tags', () => {
    expect(() => sectionLibrary.validateRule({ tags: 'summer' })).toThrow(/tags must be an array/);
  });

  test('coerces price strings to numbers; rejects negatives', () => {
    const out = sectionLibrary.validateRule({ price_min: '100', price_max: '499' });
    expect(out.price_min).toBe(100);
    expect(out.price_max).toBe(499);
    expect(() => sectionLibrary.validateRule({ price_min: -1 })).toThrow(/non-negative/);
  });

  test('rejects price_min > price_max', () => {
    expect(() => sectionLibrary.validateRule({ price_min: 500, price_max: 100 }))
      .toThrow(/price_min must be ≤ price_max/);
  });

  test('keeps a valid subcategory_node_id, rejects empty', () => {
    expect(sectionLibrary.validateRule({ subcategory_node_id: 'node-1' }).subcategory_node_id).toBe('node-1');
    expect(() => sectionLibrary.validateRule({ subcategory_node_id: '   ' }))
      .toThrow(/subcategory_node_id/);
  });
});
