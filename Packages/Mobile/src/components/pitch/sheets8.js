/**
 * Item 8 — the three sheets: accepting (T7), rejecting (T8) and withdrawing (T4).
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * Each one says the consequence before the tap, never after it:
 *
 *   accept   — the money is agreed and a collaboration is NOT started. This is
 *              the most important sentence in item 8 and it is on the button's
 *              own sheet, not in a help page.
 *   reject   — the exact date she may pitch again, plus the fact that a block
 *              is a different answer and lives somewhere else.
 *   withdraw — that there is no cooldown, so she isn't afraid to take it back.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, FieldError, InfoBox } from '../settings/primitives';
import { KV5 } from '../invitations/bits5';
import { CooldownBox8 } from './bits8';
import { C8, MSG8 } from './copy8';

/* ───────────────────────────────────────────────────────────────── T7 */

/**
 * Accepting agrees the money and nothing else. The three lines spell out what
 * IS created, what she gets, and — the line that matters — that a collaboration
 * is not one of them.
 */
export function AcceptPitchSheet8({ visible, pitch, busy, onAccept, onClose }) {
  if (!pitch) return null;
  return (
    <Sheet visible={visible} onClose={onClose} testID="accept-pitch-sheet">
      <Text style={s.title}>{C8.brand.acceptTitle(pitch.creator && pitch.creator.name)}</Text>
      <View style={s.card}>
        <Text style={s.cardHd}>{C8.brand.acceptWhat}</Text>
        <KV5 k={C8.brand.acceptMoney(pitch.termsLine)} v={C8.brand.acceptAgreed} />
        <KV5 k={C8.brand.acceptGoesToLabel} v={C8.brand.acceptGoesTo(pitch.proposedGoLiveDate)} />
        <KV5 k={C8.brand.acceptCollabLabel} v={C8.brand.acceptNotYet} />
      </View>
      <InfoBox text={pitch.acceptBody} />
      <View style={s.row}>
        <View style={{ flex: 1 }}><SecondaryButton label={C8.brand.acceptCancel} onPress={onClose} testID="accept-not-now" /></View>
        <View style={{ flex: 1 }}><PrimaryButton label={C8.brand.acceptGo} onPress={onAccept} busy={busy} testID="accept-confirm" /></View>
      </View>
    </Sheet>
  );
}

/* ───────────────────────────────────────────────────────────────── T8 */

/** Rejecting. The cooldown date is stated before the tap, not discovered after. */
export function RejectPitchSheet8({ visible, pitch, busy, onReject, onClose }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);
  if (!pitch) return null;

  function go() {
    const text = reason.trim();
    if (text.length > 200) { setErr(MSG8.REJECT_REASON_LONG); return; }
    setErr(null);
    onReject(text || null);
  }

  return (
    <Sheet visible={visible} onClose={onClose} testID="reject-pitch-sheet">
      <Text style={s.title}>{C8.brand.rejectTitle}</Text>
      <Text style={s.label}>{C8.brand.rejectWhy}</Text>
      <TextInput
        style={s.textarea}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={200}
        placeholder="Optional"
        placeholderTextColor={T.ink3}
        testID="reject-reason"
      />
      <Text style={s.hint}>{C8.brand.rejectSeen}</Text>
      <FieldError text={err} />
      <CooldownBox8 text={pitch.rejectCooldownLine} testID="reject-cooldown" />
      <Text style={s.hint}>{C8.brand.rejectBlockHint}</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}><SecondaryButton label={C8.brand.rejectKeep} onPress={onClose} testID="reject-keep" /></View>
        <View style={{ flex: 1 }}><DangerButton label={C8.brand.rejectGo} onPress={go} busy={busy} testID="reject-confirm" /></View>
      </View>
    </Sheet>
  );
}

/* ───────────────────────────────────────────────────────────────── T4 */

/** Taking it back. She is told plainly that this costs her nothing. */
export function WithdrawPitchSheet8({ visible, busy, onWithdraw, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="withdraw-pitch-sheet">
      <Text style={s.title}>{C8.mine.withdrawConfirm}</Text>
      <Text style={s.body}>{C8.mine.withdrawBody}</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}><SecondaryButton label={C8.mine.withdrawKeep} onPress={onClose} testID="withdraw-keep" /></View>
        <View style={{ flex: 1 }}><DangerButton label={C8.mine.withdrawGo} onPress={onWithdraw} busy={busy} testID="withdraw-confirm" /></View>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink, marginBottom: 12 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 20, marginBottom: 14 },
  card: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 12 },
  cardHd: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 4 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  textarea: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top', fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink, backgroundColor: '#FFFFFF' },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 6, marginBottom: 6, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
