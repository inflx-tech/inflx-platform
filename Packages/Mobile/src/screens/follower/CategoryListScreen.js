import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { creatorVibe as C, fonts, getBusinessAccentLight } from '../../theme/tokens';

// Flow 52.6 — Creator Vibe recolor shim. Sort-pill active goes terracotta
// (was green success). Per-business accent (getBusinessAccentLight) stays on the
// store-card badges/chips as wayfinding. Visual only — getCategoryStores, the
// dining/shopping/booking layout dispatch, tracking, and all nav unchanged.
const P = {
  white: C.card, bg: C.screenBg, bg2: C.soft,
  border: C.line, ink: C.ink,
  muted: C.muted, muted2: C.muted, muted3: C.muted,
  yellow: C.brown, yellowText: C.brown, yellowPale: C.soft,
  success: C.brown, successPale: C.soft,
  danger: C.offer,
};
import ProductCard from '../../components/cards/ProductCard';
import { followerApi } from '../../services/api';
import { buildTrackingFromOffer } from '../../utils/tracking';
import { isEnabled } from '../../config/featureFlags';
import SectionRenderer, { hasEngineContent } from '../../components/SectionRenderer';
import { CategoryCircle } from '../../components/vibe';
import { useAppLocation } from '../../contexts/LocationContext';
import LocationSheet from '../../components/LocationSheet';

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

