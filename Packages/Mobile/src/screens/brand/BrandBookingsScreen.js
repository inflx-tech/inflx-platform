import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

/**
 * Bookings inbox — mirror of brand-web /dashboard/bookings. Confirm/reject
 * pending bookings, browse today/upcoming/history, stats strip.
 * Contract: features/brand-mobile-parity-pack.
 */

const TABS = [
  { key: 'pending',   label: 'Pending' },
  { key: 'today',     label: 'Today' },
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PILL = {
  pending:   { bg: P.warnPale,  fg: P.warnText,  label: 'PENDING' },
  confirmed: { bg: P.successPale, fg: P.successText, label: 'CONFIRMED' },
  rejected:  { bg: P.dangerPale,  fg: P.dangerText,  label: 'REJECTED' },
  cancelled: { bg: P.bg2,         fg: P.muted,       label: 'CANCELLED' },
};

export default function BrandBookingsScreen({ navigation }) {
  const [tab, setTab]             = useState('pending');
  const [bookings, setBookings]   = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]       = useState(null);

  async function load(t = tab) {
    const res = await brandApi.listBookings(t);
    if (res?.success) {
      setBookings(res.data?.bookings || []);
      if (res.data?.stats) setStats(res.data.stats);
    }
    setLoading(false); setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { setLoading(true); load(tab); }, [tab]));

  async function act(id, action) {
    setActing(id);
    const res = action === 'confirm' ? await brandApi.confirmBooking(id) : await brandApi.rejectBooking(id);
    setActing(null);
    if (res?.success) load(tab);
    else Alert.alert('Failed', res?.error?.message || 'Could not update the booking.');
  }

  function confirmReject(id) {
    Alert.alert('Reject booking?', 'The customer will be notified and any advance refunded per policy.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => act(id, 'reject') },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.title}>Bookings</Text>
        <Text style={s.subtitle}>Confirm tables, slots and appointments</Text>
      </View>

      {stats && (
        <View style={s.statsRow}>
          <Stat label="Pending" value={stats.pending ?? 0} hot={Number(stats.pending) > 0} />
          <Stat label="Today" value={stats.today ?? 0} />
          <Stat label="Upcoming" value={stats.upcoming ?? 0} />
          <Stat label="7-day revenue" value={fmtMoney(stats.revenue_7d || 0)} />
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow} style={{ flexGrow: 0 }}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.chip, tab === t.key && s.chipOn]} onPress={() => setTab(t.key)}>
            <Text style={[s.chipTxt, tab === t.key && s.chipTxtOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={P.ink} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(tab); }} tintColor={P.ink} />}
        >
          {bookings.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📅</Text>
              <Text style={s.emptyTitle}>Nothing {tab === 'pending' ? 'awaiting you' : `in ${tab}`}</Text>
              <Text style={s.emptyText}>Follower bookings land here for your confirmation.</Text>
            </View>
          ) : bookings.map(b => {
            const date = b.booking_date || b.pickup_date;
            const d = date ? new Date(date) : null;
            const pill = PILL[b.brand_status === 'pending' && b.booking_status !== 'cancelled' ? 'pending'
              : b.booking_status === 'cancelled' ? 'cancelled'
              : b.brand_status] || PILL.pending;
            const isPending = b.brand_status === 'pending' && b.booking_status !== 'cancelled';
            return (
              <View key={b.id} style={s.card}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={s.dateBadge}>
                    <Text style={s.dateMon}>{d ? d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() : '—'}</Text>
                    <Text style={s.dateDay}>{d ? d.getDate() : '–'}</Text>
                    {!!b.booking_time && <Text style={s.dateTime}>{String(b.booking_time).slice(0, 5)}</Text>}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={s.cardName} numberOfLines={1}>{b.follower_name || 'Customer'}</Text>
                      <View style={[s.pill, { backgroundColor: pill.bg }]}>
                        <Text style={[s.pillTxt, { color: pill.fg }]}>{pill.label}</Text>
                      </View>
                    </View>
                    <Text style={s.cardMeta}>
                      {b.booking_type ? `${b.booking_type} · ` : ''}
                      {b.guest_count ? `party of ${b.guest_count} · ` : ''}
                      {b.reference_code ? `REF ${b.reference_code}` : ''}
                    </Text>
                    {!!b.instagram_handle && <Text style={s.via}>⭐ via @{b.instagram_handle}</Text>}
                    {!!b.notes && <Text style={s.notes} numberOfLines={2}>"{b.notes}"</Text>}
                    <Text style={s.amount}>
                      {Number(b.advance_paid) > 0 ? `Advance ${fmtMoney(b.advance_paid)} paid` : ''}
                      {b.net_amount != null && Number(b.net_amount) > 0 ? `  ·  ${fmtMoney(b.net_amount)}` : ''}
                    </Text>
                  </View>
                </View>
                {isPending && (
                  <View style={s.actions}>
                    <TouchableOpacity style={[s.btn, s.btnGhost]} disabled={acting === b.id} onPress={() => confirmReject(b.id)}>
                      <Text style={s.btnGhostTxt}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, s.btnFill]} disabled={acting === b.id} onPress={() => act(b.id, 'confirm')}>
                      <Text style={s.btnFillTxt}>{acting === b.id ? 'Working…' : 'Confirm'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value, hot }) {
  return (
    <View style={[s.stat, hot && { borderColor: P.ink, backgroundColor: P.bg2 }]}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header:    { backgroundColor: P.white, paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  back:      { paddingBottom: 6 },
  backText:  { fontFamily: fonts.sansMedium, fontSize: 11.5, fontWeight: '600', color: P.muted2 },
  title:     { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: P.ink, letterSpacing: -0.3 },
  subtitle:  { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, marginTop: 6 },
  statsRow:  { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 12, gap: 8 },
  stat:      { flex: 1, backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  statVal:   { fontSize: 14, fontWeight: '800', color: P.ink },
  statLbl:   { fontSize: 9.5, color: P.muted2, marginTop: 1, textAlign: 'center' },
  chipsRow:  { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  chip:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  chipOn:    { backgroundColor: P.bg2, borderColor: P.ink },
  chipTxt:   { fontSize: 11.5, fontWeight: '600', color: P.muted },
  chipTxtOn: { color: P.ink },
  card:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  dateBadge: { width: 52, backgroundColor: P.bg2, borderRadius: 10, alignItems: 'center', paddingVertical: 8 },
  dateMon:   { fontSize: 9, fontWeight: '800', color: P.muted2, letterSpacing: 0.6 },
  dateDay:   { fontSize: 18, fontWeight: '800', color: P.ink },
  dateTime:  { fontSize: 9.5, fontWeight: '700', color: P.muted, marginTop: 1 },
  cardName:  { fontSize: 14, fontWeight: '700', color: P.ink, flex: 1, marginRight: 8 },
  cardMeta:  { fontSize: 11.5, color: P.muted2, marginTop: 2 },
  via:       { fontSize: 11, color: P.ink, fontWeight: '600', marginTop: 2 },
  notes:     { fontSize: 11.5, color: P.muted, fontStyle: 'italic', marginTop: 4, backgroundColor: P.bg2, borderRadius: 8, padding: 8 },
  amount:    { fontSize: 12, fontWeight: '700', color: P.ink2, marginTop: 6 },
  pill:      { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pillTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  actions:   { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn:       { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnFill:   { backgroundColor: P.ink },
  btnFillTxt:{ fontSize: 13, fontWeight: '800', color: P.white},
  btnGhost:  { backgroundColor: P.white, borderWidth: 1, borderColor: P.border },
  btnGhostTxt:{ fontSize: 13, fontWeight: '700', color: P.dangerText },
  empty:     { alignItems: 'center', paddingTop: 70 },
  emptyIcon: { fontSize: 34, marginBottom: 10 },
  emptyTitle:{ fontSize: 15, fontWeight: '700', color: P.ink },
  emptyText: { fontSize: 12.5, color: P.muted2, textAlign: 'center', marginTop: 4, maxWidth: 260 },
});
