import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

const FILTERS = [
  { key: 'all',    label: 'ALL' },
  { key: 'active', label: 'ACTIVE' },
  { key: 'pending',label: 'PENDING' },
];

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(); }
  catch { return '—'; }
}

/**
 * InfluencerContractsScreen — contract list with status filter + search.
 *
 * Flow 35 restyle (2026-05-27): brandPalette + Outfit/PJS/Mono fonts.
 * Ad-hoc STATUS_COLORS replaced by canonical StatusPill (all 5 contract
 * statuses already in 43-entry map: draft, pending_influencer,
 * pending_brand, active, cancelled). Zero map additions.
 */

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
          <Icon name="chevron-left" size={18} color={P.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Contracts</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search campaign or brand…"
          placeholderTextColor={P.muted3}
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
        <View style={styles.center}><ActivityIndicator color={P.yellow} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[P.yellow]} />}
          renderItem={({ item: c }) => {
            const total = Number(c.influencer_fee || 0) + Number(c.bonus_amount || 0);
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
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.campaign} numberOfLines={1}>{c.campaign_name}</Text>
                    <Text style={styles.brand} numberOfLines={1}>{(c.brand_name || '').toUpperCase()}</Text>
                  </View>
                  <StatusPill status={c.status} />
                </View>
                <View style={styles.cardFoot}>
                  <Text style={styles.meta}>{fmtDate(c.brand_signed_at || c.created_at)} · {(c.campaign_goal || '').toUpperCase()}</Text>
                  <Text style={styles.amount}>{fmtRupees(total)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyTile}>
                <Icon name="file-document-outline" size={32} color={P.yellowText} />
              </View>
              <Text style={styles.emptyTitle}>No contracts yet</Text>
              <Text style={styles.emptySub}>Signed contracts with brands show up here for quick access.</Text>
            </View>
          }
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: P.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 50, paddingBottom: 14,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '800', color: P.ink,
    fontFamily: fonts.displayBlack,
  },

  toolbar: { padding: 14, backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border },
  searchInput: {
    backgroundColor: P.bg2, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 12, color: P.ink, fontFamily: fonts.sansRegular,
  },
  filterRow: { flexDirection: 'row', gap: 6, marginTop: 9 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: P.bg2 },
  filterChipActive: { backgroundColor: P.ink },
  filterChipLabel: { fontSize: 10, fontWeight: '800', color: P.muted, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.monoBold },
  filterChipLabelActive: { color: P.yellow, fontWeight: '900' },

  card: {
    backgroundColor: P.white, borderRadius: 11,
    borderWidth: 1, borderColor: P.border,
    padding: 14, marginBottom: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  campaign: { fontSize: 14, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  brand: {
    fontSize: 10.5, color: P.muted2, marginTop: 2,
    fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium,
  },
  cardFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 11, paddingTop: 11,
    borderTopWidth: 1, borderTopColor: P.borderSoft,
  },
  meta: { fontSize: 9.5, color: P.muted2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  amount: { fontSize: 13, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 28 },
  emptyTile: {
    width: 66, height: 66, borderRadius: 14,
    backgroundColor: P.yellowPale,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 6, fontFamily: fonts.displayBold },
  emptySub: { fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17, fontFamily: fonts.sansRegular },
});
