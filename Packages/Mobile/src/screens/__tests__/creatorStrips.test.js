/**
 * ui-walk-fixes — board C on the creator's screens and the screens both apps share (slice C1c):
 * her counter, "ask for a change", the pitch counter and conversation, the store visit and its
 * time conversation, the Remote shoot, her content step, going live, Withdraw — the four plain
 * forms that never had a bar (the pitch form, her delivery address, a payout detail, one
 * collection) — and the three whose strip was already in the column (Change number, a new
 * collection, reviewing a post), where only the page changed: it is a FormScroll.
 *
 * Before: each of the first group drew its main-button bar as an overlay (`position: 'absolute',
 * bottom: 0`) on top of the scrolling page, and the page carried 120–190 of empty space at its end
 * just to scroll clear of it. With the keypad open the bar rode up and sat on the box being typed
 * in (frame C0). Now, on every one of them:
 *   · the column is title row → the box that holds the page → the strip, nothing floating;
 *   · the strip is the one shared BottomBar, with every button and line it had, in the order it
 *     had them — and a stage with nothing to press draws no strip at all;
 *   · the empty space at the end of the page is gone;
 *   · where the page holds a text box it is a FormScroll, so the lines under the box being typed
 *     in come into view above the strip (frames C1–C4);
 *   · the toast is drawn inside the box above the strip, 16 above the strip.
 * And the wave-2 review leftovers that live in these files: the brand's pitch counter says "What
 * she delivers" (U15); her counter files a refusal about deliverables on the deliverables line and
 * uses the shared no-repeat / 1-to-20 rule; her agreement's own title row starts at the phone's
 * top inset like every other pushed screen (D4).
 *
 * jest cannot show a keypad. What it CAN hold is the thing that caused the fault: these tests fail
 * if a bar goes back to floating, if the dead space returns, or if a control goes missing. The
 * phone walk is still the proof of the picture.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { render, fireEvent, waitFor, within, act } from '@testing-library/react-native';

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children, ...rest }) => mockReact.createElement(View, rest, children);
  return { SafeAreaProvider: Passthrough, SafeAreaView: Passthrough, useSafeAreaInsets: () => mockInsets };
});
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn(), launchCamera: jest.fn() }));
jest.mock('../../services/api', () => {
  const fns = (names) => Object.fromEntries(names.map((n) => [n, jest.fn()]));
  return {
    influencerApi: {
      ...fns([
        'myInvitation', 'acceptInvitation', 'declineInvitation',
        'myThread', 'acceptCounter', 'declineCounter', 'counterInvitation', 'requestMove',
        'myPitchThread', 'myPitch', 'acceptMyPitch', 'declineMyPitch', 'counterMyPitch',
        'myShoot', 'acceptMyShootTime', 'acceptMyShootCounter', 'markAttended', 'moveMyShoot', 'counterMyShootTime',
        'myRemote', 'myRemoteCoverage', 'myRemoteAddress', 'myRemoteCorrect', 'myRemoteCheck', 'myRemoteDone', 'myRemoteBookReturn', 'myRemoteSelfSent',
        'myContent', 'contentCaption', 'contentSubmit', 'contentSetProof', 'contentClearProof', 'contentPosted', 'contentReport',
        'contentUploadUrl', 'contentConfirmFile', 'contentRemoveFile',
        'createPost', 'saleAddRows', 'saleRemoveRow', 'saleAddOutside',
        'getWithdrawOptions', 'requestWithdrawal',
        'myAgreement', 'signMyAgreement', 'declineMyAgreement', 'myAgreementDocument',
        'pitchForm', 'sendPitch', 'updateMe', 'getCollection', 'updateCollection', 'deleteCollection',
        'collectionOptions', 'createCollection', 'getPost', 'updatePost', 'submitPost',
      ]),
      contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
    },
    authApi: fns(['changePhoneStart', 'changePhoneVerifyOld', 'changePhoneSendNew', 'changePhoneConfirm']),
    brandApi: fns(['pitchThread', 'pitch', 'acceptPitch', 'rejectPitch', 'counterPitch', 'getShoot', 'acceptShootTime', 'counterShootTime', 'getWithdrawOptions', 'requestWithdrawal']),
    referenceApi: {
      offeredStates: jest.fn(() => Promise.resolve({ success: true, data: { states: [{ id: 2, name: 'Andhra Pradesh', cities: [{ id: 7, name: 'Guntur' }] }] } })),
    },
    clearSession: jest.fn(), uploadFile: jest.fn(), uploadContentFile: jest.fn(),
  };
});
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));

const { influencerApi, brandApi, authApi } = require('../../services/api');
const ChangeNumberScreen = require('../shared/ChangeNumberScreen').default;
const NewCollectionScreen = require('../create/NewCollectionScreen').default;
const PostReviewScreen = require('../create/PostReviewScreen').default;
const InvitationScreen = require('../influencer/InvitationScreen').default;
const ThreadScreen = require('../influencer/ThreadScreen').default;
const CounterScreen = require('../influencer/CounterScreen').default;
const MoveRequestScreen = require('../influencer/MoveRequestScreen').default;
const ShootScreen = require('../influencer/ShootScreen').default;
const RemoteShootScreen = require('../influencer/RemoteShootScreen').default;
const RemoteAddressScreen = require('../influencer/RemoteAddressScreen').default;
const ContentScreen = require('../influencer/ContentScreen').default;
const SaleLiveScreen = require('../influencer/SaleLiveScreen').default;
const AgreementScreen = require('../influencer/AgreementScreen').default;
const PitchFormScreen = require('../influencer/PitchFormScreen').default;
const PayoutDetailScreen = require('../influencer/PayoutDetailScreen').default;
const PitchCounterScreen = require('../shared/PitchCounterScreen').default;
const PitchThreadScreen = require('../shared/PitchThreadScreen').default;
const ShootCounterScreen = require('../shared/ShootCounterScreen').default;
const ShootThreadScreen = require('../shared/ShootThreadScreen').default;
const WithdrawScreen = require('../wallet/WithdrawScreen').default;
const CollectionScreen = require('../create/CollectionScreen').default;
const { settingsTokens: T } = require('../../theme/tokens');
const { MSG5 } = require('../../components/invitations/copy5');
const { C12 } = require('../../components/content/copy12');
const { C10, MSG10 } = require('../../components/shoot/copy10');
const { C11 } = require('../../components/remote/copy11');
const { C14 } = require('../../components/sale/copy14');

// React reports a clash of keys — and most other mistakes in how a tree is put together — through
// console.error and then carries on. Every test here must leave it silent.
// A press starts TouchableOpacity's fade, and a toast its own; with real timers they land between
// awaits and warn about act(), so the timers are jest's. The clock is fixed so "seven days out" and
// "still ahead" mean the same whenever this runs: Thursday 1 October 2026, 3:20 pm in India.
let errorSpy;
beforeEach(() => {
  jest.clearAllMocks();
  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  jest.useFakeTimers({ now: new Date('2026-10-01T09:50:00.000Z') });
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errorSpy.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const refused = (message, field) => ({ success: false, error: { code: 'VALIDATION_ERROR', message, field } });
const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const settle = () => act(async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); });   // eslint-disable-line no-await-in-loop

/** The shared strip, exactly: a hairline, 14 all round, children 8 apart, white — and in the column. */
const STRIP = { padding: 14, paddingBottom: 14, gap: 8, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border };

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
const byId = (id) => (n) => !!n.props && n.props.testID === id;
/** Every testID under a node, in the order they are drawn. */
function idsUnder(node, out = []) {
  for (const child of node.children || []) {
    if (typeof child === 'string') continue;
    if (child.props && child.props.testID) out.push(child.props.testID);
    idsUnder(child, out);
  }
  return out;
}
/** Every piece of text under a node — one entry per Text, in the order they are drawn. */
function textsUnder(node, out = []) {
  if (!node || typeof node === 'string') return out;
  if (node.type === 'Text') out.push((node.children || []).filter((c) => typeof c === 'string').join(''));
  for (const child of node.children || []) textsUnder(child, out);
  return out;
}

/**
 * The column of a screen: title row, then the box that holds the page, then (if `stripId`) the
 * strip as the very next thing — a child of the screen itself, never inside the page and never an
 * overlay. `form` says the page holds a text box and so must be a FormScroll. Returns the pieces.
 */
function column(r, { stripId, scrollId, form, padding = { padding: 18 } }) {
  const root = r.toJSON();
  const trail = pathTo(root, byId(scrollId));
  // screen → the box that holds the page → the page itself: the page is not buried any deeper.
  expect(trail).toHaveLength(3);
  const [, area, page] = trail;
  expect(page.type).toBe('RCTScrollView');
  expect(flat(area)).toEqual({ flex: 1 });
  expect(flat(page)).toEqual({ flex: 1 });
  const at = root.children.indexOf(area);
  expect(at).toBeGreaterThan(0);                                     // the title row is above it
  // The page ends with its ordinary padding: none of the 120 / 160 / 170 / 190 that cleared a floating bar.
  expect(StyleSheet.flatten(page.props.contentContainerStyle)).toEqual(padding);
  const content = page.children[0];
  const spacers = (content.children || []).filter((c) => typeof c !== 'string' && !c.children && (flat(c).height || 0) >= 100);
  expect(spacers).toEqual([]);
  if (form) {
    // A FormScroll: taps stay alive with the keypad open, and it watches focus and its own height.
    expect(page.props.keyboardShouldPersistTaps).toBe('handled');
    expect(typeof page.props.onFocus).toBe('function');
    expect(typeof page.props.onLayout).toBe('function');
  }
  const after = root.children.slice(at + 1).filter((c) => typeof c !== 'string');
  let strip = null;
  if (stripId) {
    strip = root.children[at + 1];
    // (Said as "expected <stripId>, received null" when the strip is not drawn at all.)
    expect(strip && strip.props ? strip.props.testID : null).toBe(stripId);
    const style = flat(strip);
    expect(style.position).toBeUndefined();
    expect(style.bottom).toBeUndefined();
    expect(style).toEqual(STRIP);
    expect(strip.props.onLayout).toBeUndefined();                    // nothing measures it any more
    // …exactly one of it, and not inside the page.
    expect(idsUnder(root).filter((id) => id === stripId)).toHaveLength(1);
    expect(pathTo(page, byId(stripId))).toBeNull();
  } else {
    // Nothing to press: no strip, and no empty band with a hairline left at the foot of the screen.
    expect(after.filter((c) => flat(c).borderTopWidth)).toEqual([]);
  }
  return { root, area, page, strip };
}

