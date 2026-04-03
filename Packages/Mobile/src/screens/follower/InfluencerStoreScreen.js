import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { colors, spacing, radius } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import OfferCard from '../../components/OfferCard';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'dining', label: 'Dining' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'booking', label: 'Booking' },
];

const CATEGORY_GROUPS = {
  dining: ['restaurant', 'bakery'],
  shopping: ['fashion_walkin', 'fashion_online', 'florist', 'packaged_food'],
  booking: ['salon', 'car_rental', 'function_hall', 'wedding_planner'],
};

export default function InfluencerStoreScreen({ navigation, route }) {
  const { handle } = route.params;
  const [store, setStore] = useState(null);
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

  useEffect(() => {
    setLoading(true);
    fetchStore().finally(() => setLoading(false));
  }, [fetchStore]);

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

  const filteredOffers = useCallback(() => {
    if (!store?.offers) return [];
    if (filter === 'all') return store.offers;
    const cats = CATEGORY_GROUPS[filter] || [];
    return store.offers.filter(o => cats.includes(o.brand_category));
  }, [store, filter]);

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
    return <View style={s.center}><ActivityIndicator size="large" color={colors.orange} /></View>;
  }

  const inf = store?.influencer;
  const offers = filteredOffers();

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={s.infAvatar}>
          <Text style={s.infAvatarText}>{getInitials(inf?.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.storeName}>{inf?.name}'s Store</Text>
          <Text style={s.storeHandle}>@{inf?.instagram_handle} · {offers.length} deals</Text>
        </View>
        <TouchableOpacity style={[s.followBtn, isFollowing && s.followingBtn]} onPress={handleFollow}>
          <Text style={[s.followText, isFollowing && s.followingText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.filterTab, filter === tab.key && s.filterTabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[s.filterText, filter === tab.key && s.filterTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Offers list */}
      <FlatList
        data={offers}
        keyExtractor={(item, idx) => `${item.offer_id}_${idx}`}
        renderItem={({ item: offer }) => {
          const product = offer.products?.[0] || null;
          return (
            <OfferCard
              brand={{ id: offer.brand_id, name: offer.brand_name, category: offer.brand_category, city: offer.brand_city }}
              offer={{ id: offer.offer_id, offer_type: offer.offer_type, discount_value: offer.discount_value, availing_modes: offer.availing_modes, prebook_advance: offer.prebook_advance }}
              product={product}
              influencer={inf ? { ...inf, note_text: product?.influencer_note } : null}
              tracking={{ campaign_id: offer.campaign_id, set_id: offer.set_id, offer_id: offer.offer_id, campaign_influencer_id: offer.campaign_influencer_id }}
              onPressCTA={(mode) => handleCTA(offer, mode)}
              onPressBrand={() => navigation.navigate('BrandStore', { brandId: offer.brand_id, brandName: offer.brand_name })}
            />
          );
        }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orange]} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>🏷️</Text>
            <Text style={s.emptyText}>No active deals</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  infAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.orangePale, alignItems: 'center', justifyContent: 'center' },
  infAvatarText: { fontSize: 12, fontWeight: '700', color: colors.orangeDeep },
  storeName: { fontSize: 15, fontWeight: '700', color: colors.t1 },
  storeHandle: { fontSize: 10, color: colors.t3 },
  followBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full,
    backgroundColor: colors.orange,
  },
  followingBtn: { backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.border2 },
  followText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  followingText: { color: colors.t2 },
  filterRow: {
    flexDirection: 'row', backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterTabActive: { borderBottomColor: colors.orange },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.t3 },
  filterTextActive: { color: colors.orangeDeep, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: colors.t3, marginTop: 8 },
});
