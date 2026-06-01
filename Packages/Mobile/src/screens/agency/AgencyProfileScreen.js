import React, { useEffect, useState, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { agencyApi } from '../../services/api';
import { AuthContext } from '../../../App';

/**
 * AgencyProfileScreen (Contract 3b) — agency identity, approval status,
 * contact/payout summary, and logout.
 */

const P = {
  bg: '#FAFAFA', white: '#FFFFFF', ink: '#0A0A0A', muted: '#52525B', muted2: '#71717A',
  border: '#E4E4E7', yellow: '#FFC107', tealDeep: '#007A63', tealPale: '#E0FAF5',
  yellowPale: '#FFF7CC', yellowText: '#6B5A00', danger: '#E8401A', dangerPale: '#FDEEE9',
};

const STATUS_STYLE = {
  approved: { bg: P.tealPale, fg: P.tealDeep, label: 'Approved' },
  pending: { bg: P.yellowPale, fg: P.yellowText, label: 'Awaiting approval' },
  rejected: { bg: P.dangerPale, fg: P.danger, label: 'Rejected' },
  suspended: { bg: '#F4F4F5', fg: P.muted, label: 'Suspended' },
};

export default function AgencyProfileScreen() {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [agency, setAgency] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await agencyApi.getMe();
      setLoading(false);
      if (res.success) setAgency(res.data?.agency || null);
    })();
  }, []);

  function logout() {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
        setAppRole('');
      } },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={P.yellow} /></View>;
  const ss = STATUS_STYLE[agency?.user_status] || STATUS_STYLE.pending;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
      <Text style={styles.appTitle}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.name}>{agency?.agency_name || 'Your agency'}</Text>
        <View style={[styles.statusPill, { backgroundColor: ss.bg }]}><Text style={[styles.statusText, { color: ss.fg }]}>{ss.label}</Text></View>
        <Row k="Contact" v={agency?.contact_person || '—'} />
        <Row k="Email" v={agency?.contact_email || '—'} />
        <Row k="City" v={agency?.city || '—'} />
        <Row k="Payout" v={agency?.has_upi ? 'UPI on file' : agency?.has_bank ? 'Bank on file' : 'Not set'} />
        <Row k="Referral code" v={agency?.referral_code || '—'} last />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ k, v, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={styles.rowV} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  appTitle: { fontSize: 20, fontWeight: '900', color: P.ink, marginBottom: 12 },
  card: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, padding: 16 },
  name: { fontSize: 18, fontWeight: '900', color: P.ink },
  statusPill: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6, marginBottom: 8 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: P.border, gap: 12 },
  rowK: { fontSize: 13, color: P.muted2 },
  rowV: { fontSize: 13, fontWeight: '700', color: P.ink, flexShrink: 1, textAlign: 'right' },
  logoutBtn: { marginTop: 18, borderWidth: 1.5, borderColor: P.dangerPale, borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontSize: 13, fontWeight: '900', color: P.danger, textTransform: 'uppercase', letterSpacing: 0.3 },
});
