/**
 * ui-walk-fixes — board F, frames F1–F8 (points 6 and 8 of the founder's walk; checks 19–26).
 * Contract: features/ui-walk-fixes · spec U3, U11 · research C06, C08
 *
 * "Sending agreement icon, on waiting or different other statuses are unable to recognise… show
 * with button clearly" and "after sending an agreement… no status shown". An action and a status
 * were the same 11px pill, and after Send the screen closed before its message could be read.
 *
 * What these tests hold the app to:
 *   19  a thing you tap to move the work is a labelled button that names the step — "Send
 *       agreement", "Sign", "Reply", "Plan the visit", "Confirm shoot", "Review it", "Confirm
 *       live" — and a tap on the row does the same thing;
 *   20  an agreement out for signature sits under "Waiting for the creator", straight after "Your
 *       move", with a "Waiting to sign" tag; the row and the ⋯ menu reopen it;
 *   21  after Send the brand is on the sent agreement: "Agreement sent.", who is being waited for,
 *       both signature boxes "Not signed yet";
 *   22  a refused Send or Withdraw says why INSIDE the sheet;
 *   23  (the phone's half) a withdrawn agreement's row is a "Send agreement" row again;
 *   24  the creator's card reads "Your move" when it is her turn; the Agreement link opens it;
 *   25  accepting and rejecting a pitch each say so;
 *   26  amber for a move, blue for waiting, green for active — and each can be read.
 *
 * jest cannot see a picture. "Looks like a button" is asserted through the style and the props the
 * piece receives; the phone walk is still the proof of the layout.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';

jest.mock('../../services/api', () => ({
  influencerApi: { myInvitations: jest.fn() },
  brandApi: {
    setSummary: jest.fn(), invitationDetail: jest.fn(), withdrawInvitation: jest.fn(), removeInvitation: jest.fn(),
    updateCampaignSet: jest.fn(), deleteCampaignSet: jest.fn(), duplicateSet: jest.fn(),
    getAgreement: jest.fn(), agreementPreview: jest.fn(), agreementCost: jest.fn(), getShoot: jest.fn(),
    sendAgreement: jest.fn(), signAgreement: jest.fn(), withdrawAgreement: jest.fn(), agreementDocument: jest.fn(),
    pitch: jest.fn(), pitchThread: jest.fn(), acceptPitch: jest.fn(), rejectPitch: jest.fn(),
    getPool: jest.fn(), poolSetDefaults: jest.fn(), removeFromPool: jest.fn(), campaignsSummary: jest.fn(),
    // The Creators tab, where a pitch rejected from its own screen lands (F8).
    pitchInbox: jest.fn(), discoverCreators: jest.fn(), listGroups: jest.fn(), workedWith: jest.fn(),
  },
  referenceApi: { creatorNiches: jest.fn(), languages: jest.fn(), brandCategories: jest.fn(), states: jest.fn() },
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi, brandApi, referenceApi } = require('../../services/api');
const BrandCreatorsScreen = require('../brand/BrandCreatorsScreen').default;
const BrandSetDetailScreen = require('../brand/BrandSetDetailScreen').default;
const { groupsForPhone, anyAgreementOut } = require('../brand/BrandSetDetailScreen');
const BrandAgreementScreen = require('../brand/BrandAgreementScreen').default;
const BrandPitchScreen = require('../brand/BrandPitchScreen').default;
const BrandPoolScreen = require('../brand/BrandPoolScreen').default;
const PitchThreadScreen = require('../shared/PitchThreadScreen').default;
const CollabsScreen = require('../influencer/CollabsScreen').default;
const { SetCreatorRow5, InvitationCard5, ReviewRow5 } = require('../../components/invitations/bits5');
const { RowAction5, StatusTag5, setRowStep, cardStep, cardNext, hersToAnswer, herMoveOnActive, agreementOut5, ROW_ACTION_HEIGHT } = require('../../components/invitations/steps5');
const { SendAgreementSheet7, WithdrawAgreementSheet7 } = require('../../components/agreement/sheets7');
const { C5, GROUP_TONE } = require('../../components/invitations/copy5');
const { C6 } = require('../../components/negotiation/copy6');
const { C7, dayOf7 } = require('../../components/agreement/copy7');
const { C8 } = require('../../components/pitch/copy8');
const { goBackWithToast } = require('../../hooks/useRouteToast');
const { settingsTokens: T } = require('../../theme/tokens');

// React reports a clash of keys — and most other mistakes in how a tree is put together — through
// console.error and then carries on. Every test here must leave it silent. A press starts
// TouchableOpacity's fade and a toast its own; with real timers they land between awaits and warn
// about act(), so the timers are jest's.
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

const nav = (extra = {}) => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn(), ...extra });
const ok = (data) => ({ success: true, data });
const refused = (message) => ({ success: false, error: { code: 'VALIDATION_ERROR', message } });
const yr = new Date().getFullYear();

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
/** A touchable's own box, minus the opacity TouchableOpacity animates. */
const box = (node) => { const { opacity, ...rest } = flat(node); return rest; };
/** Every testID in the drawn tree that matches, in the order it is drawn. */
function idsIn(tree, re) {
  const out = [];
  const walk = (n) => {
    if (!n || typeof n === 'string') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.props && typeof n.props.testID === 'string' && re.test(n.props.testID)) out.push(n.props.testID);
    (n.children || []).forEach(walk);
  };
  walk(tree);
  return out;
}

/** WCAG contrast of two #RRGGBB colours. */
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/* ───────────────────────────────────────────────────────────── fixtures */

/** A set row as backend/src/services/invitationRows.service.js `brandRow` shapes it. */
const row = (o) => ({
  id: o.id, influencerId: `i-${o.id}`, name: o.name || `Creator ${o.id}`, avatarUrl: null,
  status: 'accepted', group: 'yourMove', termsLine: '12% · 2 offers + 12 products',
  sentAt: `${yr}-09-12T10:00:00Z`, answeredAt: `${yr}-09-13T10:00:00Z`, signedAt: null,
  negotiation: null, moveRequest: null, agreement: null, shoot: null, remote: null, content: null, goingLive: null,
  ...o,
  actions: { withdraw: false, remove: true, viewTerms: true, thread: false, sendAgreement: false, signAgreement: false, withdrawAgreement: false, viewAgreement: false, downloadAgreement: false, ...(o.actions || {}) },
});
const signed = (o) => row({ status: 'contracted', group: 'signed', signedAt: `${yr}-09-13T10:00:00Z`, ...o, actions: { remove: false, viewAgreement: true, downloadAgreement: true, ...(o.actions || {}) } });
const NEXT_YEAR = `${yr + 1}-10-18T05:30:00Z`;

const ROWS = {
  send: row({ id: 'r1', name: 'Sneha N.', actions: { sendAgreement: true } }),
  sign: row({ id: 'r2', name: 'Tanvi Suresh', actions: { signAgreement: true, viewAgreement: true },
    agreement: { reference: 'INFLX-2026-00457', status: 'pending_brand', sentAt: `${yr}-09-13T10:00:00Z`, creatorSignedAt: `${yr}-09-14T10:00:00Z`, brandSignedAt: null, line: null } }),
  countered: row({ id: 'r3', name: 'Asha K.', status: 'negotiating', actions: { thread: true },
    negotiation: { id: 'n1', open: true, whoseMove: 'brand', countersUsed: 1, roundLimit: 2, lastCounter: { by: 'influencer', at: `${yr}-09-13T10:00:00Z`, line: '13%' } } }),
  // The server's answer to a Withdraw (slice SF): the same creator, a "Send agreement" row again.
  withdrawn: row({ id: 'r4', name: 'Priya Sharma', actions: { sendAgreement: true },
    agreement: { reference: 'INFLX-2026-00458', status: 'withdrawn', sentAt: null, creatorSignedAt: null, brandSignedAt: null, line: null } }),
  brandCountered: row({ id: 'n1', name: 'Kavya D.', status: 'negotiating', group: 'negotiating', actions: { thread: true },
    negotiation: { id: 'n2', open: true, whoseMove: 'influencer', countersUsed: 2, roundLimit: 2, lastCounter: { by: 'brand', at: `${yr}-09-14T10:00:00Z`, line: '₹9,000' } } }),
  out: row({ id: 'w1', name: 'Priya Sharma', group: 'waiting', actions: { withdrawAgreement: true, viewAgreement: true },
    agreement: { reference: 'INFLX-2026-00458', status: 'pending_influencer', sentAt: `${yr}-09-14T10:00:00Z`, creatorSignedAt: null, brandSignedAt: null, line: null } }),
  unanswered: row({ id: 'w2', name: 'Meera Rao', status: 'invited', group: 'waiting', termsLine: '10%', answeredAt: null, actions: { withdraw: true } }),
  unanswered2: row({ id: 'w3', name: 'Nisha S.', status: 'invited', group: 'waiting', termsLine: '10%', answeredAt: null, actions: { withdraw: true } }),
  plan: signed({ id: 's1', name: 'Sneha N.', shoot: { stage: 'not_sent', line: 'Signed — plan the store visit', visitAt: null } }),
  confirm: signed({ id: 's2', name: 'Priya Sharma', shoot: { stage: 'attended', line: 'Priya says she visited — confirm the shoot is done', visitAt: `${yr}-09-20T05:30:00Z` } }),
  review: signed({ id: 's3', name: 'Tanvi Suresh', shoot: { stage: 'complete', line: 'Shoot done 16 Oct', visitAt: null },
    content: { move: 'review_content', yourMove: true, line: 'Your move. Review her content.', delayed: false } }),
  live: signed({ id: 's4', name: 'Meera Rao', goingLive: { move: 'confirm_live', yourMove: true, line: "Your move. Confirm it's live.", delayed: false, completed: false } }),
  hers: signed({ id: 's5', name: 'Asha K.', goingLive: { move: 'make_posts', yourMove: false, line: 'Asha is making her shoppable posts.', delayed: false, completed: false } }),
  remoteHers: signed({ id: 's6', name: 'Nisha S.', remote: { kind: 'remote', stage: 'not_sent', line: 'Waiting for her delivery address' } }),
  done: signed({ id: 's7', name: 'Divya R.', status: 'completed', goingLive: { move: 'completed', yourMove: false, line: 'Completed · selling', delayed: false, completed: true } }),
  agreed: signed({ id: 's8', name: 'Ritu V.', shoot: { stage: 'agreed', line: 'Store visit agreed for Sun 18 Oct, 11:00 am', visitAt: NEXT_YEAR } }),
  remoteBrand: signed({ id: 's9', name: 'Kavya D.', remote: { kind: 'remote', stage: 'sent', line: 'Her address is here — pick the products' } }),
  plain: signed({ id: 's10', name: 'Anu P.' }),
  // A visit whose time is still being agreed. The stage is 'sent' both ways round; whose turn it
  // is comes from the server (`shoot.yourMove` — the visit's own conversation), never the stage.
  visitHers: signed({ id: 's11', name: 'Kartikeya K', shoot: { stage: 'sent', line: 'Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer', visitAt: NEXT_YEAR, yourMove: false } }),
  visitHis: signed({ id: 's12', name: 'Lata M.', shoot: { stage: 'sent', line: 'Plan sent for Sun 4 Oct, 11:00 am — waiting for Lata to answer', visitAt: NEXT_YEAR, yourMove: true } }),
  // Pay for Content, paid in full: the server's sentence is "Completed." and the status says so.
  finished: signed({ id: 's13', name: 'Isha B.', status: 'completed', shoot: { stage: 'complete', line: 'Shoot done 16 Oct', visitAt: null, yourMove: false },
    content: { move: 'live', yourMove: false, line: 'Completed.', delayed: false } }),
  reported: signed({ id: 's14', name: 'Hema J.', content: { move: 'reported', yourMove: false, line: 'Reported to INFLX.', delayed: false } }),
  deferred: row({ id: 'd1', name: 'Ritu V.', status: 'deferred', group: 'deferred', deferredGoLiveDate: `${yr}-10-27`, deferredAt: `${yr}-09-13T10:00:00Z`, actions: { remove: true } }),
};

