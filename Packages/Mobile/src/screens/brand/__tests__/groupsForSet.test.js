/**
 * BrandGroupsScreen — "forSet" mode (the third of SB-28's three ways in: from a group).
 * Contract: features/stage-a-the-set
 *
 * Mounts the real screen. Confirms one tap adds a whole saved list to the set's draft as
 * cold invites (not pre-agreed), that members already in the set are excluded from the
 * count and don't re-add, and that outside forSet mode the screen is unchanged (opens the
 * group detail page, no draft writes).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => require('react').useEffect(cb, [cb]),
}));

jest.mock('../../../services/api', () => ({
  brandApi: {
    listGroups: jest.fn(),
  },
}));

import BrandGroupsScreen from '../BrandGroupsScreen';
import { brandApi } from '../../../services/api';
import * as draft from '../../../utils/campaignDraft';

const nav = { navigate: jest.fn(), goBack: jest.fn() };

const GROUPS = {
  success: true,
  data: {
    groups: [
      {
        id: 'g1',
        name: 'South India · fashion',
        members: [
          { influencer_id: 'i1', full_name: 'Asha M.', instagram_handle: 'asha.m' },
          { influencer_id: 'i2', full_name: 'Divya T.', instagram_handle: 'divya.t' },
        ],
      },
    ],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  brandApi.listGroups.mockResolvedValue(GROUPS);
  jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
    const add = buttons?.find((b) => b.text?.startsWith('Add'));
    if (add) add.onPress();
  });
});

afterEach(() => {
  Alert.alert.mockRestore();
});

test('in forSet mode, tapping a group writes every member to the shared draft as cold invites', async () => {
  const route = { params: { forSet: { campaignId: 'c1', setId: 's1' } } };
  render(<BrandGroupsScreen navigation={nav} route={route} />);
  fireEvent.press(await screen.findByText('South India · fashion'));

  await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
  const sd = draft.getSetDraft('c1', 's1');
  expect(sd.creators.map((c) => c.agreement_id).sort()).toEqual(['cold:i1', 'cold:i2']);
  expect(sd.creators.find((c) => c.agreement_id === 'cold:i1').name).toBe('Asha M.');
});

test('members already in the set are excluded from the add', async () => {
  const route = { params: { forSet: { campaignId: 'c2', setId: 's2', excludeInfluencerIds: ['i1'] } } };
  render(<BrandGroupsScreen navigation={nav} route={route} />);
  fireEvent.press(await screen.findByText('South India · fashion'));

  await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
  const sd = draft.getSetDraft('c2', 's2');
  expect(sd.creators.map((c) => c.agreement_id)).toEqual(['cold:i2']);
});

test('a group whose members are all already in the set shows a message and does not navigate', async () => {
  const route = { params: { forSet: { campaignId: 'c3', setId: 's3', excludeInfluencerIds: ['i1', 'i2'] } } };
  render(<BrandGroupsScreen navigation={nav} route={route} />);
  fireEvent.press(await screen.findByText('South India · fashion'));

  expect(Alert.alert).toHaveBeenCalledWith('Already in this set', expect.any(String));
  expect(nav.goBack).not.toHaveBeenCalled();
});

test('outside forSet mode, tapping a group still opens its detail page — unchanged', async () => {
  const route = { params: {} };
  render(<BrandGroupsScreen navigation={nav} route={route} />);
  fireEvent.press(await screen.findByText('South India · fashion'));
  expect(nav.navigate).toHaveBeenCalledWith('BrandGroupDetail', { groupId: 'g1', groupName: 'South India · fashion' });
  expect(nav.goBack).not.toHaveBeenCalled();
});
