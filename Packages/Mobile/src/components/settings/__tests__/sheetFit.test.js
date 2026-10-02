import React from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { render, fireEvent, within, act } from '@testing-library/react-native';
import { Sheet, ConfirmSheet, sh, sheetScrollFor, useSheetReveal, SHOW_PAD } from '../sheets';
import { PrimaryButton, SecondaryButton, DangerButton, ButtonRow, AnswerBar } from '../primitives';
import { BottomBar } from '../../shell/BottomBar';
import { settingsTokens as T } from '../../../theme/tokens';

/**
 * ui-walk-fixes — board C, frames C5 → C6 / C7 (point 3 of the founder's walk, check 10).
 *
 * A pop-up taller than the room above the keypad kept its full length, so its note box and its
 * Send button slid under the keypad. The shared Sheet gains an opt-in shape — `fit`, with an
 * optional pinned `footer` — and the eighteen files that use it the old way get the old sheet.
 *
 * jest has no keypad and no window, so what is pinned here is the STRUCTURE that makes the
 * layout work (a shrinkable sheet, a scrolling body, a footer outside the scroll). That the
 * Modal's window really ends at the keypad is read from React Native's own source
 * (ReactModalHostView: SOFT_INPUT_ADJUST_RESIZE + fitsSystemWindows) and proved on a phone.
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
/** A touchable's own box, minus the opacity TouchableOpacity animates. */
const box = (node) => { const { opacity, ...rest } = flat(node); return rest; };

