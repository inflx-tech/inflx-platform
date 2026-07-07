import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts, fmtMoney, getBusinessAccentLight } from '../../theme/tokens';
import RankBadge from './RankBadge';
import { fmtDistance } from './palette';

/**
 * ShelfProductCard — the product rail card from the comprehensive mockups
 * (`.card` w/ 104px hero): image hero (heart + optional offer badge + rank),
 * product name, brand line, price (struck MRP when discounted). Image falls back
 * to the category emoji over a pale tint. Discount badge/price math only when a
 * real discount_value is present (listing-mode products show plain price — honest).
 *
 * Props: product { name, price, image_url }, brand { name, category },
 *        discountValue?, rank?, saved?, onPress, onHeart.
 */
export default function ShelfProductCard({ product, brand, discountValue, rank, saved, distanceKm, onPress, onHeart, onAdd }) {
  if (!product) return null;
  const cfg = getBusinessAccentLight(brand?.category);
  const dist = fmtDistance(distanceKm);
  const mrp = Number(product.price) || 0;
  const pct = Number(discountValue) > 0 ? Number(discountValue) : 0;
  const price = pct > 0 ? Math.floor(mrp * (1 - pct / 100)) : mrp;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.hero, { backgroundColor: cfg.pale }]}>
        {product.image_url
          ? <Image source={{ uri: product.image_url }} style={styles.heroImg} resizeMode="cover" />
          : <Text style={styles.heroIcon}>{cfg.icon}</Text>}
        {rank ? <View style={styles.rank}><RankBadge rank={rank} /></View> : null}
        <TouchableOpacity style={styles.heart} onPress={onHeart} hitSlop={8}>
          <Text style={[styles.heartTxt, saved && { color: C.offer }]}>{saved ? '♥' : '♡'}</Text>
        </TouchableOpacity>
        {pct > 0 && (
          <View style={styles.badge}><Text style={styles.badgeTxt}>{pct}% OFF</Text></View>
        )}
        {onAdd ? (
          <TouchableOpacity style={styles.add} onPress={onAdd} hitSlop={8} activeOpacity={0.8}>
            <Text style={styles.addTxt}>＋</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        {brand?.name ? (
          <Text style={styles.brand} numberOfLines={1}>
            {brand.name}{dist ? ` · ${dist}` : ''}
          </Text>
        ) : (dist ? <Text style={styles.brand} numberOfLines={1}>{dist}</Text> : null)}
        {mrp > 0 && (
          <View style={styles.priceRow}>
            <Text style={styles.price}>{fmtMoney(price)}</Text>
            {pct > 0 && <Text style={styles.mrp}>{fmtMoney(mrp)}</Text>}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 154, borderRadius: 18, overflow: 'hidden',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, elevation: 2,
  },
  // Portrait 3:4 image box (was a 154×104 landscape box that sliced tall apparel
  // photos in half). Brands shoot products portrait (2:3–3:4), so a 3:4 box +
  // cover fills with negligible crop instead of cutting the garment top/bottom.
  hero: { width: '100%', aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  heroIcon: { fontSize: 42 },
  rank: { position: 'absolute', top: 9, left: 9 },
  heart: {
    position: 'absolute', top: 9, right: 9, width: 27, height: 27, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center',
  },
  heartTxt: { fontSize: 13, color: '#C34' },
  badge: {
    position: 'absolute', left: 9, bottom: 9,
    backgroundColor: C.offer, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3,
  },
  badgeTxt: { fontSize: 9.5, fontWeight: '800', color: '#fff', fontFamily: fonts.monoBold },
  add: {
    position: 'absolute', right: 9, bottom: 9, width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 3,
  },
  addTxt: { fontSize: 19, fontWeight: '800', color: C.offer, marginTop: -2 },
  body: { padding: 11 },
  name: { fontSize: 12, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  brand: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.monoMedium },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  price: { fontSize: 13, fontWeight: '900', color: C.ink, fontFamily: fonts.monoBold },
  mrp: { fontSize: 10, color: C.muted, textDecorationLine: 'line-through', fontFamily: fonts.monoMedium },
});
