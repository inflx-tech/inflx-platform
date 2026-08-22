import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * BrandGroupsList — saved groups, rendered INSIDE the Creators tab.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * Founder, 2026-08-22: tapping Groups used to show a page asking you to tap again. It
 * now renders here. The full-screen version still exists for when a group is opened
 * from elsewhere; this is the same list without the extra tap.
 */
export default function BrandGroupsList({ navigation, groups = [], onChanged }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await brandApi.createGroup(name.trim(), []);
    setBusy(false);
    if (!res.success) return Alert.alert('Could not create', res.error?.message || 'Please try again.');
    setNaming(false); setName('');
    if (onChanged) onChanged();
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
      {groups.map(g => {
        const n = Number(g.member_count ?? (g.members || []).length ?? 0);
        return (
          <TouchableOpacity
            key={String(g.id)}
            style={s.row}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('BrandGroupDetail', { groupId: g.id, groupName: g.name })}
          >
            <View style={s.av}><Text style={s.avT}>{String(g.name || 'G').slice(0, 2).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{g.name}</Text>
              <Text style={s.sub}>{n} creator{n === 1 ? '' : 's'}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={ig.mut2} />
          </TouchableOpacity>
        );
      })}

      <View style={{ padding: 16 }}>
        <TouchableOpacity style={s.newBtn} onPress={() => setNaming(true)} activeOpacity={0.85}>
          <Text style={s.newT}>+ New group</Text>
        </TouchableOpacity>
        <View style={s.explain}>
          <Text style={s.explainH}>What a group is</Text>
          <Text style={s.explainT}>
            A list you keep. Asking a group sends one message to each member — then you
            negotiate with each one separately. It never merges the deals.
          </Text>
        </View>
      </View>

      <Modal visible={naming} transparent animationType="fade" onRequestClose={() => setNaming(false)}>
        <View style={s.modalWrap}>
          <View style={s.modal}>
            <Text style={s.modalH}>Name this group</Text>
            <TextInput style={s.input} placeholder="Vijayawada fashion" placeholderTextColor={ig.mut2}
              value={name} onChangeText={setName} autoFocus />
            <Text style={s.modalHint}>Add creators to it from search, or from a creator's profile.</Text>
            <TouchableOpacity style={s.modalPri} onPress={create} disabled={busy} activeOpacity={0.85}>
              <Text style={s.modalPriT}>{busy ? 'Creating…' : 'Create'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSec} onPress={() => { setNaming(false); setName(''); }} activeOpacity={0.85}>
              <Text style={s.modalSecT}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  av: { width: 38, height: 38, borderRadius: 11, backgroundColor: ig.text, alignItems: 'center', justifyContent: 'center' },
  avT: { color: ig.bg, fontSize: 12, fontWeight: '800' },
  name: { fontSize: 13.5, fontWeight: '800', color: ig.text },
  sub: { fontSize: 11.5, color: ig.text2, fontWeight: '600', marginTop: 2 },
  newBtn: { borderWidth: 1, borderColor: ig.line, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  newT: { color: ig.text, fontSize: 13, fontWeight: '800' },
  explain: { backgroundColor: ig.bgSoft, borderRadius: 11, padding: 13, marginTop: 16 },
  explainH: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 6 },
  explainT: { fontSize: 12, color: ig.text2, fontWeight: '600', lineHeight: 18 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 28 },
  modal: { backgroundColor: ig.bg, borderRadius: 14, padding: 18 },
  modalH: { fontSize: 15, fontWeight: '800', color: ig.text, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 11, fontSize: 14, fontWeight: '700', color: ig.text },
  modalHint: { fontSize: 11.5, color: ig.mut, fontWeight: '600', marginTop: 8 },
  modalPri: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  modalPriT: { color: ig.bg, fontSize: 13, fontWeight: '800' },
  modalSec: { paddingVertical: 12, alignItems: 'center' },
  modalSecT: { color: ig.mut, fontSize: 13, fontWeight: '700' },
});
