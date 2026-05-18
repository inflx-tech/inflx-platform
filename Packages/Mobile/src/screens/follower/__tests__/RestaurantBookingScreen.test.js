/**
 * Layer 3 flow test — RestaurantBookingScreen prebook path.
 *
 * Guards the same regression-prone surface as the Bill test:
 * creator-attribution ID resolution, the auth gate, and the correct
 * refusal when a restaurant has no active campaign — plus the
 * prebook → verify → BookingConfirmed navigation hand-off.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  followerApi: { prebook: jest.fn(), prebookVerify: jest.fn() },
}));
jest.mock('../../../utils/authGate', () => ({ ensureFollowerAuth: jest.fn() }));
jest.mock('../../../components/restaurant', () => {
  const React = require('react');
  const { Text, Pressable } = require('react-native');
  return {
    TimeSlot: ({ time, onPress }) =>
      React.createElement(Pressable, { onPress, testID: `slot-${time}` },
        React.createElement(Text, null, time)),
    FilterChip: ({ label, onPress }) =>
      React.createElement(Pressable, { onPress },
        React.createElement(Text, null, label)),
    OfferPill: () => null,
    CreatorChip: () => null,
  };
});

import RestaurantBookingScreen from '../RestaurantBookingScreen';
import { followerApi } from '../../../services/api';
import { ensureFollowerAuth } from '../../../utils/authGate';

const params = (over = {}) => ({
  offer: {
    offer_id: 'off_1', campaign_id: 'cmp_1',
    set_id: 'set_1', campaign_influencer_id: 'ci_1', discount_value: 10,
  },
  brand: { business_name: 'Test Diner' },
  tracking: { influencer_handle: 'sagar.eats', influencer_name: 'Sagar' },
  ...over,
});

function setup(p) {
  const navigation = { goBack: jest.fn(), replace: jest.fn(), navigate: jest.fn() };
  render(<RestaurantBookingScreen route={{ params: p }} navigation={navigation} />);
  return { navigation };
}

const pickTimeAndConfirm = () => {
  fireEvent.press(screen.getByTestId('slot-7:00'));
  fireEvent.press(screen.getByText('Confirm booking →'));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('RestaurantBookingScreen — prebook flow', () => {
  test('happy path: prebooks, verifies, hands off to BookingConfirmed', async () => {
    ensureFollowerAuth.mockResolvedValue(true);
    followerApi.prebook.mockResolvedValue({
      success: true, data: { razorpay_order_id: 'order_b', advance_amount: 200 },
    });
    followerApi.prebookVerify.mockResolvedValue({
      success: true,
      data: { booking: { reference_code: 'PRD-XYZ', table_number: 'T5', brand_status: 'pending' } },
    });

    const { navigation } = setup(params());
    pickTimeAndConfirm();

    await waitFor(() => expect(navigation.replace).toHaveBeenCalled(), { timeout: 8000 });

    expect(followerApi.prebook).toHaveBeenCalledWith(expect.objectContaining({
      offer_id: 'off_1',
      campaign_id: 'cmp_1',
      set_id: 'set_1',
      campaign_influencer_id: 'ci_1',
      booking_time: '7:00',
      guest_count: 2,
      special_requests: [],
      booking_date: expect.any(String),
    }));
    expect(followerApi.prebookVerify).toHaveBeenCalledWith({
      razorpay_order_id: 'order_b',
      razorpay_payment_id: expect.stringMatching(/^pay_mock_/),
    });
    expect(navigation.replace).toHaveBeenCalledWith('BookingConfirmed',
      expect.objectContaining({
        booking: expect.objectContaining({
          reference_code: 'PRD-XYZ',
          booking_time: '7:00',
          guest_count: 2,
          advance_paid: 200,
          brand_status: 'pending',
        }),
      }));
  }, 20000);

  test('refuses when restaurant has no active campaign (no API call)', async () => {
    ensureFollowerAuth.mockResolvedValue(true);
    setup(params({ offer: { discount_value: 10 }, tracking: {} }));
    pickTimeAndConfirm();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Booking not available', expect.any(String)));
    expect(followerApi.prebook).not.toHaveBeenCalled();
  });

  test('blocks booking when not authenticated', async () => {
    ensureFollowerAuth.mockResolvedValue(false);
    setup(params());
    pickTimeAndConfirm();

    await waitFor(() => expect(ensureFollowerAuth).toHaveBeenCalled());
    expect(followerApi.prebook).not.toHaveBeenCalled();
  });
});
