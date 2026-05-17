import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightColors, fonts } from '../../theme/tokens';

/**
 * StatusPill — mono-uppercase status indicator with leading dot.
 *
 * Used for restaurant Open/Closed, booking Pending/Confirmed/Cancelled,
 * order tracking states, and the BookingsInbox row badges. Always
 * a leading 6×6 dot in the variant color.
 *
 * Variants:
 *   open       — teal (success): "Open till 11 PM"
 *   closed     — muted: "Closed"
 *   pending    — warning yellow: "Pending"
 *   confirmed  — teal: "Confirmed"
 *   cancelled  — danger red: "Cancelled"
 *   live       — primary yellow: "Live"
 *
 * Props:
 *   variant — one of the keys above. Default 'pending'.
 *   label   — text content (uppercased automatically).
 *   size    — 'sm' | 'md', default sm.
 */

const PALETTE = {
  open:      { bg: lightColors.success50, fg: '#065F46',          dot: lightColors.success, border: '#6EE7B7' },
  closed:    { bg: lightColors.surface,   fg: lightColors.muted,  dot: lightColors.muted2,  border: lightColors.border },
  pending:   { bg: lightColors.warning50, fg: '#92400E',          dot: lightColors.warning, border: lightColors.warning },
  confirmed: { bg: lightColors.success50, fg: '#065F46',          dot: lightColors.success, border: '#6EE7B7' },
  cancelled: { bg: lightColors.danger50,  fg: lightColors.danger, dot: lightColors.danger,  border: lightColors.danger },
  live:      { bg: lightColors.yellow50,  fg: lightColors.ink,    dot: lightColors.yellow,  border: lightColors.yellow200 },
};

export default function StatusPill({ variant = 'pending', label, size = 'sm' }) {
  const p = PALETTE[variant] || PALETTE.pending;
  const isSm = size === 'sm';

  return (
    <View style={[
      styles.pill,
      isSm ? styles.pillSm : styles.pillMd,
      { backgroundColor: p.bg, borderColor: p.border },
    ]}>
      <View style={[styles.dot, { backgroundColor: p.dot }]} />
      <Text style={[
        styles.label,
        isSm ? styles.labelSm : styles.labelMd,
        { color: p.fg },
      ]}>
        {String(label || variant).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 5,
  },
  pillSm: { paddingHorizontal: 8,  paddingVertical: 2.5 },
  pillMd: { paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontFamily: fonts.monoBold,
    letterSpacing: 0.5,
  },
  labelSm: { fontSize: 9 },
  labelMd: { fontSize: 11 },
});
