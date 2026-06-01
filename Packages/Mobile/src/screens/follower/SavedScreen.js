import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { creatorVibe as C, spacing } from '../../theme/tokens';

// Flow 52.G — Creator Vibe: SavedScreen was still on the DARK theme. Remap the
// darkColors tokens it referenced → creatorVibe (dark bg → cream, light text →
// ink, amber → brown). Visual only; getSavedOffers / unsave / CTA dispatch kept.
const darkColors = {
  bg2: C.screenBg,
  text: C.ink,
  textSecondary: C.muted,
  amber: C.brown,
};
import { followerApi } from '../../services/api';
import OfferCard from '../../components/OfferCard';
import { buildTracking } from '../../utils/tracking';

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

  const handleCTA = useCallback((item, mode) => {
    const params = {
      offer: { id: item.offer_id, offer_type: item.offer_type, discount_value: item.discount_value, availing_modes: item.availing_modes },
      brand: item.brand,
      tracking: item.tracking,
      influencer: item.influencer,
    };
    switch (mode) {
      case 'pay_at_store': navigation.navigate('PayAtStore', params); break;
      case 'prebook': navigation.navigate('PreBook', params); break;
      case 'enquiry': navigation.navigate('Enquiry', params); break;
      default: navigation.navigate('ProductDetail', params);
    }
  }, [navigation]);

  const renderItem = useCallback(({ item }) => {
    const product = item.products?.[0] || null;
    return (
      <OfferCard
        brand={item.brand}
        offer={{ id: item.offer_id, offer_type: item.offer_type, discount_value: item.discount_value, availing_modes: item.availing_modes }}
        product={product}
        influencer={item.influencer}
        tracking={item.tracking}
        isSaved={true}
        onSave={() => handleUnsave(item)}
        onPressCTA={(mode) => handleCTA(item, mode)}
        onPressInfluencer={() => {
          if (item.influencer?.handle) navigation.navigate('InfluencerStore', { handle: item.influencer.handle });
        }}
        onPressBrand={() => {
          if (item.brand?.id) navigation.navigate('BrandStore', {
            brandId: item.brand.id,
            brandName: item.brand.name,
            tracking: buildTracking(item),
          });
        }}
      />
    );
  }, [handleCTA, handleUnsave, navigation]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={darkColors.amber} /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Saved</Text>
        <Text style={s.count}>{saved.length} offer{saved.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={saved}
        keyExtractor={(item, idx) => `${item.offer_id}_${idx}`}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkColors.amber} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🔖</Text>
            <Text style={s.emptyTitle}>No saved offers</Text>
            <Text style={s.emptyText}>Browse deals and tap the bookmark icon to save offers for later.</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkColors.bg2 },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.sm,
    backgroundColor: darkColors.bg2,
  },
  title: { fontSize: 22, fontWeight: '800', color: darkColors.text },
  count: { fontSize: 12, color: darkColors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: darkColors.text, marginBottom: 4 },
  emptyText: { fontSize: 12, color: darkColors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
