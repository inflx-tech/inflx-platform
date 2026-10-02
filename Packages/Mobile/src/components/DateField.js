import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Keyboard } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../theme/tokens';

/**
 * DateField — a date, chosen from a calendar rather than typed. Pure JavaScript: no native
 * module, so it ships over the air.
 *
 * Contract: features/collab-terms-by-aim (item 2); item 4 moved it onto the item 2 palette,
 * added the confirm step ("Use this date") and a footer the caller renders for the pending day
 * (the C5 mockup shows "Dates before X are greyed out…" and "Invitations would close Y.").
 *
 * The value in and out is always 'YYYY-MM-DD' — a calendar day, never an instant.
 *
 * ui-walk-fixes (board G, the shoot plan's Date box) adds four OPT-IN props. A caller that passes
 * none of them gets exactly the field it always had:
 *   icon       a MaterialCommunityIcons name drawn before the value (the board's calendar mark)
 *   hideCaret  no ▾ at the right-hand end
 *   display    (iso) => string — what the box reads for a chosen day ("18 Oct" instead of
 *              "18 Oct 2026"). The value on the wire is still 'YYYY-MM-DD'.
 *   invalid    a red outline with no sentence of its own, for a box that shares one error line
 *              with the box beside it
 * and (board C) a fifth, opt-in like the others:
 *   closeKeypad  the keypad is put away before the calendar opens, as the Time box beside it on
 *              the shoot plan already does. For a Date box that shares a form or a pop-up with a
 *              text box: the calendar needs the room the keypad is standing in.
 */

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
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
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${short[d.getMonth()]} ${d.getFullYear()}`;
}

export default function DateField({
  label,
  value,
  onChange,
  placeholder = 'Choose a date',
  hint,
  error,
  minDate,                 // 'YYYY-MM-DD' | Date | undefined — defaults to today
  maxDate,
  confirmLabel,            // when set, tapping a day only selects it; this button confirms (C5)
  renderFooter,            // (pendingISO | null) => node, rendered under the grid (C5 hints)
  style,
  testID,
  icon,                    // opt-in (board G): a leading icon
  hideCaret,               // opt-in (board G): no ▾
  display,                 // opt-in (board G): (iso) => the words the box shows
  invalid,                 // opt-in (board G): red outline, no message
  closeKeypad,             // opt-in (board C): put the keypad away before the calendar opens
}) {
  const [open, setOpen] = useState(false);
  const show = () => { if (closeKeypad) Keyboard.dismiss(); setOpen(true); };
  const [pending, setPending] = useState(value || null);

  const min = useMemo(() => {
    const d = minDate ? (typeof minDate === 'string' ? parseISO(minDate) : new Date(minDate)) : new Date();
    return midnight(d || new Date());
  }, [minDate]);

  const max = useMemo(() => {
    if (!maxDate) return null;
    const d = typeof maxDate === 'string' ? parseISO(maxDate) : new Date(maxDate);
    return d ? midnight(d) : null;
  }, [maxDate]);

  const selected = parseISO(pending);
  const [cursor, setCursor] = useState(() => {
    const base = parseISO(value) || min;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  useEffect(() => { if (open) { setPending(value || null); const base = parseISO(value) || min; setCursor(new Date(base.getFullYear(), base.getMonth(), 1)); } }, [open]); // eslint-disable-line

  // Monday-first grid, as the mockups draw it.
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return cells;
  }, [cursor]);

  /**
   * ⚠️ These three MUST return a real boolean, never null.
   *
   * `(min && d < min) || (max && d > max)` reads as a boolean but is not one: with no maxDate —
   * which is every posting-date picker — the right-hand side evaluates to `max`, i.e. `null`,
   * for every day that is NOT greyed out. That null went straight into `accessibilityState`
   * below, and Android's BaseViewManager.setViewState does:
   *
   *     if (accessibilityState.hasKey("disabled") && !accessibilityState.getBoolean("disabled"))
   *
   * hasKey() is true for a key whose value is null, and getBoolean() on a null throws
   * NoSuchKeyException — a native crash, so the app closed the moment the calendar drew. Jest
   * never saw it: there is no native side under node. Found by the founder's thumb on the set
   * posting date, and it was in EVERY date picker in the app.
   */
  const blocked = (d) => !!((min && d < min) || (max && d > max));

  const prevBlocked = useMemo(() => {
    const last = new Date(cursor.getFullYear(), cursor.getMonth(), 0);
    return !!(min && last < min);
  }, [cursor, min]);
  const nextBlocked = useMemo(() => {
    const firstNext = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return !!(max && firstNext > max);
  }, [cursor, max]);

  function pick(d) {
    if (blocked(d)) return;
    const iso = toISO(d);
    if (confirmLabel) { setPending(iso); return; }
    onChange(iso);
    setOpen(false);
  }
  function confirm() {
    if (!pending) return;
    onChange(pending);
    setOpen(false);
  }

  const shown = (display && prettyDate(value) ? display(value) : null) || prettyDate(value);

  return (
    <View style={[{ marginBottom: 10 }, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity style={[s.field, (error || invalid) && s.fieldError]} activeOpacity={0.7} onPress={show} testID={testID || 'date-field'} accessibilityRole="button">
        {icon ? (
          <View style={s.lead}>
            <Icon name={icon} size={16} color={T.ink3} />
            <Text numberOfLines={1} style={[s.value, s.leadValue, !shown && s.placeholder]}>{shown || placeholder}</Text>
          </View>
        ) : (
          <Text style={[s.value, !shown && s.placeholder]}>{shown || placeholder}</Text>
        )}
        {hideCaret ? null : <Text style={s.caret}>▾</Text>}
      </TouchableOpacity>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
      {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}} testID="date-sheet">
            <View style={s.grab} />
            <View style={s.head}>
              <TouchableOpacity onPress={() => !prevBlocked && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID="date-prev">
                <Text style={[s.arrow, prevBlocked && s.arrowOff]}>‹</Text>
              </TouchableOpacity>
              <Text style={s.month}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</Text>
              <TouchableOpacity onPress={() => !nextBlocked && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID="date-next">
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
                  <TouchableOpacity key={toISO(d)} style={[s.cell, on && s.cellOn]} activeOpacity={off ? 1 : 0.6} onPress={() => pick(d)}
                    disabled={off} accessibilityState={{ disabled: !!off, selected: !!on }} testID={`day-${toISO(d)}`}>
                    <Text style={[s.day, off && s.dayOff, on && s.dayOn]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {renderFooter ? renderFooter(pending) : null}

            {confirmLabel ? (
              <TouchableOpacity style={[s.confirm, !pending && s.confirmOff]} onPress={confirm} disabled={!pending} testID="date-confirm" accessibilityRole="button">
                <Text style={s.confirmT}>{confirmLabel}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.close} onPress={() => setOpen(false)}>
                <Text style={s.closeT}>Cancel</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.border,
    borderRadius: 12, paddingHorizontal: 12, height: 44,
  },
  fieldError: { borderColor: T.danger },
  value: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  placeholder: { color: T.ink3, fontFamily: fonts.sansRegular },
  caret: { fontSize: 13, color: T.ink3 },
  lead: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  leadValue: { flex: 1, marginLeft: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 6 },
  error: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.danger, marginTop: 6 },

  backdrop: { flex: 1, backgroundColor: 'rgba(26,26,23,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 24 },
  grab: { width: 36, height: 4, borderRadius: 4, backgroundColor: T.border, alignSelf: 'center', marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  month: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  arrow: { fontSize: 26, color: T.ink, paddingHorizontal: 10, lineHeight: 30 },
  arrowOff: { color: T.ink3 },
  week: { flexDirection: 'row' },
  weekD: { flex: 1, textAlign: 'center', fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  cellOn: { backgroundColor: T.ink },
  day: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  dayOff: { color: '#C9C8C0', fontFamily: fonts.sansRegular },
  dayOn: { color: T.bg, fontFamily: fonts.sansBold },
  confirm: { marginTop: 12, height: 42, borderRadius: 12, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  confirmOff: { opacity: 0.5 },
  confirmT: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  close: { marginTop: 10, paddingVertical: 11, alignItems: 'center' },
  closeT: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2 },
});
