import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { colors, darkColors, fmtMoney, fmtRupees, getBusinessAccent } from '../../theme/tokens';
import { followerApi } from '../../services/api';

/**
 * ProductDetailScreen — single-product detail page reached from any product
 * tap in the follower app (creator store, deals tab, category list, home feed).
 *
 * The previous version was a multi-product cart picker that defaulted to the
 * first product in the influencer's store. That conflated two screens: a
 * "single product detail" and a "build your cart" picker. Today the user
 * expects: tap one product → see THAT product + its CTAs. We redesigned
 * around that.
 *
 * Layout:
 *   • Hero image (or category emoji fallback)
 *   • Title + brand line + section
 *   • Creator's note (when present)
 *   • MRP + discounted price
 *   • Description
 *   • CTAs derived from offer.availing_modes:
 *       - online_order → "Buy Now"        (→ OnlineOrder)
 *       - pay_at_store / walkin_pay → "Pay at Venue"  (→ PayAtStore)
 *       - prebook → "Book Slot"           (→ PreBook)
 *       - enquiry → "Enquire"             (→ Enquiry)
 *   • "More from <brand>" — horizontal scroll of other products from the
 *     same offer (loaded on-demand from the same getStoreProducts call,
 *     filtered to !== selectedProductId)
 *
 * Route params expected:
 *   {
 *     offer: { id, offer_type, discount_value, availing_modes, title? },
 *     brand: { id, name, category, locality, city? },
 *     store: { instagram_handle, name },
 *     influencer: { id, name, instagram_handle, ... },
 *     selectedProductId: <uuid>,           // REQUIRED — the tapped product
 *     product?: { ... },                   // OPTIONAL preview — used while loading
 *     tracking / trackingParams: { campaign_id, set_id, offer_id, campaign_influencer_id },
 *   }
 */

const CATEGORY_EMOJI = {
  restaurant:     '🍽️',
  salon:          '💇',
  car_rental:     '🚗',
  bike_rental:    '🏍️',
  fashion:        '👗',
  fashion_walkin: '👗',
  fashion_online: '👕',
  bakery:         '🧁',
  florist:        '💐',
};

const MODE_LABELS = {
  online_order:  { label: 'Buy Now',     screen: 'OnlineOrder',  emoji: '🛒' },
  pay_at_store:  { label: 'Pay at Venue', screen: 'PayAtStore',   emoji: '💸' },
  walkin_pay:    { label: 'Pay at Venue', screen: 'PayAtStore',   emoji: '💸' },
  prebook:       { label: 'Book Slot',   screen: 'PreBook',      emoji: '📅' },
  enquiry:       { label: 'Enquire',     screen: 'Enquiry',      emoji: '✉️' },
};

