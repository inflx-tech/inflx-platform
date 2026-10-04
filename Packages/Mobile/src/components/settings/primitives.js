/**
 * Item 2 — the small building blocks every settings screen is made of.
 * Contract: features/item2-pitch-invitation-settings · prompt §6
 *
 *   Chip         multi-select chip: ink fill + ✓ when selected, white + border otherwise
 *   Tag          neutral outline Aim / mode tag — never coloured
 *   SettingRow   label · value ("Any" / "3 selected") · chevron
 *   SwitchRow    label + hint + RN Switch (ink on, grey off)
 *   Section      section title (+ hint)
 *   FieldError   the red line under a field
 *   InfoBox      the grey information box (B5/C3/C5)
 *   Banner       grey banner (paused / not accepting / not matching)
 *   PrimaryButton / SecondaryButton / DangerButton
 *   StatusChip   green "On" / grey "Paused" on the profile entry rows
 *
 * ui-walk-fixes (board E, 2 Oct 2026) — added, every one opt-in:
 *   ButtonRow    two equal, level halves (or one full-width button, or nothing at all)
 *   AnswerBar    the small grey line, the one main button, then a ButtonRow of two choices
 *   AnswerNote   the small centred grey line an AnswerBar starts with
 *   SecondaryButton `inline` `strong` `disabled` · DangerButton `outline`
 * A button outside a ButtonRow / AnswerBar / BottomBar that is given none of the new props is
 * drawn exactly as before.
 *
 * All RN core — nothing native, so it ships over the air.
 */

import React, { createContext, useContext } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';

/**
 * Where a button is sitting. `null` (the default — every screen written before 2 Oct 2026) means
 * "on its own": nothing about it changes.
 *
 *   'row'    a half of a ButtonRow — no top gap, fills its half, one common height of at least
 *            44, the label on one line
 *   'main'   the main button of an AnswerBar — a long label is centred with side padding and
 *            wraps to as many centred lines as it needs (it is never cut short with "…")
 *   'stack'  one of the buttons stacked in a BottomBar — the outline button drops its built-in
 *            top gap, because the bar already keeps its children 8 apart
 *
 * A context reaches everything drawn beneath it, however deep — including a pop-up opened by a
 * component that sits in a bar. `Sheet` (components/settings/sheets.js) therefore sets the slot
 * back to `null`, so the buttons inside a pop-up are always "on their own" again. A component
 * that draws its own raw `Modal` from inside a bar must do the same:
 * `<ButtonSlot.Provider value={null}>…</ButtonSlot.Provider>`.
 */
export const ButtonSlot = createContext(null);

export function Chip({ label, selected, onPress, disabled, testID }) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[st.chip, selected && st.chipOn, disabled && st.dim]}
    >
      <Text style={[st.chipText, selected && st.chipTextOn]}>{selected ? '✓ ' : ''}{label}</Text>
    </TouchableOpacity>
  );
}

export function Tag({ label }) {
  return (
    <View style={st.tag}><Text style={st.tagText}>{label}</Text></View>
  );
}

export function TagRow({ items }) {
  return (
    <View style={st.tagRow}>{items.map(l => <Tag key={l} label={l} />)}</View>
  );
}

