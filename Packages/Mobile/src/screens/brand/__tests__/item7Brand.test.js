/**
 * Item 7 — the brand app: P1 where the agreement starts, P2 the preview, P3
 * sending it, P9 the money in view, P10 not enough money, P11 the last
 * signature, P12 both signed, P14 withdrawing.
 * Contract: features/item7-agreement
 */
import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    setSummary: jest.fn(), getPool: jest.fn(), invitationDetail: jest.fn(),
    updateCampaignSet: jest.fn(), deleteCampaignSet: jest.fn(), duplicateSet: jest.fn(), listBranches: jest.fn(),
    withdrawInvitation: jest.fn(), removeInvitation: jest.fn(),
    agreementPreview: jest.fn(), sendAgreement: jest.fn(), getAgreement: jest.fn(),
    agreementCost: jest.fn(), signAgreement: jest.fn(), withdrawAgreement: jest.fn(),
    agreementDocument: jest.fn(),
  },
  influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));
jest.mock('../../../utils/openWebDashboard', () => ({ openWebDashboard: jest.fn() }));

const { brandApi } = require('../../../services/api');
const BrandAgreementScreen = require('../BrandAgreementScreen').default;
const BrandSetDetailScreen = require('../BrandSetDetailScreen').default;
const { MSG7 } = require('../../../components/agreement/copy7');
const { openWebDashboard } = require('../../../utils/openWebDashboard');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const bad = (message, code = 'VALIDATION_ERROR') => ({ success: false, error: { code, message } });
const yr = new Date().getFullYear();

const TERMS = {
  aim: 'engagement', campaignName: 'Diwali Edit 2026', setName: 'Set A',
  postingDate: `${yr}-10-24`, cutoff: `${yr}-10-17`,
  shootMode: 'shipment', branchName: null, branchCity: null,
  parties: {
    brand: { name: 'Urban Threads', city: 'Hyderabad', state: 'Telangana' },
    creator: { name: 'Tanvi Suresh', city: 'Hyderabad', state: 'Telangana', handle: 'tanvi.styles' },
  },
  money: { fee: 9000, commissionPct: null, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720,
    split: { t1: 2250, t2: 2250, t3: 4500 }, splitPct: [25, 25, 50], commissionAfterDays: null },
  work: { deliverables: [{ type: 'reel', count: 1 }], deliverablesWords: '1 Instagram reel', usageRights: null, minShoppablePosts: null },
  sell: null, returnTerms: { days: 7, brandPaysShipping: true }, note: null,
  termsVersion: '1.0', generatedAt: `${yr}-09-14T10:00:00Z`,
};

const AG = (over = {}) => ({
  invitationId: 'ci1', contractId: 'k1', reference: 'INFLX-2026-00457',
  status: 'pending_brand', sentAt: `${yr}-09-14T10:00:00Z`,
  cutoff: `${yr}-10-17`, daysLeft: 4, cutoffPassed: false,
  terms: TERMS, standardTerms: { version: '1.0' },
  signatures: { creator: { name: 'Tanvi Suresh', at: `${yr}-09-14T11:04:00Z`, device: 'Android', ip: '103.21.58.14' }, brand: null },
  ending: null,
  money: { fee: 9000, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720, split: TERMS.money.split, splitPct: [25, 25, 50], locked: null, released: null, stillLocked: null, at: null },
  can: { send: false, sign: true, withdraw: false, download: false },
  document: { available: false, generatedAt: null },
  ...over,
});

