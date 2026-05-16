import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { darkColors, getBusinessAccent } from '../../theme/tokens';
import ProductCard from '../../components/cards/ProductCard';
import { followerApi } from '../../services/api';
import { buildTrackingFromOffer } from '../../utils/tracking';

/**
 * CategoryListScreen — stores in a super-category.
 *
 * Layout differs by super-category:
 *
 *   • DINING (restaurant / bakery) — Swiggy Dineout-style:
 *     restaurant cards ONLY (no inline menu). Each card surfaces logo,
 *     name, cuisine + area, deal badge, and a creator endorsement chip.
 *     Tap → BrandStore which renders the full menu and the booking CTAs.
 *
 *   • SHOPPING (fashion / florist / packaged_food) — 2-col product grid
 *     inline under each store (Swiggy Insta-Mart / Amazon style).
 *     Tap a product → ProductDetail; tap "View Store" → BrandStore.
 *
 *   • BOOKING (salon / car_rental / function_hall / wedding_planner) —
 *     same inline grid as Shopping but service items / cars are atomic
 *     so tapping one routes to category-specific detail (CarDetail) or
 *     ProductDetail.
 *
 * The split is rooted in user mental model: people choose a restaurant
 * by vibe, then browse the menu inside; people choose products from a
 * mix of stores. Showing menu items in the restaurant-list view forced
 * a wrong tap target and surfaced "Missing creator handle" errors.
 */

const CATEGORY_EMOJI = {
  restaurant:     '🍽️',
  bakery:         '🧁',
  salon:          '💇',
  car_rental:     '🚗',
  bike_rental:    '🏍️',
  fashion:        '👗',
  fashion_walkin: '👗',
  fashion_online: '👕',
  florist:        '💐',
  packaged_food:  '🥫',
  function_hall:  '🎉',
  wedding_planner:'💒',
};

