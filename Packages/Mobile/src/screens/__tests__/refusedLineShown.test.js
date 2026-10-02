/**
 * ui-walk-fixes — final review, finding C-3 on the creator's and the shared screens (board C
 * rule 1 + the 17 September lesson: a refusal must appear where the person is looking).
 *
 * With the main button in a strip directly above the keypad, it is pressed while only part of the
 * form is on show. Her counter, the pitch counter (both apps) and "Ask for a change" each draw a
 * refusal under its own box — or on the form line at the very end of the form ("Nothing changed",
 * "Choose what to change", a refusal from the server) — which may be out of sight: the press then
 * seems to do nothing. These three forms now scroll to the first line that was refused, top to
 * bottom, with the helper the pop-ups use (useSheetReveal). The red line stays where it was drawn,
 * nothing is said twice, and a line already on show is not moved.
 *
 * The brand's own forms (New set, Plan the visit, Terms for a creator) are proved in
 * brand/__tests__/item4Brand.test.js and brand/__tests__/refusedBoxShown.test.js.
 *
 * jest has no layout: each test supplies the phone's answers by hand, as popupsAboveKeypad does
 * for the pop-ups. Whether the scroll lands well on a real phone is for the walk.
 */
import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';

jest.mock('../../services/api', () => {
  const fns = (names) => Object.fromEntries(names.map((n) => [n, jest.fn()]));
  return {
    influencerApi: fns(['myThread', 'counterInvitation', 'requestMove', 'myPitchThread', 'counterMyPitch']),
    brandApi: fns(['pitchThread', 'counterPitch']),
    referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
  };
});
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));

const { influencerApi, brandApi } = require('../../services/api');
const CounterScreen = require('../influencer/CounterScreen').default;
const MoveRequestScreen = require('../influencer/MoveRequestScreen').default;
const PitchCounterScreen = require('../shared/PitchCounterScreen').default;
const { MSG5 } = require('../../components/invitations/copy5');
const { MSG6 } = require('../../components/negotiation/copy6');

// React reports a badly built tree (a hook out of order, a clash of keys) only on console.error.
// The clock is fixed so "seven days out" means the same whenever this runs.
let errorSpy;
beforeEach(() => {
  jest.clearAllMocks();
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
const mount = async (ui, ready) => { const r = render(ui); await waitFor(() => r.getByTestId(ready)); return r; };
/** How many things are drawn inside a box (the box itself is not counted). */
const drawnIn = (el) => el.findAll((n) => typeof n.type === 'string').length - 1;

/**
 * The phone's answers, by hand: the form (the ScrollView carrying `scrollId`) starts 80 down the
 * screen, is `room` tall (what is left above the button strip — and above the keypad when it is
 * open) and is scrolled to `scrolledTo`; each named block is { top, height } inside its content.
 * Returns the form's scrollTo, to see where the screen moved itself.
 */
function onAPhone(r, scrollId, { room, scrolledTo = 0, blocks }) {
  const form = r.UNSAFE_getAllByType(ScrollView).find((s) => s.props.testID === scrollId).instance;
  form.getInnerViewRef = () => ({ _nativeTag: 7 });
  form.getNativeScrollRef = () => null;
  form.measureInWindow = (cb) => cb(0, 80, 360, room);
  form.scrollTo = jest.fn();
  for (const [id, { top, height }] of Object.entries(blocks)) {
    const block = r.UNSAFE_getAllByType(View).find((v) => v.props.testID === id).instance;
    block.measureLayout = (relativeTo, done) => done(18, top, 324, height);
    block.measureInWindow = (cb) => cb(18, 80 + top - scrolledTo, 324, height);
  }
  return form.scrollTo;
}

/* ───────────────────────────────────────────────────────────── fixtures */

const HER = { params: { ciId: 'ci1' } };
const THREAD = (over = {}) => ({
  invitationId: 'ci1', goal: 'conversion', status: 'negotiating',
  brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' },
  campaignName: 'Diwali Edit 2026', setName: 'Set A', postingDate: '2026-10-24', cutoff: '2026-10-17', cutoffPassed: false,
  shootMode: 'visit', cityName: 'Hyderabad', switchOn: true,
  negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 3, countersUsed: 1, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { commissionPct: 11.5 }, currentLine: '11.5%',
  turns: [],
  invitation: { terms: { commissionPct: 10 }, termsLine: '10%', sentAt: '2026-09-12T10:00:00Z', scopeWords: 'Anything in the store', offerName: null },
  moveRequest: null, pool: null, ending: null, warnings: [], minimums: { fee: null, commissionPct: null },
  can: { counter: true, accept: true, decline: true, moveRequest: true, moveAnswer: false },
  ...over,
});
const CONTENT_THREAD = (over = {}) => THREAD({
  goal: 'engagement',
  current: { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }], usageRights: null },
  invitation: { terms: { fee: 8000 }, termsLine: '₹8,000', sentAt: '2026-09-12T10:00:00Z', scopeWords: null, offerName: null },
  ...over,
});
const PITCH_THREAD = (over = {}) => ({
  pitchId: 'p1', goal: 'engagement',
  brand: { name: 'Urban Threads' }, creator: { id: 'c1', name: 'Tanvi Suresh' },
  negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 2, countersUsed: 0, noRoundsLeft: false },
  current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] },
  turns: [], ending: null, can: { counter: true, accept: true, decline: true },
  ...over,
});

