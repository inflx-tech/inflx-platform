/**
 * ui-walk-fixes — board C on the brand's "setting up" screens (slice C1a): new campaign, new set,
 * Add creators (to a set and to a group), the group check, a creator's terms, Review and send, the
 * pool, branches, the Groups segment, one collaboration's payments, Add money and the GST / bank
 * form.
 *
 * Before: each of these drew its main button in a bar laid OVER the page (`position: 'absolute',
 * bottom: 0`). The bar rode up with the keypad and sat on the box being typed in, and every page
 * carried 110–140 of empty space at its end just to scroll clear of it. Now, on every one:
 *   · the column is title row → the box that holds the page → the strip (BottomBar); nothing floats;
 *   · a page with a text box is a FormScroll (the counter, hint and error line under the box being
 *     typed in are brought into view above the strip);
 *   · the empty space that cleared the floating bar is gone;
 *   · the toast is drawn inside the box above the strip, 16 above it;
 *   · with the keypad closed nothing else changes (U10): every control, line and testID is kept.
 *
 * Also here: the banner on Review and send no longer says "Fix them" about a creator who was
 * refused by one of her own invitation rules (D2, wave-2 review).
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Keyboard, ScrollView, StyleSheet, TextInput } from 'react-native';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    // new campaign · new set
    createCampaign: jest.fn(), campaignSummary: jest.fn(), createCampaignSet: jest.fn(), updateCampaignSet: jest.fn(), listBranches: jest.fn(),
    // Add creators · the group check · terms · Review and send
    setSummary: jest.fn(), pickable: jest.fn(), listGroups: jest.fn(), groupCheck: jest.fn(), checkEligibility: jest.fn(), sendInvitations: jest.fn(),
    offerChoices: jest.fn(), productsWithoutOffersForSet: jest.fn(), getListingTree: jest.fn(),
    // groups
    getGroup: jest.fn(), addGroupMembers: jest.fn(), discoverCreators: jest.fn(), workedWith: jest.fn(), createGroup: jest.fn(),
    // the pool
    getPool: jest.fn(), poolSetDefaults: jest.fn(), removeFromPool: jest.fn(), campaignsSummary: jest.fn(),
    // branches
    makeMainBranch: jest.fn(), removeBranch: jest.fn(),
    // money
    createTopup: jest.fn(), verifyTopup: jest.fn(), updateMe: jest.fn(),
  },
  influencerApi: {},
  referenceApi: {
    brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    creatorNiches: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    languages: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    states: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    offeredStates: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
  },
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../services/payment', () => ({ processPayment: jest.fn() }));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../../services/api');
const BrandCampaignNewScreen = require('../BrandCampaignNewScreen').default;
const BrandSetEditScreen = require('../BrandSetEditScreen').default;
const BrandSetPickCreatorsScreen = require('../BrandSetPickCreatorsScreen').default;
const BrandGroupAddCreatorsScreen = require('../BrandGroupAddCreatorsScreen').default;
const BrandGroupInviteCheckScreen = require('../BrandGroupInviteCheckScreen').default;
const BrandCreatorTermsScreen = require('../BrandCreatorTermsScreen').default;
const BrandReviewSendScreen = require('../BrandReviewSendScreen').default;
const BrandPoolScreen = require('../BrandPoolScreen').default;
const BrandBranchesScreen = require('../BrandBranchesScreen').default;
const BrandCreatorsScreen = require('../BrandCreatorsScreen').default;
const { GroupsPane } = require('../BrandCreatorsScreen');
const { BrandWalletCollabScreen } = require('../BrandWalletLockedScreen');
const BrandAddMoneyScreen = require('../BrandAddMoneyScreen').default;
const BrandPayoutDetailScreen = require('../BrandPayoutDetailScreen').default;
const { C5 } = require('../../../components/invitations/copy5');
const draft = require('../../../components/invitations/draft5');
const { settingsTokens: T } = require('../../../theme/tokens');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), reset: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const refused = (message, extra = {}) => ({ success: false, error: { code: 'VALIDATION_ERROR', message, ...extra } });
const yr = new Date().getFullYear();
const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const says = (el, text) => within(el).getByText(text);

/** [root, …, node] for the first node (document order) that matches. */
function pathTo(node, match, trail = []) {
  if (!node || typeof node === 'string') return null;
  const here = [...trail, node];
  if (match(node)) return here;
  for (const child of node.children || []) {
    const found = pathTo(child, match, here);
    if (found) return found;
  }
  return null;
}
const all = (node, match, out = []) => {
  if (!node || typeof node === 'string') return out;
  if (match(node)) out.push(node);
  (node.children || []).forEach(c => all(c, match, out));
  return out;
};
const withId = (id) => (n) => !!n.props && n.props.testID === id;
const isScroll = (n) => n.type === 'RCTScrollView';
const elements = (node) => (node.children || []).filter(c => typeof c !== 'string');

