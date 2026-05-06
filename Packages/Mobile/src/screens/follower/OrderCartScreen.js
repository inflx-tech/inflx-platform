import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fmtRupees } from '../../theme/tokens';
import { useCart } from '../../services/CartContext';
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';

/**
 * OrderCartScreen — cart review + checkout for cart_scope: "brand" templates
 * (restaurant today; future direct-buy verticals).
 *
 * Cart-mismatch enforcement happens at the ADD intent layer
 * (RestaurantDetailScreen's "Add to Order" handler) — by the time the user
 * lands here, all items are guaranteed same-brand. OrderCartScreen never
 * sees a cross-brand state.
 *
 * Wire format note (per Code's isolated decision #2): the existing
 * /follower/orders endpoint takes `items`, not `cart` — the contract's
 * `cart` is a conceptual name. We send `items: [{ product_id, qty }]`.
 *
 * min_order_value gate: brand_data.min_order_value blocks checkout when
 * subtotal < min. Per spec, this is the ONLY place a brand-level field
 * gates a listing-level action.
 */

export default function OrderCartScreen({ navigation, route }) {
  const { brandData } = route.params || {};   // brand-level fields surfaced from BrandStoreScreen
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
        Alert.alert('Order Placed! 🎉', `Total ${fmtRupees(paidRupees)} paid. We'll notify the restaurant.`, [
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
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.headerBack}>←</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Your cart</Text>
          <View style={{ width: 16 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Browse a restaurant and add items to get started.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.headerBack}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Order from {cart.brandName}</Text>
        <View style={{ width: 16 }} />
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
          style={[styles.payBtn, (belowMin || loading) && { backgroundColor: '#3a4150' }]}
          onPress={handleCheckout}
          disabled={belowMin || loading}>
          <Text style={[styles.payBtnText, (belowMin || loading) && { color: 'rgba(255,255,255,0.5)' }]}>
            {loading ? 'Processing…' : `Proceed to Pay ${fmtRupees(total)}`}
          </Text>
          <Text style={{ fontSize: 14, color: belowMin || loading ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.6)' }}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value, big }) {
  return (
    <View style={[rowStyles.row, big && rowStyles.rowBig]}>
      <Text style={[rowStyles.label, big && { fontWeight: '700', color: 'rgba(255,255,255,0.85)' }]}>{label}</Text>
      <Text style={[rowStyles.value, big && { fontSize: 16, color: '#F59E0B', fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowBig: { borderBottomWidth: 0, paddingTop: 10, marginTop: 4 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  value: { fontSize: 12, fontWeight: '600', color: '#fff' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerBack: { fontSize: 18, color: '#fff', fontWeight: '600' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyIcon: { fontSize: 60, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  emptySub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  itemsSection: { padding: 16, gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0D1D2E', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  itemImg: { width: 56, height: 50, borderRadius: 8, overflow: 'hidden', backgroundColor: '#142438', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  itemPrice: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#142438', borderRadius: 8, padding: 2 },
  qtyBtn: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, color: '#fff' },
  qtyVal: { fontSize: 12, fontWeight: '700', color: '#fff', minWidth: 20, textAlign: 'center' },
  removeText: { fontSize: 22, color: 'rgba(255,255,255,0.3)', paddingHorizontal: 6 },
  breakdown: { marginHorizontal: 16, padding: 13, backgroundColor: '#0D1D2E', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  belowMinBanner: { marginHorizontal: 16, marginTop: 10, padding: 10, backgroundColor: 'rgba(255,180,90,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,180,90,0.25)' },
  belowMinText: { fontSize: 11, color: 'rgba(255,180,90,0.9)', textAlign: 'center', fontWeight: '600' },
  payCTAWrap: { padding: 12, paddingHorizontal: 16, paddingBottom: 18, backgroundColor: '#07111E', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  payBtn: { backgroundColor: '#F59E0B', borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
});
