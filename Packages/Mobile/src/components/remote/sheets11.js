/**
 * Item 11 — the bottom sheets: R4a's confirm lives on its own screen, these are the rest.
 * Contract: features/item11-remote · mockups R6, R7, R11, R12, R13, R15a, R16
 *
 * TWO RULES, both item 7's and item 10's before this:
 *   · a refusal the server sends back is rendered INSIDE the sheet (`serverError`), never as a
 *     toast behind it — a person cannot act on a message they cannot see;
 *   · every confirm button honours `busy`, so a double tap cannot produce two of anything
 *     (check 39).
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, FieldError } from '../settings/primitives';
import { TextField4 } from '../campaigns/bits4';
import { Row10 } from '../shoot/bits10';
import { ThreeWayCheck11, DispositionTag11 } from './bits11';
import { C11, MSG11, day10, longDay10, rupees5, pickupDayLabel } from './copy11';

/* ── R11 · she marks the shoot done ─────────────────────────────────────── */

/**
 * §25: the brand does not confirm this. It opens her content step and MOVES NO MONEY — both
 * said here, because "done" is the one word on the screen that sounds irreversible.
 */
export function ShootDoneSheet11({ visible, brandName, count, dueDate, busy, onConfirm, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="shoot-done-sheet">
      <Text style={sh.title}>Finished shooting?</Text>
      <Text style={sh.body}>{C11.creator.finishedHint(brandName)}</Text>
      {count > 0 ? (
        <Text style={sh.body} testID="done-return-note">{C11.creator.returnCard(count, dueDate)}</Text>
      ) : null}
      <View style={{ height: 8 }} />
      <PrimaryButton label={C11.creator.finished} icon="check" onPress={onConfirm} busy={busy}
        busyLabel="Marking" testID="shoot-done-confirm" />
      <SecondaryButton label="Not yet" onPress={onClose} disabled={busy} testID="shoot-done-cancel" />
    </Sheet>
  );
}

/* ── R12 · she picks a pickup day ───────────────────────────────────────── */

/** Seven chips, starting TOMORROW (§11.2). Her address is shown so she knows where they come. */
export function PickupDaySheet11({ visible, address, brandName, today, busy, serverError, onBook, onClose }) {
  const [day, setDay] = useState(null);
  const [err, setErr] = useState(null);

  const days = [];
  if (today) {
    const base = new Date(`${today}T00:00:00Z`);
    for (let i = 1; i <= 7; i += 1) {
      const d = new Date(base.getTime() + i * 86400000);
      days.push(d.toISOString().slice(0, 10));
    }
  }

  function book() {
    if (!day) { setErr(MSG11.PICKUP_DAY_PAST); return; }
    setErr(null); onBook(day);
  }

  return (
    <Sheet visible={visible} onClose={onClose} testID="pickup-sheet">
      <Text style={sh.title}>{C11.creator.pickADay}</Text>
      <View style={sh.chips}>
        {days.map((d) => {
          const on = day === d;
          return (
            <Pressable key={d} onPress={() => { setDay(d); setErr(null); }}
              accessibilityRole="button" accessibilityState={{ selected: !!on }}
              testID={`day-${d}`} style={[sh.chip, on && sh.chipOn]}>
              <Text style={[sh.chipText, on && { color: '#FFFFFF' }]}>{pickupDayLabel(d, today)}</Text>
            </Pressable>
          );
        })}
      </View>
      {address ? (
        <View style={sh.addr} testID="pickup-address">
          <Text style={sh.eyebrow}>{C11.creator.yourAddress}</Text>
          <Text style={sh.addrLine}>{address.street}</Text>
          <Text style={sh.addrLine}>{[address.city, address.state, address.pincode].filter(Boolean).join(', ')}</Text>
        </View>
      ) : null}
      <Text style={sh.green} testID="pay-nothing">{C11.creator.payNothing(brandName)}</Text>
      <FieldError text={err || serverError} />
      <View style={{ height: 8 }} />
      <PrimaryButton label={C11.creator.bookPickup} icon="package-variant" onPress={book} busy={busy}
        busyLabel="Booking" testID="pickup-confirm" />
      <SecondaryButton label="Not yet" onPress={onClose} disabled={busy} testID="pickup-cancel" />
    </Sheet>
  );
}

