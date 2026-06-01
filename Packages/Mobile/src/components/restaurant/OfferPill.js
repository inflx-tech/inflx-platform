import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
 * OfferPill — solid-yellow pill announcing an active offer.
 *
 * Used on restaurant cards + detail screens when the brand has a live
 * campaign offer attached. "FLAT 40% OFF" / "BOGO" / "₹100 OFF ON ₹500"
 * style copy. Mono uppercase font; black text on yellow per spec.
 *
 * Props:
 *   label  — string. Required. Rendered uppercase.
 *   icon   — optional emoji/leading glyph (e.g. "🏷")
 *   variant — 'solid' (default, yellow bg) | 'soft' (yellow50 bg, deep text)
 *   size   — 'sm' | 'md' (default sm — pills are usually small)
 */

export default function OfferPill({ label, icon, variant = 'solid', size = 'sm' }) {
  const isSm = size === 'sm';
  const isSolid = variant === 'solid';

  return (
    <View style={[
      styles.pill,
      isSm ? styles.pillSm : styles.pillMd,
      { backgroundColor: isSolid ? lightColors.yellow : lightColors.yellow50,
        borderColor:    isSolid ? lightColors.yellow : lightColors.yellowPale },
    ]}>
      {icon && (
        <Text style={[
          styles.icon,
          isSm ? styles.iconSm : styles.iconMd,
          { color: isSolid ? lightColors.ink : lightColors.yellowText },
        ]}>
          {icon}
        </Text>
      )}
      <Text style={[
        styles.label,
        isSm ? styles.labelSm : styles.labelMd,
        { color: isSolid ? lightColors.ink : lightColors.yellowText },
      ]}>
        {String(label).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillSm: { paddingHorizontal: 8,  paddingVertical: 3, gap: 4 },
  pillMd: { paddingHorizontal: 12, paddingVertical: 5, gap: 5 },
  icon:   {},
  iconSm: { fontSize: 10 },
  iconMd: { fontSize: 12 },
  label: {
    fontFamily: fonts.monoBold,
    letterSpacing: 0.5,
  },
  labelSm: { fontSize: 10 },
  labelMd: { fontSize: 12 },
});
