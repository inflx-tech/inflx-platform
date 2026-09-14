/**
 * Item 5 — the creator app: I11 the Invites cards, I12/I13 the invitation with its two blocks,
 * I14 accept and decline with a reason, I15 the other states, Counter hidden not refused.
 * Contract: features/item5-invitations
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { myInvitations: jest.fn(), myInvitation: jest.fn(), acceptInvitation: jest.fn(), declineInvitation: jest.fn() },
  brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi } = require('../../../services/api');
const CollabsScreen = require('../CollabsScreen').default;
const InvitationScreen = require('../InvitationScreen').default;
const { MSG5 } = require('../../../components/invitations/copy5');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const CARD = { id: 'ci1', status: 'invited', group: 'invited', brand: { name: 'Urban Threads', logoUrl: null }, campaignName: 'Diwali Edit 2026', setName: 'Set A · Ethnic wear',
  goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad', postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysLeft: 4, commissionPct: 10, fee: null,
  sentAt: `${yr}-09-12T10:00:00Z`, answeredAt: null, endedAt: null, canAnswer: true, canCounter: true };
const CONTENT = { ...CARD, id: 'ci2', brand: { name: 'Stride Kicks', logoUrl: null }, campaignName: 'Winter Run', setName: 'Set B', goal: 'engagement', shootMode: 'shipment', cityName: null,
  postingDate: `${yr}-10-28`, cutoff: `${yr}-10-25`, daysLeft: 12, commissionPct: null, fee: 8000 };
const DETAIL = { ...CARD,
  set: { name: 'Set A · Ethnic wear', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad', postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17` },
  terms: { goal: 'conversion', commissionPct: 10, fee: null, scope: { kind: 'store', words: 'whole store' }, offer: { kind: 'library', name: 'Festive 15% off Sarees' }, shoppablePostsMin: 1, deliverablesWords: null, usageRights: null, note: 'Loved your Diwali reels last year — would be great to have you at the Banjara Hills store.', paySplit: null },
  note: 'Loved your Diwali reels last year — would be great to have you at the Banjara Hills store.' };
const CONTENT_DETAIL = { ...CONTENT, set: { name: 'Set B', goal: 'engagement', shootMode: 'shipment', cityName: null, postingDate: `${yr}-10-28`, cutoff: `${yr}-10-25` },
  terms: { goal: 'engagement', commissionPct: null, fee: 8000, scope: null, offer: null, shoppablePostsMin: null, deliverablesWords: '1 Instagram reel, 2 Instagram stories', usageRights: { words: '60 days · social and ads' }, note: null, paySplit: { t1: 2000, t2: 2000, t3: 4000 } }, note: null };

beforeEach(() => jest.clearAllMocks());

describe('I11 · I15 — Collabs · Invites', () => {
  it('cards carry who, which set, the Aim, mode, date, money and the deadline; each state its sentence; tapping opens the invitation (check 25)', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [
      CARD, CONTENT,
      { ...CARD, id: 'ci3', status: 'accepted', group: 'accepted', canAnswer: false },
      { ...CARD, id: 'ci4', brand: { name: 'Tick Watches' }, status: 'expired', group: 'expired', cutoff: `${yr}-09-11`, canAnswer: false, endedAt: `${yr}-09-11T18:29:59Z` },
      { ...CARD, id: 'ci5', brand: { name: 'Loom & Bead' }, status: 'withdrawn', group: 'withdrawn', canAnswer: false, endedAt: `${yr}-09-10T10:00:00Z` },
      { ...CARD, id: 'ci6', brand: { name: 'Nava Kids' }, status: 'removed', group: 'closed', canAnswer: false, endedAt: `${yr}-09-10T10:00:00Z` },
    ] }));
    const n = nav();
    const { getByText, getAllByText, getByTestId } = render(<CollabsScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('invitation-card-ci1'));
    expect(getAllByText('Urban Threads').length).toBe(2); expect(getAllByText('Diwali Edit 2026 · Set A · Ethnic wear').length).toBe(5);
    expect(getAllByText('You earn 10% commission').length).toBe(5); getByText('Reply by 17 Oct · 4 days left');
    getByText('You earn ₹8,000'); getByText('Reply by 25 Oct · 12 days left');
    getByText('Waiting for the agreement from Urban Threads.');
    getByText("You didn't reply by 11 Sep, so this invitation closed.");
    getByText('Loom & Bead withdrew this invitation on 10 Sep.');
    getByText('Nava Kids is no longer going ahead with this collaboration.');
    getByTestId('card-chip-closed');
    expect(influencerApi.myInvitations).toHaveBeenCalledWith('invites');
    fireEvent.press(getByTestId('invitation-card-ci1'));
    expect(n.navigate).toHaveBeenCalledWith('Invitation', { ciId: 'ci1' });
  });

  it('empty Invites, and Done asks the server for the ended ones (check 34)', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [] }));
    const { getByText, getByTestId } = render(<CollabsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('collabs-empty-invites'));
    getByText('No invitations yet'); getByText('When a brand invites you to a set, it shows up here.');
    fireEvent.press(getByText('Done'));
    await waitFor(() => expect(influencerApi.myInvitations).toHaveBeenCalledWith('done'));
    influencerApi.myInvitations.mockResolvedValue({ success: false, error: { message: 'x' } });
    const r2 = render(<CollabsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r2.getByTestId('load-error'));
    r2.getByText('Try again');
  });
});

describe('I12 · I13 · I14 — the invitation', () => {
  it('two blocks in order, the set\'s city and never an address, the personal terms, the note, Accept · Counter · Decline (checks 26, 31)', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: DETAIL }));
    const n = nav();
    const { getByText, getByTestId, toJSON } = render(<InvitationScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('set-block'));
    getByText('🔒 Set by the brand, same for everyone'); getByText('Store Visit · Hyderabad'); getByText(`17 Oct ${yr}`);
    getByText('Your terms'); getByText('10% on what you sell'); getByText('Anything in the store'); getByText('Festive 15% off Sarees'); getByText('At least 1');
    getByText('“Loved your Diwali reels last year — would be great to have you at the Banjara Hills store.”');
    getByText('Nothing is final until you both sign the agreement.');
    const flat = JSON.stringify(toJSON());
    expect(flat.indexOf('Set by the brand')).toBeLessThan(flat.indexOf('Your terms'));
    expect(flat).not.toMatch(/Road No|address/i);
    getByTestId('accept'); getByTestId('decline');
    // Item 6 (N1): Counter now asks which — the money and the work, or the date and the mode.
    fireEvent.press(getByTestId('counter'));
    getByText('What would you like to change?');
    fireEvent.press(getByTestId('choice-continue'));
    expect(n.navigate).toHaveBeenCalledWith('Counter', { ciId: 'ci1' });
  });

  it('a Pay for Content invitation spells out the deliverables and the 25/25/50 split in rupees (check 27)', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: CONTENT_DETAIL }));
    const { getByText, getByTestId } = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci2' } }} />);
    await waitFor(() => getByTestId('pay-split'));
    getByText('₹8,000'); getByText('1 Instagram reel, 2 Instagram stories'); getByText('60 days · social and ads');
    getByText('₹2,000 when you both sign · ₹2,000 when the brand confirms your content is live · ₹4,000 after it stays live');
  });

  it('Accept confirms then calls the API; Counter is hidden when negotiation is off (checks 28, 37)', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...DETAIL, canCounter: false } }));
    influencerApi.acceptInvitation.mockResolvedValue(ok({ invitation: { ...DETAIL, status: 'accepted', group: 'accepted', canAnswer: false, canCounter: false } }));
    const { getByText, getAllByText, getByTestId, queryByTestId } = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('accept'));
    expect(queryByTestId('counter')).toBeNull();
    fireEvent.press(getByTestId('accept'));
    getByText('Accept these terms?'); getByText('Urban Threads will send the agreement next. Nothing is final until you both sign it.');
    const accepts = getAllByText('Accept');
    fireEvent.press(accepts[accepts.length - 1]);
    await waitFor(() => expect(influencerApi.acceptInvitation).toHaveBeenCalledWith('ci1'));
    await waitFor(() => getByTestId('state-chip-accepted'));
    getByText('Waiting for the agreement from Urban Threads.');
    expect(queryByTestId('answer-actions')).toBeNull();
  });

  it('Decline needs a reason, keeps the note, sends both (check 29)', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: DETAIL }));
    influencerApi.declineInvitation.mockResolvedValue(ok({ invitation: { ...DETAIL, status: 'declined', group: 'declined', canAnswer: false, endedAt: `${yr}-09-13T10:00:00Z` } }));
    const { getByText, getByTestId } = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('decline'));
    fireEvent.press(getByTestId('decline'));
    getByText('Why are you saying no?');
    ['Fee too low', "Dates don't suit", 'Not my kind of brand', 'Too much work', 'Other'].forEach(l => getByText(l));
    getByText('The brand sees this. It helps them come back with something better.');
    fireEvent.press(getByTestId('decline-confirm'));
    getByText(MSG5.DECLINE_REASON);
    expect(influencerApi.declineInvitation).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('reason-schedule_conflict'));
    fireEvent.changeText(getByTestId('decline-note'), 'Travelling that week.');
    fireEvent.press(getByTestId('decline-confirm'));
    await waitFor(() => expect(influencerApi.declineInvitation).toHaveBeenCalledWith('ci1', { reason: 'schedule_conflict', note: 'Travelling that week.' }));
    await waitFor(() => getByTestId('state-chip-declined'));
  });

  it('after the cutoff the three actions disappear and the invitation reads as expired (check 30)', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: { ...DETAIL, status: 'invited', group: 'expired', canAnswer: false, canCounter: false, cutoff: `${yr}-09-11` } }));
    const { getByText, getByTestId, queryByTestId } = render(<InvitationScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('invitation-expired'));
    getByText("You didn't reply by 11 Sep, so this invitation closed.");
    expect(queryByTestId('answer-actions')).toBeNull();
    expect(queryByTestId('accept')).toBeNull(); expect(queryByTestId('counter')).toBeNull(); expect(queryByTestId('decline')).toBeNull();
  });
});
