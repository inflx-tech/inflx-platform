import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import Gradient from './Gradient';
import { RING } from './palette';

/**
 * StoryCircle / StoryRail — the creator-vibe story row: a coral→amber gradient
 * ring around a round avatar (real photo, else initial), the @handle, and a
 * "● LIVE" tag when the creator has a live deal. Matches `.st`/`.ring`/`.avl` in
 * the comprehensive mockups. Replaces the old yellow-ring InfluencerStoryRow.
 *
 * Item shape (section-engine creator): { id, handle, name, avatar, has_live_deal }.
 */

export function StoryCircle({ story, onPress }) {
  if (!story) return null;
  const { handle, name, avatar, has_live_deal } = story;
  const label = handle ? `@${handle}` : name;
  return (
    <TouchableOpacity style={styles.st} onPress={onPress} activeOpacity={0.85}>
      <Gradient colors={RING} direction="diagonal" style={styles.ring}>
        <View style={styles.avatar}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatarImg} />
                  : <Text style={styles.avatarTxt}>{(name || handle || '?')[0]}</Text>}
        </View>
      </Gradient>
      <Text style={styles.name} numberOfLines={1}>{label}</Text>
      {has_live_deal ? <Text style={styles.live}>● LIVE</Text> : null}
    </TouchableOpacity>
  );
}

function MoreCircle({ onPress }) {
  return (
    <TouchableOpacity style={styles.st} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.more}><Text style={styles.moreIcon}>+</Text></View>
      <Text style={[styles.name, { color: C.muted }]}>More</Text>
    </TouchableOpacity>
  );
}

export function StoryRail({ items, onPressStory, onPressMore }) {
  if (!items || items.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {items.map((s, i) => (
        <StoryCircle key={s.id || s.handle || i} story={s} onPress={() => onPressStory?.(s)} />
      ))}
      {onPressMore && <MoreCircle onPress={onPressMore} />}
    </ScrollView>
  );
}

export default StoryCircle;

const RING_SIZE = 67;
const AV = 62;

const styles = StyleSheet.create({
  rail: { paddingHorizontal: 16, paddingBottom: 4, gap: 14 },
  st: { width: 72, alignItems: 'center', gap: 7 },
  ring: {
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: AV, height: AV, borderRadius: AV / 2, overflow: 'hidden',
    backgroundColor: '#ECDFC9', borderWidth: 3, borderColor: C.screenBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { fontSize: 24, fontWeight: '800', color: C.brownDark, fontFamily: fonts.displayBlack },
  name: { fontSize: 10.5, fontWeight: '700', color: C.ink, textAlign: 'center', fontFamily: fonts.sansBold },
  live: { fontSize: 8, fontWeight: '800', color: C.offer, fontFamily: fonts.monoBold },
  more: {
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.muted,
    backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center',
  },
  moreIcon: { fontSize: 22, color: C.muted },
});
