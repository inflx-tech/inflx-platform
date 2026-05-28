import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { brandPalette as P, fonts, spacing } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import ProductCard from '../../components/cards/ProductCard';
import { buildTracking } from '../../utils/tracking';

/**
 * DealsScreen — single-feed deals browser with brand-category tabs.
 *
 * Previous version had four content-type tabs (products / store_deals /
 * services / ending_soon) that didn't match what the backend understood.
 * Backend `category` param is a brand-category bucket (dining / shopping /
 * booking) per CATEGORY_MAP in follower.service.js. Frontend was passing
 * the tab key as category → backend treated it as undefined → all tabs
 * returned the same data, rendered with different (mostly mis-shaped)
 * card components. Confusing for the user.
 *
 * This version aligns the tabs with the backend's actual category buckets:
 *   • All       — no filter
 *   • Dining    — restaurant / bakery
 *   • Shopping  — fashion / florist / packaged_food
 *   • Booking   — salon / car_rental / function_hall / wedding_planner
 *
 * Card type is uniform (ProductCard). Card tap routes to ProductDetail for
 * non-car_rental, CarDetail for car_rental — matching the rest of the
 * follower app (HomeScreenV2 + InfluencerStoreScreen + CategoryListScreen).
 */

const TABS = [
  { key: 'all',      label: 'All',      icon: '🏷️' },
  { key: 'dining',   label: 'Dining',   icon: '🍽️' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
  { key: 'booking',  label: 'Booking',  icon: '📅' },
];

export default function DealsScreen({ navigation }) {
  const [tab, setTab] = useState('all');
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeals = useCallback(async (currentTab) => {
    try {
      const res = await followerApi.getDeals(currentTab, 1);
      const data = res.data || res;
      setDeals(data.deals || []);
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

  const renderItem = useCallback(({ item, index }) => {
    const product = item.product || item;
    const brand = item.brand || { name: item.brand_name, category: item.brand_category, city: item.brand_city };
    const category = brand.category;
    const isCarRental = category === 'car_rental' || category === 'bike_rental';

    return (
      <View style={[s.gridItem, index % 2 === 0 && { marginRight: 5 }, index % 2 === 1 && { marginLeft: 5 }]}>
        <ProductCard
          product={product}
          brand={brand}
          discount={item.discount || (item.offer?.discount_value ? { type: item.offer?.offer_type || 'percentage', value: item.offer.discount_value } : null)}
          influencer={item.influencer}
          isSaved={item.is_saved}
          onPressHeart={() => handleSave(item)}
          onPress={() => {
            if (isCarRental) {
              const specs = typeof product.variants_json === 'string' ? JSON.parse(product.variants_json || '{}') : (product.variants_json || {});
              navigation.navigate('CarDetail', {
                vehicle: { name: product.name, specs: specs.specs || {}, location: brand.city, distance: '1.2 km' },
                pricing: { day_rate: product.price, ...specs },
                discount: item.offer?.discount_value ? { value: item.offer.discount_value, influencer_name: item.influencer?.name } : null,
                tracking: item.tracking,
              });
            } else {
              // Product tap → single-product detail. The offer in the deal
              // row carries discount + availing_modes, so the detail screen
              // can surface the right CTA stack.
              navigation.navigate('ProductDetail', {
                offer: item.offer || { id: item.tracking?.offer_id, offer_type: item.offer_type, discount_value: item.discount_value, availing_modes: item.availing_modes },
                brand,
                store: { instagram_handle: item.influencer?.handle || item.influencer?.instagram_handle, name: item.influencer?.name },
                influencer: item.influencer,
                selectedProductId: product.id,
                product,
                tracking: buildTracking(item),
                trackingParams: buildTracking(item),
              });
            }
          }}
          onPressBrand={() => navigation.navigate('BrandStore', {
            brandId: brand.id || item.brand_id,
            brandName: brand.name,
            tracking: buildTracking(item),
          })}
        />
      </View>
    );
  }, [handleSave, navigation]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Deals</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabPill, tab === t.key && s.tabPillActive]}
            onPress={() => { setTab(t.key); setDeals([]); }}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.icon} {t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={P.yellow} /></View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item, idx) => `${item.offer?.id || item.offer_id || idx}_${item.product?.id || idx}`}
          numColumns={2}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 100, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.yellow} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🏷️</Text>
              <Text style={s.emptyTitle}>No deals in this category yet</Text>
              <Text style={s.emptyText}>Try a different tab or check back later.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8,
    backgroundColor: P.bg,
  },
  title: { fontSize: 22, fontWeight: '800', color: P.ink },
  tabRow: {
    paddingHorizontal: 20, paddingBottom: 12, gap: 6,
  },
  tabPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: P.border,
  },
  tabPillActive: {
    borderColor: P.ink, backgroundColor: P.yellowPale,
  },
  tabText: { fontSize: 11, fontWeight: '600', color: P.muted },
  tabTextActive: { color: P.ink },
  gridItem: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: P.ink, marginBottom: 4 },
  emptyText: { fontSize: 12, color: P.muted, textAlign: 'center' },
});
