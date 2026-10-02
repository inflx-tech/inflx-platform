/**
 * BrandReviewSendScreen — I8: the last look. The locked set card with "Replies close", the
 * below-minimum warning, one row per creator (tap to go back to her terms), and "Send {n}
 * invitations" — one all-or-nothing action. When the server names creators that failed, the
 * rows are marked and one button offers "Remove {n} and send the rest".
 * Contract: features/item5-invitations · prompt §6.6 · APPROVAL.md Q2
 *
 * ui-walk-fixes board C: the Send strip is part of the column, under the list (BottomBar) — it no
 * longer floats over the last rows; the toast floats just above it.
 * ui-walk-fixes D2 (wave-2 review): the banner above a refused batch says "Fix them" only when
 * something CAN be fixed. A creator refused by one of her own invitation rules cannot be fixed
 * by changing her terms, so the banner then says to remove her instead.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, Banner } from '../../components/settings/primitives';
import { useToast } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { Stepper5, LockedSetCard5, ReviewRow5 } from '../../components/invitations/bits5';
import { C5, MSG5 } from '../../components/invitations/copy5';
import { getDraft, clearDraft, clearBasket, removeCreators, toServer, summaryLine, validateLocal, endsSoonDays } from '../../components/invitations/draft5';

const R = C5.review;

export default function BrandReviewSendScreen({ navigation, route }) {
  const { campaignId, setId } = route?.params || {};
  const [, setTick] = useState(0);
  const [warnings, setWarnings] = useState({});
  const [failures, setFailures] = useState({});
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast({ inFlow: true });
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
  // A refusal that carries `why` came from one of her own rules (see send() below): her terms are
  // not the problem and nothing on them can be changed to get her in. The banner must not say
  // "Fix them" for those.
  const cantFix = failedIds.filter(id => failures[id].why).length;
  const failedBody = !cantFix ? R.failedBody : cantFix === failedIds.length ? R.failedBodyRemove : R.failedBodySome;

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
      // ui-walk-fixes D2: a creator refused by one of her own invitation rules arrives with the
      // short reason (`label`) beside the sentence (`message`). Her row prints the short reason,
      // as the picker did, and says the sentence when tapped. Every other refusal (bad terms, a
      // duplicate) has no label: the row prints its message and still opens her terms to fix it.
      const by = {};
      for (const f of list) by[f.influencerId] = { line: f.label || f.message, why: f.label ? (f.message || f.label) : null };
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

  const soonList = draft.creators.map(c => endsSoonDays(draft.terms[c.id] || {})).filter(d => d != null);
  const soonCount = soonList.length;
  const soonDays = soonCount ? Math.min(...soonList) : 0;
  return (
    <View style={base.screen} testID="review-send">
      <Header title={R.title} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the list scrolls in the room above the Send strip; nothing floats over it. */}
      <FormArea>
      <ScrollView style={s.fill} contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
        <Stepper5 text={R.all(draft.creators.length)} />
        <LockedSetCard5 set={draft.set} showCutoff />
        {failedIds.length ? <View testID="failed-banner"><Banner title={R.failedTitle(failedIds.length)} body={failedBody} /></View>
          : belowCount ? <View style={s.warn} testID="below-banner"><Text style={s.warnText}>{R.belowMany(belowCount)}</Text></View> : null}
        {/* creator-terms-v2 (T7): an offer ending within 7 days after posting */}
        {!failedIds.length && soonCount ? <View style={s.warn} testID="ends-soon-banner"><Text style={s.warnText}>⚠ {R.endsSoonMany(soonCount, soonDays)}</Text></View> : null}
        {draft.creators.map((c, i) => (
          <ReviewRow5 key={c.id} name={c.name} avatarUrl={c.avatarUrl} line={summaryLine(goal, draft.terms[c.id] || {})}
            source={c.sourceGroupName || null} below={(warnings[c.id] || []).length > 0} endsSoon={endsSoonDays(draft.terms[c.id] || {}) != null} error={failures[c.id] ? failures[c.id].line : undefined}
            onPress={() => (failures[c.id] && failures[c.id].why ? show(failures[c.id].why) : navigation.navigate('BrandCreatorTerms', { campaignId, setId, index: i }))} testID={`review-row-${c.id}`} />
        ))}
        <Text style={s.hint}>{R.hint(draft.set.cutoff)}</Text>
      </ScrollView>
      {toast}
      </FormArea>
      {/* The strip keeps its children 8 apart, and the outline button drops its own top gap in it. */}
      <BottomBar testID="review-send-bar">
        {failedIds.length ? <SecondaryButton label={R.removeAndSend(failedIds.length)} onPress={removeFailedAndSend} testID="remove-and-send" /> : null}
        <PrimaryButton label={R.send(draft.creators.length)} onPress={send} busy={busy} busyLabel="Sending" disabled={!draft.creators.length || failedIds.length > 0} testID="send-invitations" />
      </BottomBar>
    </View>
  );
}

const s = StyleSheet.create({
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 14, padding: 0 },
  warn: { borderRadius: 12, padding: 10, backgroundColor: T.state.yourMove.bg, marginBottom: 8 },
  warnText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.yourMove.fg, lineHeight: 17 },
  // The list fills the box above the Send strip.
  fill: { flex: 1 },
});
