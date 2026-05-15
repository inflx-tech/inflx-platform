import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Alert, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';

/**
 * SlotPickerScreen — appointment booking flow for salon services.
 *
 * Three sections (per spec section 6):
 *   1. Date strip — next 14 days
 *   2. Time slot grid — 30-min slots within salon hours; booked slots greyed;
 *      slots that would overflow service.duration_mins past closing greyed
 *   3. Stylist picker — visible only when service.requires_stylist_choice;
 *      auto-selects when only one stylist available; greys stylists not
 *      working that day
 *
 * Stylist availability: filters available_stylist_ids defensively against
 * brand_data.team_members. Dangling refs render as "stylist no longer
 * available" rather than crashing (per spec — v2 cleanup adds cascade
 * prompts).
 *
 * Confirm payload posts to /follower/prebook with booking_type='appointment'
 * + stylist_id + notes — persisted via migration 034 (atomic with this PR).
 *
 * Tracking is non-negotiable per contracts-v1 §1 — passed through from the
 * parent navigation entry; threaded into the prebook body.
 */

const SLOT_INTERVAL_MIN = 30;

export default function SlotPickerScreen({ navigation, route }) {
  const { service, brand, brandData, tracking, attribution } = route.params || {};
  const [selectedDate, setSelectedDate] = useState(() => formatDate(addDays(new Date(), 1)));
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedStylist, setSelectedStylist] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const accent = '#7c3aed';
  const variants = parseJson(service?.variants_json);
  const durationMins = Number(variants?.duration_mins || service?.duration_mins || 30);
  const requiresStylistChoice = !!variants?.requires_stylist_choice;
  const availableStylistIds = Array.isArray(variants?.available_stylist_ids) ? variants.available_stylist_ids : [];

  const teamMembers = useMemo(() => {
    const all = brandData?.team_members || [];
    if (!requiresStylistChoice) return [];
    return all.filter(tm => availableStylistIds.includes(tm.id));   // defensive — dangling refs dropped
  }, [brandData, requiresStylistChoice, availableStylistIds]);

  // Auto-select when only one stylist offers this service
  useEffect(() => {
    if (requiresStylistChoice && teamMembers.length === 1 && !selectedStylist) {
      setSelectedStylist(teamMembers[0].id);
    }
  }, [requiresStylistChoice, teamMembers, selectedStylist]);

  // Fetch booked slots for the selected date
  useEffect(() => {
    if (!service?.id || !selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    (async () => {
      try {
        const res = await followerApi.getSlots?.(service.id, selectedDate);
        if (cancelled) return;
        const slots = res?.data?.slots || res?.data || [];
        const booked = Array.isArray(slots)
          ? slots.filter(s => s.available === false).map(s => s.time)
          : [];
        setBookedSlots(booked);
      } catch (e) {
        if (!cancelled) setBookedSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => { cancelled = true; };
  }, [service?.id, selectedDate]);

  const allSlots = useMemo(
    () => generateSlotGrid(brandData?.hours_json, selectedDate, durationMins, requiresStylistChoice ? selectedStylist : null, teamMembers),
    [brandData, selectedDate, durationMins, selectedStylist, teamMembers, requiresStylistChoice]
  );

  const tokenAmount = 100;   // from salon.json's booking_config.token_amount
  const servicePrice = Number(service?.price || 0);
  const balance = Math.max(0, servicePrice - tokenAmount);

  async function handleConfirm() {
    if (!selectedTime) {
      Alert.alert('Pick a time', 'Select a time slot to continue.');
      return;
    }
    if (requiresStylistChoice && !selectedStylist) {
      Alert.alert('Pick a stylist', 'This service requires choosing a stylist.');
      return;
    }

    const token = await AsyncStorage.getItem('inflx_token');
    if (!token) {
      Alert.alert('Sign In Required', 'You need to sign in to book an appointment.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('FollowerLogin') },
      ]);
      return;
    }

    setSubmitting(true);
    try {
      const initRes = await followerApi.prebook({
        // Tracking — non-negotiable
        campaign_id: tracking?.campaign_id,
        set_id: tracking?.set_id,
        offer_id: tracking?.offer_id || null,
        campaign_influencer_id: tracking?.campaign_influencer_id,
        // Phase Salon-3 Q3 — explicit product attribution. The `service`
        // route param IS the brand_products row; service.id resolves directly.
        // Backend's resolveProductId() prefers this over offer.products_json
        // fallback when both are available.
        product_id: service?.id || null,
        // Existing /follower/prebook payload shape (per Code's isolated
        // decision #3 — adapts spec's wrapper to the wire format).
        booking_date: selectedDate,
        booking_time: selectedTime,
        guest_count: 1,
      });

      if (!initRes.success && !initRes.data) {
        Alert.alert('Booking Failed', initRes.error?.message || 'Please try again');
        setSubmitting(false);
        return;
      }

      const orderId = initRes.data?.razorpay_order_id;
      const keyId = initRes.data?.razorpay_key_id;
      const advanceRupees = initRes.data?.advance_amount || tokenAmount;

      const payResult = await processPayment({
        amount: Math.round(advanceRupees * 100),
        orderId,
        keyId,
        description: `Book ${service?.name}`,
        brandName: brand?.name || 'INFLX Salon',
      });

      if (!payResult) {
        Alert.alert('Payment Cancelled', 'You can try again anytime.');
        setSubmitting(false);
        return;
      }

      const verifyRes = await followerApi.prebookVerify({
        razorpay_order_id: payResult.razorpay_order_id,
        razorpay_payment_id: payResult.razorpay_payment_id,
        razorpay_signature: payResult.razorpay_signature,
        // Migration 034: typed booking discriminator + appointment-specific
        // fields. Backend writes to follower_bookings.booking_type +
        // .stylist_id + .notes.
        booking_type: 'appointment',
        stylist_id: selectedStylist || null,
        notes: notes.trim() || null,
      });

      if (verifyRes.success || verifyRes.data) {
        const paidRupees = verifyRes.data?.advance_paid ?? tokenAmount;
        Alert.alert(
          'Appointment Booked! 💇',
          `${selectedDate} ${selectedTime}. Token ${fmtRupees(paidRupees)} paid. Balance ${fmtRupees(balance)} at the salon.`,
          [{ text: 'Done', onPress: () => navigation.popToTop() }]
        );
      } else {
        Alert.alert('Verification Failed', verifyRes.error?.message || 'Payment received but verification failed. Contact support.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const dateOptions = useMemo(() => generateDateStrip(14), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.headerBack}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Book appointment</Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Service summary */}
        <View style={styles.serviceCard}>
          <View style={styles.serviceImg}>
            {service?.image_url
              ? <Image source={{ uri: service.image_url }} style={{ width: '100%', height: '100%' }} />
              : <Text style={{ fontSize: 26 }}>💇</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.serviceName}>{service?.name}</Text>
            <Text style={styles.serviceMeta}>{durationMins}m · {fmtRupees(servicePrice)}</Text>
            {attribution?.influencer_name && (
              <Text style={[styles.attrText, { color: accent }]}>{attribution.influencer_name}'s deal · {attribution.discount_label}</Text>
            )}
          </View>
        </View>

        {/* Date strip */}
        <Text style={styles.sectionLabel}>Pick date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
          {dateOptions.map(d => {
            const isSel = d.value === selectedDate;
            return (
              <TouchableOpacity key={d.value}
                style={[styles.dateBox, isSel && { backgroundColor: accent, borderColor: accent }]}
                onPress={() => { setSelectedDate(d.value); setSelectedTime(null); }}>
                <Text style={[styles.dateDow, isSel && { color: '#000' }]}>{d.dow}</Text>
                <Text style={[styles.dateNum, isSel && { color: '#000' }]}>{d.day}</Text>
                <Text style={[styles.dateMon, isSel && { color: '#000' }]}>{d.mon}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Slot grid */}
        <Text style={styles.sectionLabel}>Pick time</Text>
        {loadingSlots ? (
          <Text style={styles.loadingText}>Loading slots…</Text>
        ) : (
          <View style={styles.slotGrid}>
            {allSlots.map(slot => {
              const isBooked = bookedSlots.includes(slot.time);
              const disabled = isBooked || slot.disabled;
              const isSel = slot.time === selectedTime;
              return (
                <TouchableOpacity key={slot.time}
                  disabled={disabled}
                  onPress={() => setSelectedTime(slot.time)}
                  style={[
                    styles.slotBtn,
                    isSel && { backgroundColor: accent, borderColor: accent },
                    disabled && styles.slotDisabled,
                  ]}>
                  <Text style={[styles.slotText, isSel && { color: '#000' }, disabled && { color: 'rgba(255,255,255,0.3)' }]}>
                    {slot.time}
                  </Text>
                  {disabled && !isBooked && (
                    <Text style={styles.slotReason}>{slot.reason || ''}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            {allSlots.length === 0 && (
              <Text style={styles.loadingText}>No slots available — salon may be closed.</Text>
            )}
          </View>
        )}

        {/* Stylist picker (conditional) */}
        {requiresStylistChoice && (
          <>
            <Text style={styles.sectionLabel}>Pick stylist</Text>
            {teamMembers.length === 0 ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>No stylists configured for this service. Tap to call salon.</Text>
              </View>
            ) : teamMembers.length === 1 ? (
              <View style={styles.singleStylist}>
                <Text style={styles.singleStylistText}>Your stylist: <Text style={{ fontWeight: '700', color: accent }}>{teamMembers[0].name}</Text></Text>
              </View>
            ) : (
              <View style={styles.stylistGrid}>
                {teamMembers.map(tm => {
                  const working = isWorkingOnDate(tm, selectedDate);
                  const isSel = tm.id === selectedStylist;
                  return (
                    <TouchableOpacity key={tm.id}
                      disabled={!working}
                      onPress={() => setSelectedStylist(tm.id)}
                      style={[
                        styles.stylistCard,
                        isSel && { borderColor: accent, backgroundColor: 'rgba(124,58,237,0.1)' },
                        !working && styles.stylistDisabled,
                      ]}>
                      <View style={styles.stylistAvatar}>
                        {tm.photo_url
                          ? <Image source={{ uri: tm.photo_url }} style={{ width: '100%', height: '100%' }} />
                          : <Text style={{ fontSize: 18 }}>💇</Text>}
                      </View>
                      <Text style={[styles.stylistName, !working && { color: 'rgba(255,255,255,0.4)' }]}>{tm.name}</Text>
                      <Text style={styles.stylistRole}>{tm.role}</Text>
                      {!working && <Text style={styles.stylistOff}>Not available {dayLabel(selectedDate)}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything the salon should know…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          maxLength={240}
        />

        {/* Price breakdown */}
        <View style={styles.breakdown}>
          <Row label="Service price" value={fmtRupees(servicePrice)} />
          <Row label="Token now" value={fmtRupees(tokenAmount)} amber />
          <Row label="Balance at salon" value={fmtRupees(balance)} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.payCTAWrap}>
        <TouchableOpacity
          style={[styles.payBtn, (!selectedTime || submitting) && { backgroundColor: '#3a4150' }]}
          onPress={handleConfirm}
          disabled={!selectedTime || submitting}>
          <Text style={[styles.payBtnText, (!selectedTime || submitting) && { color: 'rgba(255,255,255,0.5)' }]}>
            {submitting ? 'Processing…' : `Pay ${fmtRupees(tokenAmount)} to confirm`}
          </Text>
          <Text style={{ fontSize: 14, color: !selectedTime || submitting ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.6)' }}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Row({ label, value, amber }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, amber && { color: '#7c3aed', fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  value: { fontSize: 12, fontWeight: '600', color: '#fff' },
});

function parseJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

function pad(n) { return String(n).padStart(2, '0'); }
function formatDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_KEY = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

function dayLabel(dateStr) {
  const d = new Date(dateStr);
  return DOW[d.getDay()];
}

function generateDateStrip(count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const d = addDays(new Date(), i);
    out.push({
      value: formatDate(d),
      dow: DOW[d.getDay()],
      day: pad(d.getDate()),
      mon: MON[d.getMonth()],
    });
  }
  return out;
}

function isWorkingOnDate(tm, dateStr) {
  if (!tm?.schedule_json || !dateStr) return true;
  const d = new Date(dateStr);
  const key = DOW_KEY[d.getDay()];
  return !!tm.schedule_json[key];
}

/**
 * Build the slot grid for a given date. Brand hours_json is a free-form
 * string today (not parseable per-day) so we fall back to 09:00–20:00. If
 * the brand's hours_json eventually becomes structured per-day, this
 * function picks up the change automatically.
 *
 * Slots that would extend past closing time given service.duration_mins
 * are marked disabled with reason="too long for closing".
 *
 * Stylist working hours: when a stylist is selected, slots outside their
 * personal schedule_json for that day are also disabled.
 */
function generateSlotGrid(hoursJson, dateStr, durationMins, stylistId, teamMembers) {
  const dayOpen = '09:00';
  const dayClose = '20:00';

  // Stylist-specific schedule narrows the window
  let openStr = dayOpen, closeStr = dayClose;
  if (stylistId) {
    const tm = teamMembers.find(t => t.id === stylistId);
    const d = new Date(dateStr);
    const dayKey = DOW_KEY[d.getDay()];
    const slot = tm?.schedule_json?.[dayKey];
    if (slot) {
      openStr = slot.open || dayOpen;
      closeStr = slot.close || dayClose;
    } else if (tm) {
      return [];   // stylist not working this day
    }
  }

  const open = parseTime(openStr);
  const close = parseTime(closeStr);
  if (open == null || close == null || close <= open) return [];

  const slots = [];
  for (let m = open; m + durationMins <= close + 1; m += SLOT_INTERVAL_MIN) {
    const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    const overflows = m + durationMins > close;
    slots.push({ time, disabled: overflows, reason: overflows ? 'too long for closing' : null });
  }
  return slots;
}

function parseTime(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerBack: { fontSize: 18, color: '#fff', fontWeight: '600' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  serviceCard: { margin: 16, backgroundColor: '#0D1D2E', borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  serviceImg: { width: 60, height: 50, borderRadius: 8, backgroundColor: '#142438', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  serviceName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  serviceMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  attrText: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 10, marginBottom: 8 },
  dateStrip: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  dateBox: { width: 56, alignItems: 'center', backgroundColor: '#0D1D2E', borderRadius: 11, padding: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  dateDow: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  dateNum: { fontSize: 18, fontWeight: '800', color: '#fff', marginVertical: 2 },
  dateMon: { fontSize: 9, color: 'rgba(255,255,255,0.5)' },
  loadingText: { paddingHorizontal: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16 },
  slotBtn: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', minWidth: 64, alignItems: 'center' },
  slotText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  slotReason: { fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  slotDisabled: { backgroundColor: '#0a1626', opacity: 0.6 },
  errorBox: { marginHorizontal: 16, padding: 10, backgroundColor: 'rgba(255,90,90,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,90,90,0.25)' },
  errorText: { fontSize: 11, color: 'rgba(255,180,180,0.9)' },
  singleStylist: { marginHorizontal: 16, padding: 10, backgroundColor: '#0D1D2E', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  singleStylistText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  stylistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  stylistCard: { width: '48%', padding: 10, backgroundColor: '#0D1D2E', borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  stylistDisabled: { opacity: 0.45 },
  stylistAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#142438', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stylistName: { fontSize: 12, fontWeight: '700', color: '#fff' },
  stylistRole: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  stylistOff: { fontSize: 9, color: 'rgba(255,180,90,0.7)', marginTop: 4, fontStyle: 'italic' },
  notesInput: { marginHorizontal: 16, padding: 10, backgroundColor: '#0D1D2E', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, minHeight: 60, textAlignVertical: 'top' },
  breakdown: { marginHorizontal: 16, marginTop: 14, padding: 12, backgroundColor: '#0D1D2E', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  payCTAWrap: { padding: 12, paddingHorizontal: 16, paddingBottom: 18, backgroundColor: '#07111E', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  payBtn: { backgroundColor: '#7c3aed', borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
