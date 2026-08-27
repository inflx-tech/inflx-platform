import {
  buildDiscount, buildVolume, buildBogo, buildBundle, buildFreeGift,
} from '../offerBuilders';

/* These assert the shapes backend services/offerConfig.validator.js requires, so the mobile
   builders cannot produce configs the API would reject.

   REWRITTEN by features/stage-2-offers-parity, not loosened.

   The first assertion in this file used to read:

     expect(buildDiscount({ subType: 'pct', value: '20' }))
       .toEqual({ ok: true, config: { sub_type: 'pct', value: 20, scope: 'store' } });

   which is exactly the defect: `scope: 'store'` was hardcoded, so every discount and every
   volume offer built on a phone covered the whole store whatever the brand chose — and this
   test was pinning it in place. A check that encodes a bug is worse than no check, because it
   makes fixing the bug look like a regression.

   It now asserts the full shape web writes, and that scope is store ONLY when nothing else
   was asked for. `offerParity.test.js` proves the two builders agree object-for-object. */

const SAREE = { id: 'p1', name: 'Indigo saree', price: 2400 };
const DUPATTA = { id: 'p2', name: 'Ochre dupatta', price: 900 };

describe('buildDiscount', () => {
  it('builds a pct discount, whole store by default', () => {
    expect(buildDiscount({ subType: 'pct', value: '20' })).toEqual({
      ok: true,
      config: {
        sub_type: 'pct', value: 20,
        scope: 'store', category: null, category_node_id: null, products: [],
      },
    });
  });

  it('carries a category when one is chosen — the shape it could not produce before', () => {
    const r = buildDiscount({
      subType: 'pct', value: '20', scope: 'category', category: 'Sarees', categoryNodeId: 'n9',
    });
    expect(r.config.scope).toBe('category');
    expect(r.config.category).toBe('Sarees');
    expect(r.config.category_node_id).toBe('n9');
    expect(r.config.products).toEqual([]);
  });

  it('carries chosen products, with their names and prices', () => {
    const r = buildDiscount({ subType: 'flat', value: '150', scope: 'products', products: [SAREE] });
    expect(r.config.scope).toBe('products');
    expect(r.config.products).toEqual([{ id: 'p1', name: 'Indigo saree', price: 2400 }]);
  });

  it('rejects pct over 100 and non-positive values', () => {
    expect(buildDiscount({ subType: 'pct', value: '150' }).ok).toBe(false);
    expect(buildDiscount({ subType: 'flat', value: '0' }).ok).toBe(false);
  });

  it('refuses a half-finished scope rather than silently storing the whole store', () => {
    expect(buildDiscount({ subType: 'pct', value: '20', scope: 'category' }).ok).toBe(false);
    expect(buildDiscount({ subType: 'pct', value: '20', scope: 'products', products: [] }).ok).toBe(false);
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

  it('takes a scope, like the discount does', () => {
    const r = buildVolume({
      mode: 'spend', tiers: [{ threshold: '2000', pctOff: '10' }],
      scope: 'category', category: 'Sarees', categoryNodeId: 'n9',
    });
    expect(r.config.scope).toBe('category');
    expect(r.config.category_node_id).toBe('n9');
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
  it('builds the same-product form, keeping the whole product', () => {
    // Not just the id. Web's editor rehydrates its picker straight out of the stored config,
    // so an id-only product opened on web showed a blank row.
    const r = buildBogo({ product: SAREE, buyQty: '2', freeQty: '1' });
    expect(r).toEqual({
      ok: true,
      config: { product: { id: 'p1', name: 'Indigo saree', price: 2400 }, buy_qty: 2, free_qty: 1 },
    });
  });

  it('requires a product and positive quantities', () => {
    expect(buildBogo({ product: null, buyQty: '2', freeQty: '1' }).ok).toBe(false);
    expect(buildBogo({ product: SAREE, buyQty: '0', freeQty: '1' }).ok).toBe(false);
    expect(buildBogo({ product: SAREE, buyQty: '2', freeQty: '' }).ok).toBe(false);
  });
});

describe('buildBundle', () => {
  it('builds with 2+ products and a price', () => {
    const r = buildBundle({ products: [SAREE, DUPATTA], price: '999' });
    expect(r).toEqual({
      ok: true,
      config: {
        products: [
          { id: 'p1', name: 'Indigo saree', price: 2400 },
          { id: 'p2', name: 'Ochre dupatta', price: 900 },
        ],
        bundle_price: 999,
      },
    });
  });

  it('rejects fewer than 2 products or a bad price', () => {
    expect(buildBundle({ products: [SAREE], price: '999' }).ok).toBe(false);
    expect(buildBundle({ products: [SAREE, DUPATTA], price: '0' }).ok).toBe(false);
  });
});

describe('buildFreeGift', () => {
  it('builds one pairing', () => {
    const r = buildFreeGift({ pairs: [{ main: SAREE, gift: DUPATTA }] });
    expect(r.ok).toBe(true);
    expect(r.config.offers).toEqual([{
      main: { id: 'p1', name: 'Indigo saree', price: 2400 },
      gift: { id: 'p2', name: 'Ochre dupatta', price: 900 },
    }]);
  });

  it('allows more than one pairing, because web does', () => {
    const r = buildFreeGift({ pairs: [{ main: SAREE, gift: DUPATTA }, { main: DUPATTA, gift: SAREE }] });
    expect(r.config.offers).toHaveLength(2);
  });

  it('refuses a half-filled pairing rather than storing a gift with nothing to buy', () => {
    expect(buildFreeGift({ pairs: [] }).ok).toBe(false);
    expect(buildFreeGift({ pairs: [{ main: SAREE, gift: null }] }).ok).toBe(false);
    expect(buildFreeGift({ pairs: [{ main: null, gift: DUPATTA }] }).ok).toBe(false);
  });

  it('ignores an empty trailing pairing, the way volume ignores an empty tier', () => {
    const r = buildFreeGift({ pairs: [{ main: SAREE, gift: DUPATTA }, { main: null, gift: null }] });
    expect(r.ok).toBe(true);
    expect(r.config.offers).toHaveLength(1);
  });
});
