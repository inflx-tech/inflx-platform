'use strict';

/**
 * QA — brandOffers.adapter PURE normalization (D0 Workstream B,
 * contract: features/listing-section-d0-seams). REBUILT 2026-06-09 after code review:
 * the primary offer source is the creator ASSIGNMENT (campaign_influencers snapshot),
 * classified by ci.allocation — NOT the Offer-Zone library. Library/store-direct add
 * showcase + store deals on top.
 *
 * No DB: these cover the bug-prone source-agnostic logic only. Channel SQL is
 * validated at OR-time against real prod data (see lock.json).
 */

const adapter = require('../src/services/brandOffers.adapter');

describe('mapBrandOfferType — library vocab → legacy display vocab', () => {
  test('discount pct/flat, volume/bogo/bundle/free_gift', () => {
    expect(adapter.mapBrandOfferType('discount', { sub_type: 'pct' })).toBe('percentage');
    expect(adapter.mapBrandOfferType('discount', { sub_type: 'flat' })).toBe('flat');
    expect(adapter.mapBrandOfferType('discount', {})).toBe('percentage');
    expect(adapter.mapBrandOfferType('volume', {})).toBe('volume');
    expect(adapter.mapBrandOfferType('free_gift', {})).toBe('free_gift');
  });
});

describe('extractDiscount — LIBRARY-vocab headline number', () => {
  test('pct / flat', () => {
    expect(adapter.extractDiscount('discount', { sub_type: 'pct', value: 25 })).toEqual({ kind: 'pct', value: 25, label: '25% off' });
    expect(adapter.extractDiscount('discount', { sub_type: 'flat', value: 150 })).toEqual({ kind: 'flat', value: 150, label: '₹150 off' });
  });
  test('volume = top tier; bundle_price never a discount magnitude', () => {
    expect(adapter.extractDiscount('volume', { tiers: [{ pct_off: 10 }, { pct_off: 22 }] }).value).toBe(22);
    expect(adapter.extractDiscount('bundle', { bundle_price: 999 }).value).toBeNull();
  });
  test('bogo/free_gift no headline; garbage never throws', () => {
    expect(adapter.extractDiscount('bogo', {}).value).toBeNull();
    expect(() => adapter.extractDiscount('discount', null)).not.toThrow();
  });
});

describe('extractLegacyDiscount — inline-vocab headline number', () => {
  test('percentage/flat read offer_config_json.value', () => {
    expect(adapter.extractLegacyDiscount('percentage', { value: 20 }, null)).toEqual({ kind: 'pct', value: 20, label: '20% off' });
    expect(adapter.extractLegacyDiscount('flat', { value: 75 }, null)).toEqual({ kind: 'flat', value: 75, label: '₹75 off' });
  });
  test('falls back to the SQL-resolved discount_value column when config has none', () => {
    expect(adapter.extractLegacyDiscount('percentage', {}, '12.5').value).toBe(12.5);
  });
  test('prebook / bogo', () => {
    expect(adapter.extractLegacyDiscount('prebook', {}, null).kind).toBe('prebook');
    expect(adapter.extractLegacyDiscount('bogo', {}, null).value).toBeNull();
  });
});

describe('channelOfAllocation — conversion vs engagement', () => {
  test('promotional → engagement; commissioned/null → conversion', () => {
    expect(adapter.channelOfAllocation('promotional')).toBe('engagement');
    expect(adapter.channelOfAllocation('commissioned')).toBe('conversion');
    expect(adapter.channelOfAllocation(null)).toBe('conversion'); // legacy rows with an offer
  });
});

