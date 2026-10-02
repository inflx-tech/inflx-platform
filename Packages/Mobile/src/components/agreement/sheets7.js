/**
 * Item 7 — the sheets: the send confirm (P3), her signature (P6), her decline
 * (P8), the brand's last signature (P11) and the withdraw (P14).
 * Contract: features/item7-agreement
 *
 * A signature is a typed full name plus two ticks. Both sheets refuse before
 * anything leaves the phone, in the server's own words, so she never taps Sign
 * and waits to be told what she already could have been told.
 *
 * ui-walk-fixes (board E, frames E9 / E10): the two confirm sheets with two
 * choices — Send and Withdraw — end in the shared level pair (ButtonRow): two
 * equal halves, level top and bottom, the quiet choice a clear dark outline and
 * Withdraw a red outline. Send reads "Sending" while it is busy. The "What
 * happens" card is outlined, and the Send warning and the Withdraw first line
 * sit in a grey box, as the board draws them; the wording is unchanged.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, FieldError, ButtonRow } from '../settings/primitives';
import { CheckboxRow } from '../discovery/bits';
import { TextField4 } from '../campaigns/bits4';
import { rupees5 } from '../invitations/copy5';
import { C7, MSG7, DECLINE_REASONS7, longDate7, shortDate7 } from './copy7';
import { MoneyRow7 } from './bits7';

/* ─────────────────────────────────────────────────────────────── P3 */

/**
 * ui-walk-fixes (board F, frame F5) — a refusal, said inside the sheet, just above its two buttons.
 *
 * Send and Withdraw used to announce a refusal with a toast, which is drawn on the screen BEHIND
 * the sheet: the sheet simply stayed open and nothing was said. The same fault the sign sheet had
 * (see BrandSignSheet7 below), fixed the same way — the reason appears where the person is looking.
 */
function SheetError7({ text, testID }) {
  if (!text) return null;
  return (
    <View style={s.err} accessibilityRole="alert" testID={testID}>
      <Icon name="alert-circle-outline" size={15} color={T.danger} style={s.errIcon} />
      <Text style={s.errText}>{text}</Text>
    </View>
  );
}

