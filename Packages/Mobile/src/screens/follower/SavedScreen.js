import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator,
  TouchableOpacity, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { creatorVibe as C, spacing, radius, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { buildTracking } from '../../utils/tracking';

// Wishlist (SavedScreen) — Creators Vibe Yellow reskin (source screen 10), adapted
// to the real data this screen loads: SAVED OFFERS (/follower/saved), not bare
// products. Each item carries a brand + a product + discount + creator attribution +
// tracking. We render the source's tile grid enriched with those real fields. Visual
// + UX only — getSavedOffers / unsaveOffer / CTA dispatch are unchanged.
// Contract: features/follower-rebuild-wishlist.

// ── discount helpers (mirror OfferCard; rupees post-migration) ──
function getDiscountLabel(item) {
  switch (item?.offer_type) {
    case 'percentage': return `${item.discount_value}% OFF`;
    case 'flat':       return `₹${item.discount_value} OFF`;
    case 'bogo':       return 'BOGO';
    case 'bundle':     return 'BUNDLE';
    case 'volume':     return 'BULK DEAL';
    case 'prebook':    return 'PRE-BOOK';
    default:           return null;
  }
}
function getDiscountedPrice(price, item) {
  if (!item || !price) return price || 0;
  if (item.offer_type === 'percentage') {
    return parseFloat((price * (1 - (item.discount_value || 0) / 100)).toFixed(2));
  }
  if (item.offer_type === 'flat') {
    return Math.max(0, price - (item.discount_value || 0));
  }
  return price;
}
const CATEGORY_EMOJI = {
  restaurant: '🍽️', bakery: '🎂', salon: '💇', florist: '🌹', furniture: '🛋️',
  packaged_food: '📦', car_rental: '🚗', fashion: '👗', fashion_walkin: '👗',
  fashion_online: '🛍️',
};

export default function SavedScreen({ navigation }) {
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSaved = useCallback(async () => {
    try {
      const res = await followerApi.getSavedOffers();
      const data = res.data || res;
      setSaved(data.saved || []);
    } catch (e) {
      console.error('[SavedScreen] Error:', e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSaved().finally(() => setLoading(false));
    }, [fetchSaved])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSaved();
    setRefreshing(false);
  }, [fetchSaved]);

  const handleUnsave = useCallback(async (item) => {
    try {
      await followerApi.unsaveOffer(item.offer_id);
      setSaved(prev => prev.filter(s => s.offer_id !== item.offer_id));
    } catch (e) {
      console.error('[SavedScreen] Unsave error:', e.message);
    }
  }, []);

  const handleOpen = useCallback((item) => {
    const params = {
      offer: { id: item.offer_id, offer_type: item.offer_type, discount_value: item.discount_value, availing_modes: item.availing_modes },
      brand: item.brand,
      tracking: item.tracking,
      influencer: item.influencer,
    };
    const mode = item.availing_modes?.[0] || 'online_order';
    switch (mode) {
      case 'pay_at_store': navigation.navigate('PayAtStore', params); break;
      case 'prebook':      navigation.navigate('PreBook', params); break;
      case 'enquiry':      navigation.navigate('Enquiry', params); break;
      default:             navigation.navigate('ProductDetail', params);
    }
  }, [navigation]);

  const renderItem = useCallback(({ item }) => {
    const product   = item.products?.[0] || null;
    const price     = product?.price || 0;
    const discounted = getDiscountedPrice(price, item);
    const hasSaving = price > 0 && discounted < price;
    const discLabel = getDiscountLabel(item);
    const handle    = item.influencer?.handle || null;

    return (
      <TouchableOpacity style={s.card} activeOpacity={0.9} onPress={() => handleOpen(item)}>
        <View style={s.imgWrap}>
          {product?.image_url
            ? <Image source={{ uri: product.image_url }} style={s.img} />
            : <View style={s.imgPh}><Text style={{ fontSize: 38 }}>{CATEGORY_EMOJI[item.brand?.category] || '🛍️'}</Text></View>}

          {discLabel ? (
            <View style={s.disc}><Text style={s.discTxt}>{discLabel}</Text></View>
          ) : null}

          <TouchableOpacity
            style={s.heart}
            onPress={() => handleUnsave(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.heartTxt}>♥</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => item.brand?.id && navigation.navigate('BrandStore', {
            brandId: item.brand.id, brandName: item.brand.name, tracking: buildTracking(item),
          })}
        >
          <Text style={s.brand} numberOfLines={1}>{item.brand?.name || 'Brand'}</Text>
        </TouchableOpacity>

        {product?.name ? <Text style={s.nm} numberOfLines={2}>{product.name}</Text> : null}

        {price > 0 ? (
          <View style={s.prow}>
            <Text style={s.pr}>{fmtMoney(discounted)}</Text>
            {hasSaving ? <Text style={s.prWas}>{fmtMoney(price)}</Text> : null}
          </View>
        ) : null}

        {handle ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('InfluencerStore', { handle })}
          >
            <Text style={s.via} numberOfLines={1}>via @{handle}</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  }, [handleOpen, handleUnsave, navigation]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>My Wishlist <Text style={s.count}>({saved.length})</Text></Text>
      </View>

      <FlatList
        data={saved}
        keyExtractor={(item, idx) => `${item.offer_id}_${idx}`}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={s.col}
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.blob}><Text style={s.blobHeart}>♥</Text></View>
            <Text style={s.emptyTitle}>Nothing saved yet</Text>
            <Text style={s.emptyText}>Tap the heart on any offer to keep it here for later.</Text>
            <TouchableOpacity style={s.emptyCta} onPress={() => navigation.navigate('HomeTab')}>
              <Text style={s.emptyCtaTxt}>Browse</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.screenBg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.sm,
    backgroundColor: C.screenBg,
  },
  back: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 24, fontWeight: '700', color: C.ink, marginTop: -2 },
  title: { fontSize: 23, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  count: { fontSize: 18, fontWeight: '700', color: C.muted },

  col: { justifyContent: 'space-between', paddingHorizontal: spacing.lg },

  card: { width: '48%', marginBottom: spacing.lg },
  imgWrap: {
    position: 'relative', borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: C.soft, height: 150,
  },
  img: { width: '100%', height: 150, resizeMode: 'cover' },
  imgPh: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.soft },
  disc: {
    position: 'absolute', top: 8, left: 8, backgroundColor: C.offer,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm,
  },
  discTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  heart: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  heartTxt: { fontSize: 15, color: C.offer, marginTop: -1 },

  brand: { fontSize: 10.5, fontWeight: '700', color: C.muted, marginTop: 9, textTransform: 'uppercase', letterSpacing: 0.4 },
  nm: { fontSize: 13, fontWeight: '600', color: C.ink, marginTop: 3, lineHeight: 16 },
  prow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  pr: { fontSize: 13.5, fontWeight: '800', color: C.ink },
  prWas: { fontSize: 11, fontWeight: '600', color: C.muted, textDecorationLine: 'line-through' },
  via: { fontSize: 10.5, fontWeight: '600', color: C.goldDeep, marginTop: 5 },

  empty: { alignItems: 'center', paddingTop: 90, paddingHorizontal: 46 },
  blob: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  blobHeart: { fontSize: 38, color: C.goldDeep },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.ink, marginBottom: 6 },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  emptyCta: { backgroundColor: C.gold, borderRadius: radius.md, paddingHorizontal: 26, paddingVertical: 12 },
  emptyCtaTxt: { fontSize: 13.5, fontWeight: '800', color: C.onGold },
});
