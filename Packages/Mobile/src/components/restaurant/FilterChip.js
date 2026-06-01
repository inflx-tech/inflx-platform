import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim (restaurant component lib). Visual only.
const lightColors = {
  white: C.card, paper: C.card, bg: C.screenBg, bg2: C.soft, surface: C.soft, surface2: C.line,
  ink: C.ink, ink2: C.ink, muted: C.muted, muted2: C.muted, muted3: C.muted, muted4: C.line,
  border: C.line, borderSoft: C.line, border2: C.line,
  yellow: C.brown, yellowHover: C.brownDark, yellowDeep: C.brownDark, yellowLight: C.star,
  yellowPale: C.soft, yellow50: C.soft, yellow100: C.soft, yellow200: C.soft, yellowText: C.brown,
  success: '#1E9E5A', successPale: C.soft, successText: '#1E9E5A', success50: C.soft, success100: C.soft,
  warning: C.star, warning50: C.soft, warning100: C.soft,
  danger: C.offer, dangerPale: C.soft, dangerText: C.offer, danger50: C.soft,
  star: C.star, black: C.ink,
};

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
