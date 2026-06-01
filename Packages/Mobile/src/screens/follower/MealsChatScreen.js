/**
 * MealsChatScreen — INFLX Meals customer chat → offers → pay (P4, mockup 02).
 *
 * The customer states what they want; the AI (mock locally) extracts
 * intent, asks one meaningful follow-up if needed, then the deterministic
 * engine returns a ranked shortlist with the AI's recommendation. The
 * customer pays before the slot cutoff to lock the order. Prices come
 * from the engine — never the AI.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { creatorVibe as C, fonts } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim (see DiningHome). Visual only; meals
// chat/intent/engine + pay logic unchanged.
const lightColors = {
  white: C.card, paper: C.card, bg: C.screenBg, bg2: C.soft, surface: C.soft, surface2: C.line,
  ink: C.ink, ink2: C.ink, muted: C.muted, muted2: C.muted, muted3: C.muted, muted4: C.line,
  border: C.line, borderSoft: C.line, border2: C.line,
  yellow: C.brown, yellowHover: C.brownDark, yellowDeep: C.brownDark, yellowLight: C.star,
  yellowPale: C.soft, yellow50: C.soft, yellow100: C.soft, yellow200: C.soft, yellowText: C.brown,
  success: '#1E9E5A', successPale: C.soft, successText: '#1E9E5A', success50: C.soft, success100: C.soft,
  warning: C.star, warning50: C.soft, warning100: C.soft,
  danger: C.offer, dangerPale: C.soft, dangerText: C.offer, danger50: C.soft,
  star: C.star, black: C.ink,
};
import { mealsApi } from '../../services/api';

export default function MealsChatScreen({ route, navigation }) {
  const brand = route?.params?.brand || {};
  const brandId = route?.params?.brandId || brand.id;

  const [msgs, setMsgs] = useState([
    { from: 'bot', text: `Hi! Tell me what you'd like from ${brand.business_name || 'this kitchen'} — e.g. "family lunch tomorrow, 2 chicken & 2 veg biryani, medium".` },
  ]);
  const [input, setInput] = useState('');
  const [offers, setOffers] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);

  // ADDRESS-FIRST (founder's lock): after the first message we ask
  // "where should we deliver?" before computing any offers.
  const [addrPicker, setAddrPicker] = useState(null);   // { saved_addresses, question }
  const [partialIntent, setPartialIntent] = useState(null);
  const scroller = useRef(null);

  useEffect(() => { scroller.current?.scrollToEnd({ animated: true }); }, [msgs, offers, order, addrPicker]);

  function push(m) { setMsgs((prev) => [...prev, m]); }

  function handleResponse(d, ok) {
    if (!ok && !d?.stage) {
      push({ from: 'bot', text: 'Sorry, something went wrong. Please try again.' });
      return;
    }
    if (d.stage === 'clarify') {
      push({ from: 'bot', text: d.question });
    } else if (d.stage === 'address_required') {
      push({ from: 'bot', text: d.question || 'Where should we deliver this?' });
      setAddrPicker({ saved_addresses: d.saved_addresses || [], use_current_location: !!d.use_current_location });
      setPartialIntent(d.extracted || null);
    } else if (d.stage === 'out_of_range') {
      push({ from: 'bot', text: d.message || 'Sorry — this restaurant is outside the delivery range.' });
    } else if (d.stage === 'no_match') {
      push({ from: 'bot', text: d.message || 'Sorry — no match for your request right now.' });
    } else if (d.stage === 'offers') {
      push({ from: 'bot', text: "Here's what I found 👇 I've starred my pick." });
      setOffers(d.offers || []);
      setRecommendation(d.recommendation || null);
      setAddrPicker(null);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    push({ from: 'me', text });
    setInput('');
    setBusy(true);
    try {
      const res = await mealsApi.chat({ message: text, brand_id: brandId });
      handleResponse(res?.data || res, !!res?.success);
    } catch (e) {
      push({ from: 'bot', text: 'Network error — please try again.' });
    } finally { setBusy(false); }
  }

  async function submitWithAddress(drop) {
    if (busy) return;
    setBusy(true);
    const label = drop.label || drop.address || 'this address';
    push({ from: 'me', text: `📍 Deliver to ${label}` });
    try {
      const res = await mealsApi.chat({ brand_id: brandId, drop_location: drop, partial_intent: partialIntent });
      handleResponse(res?.data || res, !!res?.success);
    } catch (e) {
      push({ from: 'bot', text: 'Network error — please try again.' });
    } finally { setBusy(false); }
  }

  async function pay(offer) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await mealsApi.pay(offer.id);
      const d = res?.data || res;
      if (res?.success && d.order) {
        setOrder(d.order);
        setOffers(null);
        push({ from: 'bot', text: `Locked! ₹${Math.round(d.order.amount)} paid. We'll deliver before your slot. 🛵` });
      } else if (d?.error?.code === 'OFFER_EXPIRED') {
        Alert.alert('Cutoff passed', 'The order cutoff for this slot has passed.');
      } else if (d?.error?.code === 'SLOT_FULL') {
        Alert.alert('Slot full', 'This meal slot is fully booked.');
      } else {
        Alert.alert('Could not pay', d?.error?.message || 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.hdr}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Text style={styles.back}>←</Text></Pressable>
        <View>
          <Text style={styles.title}>INFL<Text style={{ color: lightColors.yellow }}>X</Text> Meals</Text>
          <Text style={styles.sub}>Plan your meal</Text>
        </View>
      </View>

      <ScrollView ref={scroller} style={styles.thread} contentContainerStyle={{ padding: 14, gap: 10 }}>
        {msgs.map((m, i) => (
          <View key={i} style={[styles.bubble, m.from === 'me' ? styles.me : styles.bot]}>
            <Text style={[styles.bubbleText, m.from === 'me' && { color: '#fff' }]}>{m.text}</Text>
          </View>
        ))}

        {offers && offers.map((o) => {
          const isRec = recommendation && recommendation.recommended_offer_id === o.id;
          return (
            <View key={o.id} style={[styles.ocard, isRec && styles.ocardBest]} testID={`meal-offer-${o.rank}`}>
              {isRec && <Text style={styles.bestTag}>⭐ AI suggests this</Text>}
              <Text style={styles.rName}>{brand.business_name || 'Restaurant'}</Text>
              <Text style={styles.rPrice}>
                ₹{Math.round(o.price)}
                {o.original_price && Number(o.original_price) > Number(o.price)
                  ? <Text style={styles.rStrike}>  ₹{Math.round(o.original_price)}</Text> : null}
              </Text>
              {isRec && recommendation?.reasoning ? <Text style={styles.rWhy}>{recommendation.reasoning}</Text> : null}
              <Pressable onPress={() => pay(o)} style={[styles.pick, isRec && styles.pickBest]} testID={`meal-pay-${o.rank}`}>
                <Text style={[styles.pickText, isRec && { color: lightColors.ink }]}>Pay ₹{Math.round(o.price)} &amp; lock</Text>
              </Pressable>
            </View>
          );
        })}

        {addrPicker && (
          <View style={styles.picker} testID="meal-addr-picker">
            <Text style={styles.pickerTitle}>📍 Where should we deliver?</Text>
            {(addrPicker.saved_addresses || []).map((a) => (
              <Pressable key={a.id}
                onPress={() => submitWithAddress({
                  lat: a.lat != null ? Number(a.lat) : 16.5062,
                  lng: a.lng != null ? Number(a.lng) : 80.6480,
                  label: a.label || a.line1,
                  address: [a.line1, a.line2, a.city].filter(Boolean).join(', '),
                })}
                style={styles.pickerChip} testID={`meal-addr-saved-${a.id}`}>
                <Text style={styles.pickerChipText}>🏠 {a.label || a.line1}</Text>
                <Text style={styles.pickerChipSub} numberOfLines={1}>{[a.line1, a.city].filter(Boolean).join(', ')}</Text>
              </Pressable>
            ))}
            {addrPicker.use_current_location && (
              <Pressable
                onPress={() => submitWithAddress({ lat: 16.5062, lng: 80.6480, label: 'Current location', address: 'Detected location' })}
                style={[styles.pickerChip, styles.pickerChipGps]} testID="meal-addr-gps">
                <Text style={styles.pickerChipText}>📍 Use my current location</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => navigation.navigate('Address')}
              style={[styles.pickerChip, styles.pickerChipNew]} testID="meal-addr-new">
              <Text style={styles.pickerChipText}>+ Add new address</Text>
            </Pressable>
          </View>
        )}

        {order && (
          <View style={styles.paid} testID="meal-order-confirmed">
            <Text style={styles.paidTitle}>✓ Order locked</Text>
            <Text style={styles.paidLine}>₹{Math.round(order.amount)} · status {order.status}</Text>
          </View>
        )}

        {busy && <ActivityIndicator color={lightColors.ink} style={{ marginTop: 8 }} />}
      </ScrollView>

      <View style={styles.inbar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Reply or tweak your order…"
          placeholderTextColor={lightColors.muted3}
          style={styles.input}
          onSubmitEditing={send}
          testID="meal-chat-input"
        />
        <Pressable onPress={send} style={styles.sendBtn} testID="meal-chat-send"><Text style={styles.sendText}>Send</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: lightColors.ink },
  back: { color: '#fff', fontSize: 20 },
  title: { color: '#fff', fontFamily: fonts.displayBold, fontSize: 16 },
  sub: { color: '#aab4c8', fontSize: 11 },
  thread: { flex: 1 },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
  bot: { alignSelf: 'flex-start', backgroundColor: '#fff', borderColor: lightColors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
  me: { alignSelf: 'flex-end', backgroundColor: lightColors.ink, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: fonts.sansMedium, fontSize: 13, color: lightColors.ink2 },
  ocard: { alignSelf: 'stretch', backgroundColor: '#fff', borderColor: lightColors.border, borderWidth: 1, borderRadius: 14, padding: 12 },
  ocardBest: { borderColor: lightColors.yellow, borderWidth: 2 },
  bestTag: { fontFamily: fonts.monoBold, fontSize: 10, color: lightColors.yellowText, marginBottom: 4 },
  rName: { fontFamily: fonts.sansBold, fontSize: 14, color: lightColors.ink },
  rPrice: { fontFamily: fonts.displayBold, fontSize: 18, color: lightColors.ink, marginTop: 4 },
  rStrike: { fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.muted3, textDecorationLine: 'line-through' },
  rWhy: { fontFamily: fonts.sansMedium, fontSize: 11, color: lightColors.yellowText, marginTop: 4 },
  pick: { marginTop: 10, backgroundColor: lightColors.ink, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  pickBest: { backgroundColor: lightColors.yellow },
  pickText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff' },
  picker: { alignSelf: 'stretch', backgroundColor: '#fff', borderColor: lightColors.border, borderWidth: 1, borderRadius: 14, padding: 12 },
  pickerTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink, marginBottom: 8 },
  pickerChip: { borderColor: lightColors.border, borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginTop: 6 },
  pickerChipGps: { borderColor: lightColors.yellow, backgroundColor: '#FEFCE8' },
  pickerChipNew: { borderStyle: 'dashed' },
  pickerChipText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: lightColors.ink },
  pickerChipSub: { fontFamily: fonts.sansMedium, fontSize: 11, color: lightColors.muted, marginTop: 1 },
  paid: { alignSelf: 'stretch', backgroundColor: lightColors.successPale, borderColor: '#b7ebdc', borderWidth: 1, borderRadius: 14, padding: 14 },
  paidTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: lightColors.success },
  paidLine: { fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.ink2, marginTop: 2 },
  inbar: { flexDirection: 'row', gap: 8, padding: 10, borderTopColor: lightColors.border, borderTopWidth: 1, backgroundColor: '#fff' },
  input: { flex: 1, borderColor: lightColors.border, borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9, fontFamily: fonts.sansRegular, fontSize: 13, color: lightColors.ink },
  sendBtn: { backgroundColor: lightColors.yellow, borderRadius: 99, paddingHorizontal: 18, justifyContent: 'center' },
  sendText: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
});
