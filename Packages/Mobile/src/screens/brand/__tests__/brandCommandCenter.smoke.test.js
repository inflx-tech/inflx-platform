/* Smoke — features/brand-mobile-cc (A6), trimmed by retire-old-campaign-stage-rail.
   Confirms the prime bar + the campaign
   screen parse and their imports resolve, and that the Fund & Publish client
   method exists. */
describe('brand mobile command center', () => {
  it('CampaignPrimeBar exports PrimeBar, and no longer a StageRail', () => {
    // REWRITTEN, not deleted. This used to assert StageRail exists. The founder asked for the
    // six-stage strip gone on 2026-08-27 — it was a DIFFERENT six from Stage 3's — so the
    // assertion now states the opposite fact rather than the coverage quietly evaporating.
    // Contract: features/retire-old-campaign-stage-rail
    const m = require('../../../components/brand/CampaignPrimeBar');
    expect(typeof m.PrimeBar).toBe('function');
    expect(m.StageRail).toBeUndefined();
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
