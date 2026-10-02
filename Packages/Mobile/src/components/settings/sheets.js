/**
 * Item 2 — bottom sheets: the "Any or pick" list picker (B4), the confirm sheet
 * (B5 / C5 / X3 / X4) and the ⋯ action sheet. RN Modal only — nothing native.
 * Contract: features/item2-pitch-invitation-settings · prompt §5
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, ScrollView, StyleSheet, Pressable } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { PrimaryButton, SecondaryButton, DangerButton, InfoBox, ButtonSlot } from './primitives';
import { useRevealFocusedInput, REVEAL_BELOW } from '../shell/FormScroll';
import { COPY } from './copy';

/**
 * The bottom sheet every pop-up is built on.
 *
 * Given only `visible / onClose / children / testID` it is exactly the sheet it has always been:
 * a scrim and a box as tall as its content.
 *
 * ui-walk-fixes (board C, frames C6 / C7) adds an opt-in shape for sheets that hold a text box,
 * switched on by `fit` (or by passing a `footer` — see WHICH SHAPE below):
 *
 *   fit            the sheet can no longer be taller than the room it has. React Native shows a
 *                  Modal in its own window, and that window is laid out below the status bar and
 *                  — when the keypad opens — above the keypad (ReactModalHostView sets
 *                  SOFT_INPUT_ADJUST_RESIZE on the dialog and fits it to the system windows). So
 *                  "the room it has" is exactly status bar → keypad, and a sheet that used to
 *                  slide its lower part under the keypad now shrinks instead.
 *                  Its children go in a scrolling body (keyboardShouldPersistTaps="handled").
 *   fit="list"     the same, but the body is a plain box that shrinks rather than a ScrollView,
 *                  for a sheet whose content is a FlatList (a list must not sit in a ScrollView).
 *                  The FlatList shrinks by itself; anything above it keeps its height.
 *   footer         the sheet's button(s). Pinned under the body at the bottom of the sheet, so
 *                  they sit directly above the keypad while it is open and never scroll away.
 *                  A hairline appears above them only while the body is actually scrolling.
 *
 *   bodyRef        (fit, scrolling shape only) a ref that is handed the body's ScrollView — for a
 *                  sheet with something inside it that must be able to scroll the body, such as
 *                  the deliverables chooser's list opening in the brand's counter pop-up. Left
 *                  out, nothing changes. It is not used by the old sheet or by fit="list".
 *   revealBelow    (fit, scrolling shape only) points kept in view UNDER the box being typed in —
 *                  its counter, hint and red line (frame C6: "Say why (optional) and its counter
 *                  are in view"). Android brings a focused box up only until the box's own bottom
 *                  edge touches the bottom of the body, so what a field draws under its box stayed
 *                  just out of sight, behind the pinned footer. The body now finishes that scroll
 *                  with the same helper the screens' forms use (FormScroll's
 *                  useRevealFocusedInput). Default 64, as on a screen; 0 leaves the body to
 *                  Android alone. It only ever scrolls the body — the sheet's shape and layout do
 *                  not depend on it, and with no text box in the sheet it does nothing.
 *
 * The body and the footer carry `${testID}-body` / `${testID}-footer`.
 *
 * A pinned button can refuse something that is drawn in the body, out of sight (a red line under
 * a box she has scrolled past). For that see `useSheetReveal` below.
 *
 * WHICH SHAPE — settled so that a pop-up is never torn down and built again while it is open (the
 * two shapes are different trees; swapping them would drop the cursor, the keypad and the slide):
 *   · the fit shape is taken when `fit` is on, or when the `footer` prop is GIVEN AT ALL — even
 *     as `null` / `false`. So `footer={ready ? <Send /> : null}` is a fit sheet from the first
 *     draw, and its button can come and go freely. Only a `footer` that is left out (undefined)
 *     together with no `fit` is the old sheet.
 *   · once taken, the fit shape (scrolling or "list") is kept for as long as the sheet is mounted,
 *     whatever is passed later.
 * The one change that still rebuilds it is an old sheet that is later handed `fit` — choose the
 * shape where the sheet is written, not while it is open.
 *
 * A pop-up is its own place: whatever bar the component that opened it sits in (ButtonRow,
 * AnswerBar, BottomBar), the buttons inside the pop-up are plain buttons again.
 */