/* ─────────────────────────────────────────────────────────── her counter */

describe('her counter — "Send counter" refused: the form goes to the first line it refused', () => {
  // Pay for Content, as the styles lay it out: the round pill and the locked card, then the boxes;
  // the form line is the very last thing, under the hint.
  const BLOCKS = {
    'counter-fee-field': { top: 210, height: 130 },
    'counter-deliverables-field': { top: 340, height: 200 },
    'counter-note-field': { top: 640, height: 170 },
    'counter-form-line': { top: 850, height: 23 },
  };
  // Typing "Say why" with the keypad open: 270 of room, the note box in it.
  const TYPING_THE_NOTE = { room: 270, scrolledTo: 540, blocks: BLOCKS };
  const open = async (thread = CONTENT_THREAD()) => {
    influencerApi.myThread.mockResolvedValue(ok({ thread }));
    const n = nav();
    const r = await mount(<CounterScreen navigation={n} route={HER} />, `counter-${thread.goal}`);
    return { r, n };
  };

  it('the fee emptied, pressed while typing the reason: the Fee box and its red line are brought back into view', async () => {
    const { r } = await open();
    fireEvent.changeText(r.getByTestId('counter-fee'), '');
    fireEvent.changeText(r.getByTestId('counter-note'), 'The reel takes a full day.');
    const scrollTo = onAPhone(r, 'counter-scroll', TYPING_THE_NOTE);
    fireEvent.press(r.getByTestId('send-counter'));
    expect(influencerApi.counterInvitation).not.toHaveBeenCalled();
    expect(within(r.getByTestId('counter-fee-field')).getByText(MSG5.FEE_REQUIRED)).toBeTruthy();
    expect(r.getAllByText(MSG5.FEE_REQUIRED)).toHaveLength(1);
    expect(within(r.getByTestId('counter-actions')).queryByText(MSG5.FEE_REQUIRED)).toBeNull();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 204, animated: true });
  });

  it('nothing changed, pressed from the top of the form: the line at the very end of the form comes up', async () => {
    const { r } = await open();
    const scrollTo = onAPhone(r, 'counter-scroll', { room: 270, scrolledTo: 0, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-counter'));
    expect(influencerApi.counterInvitation).not.toHaveBeenCalled();
    expect(within(r.getByTestId('counter-form-line')).getByText(MSG6.NOTHING_CHANGED)).toBeTruthy();
    expect(r.getAllByText(MSG6.NOTHING_CHANGED)).toHaveLength(1);
    // Its bottom edge (and 6 of air) on the form's bottom edge: 850 + 23 + 6 - 270.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 609, animated: true });
  });

  it('Hybrid with the commission emptied and a ₹0 fee: the commission, drawn above the fee, is the one shown', async () => {
    const { r } = await open(THREAD({ goal: 'hybrid', current: { commissionPct: 11.5, fee: 5000 } }));
    fireEvent.changeText(r.getByTestId('counter-commission'), '');
    fireEvent.changeText(r.getByTestId('counter-fee'), '0');
    const scrollTo = onAPhone(r, 'counter-scroll', { room: 270, scrolledTo: 400, blocks: {
      'counter-commission-field': { top: 210, height: 130 },
      'counter-fee-field': { top: 340, height: 130 },
    } });
    fireEvent.press(r.getByTestId('send-counter'));
    expect(within(r.getByTestId('counter-commission-field')).getByText(MSG5.COMMISSION_REQUIRED)).toBeTruthy();
    expect(within(r.getByTestId('counter-fee-field')).getByText(MSG5.HYBRID_FEE)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 204, animated: true });
  });

  it('re-use switched on with no place chosen: that block, drawn only then, is the one shown', async () => {
    const { r } = await open();
    fireEvent(r.getByTestId('counter-usage-switch'), 'valueChange', true);
    const scrollTo = onAPhone(r, 'counter-scroll', { room: 270, scrolledTo: 0, blocks: { ...BLOCKS, 'counter-usage-field': { top: 610, height: 110 } } });
    fireEvent.press(r.getByTestId('send-counter'));
    expect(within(r.getByTestId('counter-usage-field')).getByText(MSG5.USAGE_PLACE)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 456, animated: true });      // 610 + 110 + 6 - 270
  });

  it('a refusal from the server: under the deliverables when it names them, on the form line when it names nothing drawn here — and shown either way', async () => {
    const { r, n } = await open();
    influencerApi.counterInvitation.mockResolvedValueOnce(refused('Choose between 1 and 20.', 'formats_json'));
    fireEvent.changeText(r.getByTestId('counter-fee'), '9000');
    let scrollTo = onAPhone(r, 'counter-scroll', { room: 270, scrolledTo: 0, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => r.getByText('Choose between 1 and 20.'));
    within(r.getByTestId('counter-deliverables-field')).getByText('Choose between 1 and 20.');
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 276, animated: true });       // 340 + 200 + 6 - 270

    influencerApi.counterInvitation.mockResolvedValueOnce(refused('This invitation has closed.', 'invitation'));
    fireEvent.changeText(r.getByTestId('counter-fee'), '9500');
    scrollTo = onAPhone(r, 'counter-scroll', { room: 270, scrolledTo: 0, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => r.getByText('This invitation has closed.'));
    within(r.getByTestId('counter-form-line')).getByText('This invitation has closed.');
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 609, animated: true });
    expect(n.replace).not.toHaveBeenCalled();
  });

  it('keypad closed and the refused box on show: nothing moves; and a good counter is sent with the form left where she had it', async () => {
    influencerApi.counterInvitation.mockResolvedValue(ok({ thread: CONTENT_THREAD() }));
    const { r, n } = await open();
    fireEvent.changeText(r.getByTestId('counter-fee'), '');
    let scrollTo = onAPhone(r, 'counter-scroll', { room: 600, scrolledTo: 0, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-counter'));
    expect(within(r.getByTestId('counter-fee-field')).getByText(MSG5.FEE_REQUIRED)).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.changeText(r.getByTestId('counter-fee'), '9000');
    scrollTo = onAPhone(r, 'counter-scroll', TYPING_THE_NOTE);
    fireEvent.press(r.getByTestId('send-counter'));
    await waitFor(() => expect(n.replace).toHaveBeenCalledWith('Thread', { ciId: 'ci1', toast: 'Counter sent.' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('the boxes are where they were: a marked box is the field\'s own box (or a plain one round it) and adds no space', async () => {
    const { r } = await open();
    expect(flat(r.getByTestId('counter-fee-field'))).toEqual({ marginBottom: 14 });
    expect(flat(r.getByTestId('counter-deliverables-field'))).toEqual({ marginBottom: 14 });
    expect(flat(r.getByTestId('counter-note-field'))).toEqual({});
    expect(flat(r.getByTestId('counter-form-line'))).toEqual({});
    within(r.getByTestId('counter-fee-field')).getByTestId('counter-fee');
    within(r.getByTestId('counter-deliverables-field')).getByTestId('counter-deliverables-add');
    within(r.getByTestId('counter-note-field')).getByTestId('counter-note');
    // Nothing is drawn in the form line until something is said on it.
    expect(drawnIn(r.getByTestId('counter-form-line'))).toBe(0);
    expect(within(r.getByTestId('counter-note-field')).queryByTestId('counter-hint')).toBeNull();
  });
});

/* ─────────────────────────────────────────────────── the pitch counter */

describe('the pitch counter, both apps — "Send counter" refused: the form goes to the first line it refused', () => {
  const BLOCKS = {
    'pitch-counter-fee-field': { top: 58, height: 130 },
    'pitch-counter-deliverables-field': { top: 188, height: 200 },
    'pitch-counter-note-field': { top: 388, height: 170 },
    'pitch-counter-form-line': { top: 598, height: 23 },
  };
  const her = async () => { influencerApi.myPitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD() })); return mount(<PitchCounterScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />, 'pitch-counter-engagement'); };
  const brand = async (n = nav()) => {
    brandApi.pitchThread.mockResolvedValue(ok({ thread: PITCH_THREAD({ negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 0 } }) }));
    return mount(<PitchCounterScreen navigation={n} route={{ params: { pitchId: 'p1', side: 'brand' } }} />, 'pitch-counter-engagement');
  };

  it('her side — the fee emptied, pressed while typing the reason: the Fee box comes back into view', async () => {
    const r = await her();
    fireEvent.changeText(r.getByTestId('pitch-counter-fee'), '');
    const scrollTo = onAPhone(r, 'pitch-counter-scroll', { room: 270, scrolledTo: 300, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-pitch-counter'));
    expect(influencerApi.counterMyPitch).not.toHaveBeenCalled();
    expect(within(r.getByTestId('pitch-counter-fee-field')).getByText(MSG5.FEE_REQUIRED)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 52, animated: true });
  });

  it('the brand\'s side — nothing changed, pressed from the top: the line at the very end of the form comes up', async () => {
    const r = await brand();
    const scrollTo = onAPhone(r, 'pitch-counter-scroll', { room: 270, scrolledTo: 0, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-pitch-counter'));
    expect(brandApi.counterPitch).not.toHaveBeenCalled();
    expect(within(r.getByTestId('pitch-counter-form-line')).getByText(MSG6.NOTHING_CHANGED)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 357, animated: true });       // 598 + 23 + 6 - 270
  });

  it('the brand\'s side — the server refuses the deliverables: said under them and shown; a good counter moves nothing', async () => {
    const n = nav();
    const r = await brand(n);
    brandApi.counterPitch.mockResolvedValueOnce(refused('Choose between 1 and 20.', 'formats_json'));
    fireEvent.changeText(r.getByTestId('pitch-counter-fee'), '10000');
    let scrollTo = onAPhone(r, 'pitch-counter-scroll', { room: 270, scrolledTo: 300, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-pitch-counter'));
    await waitFor(() => r.getByText('Choose between 1 and 20.'));
    within(r.getByTestId('pitch-counter-deliverables-field')).getByText('Choose between 1 and 20.');
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 182, animated: true });

    brandApi.counterPitch.mockResolvedValueOnce(ok({ thread: PITCH_THREAD() }));
    fireEvent.changeText(r.getByTestId('pitch-counter-fee'), '10500');
    scrollTo = onAPhone(r, 'pitch-counter-scroll', { room: 270, scrolledTo: 300, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-pitch-counter'));
    await waitFor(() => expect(n.replace).toHaveBeenCalledWith('BrandPitchThread', { pitchId: 'p1', toast: 'Counter sent.' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('the boxes are where they were', async () => {
    const r = await her();
    expect(flat(r.getByTestId('pitch-counter-fee-field'))).toEqual({ marginBottom: 14 });
    expect(flat(r.getByTestId('pitch-counter-deliverables-field'))).toEqual({ marginBottom: 14 });
    expect(flat(r.getByTestId('pitch-counter-note-field'))).toEqual({});
    expect(flat(r.getByTestId('pitch-counter-form-line'))).toEqual({});
    expect(drawnIn(r.getByTestId('pitch-counter-form-line'))).toBe(0);
    within(r.getByTestId('pitch-counter-deliverables-field')).getByTestId('pitch-counter-delivers-label');
    within(r.getByTestId('pitch-counter-note-field')).getByTestId('pitch-counter-note');
  });
});

/* ──────────────────────────────────────────────────── Ask for a change */

describe('"Ask for a change" — "Send request" refused: the form goes to the line it refused', () => {
  const open = async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD() }));
    const n = nav();
    const r = await mount(<MoveRequestScreen navigation={n} route={HER} />, 'move-request');
    return { r, n };
  };
  // Nothing ticked: the set card, the two choices, the note, the blue box, then the form line.
  const PLAIN = { 'move-note-field': { top: 290, height: 170 }, 'move-form-line': { top: 530, height: 23 } };
  // "A different posting date" ticked: the date box sits between the choices and the note.
  const WITH_DATE = { 'move-date-field': { top: 290, height: 96 }, 'move-note-field': { top: 386, height: 170 }, 'move-form-line': { top: 630, height: 23 } };

  it('nothing ticked, pressed while the top of the form is on show: "Choose what to change" at the very end comes up', async () => {
    const { r } = await open();
    fireEvent.changeText(r.getByTestId('move-note'), 'I am travelling that week.');
    const scrollTo = onAPhone(r, 'move-scroll', { room: 270, scrolledTo: 0, blocks: PLAIN });
    fireEvent.press(r.getByTestId('send-move'));
    expect(influencerApi.requestMove).not.toHaveBeenCalled();
    expect(within(r.getByTestId('move-form-line')).getByText(MSG6.MOVE_NOTHING)).toBeTruthy();
    expect(r.getAllByText(MSG6.MOVE_NOTHING)).toHaveLength(1);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 289, animated: true });       // 530 + 23 + 6 - 270
  });

  it('a new date wanted but none chosen, pressed while typing the reason: the date box comes back into view', async () => {
    const { r } = await open();
    fireEvent.press(r.getByTestId('want-date'));
    const scrollTo = onAPhone(r, 'move-scroll', { room: 270, scrolledTo: 400, blocks: WITH_DATE });
    fireEvent.press(r.getByTestId('send-move'));
    expect(within(r.getByTestId('move-date-field')).getByText(MSG6.MOVE_NOTHING)).toBeTruthy();
    expect(drawnIn(r.getByTestId('move-form-line'))).toBe(0);              // said once, under the date box
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 284, animated: true });
  });

  it('a refusal from the server is said on the form line and shown; a request with nothing wrong is sent and nothing moves', async () => {
    const { r, n } = await open();
    fireEvent.press(r.getByTestId('want-mode'));
    influencerApi.requestMove.mockResolvedValueOnce(refused('This invitation has closed.'));
    let scrollTo = onAPhone(r, 'move-scroll', { room: 270, scrolledTo: 0, blocks: PLAIN });
    fireEvent.press(r.getByTestId('send-move'));
    await waitFor(() => r.getByText('This invitation has closed.'));
    within(r.getByTestId('move-form-line')).getByText('This invitation has closed.');
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 289, animated: true });
    expect(n.replace).not.toHaveBeenCalled();

    influencerApi.requestMove.mockResolvedValueOnce(ok({}));
    scrollTo = onAPhone(r, 'move-scroll', { room: 270, scrolledTo: 0, blocks: PLAIN });
    fireEvent.press(r.getByTestId('send-move'));
    await waitFor(() => expect(n.replace).toHaveBeenCalledWith('Thread', { ciId: 'ci1', toast: expect.any(String) }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('the boxes are where they were', async () => {
    const { r } = await open();
    expect(flat(r.getByTestId('move-note-field'))).toEqual({});
    expect(flat(r.getByTestId('move-form-line'))).toEqual({});
    expect(drawnIn(r.getByTestId('move-form-line'))).toBe(0);
    expect(r.queryByTestId('move-date-field')).toBeNull();
    fireEvent.press(r.getByTestId('want-date'));
    expect(flat(r.getByTestId('move-date-field'))).toEqual({ marginTop: 12 });
    within(r.getByTestId('move-date-field')).getByTestId('move-date');
    within(r.getByTestId('move-note-field')).getByTestId('move-note');
    expect(within(r.getByTestId('move-note-field')).queryByTestId('move-explain')).toBeNull();
  });
});
