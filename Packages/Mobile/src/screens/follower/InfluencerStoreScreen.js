/**
 * InfluencerStoreScreen — Wave 4 PR 4.4 (mockup Flow 4.1).
 *
 * Full visual rewrite of the creator store landing. Previous layout was
 * a tab-filtered offer grid; new layout matches the mockup pattern:
 *
 *   - Ink hero header: large avatar, handle, counters (followers · picks
 *     · verified), Follow button, italic bio quote
 *   - Search bar (placeholder for now — Wave 5 ties to a search endpoint)
 *   - "Browse by category" 2-col grid — one card per category the creator
 *     has endorsed, with pick count and offer summary
 *   - "Hot picks" list — top 3-5 offers across all categories
 *
 * Data contract is unchanged: route.params.handle → followerApi.getStore.
 * The screen filters/aggregates the response client-side.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, fonts, getBusinessAccent } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { OfferPill } from '../../components/restaurant';

const CATEGORY_LABELS = {
  restaurant:      'Restaurants',
  bakery:          'Bakery',
  salon:           'Beauty',
  car_rental:      'Car Rental',
  bike_rental:     'Bike Rental',
  fashion:         'Fashion',
  fashion_walkin:  'Fashion',
  fashion_online:  'Fashion',
  florist:         'Florists',
  packaged_food:   'Packaged food',
  function_hall:   'Function halls',
  wedding_planner: 'Wedding',
  hotel_homestay:  'Hotels & Stays',
  travel_packages: 'Travel',
  gym_fitness:     'Gym & Fitness',
  electronics:     'Electronics',
  jewellery:       'Jewellery',
  footwear:        'Footwear',
  furniture:       'Furniture',
  optical:         'Optical',
  home_services:   'Home services',
  photography:     'Photography',
  pet_grooming:    'Pet care',
  pet_shop:        'Pet shop',
  flowers_gifting: 'Gifting',
  grocery:         'Grocery',
  hardware:        'Hardware',
  clinic_doctor:   'Clinics',
  dental_clinic:   'Dental',
  laundry:         'Laundry',
  legal_ca:        'Legal & CA',
  coaching_center: 'Coaching',
  diagnostic_lab:  'Diagnostic',
  coworking_space: 'Coworking',
  home_beauty:     'Home beauty',
  pest_control:    'Pest control',
  interior_design: 'Interior',
};

function labelForCategory(key) {
  return CATEGORY_LABELS[key] || (key ? key.replace(/_/g, ' ') : 'Other');
}

export default function InfluencerStoreScreen({ route, navigation }) {
  const { handle } = route.params || {};
  const [store, setStore]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setFollow]  = useState(false);

  const fetchStore = useCallback(async () => {
    try {
      const res = await followerApi.getStore(handle);
      const data = res.data || res;
      setStore(data);
      if (data?.is_following != null) setFollow(!!data.is_following);
    } catch (e) {
      console.warn('[CreatorStore] fetch failed', e?.message);
    }
  }, [handle]);

  useEffect(() => {
    setLoading(true);
    fetchStore().finally(() => setLoading(false));
  }, [fetchStore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStore();
    setRefreshing(false);
  }, [fetchStore]);

  const onFollow = useCallback(async () => {
    if (!store?.influencer?.id) return;
    try {
      if (isFollowing) {
        await followerApi.unfollow(store.influencer.id);
        setFollow(false);
      } else {
        await followerApi.follow(store.influencer.id);
        setFollow(true);
      }
    } catch {}
  }, [isFollowing, store]);

  // Aggregate offers per category.
  const offers = store?.offers || [];
  const categories = useMemo(() => {
    const map = {};
    for (const o of offers) {
      const k = o.brand_category || 'other';
      if (!map[k]) map[k] = { key: k, picks: 0, with_offers: 0, max_discount: 0 };
      map[k].picks += 1;
      if (o.discount_value > 0) {
        map[k].with_offers += 1;
        if (o.discount_value > map[k].max_discount) map[k].max_discount = o.discount_value;
      }
    }
    return Object.values(map).sort((a, b) => b.picks - a.picks);
  }, [offers]);

  const hotPicks = useMemo(() => {
    return [...offers]
      .filter(o => o.discount_value > 0)
      .sort((a, b) => (b.discount_value || 0) - (a.discount_value || 0))
      .slice(0, 5);
  }, [offers]);

  function onPickPress(offer) {
    const params = {
      offer: { id: offer.offer_id, offer_type: offer.offer_type, discount_value: offer.discount_value, availing_modes: offer.availing_modes },
      brand: { id: offer.brand_id, name: offer.brand_name, category: offer.brand_category, city: offer.brand_city },
      tracking: { campaign_id: offer.campaign_id, set_id: offer.set_id, offer_id: offer.offer_id, campaign_influencer_id: offer.campaign_influencer_id, influencer_id: store?.influencer?.id, influencer_handle: store?.influencer?.instagram_handle, influencer_name: store?.influencer?.name },
      influencer: store?.influencer,
    };
    // Route by primary mode
    const primary = (offer.availing_modes || [])[0];
    if (primary === 'pay_at_store')   navigation.navigate('PayAtStore', params);
    else if (primary === 'prebook')   navigation.navigate('PreBook', params);
    else if (primary === 'enquiry')   navigation.navigate('Enquiry', params);
    else navigation.navigate('BrandStore', { brandId: offer.brand_id, tracking: params.tracking });
  }

  function onCategoryPress(cat) {
    // For Wave 4: send into BrandStore browse view for that category. Future
    // refinement could deep-link into a creator+category-scoped feed.
    navigation.navigate('CategoryList', {
      superCategory: cat.key === 'restaurant' ? 'eat' : cat.key,
      label: labelForCategory(cat.key),
      icon: getBusinessAccent(cat.key).icon,
    });
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={lightColors.ink} />
      </View>
    );
  }

  const influencer = store?.influencer || {};
  const followerCount = influencer.follower_count ?? store?.follower_count ?? null;
  const initial = (influencer.name || influencer.instagram_handle || '?').charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lightColors.ink} />}
    >
      {/* ── Creator hero (ink bg) ───────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={styles.hero}>
        <View style={styles.heroInner}>
          <View style={styles.avatar}>
            {influencer.profile_pic_url
              ? <Image source={{ uri: influencer.profile_pic_url }} style={styles.avatarImg} />
              : <Text style={styles.avatarText}>{initial}</Text>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroHandle} numberOfLines={1}>
              @{influencer.instagram_handle || influencer.name}
            </Text>
            <Text style={styles.heroCounters} numberOfLines={1}>
              {followerCount != null ? `${fmtCount(followerCount)} · ` : ''}
              {offers.length} picks{influencer.is_verified !== false ? ' · ✓ VERIFIED' : ''}
            </Text>
          </View>
          <Pressable onPress={onFollow}
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}>
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Following' : '+ Follow'}
            </Text>
          </Pressable>
        </View>
        {influencer.bio ? (
          <Text style={styles.heroBio}>"{influencer.bio}"</Text>
        ) : null}
      </SafeAreaView>

      {/* ── Search (placeholder) ────────────────────────────────────── */}
      <View style={styles.searchBar}>
        <Text style={styles.searchGlyph}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Search any offer — biryani, salon, suit…</Text>
      </View>

      {/* ── Category grid ───────────────────────────────────────────── */}
      <SectionH title="Browse by category" />
      {categories.length === 0 ? (
        <Text style={styles.emptyMuted}>
          @{influencer.instagram_handle || influencer.name} hasn't published any picks yet.
        </Text>
      ) : (
        <View style={styles.catGrid}>
          {categories.map(c => (
            <CategoryCard key={c.key} data={c} onPress={() => onCategoryPress(c)} />
          ))}
        </View>
      )}

      {/* ── Hot picks ───────────────────────────────────────────────── */}
      {hotPicks.length > 0 && (
        <>
          <SectionH title="🔥 Hot picks" subtitle={`${hotPicks.length} of ${offers.length}`} />
          {hotPicks.map(o => (
            <HotPickRow key={o.offer_id} offer={o} onPress={() => onPickPress(o)} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionH({ title, subtitle }) {
  return (
    <View style={styles.sectionH}>
      <Text style={styles.sectionTitle}>
        {title}
        {subtitle && <Text style={styles.sectionSubtitle}>{`  · ${subtitle}`}</Text>}
      </Text>
    </View>
  );
}

function CategoryCard({ data, onPress }) {
  const accent = getBusinessAccent(data.key);
  return (
    <Pressable onPress={onPress} style={styles.catCard}>
      <Text style={styles.catIcon}>{accent.icon}</Text>
      <Text style={styles.catName}>{labelForCategory(data.key)}</Text>
      <Text style={styles.catMeta}>
        {data.picks} pick{data.picks !== 1 ? 's' : ''}
        {data.with_offers > 0 ? ` · ${data.with_offers} with offers` : ''}
      </Text>
      {data.max_discount > 0 && (
        <View style={styles.catOfferRow}>
          <OfferPill label={`UP TO ${data.max_discount}% OFF`} size="sm" />
        </View>
      )}
    </Pressable>
  );
}

function HotPickRow({ offer, onPress }) {
  const accent = getBusinessAccent(offer.brand_category);
  return (
    <Pressable onPress={onPress} style={styles.pickRow}>
      <View style={[styles.pickIcon, { backgroundColor: accent.dim }]}>
        <Text style={styles.pickIconGlyph}>{accent.icon}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.pickTitle} numberOfLines={1}>
          {offer.brand_name} · {offer.discount_value || 0}% OFF
        </Text>
        <Text style={styles.pickMeta} numberOfLines={1}>
          {labelForCategory(offer.brand_category)}{offer.brand_city ? ` · ${offer.brand_city}` : ''}
        </Text>
      </View>
      <Text style={styles.pickChevron}>→</Text>
    </Pressable>
  );
}

function fmtCount(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: lightColors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  hero: { backgroundColor: lightColors.ink, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: lightColors.yellow,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2, borderColor: lightColors.white,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: {
    fontFamily: fonts.displayBlack, fontSize: 28, color: lightColors.ink,
  },
  heroHandle: {
    fontFamily: fonts.displayBlack, fontSize: 19,
    color: lightColors.white, letterSpacing: -0.3,
  },
  heroCounters: {
    fontFamily: fonts.monoMedium, fontSize: 11,
    color: lightColors.yellow100, marginTop: 2, letterSpacing: 0.3,
  },
  followBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, backgroundColor: lightColors.yellow,
  },
  followBtnActive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: lightColors.yellow },
  followBtnText: {
    fontFamily: fonts.sansBold, fontSize: 12, color: lightColors.ink,
  },
  followBtnTextActive: { color: lightColors.yellow },
  heroBio: {
    fontFamily: fonts.sansMedium, fontSize: 13, fontStyle: 'italic',
    color: lightColors.yellow100, marginTop: 14, lineHeight: 18,
  },

  searchBar: {
    marginHorizontal: 16, marginTop: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: lightColors.paper,
    borderColor: lightColors.border2, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchGlyph: { fontSize: 14 },
  searchPlaceholder: {
    fontFamily: fonts.sansMedium, fontSize: 13, color: lightColors.muted2,
  },

  sectionH: {
    paddingHorizontal: 16, marginTop: 22, marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.displayBold, fontSize: 17,
    color: lightColors.ink, letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: fonts.monoMedium, fontSize: 11, color: lightColors.muted2,
  },
  emptyMuted: {
    paddingHorizontal: 16, fontFamily: fonts.sansMedium,
    fontSize: 12, color: lightColors.muted,
  },

  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16,
  },
  catCard: {
    flexBasis: '48.5%',
    backgroundColor: lightColors.paper,
    borderColor: lightColors.border, borderWidth: 1,
    borderRadius: 12, padding: 14, minHeight: 110,
  },
  catIcon: { fontSize: 26 },
  catName: {
    fontFamily: fonts.displayBold, fontSize: 14,
    color: lightColors.ink, marginTop: 8, letterSpacing: -0.1,
  },
  catMeta: {
    fontFamily: fonts.sansMedium, fontSize: 11,
    color: lightColors.muted, marginTop: 2,
  },
  catOfferRow: { marginTop: 6 },

  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: lightColors.paper,
    borderColor: lightColors.border, borderWidth: 1,
    borderRadius: 10,
  },
  pickIcon: {
    width: 44, height: 44, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  pickIconGlyph: { fontSize: 22 },
  pickTitle: {
    fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink,
  },
  pickMeta: {
    fontFamily: fonts.monoMedium, fontSize: 10,
    color: lightColors.muted, marginTop: 2,
  },
  pickChevron: {
    fontFamily: fonts.displayBold, fontSize: 18, color: lightColors.yellowDeep,
  },
});
