'use strict';

/**
 * Which listing tree a brand belongs to.
 * Contract: features/collab-terms-by-aim (item 9)
 *
 * This logic existed in TWO places, written the same wrong way in both:
 *
 *     cat.startsWith('fashion') ? 'fashion' : cat
 *
 * It is case-SENSITIVE, and brands carry both 'Fashion' and 'fashion' in production. So a
 * brand whose category is capitalised resolved to a vertical named 'Fashion' — which
 * matches no node — and its tree came back EMPTY. Verified against production before the
 * fix: Kanchi Silks, the practice brand with 11 products, returned
 * `vertical=Fashion, tree=[]`.
 *
 * It lives here so there is one answer rather than two copies drifting apart — which is
 * exactly how the same bug came to exist twice.
 *
 * A vertical is also NOT the same thing as a brand category: a restaurant has no listing
 * tree at all. Returning null says so, instead of inventing a vertical with no nodes and
 * leaving a screen to guess why nothing came back.
 */

const VERTICALS = ['fashion', 'furniture'];

function verticalFor(brandCategory) {
  const cat = String(brandCategory || '').trim().toLowerCase();
  if (!cat) return null;
  return VERTICALS.find(v => cat.startsWith(v)) || null;
}

module.exports = { verticalFor, VERTICALS };
