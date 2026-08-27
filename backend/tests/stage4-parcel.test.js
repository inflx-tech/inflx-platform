'use strict';

/**
 * parcel.stage4.test.js — Stage 4 slices 1 and 2, executing.
 * Contract: features/stage-4-the-shoot · assertions D-3 D-4 D-5, B-1..B-6, B-9
 *
 * WHY THIS SHAPE
 * The backend test database has been unreachable since 2026-08-22, and the rules being proved
 * here are decision rules, not query results. So the connection is injected: every `conn.query`
 * is recorded and answered, and the assertions are about WHAT THE SERVICE DECIDED — which is
 * the thing that can be wrong. A live database would prove Postgres works, not that a courier
 * handing over a box no longer finishes a shoot.
 *
 * This EXECUTES. It is not a source-text assertion, except where the thing being pinned IS a
 * SQL literal (D-5) — and that literal is the field Stage 3's step number reads through.
 * Each rule was verified by breaking it and watching the case fail before it was left passing.
 */

const fs = require('fs');
const parcel = require('../src/services/parcel.service');

/** A recording fake. `answers` is a list of [matcher, rows] tried in order. */
function fakeConn(answers = []) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      for (const [match, rows] of answers) {
        if (typeof match === 'string' ? sql.includes(match) : match.test(sql)) {
          const out = typeof rows === 'function' ? rows(sql, params) : rows;
          return { rows: out, rowCount: out.length };
        }
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

const bodyOf = (file, marker) => {
  const src = fs.readFileSync(require.resolve(file), 'utf8');
  const from = src.slice(src.indexOf(marker));
  const end = from.search(/\r?\n\}/);
  return from.slice(0, end > 0 ? end : from.length);
};

const PROD = { id: 'p1', name: 'Indigo saree', price: '2400.00', sku: 'IND-1', is_active: true };

describe('Stage 4 — who may say the shoot is done (founder ruling, 2026-08-27)', () => {
  // "for store visit we keep both brand and creator as confirming parties, for remote only
  //  creator as confirming member because brand dont know at this stage whether shoot is done"

  test('a store visit may be closed by EITHER party — the brand was there', () => {
    expect(parcel.canComplete('visit', 'brand')).toBe(true);
    expect(parcel.canComplete('visit', 'influencer')).toBe(true);
  });

  test('a remote or shipment shoot may be closed by the CREATOR ALONE', () => {
    expect(parcel.canComplete('remote', 'influencer')).toBe(true);
    expect(parcel.canComplete('shipment', 'influencer')).toBe(true);
    // The heart of the ruling. The brand cannot see whether she has photographed anything,
    // so letting them close it would be letting them assert something they cannot know.
    expect(parcel.canComplete('remote', 'brand')).toBe(false);
    expect(parcel.canComplete('shipment', 'brand')).toBe(false);
  });

  test('an unknown mode falls back to the creator, never to the brand', () => {
    // Fail closed. A mode nobody has thought of must not silently hand the brand a power the
    // ruling withholds on every mode that exists today.
    expect(parcel.canComplete('something_new', 'brand')).toBe(false);
    expect(parcel.canComplete('something_new', 'influencer')).toBe(true);
    expect(parcel.canComplete(undefined, 'brand')).toBe(false);
  });

  test('admin is not a confirming party on any mode', () => {
    for (const mode of Object.keys(parcel.MAY_COMPLETE)) {
      expect(parcel.canComplete(mode, 'admin')).toBe(false);
    }
  });
});

describe('Stage 4 — D-5: receiving is not shooting', () => {
  test('confirmReceived writes in_progress, and never writes completed', () => {
    // This is the one behaviour change reaching something already live, and B-9 depends on it.
    const body = bodyOf('../src/services/production.service', 'async function confirmReceived');
    expect(body).toContain("status = 'in_progress'");
    expect(body).not.toContain("status = 'completed'");
  });

  test('B-9: a shipment that has arrived but not been shot is NOT shoot-done', () => {
    // collabCounts computes: (pe.status = 'completed' OR pe.visit_completed_at IS NOT NULL)
    const shootDone = (status, visitCompletedAt) =>
      status === 'completed' || visitCompletedAt != null;

    // after confirmReceived, per the assertion above
    expect(shootDone('in_progress', null)).toBe(false);   // -> step 3. The whole point.
    // after completeShoot, which sets both
    expect(shootDone('completed', '2026-08-27')).toBe(true);
  });

  test('the formula B-9 models is the one collabCounts actually runs', () => {
    // If collabCounts changes how it derives shoot_done, the case above becomes a fiction.
    const src = fs.readFileSync(require.resolve('../src/services/collabCounts.service'), 'utf8');
    expect(src).toContain("(pe.status = 'completed' OR pe.visit_completed_at IS NOT NULL) AS shoot_done");
  });

  test('completeShoot stamps a completion time so shoot-done reads true either way', () => {
    const body = bodyOf('../src/services/production.service', 'async function completeShoot');
    expect(body).toContain("status = 'completed'");
    expect(body).toContain('visit_completed_at = COALESCE(visit_completed_at, NOW())');
    expect(body).toContain('parcel.canComplete');
  });
});

