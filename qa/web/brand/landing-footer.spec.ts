import { test, expect } from '@playwright/test';
import { LEGAL_SURFACE_LIVE } from '../../../Packages/brand-web/lib/legal/nav';

/**
 * WORKFLOW: public landing footer — v1.0.0.
 * Contract: features/landing-legal-surface/ (phase 1 — landing page only).
 *
 * The legal documents are built and pass QA but are NOT published, because
 * the statutory disclosures in company.js are still unsupplied. This spec
 * guards the seam that creates: the public footer must never advertise a
 * page that is not live, and must never show a half-filled statutory field.
 *
 * It is phase-aware rather than skipped, so it keeps testing something real
 * on both sides of the LEGAL_SURFACE_LIVE flip. The legal-route workflows
 * ship in the same change as the pages themselves.
 */

test.describe('WORKFLOW: public landing footer', () => {
  test('the ownership notice is public from day one', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Needs no founder-supplied fact, so there is no reason for it to wait.
    await expect(page.getByText(/© \d{4} Omnara India Private Limited\. All rights reserved\./).first()).toBeVisible();
    await expect(page.getByText(/INFLX is a product of Omnara India Private Limited/).first()).toBeVisible();
    await expect(page.getByText(/intellectual property of Omnara India Private Limited/).first()).toBeVisible();

    // The year is computed, never hard-coded — a stale copyright year is the
    // most common defect on legal pages.
    const year = new Date().getFullYear();
    await expect(page.getByText(new RegExp(`© ${year} Omnara`)).first()).toBeVisible();
  });

  test('the footer has no dead links, and everything it shows resolves', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const hrefs = await page.locator('footer a').evaluateAll((as) =>
      as.map((a) => a.getAttribute('href') || ''),
    );

    expect(hrefs.length, 'footer rendered no links at all').toBeGreaterThan(0);
    expect(hrefs.filter((h) => h === '#' || h === ''), 'footer has dead links').toEqual([]);

    for (const href of hrefs.filter((h) => h.startsWith('/'))) {
      const res = await page.request.get(href.split('#')[0] || '/');
      expect(res.status(), `footer link ${href} is broken`).toBeLessThan(400);
    }
  });

  test('the footer matches its publication phase exactly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const legalLinks = page.locator('footer a[href^="/legal"]');
    const placeholders = page.locator('footer [data-tbd]');

    // Either way, an unfilled statutory field must never be public.
    await expect(placeholders, 'footer shows an unfilled statutory field in public').toHaveCount(0);

    if (LEGAL_SURFACE_LIVE) {
      await expect(page.locator('footer a[href="/legal/grievance"]'),
        'the Grievance Officer must be one hop from the home page').toHaveCount(1);
    } else {
      await expect(legalLinks,
        'footer links to a legal page that is not published yet').toHaveCount(0);
    }
  });

  test('the landing page has no dark surface', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // The page was rebuilt from a dark theme to white + yellow. This measures
    // rendered backgrounds rather than trusting the source, so a stray dark
    // panel reintroduced anywhere on the route fails here.
    const darkCount = await page.evaluate(() => {
      const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
      let dark = 0;
      document.querySelectorAll('*').forEach((el) => {
        const m = getComputedStyle(el).backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        if (!m) return;
        const [, r, g, b, a] = m.map(Number);
        if (a === 0) return;
        const rect = el.getBoundingClientRect();
        if (rect.width * rect.height < 200) return;
        if (luminance(r, g, b) < 90) dark += 1;
      });
      return dark;
    });

    expect(darkCount, 'a dark surface is back on the landing page').toBe(0);
  });
});
