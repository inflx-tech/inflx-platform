/**
 * PlacesCard20 — "Where did you share it?" on the page of a post he made for his own brand
 * (item 20, board S1–S2). His own record: the place (six) and its link. Nobody approves it and
 * nothing depends on it; it sits beside the post's numbers. A story needs no link.
 * Contract: features/item20-own-brand · rules v1.33 §2D
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { Chip, PrimaryButton, SecondaryButton, DangerButton } from '../settings/primitives';
import { Sheet } from '../settings/sheets';
import { O20, day20 } from './copy20';

export default function PlacesCard20({ postId, onToast }) {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);      // the place being changed, or null when adding
  const [place, setPlace] = useState('reel');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await influencerApi.postPlaces(postId);
    if (r.success) setD(r.data);
  }, [postId]);
  useEffect(() => { load(); }, [load]);

  if (!d) return null;
  const option = (d.options || []).find((o) => o.key === place);
  const optional = !!(option && option.link === 'optional');

  function startAdd() { setEditing(null); setPlace('reel'); setLink(''); setErr(''); setOpen(true); }
  function startEdit(p) { setEditing(p); setPlace(p.place); setLink(p.link || ''); setErr(''); setOpen(true); }

  async function run(fn) {
    setBusy(true); setErr('');
    const r = await fn();
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || O20.generic); return; }
    setD(r.data); setOpen(false);
    if (onToast) onToast();
  }
  const save = () => run(() => (editing
    ? influencerApi.updatePostPlace(postId, editing.id, { place, link })
    : influencerApi.addPostPlace(postId, { place, link })));
  const remove = () => run(() => influencerApi.removePostPlace(postId, editing.id));

  return (
    <View style={s.card} testID="places-card">
      <Text style={s.title}>{O20.whereTitle}</Text>
      <Text style={s.hint}>{O20.whereHint}</Text>
      {d.places.map((p) => (
        <TouchableOpacity key={p.id} style={s.row} onPress={() => (d.can_edit ? startEdit(p) : null)} disabled={!d.can_edit} testID={`place-${p.id}`}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={s.name}>{p.label}</Text>
            <Text style={s.link} numberOfLines={1}>{p.link_display || O20.noLink}</Text>
          </View>
          <Text style={s.day}>{day20(p.shared_on)}</Text>
        </TouchableOpacity>
      ))}
      {d.can_edit ? <SecondaryButton label={O20.addPlace} onPress={startAdd} testID="place-add" /> : null}

      <Sheet visible={open} onClose={() => setOpen(false)} testID="place-sheet">
        <Text style={s.sheetTitle}>{editing ? O20.sheetEdit : O20.sheetAdd}</Text>
        <View style={s.chips}>
          {(d.options || []).map((o) => (
            <Chip key={o.key} label={o.label} selected={place === o.key} onPress={() => { setPlace(o.key); setErr(''); }} testID={`place-opt-${o.key}`} />
          ))}
        </View>
        <Text style={s.label}>{O20.linkLabel(optional)}</Text>
        <TextInput style={[s.input, err ? s.inputBad : null]} value={link} onChangeText={(t) => { setLink(t); setErr(''); }} placeholder={O20.linkPlaceholder}
          placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="place-link" />
        {err ? <Text style={s.err} testID="place-error">{err}</Text> : null}
        <Text style={s.hint}>{O20.linkHint(place)}</Text>
        <View style={{ height: 12 }} />
        <PrimaryButton label={O20.save} onPress={save} busy={busy} disabled={busy} testID="place-save" />
        {editing ? <DangerButton outline label={O20.removePlace} onPress={remove} disabled={busy} testID="place-remove" /> : null}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 10 },
  title: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, marginBottom: 2 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  link: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 1 },
  day: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2 },
  sheetTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink },
  inputBad: { borderColor: T.danger },
  err: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.danger, marginTop: 6 },
});
