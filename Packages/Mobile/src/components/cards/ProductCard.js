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
  product,       // { name, price (paise), image_url, description }
  brand,         // { name, category, locality }
  discount,      // { type, value, label } e.g. { type: 'percentage', value: 25, label: "Meena's Saree Deal" }
  influencer,    // { name, avatar_initial, gradient } or null
  accentColor,   // override accent or derived from brand.category
  onPress,
  onPressHeart,
  isSaved,
}) {
  const accent = accentColor || getBusinessAccent(brand?.category).accent;
  const accentDim = getBusinessAccent(brand?.category).dim;
  const icon = getBusinessAccent(brand?.category).icon;

  const mrp = product?.price || 0;
  const discountPct = discount?.type === 'percentage' ? discount.value : 0;
  const offerPrice = discountPct > 0 ? Math.floor(mrp * (1 - discountPct / 100)) : mrp;
  const discountLabel = discount?.value
    ? (discount.type === 'flat' ? `\u20B9${fmtMoney(discount.value).replace('\u20B9', '')} OFF` : `${discount.value}% OFF`)
    : null;

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
        <Text style={styles.brandLine}>{brand?.name} · {brand?.locality}</Text>

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
  brandLine: {
    fontSize: 9,
    color: darkColors.textMuted,
    marginTop: 2,
  },
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
