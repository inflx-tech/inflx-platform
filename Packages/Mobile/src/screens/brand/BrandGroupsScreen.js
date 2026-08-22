import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * BrandGroupsScreen — saved lists of creators.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * The list has existed on the server for months, complete with add, rename, delete and
 * bulk membership — and has never had a screen on the phone. This is its first one.
 *
 * A group is a list you KEEP. Asking it sends one message to each member and then you
 * negotiate with each separately — it never merges the deals. That sentence is on the
 * screen because "group" otherwise implies one shared conversation, which it is not.
 */
export default function BrandGroupsScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await brandApi.listGroups();
    if (res.success) setGroups(res.data?.groups || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await brandApi.createGroup(name.trim(), []);
    setBusy(false);
    if (!res.success) return Alert.alert('Could not create', res.error?.message || 'Please try again.');
    setNaming(false); setName('');
    await load();
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.navTitle}>Groups</Text>
          <Text style={s.navSub}>{groups.length} SAVED LIST{groups.length === 1 ? '' : 'S'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={ig.text} /></View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => String(g.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}
          renderItem={({ item }) => {
            const n = Number(item.member_count ?? (item.members || []).length ?? 0);
            return (
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BrandGroupDetail', { groupId: item.id, groupName: item.name })}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarT}>{String(item.name || 'G').slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{item.name}</Text>
                  <Text style={s.rowSub}>
                    {n} creator{n === 1 ? '' : 's'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={ig.mut2} />
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
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
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="account-multiple-outline" size={30} color={ig.mut2} />
              <Text style={s.emptyT}>No groups yet</Text>
              <Text style={s.emptyS}>
                Save a set of creators once, then ask them all whenever you have something new.
              </Text>
            </View>
          }
          contentContainerStyle={groups.length === 0 ? { flexGrow: 1 } : { paddingBottom: 28 }}
        />
      )}

      <Modal visible={naming} transparent animationType="fade" onRequestClose={() => setNaming(false)}>
        <View style={s.modalWrap}>
          <View style={s.modal}>
            <Text style={s.modalH}>Name this group</Text>
            <TextInput
              style={s.input}
              placeholder="South India · fashion"
              placeholderTextColor={ig.mut2}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Text style={s.modalHint}>You can add creators to it from search or from a profile.</Text>
            <TouchableOpacity style={s.modalPri} onPress={create} disabled={busy} activeOpacity={0.85}>
              <Text style={s.modalPriT}>{busy ? 'Creating…' : 'Create'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSec} onPress={() => { setNaming(false); setName(''); }} activeOpacity={0.85}>
              <Text style={s.modalSecT}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 19, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.3 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  avatar: { width: 38, height: 38, borderRadius: 11, backgroundColor: ig.text, alignItems: 'center', justifyContent: 'center' },
  avatarT: { color: ig.bg, fontSize: 12, fontWeight: '800' },
  rowName: { fontSize: 13.5, fontWeight: '800', color: ig.text },
  rowSub: { fontSize: 11.5, color: ig.text2, fontWeight: '600', marginTop: 2 },

  newBtn: { borderWidth: 1, borderColor: ig.line, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  newT: { color: ig.text, fontSize: 13, fontWeight: '800' },
  explain: { backgroundColor: ig.bgSoft, borderRadius: 11, padding: 13, marginTop: 16 },
  explainH: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 6 },
  explainT: { fontSize: 12, color: ig.text2, fontWeight: '600', lineHeight: 18 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyT: { fontSize: 15, fontWeight: '700', color: ig.text, marginTop: 12 },
  emptyS: { fontSize: 12.5, color: ig.mut, marginTop: 5, textAlign: 'center', lineHeight: 18 },

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