/** A box near the end of a form takes focus → the form moves so the lines under the box are above the strip. */
function expectReveal(r, fire, below = 64) {
  const scroll = r.UNSAFE_getAllByType(ScrollView)[0].instance;
  // The form's content on screen: the box is 640 down it and at 268 on screen, so it starts at -372.
  scroll.getInnerViewRef = () => ({ _nativeTag: 7, measureInWindow: (cb) => cb(0, -372, 360, 900) });
  scroll.getNativeScrollRef = () => null;
  scroll.measureInWindow = (cb) => cb(0, 54, 360, 260);              // the room left above the strip and the keypad
  scroll.scrollTo = jest.fn();
  const spy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
    measureLayout: (rel, done) => done(18, 640, 324, 46),
    measureInWindow: (cb) => cb(18, 268, 324, 46),                   // its bottom edge on the room's bottom edge
  });
  try {
    fire();
    // 640 + 46 + 64 - 260: the counter / hint / error lines under the box are now above the strip.
    // (`below` is 64 unless the screen asks for more room under its boxes.)
    expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 640 + 46 + below - 260, animated: true });
  } finally {
    spy.mockRestore();
  }
}

/** The toast: inside the box above the strip, after the page, 16 above the strip. */
function expectToastAboveStrip(r, stripId) {
  const root = r.toJSON();
  const trail = pathTo(root, byId('toast'));
  expect(trail).toHaveLength(3);
  const area = trail[1];
  expect(area.children.map((c) => c.type)).toEqual(['RCTScrollView', 'View']);
  expect(root.children[root.children.indexOf(area) + 1].props.testID).toBe(stripId);
  expect(flat(r.getByTestId('toast'))).toMatchObject({ position: 'absolute', left: 16, right: 16, bottom: 16 });
}

/* ───────────────────────────────────────────────────────────── fixtures */

const HER = { params: { ciId: 'ci1' } };
const D = (d) => `2026-10-${String(d).padStart(2, '0')}T06:00:00.000Z`;

const THREAD = (over = {}) => ({
  invitationId: 'ci1', goal: 'conversion', status: 'negotiating',
  brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' },
  campaignName: 'Diwali Edit 2026', setName: 'Set A', postingDate: '2026-10-24', cutoff: '2026-10-17', cutoffPassed: false,
  shootMode: 'visit', cityName: 'Hyderabad', switchOn: true,
  negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 3, countersUsed: 1, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { commissionPct: 11.5 }, currentLine: '11.5%',
  turns: [{ id: 't1', by: 'brand', mine: false, at: '2026-09-14T10:00:00Z', kind: 'counter', terms: { commissionPct: 11.5 }, changes: [{ term: 'commissionPct', from: '13%', to: '11.5%' }], note: null }],
  invitation: { terms: { commissionPct: 10 }, termsLine: '10%', sentAt: '2026-09-12T10:00:00Z', scopeWords: 'Anything in the store', offerName: null },
  moveRequest: null, pool: null, ending: null, warnings: [], minimums: { fee: null, commissionPct: null },
  can: { counter: true, accept: true, decline: true, moveRequest: true, moveAnswer: false },
  ...over,
});
const CONTENT_THREAD = (over = {}) => THREAD({
  goal: 'engagement',
  current: { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }], usageRights: null },
  invitation: { terms: { fee: 8000 }, termsLine: '₹8,000', sentAt: '2026-09-12T10:00:00Z', scopeWords: null, offerName: null },
  turns: [],
  ...over,
});
const PITCH_THREAD = (over = {}) => ({
  pitchId: 'p1', goal: 'engagement',
  brand: { name: 'Urban Threads' }, creator: { id: 'c1', name: 'Tanvi Suresh' },
  negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 2, countersUsed: 0, noRoundsLeft: false },
  current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] },
  turns: [{ id: 't0', by: 'influencer', mine: true, at: '2026-09-13T10:00:00Z', kind: 'counter', terms: { fee: 12000 }, changes: [], note: null }],
  ending: null, can: { counter: true, accept: true, decline: true },
  ...over,
});

const VISIT_AT = '2026-10-19T10:30:00.000Z';                        // Mon 19 Oct, 4:00 pm in India
const VISIT = (over = {}) => ({
  invitationId: 'ci1', shootId: 'ev1', contractId: 'k1',
  gate: { open: true, reason: null, signed: { at: '2026-09-14T06:00:00.000Z' }, money: { required: true, locked: 9720, released: 2250 } },
  aim: 'engagement', mode: 'visit', isVisit: true, campaignName: 'Diwali Edit', setName: 'Set A',
  brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
  postingDate: '2026-10-24', daysToPosting: 23, stage: 'sent', stageLabel: null, passed: false,
  plan: {
    branch: { name: 'Banjara Hills', city: 'Hyderabad', address: 'Road No. 12, Banjara Hills, Hyderabad', mapsUrl: null },
    contact: { name: 'Ravi Menon', phone: '+919849011223' },
    visitAt: VISIT_AT, isToday: false, durationText: 'About 2 hours', notes: null,
    sentAt: '2026-09-20T06:00:00.000Z', agreedAt: null, attendedAt: null, confirmedAt: null,
  },
  thread: null, delayed: null,
  can: { counter: true, move: false, markAttended: false },
  steps: [
    { key: 'signed', label: 'Agreement signed', state: 'done', detail: '14 Sep' },
    { key: 'shoot', label: 'Shoot plan', state: 'now', detail: 'Visit 19 Oct' },
    { key: 'content', label: 'Content', state: 'later', detail: 'After the shoot' },
  ],
  ...over,
});
const TIME_TALK = (whoseMove) => ({
  invitationId: 'ev1', anchor: 'shoot', shootId: 'ev1',
  negotiation: { id: 'n1', open: true, whoseMove, roundLimit: 2, countersUsed: 1, isLastRound: false, noRoundsLeft: false, outcome: null },
  current: { visitAt: '2026-10-20T05:30:00.000Z' },
  turns: [
    { id: 't2', by: 'brand', mine: false, kind: 'counter', at: '2026-09-22T06:00:00Z', terms: { visitAt: '2026-10-20T05:30:00.000Z' }, changes: [], note: null },
    { id: 't1', by: 'brand', mine: false, kind: 'counter', at: '2026-09-20T06:00:00Z', terms: { visitAt: VISIT_AT }, changes: [], note: null },
  ],
  can: { counter: true, accept: true },
});

const LINE = { id: 'l1', productId: 'p1', variantId: null, name: 'Indigo Saree', variantLabel: null, image: null, price: 2400, quantity: 1, disposition: 'return', check: null, checkNote: null, checkedAt: null, returnStatus: null, reportedAt: null };
const REMOTE = (over = {}) => ({
  invitationId: 'ci1', shootId: 'pe1', contractId: 'con1',
  gate: { open: true, reason: null, signed: { at: '2026-10-01T00:00:00Z' }, money: { required: false, locked: 0, released: 0 } },
  aim: 'engagement', mode: 'shipment', isRemote: true, campaignName: 'Diwali Edit', setName: 'Set A',
  brand: { name: 'Kanchi Silks' }, creator: { name: 'Tanvi Suresh' },
  postingDate: '2026-11-20', daysToPosting: 20, stage: 'not_sent', stageLabel: 'Waiting for her address',
  address: null, parcel: null, lines: [], lineCount: 0, maxLines: 20,
  return: { shipment: null, stage: 'none', stageLabel: 'Nothing to send back', dueDate: null, overdue: false, count: 0, canPickup: true },
  difference: { reportedAt: null, acknowledgedAt: null, returnReportedAt: null, overdueReportedAt: null },
  delayed: null, can: {},
  steps: [
    { key: 'signed', label: 'Agreement signed', state: 'done', detail: '1 Oct' },
    { key: 'products', label: 'Products', state: 'now', detail: 'Waiting for her address' },
    { key: 'content', label: 'Content', state: 'later', detail: 'After the shoot' },
  ],
  prefill: { name: 'Tanvi Suresh', phone: '9876511111', stateId: 2, cityId: 7 },
  ...over,
});

const IG = 'https://www.instagram.com/reel/C8xK2';
const reelRow = (url = null) => ({ key: 'reel', type: 'reel', count: 1, label: 'Instagram reel', platform: 'instagram', isStory: false, caption: 'Diwali in the new linen co-ord.', files: [{ id: 'v1', kind: 'video', mime: 'video/mp4', durationS: 28, notes: [], pinnedNote: null }], have: 1, proofs: [{ slot: 1, url, screenshotFileId: null, filled: !!url }] });
const CONTENT = (over = {}) => ({
  invitationId: 'ci1', contentId: 'cc1', campaignName: 'Diwali Edit 2026', setName: 'Set A', mode: 'visit',
  brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
  stage: 'approved', frozen: false, shootDoneAt: D(19), postingDate: '2026-10-24', daysToPosting: 5,
  rows: [reelRow()], missing: [], proofsLeft: [{ rowKey: 'reel', slot: 1, isStory: false }],
  round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [], changesAsked: 0,
  approvedAt: D(22), postedAt: null, reportFrom: null, liveConfirmedAt: null, finalDueAt: null, completedAt: null, proofCount: 0,
  money: { fee: 12000, waitDays: 7, stillLocked: 9000, campaignFee: 960, t1: { amount: 3000, paidAt: '2026-09-14T06:00:00Z', status: 'released' }, t2: { amount: 3000, paidAt: null, status: 'locked' }, t3: { amount: 6000, paidAt: null, status: 'locked', dueAt: null } },
  usageRights: null, reported: { brand: null, creator: null }, delayed: null, yourMove: true, move: { key: 'post', side: 'creator' },
  can: { addProof: true, markPosted: false },
  steps: [
    { key: 'signed', label: 'Agreement signed', state: 'done', at: '2026-09-14T06:00:00Z' },
    { key: 'shoot', label: 'Shoot', state: 'done', at: D(19) },
    { key: 'content', label: 'Content', state: 'now', at: null },
    { key: 'live', label: 'Live and paid', state: 'later', at: null, postingDate: '2026-10-24' },
  ],
  ...over,
});
const saleRow = (key, url = null) => ({ key, type: 'reel', label: 'Instagram reel', count: 1, platform: 'instagram', isStory: false, postId: 'p1', outside: false, caption: '', files: [], have: 0, proofs: [{ slot: 1, url, screenshotFileId: null, filled: !!url }], post: { id: 'p1', title: 'Festive Sarees', code: 'K7M2F9' } });
const SALE = (over = {}) => ({
  aim: 'sale', invitationId: 'ci1', contentId: 'cc1', campaignName: 'Diwali Edit 2026', setName: 'Set B', mode: 'shipment',
  brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
  stage: 'approved', frozen: false, shootDoneAt: D(16), postingDate: '2026-10-24', daysToPosting: 8,
  rows: [saleRow('s1')], missing: [], proofsLeft: [{ rowKey: 's1', slot: 1, isStory: false }],
  round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [],
  approvedAt: D(22), postedAt: null, liveConfirmedAt: null, completedAt: null, money: null,
  path1: { min: 2, approved: 2, short: 0, met: true, late: 0, inReview: 0, sentBack: 0, open: true, posts: [{ id: 'p1', title: 'Festive Sarees', code: 'K7M2F9', kind: 'offer', offerName: '20% off', state: 'live', counts: true, approvedAt: D(19), late: false, sharable: true, cover: null, inPackage: true }] },
  notShared: [], sales: { orders: 0, sales: 0, commission: 0, pending: 0, inWallet: 0 },
  autoconfirmAt: null, liveConfirmedAuto: false, waitingOnPosts: false,
  reported: { brand: null, creator: null }, delayed: null, yourMove: true, move: { key: 'post', side: 'creator' },
  can: { markPosted: false }, destinations: [{ type: 'reel', label: 'Instagram reel', isStory: false }],
  steps: [{ key: 'signed', label: 'Agreement signed', state: 'done', at: D(2) }, { key: 'social', label: 'Social media', state: 'now', at: null }],
  ...over,
});

