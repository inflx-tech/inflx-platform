import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';
import { emojiFor } from '../../components/vibe/palette';
import { followerApi } from '../../services/api';

/**
 * OrderHistoryScreen (Orders) — rebuilt to orders-comprehensive.html.
 * Contract: features/follower-orders-rebuild.
 *
 * One inbox for every transaction type, driven by GET /follower/activity:
 *   Order (live tracker) · Booking/Rental (date/ref) · Pay-at-store (amount+savings)
 *   · Enquiry · Return — each keeps its "via @creator" 4-ID attribution.
 * Tabs: Active · Orders · Bookings · Visits · Enquiries · Returns · History.
 */

const TABS = [
  { key: 'active',    label: 'Active' },
  { key: 'order',     label: 'Orders' },
  { key: 'booking',   label: 'Bookings' },
  { key: 'pay_at_store', label: 'Visits' },
  { key: 'enquiry',   label: 'Enquiries' },
  { key: 'return',    label: 'Returns' },
  { key: 'history',   label: 'History' },
];

const TAG = {
  order:        { label: 'ORDER',        color: C.brown },
  booking:      { label: 'BOOKING',      color: C.verify },
  pay_at_store: { label: 'PAY-AT-STORE', color: C.green || '#3F8A57' },
  enquiry:      { label: 'ENQUIRY',      color: C.muted },
  return:       { label: 'RETURN',       color: C.offer },
};

// order tracker steps from status
const STEPS = ['Placed', 'Prepared', 'On the way', 'Delivered'];
const STEP_INDEX = { pending: 0, confirmed: 1, dispatched: 2, delivered: 3, completed: 3 };
const isDone = (status) => ['delivered', 'completed', 'cancelled'].includes(String(status || '').toLowerCase());
const isActive = (it) => !isDone(it.status);

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function ViaCreator({ via }) {
  if (!via?.handle) return null;
  return (
    <View style={s.vc}>
      <View style={s.vcAv}><Text style={s.vcAvTxt}>{(via.name || via.handle)[0].toUpperCase()}</Text></View>
      <Text style={s.vcTxt}>via @{via.handle}</Text>
    </View>
  );
}

function OrderTracker({ status }) {
  const idx = STEP_INDEX[String(status || '').toLowerCase()] ?? 0;
  return (
    <View style={s.steps}>
      {STEPS.map((label, i) => (
        <View key={i} style={s.step}>
          {i > 0 ? <View style={[s.bar, i <= idx && s.barFill]} /> : null}
          <View style={[s.dot, i < idx && s.dotDone, i === idx && s.dotNow]}>
            <Text style={s.dotTxt}>{i < idx ? '✓' : (i === idx ? '•' : '')}</Text>
          </View>
          <Text style={[s.slbl, i <= idx && s.slblAct]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Card({ item, navigation }) {
  const tag = TAG[item.kind] || TAG.order;
  const isOrder = item.kind === 'order';
  const isBooking = item.kind === 'booking';
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.lg}><Text style={{ fontSize: 22 }}>{emojiFor(item.brand_category)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.nm} numberOfLines={1}>{item.brand_name}</Text>
          <Text style={s.it} numberOfLines={1}>
            {isBooking && item.booking_date ? `${item.booking_type || 'Booking'} · ${fmtDate(item.booking_date)}` : `${TAG[item.kind]?.label || ''} · ${fmtDate(item.created_at)}`}
          </Text>
        </View>
        <View style={[s.tg, { backgroundColor: tag.color }]}><Text style={s.tgTxt}>{tag.label}</Text></View>
      </View>

      {isOrder && isActive(item) ? <View style={s.track}><OrderTracker status={item.status} /></View> : null}

      <View style={s.foot}>
        <View style={{ flex: 1 }}>
          <Text style={s.amt}>
            {item.net_amount != null ? fmtRupees(item.net_amount) : '—'}
            {item.savings > 0 ? <Text style={s.saved}>  · saved {fmtRupees(item.savings)}</Text> : null}
          </Text>
          <ViaCreator via={item.via_creator} />
        </View>
        <View style={s.actions}>
          {item.order_id ? (
            <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('OrderDetail', { orderId: item.order_id })}>
              <Text style={s.btnTxt}>{isActive(item) ? 'Track →' : 'View'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.btn, s.btnOut]} onPress={() => navigation.navigate('BrandStore', { brandName: item.brand_name })}>
              <Text style={[s.btnTxt, s.btnOutTxt]}>View</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function OrderHistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('active');

  const load = useCallback(async () => {
    try {
      const res = await followerApi.getActivity();
      setItems((res.data || res)?.items || []);
    } catch (e) {
      console.error('[Orders] Error:', e.message);
      setItems([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const visible = useMemo(() => {
    if (tab === 'active') return items.filter(isActive);
    if (tab === 'history') return items.filter(it => isDone(it.status));
    return items.filter(it => it.kind === tab);
  }, [items, tab]);

  return (
    <View style={s.container}>
      <Text style={s.title}>Orders</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabOn]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
              <Text style={s.emptyText}>
                {tab === 'enquiry' || tab === 'return'
                  ? 'This will show up once you have one.'
                  : 'Your orders, bookings and visits will appear here.'}
              </Text>
            </View>
          ) : visible.map((it, i) => <Card key={it.id || i} item={it} navigation={navigation} />)}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.screenBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  title: { fontSize: 23, fontWeight: '600', color: C.ink, paddingHorizontal: 18, paddingTop: 50, fontFamily: fonts.serifDisplay },
  tabRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 7 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 30, marginRight: 7, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  tabOn: { backgroundColor: C.brown, borderColor: C.brown },
  tabTxt: { fontSize: 11.5, fontWeight: '800', color: C.ink, fontFamily: fonts.sansBold },
  tabTxtOn: { color: '#fff' },
  card: { marginHorizontal: 16, marginBottom: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  lg: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  nm: { fontSize: 13, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  it: { fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.sansMedium },
  tg: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  tgTxt: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.4, fontFamily: fonts.sansBold },
  track: { paddingHorizontal: 14, paddingBottom: 10 },
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, alignItems: 'center', gap: 4, position: 'relative' },
  dot: { width: 17, height: 17, borderRadius: 9, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  dotDone: { backgroundColor: C.green || '#3F8A57' },
  dotNow: { backgroundColor: C.brown },
  dotTxt: { fontSize: 8, color: '#fff', fontWeight: '800' },
  bar: { position: 'absolute', top: 8, left: '-50%', width: '100%', height: 2, backgroundColor: C.line, zIndex: 1 },
  barFill: { backgroundColor: C.green || '#3F8A57' },
  slbl: { fontSize: 7.5, fontWeight: '700', color: C.muted },
  slblAct: { color: C.ink },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#fdfbf7' },
  amt: { fontSize: 13, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  saved: { fontSize: 10, color: C.muted, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 7 },
  btn: { backgroundColor: C.brown, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 30 },
  btnOut: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.brown },
  btnTxt: { fontSize: 10.5, fontWeight: '800', color: '#fff', fontFamily: fonts.sansBold },
  btnOutTxt: { color: C.brown },
  vc: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.soft, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, paddingLeft: 3, marginTop: 5 },
  vcAv: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#e6cfa6', alignItems: 'center', justifyContent: 'center' },
  vcAvTxt: { fontSize: 8, fontWeight: '800', color: C.brown },
  vcTxt: { fontSize: 9, fontWeight: '800', color: '#5e4631' },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 4 },
  emptyText: { fontSize: 12, color: C.muted, textAlign: 'center' },
});
