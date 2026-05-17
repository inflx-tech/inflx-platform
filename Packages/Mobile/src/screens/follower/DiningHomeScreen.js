/**
 * DiningHomeScreen — Wave 4A: the new entry point for restaurant discovery.
 *
 * Replaces the dining branch of CategoryListScreen for super_category='eat'.
 * Layout (per Wave 4 mockup Flow 1.1):
 *   - Location pill + greeting ("What's on tonight?")
 *   - Search bar (visual; tapping it opens BrowseScreen)
 *   - Vibe tiles grid (date_night / family / quickbite / rooftop)
 *   - Creators-eating-now strip (gated on data — hidden when empty for v1)
 *   - Nearby restaurants list using the shared RestaurantCard component
 *
 * Data:
 *   - Restaurants: followerApi.getCategoryStores('eat')
 *   - Vibes:       hardcoded top 4 from restaurant.json buyer_config (Wave 5
 *                  could lift this to /listing-config/buyer-config)
 *   - Creators eating now: TODO Wave 5 endpoint /v1/discover/creators-eating-now
 *
 * Tracking: a tap on a restaurant card navigates to BrandStore with the
 * influencer/offer/campaign IDs from store.offers[0] when present.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import { buildTrackingFromOffer } from '../../utils/tracking';

const VIBE_TILES = [
  { key: 'date_night', label: 'Date night',     emoji: '🍷', accent: true  },
  { key: 'family',     label: 'Family dinner',  emoji: '👨‍👩‍👧'                  },
  { key: 'quickbite',  label: 'Quick bite',     emoji: '⚡'                  },
  { key: 'rooftop',    label: 'Rooftop',        emoji: '🌃'                  },
];

export default function DiningHomeScreen({ navigation, route }) {
  const [stores, setStores]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [vibeCount, setVibeCount] = useState({});

  // Pull a sticky creator from route params when the follower landed via
  // a creator share link. The same screen renders a small ink header pill
  // when present; otherwise it renders the default location/greeting row.
  const stickyCreator = route?.params?.creator || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await followerApi.getCategoryStores?.('eat');
      const list = res?.data?.stores || [];
      setStores(list);
      // Count restaurants per vibe so the tiles can show "N spots".
      const counts = {};
      list.forEach(s => {
        const v = s.vibes || s.listing_data?.vibes || [];
        if (Array.isArray(v)) v.forEach(key => { counts[key] = (counts[key] || 0) + 1; });
      });
      setVibeCount(counts);
    } catch (e) {
      console.warn('[DiningHome] load failed', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openBrowse(vibeKey) {
    navigation.navigate('DiningBrowse', { initialVibe: vibeKey || null });
  }

  function openRestaurant(store) {
    const offer = store.offers?.[0];
    const tracking = offer ? buildTrackingFromOffer(offer) : {};
    navigation.navigate('BrandStore', {
      brandId: store.id,
      ...tracking,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Sticky creator header (only when landed via creator share) */}
      {stickyCreator && (
        <View style={styles.creatorHeader}>
          <Text style={styles.creatorPillLabel}>via @{stickyCreator.handle}</Text>
          <Text style={styles.creatorPillTracking} numberOfLines={1}>
            Tracking: {stickyCreator.tracking_id || 'PRD-XXXX'}
          </Text>
        </View>
      )}

      {/* Top bar — location pill + greeting + avatar */}
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationPill}>📍 BANJARA HILLS</Text>
          <Text style={styles.greeting}>What's on tonight?</Text>
        </View>
        <Pressable style={styles.iconBtn} hitSlop={6}>
          <Text style={styles.iconBtnGlyph}>🔔</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>M</Text>
        </View>
      </View>

      {/* Search bar — tapping forwards to BrowseScreen */}
      <Pressable onPress={() => openBrowse(null)} style={styles.searchBar}>
        <Text style={styles.searchGlyph}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Search restaurants, dishes…</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
      >
        {/* Vibe tiles 2-col grid */}
        <SectionH title="Pick a vibe" />
        <View style={styles.vibeGrid}>
          {VIBE_TILES.map(v => (
            <Pressable key={v.key}
              onPress={() => openBrowse(v.key)}
              style={[styles.vibeTile, v.accent && styles.vibeTileAccent]}>
              <Text style={styles.vibeEmoji}>{v.emoji}</Text>
              <Text style={[styles.vibeLabel, v.accent && styles.vibeLabelAccent]}>{v.label}</Text>
              <Text style={styles.vibeCount}>
                {vibeCount[v.key] || 0} spots
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Nearby restaurants list */}
        <SectionH title="Nearby" subtitle="4.2km radius" />
        {loading && stores.length === 0 ? (
          <Text style={styles.loading}>Loading nearby restaurants…</Text>
        ) : stores.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyTitle}>No restaurants yet</Text>
            <Text style={styles.emptyBody}>Pull to refresh or check back soon.</Text>
          </View>
        ) : (
          stores.map(s => (
            <RestaurantCard
              key={s.id}
              restaurant={storeToCardProps(s)}
              onPress={() => openRestaurant(s)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function SectionH({ title, subtitle, action }) {
  return (
    <View style={styles.sectionH}>
      <Text style={styles.sectionTitle}>
        {title}
        {subtitle && <Text style={styles.sectionSubtitle}>{`  · ${subtitle}`}</Text>}
      </Text>
      {action}
    </View>
  );
}

// Convert the follower /category/eat/stores response shape to the props
// RestaurantCard expects. Keep this dumb — anything missing renders empty
// gracefully so a half-onboarded brand still appears in the list.
function storeToCardProps(s) {
  const ld = s.listing_data || {};
  const offer = s.offers?.[0] || null;
  const cuisines = s.cuisines || ld.cuisines || [];
  const vibes = s.vibes || ld.vibes || [];
  return {
    id: s.id,
    business_name: s.business_name,
    cover_image_url: s.cover_image_url || ld.cover_image_url,
    cuisines,
    vibes,
    cost_for_two: s.cost_for_two != null ? s.cost_for_two : ld.cost_for_two,
    locality: s.locality_or_neighborhood || s.city,
    distance_km: s.distance_km,
    rating: s.rating || ld.rating,
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

  creatorHeader: {
    backgroundColor: lightColors.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creatorPillLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: lightColors.yellow,
  },
  creatorPillTracking: {
    flex: 1,
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  locationPill: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: lightColors.muted,
    letterSpacing: 0.5,
  },
  greeting: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: lightColors.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: lightColors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnGlyph: { fontSize: 16 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: lightColors.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.displayBlack,
    fontSize: 14,
    color: lightColors.ink,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: lightColors.surface,
    borderColor: lightColors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchGlyph: { fontSize: 14 },
  searchPlaceholder: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: lightColors.muted2,
  },

  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  sectionH: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: lightColors.ink,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: lightColors.muted2,
    letterSpacing: 0.3,
  },

  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vibeTile: {
    flexBasis: '48.5%',
    backgroundColor: lightColors.surface,
    borderRadius: 12,
    padding: 14,
    minHeight: 88,
    justifyContent: 'flex-start',
  },
  vibeTileAccent: {
    backgroundColor: lightColors.yellow50,
    borderWidth: 1,
    borderColor: lightColors.yellow200,
  },
  vibeEmoji: { fontSize: 22 },
  vibeLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: lightColors.ink,
    marginTop: 6,
    letterSpacing: -0.1,
  },
  vibeLabelAccent: { color: lightColors.ink },
  vibeCount: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: lightColors.muted2,
    marginTop: 2,
  },

  loading: {
    fontFamily: fonts.sansMedium,
    color: lightColors.muted,
    textAlign: 'center',
    paddingVertical: 30,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: lightColors.ink,
  },
  emptyBody: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: lightColors.muted,
    marginTop: 4,
  },
});