/* ── the server's answers ─────────────────────────────────────────────────── */
const RULES = { today: `${yr}-09-12`, earliestPostingDate: `${yr}-09-19`, minDaysAhead: 7, cutoffDaysBefore: 3 };
const SET = { id: 'sA', campaignId: 'c1', name: 'Set A · Ethnic wear', state: 'live', goal: 'conversion', shootMode: 'visit',
  branch: { id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad' }, postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysToCutoff: 4, cutoffPassed: false,
  counts: { invited: 0, signed: 0, waiting: 0, declined: 0 }, canInvite: { ok: true } };
const SUMMARY = { set: SET, campaign: { id: 'c1', name: 'Diwali Edit 2026' }, creators: { order: [], groups: {} }, dateRules: RULES };
const SENTENCE = "Kavya isn't taking Pay for Sale collaborations.";
const CREATORS = [
  { id: 'p', name: 'Priya Sharma', nicheLabel: 'Fashion', cityName: 'Hyderabad', instagram: 48200, pick: { state: 'ok' } },
  { id: 'k', name: 'Kavya D.', nicheLabel: 'Fashion', cityName: 'Hyderabad', instagram: 12000,
    pick: { state: 'ineligible', reason: 'NOT_MATCHING', detail: 'aim', label: 'Not taking Pay for Sale', message: SENTENCE, inSet: 'none' } },
];
const CHECK = {
  group: { id: 'g1', name: 'Diwali shortlist', memberCount: 3 },
  set: { id: 'sA', name: 'Set A · Ethnic wear', goal: 'conversion', shootMode: 'visit', postingDate: `${yr}-10-20` },
  counts: { can: 1, cannot: 1, total: 2 },
  can: [{ id: 'p', name: 'Priya Sharma' }],
  cannot: [{ id: 'k', name: 'Kavya D.', label: 'Not taking Pay for Sale', message: SENTENCE, detail: 'aim',
    pick: { state: 'ineligible', reason: 'NOT_MATCHING', detail: 'aim', label: 'Not taking Pay for Sale', message: SENTENCE, inSet: 'none' } }],
};
const GROUP = { group: { id: 'g1', name: 'Diwali shortlist', memberCount: 12, capacityLeft: 88 }, memberIds: ['m'] };
const DISCOVER = [
  { id: 's', name: 'Sneha N.', avatarUrl: null, nicheLabel: 'Fashion', cityName: 'Eluru', languages: ['Telugu'], instagram: 18400, youtube: 6300, engagement: 5.1,
    acceptedAims: ['conversion'], acceptedModes: ['visit'], status: 'OK', blockedByYou: false },
];
const POOL = { total: 1, groups: [{ key: `date:${yr}-10-27`, title: 'Want 27 Oct', count: 1, rows: [
  { entryId: 'e1', state: 'waiting', creator: { id: 'r', name: 'Ritu V.', avatarUrl: null }, goal: 'conversion', terms: { commissionPct: 12 }, termsLine: '12%',
    wantsGoLiveDate: `${yr}-10-27`, wantsShootMode: null, daysLeft: 22, closingSoon: false, noLongerPossible: false, selectable: true, agreedAt: `${yr}-09-13T10:00:00Z`, from: {} },
] }] };
const BRANCHES = [
  { id: 'b1', name: 'Banjara Hills', isMain: true, formattedAddress: 'Road No. 12, Banjara Hills', cityName: 'Hyderabad', stateName: 'Telangana', pincode: '500034' },
  { id: 'b2', name: 'Kondapur', isMain: false, formattedAddress: 'Botanical Garden Road', cityName: 'Hyderabad', stateName: 'Telangana', pincode: '500084' },
];
const COLLAB = { ciId: 'ci2', setId: 's2', setName: 'Set A', campaignId: 'c2', campaignName: 'Winter Run', aim: 'engagement', aimLabel: 'Pay for Content',
  creatorName: 'Meera Rao', amount: 12000, paid: 6000, locked: 6000, refunded: 0, campaignFee: 960, next: null,
  payments: [
    { n: 1, label: 'At signing · 25%', amount: 3000, status: 'released', paid: true, paidAt: '2026-10-02T06:00:00.000Z', dueAt: null },
    { n: 2, label: 'When confirmed live · 25%', amount: 3000, status: 'released', paid: true, paidAt: '2026-10-24T06:00:00.000Z', dueAt: null },
    { n: 3, label: 'Final 50%', amount: 6000, status: 'queued', paid: false, paidAt: null, dueAt: '2026-10-31T00:00:00.000Z' },
  ] };

/** A draft of invitations for set sA, as the picker leaves it. `goal` decides the shape of the terms screen. */
function startDraft(goal, ids = ['p']) {
  const names = { p: 'Priya Sharma', k: 'Kavya D.', d: 'Divya R.' };
  draft.startDraft('sA', { set: { ...SET, goal }, campaignName: 'Diwali Edit 2026', creators: ids.map(id => ({ id, name: names[id] })), sourceGroupId: null });
  for (const id of ids) {
    draft.setTerms('sA', id, goal === 'engagement'
      ? { ...draft.defaultTerms('engagement'), fee: '8000' }
      : { ...draft.defaultTerms('conversion'), commissionPct: '10', sellMode: 'all', sellAllCount: 40 });
  }
}

// jest has no keypad: the two events React Native sends are fired by hand.
let pad;
let errorSpy;
beforeEach(() => {
  jest.useFakeTimers();                      // a touchable's press fade and the toast's fade stay inside act()
  jest.clearAllMocks();
  draft.clearBasket('sA');
  draft.clearDraft('sA');
  brandApi.campaignSummary.mockResolvedValue(ok({ dateRules: RULES }));
  brandApi.listBranches.mockResolvedValue(ok({ branches: BRANCHES }));
  brandApi.setSummary.mockResolvedValue(ok(SUMMARY));
  brandApi.pickable.mockResolvedValue(ok({ total: 2, page: 1, rows: CREATORS }));
  brandApi.listGroups.mockResolvedValue(ok({ groups: [{ id: 'g1', name: 'Diwali shortlist', memberCount: 12, openCount: 9, avatars: [], createdAt: `${yr}-09-01T10:00:00Z` }] }));
  brandApi.groupCheck.mockResolvedValue(ok(CHECK));
  brandApi.checkEligibility.mockResolvedValue(ok({ results: [] }));
  brandApi.getGroup.mockResolvedValue(ok(GROUP));
  brandApi.discoverCreators.mockResolvedValue(ok({ total: 1, page: 1, rows: DISCOVER }));
  brandApi.workedWith.mockResolvedValue(ok({ total: 1, page: 1, rows: [{ influencerId: 'w', name: 'Wamiqa', avatarUrl: null, instagramHandle: 'wamiqa', collaborations: 2, lastSignedAt: `${yr}-08-01T10:00:00Z` }] }));
  brandApi.getPool.mockResolvedValue(ok(POOL));
  brandApi.offerChoices.mockResolvedValue(ok({ posting_date: `${yr}-10-20`, offers: [], hidden: [] }));
  brandApi.productsWithoutOffersForSet.mockResolvedValue(ok({ posting_date: `${yr}-10-20`, products: [] }));
  brandApi.getListingTree.mockResolvedValue(ok({ tree: [] }));

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
  // React reports a clash of keys and similar tree mistakes only here; every test must leave it silent.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errorSpy.mock.calls.map(c => c.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  pad.restore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

/* ── the screens ──────────────────────────────────────────────────────────── */
const setRoute = { params: { campaignId: 'c1', setId: 'sA' } };
const SCREENS = [
  // name · the screen · something only there once it has loaded · its strip · what the strip holds, in order · other things that must still be there · does this file's own scroller fill the box
  ['New campaign', () => <BrandCampaignNewScreen navigation={nav()} route={{ params: {} }} />,
    'campaign-name', 'campaign-new-bar', ['campaign-next'], ['campaign-brief', 'campaign-name-counter', 'campaign-brief-counter', 'allow-negotiation']],
  ['New set', () => <BrandSetEditScreen navigation={nav()} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES } }} />,
    'set-name', 'set-edit-bar', ['save-set'], ['set-name-counter', 'aim-conversion', 'aim-engagement', 'aim-hybrid', 'mode-visit', 'mode-shipment', 'posting-date']],
  ['Add creators (to a set)', () => <BrandSetPickCreatorsScreen navigation={nav()} route={setRoute} />,
    'select-p', 'pick-footer', ['pick-next'], ['pick-subline', 'pick-tabs', 'discover-search', 'open-filters']],
  ['Add creators (to a group)', () => <BrandGroupAddCreatorsScreen navigation={nav()} route={{ params: { groupId: 'g1', groupName: 'Diwali shortlist' } }} />,
    'select-s', 'group-add-footer', ['capacity-line', 'add-selected'], ['group-add-subline', 'add-tabs', 'discover-search', 'open-filters']],
  ['Invite a group', () => <BrandGroupInviteCheckScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', groupId: 'g1', groupName: 'Diwali shortlist' } }} />,
    'group-summary', 'group-check-bar', ['group-running', 'group-next'], ['will-title', 'cant-title', 'member-k']],
  ['Terms for a creator', () => { startDraft('engagement'); return <BrandCreatorTermsScreen navigation={nav()} route={{ params: { ...setRoute.params, index: 0 } }} />; },
    'note', 'terms-bar', ['terms-next'], ['fee', 'note-counter', 'usage-switch', 'locked-set', 'deliverables-add']],
  ['Review and send', () => { startDraft('conversion', ['p', 'k']); return <BrandReviewSendScreen navigation={nav()} route={setRoute} />; },
    'review-row-p', 'review-send-bar', ['send-invitations'], ['review-row-k', 'locked-set']],
  ['The pool', () => <BrandPoolScreen navigation={nav()} route={{ params: {} }} />,
    'aim-hint', 'pool-bar', ['pool-create-set'], ['pool-e1', `pool-group-date:${yr}-10-27`]],
  ['Branches', () => <BrandBranchesScreen navigation={nav()} route={{ params: {} }} />,
    'branch-b2', 'branches-bar', ['add-branch'], ['branch-b1', 'branch-edit-b1', 'branch-make-main-b2', 'branch-remove-b2', 'branches-hint']],
  ['Creators › Groups', () => <GroupsPane navigation={nav()} />,
    'group-g1', 'groups-bar', ['new-group'], []],
  ['One collaboration\'s payments', () => <BrandWalletCollabScreen navigation={nav()} route={{ params: { collab: COLLAB } }} />,
    'collab-open', 'collab-bar', ['collab-open'], ['collab-still-locked', 'collab-campaign-fee']],
];

