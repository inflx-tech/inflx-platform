import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { colors, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

const TABS = [
  { key: 'applications',  label: 'Applications',  emptyIcon: '📥', emptyMsg: 'No applications waiting on you' },
  { key: 'negotiations',  label: 'Negotiations',  emptyIcon: '💬', emptyMsg: 'No negotiations waiting on you' },
  { key: 'reviews',       label: 'Content',       emptyIcon: '📹', emptyMsg: 'No content to review' },
  { key: 'signatures',    label: 'Contracts',     emptyIcon: '📝', emptyMsg: 'No contracts to sign' },
  { key: 'failures',      label: 'Failures',      emptyIcon: '⚠️', emptyMsg: 'No failures — everything is healthy' },
];

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function platformFee(c) { return parseFloat(c.platform_fee_pct || 8); }
function lockAmount(c) {
  const base  = parseFloat(c.influencer_fee || 0);
  const bonus = parseFloat(c.bonus_amount || 0);
  return parseFloat(((base + bonus) * (1 + platformFee(c) / 100)).toFixed(2));
}

export default function BrandActionRequiredScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('applications');
  const [tabData, setTabData] = useState({
    applications: { items: [], loading: false, loaded: false },
    negotiations: { items: [], loading: false, loaded: false },
    reviews:      { items: [], loading: false, loaded: false },
    signatures:   { items: [], loading: false, loaded: false },
    failures:     { items: [], loading: false, loaded: false },
  });
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Contracts tab selection state for bulk-sign
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [signing, setSigning] = useState(false);
  const [retrying, setRetrying] = useState(new Set());

  // Applications tab: per-row pending action so the right card spins
  const [appBusy, setAppBusy] = useState(new Set());

  const loadSummary = useCallback(async () => {
    const r = await brandApi.getInboxSummary();
    if (r.success) setSummary(r.data?.summary || r.data);
  }, []);

  const loadTab = useCallback(async (key, isRefresh = false) => {
    setTabData(p => ({ ...p, [key]: { ...p[key], loading: !isRefresh } }));
    let r;
    if (key === 'applications') r = await brandApi.listInboxApplications();
    else if (key === 'negotiations') r = await brandApi.listInboxNegotiations('awaiting_brand');
    else if (key === 'reviews') r = await brandApi.listInboxDeliverables('submitted');
    else if (key === 'signatures') r = await brandApi.listPendingContracts();
    else if (key === 'failures') r = await brandApi.listInboxFailures();
    const items = r?.success
      ? (r.data?.applications || r.data?.negotiations || r.data?.deliverables || r.data?.contracts || r.data?.failures || [])
      : [];
    setTabData(p => ({ ...p, [key]: { items, loading: false, loaded: true } }));
  }, []);

  useEffect(() => { loadSummary(); loadTab('applications'); }, [loadSummary, loadTab]);
  useEffect(() => {
    if (!tabData[activeTab].loaded && !tabData[activeTab].loading) loadTab(activeTab);
  }, [activeTab, tabData, loadTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(), loadTab(activeTab, true)]);
    setRefreshing(false);
  }, [activeTab, loadSummary, loadTab]);

  // ── Contracts tab: bulk-sign ────────────────────────────────────────────────
  const contracts = tabData.signatures.items;
  const totalLock = useMemo(
    () => contracts.filter(c => selectedIds.has(c.id)).reduce((s, c) => s + lockAmount(c), 0),
    [contracts, selectedIds]
  );

  function toggleSel(id) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selectedIds.size === contracts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(contracts.map(c => c.id)));
  }
  async function signSelected() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    Alert.alert(
      'Counter-sign contracts',
      `Sign ${ids.length} contract${ids.length !== 1 ? 's' : ''} for a total wallet lock of ${fmtRupees(totalLock)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign', onPress: async () => {
          setSigning(true);
          const res = await brandApi.bulkSignContracts(ids);
          setSigning(false);
          if (!res.success) {
            Alert.alert('Sign failed', res.error?.message || 'Bulk sign failed');
            return;
          }
          Alert.alert('Done', `Signed ${res.data?.signed_count || ids.length} contracts.`);
          setSelectedIds(new Set());
          loadSummary();
          loadTab('signatures', true);
        } },
      ]
    );
  }

  // ── Failures tab: retry per row ────────────────────────────────────────────
  async function retryFailure(item) {
    setRetrying(prev => new Set(prev).add(item.id));
    let res;
    if (item.kind === 'contract_create_failed') res = await brandApi.retryContractCreate(item.id);
    else if (item.kind === 'pdf_failed')         res = await brandApi.regenerateContractPdf(item.id);
    setRetrying(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    if (!res?.success) {
      Alert.alert('Retry failed', res?.error?.message || 'Could not retry. Please try again.');
      return;
    }
    Alert.alert('Retried', 'The operation has been retried. Refreshing list.');
    loadSummary();
    loadTab('failures', true);
  }

  const currentTab = TABS.find(t => t.key === activeTab);
  const currentData = tabData[activeTab];
  const tabCount = (k) => {
    if (!summary) return null;
    if (k === 'applications') return summary.pending_applications;
    if (k === 'negotiations') return summary.pending_negotiations;
    if (k === 'reviews')      return summary.pending_reviews;
    if (k === 'signatures')   return summary.pending_signatures;
    if (k === 'failures')     return (summary.contracts_failed || 0) + (summary.pdf_failed || 0);
    return null;
  };

  // ── Applications: approve / reject ─────────────────────────────────────────
  async function approveApp(a) {
    setAppBusy(prev => new Set(prev).add(a.campaign_influencer_id));
    const res = await brandApi.approveApplication(a.campaign_id, a.campaign_influencer_id);
    setAppBusy(prev => { const n = new Set(prev); n.delete(a.campaign_influencer_id); return n; });
    if (!res.success) {
      Alert.alert('Approve failed', res.error?.message || 'Could not approve this application.');
      return;
    }
    const slotsMsg = res.data?.slots_filled
      ? `\n\nSlots are now full — ${res.data.closed_out_count || 0} other applicant${(res.data.closed_out_count || 0) !== 1 ? 's were' : ' was'} notified that the campaign is closed.`
      : '';
    Alert.alert('Approved', `Contract draft sent to @${a.instagram_handle || 'influencer'}.${slotsMsg}`);
    loadSummary();
    loadTab('applications', true);
  }
  async function rejectApp(a) {
    Alert.alert(
      'Reject application',
      `Reject @${a.instagram_handle || 'this influencer'}? They'll be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: async () => {
          setAppBusy(prev => new Set(prev).add(a.campaign_influencer_id));
          const res = await brandApi.rejectApplication(a.campaign_id, a.campaign_influencer_id);
          setAppBusy(prev => { const n = new Set(prev); n.delete(a.campaign_influencer_id); return n; });
          if (!res.success) {
            Alert.alert('Reject failed', res.error?.message || 'Could not reject this application.');
            return;
          }
          loadSummary();
          loadTab('applications', true);
        } },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Action Required</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(t => {
          const isActive = activeTab === t.key;
          const count = tabCount(t.key);
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t.label}{count != null && count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bulk-sign bar (signatures tab only, when selection exists) */}
      {activeTab === 'signatures' && contracts.length > 0 && (
        <View style={styles.bulkBar}>
          <TouchableOpacity onPress={toggleAll} style={styles.selectAllRow}>
            <View style={[styles.checkbox, selectedIds.size === contracts.length && styles.checkboxOn]} />
            <Text style={styles.bulkSelectLabel}>
              {selectedIds.size === 0
                ? `Select all (${contracts.length})`
                : `${selectedIds.size} selected · ${fmtRupees(totalLock)} total lock`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={signSelected}
            disabled={selectedIds.size === 0 || signing}
            style={[styles.bulkSignBtn, (selectedIds.size === 0 || signing) && styles.bulkSignBtnDisabled]}
          >
            <Text style={styles.bulkSignBtnText}>
              {signing ? 'Signing…' : `Sign ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {currentData.loading && !currentData.loaded ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.navy} />
          </View>
        ) : currentData.items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{currentTab.emptyIcon}</Text>
            <Text style={styles.emptyMsg}>{currentTab.emptyMsg}</Text>
          </View>
        ) : (
          currentData.items.map((item) => {
            if (activeTab === 'applications') {
              const busy = appBusy.has(item.campaign_influencer_id);
              const followers = item.followers_count ? Number(item.followers_count).toLocaleString('en-IN') : '—';
              const er = item.engagement_rate != null ? `${parseFloat(item.engagement_rate).toFixed(1)}% ER` : '';
              return (
                <View key={item.campaign_influencer_id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>@{item.instagram_handle || '—'}</Text>
                    <Text style={styles.tierTag}>{item.tier || '—'}</Text>
                  </View>
                  <Text style={styles.cardMeta}>
                    {item.influencer_name ? `${item.influencer_name} · ` : ''}{item.campaign_name}
                  </Text>
                  <Text style={styles.cardLine}>
                    {followers} followers{er ? ` · ${er}` : ''}{item.city ? ` · ${item.city}` : ''}
                  </Text>
                  {Array.isArray(item.niche) && item.niche.length > 0 && (
                    <Text style={styles.cardLine}>Niche: {item.niche.join(', ')}</Text>
                  )}
                  <View style={styles.appActions}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('BrandInfluencerProfile', { influencerId: item.influencer_profile_id })}
                      style={styles.appProfileLink}
                    >
                      <Text style={styles.appProfileLinkText}>View full profile →</Text>
                    </TouchableOpacity>
                    <View style={styles.appButtonsRow}>
                      <TouchableOpacity
                        style={[styles.appRejectBtn, busy && { opacity: 0.4 }]}
                        onPress={() => rejectApp(item)}
                        disabled={busy}
                      >
                        <Text style={styles.appRejectText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.appApproveBtn, busy && { opacity: 0.4 }]}
                        onPress={() => approveApp(item)}
                        disabled={busy}
                      >
                        <Text style={styles.appApproveText}>{busy ? 'Working…' : 'Approve'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }
            if (activeTab === 'negotiations') {
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('BrandNegotiation', {
                    campaignInfluencerId: item.campaign_influencer_id,
                    negotiationId: item.id,
                    campaignName: item.campaign_name,
                    influencerHandle: item.influencer_handle,
                  })}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>@{item.influencer_handle || '—'}</Text>
                    <StatusBadge status="awaiting_brand" />
                  </View>
                  <Text style={styles.cardMeta}>{item.campaign_name} · {item.set_name}</Text>
                  {item.last_proposed_fee != null && (
                    <Text style={styles.cardLine}>Last counter: {fmtRupees(item.last_proposed_fee)}</Text>
                  )}
                  <Text style={styles.cardHint}>Tap to respond →</Text>
                </TouchableOpacity>
              );
            }
            if (activeTab === 'reviews') {
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('BrandCampaignDetail', { campaignId: item.campaign_id })}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>@{item.influencer_handle || '—'}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text style={styles.cardMeta}>
                    {DELIVERABLE_LABELS[item.type] || item.type} · {item.campaign_name}
                  </Text>
                  {item.submitted_at && (
                    <Text style={styles.cardLine}>Submitted {formatDate(item.submitted_at)}</Text>
                  )}
                  {item.revision_count > 0 && (
                    <Text style={styles.cardLine}>Revision {item.revision_count}/{item.revision_limit}</Text>
                  )}
                  <Text style={styles.cardHint}>Tap to review →</Text>
                </TouchableOpacity>
              );
            }
            if (activeTab === 'signatures') {
              const sel = selectedIds.has(item.id);
              const lock = lockAmount(item);
              const base  = parseFloat(item.influencer_fee || 0);
              const bonus = parseFloat(item.bonus_amount || 0);
              return (
                <View key={item.id} style={[styles.card, sel && styles.cardSelected]}>
                  <TouchableOpacity onPress={() => toggleSel(item.id)} style={styles.cardRow}>
                    <View style={[styles.checkbox, sel && styles.checkboxOn]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>@{item.instagram_handle || '—'}</Text>
                      <Text style={styles.cardMeta}>
                        {item.campaign_name} · signed {formatDate(item.influencer_signed_at)}
                      </Text>
                      {bonus > 0 && (
                        <Text style={styles.cardLine}>{fmtRupees(base)} + {fmtRupees(bonus)} bonus</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardLineLabel}>Lock</Text>
                      <Text style={styles.cardLineValue}>{fmtRupees(lock)}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('BrandContract', {
                      campaignInfluencerId: item.campaign_influencer_id || item.id,
                      campaignId: item.campaign_id,
                    })}
                  >
                    <Text style={styles.cardReviewLink}>Review terms →</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            if (activeTab === 'failures') {
              const isContractCreate = item.kind === 'contract_create_failed';
              const isRetrying = retrying.has(item.id);
              return (
                <View key={`${item.kind}-${item.id}`} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>@{item.influencer_handle || '—'}</Text>
                    <Text style={styles.failureTag}>
                      {isContractCreate ? 'CONTRACT' : 'PDF'}
                    </Text>
                  </View>
                  <Text style={styles.cardMeta}>{item.campaign_name} · {item.set_name}</Text>
                  <Text style={styles.failureError} numberOfLines={3}>
                    {item.error_message || 'Unknown error'}
                  </Text>
                  <Text style={styles.cardLine}>Occurred {formatDate(item.occurred_at)}</Text>
                  <TouchableOpacity
                    onPress={() => retryFailure(item)}
                    disabled={isRetrying}
                    style={[styles.retryBtn, isRetrying && styles.retryBtnDisabled]}
                  >
                    <Text style={styles.retryBtnText}>
                      {isRetrying ? 'Retrying…' : isContractCreate ? 'Retry contract create' : 'Regenerate PDF'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return null;
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 28, color: colors.t1, marginTop: -4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.t1 },
  tabBar: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 12, gap: 8, paddingVertical: 10 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface2 },
  tabBtnActive: { backgroundColor: colors.navy },
  tabText: { fontSize: 11, fontWeight: '600', color: colors.t3 },
  tabTextActive: { color: colors.white },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bulkSelectLabel: { fontSize: 12, fontWeight: '600', color: colors.t2 },
  bulkSignBtn: { backgroundColor: colors.navy, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  bulkSignBtnDisabled: { opacity: 0.4 },
  bulkSignBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: colors.border2 || colors.border, backgroundColor: colors.white },
  checkboxOn: { backgroundColor: colors.navy, borderColor: colors.navy },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 60 },
  empty: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyMsg: { fontSize: 14, color: colors.t3, textAlign: 'center' },

  card: {
    backgroundColor: colors.white, margin: 12, marginBottom: 0,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  cardSelected: { borderColor: colors.navy },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  cardMeta: { fontSize: 12, color: colors.t3, marginTop: 2 },
  cardLine: { fontSize: 12, color: colors.t2, marginTop: 4 },
  cardLineLabel: { fontSize: 10, color: colors.t3, textTransform: 'uppercase' },
  cardLineValue: { fontSize: 14, fontWeight: '700', color: colors.t1, marginTop: 2 },
  cardHint: { fontSize: 11, fontWeight: '700', color: colors.navy, marginTop: 8, textAlign: 'right' },
  cardReviewLink: { fontSize: 11, fontWeight: '700', color: colors.navy, marginTop: 10, textAlign: 'right' },

  tierTag: { fontSize: 10, fontWeight: '700', color: colors.navy, backgroundColor: colors.surface2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  appActions: { marginTop: 10, flexDirection: 'column', gap: 8 },
  appProfileLink: { paddingVertical: 4 },
  appProfileLinkText: { fontSize: 11, fontWeight: '700', color: colors.navy },
  appButtonsRow: { flexDirection: 'row', gap: 8 },
  appApproveBtn: { flex: 1, backgroundColor: colors.navy, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  appApproveText: { fontSize: 12, fontWeight: '700', color: colors.white },
  appRejectBtn: { flex: 1, backgroundColor: colors.redPale, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.red },
  appRejectText: { fontSize: 12, fontWeight: '700', color: colors.red },
  failureTag: { fontSize: 10, fontWeight: '700', color: colors.red, backgroundColor: colors.redPale || '#fee', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  failureError: { fontSize: 12, color: colors.red, marginTop: 6, fontFamily: 'monospace' },
  retryBtn: { backgroundColor: colors.navy, padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  retryBtnDisabled: { opacity: 0.5 },
  retryBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});
