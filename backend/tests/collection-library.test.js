'use strict';

/**
 * collection-library.test.js — Phase 4a (contract: merch-engine-p4a-collections-engine).
 * Pure validation coverage for the collection contract (the admin builder in 4b + the
 * engine expansion both depend on it). Render is exercised once a collection is placed (4b).
 */

const collectionLibrary = require('../src/services/collectionLibrary.service');

describe('Collection Library — validation (Phase 4a)', () => {
  test('requires a non-empty name', () => {
    expect(() => collectionLibrary.validateCollection({})).toThrow(/name is required/);
    expect(() => collectionLibrary.validateCollection({ name: '  ' })).toThrow(/name is required/);
    expect(collectionLibrary.validateCollection({ name: ' Summer ' }).name).toBe('Summer');
  });

  test('section_ids must be an array; trims + dedupes preserving order', () => {
    expect(() => collectionLibrary.validateCollection({ name: 'X', section_ids: 'a' })).toThrow(/array/);
    const out = collectionLibrary.validateCollection({ name: 'X', section_ids: [' a ', 'b', 'a', ''] });
    expect(out.section_ids).toEqual(['a', 'b']);
  });

  test('section_ids omitted → not set (partial update friendly)', () => {
    expect(collectionLibrary.validateCollection({ name: 'X' }).section_ids).toBeUndefined();
  });

  test('business_type / image_url normalize to null when blank', () => {
    const out = collectionLibrary.validateCollection({ name: 'X', business_type: '', image_url: '' });
    expect(out.business_type).toBeNull();
    expect(out.image_url).toBeNull();
  });
});
