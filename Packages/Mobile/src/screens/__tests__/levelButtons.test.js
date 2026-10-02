/**
 * ui-walk-fixes — board E, frames E1–E12 (points 5 and 7 of the founder's walk; checks 15, 17, 18).
 * Contract: features/ui-walk-fixes · research C05, C07
 *
 * The creator's Counter sat 10 lower than Decline and came out 2 taller; the brand's "Not yet" did
 * the same beside "Send"; Decline and Withdraw were solid red blocks louder than the yellow button.
 * Every such bar is now the shared AnswerBar / ButtonRow. These tests hold the SCREENS to it:
 *
 *   · the two second-row halves carry no top margin and identical vertical padding and border
 *     (the same padding-plus-outline when one of them is a filled button), at least 44 tall;
 *   · Counter is ABSENT — not disabled — when it is not allowed, and the red outline then fills
 *     the width alone; on the invitation, while she may still ask for another date, its place is
 *     taken by "Ask for another date" (spec U23) — every invitation fixture here is a shape
 *     invitationRows.service.js creatorState can really send;
 *   · after both have signed, the state button is full width with Download under it, in the bar;
 *   · Send reads "Sending" while busy and the Withdraw spinner can be seen.
 *
 * jest cannot see a layout, so "level" is asserted through the style each half receives. The phone
 * walk (check 16) is still the proof of the picture.
 */
import React from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { render, fireEvent, waitFor, within, act } from '@testing-library/react-native';

jest.mock('../../services/api', () => ({
  influencerApi: {
    myInvitation: jest.fn(), acceptInvitation: jest.fn(), declineInvitation: jest.fn(),
    myThread: jest.fn(), acceptCounter: jest.fn(), declineCounter: jest.fn(),
    myPitchThread: jest.fn(), myPitch: jest.fn(), acceptMyPitch: jest.fn(), declineMyPitch: jest.fn(),
    getCollection: jest.fn(), updateCollection: jest.fn(), deleteCollection: jest.fn(),
  },
  brandApi: {
    brandThread: jest.fn(), brandAcceptCounter: jest.fn(), brandCounter: jest.fn(), brandDeclineCounter: jest.fn(), answerMoveRequest: jest.fn(),
    pitch: jest.fn(), pitchThread: jest.fn(), acceptPitch: jest.fn(), rejectPitch: jest.fn(),
    getAgreement: jest.fn(), agreementPreview: jest.fn(), agreementCost: jest.fn(), getShoot: jest.fn(),
    sendAgreement: jest.fn(), signAgreement: jest.fn(), withdrawAgreement: jest.fn(), agreementDocument: jest.fn(),
    getWallet: jest.fn(), getMe: jest.fn(),
  },
  referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi, brandApi } = require('../../services/api');
const InvitationScreen = require('../influencer/InvitationScreen').default;
const ThreadScreen = require('../influencer/ThreadScreen').default;
const BrandThreadScreen = require('../brand/BrandThreadScreen').default;
const PitchThreadScreen = require('../shared/PitchThreadScreen').default;
const BrandPitchScreen = require('../brand/BrandPitchScreen').default;
const BrandAgreementScreen = require('../brand/BrandAgreementScreen').default;
const BrandWalletScreen = require('../brand/BrandWalletScreen').default;
const CollectionScreen = require('../create/CollectionScreen').default;
const { SendAgreementSheet7, WithdrawAgreementSheet7 } = require('../../components/agreement/sheets7');
const { AcceptPitchSheet8, RejectPitchSheet8, WithdrawPitchSheet8 } = require('../../components/pitch/sheets8');
const { settingsTokens: T } = require('../../theme/tokens');
const { C5 } = require('../../components/invitations/copy5');
const { C6, snapshotLine6 } = require('../../components/negotiation/copy6');
const { C7 } = require('../../components/agreement/copy7');
const { C8 } = require('../../components/pitch/copy8');
const { C10 } = require('../../components/shoot/copy10');

// React reports a clash of keys — and most other mistakes in how a tree is put together — through
// console.error and then carries on. Every test here must leave it silent.
// A press starts TouchableOpacity's fade, and a toast its own; with real timers they land between
// awaits and warn about act(), so the timers are jest's.
let errorSpy;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errorSpy.mock.calls.map(args => args.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
/** A touchable's own box, minus the opacity TouchableOpacity animates. */
const box = (node) => { const { opacity, ...rest } = flat(node); return rest; };
const edge = (s) => s.paddingVertical + (s.borderWidth || 0);

/** A node of the rendered (host) tree by testID, with the nodes above it. */
function locate(tree, id) {
  const walk = (n, trail) => {
    if (!n || typeof n === 'string') return null;
    if (Array.isArray(n)) { for (const c of n) { const r = walk(c, trail); if (r) return r; } return null; }
    if (n.props && n.props.testID === id) return { node: n, trail };
    for (const c of n.children || []) { const r = walk(c, [...trail, n]); if (r) return r; }
    return null;
  };
  return walk(tree, []);
}
/** The row a half sits in: the half's own cell is one up, the row is two up. */
const rowOf = (tree, id) => { const { trail } = locate(tree, id); return trail[trail.length - 2]; };
const idsIn = (row) => row.children.map(cell => cell.children[0].props.testID);

/**
 * The two halves of one row are level: the same row, no top margin, both at least 44 tall and
 * stretched to the row's height, and the same vertical padding and border. When one half is a
 * filled button (no outline) the padding makes up for the missing outline, so the two still add
 * up to the same edge.
 */
function expectLevel(r, leftId, rightId, { sameOutline = true } = {}) {
  const tree = r.toJSON();
  const row = rowOf(tree, leftId);
  expect(rowOf(tree, rightId)).toBe(row);
  expect(flat(row)).toMatchObject({ flexDirection: 'row', alignItems: 'stretch' });
  expect(idsIn(row)).toEqual([leftId, rightId]);
  const [a, b] = row.children.map(flat);
  expect(a.flex).toBe(1);
  expect(b.flex).toBe(1);
  expect(b.marginLeft).toBe(8);
  const L = box(r.getByTestId(leftId));
  const R = box(r.getByTestId(rightId));
  for (const half of [L, R]) {
    expect(half.marginTop).toBe(0);
    expect(half.minHeight).toBe(44);
    expect(half.flexGrow).toBe(1);
    expect(half.alignSelf).toBe('stretch');
  }
  expect(edge(L)).toBe(edge(R));
  if (sameOutline) {
    expect(L.paddingVertical).toBe(R.paddingVertical);
    expect(L.borderWidth).toBe(R.borderWidth);
  }
}
/** The other half was not allowed: this one fills the width alone, still without a top gap. */
function expectAlone(r, id) {
  const row = rowOf(r.toJSON(), id);
  expect(flat(row).flexDirection).toBe('row');
  expect(idsIn(row)).toEqual([id]);
  expect(box(r.getByTestId(id))).toMatchObject({ marginTop: 0, minHeight: 44 });
}
/** The boards' `.b-sec`: white, a clear 1.5 ink outline. */
const expectDarkOutline = (r, id) => expect(box(r.getByTestId(id))).toMatchObject({ borderWidth: 1.5, borderColor: T.ink, backgroundColor: T.bg });
/** The boards' `.b-dan`: white, red label, pale red outline — never the solid red block. */
function expectRedOutline(r, id, label) {
  expect(box(r.getByTestId(id))).toMatchObject({ borderWidth: 1.5, borderColor: T.dangerLine, backgroundColor: T.bg });
  expect(flat(within(r.getByTestId(id)).getByText(label)).color).toBe(T.danger);
}
/**
 * ui-walk-fixes board C, rule 1 — a button strip is IN the screen's column, directly under the box
 * that holds the page: never floating over the page, never measured, and the page ends with its
 * ordinary 18 whatever the strip's height. (These bars used to be `position: 'absolute'` and the
 * page kept the bar's measured height under its last line.)
 */
function expectStripUnderPage(r, stripId, scrollId) {
  const tree = r.toJSON();
  const strip = locate(tree, stripId);
  const page = locate(tree, scrollId);
  const style = flat(strip.node);
  expect(style.position).toBeUndefined();
  expect(style.bottom).toBeUndefined();
  expect(style).toMatchObject({ padding: 14, borderTopWidth: 1, backgroundColor: T.bg });
  expect(r.getByTestId(stripId).props.onLayout).toBeUndefined();
  // The screen's own column: … the box that holds the page, then the strip.
  const column = strip.trail[strip.trail.length - 1];
  const area = page.trail[page.trail.length - 1];
  expect(page.trail[page.trail.length - 2]).toBe(column);
  expect(flat(area)).toEqual({ flex: 1 });
  expect(column.children.indexOf(strip.node)).toBe(column.children.indexOf(area) + 1);
  expect(flat(page.node)).toEqual({ flex: 1 });
  expect(StyleSheet.flatten(page.node.props.contentContainerStyle)).toEqual({ padding: 18 });
}

/* ───────────────────────────────────────────────────────────── fixtures */

const FINAL = 'Nothing is final until you both sign the agreement.';
const INV = {
  id: 'ci1', status: 'invited', group: 'invited', brand: { name: 'Urban Threads', logoUrl: null },
  campaignName: 'Diwali Edit 2026', setName: 'Set A', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad',
  postingDate: `${yr}-10-24`, cutoff: `${yr}-10-17`, daysLeft: 4, commissionPct: 10, fee: null,
  canAnswer: true, canCounter: true, counterHiddenReason: null, canMoveRequest: true, switchOn: true,
  negotiation: null, moveRequest: null, pool: null, fromPool: null, agreement: null,
  set: { name: 'Set A', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad', postingDate: `${yr}-10-24`, cutoff: `${yr}-10-17` },
  terms: { goal: 'conversion', commissionPct: 10, fee: null, scope: { kind: 'store', words: 'whole store' }, offer: { kind: 'none' }, shoppablePostsMin: 1, deliverablesWords: null, usageRights: null, note: null, paySplit: null },
  note: 'Loved your Diwali reels last year.',
};

const THREAD = (over = {}) => ({
  invitationId: 'ci1', goal: 'conversion', status: 'negotiating',
  brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' },
  campaignName: 'Diwali Edit 2026', setName: 'Set A', postingDate: `${yr}-10-24`, cutoff: `${yr}-10-17`, cutoffPassed: false,
  shootMode: 'visit', cityName: 'Hyderabad', switchOn: true,
  negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 3, countersUsed: 2, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { commissionPct: 11.5 }, currentLine: '11.5%',
  turns: [
    { id: 't2', by: 'brand', mine: false, at: `${yr}-09-14T10:00:00Z`, kind: 'counter', terms: { commissionPct: 11.5 }, changes: [{ term: 'commissionPct', from: '13%', to: '11.5%' }], note: 'We can do 11.5% for the first collaboration.' },
    { id: 't1', by: 'influencer', mine: true, at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { commissionPct: 13 }, changes: [{ term: 'commissionPct', from: '10%', to: '13%' }] },
  ],
  invitation: { terms: { commissionPct: 10 }, termsLine: '10%', sentAt: `${yr}-09-12T10:00:00Z`, scopeWords: 'Anything in the store', offerName: 'Festive 15% off Sarees' },
  moveRequest: null, pool: null, ending: null, warnings: [], minimums: { fee: null, commissionPct: null },
  can: { counter: true, accept: true, decline: true, moveRequest: false, moveAnswer: false },
  ...over,
});
const CONTENT_NOW = { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }], usageRights: { on: true, durationDays: 60, places: ['social'] } };

const PITCH_THREAD = (over = {}) => ({
  pitchId: 'p1', goal: 'engagement',
  brand: { name: 'Stride Kicks' }, creator: { id: 'c1', name: 'Tanvi Suresh' },
  negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }] },
  turns: [{ id: 't0', by: 'influencer', mine: false, at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { fee: 12000 }, changes: [], note: null }],
  ending: null, can: { counter: true, accept: true, decline: true },
  ...over,
});
const PITCH = (over = {}) => ({
  id: 'p1',
  creator: { id: 'c1', name: 'Tanvi Suresh', handle: 'tanvi', niche: 'Lifestyle', city: 'Bengaluru' },
  numbers: { instagramFollowers: 48200, youtubeSubscribers: 12400, engagement: 5.1 },
  goal: 'engagement', aimLabel: 'Pay for Content', termsLine: '₹12,000 · 1 reel, 2 stories',
  terms: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] },
  proposedGoLiveDate: `${yr}-10-28`, shootMode: 'shipment', modeLabel: 'Remote',
  message: 'I have been running in your shoes for two years.',
  replyBy: 'Reply by 14 Oct · 28 days left', negotiation: null,
  can: { accept: true, counter: true, reject: true },
  rejectCooldownLine: "Tanvi won't be able to pitch you again until 15 Oct.",
  acceptBody: 'She\'ll be waiting under "Agreed, needs a set" on your Campaigns tab.',
  ...over,
});

