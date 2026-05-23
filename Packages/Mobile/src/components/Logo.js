// Logo — INFLX brand placeholder (React Native).
//
// Mirrors Packages/shared/components/Logo.js (web). Renders a dashed
// [LOGO] placeholder until the founder uploads the real artwork.
//
// Swap to real asset:
//   1. Drop the PNG at Packages/Mobile/src/assets/logo/inflx-logo.png
//   2. Set HAS_ASSET = true; the component renders <Image> instead.
//   3. No call-site changes anywhere.
//
// API: <Logo tone="light|dark" size="sm|md|lg" />

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const HAS_ASSET = false;

const SIZE = {
  sm: { minWidth: 130, padH: 16, padV: 10, fontSize: 12 },
  md: { minWidth: 170, padH: 28, padV: 16, fontSize: 14 },
  lg: { minWidth: 220, padH: 36, padV: 18, fontSize: 16 },
};

export default function Logo({ tone = 'dark', size = 'md', style }) {
  const s = SIZE[size] || SIZE.md;
  const isLight = tone === 'light';

  if (HAS_ASSET) {
    // When the asset lands we'll swap to <Image source={require(...)}/>
    // For now this branch is unreachable — kept for the future swap.
    return null;
  }

  const wrap = {
    minWidth: s.minWidth,
    paddingHorizontal: s.padH,
    paddingVertical: s.padV,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: isLight ? 'rgba(255,255,255,0.22)' : '#D4D4D8',
    borderRadius: 10,
    backgroundColor: isLight ? 'rgba(255,255,255,0.04)' : '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  };

  const label = {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: s.fontSize,
    letterSpacing: 2.5,
    color: isLight ? 'rgba(255,255,255,0.7)' : '#71717A',
  };

  return (
    <View
      accessible
      accessibilityLabel="inflx logo placeholder — upload to replace"
      accessibilityRole="image"
      style={[wrap, style]}
    >
      <Text style={label}>LOGO</Text>
    </View>
  );
}
