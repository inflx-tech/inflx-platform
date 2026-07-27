/* Smoke — features/brand-home-restyle. */
describe('brand home restyle', () => {
  it('BrandHomeScreen parses and default-exports a component', () => {
    expect(() => require('../BrandHomeScreen')).not.toThrow();
    expect(typeof require('../BrandHomeScreen').default).toBe('function');
  });
});