const TERMS = (over = {}) => ({
  aim: 'engagement', campaignName: 'Diwali Edit 2026', setName: 'Set A',
  postingDate: `${yr}-10-24`, cutoff: `${yr}-10-17`,
  shootMode: 'visit', branchName: 'Banjara Hills', branchCity: 'Hyderabad',
  parties: {
    brand: { name: 'Urban Threads', city: 'Hyderabad', state: 'Telangana' },
    creator: { name: 'Tanvi Suresh', city: 'Hyderabad', state: 'Telangana', handle: 'tanvi.styles' },
  },
  money: { fee: 9000, commissionPct: null, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720,
    split: { t1: 2250, t2: 2250, t3: 4500 }, splitPct: [25, 25, 50], commissionAfterDays: null },
  work: { deliverables: [{ type: 'reel', count: 1 }], deliverablesWords: '1 Instagram reel', usageRights: null, minShoppablePosts: null },
  sell: null, returnTerms: { days: 7, brandPaysShipping: true }, note: null,
  termsVersion: '1.0', generatedAt: `${yr}-09-14T10:00:00Z`,
  ...over,
});
const SIGNED = (over = {}) => ({
  invitationId: 'ci1', contractId: 'k1', reference: 'INFLX-2026-00457', status: 'active',
  sentAt: `${yr}-09-14T10:00:00Z`, cutoff: `${yr}-10-17`, daysLeft: 4, cutoffPassed: false,
  terms: TERMS(), standardTerms: { version: '1.0' },
  signatures: {
    creator: { name: 'Tanvi Suresh', at: `${yr}-09-14T11:04:00Z`, device: 'Android', ip: '103.21.58.14' },
    brand: { name: 'Ravi Menon', at: `${yr}-09-14T18:18:00Z`, device: 'Android', ip: '49.207.14.92' },
  },
  ending: null,
  money: { fee: 9000, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720, locked: 9720, released: 2250, stillLocked: 7470, at: `${yr}-09-14T18:18:00Z` },
  can: { send: false, sign: false, withdraw: false, download: true },
  document: { available: true, generatedAt: `${yr}-09-14T18:18:00Z` },
  ...over,
});
const SHOOT = (stage, passed = false) => ({
  stage, passed,
  gate: { open: true, signed: { at: `${yr}-09-14T18:18:00Z` }, money: { required: true, locked: 9720, released: 2250 } },
  steps: [
    { key: 'signed', state: 'done', label: 'Agreement signed', detail: '14 Sep' },
    { key: 'shoot', state: 'now', label: 'Shoot plan', detail: 'Waiting for your confirmation' },
    { key: 'content', state: 'later', label: 'Content', detail: 'After the shoot' },
  ],
  postingDate: `${yr}-10-24`, daysToPosting: 6,
});
const AG_ROUTE = { params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } };

/* ───────────────────────────────────── E1 · E2 — the creator's invitation */

