/**
 * Smoke test — HomeScreen (the per-world page). Guards app launch: verifies the
 * home renders (tabs + craving rail + the active world's section feed) and that
 * tapping a craving tile triggers the in-page restaurant fetch.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  followerApi: {
    getVerticals: jest.fn(),
    getCategorySections: jest.fn(),
    getCategoryRestaurants: jest.fn(),
  },
}));
jest.mock('../../../contexts/LocationContext', () => ({
  useAppLocation: () => ({ location: { label: 'Hyderabad', latitude: 17.46, longitude: 78.38 } }),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../../../components/SectionRenderer', () => ({
  __esModule: true,
  default: () => null,
  hasEngineContent: (secs) => Array.isArray(secs) && secs.length > 0,
}));
jest.mock('../../../components/food/RestaurantResultCard', () => 'RestaurantResultCard');

import HomeScreen from '../HomeScreen';
import { followerApi } from '../../../services/api';

const VERTS = [{
  key: 'food', name: 'Food', icon: '🍽️',
  categories: [{ key: 'pizza', name: 'Pizza', image_url: null }, { key: 'biryani', name: 'Biryani', image_url: null }],
}];

beforeEach(() => {
  jest.clearAllMocks();
  followerApi.getVerticals.mockResolvedValue({ success: true, data: { verticals: VERTS } });
  followerApi.getCategorySections.mockResolvedValue({ success: true, data: { sections: [{ type: 'products', items: [{ id: 'p1', brand: { category: 'restaurant' } }] }] } });
  followerApi.getCategoryRestaurants.mockResolvedValue({ success: true, data: { restaurants: [{ brand_id: 'b1', business_name: 'Pizza House' }] } });
});

test('renders the world tabs + craving rail + loads the active world feed', async () => {
  const navigation = { navigate: jest.fn() };
  render(<HomeScreen navigation={navigation} />);
  expect(await screen.findByText("What's on your mind?")).toBeTruthy();
  expect(screen.getByText('Food')).toBeTruthy();
  expect(screen.getByText('Pizza')).toBeTruthy();
  await waitFor(() => expect(followerApi.getCategorySections).toHaveBeenCalledWith('food', expect.objectContaining({ latitude: 17.46 })));
});

test('tapping a craving tile fetches restaurants in-page', async () => {
  const navigation = { navigate: jest.fn() };
  render(<HomeScreen navigation={navigation} />);
  fireEvent.press(await screen.findByText('Pizza'));
  await waitFor(() => expect(followerApi.getCategoryRestaurants).toHaveBeenCalledWith('Pizza', expect.objectContaining({ lat: 17.46 })));
});
