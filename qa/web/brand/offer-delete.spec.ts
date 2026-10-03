import { test, expect } from '@playwright/test';
import type { BrowserContext, Page, Route } from '@playwright/test';

/**
 * WORKFLOW: offer-delete W1–W4 on the brand website.
 * Contract: features/offer-delete (founder, 3 Oct 2026 · rules v1.17 §1.9, §1.12).
 * Checks 1, 2, 3, 10 and 11 of 03-expected-outputs.md, website side.
 *
 * The API is stubbed with the spec's answer shapes (01-spec.md § API): a draft deletes with
 * { deleted: true, mode: 'erased' }, an ended offer with mode 'hidden', a running offer is
 * refused 409 OFFER_LOCKED, an offer already deleted answers 404 NOT_FOUND. What the server
 * does with the rows is pinned by backend/tests/offer-delete.test.js; this pins what the
 * brand sees and presses — the buttons on each kind of row, the confirm words, the toast,
 * the pill counts, and where Delete on the offer's own page lands.
 *
 * It also pins a review finding: "← Offers" on an offer page — including the "Offer not
 * found" card that a deleted offer's page now shows — must open Listings on the Offers
 * tab, not Inventory. (Listings picks its tab from the address bar when it first draws,
 * and a client-side link draws the page before the address bar changes.)
 *
 * And the website audit's findings (3 Oct 2026): broken versions of these screens that the
 * first nine tests let through. Pinned now, on the list and on the offer's own page:
 *   - a slow server: a double-click sends ONE delete, and until it answers both box buttons
 *     are off, the red one reads "Deleting…" and a click outside leaves the box open;
 *   - already gone (deleted in another tab, or a first try whose answer was lost — the server
 *     answers 404 NOT_FOUND): the box closes with no error and no toast, and the screen
 *     reloads — the list without the row, the offer's page as its "Offer not found" card;
 *   - a refusal (409 OFFER_LOCKED) on the offer's page: the server's words in the box, the
 *     buttons on again, no leaving the page; and the next box opens without the old error;
 *   - backing out: Keep it and a click outside close the box and send nothing. Escape has no
 *     handler today (the box stays open); only "Escape sends nothing" is pinned.
 */

const BASE = process.env.QA_BRAND_WEB_URL || 'http://localhost:3002';
const ORIGIN = new URL(BASE).origin;

const day = (n: number) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

const ID = {
  draft: '11111111-1111-4111-8111-111111111111',
  racing: '66666666-6666-4666-8666-666666666666',
  scheduled: '22222222-2222-4222-8222-222222222222',
  live: '33333333-3333-4333-8333-333333333333',
  endedEarly: '44444444-4444-4444-8444-444444444444',
  endedByDate: '55555555-5555-4555-8555-555555555555',
};

type Offer = {
  id: string; name: string; deal: string | null; type_label: string; products: number; gifts: number;
  starts_on: string | null; ends_on: string | null; status: string; display_status: string; creators: number | null;
};

function offersWorld(): Offer[] {
  return [
    { id: ID.draft, name: 'Untitled offer', deal: null, type_label: 'Discount', products: 0, gifts: 0, starts_on: null, ends_on: null, status: 'draft', display_status: 'draft', creators: null },
    { id: ID.racing, name: 'Racing draft', deal: null, type_label: 'BOGO', products: 0, gifts: 0, starts_on: null, ends_on: null, status: 'draft', display_status: 'draft', creators: null },
    { id: ID.scheduled, name: 'Diwali 20% off', deal: '20% off', type_label: 'Discount', products: 6, gifts: 0, starts_on: day(5), ends_on: day(30), status: 'published', display_status: 'scheduled', creators: 0 },
    { id: ID.live, name: 'Festive kurta buy 2', deal: 'Buy 2, get 10% off', type_label: 'Bundle', products: 4, gifts: 1, starts_on: day(-3), ends_on: day(10), status: 'published', display_status: 'live', creators: 0 },
    // Ended early with End offer now …
    { id: ID.endedEarly, name: 'Monsoon sale', deal: '15% off', type_label: 'Discount', products: 8, gifts: 0, starts_on: day(-40), ends_on: day(-5), status: 'ended', display_status: 'ended', creators: 1 },
    // … and ended by its date: still 'published' in the table, Ended on screen.
    { id: ID.endedByDate, name: 'Summer linen flat 300', deal: 'Flat ₹300 off', type_label: 'Discount', products: 3, gifts: 0, starts_on: day(-60), ends_on: day(-31), status: 'published', display_status: 'ended', creators: 0 },
  ];
}

