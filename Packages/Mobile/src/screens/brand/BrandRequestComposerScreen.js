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
/**
 * What a fee buys. The platform's existing five words — the same ones a campaign brief
 * and a contract already use, so nothing needs translating downstream.
 * Contract: features/collab-terms-by-aim (item 4)
 */
const DELIVERABLES = [
  { v: 'reel',          label: 'Instagram Reel' },
  { v: 'post',          label: 'Instagram Post' },
  { v: 'story',         label: 'Instagram Story' },
  { v: 'youtube_video', label: 'YouTube Video' },
  { v: 'youtube_short', label: 'YouTube Short' },
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
  const [scopeLevel, setScopeLevel] = useState('');
  const [scopeCategory, setScopeCategory] = useState('');
  const [scopeImp, setScopeImp] = useState('preference');
  // Where she works, and — only if remote — whether a box moves. Two answers, one
  // stored term. `shipping` stays null until asked, so an unanswered question is
  // distinguishable from a deliberate "no".
  const [place, setPlace] = useState('');
  const [shipping, setShipping] = useState(null);
  // Counts per format. A fee with nothing named is the ambiguity this exists to remove.
  const [deliverables, setDeliverables] = useState({});
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
    // One date, whatever the deal. It means the same thing in both: she must have posted
    // by then, and the campaign starts then.
    // Contract: features/collab-terms-by-aim (item 3)
    if (!postBy) { Alert.alert('Missing', 'Choose the date she must post by.'); return; }
    terms.time.post_by = postBy;
    // A fee buys specific work, so both sides must know what it buys. Not asked on a
    // sales collaboration: she earns only if she sells, so counting posts measures the
    // wrong thing.
    if (aim !== 'conversion') {
      const list = DELIVERABLES
        .filter(d => Number(deliverables[d.v]) > 0)
        .map(d => ({ type: d.v, count: Number(deliverables[d.v]) }));
      if (list.length === 0) {
        Alert.alert('Missing', 'Say what the fee buys — at least one deliverable.');
        return;
      }
      terms.deliverables = list;
    }

    const importance = {};
    if (scopeLevel) {
      terms.scope = scopeLevel === 'category' ? { level: 'category', category: scopeCategory || null } : { level: 'store' };
      importance.scope = scopeImp;
    }
    // Where she works is asked on every collaboration now, and is always negotiable —
    // so it no longer carries a requirement/preference marker.
    // Contract: features/collab-terms-by-aim (item 6)
    if (!place) {
      Alert.alert('Missing', 'Say where she would work — a store visit or remote.');
      return;
    }
    // Remote without an answer on shipping is not "no" — it is unanswered, and letting
    // it default would quietly decide the thing that question exists to ask.
    if (place === 'remote' && shipping == null) {
      Alert.alert('One more thing', 'Say whether you are sending her products.');
      return;
    }
    terms.mode = toMode(place, shipping);
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
        <DateField
          label="Post by · negotiable"
          value={postBy}
          onChange={setPostBy}
          hint="She must have posted by this date. The campaign starts then."
        />

        {/* What the fee buys. Shown only when there IS a fee — a commission buys
            nothing in advance, so counting her posts would measure the wrong thing.
            Contract: features/collab-terms-by-aim (item 4) */}
        {aim !== 'conversion' && (
          <>
            <Text style={s.fl}>
              {fee ? `WHAT ₹${Number(fee).toLocaleString('en-IN')} BUYS` : 'WHAT THE FEE BUYS'}
              <Text style={s.negTag}>  · NEGOTIABLE</Text>
            </Text>
            {DELIVERABLES.map(d => {
              const n = Number(deliverables[d.v]) || 0;
              const bump = (by) => setDeliverables(prev => ({
                ...prev, [d.v]: Math.max(0, (Number(prev[d.v]) || 0) + by),
              }));
              return (
                <View key={d.v} style={s.delRow}>
                  <Text style={[s.delLabel, n > 0 && s.delLabelOn]}>{d.label}</Text>
                  <View style={s.stepper}>
                    <TouchableOpacity style={s.stepBtn} onPress={() => bump(-1)} disabled={n === 0}>
                      <Text style={[s.stepTxt, n === 0 && s.stepTxtOff]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[s.stepN, n > 0 && s.stepNOn]}>{n}</Text>
                    <TouchableOpacity style={s.stepBtn} onPress={() => bump(1)}>
                      <Text style={s.stepTxt}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            <Text style={s.hint}>She can counter these along with the money and the date.</Text>
          </>
        )}

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

        <Text style={s.fl}>WHERE SHE'D WORK<Text style={s.negTag}>  · NEGOTIABLE</Text></Text>
        <View style={s.chips}>
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


        {aim === 'conversion' && (
          <Text style={s.hint}>Deliverables are not asked on a sales collaboration — she earns on what she sells, so counting posts measures the wrong thing.</Text>
        )}

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
  negTag: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted },
  delRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  delLabel: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: P.muted },
  delLabelOn: { fontFamily: fonts.sansBold, color: P.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: P.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepTxt: { fontFamily: fonts.sansBold, fontSize: 15, color: P.ink, lineHeight: 18 },
  stepTxtOff: { color: P.muted2 },
  stepN: { fontFamily: fonts.monoBold, fontSize: 13, color: P.muted2, minWidth: 14, textAlign: 'center' },
  stepNOn: { color: P.ink },
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
