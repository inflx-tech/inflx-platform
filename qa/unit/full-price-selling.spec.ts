import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: W7, W16 — a creator can sell at full price, and an offer can expire
 * without ending the collaboration.
 * Contract: features/collab-part4-offers-allocation (§4.2, §4.4).
 *
 * §4.2 — six SQL predicates and one guard required an OFFER to exist before a
 * creator could be discovered, render a storefront, have their code accepted, or
 * have a sale RECORDED. The last one (validateTracking, the money path) meant a
 * commission-only sale could not be written at all. They are widened to accept an
 * allocation, not removed: a creator with neither an allocation nor an offer stays
 * hidden, because there is nothing they are entitled to sell (W8).
 *
 * These are the gates as SQL text. Asserting the predicate is deliberate — the
 * behaviour IS the predicate, and a future edit that drops the allocation leg would
 * silently re-hide every full-price creator with no test failing anywhere else.
 *
 * §4.4 — the pricing engine's own answer for "no offer" is asserted, since that is
 * what an expired or absent offer collapses to.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const offerService = require('../../backend/src/services/offer.service');

const src = (rel: string) =>
  fs.readFileSync(path.join(__dirname, '../../backend/src', rel), 'utf8');

const ALLOC_LEG = 'ci.alloc_scope IS NOT NULL';

test.describe('WORKFLOW: full-price selling is reachable (§4.2)', () => {
  test('G1 — the creator storefront and feed gates accept an allocation', () => {
    const s = src('services/follower.service.js');
    const gates = s.split('\n').filter(l => l.includes('OR co.id IS NOT NULL OR ci.offer_type IS NOT NULL'));
    // ACTIVE_CI_QUERY + FEED_QUERY
    expect(gates).toHaveLength(2);
    for (const g of gates) expect(g).toContain(ALLOC_LEG);
  });

  test('G2 — the money path accepts an allocation', () => {
    // validateTracking. Before this, a commission-only sale returned no row and the
    // caller threw OFFER_UNAVAILABLE — the sale could not be recorded at all.
    const s = src('services/transaction.service.js');
    expect(s).toContain(ALLOC_LEG);
    const gate = s.split('\n').find(l => l.includes('OR co.id IS NOT NULL OR ci.offer_type IS NOT NULL'));
    expect(gate).toBeTruthy();
    expect(gate).toContain(ALLOC_LEG);
  });

  test('G3 — both follower discovery gates accept an allocation', () => {
    const s = src('controllers/follower.controller.js');
    const gates = s.split('\n').filter(l => l.includes('OR ci.offer_type IS NOT NULL)') && l.includes('alloc_scope'));
    expect(gates.length).toBeGreaterThanOrEqual(2);
  });

  test('G4 — a coupon is shoppable on an allocation alone', () => {
    const s = src('controllers/follower.controller.js');
    // The guard must consider the allocation before refusing the code.
    expect(s).toContain("if (!r.alloc_scope && !r.offer_type && !r.offer_id)");
  });

  test('G5 — the offers feed is deliberately NOT widened', () => {
    // fetchAssignmentOffers exists to surface assignments CARRYING an offer. A
    // full-price creator has no offer to list there, and widening it would put
    // offer-less rows into an offers feed. Pinned so it is not "fixed" later by
    // pattern-matching the other five.
    const s = src('services/brandOffers.adapter.js');
    const gate = s.split('\n').find(l => l.trim() === 'AND ci.offer_type IS NOT NULL');
    expect(gate).toBeTruthy();
    expect(s).toContain('deliberately NOT widened');
  });
});

test.describe('WORKFLOW: no offer means full price (§4.2, §4.4)', () => {
  test('F1 — a sale with no offer prices at full price with an honest reason', () => {
    const res = offerService.resolveOfferDiscount({
      offerType: null,
      offerConfig: null,
      items: [{ product_id: 'P1', quantity: 1 }],
      priceMap: new Map([['P1', 1500]]),
    });
    expect(res.discount_amount).toBe(0);
    // Used to read "Unknown offer type: null" — that was correct when the case was
    // unreachable and could only mean corruption. It is now a normal path.
    expect(res.reason).toBe('No offer — full price');
  });

  test('F2 — a pay-at-store bill with no offer is undiscounted', () => {
    const res = offerService.resolveOfferDiscount({
      offerType: null, offerConfig: null, items: [], priceMap: new Map(), billAmount: 1500,
    });
    expect(res.discount_amount).toBe(0);
    expect(res.reason).toBe('No offer — full price');
  });

  test('F3 — a genuinely unknown offer type still reports as unknown', () => {
    // The two cases must stay distinguishable: "no offer" is expected, an
    // unrecognised type is a data fault and should not be dressed up as normal.
    const res = offerService.resolveOfferDiscount({
      offerType: 'mystery_mechanic', offerConfig: {}, items: [], priceMap: new Map(), billAmount: 100,
    });
    expect(res.discount_amount).toBe(0);
    expect(res.reason).toContain('Unknown offer type');
  });

  test('F4 — an expired offer collapses to the same full-price answer', () => {
    // computeOfferDiscount nulls the offer past offer_valid_until, so the engine
    // sees exactly the F1 input. Asserting the collapse target keeps the two in step.
    const asIfExpired = offerService.resolveOfferDiscount({
      offerType: null, offerConfig: null,
      items: [{ product_id: 'P1', quantity: 1 }], priceMap: new Map([['P1', 4000]]),
    });
    expect(asIfExpired).toEqual({
      discount_amount: 0, applied_to: 'cart_total', reason: 'No offer — full price',
    });
  });

  test('F5 — the money path delegates offer choice, and expiry keys off the right column', () => {
    // This test originally asserted that transaction.controller referenced
    // trackingRecord.offer_valid_until directly. §4.3 then moved offer selection —
    // including the expiry check — into offerResolution.service, so that assertion
    // broke on a refactor while the behaviour was intact. Rewritten to pin the
    // invariant rather than the location: the money path must not choose an offer
    // itself, and whoever does must key expiry off offer_valid_until.
    //
    // offer_expires_at is the INVITATION-acceptance clock driven by offer-expiry.job;
    // using it as a discount deadline would silently expire invitations.
    const ctrl = src('controllers/transaction.controller.js');
    expect(ctrl).toContain('offerResolution.resolveBestOffer');

    const res = src('services/offerResolution.service.js');
    expect(res).toContain('offer_valid_until');
    // Only ever mentioned to warn against it, never read as a deadline.
    expect(res).not.toContain('ci.offer_expires_at');
  });
});
