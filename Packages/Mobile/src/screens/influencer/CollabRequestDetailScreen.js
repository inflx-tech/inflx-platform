import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ig } from '../../theme/ig';
// Stage 1 — restyled from brandPalette to the ig kit as part of moving into Collabs.
// A loud coloured screen one tap inside a white tab reads as a different app.
import { influencerApi } from '../../services/api';
import { PLACES, SHIPPING, toMode, describeMode } from '../../utils/workingStyle';
import DateField from '../../components/DateField';

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

/**
 * Working style reads as TWO lines, because it answers two questions: where she works,
 * and whether a box moves. It used to arrive as one phrase — "They ship products" — which
 * told her a parcel was coming but never told her where she was expected to shoot.
 * Contract: features/collab-working-style-two-questions
 */
function WorkingStyleRows({ mode, tag, locked }) {
  const d = describeMode(mode, 'creator');
  if (!d) return null;
  return (
    <>
      <Row k="Where you'd work" v={d.place} tag={tag} locked={locked} />
      {d.shipping && <Row k="Products" v={d.shipping} />}
    </>
  );
}
/**
 * What a fee buys — the platform's five words, the same ones the brand chose from.
 * Contract: features/collab-terms-by-aim (item 5)
 */
const DELIVERABLES = [
  { v: 'reel',          label: 'Instagram Reel' },
  { v: 'post',          label: 'Instagram Post' },
  { v: 'story',         label: 'Instagram Story' },
  { v: 'youtube_video', label: 'YouTube Video' },
  { v: 'youtube_short', label: 'YouTube Short' },
];

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
  // Two answers, one stored term — the same shape the brand answered in.
  const [cPlace, setCPlace] = useState('');
  const [cShipping, setCShipping] = useState(null);
  // Counts per format, pre-filled from what the brand asked for so a counter about
  // money does not silently wipe the deliverables she already agreed to.
  const [cDeliverables, setCDeliverables] = useState(null);

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
  // A commission buys nothing in advance, so deliverables are not part of that bargain.
  const paidDeal = t.aim === 'engagement' || t.aim === 'hybrid';

  const buildCounter = () => {
    const c = {};
    const money = {};
    if (cCommission) money.commission_pct = Number(cCommission);
    if (cFee) money.fee = Number(cFee);
    if (Object.keys(money).length) c.money = { ...t.money, ...money };
    // Always post_by. Countering with a window would now be refused by the terms model,
    // and a counter that silently fails is worse than one that never offered the option.
    if (cPostBy) c.time = { post_by: cPostBy };
    const cMode = toMode(cPlace, cShipping);
    if (cMode) c.mode = cMode;
    // Only on a paid collaboration. She earns on what she sells in a commission deal,
    // so being asked to promise posts there was asking the wrong question.
    //
    // No importance marker: deliverables are always negotiable on a paid deal, and the
    // terms model now REFUSES a marker here. Sending one would have made every counter
    // that touched deliverables fail validation.
    // Contract: features/collab-terms-by-aim (item 5)
    if (paidDeal && cDeliverables) {
      const list = DELIVERABLES
        .filter(d => Number(cDeliverables[d.v]) > 0)
        .map(d => ({ type: d.v, count: Number(cDeliverables[d.v]) }));
      if (list.length) c.deliverables = list;
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
    // Remote with the shipping question unanswered is not "no" — it is unanswered.
    if (cPlace === 'remote' && cShipping == null) {
      Alert.alert('One more thing', 'Say whether you want them to send you products.');
      return;
    }
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
        {/* One date now, whatever the deal. Older conversations that still carry a window
            fall back to showing it rather than a blank row.
            Contract: features/collab-terms-by-aim (item 3) */}
        {t.time?.post_by
          ? <Row k="Post by" v={fmtD(t.time.post_by)} tag="negotiable" />
          : t.time?.window_end
            ? <Row k="Post by" v={fmtD(t.time.window_end)} tag="negotiable" />
            : null}
        {t.scope && imp.scope === 'requirement' && (
          <Row k="You'd promote" v={scopeText(t.scope)} tag="required" locked />
        )}

        {/* Where she works sits with the money and the date now — it is asked on every
            collaboration and is always negotiable.

            This used to render ONLY when a preference or requirement marker was
            present. New requests carry no marker, so leaving it would have shown her
            no working style at all — a regression hidden behind a condition that used
            to be true and quietly stopped being.
            Contract: features/collab-terms-by-aim (item 6) */}
        {t.mode && <WorkingStyleRows mode={t.mode} tag="negotiable" />}

        {imp.scope === 'preference' && <Text style={s.h}>THEY'D PREFER — YOUR CALL</Text>}
        {t.scope && imp.scope === 'preference' && <Row k="You'd promote" v={scopeText(t.scope)} tag="their preference" />}

        {/* A brand can no longer send a paid request without naming what the fee buys,
            so this only speaks to older conversations. On a sales collaboration it is
            silent: deliverables were never part of that deal.
            Contract: features/collab-terms-by-aim (item 5) */}
        {paidDeal && !t.deliverables && (
          <View style={s.openBox}>
            <Text style={s.openTxt}>They haven't said what the fee buys — tell them what you can do when you counter, or accept and settle it in the campaign brief.</Text>
          </View>
        )}

        {paidDeal && t.deliverables && (
          <>
            <Text style={s.h}>WHAT THE FEE BUYS</Text>
            {t.deliverables.map(d => (
              <Row
                key={d.type}
                k={(DELIVERABLES.find(x => x.v === d.type) || {}).label || d.type}
                v={String(d.count)}
                tag="negotiable"
              />
            ))}
          </>
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
              <DateField
                label="Post by"
                value={cPostBy}
                onChange={setCPostBy}
                placeholder={`They said ${fmtD(t.time?.post_by || t.time?.window_end)}`}
              />
            )}
            {counterable.includes('mode') && (
              <>
                {/* Her counter asks the same two questions, in the same words the brand
                    was asked. Offering her one three-way chip row while the brand answers
                    two would put the two sides back out of step. */}
                <Text style={s.fl}>Where you'd work — their preference, so your call</Text>
                <View style={s.chips}>
                  {PLACES.map(o => (
                    <TouchableOpacity key={o.v} style={[s.chip, cPlace === o.v && s.chipAct]}
                      onPress={() => {
                        const next = cPlace === o.v ? '' : o.v;
                        setCPlace(next);
                        if (next !== 'remote') setCShipping(null);
                      }}>
                      <Text style={[s.chipTxt, cPlace === o.v && s.chipTxtAct]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {cPlace === 'remote' && (
                  <>
                    <Text style={s.fl}>Would they send you products?</Text>
                    <View style={s.chips}>
                      {SHIPPING.map(o => (
                        <TouchableOpacity key={o.v} style={[s.chip, cShipping === o.v && s.chipAct]}
                          onPress={() => setCShipping(o.v)}>
                          <Text style={[s.chipTxt, cShipping === o.v && s.chipTxtAct]}>
                            {o.v === 'yes' ? 'Yes, ship to me' : 'No'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
            {/* Only on a paid collaboration. On a sales deal she earns by selling, so
                being asked to promise posts was asking the wrong question entirely.
                Pre-filled with what the brand asked for, so countering the money does
                not silently wipe deliverables she was happy with.
                Contract: features/collab-terms-by-aim (item 5) */}
            {paidDeal && (
              <>
                <Text style={s.fl}>What you'll deliver</Text>
                {DELIVERABLES.map(d => {
                  const asked = (t.deliverables || []).find(x => x.type === d.v);
                  const current = cDeliverables ? cDeliverables[d.v] : (asked ? asked.count : 0);
                  const n = Number(current) || 0;
                  const bump = (by) => setCDeliverables(prev => {
                    const base = prev || Object.fromEntries(
                      DELIVERABLES.map(x => {
                        const a = (t.deliverables || []).find(y => y.type === x.v);
                        return [x.v, a ? a.count : 0];
                      }),
                    );
                    return { ...base, [d.v]: Math.max(0, (Number(base[d.v]) || 0) + by) };
                  });
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
  delRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: ig.lineSoft,
  },
  delLabel: { fontSize: 12.5, color: ig.mut },
  delLabelOn: { fontWeight: '800', color: ig.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: ig.line,
    alignItems: 'center', justifyContent: 'center',
  },
  stepTxt: { fontSize: 15, fontWeight: '700', color: ig.text, lineHeight: 18 },
  stepTxtOff: { color: ig.mut2 },
  stepN: { fontSize: 13, fontWeight: '700', color: ig.mut2, minWidth: 14, textAlign: 'center' },
  stepNOn: { color: ig.text },
  wrap: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg },
  gone: { color: ig.text2, fontSize: 13 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  logo: { width: 40, height: 40, borderRadius: 10, backgroundColor: ig.text, alignItems: 'center', justifyContent: 'center' },
  logoTxt: { color: ig.bg, fontSize: 13 },
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
  chipTxtAct: { color: ig.bg },
  cta: { backgroundColor: ig.text, borderRadius: 11, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  ctaTxt: { fontSize: 13, color: ig.bg, letterSpacing: 0.4 },
  ctaInk: { backgroundColor: ig.text, borderRadius: 11, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  ctaInkTxt: { fontSize: 13, color: ig.bg, letterSpacing: 0.4 },
  ctaGhost: { borderRadius: 11, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  ctaGhostTxt: { fontSize: 12, color: '#B91C1C' },
});
