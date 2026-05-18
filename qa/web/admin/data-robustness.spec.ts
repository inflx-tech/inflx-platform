import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { seedAdminSession, shotDir } from '../_helpers/adminSession';

const evidence = (page: Page, name: string) =>
  page.screenshot({ path: path.join(shotDir('after'), `a5b__${name}-empty.png`), fullPage: true });

/**
 * WORKFLOW: A5b — admin pages tolerate empty/odd API payloads.
 * Contract: features/admin-data-robustness/ (locked 2026-05-18).
 *
 * Closes the 3 genuine crash-on-empty findings deferred from A5.
 * Per page: empty `[]` and odd `{}` payloads must render the
 * existing empty/failed state with ZERO uncaught page errors and
 * the shell intact; a populated payload must still render normally
 * (proves the guard is a fallback, not a data mute).
 *
 * Single deterministic router (no route-precedence ambiguity): one
 * handler switches on the request URL — shaped data for the target
 * endpoint via `overrides`, permissive `{data:[]}` for everything
 * else (layout /admin/stats, /auth/refresh, etc).
 */

function errs(page: Page) {
  const list: string[] = [];
  page.on('pageerror', (e) => list.push(e.message));
  return list;
}

async function routeApi(
  page: Page,
  fallback: object,
  overrides: Array<{ match: string; data: unknown }> = [],
) {
  await page.route('**/v1/**', (r) => {
    const url = r.request().url();
    const hit = overrides.find((o) => url.includes(o.match));
    const body = hit
      ? { success: true, data: hit.data, meta: { total: Array.isArray(hit.data) ? hit.data.length : 0 } }
      : fallback;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

const EMPTY = { success: true, data: [], meta: {} };
const ODD = { success: true, data: {}, meta: {} };

test.describe('WORKFLOW: A5b admin data-robustness', () => {
  // ---- funnel ----
  for (const [label, payload] of [['empty []', EMPTY], ['odd {}', ODD]] as const) {
    test(`funnel — ${label} → "Failed to load funnel.", no crash`, async ({ page, context }) => {
      const e = errs(page);
      await seedAdminSession(context, page);
      await routeApi(page, payload);
      await page.goto('/admin/marketing/funnel', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Failed to load funnel.')).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/marketing\/funnel/);
      if (label === 'empty []') await evidence(page, 'funnel');
      expect(e, e.join(' | ')).toHaveLength(0);
    });
  }

  test('funnel — populated → renders normally (fallback, not a mute)', async ({ page, context }) => {
    const e = errs(page);
    await seedAdminSession(context, page);
    await routeApi(page, EMPTY, [
      {
        match: '/admin/marketing/funnel',
        data: {
          totals: { influencers: 5, brands: 3 },
          influencers: { counts: {}, conversions: {} },
          brands: { counts: {}, conversions: {} },
        },
      },
    ]);
    await page.goto('/admin/marketing/funnel', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('📊 Funnel')).toBeVisible();
    await expect(page.getByText('Failed to load funnel.')).toHaveCount(0);
    expect(e, e.join(' | ')).toHaveLength(0);
  });

  // ---- analytics ----
  for (const [label, payload] of [['empty []', EMPTY], ['odd {}', ODD]] as const) {
    test(`analytics — ${label} → no crash, shell intact`, async ({ page, context }) => {
      const e = errs(page);
      await seedAdminSession(context, page);
      await routeApi(page, payload);
      await page.goto('/admin/analytics', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/admin\/analytics/);
      await expect(page.getByText('INFL').first()).toBeVisible();
      if (label === 'empty []') await evidence(page, 'analytics');
      expect(e, e.join(' | ')).toHaveLength(0);
    });
  }

  test('analytics — populated → renders the Analytics view', async ({ page, context }) => {
    const e = errs(page);
    await seedAdminSession(context, page);
    await routeApi(page, EMPTY, [
      {
        match: '/admin/analytics',
        data: {
          overview: { total_revenue: 0, active_campaigns: 0, total_users: 0 },
          comparison: {},
          daily_signups: [],
          daily_transactions: [],
          top_campaigns: [],
          top_influencers: [],
          categories: [],
          funnel: { draft: 0, published: 0, active: 0, completed: 0, cancelled: 0, total: 0 },
        },
      },
    ]);
    await page.goto('/admin/analytics', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    expect(e, e.join(' | ')).toHaveLength(0);
  });

  // ---- marketing/leads ----
  for (const [label, payload] of [['empty []', EMPTY], ['odd {}', ODD]] as const) {
    test(`leads — ${label} → no crash, on route, shell intact`, async ({ page, context }) => {
      const e = errs(page);
      await seedAdminSession(context, page);
      await routeApi(page, payload);
      await page.goto('/admin/marketing/leads', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/admin\/marketing\/leads/);
      await expect(page.getByText('INFL').first()).toBeVisible();
      if (label === 'empty []') await evidence(page, 'leads');
      expect(e, e.join(' | ')).toHaveLength(0);
    });
  }

  test('leads — populated array → no crash (array path intact)', async ({ page, context }) => {
    const e = errs(page);
    await seedAdminSession(context, page);
    await routeApi(page, EMPTY, [
      {
        match: '/admin/marketing/filter-options',
        data: {
          cities: ['Vijayawada'], niches: [], sub_niches: [],
          industries: [], sub_industries: [], creator_tiers: [], brand_tiers: [],
        },
      },
      { match: '/admin/marketing/leads', data: [{ id: 'ld_1', target_type: 'brand', name: 'QA Lead' }] },
    ]);
    await page.goto('/admin/marketing/leads', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/marketing\/leads/);
    await expect(page.getByText('INFL').first()).toBeVisible();
    expect(e, e.join(' | ')).toHaveLength(0);
  });
});
