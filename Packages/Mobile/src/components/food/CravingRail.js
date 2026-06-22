/**
 * CravingRail — the food-home "What's on your mind?" rail.
 *
 * Cleanup 2026-06-22: driven by the Home-Builder category tiles
 * (follower_vertical_categories — the SAME tiles + images as the main home),
 * NOT the retired dish_groups. Pure presentational: parent passes the tiles +
 * the selected key + a toggle handler; tapping filters the page in-place.
 *
 * Props: tiles [{ key, name, image_url, icon }], selectedKey, onPressTile.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';

export default function CravingRail({ tiles = [], selectedKey = null, onPressTile }) {
  if (!tiles.length) return null;
  return (
    <View>
      <Text style={styles.header}>What's on your mind?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {tiles.map((t) => {
          const on = selectedKey === t.key;
          return (
            <Pressable key={t.key} style={styles.tile} onPress={() => onPressTile?.(t)}>
              <View style={[styles.img, on && styles.imgOn]}>
                {t.image_url
                  ? <Image source={{ uri: t.image_url }} style={styles.imgFill} resizeMode="contain" />
                  : <Text style={styles.fallback}>{t.icon || '🍽️'}</Text>}
              </View>
              <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>{t.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.displayBold, fontSize: 16, color: T.ink, letterSpacing: -0.3, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  rail: { gap: 16, paddingHorizontal: 16, paddingBottom: 6 },
  tile: { width: 72, alignItems: 'center' },
  img: { width: 66, height: 66, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imgOn: { borderWidth: 2.5, borderColor: T.yellowDeep },
  imgFill: { width: 66, height: 66 },
  fallback: { fontSize: 40 },
  name: { fontFamily: fonts.sansMedium, fontSize: 11, color: T.ink, marginTop: 6, textAlign: 'center' },
  nameOn: { color: T.yellowDeep, fontFamily: fonts.sansBold },
});
