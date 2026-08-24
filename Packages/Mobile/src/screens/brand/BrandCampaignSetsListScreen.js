import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';

/**
 * BrandCampaignSetsListScreen — per-campaign sets list drill-down from
 * BrandCampaignDetailScreen. Shows handpick + open_group sets with goal
 * badges, open-group funnel, mini-roster, and "View all" CTA into
 * BrandCampaignInfluencersList with setIdFilter.
 *
 * Flow 19 (2026-05-25): drop inline P const → import brandPalette from
 * theme/tokens.js; apply Outfit/PJS/JetBrains-Mono fonts everywhere.
 * Goal badges, funnel cells, status dots, mini-roster — all keep their
 * existing semantics, just re-anchored. Behavior preserved 1:1.
 */

const GOAL_BADGE = {
  engagement: { bg: P.warnPale,  text: P.warnText,  dot: P.warn, label: 'Engagement' },
  conversion: { bg: P.successPale, text: P.successText, dot: P.success,     label: 'Conversion' },
  hybrid:     { bg: P.bg2,         text: P.ink2,        dot: P.muted2,      label: 'Hybrid' },
};

const STATUS_DOT = {
  active: P.success, live: P.success, contracted: P.success, accepted: P.success,
  negotiating: P.warn, applied: P.warn, published: P.warn, pending_wallet: P.warn,
  invited: P.muted2, draft: P.muted2, completed: P.muted2,
  declined: P.danger, rejected_by_brand: P.danger, cancelled: P.danger,
  expired: P.muted3, slots_filled: P.muted3,
};

