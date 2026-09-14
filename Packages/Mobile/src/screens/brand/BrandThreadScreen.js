/**
 * BrandThreadScreen — N7 (your move), N8 (counter back), N9 (decline), N10 and N11 (a request to
 * move), N21 (every way it ends). The same thread from the brand's side, with the minimum warning
 * the creator never sees.
 * Contract: features/item6-negotiation · prompt §6.4–§6.6
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, DangerButton } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { RoundPill6, StateBox6, TurnCard6, ValueLine6, EndingCard6 } from '../../components/negotiation/bits6';
import { BrandCounterSheet6, DeclineCounterSheet6, MoveConfirmSheet6 } from '../../components/negotiation/sheets6';
import { C6, TERM_LABEL, termValue, NEGOTIABLE, snapshotLine6, shortDate6, first } from '../../components/negotiation/copy6';

export default function BrandThreadScreen({ navigation, route }) {
  const { campaignId, setId, ciId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [thread, setThread] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.brandThread(campaignId, setId, ciId);
    if (!r.success) { setStatus('error'); return; }
    setThread(r.data.thread); setStatus('ready');
  }, [campaignId, setId, ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const after = (r, msg) => {
    if (!r.success) { show(r.error?.message || COPY.saveFailed); load(); return false; }
    setSheet(null); setThread(r.data.thread); show(msg); return true;
  };
  async function accept() { setBusy(true); const r = await brandApi.brandAcceptCounter(campaignId, setId, ciId); setBusy(false); after(r, C6.thread.accepted6); }
  async function counter(body) { setBusy(true); const r = await brandApi.brandCounter(campaignId, setId, ciId, body); setBusy(false); after(r, C6.counter.sent); }
  async function declineCounter(body) { setBusy(true); const r = await brandApi.brandDeclineCounter(campaignId, setId, ciId, body); setBusy(false); after(r, C6.declineCounter.done); }
  async function answerMove(answer) {
    setBusy(true);
    const r = await brandApi.answerMoveRequest(campaignId, setId, ciId, answer);
    setBusy(false);
    after(r, answer === 'agreed' ? C6.moveAnswer.moved(first(thread.creator.name)) : answer === 'kept' ? C6.moveAnswer.kept : C6.moveAnswer.declinedDone);
  }

  const title = thread ? thread.creator.name : '';
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const goal = thread.goal;
  const f = first(thread.creator.name);
  const neg = thread.negotiation || {};
  const movePending = !!thread.can.moveAnswer;
  const myMove = neg.open && neg.whoseMove === 'brand';
  const left = Math.max(0, (neg.roundLimit || 0) - (neg.countersUsed || 0));
  const acceptLine = snapshotLine6(goal, thread.current);
  const stateText = thread.ending ? null
    : movePending ? (thread.moveRequest.goLiveDate ? C6.thread.moveAsked(f) : C6.thread.moveAskedMode(f))
      : myMove ? C6.thread.yourMove(f)
        : neg.open ? C6.thread.waitingBrand(f) : null;

  return (
    <View style={base.screen} testID={`brand-thread-${movePending ? 'move' : myMove ? 'yourmove' : neg.open ? 'waiting' : 'closed'}`}>
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 150 }}>
        <Text style={s.sub}>{C6.thread.sub(thread.setName, thread.campaignName)}</Text>
        <EndingCard6 ending={thread.ending} />
        <StateBox6 tone={movePending || myMove ? 'move' : 'wait'} text={stateText} testID="brand-thread-state" />
        {neg.open && neg.roundLimit ? <RoundPill6 round={Math.max(1, neg.countersUsed)} of={neg.roundLimit} /> : null}

        {thread.moveRequest ? (
          <TurnCard6 turn={{ id: 'move', mine: false, at: thread.moveRequest.requestedAt, kind: 'counter', changes: [], note: thread.moveRequest.note }} who={C6.thread.asked(f)} avatarName={thread.creator.name} testID="brand-turn-move">
            {thread.moveRequest.goLiveDate ? <ValueLine6 label={TERM_LABEL.postingDate} value={`${shortDate6(thread.postingDate)} → ${shortDate6(thread.moveRequest.goLiveDate)}`} /> : null}
            {thread.moveRequest.shootMode ? <ValueLine6 label={TERM_LABEL.shootMode} value={thread.moveRequest.shootMode === 'visit' ? 'Store Visit' : 'Remote'} /> : null}
          </TurnCard6>
        ) : null}

        {(thread.turns || []).map(t => (
          <TurnCard6 key={t.id} turn={t} who={t.mine ? 'You countered' : C6.thread.namedCountered(f)}
            avatarName={t.mine ? thread.brand.name : thread.creator.name} testID={`brand-turn-${t.id}`} />
        ))}

        <TurnCard6 turn={{ id: 'zero', mine: true, at: thread.invitation.sentAt, kind: 'invitation', changes: [] }} who={C6.thread.youInvited(f)} avatarName={thread.brand.name} testID="brand-turn-invitation">
          {(NEGOTIABLE[goal] || []).map(k => <ValueLine6 key={k} label={TERM_LABEL[k]} value={termValue(goal, k, thread.invitation.terms)} />)}
          {thread.invitation.scopeWords ? <ValueLine6 label="She can sell" value={thread.invitation.scopeWords} /> : null}
          {thread.invitation.offerName ? <ValueLine6 label="Shopper offer" value={thread.invitation.offerName} /> : null}
        </TurnCard6>

        {movePending ? (
          <Text style={s.hint} testID="move-line">
            {thread.moveRequest.goLiveDate
              ? C6.moveAnswer.line(thread.postingDate, f, snapshotLine6(goal, thread.current), thread.moveRequest.goLiveDate)
              : C6.moveAnswer.lineMode(thread.postingDate, f, snapshotLine6(goal, thread.current))}
          </Text>
        ) : myMove ? (
          <Text style={s.hint} testID="brand-accept-hint">{C6.thread.brandAcceptHint(acceptLine)}</Text>
        ) : null}
      </ScrollView>

      {movePending ? (
        <View style={s.bar} testID="move-actions">
          <PrimaryButton label={C6.moveAnswer.agree} onPress={() => setSheet('move')} testID="move-agree" />
          <View style={s.pair}>
            <View style={{ flex: 1, marginRight: 8 }}><SecondaryButton label={C6.moveAnswer.keep(thread.postingDate)} onPress={() => answerMove('kept')} testID="move-keep" /></View>
            <View style={{ flex: 1 }}><DangerButton label={C6.moveAnswer.decline} onPress={() => answerMove('declined')} testID="move-decline" /></View>
          </View>
        </View>
      ) : myMove ? (
        <View style={s.bar} testID="brand-thread-actions">
          <PrimaryButton label={C6.thread.acceptLine(acceptLine)} onPress={accept} busy={busy} testID="brand-accept" />
          <View style={s.pair}>
            {thread.can.counter ? <View style={{ flex: 1, marginRight: 8 }}><SecondaryButton label={C6.thread.counterBack} onPress={() => setSheet('counter')} testID="brand-counter-back" /></View> : null}
            <View style={{ flex: 1 }}><DangerButton label={C6.thread.decline} onPress={() => setSheet('decline')} testID="brand-decline" /></View>
          </View>
        </View>
      ) : null}
      {toast}
      <BrandCounterSheet6 visible={sheet === 'counter'} thread={thread} minimums={thread.minimums} onSend={counter} onClose={() => setSheet(null)} />
      <DeclineCounterSheet6 visible={sheet === 'decline'} creatorName={thread.creator.name} busy={busy} onDecline={declineCounter} onClose={() => setSheet(null)} />
      <MoveConfirmSheet6 visible={sheet === 'move'} thread={thread} busy={busy} onConfirm={() => answerMove('agreed')} onClose={() => setSheet(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  sub: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 6, lineHeight: 18 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
  pair: { flexDirection: 'row', marginTop: 8 },
});