export default function CategoryListScreen({ route, navigation }) {
  const { superCategory, subCategory, label, icon } = route.params || {};
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSort, setActiveSort] = useState('deals');

  const isDining = superCategory === 'dining' || superCategory === 'eat';

  useEffect(() => {
    async function load() {
      try {
        const res = await followerApi.getCategoryStores?.(superCategory, { sub_category: subCategory });
        if (res?.data?.stores) {
          setStores(res.data.stores);
        }
      } catch (err) {
        console.error('CategoryListScreen load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [superCategory, subCategory]);

  const sortFilters = [
    { key: 'deals',    label: '✓ With Deals' },
    { key: 'nearest',  label: '📍 Nearest' },
    { key: 'discount', label: '💰 Highest Discount' },
    { key: 'rated',    label: '⭐ Top Rated' },
  ];

  // ── Render helpers ──────────────────────────────────────────────────────

  function renderDiningCard(store, sIdx) {
    const accent = getBusinessAccent(store.category).accent;
    const accentDim = getBusinessAccent(store.category).dim;
    const bestOffer = store.offers?.[0];
    const otherCreators = (store.offers || []).slice(1);
    const cuisines = store.listing_data?.cuisines || store.cuisines || [];
    const cuisineLine = Array.isArray(cuisines) ? cuisines.slice(0, 3).join(' · ') : '';

    return (
      <TouchableOpacity
        key={store.id || sIdx}
        style={s.diningCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('BrandStore', {
          brandId: store.id,
          brandName: store.business_name,
          tracking: buildTrackingFromOffer(bestOffer),
        })}
      >
        {/* Photo / logo */}
        <View style={[s.diningHero, { backgroundColor: accentDim }]}>
          {store.cover_image_url ? (
            <Image source={{ uri: store.cover_image_url }} style={s.diningHeroImg} resizeMode="cover" />
          ) : (
            <Text style={s.diningHeroEmoji}>{CATEGORY_EMOJI[store.category] || icon}</Text>
          )}

          {/* Deal badge */}
          {bestOffer?.discount_value ? (
            <View style={[s.diningBadge, { backgroundColor: accent }]}>
              <Text style={s.diningBadgeText}>{bestOffer.discount_value}% OFF</Text>
            </View>
          ) : null}
        </View>

        {/* Body */}
        <View style={s.diningBody}>
          <Text style={s.diningName} numberOfLines={1}>{store.business_name}</Text>
          {cuisineLine ? <Text style={s.diningCuisine} numberOfLines={1}>{cuisineLine}</Text> : null}
          <Text style={s.diningMeta} numberOfLines={1}>
            {store.city || 'Vijayawada'}{store.distance_text ? ` · ${store.distance_text}` : ''}{store.deal_count ? ` · ${store.deal_count} deal${store.deal_count > 1 ? 's' : ''}` : ''}
          </Text>

          {/* Creator endorsement chip(s) */}
          {bestOffer?.influencer_name && (
            <View style={s.creatorRow}>
              <View style={[s.creatorChip, { backgroundColor: accentDim, borderColor: accent + '40' }]}>
                <View style={[s.creatorAvatar, { backgroundColor: accent }]}>
                  <Text style={s.creatorInitial}>{bestOffer.influencer_name[0]}</Text>
                </View>
                <Text style={[s.creatorChipText, { color: accent }]} numberOfLines={1}>
                  @{bestOffer.instagram_handle || bestOffer.influencer_name} recommends
                </Text>
              </View>
              {otherCreators.length > 0 && (
                <Text style={s.moreCreators}>+ {otherCreators.length} more</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderInlineProductStore(store, sIdx) {
    const accent = getBusinessAccent(store.category).accent;
    const accentDim = getBusinessAccent(store.category).dim;
    const bestOffer = store.offers?.[0];

    return (
      <View key={store.id || sIdx}>
        {/* Store header */}
        <View style={s.storeHeader}>
          <View style={s.storeRow}>
            <View style={[s.storeLogo, { backgroundColor: accent }]}>
              <Text style={s.storeLogoText}>{store.business_name?.[0] || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.storeName}>{store.business_name}</Text>
              <Text style={s.storeMeta}>
                {store.city}{store.deal_count ? ` · ${store.deal_count} deals` : ''} · 🟢 Open
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('BrandStore', {
              brandId: store.id,
              brandName: store.business_name,
              tracking: buildTrackingFromOffer(bestOffer),
            })}>
              <Text style={s.viewStore}>View Store →</Text>
            </TouchableOpacity>
          </View>

          {/* Influencer deal badges */}
          {store.offers && store.offers.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.offerBadges}>
              {store.offers.map((offer, oIdx) => (
                <View key={oIdx} style={[s.offerBadge, { backgroundColor: accentDim }]}>
                  <View style={[s.offerBadgeAvatar, { backgroundColor: accent }]}>
                    <Text style={s.offerBadgeInitial}>{offer.influencer_name?.[0]}</Text>
                  </View>
                  <Text style={[s.offerBadgeText, { color: accent }]}>
                    {offer.influencer_name} · {offer.discount_value}% OFF
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Inline products (2-col grid) */}
        {store.products && store.products.length > 0 ? (
          <View style={s.productGrid}>
            {store.products.slice(0, 4).map((product, pIdx) => {
              const isCarRental = store.category === 'car_rental' || store.category === 'bike_rental';
              return (
                <View key={pIdx} style={s.productGridItem}>
                  <ProductCard
                    product={product}
                    brand={{ name: store.business_name, category: store.category, locality: store.city }}
                    discount={bestOffer ? { type: 'percentage', value: bestOffer.discount_value } : null}
                    influencer={bestOffer ? { name: bestOffer.influencer_name, avatar_initial: bestOffer.influencer_name?.[0] } : null}
                    onPress={() => {
                      if (isCarRental) {
                        const specs = typeof product.variants_json === 'string' ? JSON.parse(product.variants_json || '{}') : (product.variants_json || {});
                        navigation.navigate('CarDetail', {
                          vehicle: { name: product.name, specs: specs.specs || {}, location: store.city, distance: '1.2 km', rating: '4.5', trips: 42 },
                          pricing: { day_rate: product.price, ...specs },
                          discount: bestOffer ? { value: bestOffer.discount_value, influencer_name: bestOffer.influencer_name } : null,
                          tracking: buildTrackingFromOffer(bestOffer),
                        });
                      } else {
                        navigation.navigate('ProductDetail', {
                          offer: bestOffer ? {
                            id: bestOffer.offer_id || bestOffer.id,
                            offer_type: bestOffer.offer_type || 'percentage',
                            discount_value: bestOffer.discount_value,
                            availing_modes: bestOffer.availing_modes,
                          } : null,
                          brand: { id: store.id, name: store.business_name, category: store.category, locality: store.city, city: store.city },
                          store: { instagram_handle: bestOffer?.instagram_handle, name: bestOffer?.influencer_name },
                          influencer: bestOffer ? { id: bestOffer.influencer_id, name: bestOffer.influencer_name, instagram_handle: bestOffer.instagram_handle } : null,
                          selectedProductId: product.id,
                          product,
                          tracking: buildTrackingFromOffer(bestOffer),
                          trackingParams: buildTrackingFromOffer(bestOffer),
                        });
                      }
                    }}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={s.noDealsBanner}>
            <Text style={s.noDealsText}>No active deals · </Text>
            <Text style={[s.noDealsText, { color: darkColors.amber }]}>Get Directions →</Text>
          </View>
        )}

        {sIdx < stores.length - 1 && <View style={s.divider} />}
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{icon} {label}</Text>
          <Text style={s.headerSub}>{stores.length} stores near Vijayawada</Text>
        </View>
      </View>

      <TouchableOpacity style={s.search}>
        <Text style={s.searchText}>🔍 Search {label?.toLowerCase()} stores...</Text>
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pills}>
        {sortFilters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.pill, activeSort === f.key && s.pillActive]}
            onPress={() => setActiveSort(f.key)}
          >
            <Text style={[s.pillText, activeSort === f.key && s.pillTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator color={darkColors.amber} size="large" style={{ marginTop: 40 }} />}

      {/* Layout dispatch */}
      {isDining
        ? stores.map(renderDiningCard)
        : stores.map(renderInlineProductStore)}

      {!loading && stores.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🏪</Text>
          <Text style={s.emptyTitle}>No stores found</Text>
          <Text style={s.emptyText}>Check back later for stores in this category</Text>
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg2 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: darkColors.card,
    borderWidth: 1, borderColor: darkColors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 14, color: darkColors.text },
  headerTitle: { fontSize: 16, fontWeight: '700', color: darkColors.text },
  headerSub: { fontSize: 10, color: darkColors.textSecondary },
  search: {
    marginHorizontal: 20, marginBottom: 12, marginTop: 10,
    backgroundColor: darkColors.card,
    borderWidth: 1, borderColor: darkColors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center',
  },
  searchText: { fontSize: 13, color: darkColors.textMuted },
  pills: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: darkColors.border,
  },
  pillActive: {
    borderColor: darkColors.green,
    backgroundColor: darkColors.greenDim,
  },
  pillText: { fontSize: 11, fontWeight: '600', color: darkColors.textSecondary },
  pillTextActive: { color: darkColors.green },

  // Dining card (Swiggy Dineout-style — restaurant first, menu hidden)
  diningCard: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: darkColors.card,
    borderRadius: 16,
    borderWidth: 1, borderColor: darkColors.border,
    overflow: 'hidden',
  },
  diningHero: {
    height: 150,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  diningHeroImg: { width: '100%', height: '100%' },
  diningHeroEmoji: { fontSize: 56 },
  diningBadge: {
    position: 'absolute', top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12,
  },
  diningBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  diningBody: { padding: 14 },
  diningName: { fontSize: 16, fontWeight: '800', color: darkColors.text },
  diningCuisine: { fontSize: 11, color: darkColors.textSecondary, marginTop: 4 },
  diningMeta: { fontSize: 10, color: darkColors.textMuted, marginTop: 4 },
  creatorRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, gap: 8,
  },
  creatorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
    flexShrink: 1,
  },
  creatorAvatar: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  creatorInitial: { fontSize: 9, fontWeight: '800', color: '#fff' },
  creatorChipText: { fontSize: 10, fontWeight: '700' },
  moreCreators: { fontSize: 10, color: darkColors.textSecondary },

  // Legacy store-with-inline-products layout (Shopping + Booking)
  storeHeader: { paddingHorizontal: 20, marginBottom: 6 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storeLogo: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  storeLogoText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  storeName: { fontSize: 13, fontWeight: '700', color: darkColors.text },
  storeMeta: { fontSize: 9, color: darkColors.textSecondary },
  viewStore: { fontSize: 10, color: darkColors.amber },
  offerBadges: { marginTop: 4, marginBottom: 6 },
  offerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, marginRight: 6,
  },
  offerBadgeAvatar: {
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  offerBadgeInitial: { fontSize: 6, fontWeight: '700', color: '#fff' },
  offerBadgeText: { fontSize: 9, fontWeight: '700' },
  productGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, paddingBottom: 6, gap: 10,
  },
  productGridItem: { width: '48%' },
  noDealsBanner: {
    flexDirection: 'row',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  noDealsText: { fontSize: 10, color: darkColors.textMuted },
  divider: {
    height: 1, backgroundColor: darkColors.border,
    marginHorizontal: 20, marginVertical: 12,
  },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: darkColors.text, marginBottom: 6 },
  emptyText: { fontSize: 12, color: darkColors.textSecondary },
});
