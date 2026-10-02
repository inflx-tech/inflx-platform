/**
 * ui-walk-fixes D4 (frame B9) — no blank strip above any title — on the main pages themselves.
 *
 * useTopInset.test.js checks the helper, the shared Header, and that each main page's SOURCE asks
 * the helper. A source check passes when one of a page's top bands uses the helper; several pages
 * have two (the Wallet draws one title while loading and another inside its scrolling page, the
 * Profile pages and Create draw the title in the loading and the loaded screen). This file renders
 * every main page of both apps in each of its states, on a phone whose status bar is opaque
 * (inset 0) and on one that draws edge to edge (inset 30), and measures the space above the title:
 * the phone's inset plus 8, never the old 50–54, never less than the inset.
 *
 * jest cannot see a status bar; that the title really sits under it is the device walk (check 4a).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children, ...rest }) => mockReact.createElement(View, rest, children);
  return { SafeAreaProvider: Passthrough, SafeAreaView: Passthrough, useSafeAreaInsets: () => mockInsets };
});
jest.mock('../../services/api', () => ({
  brandApi: {
    campaignsSummary: jest.fn(), getPool: jest.fn(), discoverCreators: jest.fn(), listGroups: jest.fn(), workedWith: jest.fn(),
    getWallet: jest.fn(), getMe: jest.fn(), getPitchSettings: jest.fn(), submitForReview: jest.fn(), pitchInbox: jest.fn(),
  },
  influencerApi: {
    myInvitations: jest.fn(), getWallet: jest.fn(), getMe: jest.fn(), getInvitationSettings: jest.fn(), getMySocial: jest.fn(),
    uploadProbeStatus: jest.fn(), createHome: jest.fn(), createPost: jest.fn(), myPitches: jest.fn(), submitForReview: jest.fn(),
  },
  referenceApi: {
    creatorNiches: jest.fn(), languages: jest.fn(), states: jest.fn(), brandCategories: jest.fn(),
  },
  clearSession: jest.fn(), uploadFile: jest.fn(), emitAccountGate: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));
jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn().mockResolvedValue(''), setString: jest.fn() }));

const { brandApi, influencerApi, referenceApi } = require('../../services/api');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const fail = { success: false, error: { code: 'INTERNAL_ERROR', message: 'no' } };
const never = () => new Promise(() => {});

/**
 * The space above a title: every bit of top padding between the top of the screen and the text —
 * the title's own, and that of each view it sits in.
 */
function spaceAbove(node) {
  const topPad = (style) => {
    const st = StyleSheet.flatten(style) || {};
    const pad = st.paddingTop != null ? st.paddingTop : st.paddingVertical != null ? st.paddingVertical : st.padding;
    return typeof pad === 'number' ? pad : 0;
  };
  let total = 0;
  for (let n = node; n; n = n.parent) {
    if (typeof n.type !== 'string') continue;
    // a scrolling page pads its content, not itself (under jest the scroll view keeps that style as a prop)
    total += topPad(n.props.style) + topPad(n.props.contentContainerStyle);
  }
  return total;
}

