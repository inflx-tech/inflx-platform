import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { openWebDashboard } from '../../utils/openWebDashboard';
import Logo from '../../components/Logo';

// ── locked palette (inline; consolidation deferred to a future token contract) ──
const P = {
  bg:           '#FAFAFA',
  surface:      '#FFFFFF',
  surface2:     '#F4F4F5',
  ink:          '#0A0A0A',
  ink2:         '#1F1F22',
  muted:        '#52525B',
  muted2:       '#71717A',
  muted3:       '#A1A1AA',
  border:       '#E4E4E7',
  border2:      '#D4D4D8',
  yellow:       '#FFC107',
  yellowHover:  '#E0A800',
  yellowPale:   '#FFF7CC',
  yellow50:     '#FFFDEB',
  yellowText:   '#6B5A00',
  success:      '#10B981',
  successPale:  '#D1FAE5',
  successDeep:  '#047857',
  danger:       '#E8401A',
  dangerPale:   '#FDEEE9',
  dangerDeep:  '#B91C1C',
  white:        '#FFFFFF',
};

const STATUS_BADGE = {
  draft:          { bg: P.surface2,   text: P.muted,        dot: P.muted2 },
  pending_wallet: { bg: P.yellowPale, text: P.yellowText,   dot: P.yellowHover },
  published:      { bg: P.yellowPale, text: P.yellowText,   dot: P.yellowHover },
  active:         { bg: P.successPale,text: P.successDeep,  dot: P.success },
  live:           { bg: P.successPale,text: P.successDeep,  dot: P.success },
  completed:      { bg: P.surface2,   text: P.ink2,         dot: P.muted2 },
  cancelled:      { bg: P.dangerPale, text: P.dangerDeep,   dot: P.danger },
};

const STATUS_LABEL = {
  draft: 'Draft', pending_wallet: 'Needs funding', published: 'Published',
  active: 'Active', live: 'Live', completed: 'Completed', cancelled: 'Cancelled',
};

const QUICK_ACTIONS = [
  { label: 'Orders',        icon: '🧾', target: 'BrandOrders' },
  { label: 'Bookings',      icon: '📅', target: 'BrandBookings' },
  { label: 'Offers',        icon: '🏷', target: 'BrandOffersLibrary' },
  { label: 'Campaigns',     icon: '⊟', target: 'Campaigns' },
  { label: 'Wallet',        icon: '◫', target: 'Wallet' },
  { label: 'Enquiries',     icon: '✉',  target: 'BrandEnquiries' },
  { label: 'Conversions',   icon: '₹',  target: 'BrandConversions' },
  { label: 'Influencers',   icon: '★',  target: 'BrandInfluencerBrowse' },
  { label: 'Creator market',icon: '📊', target: 'BrandInfluencerAnalytics' },
  { label: 'Plan & billing',icon: '⚙',  target: 'BrandSettingsHub', tab: 'Profile' },
  { label: 'Negotiations',  icon: '🤝', target: 'Campaigns' },
];

