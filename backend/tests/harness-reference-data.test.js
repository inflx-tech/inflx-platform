'use strict';

/**
 * harness-reference-data.test.js
 * Contract: features/quota-tests-prove-nothing · 03-expected-outputs 1–4
 *
 * ⚠️ THIS TEST WATCHES THE TEST HARNESS, NOT THE PRODUCT.
 *
 * `truncateAll()` wipes the test database before every check, and CASCADE reaches configuration
 * that no test creates and every test needs. When the features catalogue went missing, the
 * entitlements service read an empty catalogue, every quota answered null, quotaCheck read null
 * as "not configured" and passed — so "the 11th product must be refused" failed quietly among the
 * suite's known failures for as long as anyone can measure, and every test that creates several
 * products or campaigns passed for the wrong reason.
 *
 * It went unnoticed because nothing was watching the floor the other tests stand on. This is that
 * watcher. If the reseed is ever dropped again, or a tier stops carrying its own numbers, these
 * four fail loudly and immediately instead of turning hundreds of assertions into theatre.
 */

const { truncateAll, query, pool } = require('./helpers/db');
const entitlements = require('../src/services/entitlements.service');
const { createBrandUser, registerBrand, setBrandTier } = require('./helpers/factories');

beforeEach(async () => { await truncateAll(); });

describe('the floor every quota test stands on', () => {
  test('1 — the features catalogue survives a truncate', async () => {
    const { rows } = await query(`SELECT feature_key, feature_type FROM features ORDER BY feature_key`);
    expect(rows.length).toBeGreaterThanOrEqual(13);
    const keys = rows.map(r => r.feature_key);
    for (const k of ['active_campaigns', 'sets_per_campaign', 'products_in_store', 'invitations_per_cycle', 'media_gallery_items']) {
      expect(keys).toContain(k);
    }
  });

  test('2 — every tier carries its OWN number for every quota, not the catalogue default', async () => {
    const { rows } = await query(`
      SELECT t.tier_key, f.feature_key, tf.quota_value::float AS q
        FROM tier_features tf
        JOIN subscription_tiers t ON t.id = tf.tier_id
        JOIN features f ON f.id = tf.feature_id
       WHERE f.feature_key IN ('active_campaigns','sets_per_campaign','products_in_store','invitations_per_cycle')
       ORDER BY t.tier_key, f.feature_key`);
    const at = (tier, key) => (rows.find(r => r.tier_key === tier && r.feature_key === key) || {}).q;

    expect(at('free', 'products_in_store')).toBe(10);
    expect(at('free', 'sets_per_campaign')).toBe(1);
    expect(at('enterprise', 'products_in_store')).toBe(-1);
    expect(at('enterprise', 'sets_per_campaign')).toBe(-1);
    // A tier in the middle must not read like either end.
    expect(at('growth', 'products_in_store')).toBe(100);
  });

  test('3 — an enterprise brand reads unlimited, through the service the middleware uses', async () => {
    const u = await createBrandUser();
    const br = await registerBrand(u.token);          // registerBrand puts a brand on enterprise
    for (const k of ['products_in_store', 'active_campaigns', 'sets_per_campaign', 'invitations_per_cycle']) {
      expect(await entitlements.quotaFor(null, br.id, k)).toBe(-1);
    }
  });

  test('4 — a free brand reads the free numbers, and they are numbers, not null', async () => {
    const u = await createBrandUser();
    const br = await registerBrand(u.token);
    await setBrandTier(br.id, 'free');
    expect(await entitlements.quotaFor(null, br.id, 'products_in_store')).toBe(10);
    expect(await entitlements.quotaFor(null, br.id, 'sets_per_campaign')).toBe(1);
    expect(await entitlements.quotaFor(null, br.id, 'active_campaigns')).toBe(1);
    expect(await entitlements.quotaFor(null, br.id, 'invitations_per_cycle')).toBe(5);
    // null is the value that made every quota test vacuous. It must never come back.
    for (const k of ['products_in_store', 'sets_per_campaign', 'active_campaigns', 'invitations_per_cycle']) {
      expect(await entitlements.quotaFor(null, br.id, k)).not.toBeNull();
    }
  });
});
