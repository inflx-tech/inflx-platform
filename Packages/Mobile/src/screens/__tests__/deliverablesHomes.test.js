/**
 * ui-walk-fixes — board D (frames D6, D7, D8 and the pitch counter): the same deliverables
 * chooser in its other four homes, and the three adjacent fixes. Checks 12, 13, 14.
 *
 *   D6  the creator's counter      "What you'll deliver" + the "They asked for … → …" line
 *   D7  the brand's counter pop-up "What she delivers" (spec U15), the list opens INSIDE the pop-up
 *   D8  the creator's pitch form   "What you'd deliver"
 *   —   the pitch counter (both apps): a refusal about deliverables lands on the deliverables line
 *
 * The fifth home, the brand's Terms screen (D1–D5), is walked in screens/brand/__tests__/item5Brand.test.js.
 * What every home sends is the shape it always sent: deliverables: [{ type, count }].
 *
 * "The screen moves so the whole list is in view" (the caption of D2 and D7) is proved per home:
 * the three full-page homes here (her counter, her pitch form, the pitch counter) by
 * `expectPageMovedForOpenedList` below; the brand's Terms screen in
 * screens/brand/__tests__/boardCBrandSetup.test.js; the brand's counter pop-up in
 * components/__tests__/popupsAboveKeypad.test.js.
 */
import React from 'react';
import { Modal, ScrollView } from 'react-native';
import { render, fireEvent, waitFor, within, act } from '@testing-library/react-native';

jest.mock('../../services/api', () => ({
  influencerApi: {
    myThread: jest.fn(), counterInvitation: jest.fn(),
    pitchForm: jest.fn(), sendPitch: jest.fn(),
    myPitchThread: jest.fn(), counterMyPitch: jest.fn(),
  },
  brandApi: { pitchThread: jest.fn(), counterPitch: jest.fn() },
  referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi, brandApi } = require('../../services/api');
const CounterScreen = require('../influencer/CounterScreen').default;
const PitchFormScreen = require('../influencer/PitchFormScreen').default;
const PitchCounterScreen = require('../shared/PitchCounterScreen').default;
const { BrandCounterSheet6 } = require('../../components/negotiation/sheets6');
const { MSG5, C5 } = require('../../components/invitations/copy5');
const { C6 } = require('../../components/negotiation/copy6');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const refused = (message, field) => ({ success: false, error: { code: 'VALIDATION_ERROR', message, field } });
const yr = new Date().getFullYear();
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const byId = (id) => (n) => !!n.props && n.props.testID === id;
const place = (root, pred) => root.children.findIndex((c) => typeof c !== 'string' && c.findAll(pred).length > 0);
/** The drawn box a piece sits directly in. */
const boxOf = (node) => { let p = node.parent; while (p && typeof p.type !== 'string') p = p.parent; return p; };

const HINT = 'Reels, posts, stories, YouTube videos and shorts.';

/**
 * Board D, the caption of D2 / D7: "the screen moves so the whole list is in view".
 *
 * The chooser can only move a page it is handed, so on each home two things must stay true: the
 * screen's own scrolling page takes the screen's ref, and the chooser is given that same ref.
 * Drop either and nothing else in the suite notices — on the phone the list opens under the
 * visible area and "+ Add another" looks as if it did nothing.
 *
 * So: tell the phone's measurements that the opened list runs under the bottom edge of the page
 * (page 100…600 on screen, the tapped button at 420, the list 470…690, 900 down the page's
 * content, an ordinary gap of 16 kept clear under the list), open the list from "+ Add another",
 * and expect THE PAGE ITSELF — the one ScrollView that carries `page` as its testID — to be
 * scrolled by exactly the overlap: 690 − (600 − 16) = 106 further than the 530 it is at → 636.
 *
 * ASSERTION DRIFT — ui-walk-fixes closing item (06-diff/drift/E.md): the gap was 96, kept for a
 * button strip that floated over the page, and the answer was 716. No home of the chooser has a
 * floating strip any more (board C), so the page moves 80 less.
 */
function expectPageMovedForOpenedList(r, { page, chooser }) {
  const Native = require('react-native/jest/MockNativeMethods');
  const listId = `${chooser}-list`;
  Native.measureInWindow.mockImplementation(function measure(cb) { cb(...(this.props.testID === listId ? [18, 470, 324, 220] : [18, 420, 172, 48])); });
  Native.measureLayout.mockImplementation((within_, done) => done(18, 900, 324, 220));
  try {
    const pages = r.UNSAFE_getAllByType(ScrollView).filter((n) => n.props.testID === page);
    expect(pages).toHaveLength(1);
    const scroll = pages[0].instance;
    scroll.measureInWindow = (cb) => cb(0, 100, 360, 500);
    scroll.getInnerViewRef = () => ({});
    scroll.scrollTo = jest.fn();
    fireEvent.press(r.getByTestId(`${chooser}-add`));
    expect(scroll.scrollTo).not.toHaveBeenCalled();              // nothing moves until the list has a place on the page
    act(() => { fireEvent(r.getByTestId(listId), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 324, height: 220 } } }); });
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1);
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 636, animated: true });
  } finally {
    Native.measureInWindow.mockReset(); Native.measureLayout.mockReset();
  }
}