const OPEN_GROUP_HIDDEN = new Set(['invited', 'declined', 'rejected_by_brand', 'expired', 'slots_filled']);

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function BrandCampaignSetsListScreen({ navigation, route }) {
  const { campaignId } = route.params || {};
  const [campaign, setCampaign]     = useState(null);
  const [loading, setLoading]       = useState(true);
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
    return (
      <View style={styles.container}>
        <Header navigation={navigation} campaignName={null} count={null} />
        <View style={styles.center}>
          <ActivityIndicator color={P.ink} size="large" />
        </View>
      </View>
    );
  }
  if (!campaign) {
    return (
      <View style={styles.container}>
        <Header navigation={navigation} campaignName={null} count={null} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Campaign not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
            <Text style={styles.goBackBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const sets = campaign.sets || [];

  return (
    <View style={styles.container}>
      <Header
        navigation={navigation}
        campaignName={campaign.name}
        count={sets.length}
        campaignId={campaignId}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} colors={[P.ink]} />}
      >
        {sets.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>[DOT]</Text></View>
            <Text style={styles.emptyText}>No sets created yet</Text>
            <Text style={styles.emptySubText}>Sets organise influencers by content type, location, or campaign goal.</Text>
          </View>
        ) : (
          sets.map(set => {
            const goal   = (set.goal || '').toLowerCase();
            const goalCfg = GOAL_BADGE[goal] || GOAL_BADGE.engagement;
            const isOpenGroup = set.influencer_mode === 'open_group';
            const inf = set.influencers || [];

            // Funnel counts for open_group sets
            const broadcast = inf.length;
            const applied   = inf.filter(ci => ci.status === 'applied').length;
            const approved  = inf.filter(ci => ['accepted', 'contracted', 'active', 'completed', 'live'].includes(ci.status)).length;

            // Mini-roster — filter hidden for open_group, slice top 5
            const visible = inf.filter(ci => !OPEN_GROUP_HIDDEN.has(ci.status) || !isOpenGroup);
            const roster = visible.slice(0, 5);
            const remaining = visible.length - roster.length;

            const setBudget = set.set_budget || set.budget;

            return (
              <View key={set.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.setName}>{set.name || 'Set'}</Text>
                    <View style={styles.setMetaRow}>
                      {(set.window_start || set.window_end) && (
                        <Text style={styles.setMetaItem}>
                          {formatDate(set.window_start)} → {formatDate(set.window_end)}
                        </Text>
                      )}
                      {setBudget > 0 && (
                        <>
                          {(set.window_start || set.window_end) && <Text style={styles.setMetaSep}>·</Text>}
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
                      <Text style={styles.funnelV}>
                        {approved}
                        {set.max_cap ? <Text style={styles.funnelMute}> / {set.max_cap}</Text> : null}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Mini-roster */}
                {roster.length > 0 ? (
                  <View style={styles.roster}>
                    <Text style={styles.rosterLabel}>
                      {isOpenGroup ? 'Top applicants' : `Influencers · ${visible.length}`}
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
                  onPress={() => navigation.navigate('BrandCampaignInfluencersList', { campaignId, setIdFilter: set.id })}
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

function Header({ navigation, campaignName, count, campaignId }) {
  return (
    <View style={styles.header}>
      {campaignName && (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {campaignName}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.headerRow}>
        <View style={styles.headerL}>
          <Text style={styles.headerTitle}>Campaign sets</Text>
          {campaignId ? (
            <Text style={styles.headerCrumb}>/campaigns/{campaignId.slice(0, 8)}/sets</Text>
          ) : null}
        </View>
        {count != null && (
          <View style={styles.headerCountChip}>
            <Text style={styles.headerCountText}>
              {count} {count === 1 ? 'SET' : 'SETS'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: {
    fontFamily: fonts.sansBold,
    fontSize: 13, color: P.dangerText, marginBottom: 16, textAlign: 'center',
  },
  goBackBtn: {
    paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: P.ink, borderRadius: 10,
  },
  goBackBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 13, fontWeight: '700', color: P.white,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    backgroundColor: P.white,
    paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.border,
  },
  backBtn: { paddingVertical: 2, paddingBottom: 6 },
  backBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5, fontWeight: '600', color: P.muted2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
  },
  headerL: { flex: 1, minWidth: 0, flexDirection: 'column', gap: 5 },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18, fontWeight: '700',
    color: P.ink, letterSpacing: -0.2,
  },
  headerCrumb: {
    fontFamily: fonts.monoMedium,
    fontSize: 9.5, color: P.muted2, letterSpacing: 0.3,
  },
  headerCountChip: {
    backgroundColor: P.bg2,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  headerCountText: {
    fontFamily: fonts.monoBold,
    fontSize: 10.5, fontWeight: '800', color: P.ink,
  },

  // ── List + cards ────────────────────────────────────────
  list: { padding: 14, gap: 10 },

  emptyCard: {
    backgroundColor: P.white,
    borderWidth: 1.5, borderColor: P.bg2, borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 36, paddingHorizontal: 22,
    alignItems: 'center', gap: 10,
  },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 13,
    backgroundColor: P.bg2,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIconText: {
    fontFamily: fonts.monoBold,
    fontSize: 11, fontWeight: '800', color: P.ink, letterSpacing: 0.4,
  },
  emptyText: {
    fontFamily: fonts.displayBold,
    fontSize: 14, fontWeight: '700', color: P.ink,
  },
  emptySubText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17,
    maxWidth: 260,
  },

  card: {
    backgroundColor: P.white,
    borderWidth: 1, borderColor: P.border,
    borderRadius: 14, padding: 13, gap: 10,
  },
  cardHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 10,
  },
  setName: {
    fontFamily: fonts.displayBold,
    fontSize: 14, fontWeight: '700', color: P.ink,
  },
  setMetaRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center', gap: 6, marginTop: 4,
  },
  setMetaItem: {
    fontFamily: fonts.monoMedium,
    fontSize: 10.5, color: P.muted2,
  },
  setMetaV: { color: P.ink, fontWeight: '600' },
  setMetaSep: {
    fontFamily: fonts.monoMedium,
    fontSize: 10.5, color: P.muted3,
  },

  goalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99,
  },
  goalDot: { width: 5, height: 5, borderRadius: 2.5 },
  goalText: {
    fontFamily: fonts.monoBold,
    fontSize: 9, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.3,
  },

  funnel: {
    flexDirection: 'row',
    backgroundColor: P.bg2,
    borderRadius: 10,
    paddingVertical: 9,
  },
  funnelCell: { flex: 1, paddingHorizontal: 8, alignItems: 'center' },
  funnelCellDivided: { borderLeftWidth: 1, borderLeftColor: P.border },
  funnelLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 9, fontWeight: '700', color: P.muted2,
    letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2,
  },
  funnelV: {
    fontFamily: fonts.monoBold,
    fontWeight: '800', fontSize: 16, color: P.ink,
  },
  funnelMute: { color: P.muted2, fontWeight: '500' },

  roster: { paddingTop: 4 },
  rosterLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5, fontWeight: '800', color: P.muted2,
    letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6,
  },
  rosterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4,
  },
  rosterDot: { width: 5, height: 5, borderRadius: 2.5 },
  rosterName: {
    fontFamily: fonts.sansBold,
    fontSize: 11.5, fontWeight: '600', color: P.ink, maxWidth: '38%',
  },
  rosterHandle: {
    fontFamily: fonts.monoMedium,
    fontSize: 10, color: P.muted2, flex: 1, minWidth: 0,
  },
  rosterStatus: {
    fontFamily: fonts.sansBold,
    fontSize: 10, fontWeight: '600', color: P.muted,
    textTransform: 'capitalize',
  },
  rosterMore: {
    fontFamily: fonts.monoMedium,
    fontSize: 10.5, color: P.muted2,
    paddingTop: 4, paddingLeft: 12,
  },
  emptyRoster: {
    fontFamily: fonts.sansMedium,
    fontSize: 11, color: P.muted2, fontStyle: 'italic',
    textAlign: 'center', paddingVertical: 8,
  },

  viewAllBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: P.bg2, borderRadius: 10,
    paddingHorizontal: 13, paddingVertical: 10,
    marginTop: 4,
  },
  viewAllText: {
    fontFamily: fonts.sansBold,
    fontSize: 11.5, fontWeight: '700', color: P.ink, letterSpacing: 0.2,
  },
  viewAllArrow: {
    fontFamily: fonts.monoBold,
    fontSize: 13, color: P.ink, fontWeight: '800',
  },
});
