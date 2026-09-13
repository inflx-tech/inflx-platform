/**
 * InvitationScreen — I12 / I13 / I14: one invitation for the creator. Two blocks, always in
 * this order: what the brand fixed for everyone, then her own terms; the brand's note; Accept,
 * Counter (only when it is allowed — hidden, never refused) and Decline with a reason. After the
 * cutoff the three actions disappear and the card reads as expired.
 * Contract: features/item5-invitations · prompt §6.10, §6.11 · APPROVAL.md §3.4
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, DangerButton } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { Avatar } from '../brand/BrandBlockedCreatorsScreen';
import { Chip5, KV5 } from '../../components/invitations/bits5';
import { DeclineSheet5 } from '../../components/invitations/sheets5';
import { C5, GROUP_TONE, aimLabel5, modeLabel5, longDate5, rupees5, MIN_SHOPPABLE_POSTS } from '../../components/invitations/copy5';

const D = C5.creator.detail;

export default function InvitationScreen({ navigation, route }) {
  const { ciId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [inv, setInv] = useState(null);
  const [sheet, setSheet] = useState(null); // 'accept' | 'decline'
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

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

  if (status === 'loading') return <View style={base.screen}><Header title={D.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={D.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const t = inv.terms || {};
  const tone = GROUP_TONE[inv.group] || 'ended';
  const chipLabel = C5.creator.chips[inv.group];
  let sentence = null;
  if (inv.group === 'accepted') sentence = C5.creator.waitingFor(inv.brand.name);
  else if (inv.group === 'expired') sentence = C5.creator.expiredBody(inv.cutoff);
  else if (inv.group === 'withdrawn') sentence = C5.creator.withdrawnBody(inv.brand.name, inv.withdrawnAt || inv.endedAt);
  else if (inv.group === 'closed') sentence = C5.creator.closedBody(inv.brand.name);
  else if (inv.group === 'declined') sentence = C5.creator.declinedBody(inv.endedAt);

  return (
    <View style={base.screen} testID={`invitation-${inv.group}`}>
      <Header title={D.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 140 }}>
        <View style={s.brandRow}>
          <Avatar name={inv.brand.name} url={inv.brand.logoUrl} size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.brand}>{inv.brand.name}</Text>
            <Text style={s.meta}>{[inv.campaignName, inv.setName].filter(Boolean).join(' · ')}</Text>
          </View>
          {chipLabel ? <Chip5 label={chipLabel} tone={tone} testID={`state-chip-${inv.group}`} /> : null}
        </View>
        {sentence ? <View style={[s.sentence, { backgroundColor: T.state[tone].bg }]} testID="state-sentence"><Text style={[s.sentenceText, { color: T.state[tone].fg }]}>{sentence}</Text></View> : null}

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
        {inv.canAnswer ? <Text style={s.hint}>{D.final}</Text> : null}
      </ScrollView>

      {inv.canAnswer ? (
        <View style={s.footer} testID="answer-actions">
          <PrimaryButton label={D.accept} onPress={() => setSheet('accept')} testID="accept" />
          <View style={s.pair}>
            {inv.canCounter ? <View style={{ flex: 1, marginRight: 8 }}><SecondaryButton label={D.counter} onPress={() => navigation.navigate('CounterSoon', { ciId })} testID="counter" /></View> : null}
            <View style={{ flex: 1 }}><DangerButton label={D.decline} onPress={() => setSheet('decline')} testID="decline" /></View>
          </View>
        </View>
      ) : null}
      {toast}
      <ConfirmSheet visible={sheet === 'accept'} title={D.acceptTitle} body={D.acceptBody(inv.brand.name)} confirmLabel={D.accept} cancelLabel={D.notYet} onConfirm={accept} onCancel={() => setSheet(null)} />
      <DeclineSheet5 visible={sheet === 'decline'} busy={busy} onDecline={decline} onClose={() => setSheet(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  brand: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  sentence: { borderRadius: 12, padding: 10, marginBottom: 12 },
  sentenceText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, lineHeight: 17 },
  locked: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 12 },
  blockTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 4 },
  pay: { backgroundColor: T.state.waiting.bg, borderRadius: 10, padding: 10, marginTop: 8 },
  payTitle: { fontFamily: fonts.sansBold, fontSize: 12, color: T.state.waiting.fg },
  payText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.waiting.fg, marginTop: 4, lineHeight: 17 },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, fontStyle: 'italic', lineHeight: 19, marginBottom: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, textAlign: 'center', marginTop: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
  pair: { flexDirection: 'row', marginTop: 8 },
});
