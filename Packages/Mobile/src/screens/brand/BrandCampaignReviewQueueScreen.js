import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const P = {
  bg:'#FAFAFA', surface:'#FFFFFF', surface2:'#F4F4F5',
  ink:'#0A0A0A', ink2:'#1F1F22',
  muted:'#52525B', muted2:'#71717A', muted3:'#A1A1AA',
  border:'#E4E4E7', border2:'#D4D4D8',
  yellow:'#FFC107', yellowHover:'#E0A800', yellowPale:'#FFF7CC', yellowText:'#6B5A00',
  success:'#10B981', successPale:'#D1FAE5', successDeep:'#047857',
  danger:'#E8401A', dangerPale:'#FDEEE9', dangerDeep:'#B91C1C',
  white:'#FFFFFF',
};

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BrandCampaignReviewQueueScreen({ navigation, route }) {
  const { campaignId, initialTab } = route.params || {};
  const [campaign, setCampaign]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]             = useState(initialTab || 'reviews'); // 'reviews' | 'live'
  const [actionLoading, setActionLoading] = useState(null);

  async function load() {
    const res = await brandApi.getCampaign(campaignId);
    setLoading(false);
    if (res.success) setCampaign(res.data?.campaign);
  }

  useFocusEffect(useCallback(() => { load(); }, [campaignId]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [campaignId]);

  // Action handlers
  async function handleReviewDeliverable(deliverableId, action, feedback) {
    setActionLoading(deliverableId);
    const body = action === 'approve'
      ? { action: 'approve' }
      : { action: 'request_revision', feedback: feedback || 'Please revise.' };
    const res = await brandApi.reviewDeliverable(deliverableId, body);
    setActionLoading(null);
    if (res.success) {
      Alert.alert('Done', action === 'approve' ? 'Content approved.' : 'Revision requested.');
      load();
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to review');
    }
  }

  function promptRevisionFeedback(deliverableId) {
    if (Alert.prompt) {
      Alert.prompt(
        'Request revision',
        'Enter feedback for the influencer:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: (text) => handleReviewDeliverable(deliverableId, 'request_revision', text) },
        ],
        'plain-text',
        ''
      );
    } else {
      handleReviewDeliverable(deliverableId, 'request_revision', 'Please revise the content.');
    }
  }

  function handleConfirmLive(deliverableId, liveUrl) {
    Alert.alert(
      'Confirm content live',
      `Confirm the content is live at:\n${liveUrl}\n\nTranche 2 releases once every deliverable in this contract is confirmed live.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm live', onPress: async () => {
          setActionLoading(deliverableId);
          const res = await brandApi.confirmLive(deliverableId);
          setActionLoading(null);
          if (res.success) {
            const d = res.data || {};
            if (d.t2_released) {
              const amt = typeof d.t2_amount === 'number' ? ` of ${fmtRupees(d.t2_amount)}` : '';
              Alert.alert('All content live!', `Every deliverable in this contract is now live. Tranche 2${amt} has been released.`);
            } else {
              const live = d.live_count ?? 0;
              const total = d.total_count ?? 0;
              const pending = d.pending_count ?? Math.max(0, total - live);
              Alert.alert('Marked live', `Deliverable confirmed live (${live} of ${total}). ${pending} still pending — Tranche 2 releases once all are confirmed.`);
            }
            load();
          } else {
            Alert.alert('Error', res.error?.message || 'Failed to confirm live');
          }
        } },
      ]
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={P.ink} /></View>;
  }
  if (!campaign) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Campaign not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Flatten deliverable queues from sets[*].influencers[*].deliverables[*]
  const sets = campaign.sets || [];
  const reviewQueue = [];
  const liveQueue   = [];
  for (const s of sets) {
    for (const ci of (s.influencers || [])) {
      for (const d of (ci.deliverables || [])) {
        const enriched = { ...d, influencer_name: ci.influencer_name, instagram_handle: ci.instagram_handle, set_name: s.name };
        if (d.status === 'submitted' || d.status === 'under_review') reviewQueue.push(enriched);
        if (d.status === 'approved' && d.live_url) liveQueue.push(enriched);
      }
    }
  }

  const currentQueue = tab === 'reviews' ? reviewQueue : liveQueue;

  return (
    <View style={styles.container}>
      {/* Ink header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {campaign.name || 'Campaign'}</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Review queue</Text>
            <Text style={styles.headerCrumb}>/dashboard/campaigns/{campaignId?.slice(0, 8)}/reviews</Text>
          </View>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'reviews' && styles.tabActive]}
          onPress={() => setTab('reviews')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === 'reviews' && styles.tabTextActive]}>To review</Text>
          <Text style={[styles.tabCount, tab === 'reviews' && styles.tabCountActive]}>{reviewQueue.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'live' && styles.tabActive]}
          onPress={() => setTab('live')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === 'live' && styles.tabTextActive]}>Confirm live</Text>
          <Text style={[styles.tabCount, tab === 'live' && styles.tabCountActive]}>{liveQueue.length}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
      >
        {/* Helpful hint per tab */}
        {tab === 'live' && liveQueue.length > 0 && (
          <View style={styles.hint}>
            <View style={styles.hintIcon}><Text style={styles.hintIconGlyph}>!</Text></View>
            <Text style={styles.hintText}>
              Influencers posted live URLs. Confirm every deliverable — <Text style={styles.hintTextV}>Tranche 2 releases</Text> once all are live.
            </Text>
          </View>
        )}

        {currentQueue.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconGlyph}>✓</Text></View>
            <Text style={styles.emptyText}>
              {tab === 'reviews' ? 'No content awaiting review' : 'No live URLs awaiting confirmation'}
            </Text>
            <Text style={styles.emptySubText}>You're all caught up.</Text>
          </View>
        ) : (
          currentQueue.map(d => {
            const isBusy = actionLoading === d.id;
            return (
              <View key={d.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardType}>{DELIVERABLE_LABELS[d.type] || d.type}</Text>
                    <Text style={styles.cardInf}>
                      @{d.instagram_handle || '—'} <Text style={styles.cardInfName}>· {d.influencer_name || 'Influencer'}</Text>
                    </Text>
                    {d.set_name ? <Text style={styles.cardSet}>{d.set_name}</Text> : null}
                  </View>
                  {tab === 'reviews' && d.submitted_at && (
                    <Text style={styles.cardDate}>{formatDate(d.submitted_at)}</Text>
                  )}
                </View>

                {(tab === 'reviews' && d.content_url) || (tab === 'live' && d.live_url) ? (
                  <View style={styles.urlRow}>
                    <Text style={styles.urlLabel}>{tab === 'live' ? 'Live URL' : 'Content URL'}</Text>
                    <Text style={styles.urlText} numberOfLines={1}>{tab === 'live' ? d.live_url : d.content_url}</Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  {tab === 'reviews' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.btnRevise, isBusy && { opacity: 0.4 }]}
                        onPress={() => promptRevisionFeedback(d.id)}
                        disabled={isBusy}
                      >
                        <Text style={styles.btnReviseText}>Revise</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnApprove, isBusy && { opacity: 0.4 }]}
                        onPress={() => handleReviewDeliverable(d.id, 'approve')}
                        disabled={isBusy}
                      >
                        {isBusy
                          ? <ActivityIndicator size="small" color={P.yellow} />
                          : <Text style={styles.btnApproveText}>Approve</Text>}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.btnConfirmLive, isBusy && { opacity: 0.4 }]}
                      onPress={() => handleConfirmLive(d.id, d.live_url)}
                      disabled={isBusy}
                    >
                      {isBusy
                        ? <ActivityIndicator size="small" color={P.white} />
                        : <Text style={styles.btnConfirmLiveText}>Confirm live</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg, padding: 24 },
  errorText: { fontSize: 13, color: P.dangerDeep, marginBottom: 16, textAlign: 'center' },
  goBackBtn: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: P.surface2, borderRadius: 10 },
  goBackBtnText: { fontSize: 13, fontWeight: '700', color: P.ink },

  header: { backgroundColor: P.ink, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  backBtn: { paddingVertical: 4 },
  backBtnText: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: P.white, letterSpacing: -0.3 },
  headerCrumb: { fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3, marginTop: 3 },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: P.surface, borderBottomWidth: 1, borderBottomColor: P.border, paddingHorizontal: 14, gap: 8, paddingTop: 8, paddingBottom: 0 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: P.yellow },
  tabText: { fontSize: 13, fontWeight: '600', color: P.muted2 },
  tabTextActive: { color: P.ink, fontWeight: '700' },
  tabCount: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: P.muted3, backgroundColor: P.surface2, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 100 },
  tabCountActive: { color: P.ink, backgroundColor: P.yellowPale },

  list: { padding: 14, gap: 10 },

  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: P.yellowPale, borderRadius: 10, padding: 11, borderLeftWidth: 3, borderLeftColor: P.yellow },
  hintIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  hintIconGlyph: { fontSize: 12, fontWeight: '800', color: P.yellow },
  hintText: { flex: 1, fontSize: 11.5, color: P.ink2, lineHeight: 16 },
  hintTextV: { fontWeight: '700', color: P.ink },

  emptyCard: { backgroundColor: P.surface, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: P.border },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: P.successPale, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyIconGlyph: { fontSize: 22, fontWeight: '700', color: P.successDeep },
  emptyText: { fontSize: 13.5, fontWeight: '700', color: P.ink, marginBottom: 4, textAlign: 'center' },
  emptySubText: { fontSize: 11, color: P.muted, textAlign: 'center' },

  card: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 14, padding: 12, gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardType: { fontSize: 13, fontWeight: '700', color: P.ink, marginBottom: 2 },
  cardInf: { fontFamily: 'monospace', fontSize: 11, color: P.muted2 },
  cardInfName: { fontFamily: 'System' },
  cardSet: { fontSize: 10.5, color: P.muted, fontStyle: 'italic', marginTop: 3 },
  cardDate: { fontFamily: 'monospace', fontSize: 10, color: P.muted2 },

  urlRow: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: P.surface2, borderRadius: 8 },
  urlLabel: { fontSize: 9, fontWeight: '700', color: P.muted2, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 },
  urlText: { fontFamily: 'monospace', fontSize: 10.5, color: P.yellowHover },

  actionRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  btnRevise: { backgroundColor: P.surface2, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: P.border },
  btnReviseText: { fontSize: 11, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
  btnApprove: { backgroundColor: P.ink, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8 },
  btnApproveText: { fontSize: 11, fontWeight: '700', color: P.yellow, letterSpacing: 0.2 },
  btnConfirmLive: { backgroundColor: P.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnConfirmLiveText: { fontSize: 11, fontWeight: '700', color: P.white, letterSpacing: 0.2 },
});
