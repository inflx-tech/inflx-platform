import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Share, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Clipboard from '@react-native-clipboard/clipboard';
import { agencyApi } from '../../services/api';

/**
 * AgencyHomeScreen (Contract 3b) — wallet balance, total earned, active
 * referrals, referral code (Copy/Share), and "how you earn". Reads /agencies/me.
 */

const P = {
  bg: '#FAFAFA', white: '#FFFFFF', bg2: '#F4F4F5', ink: '#0A0A0A', ink2: '#1F1F22',
  muted: '#52525B', muted2: '#71717A', muted3: '#A1A1AA', border: '#E4E4E7',
  yellow: '#FFC107', yellowPale: '#FFF7CC', yellow50: '#FFFDEB', yellowText: '#6B5A00',
};
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function AgencyHomeScreen() {
  const [agency, setAgency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await agencyApi.getMe();
    setLoading(false);
    if (res.success) setAgency(res.data?.agency || null);
  }
  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  function copyCode() {
    if (!agency?.referral_code) return;
    Clipboard.setString(agency.referral_code);
    Alert.alert('Copied', 'Your referral code is on the clipboard.');
  }
  async function shareCode() {
    if (!agency?.referral_code) return;
    try { await Share.share({ message: `Partner with INFLX using my code ${agency.referral_code} — https://inflx.in` }); } catch (_) {}
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={P.yellow} /></View>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.yellow]} />}>
      <Text style={styles.appTitle} numberOfLines={1}>{agency?.agency_name || 'Your agency'}</Text>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>WALLET BALANCE</Text>
        <Text style={styles.heroAmount}>{inr(agency?.wallet_balance)}</Text>
        <Text style={styles.heroSub}>Withdraw anytime from the Wallet tab</Text>
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.statK}>TOTAL EARNED</Text><Text style={styles.statV}>{inr(agency?.referral_earned_total)}</Text></View>
        <View style={styles.stat}><Text style={styles.statK}>ACTIVE REFERRALS</Text><Text style={styles.statV}>{agency?.referred_count ?? 0}</Text></View>
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.cap}>YOUR REFERRAL CODE</Text>
        <View style={styles.codeChip}><Text style={styles.codeText}>{agency?.referral_code || '—'}</Text></View>
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={copyCode} activeOpacity={0.8}>
            <Icon name="content-copy" size={16} color={P.ink} /><Text style={styles.btnGhostText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={shareCode} activeOpacity={0.8}>
            <Icon name="share-variant" size={16} color={P.ink} /><Text style={styles.btnPrimaryText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sec}>How you earn</Text>
      <View style={styles.how}>
        <HowRow icon="office-building" text="Refer a brand → share of their subscription + campaign protection fee." />
        <HowRow icon="star" text="Refer an influencer → share of the commission on their sales." />
        <HowRow icon="calendar-month" text="You earn for 12 months per referral, paid to your wallet as we earn." last />
      </View>
    </ScrollView>
  );
}

function HowRow({ icon, text, last }) {
  return (
    <View style={[styles.howRow, last && { marginBottom: 0 }]}>
      <Icon name={icon} size={18} color={P.yellowText} style={{ width: 24 }} />
      <Text style={styles.howText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  appTitle: { fontSize: 20, fontWeight: '900', color: P.ink, marginBottom: 12 },
  hero: { backgroundColor: P.ink, borderRadius: 18, padding: 18 },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: P.yellow },
  heroAmount: { fontSize: 32, fontWeight: '900', color: P.white, marginTop: 2 },
  heroSub: { fontSize: 12, color: P.muted3, marginTop: 1 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 14, padding: 12 },
  statK: { fontSize: 10, fontWeight: '800', color: P.muted2 },
  statV: { fontSize: 18, fontWeight: '900', color: P.ink, marginTop: 3 },
  codeCard: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, padding: 16, marginTop: 12 },
  cap: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: P.muted2 },
  codeChip: { backgroundColor: P.yellowPale, borderWidth: 1.5, borderColor: P.yellow, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, marginTop: 8 },
  codeText: { fontFamily: 'monospace', fontSize: 22, fontWeight: '800', letterSpacing: 1, color: P.ink, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  btnPrimary: { backgroundColor: P.yellow }, btnPrimaryText: { fontSize: 14, fontWeight: '800', color: P.ink },
  btnGhost: { backgroundColor: P.white, borderWidth: 1.5, borderColor: P.ink }, btnGhostText: { fontSize: 14, fontWeight: '800', color: P.ink },
  sec: { fontSize: 13, fontWeight: '800', color: P.ink, marginTop: 18, marginBottom: 8, marginHorizontal: 4 },
  how: { backgroundColor: P.yellow50, borderWidth: 1, borderColor: P.yellowPale, borderRadius: 14, padding: 14 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  howText: { flex: 1, fontSize: 12.5, color: P.ink2, lineHeight: 18 },
});
