import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { darkColors, fmtMoney, getBusinessAccent, fonts } from '../../theme/tokens';

/**
 * ProductCard — 2-column grid product card for the follower app.
 *
 * Matches the HTML mockup: product image hero (130px), discount badge (top-left),
 * heart (top-right), influencer mini-avatar (bottom-left), product name (2-line),
 * brand + location, MRP strikethrough + offer price in accent color.
 */

export default function ProductCard({
  product,       // { name, price (paise), image_url, description, influencer_note }
  brand,         // { name, category, locality }
  discount,      // { type, value, label } e.g. { type: 'percentage', value: 25, label: "Meena's Saree Deal" }
  influencer,    // { name, avatar_initial, gradient } or null
  accentColor,   // override accent or derived from brand.category
  onPress,
  onPressBrand,  // optional — when set, brand line becomes a tappable link (→ BrandStore)
  onPressHeart,
  isSaved,
}) {
  const accent = accentColor || getBusinessAccent(brand?.category).accent;
  const accentDim = getBusinessAccent(brand?.category).dim;
  const icon = getBusinessAccent(brand?.category).icon;

  const mrp = product?.price || 0;

  // Tier-1 conversion fix: render the right badge per the 5 wizard offer
  // types \u2014 Discount, Volume, BOGO, Bundle, Free gift. The `discount` prop
  // shape varies; type-specific subtypes win when present.
  const offerBadge = computeOfferBadge(discount);
  const discountLabel = offerBadge.label;
  // Card-side strikethrough only applies for known % discount (badge-as-pct).
  // Other mechanics (Bundle / BOGO / Volume / Free gift) need cart context to
  // compute final price \u2014 show MRP only.
  const discountPct = offerBadge.kind === 'pct' ? Number(offerBadge.value) : 0;
  const offerPrice = discountPct > 0 ? Math.floor(mrp * (1 - discountPct / 100)) : mrp;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Hero area */}
      <View style={[styles.hero, { backgroundColor: accentDim || 'rgba(245,158,11,0.08)' }]}>
        <Text style={styles.heroIcon}>{icon}</Text>

        {/* Discount badge */}
        {discountLabel && (
          <View style={[styles.badge, { backgroundColor: accentDim }]}>
            <Text style={[styles.badgeText, { color: accent }]}>{discountLabel}</Text>
          </View>
        )}

        {/* Heart */}
        <TouchableOpacity style={styles.heart} onPress={onPressHeart}>
          <Text style={styles.heartText}>{isSaved ? '♥' : '♡'}</Text>
        </TouchableOpacity>

        {/* Influencer mini-avatar */}
        {influencer && (
          <View style={styles.infOverlay}>
            <View style={[styles.infAvatar, { backgroundColor: accent }]}>
              <Text style={styles.infAvatarText}>{influencer.avatar_initial || influencer.name?.[0] || '?'}</Text>
            </View>
            <Text style={styles.infName}>{influencer.name}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.productName} numberOfLines={2}>{product?.name}</Text>

        {/* Creator's "vibe" — the influencer's personal note on this product
            (from influencer_product_notes). Quoted, italic, capped at 2 lines
            so the card stays tight. Hidden when the surface doesn't ship a
            note (organic browse, brand-store grid). */}
        {product?.influencer_note ? (
          <Text style={styles.creatorNote} numberOfLines={2}>
            "{product.influencer_note}"
          </Text>
        ) : null}

        {/* Brand line with inline verified check + optional tap-to-brand-store.
            Phase Salon-3 — every visible brand is admin-approved (the feed
            and category endpoints filter on users.status). We render the
            green ✓ by default and gate on brand.is_verified === false only
            when callers explicitly opt out. The whole row becomes a
            TouchableOpacity when `onPressBrand` is provided; the chevron
            communicates the affordance. Without onPressBrand it stays a
            passive label. stopPropagation isn't needed in RN — onPress on a
            nested TouchableOpacity short-circuits the parent. */}
        {onPressBrand ? (
          <TouchableOpacity style={styles.brandRow} onPress={onPressBrand} activeOpacity={0.7}>
            <Text style={styles.brandLine} numberOfLines={1}>
              from {brand?.name}{brand?.locality ? ` · ${brand.locality}` : ''}
            </Text>
            {brand?.is_verified !== false && (
              <Text style={styles.brandVerified}>✓</Text>
            )}
            <Text style={styles.brandChevron}>{'›'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.brandRow}>
            <Text style={styles.brandLine} numberOfLines={1}>
              {brand?.name}{brand?.locality ? ` · ${brand.locality}` : ''}
            </Text>
            {brand?.is_verified !== false && (
              <Text style={styles.brandVerified}>✓</Text>
            )}
          </View>
        )}

        {/* Phase Salon-3 trust chips — derived from category. Compact strip
            so the card doesn't bloat. Salon and car_rental show two chips;
            restaurant shows one. Categories without trust signals show none. */}
        {renderTrustChips(brand?.category, accent)}

        {/* Prices */}
        <View style={styles.priceRow}>
          <Text style={[styles.offerPrice, { color: accent }]}>{fmtMoney(offerPrice)}</Text>
          {discountPct > 0 && <Text style={styles.mrp}>{fmtMoney(mrp)}</Text>}
        </View>

        {/* Deal label */}
        {discount?.label && (
          <View style={[styles.dealLabel, { backgroundColor: accentDim }]}>
            <Text style={[styles.dealLabelText, { color: accent }]}>{discount.label}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Trust-chip derivation ───────────────────────────────────────────────────
// Phase Salon-3 — mirrors the brand-level chips on BrandStoreScreen but
// keyed by category since ProductCard doesn't have access to the full
// template object (the feed/deals/category endpoints emit category, not
// template). Trade-off: keeps the card lightweight + no backend change at
// the cost of mobile knowing which categories support which trust signals.
// Acceptable: only 3 active categories today.

/**
 * Tier-1 helper — derive the offer badge label + kind from a `discount` prop.
 * Handles the 5 brand-wizard offer types plus the legacy `percentage` / `flat`
 * shapes. Returns { label, kind } where kind is 'pct' | 'flat' | 'volume' |
 * 'bogo' | 'bundle' | 'free_gift' | 'none'.
 */
function computeOfferBadge(discount) {
  if (!discount) return { label: null, kind: 'none' };
  const type = String(discount.type || '').toLowerCase();
  // Legacy/simple shapes — passed by older feed surfaces
  if (type === 'percentage' && discount.value) {
    return { label: `${discount.value}% OFF`, kind: 'pct', value: discount.value };
  }
  if (type === 'flat' && discount.value) {
    return { label: `₹${discount.value} OFF`, kind: 'flat', value: discount.value };
  }
  // New wizard shapes (raw offer_type from campaign_influencers)
  if (type === 'discount') {
    const subType = discount.sub_type || (discount.value > 100 ? 'flat' : 'pct');
    if (subType === 'flat') return { label: `₹${discount.value} OFF`, kind: 'flat', value: discount.value };
    return { label: `${discount.value}% OFF`, kind: 'pct', value: discount.value };
  }
  if (type === 'volume' || type === 'volume discount' || type === 'volume_discount') {
    return { label: 'VOLUME DEAL', kind: 'volume' };
  }
  if (type === 'bogo') {
    return { label: 'BOGO', kind: 'bogo' };
  }
  if (type === 'bundle') {
    return { label: 'BUNDLE', kind: 'bundle' };
  }
  if (type === 'free gift' || type === 'free_gift' || type === 'gift') {
    return { label: '+ FREE GIFT', kind: 'free_gift' };
  }
  // Numeric-only fallback (older callers pass raw value as discount.value)
  if (typeof discount.value === 'number' && discount.value > 0) {
    return { label: `${discount.value}% OFF`, kind: 'pct', value: discount.value };
  }
  return { label: null, kind: 'none' };
}

const TRUST_CHIPS_BY_CATEGORY = {
  salon:       [{ icon: '💸', text: 'Pay at salon' }, { icon: '✕', text: 'Free cancel' }],
  restaurant:  [{ icon: '💸', text: 'Pay at venue' }],
  car_rental:  [{ icon: '✕', text: 'Free cancel' }, { icon: '💸', text: 'Pay at pickup' }],
  // Fashion-1 — applies to the unified fashion category and the legacy aliases
  fashion:        [{ icon: '↩', text: '7-day returns' }, { icon: '💸', text: 'Pay at store' }],
  fashion_walkin: [{ icon: '↩', text: '7-day returns' }, { icon: '💸', text: 'Pay at store' }],
  fashion_online: [{ icon: '↩', text: '7-day returns' }, { icon: '💸', text: 'COD available' }],
};

function renderTrustChips(category, accent) {
  const chips = TRUST_CHIPS_BY_CATEGORY[category];
  if (!chips) return null;
  return (
    <View style={styles.trustRow}>
      {chips.map((c, i) => (
        <View key={i} style={[styles.trustChip, { borderColor: `${accent}55` }]}>
          <Text style={styles.trustChipIcon}>{c.icon}</Text>
          <Text style={[styles.trustChipText, { color: accent }]}>{c.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: darkColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkColors.border,
    overflow: 'hidden',
  },
  hero: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroIcon: {
    fontSize: 48,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  heartText: {
    fontSize: 14,
    opacity: 0.5,
    color: darkColors.text,
  },
  infOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 2,
    paddingLeft: 2,
    paddingRight: 8,
    borderRadius: 20,
  },
  infAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infAvatarText: {
    fontSize: 6,
    fontWeight: '700',
    color: '#fff',
  },
  infName: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.8)',
  },
  body: {
    padding: 10,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: darkColors.text,
    lineHeight: 16,
  },
  creatorNote: {
    fontSize: 10,
    fontStyle: 'italic',
    color: darkColors.textSecondary,
    marginTop: 3,
    lineHeight: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  brandLine: {
    fontSize: 9,
    color: darkColors.textMuted,
    flexShrink: 1,
  },
  brandVerified: {
    fontSize: 9,
    fontWeight: '800',
    color: '#22C55E',                          // green-500, same as BrandStoreScreen verified badge
  },
  brandChevron: {
    fontSize: 12,
    color: darkColors.textMuted,
    fontWeight: '300',
    marginLeft: 'auto',
  },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  trustChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 6, borderWidth: 0.5,
  },
  trustChipIcon: { fontSize: 8 },
  trustChipText: { fontSize: 8, fontWeight: '700' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  offerPrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  mrp: {
    fontSize: 10,
    color: darkColors.textMuted,
    textDecorationLine: 'line-through',
  },
  dealLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 4,
  },
  dealLabelText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
