import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
// Stage 3 — level 3 of the ladder. Every creator row carries the step she is on and
// whose turn it is, from the server, so her phone and this one cannot disagree.
// Contract: features/stage-3-watch-the-work-happen
import { useNeedsYou, creatorNode, setNode, badgeFor } from '../../utils/brandNeedsYou';
import { NeedBadge, StepBars, OwedItems, StaleNote, STEP_LABELS, turnLabel, turnTone } from '../../components/brand/NeedsYou';
import ScreenHeader from '../../components/brand/ScreenHeader';
import StatusPill from '../../components/brand/StatusPill';
import EmptyState from '../../components/brand/EmptyState';

/**
 * BrandCampaignInfluencersListScreen — per-campaign influencer roster with
 * search, set + status filter chip strips, deliverable progress, tranche
 * dots, and multi-state action buttons (approve/reject/cancel/chat/contract).
 *
 * Flow 22 (2026-05-25): drop inline P + STATUS_CFG; consume brandPalette +
 * ScreenHeader + StatusPill (canonical map extended with applied/negotiating/
 * contracted/active/invited/rejected_by_brand/slots_filled) + EmptyState.
 * Behavior preserved 1:1.
 */

const CANCELLABLE = new Set(['invited', 'accepted', 'negotiating']);
const OPEN_GROUP_HIDDEN = new Set(['invited', 'declined', 'rejected_by_brand', 'slots_filled', 'expired']);

