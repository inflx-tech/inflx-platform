import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: cart-shaped offer badges + storefront expiry — the last two pieces of
 * Part 4's display side.
 * Contract: features/collab-part4-offers-allocation (§4.3, §4.4).
 *
 * BADGES. A volume threshold, a bundle or a BOGO cannot be shown as "% off" on one
 * product — there is no cart to measure against or to assemble the set from — so they
 * surface as an availability badge and the real value is computed at checkout by
 * offerResolution. Before this they did not appear on a card at all.
 *
 * These need their OWN applicability test. OFFER_APPLIES models the DISCOUNT scope
 * (store / category / products array), and a BOGO or free-gift keeps its products under
 * different keys — so the effective scope would find no products array, fall back to
 * 'store', and badge the offer across the entire catalogue.
 *
 * EXPIRY. Checkout already refuses an expired offer (§4.4). Without the display half,
 * the storefront kept advertising it, so a follower would see a discount that silently
 * vanished at payment — the same advertise-vs-charge mismatch §4.3 fixed in the other
 * direction.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const display = require('../../backend/src/services/offerDisplay.sql');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const followerSrc: string = fs.readFileSync(
  path.join(__dirname, '../../backend/src/services/follower.service.js'), 'utf8');

test.describe('WORKFLOW: cart-shaped offers surface as badges (§4.3)', () => {
  test('B1 — kinds map to stable, ordered labels', () => {
    expect(display.cartOfferBadges(['bogo', 'bundle'])).toEqual(['Bundle deal', 'Buy 1 get 1']);
    // Order is fixed by intent, not by whatever the array_agg returned.
    expect(display.cartOfferBadges(['volume', 'bundle'])).toEqual(['Bundle deal', 'Volume deal']);
    expect(display.cartOfferBadges(['free_gift'])).toEqual(['Free gift']);
  });

  test('B2 — no offers means no badges, and nothing is invented', () => {
    expect(display.cartOfferBadges(null)).toEqual([]);
    expect(display.cartOfferBadges([])).toEqual([]);
    expect(display.cartOfferBadges(undefined)).toEqual([]);
  });

  test('B3 — an unknown kind is dropped rather than shown raw', () => {
    // A badge reading "prebook" to a shopper is worse than no badge.
    expect(display.cartOfferBadges(['prebook'])).toEqual([]);
    expect(display.cartOfferBadges(['prebook', 'bundle'])).toEqual(['Bundle deal']);
  });

  test('B4 — simple discounts are excluded: they are a price, not a badge', () => {
    expect(display.OFFER_CART_KINDS).toContain("bo.offer_type <> 'discount'");
    expect(display.OFFER_BEST_PCT).toContain("bo.offer_type = 'discount'");
  });

  test('B5 — each cart shape is matched on its OWN product keys', () => {
    const a = display.OFFER_CART_APPLIES;
    // bundle → products array
    expect(a).toContain("bo.offer_type = 'bundle'");
    // bogo → buy/get, plus the newer same-product shape
    expect(a).toContain("bo.offer_config_json->'buy_product'->>'id'");
    expect(a).toContain("bo.offer_config_json->'get_product'->>'id'");
    expect(a).toContain("bo.offer_config_json->'product'->>'id'");
    // free_gift → main/gift inside each pair
    expect(a).toContain("o->'main'->>'id'");
    expect(a).toContain("o->'gift'->>'id'");
    // volume is the only shape that reuses the discount scope model
    expect(a).toContain("bo.offer_type = 'volume' AND (");
  });

  test('B6 — a BOGO is not badged across the whole catalogue', () => {
    // The trap: BOGO keeps its products under buy_product/get_product, so the discount
    // scope model finds no products array, defaults to 'store', and would badge every
    // product in the brand. The bogo branch must be product-specific and must NOT be
    // reachable through the store-scope leg.
    const a = display.OFFER_CART_APPLIES;
    const bogoBranch = a.slice(a.indexOf("bo.offer_type = 'bogo'"), a.indexOf("free_gift"));
    expect(bogoBranch).not.toContain("= 'store'");
    expect(bogoBranch).toContain('bp.id::text');
  });

  test('B7 — badges reach the payload, not just the query', () => {
    // The lesson from earlier in this contract: computing a value is not delivering it.
    const computed = followerSrc.split('cartOfferBadges(cart_offer_kinds)').length - 1;
    const passedThrough = followerSrc.split('cart_offer_badges: p.cart_offer_badges || []').length - 1;
    expect(computed).toBe(2);                       // both creator-storefront queries
    expect(passedThrough).toBe(computed);
    expect(followerSrc).toContain('${OFFER_CART_KINDS} AS cart_offer_kinds');
  });
});

test.describe('WORKFLOW: an expired offer stops being advertised (§4.4)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const svc = require('../../backend/src/services/follower.service');

  test('E1 — the storefront blanks an expired offer', () => {
    // offerDisplayFields is internal; assert through the source that every payload uses
    // it, and through offerResolution's twin for the behaviour itself.
    expect(followerSrc).toContain('function offerDisplayFields(r)');
    expect(followerSrc).toContain('offer_expired:  expired');
    // All seven payloads — every surface that can advertise an offer.
    expect(followerSrc.split('...offerDisplayFields(r),').length - 1).toBe(7);
  });

  test('E2 — no payload still passes the raw offer fields through', () => {
    // A leftover raw pair would advertise an expired offer on that surface only —
    // exactly the kind of partial fix that hides in a big change.
    expect(followerSrc).not.toContain('offer_type: r.offer_type,\n      discount_value: r.discount_value,');
    expect(followerSrc).not.toContain('discount_value: r.discount_value,');
  });

  test('E3 — expiry keys off offer_valid_until, never the invitation clock', () => {
    expect(followerSrc).toContain('r.offer_valid_until');
    expect(followerSrc).not.toContain('r.offer_expires_at');
    // Both queries must actually select it, or the check silently never fires.
    expect(followerSrc.split('ci.offer_valid_until,').length - 1).toBe(2);
  });

  test('E4 — the same rule is used at checkout, so the two agree', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resolution = require('../../backend/src/services/offerResolution.service');
    expect(resolution.creatorOfferExpired({ offer_valid_until: '2020-01-01T00:00:00Z' })).toBe(true);
    expect(resolution.creatorOfferExpired({ offer_valid_until: '2099-01-01T00:00:00Z' })).toBe(false);
    expect(typeof svc.resolveStore).toBe('function');
  });
});
