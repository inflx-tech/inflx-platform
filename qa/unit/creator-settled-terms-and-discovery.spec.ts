import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Part 6 — the creator side.
 * Contract: features/collab-part6-creator-side (locked 2026-08-12), §6.1 + §6.2.
 *
 * Both features exist because a value that was already stored was **delivered to nobody**
 * — the exact fault family in `feedback_computed_is_not_delivered`. So the summarisers are
 * exercised directly on their real inputs (B1–B5) rather than grepped for, and the query
 * that carries them is asserted to actually select the columns.
 */

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const BLOCK = new RegExp('/\\*[\\s\\S]*?\\*/', 'g');
const LINE = new RegExp('^[ \\t]*//.*$', 'gm');
const codeOnly = (s: string) => s.replace(BLOCK, '').replace(LINE, '');

const influencerCtrl = read('backend/src/controllers/influencer.controller.js');
const proposalSvc = read('backend/src/services/proposal.service.js');
const proposalCtrl = read('backend/src/controllers/proposal.controller.js');
const campaignCtrl = read('backend/src/controllers/campaign.controller.js');

/* The two summarisers, lifted out and run for real. They are pure functions of a row. */
function loadSummarisers() {
  const src = influencerCtrl;
  const start = src.indexOf('function summariseSettledTerms');
  const end = src.indexOf('// GET /influencers/me/campaigns/:campaign_influencer_id');
  const block = src.slice(start, end);
  // eslint-disable-next-line no-new-func
  return new Function(`${block}; return { summariseSettledTerms, summariseAllocation };`)() as {
    summariseSettledTerms: (row: any) => any;
    summariseAllocation: (row: any) => any;
  };
}
const { summariseSettledTerms, summariseAllocation } = loadSummarisers();

/* ── §6.1 settled terms ───────────────────────────────────────────────────── */

test('B1 — the collaboration query actually selects the agreement and allocation', () => {
  // The whole point of this contract: these columns existed and were returned nowhere.
  expect(influencerCtrl).toContain('ci.agreement_id');
  expect(influencerCtrl).toContain('ag.terms_json      AS agreed_terms_json');
  expect(influencerCtrl).toContain('ci.alloc_scope');
  // …and the row is decorated before it is returned, so the payload carries them.
  expect(influencerCtrl).toContain('campaign.settled_terms = summariseSettledTerms(campaign)');
  expect(influencerCtrl).toContain('campaign.allocation_summary = summariseAllocation(campaign)');
});

test('B1 — the agreement join is a LEFT join, so a cold invite still returns', () => {
  // An INNER join here would make every non-agreement collaboration disappear — the exact
  // shape of the dead-offer-join defect.
  expect(influencerCtrl).toContain('LEFT JOIN collab_agreements ag ON ag.id = ci.agreement_id');
});

test('B2 — a commission agreement produces settled terms with the agreed date', () => {
  const out = summariseSettledTerms({
    agreement_id: 'a-1',
    terms_agreed_at: '2026-08-08T10:00:00Z',
    agreed_terms_json: { money: { commission_pct: 15 }, time: { post_by: '2026-09-15' } },
  });
  expect(out.agreement_id).toBe('a-1');
  expect(out.agreed_at).toBe('2026-08-08T10:00:00Z');
  expect(out.items).toEqual([
    { key: 'commission', label: 'Commission', value: '15%' },
    { key: 'post_by', label: 'Post by', value: '2026-09-15' },
  ]);
});

test('B2 — a fee agreement with a window reads as a window, not a post-by date', () => {
  const out = summariseSettledTerms({
    agreement_id: 'a-2',
    terms_agreed_at: '2026-08-08T10:00:00Z',
    agreed_terms_json: {
      money: { fee: 30000 },
      time: { window_start: '2026-10-05', window_end: '2026-10-25' },
    },
  });
  expect(out.items.map((i: any) => i.key)).toEqual(['fee', 'window']);
  expect(out.items[0].value).toBe('₹30,000');
  expect(out.items[1].value).toBe('2026-10-05 – 2026-10-25');
});

