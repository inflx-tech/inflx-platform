/**
 * RestaurantCartScreen — Wave 5B (mockup Flow 2.2 "View bill").
 *
 * Online-order checkout for restaurants. Receives the cart built on
 * RestaurantDetailScreen via route params, lets the follower adjust
 * quantities, then places the order through the existing
 * /follower/orders → /follower/orders/verify contract (createOrder +
 * processPayment + verifyOrder). Backend recomputes the real discount
 * from the campaign offer — the subtotal shown here is pre-discount;
 * the final discounted amount comes back from createOrder.
 *
 * Attribution: campaign_id / set_id / campaign_influencer_id are
 * mandatory on /follower/orders (every transaction is creator-attributed
 * in the INFLX model). We source them from the resolved offer; if the
 * restaurant has no active campaign offer, online order isn't possible
 * and the screen says so instead of failing silently at pay time.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brandPalette as lightColors, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { mockPayment } from '../../services/payment';
import { ensureFollowerAuth } from '../../utils/authGate';
import { CreatorChip } from '../../components/restaurant';

export default function RestaurantCartScreen({ route, navigation }) {
  const { brand, tracking, offer, items: initialItems } = route.params || {};
  const [items, setItems]   = useState(initialItems || []);
  const [placing, setPlacing] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);

  // Resolve mandatory attribution ids. Offer first, then explicit tracking.
  const cid = offer?.campaign_id            || tracking?.cid || tracking?.campaign_id;
  const sid = offer?.set_id                 || tracking?.sid || tracking?.set_id;
  const ciid = offer?.campaign_influencer_id || tracking?.iid || tracking?.campaign_influencer_id;
  const canOrder = !!(cid && sid && ciid);

  const creator = tracking?.influencer_handle
    ? { handle: tracking.influencer_handle, name: tracking.influencer_name }
    : (offer?.influencer_handle ? { handle: offer.influencer_handle, name: offer.influencer_name } : null);

  function setQty(productId, delta) {
    setItems(prev => prev
      .map(i => i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0));
  }

  async function placeOrder() {
    if (!canOrder) {
      Alert.alert('Online order unavailable',
        'This restaurant has no active creator campaign right now, so online ordering isn’t available. Try Book a Table or Pay at Restaurant.');
      return;
    }
    if (!(await ensureFollowerAuth(navigation,
      { message: 'Sign in to place your order.' }))) return;
    if (items.length === 0) return;
    setPlacing(true);
    try {
      const createRes = await followerApi.createOrder({
        offer_id:               offer?.offer_id || offer?.id || null,
        campaign_id:            cid,
        set_id:                 sid,
        campaign_influencer_id: ciid,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      if (!createRes?.success && !createRes?.data) {
        Alert.alert('Could not place order', createRes?.error?.message || 'Try again.');
        setPlacing(false);
        return;
      }
      const d = createRes.data || createRes;
      const orderId = d.razorpay_order_id || d.order_id;
      const payable = d.net_amount != null ? d.net_amount : subtotal;

      // Mock-mode pilot: safe JS mock instead of native Razorpay SDK.
      // processPayment()'s RazorpayCheckout.open() with an undefined key
      // hard-crashed the app (native, bypasses JS try/catch) — that was
      // the "app simply closes on Place order" report. Swap to
      // processPayment + real keyId at production cutover.
      const pay = await mockPayment(orderId);
      if (!pay?.razorpay_payment_id) {
        Alert.alert('Payment cancelled', 'Your order was not placed.');
        setPlacing(false);
        return;
      }

      const verify = await followerApi.verifyOrder({
        razorpay_order_id: orderId,
        razorpay_payment_id: pay.razorpay_payment_id,
      });
      setPlacing(false);
      if (verify?.success || verify?.data) {
        Alert.alert('Order placed 🎉',
          `${brand?.business_name || 'Restaurant'} got your order.`,
          [{ text: 'Done', onPress: () => navigation.popToTop() }]);
      } else {
        Alert.alert('Payment unverified', verify?.error?.message || 'Contact support if charged.');
      }
    } catch (e) {
      setPlacing(false);
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
          {brand?.business_name || 'Your order'}
        </Text>
        <View style={{ width: 36 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Pressable onPress={() => navigation.goBack()} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Back to menu</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              {items.map(i => (
                <View key={i.product_id} style={styles.row}>
                  <View style={styles.thumb}>
                    {i.image_url
                      ? <Image source={{ uri: i.image_url }} style={styles.thumbImg} />
                      : <Text style={styles.thumbGlyph}>🍽️</Text>}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{i.name}</Text>
                    <Text style={styles.itemPrice}>₹ {Math.round(i.price)}</Text>
                  </View>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setQty(i.product_id, -1)} hitSlop={8} style={styles.stepBtn}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepNum}>{i.quantity}</Text>
                    <Pressable onPress={() => setQty(i.product_id, +1)} hitSlop={8} style={styles.stepBtn}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.billCard}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Subtotal</Text>
                <Text style={styles.billVal}>₹ {Math.round(subtotal)}</Text>
              </View>
              {offer?.discount_value > 0 && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: lightColors.yellowText }]}>
                    {offer.discount_value}% creator offer
                  </Text>
                  <Text style={[styles.billVal, { color: lightColors.yellowText }]}>
                    applied at payment
                  </Text>
                </View>
              )}
              <Text style={styles.billNote}>
                Final discount is computed by the offer engine at checkout.
              </Text>
            </View>

            {creator && (
              <View style={styles.attr}>
                <CreatorChip handle={creator.handle} name={creator.name} verified size="sm" />
                <Text style={styles.attrText}>via your creator link</Text>
              </View>
            )}

            {!canOrder && (
              <Text style={styles.warn}>
                ⚠ No active creator campaign for this restaurant — online order
                isn’t available. Use Book a Table or Pay at Restaurant.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {items.length > 0 && (
        <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
          <Pressable
            onPress={placeOrder}
            disabled={placing || !canOrder}
            style={[styles.payBtn, (placing || !canOrder) && styles.payBtnDisabled]}>
            {placing
              ? <ActivityIndicator color={lightColors.ink} />
              : <Text style={styles.payBtnText}>
                  Place order · ₹{Math.round(subtotal)} →
                </Text>}
          </Pressable>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: lightColors.bg },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: lightColors.bg2, alignItems: 'center', justifyContent: 'center' },
  iconBtnGlyph: { fontSize: 16, color: lightColors.ink },
  appbarTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.displayBold, fontSize: 17, color: lightColors.ink, letterSpacing: -0.2 },

  section: { paddingHorizontal: 16, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomColor: lightColors.border, borderBottomWidth: 1 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: lightColors.bg2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbGlyph: { fontSize: 22 },
  itemName: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
  itemPrice: { fontFamily: fonts.monoBold, fontSize: 12, color: lightColors.ink2, marginTop: 3 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: lightColors.yellow, borderRadius: 8, paddingHorizontal: 4 },
  stepBtn: { paddingHorizontal: 9, paddingVertical: 5 },
  stepBtnText: { fontFamily: fonts.displayBlack, fontSize: 15, color: lightColors.ink },
  stepNum: { fontFamily: fonts.monoBold, fontSize: 13, color: lightColors.ink, minWidth: 18, textAlign: 'center' },

  billCard: { marginHorizontal: 16, marginTop: 16, backgroundColor: lightColors.white, borderColor: lightColors.border, borderWidth: 1, borderRadius: 12, padding: 14 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  billLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: lightColors.ink2 },
  billVal: { fontFamily: fonts.monoBold, fontSize: 13, color: lightColors.ink },
  billNote: { fontFamily: fonts.sansMedium, fontSize: 11, color: lightColors.muted, marginTop: 8 },

  attr: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: lightColors.bg2, borderRadius: 8 },
  attrText: { fontFamily: fonts.monoMedium, fontSize: 11, color: lightColors.muted },
  warn: { marginHorizontal: 16, marginTop: 14, fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.danger, lineHeight: 17 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 17, color: lightColors.ink },
  emptyBtn: { marginTop: 14, backgroundColor: lightColors.yellow, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  emptyBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },

  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: lightColors.white, borderTopColor: lightColors.border, borderTopWidth: 1 },
  payBtn: { margin: 16, paddingVertical: 16, borderRadius: 12, backgroundColor: lightColors.yellow, alignItems: 'center' },
  payBtnDisabled: { backgroundColor: lightColors.bg2 },
  payBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: lightColors.ink, letterSpacing: -0.1 },
});
