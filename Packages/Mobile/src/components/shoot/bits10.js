/**
 * Item 10 — the pieces the store-visit screens are built from: the gate card (ticks or
 * hourglasses), the four-step line, the time card (solid ink when live, grey when past), the
 * address card with Maps and call, the record rows, and a pure-JS time picker capped by the
 * posting date. Contract: features/item10-store-visit · mockups V1–V15 · prompt §8
 *
 * The picker is JavaScript on purpose (founder Q8): the native picker is in the binary, but the
 * Stage-4 guard test refuses it in shoot files, and that guard now enforces a decision.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Card7 } from '../agreement/bits7';
import { C10, istParts, dayParts, istToIso, clock10, day10, whenLine10, todayIst10 } from './copy10';

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
          <Text style={[g.mark, { color: c.fg }]}>{l.ok ? '✓' : '⧗'}</Text>
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
          <View style={[g.dot, st.state === 'done' ? g.dotDone : st.state === 'now' ? g.dotNow : g.dotLater]} />
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
            <Text style={g.addrBtnText}>{C10.hers.openInMaps}</Text>
          </TouchableOpacity>
        ) : null}
        {contact && contact.phone ? (
          <TouchableOpacity style={g.addrBtn} onPress={() => Linking.openURL(`tel:${contact.phone}`).catch(() => {})} activeOpacity={0.8} testID="call-contact">
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
    <View style={[g.box, { backgroundColor: c.bg }]} testID={testID}>
      <Text style={[g.boxText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

/** A green sentence box — done, agreed. */
export function GreenBox10({ text, testID }) {
  if (!text) return null;
  return (
    <View style={[g.box, { backgroundColor: T.state.active.bg }]} testID={testID}>
      <Text style={[g.boxText, { color: T.state.active.fg }]}>{text}</Text>
    </View>
  );
}

/* ── the time picker ───────────────────────────────────────────────────────── */

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);     // 7 am … 8 pm
const MINUTES = [0, 15, 30, 45];
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * A date strip from today to the posting day (never after it — the error is made impossible
 * rather than explained), then hour and minute chips in 15-minute steps. Everything is an Indian
 * clock reading; `value` in and out is an ISO instant.
 */
export function TimePicker10({ value, onChange, maxDay, minDay, testID }) {
  const start = dayParts(minDay || todayIst10());
  const end = dayParts(maxDay) || start;
  const days = useMemo(() => {
    const out = [];
    if (!start) return out;
    const cursor = new Date(Date.UTC(start.y, start.m, start.d));
    const last = end ? Date.UTC(end.y, end.m, end.d) : cursor.getTime() + 29 * 86400000;
    for (let i = 0; i < 60 && cursor.getTime() <= last; i++) {
      out.push({ y: cursor.getUTCFullYear(), m: cursor.getUTCMonth(), d: cursor.getUTCDate(), wd: cursor.getUTCDay() });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
  }, [start && start.y, start && start.m, start && start.d, end && end.y, end && end.m, end && end.d]);
  const sel = istParts(value) || (days[0] ? { ...days[0], h: 11, min: 0 } : null);
  const same = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;
  const emit = (p) => onChange && onChange(istToIso(p.y, p.m, p.d, p.h, p.min));

  return (
    <View testID={testID || 'time-picker'}>
      <Text style={g.pickHd}>{C10.plan.date}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.strip}>
        {days.map((d) => {
          const on = same(d, sel);
          return (
            <TouchableOpacity key={`${d.y}-${d.m}-${d.d}`} style={[g.dayChip, on && g.chipOn]} onPress={() => emit({ ...d, h: sel ? sel.h : 11, min: sel ? sel.min : 0 })} testID={`day-${d.d}`}>
              <Text style={[g.dayWd, on && g.chipOnText]}>{WD[d.wd]}</Text>
              <Text style={[g.dayNum, on && g.chipOnText]}>{d.d}</Text>
              <Text style={[g.dayMon, on && g.chipOnText]}>{MON[d.m]}</Text>
            </TouchableOpacity>
          );
        })}
        {!days.length ? <Text style={g.pickEmpty}>No day works — the posting date has passed.</Text> : null}
      </ScrollView>
      <Text style={g.pickHd}>{C10.plan.time}</Text>
      <View style={g.wrap}>
        {HOURS.map((h) => {
          const on = sel && sel.h === h;
          return (
            <TouchableOpacity key={h} style={[g.tChip, on && g.chipOn]} onPress={() => sel && emit({ ...sel, h })} testID={`hour-${h}`}>
              <Text style={[g.tText, on && g.chipOnText]}>{`${h % 12 || 12} ${h >= 12 ? 'pm' : 'am'}`}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[g.wrap, { marginTop: 6 }]}>
        {MINUTES.map((m) => {
          const on = sel && sel.min === m;
          return (
            <TouchableOpacity key={m} style={[g.tChip, on && g.chipOn]} onPress={() => sel && emit({ ...sel, min: m })} testID={`minute-${m}`}>
              <Text style={[g.tText, on && g.chipOnText]}>{`:${String(m).padStart(2, '0')}`}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {sel ? <Text style={g.pickSummary} testID="picked-time">{whenLine10(istToIso(sel.y, sel.m, sel.d, sel.h, sel.min))}</Text> : null}
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
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3, marginRight: 12 },
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
  addrBtn: { borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addrBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  rowLabel: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  rowValue: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', flexShrink: 1, maxWidth: '62%' },

  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  box: { borderRadius: 12, padding: 12, marginBottom: 12 },
  boxText: { fontFamily: fonts.sansSemiBold, fontSize: 13, lineHeight: 19 },

  pickHd: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginTop: 10, marginBottom: 6 },
  strip: { gap: 6, paddingVertical: 2 },
  dayChip: { minWidth: 56, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: '#FFFFFF', alignItems: 'center' },
  dayWd: { fontFamily: fonts.monoMedium, fontSize: 9, color: T.ink3, letterSpacing: 0.5 },
  dayNum: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginTop: 1 },
  dayMon: { fontFamily: fonts.monoMedium, fontSize: 9, color: T.ink3, letterSpacing: 0.5, marginTop: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: T.border, backgroundColor: '#FFFFFF' },
  tText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2 },
  chipOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipOnText: { color: '#FFFFFF' },
  pickSummary: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink, marginTop: 10 },
  pickEmpty: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.danger, padding: 8 },
});
