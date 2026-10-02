/**
 * ui-walk-fixes D3 — a pushed screen has no bottom tabs, so it must carry its own way back.
 *
 * Until this change the bottom tabs were on every screen, and five screens leaned on that: the
 * pitch form, her pitches list, one of her pitches, the brand's pitches list and one pitch as the
 * brand reads it drew no title bar and no back arrow. With the tabs gone from pushed screens they
 * would have had nothing to tap to leave. They now draw the shared title bar, in every state.
 *
 * Two layers:
 *   1. a guard over BOTH navigators — every screen registered in a tab's stack, other than the
 *      stack's first (the main page), draws the shared Header with a back handler or its own
 *      pressable "Back". A screen added later without one turns this red.
 *   2. the five screens rendered in each of their states (loading, failed, blocked / empty,
 *      loaded): the Back control is there and it goes back. And the two lists, drawn as a segment
 *      inside a main page, do NOT grow a second title bar.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../services/api', () => ({
  influencerApi: { pitchForm: jest.fn(), sendPitch: jest.fn(), myPitches: jest.fn(), myPitch: jest.fn(), withdrawPitch: jest.fn() },
  brandApi: { pitchInbox: jest.fn(), pitch: jest.fn(), acceptPitch: jest.fn(), rejectPitch: jest.fn() },
  referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi, brandApi } = require('../../services/api');

const NAV_DIR = path.resolve(__dirname, '..');

/* ───────────────────────────────── 1 · the guard over both navigators */

/** Every screen a navigator registers: { stack, name, component, file } in the order written. */
function registered(file) {
  const src = fs.readFileSync(path.join(NAV_DIR, file), 'utf8');
  const fileOf = {};
  for (const m of src.matchAll(/import\s+([A-Za-z0-9_]+)?\s*,?\s*(?:\{([^}]+)\})?\s+from\s+'(\.\.\/screens\/[^']+)'/g)) {
    const abs = path.resolve(NAV_DIR, `${m[3]}.js`);
    if (m[1]) fileOf[m[1]] = abs;
    for (const name of (m[2] || '').split(',').map((x) => x.trim()).filter(Boolean)) fileOf[name] = abs;
  }
  // a screen that is one line around another (the brand's side of a shared screen)
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\(props\)\s*=>\s*<(\w+)\b/g)) fileOf[m[1]] = fileOf[m[2]];
  const out = [];
  for (const m of src.matchAll(/<(\w+)Stack\.Screen name="(\w+)" component=\{(\w+)\}/g)) {
    out.push({ stack: m[1], name: m[2], component: m[3], file: fileOf[m[3]] });
  }
  return out;
}

const HAS_SHARED_BAR = /<Header\b[^>]*\bonBack=/;
// The agreement screens and the legal list draw their own bar: a touchable that goes back.
const HAS_OWN_BACK = /<(TouchableOpacity|Pressable)\b[^>]*onPress=\{\(\)\s*=>\s*\w+\.goBack\(\)\}/;

describe.each(['BrandNavigator.js', 'InfluencerNavigator.js'])('%s — every pushed screen has a way back', (file) => {
  const screens = registered(file);
  const firstOf = {};
  for (const sc of screens) if (!(sc.stack in firstOf)) firstOf[sc.stack] = sc.name;
  const pushed = screens.filter((sc) => sc.name !== firstOf[sc.stack]);

  it('the scan found the stacks, the main pages and the pushed screens', () => {
    expect(Object.keys(firstOf)).toHaveLength(4);
    expect(pushed.length).toBeGreaterThan(40);
    // every registered component was traced to its file
    expect(screens.filter((sc) => !sc.file || !fs.existsSync(sc.file)).map((sc) => sc.name)).toEqual([]);
  });

  it('each one draws the shared title bar with a back handler, or its own pressable "Back"', () => {
    const none = [];
    for (const sc of pushed) {
      const src = fs.readFileSync(sc.file, 'utf8');
      if (!HAS_SHARED_BAR.test(src) && !HAS_OWN_BACK.test(src)) none.push(`${sc.stack} › ${sc.name} (${path.basename(sc.file)})`);
    }
    expect(none).toEqual([]);
  });

  it('a screen that returns early while loading or failed draws the bar there too — no bare early return', () => {
    // The shape the five pitch screens had: `return <View style={s.page}><Skeleton … /></View>`.
    const bare = [];
    for (const sc of pushed) {
      fs.readFileSync(sc.file, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*if \(status === '(loading|error)'\) return <View[^>]*>\s*<(Skeleton|LoadError)\b/.test(line)) {
          bare.push(`${path.basename(sc.file)}:${i + 1}`);
        }
      });
    }
    expect([...new Set(bare)]).toEqual([]);
  });
});

