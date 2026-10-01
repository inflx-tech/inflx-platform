/**
 * Item 17 — the Wallet's small pieces, shared by the brand and creator screens (board BW1–CW7).
 * Contract: features/item17-wallet
 *
 * White and black; colour only where the board has it: green for money that came in, the status
 * tones for a withdrawal's state, the blue wait box for money on hold.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { W17, inr, dayMon } from './copy17';

/** The dark Available card. */
export function Balance17({ label, amount, testID }) {
  return (
    <View style={s.bal} testID={testID}>
      <Text style={s.balLabel}>{label}</Text>
      <Text style={s.balBig} testID={testID ? `${testID}-amount` : undefined}>{inr(amount)}</Text>
    </View>
  );
}

/** A bordered group of figure rows. */
export function Figs17({ children }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={s.figs}>
      {rows.map((c, i) => <View key={i} style={i === rows.length - 1 ? null : s.figLine}>{c}</View>)}
    </View>
  );
}

/** One figure: label, a line under it, the amount, and a chevron when it opens something. */
export function Fig17({ label, sub, value, onPress, testID }) {
  const body = (
    <View style={s.fig}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={s.figLabel}>{label}</Text>
        {sub ? <Text style={s.figSub}>{sub}</Text> : null}
      </View>
      {value != null && value !== '' ? <Text style={s.figValue} testID={testID ? `${testID}-value` : undefined}>{value}</Text> : null}
      {onPress ? <Text style={s.chev}>›</Text> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" testID={testID}>{body}</TouchableOpacity>;
}

/** "You requested ₹20,000 on 1 Oct. It will be processed within 24 hours…" (BW2, CW2). */
export function HoldBox17({ w, testID }) {
  if (!w) return null;
  return (
    <View style={s.wait} testID={testID || 'hold-box'}>
      <Icon name="timer-sand" size={16} color={T.state.waiting.fg} style={{ marginTop: 1 }} />
      <Text style={s.waitText}>
        <Text style={s.waitBold}>{W17.holdBoxBold(inr(w.amount), dayMon(w.requestedAt))}</Text>
        {W17.holdBoxRest(w.processHours)}
      </Text>
    </View>
  );
}

/** A coloured box in one of the status tones. */
export function Box17({ tone = 'waiting', text, testID }) {
  const c = T.state[tone] || T.state.waiting;
  return <View style={[s.box, { backgroundColor: c.bg }]} testID={testID}><Text style={[s.boxText, { color: c.fg }]}>{text}</Text></View>;
}

export function GreyBox17({ text, testID }) {
  return <View style={s.grey} testID={testID}><Text style={s.greyText}>{text}</Text></View>;
}

export function Chip17({ tone = 'waiting', text, testID }) {
  const c = T.state[tone] || T.state.ended;
  return <View style={[s.chip, { backgroundColor: c.bg }]} testID={testID}><Text style={[s.chipText, { color: c.fg }]}>{text}</Text></View>;
}

/** Three small numbers in a row (BW5, CW4). */
export function Stat3({ items }) {
  return (
    <View style={s.sw3}>
      {items.map(([v, l], i) => (
        <View key={l} style={[s.sw3Cell, i > 0 && { marginLeft: 6 }]}>
          <Text style={s.sw3V}>{v}</Text>
          <Text style={s.sw3L}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

/** The filter chips over a list. */
export function Filters17({ options, value, onChange }) {
  return (
    <View style={s.filters}>
      {options.map(([k, l]) => (
        <TouchableOpacity key={k} onPress={() => onChange(k)} activeOpacity={0.8} accessibilityRole="button"
          accessibilityState={{ selected: value === k }} style={[s.fchip, value === k && s.fchipOn]} testID={`filter-${k}`}>
          <Text style={[s.fchipText, value === k && s.fchipTextOn]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** One row of a list of money: what, a line under it, the amount (green when it came in). */
export function MoneyRow17({ title, sub, amount, moneyIn, onPress, last, testID }) {
  const body = (
    <View style={[s.hrow, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={s.hTitle}>{title}</Text>
        {sub ? <Text style={s.hSub}>{sub}</Text> : null}
      </View>
      <Text style={[s.amt, moneyIn && s.amtIn]}>{amount}</Text>
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" testID={testID}>{body}</TouchableOpacity>;
}

/** One of a collaboration's three payments: paid (filled dot), next (ringed dot), later (empty dot). */
export function PayRow17({ state, label, when, amount, testID }) {
  return (
    <View style={s.payrow} testID={testID}>
      <View style={[s.dot, state === 'on' && s.dotOn, state === 'now' && s.dotNow]} />
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={s.payLabel}>{label}</Text>
        <Text style={s.hSub}>{when}</Text>
      </View>
      <Text style={s.payAmt}>{inr(amount)}</Text>
    </View>
  );
}

/** The three payments of one collaboration, with the first unpaid one marked as next. */
export function Payments17({ payments, when }) {
  const next = payments.find((p) => !p.paid && p.status !== 'refunded');
  return (
    <View style={{ marginTop: 6 }}>
      {payments.map((p) => (
        <PayRow17 key={p.n} testID={`pay-${p.n}`} state={p.paid ? 'on' : next && next.n === p.n ? 'now' : ''}
          label={p.label} when={p.status === 'refunded' ? 'Returned to the brand by INFLX' : when(p)} amount={p.amount} />
      ))}
    </View>
  );
}

export const TLine17 = ({ label, value, strong }) => (
  <View style={s.tline}><Text style={[s.tlineL, strong && s.tlineStrong]}>{label}</Text><Text style={[s.tlineV, strong && s.tlineStrong]}>{value}</Text></View>
);

export const s = StyleSheet.create({
  bal: { borderRadius: 16, backgroundColor: T.ink, padding: 14 },
  balLabel: { fontFamily: fonts.sansRegular, fontSize: 12, color: '#FFFFFF', opacity: 0.75 },
  balBig: { fontFamily: fonts.sansBold, fontSize: 28, color: '#FFFFFF', marginTop: 2 },
  figs: { borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingHorizontal: 12, marginTop: 12 },
  figLine: { borderBottomWidth: 1, borderBottomColor: T.border },
  fig: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  figLabel: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  figSub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 1 },
  figValue: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3, marginLeft: 8 },
  wait: { flexDirection: 'row', backgroundColor: T.state.waiting.bg, borderRadius: 12, padding: 12, marginTop: 12 },
  waitText: { flex: 1, marginLeft: 8, fontFamily: fonts.sansRegular, fontSize: 12.5, lineHeight: 17, color: T.state.waiting.fg },
  waitBold: { fontFamily: fonts.sansBold },
  box: { borderRadius: 12, padding: 12, marginTop: 12 },
  boxText: { fontFamily: fonts.sansRegular, fontSize: 12.5, lineHeight: 17 },
  grey: { backgroundColor: T.surface, borderRadius: 11, padding: 12, marginTop: 12 },
  greyText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 17 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  sw3: { flexDirection: 'row' },
  sw3Cell: { flex: 1, backgroundColor: T.surface, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 9 },
  sw3V: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  sw3L: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: T.ink2, marginTop: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  fchip: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  fchipOn: { backgroundColor: T.ink, borderColor: T.ink },
  fchipText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2 },
  fchipTextOn: { color: '#FFFFFF' },
  hrow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  hTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  hSub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 1, lineHeight: 16 },
  amt: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  amtIn: { color: T.state.active.fg },
  payrow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: T.border, marginRight: 9 },
  dotOn: { backgroundColor: T.ink, borderColor: T.ink },
  dotNow: { borderColor: T.ink },
  payLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  payAmt: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  tline: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  tlineL: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  tlineV: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  tlineStrong: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginTop: 12 },
  cardTint: { backgroundColor: T.surface, borderColor: T.surface },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink, flex: 1, paddingRight: 8 },
  small: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 2, lineHeight: 16 },
  crumbs: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 0.6, color: T.ink3, textTransform: 'uppercase' },
  section: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.7, color: T.ink3, textTransform: 'uppercase', marginTop: 18 },
  nextLine: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: T.border, marginTop: 7, paddingTop: 8 },
  nextText: { flex: 1, marginLeft: 6, fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginTop: 8 },
  title: { fontFamily: fonts.sansBold, fontSize: 22, color: T.ink },
  code: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink, marginTop: 6 },
  note: { backgroundColor: T.surface, borderRadius: 10, padding: 10, marginTop: 8 },
  noteText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 17 },
});
