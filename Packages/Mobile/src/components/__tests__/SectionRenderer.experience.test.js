import React from 'react';
import { render, screen } from '@testing-library/react-native';

/**
 * Phase 6b — the follower renders a placed template's experiences via the
 * Adaptive Renderer. Contract: features/creator-experiences/. Off-device jest.
 */

jest.mock('../../services/FoodOrderContext', () => ({ useFoodOrder: () => ({ openDish: jest.fn() }) }));
jest.mock('../../services/api', () => ({ followerApi: { recordSectionEvent: jest.fn(), follow: jest.fn() } }));

// eslint-disable-next-line import/first
import { SectionItem } from '../SectionRenderer';
// eslint-disable-next-line import/first
import { SAMPLE_SPECS } from '../experience/sampleSpecs';

const heroSpec = SAMPLE_SPECS.find((s) => s.key === 'hero_banner').spec;

test('a placed-template shelf draws each experience via the Adaptive Renderer', () => {
  const section = {
    type: 'mixed', title: 'Creator Picks', shelf_key: 'tpl_x', rule: 'experience_template',
    items: [{ entity_type: 'experience', id: 'exp1', render_spec: heroSpec, via_creator: { handle: 'rahul', name: 'Rahul' } }],
  };
  render(<SectionItem section={section} navigation={{ navigate: jest.fn() }} context={{}} />);
  expect(screen.getByText('Creator Picks')).toBeTruthy();       // shelf header
  expect(screen.getByText('Street Style')).toBeTruthy();        // title drawn by AdaptiveRenderer
  expect(screen.getByText('Explore collection')).toBeTruthy();  // hero CTA per contract
});

test('a normal (non-experience) mixed shelf is unaffected', () => {
  const section = { type: 'mixed', title: 'Deals', items: [{ id: 'o1', brand: { name: 'QA Store', category: 'fashion' }, discount_value: 20 }] };
  render(<SectionItem section={section} navigation={{ navigate: jest.fn() }} context={{}} />);
  expect(screen.getByText('Deals')).toBeTruthy();
});
