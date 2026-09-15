/**
 * Item 8 — countering on a pitch (T9's Counter button, T10's Counter back).
 * Contract: features/item8-pitch · rules v1.21 §8, §7B
 *
 * Item 6's counter form, pointed at the pitch thread. Every negotiable term for
 * the Aim in one go, each with a change line against what is on the table, the
 * round pill, an optional note — and the same refusal, in the server's words,
 * when nothing actually changed.
 *
 * What is NOT here is the locked card. An invitation has a set behind it whose
 * date, mode and city cannot be moved; a pitch has no set yet, which is the
 * whole reason it goes to the pool rather than into a collaboration. Showing a
 * locked card with nothing in it would be worse than showing none.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, brandApi } from '../../services/api';
import { PrimaryButton, FieldError } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, NumberField, s as base } from '../brand/BrandPitchSettingsScreen';
import { TextField4 } from '../../components/campaigns/bits4';
import { DeliverablesEditor5 } from '../../components/invitations/bits5';
import { MSG5, deliverablesShort } from '../../components/invitations/copy5';
import { RoundPill6, ChangeLine6 } from '../../components/negotiation/bits6';
import { C6, MSG6, rupees6, fmtPct6, snapshotLine6 } from '../../components/negotiation/copy6';

export default function PitchCounterScreen({ navigation, route }) {
  const { pitchId, side = 'influencer' } = route?.params || {};
  const brandSide = side === 'brand';
  const [status, setStatus] = useState('loading');
  const [thread, setThread] = useState(null);
  const [terms, setTerms] = useState({ commissionPct: '', fee: '', deliverables: [] });
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = brandSide ? await brandApi.pitchThread(pitchId) : await influencerApi.myPitchThread(pitchId);
    if (!r || !r.success) { setStatus('error'); return; }
    const t = r.data.thread;
    setThread(t);
    const c = t.current || {};
    setTerms({
      commissionPct: c.commissionPct != null ? String(c.commissionPct) : '',
      fee: c.fee != null ? String(c.fee) : '',
      deliverables: (c.deliverables || []).map((d) => ({ ...d })),
    });
    setStatus('ready');
  }, [pitchId, brandSide]);
  useEffect(() => { load(); }, [load]);

  if (status === 'loading') return <View style={base.screen}><Header title={C6.counter.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C6.counter.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const goal = thread.goal;
  const neg = thread.negotiation || {};
  const round = (neg.countersUsed || 0) + 1;
  const limit = neg.roundLimit || 2;
  const left = Math.max(0, limit - round);
  const current = thread.current || {};
  const them = brandSide ? thread.creator.name : thread.brand.name;
  const proposed = {
    commissionPct: terms.commissionPct === '' ? null : Number(terms.commissionPct),
    fee: terms.fee === '' ? null : Number(terms.fee),
    deliverables: terms.deliverables,
  };

  function send() {
    const e = {};
    if (goal !== 'engagement') {
      const c = Number(terms.commissionPct);
      if (terms.commissionPct === '') e.commissionPct = MSG5.COMMISSION_REQUIRED;
      else if (!(c > 0 && c <= 100)) e.commissionPct = MSG5.COMMISSION_RANGE;
    }
    if (goal !== 'conversion') {
      const v = Number(terms.fee);
      if (!(v > 0) || !Number.isInteger(v)) e.fee = goal === 'hybrid' ? MSG5.HYBRID_FEE : MSG5.FEE_REQUIRED;
    }
    if (goal === 'engagement') {
      const rows = terms.deliverables || [];
      if (!rows.length) e.deliverables = MSG5.DELIVERABLES_EMPTY;
      else {
        const seen = new Set();
        for (const r of rows) {
          const n = Number(r.count);
          if (!Number.isInteger(n) || n < 1 || n > 20) { e.deliverables = MSG5.DELIVERABLE_COUNT; break; }
          if (seen.has(r.type)) { e.deliverables = MSG5.DELIVERABLE_DUP; break; }
          seen.add(r.type);
        }
      }
    }
    if (note.length > 300) e.note = MSG6.NOTE_LONG;
    setErrs(e);
    if (Object.keys(e).length) return;
    // A counter that changes nothing is refused before it leaves the phone.
    if (snapshotLine6(goal, proposed) === snapshotLine6(goal, current)) {
      setErrs({ form: MSG6.NOTHING_CHANGED });
      return;
    }
    setSaving(true);
    const body = { ...proposed, scope: goal === 'engagement' ? undefined : 'store', note: note.trim() || undefined };
    const call = brandSide ? brandApi.counterPitch(pitchId, body) : influencerApi.counterMyPitch(pitchId, body);
    call.then((r) => {
      setSaving(false);
      if (!r || !r.success) {
        const err = (r && r.error) || {};
        setErrs(err.field ? { [err.field]: err.message } : { form: err.message || COPY.saveFailed });
        return;
      }
      navigation.replace(brandSide ? 'BrandPitchThread' : 'PitchThread', { pitchId, toast: C6.counter.sent });
    });
  }

  return (
    <View style={base.screen} testID={`pitch-counter-${goal}`}>
      <Header title={C6.counter.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <RoundPill6 round={round} of={limit} />

        {goal !== 'engagement' ? (
          <View style={s.field}>
            <Text style={s.label}>{C6.counter.commission} <Text style={{ color: T.danger }}>*</Text></Text>
            <NumberField
              value={String(terms.commissionPct)}
              onChangeText={(v) => { setTerms((t) => ({ ...t, commissionPct: v })); setErrs((x) => ({ ...x, commissionPct: undefined, form: undefined })); }}
              suffix="%" decimal testID="pitch-counter-commission"
            />
            <ChangeLine6 label={C6.counter.theirOffer} from={fmtPct6(current.commissionPct)} to={fmtPct6(proposed.commissionPct) || '—'} testID="change-commission" />
            <FieldError text={errs.commissionPct} />
          </View>
        ) : null}

        {goal !== 'conversion' ? (
          <View style={s.field}>
            <Text style={s.label}>{goal === 'hybrid' ? C6.counter.fixedFee : C6.counter.fee} <Text style={{ color: T.danger }}>*</Text></Text>
            <NumberField
              value={String(terms.fee)}
              onChangeText={(v) => { setTerms((t) => ({ ...t, fee: v })); setErrs((x) => ({ ...x, fee: undefined, form: undefined })); }}
              prefix="₹" testID="pitch-counter-fee"
            />
            <ChangeLine6 label={C6.counter.theirOffer} from={rupees6(current.fee)} to={rupees6(proposed.fee) || '—'} testID="change-fee" />
            <FieldError text={errs.fee} />
          </View>
        ) : null}

        {goal === 'engagement' ? (
          <View style={s.field}>
            <Text style={s.label}>{C6.counter.delivers} <Text style={{ color: T.danger }}>*</Text></Text>
            <DeliverablesEditor5
              rows={terms.deliverables}
              onChange={(rows) => { setTerms((t) => ({ ...t, deliverables: rows })); setErrs((x) => ({ ...x, deliverables: undefined, form: undefined })); }}
              error={errs.deliverables}
              testID="pitch-counter-deliverables"
            />
            <ChangeLine6 label={C6.counter.theyAsked} from={deliverablesShort(current.deliverables) || '—'} to={deliverablesShort(terms.deliverables) || '—'} testID="change-deliverables" />
          </View>
        ) : null}

        <TextField4 label={C6.counter.why} value={note} onChangeText={(v) => { setNote(v); setErrs((x) => ({ ...x, note: undefined })); }} max={300} multiline error={errs.note} testID="pitch-counter-note" />
        <Text style={s.hint} testID="pitch-counter-hint">{C6.counter.hint(them, left)}</Text>
        <FieldError text={errs.form} />
      </ScrollView>
      <View style={s.bar}>
        <PrimaryButton label={left === 0 ? C6.counter.sendLast : C6.counter.send} onPress={send} busy={saving} testID="send-pitch-counter" />
      </View>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginTop: 6 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
