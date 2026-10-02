/**
 * Item 8 — she writes a pitch (T2, T3, T4).
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * Three steps, because the brand needs three different things: what the deal
 * is, when and how she could do it, and why her.
 *
 * The screen never guesses what a brand will take. It asks the server first and
 * offers only the Aims and modes that brand actually accepts, so the first
 * choice she makes can never be refused later. Her own minimums appear as a
 * reminder beside the field — she may pitch under them, and often should.
 *
 * Every rule is still checked again on send. This screen exists to stop her
 * wasting a pitch, not to be the place the rules live.
 *
 * ui-walk-fixes (board C, rule 2): the form is a FormScroll — the box she is typing in, with the
 * counter and the red line under it, stays in view above the keypad. Nothing floats here (each
 * step's button is the last thing IN the form), so nothing else changes.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { Chip, PrimaryButton, FieldError, InfoBox, Section } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { FormScroll } from '../../components/shell/FormScroll';
import DateField from '../../components/DateField';
import { DeliverablesEditor5, KV5, deliverableRowsError5 } from '../../components/invitations/bits5';
import { Header, NumberField } from '../brand/BrandPitchSettingsScreen';
import { CooldownBox8 } from '../../components/pitch/bits8';
import { C8, MSG8, aimLabel8, modeLabel8, rupees8, fmtPct8, deliverablesShort, shortDate8 } from '../../components/pitch/copy8';

const AIM_SUB = {
  conversion: 'You earn commission on what you sell',
  engagement: 'They pay you a fee for the content',
  hybrid: 'A fixed fee plus commission',
};

export default function PitchFormScreen({ navigation, route }) {
  const { brandId, brandName } = route.params || {};
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('loading');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});
  const { toast, show } = useToast();
  // ui-walk-fixes (board D, frame D8): the page that scrolls, so an opened type list can be moved into view.
  const scrollRef = useRef(null);

  const [goal, setGoal] = useState(null);
  const [fee, setFee] = useState('');
  const [commission, setCommission] = useState('');
  const [deliverables, setDeliverables] = useState([{ type: 'reel', count: 1 }]);
  const [date, setDate] = useState(null);
  const [mode, setMode] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.pitchForm(brandId);
    if (!r || !r.success) { setStatus('error'); return; }
    const f = r.data.form;
    setForm(f);
    // One accepted Aim or mode is not a choice — it is the answer.
    if ((f.acceptedAims || []).length === 1) setGoal(f.acceptedAims[0]);
    if ((f.acceptedModes || []).length === 1) setMode(f.acceptedModes[0]);
    setStatus('ready');
  }, [brandId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const name = (form && form.brand && form.brand.name) || brandName || '';
  const min = (form && form.minimums) || {};
  const selling = goal === 'conversion' || goal === 'hybrid';
  const paying = goal === 'engagement' || goal === 'hybrid';

  const terms = useMemo(() => {
    const t = { goal };
    if (paying) t.fee = fee === '' ? null : Number(fee);
    if (selling) { t.commissionPct = commission === '' ? null : Number(commission); t.scope = 'store'; }
    if (goal === 'engagement') t.deliverables = deliverables;
    return t;
  }, [goal, fee, commission, deliverables, paying, selling]);

  function checkStep1() {
    const e = {};
    if (!goal) e.goal = 'Pick what kind of deal.';
    if (paying && (fee === '' || !(Number(fee) > 0))) e.fee = 'Enter the fee you want.';
    if (selling && (commission === '' || !(Number(commission) > 0) || Number(commission) > 100)) e.commission = 'Enter a commission between 0 and 100.';
    if (goal === 'engagement') {
      // ui-walk-fixes (board D): after "something to deliver", the same no-repeat / 1-to-20 check
      // her counter screen makes — this form had neither, so only the server caught them.
      const rowsError = deliverableRowsError5(deliverables);
      if (!deliverables.length || deliverables.some((d) => !d.count)) e.deliverables = "Say what you'd deliver.";
      else if (rowsError) e.deliverables = rowsError;
    }
    setErr(e);
    return Object.keys(e).length === 0;
  }
  function checkStep2() {
    const e = {};
    if (!date) e.date = 'Choose when you could post.';
    else if (form && form.earliestGoLiveDate && date < form.earliestGoLiveDate) e.date = MSG8.DATE_TOO_SOON;
    if (!mode) e.mode = MSG8.MODE_REQUIRED;
    setErr(e);
    return Object.keys(e).length === 0;
  }

  async function send() {
    const text = message.trim();
    if (!text) { setErr({ message: MSG8.MESSAGE_REQUIRED }); return; }
    if (text.length > 500) { setErr({ message: MSG8.MESSAGE_LONG }); return; }
    setErr({});
    setBusy(true);
    const r = await influencerApi.sendPitch({
      brandId, ...terms, proposedGoLiveDate: date, shootMode: mode, message: text,
    });
    setBusy(false);
    if (!r || !r.success) {
      // The server's sentence, not ours. It knows rules this screen does not.
      const e = (r && r.error) || {};
      setErr({ [e.field || 'message']: e.message || 'That did not send. Try again.' });
      show(e.message || 'That did not send.');
      return;
    }
    navigation.replace('MyPitches', { sent: r.data.pitch.id });
  }

  // ui-walk-fixes D3 — a pushed screen has no bottom tabs, so it carries its own way back, in
  // every state (loading, failed, blocked, the form). The bar names the brand; the page's own
  // heading under it still says "Pitch {brand}".
  const bar = <Header title={name} onBack={() => navigation.goBack()} />;

  if (status === 'loading') return <View style={s.page}>{bar}<Skeleton rows={7} /></View>;
  if (status === 'error') return <View style={s.page}>{bar}<LoadError onRetry={load} /></View>;

  // She cannot send at all — say why, and do not show her a form she can't use.
  if (!form.canPitch) {
    return (
      <View style={s.page} testID="pitch-form-blocked">
        {bar}
        {form.reason === 'COOLDOWN'
          ? <CooldownBox8 text={form.cooldownLine} testID="pitch-form-cooldown" />
          : <InfoBox text={form.reason === 'NOT_ACCEPTING' ? MSG8.NOT_ACCEPTING(name)
            : form.reason === 'LIMIT' ? form.limitReachedLine
              : form.reason === 'BEING_MEASURED' ? MSG8.BEING_MEASURED
                : MSG8.NOT_MATCHING(name)} />}
      </View>
    );
  }

  return (
    <View style={s.page}>
      {bar}
      <FormScroll ref={scrollRef} contentContainerStyle={s.body} testID="pitch-form-scroll">
        <Text style={s.title} testID="pitch-form-title">{C8.form.title(name)}</Text>

        {/* ── T2 · what kind of deal, and the money ─────────────────────── */}
        {step === 1 ? (
          <>
            <Section title={C8.form.aim}>
              {(form.acceptedAims || []).map((a) => (
                <Chip key={a} label={`${aimLabel8(a)} · ${AIM_SUB[a]}`} selected={goal === a}
                  onPress={() => setGoal(a)} testID={`pitch-aim-${a}`} />
              ))}
              <FieldError text={err.goal} />
              {(form.acceptedAims || []).length < 3
                ? <Text style={s.hint} testID="pitch-aim-hint">
                    {C8.form.aimHintOnly(name, ['conversion', 'engagement', 'hybrid']
                      .filter((a) => !(form.acceptedAims || []).includes(a)).map(aimLabel8).join(' or '))}
                  </Text>
                : null}
            </Section>

            {selling ? (
              <Section title={goal === 'hybrid' ? C8.form.commission : C8.form.commission}>
                <NumberField value={commission} onChangeText={setCommission} placeholder="14" suffix="%" decimal testID="pitch-commission" />
                <FieldError text={err.commission} />
                {min.commission != null || min.commissionHybrid != null ? (
                  <Text style={s.hint}>{C8.form.minCommission(goal === 'hybrid' ? min.commissionHybrid : min.commission)}</Text>
                ) : null}
              </Section>
            ) : null}

            {paying ? (
              <Section title={goal === 'hybrid' ? C8.form.hybridFee : C8.form.fee}>
                <NumberField value={fee} onChangeText={setFee} placeholder="12000" prefix="₹" testID="pitch-fee" />
                <FieldError text={err.fee} />
                {(goal === 'hybrid' ? min.feeHybrid : min.feeEngagement) != null ? (
                  <Text style={s.hint}>{C8.form.minFee(goal === 'hybrid' ? min.feeHybrid : min.feeEngagement)}</Text>
                ) : null}
              </Section>
            ) : null}

            {goal === 'engagement' ? (
              <Section title={C8.form.deliverables}>
                <DeliverablesEditor5 rows={deliverables} onChange={(rows) => { setDeliverables(rows); setErr((x) => ({ ...x, deliverables: undefined })); }}
                  error={err.deliverables} testID="pitch-deliverables" scrollRef={scrollRef} />
              </Section>
            ) : null}

            <PrimaryButton label={C8.form.next1} onPress={() => { if (checkStep1()) setStep(2); }} testID="pitch-next-1" />
          </>
        ) : null}

        {/* ── T3 · when and how ─────────────────────────────────────────── */}
        {step === 2 ? (
          <>
            <Section title={C8.form.date} hint={C8.form.dateHint}>
              <DateField value={date} onChange={setDate} minDate={form.earliestGoLiveDate} error={err.date} testID="pitch-date" />
            </Section>
            <Section title={C8.form.mode}>
              {(form.acceptedModes || []).map((m) => (
                <Chip key={m} label={modeLabel8(m)} selected={mode === m} onPress={() => setMode(m)} testID={`pitch-mode-${m}`} />
              ))}
              <FieldError text={err.mode} />
            </Section>
            <PrimaryButton label={C8.form.next2} onPress={() => { if (checkStep2()) setStep(3); }} testID="pitch-next-2" />
          </>
        ) : null}

        {/* ── T4 · review, the message, and everything said before she taps ─ */}
        {step === 3 ? (
          <>
            <View style={s.card} testID="pitch-review">
              <Text style={s.cardTitle}>{C8.form.reviewHead(name)}</Text>
              <KV5 k={C8.form.lblAim} v={aimLabel8(goal)} />
              {paying ? <KV5 k={C8.form.lblFee} v={rupees8(fee)} /> : null}
              {selling ? <KV5 k={C8.form.lblCommission} v={fmtPct8(commission)} /> : null}
              {goal === 'engagement' ? <KV5 k={C8.form.lblPost} v={deliverablesShort(deliverables)} /> : null}
              {selling ? <KV5 k={C8.form.lblSell} v={C8.form.wholeStore} /> : null}
              <KV5 k={C8.form.lblDate} v={shortDate8(date)} />
              <KV5 k={C8.form.lblMode} v={modeLabel8(mode)} />
            </View>

            <Section title={C8.form.why}>
              <TextInput
                style={s.textarea}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                placeholder="Why would you be a good fit?"
                placeholderTextColor={T.ink3}
                testID="pitch-message"
              />
              <Text style={s.counter}>{C8.form.counter(message.length)}</Text>
              <FieldError text={err.message} />
            </Section>

            {/* The deadline, the next step and the limit — all before she taps. */}
            <InfoBox text={C8.form.theyHaveDays(name, form.responseDays || 30)} />
            <Text style={s.limit} testID="pitch-limit">{form.limitLine}</Text>
            <PrimaryButton label={C8.form.send} busyLabel={C8.form.sending} busy={busy} onPress={send} testID="pitch-send" />
          </>
        ) : null}
      </FormScroll>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.bg },
  body: { padding: 16, paddingBottom: 40 },
  title: { fontFamily: fonts.heading, fontSize: 20, color: T.ink, marginBottom: 14 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 6, lineHeight: 17 },
  card: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 14 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 6 },
  textarea: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, minHeight: 110, textAlignVertical: 'top', fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink, backgroundColor: '#FFFFFF' },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, textAlign: 'right', marginTop: 4 },
  limit: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink3, textAlign: 'center', marginVertical: 12 },
});
