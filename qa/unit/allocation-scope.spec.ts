import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: W1–W6 — allocation owns its own scope.
 * Contract: features/collab-part4-offers-allocation (§4.1).
 *
 * What a creator MAY SELL used to be derived from the OFFER's scope
 * (offer_config_json.scope). That single read was the conflation behind three
 * faults: no offer meant no products, so full-price commission-only selling was
 * impossible; editing an offer silently rewrote what the creator could sell; and
 * "whole store allocated, one category discounted" was inexpressible.
 *
 * These tests pin the four resolutions and the transitional legacy fallback.
 * db.query is intercepted rather than stubbed with fixtures: the resolver's job is
 * to choose the right QUERY for a scope, so asserting the SQL it builds is
 * asserting the behaviour. `product_ids` is additionally checked for the live
 * listing filter, because a product-scoped creator must not keep selling
 * something the brand unpublished.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../../backend/src/config/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const followerService = require('../../backend/src/services/follower.service');
const { resolveAllocatedProductIds, allocFromRow } = followerService;

type Captured = { sql: string; params: any[] };

/** Intercept db.query; the service holds the module object so this is seen. */
function intercept(rows: any[] = []) {
  const calls: Captured[] = [];
  const original = db.query;
  db.query = async (sql: string, params: any[]) => {
    calls.push({ sql, params });
    return { rows };
  };
  return { calls, restore: () => { db.query = original; } };
}

test.describe('WORKFLOW: allocation scope resolution (§4.1)', () => {
  test('A1 — store scope asks for every published product, and nothing else', async () => {
    const i = intercept([{ id: 'P1' }, { id: 'P2' }]);
    try {
      const ids = await resolveAllocatedProductIds({
        alloc: { scope: 'store' }, ciCfg: {}, brandId: 'B1',
      });
      expect(ids).toEqual(['P1', 'P2']);
      expect(i.calls).toHaveLength(1);
      expect(i.calls[0].sql).toContain('pushed_to_store = true');
      expect(i.calls[0].sql).toContain('is_active = true');
      // No category narrowing — this is what makes new products auto-join (W2).
      expect(i.calls[0].sql).not.toContain('category_node_id');
      expect(i.calls[0].params).toEqual(['B1']);
    } finally { i.restore(); }
  });

  test('A2 — category scope walks the subtree, so subcategories are included (W3)', async () => {
    const i = intercept([{ id: 'P3' }]);
    try {
      const ids = await resolveAllocatedProductIds({
        alloc: { scope: 'category', category_node_id: 'NODE-JACKETS' }, ciCfg: {}, brandId: 'B1',
      });
      expect(ids).toEqual(['P3']);
      expect(i.calls[0].sql).toContain('RECURSIVE');
      expect(i.calls[0].params).toEqual(['B1', 'NODE-JACKETS']);
    } finally { i.restore(); }
  });

  test('A3 — category scope falls back to the section label when there is no taxonomy node', async () => {
    const i = intercept([]);
    try {
      await resolveAllocatedProductIds({
        alloc: { scope: 'category', category: 'Kurtas' }, ciCfg: {}, brandId: 'B1',
      });
      expect(i.calls[0].sql).toContain('section = $2');
      expect(i.calls[0].params).toEqual(['B1', 'Kurtas']);
    } finally { i.restore(); }
  });

  test('A4 — product scope is a fixed list, still filtered by live listing state (W4)', async () => {
    // Only P1 comes back: P2 stands for a product the brand unpublished.
    const i = intercept([{ id: 'P1' }]);
    try {
      const ids = await resolveAllocatedProductIds({
        alloc: { scope: 'products', product_ids: ['P1', 'P2'] }, ciCfg: {}, brandId: 'B1',
      });
      expect(ids).toEqual(['P1']);
      expect(i.calls[0].sql).toContain('ANY($1::uuid[])');
      expect(i.calls[0].sql).toContain('pushed_to_store = true');
      expect(i.calls[0].params[0]).toEqual(['P1', 'P2']);
    } finally { i.restore(); }
  });

  test('A5 — no allocation and no offer scope resolves to nothing (W8)', async () => {
    const i = intercept([]);
    try {
      const ids = await resolveAllocatedProductIds({ alloc: null, ciCfg: {}, brandId: 'B1' });
      expect(ids).toEqual([]);
      // Nothing was asked of the database — there is nothing to ask for.
      expect(i.calls).toHaveLength(0);
    } finally { i.restore(); }
  });

  test('A6 — allocation WINS over the offer scope: whole store allocated, one category discounted', async () => {
    // The combination that was impossible before, because both meanings shared a
    // field. Allocation says store; the offer is scoped to a category for pricing.
    const i = intercept([{ id: 'P1' }, { id: 'P2' }, { id: 'P3' }]);
    try {
      const ids = await resolveAllocatedProductIds({
        alloc: { scope: 'store' },
        ciCfg: { scope: 'category', category_node_id: 'NODE-JACKETS', sub_type: 'pct', value: 20 },
        brandId: 'B1',
      });
      expect(ids).toHaveLength(3);
      expect(i.calls[0].sql).not.toContain('RECURSIVE');   // the offer's scope did not narrow it
    } finally { i.restore(); }
  });
});

