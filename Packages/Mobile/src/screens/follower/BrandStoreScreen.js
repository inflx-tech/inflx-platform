import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { colors, spacing, radius, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function BrandStoreScreen({ navigation, route }) {
  const { brandId, brandName } = route.params;
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState('products'); // products | offers
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStore = useCallback(async () => {
    try {
      const res = await followerApi.getBrandStore(brandId);
      const data = res.data || res;
      setStore(data);
    } catch (e) {
      console.error('[BrandStore] Error:', e.message);
    }
  }, [brandId]);

  useEffect(() => {
    setLoading(true);
    fetchStore().finally(() => setLoading(false));
  }, [fetchStore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStore();
    setRefreshing(false);
  }, [fetchStore]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.orange} /></View>;
  }

  const brand = store?.brand;
  const products = store?.products || [];
  const influencers = store?.influencers || [];

  // Group products by section
  const sections = {};
  for (const p of products) {
    const sec = p.section || 'Menu';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(p);
  }
  const sectionList = Object.entries(sections).map(([title, items]) => ({ title, items }));

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.brandName}>{brand?.business_name || brandName}</Text>
          <Text style={s.brandInfo}>{brand?.category?.replace(/_/g, ' ')} · {brand?.city || ''}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {[
          { key: 'products', label: `All Products (${products.length})` },
          { key: 'offers', label: `Active Offers (${influencers.length})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'products' ? (
        <FlatList
          data={sectionList}
          keyExtractor={item => item.title}
          renderItem={({ item: section }) => (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              {section.items.map(product => (
                <View key={product.id} style={s.productCard}>
                  <View style={s.productEmoji}>
                    <Text style={{ fontSize: 24 }}>{getCategoryEmoji(brand?.category)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.productName}>{product.name}</Text>
                    {product.description && <Text style={s.productDesc} numberOfLines={1}>{product.description}</Text>}
                  </View>
                  <Text style={s.productPrice}>{fmtMoney(product.price)}</Text>
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orange]} />}
          ListEmptyComponent={
            <View style={s.empty}><Text style={s.emptyText}>No products listed yet</Text></View>
          }
        />
      ) : (
        <FlatList
          data={influencers}
          keyExtractor={item => item.influencer_id}
          renderItem={({ item: inf }) => (
            <TouchableOpacity
              style={s.influencerCard}
              onPress={() => navigation.navigate('InfluencerStore', { handle: inf.instagram_handle })}
            >
              <View style={s.infAvatar}>
                <Text style={s.infAvatarText}>{getInitials(inf.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.infName}>{inf.name}</Text>
                <Text style={s.infHandle}>@{inf.instagram_handle} · {inf.offers?.length || 0} offer{inf.offers?.length !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={{ color: colors.orange, fontSize: 12, fontWeight: '600' }}>View →</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={s.empty}><Text style={s.emptyText}>No active offers</Text></View>
          }
        />
      )}
    </View>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function getCategoryEmoji(cat) {
  const map = {
    restaurant: '🍽️', bakery: '🎂', salon: '💇', florist: '🌹',
    packaged_food: '📦', car_rental: '🚗', function_hall: '🏛️',
    wedding_planner: '💒', fashion_walkin: '👗', fashion_online: '🛍️',
  };
  return map[cat] || '🏪';
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5EEE6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5EEE6' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 18, fontWeight: '700', color: colors.t1 },
  brandInfo: { fontSize: 11, color: colors.t3, marginTop: 2 },
  tabRow: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.orange },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.t3 },
  tabTextActive: { color: colors.orangeDeep },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  productCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, padding: 13, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: 6,
  },
  productEmoji: {
    width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  productName: { fontSize: 13, fontWeight: '600', color: colors.t1 },
  productDesc: { fontSize: 11, color: colors.t3, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  influencerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, padding: spacing.lg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  infAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orangePale, alignItems: 'center', justifyContent: 'center' },
  infAvatarText: { fontSize: 12, fontWeight: '700', color: colors.orangeDeep },
  infName: { fontSize: 14, fontWeight: '600', color: colors.t1 },
  infHandle: { fontSize: 11, color: colors.t3, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: colors.t3 },
});
