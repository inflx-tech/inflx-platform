import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DangerButton, PrimaryButton } from '../primitives';

/**
 * Item 10 (approval §2.2, check 44): `busy` used to be accepted and DROPPED by DangerButton, so
 * the decline / withdraw / reject sheets stayed tappable mid-request and two taps could fire two
 * declines. It now honours busy exactly as PrimaryButton does. Contract: features/item10-store-visit
 */
describe('DangerButton honours busy (check 44)', () => {
  it('two taps while busy produce ZERO presses; not busy, one tap is one press', () => {
    const onPress = jest.fn();
    const { getByTestId, rerender } = render(<DangerButton label="Decline" onPress={onPress} busy testID="danger" />);
    fireEvent.press(getByTestId('danger'));
    fireEvent.press(getByTestId('danger'));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByTestId('danger').props.accessibilityState).toEqual({ disabled: true });

    rerender(<DangerButton label="Decline" onPress={onPress} busy={false} testID="danger" />);
    fireEvent.press(getByTestId('danger'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByTestId('danger').props.accessibilityState).toEqual({ disabled: false });
  });

  it('disabled alone also blocks the press, and the state is a real boolean (never null — Android crashes on null)', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<DangerButton label="Withdraw" onPress={onPress} disabled testID="d2" />);
    fireEvent.press(getByTestId('d2'));
    expect(onPress).not.toHaveBeenCalled();
    expect(typeof getByTestId('d2').props.accessibilityState.disabled).toBe('boolean');
    const { getByTestId: g } = render(<DangerButton label="Withdraw" onPress={onPress} testID="d3" />);
    expect(g('d3').props.accessibilityState.disabled).toBe(false);
  });

  it('matches PrimaryButton\'s contract, so the two cannot drift', () => {
    const { getByTestId } = render(<PrimaryButton label="Sign" onPress={() => {}} busy testID="p" />);
    expect(getByTestId('p').props.accessibilityState).toEqual({ disabled: true });
  });
});
