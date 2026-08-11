import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: W9–W15 — global offers reach creators; the best single offer wins.
 * Contract: features/collab-part4-offers-allocation (§4.3, §4.4).
 *
 * Global published offers never reached a creator before this: the creator path
 * consulted only the per-creator assignment, so a brand had to attach an offer to
 * every creator one at a time. Now published engine offers apply to any creator
 * holding those products, and a creator-specific offer can single one creator out.
 *
 * Resolution is best-single-offer against the WHOLE cart — never combined, never
 * stacked. The cases below include the founder's own worked examples, and the one
 * the discarded per-product design got wrong (W11/W12).
 *
 * db.query is intercepted to supply the brand's live global offers. The discount
 * maths is the real, untouched offer.service engine.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../../backend/src/config/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const resolution = require('../../backend/src/services/offerResolution.service');

const JACKET = 'P-JACKET';
const KURTA  = 'P-KURTA';
const DUPATTA = 'P-DUPATTA';
const LEGGINGS = 'P-LEGGINGS';

const priceMap = new Map<string, number>([
  [JACKET, 4000], [KURTA, 1400], [DUPATTA, 1200], [LEGGINGS, 1600],
]);

/** Feed the resolver a set of live global offers. */
function withGlobals(globals: any[]) {
  const original = db.query;
  const calls: any[] = [];
  db.query = async (sql: string, params: any[]) => {
    calls.push({ sql, params });
    return { rows: globals };
  };
  return { calls, restore: () => { db.query = original; } };
}

const cart = (ids: string[]) => ids.map(id => ({ product_id: id, quantity: 1 }));

test.describe('WORKFLOW: global offers reach creators (§4.3)', () => {
  test('R1 — W9: a global offer applies with nothing assigned to the creator', async () => {
    const i = withGlobals([
      { id: 'G1', name: '10% off everything', offer_type: 'discount',
        offer_config_json: { sub_type: 'pct', value: 10, scope: 'store' } },
    ]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: { offer_type: null, offer_config_json: null },
        brandId: 'B1', items: cart([KURTA]), priceMap,
      });
      expect(res.discount_amount).toBe(140);          // 10% of 1400
      expect(res.offer_source).toBe('global');
      expect(res.offer_id).toBe('G1');
    } finally { i.restore(); }
  });

  test('R2 — only PUBLISHED and live offers are candidates (W14, §5.1)', async () => {
    const i = withGlobals([]);
    try {
      await resolution.resolveBestOffer({
        ci: { offer_type: null }, brandId: 'B1', items: cart([KURTA]), priceMap,
      });
      const sql = i.calls[0].sql;
      expect(sql).toContain('published_to_store = true');
      expect(sql).toContain("status = 'active'");
      expect(sql).toContain('store_starts_at');
      expect(sql).toContain('store_ends_at');
    } finally { i.restore(); }
  });

  test('R3 — W10: creator-specific beats global, and only one applies', async () => {
    // Founder's example: global 10% everything vs creator 20% off jackets.
    // Cart = jacket 4000 + kurta 1400. Global scores 540, creator scores 800.
    const i = withGlobals([
      { id: 'G1', name: '10% off everything', offer_type: 'discount',
        offer_config_json: { sub_type: 'pct', value: 10, scope: 'store' } },
    ]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: {
          offer_type: 'discount',
          offer_config_json: { sub_type: 'pct', value: 20, scope: 'products', products: [JACKET] },
        },
        brandId: 'B1', items: cart([JACKET, KURTA]), priceMap,
      });
      expect(res.discount_amount).toBe(800);          // 20% of 4000 only
      expect(res.offer_source).toBe('creator');
      // NOT 800 + 140 — nothing stacks.
      expect(res.discount_amount).not.toBe(940);
    } finally { i.restore(); }
  });

  test('R4 — W13: two global offers do not stack; the better one wins', async () => {
    const i = withGlobals([
      { id: 'G1', name: '15% off everything', offer_type: 'discount',
        offer_config_json: { sub_type: 'pct', value: 15, scope: 'store' } },
      { id: 'G2', name: '30% off jackets', offer_type: 'discount',
        offer_config_json: { sub_type: 'pct', value: 30, scope: 'products', products: [JACKET] } },
    ]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: { offer_type: null }, brandId: 'B1', items: cart([JACKET]), priceMap,
      });
      expect(res.discount_amount).toBe(1200);         // 30% of 4000, not 45%
      expect(res.offer_id).toBe('G2');
    } finally { i.restore(); }
  });

  test('R5 — W11/W12: a creator-specific offer never breaks a better global bundle', async () => {
    // The case the discarded per-product design got wrong: splitting the cart pulled
    // the kurta into the creator's group, leaving the bundle a leg short and the
    // customer Rs 851 WORSE OFF because the creator had a special offer.
    const i = withGlobals([
      { id: 'G-BUNDLE', name: '3-piece set', offer_type: 'bundle',
        offer_config_json: { products: [KURTA, DUPATTA, LEGGINGS], bundle_price: 2999 } },
    ]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: {
          offer_type: 'discount',
          offer_config_json: { sub_type: 'pct', value: 25, scope: 'products', products: [KURTA] },
        },
        brandId: 'B1', items: cart([KURTA, DUPATTA, LEGGINGS]), priceMap,
      });
      // Bundle: 4200 - 2999 = 1201. Creator's 25% of the kurta = 350.
      expect(res.discount_amount).toBe(1201);
      expect(res.offer_source).toBe('global');
      // The customer is never worse off for the creator having an offer.
      expect(res.discount_amount).toBeGreaterThan(350);
    } finally { i.restore(); }
  });

  test('R6 — a cart that qualifies for nothing says so, and charges full price', async () => {
    const i = withGlobals([
      { id: 'G1', name: 'Spend 10000 get 10%', offer_type: 'volume',
        offer_config_json: { tiers: [{ min_spend: 10000, pct_off: 10 }], scope: 'store' } },
    ]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: { offer_type: null }, brandId: 'B1', items: cart([KURTA]), priceMap,
      });
      expect(res.discount_amount).toBe(0);
      expect(res.offer_source).toBeNull();
    } finally { i.restore(); }
  });

  test('R7 — no candidates at all is full price', async () => {
    const i = withGlobals([]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: { offer_type: null }, brandId: 'B1', items: cart([KURTA]), priceMap,
      });
      expect(res).toMatchObject({
        discount_amount: 0, reason: 'No offer — full price', offer_source: null,
      });
    } finally { i.restore(); }
  });

  test('R8 — a tie goes to the creator-specific offer', async () => {
    // Equal money, but the brand chose this one for this creator, so it is the
    // honest thing to name on a receipt.
    const same = { sub_type: 'pct', value: 10, scope: 'store' };
    const i = withGlobals([
      { id: 'G1', name: '10% off', offer_type: 'discount', offer_config_json: same },
    ]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: { offer_type: 'discount', offer_config_json: same },
        brandId: 'B1', items: cart([KURTA]), priceMap,
      });
      expect(res.discount_amount).toBe(140);
      expect(res.offer_source).toBe('creator');
    } finally { i.restore(); }
  });
});

