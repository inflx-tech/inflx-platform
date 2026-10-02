/**
 * Item 10 — the pieces the store-visit screens are built from: the gate card (ticks or
 * hourglasses), the four-step line, the time card (solid ink when live, grey when past), the
 * address card with Maps and call, the record rows, and a pure-JS time picker capped by the
 * posting date. Contract: features/item10-store-visit · mockups V1–V15 · prompt §8
 *
 * The picker is JavaScript on purpose (founder Q8, kept by ui-walk-fixes U7): the phone's own
 * Android clock is in the binary and stays unused. shoot10.test.js refuses an import of it.
 * ui-walk-fixes board G replaced Q8's chips with two boxes, Date and Time; the time list is in
 * TimeList10.js so this file, which fifteen screens import, carries only the picker's shell.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Card7 } from '../agreement/bits7';
import { FieldError } from '../settings/primitives';
import DateField from '../DateField';
import { TimeField10, openDays10, slotIso10 } from './TimeList10';
import { C10, istParts, istDay10, day10, whenLine10 } from './copy10';

/* ── V1 · the gate card ────────────────────────────────────────────────────── */

/** One line per condition, a tick when met, an hourglass when not; green when all met, blue otherwise. */
export function GateCard10({ gate, testID }) {
  if (!gate) return null;
  const lines = [
    { ok: !!gate.signed.at, text: gate.signed.at ? C10.gate.signed(gate.signed.at) : C10.gate.notSigned },
  ];
  if (gate.money && gate.money.required) {
    const funded = gate.open;
    lines.push({ ok: funded, text: funded ? C10.gate.locked(gate.money.locked) : C10.gate.notFunded });
    lines.push({ ok: funded, text: funded ? C10.gate.released(gate.money.released, gate.creatorName || '') : C10.gate.notFunded });
  }
  const c = gate.open ? T.state.active : T.state.waiting;
  return (
    <View style={[g.card, { backgroundColor: c.bg }]} testID={testID || 'gate-card'}>
      {lines.map((l, i) => (
        <View key={i} style={g.line} testID={`gate-line-${i}`}>
          <Icon name={l.ok ? 'check' : 'timer-sand'} size={15} color={c.fg} style={g.mark} testID={l.ok ? 'gate-tick' : 'gate-hourglass'} />
          <Text style={[g.text, { color: c.fg }]}>{l.text}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── the step line ─────────────────────────────────────────────────────────── */

/** Four steps: a filled green dot for done, an amber ring for now, an empty ring for later. */
export function StepLine10({ steps, testID }) {
  if (!steps || !steps.length) return null;
  return (
    <View style={g.steps} testID={testID || 'step-line'}>
      {steps.map((st) => (
        <View key={st.key} style={g.step} testID={`step-${st.key}-${st.state}`}>
          <View style={[g.dot, st.state === 'done' ? g.dotDone : st.state === 'now' ? g.dotNow : g.dotLater]}>
            {st.state === 'done' ? <Icon name="check" size={9} color="#FFFFFF" /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[g.stepLabel, st.state === 'later' && { color: T.ink3 }]}>{st.label}</Text>
            {st.detail ? <Text style={g.stepDetail}>{st.detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ── the time card ─────────────────────────────────────────────────────────── */

/**
 * "Sun 19 Oct, 4:00 pm" on solid ink with white text while it is the live agreed time; a grey
 * surface once it is past or historic. `sub` is the second line ("About 2 hours", "Today ·
 * about 2 hours", "Passed", "Visited").
 */
export function TimeCard10({ iso, sub, live = true, testID }) {
  if (!iso) return null;
  return (
    <View style={[g.time, live ? g.timeLive : g.timePast]} testID={testID || 'time-card'}>
      <Text style={[g.timeMain, live ? { color: '#FFFFFF' } : { color: T.ink }]}>{whenLine10(iso)}</Text>
      {sub ? <Text style={[g.timeSub, live ? { color: 'rgba(255,255,255,0.78)' } : { color: T.ink2 }]}>{sub}</Text> : null}
    </View>
  );
}

/* ── the address card ──────────────────────────────────────────────────────── */

/** The branch name, the street address, Open in Maps, and a call button for the contact. */
export function AddressCard10({ branch, contact, testID }) {
  if (!branch) return null;
  const maps = branch.mapsUrl || (branch.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}` : null);
  return (
    <View style={g.addr} testID={testID || 'address-card'}>
      {branch.name ? <Text style={g.addrName}>{branch.name}</Text> : null}
      {branch.address ? <Text style={g.addrText}>{branch.address}</Text> : <Text style={g.addrText}>{branch.city || ''}</Text>}
      <View style={g.addrRow}>
        {maps && branch.address ? (
          <TouchableOpacity style={g.addrBtn} onPress={() => Linking.openURL(maps).catch(() => {})} activeOpacity={0.8} testID="open-in-maps">
            <Icon name="navigation-variant-outline" size={14} color={T.ink} testID="maps-icon" />
            <Text style={g.addrBtnText}>{C10.hers.openInMaps}</Text>
          </TouchableOpacity>
        ) : null}
        {/* The phone symbol is what makes this read as "call Ravi" rather than a name on a button. */}
        {contact && contact.phone ? (
          <TouchableOpacity style={g.addrBtn} onPress={() => Linking.openURL(`tel:${contact.phone}`).catch(() => {})} activeOpacity={0.8} testID="call-contact">
            <Icon name="phone-outline" size={14} color={T.ink} testID="phone-icon" />
            <Text style={g.addrBtnText}>{contact.name || contact.phone}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

/** A plain label/value row for the record card and the locked card. */
export function Row10({ label, value, testID }) {
  if (value == null || value === '') return null;
  return (
    <View style={g.row} testID={testID}>
      <Text style={g.rowLabel}>{label}</Text>
      <Text style={g.rowValue}>{value}</Text>
    </View>
  );
}

/** The Delayed chip — the eighth tone, amber, nothing is lost. */
export function DelayedChip10({ testID }) {
  const c = T.state.delayed || T.state.yourMove;
  return (
    <View style={[g.chip, { backgroundColor: c.bg }]} testID={testID || 'delayed-chip'}>
      <Text style={[g.chipText, { color: c.fg }]}>{C10.brand.delayedChip}</Text>
    </View>
  );
}

/** An amber sentence box — the Delayed family, and the passed-time notice. */
export function AmberBox10({ text, testID }) {
  if (!text) return null;
  const c = T.state.delayed || T.state.yourMove;
  return (
    <View style={[g.box, g.boxRow, { backgroundColor: c.bg }]} testID={testID}>
      <Icon name="alert-circle-outline" size={16} color={c.fg} style={g.boxIcon} />
      <Text style={[g.boxText, { color: c.fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** The blue "waiting" box with its clock (V9). */
export function WaitBox10({ text, testID }) {
  if (!text) return null;
  return (
    <View style={[g.box, g.boxRow, { backgroundColor: T.state.waiting.bg }]} testID={testID}>
      <Icon name="clock-outline" size={16} color={T.state.waiting.fg} style={g.boxIcon} />
      <Text style={[g.boxText, { color: T.state.waiting.fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** The amber "your move" line with its alert (V7, V10). */
export function MoveBox10({ text, testID }) {
  if (!text) return null;
  const c = T.state.yourMove;
  return (
    <View style={[g.box, g.boxRow, { backgroundColor: c.bg }]} testID={testID}>
      <Icon name="alert-circle-outline" size={16} color={c.fg} style={g.boxIcon} />
      <Text style={[g.boxText, { color: c.fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** A green sentence box — done, agreed. */
export function GreenBox10({ text, testID }) {
  if (!text) return null;
  return (
    <View style={[g.box, g.boxRow, { backgroundColor: T.state.active.bg }]} testID={testID}>
      <Icon name="check" size={16} color={T.state.active.fg} style={g.boxIcon} />
      <Text style={[g.boxText, { color: T.state.active.fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/* ── the time picker ───────────────────────────────────────────────────────── */

/** An instant → the day in India and the time on an Indian clock. Nothing in, nothing chosen. */
function halves10(iso) {
  const p = istParts(iso);
  return p ? { day: istDay10(iso), slot: { h: p.h, min: p.min } } : { day: null, slot: null };
}

/**
 * Two boxes side by side, "Date *" and "Time *" (ui-walk-fixes board G, frames G1–G10). Nothing
 * is chosen for her: both read grey until tapped. Date opens the app's calendar, open from today
 * in India to the posting day (never after it — the error is made impossible rather than
 * explained). Time opens one list of 15-minute times; on today's date the times already gone
 * are grey. Everything is an Indian clock reading; `value` in and out is an ISO instant.
 *
 * What the parent is told (`onChange`):
 *   · nothing while only one box is filled — a day without a time is not a moment, so the
 *     half-finished choice is held here, privately;
 *   · the instant, once both are filled, and again each time either changes;
 *   · `null`, in the one case where a whole choice stops being one: the date is changed and the
 *     time kept beside it has already gone on that day. The time is cleared, the box goes back to
 *     "Choose a time", and the parent must not go on holding the old moment.
 * When the PARENT changes `value` — to another moment, or back to null — the boxes follow it and
 * the private half is dropped.
 *
 * Starting again (`resetKey`, optional): a parent that holds null while only one box is filled
 * cannot start the picker again by handing it null a second time — nothing has changed, so
 * nothing is told. It changes `resetKey` instead (any value; a counter is the usual one): the
 * boxes go back to what `value` says and the half-chosen date or time is dropped, whether or not
 * `value` itself moved. The move sheet does this each time it opens. Left out, nothing changes.
 *
 * Optional, all additive: `dateLabel` ("New date" on the move sheet) and `error` — a sentence is
 * printed as the one red line under the pair and the boxes it points at are outlined red (frame
 * G5); `true` outlines the boxes only, for a caller that prints the sentence somewhere else.
 *
 * The Date box puts the keypad away before its calendar opens, as the Time box always has: on
 * the move sheet both sit above a "Say why" box, and the calendar needs the keypad's room.
 */
export function TimePicker10({ value, onChange, maxDay, minDay, testID, dateLabel, error, resetKey }) {
  const v = value || null;
  // `seen` is the last value the parent and this picker agreed on; `sel` is what the boxes show;
  // `turn` is the last `resetKey` acted on.
  const [seen, setSeen] = useState(v);
  const [sel, setSel] = useState(() => halves10(v));
  const [turn, setTurn] = useState(resetKey);
  if (v !== seen || !Object.is(resetKey, turn)) { setSeen(v); setTurn(resetKey); setSel(halves10(v)); }

  const days = openDays10(maxDay, minDay);

  function settle(next) {
    const iso = slotIso10(next.day, next.slot);
    const gone = !!iso && new Date(iso).getTime() <= Date.now();
    const kept = gone ? { day: next.day, slot: null } : next;
    const out = slotIso10(kept.day, kept.slot);
    setSel(kept);
    if (out === seen) return;
    setSeen(out);
    if (onChange) onChange(out);
  }

  // The red outline goes on the box that is empty; with both filled the pair itself is refused
  // (a time in the past, the same time again), so both are outlined.
  const whole = !!(sel.day && sel.slot);
  const red = (filled) => !!error && (!filled || whole);

  return (
    <View testID={testID || 'time-picker'}>
      {days.none ? (
        <Text style={g.pickEmpty} testID="no-day-works">{C10.plan.noDay}</Text>
      ) : (
        <View style={g.pickRow}>
          <View style={g.pickCol}>
            <Text style={g.pickLabel}>{dateLabel || C10.plan.date}<Text style={g.pickStar}> *</Text></Text>
            <DateField value={sel.day} onChange={(day) => settle({ day, slot: sel.slot })} placeholder={C10.plan.chooseDate}
              minDate={days.min} maxDate={days.max} icon="calendar-blank-outline" hideCaret display={day10}
              invalid={red(!!sel.day)} style={g.pickBox} testID="pick-date" closeKeypad />
          </View>
          <View style={g.pickCol}>
            <Text style={g.pickLabel}>{C10.plan.time}<Text style={g.pickStar}> *</Text></Text>
            <TimeField10 value={sel.slot} day={sel.day} onChange={(slot) => settle({ day: sel.day, slot })}
              invalid={red(!!sel.slot)} testID="pick-time" />
          </View>
        </View>
      )}
      <FieldError text={typeof error === 'string' ? error : null} />
    </View>
  );
}

export const g = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginBottom: 12 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  mark: { fontFamily: fonts.sansBold, fontSize: 14, width: 22 },
  text: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, flex: 1 },

  steps: { borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 2, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: T.state.active.fg },
  dotNow: { borderWidth: 2.5, borderColor: T.state.yourMove.fg, backgroundColor: '#FFFFFF' },
  dotLater: { borderWidth: 1.5, borderColor: T.border, backgroundColor: '#FFFFFF' },
  stepLabel: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  stepDetail: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 1 },

  time: { borderRadius: 16, padding: 18, marginBottom: 12 },
  timeLive: { backgroundColor: T.ink },
  timePast: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  timeMain: { fontFamily: fonts.sansBold, fontSize: 20 },
  timeSub: { fontFamily: fonts.sansRegular, fontSize: 13, marginTop: 4 },

  addr: { borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 12, backgroundColor: '#FFFFFF' },
  addrName: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.ink },
  addrText: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 19, marginTop: 3 },
  addrRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  addrBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addrBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  rowLabel: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  rowValue: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', flexShrink: 1, maxWidth: '62%' },

  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  box: { borderRadius: 12, padding: 12, marginBottom: 12 },
  boxRow: { flexDirection: 'row', alignItems: 'flex-start' },
  boxIcon: { marginRight: 8, marginTop: 1 },
  boxText: { fontFamily: fonts.sansSemiBold, fontSize: 13, lineHeight: 19 },

  // The picker (ui-walk-fixes board G): two equal boxes, 8 apart, each under its own label.
  pickRow: { flexDirection: 'row', gap: 8 },
  pickCol: { flex: 1, minWidth: 0 },
  pickLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  pickStar: { color: T.danger },
  pickBox: { marginBottom: 0 },
  pickEmpty: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.danger, lineHeight: 17 },
});
