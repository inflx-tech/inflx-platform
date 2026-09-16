/**
 * BrandSetPickCreatorsScreen — I1: All creators (the item 3 Discover list in select mode, with
 * the set-level pick state per row), Worked with, and Groups (→ I2). "Next: terms for {n}
 * creators" starts the in-app draft and opens the terms screen for the first creator.
 * Contract: features/item5-invitations · prompt §6.1
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, EmptyState } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from './BrandPitchSettingsScreen';
import SegmentedControl from '../../components/shell/SegmentedControl';
import DiscoverList, { MemberRow, LoadErrorList } from '../../components/discovery/DiscoverList';
import { CheckboxRow } from '../../components/discovery/bits';
import useReferenceLists from '../../hooks/useReferenceLists';
import useRouteToast from '../../hooks/useRouteToast';
import { C3 } from '../../components/discovery/copy3';
import { Chip5 } from '../../components/invitations/bits5';
import { C5 } from '../../components/invitations/copy5';
import { startDraft } from '../../components/invitations/draft5';
import { C6, aimLabel6 as aimLabel4 } from '../../components/negotiation/copy6';

// Item 6 (B13): the pool is a fourth source inside any set's picker (rules v1.18 §7B).
const P = { ...C5.pick, tabs: [...C5.pick.tabs, 'Pool'] };

/** The pick state of a row, as the list needs it. */
export function pickStateOf(item) {
  const p = item.pick || { state: 'ok' };
  if (p.state === 'invited') return { state: 'invited', label: P.alreadyIn, chip: P.invited };
  if (p.state === 'ineligible') return { state: 'ineligible', label: P.notOpen, chip: P.cantInvite };
  return { state: 'ok' };
}

export default function BrandSetPickCreatorsScreen({ navigation, route }) {
  const { campaignId, setId } = route?.params || {};
  // Founder, 2026-09-16: "loading of creators info is too slow". It was two round trips end to
  // end — the set summary first, and only when THAT came back did the creator list start
  // loading. Both now start together, so the cards arrive in one wait instead of two, and the
  // caller hands over the names it already has so the subline needs no wait at all.
  const names = { campaign: route?.params?.campaignName || null, set: route?.params?.setName || null };
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(P.tabs[0]);
  const [sel, setSel] = useState(new Map()); // id → creator row
  const lists = useReferenceLists();
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  // The set summary no longer gates the screen; it only fills the subline and arms "Next".
  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.setSummary(campaignId, setId);
    if (!r.success) { setStatus('error'); return; }
    setData(r.data); setStatus('ready');
  }, [campaignId, setId]);
  useEffect(() => { load(); }, [load]);

  const toggle = (c) => setSel(prev => { const n = new Map(prev); if (n.has(c.id)) n.delete(c.id); else n.set(c.id, c); return n; });
  const fetcher = useCallback((params) => brandApi.pickable(campaignId, setId, { ...params, tab: 'all' }), [campaignId, setId]);

  function next() {
    if (!data) return;
    // Item 6: a creator picked from the pool carries her entry and the terms she agreed, so the
    // terms screen opens filled in and the entry is marked used when the invitation is sent.
    const creators = [...sel.values()].map(c => ({ id: c.id, name: c.name, avatarUrl: c.avatarUrl || null, poolEntryId: c.pool ? c.pool.entryId : undefined, poolTerms: c.pool && c.pool.sameAim ? c.pool.terms : undefined, poolAgreedAt: c.pool ? c.pool.agreedAt : undefined }));
    startDraft(setId, { set: data.set, campaignName: data.campaign.name, creators, sourceGroupId: null });
    navigation.navigate('BrandCreatorTerms', { campaignId, setId, index: 0 });
  }

  // Only a set summary that FAILED stops the screen; a slow one does not.
  if (status === 'error') return <View style={base.screen}><Header title={P.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const campaignName = (data && data.campaign.name) || names.campaign;
  const setName = (data && data.set.name) || names.set;

  return (
    <View style={base.screen} testID="set-pick-creators">
      <Header title={P.title} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <Text style={s.sub} testID="pick-subline">{campaignName || setName ? P.sub(campaignName || '', setName || '') : ' '}</Text>
        <SegmentedControl segments={P.tabs} value={tab} onChange={setTab} testID="pick-tabs" />
      </View>
      {tab === P.tabs[0] ? (
        <DiscoverList key="all" mode="select" defaultOpenOnly fetcher={fetcher} countFetcher={fetcher} lists={lists}
          selectedIds={new Set(sel.keys())} pickState={pickStateOf} onToggleSelect={toggle}
          header={<Text style={s.hint}>{P.hint}</Text>} />
      ) : tab === P.tabs[1] ? (
        <WorkedPickList campaignId={campaignId} setId={setId} selectedIds={new Set(sel.keys())} onToggle={toggle} />
      ) : tab === P.tabs[2] ? (
        <GroupsPickList onOpen={(g) => navigation.navigate('BrandGroupInviteCheck', { campaignId, setId, groupId: g.id, groupName: g.name })} />
      ) : (
        <PoolPickList campaignId={campaignId} setId={setId} selectedIds={new Set(sel.keys())} onToggle={toggle} />
      )}
      {tab !== P.tabs[2] ? (
        <View style={s.footer}>
          <PrimaryButton label={P.next(sel.size)} onPress={next} disabled={!sel.size || !data} testID="pick-next" />
        </View>
      ) : null}
      {toast}
    </View>
  );
}

