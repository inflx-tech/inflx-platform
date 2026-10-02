/**
 * Item 14 — the two bottom sheets: where she will share a post (S7), and the brand telling INFLX
 * what's wrong (S22). Contract: features/item14-sale-going-live · board v2
 *
 * Items 7–12's two rules: a refusal from the server is rendered INSIDE the sheet, and every
 * confirm honours `busy` — and so does its back.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, FieldError } from '../settings/primitives';
import { TextField4 } from '../campaigns/bits4';
import { C14 } from './copy14';

function Option({ selected, label, sub, onPress, radio, testID }) {
  return (
    <TouchableOpacity style={[s.opt, selected && s.optOn]} onPress={onPress} accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: !!selected }} testID={testID}>
      <View style={[radio ? s.radio : s.check, selected && (radio ? s.radioOn : s.checkOn)]}>
        {selected && !radio ? <Text style={s.tick}>✓</Text> : null}
        {selected && radio ? <View style={s.dot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.optLabel}>{label}</Text>
        {sub ? <Text style={s.optSub}>{sub}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

/** S7 — pick one or more places for one approved post. Places already used for it are left out. */
export function DestinationSheet14({ visible, post, destinations, taken, busy, serverError, onAdd, onClose }) {
  const [picked, setPicked] = useState([]);
  useEffect(() => { if (visible) setPicked([]); }, [visible]);
  const list = (destinations || []).filter((d) => !(taken || []).includes(d.type));
  const toggle = (type) => setPicked((p) => (p.includes(type) ? p.filter((x) => x !== type) : [...p, type]));
  // ui-walk-fixes (board C, rule 3): no text box, but the first time a post is shared all six
  // places are offered, and that list with its title, hint and two buttons is as tall as a short
  // phone has room for — "Back" ended up at, or past, the bottom edge. The places now scroll inside
  // the sheet and the two buttons are pinned under them, with the server's refusal beside them.
  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose} testID="destination-sheet" fit
      footer={(
        <>
          <FieldError text={serverError} />
          {serverError ? <View style={s.gap} /> : null}
          <PrimaryButton label={C14.addRows(picked.length)} disabled={!picked.length} onPress={() => onAdd(picked)} busy={busy} busyLabel="Adding" testID="dest-add" />
          <SecondaryButton label={C14.back} onPress={() => { if (!busy) onClose(); }} testID="dest-back" />
        </>
      )}>
      <Text style={s.title}>{C14.whereTitle(post ? post.title : '')}</Text>
      <Text style={s.body}>{C14.whereHint}</Text>
      {list.map((d) => (
        <Option key={d.type} selected={picked.includes(d.type)} label={d.label} sub={d.isStory ? C14.storyProof : null}
          onPress={() => toggle(d.type)} testID={`dest-${d.type}`} />
      ))}
    </Sheet>
  );
}

/**
 * S22 — the brand tells INFLX. The reasons offered are the ones the server will accept now
 * (`can`): after she posted all three; after approval with the posting date gone, "she hasn't
 * posted it"; once the rounds are used, the rounds report (item 12's).
 */
export function ReportSheet14({ visible, kinds, busy, serverError, onReport, onClose }) {
  const [kind, setKind] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { if (visible) { setKind((kinds || [])[0] || null); setNote(''); setErr(null); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  function go() {
    const n = note.trim();
    if (n.length > 500) { setErr('Keep it under 500 characters.'); return; }
    setErr(null); onReport(kind, n || null);
  }
  // ui-walk-fixes (board C, rule 3): the note box sits under the list of reasons. The sheet
  // shrinks to the room above the keypad, its body scrolls, and the two buttons are pinned under
  // it with the server's refusal beside them.
  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose} testID="sale-report-sheet" fit
      footer={(
        <>
          <FieldError text={serverError} />
          {serverError ? <View style={s.gap} /> : null}
          <DangerButton label={C14.tellInflx} onPress={go} disabled={!kind} busy={busy} busyLabel="Sending" testID="sale-report-confirm" />
          <SecondaryButton label={C14.back} onPress={() => { if (!busy) onClose(); }} testID="sale-report-back" />
        </>
      )}>
      <Text style={s.title}>{C14.reportTitle}</Text>
      {(kinds || []).map((k) => (
        <Option key={k} radio selected={kind === k} label={k === 'rounds_used' ? C14.roundsUsed : C14.reasons[k]} onPress={() => setKind(k)} testID={`reason-${k}`} />
      ))}
      <TextField4 value={note} onChangeText={setNote} placeholder={C14.reportNote} max={500} multiline error={err} testID="sale-report-note" />
      <Text style={[s.small, s.smallLast]}>{C14.reportStops}</Text>
    </Sheet>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginBottom: 6 },
  body: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 19, marginBottom: 10 },
  small: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginVertical: 8 },
  // The last line of a scrolling body: the pinned footer already keeps 12 above its button.
  smallLast: { marginBottom: 0 },
  gap: { height: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: T.border, borderRadius: 12, padding: 11, marginBottom: 8, backgroundColor: '#FFFFFF' },
  optOn: { borderColor: T.ink, backgroundColor: T.surface },
  optLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink },
  optSub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 1 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: T.ink, borderColor: T.ink },
  tick: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.sansBold },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: T.ink },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.ink },
});
