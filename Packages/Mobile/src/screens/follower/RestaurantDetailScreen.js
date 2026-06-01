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

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, Dimensions, Linking, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { creatorVibe as C, fonts } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim for the dining sub-app (see DiningHome).
const lightColors = {
  white: C.card, paper: C.card, bg: C.screenBg, bg2: C.soft, surface: C.soft, surface2: C.line,
  ink: C.ink, ink2: C.ink, muted: C.muted, muted2: C.muted, muted3: C.muted, muted4: C.line,
  border: C.line, borderSoft: C.line, border2: C.line,
  yellow: C.brown, yellowHover: C.brownDark, yellowDeep: C.brownDark, yellowLight: C.star,
  yellowPale: C.soft, yellow50: C.soft, yellow100: C.soft, yellow200: C.soft, yellowText: C.brown,
  success: C.verify, successPale: C.soft, successText: C.brown, success50: C.soft, success100: C.soft,
  warning: C.star, warning50: C.soft, warning100: C.soft,
  danger: C.offer, dangerPale: C.soft, dangerText: C.offer, danger50: C.soft,
  star: C.star, black: C.ink,
};
import { followerApi, mealsApi } from '../../services/api';
import {
  CreatorChip, VegDot, StatusPill, SagarStrip, FilterChip,
} from '../../components/restaurant';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 230;

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'menu',     label: 'Menu'     },
  { key: 'offers',   label: 'Offers'   },
  { key: 'reviews',  label: 'Reviews'  },
  { key: 'photos',   label: 'Photos'   },
];

const PARTY_LABELS = { single: '🧍 Single', duo: '👥 For 2', trio: '👨‍👩‍👦 For 3', family: '👨‍👩‍👧‍👦 Family', office: '🏢 Office' };

