import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { useCart } from '../../services/CartContext';
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';

/**
 * OrderCartScreen — cart review + checkout for cart_scope: "brand" templates
 * (restaurant today; future direct-buy verticals).
 *
 * Flow 42 (F3) restyle (2026-05-28): dark hardcoded hexes → light brandPalette.
 * ink/yellow Proceed-to-Pay CTA. Razorpay processPayment + paise-at-boundary +
 * 4-ID tracking + createOrder/verifyOrder + min-order gate preserved verbatim.
 */

export default function OrderCartScreen({ navigation, route }) {
  const { brandData } = route.params || {};
  const { cart, updateQty, removeItem, clear } = useCart();
  const [loading, setLoading] = useState(false);

  const minOrderValue = Number(brandData?.min_order_value) || 0;
  const deliveryFee = Number(brandData?.delivery_fee) || 0;

  const subtotal = cart.items.reduce((sum, i) => sum + (Number(i.price) || 0) * i.qty, 0);
  const belowMin = minOrderValue > 0 && subtotal < minOrderValue;
  const total = subtotal + deliveryFee;

  async function handleCheckout() {
    const token = await AsyncStorage.getItem('inflx_token');
    if (!token) {
      Alert.alert('Sign In Required', 'You need to sign in to place orders.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('FollowerLogin') },
      ]);
      return;
    }

    setLoading(true);
    try {
      const res = await followerApi.createOrder({
        // Tracking — non-negotiable per contracts-v1 §1
        campaign_id: cart.tracking?.campaign_id,
        set_id: cart.tracking?.set_id,
        offer_id: cart.tracking?.offer_id || null,
        campaign_influencer_id: cart.tracking?.campaign_influencer_id,
        // Wire format: `items`, not `cart` — see header note
        items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.qty })),
        delivery_fee: deliveryFee,
      });

      if (!res.success && !res.data) {
        Alert.alert('Order Failed', res.error?.message || 'Please try again');
        setLoading(false);
        return;
      }

      const orderId = res.data?.razorpay_order_id;
      const keyId = res.data?.razorpay_key_id;
      const amountRupees = res.data?.amount_rupees || total;

      const payResult = await processPayment({
        amount: Math.round(amountRupees * 100),    // SDK expects paise
        orderId,
        keyId,
        description: `Order from ${cart.brandName}`,
        brandName: cart.brandName,
      });

      if (!payResult) {
        Alert.alert('Payment Cancelled', 'You can try again anytime.');
        setLoading(false);
        return;
      }

      const verifyRes = await followerApi.verifyOrder?.({
        razorpay_order_id: payResult.razorpay_order_id,
        razorpay_payment_id: payResult.razorpay_payment_id,
        razorpay_signature: payResult.razorpay_signature,
      });

      if (verifyRes?.success || verifyRes?.data) {
        const paidRupees = verifyRes?.data?.amount_rupees ?? amountRupees;
        clear();
        Alert.alert('Order Placed', `Total ${fmtRupees(paidRupees)} paid. We'll notify the restaurant.`, [
          { text: 'Done', onPress: () => navigation.popToTop() },
        ]);
      } else {
        Alert.alert('Verification Failed', verifyRes?.error?.message || 'Payment received but verification failed. Contact support.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (cart.items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" size={18} color={P.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your cart</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyTile}><Text style={{ fontSize: 32 }}>🛒</Text></View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Browse a restaurant and add items to get started.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={18} color={P.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Order from {cart.brandName}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Items */}
        <View style={styles.itemsSection}>
          {cart.items.map(item => (
            <View key={item.product_id} style={styles.itemRow}>
              <View style={styles.itemImg}>
                {item.image_url
                  ? <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} />
                  : <Text style={{ fontSize: 22 }}>🍽️</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemPrice}>{fmtRupees(item.price)} × {item.qty} = {fmtRupees(item.price * item.qty)}</Text>
              </View>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product_id, item.qty - 1)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyVal}>{item.qty}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product_id, item.qty + 1)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.product_id)}>
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Breakdown */}
        <View style={styles.breakdown}>
          <Row label="Subtotal" value={fmtRupees(subtotal)} />
          {deliveryFee > 0 && <Row label="Delivery" value={fmtRupees(deliveryFee)} />}
          <Row label="Total" value={fmtRupees(total)} big />
        </View>

        {belowMin && (
          <View style={styles.belowMinBanner}>
            <Text style={styles.belowMinText}>
              Add {fmtRupees(minOrderValue - subtotal)} more to checkout (minimum order ₹{minOrderValue})
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.payCTAWrap}>
        <TouchableOpacity
          style={[styles.payBtn, (belowMin || loading) && styles.payBtnDisabled]}
          onPress={handleCheckout}
          disabled={belowMin || loading}>
          <Text style={[styles.payBtnText, (belowMin || loading) && { color: P.muted3 }]}>
            {loading ? 'PROCESSING…' : `PROCEED TO PAY ${fmtRupees(total)}`}
          </Text>
          <Icon name="arrow-right" size={16} color={belowMin || loading ? P.muted3 : P.yellow} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value, big }) {
  return (
    <View style={[rowStyles.row, big && rowStyles.rowBig]}>
      <Text style={[rowStyles.label, big && rowStyles.labelBig]}>{label}</Text>
      <Text style={[rowStyles.value, big && rowStyles.valueBig]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  rowBig: { borderBottomWidth: 0, paddingTop: 10, marginTop: 4 },
  label: { fontSize: 12.5, color: P.muted, fontFamily: fonts.sansRegular },
  labelBig: { fontFamily: fonts.displayBold, fontWeight: '800', color: P.ink },
  value: { fontSize: 12.5, fontWeight: '800', color: P.ink, fontFamily: fonts.monoBold },
  valueBig: { fontSize: 18, color: P.ink, fontWeight: '900', fontFamily: fonts.monoBold },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTile: {
    width: 66, height: 66, borderRadius: 14, backgroundColor: P.yellowPale,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: P.ink, marginBottom: 6, fontFamily: fonts.displayBlack },
  emptySub: { fontSize: 11.5, color: P.muted, textAlign: 'center', fontFamily: fonts.sansRegular },

  itemsSection: { padding: 16, gap: 10 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: P.white, borderRadius: 14, padding: 11,
    borderWidth: 1, borderColor: P.border,
  },
  itemImg: { width: 56, height: 50, borderRadius: 10, overflow: 'hidden', backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  itemPrice: { fontSize: 10.5, color: P.muted, marginTop: 2, fontWeight: '700', fontFamily: fonts.monoMedium },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.bg2, borderRadius: 9, padding: 3 },
  qtyBtn: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, color: P.ink, fontWeight: '900', fontFamily: fonts.displayBlack },
  qtyVal: { fontSize: 12.5, fontWeight: '900', color: P.ink, minWidth: 20, textAlign: 'center', fontFamily: fonts.monoBold },
  removeText: { fontSize: 22, color: P.muted3, paddingHorizontal: 6 },

  breakdown: { marginHorizontal: 16, padding: 14, backgroundColor: P.white, borderRadius: 14, borderWidth: 1, borderColor: P.border },
  belowMinBanner: { marginHorizontal: 16, marginTop: 10, padding: 11, backgroundColor: P.yellowPale, borderRadius: 11, borderWidth: 1, borderColor: '#F0DA88' },
  belowMinText: { fontSize: 11, color: P.yellowText, textAlign: 'center', fontWeight: '800', fontFamily: fonts.monoMedium },

  payCTAWrap: { padding: 14, paddingBottom: 18, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.border },
  payBtn: { backgroundColor: P.ink, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payBtnDisabled: { backgroundColor: P.muted4 },
  payBtnText: { fontSize: 13.5, fontWeight: '900', color: P.yellow, letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
});
