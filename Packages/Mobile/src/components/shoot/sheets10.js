/**
 * Item 10 — the two bottom sheets: sending the plan (V3) and moving an agreed time (V12).
 * Contract: features/item10-store-visit
 *
 * A refusal the server sends back is rendered INSIDE the sheet (`serverError`), never as a toast
 * behind it — item 7's 17 September lesson.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, FieldError } from '../settings/primitives';
import { TextField4 } from '../campaigns/bits4';
import { ChangeLine6 } from '../negotiation/bits6';
import { Row10, TimePicker10 } from './bits10';
import { C10, MSG10, whenShort10 } from './copy10';

/** V3 — what she gets: the full address, the number, the time. */
export function SendPlanSheet10({ visible, creatorName, contactName, address, phone, visitAt, busy, serverError, onSend, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="send-plan-sheet">
      <Text style={sh.title}>{C10.plan.confirmTitle(creatorName)}</Text>
      <Text style={sh.eyebrow}>{C10.plan.whatSheGets}</Text>
      <Row10 label={C10.plan.fullAddress} value={address} testID="confirm-address" />
      <Row10 label={C10.plan.theNumber(contactName)} value={phone} testID="confirm-phone" />
      <Row10 label={C10.plan.theTime} value={whenShort10(visitAt)} testID="confirm-time" />
      <Text style={sh.body}>{C10.plan.confirmBody}</Text>
      <FieldError text={serverError} />
      <View style={{ height: 8 }} />
      <PrimaryButton label={C10.plan.send} icon="send-outline" onPress={onSend} busy={busy} busyLabel="Sending" testID="send-plan-confirm" />
      <SecondaryButton label={C10.plan.notYet} onPress={onClose} testID="send-plan-cancel" />
    </Sheet>
  );
}

/** V12 — either side moves an agreed time: a new date and time, old → new, an optional why. */
export function MoveTimeSheet10({ visible, side = 'brand', otherName, currentAt, postingDate, busy, serverError, onSend, onClose }) {
  const [at, setAt] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const brand = side === 'brand';
  function send() {
    if (!at) { setErr(MSG10.TIME_REQUIRED); return; }
    if (currentAt && new Date(at).getTime() === new Date(currentAt).getTime()) { setErr(MSG10.NOTHING_CHANGED); return; }
    setErr(null);
    onSend({ visitAt: at, note: note.trim() || undefined });
  }
  return (
    <Sheet visible={visible} onClose={onClose} testID="move-time-sheet">
      <Text style={sh.title}>{brand ? C10.brand.moveTitle : C10.brand.moveTitleHers}</Text>
      <TimePicker10 value={at} onChange={(v) => { setAt(v); setErr(null); }} maxDay={postingDate} testID="move-picker" />
      {currentAt ? <ChangeLine6 label={C10.counter.agreedWas(currentAt).split(' ')[0]} from={whenShort10(currentAt)} to={at ? whenShort10(at) : '—'} testID="move-change" /> : null}
      <TextField4 label={C10.counter.why} value={note} onChangeText={setNote} max={300} multiline testID="move-note" />
      <Text style={sh.hint}>{brand ? C10.brand.moveHint(otherName, postingDate) : C10.brand.moveHintHers(otherName, postingDate)}</Text>
      <FieldError text={err || serverError} />
      <View style={{ height: 8 }} />
      <PrimaryButton label={C10.brand.sendNew} icon="send-outline" onPress={send} busy={busy} busyLabel="Sending" testID="move-send" />
      <SecondaryButton label={C10.plan.notYet} onPress={onClose} testID="move-cancel" />
    </Sheet>
  );
}

const sh = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginBottom: 8 },
  eyebrow: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1, color: T.ink3, marginTop: 4, marginBottom: 4 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 19, marginTop: 10 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 6 },
});
