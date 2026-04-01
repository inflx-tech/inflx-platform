import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, fmtMoney, fmtRupees, fmtNum } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const TRANCHE_LABELS = {
  1: 'T1 -- Contract Signed',
  2: 'T2 -- Content Live',
  3: 'T3 -- 30 Days Post-Live',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function CampaignCompletionScreen({ navigation, route }) {
  const { campaignInfluencerId } = route.params || {};
  const [data, setData] = useState(null);
  const [commissionData, setCommissionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [detailRes, commRes] = await Promise.all([
      influencerApi.getMyCampaignDetail(campaignInfluencerId),
      influencerApi.getCampaignCommissionDetail(campaignInfluencerId),
    ]);
    setLoading(false);
    if (detailRes.success) {
      setData(detailRes.data);
    } else {
      Alert.alert('Error', detailRes.error?.message || 'Failed to load campaign details');
    }
    if (commRes.success) {
      setCommissionData(commRes.data);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  if (!data || !data.campaign) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Campaign not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { campaign, deliverables, contract, tranches } = data;
  const fee = campaign.agreed_fee || 0;

  // Compute tranche totals
  const releasedTranches = (tranches || []).filter(t => t.status === 'released');
  const totalTrancheReleased = releasedTranches.reduce((sum, t) => sum + (t.net_to_influencer || 0), 0);
  const pendingTranches = (tranches || []).filter(t => t.status !== 'released');
  const totalTranchePending = pendingTranches.reduce((sum, t) => sum + (t.net_to_influencer || 0), 0);

  // Commission earnings from conversion/hybrid
  const totalCommissions = commissionData?.total_earned || 0;
  const pendingCommissions = commissionData?.pending_amount || 0;
  const confirmedCommissions = commissionData?.confirmed_amount || 0;

  const totalEarned = totalTrancheReleased + totalCommissions;

  // Deliverable stats
  const totalDeliverables = deliverables?.length || 0;
  const completedDeliverables = (deliverables || []).filter(
    d => d.status === 'approved' || d.status === 'live'
  ).length;
  const contentTypes = [...new Set((deliverables || []).map(d => d.type))];

  // Engagement stats (aggregate from deliverables if available)
  const totalViews = (deliverables || []).reduce((s, d) => s + (d.views || d.reach || 0), 0);
  const totalLikes = (deliverables || []).reduce((s, d) => s + (d.likes || 0), 0);
  const totalComments = (deliverables || []).reduce((s, d) => s + (d.comments || 0), 0);
  const hasEngagement = totalViews > 0 || totalLikes > 0 || totalComments > 0;

  return (
    <ScrollView style={styles.container}>
      {/* ── Celebration Header ──────────────────────────────────────── */}
      <View style={styles.celebrationHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<-'} Back</Text>
        </TouchableOpacity>

        <View style={styles.celebrationContent}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>{'[OK]'}</Text>
          </View>
          <Text style={styles.celebrationTitle}>Campaign Completed!</Text>
          <Text style={styles.celebrationSub}>
            Great work on this campaign with {campaign.brand_name || 'the brand'}
          </Text>
          <Text style={styles.campaignLabel}>{campaign.campaign_name}</Text>
        </View>
      </View>

      {/* ── Earnings Summary ──────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitleGold}>Earnings Summary</Text>
          <Text style={styles.earnIcon}>{'[$]'}</Text>
        </View>

        <View style={styles.totalEarnedBox}>
          <Text style={styles.totalEarnedLabel}>Total Earned</Text>
          <Text style={styles.totalEarnedValue}>{fmtRupees(totalEarned)}</Text>
        </View>

        {/* Tranche breakdown */}
        <Text style={styles.sectionLabel}>Tranche Payments</Text>
        {(tranches || []).length > 0 ? (
          tranches.map(t => {
            const isReleased = t.status === 'released';
            return (
              <View key={t.tranche_number} style={styles.trancheRow}>
                <View style={[
                  styles.trancheDot,
                  { backgroundColor: isReleased ? colors.teal : colors.orange },
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trancheTitle}>
                    {TRANCHE_LABELS[t.tranche_number] || `Tranche ${t.tranche_number}`}
                  </Text>
                  {t.released_at && (
                    <Text style={styles.trancheDate}>Released: {formatDate(t.released_at)}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.trancheAmount}>{fmtRupees(t.net_to_influencer)}</Text>
                  <StatusBadge status={t.status} size={9} />
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.noDataText}>No tranche data available.</Text>
        )}

        {/* Follower commissions (for conversion/hybrid campaigns) */}
        {(campaign.goal === 'conversion' || campaign.goal === 'hybrid') && (
          <View style={styles.commissionSection}>
            <Text style={styles.sectionLabel}>Follower Commissions</Text>
            <View style={styles.commRow}>
              <Text style={styles.commLabel}>Confirmed</Text>
              <Text style={[styles.commValue, { color: colors.teal }]}>
                {fmtRupees(confirmedCommissions)}
              </Text>
            </View>
            <View style={styles.commRow}>
              <Text style={styles.commLabel}>Pending (30-day window)</Text>
              <Text style={[styles.commValue, { color: colors.orange }]}>
                {fmtRupees(pendingCommissions)}
              </Text>
            </View>
          </View>
        )}

        {/* Pending vs Confirmed summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: colors.teal }]} />
            <Text style={styles.summaryLabel}>Released / Confirmed</Text>
            <Text style={[styles.summaryValue, { color: colors.tealDeep }]}>
              {fmtRupees(totalTrancheReleased + confirmedCommissions)}
            </Text>
          </View>
          {(totalTranchePending + pendingCommissions > 0) && (
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.orange }]} />
              <Text style={styles.summaryLabel}>Pending</Text>
              <Text style={[styles.summaryValue, { color: colors.orangeDeep }]}>
                {fmtRupees(totalTranchePending + pendingCommissions)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.tdsNote}>
          <Text style={styles.tdsText}>
            Note: 10% TDS is deducted at the time of withdrawal, not at earning.
          </Text>
        </View>
      </View>

      {/* ── Performance Stats ─────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Performance Stats</Text>
          <Text style={styles.earnIcon}>{'[*]'}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {completedDeliverables}/{totalDeliverables}
            </Text>
            <Text style={styles.statLabel}>Deliverables Done</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{contentTypes.length}</Text>
            <Text style={styles.statLabel}>Content Types</Text>
          </View>
        </View>

        {contentTypes.length > 0 && (
          <View style={styles.typesRow}>
            {contentTypes.map(type => (
              <View key={type} style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {DELIVERABLE_LABELS[type] || type}
                </Text>
              </View>
            ))}
          </View>
        )}

        {hasEngagement && (
          <View style={styles.engagementSection}>
            <Text style={styles.sectionLabel}>Engagement</Text>
            <View style={styles.statsGrid}>
              {totalViews > 0 && (
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{fmtNum(totalViews)}</Text>
                  <Text style={styles.statLabel}>Views</Text>
                </View>
              )}
              {totalLikes > 0 && (
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{fmtNum(totalLikes)}</Text>
                  <Text style={styles.statLabel}>Likes</Text>
                </View>
              )}
              {totalComments > 0 && (
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{fmtNum(totalComments)}</Text>
                  <Text style={styles.statLabel}>Comments</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* ── Campaign Timeline ─────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Campaign Timeline</Text>
          <Text style={styles.earnIcon}>{'[T]'}</Text>
        </View>

        <View style={styles.timeline}>
          <TimelineItem
            label="Offer Accepted"
            date={campaign.accepted_at || campaign.offer_accepted_at}
            isFirst
          />
          <TimelineItem
            label="Contract Signed"
            date={contract?.influencer_signed_at}
          />
          <TimelineItem
            label="Content Submitted"
            date={
              (deliverables || []).find(d => d.submitted_at)?.submitted_at
              || (deliverables || []).find(d => d.submission_date)?.submission_date
            }
          />
          <TimelineItem
            label="Content Went Live"
            date={
              (deliverables || []).find(d => d.live_confirmed_at)?.live_confirmed_at
            }
          />
          <TimelineItem
            label="Campaign Completed"
            date={campaign.completed_at || campaign.updated_at}
            isLast
            highlight
          />
        </View>
      </View>

      {/* ── Action Buttons ────────────────────────────────────────── */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('CommissionDetail', {
            campaignInfluencerId,
            campaignName: campaign.campaign_name,
          })}
        >
          <Text style={styles.primaryBtnText}>View Earnings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => {
            // Navigate back to MyCampaigns list
            if (navigation.canGoBack()) {
              navigation.popToTop();
            } else {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.secondaryBtnText}>Back to Campaigns</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Timeline Item sub-component ─────────────────────────────────────────────

function TimelineItem({ label, date, isFirst, isLast, highlight }) {
  const hasDate = !!date;
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDotCol}>
        {!isFirst && (
          <View style={[
            styles.timelineLine,
            hasDate && styles.timelineLineActive,
          ]} />
        )}
        <View style={[
          styles.timelineDot,
          hasDate && styles.timelineDotActive,
          highlight && hasDate && styles.timelineDotHighlight,
        ]} />
        {!isLast && (
          <View style={[
            styles.timelineLine,
            hasDate && styles.timelineLineActive,
          ]} />
        )}
      </View>
      <View style={styles.timelineContent}>
        <Text style={[
          styles.timelineLabel,
          hasDate && styles.timelineLabelActive,
          highlight && hasDate && styles.timelineLabelHighlight,
        ]}>
          {label}
        </Text>
        <Text style={styles.timelineDate}>
          {hasDate ? formatDate(date) : 'Pending'}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  emptyText: { fontSize: 14, color: colors.t3, marginBottom: 16 },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },

  // Celebration header
  celebrationHeader: {
    backgroundColor: colors.tealDeep,
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  back: { marginBottom: 16 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  celebrationContent: { alignItems: 'center' },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon: { fontSize: 22, color: colors.white, fontWeight: '800' },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 8,
  },
  celebrationSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  campaignLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },

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
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  cardTitleGold: { fontSize: 14, fontWeight: '700', color: '#7A5500' },
  earnIcon: { fontSize: 18 },

  // Total earned highlight
  totalEarnedBox: {
    backgroundColor: colors.goldPale,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0D060',
  },
  totalEarnedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A5500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalEarnedValue: { fontSize: 32, fontWeight: '800', color: '#5A4000' },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },

  // Tranche rows
  trancheRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  trancheDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  trancheTitle: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  trancheDate: { fontSize: 10, color: colors.teal, marginTop: 2 },
  trancheAmount: { fontSize: 14, fontWeight: '800', color: colors.t1, marginBottom: 4 },

  // Commission section
  commissionSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  commLabel: { fontSize: 13, color: colors.t2 },
  commValue: { fontSize: 14, fontWeight: '700' },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  summaryLabel: { fontSize: 10, color: colors.t3, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  summaryValue: { fontSize: 15, fontWeight: '800' },

  tdsNote: {
    backgroundColor: colors.goldPale,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  tdsText: { fontSize: 11, color: '#7A5500', lineHeight: 16 },

  noDataText: { fontSize: 13, color: colors.t3, lineHeight: 18, paddingVertical: 8 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statNumber: { fontSize: 22, fontWeight: '800', color: colors.t1 },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 4,
  },

  // Content type badges
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: colors.navyPale,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '600', color: colors.navy },

  engagementSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Timeline
  timeline: { paddingLeft: 4 },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 52,
  },
  timelineDotCol: {
    width: 24,
    alignItems: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
  },
  timelineLineActive: { backgroundColor: colors.teal },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    zIndex: 1,
  },
  timelineDotActive: { backgroundColor: colors.teal },
  timelineDotHighlight: {
    backgroundColor: colors.gold,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.goldPale,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  timelineLabel: { fontSize: 13, fontWeight: '600', color: colors.t3 },
  timelineLabelActive: { color: colors.t1 },
  timelineLabelHighlight: { color: '#7A5500', fontWeight: '800' },
  timelineDate: { fontSize: 11, color: colors.t3, marginTop: 2 },

  // Action buttons
  actionsCard: {
    margin: 16,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  secondaryBtn: {
    backgroundColor: colors.navyPale,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.navy },

  backBtn: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
});
