/**
 * Item 6 — the sheets: what would you like to change (N1), the brand's counter back (N8), the
 * brand declining a counter (N9), and the confirm that spells out a move (N11).
 * Contract: features/item6-negotiation
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet, useSheetReveal } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, SwitchRow, Chip, FieldError } from '../settings/primitives';
import { NumberField } from '../../screens/brand/BrandPitchSettingsScreen';
import { TextField4 } from '../campaigns/bits4';
import { MinBox5 } from '../invitations/bits5';
import { DeliverablesEditor5, deliverableRowsError5 } from '../invitations/bits5';
import { C5, USAGE_DURATIONS, USAGE_PLACES, MSG5 } from '../invitations/copy5';
import { RoundPill6, ChangeLine6 } from './bits6';
import { C6, MSG6, TERM_LABEL, termValue, NEGOTIABLE, snapshotLine6, first, rupees6, fmtPct6 } from './copy6';

/* ───────────────────────────────────────────────────────────── N1 */

/**
 * Two things hide behind one word, so she picks which.
 *
 * `canCounter` (ui-walk-fixes, spec U23 — optional, missing means true): false when she may not
 * counter the money and the work (the brand switched countering off, an open group, no rounds
 * left). The chooser then does not offer "The money and the work", says nothing about counters
 * left, and starts on the date choice — it never leads her into a counter the server will refuse.
 */
export function CounterChoiceSheet6({ visible, roundLimit, countersUsed, canCounter, canMoveRequest, onMoney, onMove, onClose }) {
  const money = canCounter !== false;
  const move = !!canMoveRequest;
  const first = money ? 'money' : 'move';
  const [choice, setChoice] = useState(first);
  useEffect(() => { if (visible) setChoice(first); }, [visible, first]);
  const Option = ({ k, title, sub, testID }) => (
    <TouchableOpacity style={[s.option, choice === k && s.optionOn]} onPress={() => setChoice(k)} testID={testID}>
      <View style={{ flex: 1 }}><Text style={s.optionT}>{title}</Text><Text style={s.optionS}>{sub}</Text></View>
      <View style={[s.radio, choice === k && s.radioOn]}>{choice === k ? <View style={s.radioDot} /> : null}</View>
    </TouchableOpacity>
  );
  // Continue does the one thing that is both chosen and allowed; with neither allowed it closes.
  const go = () => {
    if (choice === 'money' && money) return onMoney();
    if (move) return onMove();
    if (money) return onMoney();
    return onClose && onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} testID="counter-choice-sheet">
      <Text style={s.title}>{C6.choice.title}</Text>
      {money ? <Option k="money" title={C6.choice.money} sub={C6.choice.moneySub} testID="choice-money" /> : null}
      {move ? <Option k="move" title={C6.choice.date} sub={C6.choice.dateSub} testID="choice-move" /> : null}
      {money ? <Text style={s.hint} testID="counters-left">{C6.choice.left(roundLimit, countersUsed)}</Text> : null}
      <View style={{ height: 12 }} />
      <PrimaryButton label={C6.choice.continue} onPress={go} testID="choice-continue" />
    </Sheet>
  );
}

/* ───────────────────────────────────────────────────────────── N8 */

/** The boxes "Send counter" can refuse, in the order they are drawn. */
const REFUSED_ORDER = ['commissionPct', 'fee', 'deliverables', 'usage', 'note'];

/**
 * The brand counters back. Same fields as her counter, the change line against what she asked,
 * the minimum warning that never blocks, and the last-counter label before it is sent.
 *
 * `serverError` (ui-walk-fixes, optional): the server's refusal of the counter, in its own words.
 * It is printed in red inside the pop-up, just above "Send counter" — a toast is drawn on the
 * screen BEHIND the pop-up, where nobody can read it (item 7's 17 September lesson).
 */
