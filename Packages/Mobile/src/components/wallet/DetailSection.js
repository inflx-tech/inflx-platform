/**
 * DetailSection — the "details" list under a wallet's balance card (C7 / B8): a title, an
 * amber note, rows with a label · subtitle · "Added"/"Not added" · chevron, and a footer line.
 * Contract: features/registration-and-profile · spec §5
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';

export const ADDED = 'Added';
export const NOT_ADDED = 'Not added';
export const HAND_CHECK = 'Our team checks these by hand, usually the same day.';

export function DetailRow({ label, sub, value, onPress, testID }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" testID={testID}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      <Text style={[s.value, value === ADDED && s.valueOn]} testID={testID ? `${testID}-value` : undefined}>{value}</Text>
      <Text style={s.chev}>›</Text>
    </TouchableOpacity>
  );
}

export default function DetailSection({ title, noteTitle, noteBody, rows, footer, testID }) {
  return (
    <View style={{ marginTop: 22 }} testID={testID}>
      <Text style={s.title}>{title}</Text>
      <View style={s.note}>
        <Text style={s.noteTitle}>{noteTitle}</Text>
        <Text style={s.noteBody}>{noteBody}</Text>
      </View>
      <View style={s.card}>
        {rows.map((r, i) => (
          <View key={r.key} style={i === rows.length - 1 ? { borderBottomWidth: 0 } : null}>
            <DetailRow {...r} />
          </View>
        ))}
      </View>
      {footer ? <Text style={s.footer}>{footer}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.7, color: T.ink3, textTransform: 'uppercase', marginBottom: 8 },
  note: { backgroundColor: T.state.yourMove.bg, borderRadius: 12, padding: 12, marginBottom: 10 },
  noteTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.state.yourMove.fg },
  noteBody: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.yourMove.fg, marginTop: 2, lineHeight: 17 },
  card: { borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.border },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  value: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.ink3 },
  valueOn: { color: T.state.active.fg },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3, marginLeft: 8 },
  footer: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 10, lineHeight: 17 },
});
