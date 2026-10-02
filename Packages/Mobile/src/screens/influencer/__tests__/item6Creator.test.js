/**
 * Item 6 — the creator app: N1 the choice, N2/N3 the counter with its change lines, N4 the move
 * request, N5/N6 the thread and the last round, N12 the three endings of a move, N17 the pool
 * line, N19 no Counter when the brand is not taking them.
 * Contract: features/item6-negotiation
 */
import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: {
    myInvitations: jest.fn(), myInvitation: jest.fn(), acceptInvitation: jest.fn(), declineInvitation: jest.fn(),
    myThread: jest.fn(), counterInvitation: jest.fn(), requestMove: jest.fn(), acceptCounter: jest.fn(), declineCounter: jest.fn(),
  },
  brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi } = require('../../../services/api');
const InvitationScreen = require('../InvitationScreen').default;
const CounterScreen = require('../CounterScreen').default;
const MoveRequestScreen = require('../MoveRequestScreen').default;
const ThreadScreen = require('../ThreadScreen').default;
const CollabsScreen = require('../CollabsScreen').default;
const { MSG6, C6 } = require('../../../components/negotiation/copy6');
const { CounterChoiceSheet6 } = require('../../../components/negotiation/sheets6');
const { MSG5 } = require('../../../components/invitations/copy5');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();

