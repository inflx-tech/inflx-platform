import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

/**
 * BrandStorePreviewScreen — brand previews their own store as customers see it.
 * Fetches /brands/me/store-preview (handled by brand.controller.storePreview
 * which proxies followerService.resolveBusinessStore for the brand's own id).
 *
 * Sections rendered:
 *  - Brand header (name, category, city, verified badge)
 *  - All products grouped by section (the way followers see in BrandStore)
 *  - Creators promoting this brand (with active offers)
 *
 * This is purely read-only — no edit affordances. Editing the brand profile
 * still happens in BrandProfileScreen / web dashboard listing wizard.
 */

const CATEGORY_EMOJI = {
  restaurant:     '🍽️',
  salon:          '💇',
  car_rental:     '🚗',
  bike_rental:    '🏍️',
  fashion:        '👗',
  fashion_walkin: '👗',
  fashion_online: '👕',
  bakery:         '🧁',
  florist:        '💐',
};

export default function BrandStorePreviewScreen({ navigation }) {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStore = useCallback(async () => {
    try {
      const res = await brandApi.getMyStorePreview();
      const data = res.data || res;
      setStore(data);
    } catch (e) {
      console.error('[BrandStorePreview] Error:', e.message);
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

  const brand = store?.brand;
  const products = store?.products || [];
  const influencers = store?.influencers || [];
  const category = brand?.category;

  // Group products by section so the preview matches what followers see in
  // BrandStoreScreen.
  const sections = {};
  for (const p of products) {
    const sec = p.section || 'Products';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(p);
  }
  const sectionList = Object.entries(sections).map(([title, items]) => ({ title, items }));

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orange]} />}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>My Store</Text>
          <Text style={s.subtitle}>This is what customers see</Text>
        </View>
      </View>

      {/* Brand info banner */}
      <View style={s.brandCard}>
        <View style={s.brandLogo}>
          <Text style={s.brandLogoText}>{brand?.business_name?.[0] || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.brandName} numberOfLines={1}>{brand?.business_name || '—'}</Text>
            <View style={s.verifiedBadge}><Text style={s.verifiedCheck}>✓</Text></View>
          </View>
          <Text style={s.brandMeta}>
            {(category || '').replace(/_/g, ' ')}{brand?.city ? ` · ${brand.city}` : ''}
          </Text>
        </View>
      </View>

      {/* Stats strip */}
      <View style={s.statsBar}>
        <View style={s.stat}>
          <Text style={s.statVal}>{products.length}</Text>
          <Text style={s.statLabel}>Products</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: colors.teal }]}>{sectionList.length}</Text>
          <Text style={s.statLabel}>Sections</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: colors.tealDeep }]}>{influencers.length}</Text>
          <Text style={s.statLabel}>Creators</Text>
        </View>
      </View>

      {/* Creators promoting this brand */}
      {influencers.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Creators on your store</Text>
          <View style={s.creatorList}>
            {influencers.map((inf, i) => (
              <View key={inf.influencer_id || i} style={s.creatorRow}>
                <View style={s.creatorAvatar}>
                  <Text style={s.creatorInitial}>{inf.name?.[0] || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.creatorName}>{inf.name || 'Creator'}</Text>
                  <Text style={s.creatorHandle}>@{inf.instagram_handle}</Text>
                </View>
                <Text style={s.creatorOffers}>{inf.offers?.length || 0} offer{(inf.offers?.length || 0) === 1 ? '' : 's'}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Products grouped by section */}
      {sectionList.length > 0 ? (
        sectionList.map(sec => (
          <View key={sec.title} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title} ({sec.items.length})</Text>
            <View style={s.productGrid}>
              {sec.items.map((p, i) => (
                <View key={p.id || i} style={s.productCard}>
                  <View style={s.productImg}>
                    {p.image_url ? (
                      <Image source={{ uri: p.image_url }} style={s.productImgFill} resizeMode="cover" />
                    ) : (
                      <Text style={s.productEmoji}>{CATEGORY_EMOJI[category] || '📦'}</Text>
                    )}
                  </View>
                  <View style={s.productBody}>
                    <Text style={s.productName} numberOfLines={2}>{p.name}</Text>
                    <Text style={s.productPrice}>{fmtMoney(parseFloat(p.price || 0))}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
      ) : (
        <View style={s.empty}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🏪</Text>
          <Text style={s.emptyTitle}>No products yet</Text>
          <Text style={s.emptyText}>
            Add products from your web dashboard to populate your store. Customers will see them here once published.
          </Text>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.t1 },
  subtitle: { fontSize: 11, color: colors.t3 },

  // Brand card
  brandCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: spacing.lg, padding: spacing.lg,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  brandLogo: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  brandLogoText: { fontSize: 18, fontWeight: '800', color: colors.white },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: 16, fontWeight: '800', color: colors.t1, flexShrink: 1 },
  verifiedBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedCheck: { fontSize: 9, fontWeight: '900', color: '#fff', lineHeight: 10 },
  brandMeta: { fontSize: 11, color: colors.t3, marginTop: 2 },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.t1 },
  statLabel: { fontSize: 10, color: colors.t3, marginTop: 2 },

  // Sections
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.t1, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Creator list
  creatorList: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  creatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  creatorAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.tealPale,
    alignItems: 'center', justifyContent: 'center',
  },
  creatorInitial: { fontSize: 12, fontWeight: '800', color: colors.tealDeep },
  creatorName: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  creatorHandle: { fontSize: 10, color: colors.t3, marginTop: 2 },
  creatorOffers: { fontSize: 11, fontWeight: '700', color: colors.tealDeep },

  // Product grid
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productImg: {
    height: 110,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImgFill: { width: '100%', height: '100%' },
  productEmoji: { fontSize: 38 },
  productBody: { padding: 10 },
  productName: { fontSize: 12, fontWeight: '700', color: colors.t1, lineHeight: 16 },
  productPrice: { fontSize: 13, fontWeight: '800', color: colors.t1, marginTop: 6 },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  emptyText: { fontSize: 12, color: colors.t3, textAlign: 'center', lineHeight: 18 },
});
