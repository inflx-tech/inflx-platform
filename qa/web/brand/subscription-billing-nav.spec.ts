import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * WORKFLOW: brand-web settings hub — Phase A9.
 * Contract: features/billing-brand-ui/ (A7-brand) + features/billing-tier-features-and-settings/ (A9).
 *
 * Asserts:
 *   • Settings hub layout renders the 3-tab nav (Profile / Subscription / Billing)
 *     on every sub-route.
 *   • Old URLs (/dashboard/subscription, /dashboard/billing) redirect to the
 *     matching settings sub-route (server-side redirect).
 *   • Subscription tab renders the tier cards INCLUDING the new features bullets.
 *   • Billing tab renders the invoice row + paid pill.
 */

const json = (r: Route, body: object) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function seedBrand(context: any, page: any) {
  await context.addCookies([{ name: 'inflx_token', value: 'qa-brand', url: 'http://localhost:3002' }]);
  await page.addInitScript(() => {
    localStorage.setItem('inflx_token', 'qa-brand');
    localStorage.setItem('inflx_user', JSON.stringify({ role: 'brand', phone: '+919000000001' }));
  });
}

async function stub(page: any) {
  await page.route('**/v1/**', (r: Route) => json(r, { success: true, data: {} }));
  await page.route('**/auth/refresh', (r: Route) => json(r, { success: true, data: { access_token: 'qa-brand' } }));
  await page.route('**/notifications', (r: Route) => json(r, { success: true, data: { unread_count: 0 } }));
  await page.route('**/brands/me', (r: Route) => json(r, { success: true, data: { brand: { status: 'approved' } } }));
  // Stub the post-A11 enriched shape: each tier carries `prices[]` (one per
  // billing_period) and `entitlements[]` (from the features catalog joined to
  // tier_features). The brand subscription page renders from this.
  const freeEnts = [
    { feature_key: 'discover_filter',  label: 'Discover filter',  category: 'influencer', feature_type: 'config',  unit: null, included: true,  quota_value: null, config: { area_scope: 'city', niches_limit: 3 } },
    { feature_key: 'bulk_outreach',    label: 'Bulk influencer outreach', category: 'influencer', feature_type: 'boolean', unit: null, included: false, quota_value: null, config: {} },
    { feature_key: 'active_campaigns', label: 'Active campaigns', category: 'campaigns',  feature_type: 'quota',   unit: 'count', included: true, quota_value: 1, config: {} },
  ];
  const growthEnts = [
    { feature_key: 'discover_filter',  label: 'Discover filter',  category: 'influencer', feature_type: 'config',  unit: null, included: true, quota_value: null, config: { area_scope: 'state', niches_limit: 10 } },
    { feature_key: 'bulk_outreach',    label: 'Bulk influencer outreach', category: 'influencer', feature_type: 'boolean', unit: null, included: true, quota_value: null, config: {} },
    { feature_key: 'active_campaigns', label: 'Active campaigns', category: 'campaigns',  feature_type: 'quota',   unit: 'count', included: true, quota_value: 3, config: {} },
  ];
  const proEnts = [
    { feature_key: 'discover_filter',  label: 'Discover filter',  category: 'influencer', feature_type: 'config',  unit: null, included: true, quota_value: null, config: { area_scope: 'all_india', niches_limit: -1 } },
    { feature_key: 'bulk_outreach',    label: 'Bulk influencer outreach', category: 'influencer', feature_type: 'boolean', unit: null, included: true, quota_value: null, config: {} },
    { feature_key: 'active_campaigns', label: 'Active campaigns', category: 'campaigns',  feature_type: 'quota',   unit: 'count', included: true, quota_value: 10, config: {} },
  ];
  await page.route('**/subscription-tiers', (r: Route) => json(r, { success: true, data: { tiers: [
    { id: 't1', tier_key: 'free',   name: 'Free',       monthly_price_inr: '0.00',     max_campaigns: 1,  max_sets_per_campaign: 1,  max_influencers_per_cycle: 5,   max_products: 10,  is_enterprise: false, active: true,  sort_order: 1, description: 'Starter',
      prices: [{ billing_period: 'monthly', price_inr: '0.00',    active: true, sort_order: 1 }],
      entitlements: freeEnts },
    { id: 't2', tier_key: 'growth', name: 'Growth',     monthly_price_inr: '2499.00',  max_campaigns: 3,  max_sets_per_campaign: 3,  max_influencers_per_cycle: 25,  max_products: 100, is_enterprise: false, active: true,  sort_order: 2, description: 'Growth',
      prices: [{ billing_period: 'monthly', price_inr: '2499.00', active: true, sort_order: 1 }],
      entitlements: growthEnts },
    { id: 't3', tier_key: 'pro',    name: 'Pro',        monthly_price_inr: '9999.00',  max_campaigns: 10, max_sets_per_campaign: 10, max_influencers_per_cycle: 100, max_products: 500, is_enterprise: false, active: true,  sort_order: 3, description: 'Pro',
      prices: [{ billing_period: 'monthly', price_inr: '9999.00', active: true, sort_order: 1 }],
      entitlements: proEnts },
  ] } }));
  await page.route('**/brands/me/subscription', (r: Route) => json(r, { success: true, data: {
    subscription: { id: 's1', status: 'active', current_cycle_start: '2026-05-01', current_cycle_end: '2026-05-31', next_charge_at: '2026-05-31', mandate_status: 'active' },
    tier: { tier_key: 'free', name: 'Free', monthly_price_inr: '0.00', max_campaigns: 1, max_sets_per_campaign: 1, max_influencers_per_cycle: 5, max_products: 10,
            features_json: ['Browse + discover influencers', '1 campaign at a time', '10 product listings'] },
    usage: { campaigns: 0, products: 3, influencer_invites_this_cycle: 1 },
  } }));
  await page.route('**/brands/me/billing/invoices**', (r: Route) => json(r, { success: true, data: { invoices: [
    { id: 'i1', tier_key: 'growth', amount_inr: '2499.00', gst_amount_inr: '449.82', total_inr: '2948.82', period_start: '2026-04-01', period_end: '2026-04-30', status: 'paid', paid_at: '2026-04-01T00:00:00Z' },
  ] } }));
}

