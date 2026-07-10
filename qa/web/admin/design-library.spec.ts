import { test, expect, type Route } from '@playwright/test';
import { seedAdminSession, stubApiPermissive } from '../_helpers/adminSession';

/**
 * WORKFLOW: admin browses the Design Library (layouts + contracts + styles).
 * Contract: features/design-library/ (Creator Experience Engine Phase 3, mig 131-132).
 * Deterministic: seeds an admin session and stubs the two read-only endpoints.
 * No live backend, no DB.
 */

const LAYOUTS = [
  { key: 'hero_banner', label: 'Hero Banner', kind: 'banner', aspect_hint: '16:9',
    contract: { required: ['background', 'featured_image', 'title'], optional: ['subtitle', 'cta', 'offer_badge'], hidden: ['products', 'price'] } },
  { key: 'small_tile', label: 'Small Tile', kind: 'card', aspect_hint: '1:1',
    contract: { required: ['featured_image', 'title'], optional: ['avatar'], hidden: ['subtitle', 'cta', 'offer_badge'] } },
];
const STYLES = [{ key: 'carousel', label: 'Carousel', hint: 'horizontal scroll of cards' }];

const json = (route: Route, body: object) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function stub(page: any, opts: { empty?: boolean } = {}) {
  const cap = { layoutGets: 0 };
  await stubApiPermissive(page);
  await page.route('**/auth/refresh', (r: Route) => json(r, { success: true, data: { access_token: 'qa-admin' } }));
  await page.route('**/v1/admin/stats', (r: Route) => json(r, { success: true, data: { pending_approvals: { brands: 0, influencers: 0 } } }));
  await page.route('**/v1/admin/section-styles**', (r: Route) => json(r, { success: true, data: { section_styles: STYLES } }));
  await page.route('**/v1/admin/design-layouts**', (r: Route) => {
    cap.layoutGets += 1;
    return json(r, { success: true, data: { layouts: opts.empty ? [] : LAYOUTS } });
  });
  return cap;
}

test.describe('WORKFLOW: admin Design Library', () => {
  test('shows layouts with their contracts and the section-style reference', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stub(page);

    await page.goto('/admin/design-library');
    await expect(page.getByRole('heading', { name: /Design Library/ })).toBeVisible();
    await expect(page.getByText('Hero Banner')).toBeVisible();
    await expect(page.getByText('featured_image').first()).toBeVisible();  // a required slot chip
    await expect(page.getByText('Carousel')).toBeVisible();                // section-style reference
    expect(cap.layoutGets).toBeGreaterThan(0);
  });

  test('empty catalog renders an honest empty state', async ({ page, context }) => {
    await seedAdminSession(context, page);
    await stub(page, { empty: true });
    await page.goto('/admin/design-library');
    await expect(page.getByText(/No layouts seeded yet/i)).toBeVisible();
  });

  test('auth gate: no session is redirected to /login', async ({ page }) => {
    const cap = await stub(page);
    await page.goto('/admin/design-library');
    await expect(page).toHaveURL(/\/login/);
    expect(cap.layoutGets).toBe(0);
  });
});
