/**
 * Item 3b — the brand app: S1 platform cards, every S4 state, S2/S3 detail texts, formatting.
 * Contract: features/item3b-social-numbers
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: { getCreatorProfile: jest.fn(), getCreatorSocial: jest.fn(), blockCreator: jest.fn(), unblockCreator: jest.fn(), groupsForCreator: jest.fn(), setGroupsForCreator: jest.fn() },
  influencerApi: { getMySocialDetail: jest.fn() },
  referenceApi: {},
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../../services/api');
const BrandCreatorProfileScreen = require('../BrandCreatorProfileScreen').default;
const SocialDetailScreen = require('../../shared/SocialDetailScreen').default;
const PlatformCard = require('../../../components/social/PlatformCard').default;
const { fmtDate, windowLabel, fmtCompact } = require('../../../components/discovery/copy3');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const IG = { state: 'ok', platform: 'instagram', handle: 'priya.styles', url: 'https://www.instagram.com/priya.styles', verified: true, accountTypeLabel: 'creator account', followers: 48200, engagement: 4.2, avgReelViews: 21400, posts90d: 18, updatedAt: '2026-09-09T00:00:00Z' };
const YT = { state: 'ok', platform: 'youtube', handle: 'priyastyles', url: 'https://www.youtube.com/@priyastyles', verified: false, channelName: 'Priya Styles', subscribers: 12100, avgLongViews: 9400, avgShortsViews: 22100, uploads90d: 20, updatedAt: '2026-09-09T00:00:00Z' };
const PROFILE = { influencer: { id: 'c1', full_name: 'Priya Sharma', instagram_handle: 'priya.styles', followers_count: 48200, youtube_subscribers: 12100, engagement_rate: 4.2, niche: ['fashion'], language: ['Telugu'] },
  inviteSummary: { reason: 'OK', aims: ['conversion'], modes: ['visit'] }, cityName: 'Hyderabad', stateName: 'Telangana', measuredAt: '2026-09-09T00:00:00Z',
  signedCollaborations: 5, signedCollaborationsLabel: '5 collaborations signed on INFLX', collaborationsWithYou: [], groups: [], blockedByYou: false, social: { instagram: IG, youtube: YT } };

beforeEach(() => jest.clearAllMocks());

describe('formatting (§3.6)', () => {
  it('612 · 48.2K · 2.3M · 4.2% · — · 9 Sep with the year only when it is not this year · window label', () => {
    expect(fmtCompact(612)).toBe('612'); expect(fmtCompact(48200)).toBe('48.2K'); expect(fmtCompact(2300000)).toBe('2.3M'); expect(fmtCompact(null)).toBe('—');
    const thisYear = new Date().getFullYear();
    expect(fmtDate(`${thisYear}-09-09T00:00:00Z`)).toBe('9 Sep');
    expect(fmtDate('2025-09-09T00:00:00Z')).toBe('9 Sep 2025');
    expect(windowLabel(`${thisYear}-06-12T00:00:00Z`, `${thisYear}-09-09T00:00:00Z`)).toBe('12 Jun – 9 Sep');
  });
});

describe('S1 — platform cards on the creator profile', () => {
  it('shows one card per added platform with the three numbers and opens the detail (check 15)', async () => {
    brandApi.getCreatorProfile.mockResolvedValue(ok(PROFILE));
    const n = nav();
    const { getByTestId, getByText, getAllByText, queryByTestId } = render(<BrandCreatorProfileScreen navigation={n} route={{ params: { influencerId: 'c1' } }} />);
    await waitFor(() => getByTestId('platform-card-instagram'));
    getByTestId('platform-card-youtube');
    getByText('@priya.styles  ✓'); getByText('Instagram · creator account');
    expect(getAllByText('4.2%')).toHaveLength(2);   // the top stats and the Instagram card
    getByText('21.4K'); getByText('18'); getByText('Avg reel views'); getByText('Recent posts');
    getByText('9.4K'); getByText('22.1K'); getByText('20'); getByText('Avg video views'); getByText('Avg shorts views'); getByText('Recent uploads');
    expect(queryByTestId('handle-ig')).toBeNull();
    fireEvent.press(getByText('@priya.styles  ✓'));
    expect(n.navigate).toHaveBeenCalledWith('SocialDetail', { platform: 'instagram', viewer: 'brand', influencerId: 'c1', creatorName: 'Priya Sharma' });
  });

  it('no card for a platform that is not added', async () => {
    brandApi.getCreatorProfile.mockResolvedValue(ok({ ...PROFILE, social: { instagram: IG, youtube: null } }));
    const { getByTestId, queryByTestId } = render(<BrandCreatorProfileScreen navigation={nav()} route={{ params: { influencerId: 'c1' } }} />);
    await waitFor(() => getByTestId('platform-card-instagram'));
    expect(queryByTestId('platform-card-youtube')).toBeNull();
  });
});

describe('S4 — card states (brand)', () => {
  it('0 posts → "—" tiles and the followers line, never 0 (check 6)', () => {
    const { getByText, getAllByText, getByTestId } = render(<PlatformCard platform="instagram" data={{ ...IG, engagement: null, avgReelViews: null, posts90d: 0, followers: 22000 }} mode="brand" />);
    expect(getAllByText('—')).toHaveLength(2); getByText('0');
    getByTestId('platform-card-instagram-noposts'); getByText('No posts in the last 90 days. Followers: 22.0K.');
  });
  it('updating → blue box, no numbers', () => {
    const { getByText, queryByText } = render(<PlatformCard platform="youtube" data={{ ...YT, state: 'updating' }} mode="brand" />);
    getByText('Numbers are being updated'); getByText('Check back later.'); expect(queryByText('9.4K')).toBeNull();
  });
  it('unavailable → "Numbers not available" and the grey box, no reason', () => {
    const { getByText, queryByText } = render(<PlatformCard platform="instagram" data={{ state: 'unavailable', platform: 'instagram', handle: 'x' }} mode="brand" />);
    getByText('Numbers not available'); getByText("INFLX can't measure this account right now."); expect(queryByText(/private|not found/i)).toBeNull();
  });
  it('stale → normal numbers plus "Updated {date}" (check 9)', () => {
    const { getByText } = render(<PlatformCard platform="instagram" data={{ ...IG, state: 'stale', updatedAt: `${new Date().getFullYear()}-08-24T00:00:00Z` }} mode="brand" />);
    getByText('4.2%'); getByText('Updated 24 Aug');
  });
});

describe('S2 · S3 — detail screens (check 16)', () => {
  const yr = new Date().getFullYear();
  it('Instagram: profile tiles, the window, mix legend, formula with the hidden-likes line, footer', async () => {
    brandApi.getCreatorSocial.mockResolvedValue(ok({ account: { state: 'ok', handle: 'priya.styles', url: 'https://www.instagram.com/priya.styles', verified: true, accountTypeLabel: 'creator account', profileMeasuredAt: `${yr}-09-09`, postsMeasuredAt: `${yr}-09-01`,
      window: { start: `${yr}-06-12`, end: `${yr}-09-09` }, numbers: { followers: 48200, following: 612, totalPosts: 342, posts90d: 18, postsPerWeek: 1.4, reels: 11, photos: 4, carousels: 3, lastPostAt: `${yr}-09-07`, avgLikes: 1900, avgComments: 86, avgReelViews: 21400, engagement: 4.2, engagementBasis: 'views', postsSeen: 41, hiddenLikesCount: 2 } } }));
    const { getByText, getByTestId } = render(<SocialDetailScreen navigation={nav()} route={{ params: { platform: 'instagram', viewer: 'brand', influencerId: 'c1', creatorName: 'Priya Sharma' } }} />);
    await waitFor(() => getByTestId('social-detail-instagram'));
    getByText('Creator account · Priya Sharma'); getByText('48.2K'); getByText('612'); getByText('342'); getByText('12 Jun – 9 Sep');
    getByText('Posts · 1.4 a week'); getByText('■ 11 reels'); getByText('■ 4 photos'); getByText('■ 3 carousels'); getByText('Last post 7 Sep');
    getByText('1.9K'); getByText('86'); getByText('21.4K');
    expect(getByTestId('formula').props.children.props.children.join('')).toBe("Engagement = likes + comments ÷ views, across the reels measured. Reels are the only Instagram format with a view count. Worked out from her 18 most recent posts. 2 posts hide likes and aren't in the likes average.");
    expect(getByTestId('footer').props.children).toBe('Measured by INFLX · followers 9 Sep · posts 1 Sep');
  });
  it('YouTube: channel tiles, uploads line, long videos and shorts each with their tiles, a type with 0 uploads shows "—"', async () => {
    brandApi.getCreatorSocial.mockResolvedValue(ok({ account: { state: 'ok', handle: 'priyastyles', url: 'https://www.youtube.com/@priyastyles', channelName: 'Priya Styles', profileMeasuredAt: `${yr}-09-09`, postsMeasuredAt: `${yr}-09-01`,
      window: { start: `${yr}-06-12`, end: `${yr}-09-09` }, numbers: { subscribers: 12100, totalVideos: 148, totalViews: 2300000, uploads90d: 6, uploadsPerWeek: 0.5, lastUploadAt: `${yr}-09-05`,
        long: { count: 6, avgViews: 9400, avgLikes: 410, avgComments: 42, engagement: 4.8 }, short: { count: 0, avgViews: null, avgLikes: null, avgComments: null, engagement: null } } } }));
    const { getByText, getByTestId, getAllByText } = render(<SocialDetailScreen navigation={nav()} route={{ params: { platform: 'youtube', viewer: 'brand', influencerId: 'c1' } }} />);
    await waitFor(() => getByTestId('social-detail-youtube'));
    getByText('Priya Styles · channel'); getByText('12.1K'); getByText('148'); getByText('2.3M'); getByText('6 uploads · 0.5 a week'); getByText('Last upload 5 Sep');
    getByText('6 measured'); getByText('0 measured'); getByText('4.8%'); getByText('9.4K'); getByText('410'); getByText('42');
    expect(getAllByText('—').length).toBe(4);
    expect(getByTestId('footer').props.children).toBe('Measured by INFLX · subscribers 9 Sep · uploads 1 Sep');
  });
  it('couldn\'t load → the exact copy and Try again', async () => {
    brandApi.getCreatorSocial.mockResolvedValueOnce({ success: false, error: {} }).mockResolvedValueOnce(ok({ account: { state: 'updating', handle: 'x', numbers: null } }));
    const { getByText, getByTestId, queryByTestId } = render(<SocialDetailScreen navigation={nav()} route={{ params: { platform: 'instagram', viewer: 'brand', influencerId: 'c1' } }} />);
    await waitFor(() => getByText("Couldn't load these numbers"));
    fireEvent.press(getByTestId('try-again'));
    await waitFor(() => expect(queryByTestId('load-error')).toBeNull());
    getByText('Numbers are being updated');
  });
});
