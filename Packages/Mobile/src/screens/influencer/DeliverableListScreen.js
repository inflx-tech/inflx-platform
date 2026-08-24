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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

// Type-icon emojis preserved per locked design call #4 (KEEP type emoji
// like CATEGORY_EMOJI; DROP action emoji like 🎉/📁/📹).
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

/**
 * DeliverableListScreen — per-campaign deliverable list.
 *
 * Flow 33 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/
 * JetBrains Mono fonts + StatusPill canonical map (replaces ad-hoc
 * StatusBadge). Ink progress fill (matches Flow 31/32 pattern).
 * 5 per-row CTA tints (warn/danger/info/success-pre/success-post-live).
 * DELIVERABLE_ICONS type emojis preserved verbatim per design call #4.
 */

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-left" size={14} color={P.muted2} />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deliverables</Text>
        <Text style={styles.headerSub}>
          {brand_name ? `${brand_name}` : ''}{brand_name && campaign_name ? ' — ' : ''}{campaign_name || ''}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.ink]} />}
      >
        {/* Loading state */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={P.ink} />
            <Text style={styles.loadingText}>Loading deliverables…</Text>
          </View>
        )}

        {/* Error state */}
        {!loading && error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load deliverables</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
              <Text style={styles.retryText}>RETRY</Text>
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
              <Text style={styles.progressTextBold}>{progress.completed}</Text> of <Text style={styles.progressTextBold}>{progress.total}</Text> deliverable{progress.total !== 1 ? 's' : ''} completed
            </Text>

            <View style={styles.statsRow}>
              {progress.needsAction > 0 && (
                <View style={[styles.statChip, { backgroundColor: P.bg2 }]}>
                  <Text style={[styles.statChipText, { color: P.ink }]}>
                    {progress.needsAction} NEEDS ACTION
                  </Text>
                </View>
              )}
              {progress.inReview > 0 && (
                <View style={[styles.statChip, { backgroundColor: P.infoPale }]}>
                  <Text style={[styles.statChipText, { color: P.info }]}>
                    {progress.inReview} IN REVIEW
                  </Text>
                </View>
              )}
              {progress.approved > 0 && (
                <View style={[styles.statChip, { backgroundColor: P.successPale }]}>
                  <Text style={[styles.statChipText, { color: P.successText }]}>
                    {progress.approved} APPROVED
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

          // Determine row CTA per status (5 branches)
          let rowCta = null;
          if (d.status === 'pending') {
            rowCta = { tone: 'warn', text: `UPLOAD ${(DELIVERABLE_LABELS[d.type] || d.type || '').toUpperCase()} →` };
          } else if (d.status === 'revision_requested') {
            rowCta = { tone: 'danger', text: 'REVISION NEEDED — TAP TO RESUBMIT' };
          } else if (d.status === 'submitted' || d.status === 'under_review') {
            rowCta = { tone: 'info', text: 'UNDER BRAND REVIEW — WAITING' };
          } else if (d.status === 'approved' && !d.live_url) {
            rowCta = { tone: 'success', text: 'APPROVED — TAP TO SUBMIT LIVE URL' };
          } else if (d.status === 'approved' && d.live_url) {
            rowCta = { tone: 'info', text: 'LIVE URL SUBMITTED — AWAITING BRAND' };
          } else if (d.status === 'live') {
            rowCta = { tone: 'success', text: 'LIVE AND CONFIRMED' };
          }

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
                        {overdue ? 'OVERDUE — ' : 'DUE: '}{formatDate(d.submission_deadline).toUpperCase()}
                      </Text>
                    )}
                    {d.submitted_at && (
                      <Text style={styles.deliverableSubmitted}>
                        SUBMITTED: {formatDate(d.submitted_at).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                  <StatusPill status={d.status} />
                </View>
              </View>

              {/* Per-row CTA */}
              {rowCta && (
                <View style={[styles.rowCta, ctaStyles[rowCta.tone].bg]}>
                  <Text style={[styles.rowCtaLabel, ctaStyles[rowCta.tone].fg]}>
                    {rowCta.text}
                  </Text>
                </View>
              )}

              {/* Chevron */}
              <View style={styles.chevronWrap}>
                <Icon name="chevron-right" size={16} color={P.muted3} />
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// CTA tone palette
const ctaStyles = {
  warn:    { bg: { backgroundColor: P.warnPale  }, fg: { color: P.warnText  } },
  danger:  { bg: { backgroundColor: P.dangerPale  }, fg: { color: P.dangerText  } },
  info:    { bg: { backgroundColor: P.infoPale    }, fg: { color: P.info        } },
  success: { bg: { backgroundColor: P.successPale }, fg: { color: P.successText } },
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  emptyText: { fontSize: 14, color: P.muted2, fontFamily: fonts.sansRegular },

  // Header
  header: { backgroundColor: P.white, padding: 18, paddingTop: 50, paddingBottom: 22, position: 'relative', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  backText: { fontSize: 10, color: P.muted2, fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },
  headerTitle: { fontSize: 20, fontWeight: '900', color: P.ink, letterSpacing: -0.3, fontFamily: fonts.displayBlack },
  headerSub: { fontSize: 11, color: P.muted2, marginTop: 3, fontWeight: '700', fontFamily: fonts.monoMedium },

  scrollContent: { flex: 1 },

  // Loading
  loadingContainer: { alignItems: 'center', paddingTop: 60 },
  loadingText: { fontSize: 12, color: P.muted2, marginTop: 12, fontFamily: fonts.sansRegular },

  // Error
  errorCard: {
    margin: 14,
    backgroundColor: P.dangerPale,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: P.danger,
  },
  errorTitle: { fontSize: 14, fontWeight: '800', color: P.dangerText, marginBottom: 6, fontFamily: fonts.displayBold },
  errorMessage: { fontSize: 12, color: P.muted, textAlign: 'center', marginBottom: 14, fontFamily: fonts.sansRegular },
  retryBtn: {
    backgroundColor: P.ink,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { fontSize: 12, fontWeight: '900', color: P.white, letterSpacing: 0.3, fontFamily: fonts.displayBlack },

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
  cardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: P.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 11,
    fontFamily: fonts.displayBlack,
  },

  // Progress
  progressBar: {
    height: 7,
    backgroundColor: P.bg2,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: P.ink,
    borderRadius: 4,
  },
  progressText: { fontSize: 11, color: P.muted, marginBottom: 11, fontWeight: '700', fontFamily: fonts.monoMedium },
  progressTextBold: { color: P.ink, fontWeight: '900', fontFamily: fonts.monoBold },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statChipText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.monoBold },

  // Empty
  emptyCard: {
    margin: 14,
    backgroundColor: P.white,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: P.border,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 6, fontFamily: fonts.displayBold },
  emptyMessage: { fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17, fontFamily: fonts.sansRegular },

  // Deliverable card
  deliverableCard: {
    margin: 14,
    marginBottom: 0,
    backgroundColor: P.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: P.border,
    position: 'relative',
  },
  deliverableCardAction: {
    borderColor: P.ink,
    borderWidth: 1.5,
  },
  deliverableCardOverdue: {
    borderColor: P.danger,
    borderWidth: 1.5,
  },
  deliverableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  deliverableIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: P.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverableIcon: { fontSize: 20 },
  deliverableInfo: { flex: 1 },
  deliverableType: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  deliverableMeta: { marginTop: 3 },
  deliverableDeadline: { fontSize: 10, color: P.muted2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  deliverableSubmitted: { fontSize: 10, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  overdueText: { color: P.dangerText, fontWeight: '900', fontFamily: fonts.monoBold },

  // Per-row CTA
  rowCta: {
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 9,
  },
  rowCtaLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2, fontFamily: fonts.monoBold },

  // Chevron
  chevronWrap: {
    position: 'absolute',
    right: 14,
    top: 18,
  },
});
