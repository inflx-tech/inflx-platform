import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { darkColors, fmtRupees } from '../../theme/tokens';

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
            <View style={styles.actionBtn}><Text style={{ fontSize: 13, color: '#fff' }}>♡</Text></View>
            <View style={styles.actionBtn}><Text style={{ fontSize: 13, color: '#fff' }}>↗</Text></View>
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
              <View style={[styles.dealAvatar, { backgroundColor: '#F59E0B' }]}>
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
                <Text style={[styles.priceValue, row[2] && { color: '#10B981' }]}>{row[1]}</Text>
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

          <View style={{ height: 80 }} />
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('CarBooking', { vehicle, pricing, discount, tracking, pickupType })}>
          <View>
            <Text style={styles.ctaBtnText}>Pre-book {vehicle?.name?.split(' ').pop()}</Text>
            <Text style={styles.ctaBtnSub}>Pay just ₹300 token to confirm</Text>
          </View>
          <Text style={{ fontSize: 16, color: 'rgba(0,0,0,0.6)' }}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111E' },
  hero: { height: 228, backgroundColor: '#0A1D3E', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroEmoji: { fontSize: 80, opacity: 0.5 },
  backBtn: { position: 'absolute', top: 50, left: 13, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  actionBtns: { position: 'absolute', top: 50, right: 13, flexDirection: 'row', gap: 7 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 15 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  vehicleName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  vehicleSub: { fontSize: 11, color: 'rgba(255,255,255,0.38)' },
  ratingBox: { backgroundColor: '#0D1D2E', borderRadius: 10, padding: 6, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  ratingVal: { fontSize: 14, fontWeight: '800', color: '#F59E0B' },
  ratingTrips: { fontSize: 9, color: 'rgba(255,255,255,0.38)' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  stars: { color: '#F59E0B', fontSize: 11 },
  reviewCount: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.2)' },
  locText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  dealStrip: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', borderRadius: 12, padding: 10, marginBottom: 13 },
  dealAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dealInitial: { fontSize: 11, fontWeight: '800', color: '#000' },
  dealName: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },
  dealSub: { fontSize: 10, color: 'rgba(255,255,255,0.42)', marginTop: 1 },
  dealBadge: { backgroundColor: '#F59E0B', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  dealBadgeText: { fontSize: 12, fontWeight: '800', color: '#000' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 4 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 },
  specBox: { width: '31%', backgroundColor: '#0D1D2E', borderRadius: 9, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  specBoxGreen: { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' },
  specVal: { fontSize: 13, fontWeight: '700', color: '#fff' },
  specValGreen: { color: '#10B981' },
  specKey: { fontSize: 9, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  featuresRow: { gap: 6, paddingBottom: 13 },
  featureChip: { backgroundColor: '#142438', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  featureText: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  tabBar: { flexDirection: 'row', backgroundColor: '#0D1D2E', borderRadius: 11, padding: 4, marginBottom: 13 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  tabOn: { backgroundColor: '#F59E0B' },
  tabText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.38)' },
  tabTextOn: { color: '#000' },
  pricingBox: { backgroundColor: '#0D1D2E', borderRadius: 13, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  priceMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  priceBig: { fontSize: 26, fontWeight: '800', color: '#fff' },
  pricePer: { fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3 },
  saveBadge: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  saveText: { fontSize: 10, fontWeight: '700', color: '#10B981' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  priceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.42)' },
  priceValue: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  pickupRow: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  pickupOpt: { flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 11, padding: 10 },
  pickupOptOn: { borderColor: '#F59E0B' },
  pickupTitle: { fontSize: 11, fontWeight: '700', color: '#fff' },
  pickupSub: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 },
  pickupExtra: { fontSize: 10, color: '#F59E0B', marginTop: 2, fontWeight: '600' },
  ctaWrap: { padding: 11, paddingHorizontal: 15, paddingBottom: 16, backgroundColor: '#07111E', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  ctaBtn: { backgroundColor: '#F59E0B', borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  ctaBtnSub: { fontSize: 10, fontWeight: '600', color: 'rgba(0,0,0,0.65)' },
});
