/**
 * ui-walk-fixes — board C on the brand's "work" screens (slice C1b): the agreement, the counter
 * conversation, Plan the visit, the store visit, the Remote shoot and its two booking steps, the
 * content step, going live, and the full-screen "Choose products" pop-up.
 *
 * Before: each of these drew its main-button bar as an overlay (`position: 'absolute', bottom: 0`)
 * on top of the scrolling page, and the page carried 120–190 of empty space at its end just to
 * scroll clear of it. With the keypad open the bar rode up and sat on the box being typed in
 * (frame C0). Now, on every one of them:
 *   · the column is title row → the box that holds the page → the strip, nothing floating;
 *   · the strip is the one shared BottomBar, with every button it had, in the order it had them;
 *   · the empty space at the end of the page is gone;
 *   · where the page holds a text box it is a FormScroll, so the lines under the box being typed
 *     in come into view above the strip (frames C1–C3);
 *   · the toast is drawn inside the box above the strip, 16 above the strip.
 * And two things this slice was asked for besides: the agreement's own title bar starts at the
 * phone's top inset like every other pushed screen (D4), and a counter the server refuses is said
 * inside the open counter pop-up, never as a toast behind it.
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
jest.mock('../../services/api', () => ({
  brandApi: {
    getShoot: jest.fn(), sendShootPlan: jest.fn(), confirmShoot: jest.fn(), moveShoot: jest.fn(),
    remote: jest.fn(), remoteProducts: jest.fn(), remoteSaveLines: jest.fn(), remoteQuote: jest.fn(),
    remoteBook: jest.fn(), remoteRebook: jest.fn(), remoteLabel: jest.fn(), remoteCancel: jest.fn(),
    remoteGift: jest.fn(), remoteReport: jest.fn(), remoteConfirmReturn: jest.fn(), remoteAcknowledge: jest.fn(),
    listBranches: jest.fn(),
    content: jest.fn(), contentApprove: jest.fn(), contentChanges: jest.fn(), contentConfirmLive: jest.fn(),
    contentReport: jest.fn(), contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
    brandThread: jest.fn(), brandAcceptCounter: jest.fn(), brandCounter: jest.fn(), brandDeclineCounter: jest.fn(), answerMoveRequest: jest.fn(),
    getAgreement: jest.fn(), agreementPreview: jest.fn(), agreementCost: jest.fn(),
    sendAgreement: jest.fn(), signAgreement: jest.fn(), withdrawAgreement: jest.fn(), agreementDocument: jest.fn(),
    getListingTree: jest.fn(), productsWithoutOffersForSet: jest.fn(), offerChoices: jest.fn(),
  },
  influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(), uploadContentFile: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));

const { brandApi } = require('../../services/api');
const BrandAgreementScreen = require('../brand/BrandAgreementScreen').default;
const BrandThreadScreen = require('../brand/BrandThreadScreen').default;
const BrandShootPlanScreen = require('../brand/BrandShootPlanScreen').default;
const BrandShootScreen = require('../brand/BrandShootScreen').default;
const BrandRemoteScreen = require('../brand/BrandRemoteScreen').default;
const BrandRemoteBookScreen = require('../brand/BrandRemoteBookScreen').default;
const BrandRemoteProductsScreen = require('../brand/BrandRemoteProductsScreen').default;
const BrandContentScreen = require('../brand/BrandContentScreen').default;
const BrandSaleLiveScreen = require('../brand/BrandSaleLiveScreen').default;
const { ChooseProductsModal } = require('../../components/invitations/sellSheets');
const { BrandCounterSheet6, DeclineCounterSheet6 } = require('../../components/negotiation/sheets6');
const { settingsTokens: T } = require('../../theme/tokens');
const { C11 } = require('../../components/remote/copy11');
const { C6 } = require('../../components/negotiation/copy6');

// React reports a clash of keys — and most other mistakes in how a tree is put together — through
// console.error and then carries on. Every test here must leave it silent.
// A press starts TouchableOpacity's fade, and a toast its own; with real timers they land between
// awaits and warn about act(), so the timers are jest's.
let errorSpy;
beforeEach(() => {
  jest.clearAllMocks();
  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  jest.useFakeTimers();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errorSpy.mock.calls.map(args => args.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const yr = new Date().getFullYear();
const NEXT = yr + 1;                                   // every date below is still ahead, whenever this runs
const ROUTE = { params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } };
const withToast = (text) => ({ params: { ...ROUTE.params, toast: text } });

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

/**
 * The column of a screen: title row, then the box that holds the page, then (if `stripId`) the
 * strip as the very next thing — a child of the screen itself, never inside the page and never
 * an overlay. Returns the pieces for the test to look at further.
 */
function column(r, { screenId, stripId, padding }) {
  const tree = r.toJSON();
  const root = screenId ? pathTo(tree, byId(screenId)).pop() : tree;
  const trail = pathTo(root, n => n.type === 'RCTScrollView');
  // screen → the box that holds the page → the page itself: the page is not buried any deeper.
  expect(trail).toHaveLength(3);
  const [, area, page] = trail;
  expect(flat(area)).toEqual({ flex: 1 });
  expect(flat(page)).toEqual({ flex: 1 });
  const at = root.children.indexOf(area);
  expect(at).toBeGreaterThan(0);                                     // the title row is above it
  // The page ends with its ordinary padding: none of the 120 / 150 / 190 that cleared a floating bar.
  const content = StyleSheet.flatten(page.props.contentContainerStyle);
  expect(content).toEqual(padding);
  const spacers = (page.children[0].children || []).filter(c => typeof c !== 'string' && !c.children && (flat(c).height || 0) >= 100);
  expect(spacers).toEqual([]);

  const after = root.children.slice(at + 1).filter(c => typeof c !== 'string');
  if (!stripId) {
    // Nothing to offer: no strip at all — not an empty one with a hairline.
    expect(after.filter(c => flat(c).borderTopWidth != null)).toEqual([]);
    return { root, area, page, strip: null };
  }
  const strip = after[0];
  expect(strip.props.testID).toBe(stripId);
  expect(flat(strip)).toEqual(STRIP);
  expect(flat(strip).position).toBeUndefined();
  expect(flat(strip).bottom).toBeUndefined();
  // …once, and not inside the page.
  expect(pathTo(page, byId(stripId))).toBeNull();
  expect(r.getAllByTestId(stripId)).toHaveLength(1);
  return { root, area, page, strip };
}

/** What FormScroll adds to a page that holds a text box. */
function expectForm(page) {
  expect(page.props.keyboardShouldPersistTaps).toBe('handled');
  expect(typeof page.props.onFocus).toBe('function');
  expect(typeof page.props.onLayout).toBe('function');
}

/**
 * The phone's answers, supplied by hand: the box is 640 down the form and at 268 on screen, the
 * room above the strip and the keypad is 260 tall starting at 54. Focusing the box must scroll
 * the form to 640 + 46 + 64 − 260 = 490, so the counter / hint / error under it are in view.
 */
