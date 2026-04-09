import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { darkColors, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function PayAtStoreScreen({ navigation, route }) {
  const { offer, store, trackingParams, brand, tracking, influencer } = route.params || {};
  const [billAmount, setBillAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const storeName = store?.brand_name || brand?.name || 'Store';
  const infHandle = store?.instagram_handle || influencer?.handle || '';
  const discountPct = offer?.discount_value || 0;

  const billPaise = Math.round(parseFloat(billAmount || '0') * 100);
  const discountPaise = Math.round(billPaise * (discountPct / 100));
  const youPay = billPaise - discountPaise;

  async function handlePay() {
    if (billPaise < 100) { Alert.alert('Enter a valid bill amount'); return; }
    setLoading(true);
    const trackingData = trackingParams || tracking || {};
    const res = await followerApi.payAtStore({
      campaign_id: trackingData.cid || trackingData.campaign_id,
      set_id: trackingData.sid || trackingData.set_id,
      offer_id: trackingData.oid || trackingData.offer_id || offer?.id,
      campaign_influencer_id: trackingData.campaign_influencer_id || null,
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pay at {storeName}</Text>
        {infHandle ? <Text style={styles.sub}>via @{infHandle}</Text> : null}
      </View>

      {/* Deal info card */}
      {discountPct > 0 && (
        <View style={styles.dealCard}>
          <View style={styles.dealBadge}>
            <Text style={styles.dealBadgeText}>{discountPct}% OFF</Text>
          </View>
          <Text style={styles.dealInfo}>
            {influencer?.name ? `${influencer.name}'s deal` : 'Influencer deal'} · Walk-in & pay
          </Text>
        </View>
      )}

      {/* Main card */}
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
            placeholderTextColor={darkColors.textMuted}
          />
        </View>

        {billPaise > 0 && (
          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Bill Amount</Text>
              <Text style={styles.breakdownVal}>{fmtMoney(billPaise)}</Text>
            </View>
            {discountPct > 0 && (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Discount ({discountPct}%)</Text>
                  <Text style={[styles.breakdownVal, { color: darkColors.green }]}>- {fmtMoney(discountPaise)}</Text>
                </View>
                <View style={styles.savingsRow}>
                  <Text style={styles.savingsText}>✓ You save {fmtMoney(discountPaise)}</Text>
                </View>
              </>
            )}
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
          <Text style={styles.payBtnText}>{loading ? 'Processing...' : `Pay ${billPaise > 0 ? fmtMoney(youPay) : ''} via UPI`}</Text>
        </TouchableOpacity>

        <Text style={styles.commissionNote}>💡 A small commission goes to the influencer for the referral</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg },
  header: { backgroundColor: darkColors.bg2, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: darkColors.textSecondary, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: darkColors.text },
  sub: { fontSize: 12, color: darkColors.textMuted, marginTop: 4 },
  dealCard: {
    marginHorizontal: 16, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: darkColors.amberDim, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: darkColors.borderAccent,
  },
  dealBadge: {
    backgroundColor: darkColors.amber, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  dealBadgeText: { fontSize: 12, fontWeight: '800', color: '#000' },
  dealInfo: { fontSize: 11, color: darkColors.amber, fontWeight: '600' },
  card: {
    margin: 16, backgroundColor: darkColors.card, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: darkColors.border,
  },
  label: { fontSize: 13, fontWeight: '700', color: darkColors.textSecondary, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: darkColors.border, borderRadius: 14, marginBottom: 20,
    backgroundColor: darkColors.input,
  },
  rupee: { paddingHorizontal: 16, fontSize: 22, fontWeight: '700', color: darkColors.textSecondary },
  input: { flex: 1, paddingVertical: 16, paddingRight: 16, fontSize: 28, fontWeight: '800', color: darkColors.text },
  breakdown: {
    backgroundColor: darkColors.bg2, borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: darkColors.border,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { fontSize: 14, color: darkColors.textSecondary },
  breakdownVal: { fontSize: 14, fontWeight: '600', color: darkColors.text },
  savingsRow: { marginBottom: 8 },
  savingsText: { fontSize: 11, fontWeight: '700', color: darkColors.green },
  totalRow: { borderTopWidth: 1, borderTopColor: darkColors.border, paddingTop: 10, marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: darkColors.text },
  totalVal: { fontSize: 20, fontWeight: '800', color: darkColors.amber },
  payBtn: { backgroundColor: darkColors.amber, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  commissionNote: { fontSize: 11, color: darkColors.textMuted, textAlign: 'center', lineHeight: 18 },
});