async function mount(make, ready) {
  const r = render(make());
  await waitFor(() => r.getByTestId(ready));
  return r;
}

describe.each(SCREENS)('%s', (name, make, ready, barId, inBar, others) => {
  it('the strip is part of the column, straight under the box that holds the page — never floating over it', async () => {
    const r = await mount(make, ready);
    const root = r.toJSON();
    const kids = elements(root);
    const at = kids.findIndex(withId(barId));
    // A child of the screen itself, with the page's box directly above it…
    expect(at).toBeGreaterThan(0);
    expect(flat(kids[at - 1]).flex).toBe(1);
    // …the last thing in the column (pop-ups are closed)…
    expect(at).toBe(kids.length - 1);
    // …there once, and not inside anything that scrolls.
    expect(all(root, withId(barId))).toHaveLength(1);
    for (const scroller of all(root, isScroll)) expect(pathTo(scroller, withId(barId))).toBeNull();

    const bar = flat(kids[at]);
    expect(bar.position).toBeUndefined();
    expect(bar.bottom).toBeUndefined();
    expect(bar.left).toBeUndefined();
    expect(bar.right).toBeUndefined();
    expect(bar).toMatchObject({ padding: 14, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg });
  });

  it('what the strip held is still in it, in the same order, and the rest of the page is still there', async () => {
    const r = await mount(make, ready);
    const bar = pathTo(r.toJSON(), withId(barId)).pop();
    const order = all(bar, n => !!n.props && inBar.includes(n.props.testID)).map(n => n.props.testID);
    expect(order).toEqual(inBar);
    for (const id of others) r.getByTestId(id);
  });

  it('the empty space that scrolled the page clear of the floating bar is gone', async () => {
    const r = await mount(make, ready);
    const root = r.toJSON();
    const scrollers = all(root, isScroll);
    expect(scrollers.length).toBeGreaterThan(0);
    for (const scroller of scrollers) {
      const pad = StyleSheet.flatten(scroller.props.contentContainerStyle) || {};
      // 18 all round, or a normal 24 at the end — never the old 110 / 120 / 140.
      expect(pad.paddingBottom === undefined ? pad.padding || 0 : pad.paddingBottom).toBeLessThanOrEqual(24);
      const content = scroller.children[0];
      const spacers = elements(content).filter(c => !c.children && (flat(c).height || 0) >= 100);
      expect(spacers).toEqual([]);
    }
  });
});

