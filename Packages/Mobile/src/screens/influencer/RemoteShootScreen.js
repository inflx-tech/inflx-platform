/**
 * Item 11 — her whole side of a Remote shoot: R2, R8, R9, R11, R12, R16.
 * Contract: features/item11-remote · rules v1.27 §11.2
 *
 * ONE SCREEN, because it is one thing at different moments — waiting to send her address, a
 * parcel on the way, a box to check, a shoot to mark, items to send back. Which of those it is
 * comes from the server's `stage` and `can`, never from a guess on the phone. Item 10's screen
 * is built the same way and for the same reason.
 *
 * TWO SENTENCES THIS SCREEN NEVER STOPS SAYING:
 *   · something missing or damaged does NOT stop her shoot (§26);
 *   · the return costs her nothing (§11.2).
 * Both are on the screen at the moment they matter, not buried in a help page.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, TextButton, EmptyState } from '../../components/settings/primitives';
// Item 12 — the door to the content step once the shoot is done.
import { C12 } from '../../components/content/copy12';
import { C14 } from '../../components/sale/copy14';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import useRouteToast from '../../hooks/useRouteToast';
import { Card7, StateBox7 } from '../../components/agreement/bits7';
import { GateCard10, StepLine10, DelayedChip10, AmberBox10, GreenBox10, WaitBox10 } from '../../components/shoot/bits10';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import {
  DispositionTag11, TrackingSteps11, TrackingCard11, ThreeWayCheck11,
} from '../../components/remote/bits11';
import { C11, day10, longDay10, todayIst10, rupees5 } from '../../components/remote/copy11';
import { PickupDaySheet11, SelfSentSheet11, ShootDoneSheet11 } from '../../components/remote/sheets11';

export default function RemoteShootScreen({ navigation, route }) {
  const { ciId } = route.params || {};
  const [sh, setSh] = useState(null);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [sheetError, setSheetError] = useState(null);
  const [answers, setAnswers] = useState({});      // lineId → { status, note }
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.myRemote(ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    setStatus('ready');
  }, [ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const after = (r, msg) => {
    setBusy(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); load(); return false; }
    setSh(r.data.shoot); if (msg) show(msg); return true;
  };

  async function saveCheck() {
    const list = Object.entries(answers).map(([lineId, a]) => ({ lineId, status: a.status, note: a.note || null }));
    if (!list.length) return;
    setBusy(true);
    if (after(await influencerApi.myRemoteCheck(ciId, { answers: list }))) setAnswers({});
  }

  async function markDone() {
    setBusy(true);
    if (after(await influencerApi.myRemoteDone(ciId))) setSheet(null);
  }

  async function bookReturn(pickupDay) {
    setBusy(true); setSheetError(null);
    const r = await influencerApi.myRemoteBookReturn(ciId, { pickupDay });
    setBusy(false);
    if (!r || !r.success) { setSheetError((r && r.error && r.error.message) || COPY.saveFailed); return; }
    setSheet(null); setSh(r.data.shoot); show(C11.creator.pickupBooked(pickupDay));
  }

  async function markSelfSent(note) {
    setBusy(true); setSheetError(null);
    const r = await influencerApi.myRemoteSelfSent(ciId, { note });
    setBusy(false);
    if (!r || !r.success) { setSheetError((r && r.error && r.error.message) || COPY.saveFailed); return; }
    setSheet(null); setSh(r.data.shoot); show('Thanks — they’ll confirm when it arrives.');
  }

  if (status === 'loading') return <View style={base.screen}><Header title="Your products" onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Your products" onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const brand = sh.brand.name;
  const { stage, can, parcel, lines, address } = sh;
  const ret = sh.return || {};
  const unchecked = lines.filter((l) => !l.check);
  const paid = sh.gate && sh.gate.money ? sh.gate.money.released : 0;

  return (
    <View style={base.screen} testID={`remote-${stage}${sh.delayed ? '-delayed' : ''}`}>
      <Header title="Your products" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 190 }}>
        <View style={s.crumbRow}>
          <Text style={s.crumb}>{`${String(brand).toUpperCase()} · ${String(sh.setName || '').toUpperCase()}`}</Text>
          {sh.delayed ? <DelayedChip10 /> : null}
        </View>

        {/* The gate card, item 10's, unchanged — R1/R2 draw it whether it is open or not. */}
        {!sh.gate.open ? <GateCard10 gate={{ ...sh.gate, creatorName: sh.creator.name }} /> : null}

        {/* R16 · Delayed. Nothing moved and nothing is lost — said in her money, not in rules. */}
        {sh.delayed ? <AmberBox10 text={C11.creator.delayed(paid)} testID="delayed-box" /> : null}

        {/* ── R2 · she moves first ─────────────────────────────────────────── */}
        {stage === 'not_sent' ? (
          <>
            <EmptyState title={C11.creator.cardTitle}
              body={`${brand} need somewhere to send your products. It takes a minute, and only they see it.`} />
            <StepLine10 steps={sh.steps} />
          </>
        ) : null}

        {/* ── R16 · sent, nothing shipped yet ──────────────────────────────── */}
        {stage === 'sent' ? (
          <>
            <WaitBox10 text={C11.creator.notSentYet(brand)} testID="waiting-brand" />
            <LockedAddress address={address} />
            <StepLine10 steps={sh.steps} />
          </>
        ) : null}

        {/* ── R8 · on the way ──────────────────────────────────────────────── */}
        {(stage === 'booked' || stage === 'in_transit') ? (
          <>
            {parcel && parcel.returnedToStoreAt ? (
              <>
                <AmberBox10 text={C11.creator.backToStore(brand)} testID="back-to-store" />
                {can.correctAddress ? (
                  <>
                    <Text style={s.para}>{C11.creator.correctOnce}</Text>
                    <SecondaryButton label={C11.creator.correctAddress}
                      onPress={() => navigation.navigate('RemoteAddress', { ciId, correcting: true })}
                      testID="correct-address" />
                  </>
                ) : null}
              </>
            ) : (
              <>
                {parcel && parcel.attemptFailedCount > 0 && !parcel.deliveredAt
                  ? <AmberBox10 text={C11.creator.attemptFailed} testID="attempt-failed" /> : null}
                <TrackingCard11 parcel={parcel} />
                <TrackingSteps11 parcel={parcel} cityName={address && address.city} />
              </>
            )}
            <WhatsComing lines={lines} brand={brand} />
            <StepLine10 steps={sh.steps} />
          </>
        ) : null}

        {/* ── R9 · checking ────────────────────────────────────────────────── */}
        {stage === 'delivered' ? (
          <>
            <GreenBox10 text={`Your parcel arrived ${day10(parcel && parcel.deliveredAt)}.`} testID="arrived-box" />
            <Text style={s.para} testID="check-hint">{C11.creator.checkHint(brand)}</Text>
            {lines.map((l) => (
              <Card7 key={l.id} title={l.name} tone="plain" testID={`check-${l.id}`}>
                <View style={s.lineHead}>
                  {l.variantLabel ? <Text style={s.variant}>{l.variantLabel}</Text> : null}
                  <Text style={s.qty}>{`× ${l.quantity}`}</Text>
                  <DispositionTag11 value={l.disposition} />
                </View>
                {l.check ? (
                  <Text style={s.answered} testID={`answered-${l.id}`}>
                    {l.check === 'received' ? C11.creator.received : l.check === 'missing' ? C11.creator.missing : C11.creator.damaged}
                    {l.checkNote ? ` — ${l.checkNote}` : ''}
                  </Text>
                ) : (
                  <ThreeWayCheck11
                    value={(answers[l.id] || {}).status || null}
                    note={(answers[l.id] || {}).note || ''}
                    onChange={(v) => setAnswers((a) => ({ ...a, [l.id]: { ...(a[l.id] || {}), status: v } }))}
                    onNote={(v) => setAnswers((a) => ({ ...a, [l.id]: { ...(a[l.id] || {}), note: v } }))}
                    disabled={busy}
                    testID={`check-control-${l.id}`}
                  />
                )}
              </Card7>
            ))}
          </>
        ) : null}

        {/* ── R11 · checked, not shot ──────────────────────────────────────── */}
        {stage === 'checked' ? (
          <>
            <GreenBox10 text={C11.creator.checkedOn(lines.map((l) => l.checkedAt).filter(Boolean).sort().pop())} testID="checked-box" />
            <WhatsComing lines={lines} brand={brand} arrived />
            <StepLine10 steps={sh.steps} />
          </>
        ) : null}

        {/* ── R11/R12/R16 · shot; then the return, which is its own lane ───── */}
        {stage === 'shot' ? (
          <>
            <GreenBox10 text="Shoot done. Your content step is open." testID="shot-box" />
            {ret.stage === 'none' ? (
              <Text style={s.para} testID="nothing-back">{C11.creator.keepIt(brand)}</Text>
            ) : ret.canPickup === false ? (
              <ReturnSelfSend sh={sh} brand={brand} />
            ) : (
              <ReturnLane ret={ret} brand={brand} />
            )}
            <StepLine10 steps={sh.steps} />
          </>
        ) : null}
      </ScrollView>

      {/* ── the one action, at the bottom, whatever it is ─────────────────── */}
      <View style={s.bar} testID="remote-actions">
        {/* Item 12: the shoot is done — her content step is open. The return keeps its own main
            button when it has one (its own lane), so the content door steps aside then. */}
        {stage === 'shot' && sh.aim === 'engagement' ? (
          can.bookReturn || can.markSelfSent
            ? <SecondaryButton label={C12.openContentHers} onPress={() => navigation.navigate('Content', { ciId })} testID="open-content" />
            : <PrimaryButton label={C12.openContentHers} onPress={() => navigation.navigate('Content', { ciId })} testID="open-content" />
        ) : null}
        {/* Item 14 (S1): Pay for Sale — the shoot is done; going live is next (the return keeps its own lane). */}
        {stage === 'shot' && sh.aim === 'conversion' ? (
          can.bookReturn || can.markSelfSent
            ? <SecondaryButton label={C14.goLive} onPress={() => navigation.navigate('SaleLive', { ciId })} testID="go-live" />
            : <PrimaryButton label={C14.goLive} onPress={() => navigation.navigate('SaleLive', { ciId })} testID="go-live" />
        ) : null}
        {can.sendAddress ? (
          <PrimaryButton label={C11.creator.cardTitle} icon="map-marker-outline"
            onPress={() => navigation.navigate('RemoteAddress', { ciId })} testID="send-address" />
        ) : null}

        {stage === 'delivered' ? (
          <PrimaryButton label={C11.creator.save} icon="check"
            disabled={Object.keys(answers).length !== unchecked.length || !unchecked.length}
            onPress={saveCheck} busy={busy} testID="save-check" />
        ) : null}

        {can.markDone ? (
          <PrimaryButton label={C11.creator.finished} icon="camera-outline"
            onPress={() => setSheet('done')} busy={busy} testID="mark-done" />
        ) : null}

        {can.bookReturn ? (
          <PrimaryButton label={C11.creator.sendBack} icon="package-variant"
            onPress={() => setSheet('pickup')} testID="book-return" />
        ) : null}

        {can.markSelfSent ? (
          <PrimaryButton label={C11.creator.selfSent} icon="check"
            onPress={() => setSheet('selfsent')} testID="self-sent" />
        ) : null}
      </View>

      <ShootDoneSheet11 visible={sheet === 'done'} brandName={brand} count={ret.count || 0} dueDate={ret.dueDate}
        busy={busy} onConfirm={markDone} onClose={() => setSheet(null)} />
      <PickupDaySheet11 visible={sheet === 'pickup'} address={address} brandName={brand} today={todayIst10()}
        busy={busy} serverError={sheetError} onBook={bookReturn}
        onClose={() => { setSheetError(null); setSheet(null); }} />
      <SelfSentSheet11 visible={sheet === 'selfsent'} brandName={brand} pincode={address && address.pincode}
        busy={busy} serverError={sheetError} onSend={markSelfSent}
        onClose={() => { setSheetError(null); setSheet(null); }} />
      {toast}
    </View>
  );
}

