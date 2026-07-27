import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fmtRupees } from '../../theme/tokens';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import { openWebDashboard } from '../../utils/openWebDashboard';

// ── locked palette (inline) ──
const P = {
  bg:           '#FAFAFA',
  surface:      '#FFFFFF',
  surface2:     '#F4F4F5',
  ink:          '#0A0A0A',
  ink2:         '#1F1F22',
  muted:        '#52525B',
  muted2:       '#71717A',
  muted3:       '#A1A1AA',
  border:       '#E4E4E7',
  border2:      '#D4D4D8',
  yellow:       '#FFC107',
  yellowHover:  '#E0A800',
  yellowPale:   '#FFF7CC',
  yellow50:     '#FFFDEB',
  yellowText:   '#6B5A00',
  success:      '#10B981',
  successPale:  '#D1FAE5',
  successDeep:  '#047857',
  danger:       '#E8401A',
  dangerPale:   '#FDEEE9',
  dangerDeep:   '#B91C1C',
  white:        '#FFFFFF',
};

const STATUS_CFG = {
  draft:           { label: 'Draft',          bg: P.surface2,    text: P.muted,        dot: P.muted2 },
  pending_wallet:  { label: 'Needs funding',  bg: P.yellowPale,  text: P.yellowText,   dot: P.yellowHover },
  published:       { label: 'Published',      bg: P.yellowPale,  text: P.yellowText,   dot: P.yellowHover },
  active:          { label: 'Active',         bg: P.successPale, text: P.successDeep,  dot: P.success },
  live:            { label: 'Live',           bg: P.successPale, text: P.successDeep,  dot: P.success },
  completed:       { label: 'Completed',      bg: P.surface2,    text: P.ink2,         dot: P.muted2 },
  cancelled:       { label: 'Cancelled',      bg: P.dangerPale,  text: P.dangerDeep,   dot: P.danger },
};

const FILTERS = ['all', 'active', 'draft', 'pending_wallet', 'completed'];
const SORTS = [
  { key: 'newest',      label: 'Newest' },
  { key: 'oldest',      label: 'Oldest' },
  { key: 'budget_desc', label: 'Budget ↓' },
  { key: 'name_asc',    label: 'Name A→Z' },
];

