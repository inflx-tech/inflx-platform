/**
 * Item 2 — C2 · C3 · C5 · C6 on the creator's Invitation settings screen, and X1/X2 on the
 * brand overview. Contract: features/item2-pitch-invitation-settings
 */
import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: {
    getInvitationSettings: jest.fn(), putInvitationSettings: jest.fn(),
    getBrandOverview: jest.fn(), blockBrand: jest.fn(), unblockBrand: jest.fn(),
  },
  brandApi: {},
  referenceApi: {
    brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [
      { code: 'MEN', label: 'Men' }, { code: 'WOMEN', label: 'Women' }, { code: 'IMITATION_JEWELLERY', label: 'Imitation Jewellery' }] } }),
    states: jest.fn().mockResolvedValue({ success: true, data: { items: [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }] } }),
  },
}));
const { influencerApi } = require('../../../services/api');
const InvitationSettingsScreen = require('../InvitationSettingsScreen').default;
const BrandOverviewScreen = require('../BrandOverviewScreen').default;

const DEFAULTS = {
  open: true, pausedAt: null, acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'],
  visitCityIds: [10], visitCitiesDefaulted: true, brandCategoryCodes: null, minFeeEngagement: null, minFeeHybrid: null,
  minCommissions: [], updatedAt: null, saved: false,
};
const ok = (settings) => ({ success: true, data: { settings, blockedCount: 0 } });
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });

beforeEach(() => jest.clearAllMocks());

describe('Invitation settings (creator)', () => {
  it('renders the defaults: three Aims, both modes, visit cities defaulted to her city, one "All industries" row', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok(DEFAULTS));
    const { getByTestId, getByText, getAllByText } = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('open-switch'));
    getByTestId('row-visit-cities');
    getByText('Hyderabad');
    getByTestId('card-engagement'); getByTestId('card-conversion'); getByTestId('card-hybrid');
    expect(getAllByText('All industries').length).toBe(2);
    expect(getAllByText('Pick brand categories above to set a rate per industry.').length).toBe(2);   // Sale + Hybrid cards
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  });

  // creator-distance-and-visit-preference (D3): check 9 withdrawn — no cities means anywhere,
  // the row says so in words, and it is not a save-blocking error.
  it('turning Store Visit off hides the cities row; on with no cities reads "Anywhere" and is not an error', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok({ ...DEFAULTS, visitCityIds: [] }));
    const { getByTestId, getByText, queryByText, queryByTestId } = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('row-visit-cities'));
    getByText('Anywhere');
    getByText('Anywhere — any brand can invite you for a store visit. Pick cities to limit it.');
    expect(queryByText('Pick at least one city, or turn off Store Visit.')).toBeNull();
    // Nothing changed yet, so Save is grey for being clean — not for an error.
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
    expect(queryByTestId('save-bar-fix')).toBeNull();
    fireEvent.press(getByTestId('mode-visit'));
    expect(queryByTestId('row-visit-cities')).toBeNull();
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(false);
  });

  it('picking categories adds a % row per industry in Sale and Hybrid; an out-of-range % blocks save (C3)', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok(DEFAULTS));
    const { getByTestId, getByText, getAllByText } = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('cat-WOMEN'));
    fireEvent.press(getByTestId('cat-WOMEN'));
    fireEvent.press(getByTestId('cat-IMITATION_JEWELLERY'));
    expect(getAllByText('Women').length).toBe(2);      // one % row in Sale, one in Hybrid (the chip reads '✓ Women')
    fireEvent.changeText(getByTestId('pct-conversion:IMITATION_JEWELLERY'), '150');
    getByText('Commission must be between 1 and 100%.');
    getByText('Fix 1 thing above to save');
    fireEvent.changeText(getByTestId('pct-conversion:IMITATION_JEWELLERY'), '');
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(false);
  });

  it('turning Hybrid off hides its card and keeps the numbers for when it comes back (check 8)', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok({ ...DEFAULTS, brandCategoryCodes: ['WOMEN'], minFeeHybrid: 5000,
      minCommissions: [{ aim: 'hybrid', categoryCode: 'WOMEN', pct: 10 }] }));
    const { getByTestId, queryByTestId } = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('card-hybrid'));
    expect(getByTestId('fee-hybrid').props.value).toBe('5000');
    expect(getByTestId('pct-hybrid:WOMEN').props.value).toBe('10');
    fireEvent.press(getByTestId('aim-hybrid'));
    expect(queryByTestId('card-hybrid')).toBeNull();
    fireEvent.press(getByTestId('aim-hybrid'));
    expect(getByTestId('fee-hybrid').props.value).toBe('5000');
    expect(getByTestId('pct-hybrid:WOMEN').props.value).toBe('10');
  });

  it('saves the founder\'s example and shows the C6 preview with the summary line (check 8)', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok(DEFAULTS));
    const saved = { ...DEFAULTS, saved: true, brandCategoryCodes: ['WOMEN', 'IMITATION_JEWELLERY'], minFeeEngagement: 8000, minFeeHybrid: 5000,
      minCommissions: [{ aim: 'conversion', categoryCode: 'WOMEN', pct: 12 }, { aim: 'hybrid', categoryCode: 'WOMEN', pct: 10 }] };
    influencerApi.putInvitationSettings.mockResolvedValue(ok(saved));
    const { getByTestId, getByText } = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('cat-WOMEN'));
    fireEvent.press(getByTestId('cat-WOMEN'));
    fireEvent.press(getByTestId('cat-IMITATION_JEWELLERY'));
    fireEvent.changeText(getByTestId('fee-engagement'), '8000');
    fireEvent.changeText(getByTestId('pct-conversion:WOMEN'), '12');
    fireEvent.changeText(getByTestId('fee-hybrid'), '5000');
    fireEvent.changeText(getByTestId('pct-hybrid:WOMEN'), '10');
    await act(async () => { fireEvent.press(getByTestId('save-button')); });
    await waitFor(() => getByText('Invitation settings saved.'));
    const body = influencerApi.putInvitationSettings.mock.calls[0][0];
    expect(body.brandCategoryCodes).toEqual(['WOMEN', 'IMITATION_JEWELLERY']);
    expect(body.minFeeEngagement).toBe(8000);
    expect(body.minCommissions).toEqual(expect.arrayContaining([
      { aim: 'conversion', categoryCode: 'WOMEN', pct: 12 }, { aim: 'hybrid', categoryCode: 'WOMEN', pct: 10 }]));
    getByTestId('public-preview');
    getByText('Content ₹8,000 · Sale 12% · Hybrid ₹5,000 + 10%');
    getByText('Women, Imitation Jewellery');
  });

  it('stopping invitations asks first with the C5 copy', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok(DEFAULTS));
    const { getByTestId, getByText } = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('open-switch'));
    fireEvent(getByTestId('open-switch'), 'valueChange', false);
    getByText('Stop taking invitations?');
    getByText("Invitations you already have stay open until their set's cutoff. Your active collaborations carry on.");
    fireEvent.press(getByTestId('confirm-primary'));
    expect(getByTestId('open-switch').props.value).toBe(false);
  });
});