const COST = (over = {}) => ({
  gate: true, fee: 9000, campaignFeePct: 8, campaignFee: 720, totalToLock: 9720,
  payouts: { t1: 2250, t2: 2250, t3: 4500 }, payoutPct: [25, 25, 50],
  availableBalance: 24000, shortfall: 0, enough: true,
  line: 'Your wallet has ₹24,000 available. Enough.',
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('P2 · P3 — the preview and sending', () => {
  it('shows exactly what she will see, says nothing can be edited, and sends on a confirm', async () => {
    brandApi.agreementPreview.mockResolvedValue(ok({ agreement: {
      ...AG({ reference: null, status: 'draft', sentAt: null, signatures: { creator: null, brand: null },
        can: { send: true, sign: false, withdraw: false, download: false } }),
      draft: true,
    } }));
    // ASSERTION DRIFT — ui-walk-fixes board F, frame F4 (drift/F.md). The stand-in for "sent"
    // used to be AG({ status: 'pending_influencer' }), which still carried HER signature and
    // can.sign — an agreement that cannot exist (out for her signature and already signed by her).
    // It is the true sent-and-unsigned shape now: no signature, nothing to sign, Withdraw allowed.
    brandApi.sendAgreement.mockResolvedValue(ok({ agreement: AG({
      status: 'pending_influencer', signatures: { creator: null, brand: null },
      can: { send: false, sign: false, withdraw: true, download: false },
    }) }));
    const n = nav();
    const { getByText, getByTestId, queryByText, queryByTestId } = render(
      <BrandAgreementScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1', preview: true } }} />
    );
    await waitFor(() => getByTestId('brand-agreement-body'));

    // ASSERTION DRIFT — board F (frames F4 / F5; drift/F.md). This asserted 'DRAFT · DRAFT': the
    // word was printed twice (the missing reference fell back to DRAFT and the suffix said DRAFT
    // again). The preview prints a single DRAFT.
    expect(getByTestId('agreement-reference').props.children).toBe('DRAFT');
    expect(queryByText('DRAFT · DRAFT')).toBeNull();
    // The preview still shows no signature boxes and no waiting sentence (F4 is the SENT state).
    expect(queryByTestId('signature-creator')).toBeNull();
    expect(queryByTestId('waiting-for-her')).toBeNull();
    getByText('The two of you');
    getByText('Urban Threads, Hyderabad'); getByText('Tanvi Suresh, Hyderabad');
    getByText('What was agreed');
    getByText('Pay for Content'); getByText('₹9,000'); getByText('1 Instagram reel');
    getByText('Version 1.0 · what the platform does, disputes, cancellation');
    getByText('Nothing here can be edited. It is built from the terms you both agreed.');

    fireEvent.press(getByTestId('send-for-signature'));
    getByText('Send this agreement to Tanvi?');
    getByText('What happens');
    getByText('First'); getByText('After her'); getByText('17 Oct 2026');
    getByText('Nothing can be changed once it is sent. If you need different terms, remove Tanvi from the set and invite her again while there is still time.');

    fireEvent.press(getByTestId('send-confirm'));
    await waitFor(() => expect(brandApi.sendAgreement).toHaveBeenCalledWith('c1', 'sA', 'ci1'));
    // Board F, frame F4 (check 21): the brand STAYS on the agreement. The route is replaced by the
    // same screen out of preview, carrying "Agreement sent." — it is no longer sent back to the set.
    await waitFor(() => expect(n.replace).toHaveBeenCalledWith('BrandAgreement', { campaignId: 'c1', setId: 'sA', ciId: 'ci1', preview: false, toast: 'Agreement sent.' }));
    expect(n.goBack).not.toHaveBeenCalled();
  });
});

describe('P9 · P11 · P12 — signing, with the money in view', () => {
  it('P9 — the cost, the payouts and the balance, then the sheet that spells out what is irreversible', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: AG() }));
    brandApi.agreementCost.mockResolvedValue(ok({ cost: COST() }));
    brandApi.signAgreement.mockResolvedValue(ok({ agreement: AG({
      status: 'active',
      signatures: { creator: AG().signatures.creator, brand: { name: 'Ravi Menon', at: `${yr}-09-14T18:18:00Z`, device: 'iOS', ip: '49.207.14.92' } },
      money: { ...AG().money, locked: 9720, released: 2250, stillLocked: 7470, at: `${yr}-09-14T18:18:00Z` },
      can: { send: false, sign: false, withdraw: false, download: true },
    }) }));
    const { getByText, getByTestId } = render(
      <BrandAgreementScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />
    );
    await waitFor(() => getByTestId('what-it-costs'));

    getByText('Tanvi signed on 14 Sep. Your signature completes it.');
    getByText("Tanvi's fee");
    getByTestId('cost-fee');
    getByText('INFLX campaign fee · 8%'); getByText('₹720');
    getByText('Locked when you sign'); getByText('₹9,720');
    getByText('Paid out as');
    getByText('To Tanvi when you sign');
    getByText('Your wallet has ₹24,000 available. Enough.');
    getByText("Signing locks ₹9,720 of your balance for this collaboration. It can't be spent on anything else.");

    fireEvent.press(getByTestId('brand-sign'));
    getByText('Signing for Urban Threads.');
    getByText('I understand ₹9,720 will be locked now and ₹2,250 released to Tanvi straight away.');
    getByText('After this, the terms can never be changed inside this collaboration.');

    // A typed name and both ticks, refused on the phone in the server's words.
    fireEvent.press(getByTestId('brand-sign-submit'));
    getByText(MSG7.NAME_EMPTY);
    fireEvent.changeText(getByTestId('brand-sign-name'), 'Ravi Menon');
    fireEvent.press(getByTestId('brand-sign-submit'));
    getByText(MSG7.TICKS);
    fireEvent.press(getByTestId('brand-tick-read'));
    fireEvent.press(getByTestId('brand-tick-money'));
    fireEvent.press(getByTestId('brand-sign-submit'));

    await waitFor(() => expect(brandApi.signAgreement).toHaveBeenCalledWith('c1', 'sA', 'ci1', { typedName: 'Ravi Menon', ticks: [true, true] }));

    // P12 — what happened just now, and the one thing to do next.
    await waitFor(() => getByTestId('money-moved'));
    getByText('Signed by both on 14 Sep. This collaboration is live.');
    getByText('Locked'); getByText('Released to Tanvi'); getByText('Still locked');
    getByText('₹7,470');
    getByText('Ship the products to Tanvi. The shoot plan is open now.');
    getByTestId('signature-creator'); getByTestId('signature-brand');
  });

  it('P10 — not enough money: the shortfall as an amount, and the sign button disabled', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: AG() }));
    brandApi.agreementCost.mockResolvedValue(ok({ cost: COST({
      availableBalance: 6000, shortfall: 3720, enough: false,
      line: 'Your wallet has ₹6,000 available and this needs ₹9,720.',
    }) }));
    const n = nav();
    const { getByText, getByTestId } = render(
      <BrandAgreementScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />
    );
    await waitFor(() => getByTestId('shortfall'));
    getByText('Add ₹3,720 to sign');
    getByText('Your wallet has ₹6,000 available and this needs ₹9,720.');
    getByText("We'll bring you straight back here to sign.");
    getByText('Tanvi signed on 14 Sep and is waiting. If nobody signs by 17 Oct, this closes on its own.');

    // features/brand-wallet-on-the-phone — this used to try to open the website, which Android 11+
    // refuses. It now goes to the in-app Add money screen, carrying the exact shortfall, what the
    // two halves of it are, and where to come back to.
    fireEvent.press(getByTestId('add-to-wallet'));
    expect(n.navigate).toHaveBeenCalledWith('BrandAddMoney', {
      need: 3720,
      forWhom: 'Tanvi',
      fee: 9000,
      campaignFee: 720,
      returnTo: { screen: 'BrandAgreement', params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } },
    });

    // The sign button is there but cannot be used.
    const btn = getByTestId('brand-sign');
    expect(btn.props.accessibilityState.disabled).toBe(true);
  });

  it('a Pay for Sale agreement has no money card and completes on the signature', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: AG({
      terms: { ...TERMS, aim: 'conversion',
        money: { fee: null, commissionPct: 12, campaignFeePct: 0, campaignFee: 0, totalToLock: 0, split: null, splitPct: [25, 25, 50], commissionAfterDays: 7 },
        work: { deliverables: null, deliverablesWords: null, usageRights: null, minShoppablePosts: 1 },
        sell: { scope: 'store', words: 'Anything in the store' }, returnTerms: null },
    }) }));
    brandApi.agreementCost.mockResolvedValue(ok({ cost: { gate: false, fee: 0, campaignFeePct: 0, campaignFee: 0, totalToLock: 0, payouts: null, availableBalance: 24000, shortfall: 0, enough: true, line: '' } }));
    const { getByText, getByTestId, queryByTestId } = render(
      <BrandAgreementScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />
    );
    await waitFor(() => getByTestId('brand-agreement-body'));
    expect(queryByTestId('what-it-costs')).toBeNull();
    expect(queryByTestId('paid-out-as')).toBeNull();
    getByText('12% on what she sells');
    getByText('Sign and complete');
  });
});