function expectReveal(r, boxId) {
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
    fireEvent(r.getByTestId(boxId), 'focus');
    expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 490, animated: true });
  } finally {
    spy.mockRestore();
  }
}

/** The toast: inside the box above the strip (page, then toast), 16 above the strip. */
function expectToastAboveStrip(r, { screenId, stripId } = {}) {
  const tree = r.toJSON();
  const root = screenId ? pathTo(tree, byId(screenId)).pop() : tree;
  const trail = pathTo(root, byId('toast'));
  expect(trail).toHaveLength(3);
  const area = trail[1];
  expect(area.children.map(c => c.type)).toEqual(['RCTScrollView', 'View']);
  expect(flat(area)).toEqual({ flex: 1 });
  expect(flat(r.getByTestId('toast'))).toMatchObject({ position: 'absolute', left: 16, right: 16, bottom: 16 });
  if (stripId) expect(root.children[root.children.indexOf(area) + 1].props.testID).toBe(stripId);
}

/* ───────────────────────────────────────────────────────────── fixtures */

const VISIT_AT = `${NEXT}-01-10T05:30:00.000Z`;
const VISIT = (over = {}) => ({
  invitationId: 'ci1', shootId: 'ev1', contractId: 'k1',
  gate: { open: true, reason: null, signed: { at: `${yr}-01-02T06:00:00.000Z` }, money: { required: true, locked: 9720, released: 2250 } },
  aim: 'engagement', mode: 'visit', isVisit: true,
  campaignName: 'Diwali Edit', setName: 'Set A',
  brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
  postingDate: `${NEXT}-01-24`, daysToPosting: 23,
  stage: 'agreed', stageLabel: null, passed: false,
  plan: {
    branch: { name: 'Banjara Hills', city: 'Hyderabad', address: 'Road No. 12, Banjara Hills, Hyderabad' },
    contact: { name: 'Ravi Menon', phone: '+919849011223' },
    visitAt: VISIT_AT, durationText: 'About 2 hours', notes: null,
    sentAt: `${yr}-01-03T06:00:00.000Z`, agreedAt: `${yr}-01-04T06:00:00.000Z`, attendedAt: null, confirmedAt: null,
  },
  thread: { negotiation: { id: 'n1', open: false, whoseMove: null, roundLimit: 2, countersUsed: 1 }, turns: [] },
  delayed: null,
  can: { plan: false, send: false, move: true, confirm: false },
  steps: [
    { key: 'signed', label: 'Agreement signed', state: 'done', detail: '14 Sep' },
    { key: 'shoot', label: 'Shoot plan', state: 'now', detail: 'Visit 10 Jan' },
    { key: 'content', label: 'Content', state: 'later', detail: 'After the shoot' },
  ],
  contactPrefill: { name: null, phone: '+919849011223' },
  branchNow: { name: 'Banjara Hills', address: 'Road No. 12, Banjara Hills, Hyderabad', city: 'Hyderabad' },
  legacyNoPostingDate: false,
  ...over,
});
const ATTENDED = () => VISIT({ stage: 'attended', plan: { ...VISIT().plan, attendedAt: `${yr}-01-10T09:00:00.000Z` }, can: { move: true, confirm: true } });

