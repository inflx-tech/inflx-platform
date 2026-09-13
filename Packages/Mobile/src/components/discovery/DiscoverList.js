/**
 * DiscoverList — the reusable creator list: search, quick filters, count + sort, cards,
 * infinite scroll, loading / empty / error states, and a SELECT mode (G5 now, item 5's set
 * picker later). Contract: features/item3-discovery-profiles-groups · prompt §6.2, §6.9
 *
 * Props
 *   fetcher(params)     → { success, data:{ total, rows } }   (brandApi.discoverCreators or workedWith-adapter)
 *   countFetcher(params)→ { success, data:{ total } }
 *   lists               { niches, languages, states, nicheLabel, cityName }
 *   mode                'browse' | 'select'
 *   defaultOpenOnly     true on Discover, false inside a group picker
 *   selectedIds, disabledIds (Set), capacityLeft, onToggleSelect
 *   onOpen(creator), onAddToGroup(creator)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Skeleton, LoadError } from '../settings/feedback';
import { EmptyState, TagRow, PrimaryButton } from '../settings/primitives';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { StatTriple, StatusChip3, CheckboxRow } from './bits';
import FiltersSheet, { CREATOR_DEFAULTS, changedCount, quickChip } from './FiltersSheet';
import { aimLabel, modeLabel } from '../settings/copy';
import { C3, fmtCompact, AIM_ORDER, MODE_ORDER } from './copy3';

export function CreatorCard({ c, onOpen, onAddToGroup, compact }) {
  const meta = [c.nicheLabel, c.cityName, (c.languages || []).join(', ')].filter(Boolean).join(' · ');
  const tags = [...AIM_ORDER.filter(a => (c.acceptedAims || []).includes(a)).map(aimLabel), ...MODE_ORDER.filter(m => (c.acceptedModes || []).includes(m)).map(m => m === 'visit' ? `📍 ${modeLabel(m)}` : modeLabel(m))];
  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen && onOpen(c)} activeOpacity={0.85} testID={`creator-${c.id}`}>
      <View style={s.cardTop}>
        <Avatar name={c.name} url={c.avatarUrl} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.name} numberOfLines={1}>{c.name}</Text>
          {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
        </View>
        {onAddToGroup ? (
          <TouchableOpacity style={s.plus} onPress={() => onAddToGroup(c)} accessibilityLabel="Add to group" testID={`add-to-group-${c.id}`}>
            <Text style={s.plusText}>+</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <StatTriple instagram={c.instagram} youtube={c.youtube} engagement={c.engagement} compact={compact} />
      <View style={{ marginTop: 8 }}>
        {c.status === 'OK' ? <TagRow items={tags} /> : <StatusChip3 status={c.status} />}
        {c.blockedByYou ? <StatusChip3 status={null} blockedByYou /> : null}
      </View>
    </TouchableOpacity>
  );
}

/** Compact row for group members / pickers: avatar · name · "Niche · City · 48.2K IG" · status chip. */
export function MemberRow({ c, right, onOpen, sub }) {
  const meta = sub || [c.nicheLabel, c.cityName, c.instagram != null ? `${fmtCompact(c.instagram)} IG` : null].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity style={s.member} onPress={onOpen ? () => onOpen(c) : undefined} activeOpacity={onOpen ? 0.7 : 1} testID={`member-${c.id}`}>
      <Avatar name={c.name} url={c.avatarUrl} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.name} numberOfLines={1}>{c.name}</Text>
        {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
        {c.status ? <View style={{ marginTop: 4 }}><StatusChip3 status={c.status} blockedByYou={c.blockedByYou} /></View> : null}
      </View>
      {right || null}
    </TouchableOpacity>
  );
}