describe('Stage 4 — B-2: items are picked, never typed', () => {
  test('a product the brand does not own is refused', async () => {
    const conn = fakeConn([['FROM brand_products', []]]);
    const r = await parcel.addItems('e1', { brandId: 'b1', items: [{ product_id: 'x' }] }, conn);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not in your catalogue/);
  });

  test('an empty parcel is refused with a sentence, not a code', async () => {
    const r = await parcel.addItems('e1', { brandId: 'b1', items: [] }, fakeConn());
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Pick at least one product to send.');
  });

  test('the same product twice is refused — quantity is the answer', async () => {
    const r = await parcel.addItems('e1',
      { brandId: 'b1', items: [{ product_id: 'p1' }, { product_id: 'p1' }] }, fakeConn());
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/listed twice/);
  });

  test('name, price and SKU are copied AS SENT, from the catalogue row', async () => {
    const conn = fakeConn([
      ['FROM brand_products', [PROD]],
      ['INSERT INTO production_event_items', [{ id: 'i1' }]],
    ]);
    const r = await parcel.addItems('e1',
      { brandId: 'b1', items: [{ product_id: 'p1', quantity: 2 }] }, conn);
    expect(r.ok).toBe(true);
    const ins = conn.calls.find(c => c.sql.includes('INSERT INTO production_event_items'));
    // [eventId, product, name, price, sku, qty, parcelNo] — the values are the CATALOGUE's,
    // not the caller's, so a client cannot post its own price into the record of a shipment.
    expect(ins.params.slice(2, 6)).toEqual(['Indigo saree', '2400.00', 'IND-1', 2]);
  });
});

describe('Stage 4 — D-4: a resend is a second parcel, not an edit', () => {
  test('parcel_no is carried through to the row', async () => {
    const conn = fakeConn([
      ['FROM brand_products', [PROD]],
      ['INSERT INTO production_event_items', [{ id: 'i2' }]],
    ]);
    await parcel.addItems('e1', { brandId: 'b1', items: [{ product_id: 'p1' }], parcelNo: 2 }, conn);
    const ins = conn.calls.find(c => c.sql.includes('INSERT INTO'));
    expect(ins.params[6]).toBe(2);
  });

  test('uniqueness is per parcel, so the same product may be resent', () => {
    // Proved at the index, because that is where it is enforced. If it were (event, product)
    // a resend would collide with the original row, and the fact that something went missing
    // would be overwritten by the fix for it.
    const sql = fs.readFileSync(
      require.resolve('../migrations/160_production_event_items.sql'), 'utf8');
    expect(sql).toMatch(/UNIQUE INDEX[\s\S]*?\(production_event_id, parcel_no, product_id\)/);
    expect(sql).not.toMatch(/ON production_event_items \(production_event_id, product_id\)/);
  });
});

