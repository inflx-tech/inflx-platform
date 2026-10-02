import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

/**
 * ui-walk-fixes — BottomBar respects the phone's bottom safe-area inset.
 *
 * The suite's own stub of react-native-safe-area-context has no insets context, so this file
 * swaps in one that does — the shape of the real package (`SafeAreaInsetsContext`, null when no
 * provider is above) — to prove both halves: a real inset is added under the bar's padding, and
 * a missing provider is a zero inset, never a crash. (The package's own `useSafeAreaInsets()`
 * throws without a provider; BottomBar reads the context precisely so that it cannot.)
 */
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return { SafeAreaInsetsContext: React.createContext(null) };
});

const { SafeAreaInsetsContext } = require('react-native-safe-area-context');
const { BottomBar } = require('../BottomBar');
const { PrimaryButton } = require('../../settings/primitives');

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const bar = () => <BottomBar testID="bar"><PrimaryButton label="Send to Tanvi" onPress={() => {}} /></BottomBar>;

describe('BottomBar — bottom safe-area inset', () => {
  it('adds the inset under its own 14 padding', () => {
    const { getByTestId } = render(
      <SafeAreaInsetsContext.Provider value={{ top: 24, bottom: 20, left: 0, right: 0 }}>{bar()}</SafeAreaInsetsContext.Provider>,
    );
    expect(flat(getByTestId('bar')).paddingBottom).toBe(34);
    expect(flat(getByTestId('bar')).padding).toBe(14);
  });

  it('a zero inset (a phone with the three-button bar, or the keypad open) leaves the plain padding', () => {
    const { getByTestId } = render(
      <SafeAreaInsetsContext.Provider value={{ top: 24, bottom: 0, left: 0, right: 0 }}>{bar()}</SafeAreaInsetsContext.Provider>,
    );
    expect(flat(getByTestId('bar')).paddingBottom).toBe(14);
  });

  it('no provider above it: zero inset, no throw', () => {
    const { getByTestId } = render(bar());
    expect(flat(getByTestId('bar')).paddingBottom).toBe(14);
  });

  it('a broken inset value never shrinks the padding or reaches the style as a non-number', () => {
    for (const bottom of [undefined, null, -5, 'x']) {
      const { getByTestId, unmount } = render(
        <SafeAreaInsetsContext.Provider value={{ top: 0, bottom, left: 0, right: 0 }}>{bar()}</SafeAreaInsetsContext.Provider>,
      );
      expect(flat(getByTestId('bar')).paddingBottom).toBe(14);
      unmount();
    }
  });
});
