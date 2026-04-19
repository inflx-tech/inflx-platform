import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

const DELIVERABLE_ICONS = {
  reel: '🎬',
  post: '📸',
  story: '📱',
  youtube_video: '▶️',
  youtube_short: '⚡',
};

const STATUS_PRIORITY = {
  revision_requested: 0,
  pending: 1,
  submitted: 2,
  under_review: 3,
  approved: 4,
  live: 5,
};

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(deadline) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DeliverableListScreen({ navigation, route }) {
  const { campaign_influencer_id, campaign_name, brand_name } = route.params || {};
  const [deliverables, setDeliverables] = useState([]);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!campaign_influencer_id) return;
    if (!isRefresh) setLoading(true);
    setError(null);

    const res = await influencerApi.getContractWithDeliverables(campaign_influencer_id);

    if (res.success) {
      const items = res.data?.deliverables || [];
      // Sort: action-needed first (revision_requested, pending), then by status priority
      items.sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] ?? 99;
        const pb = STATUS_PRIORITY[b.status] ?? 99;
        return pa - pb;
      });
      setDeliverables(items);
      setContract(res.data?.contract || null);
    } else {
      setError(res.error?.message || 'Failed to load deliverables');
    }

    setLoading(false);
    setRefreshing(false);
  }, [campaign_influencer_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh when returning from detail screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!loading) fetchData(true);
    });
    return unsubscribe;
  }, [navigation, fetchData, loading]);

  function onRefresh() {
    setRefreshing(true);
    fetchData(true);
  }

  function getProgressSummary() {
    if (deliverables.length === 0) return null;
    const total = deliverables.length;
    const completed = deliverables.filter(d => d.status === 'live').length;
    const needsAction = deliverables.filter(d =>
      ['pending', 'revision_requested'].includes(d.status)
    ).length;
    const inReview = deliverables.filter(d =>
      ['submitted', 'under_review'].includes(d.status)
    ).length;
    const approved = deliverables.filter(d => d.status === 'approved').length;
    return { total, completed, needsAction, inReview, approved };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!campaign_influencer_id) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No campaign data</Text>
      </View>
    );
  }

  const progress = getProgressSummary();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deliverables</Text>
        <Text style={styles.headerSub}>
          {brand_name ? `${brand_name}` : ''}{brand_name && campaign_name ? ' — ' : ''}{campaign_name || ''}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        {/* Loading state */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.navy} />
            <Text style={styles.loadingText}>Loading deliverables...</Text>
          </View>
        )}

        {/* Error state */}
        {!loading && error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load deliverables</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress summary */}
        {!loading && !error && progress && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Progress Overview</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(progress.completed / progress.total) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress.completed} of {progress.total} deliverable{progress.total !== 1 ? 's' : ''} completed
            </Text>

            <View style={styles.statsRow}>
              {progress.needsAction > 0 && (
                <View style={[styles.statChip, { backgroundColor: colors.goldPale }]}>
                  <Text style={[styles.statChipText, { color: '#7A5500' }]}>
                    {progress.needsAction} needs action
                  </Text>
                </View>
              )}
              {progress.inReview > 0 && (
                <View style={[styles.statChip, { backgroundColor: colors.orangePale }]}>
                  <Text style={[styles.statChipText, { color: colors.orangeDeep }]}>
                    {progress.inReview} in review
                  </Text>
                </View>
              )}
              {progress.approved > 0 && (
                <View style={[styles.statChip, { backgroundColor: colors.tealPale }]}>
                  <Text style={[styles.statChipText, { color: colors.tealDeep }]}>
                    {progress.approved} approved
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!loading && !error && deliverables.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
            <Text style={styles.emptyTitle}>No Deliverables Yet</Text>
            <Text style={styles.emptyMessage}>
              Deliverables will appear here once the contract is signed by both parties.
            </Text>
          </View>
        )}

        {/* Deliverable list */}
        {!loading && deliverables.map((d) => {
          const overdue = ['pending', 'revision_requested'].includes(d.status) && isOverdue(d.submission_deadline);
          const needsAction = ['pending', 'revision_requested'].includes(d.status);

          return (
            <TouchableOpacity
              key={d.id}
              style={[
                styles.deliverableCard,
                needsAction && styles.deliverableCardAction,
                overdue && styles.deliverableCardOverdue,
              ]}
              onPress={() =>
                navigation.navigate('DeliverableDetail', {
                  deliverable: d,
                  campaign_name,
                  brand_name,
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.deliverableHeader}>
                <View style={styles.deliverableIconWrap}>
                  <Text style={styles.deliverableIcon}>
                    {DELIVERABLE_ICONS[d.type] || '📄'}
                  </Text>
                </View>
                <View style={styles.deliverableInfo}>
                  <Text style={styles.deliverableType}>
                    {DELIVERABLE_LABELS[d.type] || d.type}
                    {d.quantity > 1 ? ` x${d.quantity}` : ''}
                  </Text>
                  <View style={styles.deliverableMeta}>
                    {d.submission_deadline && (
                      <Text style={[styles.deliverableDeadline, overdue && styles.overdueText]}>
                        {overdue ? 'Overdue — ' : 'Due: '}{formatDate(d.submission_deadline)}
                      </Text>
                    )}
                    {d.submitted_at && (
                      <Text style={styles.deliverableSubmitted}>
                        Submitted: {formatDate(d.submitted_at)}
                      </Text>
                    )}
                  </View>
                </View>
                <StatusBadge status={d.status} size={9} />
              </View>

              {/* Big obvious per-row CTA so the influencer sees 3 distinct
                  upload entry points (one for each deliverable). Replaces
                  the older subtle "tap to..." hint that confused users into
                  thinking there was only one upload spot. */}
              {d.status === 'pending' && (
                <View style={styles.rowCta}>
                  <Text style={styles.rowCtaLabel}>Upload {DELIVERABLE_LABELS[d.type] || d.type} →</Text>
                </View>
              )}
              {d.status === 'revision_requested' && (
                <View style={[styles.rowCta, { backgroundColor: colors.redPale }]}>
                  <Text style={[styles.rowCtaLabel, { color: colors.red }]}>
                    Revision needed — tap to resubmit
                  </Text>
                </View>
              )}
              {d.status === 'approved' && !d.live_url && (
                <View style={[styles.rowCta, { backgroundColor: colors.tealPale }]}>
                  <Text style={[styles.rowCtaLabel, { color: colors.tealDeep }]}>
                    Approved — tap to submit Live URL
                  </Text>
                </View>
              )}
              {d.status === 'approved' && d.live_url && (
                <View style={[styles.rowCta, { backgroundColor: colors.navyPale }]}>
                  <Text style={[styles.rowCtaLabel, { color: colors.navy }]}>
                    Live URL submitted — awaiting brand confirmation
                  </Text>
                </View>
              )}
              {d.status === 'live' && (
                <View style={[styles.rowCta, { backgroundColor: colors.tealPale }]}>
                  <Text style={[styles.rowCtaLabel, { color: colors.tealDeep }]}>
                    ✓ Live and confirmed
                  </Text>
                </View>
              )}

              {/* Chevron */}
              <View style={styles.chevronWrap}>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  emptyText: { fontSize: 14, color: colors.t3 },

  // Header
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },

  scrollContent: { flex: 1 },

  // Loading
  loadingContainer: { alignItems: 'center', paddingTop: 60 },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },

  // Error
  errorCard: {
    margin: 16,
    backgroundColor: colors.redPale,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.red + '33',
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: colors.red, marginBottom: 6 },
  errorMessage: { fontSize: 12, color: colors.t2, textAlign: 'center', marginBottom: 14 },
  retryBtn: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.white },

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

  // Progress
  progressBar: {
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.teal,
    borderRadius: 3,
  },
  progressText: { fontSize: 12, color: colors.t2, marginBottom: 10 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statChipText: { fontSize: 10, fontWeight: '700' },

  // Empty
  emptyCard: {
    margin: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  emptyMessage: { fontSize: 12, color: colors.t3, textAlign: 'center', lineHeight: 18 },

  // Deliverable card
  deliverableCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  deliverableCardAction: {
    borderColor: colors.gold,
    borderWidth: 1.5,
  },
  deliverableCardOverdue: {
    borderColor: colors.red,
    borderWidth: 1.5,
  },
  deliverableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliverableIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverableIcon: { fontSize: 18 },
  deliverableInfo: { flex: 1 },
  deliverableType: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  deliverableMeta: { marginTop: 4 },
  deliverableDeadline: { fontSize: 11, color: colors.t3 },
  deliverableSubmitted: { fontSize: 11, color: colors.t3, marginTop: 2 },
  overdueText: { color: colors.red, fontWeight: '700' },

  // Action hints
  actionHint: {
    backgroundColor: colors.redPale,
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  actionHintText: { fontSize: 11, color: colors.red, fontWeight: '600', textAlign: 'center' },
  // Per-row CTA replacing the older subtle hint
  rowCta: {
    backgroundColor: colors.goldPale,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  rowCtaLabel: { fontSize: 12, fontWeight: '800', color: '#7A5500', textAlign: 'center' },

  // Chevron
  chevronWrap: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  chevron: { fontSize: 22, color: colors.t3, fontWeight: '300' },
});