/** A stateful stand-in for the server: the list, one offer's page, and DELETE. */
class StubApi {
  offers = offersWorld();
  deletes: string[] = [];   // every DELETE, counted the moment it arrives (before any delay)
  listLoads = 0;   // how many times the page asked for the list
  // "Racing draft" was published in another tab: the server now sees it as Scheduled.
  serverSees: Record<string, string> = { [ID.racing]: 'scheduled' };
  listingCategory = 'fashion';
  // A slow server: every DELETE waits this long before it answers.
  deleteDelayMs = 0;
  // Offers deleted somewhere else after this page drew them (another tab, or a first try that
  // went through while its answer was lost). The server no longer has them: DELETE and the
  // offer's page answer 404 NOT_FOUND, and every later list answer leaves them out.
  gone = new Set<string>();
  // Every request that is not a read (bar the session renewal): "nothing was sent" = this is empty.
  writes: string[] = [];

  /** The offers the server still has. */
  private kept() {
    return this.offers.filter((o) => !this.gone.has(o.id));
  }

  counts() {
    const kept = this.kept();
    const c: Record<string, number> = { all: kept.length, live: 0, scheduled: 0, draft: 0, ended: 0 };
    for (const o of kept) c[o.display_status] += 1;
    return c;
  }

  view(o: Offer) {
    const running = o.display_status === 'live' || o.display_status === 'scheduled';
    return {
      offer: { ...o, sub_type: 'percentage', days_left: 10, starts_in: 5 },
      pool: { buy: [{ id: 'p1', name: 'Linen shirt', price: 1499, quantity: 1, from_day: o.starts_on }], gift: [], counts: { buy: 1, gift: 0 } },
      creators: [],
      posts: { live: 0, note: 'No posts yet' },
      pool_open: running,
      unsigned_invitations: 0,
    };
  }

  async install(page: Page) {
    await page.route(/\/v1\//, (route) => this.handle(route));
  }

  private async handle(route: Route) {
    const req = route.request();
    const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' };
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE', 'access-control-allow-headers': 'Content-Type, Authorization' } });
    }
    const send = (status: number, body: object) =>
      route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    const ok = (data: object) => send(200, { success: true, data });
    const fail = (status: number, code: string, message: string) => send(status, { success: false, error: { code, message } });

    const path = new URL(req.url()).pathname.replace(/^.*?\/v1/, '');
    if (req.method() !== 'GET' && path !== '/auth/refresh') this.writes.push(`${req.method()} ${path}`);
    if (path === '/auth/refresh') return ok({ access_token: 'qa-brand' });
    if (path === '/notifications') return ok({ unread_count: 0 });
    if (path === '/brands/me') return ok({ brand: { status: 'approved', category: 'fashion' }, user_status: 'approved' });
    if (path === '/brands/me/schema') return ok({ schema: { category_key: 'fashion', features: {} } });
    if (path === '/brands/me/listing-config') {
      return ok({ listing_engine_active: false, category: this.listingCategory, config: { category_key: this.listingCategory }, listing_data: { done: 1 } });
    }
    if (path === '/brands/me/products') return ok({ products: [] });
    if (path === '/listing/tree') return ok({ tree: [] });
    if (path === '/listing/brands') return ok({ brands: [] });
    if (path === '/brands/me/offers/products-without-offers') return ok({ products: [] });
    if (path === '/brands/me/gift-items') return ok({ gift_items: [] });
    if (path === '/brands/me/offers' && req.method() === 'GET') {
      this.listLoads += 1;
      // A refused delete reloads the list: from then on the row reads as the server sees it.
      const offers = this.kept().map((o) => (this.serverSees[o.id] && this.deletes.includes(o.id) ? { ...o, display_status: this.serverSees[o.id] } : o));
      return ok({ offers, counts: this.counts() });
    }

    const m = path.match(/^\/brands\/me\/offers\/([0-9a-f-]{36})$/);
    if (m) {
      if (req.method() === 'DELETE') {
        this.deletes.push(m[1]);
        if (this.deleteDelayMs) await new Promise((r) => setTimeout(r, this.deleteDelayMs));
      }
      // Looked up when it answers: a second DELETE for an offer the first one removed gets 404.
      const o = this.kept().find((x) => x.id === m[1]);
      if (req.method() === 'GET') return o ? ok(this.view(o)) : fail(404, 'NOT_FOUND', 'Offer not found');
      if (req.method() === 'DELETE') {
        if (!o) return fail(404, 'NOT_FOUND', 'Offer not found');
        const ds = this.serverSees[o.id] || o.display_status;
        if (ds === 'scheduled' || ds === 'live') {
          return fail(409, 'OFFER_LOCKED', 'This offer is still running. End it first, then you can delete it.');
        }
        this.offers = this.offers.filter((x) => x.id !== o.id);
        return ok({ deleted: true, mode: ds === 'draft' ? 'erased' : 'hidden' });
      }
    }
    return ok({});
  }
}

