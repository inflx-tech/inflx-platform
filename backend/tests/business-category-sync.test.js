'use strict';

/**
 * Item 9 — the business INFLX accepts, and the business INFLX can charge, must be
 * the same list.
 *
 * Founder, 17 September 2026: "now in registration we kept only one business that is
 * fashion. make both sync each."
 *
 * They were two lists that never looked at each other. `businessCategory.model`
 * decides who may register; `categories` decides what a store pays on a sale, looked
 * up by the business type it registered under. When that lookup missed, the code
 * quietly charged a last-resort 8% — no error, nobody told — and would go on doing it
 * for as long as that store traded.
 *
 * Re-opening a vertical is a one-line edit to ACCEPTED_CATEGORIES. It would have been
 * very easy to add "furniture" and never notice that furniture had no rate. This is
 * the test that notices, before a real sale does.
 *
 * Contract: Docs/THE_CUT.md · Docs/ITEM9_FUNDING_LOCKING_GAP_REPORT.md
 */

const { truncateAll, query } = require('./helpers/db');
const businessCategory = require('../src/services/businessCategory.model');
const pricing = require('../src/services/pricing.service');

beforeEach(async () => { await truncateAll(); });

const liveRateKeys = async () =>
  (await query(`SELECT category_key FROM categories WHERE active`)).rows.map(r => r.category_key);

describe('every business we accept is a business we can charge', () => {
  it('each accepted business type has an active rate', async () => {
    const missing = businessCategory.acceptedWithoutARate(await liveRateKeys());
    // If this fails, somebody opened a vertical without giving it a rate. Every store
    // that registers under it will be charged the fallback instead of a chosen number.
    expect(missing).toEqual([]);
  });

  it('the accepted list is still fashion only, as THE CUT decided', () => {
    expect(businessCategory.ACCEPTED_CATEGORIES).toEqual(['fashion']);
  });

  it('a business type with no rate is REFUSED at registration, not silently charged', () => {
    // The two halves of the same promise: if it cannot be charged, it cannot get in.
    expect(businessCategory.isAcceptedCategory('home_beauty')).toBe(false);
    expect(businessCategory.isAcceptedCategory('furniture')).toBe(false);
    expect(businessCategory.isAcceptedCategory('fashion')).toBe(true);
    // Spelling and spacing must not be a way past the gate.
    expect(businessCategory.isAcceptedCategory('Fashion')).toBe(true);
    expect(businessCategory.isAcceptedCategory('  FASHION  ')).toBe(true);
  });

  it('the check would CATCH a vertical opened without a rate', () => {
    // Proving the guard actually guards, rather than always returning empty.
    const pretendAccepted = ['fashion', 'furniture', 'pest_control'];
    const live = ['fashion', 'furniture'];
    const missing = pretendAccepted.filter(c => !live.includes(c));
    expect(missing).toEqual(['pest_control']);
    // …and the real function agrees when asked the same question.
    expect(businessCategory.acceptedWithoutARate(['restaurant'])).toEqual(['fashion']);
  });
});

describe('what a fashion store is actually charged on a sale', () => {
  it('fashion resolves to its OWN rate, never the fallback', async () => {
    const { rows } = await query(
      `SELECT path_a_pct, path_b_pct, path_c_pct FROM categories WHERE category_key = 'fashion' AND active`
    );
    expect(rows[0]).toBeTruthy();
    // Three rates, because who brought the sale changes what INFLX should take:
    // nobody (A) → the creator's link, bought at once (B) → bought later in the window (C).
    for (const k of ['path_a_pct', 'path_b_pct', 'path_c_pct']) {
      expect(Number(rows[0][k])).toBeGreaterThan(0);
      expect(Number(rows[0][k])).toBeLessThanOrEqual(50);
    }
  });

  it('the spellings a brand might register under all reach the same fashion rate', () => {
    // brands.category is free text on rows written before the gate existed, so the
    // lookup normalises. These must not scatter across different rates.
    const same = ['fashion', 'Fashion', 'FASHION', 'apparel', 'fashion_online', 'fashion_walkin'];
    const keys = new Set(same.map(s => pricing._normalizeCategoryKey(s)));
    expect([...keys]).toEqual(['fashion']);
  });
});