function WorkedPickList({ campaignId, setId, selectedIds, onToggle }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');
  const seq = useRef(0);
  const load = useCallback(async (next = 1) => {
    const my = ++seq.current;
    setStatus(next === 1 ? 'loading' : 'more');
    const r = await brandApi.pickable(campaignId, setId, { tab: 'worked', search: search.trim() || undefined, page: next });
    if (my !== seq.current) return;
    if (!r.success) { setStatus('error'); return; }
    setTotal(r.data.total || 0);
    setRows(prev => next === 1 ? (r.data.rows || []) : [...prev, ...(r.data.rows || [])]);
    setPage(next); setStatus('ready');
  }, [campaignId, setId, search]);
  useEffect(() => { const t = setTimeout(() => load(1), search ? 350 : 0); return () => clearTimeout(t); }, [load]); // eslint-disable-line
  return (
    <View style={{ flex: 1 }} testID="worked-pick">
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder={C3.discover.search} placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} testID="worked-search" />
      </View>
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadErrorList what={P.loadWhat} onRetry={() => load(1)} /> : (
        <FlatList data={rows} keyExtractor={r => r.id} contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 140 }}
          onEndReachedThreshold={0.4} onEndReached={() => { if (rows.length < total && status === 'ready') load(page + 1); }}
          ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={<EmptyState title={C3.worked.emptyTitle} body={C3.worked.emptyBody} />}
          renderItem={({ item }) => {
            const ps = pickStateOf(item);
            const disabled = ps.state !== 'ok';
            const checked = ps.state === 'invited' || selectedIds.has(item.id);
            return (
              <CheckboxRow checked={checked} disabled={disabled} onPress={() => onToggle(item)} testID={`select-${item.id}`}>
                <MemberRow c={{ ...item, status: null }} sub={ps.label || C3.worked.row(item.collaborations, '').replace(/ · (last )?signed $/, '')} right={ps.chip ? <Chip5 label={ps.chip} tone={ps.state === 'invited' ? 'waiting' : 'ended'} /> : null} />
              </CheckboxRow>
            );
          }} />
      )}
    </View>
  );
}

/** Item 6 (B13) — pool creators inside this set's picker; terms travel only when the Aim matches. */
function PoolPickList({ campaignId, setId, selectedIds, onToggle }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.pickable(campaignId, setId, { tab: 'pool' });
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.rows || []); setStatus('ready');
  }, [campaignId, setId]);
  useEffect(() => { load(); }, [load]);
  if (status === 'loading') return <Skeleton rows={4} />;
  if (status === 'error') return <LoadErrorList what={C6.pool.loadWhat} onRetry={load} />;
  return (
    <FlatList data={rows} keyExtractor={r => r.id} contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 140 }} testID="pool-pick"
      ListEmptyComponent={<EmptyState title={C6.pool.emptyTitle} body={C6.pool.emptyBody} />}
      renderItem={({ item }) => {
        const ps = pickStateOf(item);
        const disabled = ps.state !== 'ok';
        const checked = ps.state === 'invited' || selectedIds.has(item.id);
        const p = item.pool || {};
        const sub = [aimLabel4(p.goal), p.sameAim ? p.termsLine : 'different Aim — no terms carried', `${p.daysLeft} days left`].filter(Boolean).join(' · ');
        return (
          <CheckboxRow checked={checked} disabled={disabled} onPress={() => onToggle(item)} testID={`select-${item.id}`}>
            <MemberRow c={{ ...item, status: null }} sub={disabled ? ps.label : sub} right={ps.chip ? <Chip5 label={ps.chip} tone={ps.state === 'invited' ? 'waiting' : 'ended'} /> : (p.closingSoon ? <Chip5 label={C6.pool.closingSoon(p.daysLeft)} tone="yourMove" /> : null)} />
          </CheckboxRow>
        );
      }} />
  );
}

function GroupsPickList({ onOpen }) {
  const [groups, setGroups] = useState(null);
  const [status, setStatus] = useState('loading');
  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.listGroups();
    if (!r.success) { setStatus('error'); return; }
    setGroups(r.data.groups || []); setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);
  if (status === 'loading') return <Skeleton rows={4} />;
  if (status === 'error') return <LoadErrorList what="groups" onRetry={load} />;
  return (
    <FlatList data={groups} keyExtractor={g => g.id} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} testID="groups-pick"
      ListEmptyComponent={<EmptyState title={P.groupsEmptyTitle} body={P.groupsEmptyBody} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={s.groupRow} onPress={() => onOpen(item)} testID={`group-${item.id}`}>
          <View style={{ flex: 1 }}><Text style={s.groupName}>{item.name}</Text><Text style={s.groupSub}>{P.groupRow(item.memberCount || 0)}</Text></View>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>
      )} />
  );
}

const s = StyleSheet.create({
  sub: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 10 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginBottom: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
  groupRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  groupName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  groupSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  chev: { fontFamily: fonts.sansRegular, fontSize: 22, color: T.ink3 },
});
