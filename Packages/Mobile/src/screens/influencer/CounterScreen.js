/**
 * CounterScreen — N2 (Pay for Sale), N3 (Pay for Content), Hybrid: the creator's counter. Every
 * negotiable term for the Aim in one go, each with a change line against what is on the table, the
 * round pill, her own minimum as a reminder, an optional note. What can never be countered stays
 * locked at the top.
 * Contract: features/item6-negotiation · rules v1.18 §7B · prompt §6.2
 *
 * ui-walk-fixes (board C): "Send counter" sits in its own strip under the form (BottomBar), never
 * over it, and the form is a FormScroll — the box she is typing in, with its counter and error
 * line, stays in view above the strip.
 *
 * A REFUSED "SEND COUNTER" IS SHOWN (final review, finding C-3). The button is pressed with the
 * keypad open, when only part of the form is on show; a refusal is drawn under its own box (or on
 * the form line at the very end), which may be out of sight. The form is scrolled to the first
 * line that was refused, top to bottom, with the helper the pop-ups use (useSheetReveal). Nothing
 * is drawn twice, and nothing moves when the line is already on show.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, SwitchRow, Chip, FieldError } from '../../components/settings/primitives';
import { useSheetReveal } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { applyServerError } from '../../utils/serverError';
import { Header, NumberField, s as base } from '../brand/BrandPitchSettingsScreen';
import { TextField4 } from '../../components/campaigns/bits4';
import { DeliverablesEditor5, MinBox5, deliverableRowsError5 } from '../../components/invitations/bits5';
import { USAGE_DURATIONS, USAGE_PLACES, MSG5, deliverablesShort } from '../../components/invitations/copy5';
import { RoundPill6, ChangeLine6, LockedTermsCard6 } from '../../components/negotiation/bits6';
import { C6, MSG6, TERM_LABEL, rupees6, fmtPct6, snapshotLine6 } from '../../components/negotiation/copy6';

/**
 * ui-walk-fixes (wave-2 review, as PitchCounterScreen): the server names a refusal after its own
 * column, not after the box on this screen. One about the deliverables arrives as 'formats_json';
 * filed under that name nothing here draws it. Each goes to the line it is about; anything this
 * screen has no line for is still said on the form line.
 */
const SERVER_FIELD = { formats_json: 'deliverables', agreed_fee: 'fee', commission_pct: 'commissionPct', usage_rights_json: 'usage' };
/** The lines "Send counter" can refuse, in the order the form draws them; 'form' is the line at the end. */
const COUNTER_FIELDS = ['commissionPct', 'fee', 'deliverables', 'usage', 'note', 'form'];