export function SettingRow({ label, value, onPress, disabled, error, testID, hint }) {
  return (
    <View>
      <TouchableOpacity testID={testID} onPress={onPress} disabled={disabled || !onPress} activeOpacity={0.7} style={[st.row, disabled && st.dim]}>
        <Text style={st.rowLabel}>{label}</Text>
        <Text style={st.rowValue} numberOfLines={1}>{value}</Text>
        {onPress ? <Text style={st.chev}>›</Text> : null}
      </TouchableOpacity>
      {hint ? <Text style={st.hint}>{hint}</Text> : null}
      {error ? <FieldError text={error} /> : null}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onValueChange, testID }) {
  return (
    <View style={st.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.switchLabel}>{label}</Text>
        {hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
      <Switch
        testID={testID}
        value={!!value}
        onValueChange={onValueChange}
        trackColor={{ false: T.border, true: T.ink }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={T.border}
      />
    </View>
  );
}

export function Section({ title, hint, children, dimmed }) {
  return (
    <View style={[st.section, dimmed && st.dim]}>
      {title ? <Text style={st.sectionTitle}>{title}</Text> : null}
      {children}
      {hint ? <Text style={st.hint}>{hint}</Text> : null}
    </View>
  );
}

export function FieldError({ text }) {
  if (!text) return null;
  return <Text style={st.error} accessibilityRole="alert">{text}</Text>;
}

export function InfoBox({ text }) {
  return <View style={st.info}><Text style={st.infoText}>{text}</Text></View>;
}

export function Banner({ title, body, testID }) {
  return (
    <View style={st.banner} testID={testID}>
      <Text style={st.bannerTitle}>{title}</Text>
      {body ? <Text style={st.bannerBody}>{body}</Text> : null}
    </View>
  );
}

/** `oneLine` on the main button: a label too long for the button ends with "…" — it never wraps. */
const ONE_LINE = { ellipsizeMode: 'tail' };

/**
 * `icon` is an optional MaterialCommunityIcons name drawn before the label, as the item 10
 * mockups do (a tick on "Confirm the shoot is done", a phone on a call). Additive — every
 * existing caller passes nothing and is unchanged.
 *
 * `oneLine` (shopper-walk-fixes, frame C2) — opt-in, for a label that carries a name of any
 * length ("Send to Aveen fashion boutique and desiner studio"): one centred line with side
 * padding, cut at the end with "…". The button never grows to a second line. A caller that does
 * not pass it is drawn exactly as before.
 */
export function PrimaryButton({ label, onPress, disabled, busy, busyLabel, icon, testID, oneLine }) {
  const slot = useContext(ButtonSlot);
  const off = disabled || busy;
  const row = slot === 'row';
  const main = slot === 'main';
  const one = !!oneLine && !row;
  // One line only inside a ButtonRow. As an AnswerBar's main button the label is centred and
  // wraps in full, however many lines that takes: "Accept ₹12,000 · 1 reel, 2 stories, 1 YouTube
  // video" is the terms she is agreeing to, and a cap of two lines cut it off with "…" where,
  // before this build, it had always wrapped in full.
  const lines = row || one ? 1 : undefined;
  const fit = row || one ? st.rowText : main ? st.mainText : null;
  const cut = one ? ONE_LINE : null;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      style={[st.primary, off && st.primaryOff, row && st.inRow, row && st.rowPad0, (main || one) && st.mainPad]}
    >
      {busy ? (
        <View style={st.busyRow}>
          <ActivityIndicator color={T.ink} />
          <Text numberOfLines={lines} {...cut} style={[st.primaryText, { marginLeft: 8 }, fit]}>{busyLabel || 'Saving'}</Text>
        </View>
      ) : icon ? (
        <View style={st.busyRow}>
          <Icon name={icon} size={17} color={off ? T.disabledText : T.onPrimary} />
          <Text numberOfLines={lines} {...cut} style={[st.primaryText, off && st.primaryTextOff, { marginLeft: 8 }, fit]}>{label}</Text>
        </View>
      ) : (
        <Text numberOfLines={lines} {...cut} style={[st.primaryText, off && st.primaryTextOff, fit]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

/** `shrink` on the outline button: the label is drawn smaller rather than cut, never below 0.8. */
const SHRINK_TO_FIT = { adjustsFontSizeToFit: true, minimumFontScale: 0.8 };

/**
 * The outline button. On its own it carries a 10 top gap, because it was made to sit UNDER a
 * main button. ui-walk-fixes adds, all opt-in:
 *   `inline`   no top gap — for a button that is beside, not under, another one
 *   `strong`   the boards' clear dark outline (1.5 ink) instead of the pale hairline
 *   `disabled` now honoured. It used to be accepted and dropped, so the "Not yet" of eight
 *              sheets stayed tappable while their request was running.
 *   `shrink`   in a row only: a label too long for its half is drawn a little smaller (never
 *              below 0.8 of its size) instead of being cut short with "…". For the one long
 *              half-width label, "Ask for another date" (spec U23): it is 146 wide in a half
 *              that holds 147 on a 360-wide phone. No other caller passes it.
 * Inside a ButtonRow, an AnswerBar or a BottomBar the top gap goes by itself.
 */
export function SecondaryButton({ label, onPress, icon, testID, inline, strong, disabled, shrink }) {
  const slot = useContext(ButtonSlot);
  const row = slot === 'row';
  const flat = !!inline || slot != null;
  const lines = row ? 1 : undefined;
  const fit = row ? st.rowText : null;
  const tight = row && shrink ? SHRINK_TO_FIT : null;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={!!disabled}
      activeOpacity={0.85}
      style={[
        st.secondary, strong && st.secondaryStrong, flat && st.noTopGap,
        row && st.inRow, row && (strong ? st.rowPad15 : st.rowPad1), !!disabled && st.off,
      ]}
    >
      {icon ? (
        <View style={st.busyRow}>
          <Icon name={icon} size={16} color={T.ink} />
          <Text numberOfLines={lines} {...tight} style={[st.secondaryText, { marginLeft: 8 }, fit]}>{label}</Text>
        </View>
      ) : (
        <Text numberOfLines={lines} {...tight} style={[st.secondaryText, fit]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

/** A quiet text action with an icon — the mockups' "Ask to move this", "Call Tanvi". */
export function TextButton({ label, onPress, icon, testID }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.7} style={st.textBtn}>
      {icon ? <Icon name={icon} size={15} color={T.ink2} /> : null}
      <Text style={[st.textBtnLabel, icon && { marginLeft: 6 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Item 10 (approval §2.2): `busy` used to be accepted and dropped, so the four confirm sheets
// that pass it — decline, withdraw, reject, withdraw pitch — stayed tappable mid-request and a
// second tap could fire a second decline. Same contract as PrimaryButton now: busy disables
// the button and shows the spinner; two taps make one request.
//
// ui-walk-fixes (board E): `outline` is the boards' decline — white, red label, pale red outline —
// so the yellow button stays the loudest thing on the screen. Opt-in; the solid red block is
// still the default. The busy state is now readable in BOTH looks: the spinner used to be red on
// the red fill (invisible); it is white on the solid button and red on the outline one, and the
// "Working" label takes the same colour as the spinner.
export function DangerButton({ label, onPress, disabled, busy, busyLabel, testID, outline }) {
  const slot = useContext(ButtonSlot);
  const off = disabled || busy;
  const row = slot === 'row';
  const lines = row ? 1 : undefined;
  const fit = row ? st.rowText : null;
  const ink = outline ? st.dangerOutlineText : null;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      style={[
        st.dangerBtn, outline && st.dangerOutline,
        row && st.inRow, row && (outline ? st.rowPad15 : st.rowPad0), off && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <View style={st.busyRow}>
          <ActivityIndicator color={outline ? T.danger : '#FFFFFF'} />
          <Text numberOfLines={lines} style={[st.dangerText, ink, { marginLeft: 8 }, fit]}>{busyLabel || 'Working'}</Text>
        </View>
      ) : (
        <Text numberOfLines={lines} style={[st.dangerText, ink, fit]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * The children that are really there, each with a key that is its own across the WHOLE list:
 * null / false are dropped and a fragment is opened up, at any depth.
 *
 * React numbers the children of each fragment from zero again, so a button beside a fragment
 * (`<A/>` next to `<><B/></>`) would hand two halves the same key — React then warns, and on the
 * next update can drop or double a half. A fragment's children therefore carry the fragment's own
 * key in front of theirs.
 */
function slotsOf(children, path = '') {
  return React.Children.toArray(children).reduce((out, child, i) => {
    const isElement = React.isValidElement(child);
    const key = `${path}${isElement && child.key != null ? child.key : i}`;
    return isElement && child.type === React.Fragment
      ? out.concat(slotsOf(child.props.children, `${key}>`))
      : out.concat([{ key, child }]);
  }, []);
}

/**
 * The same list without the keys — for a bar that only needs to know whether it has anything to
 * draw. `<>{null}{false}</>` is nothing, however it is wrapped.
 */
export function buttonsOf(children) {
  return slotsOf(children).map(slot => slot.child);
}

/**
 * Two buttons side by side, as the boards draw them (board E, `.pairrow`): two equal halves,
 * 8 apart, both stretched to one common height of at least 44, tops and bottoms level, each
 * label centred on one line.
 *
 *   two children   → two equal halves
 *   one child      → a single full-width button (the other was not allowed — "gone, not greyed")
 *   none           → nothing at all is drawn, so no empty gap is left behind
 *
 * Children are the three buttons from this file, passed straight in with their own testIDs. A
 * child that is `null` / `false` counts as absent. Inside the row the outline button loses its
 * top gap and every button fills its half, so the outline can no longer sit lower or come out
 * taller than its neighbour.
 */
export function ButtonRow({ children, style, testID }) {
  const slots = slotsOf(children);
  if (!slots.length) return null;
  return (
    <View style={[st.btnRow, style]} testID={testID}>
      <ButtonSlot.Provider value="row">
        {slots.map(({ key, child }, i) => (
          <View key={key} style={[st.btnCell, i > 0 && st.btnCellGap]}>{child}</View>
        ))}
      </ButtonSlot.Provider>
    </View>
  );
}

/** The small centred grey line an AnswerBar starts with ("Nothing is final until you both sign…"). */
export function AnswerNote({ text, testID }) {
  if (!text) return null;
  return <Text style={st.answerNote} testID={testID}>{text}</Text>;
}

/**
 * "One main button, then two choices" — the invitation, both conversations and the pitch screens
 * (board E, frames E1–E7). Top to bottom, 8 apart:
 *
 *   note      optional. A string, an element (use <AnswerNote text testID /> to keep a testID),
 *             or an array of either — each is one small centred grey line.
 *   main      the main button, full width: the caller's own <PrimaryButton … testID="accept" />.
 *             Here — and only here — a long label ("Accept ₹12,000 · 1 reel, 2 stories") is
 *             centred with side padding and wraps to as many centred lines as it needs — it is
 *             never cut short.
 *   children  up to two buttons, drawn as a ButtonRow. One child fills the width; with none the
 *             row is left out altogether.
 *
 * With no main button and no child it draws nothing. It adds no padding, border or background of
 * its own: put it in a BottomBar for a pinned bar, or straight into the page (E7).
 */
export function AnswerBar({ note, main, children, style, testID }) {
  // Counted the same way the row counts them, so a fragment of nothing is nothing here too.
  const hasMain = buttonsOf(main).length > 0;
  const hasRow = buttonsOf(children).length > 0;
  if (!hasMain && !hasRow) return null;
  const notes = (Array.isArray(note) ? note : [note]).filter(Boolean);
  return (
    <View style={[st.answerBar, style]} testID={testID}>
      {notes.map((n, i) => (
        typeof n === 'string' ? <AnswerNote key={`note-${i}`} text={n} /> : <React.Fragment key={`note-${i}`}>{n}</React.Fragment>
      ))}
      {hasMain ? <ButtonSlot.Provider value="main">{main}</ButtonSlot.Provider> : null}
      {/* The children go to the row untouched: it opens fragments and keys the halves itself. */}
      <ButtonRow>{children}</ButtonRow>
    </View>
  );
}

export function StatusChip({ on, label }) {
  const c = on ? T.state.active : T.state.ended;
  return (
    <View style={[st.status, { backgroundColor: c.bg }]}>
      <Text style={[st.statusText, { color: c.fg }]}>{label || (on ? 'On' : 'Paused')}</Text>
    </View>
  );
}

export function EmptyState({ title, body }) {
  return (
    <View style={st.empty}>
      <Text style={st.emptyTitle}>{title}</Text>
      <Text style={st.emptyBody}>{body}</Text>
    </View>
  );
}

export const st = StyleSheet.create({
  dim: { opacity: 0.45 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, marginRight: 8, marginBottom: 8,
  },
  chipOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  chipTextOn: { color: '#FFFFFF' },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, marginRight: 6, marginBottom: 6 },
  tagText: { fontFamily: fonts.sansMedium, fontSize: 12, color: T.ink },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  rowLabel: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  rowValue: { fontFamily: fonts.sansMedium, fontSize: 13, color: T.ink2, maxWidth: '55%' },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3, marginLeft: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  switchLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 4, lineHeight: 17 },
  section: { marginTop: 18 },
  sectionTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2, marginBottom: 8, textTransform: 'none' },
  error: { fontFamily: fonts.sansMedium, fontSize: 12, color: T.danger, marginTop: 6, lineHeight: 17 },
  info: { backgroundColor: T.surface, borderRadius: 10, padding: 12, marginTop: 12 },
  infoText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 18 },
  banner: { backgroundColor: T.surface, borderRadius: 12, padding: 14, marginBottom: 12 },
  bannerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  bannerBody: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 3, lineHeight: 18 },
  primary: { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryOff: { backgroundColor: T.disabledBg },
  primaryText: { fontFamily: fonts.sansBold, fontSize: 15, color: T.onPrimary },
  primaryTextOff: { color: T.disabledText },
  busyRow: { flexDirection: 'row', alignItems: 'center' },
  secondary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, marginTop: 10 },
  secondaryText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  textBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  textBtnLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink2 },
  dangerBtn: { backgroundColor: T.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  dangerText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#FFFFFF' },
  status: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  emptyBody: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink3, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  // ── ui-walk-fixes (board E). Reached only through the new props, ButtonRow and AnswerBar. ──
  off: { opacity: 0.6 },
  noTopGap: { marginTop: 0 },
  // The outlines are half a point thicker than the hairline, so the padding gives the half point
  // back: a strong / outline button is exactly as tall as the plain one it replaces.
  secondaryStrong: { borderWidth: 1.5, borderColor: T.ink, paddingVertical: 13.5 },
  dangerOutline: { backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.dangerLine, paddingVertical: 12.5 },
  dangerOutlineText: { color: T.danger },
  btnRow: { flexDirection: 'row', alignItems: 'stretch' },
  btnCell: { flex: 1 },
  btnCellGap: { marginLeft: 8 },
  // A half of a ButtonRow: no top gap, fills its half both ways, at least 44 tall, label centred.
  inRow: { flexGrow: 1, alignSelf: 'stretch', marginTop: 0, minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
  // Vertical padding + outline always adds up to 12, whatever the outline (none / 1 / 1.5), so
  // two different buttons in one row come out the same height even at a large font size.
  rowPad0: { paddingVertical: 12 },
  rowPad1: { paddingVertical: 11 },
  rowPad15: { paddingVertical: 10.5 },
  rowText: { flexShrink: 1, textAlign: 'center' },
  mainPad: { paddingHorizontal: 16 },
  mainText: { flexShrink: 1, textAlign: 'center' },
  answerBar: { gap: 8 },
  answerNote: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, textAlign: 'center' },
});
