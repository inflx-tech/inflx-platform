import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native';
import { darkColors } from '../theme/tokens';

/**
 * InfluencerStoryRow — horizontal scroll of influencer story circles.
 *
 * Ring states:
 *   - 'pulse' = pulsing amber ring (new deals since last visit)
 *   - 'ring'  = static amber ring (followed, no new deals)
 *   - 'grey'  = grey ring (followed but inactive)
 */

export function InfluencerStoryCircle({ story, onPress }) {
  const { name, avatar_initial, active_deals, ring_state } = story;

  const ringStyle = ring_state === 'pulse'
    ? { borderColor: darkColors.amber, borderWidth: 2.5 }
    : ring_state === 'ring'
    ? { borderColor: darkColors.amber, borderWidth: 2 }
    : { borderColor: darkColors.textMuted, borderWidth: 1.5, opacity: 0.6 };

  // Simple gradient-like background using solid color
  const avatarBg = ring_state === 'grey' ? '#475569' : darkColors.amber;

  return (
    <TouchableOpacity style={styles.circleContainer} onPress={onPress}>
      <View style={[styles.avatarOuter, ringStyle]}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
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
      <Text style={[styles.name, { color: darkColors.textMuted }]}>More</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  circleContainer: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  avatarOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  dealBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: darkColors.red,
    borderWidth: 2,
    borderColor: darkColors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealBadgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#fff',
  },
  name: {
    fontSize: 9,
    color: darkColors.textSecondary,
    textAlign: 'center',
    maxWidth: 60,
  },
  addOuter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: darkColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkColors.card,
  },
  addIcon: {
    fontSize: 18,
    color: darkColors.textMuted,
  },
});
