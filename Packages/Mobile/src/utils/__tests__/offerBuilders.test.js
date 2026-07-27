import { buildDiscount, buildVolume, buildBogo, buildBundle } from '../offerBuilders';

/* These assert the shapes backend services/offerConfig.validator.js requires,
   so the mobile builders can't produce configs the API would reject. */

describe('buildDiscount', () => {
  it('builds a pct discount', () => {
    expect(buildDiscount({ subType: 'pct', value: '20' }))
      .toEqual({ ok: true, config: { sub_type: 'pct', value: 20, scope: 'store' } });
  });
  it('rejects pct over 100 and non-positive values', () => {
    expect(buildDiscount({ subType: 'pct', value: '150' }).ok).toBe(false);
    expect(buildDiscount({ subType: 'flat', value: '0' }).ok).toBe(false);
  });
});

describe('buildVolume', () => {
  it('spend tiers use min_spend', () => {
    const r = buildVolume({ mode: 'spend', tiers: [{ threshold: '2000', pctOff: '10' }] });
    expect(r.ok).toBe(true);
    expect(r.config.mode).toBe('spend');
    expect(r.config.tiers).toEqual([{ min_spend: 2000, pct_off: 10 }]);
  });
  it('quantity tiers use min_qty', () => {
    const r = buildVolume({ mode: 'quantity', tiers: [{ threshold: '3', pctOff: '15' }] });
    expect(r.config.tiers).toEqual([{ min_qty: 3, pct_off: 15 }]);
  });
  it('needs at least one tier, positive threshold and 1-100 pct', () => {
    expect(buildVolume({ mode: 'spend', tiers: [] }).ok).toBe(false);
    expect(buildVolume({ mode: 'spend', tiers: [{ threshold: '0', pctOff: '10' }] }).ok).toBe(false);
    expect(buildVolume({ mode: 'spend', tiers: [{ threshold: '500', pctOff: '120' }] }).ok).toBe(false);
  });
  it('ignores blank trailing tier rows', () => {
    const r = buildVolume({ mode: 'spend', tiers: [{ threshold: '500', pctOff: '5' }, { threshold: '', pctOff: '' }] });
    expect(r.ok).toBe(true);
    expect(r.config.tiers).toHaveLength(1);
  });
});

describe('buildBogo', () => {
  it('builds the same-product form', () => {
    const r = buildBogo({ product: { id: 'p1' }, buyQty: '2', freeQty: '1' });
    expect(r).toEqual({ ok: true, config: { product: { id: 'p1' }, buy_qty: 2, free_qty: 1 } });
  });
  it('requires a product and positive quantities', () => {
    expect(buildBogo({ product: null, buyQty: '2', freeQty: '1' }).ok).toBe(false);
    expect(buildBogo({ product: { id: 'p1' }, buyQty: '0', freeQty: '1' }).ok).toBe(false);
    expect(buildBogo({ product: { id: 'p1' }, buyQty: '2', freeQty: '' }).ok).toBe(false);
  });
});

describe('buildBundle', () => {
  it('builds with 2+ products and a price', () => {
    const r = buildBundle({ products: [{ id: 'a' }, { id: 'b' }], price: '999' });
    expect(r).toEqual({ ok: true, config: { products: [{ id: 'a' }, { id: 'b' }], bundle_price: 999 } });
  });
  it('rejects fewer than 2 products or a bad price', () => {
    expect(buildBundle({ products: [{ id: 'a' }], price: '999' }).ok).toBe(false);
    expect(buildBundle({ products: [{ id: 'a' }, { id: 'b' }], price: '0' }).ok).toBe(false);
  });
});
