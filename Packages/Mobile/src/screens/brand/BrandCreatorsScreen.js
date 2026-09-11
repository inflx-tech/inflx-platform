/**
 * BrandCreatorsScreen — D1: the Creators tab. Four segments: Discover (D1/D2), Groups
 * (G1/G2), Pitches (coming soon) and Worked with (W1).
 * Contract: features/item3-discovery-profiles-groups · prompt §6.2–§6.5
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { EmptyState, PrimaryButton } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { shortDate, COPY } from '../../components/settings/copy';
import { s as base } from './BrandPitchSettingsScreen';
import { Avatar } from './BrandBlockedCreatorsScreen';
import SegmentedControl from '../../components/shell/SegmentedControl';
import DiscoverList, { LoadErrorList } from '../../components/discovery/DiscoverList';
import { AvatarStack } from '../../components/discovery/bits';
import { GroupNameSheet, AddToGroupSheet } from '../../components/discovery/GroupSheets';
import useReferenceLists from '../../hooks/useReferenceLists';
import useRouteToast from '../../hooks/useRouteToast';
import { C3, whenLabel } from '../../components/discovery/copy3';

const G = C3.groups;
const W = C3.worked;

export default function BrandCreatorsScreen({ navigation, route }) {
  const [segment, setSegment] = useState(route?.params?.segment || 'Discover');
  const lists = useReferenceLists();
  const { toast, show } = useToast();
  const [addTo, setAddTo] = useState(null);
  useRouteToast(navigation, route, show);
  useEffect(() => {
    if (route?.params?.segment) { setSegment(route.params.segment); navigation.setParams({ segment: undefined }); }
  }, [route?.params?.segment]); // eslint-disable-line

  const openCreator = (c) => navigation.navigate('BrandCreatorProfile', { influencerId: c.id || c.influencerId });

  return (
    <View style={base.screen} testID="brand-creators">
      <View style={{ paddingTop: 54, paddingHorizontal: 18, paddingBottom: 8 }}>
        <Text style={s.title}>Creators</Text>
        <SegmentedControl segments={C3.discover.segments} value={segment} onChange={setSegment} testID="creators-segments" />
      </View>
      {segment === 'Discover' ? (
        <DiscoverList key="discover" fetcher={brandApi.discoverCreators} countFetcher={brandApi.discoverCreators} lists={lists}
          onOpen={openCreator} onAddToGroup={(c) => setAddTo({ id: c.id, name: c.name })} />
      ) : null}
      {segment === 'Groups' ? <GroupsPane navigation={navigation} /> : null}
      {segment === 'Pitches' ? <EmptyState title={W.pitchesTitle} body={W.pitchesBody} /> : null}
      {segment === 'Worked with' ? <WorkedWithPane onOpen={openCreator} /> : null}
      {toast}
      <AddToGroupSheet creator={addTo} onClose={() => setAddTo(null)} onDone={show} />
    </View>
  );
}

export function GroupsPane({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [groups, setGroups] = useState([]);
  const [naming, setNaming] = useState(false);
  const load = useCallback(async () => {
    const r = await brandApi.listGroups();
    if (!r.success) { setStatus('error'); return; }
    setGroups(r.data.groups || []);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function create(name) {
    const r = await brandApi.createGroup(name);
    if (!r.success) return r.error?.message || COPY.saveFailed;
    setNaming(false);
    navigation.navigate('BrandGroupDetail', { groupId: r.data.group.id, name: r.data.group.name });
    return null;
  }

  if (status === 'loading') return <Skeleton rows={4} />;
  if (status === 'error') return <LoadErrorList what="groups" onRetry={load} />;
  return (
    <View style={{ flex: 1 }} testID="groups-pane">
      <FlatList
        data={groups}
        keyExtractor={g => g.id}
        contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 120 }}
        ListHeaderComponent={groups.length ? (
          <View style={s.countRow}><Text style={s.count}>{G.countN(groups.length)}</Text><Text style={s.sort}>{G.sort}</Text></View>
        ) : null}
        ListEmptyComponent={<EmptyState title={G.emptyTitle} body={G.emptyBody} />}
        renderItem={({ item: g }) => {
          const when = (g.changed ? G.updated : G.created)(whenLabel(g.changed ? g.updatedAt : g.createdAt, shortDate));
          return (
            <TouchableOpacity style={s.card} onPress={() => navigation.navigate('BrandGroupDetail', { groupId: g.id, name: g.name })} activeOpacity={0.85} testID={`group-${g.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.gName} numberOfLines={1}>{g.name}</Text>
                <Text style={s.gMeta}>{G.card(g.memberCount, when)}</Text>
                <Text style={s.gMeta}>{g.memberCount ? G.openN(g.openCount) : G.noneYet}</Text>
              </View>
              <AvatarStack people={g.avatars || []} extra={Math.max(0, g.memberCount - (g.avatars || []).length)} />
            </TouchableOpacity>
          );
        }}
      />
      <View style={s.footer}><PrimaryButton label={G.newGroup} onPress={() => setNaming(true)} testID="new-group" /></View>
      <GroupNameSheet visible={naming} onSubmit={create} onClose={() => setNaming(false)} />
    </View>
  );
}

export function WorkedWithPane({ onOpen }) {
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
    setRows(prev => next === 1 ? (r.data.rows || []) : [...prev, ...(r.data.rows || [])]);
    setPage(next);
    setStatus('ready');
  }, [search]);
  useEffect(() => { const t = setTimeout(() => load(1), search ? 350 : 0); return () => clearTimeout(t); }, [load]); // eslint-disable-line

  return (
    <View style={{ flex: 1 }} testID="worked-with-pane">
      <View style={{ paddingHorizontal: 18 }}>
        <Text style={base.hint}>{W.intro}</Text>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder={C3.discover.search} placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} testID="worked-search" />
      </View>
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadErrorList what="creators" onRetry={() => load(1)} /> : (
        <FlatList data={rows} keyExtractor={r => r.influencerId} contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 120 }}
          onEndReachedThreshold={0.4} onEndReached={() => { if (rows.length < total && status === 'ready') load(page + 1); }}
          ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={<EmptyState title={W.emptyTitle} body={W.emptyBody} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => onOpen(item)} testID={`worked-${item.influencerId}`}>
              <Avatar name={item.name} url={item.avatarUrl} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.gName} numberOfLines={1}>{item.name || item.instagramHandle || 'Creator'}</Text>
                <Text style={s.gMeta}>{W.row(item.collaborations, shortDate(item.lastSignedAt))}</Text>
              </View>
              <Text style={s.chev}>›</Text>
            </TouchableOpacity>
          )} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 22, color: T.ink, marginBottom: 10 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  count: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2 },
  sort: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 12 },
  gName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  gMeta: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink3, marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3 },
});
