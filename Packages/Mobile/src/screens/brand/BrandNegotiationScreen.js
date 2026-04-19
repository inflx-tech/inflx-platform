import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';

function statusLabel(status) {
  switch (status) {
    case 'awaiting_brand':      return 'Your Turn';
    case 'awaiting_influencer': return 'Waiting for Influencer';
    case 'agreed':              return 'Agreed';
    case 'walked_away':         return 'Closed';
    case 'open':                return 'Open';
    default:                    return status || '—';
  }
}

function renderProposal(fee, commissionPct) {
  const parts = [];
  if (fee != null && fee !== '')                 parts.push(fmtRupees(fee));
  if (commissionPct != null && commissionPct !== '') parts.push(`${commissionPct}% comm.`);
  return parts.length ? parts.join(' + ') : '—';
}

export default function BrandNegotiationScreen({ route, navigation }) {
  const {
    negotiationId,
    campaignInfluencerId,
    influencerName,
    influencerHandle,
  } = route.params || {};

  const [negotiation, setNegotiation] = useState(null);
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [counterFee, setCounterFee] = useState('');
  const [counterCommission, setCounterCommission] = useState('');
  const [note, setNote] = useState('');
  const scrollRef = useRef(null);

  async function load() {
    let res;
    if (negotiationId) {
      res = await brandApi.getNegotiation(negotiationId);
    } else if (campaignInfluencerId) {
      res = await brandApi.getNegotiationByCampaignInfluencer(campaignInfluencerId);
    }
    setLoading(false);
    if (res?.success) {
      setNegotiation(res.data?.negotiation || res.data);
      setTurns(res.data?.turns || []);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [negotiationId, campaignInfluencerId])
  );

  // ── Goal-aware ─────────────────────────────────────────────────────────
  const goal           = (negotiation?.goal || 'engagement').toLowerCase();
  const isConversion   = goal === 'conversion';
  const isHybrid       = goal === 'hybrid';
  const isEngagement   = goal === 'engagement';
  const showFee        = isEngagement || isHybrid;
  const showCommission = isConversion || isHybrid;

  const isMyTurn = negotiation?.current_turn === 'brand';
  const isOpen   = ['open', 'awaiting_brand', 'awaiting_influencer'].includes(negotiation?.status);
  const isClosed = ['agreed', 'walked_away'].includes(negotiation?.status);
  const negId    = negotiation?.id;

  async function handleAction(action) {
    if (!negId) return;
    if (action === 'walkaway') {
      Alert.alert(
        'Walk Away',
        'Are you sure you want to close this negotiation? The offer will be declined.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Walk Away', style: 'destructive', onPress: () => doRespond('walkaway') },
        ]
      );
      return;
    }
    if (action === 'accept') {
      const summary = renderProposal(
        negotiation.current_fee,
        negotiation.current_commission_pct
      );
      Alert.alert(
        'Accept',
        `Accept ${summary}? A contract will be generated for the influencer to sign.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Accept', onPress: () => doRespond('accept') },
        ]
      );
      return;
    }
    if (action === 'counter') {
      const fee        = showFee        ? parseFloat(counterFee)        : null;
      const commission = showCommission ? parseFloat(counterCommission) : null;
      if (showFee && (!fee || fee <= 0)) {
        Alert.alert('Invalid Fee', 'Please enter a valid counter-offer fee.');
        return;
      }
      if (showCommission && (!commission || commission <= 0 || commission > 100)) {
        Alert.alert('Invalid Commission', 'Please enter a commission % between 0 and 100.');
        return;
      }
      doRespond('counter', { fee, commission });
    }
  }

  async function doRespond(action, vals) {
    setSubmitting(true);
    const body = { action };
    if (vals?.fee        != null) body.proposed_fee            = vals.fee;
    if (vals?.commission != null) body.proposed_commission_pct = vals.commission;
    if (note)                     body.note                    = note;
    const res = await brandApi.submitNegotiationTurn(negId, body);
    setSubmitting(false);
    if (res.success) {
      setCounterFee('');
      setCounterCommission('');
      setNote('');
      if (action === 'accept') {
        Alert.alert('Accepted', 'You accepted the proposed terms. A contract will be generated.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (action === 'walkaway') {
        Alert.alert('Closed', 'You walked away from this negotiation.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await load();
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      }
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to respond');
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} size="large" /></View>;
  }

  if (!negotiation) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>!</Text>
        <Text style={styles.emptyText}>No negotiation found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Text style={styles.headerBackText}>{'<'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Negotiation</Text>
            <Text style={styles.headerSub}>
              {influencerName || negotiation.influencer_name || 'Influencer'}
              {influencerHandle ? ` @${influencerHandle}` : ''}
            </Text>
            {negotiation.campaign_name && (
              <Text style={styles.headerSub2}>{negotiation.campaign_name}</Text>
            )}
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{statusLabel(negotiation.status)}</Text>
          </View>
        </View>

        {/* Original vs Latest */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>ORIGINAL</Text>
            <Text style={styles.summaryValue}>
              {renderProposal(negotiation.original_fee, negotiation.original_commission_pct)}
            </Text>
          </View>
          <Text style={styles.arrow}>{'-->'}</Text>
          <View style={[styles.summaryBox, styles.summaryBoxCurrent]}>
            <Text style={[styles.summaryLabel, { color: colors.tealDeep }]}>LATEST</Text>
            <Text style={[styles.summaryValue, { color: colors.tealDeep }]}>
              {renderProposal(negotiation.current_fee, negotiation.current_commission_pct)}
            </Text>
          </View>
        </View>

        {/* Turn Thread */}
        <ScrollView
          ref={scrollRef}
          style={styles.threadContainer}
          contentContainerStyle={styles.threadContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {turns.length === 0 ? (
            <View style={styles.emptyThread}>
              <Text style={styles.emptyThreadText}>No messages yet</Text>
            </View>
          ) : (
            turns.map((turn, i) => {
              const isBrand = turn.sent_by === 'brand';
              return (
                <View
                  key={turn.id || i}
                  style={[styles.turnBubble, isBrand ? styles.turnBrand : styles.turnInfluencer]}
                >
                  <View style={styles.turnHeader}>
                    <Text style={[styles.turnAuthor, { color: isBrand ? colors.navy : colors.teal }]}>
                      {isBrand ? 'You (Brand)' : (influencerName || negotiation.influencer_name || 'Influencer')}
                    </Text>
                    <Text style={styles.turnAction}>Counter Offer</Text>
                  </View>
                  {(turn.proposed_fee != null || turn.proposed_commission_pct != null) && (
                    <Text style={styles.turnFee}>
                      {renderProposal(turn.proposed_fee, turn.proposed_commission_pct)}
                    </Text>
                  )}
                  {turn.note ? <Text style={styles.turnNote}>"{turn.note}"</Text> : null}
                  <Text style={styles.turnTime}>
                    {new Date(turn.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Action Panel */}
        {isOpen && isMyTurn && (
          <View style={styles.actionPanel}>
            <Text style={styles.turnIndicator}>Your turn to respond</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleAction('accept')}
                disabled={submitting}
              >
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={() => handleAction('walkaway')}
                disabled={submitting}
              >
                <Text style={styles.declineBtnText}>Walk Away</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.orText}>-- or send a counter --</Text>

            {showFee && (
              <View style={styles.counterRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.counterInput}
                  placeholder="Counter fee (e.g. 5000)"
                  placeholderTextColor={colors.t3}
                  keyboardType="numeric"
                  value={counterFee}
                  onChangeText={setCounterFee}
                />
              </View>
            )}

            {showCommission && (
              <View style={styles.counterRow}>
                <TextInput
                  style={[styles.counterInput, { paddingLeft: 14 }]}
                  placeholder="Counter commission %"
                  placeholderTextColor={colors.t3}
                  keyboardType="numeric"
                  value={counterCommission}
                  onChangeText={setCounterCommission}
                />
                <Text style={styles.rupee}>%</Text>
              </View>
            )}

            <TextInput
              style={styles.noteInput}
              placeholder="Optional note..."
              placeholderTextColor={colors.t3}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendCounterBtn, submitting && { opacity: 0.5 }]}
              onPress={() => handleAction('counter')}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.sendCounterBtnText}>Send Counter Offer</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isOpen && !isMyTurn && (
          <View style={styles.waitingPanel}>
            <Text style={styles.waitingText}>Waiting for influencer to respond...</Text>
          </View>
        )}

        {isClosed && (
          <View style={styles.closedPanel}>
            <Text style={styles.closedText}>
              {negotiation.status === 'agreed'
                ? `Agreed on ${renderProposal(negotiation.current_fee, negotiation.current_commission_pct)}. Contract is being generated.`
                : 'This negotiation was closed without an agreement.'}
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  emptyIcon: { fontSize: 36, fontWeight: '800', color: colors.red, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.t2 },
  backBtn: { marginTop: 16, backgroundColor: colors.navy, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.md },
  backBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  header: {
    backgroundColor: colors.navyDeep,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  headerBack: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerBackText: { fontSize: 22, fontWeight: '700', color: colors.white },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  headerSub:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerSub2: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  pillText: { fontSize: 11, fontWeight: '700', color: colors.white },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    margin: 12,
    marginBottom: 0,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  summaryBox: { flex: 1, alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10, padding: 10 },
  summaryBoxCurrent: { backgroundColor: colors.tealPale },
  summaryLabel: { fontSize: 9, fontWeight: '800', color: colors.t3, letterSpacing: 0.5, marginBottom: 2 },
  summaryValue: { fontSize: 13, fontWeight: '800', color: colors.t1, textAlign: 'center' },
  arrow: { fontSize: 14, fontWeight: '700', color: colors.t3 },

  threadContainer: { flex: 1 },
  threadContent: { padding: 16, paddingBottom: 8 },
  emptyThread: { alignItems: 'center', paddingVertical: 40 },
  emptyThreadText: { fontSize: 14, color: colors.t3 },

  turnBubble: { marginBottom: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  turnBrand: { backgroundColor: colors.navyPale, borderColor: '#D0D5EC', marginLeft: 40 },
  turnInfluencer: { backgroundColor: colors.surface2, borderColor: colors.border, marginRight: 40 },
  turnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  turnAuthor: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  turnAction: { fontSize: 10, fontWeight: '700', color: colors.t2, backgroundColor: colors.orangePale, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  turnFee: { fontSize: 16, fontWeight: '800', color: colors.t1, marginBottom: 4 },
  turnNote: { fontSize: 13, color: colors.t2, fontStyle: 'italic', marginBottom: 4 },
  turnTime: { fontSize: 10, color: colors.t3 },

  actionPanel: { backgroundColor: colors.white, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  turnIndicator: { fontSize: 13, fontWeight: '700', color: colors.navy, textAlign: 'center', marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  acceptBtn: { backgroundColor: colors.teal },
  acceptBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  declineBtn: { backgroundColor: colors.redPale },
  declineBtnText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  orText: { fontSize: 11, color: colors.t3, textAlign: 'center', marginBottom: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: 8 },
  rupee: { paddingHorizontal: 12, fontSize: 16, fontWeight: '700', color: colors.t2 },
  counterInput: { flex: 1, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: colors.t1 },
  noteInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 13, color: colors.t1, marginBottom: 12, minHeight: 56, textAlignVertical: 'top' },
  // Old (cramped) styles kept in case anything else references them
  counterBtn: { backgroundColor: colors.navy },
  counterBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  // New full-width primary CTA — matches Accept/Walk Away visual weight
  sendCounterBtn: {
    backgroundColor: colors.navy,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 4,
  },
  sendCounterBtnText: { color: colors.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  waitingPanel: { backgroundColor: colors.goldPale, padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E8D590' },
  waitingText: { fontSize: 13, color: '#7A5500', fontWeight: '600' },
  closedPanel: { backgroundColor: colors.surface2, padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  closedText: { fontSize: 13, color: colors.t2, textAlign: 'center', lineHeight: 19 },
});
