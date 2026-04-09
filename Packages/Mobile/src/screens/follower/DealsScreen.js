import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { darkColors, spacing } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import ProductCard from '../../components/cards/ProductCard';
import NewOfferCard from '../../components/cards/NewOfferCard';
import ServiceCard from '../../components/cards/ServiceCard';

const TABS = [
  { key: 'products', label: '🛍️ Products' },
  { key: 'store_deals', label: '🏪 Store Deals' },
  { key: 'services', label: '✨ Services' },
  { key: 'ending_soon', label: '⏰ Ending Soon' },
];

export default function DealsScreen({ navigation, route }) {
  const initialCategory = route?.params?.category || 'all';
  const [tab, setTab] = useState('products');
  const [deals, setDeals] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeals = useCallback(async (currentTab, pageNum = 1) => {
    try {
      const res = await followerApi.getDeals(currentTab, pageNum);
      const data = res.data || res;
      setDeals(data.deals || []);
      setPage(pageNum);
    } catch (e) {
      console.error('[DealsScreen] Error:', e.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDeals(tab).finally(() => setLoading(false));
  }, [tab, fetchDeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeals(tab);
    setRefreshing(false);
  }, [tab, fetchDeals]);

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
        await followerApi.unsaveOffer(item.offer?.id || item.offer_id);
      } else {
        await followerApi.saveOffer(item.offer?.id || item.offer_id, item.influencer?.id);
      }
      setDeals(prev => prev.map(d =>
        (d.offer?.id || d.offer_id) === (item.offer?.id || item.offer_id)
          ? { ...d, is_saved: !d.is_saved } : d
      ));
    } catch (e) {
      console.error('[DealsScreen] Save error:', e.message);
    }
  }, []);

  const renderProductItem = useCallback(({ item, index }) => (
    <View style={[s.gridItem, index % 2 === 0 && { marginRight: 5 }, index % 2 === 1 && { marginLeft: 5 }]}>
      <ProductCard
        product={item.product || item}
        brand={item.brand || { name: item.brand_name, category: item.brand_category }}
        discount={item.discount || (item.discount_value ? { type: item.offer_type || 'percentage', value: item.discount_value } : null)}
        influencer={item.influencer}
        isSaved={item.is_saved}
        onPressHeart={() => handleSave(item)}
        onPress={() => navigation.navigate('BrandStore', { brandId: item.brand?.id || item.brand_id })}
      />
    </View>
  ), [handleSave, navigation]);

  const renderStoreItem = useCallback(({ item }) => (
    <NewOfferCard
      store={{ name: item.brand?.name || item.brand_name, category: item.brand?.category || item.brand_category, logo_initial: (item.brand?.name || item.brand_name)?.[0] }}
      dealType={item.deal_type || 'shop'}
      dealLabel={item.deal_label || `${item.offer?.discount_value || item.discount_value}% OFF`}
      discountValue={`${item.offer?.discount_value || item.discount_value || 0}%`}
      tags={item.tags || []}
      influencer={item.influencer}
      validTill={item.valid_till}
      onPress={() => navigation.navigate('BrandStore', { brandId: item.brand?.id || item.brand_id })}
    />
  ), [navigation]);

  const renderServiceItem = useCallback(({ item }) => (
    <View style={{ marginHorizontal: 20, marginBottom: 10 }}>
      <ServiceCard
        service={item.product || item}
        businessType={item.brand?.category || item.brand_category}
        location={item.brand?.city || item.brand_city}
        ctaLabel="Book Now"
        priceUnit="onwards"
        discount={item.discount || (item.discount_value ? { type: 'percentage', value: item.discount_value } : null)}
        influencer={item.influencer}
        onPress={() => navigation.navigate('BrandStore', { brandId: item.brand?.id || item.brand_id })}
      />
    </View>
  ), [navigation]);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Deals</Text>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabPill, tab === t.key && s.tabPillActive]}
            onPress={() => { setTab(t.key); setDeals([]); }}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={darkColors.amber} /></View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item, idx) => `${item.offer?.id || item.offer_id}_${idx}`}
          numColumns={tab === 'products' ? 2 : 1}
          key={tab === 'products' ? 'grid' : 'list'}
          renderItem={tab === 'products' ? renderProductItem : tab === 'services' ? renderServiceItem : renderStoreItem}
          contentContainerStyle={{ padding: tab === 'products' ? 20 : 0, paddingTop: 10, paddingBottom: 100, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkColors.amber} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🏷️</Text>
              <Text style={s.emptyTitle}>No deals found</Text>
              <Text style={s.emptyText}>Try a different tab or check back later.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8,
    backgroundColor: darkColors.bg2,
  },
  title: { fontSize: 22, fontWeight: '800', color: darkColors.text },
  tabRow: {
    paddingHorizontal: 20, paddingBottom: 12, gap: 6,
  },
  tabPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: darkColors.border,
  },
  tabPillActive: {
    borderColor: darkColors.amber, backgroundColor: darkColors.amberDim,
  },
  tabText: { fontSize: 11, fontWeight: '600', color: darkColors.textSecondary },
  tabTextActive: { color: darkColors.amber },
  gridItem: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: darkColors.text, marginBottom: 4 },
  emptyText: { fontSize: 12, color: darkColors.textSecondary, textAlign: 'center' },
});
