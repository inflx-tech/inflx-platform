/**
 * O11 · Review and pay — one card per brand parcel with its arrival date and where its items came
 * from; price details; the payment method. O12 · UPI, cards and net banking through Razorpay, or
 * cash on delivery (with its fee) up to the admin limit; above it, greyed with the reason.
 * Place order fixes the price (M8): if anything changed since the bag, the new review shows first
 * and nothing is taken. An online payment has 15 minutes; the items are held meanwhile (6.8).
 *
 * route.params: { lines, buyNow } — Buy now brings its own lines (the bag is untouched); otherwise
 * the bag's ticked lines are ordered.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty } from '../../../components/shop/bitsShop';
import { MoneyRows, Notes, K, b } from '../../../components/shop/orderBits';
import { CO, dayLabel } from '../../../components/shop/copyOrder';
import { CS, inr } from '../../../components/shop/copyShop';
import { loadBag } from '../../../components/shop/bag';
import { addressLines } from './AddressesScreen';
import { fonts } from '../../../theme/tokens';

const plain = (xs) => xs.map(({ ref, post_id, product_id, gift_item_id, colour, size, qty, role, price_seen }) => ({ ref, post_id, product_id, gift_item_id, colour, size, qty, role, price_seen }));

/** Razorpay's sheet. A server in test mode hands out test orders: those are confirmed on a prompt. */
async function pay({ order_id: orderId, key_id: keyId, amount }, prefill) {
  if (String(orderId || '').startsWith('order_mock_')) {
    return new Promise((resolve) => {
      Alert.alert(CO.testPayment, CO.testPaymentBody, [
        { text: CO.cancel, style: 'cancel', onPress: () => resolve(null) },
        { text: CO.confirm, onPress: () => resolve({ razorpay_payment_id: `pay_mock_${Date.now()}`, razorpay_order_id: orderId, razorpay_signature: 'mock' }) },
      ]);
    });
  }
  const RazorpayCheckout = require('react-native-razorpay').default;
  try {
    const r = await RazorpayCheckout.open({
      key: keyId, order_id: orderId, amount: Math.round(Number(amount) * 100), currency: 'INR', name: 'INFLX',
      description: 'Your order', prefill: { contact: prefill.phone || '', name: prefill.name || '' }, theme: { color: '#FFC700' },
    });
    return { razorpay_payment_id: r.razorpay_payment_id, razorpay_order_id: r.razorpay_order_id || orderId, razorpay_signature: r.razorpay_signature };
  } catch (e) {
    if (e && (e.code === 2 || e.code === 0 || /cancel/i.test(String(e.description || '')))) return null;
    throw new Error(CO.paymentFailed);       // never a pretend success (no mock fallback here)
  }
}