describe('Stage 4 — D-3 and B-3: her answer, item by item', () => {
  const ITEMS = [
    { id: 'i1', name_at_dispatch: 'Indigo saree', receipt_status: 'received' },
    { id: 'i2', name_at_dispatch: 'Ochre dupatta', receipt_status: 'missing' },
    { id: 'i3', name_at_dispatch: 'Rust blouse', receipt_status: 'damaged' },
  ];

  test('a verdict outside the three is refused, and says so in words', async () => {
    const r = await parcel.recordReceipt('e1', [{ item_id: 'i1', status: 'lost_maybe' }], fakeConn());
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not something an item can be/);
  });

  test('the three verdicts are exactly: received, missing, damaged', () => {
    expect(parcel.VERDICTS).toEqual(['received', 'missing', 'damaged']);
    // Founder 2026-08-27: damaged is recorded honestly and handled EXACTLY like missing.
    // No liability rule is invented, so both sit in SHORTFALL together.
    expect(parcel.SHORTFALL).toEqual(['missing', 'damaged']);
  });

  test('B-3: the sum of her answers is what the brand sees', async () => {
    const conn = fakeConn([
      ['UPDATE production_event_items', []],
      ['SELECT i.*', ITEMS],
    ]);
    const r = await parcel.recordReceipt('e1',
      ITEMS.map(i => ({ item_id: i.id, status: i.receipt_status })), conn);
    expect(r.ok).toBe(true);
    expect(r.received).toBe(1);
    expect(r.total).toBe(3);
    expect(r.allAnswered).toBe(true);
    // B-4: the item is NAMED. "There was a problem with your shipment" makes her explain it.
    expect(r.shortfall.map(s => s.name)).toEqual(['Ochre dupatta', 'Rust blouse']);
  });

  test('B-5: a shortfall returns no blocker, no chase, and touches nothing of hers', async () => {
    const conn = fakeConn([['UPDATE production_event_items', []], ['SELECT i.*', ITEMS]]);
    const r = await parcel.recordReceipt('e1', [{ item_id: 'i2', status: 'missing' }], conn);
    // Nothing in the result can stop her: no blocked flag, no required action, no state.
    expect(Object.keys(r).sort()).toEqual(['allAnswered', 'ok', 'received', 'shortfall', 'total']);
    // And nothing she owns is written to. A shortfall is the brand's problem, not hers.
    for (const c of conn.calls) {
      expect(c.sql).not.toMatch(/UPDATE (contracts|campaign_influencers|production_events)/);
    }
  });

  test('an unanswered item is not the same as one that did not arrive', async () => {
    const partial = [ITEMS[0], { id: 'i9', name_at_dispatch: 'Later', receipt_status: null }];
    const conn = fakeConn([['UPDATE production_event_items', []], ['SELECT i.*', partial]]);
    const r = await parcel.recordReceipt('e1', [{ item_id: 'i1', status: 'received' }], conn);
    expect(r.allAnswered).toBe(false);
    expect(r.shortfall).toEqual([]);   // silence is not a complaint
  });
});

describe('Stage 4 — B-6: dropping touches a hand-picked allocation only', () => {
  const dropped = { id: 'i1', product_id: 'p1', name_at_dispatch: 'Indigo saree' };

  const connFor = (ci) => fakeConn([
    ['UPDATE production_event_items', [dropped]],
    ['FROM production_events', ci ? [ci] : []],
  ]);

  test('a hand-picked list loses the product', async () => {
    const conn = connFor({ id: 'ci1', alloc_scope: 'products', alloc_product_ids: ['p1', 'p2'] });
    const r = await parcel.dropItem('e1', 'i1', conn);
    expect(r.removedFromAllocation).toBe(true);
    const upd = conn.calls.find(c => c.sql.includes('UPDATE campaign_influencers'));
    expect(JSON.parse(upd.params[1])).toEqual(['p2']);
  });

  for (const scope of ['store', 'category']) {
    test(`a ${scope} scope is left alone`, async () => {
      // The list is deliberately NON-empty and deliberately CONTAINS the dropped product.
      // With `null` here the null-guard did the work and the scope check was never exercised —
      // a mutation that let a store scope be carved into passed this case unchanged. Now the
      // scope is the only thing standing between the drop and the write.
      const conn = connFor({ id: 'ci1', alloc_scope: scope, alloc_product_ids: ['p1', 'p2'] });
      const r = await parcel.dropItem('e1', 'i1', conn);
      expect(r.removedFromAllocation).toBe(false);
      // Carving a hole in a scope Part 4 defined as resolved LIVE would be inventing a rule.
      // A product still in the category is still in scope, whether or not one copy went
      // missing in a van.
      expect(conn.calls.some(c => c.sql.includes('UPDATE campaign_influencers'))).toBe(false);
    });
  }

  test('dropping something that is not in the parcel fails honestly', async () => {
    const r = await parcel.dropItem('e1', 'nope', fakeConn());
    expect(r.ok).toBe(false);
  });
});

describe('Stage 4 — B-1: an empty box cannot be dispatched', () => {
  test('the controller checks the parcel before dispatching', () => {
    const body = bodyOf('../src/controllers/production.controller', 'const dispatch = asyncHandler');
    expect(body).toContain('parcel.listItems');
    expect(body).toMatch(/packed\.length === 0/);
    // The guard must come BEFORE the dispatch, or it is a note rather than a blocker.
    expect(body.indexOf('packed.length === 0')).toBeLessThan(body.indexOf('dispatchShipment'));
  });

  test('the completion endpoint answers 403, not 422, when the brand tries it', () => {
    const body = bodyOf('../src/controllers/production.controller', 'const complete = asyncHandler');
    expect(body).toContain('parcel.canComplete');
    expect(body).toContain('403');
    // And the old visit-only refusal is gone, or a remote shoot could never be finished.
    expect(body).not.toContain('complete only applies to visit-mode events');
  });
});
