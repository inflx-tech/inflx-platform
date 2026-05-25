import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

/**
 * BrandNegotiationScreen — chat-style turn thread between brand + influencer
 * with goal-aware action panel (Accept / Counter / Walk Away).
 *
 * Flow 23 (2026-05-25): navy + teal/orange → brandPalette + StatusPill + fonts.
 * Behavior preserved 1:1 (goal-aware fields, scroll-to-end on new turn,
 * Alert flows for Accept/Walkaway, dual entry via negotiationId OR
 * campaignInfluencerId, isMyTurn detection).
 */

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

  useFocusEffect(useCallback(() => { load(); }, [negotiationId, campaignInfluencerId]));

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
      const summary = renderProposal(negotiation.current_fee, negotiation.current_commission_pct);
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
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
            <Text style={s.headerBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Negotiation</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={s.center}><ActivityIndicator color={P.yellow} size="large" /></View>
      </View>
    );
  }

  if (!negotiation) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
            <Text style={s.headerBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Negotiation</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={s.center}>
          <Text style={s.emptyIcon}>!</Text>
          <Text style={s.emptyText}>No negotiation found</Text>
          <TouchableOpacity style={s.backFallback} onPress={() => navigation.goBack()}>
            <Text style={s.backFallbackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
            <Text style={s.headerBackText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headerTitle}>Negotiation</Text>
            <View style={s.headerRule} />
            <Text style={s.headerSub} numberOfLines={1}>
              {influencerName || negotiation.influencer_name || 'Influencer'}
              {influencerHandle ? ` @${influencerHandle}` : ''}
            </Text>
            {negotiation.campaign_name && (
              <Text style={s.headerSub2} numberOfLines={1}>{negotiation.campaign_name}</Text>
            )}
          </View>
          <StatusPill status={negotiation.status} />
        </View>

        <View style={s.summaryCard}>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>ORIGINAL</Text>
            <Text style={s.summaryValue}>
              {renderProposal(negotiation.original_fee, negotiation.original_commission_pct)}
            </Text>
          </View>
          <Text style={s.arrow}>→</Text>
          <View style={[s.summaryBox, s.summaryBoxCurrent]}>
            <Text style={[s.summaryLabel, { color: P.yellowText }]}>LATEST</Text>
            <Text style={[s.summaryValue, { color: P.yellowText }]}>
              {renderProposal(negotiation.current_fee, negotiation.current_commission_pct)}
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.threadContainer}
          contentContainerStyle={s.threadContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {turns.length === 0 ? (
            <View style={s.emptyThread}>
              <Text style={s.emptyThreadText}>No messages yet</Text>
            </View>
          ) : (
            turns.map((turn, i) => {
              const isBrand = turn.sent_by === 'brand';
              return (
                <View
                  key={turn.id || i}
                  style={[s.turnBubble, isBrand ? s.turnBrand : s.turnInfluencer]}
                >
                  <View style={s.turnHeader}>
                    <Text style={[s.turnAuthor, { color: isBrand ? P.yellowText : P.ink2 }]}>
                      {isBrand ? 'YOU (BRAND)' : (influencerName || negotiation.influencer_name || 'INFLUENCER').toUpperCase()}
                    </Text>
                    <Text style={s.turnAction}>Counter Offer</Text>
                  </View>
                  {(turn.proposed_fee != null || turn.proposed_commission_pct != null) && (
                    <Text style={s.turnFee}>
                      {renderProposal(turn.proposed_fee, turn.proposed_commission_pct)}
                    </Text>
                  )}
                  {turn.note ? <Text style={s.turnNote}>"{turn.note}"</Text> : null}
                  <Text style={s.turnTime}>
                    {new Date(turn.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {isOpen && isMyTurn && (
          <View style={s.actionPanel}>
            <Text style={s.turnIndicator}>YOUR TURN TO RESPOND</Text>

            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, s.acceptBtn]}
                onPress={() => handleAction('accept')}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={s.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.declineBtn]}
                onPress={() => handleAction('walkaway')}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={s.declineBtnText}>Walk Away</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.orText}>— OR SEND A COUNTER —</Text>

            {showFee && (
              <View style={s.counterRow}>
                <Text style={s.rupee}>₹</Text>
                <TextInput
                  style={s.counterInput}
                  placeholder="Counter fee (e.g. 5000)"
                  placeholderTextColor={P.muted3}
                  keyboardType="numeric"
                  value={counterFee}
                  onChangeText={setCounterFee}
                />
              </View>
            )}

            {showCommission && (
              <View style={s.counterRow}>
                <TextInput
                  style={[s.counterInput, { paddingLeft: 14 }]}
                  placeholder="Counter commission %"
                  placeholderTextColor={P.muted3}
                  keyboardType="numeric"
                  value={counterCommission}
                  onChangeText={setCounterCommission}
                />
                <Text style={s.rupee}>%</Text>
              </View>
            )}

            <TextInput
              style={s.noteInput}
              placeholder="Optional note..."
              placeholderTextColor={P.muted3}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <TouchableOpacity
              style={[s.sendCounterBtn, submitting && { opacity: 0.5 }]}
              onPress={() => handleAction('counter')}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={P.yellow} size="small" />
              ) : (
                <Text style={s.sendCounterBtnText}>SEND COUNTER OFFER</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isOpen && !isMyTurn && (
          <View style={s.waitingPanel}>
            <Text style={s.waitingText}>Waiting for influencer to respond…</Text>
          </View>
        )}

        {isClosed && (
          <View style={s.closedPanel}>
            <Text style={s.closedText}>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  emptyIcon: { fontFamily: fonts.displayBold, fontSize: 36, fontWeight: '800', color: P.dangerText, marginBottom: 8 },
  emptyText: { fontFamily: fonts.sansBold, fontSize: 14, fontWeight: '600', color: P.muted },
  backFallback: { marginTop: 16, backgroundColor: P.yellow, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  backFallbackText: { fontFamily: fonts.sansBold, color: P.ink, fontWeight: '800', fontSize: 14 },

  header: {
    backgroundColor: P.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  headerBack: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerBackText: { fontFamily: fonts.monoBold, fontSize: 22, fontWeight: '700', color: P.white },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 18, fontWeight: '800', color: P.white, letterSpacing: -0.2 },
  headerRule: { width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2, marginTop: 4, marginBottom: 4 },
  headerSub: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' },
  headerSub2: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: 'rgba(255,255,255,0.5)', marginTop: 1 },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: P.white, margin: 12, marginBottom: 0,
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, gap: 8,
  },
  summaryBox: { flex: 1, alignItems: 'center', backgroundColor: P.bg2, borderRadius: 10, padding: 10 },
  summaryBoxCurrent: { backgroundColor: P.yellowPale },
  summaryLabel: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.muted2, letterSpacing: 0.5, marginBottom: 2 },
  summaryValue: { fontFamily: fonts.monoBold, fontSize: 13, fontWeight: '800', color: P.ink, textAlign: 'center' },
  arrow: { fontFamily: fonts.monoBold, fontSize: 14, fontWeight: '700', color: P.muted2 },

  threadContainer: { flex: 1 },
  threadContent: { padding: 14, paddingBottom: 8 },
  emptyThread: { alignItems: 'center', paddingVertical: 40 },
  emptyThreadText: { fontFamily: fonts.sansMedium, fontSize: 13, color: P.muted2 },

  turnBubble: { marginBottom: 10, padding: 11, borderRadius: 14, borderWidth: 1 },
  turnBrand: { backgroundColor: P.yellow50, borderColor: P.yellowPale, marginLeft: 35 },
  turnInfluencer: { backgroundColor: P.white, borderColor: P.border, marginRight: 35 },
  turnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  turnAuthor: { fontFamily: fonts.monoBold, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  turnAction: { fontFamily: fonts.monoBold, fontSize: 8.5, fontWeight: '700', color: P.muted2, backgroundColor: P.bg2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  turnFee: { fontFamily: fonts.monoBold, fontSize: 15, fontWeight: '800', color: P.ink, marginBottom: 3 },
  turnNote: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, fontStyle: 'italic', marginBottom: 3 },
  turnTime: { fontFamily: fonts.monoMedium, fontSize: 9.5, color: P.muted3 },

  actionPanel: { backgroundColor: P.white, padding: 14, borderTopWidth: 1, borderTopColor: P.border },
  turnIndicator: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '800', color: P.ink, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  acceptBtn: { backgroundColor: P.success },
  acceptBtnText: { fontFamily: fonts.displayBold, color: P.white, fontWeight: '800', fontSize: 13 },
  declineBtn: { backgroundColor: P.dangerPale },
  declineBtnText: { fontFamily: fonts.sansBold, color: P.dangerText, fontWeight: '800', fontSize: 13 },
  orText: { fontFamily: fonts.monoBold, fontSize: 9.5, color: P.muted3, textAlign: 'center', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  counterRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: P.border, borderRadius: 10, marginBottom: 7, backgroundColor: P.white },
  rupee: { paddingHorizontal: 12, fontFamily: fonts.monoBold, fontSize: 14, fontWeight: '700', color: P.muted },
  counterInput: { flex: 1, paddingVertical: 9, fontFamily: fonts.monoMedium, fontSize: 12, fontWeight: '700', color: P.ink },
  noteInput: { borderWidth: 1, borderColor: P.border, borderRadius: 10, padding: 10, fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.ink, marginBottom: 9, minHeight: 42, textAlignVertical: 'top', backgroundColor: P.white },
  sendCounterBtn: {
    backgroundColor: P.ink,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sendCounterBtnText: { fontFamily: fonts.monoBold, color: P.yellow, fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },

  waitingPanel: { backgroundColor: P.yellowPale, padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: P.yellow },
  waitingText: { fontFamily: fonts.sansBold, fontSize: 12, color: P.yellowText, fontWeight: '600' },
  closedPanel: { backgroundColor: P.bg2, padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: P.border },
  closedText: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.muted, textAlign: 'center', lineHeight: 18 },
});
