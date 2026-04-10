import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

/**
 * MyStoreScreen — influencer previews their store as followers see it.
 * Shows all published products with influencer notes across all campaigns.
 */

export default function MyStoreScreen({ navigation }) {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStore = useCallback(async () => {
    try {
      const res = await influencerApi.getMyStorePreview();
      const data = res.data || res;
      setStore(data);
    } catch (e) {
      console.error('[MyStore] Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadStore();
  }, [loadStore]));

  const onRefresh = () => { setRefreshing(true); loadStore(); };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.orange} /></View>;
  }

  const inf = store?.influencer;
  const offers = store?.offers || [];
  const totalProducts = offers.reduce((sum, o) => sum + (o.products?.length || 0), 0);

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orange]} />}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>My Store</Text>
          <Text style={s.subtitle}>This is what followers see</Text>
        </View>
      </View>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{inf?.name?.[0] || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.infName}>{inf?.name}</Text>
          <Text style={s.infHandle}>@{inf?.instagram_handle}</Text>
        </View>
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{offers.length}</Text>
            <Text style={s.statLabel}>Deals</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statVal}>{totalProducts}</Text>
            <Text style={s.statLabel}>Products</Text>
          </View>
        </View>
      </View>

      {/* Published products by campaign/offer */}
      {offers.length === 0 && (
        <View style={s.empty}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🏪</Text>
          <Text style={s.emptyTitle}>Your store is empty</Text>
          <Text style={s.emptyText}>Go to your campaigns → Products → Publish items to your store. Followers will see them here.</Text>
        </View>
      )}

      {offers.map((offer, oIdx) => (
        <View key={offer.offer_id || oIdx} style={s.offerSection}>
          <View style={s.offerHeader}>
            <Text style={s.offerBrand}>{offer.brand_name}</Text>
            <Text style={s.offerDiscount}>
              {offer.discount_value ? `${offer.discount_value}% OFF` : offer.offer_type}
            </Text>
          </View>

          {(offer.products || []).map((product, pIdx) => (
            <View key={product.id || pIdx} style={s.productCard}>
              <View style={s.productRow}>
                <View style={s.productEmoji}>
                  <Text style={{ fontSize: 24 }}>🚗</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.productName}>{product.name}</Text>
                  <Text style={s.productDesc}>{product.description || product.section}</Text>
                  <Text style={s.productPrice}>{fmtMoney(Math.round(parseFloat(product.price || 0) * 100))}</Text>
                </View>
              </View>
              {product.influencer_note && (
                <View style={s.noteBox}>
                  <Text style={s.noteQuote}>"{product.influencer_note}"</Text>
                  <Text style={s.noteBy}>— Your recommendation</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.t1 },
  subtitle: { fontSize: 11, color: colors.t3 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: spacing.lg, padding: spacing.lg,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.orangePale, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: colors.orangeDeep },
  infName: { fontSize: 16, fontWeight: '700', color: colors.t1 },
  infHandle: { fontSize: 11, color: colors.t3, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', color: colors.orange },
  statLabel: { fontSize: 9, color: colors.t3, marginTop: 2 },
  offerSection: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  offerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  offerBrand: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  offerDiscount: { fontSize: 11, fontWeight: '700', color: colors.teal, backgroundColor: colors.tealPale, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  productCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8, overflow: 'hidden',
  },
  productRow: { flexDirection: 'row', padding: 12, gap: 10, alignItems: 'center' },
  productEmoji: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  productName: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  productDesc: { fontSize: 11, color: colors.t3, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '800', color: colors.t1, marginTop: 4 },
  noteBox: {
    padding: 10, backgroundColor: colors.orangePale, borderTopWidth: 1, borderTopColor: '#fde68a',
  },
  noteQuote: { fontSize: 12, color: '#92400e', fontStyle: 'italic', lineHeight: 18 },
  noteBy: { fontSize: 10, color: '#b45309', marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptyText: { fontSize: 12, color: colors.t3, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
});
