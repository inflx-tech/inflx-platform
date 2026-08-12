import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * WORKFLOW: W1, W6, W15 (web) — the handshake UI in the Influencers tab.
 * Contract: features/collab-part2-precampaign-handshake (mockup locked 2026-08-11).
 *
 * Drives the REAL page with the API stubbed, per the meals-setup pattern. Asserts the
 * three surfaces the mockup locked: the Requests tab with the counter as a diff, the
 * Ready-to-brief tab, and the composer opening from a creator row with money+time
 * primary and the importance markers on optional terms.
 */

const json = (route: Route, body: object) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function seedBrand(context: any, page: any) {
  await context.addCookies([{ name: 'inflx_token', value: 'qa-brand', url: 'http://localhost:3002' }]);
  await page.addInitScript(() => {
    localStorage.setItem('inflx_token', 'qa-brand');
    localStorage.setItem('inflx_user', JSON.stringify({ role: 'brand', phone: '+919000000001' }));
  });
}

const COUNTERED_REQUEST = {
  id: 'R1', influencer_id: 'INF1', status: 'countered', counter_by: 'creator', origin: 'direct',
  influencer_name: 'Asha Menon', instagram_handle: 'ashamenon',
  terms_json: { aim: 'conversion', money: { commission_pct: 12 }, time: { post_by: '2026-09-15' }, mode: 'visit', importance: { mode: 'preference' } },
  counter_terms_json: { money: { commission_pct: 15 }, time: { post_by: '2026-09-20' }, mode: 'remote' },
  brand_rounds_used: 0, creator_rounds_used: 1,
};

const AGREEMENT = {
  id: 'AGR1', influencer_id: 'INF1', status: 'ready',
  influencer_name: 'Esha P', instagram_handle: 'eshap',
  terms_json: { aim: 'conversion', money: { commission_pct: 10 }, time: { post_by: '2026-09-22' } },
  expires_at: '2026-11-11T00:00:00Z',
};

async function stub(page: any) {
  await page.route('**/v1/**', (r: Route) => json(r, { success: true, data: {} }));
  await page.route('**/auth/refresh', (r: Route) => json(r, { success: true, data: { access_token: 'qa-brand' } }));
  await page.route('**/brands/me', (r: Route) => json(r, { success: true, data: { brand: { status: 'approved' } } }));
  await page.route('**/brands/me/proposals*', (r: Route) => json(r, { success: true, data: { proposals: [] } }));
  await page.route('**/influencer-groups*', (r: Route) => json(r, { success: true, data: { groups: [] } }));
  await page.route('**/brands/me/collab-requests', (r: Route) => {
    if (r.request().method() === 'POST') {
      return json(r, { success: true, data: { sent_count: 1, skipped_count: 0, requests: [{ id: 'R9' }], skipped: [] } });
    }
    return json(r, { success: true, data: { requests: [COUNTERED_REQUEST], counter_rounds_per_side: 2 } });
  });
  await page.route('**/brands/me/agreements', (r: Route) => json(r, { success: true, data: { agreements: [AGREEMENT] } }));
  // The page consumes data.creators + meta.total/meta.tier_counts. A first draft of
  // this stub said data.influencers and every row silently vanished — same class of
  // fault as the computed-then-discarded display fields: the shape, not the logic.
  await page.route('**/influencers/search*', (r: Route) => json(r, {
    success: true,
    data: { creators: [{
      row_id: 'ROW1', linked_influencer_id: 'INF1', ig_handle: 'ashamenon', full_name: 'Asha Menon',
      source: 'onboarded', is_inflx_verified: true, tier: 'micro', city: 'Mumbai', niche: 'Ethnic',
      followers_count: 48000, view_based_er: 3.2,
    }] },
    meta: { total: 1, tier_counts: { all: 1, micro: 1 } },
  }));
}

