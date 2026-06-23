/**
 * RestaurantSection — Food World 3C-1, the "Type B" restaurant-list card.
 *
 * One card per restaurant: header (name · ★rating · ETA · cuisine · Free
 * Delivery · → storefront) + a nested horizontal carousel of that restaurant's
 * featured dishes (FoodDishCard, showMeta=false — rating/ETA live in the header).
 *
 * Fed by the `restaurants_with_featured` rule (shelf_type 'restaurant_list').
 * Props: restaurant { id, name, rating, review_count, distance_km, cuisines,
 *        free_delivery, eta_min, eta_max, products[] }, onOpenStore, onOpenDish.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';
import FoodDishCard from './FoodDishCard';

export default function RestaurantSection({ restaurant: r, onOpenStore, onOpenDish }) {
  if (!r || !Array.isArray(r.products) || r.products.length === 0) return null;
  const eta = (r.eta_min != null && r.eta_max != null) ? `${r.eta_min}–${r.eta_max} mins` : null;
  const cuisine = Array.isArray(r.cuisines) && r.cuisines.length ? r.cuisines.slice(0, 2).join(' · ') : null;

  return (
    <View style={styles.card}>
      <Pressable style={styles.head} onPress={() => onOpenStore?.(r)}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
          <Text style={styles.arrow}>→</Text>
        </View>
        <View style={styles.metaRow}>
          {r.rating != null && (
            <View style={styles.star}><Text style={styles.starTxt}>★ {Number(r.rating).toFixed(1)}</Text></View>
          )}
          {eta ? <Text style={styles.meta}>· {eta}</Text> : null}
          {cuisine ? <Text style={styles.meta}>· {cuisine}</Text> : null}
        </View>
        {r.free_delivery && (
          <View style={styles.fd}>
            <View style={styles.fdPc}><Text style={styles.fdPcTxt}>%</Text></View>
            <Text style={styles.fdTxt}>Free Delivery</Text>
          </View>
        )}
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nest}>
        {r.products.map((p) => (
          <FoodDishCard
            key={p.id}
            product={p}
            brand={{ name: r.name }}
            showMeta={false}
            onPress={() => onOpenDish?.(p, r, 'detail')}
            onAdd={() => onOpenDish?.(p, r, 'add')}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingVertical: 14, backgroundColor: T.card },
  head: { paddingHorizontal: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontFamily: fonts.displayBold, fontSize: 17, color: T.ink, letterSpacing: -0.3 },
  arrow: { fontSize: 18, color: T.muted, marginLeft: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  star: { backgroundColor: T.veg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  starTxt: { fontFamily: fonts.monoBold, fontSize: 11, color: '#fff' },
  meta: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.muted },
  fd: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  fdPc: { width: 14, height: 14, borderRadius: 7, backgroundColor: T.veg, alignItems: 'center', justifyContent: 'center' },
  fdPcTxt: { fontSize: 9, color: '#fff', fontFamily: fonts.monoBold },
  fdTxt: { fontFamily: fonts.sansBold, fontSize: 11, color: T.veg },
  nest: { paddingHorizontal: 14, paddingTop: 14 },
});
