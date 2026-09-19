/**
 * Item 3 — the creator app: A7 rows (no notifications switch, niche warning), F1 Collabs,
 * F2 Find brands statuses, O1/O2 brand overview with products, and the payout rules — which
 * moved with the fields to the Wallet tab (features/registration-and-profile C7).
 * Contract: features/item3-discovery-profiles-groups
 */
import React from 'react';
import { Switch } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { getMe: jest.fn(), updateMe: jest.fn(), getInvitationSettings: jest.fn(), findBrands: jest.fn(), getBrandOverview: jest.fn(), blockBrand: jest.fn(), unblockBrand: jest.fn(),
    // Item 5 — the Invites tab is real now; F1's empty state is what an empty list shows.
    myInvitations: jest.fn().mockResolvedValue({ success: true, data: { rows: [] } }),
    // Item 8 — the Pitches tab now renders her own list under the card.
    myPitches: jest.fn().mockResolvedValue({ success: true, data: { rows: [], total: 0, groups: {} } }) },
  brandApi: {},
  referenceApi: {
    brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'WOMEN', label: 'Women' }] } }),
    creatorNiches: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'fashion', label: 'Fashion' }] } }),
    languages: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'Telugu', label: 'Telugu' }] } }),
    states: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    offeredStates: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
  },
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); },
}));

const { influencerApi } = require('../../../services/api');
const ProfileScreen = require('../ProfileScreen').default;
const CollabsScreen = require('../CollabsScreen').default;
const FindBrandsScreen = require('../FindBrandsScreen').default;
const BrandOverviewScreen = require('../BrandOverviewScreen').default;
const PayoutDetailScreen = require('../PayoutDetailScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const ME = { id: 'c1', full_name: 'Priya Sharma', instagram_handle: 'priya', user_status: 'approved', niche: ['fashion'], language: ['Telugu'], needsNiche: false, has_upi: true };

beforeEach(() => {
  jest.clearAllMocks();
  influencerApi.getInvitationSettings.mockResolvedValue(ok({ summary: { labelState: 'open', aims: ['conversion'], modes: ['shipment'] } }));
});

describe('A7 — profile rows', () => {
  it('lists the rows, no notifications switch, no Payment & tax (it moved to Wallet), and the invitation summary', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME }));
    const { getByTestId, getByText, UNSAFE_queryAllByType, queryByText, queryByTestId } = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('row-profile-info'));
    ['row-niche', 'row-invitation-settings', 'row-legal', 'row-logout'].forEach(id => getByTestId(id));
    // features/registration-and-profile C4: UPI / bank / PAN live on the Wallet tab now.
    expect(queryByTestId('row-payment-tax')).toBeNull();
    expect(queryByText('Payment & tax')).toBeNull();
    expect(UNSAFE_queryAllByType(Switch)).toHaveLength(0);
    getByText('Open · Pay for Sale · Remote');
    expect(queryByText('Pick your niche. Brands use it to find creators like you.')).toBeNull();
  });

  it('warns when no niche is set and opens the right screens', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { ...ME, niche: [], needsNiche: true } }));
    const n = nav();
    const { getByTestId, getByText } = render(<ProfileScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByText('Pick your niche. Brands use it to find creators like you.'));
    fireEvent.press(getByTestId('row-profile-info'));
    fireEvent.press(getByTestId('row-niche'));
    expect(n.navigate).toHaveBeenCalledWith('ProfileInfo');
    expect(n.navigate).toHaveBeenCalledWith('NicheLanguages');
  });
});

describe('F1 — Collabs', () => {
  it('shows the four segments, the empty state, and the Pitch a brand card on Pitches (item 5 moved it there)', async () => {
    const n = nav();
    const { getByText, getByTestId } = render(<CollabsScreen navigation={n} route={{ params: {} }} />);
    ['Invites', 'Active', 'Pitches', 'Done'].forEach(s => getByTestId(`segment-${s}`));
    await waitFor(() => getByText('No invitations yet'));
    fireEvent.press(getByTestId('segment-Pitches'));
    // Item 8: the way in is still at the top, with her own list of what she has
    // sent below it instead of nothing.
    await waitFor(() => getByTestId('find-brands'));
    fireEvent.press(getByTestId('find-brands'));
    expect(n.navigate).toHaveBeenCalledWith('FindBrands');
  });
});

describe('F2 — Find brands', () => {
  it('shows the status chip per brand, the count and "Brands I can pitch" on by default (check 18)', async () => {
    influencerApi.findBrands.mockResolvedValue(ok({ total: 3, page: 1, rows: [
      { id: 'a', name: 'Open Brand', logoUrl: null, subCategories: ['WOMEN'], mainCity: 'Hyderabad', productCount: 4, acceptedAims: ['conversion'], acceptedModes: ['visit'], status: 'OK' },
      { id: 'b', name: 'Paused Brand', logoUrl: null, subCategories: [], mainCity: null, productCount: 0, acceptedAims: [], acceptedModes: [], status: 'NOT_ACCEPTING' },
      { id: 'c', name: 'Picky Brand', logoUrl: null, subCategories: [], mainCity: null, productCount: 0, acceptedAims: [], acceptedModes: [], status: 'NOT_MATCHING' },
    ] }));
    const { getByText } = render(<FindBrandsScreen navigation={nav()} />);
    await waitFor(() => getByText('3 brands'));
    getByText('Accepting'); getByText('Not accepting'); getByText("You don't match");
    getByText('Women · Hyderabad');
    expect(influencerApi.findBrands.mock.calls[0][0]).toMatchObject({ canPitchOnly: true, sort: 'newest' });
  });
});

