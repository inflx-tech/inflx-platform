import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function PayAtStoreScreen({ navigation, route }) {
  const { offer, store, trackingParams } = route.params || {};
  const [billAmount, setBillAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const billPaise = Math.round(parseFloat(billAmount || '0') * 100);
  const discountPct = offer?.discount_value || 0;
  const discountPaise = Math.round(billPaise * (discountPct / 100));
  const youPay = billPaise - discountPaise;

  async function handlePay() {
    if (billPaise < 100) { Alert.alert('Enter a valid bill amount'); return; }
    setLoading(true);
    const res = await followerApi.payAtStore({
      campaign_id: trackingParams?.cid,
      set_id: trackingParams?.sid,
      offer_id: trackingParams?.oid,
      campaign_influencer_id: null,
      original_bill_amount: billPaise,
      discount_applied: discountPaise,
      net_amount: youPay,
      transaction_type: 'pay_at_store',
    });
    setLoading(false);
    if (res.success) {
      Alert.alert('Payment Successful! 🎉', `Reference: ${res.data?.transaction?.reference_code || 'TXN' + Date.now()}`, [
        { text: 'Done', onPress: () => navigation.goBack() }
      ]);
    } else {
      Alert.alert('Payment Failed', res.error?.message || 'Please try again');
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pay at {store?.brand_name}</Text>
        <Text style={styles.sub}>via @{store?.instagram_handle}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Enter Your Bill Amount (₹)</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.input}
            value={billAmount}
            onChangeText={setBillAmount}
            keyboardType="numeric"
            placeholder="500"
            placeholderTextColor={colors.t3}
          />
        </View>

        {billPaise > 0 && (
          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Bill Amount</Text>
              <Text style={styles.breakdownVal}>{fmtMoney(billPaise)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Discount ({discountPct}%)</Text>
              <Text style={[styles.breakdownVal, { color: colors.teal }]}>- {fmtMoney(discountPaise)}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>You Pay</Text>
              <Text style={styles.totalVal}>{fmtMoney(youPay)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.payBtn, (loading || billPaise < 100) && styles.payBtnDisabled]}
          onPress={handlePay}
          disabled={loading || billPaise < 100}
        >
          <Text style={styles.payBtnText}>{loading ? 'Processing...' : `Pay ${billPaise > 0 ? fmtMoney(youPay) : ''}`}</Text>
        </TouchableOpacity>

        <Text style={styles.commissionNote}>💡 A small commission goes to @{store?.instagram_handle} for the referral</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  card: { margin: 16, backgroundColor: colors.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 13, fontWeight: '700', color: colors.t2, marginBottom: 10 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border2, borderRadius: 14, marginBottom: 20 },
  rupee: { paddingHorizontal: 16, fontSize: 22, fontWeight: '700', color: colors.t2 },
  input: { flex: 1, paddingVertical: 16, paddingRight: 16, fontSize: 28, fontWeight: '800', color: colors.t1 },
  breakdown: { backgroundColor: colors.surface2, borderRadius: 12, padding: 14, marginBottom: 20 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { fontSize: 14, color: colors.t2 },
  breakdownVal: { fontSize: 14, fontWeight: '600', color: colors.t1 },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.t1 },
  totalVal: { fontSize: 20, fontWeight: '800', color: colors.orange },
  payBtn: { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },
  commissionNote: { fontSize: 11, color: colors.t3, textAlign: 'center', lineHeight: 18 },
});
