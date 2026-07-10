import { test, expect, type Route } from '@playwright/test';
import path from 'node:path';
import { seedAdminSession, stubApiPermissive, shotDir } from '../_helpers/adminSession';

/**
 * WORKFLOW: admin browses the Design System catalog (read-only).
 * Contract: features/design-system-tokens/ (Creator Experience Engine Phase 1,
 * migrations 127-128).
 *
 * Admin surface is brand-web /admin/design-system (port 3002). Deterministic:
 * seeds an admin cookie + localStorage and stubs the two read-only endpoints
 * (GET /v1/admin/design-system/tokens|presets). No live backend, no DB.
 */

const TOKENS = {
  mood: [{ key: 'urban', label: 'Urban', config: { descriptor: 'street, bold' }, sort_order: 1 }],
  palette: [{ key: 'urban_dark', label: 'Urban Dark',
    config: { primary: '#26262A', secondary: '#5F5E5A', accent: '#FFC400', bg: '#1C1C1E', text: '#FFFFFF' }, sort_order: 1 }],
  typography: [{ key: 'bold_fashion', label: 'Bold Fashion', config: { family: 'Inter', weight: 800, spacing: '-0.02em' }, sort_order: 1 }],
  background: [{ key: 'urban_concrete', label: 'Urban Concrete',
    config: { type: 'texture', avg_color: '#3a3a3d', asset_r2_key: null, text_safe_zone: 'bottom-left' }, sort_order: 1 }],
  radius: [{ key: 'soft', label: 'Soft', config: { px: 12 }, sort_order: 2 }],
  shadow: [{ key: 'soft', label: 'Soft', config: { level: 'soft' }, sort_order: 2 }],
};

const PRESETS = [
  { key: 'urban_fashion', label: 'Urban Fashion', world_key: 'fashion',
    tokens: { mood: 'urban', palette: 'urban_dark', typography: 'bold_fashion', background: 'urban_concrete' },
    positions: { avatar: 'top-left', featured: 'right', cta: 'bottom-left' } },
];

const json = (route: Route, body: object, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function stubDesignSystem(page: any, opts: { empty?: boolean } = {}) {
  const cap = { tokenGets: 0, presetGets: 0 };
  await stubApiPermissive(page); // registered first → specifics below take precedence
  await page.route('**/auth/refresh', (r: Route) => json(r, { success: true, data: { access_token: 'qa-admin' } }));
  await page.route('**/v1/admin/stats', (r: Route) =>
    json(r, { success: true, data: { pending_approvals: { brands: 0, influencers: 0 } } }));
  await page.route('**/v1/admin/design-system/tokens**', (r: Route) => {
    cap.tokenGets += 1;
    return json(r, { success: true, data: { tokens: opts.empty ? {} : TOKENS }, meta: { world_key: 'fashion' } });
  });
  await page.route('**/v1/admin/design-system/presets**', (r: Route) => {
    cap.presetGets += 1;
    return json(r, { success: true, data: { presets: opts.empty ? [] : PRESETS }, meta: { world_key: 'fashion' } });
  });
  return cap;
}

test.describe('WORKFLOW: admin browses the Design System catalog', () => {
  test('admin sees presets, palette, typography and background groups', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stubDesignSystem(page);

    await page.goto('/admin/design-system');
    await expect(page).toHaveURL(/\/admin\/design-system/);
    await expect(page.getByRole('heading', { name: /Design System/ })).toBeVisible();

    // Preset bundle + its token chips
    await expect(page.getByText('Urban Fashion')).toBeVisible();
    // Palette swatch row label
    await expect(page.getByText('Urban Dark')).toBeVisible();
    // Typography sample rendered ("Street Style" appears in the type rows)
    await expect(page.getByText('Bold Fashion')).toBeVisible();
    // Background tile from the curated library
    await expect(page.getByText('Urban Concrete')).toBeVisible();

    expect(cap.tokenGets).toBeGreaterThan(0);
    expect(cap.presetGets).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(shotDir('after'), 'design-system__catalog.png'), fullPage: true });
  });

  test('auth gate: no session is redirected to /login and never loads the catalog', async ({ page }) => {
    const cap = await stubDesignSystem(page);
    await page.goto('/admin/design-system');
    await expect(page).toHaveURL(/\/login/);
    expect(cap.tokenGets).toBe(0);
  });

  test('empty catalog renders an honest empty state, not an error', async ({ page, context }) => {
    await seedAdminSession(context, page);
    await stubDesignSystem(page, { empty: true });
    await page.goto('/admin/design-system');
    await expect(page.getByRole('heading', { name: /Design System/ })).toBeVisible();
    await expect(page.getByText(/Nothing seeded for this world yet/i).first()).toBeVisible();
  });
});
