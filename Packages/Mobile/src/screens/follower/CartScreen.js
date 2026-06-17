import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
} from 'react-native';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';
import { useCart } from '../../services/CartContext';

/**
 * CartScreen — generic multi-item cart for ALL verticals (Creators Vibe Yellow
 * screen 04). Backed by CartContext (AsyncStorage-persisted, brand-scoped).
 *
 * FUNCTIONAL, not UI-only:
 *  - qty steppers / remove mutate the real cart (updateQty/removeItem)
 *  - CHECKOUT hands the cart's items + the 4-ID `tracking` to the existing
 *    OnlineOrderScreen → real createOrder → Razorpay → verifyOrder. The tracking
 *    is what writes follower_transactions + the influencer commission (audited).
 *  - The discount line is the cart-side ESTIMATE from the carried offer; the
 *    backend re-prices authoritatively at order time.
 */
export default function CartScreen({ navigation }) {
  const { cart, updateQty, removeItem } = useCart();
  const items = cart.items || [];

  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * i.qty, 0);

  // Cart-side discount estimate from the carried offer (server is authoritative).
  const offer = cart.offer || null;
  const ot = String(offer?.offer_type || '').toLowerCase();
  const dval = Number(offer?.discount_value ?? offer?.discount?.value ?? 0) || 0;
  let discount = 0;
  let discountPct = 0;
  if (dval > 0 && subtotal > 0) {
    if (ot === 'flat') { discount = Math.min(dval, subtotal); discountPct = Math.round((discount / subtotal) * 100); }
    else { discountPct = dval; discount = Math.round(subtotal * dval / 100); } // percentage / discount / default
  }
  const total = Math.max(0, subtotal - discount);
  const count = items.reduce((s, i) => s + i.qty, 0);

  function checkout() {
    navigation.navigate('OnlineOrder', {
      products: items.map(i => ({
        id: i.product_id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        image_url: i.image_url,
        variant_sku: i.variant_sku || null,
        variant_label: i.variant_label || null,
      })),
      offer,
      store: { id: cart.brandId, name: cart.brandName },
      tracking: cart.tracking || null,
      trackingParams: cart.tracking || null,
    });
  }

  return (
    <View style={s.outer}>
      {/* App bar */}
      <View style={s.appbar}>
        <TouchableOpacity style={s.ib} onPress={() => navigation.goBack()}><Text style={s.ibTxt}>←</Text></TouchableOpacity>
        <Text style={s.logo}>INFL<Text style={{ color: C.brown }}>X</Text></Text>
        <View style={s.ib}><Text style={s.ibTxt}>🛒</Text>{count > 0 ? <View style={s.badge}><Text style={s.badgeTxt}>{count}</Text></View> : null}</View>
      </View>

      <Text style={s.h1}>Your Cart{count ? ` (${count})` : ''}</Text>

      {items.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>🛍️</Text>
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptyText}>Browse products and tap “Add to Cart”.</Text>
          <TouchableOpacity style={s.browseBtn} onPress={() => navigation.goBack()}>
            <Text style={s.browseTxt}>Browse</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {items.map(item => (
              <View key={item.line_key} style={s.citem}>
                <View style={s.thumb}>
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={s.thumbImg} resizeMode="cover" />
                    : <Text style={{ fontSize: 28 }}>🛍️</Text>}
                </View>
                <View style={s.cdet}>
                  <Text style={s.nm} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.var} numberOfLines={1}>
                    {[item.variant_label, cart.brandName].filter(Boolean).join(' · ')}
                  </Text>
                  {cart.creatorHandle ? <Text style={s.by}>via @{cart.creatorHandle}</Text> : null}
                  <View style={s.qty}>
                    <TouchableOpacity onPress={() => updateQty(item.line_key, item.qty - 1)}><Text style={s.qtyBtn}>−</Text></TouchableOpacity>
                    <Text style={s.qtyNum}>{item.qty}</Text>
                    <TouchableOpacity onPress={() => updateQty(item.line_key, item.qty + 1)}><Text style={s.qtyBtn}>+</Text></TouchableOpacity>
                  </View>
                </View>
                <View style={s.cright}>
                  <TouchableOpacity onPress={() => removeItem(item.line_key)} hitSlop={8}><Text style={s.x}>✕</Text></TouchableOpacity>
                  <Text style={s.cprice}>{fmtRupees((Number(item.price) || 0) * item.qty)}</Text>
                </View>
              </View>
            ))}

            {/* Summary */}
            <View style={s.summary}>
              <Text style={s.sumTitle}>Cart Summary</Text>
              <View style={s.srow}><Text style={s.mut}>Subtotal</Text><Text style={s.sval}>{fmtRupees(subtotal)}</Text></View>
              <View style={s.srow}><Text style={s.mut}>Shipping</Text><Text style={s.sval}>Free</Text></View>
              {discount > 0 ? (
                <View style={s.srow}><Text style={s.mut}>Creator discount{discountPct ? ` (${discountPct}%)` : ''}</Text><Text style={s.disc}>−{fmtRupees(discount)}</Text></View>
              ) : null}
              <View style={s.totalRow}><Text style={s.totalLbl}>Total</Text><Text style={s.totalVal}>{fmtRupees(total)}</Text></View>
              {discount > 0 ? <Text style={s.estimate}>Final price confirmed at checkout.</Text> : null}
            </View>
            <View style={{ height: 110 }} />
          </ScrollView>

          {/* Checkout */}
          <View style={s.footer}>
            <TouchableOpacity style={s.checkout} onPress={checkout}>
              <Text style={s.checkoutTxt}>CHECKOUT · {fmtRupees(total)}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: C.screenBg },
  appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8 },
  ib: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ibTxt: { fontSize: 18, color: C.ink },
  logo: { fontSize: 17, fontWeight: '800', color: C.ink, letterSpacing: 1.4, fontFamily: fonts.displayBold },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 9, fontWeight: '800', color: C.onGold },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 8, fontFamily: fonts.displayBold },

  citem: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line, alignItems: 'flex-start' },
  thumb: { width: 74, height: 84, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  cdet: { flex: 1 },
  nm: { fontSize: 14.5, fontWeight: '700', color: C.ink, fontFamily: fonts.sansBold },
  var: { fontSize: 12, color: C.muted, marginTop: 2 },
  by: { fontSize: 11, color: C.goldDeep, fontWeight: '700', marginTop: 4, fontFamily: fonts.sansBold },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  qtyBtn: { fontSize: 17, fontWeight: '700', color: C.ink, lineHeight: 20 },
  qtyNum: { fontSize: 13.5, fontWeight: '800', color: C.ink, minWidth: 14, textAlign: 'center' },
  cright: { alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 84 },
  x: { fontSize: 15, color: C.muted },
  cprice: { fontSize: 14.5, fontWeight: '800', color: C.ink, fontFamily: fonts.sansBold },

  summary: { paddingHorizontal: 20, paddingTop: 18 },
  sumTitle: { fontSize: 14.5, fontWeight: '800', color: C.ink, marginBottom: 14, fontFamily: fonts.sansBold },
  srow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 11 },
  mut: { fontSize: 13.5, color: C.muted },
  sval: { fontSize: 13.5, color: C.ink, fontWeight: '600' },
  disc: { fontSize: 13.5, color: C.offer, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  totalLbl: { fontSize: 18, fontWeight: '800', color: C.ink },
  totalVal: { fontSize: 18, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  estimate: { fontSize: 10.5, color: C.muted, marginTop: 8, fontStyle: 'italic' },

  footer: { backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 },
  checkout: { backgroundColor: C.brown, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  checkoutTxt: { fontSize: 14, fontWeight: '800', color: C.onGold, letterSpacing: 0.8, fontFamily: fonts.sansBold },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 6, fontFamily: fonts.sansBold },
  emptyText: { fontSize: 12.5, color: C.muted, textAlign: 'center', marginBottom: 18 },
  browseBtn: { backgroundColor: C.brown, borderRadius: 11, paddingHorizontal: 26, paddingVertical: 12 },
  browseTxt: { fontSize: 13, fontWeight: '800', color: C.onGold, fontFamily: fonts.sansBold },
});
