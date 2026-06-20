import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { creatorVibe as C, fmtMoney, getBusinessAccentLight, fonts } from '../../theme/tokens';
import ProductCard from '../../components/cards/ProductCard';
import NewOfferCard from '../../components/cards/NewOfferCard';
import ServiceCard from '../../components/cards/ServiceCard';
import InfluencerStoryRow from '../../components/InfluencerStoryRow';
import CategoryGrid from '../../components/CategoryGrid';
import { followerApi } from '../../services/api';
import { buildTracking } from '../../utils/tracking';
import { useAppLocation } from '../../contexts/LocationContext';
import LocationSheet from '../../components/LocationSheet';
import { isEnabled } from '../../config/featureFlags';
import SectionRenderer, { hasEngineContent } from '../../components/SectionRenderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * HomeScreenV2 — Creator Vibe (cream/terracotta) products-first feed. (Flow 52.1)
 *
 * Layout (scrollable):
 * 1. Location header + notification bell
 * 2. Search bar → FindScreen
 * 3. InfluencerStoryRow
 * 4. CategoryGrid (2x4)
 * 5. "Hot Products" — ProductCard in 2-col grid
 * 6. OfferCard (interspersed)
 * 7. "Trending Products" — horizontal ProductCard scroll
 * 8. "Services & Experiences" — horizontal ServiceCard scroll
 * 9. "Discover Influencers" — suggestion cards
 */