async function seedBrand(context: BrowserContext, page: Page) {
  await context.addCookies([{ name: 'inflx_token', value: 'qa-brand', url: ORIGIN }]);
  await page.addInitScript(() => {
    localStorage.setItem('inflx_token', 'qa-brand');
    localStorage.setItem('inflx_user', JSON.stringify({ role: 'brand', phone: '+919000000001' }));
  });
}

const row = (page: Page, name: string) => page.locator('.ofx tbody tr', { hasText: name });
const pill = (page: Page, label: string) => page.locator('.ofx .chip', { hasText: new RegExp(`^${label}`) }).locator('.n');
const dialog = (page: Page) => page.locator('.ofx .dlg');
const toast = (page: Page) => page.locator('.ofx .toast');

/** Listings is open on the Offers tab (not Inventory) and the offers table has drawn. */
async function expectOffersTab(page: Page) {
  await expect(page).toHaveURL(/\/dashboard\/products\/listing\?tab=offers$/);
  await expect(page.locator('.tabrail .tab.on')).toHaveText('Offers');
  await expect(page.getByText('Everything you have listed, organised by the categories you listed under.')).toHaveCount(0);
  await expect(page.locator('.ofx h3', { hasText: 'Offers' })).toBeVisible();
  await expect(page.locator('.ofx tbody tr').first()).toBeVisible();
}

// ── The audit's cases: a slow server, an offer already gone, a refusal, backing out ─────────────

const SLOW_MS = 2000;   // how long the slow server holds a DELETE: time to read the box in flight
const redButton = (page: Page) => dialog(page).locator('button.btn-danger');
const keepIt = (page: Page) => dialog(page).getByRole('button', { name: 'Keep it', exact: true });
const pageDelete = (page: Page) => page.getByRole('button', { name: 'Delete', exact: true });
const offerPageUrl = (id: string) => new RegExp(`/dashboard/products/offers/${id}$`);

async function openOfferPage(page: Page, id: string, name: string) {
  await page.goto(`/dashboard/products/offers/${id}`);
  await expect(page.locator('.ofx .hdr h3')).toHaveText(name);
}

/** A click on the dimmed backdrop, clear of the box (the box is centred on it). */
async function clickOutsideBox(page: Page) {
  const dim = page.locator('.ofx .dimbg');
  const bg = await dim.boundingBox();
  const box = await dialog(page).boundingBox();
  expect(bg && box).toBeTruthy();
  const x = (box!.x - bg!.x) / 2;   // halfway across the strip to the left of the box
  expect(x).toBeGreaterThan(8);
  await dim.click({ position: { x, y: box!.y - bg!.y + box!.height / 2 } });
}

