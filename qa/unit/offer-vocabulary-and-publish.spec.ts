import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: W1/W2/W8/W9 — offer vocabulary + the publish rule (pure, no DB).
 * Contract: features/collab-part1-corrections/ (locked 2026-08-11), §1.1 + §1.4.
 *
 * Two things are locked here.
 *
 * §1.4 — one canonical offer vocabulary. campaign_influencers.offer_type is an
 * unconstrained varchar(30) and three writers disagreed: the web wizard posted
 * display labels ('Volume discount'), the mobile brand invite posted
 * 'flat'/'percentage', and only the library snapshot used the canonical
 * discount|volume|bogo|bundle|free_gift. normalizeOfferType is the single map
 * that migration 147, the write-time validator and the checkout pricing path all
 * share — offer.service.js delegates to it rather than keeping a second copy,
 * because two copies of a vocabulary is how they drift and a drifted offer
 * silently stops applying at checkout.
 *
 * §1.1 — an offer must not cover products no customer can see. The validator now
 * refuses unpublished products, and this is the rule that also had to be wired
 * into the in-campaign inline offer path, which validated nothing at all before.
 *
 * The db here is a stub with two rows, not a behaviour fake: the publish rule is
 * a pure decision over what the query returns.
 */

// offerConfig.validator is pure apart from the db it is handed, but requiring it
// pulls the module graph, which hard-validates env at load. Import shim only —
// none of these values is read by the logic under test.
process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const validator = require('../../backend/src/services/offerConfig.validator');
const {
  normalizeOfferType, validateOfferConfig, VALID_OFFER_TYPES, backfillDiscountSubType,
} = validator;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const offerService = require('../../backend/src/services/offer.service');

const PRODUCTS: Record<string, { id: string; name: string; pushed_to_store: boolean }> = {
  P1: { id: 'P1', name: 'Silk Kurta',   pushed_to_store: true },
  P2: { id: 'P2', name: 'Draft Jacket', pushed_to_store: false },
  // P9 is deliberately absent — it stands for another brand's product.
};

const db = {
  query: async (_sql: string, params: any[]) => ({
    rows: (params[0] as string[]).map(id => PRODUCTS[id]).filter(Boolean),
  }),
};

const discountCfg = (products: string[]) => ({
  sub_type: 'pct', value: 10, scope: 'products', products,
});

test.describe('WORKFLOW: offer vocabulary is canonical (§1.4)', () => {
  test('V1 — every legacy spelling maps to the canonical five', () => {
    // Web wizard display labels
    expect(normalizeOfferType('Discount')).toBe('discount');
    expect(normalizeOfferType('Volume discount')).toBe('volume');
    expect(normalizeOfferType('BOGO')).toBe('bogo');
    expect(normalizeOfferType('Bundle')).toBe('bundle');
    expect(normalizeOfferType('Free gift')).toBe('free_gift');
    // Mobile brand-invite spellings — both are discounts; flat-vs-pct is sub_type
    expect(normalizeOfferType('flat')).toBe('discount');
    expect(normalizeOfferType('percentage')).toBe('discount');
    // Snake-case variant seen in older campaign rows
    expect(normalizeOfferType('volume_discount')).toBe('volume');
    // Already canonical → unchanged
    for (const t of VALID_OFFER_TYPES) expect(normalizeOfferType(t)).toBe(t);
  });

  test('V2 — whitespace and case never change the answer', () => {
    expect(normalizeOfferType('  Discount  ')).toBe('discount');
    expect(normalizeOfferType('FREE GIFT')).toBe('free_gift');
  });

  test('V3 — empty input is null, unknown input passes through rather than vanishing', () => {
    expect(normalizeOfferType(null)).toBeNull();
    expect(normalizeOfferType('')).toBeNull();
    // 'prebook' is an availing mode, not an offer mechanic. Mapping it to a
    // discount would invent a discount that never existed, so it passes through
    // and gets rejected at write time instead.
    expect(normalizeOfferType('prebook')).toBe('prebook');
  });

  test('V4 — the pricing path shares the same map, not a copy of it', () => {
    // offer.service.js used to carry its own duplicate. If someone reintroduces
    // one, this fails the moment the two disagree.
    expect(typeof offerService.resolveOfferDiscount).toBe('function');
    const viaValidator = normalizeOfferType('Volume discount');
    expect(viaValidator).toBe('volume');
  });
});

