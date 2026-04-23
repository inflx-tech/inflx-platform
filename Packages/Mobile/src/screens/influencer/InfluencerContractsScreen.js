import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput,
} from 'react-native';
import { colors, spacing, radius, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

const STATUS_COLORS = {
  draft:              { bg: '#EEF1FB', fg: '#4A5278' },
  pending_influencer: { bg: '#FFF4D6', fg: '#B8860B' },
  pending_brand:      { bg: '#DBE5FF', fg: '#1B2D5E' },
  active:             { bg: '#E0FAF5', fg: '#007A63' },
  cancelled:          { bg: '#FDEEE9', fg: '#E8401A' },
};

const FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending',label: 'Pending' },
];

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

export default function InfluencerContractsScreen({ navigation }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');

  const load = useCallback(async () => {
    const res = await influencerApi.listMyContracts();
    if (res.success) setContracts(res.data?.contracts || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contracts.filter(c => {
    if (filter === 'active' && c.status !== 'active') return false;
    if (filter === 'pending' && !['pending_influencer', 'pending_brand', 'draft'].includes(c.status)) return false;
    if (search) {
      const s = search.toLowerCase();
      return (c.campaign_name || '').toLowerCase().includes(s) ||
             (c.brand_name || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Contracts</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search campaign or brand…"
          placeholderTextColor={colors.t3}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}>
              <Text style={[styles.filterChipLabel, filter === f.key && styles.filterChipLabelActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item: c }) => {
            const total = Number(c.influencer_fee || 0) + Number(c.bonus_amount || 0);
            const statusStyle = STATUS_COLORS[c.status] || STATUS_COLORS.draft;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  if (c.pdf_url) {
                    navigation.navigate('ContractPdf', { contractId: c.id, role: 'influencer' });
                  } else {
                    Alert.alert('No PDF', 'This contract does not have a PDF yet. It will be generated once both parties sign.');
                  }
                }}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campaign} numberOfLines={1}>{c.campaign_name}</Text>
                    <Text style={styles.brand} numberOfLines={1}>{c.brand_name}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusTxt, { color: statusStyle.fg }]}>
                      {String(c.status || '').replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardFoot}>
                  <Text style={styles.meta}>{fmtDate(c.brand_signed_at || c.created_at)} · {c.campaign_goal}</Text>
                  <Text style={styles.amount}>{fmtRupees(total)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>No contracts yet</Text>
              <Text style={styles.emptySub}>Signed contracts with brands show up here for quick access.</Text>
            </View>
          }
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:     { fontSize: 28, color: colors.t1, fontWeight: '400' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.t1 },

  toolbar:      { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput:  { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 13, color: colors.t1 },
  filterRow:    { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  filterChip:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.surface2 },
  filterChipActive: { backgroundColor: colors.navy },
  filterChipLabel: { fontSize: 11, fontWeight: '600', color: colors.t2 },
  filterChipLabelActive: { color: colors.white },

  card:         { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardHead:     { flexDirection: 'row', alignItems: 'flex-start' },
  campaign:     { fontSize: 14, fontWeight: '700', color: colors.t1 },
  brand:        { fontSize: 11, color: colors.t3, marginTop: 2 },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginLeft: 8 },
  statusTxt:    { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  cardFoot:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  meta:         { fontSize: 10, color: colors.t3 },
  amount:       { fontSize: 13, fontWeight: '700', color: colors.navy },

  empty:        { alignItems: 'center', padding: spacing.xxl * 2 },
  emptyIcon:    { fontSize: 40, marginBottom: spacing.md },
  emptyTitle:   { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptySub:     { fontSize: 11, color: colors.t3, textAlign: 'center', paddingHorizontal: spacing.xl },
});