describe('E1 · E2 — the invitation: Accept, then Counter and Decline level', () => {
  it('E1 — "Nothing is final…" leads the bar, then Accept, then two level halves: Counter (dark outline, undo arrow) and Decline (red outline)', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: INV }));
    const r = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('answer-actions'));

    // The line is in the bar — where the bar can never hide it — and no longer in the page.
    const bar = within(r.getByTestId('answer-actions'));
    bar.getByText(FINAL);
    expect(within(r.getByTestId('invitation-scroll')).queryByText(FINAL)).toBeNull();
    expect(r.getAllByText(FINAL)).toHaveLength(1);

    // Top to bottom: the grey line, Accept, the pair.
    const answer = locate(r.toJSON(), 'answer-actions').node.children[0];
    expect(flat(answer).gap).toBe(8);
    expect(answer.children).toHaveLength(3);
    expect(answer.children[0].children).toEqual([FINAL]);
    expect(answer.children[1].props.testID).toBe('accept');
    expect(idsIn(answer.children[2])).toEqual(['counter', 'decline']);
    // Accept is the one full-width yellow button, not a half.
    expect(box(r.getByTestId('accept'))).toMatchObject({ backgroundColor: T.primary });
    expect(box(r.getByTestId('accept')).flexGrow).toBeUndefined();

    expectLevel(r, 'counter', 'decline');
    expectDarkOutline(r, 'counter');
    within(r.getByTestId('counter')).getByText('undo-variant');    // the icon stub prints its name
    const counterLabel = within(r.getByTestId('counter')).getByText(C5.creator.detail.counter);
    // The shared outline button is as it was for every caller that does not ask to shrink (U23).
    expect(counterLabel.props.adjustsFontSizeToFit).toBeUndefined();
    expect(counterLabel.props.minimumFontScale).toBeUndefined();
    expectRedOutline(r, 'decline', C5.creator.detail.decline);
    expect(r.queryByTestId('counter-off')).toBeNull();
  });

  // ASSERTION DRIFT — ui-walk-fixes spec U23 (06-diff/drift/E.md). Frame E2 (Accept, then Decline
  // alone) is what she sees only once she can no longer ask for another date either. The fixture
  // used to be a shape the server never sends: countering off, canMoveRequest false, and no move
  // request on the invitation — yet `canMoveRequest` is false only once she HAS asked. It now
  // carries the request she made (the brand kept the date), which is how that shape arises. What
  // the server sends for a FRESH invitation with countering off is the test after this one.
  const ASKED_ONCE = { goLiveDate: `${yr}-10-31`, shootMode: null, note: null, requestedAt: `${yr}-09-13T10:00:00Z`, answer: 'kept', answeredAt: `${yr}-09-14T10:00:00Z` };
  // Once an invitation is no longer hers to answer, creatorState sends all four of these together.
  const NOT_HERS = { canAnswer: false, canCounter: false, counterHiddenReason: 'closed', canMoveRequest: false };

  it('E2 — the brand is not taking counters and she has already asked for another date: no second button at all — not disabled, ABSENT; a grey line says why; Decline fills the width as a red outline', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...INV, canCounter: false, canMoveRequest: false, counterHiddenReason: 'switch_off', switchOn: false, moveRequest: ASKED_ONCE } }));
    const r = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('answer-actions'));

    expect(r.queryByTestId('counter')).toBeNull();
    expect(r.queryByText(C5.creator.detail.counter)).toBeNull();
    expect(r.queryByText(C6.invitation.askDate)).toBeNull();

    // The two grey lines, in this order, then Accept, then Decline alone.
    const answer = locate(r.toJSON(), 'answer-actions').node.children[0];
    expect(answer.children).toHaveLength(4);
    expect(answer.children[0].children).toEqual([FINAL]);
    expect(answer.children[1].props.testID).toBe('counter-off');
    expect(answer.children[1].children).toEqual(["Urban Threads aren't taking counters on this campaign."]);
    expect(answer.children[2].props.testID).toBe('accept');
    expectAlone(r, 'decline');
    expectRedOutline(r, 'decline', C5.creator.detail.decline);
    expect(r.getByTestId('decline').props.accessibilityState).toEqual({ disabled: false });
  });

  // Spec U23 — the REAL server shape for a brand that has switched countering off, on an
  // invitation she has not asked to be moved from (backend invitationRows.service.js creatorState:
  // canCounter false, counterHiddenReason 'switch_off', canMoveRequest true). The switch never
  // blocks a move request, so the second button stays — and says what it does.
  it('U23 — the brand is not taking counters but she may still ask for another date: the second button reads "Ask for another date" (dark outline, no undo arrow), level with Decline, and opens the request directly', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...INV, canCounter: false, canMoveRequest: true, counterHiddenReason: 'switch_off', switchOn: false } }));
    const n = nav();
    const r = render(<InvitationScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('answer-actions'));

    // The two grey lines, Accept, then the pair — the same bar as E1, with one more line.
    const answer = locate(r.toJSON(), 'answer-actions').node.children[0];
    expect(answer.children).toHaveLength(4);
    expect(answer.children[0].children).toEqual([FINAL]);
    expect(answer.children[1].props.testID).toBe('counter-off');
    expect(answer.children[1].children).toEqual(["Urban Threads aren't taking counters on this campaign."]);
    expect(answer.children[2].props.testID).toBe('accept');
    expect(idsIn(answer.children[3])).toEqual(['counter', 'decline']);

    // It keeps the testID and the look of the button it replaces; only the word and the arrow go.
    expectLevel(r, 'counter', 'decline');
    expectDarkOutline(r, 'counter');
    const asks = within(r.getByTestId('counter')).getByText('Ask for another date');
    expect(C6.invitation.askDate).toBe('Ask for another date');
    expect(within(r.getByTestId('counter')).queryByText('undo-variant')).toBeNull();
    // The longest label any half carries (146 wide in a half that holds 147 on a 360-wide phone):
    // one line, drawn a little smaller if it must be — never cut short with "…".
    expect(asks.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.8 });
    expect(r.queryByText(C5.creator.detail.counter)).toBeNull();           // "Counter" is nowhere
    expectRedOutline(r, 'decline', C5.creator.detail.decline);

    // One tap, one screen: the move request. No chooser, and never the money counter.
    fireEvent.press(r.getByTestId('counter'));
    expect(n.navigate).toHaveBeenCalledTimes(1);
    expect(n.navigate).toHaveBeenCalledWith('MoveRequest', { ciId: 'ci1' });
    expect(r.queryByText('What would you like to change?')).toBeNull();
    expect(r.queryByTestId('choice-money')).toBeNull();
  });

  // ASSERTION DRIFT — ui-walk-fixes spec U23 (06-diff/drift/E.md). This test was "Counter not
  // allowed for any other reason is absent too" and fed the screen `canCounter: false` with NO
  // reason, `canMoveRequest: false` and no move request — an answer creatorState cannot give: with
  // the invitation still hers to answer a counter is off only FOR a reason, and a move request is
  // off only once she has made one. The two other reasons the server does send are below, each as
  // the server sends it. On a fresh one the second button is not absent: it is U23's button.
  const OPEN_GROUP = { ...INV, canCounter: false, counterHiddenReason: 'open_group', canMoveRequest: true };
  // Her counters are used up and it is her move (roundLimit 2, countersUsed 2). She never asked to
  // be moved, so she still may.
  const ROUNDS_USED = { ...INV, status: 'negotiating', group: 'yourMove', canCounter: false, counterHiddenReason: 'rounds', canMoveRequest: true,
    negotiation: { id: 'n1', open: true, whoseMove: 'influencer', outcome: null, roundLimit: 2, countersUsed: 2, lastCounter: { by: 'brand', at: `${yr}-09-14T10:00:00Z`, line: '11.5%' } } };

  it.each([
    ['an open-group invitation', OPEN_GROUP],
    ['her counters are used up', ROUNDS_USED],
  ])('Counter not allowed for another reason (%s) and she may still ask for another date: no line about a switch that is not off, and the second button reads "Ask for another date", level with Decline', async (_why, invitation) => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation }));
    const n = nav();
    const r = render(<InvitationScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('answer-actions'));

    // The E1 bar — one grey line, Accept, the pair. The switch is not off, so no line about it.
    expect(r.queryByTestId('counter-off')).toBeNull();
    const answer = locate(r.toJSON(), 'answer-actions').node.children[0];
    expect(answer.children).toHaveLength(3);
    expect(answer.children[0].children).toEqual([FINAL]);
    expect(answer.children[1].props.testID).toBe('accept');
    expect(idsIn(answer.children[2])).toEqual(['counter', 'decline']);

    expectLevel(r, 'counter', 'decline');
    expectDarkOutline(r, 'counter');
    within(r.getByTestId('counter')).getByText(C6.invitation.askDate);
    expect(within(r.getByTestId('counter')).queryByText('undo-variant')).toBeNull();
    expect(r.queryByText(C5.creator.detail.counter)).toBeNull();           // "Counter" is nowhere
    expectRedOutline(r, 'decline', C5.creator.detail.decline);

    fireEvent.press(r.getByTestId('counter'));
    expect(n.navigate).toHaveBeenCalledTimes(1);
    expect(n.navigate).toHaveBeenCalledWith('MoveRequest', { ciId: 'ci1' });
    expect(r.queryByTestId('choice-money')).toBeNull();
  });

  it.each([
    ['an open-group invitation', OPEN_GROUP],
    ['her counters are used up', ROUNDS_USED],
  ])('Counter not allowed for another reason (%s) and she has already asked for another date: no second button at all, still no line about a switch, Decline alone', async (_why, invitation) => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...invitation, canMoveRequest: false, moveRequest: ASKED_ONCE } }));
    const r = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('answer-actions'));

    expect(r.queryByTestId('counter')).toBeNull();
    expect(r.queryByText(C5.creator.detail.counter)).toBeNull();
    expect(r.queryByText(C6.invitation.askDate)).toBeNull();
    expect(r.queryByTestId('counter-off')).toBeNull();
    const answer = locate(r.toJSON(), 'answer-actions').node.children[0];
    expect(answer.children).toHaveLength(3);
    expect(answer.children[0].children).toEqual([FINAL]);
    expect(answer.children[1].props.testID).toBe('accept');
    expectAlone(r, 'decline');
    expectRedOutline(r, 'decline', C5.creator.detail.decline);
  });

  it('the three answers still do what they did: Accept asks first, Counter asks which, Decline asks why', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: INV }));
    const r = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('accept'));
    fireEvent.press(r.getByTestId('accept'));
    r.getByText('Accept these terms?');
    fireEvent.press(r.getByTestId('counter'));
    r.getByText('What would you like to change?');
    fireEvent.press(r.getByTestId('decline'));
    r.getByText('Why are you saying no?');
  });

  // ASSERTION DRIFT — ui-walk-fixes board C, rule 1 (drift/C1c.md). The bar used to float over the
  // page, and the page measured it to keep that much room under its last line (140 until measured,
  // then the bar's height + 18). It is a strip in the column now: nothing is measured, and the page
  // ends with its ordinary 18 whatever the strip's height.
  it('the answers are a strip in the column under the page — never floating over it — and the page ends with its ordinary 18, however tall the strip', async () => {
    // The tallest bar the server can ask for (U23): countering switched off on an invitation she
    // has not asked to be moved from — two grey lines, Accept, then the pair. (This fixture used to
    // be the switch off with canMoveRequest false and no move request: a shape the server never sends.)
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...INV, canCounter: false, canMoveRequest: true, counterHiddenReason: 'switch_off', switchOn: false } }));
    const r = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('answer-actions'));
    const answer = locate(r.toJSON(), 'answer-actions').node.children[0];
    expect(answer.children).toHaveLength(4);                           // nothing taller exists
    expect(answer.children[1].props.testID).toBe('counter-off');
    expect(idsIn(answer.children[3])).toEqual(['counter', 'decline']);
    expectStripUnderPage(r, 'answer-actions', 'invitation-scroll');
  });

  it('with no bar at all (answered, no agreement yet) nothing is drawn under the page, and the page still ends with its 18', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: INV }));
    influencerApi.acceptInvitation.mockResolvedValue(ok({ invitation: { ...INV, status: 'accepted', group: 'accepted', ...NOT_HERS } }));
    const r = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('answer-actions'));
    expectStripUnderPage(r, 'answer-actions', 'invitation-scroll');
    fireEvent.press(r.getByTestId('accept'));
    const accepts = r.getAllByText('Accept');
    await act(async () => { fireEvent.press(accepts[accepts.length - 1]); });
    await waitFor(() => r.getByTestId('state-chip-accepted'));
    expect(r.queryByTestId('answer-actions')).toBeNull();
    expect(r.queryByTestId('agreement-actions')).toBeNull();
    expect(r.queryByText(FINAL)).toBeNull();
    expect(StyleSheet.flatten(r.getByTestId('invitation-scroll').props.contentContainerStyle)).toEqual({ padding: 18 });
    // The "accepted" toast, with no strip to clear, is where it always was.
    expect(flat(r.getByTestId('toast')).bottom).toBe(110);
  });

  it('the agreement bar (item 7) is the same strip in the column', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...INV, status: 'accepted', group: 'accepted', ...NOT_HERS, agreement: { canSign: true, line: 'Agreement ready to sign · by 17 Oct' } } }));
    const r = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('agreement-actions'));
    expectStripUnderPage(r, 'agreement-actions', 'invitation-scroll');
    within(r.getByTestId('agreement-actions')).getByTestId('open-agreement');
  });
});

