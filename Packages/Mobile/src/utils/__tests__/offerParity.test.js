const fs = require('fs');
const path = require('path');

const B = require('../offerBuilders');

/**
 * Offer parity — the phone and web must write ONE shape.
 * Contract: features/stage-2-offers-parity (D-*, P-*)
 *
 * WHY THIS FILE EXISTS
 * There are two builders for one stored object. `campaignChannels.js` opens by naming the cost
 * of letting that drift:
 *
 *   "already had to clean up two duplicated vocabularies (offer types written differently by
 *    web and mobile, and a duplicated offer-type normaliser). A third is not worth it."
 *
 * Until offer-builder-v2 this ran web's builder, lifted out of its source, against the phone's on
 * the same input. Web's builder is retired now; see the record below for what replaced it.
 */

/*
 * offer-builder-v2 (rules §1.13) retired web's old OfferBuilder.js — the website now builds the new
 * offers (engine 2), a different model with its own tests. The old shape did not go away: every
 * engine-1 offer already in the database holds exactly what that builder wrote, and the phone's
 * builders still write it. So the web half is no longer run from source; it is the record of what
 * the retired builder produced, captured by running its last source (commit 76cd7610^) on these
 * same inputs. The phone must keep writing that shape — nothing in these checks is weaker.
 */
const RETIRED_WEB = path.resolve(__dirname, '../../../../brand-web/components/OfferBuilder.js');
const SAREE = { id: 'p1', name: 'Indigo saree', price: 2400 };
const DUPATTA = { id: 'p2', name: 'Ochre dupatta', price: 900 };
const BINDI = { id: 'p3', name: 'Bindi set', price: 120 };
const WEB_WROTE = {
  discountStore: { sub_type: 'pct', value: 20, scope: 'store', category: null, category_node_id: null, products: [] },
  discountCategory: { sub_type: 'pct', value: 20, scope: 'category', category: 'Sarees', category_node_id: 'node-9', products: [] },
  discountProducts: { sub_type: 'flat', value: 150, scope: 'products', category: null, category_node_id: null, products: [SAREE, DUPATTA] },
  volumeSpend: { mode: 'spend', tiers: [{ min_spend: 5000, pct_off: 10 }, { min_spend: 10000, pct_off: 15 }], scope: 'category', category: 'Sarees', category_node_id: 'node-9', products: [] },
  volumeQty: { mode: 'quantity', tiers: [{ min_qty: 3, pct_off: 12 }], scope: 'store', category: null, category_node_id: null, products: [] },
  bogo: { product: SAREE, buy_qty: 2, free_qty: 1 },
  bundle: { products: [SAREE, DUPATTA], bundle_price: 2900 },
  freeGift: { offers: [{ main: SAREE, gift: BINDI }] },
  types: ['discount', 'volume', 'bogo', 'bundle', 'free_gift'],
  modes: ['pay_at_store', 'online_order', 'prebook'],
};

describe('the retired web builder', () => {
  it('is gone — the website builds the new offers now, so nothing can drift from it', () => {
    expect(fs.existsSync(RETIRED_WEB)).toBe(false);
  });
});

describe('the phone writes exactly what web wrote, for every offer type', () => {
  it('discount · whole store', () => {
    const web = WEB_WROTE.discountStore;
    const mine = B.buildDiscount({ subType: 'pct', value: '20', scope: 'store' });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web);
  });

  it('discount · a category — the shape the phone could not produce at all', () => {
    const web = WEB_WROTE.discountCategory;
    const mine = B.buildDiscount({
      subType: 'pct', value: '20', scope: 'category', category: 'Sarees', categoryNodeId: 'node-9',
    });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web);
    // Both halves written. The server accepts either, and the shopper-side SQL prefers the node
    // id — writing one and not the other is how an offer stops matching after a rename.
    expect(mine.config.category).toBe('Sarees');
    expect(mine.config.category_node_id).toBe('node-9');
  });

  it('discount · chosen products', () => {
    const web = WEB_WROTE.discountProducts;
    const mine = B.buildDiscount({
      subType: 'flat', value: '150', scope: 'products', products: [SAREE, DUPATTA],
    });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web);
  });

  it('volume · by spend, scoped to a category', () => {
    const web = WEB_WROTE.volumeSpend;
    const mine = B.buildVolume({
      mode: 'spend',
      tiers: [{ threshold: '5000', pctOff: '10' }, { threshold: '10000', pctOff: '15' }],
      scope: 'category', category: 'Sarees', categoryNodeId: 'node-9',
    });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web);
  });

  it('volume · by quantity, whole store', () => {
    const web = WEB_WROTE.volumeQty;
    const mine = B.buildVolume({ mode: 'quantity', tiers: [{ threshold: '3', pctOff: '12' }], scope: 'store' });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web);
  });

  it('bogo · same product', () => {
    const web = WEB_WROTE.bogo;
    const mine = B.buildBogo({ product: SAREE, buyQty: '2', freeQty: '1' });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web);
  });

  it('bundle', () => {
    const web = WEB_WROTE.bundle;
    const mine = B.buildBundle({ products: [SAREE, DUPATTA], price: '2900' });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web);
  });

  it('free gift · the fifth type, which the phone did not have at all', () => {
    const web = WEB_WROTE.freeGift;
    const mine = B.buildFreeGift({ pairs: [{ main: SAREE, gift: BINDI }] });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web);
  });

  it('every type web offered, the phone offers', () => {
    expect(B.OFFER_TYPES.map(t => t.key).sort()).toEqual([...WEB_WROTE.types].sort());
  });
});

