import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: bulk listing actions — eligibility rules (pure, L1).
 * Contract: features/listing-bulk-move-and-offer/ (locked 2026-08-04).
 *
 * Locks the decisions behind the Inventory bulk bar's Move-category and
 * Attach-offer actions: which moves are legal, which offers can take a product
 * list at all, and that merging never disturbs the rest of an offer config.
 *
 * No DB, no network. The rules under test are pure functions in
 * backend/src/services/listingBulkActions.service.js — the controllers only
 * fetch and write.
 *
 * These are REFUSAL rules, so the negative cases are the point: a bulk action
 * that silently drops rows is worse than one that refuses them out loud.
 */

// listingBulkActions → taxonomy.service → config/db → config/env, which
// HARD-VALIDATES required env at module load. The rules under test are pure and
// read none of these; this is an import shim, not a behaviour stub. Mirrors the
// same shim in money-math.spec.ts.
process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rules = require('../../backend/src/services/listingBulkActions.service');
const { canMoveProduct, offerAcceptsProducts, mergeOfferProducts } = rules;

// ── fixtures ────────────────────────────────────────────────────────────────

const shirtsLeaf = {
  id: 'node-shirts', name: 'Shirts', is_leaf: true,
  vertical: 'fashion', segment: 'Men', category: 'Topwear', size_system: 'alpha',
};
const shoesLeaf = {
  id: 'node-shoes', name: 'Formal Shoes', is_leaf: true,
  vertical: 'fashion', segment: 'Men', category: 'Footwear', size_system: 'uk_men',
};
const kurtaLeaf = {
  id: 'node-kurta', name: 'Kurtas', is_leaf: true,
  vertical: 'fashion', segment: 'Men', category: 'Ethnic', size_system: 'free_size',
};
const topwearBranch = { id: 'node-topwear', name: 'Topwear', is_leaf: false, vertical: 'fashion' };

// A leaf whose only extra requirement is Sleeve length.
const sleeveDefs = [
  { facet_key: 'size', label: 'Size', input_type: 'multi_select', allowed_values: [] },
  { facet_key: 'sleeve_length', label: 'Sleeve length', required: 'required',
    input_type: 'single_select', allowed_values: ['Half', 'Full'] },
];
// A leaf with no required facets beyond the built-ins.
const looseDefs = [
  { facet_key: 'size', label: 'Size', input_type: 'multi_select', allowed_values: [] },
];

const product = (over = {}) => ({
  id: 'p1', name: 'Oxford Shirt', price: 1299,
  category_node_id: 'node-shirts',
  facets: { size: ['M', 'L'], brand: 'Arrow' },
  ...over,
});

// ── Move: what is allowed ───────────────────────────────────────────────────

test('a product moves to a sibling leaf that requires nothing it lacks', () => {
  const v = canMoveProduct({
    product: product(), targetNode: { ...shirtsLeaf, id: 'node-tshirts', name: 'T-Shirts' },
    targetFacetDefs: looseDefs,
  });
  expect(v.ok).toBe(true);
});

test('a move into a parent category is refused — products live on leaves', () => {
  const v = canMoveProduct({ product: product(), targetNode: topwearBranch, targetFacetDefs: [] });
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('item type');
});

test('a move into the category it already sits in is refused, not silently applied', () => {
  const v = canMoveProduct({ product: product(), targetNode: shirtsLeaf, targetFacetDefs: looseDefs });
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('Already');
});

test('a missing required facet refuses the move and NAMES the facet', () => {
  const v = canMoveProduct({
    product: product({ facets: { size: ['M'] } }),   // no sleeve_length
    targetNode: { ...shirtsLeaf, id: 'node-formal', name: 'Formal Shirts' },
    targetFacetDefs: sleeveDefs,
  });
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('Sleeve length');
});

test('a vanished target node refuses rather than throwing', () => {
  const v = canMoveProduct({ product: product(), targetNode: null, targetFacetDefs: [] });
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('no longer exists');
});

// ── Move: sizes are checked against the TARGET's vocabulary ─────────────────

test('alpha sizes cannot move into a UK-sized leaf, and the bad sizes are named', () => {
  const v = canMoveProduct({
    product: product({ facets: { size: ['M', 'L'] } }),
    targetNode: shoesLeaf, targetFacetDefs: looseDefs,
  });
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('M');
  expect(v.reason).toMatch(/re-pick its sizes/i);
});

test('a size change is judged on the VALUES, not on the systems differing', () => {
  // free_size → alpha is a system change, but "Free Size" is not a valid alpha
  // value, so it must still refuse...
  const bad = canMoveProduct({
    product: product({ facets: { size: ['Free Size'] } }),
    targetNode: { ...shirtsLeaf, id: 'node-casual', name: 'Casual Shirts' },
    targetFacetDefs: looseDefs,
  });
  expect(bad.ok).toBe(false);

  // ...while a genuinely compatible value passes even though the leaf differs.
  const good = canMoveProduct({
    product: product({ facets: { size: ['Free Size'] }, category_node_id: 'node-other' }),
    targetNode: kurtaLeaf, targetFacetDefs: looseDefs,
  });
  expect(good.ok).toBe(true);
});

