import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * BrandGroupDetailScreen — one saved list, and asking all of it at once.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * "Ask this whole group" runs the SAME reach check a filtered send does, deliberately.
 * A group is a list the brand keeps, so its members drift: someone mutes brand requests,
 * someone already has an open request. Sending to fourteen and reaching eleven without
 * saying so reads as "three people ignored me".
 */
export default function BrandGroupDetailScreen({ route, navigation }) {
  const { groupId, groupName } = route.params || {};
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await brandApi.listGroups();
    if (res.success) {
      setGroup((res.data?.groups || []).find(g => String(g.id) === String(groupId)) || null);
    }
    setLoading(false);
  }, [groupId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const members = group?.members || [];

  async function removeMember(m) {
    Alert.alert(
      'Remove from this group?',
      `${m.full_name || m.instagram_handle} stays on the platform — they just leave this list.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const res = await brandApi.removeFromGroup(groupId, m.influencer_id || m.id);
            setBusy(false);
            if (!res.success) return Alert.alert('Could not remove', res.error?.message || 'Please try again.');
            await load();
          },
        },
      ],
    );
  }

  function deleteGroup() {
    Alert.alert(
      'Delete this group?',
      'The list goes. Every creator on it stays exactly as they are, and any conversation you have already started is untouched.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await brandApi.deleteGroup(groupId);
            if (!res.success) return Alert.alert('Could not delete', res.error?.message || 'Please try again.');
            navigation.goBack();
          },
        },
      ],
    );
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={ig.text} /></View>;

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.navTitle}>{group?.name || groupName || 'Group'}</Text>
          <Text style={s.navSub}>{members.length} CREATOR{members.length === 1 ? '' : 'S'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={s.sec}>
          {members.length > 0 ? (
            <TouchableOpacity
              style={s.pri}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('BrandAskMany', { groupId, groupName: group?.name })}
            >
              <Text style={s.priT}>Ask this whole group</Text>
            </TouchableOpacity>
          ) : (
            /* An empty group cannot be asked. Saying so beats a button that fails. */
            <View style={s.off}><Text style={s.offT}>Add creators before you can ask this group</Text></View>
          )}
          <TouchableOpacity
            style={s.sec2}
            activeOpacity={0.85}
            /* Was 'BrandInfluencerBrowse' — the OLD creator search, which has never heard of
                groups. It was handed addToGroupId, ignored it, and opened a profile on tap
                with "add to campaign" and "request collaboration". There was no way to add
                anyone to a group.
                'BrandFindCreators' is the screen that understands the mode: it ticks rows
                instead of opening profiles, and shows an "Add to group" button.
                Contract: features/stage-1-find-each-other-and-agree */
              onPress={() => navigation.navigate('BrandFindCreators', { addToGroupId: groupId })}
          >
            <Text style={s.sec2T}>Add more creators</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionH}>Members</Text>
        {members.map(m => (
          <View key={String(m.influencer_id || m.id)} style={s.row}>
            <View style={s.avatar}>
              <Text style={s.avatarT}>
                {String(m.full_name || m.instagram_handle || 'C').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowName}>{m.full_name || m.instagram_handle}</Text>
              <Text style={s.rowSub}>
                {[m.city, m.followers_count ? `${Number(m.followers_count).toLocaleString('en-IN')} followers` : null]
                  .filter(Boolean).join(' · ')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeMember(m)} disabled={busy} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={17} color={ig.mut2} />
            </TouchableOpacity>
          </View>
        ))}

        {members.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyS}>Nobody in this list yet.</Text>
          </View>
        )}

        <View style={s.sec}>
          <TouchableOpacity style={s.danger} onPress={deleteGroup} activeOpacity={0.85}>
            <Text style={s.dangerT}>Delete group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg },
  nav: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 18, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.3 },

  sec: { paddingHorizontal: 16, paddingVertical: 14 },
  sectionH: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', paddingHorizontal: 16, paddingBottom: 6 },

  pri: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  priT: { color: ig.bg, fontSize: 13.5, fontWeight: '800' },
  sec2: { borderWidth: 1, borderColor: ig.line, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 9 },
  sec2T: { color: ig.text, fontSize: 13, fontWeight: '800' },
  off: { backgroundColor: ig.bgSoft, borderWidth: 1, borderColor: ig.lineSoft, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  offT: { color: ig.mut, fontSize: 12.5, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  avatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: ig.text, alignItems: 'center', justifyContent: 'center' },
  avatarT: { color: ig.bg, fontSize: 11.5, fontWeight: '800' },
  rowName: { fontSize: 13, fontWeight: '800', color: ig.text },
  rowSub: { fontSize: 11.5, color: ig.mut, fontWeight: '600', marginTop: 2 },

  empty: { padding: 24, alignItems: 'center' },
  emptyS: { fontSize: 12.5, color: ig.mut, fontWeight: '600' },

  danger: { borderWidth: 1, borderColor: '#F0C4BA', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  dangerT: { color: ig.red, fontSize: 13, fontWeight: '800' },
});
