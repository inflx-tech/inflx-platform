/* Smoke — features/brand-mobile-cc (A6). Confirms the new rail + the campaign
   screen parse and their imports resolve, and that the Fund & Publish client
   method exists. */
describe('brand mobile command center', () => {
  it('CampaignStageRail exports StageRail + PrimeBar', () => {
    const m = require('../../../components/brand/CampaignStageRail');
    expect(typeof m.StageRail).toBe('function');
    expect(typeof m.PrimeBar).toBe('function');
  });

  it('BrandCampaignDetailScreen requires + default-exports a component', () => {
    expect(() => require('../BrandCampaignDetailScreen')).not.toThrow();
    expect(typeof require('../BrandCampaignDetailScreen').default).toBe('function');
  });

  it('mobile brandApi exposes publishCampaign (the Fund & Publish gap)', () => {
    const { brandApi } = require('../../../services/api');
    expect(typeof brandApi.publishCampaign).toBe('function');
  });
});
