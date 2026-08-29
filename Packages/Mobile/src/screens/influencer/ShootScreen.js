import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// The pure-JS calendar, NOT @react-native-community/datetimepicker. An OTA bundle cannot add
// a native module — it would crash on launch, uncatchably, on a handset. DateField exists for
// exactly this reason and every date in the collaboration flow already goes through it.
import DateField from '../../components/DateField';
import { ig } from '../../theme/ig';
import { influencerApi } from '../../services/api';
import { MODE_LABEL, STATUS_LABEL, turnOf, canComplete, countersLeft, RESCHEDULE_LIMIT_PER_SIDE, shortDate, waitingOnOtherSide, WAITING_ON_OTHER } from '../../utils/shoot';
import {
  WindowCard, SlotCard, AddressCard, ParcelItem, ShortfallNote, TurnLine, Btn, WhyNote, Delivered,
} from '../../components/shoot/ShootParts';
// The shoot is the only step in the whole spine that keeps a diary — and getLog existed
// with nothing calling it, so none of it was ever visible. Same component both sides (M-8).
import ShootDiary from '../../components/shoot/ShootDiary';

/**
 * ShootScreen (creator) — one shoot, everything about it, in one place.
 * Contract: features/stage-4-the-shoot (slice 3) · boards ③ and ⑤
 *
 * WHAT THIS REPLACES
 * Eight coordination endpoints have existed and worked since before this stage, and **not one
 * of them had a screen.** The shoot was a panel three-quarters of the way down the contract
 * page, so a notification about a shoot could only point at a contract and hope she scrolled.
 * The machinery was never the gap. The door was.
 *
 * WHAT IT REFUSES TO DO
 * It never tells her what to shoot. The aim and the scope are stated; the shot list is not
 * ours to write, and the founder's rule on this predates the stage.
 *
 * COMPLETION
 * She alone marks a remote or shipped shoot done — the brand cannot see whether it happened.
 * On a store visit either side may, because the brand was there. Founder's ruling, 2026-08-27.
 */

