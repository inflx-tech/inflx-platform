import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { BottomBar } from '../BottomBar';
import DefaultBottomBar from '../BottomBar';
import { PrimaryButton, SecondaryButton, DangerButton, AnswerBar } from '../../settings/primitives';
import { settingsTokens as T } from '../../../theme/tokens';

/**
 * ui-walk-fixes — board C, rule 1 (point 3 of the founder's walk, check 9).
 *
 * The keypad never hid the box being typed in: our own button bar did. It was drawn as an overlay
 * (`position: 'absolute', bottom: 0`), so it rode up with the keypad and sat on top of the form.
 * BottomBar is the same strip as part of the column. The one thing these tests must never let
 * back in is `position: 'absolute'`.
 *
 * This file runs under the suite's stub of react-native-safe-area-context, which has no insets
 * context at all — the bar must come out with a zero inset rather than throw.
 * (BottomBar.inset.test.js covers a real inset.)
 */
// A press starts TouchableOpacity's fade; with real timers it lands after the test and warns about act().
// React reports a badly built tree through console.error and carries on — every test here must
// leave it silent.
let errorSpy;
beforeEach(() => {
  jest.useFakeTimers();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errorSpy.mock.calls.map(args => args.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const box = (node) => { const { opacity, ...rest } = flat(node); return rest; };

describe('BottomBar — the strip the main button lives in', () => {
  it('is IN the layout: never absolute, never pinned by left / right / bottom', () => {
    const { getByTestId } = render(
      <BottomBar testID="bar"><PrimaryButton label="Send to Tanvi" onPress={() => {}} testID="send" /></BottomBar>,
    );
    const s = flat(getByTestId('bar'));
    expect(s.position).toBeUndefined();
    expect(s.bottom).toBeUndefined();
    expect(s.left).toBeUndefined();
    expect(s.right).toBeUndefined();
  });

  it('has the top hairline, the usual padding and a white ground', () => {
    const { getByTestId } = render(
      <BottomBar testID="bar"><PrimaryButton label="Save changes" onPress={() => {}} /></BottomBar>,
    );
    expect(flat(getByTestId('bar'))).toEqual({
      padding: 14, paddingBottom: 14, gap: 8, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border,
    });
  });

  it('passes the caller\'s button, its testID and its press straight through', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<BottomBar><PrimaryButton label="Next creator" onPress={onPress} testID="next" /></BottomBar>);
    fireEvent.press(getByTestId('next'));
    expect(onPress).toHaveBeenCalledTimes(1);
    // The main button is the plain full-width yellow button — the bar does not restyle it.
    expect(box(getByTestId('next'))).toEqual({ backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' });
  });

  it('stacks its children 8 apart, and an outline button under the main one loses its own top gap', () => {
    const { getByTestId, toJSON } = render(
      <BottomBar testID="bar">
        <PrimaryButton label="Confirm the shoot is done" icon="check" onPress={() => {}} testID="shoot" />
        <SecondaryButton strong icon="download" label="Download" onPress={() => {}} testID="download" />
      </BottomBar>,
    );
    expect(flat(getByTestId('bar')).gap).toBe(8);
    expect(toJSON().children.map(c => c.props.testID)).toEqual(['shoot', 'download']);
    // Outside the bar this button carries marginTop 10, which would make the 8 an 18.
    expect(box(getByTestId('download')).marginTop).toBe(0);
    // Stacked buttons are full width: they are not turned into halves.
    expect(box(getByTestId('download')).flexGrow).toBeUndefined();
    expect(box(getByTestId('shoot')).flexGrow).toBeUndefined();
  });

  it('a red button stacked in it is left as it is', () => {
    const { getByTestId } = render(
      <BottomBar><DangerButton label="Withdraw" onPress={() => {}} testID="withdraw" /></BottomBar>,
    );
    expect(box(getByTestId('withdraw'))).toEqual({ backgroundColor: T.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' });
  });

  it('draws the hint as a small centred grey line under the button', () => {
    const { getByTestId, toJSON } = render(
      <BottomBar hint="Saving your link…" hintTestID="posted-hint">
        <PrimaryButton label="I've posted everything" onPress={() => {}} testID="mark-posted" />
      </BottomBar>,
    );
    const hint = getByTestId('posted-hint');
    expect(hint.props.children).toBe('Saving your link…');
    expect(flat(hint)).toMatchObject({ textAlign: 'center', color: T.ink2, fontSize: 12 });
    const kids = toJSON().children;
    expect(kids[kids.length - 1].props.testID).toBe('posted-hint');
    expect(kids[0].props.testID).toBe('mark-posted');
  });

  it('takes the caller\'s own element as the hint', () => {
    const { getByTestId } = render(
      <BottomBar hint={<Text testID="own-hint" style={{ color: T.danger }}>One link needs fixing — see above.</Text>}>
        <PrimaryButton label="I've posted everything" disabled onPress={() => {}} />
      </BottomBar>,
    );
    expect(flat(getByTestId('own-hint')).color).toBe(T.danger);
  });

  it('a line passed as the first child sits above the button (the "Fix 1 thing above to save" line)', () => {
    const { toJSON } = render(
      <BottomBar>
        <Text testID="save-bar-fix">Fix 1 thing above to save</Text>
        <PrimaryButton label="Save changes" disabled onPress={() => {}} testID="save-button" />
      </BottomBar>,
    );
    expect(toJSON().children.map(c => c.props.testID)).toEqual(['save-bar-fix', 'save-button']);
  });

  it('holds an AnswerBar: the main button keeps its wrap, the pair stays a level pair', () => {
    const { getByTestId, getByText } = render(
      <BottomBar testID="bar">
        <AnswerBar testID="answer-actions" note="Nothing is final until you both sign the agreement."
          main={<PrimaryButton label="Accept" onPress={() => {}} testID="accept" />}>
          <SecondaryButton strong label="Counter" onPress={() => {}} testID="counter" />
          <DangerButton outline label="Decline" onPress={() => {}} testID="decline" />
        </AnswerBar>
      </BottomBar>,
    );
    // The main button's wrap: centred, side padding, and no cap on its lines (a long label wraps in full).
    expect(flat(getByText('Accept'))).toMatchObject({ textAlign: 'center', flexShrink: 1 });
    expect(box(getByTestId('accept')).paddingHorizontal).toBe(16);
    expect(getByText('Accept').props.numberOfLines).toBeUndefined();
    expect(box(getByTestId('counter'))).toMatchObject({ marginTop: 0, minHeight: 44, flexGrow: 1 });
    expect(box(getByTestId('decline'))).toMatchObject({ marginTop: 0, minHeight: 44, flexGrow: 1 });
    expect(getByTestId('answer-actions')).toBeTruthy();
  });

  it('with no child and no hint it draws nothing — no empty strip with a hairline', () => {
    expect(render(<BottomBar testID="bar" />).toJSON()).toBeNull();
    expect(render(<BottomBar testID="bar">{null}{false}</BottomBar>).toJSON()).toBeNull();
  });

  it('a fragment that holds nothing is nothing too — the usual `<>{a ? … : null}{b ? … : null}</>` with both off', () => {
    const canSave = false;
    const canSkip = false;
    const buttons = (
      <>
        {canSave ? <PrimaryButton label="Save changes" onPress={() => {}} testID="save" /> : null}
        {canSkip ? <SecondaryButton label="Skip" onPress={() => {}} testID="skip" /> : null}
      </>
    );
    const { toJSON, queryByTestId } = render(<BottomBar testID="bar">{buttons}</BottomBar>);
    expect(toJSON()).toBeNull();
    expect(queryByTestId('bar')).toBeNull();
    // … at any depth, and beside a plain null.
    expect(render(<BottomBar testID="bar">{null}<><>{false}</>{null}</></BottomBar>).toJSON()).toBeNull();
  });

  it('a fragment that DOES hold a button is drawn, and its buttons are still stacked 8 apart', () => {
    const { getByTestId, toJSON } = render(
      <BottomBar testID="bar">
        <>
          {null}
          <PrimaryButton label="Save changes" onPress={() => {}} testID="save" />
          <SecondaryButton label="Skip" onPress={() => {}} testID="skip" />
        </>
      </BottomBar>,
    );
    expect(toJSON().children.map(c => c.props.testID)).toEqual(['save', 'skip']);
    expect(flat(getByTestId('bar')).gap).toBe(8);
    expect(box(getByTestId('skip')).marginTop).toBe(0);
  });

  it('an empty fragment with a hint still draws the hint alone', () => {
    const { getByTestId, toJSON } = render(<BottomBar testID="bar" hint="Saving your link…" hintTestID="hint"><>{null}</></BottomBar>);
    expect(toJSON().children).toHaveLength(1);
    expect(getByTestId('hint')).toBeTruthy();
  });

  it('a caller\'s style is applied last', () => {
    const { getByTestId } = render(<BottomBar testID="bar" style={{ paddingTop: 10 }}><PrimaryButton label="Save" onPress={() => {}} /></BottomBar>);
    expect(flat(getByTestId('bar'))).toMatchObject({ padding: 14, paddingTop: 10, borderTopWidth: 1 });
  });

  it('is exported by name and as the default', () => {
    expect(DefaultBottomBar).toBe(BottomBar);
  });

  it('does not throw when nothing provides a safe-area inset', () => {
    expect(() => render(<BottomBar><PrimaryButton label="Save" onPress={() => {}} /></BottomBar>)).not.toThrow();
  });
});
