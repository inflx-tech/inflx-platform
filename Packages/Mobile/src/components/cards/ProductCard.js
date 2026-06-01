import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { creatorVibe as C, fmtMoney, getBusinessAccentLight, fonts } from '../../theme/tokens';

// Flow 52.1 — Creator Vibe recolor via local palette shim. Maps the F0 tokens
// this component used onto the creatorVibe palette (white→card, yellow→star amber,
// yellowText→brown, yellowPale→soft, success→verify blue tick, danger→offer).
// Chrome re-themes; all card logic (offer-badge math, trust chips, prices) untouched.
const P = {
  white: C.card, card: C.card, bg2: C.soft,
  border: C.line, ink: C.ink,
  muted: C.muted, muted2: C.muted, muted3: C.muted,
  yellow: C.star, yellowText: C.brown, yellowPale: C.soft,
  success: C.verify, danger: C.offer,
};

/**
 * ProductCard — 2-column grid product card for the follower app.
 *
 * Flow 38 (F0) restyle (2026-05-27): flipped dark → LIGHT brandPalette.
 * White card chrome + ink/yellow discount badge + per-business pale hero tint
 * (wayfinding only) + ink/yellow creator avatar overlay + creator-note quote
 * (kept per locked design call) + mono prices. Per-business accent is used
 * ONLY for the hero tint; all chrome/text/badge = brandPalette ink+yellow.
 */

