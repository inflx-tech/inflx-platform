import { test, expect } from '@playwright/test';
import { seedAdminSession, stubApiPermissive } from '../_helpers/adminSession';

/**
 * WORKFLOW: admin navigation sweep — v0.3.0.
 * Contract: features/admin-nav-sweep/ (re-locked 2026-05-18).
 *
 * BREADTH NET — asserts only what a navigation sweep can soundly
 * assert with a uniform stub:
 *   (a) an authenticated admin is NOT gated out (final URL is the
 *       route, not /login)  → catches gate / auth-wrap regressions
 *   (b) the route resolves server-side (HTTP < 400)
 *       → catches NAV→route drift / 404s
 *
 * It does NOT assert "no client error" — per-endpoint data-shape
 * robustness is endpoint-specific and cannot be sound under one
 * uniform stub. Pages that crash on a realistic empty payload are
 * tracked as genuine findings in features/admin-data-robustness/
 * (A5b) — surfaced, not hidden, not suppressed here.
 */

const ROUTES = [
  '/admin',
  '/admin/analytics',
  '/admin/approvals',
  '/admin/brands',
  '/admin/influencers',
  '/admin/niches/other',
  '/admin/production-queue',
  // '/admin/master-dishes' removed 2026-09-19: the page left with the cut (60ca1d9); the entry was stale.
  '/admin/marketing/inbox',
  '/admin/marketing/funnel',
  '/admin/marketing/settings',
  '/admin/escrow',
  '/admin/payouts',
  '/admin/subscriptions',
  '/admin/billing/invoices',
  '/admin/pricing/tiers',
  '/admin/pricing/features',
  '/admin/pricing/categories',
  '/admin/settings/payments',
  '/admin/users',
];

// features/admin-people-pipeline: Triage/Add Lead/Verifications/Invitations
// stopped being their own nav rows and folded into tabs on Influencers/Brands
// (see 03-expected-outputs.md's fold-in map). The old routes are now
// server-side redirects, not pages of their own, so they get their own
// "lands somewhere real" assertion instead of the "stays put" one above.
const REDIRECTS = [
  { from: '/admin/marketing/leads', to: '/admin/influencers' },
  { from: '/admin/marketing/add', to: '/admin/influencers' },
  { from: '/admin/marketing/verifications', to: '/admin/influencers' },
  { from: '/admin/marketing/invitations', to: '/admin/influencers' },
];

test.describe('WORKFLOW: admin navigation sweep', () => {
  for (const route of ROUTES) {
    test(`route ${route} is reachable by an admin (not gated out, resolves)`, async ({ page, context }) => {
      await seedAdminSession(context, page);
      await stubApiPermissive(page);

      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
      const status = resp?.status() ?? 0;
      const pathname = new URL(page.url()).pathname;

      // (a) not gated out to /login
      expect(pathname, `admin was redirected away from ${route} (→ ${pathname})`).not.toMatch(/\/login/);
      expect(
        pathname === route || pathname.startsWith(route + '/'),
        `expected to stay on ${route}, got ${pathname}`,
      ).toBeTruthy();

      // (b) route resolved server-side (no NAV→404 drift)
      expect(status, `route ${route} returned HTTP ${status}`).toBeLessThan(400);
    });
  }

  for (const { from, to } of REDIRECTS) {
    test(`superseded route ${from} redirects to ${to} (not gated out, resolves)`, async ({ page, context }) => {
      await seedAdminSession(context, page);
      await stubApiPermissive(page);

      const resp = await page.goto(from, { waitUntil: 'domcontentloaded' });
      const status = resp?.status() ?? 0;
      const pathname = new URL(page.url()).pathname;

      expect(pathname, `admin was redirected away from ${from} (→ ${pathname})`).not.toMatch(/\/login/);
      expect(
        pathname === to || pathname.startsWith(to + '/'),
        `expected ${from} to redirect into ${to}, landed on ${pathname}`,
      ).toBeTruthy();
      expect(status, `redirect target for ${from} returned HTTP ${status}`).toBeLessThan(400);
    });
  }
});
