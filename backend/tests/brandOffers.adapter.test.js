'use strict';

/**
 * QA — brandOffers.adapter PURE normalization (D0 Workstream B,
 * contract: features/listing-section-d0-seams).
 *
 * These tests cover the bug-prone, source-agnostic logic with NO database:
 * offer_type vocab bridging, discount extraction from offer_config_json per type,
 * the 4-ID attribution rules per channel, the feed-item shape, and channel dedup.
 *
 * The channel SQL fetchers are NOT exercised here — they require real brand_offers
 * rows and are validated at OR-time against prod data (see lock.json SANDBOX
 * CONSTRAINT). No-fake-green: we assert only what is deterministically provable
 * without a DB.
 */

const adapter = require('../src/services/brandOffers.adapter');

describe('mapBrandOfferType — vocab bridge (brand_offers → legacy display vocab)', () => {
  test('discount + pct → percentage', () => {
    expect(adapter.mapBrandOfferType('discount', { sub_type: 'pct', value: 20 })).toBe('percentage');
  });
  test('discount + flat → flat', () => {
    expect(adapter.mapBrandOfferType('discount', { sub_type: 'flat', value: 100 })).toBe('flat');
  });
  test('discount with no sub_type defaults to percentage', () => {
    expect(adapter.mapBrandOfferType('discount', {})).toBe('percentage');
  });
  test('volume/bogo/bundle/free_gift pass through unchanged', () => {
    expect(adapter.mapBrandOfferType('volume', {})).toBe('volume');
    expect(adapter.mapBrandOfferType('bogo', {})).toBe('bogo');
    expect(adapter.mapBrandOfferType('bundle', {})).toBe('bundle');
    expect(adapter.mapBrandOfferType('free_gift', {})).toBe('free_gift');
  });
});

describe('extractDiscount — headline number from offer_config_json', () => {
  test('pct discount → kind pct, numeric value, label', () => {
    const d = adapter.extractDiscount('discount', { sub_type: 'pct', value: 25 });
    expect(d).toEqual({ kind: 'pct', value: 25, label: '25% off' });
  });
  test('flat discount → kind flat, rupee label', () => {
    const d = adapter.extractDiscount('discount', { sub_type: 'flat', value: 150 });
    expect(d).toEqual({ kind: 'flat', value: 150, label: '₹150 off' });
  });
  test('volume → top tier pct_off is the headline', () => {
    const d = adapter.extractDiscount('volume', {
      tiers: [{ min_spend: 500, pct_off: 10 }, { min_spend: 1000, pct_off: 22 }, { min_spend: 800, pct_off: 15 }],
    });
    expect(d.kind).toBe('volume');
    expect(d.value).toBe(22);
    expect(d.label).toBe('Up to 22% off');
  });
  test('volume with no usable tiers → value null', () => {
    expect(adapter.extractDiscount('volume', { tiers: [] }).value).toBeNull();
    expect(adapter.extractDiscount('volume', {}).value).toBeNull();
  });
  test('bundle → bundle_price NOT counted as discount magnitude (value null)', () => {
    const d = adapter.extractDiscount('bundle', { bundle_price: 999 });
    expect(d.kind).toBe('bundle');
    expect(d.value).toBeNull();        // must not pollute biggest_discounts ordering
    expect(d.label).toBe('Bundle ₹999');
  });
  test('bogo and free_gift → no headline number', () => {
    expect(adapter.extractDiscount('bogo', {}).value).toBeNull();
    expect(adapter.extractDiscount('free_gift', {}).value).toBeNull();
  });
  test('garbage / missing config never throws', () => {
    expect(() => adapter.extractDiscount('discount', null)).not.toThrow();
    expect(() => adapter.extractDiscount('discount', undefined)).not.toThrow();
    expect(adapter.extractDiscount('discount', { sub_type: 'pct' }).value).toBeNull();
  });
});

describe('normalizeBrandOfferRow — channel attribution rules', () => {
  const baseRow = {
    id: 'bo-1',
    name: 'Aveen lunch combo',
    offer_type: 'discount',
    offer_config_json: { sub_type: 'pct', value: 30 },
    availing_modes: ['pay_at_store'],
    store_ends_at: null,
    brand_id: 'brand-1', brand_name: 'Aveen food paradise',
    brand_category: 'restaurant', brand_city: 'Vijayawada',
    // creator cols (present for conversion/engagement)
    influencer_id: 'inf-1', handle: 'sagartravel',
    influencer_name: 'Sagar', profile_pic_url: 'http://x/p.jpg',
    campaign_id: 'camp-1', set_id: 'set-1',
  };

  test('store channel → no creator, no tracking (iid null by design)', () => {
    const n = adapter.normalizeBrandOfferRow({ ...baseRow, influencer_id: null, handle: null }, 'store');
    expect(n.source).toBe('brand_offer');
    expect(n.channel).toBe('store');
    expect(n.via_creator).toBeNull();
    expect(n.tracking).toBeNull();
    expect(n.offer_type).toBe('percentage');
    expect(n.discount_value).toBe(30);
    expect(n.brand).toEqual({ id: 'brand-1', name: 'Aveen food paradise', category: 'restaurant', city: 'Vijayawada' });
  });

  test('conversion channel → creator shown AND full 4-ID tracking link', () => {
    const n = adapter.normalizeBrandOfferRow(baseRow, 'conversion');
    expect(n.via_creator).toEqual({ id: 'inf-1', handle: 'sagartravel', name: 'Sagar', avatar: 'http://x/p.jpg' });
    expect(n.tracking).not.toBeNull();
    expect(n.tracking.cid).toBe('camp-1');
    expect(n.tracking.sid).toBe('set-1');
    expect(n.tracking.oid).toBe('bo-1');   // oid = brand_offer id for brand-offer attribution
    expect(n.tracking.iid).toBe('inf-1');
    expect(n.tracking.url).toContain('/s/sagartravel');
  });

  test('engagement channel → creator shown but NO tracking (promotional/awareness)', () => {
    const n = adapter.normalizeBrandOfferRow(baseRow, 'engagement');
    expect(n.via_creator).not.toBeNull();          // creator is credited visually
    expect(n.via_creator.handle).toBe('sagartravel');
    expect(n.tracking).toBeNull();                 // but no commission/tracked link
  });
});

