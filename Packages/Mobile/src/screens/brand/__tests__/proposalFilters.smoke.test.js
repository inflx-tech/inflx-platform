/* Smoke — features/brand-mobile-proposal-filters. */
describe('proposal filters on mobile', () => {
  it('sheet + inbox parse', () => {
    expect(() => require('../../../components/brand/ProposalFiltersSheet')).not.toThrow();
    expect(() => require('../BrandProposalInboxScreen')).not.toThrow();
    expect(typeof require('../../../components/brand/ProposalFiltersSheet').default).toBe('function');
  });
  it('brandApi can read + write proposal settings', () => {
    const { brandApi } = require('../../../services/api');
    expect(typeof brandApi.getProposalSettings).toBe('function');
    expect(typeof brandApi.updateProposalSettings).toBe('function');
  });
});