beforeEach(() => { jest.clearAllMocks(); });

/* ───────────────────────────────────────────────────────────── D6 */

describe('D6 — creator · her counter, same rows', () => {
  const THREAD = {
    invitationId: 'ci1', goal: 'engagement', status: 'invited',
    brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' },
    campaignName: 'Diwali Edit 2026', setName: 'Set A', postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, cutoffPassed: false,
    shootMode: 'shipment', cityName: 'Hyderabad', switchOn: true,
    negotiation: { id: null, open: false, whoseMove: null, roundLimit: 2, countersUsed: 0, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
    current: { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }], usageRights: null },
    turns: [], invitation: { terms: { fee: 8000 }, termsLine: '₹8,000', sentAt: `${yr}-09-12T10:00:00Z`, scopeWords: null, offerName: null },
    moveRequest: null, pool: null, ending: null,
    can: { counter: true, accept: false, decline: false, moveRequest: true, moveAnswer: false },
  };

  it('one line each under "What you\'ll deliver"; the minus takes the stories from 2 to 1; the "They asked for" line sits directly under the rows and the hint; what is sent is unchanged', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD }));
    influencerApi.counterInvitation.mockResolvedValue(ok({ thread: THREAD }));
    const n = nav();
    const { getByTestId, getByText, queryByTestId } = render(<CounterScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('counter-fee'));
    getByText(/^What you'll deliver/);
    getByTestId('locked-terms');                                             // what can't be countered stays locked at the top
    within(getByTestId('counter-deliverables-row-0-type')).getByText('Instagram reel');
    within(getByTestId('counter-deliverables-row-1-type')).getByText('Instagram story');
    within(getByTestId('counter-deliverables-row-1-count-value')).getByText('2');
    expect(queryByTestId('counter-deliverables-row-0-post')).toBeNull();   // no pile of type pills
    within(getByTestId('counter-deliverables')).getByText(HINT);            // the hint shows here too
    fireEvent.press(getByTestId('counter-deliverables-row-1-count-minus'));
    within(getByTestId('counter-deliverables-row-1-count-value')).getByText('1');
    // the change line: what the brand asked for beside what she now proposes, straight after the block
    const line = getByTestId('change-deliverables');
    within(line).getByText('They asked for'); within(line).getByText('1 reel, 2 stories'); within(line).getByText('1 reel, 1 story');
    const field = boxOf(getByTestId('counter-deliverables'));
    expect(place(field, byId('change-deliverables'))).toBe(place(field, byId('counter-deliverables')) + 1);
    fireEvent.press(getByTestId('send-counter'));
    await waitFor(() => expect(influencerApi.counterInvitation).toHaveBeenCalledWith('ci1', {
      terms: { commissionPct: null, fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 1 }], usageRights: null },
      note: undefined,
    }));
    expect(n.replace).toHaveBeenCalledWith('Thread', { ciId: 'ci1', toast: 'Counter sent.' });
  });

  it('the list opens in place above the "They asked for" line, and a type she already has cannot be added twice', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD }));
    const { getByTestId, queryByTestId, UNSAFE_queryAllByType } = render(<CounterScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('counter-fee'));
    fireEvent.press(getByTestId('counter-deliverables-add'));
    within(getByTestId('counter-deliverables')).getByTestId('counter-deliverables-list');
    expect(UNSAFE_queryAllByType(Modal)).toHaveLength(0);
    fireEvent.press(getByTestId('counter-deliverables-add-story'));        // "Added": takes no tap
    expect(queryByTestId('counter-deliverables-row-2')).toBeNull();
    fireEvent.press(getByTestId('counter-deliverables-add-youtube_short'));
    within(getByTestId('counter-deliverables-row-2-type')).getByText('YouTube short');
    within(getByTestId('change-deliverables')).getByText('1 reel, 2 stories, 1 YouTube short');
  });

  it('a list that opens under the bottom edge moves her counter\'s own page, so the whole list is in view (the D2 caption, on this home)', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD }));
    const r = render(<CounterScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('counter-fee'));
    expectPageMovedForOpenedList(r, { page: 'counter-scroll', chooser: 'counter-deliverables' });
  });
});

