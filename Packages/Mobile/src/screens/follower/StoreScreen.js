import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function StoreScreen({ navigation, route }) {
  const handle = route.params?.handle || '';
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  async function load() {
    const res = await followerApi.getStore(handle);
    setLoading(false);
    if (res.success) {
      const data = res.data?.store || res.data;
      setStore(data);
      setFollowing(data?.is_following || false);
    }
  }

  useEffect(() => { if (handle) load(); }, [handle]);

  async function toggleFollow() {
    if (!store?.influencer_id) return;
    if (following) {
      await followerApi.unfollow(store.influencer_id);
    } else {
      await followerApi.follow(store.influencer_id);
    }
    setFollowing(!following);
  }

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><Text style={{ color: colors.t3 }}>Loading store...</Text></View>;
  if (!store) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><Text style={{ color: colors.red }}>Store not found</Text></View>;

  const offers = store.offers || [];

  return (
    <ScrollView style={styles.container}>
      {/* Hero section */}
      <View style={styles.hero}>
        <View style={styles.heroAvatar}>
          <Text style={styles.heroAvatarText}>{handle.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.heroName}>@{store.instagram_handle || handle}</Text>
        <Text style={styles.heroStats}>{(store.followers_count || 0).toLocaleString('en-IN')} followers · {store.engagement_rate || 0}% ER</Text>
        {store.bio && <Text style={styles.heroBio}>{store.bio}</Text>}
        <TouchableOpacity style={[styles.followBtn, following && styles.followBtnActive]} onPress={toggleFollow}>
          <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>{following ? '✓ Following' : '+ Follow'}</Text>
        </TouchableOpacity>
      </View>

      {/* Brand info */}
      <View style={styles.brandSection}>
        <Text style={styles.brandName}>{store.brand_name}</Text>
        <Text style={styles.brandCategory}>{store.category}</Text>
      </View>

      {/* Offers */}
      <View style={styles.offersSection}>
        <Text style={styles.sectionTitle}>Active Deals</Text>
        {offers.map(offer => (
          <View key={offer.id} style={styles.offerCard}>
            <Text style={styles.offerTitle}>{offer.title}</Text>
            {offer.offer_type === 'percentage' && offer.discount_value ? (
              <Text style={styles.offerDiscount}>{offer.discount_value}% OFF</Text>
            ) : offer.offer_type === 'flat' && offer.discount_value ? (
              <Text style={styles.offerDiscount}>₹{(offer.discount_value/100).toLocaleString('en-IN')} OFF</Text>
            ) : null}
            <View style={styles.ctaRow}>
              {(offer.availing_modes || []).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={styles.ctaBtn}
                  onPress={() => {
                    const trackingParams = { cid: offer.campaign_id, sid: offer.set_id, oid: offer.id, iid: store.influencer_id };
                    if (mode === 'pay_at_store') navigation.navigate('PayAtStore', { offer, store, trackingParams });
                    else if (mode === 'prebook') navigation.navigate('PreBook', { offer, store, trackingParams });
                    else if (mode === 'online_order') navigation.navigate('OnlineOrder', { offer, store, trackingParams });
                    else if (mode === 'enquiry') navigation.navigate('Enquiry', { offer, store, trackingParams });
                  }}
                >
                  <Text style={styles.ctaBtnText}>{mode.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {offers.length === 0 && <Text style={styles.noOffers}>No active deals right now</Text>}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { backgroundColor: colors.navyDeep, padding: 24, paddingTop: 52, alignItems: 'center' },
  heroAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  heroAvatarText: { fontSize: 24, fontWeight: '800', color: colors.white },
  heroName: { fontSize: 18, fontWeight: '800', color: colors.white, marginBottom: 4 },
  heroStats: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 8 },
  heroBio: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 16, lineHeight: 20, paddingHorizontal: 16 },
  followBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  followBtnActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  followBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  followBtnTextActive: { color: colors.white },
  brandSection: { backgroundColor: colors.white, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandName: { fontSize: 16, fontWeight: '700', color: colors.t1 },
  brandCategory: { fontSize: 12, color: colors.t3, marginTop: 2, textTransform: 'capitalize' },
  offersSection: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  offerCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  offerTitle: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  offerDiscount: { fontSize: 28, fontWeight: '800', color: colors.orange, marginBottom: 12 },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ctaBtn: { backgroundColor: colors.navyDeep, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  ctaBtnText: { fontSize: 12, fontWeight: '700', color: colors.white, textTransform: 'capitalize' },
  noOffers: { textAlign: 'center', color: colors.t3, paddingVertical: 20 },
});