const THREAD = {
  invitationId: 'ci1', goal: 'conversion', status: 'invited',
  brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' },
  campaignName: 'Diwali Edit 2026', setName: 'Set A', postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, cutoffPassed: false,
  shootMode: 'visit', cityName: 'Hyderabad', switchOn: true,
  negotiation: { id: null, open: false, whoseMove: null, roundLimit: 2, countersUsed: 0, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { commissionPct: 10 }, currentLine: '10%',
  turns: [],
  invitation: { terms: { commissionPct: 10 }, termsLine: '10%', sentAt: `${yr}-09-12T10:00:00Z`, scopeWords: 'whole store', offerName: 'Festive 15% off Sarees' },
  moveRequest: null, pool: null, ending: null,
  can: { counter: true, accept: false, decline: false, moveRequest: true, moveAnswer: false },
};
const withCounter = (over = {}) => ({
  ...THREAD, status: 'negotiating',
  negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1, isLastRound: true, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { commissionPct: 13 }, currentLine: '13%',
  turns: [{ id: 't1', by: 'influencer', mine: true, at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { commissionPct: 13 }, termsLine: '13%', changes: [{ term: 'commissionPct', from: '10%', to: '13%' }], note: 'Ethnic wear takes a full day to shoot. 13% works for me.' }],
  can: { counter: false, accept: false, decline: false, moveRequest: true, moveAnswer: false },
  ...over,
});
const INV = {
  id: 'ci1', status: 'invited', group: 'invited', brand: { name: 'Urban Threads', logoUrl: null },
  campaignName: 'Diwali Edit 2026', setName: 'Set A', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad',
  postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysLeft: 4, commissionPct: 10, fee: null,
  canAnswer: true, canCounter: true, counterHiddenReason: null, canMoveRequest: true, switchOn: true,
  negotiation: null, moveRequest: null, pool: null, fromPool: null,
  set: { name: 'Set A', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad', postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17` },
  terms: { goal: 'conversion', commissionPct: 10, fee: null, scope: { kind: 'store', words: 'whole store' }, offer: { kind: 'none' }, shoppablePostsMin: 1, deliverablesWords: null, usageRights: null, note: null, paySplit: null },
  note: null,
};

beforeEach(() => jest.clearAllMocks());

describe('N1 — tapping Counter', () => {
  it('offers the money and the work or the date and the mode, with the counters-left line', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...INV, negotiation: { roundLimit: 2, countersUsed: 0 } } }));
    const n = nav();
    const { getByText, getByTestId } = render(<InvitationScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('counter'));
    fireEvent.press(getByTestId('counter'));
    getByText('What would you like to change?');
    getByText('The money and the work'); getByText('Fee, what you post, how the brand may reuse it');
    getByText('The posting date or the mode'); getByText('Ask to be moved to a set that suits you');
    getByText('You can counter twice in this collaboration. This would be your first.');
    fireEvent.press(getByTestId('choice-move'));
    fireEvent.press(getByTestId('choice-continue'));
    expect(n.navigate).toHaveBeenCalledWith('MoveRequest', { ciId: 'ci1' });
  });

  // ASSERTION DRIFT — ui-walk-fixes spec U23 (06-diff/drift/E.md). This fixture is what the server
  // really answers when the brand has switched countering off and she has not asked for another
  // date yet (invitationRows.service.js creatorState): canCounter false, 'switch_off', and
  // canMoveRequest TRUE. The test was called "there is no Counter" and never looked: a button
  // labelled "Counter" was drawn, and the counter it led to was refused on Send. It now asserts
  // what is drawn — no "Counter" anywhere, and "Ask for another date" opening the request.
  const SWITCH_OFF = { ...INV, canCounter: false, counterHiddenReason: 'switch_off', switchOn: false, canMoveRequest: true };

  it('N19 — with countering off there is no "Counter": one plain line says why, and the second button reads "Ask for another date" and opens the request directly', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: SWITCH_OFF }));
    const n = nav();
    const { getByText, getByTestId, queryByText, queryByTestId } = render(<InvitationScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('accept'));
    getByText("Urban Threads aren't taking counters on this campaign.");
    getByTestId('decline');
    // The word "Counter" is nowhere on the screen: not as a button, not greyed.
    expect(queryByText('Counter')).toBeNull();
    // The second button keeps its place and its testID, and says what it does.
    const ask = getByTestId('counter');
    within(ask).getByText('Ask for another date');
    expect(C6.invitation.askDate).toBe('Ask for another date');
    expect(within(ask).queryByText('undo-variant')).toBeNull();           // no undo arrow: this is not a counter
    expect(ask.props.accessibilityState).toEqual({ disabled: false });

    fireEvent.press(ask);
    // Straight to "Ask for a change" — no chooser, and never the money counter.
    expect(n.navigate).toHaveBeenCalledTimes(1);
    expect(n.navigate).toHaveBeenCalledWith('MoveRequest', { ciId: 'ci1' });
    expect(queryByText('What would you like to change?')).toBeNull();
    expect(queryByTestId('choice-money')).toBeNull();
    expect(queryByText('The money and the work')).toBeNull();
  });

  it('N19 — once she has asked for another date too (canMoveRequest false) there is no second button at all: Accept, then Decline', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...SWITCH_OFF, canMoveRequest: false,
      moveRequest: { goLiveDate: `${yr}-10-27`, shootMode: null, note: null, requestedAt: `${yr}-09-13T10:00:00Z`, answer: 'kept', answeredAt: `${yr}-09-14T10:00:00Z` } } }));
    const n = nav();
    const { getByText, getByTestId, queryByTestId, queryByText } = render(<InvitationScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('accept'));
    getByText("Urban Threads aren't taking counters on this campaign.");
    expect(queryByTestId('counter')).toBeNull();
    expect(queryByText('Counter')).toBeNull();
    expect(queryByText('Ask for another date')).toBeNull();
    getByTestId('decline');
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('U23 — the same holds whatever switched the counter off: an open-group invitation she may still ask to be moved from', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...INV, canCounter: false, counterHiddenReason: 'open_group', canMoveRequest: true } }));
    const n = nav();
    const { getByTestId, queryByText, queryByTestId } = render(<InvitationScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('accept'));
    within(getByTestId('counter')).getByText('Ask for another date');
    expect(queryByText('Counter')).toBeNull();
    expect(queryByTestId('counter-off')).toBeNull();                      // the switch is not off, so no line about it
    fireEvent.press(getByTestId('counter'));
    expect(n.navigate).toHaveBeenCalledWith('MoveRequest', { ciId: 'ci1' });
  });

  describe('the chooser itself, when it is told a counter is not allowed (U23)', () => {
    const sheet = (props) => render(<CounterChoiceSheet6 visible roundLimit={2} countersUsed={0} onMoney={() => {}} onMove={() => {}} onClose={() => {}} {...props} />);

    it('canCounter false: "The money and the work" and the counters-left line are not offered; it starts on the date choice, and Continue asks for the move', () => {
      const onMoney = jest.fn(); const onMove = jest.fn();
      const r = sheet({ canCounter: false, canMoveRequest: true, onMoney, onMove });
      r.getByText('What would you like to change?');
      expect(r.queryByTestId('choice-money')).toBeNull();
      expect(r.queryByText('The money and the work')).toBeNull();
      expect(r.queryByTestId('counters-left')).toBeNull();
      r.getByTestId('choice-move');
      fireEvent.press(r.getByTestId('choice-continue'));                    // nothing tapped first: the date is already chosen
      expect(onMove).toHaveBeenCalledTimes(1);
      expect(onMoney).not.toHaveBeenCalled();
    });

    it('canCounter missing means true: both choices, the counters-left line, and the money chosen first — exactly as before', () => {
      const onMoney = jest.fn(); const onMove = jest.fn();
      const r = sheet({ canMoveRequest: true, onMoney, onMove });
      r.getByTestId('choice-money'); r.getByTestId('choice-move');
      r.getByText('You can counter twice in this collaboration. This would be your first.');
      fireEvent.press(r.getByTestId('choice-continue'));
      expect(onMoney).toHaveBeenCalledTimes(1);
      expect(onMove).not.toHaveBeenCalled();
      const both = sheet({ canCounter: true, canMoveRequest: true, onMoney, onMove });
      both.getByTestId('choice-money'); both.getByTestId('counters-left');
    });

    it('neither allowed: nothing to choose, and Continue only closes — it never opens a counter or a request the server would refuse', () => {
      const onMoney = jest.fn(); const onMove = jest.fn(); const onClose = jest.fn();
      const r = sheet({ canCounter: false, canMoveRequest: false, onMoney, onMove, onClose });
      expect(r.queryByTestId('choice-money')).toBeNull();
      expect(r.queryByTestId('choice-move')).toBeNull();
      fireEvent.press(r.getByTestId('choice-continue'));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onMoney).not.toHaveBeenCalled();
      expect(onMove).not.toHaveBeenCalled();
    });
  });

  it('N17 — an invitation sent from the pool names the date only when it is the date she asked for', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...INV, fromPool: { agreedAt: `${yr}-09-13T10:00:00Z`, sameDate: true, termsLine: '12%' } } }));
    const r1 = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r1.getByTestId('from-pool'));
    r1.getByText(`The 20 Oct date and the 12% you agreed on 13 Sep.`);
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...INV, fromPool: { agreedAt: `${yr}-09-13T10:00:00Z`, sameDate: false, termsLine: '12%' } } }));
    const r2 = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r2.getByTestId('from-pool'));
    r2.getByText('The 12% you agreed on 13 Sep.');
  });
});

