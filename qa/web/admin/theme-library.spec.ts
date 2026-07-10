import { test, expect, type Route } from '@playwright/test';
import { seedAdminSession, stubApiPermissive } from '../_helpers/adminSession';

/**
 * WORKFLOW: admin creates a Theme from a blueprint, then publish is validated.
 * Contract: features/theme-library/ (Creator Experience Engine Phase 2, mig 129-130).
 * Deterministic: seeds an admin session and stubs the theme + preset endpoints.
 * No live backend, no DB.
 */

const BP = [{ key: 'street_style', name: 'Street Style', icon: '👟', purpose: 'lifestyle', preset_key: 'urban_fashion', audience: 'unisex' }];
const PRESETS = [{ key: 'urban_fashion', label: 'Urban Fashion', tokens: {}, positions: {} }];
const DRAFT = {
  id: 'th_1', world_key: 'fashion', key: 'street_style', name: 'Street Style',
  subtitle: 'Urban looks curated for everyday confidence.', icon: '👟', description: 'Urban casual looks.',
  purpose: 'lifestyle', audience: 'unisex', preset_key: 'urban_fashion',
  supported_categories: ['Jeans', 'Sneakers'], min_products: 4, max_products: 20,
  media_rules_json: { featured: 'required', video: 'optional', orientation: 'portrait' },
  supported_offer_types: ['discount', 'bundle'], default_title: 'Street Style',
  default_subtitle: 'Urban looks curated for everyday confidence.', default_cta: 'Explore collection',
  applicable_worlds: ['fashion'], is_blueprint: false, blueprint_source_key: 'street_style', status: 'draft',
};

const json = (route: Route, body: object, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function stubThemes(page: any, opts: { publishError?: boolean } = {}) {
  const cap = { creates: 0, publishes: 0 };
  await stubApiPermissive(page);
  await page.route('**/auth/refresh', (r: Route) => json(r, { success: true, data: { access_token: 'qa-admin' } }));
  await page.route('**/v1/admin/stats', (r: Route) => json(r, { success: true, data: { pending_approvals: { brands: 0, influencers: 0 } } }));
  await page.route('**/v1/admin/design-system/presets**', (r: Route) => json(r, { success: true, data: { presets: PRESETS } }));
  await page.route('**/v1/admin/themes**', (r: Route) => {
    const m = r.request().method();
    const url = r.request().url();
    if (m === 'POST' && /\/publish(\?|$)/.test(url)) {
      cap.publishes += 1;
      return opts.publishError
        ? json(r, { success: false, error: { code: 'VALIDATION_ERROR', message: 'Pick at least one supported category.', field: 'supported_categories' } }, 422)
        : json(r, { success: true, data: { theme: { ...DRAFT, status: 'published' } } });
    }
    if (m === 'POST') { cap.creates += 1; return json(r, { success: true, data: { theme: DRAFT } }, 201); }
    if (m === 'PATCH') return json(r, { success: true, data: { theme: DRAFT } });
    if (/\/themes\/blueprints/.test(url)) return json(r, { success: true, data: { blueprints: BP } });
    if (/\/themes\/[^/?]+(\?|$)/.test(url)) return json(r, { success: true, data: { theme: DRAFT } });
    return json(r, { success: true, data: { themes: [] } });
  });
  return cap;
}

test.describe('WORKFLOW: admin Theme Library', () => {
  test('create from a blueprint opens a pre-filled wizard', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stubThemes(page);

    await page.goto('/admin/themes');
    await expect(page.getByRole('heading', { name: /Theme Library/ })).toBeVisible();
    await expect(page.getByText(/No themes yet/i)).toBeVisible();

    await page.getByRole('button', { name: /Create Theme/ }).click();
    await page.getByRole('button', { name: /Street Style/ }).click();

    await expect(page.getByRole('heading', { name: /Street Style/ })).toBeVisible();
    await expect(page.getByText('Jeans')).toBeVisible();
    await expect(page.getByText('Sneakers')).toBeVisible();
    expect(cap.creates).toBe(1);
  });

  test('publish is validated — server rejection surfaces as an error', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stubThemes(page, { publishError: true });

    await page.goto('/admin/themes');
    await page.getByRole('button', { name: /Create Theme/ }).click();
    await page.getByRole('button', { name: /Street Style/ }).click();
    await expect(page.getByRole('heading', { name: /Street Style/ })).toBeVisible();

    await page.getByRole('button', { name: /Publish/ }).click();
    await expect(page.getByText(/Pick at least one supported category/i)).toBeVisible();
    expect(cap.publishes).toBe(1);
  });

  test('auth gate: no session is redirected to /login', async ({ page }) => {
    await stubThemes(page);
    await page.goto('/admin/themes');
    await expect(page).toHaveURL(/\/login/);
  });
});
