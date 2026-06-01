import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { creatorVibe as Cv, spacing, radius } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim. Legacy navy/teal `colors` → creatorVibe.
// Visual only; follow-list fetch/unfollow + nav unchanged.
const colors = {
  navy: Cv.brown, navyDeep: Cv.brownDark, navyMid: Cv.brown, navyPale: Cv.soft,
  orange: Cv.brown, orangeDeep: Cv.brownDark, orangePale: Cv.soft,
  gold: Cv.star, goldPale: Cv.soft, teal: Cv.brown, tealDeep: Cv.brown, tealPale: Cv.soft,
  red: Cv.offer, redPale: Cv.soft, purple: Cv.brown, purplePale: Cv.soft,
  bg: Cv.screenBg, surface: Cv.card, surface2: Cv.soft, border: Cv.line, border2: Cv.line,
  t1: Cv.ink, t2: Cv.muted, t3: Cv.muted, white: Cv.card, black: Cv.ink,
};
import { followerApi } from '../../services/api';

export default function FollowedInfluencersScreen({ navigation }) {
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      followerApi.getFollowing()
        .then(res => {
          const data = res.data || res;
          setFollowing(data.following || []);
        })
        .catch(e => console.error('[FollowedInfluencers] Error:', e.message))
        .finally(() => setLoading(false));
    }, [])
  );

  const handleUnfollow = useCallback((influencer) => {
    Alert.alert(
      'Unfollow',
      `Stop following ${influencer.name}? You won't see their deals in your feed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            try {
              await followerApi.unfollow(influencer.id);
              setFollowing(prev => prev.filter(f => f.id !== influencer.id));
            } catch (e) {
              console.error('[Unfollow] Error:', e.message);
            }
          },
        },
      ]
    );
  }, []);

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={s.card}
      onPress={() => navigation.navigate('InfluencerStore', { handle: item.instagram_handle })}
    >
      <View style={s.avatar}>
        <Text style={s.avatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{item.name}</Text>
        <Text style={s.handle}>@{item.instagram_handle} · {item.active_deals || 0} active deals</Text>
      </View>
      <TouchableOpacity style={s.unfollowBtn} onPress={() => handleUnfollow(item)}>
        <Text style={s.unfollowText}>Following</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  ), [navigation, handleUnfollow]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.orange} /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Following</Text>
        <Text style={s.count}>{following.length}</Text>
      </View>

      <FlatList
        data={following}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
            <Text style={s.emptyTitle}>Not following anyone</Text>
            <Text style={s.emptyText}>Follow influencers to get notified of their deals.</Text>
          </View>
        }
      />
    </View>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5EEE6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5EEE6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.t1, flex: 1 },
  count: { fontSize: 14, fontWeight: '700', color: colors.orange },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.orangePale, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.orangeDeep },
  name: { fontSize: 14, fontWeight: '600', color: colors.t1 },
  handle: { fontSize: 11, color: colors.t3, marginTop: 2 },
  unfollowBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border2,
  },
  unfollowText: { fontSize: 11, fontWeight: '600', color: colors.t2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptyText: { fontSize: 12, color: colors.t3, textAlign: 'center', paddingHorizontal: 40 },
});
