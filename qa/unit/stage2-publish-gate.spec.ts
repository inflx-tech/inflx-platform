import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Stage 2 slice 2 — the four publish blockers that did not exist.
 * Contract: features/stage-2-build-a-campaign-from-the-phone (03-expected-outputs B-4…B-9)
 * Board: 04-preview/mockups/stage2-screens.html panel ⑨ · action ledger #63
 *
 * Before this, campaign.controller.publish enforced ONE of the five blockers the board
 * names — the wallet. The other four states published happily, and the first is not
 * cosmetic: since Part 4, having something to sell is the gate for appearing in the
 * shopping app at all, so a creator with no allocation was contracted and invisible.
 *
 * These are EXECUTING tests, not source assertions. publishGate.evaluate takes its
 * database connection as an argument precisely so the rules can be run against a stubbed
 * catalogue — which means what is proven here is the behaviour, not that the file
 * contains a string.
 */

const ROOT = path.resolve(__dirname, '../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gate = require(path.join(ROOT, 'backend/src/services/publishGate.service.js'));

const BRAND = 'brand-1';
const CAMPAIGN = 'camp-1';

type Row = Record<string, any>;

/**
 * A stub connection that answers publishGate's three queries by shape. Deliberately
 * matched on a distinctive fragment of each statement rather than on call order, so
 * re-ordering the rules inside the service does not silently break these tests.
 */
function fakeConn({ sets = [] as Row[], cis = [] as Row[], liveProductIds = [] as string[] }) {
  return {
    async query(sql: string, params: any[]) {
      if (sql.includes('FROM campaign_sets')) return { rows: sets };
      if (sql.includes('FROM campaign_influencers')) return { rows: cis };
      if (sql.includes('FROM brand_products')) {
        const wanted: string[] = params[1] || [];
        return { rows: wanted.filter((id) => liveProductIds.includes(id)).map((id) => ({ id })) };
      }
      if (sql.includes('FROM brand_offers')) return { rows: [] };   // no live global offers
      throw new Error('unexpected query: ' + sql.slice(0, 80));
    },
  };
}

const salesSet = (over: Row = {}) => ({ id: 'set-sales', name: 'Sarees', goal: 'conversion', influencer_mode: 'handpick', set_budget: null, ...over });
const contentSet = (over: Row = {}) => ({ id: 'set-content', name: 'Reels', goal: 'engagement', influencer_mode: 'handpick', set_budget: 30000, ...over });

const creator = (over: Row = {}) => ({
  id: 'ci-1', set_id: 'set-sales', status: 'invited', influencer_id: 'inf-1',
  agreement_id: null, alloc_scope: 'store', alloc_product_ids: null, alloc_category_node_id: null,
  offer_type: 'discount', offer_config_json: {}, brand_offer_id: null, offer_valid_until: null,
  influencer_name: 'Asha M.', agreement_status: null, agreement_expires_at: null,
  ...over,
});

const codes = (r: any) => r.blockers.map((b: any) => b.code);

test('B-4 — a creator on a sales set with no allocation is refused, and named', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ alloc_scope: null })],
  }));
  expect(codes(r)).toContain('NO_ALLOCATION');
  // Naming her is the point — "something is wrong" is not an actionable refusal.
  expect(r.blockers[0].message).toContain('Asha M.');
  expect(r.blockers[0].message).toContain('nothing to sell');
});

test('B-4 — "specific products" with an empty list is refused too', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ alloc_scope: 'products', alloc_product_ids: [] })],
  }));
  expect(codes(r)).toContain('EMPTY_ALLOCATION');
});

test('B-4 — a category scope with no node chosen is refused', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ alloc_scope: 'category', alloc_category_node_id: null })],
  }));
  expect(codes(r)).toContain('EMPTY_ALLOCATION');
});

