import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
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

export default function BrandCampaignListScreen({ navigation }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('all');

  async function load() {
    const res = await brandApi.getCampaigns();
    setLoading(false);
    if (res.success) setCampaigns(res.data?.campaigns || []);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  const filtered = filter === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === filter || (filter === 'active' && ['active', 'live'].includes(c.status)));

  const FILTERS = ['all', 'active', 'draft', 'pending_wallet', 'completed'];

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Campaigns</Text>
        <Text style={styles.count}>{campaigns.length} total</Text>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
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

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📣</Text>
            <Text style={styles.emptyText}>No campaigns</Text>
          </View>
        ) : (
          filtered.map(c => {
            const sCfg = STATUS_CFG[c.status] || STATUS_CFG.draft;
            const sets = c.sets || [];
            const influencerCount = sets.reduce((n, s) => n + (s.influencers?.length || 0), 0);
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.card}
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
            );
          })
        )}
      </View>

      {/* Manage on web link */}
      <TouchableOpacity style={styles.webLink} onPress={() => openWebDashboard('/dashboard/campaigns')}>
        <Text style={styles.webLinkIcon}>🌐</Text>
        <Text style={styles.webLinkText}>Manage campaigns on web</Text>
        <Text style={styles.webLinkArrow}>›</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontSize: 22, fontWeight: '800', color: colors.white },
  count: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.t2 },
  filterTextActive: { color: colors.white },
  list: { paddingHorizontal: 16 },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
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
