/**
 * RestaurantDetailScreen — Wave 4 PR 4.2 (mockup Flow 2).
 *
 * Was a re-export of SchemaDetailScreen until this wave. Now a full
 * standalone detail screen tailored for the dining vertical.
 *
 *   - Photo carousel hero (swipeable, pagination pill)
 *   - Restaurant header: name (Outfit), cuisines (mono), rating, cost,
 *     locality, open-till status pill
 *   - Active offer card (yellow-tinted) when a campaign is live
 *   - Amenity chips derived from brand.listing_data booleans
 *   - Sagar's Table strip when the entry creator has picks
 *   - Sticky sub-tabs: Overview / Menu / Reviews / Photos
 *   - Per-tab content (reviews has Wave-5 placeholder)
 *   - Sticky bottom CTA: Call + Book Table (or Pay / Order / Enquiry
 *     based on which actions the brand toggled in the wizard's step 7)
 *
 * Render path: BrandStoreScreen detects brand.category === 'restaurant'
 * and renders this component with the already-loaded store + tracking.
 * Every entry that goes to the `BrandStore` route — share links, saved
 * offers, search results, the new DiningHome card tap — automatically
 * lands here for restaurant brands. Non-restaurant brands keep
 * BrandStoreScreen's existing layout.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, Dimensions, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, fonts } from '../../theme/tokens';
import {
  CreatorChip, VegDot, StatusPill, SagarStrip, FilterChip,
} from '../../components/restaurant';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 230;

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'menu',     label: 'Menu'     },
  { key: 'reviews',  label: 'Reviews'  },
  { key: 'photos',   label: 'Photos'   },
];

export default function RestaurantDetailScreen({ store, navigation, tracking }) {
  const [tab, setTab] = useState('overview');
  const [section, setSection] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  const brand     = store?.brand || {};
  const products  = store?.products || [];
  const creator   = store?.creator || null;
  const picks     = store?.creator_picks || [];
  const ld        = brand.listing_data || {};

  const cuisines    = brand.cuisines || ld.cuisines || [];
  const vibes       = brand.vibes || ld.vibes || [];
  const costForTwo  = brand.cost_for_two ?? ld.cost_for_two;
  const description = ld.restaurant_description || '';
  const locality    = brand.locality || ld.locality || brand.city || '';
  const photos      = Array.isArray(ld.photos) ? ld.photos : [];
  const coverUrl    = brand.cover_image_url || ld.cover_image_url || photos[0]?.download_url || photos[0]?.url;
  const heroPhotos  = useMemo(() => {
    const all = [];
    if (coverUrl) all.push({ id: 'cover', url: coverUrl });
    photos.forEach(p => {
      const url = p.download_url || p.url;
      if (url && url !== coverUrl) all.push({ id: p.id || url, url });
    });
    return all;
  }, [photos, coverUrl]);

  // Best offer surfaced across all attached influencers — same logic the
  // legacy BrandStoreScreen used so we don't surprise existing entries.
  const offer = useMemo(() => {
    const all = (store?.influencers || []).flatMap(i => i.offers || []);
    if (all.length === 0) return null;
    all.sort((a, b) => (b.discount_value || 0) - (a.discount_value || 0));
    return all[0];
  }, [store?.influencers]);

  const showBookTable   = (brand.accepts_table_booking ?? ld.accepts_table_booking) !== false;
  const showPayAtStore  = (brand.pay_at_store_supported ?? ld.pay_at_store_supported) !== false;
  const showOnlineOrder = (brand.online_order_supported ?? ld.online_order_supported) === true;
  const showEnquiry     = (brand.enquiry_enabled ?? ld.enquiry_enabled) !== false;
  const callPhone       = brand.phone || ld.phone || null;
  const mapsUrl         = ld.google_maps_url || null;

  const sections = useMemo(() => {
    const out = {};
    for (const p of products) {
      const sec = p.section || 'Other';
      if (!out[sec]) out[sec] = [];
      out[sec].push(p);
    }
    return out;
  }, [products]);
  const sectionKeys = Object.keys(sections);
  const visibleSection = section || sectionKeys[0];

  function dispatchAction(actionKey) {
    if (actionKey === 'call' && callPhone) {
      Linking.openURL(`tel:${callPhone}`).catch(() => Alert.alert('Cannot open phone'));
      return;
    }
    if (actionKey === 'directions' && mapsUrl) {
      Linking.openURL(mapsUrl).catch(() => Alert.alert('Cannot open Maps'));
      return;
    }
    if (actionKey === 'book') {
      navigation.navigate('PreBook', {
        brand, brandId: brand.id, tracking,
        action: { action: 'book_slot', config: { booking_type: 'table', endpoint: '/follower/prebook' } },
      });
      return;
    }
    if (actionKey === 'pay') {
      navigation.navigate('PayAtStore', { brand, brandId: brand.id, tracking });
      return;
    }
    if (actionKey === 'order') {
      navigation.navigate('OrderCart', { brandData: brand });
      return;
    }
    if (actionKey === 'enquiry') {
      navigation.navigate('Enquiry', { brand, brandId: brand.id, tracking });
      return;
    }
  }

  function onProductPress(product) {
    navigation.navigate('ProductDetail', {
      productId: product.id,
      brandId: brand.id,
      tracking,
    });
  }

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>

        {/* ── HERO photo carousel ─────────────────────────────────────── */}
        <View style={styles.hero}>
          {heroPhotos.length > 0 ? (
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            >
              {heroPhotos.map(p => (
                <Image key={p.id} source={{ uri: p.url }}
                  style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.heroFallback}>
              <Text style={styles.heroFallbackEmoji}>🍽️</Text>
            </View>
          )}

          <SafeAreaView edges={['top']} style={styles.heroTopBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.heroBtn} hitSlop={6}>
              <Text style={styles.heroBtnGlyph}>←</Text>
            </Pressable>
            <Pressable onPress={() => {}} style={styles.heroBtn} hitSlop={6}>
              <Text style={styles.heroBtnGlyph}>♡</Text>
            </Pressable>
          </SafeAreaView>

          {heroPhotos.length > 1 && (
            <View style={styles.pagination}>
              <Text style={styles.paginationText}>
                {photoIdx + 1} / {heroPhotos.length}
              </Text>
            </View>
          )}
        </View>

        {/* ── Header block ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName} numberOfLines={2}>{brand.business_name}</Text>
              <Text style={styles.cuisineLine} numberOfLines={1}>
                {cuisines.length > 0 ? cuisines.slice(0, 3).join(' · ') : 'Add cuisines'}
              </Text>
            </View>
            {brand.rating && (
              <View style={styles.ratingPill}>
                <Text style={styles.ratingPillText}>★ {Number(brand.rating).toFixed(1)}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            {costForTwo != null && <Text style={styles.metaMono}>₹{costForTwo}/two</Text>}
            {locality && <Text style={styles.metaMono}>📍 {locality}</Text>}
            <StatusPill variant="open" label="Open till 11 PM" />
          </View>

          {offer && (
            <View style={styles.offerCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.offerLabel}>
                  {String(offer.label || offer.title || `${offer.discount_value || 0}% OFF`).toUpperCase()}
                </Text>
                <Text style={styles.offerSubtitle}>
                  {offer.until ? `Valid until ${offer.until}` : 'Active campaign'}
                </Text>
              </View>
              {offer.offer_code && (
                <View style={styles.offerCode}>
                  <Text style={styles.offerCodeText}>{offer.offer_code}</Text>
                </View>
              )}
            </View>
          )}

          <AmenityChips brandData={{ ...brand, ...ld }} />
        </View>

        {/* ── Sagar's Table strip ─────────────────────────────────────── */}
        {creator && picks.length > 0 && (
          <SagarStrip
            creator={{
              handle: creator.instagram_handle,
              name: creator.name,
              verified: creator.is_verified !== false,
            }}
            items={picks.map(p => ({
              id: p.id, name: p.name, price: p.price, image_url: p.image_url,
            }))}
            onItemPress={onProductPress}
            onSeeAll={() => setTab('menu')}
          />
        )}

        {/* ── Sub-tabs ─────────────────────────────────────────────────── */}
        <View style={styles.subTabs}>
          {TABS.map(t => (
            <Pressable key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.subTab, tab === t.key && styles.subTabActive]}>
              <Text style={[styles.subTabLabel, tab === t.key && styles.subTabLabelActive]}>
                {t.label}
                {t.key === 'menu' && products.length > 0 && ` (${products.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Tab content ─────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <OverviewTab description={description} vibes={vibes} creator={creator} />
        )}
        {tab === 'menu' && (
          <MenuTab sections={sections} visibleSection={visibleSection}
            sectionKeys={sectionKeys} onSelectSection={setSection}
            picks={picks} onProductPress={onProductPress} creator={creator} />
        )}
        {tab === 'reviews' && <ReviewsTab brand={brand} />}
        {tab === 'photos'  && <PhotosTab photos={heroPhotos} />}

      </ScrollView>

      {/* ── Sticky bottom CTA bar ────────────────────────────────────── */}
      <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
        <View style={styles.ctaInner}>
          {callPhone && (
            <Pressable onPress={() => dispatchAction('call')}
              style={[styles.ctaBtn, styles.ctaBtnSecondary]}>
              <Text style={styles.ctaSecondaryGlyph}>📞</Text>
            </Pressable>
          )}
          {showBookTable && (
            <Pressable onPress={() => dispatchAction('book')}
              style={[styles.ctaBtn, styles.ctaBtnPrimary, { flex: 2 }]}>
              <Text style={styles.ctaPrimaryText}>
                Book Table{offer ? ` · ${offer.discount_value || ''}% off` : ''} →
              </Text>
            </Pressable>
          )}
          {!showBookTable && showPayAtStore && (
            <Pressable onPress={() => dispatchAction('pay')}
              style={[styles.ctaBtn, styles.ctaBtnPrimary, { flex: 2 }]}>
              <Text style={styles.ctaPrimaryText}>Pay Bill →</Text>
            </Pressable>
          )}
          {!showBookTable && !showPayAtStore && showOnlineOrder && (
            <Pressable onPress={() => dispatchAction('order')}
              style={[styles.ctaBtn, styles.ctaBtnPrimary, { flex: 2 }]}>
              <Text style={styles.ctaPrimaryText}>Order Online →</Text>
            </Pressable>
          )}
          {!showBookTable && !showPayAtStore && !showOnlineOrder && showEnquiry && (
            <Pressable onPress={() => dispatchAction('enquiry')}
              style={[styles.ctaBtn, styles.ctaBtnPrimary, { flex: 2 }]}>
              <Text style={styles.ctaPrimaryText}>Send Enquiry →</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Tab content sub-components ──────────────────────────────────────────────

function OverviewTab({ description, vibes, creator }) {
  return (
    <View style={styles.section}>
      {description ? (
        <Text style={styles.bodyText}>{description}</Text>
      ) : (
        <Text style={styles.muted}>This restaurant hasn't added a description yet.</Text>
      )}

      {vibes.length > 0 && (
        <>
          <Text style={styles.h4}>Vibe</Text>
          <View style={styles.chipWrap}>
            {vibes.map(v => (
              <View key={v} style={styles.vibeTagOverview}>
                <Text style={styles.vibeTagText}>{String(v).replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {creator && (
        <>
          <Text style={styles.h4}>Creator endorsement</Text>
          <View style={styles.creatorEndorse}>
            <CreatorChip handle={creator.instagram_handle} name={creator.name}
              verified={creator.is_verified !== false} />
            {creator.has_active_offer && (
              <Text style={styles.creatorEndorseLine}>
                Your visit credits @{creator.instagram_handle}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function MenuTab({ sections, visibleSection, sectionKeys, onSelectSection, picks, onProductPress, creator }) {
  if (sectionKeys.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.muted}>Menu not yet published.</Text>
      </View>
    );
  }

  const isPicksView = visibleSection === '__picks__';
  const items = isPicksView ? picks : (sections[visibleSection] || []);
  const pickIds = new Set(picks.map(p => p.id));

  return (
    <View>
      {creator && picks.length > 0 && (
        <View style={styles.sagarQuoteBar}>
          <CreatorChip handle={creator.instagram_handle} name={creator.name}
            verified={creator.is_verified !== false} size="sm" />
          <Text style={styles.sagarQuoteText} numberOfLines={2}>
            "These are non-negotiable."
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionChips}>
        {picks.length > 0 && (
          <FilterChip label={`★ Picks`}
            count={picks.length}
            selected={isPicksView}
            onPress={() => onSelectSection('__picks__')} />
        )}
        {sectionKeys.map(k => (
          <FilterChip key={k}
            label={k}
            count={sections[k].length}
            selected={visibleSection === k && !isPicksView}
            onPress={() => onSelectSection(k)} />
        ))}
      </ScrollView>

      <View style={styles.section}>
        {items.map(p => (
          <Pressable key={p.id} onPress={() => onProductPress(p)} style={styles.dishRow}>
            {p.image_url ? (
              <Image source={{ uri: p.image_url }} style={styles.dishImg} />
            ) : (
              <View style={[styles.dishImg, styles.dishImgFallback]}>
                <Text>🍽️</Text>
              </View>
            )}
            <View style={styles.dishBody}>
              <View style={styles.dishMetaRow}>
                <VegDot veg={p.veg_flag === 'Veg' || p.veg_flag === true} size={11} />
                {p.variants_json?.bestseller && (
                  <View style={styles.bestsellerChip}>
                    <Text style={styles.bestsellerText}>⭐ BESTSELLER</Text>
                  </View>
                )}
                {!isPicksView && pickIds.has(p.id) && (
                  <View style={styles.pickChip}>
                    <Text style={styles.pickChipText}>★ Pick</Text>
                  </View>
                )}
              </View>
              <Text style={styles.dishName} numberOfLines={1}>{p.name}</Text>
              {p.description && (
                <Text style={styles.dishDesc} numberOfLines={2}>{p.description}</Text>
              )}
              <View style={styles.dishPriceRow}>
                <Text style={styles.dishPrice}>₹ {Math.round(p.price)}</Text>
                <Pressable onPress={() => onProductPress(p)} style={styles.dishAddBtn}>
                  <Text style={styles.dishAddText}>+ ADD</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ReviewsTab({ brand }) {
  // Wave 5 will add real reviews. For now: rating summary + empty state.
  const rating = brand?.rating;
  const ratingCount = brand?.rating_count || 0;
  return (
    <View style={styles.section}>
      {rating && (
        <View style={styles.ratingSummary}>
          <View>
            <Text style={styles.ratingBig}>{Number(rating).toFixed(1)}</Text>
            <Text style={styles.ratingStars}>★★★★☆</Text>
            <Text style={styles.ratingCount}>{ratingCount} RATINGS</Text>
          </View>
        </View>
      )}
      <View style={styles.reviewsEmpty}>
        <Text style={styles.reviewsEmptyEmoji}>⭐</Text>
        <Text style={styles.h4}>No reviews yet</Text>
        <Text style={styles.muted}>Be the first to review after your visit.</Text>
      </View>
    </View>
  );
}

function PhotosTab({ photos }) {
  if (!photos || photos.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.muted}>This restaurant hasn't added photos yet.</Text>
      </View>
    );
  }
  return (
    <View style={[styles.section, styles.photoGrid]}>
      {photos.map(p => (
        <View key={p.id} style={styles.photoCell}>
          <Image source={{ uri: p.url }} style={styles.photoImg} />
        </View>
      ))}
    </View>
  );
}

// ── Amenity chip strip ──────────────────────────────────────────────────────

const AMENITY_MAP = [
  { key: 'parking',               label: '🅿 Parking' },
  { key: 'outdoor_seating',       label: '🌳 Outdoor' },
  { key: 'wifi',                  label: '📶 Wi-Fi' },
  { key: 'kids_welcome',          label: '👶 Kids' },
  { key: 'wheelchair_accessible', label: '♿ Accessible' },
];

function AmenityChips({ brandData }) {
  const active = AMENITY_MAP.filter(a => brandData[a.key] === true);
  if (active.length === 0) return null;
  return (
    <View style={styles.amenityRow}>
      {active.map(a => (
        <View key={a.key} style={styles.amenityChip}>
          <Text style={styles.amenityText}>{a.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },

  hero: { height: HERO_HEIGHT, backgroundColor: lightColors.surface, position: 'relative' },
  heroFallback: {
    height: HERO_HEIGHT, backgroundColor: lightColors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  heroFallbackEmoji: { fontSize: 64 },
  heroTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  heroBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBtnGlyph: { fontSize: 18, color: lightColors.ink },
  pagination: {
    position: 'absolute', bottom: 10, right: 12,
    backgroundColor: 'rgba(10,10,10,0.7)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  paginationText: { color: lightColors.white, fontFamily: fonts.monoBold, fontSize: 10 },

  section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  brandName: {
    fontFamily: fonts.displayBlack, fontSize: 22,
    color: lightColors.ink, letterSpacing: -0.4, lineHeight: 26,
  },
  cuisineLine: {
    fontFamily: fonts.sansMedium, fontSize: 12,
    color: lightColors.muted, marginTop: 4,
  },
  ratingPill: {
    backgroundColor: lightColors.success,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  ratingPillText: { color: lightColors.white, fontFamily: fonts.monoBold, fontSize: 12 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 8 },
  metaMono: { fontFamily: fonts.monoMedium, fontSize: 11, color: lightColors.muted },

  offerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: lightColors.yellow50,
    borderColor: lightColors.yellow200, borderWidth: 1,
    borderRadius: 10, padding: 12, marginTop: 14,
  },
  offerLabel: {
    fontFamily: fonts.displayBlack, fontSize: 16,
    color: lightColors.ink, letterSpacing: -0.2,
  },
  offerSubtitle: {
    fontFamily: fonts.sansMedium, fontSize: 11,
    color: lightColors.muted, marginTop: 2,
  },
  offerCode: {
    backgroundColor: lightColors.yellow,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
  },
  offerCodeText: { fontFamily: fonts.monoBold, fontSize: 11, color: lightColors.ink },

  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  amenityChip: {
    backgroundColor: lightColors.surface,
    borderColor: lightColors.border, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
  },
  amenityText: { fontFamily: fonts.sansMedium, fontSize: 10, color: lightColors.ink2 },

  subTabs: {
    flexDirection: 'row',
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.paper, marginTop: 10,
  },
  subTab: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  subTabActive: { borderBottomColor: lightColors.yellow },
  subTabLabel: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: lightColors.muted },
  subTabLabelActive: { color: lightColors.ink, fontFamily: fonts.sansBold },

  bodyText: { fontFamily: fonts.sansMedium, fontSize: 13, color: lightColors.ink2, lineHeight: 19 },
  h4: {
    fontFamily: fonts.displayBold, fontSize: 14, color: lightColors.ink,
    marginTop: 18, marginBottom: 8, letterSpacing: -0.2,
  },
  muted: { fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.muted },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  vibeTagOverview: {
    backgroundColor: lightColors.yellow50,
    borderColor: lightColors.yellow200, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  vibeTagText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: lightColors.yellowDeep },

  creatorEndorse: { gap: 8 },
  creatorEndorseLine: { fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.muted },

  sagarQuoteBar: {
    marginHorizontal: 16, marginTop: 12,
    padding: 12, borderRadius: 10,
    backgroundColor: lightColors.ink,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  sagarQuoteText: {
    flex: 1, fontFamily: fonts.sansMedium, fontSize: 11,
    color: lightColors.yellow, fontStyle: 'italic',
  },
  sectionChips: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },

  dishRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 14,
    borderBottomColor: lightColors.border, borderBottomWidth: 1,
  },
  dishImg: { width: 80, height: 80, borderRadius: 8, backgroundColor: lightColors.surface },
  dishImgFallback: { alignItems: 'center', justifyContent: 'center' },
  dishBody: { flex: 1, minWidth: 0 },
  dishMetaRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  dishName: { fontFamily: fonts.sansBold, fontSize: 14, color: lightColors.ink, letterSpacing: -0.1 },
  dishDesc: {
    fontFamily: fonts.sansMedium, fontSize: 11,
    color: lightColors.muted, marginTop: 2, lineHeight: 15,
  },
  dishPriceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 6,
  },
  dishPrice: { fontFamily: fonts.monoBold, fontSize: 13, color: lightColors.ink },
  dishAddBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: lightColors.yellow, borderRadius: 6 },
  dishAddText: { fontFamily: fonts.monoBold, fontSize: 10, color: lightColors.ink },
  bestsellerChip: {
    backgroundColor: lightColors.yellow50,
    borderColor: lightColors.yellow200, borderWidth: 1,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  bestsellerText: { fontFamily: fonts.monoBold, fontSize: 8, color: lightColors.yellowDeep },
  pickChip: { backgroundColor: lightColors.ink, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  pickChipText: { fontFamily: fonts.monoBold, fontSize: 8, color: lightColors.yellow },

  ratingSummary: {
    flexDirection: 'row', gap: 16,
    paddingBottom: 14, marginBottom: 14,
    borderBottomColor: lightColors.border, borderBottomWidth: 1,
  },
  ratingBig: {
    fontFamily: fonts.displayBlack, fontSize: 36,
    color: lightColors.ink, letterSpacing: -1, lineHeight: 38,
  },
  ratingStars: { color: lightColors.warning, fontSize: 13, marginTop: 4 },
  ratingCount: { fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted, marginTop: 4 },
  reviewsEmpty: { alignItems: 'center', paddingVertical: 40 },
  reviewsEmptyEmoji: { fontSize: 40, marginBottom: 8 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photoCell: {
    width: (SCREEN_WIDTH - 32 - 12) / 3, aspectRatio: 1,
    borderRadius: 6, overflow: 'hidden', backgroundColor: lightColors.surface,
  },
  photoImg: { width: '100%', height: '100%' },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: lightColors.paper,
    borderTopColor: lightColors.border, borderTopWidth: 1,
  },
  ctaInner: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  ctaBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ctaBtnSecondary: {
    width: 52, backgroundColor: lightColors.surface,
    borderColor: lightColors.border, borderWidth: 1,
  },
  ctaBtnPrimary: { backgroundColor: lightColors.yellow },
  ctaSecondaryGlyph: { fontSize: 18 },
  ctaPrimaryText: {
    fontFamily: fonts.sansBold, fontSize: 14,
    color: lightColors.ink, letterSpacing: -0.1,
  },
});