describe('the page fills the box above the strip (so the strip is at the foot of the screen, and above the keypad)', () => {
  // The screens whose scroller is written in the screen's own file. On the two pickers the list is
  // DiscoverList's, inside a flex-1 box of its own.
  const OWN = SCREENS.filter(([name]) => !name.startsWith('Add creators'));
  it.each(OWN)('%s', async (name, make, ready) => {
    const r = await mount(make, ready);
    const scroller = pathTo(r.toJSON(), isScroll).pop();
    expect(flat(scroller).flex).toBe(1);
  });

  it('Branches: while loading and when it could not load, the strip is still at the foot — the box above it fills', async () => {
    let answer;
    brandApi.listBranches.mockReturnValue(new Promise((res) => { answer = res; }));
    const r = render(<BrandBranchesScreen navigation={nav()} route={{ params: {} }} />);
    const check = () => {
      const kids = elements(r.toJSON());
      const at = kids.findIndex(withId('branches-bar'));
      expect(at).toBe(kids.length - 1);
      expect(flat(kids[at - 1])).toEqual({ flex: 1 });
      r.getByTestId('add-branch');
    };
    r.getByTestId('skeleton');
    check();
    await act(async () => { answer({ success: false, error: { message: 'no' } }); });
    await waitFor(() => r.getByTestId('load-error'));
    check();
  });

  it('The pool: with nobody in it there is no strip at all (no empty band with a hairline)', async () => {
    brandApi.getPool.mockResolvedValue(ok({ total: 0, groups: [] }));
    const r = render(<BrandPoolScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('brand-pool'));
    expect(r.queryByTestId('pool-bar')).toBeNull();
    expect(r.queryByTestId('pool-create-set')).toBeNull();
  });
});

/* ── the three forms: the lines under the box being typed in ──────────────── */
describe.each([
  ['New campaign', SCREENS[0], 'campaign-brief', 64],
  ['New set', SCREENS[1], 'set-name', 64],
  // The fee box has a two-line hint and the red line under it.
  ['Terms for a creator', SCREENS[5], 'note', 80],
])('%s — a form', (name, [, make, ready], box, below) => {
  it('is a FormScroll: fills the box, keeps taps alive, listens for focus and for its own size; 18 all round', async () => {
    const r = await mount(make, ready);
    const trail = pathTo(r.toJSON(), isScroll);
    // screen → the box above the strip → the form: not buried any deeper.
    expect(trail).toHaveLength(3);
    expect(flat(trail[1])).toEqual({ flex: 1 });
    const form = trail[2];
    expect(flat(form)).toEqual({ flex: 1 });
    expect(form.props.keyboardShouldPersistTaps).toBe('handled');
    expect(typeof form.props.onFocus).toBe('function');
    expect(typeof form.props.onLayout).toBe('function');
    expect(StyleSheet.flatten(form.props.contentContainerStyle)).toEqual({ padding: 18 });
  });

  it('typing in a box near the end: the counter, hint and error line under it come into view above the strip', async () => {
    const r = await mount(make, ready);
    const scroll = r.UNSAFE_getAllByType(ScrollView)[0].instance;
    // The form's content on screen: the box is 640 down it and at 268 on screen, so it starts at -372.
    scroll.getInnerViewRef = () => ({ _nativeTag: 7, measureInWindow: (cb) => cb(0, -372, 360, 900) });
    scroll.getNativeScrollRef = () => null;
    scroll.measureInWindow = (cb) => cb(0, 54, 360, 260);        // the room left above the strip and the keypad
    scroll.scrollTo = jest.fn();
    const spy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureLayout: (rel, done) => done(18, 640, 324, 46),
      measureInWindow: (cb) => cb(18, 268, 324, 46),                // its bottom edge on the room's bottom edge
    });
    try {
      fireEvent(r.getByTestId(box), 'focus');
      expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 640 + 46 + below - 260, animated: true });
    } finally {
      spy.mockRestore();
    }
  });

  it('the keypad opening (the form getting shorter) does the same for the box that has the cursor', async () => {
    const r = await mount(make, ready);
    const sv = r.UNSAFE_getAllByType(ScrollView)[0];
    const scroll = sv.instance;
    scroll.getInnerViewRef = () => ({ _nativeTag: 7, measureInWindow: (cb) => cb(0, -372, 360, 900) });
    scroll.getNativeScrollRef = () => null;
    scroll.measureInWindow = (cb) => cb(0, 54, 360, 260);
    scroll.scrollTo = jest.fn();
    const spy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureLayout: (rel, done) => done(18, 640, 324, 46),
      measureInWindow: (cb) => cb(18, 268, 324, 46),
    });
    try {
      fireEvent(sv, 'layout', { nativeEvent: { layout: { height: 620 } } });
      expect(scroll.scrollTo).not.toHaveBeenCalled();              // a first layout moves nothing
      fireEvent(sv, 'layout', { nativeEvent: { layout: { height: 260 } } });
      expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 640 + 46 + below - 260, animated: true });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Terms for a creator', () => {
  it('the ref the deliverables chooser scrolls with is still the page\'s own ScrollView (board D, frame D2)', async () => {
    const Native = require('react-native/jest/MockNativeMethods');
    const WINDOW = { 'deliverables-list': [18, 470, 324, 220] };
    Native.measureInWindow.mockImplementation(function measure(cb) { cb(...(WINDOW[this.props.testID] || [18, 420, 172, 48])); });
    Native.measureLayout.mockImplementation((within_, done) => done(18, 900, 324, 220));
    try {
      startDraft('engagement');
      const r = render(<BrandCreatorTermsScreen navigation={nav()} route={{ params: { ...setRoute.params, index: 0 } }} />);
      await waitFor(() => r.getByTestId('note'));
      // The page: a FormScroll now. What the chooser holds must be that very ScrollView.
      const scroll = r.UNSAFE_getAllByType(ScrollView)[0].instance;
      scroll.measureInWindow = (cb) => cb(0, 100, 360, 500);
      scroll.getInnerViewRef = () => ({});
      scroll.scrollTo = jest.fn();
      fireEvent.press(r.getByTestId('deliverables-add'));
      act(() => { fireEvent(r.getByTestId('deliverables-list'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 324, height: 220 } } }); });
      // The opened list ran under the bottom edge; the page is moved by exactly the overlap.
      // ASSERTION DRIFT (06-diff/drift/E.md): 716 → 636. The gap kept clear under the list was 96,
      // for a button strip that floated over the page; no home of the chooser has one now, so it
      // is an ordinary 16: 690 − (600 − 16) = 106 further than the 530 the page is at.
      expect(scroll.scrollTo).toHaveBeenCalledTimes(1);
      expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 636, animated: true });
    } finally {
      Native.measureInWindow.mockReset(); Native.measureLayout.mockReset();
    }
  });

  it('Pay for Sale: the same strip, "Next creator" on all but the last creator and "Review and send" on the last', async () => {
    startDraft('conversion', ['p', 'k']);
    const first = render(<BrandCreatorTermsScreen navigation={nav()} route={{ params: { ...setRoute.params, index: 0 } }} />);
    await waitFor(() => first.getByTestId('commission'));
    says(first.getByTestId('terms-bar'), 'Next creator');
    first.getByTestId('everyone-switch'); first.getByTestId('sell-offers'); first.getByTestId('sell-products'); first.getByTestId('shoppable-row');
    first.unmount();
    const last = render(<BrandCreatorTermsScreen navigation={nav()} route={{ params: { ...setRoute.params, index: 1 } }} />);
    await waitFor(() => last.getByTestId('commission'));
    says(last.getByTestId('terms-bar'), 'Review and send');
  });
});