describe('P14 — withdrawing', () => {
  it('is possible only while she has not signed, and says what to do instead', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: AG({
      status: 'pending_influencer',
      signatures: { creator: null, brand: null },
      can: { send: false, sign: false, withdraw: true, download: false },
    }) }));
    brandApi.withdrawAgreement.mockResolvedValue(ok({ agreement: AG({ status: 'withdrawn' }) }));
    const n = nav();
    const { getByText, getByTestId } = render(
      <BrandAgreementScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />
    );
    await waitFor(() => getByTestId('withdraw-actions'));
    fireEvent.press(getByTestId('brand-withdraw'));
    getByText('Withdraw this agreement?');
    getByText("Tanvi hasn't signed yet. She goes back to waiting for an agreement, and you can send the same one again.");
    getByText("The terms can't be changed. To offer something different, remove Tanvi from the set and invite her again while there is still time.");
    fireEvent.press(getByTestId('withdraw-confirm'));
    await waitFor(() => expect(brandApi.withdrawAgreement).toHaveBeenCalledWith('c1', 'sA', 'ci1'));
    // Board F, frame F6: back on the set, which is handed "Agreement withdrawn." to show. (It used
    // to raise the message on this screen and close it in the same instant.)
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('BrandSetDetail', { campaignId: 'c1', setId: 'sA', toast: 'Agreement withdrawn.' }));
    expect(n.goBack).not.toHaveBeenCalled();
  });
});

