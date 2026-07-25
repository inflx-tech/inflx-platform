/**
 * ReviewOrderScreen — Stage C3, locked board c3-checkout.html frames 1+2.
 * Contract: features/concept-stagec3-checkout/.
 *
 * The step between Bag and payment: address (Change → picker/book) ·
 * condensed items with creator attribution · Pay with (online / COD when the
 * admin knob is on, fee shown honestly) · engine-priced bill. The single
 * yellow CTA reads what it does: "Pay ₹X" or "Place Order" (COD).
 *
 * The ORDER MACHINERY lives here now (moved from CartScreen): guest-first
 * login gate at the final tap, guest-address sync → server address_id,
 * createOrder → Razorpay → verify (online) or createOrder w/
 * payment_method:'cod' → done (no payment sheet). Bill figures arrive from
 * the Bag (engine preview); the backend re-prices authoritatively either way.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, Pressable, Modal,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { useCart } from '../../services/CartContext';
import { processPayment } from '../../services/payment';
import { getGuestAddresses, isGuestAddressId, syncGuestAddresses } from '../../utils/guestAddress';

const YELLOW = '#F6B11E';

function addrLine(a) {
  if (!a) return '';
  return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
}

export default function ReviewOrderScreen({ navigation, route }) {
  const { cart, clear } = useCart();
  const items = cart.items || [];
  // Bill figures from the Bag (engine preview) — display only; the backend
  // re-prices at createOrder.
  const bill = route.params?.bill || {};
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(route.params?.selectedAddr || null);
  const [addrOpen, setAddrOpen] = useState(false);
  const [payWith, setPayWith] = useState('online'); // 'online' | 'cod'
  const [codCfg, setCodCfg] = useState({ enabled: false, fee: 0 });
  const [placing, setPlacing] = useState(false);

  const loadAddresses = useCallback(async (preferId) => {
    try {
      const token = await AsyncStorage.getItem('inflx_token');
      const guests = await getGuestAddresses();
      let addrs = guests;
      if (token) {
        const res = await followerApi.getAddresses?.().catch(() => null);
        addrs = res?.success ? [...(res.data?.addresses || []), ...guests] : guests;
      }
      setAddresses(addrs);
      setSelectedAddr((prev) => {
        if (preferId && addrs.some((a) => a.id === preferId)) return preferId;
        if (prev && addrs.some((a) => a.id === prev)) return prev;
        return addrs.length ? addrs[0].id : null;
      });
    } catch { /* keep prior */ }
  }, []);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);
  useEffect(() => {
    followerApi.getAppConfig?.().then((res) => {
      const cfg = res?.data?.config || {};
      setCodCfg({ enabled: !!cfg.cod_enabled, fee: Math.max(0, parseFloat(cfg.cod_fee) || 0) });
    }).catch(() => {});
  }, []);

  const addrObj = addresses.find((a) => a.id === selectedAddr) || null;
  const isCod = payWith === 'cod' && codCfg.enabled;
  const codFee = isCod ? codCfg.fee : 0;
  const baseTotal = Number(bill.total) || 0;
  const dueTotal = Math.round(baseTotal + codFee);

  // ── the order (moved from CartScreen.placeShopOrder, + the COD branch) ─────
  async function placeOrder() {
    if (!items.length) return;
    if (!selectedAddr) {
      navigation.navigate('Address', { onSave: (a) => loadAddresses(a?.id) });
      return;
    }
    // Guest-first: the ONE login moment. Same tap continues after OTP.
    const token = await AsyncStorage.getItem('inflx_token');
    if (!token) {
      navigation.navigate('FollowerLogin', { onDone: () => placeOrder() });
      return;
    }
    let addressId = selectedAddr;
    if (isGuestAddressId(selectedAddr)) {
      const map = await syncGuestAddresses();
      const serverAddr = map[selectedAddr];
      if (!serverAddr?.id) {
        Alert.alert('Address', 'Could not save your delivery address. Please check it and try again.');
        loadAddresses();
        return;
      }
      addressId = serverAddr.id;
      loadAddresses(serverAddr.id);
    }

    // Group lines by (brand + claiming creator) — identical to the Bag's rails.
    const leadOfferId = cart.appliedOffer?.brand_offer_id || null;
    const groups = new Map();
    for (const i of items) {
      const bid = i.brand_id || cart.brandId;
      const ci = i.claim?.campaign_influencer_id || '';
      const key = `${bid}::${ci}`;
      if (!groups.has(key)) groups.set(key, { brand_id: bid, claim: i.claim || null, lines: [] });
      groups.get(key).lines.push(i);
    }
    // Map a cart line → the backend order item shape (verbatim from the Bag's
    // rails; server re-prices + resolves customisation, client prices are
    // never trusted).
    const toOrderItem = (i) => ({
      product_id: i.product_id,
      quantity: i.qty,
      variant_sku: i.variant_sku || null,
      variant_label: i.variant_label || null,
      variation: i.variation || null,
      addons: Array.isArray(i.selected_addons) ? i.selected_addons : [],
      note: i.note || null,
    });
    const groupArr = [...groups.values()];
    const groupPayload = (g) => {
      const grp = { brand_id: g.brand_id, items: g.lines.map(toOrderItem) };
      if (g.claim?.campaign_influencer_id) {
        grp.campaign_id = g.claim.campaign_id;
        grp.set_id = g.claim.set_id;
        grp.campaign_influencer_id = g.claim.campaign_influencer_id;
        grp.offer_id = g.claim.offer_id || null;
      } else if (g.brand_id === cart.brandId && leadOfferId) {
        grp.brand_offer_id = leadOfferId;
      }
      return grp;
    };

    let payload;
    if (groupArr.length > 1) {
      payload = { address_id: addressId, brand_groups: groupArr.map(groupPayload) };
    } else {
      const g = groupArr[0];
      payload = g.claim?.campaign_influencer_id
        ? {
            items: g.lines.map(toOrderItem), address_id: addressId,
            campaign_id: g.claim.campaign_id, set_id: g.claim.set_id,
            campaign_influencer_id: g.claim.campaign_influencer_id, offer_id: g.claim.offer_id || null,
          }
        : { items: g.lines.map(toOrderItem), address_id: addressId, brand_id: g.brand_id, brand_offer_id: leadOfferId };
    }
    if (isCod) payload.payment_method = 'cod';

    setPlacing(true);
    try {
      const res = await followerApi.createOrder(payload);
      if (!res.success && !res.data) {
        Alert.alert('Order failed', res.error?.message || 'Please try again'); return;
      }

      // ── COD: settled immediately server-side — no payment sheet ────────────
      if (isCod) {
        clear?.();
        navigation.replace('OrderConfirmation', {
          kind: 'shop', cod: true,
          orderId: res.data?.order_id, total: res.data?.total_due ?? dueTotal,
          brandName: cart.brandName,
          addrLabel: addrObj?.label || addrObj?.type || 'Address',
          addrText: addrLine(addrObj),
        });
        return;
      }

      // ── Online: Razorpay → verify (unchanged rails) ─────────────────────────
      const phone = await AsyncStorage.getItem('inflx_user')
        .then((r) => { try { return JSON.parse(r)?.phone || ''; } catch { return ''; } }).catch(() => '');
      const payResult = await processPayment({
        amount: Math.round((res.data?.net_amount || baseTotal) * 100), // paise at the Razorpay boundary
        orderId: res.data?.razorpay_order_id,
        keyId: res.data?.razorpay_key_id,
        description: 'INFLX order',
        brandName: 'INFLX',
        prefill: { contact: phone },
      });
      if (!payResult) { Alert.alert('Payment cancelled', 'You can try again anytime.'); return; }

      const verifyRes = await followerApi.verifyOrder?.({
        razorpay_order_id: payResult.razorpay_order_id,
        razorpay_payment_id: payResult.razorpay_payment_id,
        razorpay_signature: payResult.razorpay_signature,
      });
      if (verifyRes?.success || verifyRes?.data) {
        clear?.();
        navigation.replace('OrderConfirmation', {
          kind: 'shop',
          orderId: verifyRes?.data?.order_id, total: res.data?.net_amount || baseTotal,
          brandName: cart.brandName,
          addrLabel: addrObj?.label || addrObj?.type || 'Address',
          addrText: addrLine(addrObj),
        });
      } else {
        Alert.alert('Verification failed', verifyRes?.error?.message || 'Payment received but verification failed. Contact support.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.hdr}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}><Text style={st.back}>‹</Text></TouchableOpacity>
        <View>
          <Text style={st.title}>Review Order</Text>
          <Text style={st.sub}>{items.reduce((s, i) => s + i.qty, 0)} items{addrObj?.pincode ? ` · Deliver to ${addrObj.pincode}` : ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Deliver to */}
        <View style={st.card}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={st.ct}>Deliver to</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity hitSlop={8}
              onPress={() => (addresses.length ? setAddrOpen(true) : navigation.navigate('Address', { onSave: (a) => loadAddresses(a?.id) }))}>
              <Text style={st.chg}>{addrObj ? 'Change' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
          {addrObj ? (
            <>
              <Text style={st.addrName}>{addrObj.label || addrObj.type || 'Address'}</Text>
              <Text style={st.addrTxt}>{addrLine(addrObj)}</Text>
            </>
          ) : (
            <Text style={st.addrTxt}>No delivery address yet — add one to continue.</Text>
          )}
        </View>

        {/* Items */}
        <View style={st.card}>
          <Text style={st.ct}>Items</Text>
          {items.map((i) => (
            <View key={i.line_key} style={st.iline}>
              {i.image_url
                ? <Image source={{ uri: i.image_url }} style={st.ith} resizeMode="cover" />
                : <View style={[st.ith, { backgroundColor: '#F5F2EC' }]} />}
              <View style={{ flex: 1 }}>
                <Text style={st.inm} numberOfLines={1}>{i.name}</Text>
                <Text style={st.isub} numberOfLines={1}>
                  {[i.variant_label, `Qty ${i.qty}`, i.claim?.creator_handle ? `via @${i.claim.creator_handle}` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={st.ipr}>₹{Math.round((Number(i.price) || 0) * i.qty)}</Text>
            </View>
          ))}
        </View>

        {/* Pay with */}
        <View style={st.card}>
          <Text style={st.ct}>Pay with</Text>
          <TouchableOpacity style={st.pm} onPress={() => setPayWith('online')} activeOpacity={0.8}>
            <View style={[st.radio, payWith === 'online' && st.radioOn]} />
            <View>
              <Text style={st.pmt}>Pay online</Text>
              <Text style={st.pms}>UPI · Cards · Netbanking (opens secure payment)</Text>
            </View>
          </TouchableOpacity>
          {codCfg.enabled && (
            <TouchableOpacity style={[st.pm, { borderBottomWidth: 0 }]} onPress={() => setPayWith('cod')} activeOpacity={0.8}>
              <View style={[st.radio, payWith === 'cod' && st.radioOn]} />
              <View>
                <Text style={st.pmt}>Cash on Delivery</Text>
                {codCfg.fee > 0
                  ? <Text style={st.codFee}>+ ₹{codCfg.fee} COD fee</Text>
                  : <Text style={st.pms}>Pay when your order arrives</Text>}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Bill */}
        <View style={st.card}>
          <Text style={st.ct}>Bill</Text>
          <View style={st.br}><Text style={st.bl}>Item total</Text><Text style={st.bv}>₹{Math.round(Number(bill.itemTotal) || 0)}</Text></View>
          {Number(bill.savings) > 0 && (
            <View style={st.br}><Text style={st.bl}>Savings{bill.offerName ? ` · ${bill.offerName}` : ''}</Text><Text style={st.bg}>−₹{Math.round(bill.savings)}</Text></View>
          )}
          {isCod && codFee > 0 && (
            <View style={st.br}><Text style={st.bl}>COD fee</Text><Text style={st.bv}>₹{codFee}</Text></View>
          )}
          <View style={st.br}><Text style={st.bl}>Delivery</Text><Text style={st.bv}>Free</Text></View>
          <View style={st.btot}>
            <Text style={st.btotL}>{isCod ? 'To Pay on delivery' : 'To Pay'}</Text>
            <Text style={st.btotL}>₹{dueTotal}</Text>
          </View>
          <Text style={st.note}>
            {isCod ? 'Pay in cash or UPI when your order arrives.' : 'Priced by the same engine that charges — no surprises at payment.'}
          </Text>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={st.foot}>
        <View>
          <Text style={st.footAmt}>₹{dueTotal}</Text>
          <Text style={st.footLbl}>{isCod ? 'ON DELIVERY' : 'TO PAY'}</Text>
        </View>
        <Pressable style={[st.cta, placing && { opacity: 0.7 }]} onPress={placeOrder} disabled={placing}>
          {placing ? <ActivityIndicator color="#111" /> : <Text style={st.ctaTxt}>{isCod ? 'Place Order' : `Pay ₹${dueTotal}`}</Text>}
        </Pressable>
      </SafeAreaView>

      {/* Address picker */}
      <Modal visible={addrOpen} transparent animationType="slide" onRequestClose={() => setAddrOpen(false)}>
        <Pressable style={st.dim} onPress={() => setAddrOpen(false)} />
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>Delivery address</Text>
          {addresses.map((a) => {
            const on = a.id === selectedAddr;
            return (
              <Pressable key={a.id} style={st.optRow} onPress={() => { setSelectedAddr(a.id); setAddrOpen(false); }}>
                <View style={[st.radio, on && st.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.optLabel}>{a.label || a.type || 'Address'}</Text>
                  <Text style={st.optSub} numberOfLines={2}>{addrLine(a)}</Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable onPress={() => { setAddrOpen(false); navigation.navigate('Address', { onSave: (a) => loadAddresses(a?.id) }); }}>
            <Text style={st.addLink}>+ Add new address</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: -2 },
  title: { fontSize: 17, fontWeight: '800', color: '#111' },
  sub: { fontSize: 12, color: '#8A8A8A', fontWeight: '600', marginTop: 1 },
  card: { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: '#EEE', borderRadius: 14, padding: 13 },
  ct: { fontSize: 12.5, fontWeight: '800', color: '#111', marginBottom: 8 },
  chg: { fontSize: 12, fontWeight: '800', color: '#111' },
  addrName: { fontSize: 12.5, fontWeight: '800', color: '#111' },
  addrTxt: { fontSize: 12, color: '#555', marginTop: 3, lineHeight: 18 },
  iline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F6F6F6' },
  ith: { width: 42, height: 52, borderRadius: 8 },
  inm: { fontSize: 12, fontWeight: '700', color: '#111' },
  isub: { fontSize: 10.5, color: '#8A8A8A', marginTop: 1 },
  ipr: { fontSize: 12.5, fontWeight: '800', color: '#111' },
  pm: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F6F6F6' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CCC' },
  radioOn: { borderColor: '#111', borderWidth: 6 },
  pmt: { fontSize: 13, fontWeight: '700', color: '#111' },
  pms: { fontSize: 10.5, color: '#8A8A8A', marginTop: 1 },
  codFee: { fontSize: 10.5, color: '#CA8A04', fontWeight: '800', marginTop: 1 },
  br: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  bl: { fontSize: 12.5, color: '#555' },
  bv: { fontSize: 12.5, fontWeight: '800', color: '#111' },
  bg: { fontSize: 12.5, fontWeight: '800', color: '#1E9E5A' },
  btot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE', marginTop: 8, paddingTop: 10 },
  btotL: { fontSize: 15, fontWeight: '800', color: '#111' },
  note: { fontSize: 10.5, color: '#9A9A9A', marginTop: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEE', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  footAmt: { fontSize: 17, fontWeight: '800', color: '#111' },
  footLbl: { fontSize: 9.5, fontWeight: '700', color: '#8A8A8A', letterSpacing: 0.5 },
  cta: { marginLeft: 'auto', backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 30, paddingVertical: 13 },
  ctaTxt: { fontSize: 14, fontWeight: '800', color: '#111' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  sheetTitle: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 6 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F4F4F4' },
  optLabel: { fontSize: 13, fontWeight: '800', color: '#111' },
  optSub: { fontSize: 11.5, color: '#777', marginTop: 1 },
  addLink: { fontSize: 13, fontWeight: '800', color: '#111', paddingTop: 12 },
});
