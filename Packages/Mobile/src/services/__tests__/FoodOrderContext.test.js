/**
 * Food 3C-3 — FoodOrderProvider. Guards the founder's flow: adding a dish from a
 * discovery surface puts it in the cart AND navigates INTO that restaurant's
 * storefront. A no-add-on dish adds directly; the BrandStore nav fires either way.
 */
import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockAddItem = jest.fn(() => ({ ok: true }));
const mockForceReplace = jest.fn();
jest.mock('../CartContext', () => ({ useCart: () => ({ addItem: mockAddItem, forceReplaceWith: mockForceReplace }) }));

const mockGetProductDetail = jest.fn();
jest.mock('../api', () => ({ followerApi: { getProductDetail: (...a) => mockGetProductDetail(...a) } }));
jest.mock('../../components/food/DishDetailSheet', () => 'DishDetailSheet');
jest.mock('../../components/food/CustomiseSheet', () => 'CustomiseSheet');

import { FoodOrderProvider, useFoodOrder } from '../FoodOrderContext';

const navigation = { navigate: jest.fn() };
const BRAND = { id: 'b1', name: 'Sagar', category: 'restaurant', store_offers: [] };

function Trigger({ product, mode }) {
  const { openDish } = useFoodOrder();
  useEffect(() => { openDish(product, BRAND, navigation, mode); }, []);
  return null;
}

beforeEach(() => { jest.clearAllMocks(); });

test('add a no-add-on dish → cart add + land in storefront', async () => {
  mockGetProductDetail.mockResolvedValue({ success: true, data: { product: { id: 'p1', name: 'Idli', price: 40, addon_groups: [] } } });
  render(<FoodOrderProvider><Trigger product={{ id: 'p1', name: 'Idli', price: 40 }} mode="add" /></FoodOrderProvider>);

  await waitFor(() => expect(mockAddItem).toHaveBeenCalled());
  expect(mockAddItem).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'p1', qty: 1 }), 'b1', 'Sagar', null, expect.any(Object));
  expect(navigation.navigate).toHaveBeenCalledWith('BrandStore', expect.objectContaining({ brandId: 'b1' }));
});

test('dish WITH add-ons → opens customise (no direct add, no nav yet)', async () => {
  mockGetProductDetail.mockResolvedValue({ success: true, data: { product: { id: 'p2', name: 'Dosa', price: 90, addon_groups: [{ id: 'g1', is_variation: true, items: [{ id: 'v1', name: 'Full', price: 114 }] }] } } });
  render(<FoodOrderProvider><Trigger product={{ id: 'p2', name: 'Dosa', price: 90 }} mode="add" /></FoodOrderProvider>);

  await waitFor(() => expect(mockGetProductDetail).toHaveBeenCalledWith('p2'));
  expect(mockAddItem).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
});
