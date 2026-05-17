import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';
// Wave 4 PR 4.3 — restaurant table bookings dispatch to the redesigned
// RestaurantBookingScreen below.
import RestaurantBookingScreen from './RestaurantBookingScreen';

// Category-aware copy. Restaurants get table-booking verbs, salons get
// appointment verbs, cars get reservation verbs. Falls back to generic
// "Pre-Book" for unknowns.
function getCopyForCategory(category) {
  switch (category) {
    case 'restaurant':
    case 'bakery':
      return {
        title:         'Book a Table',
        peopleLabel:   'Party Size',
        peopleSuffix:  'guests',
        timeLabel:     'Time',
        venueWord:     'restaurant',
        confirmCta:    'Pay & Book Table',
        showTimeSlots: true,
      };
    case 'salon':
      return {
        title:         'Book Appointment',
        peopleLabel:   'Number of People',
        peopleSuffix:  'people',
        timeLabel:     'Time',
        venueWord:     'salon',
        confirmCta:    'Pay & Book',
        showTimeSlots: true,
      };
    case 'car_rental':
    case 'bike_rental':
      return {
        title:         category === 'bike_rental' ? 'Reserve Bike' : 'Reserve Car',
        peopleLabel:   'Number of People',
        peopleSuffix:  'people',
        timeLabel:     'Pickup Time',
        venueWord:     'pickup location',
        confirmCta:    'Pay & Reserve',
        showTimeSlots: false,
      };
    default:
      return {
        title:         'Pre-Book',
        peopleLabel:   'Guests',
        peopleSuffix:  'guests',
        timeLabel:     'Preferred Time',
        venueWord:     'venue',
        confirmCta:    'Pay & Book',
        showTimeSlots: false,
      };
  }
}

// Restaurant time slots — 30-min intervals from 12pm to 11pm.
const RESTAURANT_TIME_SLOTS = [
  '12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM',
  '7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM',
];

// Salon time slots — hourly from 10am to 8pm.
const SALON_TIME_SLOTS = [
  '10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM',
  '3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM',
];

function getTimeSlotsForCategory(category) {
  if (category === 'restaurant' || category === 'bakery') return RESTAURANT_TIME_SLOTS;
  if (category === 'salon') return SALON_TIME_SLOTS;
  return [];
}

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

