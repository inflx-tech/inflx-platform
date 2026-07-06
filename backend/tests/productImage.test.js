'use strict';

/**
 * resolveProductImage — pure cover-resolution used by every product read
 * surface (contract: product-image-resolution). No DB.
 */

const { resolveProductImage } = require('../src/utils/productImage');

describe('resolveProductImage — cover fallback order', () => {
  const IMG = 'https://cdn/x/media/assets/a';

  test('prefers an explicit image_url', () => {
    expect(resolveProductImage({ image_url: IMG, variants_json: { cover_images: ['other'] } })).toBe(IMG);
  });

  test('falls back to variants_json.cover_images', () => {
    expect(resolveProductImage({ image_url: null, variants_json: { cover_images: [IMG] } })).toBe(IMG);
  });

  test('falls back to the first per-colour image (the wizard store)', () => {
    const row = { image_url: '', variants_json: { colors: [{ color: 'Red', images: [] }, { color: 'Blue', images: [IMG] }] } };
    expect(resolveProductImage(row)).toBe(IMG);
  });

  test('falls back to facets._images last', () => {
    expect(resolveProductImage({ image_url: null, variants_json: { colors: [] }, facets: { _images: [IMG] } })).toBe(IMG);
  });

  test('accepts JSON strings (jsonb-as-text) without throwing', () => {
    const row = { image_url: '', variants_json: JSON.stringify({ colors: [{ images: [IMG] }] }) };
    expect(resolveProductImage(row)).toBe(IMG);
  });

  test('returns null when no image exists anywhere', () => {
    expect(resolveProductImage({ image_url: null, variants_json: { sku: 'X', cover_images: [] }, facets: {} })).toBeNull();
    expect(resolveProductImage({})).toBeNull();
    expect(resolveProductImage(null)).toBeNull();
  });

  test('tolerates malformed json / non-array image fields', () => {
    expect(resolveProductImage({ variants_json: 'not json', facets: { _images: 'nope' } })).toBeNull();
    expect(resolveProductImage({ variants_json: { colors: 'bad' } })).toBeNull();
  });

  test('supports object-shaped image entries ({url})', () => {
    expect(resolveProductImage({ variants_json: { cover_images: [{ url: IMG }] } })).toBe(IMG);
  });
});