const OPTS = { available: 48200, onHold: 0, minimum: 100, processHours: 24, open: null, blocked: null,
  sendTo: [{ method: 'bank', label: 'Bank ··4821', masked: '··4821 · HDFC0001234' }, { method: 'upi', label: 'UPI', masked: 'tanvi@upi' }] };

const mount = async (ui, ready) => { const r = render(ui); await waitFor(() => r.getByTestId(ready)); return r; };

/* ─────────────────────────────── the bar is a strip in the column — every screen */

describe('her counter (Pay for Sale) — "Send counter" in its own strip under the form', () => {
  const open = () => { influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD() })); return mount(<CounterScreen navigation={nav()} route={HER} />, 'counter-conversion'); };

  it('title row, the form, then the strip — nothing floating, no dead space, a FormScroll', async () => {
    const r = await open();
    const { strip, page } = column(r, { stripId: 'counter-actions', scrollId: 'counter-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['send-counter']);
    // Everything the form had is still in the form (U10).
    const ids = idsUnder(page);
    for (const id of ['counter-commission', 'change-commission', 'counter-note', 'counter-note-counter', 'counter-hint']) expect(ids).toContain(id);
    expect(ids).not.toContain('send-counter');
  });

  it('typing the note at the end of the form: its counter and red line are brought into view above the strip', async () => {
    const r = await open();
    expectReveal(r, () => fireEvent(r.getByTestId('counter-note'), 'focus'));
  });

  it('the keypad opening (the form getting shorter) with the note in view does the same', async () => {
    const r = await open();
    const page = r.getByTestId('counter-scroll');
    expectReveal(r, () => {
      fireEvent(page, 'layout', { nativeEvent: { layout: { height: 620 } } });
      fireEvent(page, 'layout', { nativeEvent: { layout: { height: 260 } } });
    });
  });
});

describe('her counter (Pay for Content) — refusals land where she can see them, by the shared rule', () => {
  const open = async (thread = CONTENT_THREAD()) => {
    influencerApi.myThread.mockResolvedValue(ok({ thread }));
    const n = nav();
    const r = await mount(<CounterScreen navigation={n} route={HER} />, 'counter-engagement');
    return { r, n };
  };

  it('a refusal the server names "formats_json" is shown on the deliverables line — and goes when she changes the lines', async () => {
    // It used to be filed under 'formats_json', which nothing on this screen draws, so it fell to
    // the form line at the very end of the page.
    influencerApi.counterInvitation.mockResolvedValue(refused('Choose between 1 and 20.', 'formats_json'));
    const { r, n } = await open();
    fireEvent.changeText(r.getByTestId('counter-fee'), '9000');
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => r.getByText('Choose between 1 and 20.'));
    within(r.getByTestId('counter-deliverables')).getByText('Choose between 1 and 20.');
    expect(r.getAllByText('Choose between 1 and 20.')).toHaveLength(1);
    expect(n.replace).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('counter-deliverables-row-1-count-minus'));
    expect(r.queryByText('Choose between 1 and 20.')).toBeNull();
  });

  it('one the server names "agreed_fee" lands under the fee; one about a line this screen does not draw is said on the form line', async () => {
    const { r } = await open();
    influencerApi.counterInvitation.mockResolvedValueOnce(refused('Enter a fee.', 'agreed_fee'));
    fireEvent.changeText(r.getByTestId('counter-fee'), '9000');
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => r.getByText('Enter a fee.'));
    expect(within(r.getByTestId('counter-deliverables')).queryByText('Enter a fee.')).toBeNull();
    // Commission is not on a Pay for Content counter; the reuse line is not drawn while the switch is off.
    influencerApi.counterInvitation.mockResolvedValueOnce(refused('Commission must be between 0 and 100.', 'commission_pct'));
    fireEvent.changeText(r.getByTestId('counter-fee'), '9500');
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => r.getByText('Commission must be between 0 and 100.'));
    influencerApi.counterInvitation.mockResolvedValueOnce(refused('Choose where the brand may reuse it.', 'usage_rights_json'));
    fireEvent.changeText(r.getByTestId('counter-fee'), '9600');
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => r.getByText('Choose where the brand may reuse it.'));
    influencerApi.counterInvitation.mockResolvedValueOnce(refused('This invitation has closed.', 'invitation'));
    fireEvent.changeText(r.getByTestId('counter-fee'), '9700');
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => r.getByText('This invitation has closed.'));
  });

  it('the shared no-repeat rule: a type that arrives twice is refused on the deliverables line before anything is sent', async () => {
    const { r } = await open(CONTENT_THREAD({ current: { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'reel', count: 2 }], usageRights: null } }));
    fireEvent.changeText(r.getByTestId('counter-fee'), '9000');
    fireEvent.press(r.getByTestId('send-counter'));
    within(r.getByTestId('counter-deliverables')).getByText(MSG5.DELIVERABLE_DUP);
    expect(influencerApi.counterInvitation).not.toHaveBeenCalled();
  });

  it('every line removed is still this screen\'s own sentence, and a good counter is still sent as it was', async () => {
    influencerApi.counterInvitation.mockResolvedValue(ok({ thread: CONTENT_THREAD() }));
    const { r, n } = await open();
    fireEvent.press(r.getByTestId('counter-deliverables-row-0-remove'));
    fireEvent.press(r.getByTestId('counter-deliverables-row-0-remove'));
    fireEvent.press(r.getByTestId('send-counter'));
    within(r.getByTestId('counter-deliverables')).getByText(MSG5.DELIVERABLES_EMPTY);
    expect(influencerApi.counterInvitation).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('counter-deliverables-add'));
    fireEvent.press(r.getByTestId('counter-deliverables-add-reel'));
    fireEvent.changeText(r.getByTestId('counter-fee'), '9000');
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => expect(influencerApi.counterInvitation).toHaveBeenCalledWith('ci1', {
      terms: { commissionPct: null, fee: 9000, deliverables: [{ type: 'reel', count: 1 }], usageRights: null }, note: undefined,
    }));
    expect(n.replace).toHaveBeenCalledWith('Thread', { ciId: 'ci1', toast: 'Counter sent.' });
  });
});

describe('the pitch counter, both apps — the strip, and whose words the deliverables block is in (U15)', () => {
  const her = () => { influencerApi.myPitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD() })); return mount(<PitchCounterScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />, 'pitch-counter-engagement'); };
  const brand = () => { brandApi.pitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD({ negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 0 } }) })); return mount(<PitchCounterScreen navigation={nav()} route={{ params: { pitchId: 'p1', side: 'brand' } }} />, 'pitch-counter-engagement'); };

  it('title row, the form, then the strip — nothing floating, no dead space, a FormScroll', async () => {
    const r = await her();
    const { strip, page } = column(r, { stripId: 'pitch-counter-actions', scrollId: 'pitch-counter-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['send-pitch-counter']);
    const ids = idsUnder(page);
    for (const id of ['pitch-counter-fee', 'pitch-counter-deliverables', 'change-deliverables', 'pitch-counter-note', 'pitch-counter-note-counter', 'pitch-counter-hint']) expect(ids).toContain(id);
    expectReveal(r, () => fireEvent(r.getByTestId('pitch-counter-note'), 'focus'));
  });

  it('the BRAND countering her pitch reads "What she delivers" — never the creator\'s "What you\'ll deliver"', async () => {
    const r = await brand();
    const label = r.getByTestId('pitch-counter-delivers-label');
    expect(label.props.children[0]).toBe('What she delivers');
    expect(r.queryByText(/What you'll deliver/)).toBeNull();
    column(r, { stripId: 'pitch-counter-actions', scrollId: 'pitch-counter-scroll', form: true });
  });

  it('the creator countering on her own pitch keeps "What you\'ll deliver"', async () => {
    const r = await her();
    expect(r.getByTestId('pitch-counter-delivers-label').props.children[0]).toBe("What you'll deliver");
    expect(r.queryByText(/What she delivers/)).toBeNull();
  });

  it('the shared no-repeat rule holds here too, on both sides, before anything is sent', async () => {
    brandApi.pitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD({ current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'reel', count: 2 }] } }) }));
    const r = await mount(<PitchCounterScreen navigation={nav()} route={{ params: { pitchId: 'p1', side: 'brand' } }} />, 'pitch-counter-engagement');
    fireEvent.changeText(r.getByTestId('pitch-counter-fee'), '10000');
    fireEvent.press(r.getByTestId('send-pitch-counter'));
    within(r.getByTestId('pitch-counter-deliverables')).getByText(MSG5.DELIVERABLE_DUP);
    expect(brandApi.counterPitch).not.toHaveBeenCalled();
  });
});

