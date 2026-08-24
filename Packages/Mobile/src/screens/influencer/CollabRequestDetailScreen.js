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
// One implementation of 'what did she actually change', shared with its tests.
// Contract: features/collab-terms-by-aim (item 7)
import { changedTerms, buildCounter as buildCounterPayload } from '../../utils/collabCounter';

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
/**
 * One term, in the one place it lives — read it, or change it, without the page moving.
 * Contract: features/collab-terms-by-aim (item 7)
 *
 * `was` is shown only once she has actually moved it, so the row stays quiet until
 * there is something to say.
 */
function TermRow({ label, children, was, unchanged }) {
  return (
    <View style={s.termRow}>
      <Text style={s.termLabel}>{label}</Text>
      <View style={s.termBody}>{children}</View>
      {was != null ? (
        <Text style={s.wasTag}>was {was}</Text>
      ) : unchanged ? (
        <Text style={s.okTag}>✓ fine</Text>
      ) : null}
    </View>
  );
}

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

  /**
   * Countering starts from what they OFFERED, not from an empty form.
   * Contract: features/collab-terms-by-aim (item 7)
   *
   * The old form was a second copy of the offer further down the page, with the brand's
   * terms as grey placeholder text. She had to retype anything she wanted to keep, and a
   * creator who only wanted more money could move the date by retyping it slightly
   * differently — changing two terms while meaning to change one.
   *
   * Filling every control with the current value makes 'no change' the default, so a
   * counter says exactly what she touched and nothing else.
   */
  function startCounter() {
    const cur = fromMode(t.mode);
    setCCommission(t.money?.commission_pct != null ? String(t.money.commission_pct) : '');
    setCFee(t.money?.fee != null ? String(t.money.fee) : '');
    setCPostBy(t.time?.post_by || t.time?.window_end || '');
    setCPlace(cur.place);
    setCShipping(cur.shipping);
    setCDeliverables(Object.fromEntries(
      DELIVERABLES.map(d => {
        const a = (t.deliverables || []).find(x => x.type === d.v);
        return [d.v, a ? a.count : 0];
      }),
    ));
    setCountering(true);
  }

  // Which terms she has actually moved. Lives in utils/collabCounter with 14 tests: it
  // decides what travels, and a mistake here shows as a counter that quietly changed
  // something she never touched — the exact fault item 7 removes.
  const edits = {
    commission: cCommission, fee: cFee, postBy: cPostBy,
    place: cPlace, shipping: cShipping, deliverables: cDeliverables,
  };
  const changed = countering ? changedTerms(t, edits) : [];

  const buildCounter = () => buildCounterPayload(t, edits, changed);

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

        <Text style={s.h}>{countering ? 'CHANGE WHAT YOU DISAGREE WITH' : 'MUST BE AGREED'}</Text>

        {/* Countering happens HERE, on the term itself — not in a second copy of the
            offer further down the page. Contract: features/collab-terms-by-aim (item 7) */}
        {t.money?.commission_pct != null && (
          countering ? (
            <TermRow
              label="Commission"
              was={changed.includes('money') ? `${t.money.commission_pct}%` : null}
              unchanged={!changed.includes('money')}
            >
              <View style={s.inlineInput}>
                <TextInput
                  style={s.inlineTxt}
                  value={cCommission}
                  onChangeText={setCCommission}
                  keyboardType="numeric"
                />
                <Text style={s.inlineUnit}>%</Text>
              </View>
            </TermRow>
          ) : <Row k="Commission" v={`${t.money.commission_pct}%`} tag="negotiable" />
        )}

        {t.money?.fee != null && (
          countering ? (
            <TermRow
              label="Fee"
              was={changed.includes('money') ? `₹${Number(t.money.fee).toLocaleString('en-IN')}` : null}
              unchanged={!changed.includes('money')}
            >
              <View style={s.inlineInput}>
                <Text style={s.inlineUnit}>₹</Text>
                <TextInput
                  style={s.inlineTxt}
                  value={cFee}
                  onChangeText={setCFee}
                  keyboardType="numeric"
                />
              </View>
            </TermRow>
          ) : <Row k="Fee" v={`₹${Number(t.money.fee).toLocaleString('en-IN')}`} tag="negotiable" />
        )}
        {/* One date now, whatever the deal. Older conversations that still carry a window
            fall back to showing it rather than a blank row.
            Contract: features/collab-terms-by-aim (item 3) */}
        {countering ? (
          <TermRow
            label="Post by"
            was={changed.includes('time') ? fmtD(t.time?.post_by || t.time?.window_end) : null}
            unchanged={!changed.includes('time')}
          >
            <DateField value={cPostBy} onChange={setCPostBy} style={{ marginBottom: 0 }} />
          </TermRow>
        ) : (t.time?.post_by || t.time?.window_end) ? (
          <Row k="Post by" v={fmtD(t.time.post_by || t.time.window_end)} tag="negotiable" />
        ) : null}
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
        {t.mode && (countering ? (
          <TermRow
            label="Where you'd work"
            was={changed.includes('mode') ? (describeMode(t.mode, 'creator') || {}).place : null}
            unchanged={!changed.includes('mode')}
          >
            <View style={s.chips}>
              {PLACES.map(o => (
                <TouchableOpacity key={o.v} style={[s.chip, cPlace === o.v && s.chipAct]}
                  onPress={() => { setCPlace(o.v); if (o.v !== 'remote') setCShipping(null); }}>
                  <Text style={[s.chipTxt, cPlace === o.v && s.chipTxtAct]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {cPlace === 'remote' && (
              <View style={[s.chips, { marginTop: 6 }]}>
                {SHIPPING.map(o => (
                  <TouchableOpacity key={o.v} style={[s.chip, cShipping === o.v && s.chipAct]}
                    onPress={() => setCShipping(o.v)}>
                    <Text style={[s.chipTxt, cShipping === o.v && s.chipTxtAct]}>
                      {o.v === 'yes' ? 'Ship to me' : 'No'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </TermRow>
        ) : <WorkingStyleRows mode={t.mode} tag="negotiable" />)}

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

        {paidDeal && (t.deliverables || countering) && (
          <>
            <Text style={s.h}>
              WHAT THE FEE BUYS
              {countering && changed.includes('deliverables') ? '  ·  CHANGED' : ''}
            </Text>
            {countering ? DELIVERABLES.map(d => {
              const n = Number((cDeliverables || {})[d.v]) || 0;
              const bump = (by) => setCDeliverables(prev => ({
                ...(prev || {}), [d.v]: Math.max(0, (Number((prev || {})[d.v]) || 0) + by),
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
            }) : t.deliverables.map(d => (
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
              <TouchableOpacity style={s.ctaInk} disabled={busy} onPress={startCounter}>
                <Text style={s.ctaInkTxt}>COUNTER ({roundsLeft} LEFT)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.ctaGhost} disabled={busy} onPress={doDecline}>
              <Text style={s.ctaGhostTxt}>Not interested</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* The terms above ARE the counter form now. All that is left is to send it —
            and the button says how much she actually moved, so nothing goes by accident.
            Contract: features/collab-terms-by-aim (item 7) */}
        {active && countering && (
          <View style={{ marginTop: 18 }}>
            <TouchableOpacity
              style={[s.cta, changed.length === 0 && s.ctaOff]}
              disabled={busy || changed.length === 0}
              onPress={doCounter}
            >
              <Text style={s.ctaTxt}>
                {busy ? 'SENDING…'
                  : changed.length === 0 ? 'CHANGE SOMETHING TO COUNTER'
                  : `SEND COUNTER · ${changed.length} CHANGE${changed.length === 1 ? '' : 'S'}`}
              </Text>
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

/**
 * What she would be promoting, in her words.
 * Contract: features/collab-terms-by-aim (item 8)
 *
 * A hand-picked list used to read as "3 specific products" — a count she could not act
 * on. The brand's picker now sends the NAMES alongside the ids for exactly this: an
 * agreement should say what was offered on the day, even if a product is renamed or
 * removed afterwards.
 */
function scopeText(scope) {
  if (!scope) return '—';
  if (scope.level === 'store') return 'Their whole store';
  if (scope.level === 'category') return scope.category || 'A category';

  const names = scope.product_names || [];
  const count = (scope.product_ids || []).length;
  if (names.length === 0) return count === 1 ? '1 specific product' : `${count} specific products`;
  // Three names is about as much as a row can carry before it stops being readable.
  if (names.length <= 3) return names.join(' · ');
  return `${names.slice(0, 3).join(' · ')} +${names.length - 3} more`;
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
  termRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: ig.lineSoft,
  },
  termLabel: { fontSize: 12, color: ig.mut, width: 104 },
  termBody: { flex: 1 },
  wasTag: { fontSize: 10, fontWeight: '800', color: ig.yInk, backgroundColor: ig.yBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  okTag: { fontSize: 10, fontWeight: '800', color: ig.green, backgroundColor: ig.greenBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  inlineInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: ig.line, borderRadius: 8, paddingHorizontal: 10,
  },
  inlineTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: ig.text, paddingVertical: 8 },
  inlineUnit: { fontSize: 13, color: ig.mut },
  ctaOff: { opacity: 0.45 },
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