/* ───────────────────────────────────────────────────────────── D7 */

describe('D7 — brand · countering back on Pay for Content', () => {
  const thread = (deliverables) => ({
    invitationId: 'ci1', goal: 'engagement', status: 'negotiating',
    brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' }, setName: 'Set A',
    negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1 },
    current: { fee: 12000, deliverables, usageRights: null },
  });
  const TWO = [{ type: 'reel', count: 1 }, { type: 'story', count: 1 }];
  const open = (deliverables = TWO) => {
    const onSend = jest.fn(() => Promise.resolve());
    const r = render(<BrandCounterSheet6 visible thread={thread(deliverables)} minimums={null} onSend={onSend} onClose={() => {}} />);
    return { ...r, onSend };
  };

  it('the block is labelled "What she delivers" — not the creator\'s "What you\'ll deliver" (spec U15) — and the fee line keeps "Priya asked for"', () => {
    const { getByText, queryByText, getByTestId } = open();
    getByText(/^What she delivers/);
    expect(queryByText(/What you'll deliver/)).toBeNull();
    expect(C5.terms.delivers).toBe('What she delivers');
    expect(C6.counter.delivers).toBe("What you'll deliver");   // her own counter screen still says this
    within(getByTestId('brand-change-fee')).getByText('Priya asked for');
    getByText('ROUND 2 OF 2 · YOUR LAST');
    getByText('Counter back');                                  // the pop-up's own title stays (U10)
    getByText('After this, Priya can only accept or decline.');
  });

  it('the same one-line rows; the type list opens inside the pop-up\'s scrolling part, pushes the reuse switch down, and no second pop-up appears', () => {
    const { getByTestId, UNSAFE_getByType, UNSAFE_queryAllByType } = open();
    within(getByTestId('brand-deliverables-row-0-type')).getByText('Instagram reel');
    within(getByTestId('brand-deliverables-row-1-count-value')).getByText('1');
    within(getByTestId('brand-deliverables')).getByText(HINT);
    fireEvent.press(getByTestId('brand-deliverables-add'));
    const scroll = UNSAFE_getByType(ScrollView);
    within(scroll).getByTestId('brand-deliverables-list');
    expect(within(scroll).queryByTestId('brand-send-counter')).toBeNull();   // the button stays at the bottom, outside the scroll
    getByTestId('brand-send-counter');
    expect(UNSAFE_queryAllByType(Modal)).toHaveLength(1);                    // the pop-up itself, and nothing over it
    // The chooser now sits in a box of its own inside the field (board C review: the pop-up scrolls
    // to it when "Send counter" refuses a line), so the field is the box THAT box sits in.
    const field = boxOf(getByTestId('brand-deliverables-field'));
    expect(within(getByTestId('brand-deliverables-field')).getByTestId('brand-deliverables')).toBeTruthy();
    expect(place(field, byId('brand-deliverables-list'))).toBeGreaterThanOrEqual(0);
    expect(place(field, byId('brand-deliverables-list'))).toBeLessThan(place(field, byId('brand-usage-switch')));
    within(getByTestId('brand-deliverables-add-reel')).getByText('Added');
    within(getByTestId('brand-deliverables-add-story')).getByText('Added');
  });

  it('sends the lines as [{ type, count }], with the fee and the note', async () => {
    const { getByTestId, onSend } = open();
    fireEvent.changeText(getByTestId('brand-fee'), '10000');
    fireEvent.press(getByTestId('brand-deliverables-add'));
    fireEvent.press(getByTestId('brand-deliverables-add-post'));
    fireEvent.press(getByTestId('brand-deliverables-row-1-count-plus'));
    fireEvent.changeText(getByTestId('brand-counter-note'), 'We can do ₹10,000.');
    fireEvent.press(getByTestId('brand-send-counter'));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({
      terms: { commissionPct: null, fee: 10000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }, { type: 'post', count: 1 }], usageRights: null },
      note: 'We can do ₹10,000.',
    }));
  });

  it('every line removed → "Add at least one thing she delivers." and nothing is sent', () => {
    const { getByTestId, getByText, onSend } = open();
    fireEvent.press(getByTestId('brand-deliverables-row-0-remove'));
    fireEvent.press(getByTestId('brand-deliverables-row-0-remove'));
    fireEvent.press(getByTestId('brand-send-counter'));
    within(getByTestId('brand-deliverables')).getByText(MSG5.DELIVERABLES_EMPTY);
    expect(onSend).not.toHaveBeenCalled();
    getByText(HINT);
  });

  it('adjacent fix: a type that arrives twice is refused in the pop-up, on the deliverables line, before anything is sent — and goes once it is put right', async () => {
    // The pop-up used to check only "not empty", so this went to the server and its refusal came
    // back as a toast under the open pop-up.
    const { getByTestId, queryByText, onSend } = open([{ type: 'reel', count: 1 }, { type: 'reel', count: 2 }]);
    fireEvent.press(getByTestId('brand-send-counter'));
    within(getByTestId('brand-deliverables')).getByText(MSG5.DELIVERABLE_DUP);
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('brand-deliverables-row-1-type'));
    fireEvent.press(getByTestId('brand-deliverables-row-1-story'));
    expect(queryByText(MSG5.DELIVERABLE_DUP)).toBeNull();
    fireEvent.press(getByTestId('brand-send-counter'));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].terms.deliverables).toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]);
  });

  it('a count that arrives outside 1 to 20 is shown, and sent, as the nearest number allowed', async () => {
    const { getByTestId, onSend } = open([{ type: 'reel', count: 25 }, { type: 'story', count: '3' }]);
    within(getByTestId('brand-deliverables-row-0-count-value')).getByText('20');
    within(getByTestId('brand-deliverables-row-1-count-value')).getByText('3');
    fireEvent.press(getByTestId('brand-send-counter'));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].terms.deliverables).toEqual([{ type: 'reel', count: 20 }, { type: 'story', count: 3 }]);
  });
});

