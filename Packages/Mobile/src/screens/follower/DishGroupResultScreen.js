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
import RestaurantResultCard from '../../components/food/RestaurantResultCard';

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
            <RestaurantResultCard key={r.brand_id} restaurant={r} onOpen={openStore} />
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
});
