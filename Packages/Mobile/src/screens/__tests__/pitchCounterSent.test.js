/**
 * ui-walk-fixes — closing pass (K2): a counter on a pitch says "Counter sent."
 * Contract: features/ui-walk-fixes · drift/K2.md
 *
 * The counter screen has always ended by putting the conversation in its place and handing it a
 * message — replace('PitchThread' | 'BrandPitchThread', { pitchId, toast: 'Counter sent.' }) — and
 * the conversation never read it. The counter went, and the screen said nothing.
 *
 * What these tests hold the app to, on BOTH apps' route names:
 *   · "Send counter" hands the message to the route that app's navigator really registers;
 *   · the conversation takes the message on arrival and shows it once the thread is drawn — the
 *     same way item 6's conversation (ThreadScreen) does after its own counter;
 *   · it is shown once (the route is told to forget it), and goes by itself;
 *   · a conversation opened the ordinary way says nothing.
 *
 * Not held here (the same on every screen that is replaced and handed a message — Thread,
 * ShootThread, BrandShoot): the message is drawn with the thread, not over the loading skeleton,
 * and it lasts 2.6 seconds from arrival. A thread that takes longer than that to load shows none.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, fireEvent, waitFor, within, act } from '@testing-library/react-native';

jest.mock('../../services/api', () => ({
  influencerApi: {
    myPitchThread: jest.fn(), myPitch: jest.fn(), counterMyPitch: jest.fn(),
    acceptMyPitch: jest.fn(), declineMyPitch: jest.fn(),
  },
  brandApi: {
    pitchThread: jest.fn(), pitch: jest.fn(), counterPitch: jest.fn(),
    acceptPitch: jest.fn(), rejectPitch: jest.fn(),
  },
  referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi, brandApi } = require('../../services/api');
const PitchCounterScreen = require('../shared/PitchCounterScreen').default;
const PitchThreadScreen = require('../shared/PitchThreadScreen').default;
const { C6 } = require('../../components/negotiation/copy6');

// React reports most mistakes in how a tree is put together through console.error and carries on;
// every test here must leave it silent. A toast fades in and out on timers, so the timers are jest's.
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

/** The conversation as each side's own call returns it; `whoseMove` says who is being waited for. */
const THREAD = (whoseMove) => ({
  pitchId: 'p1', goal: 'engagement',
  brand: { name: 'Stride Kicks' }, creator: { id: 'c1', name: 'Tanvi Suresh' },
  negotiation: { id: 'n1', open: true, whoseMove, roundLimit: 2, countersUsed: 1, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }] },
  turns: [{ id: 't0', by: 'influencer', mine: whoseMove === 'brand', at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { fee: 12000 }, changes: [], note: null }],
  ending: null, can: { counter: true, accept: true, decline: true },
});
const PITCH = { id: 'p1', creator: { id: 'c1', name: 'Tanvi Suresh' }, goal: 'engagement', terms: { fee: 12000 }, can: {} };

/**
 * The two apps. Each has its own route name for the conversation, its own calls, and — on the
 * brand's — a wrapper in the navigator that tells the shared screen which side it is.
 */
const APPS = [
  {
    app: "the creator's app", me: 'influencer', them: 'brand', routeName: 'PitchThread', side: undefined,
    counterParams: { pitchId: 'p1' },
    thread: influencerApi.myPitchThread, pitch: influencerApi.myPitch, counter: influencerApi.counterMyPitch,
    navigator: 'InfluencerNavigator.js',
    registered: /<CollabsStack\.Screen name="PitchThread" component=\{PitchThreadScreen\} \/>/,
  },
  {
    app: "the brand's app", me: 'brand', them: 'influencer', routeName: 'BrandPitchThread', side: 'brand',
    counterParams: { pitchId: 'p1', side: 'brand' },
    thread: brandApi.pitchThread, pitch: brandApi.pitch, counter: brandApi.counterPitch,
    navigator: 'BrandNavigator.js',
    registered: /<CreatorsStack\.Screen name="BrandPitchThread" component=\{BrandPitchThreadScreen\} \/>/,
  },
];

it('the words', () => {
  expect(C6.counter.sent).toBe('Counter sent.');
});

