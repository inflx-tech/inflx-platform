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
 *
 * ui-walk-fixes (board C): "Send counter" sits in its own strip under the form (BottomBar),
 * never over it, and the form is a FormScroll — the box being typed in, with its counter and
 * error line, stays in view above the strip. Spec U15: when the BRAND counters, the deliverables
 * block reads "What she delivers"; on her own counter it stays "What you'll deliver".
 *
 * A REFUSED "SEND COUNTER" IS SHOWN (final review, finding C-3), on both apps: the form is scrolled
 * to the first line that was refused, top to bottom — under its own box, or the form line at the
 * very end — with the helper the pop-ups use (useSheetReveal). The red line stays where it was;
 * nothing moves when it is already on show.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, brandApi } from '../../services/api';
import { PrimaryButton, FieldError } from '../../components/settings/primitives';
import { useSheetReveal } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { applyServerError } from '../../utils/serverError';
import { Header, NumberField, s as base } from '../brand/BrandPitchSettingsScreen';
import { TextField4 } from '../../components/campaigns/bits4';
import { DeliverablesEditor5, deliverableRowsError5 } from '../../components/invitations/bits5';
import { C5, MSG5, deliverablesShort } from '../../components/invitations/copy5';
import { RoundPill6, ChangeLine6 } from '../../components/negotiation/bits6';
import { C6, MSG6, rupees6, fmtPct6, snapshotLine6 } from '../../components/negotiation/copy6';

/**
 * ui-walk-fixes (board D) — the server names a refusal after its own column, not after the box
 * on this screen. A refusal about the deliverables arrives as 'formats_json'; it used to be filed
 * under that name, which nothing here draws, so Send did nothing she could see. Each one now goes
 * to the line it is about, and anything this screen has no line for is said on the form line.
 */
const SERVER_FIELD = { formats_json: 'deliverables', agreed_fee: 'fee', commission_pct: 'commissionPct' };
/** The lines "Send counter" can refuse, in the order the form draws them; 'form' is the line at the end. */
const COUNTER_FIELDS = ['commissionPct', 'fee', 'deliverables', 'note', 'form'];

