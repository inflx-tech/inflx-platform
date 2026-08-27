import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PLACES, SHIPPING, fromMode } from '../../utils/workingStyle';
import { changedTerms, buildCounter } from '../../utils/collabCounter';
import DateField from '../../components/DateField';

/**
 * BrandCollabRequestsScreen — the brand's sent requests + agreed creators, on mobile.
 * Contract: features/collab-part2-precampaign-handshake (mockup ③⑥⑦).
 *
 * A creator's counter renders as old → new per moved term, with Accept / Counter back /
 * Decline — the mockup's view ⑥ locked all three; only the first and third ever shipped.
 * `brandApi.counterCollabRequest` and its backend route already existed and were unused.
 *
 * Agreed creators appear under READY TO BRIEF — and since detailed campaign creation is
 * web-only by locked scope, the row says so instead of pretending a tap could build one.
 */

const DELIVERABLES = [
  { v: 'reel',          label: 'Reel' },
  { v: 'post',          label: 'Post' },
  { v: 'story',         label: 'Story' },
  { v: 'youtube_video', label: 'YouTube Video' },
  { v: 'youtube_short', label: 'YouTube Short' },
];

/** The terms currently on the table — the original, or the latest counter over it.
 * Mirrors backend/src/controllers/handshake.controller.js currentTerms(): a shallow
 * settle, not a deep merge, matching how buildCounter() already sends complete
 * money/deliverables objects for any field it touches. */
function currentTerms(req) {
  const o = req.terms_json || {};
  const c = req.counter_terms_json;
  if (!c) return o;
  return { ...o, ...c, importance: { ...(o.importance || {}), ...(c.importance || {}) } };
}

const fmtD = (d) => (d ? String(d).slice(0, 10) : '—');

function summary(t) {
  if (!t) return '—';
  const bits = [];
  if (t.money?.commission_pct != null) bits.push(`${t.money.commission_pct}%`);
  if (t.money?.fee != null) bits.push(`₹${Number(t.money.fee).toLocaleString('en-IN')}`);
  if (t.time?.post_by) bits.push(`post by ${fmtD(t.time.post_by)}`);
  else if (t.time?.window_end) bits.push(`by ${fmtD(t.time.window_end)}`);
  return bits.join(' · ') || '—';
}

/** The moved terms, old → new. */
function diffRows(req) {
  const o = req.terms_json || {};
  const c = req.counter_terms_json || {};
  const rows = [];
  if (c.money?.commission_pct != null && c.money.commission_pct !== o.money?.commission_pct) {
    rows.push(['Commission', `${o.money?.commission_pct ?? '—'}%`, `${c.money.commission_pct}%`]);
  }
  if (c.money?.fee != null && c.money.fee !== o.money?.fee) {
    rows.push(['Fee', `₹${o.money?.fee ?? '—'}`, `₹${c.money.fee}`]);
  }
  if (c.time?.post_by && c.time.post_by !== o.time?.post_by) {
    rows.push(['Post by', fmtD(o.time?.post_by), fmtD(c.time.post_by)]);
  }
  if (c.mode && c.mode !== o.mode) rows.push(['Style', o.mode || '—', c.mode]);
  if (c.deliverables) {
    rows.push(['Delivers', o.deliverables ? 'proposed' : 'left open',
      c.deliverables.map(d => `${d.count} ${d.type}`).join(' + ')]);
  }
  return rows;
}