/* ───────────────────────────────────────────────────────────── D8 */

describe('D8 — creator · her pitch, same rows', () => {
  const FORM = {
    brand: { id: 'b1', name: 'Urban Threads' }, responseDays: 30,
    acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'],
    canPitch: true, reason: 'OK', cooldownUntil: null, cooldownLine: null,
    minimums: { feeEngagement: 8000, feeHybrid: null, commission: 12, commissionHybrid: null },
    openPitches: 0, maxOpen: 3, limitLine: 'Your 1st open pitch to this brand · 3 allowed', limitReachedLine: null,
    earliestGoLiveDate: day(7),
  };
  beforeEach(() => { influencerApi.pitchForm.mockResolvedValue(ok({ form: FORM })); });

  const start = async () => {
    const n = nav();
    const r = render(<PitchFormScreen navigation={n} route={{ params: { brandId: 'b1' } }} />);
    await waitFor(() => r.getByTestId('pitch-aim-engagement'));
    fireEvent.press(r.getByTestId('pitch-aim-engagement'));
    fireEvent.changeText(r.getByTestId('pitch-fee'), '12000');
    return { ...r, n };
  };

  it('"What you\'d deliver" starts with Instagram reel, 1; lines are added from the list in place; the pitch is sent with [{ type, count }]', async () => {
    influencerApi.sendPitch.mockResolvedValue(ok({ pitch: { id: 'p1' } }));
    const { getByTestId, getByText, queryByTestId, n } = await start();
    getByText("What you'd deliver");
    getByText('Pitch Urban Threads');                                        // the page's own heading is untouched
    within(getByTestId('pitch-deliverables-row-0-type')).getByText('Instagram reel');
    within(getByTestId('pitch-deliverables-row-0-count-value')).getByText('1');
    within(getByTestId('pitch-deliverables')).getByText(HINT);              // the hint stays here too
    fireEvent.press(getByTestId('pitch-deliverables-add'));
    within(getByTestId('pitch-deliverables-add-reel')).getByText('Added');
    fireEvent.press(getByTestId('pitch-deliverables-add-story'));
    fireEvent.press(getByTestId('pitch-deliverables-row-1-count-plus'));
    expect(queryByTestId('pitch-deliverables-list')).toBeNull();
    fireEvent.press(getByTestId('pitch-next-1'));
    await waitFor(() => getByTestId('pitch-date'));
    fireEvent.press(getByTestId('pitch-mode-shipment'));
    fireEvent(getByTestId('pitch-date'), 'onChange', day(25));
    fireEvent.press(getByTestId('pitch-next-2'));
    await waitFor(() => getByTestId('pitch-review'));
    getByText('1 reel, 2 stories');
    fireEvent.changeText(getByTestId('pitch-message'), 'I shoot ethnic wear every week.');
    fireEvent.press(getByTestId('pitch-send'));
    await waitFor(() => expect(influencerApi.sendPitch).toHaveBeenCalled());
    expect(influencerApi.sendPitch.mock.calls[0][0]).toMatchObject({
      brandId: 'b1', goal: 'engagement', fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }],
    });
    await waitFor(() => expect(n.replace).toHaveBeenCalledWith('MyPitches', { sent: 'p1' }));
  });

  it('with every line removed she cannot go on; the red line goes as soon as one is added', async () => {
    const { getByTestId, getByText, queryByText, queryByTestId } = await start();
    fireEvent.press(getByTestId('pitch-deliverables-row-0-remove'));
    fireEvent.press(getByTestId('pitch-next-1'));
    getByText("Say what you'd deliver.");
    expect(queryByTestId('pitch-date')).toBeNull();
    fireEvent.press(getByTestId('pitch-deliverables-add'));
    fireEvent.press(getByTestId('pitch-deliverables-add-youtube_video'));
    expect(queryByText("Say what you'd deliver.")).toBeNull();
    fireEvent.press(getByTestId('pitch-next-1'));
    await waitFor(() => getByTestId('pitch-date'));
  });

  it('a list that opens under the bottom edge moves the pitch form\'s own page, so the whole list is in view (the D2 caption, on this home)', async () => {
    const r = await start();
    expectPageMovedForOpenedList(r, { page: 'pitch-form-scroll', chooser: 'pitch-deliverables' });
  });
});