export default function ShootScreen({ route, navigation }) {
  const { contractId, campaignInfluencerId, campaignName, brandName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [event, setEvent] = useState(null);
  const [mode, setMode] = useState(null);
  const [range, setRange] = useState(null);
  const [items, setItems] = useState([]);
  const [log, setLog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [verdicts, setVerdicts] = useState({});   // item_id → received|missing|damaged
  const [suggested, setSuggested] = useState(null);   // 'YYYY-MM-DD'

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [prod, dates] = await Promise.all([
        influencerApi.getProduction(contractId),
        influencerApi.getProductionDateRange(contractId).catch(() => null),
      ]);
      const ev = prod.data?.production_event || null;
      setEvent(ev);
      setMode(prod.data?.production_mode || ev?.mode || null);
      setLog(prod.data?.log || []);
      // ⚠️ The endpoint answers { range: { earliest, latest, basis } }. This read dates.data,
      // which is the WRAPPER — truthy, so the card drew, with earliest and latest undefined.
      // Both shoot screens showed "Pick any day between [blank] and [blank]" and nobody could
      // book. Contract: features/shoot-plan-you-can-actually-see
      setRange(dates?.data?.range || null);

      // Only a shipment has a parcel. Asking for one on a visit would 404 nothing useful.
      if (ev && ev.mode === 'shipment') {
        const p = await influencerApi.getParcel(ev.id).catch(() => null);
        setItems(p?.data?.items || []);
        setSummary(p?.data?.summary || null);
      } else {
        setItems([]);
        setSummary(null);
      }
    } catch (e) {
      // Never invent an empty shoot on failure. A blank screen reads as "nothing to do",
      // which is the one thing a shoot screen must never say by accident.
      setErr(e?.message || 'Could not load this shoot.');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const turn = useMemo(() => turnOf(event, mode, { creatorName: 'You' }), [event, mode]);
  const mine = turn.who === 'influencer';
  const left = countersLeft(event, 'influencer');

  // Her answers, merged over whatever the server already has.
  const answered = useMemo(
    () => items.map(i => ({ ...i, receipt_status: verdicts[i.id] ?? i.receipt_status })),
    [items, verdicts]
  );
  const shortfallCount = answered.filter(
    i => !i.dropped_at && ['missing', 'damaged'].includes(i.receipt_status)
  ).length;
  const receivedCount = answered.filter(i => i.receipt_status === 'received').length;
  const allAnswered = answered.length > 0 && answered.every(i => i.receipt_status);
  // Any flag at all — including one she has only tapped and not yet sent — switches the
  // screen out of the one-tap path. "Everything arrived" must never be the fast way to
  // dismiss a problem she has already started reporting.
  const anyFlagged = shortfallCount > 0;

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      await load();
      if (ok) Alert.alert('', ok);
    } catch (e) {
      Alert.alert('That did not go through', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const accept = () => run(
    () => influencerApi.acceptProduction(event.id),
    `${shortDate(event.visit_scheduled_at)} is settled.`
  );

  const counter = (iso) => run(
    // Noon, so a calendar day cannot slide into the day before when the server reads it in UTC.
    () => influencerApi.counterProposeProduction(event.id, {
      visit_scheduled_at: new Date(`${iso}T12:00:00`).toISOString(),
    }),
    'Suggested. The brand will confirm.'
  );

  const flip = () => Alert.alert(
    'Ask to do it remotely?',
    'The brand has to agree. If they do, you shoot with what you have instead of travelling.',
    [{ text: 'Not now', style: 'cancel' },
     { text: 'Ask them', onPress: () => run(() => influencerApi.flipProductionToRemote(event.id), 'Asked. The brand decides.') }]
  );

  // Every item marked received in one call. Not a different endpoint and not a different
  // rule — the same per-item answer, filled in for her, so the server still records a
  // verdict per item and the brand still sees a reconcilable list.
  const confirmAllArrived = () => run(
    () => influencerApi.confirmProductionReceived(event.id, {
      answers: items.map(i => ({ item_id: i.id, status: 'received' })),
    }),
    'Confirmed. Over to your shoot.'
  );

  const confirmParcel = () => run(
    () => influencerApi.confirmProductionReceived(event.id, {
      answers: answered.filter(i => i.receipt_status)
        .map(i => ({ item_id: i.id, status: i.receipt_status })),
    }),
    shortfallCount
      ? 'Confirmed. We have told the brand what is missing — you do not need to.'
      : 'Confirmed. Over to your shoot.'
  );

  const markDone = () => Alert.alert(
    'Mark the shoot done?',
    'This says the shooting is finished. Your content goes in next — that is what the brand actually sees.',
    [{ text: 'Not yet', style: 'cancel' },
     { text: 'It is done', onPress: () => run(() => influencerApi.completeProduction(event.id, {}), 'Marked done.') }]
  );

  if (loading) {
    return <View style={[s.container, s.center]}><ActivityIndicator color={ig.text} /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="chevron-left" size={22} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>The shoot</Text>
          <Text style={s.sub}>
            {(brandName || 'BRAND').toUpperCase()}{mode ? ` · ${MODE_LABEL[mode]?.toUpperCase()}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={ig.text} />}
      >
        {!!err && (
          <View style={s.err}>
            <Text style={s.errT}>{err}</Text>
            <Text style={s.errS}>Pull down to try again. Nothing has been lost.</Text>
          </View>
        )}

        {!err && !event && (
          <WhyNote>
            The shoot opens once both sides have signed. Until then there is nothing to settle.
          </WhyNote>
        )}

        {!!event && (
          <>
            <TurnLine turn={turn} mine={mine} />

            {/* ── Settling when · store visit ─────────────────────────────── */}
            {mode === 'visit' && event.status === 'proposed' && (
              <>
                <WindowCard range={range} />
                <SlotCard
                  event={event}
                  theirs={event.slot_proposed_by !== 'influencer'}
                  expectedTime={event.visit_window_minutes ? `${event.visit_window_minutes} minutes` : null}
                />
                {event.slot_proposed_by !== 'influencer' && !!event.visit_scheduled_at && (
                  <Btn label={`Accept ${shortDate(event.visit_scheduled_at)}`} tone="pri" onPress={accept} disabled={busy} />
                )}
                {left > 0
                  ? (
                    <>
                      <DateField
                        label={`Suggest another time · ${left} left`}
                        value={suggested}
                        onChange={setSuggested}
                        placeholder="Pick a day that works"
                        minDate={range?.earliest ? range.earliest.slice(0, 10) : undefined}
                        maxDate={range?.latest ? range.latest.slice(0, 10) : undefined}
                      />
                      {!!suggested && (
                        <Btn label={`Suggest ${shortDate(suggested)}`} onPress={() => counter(suggested)} disabled={busy} />
                      )}
                    </>
                  )
                  : <WhyNote>
                      You have used both your suggestions. {RESCHEDULE_LIMIT_PER_SIDE} per side keeps this from
                      going round forever — talk to the brand if the day really does not work.
                    </WhyNote>}
                <Btn label="Ask to do it remotely instead" onPress={flip} disabled={busy} />
              </>
            )}

            {mode === 'visit' && event.status !== 'proposed' && (
              <SlotCard
                event={event}
                theirs={false}
                expectedTime={event.visit_window_minutes ? `${event.visit_window_minutes} minutes` : null}
              />
            )}

            {mode === 'visit' && (
              <AddressCard
                name={brandName}
                address={[event.visit_address, event.visit_city, event.visit_pincode].filter(Boolean).join(', ')}
                contact={event.visit_contact_name}
                phone={event.visit_contact_phone}
              />
            )}

            {/* ── The parcel ──────────────────────────────────────────────── */}
            {mode === 'shipment' && (
              <View style={s.card}>
                <Text style={s.cardT}>
                  {event.shipment_received_confirmed_at ? 'What arrived' : 'Your parcel'}
                </Text>
                <Text style={s.cardS}>
                  {[brandName, summary?.total ? `${summary.total} item${summary.total === 1 ? '' : 's'}` : null]
                    .filter(Boolean).join(' · ').toUpperCase()}
                </Text>
                {!!event.shipment_courier && (
                  <Text style={s.track}>
                    {event.shipment_courier}{event.shipment_awb ? ` · ${event.shipment_awb}` : ''}
                  </Text>
                )}
                <Delivered at={event.shipment_delivered_at} />

                {items.length === 0 && (
                  <WhyNote>
                    The brand has not listed what they are sending yet. You will be able to
                    confirm it item by item once they do.
                  </WhyNote>
                )}

                {items.length > 0 && !event.shipment_received_confirmed_at && (
                  <Text style={[s.cardT, { marginTop: 12 }]}>Tick what you received</Text>
                )}

                {answered.map(item => (
                  <ParcelItem
                    key={item.id}
                    item={item}
                    onVerdict={event.shipment_received_confirmed_at
                      ? null
                      : v => setVerdicts(p => ({ ...p, [item.id]: v }))}
                  />
                ))}

                {!event.shipment_received_confirmed_at && (
                  <ShortfallNote count={shortfallCount} brandName={brandName} />
                )}

                {/* M-6 — one tap for the ordinary case. Most parcels arrive complete, and
                    making her tick three chips to say "nothing went wrong" is a tax on the
                    outcome that happens nearly every time. The per-item answer stays for
                    when something DID go wrong, which is the only time it earns its taps. */}
                {items.length > 0 && !event.shipment_received_confirmed_at && !anyFlagged && (
                  <Btn
                    label="Everything arrived"
                    tone="pri"
                    onPress={confirmAllArrived}
                    disabled={busy}
                  />
                )}

                {items.length > 0 && !event.shipment_received_confirmed_at && (
                  <Btn
                    label={shortfallCount
                      ? `Confirm — ${receivedCount} of ${items.length} received`
                      : 'Confirm — everything arrived'}
                    tone="pri"
                    onPress={confirmParcel}
                    disabled={busy || !allAnswered}
                    sub={allAnswered ? null : 'Answer every item first'}
                  />
                )}
              </View>
            )}

            {/* ── Finishing ───────────────────────────────────────────────── */}
            {/* Three states, not two. She may have marked it and still be waiting for the
                brand — on a store visit both of them say it happened.
                Contract: features/shoot-starts-where-the-agreement-left-it */}
            {['confirmed', 'in_progress'].includes(event.status) && (
              waitingOnOtherSide(event, 'influencer')
                ? <WhyNote>{WAITING_ON_OTHER.influencer}</WhyNote>
                : canComplete(mode, 'influencer')
                  ? <Btn label="Mark the shoot done" tone="pri" onPress={markDone} disabled={busy} />
                  : null
            )}

            {event.status === 'completed' && (
              <WhyNote>
                {STATUS_LABEL.completed}. Your content goes in next — that is what the brand
                actually sees, and it is the real proof this happened.
              </WhyNote>
            )}

            {/* The founder's rule, and the reason it is safe: she alone closes a remote shoot,
                because the brand cannot see whether she has shot anything. */}
            {mode !== 'visit' && ['confirmed', 'in_progress'].includes(event.status) && (
              <Text style={s.foot}>
                Only you can say this is done. The brand cannot see your shoot — they see the
                content you submit next.
              </Text>
            )}

            <ShootDiary log={log} />
          </>
        )}
      </ScrollView>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  body: { padding: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderColor: ig.lineSoft, borderRadius: 12, padding: 13, marginBottom: 10 },
  cardT: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  cardS: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.5, marginTop: 3 },
  track: { fontSize: 11.5, fontWeight: '700', color: ig.text, marginTop: 7 },

  err: { backgroundColor: ig.redBg, borderRadius: 11, padding: 12, marginBottom: 12 },
  errT: { fontSize: 12, fontWeight: '800', color: ig.red },
  errS: { fontSize: 11, fontWeight: '650', color: ig.red, marginTop: 4, opacity: 0.9 },

  foot: { fontSize: 11, fontWeight: '650', color: ig.mut, lineHeight: 16, marginTop: 12, textAlign: 'center' },
});
