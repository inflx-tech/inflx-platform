/**
 * Item 10 — her store visit (V5, V8, V9, V15).
 * Contract: features/item10-store-visit · rules v1.24 §11.1
 *
 * What she was sent: the time, the address with Maps and call, the walk-in notes. Two buttons,
 * because the only thing she can change is the time. On the day the card becomes a thing to act
 * on — "I've been to the store" is hers to tap, so a brand that forgets can never leave her
 * stranded. And the sentence that stops her worrying: nothing about her payment depends on this.
 *
 * ui-walk-fixes (board C, rule 1): the buttons sit in a strip IN the column, under the page
 * (BottomBar) — never floating over it. A stage with nothing to press has no strip at all.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, TextButton, EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { Card7 } from '../../components/agreement/bits7';
import { StepLine10, TimeCard10, AddressCard10, AmberBox10, GreenBox10, DelayedChip10, WaitBox10, MoveBox10 } from '../../components/shoot/bits10';
import { MoveTimeSheet10 } from '../../components/shoot/sheets10';
import { C10, MSG10, whenShort10, day10 } from '../../components/shoot/copy10';
import { C12 } from '../../components/content/copy12';
import { C14 } from '../../components/sale/copy14';

export default function ShootScreen({ navigation, route }) {
  const { ciId } = route.params || {};
  const [sh, setSh] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState(null);
  // Board C: the toast is drawn in the box above the button strip, just above it.
  const { toast, show } = useToast({ inFlow: true });
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.myShoot(ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    setStatus('ready');
  }, [ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function act(call, done) {
    setBusy(true);
    const r = await call();
    setBusy(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); load(); return; }
    setSh(r.data.shoot);
    if (done) show(done);
  }
  const acceptPlan = () => act(() => influencerApi.acceptMyShootTime(ciId), C10.thread.agreed);
  const acceptCounter = () => act(() => influencerApi.acceptMyShootCounter(ciId), C10.thread.agreed);
  const attended = () => act(() => influencerApi.markAttended(ciId));
  async function move(body) {
    setBusy(true); setSheetError(null);
    const r = await influencerApi.moveMyShoot(ciId, body);
    setBusy(false);
    if (!r || !r.success) { setSheetError((r && r.error && r.error.message) || COPY.saveFailed); return; }
    setSheet(null); setSh(r.data.shoot); show(C10.counter.sent);
  }

  if (status === 'loading') return <View style={base.screen}><Header title={C10.hers.title} onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C10.hers.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const brand = sh.brand.name;
  const plan = sh.plan || {};
  const thread = sh.thread || null;
  const neg = (thread && thread.negotiation) || {};
  const myMove = !!(neg.open && neg.whoseMove === 'influencer');
  const theirsWaiting = !!(neg.open && neg.whoseMove === 'brand');
  const lastTurn = thread && thread.turns && thread.turns[0];
  const moved = !!(thread && thread.turns && thread.turns.some((t) => t.kind === 'accept'));
  const stage = sh.stage;
  const about = plan.durationText ? C10.hers.about(plan.durationText) : null;
  const paid = sh.gate && sh.gate.money ? sh.gate.money.released : 0;
  const stepsHers = (sh.steps || []).map((st) => st.key === 'shoot'
    ? { ...st, label: C10.hers.stepsHers.visit, detail: stage === 'complete' ? day10(plan.visitAt) : st.detail }
    : st.key === 'content' ? { ...st, detail: stage === 'complete' ? null : C10.hers.stepsHers.onceTheyConfirm } : st);

  return (
    <View style={base.screen} testID={`shoot-${stage}${sh.delayed ? '-delayed' : ''}`}>
      <Header title={C10.hers.title} onBack={() => navigation.goBack()} />
      <FormArea>
      <ScrollView style={s.page} contentContainerStyle={{ padding: 18 }} testID="shoot-scroll">
        <View style={s.crumbRow}>
          <Text style={s.crumb}>{`${String(brand).toUpperCase()} · ${String(sh.setName || '').toUpperCase()}`}</Text>
          {sh.delayed ? <DelayedChip10 /> : null}
        </View>

        {/* V15 — Delayed: what happened, whose move, what it means for her money. */}
        {sh.delayed ? <AmberBox10 text={C10.hers.delayed(sh.postingDate, brand, paid)} testID="delayed-box" /> : null}

        {/* V15 — nothing planned yet. */}
        {stage === 'not_sent' ? <EmptyState title={C10.hers.notYetTitle} body={C10.hers.notYetBody(brand)} /> : null}

        {/* V5 — what she was sent; or the brand's counter / move on the same plan. */}
        {stage === 'sent' ? (
          <>
            {myMove && lastTurn && lastTurn.by === 'brand'
              ? <MoveBox10 text={moved ? C10.hers.theyMoved(brand, lastTurn.terms && lastTurn.terms.visitAt, lastTurn.note) : C10.hers.theyCountered(brand, lastTurn.terms && lastTurn.terms.visitAt, lastTurn.note)} testID="they-asked" />
              : theirsWaiting ? <WaitBox10 text={C10.hers.waitingForThem(brand)} testID="waiting-them" /> : null}
            <TimeCard10 iso={(myMove && thread.current && thread.current.visitAt) || plan.visitAt} sub={about} live />
            <AddressCard10 branch={plan.branch} contact={plan.contact} />
            {plan.notes ? <Card7 title={C10.hers.beforeYouGo} tone="tint" testID="before-you-go"><Text style={s.para}>{plan.notes}</Text></Card7> : null}
            {sh.postingDate ? <Text style={s.para} testID="posting-line">{C10.hers.postingLine(sh.postingDate)}</Text> : null}
          </>
        ) : null}

        {/* V8 — agreed: on the day the card becomes a thing to act on. */}
        {stage === 'agreed' ? (
          <>
            {sh.passed ? <AmberBox10 text={C10.hers.timePassedHers(brand)} testID="passed-hers" /> : <GreenBox10 text={C10.hers.timeAgreedOn(plan.agreedAt)} testID="agreed-box" />}
            <TimeCard10 iso={plan.visitAt} sub={plan.isToday ? [C10.hers.today, about && about.toLowerCase()].filter(Boolean).join(' · ') : about} live={!sh.passed} />
            <AddressCard10 branch={plan.branch} contact={plan.contact} />
            {plan.notes ? <Card7 title={C10.hers.beforeYouGo} tone="tint" testID="before-you-go"><Text style={s.para}>{plan.notes}</Text></Card7> : null}
            {/* Founder, 1 Oct: she may mark the visit from the moment the time is agreed (Q9 retired). */}
            {sh.can.markAttended ? <Text style={s.para} testID="been-hint">{C10.hers.beenHint(brand)}</Text> : null}
          </>
        ) : null}

        {/* V9 — marked, waiting: her next step opens on the brand's confirmation, nothing else. */}
        {stage === 'attended' ? (
          <>
            <WaitBox10 text={C10.hers.markedWaiting(plan.attendedAt, brand)} testID="marked-box" />
            <TimeCard10 iso={plan.visitAt} sub={C10.hers.visited} live={false} />
            <Text style={s.para} testID="waits-for-confirm">{C10.hers.waitsForConfirm(brand)}</Text>
            <StepLine10 steps={stepsHers} />
          </>
        ) : null}

        {/* V15 — done: the brand confirmed. */}
        {stage === 'complete' ? (
          <>
            <GreenBox10 text={C10.hers.confirmed(brand, plan.confirmedAt)} testID="done-box" />
            <TimeCard10 iso={plan.visitAt} sub={C10.hers.visited} live={false} />
            <StepLine10 steps={stepsHers} />
          </>
        ) : null}
      </ScrollView>
      {toast}
      </FormArea>

      <BottomBar testID="shoot-actions">
        {/* Item 12: the visit is done — her content step is open. */}
        {stage === 'complete' && sh.aim === 'engagement' ? (
          <PrimaryButton label={C12.openContentHers} onPress={() => navigation.navigate('Content', { ciId })} testID="open-content" />
        ) : null}
        {/* Item 14 (S1): Pay for Sale — the visit is done; going live is next. */}
        {stage === 'complete' && (sh.aim === 'conversion' || sh.aim === 'hybrid') ? (
          <PrimaryButton label={C14.goLive} onPress={() => navigation.navigate('SaleLive', { ciId })} testID="go-live" />
        ) : null}
        {stage === 'sent' && !(thread && thread.negotiation && thread.negotiation.id) ? (
          <>
            <PrimaryButton label={C10.hers.thisTimeWorks} icon="check" onPress={acceptPlan} busy={busy} testID="this-time-works" />
            {sh.can.counter ? <SecondaryButton label={C10.hers.askAnother} icon="undo-variant" onPress={() => navigation.navigate('ShootCounter', { ciId })} testID="ask-another" /> : null}
          </>
        ) : null}
        {stage === 'sent' && (thread && thread.negotiation && thread.negotiation.id) && myMove ? (
          <>
            <PrimaryButton label={C10.hers.acceptNew(thread.current && thread.current.visitAt)} icon="check" onPress={acceptCounter} busy={busy} testID="accept-counter" />
            {sh.can.counter ? <SecondaryButton label={C10.hers.askAnother} icon="undo-variant" onPress={() => navigation.navigate('ShootCounter', { ciId })} testID="ask-another" /> : null}
            <Text style={s.hint}>{MSG10.NO_DECLINE}</Text>
          </>
        ) : null}
        {stage === 'agreed' ? (
          <>
            {sh.can.markAttended ? <PrimaryButton label={C10.hers.beenToStore} icon="check" onPress={attended} busy={busy} testID="been-to-store" /> : null}
            {sh.can.move ? <TextButton label={C10.hers.askToMove} icon="undo-variant" onPress={() => setSheet('move')} testID="ask-to-move" /> : null}
          </>
        ) : null}
      </BottomBar>

      <MoveTimeSheet10 visible={sheet === 'move'} side="influencer" otherName={brand} currentAt={plan.visitAt} postingDate={sh.postingDate}
        busy={busy} serverError={sheetError} onSend={move} onClose={() => { setSheetError(null); setSheet(null); }} />
    </View>
  );
}

const s = StyleSheet.create({
  crumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6 },
  para: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20, marginBottom: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, textAlign: 'center' },
  // The page fills the room between the title row and the strip (the strip itself is BottomBar's).
  page: { flex: 1 },
});