/* ─────────────────────────────── E3 · E4 — the creator's counter conversation */

describe('E3 · E4 — her move in a counter conversation', () => {
  it('E3 — rounds left: "Accept 11.5%", then Counter back and Decline, level', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD() }));
    const r = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('thread-actions'));
    within(r.getByTestId('thread-accept')).getByText('Accept 11.5%');
    expectLevel(r, 'thread-counter', 'thread-decline');
    expectDarkOutline(r, 'thread-counter');
    within(r.getByTestId('thread-counter')).getByText('undo-variant');
    within(r.getByTestId('thread-counter')).getByText(C6.thread.counterBack);
    expectRedOutline(r, 'thread-decline', C6.thread.decline);
  });

  it('the last round (N6): Counter back is ABSENT and Decline fills the width', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD({
      negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 2, countersUsed: 2, isLastRound: false, noRoundsLeft: true, outcome: null, endedAt: null },
      can: { counter: false, accept: true, decline: true },
    }) }));
    const r = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('thread-actions'));
    expect(r.queryByTestId('thread-counter')).toBeNull();
    expectAlone(r, 'thread-decline');
    expectRedOutline(r, 'thread-decline', C6.thread.decline);
  });

  it('rounds left but the server says no counter: absent as well', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD({ can: { counter: false, accept: true, decline: true } }) }));
    const r = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('thread-actions'));
    expect(r.queryByTestId('thread-counter')).toBeNull();
    expectAlone(r, 'thread-decline');
  });

  it('E4 — a long Accept label is centred with side padding and wraps in full, never cut short; the pair below stays level', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD({ goal: 'engagement', current: CONTENT_NOW, turns: [],
      invitation: { terms: CONTENT_NOW, termsLine: '₹10,000', sentAt: `${yr}-09-12T10:00:00Z`, scopeWords: null, offerName: null } }) }));
    const r = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('thread-actions'));
    const label = C6.thread.acceptLine(snapshotLine6('engagement', CONTENT_NOW));
    expect(label).toMatch(/^Accept ₹12,000 · /);
    const text = within(r.getByTestId('thread-accept')).getByText(label);
    expect(text.props.numberOfLines).toBeUndefined();          // no cap: the terms she accepts are never ended with "…"
    expect(flat(text)).toMatchObject({ textAlign: 'center', flexShrink: 1 });
    expect(box(r.getByTestId('thread-accept')).paddingHorizontal).toBe(16);
    expectLevel(r, 'thread-counter', 'thread-decline');
  });

  // ASSERTION DRIFT — ui-walk-fixes board C, rule 1 (drift/C1c.md): was "the page keeps the bar's
  // measured height + 18 under its last line (140 until measured)". The bar is a strip in the
  // column now; nothing is measured and the page ends with its ordinary 18.
  it('her answers are a strip in the column under the page — never floating over it', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD() }));
    const r = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('thread-actions'));
    expectStripUnderPage(r, 'thread-actions', 'thread-scroll');
  });

  it('waiting on the brand: no bar, and the page ends with its 18 (no room kept for a bar that is not there)', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD({ negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 3, countersUsed: 1 }, can: {} }) }));
    const r = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('turn-invitation'));
    expect(r.queryByTestId('thread-actions')).toBeNull();
    expect(StyleSheet.flatten(r.getByTestId('thread-scroll').props.contentContainerStyle)).toEqual({ padding: 18 });
    r.getByTestId('they-can');                                     // the page's last line is still its last line (U10)
  });
});

