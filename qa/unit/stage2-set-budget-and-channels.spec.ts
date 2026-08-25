import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Stage 2 slice 2 — the derived set budget (§5.2) and the channels vocabulary (§5.3).
 * Contract: features/stage-2-build-a-campaign-from-the-phone
 * Board: 04-preview/mockups/stage2-screens.html panel ⑤ · action ledger #68 · #69
 */

const ROOT = path.resolve(__dirname, '../..');
/* eslint-disable @typescript-eslint/no-var-requires */
const rollup = require(path.join(ROOT, 'backend/src/services/campaignRollup.service.js'));
const channels = require(path.join(ROOT, 'backend/src/services/campaignChannels.js'));

// ── §5.2 · the derived set budget ────────────────────────────────────────────

/** Records the statements a recompute issues, so ORDER and GUARDS can be asserted. */
function recordingConn(sets: any[] = []) {
  const calls: { sql: string; params: any[] }[] = [];
  return {
    calls,
    async query(sql: string, params: any[]) {
      calls.push({ sql, params });
      if (sql.includes('UPDATE campaign_sets')) return { rows: [] };
      if (sql.includes('SELECT goal, set_budget, window_end')) return { rows: sets };
      return { rows: [] };
    },
  };
}

test('set budgets are filled BEFORE the campaign total is derived from them', async () => {
  // Order is the whole point: a total summed over budgets that have not been filled yet
  // is a total nobody agreed to. Two entry points expressing this separately is how they
  // would drift.
  const conn = recordingConn([{ goal: 'engagement', set_budget: 30000, window_end: '2026-09-25' }]);
  await rollup.recompute('camp-1', conn);
  const kinds = conn.calls.map(c =>
    c.sql.includes('UPDATE campaign_sets') ? 'fill-sets'
      : c.sql.includes('SELECT goal, set_budget') ? 'read-sets'
        : c.sql.includes('UPDATE campaigns') ? 'write-campaign' : 'other');
  expect(kinds).toEqual(['fill-sets', 'read-sets', 'write-campaign']);
});

test('the fill only ever touches DRAFT campaigns', async () => {
  // NOT in the original design — it came out of checking production before shipping.
  // A LIVE campaign ("Festive Season 2026", active) has an engagement set with
  // set_budget NULL and ₹55,000 of agreed fees underneath it. Without this guard the
  // first later set write would have moved an ACTIVE campaign's total_budget from NULL
  // to 55000 — a field escrow and the wallet gate both read, on a campaign whose fee
  // base was locked at publish.
  const conn = recordingConn();
  await rollup.recompute('camp-1', conn);
  const fill = conn.calls.find(c => c.sql.includes('UPDATE campaign_sets'))!;
  expect(fill.sql).toContain("c.status = 'draft'");
});

test('the fill only ever touches paid HANDPICK sets whose budget was never typed', async () => {
  const conn = recordingConn();
  await rollup.recompute('camp-1', conn);
  const fill = conn.calls.find(c => c.sql.includes('UPDATE campaign_sets'))!;
  // A typed budget stays typed — brand-web deliberately allows headroom over the fee sum.
  expect(fill.sql).toContain('s.set_budget IS NULL');
  // An open-group set has no roster to sum; its money is per_influencer_budget × max_cap.
  expect(fill.sql).toContain("COALESCE(s.influencer_mode, 'handpick') = 'handpick'");
  expect(fill.params[1]).toEqual(['engagement', 'hybrid']);
});

test('creators who are out of the running do not add to a derived budget', async () => {
  const conn = recordingConn();
  await rollup.recompute('camp-1', conn);
  const fill = conn.calls.find(c => c.sql.includes('UPDATE campaign_sets'))!;
  expect(fill.params[2]).toEqual(['declined', 'expired', 'rejected_by_brand', 'slots_filled']);
  // 'cancelled' is NOT a campaign_influencer_status value — checked against the live enum
  // on 2026-08-25. Including it would make this statement throw at runtime.
  expect(fill.params[2]).not.toContain('cancelled');
});

test('Part 5 still holds — the campaign total is the sum of PAID set budgets only', () => {
  const d = rollup.derive([
    { goal: 'engagement', set_budget: 30000, window_end: '2026-09-25' },
    { goal: 'conversion', set_budget: null, window_end: '2026-09-15' },
  ]);
  expect(d.total_budget).toBe(30000);
});

test('Part 5 still holds — one sales set leaves the whole campaign open-ended', () => {
  const d = rollup.derive([
    { goal: 'engagement', set_budget: 30000, window_end: '2026-09-25' },
    { goal: 'conversion', set_budget: null, window_end: '2026-09-15' },
  ]);
  expect(d.end_date).toBeNull();
});

// ── §5.3 · the channels vocabulary ───────────────────────────────────────────

test('a set that never stated channels is valid — that is every set that exists today', () => {
  expect(channels.validateChannels('conversion', null).ok).toBe(true);
  expect(channels.validateChannels('conversion', undefined).ok).toBe(true);
});

test('a sales set may name channels and a minimum', () => {
  const v = channels.validateChannels('conversion', { allowed: ['instagram', 'youtube'], minimum: 2 });
  expect(v.ok).toBe(true);
});

test('hybrid may name channels too — there is selling in it', () => {
  expect(channels.validateChannels('hybrid', { allowed: ['instagram'], minimum: 1 }).ok).toBe(true);
});

test('a CONTENT set is refused, and told why', () => {
  const v = channels.validateChannels('engagement', { allowed: ['instagram'] });
  expect(v.ok).toBe(false);
  expect(v.message).toContain('buying deliverables');
});

test('an unknown channel is refused and the valid list is named', () => {
  const v = channels.validateChannels('conversion', { allowed: ['tiktok'] });
  expect(v.ok).toBe(false);
  expect(v.message).toContain('tiktok');
  expect(v.message).toContain('instagram');
});

test('a minimum higher than the channels on offer is a typo, not a policy', () => {
  const v = channels.validateChannels('conversion', { allowed: ['instagram'], minimum: 3 });
  expect(v.ok).toBe(false);
  expect(v.message).toContain('only 1 channel');
});

test('the same channel twice is refused', () => {
  const v = channels.validateChannels('conversion', { allowed: ['instagram', 'instagram'] });
  expect(v.ok).toBe(false);
});

test('a negative or fractional minimum is refused', () => {
  expect(channels.validateChannels('conversion', { allowed: ['instagram'], minimum: -1 }).ok).toBe(false);
  expect(channels.validateChannels('conversion', { allowed: ['instagram'], minimum: 1.5 }).ok).toBe(false);
});

test('the four the board draws are all valid, and Stage 7 channels are already allowed', () => {
  // Stage 7 of Docs/THE_PLAN.md gives Facebook, X and LinkedIn their own tracked links.
  // Having them in the vocabulary now means that stage needs no migration here.
  for (const c of ['instagram', 'youtube', 'whatsapp', 'inflx_shop', 'facebook', 'x', 'linkedin']) {
    expect(channels.validateChannels('conversion', { allowed: [c] }).ok).toBe(true);
  }
});

test('the description reads as a sentence a brand would recognise', () => {
  expect(channels.describeChannels({ allowed: ['instagram', 'inflx_shop'], minimum: 2 }))
    .toBe('Instagram · Their INFLX shop — at least 2');
  expect(channels.describeChannels({ allowed: ['instagram'] })).toBe('Instagram');
  expect(channels.describeChannels(null)).toBeNull();
});
