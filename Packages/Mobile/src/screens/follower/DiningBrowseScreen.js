/**
 * DiningBrowseScreen — Wave 4B: filtered restaurant browse surface.
 *
 * Layout (mockup Flow 1.3):
 *   - App bar (back · "Browse" · sort glyph)
 *   - Search bar (visual; pressing it focuses the input)
 *   - Horizontal scroll-x of active filter chips + a "Filters" button
 *     that opens the bottom sheet
 *   - Result count + map-view link (map link is a placeholder for now)
 *   - Vertical list of RestaurantCard
 *
 * Filter state lives in this screen and is passed into FilterSheet via
 * props. On apply, the sheet calls back with the updated filter object;
 * the screen re-queries.
 *
 * Initial filters come from route.params.initialVibe (set by
 * DiningHomeScreen when the follower tapped a vibe tile).
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brandPalette as lightColors, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import { FilterChip } from '../../components/restaurant';
import FilterSheet from '../../components/restaurant/FilterSheet';
import { buildTrackingFromOffer } from '../../utils/tracking';

const SORT_OPTIONS = [
  { key: 'distance',  label: 'Distance' },
  { key: 'rating',    label: 'Rating' },
  { key: 'cost_asc',  label: 'Cost: low → high' },
  { key: 'cost_desc', label: 'Cost: high → low' },
];

const QUICK_TOGGLES = [
  { key: 'veg_only',   label: '🟢 Veg only' },
  { key: 'open_now',   label: '⏱ Open now' },
  { key: 'has_offers', label: '🏷 Has offers' },
];

export default function DiningBrowseScreen({ navigation, route }) {
  const initialVibe = route?.params?.initialVibe || null;

  // Filter state. Each filter key maps to either a bool or an array of
  // selected option values.
  const [filters, setFilters] = useState(() => ({
    veg_only:   false,
    open_now:   false,
    has_offers: false,
    vibes:      initialVibe ? [initialVibe] : [],
    cuisines:   [],
    cost_bucket: null,           // 'under_300' | '300_800' | '800_plus'
    creator_trusted: false,
  }));
  const [sort, setSort]           = useState('distance');
  const [searchQuery, setQuery]   = useState('');
  const [stores, setStores]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortOpen, setSortOpen]   = useState(false);

  // Load — pulls from /category/eat/stores. Client-side filters for now
  // since the discovery endpoint doesn't accept all filter params yet;
  // server-side filtering lands when the endpoint learns the schema's
  // filters[] (tracked separately).
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await followerApi.getCategoryStores?.('eat');
      setStores(res?.data?.stores || []);
    } catch (e) {
      console.warn('[DiningBrowse] load failed', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply active filters client-side. Wave 5 may push these to the API.
  const filteredStores = useMemo(() => {
    let list = stores.slice();

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s => (s.business_name || '').toLowerCase().includes(q)
        || (s.cuisines || s.listing_data?.cuisines || []).some(c => String(c).toLowerCase().includes(q)));
    }

    if (filters.has_offers) {
      list = list.filter(s => (s.offers || []).length > 0);
    }
    if (filters.vibes?.length) {
      list = list.filter(s => {
        const v = s.vibes || s.listing_data?.vibes || [];
        return filters.vibes.some(target => v.includes(target));
      });
    }
    if (filters.cuisines?.length) {
      list = list.filter(s => {
        const c = s.cuisines || s.listing_data?.cuisines || [];
        return filters.cuisines.some(target => c.includes(target));
      });
    }
    if (filters.cost_bucket) {
      list = list.filter(s => {
        const cost = s.cost_for_two ?? s.listing_data?.cost_for_two;
        if (cost == null) return false;
        if (filters.cost_bucket === 'under_300') return cost < 300;
        if (filters.cost_bucket === '300_800')   return cost >= 300 && cost <= 800;
        if (filters.cost_bucket === '800_plus')  return cost > 800;
        return true;
      });
    }
    if (filters.creator_trusted) {
      list = list.filter(s => (s.offers || []).length >= 3);
    }

    // Sort
    list.sort((a, b) => {
      if (sort === 'distance')  return (a.distance_km ?? 999) - (b.distance_km ?? 999);
      if (sort === 'rating')    return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'cost_asc')  return (a.cost_for_two ?? 0) - (b.cost_for_two ?? 0);
      if (sort === 'cost_desc') return (b.cost_for_two ?? 0) - (a.cost_for_two ?? 0);
      return 0;
    });

    return list;
  }, [stores, searchQuery, filters, sort]);

  // Count of "active" filter selections for the Filters button badge.
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.veg_only)        n++;
    if (filters.open_now)        n++;
    if (filters.has_offers)      n++;
    if (filters.creator_trusted) n++;
    n += filters.vibes?.length || 0;
    n += filters.cuisines?.length || 0;
    if (filters.cost_bucket)     n++;
    return n;
  }, [filters]);

  function toggleQuick(key) {
    setFilters(f => ({ ...f, [key]: !f[key] }));
  }

  function openRestaurant(store) {
    const offer = store.offers?.[0];
    const tracking = offer ? buildTrackingFromOffer(offer) : {};
    navigation.navigate('BrandStore', { brandId: store.id, ...tracking });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* App bar */}
      <View style={styles.appbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.iconBtnGlyph}>←</Text>
        </Pressable>
        <Text style={styles.appbarTitle}>Browse</Text>
        <Pressable onPress={() => setSortOpen(s => !s)} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.iconBtnGlyph}>⇅</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchGlyph}>🔍</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setQuery}
          placeholder="Search restaurants, dishes…"
          placeholderTextColor={lightColors.muted2}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      {/* Sort dropdown (inline reveal — keep it simple) */}
      {sortOpen && (
        <View style={styles.sortPanel}>
          {SORT_OPTIONS.map(opt => (
            <Pressable key={opt.key}
              onPress={() => { setSort(opt.key); setSortOpen(false); }}
              style={[styles.sortRow, sort === opt.key && styles.sortRowActive]}>
              <Text style={[styles.sortLabel, sort === opt.key && styles.sortLabelActive]}>
                {opt.label}
              </Text>
              {sort === opt.key && <Text style={styles.sortCheck}>✓</Text>}
            </Pressable>
          ))}
        </View>
      )}

      {/* Filter chip strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipStrip}>
        <Pressable onPress={() => setSheetOpen(true)}
          style={[styles.filtersBtn, activeFilterCount > 0 && styles.filtersBtnActive]}>
          <Text style={[styles.filtersBtnText, activeFilterCount > 0 && styles.filtersBtnTextActive]}>
            ⇅ Filters
            {activeFilterCount > 0 && (
              <Text style={styles.filtersBtnBadge}>  {activeFilterCount}</Text>
            )}
          </Text>
        </Pressable>
        <FilterChip label={`Sort: ${labelForSort(sort)}`} selected onPress={() => setSortOpen(s => !s)} />
        {QUICK_TOGGLES.map(t => (
          <FilterChip key={t.key}
            label={t.label}
            selected={filters[t.key]}
            onPress={() => toggleQuick(t.key)}
          />
        ))}
        {filters.vibes.map(v => (
          <FilterChip key={`v-${v}`}
            label={`✕ ${String(v).replace(/_/g, ' ')}`}
            selected
            onPress={() => setFilters(f => ({ ...f, vibes: f.vibes.filter(x => x !== v) }))}
          />
        ))}
        {filters.cost_bucket && (
          <FilterChip
            label={`✕ ${labelForCostBucket(filters.cost_bucket)}`}
            selected
            onPress={() => setFilters(f => ({ ...f, cost_bucket: null }))}
          />
        )}
      </ScrollView>

      {/* Result count */}
      <View style={styles.resultRow}>
        <Text style={styles.resultCount}>
          {filteredStores.length} RESULTS · BANJARA HILLS
        </Text>
        <Pressable onPress={() => {}} hitSlop={6}>
          <Text style={styles.mapLink}>Map view</Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={filteredStores}
        keyExtractor={s => s.id}
        renderItem={({ item }) => (
          <RestaurantCard restaurant={storeToCardProps(item)}
            onPress={() => openRestaurant(item)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No restaurants match</Text>
              <Text style={styles.emptyBody}>Try clearing filters or a different vibe.</Text>
              <Pressable
                onPress={() => setFilters({ veg_only: false, open_now: false, has_offers: false, vibes: [], cuisines: [], cost_bucket: null, creator_trusted: false })}
                style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear filters</Text>
              </Pressable>
            </View>
          )
        }
      />

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onApply={(next) => { setFilters(next); setSheetOpen(false); }}
        resultCount={filteredStores.length}
      />
    </SafeAreaView>
  );
}

