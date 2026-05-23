import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const P = {
  bg:'#FAFAFA', surface:'#FFFFFF', surface2:'#F4F4F5',
  ink:'#0A0A0A', ink2:'#1F1F22',
  muted:'#52525B', muted2:'#71717A', muted3:'#A1A1AA',
  border:'#E4E4E7', border2:'#D4D4D8',
  yellow:'#FFC107', yellowHover:'#E0A800', yellowPale:'#FFF7CC', yellow50:'#FFFDEB', yellowText:'#6B5A00',
  success:'#10B981', successPale:'#D1FAE5', successDeep:'#047857',
  danger:'#E8401A', dangerPale:'#FDEEE9', dangerDeep:'#B91C1C',
  white:'#FFFFFF',
};

const STATUS_CFG = {
  applied:        { bg: P.yellowPale, text: P.yellowText,   dot: P.yellowHover, label: 'Applied' },
  invited:        { bg: P.surface2,   text: P.ink2,         dot: P.muted2,     label: 'Invited' },
  accepted:       { bg: P.successPale,text: P.successDeep,  dot: P.success,    label: 'Accepted' },
  negotiating:    { bg: P.yellowPale, text: P.yellowText,   dot: P.yellowHover, label: 'Negotiating' },
  contracted:     { bg: P.successPale,text: P.successDeep,  dot: P.success,    label: 'Contracted' },
  active:         { bg: P.successPale,text: P.successDeep,  dot: P.success,    label: 'Active' },
  live:           { bg: P.successPale,text: P.successDeep,  dot: P.success,    label: 'Live' },
  completed:      { bg: P.surface2,   text: P.ink2,         dot: P.muted2,     label: 'Completed' },
  declined:       { bg: P.dangerPale, text: P.dangerDeep,   dot: P.danger,     label: 'Declined' },
  rejected_by_brand: { bg: P.dangerPale, text: P.dangerDeep, dot: P.danger, label: 'Rejected' },
  expired:        { bg: P.surface2,   text: P.muted,        dot: P.muted2,     label: 'Expired' },
  slots_filled:   { bg: P.surface2,   text: P.muted,        dot: P.muted2,     label: 'Slots filled' },
};

const CANCELLABLE = new Set(['invited', 'accepted', 'negotiating']);
const OPEN_GROUP_HIDDEN = new Set(['invited', 'declined', 'rejected_by_brand', 'slots_filled', 'expired']);