describe('N2 · N3 — the counter screens', () => {
  it('Pay for Sale: the round pill, the locked card, the change line, and the messages before anything is sent', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD }));
    const n = nav();
    const { getByText, getByTestId } = render(<CounterScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('counter-commission'));
    getByText('ROUND 1 OF 2');
    getByText("🔒 Can't be changed"); getByText('Pay for Sale'); getByText('Store Visit · Hyderabad'); getByText('whole store');
    getByText('Their offer');
    getByText('Urban Threads can accept this, counter once more, or decline. Nothing is final until you both sign.');
    // nothing changed → refused in the server's words, before it leaves the phone
    fireEvent.press(getByTestId('send-counter'));
    getByText(MSG6.NOTHING_CHANGED);
    expect(influencerApi.counterInvitation).not.toHaveBeenCalled();
    fireEvent.changeText(getByTestId('counter-commission'), '140');
    fireEvent.press(getByTestId('send-counter'));
    getByText(MSG5.COMMISSION_RANGE);
    fireEvent.changeText(getByTestId('counter-commission'), '13');
    influencerApi.counterInvitation.mockResolvedValue(ok({ thread: withCounter() }));
    fireEvent.changeText(getByTestId('counter-note'), 'Ethnic wear takes a full day.');
    fireEvent.press(getByTestId('send-counter'));
    await waitFor(() => expect(influencerApi.counterInvitation).toHaveBeenCalledWith('ci1', { terms: { commissionPct: 13, fee: null, deliverables: [], usageRights: null }, note: 'Ethnic wear takes a full day.' }));
    expect(n.replace).toHaveBeenCalledWith('Thread', { ciId: 'ci1', toast: 'Counter sent.' });
  });

  it('Pay for Content: fee, deliverables and usage rights together, each with its change line', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: {
      ...THREAD, goal: 'engagement',
      current: { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }], usageRights: { on: true, durationDays: 60, places: ['social', 'ads'] } },
      invitation: { ...THREAD.invitation, terms: { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }], usageRights: { on: true, durationDays: 60, places: ['social', 'ads'] } }, scopeWords: null, offerName: null },
    } }));
    const { getByText, getByTestId } = render(<CounterScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('counter-fee'));
    getByText(/^Fee/); getByText(/^What you'll deliver/); getByText('Brand can reuse the content');
    getByTestId('change-fee'); getByTestId('change-deliverables'); getByTestId('change-usage');
    getByText('They asked for 60 days on social and ads.');
    // an empty deliverables list is refused with item 5's message
    fireEvent.press(getByTestId('counter-deliverables-row-0-remove'));
    fireEvent.press(getByTestId('counter-deliverables-row-0-remove'));
    fireEvent.changeText(getByTestId('counter-fee'), '12000');
    fireEvent.press(getByTestId('send-counter'));
    getByText(MSG5.DELIVERABLES_EMPTY);
  });
});

