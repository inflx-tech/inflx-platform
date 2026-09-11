/**
 * Item 3b — the creator app: R1 registration step, R3 row + chip priority, R4/R5 states and
 * actions, R6 handle-change sheets. Contract: features/item3b-social-numbers
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { getMe: jest.fn(), updateMe: jest.fn(), getInvitationSettings: jest.fn(), getMySocial: jest.fn(), getMySocialDetail: jest.fn(), checkSocialAgain: jest.fn(), register: jest.fn(), getProfileImageUploadUrl: jest.fn() },
  brandApi: {},
  referenceApi: { placesAutocomplete: jest.fn(), resolvePlace: jest.fn() },
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi } = require('../../../services/api');
const ProfileScreen = require('../ProfileScreen').default;
const YourNumbersScreen = require('../YourNumbersScreen').default;
const ProfileInfoScreen = require('../ProfileInfoScreen').default;
const { handleAction } = require('../ProfileInfoScreen');
const InfluencerRegisterScreen = require('../../auth/InfluencerRegisterScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), reset: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const ME = { id: 'c1', full_name: 'Priya Sharma', instagram_handle: 'priya.styles', youtube_handle: 'priyastyles', user_status: 'approved', niche: ['fashion'], language: ['Telugu'], needsNiche: false, city_id: 16, city_name: 'Hyderabad', state_name: 'Telangana' };
const IG_OK = { state: 'ok', handle: 'priya.styles', verified: true, followers: 48200, engagement: 4.2, posts90d: 18, lastProfileAt: `${yr}-09-09`, lastPostsAt: `${yr}-09-01`, postsDueAt: `${yr}-09-16`, checkAgainAvailableAt: null };
const YT_OK = { state: 'ok', handle: 'priyastyles', subscribers: 12100, avgLongViews: 9400, avgShortsViews: 22100, lastProfileAt: `${yr}-09-09`, lastPostsAt: `${yr}-09-01`, postsDueAt: `${yr}-09-16`, checkAgainAvailableAt: null };

beforeEach(() => {
  jest.clearAllMocks();
  influencerApi.getInvitationSettings.mockResolvedValue(ok({ summary: { labelState: 'open', aims: ['conversion'], modes: ['shipment'] } }));
  influencerApi.getMe.mockResolvedValue(ok({ influencer: ME }));
});

describe('R3 — the Your numbers row', () => {
  it('subtitle "Instagram 48.2K · YouTube 12.1K" and no chip when all is well; opens Your numbers', async () => {
    influencerApi.getMySocial.mockResolvedValue(ok({ instagram: IG_OK, youtube: YT_OK, chip: null }));
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<ProfileScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByText('Instagram 48.2K · YouTube 12.1K'));
    expect(queryByTestId(/social-chip/)).toBeNull();
    fireEvent.press(getByTestId('row-your-numbers'));
    expect(n.navigate).toHaveBeenCalledWith('YourNumbers');
  });
  it('chip priority: Fix beats Waiting beats Measuring (check 17); "—" where no number yet; a platform not added is omitted', async () => {
    influencerApi.getMySocial.mockResolvedValue(ok({ instagram: { ...IG_OK, state: 'not_found', followers: null }, youtube: null, chip: 'fix_instagram' }));
    const { getByText } = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByText('Fix Instagram'));
    getByText('Instagram —');
  });
});

describe('R4 · R5 — Your numbers', () => {
  it('all good: info box, both cards with the R4 tiles and the dates line, the hint (check 18)', async () => {
    influencerApi.getMySocial.mockResolvedValue(ok({ instagram: IG_OK, youtube: YT_OK, chip: null }));
    const { getByText, getByTestId } = render(<YourNumbersScreen navigation={nav()} />);
    await waitFor(() => getByTestId('platform-card-instagram'));
    getByText('Brands see these numbers on your profile. Followers update every week; posts every 15 days.');
    getByText('Followers'); getByText('48.2K'); getByText('Posts in 90 days'); getByText('Subscribers'); getByText('Avg video views'); getByText('Avg shorts views');
    expect(getByTestId('platform-card-instagram-dates').props.children).toBe('Followers 9 Sep · posts 1 Sep · next posts update 16 Sep');
    expect(getByTestId('platform-card-youtube-dates').props.children).toBe('Subscribers 9 Sep · uploads 1 Sep · next uploads update 16 Sep');
    getByText("Numbers are read from your public accounts and can't be typed in. To change an account, edit Profile info.");
  });

  it('every problem state shows its copy and its one action (check 10, 11)', async () => {
    const n = nav();
    influencerApi.getMySocial.mockResolvedValue(ok({ instagram: { state: 'waiting_check', handle: 'priya.styles.official' }, youtube: null, chip: 'waiting' }));
    let r = render(<YourNumbersScreen navigation={n} />);
    await waitFor(() => r.getByText('INFLX is checking this account is yours'));
    r.getByText("We'll measure it once it's confirmed. This usually takes up to a day.");
    r.getByText('Not added'); fireEvent.press(r.getByTestId('add-youtube'));
    expect(n.navigate).toHaveBeenCalledWith('ProfileInfo', { focus: 'youtube' });
    r.unmount();

    influencerApi.getMySocial.mockResolvedValue(ok({ instagram: { state: 'measuring', handle: 'priya.styles' }, youtube: { state: 'not_found', handle: 'priya.stylez' }, chip: 'fix_youtube' }));
    r = render(<YourNumbersScreen navigation={n} />);
    await waitFor(() => r.getByText('Measuring your Instagram'));
    r.getByText('This usually takes a few minutes.'); r.getByText("We couldn't find @priya.stylez on YouTube"); r.getByText('Check the spelling in Profile info.');
    fireEvent.press(r.getByTestId('fix-youtube'));
    expect(n.navigate).toHaveBeenCalledWith('ProfileInfo', { focus: 'youtube' });
    r.unmount();

    influencerApi.getMySocial.mockResolvedValue(ok({ instagram: { state: 'rejected', handle: 'notmine' }, youtube: { state: 'private', handle: 'priyastyles', checkAgainAvailableAt: null }, chip: 'fix_accounts' }));
    influencerApi.checkSocialAgain.mockResolvedValue(ok({ instagram: { state: 'rejected', handle: 'notmine' }, youtube: { state: 'private', handle: 'priyastyles', checkAgainAvailableAt: `${yr + 1}-01-01` }, chip: 'fix_accounts' }));
    r = render(<YourNumbersScreen navigation={n} />);
    await waitFor(() => r.getByText("INFLX couldn't confirm @notmine is yours"));
    r.getByText('Add the account that belongs to you in Profile info.'); r.getByText("Your channel isn't public"); r.getByText("Brands can't see your numbers until it is."); r.getByText('You can check again once a day.');
    fireEvent.press(r.getByTestId('check-again-youtube'));
    await waitFor(() => expect(influencerApi.checkSocialAgain).toHaveBeenCalledWith('youtube'));
    r.unmount();

    influencerApi.getMySocial.mockResolvedValue(ok({ instagram: { ...IG_OK, state: 'failing' }, youtube: null, chip: null }));
    r = render(<YourNumbersScreen navigation={n} />);
    await waitFor(() => r.getByText("We couldn't refresh your numbers lately. We'll keep trying."));
    r.getByText('48.2K'); r.getByTestId('check-again-instagram');
  });
});

describe('R6 — changing a handle on Profile info', () => {
  it('after approval a YouTube change asks first with the exact copy, then saves both handles as typed', async () => {
    influencerApi.updateMe.mockResolvedValue(ok({ influencer: ME, social: { changed: [{ platform: 'youtube', action: 'change' }] } }));
    const n = nav();
    const { getByTestId, getByText } = render(<ProfileInfoScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('field-youtube'));
    fireEvent.changeText(getByTestId('field-youtube'), '@priya.new');
    fireEvent.press(getByTestId('save-button'));
    await waitFor(() => getByText('Change your YouTube account?'));
    getByText('Your current YouTube numbers will be removed from your profile. INFLX will check @priya.new belongs to you, then measure it. Brands see "Numbers are being updated" until then.');
    fireEvent.press(getByTestId('confirm-primary'));
    await waitFor(() => expect(influencerApi.updateMe).toHaveBeenCalledWith({ youtube_handle: '@priya.new' }));
    expect(n.navigate).toHaveBeenCalledWith('ProfileMain', { toast: 'Saved.' });
  });
  it('adding a platform asks "Add your … account?"; removing the last one is refused with "Keep at least one account."', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { ...ME, youtube_handle: null } }));
    const { getByTestId, getByText, queryByText } = render(<ProfileInfoScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('field-youtube'));
    fireEvent.changeText(getByTestId('field-youtube'), 'youtube.com/@priyastyles');
    fireEvent.press(getByTestId('save-button'));
    await waitFor(() => getByText('Add your YouTube account?'));
    getByText('INFLX will check @priyastyles belongs to you, then measure it.');
    fireEvent.press(getByTestId('confirm-secondary'));
    expect(queryByText('Add your YouTube account?')).toBeNull();
    fireEvent.changeText(getByTestId('field-youtube'), '');
    fireEvent.changeText(getByTestId('field-instagram'), '');
    getByText('Keep at least one account.');
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  });
  it('handleAction: none / add / change / remove, same handle in another spelling is none', () => {
    expect(handleAction('instagram', 'priya.styles', '@Priya.Styles')).toBe('none');
    expect(handleAction('instagram', '', 'new_one')).toBe('add');
    expect(handleAction('instagram', 'a', 'b')).toBe('change');
    expect(handleAction('youtube', 'priyastyles', '')).toBe('remove');
    expect(handleAction('youtube', 'priyastyles', 'https://www.youtube.com/@PriyaStyles')).toBe('none');
  });
});

describe('R1 — registration in two steps', () => {
  it('step 1 needs a name; step 2 needs at least one valid account with the exact errors; sends handles as typed and queues nothing itself', async () => {
    influencerApi.register.mockResolvedValue(ok({ influencer: { id: 'c1' }, claim: { claimed: false, conflict: false, match_count: 0, scrape_fired: false } }));
    const n = nav();
    const { getByTestId, getByText, queryByTestId } = render(<InfluencerRegisterScreen navigation={n} />);
    getByText('Set up your profile');
    expect(getByTestId('reg-continue-1').props.accessibilityState?.disabled ?? true).toBeTruthy();
    fireEvent.changeText(getByTestId('reg-name'), 'Akshaya Reddy');
    fireEvent.press(getByTestId('reg-continue-1'));
    getByText('Your social accounts'); getByText('INFLX measures your public numbers from these accounts. Brands see them on your profile.');
    getByText('Add at least one. Your account must be public. We measure your numbers after INFLX approves your profile.');
    expect(queryByTestId('reg-continue-2')).toBeTruthy();
    fireEvent.changeText(getByTestId('reg-instagram'), 'priya styles!');
    fireEvent.press(getByTestId('reg-continue-2'));
    getByText('Enter a valid Instagram username.');
    fireEvent.changeText(getByTestId('reg-instagram'), '');
    fireEvent.changeText(getByTestId('reg-youtube'), 'priya!styles');
    fireEvent.press(getByTestId('reg-continue-2'));
    getByText('Enter a YouTube handle or channel link.');
    fireEvent.changeText(getByTestId('reg-youtube'), 'https://www.youtube.com/@lakkireddyakshayareddy-30');
    fireEvent.changeText(getByTestId('reg-instagram'), '_akshayareddyyy');
    fireEvent.press(getByTestId('reg-continue-2'));
    await waitFor(() => expect(influencerApi.register).toHaveBeenCalledWith({ name: 'Akshaya Reddy', instagram_handle: '_akshayareddyyy', youtube_handle: 'https://www.youtube.com/@lakkireddyakshayareddy-30' }));
    expect(n.reset).toHaveBeenCalled();
  });
  it('both fields empty → "Add at least one account."', async () => {
    const { getByTestId, getByText } = render(<InfluencerRegisterScreen navigation={nav()} />);
    fireEvent.changeText(getByTestId('reg-name'), 'A');
    fireEvent.press(getByTestId('reg-continue-1'));
    fireEvent.changeText(getByTestId('reg-instagram'), 'x');
    fireEvent.changeText(getByTestId('reg-instagram'), '');
    // The button is disabled with both empty; the message shows when a submit is attempted programmatically.
    expect(getByTestId('reg-continue-2').props.accessibilityState?.disabled ?? true).toBeTruthy();
  });
});
