import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function OnlineOrderScreen({ navigation, route }) {
  const { products = [], offer, store, trackingParams } = route.params || {};
  const [cart, setCart]         = useState(
    products.map(p => ({ ...p, qty: 1 }))
  );
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setAddr]   = useState(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    followerApi.getAddresses?.().then(res => {
      if (res?.success) {
        const addrs = res.data?.addresses || [];
        setAddresses(addrs);
        if (addrs.length > 0) setAddr(addrs[0].id);
      }
    });
  }, []);

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

    setLoading(true);
    const res = await followerApi.createOrder({
      items: cart.map(i => ({ product_id: i.id, qty: i.qty, name: i.name, price: i.price })),
      delivery_address_id: selectedAddr,
      offer_id: offer?.id,
      influencer_id: store?.influencer_id,
      campaign_id: trackingParams?.cid || offer?.campaign_id,
      campaign_set_id: trackingParams?.sid || offer?.campaign_set_id,
    });
    setLoading(false);

    if (res.success) {
      const orderId = res.data?.order?.id || res.data?.id;
      Alert.alert(
        'Order Placed!',
        'Your order has been placed successfully.',
        [{ text: 'Track Order', onPress: () => {
          navigation.replace('OrderDetail', { orderId });
        }}]
      );
    } else {
      Alert.alert('Order Failed', res.error?.message || 'Please try again');
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
            <TouchableOpacity onPress={() => navigation.navigate('Address', { onSave: () => {} })}>
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
            <Text style={[styles.totalLabel, { fontWeight: '800', color: colors.t1 }]}>Total</Text>
            <Text style={[styles.totalVal, { color: colors.navy }]}>{fmtRupees(subtotal)}</Text>
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
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.orderBtnText}>Place Order</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  emptyText: { fontSize: 12, color: colors.t3, textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.t1, marginBottom: 2 },
  itemPrice: { fontSize: 12, color: colors.t2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, color: colors.t1, fontWeight: '600' },
  qtyNum: { fontSize: 16, fontWeight: '800', color: colors.t1, minWidth: 20, textAlign: 'center' },
  addrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addAddrBtn: { fontSize: 12, fontWeight: '700', color: colors.navy },
  addrCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  addrCardActive: { borderColor: colors.navy, backgroundColor: colors.navy + '08' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.t3, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.navy },
  addrLabel: { fontSize: 12, fontWeight: '700', color: colors.t1, marginBottom: 2 },
  addrText: { fontSize: 11, color: colors.t2, lineHeight: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  grandTotal: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 10 },
  totalLabel: { fontSize: 13, color: colors.t2 },
  totalVal: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  footer: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, padding: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerTotal: { fontSize: 18, fontWeight: '800', color: colors.navy },
  footerItems: { fontSize: 11, color: colors.t3 },
  orderBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  orderBtnText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