const REMOTE = (over = {}) => ({
  invitationId: 'ci1', shootId: 'pe1', contractId: 'con1',
  gate: { open: true, reason: null, signed: { at: `${yr}-01-02T00:00:00Z` }, money: { required: false, locked: 0, released: 0 } },
  aim: 'engagement', mode: 'shipment', isRemote: true,
  campaignName: 'Diwali Edit', setName: 'Set A',
  brand: { name: 'Kanchi Silks' }, creator: { name: 'Tanvi Suresh' },
  postingDate: `${NEXT}-01-24`, daysToPosting: 20,
  stage: 'not_sent', stageLabel: 'Waiting for her address',
  address: null, parcel: null, lines: [], lineCount: 0, maxLines: 20,
  return: { shipment: null, stage: 'none', stageLabel: 'Nothing to send back', dueDate: null, overdue: false, count: 0, canPickup: true },
  difference: { reportedAt: null, acknowledgedAt: null, returnReportedAt: null, overdueReportedAt: null },
  delayed: null, can: {},
  steps: [
    { key: 'signed', label: 'Agreement signed', state: 'done', detail: '1 Oct' },
    { key: 'products', label: 'Products', state: 'now', detail: 'Waiting for her address' },
    { key: 'content', label: 'Content', state: 'later', detail: 'After the shoot' },
  ],
  ...over,
});
const LINE = { id: 'l1', productId: 'p1', variantId: null, name: 'Indigo Saree', variantLabel: null, image: null, price: 2400, quantity: 1, disposition: 'return', check: null, checkNote: null, checkedAt: null, returnStatus: null, reportedAt: null };
const ADDRESS = { name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road', pincode: '522002', state: 'Andhra Pradesh', city: 'Guntur', note: null, sizes: 'Top M', sentAt: `${yr}-01-03T00:00:00Z`, correctedAt: null, coverage: { delivers: true, returnPickup: true, checkedAt: 'x' } };
const PARCEL = { id: 'sh1', provider: 'simulator', direction: 'outbound', courier: 'Test Express', tracking: 'TEST0000004471', box: { preset: 'medium' }, weightKg: 1.2, bookedAt: `${yr}-01-04T00:00:00Z`, cancelledAt: null, collectedAt: null, outForDeliveryAt: null, deliveredAt: null, returnedToStoreAt: null, attemptFailedCount: 0, lastAttemptReason: null, rebookedFromId: null, charged: 120, quoted: 120, gst: 18, returnHold: 80, branchId: 'b1', from: 'Hyderabad', declaredValue: 2400 };
const BRANCHES = ok({ branches: [{ id: 'b1', name: 'Banjara Hills', isMain: true, formattedAddress: 'Road 12', pincode: '500034', cityName: 'Hyderabad' }] });
const CATALOGUE = ok({ scope: { kind: 'store', label: 'Whole store' }, products: [{ id: 'p1', name: 'Indigo Saree', image: null, price: 2400, variants: [] }], nextCursor: null });

const D = (d) => `${yr}-10-${String(d).padStart(2, '0')}T06:00:00.000Z`;
const CONTENT = (over = {}) => ({
  invitationId: 'ci1', contentId: 'cc1', campaignName: 'Diwali Edit 2026', setName: 'Set A', mode: 'visit',
  brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
  stage: 'draft', frozen: false, shootDoneAt: D(19), postingDate: `${NEXT}-01-24`, daysToPosting: 5,
  rows: [], missing: [], proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [], changesAsked: 0,
  approvedAt: null, postedAt: null, reportFrom: null, liveConfirmedAt: null, finalDueAt: null, completedAt: null, proofCount: 0,
  money: { fee: 12000, waitDays: 7, stillLocked: 9000, campaignFee: 960, t1: { amount: 3000, paidAt: D(1), status: 'released' }, t2: { amount: 3000, paidAt: null, status: 'locked' }, t3: { amount: 6000, paidAt: null, status: 'locked', dueAt: null } },
  usageRights: { on: true, durationDays: 90, places: ['social'], words: '90 days · social' },
  reported: { brand: null, creator: null }, delayed: null, yourMove: true, move: { key: 'send_content', side: 'creator' },
  can: {},
  steps: [
    { key: 'signed', label: 'Agreement signed', state: 'done', at: D(1) },
    { key: 'shoot', label: 'Shoot', state: 'done', at: D(19) },
    { key: 'content', label: 'Content', state: 'now', at: null },
    { key: 'live', label: 'Live and paid', state: 'later', at: null },
  ],
  ...over,
});
const CONTENT_SENT = () => CONTENT({
  stage: 'in_review',
  rows: [{ key: 'reel', type: 'reel', count: 1, label: 'Instagram reel', platform: 'instagram', isStory: false, caption: 'Diwali in the new linen co-ord.', files: [{ id: 'v1', kind: 'video', mime: 'video/mp4', durationS: 28, notes: [], pinnedNote: null }], have: 1, proofs: [] }],
  rounds: [{ no: 1, verdict: null, submittedAt: D(20), rows: [], notes: [] }],
  can: { approve: true, askChanges: true, confirmLive: false, reportRoundsUsed: false, reportPostedWrong: false },
});

const SALE = (over = {}) => ({
  aim: 'sale', invitationId: 'ci1', contentId: 'cc1', campaignName: 'Diwali Edit 2026', setName: 'Set B', mode: 'shipment',
  brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
  stage: 'posts', frozen: false, shootDoneAt: D(16), postingDate: `${NEXT}-01-24`, daysToPosting: 8,
  rows: [], missing: [], proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [],
  approvedAt: null, postedAt: null, liveConfirmedAt: null, completedAt: null, money: null,
  path1: { min: 2, approved: 1, short: 1, met: false, late: 0, inReview: 0, sentBack: 0, open: true,
    posts: [{ id: 'p1', title: 'Festive Sarees', code: 'K7M2F9', kind: 'offer', offerName: '20% off', state: 'approved', counts: true, approvedAt: D(19), late: false, sharable: true, cover: null, inPackage: false }] },
  notShared: [], sales: { orders: 0, sales: 0, commission: 0, pending: 0, inWallet: 0 },
  autoconfirmAt: null, liveConfirmedAuto: false, waitingOnPosts: false,
  reported: { brand: null, creator: null }, delayed: null, yourMove: false, move: { key: 'make_posts', side: 'creator' },
  can: {},
  steps: [
    { key: 'signed', label: 'Agreement signed', state: 'done', at: D(2) },
    { key: 'shoot', label: 'Shoot', state: 'done', at: D(16) },
    { key: 'posts', label: 'Shoppable posts', state: 'now', detail: '1 of 2' },
  ],
  ...over,
});
const SALE_SENT = () => SALE({
  stage: 'in_review',
  rows: [{ key: 's1', type: 'reel', label: 'Instagram reel', count: 1, platform: 'instagram', isStory: false, postId: 'p1', outside: false, caption: '', files: [{ id: 'f1', kind: 'video', mime: 'video/mp4' }], have: 1, proofs: [{ slot: 1, url: null, screenshotFileId: null, filled: false }], post: { id: 'p1', title: 'Festive Sarees', code: 'K7M2F9' } }],
  rounds: [{ no: 1, submittedAt: D(20), verdict: null, rows: [], notes: [] }],
  can: { approve: true, askChanges: true, reportRoundsUsed: true },
});

const THREAD = (over = {}) => ({
  invitationId: 'ci1', goal: 'conversion', status: 'negotiating',
  brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' },
  campaignName: 'Diwali Edit 2026', setName: 'Set A', postingDate: `${NEXT}-01-24`, cutoff: `${NEXT}-01-17`, cutoffPassed: false,
  shootMode: 'visit', cityName: 'Hyderabad', switchOn: true,
  negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1, isLastRound: true, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { commissionPct: 13 }, currentLine: '13%',
  turns: [{ id: 't1', by: 'influencer', mine: false, at: `${yr}-01-13T10:00:00Z`, kind: 'counter', terms: { commissionPct: 13 }, changes: [{ term: 'commissionPct', from: '10%', to: '13%' }], note: null }],
  invitation: { terms: { commissionPct: 10 }, termsLine: '10%', sentAt: `${yr}-01-12T10:00:00Z`, scopeWords: 'Anything in the store', offerName: null },
  moveRequest: null, pool: null, ending: null, warnings: [], minimums: { fee: null, commissionPct: null },
  can: { counter: true, accept: true, decline: true, moveRequest: false, moveAnswer: false },
  ...over,
});

const TERMS = {
  aim: 'engagement', campaignName: 'Diwali Edit 2026', setName: 'Set A',
  postingDate: `${NEXT}-01-24`, cutoff: `${NEXT}-01-17`,
  shootMode: 'visit', branchName: 'Banjara Hills', branchCity: 'Hyderabad',
  parties: {
    brand: { name: 'Urban Threads', city: 'Hyderabad', state: 'Telangana' },
    creator: { name: 'Tanvi Suresh', city: 'Hyderabad', state: 'Telangana', handle: 'tanvi.styles' },
  },
  money: { fee: 9000, commissionPct: null, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720,
    split: { t1: 2250, t2: 2250, t3: 4500 }, splitPct: [25, 25, 50], commissionAfterDays: null },
  work: { deliverables: [{ type: 'reel', count: 1 }], deliverablesWords: '1 Instagram reel', usageRights: null, minShoppablePosts: null },
  sell: null, returnTerms: { days: 7, brandPaysShipping: true }, note: null,
  termsVersion: '1.0', generatedAt: `${yr}-01-14T10:00:00Z`,
};
const HER_SIG = { name: 'Tanvi Suresh', at: `${yr}-01-14T11:04:00Z`, device: 'Android', ip: '103.21.58.14' };
const BRAND_SIG = { name: 'Ravi Menon', at: `${yr}-01-14T18:18:00Z`, device: 'Android', ip: '49.207.14.92' };
const AG = (over = {}) => ({
  invitationId: 'ci1', contractId: 'k1', reference: 'INFLX-2026-00457', status: 'pending_brand',
  sentAt: `${yr}-01-14T10:00:00Z`, cutoff: `${NEXT}-01-17`, daysLeft: 4, cutoffPassed: false,
  terms: TERMS, standardTerms: { version: '1.0' },
  signatures: { creator: HER_SIG, brand: null }, ending: null,
  money: { fee: 9000, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720, locked: null, released: null, stillLocked: null, at: null },
  can: { send: false, sign: true, withdraw: false, download: false },
  document: { available: false, generatedAt: null },
  ...over,
});
const AG_PREVIEW = () => AG({ reference: null, status: 'draft', sentAt: null, signatures: { creator: null, brand: null }, can: { send: true, sign: false, withdraw: false, download: false } });
const AG_SENT = () => AG({ status: 'pending_influencer', signatures: { creator: null, brand: null }, can: { send: false, sign: false, withdraw: true, download: false } });
const AG_SIGNED = () => AG({ status: 'active', signatures: { creator: HER_SIG, brand: BRAND_SIG },
  money: { fee: 9000, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720, locked: 9720, released: 2250, stillLocked: 7470, at: BRAND_SIG.at },
  can: { send: false, sign: false, withdraw: false, download: true }, document: { available: true, generatedAt: BRAND_SIG.at } });
const AG_WITHDRAWN = () => AG({ status: 'withdrawn', signatures: { creator: null, brand: null }, can: { send: false, sign: false, withdraw: false, download: false },
  ending: { outcome: 'withdrawn', text: 'You withdrew this agreement on 15 Jan.' } });
const COST = { gate: true, fee: 9000, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720, payouts: { t1: 2250, t2: 2250, t3: 4500 }, payoutPct: [25, 25, 50], availableBalance: 24000, shortfall: 0, enough: true, line: '' };
const SHOOT_FOR_AG = { stage: 'attended', passed: false, gate: { open: true, signed: { at: BRAND_SIG.at }, money: { required: true, locked: 9720, released: 2250 } },
  steps: [{ key: 'signed', state: 'done', label: 'Agreement signed', detail: '14 Jan' }, { key: 'shoot', state: 'now', label: 'Shoot plan', detail: 'Waiting for your confirmation' }],
  postingDate: `${NEXT}-01-24`, daysToPosting: 6 };

/* ─────────────────────────────── the screens that only show a page and a strip */

const shootScreen = (shoot, route = ROUTE) => { brandApi.getShoot.mockResolvedValue(ok({ shoot })); return render(<BrandShootScreen navigation={nav()} route={route} />); };
const remoteScreen = (shoot, route = ROUTE) => { brandApi.remote.mockResolvedValue(ok({ shoot })); return render(<BrandRemoteScreen navigation={nav()} route={route} />); };
const contentScreen = (content, route = ROUTE) => { brandApi.content.mockResolvedValue(ok({ content })); return render(<BrandContentScreen navigation={nav()} route={route} />); };
const saleScreen = (content, route = ROUTE) => { brandApi.content.mockResolvedValue(ok({ content })); return render(<BrandSaleLiveScreen navigation={nav()} route={route} />); };
const threadScreen = (thread, route = ROUTE) => { brandApi.brandThread.mockResolvedValue(ok({ thread })); return render(<BrandThreadScreen navigation={nav()} route={route} />); };
function agreementScreen(agreement, { preview = false, toast } = {}) {
  brandApi.agreementPreview.mockResolvedValue(ok({ agreement }));
  brandApi.getAgreement.mockResolvedValue(ok({ agreement }));
  brandApi.agreementCost.mockResolvedValue(ok({ cost: COST }));
  brandApi.getShoot.mockResolvedValue(ok({ shoot: SHOOT_FOR_AG }));
  return render(<BrandAgreementScreen navigation={nav()} route={{ params: { ...ROUTE.params, preview, toast } }} />);
}

const PAGE_18 = { padding: 18 };

describe.each([
  ['the store visit · she says she visited', () => shootScreen(ATTENDED()), 'she-visited', 'brand-shoot-actions', ['confirm-shoot', 'she-didnt-come'], PAGE_18],
  ['the store visit · the time is agreed', () => shootScreen(VISIT()), 'agreed-box', 'brand-shoot-actions', ['move-visit'], PAGE_18],
  ['the Remote shoot · waiting for her address', () => remoteScreen(REMOTE()), 'waiting-address', 'brand-remote-actions', ['pick-disabled'], PAGE_18],
  ['the Remote shoot · booked', () => remoteScreen(REMOTE({ stage: 'booked', address: ADDRESS, parcel: PARCEL, lines: [LINE], can: { label: true, cancel: true } })), 'booked-box', 'brand-remote-actions', ['download-label', 'cancel-booking'], PAGE_18],
  ['the content step · reviewing', () => contentScreen(CONTENT_SENT()), 'your-move', 'brand-content-actions', ['approve', 'ask-changes'], PAGE_18],
  ['going live · reviewing', () => saleScreen(SALE_SENT()), 'review', 'brand-sale-actions', ['approve', 'ask-changes', 'something-wrong'], PAGE_18],
  ['the counter conversation · your move', () => threadScreen(THREAD()), 'brand-accept-hint', 'brand-thread-actions', ['brand-accept', 'brand-counter-back', 'brand-decline'], PAGE_18],
  ['the counter conversation · she asked for another date', () => threadScreen(THREAD({
    negotiation: { id: null, open: false, whoseMove: null, roundLimit: 2, countersUsed: 0 }, turns: [],
    moveRequest: { goLiveDate: `${NEXT}-01-31`, shootMode: null, note: null, requestedAt: `${yr}-01-13T10:00:00Z`, answer: null, answeredAt: null },
    can: { counter: false, accept: false, decline: false, moveRequest: false, moveAnswer: true },
  })), 'move-line', 'move-actions', ['move-agree', 'move-keep', 'move-decline'], PAGE_18],
  ['the agreement · the preview', () => agreementScreen(AG_PREVIEW(), { preview: true }), 'not-editable', 'preview-actions', ['send-for-signature'], { padding: 16, paddingBottom: 40 }],
  ['the agreement · she signed, the brand signs', () => agreementScreen(AG()), 'what-it-costs', 'sign-actions', ['brand-sign'], { padding: 16, paddingBottom: 40 }],
  ['the agreement · sent, waiting for her', () => agreementScreen(AG_SENT()), 'waiting-for-her', 'withdraw-actions', ['brand-withdraw'], { padding: 16, paddingBottom: 40 }],
  ['the agreement · both signed', () => agreementScreen(AG_SIGNED()), 'step-line', 'signed-actions', ['shoot-plan', 'download'], { padding: 16, paddingBottom: 40 }],
])('%s', (name, make, ready, stripId, buttons, padding) => {
  it('title row, then the page, then the strip — the strip is in the column, never floating, and holds every button it had, in order', async () => {
    const r = make();
    await waitFor(() => r.getByTestId(ready));
    const { strip, page } = column(r, { stripId, padding });
    expect(idsUnder(strip)).toEqual(buttons);
    // A page with no text box keeps its plain scroller.
    expect(page.props.onFocus).toBeUndefined();
  });
});

describe.each([
  ['the store visit · agreed, and nothing the brand may do', () => shootScreen(VISIT({ can: { move: false } })), 'agreed-box', 'brand-shoot-actions'],
  ['the Remote shoot · on its way', () => remoteScreen(REMOTE({ stage: 'in_transit', address: ADDRESS, parcel: { ...PARCEL, collectedAt: 'x' }, lines: [LINE], can: {} })), 'line-list', 'brand-remote-actions'],
  ['the content step · waiting for her', () => contentScreen(CONTENT()), 'working-on-it', 'brand-content-actions'],
  ['going live · waiting for her', () => saleScreen(SALE()), 'path2-waiting', 'brand-sale-actions'],
  ['the counter conversation · waiting for her', () => threadScreen(THREAD({ negotiation: { ...THREAD().negotiation, whoseMove: 'influencer' } })), 'brand-thread-state', 'brand-thread-actions'],
  ['the agreement · withdrawn', () => agreementScreen(AG_WITHDRAWN()), 'agreement-ending', 'withdraw-actions'],
])('%s — nothing to press', (name, make, ready, stripId) => {
  it('no strip is drawn at all, and the page still ends with its ordinary padding', async () => {
    const r = make();
    await waitFor(() => r.getByTestId(ready));
    column(r, { stripId: null, padding: name.startsWith('the agreement') ? { padding: 16, paddingBottom: 40 } : PAGE_18 });
    expect(r.queryByTestId(stripId)).toBeNull();
  });
});

describe('what the strips carry besides buttons', () => {
  it('Remote, waiting for her address: the grey "Opens when her address arrives." line stays under the greyed button', async () => {
    const r = remoteScreen(REMOTE());
    await waitFor(() => r.getByTestId('waiting-address'));
    const strip = within(r.getByTestId('brand-remote-actions'));
    strip.getByText(C11.brand.pickDisabled);
    expect(r.getByTestId('pick-disabled').props.accessibilityState).toEqual({ disabled: true });
    // …and it is there once: in the strip, not in the page.
    expect(r.getAllByText(C11.brand.pickDisabled)).toHaveLength(1);
  });

  it('the store visit, time passed: "Send a new time" and the call link, in that order', async () => {
    const r = shootScreen(VISIT({ passed: true, creatorPhone: '+919900011122' }));
    await waitFor(() => r.getByTestId('passed-box'));
    const { strip } = column(r, { stripId: 'brand-shoot-actions', padding: PAGE_18 });
    expect(idsUnder(strip)).toEqual(['send-new-time', 'call-creator']);
  });

  it('an outline button stacked in a strip keeps to the strip\'s 8 — it does not add its own 10 on top', async () => {
    const r = contentScreen(CONTENT_SENT());
    await waitFor(() => r.getByTestId('ask-changes'));
    expect(flat(r.getByTestId('ask-changes')).marginTop).toBe(0);
    expect(flat(r.getByTestId('brand-content-actions')).gap).toBe(8);
  });
});

/* ───────────────────────────────────── the screens someone types on (C1–C3) */

async function planScreen() {
  brandApi.getShoot.mockResolvedValue(ok({ shoot: VISIT({ stage: 'not_sent', plan: null, can: { send: true } }) }));
  const r = render(<BrandShootPlanScreen navigation={nav()} route={ROUTE} />);
  await waitFor(() => r.getByTestId('brand-shoot-plan'));
  return r;
}
async function bookScreen() {
  brandApi.remote.mockResolvedValue(ok({ shoot: REMOTE({ stage: 'sent', address: ADDRESS, lines: [LINE], can: { book: true } }) }));
  brandApi.listBranches.mockResolvedValue(BRANCHES);
  const r = render(<BrandRemoteBookScreen navigation={nav()} route={ROUTE} />);
  await waitFor(() => r.getByTestId('brand-remote-book'));
  return r;
}
async function productsScreen() {
  brandApi.remote.mockResolvedValue(ok({ shoot: REMOTE({ stage: 'sent', address: ADDRESS, can: { pickProducts: true } }) }));
  brandApi.remoteProducts.mockResolvedValue(CATALOGUE);
  const r = render(<BrandRemoteProductsScreen navigation={nav()} route={ROUTE} />);
  await waitFor(() => r.getByTestId('brand-remote-products'));
  return r;
}

describe('C1 · C2 · C8 — Plan the visit', () => {
  it('C8 — keypad closed: the form, then "Send to Tanvi" in its own strip under it; every box, counter and hint is still there', async () => {
    const r = await planScreen();
    const { strip, page } = column(r, { stripId: 'plan-actions', padding: PAGE_18 });
    expect(idsUnder(strip)).toEqual(['send-to']);
    within(r.getByTestId('send-to')).getByText('Send to Tanvi');
    within(r.getByTestId('send-to')).getByText('send-outline');            // its icon
    expectForm(page);
    // U10: nothing on the form went away.
    const form = within(r.getByTestId('plan-form'));
    for (const id of ['locked-card', 'contact-name', 'contact-name-counter', 'contact-phone', 'contact-phone-counter', 'plan-picker', 'dates-hint', 'duration', 'duration-counter', 'notes', 'notes-counter']) form.getByTestId(id);
    form.getByText('She sees this once you send the plan.');
    // The button is not in the form.
    expect(form.queryByTestId('send-to')).toBeNull();
  });

  it('C1 — typing in a box low on the form: the counter, hint and error under it are brought into view above the strip', async () => {
    const r = await planScreen();
    expectReveal(r, 'notes');
  });

  it('the refusal lines the form shows on Send are still raised from the strip\'s button', async () => {
    const r = await planScreen();
    fireEvent.press(r.getByTestId('send-to'));
    within(r.getByTestId('plan-form')).getByText('Choose a date and time.');
    expect(r.queryByTestId('send-plan-sheet')).toBeNull();
  });
});

describe('Remote — Book the parcel', () => {
  it('the form, then the strip with "See the price"; the weight box and its hint are still there', async () => {
    const r = await bookScreen();
    const { strip, page } = column(r, { stripId: 'book-actions', padding: PAGE_18 });
    expect(idsUnder(strip)).toEqual(['see-price']);
    expectForm(page);
    const form = within(r.getByTestId('book-form'));
    form.getByTestId('branches'); form.getByTestId('branch-b1'); form.getByTestId('weight');
    form.getByText(C11.brand.weightHint);
  });

  it('a refusal is the first line of the strip, above the button — and the short-balance pair keeps its order', async () => {
    const r = await bookScreen();
    fireEvent.press(r.getByTestId('see-price'));
    await waitFor(() => r.getByTestId('book-error'));
    expect(idsUnder(column(r, { stripId: 'book-actions', padding: PAGE_18 }).strip)).toEqual(['book-error', 'see-price']);

    brandApi.remoteQuote.mockResolvedValue(ok({ outbound: 120, gst: 18, gstIncluded: true, returnHold: 80, holdBasis: 'quoted', returnCount: 1,
      canPickup: true, total: 200, available: 10, shortfall: 190, enough: false, lockedFee: 0, line: 'Add ₹190 to book this parcel.' }));
    fireEvent.changeText(r.getByTestId('weight'), '1.2');
    fireEvent(r.getByTestId('weight'), 'blur');
    await waitFor(() => r.getByTestId('shortfall'));
    const { strip } = column(r, { stripId: 'book-actions', padding: PAGE_18 });
    expect(idsUnder(strip)).toEqual(['add-money', 'back-to-products']);
    // The outline button under "Add money" sits the strip's 8 below it.
    expect(flat(r.getByTestId('back-to-products')).marginTop).toBe(0);
  });

  it('typing the packed weight: the hint under the box is brought into view above the strip', async () => {
    const r = await bookScreen();
    expectReveal(r, 'weight');
  });
});

describe('Remote — Pick products', () => {
  it('the list, then the strip with "Continue"; her address, the scope line, the count and the search box are still there', async () => {
    const r = await productsScreen();
    const { strip, page } = column(r, { stripId: 'products-actions', padding: PAGE_18 });
    expect(idsUnder(strip)).toEqual(['products-continue']);
    expect(r.getByTestId('products-continue').props.accessibilityState).toEqual({ disabled: true });
    expectForm(page);
    const form = within(r.getByTestId('products-form'));
    for (const id of ['address-card', 'scope-line', 'line-count', 'product-search', 'product-p1-toggle']) form.getByTestId(id);
    form.getByText(C11.brand.pickHint);
  });

  it('a refusal is the first line of the strip, 8 above the button as it always was', async () => {
    const r = await productsScreen();
    fireEvent.press(r.getByTestId('product-p1-toggle'));
    brandApi.remoteSaveLines.mockResolvedValue({ success: false, error: { message: 'That product just sold out.' } });
    await act(async () => { fireEvent.press(r.getByTestId('products-continue')); });
    await waitFor(() => r.getByTestId('products-error'));
    const { strip } = column(r, { stripId: 'products-actions', padding: PAGE_18 });
    expect(idsUnder(strip)).toEqual(['products-error', 'products-continue']);
    // The strip's own 8 is the only gap: the line no longer adds a second 8 under itself.
    expect(flat(r.getByTestId('products-error')).marginBottom).toBeUndefined();
  });

  it('typing in the search box keeps it in view', async () => {
    const r = await productsScreen();
    expectReveal(r, 'product-search');
  });
});

describe('Choose products — the full-screen pop-up', () => {
  async function chooser() {
    brandApi.getListingTree.mockResolvedValue(ok({ tree: [] }));
    brandApi.productsWithoutOffersForSet.mockResolvedValue(ok({ products: [{ id: 'f1', name: 'Oxford Shirt', price: 1299, leaf_name: 'Shirts' }] }));
    const onUse = jest.fn();
    const r = render(<ChooseProductsModal visible campaignId="c1" setId="sA" value={{ ids: [], products: [] }} onUse={onUse} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('choose-products'));
    await waitFor(() => expect(brandApi.getListingTree).toHaveBeenCalled());
    return { r, onUse };
  }

  it('title, the two tabs, the list, then "Use 0 products" in its own strip — not floating over the list', async () => {
    const { r } = await chooser();
    const { strip, page } = column(r, { screenId: 'choose-products', stripId: 'choose-actions', padding: { padding: 16 } });
    expect(idsUnder(strip)).toEqual(['choose-use']);
    expectForm(page);
    r.getByTestId('choose-tab-0'); r.getByTestId('choose-tab-1');
    expect(pathTo(page, byId('choose-use'))).toBeNull();
  });

  it('searching and ticking still work, and "Use 1 product" hands back what was ticked', async () => {
    const { r, onUse } = await chooser();
    fireEvent.press(r.getByTestId('choose-tab-1'));
    fireEvent.changeText(r.getByTestId('choose-search'), 'oxford');
    await waitFor(() => r.getByTestId('choose-product-f1'));
    fireEvent.press(r.getByTestId('choose-product-f1'));
    fireEvent.press(r.getByTestId('choose-use'));
    expect(onUse).toHaveBeenCalledWith(['f1'], [expect.objectContaining({ id: 'f1' })]);
  });

  it('typing in its search box keeps the box in view', async () => {
    const { r } = await chooser();
    fireEvent.press(r.getByTestId('choose-tab-1'));
    expectReveal(r, 'choose-search');
  });
});

/* ───────────────────────────────────────────────────────────── the toast */

describe('the toast sits just above the strip, inside the box that holds the page', () => {
  it.each([
    ['the store visit', () => shootScreen(ATTENDED(), withToast('Plan sent.')), 'brand-shoot-actions'],
    ['the Remote shoot', () => remoteScreen(REMOTE(), withToast('Parcel booked.')), 'brand-remote-actions'],
    ['the content step', () => contentScreen(CONTENT_SENT(), withToast('Sent.')), 'brand-content-actions'],
    ['going live', () => saleScreen(SALE_SENT(), withToast('Sent.')), 'brand-sale-actions'],
    ['the counter conversation', () => threadScreen(THREAD(), withToast('Counter sent.')), 'brand-thread-actions'],
    ['the agreement', () => agreementScreen(AG_SENT(), { toast: 'Agreement sent.' }), 'withdraw-actions'],
  ])('%s', async (name, make, stripId) => {
    const r = make();
    await waitFor(() => r.getByTestId(stripId));
    await waitFor(() => r.getByTestId('toast'));
    expectToastAboveStrip(r, { stripId });
  });

  it('the agreement still shows it while the agreement is being read (no strip yet)', async () => {
    brandApi.getAgreement.mockReturnValue(new Promise(() => {}));
    const r = render(<BrandAgreementScreen navigation={nav()} route={withToast('Agreement sent.')} />);
    await waitFor(() => r.getByTestId('toast'));
    r.getByTestId('skeleton');
    within(r.getByTestId('toast')).getByText('Agreement sent.');
  });
});

/* ─────────────────────────────── the agreement: one kind of strip, and its title bar */

describe('the agreement — one kind of strip, and a title bar that starts where every other one does', () => {
  it('Send, Sign, Withdraw and the after-both-signed pair all sit in the same strip', async () => {
    const styles = [];
    for (const [agreement, opts, id] of [
      [AG_PREVIEW(), { preview: true }, 'preview-actions'],
      [AG(), {}, 'sign-actions'],
      [AG_SENT(), {}, 'withdraw-actions'],
      [AG_SIGNED(), {}, 'signed-actions'],
    ]) {
      const r = agreementScreen(agreement, opts);
      await waitFor(() => r.getByTestId(id));
      styles.push(flat(r.getByTestId(id)));
      r.unmount();
    }
    for (const s of styles) expect(s).toEqual(STRIP);
  });

  it('the title bar: the phone\'s top inset plus the same 4 the shared header keeps — and otherwise the bar it was', async () => {
    const zero = agreementScreen(AG_SENT());
    await waitFor(() => zero.getByTestId('withdraw-actions'));
    expect(flat(zero.getByTestId('agreement-bar'))).toMatchObject({ paddingTop: 4, paddingBottom: 10, paddingHorizontal: 8, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' });
    // The gap of 4 is the one kept above a 40-high back control — so the title sits on the same
    // line as under the shared header (4 + 40 + 10).
    expect(flat(zero.getByTestId('back'))).toMatchObject({ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' });
    zero.getByText('Agreement · Tanvi');
    zero.unmount();

    mockInsets = { top: 31, bottom: 0, left: 0, right: 0 };                  // a phone that draws edge to edge
    const r = agreementScreen(AG_SENT());
    await waitFor(() => r.getByTestId('withdraw-actions'));
    expect(flat(r.getByTestId('agreement-bar')).paddingTop).toBe(35);
    // The same as a pushed screen that uses the shared header.
    const other = shootScreen(ATTENDED());
    await waitFor(() => other.getByTestId('she-visited'));
    expect(flat(other.toJSON().children[0]).paddingTop).toBe(35);
  });

  it('the loading and couldn\'t-load states carry the same bar', async () => {
    mockInsets = { top: 31, bottom: 0, left: 0, right: 0 };
    brandApi.getAgreement.mockResolvedValue({ success: false });
    const r = render(<BrandAgreementScreen navigation={nav()} route={ROUTE} />);
    await waitFor(() => r.getByTestId('load-error'));
    expect(flat(r.getByTestId('agreement-bar')).paddingTop).toBe(35);
    r.getByTestId('back');
  });
});

/* ───────────────────────── the counter the server refuses: said inside the pop-up */

describe('the counter conversation — a refused counter is said inside the counter pop-up', () => {
  const REFUSAL = 'Priya has already answered. Close this to see where it stands.';
  const sheetProps = (r) => r.UNSAFE_getByType(BrandCounterSheet6).props;

  it('the refusal goes to the pop-up (`serverError`), the pop-up stays open, and no toast is raised behind it', async () => {
    brandApi.brandCounter.mockResolvedValue({ success: false, error: { code: 'WRONG_TURN', message: REFUSAL } });
    const r = threadScreen(THREAD());
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    expect(sheetProps(r).serverError).toBeNull();
    fireEvent.press(r.getByTestId('brand-counter-back'));
    await waitFor(() => r.getByTestId('brand-counter-sheet'));
    expect(sheetProps(r).serverError).toBeNull();

    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    await waitFor(() => expect(sheetProps(r).serverError).toBe(REFUSAL));
    expect(brandApi.brandCounter).toHaveBeenCalledTimes(1);
    expect(sheetProps(r).visible).toBe(true);
    expect(r.queryByTestId('toast')).toBeNull();
    // The pop-up prints it, in the server's own words — once, and (no toast) nowhere else.
    expect(r.getAllByText(REFUSAL)).toHaveLength(1);
    // Nothing is read again behind the open pop-up: a re-read that failed would take the page,
    // and the pop-up with it.
    await act(async () => {});
    expect(brandApi.brandThread).toHaveBeenCalledTimes(1);

    // Closing forgets it and reads the conversation again — the refusal means the page is stale.
    await act(async () => { sheetProps(r).onClose(); });
    expect(sheetProps(r).visible).toBe(false);
    expect(sheetProps(r).serverError).toBeNull();
    expect(brandApi.brandThread).toHaveBeenCalledTimes(2);
    expect(brandApi.brandThread).toHaveBeenLastCalledWith('c1', 'sA', 'ci1');
    // The next opening starts clean; opening it, and closing one that showed no refusal, reads nothing.
    fireEvent.press(r.getByTestId('brand-counter-back'));
    expect(sheetProps(r).visible).toBe(true);
    expect(sheetProps(r).serverError).toBeNull();
    await act(async () => { sheetProps(r).onClose(); });
    expect(sheetProps(r).visible).toBe(false);
    expect(brandApi.brandThread).toHaveBeenCalledTimes(2);
  });

  const NO_SIGNAL = { success: false, error: { code: 'NETWORK_ERROR', message: 'Could not reach the server' } };

  it('no signal — the counter is refused and a re-read would fail too: the pop-up stays, with what was typed and the refusal in it', async () => {
    const r = threadScreen(THREAD());
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    brandApi.brandCounter.mockResolvedValue(NO_SIGNAL);
    brandApi.brandThread.mockResolvedValue(NO_SIGNAL);

    fireEvent.press(r.getByTestId('brand-counter-back'));
    fireEvent.changeText(r.getByTestId('brand-commission'), '11.5');
    fireEvent.changeText(r.getByTestId('brand-counter-note'), 'We can do 11.5% this time.');
    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    await waitFor(() => expect(sheetProps(r).serverError).toBe(NO_SIGNAL.error.message));
    await act(async () => {});

    // The page is still the page — never "Couldn't load" — and the pop-up is still on it.
    expect(brandApi.brandThread).toHaveBeenCalledTimes(1);
    expect(r.queryByTestId('load-error')).toBeNull();
    r.getByTestId('brand-thread-yourmove');
    r.getByTestId('brand-thread-actions');
    expect(sheetProps(r).visible).toBe(true);
    within(r.getByTestId('brand-counter-error')).getByText(NO_SIGNAL.error.message);
    expect(r.queryByTestId('toast')).toBeNull();
    // What was typed is still in the boxes…
    expect(r.getByTestId('brand-commission').props.value).toBe('11.5');
    expect(r.getByTestId('brand-counter-note').props.value).toBe('We can do 11.5% this time.');
    // …so Send can simply be pressed again, and it sends the same counter.
    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    expect(brandApi.brandCounter).toHaveBeenCalledTimes(2);
    expect(brandApi.brandCounter).toHaveBeenLastCalledWith('c1', 'sA', 'ci1',
      { terms: { commissionPct: 11.5, fee: null, deliverables: [], usageRights: null }, note: 'We can do 11.5% this time.' });
    await waitFor(() => expect(sheetProps(r).serverError).toBe(NO_SIGNAL.error.message));
    expect(r.getByTestId('brand-commission').props.value).toBe('11.5');
    expect(brandApi.brandThread).toHaveBeenCalledTimes(1);

    // Closing it reads the conversation again. That fails: "Couldn't load", with nothing left open.
    await act(async () => { sheetProps(r).onClose(); });
    await waitFor(() => r.getByTestId('load-error'));
    expect(brandApi.brandThread).toHaveBeenCalledTimes(2);

    // "Try again" brings the page back — and no pop-up, and no old refusal, with it.
    brandApi.brandThread.mockResolvedValue(ok({ thread: THREAD() }));
    await act(async () => { fireEvent.press(r.getByTestId('try-again')); });
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    expect(sheetProps(r).visible).toBe(false);
    expect(sheetProps(r).serverError).toBeNull();
    expect(r.queryByTestId('brand-counter-sheet')).toBeNull();
    expect(r.queryByText(NO_SIGNAL.error.message)).toBeNull();
  });

  it('if the page does fall to "Couldn\'t load" under an open counter pop-up, the pop-up does not come back by itself after "Try again"', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: THREAD() }));
    brandApi.brandCounter.mockResolvedValue({ success: false, error: { message: REFUSAL } });
    const n = nav();
    const r = render(<BrandThreadScreen navigation={n} route={ROUTE} />);
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    fireEvent.press(r.getByTestId('brand-counter-back'));
    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    await waitFor(() => expect(sheetProps(r).serverError).toBe(REFUSAL));

    // The one read this screen does not start itself: the screen is asked for again (here, for
    // another creator), and that read finds no signal.
    brandApi.brandThread.mockResolvedValue(NO_SIGNAL);
    await act(async () => { r.rerender(<BrandThreadScreen navigation={n} route={{ params: { ...ROUTE.params, ciId: 'ci2' } }} />); });
    await waitFor(() => r.getByTestId('load-error'));

    brandApi.brandThread.mockResolvedValue(ok({ thread: THREAD() }));
    await act(async () => { fireEvent.press(r.getByTestId('try-again')); });
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    expect(sheetProps(r).visible).toBe(false);
    expect(sheetProps(r).serverError).toBeNull();
    expect(r.queryByTestId('brand-counter-sheet')).toBeNull();
    expect(r.queryByText(REFUSAL)).toBeNull();
  });

  it('the same for the decline pop-up: refused with no signal, the page cannot be read — after "Try again" it is not open', async () => {
    const r = threadScreen(THREAD());
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    brandApi.brandDeclineCounter.mockResolvedValue(NO_SIGNAL);
    brandApi.brandThread.mockResolvedValue(NO_SIGNAL);
    fireEvent.press(r.getByTestId('brand-decline'));
    r.getByTestId('decline-counter-sheet');
    await act(async () => { fireEvent.press(r.getByTestId('decline-counter-confirm')); });
    await waitFor(() => r.getByTestId('load-error'));

    brandApi.brandThread.mockResolvedValue(ok({ thread: THREAD() }));
    await act(async () => { fireEvent.press(r.getByTestId('try-again')); });
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    expect(r.UNSAFE_getByType(DeclineCounterSheet6).props.visible).toBe(false);
    expect(r.queryByTestId('decline-counter-sheet')).toBeNull();
  });

  it('refused after the pop-up was closed (a slow send): nothing covers the page, so it is a toast, and the page is read again', async () => {
    let answer;
    brandApi.brandCounter.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const r = threadScreen(THREAD());
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    fireEvent.press(r.getByTestId('brand-counter-back'));
    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    expect(brandApi.brandCounter).toHaveBeenCalledTimes(1);

    // She does not wait for it.
    await act(async () => { sheetProps(r).onClose(); });
    expect(sheetProps(r).visible).toBe(false);
    expect(brandApi.brandThread).toHaveBeenCalledTimes(1);

    await act(async () => { answer({ success: false, error: { message: REFUSAL } }); });
    await waitFor(() => r.getByTestId('toast'));
    within(r.getByTestId('toast')).getByText(REFUSAL);
    expect(sheetProps(r).visible).toBe(false);
    expect(sheetProps(r).serverError).toBeNull();
    expect(brandApi.brandThread).toHaveBeenCalledTimes(2);
    // The next opening does not carry it.
    fireEvent.press(r.getByTestId('brand-counter-back'));
    expect(sheetProps(r).visible).toBe(true);
    expect(sheetProps(r).serverError).toBeNull();
    expect(r.queryByTestId('brand-counter-error')).toBeNull();
  });

  it('a refusal with no sentence of its own still says something', async () => {
    brandApi.brandCounter.mockResolvedValue({ success: false });
    const r = threadScreen(THREAD());
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    fireEvent.press(r.getByTestId('brand-counter-back'));
    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    await waitFor(() => expect(typeof sheetProps(r).serverError).toBe('string'));
    expect(sheetProps(r).serverError.length).toBeGreaterThan(0);
    expect(r.queryByTestId('toast')).toBeNull();
  });

  it('a second try clears the old refusal while it is being sent, and a counter that goes through closes the pop-up and says so', async () => {
    brandApi.brandCounter.mockResolvedValueOnce({ success: false, error: { message: REFUSAL } });
    const r = threadScreen(THREAD());
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    fireEvent.press(r.getByTestId('brand-counter-back'));
    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    await waitFor(() => expect(sheetProps(r).serverError).toBe(REFUSAL));

    brandApi.brandCounter.mockResolvedValueOnce(ok({ thread: THREAD({ negotiation: { ...THREAD().negotiation, whoseMove: 'influencer', countersUsed: 2 }, can: {} }) }));
    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    await waitFor(() => expect(sheetProps(r).visible).toBe(false));
    expect(sheetProps(r).serverError).toBeNull();
    await waitFor(() => r.getByTestId('toast'));
    within(r.getByTestId('toast')).getByText(C6.counter.sent);
  });
});

/* ───────────────────────────────────────────────────────── the source itself */

describe('the source of the converted files', () => {
  const SRC = path.join(__dirname, '..', '..');
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
  const PAGES = [
    'screens/brand/BrandAgreementScreen.js', 'screens/brand/BrandThreadScreen.js', 'screens/brand/BrandShootScreen.js',
    'screens/brand/BrandRemoteScreen.js', 'screens/brand/BrandContentScreen.js', 'screens/brand/BrandSaleLiveScreen.js',
  ];
  const FORMS = ['screens/brand/BrandShootPlanScreen.js', 'screens/brand/BrandRemoteBookScreen.js', 'screens/brand/BrandRemoteProductsScreen.js'];

  it.each([...PAGES, ...FORMS, 'components/invitations/sellSheets.js'])('%s — no floating bar, no clearance for one, the strip is BottomBar', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/position:\s*'absolute'/);
    expect(src).not.toMatch(/paddingBottom:\s*1\d\d\b/);
    expect(src).not.toMatch(/<View style=\{\{ height: 1\d\d \}\} \/>/);
    expect(src).toMatch(/import \{ BottomBar \} from '[./a-z]+\/shell\/BottomBar';/);
    expect(src).toMatch(/<BottomBar[\s>]/);
    // Nothing measures a bar to make room for it any more.
    expect(src).not.toMatch(/onLayout=/);
  });

  it.each([...PAGES, ...FORMS.slice(1)])('%s — the toast is asked for in-flow and drawn inside the box above the strip', (rel) => {
    const src = read(rel);
    expect(src).toContain('useToast({ inFlow: true })');
    expect(src).not.toMatch(/useToast\(\)/);
    const closeArea = src.lastIndexOf('</FormArea>');
    const toast = src.lastIndexOf('{toast}', closeArea);
    const closePage = Math.max(src.lastIndexOf('</ScrollView>', closeArea), src.lastIndexOf('</FormScroll>', closeArea));
    expect(closePage).toBeGreaterThan(-1);
    expect(toast).toBeGreaterThan(closePage);
    expect(closeArea).toBeGreaterThan(toast);
    // …and nowhere after the strip (a toast at the screen's root would land on top of it).
    expect(src.indexOf('{toast}', closeArea)).toBe(-1);
  });

  it.each(FORMS)('%s — a page with a text box is a FormScroll, not a plain ScrollView', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/import \{ FormScroll, FormArea \} from '\.\.\/\.\.\/components\/shell\/FormScroll';/);
    expect(src).not.toMatch(/<ScrollView[\s>]/);
  });
});
