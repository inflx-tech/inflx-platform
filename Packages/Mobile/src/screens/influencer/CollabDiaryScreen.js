import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { influencerApi } from '../../services/api';

/**
 * CollabDiaryScreen — "what happened here".
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * Every offer that was ever on the table, in the order it happened. The brand sees this
 * same page, word for word — which is the point: two internally-consistent stories about
 * one negotiation is the failure a shared record exists to prevent.
 *
 * Today the record itself keeps only the LATEST counter, so a settled 18% is all that
 * survives and the 15% asked and the 22% countered are gone. Everything has in fact been
 * written down all along; nothing could read it back until now.
 *
 * An entry says what MOVED, not that something moved. "Countered" is not worth reading;
 * "15% → 22%" is.
 */

const ACTION_LABEL = {
  asked:     'asked you',
  viewed:    'opened it',
  countered: 'countered',
  accepted:  'accepted',
  declined:  'declined',
  withdrawn: 'withdrew',
  expired:   'expired',
};

/** Who moved, in her words — never a role name from the database. */
function actorLabel(who, brandName) {
  if (who === 'brand') return brandName || 'The brand';
  if (who === 'creator') return 'You';
  if (who === 'admin') return 'INFLX';
  return 'Automatically';
}

const TONE = {
  brand:   { dot: ig.blue,  label: ig.blue },
  creator: { dot: ig.y,     label: ig.yInk },
  admin:   { dot: ig.mut2,  label: ig.mut },
  system:  { dot: ig.mut2,  label: ig.mut },
};

const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).toUpperCase();
};

const fmtValue = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** "money.commission_pct" reads as nothing; "Commission" reads as something. */
const FIELD_LABEL = {
  'money.commission_pct': 'Commission',
  'money.fee': 'Fee',
  'time.post_by': 'Post by',
  'time.window_start': 'Window from',
  'time.window_end': 'Window to',
  'scope.category': 'What you promote',
  'mode': 'Where you shoot',
  'aim': 'What it is for',
};
const fieldLabel = (k) => FIELD_LABEL[k] || String(k).split('.').pop().replace(/_/g, ' ');