export default function DiscoverList({
  fetcher, countFetcher, lists, mode = 'browse', defaultOpenOnly = true,
  selectedIds, disabledIds, disabledLabel, capacityLeft, onToggleSelect, onOpen, onAddToGroup, header, testID = 'discover-list',
  // Item 5 — a per-row pick state for the set picker: (item) → { state: 'ok' | 'invited' | 'ineligible', label, chip }.
  // 'invited' is ticked and locked; 'ineligible' is locked and unticked; both show the label under the name.
  pickState,
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...CREATOR_DEFAULTS, openOnly: defaultOpenOnly });
  const [sort, setSort] = useState('followers');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');   // loading | error | ready | more
  const [sheet, setSheet] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const seq = useRef(0);
  const debounce = useRef(null);

  const params = useMemo(() => ({ ...filters, search: search.trim() || undefined, sort }), [filters, search, sort]);

  const load = useCallback(async (nextPage = 1) => {
    const my = ++seq.current;
    setStatus(nextPage === 1 ? 'loading' : 'more');
    const r = await fetcher({ ...params, page: nextPage });
    if (my !== seq.current) return;
    if (!r.success) { setStatus('error'); return; }
    setTotal(r.data.total || 0);
    setRows(prev => nextPage === 1 ? (r.data.rows || []) : [...prev, ...(r.data.rows || [])]);
    setPage(nextPage);
    setStatus('ready');
  }, [fetcher, params]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(1), search ? 350 : 0);
    return () => clearTimeout(debounce.current);
  }, [load]); // eslint-disable-line

  const defaults = { ...CREATOR_DEFAULTS, openOnly: defaultOpenOnly };
  const nChanged = changedCount(filters, defaults);
  const chip = quickChip(filters, defaults, lists);
  const hasMore = rows.length < total;

  function clearAll() { setFilters({ ...defaults }); setSearch(''); }

  const renderItem = ({ item }) => {
    if (mode === 'select' && pickState) {
      const ps = pickState(item) || { state: 'ok' };
      const locked = ps.state !== 'ok';
      const checked = ps.state === 'invited' || (selectedIds && selectedIds.has(item.id));
      return (
        <CheckboxRow checked={checked} disabled={locked} onPress={() => onToggleSelect && onToggleSelect(item)} testID={`select-${item.id}`}>
          <MemberRow c={locked ? { ...item, status: null } : item} sub={locked ? ps.label : undefined}
            right={ps.chip ? <View style={[s.pickChip, { backgroundColor: ps.state === 'invited' ? T.state.waiting.bg : T.state.ended.bg }]}><Text style={[s.pickChipText, { color: ps.state === 'invited' ? T.state.waiting.fg : T.state.ended.fg }]}>{ps.chip}</Text></View> : null} />
        </CheckboxRow>
      );
    }
    if (mode === 'select') {
      const disabled = disabledIds && disabledIds.has(item.id);
      const checked = disabled || (selectedIds && selectedIds.has(item.id));
      const full = !checked && capacityLeft != null && capacityLeft <= 0;
      return (
        <CheckboxRow checked={checked} disabled={disabled || full} onPress={() => onToggleSelect && onToggleSelect(item)} testID={`select-${item.id}`}>
          <MemberRow c={disabled ? { ...item, status: null } : item} sub={disabled ? (disabledLabel || C3.groups.alreadyIn) : undefined} />
        </CheckboxRow>
      );
    }
    return <CreatorCard c={item} onOpen={onOpen} onAddToGroup={onAddToGroup} />;
  };

  return (
    <View style={{ flex: 1 }} testID={testID}>
      <View style={s.controls}>
        {header || null}
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder={C3.discover.search} placeholderTextColor={T.ink3} autoCorrect={false} autoCapitalize="none" testID="discover-search" />
        <View style={s.quick}>
          <TouchableOpacity style={[s.qchip, filters.openOnly && s.qchipOn]} onPress={() => setFilters(f => ({ ...f, openOnly: !f.openOnly }))} testID="quick-open">
            <Text style={[s.qchipText, filters.openOnly && s.qchipTextOn]}>{C3.discover.openOnly}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qchip} onPress={() => setSheet(true)} testID="open-filters">
            <Text style={s.qchipText}>{nChanged > 0 ? C3.discover.filtersN(nChanged) : C3.discover.filters}</Text>
          </TouchableOpacity>
          {chip ? (
            <TouchableOpacity style={s.qchip} onPress={clearAll} testID="quick-chip"><Text style={s.qchipText}>{chip}  ✕</Text></TouchableOpacity>
          ) : null}
        </View>
        {status !== 'error' ? (
          <View style={s.countRow}>
            <Text style={s.count}>{status === 'loading' ? '' : C3.discover.count(total)}</Text>
            <TouchableOpacity onPress={() => setSortOpen(o => !o)} testID="sort-toggle"><Text style={s.sort}>{C3.discover.sorts[sort]} ▾</Text></TouchableOpacity>
          </View>
        ) : null}
        {sortOpen ? (
          <View style={s.sortMenu}>
            {Object.entries(C3.discover.sorts).map(([k, l]) => (
              <TouchableOpacity key={k} style={s.sortItem} onPress={() => { setSort(k); setSortOpen(false); }} testID={`sort-${k}`}>
                <Text style={[s.sortItemText, k === sort && { color: T.ink, fontFamily: fonts.sansBold }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      {status === 'loading' ? <Skeleton rows={5} /> : status === 'error' ? (
        <LoadErrorList what="creators" onRetry={() => load(1)} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 120 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasMore && status === 'ready') load(page + 1); }}
          ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            <View style={{ paddingTop: 20 }}>
              <EmptyState title={C3.states.noCreatorsTitle} body={C3.states.noCreatorsBody} />
              <View style={{ width: 160, alignSelf: 'center' }}><PrimaryButton label={C3.states.clearFilters} onPress={clearAll} testID="clear-filters" /></View>
            </View>
          }
        />
      )}

      <FiltersSheet visible={sheet} kind="creators" value={filters} lists={lists}
        fetchCount={async (f) => { const r = await countFetcher({ ...f, search: search.trim() || undefined, countOnly: 1 }); return r.success ? r.data.total : 0; }}
        onApply={(f) => { setFilters(f); setSheet(false); }} onClose={() => setSheet(false)} />
    </View>
  );
}

export function LoadErrorList({ what, onRetry }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }} testID="load-error">
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 17, color: T.ink }}>{C3.states.couldntLoad(what)}</Text>
      <Text style={{ fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink3, marginTop: 6 }}>{C3.states.couldntLoadBody}</Text>
      <View style={{ marginTop: 16, width: 160 }}><PrimaryButton label={C3.states.tryAgain} onPress={onRetry} testID="try-again" /></View>
    </View>
  );
}

export const s = StyleSheet.create({
  controls: { paddingHorizontal: 18, paddingTop: 8 },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
  quick: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  qchip: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 6, backgroundColor: T.bg },
  qchipOn: { backgroundColor: T.ink, borderColor: T.ink },
  qchipText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink },
  qchipTextOn: { color: '#FFFFFF' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  count: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2 },
  sort: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  sortMenu: { borderWidth: 1, borderColor: T.border, borderRadius: 10, backgroundColor: T.bg, marginBottom: 8 },
  sortItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  sortItemText: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink2 },
  capHint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: T.bg },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  plus: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  plusText: { fontFamily: fonts.sansBold, fontSize: 20, color: T.ink, marginTop: -2 },
  member: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  pickChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, marginLeft: 8 },
  pickChipText: { fontFamily: fonts.sansBold, fontSize: 11 },
});