/* ── the toast: just above the strip ──────────────────────────────────────── */
describe('the toast is drawn inside the box above the strip, 16 above it — not at the screen\'s root, 110 up', () => {
  function expectToastAboveStrip(r, barId) {
    const root = r.toJSON();
    const trail = pathTo(root, withId('toast'));
    // screen → the box above the strip → the toast
    expect(trail).toHaveLength(3);
    const area = trail[1];
    expect(flat(area)).toEqual({ flex: 1 });
    // the toast is the last thing in that box, so it lies over the page, not under it
    expect(elements(area).pop().props.testID).toBe('toast');
    const kids = elements(root);
    if (barId) expect(kids[kids.indexOf(area) + 1].props.testID).toBe(barId);
    else expect(kids.indexOf(area)).toBe(kids.length - 1);
    expect(flat(r.getByTestId('toast'))).toMatchObject({ position: 'absolute', left: 16, right: 16, bottom: 16 });
  }

  it('New campaign — a refusal the form has no line for', async () => {
    brandApi.createCampaign.mockResolvedValue(refused('Limit reached on the free plan.', { field: 'createCampaign' }));
    const r = await mount(SCREENS[0][1], 'campaign-name');
    fireEvent.changeText(r.getByTestId('campaign-name'), 'Diwali Edit 2026');
    await act(async () => { fireEvent.press(r.getByTestId('campaign-next')); });
    await waitFor(() => r.getByTestId('toast'));
    says(r.getByTestId('toast'), 'Limit reached on the free plan.');
    expectToastAboveStrip(r, 'campaign-new-bar');
  });

  it('New set — the plan\'s set limit', async () => {
    brandApi.createCampaignSet.mockResolvedValue(refused('Limit reached on the free plan: sets per campaign (1 / 1).', { field: 'createSet' }));
    const r = await mount(() => <BrandSetEditScreen navigation={nav()} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES,
      poolDefaults: { goal: 'conversion', shoot_mode: 'shipment', go_live_date: `${yr}-10-27`, wantedDate: `${yr}-10-27`, creators: [{ influencerId: 'r', name: 'Ritu V.', entryId: 'e1', terms: {}, agreedAt: null }] } } }} />, 'set-name');
    fireEvent.changeText(r.getByTestId('set-name'), 'Set B');
    await act(async () => { fireEvent.press(r.getByTestId('save-set')); });
    await waitFor(() => r.getByTestId('toast'));
    expectToastAboveStrip(r, 'set-edit-bar');
  });

  it('Add creators (to a set) — why a creator can\'t be invited', async () => {
    const r = await mount(SCREENS[2][1], 'select-k');
    fireEvent.press(r.getByTestId('select-k'));
    says(r.getByTestId('toast'), SENTENCE);
    expectToastAboveStrip(r, 'pick-footer');
    // While she types the strip is away (B5): the toast is then just above the keypad.
    pad.show();
    expect(r.queryByTestId('pick-footer')).toBeNull();
    expectToastAboveStrip(r, null);
  });

  it('Add creators (to a group) — a refused add', async () => {
    brandApi.addGroupMembers.mockResolvedValue(refused('That group is full.'));
    const r = await mount(SCREENS[3][1], 'select-s');
    fireEvent.press(r.getByTestId('select-s'));
    await act(async () => { fireEvent.press(r.getByTestId('add-selected')); });
    await waitFor(() => r.getByTestId('toast'));
    expectToastAboveStrip(r, 'group-add-footer');
  });

  it('Invite a group — why a creator can\'t be invited', async () => {
    const r = await mount(SCREENS[4][1], 'group-summary');
    fireEvent.press(r.getByTestId('member-k'));
    says(r.getByTestId('toast'), SENTENCE);
    expectToastAboveStrip(r, 'group-check-bar');
  });

  it('Review and send — the sentence behind a refused creator', async () => {
    brandApi.sendInvitations.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: SENTENCE, details: { sent: 0, failures: [
      { influencerId: 'k', message: SENTENCE, detail: 'aim', label: 'Not taking Pay for Sale' },
    ] } } });
    const r = await mount(SCREENS[6][1], 'review-row-p');
    await act(async () => { fireEvent.press(r.getByTestId('send-invitations')); });
    await waitFor(() => r.getByTestId('failed-banner'));
    fireEvent.press(r.getByTestId('review-row-k'));
    says(r.getByTestId('toast'), SENTENCE);
    expectToastAboveStrip(r, 'review-send-bar');
  });

  it('The pool — the message it is opened with', async () => {
    const r = await mount(() => <BrandPoolScreen navigation={nav()} route={{ params: { toast: 'Tanvi is in your pool.' } }} />, 'aim-hint');
    says(r.getByTestId('toast'), 'Tanvi is in your pool.');
    expectToastAboveStrip(r, 'pool-bar');
  });

  it('Branches — "is your main branch now"', async () => {
    brandApi.makeMainBranch.mockResolvedValue(ok({}));
    const r = await mount(SCREENS[8][1], 'branch-b2');
    await act(async () => { fireEvent.press(r.getByTestId('branch-make-main-b2')); });
    await waitFor(() => r.getByTestId('toast'));
    says(r.getByTestId('toast'), 'Kondapur is your main branch now.');
    expectToastAboveStrip(r, 'branches-bar');
  });
});