describe('normalizeCampaignOfferRow — legacy parity', () => {
  test('percentage offer with creator → tracked, mapped to pct discount', () => {
    const n = adapter.normalizeCampaignOfferRow({
      offer_id: 'co-1', offer_type: 'percentage', discount_value: '15.00',
      availing_modes: ['online_order'], prebook_advance: null,
      set_id: 'set-9', campaign_id: 'camp-9', end_date: null,
      influencer_id: 'inf-9', offer_expires_at: null,
      brand_id: 'b9', brand_name: 'B9', brand_category: 'restaurant', brand_city: 'Hyd',
      handle: 'rikitafashion', influencer_name: 'Rikita', profile_pic_url: null,
    });
    expect(n.source).toBe('campaign_offer');
    expect(n.channel).toBe('campaign');
    expect(n.discount).toEqual({ kind: 'pct', value: 15, label: '15% off' });
    expect(n.discount_value).toBe(15);
    expect(n.tracking.oid).toBe('co-1');           // legacy oid = campaign_offer id
    expect(n.tracking.iid).toBe('inf-9');
  });

  test('offer with no handle → no tracking, no via_creator', () => {
    const n = adapter.normalizeCampaignOfferRow({
      offer_id: 'co-2', offer_type: 'flat', discount_value: '50',
      brand_id: 'b1', brand_name: 'B1', handle: null,
    });
    expect(n.tracking).toBeNull();
    expect(n.via_creator).toBeNull();
    expect(n.discount).toEqual({ kind: 'flat', value: 50, label: '₹50 off' });
  });
});

describe('toFeedItem — shape compatible with sectionRules.mapOfferItem', () => {
  test('emits entity_type offer + the legacy-consumed keys', () => {
    const n = adapter.normalizeBrandOfferRow({
      id: 'bo-2', name: 'x', offer_type: 'discount',
      offer_config_json: { sub_type: 'flat', value: 99 },
      availing_modes: ['pay_at_store'], brand_id: 'b', brand_name: 'B',
      brand_category: 'restaurant', brand_city: 'C',
      influencer_id: null, handle: null,
    }, 'store');
    const item = adapter.toFeedItem(n);
    expect(item.entity_type).toBe('offer');
    expect(item).toHaveProperty('id', 'bo-2');
    expect(item).toHaveProperty('offer_type', 'flat');
    expect(item).toHaveProperty('discount_value', 99);
    expect(item).toHaveProperty('availing_modes');
    expect(item).toHaveProperty('brand');
    expect(item).toHaveProperty('via_creator', null);
    expect(item).toHaveProperty('tracking', null);
    expect(item.source).toBe('brand_offer');
    expect(item.channel).toBe('store');
  });
});

describe('dedupe — same offer via multiple channels collapses to highest priority', () => {
  test('conversion beats engagement beats store for the same brand_offer id', () => {
    const mk = (channel) => ({ id: 'bo-7', source: 'brand_offer', channel });
    const out = adapter.dedupe([mk('store'), mk('engagement'), mk('conversion')]);
    expect(out).toHaveLength(1);
    expect(out[0].channel).toBe('conversion');
  });
  test('distinct (source,id) rows are all kept', () => {
    const out = adapter.dedupe([
      { id: 'bo-1', source: 'brand_offer', channel: 'store' },
      { id: 'co-1', source: 'campaign_offer', channel: 'campaign' },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('offersV2Enabled — flag gating (default OFF)', () => {
  const prev = process.env.SECTION_ENGINE_OFFERS;
  afterEach(() => {
    if (prev === undefined) delete process.env.SECTION_ENGINE_OFFERS;
    else process.env.SECTION_ENGINE_OFFERS = prev;
  });
  test('off when env unset or not "true"', () => {
    delete process.env.SECTION_ENGINE_OFFERS;
    expect(adapter.offersV2Enabled()).toBe(false);
    process.env.SECTION_ENGINE_OFFERS = 'false';
    expect(adapter.offersV2Enabled()).toBe(false);
    process.env.SECTION_ENGINE_OFFERS = '1';
    expect(adapter.offersV2Enabled()).toBe(false);
  });
  test('on only for exact "true"', () => {
    process.env.SECTION_ENGINE_OFFERS = 'true';
    expect(adapter.offersV2Enabled()).toBe(true);
  });
});
