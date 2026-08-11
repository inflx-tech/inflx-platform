import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: wizard allocation wiring.
 * Contract: features/collab-part4-offers-allocation (§4.1 wizard).
 *
 * SCOPE AND HONESTY NOTE. These are source-level assertions on the wiring, not a
 * browser drive of the control. The allocation UI sits in the terms sub-step, behind
 * goal → basics → fork → creator-pick, which needs a long brittle interaction chain
 * to reach. So this spec pins the things that silently break — a control rendered
 * inside the offer gate, a payload field dropped, hydration not reading the column —
 * and browser verification of the control itself is explicitly OWED, recorded in
 * lock.json and flagged to the founder for their walkthrough.
 *
 * The reason this matters: earlier in this contract, test D6 asserted that display
 * fields were COMPUTED and passed, while a field whitelist silently discarded them —
 * the test was green and the feature did nothing. So: assert the whole chain, and do
 * not claim browser-verified when it is source-verified.
 */

const SRC = 'Packages/brand-web/app/dashboard/campaigns/new/page.js';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const src: string = fs.readFileSync(path.join(__dirname, '../..', SRC), 'utf8');

test.describe('WORKFLOW: allocation is asked independently of any offer', () => {
  test('X1 — the allocation block is NOT inside renderOfferConfig', () => {
    // renderOfferConfig returns early when there is no offer_type. Putting allocation
    // there would make "sell at full price with no offer" unreachable in the UI —
    // the exact capability this contract exists to create.
    const allocFn = src.slice(src.indexOf('const renderAllocation'), src.indexOf('const renderOfferConfig'));
    expect(allocFn.length).toBeGreaterThan(500);
    expect(allocFn).not.toContain('if (!o.offer_type) return');
  });

  test('X2 — allocation renders before the offer block, gated only on the goal', () => {
    expect(src).toContain('{needsOffer(cur.goal) && renderAllocation(inf, false)}');
    const allocAt = src.indexOf('renderAllocation(inf, false)');
    const offerAt = src.indexOf('Offer for ${inf.name || inf.handle}');
    expect(allocAt).toBeGreaterThan(0);
    expect(allocAt).toBeLessThan(offerAt);          // allocation first
  });

  test('X3 — the offer is presented as optional in both copies', () => {
    expect(src).toContain('Leave it empty and they sell at full price, still earning commission.');
    expect(src).toContain('Leave it empty to sell at full price on commission alone.');
  });

  test('X4 — NO allocation control for open groups', () => {
    // Publish-time materialisation of joiners inserts only
    // (set_id, influencer_id, status, influencer_budget, offer_expires_at) — there is
    // nowhere to put an allocation, so a control would silently do nothing. Pinned so
    // it is not "helpfully" added back before the backend can carry it.
    expect(src).not.toContain('renderAllocation(g, true)');
    expect(src).toContain('NO allocation control for open groups, deliberately');
  });
});

test.describe('WORKFLOW: allocation round-trips', () => {
  test('X5 — every scope shape is sent, and only the relevant fields', () => {
    const payload = src.slice(src.indexOf('alloc_scope: inf.alloc_scope'), src.indexOf('offer_valid_until: inf.offer_valid_until') + 60);
    expect(payload).toContain("alloc_scope: inf.alloc_scope || 'store'");
    // Category fields only when scope is category; product ids only when products.
    expect(payload).toContain("inf.alloc_scope === 'category' ? (inf.alloc_category_node || null) : null");
    expect(payload).toContain("inf.alloc_scope === 'products'");
    expect(payload).toContain('.map(p => p.id)');
  });

  test('X6 — hydration reads the stored allocation back', () => {
    expect(src).toContain("alloc_scope: ci.alloc_scope || 'store'");
    expect(src).toContain('alloc_category_node: ci.alloc_category_node_id');
    expect(src).toContain('alloc_product_ids');
  });

  test('X7 — a saved draft resolves product details at render time', () => {
    // Hydration only restores ids and the catalogue loads asynchronously, so trusting
    // the stored object would show "Product ₹0" purely because of load order.
    expect(src).toContain('const p = products.find(x => x.id === sel.id) || sel;');
  });

  test('X8 — engagement sets send no allocation', () => {
    // An engagement creator is paid to post, not to sell.
    expect(src).toContain('...(needsOffer(s.goal) ? {');
  });
});

test.describe('WORKFLOW: the category tree', () => {
  test('X9 — a real tree, not the old flat breadcrumb select', () => {
    const allocFn = src.slice(src.indexOf('const renderAllocation'), src.indexOf('const renderOfferConfig'));
    expect(allocFn).toContain('renderNodes');           // recursive
    expect(allocFn).toContain('n.children');            // hierarchy
    expect(allocFn).toContain('product_count');         // count at every level
    expect(allocFn).toContain('depth * 20');            // indented by depth
    // The old control was a <select> of "Women › Footwear › Sandals" strings.
    expect(allocFn).not.toContain("' › '");
  });

  test('X10 — brands with no taxonomy still get a working control', () => {
    const allocFn = src.slice(src.indexOf('const renderAllocation'), src.indexOf('const renderOfferConfig'));
    expect(allocFn).toContain('brandSections.map');
    expect(allocFn).toContain('no category tree yet');
  });

  test('X11 — the styles the tree and list depend on exist', () => {
    // These live in the page's CSS constant; without them the tree renders as
    // unstyled divs and the "clear list with image, title, price" is not clear at all.
    for (const cls of ['.cc .cat-tree', '.cc .ctr', '.cc .ctn', '.cc .ctc',
                       '.cc .alloc-list', '.cc .alr', '.cc .ali', '.cc .aln', '.cc .alp']) {
      expect(src).toContain(cls);
    }
  });
});
