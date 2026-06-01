import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim. Visual only; booking/pay logic unchanged.
const P = {
  white: C.card, black: C.ink, bg: C.screenBg, bg2: C.soft,
  ink: C.ink, ink2: C.ink, muted: C.muted, muted2: C.muted, muted3: C.muted, muted4: C.line,
  border: C.line, borderSoft: C.line,
  yellow: C.brown, yellowHover: C.brownDark, yellowPale: C.soft, yellow50: C.soft, yellowText: C.brown,
  success: '#1E9E5A', successPale: C.soft, successText: '#1E9E5A',
  danger: C.offer, dangerPale: C.soft, dangerText: C.offer,
  conv: C.brown, convPale: C.soft, eng: C.verify, engPale: C.soft, hyb: C.brown, hybPale: C.soft, info: C.verify, infoPale: C.soft,
};
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';

// Car wayfinding tint (car-rental) — getBusinessAccentLight('car_rental').pale
const CAR_PALE = '#DBEAFE';

/**
 * CarBookingScreen — pre-booking confirmation screen matching the follower app mockup.
 *
 * Shows: mini car card, date picker, duration selector, pickup type,
 * price breakdown with influencer discount, token payment CTA.
 */

export default function CarBookingScreen({ navigation, route }) {
  const { vehicle, pricing, discount, tracking, pickupType: initialPickup } = route.params || {};
  const [duration, setDuration] = useState(2);
  const [pickupType, setPickupType] = useState(initialPickup || 'garage');
  const [loading, setLoading] = useState(false);

  const dayRate = pricing?.day_rate || 1800;
  const discountPct = discount?.value || 0;
  const driverAllowance = 300;
  const tokenAmount = 300;

  const baseTotal = duration * dayRate;
  const discountAmount = Math.round(baseTotal * discountPct / 100);
  const driverTotal = duration * driverAllowance;
  const doorstepFee = pickupType === 'doorstep' ? 200 : 0;
  const totalTrip = baseTotal - discountAmount + driverTotal + doorstepFee;
  const balance = totalTrip - tokenAmount;

  async function handlePay() {
    // Check if logged in — payments require auth
    const token = await AsyncStorage.getItem('inflx_token');
    if (!token) {
      Alert.alert(
        'Sign In Required',
        'You need to sign in to make bookings. It only takes 30 seconds!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('FollowerLogin') },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      // Compute pickup + return dates from local state. Pickup defaults to
      // tomorrow (matches the legacy behavior); return is pickup + duration.
      const pickupDateObj = new Date(Date.now() + 86400000);
      const returnDateObj = new Date(pickupDateObj.getTime() + duration * 86400000);
      const pickupDate = pickupDateObj.toISOString().split('T')[0];
      const returnDate = returnDateObj.toISOString().split('T')[0];

      // Step 1: Create order on backend via the date-range endpoint
      // (replaces the legacy shoehorn that crammed duration + pickup into
      // /follower/prebook's `notes` string — see contracts-v1.2.md §6).
      const res = await followerApi.prebookDateRange({
        campaign_id: tracking?.campaign_id,
        set_id: tracking?.set_id,
        offer_id: tracking?.offer_id || null,
        campaign_influencer_id: tracking?.campaign_influencer_id,
        // Phase Salon-3 Q3 — explicit product attribution. Forwarded when the
        // upstream screen (CarDetailScreen, HomeScreenV2 car tile) included
        // vehicle.id in the route param; null otherwise. Backend falls back
        // to offer.products_json single-product resolution either way.
        product_id: vehicle?.id || vehicle?.product_id || null,
        pickup_date: pickupDate,
        return_date: returnDate,
        duration_days: duration,
        pickup_type: pickupType,
      });

      if (!res.success && !res.data) {
        Alert.alert('Booking Failed', res.error?.message || 'Please try again');
        setLoading(false);
        return;
      }

      const orderId = res.data?.razorpay_order_id;
      const keyId = res.data?.razorpay_key_id;
      const advanceRupees = res.data?.advance_amount || tokenAmount;   // backend sends rupees

      // Step 2: Open Razorpay checkout (Razorpay SDK expects paise)
      const payResult = await processPayment({
        amount: Math.round(advanceRupees * 100),
        orderId,
        keyId,
        description: `Pre-book ${vehicle?.name}`,
        brandName: 'INFLX Car Rental',
      });

      if (!payResult) {
        Alert.alert('Payment Cancelled', 'You can try again anytime.');
        setLoading(false);
        return;
      }

      // Step 3: Verify payment on backend
      const verifyRes = await followerApi.prebookDateRangeVerify({
        razorpay_order_id: payResult.razorpay_order_id,
        razorpay_payment_id: payResult.razorpay_payment_id,
        razorpay_signature: payResult.razorpay_signature,
      });

      if (verifyRes.success || verifyRes.data) {
        // Use server's authoritative advance_paid from the verify response —
        // local tokenAmount is the pre-payment estimate; the server's value is
        // what was actually charged + recorded against the booking. Local
        // `balance` (trip cost - token) is kept since the server doesn't
        // compute trip-level cost.
        const paidRupees = verifyRes.data?.advance_paid ?? tokenAmount;
        Alert.alert('Booking Confirmed! 🎉', `Token ${fmtRupees(paidRupees)} paid. Balance ${fmtRupees(balance)} at ${pickupType}.`, [
          { text: 'Done', onPress: () => navigation.popToTop() },
        ]);
      } else {
        Alert.alert('Verification Failed', verifyRes.error?.message || 'Payment received but verification failed. Contact support.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBack}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Pre-booking</Text>
        <View style={{ width: 15 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Mini car card */}
        <View style={styles.miniCard}>
          <View style={styles.miniImg}>
            <Text style={{ fontSize: 32 }}>🚗</Text>
          </View>
          <View>
            <Text style={styles.miniName}>{vehicle?.name}</Text>
            <Text style={styles.miniSub}>{vehicle?.year} · With Driver · {vehicle?.specs?.seats || 5} seats</Text>
            {discount?.influencer_name && (
              <Text style={styles.miniOffer}>{discount.influencer_name}'s deal · {discountPct}% OFF applied</Text>
            )}
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select dates</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateLbl}>Pick up</Text>
              <Text style={styles.dateVal}>Apr 10</Text>
              <Text style={styles.dateDay}>Thu · 10:00 AM</Text>
            </View>
            <Text style={styles.dateArrow}>→</Text>
            <View style={[styles.dateBox, styles.dateBoxActive]}>
              <Text style={styles.dateLbl}>Return</Text>
              <Text style={[styles.dateVal, { color: P.ink }]}>Apr {10 + duration}</Text>
              <Text style={styles.dateDay}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][(4 + duration) % 7]} · 10:00 AM</Text>
            </View>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.durRow}>
            <TouchableOpacity style={styles.durBtn} onPress={() => setDuration(d => Math.max(1, d - 1))}>
              <Text style={styles.durBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.durVal}>{duration} day{duration > 1 ? 's' : ''}</Text>
            <TouchableOpacity style={styles.durBtn} onPress={() => setDuration(d => Math.min(14, d + 1))}>
              <Text style={styles.durBtnText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.durLabel}>= {fmtRupees(baseTotal - discountAmount)} base</Text>
          </View>
        </View>

        {/* Pickup type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pickup type</Text>
          <View style={styles.pickupRow}>
            <TouchableOpacity style={[styles.pickupOpt, pickupType === 'garage' && styles.pickupOn]} onPress={() => setPickupType('garage')}>
              <Text style={styles.pickupTitle}>Garage pickup</Text>
              <Text style={styles.pickupSub}>Free · {vehicle?.location || 'Rental location'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pickupOpt, pickupType === 'doorstep' && styles.pickupOn]} onPress={() => setPickupType('doorstep')}>
              <Text style={styles.pickupTitle}>Doorstep</Text>
              <Text style={[styles.pickupSub, { color: P.yellowText }]}>+₹200 · Your address</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Price breakdown */}
        <View style={styles.priceBox}>
          <Text style={styles.priceBoxTitle}>Price breakdown</Text>
          <PriceRow label={`${duration} × ${fmtRupees(dayRate)}`} value={fmtRupees(baseTotal)} />
          {discountPct > 0 && <PriceRow label={`${discount?.influencer_name}'s ${discountPct}% offer`} value={`−${fmtRupees(discountAmount)}`} green />}
          <PriceRow label="Driver allowance" value={fmtRupees(driverTotal)} />
          {doorstepFee > 0 && <PriceRow label="Doorstep delivery" value={fmtRupees(doorstepFee)} />}
          <PriceRow label="Total trip cost" value={fmtRupees(totalTrip)} big />
          <PriceRow label="Token now" value={fmtRupees(tokenAmount)} amber />
          <PriceRow label="Balance at garage" value={fmtRupees(balance)} />
        </View>

        {/* Pay hero */}
        <View style={styles.payHero}>
          <View>
            <Text style={styles.payHeroLabel}>Pay now to lock this booking</Text>
            <Text style={styles.payHeroAmount}>{fmtRupees(tokenAmount)}</Text>
            <Text style={styles.payHeroSub}>Fully refundable · Balance at garage</Text>
          </View>
          <Text style={styles.payHeroRight}>UPI · Cards{'\n'}Accepted</Text>
        </View>

        {/* Pay CTA */}
        <View style={styles.payCTAWrap}>
          <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={loading}>
            <Text style={styles.payBtnText}>{loading ? 'Processing...' : `Pay ${fmtRupees(tokenAmount)} via UPI`}</Text>
            <Text style={{ fontSize: 14, color: P.yellow }}>→</Text>
          </TouchableOpacity>
          <Text style={styles.payNote}>Secured by INFLX · Token is 100% refundable on cancellation 24hrs prior to pickup</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PriceRow({ label, value, green, amber, big }) {
  return (
    <View style={[prStyles.row, big && prStyles.rowBig]}>
      <Text style={[prStyles.label, big && { fontFamily: fonts.sansBold, color: P.ink }]}>{label}</Text>
      <Text style={[
        prStyles.value,
        green && { color: P.successText },
        amber && { color: P.yellowText },
        big && { fontSize: 15, color: P.ink, fontFamily: fonts.monoBold },
      ]}>{value}</Text>
    </View>
  );
}

const prStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  rowBig: { borderBottomWidth: 0, paddingTop: 9, marginTop: 4 },
  label: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.muted },
  value: { fontFamily: fonts.monoBold, fontSize: 12, color: P.ink },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  // ink hero header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 13, backgroundColor: P.ink },
  headerBack: { fontSize: 18, color: '#FFFFFF', fontWeight: '600' },
  headerTitle: { fontFamily: fonts.displayBlack, fontSize: 15, color: '#FFFFFF' },
  miniCard: { margin: 12, marginHorizontal: 16, backgroundColor: P.white, borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: P.border },
  miniImg: { width: 76, height: 50, borderRadius: 8, backgroundColor: CAR_PALE, alignItems: 'center', justifyContent: 'center' },
  miniName: { fontFamily: fonts.displayBold, fontSize: 13, color: P.ink },
  miniSub: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2, marginTop: 2 },
  miniOffer: { fontFamily: fonts.monoBold, fontSize: 10, color: P.yellowText, marginTop: 4 },
  section: { paddingHorizontal: 16, marginBottom: 13 },
  sectionLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dateBox: { flex: 1, backgroundColor: P.white, borderWidth: 1.5, borderColor: P.border, borderRadius: 11, padding: 11 },
  dateBoxActive: { borderColor: P.ink },
  dateLbl: { fontFamily: fonts.monoMedium, fontSize: 9, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  dateVal: { fontFamily: fonts.monoBold, fontSize: 13, color: P.ink },
  dateDay: { fontFamily: fonts.monoMedium, fontSize: 9, color: P.muted2, marginTop: 1 },
  dateArrow: { color: P.muted3, fontSize: 16, fontWeight: '300' },
  durRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  durBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: P.bg2, borderWidth: 1.5, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  durBtnText: { fontFamily: fonts.displayBold, fontSize: 17, color: P.ink },
  durVal: { fontFamily: fonts.monoBold, fontSize: 17, color: P.ink, minWidth: 52, textAlign: 'center' },
  durLabel: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2 },
  pickupRow: { flexDirection: 'row', gap: 8 },
  pickupOpt: { flex: 1, backgroundColor: P.white, borderWidth: 1.5, borderColor: P.border, borderRadius: 10, padding: 9 },
  pickupOn: { borderColor: P.ink },
  pickupTitle: { fontFamily: fonts.sansBold, fontSize: 11, color: P.ink },
  pickupSub: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2, marginTop: 2 },
  priceBox: { marginHorizontal: 16, marginBottom: 12, backgroundColor: P.white, borderRadius: 13, padding: 13, borderWidth: 1, borderColor: P.border },
  priceBoxTitle: { fontFamily: fonts.monoBold, fontSize: 10, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 9 },
  payHero: { marginHorizontal: 16, marginBottom: 14, backgroundColor: P.yellowPale, borderWidth: 1, borderColor: '#F0DA88', borderRadius: 13, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payHeroLabel: { fontFamily: fonts.sansMedium, fontSize: 10, color: P.muted, marginBottom: 2 },
  payHeroAmount: { fontFamily: fonts.monoBold, fontSize: 24, color: P.ink },
  payHeroSub: { fontFamily: fonts.sansMedium, fontSize: 10, color: P.muted2, marginTop: 2 },
  payHeroRight: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2, textAlign: 'right', lineHeight: 15 },
  payCTAWrap: { paddingHorizontal: 16, paddingBottom: 28 },
  payBtn: { backgroundColor: P.ink, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  payBtnText: { fontFamily: fonts.displayBlack, fontSize: 15, color: P.yellow },
  payNote: { textAlign: 'center', marginTop: 9, fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted3 },
});