const group = (key, title, rows, extra = {}) => ({ key, title, count: rows.length, more: 0, rows, ...extra });
const SERVER_ORDER = ['yourMove', 'negotiating', 'accepted', 'signed', 'waiting', 'deferred', 'declined', 'expired', 'withdrawn'];
const creators = (over = {}) => ({
  order: SERVER_ORDER,
  total: 0,
  groups: {
    yourMove: group('yourMove', 'Your move', [ROWS.send, ROWS.sign, ROWS.countered]),
    negotiating: group('negotiating', 'Negotiating', [ROWS.brandCountered]),
    accepted: group('accepted', 'Accepted, waiting for the agreement', []),
    signed: group('signed', 'Signed', [ROWS.plan, ROWS.confirm, ROWS.review, ROWS.live, ROWS.hers, ROWS.remoteHers, ROWS.done, ROWS.agreed, ROWS.remoteBrand, ROWS.plain,
      ROWS.visitHers, ROWS.visitHis, ROWS.finished, ROWS.reported]),
    // The server lists this group AFTER "Signed", and puts the agreement that is out in it.
    waiting: group('waiting', 'Waiting to answer', [ROWS.out, ROWS.unanswered, ROWS.unanswered2]),
    deferred: group('deferred', 'Moved to your pool', [ROWS.deferred]),
    declined: group('declined', 'Declined', []), expired: group('expired', 'Expired', []), withdrawn: group('withdrawn', 'Withdrawn and closed', []),
    ...over,
  },
});
const SET = {
  id: 'sA', campaignId: 'c1', name: 'Set A · Ethnic wear', state: 'live', datePassed: false, locked: true, lockedFields: ['goal'],
  goal: 'conversion', shootMode: 'visit', branch: { id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad' },
  postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysToCutoff: 4, cutoffPassed: false, expiredAt: null,
  counts: { invited: 16, signed: 10, waiting: 3, declined: 0 }, canInvite: { ok: true }, isPast: false,
};
const summary = (c = creators()) => ({ set: SET, campaign: { id: 'c1', name: 'Diwali Edit 2026' }, creators: c, dateRules: { today: `${yr}-09-14`, earliestPostingDate: `${yr}-09-21`, minDaysAhead: 7, cutoffDaysBefore: 3 } });
const SET_ROUTE = { params: { campaignId: 'c1', setId: 'sA' } };
const at = (ciId, extra = {}) => ({ campaignId: 'c1', setId: 'sA', ciId, ...extra });

async function setScreen(c, route = SET_ROUTE) {
  brandApi.setSummary.mockResolvedValue(ok(summary(c)));
  const n = nav();
  const r = render(<BrandSetDetailScreen navigation={n} route={route} />);
  await waitFor(() => r.getByTestId('creators-block'));
  return { r, n };
}

const TERMS = {
  aim: 'conversion', campaignName: 'Diwali Edit 2026', setName: 'Set A',
  postingDate: `${yr}-10-24`, cutoff: `${yr}-10-17`,
  shootMode: 'visit', branchName: 'Banjara Hills', branchCity: 'Hyderabad',
  parties: {
    brand: { name: 'Urban Threads', city: 'Hyderabad', state: 'Telangana' },
    creator: { name: 'Sneha Narayan', city: 'Hyderabad', state: 'Telangana', handle: 'sneha.styles' },
  },
  money: { fee: null, commissionPct: 12, campaignFeePct: 0, campaignFee: 0, totalToLock: 0, split: null, splitPct: [25, 25, 50], commissionAfterDays: 7 },
  work: { deliverables: null, deliverablesWords: null, usageRights: null, minShoppablePosts: 1 },
  sell: { scope: 'store', words: 'Anything in the store' }, returnTerms: null, note: null,
  termsVersion: '1.0', generatedAt: `${yr}-10-13T10:00:00Z`,
};
/** Sent, and she has not signed: the state frame F4 draws. */
const SENT = (over = {}) => ({
  invitationId: 'ci1', contractId: 'k1', reference: 'INFLX-2026-00123',
  status: 'pending_influencer', sentAt: `${yr}-10-13T10:00:00Z`,
  cutoff: `${yr}-10-17`, daysLeft: 4, cutoffPassed: false,
  terms: TERMS, standardTerms: { version: '1.0' },
  signatures: { creator: null, brand: null },
  ending: null,
  money: { fee: null, campaignFeePct: 0, campaignFee: 0, totalToLock: 0, split: null, splitPct: [25, 25, 50], locked: null, released: null, stillLocked: null, at: null },
  can: { send: false, sign: false, withdraw: true, download: false },
  document: { available: false, generatedAt: null },
  ...over,
});
const DRAFT = () => ({ ...SENT({ reference: null, status: 'draft', sentAt: null, can: { send: true, sign: false, withdraw: false, download: false } }), draft: true });
const AG_ROUTE = (extra = {}) => ({ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1', ...extra } });

const CARD = (o = {}) => ({
  id: 'ci1', status: 'contracted', group: 'signed', brand: { name: 'Urban Threads', logoUrl: null },
  campaignName: 'Diwali Edit 2026', setName: 'Set A', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad',
  postingDate: `${yr}-10-24`, cutoff: `${yr}-10-17`, daysLeft: 4, commissionPct: 12, fee: null,
  canAnswer: false, canCounter: false, negotiation: null, moveRequest: null, pool: null, fromPool: null,
  firstPayment: null, hasUpfrontMoney: false, shoot: null, remote: null, content: null, goingLive: null,
  agreement: { reference: 'INFLX-2026-00123', status: 'active', sentAt: `${yr}-10-13T10:00:00Z`, signedAt: `${yr}-10-14T11:00:00Z`, bothSignedAt: `${yr}-10-14T18:18:00Z`, line: null, canSign: false, canDownload: true },
  ...o,
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
const PITCH_THREAD = () => ({
  pitchId: 'p1', goal: 'engagement',
  brand: { name: 'Stride Kicks' }, creator: { id: 'c1', name: 'Tanvi Suresh' },
  negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }] },
  turns: [{ id: 't0', by: 'influencer', mine: false, at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { fee: 12000 }, changes: [], note: null }],
  ending: null, can: { counter: true, accept: true, decline: true },
});
/** A stack with one screen under this one, as navigation.getState() reports it. */
const stackOver = (under) => () => ({ index: 1, routes: [under, { key: 'here-2', name: 'Here' }] });

/* ═════════════════════════════════ the two pieces: a button, and a tag */

describe('F1 — a button looks like something to tap; a tag does not', () => {
  it('the row button: its label as its own text, a small arrow, an ink outline on white — never yellow, never a black fill', () => {
    const onPress = jest.fn();
    const r = render(<RowAction5 label="Send agreement" onPress={onPress} testID="chip-x" />);
    const btn = r.getByTestId('chip-x');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('Send agreement');
    r.getByText('Send agreement');                                  // the label alone, exactly
    within(btn).getByText('chevron-right');                         // the arrow is an icon beside it
    expect(box(btn)).toMatchObject({ borderWidth: 1.5, borderColor: T.ink, backgroundColor: T.bg, flexDirection: 'row' });
    expect(box(btn).backgroundColor).not.toBe(T.primary);
    expect(box(btn).backgroundColor).not.toBe(T.ink);
    expect(flat(r.getByText('Send agreement')).color).toBe(T.ink);
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('it is at least 44 to touch: 34 drawn, as the board draws it, plus the slop above and below', () => {
    const r = render(<RowAction5 label="Sign" onPress={() => {}} testID="chip-x" />);
    const btn = r.getByTestId('chip-x');
    expect(box(btn).height).toBe(ROW_ACTION_HEIGHT);
    expect(ROW_ACTION_HEIGHT).toBe(34);
    expect(box(btn).height + btn.props.hitSlop.top + btn.props.hitSlop.bottom).toBeGreaterThanOrEqual(44);
  });

  it('the tag: pale, with an icon, no outline, and nothing to press', () => {
    const r = render(<StatusTag5 label="Waiting to sign" tone="waiting" testID="tag-x" />);
    const tag = r.getByTestId('tag-x');
    expect(flat(tag)).toMatchObject({ backgroundColor: T.state.waiting.bg, borderRadius: 999 });
    expect(flat(tag).borderWidth).toBeUndefined();
    expect(tag.props.accessibilityRole).toBeUndefined();
    expect(tag.props.onClick).toBeUndefined();
    within(tag).getByText('clock-outline');
    expect(flat(within(tag).getByText('Waiting to sign')).color).toBe(T.state.waiting.fg);
  });

  it.each([
    ['yourMove', 'alert-circle-outline'], ['waiting', 'clock-outline'], ['active', 'check'], ['completed', 'check'],
  ])('check 26 — the %s tag takes its two colours from the palette and carries the %s icon', (tone, icon) => {
    const r = render(<StatusTag5 label="x" tone={tone} testID="tag-x" />);
    expect(flat(r.getByTestId('tag-x')).backgroundColor).toBe(T.state[tone].bg);
    expect(flat(r.getByText('x')).color).toBe(T.state[tone].fg);
    expect(flat(r.getByText(icon)).color).toBeUndefined();        // the stand-in icon is plain text…
    expect(r.getByText(icon).props.color).toBe(T.state[tone].fg); // …and is handed the tone's colour
  });

  it('check 26 — every tag colour can be read on its own background, and the button on white', () => {
    for (const tone of ['yourMove', 'waiting', 'active', 'completed']) {
      expect(contrast(T.state[tone].fg, T.state[tone].bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(T.ink, T.bg)).toBeGreaterThanOrEqual(7);
    // The palette the tones name: amber, blue, green.
    expect(T.state.yourMove).toEqual({ fg: '#B04600', bg: '#FFEBDD' });
    expect(T.state.waiting).toEqual({ fg: '#1D5FBF', bg: '#E6EFFC' });
    expect(T.state.active).toEqual({ fg: '#1A7A3D', bg: '#E4F5EA' });
  });
});

/* ═════════════════════════════════════════ which one a set row carries */

describe('F1 · F2 — the rule: one button or one tag per row (check 19, spec U11)', () => {
  const step = (o, now) => setRowStep(o, now);

  it('before signing: Send agreement, Sign and Reply are buttons; the waits are tags', () => {
    expect(step(ROWS.send)).toEqual({ kind: 'button', label: 'Send agreement', open: 'agreementPreview' });
    expect(step(ROWS.sign)).toEqual({ kind: 'button', label: 'Sign', open: 'agreement' });
    expect(step(ROWS.countered)).toEqual({ kind: 'button', label: 'Reply', open: 'thread' });
    expect(step(row({ id: 'm', status: 'invited', actions: { thread: true }, moveRequest: { goLiveDate: `${yr}-10-27`, answer: null, requestedAt: `${yr}-09-13T10:00:00Z` } })))
      .toEqual({ kind: 'button', label: 'Reply', open: 'thread' });
    expect(step(ROWS.brandCountered)).toEqual({ kind: 'tag', label: 'Waiting', tone: 'waiting', open: 'thread' });
    expect(step(ROWS.out)).toEqual({ kind: 'tag', label: 'Waiting to sign', tone: 'waiting', open: 'agreement' });
    expect(step(ROWS.unanswered)).toEqual({ kind: 'tag', label: 'Waiting', tone: 'waiting', open: null });
  });

  it('after signing the button names the step the brand owes', () => {
    expect(step(ROWS.plan)).toEqual({ kind: 'button', label: 'Plan the visit', open: 'shoot' });
    expect(step(ROWS.confirm)).toEqual({ kind: 'button', label: 'Confirm shoot', open: 'shoot' });
    expect(step(ROWS.review)).toEqual({ kind: 'button', label: 'Review it', open: 'content' });
    expect(step(ROWS.live)).toEqual({ kind: 'button', label: 'Confirm live', open: 'goingLive' });
    expect(step(signed({ id: 'c', content: { move: 'confirm_live', yourMove: true, line: 'Your move. Confirm it is live.' } })))
      .toEqual({ kind: 'button', label: 'Confirm live', open: 'content' });
    expect(step(signed({ id: 'g', goingLive: { move: 'review_social', yourMove: true, line: 'Your move. Review what she will share.' } })))
      .toEqual({ kind: 'button', label: 'Review it', open: 'goingLive' });
  });

  it('when it is her turn the row carries a blue tag and no button; a finished row a purple one', () => {
    expect(step(ROWS.hers)).toEqual({ kind: 'tag', label: 'Her move', tone: 'waiting', open: 'goingLive' });
    for (const move of ['send_content', 'make_changes', 'post_and_link']) {
      expect(step(signed({ id: 'c', content: { move, yourMove: false, line: 'x' } }))).toEqual({ kind: 'tag', label: 'Her move', tone: 'waiting', open: 'content' });
    }
    for (const move of ['make_posts', 'send_social', 'make_changes', 'post_and_link']) {
      expect(step(signed({ id: 'g', goingLive: { move, yourMove: false, line: 'x', completed: false } })).label).toBe('Her move');
    }
    expect(step(ROWS.done)).toEqual({ kind: 'tag', label: 'Completed · selling', tone: 'completed', open: 'goingLive' });
  });

  // Review fix: "a finished row carries a purple tag" (F2). A Pay for Content collaboration that
  // has been paid in full used to read "Completed." with a green "Active" tag beside it.
  it('a finished collaboration is purple whichever Aim it was: "Completed" beside the server\'s "Completed."', () => {
    expect(step(ROWS.finished)).toEqual({ kind: 'tag', label: 'Completed', tone: 'completed', open: 'content' });
    // The same content step while the last payment is still to come is not finished: "Active".
    expect(step(signed({ id: 'c', status: 'active', content: { move: 'live', yourMove: false, line: 'Live. The final payment follows.' } })))
      .toEqual({ kind: 'tag', label: 'Active', tone: 'active', open: 'content' });
    // A finished row with nothing but its shoot, or nothing at all, is purple too.
    expect(step(signed({ id: 'v', status: 'completed', shoot: { stage: 'complete', line: 'Shoot done 16 Oct', visitAt: null } })))
      .toEqual({ kind: 'tag', label: 'Completed', tone: 'completed', open: 'shoot' });
    expect(step(signed({ id: 'r', status: 'completed', remote: { kind: 'remote', stage: 'shot', line: 'Shoot done' } })))
      .toEqual({ kind: 'tag', label: 'Completed', tone: 'completed', open: 'remote' });
    expect(step(signed({ id: 'p', status: 'completed' }))).toEqual({ kind: 'tag', label: 'Completed', tone: 'completed', open: null });
    // Going live that finished without the server's own "completed" move still reads finished.
    expect(step(signed({ id: 'g', status: 'completed', goingLive: { move: 'final_payment', yourMove: false, line: 'Live. The final payment follows.', completed: false } })))
      .toEqual({ kind: 'tag', label: 'Completed', tone: 'completed', open: 'goingLive' });
    // A step that is still owed wins over the status: the button, or "Her move".
    expect(step(signed({ id: 'c', status: 'completed', content: { move: 'confirm_live', yourMove: true, line: 'Your move. Confirm it is live.' } })).kind).toBe('button');
    expect(step(signed({ id: 'c', status: 'completed', content: { move: 'post_and_link', yourMove: false, line: 'x' } })).label).toBe('Her move');
    expect(C5.set.completedTag).toBe('Completed');
  });

  it('a collaboration reported to INFLX is neither "Active" nor finished: a clock, "Waiting"', () => {
    expect(step(ROWS.reported)).toEqual({ kind: 'tag', label: 'Waiting', tone: 'waiting', open: 'content' });
    expect(step(signed({ id: 'g', goingLive: { move: 'reported', yourMove: false, line: 'Reported to INFLX.', completed: false } })))
      .toEqual({ kind: 'tag', label: 'Waiting', tone: 'waiting', open: 'goingLive' });
    expect(step(signed({ id: 'c', status: 'completed', content: { move: 'reported', yourMove: false, line: 'Reported to INFLX.' } })).label).toBe('Waiting');
  });

  it('"Active" shows only when neither side owes a step (U11)', () => {
    expect(step(ROWS.agreed)).toEqual({ kind: 'tag', label: 'Active', tone: 'active', open: 'shoot' });
    expect(step(ROWS.plain)).toEqual({ kind: 'tag', label: 'Active', tone: 'active', open: null });
    expect(step(signed({ id: 'c', content: { move: 'live', yourMove: false, line: 'Live. The final payment follows.' } })).label).toBe('Active');
    expect(step(signed({ id: 'g', goingLive: { move: 'waiting_posts', yourMove: false, line: 'Live · waiting on posts.', completed: false } })).label).toBe('Active');
    expect(step(signed({ id: 'v', shoot: { stage: 'complete', line: 'Shoot done 16 Oct', visitAt: null } })).label).toBe('Active');
    // A visit whose plan is with her is waiting on her, not "Active"…
    expect(step(ROWS.visitHers)).toEqual({ kind: 'tag', label: 'Waiting', tone: 'waiting', open: 'shoot' });
    // …and an agreed time that has come and gone asks the brand for a new one (the server's line).
    const passed = signed({ id: 'v', shoot: { stage: 'agreed', line: 'The 18 Oct visit passed with nothing marked — send a new time', visitAt: '2026-10-18T05:30:00Z' } });
    expect(step(passed, Date.parse('2026-10-19T00:00:00Z'))).toEqual({ kind: 'button', label: 'Plan the visit', open: 'shoot' });
    expect(step(passed, Date.parse('2026-10-17T00:00:00Z')).label).toBe('Active');
  });

  // Review fix. While a visit's time is being agreed the stage reads 'sent' whether the plan is with
  // her or she has asked for another time and it is with the brand. The row used to read the turn
  // off the stage, so once she countered it said "Waiting" to the one person who could answer.
  it('a visit whose time is being agreed: the turn is the server\'s, never the stage\'s', () => {
    const sent = (yourMove) => signed({ id: 'v', shoot: { stage: 'sent', line: 'Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer', visitAt: NEXT_YEAR, ...(yourMove === undefined ? {} : { yourMove }) } });
    // The plan is with her.
    expect(step(sent(false))).toEqual({ kind: 'tag', label: 'Waiting', tone: 'waiting', open: 'shoot' });
    // She asked for another time (or asked to move an agreed one): it is his to answer.
    expect(step(sent(true))).toEqual({ kind: 'button', label: 'Reply', open: 'shoot' });
    expect(step(ROWS.visitHis)).toEqual({ kind: 'button', label: 'Reply', open: 'shoot' });
    // A server that does not say (an older one) gets neither a button nor a tag: no turn is claimed.
    expect(step(sent(undefined))).toBeNull();
    expect(step(signed({ id: 'v', shoot: { stage: 'sent', line: 'x', visitAt: NEXT_YEAR, yourMove: null } }))).toBeNull();
    // The other stages have one owner each and do not need the flag.
    expect(step(signed({ id: 'v', shoot: { stage: 'not_sent', line: 'Signed — plan the store visit', visitAt: null, yourMove: true } })).label).toBe('Plan the visit');
    expect(step(signed({ id: 'v', shoot: { stage: 'attended', line: 'x', visitAt: NEXT_YEAR, yourMove: true } })).label).toBe('Confirm shoot');
    expect(step(signed({ id: 'v', shoot: { stage: 'agreed', line: 'x', visitAt: NEXT_YEAR, yourMove: false } })).label).toBe('Active');
  });

  it('a Remote row waits on her with a clock, and opens the Remote shoot', () => {
    expect(step(ROWS.remoteHers)).toEqual({ kind: 'tag', label: 'Waiting', tone: 'waiting', open: 'remote' });
    for (const stage of ['delivered', 'checked']) {
      expect(step(signed({ id: 'x', remote: { kind: 'remote', stage, line: 'x' } }))).toEqual({ kind: 'tag', label: 'Waiting', tone: 'waiting', open: 'remote' });
    }
    for (const stage of ['in_transit', 'shot']) {
      expect(step(signed({ id: 'x', remote: { kind: 'remote', stage, line: 'x' } }))).toEqual({ kind: 'tag', label: 'Active', tone: 'active', open: 'remote' });
    }
    expect(step(ROWS.remoteBrand)).toEqual({ kind: 'button', label: 'Open', open: 'remote' });
  });

  it('"Another set" is amber (board I9), and the ended groups carry nothing', () => {
    expect(step(ROWS.deferred)).toEqual({ kind: 'tag', label: 'Another set', tone: 'yourMove', open: null });
    for (const g of ['accepted', 'declined', 'expired', 'withdrawn']) expect(step(row({ id: 'e', group: g }))).toBeNull();
  });

  it('an agreement is "out" by the server\'s own flag or status — never by a sent date alone', () => {
    expect(agreementOut5(ROWS.out)).toBe(true);
    expect(agreementOut5(row({ id: 'a', group: 'waiting', agreement: { status: 'pending_influencer', sentAt: `${yr}-09-14T10:00:00Z` } }))).toBe(true);
    expect(agreementOut5(row({ id: 'b', group: 'waiting', agreement: { status: 'withdrawn', sentAt: `${yr}-09-14T10:00:00Z` } }))).toBe(false);
    expect(agreementOut5(ROWS.unanswered)).toBe(false);
  });

  it('the words are in the copy files', () => {
    expect(C5.set).toMatchObject({ sendAgreement: 'Send agreement', signChip: 'Sign', planVisit: 'Plan the visit', confirmShoot: 'Confirm shoot',
      reviewIt: 'Review it', confirmLive: 'Confirm live', waitingToSign: 'Waiting to sign', herMove: 'Her move', activeTag: 'Active', completedSelling: 'Completed · selling' });
    expect(C6.set.reply).toBe('Reply');
    expect(C5.set.groups.waitingCreator).toBe('Waiting for the creator');
    expect(C5.set.menu).toMatchObject({ openAgreement: 'Open the agreement', withdrawAgreement: 'Withdraw agreement' });
  });
});

/* ═════════════════════════════════════════════════ the row as it is drawn */

describe('F1 — one creator on the set: two lines', () => {
  it('name and status sentence above with the ⋯ at the top right; the button on its own line under them', () => {
    const r = render(<SetCreatorRow5 row={ROWS.send} onPress={() => {}} onChip={() => {}} onMore={() => {}} />);
    const tree = r.toJSON();
    expect(flat(tree)).toMatchObject({ flexDirection: 'row', alignItems: 'flex-start' });
    const body = tree.children[1];
    const [top, under] = body.children;
    // Line one: the words, then the ⋯.
    expect(flat(top)).toMatchObject({ flexDirection: 'row', alignItems: 'flex-start' });
    expect(idsIn(top, /^(meta|more|chip)-/)).toEqual(['meta-r1', 'more-r1']);
    // Line two: the button alone, starting at the left, clear of the ⋯.
    expect(flat(under)).toMatchObject({ alignItems: 'flex-start' });
    expect(idsIn(under, /^(meta|more|chip)-/)).toEqual(['chip-r1']);
  });

  it('the status sentence may wrap to a second line instead of being cut', () => {
    const long = signed({ id: 'v', shoot: { stage: 'sent', line: 'Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer', visitAt: NEXT_YEAR, yourMove: false } });
    const r = render(<SetCreatorRow5 row={long} onPress={() => {}} />);
    const meta = r.getByTestId('meta-v');
    expect(meta.props.numberOfLines).toBe(2);
    expect(meta.props.children).toBe('Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer');
    within(r.getByTestId('tag-v')).getByText('Waiting');
  });

  it('a visit the server gives no turn for is drawn with its sentence alone — no button, no tag', () => {
    const r = render(<SetCreatorRow5 row={signed({ id: 'v', shoot: { stage: 'sent', line: 'Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer', visitAt: NEXT_YEAR } })} onPress={() => {}} />);
    r.getByText('Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer');
    expect(r.queryByTestId('chip-v')).toBeNull();
    expect(r.queryByTestId('tag-v')).toBeNull();
  });

  it('a finished Pay for Content row: the server\'s "Completed." with a purple "Completed" tag, not a green "Active"', () => {
    const r = render(<SetCreatorRow5 row={ROWS.finished} onPress={() => {}} />);
    r.getByText('Completed.');
    const tag = r.getByTestId('tag-s13');
    expect(flat(tag).backgroundColor).toBe(T.state.completed.bg);
    expect(flat(within(tag).getByText('Completed')).color).toBe(T.state.completed.fg);
    within(tag).getByText('check');
    expect(r.queryByText('Active')).toBeNull();
  });

  it('a Remote row says where the shoot has got to — the line the server always sent and nobody drew', () => {
    const r = render(<SetCreatorRow5 row={ROWS.remoteHers} onPress={() => {}} />);
    r.getByText('Waiting for her delivery address');
    expect(r.queryByText(/Signed by both/)).toBeNull();
    within(r.getByTestId('tag-s6')).getByText('Waiting');
  });

  it('a tag is not a button: it has no press of its own, and no chip-<id>', () => {
    const onChip = jest.fn();
    const r = render(<SetCreatorRow5 row={ROWS.out} onPress={() => {}} onChip={onChip} />);
    expect(r.queryByTestId('chip-w1')).toBeNull();
    expect(r.getByTestId('tag-w1').props.accessibilityRole).toBeUndefined();
    within(r.getByTestId('tag-w1')).getByText('clock-outline');
  });

  it('with no onChip the button does what the row does', () => {
    const onPress = jest.fn();
    const r = render(<SetCreatorRow5 row={ROWS.plan} onPress={onPress} />);
    fireEvent.press(r.getByTestId('chip-s1'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

/* ═════════════════════════════════════════════════════ the set screen */

describe('F1 · F2 — the brand\'s set: every button opens its screen, and so does its row (check 19)', () => {
  const DOORS = [
    ['r1', 'Send agreement', 'BrandAgreement', at('r1', { preview: true })],
    ['r2', 'Sign', 'BrandAgreement', at('r2', { preview: false })],
    ['r3', 'Reply', 'BrandThread', at('r3')],
    ['s1', 'Plan the visit', 'BrandShoot', at('s1')],
    ['s2', 'Confirm shoot', 'BrandShoot', at('s2')],
    ['s3', 'Review it', 'BrandContent', at('s3')],
    ['s4', 'Confirm live', 'BrandSaleLive', at('s4')],
    ['s9', 'Open', 'BrandRemote', at('s9')],
    // She asked for another visit time: the server says the turn is his, and "Reply" opens the visit.
    ['s12', 'Reply', 'BrandShoot', at('s12')],
  ];

  it.each(DOORS)('%s — "%s" is a button; it opens %s, and a tap on the row does the same', async (id, label, screen, params) => {
    const { r, n } = await setScreen();
    const btn = r.getByTestId(`chip-${id}`);
    within(btn).getByText(label);
    expect(btn.props.accessibilityRole).toBe('button');
    expect(box(btn)).toMatchObject({ borderWidth: 1.5, borderColor: T.ink, backgroundColor: T.bg });

    fireEvent.press(btn);
    expect(n.navigate).toHaveBeenCalledTimes(1);
    expect(n.navigate).toHaveBeenLastCalledWith(screen, params);
    fireEvent.press(r.getByTestId(`set-creator-${id}`));
    expect(n.navigate).toHaveBeenCalledTimes(2);
    expect(n.navigate).toHaveBeenLastCalledWith(screen, params);
  });

  it('the rows the brand is waiting on carry a tag with an icon and no button', async () => {
    const { r } = await setScreen();
    const TAGS = [
      ['n1', 'Waiting', 'waiting', 'clock-outline'],           // his counter is with her
      ['w1', 'Waiting to sign', 'waiting', 'clock-outline'],   // an agreement out
      ['w2', 'Waiting', 'waiting', 'clock-outline'],           // an invitation nobody has answered
      ['s5', 'Her move', 'waiting', 'clock-outline'],
      ['s6', 'Waiting', 'waiting', 'clock-outline'],           // Remote, waiting on her
      ['s7', 'Completed · selling', 'completed', 'check'],
      ['s8', 'Active', 'active', 'check'],
      ['s10', 'Active', 'active', 'check'],
      ['s11', 'Waiting', 'waiting', 'clock-outline'],          // a visit plan that is with her
      ['s13', 'Completed', 'completed', 'check'],              // Pay for Content, finished
      ['s14', 'Waiting', 'waiting', 'clock-outline'],          // reported: it is with INFLX
      ['d1', 'Another set', 'yourMove', 'alert-circle-outline'],
    ];
    for (const [id, label, tone, icon] of TAGS) {
      const tag = r.getByTestId(`tag-${id}`);
      expect(flat(within(tag).getByText(label)).color).toBe(T.state[tone].fg);
      expect(flat(tag).backgroundColor).toBe(T.state[tone].bg);
      within(tag).getByText(icon);
      expect(r.queryByTestId(`chip-${id}`)).toBeNull();
    }
    // Nothing on this screen reads "Your move" but the heading: every move is named.
    expect(r.getAllByText('Your move')).toHaveLength(1);
  });

  it('a waiting row still opens the live thing behind it: the conversation, the Remote shoot, going live', async () => {
    const { r, n } = await setScreen();
    fireEvent.press(r.getByTestId('set-creator-n1'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandThread', at('n1'));
    fireEvent.press(r.getByTestId('set-creator-s6'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandRemote', at('s6'));
    fireEvent.press(r.getByTestId('set-creator-s5'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandSaleLive', at('s5'));
    fireEvent.press(r.getByTestId('set-creator-s8'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandShoot', at('s8'));
    fireEvent.press(r.getByTestId('set-creator-s11'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandShoot', at('s11'));
    fireEvent.press(r.getByTestId('set-creator-s13'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandContent', at('s13'));
    // An invitation nobody has answered has nothing to open: its row is the ⋯ menu, as before.
    const before = n.navigate.mock.calls.length;
    fireEvent.press(r.getByTestId('set-creator-w2'));
    expect(n.navigate.mock.calls.length).toBe(before);
    r.getByText('Withdraw invitation');
  });

  it('a visit the server gives no turn for (an older server) claims nothing, and its row still opens the visit', async () => {
    const quiet = signed({ id: 'q1', name: 'Kartikeya K', shoot: { stage: 'sent', line: 'Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer', visitAt: NEXT_YEAR } });
    const { r, n } = await setScreen(creators({ signed: group('signed', 'Signed', [quiet]) }));
    expect(r.queryByTestId('chip-q1')).toBeNull();
    expect(r.queryByTestId('tag-q1')).toBeNull();
    fireEvent.press(r.getByTestId('set-creator-q1'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandShoot', at('q1'));
  });
});

describe('F1 — "Waiting for the creator" (check 20)', () => {
  it('the agreement that is out leaves "Waiting to answer" for a group of its own, straight after "Your move"', async () => {
    const { r } = await setScreen();
    expect(idsIn(r.toJSON(), /^group-/)).toEqual(['group-yourMove', 'group-waitingCreator', 'group-negotiating', 'group-signed', 'group-waiting', 'group-deferred']);
    const hers = within(r.getByTestId('group-waitingCreator'));
    hers.getByText('Waiting for the creator');
    hers.getByText('1');
    hers.getByText('Priya Sharma'); hers.getByText('Agreement sent 14 Sep');
    hers.getByText('Waiting to sign');
    const rest = within(r.getByTestId('group-waiting'));
    rest.getByText('Waiting to answer');
    rest.getByText('2');
    expect(rest.queryByText('Priya Sharma')).toBeNull();
    rest.getByText('Meera Rao'); rest.getByText('Nisha S.');
  });

  it('with no "Your move" group it comes first; with no agreement out there is no such group', () => {
    const noMove = groupsForPhone(creators({ yourMove: group('yourMove', 'Your move', []) }));
    expect(noMove.map(g => g.key)).toEqual(['waitingCreator', 'negotiating', 'signed', 'waiting', 'deferred']);
    const none = groupsForPhone(creators({ waiting: group('waiting', 'Waiting to answer', [ROWS.unanswered]) }));
    expect(none.map(g => g.key)).toEqual(['yourMove', 'negotiating', 'signed', 'waiting', 'deferred']);
    // Only agreements waiting: "Waiting to answer" has nobody left, and is not drawn.
    const only = groupsForPhone(creators({ waiting: group('waiting', 'Waiting to answer', [ROWS.out]) }));
    expect(only.map(g => g.key)).toEqual(['yourMove', 'waitingCreator', 'negotiating', 'signed', 'deferred']);
    expect(groupsForPhone(null)).toEqual([]);
  });

  it('rows the server only counted (beyond its 50) stay under "Waiting to answer"', () => {
    const big = groupsForPhone(creators({ waiting: group('waiting', 'Waiting to answer', [ROWS.out, ROWS.unanswered], { count: 60, more: 58 }) }));
    const byKey = Object.fromEntries(big.map(g => [g.key, g]));
    expect(byKey.waitingCreator).toMatchObject({ count: 1, more: 0 });
    expect(byKey.waiting).toMatchObject({ count: 59, more: 58 });
    expect(byKey.waiting.rows.map(x => x.id)).toEqual(['w2']);
  });

  it('tapping her row reopens the agreement that is out', async () => {
    const { r, n } = await setScreen();
    fireEvent.press(r.getByTestId('set-creator-w1'));
    expect(n.navigate).toHaveBeenCalledWith('BrandAgreement', at('w1', { preview: false }));
  });

  it('F3 — her ⋯ menu gains "Open the agreement" and "Withdraw agreement" at the top', async () => {
    const { r, n } = await setScreen();
    fireEvent.press(r.getByTestId('more-w1'));
    const sheet = r.getByTestId('action-sheet');
    const said = JSON.stringify(r.toJSON());
    const order = ['Open the agreement', 'Withdraw agreement', 'View terms sent', 'Open profile', 'Remove from set'].map(label => said.indexOf(`"${label}"`));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(flat(within(sheet).getByText('Withdraw agreement')).color).toBe(T.danger);
    expect(flat(within(sheet).getByText('Open the agreement')).color).toBe(T.ink);

    fireEvent.press(within(sheet).getByText('Open the agreement'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandAgreement', at('w1', { preview: false }));

    // Withdraw opens the agreement with its own "Withdraw this agreement?" sheet up.
    fireEvent.press(r.getByTestId('more-w1'));
    fireEvent.press(within(r.getByTestId('action-sheet')).getByText('Withdraw agreement'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandAgreement', at('w1', { preview: false, ask: 'withdraw' }));
    expect(brandApi.withdrawAgreement).not.toHaveBeenCalled();
  });

  it('a signed row can reopen its agreement too; a row with no agreement is offered neither line', async () => {
    const { r, n } = await setScreen();
    fireEvent.press(r.getByTestId('more-s10'));
    expect(within(r.getByTestId('action-sheet')).queryByText('Withdraw agreement')).toBeNull();
    fireEvent.press(within(r.getByTestId('action-sheet')).getByText('Open the agreement'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandAgreement', at('s10', { preview: false }));

    fireEvent.press(r.getByTestId('more-w2'));
    expect(within(r.getByTestId('action-sheet')).queryByText('Open the agreement')).toBeNull();
    expect(within(r.getByTestId('action-sheet')).queryByText('Withdraw agreement')).toBeNull();
    within(r.getByTestId('action-sheet')).getByText('Withdraw invitation');     // the invitation's own line is untouched
  });

  it('the strip counts down to the signatures once any agreement is out, in the server\'s words, with a clock', async () => {
    expect(C7.brand.bothNeededBy(`${yr}-10-17`, 4)).toBe('Both signatures needed by 17 Oct · 4 days');
    expect(C7.brand.bothNeededBy(`${yr}-10-17`, 1)).toBe('Both signatures needed by 17 Oct · 1 day');
    const { r } = await setScreen();
    const strip = within(r.getByTestId('cutoff-strip'));
    strip.getByText('Both signatures needed by 17 Oct · 4 days');
    strip.getByText('clock-outline');
    expect(r.queryByText('Invitations close in 4 days · 17 Oct')).toBeNull();
  });

  it('with no agreement out the strip is the one it always was', async () => {
    const quiet = creators({
      yourMove: group('yourMove', 'Your move', [ROWS.send, ROWS.countered]),
      waiting: group('waiting', 'Waiting to answer', [ROWS.unanswered]),
    });
    expect(anyAgreementOut(quiet)).toBe(false);
    expect(anyAgreementOut(creators())).toBe(true);
    // She has signed and the brand has not: its signature is still needed.
    expect(anyAgreementOut(creators({ yourMove: group('yourMove', 'Your move', [ROWS.sign]), waiting: group('waiting', 'Waiting to answer', []) }))).toBe(true);
    const { r } = await setScreen(quiet);
    const strip = within(r.getByTestId('cutoff-strip'));
    strip.getByText('Invitations close in 4 days · 17 Oct');
    expect(strip.queryByText('clock-outline')).toBeNull();
  });
});

describe('F6 — the set right after a Withdraw (check 23, the phone\'s half)', () => {
  const after = () => creators({
    yourMove: group('yourMove', 'Your move', [ROWS.withdrawn, ROWS.send, ROWS.sign, ROWS.countered]),
    waiting: group('waiting', 'Waiting to answer', [ROWS.unanswered]),
  });

  it('says "Agreement withdrawn.", and she is back under "Your move" with "Send agreement" — which opens the agreement to send again', async () => {
    const { r, n } = await setScreen(after(), { params: { campaignId: 'c1', setId: 'sA', toast: 'Agreement withdrawn.' } });
    within(r.getByTestId('toast')).getByText('Agreement withdrawn.');
    expect(n.setParams).toHaveBeenCalledWith({ toast: undefined });

    const mine = within(r.getByTestId('group-yourMove'));
    mine.getByText('Priya Sharma');
    within(r.getByTestId('chip-r4')).getByText('Send agreement');
    within(r.getByTestId('set-creator-r4')).getByText('Accepted 13 Sep');
    expect(r.queryByTestId('group-waitingCreator')).toBeNull();
    // Tanvi has signed and waits on the brand, so the strip still counts down to the signatures.
    within(r.getByTestId('cutoff-strip')).getByText('Both signatures needed by 17 Oct · 4 days');

    fireEvent.press(r.getByTestId('chip-r4'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandAgreement', at('r4', { preview: true }));
  });
});

/* ══════════════════════════════════════════════ the agreement, once sent */

describe('F4 — the agreement right after Send (check 21)', () => {
  it('Send keeps the brand on the agreement: the route is replaced out of preview, carrying the message', async () => {
    brandApi.agreementPreview.mockResolvedValue(ok({ agreement: DRAFT() }));
    brandApi.sendAgreement.mockResolvedValue(ok({ agreement: SENT() }));
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE({ preview: true })} />);
    await waitFor(() => r.getByTestId('preview-actions'));
    expect(r.getByTestId('agreement-reference').props.children).toBe('DRAFT');          // once
    expect(r.queryByTestId('signature-creator')).toBeNull();                             // none in preview
    expect(r.queryByTestId('waiting-for-her')).toBeNull();
    fireEvent.press(r.getByTestId('send-for-signature'));
    fireEvent.press(r.getByTestId('send-confirm'));
    await waitFor(() => expect(n.replace).toHaveBeenCalledWith('BrandAgreement', { campaignId: 'c1', setId: 'sA', ciId: 'ci1', preview: false, toast: 'Agreement sent.' }));
    expect(n.goBack).not.toHaveBeenCalled();
    expect(n.navigate).not.toHaveBeenCalled();
    expect(r.queryByTestId('toast')).toBeNull();          // not raised on the screen that is leaving
  });

  it('the sent agreement: "Agreement sent.", who is being waited for, both boxes "Not signed yet", who signs first, and only a quiet Withdraw', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SENT() }));
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE({ preview: false, toast: 'Agreement sent.' })} />);
    // The message is there from the first moment, while the agreement is still being read.
    r.getByTestId('skeleton');
    within(r.getByTestId('toast')).getByText('Agreement sent.');
    expect(n.setParams).toHaveBeenCalledWith({ toast: undefined });

    await waitFor(() => r.getByTestId('waiting-for-her'));
    within(r.getByTestId('toast')).getByText('Agreement sent.');
    expect(brandApi.getAgreement).toHaveBeenCalledWith('c1', 'sA', 'ci1');
    expect(brandApi.agreementPreview).not.toHaveBeenCalled();

    // The blue box: a clock, and the sentence.
    const waiting = r.getByTestId('waiting-for-her');
    expect(flat(waiting).backgroundColor).toBe(T.state.waiting.bg);
    within(waiting).getByText('clock-outline');
    expect(flat(within(waiting).getByText('Sent to Sneha on 13 Oct. Waiting for her to sign by 17 Oct.')).color).toBe(T.state.waiting.fg);
    expect(r.getByTestId('agreement-reference').props.children).toBe('INFLX-2026-00123 · Pay for Sale');

    // Both signature boxes, outlined, "Not signed yet".
    r.getByText('SIGNATURES');
    for (const who of ['creator', 'brand']) {
      const sig = r.getByTestId(`signature-${who}`);
      within(sig).getByText('Not signed yet');
      expect(flat(sig)).toMatchObject({ borderWidth: 1, backgroundColor: '#FFFFFF' });
    }
    within(r.getByTestId('signature-creator')).getByText('Sneha Narayan');
    within(r.getByTestId('signature-brand')).getByText('Urban Threads');
    expect(r.getByTestId('you-sign-after').props.children).toBe('You sign after her. Nothing is binding until both signatures are on it.');

    // No yellow button — nothing is owed by the brand — and Withdraw is the red outline.
    expect(r.queryByTestId('send-for-signature')).toBeNull();
    expect(r.queryByTestId('brand-sign')).toBeNull();
    expect(r.queryByTestId('not-editable')).toBeNull();
    const withdraw = r.getByTestId('brand-withdraw');
    expect(box(withdraw)).toMatchObject({ borderWidth: 1.5, borderColor: T.dangerLine, backgroundColor: T.bg });
    expect(flat(within(withdraw).getByText('Withdraw')).color).toBe(T.danger);
    // The terms cards are unchanged (U10).
    r.getByTestId('two-of-you'); r.getByTestId('what-agreed'); r.getByTestId('standard-terms');
  });

  it('the two new sentences are the ones the board locked, word for word', () => {
    expect(C7.brand.waitingForHer('Sneha', '13 Oct', '17 Oct')).toBe('Sent to Sneha on 13 Oct. Waiting for her to sign by 17 Oct.');
    expect(C7.brand.youSignAfter).toBe('You sign after her. Nothing is binding until both signatures are on it.');
    expect(C7.brand.sent).toBe('Agreement sent.');
    expect(C7.brand.withdrawn).toBe('Agreement withdrawn.');
  });

  it('"Sent on" is the day it was in India, not in London', () => {
    expect(dayOf7('2026-10-13T10:00:00Z')).toBe('2026-10-13');
    expect(dayOf7('2026-10-12T19:00:00Z')).toBe('2026-10-13');      // 12:30 am on the 13th in India
    expect(dayOf7('2026-10-13T18:29:00Z')).toBe('2026-10-13');
    expect(dayOf7('2026-10-17')).toBe('2026-10-17');                // a plain day stays as it is
    expect(dayOf7(null)).toBe('');
  });

  it('once she has signed, the waiting box and its line give way to "your signature completes it"', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SENT({
      status: 'pending_brand', can: { send: false, sign: true, withdraw: false, download: false },
      signatures: { creator: { name: 'Sneha Narayan', at: `${yr}-10-14T11:04:00Z`, device: 'Android', ip: '103.21.58.14' }, brand: null },
    }) }));
    brandApi.agreementCost.mockResolvedValue(ok({ cost: { gate: false, fee: 0, campaignFeePct: 0, campaignFee: 0, totalToLock: 0, payouts: null, availableBalance: 24000, shortfall: 0, enough: true, line: '' } }));
    const r = render(<BrandAgreementScreen navigation={nav()} route={AG_ROUTE()} />);
    await waitFor(() => r.getByTestId('she-signed'));
    expect(r.queryByTestId('waiting-for-her')).toBeNull();
    expect(r.queryByTestId('you-sign-after')).toBeNull();
    r.getByTestId('brand-sign');
  });
});

describe('F5 — a refused Send or Withdraw says why inside the sheet (check 22)', () => {
  it('Send refused: the reason, in red, in the sheet above its two buttons; the brand stays where it is', async () => {
    brandApi.agreementPreview.mockResolvedValue(ok({ agreement: DRAFT() }));
    brandApi.sendAgreement.mockResolvedValue(refused('Signatures for this set closed on 17 Oct.'));
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE({ preview: true })} />);
    await waitFor(() => r.getByTestId('preview-actions'));
    fireEvent.press(r.getByTestId('send-for-signature'));
    expect(r.queryByTestId('send-error')).toBeNull();
    fireEvent.press(r.getByTestId('send-confirm'));

    await waitFor(() => r.getByTestId('send-error'));
    const sheet = within(r.getByTestId('send-agreement-sheet'));
    expect(flat(sheet.getByText('Signatures for this set closed on 17 Oct.')).color).toBe(T.danger);
    expect(flat(r.getByTestId('send-error')).backgroundColor).toBe(T.dangerSoft);
    expect(contrast(T.danger, T.dangerSoft)).toBeGreaterThanOrEqual(4.5);     // red on pale red can be read
    within(r.getByTestId('send-error')).getByText('alert-circle-outline');
    expect(r.getByTestId('send-error').props.accessibilityRole).toBe('alert');
    // Above the two buttons, which are still there.
    expect(idsIn(r.toJSON(), /^send-(warning|error|not-yet|confirm)$/)).toEqual(['send-warning', 'send-error', 'send-not-yet', 'send-confirm']);
    // Nothing behind the sheet, and nothing moved.
    expect(r.queryByTestId('toast')).toBeNull();
    expect(n.replace).not.toHaveBeenCalled();
    expect(n.goBack).not.toHaveBeenCalled();

    // Closing a sheet that showed a refusal reads the agreement again.
    expect(brandApi.agreementPreview).toHaveBeenCalledTimes(1);
    fireEvent.press(r.getByTestId('send-not-yet'));
    await waitFor(() => expect(brandApi.agreementPreview).toHaveBeenCalledTimes(2));
    await waitFor(() => r.getByTestId('preview-actions'));
    // …and opening it again starts clean.
    fireEvent.press(r.getByTestId('send-for-signature'));
    expect(r.queryByTestId('send-error')).toBeNull();
  });

  it('Send refused with no reason from the server still says something', async () => {
    brandApi.agreementPreview.mockResolvedValue(ok({ agreement: DRAFT() }));
    brandApi.sendAgreement.mockResolvedValue({ success: false });
    const r = render(<BrandAgreementScreen navigation={nav()} route={AG_ROUTE({ preview: true })} />);
    await waitFor(() => r.getByTestId('preview-actions'));
    fireEvent.press(r.getByTestId('send-for-signature'));
    fireEvent.press(r.getByTestId('send-confirm'));
    await waitFor(() => within(r.getByTestId('send-error')).getByText(C7.brand.sendFailed));
  });

  it('Withdraw refused: the same, in the withdraw sheet', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SENT() }));
    brandApi.withdrawAgreement.mockResolvedValue(refused("Sneha has already signed, so this can't be withdrawn."));
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE()} />);
    await waitFor(() => r.getByTestId('withdraw-actions'));
    fireEvent.press(r.getByTestId('brand-withdraw'));
    fireEvent.press(r.getByTestId('withdraw-confirm'));

    await waitFor(() => r.getByTestId('withdraw-error'));
    within(r.getByTestId('withdraw-agreement-sheet')).getByText("Sneha has already signed, so this can't be withdrawn.");
    expect(idsIn(r.toJSON(), /^withdraw-(first-line|error|keep|confirm)$/)).toEqual(['withdraw-first-line', 'withdraw-error', 'withdraw-keep', 'withdraw-confirm']);
    expect(r.queryByTestId('toast')).toBeNull();
    expect(n.navigate).not.toHaveBeenCalled();
    expect(n.goBack).not.toHaveBeenCalled();
  });

  it('the sheets themselves: no reason, no red box; a reason, one red box', () => {
    const send = (p) => render(<SendAgreementSheet7 visible creatorName="Sneha" cutoff={`${yr}-10-17`} busy={false} onSend={() => {}} onClose={() => {}} {...p} />);
    expect(send({}).queryByTestId('send-error')).toBeNull();
    within(send({ serverError: 'An agreement is already out with Sneha.' }).getByTestId('send-error')).getByText('An agreement is already out with Sneha.');
    const pull = (p) => render(<WithdrawAgreementSheet7 visible creatorName="Sneha" busy={false} onWithdraw={() => {}} onClose={() => {}} {...p} />);
    expect(pull({}).queryByTestId('withdraw-error')).toBeNull();
    within(pull({ serverError: 'Too late.' }).getByTestId('withdraw-error')).getByText('Too late.');
  });
});

describe('F3 · F6 — withdrawing', () => {
  it('arriving from the ⋯ menu\'s "Withdraw agreement" opens the withdraw sheet, once', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SENT() }));
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE({ preview: false, ask: 'withdraw' })} />);
    await waitFor(() => r.getByText('Withdraw this agreement?'));
    r.getByText("Sneha hasn't signed yet. She goes back to waiting for an agreement, and you can send the same one again.");
    expect(n.setParams).toHaveBeenCalledWith({ ask: undefined });
    expect(brandApi.withdrawAgreement).not.toHaveBeenCalled();       // it asks first
    // "Keep it" closes it, and it does not come back by itself.
    fireEvent.press(r.getByTestId('withdraw-keep'));
    expect(r.queryByText('Withdraw this agreement?')).toBeNull();
  });

  it('…but not when it can no longer be withdrawn (she signed meanwhile)', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SENT({
      status: 'pending_brand', can: { send: false, sign: true, withdraw: false, download: false },
      signatures: { creator: { name: 'Sneha Narayan', at: `${yr}-10-14T11:04:00Z`, device: 'Android', ip: '103.21.58.14' }, brand: null },
    }) }));
    brandApi.agreementCost.mockResolvedValue(ok({ cost: { gate: false, fee: 0, campaignFeePct: 0, campaignFee: 0, totalToLock: 0, payouts: null, availableBalance: 0, shortfall: 0, enough: true, line: '' } }));
    const r = render(<BrandAgreementScreen navigation={nav()} route={AG_ROUTE({ preview: false, ask: 'withdraw' })} />);
    await waitFor(() => r.getByTestId('she-signed'));
    expect(r.queryByText('Withdraw this agreement?')).toBeNull();
  });

  it('after Withdraw the brand is back on the set, which is handed "Agreement withdrawn."', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: SENT() }));
    brandApi.withdrawAgreement.mockResolvedValue(ok({ agreement: SENT({ status: 'withdrawn' }) }));
    const n = nav();
    const r = render(<BrandAgreementScreen navigation={n} route={AG_ROUTE()} />);
    await waitFor(() => r.getByTestId('withdraw-actions'));
    fireEvent.press(r.getByTestId('brand-withdraw'));
    fireEvent.press(r.getByTestId('withdraw-confirm'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('BrandSetDetail', { campaignId: 'c1', setId: 'sA', toast: 'Agreement withdrawn.' }));
    expect(n.goBack).not.toHaveBeenCalled();
    expect(r.queryByTestId('toast')).toBeNull();
  });
});

/* ═══════════════════════════════════════════════ the creator's cards */

describe('F7 — the creator\'s Collabs cards (check 24)', () => {
  it('whose turn it is on an Active card: the server\'s flag for content, going live and the store visit; the stage for the Remote shoot', () => {
    expect(herMoveOnActive(CARD({ content: { move: 'send_content', yourMove: true, line: 'Upload your content and send it.' } }))).toBe(true);
    expect(herMoveOnActive(CARD({ content: { move: 'review_content', yourMove: false, line: 'With Urban Threads for review.' } }))).toBe(false);
    expect(herMoveOnActive(CARD({ goingLive: { move: 'make_posts', yourMove: true, line: 'Create your shoppable posts.' } }))).toBe(true);
    expect(herMoveOnActive(CARD({ goingLive: { move: 'confirm_live', yourMove: false, line: "Waiting for Urban Threads to confirm it's live." } }))).toBe(false);
    // Store visit — review fix. The stage 'sent' is both "a time is with her to answer" and "she
    // asked for another time and waits on the brand"; only the server's flag tells them apart.
    const visit = (stage, yourMove) => CARD({ shoot: { stage, line: 'x', visitAt: NEXT_YEAR, delayed: false, ...(yourMove === undefined ? {} : { yourMove }) } });
    expect(herMoveOnActive(visit('sent', true))).toBe(true);
    expect(herMoveOnActive(visit('sent', false))).toBe(false);          // she countered: it is with the brand
    expect(herMoveOnActive(visit('sent'))).toBe(false);                 // a server that does not say: nothing is claimed
    for (const stage of ['agreed', 'attended', 'complete']) expect(herMoveOnActive(visit(stage, false))).toBe(false);
    // Remote: her address, what turned up, the shoot.
    const remote = (stage) => CARD({ shootMode: 'shipment', remote: { kind: 'remote', stage, line: 'x' } });
    for (const stage of ['not_sent', 'delivered', 'checked']) expect(herMoveOnActive(remote(stage))).toBe(true);
    for (const stage of ['sent', 'in_transit', 'shot']) expect(herMoveOnActive(remote(stage))).toBe(false);
    // Content, once it exists, speaks for the card — a finished shoot underneath does not.
    expect(herMoveOnActive(CARD({ shoot: { stage: 'sent', line: 'x', yourMove: true }, content: { move: 'review_content', yourMove: false, line: 'y' } }))).toBe(false);
    // Just signed, nothing started: waiting on the brand.
    expect(herMoveOnActive(CARD())).toBe(false);
  });

  it('the tag and the button each state gets', () => {
    expect(cardStep(CARD({ group: 'toSign', status: 'accepted' }))).toEqual({ label: 'Your move', tone: 'yourMove', button: 'Review & sign' });
    expect(cardStep(CARD({ group: 'yourMove', status: 'negotiating' }))).toEqual({ label: 'Your move', tone: 'yourMove', button: 'Open' });
    expect(cardStep(CARD({ group: 'signedWaiting', status: 'accepted' }))).toEqual({ label: 'Waiting', tone: 'waiting', button: null });
    expect(cardStep(CARD({ group: 'negotiating', status: 'negotiating' }))).toEqual({ label: 'Waiting', tone: 'waiting', button: null });
    expect(cardStep(CARD())).toEqual({ label: 'Active', tone: 'active', button: null });
    expect(cardStep(CARD({ shoot: { stage: 'sent', line: 'x', yourMove: true } }))).toEqual({ label: 'Your move', tone: 'yourMove', button: 'Open' });
    expect(cardStep(CARD({ shoot: { stage: 'sent', line: 'x', yourMove: false } }))).toEqual({ label: 'Active', tone: 'active', button: null });
    expect(cardStep(CARD({ shoot: { stage: 'sent', line: 'x' } }))).toEqual({ label: 'Active', tone: 'active', button: null });
    // The states the board does not draw keep the plain chip they always had.
    // ASSERTION DRIFT — spec U25 (06-diff/drift/F.md): 'invited' used to be in this list whatever
    // the card said. A brand-new invitation that is hers to answer now has a step of its own (the
    // next test); the ended and waiting groups below still have none.
    for (const g of ['accepted', 'pooled', 'deferred', 'declined', 'expired', 'withdrawn', 'closed']) expect(cardStep(CARD({ group: g }))).toBeNull();
  });

  /** A brand-new invitation as backend invitationRows.service.js `creatorCard` shapes it. */
  const INVITE = (o = {}) => CARD({
    status: 'invited', group: 'invited', agreement: null,
    canAnswer: true, canCounter: true, counterHiddenReason: null, canMoveRequest: true, switchOn: true,
    ...o,
  });
  const ASKED = (answer = null) => ({ goLiveDate: `${yr}-10-31`, shootMode: null, note: null, requestedAt: `${yr}-09-13T10:00:00Z`, answer, answeredAt: answer ? `${yr}-09-14T10:00:00Z` : null });

  it('U25 — a brand-new invitation: "Your move" + "Open" only when it is hers to answer', () => {
    // 1 · hers to answer.
    expect(hersToAnswer(INVITE())).toBe(true);
    expect(cardStep(INVITE())).toEqual({ label: 'Your move', tone: 'yourMove', button: 'Open' });
    // …also when the brand is not taking counters: Accept and Decline are still hers.
    expect(cardStep(INVITE({ canCounter: false, counterHiddenReason: 'switch_off', switchOn: false }))).toEqual({ label: 'Your move', tone: 'yourMove', button: 'Open' });
    // 2 · her own application to an open group: the server says she cannot answer it.
    const applied = INVITE({ status: 'applied', canAnswer: false, canCounter: false, counterHiddenReason: 'closed', canMoveRequest: false });
    expect(hersToAnswer(applied)).toBe(false);
    expect(cardStep(applied)).toBeNull();
    // 3 · she asked for another date and the brand has not answered: it is with the brand.
    const waiting = INVITE({ canMoveRequest: false, moveRequest: ASKED(null) });
    expect(hersToAnswer(waiting)).toBe(false);
    expect(cardStep(waiting)).toBeNull();
    // Once the brand has answered "kept", the invitation is hers again.
    expect(cardStep(INVITE({ canMoveRequest: false, moveRequest: ASKED('kept') }))).toEqual({ label: 'Your move', tone: 'yourMove', button: 'Open' });
    // A card that does not say she may answer claims nothing (an older server, a closed set).
    expect(cardStep(INVITE({ canAnswer: undefined }))).toBeNull();
    expect(cardStep(INVITE({ canAnswer: false }))).toBeNull();
    // Only the 'invited' group is read this way.
    expect(hersToAnswer(CARD({ group: 'accepted', canAnswer: true }))).toBe(false);
  });

  it('U25 — Invites: the invitation she can answer has the amber "Your move" tag and an "Open" button that does what the card does; her application and the one waiting on the brand have neither', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [
      INVITE({ id: 'new' }),
      INVITE({ id: 'app', brand: { name: 'Stride Kicks', logoUrl: null }, status: 'applied', canAnswer: false, canCounter: false, counterHiddenReason: 'closed', canMoveRequest: false }),
      INVITE({ id: 'ask', brand: { name: 'Tick Watches', logoUrl: null }, canMoveRequest: false, moveRequest: ASKED(null) }),
    ] }));
    const n = nav();
    const r = render(<CollabsScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('invitation-card-new'));

    // 1 · hers: the tag, and the button.
    const mine = within(r.getByTestId('invitation-card-new'));
    const tag = mine.getByTestId('card-chip-invited');                 // keyed on the group, as every tag is
    expect(flat(tag).backgroundColor).toBe(T.state.yourMove.bg);
    expect(flat(within(tag).getByText('Your move')).color).toBe(T.state.yourMove.fg);
    within(tag).getByText('alert-circle-outline');
    const open = r.getByTestId('card-action-new');
    within(open).getByText('Open'); within(open).getByText('chevron-right');
    expect(box(open)).toMatchObject({ borderWidth: 1.5, borderColor: T.ink, backgroundColor: T.bg });
    mine.getByText('Reply by 17 Oct · 4 days left');                    // the card's own lines are untouched (U10)
    mine.getByText('You earn 12% commission');
    fireEvent.press(open);
    expect(n.navigate).toHaveBeenLastCalledWith('Invitation', { ciId: 'new' });
    fireEvent.press(r.getByTestId('invitation-card-new'));
    expect(n.navigate).toHaveBeenLastCalledWith('Invitation', { ciId: 'new' });
    expect(n.navigate).toHaveBeenCalledTimes(2);

    // 2 · her own application: no tag, no button — it is the brand's to answer.
    const app = within(r.getByTestId('invitation-card-app'));
    expect(app.queryByTestId('card-chip-invited')).toBeNull();
    expect(app.queryByText('Your move')).toBeNull();
    expect(r.queryByTestId('card-action-app')).toBeNull();

    // 3 · she asked for another date and waits: neither, and the card opens that conversation.
    const ask = within(r.getByTestId('invitation-card-ask'));
    expect(ask.queryByTestId('card-chip-invited')).toBeNull();
    expect(ask.queryByText('Your move')).toBeNull();
    expect(r.queryByTestId('card-action-ask')).toBeNull();
    fireEvent.press(r.getByTestId('invitation-card-ask'));
    expect(n.navigate).toHaveBeenLastCalledWith('Thread', { ciId: 'ask' });

    // One amber tag and one button on the whole list.
    expect(r.getAllByText('Your move')).toHaveLength(1);
    expect(r.getAllByText('Open')).toHaveLength(1);
  });

  /* ── U25(a) — the "Next" row of frame F7 ── */

  it('U25 — what comes next on an Active card: only where the next step is the brand\'s to START', () => {
    // A signed Store Visit collaboration with no plan sent yet: the server sends no `shoot` at all.
    expect(cardNext(CARD())).toBe('Urban Threads plans your store visit');
    expect(C7.creator.nextTheyPlanVisit('Urban Threads')).toBe('Urban Threads plans your store visit');
    // A Remote collaboration whose parcel has not been shipped: her address is in, nothing booked.
    const remote = (stage) => CARD({ shootMode: 'shipment', remote: { kind: 'remote', stage, line: 'x' } });
    expect(cardNext(remote('sent'))).toBe('They ship your products');
    expect(C7.creator.nextTheyShip).toBe('They ship your products');
    expect(C7.creator.next).toBe('Next');
    // Every other Remote stage keeps the server's sentence: hers (address, check, shoot), the
    // parcel already on its way, the shoot done.
    for (const stage of ['not_sent', 'in_transit', 'delivered', 'checked', 'shot']) expect(cardNext(remote(stage))).toBeNull();
    // Any store visit the server describes keeps the server's sentence, whoever's turn it is.
    for (const stage of ['sent', 'agreed', 'attended', 'complete']) {
      expect(cardNext(CARD({ shoot: { stage, line: 'x', visitAt: NEXT_YEAR, yourMove: false } }))).toBeNull();
    }
    // Content and going live, once they exist, speak for the card.
    expect(cardNext(CARD({ content: { move: 'review_content', yourMove: false, line: 'With Urban Threads for review.' } }))).toBeNull();
    expect(cardNext(CARD({ goingLive: { move: 'confirm_live', yourMove: false, line: "Waiting for Urban Threads to confirm it's live." } }))).toBeNull();
    expect(cardNext({ ...remote('sent'), content: { move: 'send_content', yourMove: true, line: 'Upload your content and send it.' } })).toBeNull();
    // Nothing is guessed: a Remote set with no Remote block on the card, a finished collaboration,
    // a card not signed by both, and every card outside Active get no row.
    expect(cardNext(CARD({ shootMode: 'shipment' }))).toBeNull();
    expect(cardNext(CARD({ status: 'completed' }))).toBeNull();
    expect(cardNext(CARD({ agreement: { ...CARD().agreement, bothSignedAt: null } }))).toBeNull();
    expect(cardNext(CARD({ agreement: null }))).toBeNull();
    for (const g of ['invited', 'accepted', 'toSign', 'signedWaiting', 'yourMove', 'negotiating', 'pooled', 'declined', 'expired']) expect(cardNext(CARD({ group: g }))).toBeNull();
    // The old key that told HER to book the visit is gone.
    expect(C7.creator.nextBookVisit).toBeUndefined();
  });

  it('U25 — Active, a store visit the brand has not planned yet: green "Active", the labelled row "Next · Urban Threads plans your store visit", the Agreement link, and no button', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [CARD()] }));
    const n = nav();
    const r = render(<CollabsScreen navigation={n} route={{ params: { segment: 'Active' } }} />);
    await waitFor(() => r.getByTestId('invitation-card-ci1'));
    within(r.getByTestId('card-chip-signed')).getByText('Active');
    expect(flat(r.getByTestId('card-chip-signed')).backgroundColor).toBe(T.state.active.bg);

    // The row: the label in grey at the left, what comes next in bold at the right.
    const row = r.getByTestId('next-line-ci1');
    expect(flat(row)).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between' });
    expect(row.children).toHaveLength(2);
    const label = within(row).getByText('Next');
    const value = within(row).getByText('Urban Threads plans your store visit');
    expect(flat(label).color).toBe(T.ink2);
    expect(flat(value)).toMatchObject({ color: T.ink, textAlign: 'right' });
    expect(value.props.numberOfLines).toBeUndefined();                  // a long brand name wraps, it is never cut

    // Nothing for her to do: no button. The Agreement link is there, and the card opens the agreement.
    expect(r.queryByTestId('card-action-ci1')).toBeNull();
    r.getByTestId('card-agreement-ci1');
    for (const id of ['shoot-line-ci1', 'remote-line-ci1', 'content-line-ci1', 'going-live-line-ci1']) expect(r.queryByTestId(id)).toBeNull();
    // The card's own lines are untouched (U10).
    within(r.getByTestId('invitation-card-ci1')).getByText(`Signed 14 Oct. You earn as you sell.`);
  });

  it('U25 — every other stage keeps the server\'s sentence with no "Next" label', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [
      CARD({ id: 'a', shootMode: 'shipment', remote: { kind: 'remote', stage: 'in_transit', line: 'Your products are on the way' } }),
      CARD({ id: 'b', shoot: { stage: 'agreed', line: 'Store visit agreed for Sun 18 Oct, 11:00 am', visitAt: NEXT_YEAR, yourMove: false } }),
      CARD({ id: 'c', shootMode: 'shipment', remote: { kind: 'remote', stage: 'not_sent', line: 'Send your delivery address' } }),
    ] }));
    const r = render(<CollabsScreen navigation={nav()} route={{ params: { segment: 'Active' } }} />);
    await waitFor(() => r.getByTestId('invitation-card-a'));
    expect(r.getByTestId('remote-line-a').props.children).toBe('Your products are on the way');
    expect(r.getByTestId('shoot-line-b').props.children).toBe('Store visit agreed for Sun 18 Oct, 11:00 am');
    expect(r.getByTestId('remote-line-c').props.children).toBe('Send your delivery address');
    for (const id of ['a', 'b', 'c']) expect(r.queryByTestId(`next-line-${id}`)).toBeNull();
    expect(r.queryByText('Next')).toBeNull();
  });

  it('Active, and it is her turn: an amber "Your move" tag, the stage line, and an "Open" button that does what the card does', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [CARD({ shoot: { stage: 'sent', line: 'Store visit planned for Sun 18 Oct, 11:00 am', visitAt: NEXT_YEAR, delayed: false, yourMove: true } })] }));
    const n = nav();
    const r = render(<CollabsScreen navigation={n} route={{ params: { segment: 'Active' } }} />);
    await waitFor(() => r.getByTestId('invitation-card-ci1'));
    const tag = r.getByTestId('card-chip-signed');                 // keyed on the group, whatever it reads
    expect(flat(tag).backgroundColor).toBe(T.state.yourMove.bg);
    expect(flat(within(tag).getByText('Your move')).color).toBe(T.state.yourMove.fg);
    within(tag).getByText('alert-circle-outline');
    expect(within(r.getByTestId('invitation-card-ci1')).queryByText('Active')).toBeNull();   // the tab above still says Active
    r.getByText('Store visit planned for Sun 18 Oct, 11:00 am');

    const open = r.getByTestId('card-action-ci1');
    within(open).getByText('Open'); within(open).getByText('chevron-right');
    expect(box(open)).toMatchObject({ borderWidth: 1.5, borderColor: T.ink, backgroundColor: T.bg });
    fireEvent.press(open);
    expect(n.navigate).toHaveBeenLastCalledWith('Shoot', { ciId: 'ci1' });
    fireEvent.press(r.getByTestId('invitation-card-ci1'));
    expect(n.navigate).toHaveBeenLastCalledWith('Shoot', { ciId: 'ci1' });
    expect(n.navigate).toHaveBeenCalledTimes(2);
  });

  // Review fix: once she has asked for another visit time the card must not go on telling her it is
  // her move — her shoot screen has nothing for her to do until the brand answers.
  it('a visit time she has countered: the card is "Active", green, with no button — it is with the brand', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [CARD({ shoot: { stage: 'sent', line: 'Store visit planned for Sun 18 Oct, 11:00 am', visitAt: NEXT_YEAR, delayed: false, yourMove: false } })] }));
    const n = nav();
    const r = render(<CollabsScreen navigation={n} route={{ params: { segment: 'Active' } }} />);
    await waitFor(() => r.getByTestId('invitation-card-ci1'));
    const tag = r.getByTestId('card-chip-signed');
    expect(flat(tag).backgroundColor).toBe(T.state.active.bg);
    within(tag).getByText('Active');
    expect(within(r.getByTestId('invitation-card-ci1')).queryByText('Your move')).toBeNull();
    expect(r.queryByTestId('card-action-ci1')).toBeNull();
    // The card is still the door to the visit.
    fireEvent.press(r.getByTestId('invitation-card-ci1'));
    expect(n.navigate).toHaveBeenLastCalledWith('Shoot', { ciId: 'ci1' });
  });

  it('Active, waiting on the brand: "Active" is GREEN (it was purple), with a tick and no button', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [CARD({ shootMode: 'shipment', remote: { kind: 'remote', stage: 'sent', line: 'Address sent — waiting for your products' } })] }));
    const r = render(<CollabsScreen navigation={nav()} route={{ params: { segment: 'Active' } }} />);
    await waitFor(() => r.getByTestId('invitation-card-ci1'));
    const tag = r.getByTestId('card-chip-signed');
    expect(flat(tag).backgroundColor).toBe(T.state.active.bg);
    expect(flat(within(tag).getByText('Active')).color).toBe(T.state.active.fg);
    expect(flat(tag).backgroundColor).not.toBe(T.state.completed.bg);
    within(tag).getByText('check');
    expect(GROUP_TONE.signed).toBe('active');
    expect(r.queryByTestId('card-action-ci1')).toBeNull();
    // ASSERTION DRIFT — spec U25 / frame F7 card d (06-diff/drift/F.md). This asserted the server's
    // sentence on `remote-line-ci1` ("Address sent — waiting for your products"). Her address is in
    // and nothing is booked: the next step is the brand's to start, so the card now says so in the
    // labelled row the frame draws — "Next" + "They ship your products" — in place of that line.
    const next = r.getByTestId('next-line-ci1');
    expect(flat(within(next).getByText('Next')).color).toBe(T.ink2);
    expect(flat(within(next).getByText('They ship your products'))).toMatchObject({ color: T.ink, textAlign: 'right' });
    expect(r.queryByTestId('remote-line-ci1')).toBeNull();
    expect(r.queryByText('Address sent — waiting for your products')).toBeNull();
  });

  it('Remote, and her address is wanted: "Your move", the line, and "Open" goes to the Remote shoot', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [CARD({ shootMode: 'shipment', remote: { kind: 'remote', stage: 'not_sent', line: 'Send your delivery address' } })] }));
    const n = nav();
    const r = render(<CollabsScreen navigation={n} route={{ params: { segment: 'Active' } }} />);
    await waitFor(() => r.getByTestId('invitation-card-ci1'));
    within(r.getByTestId('card-chip-signed')).getByText('Your move');
    r.getByText('Send your delivery address');
    fireEvent.press(r.getByTestId('card-action-ci1'));
    expect(n.navigate).toHaveBeenLastCalledWith('MyRemote', { ciId: 'ci1' });
  });

  it('the underlined "Agreement" link on an Active card opens her agreement — the card itself opens the shoot', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [CARD({ shoot: { stage: 'agreed', line: 'Store visit agreed for Sun 18 Oct, 11:00 am', visitAt: NEXT_YEAR } })] }));
    const n = nav();
    const r = render(<CollabsScreen navigation={n} route={{ params: { segment: 'Active' } }} />);
    await waitFor(() => r.getByTestId('invitation-card-ci1'));
    const link = r.getByTestId('card-agreement-ci1');
    expect(flat(within(link).getByText('Agreement')).textDecorationLine).toBe('underline');
    expect(link.props.accessibilityRole).toBe('button');
    fireEvent.press(link);
    expect(n.navigate).toHaveBeenCalledTimes(1);
    expect(n.navigate).toHaveBeenLastCalledWith('Agreement', { ciId: 'ci1' });
    fireEvent.press(r.getByTestId('invitation-card-ci1'));
    expect(n.navigate).toHaveBeenLastCalledWith('Shoot', { ciId: 'ci1' });
  });

  it('Invites: an agreement to sign is "Your move" with "Review & sign"; signed and waiting is a clock and no button; neither has the link', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [
      CARD({ id: 'a', group: 'toSign', status: 'accepted', agreement: { reference: 'INFLX-2026-00123', status: 'pending_influencer', sentAt: `${yr}-10-13T10:00:00Z`, signedAt: null, bothSignedAt: null, line: 'Agreement ready to sign · by 17 Oct', canSign: true, canDownload: false } }),
      CARD({ id: 'b', group: 'signedWaiting', status: 'accepted', agreement: { reference: 'INFLX-2026-00124', status: 'pending_brand', sentAt: `${yr}-10-13T10:00:00Z`, signedAt: `${yr}-10-14T11:00:00Z`, bothSignedAt: null, line: 'Signed. Waiting for Urban Threads to sign by 17 Oct.', canSign: false, canDownload: false } }),
    ] }));
    const n = nav();
    const r = render(<CollabsScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('invitation-card-a'));

    const mine = within(r.getByTestId('invitation-card-a'));
    mine.getByText('Your move'); mine.getByText('alert-circle-outline');
    mine.getByText('Agreement ready to sign · by 17 Oct');
    within(r.getByTestId('card-action-a')).getByText('Review & sign');
    fireEvent.press(r.getByTestId('card-action-a'));
    expect(n.navigate).toHaveBeenLastCalledWith('Agreement', { ciId: 'a' });

    const waiting = within(r.getByTestId('invitation-card-b'));
    waiting.getByText('Waiting'); waiting.getByText('clock-outline');
    waiting.getByText('Signed. Waiting for Urban Threads to sign by 17 Oct.');
    expect(r.queryByTestId('card-action-b')).toBeNull();
    expect(r.queryByTestId('card-agreement-a')).toBeNull();
    expect(r.queryByTestId('card-agreement-b')).toBeNull();
    expect(r.getAllByTestId(/^card-chip-/).map(x => x.props.testID)).toEqual(['card-chip-toSign', 'card-chip-signedWaiting']);
  });

  it('a card drawn without onAgreement has no link; one the board does not draw keeps its plain chip', () => {
    const plain = render(<InvitationCard5 card={CARD()} onPress={() => {}} />);
    expect(plain.queryByTestId('card-agreement-ci1')).toBeNull();
    const accepted = render(<InvitationCard5 card={CARD({ group: 'accepted', status: 'accepted', agreement: null })} onPress={() => {}} />);
    const chip = accepted.getByTestId('card-chip-accepted');
    within(chip).getByText('Accepted');
    expect(within(chip).queryByText('check')).toBeNull();
    expect(accepted.queryByTestId('card-action-ci1')).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════ the pitch messages */

describe('F8 — accepting and rejecting a pitch each say so (check 25)', () => {
  const route = { params: { pitchId: 'p1' } };

  it('the words', () => {
    expect(C8.brand.inPool('Tanvi Suresh')).toBe('Tanvi is in your pool.');
    expect(C8.brand.rejected).toBe('Pitch rejected.');
  });

  it('accepting from the pitch: the jump to the pool carries "Tanvi is in your pool."', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH() }));
    brandApi.acceptPitch.mockResolvedValue(ok({ pitch: PITCH(), poolEntryId: 'e1' }));
    const n = nav();
    const r = render(<BrandPitchScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-accept'));
    fireEvent.press(r.getByTestId('pitch-accept'));
    fireEvent.press(r.getByTestId('accept-confirm'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandPool', params: { highlight: 'e1', toast: 'Tanvi is in your pool.' }, initial: false }));
  });

  it('accepting from the conversation: the same', async () => {
    brandApi.pitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD() }));
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH() }));
    brandApi.acceptPitch.mockResolvedValue(ok({ pitch: PITCH(), poolEntryId: 'e1' }));
    const n = nav();
    const r = render(<PitchThreadScreen navigation={n} route={route} side="brand" />);
    await waitFor(() => r.getByTestId('pitch-thread-actions'));
    fireEvent.press(r.getByTestId('pitch-thread-accept'));
    fireEvent.press(r.getByTestId('accept-confirm'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandPool', params: { highlight: 'e1', toast: 'Tanvi is in your pool.' }, initial: false }));
  });

  it('the pool shows the message it is handed — from the first moment, and once it has loaded', async () => {
    brandApi.getPool.mockResolvedValue(ok({ total: 0, groups: [] }));
    const n = nav();
    const r = render(<BrandPoolScreen navigation={n} route={{ params: { highlight: 'e1', toast: 'Tanvi is in your pool.' } }} />);
    r.getByTestId('skeleton');
    within(r.getByTestId('toast')).getByText('Tanvi is in your pool.');
    await waitFor(() => r.getByTestId('brand-pool'));
    within(r.getByTestId('toast')).getByText('Tanvi is in your pool.');
    expect(n.setParams).toHaveBeenCalledWith({ toast: undefined });
  });

  it('rejecting from the pitch: back to the screen it came from, which is handed "Pitch rejected."', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH() }));
    brandApi.rejectPitch.mockResolvedValue(ok({ pitch: PITCH() }));
    const n = nav({ getState: stackOver({ key: 'BrandCreators-1', name: 'BrandCreators' }) });
    const r = render(<BrandPitchScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-reject'));
    fireEvent.press(r.getByTestId('pitch-reject'));
    fireEvent.press(r.getByTestId('reject-confirm'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith({ key: 'BrandCreators-1', params: { toast: 'Pitch rejected.' }, merge: true }));
    expect(n.goBack).not.toHaveBeenCalled();
  });

  // Review fix: the main reject path lands on the Creators tab, and nothing drew that screen being
  // handed the message — had it stopped showing a route message, a reject would have gone silent
  // again with every test green.
  it('the Creators tab it lands on says "Pitch rejected.", on its Pitches list — from the first moment, and once the list has loaded', async () => {
    for (const fn of [referenceApi.creatorNiches, referenceApi.languages, referenceApi.brandCategories, referenceApi.states]) fn.mockResolvedValue(ok({ items: [] }));
    brandApi.pitchInbox.mockResolvedValue(ok({ total: 0, unread: 0, order: [], groups: {} }));
    const n = nav();
    // Exactly what goBackWithToast leaves on the screen underneath: its own params, plus the message.
    const r = render(<BrandCreatorsScreen navigation={n} route={{ params: { segment: 'Pitches', toast: 'Pitch rejected.' } }} />);
    within(r.getByTestId('toast')).getByText('Pitch rejected.');
    await waitFor(() => r.getByTestId('pitch-inbox-empty'));
    within(r.getByTestId('brand-creators')).getByText('Pitch rejected.');
    within(r.getByTestId('toast')).getByText('Pitch rejected.');
    expect(n.setParams).toHaveBeenCalledWith({ toast: undefined });       // shown once, not again on the next visit
    expect(brandApi.pitchInbox).toHaveBeenCalled();                        // …and the list under it is read again
    expect(brandApi.discoverCreators).not.toHaveBeenCalled();              // it stayed on Pitches
  });

  it('the Creators tab opened with no message shows none', async () => {
    for (const fn of [referenceApi.creatorNiches, referenceApi.languages, referenceApi.brandCategories, referenceApi.states]) fn.mockResolvedValue(ok({ items: [] }));
    brandApi.pitchInbox.mockResolvedValue(ok({ total: 0, unread: 0, order: [], groups: {} }));
    const r = render(<BrandCreatorsScreen navigation={nav()} route={{ params: { segment: 'Pitches' } }} />);
    await waitFor(() => r.getByTestId('pitch-inbox-empty'));
    expect(r.queryByTestId('toast')).toBeNull();
    expect(r.queryByText('Pitch rejected.')).toBeNull();
  });

  it('rejecting from the conversation: back to the pitch underneath, which shows it', async () => {
    brandApi.pitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD() }));
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH() }));
    brandApi.rejectPitch.mockResolvedValue(ok({ pitch: PITCH() }));
    const n = nav({ getState: stackOver({ key: 'BrandPitch-7', name: 'BrandPitch', params: { pitchId: 'p1' } }) });
    const r = render(<PitchThreadScreen navigation={n} route={route} side="brand" />);
    await waitFor(() => r.getByTestId('pitch-thread-actions'));
    fireEvent.press(r.getByTestId('pitch-thread-decline'));
    fireEvent.press(r.getByTestId('reject-confirm'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith({ key: 'BrandPitch-7', params: { toast: 'Pitch rejected.' }, merge: true }));

    // The pitch screen it lands on says so.
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH({ can: { accept: false, counter: false, reject: false } }) }));
    const m = nav();
    const landed = render(<BrandPitchScreen navigation={m} route={{ params: { pitchId: 'p1', toast: 'Pitch rejected.' } }} />);
    within(landed.getByTestId('toast')).getByText('Pitch rejected.');
    await waitFor(() => landed.getByTestId('pitch-terms'));
    within(landed.getByTestId('toast')).getByText('Pitch rejected.');
    expect(m.setParams).toHaveBeenCalledWith({ toast: undefined });
  });

  it('a refused answer changes nothing about where the brand is', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: PITCH() }));
    brandApi.rejectPitch.mockResolvedValue(refused("You've already answered this pitch."));
    const n = nav({ getState: stackOver({ key: 'BrandCreators-1', name: 'BrandCreators' }) });
    const r = render(<BrandPitchScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-reject'));
    fireEvent.press(r.getByTestId('pitch-reject'));
    fireEvent.press(r.getByTestId('reject-confirm'));
    await waitFor(() => r.getByText("You've already answered this pitch."));
    expect(n.navigate).not.toHaveBeenCalled();
    expect(n.goBack).not.toHaveBeenCalled();
    await waitFor(() => r.getByTestId('pitch-terms'));
  });

  describe('goBackWithToast', () => {
    it('with nothing underneath, or a navigation that cannot say what is, it is a plain goBack', () => {
      const bare = nav();
      goBackWithToast(bare, 'x');
      expect(bare.goBack).toHaveBeenCalledTimes(1);
      expect(bare.navigate).not.toHaveBeenCalled();
      const first = nav({ getState: () => ({ index: 0, routes: [{ key: 'only-1', name: 'Only' }] }) });
      goBackWithToast(first, 'x');
      expect(first.goBack).toHaveBeenCalledTimes(1);
      expect(first.navigate).not.toHaveBeenCalled();
    });

    it('on the real stack router that action goes BACK to the screen underneath and keeps its other params', () => {
      const { StackRouter, CommonActions } = require('@react-navigation/routers');
      const router = StackRouter({});
      const routeNames = ['BrandCreators', 'BrandPitch'];
      const state = {
        stale: false, type: 'stack', key: 'stack-1', index: 1, routeNames,
        routes: [{ key: 'BrandCreators-1', name: 'BrandCreators', params: { segment: 'Pitches' } }, { key: 'BrandPitch-2', name: 'BrandPitch', params: { pitchId: 'p1' } }],
      };
      let action = null;
      goBackWithToast({ getState: () => state, navigate: (a) => { action = CommonActions.navigate(a); }, goBack: jest.fn() }, 'Pitch rejected.');
      const next = router.getStateForAction(state, action, { routeNames, routeParamList: {}, routeGetIdList: {} });
      expect(next.index).toBe(0);
      expect(next.routes.map(x => x.name)).toEqual(['BrandCreators']);          // the pitch screen is gone: it went back
      expect(next.routes[0].key).toBe('BrandCreators-1');                       // the same screen, not a new copy
      expect(next.routes[0].params).toEqual({ segment: 'Pitches', toast: 'Pitch rejected.' });
    });
  });
});

