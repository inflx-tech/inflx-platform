import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * WORKFLOW: brand-web subscription + billing nav sweep — Phase A7-brand.
 * Contract: features/billing-brand-ui/.
 *
 * Breadth net like admin nav-sweep: assert each new page is reachable
 * by a brand session (not gated to /login) and renders its heading.
 * Stubs the new GET endpoints with permissive empty/canonical bodies.
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
  await page.route('**/subscription-tiers', (r: Route) => json(r, { success: true, data: { tiers: [
    { id: 't1', tier_key: 'free',   name: 'Free',       monthly_price_inr: '0.00',     max_campaigns: 1,  max_sets_per_campaign: 1,  max_influencers_per_cycle: 5,   max_products: 10,  is_enterprise: false, active: true,  sort_order: 1, description: 'Starter' },
    { id: 't2', tier_key: 'growth', name: 'Growth',     monthly_price_inr: '2499.00',  max_campaigns: 3,  max_sets_per_campaign: 3,  max_influencers_per_cycle: 25,  max_products: 100, is_enterprise: false, active: true,  sort_order: 2, description: 'Growth' },
    { id: 't3', tier_key: 'pro',    name: 'Pro',        monthly_price_inr: '9999.00',  max_campaigns: 10, max_sets_per_campaign: 10, max_influencers_per_cycle: 100, max_products: 500, is_enterprise: false, active: true,  sort_order: 3, description: 'Pro'    },
  ] } }));
  await page.route('**/brands/me/subscription', (r: Route) => json(r, { success: true, data: {
    subscription: { id: 's1', status: 'active', current_cycle_start: '2026-05-01', current_cycle_end: '2026-05-31', next_charge_at: '2026-05-31', mandate_status: 'active' },
    tier: { tier_key: 'free', name: 'Free', monthly_price_inr: '0.00', max_campaigns: 1, max_sets_per_campaign: 1, max_influencers_per_cycle: 5, max_products: 10 },
    usage: { campaigns: 0, products: 3, influencer_invites_this_cycle: 1 },
  } }));
  await page.route('**/brands/me/billing/invoices**', (r: Route) => json(r, { success: true, data: { invoices: [
    { id: 'i1', tier_key: 'growth', amount_inr: '2499.00', gst_amount_inr: '449.82', total_inr: '2948.82', period_start: '2026-04-01', period_end: '2026-04-30', status: 'paid', paid_at: '2026-04-01T00:00:00Z' },
  ] } }));
}

test.describe('WORKFLOW: brand subscription + billing nav', () => {
  test('/dashboard/subscription renders for an approved brand and shows the upgrade plans', async ({ page, context }) => {
    await seedBrand(context, page);
    await stub(page);

    await page.goto('/dashboard/subscription');
    expect(new URL(page.url()).pathname).toMatch(/^\/dashboard\/subscription/);

    await expect(page.getByRole('heading', { name: 'Subscription', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Usage this cycle' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Available plans' })).toBeVisible();
    // Growth tier choose button is visible (not the current plan)
    await expect(page.getByRole('button', { name: /Choose Growth/i })).toBeVisible();
  });

  test('/dashboard/billing renders for an approved brand and shows the invoice table', async ({ page, context }) => {
    await seedBrand(context, page);
    await stub(page);

    await page.goto('/dashboard/billing');
    expect(new URL(page.url()).pathname).toMatch(/^\/dashboard\/billing/);

    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
    await expect(page.getByText(/GST 18% included/i)).toBeVisible();
    // The stubbed paid invoice row renders
    await expect(page.getByText('GROWTH')).toBeVisible();
    // Paid status pill on the invoice row (use pill class for strictness)
    await expect(page.locator('.pill.paid')).toBeVisible();
  });
});
