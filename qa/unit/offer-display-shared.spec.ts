import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: §4.3 display side — a creator's tile advertises what checkout charges.
 * Contract: features/collab-part4-offers-allocation.
 *
 * §4.3 made published global offers apply at checkout for the first time. That
 * opened an asymmetry: a product could be CHARGED a global discount while its tile
 * in the creator's store advertised full price. The fix is not a new evaluator — it
 * is the SAME one the discovery shelves, wishlist and product cards already use.
 *
 * The evaluator was hoisted out of sectionRules.service into offerDisplay.sql
 * because follower.service cannot require sectionRules: that closes the cycle
 * sectionRules → sectionLibrary → follower.service, and Node would hand
 * sectionLibrary a half-initialised follower.service. These tests pin the sharing,
 * because a second copy is how the storefront and the shelves would drift apart on
 * what discount a product advertises.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const display = require('../../backend/src/services/offerDisplay.sql');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sectionRules = require('../../backend/src/services/sectionRules.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const followerService = require('../../backend/src/services/follower.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sectionLibrary = require('../../backend/src/services/sectionLibrary.service');

test.describe('WORKFLOW: one offer-display evaluator, shared (§4.3 display)', () => {
  test('D1 — sectionRules re-exports the hoisted fragments by identity, not by copy', () => {
    // Identity, not equality: a copy-paste would still pass a string comparison.
    expect(sectionRules.OFFER_BEST_PCT).toBe(display.OFFER_BEST_PCT);
    expect(sectionRules.OFFER_APPLIES).toBe(display.OFFER_APPLIES);
    expect(sectionRules.OFFER_LIVE_GATE).toBe(display.OFFER_LIVE_GATE);
    expect(sectionRules.offerFieldsFromPct).toBe(display.offerFieldsFromPct);
  });

  test('D2 — hoisting did not break the require cycle it was meant to avoid', () => {
    // sectionRules → sectionLibrary → follower.service. If follower.service had
    // required sectionRules directly, sectionLibrary would receive a partially
    // initialised module and this destructured function would be undefined.
    expect(typeof followerService.resolveAllocatedProductIds).toBe('function');
    expect(typeof followerService.allocFromRow).toBe('function');
    expect(typeof sectionLibrary.resolveScopedProductIds ?? 'function').toBeTruthy();
  });

  test('D3 — the evaluator considers only PUBLISHED live offers', () => {
    const sql = display.OFFER_BEST_PCT;
    expect(sql).toContain('published_to_store = true');
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('store_starts_at');
    expect(sql).toContain('store_ends_at');
  });

  test('D4 — a tile only ever advertises a SIMPLE discount', () => {
    // Cart-shaped mechanics cannot be expressed as a % on one product: a tile has no
    // cart to measure a threshold or assemble a bundle against. Promising a bundle
    // price on a single product would be a lie, so they are excluded by type.
    expect(display.OFFER_BEST_PCT).toContain("bo.offer_type = 'discount'");
    for (const shape of ['volume', 'bundle', 'bogo', 'free_gift']) {
      expect(display.OFFER_BEST_PCT).not.toContain(`'${shape}'`);
    }
  });

  test('D5 — scope awareness covers store, category subtree and product lists', () => {
    const sql = display.OFFER_APPLIES;
    expect(sql).toContain("= 'store'");
    expect(sql).toContain('RECURSIVE');          // category applies down the subtree
    expect(sql).toContain("= 'products'");
  });

  test('D6 — the creator storefront uses the shared evaluator, aliased correctly', () => {
    // The fragments reference `bp`, so any query using them must alias
    // brand_products AS bp or the SQL is invalid at runtime.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../backend/src/services/follower.service.js'), 'utf8');
    expect(src).toContain("require('./offerDisplay.sql')");
    const uses = src.split('\n').filter((l: string) => l.includes('${OFFER_BEST_PCT} AS offer_pct'));
    expect(uses.length).toBe(2);                  // both creator-storefront queries
    expect(src).toContain('FROM brand_products bp');
  });
});

test.describe('WORKFLOW: card mapping', () => {
  test('M1 — a percentage becomes a struck price', () => {
    expect(display.offerFieldsFromPct(20, 1000)).toEqual({ discount_value: 20, offer_price: 800 });
  });

  test('M2 — no offer means no struck price, not a zero one', () => {
    // A zero must not render as "0% off" with a fake struck price.
    expect(display.offerFieldsFromPct(null, 1000)).toEqual({ discount_value: null, offer_price: null });
    expect(display.offerFieldsFromPct(0, 1000)).toEqual({ discount_value: null, offer_price: null });
  });

  test('M3 — a missing price cannot produce a price', () => {
    expect(display.offerFieldsFromPct(20, null)).toEqual({ discount_value: null, offer_price: null });
  });

  test('M4 — percentages are rounded for display, consistently', () => {
    expect(display.offerFieldsFromPct(12.4, 1000).discount_value).toBe(12);
    expect(display.offerFieldsFromPct(12.6, 1000).discount_value).toBe(13);
  });
});
