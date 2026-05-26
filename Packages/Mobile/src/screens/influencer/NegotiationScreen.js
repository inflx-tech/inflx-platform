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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

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
        <ActivityIndicator size="large" color={P.ink} />
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
          <Icon name="chevron-left" size={16} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Negotiation</Text>
        <View style={styles.headerMeta}>
          <StatusPill mode="influencer" status={negotiation.status} />
          {negotiation.brand_name && (
            <Text style={styles.headerBrand}>{negotiation.brand_name}</Text>
          )}
        </View>
        {negotiation.campaign_name && (
          <Text style={styles.headerCampaign}>{negotiation.campaign_name}</Text>
        )}
        <View style={styles.headerRule} />
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
            <Icon name="chevron-right" size={18} color={P.ink} />
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
          <View style={styles.waitingIcoWrap}>
            <Icon name="timer-sand" size={28} color={P.info} />
          </View>
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
                  placeholderTextColor={P.muted2}
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
                  placeholderTextColor={P.muted2}
                />
                <Text style={styles.rupee}>%</Text>
              </View>
            )}

            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)..."
              placeholderTextColor={P.muted2}
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
                <ActivityIndicator size="small" color={P.white} />
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
        <View style={[styles.card, styles.closedCard, negotiation.status === 'agreed' && styles.closedCardAgreed]}>
          <Text style={[styles.closedTitle, negotiation.status === 'agreed' && styles.closedTitleAgreed]}>
            {negotiation.status === 'agreed' ? 'Negotiation Agreed' : 'Negotiation Closed'}
          </Text>
          <Text style={[styles.closedText, negotiation.status === 'agreed' && styles.closedTextAgreed]}>
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
  container: { flex: 1, backgroundColor: P.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg, padding: 24 },
  loadingText: { fontFamily: fonts.sansMedium, fontSize: 13, color: P.muted2, marginTop: 12 },
  emptyIcon: { fontFamily: fonts.displayBlack, fontSize: 32, color: P.muted2, marginBottom: 12 },
  emptyText: { fontFamily: fonts.displayBold, fontSize: 16, fontWeight: '800', color: P.ink, marginBottom: 6 },
  emptySubtext: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: P.muted, textAlign: 'center', lineHeight: 18, marginBottom: 20 },

  // Header (ink topbar with yellow rule)
  header: { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 18, position: 'relative' },
  headerRule: { position: 'absolute', left: 18, bottom: 6, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  backText: { fontFamily: fonts.monoBold, fontSize: 10.5, color: 'rgba(255,255,255,0.65)', fontWeight: '700' },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '800', color: P.white },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  headerBrand: { fontFamily: fonts.monoBold, fontSize: 10.5, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  headerCampaign: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 3 },

  // Card
  card: {
    margin: 14,
    marginBottom: 0,
    backgroundColor: P.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: P.border,
  },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.ink, marginBottom: 11, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Offer Progress
  feeSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 11 },
  feeBox: {
    flex: 1,
    backgroundColor: P.bg2,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 11,
    padding: 11,
    alignItems: 'center',
  },
  feeBoxCurrent: { backgroundColor: P.successPale, borderColor: '#A8E6CC' },
  feeBoxLabel: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  feeBoxLabelCurrent: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.successText, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  feeBoxValue: { fontFamily: fonts.monoBold, fontSize: 14, fontWeight: '800', color: P.ink, textAlign: 'center' },
  feeBoxValueCurrent: { fontFamily: fonts.monoBold, fontSize: 14, fontWeight: '800', color: P.successText, textAlign: 'center' },
  feeArrow: { paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },

  // Turn-info banner
  turnInfo: {
    backgroundColor: P.yellowPale,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    alignItems: 'center',
  },
  turnInfoLabel: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '800', color: P.yellowText, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Turn bubbles (L=bg2 brand · R=yellowPale influencer)
  noTurnsText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: P.muted2 },
  turnBubble: {
    marginBottom: 10,
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  turnBubbleLeft: {
    backgroundColor: P.bg2,
    borderColor: P.border,
    marginRight: 36,
  },
  turnBubbleRight: {
    backgroundColor: P.yellowPale,
    borderColor: '#F0DA88',
    marginLeft: 36,
  },
  turnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  turnActor: { fontFamily: fonts.monoBold, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  turnActorBrand: { color: P.muted },
  turnActorInfluencer: { color: P.ink },
  turnDate: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2 },
  turnActionBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 5,
    marginBottom: 6,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
  },
  turnActionText: { fontFamily: fonts.monoBold, fontSize: 8.5, fontWeight: '800', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  turnFee: { fontFamily: fonts.monoBold, fontSize: 15, fontWeight: '900', color: P.ink, marginBottom: 4 },
  turnNote: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, lineHeight: 17, fontStyle: 'italic' },

  // Waiting card (infoPale)
  waitingCard: {
    margin: 14,
    marginBottom: 0,
    backgroundColor: P.infoPale,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B7CCFA',
  },
  waitingIcoWrap: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: P.white,
    borderWidth: 1.5, borderColor: P.info,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  waitingTitle: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.info, marginBottom: 5 },
  waitingText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.ink2, textAlign: 'center', lineHeight: 17, maxWidth: 260 },

  // Form
  formHint: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, marginBottom: 11, lineHeight: 17 },
  acceptBtn: {
    backgroundColor: P.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  acceptBtnText: { fontFamily: fonts.displayBlack, fontSize: 14, fontWeight: '900', color: P.yellow, textTransform: 'uppercase', letterSpacing: 0.2 },
  counterSection: { marginBottom: 14 },
  counterLabel: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.muted2, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 11,
    backgroundColor: P.white,
    marginBottom: 8,
  },
  rupee: { paddingHorizontal: 11, fontFamily: fonts.monoBold, fontSize: 17, fontWeight: '800', color: P.muted },
  feeInput: { flex: 1, paddingVertical: 11, fontFamily: fonts.monoBold, fontSize: 16, fontWeight: '800', color: P.ink },
  noteInput: {
    borderWidth: 1.5,
    borderColor: P.border,
    borderRadius: 10,
    padding: 11,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: P.ink,
    backgroundColor: P.bg,
    marginBottom: 9,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  counterBtn: {
    backgroundColor: P.ink,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  counterBtnText: { fontFamily: fonts.displayBlack, fontSize: 13, fontWeight: '900', color: P.yellow, textTransform: 'uppercase', letterSpacing: 0.2 },
  declineBtn: {
    backgroundColor: P.dangerPale,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineBtnText: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.dangerText, textTransform: 'uppercase', letterSpacing: 0.2 },
  disabledBtn: { opacity: 0.5 },

  closedCard:        { backgroundColor: P.bg2, borderColor: P.border },
  closedCardAgreed:  { backgroundColor: P.successPale, borderColor: '#A8E6CC' },
  closedTitle:       { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 5 },
  closedTitleAgreed: { color: P.successText },
  closedText:        { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, lineHeight: 17 },
  closedTextAgreed:  { color: P.successText },

  // Empty-state Go Back button
  backBtn: {
    backgroundColor: P.ink,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  backBtnText: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.yellow, letterSpacing: 0.3 },
});