export function Sheet({ visible, onClose, children, testID, fit, footer, bodyRef, revealBelow }) {
  // null = the old sheet · 'scroll' · 'list'. Never goes back to null.
  const shape = useRef(null);
  if (fit) shape.current = fit === 'list' ? 'list' : 'scroll';
  else if (footer !== undefined && !shape.current) shape.current = 'scroll';
  const hasFooter = footer != null && footer !== false;
  return (
    <ButtonSlot.Provider value={null}>
      {shape.current ? (
        <FitSheet visible={visible} onClose={onClose} testID={testID} list={shape.current === 'list'} footer={hasFooter ? footer : null} bodyRef={bodyRef} revealBelow={revealBelow}>
          {children}
        </FitSheet>
      ) : (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
          <Pressable style={sh.scrim} onPress={onClose} accessibilityLabel="Close" />
          <View style={sh.sheet} testID={testID}>{children}</View>
        </Modal>
      )}
    </ButtonSlot.Provider>
  );
}

function FitSheet({ visible, onClose, children, testID, list, footer, bodyRef, revealBelow = REVEAL_BELOW }) {
  // How much of the body is on show, and how long it really is — the hairline above the footer
  // and the lasting scroll mark are drawn only when there is more than fits.
  const [shown, setShown] = useState(0);
  const [full, setFull] = useState(0);
  const scrolling = !list && shown > 0 && full > shown + 1;
  const id = testID || 'sheet';
  // One node, two holders: the sheet's own (to finish the scroll to the box being typed in) and
  // the caller's `bodyRef`, object or function. In the list shape there is no scroller, so both
  // stay empty and the helper below never has anything to move.
  const own = useRef(null);
  const setBody = useCallback((node) => {
    own.current = node;
    if (typeof bodyRef === 'function') bodyRef(node);
    else if (bodyRef) bodyRef.current = node;
  }, [bodyRef]);
  const typing = useRevealFocusedInput(own, revealBelow);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[sh.scrim, sh.scrimFit]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[sh.sheet, sh.sheetFit]} testID={testID}>
        {list ? (
          <View style={sh.fitList} testID={`${id}-body`}>{children}</View>
        ) : (
          <ScrollView
            ref={setBody}
            style={sh.fitBody}
            contentContainerStyle={sh.fitBodyContent}
            keyboardShouldPersistTaps="handled"
            persistentScrollbar={scrolling}
            onLayout={e => { setShown(e.nativeEvent.layout.height); typing.onLayout(e); }}
            onFocus={typing.onFocus}
            onContentSizeChange={(w, h) => setFull(h)}
            testID={`${id}-body`}
          >
            {children}
          </ScrollView>
        )}
        {footer ? <View style={[sh.fitFooter, scrolling && sh.fitFooterLine]} testID={`${id}-footer`}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

/** Air kept between a block that was brought into view and the edge of the body. */
export const SHOW_PAD = 6;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Where a fit sheet's body must be scrolled to for one block of it to be on show — or null when
 * it already is. The arithmetic on its own, so it can be read and tested without a phone.
 *   place   { top, height }  the block inside the body's content (does not move when it scrolls)
 *   frame   { y, height }    the body on screen
 *   blockY                   the block's top edge on screen, right now
 * A block that fits is shown whole and moved as little as possible. A block taller than the body
 * is shown from its BOTTOM edge: the red line a field draws is the last thing in it.
 */
export function sheetScrollFor(place, frame, blockY, pad = SHOW_PAD) {
  if (!place || !frame) return null;
  if (![place.top, place.height, frame.y, frame.height, blockY].every(isNum)) return null;
  if (!(place.height > 0) || !(frame.height > 0)) return null;
  const now = place.top - (blockY - frame.y);                                   // where the body is scrolled to
  const atTop = Math.max(0, place.top - pad);                                   // the block's top on the top edge
  const atBottom = Math.max(0, place.top + place.height + pad - frame.height);  // its bottom on the bottom edge
  let want;
  if (place.height + 2 * pad > frame.height) want = atBottom;
  else if (now > atTop) want = atTop;
  else if (now < atBottom) want = atBottom;
  else return null;
  return Math.abs(want - now) <= 0.5 ? null : want;
}

/** Ask the phone where the block and the body are, and move the body. Never throws. */
function showInBody(scroll, node) {
  try {
    if (!scroll || !node || typeof scroll.scrollTo !== 'function') return;
    if (typeof node.measureLayout !== 'function' || typeof node.measureInWindow !== 'function') return;
    const inner = typeof scroll.getInnerViewRef === 'function' ? scroll.getInnerViewRef() : null;
    const outer = (typeof scroll.getNativeScrollRef === 'function' ? scroll.getNativeScrollRef() : null) || scroll;
    if (!inner || !outer || typeof outer.measureInWindow !== 'function') return;
    // The phone refuses (the fail callback) for a block that is not inside this body.
    node.measureLayout(inner, (left, top, width, height) => {
      try {
        outer.measureInWindow((fx, fy, fw, fh) => {
          try {
            node.measureInWindow((bx, by) => {
              try {
                const y = sheetScrollFor({ top, height }, { y: fy, height: fh }, by);
                if (y != null) scroll.scrollTo({ x: 0, y, animated: true });
              } catch (e) { /* a block that was not moved into view is still one she can scroll to */ }
            });
          } catch (e) { /* as above */ }
        });
      } catch (e) { /* as above */ }
    }, () => {});
  } catch (e) { /* never into a render or a native callback */ }
}

/**
 * useSheetReveal — for a fit sheet whose pinned button can refuse something drawn in its body.
 *
 * ui-walk-fixes (board C, rule 3 + the 17 September lesson: a refusal must appear where the
 * person is looking). With the button pinned above the keypad the body can be very short, and a
 * check that fails draws its red line under a box that has scrolled out of sight — the button
 * then seems to do nothing. The red line stays under its own box (nothing is moved or repeated at
 * rest); the body is scrolled to it instead.
 *
 *   const reveal = useSheetReveal();                       // a HOOK — above every early return
 *   <Sheet fit bodyRef={reveal.bodyRef} footer={…}>
 *     <View ref={reveal.mark('date')} collapsable={false}>…the box, with its red line LAST…</View>
 *   </Sheet>
 *   setErrs(e); reveal.show('date');                       // in the same handler as the state
 *
 * `show` waits for the draw that follows it, so the red line is already part of the block when
 * the phone is asked where the block is. With the keypad closed and the whole sheet on show there
 * is nothing to scroll and nothing moves. Under jest the stock mocks never answer a measurement,
 * so it is inert unless a test stubs them.
 */
export function useSheetReveal() {
  const bodyRef = useRef(null);
  const nodes = useRef({});
  const setters = useRef({});
  const want = useRef(null);
  const [turn, setTurn] = useState(0);
  const mark = useCallback((key) => {
    if (!setters.current[key]) setters.current[key] = (node) => { nodes.current[key] = node; };
    return setters.current[key];
  }, []);
  const show = useCallback((key) => { want.current = key; setTurn(n => n + 1); }, []);
  useEffect(() => {
    const key = want.current;
    want.current = null;
    if (key == null) return;
    showInBody(bodyRef.current, nodes.current[key]);
  }, [turn]);
  return useMemo(() => ({ bodyRef, mark, show }), [mark, show]);
}

/**
 * B4 — Title · Clear · search · checkbox list · "Apply · N {noun}".
 * items: [{ code, label }]. value: array of codes or null (= Any).
 * Clear returns to Any. Apply hands back the chosen codes (or null when none).
 */
export function PickerSheet({ visible, title, hint, items, value, nounOne, nounMany, searchPlaceholder, onApply, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => new Set(value || []));
  React.useEffect(() => { if (visible) { setSel(new Set(value || [])); setQ(''); } }, [visible]); // eslint-disable-line

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? items.filter(i => i.label.toLowerCase().includes(n)) : items;
  }, [items, q]);

  function toggle(code) {
    setSel(prev => { const s = new Set(prev); s.has(code) ? s.delete(code) : s.add(code); return s; });
  }
  const count = sel.size;
  const noun = count === 1 ? nounOne : nounMany;

  // ui-walk-fixes (board C, rule 3): searching opens the keypad, and the list's lower rows and
  // "Apply" went under it. The list now gives way instead (fit="list" — a list is never put inside
  // a ScrollView) and "Apply" is pinned under it, directly above the keypad.
  return (
    <Sheet visible={visible} onClose={onClose} testID="picker-sheet" fit="list"
      footer={(
        <PrimaryButton
          label={COPY.picker.apply(count, noun)}
          onPress={() => onApply(count ? [...sel] : null)}
          testID="picker-apply"
        />
      )}>
      <View style={sh.head}>
        <Text style={sh.title}>{title}</Text>
        <TouchableOpacity onPress={() => setSel(new Set())} accessibilityRole="button">
          <Text style={sh.clear}>{COPY.picker.clear}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={sh.search}
        value={q}
        onChangeText={setQ}
        placeholder={searchPlaceholder}
        placeholderTextColor={T.ink3}
        autoCorrect={false}
      />
      {hint ? <Text style={sh.hint}>{hint}</Text> : null}
      <FlatList
        data={shown}
        keyExtractor={i => i.code}
        style={{ maxHeight: 360 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = sel.has(item.code);
          return (
            <TouchableOpacity style={sh.optRow} onPress={() => toggle(item.code)} accessibilityRole="checkbox" accessibilityState={{ checked: !!on }}>
              <View style={[sh.box, on && sh.boxOn]}>{on ? <Text style={sh.tick}>✓</Text> : null}</View>
              <Text style={sh.optLabel}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </Sheet>
  );
}

/**
 * Confirm sheet: title, body, optional info box, primary (or danger) + secondary.
 */
export function ConfirmSheet({ visible, title, body, info, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  return (
    <Sheet visible={visible} onClose={onCancel} testID="confirm-sheet">
      <Text style={sh.title}>{title}</Text>
      <Text style={sh.body}>{body}</Text>
      {info ? <InfoBox text={info} /> : null}
      <View style={{ height: 16 }} />
      {danger
        ? <DangerButton label={confirmLabel} onPress={onConfirm} testID="confirm-primary" />
        : <PrimaryButton label={confirmLabel} onPress={onConfirm} testID="confirm-primary" />}
      <SecondaryButton label={cancelLabel} onPress={onCancel} testID="confirm-secondary" />
    </Sheet>
  );
}

/** The ⋯ menu: a short list of actions, the last of which may be destructive. */
export function ActionSheet({ visible, actions, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="action-sheet">
      {actions.map(a => (
        <TouchableOpacity key={a.label} style={sh.action} onPress={() => { onClose(); a.onPress(); }} accessibilityRole="button">
          <Text style={[sh.actionText, a.destructive && { color: T.danger }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
      <SecondaryButton label="Cancel" onPress={onClose} />
    </Sheet>
  );
}

export const sh = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,26,23,0.45)' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  // ui-walk-fixes — the opt-in `fit` sheet only. The scrim keeps a sliver so the sheet stops just
  // below the status bar; the sheet shrinks to the room left; the body gives way, the footer never.
  scrimFit: { minHeight: 8 },
  sheetFit: { flexShrink: 1, maxHeight: '100%' },
  fitBody: { flexGrow: 0, flexShrink: 1, marginHorizontal: -18 },
  fitBodyContent: { paddingHorizontal: 18 },
  // `overflow: hidden` — what sits above the list keeps its height; if that alone is more than the
  // room (many chosen-city chips on a short phone with the keypad open) it is cut at the body's
  // edge instead of being painted across the pinned button.
  fitList: { flexShrink: 1, minHeight: 0, overflow: 'hidden' },
  fitFooter: { marginHorizontal: -18, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'transparent' },
  fitFooterLine: { borderTopColor: T.border },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  clear: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2 },
  body: { fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink2, lineHeight: 20, marginTop: 8 },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 8, marginBottom: 4 },
  optRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: T.bg },
  boxOn: { backgroundColor: T.ink, borderColor: T.ink },
  tick: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.sansBold },
  optLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink, flex: 1 },
  action: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  actionText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
});
