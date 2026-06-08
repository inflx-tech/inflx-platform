import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';

/**
 * RankBadge — "#1 / #2" overlay driven by the item's REAL position in its shelf
 * (passed by the renderer as rank = index + 1). Top-3 get the brown badge; lower
 * ranks render nothing (badge is a highlight, not a counter). Defensive on bad input.
 *
 * Props: rank (1-based), max (default 3 — ranks above this hide)
 */
export default function RankBadge({ rank, max = 3 }) {
  const r = Number(rank);
  if (!r || r < 1 || r > max) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.txt}>#{r}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: C.brown, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  txt: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3, fontFamily: fonts.monoBold },
});
