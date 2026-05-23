import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const P = {
  bg:'#FAFAFA', surface:'#FFFFFF', surface2:'#F4F4F5',
  ink:'#0A0A0A', ink2:'#1F1F22',
  muted:'#52525B', muted2:'#71717A', muted3:'#A1A1AA',
  border:'#E4E4E7', border2:'#D4D4D8',
  yellow:'#FFC107', yellowHover:'#E0A800', yellowPale:'#FFF7CC', yellowText:'#6B5A00',
  success:'#10B981', successPale:'#D1FAE5', successDeep:'#047857',
  danger:'#E8401A', dangerPale:'#FDEEE9', dangerDeep:'#B91C1C',
  white:'#FFFFFF',
};

const GOAL_BADGE = {
  engagement: { bg: P.yellowPale, text: P.yellowText, dot: P.yellowHover, label: 'Engagement' },
  conversion: { bg: P.successPale, text: P.successDeep, dot: P.success,   label: 'Conversion' },
  hybrid:     { bg: P.surface2,    text: P.ink2,        dot: P.muted2,    label: 'Hybrid' },
};

const STATUS_DOT = {
  active: P.success, live: P.success, contracted: P.success,
  negotiating: P.yellowHover, applied: P.yellowHover, published: P.yellowHover, pending_wallet: P.yellowHover,
  invited: P.muted2, draft: P.muted2, completed: P.muted2,
  declined: P.danger, rejected_by_brand: P.danger, cancelled: P.danger, expired: P.muted3, slots_filled: P.muted3,
};

