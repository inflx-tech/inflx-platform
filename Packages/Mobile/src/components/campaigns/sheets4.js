/**
 * Item 4 — the sheets: a one-field text sheet (rename campaign / edit description / rename set),
 * the branch picker (C4), and Duplicate a set (C10).
 * Contract: features/item4-campaigns-sets
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, FieldError } from '../settings/primitives';
import DateField from '../DateField';
import { TextField4 } from './bits4';
import { C4, MSG4, aimLabel4, modeLabel4 } from './copy4';

/** onSubmit(value) resolves to an error message or nothing. */
export function TextSheet4({ visible, title, label, initial = '', max, multiline, placeholder, hint, required = true, emptyMessage, submitLabel, onSubmit, onClose, testID = 'text-sheet' }) {
  const [value, setValue] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setValue(initial || ''); setErr(''); } }, [visible, initial]);
  async function submit() {
    const v = (value || '').trim();
    if (required && !v) { setErr(emptyMessage || ''); return; }
    if (max && v.length > max) { setErr(emptyMessage || ''); return; }
    setBusy(true);
    const e = await onSubmit(v);
    setBusy(false);
    if (e) setErr(e);
  }
  return (
    <Sheet visible={visible} onClose={onClose} testID={testID}>
      <Text style={s.title}>{title}</Text>
      <TextField4 label={label} value={value} onChangeText={(v) => { setValue(v); setErr(''); }} max={max} multiline={multiline} placeholder={placeholder} hint={hint} error={err} autoFocus testID={`${testID}-input`} />
      <PrimaryButton label={submitLabel || C4.detail.save} onPress={submit} busy={busy} testID={`${testID}-submit`} />
      <SecondaryButton label={C4.detail.cancel} onPress={onClose} />
    </Sheet>
  );
}

/** C4 — the brand's branches, main first (the server already orders them so). */
export function BranchSheet4({ visible, branches, value, onPick, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="branch-sheet">
      <Text style={s.title}>{C4.set.branchSheetTitle}</Text>
      {(branches || []).map(b => {
        const on = b.id === value;
        return (
          <TouchableOpacity key={b.id} style={s.row} onPress={() => onPick(b)} accessibilityRole="button" testID={`branch-${b.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowName}>{b.name}{b.isMain ? '  · Main branch' : ''}</Text>
              <Text style={s.rowSub}>{[b.cityName, b.stateName].filter(Boolean).join(', ') || '—'}</Text>
            </View>
            <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 8 }} />
      <SecondaryButton label={C4.detail.cancel} onPress={onClose} />
    </Sheet>
  );
}

/**
 * C10 — Duplicate {set}. onCreate({ name, go_live_date }) resolves to { error, field } or nothing.
 * `set` is the summary shape; `earliest` is dateRules.earliestPostingDate.
 */
export function DuplicateSheet4({ set, earliest, cutoffFor, onCreate, onClose }) {
  const visible = !!set;
  const [name, setName] = useState('');
  const [day, setDay] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setName(C4.duplicate.copyName(set.name)); setDay(null); setErrs({}); } }, [visible]); // eslint-disable-line
  async function create() {
    const e = {};
    if (!name.trim() || name.trim().length > 60) e.name = MSG4.SET_NAME;
    if (!day) e.go_live_date = MSG4.DATE;
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const r = await onCreate({ name: name.trim(), go_live_date: day });
    setBusy(false);
    if (r && r.error) setErrs({ [r.field || 'name']: r.error });
  }
  if (!visible) return null;
  return (
    <Sheet visible={visible} onClose={onClose} testID="duplicate-sheet">
      <Text style={s.title}>{C4.duplicate.title(set.name)}</Text>
      <TextField4 label={C4.duplicate.nameLabel} required value={name} onChangeText={setName} max={60} error={errs.name} testID="duplicate-name" />
      <DateField label={C4.duplicate.dateLabel} value={day} onChange={setDay} minDate={earliest} confirmLabel={C4.set.useDate} error={errs.go_live_date} testID="duplicate-date"
        renderFooter={(pending) => (
          <View>
            <Text style={s.hint}>{C4.set.pickerHint(earliest)}</Text>
            {pending ? <View style={s.cut}><Text style={s.cutText}>{C4.set.pickerCutoff(cutoffFor(pending))}</Text></View> : null}
          </View>
        )} />
      <View style={s.tint}>
        <Text style={s.tintSub}>{C4.duplicate.copiedFrom(set.name)}</Text>
        <Text style={s.tintMain}>{[aimLabel4(set.goal), modeLabel4(set.shootMode), set.branch && set.branch.name].filter(Boolean).join(' · ')}</Text>
      </View>
      <Text style={s.hint}>{C4.duplicate.hint}</Text>
      <View style={{ height: 12 }} />
      <PrimaryButton label={C4.duplicate.create} onPress={create} busy={busy} testID="duplicate-create" />
      <SecondaryButton label={C4.duplicate.cancel} onPress={onClose} />
      <FieldError text={errs.form} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  rowName: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink },
  rowSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: T.ink },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 8 },
  cut: { marginTop: 8, borderRadius: 12, padding: 10, backgroundColor: T.state.waiting.bg },
  cutText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg },
  tint: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginTop: 4 },
  tintSub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2 },
  tintMain: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginTop: 2 },
});
