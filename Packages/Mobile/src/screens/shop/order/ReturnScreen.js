/**
 * The shopper's Return (shopper-walk-fixes · 01-spec.md W14 · rules v1.18 §6.16).
 *
 *   ReturnScreen  My orders → the item → Return: what goes back (a deal's items go together, warned),
 *                 until when, a reason (required; "Other" needs a note), what she gets back and how
 *                 it works → "Request return" → "Return requested".
 *   ReturnBox     on Order details, what her return is doing: requested, approved, not accepted
 *                 (with INFLX's note), returned (with what happened to the money).
 *
 * She asks; INFLX decides. Nothing here cancels the item or moves money — the server does both,
 * and only once INFLX marks the item as back.
 *
 * No board was drawn for this (founder, 4 Oct 2026): it is the Cancel screen (O16, O17) with
 * Return's words. The reasons, the refund sentence, the warning and "how it works" are the server's.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty } from '../../../components/shop/bitsShop';
import { K, b } from '../../../components/shop/orderBits';
import { CO, dayLabel } from '../../../components/shop/copyOrder';
import { CR, refundWords, untilLabel } from '../../../components/shop/copyReturn';
import { CS, inr } from '../../../components/shop/copyShop';
import { fonts } from '../../../theme/tokens';

/** What her return is doing, on Order details. `back` is the item's `return` from the server. */
export function ReturnBox({ back, testID }) {
  if (!back) return null;
  const refunded = back.status === 'refunded';
  const rejected = back.status === 'rejected';
  const money = refunded ? refundWords(back.refund, inr) : null;
  return (
    <View style={st.card} testID={testID || 'return-box'}>
      <Text style={st.lab}>{CR.head}</Text>
      <Text style={[st.word, rejected && { color: K.danger }, refunded && { color: K.ok }]} testID="return-word">{back.word}</Text>
      <Text style={st.meta} testID="return-line">{CR.box[back.status] || ''}</Text>
      {rejected && back.inflx_note ? (
        <View style={st.warn} testID="return-note"><Text style={st.warnText}>{CR.inflxNote(back.inflx_note)}</Text></View>
      ) : null}
      {money ? <Text style={[st.refund, back.refund.status === 'failed' && { color: K.danger }]} testID="return-refund">{money}</Text> : null}
      <Text style={st.meta}>{CR.yourReason(back.reason, back.note)}</Text>
      {back.requested_at ? <Text style={st.meta}>{CR.askedOn(dayLabel(back.requested_at))}</Text> : null}
    </View>
  );
}

export default function ReturnScreen({ navigation, route }) {
  const { lineId } = route.params || {};
  const [pv, setPv] = useState(null);
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    followerApi.returnPreview(lineId).then((r) => { if (r && r.success) setPv(r.data); else setErr(r && r.error ? r.error.message : CS.loadError); });
  }, [lineId]);

  const needsNote = reason === 'other';
  const off = !reason || (needsNote && !note.trim()) || busy;

  async function go() {
    setBusy(true); setErr(null);
    const r = await followerApi.returnLine(lineId, { reason, note: needsNote ? note.trim() : undefined });
    setBusy(false);
    if (!r || !r.success) { setErr(r && r.error ? r.error.message : CS.loadError); return; }
    setDone(r.data);
  }

  if (done) {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar title={CR.requested} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={{ padding: 20 }} testID="return-requested">
          <Text style={st.big}>{CR.requested}</Text>
          {pv ? pv.lines.map((l) => <Text key={l.id} style={st.name}>{l.role === 'gift' ? CO.freeGift(l.name) : l.name}{l.size ? ` · ${l.size}` : ''}</Text>) : null}
          {pv ? <Text style={st.hint}>{pv.how}</Text> : null}
          {pv ? <Text style={st.refund}>{pv.refund.text}</Text> : null}
          <TouchableOpacity style={b.primary} onPress={() => navigation.navigate('Orders')} testID="returned-orders"><Text style={b.primaryText}>{CO.myOrders}</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CR.title} onBack={() => navigation.goBack()} />
      {!pv ? (err ? <Empty title={err} testID="return-refused" /> : <Loading />) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" testID="return">
          {pv.warning ? <View style={st.warn}><Text style={st.warnText}>⚠ {pv.warning}</Text></View> : null}
          {pv.lines.map((l) => <Text key={l.id} style={st.name}>{l.role === 'gift' ? CO.freeGift(l.name) : l.name}{l.size ? ` · ${l.size}` : ''}</Text>)}
          <Text style={st.hint} testID="return-until">{CR.openUntil(untilLabel(pv.until))}</Text>
          <Text style={[st.lab, { marginTop: 14 }]}>{CR.why}</Text>
          {pv.reasons.map((r) => (
            <TouchableOpacity key={r.key} style={st.reason} onPress={() => setReason(r.key)} testID={`reason-${r.key}`} accessibilityRole="radio" accessibilityState={{ checked: reason === r.key }}>
              <Icon name={reason === r.key ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={K.ink} />
              <Text style={st.reasonText}>{r.key === 'other' ? `${r.label} (write a note)` : r.label}</Text>
            </TouchableOpacity>
          ))}
          {needsNote ? <TextInput value={note} onChangeText={setNote} placeholder={CR.writeNote} style={st.note} multiline maxLength={500} testID="return-note-box" /> : null}
          <View style={[st.card, { marginTop: 12 }]}>
            <Text style={st.lab}>{CR.refundHead}</Text>
            <Text style={st.name}>{pv.refund.text}</Text>
          </View>
          <Text style={st.hint} testID="return-how">{pv.how}</Text>
          {err ? <Text style={b.problem}>{err}</Text> : null}
          <TouchableOpacity style={[b.primary, off && b.primaryDis]} disabled={off} onPress={go} testID="confirm-return">
            <Text style={b.primaryText}>{CR.confirm}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// The Cancel screen's own look (OrderScreens.js), so the two read as one family.
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  big: { fontFamily: fonts.sansBold, fontSize: 22, color: K.ink, textAlign: 'center', marginTop: 12, marginBottom: 10 },
  card: { borderWidth: 1, borderColor: K.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  name: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink },
  word: { fontFamily: fonts.sansBold, fontSize: 14.5, color: K.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 2, lineHeight: 17 },
  note: { borderWidth: 1.5, borderColor: K.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontFamily: fonts.sansRegular, fontSize: 14, color: K.ink, marginTop: 6 },
  lab: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink2, marginBottom: 4 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 10, lineHeight: 17 },
  refund: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ok, marginVertical: 10, lineHeight: 18 },
  warn: { backgroundColor: K.warnSoft, borderRadius: 12, padding: 10, marginVertical: 8 },
  warnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.warn },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  reasonText: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: K.ink },
});
