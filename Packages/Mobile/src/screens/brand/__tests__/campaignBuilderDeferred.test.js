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

/**
 * SB-40 — grouped by what was actually asked for, not a flat list. Two people who both
 * asked for "19 Sept, shipment" are shown as one cluster with one button; someone who
 * asked for a different day or shoot gets a cluster of their own.
 */
test('people who asked for the same day AND shoot are clustered together, under one button', async () => {
  brandApi.getDeferredCreators.mockResolvedValue({
    success: true,
    data: { deferred: [
      { id: 'ci-1', influencer_name: 'Asha M.', deferred_go_live_date: '2026-09-19', deferred_shoot_mode: 'shipment' },
      { id: 'ci-2', influencer_name: 'Divya T.', deferred_go_live_date: '2026-09-19', deferred_shoot_mode: 'shipment' },
    ] },
  });
  render(<BrandCampaignBuilderScreen navigation={nav} route={route} />);
  expect(await screen.findByText('Moved out · 2')).toBeTruthy();
  expect(screen.getByText('19 Sept · We send the products · 2')).toBeTruthy();
  expect(screen.getByText('Asha M.')).toBeTruthy();
  expect(screen.getByText('Divya T.')).toBeTruthy();
  // One cluster, one button — not two.
  expect(screen.getAllByText('Build a set from these')).toHaveLength(1);
});

test('same day but a DIFFERENT shoot is a separate cluster, not folded in', async () => {
  brandApi.getDeferredCreators.mockResolvedValue({
    success: true,
    data: { deferred: [
      { id: 'ci-1', influencer_name: 'Asha M.', deferred_go_live_date: '2026-09-19', deferred_shoot_mode: 'shipment' },
      { id: 'ci-2', influencer_name: 'Ravi K.', deferred_go_live_date: '2026-09-19', deferred_shoot_mode: 'visit' },
    ] },
  });
  render(<BrandCampaignBuilderScreen navigation={nav} route={route} />);
  expect(await screen.findByText('19 Sept · We send the products · 1')).toBeTruthy();
  expect(screen.getByText('19 Sept · Store visit · 1')).toBeTruthy();
  expect(screen.getAllByText('Build a set from these')).toHaveLength(2);
});

test('someone who gave only a shoot preference, no day, still gets a real cluster', async () => {
  brandApi.getDeferredCreators.mockResolvedValue({
    success: true,
    data: { deferred: [{ id: 'ci-1', influencer_name: 'Nisha P.', deferred_go_live_date: null, deferred_shoot_mode: 'remote' }] },
  });
  render(<BrandCampaignBuilderScreen navigation={nav} route={route} />);
  expect(await screen.findByText('No shoot · 1')).toBeTruthy();
});

test('groups sort soonest day first; a no-day group sorts last', async () => {
  brandApi.getDeferredCreators.mockResolvedValue({
    success: true,
    data: { deferred: [
      { id: 'ci-1', influencer_name: 'Later', deferred_go_live_date: '2026-09-25', deferred_shoot_mode: 'visit' },
      { id: 'ci-2', influencer_name: 'NoDay', deferred_go_live_date: null, deferred_shoot_mode: 'visit' },
      { id: 'ci-3', influencer_name: 'Sooner', deferred_go_live_date: '2026-09-19', deferred_shoot_mode: 'visit' },
    ] },
  });
  render(<BrandCampaignBuilderScreen navigation={nav} route={route} />);
  await screen.findByText('Moved out · 3');
  const headers = screen.getAllByText(/Store visit/).map((el) => el.props.children.join(''));
  expect(headers).toEqual(['19 Sept · Store visit · 1', '25 Sept · Store visit · 1', 'Store visit · 1']);
});

test('"Build a set from these" hands the wizard exactly that group\'s ids, nobody else\'s', async () => {
  brandApi.getDeferredCreators.mockResolvedValue({
    success: true,
    data: { deferred: [
      { id: 'ci-1', influencer_name: 'Asha M.', deferred_go_live_date: '2026-09-19', deferred_shoot_mode: null },
      { id: 'ci-2', influencer_name: 'Ravi K.', deferred_go_live_date: '2026-09-22', deferred_shoot_mode: null },
    ] },
  });
  render(<BrandCampaignBuilderScreen navigation={nav} route={route} />);
  const buttons = await screen.findAllByText('Build a set from these');
  expect(buttons).toHaveLength(2);
  fireEvent.press(buttons[0]);
  expect(nav.navigate).toHaveBeenCalledWith('BrandSetWizard', {
    campaignId: 'c1', campaignName: 'Diwali Saree Edit', setId: null, seedDeferredIds: ['ci-1'],
  });
});