export default function BrandCollabRequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [roundsPerSide, setRoundsPerSide] = useState(2);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);

  // Counter form — one at a time, keyed by which card is open.
  const [counteringId, setCounteringId] = useState(null);
  const [cCommission, setCCommission] = useState('');
  const [cFee, setCFee] = useState('');
  const [cPostBy, setCPostBy] = useState('');
  const [cPlace, setCPlace] = useState('');
  const [cShipping, setCShipping] = useState(null);
  const [cDeliverables, setCDeliverables] = useState(null);

  const load = useCallback(async () => {
    const [rq, ag] = await Promise.all([brandApi.listSentCollabRequests(), brandApi.listAgreements()]);
    if (rq.success) {
      setRequests(rq.data?.requests || []);
      if (rq.data?.counter_rounds_per_side != null) setRoundsPerSide(rq.data.counter_rounds_per_side);
    }
    if (ag.success) setAgreements(ag.data?.agreements || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id, fn, okMsg) => {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.success) { if (okMsg) Alert.alert(okMsg); load(); }
    else Alert.alert('Failed', res.error?.message || 'Try again.');
  };

  /** Starts from what's on the table now, not a blank form — mirrors the creator's
   * counter screen: every control pre-filled makes "no change" the default. */
  function startCounter(r) {
    const t = currentTerms(r);
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
    setCounteringId(r.id);
  }

  const doCounter = async (r) => {
    const t = currentTerms(r);
    if (cPlace === 'remote' && cShipping == null) {
      Alert.alert('One more thing', 'Say whether you want them to ship products.');
      return;
    }
    const edits = { commission: cCommission, fee: cFee, postBy: cPostBy, place: cPlace, shipping: cShipping, deliverables: cDeliverables };
    const changed = changedTerms(t, edits);
    const counter = buildCounter(t, edits, changed);
    if (!Object.keys(counter).length) { Alert.alert('Nothing changed', 'Adjust at least one term to counter.'); return; }
    setBusy(r.id);
    const res = await brandApi.counterCollabRequest(r.id, counter);
    setBusy(null);
    if (res.success) {
      setCounteringId(null);
      Alert.alert('Counter sent', 'They will see exactly what you moved.');
      load();
    } else {
      Alert.alert('Could not counter', res.error?.message || 'Try again.');
    }
  };

  /** The counter form for one card — commission/fee, post-by, working style,
   * and deliverables (paid deals only), the same fields collabCounter.js already
   * knows how to diff. */
  function renderCounterForm(r) {
    const t = currentTerms(r);
    const edits = { commission: cCommission, fee: cFee, postBy: cPostBy, place: cPlace, shipping: cShipping, deliverables: cDeliverables };
    const changed = changedTerms(t, edits);
    const paidDeal = t.aim === 'engagement' || t.aim === 'hybrid';
    const busyNow = busy === r.id;

    return (
      <View style={s.form}>
        {t.money?.commission_pct != null && (
          <View style={s.field}>
            <Text style={s.fl}>Commission{changed.includes('money') && <Text style={s.flChanged}>  · CHANGED</Text>}</Text>
            <View style={s.inlineInput}>
              <TextInput style={s.inlineTxt} value={cCommission} onChangeText={setCCommission} keyboardType="numeric" />
              <Text style={s.inlineUnit}>%</Text>
            </View>
          </View>
        )}
        {t.money?.fee != null && (
          <View style={s.field}>
            <Text style={s.fl}>Fee{changed.includes('money') && <Text style={s.flChanged}>  · CHANGED</Text>}</Text>
            <View style={s.inlineInput}>
              <Text style={s.inlineUnit}>₹</Text>
              <TextInput style={s.inlineTxt} value={cFee} onChangeText={setCFee} keyboardType="numeric" />
            </View>
          </View>
        )}
        <View style={s.field}>
          <Text style={s.fl}>Post by{changed.includes('time') && <Text style={s.flChanged}>  · CHANGED</Text>}</Text>
          <DateField value={cPostBy} onChange={setCPostBy} style={{ marginBottom: 0 }} />
        </View>
        <View style={s.field}>
          <Text style={s.fl}>Working style{changed.includes('mode') && <Text style={s.flChanged}>  · CHANGED</Text>}</Text>
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
                  <Text style={[s.chipTxt, cShipping === o.v && s.chipTxtAct]}>{o.v === 'yes' ? 'Ship to them' : 'No'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {paidDeal && (
          <View style={s.field}>
            <Text style={s.fl}>What the fee buys{changed.includes('deliverables') && <Text style={s.flChanged}>  · CHANGED</Text>}</Text>
            {DELIVERABLES.map(d => {
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
            })}
          </View>
        )}

        <View style={s.btnRow}>
          <TouchableOpacity style={[s.btnPri, changed.length === 0 && s.btnOff]} disabled={busyNow || changed.length === 0}
            onPress={() => doCounter(r)}>
            <Text style={s.btnPriTxt}>
              {busyNow ? 'SENDING…' : changed.length === 0 ? 'CHANGE SOMETHING TO COUNTER' : `SEND COUNTER · ${changed.length} CHANGE${changed.length === 1 ? '' : 'S'}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnGhost} disabled={busyNow} onPress={() => setCounteringId(null)}>
            <Text style={s.btnGhostTxt}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={P.ink} /></View>;

  const sections = [
    ...(agreements.length ? [{ header: 'READY TO BRIEF' }] : []),
    ...agreements.map(a => ({ agreement: a })),
    { header: 'REQUESTS' },
    ...requests.map(r => ({ request: r })),
  ];

  return (
    <FlatList
      style={s.wrap}
      data={sections}
      keyExtractor={(item, i) => item.agreement?.id || item.request?.id || `h${i}`}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
      renderItem={({ item }) => {
        if (item.header) return <Text style={s.h}>{item.header}</Text>;

        if (item.agreement) {
          const a = item.agreement;
          return (
            <View style={[s.card, s.cardAgreed]}>
              <View style={s.head}>
                <View style={s.av}><Text style={s.avTxt}>{(a.influencer_name || '?')[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{a.influencer_name || `@${a.instagram_handle}`}</Text>
                  <Text style={s.meta}>{summary(a.terms_json)} · expires {fmtD(a.expires_at)}</Text>
                </View>
                <Text style={[s.st, { color: '#047857' }]}>AGREED</Text>
              </View>
              {/* Campaign creation is web-only by locked scope — say so, don't pretend. */}
              <Text style={s.webNote}>Build the campaign on the web dashboard — their terms arrive pre-filled, and their acceptance is one tap.</Text>
            </View>
          );
        }

        const r = item.request;
        const rows = r.status === 'countered' && r.counter_by === 'creator' ? diffRows(r) : [];
        const isCountering = counteringId === r.id;
        const roundsLeft = roundsPerSide - Number(r.brand_rounds_used || 0);
        return (
          <View style={s.card}>
            <View style={s.head}>
              <View style={s.av}><Text style={s.avTxt}>{(r.influencer_name || r.instagram_handle || '?')[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.influencer_name || `@${r.instagram_handle}`}</Text>
                <Text style={s.meta}>{summary(r.terms_json)}{r.origin !== 'direct' ? ` · ${r.origin}` : ''}</Text>
              </View>
              <Text style={s.st}>{r.status.toUpperCase()}</Text>
            </View>

            {rows.length > 0 && !isCountering && (
              <View style={s.diff}>
                {rows.map(([k, a, b]) => (
                  <View key={k} style={s.diffRow}>
                    <Text style={s.diffK}>{k}</Text>
                    <Text style={s.diffOld}>{a}</Text>
                    <Text style={s.diffArr}>→</Text>
                    <Text style={s.diffNew}>{b}</Text>
                  </View>
                ))}
                <View style={s.btnRow}>
                  <TouchableOpacity style={s.btnPri} disabled={busy === r.id}
                    onPress={() => act(r.id, () => brandApi.acceptCollabCounter(r.id), 'Terms agreed — they are ready to brief.')}>
                    <Text style={s.btnPriTxt}>ACCEPT THEIR TERMS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnDgr} disabled={busy === r.id}
                    onPress={() => act(r.id, () => brandApi.declineCollabRequest(r.id))}>
                    <Text style={s.btnDgrTxt}>Decline</Text>
                  </TouchableOpacity>
                </View>
                {roundsLeft > 0 && (
                  <TouchableOpacity style={s.counterBtn} disabled={busy === r.id} onPress={() => startCounter(r)}>
                    <Text style={s.counterBtnTxt}>COUNTER BACK ({roundsLeft} LEFT)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isCountering && renderCounterForm(r)}

            {['sent', 'viewed'].includes(r.status) && (
              <TouchableOpacity style={s.withdraw} disabled={busy === r.id}
                onPress={() => act(r.id, () => brandApi.withdrawCollabRequest(r.id))}>
                <Text style={s.withdrawTxt}>Withdraw</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
          <Text style={s.emptyTitle}>No requests yet</Text>
          <Text style={s.emptySub}>Find a creator and tap Request collab — you agree money and timing first, and build the campaign after.</Text>
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  h: { fontFamily: fonts.monoBold, fontSize: 9.5, color: P.muted2, letterSpacing: 0.5, marginTop: 10, marginBottom: 7 },
  card: { backgroundColor: P.white, borderRadius: 11, borderWidth: 1, borderColor: P.border, padding: 12, marginBottom: 8 },
  cardAgreed: { borderColor: '#A7F3D0', backgroundColor: '#F7FEF9' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  av: { width: 32, height: 32, borderRadius: 16, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center' },
  avTxt: { fontFamily: fonts.monoBold, color: P.white, fontSize: 12 },
  name: { fontFamily: fonts.sansBold, fontSize: 12.5, color: P.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: P.muted2, marginTop: 1 },
  st: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted2, letterSpacing: 0.4 },
  webNote: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: P.muted, marginTop: 8, lineHeight: 15 },
  diff: { borderTopWidth: 1, borderTopColor: P.bg2, marginTop: 9, paddingTop: 7 },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  diffK: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted3, width: 70, letterSpacing: 0.3, textTransform: 'uppercase' },
  diffOld: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: P.muted2, textDecorationLine: 'line-through' },
  diffArr: { fontFamily: fonts.monoBold, fontSize: 11, color: P.muted3 },
  diffNew: { fontFamily: fonts.monoBold, fontSize: 11.5, color: P.warnText, backgroundColor: P.warnPale, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  btnPri: { flex: 1, backgroundColor: P.ink, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  btnPriTxt: { fontFamily: fonts.displayBlack, fontSize: 11, color: P.white, letterSpacing: 0.3 },
  btnDgr: { borderRadius: 9, paddingVertical: 10, paddingHorizontal: 13, alignItems: 'center', borderWidth: 1, borderColor: '#FBCBC4' },
  btnDgrTxt: { fontFamily: fonts.sansBold, fontSize: 11, color: '#B91C1C' },
  btnOff: { opacity: 0.45 },
  btnGhost: { borderRadius: 9, paddingVertical: 10, paddingHorizontal: 13, alignItems: 'center' },
  btnGhostTxt: { fontFamily: fonts.sansBold, fontSize: 11, color: P.muted },
  counterBtn: { borderRadius: 9, paddingVertical: 10, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: P.ink },
  counterBtnTxt: { fontFamily: fonts.displayBlack, fontSize: 10.5, color: P.ink, letterSpacing: 0.3 },
  withdraw: { marginTop: 8, alignSelf: 'flex-start' },
  withdrawTxt: { fontFamily: fonts.sansBold, fontSize: 11, color: P.muted },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: P.ink, marginBottom: 6 },
  emptySub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17 },

  form: { borderTopWidth: 1, borderTopColor: P.bg2, marginTop: 9, paddingTop: 9 },
  field: { marginBottom: 11 },
  fl: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted3, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 5 },
  flChanged: { color: P.warnText },
  inlineInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: P.border, borderRadius: 8, paddingHorizontal: 10,
  },
  inlineTxt: { flex: 1, fontFamily: fonts.sansBold, fontSize: 13, color: P.ink, paddingVertical: 8 },
  inlineUnit: { fontFamily: fonts.sansRegular, fontSize: 12, color: P.muted },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  chip: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  chipAct: { backgroundColor: P.ink, borderColor: P.ink },
  chipTxt: { fontFamily: fonts.sansRegular, fontSize: 11, color: P.muted },
  chipTxtAct: { color: P.white },
  delRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: P.bg2,
  },
  delLabel: { fontFamily: fonts.sansRegular, fontSize: 12, color: P.muted },
  delLabelOn: { fontFamily: fonts.sansBold, color: P.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: P.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepTxt: { fontFamily: fonts.sansBold, fontSize: 14, color: P.ink, lineHeight: 17 },
  stepTxtOff: { color: P.muted3 },
  stepN: { fontFamily: fonts.sansBold, fontSize: 12.5, color: P.muted3, minWidth: 14, textAlign: 'center' },
  stepNOn: { color: P.ink },
});
