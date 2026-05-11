import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { openWebDashboard } from '../../utils/openWebDashboard';

const STATUS_CFG = {
  draft:           { label: 'Draft',           color: colors.t3,    bg: colors.surface2 },
  pending_wallet:  { label: 'Needs Funding',   color: colors.orange, bg: colors.orange + '20' },
  published:       { label: 'Published',       color: '#3B82F6',   bg: '#EFF6FF' },
  active:          { label: 'Active',          color: colors.teal,  bg: colors.teal + '20' },
  live:            { label: 'Live',            color: colors.teal,  bg: colors.teal + '20' },
  completed:       { label: 'Completed',       color: colors.navy,  bg: colors.navy + '15' },
  cancelled:       { label: 'Cancelled',       color: colors.red,   bg: colors.redPale },
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
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Campaigns</Text>
        <Text style={styles.count}>{campaigns.length} total</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by campaign name"
          placeholderTextColor={colors.t3}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setSearch('')}>
            <Text style={styles.clearBtnText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : STATUS_CFG[f]?.label || f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {SORTS.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sortChip, sort === s.key && styles.sortChipActive]}
            onPress={() => setSort(s.key)}
          >
            <Text style={[styles.sortText, sort === s.key && styles.sortTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bulk action bar (only when selection exists) */}
      {selected.size > 0 && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkLabel}>{selected.size} selected</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              onPress={bulkCancel}
              disabled={bulkBusy || cancellable.length === 0}
              style={[styles.bulkBtn, (bulkBusy || cancellable.length === 0) && styles.bulkBtnDisabled]}
            >
              <Text style={styles.bulkBtnText}>Cancel ({cancellable.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={bulkDelete}
              disabled={bulkBusy || deletable.length === 0}
              style={[styles.bulkBtn, styles.bulkBtnDanger, (bulkBusy || deletable.length === 0) && styles.bulkBtnDisabled]}
            >
              <Text style={[styles.bulkBtnText, styles.bulkBtnTextDanger]}>Delete ({deletable.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.bulkClearBtn}>
              <Text style={styles.bulkClearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📣</Text>
            <Text style={styles.emptyText}>
              {search ? 'No campaigns match your search' : 'No campaigns'}
            </Text>
          </View>
        ) : (
          filtered.map(c => {
            const sCfg = STATUS_CFG[c.status] || STATUS_CFG.draft;
            const sets = c.sets || [];
            const influencerCount = sets.reduce((n, s) => n + (s.influencers?.length || 0), 0);
            const isSel = selected.has(c.id);
            return (
              <View
                key={c.id}
                style={[styles.card, isSel && styles.cardSelected]}
              >
                <TouchableOpacity onPress={() => toggleSel(c.id)} style={styles.checkboxBtn}>
                  <View style={[styles.checkbox, isSel && styles.checkboxOn]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('CampaignDetail', { campaignId: c.id })}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={2}>{c.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sCfg.bg }]}>
                      <Text style={[styles.statusText, { color: sCfg.color }]}>{sCfg.label}</Text>
                    </View>
                  </View>
                  <View style={styles.cardMeta}>
                    {c.start_date && (
                      <Text style={styles.metaItem}>
                        📅 {new Date(c.start_date).toLocaleDateString('en-IN')}
                      </Text>
                    )}
                    {influencerCount > 0 && (
                      <Text style={styles.metaItem}>👥 {influencerCount} influencer{influencerCount !== 1 ? 's' : ''}</Text>
                    )}
                    {c.total_budget > 0 && (
                      <Text style={styles.metaItem}>💰 ₹{Number(c.total_budget).toLocaleString('en-IN')}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <TouchableOpacity style={styles.webLink} onPress={() => openWebDashboard('/dashboard/campaigns')}>
        <Text style={styles.webLinkIcon}>🌐</Text>
        <Text style={styles.webLinkText}>Create new campaign on web</Text>
        <Text style={styles.webLinkArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontSize: 22, fontWeight: '800', color: colors.white },
  count: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  searchInput: {
    flex: 1, height: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 13, color: colors.t1, backgroundColor: colors.white,
  },
  clearBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { fontSize: 18, color: colors.t2, marginTop: -2 },

  chipRow: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.t2 },
  filterTextActive: { color: colors.white },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  sortChipActive: { backgroundColor: colors.t1, borderColor: colors.t1 },
  sortText: { fontSize: 11, fontWeight: '600', color: colors.t3 },
  sortTextActive: { color: colors.white },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: colors.navy,
  },
  bulkLabel: { fontSize: 12, fontWeight: '700', color: colors.t1 },
  bulkActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  bulkBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.navy, borderRadius: 6 },
  bulkBtnDanger: { backgroundColor: colors.redPale, borderWidth: 1, borderColor: colors.red },
  bulkBtnDisabled: { opacity: 0.4 },
  bulkBtnText: { fontSize: 11, fontWeight: '700', color: colors.white },
  bulkBtnTextDanger: { color: colors.red },
  bulkClearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  bulkClearText: { fontSize: 11, fontWeight: '600', color: colors.t3 },

  list: { paddingHorizontal: 16 },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.white, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardSelected: { borderColor: colors.navy, borderWidth: 2 },
  checkboxBtn: { paddingTop: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: colors.border2 || colors.border, backgroundColor: colors.white },
  checkboxOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.t1, flex: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { fontSize: 11, color: colors.t3 },
  webLink: { margin: 16, backgroundColor: colors.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border },
  webLinkIcon: { fontSize: 18 },
  webLinkText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.navy },
  webLinkArrow: { fontSize: 18, color: colors.t3 },
});
