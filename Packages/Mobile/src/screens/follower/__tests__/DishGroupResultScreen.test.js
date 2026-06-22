/**
 * Layer 3 render test — DishGroupResultScreen (Food World 3C-1).
 * Verifies the tap-result populate path: restaurants render with rating/ETA/
 * from-price/varieties, "View menu" opens the storefront, and the empty state.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  followerApi: { getDishGroupRestaurants: jest.fn() },
}));
jest.mock('../../../contexts/LocationContext', () => ({
  useAppLocation: () => ({ location: { latitude: 16.5, longitude: 80.6 } }),
}));

import DishGroupResultScreen from '../DishGroupResultScreen';
import { followerApi } from '../../../services/api';

const REST = [{
  brand_id: 'b1', business_name: 'Paradise Biryani', avg_rating: 4.6, review_count: 980,
  distance_km: 2.0, free_delivery: true, eta_min_mins: 20, eta_max_mins: 25,
  from_price: 180, varieties: ['Chicken Dum Biryani', 'Mutton Biryani', 'Veg Biryani', 'Family Pack'],
}];

function setup(over = {}) {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  render(<DishGroupResultScreen route={{ params: { groupId: 1, groupName: 'Biryani', ...over } }} navigation={navigation} />);
  return { navigation };
}

beforeEach(() => jest.clearAllMocks());

test('renders restaurants for a dish group and opens the storefront', async () => {
  followerApi.getDishGroupRestaurants.mockResolvedValue({ success: true, data: { restaurants: REST } });
  const { navigation } = setup();
  expect(await screen.findByText('Paradise Biryani')).toBeTruthy();
  expect(screen.getByText('★ 4.6')).toBeTruthy();
  expect(screen.getByText(/20–25 mins/)).toBeTruthy();
  expect(screen.getByText('+1')).toBeTruthy();           // 4 varieties → 3 chips + overflow
  fireEvent.press(screen.getByText('View menu →'));
  expect(navigation.navigate).toHaveBeenCalledWith('BrandStore', expect.objectContaining({ brandId: 'b1' }));
});

test('shows empty state when no restaurants serve the group', async () => {
  followerApi.getDishGroupRestaurants.mockResolvedValue({ success: true, data: { restaurants: [] } });
  setup();
  expect(await screen.findByText('No one nearby serves this yet')).toBeTruthy();
});
