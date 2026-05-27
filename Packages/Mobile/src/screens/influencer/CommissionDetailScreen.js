import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtMoney, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

const TRANCHE_LABELS = {
  1: 'T1 — Contract Signed',
  2: 'T2 — Content Live',
  3: 'T3 — 30 Days Post-Live',
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTxType(type) {
  if (!type) return '-';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * CommissionDetailScreen — per-campaign earnings detail w/ tranche timeline + commission list.
 *
 * Flow 34 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/
 * JetBrains Mono fonts + StatusPill canonical for tranche status.
 * Unified success/yellow tranche timeline + ink-bordered yellow current
 * step per design call #3 (matches Flow 32/33 timeline pattern).
 */

export default function CommissionDetailScreen({ route, navigation }) {
  const { campaignInfluencerId } = route.params;
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
        <ActivityIndicator size="large" color={P.yellow} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Could not load commission details</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryBtnText}>RETRY</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { tranches, commissions, summary } = data;
  const visibleCommissions = showAllCommissions ? commissions : commissions.slice(0, 5);

  // currentTrancheIdx = the index of the first non-released tranche
  const currentTrancheIdx = (tranches || []).findIndex(t => t.status !== 'released');

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.yellow]} />}>
      {/* Hero */}
      <View style={styles.headerCard}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-left" size={14} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>{data.campaign_name}</Text>
        <Text style={styles.headerSub}>{(data.brand_name || '').toUpperCase()}</Text>

        <View style={styles.headerStatsRow}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatLabel}>EARNED</Text>
            <Text style={[styles.headerStatVal, { color: '#7DEFA0' }]}>{fmtRupees(Math.round(summary.total_earned))}</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatLabel}>PENDING</Text>
            <Text style={[styles.headerStatVal, { color: '#FFD080' }]}>{fmtRupees(Math.round(summary.total_pending))}</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatLabel}>TOTAL</Text>
            <Text style={styles.headerStatVal}>{fmtRupees(Math.round(summary.total_earned + summary.total_pending))}</Text>
          </View>
        </View>
        <View style={styles.headerAccent} />
      </View>

      {/* Info row */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>GOAL</Text>
          <Text style={styles.infoVal}>{(data.goal || '-').toUpperCase()}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>STATUS</Text>
          <Text style={styles.infoVal}>{(data.ci_status || '-').toUpperCase()}</Text>
        </View>
        {data.agreed_fee && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>FEE</Text>
            <Text style={styles.infoVal}>{fmtRupees(Math.round(data.agreed_fee))}</Text>
          </View>
        )}
      </View>

      {/* Tranche Timeline */}
      {tranches && tranches.length > 0 && (
        <>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Tranche Timeline</Text>
          </View>
          {tranches.map((t, idx) => {
            const isReleased = t.status === 'released';
            const isCurrent = idx === currentTrancheIdx && !isReleased;
            const isLast = idx === tranches.length - 1;
            return (
              <View key={t.tranche_number} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  {idx > 0 && (
                    <View style={[styles.timelineLine, isReleased && styles.timelineLineActive]} />
                  )}
                  <View
                    style={[
                      styles.timelineDot,
                      isReleased && styles.timelineDotReleased,
                      isCurrent && styles.timelineDotCurrent,
                    ]}
                  >
                    {isReleased && <Icon name="check-bold" size={9} color={P.white} />}
                    {isCurrent && <Text style={styles.timelineDotNum}>{t.tranche_number}</Text>}
                    {!isReleased && !isCurrent && <Text style={styles.timelineDotNumInactive}>{t.tranche_number}</Text>}
                  </View>
                  {!isLast && (
                    <View style={[styles.timelineLine, isReleased && styles.timelineLineActive]} />
                  )}
                </View>

                <View style={[styles.trancheCard, isReleased && styles.trancheCardReleased]}>
                  <View style={styles.trancheHeader}>
                    <Text style={styles.trancheTitle}>{TRANCHE_LABELS[t.tranche_number] || `Tranche ${t.tranche_number}`}</Text>
                    <StatusPill status={t.status} />
                  </View>
                  <Text style={styles.trancheAmount}>{fmtRupees(Math.round(t.amount))}</Text>
                  <Text style={styles.trancheDate}>
                    {isReleased ? `RELEASED ${formatDate(t.released_at).toUpperCase()}` : `LOCKED SINCE ${formatDate(t.created_at).toUpperCase()}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Follower Commissions */}
      {(data.goal === 'conversion' || data.goal === 'hybrid' || commissions.length > 0) && (
        <>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>
              Follower Commissions
              {data.commission_pct ? ` (${data.commission_pct}%)` : ''}
            </Text>
          </View>

          {commissions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No follower commissions yet</Text>
              <Text style={styles.emptySub}>Commissions from follower transactions will appear here</Text>
            </View>
          ) : (
            <>
              {/* Commission summary mini-cards */}
              <View style={styles.commSummaryRow}>
                <View style={[styles.commSummaryCard, { borderLeftColor: P.success }]}>
                  <Text style={styles.commSummaryLabel}>CONFIRMED</Text>
                  <Text style={[styles.commSummaryVal, { color: P.successText }]}>{fmtRupees(Math.round(summary.commission_confirmed))}</Text>
                </View>
                <View style={[styles.commSummaryCard, { borderLeftColor: P.yellow }]}>
                  <Text style={styles.commSummaryLabel}>PENDING (30D)</Text>
                  <Text style={[styles.commSummaryVal, { color: P.yellowText }]}>{fmtRupees(Math.round(summary.commission_pending))}</Text>
                </View>
              </View>

              {/* Transaction list */}
              {visibleCommissions.map(c => (
                <View key={c.transaction_id} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txDot, { backgroundColor: c.status === 'confirmed' ? P.success : P.yellow }]} />
                  </View>
                  <View style={styles.txContent}>
                    <View style={styles.txHeader}>
                      <Text style={styles.txType}>{formatTxType(c.transaction_type)}</Text>
                      <Text style={[styles.txAmount, c.status === 'confirmed' && { color: P.successText }]}>
                        {fmtRupees(Math.round(c.commission_amount))}
                      </Text>
                    </View>
                    <View style={styles.txFooter}>
                      <Text style={styles.txDate}>{formatDate(c.created_at).toUpperCase()}</Text>
                      {c.status === 'pending' && c.days_until_confirmed > 0 && (
                        <Text style={styles.txPendingDays}>{c.days_until_confirmed}D TO CONFIRM</Text>
                      )}
                      {c.status === 'confirmed' && (
                        <Text style={styles.txConfirmed}>CONFIRMED</Text>
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
                  <Text style={styles.showMoreText}>SHOW ALL {commissions.length} COMMISSIONS</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}

      {/* 30-day confirmation info banner */}
      {commissions.some(c => c.status === 'pending') && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerTitle}>30-DAY CONFIRMATION WINDOW</Text>
          <Text style={styles.infoBannerText}>
            Commissions from follower transactions are held for 30 days before being confirmed to your wallet balance. This protects against returns and cancellations.
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  errorText: { fontSize: 14, color: P.muted, marginBottom: 12, fontFamily: fonts.sansRegular },
  retryBtn: { backgroundColor: P.ink, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 11 },
  retryBtnText: { fontSize: 12, fontWeight: '900', color: P.yellow, letterSpacing: 0.3, fontFamily: fonts.displayBlack },

  // Hero
  headerCard: { backgroundColor: P.ink, padding: 18, paddingTop: 50, paddingBottom: 22, position: 'relative' },
  headerAccent: { position: 'absolute', left: 18, bottom: 8, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  backText: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },
  headerTitle: { fontSize: 20, fontWeight: '900', color: P.white, marginBottom: 4, letterSpacing: -0.3, fontFamily: fonts.displayBlack },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 14, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  headerStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 11, padding: 12,
  },
  headerStat: { flex: 1, alignItems: 'center' },
  headerStatLabel: {
    fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 3,
    textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '800', fontFamily: fonts.monoBold,
  },
  headerStatVal: { fontSize: 14.5, fontWeight: '900', color: P.white, fontFamily: fonts.monoBold },
  headerStatDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' },

  // Section
  sectionTitleWrap: { margin: 14, marginBottom: 8, marginTop: 14 },
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fonts.displayBold,
  },

  // Info row
  infoRow: { flexDirection: 'row', gap: 8, margin: 14, marginBottom: 0 },
  infoItem: { flex: 1, backgroundColor: P.white, borderRadius: 11, padding: 11, borderWidth: 1, borderColor: P.border },
  infoLabel: {
    fontSize: 9, color: P.muted2, marginBottom: 3,
    textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '800', fontFamily: fonts.monoBold,
  },
  infoVal: { fontSize: 12, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },

  // Timeline
  timelineItem: { flexDirection: 'row', marginHorizontal: 14 },
  timelineLeft: { width: 28, alignItems: 'center', flexDirection: 'column' },
  timelineDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: P.bg2, borderWidth: 2, borderColor: P.border,
    marginTop: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotReleased: { backgroundColor: P.success, borderColor: P.success },
  timelineDotCurrent: {
    backgroundColor: P.yellow, borderWidth: 3, borderColor: P.ink,
    width: 18, height: 18, borderRadius: 9, marginTop: 9,
  },
  timelineDotNum: { fontSize: 10, color: P.ink, fontWeight: '900', fontFamily: fonts.displayBlack },
  timelineDotNumInactive: { fontSize: 8, color: P.muted3, fontWeight: '900', fontFamily: fonts.displayBlack },
  timelineLine: { width: 2, flex: 1, backgroundColor: P.border, marginVertical: 2 },
  timelineLineActive: { backgroundColor: P.success },

  trancheCard: {
    flex: 1, backgroundColor: P.white, borderRadius: 11, padding: 13,
    marginBottom: 6, marginLeft: 6,
    borderWidth: 1, borderColor: P.border,
  },
  trancheCardReleased: { backgroundColor: '#F0FBF6', borderColor: '#A8E6CC' },
  trancheHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  trancheTitle: { fontSize: 12.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  trancheAmount: { fontSize: 17, fontWeight: '900', color: P.ink, marginBottom: 4, fontFamily: fonts.monoBold },
  trancheDate: { fontSize: 10, color: P.muted2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // Commission summary
  commSummaryRow: { flexDirection: 'row', gap: 8, marginHorizontal: 14, marginBottom: 11 },
  commSummaryCard: {
    flex: 1, backgroundColor: P.white, borderRadius: 11, padding: 11,
    borderLeftWidth: 3, borderWidth: 1, borderColor: P.border,
  },
  commSummaryLabel: {
    fontSize: 9.5, color: P.muted2, marginBottom: 3,
    textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '800', fontFamily: fonts.monoBold,
  },
  commSummaryVal: { fontSize: 14.5, fontWeight: '900', fontFamily: fonts.monoBold },

  // Transaction list
  txRow: { flexDirection: 'row', marginHorizontal: 14 },
  txLeft: { width: 18, alignItems: 'center', paddingTop: 14, flexDirection: 'column' },
  txDot: { width: 6, height: 6, borderRadius: 3 },
  txContent: {
    flex: 1, backgroundColor: P.white, borderRadius: 10, padding: 11,
    marginBottom: 5, borderWidth: 1, borderColor: P.border,
  },
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  txType: { fontSize: 12, fontWeight: '700', color: P.ink, fontFamily: fonts.displayBold },
  txAmount: { fontSize: 13, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  txFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txDate: { fontSize: 10, color: P.muted2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  txPendingDays: { fontSize: 9.5, fontWeight: '800', color: P.yellowText, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold },
  txConfirmed: { fontSize: 9.5, fontWeight: '800', color: P.successText, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold },

  // Show more
  showMoreBtn: {
    alignItems: 'center', paddingVertical: 12,
    backgroundColor: P.white, borderRadius: 11,
    borderWidth: 1, borderColor: P.border, marginHorizontal: 14, marginTop: 4,
  },
  showMoreText: { fontSize: 12, fontWeight: '900', color: P.ink, letterSpacing: 0.3, fontFamily: fonts.displayBlack },

  // Empty state
  emptyCard: {
    backgroundColor: P.white, borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: P.border,
    marginHorizontal: 14,
  },
  emptyText: { fontSize: 13.5, fontWeight: '800', color: P.muted, marginBottom: 4, fontFamily: fonts.displayBold },
  emptySub: { fontSize: 11.5, color: P.muted2, textAlign: 'center', fontFamily: fonts.sansRegular },

  // Info card — 30-day window
  infoBanner: {
    backgroundColor: P.infoPale, borderRadius: 11, padding: 12,
    marginHorizontal: 14, marginTop: 14,
    borderWidth: 1, borderColor: '#BFD9F2',
  },
  infoBannerTitle: { fontSize: 12.5, fontWeight: '900', color: P.info, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBlack },
  infoBannerText: { fontSize: 11.5, color: P.ink, lineHeight: 17, fontFamily: fonts.sansRegular },
});
