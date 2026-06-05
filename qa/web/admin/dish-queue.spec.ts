import { test, expect, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * WORKFLOW: admin dish review queue — resolve a custom name as an alias.
 * Contract: features/listing-restaurant-search-flywheel (Workflow B).
 *
 * Admin surface is brand-web /admin/* (port 3002). The Review Queue lives as
 * a TAB inside /admin/master-dishes (locked decision). Deterministic: seeds an
 * admin cookie + localStorage and stubs the master-dishes + queue APIs. No
 * live backend.
 */

const SHOTS = path.join(__dirname, '..', '..', 'artifacts', 'screenshots');
function shotDir(phase: 'before' | 'after') {
  const d = path.join(SHOTS, phase);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const ADMIN_USER = { role: 'admin', admin_role: 'superadmin', phone: '+919999999999' };

const QUEUE_ITEM = {
  id: 101,
  raw_name: 'Perugu Vada',
  section: 'Tiffins',
  restaurant_count: 3,
  suggested: { master_dish_id: 7, name: 'Dahi Vada', score: 0.86 },
  auto_promote_candidate: false,
};

async function seedAdminSession(context: any, page: any) {
  await context.addCookies([{ name: 'inflx_token', value: 'qa-admin', url: 'http://localhost:3002' }]);
  await page.addInitScript((user: object) => {
    localStorage.setItem('inflx_token', 'qa-admin');
    localStorage.setItem('inflx_user', JSON.stringify(user));
  }, ADMIN_USER);
}

async function stubApis(page: any, opts: { patchSucceeds?: boolean } = {}) {
  const patchSucceeds = opts.patchSucceeds !== false;
  const captured: { patchBody?: any; queueGets: number } = { queueGets: 0 };
  const json = (route: Route, body: object, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/auth/refresh', (r: Route) =>
    json(r, { success: true, data: { access_token: 'qa-admin' } }));
  await page.route('**/admin/stats', (r: Route) =>
    json(r, { success: true, data: { pending_approvals: { brands: 0, influencers: 0 } } }));

  // API calls carry the /v1 prefix (backend port 3001); the PAGE is on 3002 with
  // NO /v1. Scope every stub to /v1 so we don't hijack the page navigation itself
  // (without /v1 the glob matched localhost:3002/admin/master-dishes and served
  // raw JSON instead of the React page). Generic catalogue list registered FIRST
  // so the specifics below take precedence.
  await page.route('**/v1/admin/master-dishes**', (r: Route) =>
    json(r, { success: true, data: { items: [] }, meta: { total: 0, limit: 50 } }));
  await page.route('**/v1/admin/master-dishes/cuisines', (r: Route) =>
    json(r, { success: true, data: { cuisines: [] } }));

  // Queue tab API — GET lists, PATCH resolves.
  await page.route('**/v1/admin/master-dishes/queue**', (r: Route) => {
    if (r.request().method() === 'PATCH') {
      captured.patchBody = r.request().postDataJSON();
      return patchSucceeds
        ? json(r, { success: true, data: { id: 101, status: 'alias', linked_listings: 3 } })
        : json(r, { success: false, error: { message: 'Resolve failed' } });
    }
    captured.queueGets += 1;
    return json(r, { success: true, data: { items: [QUEUE_ITEM] } });
  });

  return captured;
}

test.describe('WORKFLOW: admin dish review queue — link a custom name as an alias', () => {
  test('admin opens the queue tab and links a custom name to a canonical dish', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stubApis(page);

    await page.goto('/admin/master-dishes');
    await expect(page).toHaveURL(/\/admin\/master-dishes/);
    await expect(page.getByRole('heading', { name: 'Master Dishes' })).toBeVisible();

    // Switch to the Review Queue tab
    await page.getByRole('button', { name: /Review Queue/ }).click();
    await expect(page.getByText('Perugu Vada')).toBeVisible();
    await expect(page.getByText(/seen at 3 restaurants/i)).toBeVisible();
    await expect(page.getByText('Dahi Vada')).toBeVisible();
    await page.screenshot({ path: path.join(shotDir('before'), 'dish-queue__pending.png'), fullPage: true });

    await page.getByRole('button', { name: 'Link as alias' }).click();

    await expect(page.getByText(/3 listings now point to/i)).toBeVisible();
    await page.screenshot({ path: path.join(shotDir('after'), 'dish-queue__resolved.png'), fullPage: true });

    expect(cap.patchBody).toEqual({ action: 'alias', master_dish_id: 7 });
  });

  test('auth gate: no session is redirected to /login and never loads the queue', async ({ page }) => {
    const cap = await stubApis(page);
    await page.goto('/admin/master-dishes');
    await expect(page).toHaveURL(/\/login/);
    expect(cap.queueGets).toBe(0);
  });

  test('edge: PATCH failure shows an error toast, not the success toast', async ({ page, context }) => {
    await seedAdminSession(context, page);
    await stubApis(page, { patchSucceeds: false });
    await page.goto('/admin/master-dishes');
    await page.getByRole('button', { name: /Review Queue/ }).click();
    await expect(page.getByText('Perugu Vada')).toBeVisible();
    await page.getByRole('button', { name: 'Link as alias' }).click();
    await expect(page.getByText(/Resolve failed/i)).toBeVisible();
    await expect(page.getByText(/listings now point to/i)).toHaveCount(0);
  });
});
