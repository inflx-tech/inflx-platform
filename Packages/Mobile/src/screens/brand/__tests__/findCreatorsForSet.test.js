/**
 * BrandFindCreatorsScreen — "forSet" mode (search and invite directly into a set).
 * Contract: features/stage-a-the-set
 *
 * Architecture change, founder 2026-09-02: no more pre-agreed-then-briefed — campaign
 * and set come first, reaching a creator happens through a set. This is the screen that
 * makes that literally possible on the phone (it already existed for the old "send a
 * request" flow; this mode reuses its search/select machinery for a different action).
 *
 * Mounts the real screen — the discipline this whole slice has followed since the
 * "storys" bug: a source check would not catch a wrong prop name or an action that fires
 * the wrong function.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    searchInfluencers: jest.fn(),
    listCreatorLocations: jest.fn(),
  },
}));

import BrandFindCreatorsScreen from '../BrandFindCreatorsScreen';
import { brandApi } from '../../../services/api';
import * as draft from '../../../utils/campaignDraft';

const nav = { navigate: jest.fn(), goBack: jest.fn() };

const RESULTS = {
  success: true,
  data: {
    creators: [
      { linked_influencer_id: 'i1', full_name: 'Asha M.', ig_handle: 'asha.m', city: 'Bengaluru', niche: 'Fashion', followers_count: 42000, inflx_followers: 100 },
      { linked_influencer_id: 'i2', full_name: 'Divya T.', ig_handle: 'divya.t', city: 'Hyderabad', niche: 'Fashion', followers_count: 61000, inflx_followers: 80 },
    ],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  brandApi.searchInfluencers.mockResolvedValue(RESULTS);
  brandApi.listCreatorLocations.mockResolvedValue({ success: true, data: { states: [] } });
});

test('in forSet mode, a tap selects instead of opening a profile', async () => {
  const route = { params: { forSet: { campaignId: 'c1', setId: 's1' } } };
  render(<BrandFindCreatorsScreen navigation={nav} route={route} />);
  fireEvent.press(await screen.findByText('Asha M.'));
  expect(nav.navigate).not.toHaveBeenCalled();
  // The primary action bar only appears once someone is selected — proves the tap
  // actually registered as a pick, not a no-op.
  expect(await screen.findByText('1 selected')).toBeTruthy();
});

test('"Add N to this set" writes each picked creator straight to the shared draft', async () => {
  const route = { params: { forSet: { campaignId: 'c1', setId: 's1' } } };
  render(<BrandFindCreatorsScreen navigation={nav} route={route} />);
  fireEvent.press(await screen.findByText('Asha M.'));
  fireEvent.press(screen.getByText('Divya T.'));
  fireEvent.press(await screen.findByText('Add 2 to this set'));

  await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
  const sd = draft.getSetDraft('c1', 's1');
  expect(sd.creators.map((c) => c.agreement_id).sort()).toEqual(['cold:i1', 'cold:i2']);
  expect(sd.creators.find((c) => c.agreement_id === 'cold:i1').name).toBe('Asha M.');
});

test('someone already in the set is shown greyed and cannot be tapped', async () => {
  const route = { params: { forSet: { campaignId: 'c1', setId: 's1', excludeInfluencerIds: ['i1'] } } };
  render(<BrandFindCreatorsScreen navigation={nav} route={route} />);
  await screen.findByText('Asha M.');
  expect(screen.getByText('ALREADY IN THIS SET')).toBeTruthy();
  fireEvent.press(screen.getByText('Asha M.'));
  // Disabled — no selection happened, no action bar appeared for her alone.
  expect(screen.queryByText('1 selected')).toBeNull();
});

test('outside forSet mode, tapping still opens a profile as before — unchanged', async () => {
  const route = { params: {} };
  render(<BrandFindCreatorsScreen navigation={nav} route={route} />);
  fireEvent.press(await screen.findByText('Asha M.'));
  expect(nav.navigate).toHaveBeenCalledWith('BrandInfluencerProfile', { influencerId: 'i1' });
});