export default function CollabDiaryScreen({ route, navigation, api }) {
  // The brand renders this same component with its own api (see BrandDiaryScreen).
  // One screen, two callers — never two screens telling one story.
  const client = api || influencerApi;
  const { requestId, proposalId } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const res = requestId
      ? await client.getRequestDiary(requestId)
      : await client.getPitchDiary(proposalId);
    if (res.success) setData(res.data);
    else setError(res.error?.message || 'Could not load this history');
    setLoading(false);
  }, [requestId, proposalId, client]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={ig.text} /></View>;
  }

  if (error) {
    return (
      <View style={s.center}>
        <Icon name="alert-circle-outline" size={30} color={ig.mut2} />
        <Text style={s.errT}>{error}</Text>
      </View>
    );
  }

  const convo = data.conversation || {};
  const entries = data.entries || [];
  const settled = convo.settled || {};

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.navTitle}>What happened here</Text>
          <Text style={s.navSub}>{String(convo.brand_name || '').toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Where it landed. Only shown once there IS a settlement — an open
            negotiation has no "settled on", and inventing one would be a lie. */}
        {convo.status === 'agreed' || convo.status === 'accepted' ? (
          <View style={s.sec}>
            <Text style={s.secH}>Settled on</Text>
            {settled.money?.commission_pct != null && (
              <Row k="Commission" v={`${settled.money.commission_pct}%`} />
            )}
            {settled.money?.fee != null && (
              <Row k="Fee" v={`₹${Number(settled.money.fee).toLocaleString('en-IN')}`} />
            )}
            {settled.time?.post_by && <Row k="Post by" v={String(settled.time.post_by).slice(0, 10)} />}
            {convo.settled_at && <Row k="Agreed" v={fmtWhen(convo.settled_at)} />}
          </View>
        ) : null}

        <View style={s.sec}>
          <Text style={s.secH}>
            {entries.length === 1 ? 'One move so far' : `How you got here · ${entries.length} moves`}
          </Text>

          {entries.length === 0 ? (
            /* Honest rather than blank. The recording started partway through the
               platform's life, so older conversations genuinely have no history —
               saying so beats an empty box that looks broken. */
            <Text style={s.emptyNote}>
              Nothing was recorded for this conversation. Anything that happens from now on
              appears here.
            </Text>
          ) : entries.map((e, i) => {
            const tone = TONE[e.who] || TONE.system;
            const isLast = i === entries.length - 1;
            const moved = e.changed && Object.keys(e.changed).length > 0;
            return (
              <View key={e.id} style={s.ev}>
                <View style={s.evRail}>
                  <View style={[s.evDot, { backgroundColor: tone.dot }]} />
                  {!isLast && <View style={s.evLine} />}
                </View>
                <View style={s.evBody}>
                  <Text style={[s.evWho, { color: tone.label }]}>
                    {actorLabel(e.who, convo.brand_name)} {ACTION_LABEL[e.action] || e.action}
                  </Text>
                  <Text style={s.evWhen}>
                    {fmtWhen(e.at)}
                    {e.round_of ? `  ·  ${e.who === 'creator' ? 'YOUR' : 'THEIR'} ${e.round_of}${e.round_of === 1 ? 'ST' : 'ND'} OF ${e.round_max}` : ''}
                  </Text>

                  {moved && Object.entries(e.changed).map(([k, v]) => (
                    <Text key={k} style={s.evMove}>
                      {fieldLabel(k)}{'  '}
                      <Text style={s.evFrom}>{fmtValue(v?.from)}</Text>
                      <Text style={s.evArrow}>{'  →  '}</Text>
                      <Text style={s.evTo}>{fmtValue(v?.to)}</Text>
                    </Text>
                  ))}

                  {e.note ? <Text style={s.evNote}>“{e.note}”</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={s.sec}>
          <View style={s.mirror}>
            <Icon name="account-multiple-outline" size={15} color={ig.green} />
            <Text style={s.mirrorT}>
              {convo.brand_name} sees this same page, word for word.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ k, v }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={s.rowV}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg, padding: 40 },
  errT: { fontSize: 13, color: ig.mut, marginTop: 10, textAlign: 'center' },

  nav: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.3 },

  sec: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  secH: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 10 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowK: { fontSize: 12, color: ig.mut, fontWeight: '600' },
  rowV: { fontSize: 13, fontWeight: '800', color: ig.text, textAlign: 'right', flexShrink: 1, marginLeft: 12 },

  ev: { flexDirection: 'row' },
  evRail: { width: 18, alignItems: 'center' },
  evDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  evLine: { flex: 1, width: 1.5, backgroundColor: ig.lineSoft, marginTop: 2, marginBottom: 2 },
  evBody: { flex: 1, paddingBottom: 16, paddingLeft: 8 },
  evWho: { fontSize: 12.5, fontWeight: '800' },
  evWhen: { fontSize: 10, color: ig.mut, fontWeight: '700', marginTop: 2, letterSpacing: 0.2 },
  evMove: { fontSize: 11.5, color: ig.mut, fontWeight: '700', marginTop: 5 },
  evFrom: { color: ig.mut2, textDecorationLine: 'line-through' },
  evArrow: { color: ig.mut2 },
  evTo: { color: ig.text, fontWeight: '800' },
  evNote: { fontSize: 11.5, color: ig.text2, fontStyle: 'italic', marginTop: 6, lineHeight: 17 },

  emptyNote: { fontSize: 12, color: ig.mut, lineHeight: 18 },

  mirror: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ig.greenBg, borderRadius: 11, padding: 12 },
  mirrorT: { flex: 1, fontSize: 11.5, color: ig.green, fontWeight: '700', lineHeight: 17 },
});
