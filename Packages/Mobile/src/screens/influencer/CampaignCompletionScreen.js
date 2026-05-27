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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees, fmtNum } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

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
  1: 'T1 — Contract Signed',
  2: 'T2 — Content Live',
  3: 'T3 — 30 Days Post-Live',
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * CampaignCompletionScreen — terminal celebration when campaign_influencers.status='completed'.
 *
 * Flow 32 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/JetBrains
 * Mono fonts. Ink celebration hero with yellow check + yellow "Completed!" title
 * (design call #1). successPale Total Earned with successText (design call #2).
 * success/yellow tranche dots matching Flow 31 pattern. Yellow-active vertical
 * timeline + ink-bordered yellow highlight final step. Ink/yellow Outfit-Black
 * UPPERCASE CTAs.
 *
 * All API calls + Promise.all loading + goal-aware commission section + engagement
 * conditional + TimelineItem sub-component + popToTop on Back-to-Campaigns
 * preserved verbatim.
 */

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
        <ActivityIndicator size="large" color={P.yellow} />
        <Text style={styles.loadingText}>Loading summary…</Text>
      </View>
    );
  }

  if (!data || !data.campaign) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Campaign not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>GO BACK</Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-left" size={16} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>

        <View style={styles.celebrationContent}>
          <View style={styles.checkCircle}>
            <Icon name="check-bold" size={28} color={P.ink} />
          </View>
          <Text style={styles.celebrationTitle}>Campaign Completed!</Text>
          <Text style={styles.celebrationSub}>
            Great work on this campaign with {campaign.brand_name || 'the brand'}
          </Text>
          <Text style={styles.campaignLabel}>{campaign.campaign_name}</Text>
        </View>

        <View style={styles.celebrationAccent} />
      </View>

      {/* ── Earnings Summary ──────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTtl}>Earnings Summary</Text>

        <View style={styles.totalEarnedBox}>
          <Text style={styles.totalEarnedLabel}>TOTAL EARNED</Text>
          <Text style={styles.totalEarnedValue}>{fmtRupees(totalEarned)}</Text>
        </View>

        {/* Tranche breakdown */}
        <Text style={styles.sectionLabel}>TRANCHE PAYMENTS</Text>
        {(tranches || []).length > 0 ? (
          tranches.map(t => {
            const isReleased = t.status === 'released';
            return (
              <View key={t.tranche_number} style={styles.trancheRow}>
                <View style={[
                  styles.trancheDot,
                  { backgroundColor: isReleased ? P.success : P.yellow },
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trancheTitle}>
                    {TRANCHE_LABELS[t.tranche_number] || `Tranche ${t.tranche_number}`}
                  </Text>
                  {t.released_at && (
                    <Text style={styles.trancheDate}>Released: {formatDate(t.released_at)}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.trancheAmount}>{fmtRupees(t.net_to_influencer)}</Text>
                  <StatusPill status={t.status} />
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
            <Text style={styles.sectionLabel}>FOLLOWER COMMISSIONS</Text>
            <View style={styles.commRow}>
              <Text style={styles.commLabel}>Confirmed</Text>
              <Text style={[styles.commValue, { color: P.successText }]}>
                {fmtRupees(confirmedCommissions)}
              </Text>
            </View>
            <View style={styles.commRow}>
              <Text style={styles.commLabel}>Pending (30-day window)</Text>
              <Text style={[styles.commValue, { color: P.yellowText }]}>
                {fmtRupees(pendingCommissions)}
              </Text>
            </View>
          </View>
        )}

        {/* Pending vs Confirmed summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: P.success }]} />
            <Text style={styles.summaryLabel}>RELEASED / CONFIRMED</Text>
            <Text style={[styles.summaryValue, { color: P.successText }]}>
              {fmtRupees(totalTrancheReleased + confirmedCommissions)}
            </Text>
          </View>
          {(totalTranchePending + pendingCommissions > 0) && (
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: P.yellow }]} />
              <Text style={styles.summaryLabel}>PENDING</Text>
              <Text style={[styles.summaryValue, { color: P.yellowText }]}>
                {fmtRupees(totalTranchePending + pendingCommissions)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.tdsNote}>
          <Text style={styles.tdsText}>
            <Text style={{ fontWeight: '800' }}>Note: </Text>
            10% TDS is deducted at the time of withdrawal, not at earning.
          </Text>
        </View>
      </View>

      {/* ── Performance Stats ─────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTtl}>Performance Stats</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {completedDeliverables}/{totalDeliverables}
            </Text>
            <Text style={styles.statLabel}>DELIVERABLES DONE</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{contentTypes.length}</Text>
            <Text style={styles.statLabel}>CONTENT TYPES</Text>
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
            <Text style={styles.sectionLabel}>ENGAGEMENT</Text>
            <View style={styles.statsGrid}>
              {totalViews > 0 && (
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{fmtNum(totalViews)}</Text>
                  <Text style={styles.statLabel}>VIEWS</Text>
                </View>
              )}
              {totalLikes > 0 && (
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{fmtNum(totalLikes)}</Text>
                  <Text style={styles.statLabel}>LIKES</Text>
                </View>
              )}
              {totalComments > 0 && (
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{fmtNum(totalComments)}</Text>
                  <Text style={styles.statLabel}>COMMENTS</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* ── Campaign Timeline ─────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTtl}>Campaign Timeline</Text>

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
          <Text style={styles.primaryBtnText}>VIEW EARNINGS</Text>
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
          <Text style={styles.secondaryBtnText}>BACK TO CAMPAIGNS</Text>
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
  container: { flex: 1, backgroundColor: P.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  emptyText: { fontSize: 14, color: P.muted2, marginBottom: 16, fontFamily: fonts.sansRegular },
  loadingText: { fontSize: 13, color: P.muted2, marginTop: 12, fontFamily: fonts.sansRegular },

  // Celebration header — ink + yellow per locked design call #1
  celebrationHeader: {
    backgroundColor: P.ink,
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 28,
    position: 'relative',
  },
  celebrationAccent: {
    position: 'absolute',
    left: 18,
    bottom: 6,
    width: 30,
    height: 3,
    backgroundColor: P.yellow,
    borderRadius: 2,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 18,
  },
  backText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.3,
    fontFamily: fonts.monoBold,
  },
  celebrationContent: { alignItems: 'center' },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: P.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: P.yellow,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
    fontFamily: fonts.displayBlack,
  },
  celebrationSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    fontFamily: fonts.sansRegular,
  },
  campaignLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: P.white,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: fonts.monoBold,
  },

  // Card
  card: {
    margin: 14,
    marginBottom: 0,
    backgroundColor: P.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: P.border,
  },
  cardTtl: {
    fontSize: 12.5,
    fontWeight: '800',
    color: P.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 11,
    fontFamily: fonts.displayBlack,
  },

  // Total earned highlight — successPale per locked design call #2
  totalEarnedBox: {
    backgroundColor: P.successPale,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A8E6CC',
  },
  totalEarnedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: P.successText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
    fontFamily: fonts.monoBold,
  },
  totalEarnedValue: {
    fontSize: 32,
    fontWeight: '900',
    color: P.successText,
    letterSpacing: -0.5,
    fontFamily: fonts.monoBold,
  },

  // Section label
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: P.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 6,
    fontFamily: fonts.monoBold,
  },

  // Tranche rows
  trancheRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: P.borderSoft,
    gap: 10,
  },
  trancheDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  trancheTitle: { fontSize: 12.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  trancheDate: { fontSize: 9.5, color: P.successText, marginTop: 2, fontFamily: fonts.monoMedium },
  trancheAmount: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.monoBold },

  // Commission section
  commissionSection: {
    marginTop: 14,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: P.border,
  },
  commRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  commLabel: { fontSize: 12, color: P.muted, fontFamily: fonts.sansRegular },
  commValue: { fontSize: 13, fontWeight: '800', fontFamily: fonts.monoBold },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: P.border,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: P.bg2,
    borderRadius: 10,
    padding: 11,
    alignItems: 'center',
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 5 },
  summaryLabel: {
    fontSize: 9.5,
    color: P.muted2,
    fontWeight: '700',
    marginBottom: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: fonts.monoMedium,
  },
  summaryValue: { fontSize: 15, fontWeight: '900', fontFamily: fonts.monoBold },

  tdsNote: {
    backgroundColor: P.yellowPale,
    borderRadius: 8,
    padding: 9,
    paddingHorizontal: 11,
    marginTop: 12,
  },
  tdsText: { fontSize: 10.5, color: P.yellowText, lineHeight: 16, fontFamily: fonts.sansRegular },

  noDataText: { fontSize: 12.5, color: P.muted2, lineHeight: 18, paddingVertical: 8, fontFamily: fonts.sansRegular },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 11,
  },
  statBox: {
    flex: 1,
    backgroundColor: P.bg2,
    borderRadius: 11,
    padding: 13,
    alignItems: 'center',
  },
  statNumber: { fontSize: 22, fontWeight: '900', color: P.ink, lineHeight: 24, fontFamily: fonts.monoBold },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: P.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 5,
    fontFamily: fonts.monoMedium,
  },

  // Content type badges
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: P.yellowPale,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: P.yellowText,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: fonts.monoBold,
  },

  engagementSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: P.border,
  },

  // Timeline
  timeline: { paddingLeft: 4 },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineDotCol: {
    width: 22,
    alignItems: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: P.border,
  },
  timelineLineActive: { backgroundColor: P.yellow },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: P.border,
    zIndex: 1,
  },
  timelineDotActive: { backgroundColor: P.yellow },
  timelineDotHighlight: {
    backgroundColor: P.yellow,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: P.ink,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 11,
    paddingBottom: 14,
    justifyContent: 'center',
  },
  timelineLabel: { fontSize: 12.5, fontWeight: '700', color: P.muted2, fontFamily: fonts.displayBold },
  timelineLabelActive: { color: P.ink, fontWeight: '800' },
  timelineLabelHighlight: { color: P.ink, fontWeight: '900', fontFamily: fonts.displayBlack },
  timelineDate: { fontSize: 10, color: P.muted2, marginTop: 2, fontWeight: '700', fontFamily: fonts.monoMedium },

  // Action buttons
  actionsCard: {
    margin: 14,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: P.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: P.yellow,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    fontFamily: fonts.displayBlack,
  },
  secondaryBtn: {
    backgroundColor: P.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: P.ink,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: P.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontFamily: fonts.displayBold,
  },

  backBtn: {
    backgroundColor: P.ink,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backBtnText: { fontSize: 13, fontWeight: '900', color: P.yellow, letterSpacing: 0.2, fontFamily: fonts.displayBlack },
});
