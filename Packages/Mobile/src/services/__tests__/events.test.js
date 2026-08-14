/**
 * Slice 0 — the behaviour queue. Contract: features/follower-event-log/
 *
 * The failure this guards is SILENCE. A queue that never flushes, or that
 * throws into a render path, looks identical to a queue that works — right up
 * until someone asks for months of history that was never written. So these
 * tests assert the three promises the queue makes: it batches, it never loses
 * the tail, and it never lets an analytics failure reach the follower.
 */
const mockPostEvents = jest.fn(() => Promise.resolve({ success: true, data: { accepted: 1, skipped: 0 } }));
jest.mock('../api', () => ({ followerApi: { postEvents: (...a) => mockPostEvents(...a) } }));

let appStateHandler = null;
jest.mock('react-native', () => ({
  AppState: { addEventListener: (_e, cb) => { appStateHandler = cb; return { remove: () => {} }; } },
}));

const POST = '11111111-1111-4111-8111-111111111111';

// flush() reads the device id from AsyncStorage before it can send, so the
// request leaves a few microtasks after the trigger. Draining them is a test
// concern only — in the app the send happens on the next tick either way.
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

describe('follower event queue', () => {
  let events;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    appStateHandler = null;
    // eslint-disable-next-line global-require
    events = require('../events');
  });

  afterEach(() => { jest.useRealTimers(); });

  test('a single event does not fire a request — that is the whole point of batching', () => {
    events.track('impression', POST, 'posts_tab', { position: 0 });
    expect(mockPostEvents).not.toHaveBeenCalled();
  });

  test('reaching the batch size flushes immediately', async () => {
    for (let i = 0; i < 20; i++) events.track('impression', POST, 'posts_tab', { position: i });
    await tick();
    expect(mockPostEvents).toHaveBeenCalledTimes(1);
    const body = mockPostEvents.mock.calls[0][0];
    expect(body.events).toHaveLength(20);
    expect(body.session_id).toBeTruthy();
  });

  test('a partial batch still goes out on the timer — a quiet session is not a lost one', async () => {
    events.track('view', POST, 'posts_tab', { dwell_ms: 900 });
    expect(mockPostEvents).not.toHaveBeenCalled();
    jest.advanceTimersByTime(10000);
    await tick();
    expect(mockPostEvents).toHaveBeenCalledTimes(1);
    expect(mockPostEvents.mock.calls[0][0].events).toHaveLength(1);
  });

  test('backgrounding the app flushes the tail', async () => {
    events.track('tap_shop', POST, 'posts_tab');
    expect(appStateHandler).toBeInstanceOf(Function);
    appStateHandler('background');
    await tick();
    expect(mockPostEvents).toHaveBeenCalledTimes(1);
  });

  test('a network failure is swallowed — analytics must never surface an error', async () => {
    mockPostEvents.mockRejectedValueOnce(new Error('offline'));
    events.track('impression', POST, 'posts_tab');
    await expect(events.flush()).resolves.toBeUndefined();
  });

  test('a failed batch is dropped, not retried forever', async () => {
    mockPostEvents.mockRejectedValueOnce(new Error('offline'));
    events.track('impression', POST, 'posts_tab');
    await events.flush();
    mockPostEvents.mockClear();
    // Nothing left buffered → a second flush sends nothing. A re-queue here
    // would grow without bound against a failing server.
    await events.flush();
    expect(mockPostEvents).not.toHaveBeenCalled();
  });

  test('events queued during a flush are not swallowed by the clear', async () => {
    let release;
    mockPostEvents.mockImplementationOnce(() => new Promise(r => { release = r; }));
    events.track('impression', POST, 'posts_tab');
    const inFlight = events.flush();
    await tick();
    events.track('view', POST, 'posts_tab', { dwell_ms: 500 });
    release({ success: true });
    await inFlight;

    mockPostEvents.mockClear();
    await events.flush();
    await tick();
    expect(mockPostEvents).toHaveBeenCalledTimes(1);
    expect(mockPostEvents.mock.calls[0][0].events[0].event_type).toBe('view');
  });

  test('an incomplete event is ignored rather than sent as junk', () => {
    events.track('impression', null, 'posts_tab');
    events.track(null, POST, 'posts_tab');
    events.track('impression', POST, null);
    jest.advanceTimersByTime(10000);
    expect(mockPostEvents).not.toHaveBeenCalled();
  });

  test('impressions de-dupe per screen mount — scrolling back does not double-count', async () => {
    const note = events.makeImpressionTracker('posts_tab');
    note(POST, 0); note(POST, 0); note(POST, 3);
    jest.advanceTimersByTime(10000);
    await tick();
    expect(mockPostEvents).toHaveBeenCalledTimes(1);
    expect(mockPostEvents.mock.calls[0][0].events).toHaveLength(1);
  });

  test('dwell is normalised to whole non-negative ms for an integer column', async () => {
    events.track('view', POST, 'posts_tab', { dwell_ms: 1200.7 });
    events.track('view', POST, 'posts_tab', { dwell_ms: -50 });
    jest.advanceTimersByTime(10000);
    await tick();
    const sent = mockPostEvents.mock.calls[0][0].events;
    expect(sent[0].dwell_ms).toBe(1201);
    expect(sent[1].dwell_ms).toBe(0);
  });
});
