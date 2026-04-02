import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

export default function BrandNegotiationScreen({ route, navigation }) {
  const { negotiationId, campaignInfluencerId, influencerName, influencerHandle } = route.params || {};

  const [negotiation, setNegotiation] = useState(null);
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [counterFee, setCounterFee] = useState('');
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

  const isMyTurn = negotiation?.next_turn === 'brand';
  const negId = negotiation?.id;

  async function handleAction(action) {
    if (!negId) return;
    if (action === 'decline') {
      Alert.alert('Decline Negotiation', 'Are you sure you want to decline?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => doRespond('decline') },
      ]);
      return;
    }
    if (action === 'accept') {
      doRespond('accept');
      return;
    }
    if (action === 'counter') {
      const fee = parseInt(counterFee, 10);
      if (!fee || fee <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid counter-offer amount.');
        return;
      }
      doRespond('counter', fee, note);
    }
  }

  async function doRespond(action, proposed_fee, noteText) {
    setSubmitting(true);
    const body = { action };
    if (proposed_fee) body.proposed_fee = proposed_fee;
    if (noteText) body.note = noteText;
    const res = await brandApi.submitNegotiationTurn(negId, body);
    setSubmitting(false);
    if (res.success) {
      setCounterFee('');
      setNote('');
      if (action === 'accept') {
        Alert.alert('Accepted', 'You accepted the proposed fee. A contract will be generated.');
        navigation.goBack();
      } else if (action === 'decline') {
        Alert.alert('Declined', 'You declined the negotiation.');
        navigation.goBack();
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

  const latestInfluencerTurn = [...turns].reverse().find(t => t.proposed_by === 'influencer');

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
              {influencerName || 'Influencer'}{influencerHandle ? ` @${influencerHandle}` : ''}
            </Text>
          </View>
          <StatusPill status={negotiation.status} />
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
              <Text style={styles.emptyThreadText}>No turns yet</Text>
            </View>
          ) : (
            turns.map((turn, i) => {
              const isBrand = turn.proposed_by === 'brand';
              return (
                <View
                  key={turn.id || i}
                  style={[styles.turnBubble, isBrand ? styles.turnBrand : styles.turnInfluencer]}
                >
                  <View style={styles.turnHeader}>
                    <Text style={[styles.turnAuthor, { color: isBrand ? colors.navy : colors.teal }]}>
                      {isBrand ? 'You (Brand)' : (influencerName || 'Influencer')}
                    </Text>
                    <Text style={styles.turnAction}>
                      {turn.action === 'counter' ? 'Counter Offer' : turn.action === 'accept' ? 'Accepted' : turn.action === 'decline' ? 'Declined' : turn.action || 'Proposed'}
                    </Text>
                  </View>
                  {turn.proposed_fee != null && (
                    <Text style={styles.turnFee}>{fmtMoney(turn.proposed_fee * 100)}</Text>
                  )}
                  {turn.note ? <Text style={styles.turnNote}>{turn.note}</Text> : null}
                  <Text style={styles.turnTime}>
                    {new Date(turn.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Action Panel */}
        {negotiation.status === 'active' && (
          <View style={styles.actionPanel}>
            {isMyTurn ? (
              <>
                <Text style={styles.turnIndicator}>Your turn to respond</Text>
                {latestInfluencerTurn && (
                  <Text style={styles.lastProposal}>
                    Influencer proposed: {fmtMoney(latestInfluencerTurn.proposed_fee * 100)}
                  </Text>
                )}

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
                    onPress={() => handleAction('decline')}
                    disabled={submitting}
                  >
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.orText}>-- or send a counter-offer --</Text>

                <View style={styles.counterRow}>
                  <TextInput
                    style={styles.counterInput}
                    placeholder="Counter fee (e.g. 5000)"
                    placeholderTextColor={colors.t3}
                    keyboardType="numeric"
                    value={counterFee}
                    onChangeText={setCounterFee}
                  />
                </View>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Optional note..."
                  placeholderTextColor={colors.t3}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.actionBtn, styles.counterBtn, submitting && { opacity: 0.5 }]}
                  onPress={() => handleAction('counter')}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.counterBtnText}>Send Counter</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.waitingPanel}>
                <Text style={styles.waitingText}>Waiting for influencer to respond...</Text>
              </View>
            )}
          </View>
        )}

        {negotiation.status !== 'active' && (
          <View style={styles.actionPanel}>
            <Text style={styles.closedText}>
              This negotiation is {negotiation.status === 'accepted' ? 'accepted' : negotiation.status === 'declined' ? 'declined' : negotiation.status}.
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function StatusPill({ status }) {
  const cfg = {
    active: { label: 'Active', color: colors.teal, bg: colors.tealPale },
    accepted: { label: 'Accepted', color: colors.navy, bg: colors.navyPale },
    declined: { label: 'Declined', color: colors.red, bg: colors.redPale },
  };
  const c = cfg[status] || { label: status, color: colors.t3, bg: colors.surface2 };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  emptyIcon: { fontSize: 36, fontWeight: '800', color: colors.red, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.t2 },
  backBtn: { marginTop: 16, backgroundColor: colors.navy, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.md },
  backBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // Header
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
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },

  // Thread
  threadContainer: { flex: 1 },
  threadContent: { padding: 16, paddingBottom: 8 },
  emptyThread: { alignItems: 'center', paddingVertical: 40 },
  emptyThreadText: { fontSize: 14, color: colors.t3 },

  turnBubble: {
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    maxWidth: '85%',
    borderWidth: 1,
  },
  turnBrand: {
    alignSelf: 'flex-end',
    backgroundColor: colors.navyPale,
    borderColor: colors.navy + '30',
  },
  turnInfluencer: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealPale,
    borderColor: colors.teal + '30',
  },
  turnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  turnAuthor: { fontSize: 12, fontWeight: '700' },
  turnAction: { fontSize: 10, fontWeight: '600', color: colors.t3, textTransform: 'uppercase' },
  turnFee: { fontSize: 20, fontWeight: '800', color: colors.t1, marginVertical: 4 },
  turnNote: { fontSize: 13, color: colors.t2, marginTop: 4, fontStyle: 'italic' },
  turnTime: { fontSize: 10, color: colors.t3, marginTop: 6, textAlign: 'right' },

  // Action Panel
  actionPanel: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  turnIndicator: { fontSize: 14, fontWeight: '700', color: colors.navy, textAlign: 'center', marginBottom: 6 },
  lastProposal: { fontSize: 12, color: colors.t2, textAlign: 'center', marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: colors.teal },
  acceptBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  declineBtn: { backgroundColor: colors.redPale, borderWidth: 1, borderColor: colors.red + '40' },
  declineBtnText: { color: colors.red, fontWeight: '700', fontSize: 15 },
  orText: { fontSize: 11, color: colors.t3, textAlign: 'center', marginBottom: 10 },
  counterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  counterInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: colors.t1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteInput: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.t1,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    minHeight: 44,
    maxHeight: 80,
  },
  counterBtn: { backgroundColor: colors.navy },
  counterBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  // Waiting
  waitingPanel: { alignItems: 'center', paddingVertical: 12 },
  waitingText: { fontSize: 14, fontWeight: '600', color: colors.t3, fontStyle: 'italic' },

  // Closed
  closedText: { fontSize: 14, fontWeight: '600', color: colors.t2, textAlign: 'center', paddingVertical: 8 },
});
