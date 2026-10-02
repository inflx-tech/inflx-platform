/**
 * Item 7 — the creator app: P4 the agreement arrives, P5 reading it, P6 signing,
 * P7 signed and waiting, P8 declining, P16 it moves to Active.
 * Contract: features/item7-agreement
 */
import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: {
    myInvitations: jest.fn(), myInvitation: jest.fn(),
    myAgreement: jest.fn(), signMyAgreement: jest.fn(), declineMyAgreement: jest.fn(),
    myAgreementDocument: jest.fn(),
  },
  brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi } = require('../../../services/api');
const AgreementScreen = require('../AgreementScreen').default;
const CollabsScreen = require('../CollabsScreen').default;
const { MSG7 } = require('../../../components/agreement/copy7');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();

const TERMS = {
  aim: 'engagement',
  campaignName: 'Diwali Edit 2026', setName: 'Set A',
  postingDate: `${yr}-10-24`, cutoff: `${yr}-10-17`,
  shootMode: 'shipment', branchName: null, branchCity: null,
  parties: {
    brand: { name: 'Stride Kicks', city: 'Hyderabad', state: 'Telangana' },
    creator: { name: 'Sneha Narayan', city: 'Hyderabad', state: 'Telangana', handle: 'sneha.styles' },
  },
  money: {
    fee: 8000, commissionPct: null, campaignFeePct: 8, campaignFee: 640, totalToLock: 8640,
    split: { t1: 2000, t2: 2000, t3: 4000 }, splitPct: [25, 25, 50], commissionAfterDays: null,
  },
  work: {
    deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }],
    deliverablesWords: '1 Instagram reel, 2 stories',
    usageRights: { on: true, durationDays: 60, places: ['social', 'ads'], words: '60 days · social and ads' },
    minShoppablePosts: null,
  },
  sell: null,
  returnTerms: { days: 7, brandPaysShipping: true },
  note: null,
  termsVersion: '1.0',
  generatedAt: `${yr}-09-14T10:00:00Z`,
};