/**
 * Records every toast the offers screen shows from now until the page is left. A toast goes
 * away by itself after 4 seconds, so "no toast on screen now" does not prove none was shown.
 */
async function watchToasts(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as any).__toastsSeen = seen;
    const look = () => document.querySelectorAll('.ofx .toast').forEach((t) => {
      const text = t.textContent || '';
      if (seen[seen.length - 1] !== text) seen.push(text);
    });
    look();
    new MutationObserver(look).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  return () => page.evaluate(() => (window as any).__toastsSeen as string[]);
}

/**
 * The three ways a brand might back out of the delete box, as the box is built today
 * (OffersLibrary.js and OfferPage.js draw the same one):
 *   Keep it          closes it  (the button's onClick)
 *   a click outside  closes it  (the dimmed backdrop's onClick)
 *   Escape           nothing: the box has no key handler, so it stays open. Whether it closes
 *                    is NOT pinned (adding a handler later must not turn this red); what is
 *                    pinned is that Escape, like the other two, sends nothing.
 */
async function backOutThreeWays(page: Page, api: StubApi, openBox: () => Promise<void>) {
  await openBox();
  await keepIt(page).click();
  await expect(dialog(page)).toHaveCount(0);

  await openBox();
  await clickOutsideBox(page);
  await expect(dialog(page)).toHaveCount(0);

  await openBox();
  await page.keyboard.press('Escape');
  const stillOpen = await dialog(page).waitFor({ state: 'detached', timeout: 750 }).then(() => false, () => true);
  test.info().annotations.push({ type: 'Escape on the delete box', description: stillOpen ? 'left the box open (no key handler)' : 'closed the box' });
  if (stillOpen) {
    await keepIt(page).click();
    await expect(dialog(page)).toHaveCount(0);
  }

  expect(api.deletes).toEqual([]);
  expect(api.writes).toEqual([]);
}

