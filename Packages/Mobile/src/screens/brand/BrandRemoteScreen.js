/**
 * Item 11 — the brand's whole side of a Remote shoot: R1, R7, R10, R13, R14, R15a, R15b.
 * Contract: features/item11-remote · rules v1.27 §11.2
 *
 * One screen, as item 10's is, because it is one thing at different moments: waiting for her
 * address, a list to pick, a parcel in flight, a difference she reported, a return to confirm,
 * and the record when it is over. Which of those it is comes from the server's `stage` and
 * `can`, never from a guess on the phone.
 *
 * THE SENTENCE THIS SCREEN MUST NEVER LET THE BRAND MISUNDERSTAND:
 * shipping is the brand's cost alone, and the money locked for her fee is never touched by it
 * (§11.2). It is on R6 at the moment of paying, and on R14 in the record.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, TextButton, EmptyState } from '../../components/settings/primitives';
// Item 12 — the door to the content step once the shoot is done.
import { C12 } from '../../components/content/copy12';
import { C14 } from '../../components/sale/copy14';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import useRouteToast from '../../hooks/useRouteToast';
import { Card7, StateBox7 } from '../../components/agreement/bits7';
import { GateCard10, StepLine10, Row10, DelayedChip10, AmberBox10, GreenBox10, WaitBox10 } from '../../components/shoot/bits10';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { AddressCard11, DispositionTag11, TrackingSteps11, TrackingCard11 } from '../../components/remote/bits11';
import { CancelBookingSheet11, ReturnToGiftSheet11, ReportSheet11, ConfirmReturnSheet11 } from '../../components/remote/sheets11';
import { C11, day10, longDay10, rupees5 } from '../../components/remote/copy11';
import { first } from '../../components/invitations/copy5';

export default function BrandRemoteScreen({ navigation, route }) {
  const { campaignId, setId, ciId } = route.params || {};
  const [sh, setSh] = useState(null);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [sheetError, setSheetError] = useState(null);
  const [giftLine, setGiftLine] = useState(null);
  const [reportKind, setReportKind] = useState('difference');
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.remote(campaignId, setId, ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    setStatus('ready');
  }, [campaignId, setId, ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const after = (r, msg) => {
    setBusy(false);
    if (!r || !r.success) { setSheetError((r && r.error && r.error.message) || COPY.saveFailed); return false; }
    setSheet(null); setSheetError(null); setSh(r.data.shoot); if (msg) show(msg); return true;
  };

  async function openLabel() {
    const r = await brandApi.remoteLabel(campaignId, setId, ciId);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); return; }
    // The phone's own browser and PDF viewer take over — the same path the Agreement PDF uses,
    // which is why item 11 needs no native module and ships over the air.
    Linking.openURL(r.data.url).catch(() => show('Could not open the label'));
  }

  const cancel = async () => { setBusy(true); after(await brandApi.remoteCancel(campaignId, setId, ciId), 'Booking cancelled.'); };
  const gift = async () => { setBusy(true); after(await brandApi.remoteGift(campaignId, setId, ciId, giftLine.id), 'She keeps it.'); };
  const report = async () => { setBusy(true); after(await brandApi.remoteReport(campaignId, setId, ciId, { kind: reportKind }), C11.brand.reported); };
  const confirmReturn = async (answers) => { setBusy(true); after(await brandApi.remoteConfirmReturn(campaignId, setId, ciId, { answers }), 'Return confirmed.'); };
  async function acknowledge() {
    setBusy(true);
    const r = await brandApi.remoteAcknowledge(campaignId, setId, ciId);
    setBusy(false);
    if (r && r.success) setSh(r.data.shoot);
  }

  if (status === 'loading') return <View style={base.screen}><Header title="Remote shoot" onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Remote shoot" onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const who = sh.creator.name;
  const { stage, can, parcel, lines, address } = sh;
  const ret = sh.return || {};
  const flagged = lines.filter((l) => l.check && l.check !== 'received');
  const returnLines = lines.filter((l) => l.disposition === 'return');

  return (
    <View style={base.screen} testID={`brand-remote-${stage}${sh.delayed ? '-delayed' : ''}`}>
      <Header title={who} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 190 }}>
        <View style={s.crumbRow}>
          <Text style={s.crumb}>{`${String(sh.campaignName || '').toUpperCase()} · ${String(sh.setName || '').toUpperCase()}`}</Text>
          {sh.delayed ? <DelayedChip10 /> : null}
        </View>

        {/* R1 — the gate card, item 10's, unchanged. Pay for Sale shows only the signature line. */}
        <GateCard10 gate={{ ...sh.gate, creatorName: who }} />
        <StepLine10 steps={sh.steps} />

        {/* R15b · Delayed — nothing moved, and the money is named so nobody has to ask. */}
        {sh.delayed ? (
          <AmberBox10 text={C11.brand.delayed(parcel ? parcel.charged : 0, who, sh.lockedFee || 0)} testID="delayed-box" />
        ) : null}

        {/* R1 · waiting for her address. The brand has nothing to do, and is told so plainly. */}
        {/* Item 14: Pay for Sale — going live is where the brand goes next. */}
        {stage === 'shot' && sh.aim === 'conversion' ? (
          <SecondaryButton label={C14.openGoingLive} onPress={() => navigation.navigate('BrandSaleLive', { campaignId, setId, ciId })} testID="open-going-live" />
        ) : null}
        {stage === 'not_sent' ? (
          <>
            <WaitBox10 text={C11.brand.waiting(who)} testID="waiting-address" />
            {sh.postingDate ? <Text style={s.para}>{`She posts on ${longDay10(sh.postingDate)}.`}</Text> : null}
          </>
        ) : null}

        {/* R5 door · her address is here; nothing is booked yet. */}
        {stage === 'sent' ? (
          <>
            <GreenBox10 text={`${first(who)} sent her address. Pick what to send.`} testID="address-here" />
            <AddressCard11 address={address} />
            {address && address.coverage && address.coverage.returnPickup === false
              ? <StateBox7 tone="move" text={C11.brand.noReturnPickup(address.pincode, who)} testID="no-return-pickup" />
              : null}
            {lines.length ? <LineList lines={lines} title={`${lines.length} picked`} /> : null}
          </>
        ) : null}

        {/* R7 · booked, and then in flight. */}
        {(stage === 'booked' || stage === 'in_transit' || stage === 'delivered' || stage === 'checked' || stage === 'shot') && parcel ? (
          <>
            {parcel.returnedToStoreAt ? (
              <AmberBox10 text={C11.brand.backToStore(parcel.lastAttemptReason)} testID="back-to-store" />
            ) : parcel.attemptFailedCount > 0 && !parcel.deliveredAt ? (
              <AmberBox10 text={C11.brand.attemptFailed(parcel.attemptFailedCount, parcel.lastAttemptReason)} testID="attempt-failed" />
            ) : stage === 'booked' ? (
              <GreenBox10 text={C11.brand.bookedOn(parcel.bookedAt, parcel.from)} testID="booked-box" />
            ) : null}

            {!parcel.returnedToStoreAt ? (
              <>
                <TrackingCard11 parcel={parcel} />
                <TrackingSteps11 parcel={parcel} cityName={address && address.city} />
              </>
            ) : null}

            <AddressCard11 address={address} />
            <LineList lines={lines} title="In the parcel" onGift={can.returnToGift ? (l) => { setGiftLine(l); setSheet('gift'); } : null} />
          </>
        ) : null}

        {/* R10 · she reported a difference. Her shoot carries on — said, not implied. */}
        {flagged.length && !sh.difference.acknowledgedAt && !sh.difference.reportedAt ? (
          <Card7 title="A difference" tone="tint" testID="difference-card">
            <Text style={s.amber}>{C11.brand.differenceTitle(who, flagged[0].checkedAt)}</Text>
            {flagged.map((l) => (
              <Text key={l.id} style={s.para} testID={`flagged-${l.id}`}>
                {`${l.name} — ${l.check === 'missing' ? 'missing' : 'damaged'}${l.checkNote ? `: ${l.checkNote}` : ''}`}
              </Text>
            ))}
            <Text style={s.hint}>{C11.brand.differenceBody}</Text>
          </Card7>
        ) : null}
        {sh.difference.reportedAt
          ? <StateBox7 tone="move" text={`${C11.brand.reported} on ${day10(sh.difference.reportedAt)}. Item 18 picks it up.`} testID="difference-reported" />
          : null}

        {/* R13 · the return is at the branch. R14 · it is confirmed. */}
        {stage === 'shot' && returnLines.length ? (
          <ReturnPanel sh={sh} who={who} ret={ret} lines={returnLines} />
        ) : null}

        {/* R14 · what it all cost. Read from the wallet's own rows, so this and the wallet agree. */}
        {sh.charges && sh.charges.rows.length ? (
          <Card7 title={C11.brand.charges} tone="plain" testID="charges">
            <Row10 label={C11.brand.chargeShipping} value={rupees5(sh.charges.charged)} testID="charge-total" />
            {sh.charges.released > 0
              ? <Row10 label={C11.brand.chargeBack} value={rupees5(sh.charges.released)} testID="charge-back" />
              : null}
            {sh.wallet && sh.wallet.dues > 0
              ? <Text style={s.amber} testID="dues">{C11.brand.owed(sh.wallet.dues)}</Text>
              : null}
          </Card7>
        ) : null}
      </ScrollView>

      <View style={s.bar} testID="brand-remote-actions">
        {/* Item 12: the shoot is done — the content step is where the brand goes next. */}
        {stage === 'shot' && sh.aim === 'engagement' ? (
          <SecondaryButton label={C12.openContentBrand} onPress={() => navigation.navigate('BrandContent', { campaignId, setId, ciId })} testID="open-content" />
        ) : null}
        {stage === 'not_sent' ? (
          <>
            <PrimaryButton label={C11.brand.pick} disabled testID="pick-disabled" />
            <Text style={s.hint}>{C11.brand.pickDisabled}</Text>
          </>
        ) : null}

        {can.pickProducts ? (
          <PrimaryButton label={lines.length ? `${C11.brand.pick} · ${C11.brand.ofTwenty(lines.length)}` : C11.brand.pick}
            icon="hanger" onPress={() => navigation.navigate('BrandRemoteProducts', { campaignId, setId, ciId })}
            testID="pick-products" />
        ) : null}

        {can.book && lines.length ? (
          <SecondaryButton label="Book the parcel" icon="truck-outline"
            onPress={() => navigation.navigate('BrandRemoteBook', { campaignId, setId, ciId })} testID="go-book" />
        ) : null}

        {can.rebook ? (
          <PrimaryButton label={C11.brand.bookAgain} icon="truck-outline"
            onPress={() => navigation.navigate('BrandRemoteBook', { campaignId, setId, ciId, rebook: true })}
            testID="book-again" />
        ) : null}

        {can.label ? (
          <SecondaryButton label={C11.brand.downloadLabel} icon="file-pdf-box" onPress={openLabel} testID="download-label" />
        ) : null}

        {can.cancel ? (
          <TextButton label={C11.brand.cancelBooking} icon="close" onPress={() => setSheet('cancel')} testID="cancel-booking" />
        ) : null}

        {can.confirmReturn ? (
          <PrimaryButton label={C11.brand.confirmReturn} icon="check" onPress={() => setSheet('confirm-return')} testID="confirm-return" />
        ) : null}

        {can.reportDifference ? (
          <TextButton label={C11.brand.report} icon="flag-outline"
            onPress={() => { setReportKind('difference'); setSheet('report'); }} testID="report-difference" />
        ) : null}
        {can.acknowledgeDifference && !sh.difference.reportedAt ? (
          <TextButton label={C11.brand.carryOn} onPress={acknowledge} testID="carry-on" />
        ) : null}
        {can.reportOverdue ? (
          <TextButton label={C11.brand.reportOverdue} icon="flag-outline"
            onPress={() => { setReportKind('overdue'); setSheet('report'); }} testID="report-overdue" />
        ) : null}
      </View>

      <CancelBookingSheet11 visible={sheet === 'cancel'}
        amount={parcel ? (parcel.charged || 0) + (parcel.returnHold || 0) : 0}
        busy={busy} serverError={sheetError} onConfirm={cancel}
        onClose={() => { setSheetError(null); setSheet(null); }} />
      <ReturnToGiftSheet11 visible={sheet === 'gift'} line={giftLine} creatorName={who}
        busy={busy} serverError={sheetError} onConfirm={gift}
        onClose={() => { setSheetError(null); setSheet(null); setGiftLine(null); }} />
      <ReportSheet11 visible={sheet === 'report'} kind={reportKind}
        busy={busy} serverError={sheetError} onConfirm={report}
        onClose={() => { setSheetError(null); setSheet(null); }} />
      <ConfirmReturnSheet11 visible={sheet === 'confirm-return'}
        lines={returnLines.filter((l) => l.check === 'received')}
        autoConfirmDueAt={ret.shipment && ret.shipment.autoConfirmDueAt}
        busy={busy} serverError={sheetError} onConfirm={confirmReturn}
        onClose={() => { setSheetError(null); setSheet(null); }} />
      {toast}
    </View>
  );
}