function labelForSort(key) {
  return SORT_OPTIONS.find(o => o.key === key)?.label || key;
}
function labelForCostBucket(key) {
  if (key === 'under_300') return 'Under ₹300';
  if (key === '300_800')   return '₹300–₹800';
  if (key === '800_plus')  return '₹800+';
  return key;
}

function storeToCardProps(s) {
  const ld = s.listing_data || {};
  const offer = s.offers?.[0] || null;
  const cuisines = s.cuisines || ld.cuisines || [];
  const vibes = s.vibes || ld.vibes || [];
  return {
    id: s.id,
    business_name: s.business_name,
    cover_image_url: s.cover_image_url || ld.cover_image_url,
    cuisines, vibes,
    cost_for_two: s.cost_for_two != null ? s.cost_for_two : ld.cost_for_two,
    locality: s.locality_or_neighborhood || s.city,
    distance_km: s.distance_km,
    rating: s.avg_rating != null ? s.avg_rating : (s.rating || ld.rating),
    review_count: s.review_count || 0,
    is_open: s.is_open !== false,
    open_until: s.open_until,
    active_offer: offer ? {
      label: offer.label || offer.title || `${offer.discount_value || ''}% OFF`,
      icon: '🏷',
    } : null,
    creator: offer?.influencer_handle ? {
      handle: offer.influencer_handle,
      name: offer.influencer_name,
      verified: offer.influencer_verified !== false,
    } : null,
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.bg },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: lightColors.bg2,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnGlyph: { fontSize: 16, color: lightColors.ink },
  appbarTitle: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: lightColors.ink,
    letterSpacing: -0.2,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    backgroundColor: lightColors.bg2,
    borderColor: lightColors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchGlyph: { fontSize: 14 },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: lightColors.ink,
    paddingVertical: 0,
  },

  sortPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: lightColors.white,
    borderColor: lightColors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 6,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
  },
  sortRowActive: { backgroundColor: lightColors.yellow50 },
  sortLabel: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: lightColors.ink2,
  },
  sortLabelActive: { color: lightColors.ink, fontFamily: fonts.sansBold },
  sortCheck: { color: lightColors.yellowText, fontSize: 14, fontWeight: '700' },

  chipStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    alignItems: 'center',
  },
  filtersBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: lightColors.white,
    borderWidth: 1,
    borderColor: lightColors.muted4,
  },
  filtersBtnActive: {
    backgroundColor: lightColors.ink,
    borderColor: lightColors.ink,
  },
  filtersBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: lightColors.ink2,
  },
  filtersBtnTextActive: { color: lightColors.white },
  filtersBtnBadge: {
    fontFamily: fonts.monoBold,
    color: lightColors.yellow,
  },

  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  resultCount: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: lightColors.muted,
    letterSpacing: 0.5,
  },
  mapLink: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: lightColors.yellowText,
  },

  list: { paddingHorizontal: 16, paddingBottom: 24 },

  empty: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyEmoji: { fontSize: 38, marginBottom: 8 },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    color: lightColors.ink,
  },
  emptyBody: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: lightColors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  clearBtn: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: lightColors.yellow,
    borderRadius: 8,
  },
  clearBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: lightColors.ink,
  },
});
