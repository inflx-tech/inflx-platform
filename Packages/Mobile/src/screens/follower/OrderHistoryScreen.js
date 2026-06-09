import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { creatorVibe as C, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import ErrorBoundary from '../../components/ErrorBoundary';

/**
 * OrderHistoryScreen (Orders) — orders-comprehensive.html.
 * Contract: features/follower-orders-profile-rebuild.
 *
 * v91 NATIVE-CRASH PROBE BASELINE.
 * The MIUI "INFLX keeps stopping" native crash fires the instant the Orders
 * tab mounts (confirmed on-device 2026-06-09). The JS ErrorBoundary cannot
 * catch a native crash, so we strip every element UNIQUE to this screen that
 * Profile (MeScreen, renders fine) does NOT use, and rebuild from primitives
 * MeScreen already proves safe on the device:
 *   - NO horizontal ScrollView (the tab pill row) — removed; single list.
 *   - NO RefreshControl — removed; plain pull-less scroll.
 *   - NO emoji glyphs — replaced with react-native-vector-icons (MeScreen uses
 *     these safely); emoji + Minikin text-layout is a known Xiaomi native crash.
 *   - NO custom fontFamily — system default everywhere.
 * Same data source (GET /follower/activity). If this opens, the tabs / refresh /
 * emoji / fonts get re-added one at a time to find the exact trigger.
 */

const KIND = {
  order:        { icon: 'shopping',        label: 'ORDER',        color: '#8B4A2F' },
  booking:      { icon: 'calendar-check',  label: 'BOOKING',      color: '#2D9CDB' },
  pay_at_store: { icon: 'cash',            label: 'PAY-AT-STORE', color: '#3F8A57' },
  enquiry:      { icon: 'email-outline',   label: 'ENQUIRY',      color: '#8A8275' },
  return:       { icon: 'keyboard-return', label: 'RETURN',       color: '#D9531E' },
};

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}
function money(v) {
  if (v == null) return '—';
  try { return fmtRupees(v); } catch { return `₹${v}`; }
}

function OrdersInner({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await followerApi.getActivity();
      const list = (res && (res.data || res) && ((res.data || res).items)) || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('[Orders] load error:', e && e.message);
      setItems([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return (
    <View style={s.container}>
      <Text style={s.title}>Orders</Text>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.brown} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 110 }}>
          {items.length === 0 ? (
            <View style={s.empty}>
              <Icon name="receipt" size={40} color={C.muted} />
              <Text style={s.emptyTitle}>Nothing here yet</Text>
              <Text style={s.emptyText}>Your orders, bookings and visits will appear here.</Text>
            </View>
          ) : items.map((it, i) => {
            const k = KIND[it && it.kind] || KIND.order;
            const via = it && it.via_creator;
            return (
              <TouchableOpacity
                key={(it && it.id) || i}
                style={s.card}
                activeOpacity={0.85}
                onPress={() => it && it.order_id
                  ? navigation.navigate('OrderDetail', { orderId: it.order_id })
                  : navigation.navigate('BrandStore', { brandName: it && it.brand_name })}
              >
                <View style={[s.lg, { backgroundColor: C.soft }]}>
                  <Icon name={k.icon} size={20} color={k.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nm} numberOfLines={1}>{(it && it.brand_name) || 'Order'}</Text>
                  <Text style={s.it} numberOfLines={1}>
                    {money(it && it.net_amount)}
                    {it && it.savings > 0 ? `  · saved ${money(it.savings)}` : ''}
                    {`  · ${fmtDate(it && (it.booking_date || it.created_at))}`}
                  </Text>
                  {via && via.handle ? <Text style={s.via} numberOfLines={1}>via @{via.handle}</Text> : null}
                </View>
                <View style={[s.tg, { backgroundColor: k.color }]}><Text style={s.tgTxt}>{k.label}</Text></View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default function OrderHistoryScreen(props) {
  return <ErrorBoundary screen="Orders"><OrdersInner {...props} /></ErrorBoundary>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.screenBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  title: { fontSize: 23, fontWeight: '700', color: C.ink, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12 },
  lg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nm: { fontSize: 13.5, fontWeight: '800', color: C.ink },
  it: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2 },
  via: { fontSize: 10, color: C.brown, fontWeight: '800', marginTop: 3 },
  tg: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  tgTxt: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 4, marginTop: 10 },
  emptyText: { fontSize: 12, color: C.muted, textAlign: 'center' },
});
