import React from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import FormScrollDefault, {
  FormScroll, FormArea, useRevealFocusedInput, revealTarget, inThisForm, onShow,
  REVEAL_BELOW, SETTLE_MS, SAME_PLACE_SLACK,
} from '../FormScroll';

/**
 * ui-walk-fixes — board C, rule 3 (point 3 of the founder's walk): "the box being typed in, with
 * its counter, hint and error line, is always visible above the button strip".
 *
 * Android brings the box itself into view; FormScroll scrolls the little bit further that shows
 * what is drawn UNDER the box. jest has no keypad and no layout, so the phone's answers (where
 * the box is, where the form's content is, where the scroll area is) are supplied by hand, in the
 * shape React Native gives them: measureLayout(relativeTo, ok(x, y, w, h), fail) and
 * measureInWindow(cb(x, y, w, h)).
 *
 * The picture used throughout: the scroll area starts 60 down the screen (under the title row).
 * It is 620 tall with the keypad closed and 300 tall while the keypad is open, so its bottom edge
 * is then at 360. A box that is `top` down the form and at `y` on screen means the form's content
 * starts at `y - top` on screen — that is what "a box of this form" is.
 */
let errorSpy;
let warnSpy;
let keyboard;   // event name → the listener the hook registered
let removed;
let content;    // where the form's content is on screen: { x, y }

