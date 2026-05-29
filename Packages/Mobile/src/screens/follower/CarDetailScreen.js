import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { openDirections } from '../../hooks/useLocation';

// Car wayfinding tint (this screen is car-rental) — getBusinessAccentLight('car_rental').pale
const CAR_PALE = '#DBEAFE';

/**
 * CarDetailScreen — vehicle detail page matching the follower app mockup.
 *
 * Shows: hero image, vehicle name/variant, rating, influencer deal strip,
 * spec grid (6 boxes), feature chips, pricing tabs (With Driver / Self Drive / Outstation),
 * pickup options, sticky CTA.
 */

const PRICING_TABS = [
  { key: 'with_driver', label: 'With Driver' },
  { key: 'self_drive', label: 'Self Drive' },
  { key: 'outstation', label: 'Outstation' },
];

export default function CarDetailScreen({ navigation, route }) {
  const { vehicle, pricing, discount, tracking } = route.params || {};
  const [activeTab, setActiveTab] = useState('with_driver');
  const [pickupType, setPickupType] = useState('garage');

  const specs = vehicle?.specs || {};
  const features = specs.features || [];
  const dayRate = pricing?.day_rate || 1800;
  const discountPct = discount?.value || 0;
  const discountedRate = Math.round(dayRate * (1 - discountPct / 100));

  const tabData = {
    with_driver: {
      big: fmtRupees(discountedRate),
      per: `per day · ${discount?.influencer_name ? discount.influencer_name + "'s " + discountPct + '% off applied' : ''}`,
      save: fmtRupees(dayRate - discountedRate),
      rows: [
        ['Base rate', `${fmtRupees(dayRate)} / day`],
        [discount?.influencer_name ? `${discount.influencer_name}'s offer` : 'Offer', `-${discountPct}% (${fmtRupees(dayRate - discountedRate)} off)`, true],
        ['Driver allowance', '₹300 / day'],
        ['KM included', '250 km / day'],
        ['Extra km rate', `₹${pricing?.extra_km_charge || 16} / km`],
      ],
    },
    self_drive: {
      big: fmtRupees(Math.round(discountedRate * 0.67)),
      per: 'self drive per day',
      save: fmtRupees(Math.round(dayRate * 0.67 - discountedRate * 0.67)),
      rows: [
        ['Base rate', `${fmtRupees(Math.round(dayRate * 0.67))} / day`],
        ['Offer', `-${discountPct}%`, true],
        ['KM limit', '300 km / day'],
        ['Extra km rate', `₹${pricing?.extra_km_charge || 12} / km`],
        ['Security deposit', `${fmtRupees(pricing?.security_deposit || 5000)} refundable`],
      ],
    },
    outstation: {
      big: `₹${pricing?.km_rate || 14}/km`,
      per: 'outstation · min 250 km/day',
      save: 'Best for trips',
      rows: [
        ['Rate per km', `₹${pricing?.km_rate || 14} (after offer)`],
        ['Min km / day', '250 km'],
        ['Driver allowance', '₹300 / day'],
        ['Night halt', '₹500 / night'],
        ['Toll & parking', 'Renter pays'],
      ],
    },
  };

  const currentTab = tabData[activeTab];

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🚗</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.actionBtns}>
            <View style={styles.actionBtn}><Text style={{ fontSize: 13, color: P.ink }}>♡</Text></View>
            <View style={styles.actionBtn}><Text style={{ fontSize: 13, color: P.ink }}>↗</Text></View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Name + rating */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleName}>{vehicle?.name}</Text>
              <Text style={styles.vehicleSub}>{vehicle?.year} · {vehicle?.variant}</Text>
            </View>
            <View style={styles.ratingBox}>
              <Text style={styles.ratingVal}>{vehicle?.rating || '4.8'}</Text>
              <Text style={styles.ratingTrips}>{vehicle?.trips || 124} trips</Text>
            </View>
          </View>

          <View style={styles.ratingRow}>
            <Text style={styles.stars}>★★★★★</Text>
            <Text style={styles.reviewCount}>{vehicle?.trips || 124} reviews</Text>
            <View style={styles.dot} />
            <Text style={styles.locText}>{vehicle?.location} · {vehicle?.distance}</Text>
          </View>

          {/* Influencer deal strip */}
          {discount?.influencer_name && (
            <View style={styles.dealStrip}>
              <View style={[styles.dealAvatar, { backgroundColor: P.yellow }]}>
                <Text style={styles.dealInitial}>{discount.influencer_initial || discount.influencer_name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dealName}>{discount.influencer_name}'s exclusive deal</Text>
                <Text style={styles.dealSub}>@{discount.influencer_handle} · Valid till {discount.valid_till || 'Apr 30'}</Text>
              </View>
              <View style={styles.dealBadge}>
                <Text style={styles.dealBadgeText}>{discountPct}% OFF</Text>
              </View>
            </View>
          )}

          {/* Spec grid */}
          <Text style={styles.sectionLabel}>Vehicle specs</Text>
          <View style={styles.specGrid}>
            {[
              { val: specs.seats || '5', key: 'Seats' },
              { val: (specs.fuel_type || 'Petrol').split(' / ')[0], key: 'Fuel' },
              { val: (specs.transmission || 'Auto').split(' / ')[0], key: 'Gearbox' },
              { val: specs.engine_cc || '1497cc', key: 'Engine' },
              { val: specs.kmpl || '17', key: 'KMPL' },
              { val: 'Covered', key: 'Insurance', green: true },
            ].map((s, i) => (
              <View key={i} style={[styles.specBox, s.green && styles.specBoxGreen]}>
                <Text style={[styles.specVal, s.green && styles.specValGreen]}>{s.val}</Text>
                <Text style={styles.specKey}>{s.key}</Text>
              </View>
            ))}
          </View>

          {/* Features */}
          <Text style={styles.sectionLabel}>Features</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuresRow}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureChip}>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Pricing tabs */}
          <Text style={styles.sectionLabel}>Pricing</Text>
          <View style={styles.tabBar}>
            {PRICING_TABS.map(t => (
              <TouchableOpacity key={t.key} style={[styles.tab, activeTab === t.key && styles.tabOn]} onPress={() => setActiveTab(t.key)}>
                <Text style={[styles.tabText, activeTab === t.key && styles.tabTextOn]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pricing box */}
          <View style={styles.pricingBox}>
            <View style={styles.priceMainRow}>
              <View>
                <Text style={styles.priceBig}>{currentTab.big}</Text>
                <Text style={styles.pricePer}>{currentTab.per}</Text>
              </View>
              <View style={styles.saveBadge}>
                <Text style={styles.saveText}>Save {currentTab.save}</Text>
              </View>
            </View>
            {currentTab.rows.map((row, i) => (
              <View key={i} style={styles.priceRow}>
                <Text style={styles.priceLabel}>{row[0]}</Text>
                <Text style={[styles.priceValue, row[2] && { color: P.successText }]}>{row[1]}</Text>
              </View>
            ))}
          </View>

          {/* Pickup options */}
          <Text style={styles.sectionLabel}>Pickup</Text>
          <View style={styles.pickupRow}>
            {[
              { key: 'garage', title: 'Garage pickup', sub: vehicle?.location || 'Rental location', extra: 'Free' },
              { key: 'doorstep', title: 'Doorstep delivery', sub: 'Delivered to your address', extra: '+₹200 extra' },
            ].map(opt => (
              <TouchableOpacity key={opt.key} style={[styles.pickupOpt, pickupType === opt.key && styles.pickupOptOn]} onPress={() => setPickupType(opt.key)}>
                <Text style={styles.pickupTitle}>{opt.title}</Text>
                <Text style={styles.pickupSub}>{opt.sub}</Text>
                <Text style={styles.pickupExtra}>{opt.extra}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Directions button */}
          {vehicle?.brand_lat && vehicle?.brand_lng && (
            <TouchableOpacity
              style={{ backgroundColor: P.bg2, borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, borderWidth: 1, borderColor: P.border }}
              onPress={() => openDirections(vehicle.brand_lat, vehicle.brand_lng, vehicle.location)}
            >
              <Text style={{ fontSize: 14 }}>📍</Text>
              <Text style={{ color: P.yellowText, fontSize: 12, fontFamily: fonts.sansBold }}>Get Directions to {vehicle.location || 'Garage'}</Text>
            </TouchableOpacity>
          )}

          {/* Distance badge */}
          {vehicle?.distance_text && (
            <View style={{ backgroundColor: P.bg2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 14 }}>
              <Text style={{ color: P.muted, fontSize: 11, fontFamily: fonts.monoMedium }}>📍 {vehicle.distance_text} away</Text>
            </View>
          )}

          <View style={{ height: 80 }} />
        </View>
      </ScrollView>

      {/* Sticky CTAs — Book Now (full) + Pre-book (token) */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('CarBooking', { vehicle, pricing, discount, tracking, pickupType, bookingType: 'full' })}>
          <View>
            <Text style={styles.ctaBtnText}>Book {vehicle?.name?.split(' ').pop()}</Text>
            <Text style={styles.ctaBtnSub}>Pay full amount & confirm instantly</Text>
          </View>
          <Text style={{ fontSize: 16, color: P.yellow }}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: P.bg2, borderWidth: 1, borderColor: P.border, marginTop: 8 }]}
          onPress={() => navigation.navigate('CarBooking', { vehicle, pricing, discount, tracking, pickupType, bookingType: 'token' })}
        >
          <View>
            <Text style={[styles.ctaBtnText, { color: P.ink }]}>Pre-book with ₹300 token</Text>
            <Text style={[styles.ctaBtnSub, { color: P.muted }]}>Pay balance at garage</Text>
          </View>
          <Text style={{ fontSize: 16, color: P.yellowText }}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  hero: { height: 228, backgroundColor: CAR_PALE, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroEmoji: { fontSize: 80, opacity: 0.6 },
  backBtn: { position: 'absolute', top: 50, left: 13, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 16, color: P.ink, fontWeight: '600' },
  actionBtns: { position: 'absolute', top: 50, right: 13, flexDirection: 'row', gap: 7 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 15 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  vehicleName: { fontFamily: fonts.displayBlack, fontSize: 20, color: P.ink },
  vehicleSub: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2 },
  ratingBox: { backgroundColor: P.white, borderRadius: 10, padding: 6, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: P.border },
  ratingVal: { fontFamily: fonts.monoBold, fontSize: 14, color: P.ink },
  ratingTrips: { fontFamily: fonts.monoMedium, fontSize: 9, color: P.muted2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  stars: { color: '#FFB800', fontSize: 11 },
  reviewCount: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: P.muted4 },
  locText: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted },
  dealStrip: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: P.yellowPale, borderWidth: 1, borderColor: '#F0DA88', borderRadius: 12, padding: 10, marginBottom: 13 },
  dealAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dealInitial: { fontFamily: fonts.displayBlack, fontSize: 11, color: P.ink },
  dealName: { fontFamily: fonts.monoBold, fontSize: 11, color: P.yellowText },
  dealSub: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2, marginTop: 1 },
  dealBadge: { backgroundColor: P.ink, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  dealBadgeText: { fontFamily: fonts.monoBold, fontSize: 12, color: P.yellow },
  sectionLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 4 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 },
  specBox: { width: '31%', backgroundColor: P.white, borderRadius: 9, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: P.border },
  specBoxGreen: { backgroundColor: P.successPale, borderColor: '#A8E6CC' },
  specVal: { fontFamily: fonts.monoBold, fontSize: 13, color: P.ink },
  specValGreen: { color: P.successText },
  specKey: { fontFamily: fonts.monoMedium, fontSize: 9, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  featuresRow: { gap: 6, paddingBottom: 13 },
  featureChip: { backgroundColor: P.bg2, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: P.border },
  featureText: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.ink2 },
  tabBar: { flexDirection: 'row', backgroundColor: P.bg2, borderRadius: 11, padding: 4, marginBottom: 13 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  tabOn: { backgroundColor: P.ink },
  tabText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: P.muted },
  tabTextOn: { color: P.white },
  pricingBox: { backgroundColor: P.white, borderRadius: 13, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: P.border },
  priceMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  priceBig: { fontFamily: fonts.monoBold, fontSize: 26, color: P.ink },
  pricePer: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2, marginTop: 3 },
  saveBadge: { backgroundColor: P.successPale, borderWidth: 1, borderColor: '#A8E6CC', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  saveText: { fontFamily: fonts.monoBold, fontSize: 10, color: P.successText },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  priceLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted },
  priceValue: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.ink },
  pickupRow: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  pickupOpt: { flex: 1, borderWidth: 1.5, borderColor: P.muted4, borderRadius: 11, padding: 10 },
  pickupOptOn: { borderColor: P.ink },
  pickupTitle: { fontFamily: fonts.sansBold, fontSize: 11, color: P.ink },
  pickupSub: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2, marginTop: 2 },
  pickupExtra: { fontFamily: fonts.monoBold, fontSize: 10, color: P.yellowText, marginTop: 2 },
  ctaWrap: { padding: 11, paddingHorizontal: 15, paddingBottom: 16, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.border },
  ctaBtn: { backgroundColor: P.ink, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaBtnText: { fontFamily: fonts.displayBlack, fontSize: 14, color: P.yellow },
  ctaBtnSub: { fontFamily: fonts.sansMedium, fontSize: 10, color: 'rgba(255,255,255,0.6)' },
});
