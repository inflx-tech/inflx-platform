import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert } from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tab, setTab] = useState('earnings');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Withdrawal form
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [withdrawing, setWithdrawing] = useState(false);

  async function load() {
    const [er, wr] = await Promise.all([influencerApi.getEarnings(), influencerApi.getWithdrawals()]);
    setLoading(false);
    if (er.success) setEarnings(er.data);
    if (wr.success) setWithdrawals(wr.data?.withdrawals || wr.data || []);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  async function handleWithdraw() {
    const amtPaise = Math.round(parseFloat(amount) * 100);
    if (amtPaise < 10000) { Alert.alert('Minimum ₹100 withdrawal'); return; }
    setWithdrawing(true);
    const res = await influencerApi.withdraw({ amount_requested: amtPaise, method });
    setWithdrawing(false);
    if (res.success) {
      Alert.alert('Withdrawal initiated!', `Net amount: ${fmtMoney(res.data?.withdrawal?.net_paid)}`);
      setAmount('');
      load();
    } else {
      Alert.alert('Failed', res.error?.message || 'Withdrawal failed');
    }
  }

  const tds = amount ? Math.floor(parseFloat(amount || '0') * 100 * 0.1) : 0;
  const net = amount ? Math.round(parseFloat(amount || '0') * 100) - tds : 0;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.headerLabel}>Available to Withdraw</Text>
        <Text style={styles.headerAmount}>{fmtMoney(earnings?.available_to_withdraw || earnings?.wallet_balance)}</Text>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
          <View>
            <Text style={styles.miniLabel}>Pending</Text>
            <Text style={styles.miniVal}>{fmtMoney(earnings?.pending_balance)}</Text>
          </View>
          <View>
            <Text style={styles.miniLabel}>TDS This FY</Text>
            <Text style={styles.miniVal}>{fmtMoney(earnings?.tds_this_financial_year)}</Text>
          </View>
          <View>
            <Text style={styles.miniLabel}>Total Earned</Text>
            <Text style={styles.miniVal}>{fmtMoney(earnings?.total_earned)}</Text>
          </View>
        </View>
      </View>

      {/* Withdrawal form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Withdraw Funds</Text>
        <View style={styles.methodRow}>
          {['upi', 'bank'].map(m => (
            <TouchableOpacity key={m} onPress={() => setMethod(m)} style={[styles.methodCard, method === m && styles.methodCardActive]}>
              <Text style={{ fontSize: 18, marginBottom: 4 }}>{m === 'upi' ? '📱' : '🏦'}</Text>
              <Text style={[styles.methodLabel, method === m && { color: colors.white }]}>{m.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.rupeeSign}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="1000"
            placeholderTextColor={colors.t3}
          />
        </View>

        {amount ? (
          <View style={styles.tdsCard}>
            <View style={styles.tdsRow}><Text style={styles.tdsLabel}>Requested</Text><Text style={styles.tdsVal}>{fmtMoney(Math.round(parseFloat(amount)*100))}</Text></View>
            <View style={styles.tdsRow}><Text style={styles.tdsLabel}>TDS (10%)</Text><Text style={[styles.tdsVal, {color: colors.red}]}>- {fmtMoney(tds)}</Text></View>
            <View style={[styles.tdsRow, {borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4}]}>
              <Text style={[styles.tdsLabel, {fontWeight: '700', color: colors.t1}]}>You Receive</Text>
              <Text style={[styles.tdsVal, {color: colors.teal, fontWeight: '800'}]}>{fmtMoney(net)}</Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.withdrawBtn, (withdrawing || !amount) && styles.withdrawBtnDisabled]}
          onPress={handleWithdraw}
          disabled={withdrawing || !amount}
        >
          <Text style={styles.withdrawBtnText}>{withdrawing ? 'Processing...' : 'Withdraw Now'}</Text>
        </TouchableOpacity>
      </View>

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal History</Text>
          {withdrawals.map(w => (
            <View key={w.withdrawal_id || w.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyAmt}>{fmtMoney(w.net_paid)}</Text>
                <Text style={styles.historySub}>Requested: {fmtMoney(w.amount_requested)} · TDS: {fmtMoney(w.tds_deducted)}</Text>
                <Text style={styles.historySub}>{w.method?.toUpperCase()} · {new Date(w.created_at).toLocaleDateString('en-IN')}</Text>
              </View>
              <StatusBadge status={w.status} />
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerCard: { backgroundColor: colors.navy, padding: 24, paddingTop: 52 },
  headerLabel: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerAmount: { fontSize: 36, fontWeight: '800', color: colors.white, marginTop: 6 },
  miniLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 2 },
  miniVal: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  section: { margin: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.t2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  methodRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  methodCard: { flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: colors.border },
  methodCardActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  methodLabel: { fontSize: 12, fontWeight: '700', color: colors.t2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, borderWidth: 2, borderColor: colors.border2, marginBottom: 12 },
  rupeeSign: { paddingHorizontal: 14, fontSize: 18, fontWeight: '700', color: colors.t2 },
  amountInput: { flex: 1, paddingVertical: 14, paddingRight: 16, fontSize: 20, fontWeight: '700', color: colors.t1 },
  tdsCard: { backgroundColor: colors.navyPale, borderRadius: 12, padding: 14, marginBottom: 16 },
  tdsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tdsLabel: { fontSize: 13, color: colors.t2 },
  tdsVal: { fontSize: 13, fontWeight: '600', color: colors.t1 },
  withdrawBtn: { backgroundColor: colors.orange, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  withdrawBtnDisabled: { opacity: 0.5 },
  withdrawBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  historyAmt: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 2 },
  historySub: { fontSize: 11, color: colors.t3, marginBottom: 1 },
});
