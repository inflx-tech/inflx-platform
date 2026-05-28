import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { brandPalette as lightColors, fonts, radius } from '../../theme/tokens';

/**
 * CreatorChip — unified creator-attribution chip.
 *
 * Replaces the three inline variants previously rendered in
 * RestaurantCard, BrandStore booking rows and ProductDetail. Wave 4
 * migrates existing callers to this component; for Wave 3 it just
 * exists so new restaurant screens can adopt it directly.
 *
 * Visual: ink-1 background pill, avatar circle (yellow bg, ink text),
 * "@handle", optional verified ✓ in yellow.
 *
 * Props:
 *   handle   — instagram handle without the @ (we prefix it)
 *   name     — optional display name; shown as "via Name" if no handle
 *   verified — bool, default false → no ✓
 *   avatar   — optional image url for the avatar circle (else initial)
 *   size     — 'sm' | 'md' (default md)
 */

export default function CreatorChip({ handle, name, verified, avatar, size = 'md' }) {
  const initial = (handle || name || '?').charAt(0).toUpperCase();
  const isSm = size === 'sm';
  return (
    <View style={[styles.chip, isSm && styles.chipSm]}>
      <View style={[styles.av, isSm && styles.avSm]}>
        <Text style={[styles.avText, isSm && styles.avTextSm]}>{initial}</Text>
      </View>
      <Text style={[styles.label, isSm && styles.labelSm]}>
        {handle ? `via @${handle}` : `via ${name || 'creator'}`}
      </Text>
      {verified && (
        <Text style={[styles.verified, isSm && styles.verifiedSm]}>✓</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.ink,
    borderRadius: 999,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 10,
    gap: 6,
    alignSelf: 'flex-start',
  },
  chipSm: { paddingRight: 8, gap: 5 },
  av: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: lightColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avSm: { width: 18, height: 18, borderRadius: 9 },
  avText: {
    fontFamily: fonts.displayBlack,
    fontSize: 11,
    color: lightColors.ink,
  },
  avTextSm: { fontSize: 9 },
  label: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    color: lightColors.white,
  },
  labelSm: { fontSize: 11 },
  verified: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: lightColors.yellow,
    marginLeft: 2,
  },
  verifiedSm: { fontSize: 10 },
});
