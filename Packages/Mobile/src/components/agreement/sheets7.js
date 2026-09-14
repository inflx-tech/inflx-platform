/**
 * Item 7 — the sheets: the send confirm (P3), her signature (P6), her decline
 * (P8), the brand's last signature (P11) and the withdraw (P14).
 * Contract: features/item7-agreement
 *
 * A signature is a typed full name plus two ticks. Both sheets refuse before
 * anything leaves the phone, in the server's own words, so she never taps Sign
 * and waits to be told what she already could have been told.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, FieldError } from '../settings/primitives';
import { CheckboxRow } from '../discovery/bits';
import { TextField4 } from '../campaigns/bits4';
import { rupees5 } from '../invitations/copy5';
import { C7, MSG7, DECLINE_REASONS7, longDate7, shortDate7 } from './copy7';
import { MoneyRow7 } from './bits7';

/* ─────────────────────────────────────────────────────────────── P3 */

/** The confirm before it goes: she signs first, you sign last, both by the cutoff. */
export function SendAgreementSheet7({ visible, creatorName, cutoff, busy, onSend, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="send-agreement-sheet">
      <Text style={s.title}>{C7.brand.confirmTitle(creatorName)}</Text>
      <View style={s.card}>
        <Text style={s.cardHd}>{C7.brand.whatHappens}</Text>
        <MoneyRow7 label={`${creatorName} signs`} value={C7.brand.first} />
        <MoneyRow7 label={C7.brand.youSign} value={C7.brand.afterHer} />
        <MoneyRow7 label={C7.brand.bothBy} value={longDate7(cutoff)} />
      </View>
      <Text style={s.hint}>{C7.brand.confirmHint(creatorName)}</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}><SecondaryButton label={C7.brand.notYet} onPress={onClose} testID="send-not-yet" /></View>
        <View style={{ flex: 1 }}><PrimaryButton label={C7.brand.send} onPress={onSend} busy={busy} testID="send-confirm" /></View>
      </View>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────── P6 */

/** Her signature. A typed name, two ticks, and what we record. */
export function CreatorSignSheet7({ visible, defaultName, brandName, busy, onSign, onClose }) {
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

  return (
    <Sheet visible={visible} onClose={onClose} testID="creator-sign-sheet">
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
      <FieldError text={err} />
      <Text style={s.hint}>{C7.creator.recordHint}</Text>
      <PrimaryButton label={C7.creator.signAgreement} onPress={submit} busy={busy} testID="sign-submit" />
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

  return (
    <Sheet visible={visible} onClose={onClose} testID="decline-agreement-sheet">
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
      <FieldError text={err} />
      <DangerButton label={C7.creator.declineAgreement} onPress={submit} busy={busy} testID="decline-confirm" />
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────── P11 */

/**
 * The brand's last signature — the one place signing does something
 * irreversible, so the sheet lists it: the money locks, the first payment
 * leaves, and the terms can never change again.
 */
export function BrandSignSheet7({ visible, defaultName, brandName, creatorName, cost, busy, onSign, onClose }) {
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

  return (
    <Sheet visible={visible} onClose={onClose} testID="brand-sign-sheet">
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
      <FieldError text={err} />
      <Text style={s.hint}>{C7.brand.irreversible}</Text>
      <PrimaryButton
        label={gate ? C7.brand.signAndLock(locked) : C7.brand.signAndComplete}
        onPress={submit} busy={busy} testID="brand-sign-submit" />
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────── P14 */

/** Pulling an agreement back, possible only while she has not signed. */
export function WithdrawAgreementSheet7({ visible, creatorName, busy, onWithdraw, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="withdraw-agreement-sheet">
      <Text style={s.title}>{C7.brand.withdrawTitle}</Text>
      <Text style={s.body}>{C7.brand.withdrawBody(creatorName)}</Text>
      <Text style={s.hint}>{C7.brand.withdrawHint(creatorName)}</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}><SecondaryButton label={C7.brand.keepIt} onPress={onClose} testID="withdraw-keep" /></View>
        <View style={{ flex: 1 }}><DangerButton label={C7.brand.withdraw} onPress={onWithdraw} busy={busy} testID="withdraw-confirm" /></View>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink, marginBottom: 8 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 20, marginBottom: 10 },
  section: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginTop: 4, marginBottom: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 18, marginTop: 8, marginBottom: 12 },
  tick: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 19, flex: 1 },
  card: { backgroundColor: T.surface, borderRadius: 12, padding: 12, marginBottom: 10 },
  cardHd: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink2, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: T.border },
  chipOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink2 },
  chipTextOn: { color: '#FFFFFF' },
});
