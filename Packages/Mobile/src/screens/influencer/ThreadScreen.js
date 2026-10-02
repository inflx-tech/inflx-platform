/**
 * ThreadScreen — N5 (waiting) and N6 (the last round): the creator's side of one conversation.
 * Newest turn first, the original invitation always last as plain values, a state box at the top,
 * and Accept / Decline when it is her move.
 * Contract: features/item6-negotiation · prompt §6.4
 *
 * ui-walk-fixes (board E, frames E3 / E4): her answers are the shared AnswerBar — Accept with the
 * terms she is agreeing to (a long label is centred and may wrap), then Counter back and Decline
 * as two equal, level halves; on the last round, Decline alone at full width.
 *
 * ui-walk-fixes (board C, rule 1): the bar is a strip IN the column, under the page (BottomBar) —
 * it no longer floats over the page, so the page needs no measured room under its last line.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, DangerButton, SecondaryButton, AnswerBar } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { DeclineSheet5 } from '../../components/invitations/sheets5';
import { RoundPill6, StateBox6, TurnCard6, ValueLine6, EndingCard6 } from '../../components/negotiation/bits6';
import { C6, TERM_LABEL, termValue, NEGOTIABLE, snapshotLine6, shortDate6 } from '../../components/negotiation/copy6';

const PAGE_PAD = 18;
/** Her move: the answers strip is drawn under the page. */
const isMyMove = (thread) => !!(thread && thread.negotiation && thread.negotiation.open && thread.negotiation.whoseMove === 'influencer');

export default function ThreadScreen({ navigation, route }) {
  const { ciId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [thread, setThread] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  // Board C: with the strip the toast floats just above it; with none it stays where it always was.
  const { toast, show } = useToast({ inFlow: isMyMove(thread) });
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.myThread(ciId);
    if (!r.success) { setStatus('error'); return; }
    setThread(r.data.thread); setStatus('ready');
  }, [ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function accept() {
    setBusy(true);
    const r = await influencerApi.acceptCounter(ciId);
    setBusy(false);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); load(); return; }
    setThread(r.data.thread); show(C6.thread.accepted6);
  }
  async function decline(body) {
    setBusy(true);
    const r = await influencerApi.declineCounter(ciId, body);
    setBusy(false);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setSheet(null); setThread(r.data.thread); show(C6.thread.declined6);
  }

  const title = thread ? C6.thread.title(thread.brand.name) : '';
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const neg = thread.negotiation || {};
  const goal = thread.goal;
  const myMove = isMyMove(thread);
  const lastRound = myMove && neg.noRoundsLeft;
  const left = Math.max(0, (neg.roundLimit || 0) - (neg.countersUsed || 0));
  const stateText = thread.ending ? null
    : myMove ? (lastRound ? C6.thread.lastRound : C6.thread.yourMoveMe)
      : neg.open ? C6.thread.waiting(thread.brand.name, thread.cutoff) : null;
  const stateTone = lastRound ? 'move' : myMove ? 'move' : 'wait';
  const acceptLine = snapshotLine6(goal, thread.current);

  return (
    <View style={base.screen} testID={`thread-${myMove ? 'yourmove' : neg.open ? 'waiting' : 'closed'}`}>
      <Header title={title} onBack={() => navigation.goBack()} />
      <FormArea>
      <ScrollView style={s.page} contentContainerStyle={{ padding: PAGE_PAD }} testID="thread-scroll">
        <Text style={s.sub}>{C6.thread.sub(thread.campaignName, thread.setName)}</Text>
        <EndingCard6 ending={thread.ending} />
        <StateBox6 tone={stateTone} text={stateText} testID="thread-state" />
        {neg.open && neg.roundLimit ? <RoundPill6 round={Math.max(1, neg.countersUsed)} of={neg.roundLimit} /> : null}

        {(thread.turns || []).map(t => (
          <TurnCard6 key={t.id} turn={t} who={t.mine ? C6.thread.youCountered : C6.thread.theyCountered}
            avatarName={t.mine ? 'You' : thread.brand.name} testID={`turn-${t.id}`} />
        ))}

        {thread.moveRequest ? (
          <TurnCard6 turn={{ id: 'move', mine: true, at: thread.moveRequest.requestedAt, kind: 'counter', changes: [], note: thread.moveRequest.note }} who={C6.thread.youAsked} avatarName="You" testID="turn-move">
            {thread.moveRequest.goLiveDate ? <ValueLine6 label={TERM_LABEL.postingDate} value={`${shortDate6(thread.postingDate)} → ${shortDate6(thread.moveRequest.goLiveDate)}`} /> : null}
            {thread.moveRequest.shootMode ? <ValueLine6 label={TERM_LABEL.shootMode} value={thread.moveRequest.shootMode === 'visit' ? 'Store Visit' : 'Remote'} /> : null}
          </TurnCard6>
        ) : null}

        {/* The original invitation, always last, shown as plain values (N5). */}
        <TurnCard6 turn={{ id: 'zero', mine: false, at: thread.invitation.sentAt, kind: 'invitation', changes: [] }} who={C6.thread.theirInvitation} avatarName={thread.brand.name} testID="turn-invitation">
          {(NEGOTIABLE[goal] || []).map(k => <ValueLine6 key={k} label={TERM_LABEL[k]} value={termValue(goal, k, thread.invitation.terms)} />)}
          {thread.invitation.scopeWords ? <ValueLine6 label="You can sell" value={thread.invitation.scopeWords} /> : null}
          {thread.invitation.offerName ? <ValueLine6 label="Shopper offer" value={thread.invitation.offerName} /> : null}
        </TurnCard6>

        {!myMove && neg.open ? <Text style={s.hint} testID="they-can">{C6.thread.canDo(left)}</Text> : null}
      </ScrollView>
      {toast}
      </FormArea>

      {myMove ? (
        <BottomBar testID="thread-actions">
          <AnswerBar main={<PrimaryButton label={C6.thread.acceptLine(acceptLine)} onPress={accept} busy={busy} testID="thread-accept" />}>
            {/* Gone, not greyed, when she has no counter left (N6). */}
            {!lastRound && thread.can.counter
              ? <SecondaryButton strong icon="undo-variant" label={C6.thread.counterBack} onPress={() => navigation.navigate('Counter', { ciId })} testID="thread-counter" />
              : null}
            <DangerButton outline label={C6.thread.decline} onPress={() => setSheet('decline')} testID="thread-decline" />
          </AnswerBar>
        </BottomBar>
      ) : null}
      <DeclineSheet5 visible={sheet === 'decline'} busy={busy} onDecline={decline} onClose={() => setSheet(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  sub: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 6, lineHeight: 17 },
  // The page fills the room between the title row and the strip (the strip itself is BottomBar's).
  page: { flex: 1 },
});
