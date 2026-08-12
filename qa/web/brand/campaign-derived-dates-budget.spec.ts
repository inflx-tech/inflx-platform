import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * WORKFLOW: W1 + W2 + W7 — the brand is no longer asked for a budget or an end date.
 * Contract: features/collab-part5-sales-aim-separation (locked 2026-08-12), §1 + §2 + §4.
 * Assertions P1, P2, P3, P4, P4b.
 *
 * Both questions used to sit in Step 1, before any set existed and therefore before the
 * campaign's aim was known. A commission-only brand — which is every live campaign on the
 * platform today — had to type a budget that means nothing to it and invent an end date it
 * did not want, and the invented date would later close the campaign and pull its products
 * out of the shopping app while stock remained.
 *
 * Both are now derived from the sets: the total is the sum of paid allocations, and the end
 * date is the latest PAID posting window — or nothing at all if any set is sales.
 *
 * These run against the real page. The unit lane pins the rule itself; this pins that the
 * inputs are actually gone from the rendered DOM, which source-grepping cannot prove.
 */

const json = (route: Route, body: object) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

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
  await page.route('**/brands/me', (r: Route) => json(r, {
    success: true,
    data: { brand: { status: 'approved', category: 'fashion', wallet_balance: 137000 } },
  }));
}

test.describe('WORKFLOW: campaign total + end date are derived, not asked', () => {
  test.beforeEach(async ({ context, page }) => {
    await seedBrand(context, page);
    await stub(page);
    await page.goto('/dashboard/campaigns/new');
    await expect(page.getByRole('heading', { name: 'Campaign basics' })).toBeVisible();
  });

  test('P1 — Step 1 no longer asks for a total campaign budget', async ({ page }) => {
    await expect(page.getByText('Total campaign budget')).toHaveCount(0);
    // The card that housed it is now about negotiation alone.
    await expect(page.getByRole('heading', { name: 'Negotiation' })).toBeVisible();
    await expect(page.getByText('Budget & negotiation')).toHaveCount(0);
  });

  test('P2 — Step 1 asks for a start date and no end date', async ({ page }) => {
    await expect(page.getByText('Campaign name')).toBeVisible();
    await expect(page.getByText('Start date', { exact: true })).toBeVisible();
    await expect(page.getByText('End date', { exact: true })).toHaveCount(0);

    // Exactly one date input remains in Step 1 — the start date. Counting is what catches
    // an end-date input that gets re-added without its label.
    await expect(page.locator('input[type="date"]')).toHaveCount(1);
    // And no number input for a budget.
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
  });

  test('P3 — Step 1 advances with no end date entered', async ({ page }) => {
    await page.getByRole('textbox').first().fill('Festive Sarees 2026');
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').first().fill(today);

    // Previously this refused with "End date is required".
    await expect(page.getByText('End date is required')).toHaveCount(0);
    await expect(page.getByText(/Required when any set is engagement or hybrid/)).toHaveCount(0);
  });

  test('P4 — no editable campaign-level total exists anywhere in the wizard', async ({ page }) => {
    // Per-set and per-influencer budget inputs legitimately remain; the campaign-level
    // total is the one that became a computed value.
    await expect(page.getByText('Total campaign budget')).toHaveCount(0);
    await expect(page.getByText('Allocated across paid sets in Step 2.')).toHaveCount(0);
  });

  test('P4b — the two dissolved error messages cannot appear', async ({ page }) => {
    await expect(page.getByText(/exceed campaign budget/i)).toHaveCount(0);
    await expect(page.getByText(/Budget exceeded/i)).toHaveCount(0);
    await expect(page.getByText(/Cannot be after campaign end/i)).toHaveCount(0);
  });

  test('W7 — the start date still has no artificial floor (Part 1 stays fixed)', async ({ page }) => {
    // Regression guard across contracts: Part 1 removed a 7-day min, and removing the
    // end-date input next to it must not have reintroduced a constraint.
    const start = page.locator('input[type="date"]').first();
    expect(await start.getAttribute('min')).toBeNull();
    const today = new Date().toISOString().split('T')[0];
    await start.fill(today);
    await expect(start).toHaveValue(today);
  });

  test('the wizard still has three steps — no structural change', async ({ page }) => {
    // The founder ruled out restructuring the wizard. Removing two inputs must not have
    // turned into a re-layout.
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
  });
});
