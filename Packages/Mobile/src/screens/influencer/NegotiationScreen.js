import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status) {
  switch (status) {
    case 'awaiting_brand':      return 'Waiting for Brand';
    case 'awaiting_influencer': return 'Your Turn';
    case 'agreed':              return 'Agreed';
    case 'walked_away':         return 'Closed';
    case 'open':                return 'Open';
    default:                    return status || '—';
  }
}

export default function NegotiationScreen({ navigation, route }) {
  const { negotiation_id, campaign_influencer_id } = route.params || {};

  const [negotiation, setNegotiation] = useState(null);
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [proposedFee, setProposedFee] = useState('');
  const [proposedCommission, setProposedCommission] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    loadNegotiation();
  }, []);

  async function loadNegotiation() {
    if (!loading) setRefreshing(true);

    let res;
    if (negotiation_id) {
      res = await influencerApi.getNegotiation(negotiation_id);
    } else if (campaign_influencer_id) {
      res = await influencerApi.getNegotiationByCampaignInfluencer(campaign_influencer_id);
    } else {
      setLoading(false);
      return;
    }

    setLoading(false);
    setRefreshing(false);

    if (res.success) {
      const neg = res.data?.negotiation || res.data;
      setNegotiation(neg);
      setTurns(res.data?.turns || neg.turns || []);
    } else {
      if (campaign_influencer_id && res.error?.code === 'NOT_FOUND') {
        setNegotiation(null);
      } else {
        Alert.alert('Error', res.error?.message || 'Failed to load negotiation');
      }
    }
  }

  const onRefresh = useCallback(() => {
    loadNegotiation();
  }, [negotiation_id, campaign_influencer_id]);

  // ── Goal-aware: only collect / show fields that apply to this campaign ────
  const goal           = (negotiation?.goal || 'engagement').toLowerCase();
  const isConversion   = goal === 'conversion';
  const isHybrid       = goal === 'hybrid';
  const isEngagement   = goal === 'engagement';
  const showFee        = isEngagement || isHybrid;
  const showCommission = isConversion || isHybrid;

  async function submitCounter() {
    const feeAmount        = showFee        ? parseFloat(proposedFee)        : null;
    const commissionAmount = showCommission ? parseFloat(proposedCommission) : null;

    if (showFee && (!feeAmount || feeAmount <= 0)) {
      Alert.alert('Invalid Fee', 'Please enter a valid fee amount.');
      return;
    }
    if (showCommission && (!commissionAmount || commissionAmount <= 0 || commissionAmount > 100)) {
      Alert.alert('Invalid Commission', 'Please enter a commission % between 0 and 100.');
      return;
    }
    if (!negotiation?.id) {
      Alert.alert('Error', 'No negotiation thread found.');
      return;
    }

    setActionLoading(true);
    const res = await influencerApi.submitNegotiationTurn(negotiation.id, {
      ...(feeAmount        != null && { proposed_fee: feeAmount }),
      ...(commissionAmount != null && { proposed_commission_pct: commissionAmount }),
      note: note || undefined,
      action: 'counter',
    });
    setActionLoading(false);

    if (res.success) {
      setProposedFee('');
      setProposedCommission('');
      setNote('');
      loadNegotiation();
    } else {
      Alert.alert('Failed', res.error?.message || 'Could not send counter offer');
    }
  }

  async function acceptCurrentOffer() {
    if (!negotiation?.id) return;
    const feePart = negotiation.current_fee ? fmtRupees(negotiation.current_fee) : null;
    const commPart = negotiation.current_commission_pct ? `${negotiation.current_commission_pct}% commission` : null;
    const summary = [feePart, commPart].filter(Boolean).join(' + ') || 'the current offer';

    Alert.alert(
      'Accept Offer',
      `Accept ${summary}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(true);
            const res = await influencerApi.submitNegotiationTurn(negotiation.id, {
              action: 'accept',
            });
            setActionLoading(false);
            if (res.success) {
              Alert.alert('Accepted', 'Offer accepted! A contract will be generated.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } else {
              Alert.alert('Failed', res.error?.message || 'Could not accept offer');
            }
          },
        },
      ]
    );
  }

  async function walkAway() {
    if (!negotiation?.id) return;
    Alert.alert(
      'Walk Away',
      'Are you sure you want to close this negotiation? The offer will be declined.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Walk Away',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const res = await influencerApi.submitNegotiationTurn(negotiation.id, {
              action: 'walkaway',
            });
            setActionLoading(false);
            if (res.success) {
              Alert.alert('Closed', 'You have walked away from this negotiation.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } else {
              Alert.alert('Failed', res.error?.message || 'Could not close negotiation');
            }
          },
        },
      ]
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Loading negotiation...</Text>
      </View>
    );
  }

  if (!negotiation) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>!</Text>
        <Text style={styles.emptyText}>No negotiation yet</Text>
        <Text style={styles.emptySubtext}>
          Tap "Negotiate" on an offer to start a conversation with the brand.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isInfluencerTurn = negotiation.current_turn === 'influencer';
  const isAwaitingBrand  = negotiation.status === 'awaiting_brand';
  const isOpen           = isAwaitingBrand || negotiation.status === 'awaiting_influencer' || negotiation.status === 'open';
  const isClosed         = negotiation.status === 'agreed' || negotiation.status === 'walked_away';

  function renderProposalLine(fee, commissionPct) {
    const parts = [];
    if (fee != null && fee !== '')           parts.push(fmtRupees(fee));
    if (commissionPct != null && commissionPct !== '') parts.push(`${commissionPct}% comm.`);
    return parts.length ? parts.join(' + ') : '—';
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<- Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Negotiation</Text>
        <View style={styles.headerMeta}>
          <View style={styles.headerStatusPill}>
            <Text style={styles.headerStatusText}>{statusLabel(negotiation.status)}</Text>
          </View>
          {negotiation.brand_name && (
            <Text style={styles.headerBrand}>{negotiation.brand_name}</Text>
          )}
        </View>
        {negotiation.campaign_name && (
          <Text style={styles.headerCampaign}>{negotiation.campaign_name}</Text>
        )}
      </View>

      {/* Original vs Current */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Offer Progress</Text>
        <View style={styles.feeSummary}>
          <View style={styles.feeBox}>
            <Text style={styles.feeBoxLabel}>Original</Text>
            <Text style={styles.feeBoxValue}>
              {renderProposalLine(negotiation.original_fee, negotiation.original_commission_pct)}
            </Text>
          </View>
          <View style={styles.feeArrow}>
            <Text style={styles.feeArrowText}>{'-->'}</Text>
          </View>
          <View style={[styles.feeBox, styles.feeBoxCurrent]}>
            <Text style={styles.feeBoxLabelCurrent}>Latest</Text>
            <Text style={styles.feeBoxValueCurrent}>
              {renderProposalLine(negotiation.current_fee, negotiation.current_commission_pct)}
            </Text>
          </View>
        </View>
        <View style={styles.turnInfo}>
          <Text style={styles.turnInfoLabel}>
            {isClosed
              ? 'Negotiation ' + statusLabel(negotiation.status).toLowerCase()
              : isInfluencerTurn
              ? 'Your turn to respond'
              : 'Waiting for brand to respond'}
          </Text>
        </View>
      </View>

      {/* Turn History (chat-style) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {'Conversation (' + turns.length + (turns.length === 1 ? ' message)' : ' messages)')}
        </Text>

        {turns.length === 0 ? (
          <Text style={styles.noTurnsText}>No messages yet.</Text>
        ) : (
          turns.map((turn, index) => {
            const isInfluencer = turn.sent_by === 'influencer';
            return (
              <View
                key={turn.id || index}
                style={[
                  styles.turnBubble,
                  isInfluencer ? styles.turnBubbleRight : styles.turnBubbleLeft,
                ]}
              >
                <View style={styles.turnHeader}>
                  <Text style={[
                    styles.turnActor,
                    isInfluencer ? styles.turnActorInfluencer : styles.turnActorBrand,
                  ]}>
                    {isInfluencer ? 'You' : 'Brand'}
                  </Text>
                  <Text style={styles.turnDate}>{formatDate(turn.created_at)}</Text>
                </View>

                <View style={styles.turnActionBadge}>
                  <Text style={styles.turnActionText}>Counter Offer</Text>
                </View>

                {(turn.proposed_fee != null || turn.proposed_commission_pct != null) && (
                  <Text style={styles.turnFee}>
                    {renderProposalLine(turn.proposed_fee, turn.proposed_commission_pct)}
                  </Text>
                )}

                {turn.note && (
                  <Text style={styles.turnNote}>"{turn.note}"</Text>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Waiting Banner */}
      {isOpen && !isInfluencerTurn && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingIcon}>...</Text>
          <Text style={styles.waitingTitle}>Waiting for Brand</Text>
          <Text style={styles.waitingText}>
            The brand is reviewing your offer. You will be notified when they respond.
          </Text>
        </View>
      )}

      {/* Counter Offer Form (only when it's the influencer's turn) */}
      {isOpen && isInfluencerTurn && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Response</Text>
          <Text style={styles.formHint}>
            You can accept the current offer, send a counter, or walk away.
          </Text>

          <TouchableOpacity
            style={[styles.acceptBtn, actionLoading && styles.disabledBtn]}
            onPress={acceptCurrentOffer}
            disabled={actionLoading}
          >
            <Text style={styles.acceptBtnText}>
              {'Accept ' + renderProposalLine(negotiation.current_fee, negotiation.current_commission_pct)}
            </Text>
          </TouchableOpacity>

          <View style={styles.counterSection}>
            <Text style={styles.counterLabel}>Or send a counter offer:</Text>

            {showFee && (
              <View style={styles.inputWrap}>
                <Text style={styles.rupee}>{'\u20B9'}</Text>
                <TextInput
                  style={styles.feeInput}
                  value={proposedFee}
                  onChangeText={setProposedFee}
                  keyboardType="numeric"
                  placeholder="Your proposed fee"
                  placeholderTextColor={colors.t3}
                />
              </View>
            )}

            {showCommission && (
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.feeInput, { paddingLeft: 14 }]}
                  value={proposedCommission}
                  onChangeText={setProposedCommission}
                  keyboardType="numeric"
                  placeholder="Proposed commission %"
                  placeholderTextColor={colors.t3}
                />
                <Text style={styles.rupee}>%</Text>
              </View>
            )}

            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)..."
              placeholderTextColor={colors.t3}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={[
                styles.counterBtn,
                actionLoading && styles.disabledBtn,
                showFee && !proposedFee && styles.disabledBtn,
                showCommission && !showFee && !proposedCommission && styles.disabledBtn,
              ]}
              onPress={submitCounter}
              disabled={
                actionLoading ||
                (showFee && !proposedFee) ||
                (showCommission && !showFee && !proposedCommission)
              }
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.counterBtnText}>Send Counter Offer</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.declineBtn, actionLoading && styles.disabledBtn]}
            onPress={walkAway}
            disabled={actionLoading}
          >
            <Text style={styles.declineBtnText}>Walk Away</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Closed Status */}
      {isClosed && (
        <View style={[styles.card, styles.closedCard]}>
          <Text style={styles.closedTitle}>
            {negotiation.status === 'agreed' ? 'Negotiation Agreed' : 'Negotiation Closed'}
          </Text>
          <Text style={styles.closedText}>
            {negotiation.status === 'agreed'
              ? 'Final terms: ' + renderProposalLine(negotiation.current_fee, negotiation.current_commission_pct) + '. A contract will be generated for signing.'
              : 'This negotiation has been closed without an agreement.'}
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 24 },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },
  emptyIcon: { fontSize: 32, color: colors.t3, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: colors.t3, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.white },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  headerStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerStatusText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 0.4 },
  headerBrand: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  headerCampaign: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '600' },

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

  feeSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  feeBox: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  feeBoxCurrent: { backgroundColor: colors.tealPale },
  feeBoxLabel: { fontSize: 9, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  feeBoxLabelCurrent: { fontSize: 9, fontWeight: '700', color: colors.tealDeep, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  feeBoxValue: { fontSize: 14, fontWeight: '800', color: colors.t1, textAlign: 'center' },
  feeBoxValueCurrent: { fontSize: 14, fontWeight: '800', color: colors.tealDeep, textAlign: 'center' },
  feeArrow: { paddingHorizontal: 4 },
  feeArrowText: { fontSize: 14, color: colors.t3, fontWeight: '700' },

  turnInfo: {
    backgroundColor: colors.navyPale,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  turnInfoLabel: { fontSize: 13, fontWeight: '700', color: colors.navy },

  noTurnsText: { fontSize: 13, color: colors.t3 },
  turnBubble: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  turnBubbleLeft: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    marginRight: 40,
  },
  turnBubbleRight: {
    backgroundColor: colors.navyPale,
    borderColor: '#D0D5EC',
    marginLeft: 40,
  },
  turnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  turnActor: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  turnActorBrand: { color: colors.orange },
  turnActorInfluencer: { color: colors.navy },
  turnDate: { fontSize: 10, color: colors.t3 },
  turnActionBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: colors.orangePale,
  },
  turnActionText: { fontSize: 10, fontWeight: '700', color: colors.t1 },
  turnFee: { fontSize: 16, fontWeight: '800', color: colors.t1, marginBottom: 4 },
  turnNote: { fontSize: 13, color: colors.t2, lineHeight: 19, fontStyle: 'italic' },

  waitingCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.goldPale,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8D590',
  },
  waitingIcon: { fontSize: 22, color: '#7A5500', marginBottom: 8, letterSpacing: 4 },
  waitingTitle: { fontSize: 15, fontWeight: '700', color: '#7A5500', marginBottom: 6 },
  waitingText: { fontSize: 13, color: '#7A5500', textAlign: 'center', lineHeight: 20 },

  formHint: { fontSize: 12, color: colors.t3, marginBottom: 14, lineHeight: 18 },
  acceptBtn: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  counterSection: { marginBottom: 16 },
  counterLabel: { fontSize: 12, fontWeight: '600', color: colors.t2, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border2,
    borderRadius: 12,
    marginBottom: 10,
  },
  rupee: { paddingHorizontal: 12, fontSize: 18, fontWeight: '700', color: colors.t2 },
  feeInput: { flex: 1, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: colors.t1 },
  noteInput: {
    borderWidth: 2,
    borderColor: colors.border2,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: colors.t1,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  counterBtn: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  counterBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  declineBtn: {
    backgroundColor: colors.redPale,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineBtnText: { fontSize: 14, fontWeight: '700', color: colors.red },
  disabledBtn: { opacity: 0.5 },

  closedCard: { backgroundColor: colors.surface2 },
  closedTitle: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  closedText: { fontSize: 13, color: colors.t2, lineHeight: 20 },

  backBtn: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
});