function everythingLoads() {
  referenceApi.creatorNiches.mockResolvedValue(ok({ items: [] }));
  referenceApi.languages.mockResolvedValue(ok({ items: [] }));
  referenceApi.states.mockResolvedValue(ok({ items: [] }));
  referenceApi.brandCategories.mockResolvedValue(ok({ items: [] }));
  brandApi.campaignsSummary.mockResolvedValue(ok({ campaigns: [] }));
  brandApi.getPool.mockResolvedValue(ok({ total: 0 }));
  brandApi.discoverCreators.mockResolvedValue(ok({ total: 0, page: 1, rows: [] }));
  brandApi.getWallet.mockResolvedValue(ok({ withdrawal_waiting: null, figures: { available: 37040, onHold: 0, locked: 9000, lockedCount: 1, salesComing: 0, salesComingCount: 0 } }));
  brandApi.getMe.mockResolvedValue(ok({ user_status: 'approved', completeness: null, branches: [], brand: { id: 'b1', business_name: 'Urban Threads', sub_categories: [], gstin: null, has_bank_account: false } }));
  brandApi.getPitchSettings.mockResolvedValue(ok({ summary: null }));
  influencerApi.myInvitations.mockResolvedValue(ok({ rows: [] }));
  influencerApi.getWallet.mockResolvedValue(ok({ withdrawal_waiting: null, details: {}, figures: { available: 1200, onHold: 0, stillToCome: 0, payments: 0, paymentsCount: 0, nextPaymentAt: null, commission: 0, commissionCount: 0 } }));
  influencerApi.getMe.mockResolvedValue(ok({ user_status: 'approved', completeness: null, influencer: { full_name: 'Priya Sharma', instagram_handle: 'priya', niche: ['fashion'] } }));
  influencerApi.getInvitationSettings.mockResolvedValue(ok({ summary: null }));
  influencerApi.getMySocial.mockResolvedValue({ success: false });
  influencerApi.uploadProbeStatus.mockResolvedValue({ success: false });
  influencerApi.createHome.mockResolvedValue(ok({ needs: [], can_post: true, store_link: 'inflx.in/s/priya', total: 0, recent: [], collections: 0 }));
}
function nothingAnswers() {
  for (const api of [brandApi, influencerApi, referenceApi]) for (const fn of Object.values(api)) fn.mockImplementation(never);
}
function everythingFails() {
  for (const api of [brandApi, influencerApi, referenceApi]) for (const fn of Object.values(api)) fn.mockResolvedValue(fail);
}

/**
 * Each main page: how to draw it, its title, and how to know each state has arrived.
 * `failed: null` — the page has no title when it cannot load (the Profile pages show a centred
 * "couldn't load" message with a Try again button, nothing at the top).
 */
const PAGES = [
  {
    label: 'brand · Campaigns', title: 'Campaigns',
    make: () => require('../../screens/brand/BrandCampaignsScreen').default,
    loaded: (r) => r.getByTestId('campaigns-empty'), failed: (r) => r.getByText('Campaigns') && expect(brandApi.campaignsSummary).toHaveBeenCalled(),
  },
  {
    label: 'brand · Creators', title: 'Creators',
    make: () => require('../../screens/brand/BrandCreatorsScreen').default,
    loaded: () => expect(brandApi.discoverCreators).toHaveBeenCalled(), failed: () => expect(brandApi.discoverCreators).toHaveBeenCalled(),
  },
  {
    label: 'brand · Wallet', title: 'Wallet',
    make: () => require('../../screens/brand/BrandWalletScreen').default,
    loading: (r) => r.getByTestId('wallet-loading'), loaded: (r) => r.getByTestId('brand-wallet'), failed: (r) => r.getByTestId('wallet-error'),
  },
  {
    label: 'brand · Profile', title: 'Profile',
    make: () => require('../../screens/brand/BrandProfileScreen').default,
    loaded: (r) => r.getByTestId('brand-profile'), failed: null,
  },
  {
    label: 'creator · Collabs', title: 'Collabs',
    make: () => require('../../screens/influencer/CollabsScreen').default,
    loaded: (r) => r.getByTestId('collabs-invites'), failed: () => expect(influencerApi.myInvitations).toHaveBeenCalled(),
  },
  {
    label: 'creator · Create', title: 'Create',
    make: () => require('../../screens/create/CreateHomeScreen').default,
    loaded: (r) => r.getByTestId('create-home'), failed: () => expect(influencerApi.createHome).toHaveBeenCalled(),
  },
  {
    label: 'creator · Wallet', title: 'Wallet',
    make: () => require('../../screens/influencer/CreatorWalletScreen').default,
    loading: (r) => r.getByTestId('creator-wallet-loading'), loaded: (r) => r.getByTestId('creator-wallet'), failed: (r) => r.getByTestId('creator-wallet-error'),
  },
  {
    label: 'creator · Profile', title: 'Profile',
    make: () => require('../../screens/influencer/ProfileScreen').default,
    loaded: (r) => r.getByTestId('creator-profile-main'), failed: null,
  },
];

