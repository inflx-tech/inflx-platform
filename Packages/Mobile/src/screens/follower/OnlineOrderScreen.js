import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { creatorVibe as C, fonts, fmtMoney, fmtRupees } from '../../theme/tokens';

// Flow 52.G — Creator Vibe recolor shim (transaction screens). Visual only —
// qty/address/subtotal logic, order placement, and navigation untouched.
const P = {
  white: C.card, bg: C.screenBg, bg2: C.soft,
  border: C.line, ink: C.ink, ink2: C.ink,
  muted: C.muted, muted2: C.muted, muted3: C.muted, muted4: C.line,
  yellow: C.star, yellowHover: C.brown, yellowPale: C.soft, yellowText: C.brown,
  success: C.verify, successPale: C.soft, successText: C.brown,
  danger: C.offer, dangerPale: C.soft, dangerText: C.offer,
};
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';

export default function OnlineOrderScreen({ navigation, route }) {
  const { products = [], offer, store, tracking, trackingParams, storeOffer } = route.params || {};
  // ProductDetail passes the long-key tracking object as both `tracking` and
  // `trackingParams` ({campaign_id, set_id, offer_id, campaign_influencer_id}).
  // When it's absent the order is ORGANIC (brand-direct, no creator).
  const trk = tracking || trackingParams || null;
  const brandId = storeOffer?.brand_id || store?.brand_id || store?.id || null;

  const [cart, setCart]         = useState(
    products.map(p => ({
      ...p,
      qty: p.qty || p.quantity || 1,
      variant_sku: p.variant_sku || null,
      variant_label: p.variant_label || null,
    }))
  );
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setAddr]   = useState(null);
  const [loading, setLoading]     = useState(false);

  // Reusable so the "+ Add" flow can refresh the list (the old onSave was a
  // no-op, so a freshly-added address never appeared and Place Order stayed
  // disabled forever).
  function loadAddresses(preferId) {
    return followerApi.getAddresses?.().then(res => {
      if (!res?.success) return;
      const addrs = res.data?.addresses || [];
      setAddresses(addrs);
      setAddr(prev => {
        if (preferId && addrs.some(a => a.id === preferId)) return preferId;
        if (prev && addrs.some(a => a.id === prev)) return prev;
        return addrs.length ? addrs[0].id : null;
      });
    });
  }

  useEffect(() => { loadAddresses(); }, []);

  function updateQty(productId, delta) {
    setCart(prev => prev
      .map(item => item.id === productId ? { ...item, qty: Math.max(0, item.qty + delta) } : item)
      .filter(item => item.qty > 0)
    );
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);

  async function placeOrder() {
    if (cart.length === 0) { Alert.alert('Cart empty', 'Add items to your cart'); return; }
    if (!selectedAddr) { Alert.alert('Select address', 'Please add or select a delivery address'); return; }

    // Backend POST /follower/orders expects: address_id, items[{product_id,
    // quantity, variant_sku, variant_label}], and EITHER the creator triple
    // (campaign_id + set_id + campaign_influencer_id [+ offer_id]) OR, for an
    // organic order, just brand_id. The old payload used wrong keys
    // (campaign_set_id, delivery_address_id, qty) and omitted
    // campaign_influencer_id → it 422'd every time.
    const items = cart.map(i => ({
      product_id: i.id,
      quantity: i.qty,
      variant_sku: i.variant_sku || null,
      variant_label: i.variant_label || null,
    }));
    const isOrganic = !trk?.campaign_influencer_id;
    const payload = isOrganic
      ? { items, address_id: selectedAddr, brand_id: brandId }
      : {
          items, address_id: selectedAddr,
          campaign_id: trk.campaign_id,
          set_id: trk.set_id,
          campaign_influencer_id: trk.campaign_influencer_id,
          offer_id: trk.offer_id || null,
        };

    // 3-step order: createOrder → pay → verifyOrder. The DB row is only
    // written at verify — the old screen stopped after createOrder, so even a
    // "successful" order never reached the Orders tab (diagnostic D2).
    setLoading(true);
    try {
      const res = await followerApi.createOrder(payload);
      if (!res.success && !res.data) {
        Alert.alert('Order Failed', res.error?.message || 'Please try again');
        return;
      }

      const payResult = await processPayment({
        amount: Math.round((res.data?.net_amount || subtotal) * 100),  // SDK expects paise
        orderId: res.data?.razorpay_order_id,
        keyId: res.data?.razorpay_key_id,
        description: `Order from ${store?.name || 'store'}`,
        brandName: store?.name,
      });
      if (!payResult) { Alert.alert('Payment Cancelled', 'You can try again anytime.'); return; }

      const verifyRes = await followerApi.verifyOrder?.({
        razorpay_order_id: payResult.razorpay_order_id,
        razorpay_payment_id: payResult.razorpay_payment_id,
        razorpay_signature: payResult.razorpay_signature,
      });

      if (verifyRes?.success || verifyRes?.data) {
        const orderId = verifyRes?.data?.order_id;
        Alert.alert('Order Placed!', 'Your order has been placed successfully.', [
          { text: 'Track Order', onPress: () => navigation.replace('OrderDetail', { orderId }) },
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

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Your Cart</Text>
        </View>

        {/* Cart items */}
        {cart.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🛒</Text>
            <Text style={styles.emptyText}>Your cart is empty</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Items</Text>
            {cart.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.variant_label ? (
                    <Text style={styles.itemVariant}>{item.variant_label}</Text>
                  ) : null}
                  <Text style={styles.itemPrice}>{fmtRupees(item.price || 0)}</Text>
                </View>
                <View style={styles.qtyControls}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyNum}>{item.qty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Delivery address */}
        <View style={styles.card}>
          <View style={styles.addrHeader}>
            <Text style={styles.cardTitle}>Delivery Address</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Address', {
              onSave: (addr) => loadAddresses(addr?.id),
            })}>
              <Text style={styles.addAddrBtn}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {addresses.length === 0 ? (
            <Text style={styles.emptyText}>No addresses saved. Tap + Add to add one.</Text>
          ) : (
            addresses.map(addr => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addrCard, selectedAddr === addr.id && styles.addrCardActive]}
                onPress={() => setAddr(addr.id)}
              >
                <View style={styles.radio}>
                  {selectedAddr === addr.id && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addrLabel}>{addr.label || addr.type || 'Home'}</Text>
                  <Text style={styles.addrText}>
                    {[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Price summary */}
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalVal}>{fmtRupees(subtotal)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={[styles.totalLabel, { fontWeight: '800', color: P.ink }]}>Total</Text>
            <Text style={[styles.totalVal, { color: P.ink }]}>{fmtRupees(subtotal)}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Place order button */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.footerTotal}>{fmtRupees(subtotal)}</Text>
            <Text style={styles.footerItems}>{cart.reduce((s, i) => s + i.qty, 0)} item(s)</Text>
          </View>
          <TouchableOpacity
            style={[styles.orderBtn, (loading || cart.length === 0 || !selectedAddr) && { opacity: 0.5 }]}
            onPress={placeOrder}
            disabled={loading || cart.length === 0 || !selectedAddr}
          >
            {loading
              ? <ActivityIndicator color={P.white} />
              : <Text style={styles.orderBtnText}>Place Order</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: P.bg },
  container: { flex: 1 },
  header: { backgroundColor: P.ink, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '900', color: P.white, fontFamily: fonts.displayBlack },
  card: { margin: 16, marginBottom: 0, backgroundColor: P.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: P.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: P.ink, marginBottom: 12 },
  emptyText: { fontSize: 12, color: P.muted3, textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.border },
  itemName: { fontSize: 14, fontWeight: '600', color: P.ink, marginBottom: 2 },
  itemVariant: { fontSize: 11, color: P.yellowText, fontWeight: '700', marginBottom: 2 },
  itemPrice: { fontSize: 12, color: P.muted },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, color: P.ink, fontWeight: '600' },
  qtyNum: { fontSize: 16, fontWeight: '800', color: P.ink, minWidth: 20, textAlign: 'center' },
  addrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addAddrBtn: { fontSize: 12, fontWeight: '700', color: P.ink },
  addrCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8 },
  addrCardActive: { borderColor: P.ink, backgroundColor: P.ink + '08' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: P.muted3, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: P.ink },
  addrLabel: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 2 },
  addrText: { fontSize: 11, color: P.muted, lineHeight: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  grandTotal: { borderTopWidth: 1, borderTopColor: P.border, marginTop: 6, paddingTop: 10 },
  totalLabel: { fontSize: 13, color: P.muted },
  totalVal: { fontSize: 13, fontWeight: '700', color: P.ink },
  footer: { backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.border, padding: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerTotal: { fontSize: 18, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  footerItems: { fontSize: 11, color: P.muted3, fontWeight: '700', fontFamily: fonts.monoMedium },
  orderBtn: { backgroundColor: P.ink, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  orderBtnText: { fontSize: 14, fontWeight: '900', color: P.yellow, textTransform: 'uppercase', letterSpacing: 0.2, fontFamily: fonts.displayBlack },
});