describe('"Ask for a change" — the request button in its own strip under the form', () => {
  it('title row, the form, then the strip; the note\'s counter comes into view when she types it', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD() }));
    const r = await mount(<MoveRequestScreen navigation={nav()} route={HER} />, 'move-request');
    const { strip, page } = column(r, { stripId: 'move-actions', scrollId: 'move-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['send-move']);
    const ids = idsUnder(page);
    for (const id of ['this-set', 'want-date', 'want-mode', 'move-note', 'move-note-counter', 'move-explain']) expect(ids).toContain(id);
    expectReveal(r, () => fireEvent(r.getByTestId('move-note'), 'focus'));
  });
});

describe('asking for another time, both apps — the Send button in its own strip under the form', () => {
  it('her side: title row, the form, then the strip; a FormScroll', async () => {
    influencerApi.myShoot.mockResolvedValue(ok({ shoot: VISIT({ thread: { negotiation: { countersUsed: 0, roundLimit: 2 } } }) }));
    const r = await mount(<ShootCounterScreen navigation={nav()} route={HER} />, 'shoot-counter');
    const { strip, page } = column(r, { stripId: 'shoot-counter-actions', scrollId: 'shoot-counter-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['send-counter']);
    const ids = idsUnder(page);
    for (const id of ['counter-picker', 'change-time', 'counter-note', 'counter-note-counter', 'only-time']) expect(ids).toContain(id);
    expectReveal(r, () => fireEvent(r.getByTestId('counter-note'), 'focus'));
  });

  it('the brand\'s side is the same screen and the same strip', async () => {
    brandApi.getShoot.mockResolvedValue(ok({ shoot: VISIT({ thread: { negotiation: { countersUsed: 0, roundLimit: 2 } } }) }));
    const r = await mount(<ShootCounterScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 's1', ciId: 'ci1', side: 'brand' } }} />, 'shoot-counter');
    column(r, { stripId: 'shoot-counter-actions', scrollId: 'shoot-counter-scroll', form: true });
  });
});

describe('the time conversation, both apps — two buttons and their line in a strip under the page', () => {
  it('her move: Accept, "Ask for another time" and the "no declining" line, in that order, in the strip', async () => {
    influencerApi.myShoot.mockResolvedValue(ok({ shoot: VISIT({ thread: TIME_TALK('influencer') }) }));
    const r = await mount(<ShootThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1', toast: 'Sent.' } }} />, 'shoot-thread-yourmove');
    const { strip, page } = column(r, { stripId: 'shoot-thread-actions', scrollId: 'shoot-thread-scroll' });
    expect(idsUnder(strip)).toEqual(['shoot-thread-accept', 'shoot-thread-counter', 'no-decline']);
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['shoot-thread-state', 'turn-t2', 'turn-t1']));
    // The outline button under the yellow one sits the strip's 8 below it, not 8 + its own 10.
    expect(StyleSheet.flatten(r.getByTestId('shoot-thread-counter').props.style).marginTop).toBe(0);
    await waitFor(() => r.getByTestId('toast'));
    expectToastAboveStrip(r, 'shoot-thread-actions');
  });

  it('waiting on the other side: no strip at all, and the toast where it always was', async () => {
    brandApi.getShoot.mockResolvedValue(ok({ shoot: VISIT({ thread: TIME_TALK('influencer') }) }));
    const r = await mount(<ShootThreadScreen navigation={nav()} side="brand" route={{ params: { campaignId: 'c1', setId: 's1', ciId: 'ci1', toast: 'Sent.' } }} />, 'shoot-thread-waiting');
    column(r, { stripId: null, scrollId: 'shoot-thread-scroll' });
    expect(r.queryByTestId('shoot-thread-accept')).toBeNull();
    await waitFor(() => r.getByTestId('toast'));
    expect(flat(r.getByTestId('toast')).bottom).toBe(110);
  });
});

describe('her counter conversation and her invitation — the toast floats just above the strip', () => {
  it('her move in a conversation: the toast is in the box above the strip, 16 above it', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD() }));
    const r = await mount(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1', toast: 'Counter sent.' } }} />, 'thread-actions');
    await waitFor(() => r.getByTestId('toast'));
    expectToastAboveStrip(r, 'thread-actions');
  });

  it('waiting on the brand (no strip): the toast is where it always was', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD({ negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 3, countersUsed: 1 }, can: {} }) }));
    const r = await mount(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1', toast: 'Counter sent.' } }} />, 'thread-waiting');
    await waitFor(() => r.getByTestId('toast'));
    expect(flat(r.getByTestId('toast')).bottom).toBe(110);
  });

  it('an invitation she can answer: a refused Accept is said just above the answers', async () => {
    const INV = {
      id: 'ci1', status: 'invited', group: 'invited', brand: { name: 'Urban Threads', logoUrl: null },
      campaignName: 'Diwali Edit 2026', setName: 'Set A', canAnswer: true, canCounter: true, counterHiddenReason: null, canMoveRequest: true,
      negotiation: null, fromPool: null, agreement: null, cutoff: '2026-10-17',
      set: { name: 'Set A', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad', postingDate: '2026-10-24', cutoff: '2026-10-17' },
      terms: { goal: 'conversion', commissionPct: 10, fee: null, scope: { kind: 'store', words: 'whole store' }, offer: { kind: 'none' }, shoppablePostsMin: 1 },
      note: null,
    };
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: INV }));
    influencerApi.acceptInvitation.mockResolvedValue({ success: false, error: { message: 'This set has closed.' } });
    const r = await mount(<InvitationScreen navigation={nav()} route={HER} />, 'answer-actions');
    fireEvent.press(r.getByTestId('accept'));
    const accepts = r.getAllByText('Accept');
    await act(async () => { fireEvent.press(accepts[accepts.length - 1]); });
    await waitFor(() => r.getByText('This set has closed.'));
    expectToastAboveStrip(r, 'answer-actions');
  });

  it('the pitch conversation, her move: the same strip, on her side and on the brand\'s', async () => {
    influencerApi.myPitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD() }));
    influencerApi.myPitch.mockResolvedValue(ok({ pitch: { id: 'p1' } }));
    const r = await mount(<PitchThreadScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />, 'pitch-thread-actions');
    const { strip } = column(r, { stripId: 'pitch-thread-actions', scrollId: 'pitch-thread-scroll' });
    expect(idsUnder(strip)).toEqual(['pitch-thread-accept', 'pitch-thread-counter', 'pitch-thread-decline']);
    // Waiting on the brand: nothing under the page.
    influencerApi.myPitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD({ negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1 } }) }));
    const w = await mount(<PitchThreadScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />, 'pitch-thread-waiting');
    column(w, { stripId: null, scrollId: 'pitch-thread-scroll' });
  });
});

