/**
 * FormScroll — the scrolling body of every screen someone types on.
 * Contract: features/ui-walk-fixes · board C (rule 3: "the box being typed in, with its counter,
 * hint and error line, is always visible above the button strip") · research C03 FIX FINAL 4
 *
 *   <View style={base.screen}>
 *     <Header … />
 *     <FormArea>
 *       <FormScroll contentContainerStyle={base.body}>…the form…</FormScroll>
 *       {toast}                                  // from useToast({ inFlow: true })
 *     </FormArea>
 *     <BottomBar>…the main button…</BottomBar>   // or <SaveBar … />
 *   </View>
 *
 * WHY IT EXISTS. With the button strip in the layout (BottomBar) the form really does get shorter
 * when the keypad opens, and Android then scrolls the box being typed in into view by itself — but
 * only until the box's own bottom edge touches the bottom of the scroll area. The counter, the
 * hint and the red error line a field draws UNDER its box stay just out of sight. FormScroll
 * finishes the job: it scrolls a little further so that `revealBelow` points under the box
 * (default 64 — a counter, a one-line hint and an error line) are in view too. A field with a
 * two-line hint under it asks for more: <FormScroll revealBelow={80}>.
 *
 * WHAT IT IS. A plain React Native ScrollView: every ScrollView prop passes through, and the ref
 * you give it is the ScrollView's own (scrollTo, scrollToEnd … all work). It adds two defaults a
 * form needs — `style` flex 1 (your style is added after it) and keyboardShouldPersistTaps
 * "handled" (pass your own to change it) — and nothing else. keyboardDismissMode is whatever you
 * pass, as on any ScrollView.
 *
 * WHEN IT LOOKS. Three moments, each a no-op unless a text box inside THIS scroll is focused:
 *   · the scroll area gets SHORTER (the keypad opening; the strip growing a "Fix 1 thing above to
 *     save" line) — and only if the box was at least partly on show at the old height. That is
 *     Android's own rule for a resize, kept here on purpose;
 *   · a box inside it takes focus (focus bubbles up to the ScrollView, so moving from one box to
 *     the next with the keypad already open is seen without wiring anything to the boxes);
 *   · the keypad has shown — once at once and once ~300 ms later, in case the first look came
 *     before the phone had finished moving things — and only if the box is at least partly on
 *     show by then.
 *
 * IT FINISHES A SCROLL, IT NEVER STARTS ONE. A box keeps the cursor after the keypad is closed
 * with the phone's Back key, and while she drags the form or taps a chip. So "a box is focused"
 * does not mean "she is looking at it". If she has scrolled away from the box, nothing here brings
 * the form back to it: not the keypad closing (the area growing is never a reason to look), not
 * the strip changing height, not the keypad changing height. Only the box taking focus, or
 * `reveal()` called by the screen itself, may fetch a box from out of sight.
 * It follows (spec decision U20) that on a form longer than the screen the keypad closing leaves
 * the form where typing put it — the top comes back with one swipe; a form that fits the screen
 * is put back by Android itself. Frame C2's "back in place when the keypad closes" holds for the
 * second kind only. Building the return for long forms is recorded as a walk decision, not done.
 *
 * HOW IT DECIDES. It asks the phone where the box, the form's content and the scroll area are on
 * screen. If the box's bottom edge plus `revealBelow` is above the scroll area's bottom edge it
 * does nothing. Otherwise it scrolls to the one position that puts that line exactly on the
 * bottom edge — never further than the box's own top (on a very short screen the box wins over
 * its hint), and never backwards. The position is worked out from the form's own layout, not from
 * where the scroll happens to be, so it is right even if Android's own animated scroll is still
 * running; the ScrollView's scrollTo stops that animation first.
 *
 * WHOSE BOX IT IS. A box on another screen, or in a pop-up drawn BESIDE the form (after the
 * strip), is refused by the phone: it is not inside this form, the first measurement fails and
 * nothing else is asked. A box in a pop-up drawn INSIDE the form's own JSX (the State / City
 * pickers of OfferedStateCityFields are) is NOT refused — on this app's renderer a Modal's
 * content counts as a child of wherever the Modal was written, and its focus bubbles up to the
 * form like any other. So there is a second test: the box must be on screen exactly where the
 * form's content says it is (content's place on screen + the box's place in the content, on both
 * axes, to within 2). A pop-up's box lives in the pop-up's window, the two disagree, and the form
 * behind the pop-up stays where it is.
 *
 * WHY NOT React Native's own scrollResponderScrollNativeHandleToKeyboard: its arithmetic assumes
 * the ScrollView fills the whole screen and that the keypad lies OVER it (the iPhone model). Here
 * the scroll area starts under a title row, ends above a button strip and has already been
 * resized by Android, so that method lands the box in the wrong place. The pieces used instead
 * are all public: TextInput.State.currentlyFocusedInput(), a host view's measureLayout /
 * measureInWindow, the ScrollView's getInnerViewRef() and scrollTo().
 *
 * IT CANNOT HURT. No focused box, a box that belongs to another screen or to a pop-up (see
 * above), a measurement that never answers (jest), one that throws or returns nonsense — all end
 * in "do nothing". Nothing here can throw into a render or into a native callback.
 *
 * Not for pop-ups: a `fit` Sheet keeps its own body and button in view by layout.
 */
