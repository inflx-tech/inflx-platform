import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { brandPalette as lightColors, fonts } from '../../theme/tokens';

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
