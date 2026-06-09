import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import ErrorBoundary from '../../components/ErrorBoundary';

/**
 * OrderHistoryScreen (Orders) — orders-comprehensive.html.
 * Contract: features/follower-orders-profile-rebuild.
 *
 * Rebuilt to a minimal, crash-proof baseline (no dynamic emoji helper, no
 * nested layout tricks). One inbox driven by GET /follower/activity:
 * Order · Booking · Pay-at-store, with "via @creator". Tabs filter by kind/status.
 * (Order live-tracker re-added later once stable.)
 */

const TABS = [
  { key: 'active',       label: 'Active' },
  { key: 'order',        label: 'Orders' },
  { key: 'booking',      label: 'Bookings' },
  { key: 'pay_at_store', label: 'Visits' },
  { key: 'enquiry',      label: 'Enquiries' },
  { key: 'return',       label: 'Returns' },
  { key: 'history',      label: 'History' },
];

const KIND = {
  order:        { emoji: '🛍️', label: 'ORDER',        color: '#8B4A2F' },
  booking:      { emoji: '📅', label: 'BOOKING',      color: '#2D9CDB' },
  pay_at_store: { emoji: '💸', label: 'PAY-AT-STORE', color: '#3F8A57' },
  enquiry:      { emoji: '✉️', label: 'ENQUIRY',      color: '#8A8275' },
  return:       { emoji: '↩️', label: 'RETURN',       color: '#D9531E' },
};

const isDone = (status) => ['delivered', 'completed', 'cancelled'].includes(String(status || '').toLowerCase());

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
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('active');

  const load = useCallback(async () => {
    try {
      const res = await followerApi.getActivity();
      const list = (res && (res.data || res) && ((res.data || res).items)) || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('[Orders] load error:', e && e.message);
      setItems([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const visible = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    if (tab === 'active') return arr.filter(it => !isDone(it && it.status));
    if (tab === 'history') return arr.filter(it => isDone(it && it.status));
    return arr.filter(it => it && it.kind === tab);
  }, [items, tab]);

  return (
    <View style={s.container}>
      <Text style={s.title}>Orders</Text>

      <View style={s.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabOn]} onPress={() => setTab(t.key)}>
              <Text style={[s.tabTxt, tab === t.key && s.tabTxtOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.brown} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brown} />}
        >
          {visible.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🧾</Text>
              <Text style={s.emptyTitle}>Nothing here yet</Text>
              <Text style={s.emptyText}>Your orders, bookings and visits will appear here.</Text>
            </View>
          ) : visible.map((it, i) => {
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
                <View style={s.lg}><Text style={{ fontSize: 22 }}>{k.emoji}</Text></View>
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
  title: { fontSize: 23, fontWeight: '600', color: C.ink, paddingHorizontal: 18, paddingTop: 50, fontFamily: fonts.serifDisplay },
  tabsWrap: { flexGrow: 0, flexShrink: 0 },
  tabRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 7 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 30, marginRight: 7, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  tabOn: { backgroundColor: C.brown, borderColor: C.brown },
  tabTxt: { fontSize: 11.5, fontWeight: '800', color: C.ink, fontFamily: fonts.sansBold },
  tabTxtOn: { color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12 },
  lg: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  nm: { fontSize: 13.5, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  it: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansMedium },
  via: { fontSize: 10, color: C.brown, fontWeight: '800', marginTop: 3, fontFamily: fonts.sansBold },
  tg: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  tgTxt: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.4, fontFamily: fonts.sansBold },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 4 },
  emptyText: { fontSize: 12, color: C.muted, textAlign: 'center' },
});
