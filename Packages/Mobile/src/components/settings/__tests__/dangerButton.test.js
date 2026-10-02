import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { DangerButton, PrimaryButton } from '../primitives';
import { settingsTokens as T } from '../../../theme/tokens';

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

/**
 * ui-walk-fixes (board E; research C05 / C07, check 18). Two things:
 *   · `outline` — the boards' decline: white, red label, pale red outline. Opt-in; the solid red
 *     block stays the default for the twenty-odd callers that pass nothing new.
 *   · the busy state can be READ in both looks. The spinner used to be red on the red fill.
 * jest cannot see a colour clash, so the pairs are checked by number (WCAG contrast).
 */
const flat = (el) => StyleSheet.flatten(el.props.style) || {};
const box = (el) => { const { opacity, ...rest } = flat(el); return rest; };

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('DangerButton looks (ui-walk-fixes board E)', () => {
  it('with nothing new passed it is the solid red block it has always been', () => {
    const { getByTestId, getByText } = render(<DangerButton label="Decline" onPress={() => {}} testID="d" />);
    expect(box(getByTestId('d'))).toEqual({ backgroundColor: T.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' });
    expect(flat(getByText('Decline')).color).toBe('#FFFFFF');
    expect(getByText('Decline').props.numberOfLines).toBeUndefined();
  });

  it('outline: white fill, red label, pale red outline — and exactly as tall as the solid one', () => {
    const { getByTestId, getByText } = render(<DangerButton outline label="Decline" onPress={() => {}} testID="d" />);
    const s = box(getByTestId('d'));
    expect(s.backgroundColor).toBe(T.bg);
    expect(s.borderWidth).toBe(1.5);
    expect(s.borderColor).toBe(T.dangerLine);
    expect(T.dangerLine).toBe('#F2B8B8');
    expect(flat(getByText('Decline')).color).toBe(T.danger);
    // 12.5 padding + 1.5 outline = the solid button's 14 padding: the two looks are one height.
    expect(s.paddingVertical + s.borderWidth).toBe(14);
  });

  it('busy, solid: a WHITE spinner and a white label on the red fill (the spinner used to be red on red)', () => {
    const { getByText, UNSAFE_getByType, getByTestId } = render(<DangerButton label="Withdraw" onPress={() => {}} busy testID="d" />);
    const spinner = UNSAFE_getByType(ActivityIndicator).props.color;
    expect(spinner).toBe('#FFFFFF');
    expect(flat(getByText('Working')).color).toBe('#FFFFFF');
    expect(box(getByTestId('d')).backgroundColor).toBe(T.danger);
    expect(contrast(spinner, T.danger)).toBeGreaterThan(4.5);
  });

  it('busy, outline: a RED spinner and a red label on the white fill — never white on white', () => {
    const onPress = jest.fn();
    const { getByText, UNSAFE_getByType, getByTestId } = render(<DangerButton outline label="Withdraw" onPress={onPress} busy busyLabel="Withdrawing" testID="d" />);
    const spinner = UNSAFE_getByType(ActivityIndicator).props.color;
    const label = flat(getByText('Withdrawing')).color;
    const fill = box(getByTestId('d')).backgroundColor;
    expect(spinner).toBe(T.danger);
    expect(label).toBe(T.danger);
    expect(fill).toBe(T.bg);
    expect(contrast(spinner, fill)).toBeGreaterThan(4.5);
    expect(contrast(label, fill)).toBeGreaterThan(4.5);
    // The outline look keeps the busy contract: no press goes through.
    fireEvent.press(getByTestId('d'));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByTestId('d').props.accessibilityState).toEqual({ disabled: true });
  });

  it('the resting labels are readable too: white on red, red on white', () => {
    expect(contrast('#FFFFFF', T.danger)).toBeGreaterThan(4.5);
    expect(contrast(T.danger, T.bg)).toBeGreaterThan(4.5);
  });
});
