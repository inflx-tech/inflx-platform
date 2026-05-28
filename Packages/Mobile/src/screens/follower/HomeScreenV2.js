import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { brandPalette as P, fmtMoney, getBusinessAccentLight, fonts } from '../../theme/tokens';
import ProductCard from '../../components/cards/ProductCard';
import NewOfferCard from '../../components/cards/NewOfferCard';
import ServiceCard from '../../components/cards/ServiceCard';
import InfluencerStoryRow from '../../components/InfluencerStoryRow';
import CategoryGrid from '../../components/CategoryGrid';
import { followerApi } from '../../services/api';
import { buildTracking } from '../../utils/tracking';
import useLocation from '../../hooks/useLocation';

/**
 * HomeScreenV2 — dark theme, products-first feed matching the HTML mockup.
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const { latitude, longitude } = useLocation();
  const loc = { latitude, longitude };

  const loadData = useCallback(async (pageNum = 1, refresh = false) => {
    try {
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
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P.yellow} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>📍 Deals near you</Text>
          <Text style={styles.headerTitle}>Vijayawada <Text style={styles.headerArrow}>▼</Text></Text>
        </View>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{ fontSize: 14 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <TouchableOpacity style={styles.search} onPress={() => navigation.navigate('Find')}>
        <Text style={styles.searchText}>🔍 Search products, stores, services...</Text>
      </TouchableOpacity>

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
          } else if (cat.key === 'eat') {
            // Wave 4: dining redesign — eat routes to the new DiningHomeScreen
            // (light theme, restaurant component library). Other supercategories
            // continue to use the legacy CategoryList until they get their own
            // redesigned home in a later wave.
            navigation.navigate('DiningHome');
          } else {
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

      {loading && (
        <ActivityIndicator color={P.yellow} size="large" style={{ marginTop: 40 }} />
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
    backgroundColor: P.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 8,
  },
  headerSub: {
    fontSize: 9,
    color: P.muted2,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: fonts.monoMedium,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: P.ink,
    fontFamily: fonts.displayBlack,
  },
  headerArrow: {
    fontSize: 11,
    color: P.yellowText,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: P.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: P.white,
    borderWidth: 1.5,
    borderColor: P.ink,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchText: {
    fontSize: 12.5,
    color: P.muted2,
    fontFamily: fonts.sansRegular,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: P.ink,
    fontFamily: fonts.displayBlack,
  },
  seeAll: {
    fontSize: 10,
    color: P.yellowText,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontFamily: fonts.monoBold,
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
    fontWeight: '900',
    color: P.ink,
    marginBottom: 6,
    fontFamily: fonts.displayBlack,
  },
  emptyText: {
    fontSize: 12,
    color: P.muted,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: fonts.sansRegular,
  },
});
