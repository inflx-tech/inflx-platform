import React from 'react';
import { render, screen } from '@testing-library/react-native';
import AdaptiveRenderer from '../AdaptiveRenderer';
import { SAMPLE_SPECS } from '../sampleSpecs';

/**
 * Phase 4b — AdaptiveRenderer obeys the Layout Contract (off-device jest).
 * Contract: features/adaptive-renderer/. No emulator; proves the RN component
 * renders exactly resolved.visible_slots — required shown, hidden absent.
 */

const byKey = (k) => SAMPLE_SPECS.find((s) => s.key === k).spec;
const SUBTITLE = 'Urban looks curated for everyday confidence.';

test('Hero shows title, subtitle, CTA and offer (all in its contract)', () => {
  render(<AdaptiveRenderer spec={byKey('hero_banner')} />);
  expect(screen.getByText('Street Style')).toBeTruthy();
  expect(screen.getByText(SUBTITLE)).toBeTruthy();
  expect(screen.getByText('Explore collection')).toBeTruthy();
  expect(screen.getByText('20% OFF')).toBeTruthy();
});

test('Story drops subtitle and CTA (hidden by its contract) but keeps title', () => {
  render(<AdaptiveRenderer spec={byKey('story_card')} />);
  expect(screen.getByText('Street Style')).toBeTruthy();
  expect(screen.queryByText(SUBTITLE)).toBeNull();       // hidden
  expect(screen.queryByText('Explore collection')).toBeNull(); // hidden
  expect(screen.getByText('20% OFF')).toBeTruthy();      // optional, present
});

test('Tile keeps only featured + title + avatar; drops offer', () => {
  render(<AdaptiveRenderer spec={byKey('small_tile')} />);
  expect(screen.getByText('Street Style')).toBeTruthy();
  expect(screen.queryByText('20% OFF')).toBeNull();      // hidden on tile
  expect(screen.queryByText('Explore collection')).toBeNull();
});

test('Magazine (card layout) credits the creator', () => {
  render(<AdaptiveRenderer spec={byKey('magazine_card')} />);
  expect(screen.getByText('Street Style')).toBeTruthy();
  expect(screen.getByText('by Rahul')).toBeTruthy();
});

test('a blocked spec shows a missing-slot placeholder, not a crash', () => {
  const blocked = { ...byKey('hero_banner'), resolved: { visible_slots: [], featured_pick: null, blocked: true, missing: ['featured_image'] } };
  render(<AdaptiveRenderer spec={blocked} />);
  expect(screen.getByText(/missing: featured_image/i)).toBeTruthy();
});