// schema key → sub-category chip label. Fashion variants collapse to one chip;
// unknown keys humanize. Used to derive the REAL sub-cat bar from live listings.
const SUBCAT_LABEL = {
  restaurant: 'Restaurants', bakery: 'Bakery',
  fashion: 'Fashion', fashion_walkin: 'Fashion', fashion_online: 'Fashion',
  footwear: 'Footwear', jewellery: 'Jewellery', electronics: 'Electronics',
  furniture: 'Furniture', florist: 'Florist', packaged_food: 'Packaged',
  grocery: 'Grocery', salon: 'Salons', beauty: 'Beauty', home_beauty: 'Home Beauty',
  car_rental: 'Cars', bike_rental: 'Bikes', function_hall: 'Halls',
  wedding_planner: 'Weddings',
};
function subcatLabel(key) {
  if (!key) return null;
  return SUBCAT_LABEL[key] || String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function CategoryListScreen({ route, navigation }) {
  const { superCategory, subCategory, label, icon } = route.params || {};
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubCat, setActiveSubCat] = useState('All');
  const [sections, setSections] = useState(null); // section-engine payload (flag on)

  const { location } = useAppLocation();
  const { latitude, longitude } = location;
  const [locOpen, setLocOpen] = useState(false);
  const isDining = superCategory === 'dining' || superCategory === 'eat';

  // Section engine (Phase C2): when on, render the category from
  // GET /v1/follower/section/category/:key via <SectionRenderer>. Inert + falls
  // back to the existing stores layout on error/empty. Default off → unchanged.
  useEffect(() => {
    if (!isEnabled('SECTION_ENGINE_CATEGORY') || !superCategory) return;
    let alive = true;
    followerApi.getCategorySections(superCategory, { latitude, longitude })
      .then(r => { if (alive) setSections(r?.data?.sections || []); })
      .catch(() => { if (alive) setSections(null); });
    return () => { alive = false; };
  }, [superCategory, latitude, longitude]);
  const sectionsActive = isEnabled('SECTION_ENGINE_CATEGORY') && hasEngineContent(sections);

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

  // Sub-category chips = the REAL distinct sub-types present in the live payload
  // (brand.category across the brand/product shelves), mapped to a label. "All"
  // first. No fabrication — a chip appears only if such listings exist.
  // Admin-curated chip labels from the subcat_chips shelf (config.chips), if set.
  const adminChips = useMemo(() => {
    const sc = Array.isArray(sections) ? sections.find(s => s.shelf_key === 'subcat_chips') : null;
    const chips = sc?.config?.chips;
    return Array.isArray(chips) && chips.length ? chips : null;
  }, [sections]);

  // Map a curated label back to an icon (best-effort), for the round circles.
  const iconForLabel = (label) => {
    const key = Object.keys(SUBCAT_LABEL).find(k => SUBCAT_LABEL[k] === label);
    return key ? getBusinessAccentLight(key).icon : '🏷️';
  };

  const subcats = useMemo(() => {
    const out = [{ label: 'All', icon: icon || '🧭' }];
    const seen = new Set(['All']);
    // Admin-curated chips win (display); else derive real sub-types from the payload.
    if (adminChips) {
      adminChips.forEach(l => { if (l && !seen.has(l)) { seen.add(l); out.push({ label: l, icon: iconForLabel(l) }); } });
      return out;
    }
    const add = (key) => {
      const l = subcatLabel(key);
      if (l && !seen.has(l)) { seen.add(l); out.push({ label: l, icon: getBusinessAccentLight(key).icon }); }
    };
    if (Array.isArray(sections)) {
      for (const sec of sections) {
        if (!Array.isArray(sec.items)) continue;
        if (sec.type === 'brands') sec.items.forEach(it => add(it.category));
        else if (sec.type === 'products') sec.items.forEach(it => add(it.brand?.category));
      }
    }
    return out;
  }, [sections, icon, adminChips]);

  // Drop the empty subcat_chips shelf (the screen renders the real bar) and
  // filter brand/product shelves to the active sub-category (client-side).
  const filteredSections = useMemo(() => {
    if (!Array.isArray(sections)) return sections;
    return sections
      .filter(sec => sec.shelf_key !== 'subcat_chips')
      .map(sec => {
        if (activeSubCat === 'All' || !Array.isArray(sec.items)) return sec;
        if (sec.type === 'brands')
          return { ...sec, items: sec.items.filter(it => subcatLabel(it.category) === activeSubCat) };
        if (sec.type === 'products')
          return { ...sec, items: sec.items.filter(it => subcatLabel(it.brand?.category) === activeSubCat) };
        return sec;
      });
  }, [sections, activeSubCat]);

  // Header "N places" — in section-engine mode the businesses come from the
  // sections, not `stores`, so stores.length showed 0 (walkthrough P8). Count
  // distinct brands across the rendered section items; fall back to stores.
  const placeCount = useMemo(() => {
    if (!sectionsActive) return stores.length;
    const ids = new Set();
    (Array.isArray(filteredSections) ? filteredSections : []).forEach(sec =>
      (Array.isArray(sec.items) ? sec.items : []).forEach(it => {
        const id = it.brand?.id || (sec.type === 'brands' ? it.id : null);
        if (id) ids.add(id);
      }));
    return ids.size || stores.length;
  }, [sectionsActive, filteredSections, stores.length]);

  // ── Render helpers ──────────────────────────────────────────────────────

  function renderDiningCard(store, sIdx) {
    const accent = getBusinessAccentLight(store.category).accent;
    const accentDim = getBusinessAccentLight(store.category).pale;
    const bestOffer = store.offers?.[0];
    const otherCreators = (store.offers || []).slice(1);
    const cuisines = store.cuisines || store.listing_data?.cuisines || [];
    const cuisineLine = Array.isArray(cuisines) ? cuisines.slice(0, 3).join(' · ') : '';
    const locality = store.locality_or_neighborhood || store.city || 'Vijayawada';
    const costForTwo = store.cost_for_two != null ? `₹${store.cost_for_two} for two` : null;

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

          {/* Phase 1 — open/closed pill on hero (top-left when present) */}
          {store.open_status && (
            <View style={[
              s.openHeroPill,
              { backgroundColor: store.open_status.is_open ? 'rgba(34,197,94,0.95)' : 'rgba(0,0,0,0.6)' },
            ]}>
              <Text style={s.openHeroPillText} numberOfLines={1}>
                {store.open_status.is_open ? '● Open' : '● Closed'}
              </Text>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={s.diningBody}>
          <Text style={s.diningName} numberOfLines={1}>{store.business_name}</Text>
          {cuisineLine ? <Text style={s.diningCuisine} numberOfLines={1}>{cuisineLine}</Text> : null}
          <Text style={s.diningMeta} numberOfLines={1}>
            {locality}
            {store.distance_text ? ` · ${store.distance_text}` : ''}
            {costForTwo ? ` · ${costForTwo}` : ''}
          </Text>

          {/* Deal aggregation row — Dineout-style "Flat X% off · +N more offers" */}
          {bestOffer?.discount_value ? (
            <View style={s.dealBar}>
              <Text style={[s.dealBarText, { color: accent }]} numberOfLines={1}>
                🔥 Flat {bestOffer.discount_value}% off
              </Text>
              {(store.deal_count || 0) > 1 && (
                <Text style={[s.dealBarMore, { color: accent }]}>+{(store.deal_count || 1) - 1} more</Text>
              )}
            </View>
          ) : null}

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
    const accent = getBusinessAccentLight(store.category).accent;
    const accentDim = getBusinessAccentLight(store.category).pale;
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
            <Text style={[s.noDealsText, { color: P.yellowText }]}>Get Directions →</Text>
          </View>
        )}

        {sIdx < stores.length - 1 && <View style={s.divider} />}
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const showSubBar = sectionsActive && subcats.length > 1;

  return (
    <View style={s.container}>
      {/* Compact header — back · title + place count · search */}
      <View style={s.header}>
        <TouchableOpacity style={s.ib} onPress={() => navigation.goBack()}>
          <Text style={s.ibTxt}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ttl} onPress={() => setLocOpen(true)} activeOpacity={0.7}>
          <Text style={s.t1} numberOfLines={1}>{icon} {label}</Text>
          <Text style={s.t2} numberOfLines={1}>📍 {location.label || 'Vijayawada'} · {placeCount} places ▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ib} onPress={() => navigation.navigate('Find')}>
          <Text style={s.ibTxt}>🔍</Text>
        </TouchableOpacity>
      </View>
      <LocationSheet visible={locOpen} onClose={() => setLocOpen(false)} navigation={navigation} />

      {/* Sticky sub-category bar — round-circle carousel of real sub-types */}
      {showSubBar && (
        <View style={s.subbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subbarInner}>
            {subcats.map(sc => (
              <CategoryCircle
                key={sc.label}
                category={sc}
                active={activeSubCat === sc.label}
                onPress={() => setActiveSubCat(sc.label)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={P.yellowText} size="large" style={{ marginTop: 40 }} />}

        {sectionsActive ? (
          <SectionRenderer sections={filteredSections} navigation={navigation} />
        ) : (
        <>
        {/* Layout dispatch (legacy fallback on engine error/empty) */}
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
        </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8,
  },
  ib: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.white, borderWidth: 1, borderColor: P.border,
    alignItems: 'center', justifyContent: 'center',
  },
  ibTxt: { fontSize: 15, color: P.ink },
  ttl: { flex: 1 },
  t1: { fontSize: 19, fontWeight: '600', color: P.ink, fontFamily: fonts.serifDisplay },
  t2: { fontSize: 10, color: P.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansSemiBold },
  subbar: {
    backgroundColor: P.bg,
    borderBottomWidth: 1, borderBottomColor: P.border,
  },
  subbarInner: { gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  subchip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 30,
    backgroundColor: P.white, borderWidth: 1, borderColor: P.border,
  },
  subchipOn: { backgroundColor: C.brown, borderColor: C.brown },
  subchipTxt: { fontSize: 11.5, fontWeight: '700', color: '#5E5345', fontFamily: fonts.sansBold },
  subchipTxtOn: { color: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: P.ink, fontFamily: fonts.serifDisplay },
  headerSub: { fontSize: 10, color: P.muted },
  search: {
    marginHorizontal: 20, marginBottom: 12, marginTop: 10,
    backgroundColor: P.white,
    borderWidth: 1, borderColor: P.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center',
  },
  searchText: { fontSize: 13, color: P.muted2 },
  pills: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: P.border,
  },
  pillActive: {
    borderColor: P.success,
    backgroundColor: P.successPale,
  },
  pillText: { fontSize: 11, fontWeight: '600', color: P.muted },
  pillTextActive: { color: P.success },

  // Dining card (Swiggy Dineout-style — restaurant first, menu hidden)
  diningCard: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: P.white,
    borderRadius: 16,
    borderWidth: 1, borderColor: P.border,
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
  openHeroPill: {
    position: 'absolute', top: 12, left: 12,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
  },
  openHeroPillText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  dealBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: P.border,
  },
  dealBarText: { fontSize: 12, fontWeight: '700', flex: 1 },
  dealBarMore: { fontSize: 11, fontWeight: '600' },
  diningBody: { padding: 14 },
  diningName: { fontSize: 16, fontWeight: '800', color: P.ink },
  diningCuisine: { fontSize: 11, color: P.muted, marginTop: 4 },
  diningMeta: { fontSize: 10, color: P.muted2, marginTop: 4 },
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
  moreCreators: { fontSize: 10, color: P.muted },

  // Legacy store-with-inline-products layout (Shopping + Booking)
  storeHeader: { paddingHorizontal: 20, marginBottom: 6 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storeLogo: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  storeLogoText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  storeName: { fontSize: 13, fontWeight: '700', color: P.ink },
  storeMeta: { fontSize: 9, color: P.muted },
  viewStore: { fontSize: 10, color: P.yellowText },
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
  noDealsText: { fontSize: 10, color: P.muted2 },
  divider: {
    height: 1, backgroundColor: P.border,
    marginHorizontal: 20, marginVertical: 12,
  },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: P.ink, marginBottom: 6 },
  emptyText: { fontSize: 12, color: P.muted },
});