/** Her locked address, as she sent it. */
function LockedAddress({ address }) {
  if (!address) return null;
  return (
    <Card7 title="Where it's going" tone="tint" testID="her-address">
      <Text style={s.para}>{address.street}</Text>
      <Text style={s.para}>{[address.city, address.state, address.pincode].filter(Boolean).join(', ')}</Text>
    </Card7>
  );
}

/** R8 — "What's coming", with the Return/Gift tags and the sentence that explains them. */
function WhatsComing({ lines, brand, arrived }) {
  return (
    <Card7 title={arrived ? 'What arrived' : C11.creator.whatsComing} tone="plain" testID="whats-coming">
      {lines.map((l) => (
        <View key={l.id} style={s.lineRow} testID={`coming-${l.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={s.lineName}>{l.name}</Text>
            {l.variantLabel ? <Text style={s.variant}>{l.variantLabel}</Text> : null}
          </View>
          <Text style={s.qty}>{`× ${l.quantity}`}</Text>
          <DispositionTag11 value={l.disposition} />
        </View>
      ))}
      <Text style={s.hint}>{C11.creator.giftsYours(brand)}</Text>
    </Card7>
  );
}

/** R12/R16 — the return, once the shoot is done. It never blocks anything. */
function ReturnLane({ ret, brand }) {
  if (ret.stage === 'confirmed') {
    return <GreenBox10 text={`${brand} confirmed the items you sent back. That's everything.`} testID="return-confirmed" />;
  }
  if (ret.stage === 'delivered' || ret.stage === 'in_transit') {
    return <WaitBox10 text={`The items are on their way back to ${brand}. Nothing more for you to do.`} testID="return-moving" />;
  }
  if (ret.stage === 'booked') {
    return <GreenBox10 text={C11.creator.pickupBooked(ret.shipment && ret.shipment.pickupDay)} testID="return-booked" />;
  }
  if (ret.stage === 'overdue') {
    return <AmberBox10 text={C11.creator.overdue(ret.dueDate)} testID="return-overdue" />;
  }
  return (
    <Card7 title={C11.creator.sendBack} tone="tint" testID="return-due">
      <Text style={s.para}>{C11.creator.returnCard(ret.count, ret.dueDate)}</Text>
      <Text style={s.hint}>{C11.creator.payNothing(brand)}</Text>
    </Card7>
  );
}

/** Approval Q1 — couriers will not collect from her pincode, so she posts it back herself. */
function ReturnSelfSend({ sh, brand }) {
  const ret = sh.return || {};
  const sent = ret.shipment && ret.shipment.selfSentAt;
  if (ret.stage === 'confirmed') {
    return <GreenBox10 text={`${brand} confirmed the items. That's everything.`} testID="self-confirmed" />;
  }
  if (sent) return <WaitBox10 text={C11.creator.selfSentDone(ret.shipment.selfSentAt)} testID="self-sent-done" />;
  return (
    <Card7 title={C11.creator.sendBack} tone="tint" testID="self-send">
      <Text style={s.para}>{C11.creator.selfSendTitle(sh.address && sh.address.pincode, brand)}</Text>
      <Text style={s.hint}>{C11.creator.returnCard(ret.count, ret.dueDate)}</Text>
      {ret.overdue ? <Text style={[s.hint, { color: T.state.yourMove.fg }]}>{C11.creator.overdue(ret.dueDate)}</Text> : null}
    </Card7>
  );
}

const s = StyleSheet.create({
  crumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6 },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20, marginBottom: 10 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 6 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  lineName: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  variant: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3 },
  qty: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  answered: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, gap: 8 },
});
