import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Stage 3 slice 1 — what is owed at a level that belongs to no creator.
 * Contract: features/stage-3-watch-the-work-happen (03-expected-outputs N-4, N-5, N-6, N-8)
 * Board: 04-preview/mockups/stage3-screens.html panels ③ and ④
 *
 * THE CHANGE THESE PIN
 * The roll-up counted ONE set-level thing as a bare integer. A bare integer is a badge you
 * cannot walk down, and FINAL 4's rule is that tapping a number gets you to a button every
 * time. So each level now returns a LIST and its `own` is that list's length — the badge and
 * the things it is made of are the same fact, and cannot disagree.
 *
 * Executing, not source-asserting: both functions take their connection as an argument
 * precisely so the rules can be run against a stubbed database.
 */

const ROOT = path.resolve(__dirname, '../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const owed = require(path.join(ROOT, 'backend/src/services/collabOwedItems.service.js'));

type Row = Record<string, any>;
const conn = (rows: Row[]) => ({ async query() { return { rows }; } });
const codes = (items: any[]) => items.map(i => i.code);

const setRow = (over: Row = {}) => ({
  set_id: 'set-1', set_name: 'Sarees', goal: 'conversion', influencer_mode: 'handpick',
  without_allocation: 0, members: 2, offers_expiring: 0, live_products: 25, ...over,
});

const campRow = (over: Row = {}) => ({
  campaign_id: 'camp-1', name: 'Festive Season', status: 'active',
  total_budget: null, published_at: null, start_date: null, wallet_balance: 100000,
  sets: 2, paid_sets: 0, selling_sets: 1, members: 2, working: 2, sales: 0, ...over,
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

/* ── Set level ─────────────────────────────────────────────────────────────── */

test('N-5 — creators with nothing to sell become ONE item that names how many', async () => {
  const m = await owed.forSets('b1', conn([setRow({ without_allocation: 3 })]));
  const items = m.get('set-1');
  expect(codes(items)).toContain('NO_ALLOCATION');
  // One item, not three. A badge of 3 that decomposes into one thing to fix is a lie about
  // depth; a badge of 1 that says "3 creators" is the truth.
  expect(items.filter((i: any) => i.code === 'NO_ALLOCATION')).toHaveLength(1);
  expect(items[0].count).toBe(3);
  expect(items[0].message).toContain('3 creators');
});

test('the message reads correctly for one creator, not "1 creators"', async () => {
  const m = await owed.forSets('b1', conn([setRow({ without_allocation: 1 })]));
  expect(m.get('set-1')[0].message).toContain('1 creator has');
});

test('N-5 — an empty handpick set is named', async () => {
  const m = await owed.forSets('b1', conn([setRow({ members: 0 })]));
  expect(codes(m.get('set-1'))).toContain('EMPTY_SET');
});

test('an empty OPEN-GROUP set is not — it fills itself', async () => {
  const m = await owed.forSets('b1', conn([setRow({ members: 0, influencer_mode: 'open_group' })]));
  expect(codes(m.get('set-1'))).not.toContain('EMPTY_SET');
});

test('N-5 — a selling set whose brand lists nothing buyable is named', async () => {
  const m = await owed.forSets('b1', conn([setRow({ live_products: 0 })]));
  expect(codes(m.get('set-1'))).toContain('NOTHING_TO_BUY');
});

test('a CONTENT set is never told its shelf is empty — it sells nothing', async () => {
  const m = await owed.forSets('b1', conn([setRow({ goal: 'engagement', live_products: 0 })]));
  expect(codes(m.get('set-1'))).not.toContain('NOTHING_TO_BUY');
  // Nor is a content creator ever "unable to sell".
  const m2 = await owed.forSets('b1', conn([setRow({ goal: 'engagement', without_allocation: 0 })]));
  expect(codes(m2.get('set-1'))).toHaveLength(0);
});

test('an empty set is not ALSO told its shelf is empty — one problem, one item', async () => {
  const m = await owed.forSets('b1', conn([setRow({ members: 0, live_products: 0 })]));
  expect(codes(m.get('set-1'))).toContain('EMPTY_SET');
  expect(codes(m.get('set-1'))).not.toContain('NOTHING_TO_BUY');
});

test('N-6 — an expiring offer IS computed, and is honestly absent when nothing has a deadline', async () => {
  // The roll-up used to carry a comment saying this could not be computed because offers
  // had no expiry. That went stale: campaign_influencers.offer_valid_until (migration 148)
  // and brand_offers.store_ends_at both exist. Checked against production 2026-08-26,
  // 0 of 6 collaborations carry one — so this returns nothing, honestly, rather than being
  // left unimplemented and called impossible.
  const none = await owed.forSets('b1', conn([setRow({ offers_expiring: 0 })]));
  expect(codes(none.get('set-1'))).not.toContain('OFFER_EXPIRING');

  const some = await owed.forSets('b1', conn([setRow({ offers_expiring: 2 })]));
  expect(codes(some.get('set-1'))).toContain('OFFER_EXPIRING');
  expect(some.get('set-1').find((i: any) => i.code === 'OFFER_EXPIRING').count).toBe(2);
});

test('a healthy set owes nothing at all — an empty list, not a zero', async () => {
  const m = await owed.forSets('b1', conn([setRow()]));
  expect(m.get('set-1')).toEqual([]);
});

/* ── Campaign level ────────────────────────────────────────────────────────── */

test('N-4 — a wallet short of a content budget is named, with the shortfall', async () => {
  const m = await owed.forCampaigns('b1', conn([
    campRow({ paid_sets: 1, total_budget: 30000, wallet_balance: 25800 }),
  ]));
  const it = m.get('camp-1').find((i: any) => i.code === 'WALLET_SHORT');
  expect(it).toBeTruthy();
  expect(it.short).toBeCloseTo(4200, 2);
  expect(it.message).toContain('4200');
});

test('a SALES-only campaign is never told its wallet is short — it holds nothing', async () => {
  const m = await owed.forCampaigns('b1', conn([
    campRow({ paid_sets: 0, total_budget: 30000, wallet_balance: 0 }),
  ]));
  expect(codes(m.get('camp-1'))).not.toContain('WALLET_SHORT');
});

test('N-4 — a draft campaign that is ready but was never published is named', async () => {
  const m = await owed.forCampaigns('b1', conn([campRow({ status: 'draft', sets: 1, members: 2 })]));
  expect(codes(m.get('camp-1'))).toContain('NEVER_PUBLISHED');
});

test('a draft with no sets or nobody in it is NOT — that is a campaign still being written', async () => {
  const empty = await owed.forCampaigns('b1', conn([campRow({ status: 'draft', sets: 0, members: 0 })]));
  expect(codes(empty.get('camp-1'))).not.toContain('NEVER_PUBLISHED');
  const nobody = await owed.forCampaigns('b1', conn([campRow({ status: 'draft', sets: 2, members: 0 })]));
  expect(codes(nobody.get('camp-1'))).not.toContain('NEVER_PUBLISHED');
});

test('N-4 — 30 quiet days on a selling campaign where work HAS happened is named', async () => {
  const m = await owed.forCampaigns('b1', conn([
    campRow({ selling_sets: 1, sales: 0, working: 2, published_at: daysAgo(45) }),
  ]));
  const it = m.get('camp-1').find((i: any) => i.code === 'QUIET_SALES');
  expect(it).toBeTruthy();
  expect(it.days).toBeGreaterThanOrEqual(30);
  expect(it.message).toContain('Nothing is broken');
});

test('a YOUNG campaign is not called quiet — it is early', async () => {
  const m = await owed.forCampaigns('b1', conn([
    campRow({ selling_sets: 1, sales: 0, working: 2, published_at: daysAgo(5) }),
  ]));
  expect(codes(m.get('camp-1'))).not.toContain('QUIET_SALES');
});

test('a campaign where NOBODY has got past the shoot is not called quiet either', async () => {
  // Both conditions, deliberately. Firing on every campaign the day after it starts is how
  // a brand learns to ignore the number, which costs more than the item is worth.
  const m = await owed.forCampaigns('b1', conn([
    campRow({ selling_sets: 1, sales: 0, working: 0, published_at: daysAgo(90) }),
  ]));
  expect(codes(m.get('camp-1'))).not.toContain('QUIET_SALES');
});

test('a campaign that HAS sold is never called quiet', async () => {
  const m = await owed.forCampaigns('b1', conn([
    campRow({ selling_sets: 1, sales: 3, working: 2, published_at: daysAgo(90) }),
  ]));
  expect(codes(m.get('camp-1'))).not.toContain('QUIET_SALES');
});

test('a CONTENT-only campaign is never called quiet — nothing was ever being sold', async () => {
  const m = await owed.forCampaigns('b1', conn([
    campRow({ selling_sets: 0, sales: 0, working: 2, published_at: daysAgo(90) }),
  ]));
  expect(codes(m.get('camp-1'))).not.toContain('QUIET_SALES');
});

test('a healthy campaign owes nothing at all', async () => {
  const m = await owed.forCampaigns('b1', conn([campRow()]));
  expect(m.get('camp-1')).toEqual([]);
});

/* ── The rules the whole ladder rests on ───────────────────────────────────── */

test('N-8 — every item names the thing at fault in words a brand would use', async () => {
  const sets = await owed.forSets('b1', conn([
    setRow({ without_allocation: 2, live_products: 0, offers_expiring: 1 }),
  ]));
  const camps = await owed.forCampaigns('b1', conn([
    campRow({ status: 'draft', paid_sets: 1, total_budget: 30000, wallet_balance: 0, sets: 1, members: 1 }),
  ]));
  for (const i of [...sets.get('set-1'), ...camps.get('camp-1')]) {
    expect(i.code).toMatch(/^[A-Z_]+$/);
    expect(i.message.length).toBeGreaterThan(20);
    // A message that just restates its code tells a brand nothing.
    expect(i.message).not.toMatch(/^[A-Z_]+$/);
  }
});

test('dead creator statuses are excluded, and "cancelled" is NOT among them', async () => {
  // 'cancelled' is not a campaign_influencer_status value in production — verified against
  // the live enum. Listing it here would make the SQL throw.
  expect(owed.DEAD_STATUSES).toEqual(['declined', 'expired', 'rejected_by_brand', 'slots_filled']);
  expect(owed.DEAD_STATUSES).not.toContain('cancelled');
});

test('the quiet-sales window and the expiry window are stated once, not scattered', async () => {
  expect(owed.QUIET_SALES_DAYS).toBe(30);
  expect(owed.EXPIRING_SOON_DAYS).toBe(14);
});
