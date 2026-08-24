import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

export default function BrandProfileScreen({ navigation, route }) {
  const { brand_id } = route.params || {};
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!brand_id) {
      setLoading(false);
      setError('No brand ID provided');
      return;
    }
    loadBrand();
  }, [brand_id]);

  async function loadBrand() {
    setLoading(true);
    setError(null);
    const res = await influencerApi.getBrandPublicProfile(brand_id);
    setLoading(false);
    if (res.success) {
      setBrand(res.data?.brand || null);
    } else {
      setError(res.error?.message || 'Failed to load brand profile');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={P.ink} size="large" />
      </View>
    );
  }

  if (error || !brand) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Brand not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initial = (brand.business_name || 'B').charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={16} color={P.muted2} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.profileRow}>
          {brand.logo_url ? (
            <Image source={{ uri: brand.logo_url }} style={styles.logo} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoInitial}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.businessName}>{brand.business_name || 'Brand'}</Text>
            {brand.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{brand.category}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Brand Details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Brand Details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Business Name</Text>
          <Text style={styles.infoValue}>{brand.business_name || '--'}</Text>
        </View>

        {brand.category && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>{brand.category}</Text>
          </View>
        )}

        {brand.address_line && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{brand.address_line}</Text>
          </View>
        )}

        {brand.created_at && (
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>On INFLX Since</Text>
            <Text style={styles.infoValue}>
              {new Date(brand.created_at).toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Campaigns stat box */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Campaigns</Text>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{brand.active_campaigns_count || 0}</Text>
          <Text style={styles.statLabel}>Active Campaigns</Text>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg, padding: 20 },
  errorText: { fontFamily: fonts.sansMedium, fontSize: 13, color: P.muted, marginBottom: 16, textAlign: 'center' },
  retryBtn:  { backgroundColor: P.ink, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  retryText: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.white, letterSpacing: 0.3 },

  // Header (white topbar, ink text, hairline rule)
  header: { backgroundColor: P.white, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 22, position: 'relative', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  back:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  backText:  { fontFamily: fonts.monoBold, fontSize: 10.5, color: P.muted2, fontWeight: '700' },
  profileRow:{ flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo:      { width: 68, height: 68, borderRadius: 16, backgroundColor: P.ink },
  logoFallback: {
    width: 68, height: 68, borderRadius: 16,
    backgroundColor: P.ink,
    justifyContent: 'center', alignItems: 'center',
  },
  logoInitial:  { fontFamily: fonts.displayBlack, fontSize: 30, fontWeight: '900', color: P.white },
  businessName: { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '800', color: P.ink },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: P.bg2,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 6,
  },
  categoryText: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '800', color: P.muted2, textTransform: 'capitalize', letterSpacing: 0.3 },

  // Card
  card: {
    marginHorizontal: 14, marginTop: 12,
    backgroundColor: P.white,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: P.border,
  },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.ink, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Info rows
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: P.borderSoft,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5, fontWeight: '800',
    color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginBottom: 4,
  },
  infoValue: { fontFamily: fonts.sansMedium, fontSize: 13.5, fontWeight: '600', color: P.ink },

  // Stats
  statBox: {
    backgroundColor: P.bg2,
    borderWidth: 1.5,
    borderColor: P.ink,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  statNumber: { fontFamily: fonts.displayBlack, fontSize: 32, fontWeight: '900', color: P.ink, lineHeight: 36 },
  statLabel:  { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.ink, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
});