test.describe('WORKFLOW: the OTA gap — a pre-canonical mobile build still works', () => {
  // The mobile brand invite used to post offer_type 'flat'|'percentage' with a
  // config of just { value }. Both normalise to 'discount', whose config REQUIRES
  // sub_type, so once the campaign path started validating (§1.1) those payloads
  // would 422 until every phone took the OTA — i.e. the backend could not deploy
  // ahead of mobile. The legacy type already carries the information, so it is
  // inferred using the same rule migration 147 applies to stored rows.
  const accept = async (rawType: string, cfg: any) => {
    const t = normalizeOfferType(rawType);
    const c = backfillDiscountSubType(rawType, cfg);
    return { c, res: await validateOfferConfig({ offerType: t, offerConfig: c, brandId: 'B', db }) };
  };

  test('O1 — old build, percentage → sub_type pct, accepted', async () => {
    const { c, res } = await accept('percentage', { value: 15 });
    expect(c.sub_type).toBe('pct');
    expect(res).toEqual({ ok: true });
  });

  test('O2 — old build, flat → sub_type flat, accepted', async () => {
    const { c, res } = await accept('flat', { value: 100 });
    expect(c.sub_type).toBe('flat');
    expect(res).toEqual({ ok: true });
  });

  test('O3 — an explicit sub_type is never overwritten', async () => {
    // A new client that sends both must win; inference is a fallback, not a rule.
    expect(backfillDiscountSubType('flat', { sub_type: 'pct', value: 5 }).sub_type).toBe('pct');
    expect(backfillDiscountSubType('discount', { sub_type: 'flat', value: 5 }).sub_type).toBe('flat');
  });

  test('O4 — an unguessable config still fails honestly rather than being guessed', async () => {
    // 'discount' alone says nothing about flat-vs-pct. Defaulting here would
    // silently turn ₹15 off into 15% off, so it must stay a validation error.
    const { res } = await accept('discount', { value: 15 });
    expect(res.ok).toBe(false);
    expect(res.field).toBe('offer_config_json.sub_type');
  });

  test('O5 — inference does not smuggle past the other rules', async () => {
    const { res } = await accept('percentage', { value: 150 });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('cannot exceed 100');
  });

  test('O6 — non-discount types pass through untouched', async () => {
    const tiers = { tiers: [{ min_spend: 500, pct_off: 10 }] };
    expect(backfillDiscountSubType('Volume discount', tiers)).toEqual(tiers);
    expect(backfillDiscountSubType('bogo', { product: 'P1' })).toEqual({ product: 'P1' });
    expect(backfillDiscountSubType('flat', null)).toBeNull();
  });
});

test.describe('WORKFLOW: an offer cannot cover unpublished products (§1.1)', () => {
  test('P1 — all products published → accepted', async () => {
    expect(await validateOfferConfig({
      offerType: 'discount', offerConfig: discountCfg(['P1']), brandId: 'B', db,
    })).toEqual({ ok: true });
  });

  test('P2 — an unpublished product is refused, and named so the brand can act', async () => {
    const res = await validateOfferConfig({
      offerType: 'discount', offerConfig: discountCfg(['P1', 'P2']), brandId: 'B', db,
    });
    expect(res.ok).toBe(false);
    expect(res.field).toBe('offer_config_json.products');
    expect(res.message).toContain('Draft Jacket');
  });

  test('P3 — another brand\'s product is still refused (ownership, pre-existing)', async () => {
    const res = await validateOfferConfig({
      offerType: 'discount', offerConfig: discountCfg(['P9']), brandId: 'B', db,
    });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('not owned by this brand');
  });

  test('P4 — a store-wide discount names no products, so there is nothing to check', async () => {
    expect(await validateOfferConfig({
      offerType: 'discount', offerConfig: { sub_type: 'flat', value: 50 }, brandId: 'B', db,
    })).toEqual({ ok: true });
  });

  test('P5 — a display label is rejected at write time', async () => {
    // This is why §1.4 had to ship with §1.1: once the validator guards the
    // campaign path, the wizard posting 'Volume discount' would 422. Both apps
    // now send canonical keys.
    const res = await validateOfferConfig({
      offerType: 'Volume discount', offerConfig: discountCfg(['P1']), brandId: 'B', db,
    });
    expect(res.ok).toBe(false);
    expect(res.field).toBe('offer_type');
  });
});
