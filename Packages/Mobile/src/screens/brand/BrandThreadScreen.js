/**
 * BrandThreadScreen — N7 (your move), N8 (counter back), N9 (decline), N10 and N11 (a request to
 * move), N21 (every way it ends). The same thread from the brand's side, with the minimum warning
 * the creator never sees.
 * Contract: features/item6-negotiation · prompt §6.4–§6.6
 *
 * ui-walk-fixes (board E, frames E5 / E6): both of the brand's bars are the shared AnswerBar — the
 * main answer full width, then two equal, level halves ("Counter back" or "Keep {date}" as the
 * dark outline, Decline as the red outline).
 *
 * ui-walk-fixes (board C, rule 1): the bar is a strip in the column, under the page (BottomBar).
 * It used to float over the page, and the page measured it to keep that much room under its last
 * line; in the column nothing can be covered, so the measuring and the room are gone. The toast
 * sits just above the strip.
 *
 * A counter the server refuses is said INSIDE the open counter pop-up (`serverError`), where the
 * brand is looking — it used to be a toast raised behind the pop-up. Nothing is read again while
 * that pop-up is open: a re-read that fails puts "Couldn't load" in place of the whole page, and
 * the pop-up — with everything typed in it and the refusal itself — would go with it. The
 * conversation is read again when the pop-up that showed a refusal is closed.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, DangerButton, AnswerBar } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import useRouteToast from '../../hooks/useRouteToast';
import { RoundPill6, StateBox6, TurnCard6, ValueLine6, EndingCard6 } from '../../components/negotiation/bits6';
import { BrandCounterSheet6, DeclineCounterSheet6, MoveConfirmSheet6 } from '../../components/negotiation/sheets6';
import { C6, TERM_LABEL, termValue, NEGOTIABLE, snapshotLine6, shortDate6, first } from '../../components/negotiation/copy6';

const PAGE_PAD = 18;

export default function BrandThreadScreen({ navigation, route }) {
  const { campaignId, setId, ciId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [thread, setThread] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  // Why the server refused the counter, shown inside the counter pop-up. A toast cannot be seen
  // from behind a pop-up, so a refusal announced that way is a refusal nobody reads.
  const [counterError, setCounterError] = useState(null);
  // Which pop-up is open NOW — an answer from the server arrives after the tap that asked for it,
  // and by then the brand may have closed the pop-up.
  const sheetNow = useRef(null);
  sheetNow.current = sheet;
  const { toast, show } = useToast({ inFlow: true });
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.brandThread(campaignId, setId, ciId);
    if (!r.success) {
      // "Couldn't load" replaces the page and every pop-up on it. None may be left marked open
      // behind it, or it would come back by itself after "Try again" — with an old refusal in it.
      setSheet(null); setCounterError(null);
      setStatus('error'); return;
    }
    setThread(r.data.thread); setStatus('ready');
  }, [campaignId, setId, ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const after = (r, msg) => {
    if (!r.success) { show(r.error?.message || COPY.saveFailed); load(); return false; }
    setSheet(null); setThread(r.data.thread); show(msg); return true;
  };
  async function accept() { setBusy(true); const r = await brandApi.brandAcceptCounter(campaignId, setId, ciId); setBusy(false); after(r, C6.thread.accepted6); }
  async function counter(body) {
    setBusy(true); setCounterError(null);
    const r = await brandApi.brandCounter(campaignId, setId, ciId, body);
    setBusy(false);
    if (!r || !r.success) {
      const why = (r && r.error && r.error.message) || COPY.saveFailed;
      // Refused with the pop-up still open: it stays open with what was typed, and says why.
      // Nothing is read again behind it (see the note at the top); closing it does that.
      if (sheetNow.current === 'counter') { setCounterError(why); return; }
      // Refused after the brand closed the pop-up (a slow send): nothing covers the page, so a
      // toast can be read, and the page is read again — what a refusal always did here.
      show(why); load(); return;
    }
    after(r, C6.counter.sent);
  }
  const openCounter = () => { setCounterError(null); setSheet('counter'); };
  // A refusal means the page behind the pop-up may be out of date (she answered meanwhile, the
  // round was used), so closing a pop-up that showed one reads the conversation again.
  const closeCounter = () => {
    const refused = !!counterError;
    setCounterError(null); setSheet(null);
    if (refused) load();
  };
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
      <FormArea>
      <ScrollView style={s.page} contentContainerStyle={{ padding: PAGE_PAD }} testID="brand-thread-scroll">
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
      {toast}
      </FormArea>

      {movePending ? (
        <BottomBar testID="move-actions">
          {/* E6: three answers in the same shape. */}
          <AnswerBar main={<PrimaryButton label={C6.moveAnswer.agree} onPress={() => setSheet('move')} testID="move-agree" />}>
            <SecondaryButton strong label={C6.moveAnswer.keep(thread.postingDate)} onPress={() => answerMove('kept')} testID="move-keep" />
            <DangerButton outline label={C6.moveAnswer.decline} onPress={() => answerMove('declined')} testID="move-decline" />
          </AnswerBar>
        </BottomBar>
      ) : myMove ? (
        <BottomBar testID="brand-thread-actions">
          {/* E5: Counter back is gone, not greyed, when the brand has no counter left. */}
          <AnswerBar main={<PrimaryButton label={C6.thread.acceptLine(acceptLine)} onPress={accept} busy={busy} testID="brand-accept" />}>
            {thread.can.counter
              ? <SecondaryButton strong icon="undo-variant" label={C6.thread.counterBack} onPress={openCounter} testID="brand-counter-back" />
              : null}
            <DangerButton outline label={C6.thread.decline} onPress={() => setSheet('decline')} testID="brand-decline" />
          </AnswerBar>
        </BottomBar>
      ) : null}
      <BrandCounterSheet6 visible={sheet === 'counter'} thread={thread} minimums={thread.minimums}
        serverError={sheet === 'counter' ? counterError : null} onSend={counter} onClose={closeCounter} />
      <DeclineCounterSheet6 visible={sheet === 'decline'} creatorName={thread.creator.name} busy={busy} onDecline={declineCounter} onClose={() => setSheet(null)} />
      <MoveConfirmSheet6 visible={sheet === 'move'} thread={thread} busy={busy} onConfirm={() => answerMove('agreed')} onClose={() => setSheet(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  sub: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 6, lineHeight: 18 },
  page: { flex: 1 },
});
