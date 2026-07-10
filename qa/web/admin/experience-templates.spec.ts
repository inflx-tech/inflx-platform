import { test, expect, type Route } from '@playwright/test';
import { seedAdminSession, stubApiPermissive } from '../_helpers/adminSession';

/**
 * WORKFLOW: admin assembles an Experience Template and places it.
 * Contract: features/experience-templates/ (Creator Experience Engine Phase 5, mig 133-134).
 * Stubbed; no live backend, no DB.
 */

const THEMES = [{ key: 'street_style', name: 'Street Style' }];
const LAYOUTS = [{ key: 'hero_banner', label: 'Hero Banner', aspect_hint: '16:9' }];
const STYLES = [{ key: 'hero', label: 'Hero', hint: 'full-width slides' }, { key: 'carousel', label: 'Carousel', hint: 'scroll' }];
const TEMPLATE = {
  id: 'tpl_1', world_key: 'fashion', key: 'street_style_hero', name: 'Street Style Hero',
  template_type: 'creator', theme_key: 'street_style', design_layout_key: 'hero_banner', section_style: 'hero',
  placement_json: { screens: ['home'] }, store_rule: 'if_products', creator_store_rule: 'if_creator_has_experience',
  location_priority: ['city', 'state', 'country', 'global'], status: 'draft',
};
const SECTION = { id: 'sec_1', screen: 'category', scope_type: 'vertical', scope_value: 'fashion', shelf_key: 'tpl_street_style_hero', rule: 'experience_template', template_id: 'tpl_1', enabled: true };

const json = (r: Route, body: object, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function stub(page: any, opts: { createError?: boolean } = {}) {
  const cap = { creates: 0, places: 0 };
  await stubApiPermissive(page);
  await page.route('**/auth/refresh', (r: Route) => json(r, { success: true, data: { access_token: 'qa-admin' } }));
  await page.route('**/v1/admin/stats', (r: Route) => json(r, { success: true, data: { pending_approvals: { brands: 0, influencers: 0 } } }));
  await page.route('**/v1/admin/themes**', (r: Route) => json(r, { success: true, data: { themes: THEMES } }));
  await page.route('**/v1/admin/design-layouts**', (r: Route) => json(r, { success: true, data: { layouts: LAYOUTS } }));
  await page.route('**/v1/admin/section-styles**', (r: Route) => json(r, { success: true, data: { section_styles: STYLES } }));
  await page.route('**/v1/admin/experience-templates**', (r: Route) => {
    const m = r.request().method(); const url = r.request().url();
    if (m === 'POST' && /\/place(\?|$)/.test(url)) { cap.places += 1; return json(r, { success: true, data: { section: SECTION } }); }
    if (m === 'POST') {
      cap.creates += 1;
      return opts.createError
        ? json(r, { success: false, error: { code: 'VALIDATION_ERROR', message: 'design_layout_key required', field: 'design_layout_key' } }, 422)
        : json(r, { success: true, data: { template: TEMPLATE } }, 201);
    }
    if (m === 'PATCH') return json(r, { success: true, data: { template: TEMPLATE } });
    return json(r, { success: true, data: { templates: [] } });
  });
  return cap;
}

test.describe('WORKFLOW: admin Experience Templates', () => {
  test('assemble a template and place it', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stub(page);
    await page.goto('/admin/experience-templates');
    await expect(page.getByRole('heading', { name: /Experience Templates/ })).toBeVisible();
    await expect(page.getByText(/No templates yet/i)).toBeVisible();

    await page.getByRole('button', { name: /Create Template/ }).click();
    await expect(page.getByText('Type')).toBeVisible();
    await page.getByRole('button', { name: /^Place/ }).click();

    await expect(page.getByText(/renders empty on the home until creators publish/i)).toBeVisible();
    expect(cap.creates).toBe(1);
    expect(cap.places).toBe(1);
  });

  test('create validation surfaces the server error', async ({ page, context }) => {
    await seedAdminSession(context, page);
    await stub(page, { createError: true });
    await page.goto('/admin/experience-templates');
    await page.getByRole('button', { name: /Create Template/ }).click();
    await page.getByRole('button', { name: /Save draft/ }).click();
    await expect(page.getByText(/design_layout_key required/i)).toBeVisible();
  });

  test('auth gate: no session is redirected to /login', async ({ page }) => {
    await stub(page);
    await page.goto('/admin/experience-templates');
    await expect(page).toHaveURL(/\/login/);
  });
});
