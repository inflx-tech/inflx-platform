/**
 * Item 19 — Home on both phones (board item19-home-v3: BH1–BH6, CH1–CH5).
 * Contract: features/item19-home · master rules v1.32 §24
 *
 * React Native has no compile step: a bad import or a typo fails on the DEVICE. Every screen is
 * mounted here with the server's real read shape (backend home.service publicRow / brandHome /
 * creatorHome), never the shape the screen happens to read.
 *
 * It also holds the ONE RULE in its two places together. The set screen and her Collabs card pick
 * a row's button on the phone (setRowStep / cardStep); Home's lists are worked out on the server.
 * fixtures/home19-rows.json is written by the backend's own test from rows it really seeded, with
 * the server's verdict on each — and every one of them is put through the phone's rule here.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, waitFor, fireEvent, act, within } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn().mockResolvedValue(''), setString: jest.fn() }));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('../../utils/openWebDashboard', () => ({ openWebDashboard: jest.fn() }));
jest.mock('../../services/api', () => {
  const side = () => ({
    getHome: jest.fn(), getHomeList: jest.fn(), getHomeCount: jest.fn(), getNotifications: jest.fn(), markAllNotificationsRead: jest.fn(),
    getMe: jest.fn(), createPost: jest.fn(),
  });
  return { brandApi: side(), influencerApi: side(), referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(), emitAccountGate: jest.fn() };
});
const { brandApi, influencerApi } = require('../../services/api');
const { openWebDashboard } = require('../../utils/openWebDashboard');
const Clipboard = require('@react-native-clipboard/clipboard');
import HomeScreen from '../home/HomeScreen';
import HomeListScreen from '../home/HomeListScreen';
import BrandNotificationsScreen from '../home/BrandNotificationsScreen';
import PendingHomeScreen from '../../components/shell/PendingHomeScreen';
import { anyTargetOf } from '../influencer/CreatorNotificationsScreen';
import { brandTarget, creatorTarget, noticeTarget, brandNoticeTarget, ORDERS_WEB_PATH, _disarmReturnHome } from '../../components/home/open19';
import { BRAND_BUTTON, buttonFor, H19 } from '../../components/home/copy19';
import { setRowStep, cardStep } from '../../components/invitations/steps5';
import { C5 } from '../../components/invitations/copy5';
import { C6 } from '../../components/negotiation/copy6';
import { getHomeCount, setHomeCount, refreshHomeCount, _resetHomeCount, THROTTLE_MS } from '../../services/homeCount';
import { setAccountStatus } from '../../services/accountStatus';

const ok = (data) => ({ success: true, data });
const fail = { success: false, error: { code: 'INTERNAL_ERROR', message: 'no' } };
/** A Home screen's navigation: its own stack, with the tab navigator as parent. */
function nav() {
  const tabs = { addListener: jest.fn(() => () => {}), getState: jest.fn(() => ({ index: 0, routes: [{ name: 'HomeTab' }] })), navigate: jest.fn() };
  return { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), getParent: () => tabs, tabs };
}
const flat = (r) => JSON.stringify(r.toJSON());

beforeEach(() => { jest.clearAllMocks(); _resetHomeCount(); _disarmReturnHome(); setAccountStatus('approved'); });

