import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Part 5 §1–§2 — the campaign's total and end date are DERIVED from its sets.
 * Contract: features/collab-part5-sales-aim-separation (B4, B5, B5b, B5d, B6, B7)
 *
 * The rule under test is the one that looks obviously wrong until you check: EVERY set
 * carries a posting window, sales sets included. Taking the latest window across all aims
 * would close a sales campaign on its post-by date and pull its products out of follower
 * discovery while stock remained. So only PAID windows may date a campaign, and any sales
 * set keeps the whole campaign open.
 */

const ROOT = path.resolve(__dirname, '../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rollup = require(path.join(ROOT, 'backend/src/services/campaignRollup.service.js'));

const paid = (budget: number, windowEnd: string | null, goal = 'engagement') =>
  ({ goal, set_budget: budget, window_end: windowEnd });
const sales = (windowEnd: string | null) =>
  ({ goal: 'conversion', set_budget: null, window_end: windowEnd });

test('B6 — the total is the sum of PAID set budgets only', () => {
  const d = rollup.derive([paid(30000, '2026-10-25'), paid(20000, '2026-10-20'), sales('2026-09-15')]);
  expect(d.total_budget).toBe(50000);
});

test('B7 — an all-sales campaign has no total at all', () => {
  const d = rollup.derive([sales('2026-09-15'), sales('2026-09-30')]);
  expect(d.total_budget).toBeNull();
});

test('B4 — an all-paid campaign ends on its latest paid posting window', () => {
  const d = rollup.derive([paid(10000, '2026-10-05'), paid(10000, '2026-10-25'), paid(10000, '2026-10-12')]);
  expect(d.end_date).toBe('2026-10-25');
});

test('B4 — hybrid counts as paid for both the total and the date', () => {
  const d = rollup.derive([paid(15000, '2026-11-20', 'hybrid')]);
  expect(d.total_budget).toBe(15000);
  expect(d.end_date).toBe('2026-11-20');
});

test('B5 — an all-sales campaign has NO end date even though its sets have posting windows', () => {
  // The trap. These sets DO have windows — creators must still post by 15 Sep — but
  // selling must not stop then.
  const d = rollup.derive([sales('2026-09-15'), sales('2026-09-30')]);
  expect(d.end_date).toBeNull();
});

test('B5 — a mixed campaign is open-ended: the paid window does not date it', () => {
  // The edge the founder walkthrough surfaced. A paid set posting by 31 Oct must not
  // impose a deadline on the sales set selling alongside it.
  const d = rollup.derive([sales('2026-09-15'), paid(30000, '2026-10-31')]);
  expect(d.end_date).toBeNull();
  // …while the money still totals correctly.
  expect(d.total_budget).toBe(30000);
});

test('B5 — a sales set with a LATER window still cannot date the campaign', () => {
  const d = rollup.derive([paid(30000, '2026-10-01'), sales('2026-12-31')]);
  expect(d.end_date).toBeNull();
});

test('B5d — removing the last sales set gives the campaign its derived date back', () => {
  const withSales = rollup.derive([sales('2026-09-15'), paid(30000, '2026-10-31')]);
  expect(withSales.end_date).toBeNull();

  const paidOnly = rollup.derive([paid(30000, '2026-10-31')]);
  expect(paidOnly.end_date).toBe('2026-10-31');
});

test('a paid set with no posting window leaves the campaign open rather than guessing', () => {
  const d = rollup.derive([paid(30000, null)]);
  expect(d.end_date).toBeNull();
  expect(d.total_budget).toBe(30000);
});

test('an empty campaign derives nothing', () => {
  const d = rollup.derive([]);
  expect(d.total_budget).toBeNull();
  expect(d.end_date).toBeNull();
});

test('a set with no goal yet contributes neither money nor a date', () => {
  // createSet allows goal to be null (an incomplete draft). Such a set must not date the
  // campaign — only a set that is definitely PAID may.
  const d = rollup.derive([{ goal: null, set_budget: null, window_end: '2026-10-25' }]);
  expect(d.total_budget).toBeNull();
  expect(d.end_date).toBeNull();
});

test('the rule is stated ONCE — recompute delegates to derive', () => {
  // recompute() must be read → derive() → write. If a future edit inlines the rule into
  // recompute, the write path could silently diverge from the tested one, and every
  // assertion above would keep passing while production did something else.
  const fs = require('fs');
  const src = fs.readFileSync(
    path.join(ROOT, 'backend/src/services/campaignRollup.service.js'), 'utf8'
  );
  const recomputeBody = src.slice(
    src.indexOf('async function recompute'),
    src.indexOf('function derive')
  );
  expect(recomputeBody).toContain('derive(sets)');
  // The invariant that matters: the rule's moving parts live in derive() and NOWHERE in
  // recompute(). ("is paid" legitimately appears twice inside derive — once for the money
  // sum, once for the date filter — so counting file-wide occurrences proves nothing.)
  expect(recomputeBody).not.toContain("goal === 'conversion'");
  expect(recomputeBody).not.toContain('PAID_GOALS.includes');
});