/**
 * ui-walk-fixes — final review, finding F-4 (frame F4, the waiting sentence).
 *
 * The blue box reads "Sent to {name} on {day}. Waiting for her to sign by {day}." An agreement put
 * out through the website's "Approve & Send" is out for her signature (`pending_influencer`) but
 * carries no sent date, no reference and no Withdraw (drift/CSRV.md). Its row on the set reads
 * "Waiting to sign"; tapping it opened this screen with "Sent to Tanvi on . Waiting for her to
 * sign by 17 Oct." — a sentence with a hole where the date belongs. The box is now drawn only
 * when there is a date to put in it.
 */
describe('F4 — the waiting sentence is drawn only when there is a sent date to put in it', () => {
  const OUT = (over = {}) => AG({
    status: 'pending_influencer', signatures: { creator: null, brand: null },
    can: { send: false, sign: false, withdraw: true, download: false }, ...over,
  });
  const open = async (agreement) => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement }));
    const r = render(<BrandAgreementScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('brand-agreement-body'));
    return r;
  };

  it('put out through the website (no sent date): no sentence with a hole in it; the two "Not signed yet" boxes and who signs first still say whose turn it is', async () => {
    const r = await open(OUT({ sentAt: null, reference: null, can: { send: false, sign: false, withdraw: false, download: false } }));
    expect(r.queryByTestId('waiting-for-her')).toBeNull();
    expect(r.queryByText(/Sent to/)).toBeNull();
    expect(r.queryByText(/ on \./)).toBeNull();
    // Whose turn it is, without a date: both boxes outlined and empty, and the line under them.
    r.getByText('SIGNATURES');
    for (const who of ['creator', 'brand']) within(r.getByTestId(`signature-${who}`)).getByText('Not signed yet');
    within(r.getByTestId('signature-creator')).getByText('Tanvi Suresh');
    expect(r.getByTestId('you-sign-after').props.children).toBe('You sign after her. Nothing is binding until both signatures are on it.');
    // The terms are all there, and nothing is offered that the server would refuse (drift/CSRV.md).
    r.getByTestId('two-of-you'); r.getByTestId('what-agreed');
    expect(r.queryByTestId('brand-withdraw')).toBeNull();
    expect(r.queryByTestId('send-for-signature')).toBeNull();
    expect(r.queryByTestId('brand-sign')).toBeNull();
  });

  it('sent from the phone (a sent date): the dated sentence, as frame F4 draws it, with the quiet Withdraw', async () => {
    const r = await open(OUT({ sentAt: `${yr}-10-13T10:00:00Z` }));
    within(r.getByTestId('waiting-for-her')).getByText('Sent to Tanvi on 13 Oct. Waiting for her to sign by 17 Oct.');
    for (const who of ['creator', 'brand']) within(r.getByTestId(`signature-${who}`)).getByText('Not signed yet');
    r.getByTestId('you-sign-after');
    r.getByTestId('brand-withdraw');
  });
});

