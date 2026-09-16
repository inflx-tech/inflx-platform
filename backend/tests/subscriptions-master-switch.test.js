'use strict';

/**
 * subscriptions-master-switch.test.js
 * Contract: features/subscriptions-master-switch · 03-expected-outputs.md
 *
 * One switch decides whether plan limits apply at all. Every test here runs the SAME call
 * twice — switch on, switch off — because the thing being proved is the difference.
 *
 * Two invariants matter more than any single case:
 *   • OFF can only ever WIDEN. No call may answer smaller with the switch off (test 10).
 *   • OFF never reaches billing. The subscription row, the tier and the renewal price are
 *     byte-identical across a flip (tests 16, 17). The founder's decision, 2026-09-16:
 *     the switch governs restrictions only.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query, pool } = require('./helpers/db');
const { createBrandUser, registerBrand, setBrandTier, createAdminUser } = require('./helpers/factories');
const entitlements = require('../src/services/entitlements.service');
const platformSettings = require('../src/services/platformSettings.service');
const pricing = require('../src/services/pricing.service');

/**
 * Flip the switch and clear the 60-second cache, as an admin write would.
 * Upserts, because the row is seeded by migration 185 and truncateAll does not put it back.
 */
async function setSwitch(on) {
  await query(`
    INSERT INTO platform_settings (key, value, min_value, max_value, unit, label)
    VALUES ('subscriptions_enforced', $1, 0, 1, 'on/off', 'Subscription plans')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [on ? 1 : 0]);
  platformSettings._resetCache();
}

async function freeBrand() {
  const u = await createBrandUser();
  const br = await registerBrand(u.token);
  await setBrandTier(br.id, 'free');
  await query(`UPDATE users SET status='approved' WHERE id=(SELECT user_id FROM brands WHERE id=$1)`, [br.id]);
  return { u, br };
}

beforeEach(async () => {
  await truncateAll();
  await query(`DELETE FROM subscription_tiers`);
  await query(
    `INSERT INTO subscription_tiers
       (tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign, max_influencers_per_cycle, max_products, is_enterprise, sort_order)
     VALUES
       ('free',       'Free',           0.00,  1,  1,   5,  10, false, 1),
       ('growth',     'Growth',      2499.00,  3,  3,  25, 100, false, 2),
       ('pro',        'Pro',         9999.00, 10, 10, 100, 500, false, 3),
       ('enterprise', 'Enterprise', 29999.00, -1, -1,  -1,  -1, true,  4)`
  );
  await query(`
    INSERT INTO tier_features (tier_id, feature_id, included, quota_value, config)
    SELECT t.id, f.id, t.tier_key <> 'free',
           CASE f.feature_key
             WHEN 'active_campaigns'      THEN t.max_campaigns
             WHEN 'sets_per_campaign'     THEN t.max_sets_per_campaign
             WHEN 'invitations_per_cycle' THEN t.max_influencers_per_cycle
             WHEN 'products_in_store'     THEN t.max_products
           END,
           '{}'::jsonb
      FROM subscription_tiers t, features f
     WHERE f.feature_key IN ('active_campaigns','sets_per_campaign','invitations_per_cycle','products_in_store','bulk_outreach')
       AND t.tier_key IN ('free','growth','pro','enterprise')
    ON CONFLICT (tier_id, feature_id) DO UPDATE
      SET quota_value = EXCLUDED.quota_value, included = EXCLUDED.included
  `);
  // The quota features stay included on free — free has numbers, not absence.
  await query(`
    UPDATE tier_features SET included = true
     WHERE feature_id IN (SELECT id FROM features WHERE feature_key IN
       ('active_campaigns','sets_per_campaign','invitations_per_cycle','products_in_store'))
  `);
  await setSwitch(true);
});

afterEach(async () => { await setSwitch(true); });

// ── The service (1–10) ───────────────────────────────────────────────────────

describe('the switch, at the service', () => {
  test('1, 2 — a quota is the tier number ON, and unlimited OFF', async () => {
    const { br } = await freeBrand();
    await setSwitch(true);
    expect(await entitlements.quotaFor(null, br.id, 'products_in_store')).toBe(10);
    await setSwitch(false);
    expect(await entitlements.quotaFor(null, br.id, 'products_in_store')).toBe(-1);
  });

  test('3, 4, 5, 6 — a withheld feature is withheld ON and included OFF', async () => {
    const { br } = await freeBrand();
    await query(`UPDATE features SET is_enforced = true WHERE feature_key = 'bulk_outreach'`);
    entitlements.bustCatalogCache();   // the catalogue is cached for 60s
    await query(`
      UPDATE tier_features SET included = false
       WHERE feature_id = (SELECT id FROM features WHERE feature_key = 'bulk_outreach')
         AND tier_id    = (SELECT id FROM subscription_tiers WHERE tier_key = 'free')`);

    await setSwitch(true);
    expect(await entitlements.hasFeature(null, br.id, 'bulk_outreach')).toBe(false);
    await expect(entitlements.requireFeature(null, br.id, 'bulk_outreach')).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' });

    await setSwitch(false);
    expect(await entitlements.hasFeature(null, br.id, 'bulk_outreach')).toBe(true);
    await expect(entitlements.requireFeature(null, br.id, 'bulk_outreach')).resolves.toBeUndefined();
  });

  test('7 — a capped setting is uncapped OFF', async () => {
    const { br } = await freeBrand();
    await setSwitch(false);
    expect(await entitlements.configFor(null, br.id, 'bulk_outreach')).toEqual({});
  });

  test('8 — a MISSING row enforces. A settings gap must never unlock the product', async () => {
    const { br } = await freeBrand();
    await query(`DELETE FROM platform_settings WHERE key = 'subscriptions_enforced'`);
    platformSettings._resetCache();
    expect(await entitlements.plansEnforced()).toBe(true);
    expect(await entitlements.quotaFor(null, br.id, 'products_in_store')).toBe(10);
  });

  test('9 — a FAILING read enforces', async () => {
    const { br } = await freeBrand();
    const spy = jest.spyOn(platformSettings, 'get').mockRejectedValue(new Error('database is on fire'));
    try {
      expect(await entitlements.plansEnforced()).toBe(true);
      expect(await entitlements.quotaFor(null, br.id, 'products_in_store')).toBe(10);
    } finally { spy.mockRestore(); }
  });

  test('10 — OFF is never narrower than ON, for every feature in the catalogue', async () => {
    const { br } = await freeBrand();
    await setSwitch(true);
    const on = await entitlements.getEntitlements(null, br.id);
    await setSwitch(false);
    const off = await entitlements.getEntitlements(null, br.id);

    expect(off.plans_enforced).toBe(false);
    expect(on.plans_enforced).toBe(true);
    expect([...off.entitlements.keys()].sort()).toEqual([...on.entitlements.keys()].sort());

    for (const [key, offEnt] of off.entitlements) {
      const onEnt = on.entitlements.get(key);
      // included may go false→true, never true→false
      if (onEnt.included) expect(offEnt.included).toBe(true);
      // -1 is unlimited, so it is the widest value there is
      expect(offEnt.quota_value).toBe(-1);
      if (onEnt.quota_value !== -1 && onEnt.quota_value != null) {
        expect(offEnt.quota_value === -1 || offEnt.quota_value >= onEnt.quota_value).toBe(true);
      }
    }
    // and the brand is still named as being on her tier — she is still paying for it
    expect(off.tier_key).toBe(on.tier_key);
  });
});

// ── The endpoints (11–17) ────────────────────────────────────────────────────

describe('the switch, at the endpoints', () => {
  const addProduct = (token, n) => request(app)
    .post('/v1/brands/me/products')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Product ${n}`, price: 100, type: 'product' });

  test('11, 12 — the wall stands ON and is gone OFF, and the row really is written', async () => {
    const { u, br } = await freeBrand();
    for (let i = 1; i <= 10; i++) expect((await addProduct(u.token, i)).status).toBe(201);

    const blocked = await addProduct(u.token, 11);
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('QUOTA_EXCEEDED');

    await setSwitch(false);
    const allowed = await addProduct(u.token, 11);
    expect(allowed.status).toBe(201);

    const { rows } = await query(`SELECT count(*)::int n FROM brand_products WHERE brand_id = $1`, [br.id]);
    expect(rows[0].n).toBe(11);
  });

  test('14 — the preflight says would_block false and unlimited, and names the switch', async () => {
    const { u } = await freeBrand();
    await setSwitch(true);
    const on = await request(app).get('/v1/brands/me/quota-preflight?action=createProduct').set('Authorization', `Bearer ${u.token}`);
    expect(on.body.data.limit).toBe(10);
    expect(on.body.data.plans_enforced).toBe(true);

    await setSwitch(false);
    const off = await request(app).get('/v1/brands/me/quota-preflight?action=createProduct').set('Authorization', `Bearer ${u.token}`);
    expect(off.body.data.would_block).toBe(false);
    expect(off.body.data.limit).toBe(-1);
    expect(off.body.data.plans_enforced).toBe(false);
  });

  test('15 — the plan page carries plans_enforced, and still names the plan', async () => {
    const { u } = await freeBrand();
    await setSwitch(false);
    const res = await request(app).get('/v1/brands/me/subscription').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.plans_enforced).toBe(false);
    expect(res.body.data.tier_key).toBe('free');
  });

  test('16, 17 — BILLING IS UNTOUCHED across a flip', async () => {
    const { br } = await freeBrand();
    await setBrandTier(br.id, 'growth');
    const before = (await query(`SELECT * FROM brand_subscriptions WHERE brand_id = $1`, [br.id])).rows[0];
    const priceBefore = await pricing.computeL1Renewal(br.id);

    await setSwitch(false);

    const after = (await query(`SELECT * FROM brand_subscriptions WHERE brand_id = $1`, [br.id])).rows[0];
    const priceAfter = await pricing.computeL1Renewal(br.id);

    expect(after).toEqual(before);                 // same row, same tier, same cycle dates
    expect(priceAfter).toEqual(priceBefore);       // same renewal, same amount
    expect(priceAfter.tier_key).toBe('growth');
    expect(Number(priceAfter.amount_inr)).toBe(2499);
  });
});