beforeEach(() => {
  jest.useFakeTimers();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  keyboard = {};
  removed = [];
  content = { x: 0, y: -184 };   // the form scrolled so that a box 500 down it is at 316 on screen
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, fn) => {
    keyboard[event] = fn;
    return { remove: () => removed.push(event) };
  });
});
afterEach(() => {
  const said = [...errorSpy.mock.calls, ...warnSpy.mock.calls].map(args => args.map(String).join(' ').split('\n')[0]);
  jest.restoreAllMocks();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

const flat = (node) => StyleSheet.flatten(node.props.style) || {};

/**
 * A text box of the form as the phone reports it: `top` inside the form, `y` on screen right now.
 * Making one also puts the form's content where that box needs it to be (y - top).
 */
function fakeInput({ top, height = 44, y }) {
  content = { x: 0, y: y - top };
  return {
    measureLayout: jest.fn((relativeTo, ok) => ok(18, top, 324, height)),
    measureInWindow: jest.fn((cb) => cb(18, y, 324, height)),
  };
}
const focusOn = (input) => jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(input);

/** Mounts a form and gives its ScrollView a real-looking frame: 60 down, `height` tall. */
function mount({ height = 300, props = {} } = {}) {
  const ref = React.createRef();
  const utils = render(
    <FormScroll ref={ref} testID="form" {...props}>
      <Text>Their number</Text>
      <TextInput testID="box" />
      <Text>She sees this once you send the plan.</Text>
    </FormScroll>,
  );
  const scroll = ref.current;
  const inner = { _nativeTag: 7, measureInWindow: jest.fn((cb) => cb(content.x, content.y, 360, 2000)) };
  scroll.getInnerViewRef = () => inner;
  scroll.getNativeScrollRef = () => null;
  scroll.measureInWindow = jest.fn((cb) => cb(0, 60, 360, height));
  scroll.scrollTo = jest.fn();
  return { ...utils, scroll, inner, ref };
}
/** One layout event of the scroll area. */
const layout = (utils, height) => fireEvent(utils.getByTestId('form'), 'layout', { nativeEvent: { layout: { x: 0, y: 60, width: 360, height } } });
/** The scroll area gets shorter — by default the keypad opening: 620 tall, then 300. */
const shrink = (utils, from = 620, to = 300) => { layout(utils, from); layout(utils, to); };

describe('FormScroll — what it is', () => {
  it('is a ScrollView that fills the room it is given and keeps taps alive while the keypad is open', () => {
    const { getByTestId, UNSAFE_getByType } = render(<FormScroll testID="form"><Text>x</Text></FormScroll>);
    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
    expect(flat(getByTestId('form'))).toEqual({ flex: 1 });
    expect(getByTestId('form').props.keyboardShouldPersistTaps).toBe('handled');
    // keyboardDismissMode is the caller's: FormScroll does not choose one.
    expect(getByTestId('form').props.keyboardDismissMode).toBeUndefined();
  });

  it('passes every ScrollView prop through, and the caller\'s style and tap rule win', () => {
    const onScroll = jest.fn();
    const { getByTestId } = render(
      <FormScroll testID="form" contentContainerStyle={{ padding: 18 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false} onScroll={onScroll} style={{ backgroundColor: '#FFFFFF' }}>
        <Text testID="child">x</Text>
      </FormScroll>,
    );
    const p = getByTestId('form').props;
    expect(p.contentContainerStyle).toEqual({ padding: 18 });
    expect(p.keyboardDismissMode).toBe('on-drag');
    expect(p.keyboardShouldPersistTaps).toBe('always');
    expect(p.showsVerticalScrollIndicator).toBe(false);
    expect(p.onScroll).toBe(onScroll);
    expect(flat(getByTestId('form'))).toEqual({ flex: 1, backgroundColor: '#FFFFFF' });
    expect(getByTestId('child')).toBeTruthy();
    // Its own prop is not leaked onto the native view.
    expect(p.revealBelow).toBeUndefined();
  });

  it('hands the caller the ScrollView itself — an object ref', () => {
    const ref = React.createRef();
    render(<FormScroll ref={ref}><Text>x</Text></FormScroll>);
    expect(typeof ref.current.scrollTo).toBe('function');
    expect(typeof ref.current.scrollToEnd).toBe('function');
    act(() => { ref.current.scrollTo({ y: 120, animated: true }); });
  });

  it('hands the caller the ScrollView itself — a function ref, and null when it goes away', () => {
    const seen = [];
    const { unmount } = render(<FormScroll ref={(node) => seen.push(node)}><Text>x</Text></FormScroll>);
    expect(typeof seen[0].scrollTo).toBe('function');
    unmount();
    expect(seen[seen.length - 1]).toBeNull();
  });

  it('is exported by name and as the default', () => {
    expect(FormScrollDefault).toBe(FormScroll);
    expect(REVEAL_BELOW).toBe(64);
    expect(SAME_PLACE_SLACK).toBe(2);
  });
});

describe('FormScroll — nothing is focused', () => {
  it('does nothing at all: no measuring, no scrolling, whatever happens around it', () => {
    const utils = mount();
    shrink(utils);
    fireEvent(utils.getByTestId('box'), 'focus');
    act(() => { keyboard.keyboardDidShow({ endCoordinates: { screenY: 420, height: 280 } }); });
    act(() => { jest.advanceTimersByTime(SETTLE_MS + 50); });
    expect(utils.scroll.measureInWindow).not.toHaveBeenCalled();
    expect(utils.inner.measureInWindow).not.toHaveBeenCalled();
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('works as it comes under jest — the stock mocks, no keypad, no layout — without a sound', () => {
    jest.restoreAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByTestId, unmount } = render(
      <FormScroll testID="form"><TextInput testID="box" /></FormScroll>,
    );
    fireEvent(getByTestId('form'), 'layout', { nativeEvent: { layout: { height: 620 } } });
    fireEvent(getByTestId('form'), 'layout', { nativeEvent: { layout: { height: 300 } } });
    fireEvent(getByTestId('box'), 'focus');
    fireEvent.changeText(getByTestId('box'), '98490 11223');
    expect(() => unmount()).not.toThrow();
  });
});

describe('FormScroll — the box is in view but the lines under it are not', () => {
  it('when the scroll area gets shorter (the keypad opening), scrolls 64 further than Android did', () => {
    const utils = mount();
    // Android has put the box's bottom edge on the bottom edge of the scroll area: 316 + 44 = 360.
    const input = fakeInput({ top: 500, y: 316 });
    focusOn(input);
    layout(utils, 620);
    // Its first layout is not a change of size: nothing is even asked of the phone.
    expect(input.measureLayout).not.toHaveBeenCalled();
    layout(utils, 300);
    expect(input.measureLayout).toHaveBeenCalledWith(utils.inner, expect.any(Function), expect.any(Function));
    // 500 + 44 + 64 - 300: the line 64 under the box lands exactly on the bottom edge.
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 308, animated: true });
  });

  it('when another box takes focus with the keypad already open (focus bubbles up from the box)', () => {
    const utils = mount();
    focusOn(fakeInput({ top: 500, y: 316 }));
    fireEvent(utils.getByTestId('box'), 'focus');
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 308, animated: true });
  });

  it('when the keypad has shown — and looks once more a moment later', () => {
    const utils = mount();
    focusOn(fakeInput({ top: 500, y: 316 }));
    act(() => { keyboard.keyboardDidShow({ endCoordinates: { screenY: 420, height: 280 } }); });
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(SETTLE_MS - 1); });
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(1); });
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(2);
    expect(utils.scroll.scrollTo).toHaveBeenLastCalledWith({ x: 0, y: 308, animated: true });
  });

  it('the second look is a no-op once the first has worked', () => {
    const utils = mount();
    const input = fakeInput({ top: 500, y: 316 });
    focusOn(input);
    act(() => { keyboard.keyboardDidShow(); });
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
    // The form has moved up 64: the box is now at 252 on screen, the content 64 higher too.
    input.measureInWindow.mockImplementation((cb) => cb(18, 252, 324, 44));
    content = { x: 0, y: -248 };
    act(() => { jest.advanceTimersByTime(SETTLE_MS); });
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('lands in the same place while Android\'s own scroll is still running (the box still below the edge)', () => {
    const utils = mount();
    // Below the new bottom edge (360) but it was on show before the area got shorter (edge 680).
    focusOn(fakeInput({ top: 500, y: 400 }));
    shrink(utils);
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 308, animated: true });
  });

  it('`revealBelow` sets how much under the box is kept in view', () => {
    const utils = mount({ props: { revealBelow: 20 } });
    focusOn(fakeInput({ top: 500, y: 316 }));
    shrink(utils);
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 264, animated: true });
  });

  it('`revealBelow={0}` leaves Android\'s own position alone', () => {
    const utils = mount({ props: { revealBelow: 0 } });
    focusOn(fakeInput({ top: 500, y: 316 }));
    shrink(utils);
    fireEvent(utils.getByTestId('box'), 'focus');
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('uses the native scroll view for the frame when the ScrollView offers one', () => {
    const utils = mount();
    const native = { measureInWindow: jest.fn((cb) => cb(0, 60, 360, 300)) };
    utils.scroll.getNativeScrollRef = () => native;
    focusOn(fakeInput({ top: 500, y: 316 }));
    shrink(utils);
    expect(native.measureInWindow).toHaveBeenCalledTimes(1);
    expect(utils.scroll.measureInWindow).not.toHaveBeenCalled();
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 308, animated: true });
  });
});

