/**
 * BrandGroupAddCreatorsScreen — G5: pick creators for a group from All creators (the
 * Discover list in select mode, all filters, "Open to invitations" off by default) or from
 * Worked with. Members already in the group are ticked and locked; the 100 cap is enforced.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.4 G5
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, EmptyState } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import SegmentedControl from '../../components/shell/SegmentedControl';
import DiscoverList, { MemberRow, LoadErrorList } from '../../components/discovery/DiscoverList';
import { CheckboxRow } from '../../components/discovery/bits';
import useReferenceLists from '../../hooks/useReferenceLists';
import { C3 } from '../../components/discovery/copy3';

const G = C3.groups;

export default function BrandGroupAddCreatorsScreen({ navigation, route }) {
  const { groupId, groupName } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [members, setMembers] = useState(new Set());
  const [group, setGroup] = useState(null);
  const [tab, setTab] = useState(G.tabs[0]);
  const [sel, setSel] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const lists = useReferenceLists();
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.getGroup(groupId, { page: 'all' });
    if (!r.success) { setStatus('error'); return; }
    setGroup(r.data.group);
    setMembers(new Set(r.data.memberIds || []));
    setStatus('ready');
  }, [groupId]);
  useEffect(() => { load(); }, [load]);

  const capacityLeft = group ? Math.max(0, group.capacityLeft - sel.size) : 0;
  function toggle(c) {
    setSel(prev => {
      const n = new Set(prev);
      if (n.has(c.id)) n.delete(c.id);
      else if (group && n.size < group.capacityLeft) n.add(c.id);
      return n;
    });
  }
  async function add() {
    setSaving(true);
    const r = await brandApi.addGroupMembers(groupId, [...sel]);
    setSaving(false);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    navigation.navigate('BrandGroupDetail', { groupId, toast: G.addedN(r.data.added, groupName) });
  }

  const name = group?.name || groupName || 'Group';
  if (status === 'loading') return <View style={base.screen}><Header title={G.addTitle} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={G.addTitle} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen} testID="group-add-creators">
      <Header title={G.addTitle} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <Text style={s.sub}>{G.addingTo(name, group.memberCount)}</Text>
        <SegmentedControl segments={G.tabs} value={tab} onChange={setTab} testID="add-tabs" />
      </View>
      {tab === G.tabs[0] ? (
        <DiscoverList key="all" mode="select" defaultOpenOnly={false} fetcher={brandApi.discoverCreators} countFetcher={brandApi.discoverCreators} lists={lists}
          selectedIds={sel} disabledIds={members} disabledLabel={G.alreadyIn} capacityLeft={capacityLeft} onToggleSelect={toggle} />
      ) : (
        <WorkedSelectList selectedIds={sel} disabledIds={members} capacityLeft={capacityLeft} onToggle={toggle} />
      )}
      <View style={s.footer}>
        <Text style={s.cap} testID="capacity-line">{G.capacity(name, capacityLeft)}</Text>
        <PrimaryButton label={G.addN(sel.size)} onPress={add} disabled={!sel.size} busy={saving} busyLabel="Adding" testID="add-selected" />
      </View>
      {toast}
    </View>
  );
}

function WorkedSelectList({ selectedIds, disabledIds, capacityLeft, onToggle }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');
  const seq = useRef(0);
  const load = useCallback(async (next = 1) => {
    const my = ++seq.current;
    setStatus(next === 1 ? 'loading' : 'more');
    const r = await brandApi.workedWith({ search: search.trim() || undefined, page: next });
    if (my !== seq.current) return;
    if (!r.success) { setStatus('error'); return; }
    setTotal(r.data.total || 0);
    const mapped = (r.data.rows || []).map(w => ({ id: w.influencerId, name: w.name, avatarUrl: w.avatarUrl, instagramHandle: w.instagramHandle, collaborations: w.collaborations }));
    setRows(prev => next === 1 ? mapped : [...prev, ...mapped]);
    setPage(next);
    setStatus('ready');
  }, [search]);
  useEffect(() => { const t = setTimeout(() => load(1), search ? 350 : 0); return () => clearTimeout(t); }, [load]); // eslint-disable-line
  return (
    <View style={{ flex: 1 }} testID="worked-select">
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder={C3.discover.search} placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} testID="worked-search" />
      </View>
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadErrorList what="creators" onRetry={() => load(1)} /> : (
        <FlatList data={rows} keyExtractor={r => r.id} contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 140 }}
          onEndReachedThreshold={0.4} onEndReached={() => { if (rows.length < total && status === 'ready') load(page + 1); }}
          ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={<EmptyState title={C3.worked.emptyTitle} body={C3.worked.emptyBody} />}
          renderItem={({ item }) => {
            const disabled = disabledIds.has(item.id);
            const checked = disabled || selectedIds.has(item.id);
            return (
              <CheckboxRow checked={checked} disabled={disabled || (!checked && capacityLeft <= 0)} onPress={() => onToggle(item)} testID={`select-${item.id}`}>
                <MemberRow c={item} sub={disabled ? G.alreadyIn : C3.worked.row(item.collaborations, '').replace(/ · (last )?signed $/, '')} />
              </CheckboxRow>
            );
          }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sub: { fontFamily: fonts.sansMedium, fontSize: 13, color: T.ink2, marginBottom: 10 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
  cap: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, textAlign: 'center', marginBottom: 8 },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
});
