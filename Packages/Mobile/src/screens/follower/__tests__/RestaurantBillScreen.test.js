/**
 * Layer 3 flow test — RestaurantBillScreen pay-at-store path.
 *
 * Guards the regression-prone logic behind this session's blocking
 * bugs: creator-attribution ID resolution (fbad327), the auth gate
 * (0af513c), and the correct refusal when a restaurant has no active
 * campaign. Runs in node — no device required.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  followerApi: {
    payAtStore: jest.fn(),
    verifyPayAtStore: jest.fn(),
  },
}));
jest.mock('../../../services/payment', () => ({ mockPayment: jest.fn() }));
jest.mock('../../../utils/authGate', () => ({ ensureFollowerAuth: jest.fn() }));
jest.mock('../../../components/restaurant', () => ({
  CreatorChip: () => null,
  OfferPill: () => null,
}));

import RestaurantBillScreen from '../RestaurantBillScreen';
import { followerApi } from '../../../services/api';
import { mockPayment } from '../../../services/payment';
import { ensureFollowerAuth } from '../../../utils/authGate';

const params = (over = {}) => ({
  offer: {
    offer_id: 'off_1',
    campaign_id: 'cmp_1',
    set_id: 'set_1',
    campaign_influencer_id: 'ci_1',
    discount_value: 10,
  },
  brand: { business_name: 'Test Diner' },
  tracking: { influencer_handle: 'sagar.eats', influencer_name: 'Sagar' },
  ...over,
});

function setup(p) {
  const navigation = {
    goBack: jest.fn(),
    popToTop: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  };
  render(<RestaurantBillScreen route={{ params: p }} navigation={navigation} />);
  return { navigation };
}

const enterBillAndPay = (amount = '1000') => {
  fireEvent.changeText(
    screen.getByPlaceholderText('Enter the bill amount'), amount);
  fireEvent.press(screen.getByText(/Pay\s.*→/));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('RestaurantBillScreen — pay flow', () => {
  test('happy path: resolves attribution IDs, pays, verifies, returns to top', async () => {
    ensureFollowerAuth.mockResolvedValue(true);
    followerApi.payAtStore.mockResolvedValue({
      success: true, data: { razorpay_order_id: 'order_x' },
    });
    mockPayment.mockResolvedValue({ razorpay_payment_id: 'pay_x' });
    followerApi.verifyPayAtStore.mockResolvedValue({ success: true });

    const { navigation } = setup(params());
    enterBillAndPay('1000');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment successful', expect.any(String), expect.any(Array)),
      { timeout: 8000 });

    expect(followerApi.payAtStore).toHaveBeenCalledWith({
      bill_amount: 1000,
      offer_id: 'off_1',
      campaign_id: 'cmp_1',
      set_id: 'set_1',
      campaign_influencer_id: 'ci_1',
      prebook_booking_id: null,
    });
    expect(mockPayment).toHaveBeenCalledWith('order_x');
    expect(followerApi.verifyPayAtStore).toHaveBeenCalledWith({
      razorpay_order_id: 'order_x',
      razorpay_payment_id: 'pay_x',
    });

    const doneBtn = Alert.alert.mock.calls.at(-1)[2][0];
    doneBtn.onPress();
    expect(navigation.popToTop).toHaveBeenCalled();
  }, 20000);

  test('refuses when restaurant has no active campaign (no API call)', async () => {
    ensureFollowerAuth.mockResolvedValue(true);
    setup(params({ offer: { discount_value: 10 }, tracking: {} }));
    enterBillAndPay('1000');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Pay at Restaurant not available', expect.any(String)));
    expect(followerApi.payAtStore).not.toHaveBeenCalled();
  });

  test('blocks payment when not authenticated', async () => {
    ensureFollowerAuth.mockResolvedValue(false);
    setup(params());
    enterBillAndPay('1000');

    await waitFor(() => expect(ensureFollowerAuth).toHaveBeenCalled());
    expect(followerApi.payAtStore).not.toHaveBeenCalled();
  });
});
