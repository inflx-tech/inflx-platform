import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts, getBusinessAccentLight } from '../../theme/tokens';
import { fmtDistance } from './palette';

/**
 * ShelfBrandListRow — full-width brand row for the Category "All Businesses" list
 * (mockup `.listrow`): square thumb (image or category emoji over a pale tint) +
 * name + cuisine/category line + city. Tap → BrandStore.
 *
 * BACKEND-FIRST: the mockup row shows "★4.5 (1.2K) · 1.2 km · 20% OFF · @creator
 * recommends" — the brand item shape (mapBrandItem) carries none of rating /
 * distance / review-count / offer / creator, so this row OMITS them rather than
 * fabricate. They return when reviews/geo/offers are wired (later data phases).
 *
 * Props: brand { id, name, category, city, image_url?, cuisines? }, onPress.
 */
export default function ShelfBrandListRow({ brand, distanceKm, onPress }) {
  if (!brand) return null;
  const cfg = getBusinessAccentLight(brand.category);
  const meta = Array.isArray(brand.cuisines) && brand.cuisines.length
    ? brand.cuisines.slice(0, 3).join(' · ')
    : (brand.category ? String(brand.category).replace(/_/g, ' ') : '');
  const dist = fmtDistance(distanceKm != null ? distanceKm : brand.distance_km);

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.thumb, { backgroundColor: cfg.pale }]}>
        {brand.image_url
          ? <Image source={{ uri: brand.image_url }} style={styles.thumbImg} resizeMode="cover" />
          : <Text style={styles.thumbEmoji}>{cfg.icon}</Text>}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{brand.name}</Text>
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
        <Text style={styles.city} numberOfLines={1}>
          {dist ? `📍 ${dist}` : (brand.city || '')}
        </Text>
      </View>
      <Text style={styles.chev}>{'›'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16,
    padding: 10, marginHorizontal: 16, marginBottom: 11,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, elevation: 1,
  },
  thumb: {
    width: 84, height: 84, borderRadius: 13, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbEmoji: { fontSize: 34 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  meta: { fontSize: 10.5, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.monoMedium, textTransform: 'capitalize' },
  city: { fontSize: 10.5, color: C.muted, fontWeight: '600', marginTop: 4, fontFamily: fonts.monoMedium },
  chev: { fontSize: 20, color: C.muted, fontWeight: '300' },
});
