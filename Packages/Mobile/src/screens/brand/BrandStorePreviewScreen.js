import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
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
 *
 * Flow 19 (2026-05-25): navy + orange legacy palette → brandPalette parity
 * with the brand-web wave. Behavior preserved 1:1.
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
    return (
      <View style={s.container}>
        <Header navigation={navigation} subtitle="This is what customers see" />
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={P.yellow} />
        </View>
      </View>
    );
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
    <View style={s.container}>
      <Header navigation={navigation} subtitle="This is what customers see" />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.yellow} colors={[P.yellow]} />}
      >
        {/* Brand info card */}
        <View style={s.brandCard}>
          <View style={s.brandTile}>
            <Text style={s.brandTileText}>{brand?.business_name?.[0] || '?'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.nameRow}>
              <Text style={s.brandName} numberOfLines={1}>{brand?.business_name || '—'}</Text>
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedCheck}>✓</Text>
              </View>
            </View>
            <Text style={s.brandMeta}>
              {(category || '').replace(/_/g, ' ')}{brand?.city ? ` · ${brand.city}` : ''}
            </Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={s.statsStrip}>
          <View style={s.stat}>
            <Text style={s.statVal}>{products.length}</Text>
            <Text style={s.statLabel}>PRODUCTS</Text>
          </View>
          <View style={[s.stat, s.statBorder]}>
            <Text style={s.statVal}>{sectionList.length}</Text>
            <Text style={s.statLabel}>SECTIONS</Text>
          </View>
          <View style={[s.stat, s.statBorder]}>
            <Text style={s.statVal}>{influencers.length}</Text>
            <Text style={s.statLabel}>CREATORS</Text>
          </View>
        </View>

        {/* Creators promoting this brand */}
        {influencers.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Creators on your store</Text>
            <View style={s.creatorList}>
              {influencers.map((inf, i) => (
                <View
                  key={inf.influencer_id || i}
                  style={[s.creatorRow, i === influencers.length - 1 && s.creatorRowLast]}
                >
                  <View style={s.creatorAvatar}>
                    <Text style={s.creatorInitial}>{inf.name?.[0] || '?'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.creatorName}>{inf.name || 'Creator'}</Text>
                    <Text style={s.creatorHandle}>@{inf.instagram_handle}</Text>
                  </View>
                  <View style={s.creatorOffersPill}>
                    <Text style={s.creatorOffersText}>
                      {inf.offers?.length || 0} offer{(inf.offers?.length || 0) === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Products grouped by section */}
        {sectionList.length > 0 ? (
          sectionList.map(sec => (
            <View key={sec.title} style={s.section}>
              <Text style={s.sectionTitle}>
                {sec.title} <Text style={s.sectionCount}>({sec.items.length})</Text>
              </Text>
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
            <View style={s.emptyIcon}>
              <Text style={s.emptyIconText}>[STORE]</Text>
            </View>
            <Text style={s.emptyTitle}>No products yet</Text>
            <Text style={s.emptyText}>
              Add products from your web dashboard to populate your store. Customers will see them here once published.
            </Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function Header({ navigation, subtitle }) {
  return (
    <View style={s.header}>
      <View style={s.headerInner}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={s.headerL}>
          <Text style={s.headerTitle}>My Store</Text>
          <View style={s.headerRule} />
          <Text style={s.headerSub}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  // ── Header (ink) ─────────────────────────────────────────
  header: {
    backgroundColor: P.ink,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
  },
  backBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, flexShrink: 0,
  },
  backBtnText: {
    fontFamily: fonts.monoBold,
    fontSize: 13, fontWeight: '700',
    color: P.white,
  },
  headerL: {
    flex: 1, minWidth: 0, flexDirection: 'column', gap: 5,
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18, fontWeight: '700',
    color: P.white, letterSpacing: -0.2,
  },
  headerRule: {
    width: 30, height: 3,
    backgroundColor: P.yellow, borderRadius: 2,
  },
  headerSub: {
    fontFamily: fonts.sansMedium,
    fontSize: 11, color: 'rgba(255,255,255,0.55)',
  },

  // ── Loading ──────────────────────────────────────────────
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Brand card ───────────────────────────────────────────
  brandCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 14, padding: 14,
    backgroundColor: P.white, borderRadius: 16,
    borderWidth: 1, borderColor: P.border,
  },
  brandTile: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: P.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  brandTileText: {
    fontFamily: fonts.displayBold,
    fontSize: 20, fontWeight: '800', color: P.ink,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: {
    fontFamily: fonts.displayBold,
    fontSize: 16, fontWeight: '800', color: P.ink, flexShrink: 1,
  },
  verifiedBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: P.success,
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedCheck: {
    fontSize: 9, fontWeight: '900', color: P.white, lineHeight: 10,
  },
  brandMeta: {
    fontFamily: fonts.monoMedium,
    fontSize: 10.5, color: P.muted2, marginTop: 3, letterSpacing: 0.2,
  },

  // ── Stats strip ──────────────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: P.white,
    paddingVertical: 12,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: P.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderLeftColor: P.borderSoft },
  statVal: {
    fontFamily: fonts.monoBold,
    fontSize: 20, fontWeight: '800', color: P.ink,
  },
  statLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 9, color: P.muted2, marginTop: 2,
    letterSpacing: 0.4,
  },

  // ── Sections ─────────────────────────────────────────────
  section: { marginTop: 18, paddingHorizontal: 14 },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 11.5, fontWeight: '800', color: P.muted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  sectionCount: { color: P.ink, fontWeight: '800' },

  // ── Creators ─────────────────────────────────────────────
  creatorList: {
    backgroundColor: P.white, borderRadius: 14,
    borderWidth: 1, borderColor: P.border, overflow: 'hidden',
  },
  creatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 11, borderBottomWidth: 1, borderBottomColor: P.borderSoft,
  },
  creatorRowLast: { borderBottomWidth: 0 },
  creatorAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: P.yellowPale,
    alignItems: 'center', justifyContent: 'center',
  },
  creatorInitial: {
    fontFamily: fonts.displayBold,
    fontSize: 12, fontWeight: '800', color: P.yellowText,
  },
  creatorName: {
    fontFamily: fonts.displayBold,
    fontSize: 12.5, fontWeight: '700', color: P.ink,
  },
  creatorHandle: {
    fontFamily: fonts.monoMedium,
    fontSize: 10, color: P.muted2, marginTop: 1,
  },
  creatorOffersPill: {
    backgroundColor: P.yellowPale,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
  },
  creatorOffersText: {
    fontFamily: fonts.sansBold,
    fontSize: 10.5, fontWeight: '700', color: P.yellowText,
  },

  // ── Products ─────────────────────────────────────────────
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  productCard: {
    width: '48.5%',
    backgroundColor: P.white,
    borderRadius: 12,
    borderWidth: 1, borderColor: P.border,
    overflow: 'hidden',
  },
  // B2-lite: bigger image + readable 2-line name (was 96px / 11.5px clipped),
  // mirroring the web listing fix. Preview stays read-only — listing is web-only
  // by design.
  productImg: {
    height: 150, backgroundColor: P.bg2,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderBottomWidth: 1, borderBottomColor: P.borderSoft,
  },
  productImgFill: { width: '100%', height: '100%' },
  productEmoji: { fontSize: 38 },
  productBody: { padding: 11 },
  productName: {
    fontFamily: fonts.sansBold,
    fontSize: 13.5, fontWeight: '700', color: P.ink,
    lineHeight: 18, minHeight: 36,
  },
  productPrice: {
    fontFamily: fonts.monoBold,
    fontSize: 14, fontWeight: '800', color: P.ink, marginTop: 6,
  },

  // ── Empty state ──────────────────────────────────────────
  empty: {
    margin: 30,
    backgroundColor: P.white,
    borderWidth: 1.5, borderColor: P.yellowPale, borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 36, paddingHorizontal: 22,
    alignItems: 'center', gap: 10,
  },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 13,
    backgroundColor: P.yellowPale,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIconText: {
    fontFamily: fonts.monoBold,
    fontSize: 11, fontWeight: '800', color: P.yellowText, letterSpacing: 0.4,
  },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14, fontWeight: '700', color: P.ink,
  },
  emptyText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5, color: P.muted, textAlign: 'center',
    lineHeight: 17, maxWidth: 260,
  },
});
