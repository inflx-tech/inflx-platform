import { test, expect } from '@playwright/test';
import path from 'node:path';
import { seedAdminSession, stubAdminApis, shotDir } from '../_helpers/adminSession';

/**
 * WORKFLOW: admin role-gate matrix.
 * Contract: features/admin-role-gate/ (locked 2026-05-18).
 *
 * Two independent gate layers on /admin/* + /dashboard/*:
 *   - middleware.js  → server-side, cookie EXISTENCE only
 *   - app/admin/layout.js → client-side, localStorage role check
 *
 * The security outcome under assertion is the final URL. No
 * credential state short of (cookie AND localStorage role=admin)
 * may render an admin page.
 */

async function setCookie(context: any, value = 'qa-x') {
  await context.addCookies([
    { name: 'inflx_token', value, url: 'http://localhost:3002' },
  ]);
}

async function setLocalStorageUser(page: any, user: object | null) {
  await page.addInitScript((u: object | null) => {
    localStorage.setItem('inflx_token', 'qa-x');
    if (u) localStorage.setItem('inflx_user', JSON.stringify(u));
    else localStorage.removeItem('inflx_user');
  }, user);
}

test.describe('WORKFLOW: admin role-gate matrix', () => {
  test('M1 — no cookie, no session → server redirect to /login, queue never called', async ({ page }) => {
    const cap = await stubAdminApis(page);
    await page.goto('/admin/approvals');
    await expect(page).toHaveURL(/\/login/);
    expect(cap.queueCalls).toBe(0);
  });

  test('M2 — cookie present but role=brand → client redirect to /login', async ({ page, context }) => {
    await setCookie(context);
    await setLocalStorageUser(page, { role: 'brand', phone: '+919000000000' });
    await stubAdminApis(page);

    await page.goto('/admin/approvals');
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({
      path: path.join(shotDir('after'), 'admin-role-gate__m2-redirected.png'),
      fullPage: true,
    });
  });

  test('M3 — cookie present but no localStorage user → client redirect to /login', async ({ page, context }) => {
    await setCookie(context);
    await setLocalStorageUser(page, null);
    await stubAdminApis(page);

    await page.goto('/admin/approvals');
    await expect(page).toHaveURL(/\/login/);
  });

  test('M4 — cookie + admin session → stays on /admin/approvals (positive control)', async ({ page, context }) => {
    await seedAdminSession(context, page);
    await stubAdminApis(page);

    await page.goto('/admin/approvals');
    await expect(page).toHaveURL(/\/admin\/approvals/);
    await expect(page.getByRole('heading', { name: 'Approval Queue' })).toBeVisible();
    await page.screenshot({
      path: path.join(shotDir('after'), 'admin-role-gate__m4-allowed.png'),
      fullPage: true,
    });
  });

  test('M5 — no cookie on /dashboard → server redirect to /login (matcher breadth)', async ({ page }) => {
    await stubAdminApis(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