export default function RestaurantDetailScreen({ store, navigation, tracking }) {
  const [tab, setTab] = useState('overview');
  const [section, setSection] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [mealStore, setMealStore] = useState(null);

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

  // INFLX Meals — load the restaurant's planned-meal offers for the Offers tab.
  useEffect(() => {
    let alive = true;
    if (!brand.id) return undefined;
    mealsApi.getStore(brand.id)
      .then((res) => { if (alive && (res?.success || res?.data)) setMealStore(res.data || res); })
      .catch(() => {});
    return () => { alive = false; };
  }, [brand.id]);

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
        brand, brandId: brand.id, tracking, offer,
        action: { action: 'book_slot', config: { booking_type: 'table', endpoint: '/follower/prebook' } },
      });
      return;
    }
    if (actionKey === 'pay') {
      navigation.navigate('PayAtStore', { brand, brandId: brand.id, tracking, offer });
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

  // ── Wave 5B cart (online-order restaurants only) ──────────────────────────
  // cart: { [productId]: { product, qty } }. Single-restaurant scope, so a
  // local state map is enough — no global provider needed (matches the
  // schema's cart_scope: "brand").
  const [cart, setCart] = useState({});
  const cartCount = useMemo(
    () => Object.values(cart).reduce((n, c) => n + c.qty, 0), [cart]);
  const cartTotal = useMemo(
    () => Object.values(cart).reduce((s, c) => s + c.qty * Number(c.product.price || 0), 0), [cart]);

  const addToCart = useCallback((p) => {
    setCart(prev => ({ ...prev, [p.id]: { product: p, qty: (prev[p.id]?.qty || 0) + 1 } }));
  }, []);
  const decFromCart = useCallback((p) => {
    setCart(prev => {
      const cur = prev[p.id]?.qty || 0;
      if (cur <= 1) { const n = { ...prev }; delete n[p.id]; return n; }
      return { ...prev, [p.id]: { product: p, qty: cur - 1 } };
    });
  }, []);

  function goToCart() {
    navigation.navigate('RestaurantCart', {
      brand,
      tracking,
      offer,
      items: Object.values(cart).map(c => ({
        product_id: c.product.id,
        name: c.product.name,
        price: Number(c.product.price || 0),
        quantity: c.qty,
        image_url: c.product.image_url,
      })),
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
          <MenuTab cart={cart} onAdd={addToCart} onDec={decFromCart}
            canOrder={showOnlineOrder}
            sections={sections} visibleSection={visibleSection}
            sectionKeys={sectionKeys} onSelectSection={setSection}
            picks={picks} onProductPress={onProductPress} creator={creator} />
        )}
        {tab === 'offers'  && <MealsOffersTab data={mealStore} brand={brand} navigation={navigation} />}
        {tab === 'reviews' && <ReviewsTab brand={brand} />}
        {tab === 'photos'  && <PhotosTab photos={heroPhotos} />}

      </ScrollView>

      {/* ── Sticky bottom CTA bar ────────────────────────────────────── */}
      {showOnlineOrder && cartCount > 0 ? (
        <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
          <Pressable onPress={goToCart} style={styles.cartBar}>
            <Text style={styles.cartBarLeft}>
              {cartCount} item{cartCount !== 1 ? 's' : ''} · ₹{Math.round(cartTotal)}
            </Text>
            <Text style={styles.cartBarRight}>View cart →</Text>
          </Pressable>
        </SafeAreaView>
      ) : (
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
      )}
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

function MenuTab({ sections, visibleSection, sectionKeys, onSelectSection, picks, onProductPress, creator, cart = {}, onAdd, onDec, canOrder }) {
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
          <View key={p.id} style={styles.dishRow}>
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
                {canOrder ? (
                  (cart[p.id]?.qty || 0) > 0 ? (
                    <View style={styles.qtyStepper}>
                      <Pressable onPress={() => onDec(p)} hitSlop={8} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyNum}>{cart[p.id].qty}</Text>
                      <Pressable onPress={() => onAdd(p)} hitSlop={8} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => onAdd(p)} style={styles.dishAddBtn}>
                      <Text style={styles.dishAddText}>+ ADD</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function StarRow({ value, size = 14, color = '#FFB800' }) {
  const full = Math.round(Number(value) || 0);
  return (
    <Text style={{ color, fontSize: size, letterSpacing: 1 }}>
      {'★★★★★'.slice(0, full)}
      <Text style={{ color: lightColors.muted4 }}>{'★★★★★'.slice(full)}</Text>
    </Text>
  );
}

function ReviewsTab({ brand }) {
  const [summary, setSummary]       = useState(null);
  const [reviews, setReviews]       = useState([]);
  const [creatorOnly, setCreatorOnly] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [writeOpen, setWriteOpen]   = useState(false);
  const [canReview, setCanReview]   = useState(false);

  const load = useCallback(async () => {
    if (!brand?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await followerApi.getBrandReviews(brand.id, { creatorOnly });
      const d = res?.data || res;
      setSummary(d?.summary || null);
      setReviews(d?.reviews || []);
    } catch (e) {
      // soft-fail — empty state covers it
    } finally {
      setLoading(false);
    }
  }, [brand?.id, creatorOnly]);

  useEffect(() => { load(); }, [load]);

  // Does this follower have a completed visit here they haven't reviewed?
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await followerApi.getReviewable();
        const list = (res?.data || res)?.reviewable || [];
        if (alive) setCanReview(list.some(r => r.brand_id === brand?.id));
      } catch { /* not logged in / none — hide the CTA */ }
    })();
    return () => { alive = false; };
  }, [brand?.id]);

  const dist = summary?.distribution || {};
  const total = summary?.review_count || 0;

  return (
    <View style={styles.section}>
      {/* Rating summary */}
      {total > 0 ? (
        <View style={rvStyles.summary}>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={rvStyles.big}>{Number(summary.avg_rating).toFixed(1)}</Text>
            <StarRow value={summary.avg_rating} size={13} />
            <Text style={rvStyles.count}>{total} RATINGS</Text>
            {summary.creator_count > 0 && (
              <Text style={rvStyles.creatorCount}>
                {summary.creator_count} creator-verified
              </Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 18 }}>
            {[5, 4, 3, 2, 1].map(n => {
              const c = dist[n] || 0;
              const pct = total ? Math.round((c / total) * 100) : 0;
              return (
                <View key={n} style={rvStyles.distRow}>
                  <Text style={rvStyles.distNum}>{n}</Text>
                  <View style={rvStyles.distTrack}>
                    <View style={[rvStyles.distFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={rvStyles.distPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Creator-verified filter toggle */}
      {total > 0 && (
        <Pressable onPress={() => setCreatorOnly(v => !v)} style={rvStyles.filterRow}>
          <CreatorChip handle="creator-verified" verified size="sm" />
          <Text style={rvStyles.filterText}>Show only creator reviews</Text>
          <View style={[rvStyles.toggle, creatorOnly && rvStyles.toggleOn]}>
            <View style={[rvStyles.knob, creatorOnly && rvStyles.knobOn]} />
          </View>
        </Pressable>
      )}

      {/* Write review CTA */}
      {canReview && (
        <Pressable onPress={() => setWriteOpen(true)} style={rvStyles.writeBtn}>
          <Text style={rvStyles.writeBtnText}>★  Rate your visit</Text>
        </Pressable>
      )}

      {/* List / states */}
      {loading ? (
        <ActivityIndicator color={lightColors.ink} style={{ marginTop: 24 }} />
      ) : reviews.length === 0 ? (
        <View style={styles.reviewsEmpty}>
          <Text style={styles.reviewsEmptyEmoji}>⭐</Text>
          <Text style={styles.h4}>
            {creatorOnly ? 'No creator reviews yet' : 'No reviews yet'}
          </Text>
          <Text style={styles.muted}>
            {creatorOnly
              ? 'Switch off the filter to see all reviews.'
              : 'Be the first to review after your visit.'}
          </Text>
        </View>
      ) : (
        reviews.map(r => (
          <View key={r.id} style={rvStyles.card}>
            <View style={rvStyles.cardHead}>
              {r.creator_trusted && r.author_handle ? (
                <CreatorChip handle={r.author_handle} verified size="sm" />
              ) : (
                <Text style={rvStyles.author}>{r.author_name || 'Guest'}</Text>
              )}
              <StarRow value={r.rating} size={12} />
              <Text style={rvStyles.date}>{fmtReviewDate(r.created_at)}</Text>
            </View>
            {r.review_text ? (
              <Text style={rvStyles.body}>{r.review_text}</Text>
            ) : null}
            {Array.isArray(r.photos) && r.photos.length > 0 && (
              <View style={rvStyles.photoRow}>
                {r.photos.slice(0, 4).map((p, i) => (
                  <Image key={i} source={{ uri: typeof p === 'string' ? p : p.url }}
                    style={rvStyles.photo} />
                ))}
              </View>
            )}
          </View>
        ))
      )}

      <WriteReviewModal
        visible={writeOpen}
        brandId={brand?.id}
        brandName={brand?.business_name}
        onClose={() => setWriteOpen(false)}
        onDone={() => { setWriteOpen(false); setCanReview(false); load(); }}
      />
    </View>
  );
}

function WriteReviewModal({ visible, brandId, brandName, onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [text, setText]     = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (rating < 1) { Alert.alert('Pick a rating', 'Tap the stars to rate 1–5.'); return; }
    setSaving(true);
    try {
      const res = await followerApi.postReview({
        brand_id: brandId, rating, review_text: text.trim() || undefined,
      });
      if (res?.success || res?.data) {
        onDone();
        setRating(0); setText('');
      } else {
        Alert.alert('Could not post', res?.error?.message || 'Try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rvStyles.modalBg}>
        <View style={rvStyles.modalCard}>
          <Text style={rvStyles.modalTitle}>Rate {brandName || 'this restaurant'}</Text>
          <View style={rvStyles.starPick}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Text style={[rvStyles.starPickGlyph,
                  n <= rating && rvStyles.starPickGlyphOn]}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What stood out? (optional)"
            placeholderTextColor={lightColors.muted3}
            style={rvStyles.modalInput}
            multiline
          />
          <View style={rvStyles.modalActions}>
            <Pressable onPress={onClose} style={rvStyles.modalCancel}>
              <Text style={rvStyles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={saving}
              style={[rvStyles.modalSubmit, saving && { opacity: 0.6 }]}>
              {saving
                ? <ActivityIndicator color={lightColors.ink} />
                : <Text style={rvStyles.modalSubmitText}>Post review</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function fmtReviewDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return '1 DAY AGO';
  if (days < 7) return `${days} DAYS AGO`;
  if (days < 30) return `${Math.floor(days / 7)} WK AGO`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase();
}

const rvStyles = StyleSheet.create({
  summary: { flexDirection: 'row', paddingVertical: 16, borderBottomColor: lightColors.border, borderBottomWidth: 1 },
  big: { fontFamily: fonts.displayBlack, fontSize: 34, color: lightColors.ink, letterSpacing: -1 },
  count: { fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted, marginTop: 4 },
  creatorCount: { fontFamily: fonts.monoBold, fontSize: 10, color: lightColors.success, marginTop: 2 },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  distNum: { width: 14, fontFamily: fonts.monoMedium, fontSize: 11, color: lightColors.muted2 },
  distTrack: { flex: 1, height: 5, backgroundColor: lightColors.bg2, borderRadius: 3, marginHorizontal: 6 },
  distFill: { height: '100%', backgroundColor: lightColors.success, borderRadius: 3 },
  distPct: { width: 32, textAlign: 'right', fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: lightColors.ink, borderRadius: 10, padding: 12, marginTop: 14 },
  filterText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 12, color: lightColors.white },
  toggle: { width: 38, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.25)', padding: 2 },
  toggleOn: { backgroundColor: lightColors.yellow },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: lightColors.white },
  knobOn: { alignSelf: 'flex-end' },
  writeBtn: { marginTop: 14, backgroundColor: lightColors.yellow, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  writeBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
  card: { paddingVertical: 14, borderBottomColor: lightColors.border, borderBottomWidth: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  author: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
  date: { marginLeft: 'auto', fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted },
  body: { fontFamily: fonts.sansRegular, fontSize: 13, lineHeight: 19, color: lightColors.ink2 },
  photoRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  photo: { width: 50, height: 50, borderRadius: 5, backgroundColor: lightColors.bg2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(10,10,10,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: lightColors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  modalTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: lightColors.ink, letterSpacing: -0.3 },
  starPick: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 18 },
  starPickGlyph: { fontSize: 38, color: lightColors.muted4 },
  starPickGlyphOn: { color: '#FFB800' },
  modalInput: { borderColor: lightColors.muted4, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 70, fontFamily: fonts.sansRegular, fontSize: 13, color: lightColors.ink, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 10, borderColor: lightColors.muted4, borderWidth: 1, alignItems: 'center' },
  modalCancelText: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink2 },
  modalSubmit: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: lightColors.yellow, alignItems: 'center' },
  modalSubmitText: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
});

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

// ── INFLX Meals — Offers tab (mockup 03) ─────────────────────────────────────

function MealsOffersTab({ data, brand, navigation }) {
  const offers = (data && data.offers) || [];
  const byParty = (data && data.offers_by_party) || {};
  const partyKeys = Object.keys(byParty);
  const [psize, setPsize] = useState(null);
  const active = psize || partyKeys[0] || null;
  const shown = active ? (byParty[active] || []) : offers;
  const slot = (data && data.slots && data.slots[0]) || null;

  const goChat = () => navigation.navigate('MealsChat', { brand, brandId: brand.id });

  if (!data || offers.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.muted}>No planned-meal offers here yet.</Text>
        <Pressable onPress={goChat} style={mo.chatBtn} testID="meals-plan-chat">
          <Text style={mo.chatBtnText}>💬 Plan a meal by chat</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={mo.noteRow}>
        <Text style={mo.note}>
          Plan-ahead meals — pay before the cutoff{slot ? ` (order by ~${slot.cutoff_minutes_before} min before ${slot.label})` : ''}. Self-delivery within {data.delivery_radius_km || 5} km.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
        {partyKeys.map((k) => (
          <Pressable key={k} onPress={() => setPsize(k)} style={[mo.psize, active === k && mo.psizeOn]}>
            <Text style={[mo.psizeText, active === k && mo.psizeTextOn]}>{PARTY_LABELS[k] || k} {byParty[k].length}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {shown.map((o) => (
        <View key={o.id} style={mo.card} testID={`store-offer-${o.id}`}>
          <Text style={mo.cName}>{o.name}</Text>
          <Text style={mo.cItems} numberOfLines={1}>
            {(o.items_json || []).map((it) => `${it.qty ? it.qty + '× ' : ''}${it.name}`).join(', ') || 'Chef’s pack'}
          </Text>
          <Text style={mo.cPrice}>
            ₹{Math.round(o.price)}
            {o.original_price && Number(o.original_price) > Number(o.price)
              ? <Text style={mo.cStrike}>  ₹{Math.round(o.original_price)}</Text> : null}
          </Text>
          {Array.isArray(o.freebies_json) && o.freebies_json.length > 0 && (
            <Text style={mo.cFree}>🎁 {o.freebies_json.join(', ')}</Text>
          )}
          <Pressable onPress={goChat} style={mo.orderBtn} testID={`store-offer-order-${o.id}`}>
            <Text style={mo.orderText}>Order this →</Text>
          </Pressable>
        </View>
      ))}

      <Pressable onPress={goChat} style={mo.chatBtn} testID="meals-plan-chat">
        <Text style={mo.chatBtnText}>💬 Don&apos;t see your combo? Plan by chat</Text>
      </Pressable>
    </View>
  );
}

const mo = StyleSheet.create({
  noteRow: { backgroundColor: lightColors.successPale, borderColor: '#cde9d6', borderWidth: 1, borderRadius: 10, padding: 10 },
  note: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: '#2c6e44' },
  psize: { borderColor: lightColors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: '#fff' },
  psizeOn: { backgroundColor: lightColors.ink, borderColor: lightColors.ink },
  psizeText: { fontFamily: fonts.sansBold, fontSize: 12, color: lightColors.muted },
  psizeTextOn: { color: '#fff' },
  card: { backgroundColor: '#fff', borderColor: lightColors.border, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 10 },
  cName: { fontFamily: fonts.displayBold, fontSize: 15, color: lightColors.ink },
  cItems: { fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.muted, marginTop: 3 },
  cPrice: { fontFamily: fonts.monoBold, fontSize: 16, color: lightColors.ink, marginTop: 6 },
  cStrike: { fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.muted3, textDecorationLine: 'line-through' },
  cFree: { fontFamily: fonts.sansBold, fontSize: 11.5, color: lightColors.success, marginTop: 3 },
  orderBtn: { marginTop: 10, backgroundColor: lightColors.yellow, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  orderText: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
  chatBtn: { marginTop: 6, borderColor: lightColors.muted4, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  chatBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: lightColors.ink2 },
});

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

  hero: { height: HERO_HEIGHT, backgroundColor: lightColors.bg2, position: 'relative' },
  heroFallback: {
    height: HERO_HEIGHT, backgroundColor: lightColors.bg2,
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
    borderColor: lightColors.yellowPale, borderWidth: 1,
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
    backgroundColor: lightColors.bg2,
    borderColor: lightColors.border, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
  },
  amenityText: { fontFamily: fonts.sansMedium, fontSize: 10, color: lightColors.ink2 },

  subTabs: {
    flexDirection: 'row',
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.white, marginTop: 10,
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
    borderColor: lightColors.yellowPale, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  vibeTagText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: lightColors.yellowText },

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
  dishImg: { width: 80, height: 80, borderRadius: 8, backgroundColor: lightColors.bg2 },
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
  qtyStepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: lightColors.yellow, borderRadius: 6, paddingHorizontal: 4 },
  qtyBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  qtyBtnText: { fontFamily: fonts.displayBlack, fontSize: 14, color: lightColors.ink },
  qtyNum: { fontFamily: fonts.monoBold, fontSize: 12, color: lightColors.ink, minWidth: 16, textAlign: 'center' },
  cartBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: lightColors.yellow, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  cartBarLeft: { fontFamily: fonts.sansBold, fontSize: 14, color: lightColors.ink },
  cartBarRight: { fontFamily: fonts.sansBold, fontSize: 14, color: lightColors.ink },
  bestsellerChip: {
    backgroundColor: lightColors.yellow50,
    borderColor: lightColors.yellowPale, borderWidth: 1,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  bestsellerText: { fontFamily: fonts.monoBold, fontSize: 8, color: lightColors.yellowText },
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
  ratingStars: { color: '#FFB800', fontSize: 13, marginTop: 4 },
  ratingCount: { fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted, marginTop: 4 },
  reviewsEmpty: { alignItems: 'center', paddingVertical: 40 },
  reviewsEmptyEmoji: { fontSize: 40, marginBottom: 8 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photoCell: {
    width: (SCREEN_WIDTH - 32 - 12) / 3, aspectRatio: 1,
    borderRadius: 6, overflow: 'hidden', backgroundColor: lightColors.bg2,
  },
  photoImg: { width: '100%', height: '100%' },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: lightColors.white,
    borderTopColor: lightColors.border, borderTopWidth: 1,
  },
  ctaInner: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  ctaBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ctaBtnSecondary: {
    width: 52, backgroundColor: lightColors.bg2,
    borderColor: lightColors.border, borderWidth: 1,
  },
  ctaBtnPrimary: { backgroundColor: lightColors.yellow },
  ctaSecondaryGlyph: { fontSize: 18 },
  ctaPrimaryText: {
    fontFamily: fonts.sansBold, fontSize: 14,
    color: lightColors.ink, letterSpacing: -0.1,
  },
});
