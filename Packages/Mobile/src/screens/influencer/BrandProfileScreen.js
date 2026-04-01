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
import { colors } from '../../theme/tokens';
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
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  if (error || !brand) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Brand not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go Back</Text>
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
          <Text style={styles.backText}>← Back</Text>
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

      {/* Info Cards */}
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
          <View style={styles.infoRow}>
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

      {/* Active Campaigns */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Campaigns</Text>
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{brand.active_campaigns_count || 0}</Text>
            <Text style={styles.statLabel}>Active Campaigns</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 20 },
  errorText: { fontSize: 14, color: colors.t3, marginBottom: 16, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.navy, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { fontSize: 14, fontWeight: '600', color: colors.white },

  // Header
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52, paddingBottom: 24 },
  back: { marginBottom: 16 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logo: { width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoFallback: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoInitial: { fontSize: 28, fontWeight: '900', color: colors.white },
  businessName: { fontSize: 22, fontWeight: '800', color: colors.white },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' },

  // Card
  card: {
    margin: 16, marginBottom: 0,
    backgroundColor: colors.white,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 14 },

  // Info rows
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 10, fontWeight: '700', color: colors.t3,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.t1 },

  // Stats
  statRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1, backgroundColor: colors.navyPale,
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  statNumber: { fontSize: 28, fontWeight: '900', color: colors.navy },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.t2, marginTop: 4 },
});