describe('products carry the name and price web rehydrates from', () => {
  // Web's old editor filled its product pickers straight out of the stored config
  // (`d.bnd_prods = c.products`). A phone-made bundle that stored only ids showed nameless,
  // priceless products the moment anyone opened it on web. Live defect until now.
  it('bundle products keep id, name and price', () => {
    const { config } = B.buildBundle({ products: [SAREE, DUPATTA], price: '2900' });
    expect(config.products).toEqual([
      { id: 'p1', name: 'Indigo saree', price: 2400 },
      { id: 'p2', name: 'Ochre dupatta', price: 900 },
    ]);
  });

  it('bogo keeps the whole product, not just an id', () => {
    const { config } = B.buildBogo({ product: SAREE, buyQty: 2, freeQty: 1 });
    expect(config.product).toEqual({ id: 'p1', name: 'Indigo saree', price: 2400 });
  });
});

describe('D-1 D-2 D-5 · scope is chosen, never assumed', () => {
  it('the hardcoded store scope is gone from both builders', () => {
    const src = fs.readFileSync(require.resolve('../offerBuilders'), 'utf8');
    // Comments stripped: the note explaining the old bug quotes the old literal.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/scope: 'store'/);
  });

  it('a category scope with no category is refused, in words', () => {
    const r = B.buildDiscount({ subType: 'pct', value: 20, scope: 'category' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Pick the category this offer covers.');
  });

  it('a products scope with no products is refused', () => {
    const r = B.buildVolume({
      mode: 'spend', tiers: [{ threshold: 100, pctOff: 10 }], scope: 'products', products: [],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/at least one product/);
  });

  it('an unknown scope falls back to the whole store rather than storing nonsense', () => {
    const r = B.buildDiscount({ subType: 'pct', value: 20, scope: 'everything' });
    expect(r.ok).toBe(true);
    expect(r.config.scope).toBe('store');
  });

  it('scope defaults to store only when nothing else was asked for', () => {
    const r = B.buildDiscount({ subType: 'pct', value: 20 });
    expect(r.config.scope).toBe('store');
    expect(r.config.category).toBeNull();
    expect(r.config.products).toEqual([]);
  });
});

describe('P-3 P-4 · where it redeems, and the warning', () => {
  it('the modes match what web offered, exactly and in order', () => {
    expect(B.AVAILING_MODES.map(m => m.key)).toEqual(WEB_WROTE.modes);
  });

  it('a scoped offer warns that a paper bill cannot honour it', () => {
    expect(B.applicabilityHint('discount', 'category')).toMatch(/paper bill cannot be scoped/);
    expect(B.applicabilityHint('discount', 'products')).toMatch(/paper bill cannot be scoped/);
  });

  it('a whole-store percentage does not warn, because it works everywhere', () => {
    expect(B.applicabilityHint('discount', 'store')).toMatch(/online orders and pay-at-store/);
  });

  it('basket-shaped offers say so whatever their scope', () => {
    for (const t of ['bogo', 'bundle', 'free_gift']) {
      expect(B.applicabilityHint(t, 'store')).toMatch(/need a basket/);
    }
  });
});

describe('V-4 · the validity window', () => {
  it('an end before the start is refused, in words', () => {
    const r = B.buildWindow({ startsAt: '2026-09-10', endsAt: '2026-09-01' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('The end date is before the start date.');
  });

  it('either end may be blank, and blank means no limit', () => {
    expect(B.buildWindow({ startsAt: '2026-09-01', endsAt: '' }).window).toEqual({ startsAt: '2026-09-01', endsAt: null });
    expect(B.buildWindow({}).window).toEqual({ startsAt: null, endsAt: null });
  });

  it('the same day at both ends is allowed — a one-day offer is a real thing', () => {
    expect(B.buildWindow({ startsAt: '2026-09-01', endsAt: '2026-09-01' }).ok).toBe(true);
  });
});
