/**
 * Layer 3 flow test — RestaurantCartScreen online-order path.
 *
 * Covers the order → mockPayment → verify hand-off, the auth gate,
 * and the canOrder attribution guard (button disabled + warning when
 * the restaurant has no active creator campaign).
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  followerApi: { createOrder: jest.fn(), verifyOrder: jest.fn() },
}));
jest.mock('../../../services/payment', () => ({ mockPayment: jest.fn() }));
jest.mock('../../../utils/authGate', () => ({ ensureFollowerAuth: jest.fn() }));
jest.mock('../../../components/restaurant', () => ({ CreatorChip: () => null }));

import RestaurantCartScreen from '../RestaurantCartScreen';
import { followerApi } from '../../../services/api';
import { mockPayment } from '../../../services/payment';
import { ensureFollowerAuth } from '../../../utils/authGate';

const ITEMS = [{ product_id: 'p1', name: 'Biryani', price: 200, quantity: 1 }];

const params = (over = {}) => ({
  offer: {
    offer_id: 'off_1', campaign_id: 'cmp_1',
    set_id: 'set_1', campaign_influencer_id: 'ci_1', discount_value: 10,
  },
  brand: { business_name: 'Test Diner' },
  tracking: { influencer_handle: 'sagar.eats', influencer_name: 'Sagar' },
  items: ITEMS,
  ...over,
});

function setup(p) {
  const navigation = { goBack: jest.fn(), popToTop: jest.fn(), navigate: jest.fn() };
  render(<RestaurantCartScreen route={{ params: p }} navigation={navigation} />);
  return { navigation };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('RestaurantCartScreen — order flow', () => {
  test('happy path: creates order, pays, verifies, returns to top', async () => {
    ensureFollowerAuth.mockResolvedValue(true);
    followerApi.createOrder.mockResolvedValue({
      success: true, data: { razorpay_order_id: 'order_c', net_amount: 180 },
    });
    mockPayment.mockResolvedValue({ razorpay_payment_id: 'pay_c' });
    followerApi.verifyOrder.mockResolvedValue({ success: true });

    const { navigation } = setup(params());
    fireEvent.press(screen.getByText(/Place order/));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Order placed 🎉', expect.any(String), expect.any(Array)),
      { timeout: 8000 });

    expect(followerApi.createOrder).toHaveBeenCalledWith({
      offer_id: 'off_1',
      campaign_id: 'cmp_1',
      set_id: 'set_1',
      campaign_influencer_id: 'ci_1',
      items: [{ product_id: 'p1', quantity: 1 }],
    });
    expect(mockPayment).toHaveBeenCalledWith('order_c');
    expect(followerApi.verifyOrder).toHaveBeenCalledWith({
      razorpay_order_id: 'order_c',
      razorpay_payment_id: 'pay_c',
    });

    const doneBtn = Alert.alert.mock.calls.at(-1)[2][0];
    doneBtn.onPress();
    expect(navigation.popToTop).toHaveBeenCalled();
  }, 20000);

  test('blocks order when not authenticated', async () => {
    ensureFollowerAuth.mockResolvedValue(false);
    setup(params());
    fireEvent.press(screen.getByText(/Place order/));

    await waitFor(() => expect(ensureFollowerAuth).toHaveBeenCalled());
    expect(followerApi.createOrder).not.toHaveBeenCalled();
  });

  test('no active campaign: CTA disabled + warning shown, no order possible', () => {
    ensureFollowerAuth.mockResolvedValue(true);
    setup(params({ offer: { discount_value: 10 }, tracking: {} }));

    expect(screen.getByText(/No active creator campaign/)).toBeTruthy();
    fireEvent.press(screen.getByText(/Place order/));
    expect(followerApi.createOrder).not.toHaveBeenCalled();
  });
});