/** The parcel's contents, with the Return/Gift tag and — before the pickup — the way to change it. */
function LineList({ lines, title, onGift }) {
  return (
    <Card7 title={title} tone="plain" testID="line-list">
      {lines.map((l) => (
        <View key={l.id} style={s.lineRow} testID={`line-${l.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={s.lineName}>{l.name}</Text>
            {l.variantLabel ? <Text style={s.variant}>{l.variantLabel}</Text> : null}
            {l.check ? (
              <Text style={[s.variant, l.check !== 'received' && { color: T.state.declined.fg }]}>
                {l.check === 'received' ? 'Received' : l.check === 'missing' ? 'Missing' : 'Damaged'}
              </Text>
            ) : null}
          </View>
          <Text style={s.qty}>{`× ${l.quantity}`}</Text>
          <DispositionTag11 value={l.disposition} />
          {onGift && l.disposition === 'return'
            ? <TextButton label="Let her keep it" onPress={() => onGift(l)} testID={`gift-${l.id}`} />
            : null}
        </View>
      ))}
    </Card7>
  );
}

/** R13 / R14 / R15b — the return lane, which never blocks the content step or any payment. */
function ReturnPanel({ sh, who, ret, lines }) {
  if (ret.stage === 'confirmed') {
    const at = (ret.shipment && (ret.shipment.confirmedAt || ret.shipment.autoConfirmedAt)) || null;
    return (
      <>
        <GreenBox10 text={C11.brand.returnConfirmed(at)} testID="return-confirmed" />
        {ret.shipment && ret.shipment.autoConfirmedAt
          ? <Text style={s.hint} testID="auto-confirmed">It confirmed itself — nobody checked it in time.</Text>
          : null}
      </>
    );
  }
  if (ret.stage === 'delivered') {
    return (
      <Card7 title="The return arrived" tone="tint" testID="return-arrived">
        <Text style={s.amber}>{C11.brand.returnHere(sh.parcel && sh.parcel.from, ret.shipment && (ret.shipment.deliveredAt || ret.shipment.selfSentAt))}</Text>
        {ret.shipment && ret.shipment.selfSentNote
          ? <Text style={s.para} testID="self-sent-note">{`She sent it herself — ${ret.shipment.selfSentNote}`}</Text> : null}
        {ret.shipment && ret.shipment.autoConfirmDueAt
          ? <Text style={s.hint}>{C11.brand.autoConfirms(ret.shipment.autoConfirmDueAt)}</Text> : null}
      </Card7>
    );
  }
  if (ret.stage === 'in_transit' || ret.stage === 'booked') {
    return <WaitBox10 text={`${first(who)}'s return is on its way back. ${lines.length} item${lines.length === 1 ? '' : 's'}.`} testID="return-moving" />;
  }
  if (ret.stage === 'overdue') {
    return <AmberBox10 text={C11.brand.overdue(who, ret.dueDate)} testID="return-overdue" />;
  }
  return (
    <WaitBox10 text={`${lines.length} item${lines.length === 1 ? '' : 's'} come back by ${longDay10(ret.dueDate)}. ${first(who)} books the pickup — you pay for it, she doesn't.`}
      testID="return-due" />
  );
}

const s = StyleSheet.create({
  crumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6 },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20, marginBottom: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 6, textAlign: 'center' },
  amber: { fontFamily: fonts.sansBold, fontSize: 13, color: T.state.yourMove.fg, lineHeight: 19, marginBottom: 8 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  lineName: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  variant: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 1 },
  qty: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, gap: 8 },
});
