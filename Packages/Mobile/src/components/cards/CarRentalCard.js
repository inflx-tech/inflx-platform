import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { darkColors, fmtRupees } from '../../theme/tokens';

/**
 * CarRentalCard — vehicle card for follower app, matching the HTML mockup.
 *
 * Shows: vehicle SVG illustration, influencer deal badge, vehicle name + year + variant,
 * spec tags (seats, fuel, sunroof, transmission), location + distance,
 * price/day with MRP strikethrough, Pre-book + At Garage CTAs.
 */

export default function CarRentalCard({
  vehicle,       // { name, year, variant, specs: { seats, fuel_type, transmission, sunroof, features }, location, distance, rating, trips }
  pricing,       // { day_rate, original_rate, per_unit }
  discount,      // { value, label, influencer_name, influencer_initial, influencer_color }
  onPress,
  onPressPrebook,
  onPressAtGarage,
}) {
  const specs = vehicle?.specs || {};
  const tags = [];
  if (specs.seats) tags.push({ text: `${specs.seats} seats`, highlight: specs.seats >= 7 });
  if (specs.fuel_type) tags.push({ text: specs.fuel_type.split(' / ')[0] });
  if (specs.sunroof) tags.push({ text: 'Sunroof', highlight: true });
  if (specs.transmission) tags.push({ text: specs.transmission.split(' / ')[0] });
  if (specs.features?.length) {
    specs.features.slice(0, 2).forEach(f => tags.push({ text: f }));
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Hero image area */}
      <View style={[styles.hero, { backgroundColor: '#0A1D3E' }]}>
        {/* Vehicle SVG placeholder */}
        <Text style={styles.heroEmoji}>🚗</Text>

        {/* Discount badge */}
        {discount && (
          <View style={[styles.discountBadge, { backgroundColor: discount.color || '#EF4444' }]}>
            <Text style={styles.discountText}>{discount.label}</Text>
          </View>
        )}

        {/* Heart */}
        <View style={styles.heartBtn}>
          <Text style={{ fontSize: 13, color: '#fff' }}>♡</Text>
        </View>

        {/* Influencer strip */}
        {discount?.influencer_name && (
          <View style={styles.infStrip}>
            <View style={[styles.infAvatar, { backgroundColor: discount.influencer_color || '#F59E0B' }]}>
              <Text style={styles.infInitial}>{discount.influencer_initial || discount.influencer_name[0]}</Text>
            </View>
            <Text style={styles.infText} numberOfLines={1}>{discount.influencer_name} recommends</Text>
            <Text style={styles.infDiscount}>-{discount.value}%</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Name row */}
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleName}>{vehicle?.name}</Text>
            <Text style={styles.vehicleSub}>{vehicle?.year} · {vehicle?.variant}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={styles.availBadge}>
              <View style={styles.availDot} />
              <Text style={styles.availText}>Available</Text>
            </View>
            {vehicle?.rating && (
              <Text style={styles.ratingText}>{vehicle.rating} ★ · {vehicle.trips} trips</Text>
            )}
          </View>
        </View>

        {/* Spec tags */}
        <View style={styles.tagsRow}>
          {tags.map((tag, i) => (
            <View key={i} style={[styles.tag, tag.highlight && styles.tagHighlight]}>
              <Text style={[styles.tagText, tag.highlight && styles.tagTextHighlight]}>{tag.text}</Text>
            </View>
          ))}
        </View>

        {/* Location */}
        <View style={styles.locRow}>
          <Text style={styles.locIcon}>📍</Text>
          <Text style={styles.locText}>{vehicle?.location} · {vehicle?.distance}</Text>
        </View>

        {/* Price + CTAs */}
        <View style={styles.priceRow}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={styles.price}>{fmtRupees(pricing?.day_rate)}</Text>
              {pricing?.original_rate && pricing.original_rate > pricing.day_rate && (
                <Text style={styles.originalPrice}>{fmtRupees(pricing.original_rate)}</Text>
              )}
            </View>
            <Text style={styles.perUnit}>{pricing?.per_unit || 'per day (24 hrs)'}</Text>
          </View>
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.ctaPrimary} onPress={onPressPrebook}>
              <Text style={styles.ctaPrimaryText}>Book Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} onPress={onPressAtGarage}>
              <Text style={styles.ctaSecondaryText}>At Garage</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 13,
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0D1D2E',
  },
  hero: {
    height: 150, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  heroEmoji: { fontSize: 64, opacity: 0.6 },
  discountBadge: {
    position: 'absolute', top: 9, left: 9,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  discountText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  heartBtn: {
    position: 'absolute', top: 9, right: 9,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  infStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  infAvatar: {
    width: 17, height: 17, borderRadius: 8.5,
    alignItems: 'center', justifyContent: 'center',
  },
  infInitial: { fontSize: 7, fontWeight: '800', color: '#000' },
  infText: { flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.82)' },
  infDiscount: { fontSize: 10, color: '#F59E0B', fontWeight: '700' },
  body: { padding: 11 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  vehicleName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  vehicleSub: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  availDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981' },
  availText: { fontSize: 10, fontWeight: '600', color: '#10B981' },
  ratingText: { fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 7 },
  tag: {
    backgroundColor: '#142438', borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  tagHighlight: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  tagText: { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  tagTextHighlight: { color: '#F59E0B' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 9 },
  locIcon: { fontSize: 9 },
  locText: { fontSize: 10, color: 'rgba(255,255,255,0.38)' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 17, fontWeight: '800', color: '#fff' },
  originalPrice: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textDecorationLine: 'line-through' },
  perUnit: { fontSize: 9, color: 'rgba(255,255,255,0.38)', marginTop: 1 },
  ctaRow: { flexDirection: 'row', gap: 7 },
  ctaPrimary: {
    backgroundColor: '#F59E0B', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10,
  },
  ctaPrimaryText: { fontSize: 11, fontWeight: '800', color: '#000' },
  ctaSecondary: {
    backgroundColor: '#142438', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  ctaSecondaryText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
});