describe('her store visit — the buttons in a strip under the page, at every stage', () => {
  const open = (shoot, route = HER) => { influencerApi.myShoot.mockResolvedValue(ok({ shoot })); return mount(<ShootScreen navigation={nav()} route={route} />, `shoot-${shoot.stage}`); };

  it('a time to answer: "This time works" and "Ask for another time" in the strip; the toast just above it', async () => {
    const r = await open(VISIT(), { params: { ciId: 'ci1', toast: 'Sent.' } });
    const { strip, page } = column(r, { stripId: 'shoot-actions', scrollId: 'shoot-scroll' });
    expect(idsUnder(strip)).toEqual(['this-time-works', 'ask-another']);
    expect(idsUnder(page)).toContain('posting-line');
    await waitFor(() => r.getByTestId('toast'));
    expectToastAboveStrip(r, 'shoot-actions');
  });

  it('the time agreed: "I\'ve been to the store" and "Ask to move" in the strip, and the hint line still on the page', async () => {
    const r = await open(VISIT({ stage: 'agreed', plan: { ...VISIT().plan, agreedAt: '2026-09-21T06:00:00.000Z' }, can: { counter: false, move: true, markAttended: true } }));
    const { strip, page } = column(r, { stripId: 'shoot-actions', scrollId: 'shoot-scroll' });
    expect(idsUnder(strip)).toEqual(['been-to-store', 'ask-to-move']);
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['agreed-box', 'been-hint']));
  });

  it('marked and waiting — nothing to press: no strip, and no empty band at the foot of the screen', async () => {
    const r = await open(VISIT({ stage: 'attended', plan: { ...VISIT().plan, attendedAt: '2026-10-19T12:00:00.000Z' }, can: {} }));
    column(r, { stripId: null, scrollId: 'shoot-scroll' });
    expect(r.queryByTestId('shoot-actions')).toBeNull();
    r.getByTestId('marked-box'); r.getByTestId('waits-for-confirm');
  });

  it('the visit done: the door to her content in the strip', async () => {
    const r = await open(VISIT({ stage: 'complete', plan: { ...VISIT().plan, confirmedAt: '2026-10-19T13:00:00.000Z' }, can: {} }));
    const { strip } = column(r, { stripId: 'shoot-actions', scrollId: 'shoot-scroll' });
    expect(idsUnder(strip)).toEqual(['open-content']);
    expect(r.queryByTestId('go-live')).toBeNull();
  });

  /* The three states of this strip nothing else in the suite presses: the brand's other time, and
     the Pay for Sale / Hybrid door. Each must fail if its button or its line leaves the strip. */

  it('the brand asked for another time: "Accept <their time>", "Ask for another time" and the "no declining" line, in that order, in the strip', async () => {
    const n = nav();
    influencerApi.myShoot.mockResolvedValue(ok({ shoot: VISIT({ thread: TIME_TALK('influencer') }) }));
    const r = await mount(<ShootScreen navigation={n} route={HER} />, 'shoot-sent');
    const { strip, page } = column(r, { stripId: 'shoot-actions', scrollId: 'shoot-scroll' });
    expect(idsUnder(strip)).toEqual(['accept-counter', 'ask-another']);
    // Two buttons, then the grey sentence — the strip's own three children, in that order.
    expect(strip.children.map((c) => c.props.testID || c.type)).toEqual(['accept-counter', 'ask-another', 'Text']);
    expect(strip.children[2].children).toEqual([MSG10.NO_DECLINE]);
    expect(flat(strip.children[2])).toMatchObject({ textAlign: 'center', fontSize: 12, color: T.ink3 });
    // …said once, in the strip: not left behind on the page, and not a second copy of it.
    expect(r.getAllByText(MSG10.NO_DECLINE)).toHaveLength(1);
    expect(textsUnder(page)).not.toContain(MSG10.NO_DECLINE);
    // The yellow button names the time the brand asked for (20 Oct, 11:00 am in India), not the first one.
    expect(flat(r.getByTestId('accept-counter')).backgroundColor).toBe(T.primary);
    within(r.getByTestId('accept-counter')).getByText(C10.hers.acceptNew('2026-10-20T05:30:00.000Z'));
    expect(C10.hers.acceptNew('2026-10-20T05:30:00.000Z')).toMatch(/^Accept 20 Oct, /);
    // The outline button sits the strip's 8 under it, not 8 + its own 10.
    expect(flat(r.getByTestId('ask-another')).marginTop).toBe(0);
    // The first plan's answer is not offered alongside it, and the page says what they asked.
    expect(r.queryByTestId('this-time-works')).toBeNull();
    expect(idsUnder(page)).toContain('they-asked');
    // Both still do what they did.
    fireEvent.press(r.getByTestId('ask-another'));
    expect(n.navigate).toHaveBeenCalledWith('ShootCounter', { ciId: 'ci1' });
    influencerApi.acceptMyShootCounter.mockResolvedValue(ok({ shoot: VISIT({ stage: 'agreed', plan: { ...VISIT().plan, visitAt: '2026-10-20T05:30:00.000Z', agreedAt: '2026-10-01T09:50:00.000Z' }, can: { counter: false, move: true, markAttended: true } }) }));
    await act(async () => { fireEvent.press(r.getByTestId('accept-counter')); });
    await waitFor(() => r.getByTestId('been-to-store'));
    expect(influencerApi.acceptMyShootCounter).toHaveBeenCalledWith('ci1');
    expect(influencerApi.acceptMyShootTime).not.toHaveBeenCalled();
    // The strip is the same strip, with the next stage's buttons, and "Time agreed." just above it.
    expect(idsUnder(column(r, { stripId: 'shoot-actions', scrollId: 'shoot-scroll' }).strip)).toEqual(['been-to-store', 'ask-to-move']);
    expect(r.queryByText(MSG10.NO_DECLINE)).toBeNull();
    expectToastAboveStrip(r, 'shoot-actions');
  });

  it('the brand asked for another time and she has no counter left: Accept and the line stay in the strip, without the second button', async () => {
    const r = await open(VISIT({ thread: TIME_TALK('influencer'), can: { counter: false, move: false, markAttended: false } }));
    const { strip } = column(r, { stripId: 'shoot-actions', scrollId: 'shoot-scroll' });
    expect(idsUnder(strip)).toEqual(['accept-counter']);
    expect(strip.children.map((c) => c.props.testID || c.type)).toEqual(['accept-counter', 'Text']);
    expect(strip.children[1].children).toEqual([MSG10.NO_DECLINE]);
  });

  it('she asked for another time and the brand has not answered — nothing to press: no strip, and the wait is said on the page', async () => {
    const r = await open(VISIT({ thread: TIME_TALK('brand') }));
    const { page } = column(r, { stripId: null, scrollId: 'shoot-scroll' });
    expect(r.queryByTestId('shoot-actions')).toBeNull();
    expect(r.queryByTestId('accept-counter')).toBeNull();
    expect(r.queryByTestId('this-time-works')).toBeNull();
    expect(r.queryByText(MSG10.NO_DECLINE)).toBeNull();
    expect(idsUnder(page)).toContain('waiting-them');
  });

  it.each([['conversion', 'Pay for Sale'], ['hybrid', 'Hybrid']])('the visit done, aim "%s" (%s): "Go live" alone in the strip, yellow, and it opens going live', async (aim) => {
    const n = nav();
    influencerApi.myShoot.mockResolvedValue(ok({ shoot: VISIT({ aim, stage: 'complete', plan: { ...VISIT().plan, confirmedAt: '2026-10-19T13:00:00.000Z' }, can: {} }) }));
    const r = await mount(<ShootScreen navigation={n} route={HER} />, 'shoot-complete');
    const { strip, page } = column(r, { stripId: 'shoot-actions', scrollId: 'shoot-scroll' });
    expect(idsUnder(strip)).toEqual(['go-live']);
    expect(strip.children).toHaveLength(1);
    expect(textsUnder(strip)).toEqual([C14.goLive]);
    expect(flat(r.getByTestId('go-live')).backgroundColor).toBe(T.primary);
    // The Pay for Content door is not offered to her, and the page above is the finished visit.
    expect(r.queryByTestId('open-content')).toBeNull();
    expect(idsUnder(page)).toContain('done-box');
    fireEvent.press(r.getByTestId('go-live'));
    expect(n.navigate).toHaveBeenCalledWith('SaleLive', { ciId: 'ci1' });
  });
});

describe('her Remote shoot — the one action in a strip under the page', () => {
  const open = (shoot, route = HER) => { influencerApi.myRemote.mockResolvedValue(ok({ shoot })); return mount(<RemoteShootScreen navigation={nav()} route={route} />, `remote-${shoot.stage}`); };

  it('nothing sent yet: "Send your address" in the strip; the toast just above it', async () => {
    const r = await open(REMOTE({ can: { sendAddress: true } }), { params: { ciId: 'ci1', toast: 'Saved.' } });
    const { strip } = column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['send-address']);
    await waitFor(() => r.getByTestId('toast'));
    expectToastAboveStrip(r, 'remote-actions');
  });

  it('checking the box: the note she types about a damaged item is brought into view above "Save"', async () => {
    const r = await open(REMOTE({ stage: 'delivered', lines: [LINE], parcel: { deliveredAt: '2026-10-05T06:00:00Z' } }));
    const { strip, page } = column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['save-check']);
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['arrived-box', 'check-hint', 'check-l1', 'check-control-l1']));
    fireEvent.press(r.getByTestId('check-control-l1-damaged'));
    expectReveal(r, () => fireEvent(r.getByTestId('check-control-l1-note'), 'focus'));
  });

  it('the shoot done with items to send back: the content door (outline) above the return button, 8 apart', async () => {
    const r = await open(REMOTE({ stage: 'shot', lines: [{ ...LINE, check: 'received' }], can: { bookReturn: true },
      return: { shipment: null, stage: 'due', dueDate: '2026-11-10', overdue: false, count: 1, canPickup: true } }));
    const { strip } = column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['open-content', 'book-return']);
    expect(StyleSheet.flatten(r.getByTestId('open-content').props.style).marginTop).toBe(0);
  });

  it('address sent, nothing shipped — nothing to press: no strip, and no empty band at the foot of the screen', async () => {
    const r = await open(REMOTE({ stage: 'sent', address: { name: 'Tanvi Suresh', street: '11 Gandhi Road', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522002' } }));
    column(r, { stripId: null, scrollId: 'remote-scroll', form: true });
    expect(r.queryByTestId('remote-actions')).toBeNull();
    r.getByTestId('waiting-brand'); r.getByTestId('her-address');
  });

  /* The states of this strip nothing else in the suite holds in place: marking the shoot done, and
     the Pay for Sale / Hybrid door — alone, and stepping aside for the return's own button. */

  const ADDRESS = { name: 'Tanvi Suresh', street: '11 Gandhi Road', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522002' };
  const GOT = { ...LINE, check: 'received', checkedAt: '2026-10-05T06:00:00Z' };
  const NOTHING_BACK = { shipment: null, stage: 'none', stageLabel: 'Nothing to send back', dueDate: null, overdue: false, count: 0, canPickup: true };
  const DUE = (canPickup) => ({ shipment: null, stage: 'due', dueDate: '2026-11-10', overdue: false, count: 1, canPickup });
  const outline = (node) => { const st = flat(node); return st.backgroundColor === T.bg && st.borderWidth === 1 && st.marginTop === 0; };

  it('checked, not shot: "I\'ve finished the shoot" alone in the strip, and it still opens its pop-up', async () => {
    const r = await open(REMOTE({ stage: 'checked', address: ADDRESS, parcel: { deliveredAt: '2026-10-05T06:00:00Z' }, lines: [GOT], can: { markDone: true }, return: DUE(true) }));
    const { strip, page } = column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['mark-done']);
    expect(strip.children).toHaveLength(1);
    within(r.getByTestId('mark-done')).getByText(C11.creator.finished);
    expect(flat(r.getByTestId('mark-done')).backgroundColor).toBe(T.primary);
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['checked-box', 'whats-coming']));
    fireEvent.press(r.getByTestId('mark-done'));
    await waitFor(() => r.getByTestId('shoot-done-sheet'));
    // The pop-up is drawn beside the column, not inside the strip or the page.
    expect(idsUnder(column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true }).strip)).toEqual(['mark-done']);
  });

  it('the shoot done, Pay for Content, nothing to send back: the content door alone in the strip, yellow', async () => {
    const n = nav();
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: REMOTE({ stage: 'shot', address: ADDRESS, lines: [{ ...GOT, disposition: 'gift' }], return: NOTHING_BACK }) }));
    const r = await mount(<RemoteShootScreen navigation={n} route={HER} />, 'remote-shot');
    const { strip } = column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['open-content']);
    expect(flat(r.getByTestId('open-content')).backgroundColor).toBe(T.primary);
    expect(r.queryByTestId('go-live')).toBeNull();
    fireEvent.press(r.getByTestId('open-content'));
    expect(n.navigate).toHaveBeenCalledWith('Content', { ciId: 'ci1' });
  });

  it.each([['conversion', 'Pay for Sale'], ['hybrid', 'Hybrid']])('the shoot done, aim "%s" (%s), nothing to send back: "Go live" alone in the strip, yellow, and it opens going live', async (aim) => {
    const n = nav();
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: REMOTE({ aim, stage: 'shot', address: ADDRESS, lines: [{ ...GOT, disposition: 'gift' }], return: NOTHING_BACK }) }));
    const r = await mount(<RemoteShootScreen navigation={n} route={HER} />, 'remote-shot');
    const { strip, page } = column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['go-live']);
    expect(strip.children).toHaveLength(1);
    expect(textsUnder(strip)).toEqual([C14.goLive]);
    expect(flat(r.getByTestId('go-live')).backgroundColor).toBe(T.primary);
    expect(r.queryByTestId('open-content')).toBeNull();
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['shot-box', 'nothing-back']));
    fireEvent.press(r.getByTestId('go-live'));
    expect(n.navigate).toHaveBeenCalledWith('SaleLive', { ciId: 'ci1' });
  });

  it('Pay for Sale with items she posts back herself: "Go live" (outline) above "I\'ve sent it back" (yellow), 8 apart', async () => {
    const n = nav();
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: REMOTE({ aim: 'conversion', stage: 'shot', address: ADDRESS, lines: [GOT], can: { markSelfSent: true }, return: DUE(false) }) }));
    const r = await mount(<RemoteShootScreen navigation={n} route={HER} />, 'remote-shot');
    const { strip, page } = column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['go-live', 'self-sent']);
    expect(strip.children).toHaveLength(2);
    // The return keeps the yellow; the door steps aside as the outline button, without its own 10 top gap.
    expect(outline(r.getByTestId('go-live'))).toBe(true);
    within(r.getByTestId('go-live')).getByText(C14.goLive);
    expect(flat(r.getByTestId('self-sent')).backgroundColor).toBe(T.primary);
    within(r.getByTestId('self-sent')).getByText(C11.creator.selfSent);
    expect(r.queryByTestId('book-return')).toBeNull();
    expect(idsUnder(page)).toContain('self-send');
    fireEvent.press(r.getByTestId('go-live'));
    expect(n.navigate).toHaveBeenCalledWith('SaleLive', { ciId: 'ci1' });
    fireEvent.press(r.getByTestId('self-sent'));
    await waitFor(() => r.getByTestId('self-sent-sheet'));
  });

  it('Hybrid with a pickup to book: "Go live" (outline) above "Send it back" (yellow)', async () => {
    const r = await open(REMOTE({ aim: 'hybrid', stage: 'shot', address: ADDRESS, lines: [GOT], can: { bookReturn: true }, return: DUE(true) }));
    const { strip } = column(r, { stripId: 'remote-actions', scrollId: 'remote-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['go-live', 'book-return']);
    expect(outline(r.getByTestId('go-live'))).toBe(true);
    expect(flat(r.getByTestId('book-return')).backgroundColor).toBe(T.primary);
    expect(r.queryByTestId('open-content')).toBeNull();
  });
});

