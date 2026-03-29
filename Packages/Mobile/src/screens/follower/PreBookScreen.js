import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';

// Simple date picker: show next 14 days
function DatePicker({ selected, onSelect }) {
  const today = new Date();
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + 1);
    return d;
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
      {dates.map(d => {
        const iso = d.toISOString().split('T')[0];
        const isSelected = selected === iso;
        return (
          <TouchableOpacity
            key={iso}
            style={[styles.dateChip, isSelected && styles.dateChipActive]}
            onPress={() => onSelect(iso)}
          >
            <Text style={[styles.dateDay, isSelected && styles.dateDayActive]}>
              {d.toLocaleDateString('en-IN', { weekday: 'short' })}
            </Text>
            <Text style={[styles.dateNum, isSelected && styles.dateNumActive]}>
              {d.getDate()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function PreBookScreen({ navigation, route }) {
  const { offer, influencer } = route.params || {};
  const [date, setDate]             = useState('');
  const [time, setTime]             = useState('');
  const [guests, setGuests]         = useState('1');
  const [notes, setNotes]           = useState('');
  const [loading, setLoading]       = useState(false);

  const price = offer?.price || 0;

  async function book() {
    if (!date) { Alert.alert('Select a date', 'Please pick a booking date'); return; }
    if (!time) { Alert.alert('Enter time', 'Please enter your preferred time (e.g. 2:00 PM)'); return; }

    setLoading(true);
    const res = await followerApi.prebook({
      offer_id: offer?.id,
      influencer_id: influencer?.id,
      campaign_id: offer?.campaign_id,
      campaign_set_id: offer?.campaign_set_id,
      booking_date: date,
      booking_time: time,
      party_size: parseInt(guests, 10) || 1,
      notes: notes.trim(),
    });
    setLoading(false);

    if (res.success) {
      Alert.alert(
        'Booking Confirmed!',
        `Your booking is confirmed for ${new Date(date).toLocaleDateString('en-IN')} at ${time}.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Booking Failed', res.error?.message || 'Please try again');
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pre-Book</Text>
        {offer?.name && <Text style={styles.sub}>{offer.name}</Text>}
      </View>

      {/* Offer summary */}
      {offer && (
        <View style={styles.card}>
          <View style={styles.offerRow}>
            <Text style={styles.offerName}>{offer.name}</Text>
            <Text style={styles.offerPrice}>{fmtMoney(price * 100)}</Text>
          </View>
          {offer.description ? <Text style={styles.offerDesc}>{offer.description}</Text> : null}
        </View>
      )}

      {/* Date picker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Select Date</Text>
        <DatePicker selected={date} onSelect={setDate} />
      </View>

      {/* Time + guests */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferred Time</Text>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          placeholder="e.g. 2:00 PM or 14:00"
          placeholderTextColor={colors.t3}
        />
        <Text style={[styles.cardTitle, { marginTop: 12 }]}>Number of Guests</Text>
        <View style={styles.guestRow}>
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => setGuests(g => String(Math.max(1, parseInt(g || '1', 10) - 1)))}>
            <Text style={styles.guestBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.guestCount}>{guests}</Text>
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => setGuests(g => String(parseInt(g || '1', 10) + 1))}>
            <Text style={styles.guestBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Special Requests (optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Dietary requirements, occasion, etc."
          placeholderTextColor={colors.t3}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Summary */}
      {date && (
        <View style={[styles.card, styles.summaryCard]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date</Text>
            <Text style={styles.summaryVal}>{new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Time</Text>
            <Text style={styles.summaryVal}>{time || '—'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Guests</Text>
            <Text style={styles.summaryVal}>{guests}</Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookBtn, (loading || !date || !time) && { opacity: 0.5 }]}
          onPress={book}
          disabled={loading || !date || !time}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.bookBtnText}>Confirm Booking</Text>
          }
        </TouchableOpacity>
      </View>

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
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.t1, marginBottom: 10 },
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  offerName: { fontSize: 15, fontWeight: '700', color: colors.t1, flex: 1 },
  offerPrice: { fontSize: 15, fontWeight: '800', color: colors.navy },
  offerDesc: { fontSize: 12, color: colors.t3, lineHeight: 18 },
  datePicker: { marginHorizontal: -4 },
  dateChip: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, marginHorizontal: 4, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, minWidth: 52 },
  dateChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  dateDay: { fontSize: 9, fontWeight: '700', color: colors.t3, textTransform: 'uppercase' },
  dateDayActive: { color: 'rgba(255,255,255,0.7)' },
  dateNum: { fontSize: 16, fontWeight: '800', color: colors.t1, marginTop: 2 },
  dateNumActive: { color: colors.white },
  input: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 14, color: colors.t1 },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  guestBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  guestBtnText: { fontSize: 20, color: colors.t1, fontWeight: '600' },
  guestCount: { fontSize: 20, fontWeight: '800', color: colors.t1, minWidth: 32, textAlign: 'center' },
  noteInput: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 13, color: colors.t1, textAlignVertical: 'top' },
  summaryCard: { borderColor: colors.navy + '44', borderWidth: 1.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  summaryVal: { fontSize: 12, color: colors.t1, fontWeight: '700' },
  footer: { padding: 16 },
  bookBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  bookBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },
});