/* ───────────────────────────────────── E5 · E6 — the brand's two bars */

describe('E5 · E6 — the brand\'s side of the conversation', () => {
  const brandThread = (over = {}) => THREAD({
    negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1, isLastRound: true, noRoundsLeft: false, outcome: null, endedAt: null },
    current: { commissionPct: 13 }, currentLine: '13%',
    turns: [{ id: 't1', by: 'influencer', mine: false, at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { commissionPct: 13 }, changes: [{ term: 'commissionPct', from: '10%', to: '13%' }], note: null }],
    ...over,
  });
  const route = { params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } };

  it('E5 — your move: "Accept 13%", then Counter back and Decline, level', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: brandThread() }));
    const r = render(<BrandThreadScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    within(r.getByTestId('brand-accept')).getByText('Accept 13%');
    expectLevel(r, 'brand-counter-back', 'brand-decline');
    expectDarkOutline(r, 'brand-counter-back');
    within(r.getByTestId('brand-counter-back')).getByText('undo-variant');
    expectRedOutline(r, 'brand-decline', C6.thread.decline);
    // The page's own hint line is untouched (U10).
    r.getByTestId('brand-accept-hint');
  });

  it('no counter left for the brand: Counter back is ABSENT and Decline fills the width', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: brandThread({ can: { counter: false, accept: true, decline: true, moveAnswer: false } }) }));
    const r = render(<BrandThreadScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('brand-thread-actions'));
    expect(r.queryByTestId('brand-counter-back')).toBeNull();
    expectAlone(r, 'brand-decline');
  });

  it('E6 — she asked for another date: three answers in the same shape, "Keep {date}" the dark outline with no arrow', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: THREAD({
      status: 'invited', creator: { id: 'm', name: 'Meera Rao' },
      negotiation: { id: null, open: false, whoseMove: null, roundLimit: 2, countersUsed: 0, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
      current: { commissionPct: 12 }, turns: [],
      invitation: { terms: { commissionPct: 12 }, termsLine: '12%', sentAt: `${yr}-09-12T10:00:00Z`, scopeWords: 'whole store', offerName: null },
      moveRequest: { goLiveDate: `${yr}-10-31`, shootMode: null, note: "I'm travelling that week.", requestedAt: `${yr}-09-13T10:00:00Z`, answer: null, answeredAt: null },
      can: { counter: false, accept: false, decline: false, moveRequest: false, moveAnswer: true },
    }) }));
    brandApi.answerMoveRequest.mockResolvedValue(ok({ answer: 'kept', poolEntryId: null, thread: THREAD({ can: {}, negotiation: { open: false } }) }));
    const r = render(<BrandThreadScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('move-actions'));
    within(r.getByTestId('move-agree')).getByText(C6.moveAnswer.agree);
    expectLevel(r, 'move-keep', 'move-decline');
    expectDarkOutline(r, 'move-keep');
    within(r.getByTestId('move-keep')).getByText('Keep 24 Oct');
    expect(within(r.getByTestId('move-keep')).queryByText('undo-variant')).toBeNull();
    expectRedOutline(r, 'move-decline', C6.moveAnswer.decline);
    r.getByTestId('move-line');                                    // the page's sentence stays (U10)

    // ASSERTION DRIFT — ui-walk-fixes board C, rule 1 (drift/C1b.md). The bar used to float over
    // the page, and the page measured it to keep that much room under its last line (150 until
    // measured, then the bar's height + 18). It is a strip in the column now: nothing is
    // measured, and the page ends with its ordinary 18 whatever the strip's height.
    const strip = r.getByTestId('move-actions');
    expect(flat(strip).position).toBeUndefined();
    expect(flat(strip).bottom).toBeUndefined();
    expect(strip.props.onLayout).toBeUndefined();
    expect(StyleSheet.flatten(r.getByTestId('brand-thread-scroll').props.contentContainerStyle)).toEqual({ padding: 18 });

    await act(async () => { fireEvent.press(r.getByTestId('move-keep')); });
    await waitFor(() => expect(brandApi.answerMoveRequest).toHaveBeenCalledWith('c1', 'sA', 'ci1', 'kept'));
  });
});

/* ───────────────────────────────────────── the pitch conversation, both sides */

describe('the pitch conversation — the same bar on both sides', () => {
  it('the brand: Accept, then Counter back and Reject, level', async () => {
    brandApi.pitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD() }));
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH() }));
    const n = nav();
    const r = render(<PitchThreadScreen navigation={n} route={{ params: { pitchId: 'p1' } }} side="brand" />);
    await waitFor(() => r.getByTestId('pitch-thread-actions'));
    expectLevel(r, 'pitch-thread-counter', 'pitch-thread-decline');
    expectDarkOutline(r, 'pitch-thread-counter');
    within(r.getByTestId('pitch-thread-counter')).getByText('undo-variant');
    expectRedOutline(r, 'pitch-thread-decline', C8.brand.reject);
    fireEvent.press(r.getByTestId('pitch-thread-counter'));
    expect(n.navigate).toHaveBeenCalledWith('PitchCounter', { pitchId: 'p1', side: 'brand' });

    // ASSERTION DRIFT — ui-walk-fixes board C, rule 1 (drift/C1c.md): was "140 until measured, then
    // the bar's height + 18". A strip in the column: nothing measured, the page ends with its 18.
    expectStripUnderPage(r, 'pitch-thread-actions', 'pitch-thread-scroll');
  });

  it('the creator: Accept, then Counter back and Decline, level', async () => {
    influencerApi.myPitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD({
      negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 3, countersUsed: 2, noRoundsLeft: false },
      turns: [
        { id: 't1', by: 'brand', mine: false, at: `${yr}-09-14T10:00:00Z`, kind: 'counter', terms: { fee: 10000 }, changes: [{ term: 'fee', from: '₹12,000', to: '₹10,000' }], note: null },
        { id: 't0', by: 'influencer', mine: true, at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { fee: 12000 }, changes: [], note: null },
      ],
    }) }));
    influencerApi.myPitch.mockResolvedValue(ok({ pitch: PITCH() }));
    const r = render(<PitchThreadScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('pitch-thread-actions'));
    expectLevel(r, 'pitch-thread-counter', 'pitch-thread-decline');
    expectRedOutline(r, 'pitch-thread-decline', C6.thread.decline);
  });

  it('the last round: Counter back is ABSENT and the red outline fills the width', async () => {
    brandApi.pitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD({
      negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 2, noRoundsLeft: true },
    }) }));
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH() }));
    const r = render(<PitchThreadScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} side="brand" />);
    await waitFor(() => r.getByTestId('pitch-thread-actions'));
    expect(r.queryByTestId('pitch-thread-counter')).toBeNull();
    expectAlone(r, 'pitch-thread-decline');
  });
});

/* ─────────────────────────────────────────────── E7 — one pitch, the brand */

