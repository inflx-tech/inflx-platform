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

  it('both previous callers still get their original contract', () => {
    // The route wrapper hands back (ids, names); the offer builders get [{id, name, ...}].
    expect(() => require('../BrandProductPickerScreen')).not.toThrow();
    expect(typeof require('../BrandProductPickerScreen').default).toBe('function');
  });

  it('mobile brandApi can list products (needed for every picker caller)', () => {
    const { brandApi } = require('../../../services/api');
    expect(typeof brandApi.listProducts).toBe('function');
    expect(typeof brandApi.createOffer).toBe('function');
  });
});
