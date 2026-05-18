import type { Page, BrowserContext, Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared admin-session + API-stub helper for brand-web /admin/*
 * workflow specs. Extracted from the (released) A1 pattern.
 *
 * Two gates protect /admin/*:
 *   - middleware.js  → server-side cookie check (inflx_token)
 *   - app/admin/layout.js → client-side localStorage role check
 * so we seed BOTH, and stub the 5 observed admin APIs.
 */

export const ADMIN_USER = {
  role: 'admin',
  admin_role: 'superadmin',
  phone: '+919999999999',
};

export const PENDING_BRAND = {
  id: 'br_1',
  brand_name: 'QA Diner',
  category: 'restaurant',
  status: 'pending',
  created_at: '2026-05-18',
};

export async function seedAdminSession(context: BrowserContext, page: Page) {
  await context.addCookies([
    { name: 'inflx_token', value: 'qa-admin', url: 'http://localhost:3002' },
  ]);
  await page.addInitScript((user: object) => {
    localStorage.setItem('inflx_token', 'qa-admin');
    localStorage.setItem('inflx_user', JSON.stringify(user));
  }, ADMIN_USER);
}

export interface AdminApiCapture {
  patchBody?: any;
  patchCalls: number;
  queueCalls: number;
}

/** Stub the layout + queue + status APIs. Returns a live capture ref. */
export async function stubAdminApis(
  page: Page,
  opts: { patchSucceeds?: boolean } = {},
): Promise<AdminApiCapture> {
  const patchSucceeds = opts.patchSucceeds !== false;
  const cap: AdminApiCapture = { patchCalls: 0, queueCalls: 0 };

  const json = (route: Route, body: object, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/auth/refresh', (r) =>
    json(r, { success: true, data: { access_token: 'qa-admin' } }));
  await page.route('**/admin/stats', (r) =>
    json(r, { success: true, data: { pending_approvals: { brands: 1, influencers: 0 } } }));
  await page.route('**/admin/queue/brands', (r) => {
    cap.queueCalls += 1;
    return json(r, { success: true, data: { brands: [PENDING_BRAND] } });
  });
  await page.route('**/admin/queue/influencers', (r) =>
    json(r, { success: true, data: { influencers: [] } }));
  await page.route('**/admin/brands/br_1/status', (r) => {
    cap.patchCalls += 1;
    cap.patchBody = r.request().postDataJSON();
    return patchSucceeds
      ? json(r, { success: true, data: { id: 'br_1', status: 'updated' } })
      : json(r, { success: false, error: { message: 'Update failed' } }, 200);
  });

  return cap;
}

const SHOTS = path.join(__dirname, '..', '..', 'artifacts', 'screenshots');
export function shotDir(phase: 'before' | 'after') {
  const d = path.join(SHOTS, phase);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
