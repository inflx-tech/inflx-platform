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
 * So this does not compare two lists that agree today. It **runs web's builder** — extracted
 * from its source — against the phone's, on the same input, and compares the objects.
 *
 * Web is a Next.js component full of JSX and imports that jest here cannot load, so the pure
 * function is lifted out of the file by source and evaluated. If web's builder is renamed or
 * restructured, the extraction throws rather than silently passing.
 */

const WEB = path.resolve(__dirname, '../../../../brand-web/components/OfferBuilder.js');

/** Lift `buildOfferConfig` and its two helpers out of web's source and make them callable. */
function webBuilder() {
  const src = fs.readFileSync(WEB, 'utf8');
  const grab = (re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`web OfferBuilder no longer defines ${what} as expected — parity cannot be checked`);
    return m[0];
  };
  const prodFn = grab(/const prod = \(p\) => [^;]+;/, 'prod()');
  const numFn = grab(/const num = \(v\) => [^;]+;/, 'num()');
  const build = grab(/function buildOfferConfig\(d\) \{[\s\S]*?\n\}/, 'buildOfferConfig()');
  // eslint-disable-next-line no-new-func
  return new Function(`${prodFn}\n${numFn}\n${build}\nreturn buildOfferConfig;`)();
}

const buildWeb = webBuilder();

/** Web's draft shape, so the same intent can be expressed to both builders. */
const webDraft = (over) => ({
  name: 'X', offer_type: 'discount',
  d_sub: 'pct', d_val: '', d_scope: 'store', d_category: '', d_category_node: '', d_prods: [],
  v_mode: 'spend', v_tiers: [{ min_spend: '', pct_off: '' }], v_scope: 'store', v_category: '', v_category_node: '', v_prods: [],
  bogo_product: null, bogo_buy_qty: '1', bogo_free_qty: '1',
  bnd_prods: [], bnd_price: '',
  gift_offers: [{ main: null, gift: null }],
  availing_modes: ['pay_at_store', 'online_order'],
  ...over,
});

const SAREE = { id: 'p1', name: 'Indigo saree', price: 2400 };
const DUPATTA = { id: 'p2', name: 'Ochre dupatta', price: 900 };
const BINDI = { id: 'p3', name: 'Bindi set', price: 120 };

describe('the phone and web agree on every offer type', () => {
  it('discount · whole store', () => {
    const web = buildWeb(webDraft({ offer_type: 'discount', d_sub: 'pct', d_val: '20' }));
    const mine = B.buildDiscount({ subType: 'pct', value: '20', scope: 'store' });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web.offer_config_json);
  });

  it('discount · a category — the shape the phone could not produce at all', () => {
    const web = buildWeb(webDraft({
      offer_type: 'discount', d_sub: 'pct', d_val: '20',
      d_scope: 'category', d_category: 'Sarees', d_category_node: 'node-9',
    }));
    const mine = B.buildDiscount({
      subType: 'pct', value: '20', scope: 'category', category: 'Sarees', categoryNodeId: 'node-9',
    });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web.offer_config_json);
    // Both halves written. The server accepts either, and the shopper-side SQL prefers the node
    // id — writing one and not the other is how an offer stops matching after a rename.
    expect(mine.config.category).toBe('Sarees');
    expect(mine.config.category_node_id).toBe('node-9');
  });

  it('discount · chosen products', () => {
    const web = buildWeb(webDraft({
      offer_type: 'discount', d_sub: 'flat', d_val: '150',
      d_scope: 'products', d_prods: [SAREE, DUPATTA],
    }));
    const mine = B.buildDiscount({
      subType: 'flat', value: '150', scope: 'products', products: [SAREE, DUPATTA],
    });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web.offer_config_json);
  });

  it('volume · by spend, scoped to a category', () => {
    const web = buildWeb(webDraft({
      offer_type: 'volume', v_mode: 'spend',
      v_tiers: [{ min_spend: '5000', pct_off: '10' }, { min_spend: '10000', pct_off: '15' }],
      v_scope: 'category', v_category: 'Sarees', v_category_node: 'node-9',
    }));
    const mine = B.buildVolume({
      mode: 'spend',
      tiers: [{ threshold: '5000', pctOff: '10' }, { threshold: '10000', pctOff: '15' }],
      scope: 'category', category: 'Sarees', categoryNodeId: 'node-9',
    });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web.offer_config_json);
  });

  it('volume · by quantity, whole store', () => {
    const web = buildWeb(webDraft({
      offer_type: 'volume', v_mode: 'quantity',
      v_tiers: [{ min_qty: '3', pct_off: '12' }],
    }));
    const mine = B.buildVolume({ mode: 'quantity', tiers: [{ threshold: '3', pctOff: '12' }], scope: 'store' });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web.offer_config_json);
  });

  it('bogo · same product', () => {
    const web = buildWeb(webDraft({
      offer_type: 'bogo', bogo_product: SAREE, bogo_buy_qty: '2', bogo_free_qty: '1',
    }));
    const mine = B.buildBogo({ product: SAREE, buyQty: '2', freeQty: '1' });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web.offer_config_json);
  });

  it('bundle', () => {
    const web = buildWeb(webDraft({
      offer_type: 'bundle', bnd_prods: [SAREE, DUPATTA], bnd_price: '2900',
    }));
    const mine = B.buildBundle({ products: [SAREE, DUPATTA], price: '2900' });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web.offer_config_json);
  });

  it('free gift · the fifth type, which the phone did not have at all', () => {
    const web = buildWeb(webDraft({
      offer_type: 'free_gift', gift_offers: [{ main: SAREE, gift: BINDI }],
    }));
    const mine = B.buildFreeGift({ pairs: [{ main: SAREE, gift: BINDI }] });
    expect(mine.ok).toBe(true);
    expect(mine.config).toEqual(web.offer_config_json);
  });

  it('every type web offers, the phone offers', () => {
    const src = fs.readFileSync(WEB, 'utf8');
    const from = src.indexOf('const OFFER_TYPES');
    const to = src.indexOf('const AVAILING_MODES');
    // Prove the slice found something before asserting anything about it. A wrong constant
    // name gives indexOf(-1), an empty slice, and a check that passes while testing nothing —
    // which is exactly how a card assertion in Batch A went green on air.
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const list = src.slice(from, to);
    const webKeys = [...list.matchAll(/key: '(\w+)'/g)].map(m => m[1]);
    expect(webKeys.length).toBe(5);
    expect(B.OFFER_TYPES.map(t => t.key).sort()).toEqual(webKeys.sort());
  });
});

describe('products carry the name and price web rehydrates from', () => {
  // Web's editor fills its product pickers straight out of the stored config
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
  it('the four modes match web exactly', () => {
    const src = fs.readFileSync(WEB, 'utf8');
    const list = src.slice(src.indexOf('const AVAILING_MODES'), src.indexOf('const AVAILING_MODES') + 400);
    const webKeys = [...list.matchAll(/key: '(\w+)'/g)].map(m => m[1]);
    expect(B.AVAILING_MODES.map(m => m.key)).toEqual(webKeys);
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