export default function BrandHomeScreen({ navigation }) {
  const [brand, setBrand]               = useState(null);
  const [campaigns, setCampaigns]       = useState([]);
  const [inboxSummary, setInboxSummary] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  async function load() {
    const [brandRes, campRes, inboxRes] = await Promise.all([
      brandApi.getMe(),
      brandApi.getCampaigns(),
      brandApi.getInboxSummary().catch(() => null),
    ]);
    setLoading(false);
    if (brandRes.success) setBrand(brandRes.data?.brand || brandRes.data);
    if (campRes.success)  setCampaigns(campRes.data?.campaigns || []);
    if (inboxRes?.success) setInboxSummary(inboxRes.data?.summary || inboxRes.data);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  const activeCampaigns = campaigns.filter(c => ['active', 'live'].includes(c.status));
  const pendingWallet   = campaigns.filter(c => c.status === 'pending_wallet');

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={P.ink} /></View>;
  }

  // Status banner derivation
  const s = brand?.user_status || brand?.status;
  const banner = (s === 'pending' || s === 'rejected' || s === 'suspended')
    ? (() => {
        const isRejected  = s === 'rejected';
        const isSuspended = s === 'suspended';
        return {
          tone: isRejected || isSuspended ? 'danger' : 'pending',
          title: isRejected ? 'Account not approved'
            : isSuspended ? 'Account suspended'
            : 'Account under review',
          body: isRejected
            ? (brand?.rejection_reason ? `Reason: ${brand.rejection_reason}` : 'Please contact support.')
            : isSuspended
              ? 'Your account is temporarily suspended. Contact support to restore access.'
              : 'An admin will approve your account soon — usually within 24 hours.',
        };
      })()
    : null;

  // Action Required total
  let inboxTotal = 0;
  let inboxParts = [];
  if (inboxSummary) {
    inboxTotal =
      (inboxSummary.pending_applications || 0) +
      (inboxSummary.pending_negotiations || 0) +
      (inboxSummary.pending_reviews || 0) +
      (inboxSummary.pending_signatures || 0) +
      (inboxSummary.contracts_failed || 0) +
      (inboxSummary.pdf_failed || 0);
    if (inboxSummary.pending_applications) inboxParts.push(`${inboxSummary.pending_applications} application${inboxSummary.pending_applications !== 1 ? 's' : ''}`);
    if (inboxSummary.pending_negotiations) inboxParts.push(`${inboxSummary.pending_negotiations} negotiation${inboxSummary.pending_negotiations !== 1 ? 's' : ''}`);
    if (inboxSummary.pending_reviews)      inboxParts.push(`${inboxSummary.pending_reviews} review${inboxSummary.pending_reviews !== 1 ? 's' : ''}`);
    if (inboxSummary.pending_signatures)   inboxParts.push(`${inboxSummary.pending_signatures} contract${inboxSummary.pending_signatures !== 1 ? 's' : ''}`);
    const failures = (inboxSummary.contracts_failed || 0) + (inboxSummary.pdf_failed || 0);
    if (failures) inboxParts.push(`${failures} failure${failures !== 1 ? 's' : ''}`);
  }

  return (
    <View style={styles.container}>
      {/* ── Ink app header ── */}
      <View style={styles.header}>
        <Logo tone="light" size="sm" />
        <Text style={styles.headerBrand} numberOfLines={1}>
          {brand?.business_name || brand?.brand_name || 'Brand workspace'}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
      >

        {/* Status banner (pending / rejected / suspended) */}
        {banner && (
          <TouchableOpacity
            style={[styles.banner, banner.tone === 'danger' ? styles.bannerDanger : styles.bannerPending]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Profile', { screen: 'BrandProfile' })}
          >
            <View style={[styles.bannerIcon, banner.tone === 'danger' ? styles.bannerIconDanger : styles.bannerIconPending]}>
              <Text style={[styles.bannerIconGlyph, banner.tone === 'danger' ? { color: P.white } : { color: P.yellow }]}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text style={styles.bannerBody}>{banner.body}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Wallet card — yellow-pale gradient + corner accent + ink Top-up ── */}
        <View style={styles.walletCard}>
          <View style={styles.walletCornerLarge} pointerEvents="none" />
          <View style={styles.walletCornerSmall} pointerEvents="none" />
          <Text style={styles.walletLabel}>Wallet balance</Text>
          <Text style={styles.walletAmount}>{fmtRupees(brand?.wallet_balance || 0)}</Text>
          <View style={styles.walletStats}>
            <View style={styles.walletStat}>
              <Text style={styles.walletStatLabel}>Active campaigns</Text>
              <Text style={styles.walletStatVal}>{activeCampaigns.length}</Text>
            </View>
            <View style={[styles.walletStat, styles.walletStatDivided]}>
              <Text style={styles.walletStatLabel}>Total campaigns</Text>
              <Text style={styles.walletStatVal}>{campaigns.length}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.topupBtn} onPress={() => navigation.navigate('Wallet')}>
            <Text style={styles.topupBtnText}>+  Top up wallet</Text>
          </TouchableOpacity>
        </View>

        {/* Action Required (white card with yellow left-stripe + yellow-pale icon-circle) */}
        {inboxSummary && inboxTotal > 0 && (
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('BrandActionRequired')}
          >
            <View style={styles.actionCardStripe} />
            <View style={styles.actionCardIcon}>
              <Text style={styles.actionCardIconGlyph}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.actionCardTitleRow}>
                <Text style={styles.actionCardTitle}>Action required</Text>
                <View style={styles.actionCardCount}>
                  <Text style={styles.actionCardCountText}>{inboxTotal}</Text>
                </View>
              </View>
              <Text style={styles.actionCardBody} numberOfLines={1}>{inboxParts.join(' · ')}</Text>
            </View>
            <Text style={styles.actionCardArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Wallet top-up alert (when ≥1 pending_wallet campaign) */}
        {pendingWallet.length > 0 && (
          <TouchableOpacity
            style={styles.walletAlert}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Text style={styles.walletAlertTitle}>
              {pendingWallet.length} campaign{pendingWallet.length > 1 ? 's' : ''} waiting on wallet top-up
            </Text>
            <Text style={styles.walletAlertBody}>
              Top up to release funds and publish{pendingWallet.length > 1 ? ' them' : ' it'} to influencers.
            </Text>
            <Text style={styles.walletAlertCta}>Top up now →</Text>
          </TouchableOpacity>
        )}

        {/* Open Web Dashboard */}
        <TouchableOpacity style={styles.webCta} onPress={() => openWebDashboard('/dashboard')}>
          <Text style={styles.webCtaIcon}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.webCtaTitle}>Open web dashboard</Text>
            <Text style={styles.webCtaSub}>Full campaign management + analytics</Text>
          </View>
          <Text style={styles.webCtaArrow}>›</Text>
        </TouchableOpacity>

        {/* Quick Actions (6 tiles, 2 columns, yellow icon-in-circle) */}
        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <View style={styles.sectionTitlePill} />
            <Text style={styles.sectionTitle}>Quick actions</Text>
          </View>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS
              .map(qa => (
              <TouchableOpacity
                key={qa.label}
                style={styles.quickTile}
                activeOpacity={0.8}
                onPress={() => qa.tab
                  ? navigation.navigate(qa.tab, { screen: qa.target })
                  : navigation.navigate(qa.target)}
              >
                <View style={styles.quickIcon}>
                  <Text style={styles.quickIconGlyph}>{qa.icon}</Text>
                </View>
                <Text style={styles.quickLabel}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Campaigns top-5 */}
        <View style={styles.section}>
          <View style={styles.sectionHeadRowSpread}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={styles.sectionTitlePill} />
              <Text style={styles.sectionTitle}>Campaigns</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Campaigns')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>

          {campaigns.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><Text style={styles.emptyIconGlyph}>·</Text></View>
              <Text style={styles.emptyText}>No campaigns yet</Text>
              <Text style={styles.emptySubText}>Create campaigns from the web dashboard</Text>
            </View>
          ) : (
            campaigns.slice(0, 5).map(c => {
              const badge = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
              const label = STATUS_LABEL[c.status] || c.status;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={styles.campaignCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Campaigns', { screen: 'CampaignDetail', params: { campaignId: c.id } })}
                >
                  <View style={styles.campaignRow1}>
                    <Text style={styles.campaignName} numberOfLines={1}>{c.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: badge.dot }]} />
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>{label}</Text>
                    </View>
                  </View>
                  {(c.total_budget > 0) && (
                    <Text style={styles.campaignBudget}>
                      <Text style={styles.campaignBudgetV}>{fmtRupees(c.total_budget)}</Text> budget
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },

  // Ink header
  header: {
    backgroundColor: P.ink,
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerBrand: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
    textAlign: 'right',
  },

  scroll: { padding: 14, gap: 12 },

  // Status banner
  banner: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 0,
  },
  bannerPending: { backgroundColor: P.yellowPale, borderColor: 'rgba(255,193,7,0.45)' },
  bannerDanger:  { backgroundColor: P.dangerPale, borderColor: 'rgba(232,64,26,0.25)' },
  bannerIcon: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  bannerIconPending: { backgroundColor: P.ink },
  bannerIconDanger:  { backgroundColor: P.danger },
  bannerIconGlyph: { fontSize: 13, fontWeight: '800' },
  bannerTitle: { fontSize: 12.5, fontWeight: '700', color: P.ink, marginBottom: 2 },
  bannerBody:  { fontSize: 11.5, color: P.ink2, lineHeight: 16 },

  // Wallet card — yellow-pale gradient with corner accent
  walletCard: {
    backgroundColor: P.yellow50,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.32)',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 4,
  },
  walletCornerLarge: {
    position: 'absolute',
    top: -36, right: -36,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: P.yellow,
    opacity: 0.28,
  },
  walletCornerSmall: {
    position: 'absolute',
    top: -12, right: 30,
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: P.yellow,
    opacity: 0.16,
  },
  walletLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: P.yellowText,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  walletAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: P.ink,
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  walletStats: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  walletStat:  { flex: 1 },
  walletStatDivided: { paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: 'rgba(10,10,10,0.12)' },
  walletStatLabel: { fontSize: 9.5, fontWeight: '600', color: P.muted, marginBottom: 2, letterSpacing: 0.2 },
  walletStatVal:   { fontSize: 18, fontWeight: '700', color: P.ink, letterSpacing: -0.2 },
  topupBtn: {
    backgroundColor: P.ink,
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: 'center',
  },
  topupBtnText: { fontSize: 12.5, fontWeight: '700', color: P.yellow, letterSpacing: 0.2 },

  // Action Required card
  actionCard: {
    backgroundColor: P.surface,
    borderRadius: 14,
    padding: 13,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    position: 'relative',
    overflow: 'hidden',
  },
  actionCardStripe: {
    position: 'absolute',
    top: 0, left: 0,
    width: 3, height: '100%',
    backgroundColor: P.yellow,
  },
  actionCardIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: P.yellowPale,
    alignItems: 'center', justifyContent: 'center',
  },
  actionCardIconGlyph: { fontSize: 16, fontWeight: '800', color: P.ink },
  actionCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  actionCardTitle: { fontSize: 12.5, fontWeight: '700', color: P.ink },
  actionCardCount: {
    backgroundColor: P.yellow,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 100,
  },
  actionCardCountText: { fontSize: 10.5, fontWeight: '700', color: P.ink },
  actionCardBody: { fontSize: 11, color: P.muted },
  actionCardArrow: { fontSize: 18, color: P.muted2, fontWeight: '700' },

  // Wallet alert (yellow-pale)
  walletAlert: {
    backgroundColor: P.yellowPale,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)',
    borderLeftWidth: 3, borderLeftColor: P.yellow,
  },
  walletAlertTitle: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 2 },
  walletAlertBody:  { fontSize: 11, color: P.ink2, lineHeight: 15, marginBottom: 4 },
  walletAlertCta:   { fontSize: 11.5, color: P.yellowHover, fontWeight: '700' },

  // Web Dashboard CTA
  webCta: {
    backgroundColor: P.surface,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1, borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webCtaIcon: { fontSize: 18 },
  webCtaTitle: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 1 },
  webCtaSub:   { fontSize: 10.5, color: P.muted2 },
  webCtaArrow: { fontSize: 18, color: P.muted2, fontWeight: '700' },

  // Section heads
  section: { marginTop: 4 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  sectionHeadRowSpread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitlePill: { width: 3, height: 13, backgroundColor: P.yellow, borderRadius: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: P.ink },
  seeAll: { fontSize: 11.5, fontWeight: '700', color: P.ink },

  // Quick Actions grid
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTile: {
    width: '48%',
    backgroundColor: P.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1, borderColor: P.border,
    flexDirection: 'column',
    gap: 6,
  },
  quickIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: P.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  quickIconGlyph: { fontSize: 14, fontWeight: '700', color: P.ink },
  quickLabel: { fontSize: 11, fontWeight: '600', color: P.ink, textAlign: 'center' },

  // Campaign cards (Home — compact)
  campaignCard: {
    backgroundColor: P.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1, borderColor: P.border,
    marginBottom: 8,
  },
  campaignRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  campaignName: { fontSize: 13.5, fontWeight: '700', color: P.ink, flex: 1, letterSpacing: 0.1 },
  campaignBudget: { fontSize: 10.5, color: P.muted2, marginTop: 4 },
  campaignBudgetV: { color: P.ink, fontWeight: '600' },

  // Status badges
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 100,
    flexShrink: 0,
  },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusBadgeText: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Empty
  emptyCard: {
    backgroundColor: P.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1, borderColor: P.border,
  },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: P.surface2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  emptyIconGlyph: { fontSize: 22, fontWeight: '700', color: P.muted2 },
  emptyText: { fontSize: 14, fontWeight: '700', color: P.ink, marginBottom: 4 },
  emptySubText: { fontSize: 11, color: P.muted, textAlign: 'center' },
});
