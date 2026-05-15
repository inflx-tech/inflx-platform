import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { darkColors, spacing, radius, fmtMoney, getBusinessAccent } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import ProductCard from '../../components/cards/ProductCard';
import BrandActionRow from '../../components/BrandActionRow';

export default function BrandStoreScreen({ navigation, route }) {
  const { brandId, brandName, tracking: routeTracking } = route.params;

  // ── Tracking propagation per contracts-v1 §5 (Path A + Path B) ──────────────
  // Path A: direct influencer-link entry (/s/{handle} with no oid) — tracking
  //   constructed upstream from URL query params and passed as route param.
  // Path B: came from a listing detail screen ("View [brand]") — tracking
  //   inherited from the listing entry, forwarded by SchemaDetailScreen's
  //   onOpenBrandStore handler.
  // Both arrive on route.params.tracking. If neither path applies (organic
  // browse), tracking is undefined — brand actions still work, just no
  // commission attribution. Existing platform-direct revenue model unchanged.
  const tracking = routeTracking || null;
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Phase Salon-2 — pass the entry-creator's influencer_id to the backend so
  // the response embeds a `creator` object the sticky header renders. Most
  // entry surfaces now thread tracking through (see Phase Salon-2 navigation
  // fixes in HomeScreen / HomeScreenV2 / DealsScreen / CategoryListScreen /
  // SavedScreen / InfluencerStoreScreen). For purely organic browse (no
  // tracking), viaInfluencerId stays null and the header doesn't render.
  const viaInfluencerId = tracking?.influencer_id || null;

  const fetchStore = useCallback(async () => {
    try {
      const res = await followerApi.getBrandStore(brandId, viaInfluencerId);
      const data = res.data || res;
      setStore(data);
    } catch (e) {
      console.error('[BrandStore] Error:', e.message);
    }
  }, [brandId, viaInfluencerId]);

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
  const creator = store?.creator || null;   // Phase Salon-2: via-influencer for sticky header
  const accent = getBusinessAccent(brand?.category);
  const icon = accent.icon;

  // Schema-driven brand_config — surfaced when the store endpoint includes
  // the template (PR-B step 3.5+). Defensive lookup: if the backend doesn't
  // yet return template.brand_config, we render the legacy hardcoded
  // contact buttons below as fallback.
  const brandConfig = store?.template?.brand_config || null;
  const brandData = brand?.listing_data || {};
  const accentHex = accent?.accent || '#F59E0B';

  function dispatchBrandAction(action, ctx) {
    // Per contracts-v1 §6 + spec §8 — transactional actions route by
    // action.action enum; tracking flows through to whatever endpoint is
    // hit. Implementation defers to existing screens (PayAtStoreScreen,
    // PreBookScreen, EnquiryScreen) for now — those screens accept tracking
    // and route through the right /follower/* endpoints.
    switch (action.action) {
      case 'walkin_pay':
        navigation.navigate('PayAtStore', { brand, brandId, tracking: ctx.tracking });
        break;
      case 'book_slot':
        navigation.navigate('PreBook', { brand, brandId, tracking: ctx.tracking, action });
        break;
      case 'online_order':
        navigation.navigate('OrderCart', { brandData });
        break;
      case 'enquiry':
        navigation.navigate('Enquiry', { brand, brandId, tracking: ctx.tracking });
        break;
      default:
        Alert.alert('Action not wired', action.action);
    }
  }

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
    <View style={s.container}>
      {/* Phase Salon-2 — sticky "Brought to you by [creator]" header.
          Lives OUTSIDE the ScrollView so it never scrolls away. Renders only
          when the follower came in through a creator share-link (tracking
          carried an influencer_id). Tap → navigate to creator's store. */}
      {creator && (
        <TouchableOpacity
          style={[s.creatorBar, { backgroundColor: accent.accent }]}
          activeOpacity={0.85}
          onPress={() => {
            if (creator.instagram_handle) {
              navigation.navigate('InfluencerStore', { handle: creator.instagram_handle });
            }
          }}>
          <View style={s.creatorAvatar}>
            {creator.profile_pic_url
              ? <Text style={s.creatorAvatarFallback}>{(creator.name || '?')[0]}</Text>
              : <Text style={s.creatorAvatarFallback}>{(creator.name || '?')[0]}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.creatorBarLabel} numberOfLines={1}>
              Brought to you by {creator.name}
            </Text>
            <Text style={s.creatorBarSub} numberOfLines={1}>
              @{creator.instagram_handle}
              {creator.has_active_offer ? ' · Your booking credits them' : ''}
            </Text>
          </View>
          <Text style={s.creatorBarChevron}>›</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkColors.amber} />}>
      {/* Banner */}
      <View style={[s.banner, { backgroundColor: accent.dim }]}>
        <Text style={s.bannerIcon}>{icon}</Text>
        <View style={[s.logo, { backgroundColor: accent.accent }]}>
          <Text style={s.logoText}>{brand?.business_name?.[0] || '?'}</Text>
        </View>
      </View>

      {/* Store info */}
      <View style={s.storeInfo}>
        {/* Brand name + verified check.
            Phase Salon-1: any brand returned by /store/:handle is admin-approved
            (the endpoint filters on users.status). We render the verified mark
            unconditionally when `brand` is present, and gate behind
            brand.is_verified === false ONLY if the backend explicitly opts out
            later. */}
        <View style={s.nameRow}>
          <Text style={s.storeName} numberOfLines={1}>{brand?.business_name || brandName}</Text>
          {brand && brand?.is_verified !== false && (
            <View style={s.verifiedBadge}>
              <Text style={s.verifiedCheck}>✓</Text>
            </View>
          )}
        </View>
        <Text style={s.storeMeta}>{brand?.category?.replace(/_/g, ' ')} · {brand?.city || ''}</Text>

        {/* Creator-trust strip — Phase Salon-2 progressive disclosure.
              · 0 creators  → nothing here (the green ✓ next to name already
                              signals admin-verification)
              · 1-2 creators → chip "✓ Trusted by N creator(s)"
              · 3+ creators  → overlapping avatar cluster + count
            Different signal from `is_verified` (the green ✓): that's
            admin-approval; this is creator endorsement. Both can coexist;
            this is the creator-economy moat. */}
        {influencers.length > 0 && (
          influencers.length >= 3 ? (
            <View style={s.creatorClusterRow}>
              <View style={[s.avatarCluster, { width: 14 + 18 * Math.min(3, influencers.length) }]}>
                {influencers.slice(0, 3).map((inf, i) => (
                  <View
                    key={inf.influencer_id || i}
                    style={[
                      s.clusterAvatar,
                      {
                        left: i * 14,
                        backgroundColor: accent.accent,
                        borderColor: darkColors.bg2,
                        zIndex: 3 - i,
                      },
                    ]}>
                    {inf.profile_pic_url
                      ? <Text style={s.clusterAvatarInitial}>{(inf.name || '?')[0]}</Text>
                      : <Text style={s.clusterAvatarInitial}>{(inf.name || '?')[0]}</Text>}
                  </View>
                ))}
              </View>
              <Text style={[s.creatorTrustText, { color: accent.accent }]}>
                Trusted by {influencers.length} creators
              </Text>
            </View>
          ) : (
            <View style={[s.creatorChip, { backgroundColor: `${accent.accent}15`, borderColor: `${accent.accent}55` }]}>
              <Text style={[s.creatorChipText, { color: accent.accent }]}>
                ✓ Trusted by {influencers.length} creator{influencers.length > 1 ? 's' : ''}
              </Text>
            </View>
          )
        )}

        {/* Trust chips — pay-at-salon + free-cancel signals.
            Derived from template metadata so no per-brand opt-in needed:
              · "Pay at salon"      ← brand_config has a walkin_pay action OR
                                       availing_modes contains walkin_pay/pay_at_store
              · "Free cancellation" ← card_config.booking_config.refund_policy exists
            Borrowed from Luzo's trust-signal pattern; adapted to surface only
            when the schema actually supports them. */}
        {renderTrustChips(store?.template, accent.accent)}

        {/* Schema-driven brand action row when template surfaces brand_config.
            Falls back to legacy hardcoded contact buttons when not. */}
        {brandConfig ? (
          <BrandActionRow
            brandConfig={brandConfig}
            brand={brand}
            brandData={brandData}
            tracking={tracking}
            onAction={dispatchBrandAction}
            accent={accentHex}
          />
        ) : (
          <View style={s.contactRow}>
            {['📞 Call', '💬 WhatsApp', '📍 Map'].map(label => (
              <TouchableOpacity key={label} style={[s.contactBtn, { borderColor: `${accent.accent}33` }]}>
                <Text style={[s.contactBtnText, { color: accent.accent }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
    </View>
  );
}

// ── Trust-chip helpers ────────────────────────────────────────────────────
// Phase Salon-1 — derives the brand-level trust signals from template metadata
// rather than per-brand opt-ins. Returns a small chip strip beneath the brand
// name + category line.

function renderTrustChips(template, accentColor) {
  if (!template) return null;

  const availingModes = template.availing_modes || [];
  const brandActions = template.brand_config?.actions || [];
  const refundPolicy = template.card_config?.booking_config?.refund_policy;

  const chips = [];

  // Pay-at-salon — surface if walkin_pay / pay_at_store is supported at the
  // brand level OR per-item.
  const hasPayAtSalon =
    availingModes.includes('walkin_pay') ||
    availingModes.includes('pay_at_store') ||
    brandActions.some(a => a.action === 'walkin_pay');

  if (hasPayAtSalon) {
    chips.push({ key: 'pay_at_salon', icon: '💸', text: 'Pay at salon' });
  }

  // Free cancellation — surface if a refund policy exists on the booking_config.
  // The presence of any refund_policy string is treated as "cancellation supported."
  if (refundPolicy) {
    chips.push({ key: 'free_cancel', icon: '✕', text: 'Free cancellation' });
  }

  if (chips.length === 0) return null;

  return (
    <View style={s.trustRow}>
      {chips.map(c => (
        <View key={c.key} style={[s.trustChip, { borderColor: `${accentColor}55` }]}>
          <Text style={s.trustChipIcon}>{c.icon}</Text>
          <Text style={[s.trustChipText, { color: accentColor }]}>{c.text}</Text>
        </View>
      ))}
    </View>
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 18, fontWeight: '800', color: darkColors.text, flexShrink: 1 },
  verifiedBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#22C55E',                  // green-500
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedCheck: { fontSize: 10, fontWeight: '900', color: '#fff', lineHeight: 11 },
  storeMeta: { fontSize: 11, color: darkColors.textSecondary, marginTop: 2 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  trustChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1,
  },
  trustChipIcon: { fontSize: 10 },
  trustChipText: { fontSize: 10, fontWeight: '700' },

  // Phase Salon-2 — creator-trust progressive variants
  creatorChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
  },
  creatorChipText: { fontSize: 11, fontWeight: '800' },
  creatorClusterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8,
  },
  avatarCluster: { height: 22, position: 'relative' },
  clusterAvatar: {
    position: 'absolute', top: 0,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  clusterAvatarInitial: { fontSize: 10, fontWeight: '800', color: '#fff' },
  creatorTrustText: { fontSize: 11, fontWeight: '700' },

  // Phase Salon-2 — sticky "Brought to you by [creator]" header
  creatorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    paddingTop: 12,
  },
  creatorAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
  creatorAvatarFallback: { fontSize: 13, fontWeight: '800', color: '#fff' },
  creatorBarLabel: { fontSize: 12, fontWeight: '800', color: '#fff' },
  creatorBarSub: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  creatorBarChevron: { fontSize: 22, fontWeight: '300', color: 'rgba(255,255,255,0.9)' },
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