const OPEN_GROUP_HIDDEN = new Set(['invited', 'declined', 'rejected_by_brand', 'expired', 'slots_filled']);

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function BrandCampaignSetsListScreen({ navigation, route }) {
  const { campaignId } = route.params || {};
  const [campaign, setCampaign]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await brandApi.getCampaign(campaignId);
    setLoading(false);
    if (res.success) setCampaign(res.data?.campaign);
  }

  useFocusEffect(useCallback(() => { load(); }, [campaignId]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [campaignId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={P.ink} /></View>;
  }
  if (!campaign) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Campaign not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sets = campaign.sets || [];

  return (
    <View style={styles.container}>
      {/* Ink header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {campaign.name || 'Campaign'}</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Campaign sets</Text>
            <Text style={styles.headerCrumb}>/dashboard/campaigns/{campaignId?.slice(0, 8)}/sets</Text>
          </View>
          <Text style={styles.headerCount}>{sets.length} {sets.length === 1 ? 'set' : 'sets'}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
      >
        {sets.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconGlyph}>·</Text></View>
            <Text style={styles.emptyText}>No sets created yet</Text>
            <Text style={styles.emptySubText}>Sets organise influencers by content type, location, or campaign goal.</Text>
          </View>
        ) : (
          sets.map(s => {
            const goal = (s.goal || '').toLowerCase();
            const goalCfg = GOAL_BADGE[goal] || GOAL_BADGE.engagement;
            const isOpenGroup = s.influencer_mode === 'open_group';
            const inf = s.influencers || [];

            // Funnel counts for open_group sets
            const broadcast = inf.length;
            const applied   = inf.filter(ci => ci.status === 'applied').length;
            const approved  = inf.filter(ci => ['accepted', 'contracted', 'active', 'completed', 'live'].includes(ci.status)).length;

            // Mini-roster — top 5 contracted/active influencers, fallback to whatever exists
            const visible = inf.filter(ci => !OPEN_GROUP_HIDDEN.has(ci.status) || !isOpenGroup);
            const roster = visible.slice(0, 5);
            const remaining = visible.length - roster.length;

            const setBudget = s.set_budget || s.budget;

            return (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.setName}>{s.name || 'Set'}</Text>
                    <View style={styles.setMetaRow}>
                      {(s.window_start || s.window_end) && (
                        <Text style={styles.setMetaItem}>
                          {formatDate(s.window_start)} → {formatDate(s.window_end)}
                        </Text>
                      )}
                      {setBudget > 0 && (
                        <>
                          {(s.window_start || s.window_end) && <Text style={styles.setMetaSep}>·</Text>}
                          <Text style={styles.setMetaItem}>Budget: <Text style={styles.setMetaV}>{fmtRupees(setBudget)}</Text></Text>
                        </>
                      )}
                    </View>
                  </View>
                  {goal && (
                    <View style={[styles.goalBadge, { backgroundColor: goalCfg.bg }]}>
                      <View style={[styles.goalDot, { backgroundColor: goalCfg.dot }]} />
                      <Text style={[styles.goalText, { color: goalCfg.text }]}>{goalCfg.label}</Text>
                    </View>
                  )}
                </View>

                {/* Funnel row for open_group */}
                {isOpenGroup && (
                  <View style={styles.funnel}>
                    <View style={styles.funnelCell}>
                      <Text style={styles.funnelLabel}>Broadcast</Text>
                      <Text style={styles.funnelV}>{broadcast}</Text>
                    </View>
                    <View style={[styles.funnelCell, styles.funnelCellDivided]}>
                      <Text style={styles.funnelLabel}>Applied</Text>
                      <Text style={styles.funnelV}>{applied}</Text>
                    </View>
                    <View style={[styles.funnelCell, styles.funnelCellDivided]}>
                      <Text style={styles.funnelLabel}>Approved</Text>
                      <Text style={styles.funnelV}>{approved}{s.max_cap ? <Text style={styles.funnelMute}> / {s.max_cap}</Text> : null}</Text>
                    </View>
                  </View>
                )}

                {/* Mini-roster */}
                {roster.length > 0 ? (
                  <View style={styles.roster}>
                    <Text style={styles.rosterLabel}>
                      Influencers{!isOpenGroup ? ` · ${visible.length}` : ''}
                    </Text>
                    {roster.map(ci => (
                      <View key={ci.id} style={styles.rosterRow}>
                        <View style={[styles.rosterDot, { backgroundColor: STATUS_DOT[ci.status] || P.muted3 }]} />
                        <Text style={styles.rosterName} numberOfLines={1}>{ci.influencer_name || 'Influencer'}</Text>
                        <Text style={styles.rosterHandle} numberOfLines={1}>@{ci.instagram_handle || '—'}</Text>
                        <Text style={styles.rosterStatus} numberOfLines={1}>{(ci.status || '').replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                    {remaining > 0 && (
                      <Text style={styles.rosterMore}>+ {remaining} more</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.emptyRoster}>
                    {isOpenGroup ? 'No applicants matched yet.' : 'No influencers assigned yet.'}
                  </Text>
                )}

                {/* "View all" CTA → InfluencersList filtered to this set */}
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('BrandCampaignInfluencersList', { campaignId, setIdFilter: s.id })}
                >
                  <Text style={styles.viewAllText}>View all influencers in this set</Text>
                  <Text style={styles.viewAllArrow}>→</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg, padding: 24 },
  errorText: { fontSize: 13, color: P.dangerDeep, marginBottom: 16, textAlign: 'center' },
  goBackBtn: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: P.surface2, borderRadius: 10 },
  goBackBtnText: { fontSize: 13, fontWeight: '700', color: P.ink },

  header: { backgroundColor: P.ink, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  backBtn: { paddingVertical: 4 },
  backBtnText: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: P.white, letterSpacing: -0.3 },
  headerCrumb: { fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3, marginTop: 3 },
  headerCount: { fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.6)' },

  list: { padding: 14, gap: 10 },
  emptyCard: { backgroundColor: P.surface, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: P.border },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: P.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyIconGlyph: { fontSize: 22, fontWeight: '700', color: P.muted2 },
  emptyText: { fontSize: 13.5, fontWeight: '700', color: P.ink, marginBottom: 4 },
  emptySubText: { fontSize: 11, color: P.muted, textAlign: 'center', lineHeight: 16 },

  card: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 14, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  setName: { fontSize: 14, fontWeight: '700', color: P.ink, letterSpacing: 0.1 },
  setMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 4 },
  setMetaItem: { fontFamily: 'monospace', fontSize: 10.5, color: P.muted2 },
  setMetaV: { color: P.ink, fontWeight: '600' },
  setMetaSep: { fontSize: 10.5, color: P.muted3 },

  goalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  goalDot: { width: 4, height: 4, borderRadius: 2 },
  goalText: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  funnel: { flexDirection: 'row', backgroundColor: P.surface2, borderRadius: 10, paddingVertical: 8 },
  funnelCell: { flex: 1, paddingHorizontal: 8, alignItems: 'center' },
  funnelCellDivided: { borderLeftWidth: 1, borderLeftColor: P.border },
  funnelLabel: { fontSize: 9, fontWeight: '700', color: P.muted2, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 },
  funnelV: { fontFamily: 'monospace', fontWeight: '700', fontSize: 16, color: P.ink },
  funnelMute: { color: P.muted2, fontWeight: '500' },

  roster: { paddingTop: 4 },
  rosterLabel: { fontSize: 9.5, fontWeight: '700', color: P.muted2, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  rosterDot: { width: 5, height: 5, borderRadius: 2.5 },
  rosterName: { fontSize: 11.5, fontWeight: '600', color: P.ink, maxWidth: '32%' },
  rosterHandle: { fontFamily: 'monospace', fontSize: 10.5, color: P.muted2, flex: 1, minWidth: 0 },
  rosterStatus: { fontSize: 9.5, fontWeight: '600', color: P.muted, textTransform: 'capitalize' },
  rosterMore: { fontSize: 10.5, color: P.muted2, paddingTop: 4, paddingLeft: 11 },
  emptyRoster: { fontSize: 11, color: P.muted2, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  viewAllBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: P.surface2, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 },
  viewAllText: { fontSize: 11.5, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
  viewAllArrow: { fontFamily: 'monospace', fontWeight: '700', color: P.ink },
});
