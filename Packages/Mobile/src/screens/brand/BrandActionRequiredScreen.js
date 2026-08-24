import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import ScreenHeader from '../../components/brand/ScreenHeader';
import StatusPill from '../../components/brand/StatusPill';
import EmptyState from '../../components/brand/EmptyState';

/**
 * BrandActionRequiredScreen — global inbox of items waiting on the brand.
 *
 * Flow 23 (2026-05-25): navy + orange → brandPalette + ScreenHeader +
 * StatusPill + EmptyState + fonts. Drop external components/StatusBadge
 * import. Behavior preserved 1:1 across 5 lazy-loaded tabs.
 */

const TABS = [
  { key: 'applications',  label: 'Apps',      emptyIcon: '[INBOX]',  emptyMsg: 'No applications waiting on you' },
  { key: 'negotiations',  label: 'Negos',     emptyIcon: '[CHAT]',   emptyMsg: 'No negotiations waiting on you' },
  { key: 'reviews',       label: 'Content',   emptyIcon: '[VIDEO]',  emptyMsg: 'No content to review' },
  { key: 'signatures',    label: 'Contracts', emptyIcon: '[SIGN]',   emptyMsg: 'No contracts to sign' },
  { key: 'failures',      label: 'Failures',  emptyIcon: '[OK]',     emptyMsg: 'No failures — everything is healthy' },
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [signing, setSigning] = useState(false);
  const [retrying, setRetrying] = useState(new Set());
  const [appBusy, setAppBusy] = useState(new Set());

  const loadSummary = useCallback(async () => {
    const r = await brandApi.getInboxSummary();
    if (r.success) setSummary(r.data?.summary || r.data);
  }, []);

  const loadTab = useCallback(async (key, isRefresh = false) => {
    setTabData(prev => ({ ...prev, [key]: { ...prev[key], loading: !isRefresh } }));
    let r;
    if (key === 'applications') r = await brandApi.listInboxApplications();
    else if (key === 'negotiations') r = await brandApi.listInboxNegotiations('awaiting_brand');
    else if (key === 'reviews') r = await brandApi.listInboxDeliverables('submitted');
    else if (key === 'signatures') r = await brandApi.listPendingContracts();
    else if (key === 'failures') r = await brandApi.listInboxFailures();
    const items = r?.success
      ? (r.data?.applications || r.data?.negotiations || r.data?.deliverables || r.data?.contracts || r.data?.failures || [])
      : [];
    setTabData(prev => ({ ...prev, [key]: { items, loading: false, loaded: true } }));
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

  const contracts = tabData.signatures.items;
  const totalLock = useMemo(
    () => contracts.filter(c => selectedIds.has(c.id)).reduce((sum, c) => sum + lockAmount(c), 0),
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
          if (!res.success) { Alert.alert('Sign failed', res.error?.message || 'Bulk sign failed'); return; }
          Alert.alert('Done', `Signed ${res.data?.signed_count || ids.length} contracts.`);
          setSelectedIds(new Set());
          loadSummary();
          loadTab('signatures', true);
        } },
      ]
    );
  }

  async function retryFailure(item) {
    setRetrying(prev => new Set(prev).add(item.id));
    let res;
    if (item.kind === 'contract_create_failed') res = await brandApi.retryContractCreate(item.id);
    else if (item.kind === 'pdf_failed')         res = await brandApi.regenerateContractPdf(item.id);
    setRetrying(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    if (!res?.success) { Alert.alert('Retry failed', res?.error?.message || 'Could not retry. Please try again.'); return; }
    Alert.alert('Retried', 'The operation has been retried. Refreshing list.');
    loadSummary();
    loadTab('failures', true);
  }

  async function approveApp(a) {
    setAppBusy(prev => new Set(prev).add(a.campaign_influencer_id));
    const res = await brandApi.approveApplication(a.campaign_id, a.campaign_influencer_id);
    setAppBusy(prev => { const n = new Set(prev); n.delete(a.campaign_influencer_id); return n; });
    if (!res.success) { Alert.alert('Approve failed', res.error?.message || 'Could not approve this application.'); return; }
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
          if (!res.success) { Alert.alert('Reject failed', res.error?.message || 'Could not reject this application.'); return; }
          loadSummary();
          loadTab('applications', true);
        } },
      ]
    );
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

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Action Required"
        sub="Everything waiting on you"
        back onBack={() => navigation.goBack()}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
        {TABS.map(t => {
          const isActive = activeTab === t.key;
          const count = tabCount(t.key);
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[s.tabBtn, isActive && s.tabBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{t.label}</Text>
              {count != null && count > 0 && (
                <Text style={[s.tabCount, isActive && s.tabCountActive]}>{count}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeTab === 'signatures' && contracts.length > 0 && (
        <View style={s.bulkBar}>
          <TouchableOpacity onPress={toggleAll} style={s.selectAllRow} activeOpacity={0.7}>
            <View style={[s.checkbox, selectedIds.size === contracts.length && s.checkboxOn]}>
              {selectedIds.size === contracts.length && <Text style={s.checkboxMark}>✓</Text>}
            </View>
            <Text style={s.bulkSelectLabel}>
              {selectedIds.size === 0
                ? `Select all (${contracts.length})`
                : <>{selectedIds.size} selected · <Text style={s.bulkSelectLabelV}>{fmtRupees(totalLock)}</Text> total lock</>}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={signSelected}
            disabled={selectedIds.size === 0 || signing}
            style={[s.bulkSignBtn, (selectedIds.size === 0 || signing) && s.bulkSignBtnDisabled]}
            activeOpacity={0.85}
          >
            <Text style={s.bulkSignBtnText}>
              {signing ? 'Signing…' : `Sign${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 14, paddingTop: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} colors={[P.ink]} />}
      >
        {currentData.loading && !currentData.loaded ? (
          <View style={s.center}><ActivityIndicator size="large" color={P.ink} /></View>
        ) : currentData.items.length === 0 ? (
          <EmptyState icon={currentTab.emptyIcon} title={currentTab.emptyMsg} />
        ) : (
          currentData.items.map((item) => {
            if (activeTab === 'applications') {
              const busy = appBusy.has(item.campaign_influencer_id);
              const followers = item.followers_count ? Number(item.followers_count).toLocaleString('en-IN') : '—';
              const er = item.engagement_rate != null ? `${parseFloat(item.engagement_rate).toFixed(1)}% ER` : '';
              return (
                <View key={item.campaign_influencer_id} style={s.card}>
                  <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>@{item.instagram_handle || '—'}</Text>
                    <Text style={s.tierTag}>{item.tier || '—'}</Text>
                  </View>
                  <Text style={s.cardMeta}>
                    {item.influencer_name ? `${item.influencer_name} · ` : ''}{item.campaign_name}
                  </Text>
                  <Text style={s.cardLine}>
                    {followers} followers{er ? ` · ${er}` : ''}{item.city ? ` · ${item.city}` : ''}
                  </Text>
                  {Array.isArray(item.niche) && item.niche.length > 0 && (
                    <Text style={s.cardLine}>Niche: {item.niche.join(', ')}</Text>
                  )}
                  <View style={s.appActions}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('BrandInfluencerProfile', { influencerId: item.influencer_profile_id })}
                      style={s.appProfileLink}
                    >
                      <Text style={s.appProfileLinkText}>View full profile →</Text>
                    </TouchableOpacity>
                    <View style={s.appButtonsRow}>
                      <TouchableOpacity
                        style={[s.appRejectBtn, busy && { opacity: 0.4 }]}
                        onPress={() => rejectApp(item)}
                        disabled={busy}
                      >
                        <Text style={s.appRejectText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.appApproveBtn, busy && { opacity: 0.4 }]}
                        onPress={() => approveApp(item)}
                        disabled={busy}
                      >
                        <Text style={s.appApproveText}>{busy ? 'Working…' : 'Approve'}</Text>
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
                  style={s.card}
                  onPress={() => navigation.navigate('BrandNegotiation', {
                    campaignInfluencerId: item.campaign_influencer_id,
                    negotiationId: item.id,
                    campaignName: item.campaign_name,
                    influencerHandle: item.influencer_handle,
                  })}
                  activeOpacity={0.85}
                >
                  <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>@{item.influencer_handle || '—'}</Text>
                    <StatusPill status="awaiting_brand" />
                  </View>
                  <Text style={s.cardMeta}>{item.campaign_name} · {item.set_name}</Text>
                  {item.last_proposed_fee != null && (
                    <Text style={s.cardLine}>Last counter: <Text style={s.cardLineV}>{fmtRupees(item.last_proposed_fee)}</Text></Text>
                  )}
                  <Text style={s.cardHint}>Tap to respond →</Text>
                </TouchableOpacity>
              );
            }
            if (activeTab === 'reviews') {
              return (
                <TouchableOpacity
                  key={item.id}
                  style={s.card}
                  onPress={() => navigation.navigate('CampaignDetail', { campaignId: item.campaign_id })}
                  activeOpacity={0.85}
                >
                  <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>@{item.influencer_handle || '—'}</Text>
                    <StatusPill status={item.status} />
                  </View>
                  <Text style={s.cardMeta}>
                    {DELIVERABLE_LABELS[item.type] || item.type} · {item.campaign_name}
                  </Text>
                  {item.submitted_at && (
                    <Text style={s.cardLine}>Submitted {formatDate(item.submitted_at)}</Text>
                  )}
                  {item.revision_count > 0 && (
                    <Text style={s.cardLine}>Revision {item.revision_count}/{item.revision_limit}</Text>
                  )}
                  <Text style={s.cardHint}>Tap to review →</Text>
                </TouchableOpacity>
              );
            }
            if (activeTab === 'signatures') {
              const sel = selectedIds.has(item.id);
              const lock = lockAmount(item);
              const base  = parseFloat(item.influencer_fee || 0);
              const bonus = parseFloat(item.bonus_amount || 0);
              return (
                <View key={item.id} style={[s.card, sel && s.cardSelected]}>
                  <TouchableOpacity onPress={() => toggleSel(item.id)} style={s.cardRow} activeOpacity={0.85}>
                    <View style={[s.checkbox, sel && s.checkboxOn]}>
                      {sel && <Text style={s.checkboxMark}>✓</Text>}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.cardTitle}>@{item.instagram_handle || '—'}</Text>
                      <Text style={s.cardMeta}>
                        {item.campaign_name} · signed {formatDate(item.influencer_signed_at)}
                      </Text>
                      {bonus > 0 && (
                        <Text style={s.cardLine}>{fmtRupees(base)} + {fmtRupees(bonus)} bonus</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.cardLineLabel}>Lock</Text>
                      <Text style={s.cardLineValue}>{fmtRupees(lock)}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('BrandContract', {
                      campaignInfluencerId: item.campaign_influencer_id || item.id,
                      campaignId: item.campaign_id,
                    })}
                  >
                    <Text style={s.cardReviewLink}>Review terms →</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            if (activeTab === 'failures') {
              const isContractCreate = item.kind === 'contract_create_failed';
              const isRetrying = retrying.has(item.id);
              return (
                <View key={`${item.kind}-${item.id}`} style={s.card}>
                  <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>@{item.influencer_handle || '—'}</Text>
                    <Text style={s.failureTag}>{isContractCreate ? 'CONTRACT' : 'PDF'}</Text>
                  </View>
                  <Text style={s.cardMeta}>{item.campaign_name} · {item.set_name}</Text>
                  <Text style={s.failureError} numberOfLines={3}>{item.error_message || 'Unknown error'}</Text>
                  <Text style={s.cardLine}>Occurred {formatDate(item.occurred_at)}</Text>
                  <TouchableOpacity
                    onPress={() => retryFailure(item)}
                    disabled={isRetrying}
                    style={[s.retryBtn, isRetrying && s.retryBtnDisabled]}
                    activeOpacity={0.85}
                  >
                    <Text style={s.retryBtnText}>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  tabBar: { backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border, flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 14, gap: 6, paddingVertical: 10 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: P.bg2 },
  tabBtnActive: { backgroundColor: P.ink },
  tabText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.muted },
  tabTextActive: { color: P.white, fontFamily: fonts.monoBold },
  tabCount: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '700', color: P.muted2 },
  tabCountActive: { color: 'rgba(255,255,255,0.85)' },

  bulkBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, backgroundColor: P.bg2, borderBottomWidth: 1, borderBottomColor: P.bg2, gap: 10 },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  bulkSelectLabel: { fontFamily: fonts.sansBold, fontSize: 11.5, fontWeight: '700', color: P.ink, flexShrink: 1 },
  bulkSelectLabelV: { fontFamily: fonts.monoBold },
  bulkSignBtn: { backgroundColor: P.ink, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  bulkSignBtnDisabled: { opacity: 0.4 },
  bulkSignBtnText: { fontFamily: fonts.monoBold, color: P.white, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: P.border, backgroundColor: P.white, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: P.ink, borderColor: P.ink },
  checkboxMark: { fontFamily: fonts.monoBold, fontSize: 12, color: P.white, fontWeight: '800', lineHeight: 13 },

  center: { padding: 60, alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: P.white, marginBottom: 8, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: P.border },
  cardSelected: { borderColor: P.ink, backgroundColor: P.bg2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 13.5, fontWeight: '700', color: P.ink },
  cardMeta: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, marginTop: 2 },
  cardLine: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted, marginTop: 4 },
  cardLineV: { color: P.ink, fontWeight: '700' },
  cardLineLabel: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4 },
  cardLineValue: { fontFamily: fonts.monoBold, fontSize: 14, fontWeight: '800', color: P.ink, marginTop: 2 },
  cardHint: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.warnText, marginTop: 8, textAlign: 'right' },
  cardReviewLink: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.ink, marginTop: 10, textAlign: 'right' },

  tierTag: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.ink, backgroundColor: P.bg2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, textTransform: 'capitalize' },

  appActions: { marginTop: 10, flexDirection: 'column', gap: 8 },
  appProfileLink: { paddingVertical: 4 },
  appProfileLinkText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.ink },
  appButtonsRow: { flexDirection: 'row', gap: 8 },
  appApproveBtn: { flex: 1, backgroundColor: P.ink, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  appApproveText: { fontFamily: fonts.monoBold, fontSize: 11.5, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
  appRejectBtn: { flex: 1, backgroundColor: P.dangerPale, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: P.dangerPale },
  appRejectText: { fontFamily: fonts.sansBold, fontSize: 11.5, fontWeight: '800', color: P.dangerText },

  failureTag: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.dangerText, backgroundColor: P.dangerPale, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, textTransform: 'uppercase' },
  failureError: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.dangerText, marginTop: 6 },
  retryBtn: { backgroundColor: P.ink, padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  retryBtnDisabled: { opacity: 0.5 },
  retryBtnText: { fontFamily: fonts.monoBold, color: P.white, fontSize: 11.5, fontWeight: '800' },
});
