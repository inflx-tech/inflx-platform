import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PLACES, SHIPPING, toMode } from '../../utils/workingStyle';
// Dates are chosen, not typed. Contract: features/collab-terms-by-aim (item 2)
import DateField from '../../components/DateField';

/**
 * BrandRequestComposerScreen — a brand asks a creator to collaborate, BEFORE any
 * campaign exists. Contract: features/collab-part2-precampaign-handshake (mockup ②).
 *
 * The terms model, mobile: money and time always asked per aim and always negotiable;
 * scope and working style optional, each marked requirement or preference; deliverables
 * deliberately absent — the creator proposes what they can do. The wire carries the
 * campaign_goal enum; friendly labels live only on screen.
 */

const AIMS = [
  { v: 'conversion', label: 'Pay per sale' },
  { v: 'engagement', label: 'Pay for content' },
  { v: 'hybrid', label: 'Both' },
];
// Working style is TWO questions, not three answers — PLACES and SHIPPING come from
// utils/workingStyle, which the contract screen reads from too so the brand is never
// asked the same thing in two different vocabularies.
const SCOPES = [
  { v: 'store', label: 'Whole store' },
  { v: 'category', label: 'A category' },
];

export default function BrandRequestComposerScreen({ route, navigation }) {
  const { influencerId, influencerName, influencerHandle } = route.params || {};
  const [aim, setAim] = useState('conversion');
  const [commission, setCommission] = useState('');
  const [fee, setFee] = useState('');
  const [postBy, setPostBy] = useState('');
  const [winStart, setWinStart] = useState('');
  const [winEnd, setWinEnd] = useState('');
  const [scopeLevel, setScopeLevel] = useState('');
  const [scopeCategory, setScopeCategory] = useState('');
  const [scopeImp, setScopeImp] = useState('preference');
  // Where she works, and — only if remote — whether a box moves. Two answers, one
  // stored term. `shipping` stays null until asked, so an unanswered question is
  // distinguishable from a deliberate "no".
  const [place, setPlace] = useState('');
  const [shipping, setShipping] = useState(null);
  const [modeImp, setModeImp] = useState('preference');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const terms = { aim, money: {}, time: {} };
    if (aim !== 'engagement') {
      if (!Number(commission)) { Alert.alert('Missing', 'Commission % is required for this aim.'); return; }
      terms.money.commission_pct = Number(commission);
    }
    if (aim !== 'conversion') {
      if (!Number(fee)) { Alert.alert('Missing', 'A fee is required for this aim.'); return; }
      terms.money.fee = Number(fee);
    }
    if (aim === 'conversion') {
      if (!postBy) { Alert.alert('Missing', 'A post-by date is required.'); return; }
      terms.time.post_by = postBy;
    } else {
      if (!winStart || !winEnd) { Alert.alert('Missing', 'A posting window is required.'); return; }
      terms.time.window_start = winStart;
      terms.time.window_end = winEnd;
    }
    const importance = {};
    if (scopeLevel) {
      terms.scope = scopeLevel === 'category' ? { level: 'category', category: scopeCategory || null } : { level: 'store' };
      importance.scope = scopeImp;
    }
    // Remote without an answer on shipping is not "no" — it is unanswered, and letting
    // it default would quietly decide the thing this change exists to ask.
    if (place === 'remote' && shipping == null) {
      Alert.alert('One more thing', 'Say whether you are sending her products.');
      return;
    }
    const mode = toMode(place, shipping);
    if (mode) { terms.mode = mode; importance.mode = modeImp; }
    if (Object.keys(importance).length) terms.importance = importance;

    setBusy(true);
    const res = await brandApi.sendCollabRequest({ influencer_id: influencerId, terms, message: message || null });
    setBusy(false);
    if (res.success) {
      const skipped = res.data?.skipped || [];
      if (res.data?.sent_count > 0) {
        Alert.alert('Request sent', `${influencerName || 'The creator'} will see it in their inbox. Track it under Collab Requests.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Not sent', skipped[0]?.reason || 'This creator cannot be reached right now.');
      }
    } else {
      Alert.alert('Could not send', res.error?.message || 'Try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.sub}>To <Text style={s.subB}>{influencerName || influencerHandle}</Text> — no campaign needed. Money and time are always negotiable; everything else is optional.</Text>

        <Text style={s.fl}>AIM</Text>
        <View style={s.chips}>
          {AIMS.map(a => (
            <TouchableOpacity key={a.v} style={[s.chip, aim === a.v && s.chipAct]} onPress={() => setAim(a.v)}>
              <Text style={[s.chipTxt, aim === a.v && s.chipTxtAct]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {aim !== 'engagement' && <Field label="Commission % · negotiable" value={commission} onChange={setCommission} keyboardType="numeric" placeholder="e.g. 12" />}
        {aim !== 'conversion' && <Field label="Fee ₹ · negotiable" value={fee} onChange={setFee} keyboardType="numeric" placeholder="e.g. 25000" />}
        {aim === 'conversion'
          ? <DateField label="Post by · negotiable" value={postBy} onChange={setPostBy} />
          : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><DateField label="Window start" value={winStart} onChange={setWinStart} /></View>
              {/* Cannot end before it starts — the picker refuses rather than letting a
                  brand save a window that runs backwards. */}
              <View style={{ flex: 1 }}><DateField label="Window end" value={winEnd} onChange={setWinEnd} minDate={winStart || undefined} /></View>
            </View>
          )}
        {aim === 'conversion' && <Text style={s.hint}>A sales collaboration has no end date — this is the posting expectation.</Text>}

        <Text style={s.fl}>WHAT THEY'D PROMOTE · OPTIONAL</Text>
        <View style={s.chips}>
          <TouchableOpacity style={[s.chip, scopeLevel === '' && s.chipAct]} onPress={() => setScopeLevel('')}>
            <Text style={[s.chipTxt, scopeLevel === '' && s.chipTxtAct]}>Not stated</Text>
          </TouchableOpacity>
          {SCOPES.map(o => (
            <TouchableOpacity key={o.v} style={[s.chip, scopeLevel === o.v && s.chipAct]} onPress={() => setScopeLevel(o.v)}>
              <Text style={[s.chipTxt, scopeLevel === o.v && s.chipTxtAct]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {scopeLevel === 'category' && <Field label="Category" value={scopeCategory} onChange={setScopeCategory} placeholder="e.g. Ethnic Wear" />}
        {!!scopeLevel && <Importance value={scopeImp} onChange={setScopeImp} />}

        <Text style={s.fl}>WHERE THEY'D WORK · OPTIONAL</Text>
        <View style={s.chips}>
          <TouchableOpacity style={[s.chip, place === '' && s.chipAct]}
            onPress={() => { setPlace(''); setShipping(null); }}>
            <Text style={[s.chipTxt, place === '' && s.chipTxtAct]}>Not stated</Text>
          </TouchableOpacity>
          {PLACES.map(o => (
            <TouchableOpacity key={o.v} style={[s.chip, place === o.v && s.chipAct]}
              /* Leaving remote clears the shipping answer, so switching back cannot
                 re-reveal a stale "yes" the brand never re-confirmed. */
              onPress={() => { setPlace(o.v); if (o.v !== 'remote') setShipping(null); }}>
              <Text style={[s.chipTxt, place === o.v && s.chipTxtAct]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {place === 'visit' && <Text style={s.hint}>They come to your store and shoot there.</Text>}

        {/* Question two. Never asked of a store visit — she is standing in your shop. */}
        {place === 'remote' && (
          <View style={s.follow}>
            <Text style={[s.fl, { marginTop: 0 }]}>ARE YOU SENDING HER PRODUCTS?</Text>
            <View style={s.chips}>
              {SHIPPING.map(o => (
                <TouchableOpacity key={o.v} style={[s.chip, shipping === o.v && s.chipAct]}
                  onPress={() => setShipping(o.v)}>
                  <Text style={[s.chipTxt, shipping === o.v && s.chipTxtAct]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.hint}>
              {shipping === 'yes'
                ? "You'll add the courier and tracking number after you dispatch."
                : shipping === 'no'
                  ? 'They shoot wherever they are, from your brief.'
                  : 'Answer this before sending.'}
            </Text>
          </View>
        )}

        {!!place && <Importance value={modeImp} onChange={setModeImp} />}

        <Text style={s.hint}>Deliverables are deliberately not asked — the creator proposes what they can do, and it becomes part of the agreement.</Text>

        <Field label="Message" value={message} onChange={setMessage} placeholder="Why you want to work with them" multiline />

        <TouchableOpacity style={s.cta} disabled={busy} onPress={send}>
          <Text style={s.ctaTxt}>{busy ? 'SENDING…' : 'SEND REQUEST'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Importance({ value, onChange }) {
  return (
    <View style={s.impRow}>
      <TouchableOpacity style={[s.impBtn, value === 'requirement' && s.impAct]} onPress={() => onChange('requirement')}>
        <Text style={[s.impTxt, value === 'requirement' && s.impTxtAct]}>Requirement</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.impBtn, value === 'preference' && s.impAct]} onPress={() => onChange('preference')}>
        <Text style={[s.impTxt, value === 'preference' && s.impTxtAct]}>Preference</Text>
      </TouchableOpacity>
      <Text style={s.impHint}>
        {value === 'preference' ? 'asked as a question — declining is fine' : 'must be settled — cannot be countered'}
      </Text>
    </View>
  );
}

function Field({ label, value, onChange, keyboardType, placeholder, multiline }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fl}>{label.toUpperCase()}</Text>
      <TextInput style={[s.inp, multiline && { minHeight: 64, textAlignVertical: 'top' }]} value={value} onChangeText={onChange}
        keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={P.muted3} multiline={!!multiline} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: P.bg },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12, color: P.muted, lineHeight: 17, marginBottom: 14 },
  subB: { fontFamily: fonts.sansBold, color: P.ink },
  fl: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted, letterSpacing: 0.4, marginBottom: 5, marginTop: 10 },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 4 },
  chip: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipAct: { backgroundColor: P.ink, borderColor: P.ink },
  chipTxt: { fontFamily: fonts.sansBold, fontSize: 11.5, color: P.muted },
  chipTxtAct: { color: P.white },
  inp: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontFamily: fonts.sansRegular, fontSize: 13, color: P.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: P.muted2, lineHeight: 15, marginTop: 6 },
  // The follow-up is indented under its parent question so it reads as a qualifier,
  // not as a third thing of equal weight — which is the mistake being corrected.
  follow: { borderLeftWidth: 2, borderLeftColor: P.ink, paddingLeft: 11, marginTop: 11, marginLeft: 2 },
  impRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  impBtn: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  impAct: { backgroundColor: P.ink, borderColor: P.ink },
  impTxt: { fontFamily: fonts.sansBold, fontSize: 9.5, color: P.muted },
  impTxtAct: { color: P.white },
  impHint: { fontFamily: fonts.sansRegular, fontSize: 9.5, color: P.muted2, flex: 1 },
  cta: { backgroundColor: P.ink, borderRadius: 11, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  ctaTxt: { fontFamily: fonts.displayBlack, fontSize: 13, color: P.white, letterSpacing: 0.4 },
});
