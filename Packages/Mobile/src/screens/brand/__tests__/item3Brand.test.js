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
    // ui-walk-fixes board B — "Add creators" to a group (frame B6).
    getGroup: jest.fn(), addGroupMembers: jest.fn(),
    // Item 8 — the Pitches segment renders the real inbox.
    pitchInbox: jest.fn().mockResolvedValue({ success: true, data: { total: 0, unread: 0, order: [], groups: {} } }),
  },
  referenceApi: {
    brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'WOMEN', label: 'Women' }, { code: 'KIDS', label: 'Kids' }] } }),
    creatorNiches: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'fashion', label: 'Fashion' }] } }),
    languages: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'Telugu', label: 'Telugu' }] } }),
    states: jest.fn().mockResolvedValue({ success: true, data: { items: [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }] } }),
    offeredStates: jest.fn().mockResolvedValue({ success: true, data: { items: [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }] } }),
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
  // features/registration-and-profile B3: the orange reminders became the amber "N things left"
  // note plus a red dot on each row that owns a missing item, and "Submit for review" is the gate.
  it('a pending, incomplete brand: "Fashion" alone, "3 things left", dots on the rows that own them, Submit disabled with the hint (check 20)', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: { ...BRAND, sub_categories: [], user_status: 'pending' }, user_status: 'pending', branches: [], mainCity: null,
      completeness: { total: 10, done: 7, complete: false, missing: ['sub_categories', 'state', 'city'], missing_labels: ['what you sell', 'state', 'nearest major city'] } }));
    const { getByText, getByTestId, queryByTestId } = render(<BrandProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('profile-header-line'));
    expect(getByTestId('profile-header-line').props.children).toBe('Fashion');
    getByText('Under review');
    getByText('3 things left');
    getByText('What you sell, state, nearest major city');
    getByTestId('row-sub-categories-dot'); getByTestId('row-branches-dot');
    expect(queryByTestId('row-business-details-dot')).toBeNull();
    expect(getByTestId('submit-for-review').props.accessibilityState.disabled).toBe(true);
    getByText('Finish the 3 items above to submit');
  });

  it('approved and complete: "Fashion · City", the chosen sub-categories, no note, no dots, no submit block', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: BRAND, user_status: 'approved', branches: [{ id: 'x', isMain: true }], mainCity: { id: 10, name: 'Hyderabad' },
      completeness: { total: 10, done: 10, complete: true, missing: [], missing_labels: [] } }));
    const { queryByText, getByTestId, getByText, queryByTestId } = render(<BrandProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('profile-header-line'));
    expect(getByTestId('profile-header-line').props.children).toBe('Fashion · Hyderabad');
    await waitFor(() => getByText('Women'));
    expect(queryByText(/things left/)).toBeNull();
    expect(queryByTestId('row-branches-dot')).toBeNull();
    expect(queryByTestId('submit-for-review')).toBeNull();
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
    // creator-distance-and-visit-preference: nearest first is the default sort, anywhere the default reach.
    expect(brandApi.discoverCreators.mock.calls[0][0]).toMatchObject({ openOnly: true, sort: 'distance', within: 'any', page: 1 });
  });

  it('shows the empty state with Clear filters when nothing matches', async () => {
    brandApi.discoverCreators.mockResolvedValue(ok({ total: 0, page: 1, rows: [] }));
    const { getByText, getByTestId } = render(<BrandCreatorsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByText('No creators match these filters'));
    getByText('Try fewer filters or a wider follower range.');
    getByTestId('clear-filters');
  });

  it('Pitches segment is the real inbox (item 8); Groups segment lists cards or the empty state', async () => {
    brandApi.discoverCreators.mockResolvedValue(ok({ total: 0, page: 1, rows: [] }));
    brandApi.listGroups.mockResolvedValue(ok({ groups: [{ id: 'g1', name: 'Diwali', memberCount: 3, openCount: 2, changed: true, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), avatars: [] }] }));
    const { getByText, getByTestId } = render(<BrandCreatorsScreen navigation={nav()} route={{ params: {} }} />);
    fireEvent.press(getByTestId('segment-Pitches'));
    // Item 8: no longer a placeholder. With no pitches it is the real empty state.
    await waitFor(() => getByTestId('pitch-inbox-empty'));
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
    await waitFor(() => getByText('Inviting creators is coming soon.'));
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
    const { getByText, getByTestId } = render(<ComingSoonScreen navigation={n} route={{ params: { kind: 'brandHome', tabTitle: 'Home' } }} />);
    getByText('Home is coming soon');
    getByText('Your to-dos across campaigns and creators will show here.');
    fireEvent.press(getByTestId('coming-soon-button'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorsTab');
  });
});

