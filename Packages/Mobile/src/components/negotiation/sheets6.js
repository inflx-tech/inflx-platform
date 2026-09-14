/**
 * Item 6 — the sheets: what would you like to change (N1), the brand's counter back (N8), the
 * brand declining a counter (N9), and the confirm that spells out a move (N11).
 * Contract: features/item6-negotiation
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, SwitchRow, Chip, FieldError } from '../settings/primitives';
import { NumberField } from '../../screens/brand/BrandPitchSettingsScreen';
import { TextField4 } from '../campaigns/bits4';
import { MinBox5 } from '../invitations/bits5';
import { DeliverablesEditor5 } from '../invitations/bits5';
import { USAGE_DURATIONS, USAGE_PLACES, MSG5 } from '../invitations/copy5';
import { RoundPill6, ChangeLine6 } from './bits6';
import { C6, MSG6, TERM_LABEL, termValue, NEGOTIABLE, snapshotLine6, first, rupees6, fmtPct6 } from './copy6';

/* ───────────────────────────────────────────────────────────── N1 */

/** Two things hide behind one word, so she picks which. */
export function CounterChoiceSheet6({ visible, roundLimit, countersUsed, canMoveRequest, onMoney, onMove, onClose }) {
  const [choice, setChoice] = useState('money');
  useEffect(() => { if (visible) setChoice('money'); }, [visible]);
  const Option = ({ k, title, sub, testID }) => (
    <TouchableOpacity style={[s.option, choice === k && s.optionOn]} onPress={() => setChoice(k)} testID={testID}>
      <View style={{ flex: 1 }}><Text style={s.optionT}>{title}</Text><Text style={s.optionS}>{sub}</Text></View>
      <View style={[s.radio, choice === k && s.radioOn]}>{choice === k ? <View style={s.radioDot} /> : null}</View>
    </TouchableOpacity>
  );
  return (
    <Sheet visible={visible} onClose={onClose} testID="counter-choice-sheet">
      <Text style={s.title}>{C6.choice.title}</Text>
      <Option k="money" title={C6.choice.money} sub={C6.choice.moneySub} testID="choice-money" />
      {canMoveRequest ? <Option k="move" title={C6.choice.date} sub={C6.choice.dateSub} testID="choice-move" /> : null}
      <Text style={s.hint} testID="counters-left">{C6.choice.left(roundLimit, countersUsed)}</Text>
      <View style={{ height: 12 }} />
      <PrimaryButton label={C6.choice.continue} onPress={() => (choice === 'money' ? onMoney() : onMove())} testID="choice-continue" />
    </Sheet>
  );
}

/* ───────────────────────────────────────────────────────────── N8 */

/**
 * The brand counters back. Same fields as her counter, the change line against what she asked,
 * the minimum warning that never blocks, and the last-counter label before it is sent.
 */
