/**
 * creator-distance-and-visit-preference — the brand app's creator rows carry the distance, the
 * filter sheet sorts nearest first by default and narrows by distance, and the creator's
 * "Cities you can visit" row says in words what an empty list means.
 * Contract: features/creator-distance-and-visit-preference · 01-spec.md · mockups D1–D3
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { getInvitationSettings: jest.fn(), putInvitationSettings: jest.fn() },
  brandApi: {},
  referenceApi: {
    brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'WOMEN', label: 'Women' }] } }),
    states: jest.fn().mockResolvedValue({ success: true, data: { items: [
      { id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] },
      { id: 2, name: 'Andhra Pradesh', cities: [{ id: 20, name: 'Vijayawada' }, { id: 21, name: 'Guntur' }] },
    ] } }),
  },
}));

const { influencerApi } = require('../../../services/api');
const DiscoverList = require('../DiscoverList').default;
const { CreatorCard, MemberRow } = require('../DiscoverList');
const { CREATOR_DEFAULTS, changedCount, quickChip } = require('../FiltersSheet');
const { distanceLabel, C3 } = require('../copy3');
const InvitationSettingsScreen = require('../../../screens/influencer/InvitationSettingsScreen').default;

const row = (over = {}) => ({
  id: over.id || 'c1', name: over.name || 'Ananya N', avatarUrl: null, nicheLabel: 'Fashion', cityName: 'Guntur', stateName: 'Andhra Pradesh',
  languages: [], instagram: 48200, youtube: 12000, engagement: 4.2, acceptedAims: ['conversion'], acceptedModes: ['visit'], status: 'OK', blockedByYou: false, ...over,
});
const lists = { niches: [{ code: 'fashion', label: 'Fashion' }], languages: [], states: [], nicheLabel: () => 'Fashion', cityName: () => '' };
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });

beforeEach(() => jest.clearAllMocks());

describe('D1 — the distance on a creator row', () => {
  it('distanceLabel: a number reads "N km", 0 reads "Same city", null reads nothing', () => {
    expect(distanceLabel(32)).toBe('32 km');
    expect(distanceLabel(0)).toBe('Same city');
    expect(distanceLabel(null)).toBeNull();
    expect(distanceLabel(undefined)).toBeNull();
    expect(distanceLabel('32')).toBeNull();
  });

  it('CreatorCard: "Fashion · Guntur · 32 km"; "Same city" for 0; nothing after the city when null', () => {
    const a = render(<CreatorCard c={row({ id: 'a', distance_km: 32 })} />);
    a.getByText('Fashion · Guntur · 32 km');
    const b = render(<CreatorCard c={row({ id: 'b', cityName: 'Vijayawada', distance_km: 0 })} />);
    b.getByText('Fashion · Vijayawada · Same city');
    const c = render(<CreatorCard c={row({ id: 'c', cityName: 'Hyderabad', distance_km: null })} />);
    c.getByText('Fashion · Hyderabad');
    expect(c.queryByText(/km/)).toBeNull();
    // The languages still follow the distance, and the camel spelling is read too.
    const d = render(<CreatorCard c={row({ id: 'd', distanceKm: 58, languages: ['Telugu'] })} />);
    d.getByText('Fashion · Guntur · 58 km · Telugu');
  });

  it('MemberRow: the distance sits between the city and the follower count', () => {
    const a = render(<MemberRow c={row({ id: 'a', distance_km: 32 })} />);
    a.getByText('Fashion · Guntur · 32 km · 48.2K IG');
    const b = render(<MemberRow c={row({ id: 'b', distance_km: 0 })} />);
    b.getByText('Fashion · Guntur · Same city · 48.2K IG');
    const c = render(<MemberRow c={row({ id: 'c', distance_km: null })} />);
    c.getByText('Fashion · Guntur · 48.2K IG');
  });
});

describe('D2 — nearest first and the distance chips', () => {
  const ok = (data) => Promise.resolve({ success: true, data });

  it('the default request asks for sort=distance and within=any, and the list header reads Nearest first', async () => {
    const fetcher = jest.fn(() => ok({ total: 1, rows: [row({ distance_km: 32 })] }));
    const { getByText, getByTestId } = render(<DiscoverList fetcher={fetcher} countFetcher={fetcher} lists={lists} />);
    await waitFor(() => getByText('1 creator'));
    expect(fetcher.mock.calls[0][0]).toMatchObject({ sort: 'distance', within: 'any', page: 1 });
    getByText('Nearest first ▾');
    getByTestId('sort-toggle');
    expect(Object.keys(C3.discover.sorts)[0]).toBe('distance');
  });

  it('the sheet shows Nearest first selected by default and the four distance chips with Anywhere selected', async () => {
    const fetcher = jest.fn(() => ok({ total: 1, rows: [row()] }));
    const { getByTestId } = render(<DiscoverList fetcher={fetcher} countFetcher={fetcher} lists={lists} />);
    await waitFor(() => getByTestId('open-filters'));
    fireEvent.press(getByTestId('open-filters'));
    await waitFor(() => getByTestId('filters-sheet'));
    expect(getByTestId('filter-sort-distance').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('filter-sort-followers').props.accessibilityState.selected).toBe(false);
    for (const v of ['50', '100', 'state', 'any']) getByTestId(`filter-within-${v}`);
    expect(getByTestId('filter-within-any').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('filter-within-50').props.accessibilityState.selected).toBe(false);
  });

  it('choosing "Within 50 km" and applying sends within=50; the quick chip names it', async () => {
    const fetcher = jest.fn(() => ok({ total: 1, rows: [row()] }));
    const { getByTestId, getByText } = render(<DiscoverList fetcher={fetcher} countFetcher={fetcher} lists={lists} />);
    await waitFor(() => getByTestId('open-filters'));
    fireEvent.press(getByTestId('open-filters'));
    await waitFor(() => getByTestId('filters-sheet'));
    fireEvent.press(getByTestId('filter-within-50'));
    expect(getByTestId('filter-within-50').props.accessibilityState.selected).toBe(true);
    await waitFor(() => expect(getByTestId('filters-apply').props.accessibilityState.disabled).toBe(false));
    await act(async () => { fireEvent.press(getByTestId('filters-apply')); });
    await waitFor(() => expect(fetcher.mock.calls.some(c => c[0].within === '50' && c[0].sort === 'distance' && c[0].page === 1)).toBe(true));
    getByText('Filters · 1');
    getByText('Within 50 km  ✕');
  });

  it('picking another sort in the sheet changes the request; a sort alone never counts as a filter', async () => {
    const fetcher = jest.fn(() => ok({ total: 1, rows: [row()] }));
    const { getByTestId, getByText, queryByText } = render(<DiscoverList fetcher={fetcher} countFetcher={fetcher} lists={lists} />);
    await waitFor(() => getByTestId('open-filters'));
    fireEvent.press(getByTestId('open-filters'));
    await waitFor(() => getByTestId('filters-sheet'));
    fireEvent.press(getByTestId('filter-sort-followers'));
    await waitFor(() => expect(getByTestId('filters-apply').props.accessibilityState.disabled).toBe(false));
    await act(async () => { fireEvent.press(getByTestId('filters-apply')); });
    await waitFor(() => expect(fetcher.mock.calls.some(c => c[0].sort === 'followers' && c[0].page === 1)).toBe(true));
    getByText('Filters');
    expect(queryByText(/Filters · /)).toBeNull();
    expect(changedCount({ ...CREATOR_DEFAULTS, sort: 'followers' }, CREATOR_DEFAULTS)).toBe(0);
    expect(changedCount({ ...CREATOR_DEFAULTS, within: 'state' }, CREATOR_DEFAULTS)).toBe(1);
    expect(quickChip({ ...CREATOR_DEFAULTS, within: 'state' }, CREATOR_DEFAULTS, lists)).toBe('Same state');
  });
});

describe('D3 — "Cities you can visit" when the list is empty', () => {
  const settings = (over = {}) => ({
    open: true, pausedAt: null, acceptedAims: ['conversion'], acceptedModes: ['visit', 'shipment'], visitCityIds: [],
    brandCategoryCodes: null, minFeeEngagement: null, minFeeHybrid: null, minCommissions: [], updatedAt: null, saved: false, ...over,
  });
  const ok = (s) => ({ success: true, data: { settings: s, blockedCount: 0 } });

  it('reads "Anywhere" with the exact hint under it, and it is not a save-blocking error', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok(settings()));
    const { getByTestId, getByText, queryByText, queryByTestId } = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('row-visit-cities'));
    getByText('Anywhere');
    getByText('Anywhere — any brand can invite you for a store visit. Pick cities to limit it.');
    expect(queryByText('Pick at least one city, or turn off Store Visit.')).toBeNull();
    expect(queryByTestId('save-bar-fix')).toBeNull();
  });

  it('with cities picked the summary stays and the anywhere hint is gone', async () => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok(settings({ visitCityIds: [10, 20, 21] })));
    const { getByTestId, getByText, queryByText } = render(<InvitationSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('row-visit-cities'));
    getByText('3 cities in 2 states');
    expect(queryByText('Anywhere')).toBeNull();
    expect(queryByText(/any brand can invite you/)).toBeNull();
  });
});