// ── The switch itself (18–21) ────────────────────────────────────────────────

describe('flipping it', () => {
  test('18 — a brand cannot flip it', async () => {
    const { u } = await freeBrand();
    const res = await request(app)
      .patch('/v1/admin/platform-settings')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ subscriptions_enforced: 0 });
    expect([401, 403]).toContain(res.status);
    const { rows } = await query(`SELECT value FROM platform_settings WHERE key = 'subscriptions_enforced'`);
    expect(rows[0].value).toBe(1);
  });

  test('19, 20 — an admin flips it, one audit row is written, and the next read sees it', async () => {
    const admin = await createAdminUser();
    const res = await request(app)
      .patch('/v1/admin/platform-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ subscriptions_enforced: 0 });
    expect(res.status).toBe(200);

    const { rows: audit } = await query(
      `SELECT old_value, new_value FROM platform_settings_audit WHERE key = 'subscriptions_enforced' ORDER BY changed_at DESC LIMIT 1`);
    expect(audit[0]).toMatchObject({ old_value: 1, new_value: 0 });

    // The write busts the cache, so the very next read is the new answer.
    expect(await entitlements.plansEnforced()).toBe(false);
  });

  test('21 — only 0 and 1 are accepted', async () => {
    const admin = await createAdminUser();
    const res = await request(app)
      .patch('/v1/admin/platform-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ subscriptions_enforced: 7 });
    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('subscriptions_enforced');
    const { rows } = await query(`SELECT value FROM platform_settings WHERE key = 'subscriptions_enforced'`);
    expect(rows[0].value).toBe(1);
  });

  test('the admin payload says how to draw it — a switch, not a number box', async () => {
    const admin = await createAdminUser();
    const res = await request(app).get('/v1/admin/platform-settings').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const row = (res.body.data.settings || []).find(s => s.key === 'subscriptions_enforced');
    expect(row).toBeDefined();
    expect(row.kind).toBe('switch');
    expect(row.min).toBe(0);
    expect(row.max).toBe(1);
  });
});
