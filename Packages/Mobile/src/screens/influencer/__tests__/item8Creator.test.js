/**
 * Item 8 — the creator app: T2/T3/T4 writing a pitch, T13/T14 her list and its
 * endings, T4 withdrawing, T10 the thread her pitch became.
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * The rule this suite keeps: **every sentence about a deadline, an ending or a
 * cooldown comes from the server and is rendered as given.** A screen that
 * composed its own would eventually disagree with the server about the two
 * things she most needs to trust.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: {
    pitchForm: jest.fn(), sendPitch: jest.fn(), myPitches: jest.fn(), myPitch: jest.fn(),
    withdrawPitch: jest.fn(), myPitchThread: jest.fn(), counterMyPitch: jest.fn(),
    acceptMyPitch: jest.fn(), declineMyPitch: jest.fn(),
  },
  brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi } = require('../../../services/api');
const PitchFormScreen = require('../PitchFormScreen').default;
const MyPitchesScreen = require('../MyPitchesScreen').default;
const MyPitchScreen = require('../MyPitchScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const FORM = {
  brand: { id: 'b1', name: 'Stride Kicks' },
  responseDays: 30,
  acceptedAims: ['conversion', 'engagement', 'hybrid'],
  acceptedModes: ['visit', 'shipment'],
  canPitch: true, reason: 'OK', cooldownUntil: null, cooldownLine: null,
  minimums: { feeEngagement: 8000, feeHybrid: null, commission: 12, commissionHybrid: null },
  openPitches: 0, maxOpen: 3,
  limitLine: 'Your 1st open pitch to this brand · 3 allowed',
  limitReachedLine: null,
  earliestGoLiveDate: day(7),
};

const CARD = (over = {}) => ({
  id: 'p1', brand: { id: 'b1', name: 'Stride Kicks' },
  goal: 'engagement', aimLabel: 'Pay for Content', termsLine: '₹12,000 · 1 reel, 2 stories',
  proposedGoLiveDate: day(25), shootMode: 'shipment', modeLabel: 'Remote',
  sentAt: new Date().toISOString(), group: 'waiting',
  responseDueAt: new Date(Date.now() + 24 * 86400000).toISOString(), daysLeft: 24,
  line: 'They have until 9 Oct · 24 days left',
  cooldownUntil: null, cooldownLine: null, negotiation: null,
  ...over,
});

/* ─────────────────────────────────────────── T2, T3, T4 · the form */

