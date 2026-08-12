import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';

/**
 * BrandCollabRequestsScreen — the brand's sent requests + agreed creators, on mobile.
 * Contract: features/collab-part2-precampaign-handshake (mockup ③⑥⑦).
 *
 * A creator's counter renders as old → new per moved term, with Accept / Decline.
 * Agreed creators appear under READY TO BRIEF — and since detailed campaign creation is
 * web-only by locked scope, the row says so instead of pretending a tap could build one.
 */

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const [rq, ag] = await Promise.all([brandApi.listSentCollabRequests(), brandApi.listAgreements()]);
    if (rq.success) setRequests(rq.data?.requests || []);
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

  if (loading) return <View style={s.center}><ActivityIndicator color={P.yellow} /></View>;

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

            {rows.length > 0 && (
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
              </View>
            )}

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
  avTxt: { fontFamily: fonts.monoBold, color: P.yellow, fontSize: 12 },
  name: { fontFamily: fonts.sansBold, fontSize: 12.5, color: P.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: P.muted2, marginTop: 1 },
  st: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted2, letterSpacing: 0.4 },
  webNote: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: P.muted, marginTop: 8, lineHeight: 15 },
  diff: { borderTopWidth: 1, borderTopColor: P.bg2, marginTop: 9, paddingTop: 7 },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  diffK: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted3, width: 70, letterSpacing: 0.3, textTransform: 'uppercase' },
  diffOld: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: P.muted2, textDecorationLine: 'line-through' },
  diffArr: { fontFamily: fonts.monoBold, fontSize: 11, color: P.muted3 },
  diffNew: { fontFamily: fonts.monoBold, fontSize: 11.5, color: P.yellowText, backgroundColor: P.yellowPale, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  btnPri: { flex: 1, backgroundColor: P.yellow, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  btnPriTxt: { fontFamily: fonts.displayBlack, fontSize: 11, color: P.ink, letterSpacing: 0.3 },
  btnDgr: { borderRadius: 9, paddingVertical: 10, paddingHorizontal: 13, alignItems: 'center', borderWidth: 1, borderColor: '#FBCBC4' },
  btnDgrTxt: { fontFamily: fonts.sansBold, fontSize: 11, color: '#B91C1C' },
  withdraw: { marginTop: 8, alignSelf: 'flex-start' },
  withdrawTxt: { fontFamily: fonts.sansBold, fontSize: 11, color: P.muted },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: P.ink, marginBottom: 6 },
  emptySub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17 },
});
