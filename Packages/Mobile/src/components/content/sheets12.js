/**
 * Item 12 — the bottom sheets: send (C5), ask for changes (C7), a note on one file, and the two
 * reports. Contract: features/item12-content · mockups C5, C7, C11, C14, C15
 *
 * Items 7, 10 and 11's two rules:
 *   · a refusal the server sends back is rendered INSIDE the sheet (`serverError`), never as a
 *     toast behind it;
 *   · every confirm honours `busy` (check 28), and so does its "back" — SecondaryButton has no
 *     disabled prop, so the press itself is ignored while busy.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, FieldError, ButtonRow } from '../settings/primitives';
import { TextField4 } from '../campaigns/bits4';
import { WaitBox10, AmberBox10 } from '../shoot/bits10';
import { RoundPill12 } from './bits12';
import { C12, MSG12 } from './copy12';

/* ── C5 · send ─────────────────────────────────────────────────────────── */

export function SendSheet12({ visible, brandName, rows, busy, serverError, onSend, onClose, resend }) {
  // ui-walk-fixes (board C, rule 3): one line per row and no limit. On Pay for Content that is at
  // most five lines; on Pay for Sale it is one line for every place every post is shared, and a
  // dozen of them made the sheet taller than the phone — "Send" and "Not yet" fell off the bottom
  // with no way to reach them. The lines now scroll inside the sheet. The two things she must read
  // before she taps (nothing can be changed while they review; don't post yet) stay pinned with
  // the buttons, so a long list never pushes them out of sight either.
  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose} testID="send-sheet" fit
      footer={(
        <>
          <WaitBox10 text={C12.sendLock} testID="send-lock" />
          <AmberBox10 text={C12.dontPostYet} testID="dont-post-yet" />
          <FieldError text={serverError} />
          {serverError ? <View style={s.gap} /> : null}
          <PrimaryButton label={resend ? C12.sendChanges : C12.send} onPress={onSend} busy={busy} busyLabel="Sending" testID="send-confirm" />
          <SecondaryButton label={C12.notYet} onPress={() => { if (!busy) onClose(); }} testID="send-cancel" />
        </>
      )}>
      <Text style={s.title}>{C12.sendTitle(brandName)}</Text>
      {(rows || []).map((r) => (
        <View key={r.key} style={s.line} testID={`send-row-${r.key}`}>
          <Text style={s.lineLabel}>{r.label}</Text>
          <Text style={s.lineValue}>{C12.sendRow(r.files || [])}</Text>
        </View>
      ))}
    </Sheet>
  );
}

/* ── C7 · ask for changes ─────────────────────────────────────────────── */

export function ChangesSheet12({ visible, round, noteCount, busy, serverError, onSend, onClose }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { if (visible) { setErr(null); } }, [visible]);
  function send() {
    const r = reason.trim();
    if (!r) { setErr(MSG12.REASON_REQUIRED); return; }
    if (r.length > 500) { setErr(MSG12.REASON_TOO_LONG); return; }
    setErr(null); onSend(r);
  }
  const left = round ? Math.max(0, round.allowed - round.current + 1) : 0;
  // ui-walk-fixes (board C, frame C7): the sheet shrinks to the room above the keypad and its body
  // scrolls — the note box and its counter stay in view, the blue line about rounds is a swipe
  // away — and "Back" and "Send" are pinned under it as the level pair the frame (and item 12's
  // own C7) draws. A refusal from the server sits with the pair.
  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose} testID="changes-sheet" fit
      footer={(
        <>
          <FieldError text={serverError} />
          {serverError ? <View style={s.gap} /> : null}
          <ButtonRow>
            <SecondaryButton strong label={C12.back} onPress={() => { if (!busy) onClose(); }} testID="changes-back" />
            <PrimaryButton label={C12.send} onPress={send} busy={busy} busyLabel="Sending" testID="changes-send" />
          </ButtonRow>
        </>
      )}>
      <View style={s.head}>
        <Text style={s.title}>{C12.askChanges}</Text>
        <RoundPill12 round={round} />
      </View>
      <TextField4 label={C12.whatShouldChange} required value={reason} onChangeText={setReason} max={500}
        multiline error={err} testID="changes-reason" />
      {noteCount ? <Text style={s.small} testID="changes-note-count">{C12.noteCount(noteCount)}</Text> : null}
      <WaitBox10 text={C12.roundsInfo(left)} testID="rounds-info" />
    </Sheet>
  );
}