/* ── the server's shapes (home.service publicRow) ── */
const IDS = { campaignId: 'c1', setId: 's1', ciId: 'ci1', pitchId: null, postId: null };
const bRow = (kind, screen, o = {}) => ({
  id: `${o.ciId || 'ci1'}:${kind}`, kind, side: 'needs', who: { type: 'creator', name: o.name || 'Ananya Rao', avatarUrl: null },
  line: o.line || 'She signed. Your signature is needed by 12 Oct.', context: 'Festive Edit · Kurta drop', why: o.why === undefined ? '2 days left' : o.why, delayed: !!o.delayed,
  open: { ...IDS, screen, ...(o.ciId ? { ciId: o.ciId } : {}) },
});
const BRAND_HOME = {
  me: { name: 'Kora' }, unread: 3, firstDay: false,
  needs: { total: 9, rows: [
    bRow('sign', 'agreement'),
    bRow('confirm_live', 'content', { ciId: 'ci2', name: 'Meera Shah', line: 'She has posted and added her links. Confirm it is live.', why: 'Her payment waits' }),
    bRow('confirm_shoot', 'shoot', { ciId: 'ci3', name: 'Riya Kapoor', line: 'She says she came to the store. Confirm the shoot.', why: 'Her next step waits', delayed: true }),
  ] },
  waiting: { total: 10, groups: [{ key: 'creators', count: 9 }, { key: 'inflx', count: 1 }], rows: [
    { id: 'ci7:not_answered', kind: 'not_answered', side: 'waiting', who: { type: 'creator', name: 'Priya Nair', avatarUrl: null }, line: 'Invited on 6 Oct. She has not answered yet.',
      context: 'Festive Edit · Kurta drop', why: 'Closes 12 Oct', delayed: false, open: { campaignId: 'c1', setId: 's1', ciId: 'ci7', pitchId: null, postId: null, screen: 'set' }, tag: 'Not answered', tone: 'waiting', group: 'creators' },
    { id: 'ci8:to_sign', kind: 'to_sign', side: 'waiting', who: { type: 'creator', name: 'Sana Iyer', avatarUrl: null }, line: 'The agreement is with her to sign.',
      context: 'Festive Edit · Saree reels', why: null, delayed: false, open: { campaignId: 'c1', setId: 's2', ciId: 'ci8', pitchId: null, postId: null, screen: 'agreement' }, tag: 'To sign', tone: 'waiting', group: 'creators' },
  ] },
  money: { lines: [{ key: 'available', amount: 48200 }, { key: 'locked', amount: 21875, count: 3 }, { key: 'sales', amount: 12070, count: 9 }] },
  running: { kind: 'campaigns', total: 2, counts: { live: 2, draft: 1 }, rows: [
    { id: 'c1', name: 'Festive Edit', state: 'live', setCount: 2, nextPostingDate: '2026-10-14', counts: { invited: 8, signed: 5, waiting: 2, declined: 1 } },
    { id: 'c2', name: 'Winter Layers', state: 'live', setCount: 1, nextPostingDate: '2026-10-22', counts: { invited: 4, signed: 2, waiting: 1, declined: 1 } },
  ] },
};
const cRow = (kind, screen, o = {}) => ({
  id: `${o.id || 'ci1'}:${kind}`, kind, side: 'needs', who: o.who || { type: 'brand', name: 'Kora', logoUrl: null },
  line: o.line || 'The agreement is ready. Review and sign by 12 Oct.', context: o.context || 'Festive Edit · Kurta drop', why: o.why === undefined ? '2 days left' : o.why, delayed: false,
  open: { campaignId: null, setId: null, ciId: o.ciId === undefined ? 'ci1' : o.ciId, pitchId: null, postId: o.postId || null, screen },
});
const CREATOR_HOME = {
  me: { name: 'Ananya' }, unread: 2, firstDay: false,
  needs: { total: 8, rows: [
    cRow('sign', 'agreement'),
    cRow('answer', 'invitation', { id: 'ci2', ciId: 'ci2', who: { type: 'brand', name: 'Mokha Home', logoUrl: null }, line: 'New invitation. Pay for Sale · Remote · 12% commission.', why: 'Reply by 14 Oct' }),
    cRow('post_needed', 'createPost', { id: 'ci3', ciId: 'ci3', who: { type: 'icon', name: 'Shoppable post needed', icon: 'post' }, line: 'Nomad Bags · Travel Light. You have made 1 of 2.', context: 'Create', why: 'Before 16 Oct' }),
  ] },
  waiting: { total: 6, groups: [{ key: 'brands', count: 3 }, { key: 'inflx', count: 1 }, { key: 'pitches', count: 2 }], rows: [
    { id: 'ci9:brand_to_sign', kind: 'brand_to_sign', side: 'waiting', who: { type: 'brand', name: 'Linen Lane', logoUrl: null }, line: 'You signed. Waiting for Linen Lane to sign.',
      context: 'Monsoon Edit · Set A', why: null, delayed: false, open: { campaignId: null, setId: null, ciId: 'ci9', pitchId: null, postId: null, screen: 'agreement' }, tag: 'To sign', tone: 'waiting', group: 'brands' },
  ] },
  money: { lines: [{ key: 'available', amount: 8625 }, { key: 'payments', amount: 18750, count: 2, nextAt: '2026-10-14T06:00:00.000Z' }, { key: 'commission', amount: 3125, count: 7 }] },
  running: { kind: 'collaborations', total: 3, rows: [
    { id: 'ci5', brand: { name: 'Suta & Co', logoUrl: null }, campaignName: 'Autumn Weaves', setName: 'Set A', goal: 'engagement', aim: 'Pay for Content', postingDate: '2026-10-14', earn: '₹25,000', chip: 'Active', completed: false, open: { screen: 'content', ciId: 'ci5' } },
    { id: 'ci6', brand: { name: 'Nomad Bags', logoUrl: null }, campaignName: 'Travel Light', setName: 'Set B', goal: 'hybrid', aim: 'Hybrid', postingDate: '2026-10-18', earn: '₹12,000 + 10%', chip: 'Active', completed: false, open: { screen: 'remote', ciId: 'ci6' } },
  ] },
  storeLink: 'inflx.in/s/ananyarao',
  setup: { invitations: { state: 'open', aims: ['conversion', 'hybrid'], modes: ['shipment'] }, numbers: { instagram: 48200, youtube: 12100 } },
};
const QUIET = (h) => ({ ...h, needs: { total: 0, rows: [] } });

/* ══════════════════════════════════════════ the brand's Home (BH1) */