test('allocation is NOT demanded on a content set — nothing is being sold there', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [contentSet()],
    cis: [creator({ set_id: 'set-content', alloc_scope: null, offer_type: null })],
  }));
  expect(codes(r)).not.toContain('NO_ALLOCATION');
  expect(codes(r)).not.toContain('NO_SHOPPER_OFFER');
});

test('B-8 — a plain content campaign clears the gate entirely, so the WALLET check is reachable', async () => {
  // The gate runs BEFORE the wallet check in publish(), deliberately: a brand should not be
  // told to top up money for a campaign that is broken for a different reason. The cost of
  // that ordering is that any blocker firing here MASKS the wallet message. So the
  // canonical wallet case — a content set, creators in it, nothing else wrong — must come
  // through with an empty blocker list, or the pre-existing WALLET_INSUFFICIENT refusal
  // silently stops being the thing a short brand sees.
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [contentSet()],
    cis: [creator({ set_id: 'set-content', alloc_scope: null, offer_type: null, brand_offer_id: null })],
  }));
  expect(r.blockers).toEqual([]);
});

test('B-5 — a sales set where nobody has an offer, and no live global offer exists, is refused', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ offer_type: null, brand_offer_id: null })],
  }));
  expect(codes(r)).toContain('NO_SHOPPER_OFFER');
  expect(r.blockers.find((b: any) => b.code === 'NO_SHOPPER_OFFER').message).toContain('Sarees');
});

test('B-5 — one live GLOBAL offer satisfies the whole set, because that is how the shop behaves', async () => {
  // Part 4 §4.3: a published global offer reaches any creator holding those products.
  // Demanding a per-creator offer on top would be a rule the shopping app does not have.
  const conn = fakeConn({ sets: [salesSet()], cis: [creator({ offer_type: null })] });
  const withGlobal = {
    async query(sql: string, params: any[]) {
      if (sql.includes('FROM brand_offers')) return { rows: [{ id: 'go-1', name: 'Storewide 10%', offer_type: 'discount', offer_config_json: {} }] };
      return conn.query(sql, params);
    },
  };
  const r = await gate.evaluate(CAMPAIGN, BRAND, withGlobal);
  expect(codes(r)).not.toContain('NO_SHOPPER_OFFER');
});

test('B-6 — an assignment whose agreement is cancelled is refused, and named', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ agreement_id: 'agr-1', agreement_status: 'cancelled' })],
  }));
  expect(codes(r)).toContain('AGREEMENT_NOT_LIVE');
  expect(r.blockers.find((b: any) => b.code === 'AGREEMENT_NOT_LIVE').message).toContain('Asha M.');
});

test('B-6 — an assignment pointing at an agreement that no longer exists is refused', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ agreement_id: 'agr-gone', agreement_status: null })],
  }));
  expect(codes(r)).toContain('AGREEMENT_MISSING');
});

test('a consumed agreement is the NORMAL state after briefing and must not be refused', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ agreement_id: 'agr-1', agreement_status: 'consumed' })],
  }));
  expect(codes(r)).not.toContain('AGREEMENT_NOT_LIVE');
  expect(codes(r)).not.toContain('AGREEMENT_MISSING');
});

test('a COLD invite carries no agreement and is not refused for it', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ agreement_id: null, agreement_status: null })],
  }));
  expect(codes(r)).not.toContain('AGREEMENT_MISSING');
});

test('B-7 — an offer covering a product the brand does not list is refused, and counted', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ offer_type: 'discount', offer_config_json: { scope: 'products', products: ['p-live', 'p-dead'] } })],
    liveProductIds: ['p-live'],
  }));
  expect(codes(r)).toContain('OFFER_ON_UNLISTED_PRODUCT');
  const b = r.blockers.find((x: any) => x.code === 'OFFER_ON_UNLISTED_PRODUCT');
  expect(b.product_ids).toEqual(['p-dead']);
});

test('B-7 — an offer whose products are all live passes', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ offer_type: 'discount', offer_config_json: { scope: 'products', products: ['p-live'] } })],
    liveProductIds: ['p-live'],
  }));
  expect(codes(r)).not.toContain('OFFER_ON_UNLISTED_PRODUCT');
});