/* ───────────────────────────────── 2 · the five screens, state by state */

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const fail = { success: false, error: { code: 'INTERNAL_ERROR', message: 'no' } };
const never = () => new Promise(() => {});
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/** The Back control is on screen, alone, and pressing it goes back — and nothing else. */
function expectBack(r, n) {
  const backs = r.getAllByLabelText('Back');
  expect(backs).toHaveLength(1);
  expect(n.goBack).not.toHaveBeenCalled();
  fireEvent.press(backs[0]);
  expect(n.goBack).toHaveBeenCalledTimes(1);
  expect(n.navigate).not.toHaveBeenCalled();
}

const FORM = {
  brand: { id: 'b1', name: 'Stride Kicks' }, responseDays: 30,
  acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'],
  canPitch: true, reason: 'OK', cooldownUntil: null, cooldownLine: null,
  minimums: { feeEngagement: 8000, feeHybrid: null, commission: 12, commissionHybrid: null },
  openPitches: 0, maxOpen: 3, limitLine: 'Your 1st open pitch to this brand · 3 allowed', limitReachedLine: null,
  earliestGoLiveDate: day(7),
};
const MINE = (over = {}) => ({
  id: 'p1', brand: { id: 'b1', name: 'Stride Kicks' },
  goal: 'engagement', aimLabel: 'Pay for Content', termsLine: '₹12,000 · 1 reel, 2 stories',
  terms: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }] },
  proposedGoLiveDate: day(25), shootMode: 'shipment', modeLabel: 'Remote', message: 'Hello.',
  sentAt: new Date().toISOString(), group: 'waiting', daysLeft: 24, line: 'They have until 9 Oct · 24 days left',
  cooldownUntil: null, cooldownLine: null, negotiation: null, ...over,
});
const myList = (rows) => ({ rows, total: rows.length, groups: { waiting: rows, agreed: [], ended: [] } });
const THEIRS = (over = {}) => ({
  id: 'p1', creator: { id: 'c1', name: 'Tanvi Suresh', handle: 'tanvi', niche: 'Lifestyle', city: 'Bengaluru' },
  numbers: { instagramFollowers: 48200, youtubeSubscribers: 12400, engagement: 5.1 },
  goal: 'engagement', aimLabel: 'Pay for Content', termsLine: '₹12,000 · 1 reel, 2 stories',
  terms: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }] },
  proposedGoLiveDate: day(25), shootMode: 'shipment', modeLabel: 'Remote', message: 'Hello.',
  sentAt: new Date().toISOString(), agedDays: '2 days ago', unread: true, group: 'waiting', daysLeft: 28,
  replyBy: 'Reply by 14 Oct · 28 days left', negotiation: null,
  can: { accept: true, counter: true, reject: true }, ...over,
});
const inbox = (rows) => ({ groups: { new: { key: 'new', title: 'New', count: rows.length, rows }, talking: { key: 'talking', title: 'Talking', count: 0, rows: [] } }, order: ['new', 'talking'], total: rows.length, unread: rows.length });

beforeEach(() => { jest.clearAllMocks(); });

