import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: W1–W4 write side, and the eighth gate.
 * Contract: features/collab-part4-offers-allocation (§4.1, §4.2).
 *
 * §4.1 gave allocation its own scope and §4.2 widened the READ gates, but the API
 * still ignored allocation entirely and — worse — refused to CREATE a conversion or
 * hybrid collaboration without an offer:
 *
 *     if ((goal === 'conversion' || goal === 'hybrid') && !effType) throw ...
 *
 * That was an EIGHTH gate, missed in the original audit of seven, and the one that
 * mattered most: full-price commission-only selling had been made readable while
 * remaining impossible to set up, because the invite was rejected before the row
 * existed. It now accepts an allocation OR an offer, and still refuses when there is
 * neither — a creator with nothing to sell is not a valid collaboration.
 *
 * resolveAllocation is validation on the money-adjacent path: it decides what can be
 * bought through a creator. Covered directly, with db.query intercepted.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../../backend/src/config/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const campaign = require('../../backend/src/controllers/campaign.controller');
const { resolveAllocation, VALID_ALLOC_SCOPES } = campaign;

const PRODUCTS: Record<string, any> = {
  P1: { id: 'P1', name: 'Silk Kurta',   pushed_to_store: true },
  P2: { id: 'P2', name: 'Draft Jacket', pushed_to_store: false },
  // P9 absent = another brand's product.
};
const NODES: Record<string, any> = { 'N-JACKETS': { id: 'N-JACKETS', name: 'Jackets' } };

function intercept() {
  const original = db.query;
  db.query = async (sql: string, params: any[]) => {
    if (sql.includes('category_nodes')) {
      const n = NODES[params[0]];
      return { rows: n ? [n] : [] };
    }
    if (sql.includes('brand_products')) {
      return { rows: (params[0] as string[]).map(id => PRODUCTS[id]).filter(Boolean) };
    }
    return { rows: [] };
  };
  return { restore: () => { db.query = original; } };
}

const call = (args: any) => resolveAllocation({ brandId: 'B1', ...args });

test.describe('WORKFLOW: allocation write path (§4.1)', () => {
  test('A1 — nothing sent returns null, leaving any existing allocation alone', async () => {
    const i = intercept();
    try {
      expect(await call({})).toBeNull();
      expect(await call({ alloc_scope: '' })).toBeNull();
      expect(await call({ alloc_scope: null })).toBeNull();
    } finally { i.restore(); }
  });

  test('A2 — store scope needs nothing else', async () => {
    const i = intercept();
    try {
      expect(await call({ alloc_scope: 'store' }))
        .toEqual({ scope: 'store', node_id: null, category: null, product_ids: null });
    } finally { i.restore(); }
  });

  test('A3 — an unknown scope is refused', async () => {
    const i = intercept();
    try {
      await expect(call({ alloc_scope: 'everything' })).rejects.toThrow(/alloc_scope must be one of/);
      expect(VALID_ALLOC_SCOPES).toEqual(['store', 'category', 'products']);
    } finally { i.restore(); }
  });

  test('A4 — category scope resolves the node and keeps its name as the label', async () => {
    const i = intercept();
    try {
      expect(await call({ alloc_scope: 'category', alloc_category_node_id: 'N-JACKETS' }))
        .toEqual({ scope: 'category', node_id: 'N-JACKETS', category: 'Jackets', product_ids: null });
    } finally { i.restore(); }
  });

  test('A5 — category scope with neither a node nor a label is refused', async () => {
    // Allowing it would resolve to nothing and the creator would silently have an
    // empty store — the failure mode this whole part exists to remove.
    const i = intercept();
    try {
      await expect(call({ alloc_scope: 'category' })).rejects.toThrow(/is required when alloc_scope is "category"/);
    } finally { i.restore(); }
  });

  test('A6 — an unknown category node is refused', async () => {
    const i = intercept();
    try {
      await expect(call({ alloc_scope: 'category', alloc_category_node_id: 'N-NOPE' }))
        .rejects.toThrow(/not a known category/);
    } finally { i.restore(); }
  });

  test('A7 — a bare section label is accepted as the legacy fallback', async () => {
    const i = intercept();
    try {
      expect(await call({ alloc_scope: 'category', alloc_category: 'Kurtas' }))
        .toEqual({ scope: 'category', node_id: null, category: 'Kurtas', product_ids: null });
    } finally { i.restore(); }
  });

  test('A8 — product scope requires at least one product', async () => {
    const i = intercept();
    try {
      await expect(call({ alloc_scope: 'products' })).rejects.toThrow(/at least one product/);
      await expect(call({ alloc_scope: 'products', alloc_product_ids: [] })).rejects.toThrow(/at least one product/);
    } finally { i.restore(); }
  });

  test('A9 — product scope de-duplicates and accepts published products', async () => {
    const i = intercept();
    try {
      expect(await call({ alloc_scope: 'products', alloc_product_ids: ['P1', 'P1'] }))
        .toEqual({ scope: 'products', node_id: null, category: null, product_ids: ['P1'] });
    } finally { i.restore(); }
  });

  test('A10 — another brand\'s product is refused', async () => {
    const i = intercept();
    try {
      await expect(call({ alloc_scope: 'products', alloc_product_ids: ['P9'] }))
        .rejects.toThrow(/do not belong to your catalogue/);
    } finally { i.restore(); }
  });

  test('A11 — an unpublished product is refused, and named', async () => {
    // Same rule as offers (§1.1): never allocate something no customer can see.
    const i = intercept();
    try {
      await expect(call({ alloc_scope: 'products', alloc_product_ids: ['P1', 'P2'] }))
        .rejects.toThrow(/Draft Jacket/);
    } finally { i.restore(); }
  });
});

test.describe('WORKFLOW: the eighth gate — creating a full-price collaboration (§4.2)', () => {
  test('G8 — the invite gate accepts an allocation instead of an offer', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../backend/src/controllers/campaign.controller.js'), 'utf8');

    // The old gate refused any conversion/hybrid invite with no offer, which made
    // full-price selling impossible to SET UP even after the read gates were widened.
    expect(src).not.toContain("&& !effType) {\n    throw new AppError('VALIDATION_ERROR', 'offer_type is required for conversion and hybrid goals'");
    expect(src).toContain('!effType && !alloc');
    // ...and still refuses when there is neither.
    expect(src).toContain('need either an allocation (alloc_scope) or an offer');
  });

  test('G9 — the update path never clears an allocation as a side effect', () => {
    // updateInfluencer is called for unrelated edits (posting date, budget). Wiping
    // what a creator may sell because their fee changed would be silent data loss.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../backend/src/controllers/campaign.controller.js'), 'utf8');
    expect(src).toContain('alloc_scope            = COALESCE($14, alloc_scope)');
    expect(src).toContain('THEN alloc_product_ids');
  });
});
