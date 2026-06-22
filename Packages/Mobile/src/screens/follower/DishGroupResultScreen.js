/**
 * DishGroupResultScreen — Food World 3C-1.
 *
 * Reached by tapping a dish-group tile on the food home. Lists nearby
 * restaurants serving any dish in the group (members OR name keyword), ranked
 * distance → popularity, from GET /follower/dish-groups/:id/restaurants.
 *
 * Each card = restaurant name · ★rating (count) · distance · distance-derived
 * ETA · free-delivery badge · matching dish varieties · from-price · View menu
 * (→ the existing BrandStore storefront; its reskin is 3C-2).
 *
 * Route params: { groupId, groupName }.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';

export default function DishGroupResultScreen({ route, navigation }) {
  const { groupId, groupName } = route.params || {};
  const { location } = useAppLocation();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await followerApi.getDishGroupRestaurants(groupId, {
        lat: location?.latitude, lng: location?.longitude,
      });
      setRestaurants((r?.data || r)?.restaurants || []);
    } catch {
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, location?.latitude, location?.longitude]);

  useEffect(() => { load(); }, [load]);

  function openStore(rest) {
    navigation.navigate('BrandStore', { brandId: rest.brand_id, brandName: rest.business_name });
  }

  const etaText = (r) =>
    (r.eta_min_mins != null && r.eta_max_mins != null) ? `${r.eta_min_mins}–${r.eta_max_mins} mins` : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.ib} hitSlop={8}>
          <Text style={styles.ibTxt}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1} numberOfLines={1}>{groupName || 'Restaurants'}</Text>
          <Text style={styles.h2}>
            {loading ? 'Searching near you…'
              : restaurants.length ? `${restaurants.length} place${restaurants.length !== 1 ? 's' : ''} near you serving it`
              : 'Nothing nearby'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={T.ink} style={{ marginTop: 40 }} />
      ) : restaurants.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🍱</Text>
          <Text style={styles.emptyTitle}>No one nearby serves this yet</Text>
          <Text style={styles.emptyBody}>Try a wider area or another craving.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          {restaurants.map((r) => (
            <Pressable key={r.brand_id} style={styles.card} onPress={() => openStore(r)}>
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
                  {etaText(r) && <Text style={styles.meta}>· {etaText(r)}</Text>}
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
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: T.card },
  ib: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  ibTxt: { fontSize: 15, color: T.ink },
  h1: { fontFamily: fonts.displayBold, fontSize: 17, color: T.ink, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.muted, marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: T.ink },
  emptyBody: { fontFamily: fonts.sansMedium, fontSize: 12, color: T.muted, marginTop: 5, textAlign: 'center' },

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