// Time-slot chip picker — used for restaurants and salons. Free-text input
// stays the fallback for categories without a fixed slot grid.
function TimeSlotPicker({ slots, selected, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
      {slots.map(slot => {
        const isSelected = selected === slot;
        return (
          <TouchableOpacity
            key={slot}
            style={[styles.timeSlotChip, isSelected && styles.timeSlotChipActive]}
            onPress={() => onSelect(slot)}
          >
            <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextActive]}>{slot}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// Steps: 'form' → 'summary' → 'paying' → 'confirmed'
export default function PreBookScreen({ navigation, route }) {
  const { offer, store, brand, trackingParams, tracking, action } = route.params || {};
  const category = brand?.category || store?.brand_category || null;

  // Wave 4 PR 4.3 dispatch — restaurants get the new design; other
  // categories stay on the legacy flow below.
  if (category === 'restaurant') {
    return <RestaurantBookingScreen route={route} navigation={navigation} />;
  }

  const copy = getCopyForCategory(category);
  const timeSlots = getTimeSlotsForCategory(category);
  const [date, setDate]             = useState('');
  const [time, setTime]             = useState('');
  const [guests, setGuests]         = useState('1');
  const [notes, setNotes]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [step, setStep]             = useState('form');
  const [bookingResult, setBookingResult] = useState(null);

  // Advance amount in rupees (post-migration). Default ₹200 for restaurants.
  const advanceRupees = offer?.prebook_advance
    ? parseFloat(offer.prebook_advance)
    : 200;

  const price = offer?.price || 0;

  function handleReviewBooking() {
    if (!date) { Alert.alert('Select a date', 'Please pick a booking date'); return; }
    if (!time) { Alert.alert('Enter time', 'Please enter your preferred time (e.g. 2:00 PM)'); return; }
    setStep('summary');
  }

  async function handlePayAndBook() {
    setLoading(true);
    setStep('paying');

    try {
      // Step 1: Initiate prebook — backend creates Razorpay order
      const initiateRes = await followerApi.prebook({
        offer_id: offer?.id,
        campaign_id: trackingParams?.cid || offer?.campaign_id,
        set_id: trackingParams?.sid || offer?.campaign_set_id,
        campaign_influencer_id: trackingParams?.iid || null,
        booking_date: date,
        booking_time: time,
        guest_count: parseInt(guests, 10) || 1,
      });

      if (!initiateRes.success) {
        setLoading(false);
        setStep('summary');
        Alert.alert('Booking Failed', initiateRes.error?.message || 'Could not initiate booking');
        return;
      }

      const { razorpay_order_id, advance_amount } = initiateRes.data;

      // Step 2: Process payment
      // In dev/mock mode, Razorpay is simulated. Generate a mock payment ID.
      // In production, this would open RazorpayCheckout with the order ID.
      const razorpay_payment_id = `pay_mock_${Date.now()}`;

      // Step 3: Verify payment and finalize booking
      const verifyRes = await followerApi.prebookVerify({
        razorpay_order_id,
        razorpay_payment_id,
      });

      setLoading(false);

      if (verifyRes.success) {
        setBookingResult({
          referenceCode: verifyRes.data?.booking?.reference_code || verifyRes.data?.reference_code || `BK${Date.now().toString(36).toUpperCase()}`,
          advancePaid: advance_amount || advanceRupees,
          date,
          time,
          guests,
          transactionId: verifyRes.data?.transaction?.id || verifyRes.data?.transaction_id,
        });
        setStep('confirmed');
      } else {
        setStep('summary');
        Alert.alert('Payment Failed', verifyRes.error?.message || 'Payment could not be verified. Please try again.');
      }
    } catch (err) {
      setLoading(false);
      setStep('summary');
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }

  // ── Confirmed view ──────────────────────────────────────────────────────────
  if (step === 'confirmed' && bookingResult) {
    return (
      <ScrollView style={styles.container}>
        <View style={[styles.header, { alignItems: 'center', paddingBottom: 28 }]}>
          <Text style={styles.checkMark}>&#10003;</Text>
          <Text style={styles.confirmedTitle}>Booking Confirmed!</Text>
          <Text style={styles.confirmedSub}>Your reservation is secured</Text>
        </View>

        <View style={[styles.card, styles.confirmCard]}>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Reference Code</Text>
            <Text style={styles.confirmRef}>{bookingResult.referenceCode}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Date</Text>
            <Text style={styles.confirmVal}>
              {new Date(bookingResult.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Time</Text>
            <Text style={styles.confirmVal}>{bookingResult.time}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Guests</Text>
            <Text style={styles.confirmVal}>{bookingResult.guests}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Advance Paid</Text>
            <Text style={[styles.confirmVal, { color: colors.teal, fontWeight: '800' }]}>
              {fmtMoney(bookingResult.advancePaid)}
            </Text>
          </View>
        </View>

        {store?.brand_name && (
          <Text style={styles.venueNote}>
            Show your reference code at {store.brand_name} on the day of your visit.
          </Text>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Payment summary view ────────────────────────────────────────────────────
  if (step === 'summary' || step === 'paying') {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (!loading) setStep('form'); }} style={styles.back}>
            <Text style={styles.backText}>{'\u2190'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirm & Pay</Text>
          {offer?.name && <Text style={styles.sub}>{offer.name}</Text>}
        </View>

        {/* Booking details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date</Text>
            <Text style={styles.summaryVal}>
              {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Time</Text>
            <Text style={styles.summaryVal}>{time}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Guests</Text>
            <Text style={styles.summaryVal}>{guests}</Text>
          </View>
          {notes.trim() ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Notes</Text>
              <Text style={[styles.summaryVal, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Payment breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Summary</Text>
          <View style={styles.payBreakdown}>
            {price > 0 && (
              <View style={styles.payRow}>
                <Text style={styles.payLabel}>Offer Price</Text>
                <Text style={styles.payVal}>{fmtMoney(price)}</Text>
              </View>
            )}
            <View style={[styles.payRow, styles.payTotalRow]}>
              <Text style={styles.payTotalLabel}>Advance to Pay Now</Text>
              <Text style={styles.payTotalVal}>{fmtMoney(advanceRupees)}</Text>
            </View>
          </View>
          <Text style={styles.payNote}>
            Remaining balance (if any) is payable at the venue on the day of your visit.
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.payBtn, loading && { opacity: 0.5 }]}
            onPress={handlePayAndBook}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.payBtnText}>Pay {fmtMoney(advanceRupees)} & Book</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Form view (date/time/guests selection) ──────────────────────────────────
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{copy.title}</Text>
        {(offer?.name || brand?.name) && (
          <Text style={styles.sub}>{offer?.name || brand?.name}</Text>
        )}
      </View>

      {/* Offer summary with advance info */}
      {offer && (
        <View style={styles.card}>
          <View style={styles.offerRow}>
            <Text style={styles.offerName}>{offer.name || offer.title || brand?.name}</Text>
            {price > 0 && <Text style={styles.offerPrice}>{fmtMoney(price)}</Text>}
          </View>
          {offer.description ? <Text style={styles.offerDesc}>{offer.description}</Text> : null}
          <View style={styles.advanceBadge}>
            <Text style={styles.advanceBadgeText}>
              Advance: {fmtMoney(advanceRupees)}
            </Text>
          </View>
        </View>
      )}

      {/* Date picker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Select Date</Text>
        <DatePicker selected={date} onSelect={setDate} />
      </View>

      {/* Time picker \u2014 chips for restaurants/salons, free-text for others */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{copy.timeLabel}</Text>
        {copy.showTimeSlots && timeSlots.length > 0 ? (
          <TimeSlotPicker slots={timeSlots} selected={time} onSelect={setTime} />
        ) : (
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="e.g. 2:00 PM or 14:00"
            placeholderTextColor={colors.t3}
          />
        )}

        <Text style={[styles.cardTitle, { marginTop: 12 }]}>{copy.peopleLabel}</Text>
        <View style={styles.guestRow}>
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => setGuests(g => String(Math.max(1, parseInt(g || '1', 10) - 1)))}>
            <Text style={styles.guestBtnText}>{'\u2212'}</Text>
          </TouchableOpacity>
          <Text style={styles.guestCount}>{guests}</Text>
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => setGuests(g => String(parseInt(g || '1', 10) + 1))}>
            <Text style={styles.guestBtnText}>+</Text>
          </TouchableOpacity>
          <Text style={styles.guestSuffix}>{copy.peopleSuffix}</Text>
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

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookBtn, (!date || !time) && { opacity: 0.5 }]}
          onPress={handleReviewBooking}
          disabled={!date || !time}
        >
          <Text style={styles.bookBtnText}>Review & Pay {fmtMoney(advanceRupees)}</Text>
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
  offerDesc: { fontSize: 12, color: colors.t3, lineHeight: 18, marginBottom: 8 },
  advanceBadge: { backgroundColor: colors.orangePale, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 4 },
  advanceBadgeText: { fontSize: 12, fontWeight: '700', color: colors.orangeDeep },
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
  guestSuffix: { fontSize: 12, color: colors.t3, marginLeft: 4 },

  // Time-slot chips (restaurants / salons)
  timeSlotChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    marginRight: 6,
    borderRadius: 18, backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.border,
  },
  timeSlotChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  timeSlotText: { fontSize: 12, fontWeight: '700', color: colors.t1 },
  timeSlotTextActive: { color: colors.white },
  noteInput: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 13, color: colors.t1, textAlignVertical: 'top' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  summaryVal: { fontSize: 12, color: colors.t1, fontWeight: '700' },
  // Payment summary styles
  payBreakdown: { backgroundColor: colors.surface2, borderRadius: 12, padding: 14, marginBottom: 12 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  payLabel: { fontSize: 14, color: colors.t2 },
  payVal: { fontSize: 14, fontWeight: '600', color: colors.t1 },
  payTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4, marginBottom: 0 },
  payTotalLabel: { fontSize: 16, fontWeight: '700', color: colors.t1 },
  payTotalVal: { fontSize: 20, fontWeight: '800', color: colors.orange },
  payNote: { fontSize: 11, color: colors.t3, lineHeight: 16 },
  payBtn: { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  payBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },
  // Confirmation styles
  checkMark: { fontSize: 48, color: colors.teal, marginBottom: 8 },
  confirmedTitle: { fontSize: 22, fontWeight: '800', color: colors.white },
  confirmedSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  confirmCard: { borderColor: colors.teal + '44', borderWidth: 1.5 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  confirmLabel: { fontSize: 13, color: colors.t3, fontWeight: '600' },
  confirmVal: { fontSize: 13, color: colors.t1, fontWeight: '700' },
  confirmRef: { fontSize: 18, fontWeight: '800', color: colors.navy, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  venueNote: { fontSize: 12, color: colors.t3, textAlign: 'center', marginHorizontal: 32, marginTop: 16, lineHeight: 18 },
  doneBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },
  // Form footer
  footer: { padding: 16 },
  bookBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  bookBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },
});
