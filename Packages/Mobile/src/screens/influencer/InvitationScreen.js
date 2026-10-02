/**
 * InvitationScreen — I12 / I13 / I14: one invitation for the creator. Two blocks, always in
 * this order: what the brand fixed for everyone, then her own terms; the brand's note; Accept,
 * Counter (only when it is allowed — hidden, never refused) and Decline with a reason. After the
 * cutoff the three actions disappear and the card reads as expired.
 * Contract: features/item5-invitations · prompt §6.10, §6.11 · APPROVAL.md §3.4
 *
 * ui-walk-fixes (board E, frames E1 / E2): the three answers are the shared AnswerBar — Accept,
 * then Counter and Decline as two equal, level halves (Decline a red outline); with Counter not
 * allowed, Decline alone at full width. "Nothing is final…" sits at the top of the bar, where the
 * bar can never hide it.
 *
 * ui-walk-fixes (spec U23): the second button is one of three things, from what the server says.
 *   canCounter                      "Counter" — opens the chooser (the money, or the date).
 *   no counter, canMoveRequest      "Ask for another date" — opens the move request DIRECTLY. This
 *                                   is the brand that switched countering off: the switch never
 *                                   blocks a move request (item 6), and she has not asked yet. It
 *                                   used to read "Counter" and lead into a counter the server
 *                                   refused on Send.
 *   neither                         no second button: Accept, then Decline alone (frame E2).
 *
 * ui-walk-fixes (board C, rule 1): the bar is a strip IN the column, under the page (BottomBar) —
 * it no longer floats over the page, so the page needs no measured room under its last line.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, DangerButton, AnswerBar, AnswerNote } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { Avatar } from '../brand/BrandBlockedCreatorsScreen';
import { Chip5, KV5 } from '../../components/invitations/bits5';
import { DeclineSheet5 } from '../../components/invitations/sheets5';
import { C5, GROUP_TONE, aimLabel5, modeLabel5, longDate5, rupees5, MIN_SHOPPABLE_POSTS } from '../../components/invitations/copy5';
// Item 6 — the counter choice (N1), the "not taking counters" line (N19) and the pool line (N17).
import { CounterChoiceSheet6 } from '../../components/negotiation/sheets6';
import { C6 } from '../../components/negotiation/copy6';
import { C7 } from '../../components/agreement/copy7';

const D = C5.creator.detail;

const PAGE_PAD = 18;

export default function InvitationScreen({ navigation, route }) {
  const { ciId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [inv, setInv] = useState(null);
  const [sheet, setSheet] = useState(null); // 'accept' | 'decline'
  const [busy, setBusy] = useState(false);
  // Board C: a strip under the page (her answers, or the agreement door) — or none at all.
  const hasBar = !!inv && (!!inv.canAnswer || !!inv.agreement);
  // With a strip the toast floats just above it; with none it stays where it always was.
  const { toast, show } = useToast({ inFlow: hasBar });

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.myInvitation(ciId);
    if (!r.success) { setStatus('error'); return; }
    setInv(r.data.invitation); setStatus('ready');
  }, [ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function accept() {
    setBusy(true);
    const r = await influencerApi.acceptInvitation(ciId);
    setBusy(false); setSheet(null);
    if (!r.success) { show((r.error && r.error.message) || COPY.saveFailed); load(); return; }
    setInv(r.data.invitation); show(D.accepted);
  }
  async function decline(body) {
    setBusy(true);
    const r = await influencerApi.declineInvitation(ciId, body);
    setBusy(false);
    if (!r.success) { show((r.error && r.error.message) || COPY.saveFailed); return; }
    setSheet(null); setInv(r.data.invitation); show(D.declined);
  }
  /** "Ask for a change" — the one door to it, from the chooser's date choice and from U23's button. */
  function openMoveRequest() {
    setSheet(null);
    navigation.navigate('MoveRequest', { ciId });
  }

  if (status === 'loading') return <View style={base.screen}><Header title={D.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={D.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const t = inv.terms || {};
  const tone = GROUP_TONE[inv.group] || 'ended';
  const chipLabel = C5.creator.chips[inv.group];
  let sentence = null;
  if (inv.group === 'accepted') sentence = C5.creator.waitingFor(inv.brand.name);
  // Item 7 (P4, P7): once the agreement is out, the sentence is about the agreement.
  else if (inv.agreement && inv.agreement.line) sentence = inv.agreement.line;
  else if (inv.group === 'expired') sentence = C5.creator.expiredBody(inv.cutoff);
  else if (inv.group === 'withdrawn') sentence = C5.creator.withdrawnBody(inv.brand.name, inv.withdrawnAt || inv.endedAt);
  else if (inv.group === 'closed') sentence = C5.creator.closedBody(inv.brand.name);
  else if (inv.group === 'declined') sentence = C5.creator.declinedBody(inv.endedAt);

  return (
    <View style={base.screen} testID={`invitation-${inv.group}`}>
      <Header title={D.title} onBack={() => navigation.goBack()} />
      <FormArea>
      <ScrollView style={s.page} contentContainerStyle={{ padding: PAGE_PAD }} testID="invitation-scroll">
        <View style={s.brandRow}>
          <Avatar name={inv.brand.name} url={inv.brand.logoUrl} size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.brand}>{inv.brand.name}</Text>
            <Text style={s.meta}>{[inv.campaignName, inv.setName].filter(Boolean).join(' · ')}</Text>
          </View>
          {chipLabel ? <Chip5 label={chipLabel} tone={tone} testID={`state-chip-${inv.group}`} /> : null}
        </View>
        {sentence ? <View style={[s.sentence, { backgroundColor: T.state[tone].bg }]} testID="state-sentence"><Text style={[s.sentenceText, { color: T.state[tone].fg }]}>{sentence}</Text></View> : null}
        {/* N17: sent from the pool. The line names the date only when this set really is the one
            she asked for; otherwise it names the terms alone (APPROVAL §3.3). */}
        {inv.fromPool ? (
          <View style={s.pool} testID="from-pool">
            <Text style={s.poolText}>{inv.fromPool.sameDate
              ? C6.invitation.fromPool(inv.set.postingDate, inv.fromPool.termsLine, inv.fromPool.agreedAt)
              : C6.invitation.fromPoolTermsOnly(inv.fromPool.termsLine, inv.fromPool.agreedAt)}</Text>
          </View>
        ) : null}

        <View style={s.locked} testID="set-block">
          <Text style={s.blockTitle}>🔒 {D.lockedTitle}</Text>
          <KV5 k={D.rows.aim} v={aimLabel5(inv.set.goal)} />
          <KV5 k={D.rows.posts} v={longDate5(inv.set.postingDate)} />
          <KV5 k={D.rows.mode} v={[modeLabel5(inv.set.shootMode), inv.set.cityName].filter(Boolean).join(' · ')} />
          <KV5 k={D.rows.reply} v={longDate5(inv.set.cutoff)} />
        </View>

        <View style={s.card} testID="terms-block">
          <Text style={s.blockTitle}>{D.yours}</Text>
          {t.commissionPct != null ? <KV5 k={D.commission} v={D.commissionValue(t.commissionPct)} /> : null}
          {/* creator-terms-v2 (C1): one row — her offers + products — that opens "What you can sell". */}
          {t.sell ? (
            <TouchableOpacity onPress={() => navigation.navigate('CreatorSell', { ciId })} accessibilityRole="button" testID="sell-row">
              <KV5 k={D.sell} v={`${t.sell.words} ›`} />
            </TouchableOpacity>
          ) : null}
          {t.scope ? <KV5 k={D.sell} v={t.scope.kind === 'store' ? D.sellStore : t.scope.words} /> : null}
          {t.offer && t.offer.kind !== 'none' ? <KV5 k={D.offer} v={t.offer.name || C5.offer.specialLine} /> : null}
          {t.shoppablePostsMin != null ? <KV5 k={D.posts} v={D.postsValue(t.shoppablePostsMin || MIN_SHOPPABLE_POSTS)} /> : null}
          {t.fee != null ? <KV5 k={D.fee} v={rupees5(t.fee)} /> : null}
          {t.deliverablesWords ? <KV5 k={D.post} v={t.deliverablesWords} /> : null}
          {t.usageRights ? <KV5 k={D.reuse} v={t.usageRights.words} /> : null}
          {t.paySplit ? (
            <View style={s.pay} testID="pay-split">
              <Text style={s.payTitle}>{D.payTitle}</Text>
              <Text style={s.payText}>{D.pay(t.paySplit.t1, t.paySplit.t2, t.paySplit.t3)}</Text>
            </View>
          ) : null}
        </View>
        {inv.note ? <Text style={s.quote} testID="brand-note">“{inv.note}”</Text> : null}
      </ScrollView>
      {toast}
      </FormArea>

      {/* Item 7 (P4): the agreement is hers to read and sign, so the footer says
          so instead of sitting empty. */}
      {!inv.canAnswer && inv.agreement ? (
        <BottomBar testID="agreement-actions">
          <PrimaryButton
            label={inv.agreement.canSign ? C7.creator.sign : C7.creator.agreementLink}
            onPress={() => navigation.navigate('Agreement', { ciId: inv.id })}
            testID="open-agreement" />
        </BottomBar>
      ) : null}

      {inv.canAnswer ? (
        <BottomBar testID="answer-actions">
          {/* E1: "Nothing is final…" leads the bar. N19 / E2: when the brand is not taking
              counters "Counter" is gone, not greyed, and one plain line says why. She never taps
              something only to be refused. U23: while she may still ask to be moved, the second
              button says exactly that and opens the request — same place, same testID, the same
              dark outline, no undo arrow. */}
          <AnswerBar
            note={[
              D.final,
              inv.counterHiddenReason === 'switch_off'
                ? <AnswerNote key="off" text={C6.invitation.counterOff(inv.brand.name)} testID="counter-off" />
                : null,
            ]}
            main={<PrimaryButton label={D.accept} onPress={() => setSheet('accept')} testID="accept" />}
          >
            {inv.canCounter
              ? <SecondaryButton strong icon="undo-variant" label={D.counter} onPress={() => setSheet('choice')} testID="counter" />
              : inv.canMoveRequest
                ? <SecondaryButton strong shrink label={C6.invitation.askDate} onPress={openMoveRequest} testID="counter" />
                : null}
            <DangerButton outline label={D.decline} onPress={() => setSheet('decline')} testID="decline" />
          </AnswerBar>
        </BottomBar>
      ) : null}
      <ConfirmSheet visible={sheet === 'accept'} title={D.acceptTitle} body={D.acceptBody(inv.brand.name)} confirmLabel={D.accept} cancelLabel={D.notYet} onConfirm={accept} onCancel={() => setSheet(null)} />
      <DeclineSheet5 visible={sheet === 'decline'} busy={busy} onDecline={decline} onClose={() => setSheet(null)} />
      {/* N1: two different things hide behind one word, so she picks which. The chooser is told
          whether a counter is allowed, so it can never offer one that is not (U23). */}
      <CounterChoiceSheet6 visible={sheet === 'choice'}
        roundLimit={(inv.negotiation && inv.negotiation.roundLimit) || 2}
        countersUsed={(inv.negotiation && inv.negotiation.countersUsed) || 0}
        canCounter={!!inv.canCounter}
        canMoveRequest={inv.canMoveRequest}
        onMoney={() => { setSheet(null); navigation.navigate('Counter', { ciId }); }}
        onMove={openMoveRequest}
        onClose={() => setSheet(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  brand: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  sentence: { borderRadius: 12, padding: 10, marginBottom: 12 },
  pool: { borderRadius: 12, padding: 10, marginBottom: 12, backgroundColor: T.state.active.bg },
  poolText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.active.fg, lineHeight: 17 },
  sentenceText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, lineHeight: 17 },
  locked: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 12 },
  blockTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 4 },
  pay: { backgroundColor: T.state.waiting.bg, borderRadius: 10, padding: 10, marginTop: 8 },
  payTitle: { fontFamily: fonts.sansBold, fontSize: 12, color: T.state.waiting.fg },
  payText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.waiting.fg, marginTop: 4, lineHeight: 17 },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, fontStyle: 'italic', lineHeight: 19, marginBottom: 8 },
  // The page fills the room between the title row and the strip (the strip itself is BottomBar's).
  page: { flex: 1 },
});