describe('normalizeAssignment — the primary source (creator snapshot)', () => {
  const base = {
    campaign_influencer_id: 'ci-1',
    offer_config_json: { sub_type: 'pct', value: 30 },
    offer_type: 'discount',           // library-vocab snapshot
    allocation: 'commissioned',
    commission_pct: 10,
    brand_offer_id: 'bo-9',
    offer_expires_at: '2026-07-01',
    influencer_id: 'inf-1',
    set_id: 'set-1', campaign_id: 'camp-1', offer_id: null,
    discount_value: '30',
    availing_modes: ['pay_at_store'],
    bo_name: 'Aveen lunch combo',
    brand_id: 'brand-1', brand_name: 'Aveen food paradise',
    brand_category: 'restaurant', brand_city: 'Vijayawada',
    handle: 'sagartravel', influencer_name: 'Sagar', profile_pic_url: 'p.jpg',
  };

  test('CONVERSION (commissioned) → creator + full 4-ID tracked link, name from library', () => {
    const n = adapter.normalizeAssignment(base);
    expect(n.source).toBe('assignment');
    expect(n.channel).toBe('conversion');
    expect(n.offer_type).toBe('percentage');     // discount+pct → percentage
    expect(n.discount_value).toBe(30);
    expect(n.name).toBe('Aveen lunch combo');    // enriched from the library row
    expect(n.via_creator.handle).toBe('sagartravel');
    expect(n.tracking).not.toBeNull();
    expect(n.tracking.cid).toBe('camp-1');
    expect(n.tracking.iid).toBe('inf-1');
    expect(n.tracking.oid).toBe('bo-9');         // provenance id when no campaign_offers row
    expect(n.tracking.url).toContain('/s/sagartravel');
  });

  test('ENGAGEMENT (promotional) → creator shown but NO tracking (showcase only)', () => {
    const n = adapter.normalizeAssignment({ ...base, allocation: 'promotional' });
    expect(n.channel).toBe('engagement');
    expect(n.via_creator).not.toBeNull();
    expect(n.tracking).toBeNull();               // showcase: no commission, no tracked link
  });

  test('INLINE legacy offer (no library) → legacy vocab + value from config, name null', () => {
    const n = adapter.normalizeAssignment({
      ...base,
      offer_type: 'percentage',                  // legacy inline vocab
      offer_config_json: { value: 15 },
      brand_offer_id: null, bo_name: null,
      availing_modes: null,
      discount_value: '15',
    });
    expect(n.offer_type).toBe('percentage');
    expect(n.discount).toEqual({ kind: 'pct', value: 15, label: '15% off' });
    expect(n.name).toBeNull();                   // inline offers have no library name
    expect(n.availing_modes).toEqual([]);        // inline offers carry no availing_modes
    expect(n.channel).toBe('conversion');
  });

  test('case-insensitive offer_type — real prod data stores "Discount" (capital), value 0', () => {
    const n = adapter.normalizeAssignment({
      ...base, offer_type: 'Discount', offer_config_json: { value: 0, scope: 'products' },
      brand_offer_id: null, bo_name: null, discount_value: '0',
    });
    expect(n.offer_type).toBe('percentage');        // 'Discount' → percentage
    expect(n.discount).toEqual({ kind: 'pct', value: 0, label: '0% off' });
    expect(n.channel).toBe('conversion');
    expect(n.tracking).not.toBeNull();
  });

  test('reads the SNAPSHOT config, not a later library edit (drift-safe)', () => {
    // offer_config_json here IS the snapshot; the adapter never re-reads bo config for
    // assignments → a library edit can't change this live attachment's number.
    const n = adapter.normalizeAssignment({ ...base, offer_config_json: { sub_type: 'flat', value: 200 } });
    expect(n.discount).toEqual({ kind: 'flat', value: 200, label: '₹200 off' });
  });
});

describe('normalizeLibraryOffer — store-direct + engagement showcase', () => {
  const lib = {
    id: 'bo-2', name: 'Festive 40', offer_type: 'discount',
    offer_config_json: { sub_type: 'pct', value: 40 },
    availing_modes: ['pay_at_store'], store_ends_at: null,
    brand_id: 'b', brand_name: 'B', brand_category: 'restaurant', brand_city: 'C',
    influencer_id: 'inf-2', handle: 'rikitafashion', influencer_name: 'Rikita', profile_pic_url: null,
  };
  test('store channel → no creator, no tracking (iid null by design)', () => {
    const n = adapter.normalizeLibraryOffer({ ...lib, influencer_id: null, handle: null }, 'store');
    expect(n.source).toBe('store');
    expect(n.via_creator).toBeNull();
    expect(n.tracking).toBeNull();
    expect(n.discount_value).toBe(40);
  });
  test('engagement showcase → creator shown, NO tracking', () => {
    const n = adapter.normalizeLibraryOffer(lib, 'engagement');
    expect(n.source).toBe('showcase');
    expect(n.via_creator.handle).toBe('rikitafashion');
    expect(n.tracking).toBeNull();
  });
});

describe('toFeedItem — shape compatible with sectionRules.mapOfferItem', () => {
  test('entity_type offer + legacy-consumed keys', () => {
    const n = adapter.normalizeLibraryOffer({
      id: 'bo-3', name: 'x', offer_type: 'discount', offer_config_json: { sub_type: 'flat', value: 99 },
      availing_modes: ['pay_at_store'], brand_id: 'b', brand_name: 'B', brand_category: 'restaurant', brand_city: 'C',
      influencer_id: null, handle: null,
    }, 'store');
    const item = adapter.toFeedItem(n);
    expect(item.entity_type).toBe('offer');
    expect(item).toMatchObject({ id: 'bo-3', offer_type: 'flat', discount_value: 99, channel: 'store', source: 'store', via_creator: null, tracking: null });
    expect(item).toHaveProperty('availing_modes');
    expect(item).toHaveProperty('brand');
  });
});

