/**
 * Item 10 — asking for another time (V6), and the brand's "suggest another time".
 * Contract: features/item10-store-visit · rules v1.24 §11.1
 *
 * Item 6's counter form with a single field in the snapshot. The same admin round limit as every
 * other negotiation — not a separate "two rounds" hidden in the shoot code. Only the time can
 * change; the branch and the posting date came from the set.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, brandApi } from '../../services/api';
import { PrimaryButton, FieldError } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { TextField4 } from '../../components/campaigns/bits4';
import { RoundPill6, ChangeLine6 } from '../../components/negotiation/bits6';
import { TimePicker10 } from '../../components/shoot/bits10';
import { C10, MSG10, whenShort10 } from '../../components/shoot/copy10';

export default function ShootCounterScreen({ navigation, route }) {
  const { campaignId, setId, ciId, side = 'influencer' } = route?.params || {};
  const brandSide = side === 'brand';
  const [status, setStatus] = useState('loading');
  const [sh, setSh] = useState(null);
  const [at, setAt] = useState(null);
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = brandSide ? await brandApi.getShoot(campaignId, setId, ciId) : await influencerApi.myShoot(ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    setStatus('ready');
  }, [campaignId, setId, ciId, brandSide]);
  useEffect(() => { load(); }, [load]);

  const title = brandSide ? C10.counter.titleBrand : C10.counter.title;
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const thread = sh.thread || {};
  const neg = thread.negotiation || {};
  const round = (neg.countersUsed || 0) + 1;
  const limit = neg.roundLimit || 2;
  const current = (thread.current && thread.current.visitAt) || (sh.plan && sh.plan.visitAt) || null;

  function send() {
    const e = {};
    if (!at) e.visitAt = MSG10.TIME_REQUIRED;
    else if (new Date(at).getTime() <= Date.now()) e.visitAt = MSG10.TIME_IN_PAST;
    else if (current && new Date(at).getTime() === new Date(current).getTime()) e.visitAt = MSG10.NOTHING_CHANGED;   // refused before it leaves the phone
    if (note.length > 300) e.note = 'Keep it under 300 characters.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const body = { visitAt: at, note: note.trim() || undefined };
    const call = brandSide ? brandApi.counterShootTime(campaignId, setId, ciId, body) : influencerApi.counterMyShootTime(ciId, body);
    call.then((r) => {
      setSaving(false);
      if (!r || !r.success) {
        const err = (r && r.error) || {};
        setErrs(err.field === 'visitAt' ? { visitAt: err.message } : { form: err.message || COPY.saveFailed });
        return;
      }
      navigation.replace(brandSide ? 'BrandShootThread' : 'ShootThread', { campaignId, setId, ciId, toast: C10.counter.sent });
    });
  }

  return (
    <View style={base.screen} testID="shoot-counter">
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={s.crumb}>{String(brandSide ? sh.creator.name : sh.brand.name).toUpperCase()}</Text>
        <RoundPill6 round={round} of={limit} />
        <TimePicker10 value={at} onChange={(v) => { setAt(v); setErrs((x) => ({ ...x, visitAt: undefined, form: undefined })); }} maxDay={sh.postingDate} testID="counter-picker" />
        <ChangeLine6 label={C10.counter.theyAsked(current).split(' ')[0] === 'They' ? 'They asked for' : 'Time'} from={whenShort10(current)} to={at ? whenShort10(at) : '—'} testID="change-time" />
        <FieldError text={errs.visitAt} />
        <TextField4 label={C10.counter.why} value={note} onChangeText={(v) => { setNote(v); setErrs((x) => ({ ...x, note: undefined })); }} max={300} multiline error={errs.note} testID="counter-note" />
        <Text style={s.hint} testID="only-time">{C10.counter.onlyTime(sh.postingDate)}</Text>
        <FieldError text={errs.form} />
      </ScrollView>
      <View style={s.bar}>
        <PrimaryButton label={C10.counter.send} icon="send-outline" onPress={send} busy={saving} testID="send-counter" />
      </View>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginTop: 6 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