// What the three buttons drew on 1 Oct 2026, before this contract.
const TODAY = {
  primary: { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, marginTop: 10 },
  danger: { backgroundColor: T.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
};

describe('Sheet — used the old way it is the old sheet', () => {
  it('a scrim and a box as tall as its content: no scroll body, no footer, the same two styles', () => {
    const { getByTestId, getByLabelText, queryByTestId, UNSAFE_queryByType } = render(
      <Sheet visible onClose={() => {}} testID="decline-sheet"><Text>Decline this invitation?</Text></Sheet>,
    );
    expect(flat(getByTestId('decline-sheet'))).toEqual({
      backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28,
    });
    expect(flat(getByLabelText('Close'))).toEqual({ flex: 1, backgroundColor: 'rgba(26,26,23,0.45)' });
    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
    expect(queryByTestId('decline-sheet-body')).toBeNull();
    expect(queryByTestId('decline-sheet-footer')).toBeNull();
    // The children are direct children of the box, exactly as before.
    expect(getByTestId('decline-sheet').children).toHaveLength(1);
  });

  it('`fit={false}` with no `footer` given is the old sheet too — and stays the old sheet draw after draw', () => {
    const old = (words) => <Sheet visible onClose={() => {}} testID="s" fit={false} footer={undefined}><Text>{words}</Text></Sheet>;
    const { getByTestId, UNSAFE_queryByType, rerender } = render(old('Body'));
    for (const words of ['Body', 'Body, again', 'Body, a third time']) {
      rerender(old(words));
      expect(flat(getByTestId('s')).flexShrink).toBeUndefined();
      expect(flat(getByTestId('s')).maxHeight).toBeUndefined();
      expect(UNSAFE_queryByType(ScrollView)).toBeNull();
    }
  });

  it('the exported styles the other files borrow are unchanged', () => {
    expect(StyleSheet.flatten(sh.sheet)).toEqual({ backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 });
    expect(StyleSheet.flatten(sh.scrim)).toEqual({ flex: 1, backgroundColor: 'rgba(26,26,23,0.45)' });
  });

  it('ConfirmSheet — built on it — still stacks its two buttons straight in the box', () => {
    const { getByTestId, UNSAFE_queryByType } = render(
      <ConfirmSheet visible title="Pause pitches?" body="Creators can't pitch you while paused." confirmLabel="Pause" cancelLabel="Not now" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
    expect(flat(getByTestId('confirm-sheet')).flexShrink).toBeUndefined();
    expect(getByTestId('confirm-primary')).toBeTruthy();
    expect(flat(getByTestId('confirm-secondary')).marginTop).toBe(10);
  });

  it('draws nothing while it is not visible, and the scrim closes it', () => {
    const onClose = jest.fn();
    const { queryByTestId, rerender, getByLabelText } = render(<Sheet visible={false} onClose={onClose} testID="s"><Text>Body</Text></Sheet>);
    expect(queryByTestId('s')).toBeNull();
    rerender(<Sheet visible onClose={onClose} testID="s"><Text>Body</Text></Sheet>);
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Sheet fit — a pop-up that holds a text box (C6, C7)', () => {
  const counterSheet = (props = {}) => (
    <Sheet
      visible onClose={props.onClose || (() => {})} testID="counter-sheet" fit
      footer={<PrimaryButton label="Send counter" onPress={props.onSend || (() => {})} testID="send-counter" />}
    >
      <Text>ROUND 1 OF 2</Text>
      <TextInput testID="say-why" placeholder="Say why (optional)" />
    </Sheet>
  );

  it('the sheet can shrink and can never be taller than the room it has', () => {
    const { getByTestId, getByLabelText } = render(counterSheet());
    const sheet = flat(getByTestId('counter-sheet'));
    expect(sheet.flexShrink).toBe(1);
    expect(sheet.maxHeight).toBe('100%');
    // … and it is still the same box: same corners, same padding.
    expect(sheet).toMatchObject({ backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 });
    // The scrim keeps a sliver, so the sheet stops just below the status bar and can be tapped shut.
    expect(flat(getByLabelText('Close'))).toMatchObject({ flex: 1, minHeight: 8 });
  });

  it('the body scrolls, and a tap on a button inside it does not just close the keypad', () => {
    const { getByTestId } = render(counterSheet());
    const body = getByTestId('counter-sheet-body');
    expect(body.type).toBe('RCTScrollView');
    expect(body.props.keyboardShouldPersistTaps).toBe('handled');
    expect(flat(body)).toMatchObject({ flexShrink: 1, flexGrow: 0 });
    expect(within(body).getByTestId('say-why')).toBeTruthy();
    expect(within(body).getByText('ROUND 1 OF 2')).toBeTruthy();
  });

  it('the footer is pinned: inside the sheet, under the body, OUTSIDE the scroll', () => {
    const onSend = jest.fn();
    const { getByTestId } = render(counterSheet({ onSend }));
    const sheet = getByTestId('counter-sheet');
    const body = getByTestId('counter-sheet-body');
    const footer = getByTestId('counter-sheet-footer');
    expect(within(sheet).getByTestId('counter-sheet-footer')).toBeTruthy();
    expect(within(body).queryByTestId('send-counter')).toBeNull();
    expect(within(footer).getByTestId('send-counter')).toBeTruthy();
    // It never shrinks (only the body gives way) and never floats over the body.
    expect(flat(footer).flexShrink).toBeUndefined();
    expect(flat(footer).position).toBeUndefined();
    fireEvent.press(getByTestId('send-counter'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('the order inside the sheet is body, then footer', () => {
    const { toJSON } = render(counterSheet());
    const found = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      const id = n.props && n.props.testID;
      if (id === 'counter-sheet-body' || id === 'counter-sheet-footer') found.push(id);
      if (n.children) n.children.forEach(walk);
    })(toJSON());
    expect(found).toEqual(['counter-sheet-body', 'counter-sheet-footer']);
  });

  it('the hairline above the footer shows only while the body really scrolls', () => {
    const { getByTestId } = render(counterSheet());
    const body = getByTestId('counter-sheet-body');
    const line = () => flat(getByTestId('counter-sheet-footer')).borderTopColor;
    // At rest everything fits: no line, so the sheet looks as its own board drew it.
    expect(line()).toBe('transparent');
    fireEvent(body, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 420 } } });
    fireEvent(body, 'contentSizeChange', 360, 420);
    expect(line()).toBe('transparent');
    expect(body.props.persistentScrollbar).toBe(false);
    // The keypad opens: the body is squeezed to 180 while its content is still 420.
    fireEvent(body, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 180 } } });
    expect(line()).toBe(T.border);
    expect(getByTestId('counter-sheet-body').props.persistentScrollbar).toBe(true);
    // … and closes again.
    fireEvent(body, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 420 } } });
    expect(line()).toBe('transparent');
    // The line takes room whether or not it is drawn, so nothing jumps when it appears.
    expect(flat(getByTestId('counter-sheet-footer')).borderTopWidth).toBe(1);
  });

  it('`fit` without a footer is a scrolling sheet with no footer strip', () => {
    const { getByTestId, queryByTestId } = render(<Sheet visible onClose={() => {}} testID="s" fit><Text>Long words</Text></Sheet>);
    expect(getByTestId('s-body').type).toBe('RCTScrollView');
    expect(queryByTestId('s-footer')).toBeNull();
  });

  it('a `footer` on its own switches the fit shape on', () => {
    const { getByTestId } = render(
      <Sheet visible onClose={() => {}} testID="s" footer={<PrimaryButton label="Send" onPress={() => {}} testID="send" />}><Text>Body</Text></Sheet>,
    );
    expect(flat(getByTestId('s')).flexShrink).toBe(1);
    expect(getByTestId('s-body').type).toBe('RCTScrollView');
    expect(within(getByTestId('s-footer')).getByTestId('send')).toBeTruthy();
  });

  it('without a testID the parts are still findable', () => {
    const { getByTestId } = render(<Sheet visible onClose={() => {}} fit footer={<Text>Send</Text>}><Text>Body</Text></Sheet>);
    expect(getByTestId('sheet-body')).toBeTruthy();
    expect(getByTestId('sheet-footer')).toBeTruthy();
  });

  it('closes from the scrim and draws nothing while hidden, like the old sheet', () => {
    const onClose = jest.fn();
    const { getByLabelText, rerender, queryByTestId } = render(counterSheet({ onClose }));
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Sheet visible={false} onClose={onClose} testID="counter-sheet" fit><Text>Body</Text></Sheet>);
    expect(queryByTestId('counter-sheet')).toBeNull();
  });
});