export default function BrandCampaignListScreen({ navigation }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('all');
  const [sort, setSort]           = useState('newest');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(new Set());
  const [bulkBusy, setBulkBusy]   = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  async function load() {
    const res = await brandApi.getCampaigns();
    setLoading(false);
    if (res.success) setCampaigns(res.data?.campaigns || []);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  // Per-status counts for chip badges
  const counts = useMemo(() => {
    const c = { all: campaigns.length };
    FILTERS.forEach(f => { c[f] = 0; });
    campaigns.forEach(camp => {
      if (camp.status === 'active' || camp.status === 'live') c.active++;
      else if (c[camp.status] !== undefined) c[camp.status]++;
    });
    return c;
  }, [campaigns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = campaigns;
    if (filter !== 'all') {
      arr = arr.filter(c => c.status === filter || (filter === 'active' && ['active', 'live'].includes(c.status)));
    }
    if (q) {
      arr = arr.filter(c => (c.name || '').toLowerCase().includes(q));
    }
    const sorted = [...arr];
    sorted.sort((a, b) => {
      if (sort === 'oldest')      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sort === 'budget_desc') return parseFloat(b.total_budget || 0) - parseFloat(a.total_budget || 0);
      if (sort === 'name_asc')    return (a.name || '').localeCompare(b.name || '');
      return new Date(b.created_at || 0) - new Date(a.created_at || 0); // newest
    });
    return sorted;
  }, [campaigns, filter, search, sort]);

  // ── Bulk selection ─────────────────────────────────────────────────────────

  function toggleSel(id) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const selectedItems = filtered.filter(c => selected.has(c.id));
  const cancellable = selectedItems.filter(c => c.status === 'draft' || c.status === 'published');
  const deletable   = selectedItems.filter(c => c.status === 'draft');

  async function bulkCancel() {
    if (cancellable.length === 0) {
      Alert.alert('Cannot cancel', 'Only draft and published campaigns can be cancelled.');
      return;
    }
    Alert.alert(
      'Cancel campaigns',
      `Cancel ${cancellable.length} campaign${cancellable.length !== 1 ? 's' : ''}? This refunds any locked funds.`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel them', style: 'destructive', onPress: async () => {
          setBulkBusy(true);
          const results = await Promise.allSettled(cancellable.map(c => brandApi.cancelCampaign(c.id)));
          setBulkBusy(false);
          const ok = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
          Alert.alert('Done', `Cancelled ${ok} of ${cancellable.length}.`);
          setSelected(new Set());
          load();
        } },
      ]
    );
  }

  async function bulkDelete() {
    if (deletable.length === 0) {
      Alert.alert('Cannot delete', 'Only draft campaigns can be deleted.');
      return;
    }
    Alert.alert(
      'Delete campaigns',
      `Permanently delete ${deletable.length} draft campaign${deletable.length !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          setBulkBusy(true);
          const results = await Promise.allSettled(deletable.map(c => brandApi.deleteCampaign(c.id)));
          setBulkBusy(false);
          const ok = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
          Alert.alert('Done', `Deleted ${ok} of ${deletable.length}.`);
          setSelected(new Set());
          load();
        } },
      ]
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={P.ink} /></View>;
  }

  const liveCount  = campaigns.filter(c => ['active', 'live'].includes(c.status)).length;
  const draftCount = campaigns.filter(c => c.status === 'draft').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
    >
      {/* ── Ink header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Campaigns</Text>
        <Text style={styles.countLine}>
          <Text style={styles.countV}>{campaigns.length}</Text> total{'  ·  '}
          <Text style={styles.countV}>{liveCount}</Text> live{'  ·  '}
          <Text style={styles.countV}>{draftCount}</Text> draft{draftCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* ── Search row ── */}
      <View style={styles.searchRow}>
        <View style={[styles.searchInputWrap, searchFocused && styles.searchInputWrapFocused]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by campaign name"
            placeholderTextColor={P.muted3}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setSearch('')}>
              <Text style={styles.clearBtnText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter chips (horizontal scroll) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowInner}>
        {FILTERS.map(f => {
          const isActive = filter === f;
          const label = f === 'all' ? 'All' : STATUS_CFG[f]?.label || f;
          const count = counts[f] || 0;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              activeOpacity={0.8}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
              <Text style={[styles.filterChipCount, isActive && styles.filterChipCountActive]}>{count}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Sort chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow} contentContainerStyle={styles.chipRowInner}>
        {SORTS.map(s => {
          const isActive = sort === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.sortChip, isActive && styles.sortChipActive]}
              activeOpacity={0.8}
              onPress={() => setSort(s.key)}
            >
              <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Bulk action bar (ink chrome when selection > 0) ── */}
      {selected.size > 0 && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkLabel}>
            <Text style={styles.bulkCount}>{selected.size}</Text> selected
          </Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              onPress={bulkCancel}
              disabled={bulkBusy || cancellable.length === 0}
              style={[styles.bulkBtn, styles.bulkBtnCancel, (bulkBusy || cancellable.length === 0) && styles.bulkBtnDisabled]}
            >
              <Text style={styles.bulkBtnTextCancel}>Cancel ({cancellable.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={bulkDelete}
              disabled={bulkBusy || deletable.length === 0}
              style={[styles.bulkBtn, styles.bulkBtnDel, (bulkBusy || deletable.length === 0) && styles.bulkBtnDisabled]}
            >
              <Text style={styles.bulkBtnTextDel}>Delete ({deletable.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.bulkClearBtn}>
              <Text style={styles.bulkClearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── List ── */}
      <View style={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Icon name="bullhorn-outline" size={22} color={ig.mut2} /></View>
            <Text style={styles.emptyText}>
              {search ? 'No campaigns match your search' : 'No campaigns'}
            </Text>
          </View>
        ) : (
          filtered.map(c => {
            const sCfg = STATUS_CFG[c.status] || STATUS_CFG.draft;
            const isSel = selected.has(c.id);
            return (
              <View
                key={c.id}
                style={[styles.card, isSel && styles.cardSelected]}
              >
                <TouchableOpacity onPress={() => toggleSel(c.id)} style={styles.checkboxBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View style={[styles.checkbox, isSel && styles.checkboxOn]}>
                    {isSel && <View style={styles.checkboxTick} />}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('CampaignDetail', { campaignId: c.id })}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={2}>{c.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sCfg.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: sCfg.dot }]} />
                      <Text style={[styles.statusText, { color: sCfg.text }]}>{sCfg.label}</Text>
                    </View>
                  </View>
                  <View style={styles.cardMeta}>
                    {c.start_date ? (
                      <Text style={styles.metaItem}>📅 {new Date(c.start_date).toLocaleDateString('en-IN')}</Text>
                    ) : (
                      <Text style={[styles.metaItem, { color: P.muted3 }]}>— no dates set —</Text>
                    )}
                    {c.total_budget > 0 && (
                      <>
                        <Text style={styles.metaSep}>·</Text>
                        <Text style={styles.metaBudget}>{fmtRupees(c.total_budget)}</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      {/* ── Bottom create-on-web CTA ── */}
      <TouchableOpacity style={styles.webLink} onPress={() => openWebDashboard('/dashboard/campaigns')}>
        <Text style={styles.webLinkIcon}>🌐</Text>
        <Text style={styles.webLinkText}>Create new campaign on web</Text>
        <Text style={styles.webLinkArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },

  // Ink header
  header: {
    backgroundColor: P.ink,
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '700', color: P.white, letterSpacing: -0.4 },
  countLine: { fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  countV: { color: P.white, fontWeight: '600' },

  // Search
  searchRow: { paddingHorizontal: 14, paddingTop: 12 },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.surface,
    borderWidth: 1, borderColor: P.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInputWrapFocused: {
    borderColor: P.yellow,
    shadowColor: P.yellow,
    shadowOpacity: 0.25,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  searchIcon: { fontSize: 14, color: P.muted2, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13.5, color: P.ink, paddingVertical: 0 },
  clearBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.surface2, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  clearBtnText: { fontSize: 14, color: P.muted, fontWeight: '700' },

  // Chip rows
  chipRow:  { paddingTop: 10, flexGrow: 0 },
  sortRow:  { paddingTop: 8, flexGrow: 0 },
  chipRowInner: { paddingHorizontal: 14, gap: 6 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: P.surface2,
    borderWidth: 1, borderColor: P.border,
    borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 6,
  },
  filterChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  filterChipText: { fontSize: 11.5, fontWeight: '600', color: P.muted },
  filterChipTextActive: { color: P.white },
  filterChipCount: { fontSize: 10, fontWeight: '700', color: P.muted2 },
  filterChipCountActive: { color: 'rgba(255,255,255,0.85)' },

  sortChip: {
    backgroundColor: P.surface,
    borderWidth: 1, borderColor: P.border,
    borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 5,
    marginRight: 6,
  },
  sortChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  sortChipText: { fontSize: 10.5, fontWeight: '600', color: P.muted2 },
  sortChipTextActive: { color: P.white },

  // Bulk bar (ink chrome)
  bulkBar: {
    marginHorizontal: 14, marginTop: 10,
    backgroundColor: P.ink,
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  bulkLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  bulkCount: { color: P.white, fontWeight: '700' },
  bulkActions: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  bulkBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  bulkBtnCancel: { backgroundColor: P.yellow },
  bulkBtnDel:    { backgroundColor: P.danger },
  bulkBtnDisabled: { opacity: 0.4 },
  bulkBtnTextCancel: { fontSize: 10.5, fontWeight: '700', color: P.ink },
  bulkBtnTextDel:    { fontSize: 10.5, fontWeight: '700', color: P.white },
  bulkClearBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  bulkClearText: { fontSize: 10.5, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },

  // List
  list: { paddingHorizontal: 14, paddingTop: 12, gap: 8 },
  emptyCard: {
    backgroundColor: P.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1, borderColor: P.border,
  },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: P.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyText: { fontSize: 13.5, fontWeight: '700', color: P.ink },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: P.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1, borderColor: P.border,
  },
  cardSelected: {
    borderColor: P.ink,
    shadowColor: P.ink,
    shadowOpacity: 0.06,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  checkboxBtn: { paddingTop: 2 },
  checkbox: {
    width: 18, height: 18, borderRadius: 5,
    borderWidth: 2, borderColor: P.border2,
    backgroundColor: P.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: P.ink, borderColor: P.ink },
  checkboxTick: {
    width: 4, height: 8,
    borderRightWidth: 2, borderBottomWidth: 2,
    borderColor: P.white,
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 5 },
  cardName: { fontSize: 13.5, fontWeight: '700', color: P.ink, flex: 1, letterSpacing: 0.1 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 100,
    flexShrink: 0,
  },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  metaItem: { fontSize: 10.5, color: P.muted2 },
  metaSep:  { fontSize: 10.5, color: P.muted3 },
  metaBudget: { fontSize: 10.5, color: P.ink, fontWeight: '600' },

  // Bottom CTA
  webLink: {
    marginHorizontal: 14, marginTop: 14,
    backgroundColor: P.surface,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1, borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webLinkIcon: { fontSize: 16 },
  webLinkText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: P.ink },
  webLinkArrow: { fontSize: 18, color: P.muted2, fontWeight: '700' },
});
