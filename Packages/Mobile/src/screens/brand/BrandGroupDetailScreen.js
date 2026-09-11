/**
 * BrandGroupDetailScreen — G4 (members) · G7 (empty group) · rename · delete.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.4
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { EmptyState, SecondaryButton } from '../../components/settings/primitives';
import { ActionSheet, ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { shortDate, COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { hx } from './BrandCreatorProfileScreen';
import { MemberRow } from '../../components/discovery/DiscoverList';
import { GroupNameSheet } from '../../components/discovery/GroupSheets';
import useRouteToast from '../../hooks/useRouteToast';
import { C3, whenLabel } from '../../components/discovery/copy3';

const G = C3.groups;

export default function BrandGroupDetailScreen({ navigation, route }) {
  const { groupId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [group, setGroup] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState(false);
  const [memberMenu, setMemberMenu] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async (next = 1) => {
    if (next === 1) setStatus(s => (s === 'ready' ? 'ready' : 'loading')); else setStatus('more');
    const r = await brandApi.getGroup(groupId, { page: next });
    if (!r.success) { setStatus('error'); return; }
    setGroup(r.data.group);
    setTotal(r.data.members.total || 0);
    setRows(prev => next === 1 ? (r.data.members.rows || []) : [...prev, ...(r.data.members.rows || [])]);
    setPage(next);
    setStatus('ready');
  }, [groupId]);
  useFocusEffect(useCallback(() => { load(1); }, [load]));

  async function rename(name) {
    const r = await brandApi.renameGroup(groupId, name);
    if (!r.success) return r.error?.message || COPY.saveFailed;
    setGroup(r.data.group || { ...group, name });
    setRenaming(false);
    return null;
  }
  async function remove() {
    setConfirmDelete(false);
    const r = await brandApi.deleteGroup(groupId);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    navigation.navigate('BrandCreators', { segment: 'Groups', toast: G.deleted });
  }
  async function removeMember(m) {
    setMemberMenu(null);
    const r = await brandApi.removeGroupMember(groupId, m.id);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setRows(prev => prev.filter(x => x.id !== m.id));
    setTotal(t => Math.max(0, t - 1));
    if (r.data.group) setGroup(r.data.group);
    show(G.removedMember(m.name, group.name));
  }

  const title = group?.name || route?.params?.name || 'Group';
  const right = (
    <TouchableOpacity onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="More" style={hx.more} testID="group-menu">
      <Text style={hx.moreText}>⋯</Text>
    </TouchableOpacity>
  );
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={() => load(1)} /></View>;

  const when = (group.changed ? G.updated : G.created)(whenLabel(group.changed ? group.updatedAt : group.createdAt, shortDate));
  const goAdd = () => navigation.navigate('BrandGroupAddCreators', { groupId, groupName: group.name });

  return (
    <View style={base.screen} testID="group-detail">
      <Header title={title} onBack={() => navigation.goBack()} right={right} />
      <FlatList
        data={rows}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
        ListHeaderComponent={
          <View>
            <Text style={s.sub} testID="group-header-line">{G.header(group.memberCount, group.openCount, when)}</Text>
            <View style={s.btnRow}>
              <View style={{ flex: 1 }}><SecondaryButton label={G.invite} onPress={() => show(C3.toasts.inviteGroupSoon)} testID="group-invite" /></View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}><SecondaryButton label={G.newCampaign} onPress={() => show(C3.toasts.campaignSoon)} testID="group-campaign" /></View>
            </View>
            <SecondaryButton label={G.addCreators} onPress={goAdd} testID="group-add" />
            <View style={{ height: 8 }} />
          </View>
        }
        ListEmptyComponent={<EmptyState title={G.emptyGroupTitle} body={G.emptyGroupBody} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (rows.length < total && status === 'ready') load(page + 1); }}
        ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
        renderItem={({ item }) => (
          <MemberRow c={item} onOpen={() => navigation.navigate('BrandCreatorProfile', { influencerId: item.id })}
            right={
              <TouchableOpacity onPress={() => setMemberMenu(item)} style={hx.more} accessibilityLabel="Member options" testID={`member-menu-${item.id}`}>
                <Text style={hx.moreText}>⋯</Text>
              </TouchableOpacity>
            } />
        )}
      />
      {toast}
      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={[
        { label: G.menuRename, onPress: () => setRenaming(true) },
        { label: G.menuDelete, destructive: true, onPress: () => setConfirmDelete(true) },
      ]} />
      <ActionSheet visible={!!memberMenu} onClose={() => setMemberMenu(null)} actions={memberMenu ? [
        { label: G.memberView, onPress: () => navigation.navigate('BrandCreatorProfile', { influencerId: memberMenu.id }) },
        { label: G.memberRemove, destructive: true, onPress: () => removeMember(memberMenu) },
      ] : []} />
      <GroupNameSheet visible={renaming} mode="rename" initial={group.name} onSubmit={rename} onClose={() => setRenaming(false)} />
      <ConfirmSheet visible={confirmDelete} danger title={G.deleteTitle(group.name)} body={G.deleteBody(group.memberCount)}
        confirmLabel={G.del} cancelLabel={G.keep} onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  sub: { fontFamily: fonts.sansMedium, fontSize: 13, color: T.ink2, marginBottom: 10 },
  btnRow: { flexDirection: 'row' },
});
