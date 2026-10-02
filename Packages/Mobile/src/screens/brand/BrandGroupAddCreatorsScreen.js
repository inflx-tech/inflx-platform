/**
 * BrandGroupAddCreatorsScreen — G5: pick creators for a group from All creators (the
 * Discover list in select mode, all filters, "Open to invitations" off by default) or from
 * Worked with. Members already in the group are ticked and locked; the 100 cap is enforced.
 *
 * ui-walk-fixes board B, frame B6 (locked 2 Oct 2026): "Adding to {group} · N creators" is the
 * title bar's second line; the list is the compact three-line pick row behind one search +
 * Filters row (DiscoverList), with "Open to invitations only" still OFF here and changed inside
 * Filters; the footer steps away while the keypad is open. The capacity line stays.
 *
 * ui-walk-fixes board C: the footer is a strip in the column, under the list (BottomBar) — it no
 * longer floats over the last rows. It still steps away while the keypad is open (B5), and the
 * toast floats just above it (or just above the keypad while it is away).
 *
 * Contract: features/item3-discovery-profiles-groups · prompt §6.4 G5 · features/ui-walk-fixes
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, EmptyState } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import SegmentedControl from '../../components/shell/SegmentedControl';
import DiscoverList, { MemberRow, LoadErrorList } from '../../components/discovery/DiscoverList';
import { CheckboxRow } from '../../components/discovery/bits';
import useReferenceLists from '../../hooks/useReferenceLists';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';
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
  const { toast, show } = useToast({ inFlow: true });
  // Frame B5: the footer steps out of the way while the keypad is open.
  const typing = useKeyboardVisible();

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
      {/* Board B6: "Adding to … · N creators" is the title bar's second line. */}
      <Header title={G.addTitle} subtitle={G.addingTo(name, group.memberCount)} subtitleTestID="group-add-subline" onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the tabs and the list fill the room above the strip; nothing floats over them. */}
      <FormArea>
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <SegmentedControl segments={G.tabs} value={tab} onChange={setTab} testID="add-tabs" />
      </View>
      {tab === G.tabs[0] ? (
        <DiscoverList key="all" mode="select" defaultOpenOnly={false} fetcher={brandApi.discoverCreators} countFetcher={brandApi.discoverCreators} lists={lists}
          selectedIds={sel} disabledIds={members} disabledLabel={G.alreadyIn} capacityLeft={capacityLeft} onToggleSelect={toggle} />
      ) : (
        <WorkedSelectList selectedIds={sel} disabledIds={members} capacityLeft={capacityLeft} onToggle={toggle} />
      )}
      {toast}
      </FormArea>
      {/* The capacity line is the strip's first child; the strip keeps it 8 above the button. */}
      {typing ? null : (
        <BottomBar testID="group-add-footer">
          <Text style={s.cap} testID="capacity-line">{G.capacity(name, capacityLeft)}</Text>
          <PrimaryButton label={G.addN(sel.size)} onPress={add} disabled={!sel.size} busy={saving} busyLabel="Adding" testID="add-selected" />
        </BottomBar>
      )}
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
        <FlatList data={rows} keyExtractor={r => r.id} contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 24 }}
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
  cap: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, textAlign: 'center' },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
});