describe('her content step — frame C4 (the same moment as J2)', () => {
  const open = (c, route = HER) => { influencerApi.myContent.mockResolvedValue(ok({ content: c })); return mount(<ContentScreen navigation={nav()} route={route} />, `content-${c.stage}`); };

  it('approved: "I\'ve posted everything" and its one line sit in the strip under the page — never over it', async () => {
    const r = await open(CONTENT());
    const { strip, page } = column(r, { stripId: 'content-actions', scrollId: 'content-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['posted', 'to-go']);
    expect(r.getByTestId('to-go').props.children).toBe('1 link to go.');
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['approved-box', 'proof-row-reel', 'link-reel:1-box', 'link-reel:1']));
  });

  it('a link just pasted: "Saving…" in the box, "Saving your link…" in the strip, and the box is kept in view above the strip as the strip grows', async () => {
    const r = await open(CONTENT());
    influencerApi.contentSetProof.mockReturnValue(new Promise(() => {}));   // still on its way
    const page = r.getByTestId('content-scroll');
    expectReveal(r, () => {
      // She is in the link box (its focus reaches the page), pastes, and the strip gains its line:
      // the page gets shorter with the box on show.
      fireEvent(page, 'layout', { nativeEvent: { layout: { height: 280 } } });
      fireEvent.changeText(r.getByTestId('link-reel:1'), IG);
      fireEvent(page, 'layout', { nativeEvent: { layout: { height: 260 } } });
    });
    expect(r.getByTestId('link-reel:1-saving').props.children).toBe('Saving…');
    expect(r.getByTestId('to-go').props.children).toBe(C12.savingLink);
    expect(r.getByTestId('posted').props.accessibilityState.disabled).toBe(false);
    const { strip } = column(r, { stripId: 'content-actions', scrollId: 'content-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['posted', 'to-go']);
  });

  it('the link box taking focus brings it, and the red line under it, into view above the strip', async () => {
    const r = await open(CONTENT());
    // The box has its own focus handler; on a phone the event also reaches the page it sits in.
    expectReveal(r, () => { fireEvent(r.getByTestId('link-reel:1'), 'focus'); fireEvent(r.getByTestId('content-scroll'), 'focus'); });
  });

  it('filling the package: "Send to …" and its hint line in the strip, the caption boxes in the form', async () => {
    const r = await open(CONTENT({ stage: 'draft', approvedAt: null, rows: [{ ...reelRow(), proofs: [] }], proofsLeft: [], can: { submit: true }, rounds: [] }));
    const { strip, page } = column(r, { stripId: 'content-actions', scrollId: 'content-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['send', 'send-hint']);
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['edit-row-reel', 'caption-reel', 'captions-hint']));
    expectReveal(r, () => { fireEvent(r.getByTestId('caption-reel'), 'focus'); fireEvent(r.getByTestId('content-scroll'), 'focus'); });
  });

  it('with the brand — nothing to press: no strip, no empty band; a toast is 16 above the foot of the page', async () => {
    const r = await open(CONTENT({ stage: 'in_review', approvedAt: null, rows: [{ ...reelRow(), proofs: [] }], proofsLeft: [], can: {} }), { params: { ciId: 'ci1', toast: 'Sent.' } });
    column(r, { stripId: null, scrollId: 'content-scroll', form: true });
    expect(r.queryByTestId('content-actions')).toBeNull();
    r.getByTestId('with-them');
    await waitFor(() => r.getByTestId('toast'));
    expect(pathTo(r.toJSON(), byId('toast'))).toHaveLength(3);        // in the box that holds the page
    expect(flat(r.getByTestId('toast')).bottom).toBe(16);
  });

  it('posted and silent: "Ask INFLX to look" alone in the strip, without the outline button\'s own top gap', async () => {
    const r = await open(CONTENT({ stage: 'posted', postedAt: D(24), reportFrom: D(27), rows: [reelRow(IG)], proofsLeft: [], can: { report: true } }));
    const { strip } = column(r, { stripId: 'content-actions', scrollId: 'content-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['ask-inflx']);
    expect(StyleSheet.flatten(r.getByTestId('ask-inflx').props.style).marginTop).toBe(0);
  });
});

describe('going live (Pay for Sale) — the same strip', () => {
  const open = (c) => { influencerApi.myContent.mockResolvedValue(ok({ content: c })); return mount(<SaleLiveScreen navigation={nav()} route={HER} />, `sale-live-${c.stage}`); };

  it('approved: "I\'ve posted everything" and its line in the strip; the link box in the form, kept in view when she is in it', async () => {
    const r = await open(SALE());
    const { strip, page } = column(r, { stripId: 'sale-actions', scrollId: 'sale-scroll', form: true });
    expect(idsUnder(strip)).toEqual(['posted', 'to-go']);
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['path1', 'path2-approved', 'proof-row-s1', 'link-s1']));
    expectReveal(r, () => { fireEvent(r.getByTestId('link-s1'), 'focus'); fireEvent(r.getByTestId('sale-scroll'), 'focus'); });
  });

  it('making posts (Path 2 still locked) — nothing to press: no strip and no empty band', async () => {
    const r = await open(SALE({ stage: 'posts', approvedAt: null, rows: [], proofsLeft: [], can: {},
      path1: { ...SALE().path1, approved: 0, short: 2, met: false, open: false, posts: [] } }));
    column(r, { stripId: null, scrollId: 'sale-scroll', form: true });
    expect(r.queryByTestId('sale-actions')).toBeNull();
    r.getByTestId('path2-locked'); r.getByTestId('create-post');
  });
});

describe('Withdraw, both apps — the request button in its own strip under the form', () => {
  it('her side: title row, the form, then the strip; every control still there', async () => {
    influencerApi.getWithdrawOptions.mockResolvedValue(ok(OPTS));
    const r = await mount(<WithdrawScreen navigation={nav()} route={{ params: { side: 'creator' } }} />, 'withdraw');
    const root = r.toJSON();
    const trail = pathTo(root, byId('withdraw-scroll'));
    expect(trail).toHaveLength(2);                                     // no toast on this screen: the form is the box above the strip
    const page = trail[1];
    expect(flat(page)).toEqual({ flex: 1 });
    expect(page.props.keyboardShouldPersistTaps).toBe('handled');
    expect(typeof page.props.onFocus).toBe('function');
    expect(StyleSheet.flatten(page.props.contentContainerStyle)).toEqual({ padding: 18 });
    const strip = root.children[root.children.indexOf(page) + 1];
    expect(strip.props.testID).toBe('withdraw-actions');
    expect(flat(strip)).toEqual(STRIP);
    expect(idsUnder(strip)).toEqual(['withdraw-request']);
    const ids = idsUnder(page);
    for (const id of ['withdraw-amount', 'withdraw-quick-10000', 'withdraw-quick-20000', 'withdraw-all', 'withdraw-send-to', 'withdraw-to-bank', 'withdraw-to-upi', 'withdraw-explain', 'withdraw-past']) expect(ids).toContain(id);
    expect(ids).not.toContain('withdraw-request');
  });

  it('the brand\'s side: the same strip; a refused amount is still said under the box', async () => {
    brandApi.getWithdrawOptions.mockResolvedValue(ok(OPTS));
    const r = await mount(<WithdrawScreen navigation={nav()} route={{ params: { side: 'brand' } }} />, 'withdraw');
    expect(flat(r.getByTestId('withdraw-actions')).position).toBeUndefined();
    r.getByTestId('withdraw-sent-to');
    fireEvent.changeText(r.getByTestId('withdraw-amount'), '60000');
    await act(async () => { fireEvent.press(r.getByTestId('withdraw-request')); });
    r.getByText("That's more than your ₹48,200 available.");
  });

  it('it cannot be asked for right now: no form and no strip — the screen it always was', async () => {
    influencerApi.getWithdrawOptions.mockResolvedValue(ok({ ...OPTS, blocked: { code: 'ONE_AT_A_TIME', message: 'You have a withdrawal waiting.' } }));
    const r = await mount(<WithdrawScreen navigation={nav()} route={{ params: { side: 'creator' } }} />, 'withdraw-blocked');
    expect(r.queryByTestId('withdraw-actions')).toBeNull();
    expect(r.queryByTestId('withdraw-request')).toBeNull();
  });
});

/* ───────────────────── the plain forms: no bar, the button is the last thing in the form */

describe('forms whose button is in the form — a FormScroll, and nothing else changed', () => {
  /** The page is a FormScroll with the padding it had; `button` is still inside it. */
  function expectPlainForm(r, { scrollId, padding, button }) {
    const page = pathTo(r.toJSON(), byId(scrollId)).pop();
    expect(page.type).toBe('RCTScrollView');
    expect(flat(page)).toEqual({ flex: 1 });
    expect(page.props.keyboardShouldPersistTaps).toBe('handled');
    expect(typeof page.props.onFocus).toBe('function');
    expect(typeof page.props.onLayout).toBe('function');
    expect(StyleSheet.flatten(page.props.contentContainerStyle)).toEqual(padding);
    if (button) expect(idsUnder(page)).toContain(button);
    return page;
  }

  it('the pitch form: the message box, its counter and "Send pitch" are in the form; typing the message keeps its counter in view', async () => {
    influencerApi.pitchForm.mockResolvedValue(ok({ form: {
      brand: { id: 'b1', name: 'Stride Kicks' }, responseDays: 30, acceptedAims: ['conversion'], acceptedModes: ['shipment'],
      canPitch: true, reason: 'OK', cooldownUntil: null, cooldownLine: null,
      minimums: { feeEngagement: null, feeHybrid: null, commission: 12, commissionHybrid: null },
      openPitches: 0, maxOpen: 3, limitLine: 'Your 1st open pitch to this brand · 3 allowed', limitReachedLine: null, earliestGoLiveDate: '2026-10-08',
    } }));
    const r = await mount(<PitchFormScreen navigation={nav()} route={{ params: { brandId: 'b1', brandName: 'Stride Kicks' } }} />, 'pitch-form-title');
    expectPlainForm(r, { scrollId: 'pitch-form-scroll', padding: { padding: 16, paddingBottom: 40 }, button: 'pitch-next-1' });
    expectReveal(r, () => fireEvent(r.getByTestId('pitch-commission'), 'focus'));
  });

  it('her delivery address: every box and "Review and send" are in the form', async () => {
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: REMOTE({ can: { sendAddress: true } }) }));
    const r = await mount(<RemoteAddressScreen navigation={nav()} route={HER} />, 'remote-address');
    await settle();                                                    // the offered states arrive
    const page = expectPlainForm(r, { scrollId: 'remote-address-scroll', padding: { padding: 18, paddingBottom: 40 }, button: 'review-send' });
    for (const id of ['f-name', 'f-phone', 'f-street', 'f-pincode', 'f-note', 'f-sizes']) expect(idsUnder(page)).toContain(id);
    expectReveal(r, () => fireEvent(r.getByTestId('f-sizes'), 'focus'));
  });

  it('a payout detail: the boxes and Save are in the form', async () => {
    const r = await mount(<PayoutDetailScreen navigation={nav()} route={{ params: { kind: 'bank' } }} />, 'payout-bank');
    const page = expectPlainForm(r, { scrollId: 'payout-scroll', padding: { padding: 18, paddingBottom: 40 }, button: 'payout-save' });
    for (const id of ['payout-bank_account_no', 'payout-bank_ifsc']) expect(idsUnder(page)).toContain(id);
    expectReveal(r, () => fireEvent(r.getByTestId('payout-bank_ifsc'), 'focus'));
  });

  it('one collection: with the keypad open for the new name, "Save" is pressed on the first tap (the page keeps taps alive)', async () => {
    influencerApi.getCollection.mockResolvedValue(ok({ collection: { id: 'c1', name: 'Goa trip edit', kind: 'posts', hidden: false, line: '2 posts', hidden_line: null,
      items: [{ id: 'i1', kind: 'post', title: 'Weekend denim', brand_name: 'Urban Threads', line: 'Bundle', in_shop: true }] } }));
    const r = await mount(<CollectionScreen navigation={nav()} route={{ params: { collectionId: 'c1' } }} />, 'collection');
    const page = expectPlainForm(r, { scrollId: 'collection-scroll', padding: { padding: 16, paddingBottom: 40 } });
    for (const id of ['item-i1', 'add-items', 'rename', 'delete']) expect(idsUnder(page)).toContain(id);
    fireEvent.press(r.getByTestId('rename'));
    r.getByTestId('rename-input'); r.getByTestId('rename-save');
  });
});