describe.each(APPS)('a counter on a pitch says so — $app ($routeName)', (a) => {
  const threadProps = a.side ? { side: a.side } : {};

  /** Send a counter from the counter screen and return what it replaced itself with. */
  async function sendCounter() {
    a.thread.mockResolvedValue(ok({ thread: THREAD(a.me) }));
    a.counter.mockResolvedValue(ok({ thread: THREAD(a.them) }));
    const n = nav();
    const r = render(<PitchCounterScreen navigation={n} route={{ params: a.counterParams }} />);
    await waitFor(() => r.getByTestId('pitch-counter-fee'));
    fireEvent.changeText(r.getByTestId('pitch-counter-fee'), '14000');
    fireEvent.press(r.getByTestId('send-pitch-counter'));
    await waitFor(() => expect(n.replace).toHaveBeenCalledTimes(1));
    r.unmount();
    const [name, params] = n.replace.mock.calls[0];
    return { name, params };
  }

  it('"Send counter" puts the conversation in its place and hands it "Counter sent." — under the name this app registers', async () => {
    const landed = await sendCounter();
    expect(landed).toEqual({ name: a.routeName, params: { pitchId: 'p1', toast: 'Counter sent.' } });
    expect(a.counter).toHaveBeenCalledWith('p1', expect.objectContaining({ fee: 14000 }));
    // The name is a real screen in this app's navigator, and it is the shared conversation screen.
    const src = fs.readFileSync(path.join(__dirname, '../../navigation', a.navigator), 'utf8');
    expect(src).toMatch(a.registered);
    if (a.side) expect(src).toMatch(/const BrandPitchThreadScreen = \(props\) => <PitchThreadScreen \{\.\.\.props\} side="brand" \/>;/);
  });

  it('the conversation it lands on says "Counter sent." once the thread is drawn; and it is said once', async () => {
    const landed = await sendCounter();
    // What the server has now: the other side is being waited for.
    a.thread.mockResolvedValue(ok({ thread: THREAD(a.them) }));
    a.pitch.mockResolvedValue(ok({ pitch: PITCH }));
    const n = nav();
    const r = render(<PitchThreadScreen navigation={n} route={{ key: `${landed.name}-9`, name: landed.name, params: landed.params }} {...threadProps} />);
    await waitFor(() => r.getByTestId('pitch-thread-waiting'));
    within(r.getByTestId('toast')).getByText('Counter sent.');
    expect(r.queryByTestId('pitch-thread-actions')).toBeNull();           // nothing of hers to press: it is their move
    expect(n.setParams).toHaveBeenCalledTimes(1);
    expect(n.setParams).toHaveBeenCalledWith({ toast: undefined });       // not said again on the next visit
  });

  it('the message is taken on arrival, while the thread is still on its way, and is on show when it arrives', async () => {
    let answer;
    a.thread.mockReturnValue(new Promise((res) => { answer = res; }));
    a.pitch.mockResolvedValue(ok({ pitch: PITCH }));
    const n = nav();
    const r = render(<PitchThreadScreen navigation={n} route={{ name: a.routeName, params: { pitchId: 'p1', toast: 'Counter sent.' } }} {...threadProps} />);
    r.getByTestId('skeleton');
    expect(n.setParams).toHaveBeenCalledWith({ toast: undefined });       // taken at once, not when the thread lands
    act(() => { jest.advanceTimersByTime(1000); });                       // a second on the network
    await act(async () => { answer(ok({ thread: THREAD(a.them) })); });
    await waitFor(() => r.getByTestId('pitch-thread-waiting'));
    within(r.getByTestId('toast')).getByText('Counter sent.');
  });

  it('once the route has forgotten the message it is not said again; and it goes by itself', async () => {
    a.thread.mockResolvedValue(ok({ thread: THREAD(a.them) }));
    a.pitch.mockResolvedValue(ok({ pitch: PITCH }));
    const n = nav();
    const r = render(<PitchThreadScreen navigation={n} route={{ name: a.routeName, params: { pitchId: 'p1', toast: 'Counter sent.' } }} {...threadProps} />);
    await waitFor(() => r.getByTestId('pitch-thread-waiting'));
    within(r.getByTestId('toast')).getByText('Counter sent.');
    // What navigation.setParams({ toast: undefined }) does to the route.
    r.rerender(<PitchThreadScreen navigation={n} route={{ name: a.routeName, params: { pitchId: 'p1', toast: undefined } }} {...threadProps} />);
    expect(n.setParams).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(4000); });
    expect(r.queryByTestId('toast')).toBeNull();
    expect(r.queryByText('Counter sent.')).toBeNull();
    r.getByTestId('pitch-thread-waiting');                                // the conversation is still there
  });

  it('opened the ordinary way it says nothing — loading, and drawn', async () => {
    a.thread.mockResolvedValue(ok({ thread: THREAD(a.me) }));
    a.pitch.mockResolvedValue(ok({ pitch: PITCH }));
    const n = nav();
    const r = render(<PitchThreadScreen navigation={n} route={{ name: a.routeName, params: { pitchId: 'p1' } }} {...threadProps} />);
    r.getByTestId('skeleton');
    expect(r.queryByTestId('toast')).toBeNull();
    await waitFor(() => r.getByTestId('pitch-thread-actions'));
    expect(r.queryByTestId('toast')).toBeNull();
    expect(r.queryByText('Counter sent.')).toBeNull();
    expect(n.setParams).not.toHaveBeenCalled();
  });
});
