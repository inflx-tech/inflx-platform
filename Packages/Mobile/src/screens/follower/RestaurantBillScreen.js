/**
 * RestaurantBillScreen — Wave 4 PR 4.3 (mockup Flow 3.3).
 *
 * The Pay at Restaurant flow, redesigned for the dining vertical. Wraps
 * the same followerApi.payAtStore + processPayment contract used by
 * PayAtStoreScreen — back-end behavior unchanged, UI only.
 *
 * PayAtStoreScreen dispatches here when brand.category === 'restaurant'.
 * Non-restaurant pay flows (salon, fashion, etc.) keep the legacy UI
 * until their own waves.
 *
 * Layout:
 *   - App bar (back + "Pay at <brand>")
 *   - Restaurant header strip
 *   - Bill input card with auto-computed line items
 *   - Payment method selector (UPI / Wallet)
 *   - Creator attribution row
 *   - Sticky bottom CTA: "Pay ₹X →"
 *
 * Note on wallet rewards: the mockup shows a "+ ₹78 INFLX wallet
 * rewards" line. Follower-side cashback is not yet wired in the schema
 * (Wave 5+); leaving the line out keeps the bill honest.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { mockPayment } from '../../services/payment';
import { ensureFollowerAuth } from '../../utils/authGate';
import { CreatorChip, OfferPill } from '../../components/restaurant';

export default function RestaurantBillScreen({ route, navigation }) {
  const { offer, store, brand, tracking, influencer,
    prebookBookingId, tokenPaid, atVenueDiscountPct,
  } = route.params || {};

  const isPrebookBalance = !!prebookBookingId;
  const discountPct = isPrebookBalance
    ? Number(atVenueDiscountPct || 0)
    : Number(offer?.discount_value || 0);
  const tokenRupees = isPrebookBalance ? Number(tokenPaid || 0) : 0;

  const [billStr, setBillStr]   = useState('');
  const [method, setMethod]     = useState('upi');
  const [paying, setPaying]     = useState(false);

  const bill = parseFloat(billStr || '0');
  const discount = +(bill * (discountPct / 100)).toFixed(2);
  const discounted = +(bill - discount).toFixed(2);
  // GST not actually applied in our flow — we collect what the user owes
  // post-discount minus any token. Keep math simple and consistent with
  // legacy PayAtStoreScreen.
  const youPay = Math.max(0, +(discounted - tokenRupees).toFixed(2));

  const creator = tracking?.influencer_handle ? {
    handle: tracking.influencer_handle,
    name: tracking.influencer_name,
    verified: true,
  } : (offer?.influencer_handle ? {
    handle: offer.influencer_handle,
    name: offer.influencer_name,
    verified: true,
  } : null);

  async function handlePay() {
    if (!youPay || youPay < 1) {
      Alert.alert('Enter a valid amount');
      return;
    }
    if (!(await ensureFollowerAuth(navigation,
      { message: 'Sign in to pay your bill via INFLX.' }))) return;

    const cid  = offer?.campaign_id            || tracking?.campaign_id            || tracking?.cid;
    const sid  = offer?.set_id                 || tracking?.set_id                 || tracking?.sid;
    const ciid = offer?.campaign_influencer_id  || tracking?.campaign_influencer_id || tracking?.iid;
    const offerId = offer?.offer_id || offer?.id || tracking?.offer_id || null;
    if (!isPrebookBalance && (!cid || !sid || !ciid)) {
      Alert.alert(
        'Pay at Restaurant not available',
        'This restaurant isn’t part of an active creator campaign right now, so paying via INFLX isn’t available yet.'
      );
      return;
    }
    setPaying(true);
    try {
      // Initiate the transaction → backend returns Razorpay order
      const initiateRes = await followerApi.payAtStore({
        bill_amount:            bill,
        offer_id:               offerId,
        campaign_id:            cid,
        set_id:                 sid,
        campaign_influencer_id: ciid,
        prebook_booking_id:     prebookBookingId || null,
      });
      if (!initiateRes.success) {
        Alert.alert('Payment Failed', initiateRes.error?.message || 'Could not initiate payment');
        setPaying(false);
        return;
      }
      const { razorpay_order_id } = initiateRes.data;

      // Mock-mode pilot: use the safe JS mock (Alert-confirm) instead of
      // the native Razorpay SDK. processPayment() calls
      // RazorpayCheckout.open() with an undefined key in mock mode, which
      // can hard-crash the app natively (bypasses the JS try/catch).
      // Swap back to processPayment + a real keyId at production cutover.
      const paymentRes = await mockPayment(razorpay_order_id);
      if (!paymentRes?.razorpay_payment_id) {
        Alert.alert('Payment Cancelled', 'Try again to complete your payment.');
        setPaying(false);
        return;
      }

      // Verify — defensive in case the verifyPayAtStore endpoint isn't
      // wired in this build (mirrors PayAtStoreScreen's existing check).
      const verifyRes = followerApi.verifyPayAtStore
        ? await followerApi.verifyPayAtStore({
            razorpay_order_id,
            razorpay_payment_id: paymentRes.razorpay_payment_id,
          })
        : { success: true };
      setPaying(false);
      if (!verifyRes.success) {
        Alert.alert('Payment Failed', verifyRes.error?.message || 'Could not verify');
        return;
      }
      Alert.alert(
        'Payment successful',
        `Paid ${formatRupees(youPay)} at ${brand?.business_name || 'Restaurant'}.`,
        [{ text: 'Done', onPress: () => navigation.popToTop() }]
      );
    } catch (err) {
      setPaying(false);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.appbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={6}>
          <Text style={styles.iconBtnGlyph}>←</Text>
        </Pressable>
        <Text style={styles.appbarTitle} numberOfLines={1}>
          Pay at {brand?.business_name || store?.brand_name || 'Restaurant'}
        </Text>
        <View style={{ width: 36 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Restaurant header strip */}
        <View style={styles.brandStrip}>
          <View style={styles.brandStripPhoto}>
            <Text style={styles.brandStripPhotoGlyph}>🍽️</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brandStripName} numberOfLines={1}>
              {brand?.business_name || store?.brand_name || 'Restaurant'}
            </Text>
            <Text style={styles.brandStripMeta} numberOfLines={1}>
              {isPrebookBalance ? 'BALANCE AT TABLE' : 'BILL · WALK-IN'}
            </Text>
          </View>
          {discountPct > 0 && <OfferPill label={`${discountPct}% OFF`} />}
        </View>

        {/* Bill input */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>YOUR BILL</Text>
          <View style={styles.billInput}>
            <Text style={styles.rupeeMark}>₹</Text>
            <TextInput
              value={billStr}
              onChangeText={t => setBillStr(t.replace(/[^0-9.]/g, ''))}
              placeholder="Enter the bill amount"
              placeholderTextColor={lightColors.muted3}
              style={styles.billInputField}
              keyboardType="numeric"
              autoFocus
            />
          </View>
          {bill > 0 && (
            <Text style={styles.subtotalNote}>
              Subtotal before discount: <Text style={styles.subtotalNoteMono}>{formatRupees(bill)}</Text>
            </Text>
          )}
        </View>

        {/* Breakdown */}
        {bill > 0 && (
          <View style={[styles.section, styles.breakdownCard]}>
            <Row label="Subtotal" value={formatRupees(bill)} mono />
            {discountPct > 0 && (
              <Row
                labelNode={
                  <View style={styles.discountLabel}>
                    <View style={styles.discountPct}>
                      <Text style={styles.discountPctText}>{discountPct}%</Text>
                    </View>
                    <Text style={styles.discountLabelText}>Follower discount</Text>
                  </View>
                }
                value={`− ${formatRupees(discount)}`}
                mono
                accent="yellow"
              />
            )}
            {isPrebookBalance && tokenRupees > 0 && (
              <Row
                label="Token already paid"
                value={`− ${formatRupees(tokenRupees)}`}
                mono
                accent="success"
              />
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>You pay</Text>
              <Text style={styles.totalValue}>{formatRupees(youPay)}</Text>
            </View>
            {discount > 0 && (
              <Text style={styles.savedNote}>
                You saved {formatRupees(discount + tokenRupees)}
              </Text>
            )}
          </View>
        )}

        {/* Payment methods */}
        {bill > 0 && (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>PAY USING</Text>
            <Pressable onPress={() => setMethod('upi')}
              style={[styles.methodRow, method === 'upi' && styles.methodRowActive]}>
              <Text style={styles.methodGlyph}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodName}>UPI / Cards</Text>
                <Text style={styles.methodSub}>via Razorpay · GooglePay, PhonePe, cards</Text>
              </View>
              <View style={[styles.radio, method === 'upi' && styles.radioActive]}>
                {method === 'upi' && <View style={styles.radioDot} />}
              </View>
            </Pressable>
            <Pressable onPress={() => setMethod('wallet')}
              style={[styles.methodRow, method === 'wallet' && styles.methodRowActive]}>
              <Text style={styles.methodGlyph}>💰</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodName}>INFLX Wallet</Text>
                <Text style={styles.methodSub}>Coming soon</Text>
              </View>
              <View style={[styles.radio, method === 'wallet' && styles.radioActive]}>
                {method === 'wallet' && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          </View>
        )}

        {/* Attribution */}
        {creator && (
          <View style={styles.attributionRow}>
            <CreatorChip handle={creator.handle} name={creator.name}
              verified={creator.verified} size="sm" />
            {tracking?.cid && (
              <Text style={styles.attributionRef}>
                {String(tracking.cid).slice(0, 8).toUpperCase()}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky pay CTA */}
      <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
        <Pressable
          onPress={handlePay}
          disabled={!bill || youPay < 1 || paying || method === 'wallet'}
          style={[
            styles.payBtn,
            (!bill || youPay < 1 || method === 'wallet') && styles.payBtnDisabled,
          ]}>
          {paying
            ? <ActivityIndicator color={lightColors.ink} />
            : <Text style={styles.payBtnText}>
                Pay {bill > 0 ? formatRupees(youPay) : ''} →
              </Text>}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Row({ label, labelNode, value, mono, accent }) {
  const valColor = accent === 'yellow'  ? lightColors.yellowDeep
                : accent === 'success'  ? lightColors.success
                : lightColors.ink;
  return (
    <View style={styles.breakdownRow}>
      {labelNode || <Text style={styles.breakdownLabel}>{label}</Text>}
      <Text style={[
        styles.breakdownValue,
        mono && { fontFamily: fonts.monoBold },
        { color: valColor },
      ]}>{value}</Text>
    </View>
  );
}

function formatRupees(n) {
  return `₹ ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },

  appbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
    backgroundColor: lightColors.bg,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: lightColors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnGlyph: { fontSize: 16, color: lightColors.ink },
  appbarTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: fonts.displayBold, fontSize: 17,
    color: lightColors.ink, letterSpacing: -0.2,
  },

  brandStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10,
    padding: 12, borderRadius: 10,
    backgroundColor: lightColors.surface,
  },
  brandStripPhoto: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: lightColors.yellow50,
    alignItems: 'center', justifyContent: 'center',
  },
  brandStripPhotoGlyph: { fontSize: 22 },
  brandStripName: {
    fontFamily: fonts.displayBold, fontSize: 14,
    color: lightColors.ink, letterSpacing: -0.1,
  },
  brandStripMeta: {
    fontFamily: fonts.monoMedium, fontSize: 10,
    color: lightColors.muted, marginTop: 2, letterSpacing: 0.5,
  },

  section: { paddingHorizontal: 16, marginTop: 18 },
  fieldLabel: {
    fontFamily: fonts.monoBold, fontSize: 11,
    color: lightColors.muted, marginBottom: 8, letterSpacing: 0.6,
  },

  billInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: lightColors.paper,
    borderColor: lightColors.border2, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14,
  },
  rupeeMark: {
    fontFamily: fonts.displayBlack, fontSize: 22,
    color: lightColors.ink, marginRight: 6,
  },
  billInputField: {
    flex: 1,
    fontFamily: fonts.displayBlack, fontSize: 22,
    color: lightColors.ink, paddingVertical: 14,
    letterSpacing: -0.4,
  },
  subtotalNote: {
    fontFamily: fonts.sansMedium, fontSize: 11,
    color: lightColors.muted, marginTop: 8,
  },
  subtotalNoteMono: { fontFamily: fonts.monoBold, color: lightColors.ink2 },

  breakdownCard: {
    backgroundColor: lightColors.paper,
    borderColor: lightColors.border, borderWidth: 1,
    borderRadius: 12, padding: 14, marginHorizontal: 16,
    marginTop: 14, paddingHorizontal: 14,
  },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 5,
  },
  breakdownLabel: {
    fontFamily: fonts.sansMedium, fontSize: 13, color: lightColors.ink2,
  },
  breakdownValue: { fontSize: 13 },

  discountLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discountPct: {
    backgroundColor: lightColors.yellow50,
    borderColor: lightColors.yellow200, borderWidth: 1,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  discountPctText: {
    fontFamily: fonts.monoBold, fontSize: 9, color: lightColors.yellowDeep,
  },
  discountLabelText: {
    fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.yellowDeep,
  },

  divider: {
    height: 1, backgroundColor: lightColors.border, marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontFamily: fonts.sansBold, fontSize: 14, color: lightColors.ink,
  },
  totalValue: {
    fontFamily: fonts.displayBlack, fontSize: 26,
    color: lightColors.ink, letterSpacing: -0.5,
  },
  savedNote: {
    textAlign: 'right', marginTop: 4,
    fontFamily: fonts.monoBold, fontSize: 11, color: lightColors.success,
  },

  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 1,
    borderColor: lightColors.border, backgroundColor: lightColors.paper,
    marginBottom: 8,
  },
  methodRowActive: {
    borderColor: lightColors.yellow,
    backgroundColor: lightColors.yellow50,
  },
  methodGlyph: { fontSize: 22 },
  methodName: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
  methodSub:  { fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted, marginTop: 2 },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderColor: lightColors.border2, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: lightColors.yellow },
  radioDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: lightColors.yellow,
  },

  attributionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: lightColors.surface,
    borderRadius: 8,
  },
  attributionRef: {
    fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted,
  },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: lightColors.paper,
    borderTopColor: lightColors.border, borderTopWidth: 1,
  },
  payBtn: {
    margin: 16, paddingVertical: 16, borderRadius: 12,
    backgroundColor: lightColors.yellow, alignItems: 'center',
  },
  payBtnDisabled: { backgroundColor: lightColors.surface2 },
  payBtnText: {
    fontFamily: fonts.sansBold, fontSize: 15,
    color: lightColors.ink, letterSpacing: -0.1,
  },
});
