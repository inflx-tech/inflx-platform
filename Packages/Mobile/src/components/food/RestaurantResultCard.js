/**
 * RestaurantResultCard — Food World 3C-1.
 *
 * The restaurant card shown when a craving (dish-group) is active: name ·
 * ★rating (count) · distance · distance-ETA · free-delivery · matching dish
 * varieties · from-price · View menu. Shared by the in-page craving filter on
 * the food home and the standalone DishGroupResultScreen.
 *
 * Props: restaurant (the /dish-groups/:id/restaurants item), onOpen.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';

export default function RestaurantResultCard({ restaurant: r, onOpen }) {
  if (!r) return null;
  const eta = (r.eta_min_mins != null && r.eta_max_mins != null) ? `${r.eta_min_mins}–${r.eta_max_mins} mins` : null;
  return (
    <Pressable style={styles.card} onPress={() => onOpen?.(r)}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🍽️</Text>
        {r.free_delivery && (
          <View style={styles.fdBadge}><Text style={styles.fdText}>FREE DELIVERY</Text></View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{r.business_name}</Text>
        <View style={styles.metaRow}>
          {r.avg_rating != null && (
            <View style={styles.star}><Text style={styles.starTxt}>★ {Number(r.avg_rating).toFixed(1)}</Text></View>
          )}
          {r.review_count ? <Text style={styles.meta}>({r.review_count})</Text> : null}
          {r.distance_km != null && <Text style={styles.meta}>· {r.distance_km} km</Text>}
          {eta && <Text style={styles.meta}>· {eta}</Text>}
        </View>
        {Array.isArray(r.varieties) && r.varieties.length > 0 && (
          <View style={styles.vchips}>
            {r.varieties.slice(0, 3).map((v, i) => (
              <View key={i} style={styles.vchip}><Text style={styles.vchipTxt} numberOfLines={1}>{v}</Text></View>
            ))}
            {r.varieties.length > 3 && <Text style={styles.vmore}>+{r.varieties.length - 3}</Text>}
          </View>
        )}
        <View style={styles.fromRow}>
          <Text style={styles.fromPrice}>
            {r.from_price != null ? <><Text style={styles.fromLbl}>from </Text>₹{Math.round(r.from_price)}</> : ' '}
          </Text>
          <View style={styles.goBtn}><Text style={styles.goTxt}>View menu →</Text></View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 12, borderWidth: 1, borderColor: T.line, borderRadius: 14, overflow: 'hidden', backgroundColor: T.card },
  hero: { height: 96, backgroundColor: T.yellowTint, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 38 },
  fdBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: T.yellow, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  fdText: { fontFamily: fonts.monoBold, fontSize: 10, color: T.yellowInk },
  body: { padding: 12 },
  name: { fontFamily: fonts.displayBold, fontSize: 15, color: T.ink, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  star: { backgroundColor: T.veg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  starTxt: { fontFamily: fonts.monoBold, fontSize: 11, color: '#fff' },
  meta: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.muted },
  vchips: { flexDirection: 'row', gap: 6, marginTop: 9, alignItems: 'center', flexWrap: 'wrap' },
  vchip: { backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.line, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  vchipTxt: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink, maxWidth: 130 },
  vmore: { fontFamily: fonts.sansBold, fontSize: 11, color: T.yellowDeep },
  fromRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fromPrice: { fontFamily: fonts.displayBold, fontSize: 14, color: T.ink },
  fromLbl: { fontFamily: fonts.sansMedium, fontSize: 11, color: T.muted },
  goBtn: { backgroundColor: T.yellow, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 9 },
  goTxt: { fontFamily: fonts.sansBold, fontSize: 12, color: T.yellowInk },
});
