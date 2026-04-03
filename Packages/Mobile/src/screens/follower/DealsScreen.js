import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import OfferCard from '../../components/OfferCard';
import CategoryPills from '../../components/CategoryPills';

export default function DealsScreen({ navigation, route }) {
  const initialCategory = route?.params?.category || 'all';
  const [category, setCategory] = useState(initialCategory);
  const [deals, setDeals] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeals = useCallback(async (cat, pageNum = 1) => {
    try {
      const res = await followerApi.getDeals(cat, pageNum);
      const data = res.data || res;
      setDeals(data.deals || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (e) {
      console.error('[DealsScreen] Error:', e.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDeals(category).finally(() => setLoading(false));
  }, [category, fetchDeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeals(category);
    setRefreshing(false);
  }, [category, fetchDeals]);

  const handleCategoryChange = useCallback((cat) => {
    setCategory(cat);
    setDeals([]);
  }, []);

  const handleCTA = useCallback((item, mode) => {
    const params = {
      offer: item.offer,
      brand: item.brand,
      tracking: item.tracking,
      influencer: item.influencer,
      product: item.product,
    };
    switch (mode) {
      case 'pay_at_store': navigation.navigate('PayAtStore', params); break;
      case 'prebook': navigation.navigate('PreBook', params); break;
      case 'enquiry': navigation.navigate('Enquiry', params); break;
      default: navigation.navigate('ProductDetail', params);
    }
  }, [navigation]);

  const handleSave = useCallback(async (item) => {
    try {
      if (item.is_saved) {
        await followerApi.unsaveOffer(item.offer.id);
      } else {
        await followerApi.saveOffer(item.offer.id, item.influencer?.id);
      }
      setDeals(prev => prev.map(d =>
        d.offer?.id === item.offer?.id && d.influencer?.id === item.influencer?.id
          ? { ...d, is_saved: !d.is_saved } : d
      ));
    } catch (e) {
      console.error('[DealsScreen] Save error:', e.message);
    }
  }, []);

  const renderItem = useCallback(({ item }) => (
    <OfferCard
      brand={item.brand}
      offer={item.offer}
      product={item.product}
      influencer={item.influencer}
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
    />
  ), [handleCTA, handleSave, navigation]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Deals</Text>
      </View>

      <CategoryPills selected={category} onSelect={handleCategoryChange} />

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.orange} /></View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item, idx) => `${item.offer?.id}_${item.influencer?.id}_${idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orange]} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🏷️</Text>
              <Text style={s.emptyTitle}>No deals found</Text>
              <Text style={s.emptyText}>Try a different category or check back later.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5EEE6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.sm,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.t1 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptyText: { fontSize: 12, color: colors.t3, textAlign: 'center' },
});