export default function ProductCard({
  product,       // { name, price (rupees), image_url, description, influencer_note }
  brand,         // { name, category, locality }
  discount,      // { type, value, label }
  influencer,    // { name, avatar_initial } or null
  accentColor,   // optional override (ignored for chrome; only affects hero tint fallback)
  onPress,
  onPressBrand,  // optional — brand line becomes tappable (→ BrandStore)
  onPressHeart,
  isSaved,
}) {
  const accentCfg = getBusinessAccentLight(brand?.category);
  const heroTint = accentCfg.pale;
  const icon = accentCfg.icon;

  const mrp = product?.price || 0;

  const offerBadge = computeOfferBadge(discount);
  const discountLabel = offerBadge.label;
  const discountPct = offerBadge.kind === 'pct' ? Number(offerBadge.value) : 0;
  const offerPrice = discountPct > 0 ? Math.floor(mrp * (1 - discountPct / 100)) : mrp;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Hero — real product image, category emoji fallback over a per-business pale tint */}
      <View style={[styles.hero, { backgroundColor: heroTint }]}>
        {product?.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <Text style={styles.heroIcon}>{icon}</Text>
        )}

        {/* Discount badge — ink + yellow (brand) */}
        {discountLabel && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{discountLabel}</Text>
          </View>
        )}

        {/* Heart */}
        <TouchableOpacity style={styles.heart} onPress={onPressHeart}>
          <Text style={[styles.heartText, isSaved && { color: P.danger }]}>{isSaved ? '♥' : '♡'}</Text>
        </TouchableOpacity>

        {/* Influencer mini-avatar — ink pill + yellow avatar */}
        {influencer && (
          <View style={styles.infOverlay}>
            <View style={styles.infAvatar}>
              <Text style={styles.infAvatarText}>{influencer.avatar_initial || influencer.name?.[0] || '?'}</Text>
            </View>
            <Text style={styles.infName}>{influencer.name}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.productName} numberOfLines={2}>{product?.name}</Text>

        {/* Creator's "vibe" note — quoted, italic, capped at 2 lines (kept per F0 design call) */}
        {product?.influencer_note ? (
          <Text style={styles.creatorNote} numberOfLines={2}>
            "{product.influencer_note}"
          </Text>
        ) : null}

        {/* Brand line + verified check + optional tap-to-store */}
        {onPressBrand ? (
          <TouchableOpacity style={styles.brandRow} onPress={onPressBrand} activeOpacity={0.7}>
            <Text style={styles.brandLine} numberOfLines={1}>
              from {brand?.name}{brand?.locality ? ` · ${brand.locality}` : ''}
            </Text>
            {brand?.is_verified !== false && <Text style={styles.brandVerified}>✓</Text>}
            <Text style={styles.brandChevron}>{'›'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.brandRow}>
            <Text style={styles.brandLine} numberOfLines={1}>
              {brand?.name}{brand?.locality ? ` · ${brand.locality}` : ''}
            </Text>
            {brand?.is_verified !== false && <Text style={styles.brandVerified}>✓</Text>}
          </View>
        )}

        {/* Trust chips — derived from category */}
        {renderTrustChips(brand?.category)}

        {/* Prices — mono */}
        <View style={styles.priceRow}>
          <Text style={styles.offerPrice}>{fmtMoney(offerPrice)}</Text>
          {discountPct > 0 && <Text style={styles.mrp}>{fmtMoney(mrp)}</Text>}
        </View>

        {/* Deal label — yellowPale */}
        {discount?.label && (
          <View style={styles.dealLabel}>
            <Text style={styles.dealLabelText}>{discount.label}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Offer-badge derivation (unchanged logic — 5 wizard offer types) ─────────────

function computeOfferBadge(discount) {
  if (!discount) return { label: null, kind: 'none' };
  const type = String(discount.type || '').toLowerCase();
  if (type === 'percentage' && discount.value) {
    return { label: `${discount.value}% OFF`, kind: 'pct', value: discount.value };
  }
  if (type === 'flat' && discount.value) {
    return { label: `₹${discount.value} OFF`, kind: 'flat', value: discount.value };
  }
  if (type === 'discount') {
    const subType = discount.sub_type || (discount.value > 100 ? 'flat' : 'pct');
    if (subType === 'flat') return { label: `₹${discount.value} OFF`, kind: 'flat', value: discount.value };
    return { label: `${discount.value}% OFF`, kind: 'pct', value: discount.value };
  }
  if (type === 'volume' || type === 'volume discount' || type === 'volume_discount') {
    return { label: 'VOLUME DEAL', kind: 'volume' };
  }
  if (type === 'bogo') return { label: 'BOGO', kind: 'bogo' };
  if (type === 'bundle') return { label: 'BUNDLE', kind: 'bundle' };
  if (type === 'free gift' || type === 'free_gift' || type === 'gift') {
    return { label: '+ FREE GIFT', kind: 'free_gift' };
  }
  if (typeof discount.value === 'number' && discount.value > 0) {
    return { label: `${discount.value}% OFF`, kind: 'pct', value: discount.value };
  }
  return { label: null, kind: 'none' };
}

const TRUST_CHIPS_BY_CATEGORY = {
  salon:          ['💸 Pay at salon', '✕ Free cancel'],
  restaurant:     ['💸 Pay at venue'],
  car_rental:     ['✕ Free cancel', '💸 Pay at pickup'],
  fashion:        ['↩ 7-day returns', '💸 Pay at store'],
  fashion_walkin: ['↩ 7-day returns', '💸 Pay at store'],
  fashion_online: ['↩ 7-day returns', '💸 COD available'],
};

function renderTrustChips(category) {
  const chips = TRUST_CHIPS_BY_CATEGORY[category];
  if (!chips) return null;
  return (
    <View style={styles.trustRow}>
      {chips.map((c, i) => (
        <View key={i} style={styles.trustChip}>
          <Text style={styles.trustChipText}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: P.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
    overflow: 'hidden',
  },
  hero: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  heroIcon: { fontSize: 46 },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: P.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: P.yellow, letterSpacing: 0.2, fontFamily: fonts.monoBold },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartText: { fontSize: 14, color: P.muted },
  infOverlay: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10,10,10,0.82)',
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 9,
    borderRadius: 999,
  },
  infAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: P.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infAvatarText: { fontSize: 8, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  infName: { fontSize: 8, color: '#fff', fontWeight: '700', fontFamily: fonts.monoMedium },
  body: { padding: 10 },
  productName: { fontSize: 12.5, fontWeight: '800', color: P.ink, lineHeight: 16, fontFamily: fonts.displayBold },
  creatorNote: { fontSize: 10, fontStyle: 'italic', color: P.muted, marginTop: 3, lineHeight: 14, fontFamily: fonts.sansRegular },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  brandLine: { fontSize: 9, color: P.muted2, flexShrink: 1, fontWeight: '700', fontFamily: fonts.monoMedium },
  brandVerified: { fontSize: 9, fontWeight: '800', color: P.success },
  brandChevron: { fontSize: 12, color: P.muted3, fontWeight: '300', marginLeft: 'auto' },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  trustChip: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 7, borderWidth: 1, borderColor: P.border,
  },
  trustChipText: { fontSize: 8, fontWeight: '800', color: P.muted, fontFamily: fonts.monoBold },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 7 },
  offerPrice: { fontSize: 15, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  mrp: { fontSize: 10, color: P.muted3, textDecorationLine: 'line-through', fontFamily: fonts.monoMedium },
  dealLabel: {
    alignSelf: 'flex-start',
    backgroundColor: P.yellowPale,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 5,
  },
  dealLabelText: { fontSize: 9, fontWeight: '800', color: P.yellowText, fontFamily: fonts.monoBold },
});