/* ───────── forms whose strip was ALREADY in the column: the page becomes a FormScroll, the strip is untouched */

describe('forms whose button strip never floated — a FormScroll above the same strip, and nothing else changed', () => {
  /**
   * Title row → the page (a FormScroll, straight in the screen's column) → the strip the screen
   * always had, as the very next thing. The strip keeps its own measure (U10); it is not absolute.
   */
  function expectFormOverOwnStrip(r, { scrollId, padding, strip: want, holds }) {
    const root = r.toJSON();
    const trail = pathTo(root, byId(scrollId));
    expect(trail).toHaveLength(2);                                     // screen → the page
    const page = trail[1];
    expect(page.type).toBe('RCTScrollView');
    expect(flat(page)).toEqual({ flex: 1 });
    expect(page.props.keyboardShouldPersistTaps).toBe('handled');
    expect(typeof page.props.onFocus).toBe('function');
    expect(typeof page.props.onLayout).toBe('function');
    expect(StyleSheet.flatten(page.props.contentContainerStyle)).toEqual(padding);
    const at = root.children.indexOf(page);
    expect(at).toBeGreaterThan(0);                                     // the title row is above it
    const strip = root.children[at + 1];
    expect(root.children).toHaveLength(at + 2);                        // …and the strip is the last thing drawn
    const style = flat(strip);
    expect(style.position).toBeUndefined();
    expect(style.bottom).toBeUndefined();
    expect(style).toEqual(want);                                       // exactly the strip it had
    expect(idsUnder(strip)).toEqual(holds);
    for (const id of holds) expect(pathTo(page, byId(id))).toBeNull();
    return { page, strip };
  }
  const CREATE_STRIP = { padding: 16, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg };

  it('Change number: every step\'s boxes are in the form, its one button in the strip; typing the new number keeps the red line under it in view', async () => {
    authApi.changePhoneStart.mockResolvedValue(ok({ sent_to: '+919876543210' }));
    authApi.changePhoneVerifyOld.mockResolvedValue(ok({ change_token: 'tok-old', expires_in: 900 }));
    const r = await mount(<ChangeNumberScreen navigation={nav()} route={{ params: { role: 'influencer', returnTo: 'ProfileInfo', phone: '+919876543210' } }} />, 'change-number');
    const OWN = { padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border };
    const one = expectFormOverOwnStrip(r, { scrollId: 'change-number-scroll', padding: { padding: 18 }, strip: OWN, holds: ['send-old'] });
    expect(one.strip.props.testID).toBe('change-number-actions');
    expect(idsUnder(one.page)).toEqual(expect.arrayContaining(['change-number-steps', 'current-number', 'note-both-phones']));

    // Step 2 — the six code boxes and the resend line are in the form.
    await act(async () => { fireEvent.press(r.getByTestId('send-old')); });
    await waitFor(() => r.getByTestId('old-otp-0'));
    const two = expectFormOverOwnStrip(r, { scrollId: 'change-number-scroll', padding: { padding: 18 }, strip: OWN, holds: ['verify-old'] });
    expect(idsUnder(two.page)).toEqual(expect.arrayContaining(['sent-to-old', 'old-otp-0', 'old-otp-5', 'resend-old-wait']));
    // 88 under a box here, not 64: the red "already has an account" note is taller than an error line.
    expectReveal(r, () => fireEvent(r.getByTestId('old-otp-0'), 'focus'), 88);

    // Step 3 — the new number, with the notes under it.
    fireEvent.changeText(r.getByTestId('old-otp-0'), '482913');
    await act(async () => { fireEvent.press(r.getByTestId('verify-old')); });
    await waitFor(() => r.getByTestId('new-phone'));
    const three = expectFormOverOwnStrip(r, { scrollId: 'change-number-scroll', padding: { padding: 18 }, strip: OWN, holds: ['send-new'] });
    expect(idsUnder(three.page)).toEqual(expect.arrayContaining(['new-phone', 'note-role-only']));
    expectReveal(r, () => fireEvent(r.getByTestId('new-phone'), 'focus'), 88);
  });

  it('a new collection: the name box and the list are in the form, "Create collection" in the Create tab\'s own strip', async () => {
    influencerApi.collectionOptions.mockImplementation((kind) => Promise.resolve(ok(kind === 'posts'
      ? { kind, posts: [{ id: 'p1', title: 'Weekend denim', brand_name: 'Urban Threads', cover: null }] }
      : { kind, groups: [{ campaign_influencer_id: 'ci1', brand_name: 'Urban Threads', campaign_name: 'Diwali Denim', set_name: 'Set A',
        products: [{ id: 'f1', name: 'Linen shirt · Sage', line: '₹849 · normal price' }] }] })));
    const r = await mount(<NewCollectionScreen navigation={nav()} route={{ params: {} }} />, 'pick-post-p1');
    const { page } = expectFormOverOwnStrip(r, { scrollId: 'new-collection-scroll', padding: { padding: 16 }, strip: CREATE_STRIP, holds: ['create'] });
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['collection-name', 'kind-posts', 'kind-products', 'pick-post-p1']));
    expectReveal(r, () => fireEvent(r.getByTestId('collection-name'), 'focus'));
    // Products: the search box is in the same form — and picking still works as it did.
    fireEvent.press(r.getByTestId('kind-products'));
    await waitFor(() => r.getByTestId('pick-product-f1'));
    const again = expectFormOverOwnStrip(r, { scrollId: 'new-collection-scroll', padding: { padding: 16 }, strip: CREATE_STRIP, holds: ['create'] });
    expect(idsUnder(again.page)).toEqual(expect.arrayContaining(['collection-name', 'search', 'pick-product-f1']));
    expectReveal(r, () => fireEvent(r.getByTestId('search'), 'focus'));
    fireEvent.press(r.getByTestId('pick-product-f1'));
    r.getByText('Create collection · 1 product');
  });

  it('review a post: the caption box and the facts are in the form, "Send to INFLX" in the strip; typing the caption keeps it in view', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: {
      id: 'p1', state: 'draft', status: 'draft', title: 'Weekend denim', caption: null, kind: 'offer', media_kind: 'image',
      collaboration: { id: 'ci1', brand_name: 'Urban Threads', campaign_name: 'Diwali Denim', set_name: 'Set A' },
      products: [{ id: 'j1', name: "Levi's 511 Slim" }], media: [{ id: 'm1', url: 'https://x/1.jpg' }],
      facets: { category: ['Men › Bottomwear › Jeans'], offer: 'Bundle · Any 2 for ₹2,999', price_band: 'Under ₹2,999', top_price: 2499, theme: 'Winter' },
    } }));
    const r = await mount(<PostReviewScreen navigation={nav()} route={{ params: { postId: 'p1', fix: true } }} />, 'caption');
    const { page } = expectFormOverOwnStrip(r, { scrollId: 'post-review-scroll', padding: { padding: 16 }, strip: CREATE_STRIP, holds: ['send'] });
    expect(idsUnder(page)).toEqual(expect.arrayContaining(['edit-media', 'caption', 'fact-category', 'fact-offer', 'fact-price', 'fact-theme', 'fact-theme-edit', 'fact-for', 'fact-products', 'fact-products-edit']));
    // The strip of pictures keeps its own sideways scroller inside the form.
    const sideways = pathTo(page, (n) => n.type === 'RCTScrollView' && n !== page && n.props.horizontal === true);
    expect(sideways).not.toBeNull();
    expectReveal(r, () => fireEvent(r.getByTestId('caption'), 'focus'));
  });
});

