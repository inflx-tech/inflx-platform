import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { brandPalette as P, fonts } from '../theme/tokens';

/**
 * DateTimeChipPicker — pure JS date + time picker. No native module so no
 * APK rebuild is needed. Picks one date within [minDate, maxDate] from a
 * horizontal scrolling strip, then an hour (8 AM–7 PM) + minute (:00 / :15
 * / :30 / :45) from chip rows.
 *
 * Props
 *   minDate, maxDate    : Date | null  → bounds the date strip (inclusive)
 *   value               : Date | null  → currently selected datetime
 *   onChange            : (Date) => void
 *   maxDaysShown        : number       → defaults to 30
 *
 * Renders nothing chrome of its own (no card / no title) — caller positions
 * it. Pure inputs; no submit button.
 *
 * Flow 37 restyle (2026-05-28): brandPalette + Outfit/Plus Jakarta Sans/
 * JetBrains Mono fonts. Ink-active chips with yellow text (matches Flow 33/
 * 35/36 picker pattern). Summary box = successPale + successText.
 */
export default function DateTimeChipPicker({ minDate, maxDate, value, onChange, maxDaysShown = 30 }) {
  // Anchor "today" at midnight so chip identity is stable across renders.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startDay = useMemo(() => {
    const m = minDate ? new Date(minDate) : new Date(today);
    m.setHours(0, 0, 0, 0);
    return m < today ? today : m;
  }, [minDate, today]);

  const endDay = useMemo(() => {
    if (!maxDate) {
      const f = new Date(startDay);
      f.setDate(f.getDate() + maxDaysShown - 1);
      return f;
    }
    const m = new Date(maxDate);
    m.setHours(23, 59, 59, 999);
    return m;
  }, [maxDate, startDay, maxDaysShown]);

  // Build the date strip: every day from startDay → endDay (capped at maxDaysShown).
  const dateChips = useMemo(() => {
    const arr = [];
    const cursor = new Date(startDay);
    for (let i = 0; i < maxDaysShown; i++) {
      if (cursor > endDay) break;
      arr.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return arr;
  }, [startDay, endDay, maxDaysShown]);

  // Derive selected date / hour / minute from value (or default to first valid).
  const selDate   = value ? new Date(value) : (dateChips[0] ? new Date(dateChips[0]) : null);
  const selHour   = value ? new Date(value).getHours() : 10;
  const selMinute = value ? new Date(value).getMinutes() : 0;

  function sameDay(a, b) {
    return a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function emit(date, hour, minute) {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    onChange?.(d);
  }

  function pickDate(d) {
    emit(d, selHour, selMinute);
  }
  function pickHour(h) {
    emit(selDate || dateChips[0] || new Date(), h, selMinute);
  }
  function pickMinute(m) {
    emit(selDate || dateChips[0] || new Date(), selHour, m);
  }

  // Hour grid: 8 AM through 7 PM (12 slots) — common shoot hours.
  const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
  const MINUTES = [0, 15, 30, 45];

  function fmt12(h) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 || 12;
    return `${display} ${ampm}`;
  }

  return (
    <View>
      <Text style={styles.section}>DATE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {dateChips.length === 0 ? (
          <Text style={styles.emptyText}>No dates available — campaign window too tight.</Text>
        ) : dateChips.map((d, i) => {
          const isSel = sameDay(d, selDate);
          return (
            <TouchableOpacity key={i} style={[styles.dateChip, isSel && styles.dateChipActive]} onPress={() => pickDate(d)}>
              <Text style={[styles.dateChipDay, isSel && styles.chipTxtActive]}>
                {d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
              </Text>
              <Text style={[styles.dateChipNum, isSel && styles.chipTxtActive]}>
                {d.getDate()}
              </Text>
              <Text style={[styles.dateChipMonth, isSel && styles.chipTxtActive]}>
                {d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.section}>HOUR</Text>
      <View style={styles.row}>
        {HOURS.map(h => {
          const isSel = h === selHour;
          return (
            <TouchableOpacity key={h} style={[styles.timeChip, isSel && styles.timeChipActive]} onPress={() => pickHour(h)}>
              <Text style={[styles.timeChipTxt, isSel && styles.chipTxtActive]}>{fmt12(h)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.section}>MINUTE</Text>
      <View style={styles.row}>
        {MINUTES.map(m => {
          const isSel = m === selMinute;
          return (
            <TouchableOpacity key={m} style={[styles.timeChip, isSel && styles.timeChipActive]} onPress={() => pickMinute(m)}>
              <Text style={[styles.timeChipTxt, isSel && styles.chipTxtActive]}>:{m.toString().padStart(2, '0')}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected summary */}
      {selDate && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>SELECTED</Text>
          <Text style={styles.summaryValue}>
            {selDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {fmt12(selHour)}{selMinute > 0 ? `:${selMinute.toString().padStart(2, '0')}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 10, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: 10, marginBottom: 6,
    fontFamily: fonts.monoBold,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 2 },
  emptyText: { fontSize: 11, color: P.dangerText, padding: 8, fontFamily: fonts.sansRegular },

  dateChip: {
    minWidth: 56, paddingVertical: 8, paddingHorizontal: 10, marginRight: 6,
    borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.white,
    alignItems: 'center',
  },
  dateChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  dateChipDay: { fontSize: 9, fontWeight: '800', color: P.muted2, marginBottom: 2, letterSpacing: 0.3, fontFamily: fonts.monoBold },
  dateChipNum: { fontSize: 16, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  dateChipMonth: { fontSize: 9, fontWeight: '700', color: P.muted2, marginTop: 1, letterSpacing: 0.3, fontFamily: fonts.monoMedium },

  timeChip: {
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18,
    borderWidth: 1, borderColor: P.border, backgroundColor: P.white,
  },
  timeChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  timeChipTxt: { fontSize: 11, fontWeight: '800', color: P.muted, letterSpacing: 0.2, fontFamily: fonts.monoBold },

  chipTxtActive: { color: P.yellow, fontWeight: '900' },

  summary: {
    marginTop: 10, padding: 11, borderRadius: 10,
    backgroundColor: P.successPale,
    borderWidth: 1, borderColor: '#A8E6CC',
  },
  summaryLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.successText,
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2,
    fontFamily: fonts.monoBold,
  },
  summaryValue: { fontSize: 13, fontWeight: '900', color: P.successText, fontFamily: fonts.monoBold },
});
