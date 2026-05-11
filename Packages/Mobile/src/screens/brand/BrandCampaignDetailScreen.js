import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function BrandCampaignDetailScreen({ navigation, route }) {
  const { campaignId } = route.params || {};
  const [campaign, setCampaign]   = useState(null);
  const [escrow, setEscrow]       = useState(null);
  const [engagement, setEngagement]   = useState(null);
  const [conversions, setConversions] = useState(null);
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  async function load() {
    setError(null);
    const [campRes, escrowRes, engRes, convRes, prodRes] = await Promise.all([
      brandApi.getCampaign(campaignId),
      brandApi.getCampaignEscrow(campaignId),
      brandApi.getCampaignEngagement(campaignId).catch(() => ({ success: false })),
      brandApi.getCampaignConversions(campaignId).catch(() => ({ success: false })),
      brandApi.getCampaignAllProducts(campaignId).catch(() => ({ success: false })),
    ]);
    setLoading(false);
    if (campRes.success) {
      setCampaign(campRes.data?.campaign);
    } else {
      setError(campRes.error?.message || 'Failed to load campaign');
    }
    if (escrowRes.success) setEscrow(escrowRes.data);
    if (engRes?.success)   setEngagement(engRes.data);
    if (convRes?.success)  setConversions(convRes.data);
    if (prodRes?.success)  setProductsData(prodRes.data);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [campaignId])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [campaignId]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleApproveApplication(ci) {
    setActionLoading(ci.id);
    const res = await brandApi.approveApplication(campaignId, ci.id);
    setActionLoading(null);
    if (!res.success) {
      Alert.alert('Approve failed', res.error?.message || 'Could not approve this application.');
      return;
    }
    const slotsMsg = res.data?.slots_filled
      ? `\n\nSlots are now full — ${res.data.closed_out_count || 0} other applicant${(res.data.closed_out_count || 0) !== 1 ? 's were' : ' was'} notified that the campaign is closed.`
      : '';
    Alert.alert('Approved', `Contract draft sent to @${ci.instagram_handle || 'influencer'}.${slotsMsg}`);
    load();
  }

  async function handleRejectApplication(ci) {
    Alert.alert(
      'Reject application',
      `Reject @${ci.instagram_handle || 'this influencer'}? They'll be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: async () => {
          setActionLoading(ci.id);
          const res = await brandApi.rejectApplication(campaignId, ci.id);
          setActionLoading(null);
          if (!res.success) {
            Alert.alert('Reject failed', res.error?.message || 'Could not reject this application.');
            return;
          }
          load();
        } },
      ]
    );
  }

  async function handleCancelInfluencer(ci) {
    Alert.alert(
      'Cancel Influencer',
      `Remove ${ci.influencer_name || ci.instagram_handle} from this campaign?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(ci.id);
            const res = await brandApi.cancelInfluencer(campaignId, ci.id);
            setActionLoading(null);
            if (res.success) {
              Alert.alert('Done', 'Influencer assignment cancelled.');
              load();
            } else {
              Alert.alert('Error', res.error?.message || 'Failed to cancel');
            }
          },
        },
      ]
    );
  }

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

  async function handleConfirmLive(deliverableId, liveUrl) {
    Alert.alert(
      'Confirm Content Live',
      `Confirm the content is live at:\n${liveUrl}\n\nTranche 2 releases once every deliverable in this contract is confirmed live.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Live', onPress: async () => {
          setActionLoading(deliverableId);
          const res = await brandApi.confirmLive(deliverableId);
          setActionLoading(null);
          if (res.success) {
            const d = res.data || {};
            if (d.t2_released) {
              const amt = typeof d.t2_amount === 'number' ? ` of ₹${d.t2_amount.toFixed(2)}` : '';
              Alert.alert(
                'All Content Live!',
                `Every deliverable in this contract is now live. Tranche 2${amt} has been released to the influencer.`
              );
            } else {
              const live = d.live_count ?? 0;
              const total = d.total_count ?? 0;
              const pending = d.pending_count ?? Math.max(0, total - live);
              Alert.alert(
                'Marked Live',
                `Deliverable confirmed live (${live} of ${total}). ${pending} still pending — Tranche 2 releases once all are confirmed live.`
              );
            }
            load();
          } else {
            Alert.alert('Error', res.error?.message || 'Failed to confirm live');
          }
        }},
      ]
    );
  }

  function promptRevisionFeedback(deliverableId) {
    Alert.prompt
      ? Alert.prompt(
          'Request Revision',
          'Enter feedback for the influencer:',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Submit', onPress: (text) => handleReviewDeliverable(deliverableId, 'request_revision', text) },
          ],
          'plain-text',
          ''
        )
      : handleReviewDeliverable(deliverableId, 'request_revision', 'Please revise the content.');
  }

  // ── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Loading campaign...</Text>
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Campaign not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const sets = campaign.sets || [];

  // Status filtering for the roster:
  //   handpick — show every CI row (brand invited each one individually).
  //   open_group — only show influencers who actually made it through to the
  //     contract pipeline. Hide pre-contract chatter (invited/applied/etc.)
  //     because at scale the broadcast can match hundreds of profiles, and
  //     the brand just cares about who they ended up working with.
  const OPEN_GROUP_HIDDEN = ['invited', 'applied', 'declined', 'rejected_by_brand', 'slots_filled', 'expired'];
  const allInfluencers = sets.flatMap(s => {
    const mode = s.influencer_mode || 'handpick';
    return (s.influencers || [])
      .filter(ci => mode !== 'open_group' || !OPEN_GROUP_HIDDEN.includes(ci.status))
      .map(ci => ({ ...ci, set_name: s.name, set_goal: s.goal, set_mode: mode }));
  });

  // Pending applications across open-group sets — surface inline so the brand
  // can approve/reject without going to the Action Required hub.
  const pendingApplications = sets.flatMap(s => {
    if (s.influencer_mode !== 'open_group') return [];
    return (s.influencers || [])
      .filter(ci => ci.status === 'applied')
      .map(ci => ({ ...ci, set_name: s.name, set_id: s.id, max_cap: s.max_cap }));
  });

  // Per-open-group-set funnel: how many matched, how many applied, how many approved.
  const openGroupFunnels = sets.filter(s => s.influencer_mode === 'open_group').map(s => {
    const all = s.influencers || [];
    return {
      set_id: s.id,
      set_name: s.name,
      max_cap: s.max_cap,
      broadcast: all.length,
      applied: all.filter(ci => ci.status === 'applied').length,
      approved: all.filter(ci => ['accepted','contracted','active','completed'].includes(ci.status)).length,
    };
  });
  const totalBudget = Number(campaign.total_budget) || 0;

  // Calculate allocated from sets or influencer agreed fees
  const allocatedBudget = allInfluencers.reduce((sum, ci) => sum + (Number(ci.agreed_fee) || 0), 0);
  const remainingBudget = Math.max(0, totalBudget - allocatedBudget);
  const budgetProgress = totalBudget > 0 ? Math.min(1, allocatedBudget / totalBudget) : 0;

  // Goal-aware: if every set is 'conversion', campaign has no fee/escrow.
  // (Mixed campaigns with at least one engagement/hybrid set still show
  // budget + tranches.)
  const setGoals          = sets.map(s => (s.goal || '').toLowerCase()).filter(Boolean);
  const hasFeeBearingSet  = setGoals.some(g => g === 'engagement' || g === 'hybrid');
  const isConversionOnly  = setGoals.length > 0 && !hasFeeBearingSet;

  // Collect all deliverables from influencers that need review
  const deliverablesToReview = [];
  // Approved deliverables with a live_url posted — brand still needs to confirm-live
  const liveAwaitingConfirm = [];
  for (const set of sets) {
    for (const ci of (set.influencers || [])) {
      if (ci.deliverables) {
        for (const d of ci.deliverables) {
          if (['submitted', 'under_review'].includes(d.status)) {
            deliverablesToReview.push({ ...d, influencer_name: ci.influencer_name, instagram_handle: ci.instagram_handle });
          }
          if (d.status === 'approved' && d.live_url) {
            liveAwaitingConfirm.push({ ...d, influencer_name: ci.influencer_name, instagram_handle: ci.instagram_handle });
          }
        }
      }
    }
  }

  // Escrow data
  const escrowEntries = escrow?.entries || escrow?.escrow_entries || [];
  const trancheSummary = [1, 2, 3].map(n => {
    const entries = escrowEntries.filter(e => e.tranche_number === n);
    const locked = entries.filter(e => e.status === 'locked').reduce((s, e) => s + Number(e.amount || 0), 0);
    const released = entries.filter(e => e.status === 'released').reduce((s, e) => s + Number(e.amount || 0), 0);
    return { tranche: n, locked, released, total: locked + released };
  });
  const hasEscrowData = escrowEntries.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<-'} Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.campaignNameHeader} numberOfLines={2}>{campaign.name}</Text>
            <View style={styles.headerDates}>
              <Text style={styles.headerDate}>{formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}</Text>
            </View>
          </View>
          <StatusBadge status={campaign.status} size={11} />
        </View>
      </View>

      {/* ── Budget Section (only meaningful when fees are involved) ────── */}
      {isConversionOnly ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Model</Text>
          <View style={[styles.budgetHighlight, { backgroundColor: colors.tealPale }]}>
            <Text style={[styles.budgetLabel, { color: colors.tealDeep }]}>Commission per Conversion</Text>
            <Text style={[styles.budgetValue, { color: colors.tealDeep, fontSize: 18 }]}>
              No upfront fee
            </Text>
          </View>
          <Text style={[styles.briefText, { marginTop: 10 }]}>
            Influencers earn commission only when their tracking link drives a conversion.
            Earnings hold for 30 days, then move to their wallet.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Budget Overview</Text>
          <View style={styles.budgetHighlight}>
            <Text style={styles.budgetLabel}>Total Budget</Text>
            <Text style={styles.budgetValue}>{fmtRupees(totalBudget)}</Text>
          </View>
          <View style={styles.budgetRow}>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetItemLabel}>Allocated</Text>
              <Text style={[styles.budgetItemValue, { color: colors.navy }]}>{fmtRupees(allocatedBudget)}</Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetItemLabel}>Remaining</Text>
              <Text style={[styles.budgetItemValue, { color: colors.tealDeep }]}>{fmtRupees(remainingBudget)}</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.round(budgetProgress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(budgetProgress * 100)}% allocated</Text>
        </View>
      )}

      {/* ── Brief ───────────────────────────────────────────────────────── */}
      {campaign.brief ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign Brief</Text>
          <Text style={styles.briefText}>{campaign.brief}</Text>
        </View>
      ) : null}

      {/* ── Sets Section ────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Campaign Sets ({sets.length})</Text>
        {sets.length === 0 ? (
          <Text style={styles.noDataText}>No sets created yet.</Text>
        ) : (
          sets.map(set => {
            const infCount = (set.influencers || []).length;
            return (
              <View key={set.id} style={styles.setRow}>
                <View style={styles.setHeader}>
                  <Text style={styles.setName}>{set.name}</Text>
                  {set.goal && <StatusBadge status={set.goal} size={9} />}
                </View>
                <View style={styles.setMeta}>
                  {set.window_start && (
                    <Text style={styles.setMetaItem}>{formatDate(set.window_start)} - {formatDate(set.window_end)}</Text>
                  )}
                  <Text style={styles.setMetaItem}>{infCount} influencer{infCount !== 1 ? 's' : ''}</Text>
                  {set.set_budget > 0 && (
                    <Text style={styles.setMetaItem}>Budget: {fmtRupees(set.set_budget)}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Open-group funnel (counts only — broadcast list stays hidden) ── */}
      {openGroupFunnels.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Open Calls</Text>
          {openGroupFunnels.map(f => (
            <View key={f.set_id} style={styles.funnelRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.funnelSetName}>{f.set_name || 'Set'}</Text>
                <Text style={styles.funnelMeta}>
                  Broadcast to {f.broadcast} · {f.applied} applied · {f.approved}/{f.max_cap || '—'} approved
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Applications waiting on brand approval ─────────────────────── */}
      {pendingApplications.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Applications ({pendingApplications.length})</Text>
          <Text style={styles.noDataText}>Tap to view full profile, then approve or reject.</Text>
          {pendingApplications.map(ci => {
            const isBusy = actionLoading === ci.id;
            return (
              <View key={ci.id} style={styles.applicationRow}>
                <TouchableOpacity
                  onPress={() => {
                    if (ci.influencer_id) navigation.navigate('BrandInfluencerProfile', { influencerId: ci.influencer_id });
                  }}
                  style={{ flex: 1 }}
                >
                  <Text style={styles.applicationName}>
                    {ci.influencer_name || 'Influencer'} <Text style={styles.applicationHandle}>@{ci.instagram_handle || '—'}</Text>
                  </Text>
                  <Text style={styles.applicationMeta}>
                    {ci.set_name}{ci.influencer_budget != null ? ` · ${fmtRupees(ci.influencer_budget)}` : ''}
                  </Text>
                  <Text style={styles.applicationLink}>View profile →</Text>
                </TouchableOpacity>
                <View style={styles.applicationActions}>
                  <TouchableOpacity
                    style={[styles.appRejectBtn, isBusy && { opacity: 0.4 }]}
                    onPress={() => handleRejectApplication(ci)}
                    disabled={isBusy}
                  >
                    <Text style={styles.appRejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.appApproveBtn, isBusy && { opacity: 0.4 }]}
                    onPress={() => handleApproveApplication(ci)}
                    disabled={isBusy}
                  >
                    <Text style={styles.appApproveText}>{isBusy ? '…' : 'Approve'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Influencers Section ─────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Influencers ({allInfluencers.length})</Text>
        {allInfluencers.length === 0 ? (
          <Text style={styles.noDataText}>
            {openGroupFunnels.length > 0
              ? 'No influencers shortlisted yet. Review applications above.'
              : 'No influencers assigned yet.'}
          </Text>
        ) : (
          allInfluencers.map(ci => {
            const CANCELLABLE = ['invited', 'accepted', 'negotiating'];
            const canCancel = CANCELLABLE.includes(ci.status);
            const isCancelling = actionLoading === ci.id;

            // Deliverable counts — backend K.1 returns ci.deliverable_counts.
            // Fallback keeps any stale bundle working.
            const dc = ci.deliverable_counts || { total: 0, live: 0, approved: 0, submitted: 0, under_review: 0, revision_requested: 0, pending: 0 };
            const totalDel     = dc.total;
            const completedDel = (dc.live || 0) + (dc.approved || 0);

            // Per-row goal awareness — derived from the parent set's goal
            const rowGoal        = (ci.set_goal || 'engagement').toLowerCase();
            const rowShowFee     = rowGoal === 'engagement' || rowGoal === 'hybrid';
            const rowShowComm    = rowGoal === 'conversion' || rowGoal === 'hybrid';
            const rowShowTr      = rowGoal === 'engagement' || rowGoal === 'hybrid';
            const tr             = ci.tranche_statuses || { t1: null, t2: null, t3: null };

            function trancheMark(status) {
              if (status === 'released') return { char: '\u2713', color: colors.teal };    // ✓
              if (status === 'locked')   return { char: '\u25CB', color: colors.navy };    // ○
              if (status === 'queued')   return { char: '\u25D0', color: colors.orange };  // ◐
              return { char: '\u2014', color: colors.t3 };                                  // —
            }
            const t1Mark = trancheMark(tr.t1);
            const t2Mark = trancheMark(tr.t2);
            const t3Mark = trancheMark(tr.t3);

            return (
              <View key={ci.id} style={styles.influencerRow}>
                <View style={styles.influencerInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.influencerName}>{ci.influencer_name || 'Influencer'}</Text>
                    <Text style={styles.influencerHandle}>@{ci.instagram_handle || '--'}</Text>
                    {ci.set_name && (
                      <Text style={styles.influencerSet}>{ci.set_name}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge status={ci.status} size={9} />
                    {rowShowFee && ci.agreed_fee > 0 && (
                      <Text style={styles.influencerFee}>{fmtRupees(ci.agreed_fee)}</Text>
                    )}
                    {rowShowComm && ci.commission_pct > 0 && (
                      <Text style={[styles.influencerFee, { color: colors.tealDeep }]}>{parseFloat(ci.commission_pct)}% comm.</Text>
                    )}
                  </View>
                </View>

                {/* Deliverable progress — shown whenever any deliverables
                    exist for this contract. Progress bar uses live+approved
                    count over total; detail text spells out the states. */}
                {totalDel > 0 && (
                  <View style={styles.deliverableProgress}>
                    <View style={styles.delProgressBarBg}>
                      <View style={[styles.delProgressBarFill, { width: `${Math.round((completedDel / totalDel) * 100)}%` }]} />
                    </View>
                    <Text style={styles.delProgressText}>
                      {completedDel}/{totalDel} deliverables
                      {dc.submitted + dc.under_review > 0 ? ` · ${dc.submitted + dc.under_review} awaiting review` : ''}
                      {dc.revision_requested > 0 ? ` · ${dc.revision_requested} in revision` : ''}
                    </Text>
                  </View>
                )}

                {/* Tranche status row — engagement / hybrid only. Conversion
                    contracts have no tranches and this row stays hidden. */}
                {rowShowTr && (
                  <View style={styles.trancheRow}>
                    <Text style={[styles.trancheCell, { color: t1Mark.color }]}>{t1Mark.char} T1</Text>
                    <Text style={[styles.trancheCell, { color: t2Mark.color }]}>{t2Mark.char} T2</Text>
                    <Text style={[styles.trancheCell, { color: t3Mark.color }]}>{t3Mark.char} T3</Text>
                  </View>
                )}

                {/* Transaction count — conversion / hybrid only. */}
                {(rowGoal === 'conversion' || rowGoal === 'hybrid') && ci.transaction_count != null && (
                  <Text style={styles.infoLine}>{ci.transaction_count} transaction{ci.transaction_count === 1 ? '' : 's'} driven</Text>
                )}

                <View style={styles.influencerActions}>
                  {canCancel && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancelInfluencer(ci)}
                      disabled={isCancelling}
                    >
                      {isCancelling
                        ? <ActivityIndicator size="small" color={colors.red} />
                        : <Text style={styles.cancelBtnText}>Cancel</Text>
                      }
                    </TouchableOpacity>
                  )}
                  {/* Contract button — all goals flow through the contract
                      state machine. The screen itself is goal-aware and hides
                      the tranche schedule for commission-only conversion. */}
                  {(ci.status === 'accepted' || ci.status === 'contracted' || ci.status === 'active') && (
                    <TouchableOpacity
                      style={[styles.negotiateBtn, { backgroundColor: colors.tealPale }]}
                      onPress={() => navigation.navigate('BrandContract', {
                        campaignInfluencerId: ci.id,
                        influencerName: ci.influencer_name,
                        goal: ci.set_goal,
                      })}
                    >
                      <Text style={[styles.negotiateBtnText, { color: colors.tealDeep }]}>Contract</Text>
                    </TouchableOpacity>
                  )}
                  {ci.status === 'negotiating' && (
                    <TouchableOpacity
                      style={styles.negotiateBtn}
                      onPress={() => navigation.navigate('BrandNegotiation', {
                        negotiationId: ci.negotiation_id,
                        campaignInfluencerId: ci.id,
                        influencerName: ci.influencer_name || ci.full_name,
                        influencerHandle: ci.instagram_handle,
                      })}
                    >
                      <Text style={styles.negotiateBtnText}>Open Chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Analytics Summary (engagement metrics across deliverables) ────
          G.5: mirrors the brand-web Analytics rework — honest metrics
          only. Likes + comments land reliably from Apify; Views is the
          video-view count on reels (stored in the impressions column).
          Reach / saves / shares aren't fetchable from public scraping
          so we don't show them. */}
      {(() => {
        const totals = engagement?.totals || {};
        const likes    = totals.total_likes;
        const comments = totals.total_comments;
        const views    = totals.total_views;
        const er       = totals.avg_er;
        if (likes == null && comments == null && views == null && er == null) return null;
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Analytics</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <View style={[styles.summaryStat, { backgroundColor: colors.navyPale }]}>
                <Text style={styles.summaryStatLabel}>Likes</Text>
                <Text style={styles.summaryStatValue}>{likes != null ? Number(likes).toLocaleString('en-IN') : '—'}</Text>
              </View>
              <View style={[styles.summaryStat, { backgroundColor: colors.tealPale }]}>
                <Text style={[styles.summaryStatLabel, { color: colors.tealDeep }]}>Comments</Text>
                <Text style={[styles.summaryStatValue, { color: colors.tealDeep }]}>{comments != null ? Number(comments).toLocaleString('en-IN') : '—'}</Text>
              </View>
              {views > 0 && (
                <View style={[styles.summaryStat, { backgroundColor: colors.navyPale }]}>
                  <Text style={styles.summaryStatLabel}>Views</Text>
                  <Text style={styles.summaryStatValue}>{Number(views).toLocaleString('en-IN')}</Text>
                </View>
              )}
              <View style={[styles.summaryStat, { backgroundColor: colors.orangePale }]}>
                <Text style={[styles.summaryStatLabel, { color: colors.orange }]}>Avg ER</Text>
                <Text style={[styles.summaryStatValue, { color: colors.orange }]}>{er != null ? `${Number(er).toFixed(1)}%` : '—'}</Text>
              </View>
            </View>
            {(engagement?.by_influencer || []).length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.headerDate, { color: colors.t3, marginBottom: 6 }]}>Per Influencer</Text>
                {engagement.by_influencer.map(inf => (
                  <View key={inf.influencer_id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomColor: colors.borderLight || '#F0F0F0', borderBottomWidth: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.navy, flex: 1 }} numberOfLines={1}>
                      {inf.handle || `@${inf.instagram_handle || ''}`}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.t3 }}>
                      {Number(inf.likes || 0).toLocaleString('en-IN')} likes · {Number(inf.comments || 0).toLocaleString('en-IN')} cmts{inf.views > 0 ? ` · ${Number(inf.views).toLocaleString('en-IN')} views` : ''} · {(inf.engagement_rate || 0).toFixed(2)}% ER
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={[styles.headerDate, { color: colors.t3, marginTop: 10, fontSize: 10, lineHeight: 14 }]}>
              Reach & saves aren't shown — they need the influencer's Instagram Business API to be connected.
            </Text>
          </View>
        );
      })()}

      {/* ── Conversions Summary (conversion / hybrid only) ─────────────── */}
      {!isConversionOnly === false || sets.some(s => ['conversion','hybrid'].includes((s.goal||'').toLowerCase())) ? (() => {
        const summary = conversions?.summary || {};
        const txCount      = conversions?.total_transactions ?? summary.total_transactions ?? null;
        const txRevenue    = conversions?.total_revenue      ?? summary.total_revenue      ?? null;
        const txCommission = conversions?.total_commission   ?? summary.total_commission   ?? null;
        if (txCount == null && txRevenue == null) return null;
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Conversions</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.summaryStat, { backgroundColor: colors.navyPale }]}>
                <Text style={styles.summaryStatLabel}>Transactions</Text>
                <Text style={styles.summaryStatValue}>{txCount != null ? Number(txCount).toLocaleString('en-IN') : '—'}</Text>
              </View>
              <View style={[styles.summaryStat, { backgroundColor: colors.tealPale }]}>
                <Text style={[styles.summaryStatLabel, { color: colors.tealDeep }]}>Revenue</Text>
                <Text style={[styles.summaryStatValue, { color: colors.tealDeep }]}>{txRevenue != null ? fmtMoney(txRevenue) : '—'}</Text>
              </View>
              <View style={[styles.summaryStat, { backgroundColor: colors.orangePale }]}>
                <Text style={[styles.summaryStatLabel, { color: colors.orange }]}>Commission Paid</Text>
                <Text style={[styles.summaryStatValue, { color: colors.orange }]}>{txCommission != null ? fmtMoney(txCommission) : '—'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ marginTop: 12, backgroundColor: colors.navy, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
              onPress={() => navigation.navigate('BrandConversions', { campaignId, campaignName: campaign?.name || campaign?.campaign_name })}
            >
              <Text style={{ color: colors.white, fontWeight: '800', fontSize: 12 }}>View every transaction ›</Text>
            </TouchableOpacity>
          </View>
        );
      })() : null}

      {/* ── Products Summary (conversion / hybrid only) ────────────────── */}
      {productsData && productsData.products && productsData.products.length > 0 &&
       sets.some(s => ['conversion','hybrid'].includes((s.goal||'').toLowerCase())) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Products in Offer ({productsData.summary?.total_products ?? productsData.products.length})
          </Text>
          {productsData.is_brand_level_offer && (
            <Text style={[styles.headerDate, { color: colors.t3, marginBottom: 10 }]}>
              Brand-level offer — every influencer promotes the entire catalogue.
            </Text>
          )}
          {productsData.products.slice(0, 5).map((p, i) => (
            <View key={p.id || i} style={styles.productRow}>
              <View style={styles.productDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.productSection}>{p.section || 'General'} · {fmtRupees(p.price)}</Text>
                {(p.assigned_to_influencers || []).length > 0 && (
                  <Text style={styles.productAssigned} numberOfLines={1}>
                    Assigned to: {p.assigned_to_influencers.map(a => '@' + (a.handle || a.name)).join(', ')}
                  </Text>
                )}
              </View>
            </View>
          ))}
          {productsData.products.length > 5 && (
            <Text style={[styles.headerDate, { color: colors.t3, marginTop: 6, textAlign: 'center' }]}>
              + {productsData.products.length - 5} more — open web dashboard for full list
            </Text>
          )}
        </View>
      )}

      {/* ── Escrow Section ──────────────────────────────────────────────── */}
      {/* Conversion-only campaigns have no fee → no escrow tranches.
          Only show this card when the campaign actually has fee-bearing sets. */}
      {!isConversionOnly && hasEscrowData && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Escrow Overview</Text>
          {trancheSummary.map(t => {
            const label = t.tranche === 1 ? 'T1 - Contract Signed (25%)'
              : t.tranche === 2 ? 'T2 - Content Live (25%)'
              : 'T3 - 30 Days Post Live (50%)';
            return (
              <View key={t.tranche} style={styles.escrowRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.escrowLabel}>{label}</Text>
                  <View style={styles.escrowAmounts}>
                    <View style={styles.escrowAmountItem}>
                      <View style={[styles.escrowDot, { backgroundColor: colors.navy }]} />
                      <Text style={styles.escrowAmountText}>Locked: {fmtMoney(t.locked)}</Text>
                    </View>
                    <View style={styles.escrowAmountItem}>
                      <View style={[styles.escrowDot, { backgroundColor: colors.teal }]} />
                      <Text style={styles.escrowAmountText}>Released: {fmtMoney(t.released)}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.escrowTotal}>{fmtMoney(t.total)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Deliverables Awaiting Review ────────────────────────────────── */}
      {deliverablesToReview.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Content Awaiting Review ({deliverablesToReview.length})</Text>
          {deliverablesToReview.map(d => {
            const isReviewing = actionLoading === d.id;
            return (
              <View key={d.id} style={styles.reviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewType}>
                    {DELIVERABLE_LABELS[d.type] || d.type}
                  </Text>
                  <Text style={styles.reviewInfluencer}>@{d.instagram_handle} - {d.influencer_name}</Text>
                  {d.submitted_at && (
                    <Text style={styles.reviewDate}>Submitted: {formatDate(d.submitted_at)}</Text>
                  )}
                  {d.content_url && (
                    <Text style={styles.reviewUrl} numberOfLines={1}>{d.content_url}</Text>
                  )}
                </View>
                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleReviewDeliverable(d.id, 'approve')}
                    disabled={isReviewing}
                  >
                    {isReviewing
                      ? <ActivityIndicator size="small" color={colors.white} />
                      : <Text style={styles.approveBtnText}>Approve</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.revisionBtn}
                    onPress={() => promptRevisionFeedback(d.id)}
                    disabled={isReviewing}
                  >
                    <Text style={styles.revisionBtnText}>Revise</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Live URLs awaiting brand confirmation (releases T2 escrow) ──── */}
      {liveAwaitingConfirm.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Confirm Content Live ({liveAwaitingConfirm.length})</Text>
          <Text style={[styles.headerDate, { color: colors.t3, marginBottom: 8 }]}>
            Influencer posted live URLs. Confirm every deliverable below — Tranche 2 releases once all are live.
          </Text>
          {liveAwaitingConfirm.map(d => {
            const isConfirming = actionLoading === d.id;
            return (
              <View key={d.id} style={styles.reviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewType}>
                    {DELIVERABLE_LABELS[d.type] || d.type}
                  </Text>
                  <Text style={styles.reviewInfluencer}>@{d.instagram_handle} - {d.influencer_name}</Text>
                  <Text style={styles.reviewUrl} numberOfLines={1}>{d.live_url}</Text>
                </View>
                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    style={[styles.approveBtn, { backgroundColor: colors.tealDeep }]}
                    onPress={() => handleConfirmLive(d.id, d.live_url)}
                    disabled={isConfirming}
                  >
                    {isConfirming
                      ? <ActivityIndicator size="small" color={colors.white} />
                      : <Text style={styles.approveBtnText}>Confirm Live</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Web Dashboard Link ──────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.webLink}
        onPress={() => {
          const { openWebDashboard } = require('../../utils/openWebDashboard');
          openWebDashboard(`/dashboard/campaigns/${campaignId}`);
        }}
      >
        <Text style={styles.webLinkIcon}>{'[W]'}</Text>
        <Text style={styles.webLinkText}>Full details on web dashboard</Text>
        <Text style={styles.webLinkArrow}>{'>'}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },
  errorText: { fontSize: 14, color: colors.red, marginBottom: 16, textAlign: 'center', paddingHorizontal: 32 },

  // Header
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  campaignNameHeader: { fontSize: 20, fontWeight: '800', color: colors.white },
  headerDates: { marginTop: 4 },
  headerDate: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

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

  // Budget
  budgetHighlight: {
    backgroundColor: colors.navyPale,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 10, fontWeight: '700', color: colors.navy,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  budgetValue: { fontSize: 28, fontWeight: '800', color: colors.navyDeep },
  budgetRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  budgetItem: { flex: 1, alignItems: 'center' },
  budgetItemLabel: {
    fontSize: 10, fontWeight: '700', color: colors.t3,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  budgetItemValue: { fontSize: 16, fontWeight: '800' },
  progressBarBg: {
    height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: {
    height: 6, backgroundColor: colors.navy, borderRadius: 3,
  },
  progressText: { fontSize: 10, color: colors.t3, marginTop: 4, textAlign: 'right' },

  // Brief
  briefText: { fontSize: 13, color: colors.t2, lineHeight: 20 },

  // Sets
  setRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  setName: { fontSize: 14, fontWeight: '700', color: colors.t1, flex: 1, marginRight: 8 },
  setMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  setMetaItem: { fontSize: 11, color: colors.t3 },

  // Influencers
  influencerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  influencerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  influencerName: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  influencerHandle: { fontSize: 12, color: colors.t3, marginTop: 2 },
  influencerSet: { fontSize: 10, color: colors.t3, marginTop: 2, fontStyle: 'italic' },
  influencerFee: { fontSize: 13, fontWeight: '700', color: colors.tealDeep },
  deliverableProgress: { marginTop: 8 },
  delProgressBarBg: {
    height: 4, backgroundColor: colors.surface2, borderRadius: 2, overflow: 'hidden',
  },
  delProgressBarFill: {
    height: 4, backgroundColor: colors.teal, borderRadius: 2,
  },
  delProgressText: { fontSize: 10, color: colors.t3, marginTop: 2 },
  trancheRow:  { flexDirection: 'row', gap: 12, marginTop: 6 },
  trancheCell: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  infoLine:    { fontSize: 11, color: colors.t2, marginTop: 4 },
  influencerActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cancelBtn: {
    backgroundColor: colors.redPale,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  cancelBtnText: { fontSize: 12, fontWeight: '700', color: colors.red },
  negotiateBtn: {
    backgroundColor: colors.orangePale,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  negotiateBtnText: { fontSize: 12, fontWeight: '700', color: colors.orangeDeep },

  // Escrow
  escrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  escrowLabel: { fontSize: 12, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  escrowAmounts: { flexDirection: 'row', gap: 12 },
  escrowAmountItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  escrowDot: { width: 8, height: 8, borderRadius: 4 },
  escrowAmountText: { fontSize: 11, color: colors.t3 },
  escrowTotal: { fontSize: 14, fontWeight: '800', color: colors.t1 },

  // Review
  reviewRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewType: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  reviewInfluencer: { fontSize: 11, color: colors.t3, marginTop: 2 },
  reviewDate: { fontSize: 10, color: colors.t3, marginTop: 2 },
  reviewUrl: { fontSize: 10, color: colors.navy, marginTop: 2 },
  reviewActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: {
    backgroundColor: colors.teal,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  approveBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  revisionBtn: {
    backgroundColor: colors.orangePale,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  revisionBtnText: { fontSize: 12, fontWeight: '700', color: colors.orangeDeep },

  // Web link
  webLink: {
    margin: 16,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webLinkIcon: { fontSize: 14, fontWeight: '700', color: colors.navy },
  webLinkText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.navy },
  webLinkArrow: { fontSize: 18, color: colors.t3 },

  // Summary stat boxes (Analytics + Conversions cards)
  summaryStat: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  summaryStatLabel: { fontSize: 9, fontWeight: '800', color: colors.navy, letterSpacing: 0.4, marginBottom: 4 },
  summaryStatValue: { fontSize: 16, fontWeight: '800', color: colors.navy },

  // Product row (Products card)
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  productDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.navy },
  productName: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  productSection: { fontSize: 11, color: colors.t3, marginTop: 2 },
  productAssigned: { fontSize: 10, color: colors.tealDeep, marginTop: 2, fontStyle: 'italic' },

  // Back button (error state)
  backBtn: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  noDataText: { fontSize: 13, color: colors.t3, lineHeight: 18 },

  funnelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  funnelSetName: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  funnelMeta: { fontSize: 11, color: colors.t3, marginTop: 2 },

  applicationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  applicationName: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  applicationHandle: { fontSize: 12, color: colors.t3, fontWeight: '500' },
  applicationMeta: { fontSize: 11, color: colors.t3, marginTop: 2 },
  applicationLink: { fontSize: 11, fontWeight: '700', color: colors.navy, marginTop: 4 },
  applicationActions: { flexDirection: 'column', gap: 6, alignItems: 'flex-end' },
  appApproveBtn: { backgroundColor: colors.navy, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  appApproveText: { fontSize: 11, fontWeight: '700', color: colors.white },
  appRejectBtn: { backgroundColor: colors.redPale, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: colors.red },
  appRejectText: { fontSize: 11, fontWeight: '700', color: colors.red },
});