describe('N4 — asking for a different date or mode', () => {
  it('needs something chosen, refuses the date they already asked for, and explains what it is not', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: THREAD }));
    const n = nav();
    const { getByText, getByTestId } = render(<MoveRequestScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('want-date'));
    getByText('This set'); getByText('The posting date'); getByText('The mode of work');
    getByText(/A set has one mode of work for everyone, so this isn't a counter/);
    fireEvent.press(getByTestId('send-move'));
    getByText(MSG6.MOVE_NOTHING);
    expect(influencerApi.requestMove).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('want-mode'));
    influencerApi.requestMove.mockResolvedValue(ok({ thread: THREAD }));
    fireEvent.changeText(getByTestId('move-note'), "I'm travelling that week.");
    fireEvent.press(getByTestId('send-move'));
    await waitFor(() => expect(influencerApi.requestMove).toHaveBeenCalledWith('ci1', { goLiveDate: undefined, shootMode: 'shipment', note: "I'm travelling that week." }));
    expect(n.replace).toHaveBeenCalledWith('Thread', { ciId: 'ci1', toast: 'Request sent.' });
  });
});

describe('N5 · N6 — the thread', () => {
  it('waiting: newest first, the invitation last as plain values, and what they may do next', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: withCounter() }));
    const { getByText, getByTestId, queryByTestId, toJSON } = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('turn-invitation'));
    getByText('Waiting for Urban Threads. Reply by 17 Oct.');
    getByText('You countered'); getByText('Their invitation');
    getByText('“Ethnic wear takes a full day to shoot. 13% works for me.”');
    getByText('They can accept, counter once more, or decline.');
    getByText('whole store'); getByText('Festive 15% off Sarees');
    const flat = JSON.stringify(toJSON());
    expect(flat.indexOf('You countered')).toBeLessThan(flat.indexOf('Their invitation'));
    expect(queryByTestId('thread-actions')).toBeNull();
  });

  it('the last round: the warning, and Accept or Decline only', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: withCounter({
      negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 2, countersUsed: 2, isLastRound: false, noRoundsLeft: true, outcome: null, endedAt: null },
      current: { commissionPct: 11.5 }, currentLine: '11.5%',
      turns: [
        { id: 't2', by: 'brand', mine: false, at: `${yr}-09-14T10:00:00Z`, kind: 'counter', terms: { commissionPct: 11.5 }, changes: [{ term: 'commissionPct', from: '13%', to: '11.5%' }], note: 'We can do 11.5% for the first collaboration.' },
        { id: 't1', by: 'influencer', mine: true, at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { commissionPct: 13 }, changes: [{ term: 'commissionPct', from: '10%', to: '13%' }] },
      ],
      can: { counter: false, accept: true, decline: true, moveRequest: false, moveAnswer: false },
    }) }));
    influencerApi.acceptCounter.mockResolvedValue(ok({ thread: withCounter({ ending: { outcome: 'agreed', text: 'Agreed at 11.5% on 14 Sep. Send the agreement next.' }, negotiation: { id: 'n1', open: false, whoseMove: null, roundLimit: 2, countersUsed: 2, outcome: 'agreed' }, can: { counter: false, accept: false, decline: false } }) }));
    const { getByText, getByTestId, queryByTestId } = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('thread-actions'));
    getByText('This is their last counter. You can accept it or decline — there are no more rounds.');
    getByText('They countered');
    expect(queryByTestId('thread-counter')).toBeNull();
    getByTestId('thread-decline');
    fireEvent.press(getByTestId('thread-accept'));
    await waitFor(() => expect(influencerApi.acceptCounter).toHaveBeenCalledWith('ci1'));
    await waitFor(() => getByTestId('ending-agreed'));
    getByText('Agreed at 11.5% on 14 Sep. Send the agreement next.');
  });

  it('the decline sheet needs one of the five reasons', async () => {
    influencerApi.myThread.mockResolvedValue(ok({ thread: withCounter({
      negotiation: { id: 'n1', open: true, whoseMove: 'influencer', roundLimit: 2, countersUsed: 2, noRoundsLeft: true, outcome: null },
      can: { counter: false, accept: true, decline: true },
    }) }));
    influencerApi.declineCounter.mockResolvedValue(ok({ thread: withCounter({ ending: { outcome: 'declined_by_creator', text: 'Priya declined on 14 Sep: fee too low.' }, can: {} }) }));
    const { getByText, getByTestId } = render(<ThreadScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('thread-decline'));
    fireEvent.press(getByTestId('thread-decline'));
    getByText('Why are you saying no?');
    fireEvent.press(getByTestId('decline-confirm'));
    getByText(MSG5.DECLINE_REASON);
    fireEvent.press(getByTestId('reason-fee_too_low'));
    fireEvent.press(getByTestId('decline-confirm'));
    await waitFor(() => expect(influencerApi.declineCounter).toHaveBeenCalledWith('ci1', { reason: 'fee_too_low', note: undefined }));
  });
});

