/**
 * Item 10 — the brand plans the visit (V2) and sends it (V3).
 * Contract: features/item10-store-visit · rules v1.24 §11.1
 *
 * The branch is inherited and locked. Everything else is what a real visit actually needs — a
 * name, a number, a time, how long, and how to get in. The form lives in the phone's memory until
 * Send (founder Q5): there is no server draft and no half-plan. Sending is where the street address
 * stops being private, and the confirm sheet says exactly what she gets.
 *
 * ui-walk-fixes (board C, frames C0–C2, C8): "Send to {name}" is a strip UNDER the form
 * (BottomBar), never floating over it — the floating bar was what hid "Their number" once the
 * keypad opened. The form is a FormScroll, so the counter, hint and error line under the box
 * being typed in stay in view above the strip. With the keypad closed nothing else moved.
 *
 * A REFUSED "SEND TO" IS SHOWN (final review, finding C-3 — board C rule 1 + "a refusal must
 * appear where the person is looking"). The button is now pressed with the keypad open, when only
 * part of the form is on show; a check that fails draws its red line under its own box, which may
 * be out of sight (the name, while she types what to bring). The form is scrolled to the first box
 * that was refused, top to bottom, with the helper the pop-ups use (useSheetReveal). Nothing is
 * drawn twice and nothing moves when the box is already on show.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { useSheetReveal } from '../../components/settings/sheets';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { TextField4 } from '../../components/campaigns/bits4';
import { Card7 } from '../../components/agreement/bits7';
import { Row10, TimePicker10 } from '../../components/shoot/bits10';
import { openDays10 } from '../../components/shoot/TimeList10';
import { SendPlanSheet10 } from '../../components/shoot/sheets10';
import { C10, MSG10, longDay10, MODE_LABEL10 } from '../../components/shoot/copy10';

const INDIAN_MOBILE = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
/** The boxes "Send to" can refuse, in the order the form draws them. */
const PLAN_FIELDS = ['contactName', 'contactPhone', 'visitAt', 'notes'];

