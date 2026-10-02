/**
 * ui-walk-fixes — board G (frames G1–G10): the shoot plan's Time box and the list it opens.
 * Contract: features/ui-walk-fixes · research/C09-shoot-time-picker.md · decisions U7, U12
 *
 * One list of whole times, every 15 minutes from 7:00 am to 8:45 pm. One tap picks and closes.
 * The chosen time is bold with a tick; on today's date a time that has already gone is grey and
 * cannot be tapped. Built in JavaScript (item 10 Q8's "no Android clock" half is kept; its "chip"
 * half is what this replaces), so it ships over the air.
 *
 * It lives in its own file because fifteen screens import bits10.js. Everything here is an Indian
 * clock reading: a day is 'YYYY-MM-DD' in India, a time is { h, min } on an Indian clock.
 */
import React, { useRef, useState } from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet, Keyboard } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { C10, clock10, dayParts, istDay10, istToIso } from './copy10';

/** 7:00 am … 8:45 pm in 15-minute steps (U7) — 56 times. */
export const SLOTS10 = (() => {
  const out = [];
  for (let h = 7; h <= 20; h++) for (const min of [0, 15, 30, 45]) out.push({ h, min });
  return out;
})();

/** One row of the list. Fixed, so the list can open already scrolled to a row. */
export const ROW_H10 = 44;
/** Rows left showing above the one the list opens at. */
const LEAD = 2;
/** The list's window: eight rows, less when the phone is short (the sheet shrinks it). */
const WINDOW_H = ROW_H10 * 8;

const pad = (n) => String(n).padStart(2, '0');
const fmtDay = (p) => (p ? `${p.y}-${pad(p.m + 1)}-${pad(p.d)}` : null);

/** A day in India and a time on an Indian clock → the instant, as ISO. Null unless both are there. */
export function slotIso10(day, slot) {
  const p = dayParts(day);
  return p && slot ? istToIso(p.y, p.m, p.d, slot.h, slot.min) : null;
}

/** Has this time on this day already gone? With no day chosen yet, nothing has. Always a boolean. */
export function slotGone10(day, slot, now = Date.now()) {
  const iso = slotIso10(day, slot);
  return !!iso && new Date(iso).getTime() <= now;
}

/** Where a time sits in the list, or -1 (no time, or a time that is not one of the 56). */
export function slotIndex10(slot) {
  return slot ? SLOTS10.findIndex((s) => s.h === slot.h && s.min === slot.min) : -1;
}

/**
 * The days a visit can still be put on: from today in India (never the phone's own "today") to
 * the posting day. Today drops out once its last time has gone, so late in the evening the first
 * day on offer is tomorrow. `none` is true when no day is left at all — the posting date has
 * passed, or it is today and the last time today has gone.
 *
 * With no posting date the only day is today, as the old strip had it (such a collaboration
 * cannot take a shoot plan anyway).
 */
export function openDays10(maxDay, minDay, now = Date.now()) {
  const today = istDay10(new Date(now).toISOString());
  const asked = fmtDay(dayParts(minDay));
  const start = asked && asked > today ? asked : today;
  const max = fmtDay(dayParts(maxDay)) || start;
  let min = start;
  if (slotGone10(start, SLOTS10[SLOTS10.length - 1], now)) {
    const p = dayParts(start);
    min = new Date(Date.UTC(p.y, p.m, p.d + 1)).toISOString().slice(0, 10);
  }
  return { min, max, none: min > max };
}

/**
 * The rows. Mounted only while the sheet is open, so every opening starts from the right place:
 * the chosen time, else the first time still open (U12), with two rows left showing above it.
 */
function TimeRows({ value, day, onPick }) {
  const now = Date.now();
  const chosen = slotIndex10(value);
  const firstOpen = SLOTS10.findIndex((s) => !slotGone10(day, s, now));
  const at = chosen >= 0 ? chosen : firstOpen;
  const y = Math.max(0, at - LEAD) * ROW_H10;
  const list = useRef(null);
  const placed = useRef(false);
  // `contentOffset` places the list on its first draw; the scrollTo is the same thing said again
  // once the rows have a height, for a phone that drew the frame before the rows.
  function place() {
    if (placed.current) return;
    placed.current = true;
    if (y > 0 && list.current && list.current.scrollTo) list.current.scrollTo({ x: 0, y, animated: false });
  }
  return (
    <ScrollView ref={list} style={tl.window} contentOffset={{ x: 0, y }} onContentSizeChange={place} testID="time-list">
      {SLOTS10.map((s, i) => {
        const off = slotGone10(day, s, now);
        const on = i === chosen;
        return (
          <TouchableOpacity key={`${s.h}-${s.min}`} style={tl.row} activeOpacity={off ? 1 : 0.6} onPress={() => onPick(s)}
            disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off, selected: !!on }} testID={`time-${s.h}-${pad(s.min)}`}>
            <Text style={[tl.rowText, on && tl.rowOn, off && tl.rowOff]}>{clock10(s)}</Text>
            {on ? <Icon name="check" size={18} color={off ? T.disabledText : T.ink} testID="time-tick" /> : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** The bottom sheet: the word "Time" and the list. The scrim or the phone's Back closes it. */
export function TimeList10({ visible, value, day, onPick, onClose, testID }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID={testID || 'time-sheet'} fit="list">
      <Text style={tl.title}>{C10.plan.time}</Text>
      <TimeRows value={value} day={day} onPick={onPick} />
    </Sheet>
  );
}

/**
 * The Time box: a clock mark and the chosen time, or the grey "Choose a time". Tapping it opens
 * the list. `value` in and out is { h, min } on an Indian clock; `day` is the day chosen beside
 * it (so the list knows which times have gone), or null.
 */
export function TimeField10({ value, onChange, day, placeholder, invalid, testID }) {
  const [open, setOpen] = useState(false);
  // The list needs the room the keypad is standing in (the move sheet has a "Say why" box).
  const show = () => { Keyboard.dismiss(); setOpen(true); };
  return (
    <>
      <TouchableOpacity style={[tl.field, invalid && tl.fieldError]} activeOpacity={0.7} onPress={show} testID={testID || 'time-field'} accessibilityRole="button">
        <Icon name="clock-outline" size={16} color={T.ink3} />
        <Text numberOfLines={1} style={[tl.value, !value && tl.placeholder]}>{value ? clock10(value) : (placeholder || C10.plan.chooseTime)}</Text>
      </TouchableOpacity>
      <TimeList10 visible={open} value={value} day={day} onClose={() => setOpen(false)}
        onPick={(slot) => { setOpen(false); onChange(slot); }} />
    </>
  );
}

const tl = StyleSheet.create({
  // The same box as DateField's, so the two sit level side by side.
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.border,
    borderRadius: 12, paddingHorizontal: 12, height: 44,
  },
  fieldError: { borderColor: T.danger },
  value: { flex: 1, marginLeft: 6, fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  placeholder: { color: T.ink3, fontFamily: fonts.sansRegular },

  title: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink, marginBottom: 6 },
  window: { maxHeight: WINDOW_H, flexGrow: 0 },
  row: {
    height: ROW_H10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  rowText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  rowOn: { fontFamily: fonts.sansBold },
  rowOff: { color: T.disabledText, fontFamily: fonts.sansRegular },
});
