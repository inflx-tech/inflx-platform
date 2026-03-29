import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const TX_ICONS = {
  topup: '⬆️', escrow_lock: '🔒', escrow_release: '🔓',
  payout: '💸', refund: '↩️', platform_fee: '📊',
};

export default function BrandWalletScreen({ navigation }) {
  const [wallet, setWallet]         = useState(null);
  const [transactions, setTxns]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topupAmt, setTopupAmt]     = useState('');
  const [toppingUp, setToppingUp]   = useState(false);

  async function load() {
    const [walletRes, txRes] = await Promise.all([
      brandApi.getWallet(),
      brandApi.getWalletTransactions?.() || Promise.resolve({ success: false }),
    ]);
    setLoading(false);
    if (walletRes.success) setWallet(walletRes.data?.wallet || walletRes.data);
    if (txRes.success) setTxns(txRes.data?.transactions || []);
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  async function topup() {
    const amountPaise = Math.round(parseFloat(topupAmt) * 100);
    if (!amountPaise || amountPaise < 100) { Alert.alert('Minimum ₹1'); return; }
    setToppingUp(true);
    const res = await brandApi.createTopup(amountPaise);
    setToppingUp(false);
    if (res.success) {
      Alert.alert(
        'Top-up Order Created',
        'Complete payment via Razorpay. Open the brand web app to finish payment.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Failed', res.error?.message || 'Top-up failed');
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  const balance     = wallet?.wallet_balance || 0;
  const escrowLocked = wallet?.escrow_locked || 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
      </View>

      {/* Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmt}>{fmtMoney(balance)}</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Locked in Escrow</Text>
            <Text style={styles.balanceStatVal}>{fmtMoney(escrowLocked)}</Text>
          </View>
        </View>
      </View>

      {/* Quick amounts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Funds</Text>
        <View style={styles.quickRow}>
          {[5000, 10000, 25000, 50000].map(amt => (
            <TouchableOpacity
              key={amt}
              style={[styles.quickChip, topupAmt === String(amt) && styles.quickChipActive]}
              onPress={() => setTopupAmt(String(amt))}
            >
              <Text style={[styles.quickText, topupAmt === String(amt) && styles.quickTextActive]}>
                ₹{(amt).toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.topupRow}>
          <View style={styles.topupInput}>
            <Text style={styles.rupeeSign}>₹</Text>
            <TextInput
              style={styles.topupField}
              value={topupAmt}
              onChangeText={setTopupAmt}
              placeholder="Custom amount"
              placeholderTextColor={colors.t3}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity
            style={[styles.topupBtn, (toppingUp || !topupAmt) && { opacity: 0.5 }]}
            onPress={topup}
            disabled={toppingUp || !topupAmt}
          >
            {toppingUp ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.topupBtnText}>Top Up</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.topupNote}>
          Note: Complete Razorpay payment on brand web app after creating the order.
        </Text>
      </View>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.slice(0, 10).map((tx, i) => {
            const isCredit = ['topup', 'escrow_release', 'refund'].includes(tx.type);
            return (
              <View key={tx.id || i} style={styles.txRow}>
                <Text style={styles.txIcon}>{TX_ICONS[tx.type] || '•'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txType}>{tx.type?.replace(/_/g, ' ')}</Text>
                  <Text style={styles.txDate}>{tx.created_at ? new Date(tx.created_at).toLocaleString('en-IN') : ''}</Text>
                </View>
                <Text style={[styles.txAmount, { color: isCredit ? colors.teal : colors.red }]}>
                  {isCredit ? '+' : '-'}{fmtMoney(Math.abs(tx.amount || 0))}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  title: { fontSize: 22, fontWeight: '800', color: colors.white },
  balanceCard: { margin: 16, marginBottom: 0, backgroundColor: colors.navy, borderRadius: 20, padding: 20 },
  balanceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
  balanceAmt: { fontSize: 36, fontWeight: '900', color: colors.white, marginTop: 4, marginBottom: 12 },
  balanceRow: { flexDirection: 'row' },
  balanceStat: { flex: 1 },
  balanceStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  balanceStatVal: { fontSize: 16, fontWeight: '700', color: colors.white, marginTop: 2 },
  section: { margin: 16, marginBottom: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 10 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickChip: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  quickChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  quickText: { fontSize: 12, fontWeight: '700', color: colors.t2 },
  quickTextActive: { color: colors.white },
  topupRow: { flexDirection: 'row', gap: 10 },
  topupInput: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border2, borderRadius: 12 },
  rupeeSign: { paddingHorizontal: 12, fontSize: 16, fontWeight: '700', color: colors.t2 },
  topupField: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.t1 },
  topupBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  topupBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  topupNote: { fontSize: 10, color: colors.t3, marginTop: 8, lineHeight: 14 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  txIcon: { fontSize: 18 },
  txType: { fontSize: 13, color: colors.t1, fontWeight: '500', textTransform: 'capitalize' },
  txDate: { fontSize: 10, color: colors.t3, marginTop: 1 },
  txAmount: { fontSize: 13, fontWeight: '700' },
});