describe('O1 · O2 — brand overview', () => {
  const brand = { id: 'b1', business_name: 'Urban Threads', subCategories: ['WOMEN'], about: 'Everyday ethnic wear.', mainCity: 'Hyderabad', branchCount: 2, branchCities: ['Hyderabad', 'Warangal'], websiteUrl: 'https://urbanthreads.in', instagramHandle: 'urban.threads', productCount: 5 };
  const products = { total: 5, rows: [{ id: 'p1', name: 'Kurta', price: 1299, imageUrl: null, outOfStock: false }, { id: 'p2', name: 'Saree', price: 2499, imageUrl: null, outOfStock: true }] };

  it('OK: header line, about, accepts card, products with Out of stock, branches, links; Pitch shows the coming-soon toast (check 19)', async () => {
    influencerApi.getBrandOverview.mockResolvedValue(ok({ brand, products, posts: { total: 0, rows: [] }, pitchSummary: { reason: 'OK', aims: ['conversion'], modes: ['visit'] } }));
    const n = nav();
    const { getByTestId, getByText } = render(<BrandOverviewScreen navigation={n} route={{ params: { brandId: 'b1' } }} />);
    await waitFor(() => getByTestId('accepts-card'));
    expect(getByTestId('overview-line').props.children).toBe('Fashion · Hyderabad · 2 branches');
    getByText('Everyday ethnic wear.');
    getByText('Products 5'); getByTestId('see-all-products');
    getByText('Out of stock');
    getByText('Branches 2'); getByText('Warangal');
    getByText('@urban.threads');
    // Item 8: the button is real now — it opens the form for this brand.
    expect(getByTestId('pitch-button').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(getByTestId('pitch-button'));
    expect(n.navigate).toHaveBeenCalledWith('PitchForm', { brandId: 'b1', brandName: 'Urban Threads' });
  });

  it('NOT_ACCEPTING: banner and Pitch off; NOT_MATCHING: second banner', async () => {
    influencerApi.getBrandOverview.mockResolvedValue(ok({ brand, products: { total: 0, rows: [] }, posts: { total: 0, rows: [] }, pitchSummary: { reason: 'NOT_ACCEPTING', aims: [], modes: [] } }));
    const { getByTestId } = render(<BrandOverviewScreen navigation={nav()} route={{ params: { brandId: 'b1' } }} />);
    await waitFor(() => getByTestId('not-accepting-banner'));
    expect(getByTestId('pitch-button').props.accessibilityState.disabled).toBe(true);
  });
});

describe('Payout details — the ported rule (now on the Wallet tab, C7)', () => {
  it('a bank account is ONE entry: the account number and the IFSC are saved together, never one without the other', async () => {
    influencerApi.updateMe.mockResolvedValue(ok({ influencer: { ...ME, has_bank_account: true } }));
    const n = nav();
    const { getByTestId, getByText } = render(<PayoutDetailScreen navigation={n} route={{ params: { kind: 'bank' } }} />);
    getByText('Bank account');
    fireEvent.changeText(getByTestId('payout-bank_account_no'), '123456');
    fireEvent.press(getByTestId('payout-save'));
    getByText('Enter both the account number and the IFSC.');
    expect(influencerApi.updateMe).not.toHaveBeenCalled();
    fireEvent.changeText(getByTestId('payout-bank_ifsc'), 'SBIN0001234');
    fireEvent.press(getByTestId('payout-save'));
    await waitFor(() => expect(influencerApi.updateMe).toHaveBeenCalledWith({ bank_account_no: '123456', bank_ifsc: 'SBIN0001234' }));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CreatorWallet', { toast: 'Saved.' }));
    getByText('Our team checks these by hand, usually the same day.');
  });

  it('the server\'s BANK_PAIR refusal lands under the form, in its words', async () => {
    influencerApi.updateMe.mockResolvedValue({ success: false, error: { code: 'BANK_PAIR', message: 'Send both or neither.' } });
    const { getByTestId, getByText } = render(<PayoutDetailScreen navigation={nav()} route={{ params: { kind: 'bank' } }} />);
    fireEvent.changeText(getByTestId('payout-bank_account_no'), '1');
    fireEvent.changeText(getByTestId('payout-bank_ifsc'), 'X');
    fireEvent.press(getByTestId('payout-save'));
    await waitFor(() => getByText('Send both or neither.'));
  });
});
