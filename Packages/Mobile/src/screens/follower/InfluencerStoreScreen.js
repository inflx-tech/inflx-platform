import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { darkColors, spacing, radius, fmtMoney, getBusinessAccent } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import ProductCard from '../../components/cards/ProductCard';
import NewOfferCard from '../../components/cards/NewOfferCard';
import LookbookCard from '../../components/cards/LookbookCard';
import { buildTrackingFromOffer } from '../../utils/tracking';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'products', label: '🛍️ Products' },
  { key: 'store_deals', label: '🏪 Store Deals' },
  { key: 'services', label: '✨ Services' },
];

export default function InfluencerStoreScreen({ navigation, route }) {
  const { handle } = route.params;
  const [store, setStore] = useState(null);
  const [lookbooks, setLookbooks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const fetchStore = useCallback(async () => {
    try {
      const res = await followerApi.getStore(handle);
      const data = res.data || res;
      setStore(data);
    } catch (e) {
      console.error('[InfluencerStore] Error:', e.message);
    }
  }, [handle]);

  // Fashion-2 — fetch lookbooks in parallel. Non-blocking: empty list is
  // a valid state (most creators won't have lookbooks at launch).
  const fetchLookbooks = useCallback(async () => {
    try {
      const res = await followerApi.getCreatorLookbooks(handle);
      const data = res.data || res;
      setLookbooks(data.lookbooks || []);
    } catch (e) {
      // Silent — lookbook absence is not an error state for the screen.
    }
  }, [handle]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStore(), fetchLookbooks()]).finally(() => setLoading(false));
  }, [fetchStore, fetchLookbooks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStore();
    setRefreshing(false);
  }, [fetchStore]);

  const handleFollow = useCallback(async () => {
    try {
      if (isFollowing) {
        await followerApi.unfollow(store?.influencer?.id);
        setIsFollowing(false);
      } else {
        await followerApi.follow(store?.influencer?.id);
        setIsFollowing(true);
      }
    } catch (e) {
      console.error('[Follow] Error:', e.message);
    }
  }, [isFollowing, store]);

  const handleCTA = useCallback((offer, mode) => {
    const params = {
      offer: { id: offer.offer_id, offer_type: offer.offer_type, discount_value: offer.discount_value, availing_modes: offer.availing_modes },
      brand: { id: offer.brand_id, name: offer.brand_name, category: offer.brand_category, city: offer.brand_city },
      tracking: { campaign_id: offer.campaign_id, set_id: offer.set_id, offer_id: offer.offer_id, campaign_influencer_id: offer.campaign_influencer_id },
      influencer: store?.influencer,
    };
    switch (mode) {
      case 'pay_at_store': navigation.navigate('PayAtStore', params); break;
      case 'prebook': navigation.navigate('PreBook', params); break;
      case 'enquiry': navigation.navigate('Enquiry', params); break;
      default: navigation.navigate('ProductDetail', params);
    }
  }, [navigation, store]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={darkColors.amber} /></View>;
  }

  const inf = store?.influencer;
  const offers = store?.offers || [];

  // Extract products from all offers
  const allProducts = [];
  const storeDeals = [];
  for (const offer of offers) {
    if (offer.products && offer.products.length > 0) {
      for (const product of offer.products) {
        allProducts.push({ product, offer, brand: { id: offer.brand_id, name: offer.brand_name, category: offer.brand_category, city: offer.brand_city } });
      }
    } else {
      storeDeals.push(offer);
    }
  }

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkColors.amber} />}>
      {/* Influencer profile header */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{inf?.name?.[0] || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.infName}>{inf?.name}</Text>
          <Text style={s.infMeta}>{inf?.niche?.[0] || 'Lifestyle'} · Vijayawada</Text>
          <View style={s.statsRow}>
            <Text style={s.statText}><Text style={s.statNum}>{formatCount(inf?.followers_count)}</Text> followers</Text>
            <Text style={s.statText}><Text style={s.statNum}>{offers.length}</Text> deals</Text>
          </View>
        </View>
        <TouchableOpacity style={[s.followBtn, isFollowing && s.followingBtn]} onPress={handleFollow}>
          <Text style={[s.followText, isFollowing && s.followingText]}>
            {isFollowing ? 'Following ✓' : '+ Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pills}>
        {FILTER_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.pill, filter === t.key && s.pillActive]}
            onPress={() => setFilter(t.key)}
          >
            <Text style={[s.pillText, filter === t.key && s.pillTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Fashion-2 — creator lookbooks (curated outfit collections).
          Surfaced always, above product deals, because it's the most
          editorial / creator-led moment on the screen. Horizontal scroll
          when ≥ 2 lookbooks. */}
      {lookbooks.length > 0 && (
        <>
          <View style={s.section}>
            <Text style={s.sectionTitle}>👗 Curated Looks ({lookbooks.length})</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 6 }}>
            {lookbooks.map(lb => (
              <View key={lb.id} style={{ width: 230 }}>
                <LookbookCard
                  lookbook={lb}
                  creatorName={inf?.name}
                  onPress={() => navigation.navigate('LookbookDetail', { handle, lookbookId: lb.id })}
                />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Products FIRST */}
      {(filter === 'all' || filter === 'products') && allProducts.length > 0 && (
        <>
          <View style={s.section}>
            <Text style={s.sectionTitle}>{inf?.name}'s Product Deals</Text>
          </View>
          <View style={s.productGrid}>
            {allProducts.map((item, i) => {
              const isCarRental = item.brand.category === 'car_rental' || item.brand.category === 'bike_rental';
              return (
                <View key={`${item.offer.offer_id}_${item.product.id}_${i}`} style={s.gridItem}>
                  <ProductCard
                    product={item.product}
                    brand={item.brand}
                    discount={{ type: item.offer.offer_type, value: item.offer.discount_value }}
                    onPress={() => {
                      if (isCarRental) {
                        const specs = typeof item.product.variants_json === 'string' ? JSON.parse(item.product.variants_json || '{}') : (item.product.variants_json || {});
                        navigation.navigate('CarDetail', {
                          vehicle: { name: item.product.name, specs: specs.specs || {}, location: item.brand.city, distance: '1.2 km' },
                          pricing: { day_rate: item.product.price, ...specs },
                          discount: { value: item.offer.discount_value, influencer_name: inf?.name, influencer_handle: inf?.instagram_handle },
                          tracking: { campaign_id: item.offer.campaign_id, set_id: item.offer.set_id, offer_id: item.offer.offer_id, campaign_influencer_id: item.offer.campaign_influencer_id },
                        });
                      } else {
                        // Phase Salon-2 — thread tracking. influencer is the
                        // current store's owner (`inf`), spliced as fallback.
                        navigation.navigate('BrandStore', {
                          brandId: item.brand.id,
                          tracking: buildTrackingFromOffer(item.offer, inf),
                        });
                      }
                    }}
                  />
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Store & service deals */}
      {(filter === 'all' || filter === 'store_deals') && storeDeals.length > 0 && (
        <>
          <View style={s.section}>
            <Text style={s.sectionTitle}>{inf?.name}'s Store & Service Deals</Text>
          </View>
          {storeDeals.map((offer, i) => (
            <NewOfferCard
              key={offer.offer_id || i}
              store={{ name: offer.brand_name, category: offer.brand_category, logo_initial: offer.brand_name?.[0] }}
              dealType="shop"
              dealLabel={`${offer.brand_name} · All ${offer.brand_category?.replace(/_/g, ' ')}`}
              discountValue={`${offer.discount_value}%`}
              tags={[]}
              onPress={() => navigation.navigate('BrandStore', {
                brandId: offer.brand_id,
                tracking: buildTrackingFromOffer(offer, inf),
              })}
            />
          ))}
        </>
      )}

      {/* Empty */}
      {offers.length === 0 && (
        <View style={s.empty}>
          <Text style={{ fontSize: 40 }}>🏷️</Text>
          <Text style={s.emptyText}>No active deals</Text>
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkColors.bg2 },
  profileCard: {
    marginHorizontal: 20, marginTop: 50, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: darkColors.card, borderRadius: 16,
    borderWidth: 1, borderColor: darkColors.borderAccent,
    padding: 16,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: darkColors.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  infName: { fontSize: 16, fontWeight: '700', color: darkColors.text },
  infMeta: { fontSize: 11, color: darkColors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  statText: { fontSize: 10, color: darkColors.textSecondary },
  statNum: { fontWeight: '700', color: darkColors.amber },
  followBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: darkColors.amber,
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: darkColors.amber },
  followText: { fontSize: 11, fontWeight: '700', color: '#000' },
  followingText: { color: darkColors.amber },
  pills: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: darkColors.border,
  },
  pillActive: { borderColor: darkColors.amber, backgroundColor: darkColors.amberDim },
  pillText: { fontSize: 11, fontWeight: '600', color: darkColors.textSecondary },
  pillTextActive: { color: darkColors.amber },
  section: { paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: darkColors.text },
  productGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, paddingBottom: 14, gap: 10,
  },
  gridItem: { width: '48%' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: darkColors.textSecondary, marginTop: 8 },
});