export function BrandCounterSheet6({ visible, thread, minimums, onSend, onClose }) {
  const goal = thread ? thread.goal : 'conversion';
  const f = first(thread && thread.creator ? thread.creator.name : '');
  const current = (thread && thread.current) || {};
  const [terms, setTerms] = useState({});
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setTerms({
      commissionPct: current.commissionPct != null ? String(current.commissionPct) : '',
      fee: current.fee != null ? String(current.fee) : '',
      deliverables: (current.deliverables || []).map(d => ({ ...d })),
      usage: current.usageRights && current.usageRights.on ? { on: true, durationDays: current.usageRights.durationDays, places: [...(current.usageRights.places || [])] } : { on: false, durationDays: 30, places: [] },
    });
    setNote(''); setErrs({}); setBusy(false);
  }, [visible]); // eslint-disable-line

  const roundLimit = thread && thread.negotiation ? thread.negotiation.roundLimit : 2;
  const used = thread && thread.negotiation ? thread.negotiation.countersUsed : 0;
  const isLast = used + 1 >= roundLimit;
  const proposed = {
    commissionPct: terms.commissionPct === '' ? null : Number(terms.commissionPct),
    fee: terms.fee === '' ? null : Number(terms.fee),
    deliverables: terms.deliverables, usageRights: terms.usage && terms.usage.on ? { on: true, durationDays: terms.usage.durationDays, places: terms.usage.places } : null,
  };
  const belowMin = minimums && minimums.commissionPct != null && proposed.commissionPct != null && proposed.commissionPct < Number(minimums.commissionPct);
  const belowFee = minimums && minimums.fee != null && proposed.fee != null && proposed.fee < Number(minimums.fee);

  function send() {
    const e = {};
    if (goal !== 'engagement') { const c = Number(terms.commissionPct); if (!(c > 0 && c <= 100)) e.commissionPct = terms.commissionPct === '' ? MSG5.COMMISSION_REQUIRED : MSG5.COMMISSION_RANGE; }
    if (goal !== 'conversion') { const v = Number(terms.fee); if (!(v > 0) || !Number.isInteger(v)) e.fee = goal === 'hybrid' ? MSG5.HYBRID_FEE : MSG5.FEE_REQUIRED; }
    if (goal === 'engagement') {
      if (!(terms.deliverables || []).length) e.deliverables = MSG5.DELIVERABLES_EMPTY;
      if (terms.usage && terms.usage.on && !(terms.usage.places || []).length) e.usage = MSG5.USAGE_PLACE;
    }
    if ((note || '').length > 200) e.note = MSG6.BRAND_REASON_LONG;
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    onSend({ terms: proposed, note: note.trim() || undefined }).finally(() => setBusy(false));
  }

  if (!thread) return null;
  return (
    <Sheet visible={visible} onClose={onClose} testID="brand-counter-sheet">
      <Text style={s.eyebrow}>{`${(thread.creator.name || '').toUpperCase()} · ${(thread.setName || '').toUpperCase()}`}</Text>
      <Text style={s.title}>{C6.counter.brandTitle}</Text>
      <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
        <RoundPill6 round={used + 1} of={roundLimit} last={isLast} />
        {goal !== 'engagement' ? (
          <View style={s.field}>
            <Text style={s.label}>{C6.counter.commission} <Text style={{ color: T.danger }}>*</Text></Text>
            <NumberField value={String(terms.commissionPct ?? '')} onChangeText={(v) => { setTerms(t => ({ ...t, commissionPct: v })); setErrs(x => ({ ...x, commissionPct: undefined })); }} suffix="%" decimal testID="brand-commission" />
            <ChangeLine6 label={C6.counter.sheAsked(f)} from={fmtPct6(current.commissionPct)} to={fmtPct6(proposed.commissionPct) || '—'} testID="brand-change-commission" />
            {belowMin ? <MinBox5 text={C6.counter.belowHer(f, fmtPct6(minimums.commissionPct))} testID="brand-below-min" /> : null}
            <FieldError text={errs.commissionPct} />
          </View>
        ) : null}
        {goal !== 'conversion' ? (
          <View style={s.field}>
            <Text style={s.label}>{goal === 'hybrid' ? C6.counter.fixedFee : C6.counter.fee} <Text style={{ color: T.danger }}>*</Text></Text>
            <NumberField value={String(terms.fee ?? '')} onChangeText={(v) => { setTerms(t => ({ ...t, fee: v })); setErrs(x => ({ ...x, fee: undefined })); }} prefix="₹" testID="brand-fee" />
            <ChangeLine6 label={C6.counter.sheAsked(f)} from={rupees6(current.fee)} to={rupees6(proposed.fee) || '—'} testID="brand-change-fee" />
            {belowFee ? <MinBox5 text={C6.counter.belowHer(f, rupees6(minimums.fee))} testID="brand-below-min-fee" /> : null}
            <FieldError text={errs.fee} />
          </View>
        ) : null}
        {goal === 'engagement' ? (
          <View style={s.field}>
            <Text style={s.label}>{C6.counter.delivers} <Text style={{ color: T.danger }}>*</Text></Text>
            <DeliverablesEditor5 rows={terms.deliverables || []} onChange={(rows) => { setTerms(t => ({ ...t, deliverables: rows })); setErrs(x => ({ ...x, deliverables: undefined })); }} error={errs.deliverables} testID="brand-deliverables" />
            <SwitchRow label={C6.counter.reuse} value={!!(terms.usage && terms.usage.on)} onValueChange={(on) => setTerms(t => ({ ...t, usage: { ...t.usage, on } }))} testID="brand-usage-switch" />
            {terms.usage && terms.usage.on ? (
              <View>
                <View style={s.chips}>{USAGE_DURATIONS.map(([d, l]) => <Chip key={String(d)} label={l} selected={terms.usage.durationDays === d} onPress={() => setTerms(t => ({ ...t, usage: { ...t.usage, durationDays: d } }))} testID={`brand-usage-${d}`} />)}</View>
                <View style={s.chips}>{USAGE_PLACES.map(([p, l]) => { const on = (terms.usage.places || []).includes(p); return <Chip key={p} label={l} selected={on} onPress={() => setTerms(t => ({ ...t, usage: { ...t.usage, places: on ? t.usage.places.filter(x => x !== p) : [...t.usage.places, p] } }))} testID={`brand-place-${p}`} />; })}</View>
                <FieldError text={errs.usage} />
              </View>
            ) : null}
          </View>
        ) : null}
        <TextField4 label={C6.counter.whyBrand} value={note} onChangeText={setNote} max={200} multiline error={errs.note} testID="brand-counter-note" />
        {isLast ? <Text style={s.hint} testID="last-counter-hint">{C6.counter.lastHintBrand(f)}</Text> : null}
      </ScrollView>
      <View style={{ height: 10 }} />
      <PrimaryButton label={isLast ? C6.counter.sendLast : C6.counter.send} onPress={send} busy={busy} testID="brand-send-counter" />
    </Sheet>
  );
}