describe('Sheet — a footer that comes and goes does not rebuild the pop-up', () => {
  // The old sheet and the fit sheet are two different trees. If the shape followed whether a
  // footer happens to be there right now, a Send button that appears once something is typed would
  // tear the pop-up down and build it again: the box loses the cursor, the keypad drops, the slide
  // plays a second time. So the shape is settled by the `footer` prop being GIVEN — even as null —
  // and, once taken, is kept for as long as the sheet is mounted.
  function Note({ onMount }) {
    const [text, setText] = React.useState('');
    React.useEffect(() => { onMount(); }, []); // eslint-disable-line
    return <TextInput testID="say-why" value={text} onChangeText={setText} placeholder="Say why (optional)" />;
  }
  const send = <PrimaryButton label="Send counter" onPress={() => {}} testID="send-counter" />;

  it('`footer={null}` is already the fit shape, with no footer strip', () => {
    const { getByTestId, queryByTestId } = render(
      <Sheet visible onClose={() => {}} testID="s" footer={null}><Text>Body</Text></Sheet>,
    );
    expect(flat(getByTestId('s'))).toMatchObject({ flexShrink: 1, maxHeight: '100%' });
    expect(getByTestId('s-body').type).toBe('RCTScrollView');
    expect(queryByTestId('s-footer')).toBeNull();
  });

  it('footer null → button → false → button: the note box is built ONCE and keeps what was typed', () => {
    const mounted = jest.fn();
    const sheet = (footer) => (
      <Sheet visible onClose={() => {}} testID="counter-sheet" footer={footer}><Note onMount={mounted} /></Sheet>
    );
    const { getByTestId, queryByTestId, rerender } = render(sheet(null));
    fireEvent.changeText(getByTestId('say-why'), 'Can we do 14%?');
    expect(queryByTestId('send-counter')).toBeNull();

    rerender(sheet(send));
    expect(within(getByTestId('counter-sheet-footer')).getByTestId('send-counter')).toBeTruthy();
    expect(getByTestId('say-why').props.value).toBe('Can we do 14%?');

    rerender(sheet(false));
    expect(queryByTestId('counter-sheet-footer')).toBeNull();
    expect(getByTestId('counter-sheet-body').type).toBe('RCTScrollView');
    expect(getByTestId('say-why').props.value).toBe('Can we do 14%?');

    rerender(sheet(send));
    expect(getByTestId('say-why').props.value).toBe('Can we do 14%?');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('the usual way a screen writes it — `footer={ready && <Button />}` — never rebuilds it either', () => {
    const mounted = jest.fn();
    const sheet = (ready) => (
      <Sheet visible onClose={() => {}} testID="counter-sheet" footer={ready && send}><Note onMount={mounted} /></Sheet>
    );
    const { getByTestId, queryByTestId, rerender } = render(sheet(false));
    fireEvent.changeText(getByTestId('say-why'), 'Two reels instead');
    rerender(sheet(true));
    expect(getByTestId('send-counter')).toBeTruthy();
    rerender(sheet(false));
    expect(queryByTestId('send-counter')).toBeNull();
    expect(getByTestId('say-why').props.value).toBe('Two reels instead');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('once it has the fit shape it keeps it, even if `footer` and `fit` are later not given at all', () => {
    const mounted = jest.fn();
    const sheet = (props) => (
      <Sheet visible onClose={() => {}} testID="counter-sheet" {...props}><Note onMount={mounted} /></Sheet>
    );
    const { getByTestId, queryByTestId, rerender } = render(sheet({ footer: send }));
    fireEvent.changeText(getByTestId('say-why'), 'Friday works');
    rerender(sheet({}));                       // footer: undefined
    expect(flat(getByTestId('counter-sheet')).flexShrink).toBe(1);
    expect(queryByTestId('counter-sheet-footer')).toBeNull();
    rerender(sheet({ fit: true }));
    rerender(sheet({ fit: false }));
    expect(getByTestId('counter-sheet-body').type).toBe('RCTScrollView');
    expect(getByTestId('say-why').props.value).toBe('Friday works');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('a list sheet stays a list sheet when its footer goes (the body does not turn into a scroller)', () => {
    const mounted = jest.fn();
    const sheet = (props) => (
      <Sheet visible onClose={() => {}} testID="picker-sheet" {...props}><Note onMount={mounted} /></Sheet>
    );
    const { getByTestId, rerender } = render(sheet({ fit: 'list', footer: send }));
    expect(getByTestId('picker-sheet-body').type).toBe('View');
    rerender(sheet({ fit: 'list', footer: null }));
    rerender(sheet({ footer: null }));
    rerender(sheet({}));
    expect(getByTestId('picker-sheet-body').type).toBe('View');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('closing and reopening does not rebuild it either: hidden, it is still the same sheet', () => {
    const sheet = (visible, footer) => <Sheet visible={visible} onClose={() => {}} testID="s" footer={footer}><Text>Body</Text></Sheet>;
    const { getByTestId, queryByTestId, rerender } = render(sheet(true, send));
    rerender(sheet(false, null));
    expect(queryByTestId('s')).toBeNull();
    rerender(sheet(true, null));
    expect(flat(getByTestId('s')).flexShrink).toBe(1);
    expect(getByTestId('s-body').type).toBe('RCTScrollView');
  });

  it('the one change that still rebuilds it: an OLD sheet that is later handed `fit` — so choose the shape where the sheet is written', () => {
    // Pinned so the note in the API stays true. No caller does this today.
    const mounted = jest.fn();
    const sheet = (props) => (
      <Sheet visible onClose={() => {}} testID="s" {...props}><Note onMount={mounted} /></Sheet>
    );
    const { rerender } = render(sheet({}));
    rerender(sheet({ fit: true }));
    expect(mounted).toHaveBeenCalledTimes(2);
  });
});

describe('a pop-up opened from inside a bar is on its own again', () => {
  // ButtonRow, AnswerBar and BottomBar tell the buttons beneath them where they sit, and that
  // reaches everything beneath them — including a pop-up drawn by a component that lives in the
  // bar. Its buttons must come out as plain buttons, not as halves of the row behind it.
  function WithdrawAndItsSheet() {
    return (
      <>
        <DangerButton outline label="Withdraw" onPress={() => {}} testID="withdraw" />
        <ConfirmSheet
          visible danger title="Withdraw this agreement?" body="Tanvi goes back to Your move."
          confirmLabel="Withdraw agreement" cancelLabel="Keep it" onConfirm={() => {}} onCancel={() => {}}
        />
      </>
    );
  }
  function expectPlainConfirmButtons({ getByTestId, getByText }) {
    expect(box(getByTestId('confirm-primary'))).toEqual(TODAY.danger);
    expect(box(getByTestId('confirm-secondary'))).toEqual(TODAY.secondary);
    for (const label of ['Withdraw agreement', 'Keep it']) {
      expect(getByText(label).props.numberOfLines).toBeUndefined();
      expect(flat(getByText(label)).textAlign).toBeUndefined();
    }
  }

  it('under a ButtonRow: the sheet\'s buttons are not turned into halves', () => {
    const view = render(
      <ButtonRow>
        <SecondaryButton strong label="Keep it open" onPress={() => {}} testID="keep" />
        <WithdrawAndItsSheet />
      </ButtonRow>,
    );
    // The row did reach the button that is really in it …
    expect(box(view.getByTestId('withdraw'))).toMatchObject({ marginTop: 0, minHeight: 44, flexGrow: 1 });
    // … and stopped at the pop-up.
    expectPlainConfirmButtons(view);
  });

  it('under a BottomBar: the sheet\'s outline button keeps its own 10 top gap', () => {
    const view = render(
      <BottomBar>
        <PrimaryButton label="Send agreement" onPress={() => {}} testID="send" />
        <WithdrawAndItsSheet />
      </BottomBar>,
    );
    expectPlainConfirmButtons(view);
  });

  it('under an AnswerBar: neither the main button\'s wrap nor the pair\'s shape gets into the sheet', () => {
    function AcceptAndItsSheet() {
      return (
        <>
          <PrimaryButton label="Accept ₹12,000 · 1 reel, 2 stories" onPress={() => {}} testID="accept" />
          <Sheet visible onClose={() => {}} testID="accept-sheet">
            <PrimaryButton label="Yes, accept" onPress={() => {}} testID="accept-yes" />
            <SecondaryButton label="Not yet" onPress={() => {}} testID="accept-no" />
          </Sheet>
        </>
      );
    }
    const view = render(
      <AnswerBar main={<AcceptAndItsSheet />}>
        <SecondaryButton strong label="Counter" onPress={() => {}} testID="counter" />
        <WithdrawAndItsSheet />
      </AnswerBar>,
    );
    // The bar's own main button: centred with side padding (its label wraps in full, no cap).
    expect(flat(view.getByText('Accept ₹12,000 · 1 reel, 2 stories')).textAlign).toBe('center');
    expect(box(view.getByTestId('accept')).paddingHorizontal).toBe(16);
    expect(box(view.getByTestId('accept-yes'))).toEqual(TODAY.primary);
    expect(view.getByText('Yes, accept').props.numberOfLines).toBeUndefined();
    expect(box(view.getByTestId('accept-no'))).toEqual(TODAY.secondary);
    expectPlainConfirmButtons(view);
  });

  it('the fit sheet resets it as well — body and footer', () => {
    const { getByTestId } = render(
      <BottomBar>
        <PrimaryButton label="Counter" onPress={() => {}} testID="open" />
        <Sheet visible onClose={() => {}} testID="counter-sheet" fit footer={<SecondaryButton label="Close" onPress={() => {}} testID="in-footer" />}>
          <SecondaryButton label="Add a deliverable" onPress={() => {}} testID="in-body" />
        </Sheet>
      </BottomBar>,
    );
    expect(box(getByTestId('in-body'))).toEqual(TODAY.secondary);
    expect(box(getByTestId('in-footer'))).toEqual(TODAY.secondary);
  });

  it('a bar INSIDE the pop-up still works: the reset is a fresh start, not a switch-off', () => {
    const { getByTestId } = render(
      <ButtonRow>
        <Sheet visible onClose={() => {}} testID="send-sheet" footer={(
          <ButtonRow>
            <SecondaryButton strong label="Not yet" onPress={() => {}} testID="send-not-yet" />
            <PrimaryButton label="Send" onPress={() => {}} testID="send-confirm" />
          </ButtonRow>
        )}>
          <Text>Send this agreement to Tanvi?</Text>
        </Sheet>
      </ButtonRow>,
    );
    for (const id of ['send-not-yet', 'send-confirm']) {
      expect(box(getByTestId(id))).toMatchObject({ marginTop: 0, minHeight: 44, flexGrow: 1 });
    }
  });
});

describe('Sheet fit="list" — a pop-up whose content is a list', () => {
  const picker = () => (
    <Sheet
      visible onClose={() => {}} testID="picker-sheet" fit="list"
      footer={<PrimaryButton label="Apply · 2 cities" onPress={() => {}} testID="picker-apply" />}
    >
      <TextInput testID="search" placeholder="Search cities" />
      <FlatList
        testID="list"
        data={[{ code: 'hyd', label: 'Hyderabad' }, { code: 'blr', label: 'Bengaluru' }]}
        keyExtractor={i => i.code}
        style={{ maxHeight: 360 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <Text>{item.label}</Text>}
      />
    </Sheet>
  );

  it('the body is a plain box that shrinks — the FlatList is NOT wrapped in a ScrollView', () => {
    const { getByTestId, getByText } = render(picker());
    const body = getByTestId('picker-sheet-body');
    expect(body.type).toBe('View');
    expect(flat(body)).toMatchObject({ flexShrink: 1, minHeight: 0 });
    // Walk up from the list: the only scroller between it and the sheet is the list itself.
    let node = getByTestId('list').parent;
    const scrollers = [];
    while (node && !(node.props && node.props.testID === 'picker-sheet')) {
      if (node.type === 'RCTScrollView') scrollers.push(node);
      node = node.parent;
    }
    expect(scrollers).toEqual([]);
    expect(getByText('Hyderabad')).toBeTruthy();
    expect(within(body).getByTestId('search')).toBeTruthy();
  });

  it('the sheet shrinks and the footer stays pinned under the list, with no hairline', () => {
    const { getByTestId } = render(picker());
    expect(flat(getByTestId('picker-sheet'))).toMatchObject({ flexShrink: 1, maxHeight: '100%' });
    const footer = getByTestId('picker-sheet-footer');
    expect(within(footer).getByTestId('picker-apply')).toBeTruthy();
    expect(within(getByTestId('picker-sheet-body')).queryByTestId('picker-apply')).toBeNull();
    expect(flat(footer).borderTopColor).toBe('transparent');
  });

  it('the scrolling shape WOULD put a scroller above the list — the walk above is not a check that cannot fire', () => {
    // React Native's own "VirtualizedLists should never be nested" error does not fire under
    // jest (its ScrollView is a stub), so the structure is what is pinned, with this control.
    const { getByTestId } = render(
      <Sheet visible onClose={() => {}} testID="wrong" fit>
        <FlatList testID="list" data={[{ code: 'hyd', label: 'Hyderabad' }]} keyExtractor={i => i.code} renderItem={({ item }) => <Text>{item.label}</Text>} />
      </Sheet>,
    );
    let node = getByTestId('list').parent;
    const scrollers = [];
    while (node && !(node.props && node.props.testID === 'wrong')) {
      if (node.type === 'RCTScrollView') scrollers.push(node.props.testID);
      node = node.parent;
    }
    expect(scrollers).toEqual(['wrong-body']);
  });
});

/* ───────────────────────────────────────────────────────────────────────────────────────────────
 * Review round (board C, frame C6: "Say why (optional) and its counter are in view").
 *
 * Android brings the box being typed in up only until the box's own bottom edge touches the bottom
 * of the body. What a field draws UNDER its box — the "44 / 200" counter, the hint, the red line —
 * stayed just out of sight behind the pinned footer. The body now finishes that scroll with the
 * helper the screens' forms use. jest has no keypad and no layout, so the phone's answers are
 * supplied by hand, in the shape React Native gives them.
 *
 * The picture: a short phone with the keypad open. The body starts 300 down the pop-up's window
 * and is 194 tall (it was 420 before the keypad). The note box is 260 down the body's content and
 * 84 tall; Android has put its bottom edge on the body's bottom edge (at 494), so it is at 410.
 * ─────────────────────────────────────────────────────────────────────────────────────────────── */
describe('Sheet fit — what a field draws under the box being typed in stays in view (C6)', () => {
  const noteSheet = (props = {}) => (
    <Sheet visible onClose={() => {}} testID="counter-sheet" fit
      footer={<PrimaryButton label="Send counter" onPress={() => {}} testID="send-counter" />} {...props}>
      <Text>ROUND 1 OF 2</Text>
      <TextInput testID="say-why" placeholder="Say why (optional)" multiline />
      <Text>44 / 200</Text>
    </Sheet>
  );
  let focused;
  afterEach(() => { if (focused) { focused.mockRestore(); focused = null; } });

  const bodyOf = (view) => view.UNSAFE_getAllByType(ScrollView).find((s) => s.props.testID === 'counter-sheet-body').instance;
  /** Give the body a place on the pretend phone and say where the focused box is. */
  function onAPhone(view, { bodyHeight = 194, top = 260, boxHeight = 84, y } = {}) {
    const boxY = y != null ? y : 300 + bodyHeight - boxHeight;          // Android: bottom edges together
    const scroll = bodyOf(view);
    scroll.getInnerViewRef = () => ({ _nativeTag: 7, measureInWindow: (cb) => cb(0, boxY - top, 360, 900) });
    scroll.getNativeScrollRef = () => null;
    scroll.measureInWindow = (cb) => cb(0, 300, 360, bodyHeight);
    scroll.scrollTo = jest.fn();
    if (focused) focused.mockRestore();
    focused = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureLayout: (relativeTo, ok) => ok(18, top, 324, boxHeight),
      measureInWindow: (cb) => cb(18, boxY, 324, boxHeight),
    });
    return scroll;
  }
  const squeeze = (view, from, to) => {
    const body = view.getByTestId('counter-sheet-body');
    fireEvent(body, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: from } } });
    fireEvent(body, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: to } } });
  };

  it('the keypad opens and the body is squeezed: it scrolls 64 further than Android did, so the counter is above the footer', () => {
    const view = render(noteSheet());
    const scroll = onAPhone(view);
    squeeze(view, 420, 194);
    // The line 64 under the box on the body's bottom edge: 260 + 84 + 64 - 194.
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1);
    expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 214, animated: true });
    // … and the hairline above the footer still follows the same layout event.
    fireEvent(view.getByTestId('counter-sheet-body'), 'contentSizeChange', 360, 420);
    expect(flat(view.getByTestId('counter-sheet-footer')).borderTopColor).toBe(T.border);
  });

  it('a box taking focus in a body that is already short is finished the same way', () => {
    const view = render(noteSheet());
    const scroll = onAPhone(view);
    fireEvent(view.getByTestId('say-why'), 'focus');
    expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 214, animated: true });
  });

  it('on a very short body the box itself wins: its own top never leaves the top edge', () => {
    const view = render(noteSheet());
    const scroll = onAPhone(view, { bodyHeight: 120 });
    fireEvent(view.getByTestId('say-why'), 'focus');
    expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 260, animated: true });
  });

  it('when the box and 64 under it are already on show nothing moves — and the body growing again is never a reason to move', () => {
    const view = render(noteSheet());
    const scroll = onAPhone(view, { bodyHeight: 420, y: 400 });           // 400 + 84 + 64 is above 720
    fireEvent(view.getByTestId('say-why'), 'focus');
    squeeze(view, 194, 420);
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('`revealBelow` sets how much is kept in view, and 0 leaves the body to Android alone', () => {
    const more = render(noteSheet({ revealBelow: 24 }));
    const a = onAPhone(more);
    fireEvent(more.getByTestId('say-why'), 'focus');
    expect(a.scrollTo).toHaveBeenCalledWith({ x: 0, y: 174, animated: true });   // 260 + 84 + 24 - 194
    more.unmount();
    const none = render(noteSheet({ revealBelow: 0 }));
    const b = onAPhone(none);
    fireEvent(none.getByTestId('say-why'), 'focus');
    expect(b.scrollTo).not.toHaveBeenCalled();
  });

  it('a box that is not in this pop-up (the screen behind it): the phone refuses and nothing moves', () => {
    const view = render(noteSheet());
    const scroll = onAPhone(view);
    focused.mockRestore();
    focused = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureLayout: (relativeTo, ok, fail) => fail(),
      measureInWindow: (cb) => cb(18, 410, 324, 84),
    });
    squeeze(view, 420, 194);
    fireEvent(view.getByTestId('say-why'), 'focus');
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('a caller\'s `bodyRef` is still handed the very same ScrollView — object ref or function ref — and null when the pop-up goes', () => {
    const ref = React.createRef();
    const view = render(noteSheet({ bodyRef: ref }));
    expect(ref.current).toBe(bodyOf(view));
    // The sheet's own helper scrolls that same node.
    const scroll = onAPhone(view);
    expect(scroll).toBe(ref.current);
    fireEvent(view.getByTestId('say-why'), 'focus');
    expect(ref.current.scrollTo).toHaveBeenCalledTimes(1);
    view.rerender(noteSheet({ bodyRef: ref, visible: false }));
    expect(ref.current).toBeNull();
    view.unmount();

    const got = [];
    const fn = render(noteSheet({ bodyRef: (node) => got.push(node) }));
    expect(got[got.length - 1]).toBe(bodyOf(fn));
  });

  it('as it comes under jest — the stock mocks, nothing stubbed — typing in a pop-up moves nothing and says nothing', () => {
    const view = render(noteSheet());
    fireEvent(view.getByTestId('say-why'), 'focus');
    fireEvent.changeText(view.getByTestId('say-why'), 'We can do 11.5%');
    squeeze(view, 420, 194);
    expect(view.getByTestId('send-counter')).toBeTruthy();
  });

  it('the list shape has no scroller of its own, and the old sheet no body at all: neither is given a focus handler', () => {
    const list = render(
      <Sheet visible onClose={() => {}} testID="picker-sheet" fit="list" footer={null}><TextInput testID="search" /></Sheet>,
    );
    expect(list.getByTestId('picker-sheet-body').props.onFocus).toBeUndefined();
    const old = render(<Sheet visible onClose={() => {}} testID="old"><TextInput testID="note" /></Sheet>);
    expect(old.getByTestId('old').props.onFocus).toBeUndefined();
    expect(old.UNSAFE_queryByType(ScrollView)).toBeNull();
  });
});

