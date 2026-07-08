/**
 * FoodDishCard — Food World 3C-1.
 *
 * The Toing-style dish card used by food product shelves (Type A "Meals under
 * ₹99") and the nested carousel inside Type B restaurant cards. Kept SEPARATE
 * from the shared ShelfProductCard so other verticals are untouched.
 *
 *   image hero (Popular/owner badge top-left, pink ＋ bottom-right)
 *   veg dot + dish name
 *   "by <restaurant>" · ★rating · ETA   (Type A; hidden via showMeta=false for
 *                                         the Type B nested rail where the
 *                                         restaurant header already carries them)
 *   price (+ struck MRP when mrp > price)
 *
 * In 3C-1 both the card and the ＋ route to the product screen (onPress / onAdd);
 * the customisation popup lands in 3C-2.
 */

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';
import { vegKind } from '../../utils/veg';

// kind: 'veg' | 'nonveg' | 'unknown' — unknown ('na') renders neutral grey,
// never a false red non-veg mark.
function VegDot({ kind }) {
  if (kind === 'unknown') {
    return <View style={[styles.veg, styles.vegNA]}><View style={[styles.vegInner, styles.vegInnerNA]} /></View>;
  }
  const nv = kind === 'nonveg';
  return (
    <View style={[styles.veg, nv && styles.vegNV]}>
      <View style={[styles.vegInner, nv && styles.vegInnerNV]} />
    </View>
  );
}

export default function FoodDishCard({ product, brand, showMeta = true, onPress, onAdd }) {
  if (!product) return null;
  const price = Number(product.price) || 0;
  // MRP retired (offer-mrp-retirement) — the struck "was" price now comes from a
  // live store discount-offer (offer_price), not a per-dish MRP.
  const offerPrice = product.offer_price != null ? Number(product.offer_price) : null;
  const struck = offerPrice != null && offerPrice < price;
  const shownPrice = struck ? offerPrice : price;
  const veg = vegKind(product.veg_flag);
  const rating = product.rating != null ? Number(product.rating) : null;
  const eta = (product.eta_min != null && product.eta_max != null)
    ? `${product.eta_min}–${product.eta_max} mins` : null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.hero}>
        {product.image_url
          ? <Image source={{ uri: product.image_url }} style={styles.heroImg} resizeMode="cover" />
          : <Text style={styles.heroEmoji}>🍽️</Text>}
        {product.badge ? (
          <View style={styles.badge}><Text style={styles.badgeTxt}>{product.badge}</Text></View>
        ) : null}
        <Pressable style={styles.plus} onPress={onAdd || onPress} hitSlop={8}>
          <Text style={styles.plusTxt}>+</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <VegDot kind={veg} />
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        </View>
        {showMeta && brand?.name ? <Text style={styles.by} numberOfLines={1}>by {brand.name}</Text> : null}
        {showMeta && (rating != null || eta) ? (
          <Text style={styles.meta} numberOfLines={1}>
            {rating != null ? <Text style={styles.star}>★ {rating.toFixed(1)}</Text> : null}
            {rating != null && eta ? ' · ' : ''}{eta || ''}
          </Text>
        ) : null}
        <Text style={styles.price}>
          ₹{Math.round(shownPrice)}{struck ? <Text style={styles.mrp}>  ₹{Math.round(price)}</Text> : null}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 158, marginRight: 13 },
  hero: { width: 158, height: 130, borderRadius: 14, backgroundColor: T.pinkTint, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'visible' },
  heroImg: { width: '100%', height: '100%', borderRadius: 14 },
  heroEmoji: { fontSize: 40 },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 },
  badgeTxt: { fontFamily: fonts.monoBold, fontSize: 10, color: T.veg },
  plus: { position: 'absolute', bottom: -14, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1.5, borderColor: T.pink, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  plusTxt: { fontSize: 22, color: T.pink, fontWeight: '600', marginTop: -2 },
  body: { paddingTop: 18, paddingHorizontal: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  veg: { width: 13, height: 13, borderWidth: 1.5, borderColor: T.veg, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  vegNV: { borderColor: T.nonVeg },
  vegNA: { borderColor: '#9CA3AF' },
  vegInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.veg },
  vegInnerNV: { backgroundColor: T.nonVeg },
  vegInnerNA: { backgroundColor: '#9CA3AF' },
  name: { flex: 1, fontFamily: fonts.displayBold, fontSize: 14, color: T.ink, letterSpacing: -0.2 },
  by: { fontFamily: fonts.sansMedium, fontSize: 11, color: T.muted, marginTop: 2 },
  meta: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.muted, marginTop: 3 },
  star: { color: T.veg, fontFamily: fonts.monoBold },
  price: { fontFamily: fonts.displayBold, fontSize: 14, color: T.ink, marginTop: 5 },
  mrp: { fontFamily: fonts.sansMedium, fontSize: 12, color: T.hint, textDecorationLine: 'line-through' },
});
