import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { darkColors, fmtMoney, getBusinessAccent } from '../../theme/tokens';
import ProductCard from '../../components/cards/ProductCard';
import NewOfferCard from '../../components/cards/NewOfferCard';
import { followerApi } from '../../services/api';

/**
 * CategoryListScreen — stores within a super-category with products shown inline.
 *
 * KEY design pattern: shows products INLINE under each store, not just store cards.
 * Each store section: logo + info + influencer deal badges + 2-col product grid.
 */

export default function CategoryListScreen({ route, navigation }) {
  const { superCategory, subCategory, label, icon } = route.params || {};
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('deals');

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
    { key: 'deals', label: '✓ With Deals' },
    { key: 'nearest', label: '📍 Nearest' },
    { key: 'discount', label: '💰 Highest Discount' },
    { key: 'rated', label: '⭐ Top Rated' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{icon} {label}</Text>
          <Text style={styles.headerSub}>{stores.length} stores near Vijayawada</Text>
        </View>
      </View>

      {/* Search */}
      <TouchableOpacity style={styles.search}>
        <Text style={styles.searchText}>🔍 Search {label?.toLowerCase()} stores...</Text>
      </TouchableOpacity>

      {/* Sort/filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {sortFilters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.pill, activeSort === f.key && styles.pillActive]}
            onPress={() => setActiveSort(f.key)}
          >
            <Text style={[styles.pillText, activeSort === f.key && styles.pillTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading */}
      {loading && <ActivityIndicator color={darkColors.amber} size="large" style={{ marginTop: 40 }} />}

      {/* Store list */}
      {stores.map((store, sIdx) => (
        <View key={store.id || sIdx}>
          {/* Store header */}
          <View style={styles.storeHeader}>
            <View style={styles.storeRow}>
              <View style={[styles.storeLogo, { backgroundColor: getBusinessAccent(store.category).accent }]}>
                <Text style={styles.storeLogoText}>{store.business_name?.[0] || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{store.business_name}</Text>
                <Text style={styles.storeMeta}>{store.city} · {store.deal_count || 0} deals · 🟢 Open</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('BrandStore', { brandId: store.id })}>
                <Text style={styles.viewStore}>View Store →</Text>
              </TouchableOpacity>
            </View>

            {/* Influencer deal badges */}
            {store.offers && store.offers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.offerBadges}>
                {store.offers.map((offer, oIdx) => (
                  <View key={oIdx} style={[styles.offerBadge, { backgroundColor: getBusinessAccent(store.category).dim }]}>
                    <View style={[styles.offerBadgeAvatar, { backgroundColor: getBusinessAccent(store.category).accent }]}>
                      <Text style={styles.offerBadgeInitial}>{offer.influencer_name?.[0]}</Text>
                    </View>
                    <Text style={[styles.offerBadgeText, { color: getBusinessAccent(store.category).accent }]}>
                      {offer.influencer_name} · {offer.discount_value}% OFF
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Inline products (2-col grid) */}
          {store.products && store.products.length > 0 ? (
            <View style={styles.productGrid}>
              {store.products.slice(0, 4).map((product, pIdx) => {
                const isCarRental = store.category === 'car_rental' || store.category === 'bike_rental';
                return (
                  <View key={pIdx} style={styles.productGridItem}>
                    <ProductCard
                      product={product}
                      brand={{ name: store.business_name, category: store.category, locality: store.city }}
                      discount={store.offers?.[0] ? { type: 'percentage', value: store.offers[0].discount_value } : null}
                      influencer={store.offers?.[0] ? { name: store.offers[0].influencer_name, avatar_initial: store.offers[0].influencer_name?.[0] } : null}
                      onPress={() => {
                        if (isCarRental) {
                          const specs = typeof product.variants_json === 'string' ? JSON.parse(product.variants_json || '{}') : (product.variants_json || {});
                          navigation.navigate('CarDetail', {
                            vehicle: { name: product.name, specs: specs.specs || {}, location: store.city, distance: '1.2 km', rating: '4.5', trips: 42 },
                            pricing: { day_rate: product.price, ...specs },
                            discount: store.offers?.[0] ? { value: store.offers[0].discount_value, influencer_name: store.offers[0].influencer_name } : null,
                          });
                        } else {
                          navigation.navigate('BrandStore', { brandId: store.id });
                        }
                      }}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDealsBanner}>
              <Text style={styles.noDealsText}>No active deals · </Text>
              <Text style={[styles.noDealsText, { color: darkColors.amber }]}>Get Directions →</Text>
            </View>
          )}

          {/* Divider */}
          {sIdx < stores.length - 1 && <View style={styles.divider} />}
        </View>
      ))}

      {/* Empty state */}
      {!loading && stores.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏪</Text>
          <Text style={styles.emptyTitle}>No stores found</Text>
          <Text style={styles.emptyText}>Check back later for stores in this category</Text>
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.bg2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: darkColors.card,
    borderWidth: 1,
    borderColor: darkColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 14,
    color: darkColors.text,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkColors.text,
  },
  headerSub: {
    fontSize: 10,
    color: darkColors.textSecondary,
  },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 10,
    backgroundColor: darkColors.card,
    borderWidth: 1,
    borderColor: darkColors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchText: {
    fontSize: 13,
    color: darkColors.textMuted,
  },
  pills: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 6,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: darkColors.border,
  },
  pillActive: {
    borderColor: darkColors.green,
    backgroundColor: darkColors.greenDim,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: darkColors.textSecondary,
  },
  pillTextActive: {
    color: darkColors.green,
  },
  storeHeader: {
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogoText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: darkColors.text,
  },
  storeMeta: {
    fontSize: 9,
    color: darkColors.textSecondary,
  },
  viewStore: {
    fontSize: 10,
    color: darkColors.amber,
  },
  offerBadges: {
    marginTop: 4,
    marginBottom: 6,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
  },
  offerBadgeAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerBadgeInitial: {
    fontSize: 6,
    fontWeight: '700',
    color: '#fff',
  },
  offerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 10,
  },
  productGridItem: {
    width: '48%',
  },
  noDealsBanner: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  noDealsText: {
    fontSize: 10,
    color: darkColors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: darkColors.border,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkColors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
    color: darkColors.textSecondary,
  },
});
