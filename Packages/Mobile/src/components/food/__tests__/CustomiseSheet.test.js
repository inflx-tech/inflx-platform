import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import CustomiseSheet from '../CustomiseSheet';

const product = {
  id: 'p1', name: 'Tandoori Chicken', price: 0, image_url: null,
  addon_groups: [
    { id: 'v', name: 'Portion', is_variation: true, selection_type: 'single', items: [
      { id: 'half', name: 'Half', price: 99, is_default: false },
      { id: 'full', name: 'Full', price: 169, is_default: true } ] },
    { id: 'b', name: 'Beverage', is_variation: false, selection_type: 'multi', max_select: 5, items: [
      { id: 'cola', name: 'Cola', price: 50, is_default: false } ] },
  ],
};

test('variation sets base, add-ons stack, Add returns the resolved line', () => {
  const onAdd = jest.fn();
  render(<CustomiseSheet visible product={product} onClose={() => {}} onAdd={onAdd} />);
  expect(screen.getByText('Add Item · ₹169')).toBeTruthy();   // Full default
  fireEvent.press(screen.getByText('Cola'));                  // +50 → 219
  expect(screen.getByText('Add Item · ₹219')).toBeTruthy();
  fireEvent.press(screen.getByText('Half'));                  // 99 + 50 → 149
  expect(screen.getByText('Add Item · ₹149')).toBeTruthy();
  fireEvent.press(screen.getByText('Add Item · ₹149'));
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
    id: 'p1', price: 149, qty: 1,
    variation: { item_id: 'half' },
    selected_addons: [{ item_id: 'cola' }],
  }));
});