/** The confirm before it goes: she signs first, you sign last, both by the cutoff. */
export function SendAgreementSheet7({ visible, creatorName, cutoff, busy, serverError, onSend, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="send-agreement-sheet">
      <Text style={s.title}>{C7.brand.confirmTitle(creatorName)}</Text>
      <View style={s.card} testID="send-what-happens">
        <Text style={s.cardHd}>{C7.brand.whatHappens}</Text>
        <MoneyRow7 label={`${creatorName} signs`} value={C7.brand.first} />
        <MoneyRow7 label={C7.brand.youSign} value={C7.brand.afterHer} />
        <MoneyRow7 label={C7.brand.bothBy} value={longDate7(cutoff)} />
      </View>
      <View style={s.greybox} testID="send-warning">
        <Text style={s.greyText}>{C7.brand.confirmHint(creatorName)}</Text>
      </View>
      <SheetError7 text={serverError} testID="send-error" />
      <ButtonRow style={s.pair}>
        <SecondaryButton strong label={C7.brand.notYet} onPress={onClose} testID="send-not-yet" />
        <PrimaryButton label={C7.brand.send} onPress={onSend} busy={busy} busyLabel={C7.brand.sending} testID="send-confirm" />
      </ButtonRow>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────── P6 */

/** Her signature. A typed name, two ticks, and what we record. */
export function CreatorSignSheet7({ visible, defaultName, brandName, busy, serverError, onSign, onClose }) {
  const [name, setName] = useState('');
  const [t1, setT1] = useState(false);
  const [t2, setT2] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { if (visible) { setName(defaultName || ''); setT1(false); setT2(false); setErr(null); } }, [visible, defaultName]);

  function submit() {
    if (!String(name).trim()) { setErr(MSG7.NAME_EMPTY); return; }
    if (!t1 || !t2) { setErr(MSG7.TICKS); return; }
    setErr(null);
    onSign({ typedName: String(name).trim(), ticks: [true, true] });
  }

  // ui-walk-fixes (board C, rule 3): the sheet shrinks to the room above the keypad and its body
  // scrolls, so the name box stays in view while she types and the two ticks are a swipe away.
  // "Sign agreement" is pinned under the body, and a refusal (hers or the server's) sits with it —
  // seen however far the body has scrolled.
  const refusal = err || serverError;
  return (
    <Sheet visible={visible} onClose={onClose} testID="creator-sign-sheet" fit
      footer={(
        <>
          <FieldError text={refusal} />
          {refusal ? <View style={s.gap} /> : null}
          <PrimaryButton label={C7.creator.signAgreement} onPress={submit} busy={busy} testID="sign-submit" />
        </>
      )}>
      <Text style={s.title}>{C7.creator.signSheetTitle}</Text>
      <TextField4 label={C7.creator.yourName} value={name} onChangeText={setName} required
        hint={C7.creator.nameHint} max={100} testID="sign-name" />
      <View style={{ height: 6 }} />
      <CheckboxRow checked={t1} onPress={() => setT1(v => !v)} testID="tick-read">
        <Text style={s.tick}>{C7.creator.tickRead}</Text>
      </CheckboxRow>
      <CheckboxRow checked={t2} onPress={() => setT2(v => !v)} testID="tick-binding">
        <Text style={s.tick}>{C7.creator.tickBinding(brandName)}</Text>
      </CheckboxRow>
      <Text style={[s.hint, s.hintLast]}>{C7.creator.recordHint}</Text>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────── P8 */

/** She declines at signing. One of six reasons, an optional note the brand sees. */
export function DeclineAgreementSheet7({ visible, brandName, busy, onDecline, onClose }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { if (visible) { setReason(null); setNote(''); setErr(null); } }, [visible]);

  function submit() {
    if (!reason) { setErr(MSG7.DECLINE_REASON); return; }
    if (note.length > 200) { setErr(MSG7.DECLINE_NOTE); return; }
    setErr(null);
    onDecline({ reason, note: note.trim() || undefined });
  }

  // ui-walk-fixes (board C, rule 3): the note box is the last thing in a tall sheet. The sheet
  // shrinks to the room above the keypad, its body scrolls, and "Decline agreement" is pinned
  // under it with the refusal ("Choose a reason.") beside it.
  return (
    <Sheet visible={visible} onClose={onClose} testID="decline-agreement-sheet" fit
      footer={(
        <>
          <FieldError text={err} />
          {err ? <View style={s.gap} /> : null}
          <DangerButton label={C7.creator.declineAgreement} onPress={submit} busy={busy} testID="decline-confirm" />
        </>
      )}>
      <Text style={s.title}>{C7.creator.declineTitle}</Text>
      <Text style={s.body}>{C7.creator.declineBody(brandName)}</Text>
      <Text style={s.section}>{C7.creator.whyTitle}</Text>
      <View style={s.chips}>
        {DECLINE_REASONS7.map(r => (
          <TouchableOpacity key={r.code} style={[s.chip, reason === r.code && s.chipOn]}
            onPress={() => setReason(r.code)} testID={`reason-${r.code}`}>
            <Text style={[s.chipText, reason === r.code && s.chipTextOn]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextField4 label={C7.creator.noteLabel} value={note} onChangeText={setNote} multiline max={200}
        hint={C7.creator.noteHint} testID="decline-note" />
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────── P11 */

/**
 * The brand's last signature — the one place signing does something
 * irreversible, so the sheet lists it: the money locks, the first payment
 * leaves, and the terms can never change again.
 */
/**
 * ⚠️ serverError is why this sheet exists in its current shape.
 *
 * A refused signature used to be announced with a toast — which renders on the SCREEN, behind this
 * modal. So when the server said no, the brand saw nothing at all: the sheet simply stayed open.
 * She typed her name again, ticked again, tapped again, and it "kept coming back". Found in
 * production 2026-09-17, where every attempt was being refused for a real reason she was never
 * shown. A refusal must appear where the person is looking.
 */
export function BrandSignSheet7({ visible, defaultName, brandName, creatorName, cost, busy, serverError, onSign, onClose }) {
  const [name, setName] = useState('');
  const [t1, setT1] = useState(false);
  const [t2, setT2] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { if (visible) { setName(defaultName || ''); setT1(false); setT2(false); setErr(null); } }, [visible, defaultName]);

  const gate = !!(cost && cost.gate);
  const locked = gate ? rupees5(cost.totalToLock) : null;
  const released = gate && cost.payouts ? rupees5(cost.payouts.t1) : null;

  function submit() {
    if (!String(name).trim()) { setErr(MSG7.NAME_EMPTY); return; }
    if (!t1 || !t2) { setErr(MSG7.TICKS); return; }
    setErr(null);
    onSign({ typedName: String(name).trim(), ticks: [true, true] });
  }

  // ui-walk-fixes (board C, rule 3): the same shape as her sign sheet — the body scrolls, the
  // name box stays in view above the keypad, and "Sign and lock ₹…" is pinned under it. The
  // refusal sits with the button: the 17 September fault (a refusal nobody could see) must not
  // come back by being scrolled out of sight.
  const refusal = err || serverError;
  return (
    <Sheet visible={visible} onClose={onClose} testID="brand-sign-sheet" fit
      footer={(
        <>
          <FieldError text={refusal} />
          {refusal ? <View style={s.gap} /> : null}
          <PrimaryButton
            label={gate ? C7.brand.signAndLock(locked) : C7.brand.signAndComplete}
            onPress={submit} busy={busy} testID="brand-sign-submit" />
        </>
      )}>
      <Text style={s.title}>{C7.brand.signSheetTitle}</Text>
      <TextField4 label={C7.brand.signerName} value={name} onChangeText={setName} required
        hint={C7.brand.signingFor(brandName)} max={100} testID="brand-sign-name" />
      <View style={{ height: 6 }} />
      <CheckboxRow checked={t1} onPress={() => setT1(v => !v)} testID="brand-tick-read">
        <Text style={s.tick}>{C7.brand.tickRead(brandName)}</Text>
      </CheckboxRow>
      <CheckboxRow checked={t2} onPress={() => setT2(v => !v)} testID="brand-tick-money">
        <Text style={s.tick}>
          {gate ? C7.brand.tickMoney(locked, released, creatorName) : C7.brand.tickComplete}
        </Text>
      </CheckboxRow>
      <Text style={[s.hint, s.hintLast]}>{C7.brand.irreversible}</Text>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────── P14 */

/** Pulling an agreement back, possible only while she has not signed. */
export function WithdrawAgreementSheet7({ visible, creatorName, busy, serverError, onWithdraw, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="withdraw-agreement-sheet">
      <Text style={s.title}>{C7.brand.withdrawTitle}</Text>
      <View style={[s.greybox, s.greyboxBeforeHint]} testID="withdraw-first-line">
        <Text style={s.greyText}>{C7.brand.withdrawBody(creatorName)}</Text>
      </View>
      <Text style={s.hint}>{C7.brand.withdrawHint(creatorName)}</Text>
      <SheetError7 text={serverError} testID="withdraw-error" />
      <ButtonRow style={s.pair}>
        <SecondaryButton strong label={C7.brand.keepIt} onPress={onClose} testID="withdraw-keep" />
        <DangerButton outline label={C7.brand.withdraw} onPress={onWithdraw} busy={busy} testID="withdraw-confirm" />
      </ButtonRow>
    </Sheet>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink, marginBottom: 8 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 20, marginBottom: 10 },
  section: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginTop: 4, marginBottom: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 18, marginTop: 8, marginBottom: 12 },
  // The last line of a scrolling body: the pinned footer already keeps 12 above its button.
  hintLast: { marginBottom: 0 },
  gap: { height: 8 },
  tick: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 19, flex: 1 },
  // E9: the "What happens" card is outlined (it was a grey block), so the grey is left for the box
  // that carries the warning.
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: T.bg },
  cardHd: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink2, marginBottom: 4 },
  // E9 / E10: the boards' grey box — the Send warning, the Withdraw first line.
  greybox: { backgroundColor: T.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  greyboxBeforeHint: { marginBottom: 2 },
  greyText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 18 },
  // The space above the level pair; the row itself (two equal halves, 8 apart) is ButtonRow's.
  pair: { marginTop: 4 },
  // F5: the refusal — pale red, an alert mark, the server's sentence in red.
  err: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: T.dangerSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  errIcon: { marginRight: 8, marginTop: 1 },
  errText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.danger, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: T.border },
  chipOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink2 },
  chipTextOn: { color: '#FFFFFF' },
});
