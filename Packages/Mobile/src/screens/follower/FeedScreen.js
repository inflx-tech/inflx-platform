import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Linking } from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function FeedScreen({ navigation }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await followerApi.getFeed();
    setLoading(false);
    if (res.success) setFeed(res.data?.offers || res.data || []);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deals Near You 📍</Text>
        <Text style={styles.headerSub}>From influencers you follow</Text>
      </View>

      {loading ? (
        <Text style={{ textAlign: 'center', color: colors.t3, marginTop: 40 }}>Loading feed...</Text>
      ) : feed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
          <Text style={styles.emptyTitle}>No deals yet</Text>
          <Text style={styles.emptySub}>Follow influencers to see their deals here</Text>
        </View>
      ) : (
        feed.map((offer, i) => (
          <TouchableOpacity
            key={offer.id || i}
            style={styles.dealCard}
            onPress={() => navigation.navigate('Store', { handle: offer.influencer_handle })}
          >
            {/* Influencer strip */}
            <View style={styles.influencerStrip}>
              <View style={styles.influencerAvatar}>
                <Text style={styles.avatarText}>{(offer.influencer_handle || '').slice(0, 2).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.influencerName}>@{offer.influencer_handle}</Text>
                <Text style={styles.influencerSub}>{offer.brand_name}</Text>
              </View>
            </View>

            {/* Offer */}
            <Text style={styles.offerTitle}>{offer.title || offer.offer_type}</Text>
            {offer.discount_pct ? (
              <Text style={styles.discount}>{offer.discount_pct}% OFF</Text>
            ) : null}

            <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('Store', { handle: offer.influencer_handle })}>
              <Text style={styles.ctaText}>View Deal →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.navyDeep, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.t3, textAlign: 'center' },
  dealCard: { backgroundColor: colors.white, margin: 16, marginBottom: 0, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  influencerStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  influencerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.orangePale, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: colors.orangeDeep },
  influencerName: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  influencerSub: { fontSize: 11, color: colors.t3 },
  offerTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  discount: { fontSize: 22, fontWeight: '800', color: colors.orange, marginBottom: 12 },
  ctaBtn: { backgroundColor: colors.navyDeep, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  ctaText: { fontSize: 13, fontWeight: '700', color: colors.white },
});