/**
 * A box keeps the cursor after the keypad is closed with the phone's Back key, and while she drags
 * the form or taps a chip (keyboardShouldPersistTaps="handled"). "A box is focused" therefore does
 * not mean "she is looking at it". FormScroll finishes a scroll Android started; it never fetches
 * a box she has scrolled away from just because the scroll area changed size.
 * The picture: she typed in a box 900 down the form, then dragged back to the top.
 */
describe('FormScroll — she has scrolled away from the box she last typed in', () => {
  it('the keypad closes (Back key — the box keeps the cursor): the area grows and the form stays put', () => {
    const utils = mount({ height: 631 });
    const input = fakeInput({ top: 900, y: 954 });     // well below the area, before and after
    focusOn(input);
    layout(utils, 300);
    layout(utils, 631);
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
    // The area growing is never a reason to look: the phone is not even asked.
    expect(input.measureLayout).not.toHaveBeenCalled();
    expect(utils.scroll.measureInWindow).not.toHaveBeenCalled();
  });

  it('the area grows with the box on show: still nothing — growing cannot hide anything', () => {
    const utils = mount({ height: 631 });
    const input = fakeInput({ top: 500, y: 316 });
    focusOn(input);
    layout(utils, 300);
    layout(utils, 631);
    expect(input.measureLayout).not.toHaveBeenCalled();
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  // Spec decision U20 (final review, finding C-1). Frame C2's caption says the top of the form is
  // "back in place when the keypad closes". That is true of a form that fits the screen — Android
  // puts it back, nothing here is needed. On a form LONGER than the screen (Plan the visit, Terms,
  // the creator's content page) nothing puts it back, and FormScroll does not either: one swipe
  // does. The whole walk, so the recorded departure is pinned as one piece — whoever builds the
  // return (only if it is asked for at the walk) rewrites this test and the record with it.
  it('U20 — a long form moved up by typing stays where typing put it when the keypad closes: FormScroll moves it once, up, and never back', () => {
    const utils = mount();
    const input = fakeInput({ top: 500, y: 316 });     // "Their number", brought up to the edge by Android
    focusOn(input);
    shrink(utils);                                      // the keypad opens: 620 → 300
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 308, animated: true });   // the hint under the box is on show
    const looks = input.measureLayout.mock.calls.length;

    layout(utils, 620);                                 // the keypad closes (Back key): the area is 620 again
    act(() => { jest.advanceTimersByTime(SETTLE_MS * 4); });
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);          // no second move — not to 0, not anywhere
    expect(input.measureLayout.mock.calls.length).toBe(looks);       // the phone was not even asked
    expect(Object.keys(keyboard)).toEqual(['keyboardDidShow']);      // and nothing waits for the keypad to go
  });

  it('the strip gains its "Fix 1 thing above to save" line (the area 25 shorter): the form stays put', () => {
    const utils = mount({ height: 275 });
    const input = fakeInput({ top: 900, y: 700 });     // below the old bottom edge (360)
    focusOn(input);
    layout(utils, 300);
    layout(utils, 275);
    // This time the phone IS asked (the area got shorter) — and the answer is "she cannot see it".
    expect(input.measureLayout).toHaveBeenCalledTimes(1);
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
    // The arithmetic alone would have jumped back down to the box.
    expect(revealTarget({ top: 900, height: 44 }, { y: 60, height: 275 }, { y: 700, height: 44 })).toBe(733);
  });

  it('…but with the box on show, the same 25 brings the lines under it above the taller strip', () => {
    const utils = mount({ height: 275 });
    focusOn(fakeInput({ top: 500, y: 300 }));          // on show: 300 is above the old edge (360)
    layout(utils, 300);
    layout(utils, 275);
    // 500 + 44 + 64 - 275
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 333, animated: true });
  });

  it('a box only partly on show at the old height is followed; one wholly below it is not', () => {
    const partly = mount({ height: 275 });
    focusOn(fakeInput({ top: 500, y: 350 }));          // its top 10 above the old edge
    layout(partly, 300);
    layout(partly, 275);
    expect(partly.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 333, animated: true });

    const below = mount({ height: 275 });
    focusOn(fakeInput({ top: 500, y: 360 }));          // its top exactly on the old edge: nothing shows
    layout(below, 300);
    layout(below, 275);
    expect(below.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('a box above the top edge is never pulled back down', () => {
    const utils = mount();
    focusOn(fakeInput({ top: 100, y: -200 }));
    shrink(utils);
    fireEvent(utils.getByTestId('box'), 'focus');
    act(() => { keyboard.keyboardDidShow(); jest.advanceTimersByTime(SETTLE_MS); });
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('the very first layout, the same height again and an event with no height in it are not changes of size', () => {
    const utils = mount();
    const input = fakeInput({ top: 500, y: 216 });     // on show in an area 200 tall (edge at 260)
    focusOn(input);
    layout(utils, 300);                                 // first
    layout(utils, 300);                                 // same again
    fireEvent(utils.getByTestId('form'), 'layout', { nativeEvent: {} });
    fireEvent(utils.getByTestId('form'), 'layout');
    layout(utils, 200);                                 // the height before it is unknown: a first again
    expect(input.measureLayout).not.toHaveBeenCalled();
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
    utils.scroll.measureInWindow = jest.fn((cb) => cb(0, 60, 360, 150));
    layout(utils, 150);                                 // now it is known, and shorter
    // 500 + 44 + 64 - 150
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 458, animated: true });
  });

  it('the keypad shows (or changes height) while the box is out of sight: the form stays put', () => {
    const utils = mount();
    const input = fakeInput({ top: 900, y: 700 });
    focusOn(input);
    act(() => { keyboard.keyboardDidShow(); jest.advanceTimersByTime(SETTLE_MS); });
    expect(input.measureLayout).toHaveBeenCalledTimes(2);
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('the keypad shows before Android has brought the box up: the first look waits, the later one finishes the job', () => {
    const utils = mount();
    const input = fakeInput({ top: 500, y: 400 });     // still below the edge (360): Android is on its way
    focusOn(input);
    act(() => { keyboard.keyboardDidShow(); });
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
    // Android's own scroll has finished: the box's bottom edge is on the area's bottom edge.
    input.measureInWindow.mockImplementation((cb) => cb(18, 316, 324, 44));
    content = { x: 0, y: -184 };
    act(() => { jest.advanceTimersByTime(SETTLE_MS); });
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 308, animated: true });
  });

  it('a box that TAKES focus may be brought up from out of sight (the keypad\'s Next key)', () => {
    const utils = mount();
    focusOn(fakeInput({ top: 900, y: 700 }));
    fireEvent(utils.getByTestId('box'), 'focus');
    // 900 + 44 + 64 - 300
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 708, animated: true });
  });
});

