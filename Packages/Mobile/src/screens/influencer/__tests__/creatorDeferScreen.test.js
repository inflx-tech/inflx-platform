/**
 * CreatorDeferScreen — the screen behind SC-05's single button.
 * Contract: features/stage-a-the-set
 *
 * Mounts the real screen (@testing-library/react-native), same discipline as
 * collabDetailRenders.test.js — a source-shape check would have missed the "storys"
 * bug that shipped in this same slice; this file exists so the next one doesn't.
 *
 * Alert.alert renders nothing into the component tree (it's a native dialog outside
 * React's tree, and RN's own jest preset mocks it as a no-op) — so its outcome is
 * asserted by spying on the call, never by findByText on an alert's title/message.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { deferOffer: jest.fn() },
}));

import CreatorDeferScreen from '../CreatorDeferScreen';
import { influencerApi } from '../../../services/api';

const nav = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { campaignInfluencerId: 'ci-1', brandName: 'Label Fern', campaignName: 'Diwali Saree Edit' } };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('renders with the send button disabled until something is picked', () => {
  render(<CreatorDeferScreen navigation={nav} route={route} />);
  expect(screen.getByText('Ask for something else')).toBeTruthy();
  expect(screen.getByText('Pick a day, a shoot, or both.')).toBeTruthy();
});

test('picking only a shoot mode is enough to send — the day is not required', async () => {
  influencerApi.deferOffer.mockResolvedValue({ success: true, data: { campaign_influencer: {} } });
  render(<CreatorDeferScreen navigation={nav} route={route} />);

  fireEvent.press(screen.getByText('Store visit'));
  fireEvent.press(screen.getByText('Send to Label Fern'));

  await waitFor(() => expect(influencerApi.deferOffer).toHaveBeenCalled());
  expect(influencerApi.deferOffer).toHaveBeenCalledWith('ci-1', {
    go_live_date: undefined, shoot_mode: 'visit', note: undefined,
  });
  expect(Alert.alert).toHaveBeenCalledWith('Sent', expect.stringContaining('Label Fern'), expect.any(Array));
});

test('tapping an already-picked shoot mode again clears it — not a one-way choice', () => {
  render(<CreatorDeferScreen navigation={nav} route={route} />);
  fireEvent.press(screen.getByText('Store visit'));
  fireEvent.press(screen.getByText('Store visit'));
  fireEvent.press(screen.getByText('Send to Label Fern'));
  // Nothing picked any more — the API must not have been called.
  expect(influencerApi.deferOffer).not.toHaveBeenCalled();
});

test('a failed submit surfaces the server message and does not navigate away', async () => {
  influencerApi.deferOffer.mockResolvedValue({ success: false, error: { message: 'Cannot raise a reservation now' } });
  render(<CreatorDeferScreen navigation={nav} route={route} />);
  fireEvent.press(screen.getByText('We send the products'));
  fireEvent.press(screen.getByText('Send to Label Fern'));

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Could not send this', 'Cannot raise a reservation now'));
  expect(nav.goBack).not.toHaveBeenCalled();
  expect(nav.navigate).not.toHaveBeenCalled();
});

test('an optional note reaches the server trimmed', async () => {
  influencerApi.deferOffer.mockResolvedValue({ success: true, data: {} });
  render(<CreatorDeferScreen navigation={nav} route={route} />);
  fireEvent.press(screen.getByText('Store visit'));
  fireEvent.changeText(screen.getByPlaceholderText('e.g. I can only shoot on a weekend'), '  weekends only  ');
  fireEvent.press(screen.getByText('Send to Label Fern'));

  await waitFor(() => expect(influencerApi.deferOffer).toHaveBeenCalledWith('ci-1', {
    go_live_date: undefined, shoot_mode: 'visit', note: 'weekends only',
  }));
});
