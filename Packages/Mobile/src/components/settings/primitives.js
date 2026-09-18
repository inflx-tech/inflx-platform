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
 * All RN core — nothing native, so it ships over the air.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';

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

export function PrimaryButton({ label, onPress, disabled, busy, busyLabel, testID }) {
  const off = disabled || busy;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      style={[st.primary, off && st.primaryOff]}
    >
      {busy ? (
        <View style={st.busyRow}>
          <ActivityIndicator color={T.ink} />
          <Text style={[st.primaryText, { marginLeft: 8 }]}>{busyLabel || 'Saving'}</Text>
        </View>
      ) : (
        <Text style={[st.primaryText, off && st.primaryTextOff]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, testID }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.85} style={st.secondary}>
      <Text style={st.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

// Item 10 (approval §2.2): `busy` used to be accepted and dropped, so the four confirm sheets
// that pass it — decline, withdraw, reject, withdraw pitch — stayed tappable mid-request and a
// second tap could fire a second decline. Same contract as PrimaryButton now: busy disables
// the button and shows the spinner; two taps make one request.
export function DangerButton({ label, onPress, disabled, busy, busyLabel, testID }) {
  const off = disabled || busy;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      style={[st.dangerBtn, off && { opacity: 0.6 }]}
    >
      {busy ? (
        <View style={st.busyRow}>
          <ActivityIndicator color={T.danger} />
          <Text style={[st.dangerText, { marginLeft: 8 }]}>{busyLabel || 'Working'}</Text>
        </View>
      ) : (
        <Text style={st.dangerText}>{label}</Text>
      )}
    </TouchableOpacity>
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
  dangerBtn: { backgroundColor: T.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  dangerText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#FFFFFF' },
  status: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  emptyBody: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink3, textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
