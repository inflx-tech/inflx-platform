/**
 * Item 10 — the brand's store visit (V10, V11, V13, V14, and the states between).
 * Contract: features/item10-store-visit · rules v1.24 §11.1
 *
 * One screen carries the brand's whole side of the shoot after the plan exists, because it is one
 * thing at different moments: waiting for her answer on the time, the agreed time, the time that
 * passed, her mark waiting for confirmation, and the record once it is done. Which of those it is
 * comes from the server's `stage` and `can`, never from a guess on the phone. Nothing here moves
 * money, and the screen says so where it matters.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, TextButton } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { Card7, StateBox7 } from '../../components/agreement/bits7';
import { GateCard10, StepLine10, TimeCard10, Row10, DelayedChip10, AmberBox10, GreenBox10, MoveBox10, WaitBox10 } from '../../components/shoot/bits10';
import { MoveTimeSheet10 } from '../../components/shoot/sheets10';
import { C10, MSG10, whenShort10, day10, stamp10, AIM_LABEL10, MODE_LABEL10 } from '../../components/shoot/copy10';
import { first } from '../../components/invitations/copy5';
import { C12 } from '../../components/content/copy12';

export default function BrandShootScreen({ navigation, route }) {
  const { campaignId, setId, ciId } = route.params || {};
  const [sh, setSh] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState(null);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.getShoot(campaignId, setId, ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    setStatus('ready');
  }, [campaignId, setId, ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function confirm() {
    setBusy(true);
    const r = await brandApi.confirmShoot(campaignId, setId, ciId);
    setBusy(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); load(); return; }
    setSh(r.data.shoot);
    show(C10.brand.confirmed);
  }

  async function move(body) {
    setBusy(true); setSheetError(null);
    const r = await brandApi.moveShoot(campaignId, setId, ciId, body);
    setBusy(false);
    if (!r || !r.success) { setSheetError((r && r.error && r.error.message) || COPY.saveFailed); return; }
    setSheet(null);
    setSh(r.data.shoot);
    show(C10.brand.moved);
  }

  const title = sh ? sh.creator.name : '';
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const name = sh.creator.name;
  const plan = sh.plan || {};
  const neg = (sh.thread && sh.thread.negotiation) || {};
  const myMove = !!(neg.open && neg.whoseMove === 'brand');
  const stage = sh.stage;
  const gateOpen = sh.gate && sh.gate.open;

  return (
    <View style={base.screen} testID={`brand-shoot-${stage}${sh.delayed ? '-delayed' : ''}`}>
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 150 }}>
        <View style={s.crumbRow}>
          <Text style={s.crumb}>{`${String(sh.campaignName || '').toUpperCase()} · ${String(sh.setName || '').toUpperCase()}`}</Text>
          {sh.delayed ? <DelayedChip10 /> : null}
        </View>
        {/* V1: the aim and mode on the left, the Active chip on the right. */}
        <View style={s.aimRow}>
          <Text style={s.aimLine}>{`${AIM_LABEL10[sh.aim] || sh.aim} · ${MODE_LABEL10[sh.mode] || ''}`}</Text>
          {!sh.delayed ? (
            <View style={[s.chip, { backgroundColor: T.state.active.bg }]} testID="active-chip">
              <Text style={[s.chipText, { color: T.state.active.fg }]}>{C10.activeChip}</Text>
            </View>
          ) : null}
        </View>

        {/* The gate, when it is not open — the sentence the server refuses with. */}
        {!gateOpen ? <StateBox7 tone="wait" text={sh.gate.reason === 'NOT_SIGNED' ? MSG10.NOT_SIGNED : MSG10.NOT_FUNDED} testID="gate-closed" /> : null}

        {/* V14 — Delayed: flagged and explained, not frozen. */}
        {sh.delayed ? (
          <>
            <AmberBox10 text={C10.brand.delayedTitle(sh.postingDate)} testID="delayed-box" />
            <Card7 title={C10.brand.whereItStopped} testID="where-it-stopped">
              <Row10 label={C10.brand.stage} value={sh.delayed.stageLabel} />
              <Row10 label={C10.brand.agreedTime} value={plan.visitAt ? whenShort10(plan.visitAt) : '—'} />
              <Row10 label={C10.brand.delayedSince} value={day10(sh.delayed.at)} />
            </Card7>
            <Text style={s.para} testID="delayed-money">
              {sh.gate.money && sh.gate.money.required ? C10.brand.delayedMoney(sh.gate.money.locked - sh.gate.money.released, sh.gate.money.released, name) : C10.brand.delayedMoneySale}
            </Text>
          </>
        ) : null}

        {/* not_sent — the gate as ticks, the step line, the countdown (V1's body, reached from the agreement too). */}
        {stage === 'not_sent' ? (
          <>
            <GateCard10 gate={{ ...sh.gate, creatorName: name }} />
            <StepLine10 steps={sh.steps} />
            {sh.postingDate ? <Text style={s.countdown} testID="countdown">{C10.countdown(sh.postingDate, sh.daysToPosting)}</Text> : null}
            {sh.legacyNoPostingDate ? <Text style={s.para} testID="legacy">{C10.brand.legacy}</Text> : null}
          </>
        ) : null}

        {/* sent — her answer is outstanding, or she asked for another time. */}
        {stage === 'sent' ? (
          <>
            {myMove
              ? <MoveBox10 text={sh.thread.turns && sh.thread.turns.some(t => t.kind === 'accept') ? C10.thread.yourMoveMoved(name) : C10.thread.yourMoveAsked(name)} testID="your-move" />
              : <WaitBox10 text={C10.brand.waitingOnHer(name)} testID="waiting" />}
            <TimeCard10 iso={plan.visitAt} sub={plan.durationText ? C10.hers.about(plan.durationText) : null} live />
            <Card7 title={C10.brand.theVisit} testID="plan-card">
              <Row10 label={C10.brand.rows.branch} value={plan.branch && plan.branch.name} />
              <Row10 label={C10.thread.rows.askFor} value={plan.contact && plan.contact.name} />
            </Card7>
          </>
        ) : null}

        {/* agreed — the live time card; or V13 when it passed. */}
        {stage === 'agreed' ? (
          sh.passed ? (
            <>
              <AmberBox10 text={C10.brand.passedTitle(plan.visitAt)} testID="passed-box" />
              <TimeCard10 iso={plan.visitAt} sub={C10.hers.passed} live={false} />
              <Text style={s.para} testID="passed-body">{C10.brand.passedBody(name, sh.daysToPosting)}</Text>
            </>
          ) : (
            <>
              <GreenBox10 text={C10.brand.timeAgreed(plan.agreedAt, plan.visitAt)} testID="agreed-box" />
              <TimeCard10 iso={plan.visitAt} sub={plan.durationText ? C10.hers.about(plan.durationText) : null} live />
              <Card7 title={C10.brand.theVisit} testID="plan-card">
                <Row10 label={C10.brand.rows.branch} value={plan.branch && plan.branch.name} />
                <Row10 label={C10.thread.rows.askFor} value={plan.contact && plan.contact.name} />
              </Card7>
              {/* Walk fix: the brand's screen never said the confirm step was coming. */}
              <Text style={s.para} testID="what-happens-next">{C10.brand.whatHappensNext(name)}</Text>
              {sh.postingDate ? <Text style={s.countdown} testID="countdown">{C10.countdown(sh.postingDate, sh.daysToPosting)}</Text> : null}
            </>
          )
        ) : null}

        {/* V10 — attended: one tap, the deadline stated, a new time as the quiet alternative. */}
        {stage === 'attended' ? (
          <>
            <MoveBox10 text={C10.brand.yourMoveVisited(name, plan.attendedAt)} testID="she-visited" />
            <TimeCard10 iso={plan.visitAt} sub={[plan.branch && plan.branch.name, plan.contact && plan.contact.name].filter(Boolean).join(' · ')} live />
            <Text style={s.para} testID="confirm-opens">{C10.brand.confirmOpens(plan.autoConfirmDueAt)}</Text>
          </>
        ) : null}

        {/* V11 — done: two timestamps, the step line advanced, the countdown. */}
        {stage === 'complete' ? (
          <>
            <GreenBox10 text={C10.brand.done(plan.confirmedAt || plan.autoConfirmedAt, name)} testID="done-box" />
            <StepLine10 steps={sh.steps} />
            <Card7 title={C10.brand.theVisit} testID="record-card">
              <Row10 label={C10.brand.rows.branch} value={plan.branch && plan.branch.name} />
              <Row10 label={C10.brand.rows.when} value={whenShort10(plan.visitAt)} />
              <Row10 label={C10.brand.rows.sheMarked} value={stamp10(plan.attendedAt)} />
              {plan.autoConfirmedAt
                ? <Row10 label={C10.brand.rows.confirmedItself} value={stamp10(plan.autoConfirmedAt)} />
                : <Row10 label={C10.brand.rows.youConfirmed} value={stamp10(plan.confirmedAt)} />}
            </Card7>
            {sh.postingDate ? <Text style={s.countdown} testID="countdown">{C10.countdown(sh.postingDate, sh.daysToPosting)}</Text> : null}
          </>
        ) : null}
      </ScrollView>

      {/* One main button at a time — the one the stage actually offers. */}
      <View style={s.bar} testID="brand-shoot-actions">
        {/* Item 12: the visit is done — the content step is where the brand goes next. */}
        {stage === 'complete' && sh.aim === 'engagement' ? (
          <PrimaryButton label={C12.openContentBrand} onPress={() => navigation.navigate('BrandContent', { campaignId, setId, ciId })} testID="open-content" />
        ) : null}
        {stage === 'not_sent' && sh.can.send ? (
          <PrimaryButton label={C10.planTheVisit} onPress={() => navigation.navigate('BrandShootPlan', { campaignId, setId, ciId })} testID="plan-the-visit" />
        ) : null}
        {stage === 'sent' ? (
          <PrimaryButton label={C10.brand.openConversation} onPress={() => navigation.navigate('BrandShootThread', { campaignId, setId, ciId })} testID="open-thread" />
        ) : null}
        {stage === 'agreed' && sh.can.move ? (
          sh.passed
            ? <>
                <PrimaryButton label={C10.brand.sendNewTime} icon="calendar-blank-outline" onPress={() => setSheet('move')} testID="send-new-time" />
                {/* V13 (founder, 20 Sep): when the time has come and gone the brand may ring her.
                    The server sends her number for this screen alone, and only once it has passed. */}
                {sh.creatorPhone ? (
                  <TextButton label={C10.brand.call(name)} icon="phone-outline"
                    onPress={() => Linking.openURL(`tel:${sh.creatorPhone}`).catch(() => {})} testID="call-creator" />
                ) : null}
              </>
            : <SecondaryButton label={C10.brand.moveTitle.replace('?', '')} icon="undo-variant" onPress={() => setSheet('move')} testID="move-visit" />
        ) : null}
        {stage === 'attended' ? (
          <>
            <PrimaryButton label={C10.brand.confirmDone} icon="check" onPress={confirm} busy={busy} busyLabel="Confirming" testID="confirm-shoot" />
            {sh.can.move ? <TextButton label={C10.brand.sheDidntCome} icon="undo-variant" onPress={() => setSheet('move')} testID="she-didnt-come" /> : null}
          </>
        ) : null}
      </View>

      <MoveTimeSheet10 visible={sheet === 'move'} side="brand" otherName={name} currentAt={plan.visitAt} postingDate={sh.postingDate}
        busy={busy} serverError={sheetError} onSend={move} onClose={() => { setSheetError(null); setSheet(null); }} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  crumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6 },
  aimRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  aimLine: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11 },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20, marginBottom: 12 },
  countdown: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginTop: 2, marginBottom: 12 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, gap: 8 },
});
