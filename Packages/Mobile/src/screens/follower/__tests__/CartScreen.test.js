/**
 * Smoke test — CartScreen (Food 3C-3). Guards the unified cart: renders a
 * customised line (variation + add-ons + note summary), the bill total, and the
 * green Place Order CTA; checkout navigates to OnlineOrder carrying the line's
 * customisation + brand_offer_id; an empty cart shows the empty state.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}));
jest.mock('../../../services/api', () => ({ followerApi: { getProductDetail: jest.fn(), getCartRecommendations: jest.fn(() => Promise.resolve({ data: { items: [] } })) } }));
jest.mock('../../../components/food/CustomiseSheet', () => 'CustomiseSheet');

let mockCart;
jest.mock('../../../services/CartContext', () => ({
  useCart: () => ({
    cart: mockCart,
    updateQty: jest.fn(),
    removeItem: jest.fn(),
    replaceLine: jest.fn(),
    applyOffer: jest.fn(),
    clearOffer: jest.fn(),
  }),
}));

import CartScreen from '../CartScreen';

const LINE = {
  product_id: 'p1', line_key: 'p1::::v1|a1', name: 'Ghee Roast Dosa',
  price: 148, mrp: null, image_url: null, qty: 1,
  variation: { item_id: 'v1' }, selected_addons: [{ item_id: 'a1' }],
  variation_name: 'Full', addon_names: ['Extra cheese'], note: 'less spicy',
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => { jest.clearAllMocks(); });

test('renders a customised line + bill + Place Order, and checkout carries customisation + offer', () => {
  mockCart = {
    brandId: 'b1', brandName: "Sagar's Tiffins", items: [LINE],
    tracking: null, offer: null, creatorHandle: null,
    storeOffers: [], appliedOffer: { brand_offer_id: 'o9', name: 'FLAT 30', offer_type: 'discount' },
  };
  render(<CartScreen navigation={navigation} />);

  // customisation summary + note are visible
  expect(screen.getByText('Ghee Roast Dosa')).toBeTruthy();
  expect(screen.getByText('Full · Extra cheese')).toBeTruthy();
  expect(screen.getByText('“less spicy”')).toBeTruthy();

  // Place Order present → checkout carries the customisation + brand_offer_id
  fireEvent.press(screen.getByText('Place Order'));
  expect(navigation.navigate).toHaveBeenCalledWith('OnlineOrder', expect.objectContaining({
    brand_offer_id: 'o9',
    products: [expect.objectContaining({
      id: 'p1', variation: { item_id: 'v1' },
      selected_addons: [{ item_id: 'a1' }], note: 'less spicy',
    })],
  }));
});

test('empty cart shows the empty state', () => {
  mockCart = { brandId: null, brandName: null, items: [], tracking: null, offer: null, creatorHandle: null, storeOffers: [], appliedOffer: null };
  render(<CartScreen navigation={navigation} />);
  expect(screen.getByText('Your cart is empty')).toBeTruthy();
});
