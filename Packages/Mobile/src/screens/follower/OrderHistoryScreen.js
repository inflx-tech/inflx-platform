import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { creatorVibe as C, fonts, fmtRupees, getBusinessAccent } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import ErrorBoundary from '../../components/ErrorBoundary';

/**
 * OrderHistoryScreen (Orders) — restored to orders-comprehensive.html.
 * Contract: features/follower-orders-profile-rebuild.
 *
 * One inbox for everything a follower does, from GET /follower/activity:
 * online order · booking/rental · pay-at-store. Filter tabs, section grouping,
 * a live order tracker for in-progress orders, per-business tinted icon, kind
 * tag, "via @creator" attribution, savings, and pull-to-refresh.
 *
 * HONEST-UI: the activity feed currently unions orders/bookings/pay-at-store
 * only — Enquiries + Returns are separate feeds not yet wired, so those tabs are
 * honest-empty. The payload has no line-items / ETA / ref / QR, so we bind only
 * to real fields (brand, category, amount, savings, status, dates, via-creator)
 * and the card opens the real OrderDetail/BrandStore route rather than showing
 * unwired Cancel/Rate/Reorder buttons.
 *
 * NOTE: the long-standing Orders-tab native crash was a duplicate route name in
 * FollowerNavigator (fixed in v93), NOT this screen's content — so the full
 * design (emoji, fonts, tracker, refresh) is safe to render. Tracker connectors
 * use POSITIVE percentages only (negative percents are an RN crash footgun).
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
  order:        { label: 'ORDER',        color: '#8B4A2F' },
  booking:      { label: 'BOOKING',      color: '#2D9CDB' },
  pay_at_store: { label: 'PAY-AT-STORE', color: '#3F8A57' },
  enquiry:      { label: 'ENQUIRY',      color: '#8A8275' },
  return:       { label: 'RETURN',       color: '#D9531E' },
};

const ORDER_STEPS = ['Placed', 'Confirmed', 'Dispatched', 'Delivered'];
// Map a raw order/txn status to the tracker step index.
function stepIndex(status) {
  const s = String(status || '').toLowerCase();
  if (['delivered', 'completed'].includes(s)) return 3;
  if (['dispatched', 'shipped', 'out_for_delivery', 'on_the_way'].includes(s)) return 2;
  if (['confirmed', 'accepted', 'preparing', 'prepared', 'ready'].includes(s)) return 1;
  return 0; // pending / placed / initiated / null
}

const DONE = ['delivered', 'completed', 'cancelled', 'refunded', 'closed'];
const isDone = (status) => DONE.includes(String(status || '').toLowerCase());

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}
function monthOf(d) {
  if (!d) return 'Earlier';
  try { return new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
  catch { return 'Earlier'; }
}
function money(v) {
  if (v == null) return '—';
  try { return fmtRupees(v); } catch { return `₹${v}`; }
}
function subtitleFor(it) {
  if (it.kind === 'booking') {
    if (it.booking_type) return `${it.booking_type} · ${fmtDate(it.booking_date) || 'scheduled'}`;
    return it.booking_date ? `Scheduled · ${fmtDate(it.booking_date)}` : 'Booking';
  }
  if (it.kind === 'pay_at_store') return 'Paid at store';
  return 'Online order';
}
// Honest status pill (label + palette key) per kind/status.
function statusPill(it) {
  const s = String(it.status || '').toLowerCase();
  if (it.kind === 'booking') {
    if (s === 'cancelled') return { label: 'Cancelled', tone: 'off' };
    if (isDone(s)) return { label: 'Completed', tone: 'grey' };
    return { label: 'Confirmed', tone: 'blue' };
  }
  if (it.kind === 'pay_at_store') return { label: 'Paid', tone: 'green' };
  // order
  if (s === 'cancelled') return { label: 'Cancelled', tone: 'off' };
  if (s === 'delivered' || s === 'completed') return { label: 'Delivered', tone: 'grey' };
  return null; // active orders show the tracker instead of a pill
}

function OrderTracker({ status }) {
  const cur = stepIndex(status);
  return (
    <View style={s.track}>
      <View style={s.steps}>
        {ORDER_STEPS.map((label, i) => {
          const done = i < cur;
          const now = i === cur;
          return (
            <View key={label} style={s.step}>
              {/* left connector (positive % only) */}
              {i > 0 ? <View style={[s.barLeft, i <= cur && s.barFill]} /> : null}
              {/* right connector */}
              {i < ORDER_STEPS.length - 1 ? <View style={[s.barRight, i < cur && s.barFill]} /> : null}
              <View style={[s.dot, done && s.dotDone, now && s.dotNow]}>
                {done ? <Text style={s.dotTxt}>✓</Text> : null}
              </View>
              <Text style={[s.slbl, (done || now) && s.slblAct]} numberOfLines={1}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Card({ it, navigation }) {
  const k = KIND[it.kind] || KIND.order;
  const accent = getBusinessAccent(it.brand_category);
  const via = it.via_creator;
  const pill = statusPill(it);
  const showTracker = it.kind === 'order' && it.order_id && !isDone(it.status);
  const open = () => it.order_id
    ? navigation.navigate('OrderDetail', { orderId: it.order_id })
    : navigation.navigate('BrandStore', { brandName: it.brand_name });

  return (
    <TouchableOpacity style={s.oc} activeOpacity={0.85} onPress={open}>
      <View style={s.oh}>
        <View style={[s.lg, { backgroundColor: accent.dim }]}>
          <Text style={{ fontSize: 22 }}>{accent.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nm} numberOfLines={1}>{it.brand_name || 'Order'}</Text>
          <Text style={s.it} numberOfLines={1}>{subtitleFor(it)}</Text>
        </View>
        <View style={[s.tg, { backgroundColor: k.color }]}><Text style={s.tgTxt}>{k.label}</Text></View>
      </View>

      {showTracker ? <OrderTracker status={it.status} /> : null}

      <View style={s.ofoot}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.amt} numberOfLines={1}>
            {money(it.net_amount)}
            {it.savings > 0 ? <Text style={s.saved}>{`  · saved ${money(it.savings)}`}</Text> : null}
          </Text>
          <View style={s.footMeta}>
            <Text style={s.date}>{fmtDate(it.booking_date || it.created_at)}</Text>
            {via && via.handle ? <Text style={s.via} numberOfLines={1}>· via @{via.handle}</Text> : null}
          </View>
        </View>
        {pill ? <View style={[s.status, ST[pill.tone]]}><Text style={[s.statusTxt, STT[pill.tone]]}>{pill.label}</Text></View>
              : <Text style={s.openHint}>View →</Text>}
      </View>
    </TouchableOpacity>
  );
}