export default function BrandShootPlanScreen({ navigation, route }) {
  const { campaignId, setId, ciId } = route.params || {};
  const [sh, setSh] = useState(null);
  const [status, setStatus] = useState('loading');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [visitAt, setVisitAt] = useState(null);
  const [durationText, setDurationText] = useState('');
  const [notes, setNotes] = useState('');
  const [errs, setErrs] = useState({});
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  // A hook — it must stay above the two early returns below.
  const reveal = useSheetReveal();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.getShoot(campaignId, setId, ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    // Q11 — the brand's own login number, prefilled and editable. Both fields stay required.
    if (r.data.shoot.contactPrefill && r.data.shoot.contactPrefill.phone) setContactPhone((p) => p || r.data.shoot.contactPrefill.phone);
    setStatus('ready');
  }, [campaignId, setId, ciId]);
  useEffect(() => { load(); }, [load]);

  if (status === 'loading') return <View style={base.screen}><Header title={C10.plan.title} onBack={() => navigation.goBack()} /><Skeleton rows={7} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C10.plan.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const name = sh.creator.name;
  const branch = sh.branchNow || (sh.plan && sh.plan.branch) || {};
  // Frame G10: once no day can be chosen the picker says so in place of its boxes, and Send is off.
  const noDay = openDays10(sh.postingDate).none;

  function review() {
    const e = {};
    if (!contactName.trim()) e.contactName = MSG10.CONTACT_NAME;
    if (!INDIAN_MOBILE.test(contactPhone.trim())) e.contactPhone = MSG10.CONTACT_PHONE;
    if (!visitAt) e.visitAt = MSG10.TIME_REQUIRED;
    else if (new Date(visitAt).getTime() <= Date.now()) e.visitAt = MSG10.TIME_IN_PAST;
    if (notes.length > 500) e.notes = MSG10.NOTES_LONG;
    setErrs(e);
    // The red line stays under its own box; the form is scrolled to the first one refused.
    const refused = PLAN_FIELDS.find((f) => e[f]);
    if (refused) { reveal.show(refused); return; }
    setServerError(null);
    setSheet(true);
  }

  async function send() {
    setBusy(true); setServerError(null);
    const r = await brandApi.sendShootPlan(campaignId, setId, ciId, {
      contactName: contactName.trim(), contactPhone: contactPhone.trim(), visitAt,
      durationText: durationText.trim() || undefined, notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (!r || !r.success) {
      // The refusal in the sheet she is looking at — a wrong time, a branch with no address, a
      // plan already sent — never in a toast behind it.
      const err = (r && r.error) || {};
      setServerError(err.message || COPY.saveFailed);
      return;
    }
    setSheet(false);
    navigation.replace('BrandShoot', { campaignId, setId, ciId, toast: C10.plan.sent });
  }

  return (
    <View style={base.screen} testID="brand-shoot-plan">
      <Header title={C10.plan.title} onBack={() => navigation.goBack()} />
      <FormArea>
      <FormScroll ref={reveal.bodyRef} contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled" testID="plan-form">
        <Text style={s.crumb}>{`${String(name).toUpperCase()} · ${String(sh.setName || '').toUpperCase()}`}</Text>

        {/* The locked card: mode, branch, posting date — all from the set. */}
        <Card7 title={C10.plan.fromTheSet} titleIcon="lock-outline" tone="tint" testID="locked-card">
          <Row10 label={C10.plan.mode} value={MODE_LABEL10[sh.mode] || sh.mode} />
          <Row10 label={C10.plan.branch} value={branch.name} />
          <Row10 label={C10.plan.shePostsOn} value={longDay10(sh.postingDate)} />
        </Card7>

        {/* Each box "Send to" can refuse sits in a plain marked box of its own, its red line last,
            so the form can be scrolled to it. The marked boxes add no space: nothing has moved. */}
        <View ref={reveal.mark('contactName')} collapsable={false} testID="contact-name-field">
          <TextField4 label={C10.plan.whoToAskFor} value={contactName} onChangeText={(v) => { setContactName(v); setErrs((x) => ({ ...x, contactName: undefined })); }}
            max={60} required error={errs.contactName} testID="contact-name" />
        </View>
        <View ref={reveal.mark('contactPhone')} collapsable={false} testID="contact-phone-field">
          <TextField4 label={C10.plan.theirNumber} value={contactPhone} onChangeText={(v) => { setContactPhone(v); setErrs((x) => ({ ...x, contactPhone: undefined })); }}
            max={16} required hint={C10.plan.seesOnceSent} error={errs.contactPhone} testID="contact-phone" />
        </View>

        {/* Board G: two boxes, nothing pre-chosen. The refusal sits under the pair it points at (G5). */}
        <View ref={reveal.mark('visitAt')} collapsable={false} testID="plan-picker-field">
          <TimePicker10 value={visitAt} onChange={(v) => { setVisitAt(v); setErrs((x) => ({ ...x, visitAt: undefined })); }} maxDay={sh.postingDate}
            error={errs.visitAt} testID="plan-picker" />
        </View>
        <Text style={s.hint} testID="dates-hint">{C10.plan.datesHint(sh.postingDate)}</Text>

        <TextField4 label={C10.plan.howLong} value={durationText} onChangeText={setDurationText} placeholder={C10.plan.howLongPh} max={60} testID="duration" />
        <View ref={reveal.mark('notes')} collapsable={false} testID="notes-field">
          <TextField4 label={C10.plan.bring} value={notes} onChangeText={(v) => { setNotes(v); setErrs((x) => ({ ...x, notes: undefined })); }}
            placeholder={C10.plan.bringPh} max={500} multiline error={errs.notes} testID="notes" />
        </View>
      </FormScroll>
      </FormArea>
      <BottomBar testID="plan-actions">
        <PrimaryButton label={C10.plan.sendTo(name)} icon="send-outline" onPress={review} disabled={noDay} testID="send-to" />
      </BottomBar>

      <SendPlanSheet10 visible={sheet} creatorName={name} contactName={contactName} address={branch.address} phone={contactPhone} visitAt={visitAt}
        busy={busy} serverError={serverError} onSend={send} onClose={() => { setServerError(null); setSheet(false); }} />
    </View>
  );
}

const s = StyleSheet.create({
  crumb: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 8, marginBottom: 6 },
});
