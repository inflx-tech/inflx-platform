import React, { useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { ig } from '../theme/ig';

/**
 * DateField — a date, chosen from a calendar rather than typed.
 * Contract: features/collab-terms-by-aim (item 2)
 *
 * The founder, 2026-08-24: "while creating invitation, start date entry is better if we
 * keep date picker instead typing."
 *
 * Every date in the collaboration flow was a text box with a placeholder reading
 * "2026-09-15". On a phone that is four separate ways to fail: the wrong format, the
 * wrong month, a date already past, or a typo nobody notices until a deadline is missed.
 *
 * WHY THIS IS WRITTEN IN JAVASCRIPT RATHER THAN USING THE NATIVE PICKER:
 * @react-native-community/datetimepicker is in package.json, but NOTHING in the app
 * imports it — so there is no evidence it is compiled into the installed APK. Mobile
 * changes ship over the air, and an over-the-air bundle cannot add a native module: it
 * would crash on launch, uncatchably, on the founder's handset. A pure-JS calendar is
 * slightly more code and carries none of that risk.
 *
 * The value in and out is always 'YYYY-MM-DD' — the exact string the text box produced,
 * so nothing behind this screen changes.
 */

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse without timezone drift — 'YYYY-MM-DD' is a calendar day, not an instant. */
function parseISO(v) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** "15 Sep 2026" — what she reads. The wire still carries 'YYYY-MM-DD'. */
export function prettyDate(v) {
  const d = parseISO(v);
  if (!d) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DateField({
  label,
  value,
  onChange,
  placeholder = 'Choose a date',
  hint,
  minDate,                 // 'YYYY-MM-DD' | Date | undefined — defaults to today
  maxDate,
  style,
}) {
  const [open, setOpen] = useState(false);

  const min = useMemo(() => {
    // A posting deadline in the past is never a real answer, so today is the floor
    // unless a caller deliberately widens it.
    const d = minDate ? (typeof minDate === 'string' ? parseISO(minDate) : new Date(minDate)) : new Date();
    return midnight(d || new Date());
  }, [minDate]);

  const max = useMemo(() => {
    if (!maxDate) return null;
    const d = typeof maxDate === 'string' ? parseISO(maxDate) : new Date(maxDate);
    return d ? midnight(d) : null;
  }, [maxDate]);

  const selected = parseISO(value);
  const [cursor, setCursor] = useState(() => {
    const base = selected || min;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return cells;
  }, [cursor]);

  const blocked = (d) => (min && d < min) || (max && d > max);

  // A month with nothing selectable in it is a dead end, so the arrow is disabled
  // rather than leaving her to discover a wall of greyed-out numbers.
  const prevBlocked = useMemo(() => {
    const last = new Date(cursor.getFullYear(), cursor.getMonth(), 0);
    return min && last < min;
  }, [cursor, min]);
  const nextBlocked = useMemo(() => {
    const firstNext = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return max && firstNext > max;
  }, [cursor, max]);

  function pick(d) {
    if (blocked(d)) return;
    onChange(toISO(d));
    setOpen(false);
  }

  const shown = prettyDate(value);

  return (
    <View style={[{ marginBottom: 10 }, style]}>
      {!!label && <Text style={s.label}>{String(label).toUpperCase()}</Text>}
      <TouchableOpacity style={s.field} activeOpacity={0.7} onPress={() => setOpen(true)}>
        <Text style={[s.value, !shown && s.placeholder]}>{shown || placeholder}</Text>
        <Text style={s.caret}>▾</Text>
      </TouchableOpacity>
      {!!hint && <Text style={s.hint}>{hint}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={s.head}>
              <TouchableOpacity
                onPress={() => !prevBlocked && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[s.arrow, prevBlocked && s.arrowOff]}>‹</Text>
              </TouchableOpacity>
              <Text style={s.month}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</Text>
              <TouchableOpacity
                onPress={() => !nextBlocked && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[s.arrow, nextBlocked && s.arrowOff]}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={s.week}>
              {DAYS.map((d, i) => <Text key={i} style={s.weekD}>{d}</Text>)}
            </View>

            <View style={s.grid}>
              {grid.map((d, i) => {
                if (!d) return <View key={`b${i}`} style={s.cell} />;
                const off = blocked(d);
                const on = selected && toISO(d) === toISO(selected);
                return (
                  <TouchableOpacity
                    key={toISO(d)}
                    style={[s.cell, on && s.cellOn]}
                    activeOpacity={off ? 1 : 0.6}
                    onPress={() => pick(d)}
                  >
                    <Text style={[s.day, off && s.dayOff, on && s.dayOn]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={s.close} onPress={() => setOpen(false)}>
              <Text style={s.closeT}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 9, fontWeight: '800', color: ig.mut, letterSpacing: 0.4, marginBottom: 5 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: ig.bg, borderWidth: 1, borderColor: ig.line,
    borderRadius: 9, paddingHorizontal: 11, paddingVertical: 11,
  },
  value: { fontSize: 13, color: ig.text, fontWeight: '600' },
  placeholder: { color: ig.mut2, fontWeight: '400' },
  caret: { fontSize: 13, color: ig.mut },
  hint: { fontSize: 10.5, color: ig.mut2, lineHeight: 15, marginTop: 6 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  sheet: { backgroundColor: ig.bg, borderRadius: 16, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  month: { fontSize: 15, fontWeight: '800', color: ig.text },
  arrow: { fontSize: 26, color: ig.text, paddingHorizontal: 10, lineHeight: 30 },
  arrowOff: { color: ig.mut2 },
  week: { flexDirection: 'row' },
  weekD: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '800', color: ig.mut2, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  cellOn: { backgroundColor: ig.text },
  day: { fontSize: 13.5, color: ig.text, fontWeight: '600' },
  dayOff: { color: ig.mut2, fontWeight: '400' },
  dayOn: { color: ig.bg, fontWeight: '800' },
  close: { marginTop: 10, paddingVertical: 11, alignItems: 'center' },
  closeT: { fontSize: 12.5, fontWeight: '800', color: ig.mut },
});
