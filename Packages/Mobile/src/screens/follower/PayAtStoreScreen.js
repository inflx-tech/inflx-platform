import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';
// Wave 4 PR 4.3 — restaurant bill payments dispatch to the redesigned
// RestaurantBillScreen below.
import RestaurantBillScreen from './RestaurantBillScreen';

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
  const {
    offer, store, trackingParams, brand, tracking, influencer, product, prefillAmount,
    // Q2 flow — when launched from a prebook booking ("Pay Balance via INFLX"),
    // these params come pre-filled. PayAtStoreScreen branches its UX:
    //   · token banner ("you already paid ₹100")
    //   · discount % already known (from booking.at_venue_discount_pct)
    //   · amount_to_pay = (bill − discount) − token
    prebookBookingId,
    tokenPaid,
    atVenueDiscountPct,
  } = route.params || {};

  // Wave 4 PR 4.3 dispatch — restaurants get the new design; other
  // categories continue on the legacy flow below.
  const category = brand?.category || store?.brand_category || null;
  if (category === 'restaurant') {
    return <RestaurantBillScreen route={route} navigation={navigation} />;
  }

  const storeName = store?.brand_name || brand?.name || 'Store';
  const infName = influencer?.name || store?.instagram_handle || '';
  const isPrebookBalance = !!prebookBookingId;

  // Discount %: when balance-paying from a prebook, use the captured at_venue
  // discount (already validated at booking time). Else use the offer's value.
  const discountPct = isPrebookBalance
    ? Number(atVenueDiscountPct || 0)
    : Number(offer?.discount_value || 0);
  const tokenPaidRupees = isPrebookBalance ? Number(tokenPaid || 0) : 0;

  const isKnownAmount = !!prefillAmount && !isPrebookBalance;

  const [billAmount, setBillAmount] = useState(isKnownAmount ? String(prefillAmount) : '');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('enter');
  const [receipt, setReceipt] = useState(null);

  // Q3 corrected math (the user's clarification):
  //   discount_amount  = bill × discountPct / 100   (applied to FULL bill, not remaining)
  //   discounted_total = bill − discount
  //   you_pay          = discounted_total − tokenPaid  (₹0 if no prebook link)
  const billRupees       = parseFloat(billAmount || '0');
  const discountRupees   = parseFloat((billRupees * (discountPct / 100)).toFixed(2));
  const discountedTotal  = parseFloat((billRupees - discountRupees).toFixed(2));
  const youPay           = parseFloat((discountedTotal - tokenPaidRupees).toFixed(2));

  async function handlePay() {
    if (!youPay || youPay < 1) { Alert.alert('Enter a valid amount'); return; }

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

      // Step 1: Create order on backend (amounts in RUPEES)
      // Backend re-computes discount + net independently using offer.service
      // so we don't trust client values — we just send the bill.
      const orderRes = await followerApi.payAtStore({
        campaign_id: trackingData.cid || trackingData.campaign_id,
        set_id: trackingData.sid || trackingData.set_id,
        offer_id: trackingData.oid || trackingData.offer_id || offer?.id,
        campaign_influencer_id: trackingData.iid || trackingData.campaign_influencer_id,
        bill_amount: billRupees,
        product_id: product?.id || null,
        variant_id: product?.variant_id || null,    // fashion attribution
        prebook_booking_id: prebookBookingId || null,   // Q2 flow link
      });

      if (!orderRes.success && !orderRes.data) {
        Alert.alert('Failed', orderRes.error?.message || 'Could not create order');
        setStep('confirm');
        setLoading(false);
        return;
      }

      const orderId = orderRes.data?.razorpay_order_id || orderRes.data?.order_id;

      // Step 2: Process payment (Razorpay or mock) — SDK needs paise at boundary.
      const payResult = await processPayment({
        amount: Math.round(youPay * 100),
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

      // Step 4: Show receipt — all values in rupees.
      setReceipt({
        reference: verifyRes.data?.transaction?.reference_code || 'INFLX-' + Date.now().toString(36).toUpperCase(),
        storeName,
        billAmount: billRupees,
        discount: discountRupees,
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
            <Icon name="check-bold" size={30} color={P.ink} />
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
        <ActivityIndicator size="large" color={P.yellow} />
        <Text style={{ color: P.muted, marginTop: 16, fontSize: 14 }}>Processing payment...</Text>
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
            {infName ? `${infName}'s deal` : 'Influencer deal'}
            {isPrebookBalance ? ' · Balance pay' : (isKnownAmount ? ' · Pre-book' : ' · Walk-in & pay')}
          </Text>
        </View>
      )}

      {/* Q2 — Token-paid banner (when launched from a prebook booking) */}
      {isPrebookBalance && (
        <View style={s.tokenBanner}>
          <Text style={s.tokenBannerIcon}>✓</Text>
          <Text style={s.tokenBannerText}>
            You already paid <Text style={{ fontWeight: '800' }}>₹{tokenPaidRupees.toFixed(0)}</Text> as booking token. Enter the full bill below — we'll apply your discount and subtract the token.
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
            placeholderTextColor={P.muted2}
            editable={!isKnownAmount}
          />
        </View>

        {/* Breakdown \u2014 Q3 corrected math:
              Total bill \u2192 Discount \u2192 Discounted total \u2192 Already paid (if linked) \u2192 You pay */}
        {billRupees > 0 && (
          <View style={s.breakdown}>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>{isPrebookBalance ? 'Total Bill' : (isKnownAmount ? 'Service Price' : 'Bill Amount')}</Text>
              <Text style={s.breakdownVal}>{fmtMoney(billRupees)}</Text>
            </View>
            {discountPct > 0 && (
              <>
                <View style={s.breakdownRow}>
                  <Text style={s.breakdownLabel}>Discount ({discountPct}%)</Text>
                  <Text style={[s.breakdownVal, { color: P.successText }]}>- {fmtMoney(discountRupees)}</Text>
                </View>
                <View style={s.breakdownRow}>
                  <Text style={[s.breakdownLabel, { fontWeight: '700', color: P.ink }]}>Discounted Total</Text>
                  <Text style={[s.breakdownVal, { fontWeight: '700' }]}>{fmtMoney(discountedTotal)}</Text>
                </View>
                {isPrebookBalance && tokenPaidRupees > 0 && (
                  <View style={s.breakdownRow}>
                    <Text style={s.breakdownLabel}>Token already paid</Text>
                    <Text style={[s.breakdownVal, { color: P.yellowText }]}>- {fmtMoney(tokenPaidRupees)}</Text>
                  </View>
                )}
                <View style={s.savingsRow}>
                  <Text style={s.savingsText}>\u2713 You save {fmtMoney(discountRupees)} on this bill</Text>
                </View>
              </>
            )}
            <View style={[s.breakdownRow, s.totalRow]}>
              <Text style={s.totalLabel}>You Pay Now</Text>
              <Text style={s.totalVal}>{fmtMoney(youPay)}</Text>
            </View>
          </View>
        )}

        {/* Pay button */}
        <TouchableOpacity
          style={[s.payBtn, (loading || youPay < 1) && s.payBtnDisabled]}
          onPress={handlePay}
          disabled={loading || youPay < 1}
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
      <Text style={[rs.label, bold && { fontWeight: '700', color: P.ink }]}>{label}</Text>
      <Text style={[
        rs.value,
        green && { color: P.successText },
        amber && { color: P.yellowText },
        bold && { fontSize: 16, fontWeight: '800' },
      ]}>{value}</Text>
    </View>
  );
}

const rs = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 12, color: P.muted },
  value: { fontSize: 12, fontWeight: '600', color: P.ink },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  header: { backgroundColor: P.ink, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '700', fontFamily: fonts.monoBold },
  title: { fontSize: 20, fontWeight: '900', color: P.white, fontFamily: fonts.displayBlack },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '700', fontFamily: fonts.monoMedium },
  dealCard: {
    marginHorizontal: 16, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: P.yellowPale, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#F0DA88',
  },
  dealBadge: { backgroundColor: P.ink, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dealBadgeText: { fontSize: 11, fontWeight: '900', color: P.yellow, fontFamily: fonts.monoBold },
  dealInfo: { fontSize: 11, color: P.yellowText, fontWeight: '800', fontFamily: fonts.monoBold },
  // Q2 token banner
  tokenBanner: {
    marginHorizontal: 16, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: P.successPale, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#A8E6CC',
  },
  tokenBannerIcon: { fontSize: 22, color: P.successText, fontWeight: '900' },
  tokenBannerText: { flex: 1, fontSize: 11, color: P.ink, lineHeight: 15 },
  card: {
    margin: 16, backgroundColor: P.white, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: P.border,
  },
  label: { fontSize: 13, fontWeight: '700', color: P.muted, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: P.border, borderRadius: 14, marginBottom: 20,
    backgroundColor: P.white,
  },
  rupee: { paddingHorizontal: 16, fontSize: 22, fontWeight: '700', color: P.muted },
  input: { flex: 1, paddingVertical: 16, paddingRight: 16, fontSize: 28, fontWeight: '800', color: P.ink },
  breakdown: {
    backgroundColor: P.bg2, borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: P.border,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { fontSize: 14, color: P.muted },
  breakdownVal: { fontSize: 14, fontWeight: '600', color: P.ink },
  savingsRow: { marginBottom: 8 },
  savingsText: { fontSize: 11, fontWeight: '700', color: P.successText },
  totalRow: { borderTopWidth: 1, borderTopColor: P.border, paddingTop: 10, marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: P.ink },
  totalVal: { fontSize: 20, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  payBtn: { backgroundColor: P.ink, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginBottom: 12 },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { fontSize: 15, fontWeight: '900', color: P.yellow, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
  methodsRow: { alignItems: 'center', marginBottom: 12 },
  methodsText: { fontSize: 10, color: P.muted2 },
  note: { fontSize: 11, color: P.muted2, textAlign: 'center', lineHeight: 18 },
  // Success
  successCard: { margin: 16, marginTop: 80, backgroundColor: P.white, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: P.border, alignItems: 'center' },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: P.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '900', color: P.ink, marginBottom: 4, fontFamily: fonts.displayBlack },
  successRef: { fontSize: 12, color: P.yellowText, fontWeight: '800', marginBottom: 20, fontFamily: fonts.monoBold },
  receiptBox: { width: '100%', backgroundColor: P.bg2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: P.border, marginBottom: 20 },
  receiptDivider: { height: 1, backgroundColor: P.border, marginVertical: 6 },
  doneBtn: { backgroundColor: P.ink, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  doneBtnText: { fontSize: 14, fontWeight: '900', color: P.yellow, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
});