test('an empty handpick set WARNS but does not refuse', async () => {
  // This was a blocker for about an hour, and it was wrong. `invite` has no draft guard,
  // so a brand can publish a campaign and invite creators into it afterwards — that is how
  // an open-ended sales campaign gets topped up. Refusing an empty set would remove a real
  // existing workflow, and it is not one of the five blockers the board locks.
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({ sets: [salesSet()], cis: [] }));
  expect(codes(r)).not.toContain('EMPTY_SET');
  expect(r.warnings.map((w: any) => w.code)).toContain('EMPTY_SET');
});

test('the ONLY things that refuse a publish are the five the board locks', async () => {
  // Guards the mistake above from coming back in another shape. Every blocker this service
  // can emit must map to a locked rule; a sixth refusal invented later gets caught here.
  const LOCKED = [
    'NO_SETS',                    // pre-existing, kept
    'NO_ALLOCATION', 'EMPTY_ALLOCATION',
    'NO_SHOPPER_OFFER',
    'AGREEMENT_MISSING', 'AGREEMENT_NOT_LIVE',
    'OFFER_ON_UNLISTED_PRODUCT',
  ];
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet(), contentSet()],
    cis: [
      creator({ alloc_scope: null, offer_type: null, agreement_id: 'a1', agreement_status: 'cancelled' }),
      creator({ id: 'ci-2', set_id: 'set-content', influencer_name: 'Nisha P.', offer_type: null }),
    ],
  }));
  for (const b of r.blockers) expect(LOCKED).toContain(b.code);
});

test('a campaign with no sets at all says so and stops there', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({ sets: [], cis: [] }));
  expect(codes(r)).toEqual(['NO_SETS']);
});

test('declined and expired creators carry no obligations — they are excluded by the query', async () => {
  // The service filters them in SQL; this pins the intent so a later edit to the status
  // list is a deliberate choice rather than an accident.
  expect(gate.DEAD_STATUSES).toEqual(['declined', 'expired', 'rejected_by_brand', 'slots_filled']);
  // 'cancelled' is NOT a campaign_influencer_status value in production — verified
  // against the live enum on 2026-08-25. Putting it here would make the SQL throw.
  expect(gate.DEAD_STATUSES).not.toContain('cancelled');
});

test('an agreement close to lapsing WARNS but never blocks', async () => {
  const inSixDays = new Date(Date.now() + 6 * 86400000).toISOString();
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ agreement_id: 'agr-1', agreement_status: 'ready', agreement_expires_at: inSixDays })],
  }));
  expect(codes(r)).not.toContain('AGREEMENT_NOT_LIVE');
  expect(r.warnings.map((w: any) => w.code)).toContain('AGREEMENT_EXPIRING');
  expect(r.warnings[0].message).toContain('Asha M.');
});

test('a fully correct sales set produces no blockers at all', async () => {
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet()],
    cis: [creator({ alloc_scope: 'store', offer_type: 'discount', offer_config_json: { scope: 'store' } })],
  }));
  expect(r.blockers).toEqual([]);
});

test('every blocker names the thing at fault, never just "invalid"', async () => {
  // The board's rule: "Every blocker names the thing at fault and offers the way to it."
  const r = await gate.evaluate(CAMPAIGN, BRAND, fakeConn({
    sets: [salesSet(), contentSet()],
    cis: [
      creator({ alloc_scope: null, offer_type: null }),
      creator({ id: 'ci-2', set_id: 'set-content', influencer_name: 'Nisha P.', offer_type: null }),
    ],
  }));
  expect(r.blockers.length).toBeGreaterThan(0);
  for (const b of r.blockers) {
    expect(b.message.length).toBeGreaterThan(20);
    expect(b.message).not.toMatch(/^invalid/i);
    expect(b.code).toMatch(/^[A-Z_]+$/);
  }
});
