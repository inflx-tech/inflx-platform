import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';

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
const MODES = [
  { v: 'visit', label: 'Store visit' },
  { v: 'shipment', label: 'We ship products' },
  { v: 'remote', label: 'Remote' },
];
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
  const [mode, setMode] = useState('');
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
          ? <Field label="Post by (YYYY-MM-DD) · negotiable" value={postBy} onChange={setPostBy} placeholder="2026-09-15" />
          : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Window start" value={winStart} onChange={setWinStart} placeholder="2026-09-10" /></View>
              <View style={{ flex: 1 }}><Field label="Window end" value={winEnd} onChange={setWinEnd} placeholder="2026-09-24" /></View>
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

        <Text style={s.fl}>HOW YOU'D WORK TOGETHER · OPTIONAL</Text>
        <View style={s.chips}>
          <TouchableOpacity style={[s.chip, mode === '' && s.chipAct]} onPress={() => setMode('')}>
            <Text style={[s.chipTxt, mode === '' && s.chipTxtAct]}>Not stated</Text>
          </TouchableOpacity>
          {MODES.map(o => (
            <TouchableOpacity key={o.v} style={[s.chip, mode === o.v && s.chipAct]} onPress={() => setMode(o.v)}>
              <Text style={[s.chipTxt, mode === o.v && s.chipTxtAct]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!mode && <Importance value={modeImp} onChange={setModeImp} />}

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
  chipTxtAct: { color: P.yellow },
  inp: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontFamily: fonts.sansRegular, fontSize: 13, color: P.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: P.muted2, lineHeight: 15, marginTop: 6 },
  impRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  impBtn: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  impAct: { backgroundColor: P.ink, borderColor: P.ink },
  impTxt: { fontFamily: fonts.sansBold, fontSize: 9.5, color: P.muted },
  impTxtAct: { color: P.white },
  impHint: { fontFamily: fonts.sansRegular, fontSize: 9.5, color: P.muted2, flex: 1 },
  cta: { backgroundColor: P.yellow, borderRadius: 11, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  ctaTxt: { fontFamily: fonts.displayBlack, fontSize: 13, color: P.ink, letterSpacing: 0.4 },
});
