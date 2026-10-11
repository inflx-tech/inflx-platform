/**
 * O11 · Review and pay — one card per brand parcel with its arrival date and where its items came
 * from; price details; the payment method. O12 · UPI, cards and net banking through Razorpay, or
 * cash on delivery (with its fee) up to the admin limit; above it, greyed with the reason.
 * Place order fixes the price (M8): if anything changed since the bag, the new review shows first
 * and nothing is taken. An online payment has 15 minutes; the items are held meanwhile (6.8).
 *
 * route.params: { lines, buyNow } — Buy now brings its own lines (the bag is untouched); otherwise
 * the bag's ticked lines are ordered.
 *
 * shopper-app-fixes · F1 — an online order is an order only when its payment arrives:
 *   · she closes the payment sheet, the payment fails, or it cannot be confirmed → the items held
 *     for it are released at once (POST /follower/checkout/:id/abandon) and she stays on this
 *     review; her bag was never emptied (the server empties it when the payment arrives);
 *   · the payment arrives after the items were released and they have sold out (`status:
 *     'refunded'`) → "It sold out while you were paying. Your payment is being refunded." — never
 *     "Order placed".
 * F9 — a bag that could not be read is said here with Try again; it is not ordered as an empty one.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

// How long between the tries to tell INFLX about a payment she has made (three tries).
let CONFIRM_WAIT_MS = 1500;
export const _setConfirmWaitForTests = (ms) => { CONFIRM_WAIT_MS = ms; };

/**
 * She has paid: INFLX is told. A refusal is an answer. NO answer (no signal, the server asleep) is
 * not a failed payment — it is tried three times; null means INFLX still could not be reached.
 */
async function confirmPayment(result) {
  for (let i = 0; i < 3; i += 1) {
    let v = null;
    try { v = await followerApi.verifyPayment(result); } catch { v = null; }
    if (v && (v.success || !(v.error && v.error.code === 'NETWORK_ERROR'))) return v;
    if (i < 2) await new Promise((res) => setTimeout(res, CONFIRM_WAIT_MS));
  }
  return null;
}

