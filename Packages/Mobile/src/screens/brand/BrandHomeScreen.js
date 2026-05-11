import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { openWebDashboard } from '../../utils/openWebDashboard';

export default function BrandHomeScreen({ navigation }) {
  const [brand, setBrand]       = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [inboxSummary, setInboxSummary] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [brandRes, campRes, inboxRes] = await Promise.all([
      brandApi.getMe(),
      brandApi.getCampaigns(),
      brandApi.getInboxSummary().catch(() => null),
    ]);
    setLoading(false);
    if (brandRes.success) setBrand(brandRes.data?.brand || brandRes.data);
    if (campRes.success) setCampaigns(campRes.data?.campaigns || []);
    if (inboxRes?.success) setInboxSummary(inboxRes.data?.summary || inboxRes.data);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  const activeCampaigns = campaigns.filter(c => ['active', 'live'].includes(c.status));
  const pendingWallet   = campaigns.filter(c => c.status === 'pending_wallet');

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  const STATUS_COLORS = {
    draft: colors.t3, pending_wallet: colors.orange,
    published: '#3B82F6', active: colors.teal, live: colors.teal,
    completed: colors.navy, cancelled: colors.red,
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          INFL<Text style={{ color: colors.orange }}>X</Text>
        </Text>
        <Text style={styles.headerBrand}>{brand?.business_name || brand?.brand_name || 'Dashboard'}</Text>
      </View>

      {/* Account status banner — shown until brand is approved */}
      {(() => {
        const s = brand?.user_status || brand?.status;
        if (s !== 'pending' && s !== 'rejected' && s !== 'suspended') return null;
        const isRejected = s === 'rejected';
        const isSuspended = s === 'suspended';
        const title = isRejected ? 'Account not approved'
          : isSuspended ? 'Account suspended'
          : 'Account pending review';
        const body = isRejected
          ? (brand?.rejection_reason ? `Reason: ${brand.rejection_reason}` : 'Please contact support.')
          : isSuspended
            ? 'Your account is temporarily suspended. Contact support to restore access.'
            : 'An admin will approve your account soon. You can update your profile in the meantime.';
        return (
          <TouchableOpacity
            style={[styles.statusBanner, isRejected || isSuspended ? styles.statusBannerError : styles.statusBannerWarn]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile', { screen: 'BrandProfile' })}
          >
            <Text style={[styles.statusBannerTitle, isRejected || isSuspended ? styles.statusBannerErrorText : styles.statusBannerWarnText]}>
              {title}
            </Text>
            <Text style={[styles.statusBannerBody, isRejected || isSuspended ? styles.statusBannerErrorText : styles.statusBannerWarnText]}>
              {body}
            </Text>
          </TouchableOpacity>
        );
      })()}

      {/* Wallet card */}
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>Wallet Balance</Text>
        <Text style={styles.walletAmount}>{fmtRupees(brand?.wallet_balance || 0)}</Text>
        <View style={styles.walletRow}>
          <View style={styles.walletStat}>
            <Text style={styles.walletStatLabel}>Active Campaigns</Text>
            <Text style={styles.walletStatVal}>{activeCampaigns.length}</Text>
          </View>
          <View style={[styles.walletStat, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)', paddingLeft: 16 }]}>
            <Text style={styles.walletStatLabel}>Total Campaigns</Text>
            <Text style={styles.walletStatVal}>{campaigns.length}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.topupBtn} onPress={() => navigation.navigate('Wallet')}>
          <Text style={styles.topupBtnText}>+ Top Up Wallet</Text>
        </TouchableOpacity>
      </View>

      {/* Action Required — counts of items waiting on the brand. Hidden when
          nothing is pending. Tap → opens the unified Action Required hub. */}
      {(() => {
        if (!inboxSummary) return null;
        const totals =
          (inboxSummary.pending_applications || 0) +
          (inboxSummary.pending_negotiations || 0) +
          (inboxSummary.pending_reviews || 0) +
          (inboxSummary.pending_signatures || 0) +
          (inboxSummary.contracts_failed || 0) +
          (inboxSummary.pdf_failed || 0);
        if (totals === 0) return null;
        const parts = [];
        if (inboxSummary.pending_applications) parts.push(`${inboxSummary.pending_applications} application${inboxSummary.pending_applications !== 1 ? 's' : ''}`);
        if (inboxSummary.pending_negotiations) parts.push(`${inboxSummary.pending_negotiations} negotiation${inboxSummary.pending_negotiations !== 1 ? 's' : ''}`);
        if (inboxSummary.pending_reviews)      parts.push(`${inboxSummary.pending_reviews} review${inboxSummary.pending_reviews !== 1 ? 's' : ''}`);
        if (inboxSummary.pending_signatures)   parts.push(`${inboxSummary.pending_signatures} contract${inboxSummary.pending_signatures !== 1 ? 's' : ''}`);
        const failures = (inboxSummary.contracts_failed || 0) + (inboxSummary.pdf_failed || 0);
        if (failures)                          parts.push(`${failures} failure${failures !== 1 ? 's' : ''}`);
        return (
          <TouchableOpacity
            style={styles.actionRequiredCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('BrandActionRequired')}
          >
            <Text style={styles.actionRequiredIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionRequiredTitle}>Action Required ({totals})</Text>
              <Text style={styles.actionRequiredBody}>{parts.join(' · ')}</Text>
            </View>
            <Text style={styles.actionRequiredArrow}>›</Text>
          </TouchableOpacity>
        );
      })()}

      {/* Context-aware wallet alert — only shown when a campaign is actually
          blocked on funds. Tapping opens the wallet top-up flow directly. */}
      {pendingWallet.length > 0 && (
        <TouchableOpacity
          style={styles.alert}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Wallet')}
        >
          <Text style={styles.alertTitle}>
            {pendingWallet.length} campaign{pendingWallet.length > 1 ? 's' : ''} waiting on wallet top-up
          </Text>
          <Text style={styles.alertBody}>
            Top up to release funds and publish{pendingWallet.length > 1 ? ' them' : ' it'} to influencers.
          </Text>
          <Text style={styles.alertCta}>Top Up Now →</Text>
        </TouchableOpacity>
      )}

      {/* Open Web Dashboard */}
      <TouchableOpacity style={styles.webDashBtn} onPress={() => openWebDashboard('/dashboard')}>
        <Text style={styles.webDashIcon}>🌐</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.webDashTitle}>Open Web Dashboard</Text>
          <Text style={styles.webDashSub}>Full campaign management, analytics, and more</Text>
        </View>
        <Text style={styles.webDashArrow}>›</Text>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Campaigns')}>
            <Text style={styles.quickActionIcon}>📊</Text>
            <Text style={styles.quickActionLabel}>View Campaigns</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Wallet')}>
            <Text style={styles.quickActionIcon}>💳</Text>
            <Text style={styles.quickActionLabel}>Wallet & Payments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Campaigns')}>
            <Text style={styles.quickActionIcon}>🤝</Text>
            <Text style={styles.quickActionLabel}>Negotiations</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('BrandEnquiries')}>
            <Text style={styles.quickActionIcon}>📩</Text>
            <Text style={styles.quickActionLabel}>Enquiry Leads</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('BrandConversions')}>
            <Text style={styles.quickActionIcon}>💸</Text>
            <Text style={styles.quickActionLabel}>Conversions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('BrandInfluencerBrowse')}>
            <Text style={styles.quickActionIcon}>⭐</Text>
            <Text style={styles.quickActionLabel}>Find Influencers</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active campaigns */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Campaigns</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Campaigns')}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        {campaigns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📣</Text>
            <Text style={styles.emptyText}>No campaigns yet</Text>
            <Text style={styles.emptySubText}>Create campaigns from the web dashboard</Text>
          </View>
        ) : (
          campaigns.slice(0, 5).map(c => (
            <TouchableOpacity
              key={c.id}
              style={styles.campaignCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Campaigns', { screen: 'CampaignDetail', params: { campaignId: c.id } })}
            >
              <View style={styles.campaignHeader}>
                <Text style={styles.campaignName} numberOfLines={1}>{c.name}</Text>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[c.status] || colors.t3 }]} />
              </View>
              <Text style={styles.campaignStatus}>{c.status?.replace(/_/g, ' ')}</Text>
              {(c.total_budget > 0) && (
                <Text style={styles.campaignBudget}>Budget: ₹{Number(c.total_budget).toLocaleString('en-IN')}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.white, fontFamily: 'System' },
  headerBrand: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  walletCard: { margin: 16, marginBottom: 0, backgroundColor: colors.navy, borderRadius: 20, padding: 20 },
  walletLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  walletAmount: { fontSize: 32, fontWeight: '900', color: colors.white, marginTop: 4, marginBottom: 12 },
  walletRow: { flexDirection: 'row', marginBottom: 16 },
  walletStat: { flex: 1 },
  walletStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  walletStatVal: { fontSize: 18, fontWeight: '800', color: colors.white },
  topupBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  topupBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  alert: { margin: 16, marginBottom: 0, backgroundColor: colors.orange + '20', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.orange + '40' },
  alertTitle: { fontSize: 13, color: colors.orange, fontWeight: '800', marginBottom: 3 },
  alertBody:  { fontSize: 11, color: colors.orange, opacity: 0.9, lineHeight: 15, marginBottom: 6 },
  alertCta:   { fontSize: 12, color: colors.orange, fontWeight: '800' },
  actionRequiredCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: 14, padding: 14,
    marginHorizontal: 16, marginTop: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  actionRequiredIcon: { fontSize: 24 },
  actionRequiredTitle: { fontSize: 13, fontWeight: '800', color: colors.t1, marginBottom: 2 },
  actionRequiredBody:  { fontSize: 11, color: colors.t3 },
  actionRequiredArrow: { fontSize: 22, color: colors.t3 },
  statusBanner: { margin: 16, marginBottom: 0, padding: 12, borderRadius: 12, borderWidth: 1 },
  statusBannerWarn:  { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  statusBannerError: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  statusBannerTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  statusBannerBody:  { fontSize: 12, lineHeight: 16 },
  statusBannerWarnText: { color: '#92400E' },
  statusBannerErrorText:{ color: '#991B1B' },
  section: { margin: 16, marginBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.t1 },
  seeAll: { fontSize: 12, fontWeight: '700', color: colors.navy },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptySubText: { fontSize: 11, color: colors.t3, textAlign: 'center' },
  campaignCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  campaignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  campaignName: { fontSize: 14, fontWeight: '700', color: colors.t1, flex: 1, marginRight: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  campaignStatus: { fontSize: 11, color: colors.t3, textTransform: 'capitalize', marginBottom: 2 },
  campaignBudget: { fontSize: 11, color: colors.t2 },
  webDashBtn: { margin: 16, marginBottom: 0, backgroundColor: colors.navy, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  webDashIcon: { fontSize: 26 },
  webDashTitle: { fontSize: 14, fontWeight: '700', color: colors.white },
  webDashSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  webDashArrow: { fontSize: 22, color: 'rgba(255,255,255,0.4)' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickAction: { width: '47%', backgroundColor: colors.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  quickActionIcon: { fontSize: 24, marginBottom: 8 },
  quickActionLabel: { fontSize: 11, fontWeight: '700', color: colors.t1, textAlign: 'center' },
});