describe('N12 — after asking to move', () => {
  it('agreed, kept and closed each have their own sentence on the card', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [
      { ...INV, id: 'a', group: 'pooled', canAnswer: false, pool: { entryId: 'e1', state: 'waiting', wantsGoLiveDate: `${yr}-10-27` } },
      { ...INV, id: 'b', brand: { name: 'Stride Kicks' }, group: 'invited', moveRequest: { goLiveDate: `${yr}-10-27`, answer: 'kept' }, postingDate: `${yr}-10-28`, cutoff: `${yr}-10-25` },
      { ...INV, id: 'c', brand: { name: 'Tick Watches' }, group: 'closed', canAnswer: false, endedAt: `${yr}-10-10T10:00:00Z`, pool: { entryId: 'e3', state: 'expired', lifetimeDays: 30 } },
      { ...INV, id: 'd', brand: { name: 'Bloom Beauty' }, group: 'negotiating', negotiation: { id: 'n9', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1 } },
    ] }));
    const n = nav();
    const { getByText, getByTestId } = render(<CollabsScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('invitation-card-a'));
    getByText("They agreed to 27 Oct. They'll send a new invitation once the dates are set.");
    getByText('Stride Kicks are keeping 28 Oct. You can still accept or decline by 25 Oct.');
    getByText('Tick Watches is no longer going ahead with this collaboration.');
    getByTestId('card-chip-pooled');
    // the move is answered and the invitation is hers again, so the card opens the invitation
    fireEvent.press(getByTestId('invitation-card-b'));
    expect(n.navigate).toHaveBeenCalledWith('Invitation', { ciId: 'b' });
    // a card with a conversation still running opens the thread
    fireEvent.press(getByTestId('invitation-card-d'));
    expect(n.navigate).toHaveBeenCalledWith('Thread', { ciId: 'd' });
  });
});
