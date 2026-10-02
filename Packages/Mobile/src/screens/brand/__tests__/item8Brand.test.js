/**
 * Item 8 — the brand app: T5 the pitches list, T6 one pitch, T7 accepting,
 * T8 rejecting, T11 the provenance tag on the pool.
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * The sentence this suite exists to hold in place: **accepting agrees the money
 * and does not start a collaboration.** It is on the accept sheet, in those
 * words, before the tap — not in a help page and not discovered afterwards.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    pitchInbox: jest.fn(), pitch: jest.fn(), acceptPitch: jest.fn(), rejectPitch: jest.fn(),
    pitchThread: jest.fn(), counterPitch: jest.fn(),
  },
  influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../../services/api');
const BrandPitchesScreen = require('../BrandPitchesScreen').default;
const BrandPitchScreen = require('../BrandPitchScreen').default;
const { PitchCard8, MiniStat8 } = require('../../../components/pitch/bits8');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const CARD = (over = {}) => ({
  id: 'p1',
  creator: { id: 'c1', name: 'Tanvi Suresh', handle: 'tanvi', niche: 'Lifestyle', city: 'Bengaluru' },
  numbers: { instagramFollowers: 48200, youtubeSubscribers: 12400, engagement: 5.1 },
  goal: 'engagement', aimLabel: 'Pay for Content', termsLine: '₹12,000 · 1 reel, 2 stories',
  terms: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] },
  proposedGoLiveDate: day(25), shootMode: 'shipment', modeLabel: 'Remote',
  message: 'I have been running in your shoes for two years.',
  sentAt: new Date().toISOString(), agedDays: '2 days ago', unread: true, group: 'waiting',
  responseDueAt: new Date(Date.now() + 28 * 86400000).toISOString(), daysLeft: 28,
  replyBy: 'Reply by 14 Oct · 28 days left', negotiation: null,
  ...over,
});
const DETAIL = (over = {}) => ({
  ...CARD(over),
  can: { accept: true, counter: true, reject: true },
  cooldownDays: 30,
  cooldownWouldEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
  rejectCooldownLine: "Tanvi won't be able to pitch you again until 15 Oct. You can still invite her from Creators at any time.",
  rejectBlockHint: "If you'd rather never hear from her, block her in Pitch settings instead.",
  acceptBody: 'She\'ll be waiting under "Agreed, needs a set" on your Campaigns tab. Build a set for 28 Oct when you\'re ready and she\'ll get an invitation with these terms filled in. She signs the agreement then.',
});

const inbox = (rows, talking = []) => ({
  groups: {
    new: { key: 'new', title: 'New', count: rows.length, rows },
    talking: { key: 'talking', title: 'Talking', count: talking.length, rows: talking },
  },
  order: ['new', 'talking'],
  total: rows.length + talking.length,
  unread: rows.filter(r => r.unread).length,
});

/* ─────────────────────────────────────────────────────── T5 · the list */