test.describe('WORKFLOW: brand-web Settings hub (Phase A9)', () => {
  test('/dashboard/settings/subscription renders tier cards with features bullets + tab nav', async ({ page, context }) => {
    await seedBrand(context, page);
    await stub(page);

    await page.goto('/dashboard/settings/subscription');
    expect(new URL(page.url()).pathname).toMatch(/^\/dashboard\/settings\/subscription/);

    // Hub layout: title + 3 tabs visible
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Subscription', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Billing', exact: true })).toBeVisible();

    // Subscription page contents
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Available plans' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Choose Growth/i })).toBeVisible();

    // A11: tier cards render features from entitlements (not features_json).
    // Each catalog label appears once per tier card (3 tiers stubbed).
    await expect(page.getByText('Discover filter').first()).toBeVisible();
    await expect(page.getByText('Bulk influencer outreach').first()).toBeVisible();
    await expect(page.getByText('Active campaigns').first()).toBeVisible();
    // Period toggle visible
    await expect(page.getByRole('button', { name: /^Monthly$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Yearly$/ })).toBeVisible();
  });

  test('/dashboard/settings/billing renders invoice row + tab nav', async ({ page, context }) => {
    await seedBrand(context, page);
    await stub(page);

    await page.goto('/dashboard/settings/billing');
    expect(new URL(page.url()).pathname).toMatch(/^\/dashboard\/settings\/billing/);

    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
    await expect(page.getByText(/GST 18% included/i)).toBeVisible();
    await expect(page.getByText('GROWTH')).toBeVisible();
    await expect(page.locator('.pill.paid')).toBeVisible();
  });

  test('old /dashboard/subscription redirects to /dashboard/settings/subscription', async ({ page, context }) => {
    await seedBrand(context, page);
    await stub(page);
    await page.goto('/dashboard/subscription');
    // After redirect, URL is the settings sub-route.
    expect(new URL(page.url()).pathname).toBe('/dashboard/settings/subscription');
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
  });

  test('old /dashboard/billing redirects to /dashboard/settings/billing', async ({ page, context }) => {
    await seedBrand(context, page);
    await stub(page);
    await page.goto('/dashboard/billing');
    expect(new URL(page.url()).pathname).toBe('/dashboard/settings/billing');
    await expect(page.getByText(/GST 18% included/i)).toBeVisible();
  });
});