describe('P1 — where the agreement starts', () => {
  const row = (o) => ({
    id: o.id, influencerId: `i-${o.id}`, name: o.name, avatarUrl: null,
    status: o.status || 'accepted', group: o.group || 'yourMove', termsLine: '12% · whole store · no offer',
    sentAt: `${yr}-09-12T10:00:00Z`, answeredAt: `${yr}-09-13T10:00:00Z`, signedAt: o.signedAt || null,
    negotiation: null, moveRequest: null,
    actions: { withdraw: false, remove: true, viewTerms: true, thread: false, ...o.actions },
    agreement: o.agreement || null,
  });

  it('two different "your move"s sit together: one needs sending, one needs signing', async () => {
    brandApi.setSummary.mockResolvedValue(ok({
      campaign: { id: 'c1', name: 'Diwali Edit 2026', status: 'active' },
      dateRules: { earliestPostingDate: `${yr}-10-01` },
      set: { id: 'sA', name: 'Set A · Ethnic wear', goal: 'conversion', shootMode: 'visit', postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysToCutoff: 4, state: 'live', canInvite: { ok: true }, counts: { invited: 8, signed: 1, waiting: 2, declined: 3 } },
      creators: {
        order: ['yourMove', 'waiting', 'signed'],
        groups: {
          yourMove: { key: 'yourMove', title: 'Your move', count: 2, more: 0, rows: [
            row({ id: 'r1', name: 'Sneha N.', actions: { sendAgreement: true, signAgreement: false } }),
            row({ id: 'r2', name: 'Tanvi S.', actions: { sendAgreement: false, signAgreement: true },
              agreement: { reference: 'INFLX-2026-00457', status: 'pending_brand', sentAt: `${yr}-09-13T10:00:00Z`, creatorSignedAt: `${yr}-09-14T10:00:00Z`, brandSignedAt: null, line: null } }),
          ] },
          waiting: { key: 'waiting', title: 'Waiting to answer', count: 1, more: 0, rows: [
            row({ id: 'r3', name: 'Priya Sharma', group: 'waiting', actions: { withdrawAgreement: true },
              agreement: { reference: 'INFLX-2026-00458', status: 'pending_influencer', sentAt: `${yr}-09-14T10:00:00Z`, creatorSignedAt: null, brandSignedAt: null, line: null } }),
          ] },
          signed: { key: 'signed', title: 'Signed', count: 1, more: 0, rows: [
            row({ id: 'r4', name: 'Divya R.', group: 'signed', status: 'contracted', signedAt: `${yr}-09-13T10:00:00Z` }),
          ] },
        },
      },
    }));
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(
      <BrandSetDetailScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />
    );
    await waitFor(() => getByTestId('creators-block'));

    // ASSERTION DRIFT — ui-walk-fixes board F, frame F1 (drift/F.md). "Send agreement" and "Sign"
    // were green pills that looked like the "Live" tag. They are labelled buttons now: the label
    // is still its own text (found exactly, below) with an arrow beside it, and the testID is kept.
    getByText('Send agreement');
    getByText('Sign');
    within(getByTestId('chip-r1')).getByText('Send agreement');
    within(getByTestId('chip-r1')).getByText('chevron-right');
    expect(getByTestId('chip-r1').props.accessibilityRole).toBe('button');
    within(getByTestId('chip-r2')).getByText('Sign');
    getByText('Signed 14 Sep · waiting for you');
    getByText('Agreement sent 14 Sep');
    getByText('Signed by both 13 Sep');

    // The chip is the brand's actual next move on that row.
    fireEvent.press(getByTestId('chip-r1'));
    expect(n.navigate).toHaveBeenCalledWith('BrandAgreement', { campaignId: 'c1', setId: 'sA', ciId: 'r1', preview: true });
    fireEvent.press(getByTestId('chip-r2'));
    expect(n.navigate).toHaveBeenCalledWith('BrandAgreement', { campaignId: 'c1', setId: 'sA', ciId: 'r2', preview: false });

    // Board F (check 20): the agreement that is out sits in its own group, "Waiting for the
    // creator", with a "Waiting to sign" tag — no longer under "Waiting to answer" with no tag —
    // and a signed row with nothing owed is "Active".
    within(getByTestId('group-waitingCreator')).getByText('Waiting for the creator');
    within(getByTestId('group-waitingCreator')).getByText('Priya Sharma');
    within(getByTestId('tag-r3')).getByText('Waiting to sign');
    expect(queryByTestId('group-waiting')).toBeNull();
    within(getByTestId('tag-r4')).getByText('Active');
  });
});

