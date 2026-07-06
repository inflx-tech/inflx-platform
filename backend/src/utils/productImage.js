'use strict';

/**
 * productImage.js — single source of truth for "the product's cover image".
 *
 * A product's images live in several places (contract: product-image-resolution):
 *   - image_url                        the derived cover column (set on save)
 *   - variants_json.colors[].images[]  per-colour uploads (the wizard's real store)
 *   - variants_json.cover_images[]     explicit cover picks
 *   - facets._images[]                 batch-add cover snapshot
 *
 * The EDIT form always fell back through these; the listing browse and the
 * follower app read image_url ONLY — so a product whose cover was never derived
 * showed blank there while edit showed it. resolveProductImage() gives every
 * read surface the SAME fallback the edit form uses, so they can't diverge.
 *
 * Pure + defensive: accepts jsonb already parsed OR a JSON string OR null.
 */

function asObj(v) {
  if (!v) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  return typeof v === 'object' ? v : null;
}

function firstUrl(arr) {
  if (!Array.isArray(arr)) return null;
  for (const x of arr) {
    const u = typeof x === 'string' ? x : (x && (x.url || x.image_url));
    if (u && String(u).trim()) return String(u).trim();
  }
  return null;
}

// Resolve the best cover URL for a product row. Order mirrors the edit form's
// own preference: an explicit image_url wins; else cover_images; else the first
// per-colour image; else the batch facets snapshot. Returns null if none exist.
function resolveProductImage(row) {
  if (!row) return null;
  const direct = row.image_url;
  if (direct && String(direct).trim()) return String(direct).trim();

  const vj = asObj(row.variants_json);
  if (vj) {
    const cover = firstUrl(vj.cover_images);
    if (cover) return cover;
    if (Array.isArray(vj.colors)) {
      for (const c of vj.colors) {
        const u = firstUrl(c && c.images);
        if (u) return u;
      }
    }
  }
  const facets = asObj(row.facets);
  if (facets) {
    const fim = firstUrl(facets._images);
    if (fim) return fim;
  }
  return null;
}

module.exports = { resolveProductImage };
