import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { brandPalette as P, fmtMoney, getBusinessAccentLight, fonts } from '../../theme/tokens';

/**
 * ServiceCard — for service businesses (salon, gym, travel, car-rental, etc.)
 *
 * Flow 38 (F0) restyle (2026-05-27): light brandPalette. Same structure as
 * ProductCard but the hero shows a category emoji over a per-business pale
 * tint. ink/yellow discount badge + ink/yellow creator avatar + mono price +
 * ink/yellow Book CTA.
 */

export default function ServiceCard({
  service,       // { name, price (rupees), description }
  businessType,  // e.g. 'salon', 'car_rental'
  location,      // e.g. 'MG Road'
  ctaLabel,      // e.g. 'Book Now'
  priceUnit,     // e.g. '/day', 'onwards'
  discount,      // { value, type }
  influencer,    // { name, avatar_initial }
  accentColor,
  onPress,
}) {
  const key = businessType?.toLowerCase()?.replace(/\s/g, '_');
  const accentCfg = getBusinessAccentLight(key);
  const icon = accentCfg.icon || '✨';
  const heroTint = accentCfg.pale;

  const mrp = service?.price || 0;
  const discountPct = discount?.type === 'percentage' ? discount.value : 0;
  const offerPrice = discountPct > 0 ? Math.floor(mrp * (1 - discountPct / 100)) : mrp;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: heroTint }]}>
        <Text style={styles.heroIcon}>{icon}</Text>

        {discount?.value && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {discount.type === 'flat' ? `₹${discount.value} OFF` : `${discount.value}% OFF`}
            </Text>
          </View>
        )}

        {influencer && (
          <View style={styles.infOverlay}>
            <View style={styles.infAvatar}>
              <Text style={styles.infAvatarText}>{influencer.avatar_initial || influencer.name?.[0]}</Text>
            </View>
            <Text style={styles.infName}>{influencer.name}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.serviceName} numberOfLines={2}>{service?.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {(businessType || '').toUpperCase()} · {(location || '').toUpperCase()}
        </Text>

        <View style={styles.foot}>
          <View style={styles.priceRow}>
            <Text style={styles.offerPrice}>{fmtMoney(offerPrice)}</Text>
            {priceUnit && <Text style={styles.priceUnit}>{priceUnit}</Text>}
          </View>
          <View style={styles.bookBtn}>
            <Text style={styles.bookText}>{ctaLabel || 'Book'}</Text>
          </View>
        </View>
        {discountPct > 0 && <Text style={styles.mrp}>{fmtMoney(mrp)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: P.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
    overflow: 'hidden',
    minWidth: 172,
  },
  hero: { height: 110, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroIcon: { fontSize: 36 },
  badge: {
    position: 'absolute', top: 7, left: 7,
    backgroundColor: P.ink, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
  },
  badgeText: { fontSize: 8.5, fontWeight: '800', color: P.yellow, fontFamily: fonts.monoBold },
  infOverlay: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(10,10,10,0.82)',
    paddingVertical: 2, paddingLeft: 2, paddingRight: 8, borderRadius: 999,
  },
  infAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: P.yellow, alignItems: 'center', justifyContent: 'center' },
  infAvatarText: { fontSize: 7, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  infName: { fontSize: 8, color: '#fff', fontWeight: '700', fontFamily: fonts.monoMedium },
  body: { padding: 10 },
  serviceName: { fontSize: 12, fontWeight: '800', color: P.ink, lineHeight: 16, fontFamily: fonts.displayBold },
  meta: { fontSize: 8.5, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  offerPrice: { fontSize: 13, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  priceUnit: { fontSize: 8, color: P.muted2, fontWeight: '700', fontFamily: fonts.monoMedium },
  mrp: { fontSize: 9.5, color: P.muted3, textDecorationLine: 'line-through', marginTop: 2, fontFamily: fonts.monoMedium },
  bookBtn: { backgroundColor: P.ink, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8 },
  bookText: { fontSize: 9.5, fontWeight: '900', color: P.yellow, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
});