export default function ProductDetailScreen({ navigation, route }) {
  const {
    offer,
    brand,
    store,
    influencer,
    selectedProductId,
    product: previewProduct,   // optional — drawn from the card the user tapped
    tracking,
    trackingParams,
  } = route.params || {};

  const handle = store?.instagram_handle || influencer?.instagram_handle || '';
  const trk = tracking || trackingParams || null;
  const offerId = offer?.id || offer?.offer_id || trk?.offer_id || null;
  // campaign_influencer_id is always present even when there's no
  // campaign_offers row (conversion test campaigns configure offers per-CI
  // via offer_config_json). Used as fallback scope to load the right brand's
  // products without leaking unrelated cars onto a restaurant tap.
  const ciId = trk?.campaign_influencer_id || null;

  const [products, setProducts] = useState(previewProduct ? [previewProduct] : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const accent = getBusinessAccent(brand?.category)?.accent || colors.orange;
  const accentDim = getBusinessAccent(brand?.category)?.dim || 'rgba(245,158,11,0.08)';

  useEffect(() => {
    async function load() {
      if (!handle) {
        setError('Missing creator handle');
        setLoading(false);
        return;
      }
      if (!offerId && !ciId) {
        setError('Missing offer context — the tap source did not pass an offer or campaign assignment id');
        setLoading(false);
        return;
      }
      const res = await followerApi.getStoreProducts(handle, { offerId, ciId });
      setLoading(false);
      if (res.success) {
        const items = res.data?.products || [];
        setProducts(items);
      } else {
        setError(res.error?.message || 'Failed to load product');
      }
    }
    load();
  }, [handle, offerId, ciId]);

  const selected = products.find(p => p.id === selectedProductId) || products[0] || previewProduct || null;
  const others = products.filter(p => p.id !== selected?.id);

  // ── Compute prices ─────────────────────────────────────────────────────
  const price = parseFloat(selected?.price || 0);
  const discountValue = parseFloat(offer?.discount_value || 0);
  let finalPrice = price;
  let savings = 0;
  let badgeLabel = null;
  if (offer && discountValue > 0) {
    const ot = (offer.offer_type || '').toLowerCase();
    if (ot === 'percentage' || ot === 'discount' || ot === '') {
      savings = parseFloat((price * (discountValue / 100)).toFixed(2));
      finalPrice = parseFloat((price - savings).toFixed(2));
      badgeLabel = `${discountValue}% OFF`;
    } else if (ot === 'flat') {
      savings = Math.min(discountValue, price);
      finalPrice = parseFloat((price - savings).toFixed(2));
      badgeLabel = `${fmtRupees(discountValue)} OFF`;
    } else if (ot === 'bogo') {
      badgeLabel = 'BOGO';
    } else if (ot === 'bundle') {
      badgeLabel = 'BUNDLE';
    } else if (ot === 'volume' || ot === 'volume_discount') {
      badgeLabel = 'VOLUME DEAL';
    } else if (ot === 'free_gift' || ot === 'gift') {
      badgeLabel = '+ FREE GIFT';
    }
  }

  // ── CTA list from availing_modes ───────────────────────────────────────
  const availingModes = Array.isArray(offer?.availing_modes) ? offer.availing_modes : ['online_order'];
  const ctaList = [];
  const seenScreens = new Set();
  for (const m of availingModes) {
    const cfg = MODE_LABELS[m];
    if (!cfg || seenScreens.has(cfg.screen)) continue;
    seenScreens.add(cfg.screen);
    ctaList.push({ mode: m, ...cfg });
  }
  if (ctaList.length === 0) {
    ctaList.push({ mode: 'online_order', ...MODE_LABELS.online_order });
  }
  const primaryCta = ctaList[0];
  const secondaryCtas = ctaList.slice(1);

  function dispatchCta(cta) {
    if (!selected) return;
    const params = {
      offer,
      brand,
      store: store || { name: brand?.name, instagram_handle: handle },
      influencer,
      product: selected,
      products: [selected],
      tracking: trk,
      trackingParams: trk,
    };
    navigation.navigate(cta.screen, params);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading && !selected) {
    return <View style={styles.center}><ActivityIndicator size="large" color={accent} /></View>;
  }

  if (error || !selected) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
        <Text style={styles.emptyText}>{error || 'Product not available'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container}>
        {/* Back button (floats over the hero) */}
        <TouchableOpacity style={styles.backFloating} onPress={() => navigation.goBack()}>
          <Text style={styles.backFloatingText}>←</Text>
        </TouchableOpacity>

        {/* Hero image */}
        <View style={[styles.hero, { backgroundColor: accentDim }]}>
          {selected.image_url ? (
            <Image source={{ uri: selected.image_url }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <Text style={styles.heroEmoji}>{CATEGORY_EMOJI[brand?.category] || '📦'}</Text>
          )}
          {badgeLabel && (
            <View style={[styles.heroBadge, { backgroundColor: accent }]}>
              <Text style={styles.heroBadgeText}>{badgeLabel}</Text>
            </View>
          )}
        </View>

        {/* Title + brand + creator note */}
        <View style={styles.body}>
          <Text style={styles.productName}>{selected.name}</Text>

          <TouchableOpacity
            style={styles.brandRow}
            onPress={() => navigation.navigate('BrandStore', {
              brandId: brand?.id,
              brandName: brand?.name,
              tracking: trk,
            })}
          >
            <Text style={styles.brandLine} numberOfLines={1}>
              from {brand?.name}{brand?.city || brand?.locality ? ` · ${brand.city || brand.locality}` : ''}
            </Text>
            <Text style={[styles.brandChevron, { color: accent }]}>{'›'}</Text>
          </TouchableOpacity>

          {selected.section ? (
            <Text style={styles.section}>{selected.section}</Text>
          ) : null}

          {/* Creator's vibe */}
          {selected.influencer_note ? (
            <View style={[styles.noteBox, { backgroundColor: accentDim, borderColor: accent + '40' }]}>
              <Text style={[styles.noteAttribution, { color: accent }]}>
                {influencer?.name || influencer?.instagram_handle ? `@${influencer.instagram_handle || influencer.name}'s take` : "Creator's take"}
              </Text>
              <Text style={styles.noteQuote}>"{selected.influencer_note}"</Text>
            </View>
          ) : null}

          {/* Price block */}
          <View style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <Text style={styles.priceFinal}>{fmtRupees(finalPrice)}</Text>
              {savings > 0 ? (
                <Text style={styles.priceMRP}>{fmtRupees(price)}</Text>
              ) : null}
            </View>
            {savings > 0 ? (
              <Text style={[styles.savings, { color: accent }]}>You save {fmtRupees(savings)}</Text>
            ) : null}
          </View>

          {/* Description */}
          {selected.description ? (
            <View style={styles.descBlock}>
              <Text style={styles.descTitle}>Details</Text>
              <Text style={styles.descBody}>{selected.description}</Text>
            </View>
          ) : null}

          {/* Secondary CTAs (when offer supports more than one mode) */}
          {secondaryCtas.length > 0 && (
            <View style={styles.secondaryCtaRow}>
              {secondaryCtas.map(cta => (
                <TouchableOpacity
                  key={cta.mode}
                  style={[styles.secondaryCta, { borderColor: accent }]}
                  onPress={() => dispatchCta(cta)}
                >
                  <Text style={styles.secondaryCtaEmoji}>{cta.emoji}</Text>
                  <Text style={[styles.secondaryCtaText, { color: accent }]}>{cta.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* More from this brand */}
          {others.length > 0 && (
            <View style={styles.moreBlock}>
              <Text style={styles.moreTitle}>More from {brand?.name}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
                {others.slice(0, 10).map(other => (
                  <TouchableOpacity
                    key={other.id}
                    style={styles.moreCard}
                    onPress={() => navigation.replace('ProductDetail', {
                      offer,
                      brand,
                      store,
                      influencer,
                      selectedProductId: other.id,
                      product: other,
                      tracking: trk,
                      trackingParams: trk,
                    })}
                  >
                    <View style={[styles.moreImg, { backgroundColor: accentDim }]}>
                      {other.image_url ? (
                        <Image source={{ uri: other.image_url }} style={styles.moreImgFill} resizeMode="cover" />
                      ) : (
                        <Text style={styles.moreEmoji}>{CATEGORY_EMOJI[brand?.category] || '📦'}</Text>
                      )}
                    </View>
                    <Text style={styles.moreName} numberOfLines={2}>{other.name}</Text>
                    <Text style={[styles.morePrice, { color: accent }]}>{fmtRupees(other.discounted_price || other.price)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Sticky primary CTA */}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerPrice}>{fmtRupees(finalPrice)}</Text>
          <Text style={styles.footerName} numberOfLines={1}>{selected.name}</Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryCta, { backgroundColor: accent }]}
          onPress={() => dispatchCta(primaryCta)}
        >
          <Text style={styles.primaryCtaText}>{primaryCta.emoji} {primaryCta.label}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  emptyText: { fontSize: 14, color: colors.t2, marginBottom: 16, paddingHorizontal: 32, textAlign: 'center' },
  goBackBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface2, borderRadius: 12 },
  goBackBtnText: { fontSize: 14, fontWeight: '700', color: colors.navy },

  backFloating: {
    position: 'absolute', top: 44, left: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  backFloatingText: { fontSize: 18, color: colors.t1, fontWeight: '700' },

  hero: { height: 280, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroEmoji: { fontSize: 96 },
  heroBadge: {
    position: 'absolute', top: 56, right: 16,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  body: { padding: 20 },
  productName: { fontSize: 22, fontWeight: '800', color: colors.t1, marginBottom: 6 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandLine: { fontSize: 13, color: colors.t3, flexShrink: 1 },
  brandChevron: { fontSize: 16, fontWeight: '300' },
  section: { fontSize: 11, color: colors.t3, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  noteBox: {
    marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  noteAttribution: { fontSize: 10, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  noteQuote: { fontSize: 13, color: colors.t1, fontStyle: 'italic', lineHeight: 19 },

  priceBlock: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  priceFinal: { fontSize: 28, fontWeight: '800', color: colors.t1 },
  priceMRP: { fontSize: 14, color: colors.t3, textDecorationLine: 'line-through' },
  savings: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  descBlock: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border },
  descTitle: { fontSize: 11, fontWeight: '800', color: colors.t3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  descBody: { fontSize: 13, color: colors.t2, lineHeight: 20 },

  secondaryCtaRow: { flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  secondaryCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5,
  },
  secondaryCtaEmoji: { fontSize: 14 },
  secondaryCtaText: { fontSize: 13, fontWeight: '700' },

  moreBlock: { marginTop: 22 },
  moreTitle: { fontSize: 13, fontWeight: '800', color: colors.t1, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  moreCard: { width: 130 },
  moreImg: { width: 130, height: 100, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  moreImgFill: { width: '100%', height: '100%' },
  moreEmoji: { fontSize: 36 },
  moreName: { fontSize: 12, fontWeight: '700', color: colors.t1, marginTop: 6, lineHeight: 15 },
  morePrice: { fontSize: 13, fontWeight: '800', marginTop: 2 },

  footer: {
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  footerPrice: { fontSize: 20, fontWeight: '800', color: colors.t1 },
  footerName: { fontSize: 11, color: colors.t3, marginTop: 2 },
  primaryCta: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  primaryCtaText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