test.describe('WORKFLOW: offer expiry (§4.4)', () => {
  test('E1 — W16: an expired creator offer drops out; a global one can still apply', async () => {
    const i = withGlobals([
      { id: 'G1', name: '10% off everything', offer_type: 'discount',
        offer_config_json: { sub_type: 'pct', value: 10, scope: 'store' } },
    ]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: {
          offer_type: 'discount',
          offer_config_json: { sub_type: 'pct', value: 50, scope: 'store' },
          offer_valid_until: '2020-01-01T00:00:00Z',      // long past
        },
        brandId: 'B1', items: cart([KURTA]), priceMap,
      });
      // The 50% creator offer is gone; the 10% global remains.
      expect(res.discount_amount).toBe(140);
      expect(res.offer_source).toBe('global');
    } finally { i.restore(); }
  });

  test('E2 — an unexpired creator offer still applies', async () => {
    const i = withGlobals([]);
    try {
      const res = await resolution.resolveBestOffer({
        ci: {
          offer_type: 'discount',
          offer_config_json: { sub_type: 'pct', value: 50, scope: 'store' },
          offer_valid_until: '2099-01-01T00:00:00Z',
        },
        brandId: 'B1', items: cart([KURTA]), priceMap,
      });
      expect(res.discount_amount).toBe(700);
      expect(res.offer_source).toBe('creator');
    } finally { i.restore(); }
  });

  test('E3 — expiry reads offer_valid_until, never the invitation clock', () => {
    // offer_expires_at is the invitation-acceptance clock driven by offer-expiry.job.
    // Treating it as a discount deadline would silently expire invitations.
    expect(resolution.creatorOfferExpired({ offer_valid_until: '2020-01-01T00:00:00Z' })).toBe(true);
    expect(resolution.creatorOfferExpired({ offer_valid_until: '2099-01-01T00:00:00Z' })).toBe(false);
    expect(resolution.creatorOfferExpired({ offer_expires_at: '2020-01-01T00:00:00Z' })).toBe(false);
    expect(resolution.creatorOfferExpired({})).toBe(false);
  });
});
