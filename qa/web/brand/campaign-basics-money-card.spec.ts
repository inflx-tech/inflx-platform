import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * WORKFLOW: W5 + W7 — campaign basics tells the truth about money, and a campaign
 * may start today.
 * Contract: features/collab-part1-corrections/ (locked 2026-08-11), §1.3 + §1.5.
 *
 * §1.3 — Step 1's right rail used to render a hardcoded "₹2,50,000 covers this
 * campaign", an escrow-lock warning, and a pre-ticked ✓ "Wallet topped up" to
 * EVERY brand — including commission-only ones, for whom no wallet is ever
 * touched (the backend only checks it when a set is engagement or hybrid). The
 * figure was a placeholder, not a balance, and the tick was unconditional.
 *
 * §1.5 — the start-date input carried min = today + 7 days, a browser-only rule
 * with no backend counterpart, so a brand could not launch today.
 *
 * A fresh wizard opens with one set whose goal is unset, so nothing needs
 * funding — which is exactly the commission-only shape this asserts. Step order,
 * step count and goal placement are unchanged by this contract and this spec does
 * not touch them.
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
  // A real, distinctive balance — so a placeholder leaking back in is visible.
  await page.route('**/brands/me', (r: Route) => json(r, {
    success: true,
    data: { brand: { status: 'approved', category: 'fashion', wallet_balance: 137000 } },
  }));
}

test.describe('WORKFLOW: campaign basics money card + start date', () => {
  test.beforeEach(async ({ context, page }) => {
    await seedBrand(context, page);
    await stub(page);
    await page.goto('/dashboard/campaigns/new');
    await expect(page.getByRole('heading', { name: 'Campaign basics' })).toBeVisible();
  });

  test('W5 — a campaign with nothing to fund shows no wallet or escrow card', async ({ page }) => {
    // The placeholder is gone entirely.
    await expect(page.getByText('₹2,50,000')).toHaveCount(0);
    // No wallet card, and no unearned tick.
    await expect(page.getByText('Wallet status')).toHaveCount(0);
    await expect(page.getByText('Wallet topped up')).toHaveCount(0);
    // Escrow language belongs to funded campaigns only.
    await expect(page.getByText(/total escrow lock/i)).toHaveCount(0);
    // And the brand is told why, rather than just seeing a gap.
    await expect(page.getByText('No upfront cost')).toBeVisible();
  });

  test('W5b — the publish checklist is present and states real prerequisites', async ({ page }) => {
    await expect(page.getByText('Before you can publish')).toBeVisible();
    await expect(page.getByText(/Products listed in catalogue/i)).toBeVisible();
  });

  test('W7 — the start date has no 7-day floor', async ({ page }) => {
    const start = page.locator('input[type="date"]').first();
    await expect(start).toBeVisible();
    // The old rule set min = today + 7. Any min at all on this input is a regression.
    expect(await start.getAttribute('min')).toBeNull();
    await expect(page.getByText('Must start at least 7 days from today.')).toHaveCount(0);

    // Prove it accepts today, not just that the attribute is gone.
    const today = new Date().toISOString().split('T')[0];
    await start.fill(today);
    await expect(start).toHaveValue(today);
  });

  test('W5c — the wizard still has three steps and the goal is not in Step 1', async ({ page }) => {
    // Guard rail, not a feature: the founder ruled out any structural change, so a
    // future edit that moves the goal forward or adds a step should fail here.
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.getByText(/Boost awareness|Drive sales|pick a goal/i)).toHaveCount(0);
  });
});
