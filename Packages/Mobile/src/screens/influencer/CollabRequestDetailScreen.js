import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ig } from '../../theme/ig';
// Stage 1 — restyled from brandPalette to the ig kit as part of moving into Collabs.
// A yellow screen one tap inside a white tab reads as a different app.
import { influencerApi } from '../../services/api';

/**
 * CollabRequestDetailScreen — a brand's collaboration request, and the creator's answer.
 * Contract: features/collab-part2-precampaign-handshake (mockup tabs ④⑤).
 *
 * The terms model on screen:
 *   · money + time — always shown, always counterable
 *   · a REQUIREMENT — shown locked; not offered in the counter. If the creator cannot
 *     live with it, the honest outcome is Not interested, not a counter that quietly
 *     changes it and looks like agreement.
 *   · a PREFERENCE — shown as the brand asking a question; declining it is fine
 *   · deliverables the brand left open — the creator proposes them here
 *
 * Accept produces an AGREEMENT — no campaign, no contract yet. The brand briefs it into
 * a real campaign on web, and then acceptance there is one click.
 */

const MODE_LABEL = { visit: 'Store visit', shipment: 'They ship products', remote: 'Remote' };
const AIM_LABEL = { conversion: 'Pay per sale', engagement: 'Pay for content', hybrid: 'Fee + commission' };
const fmtD = (d) => (d ? String(d).slice(0, 10) : '—');

