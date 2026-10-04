/**
 * shopper-walk-fixes · frame C2 — the main button's opt-in `oneLine`.
 * Contract: features/shopper-walk-fixes · spec C5
 *
 * "Send to Aveen fashion boutique and desiner studio" broke into two left-aligned lines. With
 * `oneLine` the label is one centred line, cut at its end with "…"; the button never grows to a
 * second line. It is opt-in: every button that does not pass it is drawn exactly as before.
 *
 * jest cannot see a layout, so "one centred line" is asserted the only way it can be here: by the
 * props and style the label and its box actually receive.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, within } from '@testing-library/react-native';
import { PrimaryButton, ButtonRow, AnswerBar } from '../primitives';
import { BottomBar } from '../../shell/BottomBar';
import { settingsTokens as T } from '../../../theme/tokens';

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const box = (node) => { const { opacity, ...rest } = flat(node); return rest; };
const LONG = 'Send to Aveen fashion boutique and desiner studio';
// What the main button drew before this contract — copied from the source of that day.
const TODAY = { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' };

let errors;
beforeEach(() => { errors = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => {
  const said = errors.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errors.mockRestore();
  expect(said).toEqual([]);
});

describe('without `oneLine` nothing changes', () => {
  it('the box, and a label that is neither clamped, cut nor re-aligned', () => {
    const r = render(<PrimaryButton label={LONG} onPress={() => {}} testID="b" />);
    expect(box(r.getByTestId('b'))).toEqual(TODAY);
    const label = r.getByText(LONG);
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.ellipsizeMode).toBeUndefined();
    expect(flat(label).textAlign).toBeUndefined();
    expect(flat(label).flexShrink).toBeUndefined();
  });

  it('`oneLine={false}` is the same as not passing it', () => {
    const r = render(<PrimaryButton label={LONG} onPress={() => {}} oneLine={false} testID="b" />);
    expect(box(r.getByTestId('b'))).toEqual(TODAY);
    expect(r.getByText(LONG).props.numberOfLines).toBeUndefined();
  });

  it('an AnswerBar\'s main button still wraps in full, however long', () => {
    const r = render(<AnswerBar main={<PrimaryButton label={LONG} onPress={() => {}} testID="b" />} />);
    expect(r.getByText(LONG).props.numberOfLines).toBeUndefined();
    expect(r.getByText(LONG).props.ellipsizeMode).toBeUndefined();
  });
});

describe('with `oneLine`', () => {
  it('one centred line, cut at the end with "…", with room at both sides — same height as any main button', () => {
    const r = render(<PrimaryButton label={LONG} onPress={() => {}} oneLine testID="b" />);
    const label = r.getByText(LONG);
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.ellipsizeMode).toBe('tail');
    expect(flat(label).textAlign).toBe('center');
    expect(flat(label).flexShrink).toBe(1);
    expect(box(r.getByTestId('b'))).toEqual({ ...TODAY, paddingHorizontal: 16 });
  });

  it('in a screen\'s button strip (BottomBar), where "Send to …" lives', () => {
    const r = render(<BottomBar testID="bar"><PrimaryButton label={LONG} onPress={() => {}} oneLine testID="send" /></BottomBar>);
    const label = within(r.getByTestId('send')).getByText(LONG);
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.ellipsizeMode).toBe('tail');
    expect(flat(r.getByTestId('send')).paddingHorizontal).toBe(16);
  });

  it('greyed out it is still one line, in the disabled colours', () => {
    const r = render(<PrimaryButton label={LONG} onPress={() => {}} oneLine disabled testID="b" />);
    expect(r.getByText(LONG).props.numberOfLines).toBe(1);
    expect(flat(r.getByText(LONG)).color).toBe(T.disabledText);
    expect(flat(r.getByTestId('b')).backgroundColor).toBe(T.disabledBg);
    expect(r.getByTestId('b').props.accessibilityState).toEqual({ disabled: true });
  });

  it('with an icon, and while busy, the label is still one line that can shrink', () => {
    const icon = render(<PrimaryButton label={LONG} onPress={() => {}} oneLine icon="check" testID="b" />);
    expect(icon.getByText(LONG).props.numberOfLines).toBe(1);
    expect(flat(icon.getByText(LONG)).flexShrink).toBe(1);
    const busy = render(<PrimaryButton label={LONG} onPress={() => {}} oneLine busy busyLabel="Sending" testID="b" />);
    expect(busy.getByText('Sending').props.numberOfLines).toBe(1);
    expect(busy.getByText('Sending').props.ellipsizeMode).toBe('tail');
  });

  it('inside a ButtonRow the row\'s own rule already holds — `oneLine` adds nothing there', () => {
    const plain = render(<ButtonRow><PrimaryButton label="Send" onPress={() => {}} testID="b" /><PrimaryButton label="Other" onPress={() => {}} testID="o" /></ButtonRow>);
    const one = render(<ButtonRow><PrimaryButton label="Send" onPress={() => {}} oneLine testID="b" /><PrimaryButton label="Other" onPress={() => {}} testID="o" /></ButtonRow>);
    expect(box(one.getByTestId('b'))).toEqual(box(plain.getByTestId('b')));
    expect(one.getByText('Send').props.numberOfLines).toBe(1);
    expect(one.getByText('Send').props.ellipsizeMode).toBeUndefined();
  });
});