/**
 * ui-walk-fixes U22 (business-rule drift, founder decision D2 → U22; drift/K2.md).
 *
 * Since D2 a brand that cannot invite her is told WHICH of her rules ruled it out. The screen
 * promised more privacy than that leaves her — "Only you see this." under Brand categories, and
 * "Your categories, cities, minimum fee and commission stay private." on the card shown after a
 * save. Both sentences are reworded; nothing else on the screen moved. No test pinned the old
 * words, so these are new assertions, not rewritten ones.
 */
describe('Invitation settings (creator) — what she is promised about privacy (ui-walk-fixes U22)', () => {
  const { COPY } = require('../../../components/settings/copy');
  const OLD_CATEGORIES = 'None picked means any category. Only you see this.';
  const OLD_PREVIEW = 'Your categories, cities, minimum fee and commission stay private.';
  const NEW_CATEGORIES = "None picked means any category. Brands never see your list — a brand outside it is told only that you aren't taking its category.";
  const NEW_PREVIEW = "Brands never see your category or city lists. A brand you've ruled out is told which rule it was, nothing more.";

  // A press starts the button's fade and a save its toast; on jest's timers neither lands between awaits.
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('the two sentences, word for word', () => {
    expect(COPY.creator.categoriesHint).toBe(NEW_CATEGORIES);
    expect(COPY.creator.previewHint).toBe(NEW_PREVIEW);
  });

  it('under "Brand categories" she reads that a brand outside her list is told so — never "Only you see this."', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok(DEFAULTS));
    const r = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('cat-WOMEN'));
    r.getByText('Brand categories');
    r.getByText(NEW_CATEGORIES);
    expect(r.queryByText(OLD_CATEGORIES)).toBeNull();
    expect(JSON.stringify(r.toJSON())).not.toMatch(/Only you see this\./);
    // U10 — the hint under her minimums is not one of the two sentences and stays as it was.
    r.getByText('Only you see these. Brands can still invite below them, with a warning.');
  });

  it('after a save, the "Brands see on your profile" card says what a ruled-out brand is told — never that it all "stays private"', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok(DEFAULTS));
    influencerApi.putInvitationSettings.mockResolvedValue(ok({ ...DEFAULTS, saved: true, brandCategoryCodes: ['WOMEN'] }));
    const r = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('cat-WOMEN'));
    expect(r.queryByTestId('public-preview')).toBeNull();                 // the card belongs to a save
    fireEvent.press(r.getByTestId('cat-WOMEN'));
    await act(async () => { fireEvent.press(r.getByTestId('save-button')); });
    const card = await waitFor(() => r.getByTestId('public-preview'));
    within(card).getByText('Brands see on your profile');
    within(card).getByText(NEW_PREVIEW);
    expect(r.queryByText(OLD_PREVIEW)).toBeNull();
    expect(JSON.stringify(r.toJSON())).not.toMatch(/stay private/);
    // The card keeps the two rows under the sentence (U10): her categories and her minimums.
    within(card).getByText('Brand categories');
    within(card).getByText('Your minimums');
  });

  it('the pitch direction did not change: the brand\'s Pitch settings keep their own promise', () => {
    expect(COPY.brand.whoHint).toBe("Only you see these. Creators who don't match are told they don't meet your criteria.");
    expect(COPY.brand.blockedHint).toBe("Blocked creators see you as not accepting pitches. They aren't told they're blocked.");
  });
});

