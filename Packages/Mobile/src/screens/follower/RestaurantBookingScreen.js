/**
 * RestaurantBookingScreen — Wave 4 PR 4.3 (mockup Flow 3.1).
 *
 * Replaces the generic PreBookScreen UI for restaurant table bookings.
 * Wraps the same followerApi.prebook + followerApi.prebookVerify API
 * contract, so backend behavior is unchanged — only the visual design
 * and the form structure differ.
 *
 * PreBookScreen.js dispatches here when brand.category === 'restaurant';
 * non-restaurant prebook flows (salon, car_rental, etc.) keep the legacy
 * UI until their own redesign waves.
 *
 * Layout:
 *   - App bar (back + title)
 *   - Restaurant header strip (small)
 *   - Date scroll (today + next 4 days, TONIGHT is highlighted)
 *   - Party size chips (1-6+)
 *   - Time slot grid (3-col) using the TimeSlot component
 *   - Special requests chips (Birthday / Outdoor / High chair / Accessible)
 *   - Sticky bottom CTA with running summary + Confirm
 *
 * On successful payment + verify, navigates to BookingConfirmedScreen
 * with the booking row.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { ensureFollowerAuth } from '../../utils/authGate';
import { TimeSlot, FilterChip, OfferPill } from '../../components/restaurant';

const SLOTS = [
  '12:00', '12:30', '1:00', '1:30', '2:00', '2:30',
  '7:00',  '7:30',  '8:00', '8:30', '9:00', '9:30', '10:00', '10:30',
];

const REQUESTS = [
  { key: 'birthday',   label: '🎂 Birthday' },
  { key: 'outdoor',    label: '🌳 Outdoor' },
  { key: 'high_chair', label: '👶 High chair' },
  { key: 'accessible', label: '♿ Accessible' },
];

const PARTY_SIZES = ['1', '2', '3', '4', '5', '6+'];

export default function RestaurantBookingScreen({ route, navigation }) {
  const { brand, brandId, tracking, offer, store, action } = route.params || {};
  const [dateIdx, setDateIdx]       = useState(0); // 0 = tonight
  const [party, setParty]           = useState('2');
  const [time, setTime]             = useState(null);
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(false);

  const dates = useMemo(() => buildDateOptions(), []);
  const selectedDate = dates[dateIdx];

  const offerLine = offer
    ? offer.label || offer.title || `${offer.discount_value || ''}% OFF`
    : null;

  function toggleRequest(key) {
    setRequests(r => r.includes(key) ? r.filter(x => x !== key) : [...r, key]);
  }

  async function handleConfirm() {
    if (!time) {
      Alert.alert('Pick a time', 'Choose a time slot to continue.');
      return;
    }
    // Booking requires a logged-in follower. Without this the prebook
    // call 401s into a dead "Session expired" with no login path.
    if (!(await ensureFollowerAuth(navigation,
      { message: 'Sign in to book a table. It only takes 30 seconds!' }))) return;

    // Resolve the mandatory creator-attribution ids. The offer object
    // (store.influencers[].offers[]) carries offer_id / set_id /
    // campaign_id / campaign_influencer_id; tracking is the fallback for
    // both naming conventions (cid/sid/iid from share links,
    // campaign_id/set_id/campaign_influencer_id from internal nav).
    const cid  = offer?.campaign_id            || tracking?.campaign_id            || tracking?.cid;
    const sid  = offer?.set_id                 || tracking?.set_id                 || tracking?.sid;
    const ciid = offer?.campaign_influencer_id  || tracking?.campaign_influencer_id || tracking?.iid;
    const offerId = offer?.offer_id || offer?.id || tracking?.offer_id || null;

    if (!cid || !sid || !ciid) {
      Alert.alert(
        'Booking not available',
        'This restaurant isn’t part of an active creator campaign right now, so table booking via INFLX isn’t available yet. You can still browse the menu.'
      );
      return;
    }

    setLoading(true);
    try {
      const initiateRes = await followerApi.prebook({
        offer_id:                offerId,
        campaign_id:             cid,
        set_id:                  sid,
        campaign_influencer_id:  ciid,
        booking_date:            selectedDate.iso,
        booking_time:            time,
        guest_count:             parseInt(party, 10) || 2,
        special_requests:        requests,
      });

      if (!initiateRes.success) {
        Alert.alert('Booking Failed', initiateRes.error?.message || 'Could not initiate booking');
        return;
      }
      const { razorpay_order_id, advance_amount } = initiateRes.data;

      // Mock payment for dev. Production uses Razorpay checkout.
      const razorpay_payment_id = `pay_mock_${Date.now()}`;

      const verifyRes = await followerApi.prebookVerify({
        razorpay_order_id, razorpay_payment_id,
      });
      if (!verifyRes.success) {
        Alert.alert('Payment Failed', verifyRes.error?.message || 'Payment could not be verified');
        return;
      }

      const vd = verifyRes.data || {};
      const booking = vd.booking || {};
      navigation.replace('BookingConfirmed', {
        brand,
        booking: {
          reference_code: booking.reference_code || vd.reference_code || `PRD-${Date.now().toString(36).toUpperCase().slice(-4)}`,
          booking_date:   selectedDate.iso,
          booking_time:   time,
          guest_count:    parseInt(party, 10) || 2,
          advance_paid:   advance_amount,
          table_number:   booking.table_number,
          special_requests: requests,
          // Wave 5D — 'pending' → confirmation screen shows "Requested,
          // awaiting confirmation" instead of "Table booked".
          brand_status:   booking.brand_status ?? vd.brand_status ?? null,
        },
        tracking,
        offer,
      });
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Summary string for sticky CTA — only meaningful once time is picked.
  const summaryLine = time
    ? `${selectedDate.label} · ${time} · ${party} guests${requests.length ? ` · ${formatRequestLabel(requests[0])}` : ''}`
    : 'Pick a time to continue';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.appbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={6}>
          <Text style={styles.iconBtnGlyph}>←</Text>
        </Pressable>
        <Text style={styles.appbarTitle}>Book a Table</Text>
        <View style={{ width: 36 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Restaurant header strip */}
        <View style={styles.brandStrip}>
          <View style={styles.brandStripPhoto}>
            <Text style={styles.brandStripPhotoGlyph}>🍽️</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brandStripName} numberOfLines={1}>
              {brand?.business_name || store?.brand_name || 'Restaurant'}
            </Text>
            <Text style={styles.brandStripMeta} numberOfLines={1}>
              {(brand?.locality || brand?.city || 'NEARBY').toUpperCase()}
            </Text>
          </View>
          {offerLine && <OfferPill label={offerLine} />}
        </View>

        {/* Date */}
        <Section title="When">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateScroll}>
            {dates.map((d, i) => (
              <Pressable key={d.iso} onPress={() => setDateIdx(i)}
                style={[styles.dateTile, dateIdx === i && styles.dateTileActive]}>
                <Text style={[styles.dateTileTop, dateIdx === i && styles.dateTileTopActive]}>
                  {d.dow}
                </Text>
                <Text style={[styles.dateTileBig, dateIdx === i && styles.dateTileBigActive]}>
                  {d.day}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Section>

        {/* Party size */}
        <Section title="Party size">
          <View style={styles.partyRow}>
            {PARTY_SIZES.map(p => (
              <Pressable key={p} onPress={() => setParty(p)}
                style={[styles.partyTile, party === p && styles.partyTileActive]}>
                <Text style={[styles.partyText, party === p && styles.partyTextActive]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Time slots */}
        <Section title="Time · Dinner">
          <View style={styles.slotGrid}>
            {SLOTS.map(s => (
              <View key={s} style={styles.slotCell}>
                <TimeSlot
                  time={s}
                  selected={time === s}
                  onPress={() => setTime(s)}
                />
              </View>
            ))}
          </View>
          <Text style={styles.slotLegend}>○ Available  ✕ Booked</Text>
        </Section>

        {/* Special requests */}
        <Section title="Any requests" optional>
          <View style={styles.chipWrap}>
            {REQUESTS.map(r => (
              <FilterChip key={r.key} label={r.label}
                selected={requests.includes(r.key)}
                onPress={() => toggleRequest(r.key)} />
            ))}
          </View>
        </Section>
      </ScrollView>

      {/* Sticky CTA */}
      <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
        <View style={styles.ctaInner}>
          <Text style={styles.ctaSummary} numberOfLines={1}>{summaryLine}</Text>
          <Pressable
            onPress={handleConfirm}
            disabled={!time || loading}
            style={[styles.ctaBtn, (!time || loading) && styles.ctaBtnDisabled]}
          >
            {loading
              ? <ActivityIndicator color={lightColors.ink} />
              : <Text style={styles.ctaBtnText}>Confirm booking →</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Section({ title, optional, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
        {optional && <Text style={styles.sectionOptional}>optional</Text>}
      </View>
      {children}
    </View>
  );
}

function buildDateOptions() {
  const out = [];
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = i === 0 ? 'TONIGHT' : d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
    const day = String(d.getDate()).padStart(2, '0');
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${day}`;
    out.push({ dow, day, iso, label: i === 0 ? 'Tonight' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) });
  }
  return out;
}

function formatRequestLabel(key) {
  const r = REQUESTS.find(x => x.key === key);
  return r?.label?.split(' ').slice(1).join(' ') || key;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },

  appbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
    backgroundColor: lightColors.bg,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: lightColors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnGlyph: { fontSize: 16, color: lightColors.ink },
  appbarTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: fonts.displayBold, fontSize: 17,
    color: lightColors.ink, letterSpacing: -0.2,
  },

  brandStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10,
    padding: 12, borderRadius: 10,
    backgroundColor: lightColors.surface,
  },
  brandStripPhoto: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: lightColors.yellow50,
    alignItems: 'center', justifyContent: 'center',
  },
  brandStripPhotoGlyph: { fontSize: 22 },
  brandStripName: {
    fontFamily: fonts.displayBold, fontSize: 14,
    color: lightColors.ink, letterSpacing: -0.1,
  },
  brandStripMeta: {
    fontFamily: fonts.monoMedium, fontSize: 10,
    color: lightColors.muted, marginTop: 2,
  },

  section: { paddingHorizontal: 16, marginTop: 18 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.monoBold, fontSize: 11,
    color: lightColors.muted, letterSpacing: 0.6,
  },
  sectionOptional: {
    fontFamily: fonts.sansMedium, fontSize: 10,
    color: lightColors.muted2,
  },

  dateScroll: { gap: 8, paddingRight: 16 },
  dateTile: {
    width: 56, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
    borderColor: lightColors.border2,
    backgroundColor: lightColors.paper,
    alignItems: 'center',
  },
  dateTileActive: {
    backgroundColor: lightColors.yellow,
    borderColor: lightColors.yellow,
  },
  dateTileTop: {
    fontFamily: fonts.monoBold, fontSize: 9,
    color: lightColors.muted, letterSpacing: 0.5,
  },
  dateTileTopActive: { color: lightColors.ink2 },
  dateTileBig: {
    fontFamily: fonts.displayBlack, fontSize: 17,
    color: lightColors.ink, marginTop: 2,
  },
  dateTileBigActive: { color: lightColors.ink },

  partyRow: { flexDirection: 'row', gap: 6 },
  partyTile: {
    flex: 1, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1,
    borderColor: lightColors.border2,
    backgroundColor: lightColors.paper,
    alignItems: 'center',
  },
  partyTileActive: {
    backgroundColor: lightColors.yellow,
    borderColor: lightColors.yellow,
  },
  partyText: {
    fontFamily: fonts.monoBold, fontSize: 13,
    color: lightColors.ink2,
  },
  partyTextActive: { color: lightColors.ink },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  slotCell: { width: '33.33%', paddingHorizontal: 3, paddingVertical: 3 },
  slotLegend: {
    fontFamily: fonts.monoMedium, fontSize: 10,
    color: lightColors.muted, marginTop: 8,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: lightColors.paper,
    borderTopColor: lightColors.border, borderTopWidth: 1,
  },
  ctaInner: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  ctaSummary: {
    fontFamily: fonts.sansMedium, fontSize: 12,
    color: lightColors.muted, marginBottom: 8,
  },
  ctaBtn: {
    backgroundColor: lightColors.yellow,
    paddingVertical: 14, borderRadius: 10,
    alignItems: 'center',
  },
  ctaBtnDisabled: { backgroundColor: lightColors.surface2 },
  ctaBtnText: {
    fontFamily: fonts.sansBold, fontSize: 14,
    color: lightColors.ink, letterSpacing: -0.1,
  },
});