test.describe('WORKFLOW: transitional legacy fallback (deploy-window safety)', () => {
  // Rows written by the old code carry no allocation. Without this fallback the
  // live collaborations would resolve to zero products and every creator
  // storefront would go blank the moment the backend deployed. Delete the
  // fallback — and this block — once no row has alloc_scope IS NULL.
  test('L1 — a legacy row with a store-scoped offer still resolves as store', async () => {
    const i = intercept([{ id: 'P1' }, { id: 'P2' }]);
    try {
      const ids = await resolveAllocatedProductIds({
        alloc: null, ciCfg: { scope: 'store' }, brandId: 'B1',
      });
      expect(ids).toEqual(['P1', 'P2']);
      expect(i.calls[0].sql).toContain('pushed_to_store = true');
    } finally { i.restore(); }
  });

  test('L2 — a legacy row with a category-scoped offer still walks the subtree', async () => {
    const i = intercept([{ id: 'P3' }]);
    try {
      await resolveAllocatedProductIds({
        alloc: null, ciCfg: { scope: 'category', category_node_id: 'NODE-X' }, brandId: 'B1',
      });
      expect(i.calls[0].params).toEqual(['B1', 'NODE-X']);
    } finally { i.restore(); }
  });

  test('L3 — an empty allocation object is treated as absent, not as a scope', async () => {
    const i = intercept([{ id: 'P1' }]);
    try {
      await resolveAllocatedProductIds({
        alloc: {}, ciCfg: { scope: 'store' }, brandId: 'B1',
      });
      expect(i.calls[0].sql).toContain('pushed_to_store = true');
    } finally { i.restore(); }
  });
});

test.describe('WORKFLOW: allocFromRow shape', () => {
  test('S1 — maps the alloc_* columns and normalises absent values to null', () => {
    expect(allocFromRow({
      alloc_scope: 'category',
      alloc_category_node_id: 'N1',
      alloc_category: 'Jackets',
      alloc_product_ids: null,
    })).toEqual({ scope: 'category', category_node_id: 'N1', category: 'Jackets', product_ids: null });

    expect(allocFromRow({ alloc_scope: null })).toEqual({
      scope: null, category_node_id: null, category: null, product_ids: null,
    });

    expect(allocFromRow(null)).toBeNull();
  });

  test('S2 — a non-array product_ids never reaches the resolver as a list', () => {
    // jsonb can hold anything; the resolver must not treat a scalar as a list.
    expect(allocFromRow({ alloc_scope: 'products', alloc_product_ids: 'oops' }).product_ids).toBeNull();
  });
});