/* ── Q1 · "I've sent it back" ───────────────────────────────────────────── */

/**
 * Where couriers will not collect from her pincode. INFLX books nothing and moves no money;
 * the brand settles the cost with her directly. Her mark is what starts their confirmation
 * clock — deliberately not the brand opening a screen, which could never come.
 */
export function SelfSentSheet11({ visible, brandName, pincode, busy, serverError, onSend, onClose }) {
  const [note, setNote] = useState('');
  // ui-walk-fixes (board C, rule 3): the note box sits just above two buttons. The sheet shrinks
  // to the room above the keypad, its body scrolls, and the buttons are pinned under it with the
  // server's refusal beside them.
  return (
    <Sheet visible={visible} onClose={onClose} testID="self-sent-sheet" fit
      footer={(
        <>
          <FieldError text={serverError} />
          {serverError ? <View style={sh.gap} /> : null}
          <PrimaryButton label={C11.creator.selfSent} icon="check" onPress={() => onSend(note.trim() || null)}
            busy={busy} busyLabel="Marking" testID="self-sent-confirm" />
          <SecondaryButton label="Not yet" onPress={onClose} disabled={busy} testID="self-sent-cancel" />
        </>
      )}>
      <Text style={sh.title}>{C11.creator.selfSent}</Text>
      <Text style={sh.body}>{C11.creator.selfSendTitle(pincode, brandName)}</Text>
      <TextField4 label={C11.creator.selfSentNoteLabel} value={note} onChangeText={setNote}
        placeholder={C11.creator.selfSentNotePlaceholder} max={200} testID="self-sent-note" />
    </Sheet>
  );
}

/* ── R7 · the brand cancels a booking ───────────────────────────────────── */

/**
 * DangerButton, because money comes back and a courier is told. It honours `busy` (check 39).
 */
export function CancelBookingSheet11({ visible, amount, busy, serverError, onConfirm, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="cancel-booking-sheet">
      <Text style={sh.title}>{C11.brand.cancelConfirm}</Text>
      <Text style={sh.body}>{C11.brand.cancelConfirmBody(amount)}</Text>
      <FieldError text={serverError} />
      <View style={{ height: 8 }} />
      <DangerButton label={C11.brand.cancelBooking} onPress={onConfirm} busy={busy}
        busyLabel="Cancelling" testID="cancel-booking-confirm" />
      <SecondaryButton label="Keep it booked" onPress={onClose} disabled={busy} testID="cancel-booking-cancel" />
    </Sheet>
  );
}

/* ── R15a · Return → Gift ───────────────────────────────────────────────── */

/** Only ever in her favour, and only until she books the pickup (§28). */
export function ReturnToGiftSheet11({ visible, line, creatorName, busy, serverError, onConfirm, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="gift-sheet">
      <Text style={sh.title}>{C11.brand.giftTitle(creatorName)}</Text>
      {line ? <Row10 label="Item" value={`${line.name}${line.variantLabel ? ` · ${line.variantLabel}` : ''}`} testID="gift-item" /> : null}
      <Text style={sh.body}>{C11.brand.giftBody}</Text>
      <FieldError text={serverError} />
      <View style={{ height: 8 }} />
      <PrimaryButton label={C11.brand.giftConfirm} icon="gift-outline" onPress={onConfirm} busy={busy}
        busyLabel="Saving" testID="gift-confirm" />
      <SecondaryButton label="Not yet" onPress={onClose} disabled={busy} testID="gift-cancel" />
    </Sheet>
  );
}

/* ── R10 / R13 / R15b · the brand reports to INFLX ──────────────────────── */

/**
 * Three kinds (approval §2.7). Item 11 RECORDS the report and nothing else — dispute handling
 * is item 18's, and the sheet says so rather than implying something will happen now.
 */
