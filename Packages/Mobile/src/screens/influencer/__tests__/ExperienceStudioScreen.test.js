import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

/**
 * Phase 6b — Creator Experience Studio: pick a template → products → publish.
 * Contract: features/creator-experiences/. Off-device jest (mocked API).
 */

const mockCreate = jest.fn(async () => ({ success: true, data: { experience: { id: 'e1' } } }));
const mockPublish = jest.fn(async () => ({ success: true, data: { experience: { id: 'e1', status: 'published' } } }));
jest.mock('../../../services/api', () => ({
  influencerApi: {
    listExperienceTemplates: async () => ({ success: true, data: { templates: [{ id: 't1', name: 'Street Style Hero', section_style: 'hero', theme: { title: 'Street Style', subtitle: 'Urban looks…', min_products: 4, media_rules: { featured: 'required' } } }] } }),
    experienceStockable: async () => ({ success: true, data: { products: [{ id: 'p1', name: 'Oversized Tee', price: 1299, image_url: null }] } }),
    createExperience: (...a) => mockCreate(...a),
    publishExperience: (...a) => mockPublish(...a),
  },
}));

// eslint-disable-next-line import/first
import ExperienceStudioScreen from '../ExperienceStudioScreen';

test('creator picks a template, sees products, and publishes', async () => {
  render(<ExperienceStudioScreen navigation={{ goBack: jest.fn() }} />);

  // templates load
  const tpl = await screen.findByText('Street Style Hero');
  expect(tpl).toBeTruthy();

  // pick it → product step
  fireEvent.press(tpl);
  expect(await screen.findByText(/SELECT PRODUCTS/)).toBeTruthy();
  expect(screen.getByText('Oversized Tee')).toBeTruthy();

  // select a product + publish
  fireEvent.press(screen.getByText('Oversized Tee'));
  fireEvent.press(screen.getByLabelText('Publish'));

  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ template_id: 't1', product_ids: ['p1'] })));
  expect(mockPublish).toHaveBeenCalledWith('e1');
  expect(await screen.findByText(/Published/)).toBeTruthy();
});