import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import { ScrollView, View, TextInput, Keyboard, StyleSheet } from 'react-native';

/**
 * Points kept in view under the box being typed in. Measured on the app's own fields
 * (TextField4, the Business details / Profile info fields, NumberField): counter ≈ 19,
 * a one-line hint ≈ 21, the red error line ≈ 23 — 63 when all three show.
 */
export const REVEAL_BELOW = 64;
/** The second look after the keypad has shown. Android's own scroll animation takes 250 ms. */
export const SETTLE_MS = 300;
/** How far "where the box is" and "where the form says it is" may differ and still be one box. */
export const SAME_PLACE_SLACK = 2;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** The height a layout event carries — or null. */
const heightOf = (e) => {
  const h = e && e.nativeEvent && e.nativeEvent.layout ? e.nativeEvent.layout.height : null;
  return isNum(h) ? h : null;
};

/** The text box that has the cursor, as a host view — or null. Never throws. */
function focusedInput() {
  try {
    const State = TextInput && TextInput.State;
    if (!State || typeof State.currentlyFocusedInput !== 'function') return null;
    return State.currentlyFocusedInput() || null;
  } catch (e) {
    return null;
  }
}

/**
 * The arithmetic, on its own so it can be read and tested without a phone.
 *   place  { top, height }  the box inside the form's content (does not move when it scrolls)
 *   frame  { y, height }    the scroll area on screen
 *   box    { y, height }    the box on screen, right now
 * → the scroll position to go to, or null when nothing should move.
 */
export function revealTarget(place, frame, box, revealBelow = REVEAL_BELOW) {
  if (!place || !frame || !box) return null;
  if (![place.top, place.height, frame.y, frame.height, box.y, box.height].every(isNum)) return null;
  if (!(frame.height > 0) || !(box.height > 0)) return null;
  const extra = isNum(revealBelow) && revealBelow > 0 ? revealBelow : 0;
  // How far the line under the box sticks out below the scroll area. Half a point is rounding.
  const hidden = (box.y + box.height + extra) - (frame.y + frame.height);
  if (hidden <= 0.5) return null;
  // The line on the bottom edge — but the box's own top never leaves the top edge.
  const want = Math.max(0, Math.min(place.top + place.height + extra - frame.height, place.top));
  // Where the scroll is at this instant. Only ever move the form up, never back down.
  const now = place.top - (box.y - frame.y);
  if (want <= now + 0.5) return null;
  return want;
}

/**
 * Is the box really drawn in this form — and not in a pop-up that was merely WRITTEN inside it?
 *   place   { left, top }  the box inside the form's content, as the layout tree has it
 *   origin  { x, y }       the form's content on screen, right now
 *   box     { x, y }       the box on screen, right now
 * A box of the form is on screen exactly at origin + place, wherever the form is scrolled to. A
 * pop-up's box is laid out in the pop-up's own window, so the two answers disagree (by the place
 * on screen of the element the pop-up was written in). Anything that cannot be checked is "no".
 */
export function inThisForm(place, origin, box) {
  if (!place || !origin || !box) return false;
  if (![place.left, place.top, origin.x, origin.y, box.x, box.y].every(isNum)) return false;
  return Math.abs(box.x - (origin.x + place.left)) <= SAME_PLACE_SLACK
    && Math.abs(box.y - (origin.y + place.top)) <= SAME_PLACE_SLACK;
}

/**
 * Is any part of the box on show in the scroll area, taking the area as `height` tall?
 * (`height` is the area's height now, or what it was before it got shorter.) Android asks the
 * same question before it follows a box through a resize.
 */
export function onShow(frame, box, height) {
  if (!frame || !box) return false;
  if (![frame.y, box.y, box.height, height].every(isNum)) return false;
  return box.y < frame.y + height && box.y + box.height > frame.y;
}

/**
 * The helper behind FormScroll, for a screen that must keep its own ScrollView.
 *   const scrollRef = useRef(null);
 *   const form = useRevealFocusedInput(scrollRef);          // or (scrollRef, 72)
 *   <ScrollView ref={scrollRef} onLayout={form.onLayout} onFocus={form.onFocus} … />
 * `form.reveal()` runs the look by hand (e.g. after a tall error block appears under a box): like
 * a box taking focus, it may bring the focused box up from out of sight.
 * `form.onLayout` must be given the layout event itself (it reads the area's height from it).
 * Call it above every early return — it is a hook.
 */