export default function CheckoutScreen({ navigation, route }) {
  const { lines: given = null, buyNow = false } = route.params || {};
  const [lines, setLines] = useState(given ? plain(given) : null);
  const [address, setAddress] = useState(null);
  const [method, setMethod] = useState('online');
  const [rv, setRv] = useState(null);
  const [state, setState] = useState('loading');   // loading · ready · no-address · error
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // The lines and the default address.
  useEffect(() => {
    (async () => {
      let ls = lines;
      if (!ls) {
        const bag = await loadBag();
        ls = plain(bag.filter((l) => l.ticked !== false));
        setLines(ls);
      }
      const r = await followerApi.addresses();
      const list = r && r.success ? r.data.addresses || [] : [];
      if (!list.length) { setState('no-address'); return; }
      setAddress(list.find((a) => a.is_default) || list[0]);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const review = useCallback(async () => {
    if (!address || !lines) return;
    const r = await followerApi.checkoutReview({ address_id: address.id, lines, payment_method: method });
    if (!r || !r.success) { setState('error'); setMsg(r && r.error ? r.error.message : CS.loadError); return; }
    setRv(r.data); setState('ready');
    if (method === 'cod' && !r.data.payment.cod.allowed) setMethod('online');
  }, [address, lines, method]);
  useEffect(() => { review(); }, [review]);

  async function place() {
    setBusy(true); setMsg(null);
    try {
      const r = await followerApi.placeOrder({ address_id: address.id, lines, payment_method: method, expected_total: rv.total });
      if (!r || !r.success) {
        const e = (r && r.error) || {};
        if (e.code === 'PRICE_CHANGED' || (e.code === 'CONFLICT' && e.details)) {
          if (e.details) setRv(e.details);
          setMsg(`${e.message}. ${CO.changed}`);
        } else setMsg(e.message || CS.loadError);
        return;
      }
      const out = r.data;
      if (out.status === 'placed') { await loadBag().catch(() => {}); navigation.replace('OrderPlaced', { checkoutId: out.checkout_id }); return; }
      const result = await pay(out.razorpay, { phone: address.receiver_phone, name: address.receiver_name });
      if (!result) { setMsg(CO.paymentCancelled); return; }
      const v = await followerApi.verifyPayment(result);
      if (!v || !v.success) { setMsg((v && v.error && v.error.message) || CO.paymentFailed); return; }
      await loadBag().catch(() => {});
      navigation.replace('OrderPlaced', { checkoutId: out.checkout_id });
    } catch (e) {
      setMsg(e.message || CO.paymentFailed);
    } finally { setBusy(false); }
  }

  if (state === 'no-address') {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar title={CO.reviewOrder} onBack={() => navigation.goBack()} />
        <Empty title={CO.addAddress} action={CO.addNew} testID="checkout-no-address"
          onAction={() => navigation.navigate('AddressForm', { onSaved: (a) => { setAddress(a); setState('loading'); } })} />
      </SafeAreaView>
    );
  }
  if (state === 'loading' || !rv) {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar title={CO.reviewOrder} onBack={() => navigation.goBack()} />
        {state === 'error' ? <Empty title={msg || CS.loadError} action={CS.retry} onAction={review} /> : <Loading />}
      </SafeAreaView>
    );
  }
  const cod = rv.payment.cod;
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CO.reviewOrder} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 20 }} testID="checkout">
        {rv.savings > 0 ? <Text style={st.saving}>{CO.savingNote(inr(rv.savings))}</Text> : null}
        <View style={st.card}>
          <View style={st.rowBetween}>
            <Text style={st.lab}>{CO.deliverTo}</Text>
            <Text style={st.act} onPress={() => navigation.navigate('Addresses', { pick: true, selectedId: address.id, onPick: setAddress })} testID="change-address">{CO.change}</Text>
          </View>
          <Text style={st.name}>{address.receiver_name}{address.label ? ` · ${address.label}` : ''}</Text>
          <Text style={st.lines}>{addressLines(address)}</Text>
        </View>

        {rv.parcels.map((p, i) => (
          <View key={(p.brand && p.brand.id) || i} style={st.card} testID={`parcel-${i}`}>
            <View style={st.rowBetween}>
              <Text style={st.name}>{p.brand ? p.brand.name : ''}</Text>
              <Text style={st.arrive}>{CO.arrivesBy(dayLabel(p.arrives_by))}</Text>
            </View>
            {p.groups.map((g) => (
              <View key={g.post_id} style={{ marginTop: 6 }}>
                {g.lines.map((l, j) => (
                  <View key={`${l.ref}-${j}`} style={st.item}>
                    <Text style={st.itemName} numberOfLines={1}>{l.role === 'gift' ? CO.freeGift(l.name) : l.name}{[l.colour, l.size].filter(Boolean).length ? ` · ${[l.colour, l.size].filter(Boolean).join(' · ')}` : ''}{l.qty > 1 ? ` ×${l.qty}` : ''}</Text>
                    <Text style={st.itemPrice}>{l.role === 'gift' || l.role === 'free' ? '₹0' : inr(l.paid_total)}</Text>
                  </View>
                ))}
                {g.creator ? <Text style={st.from}>{CO.fromPost(g.creator.name.split(' ')[0])}</Text> : null}
                <Notes problems={[...g.problems, ...g.lines.flatMap((l) => l.problems || [])]} notes={g.lines.flatMap((l) => l.notes || [])} />
              </View>
            ))}
          </View>
        ))}

        <MoneyRows normal={rv.items_normal} savings={rv.savings} delivery={rv.delivery_fee} codFee={rv.cod_fee} total={rv.total} />

        <Text style={[st.lab, { marginTop: 16 }]}>{CO.paymentMethod}</Text>
        <TouchableOpacity style={[st.method, method === 'online' && st.methodOn]} onPress={() => setMethod('online')} testID="pay-online">
          <Text style={st.mName}>{CO.payOnline}</Text>
          <Text style={st.mSub}>{CO.payOnlineSub}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.method, method === 'cod' && st.methodOn, !cod.allowed && { opacity: 0.5 }]} disabled={!cod.allowed} onPress={() => setMethod('cod')} testID="pay-cod">
          <Text style={st.mName}>{CO.cod}</Text>
          <Text style={st.mSub}>{cod.allowed ? CO.codSub(cod.fee) : cod.reason}</Text>
        </TouchableOpacity>
        {method === 'online' ? <Text style={st.hint}>{CO.holdNote}</Text> : null}
        {buyNow ? null : <Text style={st.hint}>{CO.parcels(rv.parcels.length)}</Text>}
        {msg ? <Text style={b.problem} testID="checkout-msg">{msg}</Text> : null}
      </ScrollView>
      <View style={st.bar}>
        <TouchableOpacity style={[b.primary, { marginTop: 0 }, (!rv.buyable || busy) && b.primaryDis]} disabled={!rv.buyable || busy} onPress={place} testID="place-order">
          <Text style={b.primaryText}>{CO.placeOrder(inr(rv.total))}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  saving: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ok, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: K.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  lab: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink2 },
  act: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink, textDecorationLine: 'underline' },
  name: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink, marginTop: 4 },
  lines: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink2, marginTop: 2, lineHeight: 18 },
  arrive: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ok },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 3 },
  itemName: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink, flex: 1 },
  itemPrice: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink },
  from: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink3, marginTop: 2 },
  method: { borderWidth: 1.5, borderColor: K.border, borderRadius: 14, padding: 12, marginTop: 8 },
  methodOn: { borderColor: K.ink, borderWidth: 2 },
  mName: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink },
  mSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 2 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink2, marginTop: 8 },
  bar: { padding: 14, borderTopWidth: 1, borderTopColor: K.border },
});
