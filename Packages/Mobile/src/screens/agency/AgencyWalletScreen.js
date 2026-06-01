import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert, ActivityIndicator } from 'react-native';
import { agencyApi } from '../../services/api';

/**
 * AgencyWalletScreen (Contract 3b) — wallet balance + withdraw form with a
 * TDS 194H (5%) client preview + withdrawal history. Calls /agencies/me/withdraw.
 * The 5% preview is informational; the backend (Contract 3a) computes the
 * authoritative net_paid.
 */

const P = {
  bg: '#FAFAFA', white: '#FFFFFF', ink: '#0A0A0A', muted: '#52525B', muted2: '#71717A',
  muted3: '#A1A1AA', border: '#E4E4E7', border2: '#D4D4D8',
  yellow: '#FFC107', yellowPale: '#FFF7CC', yellow50: '#FFFDEB', yellowText: '#6B5A00',
  tealDeep: '#007A63', danger: '#E8401A',
};
const AGENCY_TDS_PCT = 5; // 194H — preview only; backend is authoritative
const inr2 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';

export default function AgencyWalletScreen() {
  const [agency, setAgency] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [me, wr] = await Promise.all([agencyApi.getMe(), agencyApi.getWithdrawals()]);
    setLoading(false);
    if (me.success) setAgency(me.data?.agency || null);
    if (wr.success) setWithdrawals(wr.data?.withdrawals || []);
  }
  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  const amt = parseFloat(amount || '0');
  const tds = amt ? parseFloat((amt * AGENCY_TDS_PCT / 100).toFixed(2)) : 0;
  const net = amt ? parseFloat((amt - tds).toFixed(2)) : 0;
  const balance = parseFloat(agency?.wallet_balance || 0);

  async function handleWithdraw() {
    if (!amt || amt < 100) { Alert.alert('Minimum ₹100 withdrawal'); return; }
    if (amt > balance) { Alert.alert('Insufficient balance'); return; }
    setSubmitting(true);
    const method_ = method === 'upi' ? 'upi' : 'bank_transfer';
    const res = await agencyApi.withdraw({ amount_requested: amt, method: method_ });
    setSubmitting(false);
    if (res.success) {
      Alert.alert('Withdrawal initiated', `You receive ${inr2(res.data?.net_paid)} (TDS ${inr2(res.data?.tds_deducted)}).`);
      setAmount('');
      load();
    } else {
      Alert.alert('Failed', res.error?.message || 'Withdrawal failed');
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={P.yellow} /></View>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.yellow]} />}>
      <Text style={styles.appTitle}>Wallet</Text>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>AVAILABLE TO WITHDRAW</Text>
        <Text style={styles.heroAmount}>{inr2(balance)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.lbl}>WITHDRAW TO</Text>
        <View style={styles.seg}>
          <TouchableOpacity style={[styles.opt, method === 'upi' && styles.optOn]} onPress={() => setMethod('upi')}><Text style={[styles.optText, method === 'upi' && styles.optTextOn]}>UPI</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.opt, method === 'bank' && styles.optOn]} onPress={() => setMethod('bank')}><Text style={[styles.optText, method === 'bank' && styles.optTextOn]}>Bank</Text></TouchableOpacity>
        </View>
        <Text style={styles.lbl}>AMOUNT</Text>
        <View style={styles.amtInp}>
          <Text style={styles.rs}>₹</Text>
          <TextInput style={styles.amtVal} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={P.muted3} keyboardType="numeric" />
        </View>

        {amt > 0 && (
          <View style={styles.preview}>
            <View style={styles.prow}><Text style={styles.pk}>Requested</Text><Text style={styles.pv}>{inr2(amt)}</Text></View>
            <View style={styles.prow}><Text style={styles.pk}>TDS (194H, {AGENCY_TDS_PCT}%)</Text><Text style={styles.pv}>− {inr2(tds)}</Text></View>
            <View style={[styles.prow, styles.ptot]}><Text style={styles.ptotText}>You receive</Text><Text style={styles.ptotText}>{inr2(net)}</Text></View>
            <Text style={styles.tdsNote}>Agency commission TDS is {AGENCY_TDS_PCT}% (Section 194H), vs 10% for influencers.</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.btn, submitting && { opacity: 0.5 }]} onPress={handleWithdraw} disabled={submitting}>
          <Text style={styles.btnText}>{submitting ? 'Processing…' : 'Withdraw now'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sec}>Recent withdrawals</Text>
      {withdrawals.length === 0 ? (
        <Text style={styles.empty}>No withdrawals yet.</Text>
      ) : (
        withdrawals.map((w) => (
          <View key={w.withdrawal_id} style={styles.wrow}>
            <View>
              <Text style={styles.wamt}>{inr2(w.net_paid)}</Text>
              <Text style={styles.wmeta}>{(w.method === 'upi' ? 'UPI' : 'Bank')} · {fmtDate(w.created_at)}</Text>
            </View>
            <View style={[styles.pill, w.status === 'completed' ? styles.pillDone : styles.pillProc]}>
              <Text style={[styles.pillText, { color: w.status === 'completed' ? '#fff' : P.yellowText }]}>{w.status}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  appTitle: { fontSize: 20, fontWeight: '900', color: P.ink, marginBottom: 12 },
  hero: { backgroundColor: P.ink, borderRadius: 18, padding: 18 },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: P.yellow },
  heroAmount: { fontSize: 32, fontWeight: '900', color: P.white, marginTop: 2 },
  card: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, padding: 16, marginTop: 12 },
  lbl: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: P.muted2, marginBottom: 6 },
  seg: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  opt: { flex: 1, borderWidth: 1.5, borderColor: P.border2, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  optOn: { borderColor: P.ink, backgroundColor: P.ink },
  optText: { fontSize: 13, fontWeight: '700', color: P.muted }, optTextOn: { color: '#fff' },
  amtInp: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: P.border2, borderRadius: 11, paddingHorizontal: 13 },
  rs: { fontSize: 18, fontWeight: '800', color: P.muted2, marginRight: 6 },
  amtVal: { flex: 1, fontSize: 18, fontWeight: '800', color: P.ink, paddingVertical: 12 },
  preview: { backgroundColor: P.yellow50, borderWidth: 1, borderColor: P.yellowPale, borderRadius: 12, padding: 12, marginTop: 12 },
  prow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  pk: { fontSize: 13, color: P.muted }, pv: { fontSize: 13, color: P.ink },
  ptot: { borderTopWidth: 1, borderTopColor: P.yellowPale, marginTop: 5, paddingTop: 7 },
  ptotText: { fontSize: 14, fontWeight: '900', color: P.ink },
  tdsNote: { fontSize: 10.5, color: P.muted2, marginTop: 4 },
  btn: { backgroundColor: P.yellow, borderRadius: 13, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  btnText: { fontSize: 15, fontWeight: '800', color: P.ink },
  sec: { fontSize: 13, fontWeight: '800', color: P.ink, marginTop: 18, marginBottom: 8, marginHorizontal: 4 },
  empty: { fontSize: 12.5, color: P.muted2, marginHorizontal: 4 },
  wrow: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 13, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wamt: { fontSize: 14, fontWeight: '900', color: P.ink }, wmeta: { fontSize: 11, color: P.muted2, marginTop: 1 },
  pill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  pillDone: { backgroundColor: P.tealDeep }, pillProc: { backgroundColor: '#fff', borderWidth: 1, borderColor: P.yellow },
  pillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
});