/* ───────────────────────────────────────────────────────────── N9 */

export function DeclineCounterSheet6({ visible, creatorName, onDecline, onClose, busy }) {
  const f = first(creatorName);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setNote(''); setErr(''); } }, [visible]);
  function go() {
    if (note.length > 200) { setErr(MSG6.BRAND_REASON_LONG); return; }
    onDecline({ note: note.trim() || undefined });
  }
  return (
    <Sheet visible={visible} onClose={onClose} testID="decline-counter-sheet">
      <Text style={s.title}>{C6.declineCounter.title(f)}</Text>
      <Text style={s.body}>{C6.declineCounter.body(f)}</Text>
      <TextField4 label={C6.declineCounter.why} value={note} onChangeText={setNote} max={200} multiline hint={C6.declineCounter.whyHint} error={err} testID="decline-counter-note" />
      <View style={{ height: 8 }} />
      <DangerButton label={busy ? '…' : C6.declineCounter.decline} onPress={busy ? () => {} : go} testID="decline-counter-confirm" />
      <SecondaryButton label={C6.declineCounter.keep} onPress={onClose} />
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────── N11 */

/** The confirm spells out the three things that happen, because "agree" says none of them. */
export function MoveConfirmSheet6({ visible, thread, onConfirm, onClose, busy }) {
  if (!thread || !thread.moveRequest) return null;
  const f = first(thread.creator.name);
  const wants = thread.moveRequest.goLiveDate;
  const termsWords = snapshotLine6(thread.goal, thread.current);
  return (
    <Sheet visible={visible} onClose={onClose} testID="move-confirm-sheet">
      <Text style={s.title}>{C6.moveAnswer.confirmTitle(f)}</Text>
      <Text style={s.what}>{C6.moveAnswer.what}</Text>
      <View style={s.card}>
        <View style={s.kv}><Text style={s.k}>{C6.moveAnswer.rowTerms(termsWords)}</Text><Text style={s.vGood}>{C6.moveAnswer.rowTermsValue}</Text></View>
        <View style={s.kv}><Text style={s.k}>{C6.moveAnswer.rowInvitation}</Text><Text style={s.v}>{C6.moveAnswer.rowInvitationValue}</Text></View>
        <View style={s.kv}><Text style={s.k}>{C6.moveAnswer.rowPool}</Text><Text style={s.v}>{C6.moveAnswer.rowPoolValue(wants)}</Text></View>
      </View>
      <Text style={s.hint}>{wants ? C6.moveAnswer.confirmBody(f, wants) : C6.moveAnswer.confirmBodyMode(f)}</Text>
      <View style={{ height: 12 }} />
      <PrimaryButton label={C6.moveAnswer.move} onPress={onConfirm} busy={busy} testID="move-confirm" />
      <SecondaryButton label={C6.moveAnswer.notNow} onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 4 },
  title: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, marginBottom: 8 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 19, marginBottom: 12 },
  what: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink2, marginBottom: 6 },
  card: { backgroundColor: T.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 10 },
  k: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, flexShrink: 1 },
  v: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', flexShrink: 1 },
  vGood: { fontFamily: fonts.sansBold, fontSize: 13, color: T.state.active.fg, textAlign: 'right' },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 18, marginTop: 10 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { borderColor: T.ink, backgroundColor: T.surface },
  optionT: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  optionS: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  radioOn: { borderColor: T.ink },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.ink },
  field: { marginBottom: 12 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
});
