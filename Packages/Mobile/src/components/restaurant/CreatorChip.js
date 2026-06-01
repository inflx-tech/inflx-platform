import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts, radius } from '../../theme/tokens';

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