describe('T2–T4 — writing a pitch', () => {
  beforeEach(() => { influencerApi.pitchForm.mockResolvedValue(ok({ form: FORM })); });

  it('offers only the Aims the brand accepts, and says which it does not take', async () => {
    influencerApi.pitchForm.mockResolvedValue(ok({ form: { ...FORM, acceptedAims: ['engagement'], acceptedModes: ['shipment'] } }));
    const { getByTestId, queryByTestId, getByText } = render(
      <PitchFormScreen navigation={nav()} route={{ params: { brandId: 'b1' } }} />
    );
    await waitFor(() => getByTestId('pitch-aim-engagement'));
    expect(queryByTestId('pitch-aim-conversion')).toBeNull();
    expect(queryByTestId('pitch-aim-hybrid')).toBeNull();
    getByText(/Stride Kicks don't take .* pitches\./);
  });

  it('her own minimum is a reminder, never a rule — she can go under it', async () => {
    const { getByTestId, getByText } = render(
      <PitchFormScreen navigation={nav()} route={{ params: { brandId: 'b1' } }} />
    );
    await waitFor(() => getByTestId('pitch-aim-engagement'));
    fireEvent.press(getByTestId('pitch-aim-engagement'));
    getByText(/Your minimum fee is ₹8,000\./);
    fireEvent.changeText(getByTestId('pitch-fee'), '6000');   // under her own bar
    fireEvent.press(getByTestId('pitch-next-1'));
    await waitFor(() => getByTestId('pitch-date'));           // it let her through
  });

  it('a date inside item 4\'s floor is refused before it leaves the phone', async () => {
    const { getByTestId, getByText } = render(
      <PitchFormScreen navigation={nav()} route={{ params: { brandId: 'b1' } }} />
    );
    await waitFor(() => getByTestId('pitch-aim-conversion'));
    fireEvent.press(getByTestId('pitch-aim-conversion'));
    fireEvent.changeText(getByTestId('pitch-commission'), '14');
    fireEvent.press(getByTestId('pitch-next-1'));
    await waitFor(() => getByTestId('pitch-date'));
    fireEvent.press(getByTestId('pitch-next-2'));
    getByText('Choose when you could post.');
  });

  it('the review says the deadline, the next step and the limit before she taps Send', async () => {
    const n = nav();
    influencerApi.sendPitch.mockResolvedValue(ok({ pitch: CARD() }));
    const { getByTestId, getByText } = render(
      <PitchFormScreen navigation={n} route={{ params: { brandId: 'b1' } }} />
    );
    await waitFor(() => getByTestId('pitch-aim-conversion'));
    fireEvent.press(getByTestId('pitch-aim-conversion'));
    fireEvent.changeText(getByTestId('pitch-commission'), '14');
    fireEvent.press(getByTestId('pitch-next-1'));
    await waitFor(() => getByTestId('pitch-date'));
    fireEvent.press(getByTestId('pitch-mode-shipment'));
    // The date picker is item 4's; set the value the way the screen would.
    fireEvent(getByTestId('pitch-date'), 'onChange', day(25));
    fireEvent.press(getByTestId('pitch-next-2'));
    await waitFor(() => getByTestId('pitch-review'));
    getByText(/Stride Kicks have 30 days to reply\./);
    getByText('Your 1st open pitch to this brand · 3 allowed');
    fireEvent.changeText(getByTestId('pitch-message'), 'I run in your shoes every week.');
    getByText('31 / 500');
    fireEvent.press(getByTestId('pitch-send'));
    await waitFor(() => expect(influencerApi.sendPitch).toHaveBeenCalled());
    expect(influencerApi.sendPitch.mock.calls[0][0]).toMatchObject({
      brandId: 'b1', goal: 'conversion', commissionPct: 14, shootMode: 'shipment', proposedGoLiveDate: day(25),
    });
  });

  it('the server\'s refusal is shown in the server\'s own words, on its own field', async () => {
    influencerApi.sendPitch.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', field: 'goal', message: 'You already have an open Pay for Sale pitch with Stride Kicks.' } });
    const { getByTestId, getByText } = render(
      <PitchFormScreen navigation={nav()} route={{ params: { brandId: 'b1' } }} />
    );
    await waitFor(() => getByTestId('pitch-aim-conversion'));
    fireEvent.press(getByTestId('pitch-aim-conversion'));
    fireEvent.changeText(getByTestId('pitch-commission'), '14');
    fireEvent.press(getByTestId('pitch-next-1'));
    await waitFor(() => getByTestId('pitch-date'));
    fireEvent.press(getByTestId('pitch-mode-shipment'));
    fireEvent(getByTestId('pitch-date'), 'onChange', day(25));
    fireEvent.press(getByTestId('pitch-next-2'));
    await waitFor(() => getByTestId('pitch-review'));
    fireEvent.changeText(getByTestId('pitch-message'), 'Hello there.');
    fireEvent.press(getByTestId('pitch-send'));
    await waitFor(() => getByText('You already have an open Pay for Sale pitch with Stride Kicks.'));
  });

  it('a cooldown is a pause with a date on it, not a form she cannot use', async () => {
    influencerApi.pitchForm.mockResolvedValue(ok({ form: {
      ...FORM, canPitch: false, reason: 'COOLDOWN',
      cooldownUntil: day(12), cooldownLine: 'You can pitch Stride Kicks again after 27 Sep.',
    } }));
    const { getByTestId, getByText, queryByTestId } = render(
      <PitchFormScreen navigation={nav()} route={{ params: { brandId: 'b1' } }} />
    );
    await waitFor(() => getByTestId('pitch-form-blocked'));
    getByText('You can pitch Stride Kicks again after 27 Sep.');
    expect(queryByTestId('pitch-send')).toBeNull();
  });

  it('three open pitches is the limit, said in the sentence the server wrote', async () => {
    influencerApi.pitchForm.mockResolvedValue(ok({ form: {
      ...FORM, canPitch: false, reason: 'LIMIT', openPitches: 3,
      limitReachedLine: 'You have 3 open pitches with Stride Kicks, which is the most allowed. Withdraw one, or wait for a reply.',
    } }));
    const { getByTestId, getByText } = render(
      <PitchFormScreen navigation={nav()} route={{ params: { brandId: 'b1' } }} />
    );
    await waitFor(() => getByTestId('pitch-form-blocked'));
    getByText(/which is the most allowed\. Withdraw one, or wait for a reply\./);
  });
});

/* ─────────────────────────────────────────── T13, T14 · her list */

describe('T13/T14 — her pitches and their endings', () => {
  const list = (rows) => ({
    rows, total: rows.length,
    groups: {
      waiting: rows.filter(r => ['waiting', 'talking'].includes(r.group)),
      agreed: rows.filter(r => r.group === 'agreed'),
      ended: rows.filter(r => ['rejected', 'withdrawn', 'noReply', 'datePassed'].includes(r.group)),
    },
  });

  it('three live states, each with the one sentence it has to say', async () => {
    influencerApi.myPitches.mockResolvedValue(ok(list([
      CARD(),
      CARD({ id: 'p2', group: 'agreed', line: "They'll send an invitation when they build a set for 28 Oct." }),
      CARD({ id: 'p3', group: 'rejected', line: '"Our content budget is spent for this quarter."', cooldownUntil: day(30), cooldownLine: 'You can pitch Stride Kicks again after 15 Oct.' }),
    ])));
    const { getByText, getByTestId } = render(<MyPitchesScreen navigation={nav()} />);
    await waitFor(() => getByTestId('pitches-waiting'));
    getByText('They have until 9 Oct · 24 days left');
    getByText("They'll send an invitation when they build a set for 28 Oct.");
    getByText('"Our content budget is spent for this quarter."');
    getByText('You can pitch Stride Kicks again after 15 Oct.');
  });

  it('every ending says whether she can try again, in the server\'s words', async () => {
    influencerApi.myPitches.mockResolvedValue(ok(list([
      CARD({ id: 'e1', group: 'noReply', line: "Loom & Bead didn't reply by 8 Sep, so this closed. You can pitch them again whenever you like." }),
      CARD({ id: 'e2', group: 'withdrawn', line: 'You withdrew this pitch on 10 Sep. No cooldown — pitch them again when you\'re ready.' }),
      CARD({ id: 'e3', group: 'datePassed', line: 'You offered to post on 20 Sep, which is now too close for a set to be built. This pitch closed on 13 Sep.' }),
    ])));
    const { getByText, getByTestId } = render(<MyPitchesScreen navigation={nav()} />);
    await waitFor(() => getByTestId('pitches-ended'));
    getByText(/You can pitch them again whenever you like\./);
    getByText(/No cooldown — pitch them again when you're ready\./);
    getByText(/too close for a set to be built/);
  });

  it('an empty list invites her to start one', async () => {
    influencerApi.myPitches.mockResolvedValue(ok(list([])));
    const { getByText } = render(<MyPitchesScreen navigation={nav()} />);
    await waitFor(() => getByText('No pitches yet'));
    getByText("Find a brand you'd like to work with and tell them what you'd do.");
  });

  it('a pitch with an open thread opens the conversation, not the pitch', async () => {
    const n = nav();
    influencerApi.myPitches.mockResolvedValue(ok(list([
      CARD({ group: 'talking', negotiation: { id: 'n1', open: true, whoseMove: 'influencer' } }),
    ])));
    const { getByTestId } = render(<MyPitchesScreen navigation={n} />);
    await waitFor(() => getByTestId('pitch-card-p1'));
    fireEvent.press(getByTestId('pitch-card-p1'));
    expect(n.navigate).toHaveBeenCalledWith('PitchThread', { pitchId: 'p1' });
  });
});

/* ─────────────────────────────────────────── T4 · withdrawing */

describe('T4 — taking it back', () => {
  it('says there is no cooldown before she confirms', async () => {
    influencerApi.myPitch.mockResolvedValue(ok({ pitch: { ...CARD(), message: 'I run in your shoes.', terms: { fee: 12000, deliverables: [] } } }));
    influencerApi.withdrawPitch.mockResolvedValue(ok({ pitch: { ...CARD({ group: 'withdrawn', line: 'You withdrew this pitch on 10 Sep. No cooldown — pitch them again when you\'re ready.' }), message: 'x', terms: {} } }));
    const { getByTestId, getByText } = render(<MyPitchScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => getByTestId('my-pitch-withdraw'));
    fireEvent.press(getByTestId('my-pitch-withdraw'));
    getByText(/There is no cooldown — you can pitch them again whenever you like\./);
    fireEvent.press(getByTestId('withdraw-confirm'));
    await waitFor(() => expect(influencerApi.withdrawPitch).toHaveBeenCalledWith('p1'));
  });

  it('an agreed pitch offers no Withdraw at all — leaving the pool is a different act', async () => {
    influencerApi.myPitch.mockResolvedValue(ok({ pitch: { ...CARD({ group: 'agreed', line: "They'll send an invitation when they build a set for 28 Oct." }), message: 'x', terms: {} } }));
    const { queryByTestId, getByText } = render(<MyPitchScreen navigation={nav()} route={{ params: { pitchId: 'p1' } }} />);
    await waitFor(() => getByText("They'll send an invitation when they build a set for 28 Oct."));
    expect(queryByTestId('my-pitch-withdraw')).toBeNull();
  });
});
