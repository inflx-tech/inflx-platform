/**
 * ⚠️ THE SCREEN MUST ACTUALLY RENDER.
 *
 * Contract: features/brief-straight-to-signing
 *
 * Founder, 2026-08-28, minutes after the deploy:
 *   "it is landed correctly into sign tab, but when i am trying click review, again a blank
 *   screen"
 *
 * The routing worked. The endpoint worked — the exact query, run against Asha M.'s real
 * production row, returns a complete contract. So the failure is on the phone, at render.
 *
 * WHY EVERY OTHER TEST MISSED IT
 * briefToSigning.test.js reads this screen as TEXT and asserts the right strings are present.
 * That proves the code was written. It cannot prove the code runs. It would pass on a file that
 * throws on its first line.
 *
 * This repo has now been bitten by that distinction twice on the same journey — collabDetailModel
 * passed while the screen it tested showed "This collab is closed", because it fed the helper
 * ideal input instead of mounting the screen. That file's own comment says it:
 *   "the strongest argument in this repo for testing what the screen actually does rather than
 *   what a helper can do when fed ideal input."
 *
 * So this file MOUNTS it, with the real production payload.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: {
    getContract: jest.fn(), signContract: jest.fn(), declineOffer: jest.fn(),
    // The production panel mounts once both sides have signed.
    getProduction: jest.fn(), getProductionDateRange: jest.fn(),
  },
}));

import ContractScreen from '../ContractScreen';
import { influencerApi } from '../../../services/api';

beforeEach(() => {
  jest.clearAllMocks();
  influencerApi.getProduction.mockResolvedValue({ success: true, data: { production_event: null } });
  influencerApi.getProductionDateRange.mockResolvedValue({ success: true, data: {} });
});

/**
 * Asha M. · "New test campaign 1234" · Label Fern (practice)
 * campaign_influencer 0c7b5d40-d4f9-4b5b-af4b-e80cbe8bf157
 * contract            f716428c-5ef5-42c6-9ae1-29f460a88664  [pending_influencer]
 *
 * Copied from the live row, not invented. Note what is NULL on a real brief — offer_type,
 * brand_offer_name, agreed_usage, pdf_url, content_requirements, custom_clauses — and note that
 * `goal` does not exist on the contracts table at all. Ideal fixtures are how the last two of
 * these bugs got shipped.
 */
// Dumped straight from production by running the controller's own query and describers against
// Asha M.'s live row. Not typed by hand — a hand-written fixture is how the last two of these
// bugs got shipped. Note what is NULL on a real brief: production_mode, offer_type, pdf_url,
// custom_clauses, content_requirements, campaign_brief, and zero deliverables.
const REAL = require('./__fixtures__/asha-live-contract.json');

const nav = { goBack: jest.fn(), navigate: jest.fn(), canGoBack: () => true };
const route = { params: { campaignInfluencerId: REAL.contract.campaign_influencer_id } };

const mount = (data) => {
  influencerApi.getContract.mockResolvedValue({ success: true, data });
  return render(<ContractScreen navigation={nav} route={route} />);
};

describe('the screen Asha actually opens', () => {
  test('⚠️ it renders — this is the whole bug', async () => {
    mount(REAL);
    // If the component throws, render() throws and this never runs.
    expect(await screen.findByText('Contract')).toBeTruthy();
  });

  test('it names her campaign and her brand', async () => {
    mount(REAL);
    expect(await screen.findByText('NEW TEST CAMPAIGN 1234')).toBeTruthy();
    expect(screen.getByText('Label Fern (practice)')).toBeTruthy();
  });

  test('it shows what she can sell', async () => {
    mount(REAL);
    expect(await screen.findByText(REAL.sell.label)).toBeTruthy();
    expect(screen.getByText(REAL.sell.detail)).toBeTruthy();
  });

  test('it shows what happens to her content', async () => {
    mount(REAL);
    expect(await screen.findByText(REAL.usage_text)).toBeTruthy();
  });

  test('it offers her BOTH a signature and a way out', async () => {
    mount(REAL);
    expect(await screen.findByText('SIGN CONTRACT')).toBeTruthy();
    expect(screen.getByText("I can't do this collaboration")).toBeTruthy();
  });
});

describe('it survives the shapes production actually produces', () => {
  test('an old contract with no sell and no usage still renders', async () => {
    // The five contracts that existed before this work, and any phone still on an older bundle.
    mount({ ...REAL, sell: undefined, usage_text: undefined });
    expect(await screen.findByText('Contract')).toBeTruthy();
  });

  test('a pay-for-content contract with no commission renders and hides the sell card', async () => {
    mount({ ...REAL, contract: { ...REAL.contract, commission_pct: '0.00', influencer_fee: '12000.00' } });
    expect(await screen.findByText('Contract')).toBeTruthy();
    expect(screen.queryByText('What You Can Sell')).toBeNull();
  });

  test('an already-signed contract renders without a sign button', async () => {
    mount({ ...REAL, contract: { ...REAL.contract, status: 'active',
      influencer_signed_at: '2026-08-21T10:00:00Z', brand_signed_at: '2026-08-21T11:00:00Z' } });
    expect(await screen.findByText('Contract')).toBeTruthy();
    expect(screen.queryByText('SIGN CONTRACT')).toBeNull();
  });

  test('a failed load does not leave her on a blank screen', async () => {
    influencerApi.getContract.mockResolvedValue({ success: false, error: { message: 'nope' } });
    render(<ContractScreen navigation={nav} route={route} />);
    expect(await screen.findByText('Contract not found.')).toBeTruthy();
  });
});