test('B3 — a cold invite has NO settled terms (null, not an empty shell)', () => {
  // Returning {} here would make the app draw an empty "already agreed" box for a creator
  // who never agreed anything — worse than showing nothing.
  expect(summariseSettledTerms({ agreement_id: null, agreed_terms_json: null })).toBeNull();
  expect(summariseSettledTerms({ agreement_id: 'a-3', agreed_terms_json: null })).toBeNull();
});

test('B3 — an agreement carrying no money or time yields null rather than an empty group', () => {
  const out = summariseSettledTerms({
    agreement_id: 'a-4',
    agreed_terms_json: { mode: 'visit' },
  });
  expect(out).toBeNull();
});

/* ── §6.1 allocation summary ──────────────────────────────────────────────── */

test('B4 — whole store, in words, and it keeps absorbing new products', () => {
  const out = summariseAllocation({ alloc_scope: 'store' });
  expect(out.label).toBe('Their whole store');
  expect(out.auto_joins_new_products).toBe(true);
});

test('B4 — a category shows its name and also auto-joins', () => {
  const out = summariseAllocation({ alloc_scope: 'category', alloc_category: 'Ethnic Wear' });
  expect(out.label).toBe('Ethnic Wear');
  expect(out.auto_joins_new_products).toBe(true);
});

test('B4 — a hand-picked list shows a count and does NOT auto-join', () => {
  // This is the distinction the creator most needs: a fixed list never grows.
  const out = summariseAllocation({ alloc_scope: 'products', alloc_product_ids: ['p1', 'p2', 'p3'] });
  expect(out.label).toBe('3 selected products');
  expect(out.auto_joins_new_products).toBe(false);
  expect(out.product_count).toBe(3);
});

test('B4 — one product is singular, because "1 selected products" is a bug people ship', () => {
  expect(summariseAllocation({ alloc_scope: 'products', alloc_product_ids: ['p1'] }).label)
    .toBe('1 selected product');
});

test('B4 — no allocation yields null, so nothing is claimed', () => {
  expect(summariseAllocation({ alloc_scope: null })).toBeNull();
});

test('B5 — the summary cannot claim auto-join for a scope that is a fixed list', () => {
  // Guards the one way this feature could mislead: saying "whole store" over a fixed list.
  const fixed = summariseAllocation({ alloc_scope: 'products', alloc_product_ids: ['a'] });
  const store = summariseAllocation({ alloc_scope: 'store' });
  expect(fixed.auto_joins_new_products).toBe(false);
  expect(store.auto_joins_new_products).toBe(true);
  // The scopes the server resolves live-are exactly the ones that auto-join (Part 4).
  expect(campaignCtrl).toContain('resolveAllocation');
});

/* ── §6.2 discovery filters ───────────────────────────────────────────────── */

