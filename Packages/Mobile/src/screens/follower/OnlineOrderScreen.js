import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';

/**
 * OnlineOrderScreen — the real stepped checkout (Creators Vibe Yellow 05–07).
 *
 * Step 1 Shipping  → pick/add a saved delivery address
 * Step 2 Payment   → Razorpay (UPI/cards/netbanking/wallets) — NO raw card form
 *                    (PCI; Razorpay's secure sheet handles entry)
 * Step 3 Review    → order summary + PLACE ORDER
 *
 * PLACE ORDER runs the EXISTING real pipeline: createOrder → Razorpay sheet →
 * verifyOrder. The DB order + follower_transactions (4-ID) + influencer commission
 * are written at verify. On success → OrderConfirmation (not a plain alert).
 */
export default function OnlineOrderScreen({ navigation, route }) {
  const { products = [], offer, store, tracking, trackingParams, storeOffer, brand_offer_id } = route.params || {};
  const trk = tracking || trackingParams || null;
  const brandId = storeOffer?.brand_id || store?.brand_id || store?.id || null;

  const [step, setStep] = useState(1);
  const [cart, setCart] = useState(
    products.map(p => ({
      ...p,
      qty: p.qty || p.quantity || 1,
      variant_sku: p.variant_sku || null,
      variant_label: p.variant_label || null,
    }))
  );
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setAddr] = useState(null);
  const [loading, setLoading] = useState(false);

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
      .filter(item => item.qty > 0));
  }

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.qty, 0);

  // Discount estimate from the carried offer (server re-prices authoritatively).
  const ot = String(offer?.offer_type || '').toLowerCase();
  const dval = Number(offer?.discount_value ?? offer?.discount?.value ?? 0) || 0;
  let discount = 0, discountPct = 0;
  if (dval > 0 && subtotal > 0) {
    if (ot === 'flat') { discount = Math.min(dval, subtotal); discountPct = Math.round(discount / subtotal * 100); }
    else { discountPct = dval; discount = Math.round(subtotal * dval / 100); }
  }
  const total = Math.max(0, subtotal - discount);
  const addrObj = addresses.find(a => a.id === selectedAddr) || null;
  const creatorHandle = store?.instagram_handle || null;

  async function placeOrder() {
    if (cart.length === 0) { Alert.alert('Cart empty', 'Add items to your cart'); return; }
    if (!selectedAddr) { Alert.alert('Select address', 'Please add or select a delivery address'); setStep(1); return; }

    const items = cart.map(i => ({
      product_id: i.id,
      quantity: i.qty,
      variant_sku: i.variant_sku || null,
      variant_label: i.variant_label || null,
      // Food customisation — placeOrder resolves these server-side from the DB
      // (variation sets base price; add-ons stack). Maps selected_addons→addons.
      variation: i.variation || null,
      addons: Array.isArray(i.selected_addons) ? i.selected_addons : [],
      note: i.note || null,
    }));
    const isOrganic = !trk?.campaign_influencer_id;
    const payload = isOrganic
      ? { items, address_id: selectedAddr, brand_id: brandId, brand_offer_id: brand_offer_id || null }
      : {
          items, address_id: selectedAddr,
          campaign_id: trk.campaign_id,
          set_id: trk.set_id,
          campaign_influencer_id: trk.campaign_influencer_id,
          offer_id: trk.offer_id || null,
        };

    setLoading(true);
    try {
      const res = await followerApi.createOrder(payload);
      if (!res.success && !res.data) {
        Alert.alert('Order Failed', res.error?.message || 'Please try again');
        return;
      }
      const payResult = await processPayment({
        amount: Math.round((res.data?.net_amount || total) * 100), // paise
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
        navigation.replace('OrderConfirmation', {
          orderId,
          total: res.data?.net_amount || total,
          brandName: store?.name,
        });
      } else {
        Alert.alert('Verification Failed', verifyRes?.error?.message || 'Payment received but verification failed. Contact support.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const STEPS = ['Shipping', 'Payment', 'Review'];

  function onBack() { if (step > 1) setStep(step - 1); else navigation.goBack(); }

  return (
    <View style={s.outer}>
      {/* App bar */}
      <View style={s.appbar}>
        <TouchableOpacity style={s.ib} onPress={onBack}><Text style={s.ibTxt}>←</Text></TouchableOpacity>
        <Text style={s.logo}>INFL<Text style={{ color: C.brown }}>X</Text></Text>
        <View style={s.ib} />
      </View>
      <Text style={s.h1}>Checkout</Text>

      {/* Stepper */}
      <View style={s.stepper}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const on = step === n;
          const done = step > n;
          return (
            <React.Fragment key={label}>
              {i > 0 ? <View style={s.stepLine} /> : null}
              <View style={s.step}>
                <View style={[s.dot, (on || done) && s.dotOn]}><Text style={[s.dotTxt, (on || done) && s.dotTxtOn]}>{done ? '✓' : n}</Text></View>
                <Text style={[s.stepLab, on && s.stepLabOn]}>{label}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* ── Step 1: Shipping ── */}
        {step === 1 && (
          <View style={s.form}>
            <Text style={s.h3}>Delivery Address</Text>
            {addresses.length === 0 ? (
              <Text style={s.muted}>No addresses saved yet. Add one to continue.</Text>
            ) : addresses.map(addr => {
              const on = selectedAddr === addr.id;
              return (
                <TouchableOpacity key={addr.id} style={[s.addrCard, on && s.addrCardOn]} onPress={() => setAddr(addr.id)}>
                  <View style={[s.radio, !on && s.radioOff]}>{on ? <View style={s.radioIn} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.addrLabel}>{addr.label || addr.type || 'Address'}</Text>
                    <Text style={s.addrText}>{[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => navigation.navigate('Address', { onSave: (a) => loadAddresses(a?.id) })}>
              <Text style={s.addLink}>+ Add new address</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2: Payment (Razorpay) ── */}
        {step === 2 && (
          <View style={s.form}>
            <Text style={s.h3}>Payment Method</Text>
            <View style={s.payCard}>
              <View style={s.payHead}>
                <View style={s.radio}><View style={s.radioIn} /></View>
                <Text style={s.payName}>Razorpay</Text>
                <Text style={s.paySecure}>Secure</Text>
              </View>
              <View style={s.methods}>
                {['UPI', 'Cards', 'NetBanking', 'Wallets'].map(m => (
                  <View key={m} style={s.mchip}><Text style={s.mchipTxt}>{m}</Text></View>
                ))}
              </View>
              <Text style={s.rzpNote}>You'll complete payment in Razorpay's secure sheet. INFLX never stores your card details.</Text>
              <Text style={s.secure}>🔒 PCI-DSS secure · powered by Razorpay</Text>
            </View>
          </View>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <>
            <View style={s.form}>
              <Text style={s.h3}>Order Summary</Text>
              {cart.map(item => (
                <View key={item.id} style={s.revItem}>
                  <View style={s.revThumb}>
                    {item.image_url ? <Image source={{ uri: item.image_url }} style={s.revThumbImg} /> : <Text style={{ fontSize: 20 }}>🛍️</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.revNm} numberOfLines={1}>{item.name}</Text>
                    {item.variation_name || (item.addon_names || []).length
                      ? <Text style={s.revVar} numberOfLines={2}>{[item.variation_name, (item.addon_names || []).join(', ')].filter(Boolean).join(' · ')}</Text>
                      : item.variant_label ? <Text style={s.revVar}>{item.variant_label}</Text> : null}
                    {item.note ? <Text style={s.revVar}>“{item.note}”</Text> : null}
                    {creatorHandle ? <Text style={s.revBy}>via @{creatorHandle}</Text> : null}
                    <View style={s.qty}>
                      <TouchableOpacity onPress={() => updateQty(item.id, -1)}><Text style={s.qtyBtn}>−</Text></TouchableOpacity>
                      <Text style={s.qtyNum}>{item.qty}</Text>
                      <TouchableOpacity onPress={() => updateQty(item.id, 1)}><Text style={s.qtyBtn}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                  <Text style={s.revPr}>{fmtRupees((Number(item.price) || 0) * item.qty)}</Text>
                </View>
              ))}
              <View style={s.totals}>
                <View style={s.srow}><Text style={s.mut}>Subtotal</Text><Text style={s.sval}>{fmtRupees(subtotal)}</Text></View>
                <View style={s.srow}><Text style={s.mut}>Shipping</Text><Text style={s.sval}>Free</Text></View>
                {discount > 0 ? <View style={s.srow}><Text style={s.mut}>Creator discount{discountPct ? ` (${discountPct}%)` : ''}</Text><Text style={s.disc}>−{fmtRupees(discount)}</Text></View> : null}
                <View style={s.totalRow}><Text style={s.totalLbl}>Total</Text><Text style={s.totalVal}>{fmtRupees(total)}</Text></View>
                {discount > 0 ? <Text style={s.estimate}>Final price confirmed by Razorpay at payment.</Text> : null}
              </View>
            </View>
            <View style={s.addrBlock}>
              <View style={s.addrHd}>
                <Text style={s.h4}>Shipping Address</Text>
                <TouchableOpacity onPress={() => setStep(1)}><Text style={s.addLink}>Change</Text></TouchableOpacity>
              </View>
              {addrObj ? (
                <Text style={s.addrText}>{addrObj.label || 'Address'} · {[addrObj.line1, addrObj.line2, addrObj.city, addrObj.state, addrObj.pincode].filter(Boolean).join(', ')}</Text>
              ) : <Text style={s.muted}>No address selected.</Text>}
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer CTA per step */}
      <View style={s.footer}>
        {step === 1 && (
          <TouchableOpacity style={[s.cta, !selectedAddr && s.ctaOff]} disabled={!selectedAddr} onPress={() => setStep(2)}>
            <Text style={s.ctaTxt}>CONTINUE TO PAYMENT</Text>
          </TouchableOpacity>
        )}
        {step === 2 && (
          <TouchableOpacity style={s.cta} onPress={() => setStep(3)}>
            <Text style={s.ctaTxt}>CONTINUE TO REVIEW</Text>
          </TouchableOpacity>
        )}
        {step === 3 && (
          <TouchableOpacity style={[s.cta, (loading || cart.length === 0 || !selectedAddr) && s.ctaOff]} disabled={loading || cart.length === 0 || !selectedAddr} onPress={placeOrder}>
            {loading ? <ActivityIndicator color={C.onGold} /> : <Text style={s.ctaTxt}>PLACE ORDER · {fmtRupees(total)}</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: C.screenBg },
  appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 6 },
  ib: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ibTxt: { fontSize: 18, color: C.ink },
  logo: { fontSize: 16, fontWeight: '800', color: C.ink, letterSpacing: 1.4, fontFamily: fonts.displayBold },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink, paddingHorizontal: 20, paddingBottom: 4, fontFamily: fonts.displayBold },

  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EDE5DA', alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: C.brown },
  dotTxt: { fontSize: 12, fontWeight: '700', color: C.muted },
  dotTxtOn: { color: C.onGold },
  stepLab: { fontSize: 12, fontWeight: '600', color: C.muted },
  stepLabOn: { color: C.ink },
  stepLine: { flex: 1, height: 1, backgroundColor: C.line, marginHorizontal: 7 },

  form: { paddingHorizontal: 20, paddingTop: 4 },
  h3: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 14, fontFamily: fonts.sansBold },
  h4: { fontSize: 14, fontWeight: '800', color: C.ink },
  muted: { fontSize: 12.5, color: C.muted },

  addrCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: C.line, borderRadius: 11, padding: 12, marginBottom: 10 },
  addrCardOn: { borderColor: C.brown, backgroundColor: C.soft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.brown, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioOff: { borderColor: C.muted },
  radioIn: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brown },
  addrLabel: { fontSize: 12.5, fontWeight: '700', color: C.ink },
  addrText: { fontSize: 11.5, color: C.muted, marginTop: 2, lineHeight: 16 },
  addLink: { fontSize: 12.5, fontWeight: '700', color: C.goldDeep, marginTop: 4 },

  payCard: { borderWidth: 1, borderColor: C.brown, borderRadius: 14, padding: 15 },
  payHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payName: { fontSize: 14, fontWeight: '700', color: C.ink, flex: 1 },
  paySecure: { fontSize: 11, color: C.goldDeep, fontWeight: '700' },
  methods: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 12 },
  mchip: { height: 24, paddingHorizontal: 9, borderRadius: 5, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  mchipTxt: { fontSize: 10, fontWeight: '700', color: C.ink },
  rzpNote: { fontSize: 11.5, color: C.muted, marginTop: 12, lineHeight: 16 },
  secure: { fontSize: 11, color: '#7C8A5A', fontWeight: '700', marginTop: 10 },

  revItem: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.line },
  revThumb: { width: 48, height: 56, borderRadius: 9, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  revThumbImg: { width: '100%', height: '100%' },
  revNm: { fontSize: 13, fontWeight: '700', color: C.ink },
  revVar: { fontSize: 11, color: C.muted, marginTop: 2 },
  revBy: { fontSize: 10, color: C.goldDeep, fontWeight: '700', marginTop: 2 },
  revPr: { fontSize: 13, fontWeight: '700', color: C.ink },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  qtyBtn: { fontSize: 15, fontWeight: '700', color: C.ink },
  qtyNum: { fontSize: 12.5, fontWeight: '800', color: C.ink, minWidth: 12, textAlign: 'center' },

  totals: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14, marginTop: 4 },
  srow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  mut: { fontSize: 13, color: C.muted },
  sval: { fontSize: 13, color: C.ink, fontWeight: '600' },
  disc: { fontSize: 13, color: C.offer, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 13, borderTopWidth: 1, borderTopColor: C.line },
  totalLbl: { fontSize: 17, fontWeight: '800', color: C.ink },
  totalVal: { fontSize: 17, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  estimate: { fontSize: 10.5, color: C.muted, marginTop: 8, fontStyle: 'italic' },

  addrBlock: { paddingHorizontal: 20, paddingTop: 14 },
  addrHd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

  footer: { backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 },
  cta: { backgroundColor: C.brown, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  ctaOff: { opacity: 0.5 },
  ctaTxt: { fontSize: 14, fontWeight: '800', color: C.onGold, letterSpacing: 0.8, fontFamily: fonts.sansBold },
});