test('a size-less product is refused by a leaf that REQUIRES sizes', () => {
  // taxonomy.sizeRequired(): any non-free size system makes Size required. So a
  // product carrying no sizes cannot land in UK-sized footwear — the size check
  // above passes vacuously, then validateItem catches the real problem.
  const v = canMoveProduct({
    product: product({ facets: { brand: 'Arrow' } }),
    targetNode: shoesLeaf, targetFacetDefs: looseDefs,
  });
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('Size');
});

test('a size-less product moves freely into a free-size leaf', () => {
  const v = canMoveProduct({
    product: product({ facets: { brand: 'Arrow' }, category_node_id: 'node-other' }),
    targetNode: kurtaLeaf, targetFacetDefs: looseDefs,
  });
  expect(v.ok).toBe(true);
});

// ── Attach: which offers can take a product list ────────────────────────────

const offer = (over = {}) => ({
  id: 'o1', offer_type: 'discount',
  offer_config_json: { sub_type: 'pct', value: 10, scope: 'products', products: [{ id: 'p9' }] },
  ...over,
});

test('a product-scoped discount accepts an attachment', () => {
  expect(offerAcceptsProducts(offer()).ok).toBe(true);
});

test('a product-scoped volume offer accepts an attachment', () => {
  const v = offerAcceptsProducts(offer({
    offer_type: 'volume',
    offer_config_json: { tiers: [{ min_spend: 999, pct_off: 10 }], scope: 'products', products: [{ id: 'p9' }] },
  }));
  expect(v.ok).toBe(true);
});

test('a store-scoped offer is refused — attaching there would be a silent no-op', () => {
  const v = offerAcceptsProducts(offer({
    offer_config_json: { sub_type: 'pct', value: 10, scope: 'store', products: [] },
  }));
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('whole store');
});

test('a category-scoped offer is refused for the same reason', () => {
  const v = offerAcceptsProducts(offer({
    offer_config_json: { sub_type: 'pct', value: 10, scope: 'category', category: 'Topwear' },
  }));
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('whole category');
});

test('a LEGACY config with no scope and no products is refused — it is store-wide today', () => {
  // resolveScope() infers store-wide from an empty products array. Attaching
  // would silently narrow a store-wide discount down to a handful of products.
  const v = offerAcceptsProducts(offer({
    offer_config_json: { sub_type: 'pct', value: 10 },
  }));
  expect(v.ok).toBe(false);
  expect(v.reason).toContain('store-wide');
});

test('a LEGACY config with no scope but existing products is already product-scoped, so it accepts', () => {
  const v = offerAcceptsProducts(offer({
    offer_config_json: { sub_type: 'pct', value: 10, products: [{ id: 'p9' }] },
  }));
  expect(v.ok).toBe(true);
});

for (const [type, needle] of [
  ['bundle', 'Bundle'],
  ['bogo', 'BOGO'],
  ['free_gift', 'Free-gift'],
] as [string, string][]) {
  test(`a ${type} offer is refused — its config is not a flat product list`, () => {
    const v = offerAcceptsProducts(offer({ offer_type: type, offer_config_json: { products: [{ id: 'p9' }] } }));
    expect(v.ok).toBe(false);
    expect(v.reason).toContain(needle);
  });
}

// ── Attach: merging must not disturb the offer ──────────────────────────────

test('merging adds new products, reports duplicates, and never double-adds', () => {
  const config = { sub_type: 'pct', value: 10, scope: 'products', products: [{ id: 'p1', name: 'A' }] };
  const r = mergeOfferProducts(config, [
    { id: 'p1', name: 'A', price: 100 },
    { id: 'p2', name: 'B', price: 200 },
  ]);
  expect(r.added).toEqual(['p2']);
  expect(r.already).toEqual(['p1']);
  expect(r.config.products.map((p: any) => p.id)).toEqual(['p1', 'p2']);
});

test('merging is idempotent — attaching the same set twice changes nothing', () => {
  const first = mergeOfferProducts(
    { scope: 'products', products: [] }, [{ id: 'p1', name: 'A', price: 1 }]);
  const second = mergeOfferProducts(first.config, [{ id: 'p1', name: 'A', price: 1 }]);
  expect(second.added).toEqual([]);
  expect(second.config.products).toHaveLength(1);
});

test('merging preserves every other key on the config', () => {
  const config = {
    sub_type: 'flat', value: 250, scope: 'products',
    tiers: [{ min_spend: 999, pct_off: 5 }],
    products: [],
  };
  const r = mergeOfferProducts(config, [{ id: 'p2', name: 'B', price: 2 }]);
  expect(r.config.sub_type).toBe('flat');
  expect(r.config.value).toBe(250);
  expect(r.config.scope).toBe('products');
  expect(r.config.tiers).toEqual([{ min_spend: 999, pct_off: 5 }]);
});

test('merging tolerates legacy bare-string product entries when deduping', () => {
  // Older configs stored ids as plain strings; extractProductIds handles both.
  const r = mergeOfferProducts({ products: ['p1'] }, [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]);
  expect(r.already).toEqual(['p1']);
  expect(r.added).toEqual(['p2']);
});