export default function BrandCampaignInfluencersListScreen({ navigation, route }) {
  const { campaignId, statusFilter: initialStatusFilter } = route.params || {};
  const { tree, failed: needsFailed } = useNeedsYou();
  const [campaign, setCampaign]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [setFilter, setSetFilter]       = useState('all');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'all');
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

  function handleRejectApplication(ci) {
    Alert.alert(
      'Reject application',
      `Reject @${ci.instagram_handle || 'this influencer'}? They'll be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: async () => {
          setActionLoading(ci.id);
          const res = await brandApi.rejectApplication(campaignId, ci.id);
          setActionLoading(null);
          if (!res.success) { Alert.alert('Reject failed', res.error?.message || 'Could not reject.'); return; }
          load();
        } },
      ]
    );
  }

  function handleCancelInfluencer(ci) {
    Alert.alert(
      'Cancel influencer',
      `Remove ${ci.influencer_name || ci.instagram_handle} from this campaign?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, cancel', style: 'destructive', onPress: async () => {
          setActionLoading(ci.id);
          const res = await brandApi.cancelInfluencer(campaignId, ci.id);
          setActionLoading(null);
          if (res.success) { Alert.alert('Done', 'Influencer assignment cancelled.'); load(); }
          else Alert.alert('Error', res.error?.message || 'Failed to cancel');
        } },
      ]
    );
  }

  if (loading) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Influencers" back onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={P.ink} size="large" /></View>
      </View>
    );
  }
  if (!campaign) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Influencers" back onBack={() => navigation.goBack()} />
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
  const allInfluencers = sets.flatMap(set => {
    const mode = set.influencer_mode || 'handpick';
    return (set.influencers || [])
      .filter(ci => mode !== 'open_group' || ci.status === 'applied' || !OPEN_GROUP_HIDDEN.has(ci.status))
      .map(ci => ({ ...ci, set_name: set.name, set_id: set.id, set_goal: set.goal, set_mode: mode }));
  });

  const setOptions = useMemo(() => {
    const opts = [{ id: 'all', label: 'All', count: allInfluencers.length }];
    for (const set of sets) {
      const count = (set.influencers || []).filter(ci => set.influencer_mode !== 'open_group' || ci.status === 'applied' || !OPEN_GROUP_HIDDEN.has(ci.status)).length;
      opts.push({ id: set.id, label: set.name || 'Set', count });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign]);

  const statusOptions = useMemo(() => {
    const counts = { all: allInfluencers.length };
    for (const ci of allInfluencers) counts[ci.status] = (counts[ci.status] || 0) + 1;
    const labels = {
      applied: 'Applied', invited: 'Invited', negotiating: 'Negotiating',
      accepted: 'Accepted', contracted: 'Contracted', active: 'Active',
      live: 'Live', completed: 'Completed', declined: 'Declined',
      rejected_by_brand: 'Rejected', expired: 'Expired', slots_filled: 'Slots filled',
    };
    const orderPref = ['all', 'applied', 'invited', 'negotiating', 'accepted', 'contracted', 'active', 'live', 'completed', 'declined', 'rejected_by_brand', 'expired', 'slots_filled'];
    return orderPref
      .filter(st => st === 'all' || (counts[st] || 0) > 0)
      .map(st => ({ id: st, label: st === 'all' ? 'All' : (labels[st] || st.replace(/_/g, ' ')), count: counts[st] || 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = allInfluencers;
    if (setFilter !== 'all') arr = arr.filter(ci => ci.set_id === setFilter);
    if (statusFilter !== 'all') arr = arr.filter(ci => ci.status === statusFilter);
    if (q) arr = arr.filter(ci =>
      (ci.influencer_name || '').toLowerCase().includes(q) ||
      (ci.instagram_handle || '').toLowerCase().includes(q)
    );
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, setFilter, statusFilter, search]);

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Influencers"
        sub={`← ${campaign.name || 'Campaign'}`}
        back onBack={() => navigation.goBack()}
        count={filtered.length}
        countLabel={`of ${allInfluencers.length}`}
      />

      <View style={s.searchRow}>
        <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or @handle"
            placeholderTextColor={P.muted3}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={s.searchClear}>
              <Text style={s.searchClearText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {setOptions.length > 1 && (
        <>
          <Text style={s.filterLabel}>Set</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={s.chipRowInner}>
            {setOptions.map(opt => {
              const isActive = setFilter === opt.id;
              return (
                <TouchableOpacity key={opt.id} style={[s.chip, isActive && s.chipActive]} onPress={() => setSetFilter(opt.id)} activeOpacity={0.7}>
                  <Text style={[s.chipText, isActive && s.chipTextActive]} numberOfLines={1}>{opt.label}</Text>
                  <Text style={[s.chipCount, isActive && s.chipCountActive]}>{opt.count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={s.filterLabel}>Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={s.chipRowInner}>
        {statusOptions.map(opt => {
          const isActive = statusFilter === opt.id;
          return (
            <TouchableOpacity key={opt.id} style={[s.chip, isActive && s.chipActive]} onPress={() => setStatusFilter(opt.id)} activeOpacity={0.7}>
              <Text style={[s.chipText, isActive && s.chipTextActive]}>{opt.label}</Text>
              <Text style={[s.chipCount, isActive && s.chipCountActive]}>{opt.count}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} colors={[P.ink]} />}
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="[NONE]"
            title={search || setFilter !== 'all' || statusFilter !== 'all' ? 'No influencers match your filters' : 'No influencers yet'}
            sub="Influencers appear here once they apply, are invited, or move through the campaign."
          />
        ) : (
          filtered.map(ci => {
            const goal = (ci.set_goal || 'engagement').toLowerCase();
            const showFee = goal === 'engagement' || goal === 'hybrid';
            const showComm = goal === 'conversion' || goal === 'hybrid';
            const showTr = goal === 'engagement' || goal === 'hybrid';
            const dc = ci.deliverable_counts || { total: 0, live: 0, approved: 0, submitted: 0, under_review: 0, revision_requested: 0 };
            const totalDel = dc.total;
            const completedDel = (dc.live || 0) + (dc.approved || 0);
            const tr = ci.tranche_statuses || { t1: null, t2: null, t3: null };
            const trMark = (state) => {
              if (state === 'released') return { ch: '✓', col: P.successText };
              if (state === 'locked')   return { ch: '○', col: P.ink };
              if (state === 'queued')   return { ch: '◐', col: P.warn };
              return { ch: '—', col: P.muted3 };
            };
            const t1m = trMark(tr.t1), t2m = trMark(tr.t2), t3m = trMark(tr.t3);
            const isBusy = actionLoading === ci.id;
            const isApplied = ci.status === 'applied';
            const canCancel = CANCELLABLE.has(ci.status);
            const isNegot = ci.status === 'negotiating';
            const isContract = ['accepted', 'contracted', 'active'].includes(ci.status);

            return (
              <View key={ci.id} style={s.card}>
                <View style={s.cardTop}>
                  <TouchableOpacity
                    style={{ flex: 1, minWidth: 0 }}
                    activeOpacity={0.7}
                    // Stage 3 — the row now opens WHERE THE WORK IS, not who she is. Her
                    // public profile is a different question, still reachable from the spine.
                    // A roster row inside a campaign is about this collaboration.
                    onPress={() => navigation.navigate('BrandCreatorSpine', {
                      campaignInfluencerId: ci.id,
                      campaignId,
                      setName: ci.set_name,
                      influencerName: ci.influencer_name,
                    })}
                  >
                    <Text style={s.cardName} numberOfLines={1}>{ci.influencer_name || 'Influencer'}</Text>
                    <Text style={s.cardHandle} numberOfLines={1}>@{ci.instagram_handle || '—'}</Text>
                    {/* Stage 3 — which of the six steps, and whose move. Both from the
                        server: the status pill above says what the ROW is, this says
                        where the WORK is, and they are different questions. */}
                    {(() => {
                      const node = creatorNode(tree, ci.id);
                      if (!node?.step) return null;
                      const tone = turnTone(node.turn, { asBrand: true });
                      return (
                        <>
                          <StepBars step={node.step} tone={tone.dot} />
                          <Text style={[s.cardStep, { color: tone.fg }]}>
                            {(STEP_LABELS[node.step] || '').toUpperCase()} · {turnLabel(node.turn, { asBrand: true })}
                          </Text>
                        </>
                      );
                    })()}
                    {ci.set_name ? (
                      <View style={s.cardSetChip}>
                        <Text style={s.cardSetChipText} numberOfLines={1}>{ci.set_name}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <StatusPill status={ci.status} />
                    {showFee && ci.agreed_fee > 0 && (
                      <Text style={s.cardFee}>{fmtRupees(ci.agreed_fee)}</Text>
                    )}
                    {showComm && ci.commission_pct > 0 && (
                      <Text style={[s.cardFee, { color: P.successText }]}>{parseFloat(ci.commission_pct)}% comm.</Text>
                    )}
                  </View>
                </View>

                {totalDel > 0 && (
                  <View style={s.delProgress}>
                    <View style={s.delProgressBg}>
                      <View style={[s.delProgressFill, { width: `${Math.round((completedDel / totalDel) * 100)}%` }]} />
                    </View>
                    <Text style={s.delProgressText}>
                      {completedDel}/{totalDel}
                      {(dc.submitted + dc.under_review) > 0 && ` · ${dc.submitted + dc.under_review} review`}
                    </Text>
                  </View>
                )}

                {showTr && (
                  <View style={s.trRow}>
                    <Text style={[s.trCell, { color: t1m.col }]}>{t1m.ch} T1</Text>
                    <Text style={[s.trCell, { color: t2m.col }]}>{t2m.ch} T2</Text>
                    <Text style={[s.trCell, { color: t3m.col }]}>{t3m.ch} T3</Text>
                  </View>
                )}

                {(goal === 'conversion' || goal === 'hybrid') && ci.transaction_count != null && (
                  <Text style={s.txCount}>
                    <Text style={s.txCountV}>{ci.transaction_count}</Text> transaction{ci.transaction_count === 1 ? '' : 's'} driven
                  </Text>
                )}

                <View style={s.actionRow}>
                  {isApplied && (
                    <>
                      <TouchableOpacity
                        style={[s.btnReject, isBusy && { opacity: 0.4 }]}
                        onPress={() => handleRejectApplication(ci)}
                        disabled={isBusy}
                      >
                        <Text style={s.btnRejectText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btnApprove, isBusy && { opacity: 0.4 }]}
                        onPress={() => handleApproveApplication(ci)}
                        disabled={isBusy}
                      >
                        {isBusy ? <ActivityIndicator size="small" color={P.white} /> : <Text style={s.btnApproveText}>Approve</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                  {!isApplied && canCancel && (
                    <TouchableOpacity
                      style={[s.btnCancel, isBusy && { opacity: 0.4 }]}
                      onPress={() => handleCancelInfluencer(ci)}
                      disabled={isBusy}
                    >
                      {isBusy ? <ActivityIndicator size="small" color={P.dangerText} /> : <Text style={s.btnCancelText}>Cancel</Text>}
                    </TouchableOpacity>
                  )}
                  {!isApplied && isNegot && (
                    <TouchableOpacity
                      style={s.btnChat}
                      onPress={() => navigation.navigate('BrandNegotiation', {
                        negotiationId: ci.negotiation_id,
                        campaignInfluencerId: ci.id,
                        influencerName: ci.influencer_name,
                        influencerHandle: ci.instagram_handle,
                      })}
                    >
                      <Text style={s.btnChatText}>Open chat</Text>
                    </TouchableOpacity>
                  )}
                  {!isApplied && isContract && (
                    <TouchableOpacity
                      style={s.btnContract}
                      onPress={() => navigation.navigate('BrandContract', {
                        campaignInfluencerId: ci.id,
                        influencerName: ci.influencer_name,
                        goal: ci.set_goal,
                      })}
                    >
                      <Text style={s.btnContractText}>Open contract</Text>
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
  goBackBtn: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: P.ink, borderRadius: 10 },
  goBackBtnText: { fontFamily: fonts.sansBold, fontSize: 13, fontWeight: '700', color: P.white},

  searchRow: { paddingHorizontal: 14, paddingTop: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchWrapFocused: { borderColor: P.ink },
  searchIcon: { fontFamily: fonts.monoBold, fontSize: 13, color: P.muted2, marginRight: 8 },
  searchInput: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: P.ink, paddingVertical: 0, height: '100%' },
  searchClear: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  searchClearText: { fontFamily: fonts.monoBold, fontSize: 14, color: P.muted, fontWeight: '700' },

  filterLabel: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.muted2, letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  chipRow: { flexGrow: 0 },
  chipRowInner: { paddingHorizontal: 14, gap: 5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.bg2, borderWidth: 1, borderColor: P.border, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5 },
  chipActive: { backgroundColor: P.ink, borderColor: P.ink },
  chipText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.muted, maxWidth: 140 },
  chipTextActive: { color: P.white },
  chipCount: { fontFamily: fonts.monoBold, fontSize: 9.5, fontWeight: '700', color: P.muted2 },
  chipCountActive: { color: 'rgba(255,255,255,0.85)' },

  list: { paddingHorizontal: 14, paddingTop: 12, gap: 8 },

  card: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 14, padding: 12, gap: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardName: { fontFamily: fonts.displayBold, fontSize: 13.5, fontWeight: '700', color: P.ink, letterSpacing: 0.1 },
  cardHandle: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2, marginTop: 1 },
  cardStep:   { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.2, marginTop: 4 },
  cardSetChip: { backgroundColor: P.bg2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, alignSelf: 'flex-start', marginTop: 4 },
  cardSetChipText: { fontFamily: fonts.sansMedium, fontSize: 9.5, color: P.muted },
  cardFee: { fontFamily: fonts.monoBold, fontSize: 12, fontWeight: '700', color: P.ink },

  delProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delProgressBg: { flex: 1, height: 4, backgroundColor: P.bg2, borderRadius: 99, overflow: 'hidden' },
  delProgressFill: { height: '100%', backgroundColor: P.ink, borderRadius: 99 },
  delProgressText: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2 },

  trRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: P.bg2, borderRadius: 7 },
  trCell: { fontFamily: fonts.monoBold, fontWeight: '700', fontSize: 10.5 },

  txCount: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted },
  txCountV: { color: P.ink, fontWeight: '600', fontFamily: fonts.monoBold },

  actionRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btnReject: { backgroundColor: P.bg2, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: P.border },
  btnRejectText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.dangerText, letterSpacing: 0.2 },
  btnApprove: { backgroundColor: P.ink, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7 },
  btnApproveText: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '700', color: P.white, letterSpacing: 0.2 },
  btnCancel: { backgroundColor: P.white, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: P.dangerPale },
  btnCancelText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.dangerText, letterSpacing: 0.2 },
  btnChat: { backgroundColor: P.ink, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7 },
  btnChatText: { fontFamily: fonts.displayBold, fontSize: 10.5, fontWeight: '700', color: P.white, letterSpacing: 0.2 },
  btnContract: { backgroundColor: P.successPale, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7 },
  btnContractText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.successText, letterSpacing: 0.2 },
});
