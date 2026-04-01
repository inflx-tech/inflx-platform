import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { brandApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';
import { openWebDashboard } from '../../utils/openWebDashboard';

export default function BrandProfileScreen({ navigation }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [brand, setBrand]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    brandApi.getMe().then(res => {
      setLoading(false);
      if (res.success) setBrand(res.data?.brand || res.data);
    });
  }, []);

  async function logout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await clearSession();
          setAppRole('');
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  const rows = [
    { label: 'Business Name',  value: brand?.business_name || brand?.brand_name },
    { label: 'Category',       value: brand?.category },
    { label: 'City',           value: brand?.city },
    { label: 'State',          value: brand?.state },
    { label: 'GST Number',     value: brand?.gst_number || 'Not provided' },
    { label: 'Platform Fee',   value: brand?.platform_fee_pct ? `${brand.platform_fee_pct}%` : '8% (default)' },
    { label: 'Account Status', value: brand?.status },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(brand?.business_name || brand?.brand_name || '??').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.brandName}>{brand?.business_name || brand?.brand_name || '—'}</Text>
        <View style={[styles.statusChip, brand?.status === 'approved' ? styles.statusApproved : styles.statusPending]}>
          <Text style={[styles.statusChipText, brand?.status === 'approved' ? styles.statusApprovedText : styles.statusPendingText]}>
            {brand?.status || 'pending'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {rows.map(r => r.value ? (
          <View key={r.label} style={styles.row}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{r.value}</Text>
          </View>
        ) : null)}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Links</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => openWebDashboard()}>
          <Text style={styles.linkIcon}>🌐</Text>
          <Text style={styles.linkLabel}>Open Full Dashboard</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.linkIcon}>🔔</Text>
          <Text style={styles.linkLabel}>Notifications</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 26, fontWeight: '900', color: colors.white },
  brandName: { fontSize: 20, fontWeight: '800', color: colors.white, marginBottom: 8 },
  statusChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  statusApproved: { backgroundColor: colors.teal + '30' },
  statusApprovedText: { color: colors.teal, fontSize: 11, fontWeight: '700' },
  statusPending: { backgroundColor: colors.orange + '30' },
  statusPendingText: { color: colors.orange, fontSize: 11, fontWeight: '700' },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  rowValue: { fontSize: 12, color: colors.t1, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 12, textTransform: 'capitalize' },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  linkIcon: { fontSize: 20 },
  linkLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.t1 },
  linkArrow: { fontSize: 18, color: colors.t3 },
  logoutBtn: { margin: 16, borderWidth: 1, borderColor: colors.red, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.red },
});
