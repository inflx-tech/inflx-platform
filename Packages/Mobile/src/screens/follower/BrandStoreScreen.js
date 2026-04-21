import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { darkColors, spacing, radius, fmtMoney, getBusinessAccent } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import ProductCard from '../../components/cards/ProductCard';

export default function BrandStoreScreen({ navigation, route }) {
  const { brandId, brandName } = route.params;
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState('products');
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
    return <View style={s.center}><ActivityIndicator size="large" color={darkColors.amber} /></View>;
  }

  const brand = store?.brand;
  const products = store?.products || [];
  const influencers = store?.influencers || [];
  const accent = getBusinessAccent(brand?.category);
  const icon = accent.icon;

  // Group products by section
  const sections = {};
  for (const p of products) {
    const sec = p.section || 'Products';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(p);
  }
  const sectionList = Object.entries(sections).map(([title, items]) => ({ title, items }));

  // Get best offer for discount display
  const bestOffer = influencers.flatMap(i => i.offers || []).sort((a, b) => (b.discount_value || 0) - (a.discount_value || 0))[0];

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkColors.amber} />}>
      {/* Banner */}
      <View style={[s.banner, { backgroundColor: accent.dim }]}>
        <Text style={s.bannerIcon}>{icon}</Text>
        <View style={[s.logo, { backgroundColor: accent.accent }]}>
          <Text style={s.logoText}>{brand?.business_name?.[0] || '?'}</Text>
        </View>
      </View>

      {/* Store info */}
      <View style={s.storeInfo}>
        <Text style={s.storeName}>{brand?.business_name || brandName}</Text>
        <Text style={s.storeMeta}>{brand?.category?.replace(/_/g, ' ')} · {brand?.city || ''}</Text>

        {/* Contact row */}
        <View style={s.contactRow}>
          {['📞 Call', '💬 WhatsApp', '📍 Map'].map(label => (
            <TouchableOpacity key={label} style={[s.contactBtn, { borderColor: `${accent.accent}33` }]}>
              <Text style={[s.contactBtnText, { color: accent.accent }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active offers banner */}
        {bestOffer && (
          <View style={[s.offerBanner, { backgroundColor: accent.dim, borderColor: `${accent.accent}33` }]}>
            <Text style={[s.offerBannerText, { color: accent.accent }]}>
              {bestOffer.discount_value}% OFF via influencer deal
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {[
          { key: 'products', label: `All ${brand?.category === 'restaurant' ? 'Menu' : 'Products'} (${products.length})` },
          { key: 'offers', label: `Deals (${influencers.length})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && { borderBottomColor: accent.accent }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabText, tab === t.key && { color: accent.accent }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Products tab — grid layout */}
      {tab === 'products' && (
        <>
          {/* Section pills */}
          {sectionList.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sectionPills}>
              {sectionList.map(sec => (
                <TouchableOpacity key={sec.title} style={s.sectionPill}>
                  <Text style={s.sectionPillText}>{sec.title} ({sec.items.length})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {sectionList.map(sec => (
            <View key={sec.title} style={{ marginBottom: 16 }}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{sec.title}</Text>
              </View>
              <View style={s.productGrid}>
                {sec.items.map((product, i) => (
                  <View key={product.id || i} style={s.gridItem}>
                    <ProductCard
                      product={{ ...product, price: parseFloat(product.price || 0) }}
                      brand={{ name: brand?.business_name, category: brand?.category, locality: brand?.city }}
                      discount={bestOffer ? { type: bestOffer.offer_type || 'percentage', value: bestOffer.discount_value } : null}
                      accentColor={accent.accent}
                      onPress={() => {}}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}

          {products.length === 0 && (
            <View style={s.empty}><Text style={s.emptyText}>No products listed yet</Text></View>
          )}
        </>
      )}

      {/* Offers tab — influencer list */}
      {tab === 'offers' && (
        <View style={{ padding: 20 }}>
          {influencers.map((inf, i) => (
            <TouchableOpacity
              key={inf.influencer_id || i}
              style={s.influencerCard}
              onPress={() => navigation.navigate('InfluencerStore', { handle: inf.instagram_handle })}
            >
              <View style={[s.infAvatar, { backgroundColor: accent.accent }]}>
                <Text style={s.infAvatarText}>{inf.name?.[0] || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.infName}>{inf.name}</Text>
                <Text style={s.infHandle}>@{inf.instagram_handle} · {inf.offers?.length || 0} offer{inf.offers?.length !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={[s.viewText, { color: accent.accent }]}>View →</Text>
            </TouchableOpacity>
          ))}
          {influencers.length === 0 && (
            <View style={s.empty}><Text style={s.emptyText}>No active offers</Text></View>
          )}
        </View>
      )}

      {/* Sticky CTA */}
      <View style={[s.stickyCTA, { backgroundColor: accent.accent }]}>
        <Text style={s.stickyText}>
          {brand?.category === 'restaurant' ? '🍽️ Visit & Pay via INFLX' :
           brand?.category === 'salon' ? '💇 Book Appointment' :
           '🛍️ Visit & Pay via INFLX'}
        </Text>
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkColors.bg2 },
  banner: {
    height: 100, justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  bannerIcon: { fontSize: 40, opacity: 0.3 },
  logo: {
    position: 'absolute', bottom: -18, left: 20,
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: darkColors.bg2,
  },
  logoText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  storeInfo: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  storeName: { fontSize: 18, fontWeight: '800', color: darkColors.text },
  storeMeta: { fontSize: 11, color: darkColors.textSecondary, marginTop: 2 },
  contactRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  contactBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
    alignItems: 'center',
  },
  contactBtnText: { fontSize: 10, fontWeight: '600' },
  offerBanner: {
    marginTop: 12, padding: 10, borderRadius: 12, borderWidth: 1,
    alignItems: 'center',
  },
  offerBannerText: { fontSize: 12, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: darkColors.border,
  },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 12, fontWeight: '600', color: darkColors.textSecondary },
  sectionPills: { paddingHorizontal: 20, paddingVertical: 10, gap: 6 },
  sectionPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: darkColors.card,
    borderWidth: 1, borderColor: darkColors.border,
  },
  sectionPillText: { fontSize: 11, fontWeight: '600', color: darkColors.textSecondary },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: darkColors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  productGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, gap: 10,
  },
  gridItem: { width: '48%' },
  influencerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: darkColors.card, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: darkColors.border, marginBottom: 8,
  },
  infAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  infAvatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  infName: { fontSize: 14, fontWeight: '600', color: darkColors.text },
  infHandle: { fontSize: 11, color: darkColors.textSecondary, marginTop: 2 },
  viewText: { fontSize: 12, fontWeight: '600' },
  stickyCTA: {
    marginHorizontal: 20, marginTop: 12,
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center',
  },
  stickyText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, color: darkColors.textSecondary },
});