/* ── a note pinned to one file (C6 → C8) ──────────────────────────────── */

export function NoteSheet12({ visible, initial, onSave, onClose }) {
  const [note, setNote] = useState(initial || '');
  const [err, setErr] = useState(null);
  useEffect(() => { if (visible) { setNote(initial || ''); setErr(null); } }, [visible, initial]);
  function save() {
    const n = note.trim();
    if (n.length > 300) { setErr(MSG12.NOTE_TOO_LONG); return; }
    onSave(n);
  }
  // ui-walk-fixes (board C, rule 3): the sheet shrinks to the room above the keypad, the note box
  // and its counter stay in view, and Save / Back are pinned under it.
  return (
    <Sheet visible={visible} onClose={onClose} testID="note-sheet" fit
      footer={(
        <>
          <PrimaryButton label={C12.save} onPress={save} testID="note-save" />
          <SecondaryButton label={C12.back} onPress={onClose} testID="note-back" />
        </>
      )}>
      <Text style={s.title}>{C12.noteTitle}</Text>
      <TextField4 value={note} onChangeText={setNote} placeholder={C12.notePlaceholder} max={300} multiline error={err} testID="note-input" />
    </Sheet>
  );
}

/* ── the reports (C11, C14, C15) ──────────────────────────────────────── */

/**
 * kind: 'posted_wrong' | 'rounds_used' (the brand) or 'brand_silent' (her). Records a dispute for
 * item 18 and moves no money; the sentence says so before the tap, not after.
 */
export function ReportSheet12({ visible, kind, brandName, busy, serverError, onReport, onClose }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { if (visible) { setNote(''); setErr(null); } }, [visible]);
  const body = kind === 'rounds_used' ? C12.reportRoundsUsed : kind === 'posted_wrong' ? C12.reportPostedWrong
    : kind === 'posts_not_made' ? C12.reportPostsBody : C12.reportSilent(brandName);
  function go() {
    const n = note.trim();
    if (n.length > 500) { setErr(MSG12.REASON_TOO_LONG); return; }
    setErr(null); onReport(n || null);
  }
  // ui-walk-fixes (board C, rule 3): the sheet shrinks to the room above the keypad, the note box
  // and its counter stay in view, and the two buttons are pinned under it with the server's
  // refusal beside them.
  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose} testID="report-sheet" fit
      footer={(
        <>
          <FieldError text={serverError} />
          {serverError ? <View style={s.gap} /> : null}
          {kind === 'brand_silent'
            ? <PrimaryButton label={C12.askLook} onPress={go} busy={busy} busyLabel="Sending" testID="report-confirm" />
            : <DangerButton label={C12.report} onPress={go} busy={busy} busyLabel="Reporting" testID="report-confirm" />}
          <SecondaryButton label={C12.back} onPress={() => { if (!busy) onClose(); }} testID="report-back" />
        </>
      )}>
      <Text style={s.title}>{C12.reportTitle}</Text>
      <Text style={s.body}>{body}</Text>
      <TextField4 value={note} onChangeText={setNote} placeholder={C12.notePlaceholderReport} max={500} multiline error={err} testID="report-note" />
    </Sheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginBottom: 10 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 20, marginBottom: 12 },
  small: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginBottom: 10 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border },
  lineLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink },
  lineValue: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2 },
  gap: { height: 8 },
});
