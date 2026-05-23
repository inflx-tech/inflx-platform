import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * WORKFLOW: brand-web Meals control surface (P2).
 * Contract: features/meals-restaurant-web/.
 *
 * Seeds a brand session (cookie + localStorage role=brand), stubs the
 * Meals + layout APIs (no live backend), and asserts both tabs render
 * — the deterministic offer-setup view and the live order-book
 * dashboard. Screenshots feed the before/after diff.
 */

const SHOTS = path.join(__dirname, '..', '..', 'artifacts', 'screenshots', 'after');
function shot(page: any, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  return page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
}

const json = (route: Route, body: object) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function seedBrand(context: any, page: any) {
  await context.addCookies([{ name: 'inflx_token', value: 'qa-brand', url: 'http://localhost:3002' }]);
  await page.addInitScript(() => {
    localStorage.setItem('inflx_token', 'qa-brand');
    localStorage.setItem('inflx_user', JSON.stringify({ role: 'brand', phone: '+919000000001' }));
  });
}

async function stub(page: any) {
  // Permissive first (lowest priority); specific routes registered after win.
  await page.route('**/v1/**', (r: Route) => json(r, { success: true, data: {} }));
  await page.route('**/auth/refresh', (r: Route) => json(r, { success: true, data: { access_token: 'qa-brand' } }));
  await page.route('**/notifications', (r: Route) => json(r, { success: true, data: { unread_count: 0 } }));
  await page.route('**/brands/me', (r: Route) => json(r, { success: true, data: { brand: { status: 'approved' } } }));
  await page.route('**/meals/config', (r: Route) => json(r, { success: true, data: { config: {
    brand_id: 'b1', enabled: true, delivery_radius_km: 5, max_discount_pct: 25,
    never_below_cost: true, auto_offer: false, discount_clock: [{ unit: 'hour', n: 2, pct: 5 }],
  } } }));
  await page.route('**/meals/offer-rules*', (r: Route) => {
    if (r.request().method() === 'POST') {
      return json(r, { success: true, data: { ai_mode: 'mock', suggested: [
        { id: 's1', name: 'Family Mixed Pack', party_size: 'family', offer_kind: 'mixed', base_price: 1040,
          status: 'suggested', source: 'ai', items_json: [], freebies_json: ['Raita x2'] },
      ] } });
    }
    return json(r, { success: true, data: { offer_rules: [
      { id: 'r1', name: 'Family Mixed Pack', party_size: 'family', offer_kind: 'mixed', base_price: 1040,
        discount_type: 'flat', discount_value: 90, status: 'active', photo_url: null, items_json: [], freebies_json: [] },
      { id: 's1', name: 'Family Mixed Pack (AI)', party_size: 'family', offer_kind: 'mixed', base_price: 1040,
        status: 'suggested', source: 'ai', photo_url: null, items_json: [], freebies_json: ['Raita x2'] },
      { id: 's2', name: 'Office Pre-book (AI)',   party_size: 'office', offer_kind: 'early_order', base_price: 3360,
        status: 'suggested', source: 'ai', photo_url: null, items_json: [], freebies_json: ['Free delivery'] },
    ] } });
  });
  await page.route('**/meals/dashboard*', (r: Route) => json(r, { success: true, data: {
    slot_date: '2026-05-24', slots: [], active_slot: { capacity: 40 },
    stats: { confirmed: 1, capacity: 40, capacity_left: 39, revenue: 950, meals: 4 },
    orders: [{ id: 'o1', customer_name: 'Aveen S.', party_size: 'family', amount: 950, status: 'paid', items_json: [] }],
    prep_summary: [{ name: 'Chicken Biryani', qty: 2 }, { name: 'Veg Biryani', qty: 2 }],
    unmatched: [{ id: 'u1', raw_text: 'Jain biryani for 2, no onion no garlic', party_size: 'duo' }],
  } }));
}

test.describe('WORKFLOW: brand-web Meals control surface', () => {
  test('restaurant can view offers-by-party-size and the live order book', async ({ page, context }) => {
    await seedBrand(context, page);
    await stub(page);

    await page.goto('/dashboard/meals');

    // Setup tab (mockup 01)
    await expect(page.getByRole('heading', { name: /INFLX Meals/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Family' })).toBeVisible();
    await expect(page.getByText('Family Mixed Pack', { exact: true })).toBeVisible();
    await expect(page.getByText('Your discount clock')).toBeVisible();
    await expect(page.getByText('Create your own offer — by chat')).toBeVisible();
    // P-AI-INTEL: the AI banner + suggested cards section.
    await expect(page.getByText('AI offer suggestions')).toBeVisible();
    await expect(page.getByText('✨ AI suggested — review & accept')).toBeVisible();
    await shot(page, 'meals-setup__offers.png');

    // Today tab (mockup 04)
    await page.getByRole('button', { name: "Today's orders" }).click();
    await expect(page.getByText('locked revenue')).toBeVisible();
    await expect(page.getByText('Order book filling')).toBeVisible();
    await expect(page.getByText('Kitchen prep (so far)')).toBeVisible();
    await expect(page.getByText('Aveen S.')).toBeVisible();
    await shot(page, 'meals-setup__today.png');
  });
});