/**
 * React Native draws a Modal in its own window, but in the layout tree its content stays a child
 * of wherever the <Modal> was written. So for a pop-up written INSIDE the form (the State / City
 * pickers of OfferedStateCityFields) the phone does NOT refuse the first measurement, and the
 * pop-up's search box sends its focus up to the form like any other box. The form behind the
 * pop-up must not move.
 * The picture: the element the pop-up is written in sits 18 in and 300 down the form; the pop-up's
 * search box is at (18, 470) in the pop-up's window. The phone therefore answers "36 in, 770 down
 * the form" for a box that is really at (18, 470) on screen.
 */
describe('FormScroll — a pop-up written inside the form', () => {
  const popupBox = (over = {}) => ({
    measureLayout: jest.fn((relativeTo, ok) => ok(over.left != null ? over.left : 36, 770, 324, 44)),
    measureInWindow: jest.fn((cb) => cb(18, 470, 324, 44)),
  });

  it('its box measures "inside the form", but is not where the form puts it: nothing moves', () => {
    const utils = mount();
    const box = popupBox();
    focusOn(box);
    content = { x: 0, y: 60 };                         // the form is not scrolled
    fireEvent(utils.getByTestId('box'), 'focus');      // (any box's focus reaches the form the same way)
    shrink(utils);
    act(() => { keyboard.keyboardDidShow(); jest.advanceTimersByTime(SETTLE_MS); });
    // Every look ran all the way to the phone's answers…
    expect(box.measureLayout).toHaveBeenCalledTimes(4);
    expect(box.measureInWindow).toHaveBeenCalledTimes(4);
    expect(utils.inner.measureInWindow).toHaveBeenCalledTimes(4);
    // …and none of them moved the form.
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
    // The arithmetic alone would have: this is the jump the check exists to stop.
    expect(revealTarget({ top: 770, height: 44 }, { y: 60, height: 300 }, { y: 470, height: 44 })).toBe(578);
  });

  it('is told apart by the sideways position alone when the up-down one happens to agree', () => {
    const utils = mount();
    focusOn(popupBox());
    content = { x: 0, y: -300 };                       // 470 = -300 + 770: up-down agrees by chance
    fireEvent(utils.getByTestId('box'), 'focus');
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('is told apart by the up-down position alone when the pop-up was written in an element with no inset', () => {
    const utils = mount();
    focusOn(popupBox({ left: 18 }));                    // sideways agrees: 18 = 0 + 18
    content = { x: 0, y: 60 };
    fireEvent(utils.getByTestId('box'), 'focus');
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('a real box of the form may be 2 off either way (rounding) — and no more', () => {
    for (const [dx, dy, moves] of [[0, 2, true], [0, -2, true], [2, 0, true], [-2, 0, true], [0, 3, false], [0, -3, false], [3, 0, false], [-3, 0, false]]) {
      const utils = mount();
      focusOn(fakeInput({ top: 500, y: 316 }));
      content = { x: dx, y: -184 + dy };
      fireEvent(utils.getByTestId('box'), 'focus');
      expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(moves ? 1 : 0);
      utils.unmount();
    }
  });

  it('when the form\'s content cannot say where it is, nothing moves', () => {
    const cases = [
      (u) => { u.inner.measureInWindow = undefined; },
      (u) => { u.inner.measureInWindow = jest.fn(); },                                     // never answers
      (u) => { u.inner.measureInWindow = jest.fn((cb) => cb()); },                         // answers with nothing
      (u) => { u.inner.measureInWindow = jest.fn((cb) => cb(NaN, undefined, 360, 2000)); },
      (u) => { u.inner.measureInWindow = jest.fn(() => { throw new Error('view is gone'); }); },
    ];
    for (const spoil of cases) {
      const utils = mount();
      spoil(utils);
      focusOn(fakeInput({ top: 500, y: 316 }));
      expect(() => {
        shrink(utils);
        fireEvent(utils.getByTestId('box'), 'focus');
        act(() => { keyboard.keyboardDidShow(); jest.advanceTimersByTime(SETTLE_MS); });
      }).not.toThrow();
      expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
      utils.unmount();
    }
  });
});

describe('FormScroll — when it must NOT move the form', () => {
  it('the box and 64 under it are already above the bottom edge', () => {
    const utils = mount();
    focusOn(fakeInput({ top: 200, y: 150 }));
    shrink(utils);
    fireEvent(utils.getByTestId('box'), 'focus');
    act(() => { keyboard.keyboardDidShow(); jest.advanceTimersByTime(SETTLE_MS); });
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('the box belongs to another screen: the phone refuses the measurement and nothing moves', () => {
    const utils = mount();
    const foreign = {
      measureLayout: jest.fn((relativeTo, ok, fail) => fail('Tag 7 is not an ancestor of tag 41')),
      measureInWindow: jest.fn((cb) => cb(18, 316, 324, 44)),
    };
    focusOn(foreign);
    shrink(utils);
    act(() => { keyboard.keyboardDidShow(); jest.advanceTimersByTime(SETTLE_MS); });
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
    // …and once refused, nothing further is asked of the phone (a screen lower in the stack
    // stays mounted and hears every keypad event).
    expect(foreign.measureLayout).toHaveBeenCalledTimes(3);
    expect(foreign.measureInWindow).not.toHaveBeenCalled();
    expect(utils.scroll.measureInWindow).not.toHaveBeenCalled();
    expect(utils.inner.measureInWindow).not.toHaveBeenCalled();
  });

  it('a very short screen: the box\'s own top never leaves the top edge', () => {
    // 90 of room, an 84-tall note box whose bottom Android has put on the edge: it sits 6 below the top.
    const utils = mount({ height: 90 });
    focusOn(fakeInput({ top: 500, height: 84, y: 66 }));
    shrink(utils, 620, 90);
    // Not 500 + 84 + 64 - 90 = 558 (that would push the top of the box out of sight): 500.
    expect(utils.scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 500, animated: true });
  });

  it('never scrolls backwards: a box taller than the room stays where Android put it', () => {
    const utils = mount({ height: 60 });
    focusOn(fakeInput({ top: 500, height: 84, y: 36 }));
    shrink(utils, 620, 60);
    fireEvent(utils.getByTestId('box'), 'focus');
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });
});

describe('FormScroll — a measurement that goes wrong changes nothing and never throws', () => {
  const quiet = (input, prepare) => {
    const utils = mount();
    if (prepare) prepare(utils);
    focusOn(input);
    expect(() => {
      shrink(utils);
      fireEvent(utils.getByTestId('box'), 'focus');
      act(() => { keyboard.keyboardDidShow(); jest.advanceTimersByTime(SETTLE_MS); });
    }).not.toThrow();
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  };

  it('the box\'s measurement throws', () => {
    quiet({ measureLayout: () => { throw new Error('view is gone'); }, measureInWindow: () => { throw new Error('view is gone'); } });
    quiet({ measureLayout: (r, ok) => ok(18, 500, 324, 44), measureInWindow: () => { throw new Error('view is gone'); } });
  });

  it('the measurements never answer (the stock jest mocks)', () => {
    quiet({ measureLayout: jest.fn(), measureInWindow: jest.fn() });
  });

  it('the phone answers with nonsense', () => {
    quiet({ measureLayout: (r, ok) => ok(undefined, NaN, undefined, undefined), measureInWindow: (cb) => cb(0, 316, 324, 44) });
    quiet({ measureLayout: (r, ok) => ok(18, 500, 324, 44), measureInWindow: (cb) => cb() });
    quiet(fakeInput({ top: 500, y: 316 }), (u) => { u.scroll.measureInWindow = (cb) => cb(0, 60, 360, 0); });
  });

  it('the focused thing is not a view that can be measured', () => {
    quiet({});
    quiet(41);
  });

  it('the ScrollView cannot say where its content is', () => {
    quiet(fakeInput({ top: 500, y: 316 }), (u) => { u.scroll.getInnerViewRef = () => null; });
    quiet(fakeInput({ top: 500, y: 316 }), (u) => { u.scroll.getInnerViewRef = () => { throw new Error('unmounted'); }; });
  });

  it('asking which box is focused throws', () => {
    const utils = mount();
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => { throw new Error('no native module'); });
    expect(() => { shrink(utils); fireEvent(utils.getByTestId('box'), 'focus'); }).not.toThrow();
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('scrollTo itself throws inside the phone\'s answer', () => {
    const utils = mount();
    utils.scroll.scrollTo = jest.fn(() => { throw new Error('native view is gone'); });
    focusOn(fakeInput({ top: 500, y: 316 }));
    expect(() => shrink(utils)).not.toThrow();
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('an answer that arrives after the screen has gone is dropped', () => {
    const utils = mount();
    let answer;
    const late = { measureLayout: (r, ok) => ok(18, 500, 324, 44), measureInWindow: (cb) => { answer = () => cb(18, 316, 324, 44); } };
    focusOn(late);
    shrink(utils);
    const { scroll } = utils;
    utils.unmount();
    expect(() => answer()).not.toThrow();
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it('of two looks, only the newer one may scroll', () => {
    const utils = mount();
    const answers = [];
    const slow = { measureLayout: (r, ok) => ok(18, 500, 324, 44), measureInWindow: (cb) => { answers.push(() => cb(18, 316, 324, 44)); } };
    focusOn(slow);
    shrink(utils);
    fireEvent(utils.getByTestId('box'), 'focus');
    expect(answers).toHaveLength(2);
    answers[0]();
    expect(utils.scroll.scrollTo).not.toHaveBeenCalled();
    answers[1]();
    expect(utils.scroll.scrollTo).toHaveBeenCalledTimes(1);
  });
});

describe('FormScroll — good manners', () => {
  it('still calls the caller\'s own onLayout and onFocus', () => {
    const onLayout = jest.fn();
    const onFocus = jest.fn();
    const utils = mount({ props: { onLayout, onFocus } });
    layout(utils, 300);
    fireEvent(utils.getByTestId('box'), 'focus', { nativeEvent: { target: 41 } });
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onLayout).toHaveBeenCalledWith({ nativeEvent: { layout: { x: 0, y: 60, width: 360, height: 300 } } });
    expect(onFocus).toHaveBeenCalledWith({ nativeEvent: { target: 41 } });
  });

  it('listens to the keypad once, and lets go of it — and of its timer — when the screen goes away', () => {
    const utils = mount();
    expect(Keyboard.addListener).toHaveBeenCalledTimes(1);
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
    utils.rerender(<FormScroll ref={utils.ref} testID="form"><TextInput testID="box" /></FormScroll>);
    expect(Keyboard.addListener).toHaveBeenCalledTimes(1);

    const input = fakeInput({ top: 500, y: 316 });
    focusOn(input);
    act(() => { keyboard.keyboardDidShow(); });
    const looks = input.measureLayout.mock.calls.length;
    utils.unmount();
    expect(removed).toEqual(['keyboardDidShow']);
    act(() => { jest.advanceTimersByTime(SETTLE_MS * 2); });
    expect(input.measureLayout.mock.calls.length).toBe(looks);
  });

  it('never listens for the keypad going away — its closing is not a reason to move the form', () => {
    mount();
    expect(Object.keys(keyboard)).toEqual(['keyboardDidShow']);
  });

  it('survives a Keyboard that cannot be listened to', () => {
    Keyboard.addListener.mockImplementation(() => { throw new Error('no native module'); });
    const { unmount } = render(<FormScroll><Text>x</Text></FormScroll>);
    expect(() => unmount()).not.toThrow();
    Keyboard.addListener.mockImplementation(() => undefined);
    const again = render(<FormScroll><Text>x</Text></FormScroll>);
    expect(() => again.unmount()).not.toThrow();
  });
});

describe('revealTarget — the arithmetic', () => {
  const frame = { y: 60, height: 300 };
  it('nothing to do when the line under the box is above the bottom edge', () => {
    expect(revealTarget({ top: 200, height: 44 }, frame, { y: 150, height: 44 })).toBeNull();
    // Exactly on the edge counts as visible: 252 + 44 + 64 = 360.
    expect(revealTarget({ top: 500, height: 44 }, frame, { y: 252, height: 44 })).toBeNull();
  });
  it('puts the line under the box on the bottom edge', () => {
    expect(revealTarget({ top: 500, height: 44 }, frame, { y: 316, height: 44 })).toBe(308);
    expect(revealTarget({ top: 500, height: 44 }, frame, { y: 316, height: 44 }, 72)).toBe(316);
  });
  it('a broken `revealBelow` is treated as none', () => {
    for (const bad of [NaN, -10, '64', null]) {
      expect(revealTarget({ top: 500, height: 44 }, frame, { y: 316, height: 44 }, bad)).toBeNull();
      // …but a box that is itself below the edge is still brought up.
      expect(revealTarget({ top: 500, height: 44 }, frame, { y: 330, height: 44 }, bad)).toBe(244);
    }
  });
  it('refuses anything that is not a set of real numbers', () => {
    expect(revealTarget(null, frame, { y: 316, height: 44 })).toBeNull();
    expect(revealTarget({ top: 500, height: 44 }, null, { y: 316, height: 44 })).toBeNull();
    expect(revealTarget({ top: 500, height: 44 }, frame, null)).toBeNull();
    expect(revealTarget({ top: '500', height: 44 }, frame, { y: 316, height: 44 })).toBeNull();
    expect(revealTarget({ top: 500, height: 44 }, { y: 60, height: Infinity }, { y: 316, height: 44 })).toBeNull();
    expect(revealTarget({ top: 500, height: 0 }, frame, { y: 316, height: 0 })).toBeNull();
  });
});

describe('inThisForm — is the box where the form\'s content puts it?', () => {
  it('yes when content + place is where the box is, wherever the form is scrolled to', () => {
    expect(inThisForm({ left: 18, top: 500 }, { x: 0, y: -184 }, { x: 18, y: 316 })).toBe(true);
    expect(inThisForm({ left: 18, top: 500 }, { x: 0, y: 60 }, { x: 18, y: 560 })).toBe(true);
    expect(inThisForm({ left: 18, top: 500 }, { x: 0, y: -182 }, { x: 18, y: 316 })).toBe(true);
  });
  it('no when either axis is more than 2 out', () => {
    expect(inThisForm({ left: 36, top: 770 }, { x: 0, y: 60 }, { x: 18, y: 470 })).toBe(false);
    expect(inThisForm({ left: 18, top: 500 }, { x: 0, y: -181 }, { x: 18, y: 316 })).toBe(false);
    expect(inThisForm({ left: 18, top: 500 }, { x: 3, y: -184 }, { x: 18, y: 316 })).toBe(false);
  });
  it('no when it cannot be checked', () => {
    expect(inThisForm(null, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
    expect(inThisForm({ left: 0, top: 0 }, null, { x: 0, y: 0 })).toBe(false);
    expect(inThisForm({ left: 0, top: 0 }, { x: 0, y: 0 }, null)).toBe(false);
    expect(inThisForm({ left: undefined, top: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
    expect(inThisForm({ left: 0, top: 0 }, { x: NaN, y: 0 }, { x: 0, y: 0 })).toBe(false);
    expect(inThisForm({ left: 0, top: 0 }, { x: 0, y: 0 }, { x: 0, y: '0' })).toBe(false);
  });
});

describe('onShow — is any part of the box on show in an area that tall?', () => {
  const frame = { y: 60 };
  it('yes for a box inside it or across either edge', () => {
    expect(onShow(frame, { y: 100, height: 44 }, 300)).toBe(true);
    expect(onShow(frame, { y: 350, height: 44 }, 300)).toBe(true);    // across the bottom edge (360)
    expect(onShow(frame, { y: 30, height: 44 }, 300)).toBe(true);     // across the top edge (60)
  });
  it('no for a box wholly below or wholly above — touching the edge is not showing', () => {
    expect(onShow(frame, { y: 360, height: 44 }, 300)).toBe(false);
    expect(onShow(frame, { y: 700, height: 44 }, 300)).toBe(false);
    expect(onShow(frame, { y: 16, height: 44 }, 300)).toBe(false);
    expect(onShow(frame, { y: -200, height: 44 }, 300)).toBe(false);
  });
  it('no when it cannot be checked', () => {
    expect(onShow(null, { y: 100, height: 44 }, 300)).toBe(false);
    expect(onShow(frame, null, 300)).toBe(false);
    expect(onShow(frame, { y: 100, height: 44 }, undefined)).toBe(false);
    expect(onShow({ y: NaN }, { y: 100, height: 44 }, 300)).toBe(false);
  });
});

describe('useRevealFocusedInput — for a screen that keeps its own ScrollView', () => {
  function Own({ extra, hold }) {
    const scrollRef = React.useRef(null);
    const form = useRevealFocusedInput(scrollRef, extra);
    hold.form = form;
    hold.ref = scrollRef;
    return (
      <ScrollView ref={scrollRef} testID="own" onLayout={form.onLayout} onFocus={form.onFocus}>
        <TextInput testID="box" />
      </ScrollView>
    );
  }
  const prime = (scroll) => {
    scroll.getInnerViewRef = () => ({ _nativeTag: 7, measureInWindow: (cb) => cb(content.x, content.y, 360, 2000) });
    scroll.getNativeScrollRef = () => null;
    scroll.measureInWindow = (cb) => cb(0, 60, 360, 300);
    scroll.scrollTo = jest.fn();
  };
  const own = (utils, height) => fireEvent(utils.getByTestId('own'), 'layout', { nativeEvent: { layout: { height } } });

  it('gives the two handlers and a reveal() to call by hand', () => {
    const hold = {};
    const utils = render(<Own hold={hold} />);
    prime(hold.ref.current);
    focusOn(fakeInput({ top: 500, y: 316 }));
    own(utils, 620);
    expect(hold.ref.current.scrollTo).not.toHaveBeenCalled();
    own(utils, 300);
    expect(hold.ref.current.scrollTo).toHaveBeenLastCalledWith({ x: 0, y: 308, animated: true });
    fireEvent(utils.getByTestId('box'), 'focus');
    expect(hold.ref.current.scrollTo).toHaveBeenCalledTimes(2);
    act(() => { hold.form.reveal(); });
    expect(hold.ref.current.scrollTo).toHaveBeenCalledTimes(3);
  });

  it('reveal() by hand may bring the focused box up from out of sight; the handlers alone do not', () => {
    const hold = {};
    const utils = render(<Own hold={hold} />);
    prime(hold.ref.current);
    focusOn(fakeInput({ top: 900, y: 700 }));
    own(utils, 300);
    own(utils, 631);                                    // the keypad closes
    own(utils, 606);                                    // the strip grows
    expect(hold.ref.current.scrollTo).not.toHaveBeenCalled();
    act(() => { hold.form.reveal(); });
    expect(hold.ref.current.scrollTo).toHaveBeenCalledWith({ x: 0, y: 708, animated: true });
    // Whatever reveal() is handed (a press event, say) is not taken for a rule.
    act(() => { hold.form.reveal({ nativeEvent: {} }); hold.form.reveal(null); hold.form.reveal(10); });
    expect(hold.ref.current.scrollTo).toHaveBeenCalledTimes(4);
  });

  it('takes its own extra, and follows it when it changes', () => {
    const hold = {};
    const { rerender } = render(<Own hold={hold} extra={72} />);
    prime(hold.ref.current);
    focusOn(fakeInput({ top: 500, y: 316 }));
    act(() => { hold.form.reveal(); });
    expect(hold.ref.current.scrollTo).toHaveBeenLastCalledWith({ x: 0, y: 316, animated: true });
    rerender(<Own hold={hold} extra={10} />);
    act(() => { hold.form.reveal(); });
    expect(hold.ref.current.scrollTo).toHaveBeenLastCalledWith({ x: 0, y: 254, animated: true });
  });

  it('a ref that holds nothing is fine', () => {
    function Bare({ hold }) {
      const scrollRef = React.useRef(null);
      hold.form = useRevealFocusedInput(scrollRef);
      return <View />;
    }
    const hold = {};
    render(<Bare hold={hold} />);
    focusOn(fakeInput({ top: 500, y: 316 }));
    expect(() => act(() => { hold.form.reveal(); })).not.toThrow();
    expect(() => act(() => { hold.form.onLayout(); hold.form.onLayout({ nativeEvent: { layout: { height: 300 } } }); hold.form.onFocus(); })).not.toThrow();
    expect(() => revealWithNoRefAtAll()).not.toThrow();
  });
});

// reveal() with no ref object at all — the guard a careless caller would hit.
function revealWithNoRefAtAll() {
  function None({ hold }) {
    hold.form = useRevealFocusedInput(undefined);
    return <View />;
  }
  const hold = {};
  render(<None hold={hold} />);
  act(() => { hold.form.reveal(); });
}

describe('FormArea — the box between the title row and the button strip', () => {
  it('fills the room, takes a testID and a style, and holds the form and the toast side by side', () => {
    const { getByTestId, toJSON } = render(
      <FormArea testID="area" style={{ backgroundColor: '#FFFFFF' }}>
        <FormScroll testID="form"><Text>x</Text></FormScroll>
        <Text testID="toast">Saved.</Text>
      </FormArea>,
    );
    expect(flat(getByTestId('area'))).toEqual({ flex: 1, backgroundColor: '#FFFFFF' });
    expect(toJSON().children.map(c => c.props.testID)).toEqual(['form', 'toast']);
  });
});