describe('E7 — one pitch: Accept her terms, then Counter and Reject level', () => {
  const route = { params: { pitchId: 'p1' } };

  it('the three answers in one bar, and "Open her full profile" as a quiet underlined link beneath', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH() }));
    const n = nav();
    const r = render(<BrandPitchScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-actions'));
    const answer = r.getByTestId('pitch-actions');
    within(answer).getByTestId('pitch-accept');
    within(r.getByTestId('pitch-accept')).getByText(C8.brand.acceptTerms);
    expectLevel(r, 'pitch-counter', 'pitch-reject');
    expectDarkOutline(r, 'pitch-counter');
    within(r.getByTestId('pitch-counter')).getByText('undo-variant');
    expectRedOutline(r, 'pitch-reject', C8.brand.reject);

    // No longer a full-size outline button competing with the three answers.
    const link = r.getByTestId('pitch-full-profile');
    expect(box(link).borderWidth).toBeUndefined();
    expect(box(link).alignSelf).toBe('flex-start');
    expect(flat(within(link).getByText(C8.brand.fullProfile))).toMatchObject({ textDecorationLine: 'underline', color: T.ink });
    expect(within(answer).queryByTestId('pitch-full-profile')).toBeNull();
    fireEvent.press(link);
    expect(n.navigate).toHaveBeenCalledWith('BrandCreatorProfile', { influencerId: 'c1' });
    fireEvent.press(r.getByTestId('pitch-counter'));
    expect(n.navigate).toHaveBeenCalledWith('BrandPitchThread', { pitchId: 'p1' });
  });

  it('only one of the two allowed: it fills the width alone, and the other is ABSENT', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH({ can: { accept: true, counter: false, reject: true } }) }));
    const a = render(<BrandPitchScreen navigation={nav()} route={route} />);
    await waitFor(() => a.getByTestId('pitch-actions'));
    expect(a.queryByTestId('pitch-counter')).toBeNull();
    expectAlone(a, 'pitch-reject');

    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH({ can: { accept: true, counter: true, reject: false } }) }));
    const b = render(<BrandPitchScreen navigation={nav()} route={route} />);
    await waitFor(() => b.getByTestId('pitch-actions'));
    expect(b.queryByTestId('pitch-reject')).toBeNull();
    expectAlone(b, 'pitch-counter');
  });

  it('Accept alone: the main button with no row under it', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH({ can: { accept: true, counter: false, reject: false } }) }));
    const r = render(<BrandPitchScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('pitch-actions'));
    const answer = locate(r.toJSON(), 'pitch-actions').node;
    expect(answer.children).toHaveLength(1);
    expect(answer.children[0].props.testID).toBe('pitch-accept');
  });

  it('nothing allowed (the thread is waiting on her): no bar and no empty row at all — the link follows the reply-by box directly', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH({ can: { accept: false, counter: false, reject: false } }) }));
    const r = render(<BrandPitchScreen navigation={nav()} route={route} />);
    await waitFor(() => r.getByTestId('pitch-terms'));
    expect(r.queryByTestId('pitch-actions')).toBeNull();
    for (const id of ['pitch-accept', 'pitch-counter', 'pitch-reject']) expect(r.queryByTestId(id)).toBeNull();
    // The page column: the box before the link is the reply-by box, with nothing drawn between.
    const { trail } = locate(r.toJSON(), 'pitch-full-profile');
    const column = trail[trail.length - 1];
    const ids = column.children.map(c => (c.props && c.props.testID) || null);
    expect(ids.indexOf('pitch-full-profile')).toBe(ids.indexOf('pitch-replyby') + 1);
    r.getByTestId('pitch-full-profile');
  });
});

/* ───────────────────────────────────────────── E9 · E10 — the confirm sheets */

