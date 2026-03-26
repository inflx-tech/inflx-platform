import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

export default function OfferDetailScreen({ navigation, route }) {
  const { offer } = route.params || {};
  const [negotiatingFee, setNegotiatingFee] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    const res = await influencerApi.acceptOffer(offer.id);
    setLoading(false);
    if (res.success) { Alert.alert('Offer accepted! 🎉'); navigation.goBack(); }
    else Alert.alert('Failed', res.error?.message);
  }

  async function decline() {
    setLoading(true);
    const res = await influencerApi.declineOffer(offer.id);
    setLoading(false);
    if (res.success) { Alert.alert('Offer declined'); navigation.goBack(); }
    else Alert.alert('Failed', res.error?.message);
  }

  async function submitCounter() {
    if (!offer.negotiation_id) { Alert.alert('No negotiation thread'); return; }
    const feePaise = Math.round(parseFloat(negotiatingFee) * 100);
    setLoading(true);
    const res = await influencerApi.submitNegotiationTurn(offer.negotiation_id, {
      proposed_fee: feePaise,
      note,
      action: 'counter',
    });
    setLoading(false);
    if (res.success) { Alert.alert('Counter offer sent!'); navigation.goBack(); }
    else Alert.alert('Failed', res.error?.message);
  }

  if (!offer) return <View style={{ flex: 1 }}><Text>No offer data</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{offer.brand_name}</Text>
        <Text style={styles.sub}>{offer.campaign_name}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.feeRow}>
          <View style={styles.feeStat}>
            <Text style={styles.feeLabel}>Offered Fee</Text>
            <Text style={styles.feeVal}>{fmtMoney(offer.agreed_fee || offer.proposed_fee)}</Text>
          </View>
          <View style={styles.feeStat}>
            <Text style={styles.feeLabel}>Deliverable</Text>
            <Text style={styles.feeVal}>{offer.deliverable_type || 'reel'}</Text>
          </View>
        </View>

        {offer.brief && (
          <View style={styles.briefBox}>
            <Text style={styles.briefLabel}>Brief</Text>
            <Text style={styles.briefText}>{offer.brief}</Text>
          </View>
        )}

        {offer.status === 'invited' && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={accept} disabled={loading}>
              <Text style={styles.acceptText}>Accept Offer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={decline} disabled={loading}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Negotiate section */}
      {offer.status === 'invited' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Counter Offer</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput style={styles.feeInput} value={negotiatingFee} onChangeText={setNegotiatingFee} keyboardType="numeric" placeholder="Your fee" placeholderTextColor={colors.t3} />
          </View>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)..."
            placeholderTextColor={colors.t3}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity style={[styles.counterBtn, loading && { opacity: 0.5 }]} onPress={submitCounter} disabled={loading || !negotiatingFee}>
            <Text style={styles.counterText}>Send Counter Offer</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  feeRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  feeStat: { flex: 1 },
  feeLabel: { fontSize: 10, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  feeVal: { fontSize: 20, fontWeight: '800', color: colors.t1 },
  briefBox: { backgroundColor: colors.surface2, borderRadius: 10, padding: 12, marginBottom: 16 },
  briefLabel: { fontSize: 10, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  briefText: { fontSize: 13, color: colors.t2, lineHeight: 20 },
  actions: { gap: 10 },
  acceptBtn: { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  acceptText: { fontSize: 15, fontWeight: '700', color: colors.white },
  declineBtn: { backgroundColor: colors.redPale, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  declineText: { fontSize: 15, fontWeight: '700', color: colors.red },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border2, borderRadius: 12, marginBottom: 10 },
  rupee: { paddingHorizontal: 12, fontSize: 18, fontWeight: '700', color: colors.t2 },
  feeInput: { flex: 1, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: colors.t1 },
  noteInput: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 13, color: colors.t1, marginBottom: 12, textAlignVertical: 'top' },
  counterBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  counterText: { fontSize: 14, fontWeight: '700', color: colors.white },
});