export default function CounterScreen({ navigation, route }) {
  const { ciId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [thread, setThread] = useState(null);
  const [terms, setTerms] = useState({ commissionPct: '', fee: '', deliverables: [], usage: { on: false, durationDays: 30, places: [] } });
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  // Board C: the toast is drawn in the box above the button strip, just above it.
  const { toast, show } = useToast({ inFlow: true });
  // A refused "Send counter" scrolls the form to the first line it refused (see the note at the top).
  // A hook — it must stay above the two early returns below.
  const reveal = useSheetReveal();
  // ui-walk-fixes (board D, frame D6): the page that scrolls, so an opened type list can be moved into
  // view. One node, both users: the deliverables chooser and the scroll to a refused line.
  const scrollRef = reveal.bodyRef;

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.myThread(ciId);
    if (!r.success) { setStatus('error'); return; }
    const t = r.data.thread;
    setThread(t);
    const c = t.current || {};
    setTerms({
      commissionPct: c.commissionPct != null ? String(c.commissionPct) : '',
      fee: c.fee != null ? String(c.fee) : '',
      deliverables: (c.deliverables || []).map(d => ({ ...d })),
      usage: c.usageRights && c.usageRights.on ? { on: true, durationDays: c.usageRights.durationDays, places: [...(c.usageRights.places || [])] } : { on: false, durationDays: 30, places: [] },
    });
    setStatus('ready');
  }, [ciId]);
  useEffect(() => { load(); }, [load]);

  if (status === 'loading') return <View style={base.screen}><Header title={C6.counter.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C6.counter.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const goal = thread.goal;
  const neg = thread.negotiation || {};
  const round = (neg.countersUsed || 0) + 1;
  const limit = neg.roundLimit || 2;
  const left = Math.max(0, limit - round);
  const current = thread.current || {};
  const proposed = {
    commissionPct: terms.commissionPct === '' ? null : Number(terms.commissionPct),
    fee: terms.fee === '' ? null : Number(terms.fee),
    deliverables: terms.deliverables,
    usageRights: terms.usage.on ? { on: true, durationDays: terms.usage.durationDays, places: terms.usage.places } : null,
  };
  const mins = thread.minimums || null; // never sent to a creator; kept for symmetry

  function send() {
    const e = {};
    if (goal !== 'engagement') { const c = Number(terms.commissionPct); if (terms.commissionPct === '') e.commissionPct = MSG5.COMMISSION_REQUIRED; else if (!(c > 0 && c <= 100)) e.commissionPct = MSG5.COMMISSION_RANGE; }
    if (goal !== 'conversion') { const v = Number(terms.fee); if (!(v > 0) || !Number.isInteger(v)) e.fee = goal === 'hybrid' ? MSG5.HYBRID_FEE : MSG5.FEE_REQUIRED; }
    if (goal === 'engagement') {
      // The shared no-repeat / 1-to-20 rule (bits5) — the brand's pop-up and the pitch form use it too.
      const rows = terms.deliverables || [];
      const rowsError = deliverableRowsError5(rows);
      if (!rows.length) e.deliverables = MSG5.DELIVERABLES_EMPTY;
      else if (rowsError) e.deliverables = rowsError;
      if (terms.usage.on && !terms.usage.places.length) e.usage = MSG5.USAGE_PLACE;
    }
    if (note.length > 300) e.note = MSG6.NOTE_LONG;
    setErrs(e);
    // The red line stays under its own box; the form is scrolled to the first one refused.
    const refused = COUNTER_FIELDS.find(k => e[k]);
    if (refused) reveal.show(refused);
    if (Object.keys(e).length) return;
    // A counter that changes nothing is refused before it leaves the phone, in the server's words.
    if (snapshotLine6(goal, proposed) === snapshotLine6(goal, current)
      && JSON.stringify(proposed.usageRights || null) === JSON.stringify(current.usageRights || null)) {
      setErrs({ form: MSG6.NOTHING_CHANGED }); reveal.show('form'); return;
    }
    setSaving(true);
    influencerApi.counterInvitation(ciId, { terms: proposed, note: note.trim() || undefined }).then(r => {
      setSaving(false);
      if (!r.success) {
        // 'form' is this screen's out-loud line; anything it cannot draw lands there. Only the
        // lines this Aim really draws count as "drawn" (the reuse line only while the switch is on).
        const err = r.error || {};
        const drawn = [
          goal !== 'engagement' ? 'commissionPct' : null,
          goal !== 'conversion' ? 'fee' : null,
          goal === 'engagement' ? 'deliverables' : null,
          goal === 'engagement' && terms.usage.on ? 'usage' : null,
          'note',
        ].filter(Boolean);
        const routed = applyServerError({ ...err, field: SERVER_FIELD[err.field] || err.field }, { fields: drawn, setErrors: setErrs, show: (m) => setErrs({ form: m }), fallback: COPY.saveFailed });
        // Under its own box, or on the form line at the end: wherever it went, it is brought into view.
        reveal.show(routed.errors ? Object.keys(routed.errors)[0] : 'form');
        return;
      }
      navigation.replace('Thread', { ciId, toast: C6.counter.sent });
    });
  }

  return (
    <View style={base.screen} testID={`counter-${goal}`}>
      <Header title={C6.counter.title} onBack={() => navigation.goBack()} />
      <FormArea>
      <FormScroll ref={scrollRef} contentContainerStyle={{ padding: 18 }} testID="counter-scroll">
        <RoundPill6 round={round} of={limit} />
        <LockedTermsCard6 set={{ goal, postingDate: thread.postingDate, shootMode: thread.shootMode || (thread.set && thread.set.shootMode), cityName: thread.cityName || (thread.set && thread.set.cityName) }}
          scopeWords={thread.invitation ? thread.invitation.scopeWords : null} />

        {/* Each line "Send counter" can refuse is marked — the field's own box, or a plain box round
            it — so the form can be scrolled to it. The marks add no space: nothing has moved. */}
        {goal !== 'engagement' ? (
          <View style={s.field} ref={reveal.mark('commissionPct')} collapsable={false} testID="counter-commission-field">
            <Text style={s.label}>{C6.counter.commission} <Text style={{ color: T.danger }}>*</Text></Text>
            <NumberField value={String(terms.commissionPct)} onChangeText={(v) => { setTerms(t => ({ ...t, commissionPct: v })); setErrs(x => ({ ...x, commissionPct: undefined, form: undefined })); }} suffix="%" decimal testID="counter-commission" />
            <ChangeLine6 label={C6.counter.theirOffer} from={fmtPct6(current.commissionPct)} to={fmtPct6(proposed.commissionPct) || '—'} testID="change-commission" />
            {mins && mins.commissionPct != null ? <Text style={s.hint}>{C6.counter.yourMinPlain(fmtPct6(mins.commissionPct))}</Text> : null}
            <FieldError text={errs.commissionPct} />
          </View>
        ) : null}

        {goal !== 'conversion' ? (
          <View style={s.field} ref={reveal.mark('fee')} collapsable={false} testID="counter-fee-field">
            <Text style={s.label}>{goal === 'hybrid' ? C6.counter.fixedFee : C6.counter.fee} <Text style={{ color: T.danger }}>*</Text></Text>
            <NumberField value={String(terms.fee)} onChangeText={(v) => { setTerms(t => ({ ...t, fee: v })); setErrs(x => ({ ...x, fee: undefined, form: undefined })); }} prefix="₹" testID="counter-fee" />
            <ChangeLine6 label={C6.counter.theirOffer} from={rupees6(current.fee)} to={rupees6(proposed.fee) || '—'} testID="change-fee" />
            <FieldError text={errs.fee} />
          </View>
        ) : null}

        {goal === 'engagement' ? (
          <>
            <View style={s.field} ref={reveal.mark('deliverables')} collapsable={false} testID="counter-deliverables-field">
              <Text style={s.label}>{C6.counter.delivers} <Text style={{ color: T.danger }}>*</Text></Text>
              <DeliverablesEditor5 rows={terms.deliverables} onChange={(rows) => { setTerms(t => ({ ...t, deliverables: rows })); setErrs(x => ({ ...x, deliverables: undefined, form: undefined })); }} error={errs.deliverables} testID="counter-deliverables" scrollRef={scrollRef} />
              <ChangeLine6 label={C6.counter.theyAsked} from={deliverablesShort(current.deliverables) || '—'} to={deliverablesShort(terms.deliverables) || '—'} testID="change-deliverables" />
            </View>
            <View style={s.field}>
              <SwitchRow label={C6.counter.reuse} value={terms.usage.on} onValueChange={(on) => { setTerms(t => ({ ...t, usage: { ...t.usage, on } })); setErrs(x => ({ ...x, form: undefined })); }} testID="counter-usage-switch" />
              {current.usageRights && current.usageRights.on ? (
                <Text style={s.hint}>{C6.counter.theyAskedUsage(`${current.usageRights.durationDays == null ? 'forever' : `${current.usageRights.durationDays} days`} on ${(current.usageRights.places || []).join(' and ')}`)}</Text>
              ) : null}
              {terms.usage.on ? (
                <View ref={reveal.mark('usage')} collapsable={false} testID="counter-usage-field">
                  <View style={s.chips}>{USAGE_DURATIONS.map(([d, l]) => <Chip key={String(d)} label={l} selected={terms.usage.durationDays === d} onPress={() => setTerms(t => ({ ...t, usage: { ...t.usage, durationDays: d } }))} testID={`counter-usage-${d}`} />)}</View>
                  <View style={s.chips}>{USAGE_PLACES.map(([p, l]) => { const on = terms.usage.places.includes(p); return <Chip key={p} label={l} selected={on} onPress={() => setTerms(t => ({ ...t, usage: { ...t.usage, places: on ? t.usage.places.filter(x => x !== p) : [...t.usage.places, p] } }))} testID={`counter-place-${p}`} />; })}</View>
                  <FieldError text={errs.usage} />
                </View>
              ) : null}
              <ChangeLine6 label={TERM_LABEL.usageRights}
                from={current.usageRights && current.usageRights.on ? `${current.usageRights.durationDays == null ? 'Forever' : `${current.usageRights.durationDays} days`}` : 'Off'}
                to={terms.usage.on ? `${terms.usage.durationDays == null ? 'Forever' : `${terms.usage.durationDays} days`}` : 'Off'} testID="change-usage" />
            </View>
          </>
        ) : null}

        <View ref={reveal.mark('note')} collapsable={false} testID="counter-note-field">
          <TextField4 label={C6.counter.why} value={note} onChangeText={(v) => { setNote(v); setErrs(x => ({ ...x, note: undefined })); }} max={300} multiline error={errs.note} testID="counter-note" />
        </View>
        <Text style={s.hint} testID="counter-hint">{C6.counter.hint(thread.brand.name, left)}</Text>
        <View ref={reveal.mark('form')} collapsable={false} testID="counter-form-line">
          <FieldError text={errs.form} />
        </View>
      </FormScroll>
      {toast}
      </FormArea>
      <BottomBar testID="counter-actions">
        <PrimaryButton label={left === 0 ? C6.counter.sendLast : C6.counter.send} onPress={send} busy={saving} testID="send-counter" />
      </BottomBar>
    </View>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
});
