import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { brandPalette as lightColors, fonts } from '../../theme/tokens';

/**
 * FilterChip — tap-to-toggle chip used by browse/filter sheets.
 *
 * Two states:
 *   - unselected: white bg, line-soft border, ink2 text
 *   - selected:   ink bg, white text (matches mockup "ink-on-selected"
 *                 chip pattern, not yellow — yellow is reserved for
 *                 primary CTAs)
 *
 * Props:
 *   label    — chip text
 *   selected — bool
 *   onPress  — callback
 *   icon     — optional leading glyph
 *   count    — optional trailing count badge ("Biryani (5)")
 */

export default function FilterChip({ label, selected, onPress, icon, count }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipDefault,
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon && (
        <Text style={[styles.icon, selected && styles.iconSelected]}>{icon}</Text>
      )}
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
        {count != null && <Text style={styles.count}> ({count})</Text>}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  chipDefault: {
    backgroundColor: lightColors.white,
    borderColor: lightColors.muted4,
  },
  chipSelected: {
    backgroundColor: lightColors.ink,
    borderColor: lightColors.ink,
  },
  icon: { fontSize: 12, color: lightColors.ink2 },
  iconSelected: { color: lightColors.white },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: lightColors.ink2,
  },
  labelSelected: { color: lightColors.white },
  count: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    opacity: 0.7,
  },
});
