/**
 * Item 8 — a pitch is a thread (T9, T10).
 * Contract: features/item8-pitch · rules v1.21 §8, §7B
 *
 * This is item 6's conversation screen, unchanged in every way that matters:
 * the same turn cards, the same old-beside-new change lines, the same round
 * pill, the same last-round warning. One negotiation machine for the product.
 *
 * Two things differ, and only because a pitch differs:
 *
 *   · **Her pitch IS the opening turn**, so it is already in `turns` and there
 *     is no separate "their invitation" card underneath. Rendering one would
 *     show her pitch twice.
 *   · **Accepting as the brand is accepting the pitch**, so it goes through the
 *     pitch service and ends in a pool entry — not a contract. There is one
 *     accept in item 8, not two.
 *
 * One screen serves both sides, because the only thing that changes is which
 * four endpoints it calls and whose name is at the top.
 *
 * ui-walk-fixes (board E): the answers are the shared AnswerBar, as on item 6's
 * conversation — Accept, then "Counter back" and Reject / Decline as two equal,
 * level halves; on the last round the red outline alone at full width.
 *
 * ui-walk-fixes (board C, rule 1): the bar is a strip IN the column, under the page
 * (BottomBar) — it no longer floats over the page, so the page needs no measured
 * room under its last line.
 *
 * ui-walk-fixes (closing pass): the counter screen ends by putting this screen in its place with
 * a message — `replace('PitchThread' | 'BrandPitchThread', { pitchId, toast: 'Counter sent.' })` —
 * and this screen never read it, so the counter went without a word. It reads the route message
 * now (useRouteToast), exactly as item 6's conversation (ThreadScreen) does after its own counter:
 * the message is taken on arrival and is on show once the thread is drawn.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, brandApi } from '../../services/api';
import { PrimaryButton, DangerButton, SecondaryButton, AnswerBar } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { DeclineSheet5 } from '../../components/invitations/sheets5';
import { RoundPill6, StateBox6, TurnCard6, EndingCard6 } from '../../components/negotiation/bits6';
import { C6, snapshotLine6 } from '../../components/negotiation/copy6';
import { AcceptPitchSheet8, RejectPitchSheet8 } from '../../components/pitch/sheets8';
import { C8 } from '../../components/pitch/copy8';
import useRouteToast, { goBackWithToast } from '../../hooks/useRouteToast';

const PAGE_PAD = 18;
/** This side's move: the answers strip is drawn under the page. */
const isMyMove = (thread, me) => !!(thread && thread.negotiation && thread.negotiation.open && thread.negotiation.whoseMove === me);