/* ── the two Add creators screens ─────────────────────────────────────────── */
describe('Add creators — the strip steps away while she types and comes back as a strip', () => {
  it('to a set: gone with the keypad, back when it closes — in the column, with the basket row 10 above the button as before', async () => {
    const r = await mount(SCREENS[2][1], 'select-p');
    fireEvent.press(r.getByTestId('select-p'));
    r.getByTestId('pick-basket'); r.getByTestId('pick-count');
    pad.show();
    expect(r.queryByTestId('pick-footer')).toBeNull();
    expect(r.queryByTestId('pick-next')).toBeNull();
    // With the strip away the page's box is the last thing in the column: the list runs to the keypad.
    let kids = elements(r.toJSON());
    expect(flat(kids[kids.length - 1])).toEqual({ flex: 1 });
    pad.hide();
    kids = elements(r.toJSON());
    expect(kids[kids.length - 1].props.testID).toBe('pick-footer');
    const bar = kids[kids.length - 1];
    expect(flat(bar).position).toBeUndefined();
    expect(elements(bar).map(c => c.props.testID)).toEqual(['pick-basket', 'pick-next']);
    // 2 under the basket row + the strip's own 8 = the 10 it always had.
    expect(flat(bar).gap + flat(r.getByTestId('pick-basket')).marginBottom).toBe(10);
    says(r.getByTestId('pick-footer'), '1 selected');
    says(r.getByTestId('pick-footer'), 'Next: terms for 1 creator');
  });

  it('to a set: the Worked with and Pool lists end with a normal 24, and the Groups list is as it was', async () => {
    const r = await mount(SCREENS[2][1], 'select-p');
    const endOf = (id) => StyleSheet.flatten(pathTo(pathTo(r.toJSON(), withId(id)).pop(), isScroll).pop().props.contentContainerStyle).paddingBottom;
    expect(endOf('discover-list')).toBe(24);
    fireEvent.press(r.getByText('Worked with'));
    await waitFor(() => r.getByTestId('worked-pick'));
    await waitFor(() => r.getByTestId('select-p'));
    expect(endOf('worked-pick')).toBe(24);
    fireEvent.press(r.getByText('Pool'));
    await waitFor(() => r.getByTestId('pool-pick'));
    expect(StyleSheet.flatten(r.getByTestId('pool-pick').props.contentContainerStyle).paddingBottom).toBe(24);
    fireEvent.press(r.getByText('Groups'));
    await waitFor(() => r.getByTestId('groups-pick'));
    expect(StyleSheet.flatten(r.getByTestId('groups-pick').props.contentContainerStyle).paddingBottom).toBe(40);
    // The strip is under every tab.
    r.getByTestId('pick-footer');
  });

  it('to a group: gone with the keypad, back when it closes; the capacity line is 8 above the button as before', async () => {
    const r = await mount(SCREENS[3][1], 'select-s');
    pad.show();
    expect(r.queryByTestId('group-add-footer')).toBeNull();
    pad.hide();
    const kids = elements(r.toJSON());
    const bar = kids[kids.length - 1];
    expect(bar.props.testID).toBe('group-add-footer');
    expect(flat(bar).position).toBeUndefined();
    expect(elements(bar).map(c => c.props.testID)).toEqual(['capacity-line', 'add-selected']);
    expect(flat(bar).gap).toBe(8);
    expect(flat(r.getByTestId('capacity-line')).marginBottom).toBeUndefined();
    says(bar, 'Diwali shortlist can take 88 more creators.');
    // Worked with: the list ends with a normal 24.
    fireEvent.press(r.getByText('Worked with'));
    await waitFor(() => r.getByTestId('select-w'));
    const list = pathTo(pathTo(r.toJSON(), withId('worked-select')).pop(), isScroll).pop();
    expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingBottom).toBe(24);
  });
});

describe('Invite a group — the line above the button is the strip\'s first child in every state', () => {
  const route = { params: { campaignId: 'c1', setId: 'sA', groupId: 'g1', groupName: 'Diwali shortlist' } };
  const lineAndButton = (r) => {
    const kids = elements(pathTo(r.toJSON(), withId('group-check-bar')).pop());
    expect(kids).toHaveLength(2);
    expect(kids[0].type).toBe('Text');
    expect(flat(kids[0]).textAlign).toBe('center');
    expect(flat(kids[0]).marginBottom).toBeUndefined();     // the strip's 8 is the gap now
    expect(kids[1].props.testID).toBe('group-next');
    return kids[0];
  };

  it('some can be added: the running count, then the button', async () => {
    const r = render(<BrandGroupInviteCheckScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('group-summary'));
    expect(lineAndButton(r).props.testID).toBe('group-running');
    expect(r.getByTestId('group-next').props.accessibilityState.disabled).toBe(false);
  });

  it('everyone who can come is already in the selection: the grey line, the button off', async () => {
    draft.addToBasket('sA', [{ id: 'p', name: 'Priya Sharma', avatarUrl: null }], null);
    const r = render(<BrandGroupInviteCheckScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('group-summary'));
    says(r.getByTestId('group-check-bar'), C5.group.addNone);
    lineAndButton(r);
    expect(r.getByTestId('group-next').props.accessibilityState.disabled).toBe(true);
  });

  it('nobody can be invited: the grey line, the button off', async () => {
    brandApi.groupCheck.mockResolvedValue(ok({ ...CHECK, counts: { can: 0, cannot: 1, total: 1 }, can: [] }));
    const r = render(<BrandGroupInviteCheckScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('group-summary'));
    says(r.getByTestId('group-check-bar'), C5.group.nobody);
    lineAndButton(r);
    expect(r.getByTestId('group-next').props.accessibilityState.disabled).toBe(true);
  });
});

/* ── the Creators tab ─────────────────────────────────────────────────────── */
describe('the Creators tab', () => {
  it('Groups: the list ends with a normal 24 and "New group" is the strip under it', async () => {
    const r = render(<GroupsPane navigation={nav()} />);
    await waitFor(() => r.getByTestId('group-g1'));
    const [list, bar] = elements(r.toJSON());
    expect(list.type).toBe('RCTScrollView');
    expect(StyleSheet.flatten(list.props.contentContainerStyle)).toEqual({ padding: 18, paddingTop: 4, paddingBottom: 24 });
    expect(bar.props.testID).toBe('groups-bar');
    says(r.getByTestId('groups-bar'), 'New group');
  });

  it('Discover and Worked with are untouched: no strip, the browse list as it was', async () => {
    const r = render(<BrandCreatorsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('creator-s'));
    expect(r.queryByTestId('groups-bar')).toBeNull();
    const browse = pathTo(pathTo(r.toJSON(), withId('discover-list')).pop(), isScroll).pop();
    expect(StyleSheet.flatten(browse.props.contentContainerStyle)).toEqual({ padding: 18, paddingTop: 0, paddingBottom: 120 });
    fireEvent.press(r.getByText('Worked with'));
    await waitFor(() => r.getByTestId('worked-w'));
    r.getByTestId('worked-search');
    expect(r.queryByTestId('groups-bar')).toBeNull();
  });
});

