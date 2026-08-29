import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert,
  TouchableOpacity, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import DateField from '../../components/DateField';
import { ProductPickerModal } from '../../components/brand/ProductPicker';
import { MODE_LABEL, MODE_LINE, turnOf, canComplete, countersLeft, WHY_NOT_YOURS, shortDate, waitingOnOtherSide, WAITING_ON_OTHER } from '../../utils/shoot';
import {
  WindowCard, SlotCard, AddressCard, ParcelItem, TurnLine, Btn, WhyNote, Delivered,
} from '../../components/shoot/ShootParts';
// The shoot is the only step in the whole spine that keeps a diary — and getLog existed
// with nothing calling it, so none of it was ever visible. Same component both sides (M-8).
import ShootDiary from '../../components/shoot/ShootDiary';

/**
 * BrandShootScreen — the brand's side of one shoot.
 * Contract: features/stage-4-the-shoot (slices 3 and 5) · boards ③ ④ ⑥
 *
 * THE GAP THIS FILLS
 * Eight coordination endpoints existed and worked, and a grep of BOTH navigators for a
 * production route returned zero. The shoot lived as a panel inside the contract page. So the
 * machinery was never the missing part — the door was, on both phones.
 *
 * THE PARCEL IS THE GENUINELY NEW PART
 * Until now a shipment knew it was sent and had no idea what was inside it. A brand typed
 * "3 sarees" into a note, she confirmed a sentence, and nothing could reconcile the two against
 * what she later tagged in a post. Items are PICKED from the catalogue — the same picker as
 * allocation and offers, its fourth caller exactly as ledger #86 predicted.
 *
 * WHERE A BUTTON IS DELIBERATELY ABSENT
 * The brand cannot mark a remote or shipped shoot done. They cannot see whether she has shot
 * anything, so closing it would be asserting something they do not know. Founder, 2026-08-27.
 * The reason is written on the screen — a missing button with no explanation reads as a bug.
 */