export default function PitchThreadScreen({ navigation, route, side = 'influencer' }) {
  const { pitchId } = route?.params || {};
  const brandSide = side === 'brand';
  const me = brandSide ? 'brand' : 'influencer';
  const [status, setStatus] = useState('loading');
  const [thread, setThread] = useState(null);
  const [pitch, setPitch] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  // Board C: with the strip the toast floats just above it; with none it stays where it always was.
  const { toast, show } = useToast({ inFlow: isMyMove(thread, me) });
  // The message the counter screen hands over ("Counter sent."). A hook — it must stay above the
  // two early returns below.
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const [t, p] = await Promise.all([
      brandSide ? brandApi.pitchThread(pitchId) : influencerApi.myPitchThread(pitchId),
      brandSide ? brandApi.pitch(pitchId) : influencerApi.myPitch(pitchId),
    ]);
    if (!t || !t.success) { setStatus('error'); return; }
    setThread(t.data.thread);
    if (p && p.success) setPitch(p.data.pitch);
    setStatus('ready');
  }, [pitchId, brandSide]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /**
   * The brand's accept is the pitch's accept — it creates the pool entry. Hers
   * is the ordinary thread accept, which ends the thread and agrees the terms.
   */
  async function accept() {
    setBusy(true);
    const r = brandSide ? await brandApi.acceptPitch(pitchId) : await influencerApi.acceptMyPitch(pitchId);
    setBusy(false);
    setSheet(null);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); load(); return; }
    // ui-walk-fixes (board F, frame F8): the pool says who has just arrived in it.
    if (brandSide) { navigation.navigate('CampaignsTab', { screen: 'BrandPool', params: { highlight: r.data.poolEntryId, toast: C8.brand.inPool(thread && thread.creator ? thread.creator.name : '') }, initial: false }); return; }
    load();
    show(C6.thread.accepted6);
  }

  /** The brand's decline is a rejection, and a rejection starts the cooldown. */
  async function reject(reason) {
    setBusy(true);
    const r = await brandApi.rejectPitch(pitchId, { reason });
    setBusy(false);
    setSheet(null);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); load(); return; }
    // ui-walk-fixes (F8): back where the brand came from, which says "Pitch rejected."
    goBackWithToast(navigation, C8.brand.rejected);
  }

  async function decline(body) {
    setBusy(true);
    const r = await influencerApi.declineMyPitch(pitchId, body);
    setBusy(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); return; }
    setSheet(null);
    load();
    show(C6.thread.declined6);
  }

  const title = thread ? (brandSide ? thread.creator.name : thread.brand.name) : '';
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const neg = thread.negotiation || {};
  const goal = thread.goal;
  const myMove = isMyMove(thread, me);
  const lastRound = myMove && neg.noRoundsLeft;
  const left = Math.max(0, (neg.roundLimit || 0) - (neg.countersUsed || 0));
  const them = brandSide ? thread.creator.name : thread.brand.name;
  const stateText = thread.ending ? null
    : myMove ? (lastRound ? C6.thread.lastRound : C6.thread.yourMoveMe)
      : neg.open ? C6.thread.waiting(them, null) : null;

  return (
    <View style={base.screen} testID={`pitch-thread-${myMove ? 'yourmove' : neg.open ? 'waiting' : 'closed'}`}>
      <Header title={title} onBack={() => navigation.goBack()} />
      <FormArea>
      <ScrollView style={s.page} contentContainerStyle={{ padding: PAGE_PAD }} testID="pitch-thread-scroll">
        <Text style={s.crumb} testID="pitch-thread-crumb">
          {brandSide ? C8.thread.crumbBrand(thread.goal) : C8.thread.crumbCreator(thread.goal)}
        </Text>
        <EndingCard6 ending={thread.ending} />
        <StateBox6 tone={myMove ? 'move' : 'wait'} text={stateText} testID="pitch-thread-state" />
        {neg.open && neg.roundLimit ? <RoundPill6 round={Math.max(1, neg.countersUsed)} of={neg.roundLimit} /> : null}

        {/*
          Her pitch is the LAST turn in this list (newest first), rendered as an
          ordinary turn. No invitation card follows it — there is no invitation.
        */}
        {(thread.turns || []).map((t) => (
          <TurnCard6
            key={t.id}
            turn={t}
            who={t.mine
              ? (brandSide ? C6.thread.youCountered : C8PitchedMine(t, thread))
              : (t.by === 'influencer' ? C8PitchedTheirs(t, thread, them) : C6.thread.theyCountered)}
            avatarName={t.mine ? 'You' : them}
            testID={`turn-${t.id}`}
          />
        ))}

        {!myMove && neg.open ? <Text style={s.hint} testID="they-can">{C6.thread.canDo(left)}</Text> : null}
      </ScrollView>
      {toast}
      </FormArea>

      {myMove ? (
        <BottomBar testID="pitch-thread-actions">
          <AnswerBar
            main={(
              <PrimaryButton
                label={C6.thread.acceptLine(snapshotLine6(goal, thread.current))}
                onPress={() => (brandSide ? setSheet('accept') : accept())}
                busy={busy}
                testID="pitch-thread-accept"
              />
            )}
          >
            {/* Gone, not greyed, when there is no counter left. */}
            {!lastRound && thread.can && thread.can.counter ? (
              <SecondaryButton
                strong
                icon="undo-variant"
                label={C6.thread.counterBack}
                onPress={() => navigation.navigate('PitchCounter', { pitchId, side })}
                testID="pitch-thread-counter"
              />
            ) : null}
            <DangerButton
              outline
              label={brandSide ? C8.brand.reject : C6.thread.decline}
              onPress={() => setSheet(brandSide ? 'reject' : 'decline')}
              testID="pitch-thread-decline"
            />
          </AnswerBar>
        </BottomBar>
      ) : null}

      <AcceptPitchSheet8 visible={sheet === 'accept'} pitch={pitch} busy={busy} onAccept={accept} onClose={() => setSheet(null)} />
      <RejectPitchSheet8 visible={sheet === 'reject'} pitch={pitch} busy={busy} onReject={reject} onClose={() => setSheet(null)} />
      <DeclineSheet5 visible={sheet === 'decline'} busy={busy} onDecline={decline} onClose={() => setSheet(null)} />
    </View>
  );
}

/** The opening turn is hers, and both sides should read it as a pitch, not a counter. */
const isOpening = (t, thread) => {
  const turns = thread.turns || [];
  return turns.length > 0 && turns[turns.length - 1].id === t.id && t.by === 'influencer';
};
const C8PitchedMine = (t, thread) => (isOpening(t, thread) ? 'You pitched' : C6.thread.youCountered);
const C8PitchedTheirs = (t, thread, name) => (isOpening(t, thread) ? `${String(name || '').split(' ')[0]} pitched` : C6.thread.theyCountered);

const s = StyleSheet.create({
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 6, lineHeight: 17 },
  // The page fills the room between the title row and the strip (the strip itself is BottomBar's).
  page: { flex: 1 },
});
