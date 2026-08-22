import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { influencerApi } from '../../services/api';

/**
 * CollabPitchDetailScreen — her pitch to a brand, and the reply she has never been able
 * to give.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * Today a creator pitches ₹20,000, the brand counters ₹8,000, and her only buttons are
 * accept or walk away. She cannot say ₹14,000. "Negotiate" has meant negotiate only when
 * the brand started it.
 *
 * Her side of this was finished long ago — the route, the round limits, the validation
 * and the diary entry all exist and no client has ever called them. This screen is the
 * missing half.
 *
 * The grammar is deliberately IDENTICAL to an incoming invitation: same three buttons,
 * same before-and-after diff, same rounds line. She learns one thing, not two.
 */

const AIM_LABEL = { conversion: 'Pay per sale', engagement: 'Pay for content', hybrid: 'Fee + commission' };
const fmtD = (d) => (d ? String(d).slice(0, 10) : '—');
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** What is on the table right now — her pitch, or the counter sitting over it. */
function currentTerms(p) {
  if (!p) return {};
  if (p.counter_terms) return p.counter_terms;
  return {
    money: { fee: p.proposed_fee, commission_pct: p.proposed_commission_pct },
    time: { window_start: p.proposed_posting_window_start, window_end: p.proposed_posting_window_end },
  };
}

/** What she originally asked for, so a counter can be shown as movement. */
function openingTerms(p) {
  return {
    money: { fee: p?.proposed_fee, commission_pct: p?.proposed_commission_pct },
    time: { window_start: p?.proposed_posting_window_start, window_end: p?.proposed_posting_window_end },
  };
}