export default function BrandShootScreen({ route, navigation }) {
  const { contractId, creatorName, campaignName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [event, setEvent] = useState(null);
  const [mode, setMode] = useState(null);
  const [range, setRange] = useState(null);
  const [items, setItems] = useState([]);
  const [log, setLog] = useState([]);
  const [picking, setPicking] = useState(false);
  const [suggested, setSuggested] = useState(null);
  const [courier, setCourier] = useState('');
  const [awb, setAwb] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [prod, dates] = await Promise.all([
        brandApi.getProduction(contractId),
        brandApi.getProductionDateRange(contractId).catch(() => null),
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
      setCourier(ev?.shipment_courier || '');
      setAwb(ev?.shipment_awb || '');

      if (ev && ev.mode === 'shipment') {
        const p = await brandApi.getParcel(ev.id).catch(() => null);
        setItems(p?.data?.items || []);
      } else {
        setItems([]);
      }
    } catch (e) {
      setErr(e?.message || 'Could not load this shoot.');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const turn = useMemo(() => turnOf(event, mode, { creatorName }), [event, mode, creatorName]);
  const mine = turn.who === 'brand';
  const left = countersLeft(event, 'brand');
  const dispatched = !!event?.shipment_dispatched_at;
  const live = items.filter(i => !i.dropped_at);
  const shortfall = items.filter(
    i => !i.dropped_at && ['missing', 'damaged'].includes(i.receipt_status)
  );

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

  const addProducts = (picked) => {
    setPicking(false);
    if (!picked?.length) return;
    run(
      () => brandApi.addParcelItems(event.id, {
        // A resend goes in as the NEXT parcel, never as an edit of the first. Overwriting the
        // original would erase the fact that something went missing at all.
        parcel_no: dispatched ? (Math.max(0, ...items.map(i => Number(i.parcel_no || 1))) + 1) : 1,
        items: picked.map(p => ({ product_id: p.id || p, quantity: 1 })),
      }),
      dispatched ? 'Added as a second parcel. Dispatch it when it goes out.' : null
    );
  };

  const dispatch = () => {
    if (!courier.trim()) {
      Alert.alert('Courier missing', 'She needs something to track. Add the courier before you dispatch.');
      return;
    }
    run(
      () => brandApi.dispatchProduction(event.id, { courier: courier.trim(), awb: awb.trim() || null }),
      `Marked dispatched. ${creatorName || 'She'} confirms it item by item when it lands.`
    );
  };

  const setSlot = (iso) => run(
    // Noon, so a calendar day cannot slide into the day before when the server reads it in UTC.
    () => brandApi.setProductionVisitDetails(contractId, {
      visit_scheduled_at: new Date(`${iso}T12:00:00`).toISOString(),
    }),
    'Suggested. She confirms or suggests another day.'
  );

  const accept = () => run(
    () => brandApi.acceptProduction(event.id),
    `${shortDate(event.visit_scheduled_at)} is settled.`
  );

  const drop = (item) => Alert.alert(
    `Drop ${item.name_at_dispatch || 'this item'}?`,
    'She shoots the rest. On a hand-picked list this also takes the product out of what she can sell.',
    [{ text: 'Keep it', style: 'cancel' },
     { text: 'Drop it', style: 'destructive',
       onPress: () => run(() => brandApi.dropParcelItem(event.id, item.id), 'Dropped. She has been told.') }]
  );

  const markDone = () => run(
    () => brandApi.completeProduction(event.id, {}),
    'Marked done. Her content comes next.'
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
            {(creatorName || 'CREATOR').toUpperCase()}{mode ? ` · ${MODE_LABEL[mode]?.toUpperCase()}` : ''}
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
            The shoot opens once both sides have signed. Until then there is nothing to arrange.
          </WhyNote>
        )}

        {!!event && (
          <>
            <TurnLine turn={turn} mine={mine} />
            {!!mode && <Text style={s.modeLine}>{MODE_LINE[mode]}</Text>}

            {/* ── Settling when · store visit ─────────────────────────────── */}
            {mode === 'visit' && (
              <>
                {event.status === 'proposed' && <WindowCard range={range} />}
                <SlotCard
                  event={event}
                  theirs={event.slot_proposed_by === 'influencer'}
                  expectedTime={event.visit_window_minutes ? `${event.visit_window_minutes} minutes` : null}
                />
                {event.status === 'proposed' && event.slot_proposed_by === 'influencer' && !!event.visit_scheduled_at && (
                  <Btn label={`Accept ${shortDate(event.visit_scheduled_at)}`} tone="pri" onPress={accept} disabled={busy} />
                )}
                {event.status === 'proposed' && left > 0 && (
                  <>
                    <DateField
                      label={event.visit_scheduled_at ? `Suggest another day · ${left} left` : 'Suggest a day'}
                      value={suggested}
                      onChange={setSuggested}
                      placeholder="Pick a day"
                      minDate={range?.earliest ? range.earliest.slice(0, 10) : undefined}
                      maxDate={range?.latest ? range.latest.slice(0, 10) : undefined}
                    />
                    {!!suggested && (
                      <Btn label={`Suggest ${shortDate(suggested)}`} onPress={() => setSlot(suggested)} disabled={busy} />
                    )}
                  </>
                )}
                {event.status === 'proposed' && left === 0 && (
                  <WhyNote>
                    You have used both your suggestions. Two per side stops this going round
                    forever — talk to her if the day really does not work.
                  </WhyNote>
                )}
                <AddressCard
                  name={campaignName}
                  address={[event.visit_address, event.visit_city, event.visit_pincode].filter(Boolean).join(', ')}
                  contact={event.visit_contact_name}
                  phone={event.visit_contact_phone}
                />
              </>
            )}

            {/* ── The parcel ──────────────────────────────────────────────── */}
            {mode === 'shipment' && (
              <View style={s.card}>
                <Text style={s.cardT}>{dispatched ? 'What you sent' : 'What you’re sending'}</Text>
                <Text style={s.cardS}>
                  TO {(creatorName || 'HER').toUpperCase()}
                  {live.length ? ` · ${live.length} ITEM${live.length === 1 ? '' : 'S'}` : ''}
                </Text>

                {items.length === 0 && (
                  <WhyNote>
                    Nothing in the box yet. Add from your catalogue — she confirms the parcel
                    item by item, so an empty box gives her nothing to confirm.
                  </WhyNote>
                )}

                {items.map(item => (
                  <ParcelItem
                    key={item.id}
                    item={item}
                    onRemove={dispatched ? null : () => run(() => brandApi.removeParcelItem(event.id, item.id))}
                    onDrop={['missing', 'damaged'].includes(item.receipt_status) ? () => drop(item) : null}
                  />
                ))}

                <TouchableOpacity style={s.add} onPress={() => setPicking(true)} activeOpacity={0.8}>
                  <Icon name="plus" size={14} color={ig.text} />
                  <Text style={s.addT}>
                    {dispatched ? 'Send a replacement' : 'Add from catalogue'}
                  </Text>
                </TouchableOpacity>

                {shortfall.length > 0 && (
                  <View style={s.shortBox}>
                    <Text style={s.shortT}>
                      {shortfall.length === 1
                        ? `${shortfall[0].name_at_dispatch} did not arrive.`
                        : `${shortfall.length} items did not arrive.`}
                    </Text>
                    <Text style={s.shortS}>
                      Send a replacement, or drop it and she shoots the rest. She is not chasing
                      it and she is not waiting on it.
                    </Text>
                  </View>
                )}

                {!dispatched && (
                  <>
                    <Text style={[s.label, { marginTop: 14 }]}>Courier</Text>
                    <TextInput
                      style={s.input} value={courier} onChangeText={setCourier}
                      placeholder="Delhivery, Bluedart…" placeholderTextColor={ig.mut}
                    />
                    <Text style={[s.label, { marginTop: 10 }]}>Tracking number</Text>
                    <TextInput
                      style={s.input} value={awb} onChangeText={setAwb}
                      placeholder="AWB" placeholderTextColor={ig.mut} autoCapitalize="characters"
                    />
                    <Btn
                      label={live.length ? `Mark dispatched · ${live.length} item${live.length === 1 ? '' : 's'}` : 'Mark dispatched'}
                      tone="pri"
                      onPress={dispatch}
                      disabled={busy || live.length === 0}
                      sub={live.length === 0 ? 'Add what you are sending first' : null}
                    />
                  </>
                )}

                {dispatched && (
                  <>
                    <Text style={s.track}>
                      {event.shipment_courier}{event.shipment_awb ? ` · ${event.shipment_awb}` : ''}
                    </Text>
                    <Delivered at={event.shipment_delivered_at} />
                  </>
                )}
              </View>
            )}

            {/* ── Finishing ───────────────────────────────────────────────── */}
            {/* Three states, not two. Contract: features/shoot-starts-where-the-agreement-left-it */}
            {['confirmed', 'in_progress'].includes(event.status) && (
              waitingOnOtherSide(event, 'brand')
                ? <WhyNote>{WAITING_ON_OTHER.brand}</WhyNote>
                : canComplete(mode, 'brand')
                  ? <Btn label="Mark the shoot done" tone="pri" onPress={markDone} disabled={busy} />
                  : <WhyNote>{WHY_NOT_YOURS}</WhyNote>
            )}

            {event.status === 'completed' && (
              <WhyNote>The shoot is done. Her content comes next — that is what you actually see.</WhyNote>
            )}

            <ShootDiary log={log} />
          </>
        )}
      </ScrollView>

      <ProductPickerModal
        visible={picking}
        onClose={() => setPicking(false)}
        multi
        title={dispatched ? 'Send a replacement' : 'What you’re sending'}
        subtitle="Picked from your catalogue, never typed — so the box, her receipt and the products she tags are the same things."
        doneLabel="Put in the box"
        onDone={addProducts}
      />
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
  modeLine: { fontSize: 11.5, fontWeight: '650', color: ig.mut, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: ig.lineSoft, borderRadius: 12, padding: 13, marginBottom: 10 },
  cardT: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  cardS: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.5, marginTop: 3, marginBottom: 4 },
  track: { fontSize: 11.5, fontWeight: '700', color: ig.text, marginTop: 10 },

  label: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13, color: ig.text, marginTop: 5 },

  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: ig.line, borderStyle: 'dashed', borderRadius: 9, paddingVertical: 11, marginTop: 10 },
  addT: { fontSize: 12, fontWeight: '800', color: ig.text },

  shortBox: { backgroundColor: ig.redBg, borderRadius: 10, padding: 11, marginTop: 10 },
  shortT: { fontSize: 12, fontWeight: '800', color: ig.red },
  shortS: { fontSize: 11, fontWeight: '650', color: ig.red, marginTop: 4, lineHeight: 16, opacity: 0.9 },

  err: { backgroundColor: ig.redBg, borderRadius: 11, padding: 12, marginBottom: 12 },
  errT: { fontSize: 12, fontWeight: '800', color: ig.red },
  errS: { fontSize: 11, fontWeight: '650', color: ig.red, marginTop: 4, opacity: 0.9 },
});