test.describe('WORKFLOW: handshake in the Influencers tab', () => {
  test.beforeEach(async ({ context, page }) => {
    await seedBrand(context, page);
    await stub(page);
    await page.goto('/dashboard/influencers');
  });

  test('U1 — the two new sub-tabs exist, with the countered-request badge', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Requests/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ready to brief/ })).toBeVisible();
    // One countered request → badge of 1 on Requests.
    await expect(page.getByRole('button', { name: /Requests/ }).locator('.subtab-ct')).toHaveText('1');
  });

  test('U2 — a counter renders as a diff, with accept and decline', async ({ page }) => {
    await page.getByRole('button', { name: /Requests/ }).click();
    await expect(page.getByText('Asha Menon')).toBeVisible();
    // The three moves she made, old → new.
    // Scoped to the diff — '12%' also appears in the row meta, and the double match is
    // itself proof the diff rendered.
    await expect(page.locator('.hs-diff-old', { hasText: '12%' })).toBeVisible();
    await expect(page.locator('.hs-diff-new', { hasText: '15%' })).toBeVisible();
    await expect(page.locator('.hs-diff-new', { hasText: '2026-09-20' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept their terms' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decline' })).toBeVisible();
  });

  test('U3 — ready to brief lists the agreement and routes to campaign creation', async ({ page }) => {
    await page.getByRole('button', { name: /Ready to brief/ }).click();
    await expect(page.getByText('Esha P')).toBeVisible();
    await expect(page.getByText(/agreed terms/i)).toBeVisible();
    const cta = page.getByRole('button', { name: /Brief into a campaign/ });
    await expect(cta).toBeVisible();
    await cta.click();
    await page.waitForURL('**/dashboard/campaigns/new?agreement=AGR1');
  });

  test('U4 — the composer opens from a creator row, money and time first', async ({ page }) => {
    await page.getByPlaceholder('Search by name or @handle…').fill('asha');
    const btn = page.getByRole('button', { name: 'Request collab', exact: true }).first();
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByText('Request a collaboration')).toBeVisible();
    // Conversion default: commission + post-by, both marked negotiable; no fee field.
    await expect(page.getByText('Commission %')).toBeVisible();
    await expect(page.getByText('Post by')).toBeVisible();
    await expect(page.getByText('negotiable').first()).toBeVisible();
    await expect(page.getByText('Fee (₹)')).toHaveCount(0);
    // Deliverables deliberately not asked.
    await expect(page.getByText(/creator proposes what they can do/)).toBeVisible();
  });

  test('U5 — optional terms carry the requirement/preference marker', async ({ page }) => {
    await page.getByPlaceholder('Search by name or @handle…').fill('asha');
    await page.getByRole('button', { name: 'Request collab', exact: true }).first().click();
    // State a scope → the importance picker appears with both options.
    await page.getByRole('button', { name: 'Whole store' }).click();
    await expect(page.getByRole('button', { name: 'Requirement' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preference' })).toBeVisible();
    await expect(page.getByText(/declining it doesn't break the deal/)).toBeVisible();
    await page.getByRole('button', { name: 'Requirement' }).click();
    await expect(page.getByText(/cannot be countered/)).toBeVisible();
  });

  test('U6 — sending reports the outcome and the request goes on the wire correctly', async ({ page }) => {
    let sentBody: any = null;
    await page.route('**/brands/me/collab-requests', (r: Route) => {
      if (r.request().method() === 'POST') {
        sentBody = r.request().postDataJSON();
        return json(r, { success: true, data: { sent_count: 1, skipped_count: 0, requests: [{ id: 'R9' }], skipped: [] } });
      }
      return json(r, { success: true, data: { requests: [], counter_rounds_per_side: 2 } });
    });
    await page.getByPlaceholder('Search by name or @handle…').fill('asha');
    await page.getByRole('button', { name: 'Request collab', exact: true }).first().click();
    await page.getByPlaceholder('e.g. 12').fill('12');
    await page.locator('input[type="date"]').fill('2026-09-15');
    await page.getByRole('button', { name: 'Send request' }).click();
    // Both the modal heading and the toast say "Request sent" — the double match is the
    // two surfaces both confirming. Scope to the heading.
    await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible();
    // The wire format is the campaign_goal enum, not the friendly label.
    expect(sentBody.terms.aim).toBe('conversion');
    expect(sentBody.terms.money.commission_pct).toBe(12);
    expect(sentBody.terms.time.post_by).toBe('2026-09-15');
    expect(sentBody.influencer_id).toBe('INF1');
  });
});