describe('creator · the pitch form (PitchForm)', () => {
  const PitchFormScreen = require('../../screens/influencer/PitchFormScreen').default;
  const route = { params: { brandId: 'b1', brandName: 'Stride Kicks' } };

  it('while loading: the bar with the brand\'s name and Back', () => {
    influencerApi.pitchForm.mockImplementation(never);
    const n = nav();
    const r = render(<PitchFormScreen navigation={n} route={route} />);
    r.getByText('Stride Kicks');
    expectBack(r, n);
  });

  it('when it could not load: Back, beside Try again', async () => {
    influencerApi.pitchForm.mockResolvedValue(fail);
    const n = nav();
    const r = render(<PitchFormScreen navigation={n} route={route} />);
    await waitFor(() => r.getByText('Stride Kicks'));
    await waitFor(() => expect(influencerApi.pitchForm).toHaveBeenCalled());
    expectBack(r, n);
  });

  it.each([
    ['on cooldown', { canPitch: false, reason: 'COOLDOWN', cooldownLine: 'You can pitch Stride Kicks again after 27 Sep.' }, 'You can pitch Stride Kicks again after 27 Sep.'],
    ['the brand is not taking pitches', { canPitch: false, reason: 'NOT_ACCEPTING' }, "Stride Kicks aren't taking pitches right now."],
    ['at the limit', { canPitch: false, reason: 'LIMIT', limitReachedLine: 'You have 3 open pitches with Stride Kicks, which is the most allowed.' }, 'You have 3 open pitches with Stride Kicks, which is the most allowed.'],
  ])('blocked (%s): the one sentence, and Back — it used to be a page with nothing to tap', async (_label, over, sentence) => {
    influencerApi.pitchForm.mockResolvedValue(ok({ form: { ...FORM, ...over } }));
    const n = nav();
    const r = render(<PitchFormScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-form-blocked'));
    r.getByText(sentence);
    expectBack(r, n);
  });

  it('the form itself: Back in the bar, and the page\'s own heading unchanged under it', async () => {
    influencerApi.pitchForm.mockResolvedValue(ok({ form: FORM }));
    const n = nav();
    const r = render(<PitchFormScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-form-title'));
    expect(r.getByTestId('pitch-form-title').props.children).toBe('Pitch Stride Kicks');
    r.getByText('Stride Kicks');          // the bar
    r.getByTestId('pitch-next-1');
    expectBack(r, n);
  });
});

describe('creator · her pitches (MyPitches)', () => {
  const MyPitchesScreen = require('../../screens/influencer/MyPitchesScreen').default;
  const route = { key: 'MyPitches-1', name: 'MyPitches', params: { sent: 'p1' } };

  it('opened as its own screen (where she lands after sending): "Pitches" and Back, in every state', async () => {
    influencerApi.myPitches.mockImplementation(never);
    let n = nav();
    let r = render(<MyPitchesScreen navigation={n} route={route} />);
    r.getByText('Pitches');
    expectBack(r, n);
    r.unmount();

    influencerApi.myPitches.mockResolvedValue(fail);
    n = nav();
    r = render(<MyPitchesScreen navigation={n} route={route} />);
    await waitFor(() => expect(influencerApi.myPitches).toHaveBeenCalled());
    await waitFor(() => r.getByText('Pitches'));
    expectBack(r, n);
    r.unmount();

    influencerApi.myPitches.mockResolvedValue(ok(myList([])));
    n = nav();
    r = render(<MyPitchesScreen navigation={n} route={route} />);
    await waitFor(() => r.getByText('No pitches yet'));
    r.getByText('Pitches');
    expectBack(r, n);
    r.unmount();

    influencerApi.myPitches.mockResolvedValue(ok(myList([MINE()])));
    n = nav();
    r = render(<MyPitchesScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitches-waiting'));
    r.getByText('Pitches');
    expectBack(r, n);
  });

  it('drawn as the Pitches segment inside Collabs (no route): no second title bar, no Back', async () => {
    influencerApi.myPitches.mockResolvedValue(ok(myList([MINE()])));
    const r = render(<MyPitchesScreen navigation={nav()} />);
    expect(r.queryByLabelText('Back')).toBeNull();
    await waitFor(() => r.getByTestId('pitches-waiting'));
    expect(r.queryByLabelText('Back')).toBeNull();
    expect(r.queryByText('Pitches')).toBeNull();
  });
});

describe('creator · one of her pitches (MyPitch)', () => {
  const MyPitchScreen = require('../../screens/influencer/MyPitchScreen').default;
  const route = { params: { pitchId: 'p1' } };

  it('Back while loading, when it failed, and on the pitch — where the bar names the brand', async () => {
    influencerApi.myPitch.mockImplementation(never);
    let n = nav();
    let r = render(<MyPitchScreen navigation={n} route={route} />);
    expectBack(r, n);
    r.unmount();

    influencerApi.myPitch.mockResolvedValue(fail);
    n = nav();
    r = render(<MyPitchScreen navigation={n} route={route} />);
    await waitFor(() => expect(influencerApi.myPitch).toHaveBeenCalled());
    await waitFor(() => r.getByLabelText('Back'));
    expectBack(r, n);
    r.unmount();

    influencerApi.myPitch.mockResolvedValue(ok({ pitch: MINE() }));
    n = nav();
    r = render(<MyPitchScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('my-pitch-terms'));
    // the bar and the page's own heading
    expect(r.getAllByText('Stride Kicks')).toHaveLength(2);
    r.getByTestId('my-pitch-withdraw');
    expectBack(r, n);
  });
});

describe('brand · the pitches list (BrandPitches)', () => {
  const BrandPitchesScreen = require('../../screens/brand/BrandPitchesScreen').default;
  const route = { key: 'BrandPitches-1', name: 'BrandPitches' };

  it('opened as its own screen: "Pitches" and Back, in every state', async () => {
    brandApi.pitchInbox.mockImplementation(never);
    let n = nav();
    let r = render(<BrandPitchesScreen navigation={n} route={route} />);
    r.getByText('Pitches');
    expectBack(r, n);
    r.unmount();

    brandApi.pitchInbox.mockResolvedValue(fail);
    n = nav();
    r = render(<BrandPitchesScreen navigation={n} route={route} />);
    await waitFor(() => expect(brandApi.pitchInbox).toHaveBeenCalled());
    await waitFor(() => r.getByText('Pitches'));
    expectBack(r, n);
    r.unmount();

    brandApi.pitchInbox.mockResolvedValue(ok(inbox([])));
    n = nav();
    r = render(<BrandPitchesScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-inbox-empty'));
    expectBack(r, n);
    r.unmount();

    brandApi.pitchInbox.mockResolvedValue(ok(inbox([THEIRS()])));
    n = nav();
    r = render(<BrandPitchesScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-group-new'));
    r.getByText('Pitches');
    expectBack(r, n);
  });

  it('drawn as the Pitches segment inside Creators (no route): no second title bar, no Back', async () => {
    brandApi.pitchInbox.mockResolvedValue(ok(inbox([THEIRS()])));
    const r = render(<BrandPitchesScreen navigation={nav()} />);
    expect(r.queryByLabelText('Back')).toBeNull();
    await waitFor(() => r.getByTestId('pitch-group-new'));
    expect(r.queryByLabelText('Back')).toBeNull();
    expect(r.queryByText('Pitches')).toBeNull();
  });
});

describe('brand · one pitch (BrandPitch)', () => {
  const BrandPitchScreen = require('../../screens/brand/BrandPitchScreen').default;
  const route = { params: { pitchId: 'p1' } };

  it('Back while loading, when it failed, and on the pitch — where the bar names the creator', async () => {
    brandApi.pitch.mockImplementation(never);
    let n = nav();
    let r = render(<BrandPitchScreen navigation={n} route={route} />);
    expectBack(r, n);
    r.unmount();

    brandApi.pitch.mockResolvedValue(fail);
    n = nav();
    r = render(<BrandPitchScreen navigation={n} route={route} />);
    await waitFor(() => expect(brandApi.pitch).toHaveBeenCalled());
    await waitFor(() => r.getByLabelText('Back'));
    expectBack(r, n);
    r.unmount();

    brandApi.pitch.mockResolvedValue(ok({ pitch: THEIRS() }));
    n = nav();
    r = render(<BrandPitchScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-terms'));
    expect(r.getByTestId('pitch-creator-name').props.children).toBe('Tanvi Suresh');
    expect(r.getAllByText('Tanvi Suresh')).toHaveLength(2);
    expectBack(r, n);
  });

  it('after Accept she is taken to the pool with the Campaigns page under it; this screen, left behind on the Creators tab, still has its Back', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: THEIRS({ acceptBody: 'x' }) }));
    brandApi.acceptPitch.mockResolvedValue(ok({ pitch: THEIRS(), poolEntryId: 'e1' }));
    const n = nav();
    const r = render(<BrandPitchScreen navigation={n} route={route} />);
    await waitFor(() => r.getByTestId('pitch-accept'));
    fireEvent.press(r.getByTestId('pitch-accept'));
    fireEvent.press(r.getByTestId('accept-confirm'));
    // ASSERTION DRIFT — ui-walk-fixes board F, frame F8 (drift/F.md): the jump also carries the
    // message the pool shows ("Tanvi is in your pool."). Where it goes is unchanged.
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandPool', params: { highlight: 'e1', toast: 'Tanvi is in your pool.' }, initial: false }));
    expect(r.getAllByLabelText('Back')).toHaveLength(1);
    fireEvent.press(r.getByLabelText('Back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });
});
