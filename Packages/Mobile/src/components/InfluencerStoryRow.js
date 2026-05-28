import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { brandPalette as P, fonts } from '../theme/tokens';

/**
 * InfluencerStoryRow — horizontal scroll of influencer story circles.
 *
 * Flow 38 (F0) restyle (2026-05-27): light brandPalette. Yellow story rings
 * (the creator-vibe signature) + ink avatar with yellow initial. Ring states:
 *   - 'pulse' / 'ring' = yellow ring (active / followed)
 *   - 'grey'           = border ring, dimmed (inactive)
 */

export function InfluencerStoryCircle({ story, onPress }) {
  const { name, avatar_initial, active_deals, ring_state } = story;

  const ringStyle = ring_state === 'grey'
    ? { backgroundColor: P.border }
    : { backgroundColor: P.yellow };

  return (
    <TouchableOpacity style={styles.circleContainer} onPress={onPress}>
      <View style={[styles.avatarOuter, ringStyle]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatar_initial || name?.[0] || '?'}</Text>
        </View>
        {active_deals > 0 && ring_state === 'pulse' && (
          <View style={styles.dealBadge}>
            <Text style={styles.dealBadgeText}>{active_deals}</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
}

export function DiscoverMoreCircle({ onPress }) {
  return (
    <TouchableOpacity style={styles.circleContainer} onPress={onPress}>
      <View style={styles.addOuter}>
        <Text style={styles.addIcon}>+</Text>
      </View>
      <Text style={[styles.name, { color: P.muted2 }]}>More</Text>
    </TouchableOpacity>
  );
}

export default function InfluencerStoryRow({ stories, onPressStory, onPressMore }) {
  if (!stories || stories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {stories.map(story => (
        <InfluencerStoryCircle
          key={story.id}
          story={story}
          onPress={() => onPressStory?.(story)}
        />
      ))}
      <DiscoverMoreCircle onPress={onPressMore} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  circleContainer: { alignItems: 'center', gap: 5, width: 60 },
  avatarOuter: {
    width: 58,
    height: 58,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.5,
  },
  avatar: {
    width: 53,
    height: 53,
    borderRadius: 27,
    backgroundColor: P.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: P.white,
  },
  avatarText: { fontSize: 18, fontWeight: '900', color: P.yellow, fontFamily: fonts.displayBlack },
  dealBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: P.ink,
    borderWidth: 2,
    borderColor: P.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dealBadgeText: { fontSize: 7.5, fontWeight: '900', color: P.yellow, fontFamily: fonts.monoBold },
  name: {
    fontSize: 8.5,
    color: P.muted,
    textAlign: 'center',
    maxWidth: 60,
    fontWeight: '700',
    fontFamily: fonts.monoMedium,
  },
  addOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: P.muted3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.bg2,
  },
  addIcon: { fontSize: 20, color: P.muted },
});
