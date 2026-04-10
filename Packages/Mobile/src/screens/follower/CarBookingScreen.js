import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';

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
      const res = await followerApi.prebook({
        campaign_id: tracking?.campaign_id,
        set_id: tracking?.set_id,
        offer_id: tracking?.offer_id,
        campaign_influencer_id: tracking?.campaign_influencer_id,
        booking_date: '2026-04-10',
        booking_time: '10:00 AM',
        guest_count: 1,
        notes: `${vehicle?.name} · ${duration} day(s) · ${pickupType} pickup`,
      });
      if (res.success || res.data) {
        const verifyRes = await followerApi.prebookVerify({
          razorpay_order_id: res.data?.razorpay_order_id || 'mock_order',
          razorpay_payment_id: 'mock_pay_' + Date.now(),
        });
        Alert.alert('Booking Confirmed! 🎉', `Token ₹${tokenAmount} paid. Balance ${fmtRupees(balance)} at ${pickupType}.`, [
          { text: 'Done', onPress: () => navigation.popToTop() },
        ]);
      } else {
        Alert.alert('Booking Failed', res.error?.message || 'Please try again');
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
              <Text style={[styles.dateVal, { color: '#F59E0B' }]}>Apr {10 + duration}</Text>
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
              <Text style={[styles.pickupSub, { color: '#F59E0B' }]}>+₹200 · Your address</Text>
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
            <Text style={{ fontSize: 14, color: 'rgba(0,0,0,0.6)' }}>→</Text>
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
      <Text style={[prStyles.label, big && { fontWeight: '700', color: 'rgba(255,255,255,0.65)' }]}>{label}</Text>
      <Text style={[
        prStyles.value,
        green && { color: '#10B981' },
        amber && { color: '#F59E0B' },
        big && { fontSize: 15, color: '#F59E0B', fontWeight: '800' },
      ]}>{value}</Text>
    </View>
  );
}

const prStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowBig: { borderBottomWidth: 0, paddingTop: 9, marginTop: 4 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  value: { fontSize: 12, fontWeight: '600', color: '#fff' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: '#07111E' },
  headerBack: { fontSize: 18, color: '#fff', fontWeight: '600' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  miniCard: { margin: 12, marginHorizontal: 16, backgroundColor: '#0D1D2E', borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  miniImg: { width: 76, height: 50, borderRadius: 8, backgroundColor: '#142438', alignItems: 'center', justifyContent: 'center' },
  miniName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  miniSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  miniOffer: { fontSize: 10, color: '#F59E0B', fontWeight: '700', marginTop: 4 },
  section: { paddingHorizontal: 16, marginBottom: 13 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dateBox: { flex: 1, backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 11, padding: 11 },
  dateBoxActive: { borderColor: 'rgba(245,158,11,0.45)' },
  dateLbl: { fontSize: 9, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  dateVal: { fontSize: 13, fontWeight: '700', color: '#fff' },
  dateDay: { fontSize: 9, color: 'rgba(255,255,255,0.38)', marginTop: 1 },
  dateArrow: { color: 'rgba(255,255,255,0.25)', fontSize: 16, fontWeight: '300' },
  durRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  durBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  durBtnText: { fontSize: 17, color: '#fff' },
  durVal: { fontSize: 17, fontWeight: '800', color: '#fff', minWidth: 52, textAlign: 'center' },
  durLabel: { fontSize: 10, color: 'rgba(255,255,255,0.38)' },
  pickupRow: { flexDirection: 'row', gap: 8 },
  pickupOpt: { flex: 1, backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 10, padding: 9 },
  pickupOn: { borderColor: '#F59E0B' },
  pickupTitle: { fontSize: 11, fontWeight: '700', color: '#fff' },
  pickupSub: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 },
  priceBox: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#0D1D2E', borderRadius: 13, padding: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  priceBoxTitle: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 9 },
  payHero: { marginHorizontal: 16, marginBottom: 14, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 13, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payHeroLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 2 },
  payHeroAmount: { fontSize: 24, fontWeight: '800', color: '#F59E0B' },
  payHeroSub: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 },
  payHeroRight: { fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'right', lineHeight: 15 },
  payCTAWrap: { paddingHorizontal: 16, paddingBottom: 28 },
  payBtn: { backgroundColor: '#F59E0B', borderRadius: 13, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  payBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  payNote: { textAlign: 'center', marginTop: 9, fontSize: 10, color: 'rgba(255,255,255,0.28)' },
});
