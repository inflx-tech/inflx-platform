import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CONVERSION campaign creation — live-local E2E (Playwright, brand-web).
 *
 * Prereq: `pnpm dev:all` running + `node qa/scripts/seed-conversion-e2e.mjs`
 * (approved brand +919900000001 + approved influencer @test_creator).
 * Run: `pnpm qa:e2e:conversion`.
 *
 * Drives the real brand-web wizard against the real local backend:
 *   login → new campaign → conversion set (coupon + handpick invite of the
 *   seeded influencer) → publish → assert active. A screenshot is captured
 *   at every step into qa/artifacts/screenshots/conversion-e2e/.
 */

const SHOTS = path.join(__dirname, '..', 'artifacts', 'screenshots', 'conversion-e2e');
const SESSION_FILE = path.join(__dirname, '..', 'artifacts', '.brand-session.json');
const COUPON_PREFIX = 'SAVE20';
const CAMPAIGN_NAME = `QA Conversion ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

let stepNo = 0;
async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  stepNo += 1;
  const file = path.join(SHOTS, `${String(stepNo).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[shot] ${file}`);
}

function plusDays(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10); // yyyy-mm-dd for <input type=date>
}

test('brand creates + publishes a CONVERSION campaign (handpick invite)', async ({ page, context }) => {
  // ─────────────────────────────────────────────────────────────
  // 1. PROGRAMMATIC AUTH (login is a SEPARATE flow — not under test here).
  //    The seed minted a real brand session; inject it so we start signed-in.
  //    This also avoids the (correct) /auth/send-otp rate limiter.
  // ─────────────────────────────────────────────────────────────
  // Watch invite responses — a conversion invite that 422s means the
  // influencer is silently dropped and the campaign publishes with 0
  // influencers. Asserting 2xx here catches that class of bug.
  const inviteStatuses: number[] = [];
  page.on('response', (r) => {
    if (/\/sets\/[^/]+\/invite$/.test(r.url())) inviteStatuses.push(r.status());
  });

  const sess = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  await context.addCookies([{
    name: 'inflx_token', value: sess.access_token, domain: 'localhost', path: '/',
    sameSite: 'Strict',
  }]);
  await page.addInitScript((s) => {
    localStorage.setItem('inflx_token', s.access_token);
    localStorage.setItem('inflx_user', JSON.stringify(s.user));
    if (s.brand) localStorage.setItem('inflx_brand', JSON.stringify(s.brand));
  }, sess);

  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard**', { timeout: 25_000 });
  await shot(page, 'dashboard');

  // ─────────────────────────────────────────────────────────────
  // 2. NEW CAMPAIGN — Step 1 (details)
  // ─────────────────────────────────────────────────────────────
  await page.goto('/dashboard/campaigns/new');
  await expect(page.getByText(/Campaign name/i)).toBeVisible();
  await page.getByPlaceholder('e.g. Summer Collection 2025').fill(CAMPAIGN_NAME);
  // dates: start = tomorrow, end = +30d (end>start required)
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(plusDays(1));
  await dateInputs.nth(1).fill(plusDays(30));
  // conversion-only → total budget left empty
  await shot(page, 'step1-details');
  await page.locator('button.btn-next').click();

  // ─────────────────────────────────────────────────────────────
  // 3. Step 2 — the SET (goal=conversion, coupon, handpick invite)
  // ─────────────────────────────────────────────────────────────
  await expect(page.locator('.cc-ct', { hasText: 'Deliverable sets' })).toBeVisible();
  // set name
  await page.locator('input.inp').first().fill('Conversion Set A');
  // goal = Conversion (click the goal card)
  await page.locator('.goal-grid .gc', { hasText: 'Conversion' }).click();
  await shot(page, 'step2-goal-conversion');

  // content window (within campaign dates)
  const setDates = page.locator('input[type="date"]');
  await setDates.nth(0).fill(plusDays(2));
  await setDates.nth(1).fill(plusDays(20));

  // pick a content format
  await page.locator('.fmt-chip', { hasText: /reel/i }).first().click();

  // coupon prefix (required for conversion)
  await page.getByPlaceholder(/SALE25/i).fill(COUPON_PREFIX);
  await shot(page, 'step2-coupon');

  // mode = handpick (default) — search + add the SEEDED dummy specifically
  await page.locator('.mode-btn', { hasText: /handpick/i }).click();
  await page.locator('.browse-search').fill('test_creator');
  // search is debounced (350ms) — wait for the filtered result for OUR dummy,
  // not just any card (the dev DB has other creators too).
  const dummyCard = page.locator('.browse-card', { hasText: /Dummy Creator|test_creator/i });
  await expect(dummyCard).toBeVisible({ timeout: 20_000 });
  await shot(page, 'step2-browse-results');
  await dummyCard.first().click();
  await page.locator('.browse-add-btn').click();
  await shot(page, 'step2-influencer-added');

  // per-influencer terms (conversion set requires post_date + commission_pct
  // AND — per backend campaign.controller.js:654 — an offer_type, else the
  // invite 422s and the influencer is silently dropped on publish).
  await page.locator('.post-date-inp').first().fill(plusDays(5)); // within window 2..20
  await page.getByPlaceholder('e.g. 10').first().fill('10');      // commission %
  // offer type = Discount (exact, not "Volume discount") + value
  await page.locator('.ot', { hasText: /^Discount$/ }).click();
  await page.getByPlaceholder('e.g. 20').first().fill('20');      // 20% off
  await shot(page, 'step2-influencer-terms');

  // proceed to review
  await page.locator('button.btn-next', { hasText: /review/i }).click();

  // ─────────────────────────────────────────────────────────────
  // 4. Step 3 — review & publish
  // ─────────────────────────────────────────────────────────────
  await expect(page.locator('.cc-ct', { hasText: /Review & publish/i })).toBeVisible();
  await shot(page, 'step3-review');
  await page.locator('button.btn-pub').click();

  // success = redirected away from /new (to detail or list) OR a success state
  await page.waitForURL((url) => !url.pathname.endsWith('/new'), { timeout: 30_000 });
  await shot(page, 'published');

  // sanity: we are no longer on the wizard
  expect(page.url()).not.toContain('/campaigns/new');

  // the influencer was actually invited (no silent 422 drop)
  expect(inviteStatuses.length, 'invite endpoint should have been called').toBeGreaterThan(0);
  expect(
    inviteStatuses.every((s) => s >= 200 && s < 300),
    `all invites should be 2xx — got ${JSON.stringify(inviteStatuses)}`,
  ).toBeTruthy();
});

/**
 * D9 GUARD — the wizard must BLOCK a conversion handpick influencer with no
 * offer type (mirrors backend campaign.controller.js:654). Before the fix,
 * Review proceeded and the invite silently 422'd on publish.
 */
test('D9: blocks review when a conversion influencer has no offer type', async ({ page, context }) => {
  const sess = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  await context.addCookies([{ name: 'inflx_token', value: sess.access_token, domain: 'localhost', path: '/', sameSite: 'Strict' }]);
  await page.addInitScript((s) => {
    localStorage.setItem('inflx_token', s.access_token);
    localStorage.setItem('inflx_user', JSON.stringify(s.user));
    if (s.brand) localStorage.setItem('inflx_brand', JSON.stringify(s.brand));
  }, sess);

  await page.goto('/dashboard/campaigns/new');
  await expect(page.getByText(/Campaign name/i)).toBeVisible();
  await page.getByPlaceholder('e.g. Summer Collection 2025').fill(`QA D9 Guard ${Date.now()}`);
  const d = page.locator('input[type="date"]');
  await d.nth(0).fill(plusDays(1));
  await d.nth(1).fill(plusDays(30));
  await page.locator('button.btn-next').click();

  await expect(page.locator('.cc-ct', { hasText: 'Deliverable sets' })).toBeVisible();
  await page.locator('input.inp').first().fill('Guard Set');
  await page.locator('.goal-grid .gc', { hasText: 'Conversion' }).click();
  const sd = page.locator('input[type="date"]');
  await sd.nth(0).fill(plusDays(2));
  await sd.nth(1).fill(plusDays(20));
  await page.locator('.fmt-chip', { hasText: /reel/i }).first().click();
  await page.getByPlaceholder(/SALE25/i).fill('GUARD20');
  await page.locator('.mode-btn', { hasText: /handpick/i }).click();
  await page.locator('.browse-search').fill('test_creator');
  const dummy = page.locator('.browse-card', { hasText: /Dummy Creator|test_creator/i });
  await expect(dummy).toBeVisible({ timeout: 20_000 });
  await dummy.first().click();
  await page.locator('.browse-add-btn').click();

  // fill post_date + commission but DELIBERATELY skip the offer type
  await page.locator('.post-date-inp').first().fill(plusDays(5));
  await page.getByPlaceholder('e.g. 10').first().fill('10');

  // attempt Review → must be blocked by the D9 validation
  await page.locator('button.btn-next', { hasText: /review/i }).click();
  await shot(page, 'd9-blocked');

  // the new error is shown and we did NOT reach the review step
  await expect(page.getByText('Pick an offer type').first()).toBeVisible();
  await expect(page.locator('.cc-ct', { hasText: /Review & publish/i })).toHaveCount(0);
  expect(page.url()).toContain('/campaigns/new');
});