describe('T5 — the pitches list', () => {
  it('her numbers are on the card, grouped by whose move it is', async () => {
    brandApi.pitchInbox.mockResolvedValue(ok(inbox(
      [CARD()],
      [CARD({ id: 'p2', creator: { id: 'c2', name: 'Divya R.' }, unread: false, negotiation: { id: 'n1', open: true, whoseMove: 'influencer' } })]
    )));
    const { getByTestId, getByText, getAllByText, getAllByTestId } = render(<BrandPitchesScreen navigation={nav()} />);
    await waitFor(() => getByTestId('pitch-group-new'));
    getByText('New'); getByText('Talking');
    // Both cards carry her numbers — that is the point of T5.
    expect(getAllByText('48.2K').length).toBeGreaterThan(0);
    expect(getAllByText('12.4K').length).toBeGreaterThan(0);
    expect(getAllByText('5.1%').length).toBeGreaterThan(0);
    expect(getAllByText('Reply by 14 Oct · 28 days left').length).toBe(2);
    // Only the unanswered one wears the unread dot.
    expect(getAllByTestId('pitch-unread').length).toBe(1);
  });

  it('a creator nobody has measured shows a dash, never a zero', async () => {
    brandApi.pitchInbox.mockResolvedValue(ok(inbox([
      CARD({ numbers: { instagramFollowers: null, youtubeSubscribers: null, engagement: null } }),
    ])));
    const { getAllByText, getByTestId } = render(<BrandPitchesScreen navigation={nav()} />);
    await waitFor(() => getByTestId('pitch-group-new'));
    expect(getAllByText('—').length).toBe(3);
  });

  it('an empty inbox explains how to get more, rather than saying nothing', async () => {
    brandApi.pitchInbox.mockResolvedValue(ok(inbox([])));
    const { getByTestId, getByText } = render(<BrandPitchesScreen navigation={nav()} />);
    await waitFor(() => getByTestId('pitch-inbox-empty'));
    getByText(/Turn pitches on in Pitch settings/);
  });

  it('a pitch being talked about opens the thread, not the pitch', async () => {
    const n = nav();
    brandApi.pitchInbox.mockResolvedValue(ok(inbox([], [
      CARD({ id: 'p2', unread: false, negotiation: { id: 'n1', open: true, whoseMove: 'brand' } }),
    ])));
    const { getByTestId } = render(<BrandPitchesScreen navigation={n} />);
    await waitFor(() => getByTestId('pitch-card-p2'));
    fireEvent.press(getByTestId('pitch-card-p2'));
    expect(n.navigate).toHaveBeenCalledWith('BrandPitchThread', { pitchId: 'p2' });
  });
});

/* ──────────────────────────────────────── T6, T7, T8 · one pitch */

