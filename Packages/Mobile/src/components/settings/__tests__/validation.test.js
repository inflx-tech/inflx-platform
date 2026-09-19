/**
 * Item 2 — the client-side rules must be the server's rules, word for word (prompt §4).
 * Contract: features/item2-pitch-invitation-settings
 */
const { validateBrandSettings, validateCreatorSettings, visibleCommissionKeys, minimumsSummary } = require('../validation');
const { MSG, fixCount, aimsPhrase, modesPhrase, groupIndian, shortDate } = require('../copy');

const brandOk = {
  accepting: true, acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'],
  minFollowersInstagram: '', minFollowersYoutube: '', minEngagementRate: '',
};

describe('brand pitch settings', () => {
  it('accepts the defaults with no errors', () => {
    expect(validateBrandSettings(brandOk)).toEqual({});
  });
  it('needs at least one Aim, with the exact message', () => {
    expect(validateBrandSettings({ ...brandOk, acceptedAims: [] }).acceptedAims).toBe(MSG.AIMS_BRAND);
    expect(MSG.AIMS_BRAND).toBe('Pick at least one Aim. To stop all pitches, turn off Accepting pitches instead.');
  });
  it('needs at least one mode of work', () => {
    expect(validateBrandSettings({ ...brandOk, acceptedModes: [] }).acceptedModes).toBe('Pick at least one mode of work.');
  });
  it('followers must be whole numbers or empty', () => {
    expect(validateBrandSettings({ ...brandOk, minFollowersInstagram: '10000' })).toEqual({});
    expect(validateBrandSettings({ ...brandOk, minFollowersInstagram: '1.5' }).minFollowersInstagram).toBe('Enter a whole number.');
    expect(validateBrandSettings({ ...brandOk, minFollowersYoutube: '-1' }).minFollowersYoutube).toBe('Enter a whole number.');
  });
  it('engagement rate is 0–100 with one decimal', () => {
    expect(validateBrandSettings({ ...brandOk, minEngagementRate: '4.2' })).toEqual({});
    expect(validateBrandSettings({ ...brandOk, minEngagementRate: '140' }).minEngagementRate).toBe('Enter a rate between 0 and 100.');
    expect(validateBrandSettings({ ...brandOk, minEngagementRate: '4.25' }).minEngagementRate).toBe('Enter a rate between 0 and 100.');
  });
});

const creatorOk = {
  open: true, acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'],
  visitCityIds: [12], brandCategoryCodes: null, minFeeEngagement: '', minFeeHybrid: '', commissions: {},
};

describe('creator invitation settings', () => {
  it('accepts the defaults', () => {
    expect(validateCreatorSettings(creatorOk)).toEqual({});
  });
  it('needs at least one Aim, with the creator wording', () => {
    expect(validateCreatorSettings({ ...creatorOk, acceptedAims: [] }).acceptedAims)
      .toBe('Pick at least one Aim. To stop all invitations, turn off Open to invitations instead.');
  });
  // creator-distance-and-visit-preference: check 9 withdrawn — an empty visit list now means
  // "anywhere" and is a valid, saveable choice with Store Visit on.
  it('Store Visit on with no cities is valid (empty list = anywhere)', () => {
    expect(validateCreatorSettings({ ...creatorOk, visitCityIds: [] })).toEqual({});
    expect(validateCreatorSettings({ ...creatorOk, visitCityIds: [], acceptedModes: ['shipment'] })).toEqual({});
  });
  it('fees are whole rupees', () => {
    expect(validateCreatorSettings({ ...creatorOk, minFeeEngagement: '8000' })).toEqual({});
    expect(validateCreatorSettings({ ...creatorOk, minFeeHybrid: '50.5' }).minFeeHybrid).toBe('Enter an amount in whole rupees.');
  });
  it('commission rows are 1–100 or empty', () => {
    expect(validateCreatorSettings({ ...creatorOk, commissions: { 'conversion:WOMEN': '12', 'hybrid:WOMEN': '' } })).toEqual({});
    const e = validateCreatorSettings({ ...creatorOk, commissions: { 'conversion:IMITATION_JEWELLERY': '150' } });
    expect(e['commission:conversion:IMITATION_JEWELLERY']).toBe('Commission must be between 1 and 100%.');
    expect(validateCreatorSettings({ ...creatorOk, commissions: { 'conversion:ALL': '0.5' } })['commission:conversion:ALL']).toBeDefined();
  });
  it('only rows for selected Aims and categories are on screen; none picked → a single ALL row', () => {
    expect(visibleCommissionKeys(['conversion', 'hybrid'], ['WOMEN', 'IMITATION_JEWELLERY']))
      .toEqual(['conversion:WOMEN', 'conversion:IMITATION_JEWELLERY', 'hybrid:WOMEN', 'hybrid:IMITATION_JEWELLERY']);
    expect(visibleCommissionKeys(['engagement'], ['WOMEN'])).toEqual([]);
    expect(visibleCommissionKeys(['conversion'], null)).toEqual(['conversion:ALL']);
  });
});

describe('the C6 summary line', () => {
  it('reads "Content ₹8,000 · Sale 12% · Hybrid ₹5,000 + 10%" (check 8)', () => {
    const s = {
      acceptedAims: ['conversion', 'engagement', 'hybrid'], brandCategoryCodes: ['WOMEN', 'IMITATION_JEWELLERY'],
      minFeeEngagement: 8000, minFeeHybrid: 5000,
      minCommissions: [{ aim: 'conversion', categoryCode: 'WOMEN', pct: 12 }, { aim: 'hybrid', categoryCode: 'WOMEN', pct: 10 }],
    };
    expect(minimumsSummary(s, groupIndian)).toBe('Content ₹8,000 · Sale 12% · Hybrid ₹5,000 + 10%');
  });
  it('shows lowest–highest for several industry rates', () => {
    const s = { acceptedAims: ['conversion'], brandCategoryCodes: ['WOMEN', 'MEN'], minCommissions: [
      { aim: 'conversion', categoryCode: 'WOMEN', pct: 12 }, { aim: 'conversion', categoryCode: 'MEN', pct: 8 }] };
    expect(minimumsSummary(s, groupIndian)).toBe('Sale 8–12%');
  });
  it('ignores rows for an Aim that is turned off', () => {
    const s = { acceptedAims: ['engagement'], brandCategoryCodes: null, minFeeEngagement: 8000,
      minCommissions: [{ aim: 'hybrid', categoryCode: 'ALL', pct: 10 }] };
    expect(minimumsSummary(s, groupIndian)).toBe('Content ₹8,000');
  });
});

describe('copy helpers', () => {
  it('counts what is left to fix', () => {
    expect(fixCount(1)).toBe('Fix 1 thing above to save');
    expect(fixCount(2)).toBe('Fix 2 things above to save');
  });
  it('phrases Aims and modes for the profile rows', () => {
    expect(aimsPhrase(['conversion', 'engagement', 'hybrid'])).toBe('all Aims');
    expect(aimsPhrase(['hybrid', 'conversion'])).toBe('Pay for Sale, Hybrid');
    expect(modesPhrase(['visit', 'shipment'])).toBe('Store Visit and Remote');
    expect(modesPhrase(['shipment'])).toBe('Remote');
  });
  it('formats rupees with Indian grouping and dates as "11 Sep"', () => {
    expect(groupIndian(8000)).toBe('8,000');
    expect(groupIndian(1250000)).toBe('12,50,000');
    expect(shortDate('2026-09-11T10:00:00Z')).toMatch(/^11 Sep$/);
  });
});
