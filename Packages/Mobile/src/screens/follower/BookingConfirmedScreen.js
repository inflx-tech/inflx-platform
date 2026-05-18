/**
 * BookingConfirmedScreen — Wave 4 PR 4.3 (mockup Flow 3.2).
 *
 * Reached via navigation.replace() from RestaurantBookingScreen after
 * a successful prebook + verify cycle. Pure success state — no API
 * calls, no further mutation. The booking record + creator attribution
 * are passed in via route.params.
 *
 * Layout:
 *   - Success splash (yellow circle + ✓)
 *   - Headline: "Table booked"
 *   - Sub: "<brand> · <when> · N guests"
 *   - QR card with fake QR pattern + mono ref code + table number
 *   - CreatorChip when tracking carries an influencer_id
 *   - Pre-order Sagar's Table upsell card (only when creator picks)
 *   - Bottom CTA: Directions + Done
 *
 * The "QR" is a decorative 6×6 grid of dark/light squares rather than
 * a real QR scan target. Real QR generation needs a native dep
 * (react-native-qrcode-svg), which would require an APK rebuild. The
 * staff scan flow today uses the reference code, not the QR — so this
 * is functionally correct until QR rendering is needed for a future
 * scan flow.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, fonts } from '../../theme/tokens';
import { CreatorChip } from '../../components/restaurant';

// Static QR pattern — visual stand-in only. Real scan target would
// embed reference_code into a payload string and render via SVG.
const QR_PATTERN = [
  [1,1,1,0,1,0,1,1],
  [1,0,1,0,0,1,0,1],
  [1,0,1,1,1,0,1,1],
  [0,1,0,1,0,1,1,0],
  [1,1,1,0,1,0,0,1],
  [0,1,0,1,1,1,0,1],
  [1,0,1,0,0,1,1,1],
  [1,1,1,1,1,0,1,0],
];

export default function BookingConfirmedScreen({ route, navigation }) {
  const { brand, booking, tracking, offer } = route.params || {};

  const dateStr = booking?.booking_date
    ? new Date(booking.booking_date).toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : '';
  const timeStr = booking?.booking_time || '';
  const guestStr = booking?.guest_count ? `${booking.guest_count} guests` : '';
  const subLine = [brand?.business_name, dateStr, timeStr, guestStr].filter(Boolean).join(' · ');

  // Wave 5D — restaurant table bookings land as 'pending' until the
  // restaurant confirms in BookingsInbox. Reflect that honestly here
  // instead of telling the follower it's locked in.
  const isPending = booking?.brand_status === 'pending';
  const headlineText = isPending ? 'Reservation requested' : 'Table booked';
  const subPrefix = isPending
    ? `Awaiting confirmation from ${brand?.business_name || 'the restaurant'}`
    : null;

  const creator = tracking?.influencer_handle ? {
    handle: tracking.influencer_handle,
    name: tracking.influencer_name,
    verified: true,
  } : (offer?.influencer_handle ? {
    handle: offer.influencer_handle,
    name: offer.influencer_name,
    verified: true,
  } : null);

  function openDirections() {
    const url = brand?.listing_data?.google_maps_url
      || (brand?.lat && brand?.lng ? `https://www.google.com/maps?q=${brand.lat},${brand.lng}` : null);
    if (url) Linking.openURL(url).catch(() => {});
  }

  function done() {
    // Pop back to the dining home or wherever the user started.
    navigation.popToTop();
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <SafeAreaView edges={['top']}>

          {/* Success splash */}
          <View style={styles.splash}>
            <View style={[styles.check, isPending && styles.checkPending]}>
              <Text style={styles.checkGlyph}>{isPending ? '⏳' : '✓'}</Text>
            </View>
            <Text style={styles.headline}>{headlineText}</Text>
            {subPrefix ? (
              <Text style={[styles.sub, { color: lightColors.yellowDeep }]}>{subPrefix}</Text>
            ) : null}
            {subLine ? (
              <Text style={styles.sub}>{subLine}</Text>
            ) : null}
            {isPending ? (
              <Text style={styles.sub}>
                You'll get a notification the moment they confirm. Your reference
                code below works either way.
              </Text>
            ) : null}
          </View>

          {/* QR + ref card */}
          <View style={styles.qrCard}>
            <View style={styles.qrFrame}>
              {QR_PATTERN.map((row, ri) => (
                <View key={ri} style={styles.qrRow}>
                  {row.map((cell, ci) => (
                    <View key={ci} style={[styles.qrCell, cell === 1 && styles.qrCellOn]} />
                  ))}
                </View>
              ))}
            </View>
            <Text style={styles.refLine}>
              {booking?.reference_code} · {timeStr || '—'}
              {booking?.table_number ? ` · table #${booking.table_number}` : ''}
            </Text>
            {creator && (
              <View style={styles.creatorRow}>
                <CreatorChip handle={creator.handle} name={creator.name} verified={creator.verified} size="sm" />
              </View>
            )}
          </View>

          {/* Optional Sagar's Table upsell — shown only when a creator is attached.
              No data wiring yet (Wave 5+ feature) but the visual lives here so
              the flow looks complete in user testing. */}
          {creator && (
            <View style={styles.upsell}>
              <CreatorChip handle={creator.handle} name={creator.name} verified={creator.verified} size="sm" />
              <Text style={styles.upsellQuote}>
                "Want my exact 3-dish combo waiting on the table? Pre-order now."
              </Text>
              <Pressable
                onPress={() => navigation.popToTop()}
                style={styles.upsellBtn}>
                <Text style={styles.upsellBtnText}>Pre-order picks →</Text>
              </Pressable>
            </View>
          )}

          {booking?.special_requests?.length > 0 && (
            <View style={styles.requestsRow}>
              <Text style={styles.requestsLabel}>YOUR REQUESTS</Text>
              <Text style={styles.requestsValue}>
                {booking.special_requests.map(r => prettifyRequest(r)).join(' · ')}
              </Text>
            </View>
          )}

          <Text style={styles.footnote}>
            Show your reference code at {brand?.business_name || 'the restaurant'} on arrival.
            {booking?.advance_paid ? ` ₹${Math.round(booking.advance_paid)} advance paid; balance at the table.` : ''}
          </Text>

        </SafeAreaView>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
        <View style={styles.ctaInner}>
          <Pressable onPress={openDirections} style={[styles.ctaBtn, styles.ctaBtnSecondary]}>
            <Text style={styles.ctaSecondaryText}>🧭 Directions</Text>
          </Pressable>
          <Pressable onPress={done} style={[styles.ctaBtn, styles.ctaBtnPrimary]}>
            <Text style={styles.ctaPrimaryText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function prettifyRequest(key) {
  const map = {
    birthday:   '🎂 Birthday',
    outdoor:    '🌳 Outdoor seating',
    high_chair: '👶 High chair',
    accessible: '♿ Accessible',
  };
  return map[key] || key;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },

  splash: {
    alignItems: 'center',
    paddingTop: 30, paddingBottom: 18,
  },
  check: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: lightColors.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  checkPending: {
    backgroundColor: lightColors.yellow50,
    borderWidth: 2, borderColor: lightColors.yellow,
  },
  checkGlyph: {
    fontSize: 40, color: lightColors.ink,
    fontFamily: fonts.displayBlack,
  },
  headline: {
    fontFamily: fonts.displayBlack, fontSize: 26,
    color: lightColors.ink, letterSpacing: -0.5,
    marginTop: 16,
  },
  sub: {
    fontFamily: fonts.sansMedium, fontSize: 13,
    color: lightColors.muted, marginTop: 6,
    paddingHorizontal: 16, textAlign: 'center',
  },

  qrCard: {
    marginHorizontal: 16, marginTop: 18,
    backgroundColor: lightColors.paper,
    borderColor: lightColors.border, borderWidth: 1,
    borderRadius: 14, padding: 20,
    alignItems: 'center',
  },
  qrFrame: {
    width: 140, height: 140,
    backgroundColor: lightColors.surface,
    borderColor: lightColors.border, borderWidth: 1,
    borderRadius: 8, padding: 10,
  },
  qrRow: { flex: 1, flexDirection: 'row' },
  qrCell: { flex: 1, backgroundColor: 'transparent', margin: 0.5 },
  qrCellOn: { backgroundColor: lightColors.ink },

  refLine: {
    fontFamily: fonts.monoBold, fontSize: 11,
    color: lightColors.muted, marginTop: 12,
    textAlign: 'center',
  },
  creatorRow: { marginTop: 10 },

  upsell: {
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: lightColors.ink,
    borderRadius: 12, padding: 16,
    gap: 10,
  },
  upsellQuote: {
    fontFamily: fonts.sansMedium, fontSize: 13,
    color: lightColors.yellow100, fontStyle: 'italic',
    lineHeight: 18,
  },
  upsellBtn: {
    alignSelf: 'flex-start',
    backgroundColor: lightColors.yellow,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8,
  },
  upsellBtnText: {
    fontFamily: fonts.sansBold, fontSize: 12, color: lightColors.ink,
  },

  requestsRow: {
    marginHorizontal: 16, marginTop: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: lightColors.surface,
    borderRadius: 8,
  },
  requestsLabel: {
    fontFamily: fonts.monoBold, fontSize: 10,
    color: lightColors.muted, letterSpacing: 0.5,
  },
  requestsValue: {
    fontFamily: fonts.sansMedium, fontSize: 12,
    color: lightColors.ink2, marginTop: 4,
  },

  footnote: {
    paddingHorizontal: 16, marginTop: 18,
    fontFamily: fonts.sansMedium, fontSize: 11,
    color: lightColors.muted, textAlign: 'center',
    lineHeight: 16,
  },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: lightColors.paper,
    borderTopColor: lightColors.border, borderTopWidth: 1,
  },
  ctaInner: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  ctaBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  ctaBtnSecondary: {
    backgroundColor: lightColors.surface,
    borderColor: lightColors.border, borderWidth: 1,
  },
  ctaBtnPrimary: { backgroundColor: lightColors.yellow },
  ctaSecondaryText: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink2 },
  ctaPrimaryText:   { fontFamily: fonts.sansBold, fontSize: 14, color: lightColors.ink },
});