/* ───────────────────────────────────────────────────────────────────────────────────────────────
 * Review round (board C rule 3 + the 17 September lesson: a refusal must appear where the person
 * is looking). A pinned button can refuse a box that has scrolled out of the short body; the red
 * line stays under its own box and the body is scrolled to it.
 * ─────────────────────────────────────────────────────────────────────────────────────────────── */
describe('sheetScrollFor — where the body goes so that a refused box is on show', () => {
  const frame = { y: 300, height: 134 };             // a 640-point phone with the keypad open
  // A block `top` down the content, with the body scrolled to `at`, is at 300 + top - at on screen.
  const yOf = (top, at) => 300 + top - at;

  it('a block below the fold comes up until its bottom edge (and 6 of air) is on the body\'s bottom edge', () => {
    expect(sheetScrollFor({ top: 137, height: 96 }, frame, yOf(137, 0))).toBe(105);   // 137 + 96 + 6 - 134
  });

  it('a block above the fold comes down until its top edge (less 6 of air) is on the body\'s top edge', () => {
    expect(sheetScrollFor({ top: 80, height: 110 }, frame, yOf(80, 260))).toBe(74);
    expect(sheetScrollFor({ top: 3, height: 60 }, frame, yOf(3, 90))).toBe(0);       // never past the start
  });

  it('a block already wholly on show is left where it is', () => {
    expect(sheetScrollFor({ top: 137, height: 96 }, frame, yOf(137, 110))).toBeNull();
    expect(sheetScrollFor({ top: 137, height: 96 }, frame, yOf(137, 105))).toBeNull();
    expect(sheetScrollFor({ top: 137, height: 96 }, frame, yOf(137, 131))).toBeNull();
  });

  it('a block taller than the body is shown from its bottom edge — the red line is the last thing in it', () => {
    expect(sheetScrollFor({ top: 34, height: 185 }, frame, yOf(34, 0))).toBe(91);     // 34 + 185 + 6 - 134
    expect(sheetScrollFor({ top: 34, height: 185 }, frame, yOf(34, 91))).toBeNull();
    expect(sheetScrollFor({ top: 34, height: 185 }, frame, yOf(34, 200))).toBe(91);   // from below as well
  });

  it('keypad closed and the whole pop-up on show: nothing to do', () => {
    expect(sheetScrollFor({ top: 137, height: 96 }, { y: 120, height: 420 }, 120 + 137)).toBeNull();
  });

  it('the air is 6 unless told otherwise', () => {
    expect(SHOW_PAD).toBe(6);
    expect(sheetScrollFor({ top: 137, height: 96 }, frame, yOf(137, 0), 0)).toBe(99);
  });

  it('refuses anything that is not a set of real numbers', () => {
    expect(sheetScrollFor(null, frame, 0)).toBeNull();
    expect(sheetScrollFor({ top: 1, height: 2 }, null, 0)).toBeNull();
    expect(sheetScrollFor({ top: NaN, height: 96 }, frame, 300)).toBeNull();
    expect(sheetScrollFor({ top: 137, height: 96 }, frame, undefined)).toBeNull();
    expect(sheetScrollFor({ top: 137, height: 0 }, frame, 300)).toBeNull();
    expect(sheetScrollFor({ top: 137, height: 96 }, { y: 300, height: 0 }, 300)).toBeNull();
  });
});

