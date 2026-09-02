/**
 * BrandCampaignBuilderScreen (SB-24) — the "Moved out" section.
 * Contract: features/stage-a-the-set
 *
 * Mounts the real screen, same discipline as the influencer-side render tests in this
 * slice: a source-shape check would not have caught a wrong prop name or a section that
 * renders even when nothing is deferred.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => require('react').useEffect(cb, [cb]),
}));

jest.mock('../../../services/api', () => ({
  brandApi: {
    getCampaign: jest.fn(),
    getCampaignSets: jest.fn(),
    getDeferredCreators: jest.fn(),
  },
}));

import BrandCampaignBuilderScreen from '../BrandCampaignBuilderScreen';
import { brandApi } from '../../../services/api';

const nav = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { campaignId: 'c1', campaignName: 'Diwali Saree Edit' } };

const CAMPAIGN = { success: true, data: { campaign: { id: 'c1', name: 'Diwali Saree Edit', status: 'draft' } } };
const ONE_SET = { success: true, data: { sets: [{ id: 's1', name: 'Set 1', goal: 'conversion' }] } };

beforeEach(() => {
  jest.clearAllMocks();
  brandApi.getCampaign.mockResolvedValue(CAMPAIGN);
  brandApi.getCampaignSets.mockResolvedValue(ONE_SET);
});

test('no "Moved out" section when nobody is deferred', async () => {
  brandApi.getDeferredCreators.mockResolvedValue({ success: true, data: { deferred: [] } });
  render(<BrandCampaignBuilderScreen navigation={nav} route={route} />);
  expect(await screen.findByText('Diwali Saree Edit')).toBeTruthy();
  expect(screen.queryByText(/Moved out/)).toBeNull();
});

test('shows who is deferred and what each one asked for', async () => {
  brandApi.getDeferredCreators.mockResolvedValue({
    success: true,
    data: { deferred: [
      { id: 'ci-1', influencer_name: 'Asha M.', deferred_go_live_date: '2026-09-19', deferred_shoot_mode: 'shipment' },
      { id: 'ci-2', influencer_name: 'Ravi K.', deferred_go_live_date: '2026-09-22', deferred_shoot_mode: 'remote' },
    ] },
  });
  render(<BrandCampaignBuilderScreen navigation={nav} route={route} />);
  expect(await screen.findByText('Moved out · 2')).toBeTruthy();
  expect(screen.getByText(/Asha M\. wanted 19 Sept · We send the products/)).toBeTruthy();
  expect(screen.getByText(/Ravi K\. wanted 22 Sept · No shoot/)).toBeTruthy();
});

test('"Build a set from these" hands the wizard exactly those ids, nothing else', async () => {
  brandApi.getDeferredCreators.mockResolvedValue({
    success: true,
    data: { deferred: [{ id: 'ci-1', influencer_name: 'Asha M.', deferred_go_live_date: '2026-09-19', deferred_shoot_mode: null }] },
  });
  render(<BrandCampaignBuilderScreen navigation={nav} route={route} />);
  fireEvent.press(await screen.findByText('Build a set from these'));
  expect(nav.navigate).toHaveBeenCalledWith('BrandSetWizard', {
    campaignId: 'c1', campaignName: 'Diwali Saree Edit', setId: null, seedDeferredIds: ['ci-1'],
  });
});