/** A key no other order attempt of hers will have (letters, digits and dashes; 8 to 64 long). */
export const newPlaceKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 8)}`;

export default function CheckoutScreen({ navigation, route }) {
  const { lines: given = null, buyNow = false } = route.params || {};
  const [lines, setLines] = useState(given ? plain(given) : null);
  const [address, setAddress] = useState(null);
  const [method, setMethod] = useState('online');
  const [rv, setRv] = useState(null);
  const [state, setState] = useState('loading');   // loading · ready · no-address · error
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  // A payment she made that INFLX could not be told about yet: { result, checkoutId }. While it is
  // set there is no Place order — pressing it would have her pay twice.
  const [unconfirmed, setUnconfirmed] = useState(null);
  // listing-shop-safety (C): one key for one order attempt. It goes with Place order and goes
  // AGAIN, unchanged, when she taps a second time because the first answer never came (a slow
  // server): the server then answers with the order it already made. A new review — another
  // address, another way to pay, a changed basket — or an answer received, starts a new key.
  const placeKey = useRef(null);

  // The lines and the default address. A bag that could not be read is an error with Try again
  // (F9) — it used to come back empty, and the review then said "Nothing to order".
  const start = useCallback(async () => {
    let ls = lines;
    if (!ls) {
      let bag;
      try { bag = await loadBag(); } catch (e) { setMsg(e.message || CO.bagLoadFailed); setState('error'); return; }
      ls = plain(bag.filter((l) => l.ticked !== false));
      setLines(ls);
    }
    const r = await followerApi.addresses();
    // S1: addresses that could not be READ are an error with Try again — only a shopper who really
    // has none is asked to add one.
    if (!r || !r.success) { setMsg(r && r.error && r.error.message ? r.error.message : CS.loadError); setState('error'); return; }
    const list = r.data.addresses || [];
    if (!list.length) { setState('no-address'); return; }
    setAddress(list.find((a) => a.is_default) || list[0]);
  }, [lines]);
  useEffect(() => { start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const review = useCallback(async () => {
    if (!address || !lines) return;
    const r = await followerApi.checkoutReview({ address_id: address.id, lines, payment_method: method });
    if (!r || !r.success) { setState('error'); setMsg(r && r.error ? r.error.message : CS.loadError); return; }
    setRv(r.data); setState('ready');
    placeKey.current = newPlaceKey();
    if (method === 'cod' && !r.data.payment.cod.allowed) setMethod('online');
  }, [address, lines, method]);
  useEffect(() => { review(); }, [review]);

  // Try again: whichever read failed — the bag and the address first, else the review.
  function retry() {
    setMsg(null); setState('loading');
    if (!lines || !address) start(); else review();
  }

  /** F1: the items held for an online payment are released now, not after 15 minutes. */
  async function release(checkoutId) {
    try { await followerApi.abandonCheckout(checkoutId); } catch { /* they are released by themselves when the hold ends */ }
  }

  async function place() {
    setBusy(true); setMsg(null);
    let held = null;        // the online checkout whose items are held while she pays
    try {
      if (!placeKey.current) placeKey.current = newPlaceKey();
      const r = await followerApi.placeOrder({ address_id: address.id, lines, payment_method: method, expected_total: rv.total, place_key: placeKey.current });
      if (!r || !r.success) {
        const e = (r && r.error) || {};
        if (e.code === 'PRICE_CHANGED' || (e.code === 'CONFLICT' && e.details)) {
          if (e.details) setRv(e.details);
          setMsg(`${e.message}. ${CO.changed}`);
        } else setMsg(e.message || CS.loadError);
        return;
      }
      const out = r.data;
      placeKey.current = newPlaceKey();        // answered: whatever she does next is a new attempt
      if (out.status === 'placed') { await loadBag().catch(() => {}); navigation.replace('OrderPlaced', { checkoutId: out.checkout_id }); return; }
      held = out.checkout_id;
      const result = await pay(out.razorpay, { phone: address.receiver_phone, name: address.receiver_name });
      if (!result) { setMsg(CO.paymentCancelled); return; }
      const v = await confirmPayment(result);
      if (!v) {
        // She paid, and INFLX could not be reached. Nothing is released: the items stay held for
        // this payment, which is matched to the order by itself. She is told not to pay again.
        held = null;
        setUnconfirmed({ result, checkoutId: out.checkout_id });
        setMsg(CO.paymentUnconfirmed);
        return;
      }
      if (!v.success) { setMsg((v.error && v.error.message) || CO.paymentFailed); return; }
      held = null;          // the payment arrived: the server has settled what was held
      await settled(v, out.checkout_id);
    } catch (e) {
      setMsg(e.message || CO.paymentFailed);
    } finally {
      // Cancelled, failed, or not confirmed: release before she can press Place order again, so
      // her own retry never reads "Sold out". Her bag is as it was.
      if (held) await release(held);
      setBusy(false);
    }
  }

  /** The server has answered about a payment that arrived: the order is placed, or it was refunded. */
  async function settled(v, checkoutId) {
    if (v.data && v.data.status === 'refunded') {
      // It arrived after the items were released, and they have sold out: nothing was ordered and
      // the money is going back. She stays here; the review is read again so it shows what is gone.
      setUnconfirmed(null);
      setMsg(CO.soldOutWhilePaying);
      try {
        const again = await followerApi.checkoutReview({ address_id: address.id, lines, payment_method: method });
        if (again && again.success) setRv(again.data);
      } catch { /* the review she has stays */ }
      return;
    }
    await loadBag().catch(() => {});
    navigation.replace('OrderPlaced', { checkoutId });
  }

  /** "Check again": the same payment is confirmed once more. It never asks her to pay. */
  async function checkAgain() {
    if (!unconfirmed) return;
    setBusy(true);
    try {
      const v = await confirmPayment(unconfirmed.result);
      if (!v) { setMsg(CO.paymentUnconfirmed); return; }
      if (!v.success) { setUnconfirmed(null); setMsg((v.error && v.error.message) || CO.paymentFailed); await release(unconfirmed.checkoutId); return; }
      await settled(v, unconfirmed.checkoutId);
    } finally {
      setBusy(false);
    }
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
        {state === 'error' ? <Empty title={msg || CS.loadError} action={CS.retry} onAction={retry} testID="checkout-error" /> : <Loading />}
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
        {unconfirmed ? (
          // F1: she has paid and INFLX could not be told yet — no Place order here (she would pay twice).
          <>
            <TouchableOpacity style={[b.primary, { marginTop: 0 }, busy && b.primaryDis]} disabled={busy} onPress={checkAgain} testID="check-payment">
              <Text style={b.primaryText}>{CO.checkAgain}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[b.secondary, { marginTop: 10 }]} onPress={() => navigation.navigate('Orders')} testID="unconfirmed-orders">
              <Text style={b.secondaryText}>{CO.myOrders}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[b.primary, { marginTop: 0 }, (!rv.buyable || busy) && b.primaryDis]} disabled={!rv.buyable || busy} onPress={place} testID="place-order">
            <Text style={b.primaryText}>{CO.placeOrder(inr(rv.total))}</Text>
          </TouchableOpacity>
        )}
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
