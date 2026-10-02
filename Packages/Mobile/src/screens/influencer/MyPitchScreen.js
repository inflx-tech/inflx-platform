/**
 * Item 8 — one of her pitches, as she reads it back (T4's sent state, T14).
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * What she sent, what state it is in, and the one sentence that state has to
 * say. Withdrawing is here rather than on the list, because taking something
 * back should take one deliberate step more than looking at it.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { SecondaryButton, DangerButton } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { KV5 } from '../../components/invitations/bits5';
import { CooldownBox8 } from '../../components/pitch/bits8';
import { WithdrawPitchSheet8 } from '../../components/pitch/sheets8';
import { C8, deliverablesShort } from '../../components/pitch/copy8';
import { Header } from '../brand/BrandPitchSettingsScreen';

export default function MyPitchScreen({ navigation, route }) {
  const { pitchId } = route.params || {};
  const [p, setP] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.myPitch(pitchId);
    if (!r || !r.success) { setStatus('error'); return; }
    setP(r.data.pitch);
    setStatus('ready');
  }, [pitchId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function withdraw() {
    setBusy(true);
    const r = await influencerApi.withdrawPitch(pitchId);
    setBusy(false);
    setSheet(null);
    if (!r || !r.success) { show((r && r.error && r.error.message) || 'That did not go through.'); load(); return; }
    setP(r.data.pitch);
  }

  // ui-walk-fixes D3 — a pushed screen has no bottom tabs, so it carries its own way back, in
  // every state. The bar names who the pitch is with, as the pitch conversation's bar does.
  const back = () => navigation.goBack();
  const title = p && p.brand ? p.brand.name : '';
  if (status === 'loading') return <View style={s.page}><Header title={title} onBack={back} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={s.page}><Header title={title} onBack={back} /><LoadError onRetry={load} /></View>;

  const open = ['waiting', 'talking'].includes(p.group);
  const selling = p.goal === 'conversion' || p.goal === 'hybrid';
  const paying = p.goal === 'engagement' || p.goal === 'hybrid';

  return (
    <View style={s.page}>
      <Header title={title} onBack={back} />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.name}>{p.brand.name}</Text>

        {p.line ? (
          <View style={[s.state, p.group === 'agreed' ? s.stateOk : null]} testID="my-pitch-line">
            <Text style={[s.stateText, p.group === 'agreed' ? s.stateTextOk : null]}>{p.line}</Text>
          </View>
        ) : null}
        {p.cooldownLine ? <CooldownBox8 text={p.cooldownLine} testID="my-pitch-cooldown" /> : null}

        <View style={s.card} testID="my-pitch-terms">
          <Text style={s.cardHd}>{C8.form.reviewHead(p.brand.name)}</Text>
          <KV5 k={C8.form.lblAim} v={p.aimLabel} />
          {paying || selling ? <KV5 k={paying && selling ? C8.form.lblFee : paying ? C8.form.lblFee : C8.form.lblCommission} v={p.termsLine} /> : null}
          {p.goal === 'engagement' && p.terms.deliverables ? <KV5 k={C8.form.lblPost} v={deliverablesShort(p.terms.deliverables)} /> : null}
          {p.proposedGoLiveDate ? <KV5 k={C8.form.lblDate} v={p.proposedGoLiveDate} /> : null}
          {p.modeLabel ? <KV5 k={C8.form.lblMode} v={p.modeLabel} /> : null}
        </View>

        {p.message ? <Text style={s.quote}>“{p.message}”</Text> : null}

        {p.negotiation && p.negotiation.open ? (
          <SecondaryButton label={C8.mine.openThread} onPress={() => navigation.navigate('PitchThread', { pitchId })} testID="my-pitch-thread" />
        ) : null}
        {open ? (
          <DangerButton label={C8.mine.withdraw} onPress={() => setSheet('withdraw')} testID="my-pitch-withdraw" />
        ) : null}
      </ScrollView>

      <WithdrawPitchSheet8 visible={sheet === 'withdraw'} busy={busy} onWithdraw={withdraw} onClose={() => setSheet(null)} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.bg },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  name: { fontFamily: fonts.heading, fontSize: 20, color: T.ink },
  state: { backgroundColor: T.surface, borderRadius: 10, padding: 11 },
  stateOk: { backgroundColor: T.state.active.bg },
  stateText: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 19 },
  stateTextOk: { color: T.state.active.fg },
  card: { backgroundColor: T.surface, borderRadius: 14, padding: 12 },
  cardHd: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 4 },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 20, fontStyle: 'italic' },
});
