import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

const TRANCHE_LABELS = {
  1: 'T1 — Contract Signed',
  2: 'T2 — Content Live',
  3: 'T3 — 30 Days Post-Live',
};

const STATUS_COLORS = {
  released: colors.teal,
  locked: colors.orange,
  pending: colors.orange,
  confirmed: colors.teal,
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTxType(type) {
  if (!type) return '-';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function CommissionDetailScreen({ route, navigation }) {
  const { campaignInfluencerId, campaignName } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllCommissions, setShowAllCommissions] = useState(false);

  async function load() {
    const res = await influencerApi.getCampaignCommissionDetail(campaignInfluencerId);
    setLoading(false);
    if (res.success) setData(res.data);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Could not load commission details</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { tranches, commissions, summary } = data;
  const visibleCommissions = showAllCommissions ? commissions : commissions.slice(0, 5);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Header */}
      <View style={styles.headerCard}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>{data.campaign_name}</Text>
        <Text style={styles.headerSub}>{data.brand_name}</Text>

        <View style={styles.headerStatsRow}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatLabel}>Earned</Text>
            <Text style={[styles.headerStatVal, { color: '#7DEFA0' }]}>{fmtRupees(Math.round(summary.total_earned))}</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatLabel}>Pending</Text>
            <Text style={[styles.headerStatVal, { color: '#FFD080' }]}>{fmtRupees(Math.round(summary.total_pending))}</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatLabel}>Total</Text>
            <Text style={styles.headerStatVal}>{fmtRupees(Math.round(summary.total_earned + summary.total_pending))}</Text>
          </View>
        </View>
      </View>

      {/* Campaign Info */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Goal</Text>
            <Text style={styles.infoVal}>{(data.goal || '-').replace(/^\w/, c => c.toUpperCase())}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoVal}>{(data.ci_status || '-').replace(/^\w/, c => c.toUpperCase())}</Text>
          </View>
          {data.agreed_fee && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Agreed Fee</Text>
              <Text style={styles.infoVal}>{fmtRupees(Math.round(data.agreed_fee))}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Tranche Timeline */}
      {tranches.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tranche Timeline</Text>
          {tranches.map((t, idx) => {
            const isReleased = t.status === 'released';
            const isLast = idx === tranches.length - 1;
            return (
              <View key={t.tranche_number} style={styles.timelineItem}>
                {/* Timeline connector */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, isReleased && styles.timelineDotActive]} />
                  {!isLast && <View style={[styles.timelineLine, isReleased && styles.timelineLineActive]} />}
                </View>

                {/* Content */}
                <View style={[styles.trancheCard, isReleased && styles.trancheCardReleased]}>
                  <View style={styles.trancheHeader}>
                    <Text style={styles.trancheTitle}>{TRANCHE_LABELS[t.tranche_number] || `Tranche ${t.tranche_number}`}</Text>
                    <View style={[styles.trancheStatusBadge, { backgroundColor: isReleased ? colors.tealPale : colors.orangePale }]}>
                      <Text style={[styles.trancheStatusText, { color: isReleased ? colors.tealDeep : colors.orangeDeep }]}>
                        {isReleased ? 'Released' : 'Locked'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.trancheAmount}>{fmtRupees(Math.round(t.amount))}</Text>
                  <Text style={styles.trancheDate}>
                    {isReleased ? `Released ${formatDate(t.released_at)}` : `Locked since ${formatDate(t.created_at)}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Follower Commissions */}
      {(data.goal === 'conversion' || data.goal === 'hybrid' || commissions.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Follower Commissions
            {data.commission_pct ? ` (${data.commission_pct}%)` : ''}
          </Text>

          {commissions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No follower commissions yet</Text>
              <Text style={styles.emptySub}>Commissions from follower transactions will appear here</Text>
            </View>
          ) : (
            <>
              {/* Commission summary mini-cards */}
              <View style={styles.commSummaryRow}>
                <View style={[styles.commSummaryCard, { borderLeftColor: colors.teal }]}>
                  <Text style={styles.commSummaryLabel}>Confirmed</Text>
                  <Text style={[styles.commSummaryVal, { color: colors.teal }]}>{fmtRupees(Math.round(summary.commission_confirmed))}</Text>
                </View>
                <View style={[styles.commSummaryCard, { borderLeftColor: colors.orange }]}>
                  <Text style={styles.commSummaryLabel}>Pending (30d)</Text>
                  <Text style={[styles.commSummaryVal, { color: colors.orange }]}>{fmtRupees(Math.round(summary.commission_pending))}</Text>
                </View>
              </View>

              {/* Transaction list */}
              {visibleCommissions.map(c => (
                <View key={c.transaction_id} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txDot, { backgroundColor: c.status === 'confirmed' ? colors.teal : colors.orange }]} />
                  </View>
                  <View style={styles.txContent}>
                    <View style={styles.txHeader}>
                      <Text style={styles.txType}>{formatTxType(c.transaction_type)}</Text>
                      <Text style={[styles.txAmount, { color: c.status === 'confirmed' ? colors.teal : colors.t1 }]}>
                        {fmtRupees(Math.round(c.commission_amount))}
                      </Text>
                    </View>
                    <View style={styles.txFooter}>
                      <Text style={styles.txDate}>{formatDate(c.created_at)}</Text>
                      {c.status === 'pending' && c.days_until_confirmed > 0 && (
                        <Text style={styles.txPendingDays}>{c.days_until_confirmed}d to confirm</Text>
                      )}
                      {c.status === 'confirmed' && (
                        <Text style={styles.txConfirmed}>Confirmed</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}

              {commissions.length > 5 && !showAllCommissions && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => setShowAllCommissions(true)}
                >
                  <Text style={styles.showMoreText}>Show all {commissions.length} commissions</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Confirmation info */}
      {commissions.some(c => c.status === 'pending') && (
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>30-Day Confirmation Window</Text>
            <Text style={styles.infoCardText}>
              Commissions from follower transactions are held for 30 days before being confirmed to your wallet balance. This protects against returns and cancellations.
            </Text>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  errorText: { fontSize: 14, color: colors.t2, marginBottom: 12 },
  retryBtn: { backgroundColor: colors.navy, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Header
  headerCard: { backgroundColor: colors.navy, padding: 20, paddingTop: 52 },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.white, marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 16 },
  headerStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 },
  headerStat: { flex: 1, alignItems: 'center' },
  headerStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  headerStatVal: { fontSize: 15, fontWeight: '800', color: colors.white },
  headerStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.12)' },

  // Info row
  section: { margin: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.t2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: 'row', gap: 10 },
  infoItem: { flex: 1, backgroundColor: colors.white, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border },
  infoLabel: { fontSize: 10, color: colors.t3, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoVal: { fontSize: 13, fontWeight: '700', color: colors.t1 },

  // Timeline
  timelineItem: { flexDirection: 'row', marginBottom: 0 },
  timelineLeft: { width: 28, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border2, borderWidth: 2, borderColor: colors.border, marginTop: 14 },
  timelineDotActive: { backgroundColor: colors.teal, borderColor: colors.tealPale },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  timelineLineActive: { backgroundColor: colors.tealPale },

  trancheCard: { flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 8, marginLeft: 4, borderWidth: 1, borderColor: colors.border },
  trancheCardReleased: { borderColor: colors.tealPale, backgroundColor: colors.tealPale + '30' },
  trancheHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  trancheTitle: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  trancheStatusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  trancheStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  trancheAmount: { fontSize: 18, fontWeight: '800', color: colors.t1, marginBottom: 4 },
  trancheDate: { fontSize: 11, color: colors.t3 },

  // Commission summary
  commSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  commSummaryCard: { flex: 1, backgroundColor: colors.white, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border },
  commSummaryLabel: { fontSize: 10, color: colors.t3, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  commSummaryVal: { fontSize: 15, fontWeight: '800' },

  // Transaction list
  txRow: { flexDirection: 'row', marginBottom: 2 },
  txLeft: { width: 20, alignItems: 'center', paddingTop: 14 },
  txDot: { width: 6, height: 6, borderRadius: 3 },
  txContent: { flex: 1, backgroundColor: colors.white, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  txType: { fontSize: 13, fontWeight: '600', color: colors.t1 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txDate: { fontSize: 11, color: colors.t3 },
  txPendingDays: { fontSize: 10, fontWeight: '600', color: colors.orange },
  txConfirmed: { fontSize: 10, fontWeight: '600', color: colors.teal },

  // Show more
  showMoreBtn: { alignItems: 'center', paddingVertical: 12, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
  showMoreText: { fontSize: 13, fontWeight: '600', color: colors.navy },

  // Empty state
  emptyCard: { backgroundColor: colors.white, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.t2, marginBottom: 4 },
  emptySub: { fontSize: 12, color: colors.t3, textAlign: 'center' },

  // Info card
  infoCard: { backgroundColor: colors.navyPale, borderRadius: 12, padding: 16 },
  infoCardTitle: { fontSize: 13, fontWeight: '700', color: colors.navy, marginBottom: 6 },
  infoCardText: { fontSize: 12, color: colors.t2, lineHeight: 18 },
});