export default function CollabRequestDetailScreen({ route, navigation }) {
  const { requestId } = route.params || {};
  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [countering, setCountering] = useState(false);

  // Counter form
  const [cCommission, setCCommission] = useState('');
  const [cFee, setCFee] = useState('');
  const [cPostBy, setCPostBy] = useState('');
  const [cMode, setCMode] = useState('');
  const [cReels, setCReels] = useState('');
  const [cStories, setCStories] = useState('');

  const load = useCallback(async () => {
    const res = await influencerApi.listCollabRequests();
    if (res.success) {
      const found = (res.data?.requests || []).find(r => r.id === requestId);
      setReq(found || null);
    }
    setLoading(false);
  }, [requestId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={s.center}><ActivityIndicator color={ig.y} /></View>;
  if (!req) return <View style={s.center}><Text style={s.gone}>This request is no longer available.</Text></View>;

  const t = req.terms_json || {};
  const imp = t.importance || {};
  const counterable = req.counterable_terms || ['money', 'time'];
  const roundsLeft = req.rounds_left != null ? req.rounds_left : 2;
  const active = ['sent', 'viewed', 'countered'].includes(req.status);

  const buildCounter = () => {
    const c = {};
    const money = {};
    if (cCommission) money.commission_pct = Number(cCommission);
    if (cFee) money.fee = Number(cFee);
    if (Object.keys(money).length) c.money = { ...t.money, ...money };
    if (cPostBy) c.time = t.time?.post_by !== undefined ? { post_by: cPostBy } : { ...t.time, window_end: cPostBy };
    if (cMode) c.mode = cMode;
    const deliverables = [];
    if (Number(cReels) > 0) deliverables.push({ type: 'reel', count: Number(cReels) });
    if (Number(cStories) > 0) deliverables.push({ type: 'story', count: Number(cStories) });
    if (deliverables.length) {
      c.deliverables = deliverables;
      c.importance = { deliverables: 'preference' };
    }
    return c;
  };

  const doAccept = async () => {
    setBusy(true);
    const res = await influencerApi.acceptCollabRequest(req.id);
    setBusy(false);
    if (res.success) {
      Alert.alert('Terms agreed', 'The brand will send you the campaign details next — accepting those will be one tap.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Could not accept', res.error?.message || 'Try again.');
    }
  };

  const doCounter = async () => {
    const counter = buildCounter();
    if (!Object.keys(counter).length) { Alert.alert('Nothing changed', 'Adjust at least one term to counter.'); return; }
    setBusy(true);
    const res = await influencerApi.counterCollabRequest(req.id, counter);
    setBusy(false);
    if (res.success) {
      Alert.alert('Counter sent', 'The brand will see exactly what you moved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Could not counter', res.error?.message || 'Try again.');
    }
  };

  const doDecline = () => {
    Alert.alert('Not interested?', 'The brand will not be able to ask you again for a while.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const res = await influencerApi.declineCollabRequest(req.id);
          setBusy(false);
          if (res.success) navigation.goBack();
          else Alert.alert('Could not decline', res.error?.message || 'Try again.');
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.brandRow}>
          <View style={s.logo}><Text style={s.logoTxt}>{(req.business_name || '?').slice(0, 2).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.brandName}>{req.business_name}</Text>
            <Text style={s.brandMeta}>{req.brand_category || ''} · {AIM_LABEL[t.aim] || t.aim}</Text>
          </View>
          <View style={[s.st, req.status === 'countered' && s.stWarn]}><Text style={s.stTxt}>{req.status}</Text></View>
        </View>

        {!!req.message && <Text style={s.msg}>“{req.message}”</Text>}

        <Text style={s.h}>MUST BE AGREED</Text>
        {t.money?.commission_pct != null && (
          <Row k="Commission" v={`${t.money.commission_pct}%`} tag="negotiable" />
        )}
        {t.money?.fee != null && <Row k="Fee" v={`₹${Number(t.money.fee).toLocaleString('en-IN')}`} tag="negotiable" />}
        {t.time?.post_by
          ? <Row k="Post by" v={fmtD(t.time.post_by)} tag="negotiable" />
          : <Row k="Posting window" v={`${fmtD(t.time?.window_start)} → ${fmtD(t.time?.window_end)}`} tag="negotiable" />}
        {t.scope && imp.scope === 'requirement' && (
          <Row k="You'd promote" v={scopeText(t.scope)} tag="required" locked />
        )}

        {(imp.scope === 'preference' || imp.mode === 'preference') && <Text style={s.h}>THEY'D PREFER — YOUR CALL</Text>}
        {t.scope && imp.scope === 'preference' && <Row k="You'd promote" v={scopeText(t.scope)} tag="their preference" />}
        {t.mode && imp.mode === 'preference' && <Row k="Working style" v={MODE_LABEL[t.mode]} tag="their preference" />}
        {t.mode && imp.mode === 'requirement' && (
          <>
            <Text style={s.h}>ALSO REQUIRED</Text>
            <Row k="Working style" v={MODE_LABEL[t.mode]} tag="required" locked />
          </>
        )}

        {!t.deliverables && (
          <View style={s.openBox}>
            <Text style={s.openTxt}>They haven't specified deliverables — tell them what you can do when you counter, or just accept and settle it in the campaign brief.</Text>
          </View>
        )}

        {active && !countering && (
          <View style={{ marginTop: 18 }}>
            <TouchableOpacity style={s.cta} disabled={busy} onPress={doAccept}>
              <Text style={s.ctaTxt}>ACCEPT THESE TERMS</Text>
            </TouchableOpacity>
            {roundsLeft > 0 && (
              <TouchableOpacity style={s.ctaInk} disabled={busy} onPress={() => setCountering(true)}>
                <Text style={s.ctaInkTxt}>COUNTER ({roundsLeft} LEFT)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.ctaGhost} disabled={busy} onPress={doDecline}>
              <Text style={s.ctaGhostTxt}>Not interested</Text>
            </TouchableOpacity>
          </View>
        )}

        {active && countering && (
          <View style={s.counterBox}>
            <Text style={s.h}>YOUR COUNTER</Text>
            {counterable.includes('money') && t.money?.commission_pct != null && (
              <Field label={`Commission % (they said ${t.money.commission_pct})`} value={cCommission} onChange={setCCommission} keyboardType="numeric" placeholder={`e.g. ${Number(t.money.commission_pct) + 3}`} />
            )}
            {counterable.includes('money') && t.money?.fee != null && (
              <Field label={`Fee ₹ (they said ${t.money.fee})`} value={cFee} onChange={setCFee} keyboardType="numeric" />
            )}
            {counterable.includes('time') && (
              <Field label={`${t.time?.post_by ? 'Post by' : 'Window end'} (YYYY-MM-DD)`} value={cPostBy} onChange={setCPostBy} placeholder={fmtD(t.time?.post_by || t.time?.window_end)} />
            )}
            {counterable.includes('mode') && (
              <>
                <Text style={s.fl}>Working style — their preference, so your call</Text>
                <View style={s.chips}>
                  {Object.entries(MODE_LABEL).map(([v, label]) => (
                    <TouchableOpacity key={v} style={[s.chip, cMode === v && s.chipAct]} onPress={() => setCMode(cMode === v ? '' : v)}>
                      <Text style={[s.chipTxt, cMode === v && s.chipTxtAct]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {!t.deliverables && (
              <>
                <Text style={s.fl}>What you'll deliver</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Field label="Reels" value={cReels} onChange={setCReels} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label="Stories" value={cStories} onChange={setCStories} keyboardType="numeric" /></View>
                </View>
              </>
            )}
            <TouchableOpacity style={s.cta} disabled={busy} onPress={doCounter}>
              <Text style={s.ctaTxt}>{busy ? 'SENDING…' : 'SEND COUNTER'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.ctaGhost} onPress={() => setCountering(false)}>
              <Text style={s.ctaGhostTxt}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {!active && (
          <View style={s.openBox}>
            <Text style={s.openTxt}>
              {req.status === 'agreed'
                ? 'Terms agreed — the brand will send you the campaign details, and accepting those is one tap.'
                : `This request is ${req.status}.`}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function scopeText(scope) {
  if (!scope) return '—';
  if (scope.level === 'store') return 'Their whole store';
  if (scope.level === 'category') return scope.category || 'A category';
  return `${(scope.product_ids || []).length} specific products`;
}

function Row({ k, v, tag, locked }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rk}>{k}</Text>
        {!!tag && <Text style={[s.tag, tag === 'required' ? s.tagReq : tag === 'negotiable' ? s.tagNeg : s.tagPref]}>{tag.toUpperCase()}</Text>}
      </View>
      <Text style={s.rv}>{v}{locked ? ' 🔒' : ''}</Text>
    </View>
  );
}

function Field({ label, value, onChange, keyboardType, placeholder }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fl}>{label}</Text>
      <TextInput style={s.inp} value={value} onChangeText={onChange} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={ig.mut2} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg },
  gone: { color: ig.text2, fontSize: 13 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  logo: { width: 40, height: 40, borderRadius: 10, backgroundColor: ig.text, alignItems: 'center', justifyContent: 'center' },
  logoTxt: { color: ig.y, fontSize: 13 },
  brandName: { fontSize: 15, color: ig.text },
  brandMeta: { fontSize: 11, color: ig.mut, marginTop: 1 },
  st: { backgroundColor: ig.bgSoft, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  stWarn: { backgroundColor: ig.yBg },
  stTxt: { fontSize: 8.5, color: ig.text2, textTransform: 'uppercase' },
  msg: { fontSize: 12, color: ig.text2, fontStyle: 'italic', marginBottom: 12, lineHeight: 17 },
  h: { fontSize: 9.5, color: ig.mut, letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: ig.bg, borderRadius: 10, borderWidth: 1, borderColor: ig.line, padding: 11, marginBottom: 7 },
  rk: { fontSize: 12.5, color: ig.text },
  rv: { fontSize: 13, color: ig.text },
  tag: { fontSize: 7.5, marginTop: 3, letterSpacing: 0.4 },
  tagNeg: { color: '#047857' },
  tagReq: { color: '#B91C1C' },
  tagPref: { color: ig.yInk },
  openBox: { backgroundColor: ig.bgSoft, borderRadius: 10, padding: 11, marginTop: 10 },
  openTxt: { fontSize: 11.5, color: ig.text2, lineHeight: 16 },
  counterBox: { marginTop: 14 },
  fl: { fontSize: 9, color: ig.text2, letterSpacing: 0.4, marginBottom: 4, textTransform: 'uppercase' },
  inp: { backgroundColor: ig.bg, borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13, color: ig.text },
  chips: { flexDirection: 'row', gap: 7, marginBottom: 10, flexWrap: 'wrap' },
  chip: { backgroundColor: ig.bg, borderWidth: 1, borderColor: ig.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  chipAct: { backgroundColor: ig.text, borderColor: ig.text },
  chipTxt: { fontSize: 11, color: ig.text2 },
  chipTxtAct: { color: ig.y },
  cta: { backgroundColor: ig.y, borderRadius: 11, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  ctaTxt: { fontSize: 13, color: ig.text, letterSpacing: 0.4 },
  ctaInk: { backgroundColor: ig.text, borderRadius: 11, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  ctaInkTxt: { fontSize: 13, color: ig.y, letterSpacing: 0.4 },
  ctaGhost: { borderRadius: 11, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  ctaGhostTxt: { fontSize: 12, color: '#B91C1C' },
});
