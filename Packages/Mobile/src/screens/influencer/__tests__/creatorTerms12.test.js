/**
 * creator-terms-v2 — the creator app: C1 the invitation's one "You can sell" row, C2 what you can
 * sell (read-only, with what she earns), C3 one offer, C4 the agreement's offers, C5 her notices.
 * Contract: features/creator-terms-v2 · rules Docs/OFFER_TERMS_POSTS_RULES.md §2.7, §2.11
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { myInvitation: jest.fn(), acceptInvitation: jest.fn(), declineInvitation: jest.fn(), mySell: jest.fn(), myOffer: jest.fn(),
    getNotifications: jest.fn(), markAllNotificationsRead: jest.fn(() => Promise.resolve({ success: true })),
    myAgreement: jest.fn(), signMyAgreement: jest.fn(), declineMyAgreement: jest.fn(), myAgreementDocument: jest.fn() },
  brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi } = require('../../../services/api');
const InvitationScreen = require('../InvitationScreen').default;
const CreatorSellScreen = require('../CreatorSellScreen').default;
const CreatorOfferScreen = require('../CreatorOfferScreen').default;
const CreatorNotificationsScreen = require('../CreatorNotificationsScreen').default;
const AgreementScreen = require('../AgreementScreen').default;
const { targetOf } = require('../CreatorNotificationsScreen');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();

const INVITATION = {
  id: 'ci1', status: 'invited', group: 'invited', brand: { name: 'Urban Threads', logoUrl: null }, campaignName: 'Diwali Denim', setName: 'Set A',
  goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad', postingDate: `${yr}-10-10`, cutoff: `${yr}-10-07`, daysLeft: 4, commissionPct: 10, fee: null,
  canAnswer: true, canCounter: true,
  set: { name: 'Set A', goal: 'conversion', shootMode: 'visit', cityName: 'Hyderabad', postingDate: `${yr}-10-10`, cutoff: `${yr}-10-07` },
  terms: { goal: 'conversion', commissionPct: 10, fee: null, scope: null, offer: null, shoppablePostsMin: 1,
    sell: { offers: [{ id: 'o1' }, { id: 'o2' }], products: { mode: 'chosen', count: 12 }, words: '2 offers + 12 products' } },
  note: null,
};
const SELL = {
  brand_name: 'Urban Threads', set_name: 'Set A', campaign_name: 'Diwali Denim', commission_pct: 10, words: '2 offers + 12 products',
  offers: [
    { id: 'o1', name: "20% off Levi's Jeans", deal: '20% off each item, up to ₹400', type_label: 'Discount · %', products: 24, starts_on: `${yr}-10-01`, ends_on: `${yr}-10-31`,
      display_status: 'live', thumbs: [{ id: 'a' }, { id: 'b' }], you_earn: { pays: 2099, earns: 210, line: '10% of ₹2,099 = ₹210' } },
    { id: 'o2', name: 'Any 2 Jeans for ₹2,999', deal: 'Shopper picks any 2 of 15 for ₹2,999', type_label: 'Bundle · Pick-any', products: 15, starts_on: `${yr}-10-10`, ends_on: `${yr}-11-10`,
      display_status: 'scheduled', thumbs: [], you_earn: { pays: 2999, earns: 300, line: '10% of ₹2,999 = ₹300' } },
  ],
  products: { mode: 'chosen', count: 12, list: [{ id: 'p1', name: 'Oxford white', price: 1299 }] },
};

beforeEach(() => jest.clearAllMocks());

describe('C1 — the invitation', () => {
  it('one "You can sell" row with offers + products, which opens What you can sell; no old scope or shopper offer', async () => {
    influencerApi.myInvitation.mockResolvedValue(ok({ invitation: INVITATION }));
    const n = nav();
    const { getByText, getByTestId, queryByText } = render(<InvitationScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('sell-row'));
    getByText('2 offers + 12 products ›');
    expect(queryByText('Anything in the store')).toBeNull();
    expect(queryByText('Shopper offer')).toBeNull();
    fireEvent.press(getByTestId('sell-row'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorSell', { ciId: 'ci1' });
  });
});

describe('C2 — what you can sell', () => {
  it('each offer: the deal, products, dates, what she earns; the normal-price list; read-only', async () => {
    influencerApi.mySell.mockResolvedValue(ok(SELL));
    const n = nav();
    const { getByText, getByTestId, queryByText } = render(<CreatorSellScreen navigation={n} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('creator-sell'));
    getByText('Urban Threads · Set A · you earn 10% on every sale');
    getByText('OFFERS · 2'); getByText("20% off Levi's Jeans"); getByText('20% off each item, up to ₹400');
    getByText('24 products · 1 Oct – 31 Oct');
    getByText('You earn · 10% of ₹2,099 = ₹210');
    getByText('AT NORMAL PRICE · 12');
    fireEvent.press(getByTestId('sell-normal'));
    getByText('Oxford white');
    getByText("When an offer ends, your posts using it leave the shop. Products at normal price keep selling until they're out of stock.");
    expect(queryByText('Counter')).toBeNull();
    fireEvent.press(getByTestId('sell-offer-o2'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorOffer', { ciId: 'ci1', offerId: 'o2' });
  });
});

describe('C3 — one offer', () => {
  it('how it works for shoppers, when it runs, what she earns, every product', async () => {
    influencerApi.myOffer.mockResolvedValue(ok({ offer: {
      id: 'o2', name: 'Any 2 Jeans for ₹2,999', type_label: 'Bundle · Pick-any', deal: 'Shopper picks any 2 of 15 for ₹2,999',
      how: 'They pick any 2 of these 15 products from your post and pay ₹2,999 together. All 2 must come from the same post.',
      starts_on: `${yr}-10-10`, ends_on: `${yr}-11-10`, display_status: 'scheduled', you_earn: { line: '10% of ₹2,999 = ₹300' },
      products: [{ id: 'a', name: "Levi's 511 Slim", price: 2299 }, { id: 'b', name: "Levi's 512", price: 2499 }, { id: 'c', name: 'Wrangler Regular', price: 1999 }, { id: 'd', name: 'Pepe', price: 1699 }],
      gifts: [] } }));
    const { getByText, getByTestId } = render(<CreatorOfferScreen navigation={nav()} route={{ params: { ciId: 'ci1', offerId: 'o2' } }} />);
    await waitFor(() => getByTestId('creator-offer'));
    getByText('How it works for shoppers');
    getByText('They pick any 2 of these 15 products from your post and pay ₹2,999 together. All 2 must come from the same post.');
    getByText(`10 Oct – 10 Nov ${yr}`);
    getByText('10% of ₹2,999 = ₹300');
    getByText("Levi's 511 Slim · Levi's 512 · Wrangler Regular · +1");
  });
});

describe('C4 — the agreement', () => {
  it('lists her offers with their dates, the products at normal price, and what happens when an offer ends', async () => {
    const terms = {
      aim: 'conversion', campaignName: 'Diwali Denim', setName: 'Set A', postingDate: `${yr}-10-10`, cutoff: `${yr}-10-07`,
      shootMode: 'shipment', branchName: null, branchCity: null,
      parties: { brand: { name: 'Urban Threads', city: 'Hyderabad', state: 'Telangana' }, creator: { name: 'Priya Rao', city: 'Hyderabad', state: 'Telangana', handle: 'priya' } },
      money: { fee: null, commissionPct: 10, campaignFeePct: 8, campaignFee: 0, totalToLock: 0, split: null, splitPct: [25, 25, 50], commissionAfterDays: 30 },
      work: { deliverables: [], deliverablesWords: null, usageRights: null, minShoppablePosts: 1 },
      sell: { words: '2 offers + 12 products', products_count: 12,
        offers: [{ name: "20% off Levi's Jeans", deal: '20% off each item, up to ₹400', starts_on: `${yr}-10-01`, ends_on: `${yr}-10-31` },
          { name: 'Any 2 Jeans for ₹2,999', deal: 'Shopper picks any 2 of 15 for ₹2,999', starts_on: `${yr}-10-10`, ends_on: `${yr}-11-10` }],
        offers_end_line: 'When an offer ends, your posts using it leave the shop.' },
      returnTerms: { days: 7, brandPaysShipping: true }, note: null, termsVersion: '1.0', generatedAt: `${yr}-09-28T10:00:00Z`,
    };
    influencerApi.myAgreement.mockResolvedValue(ok({ agreement: {
      invitationId: 'ci1', contractId: 'k1', reference: 'INFLX-2026-00501', status: 'pending_influencer', sentAt: `${yr}-09-28T10:00:00Z`,
      cutoff: `${yr}-10-07`, daysLeft: 4, cutoffPassed: false, terms, standardTerms: { version: '1.0' },
      signatures: { creator: null, brand: null }, ending: null,
      money: { fee: null, campaignFeePct: 8, campaignFee: 0, totalToLock: 0, split: null, splitPct: [25, 25, 50], locked: null, released: null, stillLocked: null, at: null },
      can: { sign: true, decline: true, download: false }, document: { available: false, generatedAt: null } } }));
    const { getByText, getByTestId } = render(<AgreementScreen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('sell-offers'));
    getByText('2 offers + 12 products');
    getByText("20% off Levi's Jeans"); getByText('1 Oct – 31 Oct');
    getByText('Any 2 Jeans for ₹2,999'); getByText('10 Oct – 10 Nov');
    getByText('At normal price'); getByText('12 products');
    getByText('When an offer ends, your posts using it leave the shop.');
  });
});

describe('C5 — her notices', () => {
  it('lists the notices; an offer or product notice opens What you can sell; an invitation notice opens the invitation', async () => {
    influencerApi.getNotifications.mockResolvedValue(ok({ notifications: [
      { id: 'n1', type: 'offer_ended', title: '"Buy 2 T-shirts → 30%" has ended', body: 'Urban Threads ended this offer today. Posts using it leave the shop.', is_read: false,
        created_at: new Date().toISOString(), data_json: { screen: 'creator_offer', offer_id: 'o3', campaign_influencer_id: 'ci1' } },
      { id: 'n2', type: 'product_out_of_stock', title: "Levi's 512 is out of stock", body: "Shoppers can't buy it until the brand restocks it.", is_read: true,
        created_at: new Date().toISOString(), data_json: { screen: 'creator_sell', campaign_influencer_id: 'ci1' } },
    ], unread_count: 1 }));
    const n = nav();
    const { getByText, getByTestId } = render(<CreatorNotificationsScreen navigation={n} />);
    await waitFor(() => getByTestId('creator-notifications'));
    getByText('"Buy 2 T-shirts → 30%" has ended');
    getByText("Levi's 512 is out of stock");
    fireEvent.press(getByTestId('notice-n1'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorSell', { ciId: 'ci1' });
    expect(influencerApi.markAllNotificationsRead).toHaveBeenCalled();
    expect(targetOf({ data_json: { screen: 'invitation', campaign_influencer_id: 'ci9' } })).toEqual({ name: 'Invitation', params: { ciId: 'ci9' } });
    expect(targetOf({ data_json: { screen: 'earnings' } })).toBeNull();
  });
});
