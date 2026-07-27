/* Smoke — features/brand-mobile-offers (A7). */
describe('brand mobile offer builders', () => {
  it('ProductPickerSheet + offers screen parse', () => {
    expect(() => require('../../../components/brand/ProductPickerSheet')).not.toThrow();
    expect(() => require('../BrandOffersLibraryScreen')).not.toThrow();
    expect(typeof require('../BrandOffersLibraryScreen').default).toBe('function');
  });
  it('mobile brandApi can list products (needed for BOGO/bundle pickers)', () => {
    const { brandApi } = require('../../../services/api');
    expect(typeof brandApi.listProducts).toBe('function');
    expect(typeof brandApi.createOffer).toBe('function');
  });
});
