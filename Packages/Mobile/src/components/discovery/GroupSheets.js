/**
 * Item 3 — G3 GroupNameSheet (new / rename) and G6 AddToGroupSheet (one creator ↔ many groups).
 * Contract: features/item3-discovery-profiles-groups · prompt §6.4
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, FieldError } from '../settings/primitives';
import { Skeleton } from '../settings/feedback';
import { COPY } from '../settings/copy';
import { CheckboxRow } from './bits';
import { C3, MSG3 } from './copy3';

const G = C3.groups;

/** onSubmit(name) resolves to an error message (string) or nothing on success. */
export function GroupNameSheet({ visible, mode = 'create', initial = '', onSubmit, onClose }) {
  const [name, setName] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setName(initial); setErr(''); } }, [visible, initial]);
  const clientErr = !name.trim() ? MSG3.GROUP_NAME : name.trim().length > 40 ? MSG3.GROUP_NAME_LONG : '';
  async function submit() {
    if (clientErr) { setErr(clientErr); return; }
    setBusy(true);
    const e = await onSubmit(name.trim());
    setBusy(false);
    if (e) setErr(e);
  }
  return (
    <Sheet visible={visible} onClose={onClose} testID="group-name-sheet">
      <Text style={s.title}>{mode === 'rename' ? G.renameTitle : G.sheetTitle}</Text>
      <Text style={s.label}>{G.nameLabel}</Text>
      <TextInput style={s.input} value={name} onChangeText={(v) => { setName(v); setErr(''); }} placeholder={G.namePlaceholder} placeholderTextColor={T.ink3} autoFocus maxLength={60} testID="group-name-input" />
      <Text style={s.counter}>{name.trim().length} / 40</Text>
      <FieldError text={err} />
      <Text style={s.hint}>{G.nameHint}</Text>
      <View style={{ height: 12 }} />
      <PrimaryButton label={mode === 'rename' ? G.save : G.create} onPress={submit} busy={busy} disabled={!!clientErr && !!name} testID="group-name-submit" />
      <SecondaryButton label={G.cancel} onPress={onClose} />
    </Sheet>
  );
}

/**
 * G6 — `creator` {id, name}; null hides the sheet. onDone(message) fires after a save.
 * Groups the creator is already in come pre-checked; unticking removes her. Full groups she
 * is not in are greyed. "New group" creates one and ticks it.
 */
export function AddToGroupSheet({ creator, onClose, onDone }) {
  const visible = !!creator;
  const [status, setStatus] = useState('loading');
  const [groups, setGroups] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [initial, setInitial] = useState(new Set());
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setStatus('loading');
    const r = await brandApi.groupsForCreator(creator.id);
    if (!r.success) { setStatus('error'); return; }
    const gs = r.data.groups || [];
    setGroups(gs);
    const inSet = new Set(gs.filter(g => g.contains).map(g => g.id));
    setSel(new Set(inSet)); setInitial(inSet);
    setStatus('ready');
  }
  useEffect(() => { if (visible) { setErr(''); load(); } }, [visible, creator?.id]); // eslint-disable-line

  function toggle(g) { setSel(prev => { const n = new Set(prev); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; }); }

  async function createGroup(name) {
    const r = await brandApi.createGroup(name);
    if (!r.success) return r.error?.message || COPY.saveFailed;
    const g = r.data.group;
    setGroups(prev => [{ id: g.id, name: g.name, memberCount: 0, contains: false, capacityLeft: 100 }, ...prev]);
    setSel(prev => new Set([...prev, g.id]));
    setNaming(false);
    return null;
  }

  async function save() {
    const ids = [...sel];
    const changed = ids.length !== initial.size || ids.some(id => !initial.has(id));
    if (!changed) { onClose(); return; }
    setBusy(true);
    const r = await brandApi.setGroupsForCreator(creator.id, ids);
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || COPY.saveFailed); return; }
    const { added = [], removed = [] } = r.data;
    let msg = G.updatedMany;
    if (added.length === 1 && !removed.length) msg = G.addedTo(added[0].name);
    else if (removed.length === 1 && !added.length) msg = G.removedFrom(removed[0].name);
    onClose();
    onDone && onDone(msg);
  }

  return (
    <Sheet visible={visible} onClose={onClose} testID="add-to-group-sheet">
      <Text style={s.title}>{creator ? G.toTitle(creator.name) : ''}</Text>
      {status === 'loading' ? <Skeleton rows={3} /> : status === 'error' ? <Text style={s.hint}>{COPY.loadErrorBody}</Text> : (
        <ScrollView style={{ maxHeight: 360 }}>
          <TouchableOpacity style={s.newRow} onPress={() => setNaming(true)} testID="add-to-group-new">
            <Text style={s.newText}>＋ {G.newGroup}</Text>
          </TouchableOpacity>
          {groups.map(g => {
            const on = sel.has(g.id);
            const full = !on && g.capacityLeft <= 0;
            return (
              <CheckboxRow key={g.id} checked={on} disabled={full} onPress={() => toggle(g)} testID={`add-to-group-${g.id}`}>
                <Text style={s.gName} numberOfLines={1}>{g.name}</Text>
                <Text style={s.gMeta}>{G.rowN(g.memberCount)}{g.contains ? ` ${G.alreadyInShort}` : ''}{full ? ` · ${MSG3.GROUP_FULL(g.name)}` : ''}</Text>
              </CheckboxRow>
            );
          })}
          {!groups.length ? <Text style={s.hint}>{G.emptyBody}</Text> : null}
        </ScrollView>
      )}
      <FieldError text={err} />
      <View style={{ height: 12 }} />
      <PrimaryButton label={G.save} onPress={save} busy={busy} disabled={status !== 'ready'} testID="add-to-group-save" />
      <SecondaryButton label={G.cancel} onPress={onClose} />
      <GroupNameSheet visible={naming} onSubmit={createGroup} onClose={() => setNaming(false)} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginBottom: 12 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, marginBottom: 8 },
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, textAlign: 'right', marginTop: 4 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 8 },
  newRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  newText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  gName: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  gMeta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
});