const AG = (over = {}) => ({
  invitationId: 'ci1', contractId: 'k1', reference: 'INFLX-2026-00456',
  status: 'pending_influencer', sentAt: `${yr}-09-14T10:00:00Z`,
  cutoff: `${yr}-10-17`, daysLeft: 4, cutoffPassed: false,
  terms: TERMS,
  standardTerms: { version: '1.0' },
  signatures: { creator: null, brand: null },
  ending: null,
  money: { fee: 8000, campaignFeePct: 8, campaignFee: 640, totalToLock: 8640, split: TERMS.money.split, splitPct: [25, 25, 50], locked: null, released: null, stillLocked: null, at: null },
  can: { sign: true, decline: true, download: false },
  document: { available: false, generatedAt: null },
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('P5 — reading it', () => {
  it('what you get first, with the three real payments, then what you do', async () => {
    influencerApi.myAgreement.mockResolvedValue(ok({ agreement: AG() }));
    const { getByText, getByTestId } = render(<AgreementScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('agreement-body'));

    getByText('INFLX-2026-00456 · Stride Kicks');   // uppercased by style, not by content
    getByText('Sign by 17 Oct · 4 days left');

    // What you get — the fee broken into the three payments she will actually receive.
    getByText('What you get');
    getByText('₹8,000');
    getByText('When you both sign'); getByText('When your content is live'); getByText('After it stays live');
    getByTestId('split-t1'); getByTestId('split-t2'); getByTestId('split-t3');
    getByText('₹4,000');

    // What you do.
    getByText('What you do');
    getByText('1 Instagram reel, 2 stories');
    getByText('24 Oct 2026');
    getByText('Remote · they ship to you');
    getByText('60 days · social and ads');

    // Remote return terms, and the standard terms with their version.
    getByText('Returning the products');
    getByText("Send back anything you don't keep within 7 days of posting. Stride Kicks pay the return shipping.");
    getByText('Version 1.0 · read before you sign');

    getByTestId('agreement-sign'); getByTestId('agreement-decline');
  });

  it('a Pay for Sale agreement shows commission and the shoppable minimum, and no fee', async () => {
    influencerApi.myAgreement.mockResolvedValue(ok({ agreement: AG({
      terms: { ...TERMS, aim: 'conversion',
        money: { fee: null, commissionPct: 12, campaignFeePct: 0, campaignFee: 0, totalToLock: 0, split: null, splitPct: [25, 25, 50], commissionAfterDays: 7 },
        work: { deliverables: null, deliverablesWords: null, usageRights: null, minShoppablePosts: 1 },
        sell: { scope: 'store', words: 'Anything in the store' },
        returnTerms: null },
    }) }));
    const { getByText, queryByTestId, getByTestId } = render(<AgreementScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('agreement-body'));
    getByText('12% on what you sell');
    getByText('After the 7-day return window');
    getByText('Anything in the store');
    getByText('At least 1');
    expect(queryByTestId('fee-row')).toBeNull();
    expect(queryByTestId('split-t1')).toBeNull();
    expect(queryByTestId('return-terms')).toBeNull();
  });
});

describe('P6 — signing', () => {
  it('needs a typed name and both ticks, then records the signature', async () => {
    influencerApi.myAgreement.mockResolvedValue(ok({ agreement: AG() }));
    influencerApi.signMyAgreement.mockResolvedValue(ok({ agreement: AG({
      status: 'pending_brand',
      signatures: { creator: { name: 'Sneha Narayan', at: `${yr}-09-14T11:02:00Z`, device: 'Android', ip: '103.21.58.14' }, brand: null },
      can: { sign: false, decline: false, download: false },
    }) }));
    const { getByText, getByTestId, queryByTestId } = render(<AgreementScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('agreement-actions'));
    fireEvent.press(getByTestId('agreement-sign'));

    getByText('Sign this agreement');
    getByText('As it should appear on the agreement.');
    getByText('We record your name, the time and the device you signed from.');

    // The name is pre-filled from the account; the ticks are not.
    fireEvent.press(getByTestId('sign-submit'));
    getByText(MSG7.TICKS);
    fireEvent.press(getByTestId('tick-read'));
    fireEvent.press(getByTestId('sign-submit'));
    getByText(MSG7.TICKS);
    fireEvent.press(getByTestId('tick-binding'));
    fireEvent.press(getByTestId('sign-submit'));

    await waitFor(() => expect(influencerApi.signMyAgreement).toHaveBeenCalledWith('ci1', { typedName: 'Sneha Narayan', ticks: [true, true] }));
    await waitFor(() => getByTestId('agreement-waiting'));
  });

  it('an empty name is refused before it leaves the phone', async () => {
    influencerApi.myAgreement.mockResolvedValue(ok({ agreement: AG({
      terms: { ...TERMS, parties: { ...TERMS.parties, creator: { ...TERMS.parties.creator, name: '' } } },
    }) }));
    const { getByText, getByTestId } = render(<AgreementScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('agreement-actions'));
    fireEvent.press(getByTestId('agreement-sign'));
    fireEvent.press(getByTestId('tick-read'));
    fireEvent.press(getByTestId('tick-binding'));
    fireEvent.press(getByTestId('sign-submit'));
    getByText(MSG7.NAME_EMPTY);
    expect(influencerApi.signMyAgreement).not.toHaveBeenCalled();
  });
});

describe('P7 — signed, waiting', () => {
  it('both signature boxes, and what happens if they never sign', async () => {
    influencerApi.myAgreement.mockResolvedValue(ok({ agreement: AG({
      status: 'pending_brand',
      signatures: { creator: { name: 'Sneha Narayan', at: `${yr}-09-14T11:02:00Z`, device: 'Android', ip: '103.21.58.14' }, brand: null },
      can: { sign: false, decline: false, download: false },
    }) }));
    const { getByText, getByTestId } = render(<AgreementScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('agreement-body'));
    getByText('Signed. Waiting for Stride Kicks to sign by 17 Oct.');
    getByTestId('signature-creator'); getByTestId('signature-brand');
    getByText('Not signed yet');
    getByText("Nothing is binding until both signatures are on it. If they don't sign by 17 Oct, this closes and neither of you owes anything.");
  });
});

describe('P8 — declining at signing', () => {
  it('needs one of the six reasons, and the sixth is the agreement itself', async () => {
    influencerApi.myAgreement.mockResolvedValue(ok({ agreement: AG() }));
    influencerApi.declineMyAgreement.mockResolvedValue(ok({ agreement: AG({
      status: 'declined',
      ending: { outcome: 'declined', at: `${yr}-09-15T10:00:00Z`, text: 'Sneha declined the agreement on 15 Sep: the agreement terms.' },
      can: { sign: false, decline: false, download: false },
    }) }));
    const { getByText, getByTestId } = render(<AgreementScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('agreement-actions'));
    fireEvent.press(getByTestId('agreement-decline'));

    getByText('This ends the collaboration with Stride Kicks for this set. They can invite you again if there is still time.');
    getByText('Why are you saying no?');
    getByText('The agreement terms');
    getByText('The brand sees this.');

    fireEvent.press(getByTestId('decline-confirm'));
    getByText(MSG7.DECLINE_REASON);
    fireEvent.press(getByTestId('reason-agreement_terms'));
    fireEvent.press(getByTestId('decline-confirm'));
    await waitFor(() => expect(influencerApi.declineMyAgreement).toHaveBeenCalledWith('ci1', { reason: 'agreement_terms', note: undefined }));
    await waitFor(() => getByTestId('agreement-ending'));
  });
});

describe('P4 · P16 — the cards', () => {
  const CARD = {
    id: 'ci1', status: 'accepted', group: 'toSign', brand: { name: 'Urban Threads', logoUrl: null },
    campaignName: 'Diwali Edit 2026', setName: 'Set A', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad',
    postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysLeft: 4, commissionPct: 12, fee: null,
    canAnswer: false, canCounter: false, negotiation: null, moveRequest: null, pool: null, fromPool: null,
    set: {}, terms: {}, note: null,
    agreement: { reference: 'INFLX-2026-00456', status: 'pending_influencer', sentAt: `${yr}-09-14T10:00:00Z`, signedAt: null, bothSignedAt: null, line: 'Agreement ready to sign · by 17 Oct', canSign: true, canDownload: false },
  };

  it('P4 — it stays under Invites, with Your move and the same deadline she has always seen', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [CARD] }));
    const n = nav();
    const { getByText, getByTestId } = render(<CollabsScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('invitation-card-ci1'));
    getByText('Agreement ready to sign · by 17 Oct');
    getByTestId('card-chip-toSign');
    // ui-walk-fixes board F, frame F7: the tag says "Your move", and the card carries a button
    // that names the step. (The tag keeps its testID; it was a bare pill with no button under it.)
    within(getByTestId('card-chip-toSign')).getByText('Your move');
    within(getByTestId('card-action-ci1')).getByText('Review & sign');
    // Tapping it opens the agreement, not the invitation.
    fireEvent.press(getByTestId('invitation-card-ci1'));
    expect(n.navigate).toHaveBeenCalledWith('Agreement', { ciId: 'ci1' });
    // …and so does its button.
    fireEvent.press(getByTestId('card-action-ci1'));
    expect(n.navigate).toHaveBeenCalledTimes(2);
    expect(n.navigate).toHaveBeenLastCalledWith('Agreement', { ciId: 'ci1' });
  });

  it('P16 — the Active tab is real, and says what is in her wallet and what happens next', async () => {
    influencerApi.myInvitations.mockResolvedValue(ok({ rows: [{
      ...CARD, group: 'signed', status: 'contracted', firstPayment: 2250,
      agreement: { ...CARD.agreement, status: 'active', signedAt: `${yr}-09-14T11:00:00Z`, bothSignedAt: `${yr}-09-14T18:18:00Z`, line: null, canSign: false, canDownload: true },
    }] }));
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<CollabsScreen navigation={n} route={{ params: { segment: 'Active' } }} />);
    await waitFor(() => getByTestId('invitation-card-ci1'));
    expect(influencerApi.myInvitations).toHaveBeenCalledWith('active');
    getByText('₹2,250 is in your wallet. Signed 14 Sep.');
    getByTestId('card-chip-signed');
    // ui-walk-fixes board F, frame F7 (check 24): nothing is hers to do yet, so the tag reads
    // "Active" and there is no button; the "Agreement" link P16 drew — never built — opens it.
    within(getByTestId('card-chip-signed')).getByText('Active');
    expect(queryByTestId('card-action-ci1')).toBeNull();
    fireEvent.press(getByTestId('card-agreement-ci1'));
    expect(n.navigate).toHaveBeenCalledWith('Agreement', { ciId: 'ci1' });
  });
});