describe('T6–T8 — deciding on one pitch', () => {
  beforeEach(() => { jest.clearAllMocks(); brandApi.pitch.mockResolvedValue(ok({ pitch: DETAIL() })); });

  it('everything needed to decide is on one screen', async () => {
    const { getByTestId, getByText, getAllByText } = render(<BrandPitchScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => getByTestId('pitch-terms'));
    // ASSERTION DRIFT — ui-walk-fixes D3 (drift/S0b.md): the screen has no bottom tabs now, so it
    // carries the title bar the item 8 board (T6) always drew. Her name is on the page, as before,
    // and in the bar above it.
    expect(getByTestId('pitch-creator-name').props.children).toBe('Tanvi Suresh');
    expect(getAllByText('Tanvi Suresh')).toHaveLength(2);
    getByText('Lifestyle · Bengaluru');
    getByText('48.2K');
    getByText('₹12,000 · 1 reel, 2 stories');
    getByText('Remote');
    getByText('“I have been running in your shoes for two years.”');
    getByText('Reply by 14 Oct · 28 days left');
    getByTestId('pitch-accept'); getByTestId('pitch-counter'); getByTestId('pitch-reject');
  });

  it('T7 — the accept sheet says the money is agreed and a collaboration is NOT started', async () => {
    const n = nav();
    brandApi.acceptPitch.mockResolvedValue(ok({ pitch: DETAIL(), poolEntryId: 'e1' }));
    const { getByTestId, getByText } = render(<BrandPitchScreen navigation={n} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => getByTestId('pitch-accept'));
    fireEvent.press(getByTestId('pitch-accept'));
    getByText("Accept Tanvi's terms?");
    getByText('Agreed');
    getByText('Not yet');                       // ← a collaboration
    getByText(/She'll be waiting under "Agreed, needs a set"/);
    fireEvent.press(getByTestId('accept-confirm'));
    await waitFor(() => expect(brandApi.acceptPitch).toHaveBeenCalledWith('p1'));
    // She is in the pool, so that is where the brand is taken.
    // ASSERTION DRIFT — ui-walk-fixes D3 (drift/S0b.md): the jump now asks for the Campaigns page
    // to sit under the pool (`initial: false`), so the pool has no bottom tabs and Back reaches it.
    // ASSERTION DRIFT — ui-walk-fixes board F, frame F8 (drift/F.md): the jump now carries the
    // message the pool shows, "Tanvi is in your pool." It used to land there without a word.
    expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandPool', params: { highlight: 'e1', toast: 'Tanvi is in your pool.' }, initial: false });
  });

  it('T8 — the cooldown date is on the reject sheet BEFORE the tap, with the block hint', async () => {
    const n = nav();
    brandApi.rejectPitch.mockResolvedValue(ok({ pitch: DETAIL() }));
    const { getByTestId, getByText } = render(<BrandPitchScreen navigation={n} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => getByTestId('pitch-reject'));
    fireEvent.press(getByTestId('pitch-reject'));
    getByText("Tanvi won't be able to pitch you again until 15 Oct. You can still invite her from Creators at any time.");
    getByText("If you'd rather never hear from her, block her in Pitch settings instead.");
    fireEvent.changeText(getByTestId('reject-reason'), 'Our content budget is spent for this quarter.');
    fireEvent.press(getByTestId('reject-confirm'));
    await waitFor(() => expect(brandApi.rejectPitch).toHaveBeenCalledWith('p1', { reason: 'Our content budget is spent for this quarter.' }));
  });

  it('the reason is optional, and capped at 200 characters before it leaves the phone', async () => {
    brandApi.rejectPitch.mockResolvedValue(ok({ pitch: DETAIL() }));
    const { getByTestId, getByText } = render(<BrandPitchScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => getByTestId('pitch-reject'));
    fireEvent.press(getByTestId('pitch-reject'));
    fireEvent.changeText(getByTestId('reject-reason'), 'x'.repeat(201));
    fireEvent.press(getByTestId('reject-confirm'));
    getByText('Keep it under 200 characters.');
    expect(brandApi.rejectPitch).not.toHaveBeenCalled();
  });

  it('a thread waiting on HER hides all three buttons — it is not the brand\'s move', async () => {
    brandApi.pitch.mockResolvedValue(ok({ pitch: { ...DETAIL(), can: { accept: false, counter: false, reject: false } } }));
    const { queryByTestId, getByTestId } = render(<BrandPitchScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => getByTestId('pitch-terms'));
    expect(queryByTestId('pitch-accept')).toBeNull();
    expect(queryByTestId('pitch-counter')).toBeNull();
    expect(queryByTestId('pitch-reject')).toBeNull();
  });
});

/* ──────────────────────────────────────────────── T11 · provenance */

describe('T11 — the pool tells the two doors apart', () => {
  const { PoolRow6 } = require('../../../components/negotiation/bits6');

  const entry = (over = {}) => ({
    entryId: 'e1', state: 'waiting',
    creator: { id: 'c1', name: 'Tanvi Suresh', avatarUrl: null },
    goal: 'engagement', terms: { fee: 9000 }, termsLine: '₹9,000',
    wantsGoLiveDate: day(25), wantsShootMode: 'shipment',
    agreedAt: new Date().toISOString(), daysLeft: 27, closingSoon: false,
    from: {}, fromPitchId: null, matchedShootMode: null,
    ...over,
  });

  it('a creator who pitched carries the tag; one who asked to be moved does not', () => {
    const a = render(<PoolRow6 entry={entry({ fromPitchId: 'p1' })} checked={false} onToggle={() => {}} />);
    a.getByTestId('pool-from-pitch-e1');
    const b = render(<PoolRow6 entry={entry()} checked={false} onToggle={() => {}} />);
    expect(b.queryByTestId('pool-from-pitch-e1')).toBeNull();
  });
});

/* ──────────────────────────────────── the card, on either side */

describe('PitchCard8 renders the server\'s sentences, never its own', () => {
  it('a cooldown line arrives written and is shown as given', () => {
    const { getByText } = render(
      <PitchCard8 card={{ ...CARD({ group: 'rejected', line: '"Not this quarter."', cooldownLine: 'You can pitch Stride Kicks again after 15 Oct.' }), brand: { id: 'b1', name: 'Stride Kicks' } }} side="creator" />
    );
    getByText('"Not this quarter."');
    getByText('You can pitch Stride Kicks again after 15 Oct.');
  });

  it('MiniStat8 shortens big numbers and dashes the missing ones', () => {
    const { getByText, getAllByText } = render(
      <MiniStat8 numbers={{ instagramFollowers: 1250000, youtubeSubscribers: null, engagement: null }} />
    );
    getByText('12.5L');
    expect(getAllByText('—').length).toBe(2);
  });
});