/**
 * ui-walk-fixes board B (locked 2 Oct 2026) — frame B8 (Creators › Discover) and frame B6
 * ("Add creators" to a group). Expected-outputs checks 5 and 6.
 * Contract: features/ui-walk-fixes
 */
describe('ui-walk-fixes board B — Discover and the group picker', () => {
  const { Keyboard, StyleSheet } = require('react-native');
  const { within } = require('@testing-library/react-native');
  const { settingsTokens: T } = require('../../../theme/tokens');
  const BrandGroupAddCreatorsScreen = require('../BrandGroupAddCreatorsScreen').default;
  const flat = (el) => StyleSheet.flatten(el.props.style) || {};
  const says = (el, text) => within(el).getByText(text);
  const lastList = () => brandApi.discoverCreators.mock.calls.filter(c => !c[0].countOnly).pop()[0];

  let pad, errorSpy;
  beforeEach(() => {
    const handlers = { keyboardDidShow: [], keyboardDidHide: [] };
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, fn) => {
      (handlers[event] = handlers[event] || []).push(fn);
      return { remove: () => { handlers[event] = handlers[event].filter(f => f !== fn); } };
    });
    pad = {
      show: () => act(() => { handlers.keyboardDidShow.forEach(f => f({ endCoordinates: { height: 280 } })); }),
      hide: () => act(() => { handlers.keyboardDidHide.forEach(f => f()); }),
      restore: () => spy.mockRestore(),
    };
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    const said = errorSpy.mock.calls.map(c => String(c[0]));
    errorSpy.mockRestore();
    pad.restore();
    expect(said).toEqual([]);
  });

  it('B8: Creators › Discover has the one control row — search + Filters — and the FULL creator card, unchanged', async () => {
    brandApi.discoverCreators.mockResolvedValue(ok({ total: 2, page: 1, rows: [
      creatorRow({ id: 'a', name: 'Priya Sharma', distance_km: 32, languages: ['Telugu', 'English'] }),
      creatorRow({ id: 'b', name: 'Sneha N.', acceptedAims: ['conversion'], acceptedModes: ['visit'] }),
    ] }));
    const { getByTestId, getByText, getAllByText, queryByTestId, queryByText } = render(<BrandCreatorsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByText('2 creators'));
    // The one row, and nothing of the chips row.
    expect(flat(getByTestId('discover-controls')).flexDirection).toBe('row');
    getByTestId('discover-search');
    says(getByTestId('open-filters'), 'Filters');
    expect(queryByTestId('quick-open')).toBeNull();
    expect(queryByText('Open to invitations')).toBeNull();
    expect(queryByText('Clear all')).toBeNull();
    getByText('Nearest first ▾');
    // "Open to invitations only" is inside Filters, and still on.
    expect(lastList()).toMatchObject({ openOnly: true });
    // The card does not change here: the browse card (not a tick row), its place line, the three
    // labelled numbers, the Aim / mode tags and the add-to-group button.
    getByTestId('creator-a'); getByTestId('add-to-group-a');
    expect(queryByTestId('select-a')).toBeNull(); expect(queryByTestId('tick-a')).toBeNull();
    getByText('Fashion · Hyderabad · 32 km · Telugu, English');
    expect(getAllByText('48.2K')).toHaveLength(2); expect(getAllByText('Instagram')).toHaveLength(2);
    expect(getAllByText('12.0K')).toHaveLength(2); expect(getAllByText('YouTube')).toHaveLength(2);
    expect(getAllByText('4.2%')).toHaveLength(2); expect(getAllByText('Engagement')).toHaveLength(2);
    expect(getAllByText('Pay for Sale')).toHaveLength(2);
    getByText('Pay for Content'); getByText('Hybrid'); getByText('Remote'); expect(getAllByText('📍 Store Visit')).toHaveLength(2);
    expect(queryByText(/ IG · /)).toBeNull();
    // And the switch really is in the sheet, on.
    fireEvent.press(getByTestId('open-filters'));
    await waitFor(() => getByTestId('filters-sheet'));
    getByText('Open to invitations only');
    expect(getByTestId('filter-openonly').props.value).toBe(true);
    await waitFor(() => expect(getByTestId('filters-apply').props.accessibilityState.disabled).toBe(false));
  });

  describe('B6 — Add creators to a group', () => {
    const GROUP = { group: { id: 'g1', name: 'Diwali shortlist', memberCount: 12, capacityLeft: 88 }, memberIds: ['m'] };
    const ROWS = [
      creatorRow({ id: 'm', name: 'Priya Sharma' }),
      creatorRow({ id: 's', name: 'Sneha N.', cityName: 'Eluru', distance_km: 58, languages: ['Telugu'], instagram: 18400, youtube: 6300, engagement: 5.1 }),
      creatorRow({ id: 'l', name: 'Lakshmi M.', status: 'NOT_ACCEPTING' }),
    ];
    const open = (n = nav()) => render(<BrandGroupAddCreatorsScreen navigation={n} route={{ params: { groupId: 'g1', groupName: 'Diwali shortlist' } }} />);
    beforeEach(() => {
      brandApi.getGroup.mockResolvedValue(ok(GROUP));
      brandApi.discoverCreators.mockResolvedValue(ok({ total: 3, page: 1, rows: ROWS }));
    });

    it('the title bar carries "Adding to … · N creators"; one control row; "Open to invitations only" starts OFF', async () => {
      const { getByTestId, getByText, queryByTestId, queryByText } = open();
      await waitFor(() => getByTestId('select-s'));
      expect(getByTestId('group-add-subline').props.children).toBe('Adding to Diwali shortlist · 12 creators');
      expect(getByTestId('group-add-subline').props.numberOfLines).toBe(1);
      getByText('Add creators');
      expect(flat(getByTestId('discover-controls')).flexDirection).toBe('row');
      says(getByTestId('open-filters'), 'Filters');
      expect(queryByTestId('quick-open')).toBeNull();
      expect(queryByText('Open to invitations')).toBeNull();
      expect(lastList()).toMatchObject({ openOnly: false, sort: 'distance', within: 'any', page: 1 });
      fireEvent.press(getByTestId('open-filters'));
      await waitFor(() => getByTestId('filters-sheet'));
      expect(getByTestId('filter-openonly').props.value).toBe(false);
      // Turning it on is one filter; the button counts it and the count line offers "Clear all".
      fireEvent(getByTestId('filter-openonly'), 'valueChange', true);
      await waitFor(() => expect(getByTestId('filters-apply').props.accessibilityState.disabled).toBe(false));
      await act(async () => { fireEvent.press(getByTestId('filters-apply')); });
      await waitFor(() => expect(lastList()).toMatchObject({ openOnly: true }));
      await waitFor(() => getByTestId('select-s'));
      says(getByTestId('open-filters'), 'Filters · 1');
      await act(async () => { fireEvent.press(getByText('Clear all')); });
      await waitFor(() => expect(lastList()).toMatchObject({ openOnly: false }));
      await waitFor(() => getByTestId('select-s'));
      says(getByTestId('open-filters'), 'Filters');
      expect(queryByText('Clear all')).toBeNull();
    });

    it('the compact three-line row: name, place line, the three numbers, no tags; a member is ticked and greyed; "Not taking invitations" sits under her numbers and she can still be added', async () => {
      brandApi.addGroupMembers.mockResolvedValue(ok({ added: 2 }));
      const n = nav();
      const { getByTestId, getByText, queryByText, queryByTestId } = open(n);
      await waitFor(() => getByTestId('select-s'));
      // A creator you can tick: three lines, each cut with … when long.
      expect(getByTestId('pick-name-s').props.children).toBe('Sneha N.');
      expect(getByTestId('pick-line-s').props.children).toBe('Fashion · Eluru · 58 km · Telugu');
      expect(getByTestId('pick-numbers-s').props.children).toBe('18.4K IG · 6.3K YT · 5.1% eng');
      for (const id of ['pick-name-s', 'pick-line-s', 'pick-numbers-s']) expect(getByTestId(id).props.numberOfLines).toBe(1);
      // No tag line and no labelled numbers (D1).
      for (const t of ['Pay for Sale', 'Pay for Content', 'Hybrid', '📍 Store Visit', 'Remote', 'Instagram', 'YouTube', 'Engagement']) expect(queryByText(t)).toBeNull();
      // Already in the group: ticked, locked, face and name greyed, the line says so, no numbers.
      expect(getByTestId('select-m').props.accessibilityState).toMatchObject({ checked: true, disabled: true });
      expect(getByTestId('pick-line-m').props.children).toBe('Already in this group');
      expect(flat(getByTestId('pick-name-m')).opacity).toBe(0.5);
      expect(flat(getByTestId('pick-line-m')).opacity).toBeUndefined();
      expect(flat(getByTestId('tick-m')).backgroundColor).toBe(T.surface);
      expect(queryByTestId('pick-numbers-m')).toBeNull();
      // Not taking invitations: all three lines, the chip under them, and still tickable.
      getByTestId('pick-numbers-l');
      says(getByTestId('select-l'), 'Not taking invitations');
      expect(getByTestId('select-l').props.accessibilityState).toMatchObject({ checked: false, disabled: false });
      // The capacity line counts down as you tick, as before.
      getByText('Diwali shortlist can take 88 more creators.');
      fireEvent.press(getByTestId('select-s'));
      fireEvent.press(getByTestId('select-l'));
      expect(getByTestId('select-s').props.accessibilityState.checked).toBe(true);
      expect(flat(getByTestId('tick-s')).backgroundColor).toBe(T.ink);
      expect(getByTestId('select-l').props.accessibilityState.checked).toBe(true);
      getByText('Diwali shortlist can take 86 more creators.');
      getByText('Add 2 creators');
      // A member cannot be unticked or added twice.
      fireEvent.press(getByTestId('select-m'));
      getByText('Add 2 creators');
      await act(async () => { fireEvent.press(getByTestId('add-selected')); });
      expect(brandApi.addGroupMembers).toHaveBeenCalledWith('g1', ['s', 'l']);
      expect(n.navigate).toHaveBeenCalledWith('BrandGroupDetail', { groupId: 'g1', toast: 'Added 2 creators to Diwali shortlist.' });
    });

    it('a full group greys the creators who would not fit, without hiding their lines', async () => {
      brandApi.getGroup.mockResolvedValue(ok({ group: { ...GROUP.group, memberCount: 99, capacityLeft: 1 }, memberIds: ['m'] }));
      const { getByTestId, getByText } = open();
      await waitFor(() => getByTestId('select-s'));
      fireEvent.press(getByTestId('select-s'));
      getByText('Diwali shortlist can take 0 more creators.');
      expect(getByTestId('select-l').props.accessibilityState).toMatchObject({ checked: false, disabled: true });
      expect(flat(getByTestId('pick-name-l')).opacity).toBe(0.5);
      getByTestId('pick-line-l'); getByTestId('pick-numbers-l');
      // The one she ticked can still be unticked.
      expect(getByTestId('select-s').props.accessibilityState).toMatchObject({ checked: true, disabled: false });
      fireEvent.press(getByTestId('select-s'));
      getByText('Diwali shortlist can take 1 more creator.');
    });

    it('B5: the footer steps away while the keypad is open and comes back when it closes', async () => {
      const { getByTestId, getByText, queryByTestId, queryByText } = open();
      await waitFor(() => getByTestId('select-s'));
      fireEvent.press(getByTestId('select-s'));
      getByTestId('group-add-footer'); getByTestId('capacity-line'); getByText('Add 1 creator');
      pad.show();
      expect(queryByTestId('group-add-footer')).toBeNull();
      expect(queryByTestId('capacity-line')).toBeNull();
      expect(queryByTestId('add-selected')).toBeNull();
      expect(queryByText('Add 1 creator')).toBeNull();
      getByTestId('group-add-subline'); getByTestId('add-tabs'); getByTestId('discover-search');
      expect(getByTestId('select-s').props.accessibilityState.checked).toBe(true);
      pad.hide();
      getByTestId('group-add-footer'); getByText('Add 1 creator'); getByText('Diwali shortlist can take 87 more creators.');
    });
  });
});
