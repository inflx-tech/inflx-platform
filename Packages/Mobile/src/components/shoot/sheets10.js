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

/** The agreed time, when it is still ahead — the only time the move sheet may open already showing. */
function stillAhead(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return !Number.isNaN(t) && t > Date.now() ? new Date(t).toISOString() : null;
}

/**
 * V12 — either side moves an agreed time: a new date and time, old → new, an optional why.
 *
 * ui-walk-fixes board G (frames G7–G9):
 *   · every opening starts again — the last opening's choice, reason and refusal are gone;
 *   · the boxes open showing the agreed time ONLY while that time is still ahead (G7). Two of the
 *     brand's three doors — "Send a new time" and "She didn't come" — open it once the agreed time
 *     has passed, and there both boxes start empty (G8) rather than on a day that cannot be picked;
 *   · a time that has gone is refused here, before it leaves the phone, in the same words the
 *     other two surfaces use;
 *   · the sheet is the shared Sheet's opt-in shape: its body scrolls and its two buttons are
 *     pinned, so "Say why" and "Send new time" stay above the keypad (G9). The refusal sits with
 *     the buttons, where it is seen however far the body has scrolled; the boxes it is about
 *     are outlined red.
 */
export function MoveTimeSheet10({ visible, side = 'brand', otherName, currentAt, postingDate, busy, serverError, onSend, onClose }) {
  const [shown, setShown] = useState(!!visible);
  const [at, setAt] = useState(() => (visible ? stillAhead(currentAt) : null));
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const [opening, setOpening] = useState(0);
  // The sheet stays mounted between openings, so "start again" is said here, as it opens.
  if (!!visible !== shown) {
    setShown(!!visible);
    if (visible) { setAt(stillAhead(currentAt)); setNote(''); setErr(null); setOpening((n) => n + 1); }
  }
  const brand = side === 'brand';
  const moved = !!at && !(currentAt && new Date(at).getTime() === new Date(currentAt).getTime());
  function send() {
    if (!at) { setErr(MSG10.TIME_REQUIRED); return; }
    if (new Date(at).getTime() <= Date.now()) { setErr(MSG10.TIME_IN_PAST); return; }
    if (!moved) { setErr(MSG10.NOTHING_CHANGED); return; }
    setErr(null);
    onSend({ visitAt: at, note: note.trim() || undefined });
  }
  const refusal = err || serverError;
  return (
    <Sheet visible={visible} onClose={onClose} testID="move-time-sheet" fit
      footer={(
        <>
          <FieldError text={refusal} />
          {refusal ? <View style={sh.gap} /> : null}
          <PrimaryButton label={C10.brand.sendNew} icon="send-outline" onPress={send} busy={busy} busyLabel="Sending" testID="move-send" />
          <SecondaryButton label={C10.plan.notYet} onPress={onClose} testID="move-cancel" />
        </>
      )}>
      <Text style={sh.title}>{brand ? C10.brand.moveTitle : C10.brand.moveTitleHers}</Text>
      {/* The picker starts again on each opening: a half-finished choice from the last one must not
          come back. Said through `resetKey`, which works even when `at` is null both times (a
          date picked with no time is never told to this sheet, so `at` alone cannot say it). */}
      <TimePicker10 resetKey={opening} value={at} onChange={(v) => { setAt(v); setErr(null); }} maxDay={postingDate}
        dateLabel={C10.brand.newDate} error={err ? true : undefined} testID="move-picker" />
      <View style={sh.gap} />
      {currentAt ? <ChangeLine6 label={C10.counter.agreedWas(currentAt).split(' ')[0]} from={whenShort10(currentAt)} to={moved ? whenShort10(at) : '—'} testID="move-change" /> : null}
      <View style={sh.gap} />
      <TextField4 label={C10.counter.why} value={note} onChangeText={setNote} max={300} multiline testID="move-note" />
      <Text style={sh.hint}>{brand ? C10.brand.moveHint(otherName, postingDate) : C10.brand.moveHintHers(otherName, postingDate)}</Text>
    </Sheet>
  );
}

const sh = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginBottom: 8 },
  eyebrow: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1, color: T.ink3, marginTop: 4, marginBottom: 4 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 19, marginTop: 10 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 6 },
  gap: { height: 8 },
});
