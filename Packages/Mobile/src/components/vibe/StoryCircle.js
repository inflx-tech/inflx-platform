import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts, fmtNum } from '../../theme/tokens';
import Gradient from './Gradient';
import { RING } from './palette';

/**
 * StoryCircle / StoryRail — the creator-vibe story row: a coral→amber gradient
 * ring around a round avatar (real photo, else initial), the @handle, a "● LIVE"
 * tag (live deal) or follower count, and an optional "+ Follow" button below for
 * a logged-in follower who doesn't yet follow the creator. Replaces the old
 * yellow-ring InfluencerStoryRow.
 *
 * Item shape (section-engine creator): { id, handle, name, avatar, has_live_deal,
 * followers_count, is_followed }.
 *
 * Props: showFollow (logged-in viewer), onFollow(story) → calls the follow API.
 */

export function StoryCircle({ story, onPress, showFollow, onFollow }) {
  if (!story) return null;
  const { handle, name, avatar, has_live_deal, followers_count } = story;
  const label = handle ? `@${handle}` : name;
  const [followed, setFollowed] = useState(!!story.is_followed);
  // ● LIVE wins; else show follower reach when present (Category creator circles).
  const meta = has_live_deal ? null : (followers_count > 0 ? fmtNum(followers_count) : null);
  const canFollow = showFollow && !followed;

  const doFollow = () => { setFollowed(true); onFollow?.(story); }; // optimistic

  return (
    <View style={styles.st}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.tap}>
        <Gradient colors={RING} direction="diagonal" style={styles.ring}>
          <View style={styles.avatar}>
            {avatar ? <Image source={{ uri: avatar }} style={styles.avatarImg} />
                    : <Text style={styles.avatarTxt}>{(name || handle || '?')[0]}</Text>}
          </View>
        </Gradient>
        <Text style={styles.name} numberOfLines={1}>{label}</Text>
        {has_live_deal ? <Text style={styles.live}>● LIVE</Text> : (meta ? <Text style={styles.meta}>{meta}</Text> : null)}
      </TouchableOpacity>
      {canFollow ? (
        <TouchableOpacity style={styles.followBtn} onPress={doFollow} activeOpacity={0.8}>
          <Text style={styles.followTxt}>+ Follow</Text>
        </TouchableOpacity>
      ) : (showFollow && followed ? (
        <View style={styles.followingPill}><Text style={styles.followingTxt}>Following</Text></View>
      ) : null)}
    </View>
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

export function StoryRail({ items, onPressStory, onPressMore, showFollow, onFollow }) {
  if (!items || items.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {items.map((s, i) => (
        <StoryCircle
          key={s.id || s.handle || i}
          story={s}
          onPress={() => onPressStory?.(s)}
          showFollow={showFollow}
          onFollow={onFollow}
        />
      ))}
      {onPressMore && <MoreCircle onPress={onPressMore} />}
    </ScrollView>
  );
}

export default StoryCircle;

const RING_SIZE = 67;
const AV = 62;

const styles = StyleSheet.create({
  rail: { paddingHorizontal: 16, paddingBottom: 4, gap: 14, alignItems: 'flex-start' },
  st: { width: 72, alignItems: 'center', gap: 6 },
  tap: { width: 72, alignItems: 'center', gap: 7 },
  followBtn: {
    marginTop: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    backgroundColor: C.brown,
  },
  followTxt: { fontSize: 9, fontWeight: '800', color: C.onGold, fontFamily: fonts.monoBold },
  followingPill: {
    marginTop: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: C.soft, borderWidth: 1, borderColor: C.line,
  },
  followingTxt: { fontSize: 9, fontWeight: '800', color: C.muted, fontFamily: fonts.monoBold },
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
  meta: { fontSize: 9, fontWeight: '700', color: C.muted, fontFamily: fonts.monoMedium },
  more: {
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.muted,
    backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center',
  },
  moreIcon: { fontSize: 22, color: C.muted },
});