describe.each([[0, 8], [30, 38]])('top inset %i → %i points above every main page\'s title', (inset, want) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsets = { top: inset, bottom: 0, left: 0, right: 0 };
  });

  it.each(PAGES)('$label — while loading', (page) => {
    nothingAnswers();
    const Screen = page.make();
    const r = render(<Screen navigation={nav()} route={{ params: {} }} />);
    if (page.loading) page.loading(r);
    expect([page.label, spaceAbove(r.getByText(page.title))]).toEqual([page.label, want]);
  });

  it.each(PAGES)('$label — loaded', async (page) => {
    everythingLoads();
    const Screen = page.make();
    const r = render(<Screen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => page.loaded(r));
    expect([page.label, spaceAbove(r.getByText(page.title))]).toEqual([page.label, want]);
  });

  it.each(PAGES.filter((p) => p.failed))('$label — when it could not load', async (page) => {
    everythingFails();
    const Screen = page.make();
    const r = render(<Screen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => page.failed(r));
    expect([page.label, spaceAbove(r.getByText(page.title))]).toEqual([page.label, want]);
  });

  it('the Home tab of an account still under review: the same, loading and loaded', async () => {
    const PendingHomeScreen = require('../../components/shell/PendingHomeScreen').default;
    const { _resetFinishProfileSheet } = require('../../components/shell/PendingHomeScreen');
    _resetFinishProfileSheet();
    const route = { params: { kind: 'creatorHome', tabTitle: 'Home' } };

    nothingAnswers();
    let r = render(<PendingHomeScreen navigation={nav()} route={route} />);
    r.getByTestId('pending-home-loading');
    expect(spaceAbove(r.getByText('Home'))).toBe(want);
    r.unmount();

    influencerApi.getMe.mockResolvedValue(ok({ user_status: 'pending', completeness: { done: 10, total: 10, missing: [], missing_labels: [] } }));
    r = render(<PendingHomeScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('pending-home-creator'));
    expect(spaceAbove(r.getByText('INFLX'))).toBe(want);
    r.unmount();

    // approved → the Home placeholder, which asks the helper too
    influencerApi.getMe.mockResolvedValue(ok({ user_status: 'approved', completeness: null }));
    r = render(<PendingHomeScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('coming-soon-creatorHome'));
    expect(spaceAbove(r.getByText('Home'))).toBe(want);
  });
});

// D3, on the same shell: which of the pending Home's cards put the tab's main page underneath.
describe('the pending Home\'s cards (creator)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }; });

  it('"How collaborations work" opens in Profile with the main page underneath; "Brands on INFLX" jumps into the locked tab as before', async () => {
    const PendingHomeScreen = require('../../components/shell/PendingHomeScreen').default;
    influencerApi.getMe.mockResolvedValue(ok({ user_status: 'pending', completeness: { done: 10, total: 10, missing: [], missing_labels: [] } }));
    const n = nav();
    const r = render(<PendingHomeScreen navigation={n} route={{ params: { kind: 'creatorHome', tabTitle: 'Home' } }} />);
    await waitFor(() => r.getByTestId('pending-home-creator'));

    fireEvent.press(r.getByTestId('pending-card-how'));
    expect(n.navigate).toHaveBeenLastCalledWith('ProfileTab', { screen: 'LegalList', initial: false });

    fireEvent.press(r.getByTestId('pending-card-brands'));
    expect(n.navigate).toHaveBeenLastCalledWith('CollabsTab', { screen: 'FindBrands' });
  });
});
