/**
 * Item 10 — agreeing the time is a thread (V7, and her side of the same).
 * Contract: features/item10-store-visit · rules v1.24 §11.1, §7B
 *
 * Item 6's conversation screen on the shoot-plan anchor: the same turn cards, the same
 * old-beside-new change line, the same round pill. Two things differ, and only because a time
 * differs: the opening turn is the plan as sent, shown as plain values; and there are two
 * buttons, not three — a time that doesn't suit is never a refusal, it is another time.
 *
 * One screen serves both sides; the brand's is the same component with `side` fixed.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { RoundPill6, StateBox6, TurnCard6, ValueLine6, EndingCard6 } from '../../components/negotiation/bits6';
import { C10, whenShort10 } from '../../components/shoot/copy10';
import { first } from '../../components/invitations/copy5';

export default function ShootThreadScreen({ navigation, route, side = 'influencer' }) {
  const { campaignId, setId, ciId } = route?.params || {};
  const brandSide = side === 'brand';
  const [status, setStatus] = useState('loading');
  const [sh, setSh] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = brandSide ? await brandApi.getShoot(campaignId, setId, ciId) : await influencerApi.myShoot(ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    setStatus('ready');
  }, [campaignId, setId, ciId, brandSide]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function accept() {
    setBusy(true);
    const r = brandSide ? await brandApi.acceptShootTime(campaignId, setId, ciId) : await influencerApi.acceptMyShootCounter(ciId);
    setBusy(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); load(); return; }
    setSh(r.data.shoot);
    show(C10.thread.agreed);
  }

  const title = sh ? (brandSide ? sh.creator.name : sh.brand.name) : '';
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const thread = sh.thread || { turns: [], negotiation: {} };
  const neg = thread.negotiation || {};
  const me = brandSide ? 'brand' : 'influencer';
  const myMove = !!(neg.open && neg.whoseMove === me);
  const them = brandSide ? sh.creator.name : sh.brand.name;
  const turns = thread.turns || [];
  const moved = turns.some((t) => t.kind === 'accept');
  const opening = turns.length ? turns[turns.length - 1] : null;
  const plan = sh.plan || {};
  const stateText = neg.open
    ? (myMove ? (moved ? C10.thread.yourMoveMoved(them) : C10.thread.yourMoveAsked(them)) : C10.thread.waiting(them))
    : null;

  return (
    <View style={base.screen} testID={`shoot-thread-${myMove ? 'yourmove' : neg.open ? 'waiting' : 'closed'}`}>
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 160 }}>
        <Text style={s.crumb}>{`${C10.thread.crumb} · ${String(sh.setName || '').toUpperCase()}`}</Text>
        <EndingCard6 ending={thread.ending} />
        <StateBox6 tone={myMove ? 'move' : 'wait'} text={stateText} testID="shoot-thread-state" />
        {neg.open && neg.roundLimit ? <RoundPill6 round={Math.max(1, neg.countersUsed)} of={neg.roundLimit} last={neg.isLastRound && myMove} /> : null}

        {turns.map((t) => {
          const isOpening = opening && t.id === opening.id && t.kind === 'counter';
          const who = t.kind === 'accept'
            ? (t.mine ? 'You agreed' : `${first(them)} agreed`)
            : isOpening
              ? (t.mine ? C10.thread.youSentThePlan : (t.by === 'brand' ? C10.thread.theySentThePlan(sh.brand.name) : C10.thread.asked(them)))
              : (t.mine ? C10.thread.youAsked : C10.thread.asked(them));
          return (
            <TurnCard6 key={t.id} turn={t} who={who} avatarName={t.mine ? 'You' : them} testID={`turn-${t.id}`}>
              {isOpening ? (
                <>
                  <ValueLine6 label={C10.thread.rows.time} value={whenShort10(t.terms && t.terms.visitAt)} />
                  {plan.branch && plan.branch.name ? <ValueLine6 label={C10.thread.rows.branch} value={plan.branch.name} /> : null}
                  {plan.contact && plan.contact.name ? <ValueLine6 label={C10.thread.rows.askFor} value={plan.contact.name} /> : null}
                </>
              ) : null}
            </TurnCard6>
          );
        })}
      </ScrollView>

      {myMove ? (
        <View style={s.bar} testID="shoot-thread-actions">
          <PrimaryButton label={C10.thread.accept(thread.current && thread.current.visitAt)} onPress={accept} busy={busy} testID="shoot-thread-accept" />
          {thread.can && thread.can.counter ? (
            <SecondaryButton label={brandSide ? C10.thread.suggestAnother : C10.hers.askAnother}
              onPress={() => navigation.navigate(brandSide ? 'BrandShootCounter' : 'ShootCounter', { campaignId, setId, ciId })}
              testID="shoot-thread-counter" />
          ) : null}
          <Text style={s.hint} testID="no-decline">{C10.thread.noDecline}</Text>
        </View>
      ) : null}
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, gap: 8 },
});