export default function HomeScreenV2({ navigation }) {
  const [feed, setFeed] = useState([]);
  const [stories, setStories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState(null); // section-engine payload (flag on)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [userInitial, setUserInitial] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [areaName, setAreaName] = useState(null);
  const [locOpen, setLocOpen] = useState(false);
  const { location } = useAppLocation();
  const { latitude, longitude } = location;
  const loc = { latitude, longitude };

  // Real follower initial for the header avatar + login state for the Stories
  // "Follow" buttons (shown only for a logged-in follower). No fabrication.
  useEffect(() => {
    AsyncStorage.multiGet(['inflx_user', 'inflx_token'])
      .then(pairs => {
        const map = Object.fromEntries(pairs);
        setIsLoggedIn(!!map['inflx_token']);
        try { const u = map['inflx_user'] && JSON.parse(map['inflx_user']); const n = u?.name || u?.full_name; if (n) setUserInitial(String(n).trim()[0].toUpperCase()); } catch (_) {}
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      // Section engine (Phase C) — when the flag is on, render Home from the
      // backend { sections } payload. On error or empty, fall back to the
      // hardcoded path below (never a blank Home). Contract: follower-section-home.
      if (isEnabled('SECTION_ENGINE_HOME')) {
        try {
          const secRes = await followerApi.getHomeSections(loc);
          const secs = secRes?.data?.sections || [];
          if (secRes?.data?.area_name) setAreaName(secRes.data.area_name); // works logged-out
          if (secs.length) {
            setSections(secs);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        } catch (e) {
          // fall through to the hardcoded feed
        }
        setSections(null);
      }

      const [feedRes, storiesRes, categoriesRes] = await Promise.all([
        followerApi.getHomeFeed(pageNum, loc).catch(() => ({ data: { items: [] } })),
        followerApi.getStories().catch(() => ({ data: { stories: [] } })),
        followerApi.getCategories().catch(() => ({ data: { categories: [] } })),
      ]);

      const feedItems = feedRes?.data?.items || feedRes?.data?.offers || [];
      if (refresh || pageNum === 1) {
        setFeed(feedItems);
      } else {
        setFeed(prev => [...prev, ...feedItems]);
      }

      if (storiesRes?.data?.stories) setStories(storiesRes.data.stories);
      if (categoriesRes?.data?.categories) setCategories(categoriesRes.data.categories);
    } catch (err) {
      console.error('HomeScreen load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Re-fetch when the resolved location changes (GPS resolves after first render).
  }, [latitude, longitude]);

  useEffect(() => { loadData(); }, [loadData]);

  // Store the follower's location + show the reverse-geocoded area name in the
  // header (logged-in only — the endpoint is authed). Best-effort; the feed never
  // depends on it. (Auto device-GPS lands with the next APK; coords are the
  // selected/default location for now.)
  useEffect(() => {
    if (!isLoggedIn || !latitude || !longitude) return;
    let alive = true;
    followerApi.updateLocation(latitude, longitude)
      .then(r => { if (alive && r?.data?.area_name) setAreaName(r.data.area_name); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isLoggedIn, latitude, longitude]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadData(1, true);
  };

  // Separate feed items by type
  const productItems = feed.filter(item => item.type === 'product' || item.product);
  const offerItems = feed.filter(item => item.type === 'offer' || (item.offer_type && !item.product));
  const serviceItems = feed.filter(item => item.type === 'service');

  // For hot products, take first 6
  const hotProducts = productItems.slice(0, 6);
  const trendingProducts = productItems.slice(6, 12);

  // Phase C: render from the section engine when the flag is on AND the backend
  // returned shelves; otherwise the hardcoded path below (safe fallback).
  const sectionsActive = isEnabled('SECTION_ENGINE_HOME') && hasEngineContent(sections);

  // Admin-editable greeting/tagline from the home 'header' shelf (section_config),
  // falling back to the defaults when absent. Contract: admin-section-manager-v2.
  const headerShelf = Array.isArray(sections)
    ? sections.find(s => s.shelf_key === 'header' || s.key === 'header')
    : null;
  const greeting = headerShelf?.config?.greeting || "Hey, what's good today?";
  const tagline = headerShelf?.config?.tagline || 'Shop · Support · Stay Inspired';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.brown} />}
    >
      {/* Header — location (tap to switch) · bell · profile avatar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.loc} onPress={() => navigation.navigate('LocationSearch')} activeOpacity={0.7}>
          <Text style={styles.locLabel}>📍 DISCOVER IN</Text>
          <Text style={styles.locCity} numberOfLines={1}>{location.label || areaName || 'Vijayawada'} <Text style={styles.locArrow}>▾</Text></Text>
        </TouchableOpacity>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={{ fontSize: 16 }}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('ProfileTab')} activeOpacity={0.8}>
            <Text style={styles.avatarTxt}>{userInitial || '🙂'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LocationSheet visible={locOpen} onClose={() => setLocOpen(false)} navigation={navigation} />

      {/* Greeting (admin-editable via the home 'header' shelf) */}
      <View style={styles.greetWrap}>
        <Text style={styles.greet}>{greeting}</Text>
        <Text style={styles.greetSub}>{tagline}</Text>
      </View>

      {/* Search bar + filter */}
      <View style={styles.searchRow}>
        <TouchableOpacity style={styles.search} onPress={() => navigation.navigate('Find')} activeOpacity={0.8}>
          <Text style={styles.searchText}>🔍  Search creators, products, stores…</Text>
          <View style={styles.filterBtn}><Text style={styles.filterTxt}>⊕</Text></View>
        </TouchableOpacity>
      </View>

      {sectionsActive ? (
        <SectionRenderer sections={sections} navigation={navigation} canFollow={isLoggedIn} context={{ lat: latitude, lng: longitude }} />
      ) : (
      <>
      {/* Influencer stories */}
      <InfluencerStoryRow
        stories={stories.map(s => ({
          ...s,
          avatar_initial: s.name?.[0],
        }))}
        onPressStory={(story) => navigation.navigate('InfluencerStore', { handle: story.handle })}
        onPressMore={() => navigation.navigate('Find')}
      />

      {/* Category grid */}
      <CategoryGrid
        categories={categories}
        onPressCategory={(cat) => {
          if (cat.key === 'all') {
            navigation.navigate('Find');
          } else {
            // Phase 1 re-point: Eat (and every vertical) → the agreed Category
            // screen (CategoryList renders the section engine), NOT the legacy
            // DiningHome vibe-tiles screen.
            navigation.navigate('CategoryList', { superCategory: cat.key, label: cat.label, icon: cat.icon });
          }
        }}
      />

      {/* Hot Products section */}
      {hotProducts.length > 0 && (
        <>
          <SectionHeader title="🔥 Hot Products Near You" onSeeAll={() => {}} />
          <View style={styles.productGrid}>
            {hotProducts.map((item, i) => {
              const category = item.brand_category || item.brand?.category;
              const isCarRental = category === 'car_rental' || category === 'bike_rental';
              return (
                <View key={item.id || i} style={styles.productGridItem}>
                  <ProductCard
                    product={item.product || item}
                    brand={item.brand || { name: item.brand_name, category, locality: item.brand_city }}
                    discount={item.discount || (item.discount_value ? { type: item.offer_type || 'percentage', value: item.discount_value } : null)}
                    influencer={item.influencer}
                    onPress={() => {
                      if (isCarRental) {
                        navigation.navigate('CarDetail', {
                          vehicle: { name: (item.product || item).name, specs: (item.product || item).variants_json?.specs || {}, location: item.brand_city || item.brand?.locality, distance: '1.2 km', rating: '4.5', trips: 42 },
                          pricing: { day_rate: (item.product || item).price, ...(item.product || item).variants_json },
                          discount: item.discount || (item.discount_value ? { value: item.discount_value, influencer_name: item.influencer?.name } : null),
                          tracking: item.tracking,
                        });
                      } else {
                        // Single-product detail (Phase 4 routing). Pass the
                        // offer so getStoreProducts can scope the result to
                        // the correct brand's product set.
                        const product = item.product || item;
                        navigation.navigate('ProductDetail', {
                          offer: { id: item.tracking?.offer_id || item.offer?.id, offer_type: item.offer_type, discount_value: item.discount_value, availing_modes: item.availing_modes || item.offer?.availing_modes },
                          brand: item.brand || { id: item.brand_id, name: item.brand_name, category, locality: item.brand_city },
                          store: { instagram_handle: item.influencer?.handle || item.influencer?.instagram_handle, name: item.influencer?.name },
                          influencer: item.influencer,
                          selectedProductId: product.id,
                          product,
                          tracking: buildTracking(item),
                          trackingParams: buildTracking(item),
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

      {/* Interspersed offer card */}
      {offerItems.length > 0 && (
        <NewOfferCard
          store={{ name: offerItems[0].brand_name || offerItems[0].brand?.name, category: offerItems[0].brand_category || offerItems[0].brand?.category }}
          dealType="shop"
          dealLabel={`Shop-level deal`}
          discountValue={`${offerItems[0].discount_value || 15}%`}
          tags={[]}
          influencer={offerItems[0].influencer}
          onPress={() => navigation.navigate('BrandStore', {
            brandId: offerItems[0].brand_id,
            tracking: buildTracking(offerItems[0]),
          })}
        />
      )}

      {/* Trending Products — horizontal scroll */}
      {trendingProducts.length > 0 && (
        <>
          <SectionHeader title="🛍️ Trending Products" onSeeAll={() => {}} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {trendingProducts.map((item, i) => {
              const category = item.brand_category || item.brand?.category;
              const isCarRental = category === 'car_rental' || category === 'bike_rental';
              const product = item.product || item;
              return (
                <View key={item.id || i} style={styles.horizontalCard}>
                  <ProductCard
                    product={product}
                    brand={item.brand || { name: item.brand_name, category }}
                    discount={item.discount || (item.discount_value ? { type: 'percentage', value: item.discount_value } : null)}
                    influencer={item.influencer}
                    onPress={() => {
                      if (isCarRental) {
                        navigation.navigate('CarDetail', {
                          vehicle: { name: product.name, specs: product.variants_json?.specs || {}, location: item.brand_city, distance: '1.2 km' },
                          pricing: { day_rate: product.price, ...product.variants_json },
                          discount: item.discount || (item.discount_value ? { value: item.discount_value, influencer_name: item.influencer?.name } : null),
                          tracking: item.tracking,
                        });
                      } else {
                        navigation.navigate('ProductDetail', {
                          offer: { id: item.tracking?.offer_id || item.offer?.id, offer_type: item.offer_type, discount_value: item.discount_value, availing_modes: item.availing_modes || item.offer?.availing_modes },
                          brand: item.brand || { id: item.brand_id, name: item.brand_name, category, locality: item.brand_city },
                          store: { instagram_handle: item.influencer?.handle || item.influencer?.instagram_handle, name: item.influencer?.name },
                          influencer: item.influencer,
                          selectedProductId: product.id,
                          product,
                          tracking: buildTracking(item),
                          trackingParams: buildTracking(item),
                        });
                      }
                    }}
                  />
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Services & Experiences — horizontal scroll */}
      {serviceItems.length > 0 && (
        <>
          <SectionHeader title="✨ Services & Experiences" onSeeAll={() => {}} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {serviceItems.map((item, i) => (
              <View key={item.id || i} style={styles.horizontalCard}>
                <ServiceCard
                  service={item.product || item}
                  businessType={item.brand_category || item.brand?.category}
                  location={item.brand_city || item.brand?.locality}
                  ctaLabel="Book Now"
                  priceUnit={item.price_unit || 'onwards'}
                  discount={item.discount || (item.discount_value ? { type: 'percentage', value: item.discount_value } : null)}
                  influencer={item.influencer}
                  onPress={() => navigation.navigate('BrandStore', {
                    brandId: item.brand_id,
                    tracking: buildTracking(item),
                  })}
                />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Empty state */}
      {!loading && feed.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>No deals yet</Text>
          <Text style={styles.emptyText}>Follow influencers to see their product deals, or browse categories above</Text>
        </View>
      )}
      </>
      )}

      {/* Trust band (recolored Home mockup .trust) — static chrome, no data. */}
      {!loading && (
        <View style={styles.trust}>
          <Text style={styles.trustItem}>🛡️  100% Authentic</Text>
          <Text style={styles.trustItem}>↩️  Easy Returns</Text>
          <Text style={styles.trustItem}>🔒  Secure Payment</Text>
        </View>
      )}

      {loading && (
        <ActivityIndicator color={C.brown} size="large" style={{ marginTop: 40 }} />
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAll}>See all →</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.screenBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 2,
  },
  loc: {},
  locLabel: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: fonts.sansSemiBold,
  },
  locCity: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
    fontFamily: fonts.sansBold,
    marginTop: 1,
  },
  locArrow: { fontSize: 12, color: C.brown },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 16, fontWeight: '800', color: C.brown, fontFamily: fonts.displayBlack },
  greetWrap: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 2 },
  greet: { fontSize: 25, fontWeight: '600', color: C.ink, lineHeight: 28, fontFamily: fonts.serifDisplay },
  greetSub: { fontSize: 12, fontWeight: '600', color: C.muted, marginTop: 3, fontFamily: fonts.sansSemiBold },
  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  search: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, elevation: 1,
  },
  searchText: {
    flex: 1,
    fontSize: 13,
    color: C.muted,
    fontFamily: fonts.sansMedium,
  },
  filterBtn: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center',
  },
  filterTxt: { fontSize: 14, color: C.onGold, fontWeight: '800' },
  trust: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 18, marginTop: 8, marginBottom: 4,
    backgroundColor: C.cream, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12,
  },
  trustItem: { fontSize: 11.5, fontWeight: '700', color: C.ink, fontFamily: fonts.sansSemiBold },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: C.ink,
    fontFamily: fonts.sansBold,
  },
  seeAll: {
    fontSize: 11,
    color: C.brown,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontFamily: fonts.sansBold,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 11,
  },
  productGridItem: {
    width: '48%',
  },
  horizontalScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 11,
  },
  horizontalCard: {
    width: 172,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 6,
    fontFamily: fonts.sansBold,
  },
  emptyText: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: fonts.sansRegular,
  },
});