test('B6/B7 — category and city are filterable', () => {
  expect(proposalSvc).toContain('AND b.category = $');
  expect(proposalSvc).toContain('AND u.city = $');
  expect(proposalSvc).toMatch(/discoverEligibleBrands\(influencerId, \{ search, category, city/);
});

test('B8 — each filter is optional and composes with the name search', () => {
  const fn = proposalSvc.slice(
    proposalSvc.indexOf('async function discoverEligibleBrands'),
    proposalSvc.indexOf('async function discoveryFacets')
  );
  // Three independent `if` guards — none nested inside another.
  expect(fn).toContain('if (search)');
  expect(fn).toContain('if (category)');
  expect(fn).toContain('if (city)');
  // No filter VALUE may be interpolated into the SQL string — only $n placeholders.
  // (Checked on the lines that build `q`; `params.push(\`%${search}%\`)` legitimately
  // interpolates to build the bound *value*, which is not an injection surface.)
  const sqlLines = codeOnly(fn)
    .split('\n')
    .filter(l => /(^|\s)q\s*\+?=/.test(l));
  expect(sqlLines.length).toBeGreaterThan(2);
  for (const line of sqlLines) {
    expect(line).not.toMatch(/\$\{\s*(category|city|search)\s*\}/);
  }
});

test('B9 — filters narrow only: the eligibility conditions are untouched', () => {
  const fn = proposalSvc.slice(
    proposalSvc.indexOf('async function discoverEligibleBrands'),
    proposalSvc.indexOf('async function discoveryFacets')
  );
  expect(fn).toContain('b.accepts_proposals = TRUE');
  expect(fn).toContain("u.status = 'approved'");
  // Every added clause is an AND — an OR here would widen the list past eligibility.
  expect(codeOnly(fn)).not.toContain(' OR ');
});

test('B10 — facets come from the same eligibility conditions as the list', () => {
  const fn = proposalSvc.slice(proposalSvc.indexOf('async function discoveryFacets'));
  expect(fn).toContain('b.accepts_proposals = TRUE');
  expect(fn).toContain("u.status = 'approved'");
  // If facets were drawn from all brands, the app would offer filters that return nothing.
  expect(fn).toContain('categories');
  expect(fn).toContain('cities');
});

test('B10 — the facets are delivered on the same response as the list', () => {
  expect(proposalCtrl).toContain('proposalService.discoveryFacets()');
  expect(proposalCtrl).toContain('success(res, { brands, facets })');
});

/* ── §6.1 on the phone ────────────────────────────────────────────────────── */

test('M1/M2 — the creator screen splits settled from new, only when settled exists', () => {
  const screen = read('Packages/Mobile/src/screens/influencer/CollabDetailScreen.js');
  expect(screen).toContain('Already agreed with you');
  expect(screen).toContain('New in this campaign');
  // Both groups are conditional on settled_terms, so a cold invite renders one list.
  expect(screen).toContain('{c.settled_terms ? (');
  expect(screen).toContain("c.settled_terms ? 'New in this campaign' : 'Terms & brief'");
});

test('M1 — Negotiate is hidden ONLY for an agreement-backed collaboration', () => {
  const screen = read('Packages/Mobile/src/screens/influencer/CollabDetailScreen.js');
  // The server already refuses renegotiation here (Part 2), so the button promised
  // something that would fail. A cold invite must keep it.
  expect(screen).toContain(".filter(a => !(a === 'negotiate' && c.settled_terms))");
});

test('M3 — the allocation is rendered in words, not a raw scope key', () => {
  const screen = read('Packages/Mobile/src/screens/influencer/CollabDetailScreen.js');
  expect(screen).toContain('You can sell');
  expect(screen).toContain('c.allocation_summary.label');
  // The raw key must never reach the screen.
  expect(codeOnly(screen)).not.toContain('allocation_summary.scope');
});

test('M4 — the discover tab filters by both facets and carries them to the API', () => {
  const screen = read('Packages/Mobile/src/screens/influencer/ProposalsHubScreen.js');
  const api = read('Packages/Mobile/src/services/api.js');
  expect(screen).toContain('facets.categories.map');
  expect(screen).toContain('facets.cities.map');
  // Tapping an active chip clears it, rather than trapping the creator in a filter.
  expect(screen).toContain('setCategory(category === cat ? null : cat)');
  expect(screen).toContain('setCity(city === ct ? null : ct)');
  expect(api).toContain('discoverBrands: (search, category, city)');
  expect(api).toContain('encodeURIComponent(category)');
});

/* ── §6.3 stays deliberately unreachable ──────────────────────────────────── */

test('A1 — nothing writes an application, so the half-built flow stays unreachable', () => {
  // Recorded, not fixed: the brand-side approve/reject handlers and the
  // pending_applications counter exist, but no creator can apply. Prod confirms it has
  // never run (0 applied rows, 0 open_group sets). This pins the absence so a future
  // half-build is a deliberate act rather than an accident.
  const backendFiles: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.js')) backendFiles.push(rel);
    }
  };
  walk('backend/src');

  const writers = backendFiles.filter(f => {
    const src = codeOnly(read(f));
    // An INSERT or an UPDATE that sets the status to 'applied'.
    return /INSERT INTO campaign_influencers[\s\S]{0,400}'applied'/.test(src)
      || /SET\s+status\s*=\s*'applied'/.test(src);
  });
  expect(writers).toEqual([]);
});

test('A2 — the brand-side application handlers are still present and untouched', () => {
  expect(campaignCtrl).toContain("Cannot approve application in '");
  expect(campaignCtrl).toContain("Cannot reject application in '");
  expect(read('backend/src/controllers/brandInbox.controller.js')).toContain("ci.status = 'applied'");
});
