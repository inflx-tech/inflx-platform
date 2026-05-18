import { test, expect, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * WORKFLOW: admin approvals — approve a pending brand.
 * Contract: features/admin-approvals/ (locked 2026-05-18).
 *
 * Admin surface is brand-web /admin/* (port 3002), NOT the thin
 * Packages/admin-web app. Two gates protect it:
 *   - middleware.js  → server-side, redirects /admin/* to /login
 *                       when the `inflx_token` cookie is absent
 *   - app/admin/layout.js → client-side, redirects when
 *                       localStorage inflx_user.role !== 'admin'
 * So the deterministic setup seeds BOTH a cookie and localStorage,
 * and stubs the 5 observed APIs. No live backend, no real admin.
 */

const SHOTS = path.join(__dirname, '..', '..', 'artifacts', 'screenshots');
function shotDir(phase: 'before' | 'after') {
  const d = path.join(SHOTS, phase);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const ADMIN_USER = {
  role: 'admin',
  admin_role: 'superadmin',
  phone: '+919999999999',
};

const PENDING_BRAND = {
  id: 'br_1',
  brand_name: 'QA Diner',
  category: 'restaurant',
  status: 'pending',
  created_at: '2026-05-18',
};

async function seedAdminSession(context: any, page: any) {
  await context.addCookies([
    { name: 'inflx_token', value: 'qa-admin', url: 'http://localhost:3002' },
  ]);
  await page.addInitScript((user: object) => {
    localStorage.setItem('inflx_token', 'qa-admin');
    localStorage.setItem('inflx_user', JSON.stringify(user));
  }, ADMIN_USER);
}

/** Stub the layout + queue APIs. Returns a ref capturing the PATCH body. */
async function stubAdminApis(
  page: any,
  opts: { patchSucceeds?: boolean } = {},
) {
  const patchSucceeds = opts.patchSucceeds !== false;
  const captured: { patchBody?: any; queueCalls: number } = { queueCalls: 0 };

  const json = (route: Route, body: object, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/auth/refresh', (r: Route) =>
    json(r, { success: true, data: { access_token: 'qa-admin' } }));
  await page.route('**/admin/stats', (r: Route) =>
    json(r, { success: true, data: { pending_approvals: { brands: 1, influencers: 0 } } }));
  await page.route('**/admin/queue/brands', (r: Route) => {
    captured.queueCalls += 1;
    return json(r, { success: true, data: { brands: [PENDING_BRAND] } });
  });
  await page.route('**/admin/queue/influencers', (r: Route) =>
    json(r, { success: true, data: { influencers: [] } }));
  await page.route('**/admin/brands/br_1/status', (r: Route) => {
    captured.patchBody = r.request().postDataJSON();
    return patchSucceeds
      ? json(r, { success: true, data: { id: 'br_1', status: 'approved' } })
      : json(r, { success: false, error: { message: 'Update failed' } }, 200);
  });

  return captured;
}

test.describe('WORKFLOW: admin approvals — approve a pending brand', () => {
  test('admin approves a pending brand and sees the success toast', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stubAdminApis(page);

    await page.goto('/admin/approvals');

    // Gate passed — not bounced to /login
    await expect(page).toHaveURL(/\/admin\/approvals/);
    await expect(page.getByRole('heading', { name: 'Approval Queue' })).toBeVisible();
    await expect(page.getByText('QA Diner')).toBeVisible();
    await page.screenshot({
      path: path.join(shotDir('before'), 'admin-approvals__queue.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Approve' }).click();

    // Workflow success = success toast visible …
    await expect(page.getByText(/approved successfully/i)).toBeVisible();
    await page.screenshot({
      path: path.join(shotDir('after'), 'admin-approvals__approved.png'),
      fullPage: true,
    });

    // … and the PATCH carried exactly { status: 'approved' }
    expect(cap.patchBody).toEqual({ status: 'approved' });
  });

  test('auth gate: no session is redirected to /login and never loads the queue', async ({ page }) => {
    // No cookie, no localStorage seeded → middleware should bounce.
    const cap = await stubAdminApis(page);

    await page.goto('/admin/approvals');

    await expect(page).toHaveURL(/\/login/);
    expect(cap.queueCalls).toBe(0);
  });

  test('edge: PATCH failure shows an error toast, not a success toast', async ({ page, context }) => {
    await seedAdminSession(context, page);
    await stubAdminApis(page, { patchSucceeds: false });

    await page.goto('/admin/approvals');
    await expect(page.getByText('QA Diner')).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByText(/Update failed/i)).toBeVisible();
    await expect(page.getByText(/approved successfully/i)).toHaveCount(0);
  });
});