/* ═══════════════════════════════════════════ the colours that had drifted */

describe('colour drift corrected while here (boards I8, I9)', () => {
  it('Review and send: "OK" is green and "Below min" amber — both were grey, their tones did not exist', () => {
    const okRow = render(<ReviewRow5 name="Priya Sharma" line="12%" onPress={() => {}} />);
    expect(flat(okRow.getByText('OK')).color).toBe(T.state.active.fg);
    const below = render(<ReviewRow5 name="Priya Sharma" line="8%" below onPress={() => {}} />);
    expect(flat(below.getByText('Below min')).color).toBe(T.state.yourMove.fg);
    expect(flat(below.getByText('Below min')).color).not.toBe(T.state.ended.fg);
    // The two the row already drew right are unchanged.
    const soon = render(<ReviewRow5 name="Priya Sharma" line="12%" endsSoon onPress={() => {}} />);
    expect(flat(soon.getByText('Ends soon')).color).toBe(T.state.yourMove.fg);
    const cant = render(<ReviewRow5 name="Priya Sharma" line="12%" error="She isn't taking invitations right now." onPress={() => {}} />);
    expect(flat(cant.getByText("Can't invite")).color).toBe(T.state.declined.fg);
  });

  it('"Another set" is amber, not blue', () => {
    const r = render(<SetCreatorRow5 row={ROWS.deferred} onPress={() => {}} />);
    const tag = r.getByTestId('tag-d1');
    expect(flat(tag).backgroundColor).toBe(T.state.yourMove.bg);
    expect(flat(within(tag).getByText('Another set')).color).toBe(T.state.yourMove.fg);
    r.getByText(/^Wants 27 Oct/);
  });
});