describe('E9 — sending the agreement: "Not yet" and "Send" level', () => {
  const sheet = (over = {}) => (
    <SendAgreementSheet7 visible creatorName="Sneha" cutoff={`${yr}-10-17`} busy={false} onSend={() => {}} onClose={() => {}} {...over} />
  );

  it('two equal, level halves; "Not yet" has the clear dark outline', () => {
    const r = render(sheet());
    expectLevel(r, 'send-not-yet', 'send-confirm', { sameOutline: false });
    expectDarkOutline(r, 'send-not-yet');
    expect(box(r.getByTestId('send-confirm')).backgroundColor).toBe(T.primary);
    within(r.getByTestId('send-not-yet')).getByText('Not yet');
    within(r.getByTestId('send-confirm')).getByText('Send');
  });

  it('while it is sending the button reads "Sending" — not "Saving" — and cannot be pressed twice', () => {
    const onSend = jest.fn();
    const r = render(sheet({ busy: true, onSend }));
    within(r.getByTestId('send-confirm')).getByText('Sending');
    expect(r.queryByText('Saving')).toBeNull();
    expect(C7.brand.sending).toBe('Sending');
    expect(r.getByTestId('send-confirm').props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(r.getByTestId('send-confirm'));
    expect(onSend).not.toHaveBeenCalled();
    // Busy or not, the two halves stay level.
    expectLevel(r, 'send-not-yet', 'send-confirm', { sameOutline: false });
  });

  it('the "What happens" card is outlined and the warning sits in a grey box; the words are unchanged', () => {
    const r = render(sheet());
    const card = flat(r.getByTestId('send-what-happens'));
    expect(card).toMatchObject({ borderWidth: 1, borderColor: T.border, backgroundColor: T.bg });
    within(r.getByTestId('send-what-happens')).getByText('What happens');
    within(r.getByTestId('send-what-happens')).getByText('Sneha signs');
    within(r.getByTestId('send-what-happens')).getByText(`17 Oct ${yr}`);
    expect(flat(r.getByTestId('send-warning')).backgroundColor).toBe(T.surface);
    within(r.getByTestId('send-warning')).getByText('Nothing can be changed once it is sent. If you need different terms, remove Sneha from the set and invite her again while there is still time.');
    r.getByText('Send this agreement to Sneha?');
  });

  it('the two buttons still do what they did', () => {
    const onSend = jest.fn(); const onClose = jest.fn();
    const r = render(sheet({ onSend, onClose }));
    fireEvent.press(r.getByTestId('send-not-yet'));
    fireEvent.press(r.getByTestId('send-confirm'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});

describe('E10 — pulling an agreement back: "Keep it" and "Withdraw" level', () => {
  const sheet = (over = {}) => (
    <WithdrawAgreementSheet7 visible creatorName="Priya" busy={false} onWithdraw={() => {}} onClose={() => {}} {...over} />
  );

  it('two equal, level halves; Withdraw is a red outline, not the solid red block', () => {
    const r = render(sheet());
    expectLevel(r, 'withdraw-keep', 'withdraw-confirm');
    expectDarkOutline(r, 'withdraw-keep');
    expectRedOutline(r, 'withdraw-confirm', 'Withdraw');
    expect(box(r.getByTestId('withdraw-confirm')).backgroundColor).not.toBe(T.danger);
  });

  it('the first line sits in a grey box and the second stays a plain line; the words are unchanged', () => {
    const r = render(sheet());
    expect(flat(r.getByTestId('withdraw-first-line')).backgroundColor).toBe(T.surface);
    within(r.getByTestId('withdraw-first-line')).getByText("Priya hasn't signed yet. She goes back to waiting for an agreement, and you can send the same one again.");
    const hint = r.getByText("The terms can't be changed. To offer something different, remove Priya from the set and invite her again while there is still time.");
    expect(within(r.getByTestId('withdraw-first-line')).queryByText(hint.props.children)).toBeNull();
    r.getByText('Withdraw this agreement?');
  });

  it('while it is working the spinner and the label are red on white — visible — and a second tap does nothing', () => {
    const onWithdraw = jest.fn();
    const r = render(sheet({ busy: true, onWithdraw }));
    const button = r.getByTestId('withdraw-confirm');
    expect(box(button).backgroundColor).toBe(T.bg);
    expect(within(button).UNSAFE_getByType(ActivityIndicator).props.color).toBe(T.danger);
    expect(flat(within(button).getByText('Working')).color).toBe(T.danger);
    fireEvent.press(button);
    expect(onWithdraw).not.toHaveBeenCalled();
    expectLevel(r, 'withdraw-keep', 'withdraw-confirm');
  });
});

describe('the pitch sheets — the same level pair', () => {
  it('accepting: "Not now" beside "Accept"', () => {
    const onAccept = jest.fn(); const onClose = jest.fn();
    const r = render(<AcceptPitchSheet8 visible pitch={PITCH()} busy={false} onAccept={onAccept} onClose={onClose} />);
    expectLevel(r, 'accept-not-now', 'accept-confirm', { sameOutline: false });
    expectDarkOutline(r, 'accept-not-now');
    fireEvent.press(r.getByTestId('accept-not-now'));
    fireEvent.press(r.getByTestId('accept-confirm'));
    expect([onClose, onAccept].map(f => f.mock.calls.length)).toEqual([1, 1]);
  });

  it('rejecting: "Keep" beside a red-outline "Reject"', () => {
    const onReject = jest.fn();
    const r = render(<RejectPitchSheet8 visible pitch={PITCH()} busy={false} onReject={onReject} onClose={() => {}} />);
    expectLevel(r, 'reject-keep', 'reject-confirm');
    expectDarkOutline(r, 'reject-keep');
    expectRedOutline(r, 'reject-confirm', C8.brand.rejectGo);
    fireEvent.press(r.getByTestId('reject-confirm'));
    expect(onReject).toHaveBeenCalledWith(null);
  });

  it('withdrawing her pitch: "Keep it" beside a red-outline "Withdraw"', () => {
    const onWithdraw = jest.fn();
    const r = render(<WithdrawPitchSheet8 visible busy={false} onWithdraw={onWithdraw} onClose={() => {}} />);
    expectLevel(r, 'withdraw-keep', 'withdraw-confirm');
    expectDarkOutline(r, 'withdraw-keep');
    expectRedOutline(r, 'withdraw-confirm', C8.mine.withdrawGo);
    fireEvent.press(r.getByTestId('withdraw-confirm'));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });
});

/* ───────────────────────────────────────────── the wallet and the collection */

describe('the Wallet tab — Add money and Withdraw level', () => {
  const figures = { available: 37040, onHold: 0, locked: 9000, lockedCount: 1, salesComing: 2719, salesComingCount: 1 };
  beforeEach(() => brandApi.getMe.mockResolvedValue(ok({ brand: { gstin: null, has_bank_account: false } })));

  it('nothing waiting: the yellow button beside the dark-outline Withdraw, level', async () => {
    brandApi.getWallet.mockResolvedValue(ok({ wallet: {}, withdrawal_waiting: null, figures }));
    const n = nav();
    const r = render(<BrandWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('brand-wallet'));
    expectLevel(r, 'wallet-add-money', 'wallet-withdraw', { sameOutline: false });
    expectDarkOutline(r, 'wallet-withdraw');
    expect(flat(rowOf(r.toJSON(), 'wallet-add-money')).marginTop).toBe(12);
    fireEvent.press(r.getByTestId('wallet-withdraw'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandWithdraw', {});
    fireEvent.press(r.getByTestId('wallet-add-money'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandAddMoney', {});
  });

  it('a withdrawal waiting: Withdraw is switched off, and the two are still level', async () => {
    brandApi.getWallet.mockResolvedValue(ok({ wallet: {}, figures: { ...figures, onHold: 20000 },
      withdrawal_waiting: { id: 'w1', amount: 20000, method: 'bank', sendTo: '··4821 · HDFC0001234', status: 'requested', requestedAt: '2026-10-01T05:30:00.000Z', processHours: 24 } }));
    const r = render(<BrandWalletScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('brand-wallet'));
    expectLevel(r, 'wallet-add-money', 'wallet-withdraw');
    expect(r.getByTestId('wallet-withdraw').props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('one collection — Rename and Delete level', () => {
  it('two equal, level halves under "Add posts", Delete a red outline', async () => {
    influencerApi.getCollection.mockResolvedValue(ok({ collection: { id: 'c1', name: 'Goa trip edit', kind: 'posts', hidden: false, line: '2 posts', hidden_line: null,
      items: [{ id: 'i1', kind: 'post', title: 'Weekend denim', brand_name: 'Urban Threads', line: 'Bundle', in_shop: true }] } }));
    const r = render(<CollectionScreen navigation={nav()} route={{ params: { collectionId: 'c1' } }} />);
    await waitFor(() => r.getByTestId('collection'));
    expectLevel(r, 'rename', 'delete');
    expectDarkOutline(r, 'rename');
    expectRedOutline(r, 'delete', 'Delete');
    expect(flat(rowOf(r.toJSON(), 'rename')).marginTop).toBe(10);
    // "Add posts" above the pair is the plain outline button it was.
    expect(box(r.getByTestId('add-items'))).toMatchObject({ marginTop: 10, borderWidth: 1, borderColor: T.border });
    fireEvent.press(r.getByTestId('rename'));
    r.getByTestId('rename-input');
  });
});

/* ───────────────────────────────────── E11 · E12 — after both have signed */

describe('E11 · E12 — the brand\'s agreement after both have signed', () => {
  const stages = [
    ['not_sent', false, 'Plan the visit'],
    ['sent', false, 'Waiting on her answer — open the visit'],
    ['agreed', false, 'The store visit'],
    ['agreed', true, 'The visit time passed — send a new time'],
    ['attended', false, 'Confirm the shoot is done'],
    ['complete', false, 'The store visit'],
  ];

  it('E11 — Store Visit: the state button full width, Download full width under it, both in the bar at the foot of the screen', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SIGNED() }));
    brandApi.getShoot.mockResolvedValue(ok({ shoot: SHOOT('attended') }));
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE} />);
    await waitFor(() => r.getByTestId('step-line'));

    // In the bar — and no longer at the end of the scrolling page.
    const bar = r.getByTestId('signed-actions');
    within(bar).getByTestId('shoot-plan');
    within(bar).getByTestId('download');
    const page = within(r.getByTestId('brand-agreement-body'));
    expect(page.queryByTestId('shoot-plan')).toBeNull();
    expect(page.queryByTestId('download')).toBeNull();
    // The bar is part of the column, under the page: never an overlay.
    expect(flat(bar).position).toBeUndefined();
    expect(flat(bar)).toMatchObject({ borderTopWidth: 1, backgroundColor: T.bg });

    // The state button first, full width, then Download alone in its row — full width, 8 under it.
    const answer = locate(r.toJSON(), 'signed-actions').node.children[0];
    expect(flat(answer).gap).toBe(8);
    expect(answer.children).toHaveLength(2);
    expect(answer.children[0].props.testID).toBe('shoot-plan');
    expect(idsIn(answer.children[1])).toEqual(['download']);
    expect(box(r.getByTestId('shoot-plan'))).toMatchObject({ backgroundColor: T.primary });
    expect(box(r.getByTestId('shoot-plan')).flexGrow).toBeUndefined();
    expectAlone(r, 'download');
    expectDarkOutline(r, 'download');
    within(r.getByTestId('download')).getByText('download');       // the icon
    within(r.getByTestId('download')).getByText(C7.brand.download);

    // The 20 Sep label, with its tick, and the door it opens.
    within(r.getByTestId('shoot-plan')).getByText('Confirm the shoot is done');
    within(r.getByTestId('shoot-plan')).getByText('check');
    fireEvent.press(r.getByTestId('shoot-plan'));
    expect(n.navigate).toHaveBeenCalledWith('BrandShoot', { campaignId: 'c1', setId: 'sA', ciId: 'ci1' });

    // Everything the page showed is still on the page (U10).
    page.getByTestId('agreement-done'); page.getByTestId('money-moved'); page.getByTestId('gate-card');
    page.getByTestId('posting-countdown'); page.getByTestId('signature-creator'); page.getByTestId('signature-brand');
  });

  it.each(stages)('E11 — stage %s (passed: %s) reads "%s", exactly as the 20 Sep walk fixed it', async (stage, passed, label) => {
    expect(C10.openLabel(stage, passed)).toBe(label);
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SIGNED() }));
    brandApi.getShoot.mockResolvedValue(ok({ shoot: SHOOT(stage, passed) }));
    const r = render(<BrandAgreementScreen navigation={nav()} route={AG_ROUTE} />);
    await waitFor(() => r.getByTestId('step-line'));
    within(r.getByTestId('shoot-plan')).getByText(label);
    // Only "Confirm the shoot is done" carries the tick.
    expect(!!within(r.getByTestId('shoot-plan')).queryByText('check')).toBe(stage === 'attended');
  });

  /**
   * What the server REALLY answers for a Remote collaboration signed by both
   * (backend/src/services/shootPlan.service.js `read`, through shoot.controller `brandRead`). The
   * endpoint does not refuse a Remote: it reads the same row, finds no visit plan sent
   * (stage 'not_sent'), and answers with the open gate, the four steps and the countdown — every
   * `can` false, because nothing about a store visit can be done on a Remote.
   */
  const REMOTE_SHOOT = {
    invitationId: 'ci1', shootId: 'pe1', contractId: 'k1',
    gate: { open: true, reason: null,
      signed: { at: `${yr}-09-14T18:18:00Z`, creatorAt: `${yr}-09-14T11:04:00Z`, brandAt: `${yr}-09-14T18:18:00Z` },
      money: { required: true, locked: 9720, released: 2250, releasedAt: `${yr}-09-14T18:18:00Z` } },
    aim: 'engagement', mode: 'shipment', isVisit: false,
    campaignName: 'Diwali Edit 2026', setName: 'Set A',
    brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
    postingDate: `${yr}-10-24`, daysToPosting: 6,
    stage: 'not_sent', stageLabel: 'Plan not sent', passed: false,
    plan: { branch: { name: null, city: null, address: null, state: null, pincode: null, lat: null, lng: null, mapsUrl: null }, contact: null,
      visitAt: null, visitWhen: null, visitDay: null, isToday: false, durationText: null, notes: null,
      sentAt: null, agreedAt: null, attendedAt: null, confirmedAt: null, autoConfirmedAt: null, autoConfirmDueAt: null, autoConfirmDays: null },
    thread: null, delayed: null,
    can: { plan: false, send: false, accept: false, counter: false, move: false, markAttended: false, confirm: false },
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', detail: '14 Sep' },
      { key: 'shoot', label: 'Shoot plan', state: 'now', detail: 'Send her a time' },
      { key: 'content', label: 'Content', state: 'later', detail: 'After the shoot' },
      { key: 'live', label: 'Live and paid', state: 'later', detail: 'Posts 24 Oct' },
    ],
    contactPrefill: { name: null, phone: '+919876543210' },
    branchNow: { name: null, address: null, city: null },
    legacyNoPostingDate: false,
  };

  // ASSERTION DRIFT — ui-walk-fixes spec U24 (06-diff/drift/E.md). This test used to hand the
  // screen a refusal the server never gives ("no visit on a Remote collaboration") and then assert
  // the "Next" card that only a refusal draws. With the real answer the live Remote page keeps
  // what it has shown since item 10 — the ticks, the step line, the countdown — and the "Next"
  // card frame E12 draws is NOT forced onto it. The bar and the door are asserted as before.
  it('E12 — Remote: "Shoot plan" full width over Download, and it opens the Remote shoot (U14) instead of a message; the page above keeps its ticks, step line and countdown (U24)', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SIGNED({ terms: TERMS({ shootMode: 'shipment', branchName: null, branchCity: null }) }) }));
    brandApi.getShoot.mockResolvedValue(ok({ shoot: REMOTE_SHOOT }));
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE} />);
    await waitFor(() => r.getByTestId('signed-actions'));
    await waitFor(() => r.getByTestId('step-line'));
    expect(brandApi.getShoot).toHaveBeenCalledWith('c1', 'sA', 'ci1');

    const answer = locate(r.toJSON(), 'signed-actions').node.children[0];
    expect(answer.children[0].props.testID).toBe('shoot-plan');
    expect(idsIn(answer.children[1])).toEqual(['download']);
    within(r.getByTestId('shoot-plan')).getByText(C7.brand.shootPlan);
    expect(within(r.getByTestId('shoot-plan')).queryByText('check')).toBeNull();
    expectAlone(r, 'download');

    fireEvent.press(r.getByTestId('shoot-plan'));
    expect(n.navigate).toHaveBeenCalledTimes(1);
    expect(n.navigate).toHaveBeenCalledWith('BrandRemote', { campaignId: 'c1', setId: 'sA', ciId: 'ci1' });
    expect(r.queryByText(C10.remoteNext)).toBeNull();

    // What the page truly shows above the bar (U24, U10): everything it has shown since item 10.
    const page = within(r.getByTestId('brand-agreement-body'));
    page.getByTestId('agreement-done'); page.getByTestId('money-moved');
    page.getByText('Remote · products shipped');                       // the Mode row says it is a Remote
    // The gate, as three ticks, in the amounts the signature moved.
    const gate = within(page.getByTestId('gate-card'));
    expect(gate.getAllByTestId('gate-tick')).toHaveLength(3);
    expect(gate.queryByTestId('gate-hourglass')).toBeNull();
    gate.getByText(C10.gate.signed(REMOTE_SHOOT.gate.signed.at));
    gate.getByText('₹9,720 locked');
    gate.getByText('₹2,250 released to Tanvi');
    // The four-step line, word for word as the server sends it, and the countdown.
    const steps = within(page.getByTestId('step-line'));
    for (const st of REMOTE_SHOOT.steps) {
      const step = within(steps.getByTestId(`step-${st.key}-${st.state}`));
      step.getByText(st.label); step.getByText(st.detail);
    }
    expect(page.getByTestId('posting-countdown').props.children).toBe(C10.countdown(`${yr}-10-24`, 6));
    // …and NOT the "Next" card: that is drawn only when the shoot could not be read at all.
    expect(r.queryByTestId('next-step')).toBeNull();
    expect(r.queryByText(C7.brand.nextShip('Tanvi'))).toBeNull();
  });

  it('E12 — when the shoot cannot be read at all (no connection), the Remote page falls back to the "Next" card; the bar and its door are unchanged', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SIGNED({ terms: TERMS({ shootMode: 'shipment', branchName: null, branchCity: null }) }) }));
    // services/api.js's own answer when the request never reaches the server.
    brandApi.getShoot.mockResolvedValue({ success: false, error: { code: 'NETWORK_ERROR', message: 'Could not reach the server. Please try again.' } });
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE} />);
    await waitFor(() => r.getByTestId('next-step'));
    within(r.getByTestId('next-step')).getByText('Ship the products to Tanvi. The shoot plan is open now.');
    expect(r.queryByTestId('gate-card')).toBeNull();
    expect(r.queryByTestId('step-line')).toBeNull();
    const answer = locate(r.toJSON(), 'signed-actions').node.children[0];
    expect(answer.children[0].props.testID).toBe('shoot-plan');
    expect(idsIn(answer.children[1])).toEqual(['download']);
    fireEvent.press(r.getByTestId('shoot-plan'));
    expect(n.navigate).toHaveBeenCalledWith('BrandRemote', { campaignId: 'c1', setId: 'sA', ciId: 'ci1' });
  });

  it('Download still fetches the document', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SIGNED() }));
    brandApi.getShoot.mockResolvedValue(ok({ shoot: SHOOT('agreed') }));
    brandApi.agreementDocument.mockResolvedValue({ success: false, error: { message: 'The document is being prepared.' } });
    const r = render(<BrandAgreementScreen navigation={nav()} route={AG_ROUTE} />);
    await waitFor(() => r.getByTestId('download'));
    await act(async () => { fireEvent.press(r.getByTestId('download')); });
    await waitFor(() => expect(brandApi.agreementDocument).toHaveBeenCalledWith('ci1'));
    await waitFor(() => r.getByText('The document is being prepared.'));
  });

  it('before both have signed there is no such bar: the screen\'s own single button is unchanged', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SIGNED({
      status: 'pending_influencer', signatures: { creator: null, brand: null },
      money: { fee: 9000, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720, locked: null, released: null, stillLocked: null, at: null },
      can: { send: false, sign: false, withdraw: true, download: false },
    }) }));
    const r = render(<BrandAgreementScreen navigation={nav()} route={AG_ROUTE} />);
    await waitFor(() => r.getByTestId('withdraw-actions'));
    expect(r.queryByTestId('signed-actions')).toBeNull();
    expect(r.queryByTestId('shoot-plan')).toBeNull();
    expect(r.queryByTestId('download')).toBeNull();
    expect(brandApi.getShoot).not.toHaveBeenCalled();
    // The Withdraw sheet it opens ends in the level pair.
    fireEvent.press(r.getByTestId('brand-withdraw'));
    expectLevel(r, 'withdraw-keep', 'withdraw-confirm');
  });

  it('the preview\'s Send sheet ends in the level pair', async () => {
    brandApi.agreementPreview.mockResolvedValue(ok({ agreement: SIGNED({
      reference: null, status: 'draft', sentAt: null, signatures: { creator: null, brand: null },
      money: { fee: 9000, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720, locked: null, released: null, stillLocked: null, at: null },
      can: { send: true, sign: false, withdraw: false, download: false },
    }) }));
    const r = render(<BrandAgreementScreen navigation={nav()} route={{ params: { ...AG_ROUTE.params, preview: true } }} />);
    await waitFor(() => r.getByTestId('preview-actions'));
    expect(r.queryByTestId('signed-actions')).toBeNull();
    fireEvent.press(r.getByTestId('send-for-signature'));
    expectLevel(r, 'send-not-yet', 'send-confirm', { sameOutline: false });
  });
});
