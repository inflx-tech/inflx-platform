import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import OfferCard from '../../components/OfferCard';
import CategoryPills from '../../components/CategoryPills';

export default function HomeScreen({ navigation }) {
  const [feed, setFeed] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await followerApi.getHomeFeed(pageNum);
      const data = res.data || res;
      const items = data.feed || [];
      setFeed(prev => append ? [...prev, ...items] : items);
      setTotal(data.total || 0);
      setPage(pageNum);
      setError(null);
    } catch (e) {
      console.error('[HomeScreen] Feed error:', e.message);
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchFeed(1).finally(() => setLoading(false));
  }, [fetchFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed(1);
    setRefreshing(false);
  }, [fetchFeed]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || feed.length >= total) return;
    setLoadingMore(true);
    await fetchFeed(page + 1, true);
    setLoadingMore(false);
  }, [loadingMore, feed.length, total, page, fetchFeed]);

  const handleCTA = useCallback((item, mode) => {
    const params = {
      offer: item.offer,
      brand: item.brand,
      tracking: item.tracking,
      influencer: item.influencer,
      product: item.product,
    };
    switch (mode) {
      case 'pay_at_store':
        navigation.navigate('PayAtStore', params);
        break;
      case 'prebook':
        navigation.navigate('PreBook', params);
        break;
      case 'online_order':
        navigation.navigate('ProductDetail', params);
        break;
      case 'enquiry':
        navigation.navigate('Enquiry', params);
        break;
      default:
        navigation.navigate('ProductDetail', params);
    }
  }, [navigation]);

  const handleSave = useCallback(async (item) => {
    try {
      if (item.is_saved) {
        await followerApi.unsaveOffer(item.offer.id);
      } else {
        await followerApi.saveOffer(item.offer.id, item.influencer?.id);
      }
      // Toggle locally
      setFeed(prev => prev.map(f =>
        f.offer?.id === item.offer?.id ? { ...f, is_saved: !f.is_saved } : f
      ));
    } catch (e) {
      console.error('[HomeScreen] Save error:', e.message);
    }
  }, []);

  const renderItem = useCallback(({ item }) => (
    <OfferCard
      brand={item.brand}
      offer={item.offer}
      product={item.product}
      influencer={item.influencer}
      influencer_count={item.influencer_count}
      tracking={item.tracking}
      isSaved={item.is_saved}
      onSave={() => handleSave(item)}
      onPressCTA={(mode) => handleCTA(item, mode)}
      onPressInfluencer={() => {
        if (item.influencer?.handle) {
          navigation.navigate('InfluencerStore', { handle: item.influencer.handle });
        }
      }}
      onPressBrand={() => {
        if (item.brand?.id) {
          navigation.navigate('BrandStore', { brandId: item.brand.id, brandName: item.brand.name });
        }
      }}
      onPressCard={() => {
        navigation.navigate('ProductDetail', {
          offer: item.offer,
          brand: item.brand,
          tracking: item.tracking,
          influencer: item.influencer,
          product: item.product,
        });
      }}
    />
  ), [handleCTA, handleSave, navigation]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>INFLX</Text>
          <Text style={s.headerSub}>Deals near you</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={s.notifBtn}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item, idx) => `${item.offer?.id}_${item.influencer?.id}_${idx}`}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orange]} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            {error && (
              <View style={s.errorBanner}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🛒</Text>
            <Text style={s.emptyTitle}>No deals yet</Text>
            <Text style={s.emptyText}>Follow influencers to see their deals here, or browse the Deals tab.</Text>
          </View>
        }
        ListFooterComponent={loadingMore ? (
          <ActivityIndicator size="small" color={colors.orange} style={{ marginVertical: 20 }} />
        ) : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5EEE6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5EEE6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.orange },
  headerSub: { fontSize: 12, color: colors.t3 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  errorBanner: {
    backgroundColor: colors.redPale,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.red, fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  emptyText: { fontSize: 13, color: colors.t3, textAlign: 'center', paddingHorizontal: 40 },
});
