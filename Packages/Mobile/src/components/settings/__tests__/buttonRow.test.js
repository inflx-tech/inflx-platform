import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import {
  PrimaryButton, SecondaryButton, DangerButton, ButtonRow, AnswerBar, AnswerNote, ButtonSlot, buttonsOf,
} from '../primitives';
import { settingsTokens as T } from '../../../theme/tokens';

/**
 * ui-walk-fixes — board E (points 5 and 7 of the founder's walk, checks 15 and 18).
 *
 * The creator's Counter sat 10 lower than Decline and came out 2 taller, and the brand's
 * "Not yet" did the same beside "Send". One cause: the outline button carries a 10 top gap and a
 * 1px border because it was made to sit UNDER another button; the filled and red ones have
 * neither. These tests pin the cure — and pin that every button used the old way is untouched.
 *
 * jest cannot see a layout, so "level" is asserted the only way it can be here: by the style
 * each half actually receives. The phone walk (check 16) is still the proof of the picture.
 */
// A press starts TouchableOpacity's fade; with real timers it lands after the test and warns about act().
//
// React reports a clash of keys — and most other mistakes in how a tree is put together — through
// console.error and then carries on, so an assertion on the tree alone never sees it. Every test in
// this file must leave console.error silent; a test that expects a report takes it with heard().
let errorSpy;
const heard = () => {
  const said = errorSpy.mock.calls.map(args => args.map(String).join(' ').split('\n')[0]);
  errorSpy.mockClear();
  return said;
};
beforeEach(() => {
  jest.useFakeTimers();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = heard();
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
/** A touchable's own box, minus the opacity TouchableOpacity animates. */
const box = (node) => { const { opacity, ...rest } = flat(node); return rest; };
const edge = (s) => s.paddingVertical + (s.borderWidth || 0);

// What these three drew on 1 Oct 2026, before this contract — copied from the source of that day.
const TODAY = {
  primary: { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, marginTop: 10 },
  danger: { backgroundColor: T.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
};

describe('a button used the old way is drawn exactly as before', () => {
  it('PrimaryButton, SecondaryButton and DangerButton keep their box, and their label is not clamped or re-aligned', () => {
    const { getByTestId, getByText } = render(
      <>
        <PrimaryButton label="Accept" onPress={() => {}} testID="p" />
        <SecondaryButton label="Counter" onPress={() => {}} testID="s" />
        <DangerButton label="Decline" onPress={() => {}} testID="d" />
      </>,
    );
    expect(box(getByTestId('p'))).toEqual(TODAY.primary);
    expect(box(getByTestId('s'))).toEqual(TODAY.secondary);
    expect(box(getByTestId('d'))).toEqual(TODAY.danger);
    for (const label of ['Accept', 'Counter', 'Decline']) {
      expect(getByText(label).props.numberOfLines).toBeUndefined();
      expect(flat(getByText(label)).textAlign).toBeUndefined();
      expect(flat(getByText(label)).flexShrink).toBeUndefined();
    }
    expect(Object.keys(flat(getByText('Accept'))).sort()).toEqual(['color', 'fontFamily', 'fontSize']);
  });

  it('the icon and busy forms of PrimaryButton are untouched as well', () => {
    const { getByText, getByTestId, rerender } = render(<PrimaryButton label="Confirm the shoot is done" icon="check" onPress={() => {}} testID="p" />);
    expect(box(getByTestId('p'))).toEqual(TODAY.primary);
    expect(flat(getByText('Confirm the shoot is done'))).toMatchObject({ marginLeft: 8, fontSize: 15 });
    expect(getByText('Confirm the shoot is done').props.numberOfLines).toBeUndefined();
    rerender(<PrimaryButton label="Send" busy onPress={() => {}} testID="p" />);
    expect(getByText('Saving')).toBeTruthy();
    expect(getByText('Saving').props.numberOfLines).toBeUndefined();
  });
});

describe('SecondaryButton — inline, strong, disabled', () => {
  it('`inline` drops the built-in top gap and changes nothing else', () => {
    const { getByTestId } = render(<SecondaryButton inline label="Download" onPress={() => {}} testID="s" />);
    expect(box(getByTestId('s'))).toEqual({ ...TODAY.secondary, marginTop: 0 });
  });

  it('`strong` is the boards\' clear dark outline — 1.5 ink — and is no taller than the pale one', () => {
    const { getByTestId } = render(
      <>
        <SecondaryButton label="Counter" onPress={() => {}} testID="pale" />
        <SecondaryButton strong label="Counter" onPress={() => {}} testID="strong" />
      </>,
    );
    const strong = box(getByTestId('strong'));
    expect(strong.borderWidth).toBe(1.5);
    expect(strong.borderColor).toBe(T.ink);
    expect(strong.marginTop).toBe(10); // strong alone does not move it
    expect(edge(strong)).toBe(edge(box(getByTestId('pale'))));
  });

  it('`icon` still draws before the label, with the strong outline too', () => {
    const { getByText } = render(<SecondaryButton strong icon="undo-variant" label="Counter" onPress={() => {}} />);
    expect(getByText('undo-variant')).toBeTruthy(); // the icon stub prints its name
    expect(getByText('Counter')).toBeTruthy();
  });

  it('`disabled` now works: no press goes through, and the state is a real boolean', () => {
    const onPress = jest.fn();
    const { getByTestId, rerender } = render(<SecondaryButton label="Not yet" onPress={onPress} disabled testID="s" />);
    fireEvent.press(getByTestId('s'));
    fireEvent.press(getByTestId('s'));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByTestId('s').props.accessibilityState).toEqual({ disabled: true });
    expect(flat(getByTestId('s')).opacity).toBeLessThan(1);

    rerender(<SecondaryButton label="Not yet" onPress={onPress} disabled={false} testID="s" />);
    fireEvent.press(getByTestId('s'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByTestId('s').props.accessibilityState).toEqual({ disabled: false });
  });

  it('with no `disabled` passed it is pressable and says so — never null (Android crashes on null)', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<SecondaryButton label="Cancel" onPress={onPress} testID="s" />);
    expect(getByTestId('s').props.accessibilityState).toEqual({ disabled: false });
    expect(typeof getByTestId('s').props.accessibilityState.disabled).toBe('boolean');
    fireEvent.press(getByTestId('s'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('`disabled={busy}` with busy undefined (how the eight sheets pass it at rest) leaves it pressable', () => {
    const onPress = jest.fn();
    const busy = undefined;
    const { getByTestId } = render(<SecondaryButton label="Not yet" onPress={onPress} disabled={busy} testID="s" />);
    fireEvent.press(getByTestId('s'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByTestId('s').props.accessibilityState).toEqual({ disabled: false });
  });

  it('announces itself as a button', () => {
    const { getByTestId } = render(<SecondaryButton label="Cancel" onPress={() => {}} testID="s" />);
    expect(getByTestId('s').props.accessibilityRole).toBe('button');
  });
});

describe('ButtonRow — two equal, level halves', () => {
  it('two children: two equal halves, 8 apart, stretched to one height', () => {
    const { toJSON } = render(
      <ButtonRow testID="row">
        <SecondaryButton label="Not yet" onPress={() => {}} testID="send-not-yet" />
        <PrimaryButton label="Send" onPress={() => {}} testID="send-confirm" />
      </ButtonRow>,
    );
    const row = toJSON();
    expect(row.props.testID).toBe('row');
    expect(flat(row)).toMatchObject({ flexDirection: 'row', alignItems: 'stretch' });
    expect(row.children).toHaveLength(2);
    const [left, right] = row.children.map(flat);
    expect(left.flex).toBe(1);
    expect(right.flex).toBe(1);
    expect(left.marginLeft).toBeUndefined();
    expect(right.marginLeft).toBe(8);
  });

  it('the halves carry NO top gap and the same padding-plus-outline, so neither sits lower nor comes out taller', () => {
    // Every pair the board draws: outline + filled, outline + red, strong outline + red outline.
    const pairs = [
      [<SecondaryButton label="Not yet" onPress={() => {}} testID="a" />, <PrimaryButton label="Send" onPress={() => {}} testID="b" />],
      [<SecondaryButton label="Counter" onPress={() => {}} testID="a" />, <DangerButton label="Decline" onPress={() => {}} testID="b" />],
      [<SecondaryButton strong icon="undo-variant" label="Counter" onPress={() => {}} testID="a" />, <DangerButton outline label="Decline" onPress={() => {}} testID="b" />],
      [<SecondaryButton strong label="Keep it" onPress={() => {}} testID="a" />, <DangerButton outline busy label="Withdraw" onPress={() => {}} testID="b" />],
      [<PrimaryButton label="Add money" onPress={() => {}} testID="a" />, <PrimaryButton label="Withdraw" disabled onPress={() => {}} testID="b" />],
    ];
    for (const [a, b] of pairs) {
      const { getByTestId, unmount } = render(<ButtonRow>{a}{b}</ButtonRow>);
      const A = box(getByTestId('a'));
      const B = box(getByTestId('b'));
      for (const half of [A, B]) {
        expect(half.marginTop).toBe(0);
        expect(half.minHeight).toBe(44);          // U4: tall enough to tap
        expect(half.flexGrow).toBe(1);            // fills the half's height …
        expect(half.alignSelf).toBe('stretch');   // … and its width
        expect(half.justifyContent).toBe('center');
        expect(edge(half)).toBe(12);
      }
      expect(edge(A)).toBe(edge(B));
      unmount();
    }
  });

  it('labels stay on one line, centred', () => {
    const { getByText } = render(
      <ButtonRow>
        <SecondaryButton strong icon="undo-variant" label="Counter back" onPress={() => {}} />
        <DangerButton outline label="Decline" onPress={() => {}} />
      </ButtonRow>,
    );
    for (const label of ['Counter back', 'Decline']) {
      expect(getByText(label).props.numberOfLines).toBe(1);
      expect(flat(getByText(label)).textAlign).toBe('center');
    }
  });

  it('one child (the other not allowed): a single full-width button, still without its top gap', () => {
    const canCounter = false;
    const { toJSON, getByTestId, queryByTestId } = render(
      <ButtonRow>
        {canCounter ? <SecondaryButton label="Counter" onPress={() => {}} testID="counter" /> : null}
        <DangerButton outline label="Decline" onPress={() => {}} testID="decline" />
      </ButtonRow>,
    );
    const row = toJSON();
    expect(row.children).toHaveLength(1);
    expect(flat(row.children[0])).toEqual({ flex: 1 });
    expect(queryByTestId('counter')).toBeNull(); // gone, not greyed
    expect(box(getByTestId('decline')).marginTop).toBe(0);
    expect(box(getByTestId('decline')).minHeight).toBe(44);
  });

  it('a lone outline button is full width with no top gap either', () => {
    const { toJSON, getByTestId } = render(<ButtonRow><SecondaryButton label="Download" onPress={() => {}} testID="download" /></ButtonRow>);
    expect(toJSON().children).toHaveLength(1);
    expect(box(getByTestId('download')).marginTop).toBe(0);
  });

  it('no children — or only null / false — draws nothing at all, so no empty gap is left', () => {
    expect(render(<ButtonRow />).toJSON()).toBeNull();
    expect(render(<ButtonRow>{null}{false}{undefined}</ButtonRow>).toJSON()).toBeNull();
    expect(render(<ButtonRow style={{ marginTop: 8 }} testID="row">{false}</ButtonRow>).queryByTestId('row')).toBeNull();
  });

  it('a fragment of buttons is opened up, not counted as one child', () => {
    const { toJSON } = render(
      <ButtonRow>
        <>
          <SecondaryButton label="Keep it" onPress={() => {}} />
          <DangerButton label="Withdraw" onPress={() => {}} />
        </>
      </ButtonRow>,
    );
    expect(toJSON().children).toHaveLength(2);
  });

  it('a button BESIDE a fragment: two halves, each with its own key — in either order', () => {
    // React numbers a fragment's children from zero again, so the button and the fragment's first
    // child both arrive as "child 0". The row must not hand two halves the same key.
    const keep = <SecondaryButton strong label="Keep it" onPress={() => {}} testID="keep" />;
    const withdraw = <><DangerButton outline label="Withdraw" onPress={() => {}} testID="withdraw" /></>;
    for (const [first, second, ids] of [[keep, withdraw, ['keep', 'withdraw']], [withdraw, keep, ['withdraw', 'keep']]]) {
      const { toJSON, getByTestId, unmount } = render(<ButtonRow>{first}{second}</ButtonRow>);
      const row = toJSON();
      expect(row.children).toHaveLength(2);
      expect(row.children.map(half => half.children[0].props.testID)).toEqual(ids);
      expect(flat(row.children[0]).marginLeft).toBeUndefined();
      expect(flat(row.children[1]).marginLeft).toBe(8);
      for (const id of ids) expect(box(getByTestId(id))).toMatchObject({ marginTop: 0, minHeight: 44, flexGrow: 1 });
      unmount();
    }
    expect(heard()).toEqual([]);
  });

  it('fragments inside fragments, and a caller\'s own keys, still give every half its own key', () => {
    const { toJSON } = render(
      <ButtonRow>
        <>
          <>
            <SecondaryButton label="One" onPress={() => {}} testID="one" />
          </>
          {null}
        </>
        {[<DangerButton key="two" outline label="Two" onPress={() => {}} testID="two" />]}
      </ButtonRow>,
    );
    expect(toJSON().children.map(half => half.children[0].props.testID)).toEqual(['one', 'two']);
    expect(heard()).toEqual([]);
  });

  it('a half that goes away on a later draw takes only itself: the other half is not lost or doubled', () => {
    // What a clash of keys really costs: on the next update React can drop or repeat a half.
    const pair = (canCounter) => (
      <ButtonRow>
        <SecondaryButton strong label="Counter" onPress={() => {}} testID="counter" />
        <>
          {canCounter ? <PrimaryButton label="Accept" onPress={() => {}} testID="accept" /> : null}
          <DangerButton outline label="Decline" onPress={() => {}} testID="decline" />
        </>
      </ButtonRow>
    );
    const ids = (tree) => tree.children.map(half => half.children[0].props.testID);
    const { toJSON, rerender } = render(pair(true));
    expect(ids(toJSON())).toEqual(['counter', 'accept', 'decline']);
    rerender(pair(false));
    expect(ids(toJSON())).toEqual(['counter', 'decline']);
    rerender(pair(true));
    expect(ids(toJSON())).toEqual(['counter', 'accept', 'decline']);
    expect(heard()).toEqual([]);
  });

  it('the silence check is not one that cannot fire: keyed the old way, the same row is reported by React', () => {
    // The row as it was first written — each half keyed by its child's own key, which React
    // restarts inside every fragment. Kept here as the control for the three tests above.
    const open = (children) => React.Children.toArray(children).reduce((out, child) => (
      React.isValidElement(child) && child.type === React.Fragment ? out.concat(open(child.props.children)) : out.concat([child])
    ), []);
    const OldRow = ({ children }) => (
      <View>{open(children).map((child, i) => <View key={child.key != null ? child.key : i}>{child}</View>)}</View>
    );
    render(
      <OldRow>
        <SecondaryButton label="Keep it" onPress={() => {}} />
        <><DangerButton label="Withdraw" onPress={() => {}} /></>
      </OldRow>,
    );
    const said = heard();
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/two children with the same key/i);
  });

  it('passes testIDs and presses straight through, and takes a style of its own', () => {
    const not = jest.fn();
    const send = jest.fn();
    const { getByTestId } = render(
      <ButtonRow style={{ marginTop: 4 }} testID="row">
        <SecondaryButton label="Not yet" onPress={not} testID="send-not-yet" />
        <PrimaryButton label="Send" onPress={send} testID="send-confirm" />
      </ButtonRow>,
    );
    fireEvent.press(getByTestId('send-not-yet'));
    fireEvent.press(getByTestId('send-confirm'));
    expect(not).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(flat(getByTestId('row')).marginTop).toBe(4);
  });

  it('a disabled half is still level with its neighbour', () => {
    const { getByTestId } = render(
      <ButtonRow>
        <SecondaryButton label="Not yet" disabled onPress={() => {}} testID="a" />
        <PrimaryButton label="Send" busy busyLabel="Sending" onPress={() => {}} testID="b" />
      </ButtonRow>,
    );
    expect(edge(box(getByTestId('a')))).toBe(edge(box(getByTestId('b'))));
    expect(box(getByTestId('a')).marginTop).toBe(0);
  });

  it('a button that leaves the row goes back to its own shape', () => {
    // The row's reach ends at the row: a sibling outside it is the plain button.
    const { getByTestId } = render(
      <>
        <ButtonRow><SecondaryButton label="In" onPress={() => {}} testID="in" /></ButtonRow>
        <SecondaryButton label="Out" onPress={() => {}} testID="out" />
      </>,
    );
    expect(box(getByTestId('in')).marginTop).toBe(0);
    expect(box(getByTestId('out'))).toEqual(TODAY.secondary);
  });
});

describe('AnswerBar — one main button, then two choices', () => {
  const bar = (extra = {}) => (
    <AnswerBar
      testID="answer-actions"
      note="Nothing is final until you both sign the agreement."
      main={<PrimaryButton label="Accept" onPress={extra.accept || (() => {})} testID="accept" />}
    >
      {extra.canCounter === false ? null : <SecondaryButton strong icon="undo-variant" label="Counter" onPress={extra.counter || (() => {})} testID="counter" />}
      <DangerButton outline label="Decline" onPress={extra.decline || (() => {})} testID="decline" />
    </AnswerBar>
  );

  it('draws the grey line, the main button, then the pair — in that order, 8 apart', () => {
    const { toJSON, getByTestId } = render(bar());
    const tree = toJSON();
    expect(tree.props.testID).toBe('answer-actions');
    expect(flat(tree).gap).toBe(8);
    expect(tree.children).toHaveLength(3);
    const [note, main, row] = tree.children;
    expect(note.type).toBe('Text');
    expect(note.children).toEqual(['Nothing is final until you both sign the agreement.']);
    expect(flat(note)).toMatchObject({ textAlign: 'center', color: T.ink2 });
    expect(main.props.testID).toBe('accept');
    expect(flat(row).flexDirection).toBe('row');
    expect(row.children).toHaveLength(2);
    // The main button is full width: it is a plain child of the column, not a half.
    expect(box(getByTestId('accept')).flexGrow).toBeUndefined();
  });

  it('passes the callers\' own buttons and testIDs through', () => {
    const accept = jest.fn(); const counter = jest.fn(); const decline = jest.fn();
    const { getByTestId } = render(bar({ accept, counter, decline }));
    fireEvent.press(getByTestId('accept'));
    fireEvent.press(getByTestId('counter'));
    fireEvent.press(getByTestId('decline'));
    expect([accept, counter, decline].map(f => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('the two choices are level: no top gap, same padding-plus-outline, at least 44', () => {
    const { getByTestId } = render(bar());
    const counter = box(getByTestId('counter'));
    const decline = box(getByTestId('decline'));
    expect(counter.marginTop).toBe(0);
    expect(decline.marginTop).toBe(0);
    expect(edge(counter)).toBe(edge(decline));
    expect(counter.minHeight).toBe(44);
    expect(decline.minHeight).toBe(44);
  });

  it('Counter not allowed: it is ABSENT, not disabled, and Decline takes the full width', () => {
    const { toJSON, queryByTestId, getByTestId } = render(bar({ canCounter: false }));
    expect(queryByTestId('counter')).toBeNull();
    const row = toJSON().children[2];
    expect(row.children).toHaveLength(1);
    expect(getByTestId('decline').props.accessibilityState).toEqual({ disabled: false });
  });

  it('with no second-row child the row is left out altogether', () => {
    const { toJSON } = render(
      <AnswerBar main={<PrimaryButton label="Accept 11.5%" onPress={() => {}} testID="thread-accept" />}>
        {null}{false}
      </AnswerBar>,
    );
    const tree = toJSON();
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].props.testID).toBe('thread-accept');
  });

  it('with no main button and no choice it draws nothing', () => {
    expect(render(<AnswerBar note="Nothing is final until you both sign the agreement." />).toJSON()).toBeNull();
    expect(render(<AnswerBar main={null}>{null}</AnswerBar>).toJSON()).toBeNull();
  });

  it('a fragment that holds nothing is nothing: as the main button, as the choices, or both', () => {
    const none = false;
    const nothing = <>{none ? <PrimaryButton label="Accept" onPress={() => {}} /> : null}{false}</>;
    expect(render(<AnswerBar testID="bar" note="Nothing is final until you both sign." main={nothing}>{nothing}</AnswerBar>).toJSON()).toBeNull();
    // An empty main beside real choices: the pair alone, no gap where the main button would be.
    const { toJSON } = render(
      <AnswerBar main={nothing}>
        <SecondaryButton label="Keep 24 Oct" onPress={() => {}} testID="move-keep" />
      </AnswerBar>,
    );
    expect(toJSON().children).toHaveLength(1);
    expect(flat(toJSON().children[0]).flexDirection).toBe('row');
    // A real main over an empty fragment of choices: the main button alone, no empty row.
    const alone = render(<AnswerBar main={<PrimaryButton label="Accept" onPress={() => {}} testID="accept" />}>{nothing}</AnswerBar>).toJSON();
    expect(alone.children).toHaveLength(1);
    expect(alone.children[0].props.testID).toBe('accept');
  });

  it('choices handed over as a button beside a fragment are still two keyed halves', () => {
    // The shape a screen writes when two of its choices share one condition.
    const canAnswer = true;
    const { toJSON, getByTestId } = render(
      <AnswerBar main={<PrimaryButton label="Accept" onPress={() => {}} testID="accept" />}>
        <SecondaryButton strong icon="undo-variant" label="Counter" onPress={() => {}} testID="counter" />
        {canAnswer ? <><DangerButton outline label="Decline" onPress={() => {}} testID="decline" /></> : null}
      </AnswerBar>,
    );
    const row = toJSON().children[1];
    expect(row.children.map(half => half.children[0].props.testID)).toEqual(['counter', 'decline']);
    expect(edge(box(getByTestId('counter')))).toBe(edge(box(getByTestId('decline'))));
    expect(heard()).toEqual([]);
  });

  it('choices without a main button still draw as a level row', () => {
    const { toJSON } = render(
      <AnswerBar>
        <SecondaryButton label="Keep 24 Oct" onPress={() => {}} testID="move-keep" />
        <DangerButton outline label="Decline" onPress={() => {}} testID="move-decline" />
      </AnswerBar>,
    );
    expect(toJSON().children).toHaveLength(1);
    expect(toJSON().children[0].children).toHaveLength(2);
  });

  it('takes several grey lines, and an element keeps its own testID (the "not taking counters" line)', () => {
    const { getByTestId, getByText, toJSON } = render(
      <AnswerBar
        note={['Nothing is final until you both sign the agreement.', <AnswerNote key="off" text="Urban Threads aren't taking counters on this campaign." testID="counter-off" />, null]}
        main={<PrimaryButton label="Accept" onPress={() => {}} testID="accept" />}
      >
        <DangerButton outline label="Decline" onPress={() => {}} testID="decline" />
      </AnswerBar>,
    );
    expect(getByText('Nothing is final until you both sign the agreement.')).toBeTruthy();
    expect(getByTestId('counter-off').props.children).toBe("Urban Threads aren't taking counters on this campaign.");
    expect(toJSON().children).toHaveLength(4); // two lines, Accept, the row
  });

  it('a caller\'s own element can be the grey line', () => {
    const { getByTestId } = render(
      <AnswerBar note={<Text testID="own">Your move.</Text>} main={<PrimaryButton label="Accept" onPress={() => {}} />} />,
    );
    expect(getByTestId('own')).toBeTruthy();
  });

  it('a long main label is centred with side padding and wraps in full, never cut short — inside this bar only', () => {
    const long = 'Accept ₹12,000 · 1 reel, 2 stories, 1 YouTube video';
    const inBar = render(<AnswerBar main={<PrimaryButton label={long} onPress={() => {}} testID="thread-accept" />} />);
    // No cap on its lines: with a cap of two this label ended in "…" on a narrow phone, where
    // before this build it had always wrapped in full. They are the terms she is agreeing to.
    expect(inBar.getByText(long).props.numberOfLines).toBeUndefined();
    expect(inBar.getByText(long).props.ellipsizeMode).toBeUndefined();
    expect(flat(inBar.getByText(long)).textAlign).toBe('center');
    expect(flat(inBar.getByText(long)).flexShrink).toBe(1);
    expect(box(inBar.getByTestId('thread-accept')).paddingHorizontal).toBe(16);
    // … and the height is untouched: it grows only when the label really wraps.
    expect(box(inBar.getByTestId('thread-accept')).paddingVertical).toBe(14);

    const alone = render(<PrimaryButton label={long} onPress={() => {}} testID="thread-accept" />);
    expect(alone.getByText(long).props.numberOfLines).toBeUndefined();
    expect(flat(alone.getByText(long)).textAlign).toBeUndefined();
    expect(box(alone.getByTestId('thread-accept'))).toEqual(TODAY.primary);
  });

  it('the long label wraps beside an icon and while busy too', () => {
    const long = 'Agree · move her to the pool';
    const a = render(<AnswerBar main={<PrimaryButton icon="check" label={long} onPress={() => {}} />} />);
    expect(a.getByText(long).props.numberOfLines).toBeUndefined();
    expect(flat(a.getByText(long))).toMatchObject({ flexShrink: 1, textAlign: 'center' });
    const b = render(<AnswerBar main={<PrimaryButton busy busyLabel="Accepting" label={long} onPress={() => {}} />} />);
    expect(b.getByText('Accepting').props.numberOfLines).toBeUndefined();
    expect(flat(b.getByText('Accepting')).flexShrink).toBe(1);
  });

  it('only a half of a ButtonRow keeps its label to one line — the main button above it is not capped', () => {
    const long = 'Accept ₹12,000 · 1 reel, 2 stories, 1 YouTube video';
    const { getByText } = render(
      <AnswerBar main={<PrimaryButton label={long} onPress={() => {}} testID="thread-accept" />}>
        <SecondaryButton strong label="Counter" onPress={() => {}} testID="thread-counter" />
        <DangerButton outline label="Decline" onPress={() => {}} testID="thread-decline" />
      </AnswerBar>,
    );
    expect(getByText(long).props.numberOfLines).toBeUndefined();
    expect(getByText('Counter').props.numberOfLines).toBe(1);
    expect(getByText('Decline').props.numberOfLines).toBe(1);
  });

  it('an outline button used as the main one does not bring its top gap into the bar', () => {
    const { getByTestId } = render(<AnswerBar main={<SecondaryButton label="Open the agreement" onPress={() => {}} testID="m" />} />);
    expect(box(getByTestId('m')).marginTop).toBe(0);
  });

  it('takes a style of its own (a page that draws it inline can space it)', () => {
    const { getByTestId } = render(<AnswerBar testID="pitch-actions" style={{ marginTop: 12 }} main={<PrimaryButton label="Accept her terms" onPress={() => {}} />} />);
    expect(flat(getByTestId('pitch-actions'))).toMatchObject({ gap: 8, marginTop: 12 });
  });
});

describe('buttonsOf — what a bar really holds', () => {
  it('null / false are nothing, and so is a fragment of them, however deep', () => {
    expect(buttonsOf(undefined)).toEqual([]);
    expect(buttonsOf(null)).toEqual([]);
    expect(buttonsOf([null, false, undefined])).toEqual([]);
    expect(buttonsOf(<>{null}{false}</>)).toEqual([]);
    expect(buttonsOf(<><>{null}</><>{false}</></>)).toEqual([]);
  });

  it('opens fragments and keeps the order', () => {
    const got = buttonsOf([
      <SecondaryButton key="a" label="A" onPress={() => {}} testID="a" />,
      <React.Fragment key="f">
        {null}
        <DangerButton label="B" onPress={() => {}} testID="b" />
        <><PrimaryButton label="C" onPress={() => {}} testID="c" /></>
      </React.Fragment>,
    ]);
    expect(got.map(el => el.props.testID)).toEqual(['a', 'b', 'c']);
  });
});

describe('ButtonSlot — the default is "on its own"', () => {
  it('is null outside every bar, so nothing reads it by accident', () => {
    let seen = 'unset';
    const Probe = () => { seen = React.useContext(ButtonSlot); return null; };
    render(<Probe />);
    expect(seen).toBeNull();
  });
});
