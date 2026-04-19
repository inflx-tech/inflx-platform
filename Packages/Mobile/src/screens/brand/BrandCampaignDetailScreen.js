import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function BrandCampaignDetailScreen({ navigation, route }) {
  const { campaignId } = route.params || {};
  const [campaign, setCampaign]   = useState(null);
  const [escrow, setEscrow]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  async function load() {
    setError(null);
    const [campRes, escrowRes] = await Promise.all([
      brandApi.getCampaign(campaignId),
      brandApi.getCampaignEscrow(campaignId),
    ]);
    setLoading(false);
    if (campRes.success) {
      setCampaign(campRes.data?.campaign);
    } else {
      setError(campRes.error?.message || 'Failed to load campaign');
    }
    if (escrowRes.success) {
      setEscrow(escrowRes.data);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [campaignId])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [campaignId]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleCancelInfluencer(ci) {
    Alert.alert(
      'Cancel Influencer',
      `Remove ${ci.influencer_name || ci.instagram_handle} from this campaign?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(ci.id);
            const res = await brandApi.cancelInfluencer(campaignId, ci.id);
            setActionLoading(null);
            if (res.success) {
              Alert.alert('Done', 'Influencer assignment cancelled.');
              load();
            } else {
              Alert.alert('Error', res.error?.message || 'Failed to cancel');
            }
          },
        },
      ]
    );
  }

  async function handleReviewDeliverable(deliverableId, action, feedback) {
    setActionLoading(deliverableId);
    const body = action === 'approve'
      ? { action: 'approve' }
      : { action: 'request_revision', feedback: feedback || 'Please revise.' };
    const res = await brandApi.reviewDeliverable(deliverableId, body);
    setActionLoading(null);
    if (res.success) {
      Alert.alert('Done', action === 'approve' ? 'Content approved.' : 'Revision requested.');
      load();
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to review');
    }
  }

  function promptRevisionFeedback(deliverableId) {
    Alert.prompt
      ? Alert.prompt(
          'Request Revision',
          'Enter feedback for the influencer:',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Submit', onPress: (text) => handleReviewDeliverable(deliverableId, 'request_revision', text) },
          ],
          'plain-text',
          ''
        )
      : handleReviewDeliverable(deliverableId, 'request_revision', 'Please revise the content.');
  }

  // ── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Loading campaign...</Text>
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Campaign not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const sets = campaign.sets || [];
  const allInfluencers = sets.flatMap(s => (s.influencers || []).map(ci => ({ ...ci, set_name: s.name, set_goal: s.goal })));
  const totalBudget = Number(campaign.total_budget) || 0;

  // Calculate allocated from sets or influencer agreed fees
  const allocatedBudget = allInfluencers.reduce((sum, ci) => sum + (Number(ci.agreed_fee) || 0), 0);
  const remainingBudget = Math.max(0, totalBudget - allocatedBudget);
  const budgetProgress = totalBudget > 0 ? Math.min(1, allocatedBudget / totalBudget) : 0;

  // Goal-aware: if every set is 'conversion', campaign has no fee/escrow.
  // (Mixed campaigns with at least one engagement/hybrid set still show
  // budget + tranches.)
  const setGoals          = sets.map(s => (s.goal || '').toLowerCase()).filter(Boolean);
  const hasFeeBearingSet  = setGoals.some(g => g === 'engagement' || g === 'hybrid');
  const isConversionOnly  = setGoals.length > 0 && !hasFeeBearingSet;

  // Collect all deliverables from influencers that need review
  const deliverablesToReview = [];
  for (const set of sets) {
    for (const ci of (set.influencers || [])) {
      if (ci.deliverables) {
        for (const d of ci.deliverables) {
          if (['submitted', 'under_review'].includes(d.status)) {
            deliverablesToReview.push({ ...d, influencer_name: ci.influencer_name, instagram_handle: ci.instagram_handle });
          }
        }
      }
    }
  }

  // Escrow data
  const escrowEntries = escrow?.entries || escrow?.escrow_entries || [];
  const trancheSummary = [1, 2, 3].map(n => {
    const entries = escrowEntries.filter(e => e.tranche_number === n);
    const locked = entries.filter(e => e.status === 'locked').reduce((s, e) => s + Number(e.amount || 0), 0);
    const released = entries.filter(e => e.status === 'released').reduce((s, e) => s + Number(e.amount || 0), 0);
    return { tranche: n, locked, released, total: locked + released };
  });
  const hasEscrowData = escrowEntries.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<-'} Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.campaignNameHeader} numberOfLines={2}>{campaign.name}</Text>
            <View style={styles.headerDates}>
              <Text style={styles.headerDate}>{formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}</Text>
            </View>
          </View>
          <StatusBadge status={campaign.status} size={11} />
        </View>
      </View>

      {/* ── Budget Section (only meaningful when fees are involved) ────── */}
      {isConversionOnly ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Model</Text>
          <View style={[styles.budgetHighlight, { backgroundColor: colors.tealPale }]}>
            <Text style={[styles.budgetLabel, { color: colors.tealDeep }]}>Commission per Conversion</Text>
            <Text style={[styles.budgetValue, { color: colors.tealDeep, fontSize: 18 }]}>
              No upfront fee
            </Text>
          </View>
          <Text style={[styles.briefText, { marginTop: 10 }]}>
            Influencers earn commission only when their tracking link drives a conversion.
            Earnings hold for 30 days, then move to their wallet.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Budget Overview</Text>
          <View style={styles.budgetHighlight}>
            <Text style={styles.budgetLabel}>Total Budget</Text>
            <Text style={styles.budgetValue}>{fmtRupees(totalBudget)}</Text>
          </View>
          <View style={styles.budgetRow}>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetItemLabel}>Allocated</Text>
              <Text style={[styles.budgetItemValue, { color: colors.navy }]}>{fmtRupees(allocatedBudget)}</Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetItemLabel}>Remaining</Text>
              <Text style={[styles.budgetItemValue, { color: colors.tealDeep }]}>{fmtRupees(remainingBudget)}</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.round(budgetProgress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(budgetProgress * 100)}% allocated</Text>
        </View>
      )}

      {/* ── Brief ───────────────────────────────────────────────────────── */}
      {campaign.brief ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign Brief</Text>
          <Text style={styles.briefText}>{campaign.brief}</Text>
        </View>
      ) : null}

      {/* ── Sets Section ────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Campaign Sets ({sets.length})</Text>
        {sets.length === 0 ? (
          <Text style={styles.noDataText}>No sets created yet.</Text>
        ) : (
          sets.map(set => {
            const infCount = (set.influencers || []).length;
            return (
              <View key={set.id} style={styles.setRow}>
                <View style={styles.setHeader}>
                  <Text style={styles.setName}>{set.name}</Text>
                  {set.goal && <StatusBadge status={set.goal} size={9} />}
                </View>
                <View style={styles.setMeta}>
                  {set.window_start && (
                    <Text style={styles.setMetaItem}>{formatDate(set.window_start)} - {formatDate(set.window_end)}</Text>
                  )}
                  <Text style={styles.setMetaItem}>{infCount} influencer{infCount !== 1 ? 's' : ''}</Text>
                  {set.set_budget > 0 && (
                    <Text style={styles.setMetaItem}>Budget: {fmtRupees(set.set_budget)}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Influencers Section ─────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Influencers ({allInfluencers.length})</Text>
        {allInfluencers.length === 0 ? (
          <Text style={styles.noDataText}>No influencers assigned yet.</Text>
        ) : (
          allInfluencers.map(ci => {
            const CANCELLABLE = ['invited', 'accepted', 'negotiating'];
            const canCancel = CANCELLABLE.includes(ci.status);
            const isCancelling = actionLoading === ci.id;

            // Count deliverables
            const deliverables = ci.deliverables || [];
            const completedDel = deliverables.filter(d => ['approved', 'live'].includes(d.status)).length;
            const totalDel = deliverables.length;

            // Per-row goal awareness — derived from the parent set's goal
            const rowGoal        = (ci.set_goal || 'engagement').toLowerCase();
            const rowShowFee     = rowGoal === 'engagement' || rowGoal === 'hybrid';
            const rowShowComm    = rowGoal === 'conversion' || rowGoal === 'hybrid';

            return (
              <View key={ci.id} style={styles.influencerRow}>
                <View style={styles.influencerInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.influencerName}>{ci.influencer_name || 'Influencer'}</Text>
                    <Text style={styles.influencerHandle}>@{ci.instagram_handle || '--'}</Text>
                    {ci.set_name && (
                      <Text style={styles.influencerSet}>{ci.set_name}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge status={ci.status} size={9} />
                    {rowShowFee && ci.agreed_fee > 0 && (
                      <Text style={styles.influencerFee}>{fmtRupees(ci.agreed_fee)}</Text>
                    )}
                    {rowShowComm && ci.commission_pct > 0 && (
                      <Text style={[styles.influencerFee, { color: colors.tealDeep }]}>{parseFloat(ci.commission_pct)}% comm.</Text>
                    )}
                  </View>
                </View>

                {totalDel > 0 && (
                  <View style={styles.deliverableProgress}>
                    <View style={styles.delProgressBarBg}>
                      <View style={[styles.delProgressBarFill, { width: totalDel > 0 ? `${Math.round((completedDel / totalDel) * 100)}%` : '0%' }]} />
                    </View>
                    <Text style={styles.delProgressText}>{completedDel}/{totalDel} deliverables</Text>
                  </View>
                )}

                <View style={styles.influencerActions}>
                  {canCancel && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancelInfluencer(ci)}
                      disabled={isCancelling}
                    >
                      {isCancelling
                        ? <ActivityIndicator size="small" color={colors.red} />
                        : <Text style={styles.cancelBtnText}>Cancel</Text>
                      }
                    </TouchableOpacity>
                  )}
                  {ci.status === 'negotiating' && (
                    <TouchableOpacity
                      style={styles.negotiateBtn}
                      onPress={() => navigation.navigate('BrandNegotiation', {
                        negotiationId: ci.negotiation_id,
                        campaignInfluencerId: ci.id,
                        influencerName: ci.influencer_name || ci.full_name,
                        influencerHandle: ci.instagram_handle,
                      })}
                    >
                      <Text style={styles.negotiateBtnText}>Open Chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Escrow Section ──────────────────────────────────────────────── */}
      {/* Conversion-only campaigns have no fee → no escrow tranches.
          Only show this card when the campaign actually has fee-bearing sets. */}
      {!isConversionOnly && hasEscrowData && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Escrow Overview</Text>
          {trancheSummary.map(t => {
            const label = t.tranche === 1 ? 'T1 - Contract Signed (25%)'
              : t.tranche === 2 ? 'T2 - Content Live (25%)'
              : 'T3 - 30 Days Post Live (50%)';
            return (
              <View key={t.tranche} style={styles.escrowRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.escrowLabel}>{label}</Text>
                  <View style={styles.escrowAmounts}>
                    <View style={styles.escrowAmountItem}>
                      <View style={[styles.escrowDot, { backgroundColor: colors.navy }]} />
                      <Text style={styles.escrowAmountText}>Locked: {fmtMoney(Math.round(t.locked * 100))}</Text>
                    </View>
                    <View style={styles.escrowAmountItem}>
                      <View style={[styles.escrowDot, { backgroundColor: colors.teal }]} />
                      <Text style={styles.escrowAmountText}>Released: {fmtMoney(Math.round(t.released * 100))}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.escrowTotal}>{fmtMoney(Math.round(t.total * 100))}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Deliverables Awaiting Review ────────────────────────────────── */}
      {deliverablesToReview.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Content Awaiting Review ({deliverablesToReview.length})</Text>
          {deliverablesToReview.map(d => {
            const isReviewing = actionLoading === d.id;
            return (
              <View key={d.id} style={styles.reviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewType}>
                    {DELIVERABLE_LABELS[d.type] || d.type}
                  </Text>
                  <Text style={styles.reviewInfluencer}>@{d.instagram_handle} - {d.influencer_name}</Text>
                  {d.submitted_at && (
                    <Text style={styles.reviewDate}>Submitted: {formatDate(d.submitted_at)}</Text>
                  )}
                  {d.content_url && (
                    <Text style={styles.reviewUrl} numberOfLines={1}>{d.content_url}</Text>
                  )}
                </View>
                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleReviewDeliverable(d.id, 'approve')}
                    disabled={isReviewing}
                  >
                    {isReviewing
                      ? <ActivityIndicator size="small" color={colors.white} />
                      : <Text style={styles.approveBtnText}>Approve</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.revisionBtn}
                    onPress={() => promptRevisionFeedback(d.id)}
                    disabled={isReviewing}
                  >
                    <Text style={styles.revisionBtnText}>Revise</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Web Dashboard Link ──────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.webLink}
        onPress={() => {
          const { openWebDashboard } = require('../../utils/openWebDashboard');
          openWebDashboard(`/dashboard/campaigns/${campaignId}`);
        }}
      >
        <Text style={styles.webLinkIcon}>{'[W]'}</Text>
        <Text style={styles.webLinkText}>Full details on web dashboard</Text>
        <Text style={styles.webLinkArrow}>{'>'}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },
  errorText: { fontSize: 14, color: colors.red, marginBottom: 16, textAlign: 'center', paddingHorizontal: 32 },

  // Header
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  campaignNameHeader: { fontSize: 20, fontWeight: '800', color: colors.white },
  headerDates: { marginTop: 4 },
  headerDate: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  // Card
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },

  // Budget
  budgetHighlight: {
    backgroundColor: colors.navyPale,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 10, fontWeight: '700', color: colors.navy,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  budgetValue: { fontSize: 28, fontWeight: '800', color: colors.navyDeep },
  budgetRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  budgetItem: { flex: 1, alignItems: 'center' },
  budgetItemLabel: {
    fontSize: 10, fontWeight: '700', color: colors.t3,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  budgetItemValue: { fontSize: 16, fontWeight: '800' },
  progressBarBg: {
    height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: {
    height: 6, backgroundColor: colors.navy, borderRadius: 3,
  },
  progressText: { fontSize: 10, color: colors.t3, marginTop: 4, textAlign: 'right' },

  // Brief
  briefText: { fontSize: 13, color: colors.t2, lineHeight: 20 },

  // Sets
  setRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  setName: { fontSize: 14, fontWeight: '700', color: colors.t1, flex: 1, marginRight: 8 },
  setMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  setMetaItem: { fontSize: 11, color: colors.t3 },

  // Influencers
  influencerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  influencerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  influencerName: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  influencerHandle: { fontSize: 12, color: colors.t3, marginTop: 2 },
  influencerSet: { fontSize: 10, color: colors.t3, marginTop: 2, fontStyle: 'italic' },
  influencerFee: { fontSize: 13, fontWeight: '700', color: colors.tealDeep },
  deliverableProgress: { marginTop: 8 },
  delProgressBarBg: {
    height: 4, backgroundColor: colors.surface2, borderRadius: 2, overflow: 'hidden',
  },
  delProgressBarFill: {
    height: 4, backgroundColor: colors.teal, borderRadius: 2,
  },
  delProgressText: { fontSize: 10, color: colors.t3, marginTop: 2 },
  influencerActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cancelBtn: {
    backgroundColor: colors.redPale,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  cancelBtnText: { fontSize: 12, fontWeight: '700', color: colors.red },
  negotiateBtn: {
    backgroundColor: colors.orangePale,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  negotiateBtnText: { fontSize: 12, fontWeight: '700', color: colors.orangeDeep },

  // Escrow
  escrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  escrowLabel: { fontSize: 12, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  escrowAmounts: { flexDirection: 'row', gap: 12 },
  escrowAmountItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  escrowDot: { width: 8, height: 8, borderRadius: 4 },
  escrowAmountText: { fontSize: 11, color: colors.t3 },
  escrowTotal: { fontSize: 14, fontWeight: '800', color: colors.t1 },

  // Review
  reviewRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewType: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  reviewInfluencer: { fontSize: 11, color: colors.t3, marginTop: 2 },
  reviewDate: { fontSize: 10, color: colors.t3, marginTop: 2 },
  reviewUrl: { fontSize: 10, color: colors.navy, marginTop: 2 },
  reviewActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: {
    backgroundColor: colors.teal,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  approveBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  revisionBtn: {
    backgroundColor: colors.orangePale,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  revisionBtnText: { fontSize: 12, fontWeight: '700', color: colors.orangeDeep },

  // Web link
  webLink: {
    margin: 16,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webLinkIcon: { fontSize: 14, fontWeight: '700', color: colors.navy },
  webLinkText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.navy },
  webLinkArrow: { fontSize: 18, color: colors.t3 },

  // Back button (error state)
  backBtn: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  noDataText: { fontSize: 13, color: colors.t3, lineHeight: 18 },
});
