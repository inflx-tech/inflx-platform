/**
 * OrderHistoryScreen — My Orders (Stage C4, locked board c4-orders.html
 * frame 1). Contract: features/concept-stagec4-orders/.
 *
 * White law, no yellow (nothing here is a buy action). Tabs All / Active /
 * Delivered / Cancelled over GET /follower/orders (fo.* + brand + creator +
 * live first-item name/image + item_count). Status chips: Confirmed filled ·
 * in-transit outline · Delivered green · Cancelled muted red. COD orders show
 * the amount due.
 *
 * Supersedes the old activity inbox on this screen (fashion-first rebuild) —
 * bookings/pay-at-store history still lives server-side for a later surface.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../services/api';

const TABS = ['All', 'Active', 'Delivered', 'Cancelled'];
const ACTIVE = ['confirmed', 'packed', 'dispatched', 'out_for_delivery'];

const CHIP = {
  confirmed:        { label: 'Confirmed',        fill: true },
  packed:           { label: 'Packed',           fill: false },
  dispatched:       { label: 'Dispatched',       fill: false },
  out_for_delivery: { label: 'Out for delivery', fill: false },
  delivered:        { label: 'Delivered',        green: true },
  cancelled:        { label: 'Cancelled',        red: true },
};

export function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (sameDay) return `Today, ${time}`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function OrderHistoryScreen({ navigation }) {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    const res = await followerApi.getOrders?.().catch(() => null);
    setRefreshing(false);
    setOrders((prev) => (res?.success ? (res.data?.orders || []) : (prev || [])));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = (orders || []).filter((o) => {
    if (tab === 'All') return true;
    if (tab === 'Active') return ACTIVE.includes(o.order_status);
    if (tab === 'Delivered') return o.order_status === 'delivered';
    return o.order_status === 'cancelled';
  });

  const renderCard = ({ item: o }) => {
    const chip = CHIP[o.order_status] || { label: o.order_status, fill: false };
    const count = Number(o.item_count) || 0;
    const isCod = o.payment_method === 'cod';
    const amount = Math.round((Number(o.net_amount) || 0) + (isCod ? Number(o.cod_fee) || 0 : 0));
    return (
      <TouchableOpacity style={[st.card, o.order_status === 'cancelled' && { opacity: 0.65 }]}
        activeOpacity={0.85} onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {o.first_item_image
            ? <Image source={{ uri: o.first_item_image }} style={st.thumb} resizeMode="cover" />
            : <View style={[st.thumb, { backgroundColor: '#F5F2EC' }]} />}
          <View style={{ flex: 1 }}>
            <Text style={st.name} numberOfLines={1}>
              {o.first_item_name || 'Order'}{count > 1 ? ` +${count - 1} more` : ''}
            </Text>
            <Text style={st.sub} numberOfLines={1}>
              {[o.brand_name, o.creator_handle ? `via @${o.creator_handle}` : null].filter(Boolean).join(' · ')}
            </Text>
            {isCod && o.order_status !== 'cancelled' && o.order_status !== 'delivered' && (
              <View style={st.cod}><Text style={st.codTxt}>COD · ₹{amount} due</Text></View>
            )}
          </View>
          <Text style={st.amt}>₹{amount}</Text>
        </View>
        <View style={st.bot}>
          <View style={[st.chip, chip.fill && st.chipFill, chip.green && st.chipGreen, chip.red && st.chipRed]}>
            <Text style={[st.chipTxt, chip.fill && { color: '#FFF' }, chip.green && { color: '#1E9E5A' }, chip.red && { color: '#D64545' }]}>
              {chip.label}
            </Text>
          </View>
          <Text style={st.date}>{fmtWhen(o.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.hdr}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}><Text style={st.back}>‹</Text></TouchableOpacity>
        <View>
          <Text style={st.title}>My Orders</Text>
          <Text style={st.count}>{(orders || []).length} order{(orders || []).length === 1 ? '' : 's'}</Text>
        </View>
      </View>
      <View style={st.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[st.tab, tab === t && st.tabOn]} onPress={() => setTab(t)}>
            <Text style={[st.tabTxt, tab === t && { color: '#FFF' }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {orders == null ? (
        <View style={st.center}><ActivityIndicator color="#111" /></View>
      ) : filtered.length === 0 ? (
        <View style={st.center}>
          <Text style={st.emptyTitle}>{tab === 'All' ? 'No orders yet' : `No ${tab.toLowerCase()} orders`}</Text>
          <Text style={st.emptySub}>Everything you buy from creator posts shows up here.</Text>
          <TouchableOpacity style={st.browseBtn} onPress={() => navigation.goBack()}>
            <Text style={st.browseTxt}>Browse Posts</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          renderItem={renderCard}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: -2 },
  title: { fontSize: 17, fontWeight: '800', color: '#111' },
  count: { fontSize: 12, color: '#8A8A8A', fontWeight: '600', marginTop: 1 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#E4E4E4' },
  tabOn: { backgroundColor: '#111', borderColor: '#111' },
  tabTxt: { fontSize: 12, fontWeight: '700', color: '#555' },
  card: { marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EEE', borderRadius: 14, padding: 12 },
  // Was 52x64 (~0.81) — see ReviewOrderScreen for the rationale.
  thumb: { width: 52, aspectRatio: 3 / 4, borderRadius: 9 },
  name: { fontSize: 12.5, fontWeight: '700', color: '#111' },
  sub: { fontSize: 10.5, color: '#8A8A8A', marginTop: 2 },
  cod: { alignSelf: 'flex-start', backgroundColor: '#FDFBF4', borderWidth: 1, borderColor: '#E0D6BB', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  codTxt: { fontSize: 9.5, fontWeight: '800', color: '#111' },
  amt: { fontSize: 13, fontWeight: '800', color: '#111' },
  bot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F6F6F6' },
  chip: { borderWidth: 1.5, borderColor: '#111', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipFill: { backgroundColor: '#111' },
  chipGreen: { borderColor: '#1E9E5A' },
  chipRed: { borderColor: '#E4E4E4' },
  chipTxt: { fontSize: 10.5, fontWeight: '800', color: '#111' },
  date: { fontSize: 10.5, color: '#8A8A8A', marginLeft: 'auto' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 12, color: '#9A9A9A', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  browseBtn: { marginTop: 16, backgroundColor: '#111', borderRadius: 999, paddingHorizontal: 26, paddingVertical: 12 },
  browseTxt: { color: '#FFF', fontSize: 12.5, fontWeight: '800' },
});
