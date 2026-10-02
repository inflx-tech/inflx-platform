/**
 * Item 5 — the bottom sheets: the decline sheet (I14) and "View terms sent" (I10).
 * Contract: features/item5-invitations
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { SecondaryButton, DangerButton, FieldError, Chip } from '../settings/primitives';
import { TextField4 } from '../campaigns/bits4';
import { KV5 } from './bits5';
import { C5, MSG5, DECLINE_REASONS, rupees5, fmtPct5, aimLabel5, modeLabel5, longDate5, MIN_SHOPPABLE_POSTS } from './copy5';

/* creator-terms-v2 (rules 1.13, 2.2): the follower-offer sheet (I6), the special-offer sheet (I7),
 * the category / products scope picker and their preview box are retired. What a brand gives a
 * creator to sell is now chosen in sellSheets.js (offers + products without offers). */

/* ─────────────────────────────────────────────────────── I14 decline */

export function DeclineSheet5({ visible, onDecline, onClose, busy }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setReason(null); setNote(''); setErr(''); } }, [visible]);
  function go() {
    if (!reason) { setErr(MSG5.DECLINE_REASON); return; }
    if (note.length > 200) { setErr(MSG5.DECLINE_NOTE_LONG); return; }
    onDecline({ reason, note: note.trim() || undefined });
  }
  // ui-walk-fixes (board C, rule 3): the note box sits low in a tall sheet, so the keypad covered
  // it and both buttons. The sheet now shrinks to the room above the keypad, its body scrolls, and
  // the two buttons are pinned under it. The refusal ("Choose a reason.") sits with the buttons,
  // where it is seen however far the body has scrolled. While the decline is running the red
  // button shows its spinner (it used to swap its label for "…").
  return (
    <Sheet visible={visible} onClose={onClose} testID="decline-sheet" fit
      footer={(
        <>
          <FieldError text={err} />
          {err ? <View style={s.gap} /> : null}
          <DangerButton label={C5.creator.detail.declineButton} onPress={go} busy={!!busy} busyLabel="Declining" testID="decline-confirm" />
          <SecondaryButton label={C5.creator.detail.notYet} onPress={onClose} />
        </>
      )}>
      <Text style={s.eyebrow}>{C5.creator.detail.decline.toUpperCase()}</Text>
      <Text style={s.title}>{C5.creator.detail.declineTitle}</Text>
      <View style={s.chips}>{DECLINE_REASONS.map(([code, label]) => <Chip key={code} label={label} selected={reason === code} onPress={() => { setReason(code); setErr(''); }} testID={`reason-${code}`} />)}</View>
      <TextField4 label={C5.creator.detail.anythingElse} value={note} onChangeText={setNote} max={200} multiline hint={C5.creator.detail.declineHint} testID="decline-note" />
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────── I10 terms sent */

/** The terms exactly as sent, read-only (server shape: invitation.terms). */
export function TermsSentSheet5({ visible, invitation, onClose }) {
  const t = invitation && invitation.terms;
  // ui-walk-fixes (board C, rule 3): no text box, but Hybrid terms are seven lines — several of
  // them two lines long — and the note under them can run to 300 characters. Together that is
  // taller than a short phone has room for, and "Close" fell off the bottom. The terms now scroll
  // inside the sheet and "Close" is pinned under them.
  return (
    <Sheet visible={visible} onClose={onClose} testID="terms-sent-sheet" fit
      footer={<SecondaryButton inline label="Close" onPress={onClose} />}>
      <Text style={s.title}>{C5.set.termsTitle}</Text>
      {t ? (
        <View>
          {t.commissionPct != null ? <KV5 k={C5.terms.commission} v={fmtPct5(t.commissionPct)} /> : null}
          {t.fee != null ? <KV5 k={t.goal === 'hybrid' ? C5.terms.fixedFee : C5.terms.fee} v={rupees5(t.fee)} /> : null}
          {t.sell ? <KV5 k={C5.terms.sell} v={t.sell.words} /> : null}
          {t.scope ? <KV5 k={C5.terms.sell} v={t.scope.words} /> : null}
          {t.offer ? <KV5 k={C5.terms.offer} v={t.offer.kind === 'none' ? C5.terms.none : (t.offer.name || C5.offer.specialLine)} /> : null}
          {t.shoppablePostsMin != null ? <KV5 k={C5.terms.shoppable} v={C5.terms.shoppableValue(t.shoppablePostsMin || MIN_SHOPPABLE_POSTS)} /> : null}
          {t.deliverablesWords ? <KV5 k={C5.terms.delivers} v={t.deliverablesWords} /> : null}
          {t.usageRights ? <KV5 k={C5.terms.reuse} v={t.usageRights.words} /> : null}
          {t.note ? <Text style={s.quote}>“{t.note}”</Text> : null}
          <Text style={s.hint}>{C5.set.termsHint}</Text>
        </View>
      ) : <Text style={s.hint}>…</Text>}
    </Sheet>
  );
}

const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 4 },
  title: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, marginBottom: 12 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginTop: 10, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 6 },
  link: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  rowName: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink },
  rowSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  radioOn: { borderColor: T.ink },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.ink },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { borderColor: T.ink },
  sub: { paddingLeft: 8, marginBottom: 8 },
  preview: { backgroundColor: T.surface, borderRadius: 12, padding: 12, marginTop: 8 },
  previewMain: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  previewSub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 4, lineHeight: 17 },
  field: { height: 44, borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', marginBottom: 6 },
  fieldText: { fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, fontStyle: 'italic', marginTop: 10, lineHeight: 18 },
  gap: { height: 8 },
});

export { aimLabel5, modeLabel5, longDate5 };