export default function BrandCampaignInfluencersListScreen({ navigation, route }) {
  const { campaignId, statusFilter: initialStatusFilter } = route.params || {};
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

  // Action handlers (relocated from old detail screen)
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
          if (!res.success) {
            Alert.alert('Reject failed', res.error?.message || 'Could not reject.');
            return;
          }
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
          if (res.success) {
            Alert.alert('Done', 'Influencer assignment cancelled.');
            load();
          } else {
            Alert.alert('Error', res.error?.message || 'Failed to cancel');
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

  // Flatten influencers across sets, hiding open-group statuses we don't want to surface
  const sets = campaign.sets || [];
  const allInfluencers = sets.flatMap(s => {
    const mode = s.influencer_mode || 'handpick';
    return (s.influencers || [])
      .filter(ci => mode !== 'open_group' || ci.status === 'applied' || !OPEN_GROUP_HIDDEN.has(ci.status))
      .map(ci => ({ ...ci, set_name: s.name, set_id: s.id, set_goal: s.goal, set_mode: mode }));
  });

  // Set filter options (with counts)
  const setOptions = useMemo(() => {
    const opts = [{ id: 'all', label: 'All', count: allInfluencers.length }];
    for (const s of sets) {
      const count = (s.influencers || []).filter(ci => s.influencer_mode !== 'open_group' || ci.status === 'applied' || !OPEN_GROUP_HIDDEN.has(ci.status)).length;
      opts.push({ id: s.id, label: s.name || 'Set', count });
    }
    return opts;
  }, [campaign]);

  // Status filter options (with counts)
  const statusOptions = useMemo(() => {
    const counts = { all: allInfluencers.length };
    for (const ci of allInfluencers) {
      counts[ci.status] = (counts[ci.status] || 0) + 1;
    }
    const orderPref = ['all', 'applied', 'invited', 'negotiating', 'accepted', 'contracted', 'active', 'live', 'completed', 'declined', 'rejected_by_brand', 'expired', 'slots_filled'];
    return orderPref
      .filter(s => s === 'all' || (counts[s] || 0) > 0)
      .map(s => ({ id: s, label: s === 'all' ? 'All' : (STATUS_CFG[s]?.label || s.replace(/_/g, ' ')), count: counts[s] || 0 }));
  }, [campaign]);

  // Apply filters
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
  }, [campaign, setFilter, statusFilter, search]);

  return (
    <View style={styles.container}>
      {/* Ink header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {campaign.name || 'Campaign'}</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Influencers</Text>
            <Text style={styles.headerCrumb}>/dashboard/campaigns/{campaignId?.slice(0, 8)}/influencers</Text>
          </View>
          <Text style={styles.headerCount}>{filtered.length} of {allInfluencers.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
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
            <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
              <Text style={styles.searchClearText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Set filter chips */}
      {setOptions.length > 1 && (
        <>
          <Text style={styles.filterLabel}>Set</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowInner}>
            {setOptions.map(s => {
              const isActive = setFilter === s.id;
              return (
                <TouchableOpacity key={s.id} style={[styles.chip, isActive && styles.chipActive]} onPress={() => setSetFilter(s.id)}>
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>{s.label}</Text>
                  <Text style={[styles.chipCount, isActive && styles.chipCountActive]}>{s.count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Status filter chips */}
      <Text style={styles.filterLabel}>Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowInner}>
        {statusOptions.map(s => {
          const isActive = statusFilter === s.id;
          return (
            <TouchableOpacity key={s.id} style={[styles.chip, isActive && styles.chipActive]} onPress={() => setStatusFilter(s.id)}>
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{s.label}</Text>
              <Text style={[styles.chipCount, isActive && styles.chipCountActive]}>{s.count}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconGlyph}>·</Text></View>
            <Text style={styles.emptyText}>
              {search || setFilter !== 'all' || statusFilter !== 'all' ? 'No influencers match your filters' : 'No influencers yet'}
            </Text>
          </View>
        ) : (
          filtered.map(ci => {
            const cfg = STATUS_CFG[ci.status] || STATUS_CFG.invited;
            const goal = (ci.set_goal || 'engagement').toLowerCase();
            const showFee = goal === 'engagement' || goal === 'hybrid';
            const showComm = goal === 'conversion' || goal === 'hybrid';
            const showTr = goal === 'engagement' || goal === 'hybrid';
            const dc = ci.deliverable_counts || { total: 0, live: 0, approved: 0, submitted: 0, under_review: 0, revision_requested: 0 };
            const totalDel = dc.total;
            const completedDel = (dc.live || 0) + (dc.approved || 0);
            const tr = ci.tranche_statuses || { t1: null, t2: null, t3: null };
            const trMark = (s) => {
              if (s === 'released') return { ch: '✓', col: P.successDeep };
              if (s === 'locked')   return { ch: '○', col: P.ink };
              if (s === 'queued')   return { ch: '◐', col: P.yellowHover };
              return { ch: '—', col: P.muted3 };
            };
            const t1m = trMark(tr.t1), t2m = trMark(tr.t2), t3m = trMark(tr.t3);
            const isBusy = actionLoading === ci.id;
            const isApplied = ci.status === 'applied';
            const canCancel = CANCELLABLE.has(ci.status);
            const isNegot = ci.status === 'negotiating';
            const isContract = ['accepted', 'contracted', 'active'].includes(ci.status);

            return (
              <View key={ci.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <TouchableOpacity
                    style={{ flex: 1, minWidth: 0 }}
                    activeOpacity={0.7}
                    onPress={() => ci.influencer_id && navigation.navigate('BrandInfluencerProfile', { influencerId: ci.influencer_id })}
                  >
                    <Text style={styles.cardName} numberOfLines={1}>{ci.influencer_name || 'Influencer'}</Text>
                    <Text style={styles.cardHandle} numberOfLines={1}>@{ci.instagram_handle || '—'}</Text>
                    {ci.set_name ? (
                      <View style={styles.cardSetChip}>
                        <Text style={styles.cardSetChipText} numberOfLines={1}>{ci.set_name}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
                      <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                    </View>
                    {showFee && ci.agreed_fee > 0 && (
                      <Text style={styles.cardFee}>{fmtRupees(ci.agreed_fee)}</Text>
                    )}
                    {showComm && ci.commission_pct > 0 && (
                      <Text style={[styles.cardFee, { color: P.successDeep }]}>{parseFloat(ci.commission_pct)}% comm.</Text>
                    )}
                  </View>
                </View>

                {/* Deliverable progress */}
                {totalDel > 0 && (
                  <View style={styles.delProgress}>
                    <View style={styles.delProgressBg}>
                      <View style={[styles.delProgressFill, { width: `${Math.round((completedDel / totalDel) * 100)}%` }]} />
                    </View>
                    <Text style={styles.delProgressText}>
                      {completedDel}/{totalDel}
                      {(dc.submitted + dc.under_review) > 0 && ` · ${dc.submitted + dc.under_review} review`}
                    </Text>
                  </View>
                )}

                {/* Tranche row */}
                {showTr && (
                  <View style={styles.trRow}>
                    <Text style={[styles.trCell, { color: t1m.col }]}>{t1m.ch} T1</Text>
                    <Text style={[styles.trCell, { color: t2m.col }]}>{t2m.ch} T2</Text>
                    <Text style={[styles.trCell, { color: t3m.col }]}>{t3m.ch} T3</Text>
                  </View>
                )}

                {/* Transaction count (conversion / hybrid) */}
                {(goal === 'conversion' || goal === 'hybrid') && ci.transaction_count != null && (
                  <Text style={styles.txCount}>
                    <Text style={styles.txCountV}>{ci.transaction_count}</Text> transaction{ci.transaction_count === 1 ? '' : 's'} driven
                  </Text>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                  {isApplied && (
                    <>
                      <TouchableOpacity
                        style={[styles.btnReject, isBusy && { opacity: 0.4 }]}
                        onPress={() => handleRejectApplication(ci)}
                        disabled={isBusy}
                      >
                        <Text style={styles.btnRejectText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnApprove, isBusy && { opacity: 0.4 }]}
                        onPress={() => handleApproveApplication(ci)}
                        disabled={isBusy}
                      >
                        {isBusy
                          ? <ActivityIndicator size="small" color={P.yellow} />
                          : <Text style={styles.btnApproveText}>Approve</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                  {!isApplied && canCancel && (
                    <TouchableOpacity
                      style={[styles.btnCancel, isBusy && { opacity: 0.4 }]}
                      onPress={() => handleCancelInfluencer(ci)}
                      disabled={isBusy}
                    >
                      {isBusy
                        ? <ActivityIndicator size="small" color={P.dangerDeep} />
                        : <Text style={styles.btnCancelText}>Cancel</Text>}
                    </TouchableOpacity>
                  )}
                  {!isApplied && isNegot && (
                    <TouchableOpacity
                      style={styles.btnChat}
                      onPress={() => navigation.navigate('BrandNegotiation', {
                        negotiationId: ci.negotiation_id,
                        campaignInfluencerId: ci.id,
                        influencerName: ci.influencer_name,
                        influencerHandle: ci.instagram_handle,
                      })}
                    >
                      <Text style={styles.btnChatText}>Open chat</Text>
                    </TouchableOpacity>
                  )}
                  {!isApplied && isContract && (
                    <TouchableOpacity
                      style={styles.btnContract}
                      onPress={() => navigation.navigate('BrandContract', {
                        campaignInfluencerId: ci.id,
                        influencerName: ci.influencer_name,
                        goal: ci.set_goal,
                      })}
                    >
                      <Text style={styles.btnContractText}>Open contract</Text>
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
  headerCount: { fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.6)' },

  searchRow: { paddingHorizontal: 14, paddingTop: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchWrapFocused: { borderColor: P.yellow, shadowColor: P.yellow, shadowOpacity: 0.25, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
  searchIcon: { fontSize: 13, color: P.muted2, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: P.ink, paddingVertical: 0, height: '100%' },
  searchClear: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.surface2, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  searchClearText: { fontSize: 14, color: P.muted, fontWeight: '700' },

  filterLabel: { fontSize: 10, fontWeight: '700', color: P.muted2, letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  chipRow: { flexGrow: 0 },
  chipRowInner: { paddingHorizontal: 14, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.surface2, borderWidth: 1, borderColor: P.border, borderRadius: 100, paddingHorizontal: 11, paddingVertical: 6, marginRight: 6 },
  chipActive: { backgroundColor: P.ink, borderColor: P.ink },
  chipText: { fontSize: 11, fontWeight: '600', color: P.muted, maxWidth: 140 },
  chipTextActive: { color: P.white },
  chipCount: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: P.muted2 },
  chipCountActive: { color: 'rgba(255,255,255,0.85)' },

  list: { paddingHorizontal: 14, paddingTop: 12, gap: 8 },
  emptyCard: { backgroundColor: P.surface, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: P.border, marginTop: 12 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: P.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyIconGlyph: { fontSize: 22, fontWeight: '700', color: P.muted2 },
  emptyText: { fontSize: 13.5, fontWeight: '700', color: P.ink },

  card: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 14, padding: 12, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardName: { fontSize: 13.5, fontWeight: '700', color: P.ink, letterSpacing: 0.1 },
  cardHandle: { fontFamily: 'monospace', fontSize: 11, color: P.muted2, marginTop: 1 },
  cardSetChip: { backgroundColor: P.surface2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100, alignSelf: 'flex-start', marginTop: 4 },
  cardSetChipText: { fontSize: 10, color: P.muted },
  cardFee: { fontFamily: 'monospace', fontWeight: '700', fontSize: 12.5, color: P.ink },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  delProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delProgressBg: { flex: 1, height: 4, backgroundColor: P.surface2, borderRadius: 100, overflow: 'hidden' },
  delProgressFill: { height: '100%', backgroundColor: P.yellow, borderRadius: 100 },
  delProgressText: { fontFamily: 'monospace', fontSize: 10, color: P.muted2 },

  trRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: P.surface2, borderRadius: 7 },
  trCell: { fontFamily: 'monospace', fontWeight: '700', fontSize: 10.5 },

  txCount: { fontFamily: 'monospace', fontSize: 10.5, color: P.muted },
  txCountV: { color: P.ink, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btnReject: { backgroundColor: P.surface2, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: P.border },
  btnRejectText: { fontSize: 10.5, fontWeight: '700', color: P.dangerDeep, letterSpacing: 0.2 },
  btnApprove: { backgroundColor: P.ink, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7 },
  btnApproveText: { fontSize: 10.5, fontWeight: '700', color: P.yellow, letterSpacing: 0.2 },
  btnCancel: { backgroundColor: P.white, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: P.dangerPale },
  btnCancelText: { fontSize: 10.5, fontWeight: '700', color: P.dangerDeep, letterSpacing: 0.2 },
  btnChat: { backgroundColor: P.yellow, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7 },
  btnChatText: { fontSize: 10.5, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
  btnContract: { backgroundColor: P.successPale, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7 },
  btnContractText: { fontSize: 10.5, fontWeight: '700', color: P.successDeep, letterSpacing: 0.2 },
});