describe('dedupe — collapse same offer for same creator to highest priority', () => {
  test('conversion beats engagement beats store', () => {
    const mk = (channel, source, creatorId) => ({ id: 'x', source, channel, via_creator: creatorId ? { id: creatorId } : null });
    const out = adapter.dedupe([mk('store', 'store', null), mk('engagement', 'showcase', null)]);
    // different (source) keys → both kept
    expect(out).toHaveLength(2);
  });
  test('same source+id+creator collapses, conversion wins', () => {
    const row = (channel) => ({ id: 'a', source: 'assignment', channel, via_creator: { id: 'inf-1' } });
    const out = adapter.dedupe([row('engagement'), row('conversion')]);
    expect(out).toHaveLength(1);
    expect(out[0].channel).toBe('conversion');
  });
});

describe('rankForRule — shelf ordering/scope over a normalized list', () => {
  const mk = (o) => ({
    entity_type: 'offer', id: o.id,
    brand: { id: o.bid || 'b1', category: o.cat || 'restaurant' },
    discount_value: o.dv ?? null, offer_expires_at: o.exp || null,
    via_creator: o.cr ? { id: o.cr } : null,
  });
  const items = [
    mk({ id: '1', dv: 10, cr: 'inf-A' }),
    mk({ id: '2', dv: 40, cr: 'inf-B' }),
    mk({ id: '3', dv: null, exp: '2026-07-01' }),
    mk({ id: '4', dv: 25, cat: 'fashion_walkin' }),
  ];
  test('biggest_discounts → discount desc', () => {
    const r = adapter.rankForRule('biggest_discounts', items, { limit: 10 });
    expect(r.map(x => x.id)).toEqual(['2', '4', '1', '3']);
  });
  test('category scope filters by brand.category', () => {
    const r = adapter.rankForRule('all_offers', items, { categoryKeys: ['restaurant', 'bakery'], limit: 10 });
    expect(r.find(x => x.id === '4')).toBeUndefined();
    expect(r).toHaveLength(3);
  });
  test('ending_soon keeps only items with an expiry', () => {
    const r = adapter.rankForRule('ending_soon', items, { limit: 10 });
    expect(r.map(x => x.id)).toEqual(['3']);
  });
  test('follow_graph keeps only followed creators', () => {
    const r = adapter.rankForRule('follow_graph', items, { followedIds: new Set(['inf-B']), limit: 10 });
    expect(r.map(x => x.id)).toEqual(['2']);
  });
  test('creator_promotes keeps only that creator', () => {
    const r = adapter.rankForRule('creator_promotes', items, { influencerId: 'inf-A', limit: 10 });
    expect(r.map(x => x.id)).toEqual(['1']);
  });
  test('limit applied + returns feed items', () => {
    const r = adapter.rankForRule('all_offers', items, { limit: 2 });
    expect(r).toHaveLength(2);
    expect(r[0].entity_type).toBe('offer');
  });
  test('brandId scope (business page) keeps only that brand\'s offers', () => {
    const mixed = [...items, mk({ id: '5', dv: 60, bid: 'b2' })];
    const r = adapter.rankForRule('all_offers', mixed, { brandId: 'b2', limit: 10 });
    expect(r.map(x => x.id)).toEqual(['5']);
    const home = adapter.rankForRule('all_offers', mixed, { limit: 10 });
    expect(home).toHaveLength(5); // no brandId → unscoped (home behaviour unchanged)
  });
});

describe('offersV2Enabled — flag gating (default OFF)', () => {
  const prev = process.env.SECTION_ENGINE_OFFERS;
  afterEach(() => { if (prev === undefined) delete process.env.SECTION_ENGINE_OFFERS; else process.env.SECTION_ENGINE_OFFERS = prev; });
  test('off unless exact "true"', () => {
    delete process.env.SECTION_ENGINE_OFFERS; expect(adapter.offersV2Enabled()).toBe(false);
    process.env.SECTION_ENGINE_OFFERS = '1'; expect(adapter.offersV2Enabled()).toBe(false);
    process.env.SECTION_ENGINE_OFFERS = 'true'; expect(adapter.offersV2Enabled()).toBe(true);
  });
});
