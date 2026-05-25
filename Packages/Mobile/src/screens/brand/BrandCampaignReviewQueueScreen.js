import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import ScreenHeader from '../../components/brand/ScreenHeader';
import EmptyState from '../../components/brand/EmptyState';

/**
 * BrandCampaignReviewQueueScreen — content review + confirm-live queues
 * for a single campaign. 2-tab switcher (To review / Confirm live).
 *
 * Flow 22 (2026-05-25): drop inline P; consume brandPalette + ScreenHeader
 * + EmptyState. Outfit/PJS/JetBrains-Mono fonts. Behavior preserved 1:1
 * (tranche-2 release alert variants, Alert.prompt fallback, hint banner).
 */

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
  const [tab, setTab]             = useState(initialTab || 'reviews');
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
    return (
      <View style={s.container}>
        <ScreenHeader title="Review queue" back onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={P.yellow} size="large" /></View>
      </View>
    );
  }
  if (!campaign) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Review queue" back onBack={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.errorText}>Campaign not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.goBackBtn}>
            <Text style={s.goBackBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const sets = campaign.sets || [];
  const reviewQueue = [];
  const liveQueue   = [];
  for (const set of sets) {
    for (const ci of (set.influencers || [])) {
      for (const d of (ci.deliverables || [])) {
        const enriched = { ...d, influencer_name: ci.influencer_name, instagram_handle: ci.instagram_handle, set_name: set.name };
        if (d.status === 'submitted' || d.status === 'under_review') reviewQueue.push(enriched);
        if (d.status === 'approved' && d.live_url) liveQueue.push(enriched);
      }
    }
  }

  const currentQueue = tab === 'reviews' ? reviewQueue : liveQueue;

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Review queue"
        sub={`← ${campaign.name || 'Campaign'}`}
        back onBack={() => navigation.goBack()}
      />

      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, tab === 'reviews' && s.tabActive]}
          onPress={() => setTab('reviews')}
          activeOpacity={0.85}
        >
          <Text style={[s.tabText, tab === 'reviews' && s.tabTextActive]}>To review</Text>
          <Text style={[s.tabCount, tab === 'reviews' && s.tabCountActive]}>{reviewQueue.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'live' && s.tabActive]}
          onPress={() => setTab('live')}
          activeOpacity={0.85}
        >
          <Text style={[s.tabText, tab === 'live' && s.tabTextActive]}>Confirm live</Text>
          <Text style={[s.tabCount, tab === 'live' && s.tabCountActive]}>{liveQueue.length}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.yellow} colors={[P.yellow]} />}
      >
        {tab === 'live' && liveQueue.length > 0 && (
          <View style={s.hint}>
            <View style={s.hintIcon}><Text style={s.hintIconGlyph}>!</Text></View>
            <Text style={s.hintText}>
              Influencers posted live URLs. Confirm every deliverable — <Text style={s.hintTextV}>Tranche 2 releases</Text> once all are live.
            </Text>
          </View>
        )}

        {currentQueue.length === 0 ? (
          <EmptyState
            icon="[✓]"
            title={tab === 'reviews' ? 'No content awaiting review' : 'No live URLs awaiting confirmation'}
            sub="You're all caught up."
          />
        ) : (
          currentQueue.map(d => {
            const isBusy = actionLoading === d.id;
            return (
              <View key={d.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.cardType}>{DELIVERABLE_LABELS[d.type] || d.type}</Text>
                    <Text style={s.cardInf}>
                      @{d.instagram_handle || '—'} <Text style={s.cardInfName}>· {d.influencer_name || 'Influencer'}</Text>
                    </Text>
                    {d.set_name ? <Text style={s.cardSet}>{d.set_name}</Text> : null}
                  </View>
                  {tab === 'reviews' && d.submitted_at && (
                    <Text style={s.cardDate}>{formatDate(d.submitted_at)}</Text>
                  )}
                </View>

                {(tab === 'reviews' && d.content_url) || (tab === 'live' && d.live_url) ? (
                  <View style={s.urlRow}>
                    <Text style={s.urlLabel}>{tab === 'live' ? 'Live URL' : 'Content URL'}</Text>
                    <Text style={s.urlText} numberOfLines={1}>{tab === 'live' ? d.live_url : d.content_url}</Text>
                  </View>
                ) : null}

                <View style={s.actionRow}>
                  {tab === 'reviews' ? (
                    <>
                      <TouchableOpacity
                        style={[s.btnRevise, isBusy && { opacity: 0.4 }]}
                        onPress={() => promptRevisionFeedback(d.id)}
                        disabled={isBusy}
                      >
                        <Text style={s.btnReviseText}>Revise</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btnApprove, isBusy && { opacity: 0.4 }]}
                        onPress={() => handleReviewDeliverable(d.id, 'approve')}
                        disabled={isBusy}
                      >
                        {isBusy ? <ActivityIndicator size="small" color={P.yellow} /> : <Text style={s.btnApproveText}>Approve</Text>}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[s.btnConfirmLive, isBusy && { opacity: 0.4 }]}
                      onPress={() => handleConfirmLive(d.id, d.live_url)}
                      disabled={isBusy}
                    >
                      {isBusy ? <ActivityIndicator size="small" color={P.white} /> : <Text style={s.btnConfirmLiveText}>Confirm live</Text>}
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontFamily: fonts.sansBold, fontSize: 13, color: P.dangerText, marginBottom: 16, textAlign: 'center' },
  goBackBtn: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: P.yellow, borderRadius: 10 },
  goBackBtnText: { fontFamily: fonts.sansBold, fontSize: 13, fontWeight: '700', color: P.ink },

  tabBar: { flexDirection: 'row', backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border, paddingHorizontal: 14, gap: 14, paddingTop: 8, paddingBottom: 0 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: P.yellow },
  tabText: { fontFamily: fonts.sansBold, fontSize: 12.5, fontWeight: '600', color: P.muted2 },
  tabTextActive: { color: P.ink, fontWeight: '700' },
  tabCount: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '700', color: P.muted3, backgroundColor: P.bg2, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99 },
  tabCountActive: { color: P.ink, backgroundColor: P.yellowPale },

  list: { padding: 14, gap: 8 },

  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: P.yellowPale, borderRadius: 10, padding: 11, borderLeftWidth: 3, borderLeftColor: P.yellow, marginBottom: 4 },
  hintIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  hintIconGlyph: { fontFamily: fonts.displayBold, fontSize: 12, fontWeight: '800', color: P.yellow },
  hintText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.ink2, lineHeight: 16 },
  hintTextV: { fontFamily: fonts.sansBold, fontWeight: '700', color: P.ink },

  card: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 14, padding: 12, gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardType: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '700', color: P.ink, marginBottom: 2 },
  cardInf: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2 },
  cardInfName: { fontFamily: fonts.sansMedium, color: P.muted2 },
  cardSet: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: P.muted, fontStyle: 'italic', marginTop: 3 },
  cardDate: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2 },

  urlRow: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: P.bg2, borderRadius: 8 },
  urlLabel: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '700', color: P.muted2, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 },
  urlText: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.yellowHover },

  actionRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  btnRevise: { backgroundColor: P.bg2, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: P.border },
  btnReviseText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
  btnApprove: { backgroundColor: P.ink, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8 },
  btnApproveText: { fontFamily: fonts.monoBold, fontSize: 11, fontWeight: '700', color: P.yellow, letterSpacing: 0.2 },
  btnConfirmLive: { backgroundColor: P.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnConfirmLiveText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.white, letterSpacing: 0.2 },
});
