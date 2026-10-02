/**
 * Item 8 — one pitch, as the brand reads it (T6, with T7 and T8).
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * Everything needed to decide on one screen: who she is, what she reaches, what
 * she wants, why her, and how long is left.
 *
 * The three buttons are three genuinely different answers, and only one of them
 * is reversible-by-waiting. So each one says its consequence on its own sheet
 * before it happens: accepting agrees the money and starts NO collaboration,
 * rejecting starts a cooldown with a date, countering opens item 6's thread.
 *
 * ui-walk-fixes (board E, frame E7): the three answers are the shared AnswerBar,
 * drawn in the page — "Accept her terms", then Counter and Reject as two equal,
 * level halves (one alone fills the width; with neither there is no row at all).
 * "Open her full profile" is the quiet underlined link the board draws, so it no
 * longer competes with the three answers.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, DangerButton, AnswerBar } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { KV5 } from '../../components/invitations/bits5';
import { MiniStat8, CooldownBox8 } from '../../components/pitch/bits8';
import { AcceptPitchSheet8, RejectPitchSheet8 } from '../../components/pitch/sheets8';
import { C8 } from '../../components/pitch/copy8';
import { Header } from './BrandPitchSettingsScreen';
import useRouteToast, { goBackWithToast } from '../../hooks/useRouteToast';

export default function BrandPitchScreen({ navigation, route }) {
  const { pitchId } = route.params || {};
  const [p, setP] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  // ui-walk-fixes (F8): a pitch rejected from its conversation lands back here, and is told so.
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.pitch(pitchId);
    if (!r || !r.success) { setStatus('error'); return; }
    setP(r.data.pitch);
    setStatus('ready');
  }, [pitchId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function accept() {
    setBusy(true);
    const r = await brandApi.acceptPitch(pitchId);
    setBusy(false);
    setSheet(null);
    if (!r || !r.success) { show((r && r.error && r.error.message) || 'That did not go through.'); load(); return; }
    // She is in the pool now, not in a collaboration. Send the brand where she is.
    // The pool lives on the Campaigns tab — she is waiting for a set, not
    // sitting in a collaboration, and the navigation says so.
    // ui-walk-fixes (board F, frame F8): the pool says so — "{First} is in your pool." The jump
    // used to land there without a word.
    navigation.navigate('CampaignsTab', { screen: 'BrandPool', params: { highlight: r.data.poolEntryId, toast: C8.brand.inPool(p.creator.name) }, initial: false });
  }

  async function reject(reason) {
    setBusy(true);
    const r = await brandApi.rejectPitch(pitchId, { reason });
    setBusy(false);
    setSheet(null);
    if (!r || !r.success) { show((r && r.error && r.error.message) || 'That did not go through.'); load(); return; }
    // ui-walk-fixes (F8): back where the brand came from, which says "Pitch rejected." It used to
    // go back silently.
    goBackWithToast(navigation, C8.brand.rejected);
  }

  // ui-walk-fixes D3 — a pushed screen has no bottom tabs, so it carries its own way back, in
  // every state (item 8 board T6 draws this bar: her name, and the back arrow).
  const back = () => navigation.goBack();
  const title = p && p.creator ? p.creator.name : '';
  if (status === 'loading') return <View style={s.page}><Header title={title} onBack={back} /><Skeleton rows={7} />{toast}</View>;
  if (status === 'error') return <View style={s.page}><Header title={title} onBack={back} /><LoadError onRetry={load} />{toast}</View>;

  const selling = p.goal === 'conversion' || p.goal === 'hybrid';
  const paying = p.goal === 'engagement' || p.goal === 'hybrid';
  const can = p.can || {};

  return (
    <View style={s.page}>
      <Header title={title} onBack={back} />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.name} testID="pitch-creator-name">{p.creator.name}</Text>
        <Text style={s.sub}>{[p.creator.niche, p.creator.city].filter(Boolean).join(' · ')}</Text>

        <MiniStat8 numbers={p.numbers} testID="pitch-ministat" />

        <View style={s.card} testID="pitch-terms">
          <Text style={s.cardHd}>{C8.brand.proposing}</Text>
          <KV5 k={C8.brand.lblAim} v={p.aimLabel} />
          {paying && p.terms.fee != null ? <KV5 k={C8.brand.lblFee} v={p.termsLine} /> : null}
          {selling && p.terms.commissionPct != null && !paying ? <KV5 k={C8.brand.lblCommission} v={p.termsLine} /> : null}
          {paying && selling ? <KV5 k={C8.brand.lblCommission} v={p.termsLine} /> : null}
          {p.proposedGoLiveDate ? <KV5 k={C8.brand.lblDate} v={p.proposedGoLiveDate} /> : null}
          {p.modeLabel ? <KV5 k={C8.brand.lblMode} v={p.modeLabel} /> : null}
        </View>

        {p.message ? <Text style={s.quote} testID="pitch-message">“{p.message}”</Text> : null}

        {p.replyBy ? <CooldownBox8 text={p.replyBy} testID="pitch-replyby" /> : null}

        {/* With nothing allowed (the thread is waiting on her) the bar draws nothing, so the
            page's 12 gap is not left behind by an empty row. */}
        <AnswerBar
          testID="pitch-actions"
          main={can.accept
            ? <PrimaryButton label={C8.brand.acceptTerms} onPress={() => setSheet('accept')} testID="pitch-accept" />
            : null}
        >
          {can.counter
            ? <SecondaryButton strong icon="undo-variant" label={C8.brand.counter} onPress={() => navigation.navigate('BrandPitchThread', { pitchId })} testID="pitch-counter" />
            : null}
          {can.reject
            ? <DangerButton outline label={C8.brand.reject} onPress={() => setSheet('reject')} testID="pitch-reject" />
            : null}
        </AnswerBar>

        <TouchableOpacity
          style={s.link}
          accessibilityRole="button"
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.navigate('BrandCreatorProfile', { influencerId: p.creator.id })}
          testID="pitch-full-profile"
        >
          <Text style={s.linkText}>{C8.brand.fullProfile}</Text>
        </TouchableOpacity>
      </ScrollView>

      <AcceptPitchSheet8 visible={sheet === 'accept'} pitch={p} busy={busy} onAccept={accept} onClose={() => setSheet(null)} />
      <RejectPitchSheet8 visible={sheet === 'reject'} pitch={p} busy={busy} onReject={reject} onClose={() => setSheet(null)} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.bg },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  name: { fontFamily: fonts.heading, fontSize: 20, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink3, marginTop: -8 },
  card: { backgroundColor: T.surface, borderRadius: 14, padding: 12 },
  cardHd: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 4 },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 20, fontStyle: 'italic' },
  // The board's `.b-txt`: ink, underlined, sitting at the left under the three answers.
  link: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 2 },
  linkText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, textDecorationLine: 'underline' },
});
