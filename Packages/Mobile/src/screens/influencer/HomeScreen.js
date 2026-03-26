import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { colors, fmtMoney, fmtNum } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function HomeScreen({ navigation }) {
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await influencerApi.getEarnings();
    setLoading(false);
    if (res.success) setEarnings(res.data);
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  if (loading) return <View style={styles.center}><Text style={styles.loadingText}>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>INFL<Text style={{color: colors.orange}}>X</Text></Text>
        <Text style={styles.headerSub}>Your earnings dashboard</Text>
      </View>

      {/* Wallet balance hero */}
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>Available to Withdraw</Text>
        <Text style={styles.walletAmount}>{fmtMoney(earnings?.available_to_withdraw || earnings?.wallet_balance)}</Text>
        <View style={styles.walletRow}>
          <View style={styles.walletStat}>
            <Text style={styles.walletStatLabel}>Pending</Text>
            <Text style={styles.walletStatVal}>{fmtMoney(earnings?.pending_balance)}</Text>
          </View>
          <View style={[styles.walletStat, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)', paddingLeft: 16 }]}>
            <Text style={styles.walletStatLabel}>Total Earned</Text>
            <Text style={styles.walletStatVal}>{fmtMoney(earnings?.total_earned)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.withdrawBtn} onPress={() => navigation.navigate('Earnings')}>
          <Text style={styles.withdrawBtnText}>Withdraw →</Text>
        </TouchableOpacity>
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{earnings?.commission_summary?.pending || 0}</Text>
          <Text style={styles.statLabel}>Pending Commissions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{fmtMoney(earnings?.tds_this_financial_year)}</Text>
          <Text style={styles.statLabel}>TDS This FY</Text>
        </View>
      </View>

      {/* Recent withdrawals */}
      {earnings?.recent_withdrawals?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Withdrawals</Text>
          {earnings.recent_withdrawals.map(w => (
            <View key={w.withdrawal_id} style={styles.withdrawRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.withdrawAmt}>{fmtMoney(w.net_paid)} received</Text>
                <Text style={styles.withdrawSub}>TDS: {fmtMoney(w.tds_deducted)} · {w.method?.toUpperCase()}</Text>
              </View>
              <StatusBadge status={w.status} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loadingText: { fontSize: 14, color: colors.t3 },
  header: { backgroundColor: colors.navyDeep, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 0 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  walletCard: { backgroundColor: colors.navy, marginHorizontal: 16, marginTop: -1, borderRadius: 16, padding: 20 },
  walletLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  walletAmount: { fontSize: 34, fontWeight: '800', color: colors.white, marginBottom: 16 },
  walletRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  walletStat: {},
  walletStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  walletStatVal: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  withdrawBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  withdrawBtnText: { fontSize: 13, fontWeight: '700', color: '#7A5500' },
  statsRow: { flexDirection: 'row', gap: 12, margin: 16 },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.t1, marginBottom: 4 },
  statLabel: { fontSize: 10, color: colors.t3, fontWeight: '600' },
  section: { margin: 16, marginTop: 0 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.t2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  withdrawRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  withdrawAmt: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 2 },
  withdrawSub: { fontSize: 11, color: colors.t3 },
});
