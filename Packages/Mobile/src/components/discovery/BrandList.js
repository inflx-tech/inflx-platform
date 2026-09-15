/**
 * BrandList — F2/F3: the creator's Find brands list with search, quick filters, count, sort,
 * brand cards with a status chip, infinite scroll and states.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.6
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Skeleton } from '../settings/feedback';
import { EmptyState, TagRow, PrimaryButton } from '../settings/primitives';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { StatusChip3 } from './bits';
import FiltersSheet, { BRAND_DEFAULTS, changedCount, quickChip } from './FiltersSheet';
import { LoadErrorList, s } from './DiscoverList';
import { aimLabel, modeLabel } from '../settings/copy';
import { C3, subCategoryLabel, AIM_ORDER, MODE_ORDER } from './copy3';

export function BrandCard({ b, onOpen }) {
  const meta = [(b.subCategories || []).map(subCategoryLabel).join(', '), b.mainCity].filter(Boolean).join(' · ');
  const tags = [...AIM_ORDER.filter(a => (b.acceptedAims || []).includes(a)).map(aimLabel), ...MODE_ORDER.filter(m => (b.acceptedModes || []).includes(m)).map(modeLabel)];
  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(b)} activeOpacity={0.85} testID={`brand-${b.id}`}>
      <View style={s.cardTop}>
        <Avatar name={b.name} url={b.logoUrl} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.name} numberOfLines={1}>{b.name}</Text>
          {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
        </View>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3 }}>›</Text>
      </View>
      <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusChip3 status={b.status} brandSide />
        {b.status === 'OK' ? <TagRow items={tags} /> : null}
      </View>
      {/* Item 8 (E1): a state that ends says WHEN, in the server's own sentence. */}
      {b.statusLine ? <Text style={s.meta} testID={`brand-statusline-${b.id}`}>{b.statusLine}</Text> : null}
    </TouchableOpacity>
  );
}

export default function BrandList({ fetcher, countFetcher, lists, onOpen }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...BRAND_DEFAULTS });
  const [sort, setSort] = useState('newest');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');
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

  const nChanged = changedCount(filters, BRAND_DEFAULTS);
  const chip = quickChip(filters, BRAND_DEFAULTS, { ...lists, categoryLabel: subCategoryLabel });
  function clearAll() { setFilters({ ...BRAND_DEFAULTS }); setSearch(''); }

  return (
    <View style={{ flex: 1 }} testID="brand-list">
      <View style={s.controls}>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder={C3.findBrands.search} placeholderTextColor={T.ink3} autoCorrect={false} testID="brand-search" />
        <View style={s.quick}>
          <TouchableOpacity style={[s.qchip, filters.canPitchOnly && s.qchipOn]} onPress={() => setFilters(f => ({ ...f, canPitchOnly: !f.canPitchOnly }))} testID="quick-canpitch">
            <Text style={[s.qchipText, filters.canPitchOnly && s.qchipTextOn]}>{C3.findBrands.canPitchOnly}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qchip} onPress={() => setSheet(true)} testID="open-filters">
            <Text style={s.qchipText}>{nChanged > 0 ? C3.discover.filtersN(nChanged) : C3.discover.filters}</Text>
          </TouchableOpacity>
          {chip ? <TouchableOpacity style={s.qchip} onPress={clearAll} testID="quick-chip"><Text style={s.qchipText}>{chip}  ✕</Text></TouchableOpacity> : null}
        </View>
        {status !== 'error' ? (
          <View style={s.countRow}>
            <Text style={s.count}>{status === 'loading' ? '' : C3.findBrands.count(total)}</Text>
            <TouchableOpacity onPress={() => setSortOpen(o => !o)} testID="sort-toggle"><Text style={s.sort}>{C3.findBrands.sorts[sort]} ▾</Text></TouchableOpacity>
          </View>
        ) : null}
        {sortOpen ? (
          <View style={s.sortMenu}>
            {Object.entries(C3.findBrands.sorts).map(([k, l]) => (
              <TouchableOpacity key={k} style={s.sortItem} onPress={() => { setSort(k); setSortOpen(false); }} testID={`sort-${k}`}><Text style={s.sortItemText}>{l}</Text></TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
      {status === 'loading' ? <Skeleton rows={5} /> : status === 'error' ? <LoadErrorList what="brands" onRetry={() => load(1)} /> : (
        <FlatList data={rows} keyExtractor={r => r.id} renderItem={({ item }) => <BrandCard b={item} onOpen={onOpen} />}
          contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 120 }}
          onEndReachedThreshold={0.4} onEndReached={() => { if (rows.length < total && status === 'ready') load(page + 1); }}
          ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            <View style={{ paddingTop: 20 }}>
              <EmptyState title={C3.states.noBrandsTitle} body={C3.states.noBrandsBody} />
              <View style={{ width: 160, alignSelf: 'center' }}><PrimaryButton label={C3.states.clearFilters} onPress={clearAll} testID="clear-filters" /></View>
            </View>
          } />
      )}
      <FiltersSheet visible={sheet} kind="brands" value={filters} lists={lists}
        fetchCount={async (f) => { const r = await countFetcher({ ...f, search: search.trim() || undefined, countOnly: 1 }); return r.success ? r.data.total : 0; }}
        onApply={(f) => { setFilters(f); setSheet(false); }} onClose={() => setSheet(false)} />
    </View>
  );
}