/* ── forms that never had a floating bar ──────────────────────────────────── */
describe.each([
  ['Add money', () => <BrandAddMoneyScreen navigation={nav()} route={{ params: {} }} />, 'add-amount', 'add-money-submit', { padding: 18, paddingBottom: 60 }],
  ['GST number', () => <BrandPayoutDetailScreen navigation={nav()} route={{ params: { kind: 'gst' } }} />, 'payout-gstin', 'payout-save', { padding: 18, paddingBottom: 40 }],
  ['Bank account', () => <BrandPayoutDetailScreen navigation={nav()} route={{ params: { kind: 'bank' } }} />, 'payout-bank_ifsc', 'payout-save', { padding: 18, paddingBottom: 40 }],
])('%s — nothing floated here, and nothing moves', (name, make, box, button, padding) => {
  it('the page is a FormScroll with the padding it had; the button is still part of the page, not in a strip', async () => {
    const r = await mount(make, box);
    const root = r.toJSON();
    const trail = pathTo(root, isScroll);
    expect(trail).toHaveLength(2);                                  // straight under the screen, as before
    const form = trail[1];
    expect(flat(form)).toEqual({ flex: 1 });
    expect(form.props.keyboardShouldPersistTaps).toBe('handled');
    expect(typeof form.props.onFocus).toBe('function');
    expect(typeof form.props.onLayout).toBe('function');
    expect(StyleSheet.flatten(form.props.contentContainerStyle)).toEqual(padding);
    expect(pathTo(form, withId(button))).not.toBeNull();
    expect(pathTo(form, withId(box))).not.toBeNull();
  });

  it('typing in the box: the red line under it comes into view', async () => {
    const r = await mount(make, box);
    const scroll = r.UNSAFE_getAllByType(ScrollView)[0].instance;
    scroll.getInnerViewRef = () => ({ _nativeTag: 7, measureInWindow: (cb) => cb(0, -372, 360, 900) });
    scroll.getNativeScrollRef = () => null;
    scroll.measureInWindow = (cb) => cb(0, 54, 360, 260);
    scroll.scrollTo = jest.fn();
    const spy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureLayout: (rel, done) => done(18, 640, 324, 46),
      measureInWindow: (cb) => cb(18, 268, 324, 46),
    });
    try {
      fireEvent(r.getByTestId(box), 'focus');
      expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 490, animated: true });   // 640 + 46 + 64 - 260
    } finally {
      spy.mockRestore();
    }
  });
});

/* ── Review and send ──────────────────────────────────────────────────────── */
describe('Review and send', () => {
  const HER_RULE = { influencerId: 'k', name: 'Kavya D.', code: 'NOT_MATCHING', field: 'influencer_id', message: SENTENCE, detail: 'aim', label: 'Not taking Pay for Sale' };
  const HER_TERMS = { influencerId: 'd', name: 'Divya R.', code: 'VALIDATION_ERROR', field: 'commission_pct', message: 'Commission must be between 1% and 80%.', detail: null, label: null };
  async function refusedWith(failures, n = nav()) {
    startDraft('conversion', ['p', 'k', 'd']);
    brandApi.sendInvitations.mockResolvedValueOnce({ success: false, error: { code: 'VALIDATION_ERROR', message: failures[0].message, details: { sent: 0, failures } } });
    const r = render(<BrandReviewSendScreen navigation={n} route={setRoute} />);
    await waitFor(() => r.getByTestId('review-row-p'));
    await act(async () => { fireEvent.press(r.getByTestId('send-invitations')); });
    await waitFor(() => r.getByTestId('failed-banner'));
    return r;
  }

  it('the three sentences', () => {
    expect(C5.review.failedBody).toBe('Nothing was sent. Fix them, or remove them and send the rest.');
    expect(C5.review.failedBodyRemove).toBe("Nothing was sent. Changing their terms won't help — remove them and send the rest.");
    expect(C5.review.failedBodySome).toBe('Nothing was sent. Fix the ones you can, or remove them all and send the rest.');
  });

  // Final review, finding U10-04. The two new sentences are on no board and in no approved-words
  // list (D6); until now they were written down only in a drift file. Wording the founder has not
  // seen must be in the contract itself, word for word as the app says it, so it is shown at the
  // walk — decision U21 in 01-spec.md. If the wording changes, the contract changes with it.
  it('the two sentences that are on no board are recorded in the contract (decision U21), word for word', () => {
    const spec = fs.readFileSync(path.resolve(__dirname, '../../../../../..', 'features/ui-walk-fixes/01-spec.md'), 'utf8');
    const row = spec.split('\n').find(line => line.startsWith('| U21 |'));
    expect(row).toBeDefined();
    expect(row).toContain(`"${C5.review.failedBodyRemove}"`);
    expect(row).toContain(`"${C5.review.failedBodySome}"`);
    expect(row).toContain(`"${C5.review.failedBody}"`);
    expect(row).toContain('to be shown at the walk');
  });

  it('a creator refused by her OWN rule: the banner does not say "Fix them" — nothing on her terms can be fixed', async () => {
    const n = nav();
    const r = await refusedWith([HER_RULE], n);
    const banner = r.getByTestId('failed-banner');
    says(banner, "1 creator can't be invited");
    says(banner, C5.review.failedBodyRemove);
    expect(within(banner).queryByText(/Fix/)).toBeNull();
    // And it is true: her row has nothing to open — a tap only says why.
    fireEvent.press(r.getByTestId('review-row-k'));
    expect(n.navigate).not.toHaveBeenCalled();
    says(r.getByTestId('toast'), SENTENCE);
    // The way forward the banner names is there.
    says(r.getByTestId('remove-and-send'), 'Remove 1 and send the rest');
  });

  it('a refusal that CAN be fixed keeps today\'s sentence, and her row still opens her terms', async () => {
    const n = nav();
    const r = await refusedWith([HER_TERMS], n);
    const banner = r.getByTestId('failed-banner');
    says(banner, "1 creator can't be invited");
    says(banner, 'Nothing was sent. Fix them, or remove them and send the rest.');
    fireEvent.press(r.getByTestId('review-row-d'));
    expect(n.navigate).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 2 });
    // `navigate` is a stand-in here, so this only proves what was ASKED for. What the real
    // navigator does with it — and that a creator who is not the last one gets her own form, not
    // the last creator's — is proved on a real stack in termsFormPerCreator.test.js.
  });

  it('one of each: "Fix the ones you can, or remove them all and send the rest."', async () => {
    const r = await refusedWith([HER_RULE, HER_TERMS]);
    const banner = r.getByTestId('failed-banner');
    says(banner, "2 creators can't be invited");
    says(banner, C5.review.failedBodySome);
  });

  it('after a refusal the strip holds "Remove N and send the rest" above Send, 8 apart, and Send is off', async () => {
    const r = await refusedWith([HER_RULE, HER_TERMS]);
    const bar = pathTo(r.toJSON(), withId('review-send-bar')).pop();
    expect(elements(bar).map(c => c.props.testID)).toEqual(['remove-and-send', 'send-invitations']);
    expect(flat(bar).gap).toBe(8);
    // In the strip the outline button has no top gap of its own.
    expect(flat(r.getByTestId('remove-and-send')).marginTop).toBe(0);
    says(r.getByTestId('remove-and-send'), 'Remove 2 and send the rest');
    expect(r.getByTestId('send-invitations').props.accessibilityState.disabled).toBe(true);
    // Removing them sends the rest, as before.
    brandApi.sendInvitations.mockResolvedValueOnce(ok({ sent: 1, rows: [] }));
    await act(async () => { fireEvent.press(r.getByTestId('remove-and-send')); });
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalledTimes(2));
    expect(brandApi.sendInvitations.mock.calls[1][2].creators.map(c => c.influencerId)).toEqual(['p']);
  });
});