export default function PitchCounterScreen({ navigation, route }) {
  const { pitchId, side = 'influencer' } = route?.params || {};
  const brandSide = side === 'brand';
  const [status, setStatus] = useState('loading');
  const [thread, setThread] = useState(null);
  const [terms, setTerms] = useState({ commissionPct: '', fee: '', deliverables: [] });
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  // Board C: the toast is drawn in the box above the button strip, just above it.
  const { toast } = useToast({ inFlow: true });
  // A refused "Send counter" scrolls the form to the first line it refused (see the note at the top).
  // A hook — it must stay above the two early returns below.
  const reveal = useSheetReveal();
  // ui-walk-fixes (board D): the page that scrolls, so an opened type list can be moved into view.
  // One node, both users: the deliverables chooser and the scroll to a refused line.
  const scrollRef = reveal.bodyRef;

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
      // The shared no-repeat / 1-to-20 rule (bits5) — the brand's pop-up and the pitch form use it too.
      const rows = terms.deliverables || [];
      const rowsError = deliverableRowsError5(rows);
      if (!rows.length) e.deliverables = MSG5.DELIVERABLES_EMPTY;
      else if (rowsError) e.deliverables = rowsError;
    }
    if (note.length > 300) e.note = MSG6.NOTE_LONG;
    setErrs(e);
    // The red line stays under its own box; the form is scrolled to the first one refused.
    const refused = COUNTER_FIELDS.find((k) => e[k]);
    if (refused) reveal.show(refused);
    if (Object.keys(e).length) return;
    // A counter that changes nothing is refused before it leaves the phone.
    if (snapshotLine6(goal, proposed) === snapshotLine6(goal, current)) {
      setErrs({ form: MSG6.NOTHING_CHANGED });
      reveal.show('form');
      return;
    }
    setSaving(true);
    const body = { ...proposed, scope: goal === 'engagement' ? undefined : 'store', note: note.trim() || undefined };
    const call = brandSide ? brandApi.counterPitch(pitchId, body) : influencerApi.counterMyPitch(pitchId, body);
    call.then((r) => {
      setSaving(false);
      if (!r || !r.success) {
        const err = (r && r.error) || {};
        const drawn = [goal !== 'engagement' ? 'commissionPct' : null, goal !== 'conversion' ? 'fee' : null, goal === 'engagement' ? 'deliverables' : null, 'note'].filter(Boolean);
        const routed = applyServerError({ ...err, field: SERVER_FIELD[err.field] || err.field }, { fields: drawn, setErrors: setErrs, show: (m) => setErrs({ form: m }), fallback: COPY.saveFailed });
        // Under its own box, or on the form line at the end: wherever it went, it is brought into view.
        reveal.show(routed.errors ? Object.keys(routed.errors)[0] : 'form');
        return;
      }
      navigation.replace(brandSide ? 'BrandPitchThread' : 'PitchThread', { pitchId, toast: C6.counter.sent });
    });
  }

  return (
    <View style={base.screen} testID={`pitch-counter-${goal}`}>
      <Header title={C6.counter.title} onBack={() => navigation.goBack()} />
      <FormArea>
      <FormScroll ref={scrollRef} contentContainerStyle={{ padding: 18 }} testID="pitch-counter-scroll">
        <RoundPill6 round={round} of={limit} />

        {/* Each line "Send counter" can refuse is marked — the field's own box, or a plain box round
            it — so the form can be scrolled to it. The marks add no space: nothing has moved. */}
        {goal !== 'engagement' ? (
          <View style={s.field} ref={reveal.mark('commissionPct')} collapsable={false} testID="pitch-counter-commission-field">
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
          <View style={s.field} ref={reveal.mark('fee')} collapsable={false} testID="pitch-counter-fee-field">
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
          <View style={s.field} ref={reveal.mark('deliverables')} collapsable={false} testID="pitch-counter-deliverables-field">
            {/* Spec U15: the brand's counter names HER work ("What she delivers"); hers says "What you'll deliver". */}
            <Text style={s.label} testID="pitch-counter-delivers-label">{brandSide ? C5.terms.delivers : C6.counter.delivers} <Text style={{ color: T.danger }}>*</Text></Text>
            <DeliverablesEditor5
              rows={terms.deliverables}
              onChange={(rows) => { setTerms((t) => ({ ...t, deliverables: rows })); setErrs((x) => ({ ...x, deliverables: undefined, form: undefined })); }}
              error={errs.deliverables}
              testID="pitch-counter-deliverables"
              scrollRef={scrollRef}
            />
            <ChangeLine6 label={C6.counter.theyAsked} from={deliverablesShort(current.deliverables) || '—'} to={deliverablesShort(terms.deliverables) || '—'} testID="change-deliverables" />
          </View>
        ) : null}

        <View ref={reveal.mark('note')} collapsable={false} testID="pitch-counter-note-field">
          <TextField4 label={C6.counter.why} value={note} onChangeText={(v) => { setNote(v); setErrs((x) => ({ ...x, note: undefined })); }} max={300} multiline error={errs.note} testID="pitch-counter-note" />
        </View>
        <Text style={s.hint} testID="pitch-counter-hint">{C6.counter.hint(them, left)}</Text>
        <View ref={reveal.mark('form')} collapsable={false} testID="pitch-counter-form-line">
          <FieldError text={errs.form} />
        </View>
      </FormScroll>
      {toast}
      </FormArea>
      <BottomBar testID="pitch-counter-actions">
        <PrimaryButton label={left === 0 ? C6.counter.sendLast : C6.counter.send} onPress={send} busy={saving} testID="send-pitch-counter" />
      </BottomBar>
    </View>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginTop: 6 },
});
