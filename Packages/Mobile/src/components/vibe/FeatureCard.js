import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import Gradient from './Gradient';
import ViaCreatorChip from './ViaCreatorChip';
import { gradientFor, emojiFor } from './palette';

/**
 * FeatureCard — the "What's Hot" hero tile: a warm gradient panel with a category
 * chip, a serif title, a "via @creator" pill, and a big bleeding emoji. Matches
 * `.feat` in the comprehensive mockups. Gradient + emoji derive from the brand
 * category (data-driven) unless overridden.
 *
 * Props: title, chip, category, creator { handle,name,avatar }, emoji, onPress.
 */
export default function FeatureCard({ title, chip, category, creator, emoji, onPress }) {
  if (!title) return null;
  const glyph = emoji || emojiFor(category);
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <Gradient colors={gradientFor(category)} direction="diagonal" style={styles.card}>
        {chip ? <View style={styles.chip}><Text style={styles.chipTxt}>{String(chip).toUpperCase()}</Text></View> : <View />}
        <Text style={styles.title} numberOfLines={3}>{title}</Text>
        {creator ? <ViaCreatorChip creator={creator} tone="glass" /> : <View />}
        <Text style={styles.emoji}>{glyph}</Text>
      </Gradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 188, height: 158, borderRadius: 22, padding: 16,
    justifyContent: 'space-between',
  },
  chip: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  chipTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: C.brown, fontFamily: fonts.monoBold },
  title: { fontSize: 19, fontWeight: '600', color: '#2A1D14', lineHeight: 21, maxWidth: 120, fontFamily: fonts.serifDisplay },
  emoji: { position: 'absolute', right: -8, bottom: -10, fontSize: 72, opacity: 0.92 },
});