test.describe('WORKFLOW: offer-delete — Listings › Offers (W1, W2, W4)', () => {
  let api: StubApi;

  test.beforeEach(async ({ context, page }) => {
    api = new StubApi();
    await seedBrand(context, page);
    await api.install(page);
    await page.goto('/dashboard/products/listing?tab=offers');
    await expectOffersTab(page);
  });

  test('check 1 — Draft: Continue + Delete · Scheduled, Live: Open only · Ended (both kinds): Open + Delete, on one line', async ({ page }) => {
    const draft = row(page, 'Untitled offer');
    await expect(draft.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', `/dashboard/products/offers/${ID.draft}/edit`);
    await expect(draft.getByRole('button', { name: 'Delete' })).toHaveClass(/btn-danger/);

    for (const name of ['Diwali 20% off', 'Festive kurta buy 2']) {
      const r = row(page, name);
      await expect(r.getByRole('link', { name: 'Open' })).toBeVisible();
      await expect(r.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    }
    for (const name of ['Monsoon sale', 'Summer linen flat 300']) {
      const r = row(page, name);
      await expect(r.getByRole('link', { name: 'Open' })).toBeVisible();
      await expect(r.getByRole('button', { name: 'Delete' })).toBeVisible();
    }

    // O9: the two buttons sit on one line (Listings' own '.lst .row' sets flex-wrap: wrap).
    const a = await draft.getByRole('link', { name: 'Continue' }).boundingBox();
    const b = await draft.getByRole('button', { name: 'Delete' }).boundingBox();
    expect(a && b).toBeTruthy();
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(b!.x).toBeGreaterThan(a!.x);
  });

  test('check 2 — a draft: the confirm, Keep it changes nothing, Delete draft erases it, the Draft count drops, "Draft deleted."', async ({ page }) => {
    await expect(pill(page, 'Draft')).toHaveText('2');

    await row(page, 'Untitled offer').getByRole('button', { name: 'Delete' }).click();
    await expect(dialog(page).locator('h4')).toHaveText('Delete this draft?');
    await expect(dialog(page)).toContainText('It isn\'t published, so no creator has it and no products are held. This can\'t be undone.');
    await expect(dialog(page).getByRole('button', { name: 'Keep it' })).toBeVisible();

    await dialog(page).getByRole('button', { name: 'Keep it' }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(api.deletes).toEqual([]);

    await row(page, 'Untitled offer').getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete draft' }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(toast(page)).toHaveText('Draft deleted.');
    await expect(row(page, 'Untitled offer')).toHaveCount(0);
    await expect(pill(page, 'Draft')).toHaveText('1');
    expect(api.deletes).toEqual([ID.draft]);
  });

  test('check 3 — an ended offer (ended by its date): its own words, Delete offer, it leaves the list, the Ended count drops, "Offer deleted."', async ({ page }) => {
    await expect(pill(page, 'Ended')).toHaveText('2');

    await row(page, 'Summer linen flat 300').getByRole('button', { name: 'Delete' }).click();
    await expect(dialog(page).locator('h4')).toHaveText('Delete "Summer linen flat 300"?');
    await expect(dialog(page)).toContainText('It comes off your Offers list. Creators who had it, their posts, orders and payments keep their records.');
    await expect(dialog(page).getByRole('button', { name: 'Keep it' })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Delete offer' }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(toast(page)).toHaveText('Offer deleted.');
    await expect(row(page, 'Summer linen flat 300')).toHaveCount(0);
    await expect(pill(page, 'Ended')).toHaveText('1');
    await expect(row(page, 'Monsoon sale')).toBeVisible();
    expect(api.deletes).toEqual([ID.endedByDate]);
  });

  test('a refused delete shows the server\'s words inside the box, and the row stays', async ({ page }) => {
    // The list still shows "Racing draft" as a Draft; the server has since seen it published.
    const loadsBefore = api.listLoads;
    await row(page, 'Racing draft').getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete draft' }).click();

    await expect(dialog(page).locator('.err')).toHaveText('This offer is still running. End it first, then you can delete it.');
    await expect(dialog(page).getByRole('button', { name: 'Delete draft' })).toBeEnabled();
    await expect(toast(page)).toHaveCount(0);
    // The refusal reloads the list behind the box, so the row tells the truth once it is closed.
    await expect.poll(() => api.listLoads).toBeGreaterThan(loadsBefore);
    await dialog(page).getByRole('button', { name: 'Keep it' }).click();
    const racing = row(page, 'Racing draft');
    await expect(racing).toBeVisible();
    await expect(racing.getByRole('link', { name: 'Open' })).toBeVisible();
    await expect(racing.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  });

  test('audit — a slow delete on the list: a double-click on "Delete draft" sends ONE delete; until it answers both box buttons are off, the red one reads "Deleting…", and a click outside leaves the box open', async ({ page }) => {
    api.deleteDelayMs = SLOW_MS;
    await row(page, 'Untitled offer').getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete draft' }).dblclick();

    // In flight (the server answers after SLOW_MS).
    await expect(redButton(page)).toHaveText('Deleting…');
    await expect(redButton(page)).toBeDisabled();
    await expect(keepIt(page)).toBeDisabled();
    await clickOutsideBox(page);
    await expect(redButton(page)).toHaveText('Deleting…');   // still open, still in flight
    expect(api.deletes).toEqual([ID.draft]);

    // Answered.
    await expect(dialog(page)).toHaveCount(0);
    await expect(toast(page)).toHaveText('Draft deleted.');
    await expect(row(page, 'Untitled offer')).toHaveCount(0);
    await expect(pill(page, 'Draft')).toHaveText('1');
    expect(api.deletes).toEqual([ID.draft]);
    expect(api.writes).toEqual([`DELETE /brands/me/offers/${ID.draft}`]);
  });

  test('audit — already gone, on the list (the server answers NOT_FOUND): the box closes with no error, the list reloads without the row, and no toast claims a deletion this click did not do', async ({ page }) => {
    await expect(pill(page, 'Draft')).toHaveText('2');
    await expect(pill(page, 'Ended')).toHaveText('2');
    api.gone.add(ID.draft);   // deleted in another tab after this list was drawn
    const loadsBefore = api.listLoads;
    const toastsSeen = await watchToasts(page);

    await row(page, 'Untitled offer').getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete draft' }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, 'Untitled offer')).toHaveCount(0);
    await expect(pill(page, 'Draft')).toHaveText('1');
    expect(api.listLoads).toBeGreaterThan(loadsBefore);
    await expect(page.locator('.ofx .err')).toHaveCount(0);
    expect(api.deletes).toEqual([ID.draft]);
    // What the code does for an offer that was already gone: no toast at all.
    expect(await toastsSeen()).toEqual([]);

    // Proof the watch above was looking: a delete this click really does is announced, once.
    await row(page, 'Summer linen flat 300').getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete offer' }).click();
    await expect(toast(page)).toHaveText('Offer deleted.');
    await expect(pill(page, 'Ended')).toHaveText('1');
    expect(await toastsSeen()).toEqual(['Offer deleted.']);
  });

  test('audit — after a refused delete, the next box opens clean: the old refusal is not carried into it', async ({ page }) => {
    await row(page, 'Racing draft').getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete draft' }).click();
    await expect(dialog(page).locator('.err')).toHaveText('This offer is still running. End it first, then you can delete it.');
    await keepIt(page).click();
    await expect(dialog(page)).toHaveCount(0);

    await row(page, 'Untitled offer').getByRole('button', { name: 'Delete' }).click();
    await expect(dialog(page).locator('h4')).toHaveText('Delete this draft?');
    await expect(dialog(page).locator('.err')).toHaveCount(0);
    await expect(dialog(page).getByRole('button', { name: 'Delete draft' })).toBeEnabled();
    expect(api.deletes).toEqual([ID.racing]);
  });

  test('audit — backing out on the list: Keep it and a click outside close the box; neither they nor Escape send anything, and the row stays', async ({ page }) => {
    await backOutThreeWays(page, api, async () => {
      await row(page, 'Summer linen flat 300').getByRole('button', { name: 'Delete' }).click();
      await expect(dialog(page).locator('h4')).toHaveText('Delete "Summer linen flat 300"?');
    });
    await expect(row(page, 'Summer linen flat 300').getByRole('button', { name: 'Delete' })).toBeVisible();
    await expect(pill(page, 'Ended')).toHaveText('2');
    expect(await toast(page).count()).toBe(0);
  });
});

test.describe('WORKFLOW: offer-delete — the older Products page draws the same list', () => {
  test('its Offers sub-tab has the same buttons, deletes a draft the same way, and the toast sits bottom-right', async ({ context, page }) => {
    const api = new StubApi();
    api.listingCategory = 'restaurant';   // not a drill-down vertical: /dashboard/products stays
    await seedBrand(context, page);
    await api.install(page);
    await page.goto('/dashboard/products?tab=offers');

    await expect(row(page, 'Untitled offer').getByRole('button', { name: 'Delete' })).toBeVisible();
    await expect(row(page, 'Festive kurta buy 2').getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await expect(row(page, 'Monsoon sale').getByRole('button', { name: 'Delete' })).toBeVisible();

    await row(page, 'Untitled offer').getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete draft' }).click();
    await expect(toast(page)).toHaveText('Draft deleted.');
    await expect(row(page, 'Untitled offer')).toHaveCount(0);

    // That page's own '.prd .toast { top: 24px }' would stretch this toast down the screen.
    const box = await toast(page).boundingBox();
    expect(box!.height).toBeLessThan(80);
  });
});

test.describe('WORKFLOW: offer-delete — an offer\'s own page (W3, W4)', () => {
  let api: StubApi;

  test.beforeEach(async ({ context, page }) => {
    api = new StubApi();
    await seedBrand(context, page);
    await api.install(page);
  });

  test('check 10 — Delete on an ended offer\'s page: the same box, then back on Listings › Offers with "Offer deleted."', async ({ page }) => {
    await page.goto(`/dashboard/products/offers/${ID.endedEarly}`);
    await expect(page.locator('.ofx .hdr h3')).toHaveText('Monsoon sale');
    await expect(page.getByRole('button', { name: 'End offer now' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(dialog(page).locator('h4')).toHaveText('Delete "Monsoon sale"?');
    await expect(dialog(page)).toContainText('It comes off your Offers list. Creators who had it, their posts, orders and payments keep their records.');
    await dialog(page).getByRole('button', { name: 'Delete offer' }).click();

    await expectOffersTab(page);   // ?deleted=1 is read, then cleaned off the address
    await expect(toast(page)).toHaveText('Offer deleted.');
    await expect(row(page, 'Monsoon sale')).toHaveCount(0);
    await expect(pill(page, 'Ended')).toHaveText('1');
    expect(api.deletes).toEqual([ID.endedEarly]);
  });

  test('check 11 — a Live offer\'s page has no Delete; End offer now\'s box says it stays as Ended until you delete it', async ({ page }) => {
    await page.goto(`/dashboard/products/offers/${ID.live}`);
    await expect(page.locator('.ofx .hdr h3')).toHaveText('Festive kurta buy 2');
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'End offer now' }).click();
    await expect(dialog(page).locator('.hint')).toContainText('It stays in your list as Ended until you delete it, with its dates (');
  });

  test('review finding — "← Offers" on an offer page opens Listings on the Offers tab, not Inventory', async ({ page }) => {
    await page.goto(`/dashboard/products/offers/${ID.live}`);
    await expect(page.locator('.ofx .hdr h3')).toHaveText('Festive kurta buy 2');
    await page.getByRole('link', { name: '← Offers' }).click();
    await expectOffersTab(page);
  });

  test('review finding — a deleted offer\'s page shows "Offer not found", and its "← Offers" opens the Offers tab', async ({ page }) => {
    await page.goto(`/dashboard/products/offers/${ID.endedEarly}`);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Delete offer' }).click();
    await expectOffersTab(page);

    // Back to the page of the offer just deleted (Back, an old tab, a saved link): not found, no crash.
    await page.goto(`/dashboard/products/offers/${ID.endedEarly}`);
    await expect(page.locator('.ofx .err')).toHaveText('Offer not found');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await page.getByRole('link', { name: '← Offers' }).click();
    await expectOffersTab(page);
  });

  test('audit — a slow delete on an ended offer\'s page: a double-click on "Delete offer" sends ONE delete; until it answers both box buttons are off, the red one reads "Deleting…", and a click outside leaves the box open', async ({ page }) => {
    api.deleteDelayMs = SLOW_MS;
    await openOfferPage(page, ID.endedEarly, 'Monsoon sale');
    await pageDelete(page).click();
    await dialog(page).getByRole('button', { name: 'Delete offer' }).dblclick();

    // In flight (the server answers after SLOW_MS).
    await expect(redButton(page)).toHaveText('Deleting…');
    await expect(redButton(page)).toBeDisabled();
    await expect(keepIt(page)).toBeDisabled();
    await clickOutsideBox(page);
    await expect(redButton(page)).toHaveText('Deleting…');   // still open, still in flight
    await expect(page).toHaveURL(offerPageUrl(ID.endedEarly));
    expect(api.deletes).toEqual([ID.endedEarly]);

    // Answered: back on the list, as in check 10.
    await expectOffersTab(page);
    await expect(toast(page)).toHaveText('Offer deleted.');
    await expect(row(page, 'Monsoon sale')).toHaveCount(0);
    await expect(pill(page, 'Ended')).toHaveText('1');
    expect(api.deletes).toEqual([ID.endedEarly]);
    expect(api.writes).toEqual([`DELETE /brands/me/offers/${ID.endedEarly}`]);
  });

  test('audit — already gone, on the offer\'s page (the server answers NOT_FOUND): the box closes and the page becomes its "Offer not found" card with "← Offers"; no toast, and the list it leads to does not say "Offer deleted."', async ({ page }) => {
    await openOfferPage(page, ID.endedEarly, 'Monsoon sale');
    api.gone.add(ID.endedEarly);   // deleted in another tab after this page was drawn
    const toastsSeen = await watchToasts(page);

    await pageDelete(page).click();
    await dialog(page).getByRole('button', { name: 'Delete offer' }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('.ofx .err')).toHaveText('Offer not found');
    await expect(page.locator('.ofx .hdr h3')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    const back = page.getByRole('link', { name: '← Offers' });
    await expect(back).toHaveAttribute('href', '/dashboard/products/listing?tab=offers');
    await expect(page).toHaveURL(offerPageUrl(ID.endedEarly));   // it did not go to the list by itself
    expect(api.deletes).toEqual([ID.endedEarly]);
    expect(await toastsSeen()).toEqual([]);

    await back.click();
    await expectOffersTab(page);
    expect(await toast(page).count()).toBe(0);   // the list was not told ?deleted=1
    await expect(row(page, 'Monsoon sale')).toHaveCount(0);
    await expect(pill(page, 'Ended')).toHaveText('1');
    expect(api.deletes).toEqual([ID.endedEarly]);
  });

  test('audit — a refused delete on the offer\'s page (OFFER_LOCKED): the server\'s words inside the box, both buttons on again, the page stays; the next box opens without the old error', async ({ page }) => {
    // The server sees this offer as still running, though the page drew it as Ended.
    api.serverSees[ID.endedByDate] = 'live';
    await openOfferPage(page, ID.endedByDate, 'Summer linen flat 300');
    const toastsSeen = await watchToasts(page);
    let pagesLoaded = 0;
    page.on('load', () => { pagesLoaded += 1; });

    await pageDelete(page).click();
    await dialog(page).getByRole('button', { name: 'Delete offer' }).click();

    await expect(dialog(page).locator('.err')).toHaveText('This offer is still running. End it first, then you can delete it.');
    await expect(dialog(page).locator('h4')).toHaveText('Delete "Summer linen flat 300"?');
    await expect(redButton(page)).toHaveText('Delete offer');   // not left on "Deleting…"
    await expect(redButton(page)).toBeEnabled();
    await expect(keepIt(page)).toBeEnabled();
    await expect(page).toHaveURL(offerPageUrl(ID.endedByDate));
    expect(pagesLoaded).toBe(0);
    expect(await toastsSeen()).toEqual([]);
    expect(api.deletes).toEqual([ID.endedByDate]);

    // Keep it closes the box on the same page; pressing Delete again opens it without the refusal.
    await keepIt(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('.ofx .hdr h3')).toHaveText('Summer linen flat 300');
    await pageDelete(page).click();
    await expect(dialog(page).locator('h4')).toHaveText('Delete "Summer linen flat 300"?');
    await expect(dialog(page).locator('.err')).toHaveCount(0);
    await expect(redButton(page)).toBeEnabled();
    await expect(page).toHaveURL(offerPageUrl(ID.endedByDate));
    expect(pagesLoaded).toBe(0);
    expect(api.deletes).toEqual([ID.endedByDate]);
  });

  test('audit — backing out on the offer\'s page: Keep it and a click outside close the box; neither they nor Escape send anything, and the page stays', async ({ page }) => {
    await openOfferPage(page, ID.endedEarly, 'Monsoon sale');
    await backOutThreeWays(page, api, async () => {
      await pageDelete(page).click();
      await expect(dialog(page).locator('h4')).toHaveText('Delete "Monsoon sale"?');
    });
    await expect(page.locator('.ofx .hdr h3')).toHaveText('Monsoon sale');
    await expect(pageDelete(page)).toBeVisible();
    await expect(page).toHaveURL(offerPageUrl(ID.endedEarly));
    expect(await toast(page).count()).toBe(0);
  });
});