export default function CollabPitchDetailScreen({ route, navigation }) {
  const { proposalId } = route.params || {};
  const [pitch, setPitch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [fee, setFee] = useState('');
  const [pct, setPct] = useState('');

  const load = useCallback(async () => {
    const res = await influencerApi.getMyProposal(proposalId);
    if (res.success) setPitch(res.data?.proposal || null);
    setLoading(false);
  }, [proposalId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={s.center}><ActivityIndicator color={ig.text} /></View>;
  if (!pitch) {
    return (
      <View style={s.center}>
        <Icon name="alert-circle-outline" size={30} color={ig.mut2} />
        <Text style={s.muted}>This pitch could not be loaded.</Text>
      </View>
    );
  }

  const status = String(pitch.status || '').toLowerCase();
  const theyCountered = status === 'countered' && pitch.counter_by === 'brand';
  const sheCountered = status === 'countered' && pitch.counter_by === 'creator';
  const roundsUsed = Number(pitch.creator_rounds_used || 0);
  const roundsMax = Number(pitch.counter_rounds_per_side || 2);
  const roundsLeft = Math.max(0, roundsMax - roundsUsed);

  const now = currentTerms(pitch);
  const opening = openingTerms(pitch);

  async function accept() {
    setBusy(true);
    const res = await influencerApi.respondCounter(pitch.id, 'accept');
    setBusy(false);
    if (!res.success) return Alert.alert('Could not accept', res.error?.message || 'Please try again.');
    await load();
  }

  async function decline() {
    Alert.alert(
      'Decline this counter?',
      'The conversation closes. You can pitch this brand again later.',
      [
        { text: 'Keep it open', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const res = await influencerApi.respondCounter(pitch.id, 'decline');
            setBusy(false);
            if (!res.success) return Alert.alert('Could not decline', res.error?.message || 'Please try again.');
            await load();
          },
        },
      ],
    );
  }

  async function sendCounter() {
    // Only what she actually filled in is sent. An untouched field means "leave this
    // as it stands", not "set it to blank" — sending empties would silently wipe a
    // term she never meant to touch.
    const terms = { money: {} };
    if (fee.trim() !== '') terms.money.fee = Number(fee);
    if (pct.trim() !== '') terms.money.commission_pct = Number(pct);
    if (Object.keys(terms.money).length === 0) {
      return Alert.alert('Nothing to send', 'Change the fee or the commission first.');
    }

    setBusy(true);
    const res = await influencerApi.counterMyProposal(pitch.id, terms);
    setBusy(false);
    if (!res.success) {
      return Alert.alert('Could not send', res.error?.message || 'Please try again.');
    }
    setComposing(false);
    setFee(''); setPct('');
    await load();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
            <Icon name="chevron-left" size={24} color={ig.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.navTitle}>{pitch.business_name || 'Brand'}</Text>
            <Text style={s.navSub}>
              {theyCountered ? 'YOUR PITCH · THEY COUNTERED'
                : sheCountered ? 'YOUR PITCH · YOU COUNTERED'
                : `YOUR PITCH · ${status.toUpperCase()}`}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {theyCountered && (
            <View style={s.sec}>
              <View style={[s.banner, { backgroundColor: ig.yBg }]}>
                <Text style={[s.bannerT, { color: ig.yInk }]}>
                  {pitch.business_name} countered on {fmtD(pitch.brand_response_at)}. <Text style={{ fontWeight: '900' }}>Your move.</Text>
                </Text>
              </View>
            </View>
          )}
          {sheCountered && (
            <View style={s.sec}>
              <View style={[s.banner, { backgroundColor: ig.blueBg }]}>
                <Text style={[s.bannerT, { color: ig.blue }]}>
                  You countered. Waiting on {pitch.business_name}.
                </Text>
              </View>
            </View>
          )}

          {/* What moved — never a bare "countered". The diff IS the information. */}
          {theyCountered && (
            <View style={s.sec}>
              <Text style={s.secH}>What moved</Text>
              <Diff k="Fee" from={money(opening.money.fee)} to={money(now.money?.fee)} />
              <Diff
                k="Commission"
                from={opening.money.commission_pct != null ? `${opening.money.commission_pct}%` : 'none'}
                to={now.money?.commission_pct != null ? `${now.money.commission_pct}%` : 'none'}
              />
              <Diff k="Window" same={`${fmtD(opening.time.window_start)} – ${fmtD(opening.time.window_end)}`} />
            </View>
          )}

          {!theyCountered && (
            <View style={s.sec}>
              <Text style={s.secH}>What you asked for</Text>
              <Row k="What it is for" v={AIM_LABEL[pitch.goal] || pitch.goal || '—'} />
              {pitch.proposed_fee != null && <Row k="Fee" v={money(pitch.proposed_fee)} />}
              {pitch.proposed_commission_pct != null && <Row k="Commission" v={`${pitch.proposed_commission_pct}%`} />}
              <Row k="Window" v={`${fmtD(pitch.proposed_posting_window_start)} – ${fmtD(pitch.proposed_posting_window_end)}`} />
            </View>
          )}

          {pitch.brand_response_message ? (
            <View style={s.sec}>
              <Text style={s.quote}>“{pitch.brand_response_message}”</Text>
            </View>
          ) : null}

          {/* Sent but unopened is real information, already recorded and never shown. */}
          {status === 'sent' && (
            <View style={s.sec}>
              <Text style={s.muted}>
                {pitch.viewed_at
                  ? `Opened ${fmtD(pitch.viewed_at)} — not answered yet.`
                  : 'Sent, and not opened yet.'}
              </Text>
            </View>
          )}

          {/* The three buttons. Identical grammar to an incoming invitation. */}
          {theyCountered && !composing && (
            <View style={s.sec}>
              <TouchableOpacity style={[s.btn, s.btnPri]} onPress={accept} disabled={busy} activeOpacity={0.85}>
                <Text style={s.btnPriT}>
                  Accept {now.money?.fee != null ? money(now.money.fee) : ''}
                  {now.money?.commission_pct != null ? ` + ${now.money.commission_pct}%` : ''}
                </Text>
              </TouchableOpacity>

              {roundsLeft > 0 ? (
                <TouchableOpacity style={[s.btn, s.btnSec]} onPress={() => setComposing(true)} disabled={busy} activeOpacity={0.85}>
                  <Text style={s.btnSecT}>Counter back · {roundsLeft} left</Text>
                </TouchableOpacity>
              ) : (
                /* Out of rounds says so rather than hiding the button silently —
                   a control that vanishes reads as a bug. */
                <View style={[s.btn, s.btnOff]}>
                  <Text style={s.btnOffT}>No counters left — accept or decline</Text>
                </View>
              )}

              <TouchableOpacity style={[s.btn, s.btnDgr]} onPress={decline} disabled={busy} activeOpacity={0.85}>
                <Text style={s.btnDgrT}>Decline</Text>
              </TouchableOpacity>

              <Text style={s.rounds}>
                You have used {roundsUsed} of {roundsMax}. They have used {pitch.brand_rounds_used || 0} of {roundsMax}.
              </Text>
            </View>
          )}

          {/* Her counter. Only money moves here — a pitch's window and deliverables
              were hers to set in the first place, so re-opening them mid-negotiation
              would be answering a question nobody asked. */}
          {composing && (
            <View style={s.sec}>
              <Text style={s.secH}>Your counter</Text>

              <Text style={s.label}>Fee ₹</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                value={fee}
                onChangeText={setFee}
                placeholder={String(now.money?.fee ?? '')}
                placeholderTextColor={ig.mut2}
              />

              <Text style={s.label}>Commission %</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                value={pct}
                onChangeText={setPct}
                placeholder={String(now.money?.commission_pct ?? '')}
                placeholderTextColor={ig.mut2}
              />

              <Text style={s.hint}>Leave a field untouched to keep it as it stands.</Text>

              <TouchableOpacity style={[s.btn, s.btnPri]} onPress={sendCounter} disabled={busy} activeOpacity={0.85}>
                <Text style={s.btnPriT}>{busy ? 'Sending…' : 'Send counter'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSec]} onPress={() => setComposing(false)} disabled={busy} activeOpacity={0.85}>
                <Text style={s.btnSecT}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.rounds}>After this you have {Math.max(0, roundsLeft - 1)} left.</Text>
            </View>
          )}

          <View style={s.sec}>
            <TouchableOpacity
              style={[s.btn, s.btnOff]}
              onPress={() => navigation.navigate('CollabDiary', { proposalId: pitch.id })}
              activeOpacity={0.85}
            >
              <Text style={s.btnOffT}>See how you got here</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ k, v }) {
  return <View style={s.row}><Text style={s.rowK}>{k}</Text><Text style={s.rowV}>{v}</Text></View>;
}