/* ─────────────────────────────────────────── her agreement's own title row (D4) */

describe('her agreement — the title row starts where every other pushed screen\'s does', () => {
  const TERMS = {
    aim: 'engagement', campaignName: 'Diwali Edit 2026', setName: 'Set A', postingDate: '2026-10-24', cutoff: '2026-10-17',
    shootMode: 'shipment', branchName: null, branchCity: null,
    parties: { brand: { name: 'Stride Kicks' }, creator: { name: 'Sneha Narayan' } },
    money: { fee: 8000, commissionPct: null, split: { t1: 2000, t2: 2000, t3: 4000 }, commissionAfterDays: null },
    work: { deliverablesWords: '1 Instagram reel, 2 stories', usageRights: null, minShoppablePosts: null },
    sell: null, returnTerms: { days: 7, brandPaysShipping: true }, note: null,
  };
  const AG = { invitationId: 'ci1', reference: 'INFLX-2026-00456', status: 'pending_influencer', cutoff: '2026-10-17', daysLeft: 4,
    terms: TERMS, standardTerms: { version: '1.0' }, signatures: { creator: null, brand: null }, ending: null, can: { sign: true, decline: true, download: false } };
  const open = async () => { influencerApi.myAgreement.mockResolvedValue(ok({ agreement: AG })); return mount(<AgreementScreen navigation={nav()} route={HER} />, 'agreement-body'); };

  it('an opaque status bar (inset 0): 4 above the 40-high back control, as the shared title row keeps', async () => {
    const r = await open();
    const bar = flat(r.getByTestId('agreement-bar'));
    expect(bar).toMatchObject({ paddingTop: 4, paddingBottom: 10, paddingHorizontal: 8, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' });
    expect(flat(r.getByTestId('back'))).toMatchObject({ width: 40, height: 40 });
  });

  it('a phone that draws edge to edge (inset 24): the title clears the status bar — 24 + 4', async () => {
    mockInsets = { top: 24, bottom: 0, left: 0, right: 0 };
    const r = await open();
    expect(flat(r.getByTestId('agreement-bar')).paddingTop).toBe(28);
  });

  it('the same in the loading and failed states, and Back still goes back', async () => {
    mockInsets = { top: 24, bottom: 0, left: 0, right: 0 };
    influencerApi.myAgreement.mockResolvedValue({ success: false, error: { message: 'nope' } });
    const n = nav();
    const r = await mount(<AgreementScreen navigation={n} route={HER} />, 'load-error');
    expect(flat(r.getByTestId('agreement-bar')).paddingTop).toBe(28);
    fireEvent.press(r.getByTestId('back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });

  it('everything else on the screen is as it was: Sign and Decline in their own strip under the page', async () => {
    const r = await open();
    const strip = r.getByTestId('agreement-actions');
    expect(flat(strip).position).toBeUndefined();
    within(strip).getByTestId('agreement-sign'); within(strip).getByTestId('agreement-decline');
    r.getByTestId('agreement-tosign'); r.getByTestId('what-you-get'); r.getByTestId('what-you-do'); r.getByTestId('standard-terms');
  });
});

/* ───────────────────────────────────────────────────────── the source itself */

describe('the source of the creator, shared, create and wallet screens', () => {
  const SRC = path.join(__dirname, '..');
  const DIRS = ['influencer', 'shared', 'create', 'wallet'];
  const files = DIRS.flatMap((d) => fs.readdirSync(path.join(SRC, d)).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`));
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

  it.each(files)('%s — nothing is pinned to the bottom of the screen over the page, and no room is kept for such a bar', (rel) => {
    const src = read(rel);
    // A style that is absolute AND bottom: 0 without also being a full cover (top: 0) is a floating bar.
    const floating = (src.match(/\{[^{}]*position:\s*'absolute'[^{}]*\}/g) || [])
      .filter((style) => /\bbottom:\s*0\b/.test(style) && !/\btop:\s*0\b/.test(style));
    expect(floating).toEqual([]);
    expect(src).not.toMatch(/paddingBottom:\s*1\d\d\b/);
    expect(src).not.toMatch(/<View style=\{\{ height: 1\d\d \}\} \/>/);
    // No screen measures a bar to pad its page any more.
    expect(src).not.toMatch(/\bbarH\b|BAR_ROOM/);
  });

  // The screens whose bar was floating, and what their strip is called.
  const CONVERTED = [
    ['influencer/InvitationScreen.js', 'ScrollView'], ['influencer/ThreadScreen.js', 'ScrollView'],
    ['shared/PitchThreadScreen.js', 'ScrollView'], ['shared/ShootThreadScreen.js', 'ScrollView'], ['influencer/ShootScreen.js', 'ScrollView'],
    ['influencer/CounterScreen.js', 'FormScroll'], ['shared/PitchCounterScreen.js', 'FormScroll'], ['influencer/MoveRequestScreen.js', 'FormScroll'],
    ['shared/ShootCounterScreen.js', 'FormScroll'], ['influencer/RemoteShootScreen.js', 'FormScroll'],
    ['influencer/ContentScreen.js', 'FormScroll'], ['influencer/SaleLiveScreen.js', 'FormScroll'],
  ];
  it.each(CONVERTED)('%s — the page, then the toast, inside the box above the strip; then the BottomBar', (rel, pageTag) => {
    const src = read(rel);
    expect(src).toMatch(/import \{ BottomBar \} from '\.\.\/\.\.\/components\/shell\/BottomBar';/);
    expect(src).toMatch(/useToast\(\{ inFlow: [^}]+\}\)/);
    expect(src).not.toMatch(/useToast\(\)/);
    const closePage = src.lastIndexOf(`</${pageTag}>`);
    const toast = src.indexOf('{toast}', closePage);
    const closeArea = src.lastIndexOf('</FormArea>');
    const bar = src.indexOf('<BottomBar', closeArea);
    expect(closePage).toBeGreaterThan(-1);
    expect(toast).toBeGreaterThan(closePage);
    expect(closeArea).toBeGreaterThan(toast);
    expect(bar).toBeGreaterThan(closeArea);
    expect(src.match(/\{toast\}/g).filter(Boolean)).toHaveLength(1);   // drawn once (these screens' early returns draw none)
    // A page with a text box is a FormScroll and nothing else scrolls it.
    if (pageTag === 'FormScroll') expect(src).not.toMatch(/<ScrollView[\s>]/);
  });

  // Rule 2 holds for EVERY place she types: a screen that draws a text box scrolls it in a FormScroll.
  // (The boxes these screens draw: their own TextInput, and the shared pieces that hold one.)
  const TYPED = /<TextInput\b|<TextField4\b|<NumberField\b|<LinkBox12\b|<ThreeWayCheck11\b/;
  const typing = files.filter((rel) => TYPED.test(read(rel)));
  it('the screens someone types on are the ones this file knows about', () => {
    expect(typing.sort()).toEqual([
      'create/CollectionScreen.js', 'create/NewCollectionScreen.js', 'create/PostCommentsScreen.js', 'create/PostReviewScreen.js',
      'influencer/ContentScreen.js', 'influencer/CounterScreen.js', 'influencer/DeliveryAddressScreen.js', 'influencer/InvitationSettingsScreen.js',
      'influencer/MoveRequestScreen.js', 'influencer/NicheLanguagesScreen.js', 'influencer/PayoutDetailScreen.js',
      'influencer/PitchFormScreen.js', 'influencer/ProfileInfoScreen.js', 'influencer/RemoteAddressScreen.js',
      'influencer/RemoteShootScreen.js', 'influencer/SaleLiveScreen.js', 'shared/ChangeNumberScreen.js', 'shared/PitchCounterScreen.js',
      'shared/ShootCounterScreen.js', 'wallet/WithdrawScreen.js',
    ]);
  });
  it.each(typing)('%s — a screen with a text box scrolls it in a FormScroll, never in a plain upright ScrollView', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/import (FormScroll|\{[^}]*\bFormScroll\b[^}]*\}) from '\.\.\/\.\.\/components\/shell\/FormScroll';/);
    expect(src).toMatch(/<FormScroll[\s>]/);
    // Any plain ScrollView left in the file is sideways, or the page of a state with nothing to type in.
    const plain = (src.match(/<ScrollView\b[^>]*>/g) || []).filter((tag) => !/\bhorizontal\b/.test(tag));
    const allowed = rel === 'wallet/WithdrawScreen.js' ? 1 : 0;        // "it can't be asked for right now": no box on that page
    expect(plain).toHaveLength(allowed);
  });

  it('Withdraw: a FormScroll and a BottomBar (it shows no toast)', () => {
    const src = read('wallet/WithdrawScreen.js');
    expect(src.indexOf('<BottomBar', src.lastIndexOf('</FormScroll>'))).toBeGreaterThan(-1);
    expect(src).not.toMatch(/useToast/);
  });

  it('the two counter screens use the one shared rule for the deliverable lines — no copy of it', () => {
    for (const rel of ['influencer/CounterScreen.js', 'shared/PitchCounterScreen.js']) {
      const src = read(rel);
      expect(src).toMatch(/deliverableRowsError5\(/);
      expect(src).not.toMatch(/new Set\(\)/);
      expect(src).not.toMatch(/DELIVERABLE_COUNT|DELIVERABLE_DUP/);
    }
  });
});