/* ───────────────────────────────────── the pitch counter, both apps */

describe('the pitch counter — same rows, and a refusal about them is said on their line', () => {
  const THREAD = {
    pitchId: 'p1', goal: 'engagement',
    brand: { name: 'Urban Threads' }, creator: { id: 'c1', name: 'Tanvi Suresh' },
    negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 2, countersUsed: 0 },
    current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] },
    turns: [], ending: null, can: { counter: true, accept: true, decline: true },
  };
  const openCreator = async () => {
    influencerApi.myPitchThread.mockResolvedValue(ok({ thread: THREAD }));
    const n = nav();
    const r = render(<PitchCounterScreen navigation={n} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('pitch-counter-fee'));
    return { ...r, n };
  };

  it('creator side: one line each, the hint, no locked card and no reuse switch; what is sent is unchanged', async () => {
    influencerApi.counterMyPitch.mockResolvedValue(ok({ thread: THREAD }));
    const { getByTestId, queryByTestId, n } = await openCreator();
    within(getByTestId('pitch-counter-deliverables-row-1-type')).getByText('Instagram story');
    within(getByTestId('pitch-counter-deliverables')).getByText(HINT);
    expect(queryByTestId('locked-terms')).toBeNull();
    expect(queryByTestId('counter-usage-switch')).toBeNull();
    fireEvent.press(getByTestId('pitch-counter-deliverables-row-1-count-minus'));
    within(getByTestId('change-deliverables')).getByText('1 reel, 1 story');
    const field = boxOf(getByTestId('pitch-counter-deliverables'));
    expect(place(field, byId('change-deliverables'))).toBe(place(field, byId('pitch-counter-deliverables')) + 1);
    fireEvent.press(getByTestId('send-pitch-counter'));
    await waitFor(() => expect(influencerApi.counterMyPitch).toHaveBeenCalledWith('p1', {
      commissionPct: null, fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 1 }], scope: undefined, note: undefined,
    }));
    expect(n.replace).toHaveBeenCalledWith('PitchThread', { pitchId: 'p1', toast: 'Counter sent.' });
  });

  it('brand side: the same rows, sent through the brand\'s own call', async () => {
    brandApi.pitchThread.mockResolvedValue(ok({ thread: THREAD }));
    brandApi.counterPitch.mockResolvedValue(ok({ thread: THREAD }));
    const n = nav();
    const { getByTestId } = render(<PitchCounterScreen navigation={n} route={{ params: { pitchId: 'p1', side: 'brand' } }} />);
    await waitFor(() => getByTestId('pitch-counter-fee'));
    fireEvent.press(getByTestId('pitch-counter-deliverables-add'));
    fireEvent.press(getByTestId('pitch-counter-deliverables-add-post'));
    fireEvent.press(getByTestId('send-pitch-counter'));
    await waitFor(() => expect(brandApi.counterPitch).toHaveBeenCalledWith('p1', {
      commissionPct: null, fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }, { type: 'post', count: 1 }], scope: undefined, note: undefined,
    }));
    expect(n.replace).toHaveBeenCalledWith('BrandPitchThread', { pitchId: 'p1', toast: 'Counter sent.' });
  });

  it('a list that opens under the bottom edge moves the pitch counter\'s own page, so the whole list is in view (the D2 caption, on this home) — creator side', async () => {
    const r = await openCreator();
    expectPageMovedForOpenedList(r, { page: 'pitch-counter-scroll', chooser: 'pitch-counter-deliverables' });
  });

  it('…and on the brand side of the same screen', async () => {
    brandApi.pitchThread.mockResolvedValue(ok({ thread: THREAD }));
    const r = render(<PitchCounterScreen navigation={nav()} route={{ params: { pitchId: 'p1', side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('pitch-counter-fee'));
    expectPageMovedForOpenedList(r, { page: 'pitch-counter-scroll', chooser: 'pitch-counter-deliverables' });
  });

  it('adjacent fix: the server\'s refusal about deliverables arrives named "formats_json" and is shown on the deliverables line', async () => {
    // It used to be filed under 'formats_json', which nothing on this screen draws: Send did
    // nothing she could see.
    influencerApi.counterMyPitch.mockResolvedValue(refused('Choose between 1 and 20.', 'formats_json'));
    const { getByTestId, getByText, queryByText, n } = await openCreator();
    fireEvent.changeText(getByTestId('pitch-counter-fee'), '14000');
    fireEvent.press(getByTestId('send-pitch-counter'));
    await waitFor(() => getByText('Choose between 1 and 20.'));
    within(getByTestId('pitch-counter-deliverables')).getByText('Choose between 1 and 20.');
    expect(n.replace).not.toHaveBeenCalled();
    // it goes when she changes the lines
    fireEvent.press(getByTestId('pitch-counter-deliverables-row-1-count-minus'));
    expect(queryByText('Choose between 1 and 20.')).toBeNull();
  });

  it('on a Pay for Sale pitch a refusal about the commission ("commission_pct") is shown, and one about deliverables — which that screen does not draw — is said on the form line', async () => {
    influencerApi.myPitchThread.mockResolvedValue(ok({ thread: { ...THREAD, goal: 'conversion', current: { commissionPct: 12 } } }));
    const { getByTestId, getByText, queryByTestId } = render(<PitchCounterScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => getByTestId('pitch-counter-commission'));
    expect(queryByTestId('pitch-counter-deliverables')).toBeNull();
    influencerApi.counterMyPitch.mockResolvedValueOnce(refused('Commission must be between 0 and 100.', 'commission_pct'));
    fireEvent.changeText(getByTestId('pitch-counter-commission'), '14');
    fireEvent.press(getByTestId('send-pitch-counter'));
    await waitFor(() => getByText('Commission must be between 0 and 100.'));
    influencerApi.counterMyPitch.mockResolvedValueOnce(refused('Add at least one thing she delivers.', 'formats_json'));
    fireEvent.changeText(getByTestId('pitch-counter-commission'), '15');
    fireEvent.press(getByTestId('send-pitch-counter'));
    await waitFor(() => getByText('Add at least one thing she delivers.'));
  });

  it('a refusal about the fee lands under the fee, and one this screen has no line for is said on the form line — never filed where nothing shows it', async () => {
    influencerApi.counterMyPitch.mockResolvedValueOnce(refused('Enter a fee.', 'agreed_fee'));
    const { getByTestId, getByText, queryByText } = await openCreator();
    fireEvent.changeText(getByTestId('pitch-counter-fee'), '14000');
    fireEvent.press(getByTestId('send-pitch-counter'));
    await waitFor(() => getByText('Enter a fee.'));
    expect(within(getByTestId('pitch-counter-deliverables')).queryByText('Enter a fee.')).toBeNull();
    influencerApi.counterMyPitch.mockResolvedValueOnce(refused('This pitch has closed.', 'pitch'));
    fireEvent.changeText(getByTestId('pitch-counter-fee'), '15000');
    fireEvent.press(getByTestId('send-pitch-counter'));
    await waitFor(() => getByText('This pitch has closed.'));
    expect(queryByText('Enter a fee.')).toBeNull();
    // no message at all → the app's own sentence, still out loud
    influencerApi.counterMyPitch.mockResolvedValueOnce({ success: false, error: {} });
    fireEvent.changeText(getByTestId('pitch-counter-fee'), '16000');
    fireEvent.press(getByTestId('send-pitch-counter'));
    await waitFor(() => getByText("Couldn't save. Your changes are still here, so try again."));
    expect(queryByText('This pitch has closed.')).toBeNull();
    expect(influencerApi.counterMyPitch).toHaveBeenCalledTimes(3);
  });
});