/**
 * The sign sheet that would not go away.
 * Contract: features/hybrid-signature-and-the-silent-refusal
 *
 * A refused signature used to be announced with a toast, which renders behind the modal. So the
 * brand saw nothing at all: the sheet simply stayed open, she tried again, and it "kept coming
 * back". The refusal now appears inside the sheet, where she is looking.
 */
describe('a refused signature says why, in the sheet', () => {
  it('shows the server reason inside the sheet, and keeps the sheet open', async () => {
    brandApi.getAgreement.mockResolvedValue(ok({ agreement: AG() }));
    brandApi.agreementCost.mockResolvedValue(ok({ cost: COST() }));
    brandApi.signAgreement.mockResolvedValue({ success: false, error: { message: 'This campaign pays for content, so the set has to say what content.' } });

    const n = nav();
    const { getByTestId, getByText, queryByTestId } = render(
      <BrandAgreementScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />
    );
    await waitFor(() => getByTestId('brand-sign'));
    fireEvent.press(getByTestId('brand-sign'));
    await waitFor(() => getByTestId('brand-sign-sheet'));

    fireEvent.changeText(getByTestId('brand-sign-name'), 'Kanchi Silks');
    fireEvent.press(getByTestId('brand-tick-read'));
    fireEvent.press(getByTestId('brand-tick-money'));
    fireEvent.press(getByTestId('brand-sign-submit'));

    // the reason is on screen, and the sheet is still open so she can act on it
    await waitFor(() => getByText('This campaign pays for content, so the set has to say what content.'));
    expect(queryByTestId('brand-sign-sheet')).not.toBeNull();
  });
});