export function ReportSheet11({ visible, kind, busy, serverError, onConfirm, onClose }) {
  const TITLE = {
    difference: 'Report this to INFLX?',
    return: 'Report a problem with the return?',
    overdue: 'Report the overdue return?',
  };
  return (
    <Sheet visible={visible} onClose={onClose} testID="report-sheet">
      <Text style={sh.title}>{TITLE[kind] || TITLE.difference}</Text>
      <Text style={sh.body}>{C11.brand.differenceBody}</Text>
      <FieldError text={serverError} />
      <View style={{ height: 8 }} />
      <PrimaryButton label={C11.brand.report} icon="flag-outline" onPress={onConfirm} busy={busy}
        busyLabel="Reporting" testID="report-confirm" />
      <SecondaryButton label="Not now" onPress={onClose} disabled={busy} testID="report-cancel" />
    </Sheet>
  );
}

/* ── R13 · the brand confirms the return, item by item ──────────────────── */

export function ConfirmReturnSheet11({ visible, lines, autoConfirmDueAt, busy, serverError, onConfirm, onClose }) {
  const [answers, setAnswers] = useState({});
  const all = (lines || []).every((l) => answers[l.id]);
  // ui-walk-fixes (board C, rule 3): the list sat in a fixed 320-high scroller that could not give
  // way. The whole body now scrolls inside the Sheet's shrinking shape (the inner scroller is
  // gone) and the two buttons are pinned under it, however many items came back.
  //
  // NO NOTE BOX HERE (final review, 2 Oct 2026). Marking an item Missing or Damaged used to open a
  // note box that kept nothing: the pop-up handed it an empty value and a do-nothing handler, so
  // every letter typed vanished — and the server's confirm step takes { lineId, status } for each
  // item and has nowhere to put a note (remoteReturn.service.js confirmReturn). Item 11's locked
  // frame R13 draws three buttons per item and no note, so the box is simply not drawn
  // (`withNote={false}`); the creator's own check (R9) keeps hers. Letting the brand's note be
  // saved would be new behaviour and a server change — see 06-diff/drift/C2.md.
  return (
    <Sheet visible={visible} onClose={onClose} testID="confirm-return-sheet" fit
      footer={(
        <>
          <FieldError text={serverError} />
          {serverError ? <View style={sh.gap} /> : null}
          <PrimaryButton label={C11.brand.confirmReturn} icon="check" disabled={!all}
            onPress={() => onConfirm(Object.entries(answers).map(([lineId, status]) => ({ lineId, status })))}
            busy={busy} busyLabel="Confirming" testID="confirm-return-confirm" />
          <SecondaryButton label="Not yet" onPress={onClose} disabled={busy} testID="confirm-return-cancel" />
        </>
      )}>
      <Text style={sh.title}>What came back?</Text>
      <View>
        {(lines || []).map((l) => (
          <View key={l.id} style={sh.line} testID={`confirm-line-${l.id}`}>
            <View style={sh.lineHead}>
              <Text style={sh.lineName}>{l.name}</Text>
              <Text style={sh.qty}>{`× ${l.quantity}`}</Text>
            </View>
            <ThreeWayCheck11
              value={answers[l.id] || null}
              onChange={(v) => setAnswers((a) => ({ ...a, [l.id]: v }))}
              withNote={false}
              disabled={busy}
              testID={`confirm-check-${l.id}`}
            />
          </View>
        ))}
      </View>
      {autoConfirmDueAt ? <Text style={sh.body} testID="auto-confirm">{C11.brand.autoConfirms(autoConfirmDueAt)}</Text> : null}
    </Sheet>
  );
}

const sh = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginBottom: 8 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20, marginTop: 6, marginBottom: 6 },
  green: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.state.active.fg, marginTop: 10, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: T.border },
  chipOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipText: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink },
  addr: { backgroundColor: T.surface, borderRadius: 10, padding: 12, marginBottom: 6 },
  addrLine: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 2 },
  line: { borderTopWidth: 1, borderTopColor: T.border, paddingVertical: 12 },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineName: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  qty: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  gap: { height: 8 },
});
