/**
 * Item 7 — the brand app: P1 where the agreement starts, P2 the preview, P3
 * sending it, P9 the money in view, P10 not enough money, P11 the last
 * signature, P12 both signed, P14 withdrawing.
 * Contract: features/item7-agreement
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

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
    brandApi.sendAgreement.mockResolvedValue(ok({ agreement: AG({ status: 'pending_influencer' }) }));
    const n = nav();
    const { getByText, getByTestId } = render(
      <BrandAgreementScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1', preview: true } }} />
    );
    await waitFor(() => getByTestId('brand-agreement-body'));

    getByText('DRAFT · DRAFT');
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
    const { getByText, getByTestId } = render(
      <BrandAgreementScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />
    );
    await waitFor(() => getByTestId('shortfall'));
    getByText('Add ₹3,720 to sign');
    getByText('Your wallet has ₹6,000 available and this needs ₹9,720.');
    getByText("We'll bring you straight back here to sign.");
    getByText('Tanvi signed on 14 Sep and is waiting. If nobody signs by 17 Oct, this closes on its own.');

    fireEvent.press(getByTestId('add-to-wallet'));
    expect(openWebDashboard).toHaveBeenCalled();

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
    const { getByText, getByTestId } = render(
      <BrandSetDetailScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />
    );
    await waitFor(() => getByTestId('creators-block'));

    getByText('Send agreement');
    getByText('Sign');
    getByText('Signed 14 Sep · waiting for you');
    getByText('Agreement sent 14 Sep');
    getByText('Signed by both 13 Sep');

    // The chip is the brand's actual next move on that row.
    fireEvent.press(getByTestId('chip-r1'));
    expect(n.navigate).toHaveBeenCalledWith('BrandAgreement', { campaignId: 'c1', setId: 'sA', ciId: 'r1', preview: true });
    fireEvent.press(getByTestId('chip-r2'));
    expect(n.navigate).toHaveBeenCalledWith('BrandAgreement', { campaignId: 'c1', setId: 'sA', ciId: 'r2', preview: false });
  });
});
