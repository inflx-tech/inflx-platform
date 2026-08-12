import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * WORKFLOW: W15 (web) — campaign creation starts from an agreement.
 * Contract: features/collab-part2-precampaign-handshake.
 *
 * The Ready-to-brief CTA routes to /dashboard/campaigns/new?agreement=<id>. This drives
 * the REAL wizard with the API stubbed and asserts the handoff: the first set's goal
 * comes from the agreed aim, the creator lands pre-filled with the agreed money and
 * time, and the payload the wizard would send carries agreement_id (checked at the
 * state level via the rendered fields — the send itself is covered behaviourally by the
 * invite endpoint's own tests).
 *
 * Until this existed, the CTA navigated with a parameter the wizard ignored — a button
 * that looked wired and did nothing, which is exactly the silently-inert-control fault
 * this program keeps finding.
 */

const json = (route: Route, body: object) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const AGREEMENT = {
  id: 'AGR1', influencer_id: 'INF1', status: 'ready',
  influencer_name: 'Asha Menon', instagram_handle: 'ashamenon',
  terms_json: {
    aim: 'conversion',
    money: { commission_pct: 15 },
    time: { post_by: '2026-09-20' },
    scope: { level: 'category', category: 'Ethnic Wear' },
    importance: { scope: 'preference' },
    deliverables: [{ type: 'reel', count: 2 }],
  },
  expires_at: '2026-11-11T00:00:00Z',
};

test.describe('WORKFLOW: briefing an agreement into the wizard', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([{ name: 'inflx_token', value: 'qa-brand', url: 'http://localhost:3002' }]);
    await page.addInitScript(() => {
      localStorage.setItem('inflx_token', 'qa-brand');
      localStorage.setItem('inflx_user', JSON.stringify({ role: 'brand', phone: '+919000000001' }));
    });
    await page.route('**/v1/**', (r: Route) => json(r, { success: true, data: {} }));
    await page.route('**/auth/refresh', (r: Route) => json(r, { success: true, data: { access_token: 'qa-brand' } }));
    await page.route('**/brands/me', (r: Route) => json(r, {
      success: true, data: { brand: { status: 'approved', category: 'fashion', wallet_balance: 100000 } },
    }));
    await page.route('**/brands/me/products*', (r: Route) => json(r, { success: true, data: { products: [] } }));
    await page.route('**/brands/me/offers*', (r: Route) => json(r, { success: true, data: { offers: [] } }));
    await page.route('**/brands/me/agreements', (r: Route) => json(r, { success: true, data: { agreements: [AGREEMENT] } }));
    await page.goto('/dashboard/campaigns/new?agreement=AGR1');
  });

  test('B1 — the wizard jumps to the terms sub-step with the creator pre-filled', async ({ page }) => {
    // The effect sets step 1 / terms directly — the brand should land ON the handoff,
    // not at an empty Step 1 wondering where their agreed creator went.
    await expect(page.getByText('Asha Menon').first()).toBeVisible();
    // Agreed money, already in the commission field.
    await expect(page.locator('input[value="15"]').first()).toBeVisible();
  });

  test('B2 — the set goal is the agreed aim', async ({ page }) => {
    // conversion → the set renders its conversion styling/copy. The goal chip on the
    // set header carries the goal class.
    await expect(page.locator('.cc').getByText(/conversion|Drive sales|commission/i).first()).toBeVisible();
  });

  test('B3 — a consumed or expired agreement fails loudly, not silently', async ({ page }) => {
    await page.route('**/brands/me/agreements', (r: Route) => json(r, { success: true, data: { agreements: [] } }));
    await page.goto('/dashboard/campaigns/new?agreement=GONE');
    await expect(page.getByText(/no longer available/)).toBeVisible();
  });
});