export function useRevealFocusedInput(scrollRef, revealBelow = REVEAL_BELOW) {
  const extra = useRef(revealBelow);
  extra.current = revealBelow;
  const run = useRef(0);
  const alive = useRef(true);
  const timer = useRef(null);
  const lastHeight = useRef(null);   // the scroll area's height at its last layout — null until known

  /**
   * One look. `seenWithin` says how much of the look is allowed:
   *   undefined  the box took focus, or the screen asked — the box may be anywhere in the form;
   *   null       the box must be at least partly on show in the scroll area as it is now;
   *   a number   …in the scroll area as it was at that height (before it got shorter).
   */
  const look = useCallback((seenWithin) => {
    try {
      const input = focusedInput();
      if (!input) return;
      const scroll = scrollRef && scrollRef.current;
      if (!scroll || typeof scroll.scrollTo !== 'function') return;
      if (typeof input.measureLayout !== 'function' || typeof input.measureInWindow !== 'function') return;
      const inner = typeof scroll.getInnerViewRef === 'function' ? scroll.getInnerViewRef() : null;
      const outer = (typeof scroll.getNativeScrollRef === 'function' ? scroll.getNativeScrollRef() : null) || scroll;
      if (!inner || typeof inner.measureInWindow !== 'function') return;
      if (!outer || typeof outer.measureInWindow !== 'function') return;

      const mine = ++run.current;
      let place = null;
      let frame = null;
      let origin = null;
      let box = null;
      const decide = () => {
        try {
          if (!place || !frame || !origin || !box) return;
          if (!alive.current || mine !== run.current) return;
          // A pop-up written inside the form: its box is not where the form's content puts it.
          if (!inThisForm(place, origin, box)) return;
          // She has scrolled away from the box: only its taking focus may bring it back.
          if (seenWithin !== undefined && !onShow(frame, box, isNum(seenWithin) ? seenWithin : frame.height)) return;
          const y = revealTarget(place, frame, box, extra.current);
          if (y == null) return;
          const target = scrollRef.current;
          if (target && typeof target.scrollTo === 'function') target.scrollTo({ x: 0, y, animated: true });
        } catch (e) { /* a look that fails changes nothing */ }
      };
      // First: is the box inside THIS scroll, and where in its content? The phone refuses (the
      // fail callback) for another screen's box, or one in a pop-up drawn beside the form — and
      // then nothing else is asked. The three places on screen are asked for together, so they
      // are answered at the same instant even while a scroll is running.
      input.measureLayout(inner, (left, top, w, height) => {
        try {
          if (!alive.current || mine !== run.current) return;
          place = { left, top, height };
          outer.measureInWindow((fx, y, fw, h) => { frame = { y, height: h }; decide(); });
          inner.measureInWindow((x, y) => { origin = { x, y }; decide(); });
          input.measureInWindow((x, y, bw, h) => { box = { x, y, height: h }; decide(); });
        } catch (e) { /* a look that fails changes nothing */ }
      }, () => {});
    } catch (e) { /* never into a render or a native callback */ }
  }, [scrollRef]);

  const reveal = useCallback(() => { look(); }, [look]);

  useEffect(() => {
    alive.current = true;
    let sub = null;
    try {
      sub = Keyboard.addListener('keyboardDidShow', () => {
        look(null);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => { timer.current = null; look(null); }, SETTLE_MS);
      });
    } catch (e) { sub = null; }
    return () => {
      alive.current = false;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, [look]);

  // The scroll area changed size. Only its getting SHORTER can hide what was on show; its first
  // layout, its growing (the keypad closing) and an event with no height in it are not looked at.
  const onLayout = useCallback((e) => {
    const height = heightOf(e);
    const was = lastHeight.current;
    lastHeight.current = height;
    if (height == null || was == null) return;
    if (height > was - 0.5) return;
    look(was);
  }, [look]);
  const onFocus = useCallback(() => { look(); }, [look]);

  return { reveal, onLayout, onFocus };
}

export const FormScroll = forwardRef(function FormScroll(
  { revealBelow = REVEAL_BELOW, style, onLayout, onFocus, children, ...rest },
  ref,
) {
  const own = useRef(null);
  // One node, two holders: ours (to scroll it) and the caller's (object ref or function ref).
  const setRef = useCallback((node) => {
    own.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  const form = useRevealFocusedInput(own, revealBelow);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      {...rest}
      ref={setRef}
      style={[st.fill, style]}
      onLayout={(e) => { form.onLayout(e); if (onLayout) onLayout(e); }}
      onFocus={(e) => { form.onFocus(e); if (onFocus) onFocus(e); }}
    >
      {children}
    </ScrollView>
  );
});

/**
 * FormArea — the box between the title row and the button strip. It holds the FormScroll and the
 * screen's `{toast}`, so the toast floats just above the strip whatever the strip's height
 * (one button, a "Fix 1 thing above to save" line, a hint, the phone's bottom inset).
 */
export function FormArea({ children, style, testID }) {
  return <View style={[st.fill, style]} testID={testID}>{children}</View>;
}

export default FormScroll;

const st = StyleSheet.create({
  fill: { flex: 1 },
});