describe('Brand overview (creator app) — X1 / X2 / X3', () => {
  const brand = { id: 'b1', business_name: 'Urban Threads', category: 'fashion', sub_categories: ['WOMEN'], city: 'Hyderabad' };
  const route = { params: { brandId: 'b1' } };

  it('OK: shows the accepted Aims and modes and an enabled Pitch button (check 1)', async () => {
    influencerApi.getBrandOverview.mockResolvedValue({ success: true, data: { brand,
      pitchSummary: { acceptingLabelState: 'accepting', aims: ['conversion', 'engagement', 'hybrid'], modes: ['visit', 'shipment'], canPitch: true, reason: 'OK' } } });
    const { getByTestId, getByText } = render(<BrandOverviewScreen navigation={nav()} route={route} />);
    await waitFor(() => getByTestId('accepts-card'));
    for (const t of ['Pay for Sale', 'Pay for Content', 'Hybrid', 'Store Visit', 'Remote']) getByText(t);
    expect(getByTestId('pitch-button').props.accessibilityState.disabled).toBe(false);
  });

  it('NOT_ACCEPTING: paused and blocked look identical — banner, button off (checks 5, 6)', async () => {
    influencerApi.getBrandOverview.mockResolvedValue({ success: true, data: { brand,
      pitchSummary: { acceptingLabelState: 'paused', aims: ['conversion'], modes: ['visit'], canPitch: false, reason: 'NOT_ACCEPTING' } } });
    const { getByTestId, getByText, queryByTestId } = render(<BrandOverviewScreen navigation={nav()} route={route} />);
    await waitFor(() => getByTestId('not-accepting-banner'));
    getByText('Not accepting pitches right now');
    getByText('You can still view products and posts.');
    expect(queryByTestId('accepts-card')).toBeNull();
    expect(getByTestId('pitch-button').props.accessibilityState.disabled).toBe(true);
  });

  it('NOT_MATCHING: the criteria banner, no number or list anywhere (check 4)', async () => {
    influencerApi.getBrandOverview.mockResolvedValue({ success: true, data: { brand,
      pitchSummary: { acceptingLabelState: 'accepting', aims: ['conversion', 'hybrid'], modes: ['visit', 'shipment'], canPitch: false, reason: 'NOT_MATCHING' } } });
    const { getByTestId, getByText, toJSON } = render(<BrandOverviewScreen navigation={nav()} route={route} />);
    await waitFor(() => getByTestId('not-matching-banner'));
    getByText("You don't match this brand's pitch criteria");
    getByText('Brands can set things like audience size or city. Growing your profile may change this.');
    expect(getByTestId('pitch-button').props.accessibilityState.disabled).toBe(true);
    expect(JSON.stringify(toJSON())).not.toMatch(/10,?000|min_followers|threshold/i);
  });

  it('⋯ → Block brand → confirm → toast with Undo (X3)', async () => {
    influencerApi.getBrandOverview.mockResolvedValue({ success: true, data: { brand,
      pitchSummary: { acceptingLabelState: 'accepting', aims: ['conversion'], modes: ['visit'], canPitch: true, reason: 'OK' } } });
    influencerApi.blockBrand.mockResolvedValue({ success: true, data: { blocked: true } });
    influencerApi.unblockBrand.mockResolvedValue({ success: true, data: { unblocked: true } });
    const { getByTestId, getByText } = render(<BrandOverviewScreen navigation={nav()} route={route} />);
    await waitFor(() => getByTestId('more-menu'));
    fireEvent.press(getByTestId('more-menu'));
    fireEvent.press(getByText('Block Urban Threads'));
    getByText('Block Urban Threads?');
    getByText("They won't be able to invite you. They won't be told. Collaborations you've already signed carry on.");
    await act(async () => { fireEvent.press(getByTestId('confirm-primary')); });
    await waitFor(() => getByText('Urban Threads blocked.'));
    expect(influencerApi.blockBrand).toHaveBeenCalledWith('b1');
    await act(async () => { fireEvent.press(getByTestId('toast-undo')); });
    expect(influencerApi.unblockBrand).toHaveBeenCalledWith('b1');
  });
});