describe('useSheetReveal — a pop-up scrolls its own body to the box its pinned button refused', () => {
  function Rename({ probe }) {
    const reveal = useSheetReveal();
    const [err, setErr] = React.useState('');
    probe.current = reveal;
    return (
      <Sheet visible onClose={() => {}} testID="rename" fit bodyRef={reveal.bodyRef}
        footer={<PrimaryButton label="Save" onPress={() => { setErr('Give it a name.'); reveal.show('name'); }} testID="save" />}>
        <Text>Rename</Text>
        <View ref={reveal.mark('name')} collapsable={false} testID="name-field">
          <TextInput testID="name" />
          {err ? <Text testID="name-error">{err}</Text> : null}
        </View>
      </Sheet>
    );
  }
  /** The body 134 tall at 300; the block `top` down its content, `height` tall, at `y` on screen. */
  function onAPhone(view, { top, height, y, drawnWhenAsked }) {
    const scroll = view.UNSAFE_getAllByType(ScrollView).find((s) => s.props.testID === 'rename-body').instance;
    scroll.getInnerViewRef = () => ({ _nativeTag: 7 });
    scroll.getNativeScrollRef = () => null;
    scroll.measureInWindow = (cb) => cb(0, 300, 360, 134);
    scroll.scrollTo = jest.fn();
    const block = view.UNSAFE_getAllByType(View).find((v) => v.props.testID === 'name-field').instance;
    block.measureLayout = jest.fn((relativeTo, ok) => {
      if (drawnWhenAsked) drawnWhenAsked.push(!!view.queryByTestId('name-error'));
      ok(18, top, 324, height);
    });
    block.measureInWindow = (cb) => cb(18, y, 324, height);
    return { scroll, block };
  }

  it('the phone is asked AFTER the red line has been drawn, and the body is moved to the block', () => {
    const probe = { current: null };
    const view = render(<Rename probe={probe} />);
    const drawn = [];
    const { scroll, block } = onAPhone(view, { top: 137, height: 96, y: 437, drawnWhenAsked: drawn });
    fireEvent.press(view.getByTestId('save'));
    expect(drawn).toEqual([true]);
    expect(block.measureLayout.mock.calls[0][0]).toEqual({ _nativeTag: 7 });   // measured against the body's own content
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1);
    expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 105, animated: true });
  });

  it('every refusal is shown again — a second tap on Save scrolls again if she has swiped away', () => {
    const probe = { current: null };
    const view = render(<Rename probe={probe} />);
    const { scroll } = onAPhone(view, { top: 137, height: 96, y: 437 });
    fireEvent.press(view.getByTestId('save'));
    fireEvent.press(view.getByTestId('save'));
    expect(scroll.scrollTo).toHaveBeenCalledTimes(2);
  });

  it('a block already on show, an unknown name, and a draw with no refusal: nothing moves', () => {
    const probe = { current: null };
    const view = render(<Rename probe={probe} />);
    const { scroll, block } = onAPhone(view, { top: 40, height: 80, y: 340 });
    fireEvent.press(view.getByTestId('save'));
    expect(block.measureLayout).toHaveBeenCalledTimes(1);
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    block.measureLayout.mockClear();
    act(() => { probe.current.show('no-such-box'); });
    view.rerender(<Rename probe={probe} />);
    expect(block.measureLayout).not.toHaveBeenCalled();
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('the same three things come back draw after draw, so marking a box never rebuilds it', () => {
    const probe = { current: null };
    const view = render(<Rename probe={probe} />);
    const first = probe.current;
    const mark = first.mark('name');
    fireEvent.press(view.getByTestId('save'));
    expect(probe.current).toBe(first);
    expect(probe.current.mark('name')).toBe(mark);
  });

  it('as it comes under jest (the stock mocks never answer) and when a measurement fails: no scroll, no sound', () => {
    const probe = { current: null };
    const view = render(<Rename probe={probe} />);
    fireEvent.press(view.getByTestId('save'));
    expect(view.getByTestId('name-error')).toBeTruthy();
    const { scroll, block } = onAPhone(view, { top: 137, height: 96, y: 437 });
    block.measureLayout = () => { throw new Error('gone'); };
    fireEvent.press(view.getByTestId('save'));
    block.measureLayout = (relativeTo, ok, fail) => fail();
    fireEvent.press(view.getByTestId('save'));
    block.measureLayout = (relativeTo, ok) => ok(18, 137, 324, 96);
    block.measureInWindow = (cb) => cb();                                  // the phone answers with nothing
    fireEvent.press(view.getByTestId('save'));
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });
});
