/**
 * Smoke test — HomeScreen (per-world page, section-stack). Guards app launch:
 * the home renders world tabs + the active world's section stack, the category
 * rail (now a placeable 'category_rail' section) renders its tiles, and tapping
 * a tile triggers the in-page restaurant fetch.
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
  SectionItem: () => null,
  hasEngineContent: (secs) => Array.isArray(secs) && secs.length > 0,
}));
jest.mock('../../../components/food/RestaurantResultCard', () => 'RestaurantResultCard');

import HomeScreen from '../HomeScreen';
import { followerApi } from '../../../services/api';

const VERTS = [{ key: 'food', name: 'Food', icon: '🍽️', categories: [{ key: 'pizza', name: 'Pizza' }] }];
const SECTIONS = [
  { type: 'category_rail', title: "What's on your mind?", config: { sticky: true },
    items: [{ key: 'pizza', name: 'Pizza' }, { key: 'biryani', name: 'Biryani' }] },
  { type: 'products', items: [{ id: 'p1', brand: { category: 'restaurant' } }] },
];

beforeEach(() => {
  jest.clearAllMocks();
  followerApi.getVerticals.mockResolvedValue({ success: true, data: { verticals: VERTS } });
  followerApi.getCategorySections.mockResolvedValue({ success: true, data: { sections: SECTIONS } });
  followerApi.getCategoryRestaurants.mockResolvedValue({ success: true, data: { restaurants: [{ brand_id: 'b1', business_name: 'Pizza House' }] } });
});

test('renders tabs + the placed category rail, and loads the world feed', async () => {
  render(<HomeScreen navigation={{ navigate: jest.fn() }} />);
  expect(await screen.findByText("What's on your mind?")).toBeTruthy();
  expect(screen.getByText('Food')).toBeTruthy();
  expect(screen.getByText('Pizza')).toBeTruthy();
  await waitFor(() => expect(followerApi.getCategorySections).toHaveBeenCalledWith('food', expect.objectContaining({ latitude: 17.46 })));
});

test('tapping a rail tile fetches restaurants in-page', async () => {
  render(<HomeScreen navigation={{ navigate: jest.fn() }} />);
  fireEvent.press(await screen.findByText('Pizza'));
  await waitFor(() => expect(followerApi.getCategoryRestaurants).toHaveBeenCalledWith('Pizza', expect.objectContaining({ lat: 17.46 })));
});
