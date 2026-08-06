import { test, expect } from '@playwright/test';
import { DOCUMENTS } from '../../../Packages/brand-web/lib/legal/registry';
import { missingTokens, identityComplete } from '../../../Packages/brand-web/lib/legal/company';
import { LEGAL_SURFACE_LIVE } from '../../../Packages/brand-web/lib/legal/nav';

/**
 * WORKFLOW: public legal surface — v1.0.0.
 * Contract: features/landing-legal-surface/.
 *
 * Guards four things that are cheap to break and expensive to get wrong:
 *
 *   (a) every legal route is reachable WITHOUT a session. An app-store
 *       reviewer and a search crawler have no cookie; a gate added to
 *       middleware later would silently break store compliance.
 *   (b) every document named in the footer resolves. The surface this
 *       replaced had four legal links, all href="#".
 *   (c) an unknown slug 404s rather than rendering an empty shell.
 *   (d) placeholders and the real thing cannot coexist — see W8 below.
 *
 * (d) is the load-bearing one. While company.js still has unsupplied
 * facts, the pages MUST show loud placeholders and the "not yet in
 * force" banner. Once every fact is supplied, no placeholder may
 * survive anywhere. The test asserts whichever side of that line the
 * repo is currently on, so it keeps working through the transition
 * instead of having to be rewritten on the day the founder fills the
 * values in — and it fails if the two ever disagree.
 */

const SUPPORT_ROUTES = ['/legal', '/legal/grievance', '/account-deletion', '/contact'];
const DOC_ROUTES = DOCUMENTS.map((d) => `/legal/${d.slug}`);
const ALL_ROUTES = [...SUPPORT_ROUTES, ...DOC_ROUTES];

// Placeholders are detected by the data-tbd attribute that
// components/legal/RichText.js stamps on each one — NOT by searching the
// rendered text for token names. An earlier version of this test did the
// latter and passed against a build where placeholder rendering was
// deliberately broken, because "CIN" and "GSTIN" also appear as ordinary
// label text in the footer. Mutation-checked after the change.
const TBD = '[data-tbd]';

test.describe('WORKFLOW: public legal surface', () => {
  for (const route of ALL_ROUTES) {
    test(`${route} is publicly reachable with no session and renders its document`, async ({ page }) => {
      await page.context().clearCookies();
      const res = await page.goto(route, { waitUntil: 'domcontentloaded' });

      expect(res?.status(), `${route} must serve, unauthenticated`).toBeLessThan(400);
      expect(page.url(), `${route} must not redirect to /login`).not.toContain('/login');

      // A legal page with a heading but no body is worse than no page.
      await expect(page.locator('h1')).toBeVisible();
      const text = await page.locator('body').innerText();
      expect(text.length, `${route} rendered almost no content`).toBeGreaterThan(600);
    });
  }

  test('an unknown legal slug 404s rather than rendering an empty shell', async ({ page }) => {
    const res = await page.goto('/legal/not-a-real-policy', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(404);
  });

  test('no footer link is dead, and every link shown actually resolves', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const hrefs = await page.locator('footer a').evaluateAll((as) =>
      as.map((a) => a.getAttribute('href') || ''),
    );

    expect(hrefs.filter((h) => h === '#' || h === ''), 'footer has dead links').toEqual([]);

    // Whatever the footer chooses to show must resolve. In phase 1 that is the
    // Platform anchors only; once LEGAL_SURFACE_LIVE flips it is every policy
    // link too — either way, nothing on display may 404.
    for (const href of hrefs.filter((h) => h.startsWith('/legal') || h === '/contact' || h === '/account-deletion')) {
      const res = await page.request.get(href);
      expect(res.status(), `footer link ${href} is broken`).toBeLessThan(400);
    }
  });

  test('the footer matches its publication phase exactly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const grievance = page.locator('footer a[href="/legal/grievance"]');
    const placeholders = page.locator('footer [data-tbd]');

    if (LEGAL_SURFACE_LIVE) {
      // Published: the Grievance Officer must be one hop from the home page,
      // and no statutory field may still be a placeholder in public.
      // At least one. The footer carries it in both the Help column and the
      // compliance strip, which is correct — the rule is one-hop reachability.
      expect(await grievance.count(), 'grievance must be linked from the home page footer').toBeGreaterThan(0);
      await expect(placeholders, 'a statutory placeholder is public').toHaveCount(0);
    } else {
      // Phase 1 — landing page only. The legal pages are built but unpublished,
      // so the footer must not advertise them, and must not show a half-filled
      // statutory block either. This is the check that stops an unfinished
      // Grievance Officer block reaching production.
      await expect(grievance, 'footer links to an unpublished legal page').toHaveCount(0);
      await expect(placeholders, 'footer shows an unfilled statutory field in public').toHaveCount(0);
    }

    // The ownership notice is phase-independent — it needs no supplied facts,
    // so it is on the public page from day one.
    await expect(page.getByText(/All rights reserved/).first()).toBeVisible();
    await expect(page.getByText(/INFLX is a product of Omnara India Private Limited/).first()).toBeVisible();
  });

  test('W8 — placeholders and published facts cannot coexist', async ({ page }) => {
    const complete = identityComplete();
    const pending = missingTokens().map((t) => t.key);

    await page.goto('/legal/privacy', { waitUntil: 'domcontentloaded' });
    const placeholders = await page.locator(TBD).count();

    if (complete) {
      // Every fact supplied: no placeholder may survive anywhere, and the
      // draft banner must be gone.
      expect(placeholders, 'a placeholder survived after identity was completed').toBe(0);
      await page.goto('/legal', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('not yet in force')).toHaveCount(0);
    } else {
      // Facts still missing MUST be visible as placeholders rather than
      // rendering blank or, far worse, as invented text.
      //
      // The expected set is DERIVED, not a magic number: whichever tokens the
      // privacy document actually references and are still unsupplied are
      // exactly the ones that must appear. An earlier version asserted "more
      // than 3", which was just a snapshot of how many facts happened to be
      // missing that day, and broke the moment the founder supplied some.
      expect(pending.length, 'missingTokens() disagrees with identityComplete()').toBeGreaterThan(0);

      const doc = DOCUMENTS.find((d) => d.slug === 'privacy')!;
      const referenced = new Set(
        (JSON.stringify(doc).match(/\{\{([A-Z_]+)\}\}/g) || []).map((t) => t.slice(2, -2)),
      );
      const expectedOnPage = pending.filter((k) => referenced.has(k));

      const shown = new Set(
        await page.locator(TBD).evaluateAll((els) => els.map((e) => e.getAttribute('data-tbd'))),
      );
      for (const key of expectedOnPage) {
        expect([...shown], `${key} is missing but is not surfaced on the page`).toContain(key);
      }
      expect(placeholders, 'unsupplied facts are not being surfaced on the page').toBeGreaterThan(0);

      // Each rendered placeholder must name a token that is genuinely still
      // missing — this is what catches a placeholder rendering blank, or
      // rendering for a fact that has actually been supplied.
      const marks = await page.locator(TBD).evaluateAll((els) =>
        els.map((e) => ({ name: e.getAttribute('data-tbd'), text: (e.textContent || '').trim() })),
      );
      for (const m of marks) {
        expect(pending, `page shows a placeholder for ${m.name}, which is not missing`).toContain(m.name);
        // A placeholder that renders as an empty box is invisible to a human
        // reviewer scanning the page, which defeats the whole mechanism.
        expect(m.text, `the placeholder for ${m.name} renders no visible text`).not.toBe('');
      }

      await page.goto('/legal', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('not yet in force').first()).toBeVisible();
    }
  });
});
