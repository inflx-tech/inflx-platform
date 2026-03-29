import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

export default function NegotiationScreen({ navigation, route }) {
  const { negotiationId, offerStatus, offerId } = route.params || {};
  const [negotiation, setNegotiation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [counterFee, setCounterFee] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await influencerApi.getNegotiation(negotiationId);
    setLoading(false);
    if (res.success) setNegotiation(res.data?.negotiation || res.data);
    else Alert.alert('Error', res.error?.message || 'Failed to load negotiation');
  }

  async function respond(action) {
    const feePaise = action === 'counter'
      ? Math.round(parseFloat(counterFee || '0') * 100)
      : (negotiation?.turns?.slice(-1)[0]?.proposed_fee || 0);

    if (action === 'counter' && !counterFee) {
      Alert.alert('Enter a fee', 'Please enter your counter-offer amount');
      return;
    }

    setSubmitting(true);
    const res = await influencerApi.submitNegotiationTurn(negotiationId, {
      action,
      proposed_fee: feePaise,
      note,
    });
    setSubmitting(false);

    if (res.success) {
      Alert.alert(
        action === 'accept' ? 'Offer Accepted!' : action === 'decline' ? 'Offer Declined' : 'Counter Sent',
        action === 'accept' ? 'Contract will be generated shortly.' : undefined,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Failed', res.error?.message || 'Action failed');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  const turns = negotiation?.turns || [];
  const lastTurn = turns[turns.length - 1];
  const isMyTurn = negotiation?.next_turn === 'influencer';

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Negotiation</Text>
        <Text style={styles.sub}>{negotiation?.campaign_name || 'Campaign'}</Text>
      </View>

      {/* Turn thread */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conversation</Text>
        {turns.length === 0 ? (
          <Text style={styles.empty}>No turns yet.</Text>
        ) : (
          turns.map((turn, i) => {
            const isMe = turn.by_role === 'influencer';
            return (
              <View key={i} style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                <Text style={[styles.bubbleName, isMe && { color: colors.white + 'aa' }]}>
                  {isMe ? 'You' : 'Brand'}
                </Text>
                <Text style={[styles.bubbleFee, isMe && { color: colors.white }]}>
                  {fmtMoney(turn.proposed_fee || 0)}
                </Text>
                {turn.note ? (
                  <Text style={[styles.bubbleNote, isMe && { color: colors.white + 'cc' }]}>{turn.note}</Text>
                ) : null}
                <Text style={[styles.bubbleAction, isMe && { color: colors.white + '88' }]}>
                  {turn.action?.replace(/_/g, ' ')}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Action area */}
      {isMyTurn ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Response</Text>

          {lastTurn && (
            <View style={styles.proposalBox}>
              <Text style={styles.proposalLabel}>Brand proposes</Text>
              <Text style={styles.proposalFee}>{fmtMoney(lastTurn.proposed_fee || 0)}</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => respond('accept')} disabled={submitting}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={() => respond('decline')} disabled={submitting}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.orLabel}>— or counter —</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.feeInput}
              value={counterFee}
              onChangeText={setCounterFee}
              keyboardType="numeric"
              placeholder="Your counter fee"
              placeholderTextColor={colors.t3}
            />
          </View>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.t3}
            multiline
            numberOfLines={2}
          />
          <TouchableOpacity
            style={[styles.counterBtn, (submitting || !counterFee) && { opacity: 0.5 }]}
            onPress={() => respond('counter')}
            disabled={submitting || !counterFee}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.counterText}>Send Counter Offer</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={styles.empty}>Waiting for brand to respond…</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  empty: { fontSize: 12, color: colors.t3, textAlign: 'center', paddingVertical: 8 },
  bubble: { borderRadius: 12, padding: 12, marginBottom: 8, maxWidth: '80%' },
  bubbleLeft: { backgroundColor: colors.surface2, alignSelf: 'flex-start' },
  bubbleRight: { backgroundColor: colors.navy, alignSelf: 'flex-end' },
  bubbleName: { fontSize: 10, fontWeight: '700', color: colors.t3, marginBottom: 2 },
  bubbleFee: { fontSize: 16, fontWeight: '800', color: colors.t1 },
  bubbleNote: { fontSize: 11, color: colors.t2, marginTop: 4 },
  bubbleAction: { fontSize: 9, color: colors.t3, marginTop: 4, textTransform: 'uppercase' },
  proposalBox: { backgroundColor: colors.surface2, borderRadius: 10, padding: 12, marginBottom: 12 },
  proposalLabel: { fontSize: 10, fontWeight: '700', color: colors.t3, textTransform: 'uppercase' },
  proposalFee: { fontSize: 20, fontWeight: '800', color: colors.t1, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  acceptBtn: { flex: 1, backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  acceptText: { fontSize: 14, fontWeight: '700', color: colors.white },
  declineBtn: { flex: 1, backgroundColor: colors.redPale, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  declineText: { fontSize: 14, fontWeight: '700', color: colors.red },
  orLabel: { fontSize: 11, color: colors.t3, textAlign: 'center', marginBottom: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border2, borderRadius: 12, marginBottom: 10 },
  rupee: { paddingHorizontal: 12, fontSize: 18, fontWeight: '700', color: colors.t2 },
  feeInput: { flex: 1, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: colors.t1 },
  noteInput: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 13, color: colors.t1, marginBottom: 12, textAlignVertical: 'top' },
  counterBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  counterText: { fontSize: 14, fontWeight: '700', color: colors.white },
});
