import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

// Category-appropriate emoji fallback when a product has no image_url. The
// previous hardcoded 🚗 made restaurant items look like cars and confused
// creators previewing their store.
const CATEGORY_EMOJI = {
  restaurant:     '🍽️',
  salon:          '💇',
  car_rental:     '🚗',
  bike_rental:    '🏍️',
  fashion:        '👗',
  fashion_walkin: '👗',
  fashion_online: '👕',
  bakery:         '🧁',
  florist:        '💐',
};

/**
 * MyStoreScreen — influencer previews their store as followers see it.
 * Shows all published products with influencer notes across all campaigns.
 *
 * Flow 32 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/
 * JetBrains Mono fonts + yellow avatar tile + successPale offer-discount
 * badges + yellowPale note boxes. CATEGORY_EMOJI fallback preserved
 * verbatim per design call #3. Action emoji dropped per design call #4.
 * useFocusEffect reload preserved verbatim.
 */

export default function MyStoreScreen({ navigation }) {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStore = useCallback(async () => {
    try {
      const res = await influencerApi.getMyStorePreview();
      const data = res.data || res;
      setStore(data);
    } catch (e) {
      console.error('[MyStore] Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadStore();
  }, [loadStore]));

  const onRefresh = () => { setRefreshing(true); loadStore(); };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={P.yellow} /></View>;
  }

  const inf = store?.influencer;
  const offers = store?.offers || [];
  const totalProducts = offers.reduce((sum, o) => sum + (o.products?.length || 0), 0);

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.yellow]} />}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="chevron-left" size={20} color={P.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>My Store</Text>
          <Text style={s.subtitle}>This is what followers see</Text>
        </View>
      </View>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{inf?.name?.[0] || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.infName}>{inf?.name}</Text>
          <Text style={s.infHandle}>@{inf?.instagram_handle}</Text>
        </View>
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{offers.length}</Text>
            <Text style={s.statLabel}>Deals</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statVal}>{totalProducts}</Text>
            <Text style={s.statLabel}>Products</Text>
          </View>
        </View>
      </View>

      {/* Published products by campaign/offer */}
      {offers.length === 0 && (
        <View style={s.empty}>
          <View style={s.emptyTile}>
            <Text style={{ fontSize: 36 }}>🏪</Text>
          </View>
          <Text style={s.emptyTitle}>Your store is empty</Text>
          <Text style={s.emptyText}>Go to your campaigns → Products → Publish items to your store. Followers will see them here.</Text>
        </View>
      )}

      {offers.map((offer, oIdx) => (
        <View key={offer.offer_id || oIdx} style={s.offerSection}>
          <View style={s.offerHeader}>
            <Text style={s.offerBrand}>{offer.brand_name}</Text>
            <Text style={s.offerDiscount}>
              {offer.discount_value ? `${offer.discount_value}% OFF` : (offer.offer_type || '').toUpperCase()}
            </Text>
          </View>

          {(offer.products || []).map((product, pIdx) => (
            <View key={product.id || pIdx} style={s.productCard}>
              <View style={s.productRow}>
                <View style={s.productEmoji}>
                  {product.image_url ? (
                    <Image
                      source={{ uri: product.image_url }}
                      style={s.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={{ fontSize: 24 }}>
                      {CATEGORY_EMOJI[offer.brand_category] || '📦'}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.productName}>{product.name}</Text>
                  <Text style={s.productDesc}>{product.description || product.section}</Text>
                  <Text style={s.productPrice}>{fmtMoney(parseFloat(product.price || 0))}</Text>
                </View>
              </View>
              {product.influencer_note && (
                <View style={s.noteBox}>
                  <Text style={s.noteQuote}>"{product.influencer_note}"</Text>
                  <Text style={s.noteBy}>— YOUR RECOMMENDATION</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    paddingHorizontal: 18, paddingTop: 50, paddingBottom: 14,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBlack },
  subtitle: { fontSize: 10.5, color: P.muted2, marginTop: 3, fontFamily: fonts.monoMedium },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 14, marginBottom: 12, padding: 14,
    backgroundColor: P.white, borderRadius: 14,
    borderWidth: 1, borderColor: P.border,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: P.yellow, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  infName: { fontSize: 15, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  infHandle: { fontSize: 10.5, color: P.muted2, marginTop: 2, fontFamily: fonts.monoMedium },
  statsRow: { flexDirection: 'row', gap: 11 },
  statBox: { alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  statLabel: { fontSize: 8.5, color: P.muted2, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700', fontFamily: fonts.monoMedium },

  offerSection: { marginHorizontal: 14, marginBottom: 16 },
  offerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 7,
  },
  offerBrand: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  offerDiscount: {
    fontSize: 10, fontWeight: '800', color: P.successText,
    backgroundColor: P.successPale, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, letterSpacing: 0.3, fontFamily: fonts.monoBold,
  },

  productCard: {
    backgroundColor: P.white, borderRadius: 11,
    borderWidth: 1, borderColor: P.border, marginBottom: 7, overflow: 'hidden',
  },
  productRow: { flexDirection: 'row', padding: 11, gap: 10, alignItems: 'center' },
  productEmoji: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: P.bg2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  productImage: { width: 48, height: 48 },
  productName: { fontSize: 13, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  productDesc: { fontSize: 11, color: P.muted, marginTop: 2, fontFamily: fonts.sansRegular },
  productPrice: { fontSize: 14, fontWeight: '900', color: P.ink, marginTop: 4, fontFamily: fonts.monoBold },

  noteBox: {
    padding: 11, backgroundColor: P.yellowPale, borderTopWidth: 1, borderTopColor: '#F0DA88',
  },
  noteQuote: { fontSize: 11.5, color: P.yellowText, fontStyle: 'italic', lineHeight: 16, fontFamily: fonts.sansRegular },
  noteBy: { fontSize: 9, color: P.yellowText, marginTop: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold, opacity: 0.85 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 28 },
  emptyTile: {
    width: 66, height: 66, borderRadius: 14, backgroundColor: P.yellowPale,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 6, textAlign: 'center', fontFamily: fonts.displayBold },
  emptyText: { fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 18, fontFamily: fonts.sansRegular },
});
