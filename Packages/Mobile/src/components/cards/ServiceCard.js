import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { darkColors, fmtMoney, getBusinessAccent } from '../../theme/tokens';

/**
 * ServiceCard — for service businesses (salon, gym, travel, etc.)
 *
 * Same as ProductCard but hero shows emoji/icon instead of product photo.
 * Price unit differs (e.g., "/month", "/person", "onwards").
 */

export default function ServiceCard({
  service,       // { name, price (paise), description }
  businessType,  // e.g. 'Salon', 'Gym'
  location,      // e.g. 'MG Road'
  ctaLabel,      // e.g. 'Book Now'
  priceUnit,     // e.g. 'haircut onwards', '/month', '/person'
  discount,      // { value, type }
  influencer,    // { name, avatar_initial }
  accentColor,
  onPress,
}) {
  const accent = accentColor || darkColors.pink;
  const icon = getBusinessAccent(businessType?.toLowerCase()?.replace(/\s/g, '_')).icon || '✨';
  const accentDim = getBusinessAccent(businessType?.toLowerCase()?.replace(/\s/g, '_')).dim;

  const mrp = service?.price || 0;
  const discountPct = discount?.type === 'percentage' ? discount.value : 0;
  const offerPrice = discountPct > 0 ? Math.floor(mrp * (1 - discountPct / 100)) : mrp;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: accentDim || 'rgba(236,72,153,0.1)' }]}>
        <Text style={styles.heroIcon}>{icon}</Text>

        {discount?.value && (
          <View style={[styles.badge, { backgroundColor: accentDim }]}>
            <Text style={[styles.badgeText, { color: accent }]}>
              {discount.type === 'flat' ? `₹${discount.value} OFF` : `${discount.value}% OFF`}
            </Text>
          </View>
        )}

        {influencer && (
          <View style={styles.infOverlay}>
            <View style={[styles.infAvatar, { backgroundColor: accent }]}>
              <Text style={styles.infAvatarText}>{influencer.avatar_initial || influencer.name?.[0]}</Text>
            </View>
            <Text style={styles.infName}>{influencer.name}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.serviceName} numberOfLines={2}>{service?.name}</Text>
        <Text style={styles.meta}>{businessType} · {location} · {ctaLabel || 'Book Now'}</Text>

        <View style={styles.priceRow}>
          <Text style={[styles.offerPrice, { color: accent }]}>{fmtMoney(offerPrice)}</Text>
          {discountPct > 0 && <Text style={styles.mrp}>{fmtMoney(mrp)}</Text>}
          {priceUnit && <Text style={styles.priceUnit}>{priceUnit}</Text>}
        </View>
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
    minWidth: 160,
  },
  hero: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroIcon: {
    fontSize: 38,
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
  serviceName: {
    fontSize: 12,
    fontWeight: '600',
    color: darkColors.text,
    lineHeight: 16,
  },
  meta: {
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
  priceUnit: {
    fontSize: 9,
    color: darkColors.textSecondary,
  },
});