export function BrandCounterSheet6({ visible, thread, minimums, serverError, onSend, onClose }) {
  const goal = thread ? thread.goal : 'conversion';
  const f = first(thread && thread.creator ? thread.creator.name : '');
  const current = (thread && thread.current) || {};
  const [terms, setTerms] = useState({});
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  // ui-walk-fixes (board D, frame D7): the part of the pop-up that scrolls, so the type list
  // that opens inside it can be moved into view. Since board C it is the Sheet's own body — and
  // the same body is scrolled to the first box "Send counter" refuses (see send()).
  const reveal = useSheetReveal();
  const scrollRef = reveal.bodyRef;
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
      // ui-walk-fixes (board D): the same no-repeat / 1-to-20 check her counter screen makes. This
      // pop-up only checked "not empty", so a bad line went to the server and its refusal came
      // back as a toast under the open pop-up.
      const rowsError = deliverableRowsError5(terms.deliverables);
      if (!(terms.deliverables || []).length) e.deliverables = MSG5.DELIVERABLES_EMPTY;
      else if (rowsError) e.deliverables = rowsError;
      if (terms.usage && terms.usage.on && !(terms.usage.places || []).length) e.usage = MSG5.USAGE_PLACE;
    }
    if ((note || '').length > 200) e.note = MSG6.BRAND_REASON_LONG;
    setErrs(e);
    // "Send counter" is pinned above the keypad, and each red line sits under its own box in the
    // body. With the cursor in "Say why" the Commission and Fee boxes have scrolled out of view,
    // so the first box that was refused (top to bottom) is brought back — or the tap would seem
    // to do nothing.
    const first = REFUSED_ORDER.find(k => e[k]);
    if (first) { reveal.show(first); return; }
    setBusy(true);
    onSend({ terms: proposed, note: note.trim() || undefined }).finally(() => setBusy(false));
  }

  if (!thread) return null;
  // ui-walk-fixes (board C, frames C5 → C6): this pop-up kept its full length, so with the keypad
  // open "Say why" and "Send counter" slid under it. It is now the Sheet's shrinking shape: the
  // sheet stops below the status bar, its WHOLE body scrolls (the fixed 440-high inner scroller
  // is gone — `scrollRef` is the sheet's own body now), and "Send counter" is pinned at the
  // bottom of the sheet, directly above the keypad. A refusal from the server is said in red just
  // above that button, where it is seen however far the body has scrolled.
  return (
    <Sheet visible={visible} onClose={onClose} testID="brand-counter-sheet" fit bodyRef={scrollRef}
      footer={(
        <>
          {serverError ? <View style={s.refusal} testID="brand-counter-error"><FieldError text={serverError} /></View> : null}
          <PrimaryButton label={isLast ? C6.counter.sendLast : C6.counter.send} onPress={send} busy={busy} testID="brand-send-counter" />
        </>
      )}>
      <Text style={s.eyebrow}>{`${(thread.creator.name || '').toUpperCase()} · ${(thread.setName || '').toUpperCase()}`}</Text>
      <Text style={s.title}>{C6.counter.brandTitle}</Text>
      <View>
        <RoundPill6 round={used + 1} of={roundLimit} last={isLast} />
        {goal !== 'engagement' ? (
          <View style={s.field} ref={reveal.mark('commissionPct')} collapsable={false} testID="brand-commission-field">
            <Text style={s.label}>{C6.counter.commission} <Text style={{ color: T.danger }}>*</Text></Text>
            <NumberField value={String(terms.commissionPct ?? '')} onChangeText={(v) => { setTerms(t => ({ ...t, commissionPct: v })); setErrs(x => ({ ...x, commissionPct: undefined })); }} suffix="%" decimal testID="brand-commission" />
            <ChangeLine6 label={C6.counter.sheAsked(f)} from={fmtPct6(current.commissionPct)} to={fmtPct6(proposed.commissionPct) || '—'} testID="brand-change-commission" />
            {belowMin ? <MinBox5 text={C6.counter.belowHer(f, fmtPct6(minimums.commissionPct))} testID="brand-below-min" /> : null}
            <FieldError text={errs.commissionPct} />
          </View>
        ) : null}
        {goal !== 'conversion' ? (
          <View style={s.field} ref={reveal.mark('fee')} collapsable={false} testID="brand-fee-field">
            <Text style={s.label}>{goal === 'hybrid' ? C6.counter.fixedFee : C6.counter.fee} <Text style={{ color: T.danger }}>*</Text></Text>
            <NumberField value={String(terms.fee ?? '')} onChangeText={(v) => { setTerms(t => ({ ...t, fee: v })); setErrs(x => ({ ...x, fee: undefined })); }} prefix="₹" testID="brand-fee" />
            <ChangeLine6 label={C6.counter.sheAsked(f)} from={rupees6(current.fee)} to={rupees6(proposed.fee) || '—'} testID="brand-change-fee" />
            {belowFee ? <MinBox5 text={C6.counter.belowHer(f, rupees6(minimums.fee))} testID="brand-below-min-fee" /> : null}
            <FieldError text={errs.fee} />
          </View>
        ) : null}
        {goal === 'engagement' ? (
          <View style={s.field}>
            {/* ui-walk-fixes (spec U15): this is the BRAND's pop-up, so the block is "What she
                delivers". It read "What you'll deliver" — the creator's words on her own counter. */}
            <Text style={s.label} testID="brand-delivers-label">{C5.terms.delivers} <Text style={{ color: T.danger }}>*</Text></Text>
            <View ref={reveal.mark('deliverables')} collapsable={false} testID="brand-deliverables-field">
              <DeliverablesEditor5 rows={terms.deliverables || []} onChange={(rows) => { setTerms(t => ({ ...t, deliverables: rows })); setErrs(x => ({ ...x, deliverables: undefined })); }} error={errs.deliverables} testID="brand-deliverables" scrollRef={scrollRef} />
            </View>
            <SwitchRow label={C6.counter.reuse} value={!!(terms.usage && terms.usage.on)} onValueChange={(on) => setTerms(t => ({ ...t, usage: { ...t.usage, on } }))} testID="brand-usage-switch" />
            {terms.usage && terms.usage.on ? (
              <View ref={reveal.mark('usage')} collapsable={false} testID="brand-usage-field">
                <View style={s.chips}>{USAGE_DURATIONS.map(([d, l]) => <Chip key={String(d)} label={l} selected={terms.usage.durationDays === d} onPress={() => setTerms(t => ({ ...t, usage: { ...t.usage, durationDays: d } }))} testID={`brand-usage-${d}`} />)}</View>
                <View style={s.chips}>{USAGE_PLACES.map(([p, l]) => { const on = (terms.usage.places || []).includes(p); return <Chip key={p} label={l} selected={on} onPress={() => setTerms(t => ({ ...t, usage: { ...t.usage, places: on ? t.usage.places.filter(x => x !== p) : [...t.usage.places, p] } }))} testID={`brand-place-${p}`} />; })}</View>
                <FieldError text={errs.usage} />
              </View>
            ) : null}
          </View>
        ) : null}
        <View ref={reveal.mark('note')} collapsable={false} testID="brand-counter-note-field">
          <TextField4 label={C6.counter.whyBrand} value={note} onChangeText={setNote} max={200} multiline error={errs.note} testID="brand-counter-note" />
        </View>
        {isLast ? <Text style={s.hint} testID="last-counter-hint">{C6.counter.lastHintBrand(f)}</Text> : null}
      </View>
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
  // ui-walk-fixes (board C, rule 3): the note box and both buttons went under the keypad on a
  // short phone. The sheet now shrinks to the room above the keypad, its body scrolls, and the two
  // buttons are pinned under it. While the decline is running the red button shows its spinner
  // (it used to swap its label for "…").
  return (
    <Sheet visible={visible} onClose={onClose} testID="decline-counter-sheet" fit
      footer={(
        <>
          <DangerButton label={C6.declineCounter.decline} onPress={go} busy={!!busy} busyLabel="Declining" testID="decline-counter-confirm" />
          <SecondaryButton label={C6.declineCounter.keep} onPress={onClose} />
        </>
      )}>
      <Text style={s.title}>{C6.declineCounter.title(f)}</Text>
      <Text style={s.body}>{C6.declineCounter.body(f)}</Text>
      <TextField4 label={C6.declineCounter.why} value={note} onChangeText={setNote} max={200} multiline hint={C6.declineCounter.whyHint} error={err} testID="decline-counter-note" />
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
  // The server's refusal, above the pinned button (FieldError brings its own 6 on top).
  refusal: { marginBottom: 8 },
});
