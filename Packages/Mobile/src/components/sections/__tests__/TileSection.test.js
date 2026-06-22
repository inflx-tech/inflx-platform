import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import TileSection from '../TileSection';

const tiles = [
  { image_url: 'http://x/a.jpg', label: 'Vitamin C', library_section_id: 'g1' },
  { label: 'Niacinamide', library_section_id: 'g2' },
];

test.each(['carousel', 'featured', 'grid', 'banner'])('renders %s style + fires onTile with the wired group', (style) => {
  const onTile = jest.fn();
  render(<TileSection section={{ title: 'Serums', config: { style, tiles, banner_image_url: 'http://x/b.jpg' } }} onTile={onTile} />);
  expect(screen.getByText('Vitamin C')).toBeTruthy();
  fireEvent.press(screen.getByText('Vitamin C'));
  expect(onTile).toHaveBeenCalledWith(expect.objectContaining({ library_section_id: 'g1' }));
});

test('renders nothing when there are no tiles', () => {
  const { toJSON } = render(<TileSection section={{ config: { tiles: [] } }} onTile={() => {}} />);
  expect(toJSON()).toBeNull();
});