describe('BH1 — the brand\'s Home', () => {
  it('four sections in order, three rows of nine, the set screen\'s button words, and the count goes to the tab', async () => {
    brandApi.getHome.mockResolvedValue(ok(BRAND_HOME));
    const n = nav();
    const r = render(<HomeScreen navigation={n} side="brand" />);
    await waitFor(() => r.getByTestId('home-brand'));
    r.getByText('Kora');
    // the four headings, in order
    const text = flat(r);
    const at = (s) => text.indexOf(s);
    expect(at('Needs you')).toBeGreaterThan(-1);
    expect(at('Needs you')).toBeLessThan(at('Waiting on others'));
    expect(at('Waiting on others')).toBeLessThan(at('Money'));
    expect(at('Money')).toBeLessThan(at('Campaigns'));
    // three rows, each with the set row's own word
    expect(r.queryByTestId('need-3')).toBeNull();
    expect(r.getByTestId('need-0-button').props.accessibilityLabel).toBe(C5.set.signChip);
    expect(r.getByTestId('need-1-button').props.accessibilityLabel).toBe(C5.set.confirmLive);
    expect(r.getByTestId('need-2-button').props.accessibilityLabel).toBe(C5.set.confirmShoot);
    r.getByText('She signed. Your signature is needed by 12 Oct.');
    r.getByText('2 days left'); r.getByText('Her payment waits'); expect(r.getAllByText('Festive Edit · Kurta drop').length).toBeGreaterThanOrEqual(1);
    r.getByTestId('need-2-delayed');
    expect(r.queryByTestId('need-0-delayed')).toBeNull();
    // the bell carries the unread count; the tab store has the list's count
    within(r.getByTestId('home-bell-count')).getByText('3');
    expect(getHomeCount()).toEqual({ needs: 9, unread: 3 });
  });

  it('a row opens the exact screen in its own tab, with the main page underneath; See all opens the full list', async () => {
    brandApi.getHome.mockResolvedValue(ok(BRAND_HOME));
    const n = nav();
    const r = render(<HomeScreen navigation={n} side="brand" />);
    await waitFor(() => r.getByTestId('home-brand'));
    fireEvent.press(r.getByTestId('need-0-button'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandAgreement', params: { campaignId: 'c1', setId: 's1', ciId: 'ci1', preview: false }, initial: false }));
    expect(n.tabs.addListener).toHaveBeenCalledWith('state', expect.any(Function));   // Back will return to Home
    fireEvent.press(r.getByTestId('need-1'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandContent', params: { campaignId: 'c1', setId: 's1', ciId: 'ci2' }, initial: false }));
    fireEvent.press(r.getByTestId('section-needs'));
    expect(n.navigate).toHaveBeenCalledWith('BrandNeedsYou');
    fireEvent.press(r.getByTestId('section-waiting'));
    expect(n.navigate).toHaveBeenCalledWith('BrandWaiting');
    fireEvent.press(r.getByTestId('wait-0'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandSetDetail', params: { campaignId: 'c1', setId: 's1' }, initial: false }));
    fireEvent.press(r.getByTestId('home-bell'));
    expect(n.navigate).toHaveBeenCalledWith('BrandNotifications');
  });

  it('Money is the Wallet\'s three lines in the Wallet\'s words; Campaigns is the Campaigns card\'s lines', async () => {
    brandApi.getHome.mockResolvedValue(ok(BRAND_HOME));
    const n = nav();
    const r = render(<HomeScreen navigation={n} side="brand" />);
    await waitFor(() => r.getByTestId('home-brand'));
    r.getByText('Available'); r.getByText('Locked in collaborations'); r.getByText('3 collaborations');
    r.getByText('Sales money coming'); r.getByText('9 sales not added yet');
    within(r.getByTestId('money-available')).getByText('₹48,200');
    within(r.getByTestId('money-locked')).getByText('₹21,875');
    fireEvent.press(r.getByTestId('money-locked'));
    expect(n.navigate).toHaveBeenCalledWith('WalletTab', { screen: 'BrandWalletLocked', params: {}, initial: false });
    fireEvent.press(r.getByTestId('section-money'));
    expect(n.navigate).toHaveBeenCalledWith('WalletTab', undefined);

    r.getByText('Festive Edit'); r.getByText('2 sets · next posting 14 Oct'); r.getByText('8 invited · 5 signed · 2 waiting · 1 declined');
    within(r.getByTestId('section-running')).getByText(/2 live/);
    fireEvent.press(r.getByTestId('campaign-0'));
    expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandCampaignDetail', params: { campaignId: 'c1' }, initial: false });
    fireEvent.press(r.getByTestId('section-running'));
    expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandCampaigns', params: { segment: 'Live' } });
  });

  it('BH4 — nothing needs you: one line, no See all, the other three sections stay', async () => {
    brandApi.getHome.mockResolvedValue(ok(QUIET(BRAND_HOME)));
    const r = render(<HomeScreen navigation={nav()} side="brand" />);
    await waitFor(() => r.getByTestId('needs-none'));
    r.getByText('Nothing needs you right now.');
    expect(r.queryByTestId('need-0')).toBeNull();
    expect(within(r.getByTestId('section-needs')).queryByText('See all')).toBeNull();
    r.getByText(/^Waiting on others/); r.getByText('Priya Nair'); r.getByText('Money'); r.getByText('Festive Edit');
    expect(getHomeCount().needs).toBe(0);
  });

  it('BH5 — first day: the steps and the one yellow button, and none of the four sections', async () => {
    brandApi.getHome.mockResolvedValue(ok({ ...QUIET(BRAND_HOME), firstDay: true, waiting: { total: 0, groups: [], rows: [] }, running: { kind: 'campaigns', total: 0, counts: { live: 0, draft: 0 }, rows: [] } }));
    const n = nav();
    const r = render(<HomeScreen navigation={n} side="brand" />);
    await waitFor(() => r.getByTestId('home-brand-first-day'));
    r.getByText('Your account is approved.', { exact: false }); expect(r.getAllByText('Create a campaign')).toHaveLength(2);   // the step, and the button
    r.getByText('Pick creators'); r.getByText('Send invitations');
    expect(r.queryByText('Needs you')).toBeNull();
    expect(r.queryByText('Money')).toBeNull();
    fireEvent.press(r.getByTestId('first-create'));
    expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandCampaignNew', params: {}, initial: false });
    fireEvent.press(r.getByTestId('first-find'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorsTab');
  });

  it('the first read failing shows the retry; a later failed read leaves the page as it was', async () => {
    brandApi.getHome.mockResolvedValue(fail);
    const r = render(<HomeScreen navigation={nav()} side="brand" />);
    await waitFor(() => r.getByTestId('home-brand-error'));
    brandApi.getHome.mockResolvedValue(ok(BRAND_HOME));
    fireEvent.press(r.getByTestId('try-again'));
    await waitFor(() => r.getByTestId('home-brand'));
    r.getByText('Ananya Rao');
  });

  it('the orders row opens the website; a Home with no yellow button outside the first day (the mono rule)', async () => {
    const orders = { id: 'orders', kind: 'orders', side: 'needs', who: { type: 'icon', name: '2 orders to pack', icon: 'orders' }, line: 'Shoppers are waiting. Orders are handled on the website.',
      context: 'Opens the website', why: null, delayed: false, open: { campaignId: null, setId: null, ciId: null, pitchId: null, postId: null, screen: 'ordersWeb' }, count: 2 };
    brandApi.getHome.mockResolvedValue(ok({ ...BRAND_HOME, needs: { total: 1, rows: [orders] } }));
    const n = nav();
    const r = render(<HomeScreen navigation={n} side="brand" />);
    await waitFor(() => r.getByTestId('home-brand'));
    r.getByText('2 orders to pack');
    fireEvent.press(r.getByTestId('need-0-button'));
    await waitFor(() => expect(openWebDashboard).toHaveBeenCalledWith(ORDERS_WEB_PATH));
    expect(n.navigate).not.toHaveBeenCalled();
    // yellow (#FFC700) is the one main button of a screen: none here
    expect(flat(r)).not.toContain('#FFC700');
  });
});

/* ══════════════════════════════════════════ the creator's Home (CH1) */

describe('CH1 — the creator\'s Home', () => {
  it('her name, her rows with her own button words, Money in the Wallet\'s words, Running now and her store link', async () => {
    influencerApi.getHome.mockResolvedValue(ok(CREATOR_HOME));
    const n = nav();
    const r = render(<HomeScreen navigation={n} side="creator" />);
    await waitFor(() => r.getByTestId('home-creator'));
    r.getByText('Hi Ananya');
    expect(r.getByTestId('need-0-button').props.accessibilityLabel).toBe(C5.creator.reviewSign);
    expect(r.getByTestId('need-1-button').props.accessibilityLabel).toBe(C5.creator.open);
    expect(r.getByTestId('need-2-button').props.accessibilityLabel).toBe('Start');
    r.getByText('Shoppable post needed'); r.getByText('Before 16 Oct'); r.getByText('Reply by 14 Oct');
    r.getByText('Collaboration payments'); r.getByText('2 collaborations · next on 14 Oct');
    r.getByText('Commission'); r.getByText('7 sales not added yet');
    r.getByText('Running now', { exact: false });
    r.getByText('Suta & Co'); r.getByText('Autumn Weaves · Pay for Content'); r.getByText('Posts 14 Oct · you earn ₹25,000');
    r.getByText('Posts 18 Oct · you earn ₹12,000 + 10%');
    r.getByText('inflx.in/s/ananyarao');
    fireEvent.press(r.getByTestId('home-store-copy'));
    expect(Clipboard.setString).toHaveBeenCalledWith('https://inflx.in/s/ananyarao');
    expect(getHomeCount()).toEqual({ needs: 8, unread: 2 });
  });

  it('each row opens its screen; "Start" makes the post first; the bell opens her notices in Collabs', async () => {
    influencerApi.getHome.mockResolvedValue(ok(CREATOR_HOME));
    influencerApi.createPost.mockResolvedValue(ok({ post: { id: 'p9' } }));
    const n = nav();
    const r = render(<HomeScreen navigation={n} side="creator" />);
    await waitFor(() => r.getByTestId('home-creator'));
    fireEvent.press(r.getByTestId('need-0-button'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CollabsTab', { screen: 'Agreement', params: { ciId: 'ci1' }, initial: false }));
    fireEvent.press(r.getByTestId('need-1'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CollabsTab', { screen: 'Invitation', params: { ciId: 'ci2' }, initial: false }));
    fireEvent.press(r.getByTestId('need-2-button'));
    await waitFor(() => expect(influencerApi.createPost).toHaveBeenCalledWith('ci3'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CreateTab', { screen: 'PostType', params: { postId: 'p9' }, initial: false }));
    fireEvent.press(r.getByTestId('running-1'));
    expect(n.navigate).toHaveBeenCalledWith('CollabsTab', { screen: 'MyRemote', params: { ciId: 'ci6' }, initial: false });
    fireEvent.press(r.getByTestId('section-running'));
    expect(n.navigate).toHaveBeenCalledWith('CollabsTab', { screen: 'Collabs', params: { segment: 'Active' } });
    fireEvent.press(r.getByTestId('money-commission'));
    expect(n.navigate).toHaveBeenCalledWith('WalletTab', { screen: 'CreatorWalletCommission', params: {}, initial: false });
    fireEvent.press(r.getByTestId('home-bell'));
    expect(n.navigate).toHaveBeenCalledWith('CollabsTab', { screen: 'CreatorNotifications', params: {}, initial: false });
    fireEvent.press(r.getByTestId('section-needs'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorNeedsYou');
  });

  it('CH4 — nothing needs you; and no store link line when she has no link', async () => {
    influencerApi.getHome.mockResolvedValue(ok({ ...QUIET(CREATOR_HOME), storeLink: null }));
    const r = render(<HomeScreen navigation={nav()} side="creator" />);
    await waitFor(() => r.getByTestId('needs-none'));
    r.getByText('Linen Lane'); r.getByText('Suta & Co');
    expect(r.queryByTestId('home-store-link')).toBeNull();
  });

  it('CH5 — first day: Find brands is the one yellow button; her settings, her numbers and her link', async () => {
    influencerApi.getHome.mockResolvedValue(ok({ ...QUIET(CREATOR_HOME), firstDay: true, waiting: { total: 0, groups: [], rows: [] }, running: { kind: 'collaborations', total: 0, rows: [] } }));
    const n = nav();
    const r = render(<HomeScreen navigation={n} side="creator" />);
    await waitFor(() => r.getByTestId('home-creator-first-day'));
    r.getByText('Open · Pay for Sale, Hybrid · Remote');
    r.getByText('Instagram 48.2K · YouTube 12.1K');
    r.getByText('inflx.in/s/ananyarao');
    expect(r.queryByText('Needs you')).toBeNull();
    fireEvent.press(r.getByTestId('first-find'));
    expect(n.navigate).toHaveBeenCalledWith('CollabsTab', { screen: 'FindBrands', params: {}, initial: false });
    fireEvent.press(r.getByTestId('first-settings'));
    expect(n.navigate).toHaveBeenCalledWith('ProfileTab', { screen: 'InvitationSettings', params: {}, initial: false });
  });
});

/* ══════════════════════════════════════════ the Home tab's own screen */

describe('the Home tab decides: under review, or Home', () => {
  const route = (kind) => ({ params: { kind, tabTitle: 'Home' } });
  it('approved → Home; not approved → the Under review screen, and Home is never asked for', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: { business_name: 'Kora' }, user_status: 'approved', completeness: { total: 10, done: 10, complete: true } }));
    brandApi.getHome.mockResolvedValue(ok(BRAND_HOME));
    let r = render(<PendingHomeScreen navigation={nav()} route={route('brandHome')} />);
    await waitFor(() => r.getByTestId('home-brand'));
    r.unmount();

    jest.clearAllMocks();
    influencerApi.getMe.mockResolvedValue(ok({ user_status: 'pending', completeness: { done: 10, total: 10, missing: [], missing_labels: [] } }));
    r = render(<PendingHomeScreen navigation={nav()} route={route('creatorHome')} />);
    await waitFor(() => r.getByTestId('pending-home-creator'));
    r.getByText('Under review');
    expect(influencerApi.getHome).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════ the two full lists (BH2, BH3, CH2, CH3) */

describe('BH2 / CH2 — Needs you, all', () => {
  it('every row, the order said in words, each row opening its screen; the count follows the list', async () => {
    const rows = [...BRAND_HOME.needs.rows, bRow('reply', 'thread', { ciId: 'ci4', name: 'Tanvi Desai', line: 'She sent a counter. It is your turn to reply.', why: null })];
    brandApi.getHomeList.mockResolvedValue(ok({ list: 'needs', total: 4, rows }));
    setHomeCount({ needs: 9, unread: 3 });
    const n = nav();
    const r = render(<HomeListScreen navigation={n} route={{ params: { side: 'brand', list: 'needs' } }} />);
    await waitFor(() => r.getByTestId('home-list-needs'));
    expect(brandApi.getHomeList).toHaveBeenCalledWith('needs');
    r.getByText(H19.order.brand);
    expect(r.getByTestId('row-3-button').props.accessibilityLabel).toBe(C6.set.reply);
    fireEvent.press(r.getByTestId('row-3-button'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandThread', params: { campaignId: 'c1', setId: 's1', ciId: 'ci4' }, initial: false }));
    expect(getHomeCount()).toEqual({ needs: 4, unread: 3 });
    // the shared title bar, with its way back
    fireEvent.press(r.getByLabelText('Back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });

  it('an empty list says so; the creator\'s list reads the creator\'s endpoint and words', async () => {
    influencerApi.getHomeList.mockResolvedValue(ok({ list: 'needs', total: 0, rows: [] }));
    const r = render(<HomeListScreen navigation={nav()} route={{ params: { side: 'creator', list: 'needs' } }} />);
    await waitFor(() => r.getByText('Nothing needs you'));
    expect(influencerApi.getHomeList).toHaveBeenCalledWith('needs');
    expect(r.queryByTestId('needs-order')).toBeNull();
  });
});

describe('BH3 / CH3 — Waiting on others, all', () => {
  const w = (id, group, name, tag) => ({ id, kind: 'x', side: 'waiting', who: { type: 'brand', name, logoUrl: null }, line: `${name} line`, context: 'ctx', why: null, delayed: false,
    open: { campaignId: null, setId: null, ciId: id, pitchId: null, postId: null, screen: 'agreement' }, tag, tone: 'waiting', group });
  it('a tag in place of the button, split by who is being waited for', async () => {
    influencerApi.getHomeList.mockResolvedValue(ok({ list: 'waiting', total: 3, groups: [{ key: 'brands', count: 2 }, { key: 'inflx', count: 1 }, { key: 'pitches', count: 0 }],
      rows: [w('a', 'brands', 'Linen Lane', 'To sign'), w('b', 'brands', 'Terra Home', 'In review'), w('c', 'inflx', 'Your post is being checked', 'With INFLX')] }));
    const n = nav();
    const r = render(<HomeListScreen navigation={n} route={{ params: { side: 'creator', list: 'waiting' } }} />);
    await waitFor(() => r.getByTestId('home-list-waiting'));
    expect(influencerApi.getHomeList).toHaveBeenCalledWith('waiting');
    r.getByText('Brands · 2'); r.getByText('INFLX · 1');
    expect(r.queryByText('Pitches · 0')).toBeNull();           // an empty group has no segment
    r.getByText('Linen Lane'); r.getByText('Terra Home');
    expect(r.queryByText('Your post is being checked')).toBeNull();
    r.getByTestId('row-0-tag');
    expect(r.queryByTestId('row-0-button')).toBeNull();          // waiting rows never carry a button
    fireEvent.press(r.getByTestId('segment-INFLX · 1'));
    r.getByText('Your post is being checked');
    expect(r.queryByText('Linen Lane')).toBeNull();
    fireEvent.press(r.getByTestId('row-0'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CollabsTab', { screen: 'Agreement', params: { ciId: 'c' }, initial: false }));
  });
});

/* ══════════════════════════════════════════ notices (BH6, and the creator's dead taps) */

describe('BH6 — the brand\'s notices', () => {
  const note = (id, type, title, data_json, is_read = false) => ({ id, type, title, body: `${title} body`, data_json, is_read, created_at: new Date(Date.now() - 2 * 3600000).toISOString() });
  it('lists them, marks them read, and a tap opens the screen the notice names', async () => {
    brandApi.getNotifications.mockResolvedValue(ok({ unread_count: 2, notifications: [
      note('n1', 'agreement.signed', 'Ananya Rao signed the agreement', { screen: 'set_detail', campaign_id: 'c1', set_id: 's1', campaign_influencer_id: 'ci1' }),
      note('n2', 'brand_new_order', 'New order', { order_id: 'o1' }),
      note('n3', 'content.posted', 'Meera Shah has posted', { screen: 'brand_content', campaign_id: 'c1', set_id: 's2', campaign_influencer_id: 'ci2' }, true),
      note('n4', 'account.approved', 'Your account is approved', {}, true),
    ] }));
    brandApi.markAllNotificationsRead.mockResolvedValue(ok({ marked_read: true }));
    setHomeCount({ needs: 9, unread: 2 });
    const n = nav();
    const r = render(<BrandNotificationsScreen navigation={n} />);
    await waitFor(() => r.getByTestId('brand-notifications'));
    r.getByText('Ananya Rao signed the agreement');
    await waitFor(() => expect(brandApi.markAllNotificationsRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getHomeCount()).toEqual({ needs: 9, unread: 0 }));
    fireEvent.press(r.getByTestId('notice-n1'));
    expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandSetDetail', params: { campaignId: 'c1', setId: 's1' }, initial: false });
    fireEvent.press(r.getByTestId('notice-n3'));
    expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandContent', params: { campaignId: 'c1', setId: 's2', ciId: 'ci2' }, initial: false });
    fireEvent.press(r.getByTestId('notice-n2'));
    expect(openWebDashboard).toHaveBeenCalledWith(ORDERS_WEB_PATH);
    // a notice that is information only does nothing when tapped
    expect(r.getByTestId('notice-n4').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(r.getByLabelText('Back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });

  it('every screen code the server puts on a brand notice has a destination', () => {
    const full = { campaign_id: 'c', set_id: 's', campaign_influencer_id: 'ci' };
    const CODES = {
      set_detail: ['CampaignsTab', 'BrandSetDetail'], brand_thread: ['CampaignsTab', 'BrandThread'], brand_shoot: ['CampaignsTab', 'BrandShoot'],
      brand_remote: ['CampaignsTab', 'BrandRemote'], brand_content: ['CampaignsTab', 'BrandContent'], brand_going_live: ['CampaignsTab', 'BrandSaleLive'],
      campaign_detail: ['CampaignsTab', 'BrandCampaignDetail'], pool: ['CampaignsTab', 'BrandPool'],
    };
    for (const [screen, [tab, name]] of Object.entries(CODES)) {
      expect([screen, noticeTarget({ data_json: { screen, ...full } })]).toEqual([screen, expect.objectContaining({ tab, screen: name })]);
    }
    expect(noticeTarget({ data_json: { screen: 'brand_pitch', pitch_id: 'p1' } })).toEqual({ tab: 'CreatorsTab', screen: 'BrandPitch', params: { pitchId: 'p1' } });
    expect(noticeTarget({ data_json: { screen: 'wallet' } })).toEqual({ tab: 'WalletTab' });
    // a collaboration notice missing an id opens nothing rather than a broken screen
    expect(noticeTarget({ data_json: { screen: 'brand_content', campaign_influencer_id: 'ci' } })).toBeNull();
    for (const type of ['brand_new_order', 'brand_order_cancelled', 'brand_replace_approved', 'brand_refund_item_requested', 'brand_return_approved']) {
      expect([type, brandNoticeTarget({ type, data_json: { order_id: 'o' } })]).toEqual([type, { web: ORDERS_WEB_PATH }]);
    }
    expect(brandNoticeTarget({ type: 'account.approved', data_json: {} })).toBeNull();
  });
});

describe('the creator\'s notices — the eight kinds that did nothing when tapped (H4)', () => {
  const to = (data_json) => anyTargetOf({ data_json });
  const inCollabs = (screen, params) => ({ name: 'CollabsTab', params: { screen, params, initial: false } });
  it('each opens its screen now; the five that worked keep the routes they had', () => {
    expect(to({ screen: 'my_content', campaign_influencer_id: 'ci1' })).toEqual(inCollabs('Content', { ciId: 'ci1' }));
    expect(to({ screen: 'my_shoot', campaign_influencer_id: 'ci1' })).toEqual(inCollabs('Shoot', { ciId: 'ci1' }));
    expect(to({ screen: 'my_remote', campaign_influencer_id: 'ci1' })).toEqual(inCollabs('MyRemote', { ciId: 'ci1' }));
    expect(to({ screen: 'invitation_thread', campaign_influencer_id: 'ci1' })).toEqual(inCollabs('Thread', { ciId: 'ci1' }));
    expect(to({ screen: 'my_pitch', pitch_id: 'p1' })).toEqual(inCollabs('MyPitch', { pitchId: 'p1' }));
    expect(to({ screen: 'wallet' })).toEqual({ name: 'WalletTab', params: undefined });
    expect(to({ screen: 'earnings' })).toEqual({ name: 'WalletTab', params: undefined });
    expect(to({ screen: 'collabs' })).toEqual({ name: 'CollabsTab', params: undefined });
    // unchanged
    expect(to({ screen: 'invitation', campaign_influencer_id: 'ci1' })).toEqual({ name: 'Invitation', params: { ciId: 'ci1' } });
    expect(to({ screen: 'my_going_live', campaign_influencer_id: 'ci1' })).toEqual({ name: 'SaleLive', params: { ciId: 'ci1' } });
    expect(to({ screen: 'creator_sell', campaign_influencer_id: 'ci1' })).toEqual({ name: 'CreatorSell', params: { ciId: 'ci1' } });
    expect(to({ screen: 'post', post_id: 'p1' })).toEqual({ name: 'CreateTab', params: { screen: 'PostStatus', params: { postId: 'p1' }, initial: false } });
    expect(to({ screen: 'something_else' })).toBeNull();
  });
});

/* ══════════════════════════════════════════ every destination exists */

describe('every destination the server can name is a screen that exists (check 10)', () => {
  const NAV = path.resolve(__dirname, '..', '..', 'navigation');
  /** stack → the screen names registered in it */
  const registered = (file) => {
    const out = {};
    for (const m of fs.readFileSync(path.join(NAV, file), 'utf8').matchAll(/<(\w+)Stack\.Screen name="(\w+)"/g)) (out[m[1]] = out[m[1]] || []).push(m[2]);
    return out;
  };
  const STACK_OF = { CampaignsTab: 'Campaigns', CreatorsTab: 'Creators', WalletTab: 'Wallet', ProfileTab: 'Profile', CollabsTab: 'Collabs', CreateTab: 'Create' };
  const open = { campaignId: 'c', setId: 's', ciId: 'ci', pitchId: 'p', postId: 'po' };

  it('the brand: every `open.screen` backend home.service sends', () => {
    const stacks = registered('BrandNavigator.js');
    // from home.service brandStep / brandSigned / the Remote extras / brandCountRows
    const SCREENS = ['agreement', 'agreementPreview', 'thread', 'set', 'shoot', 'remote', 'content', 'goingLive', 'pitches', 'pool', 'withdrawals', 'walletDetails'];
    for (const screen of SCREENS) {
      const t = brandTarget({ ...open, screen });
      expect([screen, !!t && !!t.tab]).toEqual([screen, true]);
      expect([screen, stacks[STACK_OF[t.tab]].includes(t.screen)]).toEqual([screen, true]);
    }
    expect(brandTarget({ screen: 'ordersWeb' })).toEqual({ web: ORDERS_WEB_PATH });
    expect(brandTarget({ screen: 'nonsense' })).toBeNull();
    // the Home stack's own screens and the first-day buttons
    expect(stacks.Home).toEqual(['BrandHome', 'BrandNeedsYou', 'BrandWaiting', 'BrandNotifications']);
    for (const name of ['BrandCampaignNew', 'BrandCampaignDetail', 'BrandCampaigns']) expect([name, stacks.Campaigns.includes(name)]).toEqual([name, true]);
    for (const name of ['BrandWalletLocked', 'BrandWalletSales']) expect([name, stacks.Wallet.includes(name)]).toEqual([name, true]);
  });

  it('the creator: every `open.screen` backend home.service sends', () => {
    const stacks = registered('InfluencerNavigator.js');
    const SCREENS = ['invitation', 'thread', 'agreement', 'shoot', 'shootThread', 'remote', 'remoteAddress', 'remoteAddressCorrect', 'content', 'goingLive',
      'postStatus', 'pitchThread', 'pitch', 'yourNumbers', 'invitationSettings', 'walletDetails', 'withdrawals'];
    for (const screen of SCREENS) {
      const t = creatorTarget({ ...open, screen });
      expect([screen, !!t && !!t.tab]).toEqual([screen, true]);
      expect([screen, stacks[STACK_OF[t.tab]].includes(t.screen)]).toEqual([screen, true]);
    }
    expect(creatorTarget({ ...open, screen: 'remoteAddressCorrect' }).params).toEqual({ ciId: 'ci', correcting: true });
    expect(creatorTarget({ ...open, screen: 'createPost' })).toEqual({ create: 'ci' });
    expect(stacks.Home).toEqual(['CreatorHome', 'CreatorNeedsYou', 'CreatorWaiting']);
    for (const name of ['PostType', 'PostStatus']) expect([name, stacks.Create.includes(name)]).toEqual([name, true]);
    for (const name of ['CreatorNotifications', 'FindBrands', 'Collabs']) expect([name, stacks.Collabs.includes(name)]).toEqual([name, true]);
    for (const name of ['CreatorWalletPayments', 'CreatorWalletCommission']) expect([name, stacks.Wallet.includes(name)]).toEqual([name, true]);
  });
});

/* ══════════════════════════════════════════ one rule, two places */

describe('the server\'s lists and the phone\'s row rule agree (checks 3, 4)', () => {
  const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'home19-rows.json'), 'utf8'));
  const brand = FIX.filter((p) => p.side === 'brand');
  const creator = FIX.filter((p) => p.side === 'creator');
  const name = (p) => `${p.label} → ${p.verdict ? `${p.verdict.side}:${p.verdict.kind}` : 'neither'}`;

  it('the fixture covers every stage: before signing, the visit, Remote, content, going live', () => {
    expect(brand.length).toBeGreaterThanOrEqual(24);
    expect(creator.length).toBe(brand.length);
    for (const stage of ['pre ·', 'visit ·', 'remote ·', 'content ·', 'sale ·', 'hybrid ·']) expect([stage, FIX.some((p) => p.label.startsWith(stage))]).toEqual([stage, true]);
    // and both verdicts, on both sides
    for (const list of [brand, creator]) for (const side of ['needs', 'waiting']) expect(list.some((p) => p.verdict && p.verdict.side === side)).toBe(true);
  });

  it.each(brand.map((p) => [name(p), p]))('brand · %s', (_, p) => {
    const step = setRowStep(p.row, new Date(p.now).getTime());
    if (p.addition) return;                                    // reached from state the row cannot see
    if (p.verdict && p.verdict.side === 'needs') {
      // Needs you ⇔ the set row carries a BUTTON, and Home's word for it is the set row's word
      expect(step).toMatchObject({ kind: 'button' });
      expect(BRAND_BUTTON[p.verdict.kind]).toBe(step.label);
    } else {
      // Waiting, or in neither list ⇔ the set row carries a tag (or nothing), never a button
      expect(step && step.kind).not.toBe('button');
      if (step && step.tone === 'waiting') expect(p.verdict).toMatchObject({ side: 'waiting' });
    }
  });

  it.each(creator.map((p) => [name(p), p]))('creator · %s', (_, p) => {
    const step = cardStep(p.row);
    if (p.addition) return;
    if (p.verdict && p.verdict.side === 'needs') {
      expect(step && step.button).toBeTruthy();
      expect(buttonFor('creator', p.verdict.kind)).toBe(step.button);
    } else {
      expect(step ? step.button : null).toBeNull();
    }
  });

  it('every kind of row the server can put in Needs you has a button word', () => {
    // the brand's kinds (home.service) — a missing one would fall back to "Open" silently
    for (const kind of ['sign', 'send_agreement', 'reply', 'reply_move', 'reply_time', 'plan_visit', 'confirm_shoot', 'review', 'confirm_live', 'book_parcel',
      'rebook', 'difference', 'confirm_return', 'pitches', 'pool', 'orders', 'withdrawal_failed', 'add_bank']) {
      expect([kind, typeof BRAND_BUTTON[kind]]).toEqual([kind, 'string']);
    }
    expect(BRAND_BUTTON.sign).toBe('Sign');
    expect(BRAND_BUTTON.send_agreement).toBe('Send agreement');
    expect(BRAND_BUTTON.confirm_live).toBe('Confirm live');
    expect(buttonFor('creator', 'sign')).toBe('Review & sign');
    expect(buttonFor('creator', 'check_parcel')).toBe('Open');
    expect(buttonFor('creator', 'post_needed')).toBe('Start');
    expect(buttonFor('creator', 'post_sent_back')).toBe('Fix');
  });
});

/* ══════════════════════════════════════════ the count on the tab (H6) */

describe('the count on the Home tab', () => {
  it('is read for an approved account, at most once per throttle, and never for one under review', async () => {
    brandApi.getHomeCount.mockResolvedValue(ok({ needs: 4, unread: 1 }));
    await act(async () => { await refreshHomeCount('brand', { force: true }); });
    expect(getHomeCount()).toEqual({ needs: 4, unread: 1 });
    brandApi.getHomeCount.mockResolvedValue(ok({ needs: 6, unread: 0 }));
    await act(async () => { await refreshHomeCount('brand'); });          // inside the throttle: not asked
    expect(brandApi.getHomeCount).toHaveBeenCalledTimes(1);
    expect(getHomeCount().needs).toBe(4);
    await act(async () => { await refreshHomeCount('brand', { force: true }); });
    expect(getHomeCount()).toEqual({ needs: 6, unread: 0 });
    expect(THROTTLE_MS).toBeGreaterThanOrEqual(10000);

    // a failed read keeps the last number
    brandApi.getHomeCount.mockResolvedValue(fail);
    await act(async () => { await refreshHomeCount('brand', { force: true }); });
    expect(getHomeCount().needs).toBe(6);

    // under review: nothing is asked (the read would raise the "not approved yet" sheet)
    jest.clearAllMocks();
    setAccountStatus('pending');
    await act(async () => { await refreshHomeCount('creator', { force: true }); });
    expect(influencerApi.getHomeCount).not.toHaveBeenCalled();
  });

});
