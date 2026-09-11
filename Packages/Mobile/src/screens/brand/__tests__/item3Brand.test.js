/**
 * Item 3 — the brand app: A1 reminders and header line, D1 statuses and "Blocked by you",
 * P1/P2 signed line and collaborations, G1 cards, the coming-soon tabs.
 * Contract: features/item3-discovery-profiles-groups
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    getMe: jest.fn(), getPitchSettings: jest.fn(), discoverCreators: jest.fn(), listGroups: jest.fn(), createGroup: jest.fn(),
    getCreatorProfile: jest.fn(), groupsForCreator: jest.fn(), setGroupsForCreator: jest.fn(), workedWith: jest.fn(),
    blockCreator: jest.fn(), unblockCreator: jest.fn(), listBranches: jest.fn(),
  },
  referenceApi: {
    brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'WOMEN', label: 'Women' }, { code: 'KIDS', label: 'Kids' }] } }),
    creatorNiches: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'fashion', label: 'Fashion' }] } }),
    languages: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'Telugu', label: 'Telugu' }] } }),
    states: jest.fn().mockResolvedValue({ success: true, data: { items: [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }] } }),
  },
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); },
}));

const { brandApi } = require('../../../services/api');
const BrandProfileScreen = require('../BrandProfileScreen').default;
const BrandCreatorsScreen = require('../BrandCreatorsScreen').default;
const BrandCreatorProfileScreen = require('../BrandCreatorProfileScreen').default;
const ComingSoonScreen = require('../../../components/shell/ComingSoonScreen').default;
const { fmtCompact, fmtPct, maskPhone, whenLabel } = require('../../../components/discovery/copy3');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const creatorRow = (over = {}) => ({
  id: over.id || 'c1', name: over.name || 'Priya Sharma', avatarUrl: null, instagramHandle: 'priya', youtubeHandle: null, nicheCode: 'fashion', nicheLabel: 'Fashion',
  cityName: 'Hyderabad', stateName: 'Telangana', languages: ['Telugu'], instagram: 48200, youtube: 12000, engagement: 4.2, measuredAt: null,
  acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'], status: 'OK', blockedByYou: false, ...over,
});
const BRAND = { id: 'b1', business_name: 'Urban Threads', logo_url: null, sub_categories: ['WOMEN'], user_status: 'approved' };

beforeEach(() => {
  jest.clearAllMocks();
  brandApi.getPitchSettings.mockResolvedValue(ok({ summary: { labelState: 'accepting', aims: ['conversion'], modes: ['visit'] } }));
});

describe('copy helpers', () => {
  it('formats numbers, percentages and the masked phone the way the mockups show', () => {
    expect(fmtCompact(48200)).toBe('48.2K');
    expect(fmtCompact(1200000)).toBe('1.2M');
    expect(fmtCompact(980)).toBe('980');
    expect(fmtCompact(null)).toBe('—');
    expect(fmtPct(4.2)).toBe('4.2%');
    expect(fmtPct(null)).toBe('—');
    expect(maskPhone('+919876543221')).toBe('98••••••21');
    expect(whenLabel(new Date().toISOString(), () => 'x')).toBe('today');
  });
});

describe('A1 — brand profile', () => {
  it('shows the orange reminders when sub-categories or the main city are missing, and "Fashion" alone (check 20)', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: { ...BRAND, sub_categories: [] }, user_status: 'approved', branches: [], mainCity: null, needsSubCategories: true, needsMainCity: true }));
    const { getByText, getByTestId } = render(<BrandProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('profile-header-line'));
    expect(getByTestId('profile-header-line').props.children).toBe('Fashion');
    getByText('Choose your sub-categories so creators who filter by category can find you.');
    getByText('Add your main branch address so creators can see your city.');
  });

  it('shows "Fashion · City", the chosen sub-categories and no reminders once set', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: BRAND, user_status: 'approved', branches: [{ id: 'x', isMain: true }], mainCity: { id: 10, name: 'Hyderabad' }, needsSubCategories: false, needsMainCity: false }));
    const { queryByText, getByTestId, getByText } = render(<BrandProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('profile-header-line'));
    expect(getByTestId('profile-header-line').props.children).toBe('Fashion · Hyderabad');
    await waitFor(() => getByText('Women'));
    expect(queryByText('Add your main branch address so creators can see your city.')).toBeNull();
    getByText('1 location');
    getByText('Accepting · Pay for Sale · Store Visit');
  });

  it('every row opens its own screen', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: BRAND, user_status: 'approved', branches: [], mainCity: null, needsSubCategories: false, needsMainCity: true }));
    const n = nav();
    const { getByTestId } = render(<BrandProfileScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('row-business-details'));
    fireEvent.press(getByTestId('row-business-details'));
    fireEvent.press(getByTestId('row-branches'));
    fireEvent.press(getByTestId('row-brand-overview'));
    fireEvent.press(getByTestId('row-links'));
    expect(n.navigate).toHaveBeenCalledWith('BrandBusinessDetails');
    expect(n.navigate).toHaveBeenCalledWith('BrandBranches');
    expect(n.navigate).toHaveBeenCalledWith('BrandOwnOverview', { brandId: 'b1' });
    expect(n.navigate).toHaveBeenCalledWith('BrandLinks');
  });
});

describe('D1 — Discover', () => {
  it('renders the four segments, the count, the status chips and "Blocked by you" (checks 1, 31)', async () => {
    brandApi.discoverCreators.mockResolvedValue(ok({ total: 4, page: 1, rows: [
      creatorRow({ id: 'a', name: 'Open One' }),
      creatorRow({ id: 'b', name: 'Paused One', status: 'NOT_ACCEPTING' }),
      creatorRow({ id: 'c', name: 'Mismatch One', status: 'NOT_MATCHING' }),
      creatorRow({ id: 'd', name: 'Blocked One', blockedByYou: true }),
    ] }));
    const { getByText, getAllByText, getByTestId } = render(<BrandCreatorsScreen navigation={nav()} route={{ params: {} }} />);
    ['Discover', 'Groups', 'Pitches', 'Worked with'].forEach(s => getByTestId(`segment-${s}`));
    await waitFor(() => getByText('4 creators'));
    getByText('Not taking invitations');
    getByText('Not open to your brand');
    expect(getAllByText('Blocked by you')).toHaveLength(1);
    expect(getAllByText('48.2K')).toHaveLength(4);
    expect(brandApi.discoverCreators.mock.calls[0][0]).toMatchObject({ openOnly: true, sort: 'followers', page: 1 });
  });

  it('shows the empty state with Clear filters when nothing matches', async () => {
    brandApi.discoverCreators.mockResolvedValue(ok({ total: 0, page: 1, rows: [] }));
    const { getByText, getByTestId } = render(<BrandCreatorsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByText('No creators match these filters'));
    getByText('Try fewer filters or a wider follower range.');
    getByTestId('clear-filters');
  });

  it('Pitches segment is the coming-soon empty state; Groups segment lists cards or the empty state', async () => {
    brandApi.discoverCreators.mockResolvedValue(ok({ total: 0, page: 1, rows: [] }));
    brandApi.listGroups.mockResolvedValue(ok({ groups: [{ id: 'g1', name: 'Diwali', memberCount: 3, openCount: 2, changed: true, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), avatars: [] }] }));
    const { getByText, getByTestId } = render(<BrandCreatorsScreen navigation={nav()} route={{ params: {} }} />);
    fireEvent.press(getByTestId('segment-Pitches'));
    getByText('Pitches are coming soon');
    fireEvent.press(getByTestId('segment-Groups'));
    await waitFor(() => getByText('Diwali'));
    getByText('3 creators · updated today');
    getByText('2 open to invitations');
    getByText('1 group');
  });

  it('Worked with lists both-signed creators with the collaboration line', async () => {
    brandApi.discoverCreators.mockResolvedValue(ok({ total: 0, page: 1, rows: [] }));
    brandApi.workedWith.mockResolvedValue(ok({ total: 1, page: 1, rows: [{ influencerId: 'w1', name: 'Anita Rao', avatarUrl: null, collaborations: 3, lastSignedAt: '2026-09-09T00:00:00Z' }] }));
    const { getByText, getByTestId } = render(<BrandCreatorsScreen navigation={nav()} route={{ params: {} }} />);
    fireEvent.press(getByTestId('segment-Worked with'));
    await waitFor(() => getByText('Anita Rao'));
    getByText('3 collaborations · last signed 9 Sep');
    getByText("Creators you've signed at least one agreement with.");
  });
});

describe('P1 · P2 · P3 — creator profile', () => {
  const base = { influencer: { id: 'c1', full_name: 'Priya Sharma', instagram_handle: 'priya', followers_count: 48200, youtube_subscribers: 12000, engagement_rate: 4.2, niche: ['fashion'], language: ['Telugu'], instagram_url: 'https://instagram.com/priya' },
    inviteSummary: { reason: 'OK', aims: ['conversion', 'engagement'], modes: ['visit'] }, cityName: 'Hyderabad', stateName: 'Telangana', measuredAt: '2026-09-09T00:00:00Z',
    signedCollaborations: 0, signedCollaborationsLabel: null, collaborationsWithYou: [], groups: [], blockedByYou: false };

  it('hides the signed line at zero and shows Measured by INFLX with the date (check 30)', async () => {
    brandApi.getCreatorProfile.mockResolvedValue(ok(base));
    const { queryByTestId, getByTestId, getByText } = render(<BrandCreatorProfileScreen navigation={nav()} route={{ params: { influencerId: 'c1' } }} />);
    await waitFor(() => getByTestId('open-to-card'));
    expect(queryByTestId('signed-line')).toBeNull();
    expect(getByTestId('measured-line').props.children).toBe('Measured by INFLX · updated 9 Sep');
    getByText('Open to invitations for');
    expect(getByTestId('invite-button').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(getByTestId('invite-button'));
    await waitFor(() => getByText('Inviting creators comes with campaigns. Coming soon.'));
  });

  it('P2: the signed line, the groups line and this brand\'s collaborations with their state', async () => {
    brandApi.getCreatorProfile.mockResolvedValue(ok({ ...base, signedCollaborations: 2, signedCollaborationsLabel: '2 collaborations signed on INFLX', groups: [{ id: 'g', name: 'Diwali' }],
      collaborationsWithYou: [{ id: 'x', campaignName: 'Summer', setName: 'Stories', aim: 'conversion', signedAt: '2026-09-08T00:00:00Z', status: 'active', stateFamily: 'active', stateLabel: 'Active' }] }));
    const { getByTestId, getByText } = render(<BrandCreatorProfileScreen navigation={nav()} route={{ params: { influencerId: 'c1' } }} />);
    await waitFor(() => getByTestId('signed-line'));
    getByText('2 collaborations signed on INFLX');
    getByText('In your groups: Diwali');
    getByText('Summer · Stories');
    getByText('Pay for Sale · signed 8 Sep');
    getByText('Active');
  });

  it('P3: not open to your brand → banner, Invite off; blocked by you → grey chip and Unblock in the menu (check 31)', async () => {
    brandApi.getCreatorProfile.mockResolvedValue(ok({ ...base, inviteSummary: { reason: 'NOT_MATCHING', aims: [], modes: [] }, blockedByYou: true }));
    const { getByTestId, getByText } = render(<BrandCreatorProfileScreen navigation={nav()} route={{ params: { influencerId: 'c1' } }} />);
    await waitFor(() => getByTestId('not-open-banner'));
    getByText("Priya isn't taking invitations from brands like yours right now.");
    expect(getByTestId('invite-button').props.accessibilityState.disabled).toBe(true);
    getByTestId('blocked-chip');
    fireEvent.press(getByTestId('more-menu'));
    getByText('Unblock Priya Sharma');
  });
});

describe('A6 — coming soon', () => {
  it('uses the prompt copy and the button jumps to Creators', () => {
    const n = nav();
    const { getByText, getByTestId } = render(<ComingSoonScreen navigation={n} route={{ params: { kind: 'brandCampaigns', tabTitle: 'Campaigns' } }} />);
    getByText('Campaigns are coming soon');
    getByText("You'll create campaigns and sets here. Meanwhile, explore creators and set up your profile.");
    fireEvent.press(getByTestId('coming-soon-button'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorsTab');
  });
});
