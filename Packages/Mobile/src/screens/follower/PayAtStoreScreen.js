import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';

/**
 * PayAtStoreScreen — unified payment screen for two flows:
 *
 * 1. KNOWN AMOUNT (pre-book car ₹300, salon ₹500):
 *    → Amount pre-filled → show discount → Pay button → UPI/Razorpay
 *
 * 2. UNKNOWN AMOUNT (dine at restaurant, shop at fashion store):
 *    → Enter bill amount → calculate discount → show breakdown → Pay → UPI/Razorpay
 */

export default function PayAtStoreScreen({ navigation, route }) {
  const { offer, store, trackingParams, brand, tracking, influencer, product, prefillAmount } = route.params || {};

  const storeName = store?.brand_name || brand?.name || 'Store';
  const infName = influencer?.name || store?.instagram_handle || '';
  const discountPct = offer?.discount_value || 0;
  const isKnownAmount = !!prefillAmount;

  const [billAmount, setBillAmount] = useState(isKnownAmount ? String(prefillAmount / 100) : '');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('enter'); // 'enter' | 'confirm' | 'processing' | 'success'
  const [receipt, setReceipt] = useState(null);

  const billPaise = Math.round(parseFloat(billAmount || '0') * 100);
  const discountPaise = Math.round(billPaise * (discountPct / 100));
  const youPay = billPaise - discountPaise;

  async function handlePay() {
    if (youPay < 100) { Alert.alert('Enter a valid amount'); return; }

    // Check if logged in — payments require auth
    const token = await AsyncStorage.getItem('inflx_token');
    if (!token) {
      Alert.alert(
        'Sign In Required',
        'You need to sign in to make payments. It only takes 30 seconds!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('FollowerLogin') },
        ]
      );
      return;
    }

    setStep('processing');
    setLoading(true);

    try {
      const trackingData = trackingParams || tracking || {};

      // Step 1: Create order on backend
      const orderRes = await followerApi.payAtStore({
        campaign_id: trackingData.cid || trackingData.campaign_id,
        set_id: trackingData.sid || trackingData.set_id,
        offer_id: trackingData.oid || trackingData.offer_id || offer?.id,
        campaign_influencer_id: trackingData.iid || trackingData.campaign_influencer_id,
        original_bill_amount: billPaise,
        discount_applied: discountPaise,
        net_amount: youPay,
        transaction_type: 'pay_at_store',
        product_id: product?.id || null,
      });

      if (!orderRes.success && !orderRes.data) {
        Alert.alert('Failed', orderRes.error?.message || 'Could not create order');
        setStep('confirm');
        setLoading(false);
        return;
      }

      const orderId = orderRes.data?.razorpay_order_id || orderRes.data?.order_id;

      // Step 2: Process payment (Razorpay or mock)
      const payResult = await processPayment({
        amount: youPay,
        orderId,
        description: `Payment at ${storeName}`,
        brandName: storeName,
      });

      if (!payResult) {
        // User cancelled
        setStep('confirm');
        setLoading(false);
        return;
      }

      // Step 3: Verify payment on backend
      const verifyEndpoint = orderRes.data?.verify_endpoint || '/follower/pay-at-store/verify';
      const verifyRes = await followerApi.verifyPayAtStore
        ? followerApi.verifyPayAtStore({
            razorpay_order_id: payResult.razorpay_order_id,
            razorpay_payment_id: payResult.razorpay_payment_id,
            razorpay_signature: payResult.razorpay_signature,
          })
        : { success: true, data: { transaction: { reference_code: 'INFLX-' + Date.now().toString(36).toUpperCase() } } };

      // Step 4: Show receipt
      setReceipt({
        reference: verifyRes.data?.transaction?.reference_code || 'INFLX-' + Date.now().toString(36).toUpperCase(),
        storeName,
        billAmount: billPaise,
        discount: discountPaise,
        discountPct,
        amountPaid: youPay,
        influencer: infName,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      });
      setStep('success');
    } catch (e) {
      Alert.alert('Payment Error', e.message || 'Something went wrong');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  }

  // ── Success / Receipt Screen ───────────────────────────────────────────────
  if (step === 'success' && receipt) {
    return (
      <ScrollView style={s.container}>
        <View style={s.successCard}>
          <View style={s.successIcon}>
            <Text style={{ fontSize: 32 }}>✅</Text>
          </View>
          <Text style={s.successTitle}>Payment Successful!</Text>
          <Text style={s.successRef}>Ref: {receipt.reference}</Text>

          <View style={s.receiptBox}>
            <ReceiptRow label="Store" value={receipt.storeName} />
            <ReceiptRow label="Date" value={receipt.date} />
            <ReceiptRow label="Bill Amount" value={fmtMoney(receipt.billAmount)} />
            {receipt.discountPct > 0 && (
              <ReceiptRow label={`Discount (${receipt.discountPct}%)`} value={`-${fmtMoney(receipt.discount)}`} green />
            )}
            <View style={s.receiptDivider} />
            <ReceiptRow label="Amount Paid" value={fmtMoney(receipt.amountPaid)} bold amber />
            {receipt.influencer && <ReceiptRow label="Via influencer" value={receipt.influencer} />}
          </View>

          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.popToTop()}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Processing Screen ──────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={darkColors.amber} />
        <Text style={{ color: darkColors.textSecondary, marginTop: 16, fontSize: 14 }}>Processing payment...</Text>
      </View>
    );
  }

  // ── Enter / Confirm Screen ─────────────────────────────────────────────────
  return (
    <ScrollView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Pay at {storeName}</Text>
        {infName ? <Text style={s.sub}>via {infName}'s deal</Text> : null}
      </View>

      {/* Deal info */}
      {discountPct > 0 && (
        <View style={s.dealCard}>
          <View style={s.dealBadge}>
            <Text style={s.dealBadgeText}>{discountPct}% OFF</Text>
          </View>
          <Text style={s.dealInfo}>
            {infName ? `${infName}'s deal` : 'Influencer deal'} · {isKnownAmount ? 'Pre-book' : 'Walk-in & pay'}
          </Text>
        </View>
      )}

      {/* Amount entry */}
      <View style={s.card}>
        <Text style={s.label}>{isKnownAmount ? 'Amount to Pay' : 'Enter Your Bill Amount (₹)'}</Text>
        <View style={s.inputWrap}>
          <Text style={s.rupee}>₹</Text>
          <TextInput
            style={s.input}
            value={billAmount}
            onChangeText={setBillAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={darkColors.textMuted}
            editable={!isKnownAmount}
          />
        </View>

        {/* Breakdown */}
        {billPaise > 0 && (
          <View style={s.breakdown}>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>{isKnownAmount ? 'Service Price' : 'Bill Amount'}</Text>
              <Text style={s.breakdownVal}>{fmtMoney(billPaise)}</Text>
            </View>
            {discountPct > 0 && (
              <>
                <View style={s.breakdownRow}>
                  <Text style={s.breakdownLabel}>Discount ({discountPct}%)</Text>
                  <Text style={[s.breakdownVal, { color: darkColors.green }]}>- {fmtMoney(discountPaise)}</Text>
                </View>
                <View style={s.savingsRow}>
                  <Text style={s.savingsText}>✓ You save {fmtMoney(discountPaise)}</Text>
                </View>
              </>
            )}
            <View style={[s.breakdownRow, s.totalRow]}>
              <Text style={s.totalLabel}>You Pay</Text>
              <Text style={s.totalVal}>{fmtMoney(youPay)}</Text>
            </View>
          </View>
        )}

        {/* Pay button */}
        <TouchableOpacity
          style={[s.payBtn, (loading || youPay < 100) && s.payBtnDisabled]}
          onPress={handlePay}
          disabled={loading || youPay < 100}
        >
          <Text style={s.payBtnText}>
            {loading ? 'Processing...' : `Pay ${youPay > 0 ? fmtMoney(youPay) : ''} via UPI`}
          </Text>
        </TouchableOpacity>

        {/* Payment methods hint */}
        <View style={s.methodsRow}>
          <Text style={s.methodsText}>UPI · Google Pay · PhonePe · Cards · Netbanking</Text>
        </View>

        <Text style={s.note}>💡 Payment processed securely via INFLX · Razorpay</Text>
      </View>
    </ScrollView>
  );
}

function ReceiptRow({ label, value, green, bold, amber }) {
  return (
    <View style={rs.row}>
      <Text style={[rs.label, bold && { fontWeight: '700', color: darkColors.text }]}>{label}</Text>
      <Text style={[
        rs.value,
        green && { color: darkColors.green },
        amber && { color: darkColors.amber },
        bold && { fontSize: 16, fontWeight: '800' },
      ]}>{value}</Text>
    </View>
  );
}

const rs = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 12, color: darkColors.textSecondary },
  value: { fontSize: 12, fontWeight: '600', color: darkColors.text },
});

const s = StyleSheet.create({
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
  dealBadge: { backgroundColor: darkColors.amber, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
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
  methodsRow: { alignItems: 'center', marginBottom: 12 },
  methodsText: { fontSize: 10, color: darkColors.textMuted },
  note: { fontSize: 11, color: darkColors.textMuted, textAlign: 'center', lineHeight: 18 },
  // Success
  successCard: { margin: 16, marginTop: 80, backgroundColor: darkColors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: darkColors.border, alignItems: 'center' },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: darkColors.text, marginBottom: 4 },
  successRef: { fontSize: 12, color: darkColors.amber, fontWeight: '600', marginBottom: 20 },
  receiptBox: { width: '100%', backgroundColor: darkColors.bg2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: darkColors.border, marginBottom: 20 },
  receiptDivider: { height: 1, backgroundColor: darkColors.border, marginVertical: 6 },
  doneBtn: { backgroundColor: darkColors.amber, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  doneBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
});