describe('One collaboration\'s payments', () => {
  it('the outline button fills the strip with no top gap of its own, and still opens the collaboration', async () => {
    const n = nav();
    const r = render(<BrandWalletCollabScreen navigation={n} route={{ params: { collab: COLLAB } }} />);
    expect(flat(r.getByTestId('collab-open')).marginTop).toBe(0);
    fireEvent.press(r.getByTestId('collab-open'));
    expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandSetDetail', params: { campaignId: 'c2', setId: 's2', name: 'Set A' }, initial: false });
  });
});

/* ── the source: no bar may go back to floating ───────────────────────────── */
describe('the source of the brand screens in this slice', () => {
  const DIR = path.join(__dirname, '..');
  // Built by the "working with a creator" slice of board C — not this file's to judge.
  const OTHERS = ['BrandAgreementScreen', 'BrandThreadScreen', 'BrandPitchScreen', 'BrandShootPlanScreen', 'BrandShootScreen', 'BrandRemoteScreen',
    'BrandRemoteBookScreen', 'BrandRemoteProductsScreen', 'BrandContentScreen', 'BrandSaleLiveScreen'];
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !OTHERS.includes(f.replace('.js', '')));
  const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
  const CONVERTED = ['BrandCampaignNewScreen.js', 'BrandSetEditScreen.js', 'BrandSetPickCreatorsScreen.js', 'BrandGroupAddCreatorsScreen.js', 'BrandGroupInviteCheckScreen.js',
    'BrandCreatorTermsScreen.js', 'BrandReviewSendScreen.js', 'BrandPoolScreen.js', 'BrandBranchesScreen.js'];

  it('covers every brand screen but the ten of the other slice', () => {
    expect(files.length).toBe(30);
    for (const f of CONVERTED) expect(files).toContain(f);
  });

  it.each(files)('%s — nothing is pinned to the bottom of the screen over the page', (f) => {
    const src = read(f);
    expect(src).not.toMatch(/position:\s*'absolute'[^}]*\bbottom:\s*0\b/);
    expect(src).not.toMatch(/\bbottom:\s*0\b[^}]*position:\s*'absolute'/);
    // …and no page carries the old clearance for such a bar. One list is left as it was: Worked
    // with on the Creators tab never had a bar over it, so its 120 is not this slice's to change.
    const clearance = src.match(/paddingBottom:\s*1[1-9]\d\b/g) || [];
    if (f === 'BrandCreatorsScreen.js') {
      expect(clearance).toHaveLength(1);
      expect(src.indexOf(clearance[0])).toBeGreaterThan(src.indexOf('export function WorkedWithPane'));
    } else {
      expect(clearance).toEqual([]);
    }
  });

  it.each(CONVERTED)('%s — the toast is asked for in-flow and drawn inside the box above the strip', (f) => {
    const src = read(f);
    expect(src).toContain('useToast({ inFlow: true })');
    expect(src).not.toMatch(/useToast\(\)/);
    const closeArea = src.lastIndexOf('</FormArea>');
    const toast = src.lastIndexOf('{toast}', closeArea);
    const bar = src.indexOf('<BottomBar', closeArea);
    expect(closeArea).toBeGreaterThan(-1);
    expect(toast).toBeGreaterThan(src.indexOf('<FormArea>'));
    expect(bar).toBeGreaterThan(closeArea);
    // No {toast} after the box closes (it would land on top of the strip).
    expect(src.indexOf('{toast}', closeArea)).toBe(-1);
  });

  it.each(['BrandCampaignNewScreen.js', 'BrandSetEditScreen.js', 'BrandCreatorTermsScreen.js', 'BrandAddMoneyScreen.js', 'BrandPayoutDetailScreen.js'])(
    '%s — a page with a text box scrolls in a FormScroll, not a plain ScrollView', (f) => {
      const src = read(f);
      expect(src).toMatch(/<FormScroll[\s>]/);
      expect(src).not.toMatch(/<ScrollView[\s>]/);
    });
});
