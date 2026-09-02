/* Smoke — features/brand-mobile-offers (A7).
   Stage 2 slice 1 merged ProductPickerSheet into the single shared
   components/brand/ProductPicker. The offer builders now call its modal wrapper.
   Contract: features/stage-2-build-a-campaign-from-the-phone */
describe('brand mobile offer builders', () => {
  it('the shared ProductPicker + offers screen parse', () => {
    expect(() => require('../../../components/brand/ProductPicker')).not.toThrow();
    expect(() => require('../BrandOffersLibraryScreen')).not.toThrow();
    expect(typeof require('../BrandOffersLibraryScreen').default).toBe('function');
  });

  it('ProductPicker exports both the inline picker and the modal wrapper', () => {
    const mod = require('../../../components/brand/ProductPicker');
    expect(typeof mod.ProductPicker).toBe('function');
    expect(typeof mod.ProductPickerModal).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('there is exactly ONE product picker implementation left', () => {
    // Ledger #86 names four callers for this picker. Two implementations is how they
    // drift — the fault behind four of Stage 1's twenty-one bugs. This pins the merge.
    expect(() => require('../../../components/brand/ProductPickerSheet')).toThrow();
  });

  it('DRIFT: the full-screen picker is gone, and only the shared component remains', () => {
    // Docs/THE_CUT.md pass 1 — BrandProductPickerScreen existed ONLY to serve the
    // pre-agreement request composer, which is now removed, so the screen went with it.
    // What this test was really guarding — that there is ONE picker implementation and
    // not two drifting copies (the fault behind four of Stage 1's twenty-one bugs) — is
    // now guaranteed more strongly than before: there is no second implementation left
    // to drift. Asserted rather than deleted.
    expect(() => require('../BrandProductPickerScreen')).toThrow();
    expect(typeof require('../../../components/brand/ProductPicker').default).toBe('function');
  });

  it('mobile brandApi can list products (needed for every picker caller)', () => {
    const { brandApi } = require('../../../services/api');
    expect(typeof brandApi.listProducts).toBe('function');
    expect(typeof brandApi.createOffer).toBe('function');
  });
});
