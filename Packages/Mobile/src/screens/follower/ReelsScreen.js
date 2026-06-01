import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { creatorVibe as C, fonts } from '../../theme/tokens';

/**
 * Reels — center tab placeholder (Flow 52.0 Foundation).
 *
 * The real shoppable-reels surface (influencer video feed + reel→product/store
 * deep-link + attribution) is sub-flow 52.8, which needs new backend (video
 * hosting + a reel→entity tag + a feed endpoint) and a native video player.
 * This placeholder keeps the 5-tab nav structurally complete and OTA-shippable
 * until 52.8 lands. Reel RAILS on Category/Creator/Product render real reels
 * where they exist and hide cleanly where they don't, so deferring this screen
 * does not block the repaint flows.
 */
export default function ReelsScreen() {
  return (
    <SafeAreaView style={s.wrap} edges={['top', 'bottom']}>
      <View style={s.center}>
        <Text style={s.icon}>🎬</Text>
        <Text style={s.title}>Reels</Text>
        <Text style={s.sub}>Shoppable creator videos are on the way.</Text>
        <Text style={s.note}>Tap any creator's reels from their store, a category,
          or a product to watch and shop.</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.screenBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  icon: { fontSize: 56, marginBottom: 14 },
  title: { fontFamily: fonts.serifDisplay, fontWeight: '600', fontSize: 26, color: C.ink, marginBottom: 8 },
  sub: { fontFamily: fonts.sansBold, fontSize: 14, color: C.brown, textAlign: 'center', marginBottom: 10 },
  note: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: C.muted, textAlign: 'center', lineHeight: 19 },
});