function Diff({ k, from, to, same }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      {same ? (
        <Text style={s.same}>{same} — unchanged</Text>
      ) : (
        <Text style={s.rowV}>
          <Text style={s.from}>{from}</Text>
          <Text style={s.arrow}>{'  →  '}</Text>
          <Text style={s.to}>{to}</Text>
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg, padding: 40 },

  nav: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.3 },

  sec: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  secH: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 10 },

  banner: { borderRadius: 11, padding: 12 },
  bannerT: { fontSize: 12, fontWeight: '700', lineHeight: 18 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowK: { fontSize: 12, color: ig.mut, fontWeight: '600' },
  rowV: { fontSize: 13, fontWeight: '800', color: ig.text, textAlign: 'right', flexShrink: 1, marginLeft: 12 },
  from: { color: ig.mut2, textDecorationLine: 'line-through', fontWeight: '700' },
  arrow: { color: ig.mut2 },
  to: { color: ig.text, fontWeight: '800' },
  same: { fontSize: 12, color: ig.mut, fontWeight: '700', textAlign: 'right', flexShrink: 1, marginLeft: 12 },

  quote: { fontSize: 12, color: ig.text2, fontStyle: 'italic', lineHeight: 18, backgroundColor: ig.bgSoft, borderRadius: 10, padding: 12, borderLeftWidth: 2, borderLeftColor: ig.line },
  muted: { fontSize: 12, color: ig.mut, fontWeight: '600', textAlign: 'center', marginTop: 8 },

  label: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: ig.mut, marginBottom: 5, marginTop: 8 },
  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: ig.text },
  hint: { fontSize: 11, color: ig.mut, fontWeight: '600', marginTop: 8 },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 9 },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { color: ig.bg, fontSize: 13, fontWeight: '800' },
  btnSec: { backgroundColor: ig.bg, borderWidth: 1, borderColor: ig.line },
  btnSecT: { color: ig.text, fontSize: 13, fontWeight: '800' },
  btnDgr: { backgroundColor: ig.bg, borderWidth: 1, borderColor: '#F0C4BA' },
  btnDgrT: { color: ig.red, fontSize: 13, fontWeight: '800' },
  btnOff: { backgroundColor: ig.bgSoft, borderWidth: 1, borderColor: ig.lineSoft },
  btnOffT: { color: ig.mut, fontSize: 12.5, fontWeight: '800' },

  rounds: { fontSize: 11, color: ig.mut, fontWeight: '700', textAlign: 'center', marginTop: 9 },
});
