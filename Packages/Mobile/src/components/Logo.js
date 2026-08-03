// Logo — the INFLX lockup (React Native).
//
// Mirrors Packages/shared/components/Logo.js (web): the vector mark
// beside the "inflx" wordmark. The wordmark is live text rather than a
// baked image, so it stays crisp at every size and `tone` is a pure
// colour swap.
//
// The mark is self-contained — brand yellow with a near-black band — so
// it reads on light and dark surfaces alike; only the wordmark colour
// responds to `tone`. On a yellow surface, pass the mark its inverted
// fills directly via <InflxMark> instead of using this lockup.
//
// PlusJakartaSans-Bold is bundled (android/app/src/main/assets/fonts);
// if it ever fails to resolve, RN falls back to the system face rather
// than erroring.
//
// API: <Logo tone="light|dark" size="sm|md|lg|xl" />

import React from 'react';
import { View, Text } from 'react-native';
import InflxMark from './InflxMark';

// Mark height in px; the wordmark and gap derive from it so the lockup
// scales as one unit.
const SIZE = { sm: 26, md: 34, lg: 42, xl: 64 };

export default function Logo({ tone = 'dark', size = 'md', style }) {
  const markHeight = SIZE[size] || SIZE.md;
  const isLight = tone === 'light';

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="inflx"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'center',
        },
        style,
      ]}
    >
      <InflxMark height={markHeight} />
      <Text
        style={{
          marginLeft: Math.round(markHeight * 0.34),
          fontFamily: 'PlusJakartaSans-Bold',
          fontSize: Math.round(markHeight * 0.82),
          letterSpacing: -0.5,
          includeFontPadding: false,
          color: isLight ? '#FFFFFF' : '#0D1630',
        }}
      >
        inflx
      </Text>
    </View>
  );
}