function Section({ title, data, navigation }) {
  if (!data.length) return null;
  return (
    <>
      <Text style={s.secttl}>{title}</Text>
      {data.map((it, i) => <Card key={it.id || `${title}-${i}`} it={it} navigation={navigation} />)}
    </>
  );
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

  const arr = Array.isArray(items) ? items : [];

  // Active view = grouped sections by kind; History = grouped by month; a
  // specific-kind tab = flat list filtered by kind.
  const body = useMemo(() => {
    if (tab === 'enquiry' || tab === 'return') {
      return { empty: tab === 'enquiry'
        ? 'Enquiries you send to brands will appear here.'
        : 'Returns and refunds will appear here.' };
    }
    if (tab === 'active') {
      const active = arr.filter(it => !isDone(it.status));
      return {
        sections: [
          { title: 'Orders in progress', data: active.filter(it => it.kind === 'order') },
          { title: 'Upcoming bookings',  data: active.filter(it => it.kind === 'booking') },
          { title: 'Recent visits',      data: active.filter(it => it.kind === 'pay_at_store') },
        ],
        empty: 'Nothing in progress right now.',
      };
    }
    if (tab === 'history') {
      const done = arr.filter(it => isDone(it.status));
      const byMonth = {};
      done.forEach(it => { const m = monthOf(it.created_at); (byMonth[m] = byMonth[m] || []).push(it); });
      return {
        sections: Object.keys(byMonth).map(m => ({ title: m, data: byMonth[m] })),
        empty: 'No completed activity yet.',
      };
    }
    const filtered = arr.filter(it => it.kind === tab);
    return { sections: [{ title: '', data: filtered }], empty: 'Nothing here yet.' };
  }, [arr, tab]);

  const hasAny = body.sections && body.sections.some(sec => sec.data.length);

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
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brown} />}
        >
          {body.sections && hasAny ? (
            body.sections.map((sec, i) => (
              <Section key={sec.title || i} title={sec.title} data={sec.data} navigation={navigation} />
            ))
          ) : (
            <View style={s.empty}>
              <Text style={{ fontSize: 38, marginBottom: 10 }}>🧾</Text>
              <Text style={s.emptyTitle}>Nothing here yet</Text>
              <Text style={s.emptyText}>{body.empty}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

export default function OrderHistoryScreen(props) {
  return <ErrorBoundary screen="Orders"><OrdersInner {...props} /></ErrorBoundary>;
}

// status pill palettes
const ST = {
  green: { backgroundColor: 'rgba(63,138,87,0.12)', borderColor: 'rgba(63,138,87,0.3)' },
  blue:  { backgroundColor: 'rgba(45,156,219,0.1)', borderColor: 'rgba(45,156,219,0.3)' },
  grey:  { backgroundColor: C.soft, borderColor: C.line },
  off:   { backgroundColor: 'rgba(217,83,30,0.1)', borderColor: 'rgba(217,83,30,0.3)' },
};
const STT = {
  green: { color: '#3F8A57' }, blue: { color: '#2D9CDB' }, grey: { color: C.muted }, off: { color: C.offer },
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.screenBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  title: { fontSize: 23, fontWeight: '600', color: C.ink, paddingHorizontal: 18, paddingTop: 50, fontFamily: fonts.serifDisplay },
  tabsWrap: { flexGrow: 0, flexShrink: 0 },
  tabRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 7 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 30, marginRight: 7, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  tabOn: { backgroundColor: C.brown, borderColor: C.brown },
  tabTxt: { fontSize: 11.5, fontWeight: '800', color: C.ink, fontFamily: fonts.sansBold },
  tabTxtOn: { color: C.onGold },

  secttl: { fontSize: 11, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6, fontFamily: fonts.sansBold },

  oc: { marginHorizontal: 16, marginBottom: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' },
  oh: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  lg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nm: { fontSize: 13.5, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  it: { fontSize: 10.5, color: C.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansMedium },
  tg: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  tgTxt: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.4, fontFamily: fonts.sansBold },

  // tracker
  track: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10 },
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  barLeft: { position: 'absolute', top: 8, left: 0, right: '50%', height: 2, backgroundColor: C.line },
  barRight: { position: 'absolute', top: 8, left: '50%', right: 0, height: 2, backgroundColor: C.line },
  barFill: { backgroundColor: '#3F8A57' },
  dot: { width: 17, height: 17, borderRadius: 9, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  dotDone: { backgroundColor: '#3F8A57' },
  dotNow: { backgroundColor: C.brown },
  dotTxt: { fontSize: 8, color: '#fff', fontWeight: '800' },
  slbl: { fontSize: 8, fontWeight: '700', color: C.muted, fontFamily: fonts.sansBold },
  slblAct: { color: C.ink },

  ofoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#FDFBF7' },
  amt: { fontSize: 13, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  saved: { fontSize: 10, color: C.muted, fontWeight: '600', fontFamily: fonts.sansMedium },
  footMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  date: { fontSize: 9.5, color: C.muted, fontWeight: '700', fontFamily: fonts.monoMedium },
  via: { fontSize: 9.5, color: C.brown, fontWeight: '800', fontFamily: fonts.sansBold, flexShrink: 1 },

  status: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: '800', fontFamily: fonts.sansBold },
  openHint: { fontSize: 10.5, fontWeight: '800', color: C.brown, fontFamily: fonts.sansBold },

  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 4, fontFamily: fonts.displayBold },
  emptyText: { fontSize: 12, color: C.muted, textAlign: 'center', fontFamily: fonts.sansMedium },
});
