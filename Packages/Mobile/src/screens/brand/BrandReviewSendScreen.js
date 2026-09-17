/**
 * BrandReviewSendScreen — I8: the last look. The locked set card with "Replies close", the
 * below-minimum warning, one row per creator (tap to go back to her terms), and "Send {n}
 * invitations" — one all-or-nothing action. When the server names creators that failed, the
 * rows are marked and one button offers "Remove {n} and send the rest".
 * Contract: features/item5-invitations · prompt §6.6 · APPROVAL.md Q2
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, Banner } from '../../components/settings/primitives';
import { useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { Stepper5, LockedSetCard5, ReviewRow5 } from '../../components/invitations/bits5';
import { C5, MSG5 } from '../../components/invitations/copy5';
import { getDraft, clearDraft, clearBasket, removeCreators, toServer, summaryLine, validateLocal } from '../../components/invitations/draft5';

const R = C5.review;

export default function BrandReviewSendScreen({ navigation, route }) {
  const { campaignId, setId } = route?.params || {};
  const [, setTick] = useState(0);
  const [warnings, setWarnings] = useState({});
  const [failures, setFailures] = useState({});
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  const draft = getDraft(setId);

  const refresh = useCallback(async () => {
    setTick(x => x + 1);
    const d = getDraft(setId);
    if (!d) return;
    const creators = d.creators.map(c => { const t = d.terms[c.id] || {}; return { influencerId: c.id, fee: t.fee === '' ? undefined : t.fee, commissionPct: t.commissionPct === '' ? undefined : t.commissionPct }; });
    const r = await brandApi.checkEligibility(campaignId, setId, creators);
    if (!r.success) return;
    const by = {};
    for (const x of r.data.results || []) by[x.influencerId] = x.warnings || [];
    setWarnings(by);
  }, [campaignId, setId]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (!draft) return <View style={base.screen}><Header title={R.title} onBack={() => navigation.goBack()} /><Text style={s.hint}>{MSG5.NOBODY_PICKED}</Text></View>;
  const goal = draft.set.goal;
  const belowCount = draft.creators.filter(c => (warnings[c.id] || []).length).length;
  const failedIds = Object.keys(failures);

  async function send() {
    const d = getDraft(setId);
    // Every creator must pass the local rules before anything leaves the phone.
    for (let i = 0; i < d.creators.length; i += 1) {
      const e = validateLocal(goal, d.terms[d.creators[i].id] || {});
      if (Object.keys(e).length) { navigation.navigate('BrandCreatorTerms', { campaignId, setId, index: i }); return; }
    }
    setBusy(true);
    // Item 6: a creator picked from the pool carries her entry id, so the entry is marked used
    // the moment the invitation is sent, whatever she then answers (APPROVAL §3.2).
    //
    // 2026-09-17: the group rides on the CREATOR. One send can now mix a group, the pool and
    // hand-picked creators, so a single label for the batch would be false for most of them.
    // The batch-level field is still sent when the whole draft shares one group, which is what
    // an older screen (or an older bundle) produces.
    const body = {
      creators: d.creators.map(c => ({
        influencerId: c.id,
        terms: toServer(goal, d.terms[c.id]),
        poolEntryId: c.poolEntryId || undefined,
        sourceGroupId: c.sourceGroupId || undefined,
      })),
      sourceGroupId: d.sourceGroupId || undefined,
    };
    const r = await brandApi.sendInvitations(campaignId, setId, body);
    setBusy(false);
    if (r.success) {
      clearDraft(setId);
      // Everyone in it has just been invited. Leaving them ticked would greet her with a basket
      // full of people the server would now refuse.
      clearBasket(setId);
      navigation.navigate('BrandSetDetail', { campaignId, setId, toast: R.sent(r.data.sent) });
      return;
    }
    const list = r.error && r.error.details && r.error.details.failures;
    if (Array.isArray(list) && list.length) {
      const by = {};
      for (const f of list) by[f.influencerId] = f.message;
      setFailures(by);
      return;
    }
    show((r.error && r.error.message) || COPY.saveFailed);
  }
  async function removeFailedAndSend() {
    removeCreators(setId, failedIds);
    setFailures({});
    setTick(x => x + 1);
    if (!getDraft(setId).creators.length) { show(MSG5.NOBODY_PICKED); return; }
    await send();
  }

  return (
    <View style={base.screen} testID="review-send">
      <Header title={R.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 140 }}>
        <Stepper5 text={R.all(draft.creators.length)} />
        <LockedSetCard5 set={draft.set} showCutoff />
        {failedIds.length ? <View testID="failed-banner"><Banner title={R.failedTitle(failedIds.length)} body={R.failedBody} /></View>
          : belowCount ? <View style={s.warn} testID="below-banner"><Text style={s.warnText}>{R.belowMany(belowCount)}</Text></View> : null}
        {draft.creators.map((c, i) => (
          <ReviewRow5 key={c.id} name={c.name} avatarUrl={c.avatarUrl} line={summaryLine(goal, draft.terms[c.id] || {})}
            source={c.sourceGroupName || null} below={(warnings[c.id] || []).length > 0} error={failures[c.id]}
            onPress={() => navigation.navigate('BrandCreatorTerms', { campaignId, setId, index: i })} testID={`review-row-${c.id}`} />
        ))}
        <Text style={s.hint}>{R.hint(draft.set.cutoff)}</Text>
      </ScrollView>
      <View style={s.footer}>
        {failedIds.length ? <View style={{ marginBottom: 8 }}><SecondaryButton label={R.removeAndSend(failedIds.length)} onPress={removeFailedAndSend} testID="remove-and-send" /></View> : null}
        <PrimaryButton label={R.send(draft.creators.length)} onPress={send} busy={busy} busyLabel="Sending" disabled={!draft.creators.length || failedIds.length > 0} testID="send-invitations" />
      </View>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 14, padding: 0 },
  warn: { borderRadius: 12, padding: 10, backgroundColor: T.state.yourMove.bg, marginBottom: 8 },
  warnText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.yourMove.fg, lineHeight: 17 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
